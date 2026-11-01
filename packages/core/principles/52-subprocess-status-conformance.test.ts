/*
 * Principle 52 — Q4/Q5 executed-conformance metachecks (test-assurance kernel, Batch C).
 *
 * Companion test for `52-subprocess-status-conformance.ts` — read its docblock for the
 * mechanism. This principle:
 *   1. reconciles the scenario registry against the FROZEN oracle
 *      (`scripts/test-assurance/expectations.json` — case ids, corpus paths, channels),
 *      so the module can never silently drift from the freeze;
 *   2. runs the REAL vitest runner over the Q4/Q5 corpus in throwaway scratch roots and
 *      demands the executed outcomes match the frozen expectations (reject = survival
 *      demonstrated; admit = kill demonstrated WITH the intended assertion);
 *   3. demands patch honesty: every counterfactual applies EXACTLY ONCE with recorded
 *      sha256 before/after (K7);
 *   4. proves the fail-closed arms: empty selection refused (T-TAK-A), missing corpus
 *      file refused, runner spawn failure classified infrastructure-failure (never
 *      detection), and a kill without the intended assertion text is NOT a kill.
 *
 * Raw Batch-C evidence: docs/test-assurance-kernel/s1/logs/batch-c/ (RED probe +
 * verification). Spec §5 Q-table rows Q4/Q5; A07 lesson (fabricated/comment status must
 * NOT satisfy) is encoded behaviorally: the fabricated-status case survives the fixture
 * flip — corroboration for its static-eslint rejection, never a replacement channel.
 */
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ConformanceError,
  INTENDED_ASSERTIONS,
  Q4_SCENARIO,
  Q5_SCENARIO,
  applyCounterfactual,
  buildScratch,
  childEnv,
  classifyVitestReport,
  evaluateExecutedExpectation,
  observe,
  runScenario,
  runVitest,
  type ScenarioSpec,
} from './52-subprocess-status-conformance.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const EXPECTATIONS_PATH = resolve(REPO_ROOT, 'scripts/test-assurance/expectations.json');

interface ExpectationsCase {
  id: string;
  path: string;
  channel: string;
  expectation: string;
}

interface Expectations {
  frozen_at: string;
  channel_map: Record<string, string>;
  cases: ExpectationsCase[];
}

const ALL_SCENARIOS = [Q4_SCENARIO, Q5_SCENARIO];

describe('principle 52 — bounded wrong-import executed conformance', () => {
  it('M14: the governed module/export fault rejects lookalike assurance and admits the correct companion', () => {
    const contract = JSON.parse(readFileSync(resolve(REPO_ROOT,
      'docs/test-assurance-kernel/s2/m14-wrong-import/frozen-wrong-import-contract.json'), 'utf8')) as {
      scenario: ScenarioSpec;
      fixture_sha256: Record<string, string>;
      expected: {
        selected_files: string[];
        baseline_subject: string[];
        faulted_subject: string[];
        baseline_statuses: Record<string, string>;
        faulted_statuses: Record<string, string>;
        restored_statuses: Record<string, string>;
      };
    };
    const hash = (bytes: string) => createHash('sha256').update(bytes).digest('hex');
    for (const [path, expected] of Object.entries(contract.fixture_sha256)) {
      expect(hash(readFileSync(resolve(REPO_ROOT, path), 'utf8')), `frozen M14 fixture: ${path}`).toBe(expected);
    }
    const spec = contract.scenario;
    const scratch = mkdtempSync(join(tmpdir(), 'tak-m14-'));
    try {
      buildScratch(spec, scratch);
      const subject = join(scratch, 'tests/delivered.ts');
      expect(existsSync(subject), 'M14 must materialize the governed delivered module before execution').toBe(true);
      expect(existsSync(join(scratch, 'tests/lookalike.ts')), 'M14 must materialize the distinct lookalike module').toBe(true);
      const original = readFileSync(subject, 'utf8');
      const controls = ['m14-bad.test.ts', 'm14-good.test.ts', 'lookalike.ts'];
      const frozenControls = controls.map((name) => hash(readFileSync(join(scratch, 'tests', name), 'utf8')));
      const filters = spec.cases.map((c) => `tests/${c.scratchName}`);
      // Probe the real, explicitly governed export in a fresh process, independently
      // of both test files. Distinct input literals prove this fault is non-equivalent.
      const probeSubject = () => {
        const result = spawnSync(resolve(REPO_ROOT, 'node_modules/.bin/tsx'), ['--eval',
          "import { formatStamp } from './tests/delivered.ts'; console.log(JSON.stringify([formatStamp(0), formatStamp(86400000)]));"],
        { cwd: scratch, env: childEnv(), encoding: 'utf8', timeout: 30_000 });
        expect(result.error, 'M14 direct subject probe must execute').toBeUndefined();
        expect(result.signal, 'M14 direct subject probe must finish').toBeNull();
        expect(result.status, result.stderr).toBe(0);
        return JSON.parse(result.stdout) as string[];
      };
      expect(probeSubject()).toEqual(contract.expected.baseline_subject);
      const baseline = runVitest(scratch, filters, 'baseline');
      expect(baseline.classification, baseline.detail).toBe('pass');
      expect(baseline.exitCode).toBe(0);
      expect(Object.keys(baseline.files).sort()).toEqual(contract.expected.selected_files);
      expect(Object.fromEntries(Object.entries(baseline.files).map(([n, r]) => [n, r.status])))
        .toEqual(contract.expected.baseline_statuses);

      const patches = applyCounterfactual(spec, scratch);
      expect(patches).toHaveLength(1);
      expect(patches[0].scratchName).toBe('delivered.ts');
      expect(patches[0].occurrences).toBe(1);
      expect(patches[0].beforeSha256).not.toBe(patches[0].afterSha256);
      expect(probeSubject(), 'M14 actual delivered export must reach the day-one fault')
        .toEqual(contract.expected.faulted_subject);
      const counterfactual = runVitest(scratch, filters, 'counterfactual');
      expect(counterfactual.classification, counterfactual.detail).toBe('detection');
      expect(counterfactual.exitCode).toBe(1);
      expect(Object.fromEntries(Object.entries(counterfactual.files).map(([n, r]) => [n, r.status])))
        .toEqual(contract.expected.faulted_statuses);
      const [bad, observedGood] = observe({ spec, scratchRoot: scratch, baseline, counterfactual, patches });
      const good = { ...observedGood,
        intendedAssertion: counterfactual.files['m14-good.test.ts'].failureMessages.some((message) =>
          /expected .*1970-01-01T00:00:00\.000Z.* to be .*1970-01-02T00:00:00\.000Z/.test(message)) };
      expect(evaluateExecutedExpectation(bad, 'reject').classification,
        'M14 surviving wrong-import case must demonstrate rejected assurance').toBe('reject-demonstrated');
      expect(evaluateExecutedExpectation(bad, 'admit').ok,
        'M14 must refuse a sensitivity claim for the surviving wrong-import case').toBe(false);
      expect(evaluateExecutedExpectation(good, 'admit').classification,
        'M14 must admit the correct module/export companion with its intended failure').toBe('admit-demonstrated');
      expect(controls.map((name) => hash(readFileSync(join(scratch, 'tests', name), 'utf8'))))
        .toEqual(frozenControls);

      writeFileSync(subject, original);
      expect(hash(readFileSync(subject, 'utf8'))).toBe(patches[0].beforeSha256);
      expect(probeSubject()).toEqual(contract.expected.baseline_subject);
      const restored = runVitest(scratch, filters, 'baseline');
      expect(restored.classification, restored.detail).toBe('pass');
      expect(restored.exitCode).toBe(0);
      expect(Object.fromEntries(Object.entries(restored.files).map(([n, r]) => [n, r.status])))
        .toEqual(contract.expected.restored_statuses);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }, 120_000);
});

describe('principle 52 — Q4/Q5 executed-conformance (test-assurance kernel)', () => {
  const expectations = JSON.parse(readFileSync(EXPECTATIONS_PATH, 'utf8')) as Expectations;
  const frozenById = new Map(expectations.cases.map((c) => [c.id, c]));

  it('the frozen oracle pins the executed-conformance channel and every scenario case', () => {
    expect(expectations.frozen_at).toBe('2026-10-08');
    expect(expectations.channel_map.Q4).toContain('executed-conformance');
    expect(expectations.channel_map.Q5).toContain('executed-conformance');
    for (const spec of ALL_SCENARIOS) {
      expect(spec.cases.length).toBeGreaterThan(0);
      for (const c of spec.cases) {
        const frozen = frozenById.get(c.caseId);
        expect(frozen, `frozen case missing: ${c.caseId}`).toBeDefined();
        expect(c.corpusPath, `corpus path drift for ${c.caseId}`).toBe(frozen?.path);
        expect(existsSync(resolve(REPO_ROOT, c.corpusPath)), `corpus file missing: ${c.corpusPath}`).toBe(true);
        if (c.caseId !== 'q1/bad.fabricated-status') {
          expect(frozen?.channel).toBe('executed-conformance');
        }
      }
    }
    expect(INTENDED_ASSERTIONS['q4/good.asserted-exit']).toBeDefined();
    expect(INTENDED_ASSERTIONS['q5/good.behavior-backed-phrase']).toBeDefined();
  });

  it('Q4: ignored-exit survives the fixture flip (reject) while asserted-exit kills it (admit)', () => {
    const outcome = runScenario(Q4_SCENARIO);
    // infrastructure honesty: a real runner ran, twice, with a real per-file report
    expect(outcome.baseline.classification).not.toBe('infrastructure-failure');
    expect(outcome.counterfactual.classification).not.toBe('infrastructure-failure');
    expect(Object.keys(outcome.baseline.files).length).toBe(Q4_SCENARIO.cases.length);

    // patch honesty: flip applies EXACTLY ONCE per listed file, sha256 recorded, content changed
    expect(outcome.patches.map((p) => p.scratchName).sort()).toEqual([...Q4_SCENARIO.counterfactual.appliesTo].sort());
    for (const p of outcome.patches) {
      expect(p.occurrences).toBe(1);
      expect(p.beforeSha256).not.toBe(p.afterSha256);
    }

    const obs = Object.fromEntries(observe(outcome).map((o) => [o.caseId, o]));
    // q4/bad.ignored-exit — frozen: reject. The ignored status MUST let it survive the flip.
    const bad = evaluateExecutedExpectation(obs['q4/bad.ignored-exit'], 'reject');
    expect(bad.ok).toBe(true);
    expect(bad.classification).toBe('reject-demonstrated');
    // q4/good.asserted-exit — frozen: admit. It MUST die on the flip, by the intended assertion.
    const good = evaluateExecutedExpectation(obs['q4/good.asserted-exit'], 'admit');
    expect(good.ok).toBe(true);
    expect(good.classification).toBe('admit-demonstrated');
    // q1/bad.fabricated-status (A07 corroboration) — fabricated status must NOT satisfy
    const aux = evaluateExecutedExpectation(obs['q1/bad.fabricated-status'], 'reject');
    expect(aux.ok).toBe(true);
    expect(aux.classification).toBe('reject-demonstrated');
  });

  it('Q5: circular-phrase survives the broken backing behavior (reject) while behavior-backed kills it (admit)', () => {
    const outcome = runScenario(Q5_SCENARIO);
    expect(outcome.baseline.classification).not.toBe('infrastructure-failure');
    expect(outcome.counterfactual.classification).not.toBe('infrastructure-failure');
    for (const p of outcome.patches) {
      expect(p.occurrences).toBe(1);
      expect(p.beforeSha256).not.toBe(p.afterSha256);
    }

    const obs = Object.fromEntries(observe(outcome).map((o) => [o.caseId, o]));
    const bad = evaluateExecutedExpectation(obs['q5/bad.circular-phrase'], 'reject');
    expect(bad.ok).toBe(true);
    expect(bad.classification).toBe('reject-demonstrated');
    const good = evaluateExecutedExpectation(obs['q5/good.behavior-backed-phrase'], 'admit');
    expect(good.ok).toBe(true);
    expect(good.classification).toBe('admit-demonstrated');
  });

  it('non-vacuity: the executed lane produced BOTH a demonstrated rejection and a demonstrated kill', () => {
    // Distilled, classification-level claim over the same frozen semantics — proves the
    // lane cannot go green while silently demonstrating nothing (T-TAK-A).
    const rejects = [
      evaluateExecutedExpectation({ caseId: 'x', baseline: 'pass', counterfactual: 'pass', intendedAssertion: false }, 'reject'),
      evaluateExecutedExpectation({ caseId: 'y', baseline: 'pass', counterfactual: 'pass', intendedAssertion: false }, 'reject'),
    ];
    const admits = [
      evaluateExecutedExpectation({ caseId: 'x', baseline: 'pass', counterfactual: 'fail', intendedAssertion: true }, 'admit'),
    ];
    expect(rejects.every((v) => v.ok && v.classification === 'reject-demonstrated')).toBe(true);
    expect(admits.every((v) => v.ok && v.classification === 'admit-demonstrated')).toBe(true);
  });

  it('K6 fail-closed: an empty case selection is refused before any runner spawn [T-TAK-A]', () => {
    const emptySpec = { ...Q5_SCENARIO, id: 'q5-empty-arm', cases: [] };
    expect(() => buildScratch(emptySpec, join(tmpdir(), 's1-p52-should-not-exist'))).toThrow(ConformanceError);
    expect(() => buildScratch(emptySpec, join(tmpdir(), 's1-p52-should-not-exist'))).toThrow(/empty case selection/);
    expect(() => runVitest(tmpdir(), [], 'baseline')).toThrow(/empty selection/);
  });

  it('K6 fail-closed: a missing corpus case file is refused, naming the path', () => {
    const brokenSpec = {
      ...Q5_SCENARIO,
      id: 'q5-missing-arm',
      cases: [{ caseId: 'q5/bad.circular-phrase', corpusPath: 'definitely/missing/bad.case.test.ts', scratchName: 'missing.test.ts' }],
    };
    // unique scratch name: buildScratch throws AFTER creating the dir + symlink, and a
    // leftover scratch from a previous run must never turn into a false arm failure
    const scratchRoot = join(tmpdir(), `s1-p52-missing-arm-${process.pid}-${Date.now().toString(36)}`);
    try {
      expect(() => buildScratch(brokenSpec, scratchRoot)).toThrow(/corpus case file missing: definitely\/missing\/bad\.case\.test\.ts/);
    } finally {
      rmSync(scratchRoot, { recursive: true, force: true });
    }
  });

  it('K6 fail-closed: runner spawn failure is infrastructure-failure, never detection', () => {
    const scratchRoot = join(tmpdir(), `s1-p52-spawn-arm-${process.pid}`);
    buildScratch(Q5_SCENARIO, scratchRoot);
    try {
      const run = runVitest(scratchRoot, ['tests/q5-bad-circular-phrase.test.ts'], 'baseline', '/nonexistent/s1-p52-vitest');
      expect(run.classification).toBe('infrastructure-failure');
      expect(run.files).toEqual({});
      expect(run.detail).toMatch(/spawn failed/);
      // and the evaluator must refuse to call anything about an infra run a detection
      const verdict = evaluateExecutedExpectation(
        { caseId: 'q5/bad.circular-phrase', baseline: 'not-run', counterfactual: 'not-run', intendedAssertion: false },
        'admit',
      );
      expect(verdict.ok).toBe(false);
      expect(verdict.classification).toBe('infrastructure-failure');
    } finally {
      rmSync(scratchRoot, { recursive: true, force: true });
    }
  });

  it('K7 honesty: a counterfactual death WITHOUT the intended assertion is not a kill', () => {
    const verdict = evaluateExecutedExpectation(
      { caseId: 'q4/good.asserted-exit', baseline: 'pass', counterfactual: 'fail', intendedAssertion: false },
      'admit',
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.classification).toBe('admit-failed-sensitivity');
    expect(verdict.detail).toMatch(/did NOT kill the counterfactual with the intended assertion/);
  });
});

/*
 * D011 S1 recovery — SB1/R4 real-caller regression arms (added by the amended-2 companion
 * chain, 2026-10-14). ADDITIVE ONLY: every arm above is untouched. Two families:
 *
 *   1. pinned-input arms — the coordinator counterexamples (cx1/cx2/cx2b), the ten frozen
 *      report fixtures (roots.json sidecar) and the A3 causal input (cx3) judged through the
 *      PRODUCTION classifyVitestReport export. Expected classifications live INSIDE the
 *      frozen fixtures (expected_amended2 / sidecar expected / expected_am3), authored and
 *      independently reviewed before this repair existed — the oracle is not the code.
 *   2. real-caller arms — the genuine production runVitest over the frozen r4-runner
 *      fixtures. These pin the former be84 faults behaviorally: a skipped required case
 *      must read not-executed (be84 read "pass") and an unhandled-rejection lane mixed with
 *      an intended failure must read infrastructure-failure (be84 credited "detection").
 */
describe('D011 SB1/R4 — strict runner-result grammar (production export + real caller)', () => {
  const RX = resolve(REPO_ROOT, 'scripts/test-assurance/recovery-d011');
  const R4_FIXTURES = 'scripts/test-assurance/recovery-d011/fixtures/r4-runner';

  // First lane in a fresh scratch has no stale report to drop — absence is fine.
  const dropStaleReport = (scratch: string): void => {
    try {
      unlinkSync(join(scratch, 'report-baseline.json'));
    } catch {
      /* first run — nothing stale */
    }
  };

  interface PinnedFixture {
    tag: string;
    filters: string[];
    report: unknown;
    stdout: string;
    exitCode: number | null;
    rootDir: string;
  }
  const readFixture = (rel: string): PinnedFixture =>
    JSON.parse(readFileSync(resolve(REPO_ROOT, rel), 'utf8')) as PinnedFixture;

  it('pinned counterexamples cx1/cx2/cx2b classify exactly as frozen through the production export', () => {
    for (const id of ['cx1', 'cx2', 'cx2b'] as const) {
      const fx = readFixture(`${R4_FIXTURES}/counterexamples/${id}.json`);
      const want = (fx as PinnedFixture & { expected_amended2: string }).expected_amended2;
      const out = classifyVitestReport(fx.filters, fx.report as never, fx.stdout ?? '', fx.exitCode ?? null, fx.rootDir);
      expect(out.classification, `${id} (${fx.tag})`).toBe(want);
    }
  });

  it('all ten frozen report fixtures classify per the roots.json sidecar (identity/shape/malformed grammar)', () => {
    const sidecar = JSON.parse(readFileSync(resolve(REPO_ROOT, R4_FIXTURES, 'reports', 'roots.json'), 'utf8')) as {
      reports: Record<string, { filters: string[]; stdout: string; exitCode: number; rootDir: string; expected: string }>;
    };
    const names = Object.keys(sidecar.reports);
    expect(names.length).toBeGreaterThanOrEqual(10);
    for (const name of names) {
      const r = sidecar.reports[name];
      const body = JSON.parse(readFileSync(resolve(REPO_ROOT, R4_FIXTURES, 'reports', name), 'utf8'));
      const out = classifyVitestReport(r.filters, body as never, r.stdout, r.exitCode, r.rootDir);
      expect(out.classification, name).toBe(r.expected);
    }
  });

  it('A3 cx3: same-file failed+pending reads not-executed BEFORE detection credit (am2 read detection)', () => {
    const cx3 = readFixture('scripts/test-assurance/recovery-d011/classifiers/cx3.json') as PinnedFixture & {
      expected_am3: string;
    };
    const out = classifyVitestReport(cx3.filters, cx3.report as never, cx3.stdout ?? '', cx3.exitCode ?? null, cx3.rootDir);
    expect(out.classification).toBe(cx3.expected_am3);
    expect(cx3.expected_am3).toBe('not-executed');
  });

  // Shared scratch for the real-caller lanes (same construction as the frozen probe:
  // buildScratch symlinks the repo node_modules and the frozen fixture files in).
  const spec: ScenarioSpec = {
    id: 'r4regression',
    description: 'D011 S1-R4 real-caller regression lanes over the frozen r4-runner fixtures',
    cases: (['unhandled.test.ts', 'skipped.test.ts', 'healthy.test.ts', 'intended-fail.test.ts'] as const).map((n) => ({
      caseId: `r4/${n.replace(/\.test\.ts$/, '')}`,
      corpusPath: `${R4_FIXTURES}/${n}`,
      scratchName: n,
    })),
    // Declared for the shared spec shape only — these arms run baseline phases exclusively.
    counterfactual: {
      label: 'unused-by-regression-arms',
      from: 'const regressionNeverAppliesThis = 1;',
      to: 'const regressionNeverAppliesThis = 1;',
      appliesTo: ['healthy.test.ts'],
    },
  };

  it(
    'REAL CALLER: healthy → pass and skipped → not-executed (be84 read the skipped lane "pass")',
    { timeout: 60_000 },
    () => {
      const scratch = join(tmpdir(), `s1-p52-r4-regression-${process.pid}-${Date.now().toString(36)}`);
      buildScratch(spec, scratch);
      const lane = (filters: string[]) => {
        dropStaleReport(scratch); // stale-report hygiene (F6 identity)
        return runVitest(scratch, filters, 'baseline');
      };
      try {
        expect(lane(['tests/healthy.test.ts']).classification).toBe('pass');
        expect(lane(['tests/skipped.test.ts']).classification).toBe('not-executed');
      } finally {
        rmSync(scratch, { recursive: true, force: true });
      }
    },
  );

  it(
    'REAL CALLER: unhandled → infrastructure-failure and intended-fail → detection (fault classes never conflated)',
    { timeout: 60_000 },
    () => {
      const scratch = join(tmpdir(), `s1-p52-r4-regression-${process.pid}-${Date.now().toString(36)}`);
      buildScratch(spec, scratch);
      const lane = (filters: string[]) => {
        dropStaleReport(scratch);
        return runVitest(scratch, filters, 'baseline');
      };
      try {
        const unhandled = lane(['tests/unhandled.test.ts']);
        expect(unhandled.classification).toBe('infrastructure-failure');
        expect(lane(['tests/intended-fail.test.ts']).classification).toBe('detection');
        // K5 corroboration on the real lane: the infra refusal must name the unhandled rejection
        expect(unhandled.detail ?? '').toMatch(/unhandled/i);
      } finally {
        rmSync(scratch, { recursive: true, force: true });
      }
    },
  );

  it(
    'REAL CALLER: MIXED unhandled+intended-fail → infrastructure-failure, never detection (the be84 fault)',
    { timeout: 60_000 },
    () => {
      const scratch = join(tmpdir(), `s1-p52-r4-regression-${process.pid}-${Date.now().toString(36)}`);
      buildScratch(spec, scratch);
      try {
        dropStaleReport(scratch);
        const mixed = runVitest(scratch, ['tests/unhandled.test.ts', 'tests/intended-fail.test.ts'], 'baseline');
        expect(mixed.classification).toBe('infrastructure-failure');

        dropStaleReport(scratch);
        const passskip = runVitest(scratch, ['tests/healthy.test.ts', 'tests/skipped.test.ts'], 'baseline');
        expect(passskip.classification).toBe('not-executed');
      } finally {
        rmSync(scratch, { recursive: true, force: true });
      }
    },
  );

  it('the frozen probe packet is present under recovery-d011 (wiring anchor, no runner spawn)', () => {
    // The standalone control (sb1-classifier-control.mts) and probe (r4-runner-probe.mts)
    // carry the full 14-input + 19-line replay table; this arm pins only that the frozen
    // fixture packet they judge exists intact next to this suite, so the suites step cannot
    // go green over a silently deleted oracle packet.
    for (const rel of [
      `${R4_FIXTURES}/counterexamples/cx1.json`,
      `${R4_FIXTURES}/reports/roots.json`,
      `${R4_FIXTURES}/skipped.test.ts`,
      'scripts/test-assurance/recovery-d011/classifiers/cx3.json',
      'scripts/test-assurance/recovery-d011/sb1-classifier-control.mts',
      'scripts/test-assurance/driver-probes/r4-runner-probe.mts',
    ]) {
      expect(existsSync(resolve(REPO_ROOT, rel)), rel).toBe(true);
    }
    expect(RX.length).toBeGreaterThan(0);
  });
});
