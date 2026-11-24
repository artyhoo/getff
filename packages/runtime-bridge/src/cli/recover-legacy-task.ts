/**
 * recover-legacy-task.ts — Recover one pre-freeze active AIF task omitted from the write-once freeze.
 * The live task must still be nonterminal and unchanged since the frozen instant.
 */
import { isMain } from './cliEntry.js';
import { getTask } from './aifHttp.js';
import { releaseOwnerRoot } from './claim.js';
import { recordRecoveredLegacyTask } from '../resultReview.js';
import { BackendError } from '../backend.js';

export async function recoverLegacyTaskFromAif(
  baseUrl: string,
  taskId: string,
  repoRoot: string,
  projectId: string,
): Promise<string> {
  const task = await getTask(baseUrl, taskId);
  if (
    !task ||
    task.id !== taskId ||
    typeof task.projectId !== 'string' ||
    typeof task.createdAt !== 'string' ||
    typeof task.updatedAt !== 'string' ||
    typeof task.status !== 'string'
  ) {
    throw new BackendError(
      'AIF task lacks freeze-recovery fields',
      'spec_invalid',
      'aif-handoff',
    );
  }
  return recordRecoveredLegacyTask(
    {
      id: task.id,
      status: task.status,
      projectId: task.projectId,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    },
    repoRoot,
    projectId,
  );
}

async function main(): Promise<void> {
  const taskId = process.argv[2];
  const repoRoot = releaseOwnerRoot();
  const projectId = process.env['RUNTIME_BRIDGE_AIF_PROJECT_ID'];
  if (!taskId || process.argv.length !== 3 || !repoRoot || !projectId) {
    throw new Error(
      'usage: recover-legacy-task <task-id> from the selector checkout with RUNTIME_BRIDGE_AIF_PROJECT_ID set',
    );
  }
  const path = await recoverLegacyTaskFromAif(
    process.env['RUNTIME_BRIDGE_AIF_URL'] ?? 'http://127.0.0.1:3009',
    taskId,
    repoRoot,
    projectId,
  );
  process.stdout.write(`${path}\n`);
}

if (isMain(import.meta.url))
  main().catch((err: unknown) => {
    process.stderr.write(
      `${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exitCode = 2;
  });
