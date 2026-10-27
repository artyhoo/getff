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
 * writeSelectorAtomic): the write is BOUND to the target resolved when the lock was taken.
 * The chain is re-resolved immediately before the rename; an unexpected retarget fails
 * closed with `record_path_retargeted` — writing the freshly-resolved location instead
 * would let lock X guard write Y.
 *
 * CAS: `writeRecordAtomic` refuses to overwrite an on-disk `recordRevision` other than
 * the expected one (`record_revision_conflict`). All legitimated writers hold the bind
 * lock, so this is defense-in-depth against a writer that bypassed the lock — it turns a
 * silent lost-update into a loud hold.
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
 * Validate stage ownership BEFORE any write (plan §3 step 2: «Validate paths and stage
 * ownership before writes»): the record path must resolve INSIDE the bound stage artifact
 * root, and that root itself must sit inside the FIRST owner root (mirrors the intent
 * helper's `artifact_root_outside_owner` containment). All checks run on resolved targets.
 */
export function ensureStageOwnership({ recordPath, stageArtifactRoot, ownerRoot }) {
  if (!isAbsolute(recordPath)) {
    return { ok: false, code: 'record_path_not_absolute', reason: `recordPath must be absolute, got ${recordPath}` };
  }
  const recordTarget = resolveRecordTarget(recordPath);
  if (recordTarget === null) {
    return { ok: false, code: 'record_target_unresolvable', reason: 'the record path resolves through a symlink chain deeper than the bound' };
  }
  const stageTarget = resolveRecordTarget(stageArtifactRoot);
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
  const ownerTarget = resolveRecordTarget(ownerRoot);
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
 * Atomic compare-and-swap write. `expectedRevision` is the on-disk recordRevision the
 * caller decided from: 0 = the record must NOT exist yet (initial bind), otherwise the
 * on-disk record must carry exactly that revision. `lockedTarget` is the resolution the
 * lock was taken against — the rename lands only if the chain still resolves there.
 */
export function writeRecordAtomic(recordPath, nextRecord, { lockedTarget, expectedRevision }) {
  const target = resolveRecordTarget(recordPath);
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

/** Absolute canonical record path helper — the single spelling used for lock keys and CAS. */
export function canonicalRecordPath(recordPath, cwd = process.cwd()) {
  return isAbsolute(recordPath) ? resolve(recordPath) : resolve(cwd, recordPath);
}
