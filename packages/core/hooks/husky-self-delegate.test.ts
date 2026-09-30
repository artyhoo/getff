/**
 * Tests for the self-delegation block at the top of every `.husky/*` hook.
 *
 * THE DEFECT (measured 2026-09-30). The Claude desktop app writes an ABSOLUTE
 * `core.hooksPath=<primary>/.husky` into every worktree it opens (`git config --worktree`,
 * resolved from the base repo's value, or `<primary>/.husky` when unset) — 113 of 139
 * worktrees of this clone carried it. Git then runs the PRIMARY checkout's hook files, which
 * were 457 commits stale, so a check added to `.husky/pre-commit` (#1923 pipefail early-exit)
 * never ran in a worktree and was caught only by CI (#1983).
 *
 * THE FIX UNDER TEST. Each hook begins with a block that, when the file git executed is not
 * `<this worktree's toplevel>/.husky/<hook>`, execs that own file instead. A foreign
 * hooksPath then costs nothing once the foreign copy carries the block.
 *
 * Arms:
 *   (a) STRUCTURE: every hook file in the real `.husky/` carries the block — a new hook
 *       added without it fails here, not in a worktree months later.
 *   (b) DELEGATION: with hooksPath pointing at a primary that carries the REAL hook files,
 *       `git hook run <hook>` in a linked worktree runs the worktree's own hook.
 *   (c) REAL COMMIT: the same through `git commit`, the path the #1983 miss took.
 *   (d) NO LOOP: in the checkout that owns the hooks, the block is a no-op.
 *   (e) MISSING OWN HOOK: a worktree without that hook falls through to the foreign body.
 *   (f) PAIRED NEGATIVE: the same fixture with the block stripped runs the foreign hook —
 *       proves (b)/(c) cannot pass vacuously.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HUSKY = resolve(REPO_ROOT, '.husky');
const MARKER = 'husky-own-worktree-delegate';

const HOOKS = readdirSync(HUSKY).filter((f) =>
  statSync(join(HUSKY, f)).isFile(),
);

// Hook arguments git would pass; `git hook run` forwards them after `--`.
const HOOK_ARGS: Record<string, string[]> = {
  'post-checkout': ['0000000', '0000000', '1'],
  'pre-push': ['origin', 'file:///dev/null'],
};

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' });
}

function stripBlock(src: string): string {
  const lines = src.split('\n');
  const begin = lines.findIndex((l) => l.includes(`${MARKER} (begin)`));
  const end = lines.findIndex((l) => l.includes(`${MARKER} (end)`));
  if (begin < 0 || end < begin) throw new Error('delegate block not found');
  return [...lines.slice(0, begin), ...lines.slice(end + 1)].join('\n');
}

let tmp: string;
let primary: string;
let wt: string;
let sentinels: string;

/** primary/.husky gets `content(hook)`; the worktree gets sentinel-writing stubs. */
function setup(content: (hook: string) => string, ownHooks = HOOKS): void {
  tmp = mkdtempSync(join(tmpdir(), 'husky-delegate-'));
  primary = join(tmp, 'primary');
  wt = join(tmp, 'wt');
  sentinels = join(tmp, 'sentinels');
  mkdirSync(join(primary, '.husky'), { recursive: true });
  mkdirSync(sentinels);
  git(tmp, 'init', '-q', '-b', 'main', primary);
  git(primary, 'config', 'user.email', 't@t');
  git(primary, 'config', 'user.name', 't');
  git(primary, 'commit', '-q', '--allow-empty', '-m', 'init');
  git(primary, 'worktree', 'add', '-q', '-b', 'wt', wt);
  mkdirSync(join(wt, '.husky'));
  for (const h of HOOKS) {
    const p = join(primary, '.husky', h);
    writeFileSync(p, content(h));
    chmodSync(p, 0o755);
  }
  for (const h of ownHooks) {
    const p = join(wt, '.husky', h);
    writeFileSync(p, `#!/bin/sh\ntouch "${sentinels}/${h}"\nexit 0\n`);
    chmodSync(p, 0o755);
  }
  // The shape the desktop app writes: an absolute path into the primary checkout.
  git(primary, 'config', 'core.hooksPath', join(primary, '.husky'));
}

function runHook(cwd: string, hook: string) {
  return spawnSync(
    'git',
    ['hook', 'run', hook, '--', ...(HOOK_ARGS[hook] ?? [])],
    {
      cwd,
      encoding: 'utf8',
    },
  );
}

const real = (h: string) => readFileSync(join(HUSKY, h), 'utf8');

afterEach(() => {
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

describe('(a) structure', () => {
  it('finds the hooks it is meant to cover', () => {
    expect(HOOKS).toEqual(
      expect.arrayContaining(['pre-commit', 'pre-push', 'post-checkout']),
    );
  });
  it.each(HOOKS)(
    '.husky/%s carries the delegate block before any other code',
    (h) => {
      const lines = real(h).split('\n');
      const begin = lines.findIndex((l) => l.includes(`${MARKER} (begin)`));
      expect(begin).toBeGreaterThan(0);
      // Only the shebang and comments may precede it — a `set -e` or a command before the
      // block would run in the foreign copy before delegation.
      for (const l of lines.slice(1, begin))
        expect(l.trim() === '' || l.trim().startsWith('#')).toBe(true);
    },
  );
});

describe('with the real hook files in the primary', () => {
  beforeEach(() => setup(real));

  it.each(HOOKS)('(b) %s runs the worktree’s own hook', (h) => {
    const r = runHook(wt, h);
    expect(r.status, r.stderr).toBe(0);
    expect(existsSync(join(sentinels, h))).toBe(true);
  });

  it('(c) a real `git commit` in the worktree runs its own pre-commit', () => {
    git(wt, 'commit', '-q', '--allow-empty', '-m', 'x');
    expect(existsSync(join(sentinels, 'pre-commit'))).toBe(true);
  });

  it.each(HOOKS)(
    '(d) %s in the owning checkout does not re-exec itself',
    (h) => {
      const r = runHook(primary, h);
      expect(r.status, r.stderr).toBe(0);
      expect(readdirSync(sentinels)).toEqual([]);
    },
  );
});

describe('(e) a worktree without its own copy of the hook', () => {
  beforeEach(() => setup(real, []));
  it.each(HOOKS)('%s falls through to the foreign body', (h) => {
    const r = runHook(wt, h);
    expect(r.status, r.stderr).toBe(0);
    expect(readdirSync(sentinels)).toEqual([]);
  });
});

describe('(f) paired negative — block stripped from the primary copy', () => {
  beforeEach(() => setup((h) => stripBlock(real(h))));

  it.each(HOOKS)('%s runs the FOREIGN hook, not the worktree’s own', (h) => {
    expect(stripBlock(real(h))).not.toContain(MARKER);
    runHook(wt, h);
    expect(existsSync(join(sentinels, h))).toBe(false);
  });

  it('a real `git commit` skips the worktree’s own pre-commit', () => {
    git(wt, 'commit', '-q', '--allow-empty', '-m', 'x');
    expect(existsSync(join(sentinels, 'pre-commit'))).toBe(false);
  });
});
