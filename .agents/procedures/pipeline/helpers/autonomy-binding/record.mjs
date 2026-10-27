/**
 * record.mjs — the versioned relationship-record schema and PURE transition logic for the
 * portable-verified-autonomy Stage A1 binding foundation.
 *
 * Scope (design §Concrete first-route contract, "Durable relationship record and ownership"):
 * the record carries REFERENCES and OBSERVATIONS — repository identity, feature/stage,
 * authority content refs, granted actions/destination, business disposition, host routine ID,
 * native attempt IDs, AIF task/claim refs, worker session/process identity, custody
 * generation, candidate revision, pending action, review references, delivery receipt and
 * the last reconciled revision. It never copies private transcripts or credentials, and
 * cached observations never outrank live authority/AIF/PR reads (the engine re-reads those).
 *
 * Purity contract: this module performs NO I/O and NO clock reads — timestamps are always
 * injected via a `now` parameter so every transition is deterministic and testable. The
 * only non-JSON operation is hashing (canonical digests for grant binding and action
 * identity), which is deterministic. I/O lives in store.mjs; live authority reads live in
 * authority.mjs; orchestration lives in engine.mjs.
 *
 * Control-state machine (design L137 semantics, encoded as the single legal-transition
 * table below — every other transition is rejected, not approximated):
 *
 *   active         -> pause-pending   (requestPause, live worker bound: cessation requested)
 *   active         -> paused          (requestPause, no live worker: nothing to cease)
 *   active         -> cancel-pending  (requestCancel, live worker bound)
 *   active         -> cancelled       (requestCancel, no live worker)
 *   pause-pending  -> paused          (acknowledgeCessation — forward only)
 *   cancel-pending -> cancelled       (acknowledgeCessation — forward only)
 *   paused         -> active          (resume — PRODUCTION-HELD; fixture-tested pure
 *                                      transition only, see proposeResumeTransition)
 *   cancelled / complete              (terminal — no outbound transitions, ever)
 *
 * Late results and runtime returns NEVER clear an explicit pause/cancel: observations
 * arriving in a pending/paused/cancelled state are recorded as historical and leave the
 * control state untouched (engine responsibility; this module simply exposes the table).
 */
import { createHash } from 'node:crypto';
import { canonicalJson } from '../../../intent/helpers/check-result-review.mjs';

export const SCHEMA_VERSION = 1;

/** Control states, in admission-block order. `active` is the only admitting state. */
export const CONTROL_STATES = ['active', 'pause-pending', 'paused', 'cancel-pending', 'cancelled', 'complete'];
/** States from which new work may be admitted. Every other state blocks admission. */
export const ADMITTING_STATES = ['active'];
/** Terminal control states — no transition may leave them. */
export const TERMINAL_STATES = ['cancelled', 'complete'];

const SHA256_RE = /^[0-9a-f]{64}$/;
const FEATURE_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
/** Bounded recent-transition log so the record cannot grow without bound. */
const HISTORY_MAX = 50;
/** Bounded observation log — stale/duplicate observations are kept as bounded history. */
const OBSERVATIONS_MAX = 100;
/** Bounded hold log — authority flapping would otherwise append one open+cleared hold
 * pair per flap forever. Pruning (in addHold) drops only already-CLEARED holds, oldest
 * first; an open hold is a live gate and is never silently discarded, so a pathological
 * all-open backlog can still exceed this cap (bounded in practice by hold-code diversity
 * and the admission/completion gates an open hold triggers). */
const HOLDS_MAX = 200;

export function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Canonical projection digest of a record — the identity a resume grant binds. */
export function recordDigest(record) {
  return sha256Hex(canonicalJson(record));
}

/** Digest identifying a grant document itself (replay/consumption key). */
export function grantDigestOf(grant) {
  return sha256Hex(canonicalJson(grant));
}

const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;
export const isIso = (v) => isNonEmptyString(v) && ISO_RE.test(v);
const isHex64 = (v) => isNonEmptyString(v) && SHA256_RE.test(v);
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
/** Structural ContentRef shape check (live resolution is authority.mjs's job via the
 *  exported resolver — this module never reads files). */
const isContentRefShape = (v) => isPlainObject(v) && isNonEmptyString(v.path) && isHex64(v.sha256);

function reject(code, reason) {
  return { ok: false, code, reason };
}

function ok(value) {
  return { ok: true, value };
}

/**
 * The legal control-transition table: [from, kind] -> to. `ack-cessation` is the worker
 * side reporting actual suspension/cancellation; it never applies in `active` (nothing to
 * acknowledge) and never leaves a terminal state. For `pause`/`cancel` from `active`, the
 * destination depends on custody: a LIVE bound worker must first acknowledge cessation
 * (-> `*-pending`), while with no live worker the transition applies IMMEDIATELY — there
 * is nothing whose cessation we would be waiting for (design: «pause with no live worker
 * applies immediately»).
 */
function controlDestination(record, kind) {
  const pending = hasLiveWorker(record);
  if (record.controlState === 'active') {
    if (kind === 'pause') return pending ? 'pause-pending' : 'paused';
    if (kind === 'cancel') return pending ? 'cancel-pending' : 'cancelled';
    if (kind === 'complete') return 'complete'; // authorized completion — terminal
  }
  const staticTargets = {
    'pause-pending>pause': 'pause-pending', // idempotent re-request — no state change
    'cancel-pending>cancel': 'cancel-pending', // idempotent re-request
    'pause-pending>ack-cessation': 'paused',
    'cancel-pending>ack-cessation': 'cancelled',
  };
  return staticTargets[`${record.controlState}>${kind}`];
}

/** Business disposition mirrors control, except pending states stay `active` (the worker may still be running). */
function dispositionFor(state) {
  if (state === 'pause-pending' || state === 'cancel-pending') return 'active';
  return state;
}

/**
 * Validate a decoded record object against schema version 1. Returns {ok,value} or a
 * structured reject; never throws on bad input. This is the store's read-side gate — a
 * record that does not parse-and-validate here is treated as unreadable, never as a
 * fresh bind.
 */
export function validateRecord(value) {
  if (!isPlainObject(value)) return reject('record_invalid', 'record must be a JSON object');
  if (value.schemaVersion !== SCHEMA_VERSION) {
    return reject('record_version_unsupported', `schemaVersion must be ${SCHEMA_VERSION}, got ${JSON.stringify(value.schemaVersion)}`);
  }
  for (const field of ['featureId', 'stage', 'repoIdentity', 'repoRoot', 'stageArtifactRoot', 'recordPath', 'createdAt', 'updatedAt']) {
    if (!isNonEmptyString(value[field])) return reject('record_invalid', `${field} must be a non-empty string`);
  }
  if (!FEATURE_ID_RE.test(value.featureId)) return reject('record_invalid', `featureId must be a stable kebab ID, got ${value.featureId}`);
  for (const field of ['recordRevision', 'controlRevision', 'custodyGeneration']) {
    if (!Number.isSafeInteger(value[field]) || value[field] < 1) {
      return reject('record_invalid', `${field} must be a safe integer >= 1`);
    }
  }
  if (!CONTROL_STATES.includes(value.controlState)) {
    return reject('record_invalid', `controlState must be one of ${CONTROL_STATES.join('|')}, got ${JSON.stringify(value.controlState)}`);
  }
  if (TERMINAL_STATES.includes(value.controlState) && value.controlRevision < 2) {
    // A terminal state can only be reached through at least one control transition, which
    // increments controlRevision above its initial 1 — guards hand-written fake terminals.
    return reject('record_invalid', `terminal controlState ${value.controlState} requires controlRevision >= 2`);
  }
  if (!isPlainObject(value.control) || !isPlainObject(value.control.lastTransition)) {
    return reject('record_invalid', 'control.lastTransition must be an object');
  }
  const lt = value.control.lastTransition;
  for (const field of ['from', 'to', 'at', 'actor']) {
    if (!isNonEmptyString(lt[field])) return reject('record_invalid', `control.lastTransition.${field} must be a non-empty string`);
  }
  if (!isIso(lt.at)) return reject('record_invalid', 'control.lastTransition.at must be an ISO-8601 UTC timestamp');
  if (!CONTROL_STATES.includes(lt.to)) return reject('record_invalid', 'control.lastTransition.to must be a control state');

  if (!isPlainObject(value.grants)) return reject('record_invalid', 'grants must be an object');
  if (!Array.isArray(value.grants.actions) || value.grants.actions.length === 0) {
    return reject('record_invalid', 'grants.actions must be a non-empty array');
  }
  if (!value.grants.actions.every((a) => ['observe', 'work', 'review', 'hold', 'complete'].includes(a))) {
    return reject('record_invalid', `grants.actions entries must be routing actions, got ${JSON.stringify(value.grants.actions)}`);
  }
  if (!isNonEmptyString(value.grants.destination)) return reject('record_invalid', 'grants.destination must be a non-empty string');
  if (value.grants.destinationRef !== null && !isContentRefShape(value.grants.destinationRef)) {
    return reject('record_invalid', 'grants.destinationRef must be a ContentRef or null');
  }

  if (!isPlainObject(value.authority)) return reject('record_invalid', 'authority must be an object');
  // A1-CODE-05: the durable projection carries the repository identity the authority was
  // read against — the engine's identity gate compares it against every live read.
  if (!isNonEmptyString(value.authority.repoIdentity)) {
    return reject('record_invalid', 'authority.repoIdentity must be a non-empty string');
  }
  if (!Number.isSafeInteger(value.authority.selectorRevision) || value.authority.selectorRevision < 0) {
    return reject('record_invalid', 'authority.selectorRevision must be a safe integer >= 0');
  }
  if (!isIso(value.authority.checkedAt)) return reject('record_invalid', 'authority.checkedAt must be an ISO-8601 UTC timestamp');
  for (const field of ['prdSha256', 'specSha256']) {
    if (value.authority[field] !== null && !isHex64(value.authority[field])) {
      return reject('record_invalid', `authority.${field} must be 64-hex or null`);
    }
  }
  for (const field of ['prdRef', 'specRef']) {
    if (value.authority[field] !== null && !isContentRefShape(value.authority[field])) {
      return reject('record_invalid', `authority.${field} must be a ContentRef or null`);
    }
  }
  if (value.authority.featureHome !== null && !isNonEmptyString(value.authority.featureHome)) {
    return reject('record_invalid', 'authority.featureHome must be a non-empty string or null');
  }

  if (!isPlainObject(value.routine) || (value.routine.routineId !== null && !isNonEmptyString(value.routine.routineId))) {
    return reject('record_invalid', 'routine must be an object with routineId string or null');
  }
  if (!Array.isArray(value.nativeAttempts)) return reject('record_invalid', 'nativeAttempts must be an array');

  if (!isPlainObject(value.aif)) return reject('record_invalid', 'aif must be an object');
  if (value.aif.taskId !== null && !isNonEmptyString(value.aif.taskId)) return reject('record_invalid', 'aif.taskId must be a string or null');
  if (value.aif.claimRef !== null && !isNonEmptyString(value.aif.claimRef)) return reject('record_invalid', 'aif.claimRef must be a string or null');

  if (value.worker !== null && !isPlainObject(value.worker)) return reject('record_invalid', 'worker must be an object or null');
  if (value.worker !== null) {
    for (const field of ['sessionId', 'startedAt', 'host']) {
      if (value.worker[field] !== null && !isNonEmptyString(value.worker[field])) {
        return reject('record_invalid', `worker.${field} must be a string or null`);
      }
    }
    if (value.worker.pid !== null && !Number.isSafeInteger(value.worker.pid)) {
      return reject('record_invalid', 'worker.pid must be a safe integer or null');
    }
    if (value.worker.cessationAckedAt !== null && !isIso(value.worker.cessationAckedAt)) {
      return reject('record_invalid', 'worker.cessationAckedAt must be an ISO-8601 UTC timestamp or null');
    }
  }

  if (!isPlainObject(value.candidate)) return reject('record_invalid', 'candidate must be an object');
  if (!Number.isSafeInteger(value.candidate.revision) || value.candidate.revision < 0) {
    return reject('record_invalid', 'candidate.revision must be a safe integer >= 0');
  }
  if (value.candidate.sha256 !== null && !isHex64(value.candidate.sha256)) {
    return reject('record_invalid', 'candidate.sha256 must be 64-hex or null');
  }

  if (value.pendingIntent !== null && !isPlainObject(value.pendingIntent)) {
    return reject('record_invalid', 'pendingIntent must be an object or null');
  }
  if (value.pendingIntent !== null) {
    const pi = value.pendingIntent;
    const INTENT_STATES = ['intent_persisted', 'effect_claimed', 'receipt_missing', 'resolved'];
    for (const field of ['actionId', 'action', 'recordedAt']) {
      if (!isNonEmptyString(pi[field])) return reject('record_invalid', `pendingIntent.${field} must be a non-empty string`);
    }
    if (!INTENT_STATES.includes(pi.state)) {
      return reject('record_invalid', `pendingIntent.state must be one of ${INTENT_STATES.join('|')}`);
    }
    if (!isPlainObject(pi.bound)) return reject('record_invalid', 'pendingIntent.bound must be an object');
    if (pi.state === 'resolved') {
      if (!isNonEmptyString(pi.resolution)) return reject('record_invalid', 'a resolved intent must carry its resolution');
      if (!isIso(pi.resolvedAt)) return reject('record_invalid', 'a resolved intent must carry resolvedAt');
    }
  }

  if (value.delivery !== null && !isPlainObject(value.delivery)) {
    return reject('record_invalid', 'delivery must be an object or null');
  }
  if (value.delivery !== null) {
    for (const field of ['receipt', 'destination', 'at']) {
      if (!isNonEmptyString(value.delivery[field])) {
        return reject('record_invalid', `delivery.${field} must be a non-empty string`);
      }
    }
    if (!isIso(value.delivery.at)) return reject('record_invalid', 'delivery.at must be an ISO-8601 UTC timestamp');
    if (value.delivery.actionId !== null && !isNonEmptyString(value.delivery.actionId)) {
      return reject('record_invalid', 'delivery.actionId must be a string or null');
    }
  }

  for (const field of ['observations', 'reviews', 'holds', 'consumedGrants', 'history']) {
    if (!Array.isArray(value[field])) return reject('record_invalid', `${field} must be an array`);
  }
  for (const obs of value.observations) {
    if (!isPlainObject(obs) || !isNonEmptyString(obs.taskId) || !isNonEmptyString(obs.kind) || !isIso(obs.receivedAt)) {
      return reject('record_invalid', 'each observation must carry taskId, kind and receivedAt');
    }
    if (obs.disposition !== undefined && !isNonEmptyString(obs.disposition)) {
      return reject('record_invalid', 'observation disposition must be a string when present');
    }
  }
  for (const hold of value.holds) {
    for (const field of ['code', 'reason', 'recoveryAction', 'recordedAt']) {
      if (!isPlainObject(hold) || !isNonEmptyString(hold[field])) {
        return reject('record_invalid', `each hold must carry non-empty ${field} — a bare flag is not a hold`);
      }
    }
    if (hold.clearedAt !== null && !isIso(hold.clearedAt)) {
      return reject('record_invalid', 'hold.clearedAt must be an ISO-8601 UTC timestamp or null');
    }
  }
  for (const grant of value.consumedGrants) {
    if (!isPlainObject(grant) || !isHex64(grant.grantDigest) || !isNonEmptyString(grant.action)) {
      return reject('record_invalid', 'each consumed grant must carry a 64-hex grantDigest and an action');
    }
  }
  return ok(value);
}

/** Live worker = a bound worker identity whose cessation has NOT been acknowledged. */
export function hasLiveWorker(record) {
  return record.worker !== null && record.worker.cessationAckedAt === null;
}

/**
 * Pure control transition. Returns {ok, value: nextRecord} or a structured reject. The
 * caller (engine, under the binding lock) persists the returned record. `kind` is one of
 * 'pause' | 'cancel' | 'ack-cessation'. Resume is deliberately NOT reachable here — see
 * the production-hold note on proposeResumeTransition.
 */
export function applyControlTransition(record, { kind, actor, reason, now }) {
  if (!['pause', 'cancel', 'ack-cessation', 'complete'].includes(kind)) {
    return reject('invalid_transition_kind', `unsupported control kind ${JSON.stringify(kind)}`);
  }
  if (!isNonEmptyString(actor)) return reject('control_actor_required', 'a control transition needs a named actor');
  if (!isIso(now)) return reject('control_timestamp_invalid', 'now must be an ISO-8601 UTC timestamp');
  if (TERMINAL_STATES.includes(record.controlState)) {
    return reject('control_state_terminal', `control state ${record.controlState} is terminal; late results and restarts cannot reopen it`);
  }
  const to = controlDestination(record, kind);
  if (to === undefined) {
    return reject('illegal_control_transition', `${kind} is not legal from ${record.controlState}`);
  }
  const next = structuredClone(record);
  next.controlState = to;
  next.disposition = dispositionFor(to);
  next.recordRevision += 1; // every durable mutation is monotonic
  next.controlRevision += 1; // control transitions only
  next.control.lastTransition = { from: record.controlState, to, at: now, actor, ...(reason === undefined ? {} : { reason }) };
  if (kind === 'ack-cessation' && next.worker !== null) {
    next.worker.cessationAckedAt = now;
  }
  next.updatedAt = now;
  next.history.push({ at: now, recordRevision: record.recordRevision, controlRevision: next.controlRevision, summary: `control ${kind}: ${record.controlState} -> ${to} (${actor})` });
  if (next.history.length > HISTORY_MAX) next.history = next.history.slice(-HISTORY_MAX);
  const checked = validateRecord(next);
  if (!checked.ok) return checked; // never persist a record this module cannot re-read
  return ok(next);
}

/**
 * PURE, FIXTURE-ONLY resume transition — the scoped/revision/replay/consumption logic
 * future stages compose on. THIS FUNCTION NEVER TOUCHES DISK and is NOT a production
 * admission path: in A1 every production resume is held with
 * `unsupported_pending_prerequisite` (engine.mjs + CLI), and no CLI flag, environment
 * value, observation payload or grant issuer can route a fixture through persistence.
 * Tests inject an ALREADY-TRUSTED grant here and assert the proposed transition only.
 *
 * The grant binds: action 'resume', repo/feature/stage (task optional), the canonical
 * record path, the CURRENT controlRevision, the CURRENT record digest, and a rationale
 * of at least 20 characters (ancillary quality predicate). Wrong scope, stale revision,
 * stale digest and an already-consumed grant all reject. A valid grant yields a PROPOSED
 * next record: control state active, controlRevision+1, recordRevision+1 and the grant
 * digest appended to consumedGrants in the same atomic update.
 */
export function proposeResumeTransition(record, grant, { now }) {
  if (!isIso(now)) return reject('control_timestamp_invalid', 'now must be an ISO-8601 UTC timestamp');
  if (!isPlainObject(grant)) return reject('grant_invalid', 'grant must be a JSON object');
  if (grant.action !== 'resume') return reject('grant_invalid', `grant action must be 'resume', got ${JSON.stringify(grant.action)}`);
  for (const field of ['featureId', 'stage', 'recordPath', 'rationale']) {
    if (!isNonEmptyString(grant[field])) return reject('grant_invalid', `grant.${field} must be a non-empty string`);
  }
  if (grant.rationale.length < 20) return reject('grant_invalid', 'grant.rationale must be at least 20 characters');
  if (grant.featureId !== record.featureId) return reject('grant_scope_mismatch', `grant names feature ${grant.featureId}, record binds ${record.featureId}`);
  if (grant.stage !== record.stage) return reject('grant_scope_mismatch', `grant names stage ${grant.stage}, record binds ${record.stage}`);
  if (grant.taskId !== undefined && grant.taskId !== null && grant.taskId !== record.aif.taskId) {
    return reject('grant_scope_mismatch', `grant names task ${grant.taskId}, record binds ${JSON.stringify(record.aif.taskId)}`);
  }
  if (grant.recordPath !== record.recordPath) {
    return reject('grant_scope_mismatch', `grant names record ${grant.recordPath}, this record is ${record.recordPath}`);
  }
  // Single-use belt-and-braces: since the digest binds the WHOLE record (consumedGrants
  // included), a post-consumption state can no longer match the grant's bound digest, so
  // the stale-revision/digest checks normally fire first. This check keeps the single-use
  // property explicit even if a future revision of the binding narrows the bound scope.
  const digest = grantDigestOf(grant);
  if (record.consumedGrants.some((g) => g.grantDigest === digest)) {
    return reject('grant_replayed', 'this grant was already consumed; resume grants are single-use');
  }
  if (grant.controlRevision !== record.controlRevision) {
    return reject('grant_revision_stale', `grant expects controlRevision ${grant.controlRevision}, record holds ${record.controlRevision}`);
  }
  if (!isHex64(grant.recordDigest)) return reject('grant_invalid', 'grant.recordDigest must be 64-hex');
  const currentDigest = recordDigest(record);
  if (grant.recordDigest !== currentDigest) {
    return reject('grant_digest_stale', `grant binds record digest ${grant.recordDigest.slice(0, 12)}…, current record digests to ${currentDigest.slice(0, 12)}…`);
  }
  // Resume is legal ONLY from `paused`. A `pause-pending` record must first pass through
  // cessation acknowledgement (the worker may still be running — resuming under it would
  // silently undo a requested cessation), and terminal states are terminal.
  if (record.controlState !== 'paused') {
    return reject('illegal_control_transition', `resume is legal only from 'paused'; current control state is ${record.controlState}`);
  }
  const next = structuredClone(record);
  next.controlState = 'active';
  next.disposition = dispositionFor('active');
  next.recordRevision += 1;
  next.controlRevision += 1;
  next.control.lastTransition = { from: 'paused', to: 'active', at: now, actor: `grant:${digest.slice(0, 12)}`, reason: grant.rationale };
  next.consumedGrants.push({
    grantDigest: digest,
    action: 'resume',
    scope: { featureId: grant.featureId, stage: grant.stage, recordPath: grant.recordPath, controlRevision: grant.controlRevision, recordDigest: grant.recordDigest },
    consumedInRecordRevision: next.recordRevision,
    at: now,
  });
  next.updatedAt = now;
  next.history.push({ at: now, recordRevision: next.recordRevision, controlRevision: next.controlRevision, summary: `control resume: paused -> active (grant ${digest.slice(0, 12)})` });
  if (next.history.length > HISTORY_MAX) next.history = next.history.slice(-HISTORY_MAX);
  const checked = validateRecord(next);
  if (!checked.ok) return checked;
  return ok({ proposed: next, grantDigest: digest }); // proposed — persistence is the caller's separate act
}

/** Build a validated initial record. All mutable counters start at their floors. */
export function initialRecord(bind, { now }) {
  const record = {
    schemaVersion: SCHEMA_VERSION,
    featureId: bind.featureId,
    stage: bind.stage,
    repoIdentity: bind.repoIdentity,
    repoRoot: bind.repoRoot,
    stageArtifactRoot: bind.stageArtifactRoot,
    recordPath: bind.recordPath,
    createdAt: now,
    updatedAt: now,
    recordRevision: 1,
    controlRevision: 1,
    custodyGeneration: bind.custodyGeneration ?? 1,
    controlState: 'active',
    control: { lastTransition: { from: 'active', to: 'active', at: now, actor: bind.actor ?? 'init', reason: 'initial bind' } },
    grants: { actions: bind.actions, destination: bind.destination, destinationRef: bind.destinationRef ?? null },
    disposition: 'active',
    authority: {
      // A1-CODE-05: the projection carries the repository identity the authority was read
      // against, so the comparable signature and the engine's identity gate can bind the
      // cached authority to the repository it came from (top-level repoIdentity stays the
      // binding's own custody identity; they are set from the same resolved value at init).
      repoIdentity: bind.repoIdentity,
      selectorRevision: bind.selectorRevision,
      featureHome: bind.featureHome ?? null, // selector home this binding re-reads authority from
      prdSha256: bind.prdSha256 ?? null,
      specSha256: bind.specSha256 ?? null,
      prdRef: bind.prdRef ?? null,
      specRef: bind.specRef ?? null,
      checkedAt: now,
    },
    routine: { host: bind.routineHost ?? null, routineId: bind.routineId ?? null },
    nativeAttempts: [],
    aif: { taskId: bind.taskId ?? null, claimRef: bind.claimRef ?? null },
    worker: bind.worker ?? null,
    candidate: { revision: bind.candidateRevision ?? 0, sha256: bind.candidateSha256 ?? null, ref: bind.candidateRef ?? null, at: now },
    pendingIntent: null,
    observations: [],
    reviews: [],
    delivery: null, // set only by a recorded delivery receipt; completion requires it
    holds: [],
    consumedGrants: [],
    history: [{ at: now, recordRevision: 1, controlRevision: 1, summary: `bind feature=${bind.featureId} stage=${bind.stage}` }],
  };
  const checked = validateRecord(record);
  if (!checked.ok) return checked;
  return ok(record);
}

/** Append a hold (deduplicated on code+reason); every hold carries a concrete recovery action. */
export function addHold(record, { code, reason, recoveryAction, now }) {
  const existing = record.holds.find((h) => h.code === code && h.reason === reason && h.clearedAt === null);
  // No-op returns the INPUT record, not a clone: the engine's callers detect a hold
  // transition by object identity, and a fresh clone would read as «hold moved» —
  // burning a revision on every reconcile that re-derives an already-open hold.
  if (existing) return ok(record); // one open instance per (code, reason)
  const next = structuredClone(record);
  if (next.holds.length >= HOLDS_MAX) {
    // Bounded hold log (mirrors HISTORY_MAX/OBSERVATIONS_MAX): drop the OLDEST
    // already-cleared holds to make room — never an open one.
    let excess = next.holds.length + 1 - HOLDS_MAX;
    next.holds = next.holds.filter((hold) => {
      if (excess > 0 && hold.clearedAt !== null) {
        excess -= 1;
        return false;
      }
      return true;
    });
  }
  next.holds.push({ code, reason, recoveryAction, recordedAt: now, clearedAt: null });
  next.updatedAt = now;
  next.recordRevision += 1;
  const checked = validateRecord(next);
  if (!checked.ok) return checked;
  return ok(next);
}

/** Clear matching open holds (by code, optionally by reason) — used when the condition passes. */
export function clearHolds(record, { code, now }) {
  const touched = record.holds.some((h) => h.code === code && h.clearedAt === null);
  // No-op returns the INPUT record (see addHold): identity is the engine's «nothing moved» signal.
  if (!touched) return ok(record);
  const next = structuredClone(record);
  for (const hold of next.holds) {
    if (hold.code === code && hold.clearedAt === null) {
      hold.clearedAt = now;
    }
  }
  next.updatedAt = now;
  next.recordRevision += 1;
  const checked = validateRecord(next);
  if (!checked.ok) return checked;
  return ok(next);
}
