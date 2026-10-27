/**
 * engine.mjs — reconcile + control orchestration for the autonomy binding.
 *
 * Every state mutation runs under the OS-held bind lock, reads the record through the
 * store's validating reader, applies PURE record transitions, re-reads the LIVE authority,
 * and persists through the revision-checked atomic writer (the kernel lock serializes
 * cooperative writers; the store's revision check catches stale reads). One reconcile
 * invocation = at most ONE durable update (all inputs compose in memory, one write).
 *
 * Stage boundary (design L137 + plan §2): observe/work/review ROUTING and control live
 * here; anything that would ACT on an external system — dispatching a worker, publishing a
 * review, harvesting/egressing — is stage B and is never attempted by this module. The
 * intent-before-effect protocol is the one consequential-command surface A1 owns: an
 * intent is PERSISTED before any effect could be attempted, and because A1 itself never
 * attempts the effect, an unresolved intent is an owned `uncertain_owner` hold with a
 * concrete recovery action — never a simulated success.
 *
 * Production resume is UNCONDITIONALLY held (`productionResumeHold`) — no input, grant,
 * environment value or record state clears it. The pure scoped/revision/replay transition
 * (`proposeResumeTransition` in record.mjs) is fixture-tested logic only; nothing in this
 * engine calls it on a production path.
 */
import { resolve } from 'node:path';
import { canonicalJson } from '../../../intent/helpers/check-result-review.mjs';
import {
  initialRecord,
  applyControlTransition,
  addHold,
  clearHolds,
  hasLiveWorker,
  sha256Hex,
  isIso,
  ADMITTING_STATES,
  TERMINAL_STATES,
} from './record.mjs';
import {
  readRecord,
  writeRecordAtomic,
  ensureStageOwnership,
  canonicalRecordPath,
  resolveRecordTarget,
} from './store.mjs';
import {
  withBindLock,
  platformSupportsAbstractBindLock,
  LOCK_RETRY_DEFAULT_BUDGET_MS,
  LOCK_RETRY_DEFAULT_DELAY_MS,
} from './lock.mjs';
import { readCurrentAuthority, authoritySignature } from './authority.mjs';

export const ROUTES = ['observe', 'work', 'review', 'hold', 'complete'];
/** Observation kinds mirror runtime-bridge await.ts ActionableResult (`kind`). */
export const OBSERVATION_KINDS = ['done', 'parked', 'paused', 'unknown', 'error', 'timeout'];
export const INTENT_RESOLUTIONS = ['applied', 'not-applied', 'abandoned'];
const HISTORY_UNCERTAIN_HOLD_CODE = 'uncertain_owner';
const AUTHORITY_CHANGED_HOLD_CODE = 'authority_changed';
const AUTHORITY_UNAVAILABLE_HOLD_CODE = 'authority_unavailable';
const AUTHORITY_IDENTITY_HOLD_CODE = 'authority_identity_mismatch';
/** R2-03: an explicit feature-home override that does not resolve to the binding's
 * selected physical home — a copied selector elsewhere in the same repository never
 * replaces the selected current source. */
const AUTHORITY_HOME_HOLD_CODE = 'authority_home_mismatch';
/** Every hold code that gates admission, completion and routing (A1-CODE-05 adds identity; R2-03 adds the selected-home pin). */
const AUTHORITY_HOLD_CODES = [AUTHORITY_CHANGED_HOLD_CODE, AUTHORITY_UNAVAILABLE_HOLD_CODE, AUTHORITY_IDENTITY_HOLD_CODE, AUTHORITY_HOME_HOLD_CODE];
const OBSERVATIONS_MAX = 100;
/** Bounded superseded-delivery history (R2-05) — mirrors record.mjs DELIVERY_HISTORY_MAX. */
const DELIVERY_HISTORY_MAX = 20;

function reject(code, reason) {
  return { ok: false, code, reason };
}

function openHolds(record) {
  return record.holds.filter((h) => h.clearedAt === null);
}

/**
 * The ONE authority-hold gate predicate, shared by admission, completion and routing
 * (A1-CODE-05 adds the identity code to what used to be a changed/unavailable pair; R2-03
 * adds the selected-home pin).
 * Precedence is fixed (unavailable > home-mismatch > changed > identity) so the reported
 * reason is deterministic regardless of holds-array order. Returns null when no authority
 * hold is open.
 */
function openAuthorityHold(record) {
  const open = openHolds(record).map((h) => h.code);
  if (open.includes(AUTHORITY_UNAVAILABLE_HOLD_CODE)) return { code: AUTHORITY_UNAVAILABLE_HOLD_CODE, routeReason: 'authority_unavailable' };
  if (open.includes(AUTHORITY_HOME_HOLD_CODE)) return { code: AUTHORITY_HOME_HOLD_CODE, routeReason: 'authority_home_mismatch' };
  if (open.includes(AUTHORITY_CHANGED_HOLD_CODE)) return { code: AUTHORITY_CHANGED_HOLD_CODE, routeReason: 'authority_changed_requires_confirmation' };
  if (open.includes(AUTHORITY_IDENTITY_HOLD_CODE)) return { code: AUTHORITY_IDENTITY_HOLD_CODE, routeReason: 'authority_identity_mismatch' };
  return null;
}

/**
 * Production resume hold — returned BEFORE any record read or mutation, for every resume
 * request, including one carrying `--grant`. The grant path exists only as the
 * fixture-tested pure transition; wiring it to persistence is a stage-B prerequisite
 * (trusted-authority issuance + verification), and until that lands, admitting a resume
 * from a document a caller self-supplied would be exactly the «observation as grant»
 * anti-pattern the design forbids (await.ts: observation documents are DATA, never grants).
 */
export function productionResumeHold() {
  return {
    ok: false,
    code: 'unsupported_pending_prerequisite',
    reason:
      'resume is held in Stage A1: scoped business-control authorization (trusted grant issuance and verification) is a stage-B prerequisite. No CLI flag, grant document, observation payload, path or environment value clears this hold in production — the scoped pure transition exists only as fixture-tested logic and is never wired to persistence here.',
  };
}

/** Reserved stage-B verbs — explicit unsupported, never a simulated live success. */
export function reservedVerbHold(verb) {
  return {
    ok: false,
    code: 'unsupported_pending_prerequisite',
    reason: `${verb} operations are a stage-B prerequisite (live worker/review plumbing over the existing AIF runtime); Stage A1 provides the binding, custody and control substrate they will compose with, and does not simulate them.`,
  };
}

/** The envelope every successful verb returns — inspectable status plus the route. */
function envelope(next, extra = {}) {
  return {
    ok: true,
    recordPath: next.recordPath,
    recordRevision: next.recordRevision,
    controlRevision: next.controlRevision,
    custodyGeneration: next.custodyGeneration,
    controlState: next.controlState,
    disposition: next.disposition,
    holds: openHolds(next),
    pendingIntent: next.pendingIntent,
    ...extra,
  };
}

function killSelf() {
  // Test seam only: a real SIGKILL of this process — no cleanup handlers run, which is the
  // point (the lock must be released by the OS, not by our finally blocks).
  process.kill(process.pid, 'SIGKILL');
}

/**
 * Initial bind. Requires live-verifiable current authority; refuses on unsupported
 * platforms (the whole binding is OS-held serialization — no filesystem-lock fallback).
 */
export async function initBinding(input) {
  const { repoRoot, featureId, stage, stageArtifactRoot, recordPath, featureHome, ownerRoot, actions, destination, now } = input;
  // `_testPlatform` is a TEST-ONLY dependency-injection seam (HOST-01): it drives the REAL
  // platform gate through the real engine path so a suite on any host can verify the
  // non-Linux fail-closed hold with unchanged state. The CLI and every production caller
  // leave it unset (→ process.platform), and it can only ever make the gate FAIL — there
  // is no seam value that makes a non-Linux bind succeed.
  const supported = platformSupportsAbstractBindLock(input._testPlatform);
  if (!supported.ok) return supported;
  for (const field of ['repoRoot', 'featureId', 'stage', 'stageArtifactRoot', 'recordPath', 'featureHome', 'destination']) {
    if (typeof input[field] !== 'string' || input[field].length === 0) {
      return reject('invalid_request', `${field} must be a non-empty string`);
    }
  }
  if (!Array.isArray(actions) || actions.length === 0 || !actions.every((a) => ROUTES.includes(a))) {
    return reject('invalid_request', `actions must be a non-empty subset of ${ROUTES.join('|')}`);
  }
  const canonicalPath = canonicalRecordPath(recordPath);
  // Resolve the write target BEFORE taking the lock — the atomic write is then bound to the
  // resolution the lock was taken against (TOCTOU: a mid-transaction retarget fails closed).
  const preLockTarget = resolveRecordTarget(canonicalPath);
  if (preLockTarget === null) {
    return { ok: false, code: 'record_target_unresolvable', reason: 'the record path resolves through a symlink chain deeper than the bound' };
  }
  return await withBindLock({ recordPath: canonicalPath, retryBudgetMs: input.retryBudgetMs ?? LOCK_RETRY_DEFAULT_BUDGET_MS, retryDelayMs: input.retryDelayMs ?? LOCK_RETRY_DEFAULT_DELAY_MS }, async () => {
    const ownership = ensureStageOwnership({ recordPath: canonicalPath, stageArtifactRoot, ownerRoot: ownerRoot ?? repoRoot });
    if (!ownership.ok) return ownership;
    const authority = readCurrentAuthority({ repoRoot, featureId, featureHome, roots: [repoRoot], now });
    if (!authority.ok) return authority; // no bind without live-verifiable current authority
    const init = initialRecord({
      featureId,
      stage,
      repoIdentity: authority.authority.repoIdentity,
      repoRoot,
      stageArtifactRoot,
      recordPath: canonicalPath,
      actions,
      destination,
      destinationRef: input.destinationRef ?? null,
      selectorRevision: authority.authority.selectorRevision,
      prdSha256: authority.authority.prdSha256,
      prdRef: authority.authority.prdRef,
      specSha256: authority.authority.specSha256,
      specRef: authority.authority.specRef,
      featureHome: resolve(featureHome),
      routineHost: input.routineHost ?? null,
      routineId: input.routineId ?? null,
      taskId: input.taskId ?? null,
      claimRef: input.claimRef ?? null,
      worker: input.worker ?? null,
      candidateRevision: input.candidateRevision ?? 0,
      candidateSha256: input.candidateSha256 ?? null,
      candidateRef: input.candidateRef ?? null,
      actor: input.actor ?? 'operator:cli',
    }, { now });
    if (!init.ok) return init;
    const written = writeRecordAtomic(canonicalPath, init.value, { lockedTarget: preLockTarget, expectedRevision: 0 });
    if (!written.ok) return written;
    return envelope(init.value, { action: 'init', mutated: true, route: 'work', routeReason: 'binding established; admission is a stage-B operation' });
  });
}

/**
 * Validate + normalize an observation document (await.ts ActionableResult-shaped DATA).
 * `custodyGeneration` / `candidateRevision` / `observationId` are optional provenance the
 * reporter may bind; everything else is required.
 */
function normalizeObservation(observation) {
  if (observation === null || typeof observation !== 'object' || Array.isArray(observation)) {
    return reject('invalid_request', 'observation must be a JSON object');
  }
  if (typeof observation.taskId !== 'string' || observation.taskId.length === 0) {
    return reject('invalid_request', 'observation.taskId must be a non-empty string');
  }
  if (!OBSERVATION_KINDS.includes(observation.kind)) {
    return reject('invalid_request', `observation.kind must be one of ${OBSERVATION_KINDS.join('|')}`);
  }
  return {
    ok: true,
    value: {
      taskId: observation.taskId,
      kind: observation.kind,
      status: observation.status ?? null,
      reason: observation.reason ?? null,
      resultRef: observation.resultRef ?? null,
      observationId: observation.observationId ?? null,
      custodyGeneration: observation.custodyGeneration ?? null,
      candidateRevision: observation.candidateRevision ?? null,
    },
  };
}

/**
 * Disposition of an incoming observation against current custody/control/candidate.
 *
 * Provenance applicability (R2-01): a report MAY bind `custodyGeneration` /
 * `candidateRevision`. A provided value must match the record's current value exactly —
 * a value BELOW current is historical (a superseded worker / a superseded candidate), a
 * value ABOVE current claims a custody generation or candidate revision this record has
 * never reached, and a MALFORMED value (anything but a safe non-negative integer) is not
 * applicability at all. Future and malformed values are QUARANTINED under
 * `provenance-unestablished` (bounded-history audit data, never routed) rather than
 * silently accepted as current. Missing provenance is NOT reinterpreted as current on
 * every read: reconcile stamps the ingestion-time custody/candidate onto the stored entry
 * (`applicableCustody` / `applicableCandidate`), so a no-provenance report stays
 * route-eligible only while the record still sits at the custody generation and candidate
 * it was reported under — an advance retires it (see observationRouteEligible).
 *
 * Dedup is identity + FACTS (A1 coverage finding): an observationId is only idempotent
 * when the fact content matches the retained entry. The same id with CONFLICTING content
 * is a provenance conflict, not an ack — it is recorded under its own `duplicate-conflict`
 * disposition (bounded-history audit data, never deduped away, never routed: only
 * `consumed` observations are route-eligible). Dedup is defined WITHIN the retained
 * window: once an id is evicted by the OBSERVATIONS_MAX slice it can be legitimately
 * re-admitted by a later report.
 */
function classifyObservation(next, obs) {
  if (obs.observationId !== null) {
    const prior = next.observations.find((o) => o.observationId === obs.observationId);
    if (prior !== undefined) {
      const sameFact =
        prior.taskId === obs.taskId &&
        prior.kind === obs.kind &&
        prior.status === (obs.status ?? null) &&
        prior.resultRef === (obs.resultRef ?? null) &&
        prior.candidateRevision === (obs.candidateRevision ?? null) &&
        prior.custodyGeneration === (obs.custodyGeneration ?? null);
      if (sameFact) return 'duplicate'; // idempotent re-report — the original entry already carries the fact
      return 'duplicate-conflict'; // same identity, different facts — audit data, never routed
    }
  }
  // R2-01 provenance gates run BEFORE the control-context dispositions: applicability is
  // a data-integrity fact about the report itself, and every disposition it can displace
  // is equally unroutable.
  const custodyMalformed = obs.custodyGeneration !== null && (!Number.isSafeInteger(obs.custodyGeneration) || obs.custodyGeneration < 0);
  const candidateMalformed = obs.candidateRevision !== null && (!Number.isSafeInteger(obs.candidateRevision) || obs.candidateRevision < 0);
  if (custodyMalformed || candidateMalformed) {
    return 'provenance-unestablished'; // malformed provenance — quarantined, never routed
  }
  if (obs.custodyGeneration !== null && obs.custodyGeneration > next.custodyGeneration) {
    return 'provenance-unestablished'; // future custody generation — quarantined, never routed
  }
  if (obs.custodyGeneration !== null && obs.custodyGeneration < next.custodyGeneration) {
    return 'historical-stale-custody'; // a superseded worker reporting late — identity stale
  }
  if (['cancelled', 'cancel-pending'].includes(next.controlState)) {
    return 'historical-after-cancel'; // late result cannot clear (or outlive) a cancellation
  }
  if (next.controlState === 'complete') {
    return 'historical-after-complete'; // late result cannot outlive a verified completion
  }
  if (['paused', 'pause-pending'].includes(next.controlState)) {
    return 'historical-after-pause'; // late result cannot clear an explicit pause
  }
  if (obs.candidateRevision !== null && obs.candidateRevision > next.candidate.revision) {
    return 'provenance-unestablished'; // future candidate revision — quarantined, never routed
  }
  if (obs.candidateRevision !== null && obs.candidateRevision < next.candidate.revision) {
    return 'historical-stale-candidate'; // report bound to a superseded candidate
  }
  return 'consumed';
}

/**
 * Route eligibility (A1-CODE-02, applicability reworked R2-01): an observation drives
 * routing only while it is eligible for the record's CURRENT custody and candidate. A
 * non-`consumed` disposition is audit data (historical-*, provenance-unestablished,
 * duplicate-conflict), never routing evidence. Eligibility is judged against the
 * INGESTION-TIME applicability stamped on the entry (`applicableCustody` /
 * `applicableCandidate` — the reported provenance when the worker bound it, else the
 * record's custody/candidate at ingestion): once custody advances or the candidate moves,
 * the entry is exactly the historical/unknown report that must not route review or
 * completion for the SUCCESSOR worker/candidate. An entry without stamped applicability
 * (a pre-R2 record) is unestablished and never routes — missing provenance is never
 * reinterpreted as current on read.
 */
function observationRouteEligible(obs, record) {
  if (obs.disposition !== undefined && obs.disposition !== 'consumed') return false;
  if (obs.applicableCustody === undefined || obs.applicableCustody !== record.custodyGeneration) return false;
  if (obs.applicableCandidate === undefined || obs.applicableCandidate !== record.candidate.revision) return false;
  return true;
}

/**
 * The ONE routing function (A1-CODE-02): reconcile's response and `status` both call it on
 * the same durable state, so the two doors cannot drift about «what would happen next». A
 * routing ANSWER, not an action and not an acceptance verdict.
 */
function routeFromRecord(record) {
  if (record.pendingIntent !== null && record.pendingIntent.state !== 'resolved') {
    return { route: 'hold', routeReason: 'intent_outcome_uncertain' };
  }
  if (record.controlState !== 'active') {
    return { route: 'hold', routeReason: `control_state_${record.controlState}` };
  }
  const authorityHold = openAuthorityHold(record);
  if (authorityHold !== null) {
    return { route: 'hold', routeReason: authorityHold.routeReason };
  }
  if (record.aif.taskId === null) {
    return { route: 'work', routeReason: 'no task bound; admission is a stage-B operation' };
  }
  let last = null;
  for (let i = record.observations.length - 1; i >= 0; i -= 1) {
    const o = record.observations[i];
    if (o.taskId === record.aif.taskId && observationRouteEligible(o, record)) {
      last = o;
      break;
    }
  }
  if (last === null) {
    const matching = record.observations.some((o) => o.taskId === record.aif.taskId);
    return {
      route: 'observe',
      routeReason: matching
        ? 'matching reports are stale against current custody/candidate; awaiting a current report'
        : 'task bound; awaiting first observation',
    };
  }
  if (last.kind === 'done' && record.delivery !== null && record.delivery.candidateRevision === record.candidate.revision) {
    // R2-05: the delivery must be current for THIS candidate — a receipt bound to a
    // superseded candidate is retained history, not current acceptance authority.
    return { route: 'complete', routeReason: 'delivery receipt recorded' };
  }
  if (last.kind === 'done') {
    return { route: 'review', routeReason: 'worker reported done; review before completion' };
  }
  return { route: 'hold', routeReason: `worker_report_${last.kind}` };
}

/**
 * The reconcile/control pipeline. Every input is optional except recordPath/now; all
 * compose into at most one durable update under one lock acquisition. `control` is
 * {kind: pause|cancel|ack-cessation, reason?}. Test seams: `testCrashAfter`
 * (prewrite|commit|intent) self-SIGKILLs at the named window; `testHoldLockMs` holds the
 * lock before doing work (contention fixture).
 */
export async function reconcile(input) {
  const { recordPath, now } = input;
  if (typeof recordPath !== 'string' || recordPath.length === 0) return reject('invalid_request', 'recordPath must be a non-empty string');
  if (!isIso(now)) return reject('invalid_request', 'now must be an ISO-8601 UTC timestamp string');
  // R2-04: generic production resume is UNCONDITIONALLY held — detected BEFORE the
  // platform gate, the bind lock, the record read, observation ingestion and every action
  // path. `control.kind === 'resume'` composed with otherwise-valid facts (request-action,
  // observation, receipt, candidate, custody transfer) must not persist accumulated state
  // and then reject late: this early return carries no durable write and no admission, so
  // a rejected composite resume leaves the record's bytes, control state and custody
  // generation exactly as they were (asserted byte-for-byte in the suite).
  if (input.control !== undefined && input.control !== null && input.control.kind === 'resume') {
    return productionResumeHold();
  }
  // Same TEST-ONLY platform seam as initBinding (HOST-01) — see the comment there.
  const supported = platformSupportsAbstractBindLock(input._testPlatform);
  if (!supported.ok) return supported;
  const canonicalPath = canonicalRecordPath(recordPath);
  // Capture the write target BEFORE the lock — the atomic write is bound to the resolution
  // the lock was taken against; a mid-transaction retarget fails closed in the store.
  const preLockTarget = resolveRecordTarget(canonicalPath);
  if (preLockTarget === null) {
    return { ok: false, code: 'record_target_unresolvable', reason: 'the record path resolves through a symlink chain deeper than the bound' };
  }
  return await withBindLock({ recordPath: canonicalPath, retryBudgetMs: input.retryBudgetMs ?? LOCK_RETRY_DEFAULT_BUDGET_MS, retryDelayMs: input.retryDelayMs ?? LOCK_RETRY_DEFAULT_DELAY_MS }, async () => {
    if (input.testHoldLockMs && input.testHoldLockMs > 0) {
      await new Promise((settle) => setTimeout(settle, input.testHoldLockMs));
    }
    const read = readRecord(canonicalPath);
    if (!read.ok) return read;
    const base = read.record;
    let next = structuredClone(base);
    let mutated = false;
    // True when THIS pass opened or cleared an authority hold (the authority picture
    // moved): admission is then refused for this pass — the record must settle through
    // one durable write, and the admitting reconcile must read that settled state.
    let authorityHoldTouched = false;
    const effects = [];

    // (1) An unresolved intent is an owned uncertainty — hold with a concrete recovery action.
    if (next.pendingIntent !== null && next.pendingIntent.state !== 'resolved') {
      const held = addHold(next, {
        code: HISTORY_UNCERTAIN_HOLD_CODE,
        reason: `action ${next.pendingIntent.actionId} (${next.pendingIntent.action}) was persisted at ${next.pendingIntent.recordedAt} but its external effect is unverified — outcome is unknown, not successful`,
        recoveryAction: `determine whether action ${next.pendingIntent.actionId} took effect in the external system, then re-run with --resolve-intent ${next.pendingIntent.actionId} --resolution applied|not-applied --evidence <what was found>`,
        now,
      });
      if (!held.ok) return held;
      if (held.value !== next) {
        next = held.value;
        mutated = true;
      }
    }

    // (2) LIVE authority recheck — cached observations never outrank current authority.
    const featureHome = input.featureHome ?? base.authority.featureHome ?? null;
    // R2-03: pin the binding's independently selected authority home. Matching
    // common-directory repository identity is necessary but NOT sufficient — a COPY of an
    // old selector in another directory of the SAME repository must not replace a missing
    // or advanced selected source and admit work. An explicit feature-home override is
    // admitted only when it resolves to the SAME physical home the binding selected at
    // init: canonical aliases (a symlink to the bound home) pass because both sides run
    // through `canonicalRecordPath`; a copied directory fails and opens a hold pending the
    // authorized relocation flow (none exists in A1 — no issuer/service/registry is
    // introduced here). Sibling worktrees are unaffected: the identity gate below keys on
    // the shared git dir, and a worktree reconcile keeps using the bound home.
    let homeOverrideRejected = false;
    if (input.featureHome !== undefined && input.featureHome !== null && base.authority.featureHome !== null) {
      const suppliedHome = canonicalRecordPath(resolve(input.featureHome));
      const boundHome = canonicalRecordPath(base.authority.featureHome);
      if (suppliedHome === null || boundHome === null || suppliedHome !== boundHome) {
        const held = addHold(next, {
          code: AUTHORITY_HOME_HOLD_CODE,
          reason: `feature home ${input.featureHome} resolves to ${suppliedHome ?? '(unresolvable)'} but this binding's selected authority home is ${base.authority.featureHome} — a copied selector in another directory of the same repository cannot replace the selected current source`,
          recoveryAction: `re-run reconcile against the binding's selected authority home (${base.authority.featureHome}) or a canonical alias of it; relocating the selector home is an authorized stage-B+ flow, not an override`,
          now,
        });
        if (!held.ok) return held;
        if (held.value !== next) {
          next = held.value;
          mutated = true;
        }
        authorityHoldTouched = true;
        homeOverrideRejected = true;
        effects.push('authority-home-mismatch');
      }
    }
    if (!homeOverrideRejected && input.repoRoot && featureHome) {
      const live = readCurrentAuthority({ repoRoot: input.repoRoot, featureId: base.featureId, featureHome, roots: [input.repoRoot], now });
      if (live.ok) {
        if (live.authority.repoIdentity !== base.repoIdentity) {
          // A1-CODE-05: the binding's durable repoIdentity gates the live read FIRST,
          // before any signature comparison. A foreign repository whose own selector is
          // perfectly valid — even hash-identical — must never refresh this record's
          // authority, settle its holds, or authorize a transition on it. Sibling
          // worktrees share ONE identity through the common git dir (repoIdentityOf), so
          // reconciling from a worktree of the same repository keeps passing.
          const held = addHold(next, {
            code: AUTHORITY_IDENTITY_HOLD_CODE,
            reason: `live authority was read from repository ${live.authority.repoIdentity} but this binding is bound to repository ${base.repoIdentity} — a foreign repository's selector cannot authorize transitions on this record even when revision/PRD/spec hashes match`,
            recoveryAction: 're-run reconcile against the repository this binding was created in (its own --repo-root and --feature-home); the hold clears on the next same-repository stable read',
            now,
          });
          if (!held.ok) return held;
          if (held.value !== next) {
            next = held.value;
            mutated = true;
          }
          authorityHoldTouched = true;
          effects.push('authority-identity-mismatch');
        } else if (authoritySignature(live.authority) !== authoritySignature(base.authority)) {
          next.authority = { ...live.authority, featureHome: base.authority.featureHome };
          const held = addHold(next, {
            code: AUTHORITY_CHANGED_HOLD_CODE,
            reason: `current authority moved since the last reconcile (selectorRevision/PRD/spec signature changed from ${authoritySignature(base.authority)} to ${authoritySignature(live.authority)})`,
            recoveryAction: 'confirm the new current authority is intended for this binding, then re-run reconcile once stable — the hold clears on the next stable read',
            now,
          });
          if (!held.ok) return held;
          if (held.value !== next) {
            next = held.value;
          }
          mutated = true;
          authorityHoldTouched = true;
          effects.push('authority-refreshed');
        } else if (next.holds.some((h) => AUTHORITY_HOLD_CODES.includes(h.code) && h.clearedAt === null)) {
          // Stable same-repository read after ANY authority hold: all authority hold
          // codes clear — `authority_unavailable` promises recovery in its own
          // recoveryAction («restore the selector … and re-run reconcile»), the identity
          // hold promises the same for a same-repository read, and the R2-03 home hold
          // clears when the reconcile stops overriding the selected home (this arm only
          // runs on a non-rejected home), so a failed, foreign or mis-homed read can
          // never be a permanent admission gate. Recovery and refresh are hold-state
          // transitions either way: admission waits for the NEXT reconcile.
          const clearedIdentity = clearHolds(next, { code: AUTHORITY_IDENTITY_HOLD_CODE, now });
          next = clearedIdentity.value;
          const clearedChanged = clearHolds(next, { code: AUTHORITY_CHANGED_HOLD_CODE, now });
          next = clearedChanged.value;
          const clearedUnavailable = clearHolds(next, { code: AUTHORITY_UNAVAILABLE_HOLD_CODE, now });
          next = clearedUnavailable.value;
          const clearedHome = clearHolds(next, { code: AUTHORITY_HOME_HOLD_CODE, now });
          next = clearedHome.value;
          mutated = true;
          authorityHoldTouched = true;
          effects.push('authority-stable');
        }
      } else {
        const held = addHold(next, {
          code: AUTHORITY_UNAVAILABLE_HOLD_CODE,
          reason: `live authority read failed: ${live.code} — ${live.reason}`,
          recoveryAction: 'restore the current-decisions selector for this feature (or correct --repo-root/--feature-home) and re-run reconcile',
          now,
        });
        if (!held.ok) return held;
        if (held.value !== next) {
          next = held.value;
          mutated = true;
          authorityHoldTouched = true;
        }
      }
    }

    // (3) Observation ingestion — recorded as DATA with a disposition; never a control grant.
    let observationDisposition = null;
    if (input.observation !== undefined) {
      const obs = normalizeObservation(input.observation);
      if (!obs.ok) return obs;
      observationDisposition = classifyObservation(next, obs.value);
      if (observationDisposition !== 'duplicate') {
        // R2-01: FREEZE applicability at ingestion. A report that bound its provenance
        // keeps it; a report without provenance is stamped with the record's custody
        // generation and candidate revision AS THEY WERE AT INGESTION — never re-read as
        // «current» on every route computation. The stored entry therefore stays
        // route-eligible exactly while the record still sits at the custody/candidate it
        // was reported under, and any advance retires it. A MALFORMED reported value
        // (quarantined above) falls back to the record's current values: the entry must
        // stay schema-valid on disk, and its `provenance-unestablished` disposition —
        // not the stamp — is what keeps it unroutable. Dedup still compares the REPORTED
        // fields (null stays null), so idempotent re-reports keep matching.
        const stampCustody = Number.isSafeInteger(obs.value.custodyGeneration) && obs.value.custodyGeneration >= 0
          ? obs.value.custodyGeneration
          : next.custodyGeneration;
        const stampCandidate = Number.isSafeInteger(obs.value.candidateRevision) && obs.value.candidateRevision >= 0
          ? obs.value.candidateRevision
          : next.candidate.revision;
        next.observations.push({
          ...obs.value,
          applicableCustody: stampCustody,
          applicableCandidate: stampCandidate,
          receivedAt: now,
          disposition: observationDisposition,
        });
        if (next.observations.length > OBSERVATIONS_MAX) next.observations = next.observations.slice(-OBSERVATIONS_MAX);
        mutated = true;
      }
      effects.push(`observation:${observationDisposition}`);
    }

    // A rejection raised AFTER facts were ingested earlier in this pass must first make
    // those facts durable: a paused binding refuses new WORK, not its own reporting —
    // dropping an already-classified observation with the rejection would lose the
    // worker's report with zero durable trace. Persist failure outranks the rejection.
    // EVERY rejection site below step (3) goes through this helper — the observation is
    // independently valid DATA the moment it is ingested and classified, regardless of
    // why the rest of the composed pass is refused (input gate, admission gate, or a
    // semantic conflict later in the pipeline).
    const rejectAfterPersist = (code, reason) => {
      if (mutated) {
        if (next.recordRevision === base.recordRevision) next.recordRevision += 1;
        next.updatedAt = now;
        if (input.testCrashAfter === 'prewrite') killSelf();
        const written = writeRecordAtomic(canonicalPath, next, { lockedTarget: preLockTarget, expectedRevision: base.recordRevision });
        if (!written.ok) return written;
        if (input.testCrashAfter === 'commit') killSelf();
      }
      return reject(code, reason);
    };

    // (4) Intent-before-effect — persist the intent BEFORE any effect could be attempted.
    if (input.requestAction !== undefined) {
      const action = input.requestAction;
      if (!ROUTES.includes(action)) return rejectAfterPersist('invalid_request', `request-action must be one of ${ROUTES.join('|')}`);
      // Admission is a live-authority decision: a reconcile that cannot re-read the
      // current authority (no --repo-root, or an unresolvable feature home) must NOT
      // plan work against the snapshot cached at init — that would be a fail-open
      // bypass of the stale-evidence gate below. Fail closed with a named prerequisite.
      if (!input.repoRoot) {
        return rejectAfterPersist('invalid_request', `request-action ${action} requires --repo-root so the live authority can be re-read before admission — the authority snapshot cached at init is never admission authority`);
      }
      if (!featureHome) {
        return rejectAfterPersist('invalid_request', `request-action ${action} requires a resolvable feature home (--feature-home) so the live authority can be re-read before admission`);
      }
      // Admission gate (design L137: pause/cancel stops new admission): only an `active`
      // record admits a new action. Late FACTS (observations, receipts, intent
      // resolutions, custody acks) stay accepted below — a paused or cancelled binding
      // refuses new WORK, it does not refuse its own recovery and reporting paths. The
      // request is rejected, never queued: a pause that silently queued actions would
      // admit them wholesale on resume, which is exactly what the pause is for.
      if (!ADMITTING_STATES.includes(next.controlState)) {
        return rejectAfterPersist('admission_blocked', `control state ${next.controlState} does not admit new actions — lift the pause/cancel through its own boundary before requesting ${action}`);
      }
      // An authority hold must gate admission, or it is a warning nobody reads
      // (attention-is-not-a-mechanism): planning work against unconfirmed or unreadable
      // current authority is exactly the stale-evidence admission PA2 forbids. One pass
      // cannot both transition the hold (open it, or clear it on a stable read) and
      // admit work: the hold state must settle through its own durable write, and the
      // admitting reconcile must read that settled record — so a clear-and-admit in a
      // single pass can never disguise an unconfirmed authority as a confirmed one.
      const authorityHold = openAuthorityHold(next);
      if (authorityHold !== null || authorityHoldTouched) {
        const detail = authorityHold
          ? `authority hold ${authorityHold.code} is open`
          : 'an authority hold was opened or cleared in this same pass';
        return rejectAfterPersist('authority_hold_open', `${detail} — confirm the current authority, run reconcile once on a stable read so the hold state settles, and only then request ${action} on a subsequent reconcile`);
      }
      if (!next.grants.actions.includes(action)) {
        return rejectAfterPersist('action_not_granted', `action ${action} is not in this binding's granted actions [${next.grants.actions.join(', ')}] — the grant list is fixed at init and no flag overrides it`);
      }
      if (next.pendingIntent !== null && next.pendingIntent.state !== 'resolved') {
        return rejectAfterPersist('intent_outstanding', `intent ${next.pendingIntent.actionId} is unresolved — resolve it before planning another action`);
      }
      const actionId = `act-${sha256Hex(canonicalJson({ action, at: now, fromRevision: next.recordRevision, candidate: next.candidate.revision, custody: next.custodyGeneration })).slice(0, 16)}`;
      next.pendingIntent = {
        actionId,
        action,
        bound: { candidateRevision: next.candidate.revision, custodyGeneration: next.custodyGeneration, controlRevision: next.controlRevision, recordRevision: next.recordRevision },
        recordedAt: now,
        state: 'intent_persisted',
      };
      mutated = true;
      effects.push(`intent-planned:${actionId}`);
    }

    // (5) Intent resolution — the owned recovery path for an uncertain effect.
    if (input.resolveIntent !== undefined) {
      const { actionId, resolution, evidence } = input.resolveIntent;
      if (!INTENT_RESOLUTIONS.includes(resolution)) return rejectAfterPersist('invalid_request', `resolution must be one of ${INTENT_RESOLUTIONS.join('|')}`);
      if (typeof evidence !== 'string' || evidence.length < 20) return rejectAfterPersist('invalid_request', 'resolution evidence must be at least 20 characters describing what was actually found');
      if (next.pendingIntent === null || next.pendingIntent.state === 'resolved') return rejectAfterPersist('intent_missing', 'no unresolved intent to resolve');
      if (next.pendingIntent.actionId !== actionId) return rejectAfterPersist('intent_id_mismatch', `open intent is ${next.pendingIntent.actionId}, got ${actionId}`);
      next.pendingIntent = { ...next.pendingIntent, state: 'resolved', resolution: `${resolution}: ${evidence}`, resolvedAt: now };
      const cleared = clearHolds(next, { code: HISTORY_UNCERTAIN_HOLD_CODE, now });
      next = cleared.value;
      mutated = true;
      effects.push(`intent-resolved:${resolution}`);
    }

    // (6) Delivery receipt — a FACT reference, recorded against the granted destination and
    // BOUND TO THE CURRENT CANDIDATE (R2-05): the recorded receipt is acceptance authority
    // only for the candidate it was recorded against. Duplicate handling is
    // candidate-aware: an IDENTICAL receipt for the CURRENT candidate is an idempotent
    // re-ack with no durable mutation; an IDENTICAL receipt whose recorded binding is
    // superseded is a `delivery-superseded-ack` — the recorded fact is retained, not
    // re-bound; a DIFFERENT receipt while one is recorded for the CURRENT candidate is a
    // conflict (two deliveries for the same candidate is exactly the double-delivery the
    // contract forbids); and a different receipt after the candidate ADVANCED is the new
    // candidate's own delivery — the superseded receipt moves to `deliveryHistory`
    // (bounded, retained as history, never current acceptance authority).
    if (input.deliveryReceipt !== undefined) {
      const receipt = input.deliveryReceipt;
      if (typeof receipt !== 'string' || receipt.length === 0) return rejectAfterPersist('invalid_request', 'delivery-receipt must be a non-empty reference');
      const recordDelivery = (r) => {
        next.delivery = {
          receipt: r,
          destination: next.grants.destination,
          at: now,
          actionId: next.pendingIntent && next.pendingIntent.state === 'resolved' ? next.pendingIntent.actionId : null,
          candidateRevision: next.candidate.revision,
        };
        mutated = true;
        effects.push('delivery-recorded');
      };
      if (next.delivery !== null && next.delivery.candidateRevision === next.candidate.revision) {
        if (next.delivery.receipt === receipt) {
          effects.push('delivery-duplicate-ack');
        } else {
          return rejectAfterPersist('delivery_conflict', `a delivery receipt for candidate ${next.candidate.revision} is already recorded (${next.delivery.receipt} at ${next.delivery.at}) — a second, different receipt would be a duplicate delivery; reconcile the recorded one instead`);
        }
      } else if (next.delivery !== null && next.delivery.receipt === receipt) {
        effects.push('delivery-superseded-ack'); // same reference, older candidate — the retained fact is not re-bound to the new candidate
      } else if (next.delivery !== null) {
        const superseded = next.delivery;
        next.deliveryHistory.push(superseded);
        if (next.deliveryHistory.length > DELIVERY_HISTORY_MAX) next.deliveryHistory = next.deliveryHistory.slice(-DELIVERY_HISTORY_MAX);
        effects.push(`delivery-superseded:${superseded.candidateRevision}`);
        recordDelivery(receipt);
      } else {
        recordDelivery(receipt);
      }
    }

    // (7) Custody transfer — legal only past cessation (acknowledged) or with explicit ack.
    if (input.transferCustody !== undefined) {
      const transfer = input.transferCustody;
      if (typeof transfer.toSession !== 'string' || transfer.toSession.length === 0) return rejectAfterPersist('invalid_request', 'transfer-custody requires a non-empty to-session');
      // A terminal binding has no outbound transitions — registering a fresh live worker
      // identity on one would contradict the terminal contract and hand stage B a
      // cessation workflow for a worker that must never be registered.
      if (TERMINAL_STATES.includes(next.controlState)) {
        return rejectAfterPersist('custody_transfer_terminal', `control state ${next.controlState} is terminal — custody cannot be transferred onto a closed binding`);
      }
      if (hasLiveWorker(next)) {
        if (!transfer.acknowledgeCessation) {
          return rejectAfterPersist('custody_transfer_blocked', `worker ${next.worker.sessionId} has not acknowledged cessation — a released lock or expired wait cannot prove external-worker cessation; re-run with acknowledge-cessation to transfer custody explicitly`);
        }
        if (['pause-pending', 'cancel-pending'].includes(next.controlState)) {
          const acked = applyControlTransition(next, { kind: 'ack-cessation', actor: input.actor ?? 'operator:cli', now });
          // Same persist-before-reject contract as every other rejection site: facts
          // ingested earlier in this composed pass (observation, receipt) must survive
          // an ack refusal — defense-in-depth, this guard is unreachable by the
          // pause-pending/cancel-pending precondition above unless validation fails.
          if (!acked.ok) return rejectAfterPersist(acked.code, acked.reason);
          next = acked.value;
          // The ack moved the record — the FACT is durable even when the transfer itself
          // is refused by the gates below (R2-02).
          mutated = true;
          // A1-CODE-03: transfer eligibility is evaluated AFTER every control transition,
          // not only before it. The ack-cessation on cancel-pending just moved the record
          // to `cancelled` — terminal — so the cessation FACT is persisted with this
          // composed pass, but no successor worker may be registered on a closed binding.
          if (TERMINAL_STATES.includes(next.controlState)) {
            return rejectAfterPersist('custody_transfer_terminal', `the cessation acknowledgement completed the ${next.controlState} transition — the ack fact is persisted, but custody cannot be transferred onto a terminal binding, so no successor worker was registered`);
          }
          // R2-02: the pause-pending arm completes to non-terminal `paused` and STOPS
          // there — the acknowledged pause is a fact about the OLD worker, but a paused
          // record admits no successor (the gate below), so no custody advance and no new
          // worker identity may ride on the ack.
        } else {
          next.worker.cessationAckedAt = now;
        }
      }
      // R2-02: a successor worker may be registered ONLY on an admitting record. A paused
      // (or pause-pending) binding must not gain a new worker identity or advance custody
      // — pause blocks successor admission exactly as it blocks new actions, including the
      // already-paused-without-worker case where no ack arm ran. When the ack above did
      // move the record, the refusal persists that fact; when nothing moved, the record's
      // durable bytes are untouched.
      if (!ADMITTING_STATES.includes(next.controlState)) {
        return rejectAfterPersist('custody_transfer_blocked', `control state ${next.controlState} does not admit a successor worker — the previous worker's cessation acknowledgement is persisted as a fact, but custody cannot advance onto a non-admitting binding; lift the pause through its own boundary before transferring custody`);
      }
      next.custodyGeneration += 1;
      next.worker = { sessionId: transfer.toSession, pid: null, startedAt: now, host: null, cessationAckedAt: null };
      mutated = true;
      effects.push(`custody-transferred:${next.custodyGeneration}`);
    }

    // (8) Candidate update — forward-only; stale candidates are rejected, never ingested.
    if (input.candidate !== undefined) {
      const candidate = input.candidate;
      if (!Number.isSafeInteger(candidate.revision) || candidate.revision < 0) return rejectAfterPersist('invalid_request', 'candidate.revision must be a safe integer >= 0');
      if (candidate.revision < next.candidate.revision) {
        return rejectAfterPersist('candidate_regression', `candidate revision ${candidate.revision} is below the recorded ${next.candidate.revision} — stale candidates are rejected, not ingested`);
      }
      if (candidate.revision !== next.candidate.revision) {
        next.candidate = { revision: candidate.revision, sha256: candidate.sha256 ?? null, ref: candidate.ref ?? null, at: now };
        mutated = true;
        effects.push(`candidate-updated:${candidate.revision}`);
      }
    }

    // Completion is an effect-boundary ACCEPTANCE (contract: acceptance rereads current
    // authority, candidate and effective control state at the existing effect boundary),
    // so it carries the same live-authority premise the admission door has: a completion
    // that cannot reread (no --repo-root / unresolvable feature home) would close the
    // binding against the init-time snapshot — fail closed with the same named
    // prerequisite; and an open or same-pass-touched authority hold blocks completion
    // exactly as it blocks admission (one pass cannot move the hold and close on it).
    // pause/cancel/ack-cessation are deliberately NOT gated: stopping work must stay
    // possible when the authority source itself is unreadable.
    const completionGate = () => {
      if (!input.repoRoot) {
        return rejectAfterPersist('invalid_request', 'completion requires --repo-root so the live authority can be re-read at the effect boundary — the authority snapshot cached at init is never completion authority');
      }
      if (!featureHome) {
        return rejectAfterPersist('invalid_request', 'completion requires a resolvable feature home (--feature-home) so the live authority can be re-read at the effect boundary');
      }
      const authorityHold = openAuthorityHold(next);
      if (authorityHold !== null || authorityHoldTouched) {
        const detail = authorityHold
          ? `authority hold ${authorityHold.code} is open`
          : 'an authority hold was opened or cleared in this same pass';
        return rejectAfterPersist('authority_hold_open', `${detail} — completion reads the settled hold state like admission does: confirm the current authority, run reconcile once on a stable read so the hold settles, and only then complete on a subsequent reconcile`);
      }
      return null;
    };

    // A1-CODE-04: BOTH completion doors share ONE admission predicate. Completion is the
    // 'complete' ACTION, so it requires the init-fixed 'complete' grant exactly like any
    // other requested action; and a binding with an unresolved consequential intent must
    // not be closed over an unverified external effect. A delivery receipt stays a
    // recorded FACT (step 6) — it is never the authorization for the transition.
    const completionAdmission = () => {
      if (!next.grants.actions.includes('complete')) {
        return rejectAfterPersist('action_not_granted', `completion requires the 'complete' action grant — [${next.grants.actions.join(', ')}] was fixed at init and no flag extends it; a delivery receipt records a fact, it does not authorize completion`);
      }
      if (next.pendingIntent !== null && next.pendingIntent.state !== 'resolved') {
        return rejectAfterPersist('intent_outstanding', `intent ${next.pendingIntent.actionId} is unresolved — completion would close the binding over an unverified external effect; resolve it (--resolve-intent ${next.pendingIntent.actionId}) before completing`);
      }
      return null;
    };

    // R2-05: BOTH completion doors require a delivery receipt bound to the CURRENT
    // candidate. A receipt recorded against a candidate that has since advanced is
    // retained history — never current acceptance authority — so candidate 1's receipt
    // cannot terminally close candidate 2 without candidate 2's own delivery.
    const deliveryCurrentForCandidate = (record) => record.delivery !== null && record.delivery.candidateRevision === record.candidate.revision;
    const deliveryCurrentReason = (record) => record.delivery === null
      ? 'completion requires a recorded delivery receipt — a routing answer alone is not a completed effect'
      : `the recorded delivery receipt (${record.delivery.receipt}) is bound to candidate ${record.delivery.candidateRevision}, but the current candidate is ${record.candidate.revision} — a superseded delivery is history, not current acceptance authority; record the current candidate's delivery`;

    // (9) Explicit control transitions (pause/cancel/ack-cessation/complete).
    if (input.control !== undefined) {
      // The delivery-receipt precondition is the SAME on both doors that can reach a
      // complete transition (this library surface and markComplete below) — the row-9
      // invariant («completion requires a CURRENT delivery receipt») is not door-specific.
      if (input.control.kind === 'complete') {
        if (!deliveryCurrentForCandidate(next)) {
          return rejectAfterPersist('complete_requires_delivery_receipt', deliveryCurrentReason(next));
        }
        const gated = completionGate();
        if (gated) return gated;
        const denied = completionAdmission();
        if (denied) return denied;
      }
      const transition = applyControlTransition(next, { kind: input.control.kind, actor: input.actor ?? 'operator:cli', reason: input.control.reason, now });
      if (!transition.ok) return rejectAfterPersist(transition.code, transition.reason);
      next = transition.value;
      mutated = true;
      effects.push(`control:${input.control.kind}->${next.controlState}`);
    }

    // (10) Authorized completion — requires a CURRENT delivery receipt and an active binding.
    if (input.markComplete) {
      if (!deliveryCurrentForCandidate(next)) return rejectAfterPersist('complete_requires_delivery_receipt', deliveryCurrentReason(next));
      const gated = completionGate();
      if (gated) return gated;
      const denied = completionAdmission();
      if (denied) return denied;
      const transition = applyControlTransition(next, { kind: 'complete', actor: input.actor ?? 'operator:cli', reason: 'delivery receipt recorded and control verified', now });
      if (!transition.ok) return rejectAfterPersist(transition.code, transition.reason);
      next = transition.value;
      mutated = true;
      effects.push('complete');
    }

    // Persist the single composed update (revision check against what this invocation read).
    if (mutated) {
      // Monotonicity floor: recordRevision is the identity of the durable state, so two
      // distinct contents must never share one revision. The transition helpers
      // (applyControlTransition, addHold, clearHolds) bump internally; the steps that
      // mutate in place (observation ingestion, intent persist/resolve, delivery
      // receipt, custody transfer, candidate update) get the bump here — exactly one
      // advance per durable write, which is what the store's `expectedRevision` check and
      // the «revisions monotonic» acceptance require.
      if (next.recordRevision === base.recordRevision) next.recordRevision += 1;
      next.updatedAt = now;
      if (input.testCrashAfter === 'prewrite') killSelf();
      const written = writeRecordAtomic(canonicalPath, next, { lockedTarget: preLockTarget, expectedRevision: base.recordRevision });
      if (!written.ok) return written;
      if (input.testCrashAfter === 'commit' || (input.testCrashAfter === 'intent' && input.requestAction !== undefined)) killSelf();
    }

    // Route — a routing ANSWER, not an action and not an acceptance verdict. Derived by
    // the ONE shared routing function so `status` cannot drift from it (A1-CODE-02).
    const routed = routeFromRecord(next);
    return envelope(next, { action: input.markComplete ? 'reconcile:complete' : 'reconcile', route: routed.route, routeReason: routed.routeReason, mutated, effects, observationDisposition });
  });
}

/**
 * Inspectable status — read WITHOUT the binding lock (the atomic-rename write protocol
 * guarantees a complete file) and without any live re-reads: status is the record as
 * durably known, clearly separated from the live authority reconciliation that `reconcile`
 * performs. The route is computed by the SAME shared function reconcile ends with
 * (A1-CODE-02), so status alone answers «what would happen next» and the two doors cannot
 * disagree for identical durable state.
 */
export function status(recordPath) {
  if (typeof recordPath !== 'string' || recordPath.length === 0) return reject('invalid_request', 'recordPath must be a non-empty string');
  const read = readRecord(canonicalRecordPath(recordPath));
  if (!read.ok) return read;
  const routed = routeFromRecord(read.record);
  return { ok: true, record: read.record, route: routed.route, routeReason: routed.routeReason };
}
