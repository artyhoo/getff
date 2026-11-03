/*
 * Principle 53 — Q6 delivery-conformance + fail-closed discovery (test-assurance kernel, Batch E).
 *
 * Companion test for `53-delivery-discovery-conformance.ts` — read its docblock for the
 * mechanism. This principle:
 *   1. reconciles the Q6 delivery scenario against the FROZEN oracle
 *      (`scripts/test-assurance/expectations.json` — channel_map.Q6 = delivery-conformance,
 *      case paths + reject/admit expectations), so the module can never silently drift;
 *   2. runs the DELIVERY counterfactual for real: scratch root + the repo's actual
 *      delivered `eslint.config.mjs` (verbatim) + built rule twins + a planted vacuous
 *      probe → baseline (both companions pass, real eslint CLI rejects the probe) →
 *      severity `off` applied to the EMITTED config → good companion dies on the intended
 *      assertion, bad companion survives, CLI flips silent (K5 delivery liveness);
 *   3. demands delivery-edge honesty: the edge applies EXACTLY ONCE to the emitted
 *      artifact with sha256 before/after (K7), and BOTH family edges remain uniquely
 *      applicable to the real delivered config;
 *   4. proves the K6 fail-closed arms: corpus<->registry reconciliation refuses
 *      registered-but-missing / on-disk-but-unregistered (deleted key, new unlisted
 *      extension) / empty population, and the principle-discovery ratchet — bound to the
 *      REAL `packages/core/vitest.config.ts` include grammar — refuses a tracked principle
 *      test the grammar no longer selects or one missing on disk;
 *   5. classifies delivery-probe infrastructure honestly: spawn failure, or a reject
 *      WITHOUT the intended rule id, is infrastructure-failure — never detection (T-TAK-A).
 *
 * Raw Batch-E evidence: docs/test-assurance-kernel/s1/logs/batch-e/ (RED probe +
 * verification). Spec §5 Q-table row Q6; seed A04 (severity-off survived 431 tests).
 */
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ConformanceError,
  CORPUS_ROOT,
  childEnv,
  evaluateExecutedExpectation,
  INTENDED_ASSERTIONS,
  observe,
  REPO_ROOT,
} from './52-subprocess-status-conformance.ts';
import {
  DELIVERED_CONFIG_REL,
  DELIVERED_RULE_TWINS,
  Q6_DELIVERY_SPEC,
  SEVERITY_OFF_EDGE,
  UNREGISTER_EDGE,
  applyDeliveredConfigEdge,
  corpusPopulation,
  emitDeliveredArtifact,
  includeGlobToRegExp,
  numberedPrincipleModules,
  parseVitestInclude,
  principleDiscoveryRatchet,
  principleDiscoveryMismatches,
  reconcileCorpusRegistry,
  runDeliveryLiveness,
  runDeliveryScenario,
} from './53-delivery-discovery-conformance.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const CORE_ROOT = resolve(HERE, '..');
const EXPECTATIONS_PATH = resolve(REPO_ROOT, 'scripts/test-assurance/expectations.json');
const DELIVERED_CONFIG_ABS = resolve(REPO_ROOT, DELIVERED_CONFIG_REL);
const VITEST_CONFIG_ABS = resolve(CORE_ROOT, 'vitest.config.ts');

/**
 * Native child outcome carrying the same error/status/signal split the serial spawnSync
 * form observed: a child that genuinely exited keeps its numeric status (error null); a
 * child that never completed (spawn failure, timeout kill, maxBuffer) carries the native
 * error message instead, with its signal when one killed it.
 */
interface NativeOutcome {
  status: number | null;
  signal: string | null;
  error: string | null;
  stdout: string;
  stderr: string;
}

type NativeOptions = { cwd: string; env: NodeJS.ProcessEnv; encoding: 'utf8'; timeout: number; maxBuffer?: number };
type NativeError = Error & { code?: unknown; signal?: string | null; killed?: boolean; stdout?: string; stderr?: string };

const nativeOutcome = (error: NativeError | null, stdout: string, stderr: string): NativeOutcome => {
  if (!error) return { status: 0, signal: null, error: null, stdout, stderr };
  if (typeof error.code === 'number') {
    return { status: error.code, signal: error.signal ?? null, error: null, stdout, stderr };
  }
  return { status: null, signal: error.signal ?? null, error: error.message, stdout, stderr };
};

/**
 * Async native child with the serial form's noninteractive stdin: spawnSync passed
 * stdio 'ignore' (immediate EOF); execFile's default leaves the stdin pipe OPEN, which
 * stalls children that read stdin (owner native probe 2026-10-31: old ignore → exit 0 /
 * 'EOF'; promisified default → timeout kill / SIGTERM / empty stdout). The retained child
 * handle ends our end of the pipe immediately, restoring instant EOF while keeping
 * execFile's native output/maxBuffer/status/signal/error/timeout semantics.
 */
const execNative = (file: string, args: string[], options: NativeOptions): Promise<NativeOutcome> =>
  new Promise<NativeOutcome>((resolve) => {
    const child = execFile(file, args, options, (error, stdout, stderr) => {
      resolve(nativeOutcome(error, stdout, stderr));
    });
    child.stdin?.end();
  });

interface ExpectationsCase {
  id: string;
  path: string;
  q: string;
  channel: string;
  expectation: string;
}

interface Expectations {
  frozen_at: string;
  channel_map: Record<string, string>;
  cases: ExpectationsCase[];
}

function sha256File(p: string): string {
  return createHash('sha256').update(readFileSync(p, 'utf8')).digest('hex');
}

/** Materialize a scratch eslint bin with scripted stdout/exit (probe-classification arms). */
function fakeEslintBin(dir: string, body: string): string {
  const p = join(dir, 'eslint-fake.sh');
  writeFileSync(p, `#!/bin/sh\n${body}\n`);
  chmodSync(p, 0o755);
  return p;
}

describe('principle 53 — Q6 delivery-conformance + fail-closed discovery (test-assurance kernel)', () => {
  const expectations = JSON.parse(readFileSync(EXPECTATIONS_PATH, 'utf8')) as Expectations;
  const frozenById = new Map(expectations.cases.map((c) => [c.id, c]));

  // 2026-11-01 upstream integration renewal (Root-reviewed, unit32 safe remainder): the
  // CURRENT approved default-config hash per stack resolves through the single admitted
  // canonical carrier, byte-pinned to the Root review. The historical frozen contract stays
  // byte-identical on disk and remains the approval whenever the carrier is absent (legacy
  // no-integration behavior); an edited/missing carrier section is a hard failure, never a
  // cue to follow an observed output. Renewal changes DEFAULT CONFIG BYTE IDENTITY only —
  // the installer-completion/status/placement and corruption/refusal controls are untouched.
  const INTEGRATION_CARRIER_PATH = resolve(
    REPO_ROOT,
    'docs/test-assurance-kernel/s2/integration-bc8e758d.reviewed.json',
  );
  const INTEGRATION_CARRIER_SHA256 =
    'b055a1e85718336427fe6405d7e1fcd0af1937407fc20ca3b913db12ffe7f052';
  const currentApprovedHash = (profile: { stack: string; approved_config_sha256: string }): string => {
    if (!existsSync(INTEGRATION_CARRIER_PATH)) return profile.approved_config_sha256;
    const raw = readFileSync(INTEGRATION_CARRIER_PATH);
    if (createHash('sha256').update(raw).digest('hex') !== INTEGRATION_CARRIER_SHA256) {
      throw new Error('integration-bc8e758d.reviewed.json drifted from the pinned Root review — renewal refuses to follow unpinned hashes');
    }
    const renewal = JSON.parse(raw.toString('utf8')) as {
      m04IndependentDefaultsRenewal: {
        originalCanonicalContractSha256: string;
        originalRecordMustRemainUnchanged: boolean;
        profiles: { stack: string; independentlyDerivedUnionSha256: string }[];
      };
    };
    if (renewal.m04IndependentDefaultsRenewal.originalRecordMustRemainUnchanged !== true) {
      throw new Error('reviewed renewal must require the historical contract to stay unchanged');
    }
    const row = renewal.m04IndependentDefaultsRenewal.profiles.find((p) => p.stack === profile.stack);
    if (!row) throw new Error(`no reviewed renewal entry for stack ${profile.stack}`);
    return row.independentlyDerivedUnionSha256;
  };

  it('A04: actual installer preserves approved default preset artifacts', async () => {
    const contract = JSON.parse(readFileSync(resolve(REPO_ROOT,
      'docs/test-assurance-kernel/s2/m04-installed-contract/frozen-installed-contract.json'), 'utf8')) as {
      version: number;
      profiles: { stack: string; approved_config_sha256: string }[];
    };
    expect(contract.version).toBe(1);
    expect(contract.profiles.map((profile) => profile.stack)).toEqual(['ts-server', 'react-next', 'react-spa']);
    // One profile = one owned consumer dir, one git init, one REAL installer, one
    // artifact assertion, one cleanup. The profiles share no mutable state, so they run
    // as three concurrent real installs instead of a serial loop. runProfile NEVER
    // rejects — every possible failure (including setup BEFORE the installer and the
    // finally-block cleanup itself) is captured into the returned run and re-thrown
    // only after ALL children have closed and cleaned up — no failfast sibling
    // abandonment, no scratch removed while a sibling installer still writes into it,
    // no silently swallowed cleanup error.
    interface ProfileRun { stack: string; receipt?: string; failure?: unknown }
    const runProfile = async (profile: { stack: string; approved_config_sha256: string }): Promise<ProfileRun> => {
      const run: ProfileRun = { stack: profile.stack };
      let consumer: string | null = null;
      try {
        expect(profile.approved_config_sha256).toMatch(/^[0-9a-f]{64}$/);
        consumer = realpathSync(mkdtempSync(join(tmpdir(), 'tak-m04-installed-')));
        const initialized = await execNative('git', ['init', '--quiet'],
          { cwd: consumer, env: childEnv(), encoding: 'utf8', timeout: 10_000 });
        expect(initialized.error, `A04 ${profile.stack}: git init spawn`).toBeNull();
        expect(initialized.signal, `A04 ${profile.stack}: git init signal`).toBeNull();
        expect(initialized.status, `A04 ${profile.stack}: git init status; ${initialized.stderr}`).toBe(0);
        writeFileSync(join(consumer, 'package.json'), JSON.stringify({ name: 'tak-m04-consumer', private: true }));
        const command = ['bash', resolve(REPO_ROOT, 'install.sh'), profile.stack, '--force'];
        const started = Date.now();
        // Finite nested runtime budget, not a skip: the real default-profile install
        // exceeded the former 30s per-profile bound in all three R1B repaired runs
        // (installer ETIMEDOUT at 33.2-34.3s while the placed config hash already
        // matched — R1B-native-dated-broad-20261028/TERMINAL-RETURN.json). 120s keeps
        // the real installer invocation and every spawn/error/signal/status/existence
        // /hash assertion a hard, bounded failure.
        const installed = await execNative(command[0], command.slice(1), {
          cwd: consumer, env: childEnv(), encoding: 'utf8', timeout: 120_000, maxBuffer: 16 * 1024 * 1024,
        });
        const config = join(consumer, 'eslint.config.mjs');
        const actualHash = existsSync(config) ? sha256File(config) : null;
        run.receipt = JSON.stringify({
          stack: profile.stack, command, cwd: consumer, status: installed.status, signal: installed.signal,
          error: installed.error, duration_ms: Date.now() - started,
          actual_hash: actualHash, stdout: installed.stdout, stderr: installed.stderr,
        });
        expect(installed.error, `A04 ${profile.stack}: installer spawn/timeout`).toBeNull();
        expect(installed.signal, `A04 ${profile.stack}: installer signal`).toBeNull();
        expect(installed.status, `A04 ${profile.stack}: installer native status`).toBe(0);
        expect(existsSync(config), `A04 ${profile.stack}: actual installed config`).toBe(true);
        expect(actualHash, `A04 ${profile.stack}: placed-artifact hash`).toBe(currentApprovedHash(profile));
      } catch (failure) {
        if (run.failure === undefined) run.failure = failure;
      } finally {
        if (consumer !== null) {
          try {
            rmSync(consumer, { recursive: true, force: true });
          } catch (cleanupFailure) {
            // A cleanup failure is a real failure of the owned scratch contract —
            // recorded (first failure wins), never silenced and never fabricated away.
            if (run.failure === undefined) run.failure = cleanupFailure;
          }
        }
      }
      return run;
    };
    // Launch all three real installs and wait for EVERY owned child/close/cleanup to
    // settle (allSettled: even an unexpected rejection of a wrapper can no longer cut
    // the wait short), then emit the buffered [TAK-M04] receipts IN CONTRACT ORDER
    // (never completion order — evaluateS2Kernel pins receipts[i].stack per profile)
    // and re-throw the first contract-order failure only after everything settled.
    const settled = await Promise.allSettled(contract.profiles.map((profile) => runProfile(profile)));
    const runs = settled.map((outcome, index): ProfileRun => (outcome.status === 'fulfilled'
      ? outcome.value
      : { stack: contract.profiles[index].stack, failure: outcome.reason }));
    for (const run of runs) if (run.receipt) console.log('[TAK-M04]', run.receipt);
    const failed = runs.find((run) => run.failure !== undefined);
    if (failed) throw failed.failure;
    // Whole-arm envelope: the per-profile bounds (120s installer, 10s git init) now run
    // concurrently; 420s still bounds the whole arm against pathological scheduling.
    // Finite; every nested failure still fails the arm.
  }, 420_000);

  it('the frozen oracle pins the delivery-conformance channel and both Q6 cases', () => {
    expect(expectations.frozen_at).toBe('2026-10-08');
    expect(expectations.channel_map.Q6).toContain('delivery-conformance');
    // non-vacuity: the oracle pins a real population, and the corpus population on disk
    // matches it — reconcileCorpusRegistry proves the bidirectional direction below.
    expect(expectations.cases.length).toBeGreaterThanOrEqual(30);
    for (const c of Q6_DELIVERY_SPEC.cases) {
      const frozen = frozenById.get(c.caseId);
      expect(frozen, `frozen case missing: ${c.caseId}`).toBeDefined();
      expect(c.corpusPath, `corpus path drift for ${c.caseId}`).toBe(frozen?.path);
      expect(frozen?.channel).toBe('delivery-conformance');
      expect(existsSync(resolve(REPO_ROOT, c.corpusPath)), `corpus file missing: ${c.corpusPath}`).toBe(true);
    }
    expect(frozenById.get('q6/bad.disconnected-config')?.expectation).toBe('reject');
    expect(frozenById.get('q6/good.wired-config')?.expectation).toBe('admit');
    expect(INTENDED_ASSERTIONS['q6/good.wired-config']).toBeDefined();
  });

  it(
    'Q6: severity-off on the EMITTED config kills the good companion on the intended assertion and silences the real CLI',
    () => {
      const outcome = runDeliveryScenario();
      // infrastructure honesty: two real vitest runs + two real eslint CLI probes ran
      expect(outcome.baseline.classification).not.toBe('infrastructure-failure');
      expect(outcome.counterfactual.classification).not.toBe('infrastructure-failure');
      expect(Object.keys(outcome.baseline.files).length).toBe(Q6_DELIVERY_SPEC.cases.length);
      for (const c of Q6_DELIVERY_SPEC.cases) {
        expect(outcome.baseline.files[c.scratchName]?.status, `baseline must pass: ${c.scratchName}`).toBe('pass');
      }

      // delivery liveness at baseline: the real CLI rejects the planted probe WITH the rule id
      expect(outcome.liveBaseline.classification).toBe('delivery-live');
      expect(outcome.liveBaseline.exitCode).toBe(1);
      expect(outcome.liveBaseline.ruleMentioned).toBe(true);

      // edge honesty: applied EXACTLY ONCE to the emitted artifact, sha256 recorded
      expect(outcome.edge.occurrences).toBe(1);
      expect(outcome.edge.scratchName).toBe(DELIVERED_CONFIG_REL);
      expect(outcome.edge.beforeSha256).toBe(outcome.configSha256);
      expect(outcome.edge.beforeSha256).not.toBe(outcome.edge.afterSha256);
      expect(outcome.edge.patchSha256).toMatch(/^[0-9a-f]{64}$/);

      // counterfactual: the good companion dies on ITS OWN assertion (the delivered
      // artifact no longer enforces); the bad companion survives (it never read the disk)
      const good = outcome.counterfactual.files['q6-good-wired-config.test.ts'];
      expect(good?.status).toBe('fail');
      expect(good?.failureMessages.join('\n')).toMatch(/to match \/no-vacuous-assertion/);
      const bad = outcome.counterfactual.files['q6-bad-disconnected.test.ts'];
      expect(bad?.status, 'the in-memory-plan bad companion must survive (its claim was never backed)').toBe('pass');

      // delivery liveness under the fault: the real CLI gate is DISCONNECTED (exit 0)
      expect(outcome.liveBroken.classification).toBe('delivery-silent');
      expect(outcome.liveBroken.exitCode).toBe(0);
      expect(outcome.liveBroken.ruleMentioned).toBe(false);

      // frozen-semantics evaluation over the same run (reuse of the Batch-C evaluator)
      const obs = Object.fromEntries(
        observe({
          spec: outcome.spec,
          scratchRoot: outcome.scratchRoot,
          baseline: outcome.baseline,
          counterfactual: outcome.counterfactual,
          patches: [outcome.edge],
        }).map((o) => [o.caseId, o]),
      );
      const reject = evaluateExecutedExpectation(obs['q6/bad.disconnected-config'], 'reject');
      expect(reject.ok).toBe(true);
      expect(reject.classification).toBe('reject-demonstrated');
      const admit = evaluateExecutedExpectation(obs['q6/good.wired-config'], 'admit');
      expect(admit.ok).toBe(true);
      expect(admit.classification).toBe('admit-demonstrated');
      expect(obs['q6/good.wired-config'].intendedAssertion).toBe(true);
    },
    // Two real vitest spawns + two real eslint CLI probes (~8s observed; the default
    // 5000ms vitest timeout false-fails it). 60s margin covers host load — same
    // precedent as principle 02's bash-mutator arm and the root config's 60s ceiling.
    60_000,
  );

  it('both ESLint-family delivery edges remain uniquely applicable to the REAL delivered config', () => {
    const cfg = readFileSync(DELIVERED_CONFIG_ABS, 'utf8');
    for (const edge of [SEVERITY_OFF_EDGE, UNREGISTER_EDGE]) {
      const occurrences = cfg.split(edge.from).length - 1;
      expect(occurrences, `edge '${edge.label}' must apply exactly once to the delivered config`).toBe(1);
    }
  });

  it('the delivered artifact is emitted VERBATIM into the scratch (config hash + twins + probe)', () => {
    const scratchRoot = mkdtempSync(join(tmpdir(), 's1-p53-emit-'));
    try {
      const { configSha256 } = emitDeliveredArtifact(scratchRoot);
      expect(configSha256).toBe(sha256File(DELIVERED_CONFIG_ABS));
      for (const twin of DELIVERED_RULE_TWINS) {
        expect(existsSync(join(scratchRoot, twin)), `twin planted: ${twin}`).toBe(true);
      }
      const probe = readFileSync(join(scratchRoot, 'tests', 'probe-vacuous.test.ts'), 'utf8');
      expect(probe).toContain('expect(true).toBe(true)');
    } finally {
      rmSync(scratchRoot, { recursive: true, force: true });
    }
  });

  it('K7 edge honesty: an edge that does not apply EXACTLY ONCE is refused, not run', () => {
    const scratchRoot = mkdtempSync(join(tmpdir(), 's1-p53-edge-'));
    try {
      writeFileSync(join(scratchRoot, DELIVERED_CONFIG_REL), "export default { rules: {} };\n");
      expect(() => applyDeliveredConfigEdge(scratchRoot, SEVERITY_OFF_EDGE)).toThrow(/does not apply exactly once/);
      writeFileSync(
        join(scratchRoot, DELIVERED_CONFIG_REL),
        `${SEVERITY_OFF_EDGE.from}\n${SEVERITY_OFF_EDGE.from}\n`,
      );
      expect(() => applyDeliveredConfigEdge(scratchRoot, SEVERITY_OFF_EDGE)).toThrow(/occurrences=2/);
      // exactly-once path records the full patch-honesty shape
      writeFileSync(join(scratchRoot, DELIVERED_CONFIG_REL), `${SEVERITY_OFF_EDGE.from}\n`);
      const rec = applyDeliveredConfigEdge(scratchRoot, SEVERITY_OFF_EDGE);
      expect(rec.occurrences).toBe(1);
      expect(rec.beforeSha256).not.toBe(rec.afterSha256);
      expect(rec.patchSha256).toMatch(/^[0-9a-f]{64}$/);
    } finally {
      rmSync(scratchRoot, { recursive: true, force: true });
    }
  });

  it('delivery-probe honesty: spawn failure and reject-without-intended-rule are infrastructure-failure', () => {
    const scratchRoot = mkdtempSync(join(tmpdir(), 's1-p53-probe-'));
    try {
      // nonexistent bin → spawn failure
      const dead = runDeliveryLiveness(scratchRoot, '/nonexistent/s1-p53-eslint');
      expect(dead.classification).toBe('infrastructure-failure');
      expect(dead.detail).toMatch(/spawn failed/);
      // exit 0 → the delivery is silent (this IS a classification, not an error)
      const silent = runDeliveryLiveness(scratchRoot, fakeEslintBin(scratchRoot, 'exit 0'));
      expect(silent.classification).toBe('delivery-silent');
      expect(silent.ruleMentioned).toBe(false);
      // exit 1 WITHOUT the intended rule id → wrong-reason reject, never proof
      const wrong = runDeliveryLiveness(scratchRoot, fakeEslintBin(scratchRoot, 'echo "parsing error: nope"; exit 1'));
      expect(wrong.classification).toBe('infrastructure-failure');
      expect(wrong.detail).toMatch(/not a live delivery/);
      // exit 1 WITH the rule id → live delivery
      const live = runDeliveryLiveness(scratchRoot, fakeEslintBin(scratchRoot, 'echo "error  rules-as-tests/no-vacuous-assertion  boom"; exit 1'));
      expect(live.classification).toBe('delivery-live');
      expect(live.ruleMentioned).toBe(true);
    } finally {
      rmSync(scratchRoot, { recursive: true, force: true });
    }
  });

  it('K6 corpus<->registry: the REAL population reconciles clean against the frozen oracle', () => {
    const registered = expectations.cases.map((c) => c.path);
    const population = corpusPopulation(CORPUS_ROOT);
    // non-vacuity floor: the frozen corpus is a real, sizeable population (T10)
    expect(population.length).toBeGreaterThanOrEqual(30);
    expect(reconcileCorpusRegistry(CORPUS_ROOT, registered)).toEqual([]);
  });

  it('K6 corpus<->registry: a deleted path, a deleted registry key, and an empty corpus all fail closed', () => {
    const registered = expectations.cases.map((c) => c.path);
    // registered-but-missing: a deleted corpus path must never silently stay registered
    const withDeleted = [...registered, 'scripts/test-assurance/corpus/q1-vacuous/deleted-path.ts'];
    const missing = reconcileCorpusRegistry(CORPUS_ROOT, withDeleted);
    expect(missing).toHaveLength(1);
    expect(missing[0].kind).toBe('registered-but-missing');
    expect(missing[0].detail).toContain('deleted-path.ts');

    // on-disk-but-unregistered: a deleted/never-added registry key orphans files
    const orphaned = reconcileCorpusRegistry(CORPUS_ROOT, [registered[0]]);
    expect(orphaned.length).toBeGreaterThan(20);
    expect(orphaned.every((m) => m.kind === 'on-disk-but-unregistered')).toBe(true);

    // new unlisted extension: a `*.test.mts` file outside the registry is flagged
    const extDir = mkdtempSync(join(tmpdir(), 's1-p53-ext-'));
    try {
      writeFileSync(join(extDir, 'new.case.test.mts'), 'export {};\n');
      writeFileSync(join(extDir, 'old.case.ts'), 'export {};\n');
      const both = reconcileCorpusRegistry(extDir, [join('scripts/test-assurance/corpus/x', 'old.case.ts')]);
      // the registered path never exists on disk under this temp root → missing; the
      // unregistered .mts is the load-bearing direction here
      expect(both.some((m) => m.kind === 'on-disk-but-unregistered' && m.detail.includes('new.case.test.mts'))).toBe(true);
    } finally {
      rmSync(extDir, { recursive: true, force: true });
    }

    // empty population: an empty corpus selection is never green [T-TAK-A]
    const emptyDir = mkdtempSync(join(tmpdir(), 's1-p53-empty-'));
    try {
      const empty = reconcileCorpusRegistry(emptyDir, []);
      expect(empty).toHaveLength(1);
      expect(empty[0].kind).toBe('empty-population');
      expect(empty[0].detail).toMatch(/T-TAK-A/);
    } finally {
      rmSync(emptyDir, { recursive: true, force: true });
    }
  });

  it('K6 discovery: the REAL vitest include grammar is parsed and selects every on-disk principle test', () => {
    const globs = parseVitestInclude(VITEST_CONFIG_ABS);
    expect(globs).toContain('principles/**/*.test.ts');
    const onDisk = readdirSync(HERE)
      .filter((f) => f.endsWith('.test.ts'))
      .map((f) => relative(REPO_ROOT, join(HERE, f)));
    // non-vacuity floor: the ratchet governs the real principle population (T10)
    expect(onDisk.length).toBeGreaterThanOrEqual(50);
    expect(principleDiscoveryMismatches(onDisk, CORE_ROOT, globs)).toEqual([]);
  });

  it('K6 discovery pairing: every numbered principle module keeps a grammar-selected test sibling', () => {
    const globs = parseVitestInclude(VITEST_CONFIG_ABS);
    const modules = numberedPrincipleModules(CORE_ROOT);
    // non-vacuity: the ratchet governs the real numbered-module population (T10)
    expect(modules.length).toBeGreaterThanOrEqual(13);
    // the LIVE ratchet: a principle test renamed outside the include grammar (or
    // deleted) orphans its module — the silent un-delivery must never read green.
    // The orphan paths are carried in the assertion message: a truncated vitest
    // object diff must never be the only place the un-delivered principle is named.
    const orphans = principleDiscoveryRatchet(CORE_ROOT, globs);
    expect(
      orphans,
      `orphaned principle modules (no grammar-selected <n>-*.test.ts sibling): ${orphans.map((o) => o.module).join(', ')}`,
    ).toEqual([]);
  });

  it('K6 discovery: a rename out of the include grammar and a deleted file both fail closed', () => {    const globs = parseVitestInclude(VITEST_CONFIG_ABS);
    // a real, on-disk file the grammar no longer selects (the rename-out edge)
    const moduleFile = relative(CORE_ROOT, resolve(HERE, '53-delivery-discovery-conformance.ts'));
    const grammarMiss = principleDiscoveryMismatches([relative(REPO_ROOT, resolve(CORE_ROOT, moduleFile))], CORE_ROOT, globs);
    expect(grammarMiss).toHaveLength(1);
    expect(grammarMiss[0].reason).toBe('not-matched-by-include-grammar');
    // a tracked file missing on disk (deleted after registration)
    const gone = principleDiscoveryMismatches(['packages/core/principles/zz-deleted-by-arm.test.ts'], CORE_ROOT, globs);
    expect(gone).toHaveLength(1);
    expect(gone[0].reason).toBe('tracked-but-missing-on-disk');
  });

  it('K6 discovery: a missing/empty include grammar fails closed instead of reading healthy', () => {
    expect(() => parseVitestInclude(resolve(tmpdir(), 's1-p53-no-such-vitest.config.ts'))).toThrow(/vitest config missing/);
    const dir = mkdtempSync(join(tmpdir(), 's1-p53-vitest-cfg-'));
    try {
      const noInclude = join(dir, 'no-include.ts');
      writeFileSync(noInclude, "export default { test: { globals: false } };\n");
      expect(() => parseVitestInclude(noInclude)).toThrow(/no test\.include block/);
      const emptyInclude = join(dir, 'empty-include.ts');
      writeFileSync(emptyInclude, "export default { test: { include: [] } };\n");
      expect(() => parseVitestInclude(emptyInclude)).toThrow(/fail closed/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('the include-grammar conversion is a faithful subset (star, globstar, anchoring, escaping)', () => {
    const nested = includeGlobToRegExp('principles/**/*.test.ts');
    expect(nested.test('principles/53-x.test.ts')).toBe(true);
    expect(nested.test('principles/a/b/53-x.test.ts')).toBe(true);
    expect(nested.test('principles/53-x.ts')).toBe(false);
    expect(nested.test('53-x.test.ts')).toBe(false);
    expect(nested.test('principles/53-x.test.ts.bak')).toBe(false);
    const single = includeGlobToRegExp('principles/*.test.ts');
    expect(single.test('principles/a.test.ts')).toBe(true);
    expect(single.test('principles/a/b.test.ts')).toBe(false);
    const dots = includeGlobToRegExp('hooks/check.ts');
    expect(dots.test('hooks/check.ts')).toBe(true);
    expect(dots.test('hooks/checkXts')).toBe(false);
  });
});
