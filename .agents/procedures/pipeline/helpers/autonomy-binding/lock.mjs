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
import { canonicalRecordPath } from './store.mjs';

export const LOCK_RETRY_DEFAULT_BUDGET_MS = 2000;
export const LOCK_RETRY_DEFAULT_DELAY_MS = 50;
/** Upper bound any caller-supplied retry budget or delay may take (A1-CODE-06). */
export const LOCK_RETRY_MAX_MS = 60000;

/**
 * The abstract lock name for a record: derived from the CANONICALLY RESOLVED record path
 * (store.mjs canonicalRecordPath — realpath of the longest existing ancestor + leaf
 * symlink chain), not the caller's spelling, so two path aliases of one record contend on
 * ONE lock instead of acquiring two independent locks over the same file (A1-CODE-01).
 * An unresolvable path falls back to the lexical spelling only as a DISTINCT name —
 * `acquireBindLock` rejects unresolvable paths outright, so this arm is reachable only
 * from direct unit callers.
 */
export function lockNameForRecord(recordPath) {
  const canonical = canonicalRecordPath(recordPath);
  return `\0aif-autonomy-${sha256Hex(canonical === null ? resolve(recordPath) : canonical)}`;
}

/**
 * Retry-timing validation (A1-CODE-06): budgets and delays must be finite, non-negative,
 * bounded integers. An unchecked NaN/Infinity budget makes the deadline never expire —
 * a contended one-shot invocation would wait forever — and an oversized delay lets a
 * single sleep outlast the advertised budget.
 */
export function validateRetryTiming({ retryBudgetMs, retryDelayMs }) {
  for (const [name, value] of [['retryBudgetMs', retryBudgetMs], ['retryDelayMs', retryDelayMs]]) {
    if (value === undefined) continue; // caller omitted → the default applies
    if (!Number.isSafeInteger(value) || value < 0 || value > LOCK_RETRY_MAX_MS) {
      return {
        ok: false,
        code: 'invalid_request',
        reason: `${name} must be a finite non-negative integer of at most ${LOCK_RETRY_MAX_MS}ms (got ${String(value)}) — a malformed timing would make lock contention unbounded or outlast the budget`,
      };
    }
  }
  return { ok: true };
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
 *   - `invalid_request` (retry budget/delay malformed — A1-CODE-06),
 *   - `lock_target_unresolvable` (path missing or resolution failed),
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
  const timing = validateRetryTiming({ retryBudgetMs, retryDelayMs });
  if (!timing.ok) return timing;
  // Canonicalize BEFORE the deadline: every alias of the record must contend on ONE name,
  // and an over-deep leaf chain must reject instead of locking a fallback spelling.
  const canonical = canonicalRecordPath(recordPath);
  if (canonical === null) {
    return { ok: false, code: 'lock_target_unresolvable', reason: 'the record path resolves through a symlink chain deeper than the bound' };
  }
  const lockName = lockNameForRecord(canonical);
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
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        return {
          ok: false,
          code: 'lock_contended',
          reason: `another live process holds the binding lock for this record (waited ${retryBudgetMs}ms) — contention is a HOLD, never a takeover`,
        };
      }
      // Each sleep is capped by the remaining budget (A1-CODE-06): a caller-supplied
      // delay can never make one wait outlast the advertised budget.
      await sleep(Math.min(retryDelayMs, remaining));
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
