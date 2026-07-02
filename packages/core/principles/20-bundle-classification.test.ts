/**
 * Principle 20 — bundle-curate.sh mechanical correctness (B1 bundle-decision-rule)
 *
 * Source: .claude/skills/pipeline/helpers/bundle-curate.sh (Stage 3 D1)
 *         .claude/orchestrator-prompts/meta-orchestrator-bundle-autonomous/stage-3-iphase.md §3 D4
 *         docs/meta-factory/research-patches/2026-05-26-bundle-autonomous-prior-art.md §5
 *           (BUILD verdict: vocabulary from Renovate packageRules + Dependabot groups,
 *            mechanism is ours — no upstream wraps classify-work.sh/assign-skill.sh
 *            for AI-orchestration backlog bundling)
 *
 * Invariant: bundle-curate.sh must:
 *   (1) Admit only fix + I-phase-small items (B1 eligibility filter)
 *   (2) Exclude file-overlap pairs (≥2 candidates touching same file → second excluded)
 *   (3) Hard-cap output bundle at 5 items (T-BA-A)
 *   (4) Exit cleanly on empty/all-comment backlog (bundle size 0)
 *
 * Slot 20 rationale: slots 01-19 occupied as of 2026-05-26.
 *
 * T15 self-application: if the maintainer queues ≥2 «improve bundle-curate.sh»
 * fix-class items, they all share the same file-scope token → the file-overlap
 * rejection in pass 2 ensures at most one enters the bundle. This is the correct
 * and expected behavior — tested below in the paired-negative file.
 *
 * Paired-negative: 20-bundle-classification.paired-negative.test.ts (per principle 02
 * mandate) — deliberately broken bundle-curate.sh logic (mocked) must fail the
 * positive assertions. Ensures the checks are non-tautological.
 *
 * T-BA-C: D4 paired-negative MUST include a bundle-with-R-phase-item case that FAILS
 * (proven in paired-negative file). This is the mechanical enforcement of B1
 * eligibility: an R-phase item in the table means the filter is broken.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HELPER = resolve(REPO_ROOT, '.claude/skills/pipeline/helpers/bundle-curate.sh');
const FIXTURES = resolve(HERE, '__fixtures__/bundle');

/**
 * Per-test timeout. bundle-curate.sh spawns classify-work.sh + assign-skill.sh once per
 * backlog item, so a single run is ~3-5s in isolation; under full-suite file-parallelism
 * (.husky/pre-push runs `npm test --workspace=@rules-as-tests/core`) a run can exceed
 * vitest's 5s default and false-fail on timeout, not on a real assertion. Mirrors the
 * sibling paired-negative file's SLOW_SHELL_MS (60s there — mutant arms re-spawn more).
 */
const SLOW_SHELL_MS = 30_000;

/** Run bundle-curate.sh on a fixture file; return stdout as string. */
function runBundleCurate(fixtureName: string): string {
  const fixturePath = resolve(FIXTURES, fixtureName);
  return execFileSync('/bin/bash', [HELPER, fixturePath], {
    encoding: 'utf8',
    cwd: REPO_ROOT,
  });
}

/** Count rows with a specific notes pattern in the markdown table output. */
function countRows(output: string, notesPattern: string): number {
  return output
    .split('\n')
    .filter((line) => line.startsWith('|') && line.includes(notesPattern))
    .length;
}

describe('Principle 20 — bundle-curate.sh mechanical correctness', { timeout: SLOW_SHELL_MS }, () => {
  it('bundle-curate.sh helper exists and is executable', () => {
    expect(existsSync(HELPER), `helper not found at: ${HELPER}`).toBe(true);
  });

  it('fixture directory exists with all 3 backlogs', () => {
    expect(existsSync(resolve(FIXTURES, 'backlog-1-clean.txt'))).toBe(true);
    expect(existsSync(resolve(FIXTURES, 'backlog-2-mixed.txt'))).toBe(true);
    expect(existsSync(resolve(FIXTURES, 'backlog-3-overlap.txt'))).toBe(true);
  });

  // ── D6 Fixture 1: backlog-1-clean.txt ────────────────────────────────────────
  describe('backlog-1-clean.txt — 5 fix-class items, no file-overlap', () => {
    it('emits markdown table header row', () => {
      const output = runBundleCurate('backlog-1-clean.txt');
      expect(output).toContain('| idx | item-source | classification | dispatch-mode | assigned-skill | file-scope | notes |');
    });

    it('all 5 items enter the bundle (in-bundle N/5 notes)', () => {
      const output = runBundleCurate('backlog-1-clean.txt');
      expect(countRows(output, 'in-bundle')).toBe(5);
    });

    it('no items are excluded', () => {
      const output = runBundleCurate('backlog-1-clean.txt');
      expect(countRows(output, 'excluded')).toBe(0);
    });

    it('all items classified as fix type', () => {
      const output = runBundleCurate('backlog-1-clean.txt');
      const dataRows = output.split('\n').filter((l) => l.startsWith('|') && l.includes('fix'));
      expect(dataRows.length).toBeGreaterThanOrEqual(5);
    });
  });

  // ── D6 Fixture 2: backlog-2-mixed.txt ────────────────────────────────────────
  describe('backlog-2-mixed.txt — 8 items mix of fix/R-phase/I-phase-large', () => {
    it('exactly 5 items enter the bundle (cap enforced)', () => {
      const output = runBundleCurate('backlog-2-mixed.txt');
      expect(countRows(output, 'in-bundle')).toBe(5);
    });

    it('R-phase item is excluded (not in {fix,I-phase-small})', () => {
      const output = runBundleCurate('backlog-2-mixed.txt');
      expect(output).toContain('excluded: type=R-phase not in {fix,I-phase-small}');
    });

    it('I-phase-large item is excluded (not in {fix,I-phase-small})', () => {
      const output = runBundleCurate('backlog-2-mixed.txt');
      expect(output).toContain('excluded: type=I-phase-large not in {fix,I-phase-small}');
    });

    it('1 item excluded by max-bundle-5 cap', () => {
      const output = runBundleCurate('backlog-2-mixed.txt');
      expect(countRows(output, 'max-bundle-5 cap')).toBe(1);
    });

    it('total row count is 8 (all items accounted for)', () => {
      const output = runBundleCurate('backlog-2-mixed.txt');
      const dataRows = output
        .split('\n')
        .filter((l) => l.startsWith('|') && !l.includes('idx | item-source') && !l.startsWith('|---|'));
      expect(dataRows.length).toBe(8);
    });
  });

  // ── D6 Fixture 3: backlog-3-overlap.txt ──────────────────────────────────────
  describe('backlog-3-overlap.txt — 5 fix items, 3 touch same file', () => {
    it('3 items enter the bundle (non-overlapping set)', () => {
      const output = runBundleCurate('backlog-3-overlap.txt');
      expect(countRows(output, 'in-bundle')).toBe(3);
    });

    it('2 items excluded by file-overlap', () => {
      const output = runBundleCurate('backlog-3-overlap.txt');
      expect(countRows(output, 'file-overlap with prior candidate')).toBe(2);
    });

    it('total row count is 5', () => {
      const output = runBundleCurate('backlog-3-overlap.txt');
      const dataRows = output
        .split('\n')
        .filter((l) => l.startsWith('|') && !l.includes('idx | item-source') && !l.startsWith('|---|'));
      expect(dataRows.length).toBe(5);
    });
  });

  // ── Edge case: empty / all-comment backlog ────────────────────────────────────
  it('exits cleanly on all-comment backlog (empty effective input) — no crash', () => {
    const { execSync } = require('node:child_process');
    // Create a temp file with only comments
    const tmpFile = resolve(REPO_ROOT, 'packages/core/principles/__fixtures__/bundle/.empty-test-tmp');
    const { writeFileSync, unlinkSync } = require('node:fs');
    try {
      writeFileSync(tmpFile, '# only a comment\n');
      const result = execFileSync('/bin/bash', [HELPER, tmpFile], {
        encoding: 'utf8',
        cwd: REPO_ROOT,
      });
      expect(result).toContain('| idx |');
      // Zero data rows
      const dataRows = result
        .split('\n')
        .filter((l: string) => l.startsWith('|') && !l.includes('idx | item-source') && !l.startsWith('|---|'));
      expect(dataRows.length).toBe(0);
    } finally {
      try { unlinkSync(tmpFile); } catch { /* noop */ }
    }
  });
});
