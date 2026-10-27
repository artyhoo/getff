/**
 * store.mjs — same-filesystem durable atomic persistence for the autonomy binding record.
 *
 * Durability protocol (per write): same-directory temp file created with the exclusive
 * 'wx' flag → write → fsync(file) → atomic rename over the record path → best-effort
 * fsync of the parent directory (crash-consistency of the rename itself; failures there
 * are tolerated — the rename already happened). A reader therefore never observes a
 * partial record: every read sees either the complete previous file or the complete new
 * file, which is what allows status reads to run WITHOUT taking the binding lock.
 *
 * TOCTOU binding (pattern reused from .agents/procedures/intent/helpers/current-decisions.mjs
 * writeSelectorAtomic): the write is BOUND to the CANONICAL target resolved when the lock
 * was taken. The canonical resolution is recomputed inside the transaction immediately
 * before the rename (write-boundary revalidation); an unexpected retarget fails closed
 * with `record_path_retargeted` — writing the freshly-resolved location instead would let
 * lock X guard write Y.
 *
 * Alias safety (A1-CODE-01): every canonical consumer — containment, the bind-lock key and
 * the write target — derives from `canonicalRecordPath`, the ONE fully resolved spelling of
 * a record path (lexical resolve → realpath of the longest existing ancestor → lexical
 * not-yet-existing tail → leaf symlink chain). Two aliases of the same record therefore
 * yield one lock name and one write target; a symlinked ancestor pointing OUTSIDE the
 * owned stage fails containment before any write.
 *
 * Revision check: `writeRecordAtomic` refuses to overwrite an on-disk `recordRevision`
 * other than the expected one (`record_revision_conflict`). The read/check/rename
 * sequence is NOT an atomic unlocked CAS — nothing here serializes a writer that does
 * not hold the lock. What actually serializes cooperative writers is the kernel-held
 * bind lock; the revision check catches the tested stale/sequential cases (a caller
 * deciding from an out-of-date read, an idempotent re-bind) and turns them into loud
 * rejections instead of silent lost updates.
 *
 * R3-01 location invariant: every write (init, reconcile persist, rejectAfterPersist)
 * also verifies the payload SELF-CONSISTENTLY names the target — canonical `recordPath`
 * match + containment inside the declared stage root (`verifyWriteLocation`). A copied
 * record reconciled at another physical path, or any direct store write whose payload
 * names a different location than the one being written, fails closed
 * (`record_path_mismatch` / `record_outside_stage_root`) before a byte moves.
 *
 * Symlink-chain resolution mirrors current-decisions.mjs `resolveWriteTarget` (≤8 hops,
 * fail closed on a deeper chain or an unreadable link). That helper is module-private to
 * the intent helper, so the semantics are mirrored here rather than imported; the AUTHORITY
 * validators this stage must not duplicate (resolveContentRef, liveValidateCurrent*) stay
 * in the intent helper and are reused by authority.mjs.
 */
import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmSync,
  writeSync,
  fsyncSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { canonicalJson } from '../../../intent/helpers/check-result-review.mjs';
import { validateRecord } from './record.mjs';

/** How deep a symlink chain we will follow before failing closed. Same bound as the intent helper. */
const MAX_SYMLINK_HOPS = 8;

/**
 * Resolve the final write target through any symlink chain. Chain end absent → the path
 * to create at; still-symlink past the bound or unreadable link → null (never return a
 * still-symlink path a rename would clobber).
 */
export function resolveRecordTarget(recordPath) {
  let cur = recordPath;
  for (let hop = 0; ; hop += 1) {
    let st;
    try {
      st = lstatSync(cur);
    } catch {
      return cur; // chain end does not exist — this is the create-at path
    }
    if (!st.isSymbolicLink()) return cur;
    if (hop >= MAX_SYMLINK_HOPS) return null; // fail closed — refuse to write a forked location
    let link;
    try {
      link = readlinkSync(cur);
    } catch {
      return null; // unreadable symlink — fail closed
    }
    cur = resolve(dirname(cur), link);
  }
}

/** `child` resolved must equal `parent` resolved or lie strictly beneath it. */
function isWithin(child, parent) {
  if (child === parent) return true;
  return child.startsWith(parent + sep);
}

/**
 * R3-01 (BF-1) — the single writer-boundary location invariant, applied on EVERY durable
 * write for BOTH the incumbent and any proposed record: the write target must BE the
 * location the payload self-declares (canonical `recordPath` match), and must lie inside
 * the stage root the payload self-declares. Malformed (non-string / empty) fields are NOT
 * judged here — `validateRecord` owns schema and rejects them below; this check only
 * fires when the payload carries comparable path strings, so it can never mask a schema
 * failure as a location failure. Unresolvable declared paths fail CLOSED (`*_unresolvable`)
 * — never write through an unresolved alias chain.
 */
function verifyWriteLocation(target, nextRecord) {
  if (nextRecord === null || typeof nextRecord !== 'object' || Array.isArray(nextRecord)) {
    return { ok: true }; // not a comparable payload — validateRecord rejects it below
  }
  if (typeof nextRecord.recordPath === 'string' && nextRecord.recordPath.length > 0) {
    const declared = canonicalRecordPath(nextRecord.recordPath);
    if (declared === null) {
      return { ok: false, code: 'record_target_unresolvable', reason: `the record declares recordPath ${nextRecord.recordPath}, which resolves through a symlink chain deeper than the bound — refusing to write an unresolved fork` };
    }
    if (declared !== target) {
      return {
        ok: false,
        code: 'record_path_mismatch',
        reason: `the record self-identifies as ${declared} (recordPath) but the transaction writes ${target} — a copy, move or fork of the bound record is never a live binding; reconcile the bound path (or a canonical alias of it), and restore/retire the copy instead`,
      };
    }
  }
  if (typeof nextRecord.stageArtifactRoot === 'string' && nextRecord.stageArtifactRoot.length > 0) {
    const stage = canonicalRecordPath(nextRecord.stageArtifactRoot);
    if (stage === null) {
      return { ok: false, code: 'stage_root_unresolvable', reason: 'the declared stage artifact root resolves through a symlink chain deeper than the bound — refusing to write inside an unresolved root' };
    }
    if (!isWithin(target, stage)) {
      return {
        ok: false,
        code: 'record_outside_stage_root',
        reason: `record ${target} is not inside the stage artifact root the record declares (${stage}) — refusing to write a location the binding does not own`,
      };
    }
  }
  return { ok: true };
}

/**
 * Validate stage ownership BEFORE any write (plan §3 step 2: «Validate paths and stage
 * ownership before writes»): the record path must resolve INSIDE the bound stage artifact
 * root, and that root itself must sit inside the FIRST owner root (mirrors the intent
 * helper's `artifact_root_outside_owner` containment). All three paths run through
 * `canonicalRecordPath` (A1-CODE-01) — the same fully resolved spelling the lock and the
 * write use — so a symlinked ancestor pointing outside the owned tree is rejected here,
 * before any write, instead of passing lexical containment.
 */
export function ensureStageOwnership({ recordPath, stageArtifactRoot, ownerRoot }) {
  if (!isAbsolute(recordPath)) {
    return { ok: false, code: 'record_path_not_absolute', reason: `recordPath must be absolute, got ${recordPath}` };
  }
  const recordTarget = canonicalRecordPath(recordPath);
  if (recordTarget === null) {
    return { ok: false, code: 'record_target_unresolvable', reason: 'the record path resolves through a symlink chain deeper than the bound' };
  }
  const stageTarget = canonicalRecordPath(stageArtifactRoot);
  if (stageTarget === null) {
    return { ok: false, code: 'stage_root_unresolvable', reason: 'the stage artifact root resolves through a symlink chain deeper than the bound' };
  }
  if (!existsSync(stageTarget)) {
    return { ok: false, code: 'stage_root_missing', reason: `stage artifact root ${stageTarget} does not exist` };
  }
  if (!isWithin(recordTarget, stageTarget)) {
    return {
      ok: false,
      code: 'record_outside_stage_root',
      reason: `record ${recordTarget} is not inside the bound stage artifact root ${stageTarget} — refusing to write an unowned location`,
    };
  }
  const ownerTarget = canonicalRecordPath(ownerRoot);
  if (ownerTarget === null) {
    return { ok: false, code: 'owner_root_unresolvable', reason: 'the owner root resolves through a symlink chain deeper than the bound' };
  }
  if (!isWithin(stageTarget, ownerTarget)) {
    return {
      ok: false,
      code: 'stage_root_outside_owner',
      reason: `stage artifact root ${stageTarget} is not inside owner root ${ownerTarget} — refusing to bind a stage outside the owner's tree`,
    };
  }
  return { ok: true, recordTarget, stageTarget };
}

/**
 * Read + validate the record. Runs WITHOUT the binding lock: the atomic-rename write
 * protocol guarantees a complete file. Returns {ok, record} or a structured failure:
 * `record_missing` (ENOENT), `record_unreadable` (not JSON or schema-invalid — surfaced
 * for inspection, never silently re-initialised).
 */
export function readRecord(recordPath) {
  let raw;
  try {
    raw = readFileSync(recordPath, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      return { ok: false, code: 'record_missing', reason: `no binding record at ${recordPath}` };
    }
    return { ok: false, code: 'record_unreadable', reason: `cannot read ${recordPath}: ${err && err.message ? err.message : err}` };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { ok: false, code: 'record_unreadable', reason: `record at ${recordPath} is not valid JSON: ${err && err.message ? err.message : err}` };
  }
  const checked = validateRecord(parsed);
  if (!checked.ok) return checked;
  return { ok: true, record: checked.value };
}

function fsyncDirBestEffort(dir) {
  let fd;
  try {
    fd = openSync(dir, 'r');
    fsyncSync(fd);
  } catch {
    // best-effort by contract — platforms/filesystems that refuse directory fsync skip it
  } finally {
    if (fd !== undefined) {
      try {
        closeSync(fd);
      } catch {
        /* nothing further to do */
      }
    }
  }
}

function recordBytes(record) {
  return `${canonicalJson(record)}\n`;
}

/**
 * Revision-checked atomic-place write. `expectedRevision` is the on-disk recordRevision the
 * caller decided from: 0 = the record must NOT exist yet (initial bind), otherwise the
 * on-disk record must carry exactly that revision. This is not an atomic unlocked CAS —
 * the read/check/rename sequence serializes only writers that hold the bind lock for
 * `lockedTarget` (see the module header); the revision check is the stale-read detector,
 * not a concurrency primitive. `lockedTarget` is the CANONICAL
 * resolution the lock was taken against — the canonical resolution is recomputed HERE,
 * inside the transaction and immediately before the rename (write-boundary revalidation,
 * A1-CODE-01); the rename lands only if the path still canonicalizes to the locked target.
 */
export function writeRecordAtomic(recordPath, nextRecord, { lockedTarget, expectedRevision }) {
  const target = canonicalRecordPath(recordPath);
  if (target === null) {
    return { ok: false, code: 'record_target_unresolvable', reason: 'the record path resolves through a symlink chain deeper than the bound' };
  }
  if (target !== lockedTarget) {
    return {
      ok: false,
      code: 'record_path_retargeted',
      reason: `the record resolved to ${target} but the transaction holds the lock for ${lockedTarget} — the path moved during the transaction; refusing to write a target this lock does not guard`,
    };
  }
  // R3-01 writer-boundary invariant (BF-1): the payload must SELF-CONSISTENTLY name the
  // location this transaction actually writes. This runs on EVERY durable write (init,
  // reconcile persist, rejectAfterPersist) for both the incumbent record and any proposed
  // one, so a direct store consumer cannot bypass what the engine checks: a schema-valid
  // record whose `recordPath` names a DIFFERENT path than the write target (the
  // copied-record fork — an unchanged backup reconciled at another physical path) is
  // rejected here, before any byte moves. Containment vs the payload's own stage root is
  // re-verified for the same reason; owner-root containment is transitively preserved
  // from init (ensureStageOwnership validated stage ⊆ owner before the first write, and
  // the engine never rewrites `stageArtifactRoot`), so no owner re-derivation is needed
  // here — this check stays local to the paths the record itself carries. Aliases of the
  // SAME target are unaffected: every spelling runs through `canonicalRecordPath` before
  // comparison. A payload whose fields are not non-empty strings fails this check's
  // guard and is rejected by `validateRecord` below; a payload naming an unresolvable
  // location fails CLOSED (never writes through an unresolved fork).
  const location = verifyWriteLocation(target, nextRecord);
  if (!location.ok) return location;
  const current = readRecord(target);
  if (expectedRevision === 0) {
    if (current.ok) {
      return {
        ok: false,
        code: 'record_already_bound',
        reason: `a binding record already exists at ${target} (recordRevision ${current.record.recordRevision}) — re-init would fork custody; use reconcile`,
      };
    }
    if (current.code !== 'record_missing') {
      return current; // an unreadable incumbent blocks a fresh bind — inspect, never clobber
    }
  } else {
    if (!current.ok) return current; // missing or unreadable — never create-by-overwrite
    if (current.record.recordRevision !== expectedRevision) {
      return {
        ok: false,
        code: 'record_revision_conflict',
        reason: `on-disk recordRevision is ${current.record.recordRevision}, the transaction decided from ${expectedRevision} — re-read and re-decide`,
      };
    }
  }
  const checked = validateRecord(nextRecord);
  if (!checked.ok) return checked; // never persist what this module cannot re-read
  const temp = join(dirname(target), `.autonomy-binding.tmp-${process.pid}-${Math.random().toString(36).slice(2, 10)}`);
  let fd;
  try {
    mkdirSync(dirname(target), { recursive: true });
    fd = openSync(temp, 'wx'); // exclusive: a colliding temp name is a bug, not an overwrite
    writeSync(fd, recordBytes(checked.value));
    fsyncSync(fd);
  } catch (err) {
    rmSync(temp, { force: true }); // never leak a half-written temp beside the canon file
    return { ok: false, code: 'record_write_failed', reason: `temp write failed: ${err && err.message ? err.message : err}` };
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
  try {
    renameSync(temp, target);
  } catch (err) {
    rmSync(temp, { force: true });
    return { ok: false, code: 'record_write_failed', reason: `atomic rename failed: ${err && err.message ? err.message : err}` };
  }
  fsyncDirBestEffort(dirname(target));
  return { ok: true, target, recordRevision: checked.value.recordRevision };
}

/**
 * The single canonical spelling of a record path (A1-CODE-01). Containment, the bind-lock
 * key and the write target ALL derive from this one string, so two aliases of the same
 * record (leaf symlink, symlinked ancestor directory) can neither acquire independent
 * locks nor write forked locations. Resolution order:
 *   1. lexical resolve (absolute, or cwd-relative);
 *   2. realpath the longest EXISTING ancestor — realpath of a not-yet-existing leaf cannot
 *      succeed, so the walk climbs with `dirname` until something exists, then re-appends
 *      the not-yet-existing tail lexically. Symlinked ANCESTOR directories therefore
 *      canonicalize: /alias/binding.json with alias -> /stage anchors on /stage;
 *   3. follow the leaf symlink chain (resolveRecordTarget), so a leaf alias of an existing
 *      record resolves to its target and a dangling leaf link resolves to its create-at
 *      path.
 * A dangling MIDDLE symlink stays lexical here (nothing on the filesystem anchors it); it
 * is still safe because ownership checks run on this same spelling and the write-boundary
 * revalidation fails closed if the resolution changes before the rename. Returns null
 * (fail closed) only when the leaf chain exceeds the hop bound.
 */
export function canonicalRecordPath(recordPath, cwd = process.cwd()) {
  const abs = isAbsolute(recordPath) ? resolve(recordPath) : resolve(cwd, recordPath);
  let anchored = abs;
  let tail = [];
  for (;;) {
    let real;
    try {
      real = realpathSync(anchored);
    } catch {
      const parent = dirname(anchored);
      if (parent === anchored) {
        // Nothing up to the filesystem root exists — there is no ancestor to anchor on,
        // so the lexical path IS the canonical path (leaf walk still applies).
        return canonicalLeaf(abs);
      }
      tail.unshift(basename(anchored));
      anchored = parent;
      continue;
    }
    return canonicalLeaf(join(real, ...tail));
  }
}

/** Leaf-chain suffix of canonicalRecordPath; null → chain deeper than the bound (fail closed). */
function canonicalLeaf(path) {
  const target = resolveRecordTarget(path);
  return target === null ? null : target;
}
