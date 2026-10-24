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
 *   - awaitTaskDone: opens a WS connection, filters events by payload.id === taskId,
 *     resolves on terminal status (done/verified → success, blocked_external → !success).
 *   - WS disconnect → rejects with BackendError('unavailable').
 *   - Bounded reconnect (≤3 attempts) before giving up.
 *   - stateFilePath: when set, appends status lines AND disconnect events
 *     (event=ws_disconnected …) to the file (append-only, no rewrite) — item 5:
 *     a disconnect is noted, never silently dropped.
 *   - getTaskStatus: REST GET /tasks/:id (non-blocking point-in-time snapshot).
 */
import { WebSocket } from 'node:http';
import { appendFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { BackendError } from './backend.js';
import { getJson, type AifTaskFull } from './cli/aifHttp.js';
import { isParked, parkedReason } from './cli/questions.js';
import type { TaskResult } from './types.js';

/** Preserve the old CLI's adverse signal. It requests reconciliation, never approval. */
const ADVERSE_ADVISORY = /zero code|should be .{0,12}blocked|as .{0,8}['"]?blocked|treat .{0,40}blocked|BLOCKER-\d/i;

export interface AifResultMetadata extends Record<string, unknown> {
  taskId: string;
  resultGeneration: string;
  candidate: { branch: string | null; commitSha: string | null };
  sessionId: string | null;
  attempt: null;
  reviewIteration: number | null;
  acceptance: 'unverified';
  held: 'parked' | 'paused' | 'advisory' | 'unknown-status' | null;
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
    : ADVERSE_ADVISORY.test(task.reviewComments ?? '') ? 'advisory' : !known.has(task.status) ? 'unknown-status' : null;
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

/** Full REST detail must be consumed before a terminal signal is reported as a result. */
export async function readAifTaskResult(taskId: string, apiBaseUrl: string) {
  const task = await getJson(apiBaseUrl, `/tasks/${encodeURIComponent(taskId)}`, { timeoutMs: 5000, notFoundCode: 'unavailable' });
  return describeAifTask(task as AifTaskFull, taskId);
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
  /** Optional file path to append status updates to (append-only, no rewrite). */
  stateFilePath?: string;
  /** Optional timeout in ms. If omitted → no timeout (MVP documented limit). */
  timeoutMs?: number;
  /** Max reconnect attempts before giving up. Default: 3. */
  maxReconnectAttempts?: number;
  /** Dependency injection: custom WebSocket constructor (for testing). */
  WebSocketImpl?: WebSocketConstructor;
}

/** Result from awaitTaskDone. */
export interface AwaitTaskDoneResult {
  success: boolean;
  finalStatus: string;
  completedAt: string;
}

/**
 * Block until the aif-handoff task reaches a terminal state via WebSocket events.
 *
 * Filters broadcast events by payload.id === taskId (client-side filter).
 * Source: toTaskBroadcastPayload in packages/api/src/repositories/tasks.ts
 *   returns { id, title, status } — payload.id IS the taskId.
 *
 * On WS disconnect: attempts bounded reconnect (≤ maxReconnectAttempts).
 * After all reconnects exhausted → rejects with BackendError('unavailable').
 */
export function awaitTaskDone(opts: AwaitTaskDoneOptions): Promise<AwaitTaskDoneResult> {
  const {
    taskId,
    wsUrl,
    stateFilePath,
    timeoutMs,
    maxReconnectAttempts = 3,
    WebSocketImpl = WebSocket as unknown as WebSocketConstructor,
  } = opts;

  return new Promise<AwaitTaskDoneResult>((resolve, reject) => {
    let attemptsLeft = maxReconnectAttempts;
    let settled = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    let currentWs: InstanceType<typeof WebSocket> | null = null;

    function cleanup() {
      if (timeoutHandle !== null) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
      if (currentWs !== null) {
        try { currentWs.close(); } catch { /* best-effort */ }
        currentWs = null;
      }
    }

    function done(result: AwaitTaskDoneResult) {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    }

    function fail(err: BackendError) {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    }

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

    function appendStateFile(status: string) {
      appendStateLine(`status=${status}`);
    }

    function connect() {
      if (settled) return;
      const sock = new WebSocketImpl(wsUrl);
      currentWs = sock;

      sock.onopen = () => {
        // Connection established; reset attempt counter on successful open
        attemptsLeft = maxReconnectAttempts;
      };

      sock.onmessage = (ev) => {
        if (settled) return;
        let parsed: AifWsEvent;
        try {
          parsed = JSON.parse(String(ev.data)) as AifWsEvent;
        } catch {
          return; // Ignore unparseable frames
        }

        // Filter: only task:updated and task:moved carry { id, title, status } payloads
        // Source: packages/api/src/routes/tasks.ts — broadcast() calls using toTaskBroadcastPayload
        if (parsed.type !== 'task:updated' && parsed.type !== 'task:moved') return;

        const payload = parsed.payload as Partial<AifTaskBroadcastPayload>;
        // Client-side filter by taskId — ignore events for other tasks
        if (payload.id !== taskId) return;

        const rawStatus = payload.status ?? '';
        appendStateFile(rawStatus);

        if (!isTerminal(rawStatus)) return; // Not terminal — keep waiting

        const success = TERMINAL_SUCCESS_STATUSES.has(rawStatus);
        done({
          success,
          finalStatus: rawStatus,
          completedAt: new Date().toISOString(),
        });
      };

      sock.onclose = () => {
        if (settled) return;
        currentWs = null;
        if (attemptsLeft > 0) {
          attemptsLeft--;
          // Note the disconnect in state.md (item 5: never a silent drop), then
          // pause briefly before reconnect — avoids tight loop on flapping server.
          appendStateLine(`event=ws_disconnected reconnecting attempts_left=${attemptsLeft}`);
          setTimeout(connect, 100);
        } else {
          // Terminal disconnect: note it in state.md before surfacing the error.
          appendStateLine('event=ws_disconnected terminal=true');
          fail(
            new BackendError(
              `aif-handoff WebSocket disconnected after ${maxReconnectAttempts} reconnect attempt(s) — task ${taskId}`,
              'unavailable',
              'aif-handoff',
            ),
          );
        }
      };

      sock.onerror = (_ev) => {
        // onerror fires before onclose; let onclose handle reconnect logic.
        process.stderr.write(
          `[runtime-bridge] aif-handoff WS error for task ${taskId}\n`,
        );
      };
    }

    // Optional timeout
    if (timeoutMs !== undefined && timeoutMs > 0) {
      timeoutHandle = setTimeout(() => {
        fail(
          new BackendError(
            `awaitDone timed out after ${timeoutMs}ms for task ${taskId}`,
            'timeout',
            'aif-handoff',
          ),
        );
      }, timeoutMs);
    }

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
