/**
 * Paired-negative tests for classify-work.sh — L4 decomposition heuristics.
 *
 * Stage 5.B of umbrella meta-orchestrator-planner-completeness: verifies that the
 * helper correctly classifies work items as fix / R-phase / I-phase-small /
 * I-phase-large, and emits the correct dispatch mode for each tier.
 *
 * Principle 02 contract (both arms required per paired-negative discipline):
 *   ✅ Positive: fixture meets tier criterion → correct TYPE + DISPATCH emitted
 *   ❌ Paired-negative: fixture changed to violate tier boundary → different TYPE
 *
 * The test MUST FAIL if:
 *   - classify-work.sh is reverted to always emit one tier (no heuristic logic)
 *   - The fix/I-phase-small LOC boundary (5) is changed to >6
 *   - The I-phase-small/I-phase-large LOC boundary (80) is changed to >100
 *   - The R-phase keyword detector is removed
 *
 * Vocabulary: classification vocabulary adapted from:
 *   - TaskMaster complexity tiers (SSOT #72; LLM impl rejected, vocab adopted)
 *   - Superpowers SDD 3-tier model selection (SSOT #73; small/medium/large)
 *
 * Seam used: none (pure file-fixture + literal-string input; no git/gh deps).
 *   SCRIPT path resolves to the real classify-work.sh in the worktree.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT_REAL = resolve(HERE, '../../..');
const SCRIPT = resolve(
  REPO_ROOT_REAL,
  '.agents/procedures/pipeline/helpers/classify-work.sh',
);

// ── Fixture state shared across tests ────────────────────────────────────────

let tmpRoot: string;

/** Write a UTF-8 file to path, creating parent dirs as needed. */
function write(filePath: string, content: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
}

/** Run classify-work.sh with the given argument. Returns stdout as string. */
function runScript(arg?: string): string {
  const args = arg !== undefined ? [SCRIPT, arg] : [SCRIPT];
  return execFileSync('bash', args, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
  }).trim();
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

const createdDirs: string[] = [];

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'mo-classify-test-'));
  createdDirs.push(tmpRoot);
});

afterEach(() => {
  for (const d of createdDirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
});

// ── POSITIVE TESTS ────────────────────────────────────────────────────────────

describe('classify-work.sh — positive (all tiers)', () => {
  it('fix tier: 3-line file with ≤1 surface mention → TYPE: fix + DISPATCH: direct-Edit', () => {
    // 3 LOC ≤ 5 AND 0 surfaces ≤ 1 → fix
    const f = join(tmpRoot, 'tiny.md');
    write(f, 'Fix the typo.\nChange spelling.\nDone.\n');
    const out = runScript(f);
    expect(out).toContain('TYPE: fix');
    expect(out).toContain('DISPATCH: direct-Edit');
  });

  it('I-phase-small: ~40-line file with 1 file path → TYPE: I-phase-small + DISPATCH: Mode-A', () => {
    // 40 LOC ≤ 80 AND 1 surface ≤ 1 → I-phase-small
    const body = [
      '# I-phase small task',
      'Edit `packages/core/hooks/check.ts` to add the new guard.',
      ...Array.from({ length: 38 }, (_, i) => `Line ${i + 3}: some work.`),
    ].join('\n');
    const f = join(tmpRoot, 'medium.md');
    write(f, body);
    const out = runScript(f);
    expect(out).toContain('TYPE: I-phase-small');
    expect(out).toContain('DISPATCH: Mode-A');
  });

  it('I-phase-large (>80 LOC): ~100-line file with 1 file path → TYPE: I-phase-large + DISPATCH: Mode-B', () => {
    // 100 LOC > 80 → I-phase-large
    const body = [
      '# Large I-phase task',
      'Modify `packages/core/principles/08.test.ts` extensively.',
      ...Array.from({ length: 98 }, (_, i) => `Line ${i + 3}: detailed work.`),
    ].join('\n');
    const f = join(tmpRoot, 'large.md');
    write(f, body);
    const out = runScript(f);
    expect(out).toContain('TYPE: I-phase-large');
    expect(out).toContain('DISPATCH: Mode-B');
  });

  it('I-phase-large (≥2 surfaces): 30-line file with 2 distinct .ts paths → TYPE: I-phase-large', () => {
    // 30 LOC ≤ 80 BUT 2 surfaces ≥ 2 → I-phase-large
    const body = [
      '# Multi-surface task',
      'Edit `packages/core/hooks/utils/run-check.ts` and also',
      'update `packages/core/principles/09-doc-authority.test.ts`.',
      ...Array.from({ length: 27 }, (_, i) => `Line ${i + 4}: work.`),
    ].join('\n');
    const f = join(tmpRoot, 'multi-surface.md');
    write(f, body);
    const out = runScript(f);
    expect(out).toContain('TYPE: I-phase-large');
    expect(out).toContain('DISPATCH: Mode-B');
  });

  it('R-phase keyword: file with "R-phase prior-art survey" → TYPE: R-phase + DISPATCH: R-phase-session regardless of LOC', () => {
    // R-phase keyword fires before size heuristic
    const body = [
      '# R-phase prior-art survey',
      'This is a 3-line research task.',
      'End.',
    ].join('\n');
    const f = join(tmpRoot, 'rphase.md');
    write(f, body);
    const out = runScript(f);
    expect(out).toContain('TYPE: R-phase');
    expect(out).toContain('DISPATCH: R-phase-session');
  });

  it('literal string input (not a file): "fix typo in code" → TYPE: fix (word-count estimate)', () => {
    // "fix typo in code" = 4 words → wc/6 = 0 → min 1 → LOC=1 ≤5, SURFACES=0 ≤1 → fix
    const out = runScript('fix typo in code');
    expect(out).toContain('TYPE: fix');
    expect(out).toContain('DISPATCH: direct-Edit');
  });
});

// ── PAIRED-NEGATIVE TESTS (principle 02) ─────────────────────────────────────

describe('classify-work.sh — paired-negative (boundary verification)', () => {
  it('PAIRED-NEGATIVE: 6-LOC file (1 surface) → NOT fix (drops to I-phase-small)', () => {
    // LOC=6 > 5 → violates fix upper bound → I-phase-small.
    // wc -l counts newlines: we need 6 trailing-newline-separated lines.
    // 7 array elements joined by '\n' + trailing '\n' = 7 newlines = wc -l reports 7.
    // Use 7 lines (LOC=7 > 5) so we are well clear of the boundary.
    const body =
      'Line 1.\n' +
      'Line 2. Edit `packages/core/check.ts`.\n' +
      'Line 3.\n' +
      'Line 4.\n' +
      'Line 5.\n' +
      'Line 6.\n' +
      'Line 7.\n';
    const f = join(tmpRoot, 'seven-line.md');
    write(f, body);
    const out = runScript(f);
    expect(out).not.toContain('TYPE: fix');
    expect(out).toContain('TYPE: I-phase-small');
  });

  it('PAIRED-NEGATIVE: 100-LOC file → NOT I-phase-small (drops to I-phase-large)', () => {
    // LOC=100 > 80 → violates I-phase-small upper bound → I-phase-large
    const body = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}.`).join('\n');
    const f = join(tmpRoot, 'hundred-line.md');
    write(f, body);
    const out = runScript(f);
    expect(out).not.toContain('TYPE: I-phase-small');
    expect(out).toContain('TYPE: I-phase-large');
  });

  it('PAIRED-NEGATIVE: file mentioning 3 paths → NOT I-phase-small even with LOC ≤ 80', () => {
    // SURFACES=3 ≥ 2 → I-phase-large regardless of small LOC
    const body = [
      '# Multi-surface',
      'Modify `src/a.ts`, update `src/b.ts`, also fix `src/c.ts`.',
      ...Array.from({ length: 10 }, (_, i) => `Line ${i + 3}.`),
    ].join('\n');
    const f = join(tmpRoot, 'three-surfaces.md');
    write(f, body);
    const out = runScript(f);
    expect(out).not.toContain('TYPE: I-phase-small');
    expect(out).toContain('TYPE: I-phase-large');
  });

  it('PAIRED-NEGATIVE: file WITHOUT R-phase keywords → classifies by size, NOT R-phase', () => {
    // 3-line file with no research keywords → fix (not R-phase)
    const body = ['Rename the function.', 'Update call sites.', 'Done.'].join('\n');
    const f = join(tmpRoot, 'no-keywords.md');
    write(f, body);
    const out = runScript(f);
    expect(out).not.toContain('TYPE: R-phase');
    expect(out).toContain('TYPE: fix');
  });
});

// ── FAILURE MODE TESTS ────────────────────────────────────────────────────────

describe('classify-work.sh — failure modes', () => {
  it('missing argument → script exits non-zero and stderr contains "usage:"', () => {
    let threw = false;
    let stderr = '';
    try {
      execFileSync('bash', [SCRIPT], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
      });
    } catch (err: unknown) {
      threw = true;
      const e = err as { stderr?: string; status?: number };
      stderr = e.stderr ?? '';
      expect(e.status).not.toBe(0);
    }
    expect(threw).toBe(true);
    expect(stderr).toContain('usage:');
  });
});

// ── T15 + T19 STRUCTURAL SELF-APPLICATION BLOCK ───────────────────────────────

describe('classify-work.sh — T15 self-application + T19 structural verification', () => {
  it('T15 + T19 structural: script exists, contains @cc-only-rationale, TYPE:/DISPATCH:/RATIONALE: echoes', () => {
    const { readFileSync, existsSync } = require('node:fs');
    expect(existsSync(SCRIPT)).toBe(true);
    const src = readFileSync(SCRIPT, 'utf8');

    // Dual-implementation-discipline.md §6 marker (T13 reuse — same marker as L2)
    expect(src).toContain('@cc-only-rationale');

    // Output format markers (VERIFY step 4)
    expect(src).toContain('TYPE:');
    expect(src).toContain('DISPATCH:');
    expect(src).toContain('RATIONALE:');

    // Deterministic bash — no LLM (no-paid-llm-in-ci.md §1)
    expect(src).not.toContain('anthropic');
    expect(src).not.toContain('ANTHROPIC_API_KEY');

    // R-phase keyword guard (heuristic 1)
    expect(src).toContain('R-phase');

    // SURFACES guard with || true (set -e safety pattern)
    expect(src).toContain('|| true');
  });
});
