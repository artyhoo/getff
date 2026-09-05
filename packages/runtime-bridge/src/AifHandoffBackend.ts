/**
 * AifHandoffBackend — adapter for the lee-to/aif-handoff runtime.
 *
 * DISPATCH = REST (:3009). Verdict from research-patch
 * docs/meta-factory/research-patches/2026-05-31-runtime-bridge-mcp-dispatch-fix.md
 * (REST-now + MCP-target). The aif-handoff MCP server (:3100) is the
 * design-sanctioned surface, but as shipped it wires a single shared
 * StreamableHTTPServerTransport (one session, no teardown endpoint) — too
 * fragile for a durable bridge until an upstream per-session-transport fix
 * lands. REST is stateless and was live-verified, so dispatch uses it now.
 *
 * dispatch() — 2-step planner-RUN over REST (live-verified 2026-06-03):
 *   1. POST /tasks  { projectId, title, description:<kickoff content>, plannerMode:'fast',
 *                     paused:true, autoMode:true }                       -> 201 + task id
 *   2. PUT  /tasks/:id { paused: false }                                 -> coordinator picks up
 *   The task stays at `backlog`; the auto-queue advances it `backlog -> planning -> runPlanner`,
 *   and `runPlanner` (planner.ts:191-213) is the ONLY code that creates a per-task git worktree.
 *   This is what lets N dispatched kickoffs run in PARALLEL, each in its own worktree.
 *
 *   Why NOT `accept_existing_plan` (the old step, removed 2026-06-03): it transitions
 *   `backlog -> plan_ready` SKIPPING `planning`, so `runPlanner` never runs and NO worktree
 *   is created -> all tasks forced serial. Root cause + live proof:
 *   research-patches/2026-06-02-aif-worktree-gap.md (#372).
 *
 *   The kickoff goes in `description` (the planner's INPUT spec, planner.ts:246), NOT in `plan`
 *   (the planner's OUTPUT slot @planPath, which it overwrites). The planner plans the *how*
 *   (implementation checklist) FROM our kickoff *what*.
 *   Live-verified notes:
 *     - status is EVENT-only — `PUT { status }` is silently ignored (no direct write).
 *     - step 2 (unpause) is wrapped; a failure best-effort DELETEs the half-created task
 *       (rollback, no orphan), and the CLI (dispatch.ts) falls back to ManualBackend.
 *
 * claim() / release() / cancelClaim() — the same two steps, separable (spec §5.3,
 *   D-H5/P-5). Step 1 alone is a CLAIM: a paused task that exists, is visible to
 *   `probe-inflight.sh`, and occupies no lane. `/pipeline` §6 Step 3 claims BEFORE the
 *   Phase -1 cold-review window, releases on GO, and cancels on RED — which is what moves
 *   the observable marker in front of the window where every historical double-dispatch
 *   materialised. `dispatch()` is now literally claim+release with the old rollback, so
 *   the one-shot callers (PostToolUse hook, /dispatcher) are behaviourally unchanged.
 * available(): GET /health reachability probe (1s timeout).
 * getStatus(): REST GET /tasks/:id (non-blocking snapshot via aifWsStatus.getTaskStatus).
 * awaitDone(): WebSocket status event stream (aifWsStatus.awaitTaskDone, :3009/ws).
 *
 * Ports: REST + WS = baseUrl (:3009). MCP (HTTP) = mcpUrl (:3100), RESERVED for the
 * MCP-target phase (ADOPT @modelcontextprotocol/sdk) — NOT used by REST dispatch today.
 *
 * @dual-pair: runtime-bridge-aif-handoff
 */
import type { ClaimCapableBackend } from './backend.js';
import { BackendError } from './backend.js';
import { ensureParallelEnabled } from './cli/ensure-parallel.js';
import type { KickoffSpec, TaskHandle, TaskStatus, TaskResult } from './types.js';
import {
  awaitTaskDone,
  getTaskStatus,
  mapAifStatusToTaskStatus,
  type WebSocketConstructor,
} from './aifWsStatus.js';

/**
 * Raw aif-handoff statuses that mean no worker can still be running for the task
 * (packages/shared/src/types.ts TASK_STATUSES). `blocked_external` is terminal in
 * the same sense the bridge already uses it — aifWsStatus.ts treats it as an
 * error-class terminal that resolves rather than keeps waiting.
 */
const TERMINAL_RAW_STATUSES = new Set(['done', 'verified', 'blocked_external']);

/**
 * What happened to a cancel request — the reported form of
 * {@link AifHandoffBackend.cancelClaim}'s boolean. `running` is the A5-1 refusal:
 * the task is live and the backend has no way to stop its worker, so the record
 * is deliberately left alone.
 */
export type CancelOutcome =
  | { cancelled: true; reason: 'deleted' | 'already-gone' }
  | { cancelled: false; reason: 'running' | 'delete-failed' | 'unverifiable'; detail: string };

/** Configuration for AifHandoffBackend. */
export interface AifHandoffConfig {
  /**
   * Base URL of the aif-handoff API server (REST + WebSocket).
   * Source: packages/shared/src/env.ts -- PORT default 3009, API_BASE_URL="http://localhost:3009"
   * Default: http://localhost:3009
   */
  readonly baseUrl?: string;
  /**
   * MCP (HTTP-mode) base URL — RESERVED for the MCP-target phase
   * (ADOPT @modelcontextprotocol/sdk). NOT used by REST dispatch today; stored
   * so the MCP-target phase is a config-only migration, not a re-plumb.
   * Source: aif-handoff packages/mcp/src/env.ts — MCP_PORT default 3100.
   * Default: http://localhost:3100
   */
  readonly mcpUrl?: string;
  /**
   * aif-handoff project ID (UUID). Required for task creation.
   * Consumers must configure this to match their aif-handoff project.
   */
  readonly projectId?: string;
  /**
   * WebSocket URL for the aif-handoff status event stream.
   * Source: packages/api/src/ws.ts -- app.get("/ws", upgradeWebSocket(...))
   * Same server as baseUrl (port 3009 by default).
   * Default: derived from baseUrl (http->ws, append /ws)
   */
  readonly wsUrl?: string;
  /**
   * Optional file path to append task status updates to (append-only, no schema rewrite).
   * When set, each status event is appended as a line: [ISO] taskId=<id> status=<status>
   * When unset, status processing is a clean no-op.
   */
  readonly stateFilePath?: string;
  /**
   * Dependency injection: custom WebSocket constructor (for testing).
   * Default: WebSocket from node:http (undici-based, available since Node 22.5+).
   */
  readonly WebSocketImpl?: WebSocketConstructor;
}

export class AifHandoffBackend implements ClaimCapableBackend {
  readonly name = 'aif-handoff' as const;

  private readonly baseUrl: string;
  /** RESERVED for the MCP-target phase; not used by REST dispatch. */
  readonly mcpUrl: string;
  private readonly projectId: string | undefined;
  private readonly wsUrl: string;
  private readonly stateFilePath: string | undefined;
  private readonly WebSocketImpl: WebSocketConstructor | undefined;

  constructor(config: AifHandoffConfig = {}) {
    this.baseUrl = config.baseUrl ?? 'http://localhost:3009';
    this.mcpUrl = config.mcpUrl ?? 'http://localhost:3100';
    this.projectId = config.projectId;
    this.wsUrl = config.wsUrl ?? AifHandoffBackend._deriveWsUrl(this.baseUrl);
    this.stateFilePath = config.stateFilePath;
    this.WebSocketImpl = config.WebSocketImpl;
  }

  /** Derive ws:// URL from http:// baseUrl (same host:port, append /ws). */
  private static _deriveWsUrl(httpUrl: string): string {
    return httpUrl.replace(/^http(s?):\/\//, (_match: string, s: string) => `ws${s}://`) + '/ws';
  }

  /**
   * Resolve a profile-name hint (from a kickoff's `<!-- bridge-profile: -->`
   * marker) to a concrete runtime-profile id via GET /runtime-profiles.
   * An exact (case-insensitive) name match wins outright; otherwise falls back
   * to case-insensitive substring match. Throws loudly on 0 or >1 matches — no
   * silent fallback, no guessing (the candidate list is included so the
   * operator can fix the marker).
   *
   * Both throws carry `spec_invalid`, NOT `dispatch_failed`: the kickoff named a
   * profile the runtime does not have, which no backend can satisfy, so
   * `cli/dispatch.ts` must abort rather than degrade to ManualBackend. Until
   * 2026-09-02 these were `dispatch_failed` and the blanket fallback turned an
   * unresolvable marker into a /tmp file plus exit 0.
   *
   * The exact-match short-circuit is load-bearing because prefix-related profile
   * names are real: `Z.AI GLM-5.2` is a strict prefix of `Z.AI GLM-5.2 SDK`, so
   * under pure substring matching a marker naming the former matched BOTH and
   * threw `dispatch_failed` — i.e. the correct, unambiguous name was unusable.
   *
   * A5-2 (#1597 ledger): the candidate set is scoped to THIS project and to
   * ENABLED profiles. The list endpoint applies no project filter when
   * `projectId` is absent and defaults `enabledOnly=false`
   * (aif-handoff packages/api/src/routes/runtimeProfiles.ts:525-555), so the
   * unscoped GET ranged over every project's profiles plus disabled ones: a name
   * unique within this project collided with a same-named profile in another and
   * hard-aborted `spec_invalid` on a correct kickoff, or — worse — a DISABLED
   * profile's id was written onto the task and the coordinator never ran it.
   * `scope` stays at its `visible` default so GLOBAL profiles remain candidates;
   * they are usable by this project by construction.
   */
  private async _resolveProfileId(hint: string, projectId: string): Promise<string> {
    const query = new URLSearchParams({ projectId, enabledOnly: 'true' });
    const profiles = (await this._rest('GET', `/runtime-profiles?${query.toString()}`)) as Array<{
      id: string;
      name: string;
    }>;
    const needle = hint.toLowerCase();
    // Exact name match wins: a profile whose name IS the hint is never ambiguous,
    // even when that name is also a prefix of other profile names.
    const exact = profiles.filter((p) => p.name.toLowerCase() === needle);
    const matches =
      exact.length > 0 ? exact : profiles.filter((p) => p.name.toLowerCase().includes(needle));

    if (matches.length === 0) {
      const candidates = profiles.map((p) => p.name).join(', ');
      throw new BackendError(
        `bridge-profile hint "${hint}" matched no runtime profile. Available: ${candidates || '(none)'}`,
        'spec_invalid',
        'aif-handoff',
      );
    }
    if (matches.length > 1) {
      const candidates = matches.map((p) => `${p.name} (${p.id})`).join(', ');
      throw new BackendError(
        `bridge-profile hint "${hint}" matched ${matches.length} runtime profiles ambiguously: ${candidates}`,
        'spec_invalid',
        'aif-handoff',
      );
    }
    return matches[0].id;
  }

  async available(): Promise<boolean> {
    // Cheap reachability probe: GET /health (or root) with 1s timeout.
    // Returns true on any 2xx or 4xx (server is up but auth needed is still
    // "available"). Returns false on connection refused, ECONNREFUSED, timeout.
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);
      try {
        const res = await fetch(`${this.baseUrl}/health`, {
          method: 'GET',
          signal: controller.signal,
        });
        return res.status < 500;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch {
      return false;
    }
  }

  /**
   * Two-phase dispatch, phase 1 — create the task PAUSED and stop there.
   *
   * This is steps 0, 0.5 and 1 of the old atomic `dispatch()`, unchanged: the
   * parallel-isolation self-heal, the `bridge-profile` resolution, and the
   * `POST /tasks { paused:true }` create. What it deliberately does NOT do is
   * unpause — so the returned handle names a task that exists, is visible to
   * `probe-inflight.sh`, and consumes no runtime (it never leaves `backlog`).
   *
   * That gap is the point: `/pipeline` §6 Step 3 opens the Phase -1 cold-review
   * window between this call and {@link AifHandoffBackend.release}, and the race
   * this whole split exists to close lives inside that window.
   */
  async claim(kickoff: KickoffSpec): Promise<TaskHandle> {
    // E-3 (#1597 ledger): `spec_invalid`, NOT `dispatch_failed`. The distinction
    // cli/dispatch.ts splits on is "can another backend satisfy this?", and no
    // backend can dispatch to a project that was never named. Classified as
    // environmental, this took the blanket ManualBackend fallback: a misspelled or
    // wrong-shell RUNTIME_BRIDGE_AIF_PROJECT_ID produced a /tmp file, exit 0 and an
    // additionalContext line reporting success, while no aif task existed and the
    // stage was re-dispatched later as a duplicate. It is operator-fixable in one
    // line, so it belongs on the abort side (isFallbackEligible).
    const projectId = this.projectId;
    if (!projectId) {
      throw new BackendError(
        'AifHandoffBackend requires projectId -- set RUNTIME_BRIDGE_AIF_PROJECT_ID env var',
        'spec_invalid',
        'aif-handoff',
      );
    }

    // -- Step 0: self-heal Finding A — ensure per-task worktree isolation is ON.
    // aif creates a per-task worktree only when project.parallelEnabled=1 (gate 2 of 3,
    // planner.ts); a freshly-provisioned instance has it 0 → tasks run in-place on the
    // shared checkout → dirty_worktree 409 on the NEXT dispatch. Best-effort: a guard
    // failure must NOT block dispatch (warn + proceed) — the dispatch itself still works,
    // only the isolation is degraded. See research-patch 2026-06-01-aif-task-isolation.md §2.
    try {
      const ensured = await ensureParallelEnabled(this.baseUrl, projectId);
      if (ensured.changed) {
        process.stderr.write(
          `[runtime-bridge] self-heal: enabled parallelEnabled on project ${projectId} (Finding A — per-task worktree isolation)\n`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(
        `[runtime-bridge] WARN: could not ensure parallelEnabled (tasks may run in-place / risk dirty_worktree): ${msg}\n`,
      );
    }

    // -- Step 0.5: resolve profileHint (if any) to a concrete runtimeProfileId --
    // multi-model-profile-marker (2026-07-21): a kickoff carrying
    // `<!-- bridge-profile: <name> -->` in its header region gets its WHOLE
    // task pipeline (plan+review+implement) routed to that profile — aif
    // already supports this via task-level runtimeProfileId, which overrides
    // every per-mode project default (data/index.ts:2746-2757). Resolution
    // failure (0 or >1 match) throws `spec_invalid`, which cli/dispatch.ts
    // refuses to degrade — no silent ManualBackend fallback.
    let runtimeProfileId: string | undefined;
    if (kickoff.profileHint) {
      runtimeProfileId = await this._resolveProfileId(kickoff.profileHint, projectId);
    }

    // -- Step 1: Create the task with the kickoff as its DESCRIPTION --------
    // description carries the kickoff content because that is the planner's
    // INPUT spec (planner.ts:246 `Description: ${task.description}`). We do NOT
    // push `plan` — that is the planner's OUTPUT slot (@planPath), which it
    // overwrites. paused:true so the coordinator does not advance until release().
    // autoMode:true so the auto-queue advances backlog -> planning (where the
    // worktree is created). Live-verified 2026-06-03: returns 201 + task object.
    //
    // `title` is the umbrella/stage slug, and that is what makes the claim
    // FINDABLE: probe-inflight.sh matches a paused, non-terminal task by slug in
    // title+description. No separate claim marker is introduced — a second
    // status vocabulary is exactly what P-5 forbids.
    const createResult = await this._rest('POST', '/tasks', {
      projectId,
      title: kickoff.umbrellaName,
      description: kickoff.content,
      plannerMode: 'fast',
      paused: true,
      autoMode: true,
      skipReview: false, // reviewer runs per reviewer-discipline.md §2
      ...(runtimeProfileId !== undefined ? { runtimeProfileId } : {}),
    });

    if (!createResult || typeof createResult !== 'object' || !('id' in createResult)) {
      throw new BackendError(
        'POST /tasks returned unexpected shape (no id)',
        'dispatch_failed',
        'aif-handoff',
      );
    }
    const taskId = (createResult as { id: string }).id;

    return {
      backend: 'aif-handoff',
      taskId,
      dispatchedAt: new Date().toISOString(),
    };
  }

  /**
   * Two-phase dispatch, phase 2 — clear `paused` so the coordinator picks the
   * claimed task up. The task stays at `backlog`; the auto-queue advances it
   * through `planning` (NOT skipped — that is the whole fix), so runPlanner runs
   * and creates the per-task worktree. NO `accept_existing_plan` event: that
   * skipped `planning` and was why no worktree was ever created (#372).
   *
   * On failure this throws and LEAVES THE CLAIM STANDING. Rollback is the
   * caller's call: `dispatch()` cancels (preserving the pre-split behaviour),
   * while a two-phase caller may legitimately retry the release instead of
   * losing its place in the queue.
   */
  async release(handle: TaskHandle): Promise<TaskHandle> {
    await this._rest('PUT', `/tasks/${handle.taskId}`, { paused: false });
    return handle;
  }

  /**
   * Delete a claim that will never be released — Phase -1 RED, or an orphan whose
   * session died. Best-effort by contract: a delete failure resolves rather than
   * throws, because the caller's next step (report RED, move on) must not hinge on
   * the queue's cooperation. An undeletable claim ages out instead — probe-inflight
   * surfaces it as STALE-CLAIM rather than blocking the stage forever.
   *
   * Returns whether the claim is actually gone, so a caller that CAN act on the
   * failure (the CLI, an operator) is told, instead of being handed a silent
   * "lane is free" for a lane that is still taken.
   *
   * See {@link AifHandoffBackend.cancelClaimChecked} for WHY this is a guarded
   * delete rather than an unconditional one; this boolean form is the
   * `ClaimCapableBackend` contract and reports only the yes/no.
   */
  async cancelClaim(handle: TaskHandle): Promise<boolean> {
    return (await this.cancelClaimChecked(handle)).cancelled;
  }

  /**
   * Cancel a claim, reporting WHY when it could not be cancelled.
   *
   * A5-1 (#1597 ledger, and the live 2026-09-02 beta-run incident): this used to
   * be an unconditional `DELETE /tasks/:id`. aif-handoff's DELETE removes the DB
   * row and broadcasts `task:deleted`, which nothing outside the web UI consumes
   * — the coordinator re-reads the row only at stage boundaries. So deleting a
   * RELEASED task removes every trace of it while its worker keeps running
   * headless: the lane stays occupied, `probe-inflight.sh` sees nothing, the
   * stage looks free and gets re-dispatched, and `tokens=0` on the vanished
   * record proves nothing. The CLI then printed «lane is free».
   *
   * aif-handoff exposes NO stop/kill surface for a running task — `TASK_EVENTS`
   * (packages/shared/src/types.ts:565-581) carries no stop/abort/cancel member and
   * `packages/api/src/routes/tasks.ts` exposes no such route (checked 2026-09-05).
   * There is therefore nothing to call, and the only honest answer is to refuse
   * and say so, per `.claude/rules/attention-is-not-a-mechanism.md §2`
   * (`#hope-as-gate`): a cancel that cannot stop the worker must not report a
   * free lane.
   *
   * Cancellable — no worker can be running:
   *   - the pre-check 404s: the task is already gone (idempotent re-cancel);
   *   - `paused === true`: it is still a claim, never picked up (the `/pipeline`
   *     §6 Step 3 RED branch this whole protocol exists for);
   *   - a terminal status (`done` / `verified` / `blocked_external`): finished.
   * Everything else refuses, INCLUDING a state we could not read: «cannot prove
   * the lane is idle» is not «safe to delete», and the recoverable branch is the
   * refusal (the operator deletes it from the board), not the silent DELETE.
   */
  async cancelClaimChecked(handle: TaskHandle): Promise<CancelOutcome> {
    let task: { status?: unknown; paused?: unknown };
    try {
      task = (await this._rest('GET', `/tasks/${handle.taskId}`)) as typeof task;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // 404 means the claim is ALREADY gone — cancelling twice, or cancelling one
      // another session cleaned up. The lane is free, which is what the caller asked
      // about, so this is success. Reporting it as failure made an idempotent retry
      // print a false "the lane is still taken" alarm (found in the live proof run).
      if (/HTTP 404\b/.test(msg)) return { cancelled: true, reason: 'already-gone' };
      return { cancelled: false, reason: 'unverifiable', detail: msg };
    }

    const status = typeof task?.status === 'string' ? task.status : undefined;
    if (status === undefined) {
      return {
        cancelled: false,
        reason: 'unverifiable',
        detail: `GET /tasks/${handle.taskId} returned no status field`,
      };
    }
    const idle = task.paused === true || TERMINAL_RAW_STATUSES.has(status);
    if (!idle) {
      return {
        cancelled: false,
        reason: 'running',
        detail: `status=${status} paused=${String(task.paused ?? false)}`,
      };
    }

    return this._deleteTask(handle);
  }

  /**
   * Unconditional DELETE — the rollback primitive, deliberately NOT guarded.
   *
   * `dispatch()` calls this on a task it created `paused` microseconds earlier
   * whose unpause FAILED, so it provably never started. Making that path pay for
   * the {@link AifHandoffBackend.cancelClaimChecked} pre-check would trade a
   * known-safe delete for a guaranteed orphan whenever the GET is the broken
   * thing. The operator-facing cancel is the guarded one.
   */
  private async _deleteTask(handle: TaskHandle): Promise<CancelOutcome> {
    try {
      await this._rest('DELETE', `/tasks/${handle.taskId}`);
      return { cancelled: true, reason: 'deleted' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/HTTP 404\b/.test(msg)) return { cancelled: true, reason: 'already-gone' };
      return { cancelled: false, reason: 'delete-failed', detail: msg };
    }
  }

  /**
   * One-shot dispatch — claim + release with the original rollback semantics.
   *
   * Retained verbatim in behaviour: callers that do not need a Phase -1 window
   * (the PostToolUse hook, `/dispatcher`) still see one atomic call whose failed
   * unpause best-effort DELETEs the half-created task, so no orphan is left on
   * the project and the CLI falls back to ManualBackend (dispatch.ts).
   */
  async dispatch(kickoff: KickoffSpec): Promise<TaskHandle> {
    const handle = await this.claim(kickoff);
    try {
      return await this.release(handle);
    } catch (err) {
      // Unguarded on purpose — see _deleteTask: this task never started.
      await this._deleteTask(handle);
      throw err;
    }
  }

  async getStatus(handle: TaskHandle): Promise<TaskStatus> {
    // Non-blocking point-in-time snapshot via REST GET /tasks/:id.
    // Source: aifWsStatus.getTaskStatus -> packages/api/src/routes/tasks.ts GET /:id
    // REST is used (not WS) because getStatus must NOT block.
    // WS is subscribe-and-wait; REST returns immediately.
    const { rawStatus, checkedAt } = await getTaskStatus(handle.taskId, this.baseUrl);
    return {
      status: mapAifStatusToTaskStatus(rawStatus),
      rawStatus,
      checkedAt,
    };
  }

  async awaitDone(handle: TaskHandle, timeoutMs?: number): Promise<TaskResult> {
    // Real WebSocket status readback via aif-handoff broadcast stream.
    // Source: aifWsStatus.awaitTaskDone -> ws://localhost:3009/ws
    // WS event: { type: "task:updated", payload: { id, title, status } }
    // taskId filter: payload.id === handle.taskId (client-side, per kickoff §3 SW-C item 2)
    // Terminal states: done/verified -> success; blocked_external -> !success (resolves, not throws)
    // Transport failures (disconnect after retries) -> throws BackendError('unavailable')
    try {
      const result = await awaitTaskDone({
        taskId: handle.taskId,
        wsUrl: this.wsUrl,
        stateFilePath: this.stateFilePath,
        timeoutMs,
        WebSocketImpl: this.WebSocketImpl,
      });
      return {
        success: result.success,
        content: '',
        finalStatus: result.finalStatus,
        completedAt: result.completedAt,
      };
    } catch (err) {
      // Re-throw BackendErrors (unavailable, timeout) as-is.
      // Other errors are wrapped as dispatch_failed.
      if (err instanceof BackendError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new BackendError(
        `aif-handoff awaitDone unexpected error for task ${handle.taskId}: ${msg}`,
        'dispatch_failed',
        'aif-handoff',
      );
    }
  }

  // -- Private helpers -------------------------------------------------------

  /**
   * Call an aif-handoff REST endpoint (plain JSON, no MCP handshake).
   * Used by dispatch() for the 4-step planner-skip sequence on baseUrl (:3009).
   *
   * Error mapping (per RuntimeBackend BackendError contract):
   *   - connection refused / abort / timeout -> 'unavailable' (triggers Manual fallback)
   *   - HTTP 429                              -> 'quota_exceeded' (triggers Manual fallback)
   *   - any other non-2xx (incl. the dirty-worktree 4xx guard) -> 'dispatch_failed'
   *
   * @param method  HTTP method (POST / PUT / ...).
   * @param path    Path appended to baseUrl (e.g. '/tasks', '/tasks/:id/events').
   * @param body    Optional JSON body. Omitted bodies send no payload.
   */
  private async _rest(method: string, path: string, body?: unknown): Promise<unknown> {
    let res: Response;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);
      try {
        res = await fetch(`${this.baseUrl}${path}`, {
          method,
          // Only declare a JSON content-type when we actually send a body
          // (a no-body DELETE with Content-Type: application/json is malformed
          // to some servers).
          headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      const msg = err instanceof Error ? err.message : String(err);
      // Prefer the canonical AbortError name; fall back to message-substring.
      if (name === 'AbortError' || msg.includes('abort') || msg.includes('timeout')) {
        throw new BackendError(
          `aif-handoff REST ${method} ${path} timed out`,
          'unavailable',
          'aif-handoff',
        );
      }
      throw new BackendError(
        `aif-handoff REST ${method} ${path} unreachable: ${msg}`,
        'unavailable',
        'aif-handoff',
      );
    }

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      if (res.status === 429) {
        throw new BackendError(
          `aif-handoff rate limit (${method} ${path}): ${errBody}`,
          'quota_exceeded',
          'aif-handoff',
        );
      }
      throw new BackendError(
        `aif-handoff REST ${method} ${path} HTTP ${res.status}: ${errBody}`,
        'dispatch_failed',
        'aif-handoff',
      );
    }

    // REST returns plain JSON (no SSE framing). Tolerate an empty body.
    const text = await res.text();
    if (!text) return {};
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }
}
