// packages/runtime-bridge/src/cli/park.ts
/**
 * CLI park entrypoint — the agent-side "I hit a hard fork, stop and ask" half.
 *
 * Usage (the autonomous agent runs this on a genuine BLOCKING fork it cannot default):
 *   tsx packages/runtime-bridge/src/cli/park.ts --task <id> --question "<fork + options>"
 *   # --task defaults to $HANDOFF_TASK_ID (set in the aif agent context).
 *
 * Mechanism (spec §2 F2/F3/F5): PUT /tasks/:id { paused:true, blockedReason, plan }.
 *   - paused:true is THE stop — the coordinator candidate query filters paused=false,
 *     so the agent is NOT re-picked (blockedReason ALONE does NOT stop it — F2).
 *   - blockedReason carries the question + makes questions.ts isParked() true.
 *   - plan gains a "## ⏸ OPEN QUESTION" anchor the resume answer is injected under.
 *
 * Soft/advisory questions do NOT use this — they already flow non-blocking to chat.
 * This is ONLY for a hard fork that blocks continuing the implementation.
 *
 * Config: base URL precedence RUNTIME_BRIDGE_AIF_URL ?? API_BASE_URL ?? http://localhost:3009.
 *   park.ts is the ONLY CLI run from INSIDE the aif agent container, which exposes the
 *   service as API_BASE_URL=http://api:3009 (localhost is unreachable there). The host
 *   orchestrator sets neither and gets the localhost default. (qloop-ux-probe Finding C.)
 * Exit codes: 0 parked; 1 bad args or REST error (message on stderr).
 *
 * @cc-only-rationale: pure TS over plain HTTP — also callable from a smoke-test
 *   and an orchestrator session. No CC-only primitive, no Superset import, no paid LLM.
 */
import { isMain, parseCliArgs, CliArgError } from './cliEntry.js';
import { getTask, putTask, type AifTaskFull } from './aifHttp.js';
import { OPEN_QUESTION_ANCHOR } from './openQuestion.js';

const DEFAULT_AIF_URL = 'http://localhost:3009';
const DOCKER_SERVICE_URL = 'http://api:3009';

/**
 * Resolve the aif-handoff base URL with container-awareness.
 * Precedence: RUNTIME_BRIDGE_AIF_URL (explicit override) → API_BASE_URL (set inside the
 * aif agent container, e.g. http://api:3009) → http://localhost:3009 (host orchestrator).
 * Without the API_BASE_URL fallback, park() is unreachable from inside the container
 * (localhost:3009 → connection refused), so the agent cannot park itself — Finding C.
 */
export function resolveAifBaseUrl(env: NodeJS.ProcessEnv): string {
  return env.RUNTIME_BRIDGE_AIF_URL || env.API_BASE_URL || DEFAULT_AIF_URL;
}

/**
 * Ordered, de-duplicated candidate base URLs to probe. Finding C-2 (qloop-ux-probe
 * live re-run): the aif agent runs park.ts in a Bash-tool subprocess whose env is
 * SCRUBBED of API_BASE_URL, so resolveAifBaseUrl() alone falls back to localhost —
 * unreachable inside the container. We therefore probe explicit env vars first, THEN
 * the docker-compose service name (reachable in the agent container) and the host
 * default (reachable from an orchestrator session), so park works from either context
 * even when no env survives.
 */
export function candidateBaseUrls(env: NodeJS.ProcessEnv): string[] {
  const ordered = [
    env.RUNTIME_BRIDGE_AIF_URL,
    env.API_BASE_URL,
    DOCKER_SERVICE_URL,
    DEFAULT_AIF_URL,
  ].filter((u): u is string => typeof u === 'string' && u.length > 0);
  return [...new Set(ordered)];
}

type FetchLike = (url: string, init?: { method?: string }) => Promise<unknown>;

/**
 * First candidate whose GET /tasks is reachable (ANY HTTP response = reachable; only a
 * connection failure rejects). Falls back to the last candidate if none respond, so a
 * caller still gets a deterministic URL (and a clear downstream error) rather than throw.
 */
export async function resolveReachableBaseUrl(
  env: NodeJS.ProcessEnv,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
): Promise<string> {
  const candidates = candidateBaseUrls(env);
  for (const base of candidates) {
    try {
      await fetchImpl(`${base}/tasks`, { method: 'GET' });
      return base; // any response (even 404) means the host is reachable
    } catch {
      // connection failure (DNS / refused) — try the next candidate
    }
  }
  return candidates[candidates.length - 1] ?? DEFAULT_AIF_URL;
}

export interface ParkArgs {
  taskId?: string;
  question?: string;
  json: boolean;
}

/**
 * Parse CLI args: --task <id> (else $HANDOFF_TASK_ID), --question <text>, --json.
 * Throws {@link CliArgError} on a malformed invocation (unknown flag, a flag whose
 * value is the next flag) rather than guessing — see cliEntry.ts (A6-7).
 */
export function parseParkArgs(
  argv: string[],
  env: NodeJS.ProcessEnv,
): ParkArgs {
  const { values } = parseCliArgs(argv, {
    options: {
      task: { type: 'string' },
      question: { type: 'string' },
      json: { type: 'boolean' },
    },
  });
  return {
    taskId:
      (values.task as string | undefined) ?? env.HANDOFF_TASK_ID ?? undefined,
    question: values.question as string | undefined,
    json: values.json === true,
  };
}

/** Validate parsed args. Returns an error message, or null when valid. */
export function validateParkArgs(args: ParkArgs): string | null {
  if (!args.taskId) return 'missing required --task <id> (or $HANDOFF_TASK_ID)';
  if (!args.question?.trim())
    return 'missing required --question <text> (the fork + options)';
  return null;
}

/** Append a marked OPEN QUESTION block to the existing plan (anchor for the resume answer). */
export function buildOpenQuestionPlan(
  existingPlan: string | null | undefined,
  question: string,
): string {
  const base = (existingPlan ?? '').trimEnd();
  const block = `\n\n${OPEN_QUESTION_ANCHOR} (awaiting operator)\n\n${question.trim()}\n`;
  return base + block;
}

export interface ParkResult {
  taskId: string;
  paused: true;
  blockedReason: string;
  /** Set when the task was ALREADY parked on this exact question — no PUT was issued (A6-6). */
  alreadyParked?: true;
}

/**
 * True when the task is already stopped on THIS question: paused, and the most recent
 * OPEN QUESTION block in the plan carries the same text. That is the retry shape — an
 * agent re-running park, or a night loop re-entering the same fork.
 */
function isAlreadyParkedOn(task: AifTaskFull, question: string): boolean {
  if (task.paused !== true || typeof task.plan !== 'string') return false;
  const idx = task.plan.lastIndexOf(OPEN_QUESTION_ANCHOR);
  if (idx === -1) return false;
  const latest = task.plan
    .slice(idx + OPEN_QUESTION_ANCHOR.length)
    .replace(/^[^\n]*\n/, '')
    .trim();
  return latest === question;
}

/**
 * Park the task on a hard fork: read the current plan, append the OPEN QUESTION
 * anchor, and PUT { paused:true, blockedReason, plan }. paused:true is the stop (F3).
 */
export async function parkTask(
  baseUrl: string,
  taskId: string,
  question: string,
): Promise<ParkResult> {
  const reason = question.trim();
  const task = await getTask(baseUrl, taskId);
  // Finding F guard (qloop-ux-probe 2026-06-01): a park AFTER the implement→review
  // transition leaves status=review, paused=true — but aif has zero human re-entry from
  // `review` (HUMAN_ACTIONS_BY_STATUS.review = []), so resume runs the review pipeline to
  // `done` WITHOUT re-implementing the injected answer, and the next chain question never
  // parks (live: task ba3b4bf6 answered c1 → done, c2 silently lost). Refuse the park here
  // so the silent loss becomes a loud, actionable error rather than a misleading "resolved".
  if (task.status === 'review') {
    throw new Error(
      `cannot park task ${taskId} at status=review — aif resumes a review-stage task to ` +
        `"done" without re-implementing the answer (the next chain question is never parked). ` +
        `Park before the implement→review transition, or wait until status=done and use ` +
        `answer.ts (request_changes).`,
    );
  }
  // A6-6: a repeat park of the SAME question is a no-op. Without this, a retried park
  // appended a second identical OPEN QUESTION block and overwrote blockedReason — the
  // operator saw one fork twice, and the stop it would have set is already in place.
  if (isAlreadyParkedOn(task, reason)) {
    return { taskId, paused: true, blockedReason: reason, alreadyParked: true };
  }
  const plan = buildOpenQuestionPlan(task.plan, reason);
  await putTask(baseUrl, taskId, { paused: true, blockedReason: reason, plan });
  return { taskId, paused: true, blockedReason: reason };
}

/** Render a ParkResult as a human-readable confirmation. */
export function formatParkResult(result: ParkResult): string {
  const state = result.alreadyParked
    ? 'paused=true (ALREADY parked on this question — no change made)'
    : 'paused=true';
  return `task:   ${result.taskId}\nparked: ${state}\nreason: ${result.blockedReason}`;
}

async function main(): Promise<void> {
  // Args BEFORE the network probe: a malformed invocation must not spend a
  // multi-candidate reachability probe before it is rejected.
  let args: ParkArgs;
  try {
    args = parseParkArgs(process.argv.slice(2), process.env);
  } catch (err) {
    const msg = err instanceof CliArgError ? err.message : String(err);
    process.stderr.write(`[runtime-bridge] park: ${msg}\n`);
    process.exit(1);
  }

  const argError = validateParkArgs(args);
  if (argError) {
    process.stderr.write(`[runtime-bridge] park: ${argError}\n`);
    process.exit(1);
  }

  const baseUrl = await resolveReachableBaseUrl(process.env);

  let result: ParkResult;
  try {
    result = await parkTask(baseUrl, args.taskId!, args.question!);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `[runtime-bridge] park: failed to park task: ${msg}\n`,
    );
    process.exit(1);
  }

  process.stdout.write(
    (args.json ? JSON.stringify(result) : formatParkResult(result)) + '\n',
  );
  process.exit(0);
}

// Run only as a real entrypoint — importing the module (tests) must not fetch/exit.
// realpath BOTH sides (cliEntry.isMain): a symlinked invocation path used to make this
// false, so the CLI exited 0 having done nothing (A6-1).
if (isMain(import.meta.url)) {
  main().catch((err) => {
    process.stderr.write(`[runtime-bridge] park: unhandled error: ${err}\n`);
    process.exit(1);
  });
}
