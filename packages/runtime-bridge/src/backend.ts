/**
 * RuntimeBackend interface — the common contract for all runtime bridge backends.
 *
 * Implementations: AifHandoffBackend, ManualBackend, AmuxBackend (Phase 2).
 *
 * Design invariant (DECISION=C): substrate stays dependency-free.
 * AifHandoffBackend and ManualBackend live in this package (opt-in for consumers).
 * The main packages/core substrate imports NOTHING from this package.
 *
 * @dual-pair: runtime-bridge-types
 */
import type { KickoffSpec, TaskHandle, TaskStatus, TaskResult } from './types.js';

export interface RuntimeBackend {
  /** Human-readable name for logging / env-var selection. */
  readonly name: 'aif-handoff' | 'amux' | 'manual';

  /**
   * Probe whether this backend is currently reachable / usable.
   * MUST be cheap (≤1s timeout, no side effects).
   */
  available(): Promise<boolean>;

  /**
   * Dispatch a kickoff to the backend.
   * Returns a TaskHandle that can be used with getStatus / awaitDone.
   * On failure throws a BackendError.
   */
  dispatch(kickoff: KickoffSpec): Promise<TaskHandle>;

  /**
   * Get the current status of a dispatched task.
   * Does NOT block — returns a point-in-time snapshot.
   */
  getStatus(handle: TaskHandle): Promise<TaskStatus>;

  /**
   * Block until the task reaches a terminal state (done or error).
   * MVP: polling every 30s.
   * @param timeoutMs Optional timeout in ms. If omitted, polls indefinitely
   *   (documented MVP limitation — see kickoff §3 mn2).
   */
  awaitDone(handle: TaskHandle, timeoutMs?: number): Promise<TaskResult>;
}

/**
 * Two-phase dispatch — the CLAIM half of the lane-race guard (spec §5.3, D-H5/P-5).
 *
 * `dispatch()` is create+unpause in one atomic call, which means a lane is only
 * observable AFTER the work has already started. Every historical double-dispatch
 * materialised inside the Phase -1 cold-review window (CLAUDE.md «Pre-dispatch
 * in-flight probe»), i.e. BEFORE that call. Splitting the call moves the observable
 * marker to the front of that window:
 *
 *   claim()       -> a paused task exists, visible to `probe-inflight.sh`, occupying
 *                    no lane and consuming no runtime.
 *   release()     -> Phase -1 GO: unpause, the coordinator picks the task up.
 *   cancelClaim() -> Phase -1 RED: DELETE the task, the lane is free again.
 *
 * Optional on purpose: `ManualBackend` has no queue to claim in, so the capability
 * is probed with {@link supportsClaims} rather than forced onto every backend.
 */
export interface ClaimCapableBackend extends RuntimeBackend {
  /**
   * Create the task in its paused (claim-only) state and return its handle.
   * The task is NOT running: it sits at `backlog` with `paused:true` until
   * {@link ClaimCapableBackend.release} is called.
   */
  claim(kickoff: KickoffSpec): Promise<TaskHandle>;

  /**
   * Clear `paused` so the coordinator picks the claimed task up.
   * Throws a BackendError on failure and leaves the claim in place — the caller
   * owns the rollback decision (`dispatch()` cancels, an operator may retry).
   */
  release(handle: TaskHandle): Promise<TaskHandle>;

  /**
   * Delete a claim that will never be released (Phase -1 RED, or an abandoned
   * session). Best-effort: a delete failure resolves rather than throws, because
   * the caller's next action must not depend on the queue's cooperation.
   *
   * Resolves `true` when the claim is gone and `false` when the delete failed —
   * best-effort must not mean UNREPORTED. `dispatch()`'s rollback ignores the
   * result (it is already throwing), but an operator cancelling a claim has to
   * know whether the lane is actually free, or the next probe will block on a
   * claim they were told was cancelled.
   */
  cancelClaim(handle: TaskHandle): Promise<boolean>;
}

/**
 * Type guard: does this backend implement the two-phase claim protocol?
 * A backend without a queue (ManualBackend) legitimately does not.
 */
export function supportsClaims(backend: RuntimeBackend): backend is ClaimCapableBackend {
  const candidate = backend as Partial<ClaimCapableBackend>;
  return (
    typeof candidate.claim === 'function' &&
    typeof candidate.release === 'function' &&
    typeof candidate.cancelClaim === 'function'
  );
}

/**
 * Error thrown by backend methods on dispatch failure, quota exceeded,
 * or connection refusal.
 */
/**
 * Why a dispatch failed — and, crucially, whether ANOTHER backend could have
 * succeeded. `cli/dispatch.ts` splits on exactly this (`isFallbackEligible`):
 *
 * - `unavailable` / `quota_exceeded` / `timeout` / `dispatch_failed` are
 *   ENVIRONMENTAL: the runtime is down, metered out, slow, or refused this
 *   particular call. The kickoff is fine, so degrading to ManualBackend hands
 *   the operator a paste-able copy and the work proceeds.
 * - `spec_invalid` is an authoring defect in the KICKOFF ITSELF (today: a
 *   `bridge-profile` marker naming a runtime profile that does not exist, or
 *   several ambiguously). No backend can satisfy it, and degrading routes the
 *   work to a seat the marker explicitly did not ask for — while reporting
 *   success. It must abort loudly instead. (Incident 2026-09-02, BS0.)
 */
export type BackendErrorCode =
  | 'unavailable'
  | 'quota_exceeded'
  | 'dispatch_failed'
  | 'timeout'
  | 'spec_invalid';

export class BackendError extends Error {
  constructor(
    message: string,
    public readonly code: BackendErrorCode,
    public readonly backend: string,
  ) {
    super(message);
    this.name = 'BackendError';
  }
}
