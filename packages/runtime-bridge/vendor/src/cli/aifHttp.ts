// packages/runtime-bridge/src/cli/aifHttp.ts
/**
 * Shared aif-handoff REST helpers for the field-mutating CLIs (park, answer-resume).
 * GET a task and PUT field updates, with the same BackendError mapping as
 * answer.ts `post` (connection → unavailable, 429 → quota_exceeded, other → dispatch_failed).
 * @cc-only-rationale: pure TS over plain HTTP — no CC-only primitive, no paid LLM.
 */
import { BackendError } from '../backend.js';

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
}

async function request(method: 'GET' | 'PUT', baseUrl: string, path: string, body?: unknown): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new BackendError(`aif-handoff ${method} ${path} unreachable: ${msg}`, 'unavailable', 'aif-handoff');
  }
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    if (res.status === 429) {
      throw new BackendError(`aif-handoff rate limit (${method} ${path}): ${errBody}`, 'quota_exceeded', 'aif-handoff');
    }
    throw new BackendError(`aif-handoff ${method} ${path} HTTP ${res.status}: ${errBody}`, 'dispatch_failed', 'aif-handoff');
  }
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/** GET /tasks/:id → the task object. */
export async function getTask(baseUrl: string, taskId: string): Promise<AifTaskFull> {
  return (await request('GET', baseUrl, `/tasks/${taskId}`)) as AifTaskFull;
}

/** PUT /tasks/:id with a partial field update (updateTaskSchema-accepted fields only). */
export async function putTask(baseUrl: string, taskId: string, body: Record<string, unknown>): Promise<void> {
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
export async function putProject(baseUrl: string, projectId: string, body: Record<string, unknown>): Promise<void> {
  await request('PUT', baseUrl, `/projects/${projectId}`, body);
}
