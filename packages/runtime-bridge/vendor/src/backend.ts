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
 * Error thrown by backend methods on dispatch failure, quota exceeded,
 * or connection refusal.
 */
export class BackendError extends Error {
  constructor(
    message: string,
    public readonly code: 'unavailable' | 'quota_exceeded' | 'dispatch_failed' | 'timeout',
    public readonly backend: string,
  ) {
    super(message);
    this.name = 'BackendError';
  }
}
