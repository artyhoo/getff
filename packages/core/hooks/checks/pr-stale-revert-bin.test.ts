import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkStaleRevert, collectArchaeology, gitProviderAt } from './pr-stale-revert.ts';

const BIN = fileURLToPath(new URL('./pr-stale-revert-bin.ts', import.meta.url));

/**
 * tsx is spawned by absolute path, not via `npx`: these runs use `cwd: <fixture repo>`
 * (the bin reads git from the process cwd), and an `npx` there would resolve nothing
 * locally and try the network. `packages/core/node_modules` is the CI layout
 * (`npm ci --prefix packages/core`); the repo-root one is the workspace-hoisted layout.
 */
function resolveTsx(): string {
  for (const rel of ['../../node_modules/.bin/tsx', '../../../../node_modules/.bin/tsx']) {
    const p = fileURLToPath(new URL(rel, import.meta.url));
    if (existsSync(p)) return p;
  }
  return '';
}
const TSX = resolveTsx();

const KICKOFF = 'kickoff.md';
let repo = '';
/** C1 = the pre-#1283 content, C2 = the base tip, STALE = the squash-rebuild, CLEAN = a normal PR. */
let C1 = '';
let C2 = '';
let STALE = '';
let CLEAN = '';

function git(...args: string[]): string {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
function commit(message: string): string {
  git('add', '-A');
  git('-c', 'user.email=t@example.com', '-c', 'user.name=T', 'commit', '-q', '--no-verify', '-m', message);
  return git('rev-parse', 'HEAD').trim();
}
function write(name: string, content: string): void {
  writeFileSync(join(repo, name), content);
}

/**
 * A throwaway repository reproducing the #1285 shape: a branch forked from the base
 * tip that commits an OLDER version of a tracked file back over it.
 *
 *   C1  kickoff.md = rev1
 *   C2  kickoff.md = rev2                       ← BASE (what #1283 shipped)
 *   STALE (from C2)  kickoff.md = rev1 again    ← the silent reversion
 *   CLEAN (from C2)  kickoff.md = rev3          ← an ordinary forward change
 */
beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), 'stale-revert-'));
  git('init', '-q', '-b', 'staging');
  write(KICKOFF, 'rev1\n');
  write('other.txt', 'untouched\n');
  C1 = commit('c1: kickoff rev 1');
  write(KICKOFF, 'rev2\n');
  C2 = commit('c2: kickoff rev 2 (#1283)');
  git('checkout', '-q', '-b', 'stale', C2);
  write(KICKOFF, 'rev1\n');
  write('other.txt', 'the PR own change\n');
  STALE = commit('squash-rebuild: whole tree from the older fork point');
  git('checkout', '-q', '-b', 'clean', C2);
  write(KICKOFF, 'rev3\n');
  CLEAN = commit('an ordinary forward change');
});

afterAll(() => {
  if (repo) rmSync(repo, { recursive: true, force: true });
});

/** Run the bin with an env set; returns { code, stdout, stderr }. */
function run(env: Record<string, string | undefined>) {
  try {
    const stdout = execFileSync(TSX, [BIN], {
      cwd: repo,
      env: { ...process.env, BASE_REF: undefined, BASE_SHA: undefined, HEAD_SHA: undefined, PR_BODY: undefined, ...env },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, stdout, stderr: '' };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? 1, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
  }
}

describe('pr-stale-revert real-git archaeology (shipped provider, fixture repo)', () => {
  it('flags the stale-revert branch and names the discarded base commit', () => {
    const { mergeBase, files } = collectArchaeology(gitProviderAt(repo), C2, STALE);
    expect(mergeBase).toBe(C2);
    const findings = checkStaleRevert(files);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.path).toBe(KICKOFF);
    expect(findings[0]?.matchedCommit).toBe(C1);
    expect(findings[0]?.discardedCommits).toEqual([C2]);
  });

  it('PAIRED-NEGATIVE: the same walk over an ordinary forward change finds nothing [M-stale-git]', () => {
    // ❌ stale branch → 1 finding (above)   ✅ clean branch → 0 findings (here)
    const { files } = collectArchaeology(gitProviderAt(repo), C2, CLEAN);
    expect(checkStaleRevert(files)).toHaveLength(0);
  });

  it('does not flag the PR own novel edit to a second file (no false positive)', () => {
    const { files } = collectArchaeology(gitProviderAt(repo), C2, STALE);
    expect(files.map((f) => f.path)).toContain('other.txt');
    expect(checkStaleRevert(files).map((f) => f.path)).not.toContain('other.txt');
  });
});

describe('pr-stale-revert-bin exit codes (end-to-end against real git)', () => {
  it('resolves a tsx binary to spawn (fails loudly rather than skipping)', () => {
    expect(TSX, 'tsx not found in packages/core/node_modules nor at the repo root').not.toBe('');
  });

  it('exits 1 and names the reverted file on the stale-revert branch', () => {
    const r = run({ BASE_REF: 'staging', BASE_SHA: C2, HEAD_SHA: STALE, PR_BODY: '## Summary\nx\n' });
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/::error::/);
    expect(r.stderr).toContain(KICKOFF);
    expect(r.stderr).toContain(C1);
    expect(r.stderr).toMatch(/git-conflict-merge-forward\.md/);
  });

  it('exits 0 with an acknowledgement when the PR body carries a valid STALE-REVERT token', () => {
    const body = '## Summary\nrestoring\n\nSTALE-REVERT: intended — restoring content clobbered by the #1285 squash-rebuild\n';
    const r = run({ BASE_REF: 'staging', BASE_SHA: C2, HEAD_SHA: STALE, PR_BODY: body });
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/ACKNOWLEDGED/);
    expect(r.stdout).toContain(KICKOFF);
  });

  it('exits 1 when the token is present but its rationale is too short', () => {
    const r = run({
      BASE_REF: 'staging',
      BASE_SHA: C2,
      HEAD_SHA: STALE,
      PR_BODY: 'STALE-REVERT: intended — yes\n',
    });
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/>=20 chars/);
  });

  it('exits 0 on an ordinary forward change', () => {
    const r = run({ BASE_REF: 'staging', BASE_SHA: C2, HEAD_SHA: CLEAN, PR_BODY: '' });
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/pr-stale-revert: OK/);
  });
});

describe('pr-stale-revert-bin env contract (fails closed on misconfiguration)', () => {
  it('exits 1 when BASE_REF is unset (must not degrade to a green no-op)', () => {
    const r = run({ BASE_SHA: C2, HEAD_SHA: STALE });
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/BASE_REF env var is required/);
  });

  it('exits 0 out-of-scope for an explicitly different non-empty base ref', () => {
    const r = run({ BASE_REF: 'main', BASE_SHA: C2, HEAD_SHA: STALE });
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/out of scope/);
  });

  it('exits 1 when BASE_SHA is unset on a staging PR', () => {
    const r = run({ BASE_REF: 'staging', HEAD_SHA: STALE });
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/BASE_SHA and HEAD_SHA env vars are required/);
  });

  it('exits 1 when HEAD_SHA does not resolve in the checkout (shallow / wrong ref)', () => {
    const r = run({
      BASE_REF: 'staging',
      BASE_SHA: C2,
      HEAD_SHA: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    });
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/does not resolve to a commit in this checkout/);
    expect(r.stderr).toMatch(/fetch-depth: 0/);
  });
});
