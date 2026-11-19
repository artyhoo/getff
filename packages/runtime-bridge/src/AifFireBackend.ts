/**
 * AifFireBackend — honest dispatch-only adapter for CC Routines `/fire` API.
 *
 * DISPATCH = POST /fire (bearer token + anthropic-beta header).
 * This backend is **operator opt-in** — it is NEVER the default; REST
 * (AifHandoffBackend) remains the agnostic default backend.
 *
 * Design contract (Type-decision (b), kickoff §4c, Phase -1 cold-review 2026-06-10):
 *   - The CC Routines `/fire` token is write-only by design (no read access).
 *   - POST "/fire" fires the routine and returns ONLY session_id + session_url.
 *   - Completion is therefore UNOBSERVABLE from the API layer.
 *   - awaitDone() resolves IMMEDIATELY (no poll, no hang) with:
 *       { success:false, finalStatus:'dispatched_no_readback', meta:{ sessionUrl, sessionId } }
 *   - getStatus() returns { status:'running', rawStatus:'dispatched_no_readback' } honestly.
 *   - available() is a presence-gate only (routineId + token present) — NO network call.
 *
 * Shared types (TaskStatus.status / RuntimeBackend.name / TaskHandle.backend) are NOT
 * extended — Type-decision (b) encodes honesty in rawStatus/finalStatus fields that
 * already exist in the shared shapes. AifFireBackend does NOT declare `implements
 * RuntimeBackend` so the RuntimeBackend.name union is not widened.
 *
 * Env fallbacks (mirrors RUNTIME_BRIDGE_AIF_* naming):
 *   RUNTIME_BRIDGE_FIRE_ROUTINE_ID       — CC Routines routine ID (required for available()).
 *   RUNTIME_BRIDGE_FIRE_TOKEN            — Bearer token (write-only, sk-ant-oat01-…).
 *   RUNTIME_BRIDGE_FIRE_BASE_URL         — API base URL (default: https://api.anthropic.com/v1/claude_code/routines).
 *   RUNTIME_BRIDGE_FIRE_BETA             — anthropic-beta header value.
 *   RUNTIME_BRIDGE_FIRE_ANTHROPIC_VERSION — anthropic-version header value.
 *
 * Cost policy (DN-2): operator-manual /fire = OK (subscription-bundled).
 * Committed-CI /fire = DEFER-permanent (no-paid-llm-in-ci.md §3 / #paid-llm-creep).
 *
 * @dual-pair: dispatch-backend-aif
 * @cc-only-rationale: CC-cloud opt-in for laptop-closed / cloud dispatch; REST (AifHandoffBackend) is the portable, agnostic default channel.
 */
import { BackendError } from './backend.js';
import { enforceKickoffAdmission, enforceScope } from './resultReview.js';
import type { KickoffSpec, TaskStatus, TaskResult } from './types.js';

// ── Local types (shared types.ts / backend.ts are NOT edited — Type-decision (b)) ──

/** Configuration for AifFireBackend. */
export interface AifFireConfig {
  /**
   * CC Routines routine ID. Required for available() and dispatch().
   * Source: RUNTIME_BRIDGE_FIRE_ROUTINE_ID env var.
   */
  readonly routineId?: string;
  /**
   * Bearer token for the /fire endpoint (write-only, sk-ant-oat01-…).
   * Generated at claude.ai/code/routines — shown once at creation.
   * Source: RUNTIME_BRIDGE_FIRE_TOKEN env var.
   */
  readonly token?: string;
  /**
   * API base URL for CC Routines.
   * Source: RUNTIME_BRIDGE_FIRE_BASE_URL env var.
   * Default: https://api.anthropic.com/v1/claude_code/routines
   */
  readonly baseUrl?: string;
  /**
   * anthropic-beta header value for the /fire API.
   * Source: RUNTIME_BRIDGE_FIRE_BETA env var.
   * Default: experimental-cc-routine-2026-04-01
   */
  readonly betaHeader?: string;
  /**
   * anthropic-version header value.
   * Source: RUNTIME_BRIDGE_FIRE_ANTHROPIC_VERSION env var.
   * Default: 2023-06-01
   */
  readonly anthropicVersion?: string;
}

/**
 * Opaque handle returned by a successful /fire dispatch.
 * Local type — does NOT extend the shared TaskHandle union (Type-decision b).
 * The shared TaskHandle.backend union ('aif-handoff'|'amux'|'manual') is NOT widened.
 */
export interface AifFireHandle {
  /** Discriminant for callers who need to identify the backend. */
  readonly backend: 'aif-fire';
  /** CC Routines session ID returned by the /fire POST response. */
  readonly taskId: string;
  /** ISO timestamp of dispatch. */
  readonly dispatchedAt: string;
  /**
   * URL to monitor the running session in a browser.
   * The operator opens this after dispatch (laptop-closed / cloud workflow).
   * Carried in awaitDone() result.meta.sessionUrl.
   */
  readonly sessionUrl: string;
}

// ── Backend class ─────────────────────────────────────────────────────────────

/**
 * Honest dispatch-only backend for CC Routines `/fire` API.
 *
 * Does NOT declare `implements RuntimeBackend` — the RuntimeBackend.name
 * union ('aif-handoff'|'amux'|'manual') must not gain 'aif-fire'.
 * Structurally backend-shaped so it can be used polymorphically by callers
 * who import it directly (via the opt-in index.ts export).
 */
export class AifFireBackend {
  /** Human-readable name for logging; not part of the RuntimeBackend.name union. */
  readonly name = 'aif-fire' as const;

  private readonly routineId: string | undefined;
  private readonly token: string | undefined;
  private readonly baseUrl: string;
  private readonly betaHeader: string;
  private readonly anthropicVersion: string;

  constructor(config: AifFireConfig = {}) {
    this.routineId =
      config.routineId ?? process.env['RUNTIME_BRIDGE_FIRE_ROUTINE_ID'];
    this.token = config.token ?? process.env['RUNTIME_BRIDGE_FIRE_TOKEN'];
    this.baseUrl =
      config.baseUrl ??
      process.env['RUNTIME_BRIDGE_FIRE_BASE_URL'] ??
      'https://api.anthropic.com/v1/claude_code/routines';
    this.betaHeader =
      config.betaHeader ??
      process.env['RUNTIME_BRIDGE_FIRE_BETA'] ??
      'experimental-cc-routine-2026-04-01';
    this.anthropicVersion =
      config.anthropicVersion ??
      process.env['RUNTIME_BRIDGE_FIRE_ANTHROPIC_VERSION'] ??
      '2023-06-01';
  }

  /**
   * Presence-gate: true iff both routineId and token are configured.
   * NO network call — cheap, ≤1s, no side effects (T-Fire-A: never probe cloud here).
   */
  async available(): Promise<boolean> {
    return Promise.resolve(Boolean(this.routineId && this.token));
  }

  /**
   * Dispatch a kickoff to the CC Routine via POST /fire.
   * Returns an AifFireHandle with the session_url for browser monitoring.
   * On failure throws a BackendError (unavailable | quota_exceeded | dispatch_failed).
   */
  async dispatch(kickoff: KickoffSpec): Promise<AifFireHandle> {
    enforceKickoffAdmission(kickoff, 'aif-fire');
    // Effect-boundary scope check BEFORE the POST /fire (intent-first-result §4): the
    // fire transport has no claim/release split to re-check at, so this one boundary
    // must carry the whole guard — a refused scope never reaches the routine.
    enforceScope(kickoff.content, 'aif-fire');
    if (!this.routineId || !this.token) {
      throw new BackendError(
        'AifFireBackend requires both routineId and token — set RUNTIME_BRIDGE_FIRE_ROUTINE_ID and RUNTIME_BRIDGE_FIRE_TOKEN env vars',
        'dispatch_failed',
        'aif-fire',
      );
    }

    const url = `${this.baseUrl}/${this.routineId}/fire`;
    let res: Response;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.token}`,
            'anthropic-beta': this.betaHeader,
            'anthropic-version': this.anthropicVersion,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: kickoff.content }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      const msg = err instanceof Error ? err.message : String(err);
      if (
        name === 'AbortError' ||
        msg.includes('abort') ||
        msg.includes('timeout')
      ) {
        throw new BackendError(
          `AifFireBackend POST ${url} timed out`,
          'unavailable',
          'aif-fire',
        );
      }
      process.stderr.write(
        `[runtime-bridge/fire] dispatch failed (network): ${msg}\n`,
      );
      throw new BackendError(
        `AifFireBackend POST ${url} unreachable: ${msg}`,
        'unavailable',
        'aif-fire',
      );
    }

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      if (res.status === 429) {
        throw new BackendError(
          `AifFireBackend rate limit (POST ${url}): ${errBody}`,
          'quota_exceeded',
          'aif-fire',
        );
      }
      process.stderr.write(
        `[runtime-bridge/fire] dispatch failed HTTP ${res.status}: ${errBody}\n`,
      );
      throw new BackendError(
        `AifFireBackend POST ${url} HTTP ${res.status}: ${errBody}`,
        'dispatch_failed',
        'aif-fire',
      );
    }

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new BackendError(
        `AifFireBackend POST ${url} returned non-JSON response`,
        'dispatch_failed',
        'aif-fire',
      );
    }

    const b = body as Record<string, unknown>;
    const sessionId =
      typeof b['claude_code_session_id'] === 'string'
        ? b['claude_code_session_id']
        : undefined;
    const sessionUrl =
      typeof b['claude_code_session_url'] === 'string'
        ? b['claude_code_session_url']
        : undefined;

    if (!sessionId || !sessionUrl) {
      throw new BackendError(
        `AifFireBackend POST ${url} response missing session fields: ${JSON.stringify(body)}`,
        'dispatch_failed',
        'aif-fire',
      );
    }

    process.stderr.write(
      `[runtime-bridge/fire] dispatched session=${sessionId} url=${sessionUrl}\n`,
    );

    return {
      backend: 'aif-fire',
      taskId: sessionId,
      dispatchedAt: new Date().toISOString(),
      sessionUrl,
    };
  }

  /**
   * Honest status snapshot.
   * Type-decision (b): coarse status='running' (the truthful carrier given the union constraint);
   * actual contract encoded in rawStatus='dispatched_no_readback'.
   * Token is write-only — real completion status is unobservable from the API layer.
   * NO network call (T-Fire-A).
   */
  async getStatus(handle: AifFireHandle): Promise<TaskStatus> {
    // rawStatus='dispatched_no_readback' carries the honest message.
    // status='running' is the coarse-enum carrier — it is not a lie because the
    // routine IS running; we simply cannot observe its completion via this token.
    return Promise.resolve({
      status: 'running' as const,
      rawStatus: 'dispatched_no_readback',
      checkedAt: new Date().toISOString(),
    });
  }

  /**
   * Honest-fast terminal result.
   * Returns IMMEDIATELY with success:false — the token has no read access, so
   * awaiting completion is architecturally impossible via the /fire API.
   * The session_url in meta.sessionUrl lets the operator monitor in a browser.
   * NO network call, NO poll, NO hang (T-Fire-A; does-not-hang test is mandatory).
   *
   * @param handle AifFireHandle from dispatch().
   * @param _timeoutMs Accepted for structural parity but unused (immediate return).
   */
  async awaitDone(
    handle: AifFireHandle,
    _timeoutMs?: number,
  ): Promise<TaskResult> {
    // Honest-fast: return immediately. No setTimeout, no poll, no fetch.
    // The /fire token has no read access — completion is unobservable.
    // Operator monitors progress via handle.sessionUrl in a browser.
    return Promise.resolve({
      success: false,
      content: '',
      finalStatus: 'dispatched_no_readback',
      completedAt: new Date().toISOString(),
      meta: {
        sessionUrl: handle.sessionUrl,
        sessionId: handle.taskId,
      },
    });
  }
}
