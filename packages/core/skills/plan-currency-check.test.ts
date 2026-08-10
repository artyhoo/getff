/**
 * Paired-negative tests for plan-currency-check.sh L2 reverse-currency extension.
 *
 * Stage 3 of umbrella meta-orchestrator-planner-completeness: verifies that the
 * extended helper emits UNTRACKED-<N> for merged PRs absent from wave-sequencing-plan.md,
 * and UNTRACKED-KICKOFF for kickoff dirs whose umbrella name is absent from §0.
 *
 * Principle 02 contract (both arms required):
 *   ✅ Positive: fixture present (merged PR not in plan / kickoff not in plan) → UNTRACKED entry emitted
 *   ❌ Paired-negative: plan updated to include the item → UNTRACKED entry drops
 *
 * The test MUST FAIL if the L2 reverse-currency extension is reverted (plan-currency-check.sh
 * reverts to pre-L2 state with no UNTRACKED-* output).
 *
 * Seams used (env vars forwarded to the shell script):
 *   REPO_ROOT    — points to a temp fixture dir mimicking repo structure
 *   MO_GH_BIN   — path to a mock-gh script returning fixture merged-PR JSON
 *   MO_WAVE_PLAN — path to a temp wave-sequencing-plan.md fixture
 *
 * NOTE: MO_MEM_DIR is NOT needed here — this SUT is plan-currency-check.sh,
 * which does not scan memory files. Different fixture shape from planner-discovery.test.ts.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  chmodSync,
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

// ── Wave plan with #100 + umbrella-in-plan, but NOT #200 + umbrella-not-in-plan ──
const WAVE_PLAN_WITH_ITEMS = [
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

// Updated plan that also references #200 and umbrella-not-in-plan → UNTRACKED drops
const WAVE_PLAN_WITH_ALL_ITEMS = [
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

/** Run plan-currency-check.sh with optional umbrella arg + fixture env vars. */
function runScript(extraEnv: Record<string, string> = {}, umbrella?: string): string {
  const args = umbrella ? [SCRIPT, umbrella] : [SCRIPT];
  return execFileSync('bash', args, {
    encoding: 'utf8',
    // plan-currency-check.sh may exit non-zero on git errors; capture stderr too
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
  tmpRoot = mkdtempSync(join(tmpdir(), 'mo-currency-test-'));
  createdDirs.push(tmpRoot);

  // Create .claude/orchestrator-prompts with two umbrella dirs
  promptsDir = join(tmpRoot, '.claude', 'orchestrator-prompts');
  mkdirSync(promptsDir, { recursive: true });

  // umbrella-in-plan: has kickoff.md AND is referenced in wave plan
  write(join(promptsDir, 'umbrella-in-plan', 'kickoff.md'), '> **Type:** I-phase\n# In-Plan Umbrella\n');
  // umbrella-not-in-plan: has kickoff.md but NOT referenced in wave plan
  write(join(promptsDir, 'umbrella-not-in-plan', 'kickoff.md'), '> **Type:** I-phase\n# Not-In-Plan Umbrella\n');

  // wave-sequencing-plan.md fixture: references #100 + umbrella-in-plan, NOT #200 + umbrella-not-in-plan
  const waveDir = join(tmpRoot, 'docs', 'meta-factory');
  mkdirSync(waveDir, { recursive: true });
  wavePlanPath = join(waveDir, 'wave-sequencing-plan.md');
  write(wavePlanPath, WAVE_PLAN_WITH_ITEMS);

  // mock-gh binary: returns two merged PRs — #100 (in plan) and #200 (not in plan)
  // mergedAt is computed dynamically (5 days ago) so it always falls within the script's
  // 30-day cutoff window regardless of wall-clock date. A hard-coded date (was 2026-05-01)
  // bit-rots: once `now` advances >30d past it, both PRs get filtered out and the positive
  // UNTRACKED-N tests silently fail. The date math mirrors the script's own portable
  // darwin (`-v`) → GNU (`-d`) fallback (plan-currency-check.sh:82,136).
  const mockGhDir = join(tmpRoot, 'bin');
  mkdirSync(mockGhDir, { recursive: true });
  mockGhBin = join(mockGhDir, 'mock-gh');
  write(
    mockGhBin,
    [
      '#!/usr/bin/env bash',
      '# Mock gh — returns two merged PRs; #100 is in the wave plan, #200 is not.',
      "RECENT=\"$(date -u -v-5d +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d '5 days ago' +%Y-%m-%dT%H:%M:%SZ)\"",
      'echo "[',
      '  {\\"number\\":100,\\"title\\":\\"feat: some feature already in plan\\",\\"mergedAt\\":\\"${RECENT}\\"},',
      '  {\\"number\\":200,\\"title\\":\\"feat: untracked feature not in plan\\",\\"mergedAt\\":\\"${RECENT}\\"}',
      ']"',
    ].join('\n'),
  );
  chmodSync(mockGhBin, 0o755);
});

afterEach(() => {
  for (const d of createdDirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
});

// ── POSITIVE TESTS ────────────────────────────────────────────────────────────

// Every case here spawns the real plan-currency-check.sh and does real filesystem/git work in a
// sandbox — multi-second runtimes are inherent, so the vitest 5s default is a mis-set
// gate rather than a signal, not a budget these tests were ever meant to meet. Measured
// 2026-08-10 (`vitest run skills/`, macOS): the untimed cases below time out at 5000ms
// while the underlying script succeeds. 30_000 is the SLOW_SHELL_MS convention already
// used by the sibling shell-spawning suites (dup-detect, create-worktree,
// priority-score-synthetic), applied here per the #1363 precedent.
const SLOW_SHELL_MS = 30_000;

describe('plan-currency-check.sh — L2 reverse-currency (positive cases)', { timeout: SLOW_SHELL_MS }, () => {
  it('emits UNTRACKED-200 for merged PR #200 not referenced in wave plan', () => {
    const out = runScript();
    expect(out).toContain('UNTRACKED-200:');
    expect(out).toContain('merged PR #200');
    expect(out).toContain('not referenced in wave-sequencing-plan.md');
  });

  it('does NOT emit UNTRACKED-100 for merged PR #100 that IS in wave plan', () => {
    const out = runScript();
    expect(out).not.toContain('UNTRACKED-100:');
  });

  it('emits UNTRACKED-KICKOFF for umbrella-not-in-plan', () => {
    const out = runScript();
    expect(out).toContain('UNTRACKED-KICKOFF: umbrella-not-in-plan has kickoff.md but not in §0');
  });

  it('does NOT emit UNTRACKED-KICKOFF for umbrella-in-plan', () => {
    const out = runScript();
    expect(out).not.toContain('UNTRACKED-KICKOFF: umbrella-in-plan');
  });

  it('emits the reverse-currency section header', () => {
    const out = runScript();
    expect(out).toContain('--- reverse-currency (L2 extension — reality → plan): UNTRACKED entries ---');
  });

  it('preserves existing pre-L2 script output (T17): section headers still present', () => {
    const out = runScript();
    expect(out).toContain('=== plan-currency-check:');
    // open PRs section — the mock-gh returns merged-only list; open PRs section header appears
    // regardless of gh output (gh is called separately for open PRs using bare `gh`, which
    // falls back to "(gh unavailable)" or the real gh in sandbox — either way the header is echoed)
    expect(out).toContain('--- open PRs (json) ---');
    expect(out).toContain('--- merged PRs last 30 days (json) ---');
    expect(out).toContain('--- kickoff existence check ---');
    expect(out).toContain('--- all umbrella kickoffs ---');
    expect(out).toContain('--- research patches (last 10) ---');
  });

  it('title is truncated to 60 chars in UNTRACKED-N output', () => {
    // The mock-gh title for #200 is "feat: untracked feature not in plan" (36 chars) — fits in 60,
    // so the full title appears. We verify the truncation logic does not corrupt the output.
    const out = runScript();
    expect(out).toContain('"feat: untracked feature not in plan"');
  });
});

// ── PAIRED-NEGATIVE TESTS (principle 02) ─────────────────────────────────────

describe('plan-currency-check.sh — L2 paired-negative (remove cause → effect drops)', { timeout: SLOW_SHELL_MS }, () => {
  it('PAIRED-NEGATIVE: when wave plan references #200 and umbrella-not-in-plan → both UNTRACKED entries drop', () => {
    // Update wave plan to include all items
    write(wavePlanPath, WAVE_PLAN_WITH_ALL_ITEMS);

    const out = runScript();
    expect(out).not.toContain('UNTRACKED-200:');
    expect(out).not.toContain('UNTRACKED-KICKOFF: umbrella-not-in-plan');
    // The items that were already in plan remain absent from UNTRACKED
    expect(out).not.toContain('UNTRACKED-100:');
    expect(out).not.toContain('UNTRACKED-KICKOFF: umbrella-in-plan');
  });

  it('PAIRED-NEGATIVE: when mock-gh returns ZERO merged PRs → no UNTRACKED-N entries (no false positives)', () => {
    // Replace mock-gh with empty array
    write(
      mockGhBin,
      '#!/usr/bin/env bash\necho \'[]\'\n',
    );
    chmodSync(mockGhBin, 0o755);

    const out = runScript();
    expect(out).not.toContain('UNTRACKED-100:');
    expect(out).not.toContain('UNTRACKED-200:');
    // KICKOFF check is filesystem-based, so umbrella-not-in-plan still fires
    expect(out).toContain('UNTRACKED-KICKOFF: umbrella-not-in-plan');
  });

  it('PAIRED-NEGATIVE: when all kickoff dirs are in the wave plan → no UNTRACKED-KICKOFF entries', () => {
    write(wavePlanPath, WAVE_PLAN_WITH_ALL_ITEMS);

    const out = runScript();
    expect(out).not.toContain('UNTRACKED-KICKOFF:');
  });

  it('PAIRED-NEGATIVE: when no kickoff.md dirs exist → no UNTRACKED-KICKOFF entries', () => {
    // Remove both kickoff dirs
    rmSync(join(promptsDir, 'umbrella-in-plan'), { recursive: true, force: true });
    rmSync(join(promptsDir, 'umbrella-not-in-plan'), { recursive: true, force: true });

    const out = runScript();
    expect(out).not.toContain('UNTRACKED-KICKOFF:');
  });
});

// ── FAILURE-MODE TESTS ────────────────────────────────────────────────────────

describe('plan-currency-check.sh — L2 failure modes (graceful degradation)', { timeout: SLOW_SHELL_MS }, () => {
  it('when wave-sequencing-plan.md is MISSING → script does NOT crash, emits warning, still outputs open-PR section', () => {
    // Inject a non-existent wave plan path
    const out = runScript({ MO_WAVE_PLAN: join(tmpRoot, 'does-not-exist', 'wave-sequencing-plan.md') });
    // Script must complete (execFileSync would throw if exit non-zero from script logic)
    expect(out).toContain('WARN: ');
    expect(out).toContain('not found — skipping reverse-currency checks');
    // Pre-L2 sections still appear
    expect(out).toContain('=== plan-currency-check:');
    // UNTRACKED entries must NOT appear (both checks skipped)
    expect(out).not.toContain('UNTRACKED-');
  });

  it('when wave-sequencing-plan.md is missing → UNTRACKED-KICKOFF check is also skipped', () => {
    const out = runScript({ MO_WAVE_PLAN: join(tmpRoot, 'missing', 'wave-plan.md') });
    // umbrella-not-in-plan exists in fixture but UNTRACKED-KICKOFF must not fire (plan missing → skip both)
    expect(out).not.toContain('UNTRACKED-KICKOFF:');
  });
});

// ── T15 RECURSIVE SELF-APPLICATION NOTE ──────────────────────────────────────

describe('plan-currency-check.sh — T15 self-application + structural verification', { timeout: SLOW_SHELL_MS }, () => {
  it('T15 + T19 structural: script exists, contains L2 seam declarations and UNTRACKED keywords', () => {
    // Verify script file exists and contains expected L2 artifacts (structural check)
    const { readFileSync, existsSync } = require('node:fs');
    expect(existsSync(SCRIPT)).toBe(true);
    const src = readFileSync(SCRIPT, 'utf8');

    // Seam overrides (T13 reuse from L1). REPO_ROOT is now resolved by the shared
    // lib/common.sh sourced at the top (Stage 4 dedup) rather than an inline assignment.
    expect(src).toContain('lib/common.sh');
    expect(src).toContain('MO_GH_BIN="${MO_GH_BIN:-');
    // MO_WAVE_PLAN is now routed through resolve_plan_path() (consumer-usable /pipeline,
    // 2026-06-16) — the resolver itself honours the MO_WAVE_PLAN env seam, so the override
    // semantics are preserved while the default falls back to the agnostic .ai-factory plan.
    expect(src).toContain('MO_WAVE_PLAN="$(resolve_plan_path)"');

    // L2 reverse-currency markers
    expect(src).toContain('UNTRACKED-KICKOFF');
    expect(src).toContain('reverse-currency');

    // Existing T17 marker (pre-L2 behaviour preserved)
    expect(src).toContain('@cc-only-rationale');
    // pipeline-ux P1: named-mode guard present in script (not prose-only)
    expect(src).toContain('named-mode');
  });
});

// ── Named-mode compact output tests (pipeline-ux Stage 1) ────────────────────
describe('plan-currency-check.sh — named-mode compact (pipeline-ux P1)', { timeout: SLOW_SHELL_MS }, () => {
  it('named-mode: exits with compact header (not the full 47KB scan)', () => {
    const out = runScript({}, 'some-umbrella');
    expect(out).toContain("umbrella='some-umbrella' named-mode");
  });
  it('named-mode: kickoff EXISTS reported when dir present', () => {
    // Create a kickoff.md fixture for 'some-umbrella'
    const promptsDir2 = join(tmpRoot, '.claude', 'orchestrator-prompts', 'some-umbrella');
    mkdirSync(promptsDir2, { recursive: true });
    writeFileSync(join(promptsDir2, 'kickoff.md'), '# kickoff\n');
    const out = runScript({}, 'some-umbrella');
    expect(out).toContain('kickoff: EXISTS');
    expect(out).not.toContain('MISSING');
  });
  it('named-mode: kickoff MISSING reported when dir absent', () => {
    const out = runScript({}, 'nonexistent-umbrella');
    expect(out).toContain('kickoff: MISSING');
  });
  it('named-mode: output is compact (no raw JSON blobs or merged-PR listings)', () => {
    const out = runScript({}, 'some-umbrella');
    expect(out).not.toContain('"number"');    // no JSON PR dump
    expect(out).not.toContain('merged PRs');  // no full merged-PR section
    expect(out.split('\n').length).toBeLessThan(10); // ≤10 lines
  });
});
