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
 *
 * ── Runtime (2026-09-06) ─────────────────────────────────────────────────────────────
 * This file used to be the pre-push timeout lottery's loser. bundle-curate.sh spawns
 * classify-work.sh + assign-skill.sh ONCE PER backlog item (~0.6s per pair); the twelve
 * call sites below resolve to only THREE distinct fixtures, so the file was paying 75
 * item classifications — 150 subprocess spawns — to derive three distinct outputs.
 * Measured standalone on the operator's macOS host: 68.28s and 63.60s back to back,
 * with individual `it` bodies at ~5s against a 30s per-test budget. Under parallel host
 * load whichever principle file lost the CPU lottery blew that budget (incident
 * 2026-09-05, seen in 11/20/21).
 *
 * Two changes, no assertion removed and no timeout raised:
 *   1. runs are memoised per (helper, backlog) pair in ./20-bundle-classification.ts —
 *      bundle-curate.sh is a pure classifier (no clock, no network, no writes into the
 *      tracked tree), so the same pair yields the same stdout;
 *   2. the three runs are prefetched CONCURRENTLY in `beforeAll`, so the file's whole
 *      shell cost is one fixed block and every `it` is a Map lookup.
 * After: 6.94s standalone, every individual test ≤23ms — no test's wall time tracks host
 * load any more. The paired-negative twin got the same treatment: 31.24s → 16.09s.
 *
 * The memo cannot mask a broken helper: the key covers the SCRIPT path, so a mutated
 * copy gets its own entry. Verified by planting the eligibility-filter break into the
 * real bundle-curate.sh and re-running this file — 3 assertions here went RED. The
 * paired-negative twin pins that property as a standing arm, and both files assert the
 * prefetch actually landed (a key-construction drift between the prefetch and the sync
 * runner is otherwise a SILENT no-op: the first call site just re-runs and caches, so
 * only the load-lottery protection is lost, invisibly — that drift happened once while
 * this was being written).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import {
  HELPER,
  FIXTURES,
  REPO_ROOT,
  runCurate,
  primeCurate,
  countRows,
} from './20-bundle-classification.js';

/** The three fixtures this file asserts on — the whole shell cost of the file. */
const BACKLOGS = [
  'backlog-1-clean.txt',
  'backlog-2-mixed.txt',
  'backlog-3-overlap.txt',
];

/**
 * Per-test timeout. bundle-curate.sh spawns classify-work.sh + assign-skill.sh once per
 * backlog item, so the FIRST run against a given fixture is ~5-6s; every later assertion
 * on the same fixture is served from the shared runner's memo (see the module header) and
 * costs nothing. The budget stays at 30s — this file no longer needs it, but a fixture
 * gaining items must still fit under .husky/pre-push's per-file vitest timeout.
 */
const SLOW_SHELL_MS = 30_000;

/**
 * Run the REAL bundle-curate.sh on a fixture file; return stdout.
 *
 * Memoised per (helper, backlog) pair by `runCurate`. Twelve call sites here resolve to
 * three distinct fixtures, so three real runs happen instead of twelve — see the perf
 * rationale and the cache-key safety argument in ./20-bundle-classification.ts.
 */
function runBundleCurate(fixtureName: string): string {
  return runCurate(HELPER, resolve(FIXTURES, fixtureName));
}

describe(
  'Principle 20 — bundle-curate.sh mechanical correctness',
  { timeout: SLOW_SHELL_MS },
  () => {
    // One concurrent, fixed-cost block instead of twelve serial runs charged to the `it`
    // bodies. Every assertion below is then a memo lookup, so no individual test's wall
    // time tracks host load — which is what made this file the pre-push timeout lottery's
    // loser (incident 2026-09-05). The three runs are independent processes over
    // read-only fixtures, so running them concurrently is safe.
    let primed = -1;
    beforeAll(async () => {
      primed = await primeCurate(
        BACKLOGS.map((b) => [HELPER, resolve(FIXTURES, b)] as [string, string]),
      );
    }, SLOW_SHELL_MS);

    // Prefetch liveness. A prefetch that silently misses the memo (a key-construction drift
    // between primeCurate and runCurate — which is exactly what happened while this was
    // written) still LOOKS like a speed-up, because the first call site re-runs and caches
    // and every repeat call site goes to 0ms. Only the load-lottery protection is lost, and
    // silently. This asserts the prefetch actually landed rather than trusting it.
    it('prefetch primed every fixture (no silent key drift between primeCurate and runCurate)', () => {
      expect(primed, 'primeCurate did not memoise all fixtures').toBe(
        BACKLOGS.length,
      );
    });

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
        expect(output).toContain(
          '| idx | item-source | classification | dispatch-mode | assigned-skill | file-scope | notes |',
        );
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
        const dataRows = output
          .split('\n')
          .filter((l) => l.startsWith('|') && l.includes('fix'));
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
        expect(output).toContain(
          'excluded: type=R-phase not in {fix,I-phase-small}',
        );
      });

      it('I-phase-large item is excluded (not in {fix,I-phase-small})', () => {
        const output = runBundleCurate('backlog-2-mixed.txt');
        expect(output).toContain(
          'excluded: type=I-phase-large not in {fix,I-phase-small}',
        );
      });

      it('1 item excluded by max-bundle-5 cap', () => {
        const output = runBundleCurate('backlog-2-mixed.txt');
        expect(countRows(output, 'max-bundle-5 cap')).toBe(1);
      });

      it('total row count is 8 (all items accounted for)', () => {
        const output = runBundleCurate('backlog-2-mixed.txt');
        const dataRows = output
          .split('\n')
          .filter(
            (l) =>
              l.startsWith('|') &&
              !l.includes('idx | item-source') &&
              !l.startsWith('|---|'),
          );
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
          .filter(
            (l) =>
              l.startsWith('|') &&
              !l.includes('idx | item-source') &&
              !l.startsWith('|---|'),
          );
        expect(dataRows.length).toBe(5);
      });
    });

    // ── Edge case: empty / all-comment backlog ────────────────────────────────────
    it('exits cleanly on all-comment backlog (empty effective input) — no crash', () => {
      const { execSync } = require('node:child_process');
      // Create a temp file with only comments
      const tmpFile = resolve(
        REPO_ROOT,
        'packages/core/principles/__fixtures__/bundle/.empty-test-tmp',
      );
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
          .filter(
            (l: string) =>
              l.startsWith('|') &&
              !l.includes('idx | item-source') &&
              !l.startsWith('|---|'),
          );
        expect(dataRows.length).toBe(0);
      } finally {
        try {
          unlinkSync(tmpFile);
        } catch {
          /* noop */
        }
      }
    });
  },
);
