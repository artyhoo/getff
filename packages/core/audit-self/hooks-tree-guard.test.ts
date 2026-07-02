/**
 * Paired-negative test for hooks-tree-guard.ts (the globalSetup tripwire that
 * fails a vitest run when `.claude/hooks/` changed between suite start and end
 * — 2026-07-02 leak incident). All fixtures are throwaway git repos in the OS
 * tempdir; the guard under test never touches the real working tree.
 *
 * Paired-negative contract:
 *   ❌ tracked hook modified between snapshots      → assertNoHooksTreeDelta throws
 *   ❌ untracked c4-test-* leftover appears          → throws
 *   ❌ mode-only 755→644 flip (the observed leak)    → throws
 *   ✅ untouched tree                                → no throw
 *   ✅ change OUTSIDE .claude/hooks/                 → no throw (delta is scoped)
 *   ✅ git unavailable (null snapshot)               → no throw (advisory mode)
 */
import { describe, it, expect, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { snapshotHooksTree, assertNoHooksTreeDelta } from './hooks-tree-guard.js';

const tmpDirs: string[] = [];
afterEach(() => {
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** git in a throwaway repo, immune to ambient GIT_* (hook/worktree env). */
function git(dir: string, args: string): void {
  const env = { ...process.env };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_INDEX_FILE;
  delete env.GIT_COMMON_DIR;
  execSync(`git -c user.name=t -c user.email=t@t -c commit.gpgsign=false ${args}`, {
    cwd: dir,
    env,
    stdio: 'ignore',
  });
}

/** Temp git repo with a committed 755 hook + a committed file outside hooks. */
function makeRepo(): { root: string; hook: string } {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'htg-')));
  tmpDirs.push(root);
  git(root, 'init -q');
  git(root, 'config core.filemode true'); // mode-flip case must be deterministic
  mkdirSync(join(root, '.claude', 'hooks'), { recursive: true });
  const hook = join(root, '.claude', 'hooks', 'h.sh');
  writeFileSync(hook, '#!/usr/bin/env bash\nexit 0\n', 'utf8');
  chmodSync(hook, 0o755);
  writeFileSync(join(root, 'outside.txt'), 'x\n', 'utf8');
  git(root, 'add -A');
  git(root, 'commit -qm init');
  return { root, hook };
}

describe('hooks-tree-guard — .claude/hooks/ leak tripwire (paired-negative)', () => {
  it('POSITIVE: untouched tree → snapshots equal, no throw', () => {
    const { root } = makeRepo();
    const before = snapshotHooksTree(root);
    expect(before).not.toBeNull();
    expect(() => assertNoHooksTreeDelta(before, snapshotHooksTree(root))).not.toThrow();
  });

  it('PAIRED-NEGATIVE: tracked hook content mutated mid-run → throws with the delta', () => {
    const { root, hook } = makeRepo();
    const before = snapshotHooksTree(root);
    writeFileSync(hook, '#!/usr/bin/env bash\nexit 1\n', 'utf8'); // the seeded-break shape
    expect(() => assertNoHooksTreeDelta(before, snapshotHooksTree(root))).toThrow(
      /hooks-tree-guard: `\.claude\/hooks\/` changed/,
    );
  });

  it('PAIRED-NEGATIVE: untracked c4-test-* leftover → throws', () => {
    const { root } = makeRepo();
    const before = snapshotHooksTree(root);
    writeFileSync(join(root, '.claude', 'hooks', 'c4-test-leak.sh'), '# leak\n', 'utf8');
    expect(() => assertNoHooksTreeDelta(before, snapshotHooksTree(root))).toThrow(/c4-test/);
  });

  it('PAIRED-NEGATIVE: mode-only 755→644 flip (observed leak shape) → throws', () => {
    const { root, hook } = makeRepo();
    const before = snapshotHooksTree(root);
    chmodSync(hook, 0o644);
    expect(() => assertNoHooksTreeDelta(before, snapshotHooksTree(root))).toThrow(
      /hooks-tree-guard/,
    );
  });

  it('scoping: a change OUTSIDE .claude/hooks/ does NOT trip the guard', () => {
    const { root } = makeRepo();
    const before = snapshotHooksTree(root);
    writeFileSync(join(root, 'outside.txt'), 'changed\n', 'utf8');
    expect(() => assertNoHooksTreeDelta(before, snapshotHooksTree(root))).not.toThrow();
  });

  it('advisory: null snapshots (git unavailable) → no throw', () => {
    expect(snapshotHooksTree(join(tmpdir(), 'htg-definitely-not-a-repo'))).toBeNull();
    expect(() => assertNoHooksTreeDelta(null, 'anything')).not.toThrow();
    expect(() => assertNoHooksTreeDelta('anything', null)).not.toThrow();
  });
});
