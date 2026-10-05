/**
 * rangeGit.changedFiles must expand renames over a REAL git repo.
 *
 * git's porcelain `diff --name-status` ships rename detection ON by default, so
 * a rename reaches parseNameStatus as ONE row `R100\told\tnew`, which splits on
 * the FIRST tab into {status:'R100', path:'old\tnew'} — an entry both
 * `status !== 'A'` arms in checks/prior-art.ts skip. A capability file delivered
 * via `git mv` + rewrite therefore escaped the PR-body Prior-art gate. Passing
 * `--no-renames` (sibling precedent: pr-body-removal-consumers-bin.ts) expands
 * the rename to A+D rows so the A arm sees the new path.
 *
 * Lives in its own file because git.test.ts mocks the run-check boundary
 * file-wide with canned output; here the substitution is cwd-only (see below),
 * so rangeGit and parseNameStatus execute for real.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// git.ts funnels every git call through runCheck with NO cwd option, so the
// child inherits process.cwd() — in a vitest worker that is the package dir,
// not the throwaway repo whose SHAs we pass. The mock re-points exactly that
// one knob at `repoDir`; everything else (real git, real parse) is production
// code. Reset to '' around each test so a stray call fails loudly instead of
// silently diffing the packages/core checkout.
let repoDir = '';
vi.mock('./run-check.ts', () => ({
  runCheck: (cmd: string, args: readonly string[]) => {
    const r = spawnSync(cmd, args, { cwd: repoDir, encoding: 'utf8' });
    return {
      exitCode: r.status ?? 1,
      stdout: r.stdout ?? '',
      stderr: r.stderr ?? '',
      timedOut: false,
      notFound: false,
    };
  },
}));

const { rangeGit } = await import('./git.ts');

/** Build a tmp repo directly (explicit cwd — not through the mock). */
function git(dir: string, ...args: string[]) {
  const r = spawnSync(
    'git',
    ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args],
    { cwd: dir, encoding: 'utf8' },
  );
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout;
}

/** Repo whose only range change is `git mv` of a 100-line file into packages/. */
function repoWithRenameIntoPackages(): { base: string; head: string } {
  const dir = mkdtempSync(join(tmpdir(), 'git-range-renames-'));
  repoDir = dir;
  git(dir, 'init', '-q');
  git(dir, 'checkout', '-qb', 'main');
  mkdirSync(join(dir, 'legacy'), { recursive: true });
  writeFileSync(
    join(dir, 'legacy', 'capability.ts'),
    `${Array.from({ length: 100 }, (_, i) => `export const line${i} = ${i};`).join('\n')}\n`,
  );
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'base');
  const base = git(dir, 'rev-parse', 'HEAD').trim();
  mkdirSync(join(dir, 'packages', 'core', 'fresh'), { recursive: true });
  git(dir, 'mv', 'legacy/capability.ts', 'packages/core/fresh/capability.ts');
  git(dir, 'commit', '-qm', 'git-mv a 100-line capability file into packages/');
  const head = git(dir, 'rev-parse', 'HEAD').trim();
  return { base, head };
}

describe('rangeGit.changedFiles over a git-mv rename (real git)', () => {
  beforeEach(() => {
    repoDir = '';
  });
  afterEach(() => {
    repoDir = '';
  });

  // THE defect (2026-10-05): without --no-renames this entry never appears —
  // the rename arrives as {status:'R100', path:'legacy/…\tpackages/core/…'} and
  // both `status !== 'A'` arms in checks/prior-art.ts skip it, so the ≥80-LOC
  // capability arm never reads the new file.
  it('yields an A entry for the new path — the row the capability arms read', () => {
    const { base, head } = repoWithRenameIntoPackages();
    // sha is part of the GitProvider interface; rangeGit ignores it (range view).
    const entries = rangeGit(base, head).changedFiles(head);
    expect(entries).toContainEqual({
      status: 'A',
      path: 'packages/core/fresh/capability.ts',
    });
  });

  // Expansion must be complete: the old path leaves as D, and no entry keeps
  // the corrupt first-tab parse shape (status R100, path holding a raw tab).
  it('yields the D entry for the old path and no tab-corrupted R row', () => {
    const { base, head } = repoWithRenameIntoPackages();
    const entries = rangeGit(base, head).changedFiles(head);
    expect(entries).toContainEqual({ status: 'D', path: 'legacy/capability.ts' });
    expect(entries.some((e) => e.path.includes('\t'))).toBe(false);
    expect(entries.some((e) => e.status.startsWith('R'))).toBe(false);
  });
});
