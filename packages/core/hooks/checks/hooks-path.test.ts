/**
 * Tests for ensureOwnHooks — the pre-push preflight that keeps a worktree from running a
 * FOREIGN checkout's stale `.husky/*` (incident 2026-09-30, #1983: the desktop app pins every
 * worktree's core.hooksPath to `<primary>/.husky`, and the primary was 457 commits behind).
 *
 * Arms:
 *   (own)        hooksPath resolves to this worktree's .husky → nothing to do.
 *   (delegate)   foreign dir whose hooks carry the self-delegate block → left alone (the app
 *                rewrites the value on every open; fighting it buys nothing once hooks delegate).
 *   (identical)  foreign dir byte-identical to ours → left alone.
 *   (heal)       foreign dir with a stale, non-delegating hook → per-worktree config repaired.
 *   (missing)    foreign dir lacking one of our hooks → that hook never ran → repaired.
 *   (fail)       repair impossible (no worktreeConfig extension, several worktrees) → 'failed',
 *                config untouched — the caller blocks.
 * The (delegate)/(identical) arms are the paired negatives of (heal): same fixture, only the
 * foreign content differs, and no config write happens.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DELEGATE_MARKER, ensureOwnHooks } from './hooks-path.ts';

const OWN = '#!/bin/sh\necho own\n';

let tmp: string;
let primary: string;
let wt: string;

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function writeHooks(dir: string, hooks: Record<string, string>): void {
  mkdirSync(dir, { recursive: true });
  for (const [h, body] of Object.entries(hooks)) {
    writeFileSync(join(dir, h), body);
    chmodSync(join(dir, h), 0o755);
  }
}

/** A primary + one linked worktree; core.hooksPath pinned absolute into the primary. */
function setup(
  foreign: Record<string, string>,
  { worktreeConfig = true } = {},
): void {
  tmp = realpathSync(mkdtempSync(join(tmpdir(), 'hooks-path-')));
  primary = join(tmp, 'primary');
  wt = join(tmp, 'wt');
  git(tmp, 'init', '-q', '-b', 'main', primary);
  git(primary, 'config', 'user.email', 't@t');
  git(primary, 'config', 'user.name', 't');
  git(primary, 'commit', '-q', '--allow-empty', '-m', 'init');
  git(primary, 'worktree', 'add', '-q', '-b', 'wt', wt);
  writeHooks(join(primary, '.husky'), foreign);
  writeHooks(join(wt, '.husky'), { 'pre-commit': OWN, 'pre-push': OWN });
  if (worktreeConfig)
    git(primary, 'config', 'extensions.worktreeConfig', 'true');
  git(primary, 'config', 'core.hooksPath', join(primary, '.husky'));
}

const worktreeValue = () =>
  spawnSync('git', ['config', '--worktree', '--get', 'core.hooksPath'], {
    cwd: wt,
    encoding: 'utf8',
  }).stdout.trim();

afterEach(() => {
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

describe('ensureOwnHooks', () => {
  it('(own) returns own when hooksPath already resolves to this worktree', () => {
    setup({ 'pre-commit': '#!/bin/sh\necho stale\n', 'pre-push': OWN });
    git(wt, 'config', '--worktree', 'core.hooksPath', '.husky');
    expect(ensureOwnHooks(wt)).toEqual({ status: 'own' });
  });

  it('(delegate) leaves a foreign dir alone when its hooks carry the delegate block', () => {
    const delegating = `#!/bin/sh\n# ${DELEGATE_MARKER} (begin)\necho old\n`;
    setup({ 'pre-commit': delegating, 'pre-push': delegating });
    expect(ensureOwnHooks(wt)).toEqual({
      status: 'delegating',
      dir: join(primary, '.husky'),
    });
    expect(worktreeValue()).toBe('');
  });

  it('(identical) leaves a byte-identical foreign dir alone', () => {
    setup({ 'pre-commit': OWN, 'pre-push': OWN });
    expect(ensureOwnHooks(wt).status).toBe('delegating');
    expect(worktreeValue()).toBe('');
  });

  it('(heal) repoints a worktree whose foreign pre-commit is stale and non-delegating', () => {
    setup({ 'pre-commit': '#!/bin/sh\necho stale\n', 'pre-push': OWN });
    expect(ensureOwnHooks(wt)).toEqual({
      status: 'healed',
      dir: join(primary, '.husky'),
      stale: ['pre-commit'],
    });
    expect(worktreeValue()).toBe('.husky');
    expect(
      git(wt, 'rev-parse', '--path-format=absolute', '--git-path', 'hooks'),
    ).toBe(join(wt, '.husky'));
    // Scoped to this worktree: the primary's own resolution is untouched.
    expect(
      git(
        primary,
        'rev-parse',
        '--path-format=absolute',
        '--git-path',
        'hooks',
      ),
    ).toBe(join(primary, '.husky'));
  });

  it('(missing) counts a hook the foreign dir lacks as stale — git would run nothing', () => {
    setup({ 'pre-commit': OWN });
    expect(ensureOwnHooks(wt)).toMatchObject({
      status: 'healed',
      stale: ['pre-push'],
    });
  });

  it('(fail) reports failed and writes nothing when per-worktree config is unavailable', () => {
    setup(
      { 'pre-commit': '#!/bin/sh\necho stale\n', 'pre-push': OWN },
      { worktreeConfig: false },
    );
    const r = ensureOwnHooks(wt);
    expect(r).toMatchObject({ status: 'failed', stale: ['pre-commit'] });
    expect(
      git(wt, 'rev-parse', '--path-format=absolute', '--git-path', 'hooks'),
    ).toBe(join(primary, '.husky'));
  });
});
