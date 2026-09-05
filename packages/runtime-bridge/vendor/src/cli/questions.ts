/**
 * CLI questions entrypoint — the "parked questions" collector half of the bridge.
 *
 * Usage:
 *   tsx packages/runtime-bridge/src/cli/questions.ts [--project <id>] [--json]
 *
 * Closes the human-in-the-loop side: when an aif agent hits a genuine fork it
 * parks the task for human input (manualReviewRequired / blocked_external /
 * a blockedReason note) rather than guessing. This command pulls every such
 * parked task from the aif-handoff REST API and prints them in one place so a
 * human can resolve them in a single pass — removing the "scan the UI for stuck
 * tasks" step (sibling of dispatch.ts → await.ts → questions.ts).
 *
 * Config (env, same convention as the siblings):
 *   RUNTIME_BRIDGE_AIF_URL         — base URL (default http://localhost:3009)
 *   RUNTIME_BRIDGE_AIF_PROJECT_ID  — optional project filter (overridable by --project)
 *
 * A task is "parked / awaiting human" when ANY of:
 *   - manualReviewRequired === true, OR
 *   - status === 'blocked_external', OR
 *   - blockedReason is a non-empty string, OR
 *   - paused === true AND the plan contains the OPEN_QUESTION_ANCHOR
 *     (mid-flight park whose blockedReason was cleared by implementing→review).
 *
 * Flags:
 *   --project <id>  — filter to one projectId (overrides RUNTIME_BRIDGE_AIF_PROJECT_ID)
 *   --json          — print the selected tasks as a JSON array (for piping into a chat)
 *
 * Exit codes:
 *   0 — success, even when zero tasks are parked.
 *   1 — fetch/parse error (message on stderr).
 *
 * @cc-only-rationale: pure TS over plain HTTP — also callable from the
 *   maintainer's bash smoke-test and from an orchestrator session. No CC-only
 *   primitive, no Superset import, no paid LLM.
 */
import { isMain, parseCliArgs, CliArgError } from './cliEntry.js';
import { OPEN_QUESTION_ANCHOR } from './openQuestion.js';

const DEFAULT_AIF_URL = 'http://localhost:3009';

/** The subset of an aif-handoff task object this CLI reads (from GET /tasks). */
interface AifTask {
  id: string;
  title: string;
  status: string;
  manualReviewRequired?: boolean;
  blockedReason?: string | null;
  reviewComments?: string;
  projectId?: string;
  /** Both returned by GET /tasks (no extra HTTP) — the durable signals of a
   * mid-flight park whose blockedReason was cleared by implementing→review. */
  plan?: string | null;
  paused?: boolean;
}

interface QuestionsArgs {
  projectId?: string;
  json: boolean;
}

/**
 * Parse CLI args: --project <id> (overrides env) and --json.
 * Throws {@link CliArgError} on a malformed invocation — see cliEntry.ts (A6-7).
 */
export function parseQuestionsArgs(
  argv: string[],
  env: NodeJS.ProcessEnv,
): QuestionsArgs {
  const { values } = parseCliArgs(argv, {
    options: { project: { type: 'string' }, json: { type: 'boolean' } },
  });
  return {
    projectId:
      (values.project as string | undefined) ??
      env.RUNTIME_BRIDGE_AIF_PROJECT_ID ??
      undefined,
    json: values.json === true,
  };
}

/**
 * Whether a task is parked / awaiting human input.
 * Source: kickoff §4 — manualReviewRequired OR status==='blocked_external'
 *   OR a non-empty blockedReason — PLUS the mid-flight-park case below.
 *
 * Mid-flight park (Option A fix): park.ts sets paused:true and appends the
 * OPEN_QUESTION_ANCHOR to the plan, but a normal implementing→review transition
 * clears blockedReason (and leaves manualReviewRequired false / status 'review').
 * paused:true and the plan anchor both survive, so detect the park on those.
 * Require the CONJUNCTION (paused === true AND the anchor is present), never
 * paused alone, so an operator who manually pauses an unrelated task is not
 * over-matched.
 */
export function isParked(task: AifTask): boolean {
  if (task.manualReviewRequired === true) return true;
  if (task.status === 'blocked_external') return true;
  if (
    typeof task.blockedReason === 'string' &&
    task.blockedReason.trim().length > 0
  )
    return true;
  if (
    task.paused === true &&
    typeof task.plan === 'string' &&
    task.plan.includes(OPEN_QUESTION_ANCHOR)
  ) {
    return true;
  }
  return false;
}

/**
 * Select the parked tasks, optionally filtered to one projectId.
 * Pure (no I/O) so the paired-positive/negative tests can drive it directly.
 */
export function selectParked(tasks: AifTask[], projectId?: string): AifTask[] {
  return tasks.filter((t) => {
    if (projectId !== undefined && t.projectId !== projectId) return false;
    return isParked(t);
  });
}

/**
 * Extract the question a mid-flight park appended to the plan under
 * OPEN_QUESTION_ANCHOR. park.ts writes `${ANCHOR} (awaiting operator)\n\n<question>`,
 * so we return the text after the anchor LINE (the most recent anchor), or null when
 * the plan has no anchor / no body. This recovers the question text for a mid-flight
 * park whose ephemeral blockedReason was wiped by implementing→review (Finding E).
 */
export function extractOpenQuestion(
  plan: string | null | undefined,
): string | null {
  if (typeof plan !== 'string') return null;
  const idx = plan.lastIndexOf(OPEN_QUESTION_ANCHOR);
  if (idx === -1) return null;
  // Drop the remainder of the anchor line (e.g. " (awaiting operator)"), then trim.
  const body = plan
    .slice(idx + OPEN_QUESTION_ANCHOR.length)
    .replace(/^[^\n]*\n/, '')
    .trim();
  return body.length > 0 ? body : null;
}

const REASON_EXCERPT_CAP = 300;
const excerpt = (s: string): string =>
  s.length > REASON_EXCERPT_CAP ? `${s.slice(0, REASON_EXCERPT_CAP)}…` : s;

/**
 * The human-readable parked reason, in precedence order:
 *   1. blockedReason (the original park reason — most precise),
 *   2. the OPEN QUESTION text recovered from the plan (mid-flight park whose
 *      blockedReason was wiped — Finding E; preferred over a review excerpt because
 *      it IS the question, not a review byproduct),
 *   3. a reviewComments excerpt,
 *   4. "(no reason recorded)".
 */
export function parkedReason(task: AifTask): string {
  if (
    typeof task.blockedReason === 'string' &&
    task.blockedReason.trim().length > 0
  ) {
    return task.blockedReason.trim();
  }
  const fromPlan = extractOpenQuestion(task.plan);
  if (fromPlan) return excerpt(fromPlan);
  if (
    typeof task.reviewComments === 'string' &&
    task.reviewComments.trim().length > 0
  ) {
    return excerpt(task.reviewComments.trim());
  }
  return '(no reason recorded)';
}

/**
 * Brainstorm-first nudge appended to a NON-EMPTY parked list (design spec §3.4).
 * This is the aif-pull channel companion to ask-question-reminder.sh §3.3: any
 * aif design/strategy fork I read here should go through superpowers:brainstorming
 * before I relay it, not get echoed as a bare card. Prose nudge, not a gate —
 * the channel cannot tell a design fork from a quick A/B. The empty case is
 * deliberately left untouched (nothing to brainstorm about).
 */
const BRAINSTORM_FOOTER =
  '⚠ Если среди этих есть развилка о дизайне/стратегии — открой ' +
  '`superpowers:brainstorming` ПЕРЕД ответом (исследуй → рекомендация с ' +
  'аргументами), не релей голой карточкой.';

/** Render the selected tasks as a human-readable block list. */
export function formatHuman(tasks: AifTask[]): string {
  if (tasks.length === 0) return 'No parked questions.';
  const body = tasks
    .map((t) =>
      [
        `id:     ${t.id}`,
        `title:  ${t.title}`,
        `status: ${t.status}`,
        `reason: ${parkedReason(t)}`,
      ].join('\n'),
    )
    .join('\n\n');
  return `${body}\n\n${BRAINSTORM_FOOTER}`;
}

/** Fetch the full task list from the aif-handoff REST API (GET /tasks → array). */
export async function fetchTasks(baseUrl: string): Promise<AifTask[]> {
  const url = `${baseUrl}/tasks`;
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    throw new Error(`GET ${url} returned HTTP ${res.status}`);
  }
  const json: unknown = await res.json();
  if (!Array.isArray(json)) {
    throw new Error(`GET ${url} did not return a JSON array`);
  }
  return json as AifTask[];
}

async function main(): Promise<void> {
  const baseUrl = process.env.RUNTIME_BRIDGE_AIF_URL || DEFAULT_AIF_URL;
  let projectId: string | undefined;
  let json = false;
  try {
    ({ projectId, json } = parseQuestionsArgs(
      process.argv.slice(2),
      process.env,
    ));
  } catch (err) {
    const msg = err instanceof CliArgError ? err.message : String(err);
    process.stderr.write(`[runtime-bridge] questions: ${msg}\n`);
    process.exit(1);
  }

  let tasks: AifTask[];
  try {
    tasks = await fetchTasks(baseUrl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `[runtime-bridge] questions: failed to fetch parked tasks: ${msg}\n`,
    );
    process.exit(1);
  }

  const parked = selectParked(tasks, projectId);

  if (json) {
    process.stdout.write(JSON.stringify(parked) + '\n');
  } else {
    process.stdout.write(formatHuman(parked) + '\n');
  }
  process.exit(0);
}

// Run only as a real entrypoint — importing the module (e.g. from tests) must
// NOT trigger the fetch + process.exit side effects. realpath BOTH sides
// (cliEntry.isMain): a symlinked invocation path used to silently no-op (A6-1).
if (isMain(import.meta.url)) {
  main().catch((err) => {
    process.stderr.write(
      `[runtime-bridge] questions: unhandled error: ${err}\n`,
    );
    process.exit(1);
  });
}
