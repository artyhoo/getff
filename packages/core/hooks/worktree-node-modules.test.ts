/**
 * Paired test for scripts/worktree-node-modules.sh — the single source of truth for worktree
 * node_modules provisioning, shared by .claude/hooks/worktree-setup.sh (CC channel) and
 * scripts/create-worktree.sh (portable channel).
 *
 * The load-bearing arm is CACHE-POISON (incident 2026-07-23): vitest materialises
 * `node_modules/.vite` inside a worktree the first time any suite runs there — including the
 * principles section of packages/core/hooks/pre-push.ts itself. The path then EXISTS, so the
 * old `[[ ! -e … ]]` guards in both channels were permanently false and the worktree could
 * never be provisioned; worse, `ln -sfn TARGET node_modules` against that directory produces
 * `node_modules/node_modules` — a link nested INSIDE the cache instead of replacing the path.
 * A live census found 32 of 125 worktrees in that state. Both the "heals it" and the "does not
 * nest" assertions below fail against the pre-fix logic.
 *
 * The REFUSAL arm is the guard on the other side: a worktree holding a real install must never
 * be clobbered, no matter how convenient replacing it would be.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync, execSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const SCRIPT = resolve(REPO_ROOT, 'scripts/worktree-node-modules.sh');

let primary: string;
let wt: string;

/** Primary checkout + a worktree directory, both bare of node_modules. */
function seed(opts: { primaryCore?: boolean } = {}): void {
  primary = mkdtempSync(resolve(tmpdir(), 'wnm-primary-'));
  execSync('git init -q -b main', { cwd: primary });
  execSync('git config user.email t@e.com && git config user.name t', { cwd: primary });
  writeFileSync(resolve(primary, 'README.md'), 'x\n');
  mkdirSync(resolve(primary, 'packages/core'), { recursive: true });
  writeFileSync(resolve(primary, 'packages/core/.keep'), '');
  execSync('git add . && git commit -q -m init', { cwd: primary });

  mkdirSync(resolve(primary, 'node_modules/.bin'), { recursive: true });
  writeFileSync(resolve(primary, 'node_modules/.bin/tsx'), '#!/bin/sh\n');
  if (opts.primaryCore !== false) {
    // The primary's REAL nested layer — the root lock plans dep versions here that diverge
    // from the root layer (incident 2026-07-02).
    mkdirSync(resolve(primary, 'packages/core/node_modules'), { recursive: true });
    writeFileSync(resolve(primary, 'packages/core/node_modules/.keep'), '');
  }

  wt = resolve(primary, '.claude/worktrees/w');
  execSync(`git worktree add -q "${wt}" -b wt main`, { cwd: primary });
}

function run(mode: '--check' | '--apply'): number {
  try {
    execFileSync('bash', [SCRIPT, mode, wt, primary], { encoding: 'utf8', stdio: 'pipe' });
    return 0;
  } catch (e) {
    return (e as { status?: number }).status ?? -1;
  }
}

/** Reproduce what vitest leaves behind on its first run inside a worktree. */
function plantViteCache(): void {
  mkdirSync(resolve(wt, 'node_modules/.vite'), { recursive: true });
  writeFileSync(resolve(wt, 'node_modules/.vite/deps.json'), '{}');
  mkdirSync(resolve(wt, 'node_modules/.vite-temp'), { recursive: true });
  mkdirSync(resolve(wt, 'packages/core/node_modules/.vite'), { recursive: true });
}

afterEach(() => {
  if (primary) rmSync(primary, { recursive: true, force: true });
});

describe('worktree-node-modules.sh — provisioning SSOT', () => {
  it('CACHE POISON: heals a node_modules holding only .vite* caches, without nesting', () => {
    seed();
    plantViteCache();

    // Pre-fix state: the path exists, so both channels' `[[ ! -e … ]]` guards skipped it.
    expect(existsSync(resolve(wt, 'node_modules'))).toBe(true);
    expect(lstatSync(resolve(wt, 'node_modules')).isSymbolicLink()).toBe(false);
    expect(run('--check')).toBe(1); // fixable, not yet provisioned

    expect(run('--apply')).toBe(0);

    expect(lstatSync(resolve(wt, 'node_modules')).isSymbolicLink()).toBe(true);
    expect(readlinkSync(resolve(wt, 'node_modules'))).toBe(resolve(primary, 'node_modules'));
    // The nesting footgun: `ln -sfn TARGET <existing dir>` would have created this.
    expect(existsSync(resolve(wt, 'node_modules/node_modules'))).toBe(false);
    // The whole point — the toolchain is reachable again.
    expect(existsSync(resolve(wt, 'node_modules/.bin/tsx'))).toBe(true);
    expect(run('--check')).toBe(0);
  });

  it('points packages/core at the primary REAL nested dir, not ../../node_modules', () => {
    seed({ primaryCore: true });
    expect(run('--apply')).toBe(0);
    // A ../../node_modules link would SHADOW the nested layer and fake synth-bundle drift
    // in every fresh worktree (incident 2026-07-02).
    expect(readlinkSync(resolve(wt, 'packages/core/node_modules'))).toBe(
      resolve(primary, 'packages/core/node_modules'),
    );
  });

  it('falls back to ../../node_modules when the primary has no nested dir', () => {
    seed({ primaryCore: false });
    expect(run('--apply')).toBe(0);
    expect(readlinkSync(resolve(wt, 'packages/core/node_modules'))).toBe('../../node_modules');
  });

  it('REFUSAL: never clobbers a worktree holding a real install', () => {
    seed();
    mkdirSync(resolve(wt, 'node_modules/some-package'), { recursive: true });
    writeFileSync(resolve(wt, 'node_modules/some-package/index.js'), '// real\n');
    mkdirSync(resolve(wt, 'packages/core/node_modules/dep'), { recursive: true });

    expect(run('--check')).toBe(0); // a real install IS provisioned
    expect(run('--apply')).toBe(0);

    expect(lstatSync(resolve(wt, 'node_modules')).isSymbolicLink()).toBe(false);
    expect(existsSync(resolve(wt, 'node_modules/some-package/index.js'))).toBe(true);
  });

  it('re-points a DANGLING symlink (not provisioned, but safe to replace)', () => {
    seed();
    symlinkSync(resolve(primary, 'gone-away'), resolve(wt, 'node_modules'));
    expect(run('--check')).toBe(1);
    expect(run('--apply')).toBe(0);
    expect(readlinkSync(resolve(wt, 'node_modules'))).toBe(resolve(primary, 'node_modules'));
  });

  it('is idempotent — a second apply changes nothing', () => {
    seed();
    expect(run('--apply')).toBe(0);
    const before = readlinkSync(resolve(wt, 'node_modules'));
    expect(run('--apply')).toBe(0);
    expect(readlinkSync(resolve(wt, 'node_modules'))).toBe(before);
    expect(existsSync(resolve(wt, 'node_modules/node_modules'))).toBe(false);
  });

  it('exits 2 when the primary itself has no node_modules (unfixable, no partial state)', () => {
    seed();
    rmSync(resolve(primary, 'node_modules'), { recursive: true, force: true });
    rmSync(resolve(primary, 'packages/core/node_modules'), { recursive: true, force: true });
    plantViteCache();

    expect(run('--apply')).toBe(2);
    // Nothing half-applied: the cache dir is still a plain dir, no symlink was left behind.
    expect(lstatSync(resolve(wt, 'node_modules')).isSymbolicLink()).toBe(false);
  });

  it('--check never writes', () => {
    seed();
    plantViteCache();
    expect(run('--check')).toBe(1);
    expect(lstatSync(resolve(wt, 'node_modules')).isSymbolicLink()).toBe(false);
    expect(existsSync(resolve(wt, 'node_modules/.vite/deps.json'))).toBe(true);
  });
});
