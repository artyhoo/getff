/**
 * await.ts — the result read-back half of the bridge (await/status).
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
 *   default  — AIF subscribes before authoritative REST reconciliation on initial
 *              open and reconnect, settling on terminal/held full detail. The
 *              default AIF observation deadline is one hour; --timeout-ms overrides.
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
 * ManualBackend retains its indefinite /tmp response-file wait when --timeout-ms
 * is absent. Observation timeout/cancellation never cancels an AIF task or grants
 * retry/acceptance authority. Retained validated identity accompanies uncertainty.
 *
 * @cc-only-rationale: pure TS, callable from the maintainer's bash smoke-test
 *   script and from an orchestrator session alike — no CC-only primitive used.
 */
import { isMain, parseCliArgs, CliArgError } from './cliEntry.js';
import { resolveBackend } from '../resolver.js';
import { BackendError } from '../backend.js';
import { AifObservationError, unresolvedAifTaskResult } from '../aifWsStatus.js';
import type { TaskHandle } from '../types.js';

function parseArgs(argv: string[]): { taskId?: string; once: boolean; timeoutMs?: number } {
  const { values, positionals } = parseCliArgs(argv, {
    maxPositionals: 1,
    options: { once: { type: 'boolean' }, 'timeout-ms': { type: 'string' } },
  });
  const timeoutMs = values['timeout-ms'] === undefined ? undefined : Number(values['timeout-ms']);
  if (timeoutMs !== undefined && (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647)) {
    throw new CliArgError('--timeout-ms must be a positive integer no greater than 2147483647');
  }
  return { taskId: positionals[0], once: values.once === true, timeoutMs };
}

/**
 * Surface the UI link only. The backend reconciles authoritative detail BEFORE JSON
 * or exit-code consumption; a warning printed after success cannot carry that control.
 * Legacy adverse advisory detection survives in aifWsStatus.describeAifTask.
 */
function printTaskLink(
  taskId: string,
  backendName: string,
): void {
  if (backendName !== 'aif-handoff') return;
  // Human-facing UI (the board), NOT the :3009 REST API (raw JSON).
  const webBase = process.env['RUNTIME_BRIDGE_AIF_WEB_URL'] ?? 'http://localhost:5180';
  const projectId = process.env['RUNTIME_BRIDGE_AIF_PROJECT_ID'];
  const uiUrl = projectId ? `${webBase}/projects/${projectId}` : webBase;
  process.stderr.write(`[runtime-bridge] open the board: ${uiUrl} (task ${taskId})\n`);
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
      if (status.meta?.held === 'unresolved') process.stderr.write('[runtime-bridge] await reconciliation remains pending; authoritative detail is unresolved\n');
      process.stdout.write(JSON.stringify(status) + '\n');
      printTaskLink(taskId, backend.name);
      // A point-in-time snapshot: exit 0 unless the backend reports an error state.
      process.exit(status.status === 'error' ? 1 : 0);
    }

    if (timeoutMs === undefined) {
      process.stderr.write(
        `[runtime-bridge] awaiting task ${taskId} on ${backend.name} (${backend.name === 'aif-handoff' ? 'one-hour observation deadline' : 'no explicit deadline'}; Ctrl-C stops observation)\n`,
      );
    }
    const result = await backend.awaitDone(handle, timeoutMs);
    process.stdout.write(JSON.stringify(result) + '\n');
    printTaskLink(taskId, backend.name);
    process.exit(result.success ? 0 : 1);
  } catch (err) {
    if (backend.name === 'aif-handoff') {
      const result = unresolvedAifTaskResult(taskId, err, err instanceof AifObservationError ? err.observed : undefined);
      process.stdout.write(JSON.stringify(once
        ? { status: 'error', rawStatus: result.finalStatus, checkedAt: result.completedAt, meta: result.meta }
        : result) + '\n');
    }
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
