/**
 * CLI await/status entrypoint — the result read-back half of the bridge.
 *
 * Usage:
 *   tsx packages/runtime-bridge/src/cli/await.ts <taskId> [--timeout-ms N]
 *   tsx packages/runtime-bridge/src/cli/await.ts <taskId> --once
 *
 * Closes the "результат назад" loop: dispatch.ts fires the task (fire-and-forget,
 * fast — it runs inside a PostToolUse hook that must not block); this command is
 * run afterwards to watch the task to a terminal state and print the result,
 * removing the manual "go check aif-handoff's UI" step.
 *
 * Modes:
 *   default  — block on awaitDone (WebSocket status stream) until the task is
 *              done/verified (success) or blocked_external (resolves, !success),
 *              then print the TaskResult as JSON. --timeout-ms bounds the wait.
 *   --once   — non-blocking getStatus snapshot (point-in-time), print + exit.
 *
 * Backend: resolved the same way as dispatch (RUNTIME_BRIDGE_MODE + available()).
 * The handle is reconstructed from the taskId argument — backend.name supplies
 * the handle.backend tag (aif-handoff uses taskId only; manual uses it for the
 * /tmp response-file path).
 *
 * Exit codes:
 *   default (await): 0 = terminal success (done/verified); 1 = non-success
 *     (blocked_external) / timeout / error.
 *   --once (snapshot): 0 unless the backend reports an 'error' state. A still-
 *     running task (pending/running) also exits 0 — a snapshot is not a verdict;
 *     use the default (await) mode when you need a terminal success/fail code.
 * (Distinct from dispatch.ts which always exits 0 — await is a foreground command
 * the operator/orchestrator runs, so a real exit code is useful in scripts.)
 *
 * NOTE: in default (await) mode with NO --timeout-ms, this BLOCKS until the task
 * reaches a terminal state. For long autonomous runs that is intended; if the
 * backend resolves to ManualBackend it polls a /tmp response file indefinitely.
 * A startup notice is printed to stderr; pass --timeout-ms to bound the wait.
 *
 * @cc-only-rationale: pure TS, callable from the maintainer's bash smoke-test
 *   script and from an orchestrator session alike — no CC-only primitive used.
 */
import { isMain } from './cliEntry.js';
import { resolveBackend } from '../resolver.js';
import { BackendError } from '../backend.js';
import type { TaskHandle } from '../types.js';

function parseArgs(argv: string[]): { taskId?: string; once: boolean; timeoutMs?: number } {
  const taskId = argv.find((a) => !a.startsWith('--'));
  const once = argv.includes('--once');
  let timeoutMs: number | undefined;
  const tIdx = argv.indexOf('--timeout-ms');
  if (tIdx !== -1 && argv[tIdx + 1]) {
    const parsed = Number(argv[tIdx + 1]);
    if (Number.isFinite(parsed) && parsed > 0) timeoutMs = parsed;
  }
  return { taskId, once, timeoutMs };
}

/**
 * Always surface the clickable task URL, and reconcile aif's optimistic 'done'.
 * aif auto-closes to `done` when its review finds "no blocking findings" — which
 * is NOT "the work is really complete". When aif's own review advisory flags a
 * zero-code halt or a "should be blocked, not done" mismatch, relabel as BLOCKED
 * so the coordinator re-dispatches instead of trusting a false 'done'.
 * (implementationLog is the agent's reasoning transcript, NOT code — it is non-empty
 * even on a no-code halt, so the signal is the review advisory, not log length.
 * Live-confirmed task a4bdff98, 2026-05-31: log=9490 chars, zero code.)
 * Best-effort: REST detail fetch failures are swallowed (links still printed).
 */
async function printLinksAndReconcile(
  taskId: string,
  backendName: string,
  status: string,
): Promise<void> {
  if (backendName !== 'aif-handoff') return;
  // Human-facing UI (the board), NOT the :3009 REST API (raw JSON).
  const webBase = process.env['RUNTIME_BRIDGE_AIF_WEB_URL'] ?? 'http://localhost:5180';
  const projectId = process.env['RUNTIME_BRIDGE_AIF_PROJECT_ID'];
  const uiUrl = projectId ? `${webBase}/projects/${projectId}` : webBase;
  process.stderr.write(`[runtime-bridge] open the board: ${uiUrl} (task ${taskId})\n`);
  if (status !== 'done') return;
  // Reconcile reads task detail from the REST API (:3009), distinct from the UI (:5180).
  const apiBase = process.env['RUNTIME_BRIDGE_AIF_URL'] ?? 'http://localhost:3009';
  try {
    const res = await fetch(`${apiBase}/tasks/${taskId}`);
    if (!res.ok) return;
    const t = (await res.json()) as { reviewComments?: string };
    const rc = t.reviewComments ?? '';
    // aif's review explicitly flags the mismatch in its advisory text.
    const blockedSignal =
      /zero code|should be .{0,12}blocked|as .{0,8}['"]?blocked|treat .{0,40}blocked|BLOCKER-\d/i.test(rc);
    if (blockedSignal) {
      const advisory = rc.replace(/\s+/g, ' ').slice(0, 240);
      process.stderr.write(
        `[runtime-bridge] ⚠ RECONCILE: aif reports 'done' but its review flags a no-code / ` +
          `blocked halt — treat as BLOCKED, not done. Likely an orchestration/meta kickoff or an ` +
          `unmet precondition. Re-dispatch a single buildable sub-wave kickoff.` +
          (advisory ? ` Advisory: ${advisory}` : '') +
          '\n',
      );
    }
  } catch {
    /* best-effort reconcile — never fail the read-back on a detail-fetch error */
  }
}

async function main(): Promise<void> {
  const { taskId, once, timeoutMs } = parseArgs(process.argv.slice(2));

  if (!taskId) {
    process.stderr.write(
      'Usage: await.ts <taskId> [--timeout-ms N] [--once]\n',
    );
    process.exit(1);
  }

  const backend = await resolveBackend();
  const handle: TaskHandle = {
    backend: backend.name,
    taskId,
    dispatchedAt: new Date().toISOString(),
  };

  try {
    if (once) {
      const status = await backend.getStatus(handle);
      process.stdout.write(JSON.stringify(status) + '\n');
      await printLinksAndReconcile(taskId, backend.name, status.status);
      // A point-in-time snapshot: exit 0 unless the backend reports an error state.
      process.exit(status.status === 'error' ? 1 : 0);
    }

    if (timeoutMs === undefined) {
      process.stderr.write(
        `[runtime-bridge] awaiting task ${taskId} on ${backend.name} (no --timeout-ms → blocks until terminal; Ctrl-C to stop)\n`,
      );
    }
    const result = await backend.awaitDone(handle, timeoutMs);
    process.stdout.write(JSON.stringify(result) + '\n');
    await printLinksAndReconcile(taskId, backend.name, result.success ? 'done' : 'error');
    process.exit(result.success ? 0 : 1);
  } catch (err) {
    if (err instanceof BackendError) {
      process.stderr.write(`[runtime-bridge] await failed (${err.code}): ${err.message}\n`);
    } else {
      process.stderr.write(`[runtime-bridge] await unexpected error: ${err}\n`);
    }
    process.exit(1);
  }
}

// Run only as a real entrypoint (shared realpath-both-sides guard, cliEntry.ts isMain).
// await.ts is the one CLI that had NO guard at all — importing it for a named export
// ran main() and exited the importing process.
if (isMain(import.meta.url)) {
  main().catch((err) => {
    process.stderr.write(`[runtime-bridge] await unhandled error: ${err}\n`);
    process.exit(1);
  });
}
