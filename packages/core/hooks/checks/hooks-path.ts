/**
 * ensureOwnHooks — keep a worktree from running another checkout's stale `.husky/*`.
 *
 * Incident 2026-09-30 (#1983): the Claude desktop app writes an absolute
 * `core.hooksPath=<primary>/.husky` into every worktree it opens, so git ran the primary
 * checkout's hook files — 457 commits stale — and a pre-commit check added in #1923 never
 * fired in a worktree. The durable fix is the self-delegate block at the top of every
 * `.husky/*` hook; this preflight covers the window where the foreign copy predates that
 * block. It is reached through pre-push.ts, the one channel that always runs the worktree's
 * OWN code (even a stale `.husky/pre-push` dispatches to `$REPO_ROOT/packages/core/...`).
 *
 * Heals rather than blocks: the repair is a per-worktree `core.hooksPath=.husky`, which no
 * other checkout reads. A foreign dir whose hooks delegate (or are byte-identical) is left
 * alone — the app rewrites the value on every open, so rewriting it back buys nothing then.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const DELEGATE_MARKER = 'husky-own-worktree-delegate';

export type HooksPathResult =
  | { status: 'own' }
  | { status: 'delegating'; dir: string }
  | { status: 'healed'; dir: string; stale: string[] }
  | { status: 'failed'; dir: string; stale: string[]; detail: string };

function git(repoRoot: string, args: string[]) {
  return spawnSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8' });
}

function effectiveHooksDir(repoRoot: string): string {
  const out = git(repoRoot, ['rev-parse', '--path-format=absolute', '--git-path', 'hooks']);
  const dir = out.stdout.trim();
  return existsSync(dir) ? realpathSync(dir) : dir;
}

export function ensureOwnHooks(repoRoot: string): HooksPathResult {
  const ownPath = join(repoRoot, '.husky');
  if (!existsSync(ownPath)) return { status: 'own' };
  const own = realpathSync(ownPath);
  const dir = effectiveHooksDir(repoRoot);
  if (dir === own) return { status: 'own' };

  const stale = readdirSync(own)
    .filter((h) => statSync(join(own, h)).isFile())
    .filter((h) => {
      const foreign = join(dir, h);
      if (!existsSync(foreign)) return true;
      const body = readFileSync(foreign, 'utf8');
      return body !== readFileSync(join(own, h), 'utf8') && !body.includes(DELEGATE_MARKER);
    })
    .sort();
  if (stale.length === 0) return { status: 'delegating', dir };

  const set = git(repoRoot, ['config', '--worktree', 'core.hooksPath', '.husky']);
  if (set.status === 0 && effectiveHooksDir(repoRoot) === own)
    return { status: 'healed', dir, stale };
  return {
    status: 'failed',
    dir,
    stale,
    detail: (set.stderr || 'core.hooksPath still resolves outside this worktree').trim(),
  };
}
