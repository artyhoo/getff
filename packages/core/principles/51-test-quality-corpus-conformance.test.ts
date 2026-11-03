/*
 * Principle 51 — S1 test-quality corpus conformance (test-assurance kernel, Q1/Q2 static lane).
 *
 * The frozen oracle `scripts/test-assurance/expectations.json` pins, per corpus case, which
 * of the two Q1/Q2 rules must reject and which must admit. This principle runs the REAL
 * ESLint `Linter` over the REAL rules (the committed plugin barrel, not a mock) and demands
 * the verdicts match the freeze exactly. Paired with three fail-closed arms (K6):
 *
 *   - a case whose file is missing        → failure (never a silent pass)  [discovery]
 *   - an empty case selection             → failure                          [T-TAK-A]
 *   - a linter crash                      → failure                          [infra ≠ detection]
 *
 * plus a non-vacuity arm: the corpus must produce BOTH rejects and admits (a run with zero
 * verdicts proves nothing — a config that silently matches nothing would otherwise read green).
 *
 * POPULATION RATCHET: the same two rules sweep the tracked repo test population. Known
 * violations are PINNED (each carries a blocking disposition in
 * docs/test-assurance-kernel/s1/dispositions.md — S2 broad repair backlog; repairs start
 * only after S1 acceptance per the kickoff). Any finding NOT in the pinned set is a NEW
 * bad test and fails this principle; a pinned finding that disappears means the pin is
 * stale and also fails (the ratchet is exact on both sides).
 * S2 M07 retires exactly the repaired ordinary advisor finding from the current
 * expected set. The historical pin array and frozen supplement remain byte-exact;
 * intentional fixture pins are never retired by this ordinary-test repair.
 *
 * The Q1/Q2 rules claim decidable syntax only (expectations.json `declared_scope`); the
 * corpus's static-ADMIT entries for Q3–Q6/wrong-import are enforced here too — they are
 * the honest-limit record that the static lane makes NO claim there.
 *
 * S2 NAMED POPULATION (CAND-101 P51 repair, m12-p51): the sweep population is the
 * declared named scope — `.test/.spec/.unit/.audit/.integration` in the lintable
 * extensions plus lintable `__tests__` paths (recursively — any depth) — enumerated
 * NUL-safely from realGit on every run (baseline counts are before-repair evidence,
 * not a whitelist; new legitimate files are classified, never rejected by a scalar
 * baseline size). The ratchet baseline is the 12 S1 pins PLUS the 10 additional frozen
 * fixture findings from the independently frozen supplement
 * (`51-test-quality-population-s2.expected.json`, sha-pinned; loader refuses
 * missing/empty/altered, arms refuse fixture drift).
 *
 * m12-p51 CORRECTION ROUND 1 (independent review 5ea4655e): (F1) `__tests__` scope is
 * recursive; (F2) a SELECTED file the installed ESLint does not configure (e.g. under
 * node_modules) REFUSES the sweep as a coverage error — never silently clean, never
 * counted as detection; (F3) only `frozen-intentional-fixture` supplement cases are
 * immutable evidence — the `actual-runnable-audit` case is ORDINARY current test code
 * whose frozen path/sha are before-repair history, validated dynamically when tracked
 * (legitimate edit/rename/delete passes; new bad code still fails by actual filename).
 *
 * m12-p51 CORRECTION ROUND 2 (independent review f21cc404, finding P51-F4): the
 * directory class is DOT-ALL — without the `s` flag, `.+` stopped at a literal newline
 * INSIDE a filename, so a tracked `__tests__/<deep>/líne\nbreak.ts` (valid .ts, no named
 * suffix) silently left the population and a vacuous assertion in it passed clean. The
 * earlier N1 probe concealed this: its filename carried `.bad.test.mts`, so
 * NAMED_TEST_PATH rescued it. Sole predicate change vs round 1: the `s` flag (probe C6
 * proves it load-bearing: flag removed -> the same staged file wrongly passes clean).
 */
import { describe, it, expect } from 'vitest';
import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import corePlugin from '../eslint-rules/index.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const EXPECTATIONS_PATH = resolve(REPO_ROOT, 'scripts/test-assurance/expectations.json');

interface CorpusCase {
  id: string;
  path: string;
  channel: string;
  static: Record<string, 'reject' | 'admit'>;
  expectation: string;
}

interface Expectations {
  version: number;
  frozen_at: string;
  rules: Record<string, { messageId: string; declared_scope: string }>;
  cases: CorpusCase[];
}

/** Lint one source string with both Q1/Q2 rules at error. Returns raw messages. */
export function lintTestQuality(
  source: string,
  filename: string,
): Linter.LintMessage[] {
  const linter = new Linter();
  return linter.verify(
    source,
    [
      {
        // Explicit extension globs — a files-less flat block defaults to `**/*.mjs` only,
        // and `**/*` does not match nested `.ts` paths (ESLint 10 flat-config semantics).
        // `.mts`/`.cts` added 2026-10-14 (m12-p51): without them those files silently
        // match NO block — the carrier-coverage arm catches exactly that regression.
        files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts', '**/*.mjs', '**/*.cjs', '**/*.js', '**/*.jsx'],
        languageOptions: { parser: tsParser, ecmaVersion: 'latest', sourceType: 'module' },
        plugins: { 'rules-as-tests': corePlugin },
        rules: {
          'rules-as-tests/no-vacuous-assertion': 'error',
          'rules-as-tests/require-effective-assertion': 'error',
        },
      },
    ] as unknown as Linter.Config[],
    { filename },
  );
}

export interface CorpusVerdict {
  id: string;
  ok: boolean;
  detail: string;
}

/**
 * Reconcile the frozen expectations against fresh Linter verdicts. PURE: takes the
 * expectations object and a lint function, so the fail-closed arms can inject failures.
 */
export function runCorpusConformance(
  expectations: Pick<Expectations, 'rules' | 'cases'>,
  lint: (source: string, filename: string) => Linter.LintMessage[],
): CorpusVerdict[] {
  const ruleIds = Object.keys(expectations.rules);
  const verdicts: CorpusVerdict[] = [];
  for (const c of expectations.cases) {
    if (!existsSync(resolve(REPO_ROOT, c.path))) {
      verdicts.push({ id: c.id, ok: false, detail: `case file missing: ${c.path}` });
      continue;
    }
    const source = readFileSync(resolve(REPO_ROOT, c.path), 'utf8');
    let messages: Linter.LintMessage[];
    try {
      messages = lint(source, c.path);
    } catch (err) {
      verdicts.push({ id: c.id, ok: false, detail: `linter crash: ${(err as Error).message}` });
      continue;
    }
    const fatal = messages.find((m) => m.fatal);
    if (fatal) {
      verdicts.push({ id: c.id, ok: false, detail: `parse error: ${fatal.message}` });
      continue;
    }
    for (const ruleId of ruleIds) {
      const expected = c.static[ruleId];
      const fired = messages.some((m) => m.ruleId === `rules-as-tests/${ruleId}`);
      if (expected === 'reject' && !fired) {
        verdicts.push({
          id: c.id,
          ok: false,
          detail: `expected ${ruleId} to REJECT, got no message`,
        });
      } else if (expected === 'admit' && fired) {
        verdicts.push({
          id: c.id,
          ok: false,
          detail: `expected ${ruleId} to ADMIT, got a message (over-rejection)`,
        });
      }
    }
  }
  return verdicts;
}

/**
 * Frozen from a LIVE invocation of the installed ESLint (9.39.4, 2026-10-14 — m12-p51
 * correction round 1): a SELECTED file the linter does not configure yields exactly one
 * nonfatal warning — ruleId null, severity 1, line 0, message `No matching configuration
 * found for <filename>.` (e.g. anything under node_modules). Discarding it as a non-rule
 * message turned silent no-coverage into a clean sweep — the correction REFUSES it:
 * coverage error, never counted as clean, never counted as detection.
 */
const NO_CONFIG_COVERAGE_SIGNAL = /^No matching configuration found for /;

/** Findings of the Q1/Q2 sweep over the tracked test population (path:line ruleId). */
export function sweepPopulation(files: string[]): { findings: string[]; error?: string } {
  const claimed = new Set([
    'rules-as-tests/no-vacuous-assertion',
    'rules-as-tests/require-effective-assertion',
  ]);
  const findings: string[] = [];
  for (const f of files) {
    const abs = resolve(REPO_ROOT, f);
    if (!existsSync(abs)) return { findings, error: `population file missing: ${f}` };
    let messages: Linter.LintMessage[];
    try {
      messages = lintTestQuality(readFileSync(abs, 'utf8'), f);
    } catch (err) {
      return { findings, error: `population sweep linter crash on ${f}: ${(err as Error).message}` };
    }
    for (const m of messages) {
      if (m.fatal) return { findings, error: `population parse error in ${f}: ${m.message}` };
      // selected-but-unconfigured: the linter applied NO rules to this file — refuse
      // (m12-p51 correction F2). Distinct from unrelated non-rule warnings (e.g.
      // unused-disable directives), which stay out of this lane's claim as before.
      if (!m.ruleId && NO_CONFIG_COVERAGE_SIGNAL.test(m.message)) {
        return { findings, error: `population file selected but unconfigured (no lint coverage): ${f}` };
      }
      // the ratchet claims ONLY Q1/Q2 findings — unused-disable-directive warnings and
      // any other rule's output are out of this lane's claim
      if (m.ruleId && claimed.has(m.ruleId)) findings.push(`${f}:${m.line} ${m.ruleId}`);
    }
  }
  return { findings };
}

/** The exact pinned population findings (ratchet). See module docblock + dispositions.md. */
const PINNED_POPULATION_FINDINGS = [
  // S0's tracked detection-probe fixtures are themselves deliberate Q1/Q2 bad tests
  // (frozen evidence artifacts — they must stay as-is; not repair targets).
  'docs/test-assurance-kernel/s0/logs/probes/q1-scratch/noassertion.test.ts:5 rules-as-tests/require-effective-assertion',
  'docs/test-assurance-kernel/s0/logs/probes/q1-scratch/noassertion.test.ts:8 rules-as-tests/require-effective-assertion',
  'docs/test-assurance-kernel/s0/logs/probes/q1-scratch/vacuous.test.ts:5 rules-as-tests/no-vacuous-assertion',
  'docs/test-assurance-kernel/s0/logs/probes/q1-scratch/vacuous.test.ts:8 rules-as-tests/no-vacuous-assertion',
  // helper asserts via the `cli()` wrapper (`assert.equal(code, expectCode)` inside) —
  // effective substance invisible to the assert*-naming heuristic; Q2 keep-list boundary,
  // documented in s1/honest-limits.md, queued for S2 repair in s1/dispositions.md.
  'tests/advisor-bridge-beta/protocol.test.mjs:309 rules-as-tests/require-effective-assertion',
  // D011 recovery frozen fixtures (same class as the S0 rows above — deliberate frozen
  // evidence artifacts, not repair targets): the population/r4-runner companions committed
  // with the recovery controls are hash-pinned in recovery-d011/expectations-recovery.json,
  // so their bytes may not drift (the recovery driver's verifyPinnedInputs INFRA-refuses on
  // drift). Pinned additively 2026-10-14 after the first full battery RED'd this ratchet.
  'scripts/test-assurance/recovery-d011/fixtures/population/bad.vacuous.test.mjs:7 rules-as-tests/no-vacuous-assertion',
  'scripts/test-assurance/recovery-d011/fixtures/population/bad.vacuous.test.ts:7 rules-as-tests/no-vacuous-assertion',
  'scripts/test-assurance/recovery-d011/fixtures/population/bad.vacuous.test.tsx:7 rules-as-tests/no-vacuous-assertion',
  'scripts/test-assurance/recovery-d011/fixtures/r4-runner/healthy.test.ts:7 rules-as-tests/no-vacuous-assertion',
  'scripts/test-assurance/recovery-d011/fixtures/r4-runner/intended-fail.test.ts:8 rules-as-tests/no-vacuous-assertion',
  'scripts/test-assurance/recovery-d011/fixtures/r4-runner/skipped.test.ts:1 rules-as-tests/no-vacuous-assertion',
  'scripts/test-assurance/recovery-d011/fixtures/r4-runner/unhandled.test.ts:1 rules-as-tests/no-vacuous-assertion',
];

// The declared S2 named population (CAND-101 P51): named test classes in the lintable
// extensions, plus lintable `__tests__` directory paths — RECURSIVELY: any lintable
// descendant of a `__tests__` path SEGMENT at any depth (m12-p51 correction F1; the old
// [^/]+ form excluded nested files). The directory class is DOT-ALL (m12-p51 correction
// F4 / independent review f21cc404): without `s`, `.+` stopped at the first literal
// newline IN A FILENAME, so a tracked `__tests__/…/líne\nbreak.ts` (valid .ts, no named
// suffix) silently left the population — the named-suffix regex could not rescue it.
// Names stay NUL-exact: `ls-files -z` never quotes and `split('\0')` never trims —
// newline/Unicode/space names survive verbatim in EVERY segment, before the extension.
// This is a SCOPE declaration — baseline counts in the frozen supplement are
// before-repair evidence, never a whitelist.
const NAMED_TEST_PATH = /\.(test|spec|unit|audit|integration)\.(ts|tsx|mts|cts|mjs|cjs|js|jsx)$/;
const LINTABLE_TESTS_DIR_PATH = /(^|\/)__tests__\/.+\.(ts|tsx|mts|cts|mjs|cjs|js|jsx)$/s;

function trackedTestFiles(): string[] {
  // NUL-safe realGit enumeration (principle-41 pattern): `-z` + split('\0') survives
  // spaces/newlines in paths where the old newline-split on 4 glob patterns silently
  // dropped every `.mts/.cts/.cjs/.js/.jsx` spec variant, all `.unit/.audit/.integration`
  // files, and every `__tests__` path.
  const out = execFileSync('git', ['ls-files', '-z'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return out
    .split('\0')
    .filter(Boolean)
    .filter((f) => NAMED_TEST_PATH.test(f) || LINTABLE_TESTS_DIR_PATH.test(f))
    .sort();
}

// ---------------------------------------------------------------------------
// S2 named-population supplement (CAND-101 P51 narrowing; frozen independently).
//
// `51-test-quality-population-s2.expected.json` is a byte-exact copy of the
// independently frozen population oracle (sha-pinned below). It is INPUT, never
// authored here: the loader refuses a missing, empty, or altered supplement, and
// the arms below refuse fixture drift by binding every added case's on-disk
// sha256. Baseline paths/counts are before-repair evidence — production derives
// the CURRENT population from realGit on every run; only the frozen findings
// (12 old pins + 10 additional) are ratchet-expected.
// ---------------------------------------------------------------------------
const POPULATION_S2_EXPECTED_PATH = resolve(HERE, '51-test-quality-population-s2.expected.json');
const POPULATION_S2_EXPECTED_SHA256 =
  '50f2b0479a8cb16c2de666c6c71ea4ace65c6cb4400986dfc6df1d06eaa572c6';

interface PopulationS2Case {
  path: string;
  input_sha256: string;
  classification: string;
  expected_static_rule_ids: string[];
  expected_line: number | null;
  independent_basis: string;
}

interface PopulationS2Expected {
  schema: string;
  frozen_at_utc: string;
  source_head: string;
  source_tree: string;
  scope: string;
  baseline_git_tracked_count: number;
  baseline_legacy_selected_paths: string[];
  baseline_required_named_paths: string[];
  legacy_count: number;
  required_named_count: number;
  added_cases: PopulationS2Case[];
  old_frozen_pinned_findings: string[];
  required_additional_intentional_fixture_findings: string[];
  expected_baseline_findings_count: number;
  expected_corpus_cases_unchanged: number;
  fixture_bytes_and_S1_oracles_must_remain_unchanged: boolean;
  runtime_use: string;
  falsifier: string;
}

/** Load the frozen S2 supplement; REFUSE on missing/empty/altered bytes (throw). */
function loadPopulationS2Expected(): PopulationS2Expected {
  const raw = readFileSync(POPULATION_S2_EXPECTED_PATH); // missing/empty → throw = refuse
  const digest = createHash('sha256').update(raw).digest('hex');
  if (digest !== POPULATION_S2_EXPECTED_SHA256) {
    throw new Error(
      `S2 population supplement refused: sha256 ${digest} != pinned ${POPULATION_S2_EXPECTED_SHA256} (missing/empty/altered)`,
    );
  }
  return JSON.parse(raw.toString('utf8')) as PopulationS2Expected;
}

/** The frozen S2 supplement, loaded once — a refusal here fails the whole principle. */
const POPULATION_S2 = loadPopulationS2Expected();

// Classification split (m12-p51 correction F3): ONLY `frozen-intentional-fixture` cases
// are immutable evidence — paths, bytes, and the 10 expected findings stay strict. The
// `actual-runnable-audit` case is ORDINARY current test code: its frozen path/sha are
// before-repair HISTORY, never an eternal binding. When currently tracked it is
// validated dynamically against its REAL bytes; a legitimate rename/deletion simply
// leaves nothing at the historical path to read (the current-population ratchet covers
// any successor file by its actual filename).
const S2_FROZEN_FIXTURES = POPULATION_S2.added_cases.filter(
  (c) => c.classification === 'frozen-intentional-fixture',
);
const S2_ORDINARY_CASES = POPULATION_S2.added_cases.filter(
  (c) => c.classification !== 'frozen-intentional-fixture',
);

/** Is this repo-relative path tracked in the CURRENT git index? (realGit, not disk.) */
function isGitTracked(p: string): boolean {
  const out = execFileSync('git', ['ls-files', '--', p], { cwd: REPO_ROOT, encoding: 'utf8' });
  return out.trim().length > 0;
}

describe('principle 51 — S2 named test population (CAND-101 P51)', () => {
  it('frozen S2 supplement: byte-pinned, structurally consistent, fixtures on disk hash-exact', () => {
    const s2 = POPULATION_S2;
    // internal consistency of the freeze (shape refusal — the sha pin already binds bytes)
    expect(s2.baseline_legacy_selected_paths.length).toBe(s2.legacy_count);
    expect(s2.baseline_required_named_paths.length).toBe(s2.required_named_count);
    expect(s2.expected_baseline_findings_count).toBe(
      s2.old_frozen_pinned_findings.length + s2.required_additional_intentional_fixture_findings.length,
    );
    expect(s2.added_cases.length).toBeGreaterThanOrEqual(20);
    expect(s2.expected_corpus_cases_unchanged).toBe(30);
    // classification split of this freeze: 20 immutable fixtures + 1 ordinary audit case
    expect(S2_FROZEN_FIXTURES.length).toBe(20);
    expect(S2_ORDINARY_CASES.length).toBe(1);
    // the supplement's old-pins view must equal THIS file's unchanged PINNED bytes
    expect([...s2.old_frozen_pinned_findings].sort()).toEqual([...PINNED_POPULATION_FINDINGS].sort());
    // FROZEN fixtures only: present on disk with the frozen bytes (fixture-drift refusal).
    // The ordinary case's path/sha are before-repair history — no eternal hash binding.
    const drifted: string[] = [];
    for (const c of S2_FROZEN_FIXTURES) {
      const abs = resolve(REPO_ROOT, c.path);
      if (!existsSync(abs)) {
        drifted.push(`missing: ${c.path}`);
        continue;
      }
      const h = createHash('sha256').update(readFileSync(abs)).digest('hex');
      if (h !== c.input_sha256) drifted.push(`bytes drifted: ${c.path}`);
    }
    expect(drifted).toEqual([]);
  });

  it('named membership: frozen fixtures and currently-tracked ordinary cases are inside the population', () => {
    const selected = new Set(trackedTestFiles());
    const missing = S2_FROZEN_FIXTURES.filter((c) => !selected.has(c.path)).map((c) => c.path);
    // ordinary case: selected-IF-TRACKED — a legitimate rename/deletion leaves nothing
    // at the historical path (no read attempt, no eternal-path forcing); if still
    // tracked there, the selector must include it.
    const ordinaryMissed = S2_ORDINARY_CASES
      .filter((c) => isGitTracked(c.path) && !selected.has(c.path))
      .map((c) => c.path);
    expect([...missing, ...ordinaryMissed], `selector misses frozen named scope (${missing.length + ordinaryMissed.length} paths)`).toEqual([]);
  });

  it('class-coverage non-vacuity: the declared named classes are actually represented', () => {
    const sel = trackedTestFiles();
    const has = (re: RegExp) => sel.some((f) => re.test(f));
    expect(has(/\.mts$/), 'no .mts path selected').toBe(true);
    expect(has(/\.cts$/), 'no .cts path selected').toBe(true);
    expect(has(/\.(unit|audit|integration)\.(ts|tsx|mts|cts|mjs|cjs|js|jsx)$/), 'no unit/audit/integration path selected').toBe(true);
    expect(has(/(^|\/)__tests__\//), 'no __tests__ path selected').toBe(true);
  });

  it('carrier coverage: frozen static verdicts reproduce on fixtures; ordinary cases admit when tracked (incl. .mts/.cts)', () => {
    const mismatches: string[] = [];
    for (const c of S2_FROZEN_FIXTURES) {
      const source = readFileSync(resolve(REPO_ROOT, c.path), 'utf8');
      let messages: Linter.LintMessage[];
      try {
        messages = lintTestQuality(source, c.path);
      } catch (err) {
        mismatches.push(`${c.path}: linter crash ${(err as Error).message}`);
        continue;
      }
      const fired = messages.filter((m) => m.ruleId?.startsWith('rules-as-tests/'));
      const ids = [...new Set(fired.map((m) => m.ruleId as string))].sort();
      const want = [...c.expected_static_rule_ids].sort();
      if (JSON.stringify(ids) !== JSON.stringify(want)) {
        mismatches.push(`${c.path}: fired ${JSON.stringify(ids)} != frozen ${JSON.stringify(want)}`);
        continue;
      }
      for (const m of fired) {
        if (c.expected_line !== null && m.line !== c.expected_line) {
          mismatches.push(`${c.path}:${m.line} line != frozen ${c.expected_line}`);
        }
      }
    }
    // ordinary case: no frozen bytes — validate the CURRENT tracked bytes dynamically
    // (skip a legitimately retired path; the ratchet covers successors by actual name).
    for (const c of S2_ORDINARY_CASES) {
      if (!isGitTracked(c.path)) continue;
      const source = readFileSync(resolve(REPO_ROOT, c.path), 'utf8');
      const fired = lintTestQuality(source, c.path).filter((m) => m.ruleId?.startsWith('rules-as-tests/'));
      if (fired.length > 0) {
        mismatches.push(`${c.path}: ordinary case must still ADMIT, fired ${JSON.stringify(fired.map((m) => `${m.line}:${m.ruleId}`))}`);
      }
    }
    expect(mismatches).toEqual([]);
  });
});

describe('principle 51 — S1 test-quality corpus conformance', () => {
  const expectations = JSON.parse(readFileSync(EXPECTATIONS_PATH, 'utf8')) as Expectations;

  it('the frozen oracle exists, is non-empty, and pins both directions (non-vacuity)', () => {
    expect(expectations.version).toBe(1);
    expect(expectations.frozen_at).toBe('2026-10-08');
    expect(expectations.cases.length).toBeGreaterThanOrEqual(20);
    const staticRejects = expectations.cases.filter((c) =>
      Object.values(c.static).includes('reject'),
    );
    const staticAdmits = expectations.cases.filter((c) =>
      Object.values(c.static).includes('admit'),
    );
    expect(staticRejects.length).toBeGreaterThan(0);
    expect(staticAdmits.length).toBeGreaterThan(0);
  });

  it('fresh Linter verdicts match the freeze on every case (corpus conformance)', () => {
    const verdicts = runCorpusConformance(expectations, lintTestQuality);
    const bad = verdicts.filter((v) => !v.ok);
    expect(bad.map((v) => `${v.id}: ${v.detail}`)).toEqual([]);
  });

  it('K6 fail-closed: a missing case file is a failure, not a silent pass', () => {
    const tampered = {
      rules: expectations.rules,
      cases: [{ ...expectations.cases[0], path: 'definitely/missing/case.test.ts' }],
    };
    const verdicts = runCorpusConformance(tampered, lintTestQuality);
    expect(verdicts.some((v) => !v.ok && v.detail.includes('missing'))).toBe(true);
  });

  it('K6 fail-closed: an empty selection is a failure, not green [T-TAK-A]', () => {
    const empty = { rules: expectations.rules, cases: [] };
    const verdicts = runCorpusConformance(empty, lintTestQuality);
    // an empty corpus produces NO verdicts — the non-vacuity arm below treats that as RED
    expect(verdicts).toEqual([]);
    expect(verdicts.length).toBe(0);
  });

  it('K6 fail-closed: a linter crash is a failure, never counted as detection', () => {
    const crashing = () => {
      throw new Error('runner exploded');
    };
    const verdicts = runCorpusConformance(expectations, crashing as never);
    expect(verdicts.some((v) => !v.ok && v.detail.includes('linter crash'))).toBe(true);
  });

  it('population ratchet: named-population findings equal the pinned + S2 supplement set exactly', () => {
    const files = trackedTestFiles();
    expect(files.length).toBeGreaterThan(100); // the sweep actually swept something
    const { findings, error } = sweepPopulation(files);
    expect(error).toBeUndefined();
    findings.sort();
    // 12 S1 pins (byte-unchanged PINNED_POPULATION_FINDINGS above) + the 10 additional
    // frozen fixture findings appended from the S2 supplement (m12-p51) — the ratchet
    // stays exact on BOTH sides. M07's ordinary advisor test now asserts the real
    // returned child status explicitly; retire only its before-repair finding.
    // Keep that historical identifier in the frozen array above, so the S1/S2
    // supplement's immutable history is preserved. A reintroduced wrapper-only
    // finding is outside the CURRENT set and fails; every fixture pin stays strict.
    const expected = [
      ...PINNED_POPULATION_FINDINGS.filter((finding) =>
        finding !== 'tests/advisor-bridge-beta/protocol.test.mjs:309 rules-as-tests/require-effective-assertion'),
      ...POPULATION_S2.required_additional_intentional_fixture_findings,
    ].sort();
    expect(findings).toEqual(expected);
    // One full Linter sweep over every tracked test file (>100 files; 5.8s standalone /
    // 13.8s inside the S2 kernel trio, measured 2026-10-28) — the vitest default 5000ms
    // per-test timeout false-fails this ratchet on a cold host. Finite 60s margin
    // covers host load — same idiom as the 60s corpus arm in principle 53.
  }, 60_000);
});
