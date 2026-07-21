/**
 * Core type definitions for the runtime-bridge adapter.
 *
 * Shared between all RuntimeBackend implementations (AifHandoffBackend,
 * ManualBackend, AmuxBackend in Phase 2). Keep shapes MVP — extend in
 * subsequent sub-waves as needed.
 *
 * @dual-pair: runtime-bridge-types
 */

/**
 * Represents a dispatched kickoff document. Derived from the
 * `.claude/orchestrator-prompts/<umbrella>/kickoff.md` file content.
 */
export interface KickoffSpec {
  /** File path of the kickoff document (absolute). */
  readonly filePath: string;
  /** Raw markdown content of the kickoff. */
  readonly content: string;
  /** Umbrella/task name, derived from kickoff directory name. */
  readonly umbrellaName: string;
  /** SHA-256 hex of the content, for idempotency. */
  readonly contentHash: string;
  /**
   * Optional runtime-profile name hint, parsed from a `<!-- bridge-profile: <name> -->`
   * marker in the kickoff's HEADER REGION ONLY (everything before the first `##`
   * heading) — never the file body, to avoid false-positiving on kickoffs that merely
   * document the marker in prose. `undefined` when no marker is present. A backend
   * resolves this name (substring match) against its own runtime-profile registry;
   * this field carries only the raw hint, never a resolved id.
   */
  readonly profileHint?: string;
}

/**
 * Opaque handle returned by a successful dispatch.
 * Each backend encodes its own task identity here.
 */
export interface TaskHandle {
  /** Backend that created this handle. */
  readonly backend: 'aif-handoff' | 'amux' | 'manual';
  /** Backend-specific task ID (UUID for aif-handoff, file path for manual). */
  readonly taskId: string;
  /** ISO timestamp of dispatch. */
  readonly dispatchedAt: string;
}

/**
 * Point-in-time snapshot of task status.
 */
export interface TaskStatus {
  /** High-level lifecycle state. */
  readonly status: 'pending' | 'running' | 'done' | 'error';
  /**
   * Backend-specific status string (e.g. aif-handoff's
   * 'backlog'/'planning'/'plan_ready'/'implementing'/'review'/'done'/'verified').
   */
  readonly rawStatus?: string;
  /** ISO timestamp of last status check. */
  readonly checkedAt: string;
}

/**
 * Final outcome of an awaited task.
 */
export interface TaskResult {
  /** Whether the task completed successfully. */
  readonly success: boolean;
  /**
   * Completion content — for ManualBackend this is the file content of
   * the response file; for aif-handoff this is the task completion message.
   */
  readonly content: string;
  /** Final raw status from the backend. */
  readonly finalStatus: string;
  /** ISO timestamp of completion. */
  readonly completedAt: string;
  /** Optional metadata (token counts, cost, etc.). */
  readonly meta?: Record<string, unknown>;
}
