/**
 * Tests for scripts/install-coordination-wiring.sh — the one-click wiring of the
 * coordination linker into channel G (git post-checkout) and channel B (CC SessionStart).
 *
 * REPO-IDENTITY GUARD (2026-09-30, the backward sweep after getff#1967): the script took
 * its target from the CURRENT cwd's git toplevel, so a run from a scratch consumer repo
 * wrote a post-checkout hook into that repo's hooks dir and a SessionStart entry into its
 * `.claude/settings.json` — the same wrong-target class as the link-coordination incident.
 *
 *   (w1) FOREIGN CWD: refused (exit 3) — no hook written, settings.json byte-identical
 *   (w2) OWN CHECKOUT as cwd: both channels still wired (the guard does not over-block)
 *   (w3) OWN LINKED WORKTREE as cwd: wired into that worktree
 *   (w4) a RELATIVE core.hooksPath resolves against the checkout root, not the cwd subdir
 *   (w-neg) PAIRED-NEGATIVE: with the guard stripped, the foreign repo IS written (the gap)
 *
 * Every fixture copies the script into a throwaway repo and points HOME at a temp dir,
 * so no run touches this checkout's hooks or settings, nor ~/.superset.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawnSync, execSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const SCRIPT = resolve(REPO_ROOT, 'scripts/install-coordination-wiring.sh');
const SETTINGS_SEED = '{"permissions":{},"hooks":{}}\n';

function initRepo(prefix: string): string {
  const dir = mkdtempSync(resolve(tmpdir(), prefix));
  execSync('git init -q -b main', { cwd: dir });
  execSync('git config user.email test@example.com && git config user.name test', { cwd: dir });
  mkdirSync(resolve(dir, '.claude'), { recursive: true });
  writeFileSync(resolve(dir, '.claude/settings.json'), SETTINGS_SEED);
  writeFileSync(resolve(dir, 'README.md'), `${prefix}\n`);
  execSync('git add -A && git commit -q -m init', { cwd: dir });
  return dir;
}

/** Install the script (and the linker it wires) into `<repo>/scripts/` — the production shape. */
function installScript(repo: string, src: string = readFileSync(SCRIPT, 'utf8')): string {
  mkdirSync(resolve(repo, 'scripts'), { recursive: true });
  writeFileSync(resolve(repo, 'scripts/link-coordination.sh'), '#!/usr/bin/env bash\nexit 0\n', { mode: 0o755 });
  const p = resolve(repo, 'scripts/install-coordination-wiring.sh');
  writeFileSync(p, src, { mode: 0o755 });
  return p;
}

function run(script: string, cwd: string, home: string): { status: number; stderr: string } {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined && !k.startsWith('GIT_')) env[k] = v;
  }
  env.HOME = home;
  env.GIT_CONFIG_NOSYSTEM = '1';
  const r = spawnSync('bash', [script], { cwd, env, encoding: 'utf8' });
  return { status: r.status ?? -1, stderr: r.stderr };
}

const hookOf = (repo: string): string => resolve(repo, '.husky/post-checkout');
const settingsOf = (repo: string): string => resolve(repo, '.claude/settings.json');
const sessionStartWired = (repo: string): boolean =>
  readFileSync(settingsOf(repo), 'utf8').includes('link-coordination');

describe('install-coordination-wiring.sh — repo-identity guard', () => {
  let own: string;
  let foreign: string;
  let home: string;
  let script: string;

  beforeEach(() => {
    own = initRepo('wiring-own-');
    foreign = initRepo('wiring-foreign-');
    home = mkdtempSync(resolve(tmpdir(), 'wiring-home-'));
    script = installScript(own);
  });

  afterEach(() => {
    for (const d of [own, foreign, home]) rmSync(d, { recursive: true, force: true });
  });

  it('(w1) FOREIGN CWD: refused (exit 3), no hook written, settings untouched', () => {
    const r = run(script, foreign, home);
    expect(r.status, `stderr: ${r.stderr}`).toBe(3);
    expect(r.stderr).toContain('not a checkout of');
    expect(existsSync(hookOf(foreign)), 'no post-checkout hook may land in the foreign repo').toBe(false);
    expect(readFileSync(settingsOf(foreign), 'utf8')).toBe(SETTINGS_SEED);
  });

  it('(w2) OWN CHECKOUT as cwd: G and B are wired', () => {
    const r = run(script, own, home);
    expect(r.status, `stderr: ${r.stderr}`).toBe(0);
    expect(readFileSync(hookOf(own), 'utf8')).toContain('coordination-persistence');
    expect(sessionStartWired(own)).toBe(true);
  });

  it('(w3) OWN LINKED WORKTREE as cwd: wired into that worktree', () => {
    const wt = resolve(own, 'wt-own');
    execSync(`git worktree add -q "${wt}" HEAD`, { cwd: own });
    writeFileSync(settingsOf(wt), SETTINGS_SEED);
    const r = run(script, wt, home);
    expect(r.status, `stderr: ${r.stderr}`).toBe(0);
    expect(existsSync(hookOf(wt))).toBe(true);
    expect(sessionStartWired(wt)).toBe(true);
  });

  it('(w4) RELATIVE core.hooksPath resolves against the checkout root, not the cwd subdir', () => {
    execSync('git config core.hooksPath .husky', { cwd: own });
    const sub = resolve(own, 'packages/app');
    mkdirSync(sub, { recursive: true });
    const r = run(script, sub, home);
    expect(r.status, `stderr: ${r.stderr}`).toBe(0);
    expect(existsSync(hookOf(own)), 'the hook belongs in <root>/.husky').toBe(true);
    expect(existsSync(resolve(sub, '.husky')), 'nothing may land in the cwd subdir').toBe(false);
  });

  it('(w-neg) PAIRED-NEGATIVE: with the guard stripped, the foreign repo IS written', () => {
    const src = readFileSync(SCRIPT, 'utf8');
    const stripped = src.replace(/# ── REPO-IDENTITY GUARD[\s\S]*?# ── END REPO-IDENTITY GUARD[^\n]*\n/, '');
    expect(stripped, 'the REPO-IDENTITY GUARD block must be present to strip').not.toBe(src);
    run(installScript(own, stripped), foreign, home);
    expect(existsSync(hookOf(foreign)), 'without the guard the foreign repo receives the hook').toBe(true);
  });
});
