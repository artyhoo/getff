/**
 * Vitest globalSetup tripwire — the suite must leave `.claude/hooks/` untouched.
 *
 * Origin (2026-07-02 leak incident): concurrent suite instances interleaved the
 * bash-mutation swap/restore on .claude/hooks/check-hook-marker.sh and a mutant
 * leaked into the working tree (broken glob, flipped exit, mode 755→644); the
 * c4-test-* fixtures were also written into the real hooks dir. Both writers are
 * now sandboxed (run-bash-mutation.sh shadow copy; check-hook-marker.test.ts
 * tempdir). This guard is the paired regression check: any REINTRODUCED
 * real-tree write under .claude/hooks/ fails the run at teardown with the
 * observed delta. Wired via `globalSetup` in packages/core/vitest.config.ts and
 * the root vitest.config.ts; paired-negative test: hooks-tree-guard.test.ts.
 *
 * Delta-based (before vs after), NOT absolute-clean: a legitimately dirty
 * worktree (developer edits in flight) must not fail the suite. Advisory when
 * git is unavailable (snapshot → null, no assertion). Deterministic git-only —
 * no LLM, no network (no-paid-llm-in-ci.md).
 */
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

/**
 * Porcelain status of .claude/hooks (tracked modifications incl. mode bits +
 * untracked leftovers), or null when git/checkout is unavailable. GIT_* env is
 * scrubbed so hook-spawned runs (relative GIT_DIR) and worktrees resolve by cwd
 * (the run-audit.sh GIT_DIR-immunity precedent); --no-optional-locks keeps
 * concurrent suite instances from contending on the index.
 */
export function snapshotHooksTree(repoRoot: string = REPO_ROOT): string | null {
  const env = { ...process.env };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_INDEX_FILE;
  delete env.GIT_COMMON_DIR;
  try {
    return execSync('git --no-optional-locks status --porcelain=v1 -- .claude/hooks', {
      cwd: repoRoot,
      encoding: 'utf8',
      env,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

export function assertNoHooksTreeDelta(before: string | null, after: string | null): void {
  if (before === null || after === null) return; // advisory without git
  if (before === after) return;
  throw new Error(
    [
      'hooks-tree-guard: `.claude/hooks/` changed during this vitest run — a test leaked state into the real working tree.',
      `  before: ${JSON.stringify(before)}`,
      `  after:  ${JSON.stringify(after)}`,
      '  Seeded-break/fixture writes belong in a tempdir sandbox — see the',
      '  run-bash-mutation.sh shadow copy and the check-hook-marker.test.ts sandbox.',
      '  Restore: git checkout -- .claude/hooks && rm -f .claude/hooks/c4-test-*',
    ].join('\n'),
  );
}

export default function globalSetup(): () => void {
  const before = snapshotHooksTree();
  return () => {
    try {
      assertNoHooksTreeDelta(before, snapshotHooksTree());
    } catch (err) {
      // Vitest only LOGS teardown rejections ("error during close") and keeps
      // exit code 0 (verified on 4.1.8) — a logged-but-green tripwire is
      // theatre. It never resets an already-set exitCode, so claim it here.
      process.exitCode = 1;
      throw err;
    }
  };
}
