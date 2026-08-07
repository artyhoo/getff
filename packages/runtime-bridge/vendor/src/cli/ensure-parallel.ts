// packages/runtime-bridge/src/cli/ensure-parallel.ts
/**
 * CLI ensure-parallel entrypoint — the self-heal half of Finding A (dirty_worktree).
 *
 * Usage (operator, smoke, or auto pre-dispatch):
 *   tsx packages/runtime-bridge/src/cli/ensure-parallel.ts --project <id>
 *   # --project defaults to $RUNTIME_BRIDGE_AIF_PROJECT_ID.
 *
 * Why this exists (research-patch 2026-06-01-aif-task-isolation.md §1-§2):
 *   aif creates a per-task git worktree only when a 3-gate AND holds
 *   (planner.ts): AIF_TASK_WORKTREES_ENABLED (env) && project.parallelEnabled
 *   (DB) && projectSupportsTaskWorktrees. Gate 2 (`parallel_enabled`) is a
 *   project-level DB flag set ONLY via the web UI / raw DB — there is no env or
 *   config.yaml knob, so a freshly-provisioned instance has it 0 and every task
 *   runs in-place on the shared checkout → dirties it → the next dispatch 409s
 *   on dirty_worktree. This guard re-applies the fix on any instance.
 *
 * Why the round-trip (NOT a minimal PUT):
 *   aif exposes no targeted parallelEnabled write — only PATCH /:id/auto-queue-mode
 *   exists. The sole parallelEnabled path is the full PUT /projects/:id, whose
 *   handler NULLs each omitted `*MaxBudgetUsd` field (`@aif/data updateProject:
 *   x ?? null`). So a minimal `{name,rootPath,parallelEnabled}` PUT would wipe any
 *   UI-set budget. We therefore read the full project back from GET /projects and
 *   write every field, flipping ONLY parallelEnabled. Budgets that are null stay
 *   omitted (createProjectSchema budgets are `.optional()`, not `.nullable()`).
 *
 *   Cleaner long-term fix = an upstream `PATCH /projects/:id/parallel-enabled`
 *   mirroring the existing auto-queue-mode PATCH (file against lee-to/aif-handoff);
 *   this guard is the our-side stopgap (BFR: REFERENCE upstream, build the glue).
 *
 * Exit codes: 0 (already-enabled or enabled-now); 1 bad args / project missing / REST error.
 *
 * @cc-only-rationale: pure TS over plain HTTP — also callable from a smoke-test and an
 *   orchestrator session, and imported by AifHandoffBackend.dispatch(). No CC-only
 *   primitive, no Superset import, no paid LLM.
 */
import { fileURLToPath } from 'node:url';
import { getProjects, putProject, type AifProjectFull } from './aifHttp.js';
import { resolveReachableBaseUrl } from './park.js';

export interface EnsureParallelResult {
  projectId: string;
  changed: boolean;
  /** Always true on success — the post-condition the guard guarantees. */
  parallelEnabled: true;
  reason: 'already-enabled' | 'enabled-now';
}

/**
 * Build the full createProjectSchema PUT body that preserves every existing field and
 * flips parallelEnabled to true. Budgets are `.optional()` (not nullable) in the schema,
 * so a null/absent budget is sent as `undefined` → omitted by JSON.stringify → re-NULLed
 * by the handler (no change). A set budget is carried through verbatim (anti-clobber).
 */
export function buildParallelEnablePut(project: AifProjectFull): Record<string, unknown> {
  return {
    name: project.name,
    rootPath: project.rootPath,
    plannerMaxBudgetUsd: project.plannerMaxBudgetUsd ?? undefined,
    planCheckerMaxBudgetUsd: project.planCheckerMaxBudgetUsd ?? undefined,
    implementerMaxBudgetUsd: project.implementerMaxBudgetUsd ?? undefined,
    reviewSidecarMaxBudgetUsd: project.reviewSidecarMaxBudgetUsd ?? undefined,
    parallelEnabled: true,
    defaultTaskRuntimeProfileId: project.defaultTaskRuntimeProfileId ?? null,
    defaultPlanRuntimeProfileId: project.defaultPlanRuntimeProfileId ?? null,
    defaultReviewRuntimeProfileId: project.defaultReviewRuntimeProfileId ?? null,
    defaultChatRuntimeProfileId: project.defaultChatRuntimeProfileId ?? null,
  };
}

/**
 * Ensure `parallelEnabled === true` on the aif project so per-task worktrees are created.
 * No-op (no PUT) when already enabled. Throws on a missing project or REST failure — the
 * caller decides whether that is fatal (the CLI exits 1; AifHandoffBackend warns + proceeds).
 */
export async function ensureParallelEnabled(baseUrl: string, projectId: string): Promise<EnsureParallelResult> {
  const projects = await getProjects(baseUrl);
  const project = projects.find((p) => p.id === projectId);
  if (!project) {
    throw new Error(`project ${projectId} not found at ${baseUrl} (GET /projects)`);
  }
  if (project.parallelEnabled === true) {
    return { projectId, changed: false, parallelEnabled: true, reason: 'already-enabled' };
  }
  await putProject(baseUrl, projectId, buildParallelEnablePut(project));
  return { projectId, changed: true, parallelEnabled: true, reason: 'enabled-now' };
}

/** Render an EnsureParallelResult as a human-readable confirmation. */
export function formatEnsureResult(result: EnsureParallelResult): string {
  const verb = result.changed ? 'enabled now (was off — Finding A self-heal)' : 'already enabled';
  return `project: ${result.projectId}\nparallelEnabled: ${verb}`;
}

async function main(): Promise<void> {
  const baseUrl = await resolveReachableBaseUrl(process.env);
  const i = process.argv.indexOf('--project');
  const projectId = (i !== -1 && process.argv[i + 1]) || process.env.RUNTIME_BRIDGE_AIF_PROJECT_ID;
  const json = process.argv.includes('--json');

  if (!projectId) {
    process.stderr.write('[runtime-bridge] ensure-parallel: missing --project <id> (or $RUNTIME_BRIDGE_AIF_PROJECT_ID)\n');
    process.exit(1);
  }

  let result: EnsureParallelResult;
  try {
    result = await ensureParallelEnabled(baseUrl, projectId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[runtime-bridge] ensure-parallel: ${msg}\n`);
    process.exit(1);
  }

  process.stdout.write((json ? JSON.stringify(result) : formatEnsureResult(result)) + '\n');
  process.exit(0);
}

// Run only as a real entrypoint — importing the module (tests) must not fetch/exit.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    process.stderr.write(`[runtime-bridge] ensure-parallel: unhandled error: ${err}\n`);
    process.exit(1);
  });
}
