/**
 * start-reviewed.ts — guarded start of a SCOPED task after its effective-plan review.
 *
 * Usage:
 *   tsx packages/runtime-bridge/src/cli/start-reviewed.ts --task <id> --review <plan-review-path> [--json]
 *
 * The implementation half of the scoped route (intent-first-result §3/§4): a task
 * claimed with `autoMode:false` reaches `plan_ready` where the auto-queue cannot
 * advance it. This CLI is the ONLY bridge path that posts `start_implementation`,
 * and it refuses unless ALL of the following hold:
 *
 *   1. the task's PERSISTED description declares an intent-contract scope (this CLI
 *      exists for exactly those tasks; unscoped tasks start through the ordinary
 *      autoMode path and invalid scopes fail closed — never ordinary);
 *   2. the task state is `plan_ready` (implementation is actually waiting) and the
 *      claim really was scoped (`autoMode:false` — an auto task needs no review to
 *      start, and starting one here would bypass nothing and double-start it);
 *   3. an authorized PlanReview record (--review) binds: the task ID, the SAME
 *      contract the description declares, the EXACT effective-plan bytes digest, the
 *      reviewed task pre-image digest, and the owner/decision reference — a digest
 *      alone grants no authority; classification must be `within-contract` (S1 holds
 *      contract-revision / product-decision continuations);
 *   4. the task row is RE-READ immediately before the event and revalidated — a plan
 *      or pre-image that changed between validation and start HOLDS (never execute
 *      on the kickoff digest alone).
 *
 * Every refusal exits 2 with NO event posted; the task stays paused at plan_ready.
 *
 * @cc-only-rationale: pure TS over the existing REST event path — no CC-only primitive.
 */
import { isMain, parseCliArgs, CliArgError } from './cliEntry.js';
import { BackendError } from '../backend.js';
import { enforceAnswerScope } from '../resultReview.js';
import { getTask, postJson } from './aifHttp.js';

const DEFAULT_AIF_URL = 'http://localhost:3009';

export interface StartReviewedArgs {
  taskId?: string;
  review?: string;
  json: boolean;
}

export function parseStartReviewedArgs(argv: string[]): StartReviewedArgs {
  const { values } = parseCliArgs(argv, {
    options: {
      task: { type: 'string' },
      review: { type: 'string' },
      json: { type: 'boolean' },
    },
  });
  return {
    taskId: values.task as string | undefined,
    review: values.review as string | undefined,
    json: values.json === true,
  };
}

export function validateStartReviewedArgs(
  args: StartReviewedArgs,
): string | null {
  if (!args.taskId) return 'missing required --task <id>';
  if (!args.review)
    return 'missing required --review <plan-review-path> (a scoped start needs an authorized PlanReview record)';
  return null;
}

export interface StartReviewedResult {
  taskId: string;
  event: 'start_implementation';
  reviewPath: string;
}

/**
 * Validate + start one scoped task. Throws `BackendError('spec_invalid', 'start-reviewed')`
 * on every hold; the event POST is the ONLY effect, and it fires only after the re-read
 * revalidation passes.
 */
export async function startReviewed(
  baseUrl: string,
  taskId: string,
  reviewPath: string,
): Promise<StartReviewedResult> {
  // (1)+(3) first pass: declared scope + PlanReview binding against the current row.
  const task = await getTask(baseUrl, taskId);
  const scope = enforceAnswerScope(task, {
    reviewPath,
    backend: 'start-reviewed',
  });
  if (!scope.scoped) {
    throw new BackendError(
      `task ${taskId} declares no intent-contract scope — start-reviewed is the scoped route only; unscoped tasks start through the ordinary autoMode path`,
      'spec_invalid',
      'start-reviewed',
    );
  }
  // (2) the task must actually be waiting for a reviewed start.
  if (task.status !== 'plan_ready') {
    throw new BackendError(
      `task ${taskId} is in state "${task.status}", not "plan_ready" — there is no reviewed plan to start`,
      'spec_invalid',
      'start-reviewed',
    );
  }
  if (task.autoMode !== false) {
    throw new BackendError(
      `task ${taskId} is not a scoped claim (autoMode:${String(task.autoMode)}) — refusing to start it through the reviewed route`,
      'spec_invalid',
      'start-reviewed',
    );
  }
  // (4) re-read immediately before the event; changed plan/pre-image ⇒ hold.
  const fresh = await getTask(baseUrl, taskId);
  enforceAnswerScope(fresh, { reviewPath, backend: 'start-reviewed' });
  if (fresh.status !== 'plan_ready' || fresh.autoMode !== false) {
    throw new BackendError(
      `task ${taskId} changed state between validation and start (status=${String(fresh.status)}, autoMode=${String(fresh.autoMode)}) — holding`,
      'spec_invalid',
      'start-reviewed',
    );
  }
  await postJson(baseUrl, `/tasks/${taskId}/events`, {
    event: 'start_implementation',
  });
  return { taskId, event: 'start_implementation', reviewPath };
}

async function main(): Promise<void> {
  const baseUrl = process.env['RUNTIME_BRIDGE_AIF_URL'] || DEFAULT_AIF_URL;
  let args: StartReviewedArgs;
  try {
    args = parseStartReviewedArgs(process.argv.slice(2));
  } catch (err) {
    const msg = err instanceof CliArgError ? err.message : String(err);
    process.stderr.write(`[runtime-bridge] start-reviewed: ${msg}\n`);
    process.exit(1);
  }
  const argError = validateStartReviewedArgs(args);
  if (argError) {
    process.stderr.write(`[runtime-bridge] start-reviewed: ${argError}\n`);
    process.exit(1);
  }

  try {
    // Fail closed when the owner configuration is absent: an unconfigurable check
    // holds the task, it never opens the gate.
    const result = await startReviewed(baseUrl, args.taskId!, args.review!);
    if (args.json) {
      process.stdout.write(JSON.stringify(result) + '\n');
    } else {
      process.stdout.write(
        `task:     ${result.taskId}\nevent:    ${result.event} (dispatched)\nreview:   ${result.reviewPath}\n`,
      );
    }
  } catch (err) {
    if (err instanceof BackendError) {
      // A hold, not a crash: name what was missing and leave the task paused.
      process.stderr.write(
        `[runtime-bridge] start-reviewed: HELD (${err.code}): ${err.message}\n`,
      );
      process.exit(2);
    }
    process.stderr.write(
      `[runtime-bridge] start-reviewed: failed: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(1);
  }
  process.exit(0);
}

// Run only as a real entrypoint — importing the module (e.g. from tests) must NOT
// trigger the fetch + process.exit side effects (shared cliEntry realpath guard).
if (isMain(import.meta.url)) {
  main().catch((err) => {
    process.stderr.write(
      `[runtime-bridge] start-reviewed: unhandled error: ${err}\n`,
    );
    process.exit(1);
  });
}
