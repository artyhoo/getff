/**
 * lock.mjs — OS-held local advisory serialization for the autonomy binding (Stage A1).
 *
 * Mechanism: a Linux ABSTRACT-NAMESPACE unix-socket bind. `bind(2)` on an abstract name
 * is a single atomic syscall, so acquisition IS the bind — there is no separate
 * claim-then-verify window. The kernel releases the name when the last holder process
 * exits (including SIGKILL), so crash recovery needs NO protocol at all: no filesystem
 * entry exists, hence no stale lock file and no unlink step.
 *
 * A1-ARCH-01 (plan repair record): the pathname-socket variant — bind a filesystem
 * address, and on ECONNREFUSED treat the holder as dead, unlink, and re-bind — is a
 * REFUTED protocol class and is deliberately NOT implemented here. Its recovery race can
 * delete a successor's LIVE listener (the "recovery" unlinks a name a fresh holder just
 * bound). This module keeps the failure mode as a documented negative: there is no
 * unlink of a bound name anywhere in this protocol, under any error, ever.
 *
 * Fail-closed surface:
 * - non-Linux platform: abstract namespaces are a Linux socket feature →
 *   `unsupported_pending_prerequisite` BEFORE any attempt (row 18 of the test matrix);
 * - any bind error other than EADDRINUSE → `lock_unavailable` naming the errno — never a
 *   takeover, never a retry-through-destruction.
 * - EADDRINUSE under a bounded retry budget → `lock_contended`. The caller decides what
 *   contention means (engine: hold, never takeover).
 *
 * Custody caveat (design L131, T-AUT-B): a released lock or an expired wait proves only
 * that THIS host no longer holds the name. It cannot prove an external worker ceased —
 * cessation is established by the record's acknowledged cessation, never by lock state.
 *
 * Fork caveat: a holder MUST NOT fork a daemon while holding — the forked child inherits
 * the listening fd and keeps the abstract name bound after the parent exits. The engine
 * never forks while holding this lock.
 */
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { sha256Hex } from './record.mjs';

export const LOCK_RETRY_DEFAULT_BUDGET_MS = 2000;
export const LOCK_RETRY_DEFAULT_DELAY_MS = 50;

/**
 * The abstract lock name for a record: derived from the CANONICALLY RESOLVED record path,
 * not the caller's spelling, so two path aliases of one record contend on ONE lock
 * instead of acquiring two independent locks over the same file.
 */
export function lockNameForRecord(recordPath) {
  return `\0aif-autonomy-${sha256Hex(resolve(recordPath))}`;
}

/**
 * Deterministic platform gate — the fail-closed arm the tests exercise without spawning
 * anything. Linux only: `socket(AF_UNIX)` + an abstract (NUL-prefixed) sun_path.
 */
export function platformSupportsAbstractBindLock(platform = process.platform) {
  if (platform === 'linux') {
    return { ok: true };
  }
  return {
    ok: false,
    code: 'unsupported_pending_prerequisite',
    reason: `abstract-namespace bind lock requires Linux; this platform is ${platform} — holding rather than approximating the OS-held semantics with a filesystem lock`,
  };
}

function sleep(ms) {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });
}

/**
 * Acquire the abstract bind lock for a record path.
 *
 * Returns {ok: true, release, lockName} where `release()` is idempotent, or
 * {ok: false, code, reason} with code in:
 *   - `unsupported_pending_prerequisite` (non-Linux platform),
 *   - `lock_target_unresolvable` (path resolution failed),
 *   - `lock_contended` (EADDRINUSE persisted past the retry budget),
 *   - `lock_unavailable` (any other bind error; errno named in reason).
 *
 * `_bindAttempt` is a TEST-ONLY strategy seam (matrix row 18): inject a failing bind
 * strategy to prove the non-EADDRINUSE path surfaces verbatim and fail-closed — no CLI
 * flag reaches it and production callers never pass it.
 */
export async function acquireBindLock({
  recordPath,
  retryBudgetMs = LOCK_RETRY_DEFAULT_BUDGET_MS,
  retryDelayMs = LOCK_RETRY_DEFAULT_DELAY_MS,
  platform = process.platform,
  _bindAttempt = bindAttempt,
}) {
  const supported = platformSupportsAbstractBindLock(platform);
  if (!supported.ok) return supported;
  if (typeof recordPath !== 'string' || recordPath.length === 0) {
    return { ok: false, code: 'lock_target_unresolvable', reason: 'recordPath must be a non-empty string' };
  }
  const lockName = lockNameForRecord(recordPath);
  const deadline = Date.now() + retryBudgetMs;
  for (;;) {
    const attempt = await _bindAttempt(lockName);
    if (attempt.ok) {
      let released = false;
      return {
        ok: true,
        lockName,
        heldByPid: process.pid,
        release() {
          if (released) return; // idempotent — finally-block callers may race nothing, but be safe
          released = true;
          attempt.server.close();
        },
      };
    }
    if (attempt.code === 'lock_contended') {
      if (Date.now() >= deadline) {
        return {
          ok: false,
          code: 'lock_contended',
          reason: `another live process holds the binding lock for this record (waited ${retryBudgetMs}ms) — contention is a HOLD, never a takeover`,
        };
      }
      await sleep(retryDelayMs);
      continue;
    }
    return attempt; // unsupported / unavailable — surfaced verbatim, fail closed
  }
}

/** One bind attempt on the abstract name. EADDRINUSE ⟺ a live holder; everything else is fail-closed. */
function bindAttempt(lockName) {
  return new Promise((settle) => {
    // No connection listener: the socket exists to be BOUND, not to serve. Peer connections
    // queue in the accept backlog and are never accepted; holders release by closing.
    const server = createServer();
    server.once('error', (err) => {
      server.close();
      if (err && err.code === 'EADDRINUSE') {
        settle({ ok: false, code: 'lock_contended', reason: 'abstract lock name is already bound by a live holder' });
        return;
      }
      settle({
        ok: false,
        code: 'lock_unavailable',
        reason: `bind on the abstract lock name failed (${err && err.code ? err.code : 'unknown'}: ${err && err.message ? err.message : err}) — failing closed, no unlink, no takeover`,
      });
    });
    server.listen({ path: lockName }, () => {
      settle({ ok: true, server });
    });
  });
}

/**
 * Run `fn` while holding the record's bind lock. Release happens in a finally block, so a
 * throw inside `fn` cannot leak the lock. Resolves to fn's result; rejections propagate
 * after release.
 */
export async function withBindLock(options, fn) {
  const lock = await acquireBindLock(options);
  if (!lock.ok) return lock;
  try {
    const result = await fn(lock);
    return result;
  } finally {
    lock.release();
  }
}
