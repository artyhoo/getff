/**
 * aifWsStatus — WebSocket-based status consumer for aif-handoff tasks.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * SW-C SCHEMA DISCOVERY (kickoff §SCHEMA DISCOVERY FIRST requirement)
 * ═══════════════════════════════════════════════════════════════════════════
 * Discovered via gh api (2026-05-30):
 *
 * WS ENDPOINT:
 *   packages/api/src/ws.ts: app.get("/ws", upgradeWebSocket(...))
 *   packages/shared/src/env.ts: PORT defaults to 3009, API_BASE_URL="http://localhost:3009"
 *   → ws://localhost:3009/ws  (SAME port as API/REST server; different from MCP stdio)
 *
 * WS BROADCAST PAYLOAD (task status events):
 *   packages/api/src/repositories/tasks.ts:
 *     export function toTaskBroadcastPayload(task: { id: string; title: string; status: TaskStatus }) {
 *       return { id: task.id, title: task.title, status: task.status };
 *     }
 *   Broadcast type for status changes: "task:updated" | "task:moved"
 *   WsEvent shape: { type: "task:updated", payload: { id: "<taskId>", title: "...", status: "..." } }
 *   → payload.id IS the taskId (confirmed from toTaskBroadcastPayload source)
 *
 * TASK_STATUSES (packages/shared/src/types.ts, lines 1-9):
 *   "backlog" | "planning" | "plan_ready" | "implementing" |
 *   "review" | "blocked_external" | "done" | "verified"
 *   NO "error" or "failed" status exists.
 *
 * REST STATUS ENDPOINT:
 *   packages/api/src/routes/tasks.ts: tasksRouter.get("/:id", ...)
 *   Mounted at: app.route("/tasks", tasksRouter) → GET /tasks/:id
 *   Returns full task object including status field.
 *
 * WS CLIENT TYPE:
 *   @types/node@22.19.17 exposes WebSocket as named export from node:http:
 *     (http.d.ts line 2077): const WebSocket: typeof import("undici-types").WebSocket;
 *   Uses dependency injection (WebSocketConstructor param) for testability —
 *   vi.stubGlobal won't intercept named imports; DI lets tests pass a fake.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Design:
 *   - awaitTaskDone subscribes before initial/reconnect authoritative REST reads.
 *     Task frames invalidate snapshots; only current full detail can settle.
 *   - WS disconnect → bounded reconnect (≤3 total attempts), then uncertainty.
 *   - Finite observation deadline (one hour by default) and observation-only abort.
 *   - stateFilePath: when set, appends status lines AND disconnect events
 *     (event=ws_disconnected …) to the file (append-only, no rewrite) — item 5:
 *     a disconnect is noted, never silently dropped.
 *   - getTaskStatus: REST GET /tasks/:id (non-blocking point-in-time snapshot).
 */
import { WebSocket } from 'node:http';
import { appendFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { BackendError } from './backend.js';
import { getJson, type AifTaskFull, type RequestOptions } from './cli/aifHttp.js';
import { isParked, parkedReason } from './cli/questions.js';
import type { TaskResult } from './types.js';

/** Preserve the old CLI's adverse signal. It requests reconciliation, never approval. */
const ADVERSE_ADVISORY = /zero code|should be .{0,12}blocked|as .{0,8}['"]?blocked|treat .{0,40}blocked|BLOCKER-\d/i;

export interface AifResultMetadata extends Record<string, unknown> {
  taskId: string;
  resultGeneration: string | null;
  candidate: { branch: string | null; commitSha: string | null };
  sessionId: string | null;
  attempt: null;
  reviewIteration: number | null;
  acceptance: 'unverified';
  held: 'parked' | 'paused' | 'advisory' | 'unknown-status' | 'unresolved' | null;
  source: string;
  nextAction: {
    kind: 'reconcile' | 'review' | 'observe';
    state: 'pending';
    ownerReference: string | null;
    prerequisite: string;
    returnCondition: string;
  };
}

/** A bounded observation of the existing task record, not a new review/authority record. */
export function describeAifTask(
  task: AifTaskFull,
  expectedTaskId: string,
  ownerReference: string | null = process.env['RUNTIME_BRIDGE_RESULT_OWNER']?.trim() || null,
): TaskResult & { meta: AifResultMetadata } {
  const invalid = () => new BackendError(`invalid task detail for ${expectedTaskId}; reconcile the authoritative record`, 'unavailable', 'aif-handoff');
  if (!task || task.id !== expectedTaskId || typeof task.title !== 'string' || typeof task.status !== 'string') throw invalid();
  for (const key of ['paused', 'manualReviewRequired'] as const) {
    if (task[key] !== undefined && typeof task[key] !== 'boolean') throw invalid();
  }
  for (const key of ['branchName', 'commitSha', 'sessionId', 'reviewComments', 'implementationLog', 'blockedReason', 'plan', 'description'] as const) {
    if (task[key] != null && typeof task[key] !== 'string') throw invalid();
  }
  if (task.reviewIterationCount !== undefined && (!Number.isSafeInteger(task.reviewIterationCount) || task.reviewIterationCount < 0)) throw invalid();
  if (task.commitSha != null && !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(task.commitSha)) throw invalid();
  const hash = (value: string) => createHash('sha256').update(value).digest('hex');
  const candidate = { branch: task.branchName ?? null, commitSha: task.commitSha ?? null };
  const generation = hash(JSON.stringify({
    taskId: task.id, status: task.status, candidate, sessionId: task.sessionId ?? null,
    reviewIteration: task.reviewIterationCount ?? null, executionOwner: task.executionOwner ?? null,
    ownershipRevision: task.ownershipRevision ?? null, paused: task.paused ?? null,
    manualReviewRequired: task.manualReviewRequired ?? null, blockedReason: task.blockedReason ?? null,
    ...Object.fromEntries(['description', 'plan', 'implementationLog', 'reviewComments'].map((key) => [key, hash((task as unknown as Record<string, string>)[key] ?? '')])),
  }));
  const known = new Set(['backlog', 'planning', 'plan_ready', 'implementing', 'review', 'done', 'verified', 'blocked_external']);
  // The existing question reader's type predates nullable API reviewComments. Its
  // string-only checks treat null as absence; normalize that one input without a fork.
  const parkInput = { ...task, reviewComments: task.reviewComments ?? undefined };
  const held: AifResultMetadata['held'] = isParked(parkInput) ? 'parked' : task.paused ? 'paused'
    : TERMINAL_SUCCESS_STATUSES.has(task.status) && ADVERSE_ADVISORY.test(task.reviewComments ?? '') ? 'advisory' : !known.has(task.status) ? 'unknown-status' : null;
  const terminal = TERMINAL_SUCCESS_STATUSES.has(task.status);
  const reason = held === 'parked' ? parkedReason(parkInput) : held === 'paused' ? 'Task is intentionally paused'
    : held === 'advisory' ? 'Existing adverse review advisory requires source reconciliation'
    : held === 'unknown-status' ? 'Unrecognized lifecycle status requires source reconciliation'
    : terminal ? 'Independent same-candidate acceptance and authorized delivery remain unverified' : 'Observe the existing execution owner; do not launch a duplicate';
  return {
    success: terminal && held === null,
    content: [task.blockedReason, task.reviewComments].filter(Boolean).join('\n').slice(0, 4000),
    finalStatus: task.status,
    // This is an observation time, not evidence that acceptance or delivery occurred.
    completedAt: new Date().toISOString(),
    meta: {
      taskId: task.id, resultGeneration: generation, candidate, sessionId: task.sessionId ?? null,
      attempt: null, reviewIteration: task.reviewIterationCount ?? null, acceptance: 'unverified', held,
      source: `/tasks/${encodeURIComponent(task.id)}`,
      nextAction: {
        kind: held ? 'reconcile' : terminal ? 'review' : 'observe', state: 'pending', ownerReference,
        prerequisite: `${ownerReference ? '' : 'Bind an accountable reader/recipient. '}${reason}`,
        returnCondition: 'Re-read this task and bind its candidate/result generation to the applicable authority before acting.',
      },
    },
  };
}

/** Keep failed consumption pending without deriving identity from rejected detail. */
export function unresolvedAifTaskResult(
  taskId: string,
  error: unknown,
  observed?: AifResultMetadata,
): TaskResult & { meta: AifResultMetadata } {
  const ownerReference = observed ? observed.nextAction.ownerReference
    : process.env['RUNTIME_BRIDGE_RESULT_OWNER']?.trim() || null;
  const diagnostic = error instanceof Error ? error.message : String(error);
  return {
    success: false, finalStatus: 'unknown', content: diagnostic,
    completedAt: new Date().toISOString(),
    meta: {
      taskId, resultGeneration: observed?.resultGeneration ?? null,
      candidate: observed?.candidate ?? { branch: null, commitSha: null },
      sessionId: observed?.sessionId ?? null, attempt: null,
      reviewIteration: observed?.reviewIteration ?? null, acceptance: 'unverified',
      held: 'unresolved', source: `/tasks/${encodeURIComponent(taskId)}`,
      nextAction: {
        kind: 'reconcile', state: 'pending', ownerReference: ownerReference || null,
        prerequisite: `${ownerReference ? '' : 'Bind an accountable reader/recipient. '}`
          + (observed ? 'Reconcile the validated observation and any delivery effects before retrying. '
            : 'Obtain valid authoritative detail for the requested task before acting. ') + diagnostic,
        returnCondition: 'Re-read the requested task and bind current candidate, result generation and applicable authority before continuation.',
      },
    },
  };
}

/** Full REST detail must be consumed before a terminal signal is reported as a result. */
export async function readAifTaskResult(taskId: string, apiBaseUrl: string, options: RequestOptions = {}) {
  try {
    const task = await getJson(apiBaseUrl, `/tasks/${encodeURIComponent(taskId)}`, { timeoutMs: 5000, ...options, notFoundCode: 'unavailable' });
    return describeAifTask(task as AifTaskFull, taskId);
  } catch (error) {
    return unresolvedAifTaskResult(taskId, error);
  }
}

/** The shape of aif-handoff's task:updated broadcast payload. */
interface AifTaskBroadcastPayload {
  id: string;
  title: string;
  status: string;
}

/** Minimal WsEvent shape from aif-handoff. */
interface AifWsEvent {
  type: string;
  payload: unknown;
}

/** aif-handoff TASK_STATUSES that mean the task is done successfully. */
const TERMINAL_SUCCESS_STATUSES = new Set(['done', 'verified']);

/** aif-handoff TASK_STATUSES that mean terminal but not success (needs human). */
const TERMINAL_FAILURE_STATUSES = new Set(['blocked_external']);

/**
 * Maps aif-handoff raw status to our TaskStatus.status.
 * Source: packages/shared/src/types.ts TASK_STATUSES enum (lines 1-9).
 * No "error"/"failed" status exists — blocked_external is the only error-class terminal.
 */
export function mapAifStatusToTaskStatus(
  raw: string,
): 'pending' | 'running' | 'done' | 'error' {
  if (raw === 'backlog' || raw === 'planning') return 'pending';
  if (raw === 'plan_ready' || raw === 'implementing' || raw === 'review') return 'running';
  if (TERMINAL_SUCCESS_STATUSES.has(raw)) return 'done';
  if (TERMINAL_FAILURE_STATUSES.has(raw)) return 'error';
  // Unknown future statuses default to running (non-terminal assumption)
  return 'running';
}

/** Whether a raw aif status is terminal (awaitTaskDone should resolve). */
export function isTerminal(raw: string): boolean {
  return TERMINAL_SUCCESS_STATUSES.has(raw) || TERMINAL_FAILURE_STATUSES.has(raw);
}

/**
 * Constructor type for WebSocket (matches undici-types WebSocket constructor).
 * Used for dependency injection in tests.
 */
export type WebSocketConstructor = new (url: string) => InstanceType<typeof WebSocket>;

/** Options for awaitTaskDone. */
export interface AwaitTaskDoneOptions {
  /** Task UUID to filter events by. */
  taskId: string;
  /** Full ws:// URL of the aif-handoff WebSocket endpoint. */
  wsUrl: string;
  /** Authoritative REST origin; defaults to the HTTP equivalent of wsUrl's origin. */
  apiBaseUrl?: string;
  /** Optional file path to append status updates to (append-only, no rewrite). */
  stateFilePath?: string;
  /** Positive observation deadline in ms. Default: one hour, never an unbounded wait. */
  timeoutMs?: number;
  /** Cancel this observation only, never the underlying task. */
  signal?: AbortSignal;
  /** Max reconnect attempts before giving up. Default: 3. */
  maxReconnectAttempts?: number;
  /** Dependency injection: custom WebSocket constructor (for testing). */
  WebSocketImpl?: WebSocketConstructor;
}

/** Full authoritative result, including the S3 generation and pending owner. */
export type AwaitTaskDoneResult = TaskResult & { meta: AifResultMetadata };

/** Transport uncertainty retains the last validated identity without granting a retry. */
export class AifObservationError extends BackendError {
  constructor(message: string, code: 'timeout' | 'unavailable', public readonly observed?: AifResultMetadata) {
    super(message, code, 'aif-handoff');
  }
}

/**
 * Subscribe before reconciling, on initial connection and every reconnect.
 * Frames invalidate observations; only full authoritative detail can settle.
 * A response overtaken by a frame or another connection is discarded. No
 * server-side observation sequence is available, so never order by timestamps.
 */
export function awaitTaskDone(opts: AwaitTaskDoneOptions): Promise<AwaitTaskDoneResult> {
  const {
    taskId,
    wsUrl,
    stateFilePath,
    timeoutMs = 3_600_000,
    signal,
    maxReconnectAttempts = 3,
    WebSocketImpl = WebSocket as unknown as WebSocketConstructor,
  } = opts;

  return new Promise<AwaitTaskDoneResult>((resolve, reject) => {
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647 || !Number.isSafeInteger(maxReconnectAttempts) || maxReconnectAttempts < 0) {
      reject(new BackendError('Invalid AIF observation deadline or reconnect budget', 'spec_invalid', 'aif-handoff'));
      return;
    }
    const origin = new URL(wsUrl);
    origin.protocol = origin.protocol === 'wss:' ? 'https:' : 'http:';
    const apiBaseUrl = opts.apiBaseUrl ?? origin.origin;
    const deadline = performance.now() + timeoutMs;
    let attemptsLeft = maxReconnectAttempts;
    let settled = false;
    let observed: AifResultMetadata | undefined;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    let reconnectHandle: ReturnType<typeof setTimeout> | null = null;
    let currentWs: InstanceType<typeof WebSocket> | null = null;
    let readController: AbortController | null = null;

    function cleanup() {
      signal?.removeEventListener('abort', abort);
      if (timeoutHandle !== null) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
      if (reconnectHandle !== null) clearTimeout(reconnectHandle);
      readController?.abort();
      const socket = currentWs;
      currentWs = null;
      try { socket?.close(); } catch { /* best-effort */ }
    }

    function done(result: AwaitTaskDoneResult) {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    }

    function fail(message: string, code: 'timeout' | 'unavailable') {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new AifObservationError(message, code, observed));
    }

    function abort() { fail(`Observation cancelled for task ${taskId}; underlying task unchanged`, 'unavailable'); }

    /**
     * Append an arbitrary key=value line to the state file (append-only).
     * Used for both status transitions (status=…) and lifecycle events
     * (event=ws_disconnected …) per kickoff §3 SW-C item 5: a disconnect MUST
     * be noted in state.md, not silently dropped.
     */
    function appendStateLine(content: string) {
      if (!stateFilePath) return;
      try {
        const line = `[${new Date().toISOString()}] taskId=${taskId} ${content}\n`;
        appendFileSync(stateFilePath, line, 'utf8');
      } catch {
        // Best-effort; don't crash the stream for a file write error.
      }
    }

    function connect() {
      if (settled) return;
      let sock: InstanceType<typeof WebSocket>;
      try { sock = new WebSocketImpl(wsUrl); }
      catch (error) { fail(`Cannot observe task ${taskId}: ${String(error)}`, 'unavailable'); return; }
      currentWs = sock;
      let opened = false;
      let revision = 0;
      let reading = false;
      const active = () => !settled && currentWs === sock;

      async function reconcile() {
        revision++;
        if (reading || !active()) return;
        reading = true;
        try {
          while (active()) {
            const at = revision;
            const controller = new AbortController();
            readController = controller;
            const result = await readAifTaskResult(taskId, apiBaseUrl, {
              signal: controller.signal, timeoutMs: Math.max(1, Math.min(5000, deadline - performance.now())),
            });
            if (!active()) return;
            if (at !== revision) continue;
            if (result.meta.held === 'unresolved') {
              done(unresolvedAifTaskResult(taskId, result.content, observed));
              return;
            }
            observed = result.meta;
            appendStateLine(`status=${result.finalStatus} generation=${observed.resultGeneration}`);
            if (result.meta.held || isTerminal(result.finalStatus)) done(result);
            return;
          }
        } finally { reading = false; }
      }

      sock.onopen = () => {
        if (active()) { opened = true; void reconcile(); }
      };

      sock.onmessage = (ev) => {
        if (!active() || !opened) return;
        let parsed: AifWsEvent;
        try {
          parsed = JSON.parse(String(ev.data)) as AifWsEvent;
        } catch {
          return; // Ignore unparseable frames
        }

        // Filter: only task:updated and task:moved carry { id, title, status } payloads
        // Source: packages/api/src/routes/tasks.ts — broadcast() calls using toTaskBroadcastPayload
        if (!parsed || (parsed.type !== 'task:updated' && parsed.type !== 'task:moved')) return;

        const payload = parsed.payload as Partial<AifTaskBroadcastPayload>;
        if (!payload || payload.id !== taskId) return;
        void reconcile();
      };

      sock.onclose = () => {
        if (!active()) return;
        currentWs = null;
        readController?.abort();
        if (attemptsLeft > 0) {
          attemptsLeft--;
          // Note the disconnect in state.md (item 5: never a silent drop), then
          // pause briefly before reconnect — avoids tight loop on flapping server.
          appendStateLine(`event=ws_disconnected reconnecting attempts_left=${attemptsLeft}`);
          reconnectHandle = setTimeout(connect, 100);
        } else {
          // Terminal disconnect: note it in state.md before surfacing the error.
          appendStateLine('event=ws_disconnected terminal=true');
          fail(`aif-handoff WebSocket disconnected after ${maxReconnectAttempts} reconnect attempt(s) — task ${taskId}`, 'unavailable');
        }
      };

      sock.onerror = (_ev) => {
        if (!active()) return;
        // onerror fires before onclose; let onclose handle reconnect logic.
        process.stderr.write(
          `[runtime-bridge] aif-handoff WS error for task ${taskId}\n`,
        );
      };
    }

    timeoutHandle = setTimeout(() => fail(`Observation timed out after ${timeoutMs}ms for task ${taskId}; task outcome uncertain`, 'timeout'), timeoutMs);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    connect();
  });
}

/**
 * Non-blocking point-in-time status snapshot via REST GET /tasks/:id.
 *
 * Source: packages/api/src/routes/tasks.ts
 *   tasksRouter.get("/:id", ...) — returns full task object including status.
 *   Mounted at: app.route("/tasks", tasksRouter) → GET <apiBaseUrl>/tasks/:id
 *   (packages/api/src/index.ts line: app.route("/tasks", tasksRouter))
 *
 * Uses REST (not WS or _mcpCall) because:
 *   - WS is event-driven (subscribe-and-wait), not suitable for non-blocking snapshot.
 *   - MCP defaults to stdio; HTTP MCP mode is on port 3100 (separate from API on 3009).
 *   - REST /tasks/:id is on the API server (same port as WS, port 3009 by default).
 */
export async function getTaskStatus(
  taskId: string,
  apiBaseUrl: string,
  timeoutMs = 5_000,
): Promise<{ rawStatus: string; checkedAt: string }> {
  // R-7: this used to be a third hand-written GET /tasks/:id with its own BackendError
  // mapping — no 429 branch, and a 5 s abort the CLI copy in cli/aifHttp.ts did not have,
  // so a wedged API timed out here and hung there. One request implementation now; the
  // 404 → 'unavailable' contract this probe documents is passed in, not re-derived.
  const json = (await getJson(apiBaseUrl, `/tasks/${taskId}`, {
    timeoutMs,
    notFoundCode: 'unavailable',
  })) as { status?: string };
  const rawStatus = typeof json.status === 'string' ? json.status : 'unknown';
  return { rawStatus, checkedAt: new Date().toISOString() };
}
