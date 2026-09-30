/**
 * Tests for scripts/worktree-doctor.sh — the operator sweep that provisions node_modules
 * across every registered worktree.
 *
 * REPO-ANCHOR (2026-09-30, the deferred half of the getff#1971 backward sweep): with no
 * explicit <primary-dir>, the doctor took its primary from the CURRENT cwd's git common dir,
 * so `bash /abs/path/scripts/worktree-doctor.sh --fix` run from a scratch consumer repo
 * symlinked node_modules into THAT repo's worktrees. The sweep's intent is always «the
 * worktrees of the repository this script lives in», so the default now anchors to the
 * script's own checkout (an explicit <primary-dir> argument is still honoured as given).
 *
 *   (d1) FOREIGN CWD + --fix: the foreign repo's worktree is NOT provisioned; the sweep
 *        provisions the script's own repo instead
 *   (d2) OWN CHECKOUT as cwd: its unprovisioned linked worktree is fixed
 *   (d3) OWN LINKED WORKTREE as cwd (script run from that worktree): same repo, still fixed
 *   (d4) an exported GIT_DIR naming the foreign repo (a foreign hook's env): the foreign
 *        worktrees are still not enumerated or provisioned
 *   (d5) CDPATH naming a dir with its own scripts/: a relative run from the own checkout
 *        still sweeps the own repo
 *   (d-neg) PAIRED-NEGATIVE: with the REPO-ANCHOR block stripped, the foreign worktree IS
 *        provisioned (the gap the block closes)
 *
 * Every fixture is a throwaway repo; no run touches this checkout's worktrees.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execSync, spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const DOCTOR = resolve(REPO_ROOT, 'scripts/worktree-doctor.sh');
const HELPER = resolve(REPO_ROOT, 'scripts/worktree-node-modules.sh');

/** A primary checkout with a real node_modules (so provisioning is possible) + one bare linked worktree. */
function initRepoWithWorktree(prefix: string): { primary: string; wt: string } {
  const primary = mkdtempSync(resolve(tmpdir(), prefix));
  execSync('git init -q -b main', { cwd: primary });
  execSync('git config user.email test@example.com && git config user.name test', { cwd: primary });
  writeFileSync(resolve(primary, 'README.md'), `${prefix}\n`);
  writeFileSync(resolve(primary, '.gitignore'), 'node_modules\nwt-*/\n');
  execSync('git add -A && git commit -q -m init', { cwd: primary });
  mkdirSync(resolve(primary, 'node_modules/some-dep'), { recursive: true });
  const wt = resolve(primary, 'wt-linked');
  execSync(`git worktree add -q "${wt}" HEAD`, { cwd: primary });
  return { primary, wt };
}

/** Install the doctor + its helper into `<repo>/scripts/` — the production shape. */
function installDoctor(repo: string, src: string = readFileSync(DOCTOR, 'utf8')): string {
  mkdirSync(resolve(repo, 'scripts'), { recursive: true });
  writeFileSync(resolve(repo, 'scripts/worktree-node-modules.sh'), readFileSync(HELPER, 'utf8'), { mode: 0o755 });
  const p = resolve(repo, 'scripts/worktree-doctor.sh');
  writeFileSync(p, src, { mode: 0o755 });
  return p;
}

function run(
  script: string,
  cwd: string,
  args: string[] = ['--fix'],
  extra: Record<string, string> = {},
): { status: number; out: string } {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined && !k.startsWith('GIT_')) env[k] = v;
  }
  env.GIT_CONFIG_NOSYSTEM = '1';
  Object.assign(env, extra);
  const r = spawnSync('bash', [script, ...args], { cwd, env, encoding: 'utf8' });
  return { status: r.status ?? -1, out: `${r.stdout}${r.stderr}` };
}

const provisioned = (wt: string): boolean => {
  try {
    return lstatSync(resolve(wt, 'node_modules')).isSymbolicLink();
  } catch {
    return false;
  }
};

describe('worktree-doctor.sh — repo anchor', () => {
  let own: { primary: string; wt: string };
  let foreign: { primary: string; wt: string };
  let script: string;

  beforeEach(() => {
    own = initRepoWithWorktree('doctor-own-');
    foreign = initRepoWithWorktree('doctor-foreign-');
    script = installDoctor(own.primary);
  });

  afterEach(() => {
    for (const d of [own.primary, foreign.primary]) rmSync(d, { recursive: true, force: true });
  });

  it('(d1) FOREIGN CWD + --fix: the foreign worktree is not provisioned; the own repo is', () => {
    const r = run(script, foreign.primary);
    expect(provisioned(foreign.wt), `the foreign worktree must stay untouched\n${r.out}`).toBe(false);
    expect(provisioned(own.wt), `the sweep must act on the script's own repo\n${r.out}`).toBe(true);
    expect(r.status, r.out).toBe(0);
  });

  it('(d2) OWN CHECKOUT as cwd: the unprovisioned linked worktree is fixed', () => {
    const r = run(script, own.primary);
    expect(r.status, r.out).toBe(0);
    expect(provisioned(own.wt), r.out).toBe(true);
  });

  it('(d3) OWN LINKED WORKTREE: the script run from inside that worktree still sweeps its repo', () => {
    const wtScript = installDoctor(own.wt);
    const r = run(wtScript, own.wt);
    expect(r.status, r.out).toBe(0);
    expect(provisioned(own.wt), r.out).toBe(true);
    expect(existsSync(resolve(foreign.wt, 'node_modules'))).toBe(false);
  });

  it('(d4) exported GIT_DIR of the foreign repo: its worktrees are still left alone', () => {
    const r = run(script, foreign.primary, ['--fix'], { GIT_DIR: resolve(foreign.primary, '.git') });
    expect(provisioned(foreign.wt), `a foreign GIT_DIR must not redirect the sweep\n${r.out}`).toBe(false);
    expect(provisioned(own.wt), r.out).toBe(true);
  });

  it('(d5) CDPATH naming a dir with its own scripts/: a relative run still sweeps the own repo', () => {
    mkdirSync(resolve(foreign.primary, 'scripts'), { recursive: true });
    const r = run('scripts/worktree-doctor.sh', own.primary, ['--fix'], { CDPATH: foreign.primary });
    expect(r.status, r.out).toBe(0);
    expect(provisioned(own.wt), r.out).toBe(true);
    expect(provisioned(foreign.wt), r.out).toBe(false);
  });

  it('(d-neg) PAIRED-NEGATIVE: with the REPO-ANCHOR block stripped, the foreign worktree IS provisioned', () => {
    const src = readFileSync(DOCTOR, 'utf8');
    const stripped = src.replace(/# ── REPO-ANCHOR[\s\S]*?# ── END REPO-ANCHOR[^\n]*\n/, '');
    expect(stripped, 'the REPO-ANCHOR block must be present to strip').not.toBe(src);
    run(installDoctor(own.primary, stripped), foreign.primary);
    expect(provisioned(foreign.wt), 'without the anchor the foreign worktree receives node_modules').toBe(true);
  });
});
