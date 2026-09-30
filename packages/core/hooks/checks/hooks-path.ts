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
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';

export const DELEGATE_MARKER = 'husky-own-worktree-delegate';
// A marker comment alone proves nothing; the hand-off line is what makes a copy safe to run.
const HAND_OFF = 'exec "$__own_hook" "$@"';

export type HooksPathResult =
  | { status: 'own' }
  | { status: 'unknown' }
  | { status: 'delegating'; dir: string }
  | { status: 'healed'; dir: string; stale: string[] }
  | { status: 'failed'; dir: string; stale: string[]; detail: string };

function git(repoRoot: string, args: string[]) {
  return spawnSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8' });
}

/** Absolute hooks dir git will use here, or null when git cannot say (not a repo, git < 2.31). */
function effectiveHooksDir(repoRoot: string): string | null {
  const out = git(repoRoot, [
    'rev-parse',
    '--path-format=absolute',
    '--git-path',
    'hooks',
  ]);
  const dir = out.stdout.trim();
  if (out.status !== 0 || dir === '' || dir.includes('\n')) return null;
  return existsSync(dir) ? realpathSync(dir) : dir;
}

/** Tracked files directly in .husky — an editor backup or .DS_Store is not a hook. */
function trackedHooks(repoRoot: string): string[] {
  const out = git(repoRoot, ['ls-files', '-z', '--', '.husky']);
  return out.stdout
    .split('\0')
    .filter((p) => /^\.husky\/[^/]+$/.test(p))
    .map((p) => p.slice('.husky/'.length));
}

export function ensureOwnHooks(repoRoot: string): HooksPathResult {
  const ownPath = join(repoRoot, '.husky');
  if (!existsSync(ownPath)) return { status: 'own' };
  const own = realpathSync(ownPath);
  const dir = effectiveHooksDir(repoRoot);
  if (dir === null) return { status: 'unknown' };
  if (dir === own) return { status: 'own' };

  const stale = trackedHooks(repoRoot)
    .filter((h) => existsSync(join(own, h)))
    .filter((h) => {
      const foreign = join(dir, h);
      if (!existsSync(foreign)) return true;
      const body = readFileSync(foreign, 'utf8');
      const delegates =
        body.includes(`${DELEGATE_MARKER} (begin)`) && body.includes(HAND_OFF);
      return body !== readFileSync(join(own, h), 'utf8') && !delegates;
    })
    .sort();
  if (stale.length === 0) return { status: 'delegating', dir };

  const set = git(repoRoot, [
    'config',
    '--worktree',
    'core.hooksPath',
    '.husky',
  ]);
  if (set.status === 0 && effectiveHooksDir(repoRoot) === own)
    return { status: 'healed', dir, stale };
  return {
    status: 'failed',
    dir,
    stale,
    detail:
      set.status === 0
        ? 'the per-worktree write succeeded, but a higher-precedence value (e.g. `git -c core.hooksPath=...`) still wins'
        : set.stderr.trim(),
  };
}
