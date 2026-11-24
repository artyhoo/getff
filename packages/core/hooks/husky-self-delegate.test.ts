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
 *   (b2) STDIN: pre-push's ref lines reach the worktree's own hook through the exec.
 *   (d) NO LOOP: in the checkout that owns the hooks the body runs exactly once, under an
 *       absolute and a relative hooksPath (a counter planted right after the block).
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
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HUSKY = resolve(REPO_ROOT, '.husky');
const MARKER = 'husky-own-worktree-delegate';

// Tracked hook files only — a local .DS_Store or `pre-commit.orig` is not a hook.
const HOOKS = execFileSync('git', ['ls-files', '-z', '--', '.husky'], {
  cwd: REPO_ROOT,
  encoding: 'utf8',
})
  .split('\0')
  .filter((p) => /^\.husky\/[^/]+$/.test(p))
  .map((p) => p.slice('.husky/'.length));

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
    // Records stdin, so the pre-push arm can check the ref lines survived the hand-off.
    writeFileSync(p, `#!/bin/sh\ncat > "${sentinels}/${h}"\nexit 0\n`);
    chmodSync(p, 0o755);
  }
  // An absolute path into the primary checkout, as the desktop app writes — it puts the value
  // in config.worktree, this fixture in the shared config; git resolves both alike here.
  git(primary, 'config', 'core.hooksPath', join(primary, '.husky'));
}

// A re-exec loop would hang; the timeout turns it into a failed status instead.
function runHook(cwd: string, hook: string, stdinFile?: string) {
  const toStdin = stdinFile ? [`--to-stdin=${stdinFile}`] : [];
  return spawnSync(
    'git',
    ['hook', 'run', ...toStdin, hook, '--', ...(HOOK_ARGS[hook] ?? [])],
    { cwd, encoding: 'utf8', timeout: 20_000 },
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

  it('(b2) pre-push receives the ref lines on stdin through the hand-off', () => {
    const refs = join(tmp, 'refs');
    writeFileSync(refs, 'refs/heads/wt abc refs/heads/wt 000\n');
    const r = runHook(wt, 'pre-push', refs);
    expect(r.status, r.stderr).toBe(0);
    expect(readFileSync(join(sentinels, 'pre-push'), 'utf8')).toBe(
      'refs/heads/wt abc refs/heads/wt 000\n',
    );
  });
});

describe('(d) in the checkout that owns the hooks the body runs exactly once', () => {
  // The real file plus a counter right after the block: a re-exec would count twice.
  const counted = (h: string) =>
    real(h).replace(
      /(# ── husky-own-worktree-delegate \(end\)[^\n]*\n)/,
      `$1echo ran >> "${'$'}{HOOK_COUNTER_DIR}/${h}"\n`,
    );
  beforeEach(() => setup(counted));

  it.each(HOOKS)('%s under the absolute hooksPath', (h) => {
    expect(counted(h)).not.toBe(real(h));
    const r = spawnSync(
      'git',
      ['hook', 'run', h, '--', ...(HOOK_ARGS[h] ?? [])],
      {
        cwd: primary,
        encoding: 'utf8',
        timeout: 20_000,
        env: { ...process.env, HOOK_COUNTER_DIR: sentinels },
      },
    );
    expect(r.status, r.stderr).toBe(0);
    expect(readFileSync(join(sentinels, h), 'utf8')).toBe('ran\n');
  });

  it.each(HOOKS)(
    '%s under a RELATIVE hooksPath (`.husky`, relative script path)',
    (h) => {
      git(primary, 'config', 'core.hooksPath', '.husky');
      const r = spawnSync(
        'git',
        ['hook', 'run', h, '--', ...(HOOK_ARGS[h] ?? [])],
        {
          cwd: primary,
          encoding: 'utf8',
          timeout: 20_000,
          env: { ...process.env, HOOK_COUNTER_DIR: sentinels },
        },
      );
      expect(r.status, r.stderr).toBe(0);
      expect(readFileSync(join(sentinels, h), 'utf8')).toBe('ran\n');
    },
  );
});

describe('(e) a worktree without its own copy of the hook', () => {
  beforeEach(() => setup(real, []));
  // Exit 0 is the assertion: without the `-x` guard the hook would exec a missing file (127).
  it.each(HOOKS)('%s falls through to the foreign body', (h) => {
    const r = runHook(wt, h);
    expect(r.status, r.stderr).toBe(0);
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
