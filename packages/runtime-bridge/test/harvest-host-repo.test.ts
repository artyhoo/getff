// packages/runtime-bridge/test/harvest-host-repo.test.ts
/**
 * resolveHostRepo — the host clone Channel A fetches the task bundle into and pushes from.
 *
 * Without `--host-repo` it defaulted to the cwd's git toplevel. From a scratch consumer repo
 * the shell had cd'd into, harvest fetched the task branch INTO that repo and pushed it to
 * that repo's origin — the wrong-target class of getff#1967 (backward sweep, 2026-09-30).
 *
 * The default now has to be a checkout of the repository harvest.ts itself lives in (same
 * git common dir). In a consumer install the vendored copy sits inside the consumer's repo
 * (`.claude/vendor/runtime-bridge/`), so it keeps serving the consumer.
 *
 *   (h1) FOREIGN CWD: refused, and the error names the --host-repo escape
 *   (h2) OWN CHECKOUT subdir as cwd: its toplevel (unchanged)
 *   (h3) OWN LINKED WORKTREE as cwd: that worktree (unchanged — its pre-push runs)
 *   (h4) an explicit host repo still wins, whatever the cwd
 *   (h5) harvest.ts outside any checkout: the cwd toplevel (unchanged)
 *   (h6) cwd outside any checkout: the pre-existing "not a git checkout" error
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { resolveHostRepo } from '../src/cli/harvest.js';

function initRepo(prefix: string): string {
  const dir = realpathSync(mkdtempSync(resolve(tmpdir(), prefix)));
  execSync('git init -q -b main && git config user.email t@e.x && git config user.name t', { cwd: dir });
  writeFileSync(resolve(dir, 'README.md'), `${prefix}\n`);
  execSync('git add -A && git commit -q -m init', { cwd: dir });
  return dir;
}

/** A harvest.ts path inside `root` — the file itself is never read, only its location. */
function selfIn(root: string): string {
  const cli = resolve(root, 'packages/runtime-bridge/src/cli');
  mkdirSync(cli, { recursive: true });
  return resolve(cli, 'harvest.ts');
}

describe('resolveHostRepo — the default host clone must be a checkout of harvest’s own repo', () => {
  let own: string;
  let foreign: string;
  const extra: string[] = [];

  beforeEach(() => {
    own = initRepo('harvest-own-');
    foreign = initRepo('harvest-foreign-');
  });

  afterEach(() => {
    for (const d of [own, foreign, ...extra.splice(0)]) rmSync(d, { recursive: true, force: true });
  });

  it('(h1) FOREIGN CWD: refused, naming the --host-repo escape', () => {
    expect(() => resolveHostRepo(undefined, foreign, selfIn(own))).toThrow(/not a checkout of[\s\S]*--host-repo/);
  });

  it('(h2) OWN CHECKOUT subdir as cwd: its toplevel', () => {
    const sub = resolve(own, 'packages/app');
    mkdirSync(sub, { recursive: true });
    expect(resolveHostRepo(undefined, sub, selfIn(own))).toBe(own);
  });

  it('(h3) OWN LINKED WORKTREE as cwd: that worktree', () => {
    const wt = resolve(own, 'wt-own');
    execSync(`git worktree add -q "${wt}" HEAD`, { cwd: own });
    expect(resolveHostRepo(undefined, wt, selfIn(own))).toBe(wt);
  });

  it('(h4) an explicit host repo wins, whatever the cwd', () => {
    expect(resolveHostRepo('/explicit/host', foreign, selfIn(own))).toBe('/explicit/host');
  });

  it('(h5) harvest.ts outside any checkout: the cwd toplevel', () => {
    const loose = realpathSync(mkdtempSync(resolve(tmpdir(), 'harvest-loose-')));
    extra.push(loose);
    expect(resolveHostRepo(undefined, foreign, selfIn(loose))).toBe(foreign);
  });

  it('(h6) cwd outside any checkout: the "not a git checkout" error', () => {
    const plain = realpathSync(mkdtempSync(resolve(tmpdir(), 'harvest-nogit-')));
    extra.push(plain);
    expect(() => resolveHostRepo(undefined, plain, selfIn(own))).toThrow(/not a git checkout/);
  });
});
