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
 * Control-state machine (design L137 semantics + fidelity-r1 F-2, encoded as the single
 * legal-transition table below — every other transition is rejected, not approximated):
 *
 *   active         -> pause-pending   (requestPause, unconfirmed external work bound:
 *                                      live worker, AIF task, native attempts or an
 *                                      unresolved effect — cessation is requested)
 *   active         -> paused          (requestPause, NO unconfirmed external work:
 *                                      there is nothing whose cessation to await)
 *   active         -> cancel-pending  (requestCancel, unconfirmed external work bound)
 *   active         -> cancelled       (requestCancel, no unconfirmed external work)
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
/** Bounded observation log — stale/duplicate observations are kept as bounded history.
 * Exported (R3 advisory): the engine slices with this same bound, so the two modules
 * cannot drift apart silently. */
export const OBSERVATIONS_MAX = 100;
/** Bounded hold log — authority flapping would otherwise append one open+cleared hold
 * pair per flap forever. Pruning (in addHold) drops only already-CLEARED holds, oldest
 * first; an open hold is a live gate and is never silently discarded, so a pathological
 * all-open backlog can still exceed this cap (bounded in practice by hold-code diversity
 * and the admission/completion gates an open hold triggers). */
const HOLDS_MAX = 200;
/** Bounded superseded-delivery history (R2-05): a receipt recorded against a candidate
 * that has since advanced is retained as HISTORY — never current acceptance authority —
 * and is moved here when the current candidate records its own delivery. Exported
 * (R3 advisory): the engine's R3-02 history sweep dedups against this same bound, so
 * the two modules cannot drift apart silently. */
export const DELIVERY_HISTORY_MAX = 20;
/**
 * Bounded seen-delivery-identity accumulator (fidelity-r1 F-3). The superseded-delivery
 * window above is bounded by construction, so a receipt EVICTED from it becomes
 * indistinguishable from a never-seen receipt — and the old code would then re-bind that
 * evicted identity as a NEWER candidate's fresh delivery. This accumulator closes that
 * gap WITHOUT introducing a registry, an issuer or unbounded storage: a FIXED-SIZE
 * (SEEN_MASK_BITS) bit array where admitting a receipt sets 2 hash-derived bits. Bits are
 * never unset, so:
 *   - ANY of a receipt's bits still 0  ⇒ provably NEVER admitted (no false negatives) —
 *     the receipt is fresh and may be recorded;
 *   - BOTH bits set                     ⇒ POSSIBLY admitted before (a ~1-in-2048×2047
 *     collision floor across the receipt population, not proof) — identity is then NOT
 *     establishable from bounded local state, and the engine fails closed with a
 *     persisted `delivery_identity_unestablishable` hold instead of re-binding.
 * The mask is deterministic (sha256-derived, no clock/randomness), fixed-size forever
 * (a record never grows because deliveries were admitted), and additive-optional in the
 * schema (records written before this field carry no mask and behave as empty — see the
 * engine's ensureSeenMask; the residual risk for such legacy records is the documented
 * eviction limit, unchanged).
 */
export const SEEN_MASK_BITS = 2048;
export const SEEN_MASK_HEX_CHARS = SEEN_MASK_BITS / 4; // 512 hex chars = 2048 bits

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

// ---------------------------------------------------------------------------
// Seen-delivery-identity accumulator (F-3) — pure, deterministic, fixed-size.
// ---------------------------------------------------------------------------

/** The 2 mask positions a receipt occupies (sha256-derived; stable across processes). */
function seenBitsFor(receipt) {
  const digest = sha256Hex(`delivery-seen:${receipt}`);
  return [BigInt(parseInt(digest.slice(0, 8), 16) % SEEN_MASK_BITS), BigInt(parseInt(digest.slice(8, 16), 16) % SEEN_MASK_BITS)];
}

const maskFromHex = (maskHex) => BigInt(`0x${maskHex}`);

const maskToHex = (bits) => bits.toString(16).padStart(SEEN_MASK_HEX_CHARS, '0');

/** The all-zero mask — a record that has admitted no deliveries yet. */
export function seenMaskEmptyHex() {
  return maskToHex(0n);
}

/**
 * Set a receipt's bits. Pure: returns the NEW 512-hex-char mask; never mutates, never
 * grows (the output is exactly SEEN_MASK_HEX_CHARS wide for every input).
 */
export function seenMaskAddHex(maskHex, receipt) {
  let bits = maskFromHex(maskHex);
  for (const bit of seenBitsFor(receipt)) bits |= (1n << bit);
  return maskToHex(bits);
}

/**
 * May this receipt already have been admitted through this mask? `false` is PROOF the
 * receipt was never admitted (no false negatives — bits are never unset). `true` means
 * the identity is not establishable from bounded local state: either a genuine replay or
 * a hash collision; the caller must fail closed rather than treat it as freshness proof.
 */
export function seenMaskMayHaveSeenHex(maskHex, receipt) {
  const bits = maskFromHex(maskHex);
  let probe = 0n;
  for (const bit of seenBitsFor(receipt)) probe |= (1n << bit);
  // BOTH bits set ⇒ possibly admitted (genuine replay or collision). ANY bit still 0 ⇒
  // provably NEVER admitted — admission always sets BOTH bits, so a single set bit can
  // only be another receipt's collision, and must NOT fail a genuinely fresh receipt
  // closed (that would be a false "may have seen" on the documented no-false-negative
  // argument above). The `false` set here is exactly «some bit is 0» = never admitted.
  return (bits & probe) === probe;
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
 * Shape of a delivery fact, shared by `delivery` and each `deliveryHistory` entry (R2-05):
 * receipt/destination/at plus the candidate the delivery applies to. The candidate binding
 * is REQUIRED — a delivery is only acceptance authority for the candidate it was recorded
 * against, so a receipt without a candidate revision is not a record this module re-reads.
 *
 * Fidelity-r1 F-1 fields, additive-optional (tolerant read, strict write — the engine
 * always writes both). Since fidelity-r2 F-1, `verified: true` is a LEGACY value only:
 * it was stamped when a caller-supplied content reference was (wrongly) treated as an
 * independent fact, and the engine now writes `verified: false` on every delivery — no
 * stage-A input establishes the delivery FACT (an evidence reference is caller-chosen
 * bytes: file integrity, not a read of the destination subsystem). The durable field is
 * preserved on records that carry it (no migration), but no completion door or route
 * honors it; `evidence` remains the recorded claim reference. A delivery recorded
 * before either repair carries neither field and reads as UNVERIFIED — the absence of
 * proof is not proof of delivery.
 */
function validateDelivery(delivery, label = 'delivery') {
  for (const field of ['receipt', 'destination', 'at']) {
    if (!isNonEmptyString(delivery[field])) {
      return reject('record_invalid', `${label}.${field} must be a non-empty string`);
    }
  }
  if (!isIso(delivery.at)) return reject('record_invalid', `${label}.at must be an ISO-8601 UTC timestamp`);
  if (delivery.actionId !== null && !isNonEmptyString(delivery.actionId)) {
    return reject('record_invalid', `${label}.actionId must be a string or null`);
  }
  if (!Number.isSafeInteger(delivery.candidateRevision) || delivery.candidateRevision < 0) {
    return reject('record_invalid', `${label}.candidateRevision must be a safe integer >= 0 — a delivery binds the exact candidate it was recorded against`);
  }
  if (delivery.verified !== undefined && typeof delivery.verified !== 'boolean') {
    return reject('record_invalid', `${label}.verified must be a boolean when present`);
  }
  if (delivery.evidence !== undefined && delivery.evidence !== null && !isContentRefShape(delivery.evidence)) {
    return reject('record_invalid', `${label}.evidence must be a {path, sha256} content reference or null`);
  }
  return ok(true);
}

/**
 * The legal control-transition table: [from, kind] -> to. `ack-cessation` is the worker
 * side reporting actual suspension/cancellation; it never applies in `active` (nothing to
 * acknowledge) and never leaves a terminal state. For `pause`/`cancel` from `active`, the
 * destination depends on custody: any UNCONFIRMED EXTERNAL WORK (fidelity-r1 F-2 — a live
 * bound worker, a bound AIF task, recorded native attempts, or an unresolved effect) must
 * first have its cessation acknowledged (-> `*-pending`), while with none the transition
 * applies IMMEDIATELY — there is nothing whose cessation we would be waiting for (design:
 * «pause with no live worker applies immediately», narrowed to «no unconfirmed external
 * work»: worker=null alone never proved the referenced AIF task/native effect stopped).
 */
function controlDestination(record, kind) {
  const pending = hasUnconfirmedExternalWork(record);
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
  // Fidelity-r1 F-2 (ack door), restated by the CQ-S01 compat repair: the bound task's
  // cessationEvidence/cessationConfirmedAt pair is HISTORICAL CLAIM DATA. The original
  // comment called it "a DURABLE fact … established by the engine's verified establishment
  // boundary" — no such stage-A establishment exists or ever did (the stamp's writer was
  // withdrawn with fidelity-r2 F-2 and no stage-A subsystem reader establishes those
  // fields), so the fields are read only as legacy claim data and never as establishment.
  // They are still validated for shape and set/cleared-togetherness so pre-repair records
  // stay readable (no migration); `undefined` reads as UNCONFIRMED (the same legacy
  // posture as delivery.verified), never as confirmed.
  if (value.aif.cessationEvidence !== undefined && value.aif.cessationEvidence !== null && !isContentRefShape(value.aif.cessationEvidence)) {
    return reject('record_invalid', 'aif.cessationEvidence must be a {path, sha256} content reference or null');
  }
  if (value.aif.cessationConfirmedAt !== undefined && value.aif.cessationConfirmedAt !== null && !isIso(value.aif.cessationConfirmedAt)) {
    return reject('record_invalid', 'aif.cessationConfirmedAt must be an ISO-8601 UTC timestamp or null');
  }
  if ((value.aif.cessationEvidence === null || value.aif.cessationEvidence === undefined) !== (value.aif.cessationConfirmedAt === null || value.aif.cessationConfirmedAt === undefined)) {
    return reject('record_invalid', 'aif.cessationEvidence and aif.cessationConfirmedAt must be set or cleared together');
  }

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
    // Fidelity-r1 F-1: the content reference a resolution was released WITH. LEGACY since
    // fidelity-r2 F-1 — no stage-A path resolves an intent any more (a caller-supplied
    // reference is claim data, not a fact about the referenced subsystem), so new records
    // only ever carry it on pre-repair resolutions; when present it must still be a real
    // reference shape. Additive-optional; tolerant read, strict write.
    if (pi.evidenceRef !== undefined && pi.evidenceRef !== null && !isContentRefShape(pi.evidenceRef)) {
      return reject('record_invalid', 'pendingIntent.evidenceRef must be a {path, sha256} content reference or null');
    }
    if (pi.state === 'resolved') {
      if (!isNonEmptyString(pi.resolution)) return reject('record_invalid', 'a resolved intent must carry its resolution');
      if (!isIso(pi.resolvedAt)) return reject('record_invalid', 'a resolved intent must carry resolvedAt');
    }
  }

  if (value.delivery !== null && !isPlainObject(value.delivery)) {
    return reject('record_invalid', 'delivery must be an object or null');
  }
  if (value.delivery !== null) {
    const deliveryCheck = validateDelivery(value.delivery);
    if (!deliveryCheck.ok) return deliveryCheck;
  }

  if (!Array.isArray(value.deliveryHistory)) return reject('record_invalid', 'deliveryHistory must be an array');
  for (const superseded of value.deliveryHistory) {
    if (!isPlainObject(superseded)) return reject('record_invalid', 'each superseded delivery must be an object');
    const supersededCheck = validateDelivery(superseded, 'deliveryHistory entry');
    if (!supersededCheck.ok) return supersededCheck;
  }

  // Fidelity-r1 F-3: the bounded seen-delivery-identity accumulator. Additive-optional
  // (pre-repair records carry none and behave as an empty mask); when present it must be
  // EXACTLY the fixed size — a smaller/larger mask would silently change the collision
  // floor the fail-closed decision above rests on.
  if (value.deliverySeen !== undefined) {
    if (!isPlainObject(value.deliverySeen) || !isNonEmptyString(value.deliverySeen.bits)
      || value.deliverySeen.bits.length !== SEEN_MASK_HEX_CHARS
      || !/^[0-9a-f]+$/.test(value.deliverySeen.bits)) {
      return reject('record_invalid', `deliverySeen.bits must be a ${SEEN_MASK_HEX_CHARS}-char lowercase hex accumulator`);
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
    // R2-01: the ingestion-time applicability a report is bound to (reported provenance if
    // the worker supplied it, else the record's custody/candidate at ingestion). Optional
    // for forward compatibility with pre-R2 records; the engine stamps both on every entry.
    for (const field of ['applicableCustody', 'applicableCandidate']) {
      if (obs[field] !== undefined && (!Number.isSafeInteger(obs[field]) || obs[field] < 0)) {
        return reject('record_invalid', `observation ${field} must be a safe integer >= 0 when present`);
      }
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
 * Fidelity-r1 F-2: the NON-WORKER external-work arms — referenced work whose cessation
 * or outcome the local caller CANNOT assert and NO stage-A reader establishes.
 *
 * CQ-S01 (compat repair): a bound AIF task keeps this arm true UNCONDITIONALLY. Its
 * legacy `cessationEvidence`/`cessationConfirmedAt` stamp (written pre-fidelity-r2-F-2,
 * when a caller-supplied digest-verifying evidence reference was wrongly accepted as the
 * subsystem's actual stop) is HISTORICAL CLAIM DATA: no current stage-A subsystem reader
 * establishes those fields, so the stamp must never release the bound task's cessation
 * prerequisite at any door. Pre-repair records keep their durable fields (no migration);
 * this predicate simply stops honoring them. The former `aifCessationConfirmed` helper
 * (stamp present ⇒ confirmed) is deleted with this repair — it encoded exactly the
 * claim-as-fact reading the owner harness falsified (a bound task's seeded legacy stamp
 * let a bare ack complete a pause/cancel).
 *
 * OWNER-CQ04 (compat repair): ANY recorded pendingIntent keeps its arm true — including
 * a legacy `state: 'resolved'` one carrying caller-file `resolution`/`evidenceRef`
 * fields. Those fields are preserved as historical claim data (validateRecord still
 * reads them), but they do not independently establish the external operation's outcome:
 * caller-chosen bytes and their matching digest say nothing about the referenced
 * subsystem's state, and since fidelity-r2 F-1 no stage-A writer resolves an intent, no
 * `resolved` record is engine-reachable — the widened arm changes no live-path behavior.
 *
 * Native attempts keep their arm unconfirmed until stage B defines their lifecycle (they
 * are never written in A1, so this only ever tightens an unreachable shape). These are
 * exactly the arms a bare `ack-cessation` must NOT settle: the ack is the WORKER's report
 * about the directly-bound local worker — extending it to referenced external subsystems
 * on the caller's word alone would be a synthetic acknowledgment. In stage A this
 * function therefore returns true for every record with referenced external work; stage
 * B's live readers are the boundary that may clear it.
 */
export function hasUnconfirmedNonWorkerExternalWork(record) {
  if (record.aif !== null && isNonEmptyString(record.aif.taskId)) return true;
  if (Array.isArray(record.nativeAttempts) && record.nativeAttempts.length > 0) return true;
  return record.pendingIntent !== null;
}

/**
 * Fidelity-r1 F-2: is any EXTERNAL work bound whose cessation or outcome is not yet
 * confirmed? A live un-acked local worker is the original case; a bound AIF task (legacy
 * cessation stamp included — historical claim data, never establishment), a recorded
 * native attempt, or a recorded effect (a pendingIntent in ANY state — a legacy
 * `resolved` claim establishes nothing; see hasUnconfirmedNonWorkerExternalWork) each
 * INDEPENDENTLY keep pause/cancel cessation-pending. A missing/expired local worker
 * proves nothing about referenced external work: the design pins that «direct host
 * routine disable stops future wakes but does not by itself cancel an existing AIF task»,
 * so treating worker===null as cessation asserted a stop nobody confirmed.
 */
export function hasUnconfirmedExternalWork(record) {
  if (hasLiveWorker(record)) return true;
  return hasUnconfirmedNonWorkerExternalWork(record);
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
  // Fidelity-r1 F-2, narrowed by fidelity-r2 F-2 and the CQ-S01/OWNER-CQ04 compat
  // repairs (ack door): an acknowledgement settles ONLY what it can actually attest. The
  // worker arm settles on the worker's own report (stamped below); the non-worker arms —
  // a bound AIF task (its legacy cessation stamp is historical claim data, never
  // establishment), recorded native attempts, a recorded effect (a legacy `resolved`
  // intent claim included — its caller-file resolution establishes nothing) — are
  // referenced external work whose stop NO stage-A input can prove (a caller assertion
  // or caller-chosen bytes is not the subsystem's state), so settling them on it would
  // persist a fake stopped disposition. They are established
  // only by an actual independent read of the referenced subsystem — a stage-B
  // live-read capability; the engine refuses the ack before reaching here, and this
  // record-layer gate is the last-resort defense for any arm that path does not cover.
  // Until that reader exists the pending state is retained with the persisted
  // cessation_unconfirmed hold.
  if (kind === 'ack-cessation' && hasUnconfirmedNonWorkerExternalWork(record)) {
    return reject('cessation_unconfirmed', `a bare acknowledgement cannot settle referenced external work (${[record.aif !== null && isNonEmptyString(record.aif.taskId) ? 'bound aif task' : null, Array.isArray(record.nativeAttempts) && record.nativeAttempts.length > 0 ? 'native attempts' : null, record.pendingIntent !== null ? (record.pendingIntent.state === 'resolved' ? 'legacy resolved intent claim' : 'unresolved effect') : null].filter(Boolean).join(', ') || 'unconfirmed external work'}) — the stop is established only by an actual independent read of the referenced subsystem (a stage-B capability, fidelity-r2 F-2); ${record.controlState} is retained and admission stays blocked`);
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
 * CQ-S03 (compat repair): persist a DIRECTLY BOUND, LOCAL-ONLY worker cessation
 * acknowledgment as a durable fact WITHOUT any control transition. This is the
 * record-layer's second gated cessation stamp writer (alongside `applyControlTransition`'s
 * worker arm above): the engine calls it on an ACTIVE binding when a composed transfer
 * acknowledgment arrives but successor admission is about to be refused (missing
 * authority source, unresolvable feature home, open authority hold). The acknowledgment
 * is a fact about the OLD local worker and must survive the refusal — otherwise a later
 * VALID transfer would have to demand the same acknowledgment twice. Restoring the
 * r1 blanket stamp here is NOT what this does: the gates below make the writer
 * strictly local-only, so referenced external work can never be "stopped" by it.
 *
 * Strictly local-only by construction: a bound AIF task, recorded native attempts or a
 * recorded pendingIntent (any state — see hasUnconfirmedNonWorkerExternalWork) refuse
 * with `cessation_unconfirmed`; there is no external intent, effect or transition —
 * controlState, controlRevision and custodyGeneration are untouched, and only
 * worker.cessationAckedAt, recordRevision, updatedAt and the bounded history move.
 * The F-2 invariant is thereby narrowed, not dropped: BOTH cessation stamp writers are
 * record-layer gated, and the engine never hand-writes the field.
 *
 * Pure: returns {ok, value: nextRecord} or a structured reject. The caller persists the
 * returned record under the binding lock.
 */
export function stampLocalWorkerCessation(record, { actor, now }) {
  if (!isNonEmptyString(actor)) return reject('control_actor_required', 'a cessation acknowledgment needs a named actor');
  if (!isIso(now)) return reject('control_timestamp_invalid', 'now must be an ISO-8601 UTC timestamp');
  if (TERMINAL_STATES.includes(record.controlState)) {
    return reject('control_state_terminal', `control state ${record.controlState} is terminal; a late local acknowledgment cannot reopen it`);
  }
  if (!hasLiveWorker(record)) {
    return reject('custody_transfer_blocked', `no live un-acknowledged local worker to acknowledge (${record.worker === null ? 'no worker is bound' : `worker ${record.worker.sessionId} already acknowledged cessation at ${record.worker.cessationAckedAt}`})`);
  }
  if (hasUnconfirmedNonWorkerExternalWork(record)) {
    return reject('cessation_unconfirmed', 'this acknowledgment is strictly local-only: referenced external work (a bound AIF task, native attempts or a recorded effect) is still unconfirmed, and a caller assertion cannot establish its stop (fidelity-r2 F-2)');
  }
  const next = structuredClone(record);
  next.worker.cessationAckedAt = now;
  next.recordRevision += 1; // every durable mutation is monotonic
  next.updatedAt = now;
  next.history.push({ at: now, recordRevision: record.recordRevision, controlRevision: next.controlRevision, summary: `worker cessation acknowledged for ${next.worker.sessionId} (local-only; no control transition) (${actor})` });
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
    aif: { taskId: bind.taskId ?? null, claimRef: bind.claimRef ?? null, cessationEvidence: null, cessationConfirmedAt: null },
    worker: bind.worker ?? null,
    candidate: { revision: bind.candidateRevision ?? 0, sha256: bind.candidateSha256 ?? null, ref: bind.candidateRef ?? null, at: now },
    pendingIntent: null,
    observations: [],
    reviews: [],
    delivery: null, // set only by a recorded delivery receipt; completion requires it CURRENT for the candidate (R2-05) and VERIFIED against independent evidence (F-1)
    deliveryHistory: [], // superseded deliveries (bound to advanced-away candidates), retained as history (R2-05)
    deliverySeen: { bits: seenMaskEmptyHex() }, // fixed-size admitted-identity accumulator (F-3) — bounds never depend on the history window
    holds: [],
    consumedGrants: [],
    history: [{ at: now, recordRevision: 1, controlRevision: 1, summary: `bind feature=${bind.featureId} stage=${bind.stage}` }],
  };
  const checked = validateRecord(record);
  if (!checked.ok) return checked;
  return ok(record);
}

/**
 * CQ-S02 (compat repair): backfill the fixed-size admitted-identity accumulator from
 * EVERY receipt identity still retained in bounded local state — the current `delivery`
 * plus each `deliveryHistory` entry — BEFORE any new admission can supersede and evict
 * them. Records written before the accumulator existed carry no `deliverySeen` at all,
 * and the engine's legacy materialization created an EMPTY mask at delivery time without
 * consulting those retained identities: the very first post-upgrade admission archived
 * the old delivery into history, a later eviction dropped it from that window, and a
 * genuinely-delivered receipt became indistinguishable from a fresh one — re-bindable as
 * a NEWER candidate's delivery. Seeding closes that window deterministically: for each
 * retained receipt whose bits are not yet set, set them (pure, fixed-size, never-unset —
 * the same no-false-negative contract admission relies on).
 *
 * Honest limit preserved: identities ALREADY forgotten before the upgrade (present in
 * neither the current delivery, the history window, nor a pre-existing mask) are not
 * reconstructible from bounded state and stay forgotten — the pre-repair eviction limit
 * remains their documented state, never silently claimed as closed. Distinct fresh
 * receipts stay admissible (seeding only sets bits for RETAINED identities), storage
 * stays bounded (the mask is fixed-size; the history keeps its own cap), and a mask
 * that already covers every retained identity is a no-op: the INPUT record is returned
 * (identity is the engine's «nothing moved» signal, mirroring addHold/clearHolds), so a
 * repeated delivery pass burns no revision.
 *
 * Pure: returns {ok, value: record} or a structured reject. No recordRevision/updatedAt
 * movement of its own — the engine's durable-write tail bump covers the mutation,
 * exactly like the in-place step mutations it composes with.
 */
export function seedDeliverySeenFromRetained(record) {
  const retained = [];
  if (record.delivery !== null && isNonEmptyString(record.delivery.receipt)) retained.push(record.delivery.receipt);
  if (Array.isArray(record.deliveryHistory)) {
    for (const superseded of record.deliveryHistory) {
      if (superseded !== null && isNonEmptyString(superseded.receipt)) retained.push(superseded.receipt);
    }
  }
  let bits = record.deliverySeen !== undefined && record.deliverySeen !== null ? record.deliverySeen.bits : seenMaskEmptyHex();
  let changed = false;
  for (const receipt of retained) {
    if (!seenMaskMayHaveSeenHex(bits, receipt)) {
      bits = seenMaskAddHex(bits, receipt);
      changed = true;
    }
  }
  if (!changed) return ok(record);
  const next = structuredClone(record);
  next.deliverySeen = { bits };
  const checked = validateRecord(next);
  if (!checked.ok) return checked; // never persist a record this module cannot re-read
  return ok(next);
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
