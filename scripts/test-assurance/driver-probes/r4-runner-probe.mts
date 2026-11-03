// D011 S1 recovery — R4 runner-grammar probe (amended-2, A3-corrected).
// Live lanes (unchanged from amended-1, F6 controls): the REAL runVitest over the frozen
// r4-runner fixtures — four single lanes plus the MIXED (unhandled+intended-fail) and
// PASSSKIP (healthy+skipped) pair lanes, one R4-CLASS line per lane carrying the
// runner's own classification.
//
// A3 correction (amended-supplemental-freeze-review finding 3 + coordinator
// counterexamples cx1/cx2): the PINNED REPLAY lanes below judge frozen report/report
// fixtures through the exported pure classifier (classifyVitestReport, the amended-2
// SB1 companion) with pinned sidecar inputs (fixtures/r4-runner/reports/roots.json) —
// exact proposed bytes, unit-controlled, no runner involvement:
//   R4-CX  cx1/cx2/cx2b — the coordinator's exact counterexample inputs
//     (evidence/coordinator-classifier-result.json), cx2b = the well-formed completion
//     of the cx2 combination (intended fail + skipped sibling).
//   R4-CTRL — all ten pinned reports: the archived amended-1 trio (mixed / passskip /
//     unhandled-only), the synthetic identity/shape controls (wrong-identity /
//     empty-results / unknown-shape), and the four malformed-grammar controls
//     (malformed-total / malformed-success / malformed-file-status /
//     malformed-assertion-status).
// This probe is POST-SB1 anchored: it type-checks only after the repair cycle applies
// the SB1 companion (the classifier export) — expectations bind that world.
import { readFileSync, rmSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildScratch,
  classifyVitestReport,
  runVitest,
  type ScenarioSpec,
} from '../../../packages/core/principles/52-subprocess-status-conformance.ts';

const ROOT = new URL('../../../', import.meta.url).pathname;
const R4_DIR = 'scripts/test-assurance/recovery-d011/fixtures/r4-runner';
const LANES = ['unhandled.test.ts', 'skipped.test.ts', 'healthy.test.ts', 'intended-fail.test.ts'];

const spec: ScenarioSpec = {
  id: 'r4probe',
  description: 'D011 S1-R4 runner-grammar lanes (amended-2)',
  cases: LANES.map((n) => ({
    caseId: `r4/${n.replace(/\.test\.ts$/, '')}`,
    corpusPath: `${R4_DIR}/${n}`,
    scratchName: n,
  })),
  // Declared for the shared spec shape only — the probe runs single baseline phases and
  // never applies a counterfactual.
  counterfactual: {
    label: 'unused-by-probe',
    from: 'const probeNeverAppliesThis = 1;',
    to: 'const probeNeverAppliesThis = 1;',
    appliesTo: ['healthy.test.ts'],
  },
};

const scratch = join(tmpdir(), `s1-r4probe-${process.pid}-${Date.now().toString(36)}`);
buildScratch(spec, scratch);
const dropStaleReport = (): void => {
  try {
    unlinkSync(join(scratch, 'report-baseline.json')); // stale-report hygiene (F6 identity)
  } catch {
    /* first run — nothing stale */
  }
};
try {
  for (const lane of LANES) {
    dropStaleReport();
    const run = runVitest(scratch, [`tests/${lane}`], 'baseline');
    console.log(`R4-CLASS ${lane} ${run.classification}`);
  }
  dropStaleReport();
  const mixed = runVitest(scratch, ['tests/unhandled.test.ts', 'tests/intended-fail.test.ts'], 'baseline');
  console.log(`R4-CLASS MIXED unhandled+intended-fail ${mixed.classification}`);
  dropStaleReport();
  const passskip = runVitest(scratch, ['tests/healthy.test.ts', 'tests/skipped.test.ts'], 'baseline');
  console.log(`R4-CLASS PASSSKIP healthy+skipped ${passskip.classification}`);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

// ── A3 pinned replay: frozen inputs through the exported pure classifier ──
const FIX_DIR = join(ROOT, R4_DIR);

interface CounterexampleFixture {
  id: string;
  tag: string;
  filters: string[];
  report: unknown;
  stdout: string;
  exitCode: number | null;
  rootDir: string;
}

for (const cx of ['cx1', 'cx2', 'cx2b'] as const) {
  const f = JSON.parse(readFileSync(join(FIX_DIR, 'counterexamples', `${cx}.json`), 'utf8')) as CounterexampleFixture;
  const out = classifyVitestReport(f.filters, f.report as never, f.stdout, f.exitCode, f.rootDir);
  console.log(`R4-CX ${f.id || cx} ${f.tag} ${out.classification}`);
}

interface RootsSidecar {
  reports: Record<string, { filters: string[]; stdout: string; exitCode: number; rootDir: string }>;
}
const sidecar = JSON.parse(readFileSync(join(FIX_DIR, 'reports', 'roots.json'), 'utf8')) as RootsSidecar;
for (const [name, r] of Object.entries(sidecar.reports)) {
  const body = JSON.parse(readFileSync(join(FIX_DIR, 'reports', name), 'utf8'));
  const out = classifyVitestReport(r.filters, body as never, r.stdout, r.exitCode, r.rootDir);
  console.log(`R4-CTRL ${name.replace(/\.report\.json$/, '')} ${out.classification}`);
}
