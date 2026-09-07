/**
 * Principle 20 paired-negative — bundle-curate.sh correctness (principle 02 mandate)
 *
 * REWRITTEN 2026-06-27 (DN-T3-2, §13.32 DN-M1 Task-3 fix). The prior version built
 * fabricated markdown strings locally (brokenBundleNoFilter/NoCap/NoOverlap) and never
 * executed bundle-curate.sh — it asserted properties of hand-written rows, proving
 * nothing about the real checker. That was the SUSPECT-TAUTOLOGY finding in
 * docs/meta-factory/research-patches/2026-06-27-§13.32-DN-M1-task3-principle-test-assertion-audit.md §4.2.
 *
 * This version runs a deliberately-MUTATED copy of the REAL bundle-curate.sh against the
 * REAL fixtures and asserts the positive checks in 20-bundle-classification.test.ts would
 * FAIL — the genuine principle-02 paired-negative: break the subject, the gate must catch it.
 * Each mutant disables exactly ONE rule (eligibility filter / max-5 cap / file-overlap),
 * and each arm asserts the matching positive expectation no longer holds. A `control` arm
 * proves the un-mutated script DOES produce the positive expectations, so a mutant arm
 * failing means the mutation broke it — not a fixture/runner regression.
 *
 * The mutant runs from a COPY of the whole helpers dir in a temp dir (so the script's
 * sibling lookups — classify-work.sh / assign-skill.sh via SCRIPT_DIR — still resolve)
 * and never writes into the tracked tree (parallel-safe w.r.t. principle 14 skill-drift).
 *
 * T-BA-C: the eligibility-filter mutant proves a bundle with an R-phase item (filter
 * broken) loses the `excluded: type=R-phase` row the positive check (:104) asserts.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  readFileSync,
  writeFileSync,
  chmodSync,
  mkdtempSync,
  rmSync,
  cpSync,
} from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  HELPER,
  FIXTURES,
  runCurate,
  primeCurate,
  countRows,
} from './20-bundle-classification.js';

const HELPERS_DIR = dirname(HELPER);

/**
 * Per-arm timeout. bundle-curate.sh spawns classify-work.sh + assign-skill.sh ONCE PER
 * backlog item (8 for backlog-2), so a single run is ~5-6s. Since 2026-09-06 the arms
 * do not pay that: every run is materialised and primed concurrently in `beforeAll`
 * (see below) and each arm is a memo lookup. The budget stays at 60s for the priming
 * block itself — under a loaded host four concurrent runs still have to finish.
 */
const SLOW_SHELL_MS = 60_000;

/** One mutant: a literal break applied to a private copy of the helpers dir. */
interface Mutant {
  find: string;
  replace: string;
  fixture: string;
  /** Filled in by `materialise` — the mutated script's path, i.e. its memo key half. */
  helperPath: string;
}

/**
 * The mutation matrix. Each entry disables exactly ONE rule of bundle-curate.sh; the
 * arms below assert the matching positive expectation no longer holds.
 *
 * `eligibility` is referenced by two arms (T-BA-C and the memoisation-safety arm) and
 * runs ONCE — that is the point of the shared memo.
 */
const MUTANTS: Record<'eligibility' | 'cap' | 'overlap', Mutant> = {
  // A hard-false test (`[[ 1 -eq 0 ]]`), NOT the string `false` — `[[ false ]]` is truthy
  // in bash (non-empty string), which would keep the exclusion firing.
  eligibility: {
    find: '"${ITEM_TYPE}" != "fix" && "${ITEM_TYPE}" != "I-phase-small"',
    replace: '1 -eq 0',
    fixture: 'backlog-2-mixed.txt',
    helperPath: '',
  },
  cap: {
    find: '"${BUNDLE_COUNT}" -lt 5',
    replace: '"${BUNDLE_COUNT}" -lt 999',
    fixture: 'backlog-2-mixed.txt',
    helperPath: '',
  },
  overlap: {
    find: '"${OVERLAP}" -eq 1',
    replace: '"${OVERLAP}" -eq 999',
    fixture: 'backlog-3-overlap.txt',
    helperPath: '',
  },
};

/** Temp dirs holding the mutant helper trees; removed in `afterAll`. */
const tmpDirs: string[] = [];

/**
 * Copy the whole helpers dir to a temp dir (so the script's sibling lookups —
 * classify-work.sh / assign-skill.sh via SCRIPT_DIR — still resolve) and apply ONE
 * literal break to the bundle-curate.sh copy. Throws if the mutation target is absent,
 * so a future edit that moves the line fails loudly instead of silently testing an
 * un-mutated script.
 */
function materialise(m: Mutant): void {
  const tmpDir = mkdtempSync(join(tmpdir(), 'p20-pn-'));
  tmpDirs.push(tmpDir);
  const helpersCopy = join(tmpDir, 'helpers');
  cpSync(HELPERS_DIR, helpersCopy, { recursive: true });

  const mutantHelper = join(helpersCopy, 'bundle-curate.sh');
  const original = readFileSync(mutantHelper, 'utf8');
  const mutated = original.replace(m.find, m.replace);
  if (mutated === original) {
    throw new Error(
      `mutation target not found in bundle-curate.sh: ${JSON.stringify(m.find)} — ` +
        `the script changed; update this paired-negative's mutation target`,
    );
  }
  writeFileSync(mutantHelper, mutated);
  chmodSync(mutantHelper, 0o755);
  m.helperPath = mutantHelper;
}

/**
 * Output of a mutant, from the shared memo.
 *
 * Routed through the SHARED runner on purpose: a mutant's helper path is its own temp
 * dir, so it gets its own cache key and can never be served the pristine script's
 * output. The memoisation-safety arm pins exactly that property.
 */
function mutantOutput(key: keyof typeof MUTANTS): string {
  const m = MUTANTS[key];
  return runCurate(m.helperPath, resolve(FIXTURES, m.fixture));
}

describe('Principle 20 paired-negative — a broken bundle-curate.sh fails the positive checks', () => {
  // Materialise every mutant, then run the pristine script and all three mutants
  // CONCURRENTLY into the shared memo. The arms below are memo lookups, so no arm's wall
  // time tracks host load — the pre-push timeout lottery this file used to sit in
  // (incident 2026-09-05). Each run is an independent process over read-only fixtures
  // and its own private helpers copy, so concurrency is safe.
  let primed = -1;
  const PAIR_COUNT = 1 + Object.keys(MUTANTS).length; // pristine + one per mutant
  beforeAll(async () => {
    for (const m of Object.values(MUTANTS)) materialise(m);
    primed = await primeCurate([
      [HELPER, resolve(FIXTURES, 'backlog-2-mixed.txt')],
      ...Object.values(MUTANTS).map(
        (m) => [m.helperPath, resolve(FIXTURES, m.fixture)] as [string, string],
      ),
    ]);
  }, SLOW_SHELL_MS);

  afterAll(() => {
    for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
    tmpDirs.length = 0;
  });

  // Prefetch liveness — see the twin assertion in the positive file for why a silently
  // missing prefetch is invisible without it.
  it('prefetch primed the pristine script and every mutant', () => {
    expect(
      primed,
      'primeCurate did not memoise all (helper, backlog) pairs',
    ).toBe(PAIR_COUNT);
  });

  // ── control: the un-mutated script DOES produce the positive expectations ────
  // Proves the mutant arms below fail BECAUSE of the mutation, not a fixture/runner bug.
  it(
    'control: the real (un-mutated) bundle-curate.sh excludes the R-phase item and caps at 5',
    () => {
      const out = runCurate(HELPER, resolve(FIXTURES, 'backlog-2-mixed.txt'));
      expect(out).toContain(
        'excluded: type=R-phase not in {fix,I-phase-small}',
      );
      expect(countRows(out, 'in-bundle')).toBe(5);
    },
    SLOW_SHELL_MS,
  );

  // ── memoisation safety: the cache is keyed on the SCRIPT, not just the fixture ──
  // The 2026-09-06 speed-up memoises bundle-curate.sh runs so the positive file stops
  // re-deriving three identical outputs twelve times. A cache keyed on the fixture ALONE
  // would be a silent gate-killer: a planted violation in bundle-curate.sh would be
  // served the pristine script's cached rows and every positive assertion would stay
  // green. This arm plants a violation AFTER the pristine run has already populated the
  // memo for the same fixture, and asserts the gate still goes RED.
  it(
    'memoised runner stays RED on a planted violation against an already-memoised fixture',
    () => {
      const pristine = runCurate(
        HELPER,
        resolve(FIXTURES, 'backlog-2-mixed.txt'),
      );
      expect(pristine).toContain(
        'excluded: type=R-phase not in {fix,I-phase-small}',
      );

      // Same fixture, planted script. A fixture-keyed cache would hand back `pristine`.
      const planted = mutantOutput('eligibility');
      expect(planted).not.toBe(pristine);
      // The positive file's eligibility assertion, evaluated against the planted script.
      expect(planted).not.toContain(
        'excluded: type=R-phase not in {fix,I-phase-small}',
      );
    },
    SLOW_SHELL_MS,
  );

  // ── T-BA-C: eligibility-filter mutant → R-phase item no longer excluded ──────
  it(
    'T-BA-C: broken B1 eligibility filter → R-phase item is NOT excluded (positive :104 would fail)',
    () => {
      expect(mutantOutput('eligibility')).not.toContain(
        'excluded: type=R-phase not in {fix,I-phase-small}',
      );
    },
    SLOW_SHELL_MS,
  );

  // ── max-5 cap mutant → more than 5 items enter the bundle ────────────────────
  it(
    'broken max-5 cap → >5 items in-bundle (positive :99 toBe(5) would fail)',
    () => {
      // backlog-2 has 6 items passing the filter; with the cap broken all 6 enter (not 5).
      expect(countRows(mutantOutput('cap'), 'in-bundle')).toBeGreaterThan(5);
    },
    SLOW_SHELL_MS,
  );

  // ── file-overlap mutant → overlapping items no longer rejected ───────────────
  it(
    'broken file-overlap rejection → overlapping items stay in-bundle (positive :130 toBe(3) would fail)',
    () => {
      const out = mutantOutput('overlap');
      // backlog-3 has 5 fix items (3 share a file); with overlap rejection broken, >3 enter.
      expect(countRows(out, 'in-bundle')).toBeGreaterThan(3);
      expect(countRows(out, 'file-overlap with prior candidate')).toBe(0);
    },
    SLOW_SHELL_MS,
  );
});
