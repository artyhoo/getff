// packages/runtime-bridge/src/cli/aifHttp.ts
/**
 * Shared aif-handoff REST helpers — the SINGLE request implementation for every CLI in
 * this tree and for the aifWsStatus REST snapshot. GET/PUT/POST with one BackendError
 * mapping (connection → unavailable, 429 → quota_exceeded, other → dispatch_failed) and
 * one timeout policy. answer.ts `post` and aifWsStatus `getTaskStatus` used to carry
 * their own copies, which had already diverged (#1597 ledger R-7 / S-4).
 * @cc-only-rationale: pure TS over plain HTTP — no CC-only primitive, no paid LLM.
 */
import { BackendError, type BackendErrorCode } from '../backend.js';

/** The subset of an aif-handoff task these CLIs read/mutate (GET /tasks/:id). */
export interface AifTaskFull {
  id: string;
  title: string;
  status: string;
  plan?: string | null;
  paused?: boolean;
  blockedReason?: string | null;
  /** aif's persisted feature-branch name (planner source-of-truth; read back by harvest). */
  branchName?: string | null;
  /**
   * aif's persisted per-task CHECKOUT — the worktree it ran the task in (a sibling of the
   * base clone, `<root>-<branch-slug>-<taskId>`), NOT the base clone. Null on tasks that ran
   * before/without parallel worktrees (11/183 live tasks, 2026-08-07). Harvest reads it as
   * the fallback record when git's own worktree list has no entry for the branch; measuring
   * the guards against the base clone instead is the defect this field closes.
   */
  worktreePath?: string | null;
}

/**
 * How long any aif-handoff request may hang before it is aborted. There used to be NO
 * timeout here at all while aifWsStatus.getTaskStatus aborted its own copy of GET
 * /tasks/:id after 5 s — so the status probe of a wedged API returned while
 * park/answer/harvest/ensure-parallel hung on it forever (R-7). One module, one policy.
 */
export const DEFAULT_HTTP_TIMEOUT_MS = 30_000;

export interface RequestOptions {
  /** Abort the request after this many ms (default {@link DEFAULT_HTTP_TIMEOUT_MS}). */
  timeoutMs?: number;
  /**
   * BackendError code for a 404. Defaults to 'dispatch_failed' (a bad id from a CLI
   * flag is a caller defect); the status probe passes 'unavailable' — the task it was
   * told to watch may simply not exist yet.
   */
  notFoundCode?: BackendErrorCode;
}

/**
 * The ONE aif-handoff request in this tree. Every CLI + the status probe funnel through
 * it, so the BackendError mapping (connection → unavailable, 429 → quota_exceeded, other
 * → dispatch_failed) and the timeout are defined once. Three hand-written copies used to
 * exist and had already diverged — see R-7 / S-4 in the #1597 review ledger.
 */
async function request(
  method: 'GET' | 'PUT' | 'POST',
  baseUrl: string,
  path: string,
  body?: unknown,
  opts: RequestOptions = {},
): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    opts.timeoutMs ?? DEFAULT_HTTP_TIMEOUT_MS,
  );
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method,
      headers:
        body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new BackendError(
      `aif-handoff ${method} ${path} unreachable: ${msg}`,
      'unavailable',
      'aif-handoff',
    );
  } finally {
    clearTimeout(timeoutId);
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
    if (res.status === 404 && opts.notFoundCode) {
      throw new BackendError(
        `aif-handoff ${method} ${path} HTTP 404 (not found): ${errBody}`,
        opts.notFoundCode,
        'aif-handoff',
      );
    }
    throw new BackendError(
      `aif-handoff ${method} ${path} HTTP ${res.status}: ${errBody}`,
      'dispatch_failed',
      'aif-handoff',
    );
  }
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/** GET <path> → the parsed JSON body (the generic half of {@link getTask}). */
export async function getJson(
  baseUrl: string,
  path: string,
  opts?: RequestOptions,
): Promise<unknown> {
  return request('GET', baseUrl, path, undefined, opts);
}

/**
 * POST a JSON body → the parsed JSON response. answer.ts carried a verbatim copy of
 * this (S-4); the mapping contract lives here, not in each caller.
 */
export async function postJson(
  baseUrl: string,
  path: string,
  body: unknown,
  opts?: RequestOptions,
): Promise<unknown> {
  return request('POST', baseUrl, path, body, opts);
}

/** GET /tasks/:id → the task object. */
export async function getTask(
  baseUrl: string,
  taskId: string,
): Promise<AifTaskFull> {
  return (await request('GET', baseUrl, `/tasks/${taskId}`)) as AifTaskFull;
}

/** PUT /tasks/:id with a partial field update (updateTaskSchema-accepted fields only). */
export async function putTask(
  baseUrl: string,
  taskId: string,
  body: Record<string, unknown>,
): Promise<void> {
  await request('PUT', baseUrl, `/tasks/${taskId}`, body);
}

/**
 * The subset of an aif-handoff project the ensure-parallel guard reads + round-trips.
 * aif exposes NO `GET /projects/:id`; the list (`GET /projects`) returns these camelCase
 * fields (drizzle ProjectRow). The four `*MaxBudgetUsd` fields are load-bearing for the
 * round-trip: the PUT handler NULLs any omitted budget (`@aif/data updateProject: x ?? null`),
 * so they must be read here and written back to avoid clobbering a UI-set budget.
 */
export interface AifProjectFull {
  id: string;
  name: string;
  rootPath: string;
  parallelEnabled?: boolean;
  plannerMaxBudgetUsd?: number | null;
  planCheckerMaxBudgetUsd?: number | null;
  implementerMaxBudgetUsd?: number | null;
  reviewSidecarMaxBudgetUsd?: number | null;
  defaultTaskRuntimeProfileId?: string | null;
  defaultPlanRuntimeProfileId?: string | null;
  defaultReviewRuntimeProfileId?: string | null;
  defaultChatRuntimeProfileId?: string | null;
}

/** GET /projects → all projects (aif has no GET /projects/:id; callers filter by id). */
export async function getProjects(baseUrl: string): Promise<AifProjectFull[]> {
  const res = await request('GET', baseUrl, '/projects');
  return Array.isArray(res) ? (res as AifProjectFull[]) : [];
}

/** PUT /projects/:id with a full createProjectSchema body (the only parallelEnabled write path). */
export async function putProject(
  baseUrl: string,
  projectId: string,
  body: Record<string, unknown>,
): Promise<void> {
  await request('PUT', baseUrl, `/projects/${projectId}`, body);
}
