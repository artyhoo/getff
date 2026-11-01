/*
 * Principle 52 — Q4/Q5 executed-conformance metachecks (test-assurance kernel, Batch C).
 *
 * Spec: docs/superpowers/specs/2026-10-08-test-assurance-kernel-design.md §5 Q-table.
 * Frozen oracle: scripts/test-assurance/expectations.json (`channel_map` Q4/Q5 =
 * executed-conformance, Batch C). RED proof: docs/test-assurance-kernel/s1/logs/batch-c/red-probe.log.
 *
 * Mechanism (behavioral, NOT static — no AST/dataflow claims):
 *   1. Build a throwaway scratch root under os.tmpdir(); symlink this worktree's
 *      provisioned node_modules into it so the corpus files' `vitest` imports resolve;
 *      copy the corpus cases VERBATIM (renamed `*.test.ts` so ONLY the scratch root's
 *      own runner run discovers them — the repo tree is never mutated).
 *   2. Run the REAL vitest runner against the scratch selection (baseline phase).
 *   3. Apply the counterfactual patch — a literal string replacement on the SCRATCH
 *      copies only (Q4: fixture exit 42 → 0; Q5: backing behavior `sealed = true` →
 *      `sealed = false`), proven to apply EXACTLY ONCE (occurrence count + sha256
 *      before/after per file). The test files' assertions are never touched.
 *   4. Re-run the same selection (counterfactual phase) and classify per case against
 *      the frozen expectation:
 *        - `reject`  → demonstrated when the case PASSES baseline AND STILL PASSES the
 *          counterfactual (it is insensitive to the fault its text claims to guard —
 *          the survival IS the rejection of its claimed assurance);
 *        - `admit`   → demonstrated when the case PASSES baseline and FAILS the
 *          counterfactual WITH the intended assertion message (killing the fault);
 *          surviving the counterfactual means the case proves nothing → RED.
 *   5. Infrastructure honesty (T-TAK-A / spec §2): spawn error, timeout, signal, or a
 *      missing/empty vitest JSON report classifies as `infrastructure-failure` — never
 *      detection, never a green. An empty selection is refused before spawn. A case
 *      whose RED lacks the intended assertion text is NOT a kill (an unrelated crash
 *      must not read as sensitivity).
 *
 * Prior-art: docs/test-assurance-kernel/s1/prior-art.md area (b) (ADAPT of in-repo
 * conformance-driver shape + BUILD glue; no upstream dependency adopted).
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, '../../..');
export const CORPUS_ROOT = resolve(REPO_ROOT, 'scripts/test-assurance/corpus');
export const DEFAULT_VITEST_BIN = resolve(REPO_ROOT, 'node_modules/.bin/vitest');
const RUN_TIMEOUT_MS = 120_000;

/** Error raised BEFORE any runner spawn when preconditions are violated (fail-closed). */
export class ConformanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConformanceError';
  }
}

export interface PatchSpec {
  label: string;
  from: string;
  to: string;
  /** scratch test file names the replacement applies to (must occur exactly once each) */
  appliesTo: string[];
}

export interface ExecutedCase {
  /** expectations.json case id this scratch file realizes (reconciled by the principle) */
  caseId: string;
  /** repo-relative corpus source, copied VERBATIM into the scratch */
  corpusPath: string;
  scratchName: string;
}

export interface ScenarioSpec {
  id: string;
  description: string;
  cases: ExecutedCase[];
  /** Imported subject/helper modules copied verbatim, never selected as tests. */
  supportFiles?: ExecutedCase[];
  counterfactual: PatchSpec;
}

/** The intended assertion that must appear in a killed case's failure messages (K7). */
export const INTENDED_ASSERTIONS: Record<string, RegExp> = {
  'q4/good.asserted-exit': /expected \+?0 to be 42/,
  'q5/good.behavior-backed-phrase': /expected false to be true/,
  // Batch E (Q6): the delivered config no longer wires the rule at error severity —
  // the good companion's own `toMatch` on the delivered artifact must be what dies.
  'q6/good.wired-config': /to match \/no-vacuous-assertion/,
};

export const Q4_SCENARIO: ScenarioSpec = {
  id: 'q4',
  description: 'intended nonzero exit ignored (bad) vs asserted (good); real exit-42 subprocess',
  cases: [
    {
      caseId: 'q4/bad.ignored-exit',
      corpusPath: 'scripts/test-assurance/corpus/q4-ignored-exit/bad.ignored-exit.ts',
      scratchName: 'q4-bad-ignored-exit.test.ts',
    },
    {
      caseId: 'q4/good.asserted-exit',
      corpusPath: 'scripts/test-assurance/corpus/q4-ignored-exit/good.asserted-exit.ts',
      scratchName: 'q4-good-asserted-exit.test.ts',
    },
    {
      // auxiliary A07 arm: fabricated status must not satisfy executed conformance.
      // Its DECLARED channel stays static-eslint (expectations.json); this scenario
      // only corroborates the vacuity behaviorally.
      caseId: 'q1/bad.fabricated-status',
      corpusPath: 'scripts/test-assurance/corpus/q1-vacuous/bad.fabricated-status.ts',
      scratchName: 'q4-aux-fabricated-status.test.ts',
    },
  ],
  counterfactual: {
    label: 'flip fixture exit 42 -> 0',
    from: 'process.exit(42)',
    to: 'process.exit(0)',
    appliesTo: ['q4-bad-ignored-exit.test.ts', 'q4-good-asserted-exit.test.ts'],
  },
};

export const Q5_SCENARIO: ScenarioSpec = {
  id: 'q5',
  description: 'required phrase only in the assertion own source (bad) vs invoked behavior (good)',
  cases: [
    {
      caseId: 'q5/bad.circular-phrase',
      corpusPath: 'scripts/test-assurance/corpus/q5-self-source/bad.circular-phrase.ts',
      scratchName: 'q5-bad-circular-phrase.test.ts',
    },
    {
      caseId: 'q5/good.behavior-backed-phrase',
      corpusPath: 'scripts/test-assurance/corpus/q5-self-source/good.behavior-backed-phrase.ts',
      scratchName: 'q5-good-behavior-backed.test.ts',
    },
  ],
  counterfactual: {
    label: 'break backing behavior (sealed = true -> false)',
    from: 'sealed = true;',
    to: 'sealed = false;',
    appliesTo: ['q5-good-behavior-backed.test.ts'],
  },
};

export type PhaseClassification = 'pass' | 'detection' | 'not-executed' | 'infrastructure-failure';

export interface FileResult {
  status: 'pass' | 'fail' | 'not-executed';
  failureMessages: string[];
}

export interface ClassifiedOutcome {
  classification: PhaseClassification;
  detail?: string;
  files: Record<string, FileResult>;
}

const REPORT_FILE_STATUSES = new Set(['passed', 'failed']);
const EXECUTED_ASSERTION_STATUSES = new Set(['passed', 'failed']);
const NEVER_EXECUTED_ASSERTION_STATUSES = new Set(['pending', 'skipped', 'todo']);

/**
 * Strict runner-result grammar (D011 S1-R4/S1-R6, amended-2/A3), pure and exported so
 * the pinned report fixtures — the REAL archived trio (mixed / passskip /
 * unhandled-only), the synthetic grammar controls (wrong-identity / empty-results /
 * unknown-shape / malformed-total / malformed-success / malformed-file-status /
 * malformed-assertion-status) and the coordinator counterexamples (cx1 / cx2 + the
 * well-formed cx2b completion, evidence/coordinator-classifier-result.json) — are
 * judged through the exact production predicate in unit controls.
 *
 * Per-file status is DERIVED FROM THE REPORT itself; no caller-fed per-file verdicts
 * are accepted (A3: that channel returned 'pass' for a report whose own assertion said
 * pending). Order is load-bearing (evidence/runner-and-lane-receipts.md, amended-2):
 *   1. malformed grammar         -> infrastructure-failure (a report we cannot parse is never green)
 *   2. zero files                -> infrastructure-failure (empty discovery is never green, T-TAK-A)
 *   3. full-path identity        -> every requested path present, nothing unrequested, no basename collision
 *   4. numTotalTests === 0       -> incomplete execution refused
 *   5. `Errors  N` (N>=1) stdout -> infrastructure-failure EVEN when intended failures are present
 *   6. exit/report inconsistency with zero failed assertions -> infrastructure-failure
 *   7. any not-executed required case -> not-executed, BEFORE detection credit (A3 cx2/cx2b/cx3 —
 *      same-file failed+pending never masks incomplete execution)
 *   8. any failed assertion      -> detection
 *   9. else                      -> pass
 */
export function classifyVitestReport(
  filters: string[],
  report: VitestJsonReport,
  stdout: string,
  exitCode: number | null,
  rootDir: string,
): ClassifiedOutcome {
  const refused = (detail: string): ClassifiedOutcome => ({
    classification: 'infrastructure-failure',
    detail,
    files: {},
  });
  if (
    typeof report.numTotalTests !== 'number' ||
    !Number.isInteger(report.numTotalTests) ||
    report.numTotalTests < 0
  ) {
    return refused(`malformed vitest report: numTotalTests must be a non-negative integer, got ${JSON.stringify(report.numTotalTests)} (D011 S1-R6, A3 fail-closed)`);
  }
  if (report.success !== undefined && typeof report.success !== 'boolean') {
    return refused(`malformed vitest report: success must be a boolean when present, got ${JSON.stringify(report.success)} (D011 S1-R6, A3 fail-closed)`);
  }
  if (!Array.isArray(report.testResults)) {
    return refused('malformed vitest report: testResults must be an array (D011 S1-R6, A3 fail-closed)');
  }
  const files: Record<string, FileResult> = {};
  let anyFailedAssertion = false; // A3 cx3: a failed ASSERTION counts even inside a file classified not-executed
  const relNames: string[] = [];
  const relByBase: Record<string, string> = {};
  for (const tr of report.testResults) {
    if (typeof tr.name !== 'string' || tr.name === '') {
      return refused('malformed vitest report: a testResult carries no usable name (D011 S1-R6, A3 fail-closed)');
    }
    if (tr.status !== undefined && !REPORT_FILE_STATUSES.has(tr.status)) {
      return refused(`malformed vitest report: file status '${String(tr.status)}' outside the passed|failed vocabulary (D011 S1-R6, A3 fail-closed)`);
    }
    if (!Array.isArray(tr.assertionResults)) {
      return refused(`malformed vitest report: assertionResults must be an array for ${tr.name} (D011 S1-R6, A3 fail-closed)`);
    }
    // macOS tmpdirs live behind a /var -> /private/var symlink: vitest reports the
    // REALPATH of every test file while rootDir arrives unresolved, so a raw relative()
    // refuses every real run as "outside the scratch root" (measured 2026-10-11, dry-run
    // in probe-am2: every live lane read infrastructure-failure). Normalize BOTH sides
    // through realpathSync (missing paths fall back to the raw spelling — the synthetic
    // pinned fixtures /r4-replay/... do not exist on disk and need that) before identity.
    const absName = isAbsolute(tr.name) ? tr.name : resolve(rootDir, tr.name);
    let nameReal = absName;
    try {
      nameReal = realpathSync(absName);
    } catch {
      /* synthetic fixture name — keep the raw spelling */
    }
    let rootReal = rootDir;
    try {
      rootReal = realpathSync(rootDir);
    } catch {
      /* keep the raw spelling */
    }
    const rel = relative(rootReal, nameReal);
    if (rel === '' || rel === '..' || rel.startsWith('../')) {
      return refused(`vitest report file outside the scratch root: ${tr.name} (rootDir=${rootDir}) (D011 S1-R6)`);
    }
    const base = basename(rel);
    if (relByBase[base] !== undefined && relByBase[base] !== rel) {
      return refused(`ambiguous basename collision in the report: ${relByBase[base]} vs ${rel} — full-path identity required (D011 S1-R6, A3)`);
    }
    relByBase[base] = rel;
    relNames.push(rel);
    let executed = 0;
    let neverExecuted = 0;
    let failed = tr.status === 'failed';
    const failureMessages: string[] = [];
    for (const ar of tr.assertionResults) {
      if (typeof ar.status !== 'string') {
        return refused(`malformed vitest report: an assertion carries no status in ${rel} (D011 S1-R6, A3 fail-closed)`);
      }
      if (EXECUTED_ASSERTION_STATUSES.has(ar.status)) {
        executed += 1;
        if (ar.status === 'failed') {
          failed = true;
          failureMessages.push(...(ar.failureMessages ?? []));
        }
      } else if (NEVER_EXECUTED_ASSERTION_STATUSES.has(ar.status)) {
        neverExecuted += 1; // skipped / pending / todo are NOT executions — a required case
        // that never ran is not-executed, never an executed pass (D011 S1-R4, A3 cx1).
      } else {
        return refused(`malformed vitest report: assertion status '${ar.status}' outside the passed|failed|pending|skipped|todo vocabulary in ${rel} (D011 S1-R6, A3 fail-closed)`);
      }
    }
    files[base] = {
      // same-file incomplete execution is independent of file failure: a required case
      // that never ran refuses detection credit even when the SAME file also carries
      // failed assertions (A3 cx3 — coordinator-required-execution-result.json)
      status: neverExecuted > 0 || executed === 0 ? 'not-executed' : failed ? 'fail' : 'pass',
      failureMessages,
    };
    anyFailedAssertion = anyFailedAssertion || failed;
  }
  if (relNames.length === 0) {
    return refused('vitest JSON report carries zero test files — empty discovery is never green (T-TAK-A)');
  }
  const want = new Set(filters);
  const got = new Set(relNames);
  for (const w of want) {
    if (!got.has(w)) {
      return refused(`selection/observed mismatch: required case '${w}' absent from the report — same file COUNT is not case IDENTITY, full paths compared (D011 S1-R6, A3)`);
    }
  }
  for (const g of got) {
    if (!want.has(g)) {
      return refused(`report carries unrequested file '${g}' — wrong-identity run refused (D011 S1-R6)`);
    }
  }
  if (report.numTotalTests === 0) {
    return refused('numTotalTests=0 alongside a non-empty report — incomplete execution refused (D011 S1-R6)');
  }
  if (/(^|\n)\s*Errors\s+[1-9]\d*/.test(stdout)) {
    return refused('unhandled runner error present (reporter Errors line) — mixed intended-failure+unhandled is infrastructure, never detection (D011 S1-R6)');
  }
  const anyFail = Object.values(files).some((f) => f.status === 'fail');
  const anyNotExecuted = Object.values(files).some((f) => f.status === 'not-executed');
  if (!anyFailedAssertion && (exitCode !== 0 || report.success === false)) {
    return refused(`runner exit/report inconsistency: exitCode=${exitCode} success=${String(report.success)} with zero failed assertions — an unhandled runner error is never a pass (D011 S1-R4)`);
  }
  if (anyNotExecuted) {
    const neverRun = Object.entries(files)
      .filter(([, f]) => f.status === 'not-executed')
      .map(([b]) => b)
      .sort();
    return {
      classification: 'not-executed',
      detail: `required case(s) never executed: ${neverRun.join(', ')} — a skipped/pending/empty required case is never a pass and never detection credit (D011 S1-R4, A3 cx2)`,
      files,
    };
  }
  if (anyFail) return { classification: 'detection', files };
  return { classification: 'pass', files };
}

export interface ScenarioRun {
  phase: 'baseline' | 'counterfactual';
  command: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  classification: PhaseClassification;
  /** per scratch file verdicts + failure messages, from the vitest JSON report */
  files: Record<string, FileResult>;
  stdoutTail: string;
  durationMs: number;
  detail?: string;
}

export interface PatchRecord {
  label: string;
  patchSha256: string;
  scratchName: string;
  beforeSha256: string;
  afterSha256: string;
  occurrences: number;
}

export interface ScenarioOutcome {
  spec: ScenarioSpec;
  scratchRoot: string;
  baseline: ScenarioRun;
  counterfactual: ScenarioRun;
  patches: PatchRecord[];
}

export interface CaseObservation {
  caseId: string;
  baseline: 'pass' | 'fail' | 'not-run';
  counterfactual: 'pass' | 'fail' | 'not-run';
  /** the intended assertion appeared in the counterfactual failure messages */
  intendedAssertion: boolean;
}

export type ExecutedClassification =
  | 'reject-demonstrated'
  | 'admit-demonstrated'
  | 'gap-not-demonstrated'
  | 'admit-failed-sensitivity'
  | 'infrastructure-failure';

export interface ExecutedVerdict {
  caseId: string;
  ok: boolean;
  classification: ExecutedClassification;
  detail: string;
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

/** Sanitized child env: scrub host/session leaks, pin deterministic reporter output. */
export function childEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.CLAUDE_CODE_ENTRYPOINT; // S0 §5.2
  delete env.CLAUDECODE;
  delete env.CI; // stable default-reporter shape across local/CI invocation
  env.FORCE_COLOR = '0';
  return env;
}

/**
 * Build the scratch root: package.json + node_modules symlink + verbatim corpus copies.
 * Refuses (fail-closed) on a missing corpus file or an empty case list — an empty or
 * broken selection must never reach the runner (T-TAK-A).
 */
export function buildScratch(spec: ScenarioSpec, scratchRoot: string): void {
  if (spec.cases.length === 0) {
    throw new ConformanceError(`refusing to run an empty case selection (scenario ${spec.id}) [T-TAK-A]`);
  }
  mkdirSync(join(scratchRoot, 'tests'), { recursive: true });
  writeFileSync(
    join(scratchRoot, 'package.json'),
    JSON.stringify({ name: `s1-${spec.id}-conformance-scratch`, private: true, type: 'module' }, null, 2),
  );
  symlinkSync(realNodeModules(), join(scratchRoot, 'node_modules'), 'dir');
  for (const c of [...spec.cases, ...(spec.supportFiles ?? [])]) {
    const src = resolve(REPO_ROOT, c.corpusPath);
    if (!existsSync(src)) {
      throw new ConformanceError(`corpus case file missing: ${c.corpusPath} (case ${c.caseId})`);
    }
    copyFileSync(src, join(scratchRoot, 'tests', c.scratchName));
  }
}

/** Resolve this worktree's provisioned node_modules (symlinked verbatim into the scratch). */
function realNodeModules(): string {
  const p = resolve(REPO_ROOT, 'node_modules');
  if (!existsSync(p)) {
    throw new ConformanceError(
      `node_modules not provisioned at ${p} — run scripts/worktree-node-modules.sh --apply first (infrastructure precondition, not a detection result)`,
    );
  }
  return p;
}

interface VitestJsonReport {
  numTotalTests?: number;
  success?: boolean;
  testResults?: Array<{
    name?: string;
    status?: string;
    assertionResults?: Array<{
      status?: string;
      failureMessages?: string[];
    }>;
  }>;
}

/**
 * Run the real vitest runner against the scratch selection. The vitest JSON report is
 * the per-file verdict source (machine-readable); stdout is kept as a human tail.
 * Missing report / spawn error / timeout / signal → infrastructure-failure (never green).
 */
export function runVitest(
  scratchRoot: string,
  filters: string[],
  phase: ScenarioRun['phase'],
  vitestBin: string = DEFAULT_VITEST_BIN,
): ScenarioRun {
  if (filters.length === 0) {
    throw new ConformanceError('refusing to run an empty selection (T-TAK-A)');
  }
  const reportPath = join(scratchRoot, `report-${phase}.json`);
  const command = `${relativeForLog(vitestBin)} run ${filters.join(' ')} --reporter=default --reporter=json --outputFile.json=${relativeForLog(reportPath)}`;
  const started = Date.now();
  let res: ReturnType<typeof spawnSync>;
  try {
    res = spawnSync(vitestBin, ['run', ...filters, '--reporter=default', '--reporter=json', `--outputFile.json=${reportPath}`], {
      cwd: scratchRoot,
      env: childEnv(),
      encoding: 'utf8',
      timeout: RUN_TIMEOUT_MS,
      killSignal: 'SIGTERM',
    });
  } catch (err) {
    return infraRun(phase, command, `spawn threw: ${(err as Error).message}`, Date.now() - started);
  }
  const timedOut = res.error !== undefined && (res.error as NodeJS.ErrnoException).code === 'ETIMEDOUT';
  if (res.error && !timedOut) {
    return infraRun(phase, command, `spawn failed: ${(res.error as NodeJS.ErrnoException).code ?? res.error.message}`, Date.now() - started);
  }
  if (timedOut || res.signal) {
    return infraRun(phase, command, `runner timed out or signalled (signal=${String(res.signal)})`, Date.now() - started);
  }
  if (!existsSync(reportPath)) {
    return infraRun(phase, command, 'vitest JSON report missing — result cannot be verified', Date.now() - started);
  }
  let report: VitestJsonReport;
  try {
    report = JSON.parse(readFileSync(reportPath, 'utf8')) as VitestJsonReport;
  } catch (err) {
    return infraRun(phase, command, `vitest JSON report unparsable: ${(err as Error).message}`, Date.now() - started);
  }
  // Strict runner-result grammar, executed through the exported pure classifier
  // (D011 S1-R4/S1-R6 amended-2/A3): grammar validation, per-file status DERIVED from
  // the report's own assertion statuses (no caller-fed verdicts), full-path identity
  // against the scratch root, not-executed BEFORE detection credit.
  const outcome = classifyVitestReport(filters, report, String(res.stdout ?? ''), res.status ?? null, scratchRoot);
  if (outcome.classification === 'infrastructure-failure') {
    return infraRun(phase, command, outcome.detail ?? 'runner outcome refused classification (D011 S1-R6)', Date.now() - started);
  }
  return {
    phase,
    command,
    exitCode: res.status ?? null,
    signal: res.signal ?? null,
    timedOut: false,
    classification: outcome.classification,
    files: outcome.files,
    stdoutTail: String(res.stdout ?? '').slice(-2000),
    durationMs: Date.now() - started,
  };
}

function infraRun(phase: ScenarioRun['phase'], command: string, detail: string, durationMs: number): ScenarioRun {
  return {
    phase,
    command,
    exitCode: null,
    signal: null,
    timedOut: false,
    classification: 'infrastructure-failure',
    files: {},
    stdoutTail: '',
    durationMs,
    detail,
  };
}

function relativeForLog(absolute: string): string {
  const rel = absolute.startsWith(REPO_ROOT) ? absolute.slice(REPO_ROOT.length + 1) : absolute;
  return rel;
}

/**
 * Apply the counterfactual patch to the SCRATCH copies. Fails closed unless every
 * listed file changes EXACTLY ONCE; records before/after sha256 (K7 patch honesty).
 */
export function applyCounterfactual(spec: ScenarioSpec, scratchRoot: string): PatchRecord[] {
  const { counterfactual } = spec;
  const patchSha256 = sha256(`${counterfactual.label}\n${counterfactual.from}\n${counterfactual.to}`);
  return counterfactual.appliesTo.map((scratchName) => {
    const p = join(scratchRoot, 'tests', scratchName);
    const before = readFileSync(p, 'utf8');
    const occurrences = before.split(counterfactual.from).length - 1;
    if (occurrences !== 1) {
      throw new ConformanceError(
        `patch '${counterfactual.label}' does not apply exactly once to ${scratchName} (occurrences=${occurrences}) — refusing to run an unproven counterfactual`,
      );
    }
    writeFileSync(p, before.replace(counterfactual.from, counterfactual.to));
    const after = readFileSync(p, 'utf8');
    return {
      label: counterfactual.label,
      patchSha256,
      scratchName,
      beforeSha256: sha256(before),
      afterSha256: sha256(after),
      occurrences,
    };
  });
}

/** Full scenario: baseline run → hashed counterfactual patch → counterfactual run. */
export function runScenario(spec: ScenarioSpec, vitestBin?: string): ScenarioOutcome {
  const scratchRoot = join(tmpdir(), `s1-p52-${spec.id}-${process.pid}-${Date.now().toString(36)}`);
  let built = false;
  try {
    buildScratch(spec, scratchRoot);
    built = true;
    const filters = spec.cases.map((c) => `tests/${c.scratchName}`);
    const baseline = runVitest(scratchRoot, filters, 'baseline', vitestBin);
    const patches = applyCounterfactual(spec, scratchRoot);
    const counterfactual = runVitest(scratchRoot, filters, 'counterfactual', vitestBin);
    return { spec, scratchRoot, baseline, counterfactual, patches };
  } finally {
    if (built) rmSync(scratchRoot, { recursive: true, force: true });
  }
}

/** Distill a scenario run pair into per-case observations (K7 raw material). */
export function observe(outcome: ScenarioOutcome): CaseObservation[] {
  const { baseline, counterfactual } = outcome;
  const infra = baseline.classification === 'infrastructure-failure' || counterfactual.classification === 'infrastructure-failure';
  return outcome.spec.cases.map((c) => {
    const b = baseline.files[c.scratchName];
    const k = counterfactual.files[c.scratchName];
    const intended = INTENDED_ASSERTIONS[c.caseId] ?? null;
    return {
      caseId: c.caseId,
      baseline: b ? (b.status === 'pass' ? 'pass' : 'fail') : 'not-run',
      counterfactual: k ? (k.status === 'pass' ? 'pass' : 'fail') : 'not-run',
      intendedAssertion: !!(intended && k?.failureMessages.some((m) => intended.test(m))),
    };
  });
}

/**
 * Encode the frozen semantics: reject = survival demonstrated; admit = kill demonstrated
 * WITH the intended assertion. Infrastructure failure and unproven kills are never ok.
 */
export function evaluateExecutedExpectation(obs: CaseObservation, expectation: string): ExecutedVerdict {
  if (obs.baseline === 'not-run' || obs.counterfactual === 'not-run') {
    return {
      caseId: obs.caseId,
      ok: false,
      classification: 'infrastructure-failure',
      detail: `incomplete phases (baseline=${obs.baseline}, counterfactual=${obs.counterfactual}) — infrastructure honesty: never classified as detection`,
    };
  }
  if (expectation === 'reject') {
    const survived = obs.baseline === 'pass' && obs.counterfactual === 'pass';
    return survived
      ? {
          caseId: obs.caseId,
          ok: true,
          classification: 'reject-demonstrated',
          detail: 'case passes baseline AND survives the counterfactual — its claimed assurance is demonstrated false',
        }
      : {
          caseId: obs.caseId,
          ok: false,
          classification: 'gap-not-demonstrated',
          detail: `expected the case to SURVIVE the counterfactual (baseline=${obs.baseline}, counterfactual=${obs.counterfactual}) — the gap premise is wrong on this base`,
        };
  }
  if (expectation === 'admit') {
    const killed = obs.baseline === 'pass' && obs.counterfactual === 'fail' && obs.intendedAssertion;
    return killed
      ? {
          caseId: obs.caseId,
          ok: true,
          classification: 'admit-demonstrated',
          detail: 'case passes baseline and fails the counterfactual with the intended assertion — sensitivity proven',
        }
      : {
          caseId: obs.caseId,
          ok: false,
          classification: 'admit-failed-sensitivity',
          detail: `case did NOT kill the counterfactual with the intended assertion (baseline=${obs.baseline}, counterfactual=${obs.counterfactual}, intendedAssertion=${obs.intendedAssertion}) — it proves nothing`,
        };
  }
  return {
    caseId: obs.caseId,
    ok: false,
    classification: 'infrastructure-failure',
    detail: `unsupported executed expectation '${expectation}' for ${obs.caseId} — the frozen oracle must say reject or admit`,
  };
}
