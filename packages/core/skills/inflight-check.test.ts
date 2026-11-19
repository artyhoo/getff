/**
 * Paired-negative tests for inflight-check.sh — pre-dispatch live-work ledger.
 *
 * Complements dup-detect.test.ts: dup-detect catches MERGED duplicates;
 * inflight-check catches work happening RIGHT NOW (open PR or un-merged live
 * branch/worktree carrying the umbrella slug — e.g. a parallel session
 * dispatching the same sub-wave before it merges).
 *
 * Principle 02 contract (both arms required):
 *   ✅ Positive: live work present (open PR / un-merged branch) → INFLIGHT emitted
 *   ❌ Paired-negative: no live work → CLEAR emitted, no INFLIGHT
 *
 * The test MUST FAIL if inflight-check.sh is reverted to a no-op returning only
 * CLEAR lines (the positive arms would stop emitting INFLIGHT).
 *
 * Seams used (env vars forwarded to the shell script):
 *   REPO_ROOT              — temp dir the script cd's into for git ops
 *   MO_GH_BIN              — path to a mock-gh returning `pr list` JSON
 *   MO_GIT_BIN             — path to a mock-git returning branch/worktree output
 *   MO_BASE_REF            — base ref for --no-merged (irrelevant under mock-git)
 *   MO_INFLIGHT_MIN_TOKENS — token-overlap threshold (default 2)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, chmodSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT_REAL = resolve(HERE, '../../..');
const SCRIPT = resolve(
  REPO_ROOT_REAL,
  '.agents/procedures/pipeline/helpers/inflight-check.sh',
);

// ── Fixture state shared across tests ────────────────────────────────────────

let tmpRoot: string;
let binDir: string;
let mockGhBin: string;
let mockGitBin: string;

const createdDirs: string[] = [];

/** Write an executable mock script and return its path. */
function writeMock(name: string, body: string): string {
  const p = join(binDir, name);
  writeFileSync(p, body, 'utf8');
  chmodSync(p, 0o755);
  return p;
}

/** Run inflight-check.sh with fixture env vars injected. Returns trimmed stdout(+stderr). */
function runScript(umbrella: string, extraEnv: Record<string, string> = {}): string {
  try {
    return execFileSync('bash', [SCRIPT, umbrella], {
      encoding: 'utf8',
      env: {
        ...process.env,
        REPO_ROOT: tmpRoot,
        MO_GH_BIN: mockGhBin,
        MO_GIT_BIN: mockGitBin,
        MO_BASE_REF: 'origin/staging',
        GIT_DIR: '', // prevent stray git ops in tmpRoot
        ...extraEnv,
      },
    }).trim();
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string };
    return ((e.stdout ?? '') + (e.stderr ?? '')).trim();
  }
}

/** Run and capture the exit code (unavailable evidence must exit nonzero). */
function runExitCode(umbrella: string): number {
  try {
    execFileSync('bash', [SCRIPT, umbrella], {
      encoding: 'utf8',
      env: {
        ...process.env,
        REPO_ROOT: tmpRoot,
        MO_GH_BIN: mockGhBin,
        MO_GIT_BIN: mockGitBin,
        GIT_DIR: '',
      },
    });
    return 0;
  } catch {
    return 1;
  }
}

// Default mock-git: no matching branches/worktrees (so PR signal dominates).
const GIT_CLEAN = [
  '#!/usr/bin/env bash',
  'case "$1 $2" in',
  '  "branch -a") echo "  feat/unrelated-thing";;',
  '  "worktree list") echo "/tmp/repo abc123 [main]";;',
  '  *) exit 0;;',
  'esac',
].join('\n');

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'inflight-check-test-'));
  createdDirs.push(tmpRoot);
  binDir = join(tmpRoot, 'bin');
  mkdirSync(binDir, { recursive: true });

  // Default mock-gh: one open PR whose branch carries the umbrella slug.
  mockGhBin = writeMock(
    'mock-gh',
    [
      '#!/usr/bin/env bash',
      'echo \'[{"headRefName":"feat/meta-orch-inflight-check","number":42,"title":"feat(meta-orch): inflight ledger"}]\'',
    ].join('\n'),
  );
  mockGitBin = writeMock('mock-git', GIT_CLEAN);
});

afterEach(() => {
  for (const d of createdDirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
});

// ── Test 1: POS — open PR carries umbrella slug ──────────────────────────────

describe('inflight-check.sh — Test 1: POS open-PR signal', () => {
  it('open PR whose branch carries the slug → INFLIGHT (open PR), no CLEAR', { timeout: 20_000 }, () => {
    const out = runScript('meta-orch-inflight-check');
    expect(out).toContain('INFLIGHT:');
    expect(out).toContain('open PR #42');
    expect(out).toContain('feat/meta-orch-inflight-check');
    expect(out).not.toContain('CLEAR:');
  });
});

// ── Test 2: POS — un-merged live branch carries umbrella slug ─────────────────

describe('inflight-check.sh — Test 2: POS live-branch signal', () => {
  it('un-merged branch carries the slug (gh empty) → INFLIGHT (live branch), no CLEAR', { timeout: 20_000 }, () => {
    mockGhBin = writeMock('mock-gh', '#!/usr/bin/env bash\necho "[]"');
    mockGitBin = writeMock(
      'mock-git',
      [
        '#!/usr/bin/env bash',
        'case "$1 $2" in',
        '  "branch -a") echo "  feat/meta-orch-inflight-check";;',
        '  "worktree list") echo "/tmp/x abc [main]";;',
        '  *) exit 0;;',
        'esac',
      ].join('\n'),
    );
    const out = runScript('meta-orch-inflight-check');
    expect(out).toContain('INFLIGHT:');
    expect(out).toContain('live branch feat/meta-orch-inflight-check');
    expect(out).not.toContain('CLEAR:');
  });
});

// ── Test 3: NEG paired with Test 1 — no open PR, no matching branch ───────────

describe('inflight-check.sh — Test 3: NEG no live work (paired with Test 1/2)', () => {
  it('gh returns no matching PR + git has no matching branch → CLEAR, no INFLIGHT', { timeout: 20_000 }, () => {
    mockGhBin = writeMock(
      'mock-gh',
      [
        '#!/usr/bin/env bash',
        'echo \'[{"headRefName":"feat/some-other-thing","number":7,"title":"chore: bump deps"}]\'',
      ].join('\n'),
    );
    const out = runScript('meta-orch-inflight-check');
    expect(out).toContain('CLEAR:');
    expect(out).not.toContain('INFLIGHT:');
  });
});

// ── Test 4: NEG — generic stopword overlap must NOT trip the token threshold ──

describe('inflight-check.sh — Test 4: NEG stopword-only overlap', () => {
  it('PR sharing only generic tokens (meta/orch) → CLEAR, no false INFLIGHT', { timeout: 20_000 }, () => {
    // PR branch shares "meta" + "orch" (both stopwords) but neither distinctive
    // slug token (inflight / check) nor the full slug substring.
    mockGhBin = writeMock(
      'mock-gh',
      [
        '#!/usr/bin/env bash',
        'echo \'[{"headRefName":"feat/meta-orch-channel-discipline","number":9,"title":"meta orchestrator channel work"}]\'',
      ].join('\n'),
    );
    const out = runScript('meta-orch-inflight-check');
    expect(out).toContain('CLEAR:');
    expect(out).not.toContain('INFLIGHT:');
  });
});

// ── Test 5: NEG unavailable evidence — gh + git both unavailable ─────────────────────────

describe('inflight-check.sh — Test 5: NEG unavailable evidence', () => {
  it('gh and git both exit 1 → UNKNOWN and nonzero status', { timeout: 20_000 }, () => {
    mockGhBin = writeMock('mock-gh', '#!/usr/bin/env bash\nexit 1');
    mockGitBin = writeMock('mock-git', '#!/usr/bin/env bash\nexit 1');
    const out = runScript('meta-orch-inflight-check');
    expect(out).toContain('UNKNOWN:');
    expect(out).not.toContain('CLEAR:');
    expect(out).not.toContain('INFLIGHT:');
    expect(runExitCode('meta-orch-inflight-check')).toBe(1);
  });
});
