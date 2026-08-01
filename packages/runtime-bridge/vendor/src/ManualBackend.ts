/**
 * ManualBackend — always-available fallback backend.
 *
 * Behaviour:
 *   dispatch: copies kickoff to /tmp/runtime-bridge-<task-id>.md, prints
 *             copy-paste instructions to stderr, returns a TaskHandle.
 *   getStatus: checks for /tmp/runtime-bridge-<task-id>.response.md existence.
 *   awaitDone: polls every 30s until the response file appears (no MVP timeout —
 *              documented acceptable limitation per kickoff §12 mn2).
 *
 * Task ID: ISO-timestamp + first 8 chars of SHA-256 hash of umbrellaName.
 * This keeps IDs human-readable and deterministically reproducible for the
 * same umbrella (useful for troubleshooting), while remaining unique per
 * dispatch timestamp.
 *
 * @cc-only-rationale: ManualBackend is dual-channel via index.ts export —
 *   callable from both the PostToolUse hook (CC) and any portable entrypoint.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import type { RuntimeBackend } from './backend.js';
import type { KickoffSpec, TaskHandle, TaskStatus, TaskResult } from './types.js';

/** /tmp kickoff/response artefacts older than this are pruned on the next dispatch. */
const ARTIFACT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — generous (don't nuke an unpasted recent one)

/**
 * Is this a ManualBackend /tmp artefact that is now stale? Pure → unit-testable.
 * Matches only our own `runtime-bridge-*.md` / `.response.md` files, and only when
 * older than the TTL — so self-cleaning never touches unrelated files or fresh kickoffs.
 */
export function isStaleArtifact(filename: string, mtimeMs: number, now: number, ttlMs: number = ARTIFACT_TTL_MS): boolean {
  if (!/^runtime-bridge-.*\.md$/.test(filename)) return false;
  return now - mtimeMs > ttlMs;
}

/**
 * Self-clean: delete stale ManualBackend artefacts in `dir`. Best-effort — a file
 * that vanishes or can't be stat'd is skipped, never throws into the dispatch path.
 */
export function pruneTmpArtifacts(dir: string, now: number, ttlMs: number = ARTIFACT_TTL_MS): string[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  const removed: string[] = [];
  for (const name of names) {
    const full = `${dir}/${name}`;
    try {
      if (isStaleArtifact(name, statSync(full).mtimeMs, now, ttlMs)) {
        unlinkSync(full);
        removed.push(name);
      }
    } catch {
      /* race / permission — skip */
    }
  }
  return removed;
}

export class ManualBackend implements RuntimeBackend {
  readonly name = 'manual' as const;

  available(): Promise<boolean> {
    // ManualBackend is always available — no infrastructure required.
    return Promise.resolve(true);
  }

  dispatch(kickoff: KickoffSpec): Promise<TaskHandle> {
    const taskId = this._makeTaskId(kickoff);
    const kickoffPath = `/tmp/runtime-bridge-${taskId}.md`;
    const responsePath = `/tmp/runtime-bridge-${taskId}.response.md`;

    // Self-clean: prune our own stale /tmp artefacts so they never accumulate
    // (no manual sweep). Best-effort; never blocks the dispatch.
    pruneTmpArtifacts('/tmp', Date.now());

    writeFileSync(kickoffPath, kickoff.content, 'utf8');

    // Print bilingual copy-paste instructions to stderr (non-blocking).
    // Using process.stderr.write to avoid console.error adding extra formatting.
    process.stderr.write(
      [
        '',
        '╔══════════════════════════════════════════════════════════════════╗',
        '║  runtime-bridge: ManualBackend — ручной запуск                  ║',
        '╚══════════════════════════════════════════════════════════════════╝',
        `  Kickoff сохранён: ${kickoffPath}`,
        `  Откройте новое окно Claude Code и запустите задачу.`,
        `  Положите отчёт в: ${responsePath}`,
        `  Task ID: ${taskId}`,
        '',
      ].join('\n'),
    );

    const handle: TaskHandle = {
      backend: 'manual',
      taskId,
      dispatchedAt: new Date().toISOString(),
    };
    return Promise.resolve(handle);
  }

  getStatus(handle: TaskHandle): Promise<TaskStatus> {
    const responsePath = `/tmp/runtime-bridge-${handle.taskId}.response.md`;
    const responseExists = existsSync(responsePath);
    return Promise.resolve({
      status: responseExists ? 'done' : 'pending',
      rawStatus: responseExists ? 'response_file_present' : 'awaiting_response_file',
      checkedAt: new Date().toISOString(),
    });
  }

  async awaitDone(handle: TaskHandle, timeoutMs?: number): Promise<TaskResult> {
    const responsePath = `/tmp/runtime-bridge-${handle.taskId}.response.md`;
    const pollIntervalMs = 30_000;
    const startedAt = Date.now();

    while (true) {
      if (existsSync(responsePath)) {
        const content = readFileSync(responsePath, 'utf8');
        return {
          success: true,
          content,
          finalStatus: 'done',
          completedAt: new Date().toISOString(),
        };
      }

      if (timeoutMs !== undefined && Date.now() - startedAt >= timeoutMs) {
        return {
          success: false,
          content: '',
          finalStatus: 'timeout',
          completedAt: new Date().toISOString(),
          meta: { timeoutMs, taskId: handle.taskId, responsePath },
        };
      }

      await new Promise<void>((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  _makeTaskId(kickoff: KickoffSpec): string {
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const shortHash = createHash('sha256')
      .update(kickoff.umbrellaName)
      .digest('hex')
      .slice(0, 8);
    return `${ts}-${shortHash}`;
  }
}
