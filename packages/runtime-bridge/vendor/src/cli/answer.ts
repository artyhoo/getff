/**
 * CLI answer entrypoint — the "push the resolved answer back + resume" half of the bridge.
 *
 * Usage:
 *   tsx packages/runtime-bridge/src/cli/answer.ts --task <id> --answer "<text>" [--decision request_changes] [--json]
 *   tsx packages/runtime-bridge/src/cli/answer.ts --task <id> --decision approve
 *   tsx packages/runtime-bridge/src/cli/answer.ts --task <id> --decision retry
 *   tsx packages/runtime-bridge/src/cli/answer.ts --task <id> --decision complete_review
 *   tsx packages/runtime-bridge/src/cli/answer.ts --task <id> --answer "<text>" --decision request_review_changes
 *
 * The resolve side of the question-loop: after a human brainstorms a parked
 * task's question(s) in a chat (cli/questions.ts surfaced them), this command
 * pushes the resolution back into aif-handoff and resumes the task so the agent
 * finishes it — removing the "re-open the task in the UI and paste the answer"
 * step (sibling of dispatch.ts → await.ts → questions.ts → answer.ts).
 *
 * S1-verified resume sequence (source-verified via DeepWiki on lee-to/aif-handoff,
 * 4-query convergent — stateMachine.ts `applyHumanTaskEvent`, types.ts `TASK_EVENTS`,
 * routes/tasks.ts, `createTaskCommentSchema`. LIVE E2E pending the §2 prerequisite
 * — see the kickoff). Two load-bearing facts the sequence rests on:
 *   1. aif status is EVENT-only — `POST /tasks/:id/events { event }` drives transitions;
 *      a `PUT { status }` is silently ignored (same fact dispatch.ts step 3 rests on).
 *   2. the answer TEXT rides as a comment whose field is `message` (1..20000 chars);
 *      `request_changes` consumes the LATEST human comment as rework feedback
 *      (planner.ts `comments.slice(-1)`), exactly as the aif web UI does it.
 *
 * Decision → sequence:
 *   request_changes (default): POST /tasks/:id/comments { message }   ← attach answer
 *                              POST /tasks/:id/events   { event: 'request_changes' }
 *                              → done → implementing, reworkRequested:true (aif redoes with the feedback)
 *   approve : POST /tasks/:id/events { event: 'approve_done' }        → done → verified
 *   complete_review        : POST /tasks/:id/events                    → review → done
 *   request_review_changes : POST /comments then POST /events          → review → implementing
 *   retry   : POST /tasks/:id/events { event: 'retry_from_blocked' }  → blocked_external → prior status
 *   resume  : PUT  /tasks/:id { plan+answer, paused:false, blockedReason:null }
 *                              → lifts an A-park; NO event, so it REQUIRES paused:true (A6-6b)
 *
 * Non-destructive (kickoff §4.2 "idempotent/reversible"): only ever creates a
 * comment + dispatches a FORWARD state-machine event — no DELETE, no force-push.
 * A second run on an already-resumed task is rejected by the state machine
 * (4xx → BackendError), never silently duplicated into a destructive op.
 *
 * Config (env, same convention as the siblings):
 *   RUNTIME_BRIDGE_AIF_URL  — base URL (default http://localhost:3009)
 *
 * Flags:
 *   --task <id>      — REQUIRED: the parked task to resolve.
 *   --answer <text>  — the resolution text; REQUIRED for request_changes (attached as a comment).
 *   --decision <d>   — request_changes (default) | approve | retry | resume (A-park only)
 *                      | complete_review | request_review_changes (both `review`-state only).
 *   --json           — print the result as a JSON object.
 *
 * Exit codes:
 *   0 — answer pushed + task resumed.
 *   1 — missing/invalid args, or a REST error (message on stderr).
 *
 * @cc-only-rationale: pure TS over plain HTTP — also callable from the
 *   maintainer's bash smoke-test and from an orchestrator session. No CC-only
 *   primitive, no Superset import, no paid LLM.
 */
import { isMain, parseCliArgs, CliArgError } from './cliEntry.js';
import { BackendError } from '../backend.js';
import {
  getTask,
  putTask,
  postJson,
  getParticipantsModeEnabled,
} from './aifHttp.js';

const DEFAULT_AIF_URL = 'http://localhost:3009';

/**
 * The human resolution decisions accepted by the CLI.
 *
 * The first four target a task in `done`. `complete_review` and `request_review_changes`
 * target one in `review` — the state a MANUAL-REVIEW PARK actually sits in, which until
 * 2026-09-09 no decision here could reach (see {@link resolveStep}).
 */
export type AnswerDecision =
  | 'request_changes'
  | 'approve'
  | 'retry'
  | 'resume'
  | 'complete_review'
  | 'request_review_changes';

/** The valid decisions, in CLI-help order (request_changes is the default). */
export const VALID_DECISIONS: readonly AnswerDecision[] = [
  'request_changes',
  'approve',
  'retry',
  'resume',
  'complete_review',
  'request_review_changes',
];

/** Append a marked OPERATOR ANSWER block to the plan (read by the implementer on the next tick). */
export function appendAnswerToPlan(
  existingPlan: string | null | undefined,
  answer: string,
): string {
  const base = (existingPlan ?? '').trimEnd();
  const block = `\n\n## ✅ OPERATOR ANSWER (resumed)\n\n${answer.trim()}\n`;
  return base + block;
}

/** A decision resolved to its aif-handoff state-machine event + whether the answer rides as a comment. */
export interface ResolveStep {
  /** aif-handoff state-machine event (POST /tasks/:id/events). Source: TASK_EVENTS. */
  event:
    | 'request_changes'
    | 'approve_done'
    | 'retry_from_blocked'
    | 'complete_review'
    | 'request_review_changes';
  /** Whether the answer text MUST be attached as a comment before the event. */
  needsComment: boolean;
}

/**
 * Resolve a decision to its verified event sequence.
 * Source (DeepWiki lee-to/aif-handoff stateMachine.ts / types.ts, and for the review-state
 * pair the running image's own `packages/shared/dist/stateMachine.js:91,100`):
 *   request_changes → done→implementing (answer rides as the latest comment);
 *   approve_done    → done→verified;
 *   retry_from_blocked → blocked_external→prior status;
 *   complete_review → review→done (or →verify when the task has runPostVerify);
 *   request_review_changes → review→implementing, reworkRequested (answer rides as a comment).
 *
 * WHY the review pair exists (2026-09-09): a task handed to a human by the auto-review gate
 * stops in `review`, not `done` (`coordinator.js:442-467` sets executionOwner=human +
 * manualReviewRequired there). `review` accepts ONLY `complete_review` /
 * `request_review_changes`; every done-state event is refused from it with
 * `HTTP 409 {"error":"approve_done is only allowed from done"}` (measured live on task
 * 5dfecf25). So this CLI — the tool whose whole job is releasing parks — could not reach the
 * one state parks occupy, and they accumulated with no exit: 4 parks were still held open
 * weeks after their PRs had merged. The bare `POST /tasks/:id/events` workaround is
 * classifier-blocked by policy, so without these two there is no path at all.
 */
export function resolveStep(decision: AnswerDecision): ResolveStep {
  switch (decision) {
    case 'approve':
      return { event: 'approve_done', needsComment: false };
    case 'complete_review':
      return { event: 'complete_review', needsComment: false };
    case 'request_review_changes':
      return { event: 'request_review_changes', needsComment: true };
    case 'retry':
      return { event: 'retry_from_blocked', needsComment: false };
    case 'resume':
      throw new BackendError(
        'resume is handled by resumePark upstream of resolveStep — not an event decision',
        'dispatch_failed',
        'aif-handoff',
      );
    case 'request_changes':
    default:
      return { event: 'request_changes', needsComment: true };
  }
}

/** Parsed CLI args. `decision` is kept raw so validation (not parsing) rejects bad values. */
export interface AnswerArgs {
  taskId?: string;
  answer?: string;
  decision: string;
  json: boolean;
}

/**
 * Parse CLI args: --task <id>, --answer <text>, --decision <d> (default request_changes), --json.
 * Throws {@link CliArgError} on a malformed invocation — see cliEntry.ts (A6-7).
 */
export function parseAnswerArgs(argv: string[]): AnswerArgs {
  const { values } = parseCliArgs(argv, {
    options: {
      task: { type: 'string' },
      answer: { type: 'string' },
      decision: { type: 'string' },
      json: { type: 'boolean' },
    },
  });
  return {
    taskId: values.task as string | undefined,
    answer: values.answer as string | undefined,
    decision: (values.decision as string | undefined) ?? 'request_changes',
    json: values.json === true,
  };
}

/**
 * Validate parsed args. Returns an error message, or null when valid.
 * Pure (no I/O) so the paired-positive/negative tests can drive it directly.
 * An invalid --decision is an ERROR, never silently defaulted — defaulting an
 * unknown decision to request_changes could re-open a task the human meant to approve.
 */
export function validateAnswerArgs(args: AnswerArgs): string | null {
  if (!args.taskId) return 'missing required --task <id>';
  if (!(VALID_DECISIONS as readonly string[]).includes(args.decision)) {
    return `invalid --decision "${args.decision}" (expected: ${VALID_DECISIONS.join(' | ')})`;
  }
  const needsAnswer = ['request_changes', 'resume', 'request_review_changes'];
  if (needsAnswer.includes(args.decision) && !args.answer?.trim()) {
    return `decision "${args.decision}" requires --answer <text> (the resolution to push back)`;
  }
  return null;
}

/**
 * Attach the human's answer to the task as a comment (POST /tasks/:id/comments { message }).
 * The transport + BackendError mapping live in cli/aifHttp.ts — this file used to carry a
 * verbatim copy of it (S-4).
 */
export async function postComment(
  baseUrl: string,
  taskId: string,
  message: string,
): Promise<void> {
  await postJson(baseUrl, `/tasks/${taskId}/comments`, { message });
}

/**
 * The decisions whose events exist ONLY in aif's human-owner dispatcher
 * (`resolveHumanOwnerAction`). Every other decision targets `done` / `blocked_external`,
 * which the legacy dispatcher serves, so only these two depend on the mode probe below.
 */
export const HUMAN_OWNER_ONLY_DECISIONS: readonly AnswerDecision[] = [
  'complete_review',
  'request_review_changes',
];

/**
 * Refuse a review-state decision the deployment cannot serve, naming the cause and the
 * levers that DO exist.
 *
 * `resolveTaskAction` picks `resolveHumanOwnerAction` — the only dispatcher carrying
 * `complete_review` / `request_review_changes` — solely when participants mode is on. With
 * it off, every event resolves through `resolveLegacyAction`, whose cases cover `backlog`,
 * `plan_ready`, `done` and `blocked_external` and NOTHING from `review`; the request falls
 * to its `default:` and comes back as `409 {"error":"Unknown task event"}`, which names
 * neither the mode nor a way forward. Measured 2026-09-09 against two live parks, one
 * ai-owned and one human-owned — the owner is not the gate, the mode is.
 */
export async function assertReviewEventReachable(
  baseUrl: string,
  decision: AnswerDecision,
): Promise<void> {
  if (await getParticipantsModeEnabled(baseUrl)) return;
  throw new BackendError(
    `"${decision}" cannot be dispatched: this aif deployment runs with participants mode OFF ` +
      `(GET /auth/session → participantsModeEnabled:false), so every task event resolves through ` +
      `the legacy dispatcher, which has no event out of "review" for any owner — the API would ` +
      `answer 409 "Unknown task event". A manual-review park has two exits here: hand it back to ` +
      `the coordinator (POST /tasks/:id/handoff {"executionOwner":"ai"} — legal from review, and ` +
      `the coordinator's candidate query takes ai-owned review tasks, so its auto-review re-runs ` +
      `and can close the task itself), or DELETE the task outright (destructive, operator GO).`,
    'dispatch_failed',
    'aif-handoff',
  );
}

/** Dispatch a forward state-machine event (POST /tasks/:id/events { event }). */
export async function postEvent(
  baseUrl: string,
  taskId: string,
  event: string,
): Promise<void> {
  await postJson(baseUrl, `/tasks/${taskId}/events`, { event });
}

/**
 * Resume an A-park (paused mid-implementation): read the plan, inject the answer
 * under an OPERATOR ANSWER block, and PUT { plan, paused:false, blockedReason:null }.
 * The implementer re-reads the plan on its next tick (spec §3 resume / A).
 */
export async function resumePark(
  baseUrl: string,
  taskId: string,
  answer: string,
): Promise<PushResult> {
  const task = await getTask(baseUrl, taskId);
  // A6-6b guard (#1597 ledger, the half #1625 deferred): `resume` dispatches NO
  // state-machine event — it is a bare PUT that lifts `paused`. On a task that is not
  // paused there is nothing to lift, so the call degrades to a silent plan rewrite: the
  // operator's answer is appended to the plan of a task whose status nothing changed, no
  // worker re-reads it, and the CLI still prints its success line. That is the easy
  // misroute in the park-type taxonomy (dispatcher SKILL.md §3) — a B-park (blockedReason
  // set, paused false) and an A-park differ only by `paused`, and `resume` is correct for
  // exactly one of them. Refuse, naming the decisions that DO move a non-paused task.
  // Deliberately here and not in pushAnswer: request_changes / approve / retry are
  // event-driven and legitimately act on non-paused tasks (the /pipeline done→REVISE flow).
  if (task.paused !== true) {
    throw new BackendError(
      `task ${taskId} is not paused (status=${task.status}) — "resume" only lifts an A-park ` +
        `(paused:true + an OPEN QUESTION block in the plan) and dispatches no state-machine ` +
        `event, so on this task it would rewrite the plan and change nothing else, losing the ` +
        `answer. Use --decision request_changes (or retry for blocked_external) instead.`,
      'dispatch_failed',
      'aif-handoff',
    );
  }
  const plan = appendAnswerToPlan(task.plan, answer);
  await putTask(baseUrl, taskId, { plan, paused: false, blockedReason: null });
  return {
    taskId,
    decision: 'resume',
    event: 'unpause (PUT paused=false)',
    commented: false,
  };
}

/** The actions performed by pushAnswer, returned for the CLI report. */
export interface PushResult {
  taskId: string;
  decision: AnswerDecision;
  event: string;
  commented: boolean;
}

/**
 * Push a resolved answer back and resume the task via the S1-verified sequence.
 * For request_changes the answer rides as a comment FIRST (so it is the latest
 * comment the agent reworks against), then the event re-opens the task. For
 * approve/retry only the forward event is sent.
 */
export async function pushAnswer(
  baseUrl: string,
  taskId: string,
  decision: AnswerDecision,
  answer: string | undefined,
): Promise<PushResult> {
  if (decision === 'resume') {
    if (!answer || !answer.trim()) {
      throw new BackendError(
        `decision "resume" requires answer text`,
        'dispatch_failed',
        'aif-handoff',
      );
    }
    return resumePark(baseUrl, taskId, answer.trim());
  }
  const step = resolveStep(decision);
  // Probe BEFORE any write: a review-state event this deployment cannot serve must not
  // leave a comment behind as the only trace of a call that was always going to 409.
  if (HUMAN_OWNER_ONLY_DECISIONS.includes(decision)) {
    await assertReviewEventReachable(baseUrl, decision);
  }
  let commented = false;
  if (step.needsComment) {
    if (!answer || !answer.trim()) {
      throw new BackendError(
        `decision "${decision}" requires answer text to attach as a comment`,
        'dispatch_failed',
        'aif-handoff',
      );
    }
    await postComment(baseUrl, taskId, answer.trim());
    commented = true;
  }
  await postEvent(baseUrl, taskId, step.event);
  return { taskId, decision, event: step.event, commented };
}

/** Render a PushResult as a human-readable confirmation. */
export function formatResult(result: PushResult): string {
  const commentLine = result.commented
    ? 'comment: answer attached (latest)\n'
    : '';
  return (
    `task:     ${result.taskId}\n` +
    `decision: ${result.decision}\n` +
    commentLine +
    `event:    ${result.event} (dispatched)`
  );
}

async function main(): Promise<void> {
  const baseUrl = process.env.RUNTIME_BRIDGE_AIF_URL || DEFAULT_AIF_URL;
  let args: AnswerArgs;
  try {
    args = parseAnswerArgs(process.argv.slice(2));
  } catch (err) {
    const msg = err instanceof CliArgError ? err.message : String(err);
    process.stderr.write(`[runtime-bridge] answer: ${msg}\n`);
    process.exit(1);
  }

  const argError = validateAnswerArgs(args);
  if (argError) {
    process.stderr.write(`[runtime-bridge] answer: ${argError}\n`);
    process.exit(1);
  }

  let result: PushResult;
  try {
    result = await pushAnswer(
      baseUrl,
      args.taskId!,
      args.decision as AnswerDecision,
      args.answer,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `[runtime-bridge] answer: failed to push answer: ${msg}\n`,
    );
    process.exit(1);
  }

  if (args.json) {
    process.stdout.write(JSON.stringify(result) + '\n');
  } else {
    process.stdout.write(formatResult(result) + '\n');
  }
  process.exit(0);
}

// Run only as a real entrypoint — importing the module (e.g. from tests) must
// NOT trigger the fetch + process.exit side effects. realpath BOTH sides
// (cliEntry.isMain): a symlinked invocation path used to silently no-op (A6-1).
if (isMain(import.meta.url)) {
  main().catch((err) => {
    process.stderr.write(`[runtime-bridge] answer: unhandled error: ${err}\n`);
    process.exit(1);
  });
}
