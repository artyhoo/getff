/**
 * CLI answer entrypoint — the "push the resolved answer back + resume" half of the bridge.
 *
 * Usage:
 *   tsx packages/runtime-bridge/src/cli/answer.ts --task <id> --answer "<text>" [--decision request_changes] [--json]
 *   tsx packages/runtime-bridge/src/cli/answer.ts --task <id> --decision approve
 *   tsx packages/runtime-bridge/src/cli/answer.ts --task <id> --decision retry
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
 *   retry   : POST /tasks/:id/events { event: 'retry_from_blocked' }  → blocked_external → prior status
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
 *   --decision <d>   — request_changes (default) | approve | retry.
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
import { getTask, putTask, postJson } from './aifHttp.js';

const DEFAULT_AIF_URL = 'http://localhost:3009';

/** The four human resolution decisions accepted by the CLI. */
export type AnswerDecision = 'request_changes' | 'approve' | 'retry' | 'resume';

/** The valid decisions, in CLI-help order (request_changes is the default). */
export const VALID_DECISIONS: readonly AnswerDecision[] = [
  'request_changes',
  'approve',
  'retry',
  'resume',
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
  event: 'request_changes' | 'approve_done' | 'retry_from_blocked';
  /** Whether the answer text MUST be attached as a comment before the event. */
  needsComment: boolean;
}

/**
 * Resolve a decision to its S1-verified event sequence.
 * Source (DeepWiki lee-to/aif-handoff stateMachine.ts / types.ts):
 *   request_changes → done→implementing (answer rides as the latest comment);
 *   approve_done    → done→verified;
 *   retry_from_blocked → blocked_external→prior status.
 */
export function resolveStep(decision: AnswerDecision): ResolveStep {
  switch (decision) {
    case 'approve':
      return { event: 'approve_done', needsComment: false };
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
  if (
    (args.decision === 'request_changes' || args.decision === 'resume') &&
    !args.answer?.trim()
  ) {
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
