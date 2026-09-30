/**
 * Tests for scripts/format-shipped.sh — which repository its `--write` path formats.
 *
 * REPO-ANCHOR (2026-09-30, the deferred half of the getff#1971 backward sweep): the script
 * resolved its root from the CURRENT cwd's git toplevel, so `bash /abs/path/scripts/
 * format-shipped.sh --write` run from a scratch consumer repo rewrote that repo's files under
 * the shipped pathspecs (skills/, agents/, templates/, …) in place. The script's intent is
 * always «the shipped surface of the repository this script lives in», so the root now
 * anchors to the script's own checkout.
 *
 * Prettier is replaced by a PATH-shimmed `npx` that appends a marker to every file argument —
 * the observable is exactly the write the real `prettier --write` would do, with no network.
 *
 *   (f1) FOREIGN CWD + --write: the foreign repo's shipped file is byte-identical; the
 *        script's own shipped file is the one written
 *   (f2) OWN CHECKOUT (subdir) as cwd: the own shipped file is written
 *   (f3) OWN LINKED WORKTREE: the copy in that worktree writes that worktree's file
 *   (f-neg) PAIRED-NEGATIVE: with the REPO-ANCHOR block stripped, the foreign file IS written
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const SCRIPT = resolve(REPO_ROOT, 'scripts/format-shipped.sh');
const SEED = '{"a":1}\n';
const MARK = 'FORMATTED-BY-SHIM';

/** A repo with one tracked file under a shipped pathspec (templates/). */
function initRepo(prefix: string): string {
  const dir = mkdtempSync(resolve(tmpdir(), prefix));
  execSync('git init -q -b main', { cwd: dir });
  execSync('git config user.email test@example.com && git config user.name test', { cwd: dir });
  mkdirSync(resolve(dir, 'templates'), { recursive: true });
  writeFileSync(resolve(dir, 'templates/shipped.json'), SEED);
  writeFileSync(resolve(dir, '.gitignore'), 'wt-*/\n');
  execSync('git add -A && git commit -q -m init', { cwd: dir });
  return dir;
}

function installScript(repo: string, src: string = readFileSync(SCRIPT, 'utf8')): string {
  mkdirSync(resolve(repo, 'scripts'), { recursive: true });
  const p = resolve(repo, 'scripts/format-shipped.sh');
  writeFileSync(p, src, { mode: 0o755 });
  return p;
}

/** `npx` stand-in: append MARK to every argument that is an existing file (relative to its cwd). */
function makeShim(): string {
  const bin = mkdtempSync(resolve(tmpdir(), 'fmt-shim-'));
  const npx = resolve(bin, 'npx');
  writeFileSync(npx, `#!/usr/bin/env bash\nfor a in "$@"; do [ -f "$a" ] && printf '${MARK}\\n' >> "$a"; done\nexit 0\n`);
  chmodSync(npx, 0o755);
  return bin;
}

function run(script: string, cwd: string, shim: string): { status: number; out: string } {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined && !k.startsWith('GIT_')) env[k] = v;
  }
  env.PATH = `${shim}:${env.PATH ?? ''}`;
  env.GIT_CONFIG_NOSYSTEM = '1';
  const r = spawnSync('bash', [script, '--write'], { cwd, env, encoding: 'utf8' });
  return { status: r.status ?? -1, out: `${r.stdout}${r.stderr}` };
}

const shipped = (repo: string): string => readFileSync(resolve(repo, 'templates/shipped.json'), 'utf8');

describe('format-shipped.sh --write — repo anchor', () => {
  let own: string;
  let foreign: string;
  let shim: string;
  let script: string;

  beforeEach(() => {
    own = initRepo('fmt-own-');
    foreign = initRepo('fmt-foreign-');
    shim = makeShim();
    script = installScript(own);
  });

  afterEach(() => {
    for (const d of [own, foreign, shim]) rmSync(d, { recursive: true, force: true });
  });

  it('(f1) FOREIGN CWD: the foreign shipped file is untouched; the own one is written', () => {
    const r = run(script, foreign, shim);
    expect(shipped(foreign), `the foreign repo must not be formatted\n${r.out}`).toBe(SEED);
    expect(shipped(own), r.out).toContain(MARK);
  });

  it('(f2) OWN CHECKOUT (a subdir) as cwd: the own shipped file is written', () => {
    const r = run(script, resolve(own, 'templates'), shim);
    expect(r.status, r.out).toBe(0);
    expect(shipped(own), r.out).toContain(MARK);
  });

  it('(f3) OWN LINKED WORKTREE: the copy in that worktree writes that worktree', () => {
    const wt = resolve(own, 'wt-linked');
    execSync(`git worktree add -q "${wt}" HEAD`, { cwd: own });
    const r = run(installScript(wt), wt, shim);
    expect(r.status, r.out).toBe(0);
    expect(shipped(wt), r.out).toContain(MARK);
    expect(shipped(foreign)).toBe(SEED);
  });

  it('(f-neg) PAIRED-NEGATIVE: with the REPO-ANCHOR block stripped, the foreign file IS written', () => {
    const src = readFileSync(SCRIPT, 'utf8');
    const stripped = src.replace(/# ── REPO-ANCHOR[\s\S]*?# ── END REPO-ANCHOR[^\n]*\n/, '');
    expect(stripped, 'the REPO-ANCHOR block must be present to strip').not.toBe(src);
    run(installScript(own, stripped), foreign, shim);
    expect(shipped(foreign), 'without the anchor the foreign repo is formatted').toContain(MARK);
  });
});
