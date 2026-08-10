/**
 * Tests for plan-currency-check.sh digest mode (pipeline-ux Stage 1A).
 *
 * Verifies three behaviors added in Stage 1A:
 *   1. POSITIVE DRIFT: when mock-gh has a merged PR #200 NOT in wave plan →
 *      stdout contains "DRIFT-1:" OR the UNTRACKED-200 line appears (T-HYG-A: real
 *      drift items MUST appear inline); stdout line count is ≤ 20 (generous bound).
 *   2. NEGATIVE CLEAN: when everything is consistent → stdout does NOT contain "DRIFT-"
 *   3. SIDE-FILE WRITE: after running the script, _plan-currency-raw.txt is written
 *      to REPO_ROOT/.claude/orchestrator-prompts/ and its content length > 100 chars.
 *
 * Seams used (env vars forwarded to the shell script — reuse plan-currency-check.test.ts pattern):
 *   REPO_ROOT    — points to a temp fixture dir mimicking repo structure
 *   MO_GH_BIN   — path to a mock-gh script returning fixture merged-PR JSON
 *   MO_WAVE_PLAN — path to a temp wave-sequencing-plan.md fixture
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  chmodSync,
  existsSync,
  readFileSync,
} from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT_REAL = resolve(HERE, '../../..');
const SCRIPT = resolve(
  REPO_ROOT_REAL,
  '.claude/skills/pipeline/helpers/plan-currency-check.sh',
);

// ── Fixture state shared across each test ────────────────────────────────────

let tmpRoot: string;       // acts as REPO_ROOT for the script
let promptsDir: string;    // tmpRoot/.claude/orchestrator-prompts
let wavePlanPath: string;  // MO_WAVE_PLAN path
let mockGhBin: string;     // MO_GH_BIN path

// Wave plan that does NOT reference PR #200 (triggers UNTRACKED for mock-gh's #200)
const WAVE_PLAN_WITHOUT_200 = [
  '# Wave sequencing plan',
  '',
  '## §0 — Verified status snapshot',
  '',
  '| Wave | What | Verified status | Evidence |',
  '|---|---|---|---|',
  '| N1 | some wave | ✅ DONE | PR #100 |',
  '| umbrella-in-plan | some umbrella | ✅ DONE | shipped |',
  '',
].join('\n');

// Wave plan that references everything — no UNTRACKED entries expected
const WAVE_PLAN_WITH_ALL = [
  '# Wave sequencing plan',
  '',
  '## §0 — Verified status snapshot',
  '',
  '| Wave | What | Verified status | Evidence |',
  '|---|---|---|---|',
  '| N1 | some wave | ✅ DONE | PR #100 |',
  '| N2 | another wave | ✅ DONE | PR #200 |',
  '| umbrella-in-plan | some umbrella | ✅ DONE | shipped |',
  '| umbrella-not-in-plan | other umbrella | ✅ DONE | shipped |',
  '',
].join('\n');

/** Write a UTF-8 file to path, creating parent dirs as needed. */
function write(filePath: string, content: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
}

/** Run plan-currency-check.sh (no-arg mode) with all fixture env vars injected. */
function runScript(extraEnv: Record<string, string> = {}): string {
  // no-arg = no umbrella — runs the digest path
  return execFileSync('bash', [SCRIPT], {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      REPO_ROOT: tmpRoot,
      MO_GH_BIN: mockGhBin,
      MO_WAVE_PLAN: wavePlanPath,
      // Silence git operations inside the script — tmpRoot is not a real repo
      GIT_DIR: '',
      ...extraEnv,
    },
  }).trim();
}

// ── Fixture setup / teardown ──────────────────────────────────────────────────

const createdDirs: string[] = [];

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'mo-currency-digest-test-'));
  createdDirs.push(tmpRoot);

  // Create .claude/orchestrator-prompts with two umbrella dirs
  promptsDir = join(tmpRoot, '.claude', 'orchestrator-prompts');
  mkdirSync(promptsDir, { recursive: true });

  // umbrella-in-plan: has kickoff.md AND is referenced in wave plan
  write(join(promptsDir, 'umbrella-in-plan', 'kickoff.md'), '> **Type:** I-phase\n# In-Plan Umbrella\n');
  // umbrella-not-in-plan: has kickoff.md but NOT referenced in "WITHOUT_200" plan
  write(join(promptsDir, 'umbrella-not-in-plan', 'kickoff.md'), '> **Type:** I-phase\n# Not-In-Plan Umbrella\n');

  // wave-sequencing-plan.md fixture: references #100 + umbrella-in-plan, NOT #200
  const waveDir = join(tmpRoot, 'docs', 'meta-factory');
  mkdirSync(waveDir, { recursive: true });
  wavePlanPath = join(waveDir, 'wave-sequencing-plan.md');
  write(wavePlanPath, WAVE_PLAN_WITHOUT_200);

  // mock-gh binary: returns two merged PRs — #100 (in plan) and #200 (not in plan)
  // mergedAt set to 2026-05-01 to pass the 30-day cutoff filter
  const mockGhDir = join(tmpRoot, 'bin');
  mkdirSync(mockGhDir, { recursive: true });
  mockGhBin = join(mockGhDir, 'mock-gh');
  write(
    mockGhBin,
    [
      '#!/usr/bin/env bash',
      '# Mock gh — returns two merged PRs; #100 is in the wave plan, #200 is not.',
      'echo \'[',
      '  {"number":100,"title":"feat: some feature already in plan","mergedAt":"2026-05-01T00:00:00Z"},',
      '  {"number":200,"title":"feat: untracked feature not in plan","mergedAt":"2026-05-01T00:00:00Z"}',
      ']\'',
    ].join('\n'),
  );
  chmodSync(mockGhBin, 0o755);
});

afterEach(() => {
  for (const d of createdDirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
});

// ── Tests ─────────────────────────────────────────────────────────────────────

// Every case here spawns the real plan-currency-check.sh and does real filesystem/git work in a
// sandbox — multi-second runtimes are inherent, so the vitest 5s default is a mis-set
// gate rather than a signal, not a budget these tests were ever meant to meet. Measured
// 2026-08-10 (`vitest run skills/`, macOS): the untimed cases below time out at 5000ms
// while the underlying script succeeds. 30_000 is the SLOW_SHELL_MS convention already
// used by the sibling shell-spawning suites (dup-detect, create-worktree,
// priority-score-synthetic), applied here per the #1363 precedent.
const SLOW_SHELL_MS = 30_000;

describe('plan-currency-check.sh — digest mode (pipeline-ux Stage 1A)', { timeout: SLOW_SHELL_MS }, () => {
  it('SIDE-FILE WRITE: after running, _plan-currency-raw.txt exists with real content', () => {
    // Targets Stage 1A side-file write: full corpus → _plan-currency-raw.txt
    runScript();

    const rawFile = join(tmpRoot, '.claude', 'orchestrator-prompts', '_plan-currency-raw.txt');
    // File must exist
    expect(existsSync(rawFile)).toBe(true);
    // File must have substantial content (not empty placeholder)
    const content = readFileSync(rawFile, 'utf8');
    expect(content.length).toBeGreaterThan(100);
  });

  it('SIDE-FILE CONTENT: raw file contains the full corpus (section headers present)', () => {
    // Verifies the side-file is a superset of what stdout used to emit
    runScript();

    const rawFile = join(tmpRoot, '.claude', 'orchestrator-prompts', '_plan-currency-raw.txt');
    const content = readFileSync(rawFile, 'utf8');
    // Section headers that the old full-stdout mode always emitted (T17 — backward-compat)
    expect(content).toContain('=== plan-currency-check:');
    expect(content).toContain('--- reverse-currency (L2 extension — reality → plan): UNTRACKED entries ---');
    // UNTRACKED lines should be in side-file
    expect(content).toContain('UNTRACKED-KICKOFF: umbrella-not-in-plan');
  });

  it('NEGATIVE CLEAN: when plan covers everything → stdout does NOT contain "DRIFT-" line', () => {
    // Use wave plan that includes ALL items — no UNTRACKED entries expected
    write(wavePlanPath, WAVE_PLAN_WITH_ALL);

    const out = runScript();
    // No DRIFT lines should appear when plan is consistent
    expect(out).not.toContain('DRIFT-');
  });

  it('COMPACT STDOUT: stdout line count is ≤ 20 (digest is much smaller than 47KB raw)', () => {
    // Verifies the UX intent: human sees ≤20 lines, not 293 lines of raw data
    const out = runScript();
    const lineCount = out.split('\n').filter((l) => l.trim().length > 0).length;
    expect(lineCount).toBeLessThanOrEqual(20);
  });

  it('STDOUT POINTER: stdout contains side-file pointer for AI on-demand reading', () => {
    // T-HYG-A: AI must be able to find the side-file via the pointer in stdout
    const out = runScript();
    expect(out).toContain('_plan-currency-raw.txt');
  });

  it('PLAN STATUS: stdout contains "Plan status:" verdict line', () => {
    // Verifies the digest verdict line exists (CURRENT or DRIFT)
    const out = runScript();
    expect(out).toContain('Plan status:');
  });
});
