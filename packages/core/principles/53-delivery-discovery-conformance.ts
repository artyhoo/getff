/*
 * Principle 53 — Q6 delivery-conformance + fail-closed discovery (test-assurance kernel, Batch E).
 *
 * Spec: docs/superpowers/specs/2026-10-08-test-assurance-kernel-design.md §5 Q-table (Q6),
 * §4 K5/K6. Frozen oracle: scripts/test-assurance/expectations.json (`channel_map.Q6` =
 * delivery-conformance). RED proof: docs/test-assurance-kernel/s1/logs/batch-e/red-probe.log
 * (severity `off` in the delivered root config flips the real CLI gate 1 -> 0 with zero
 * automated RED — no consumer of the delivered artifact exists on this base).
 *
 * Mechanism (delivery-conformance — the counterfactual lands on the DELIVERED ARTIFACT,
 * not on a test fixture; the delivery edge IS the fault):
 *   1. Build a throwaway scratch root (Batch-C scratch builder, reused verbatim) holding
 *      the Q6 corpus bad/good companions renamed `*.test.ts`.
 *   2. Emit the DELIVERED artifact into it: the repo's real `eslint.config.mjs` copied
 *      VERBATIM plus the two built `.mjs` rule twins at the same relative depth, so the
 *      delivered config is the real one and actually loads.
 *   3. Baseline: the real vitest runner must PASS both companions (good: the config on
 *      disk wires the rule at `error`; bad: its in-memory plan self-satisfies — the gap),
 *      and the real `eslint` CLI must REJECT the planted vacuous probe (delivery live).
 *   4. Delivery break, applied to the scratch copy only: A04 severity `error` -> `off`
 *      (edge A) or the rule line removed entirely (edge B), each proven to apply EXACTLY
 *      ONCE with the principle-52 sha256 convention.
 *   5. Counterfactual: the good companion must FAIL with the intended assertion (its own
 *      `toMatch(/no-vacuous-assertion...error/)` — the delivered artifact no longer
 *      enforces) = admit-demonstrated; the bad companion must STILL PASS (its behavioral
 *      claim was never backed by the artifact) = reject-demonstrated; and the real CLI
 *      gate must flip to exit 0 (delivery-silent — the disconnection demonstrated).
 *
 * Discovery fail-closed arms (K6): corpus<->registry bidirectional reconciliation
 * (registered-but-missing / on-disk-but-unregistered / empty population all refuse),
 * and a principle-discovery ratchet bound to the include grammar parsed from the REAL
 * `packages/core/vitest.config.ts` (a tracked principle test the grammar no longer
 * matches, or one missing on disk, fails closed — a rename out of the include glob can
 * never silently un-deliver a principle). Untracked grammar-matching files are
 * deliberately NOT flagged: work-in-progress is not a discovery failure (same tracked-
 * population convention as principle 51's sweep).
 *
 * Infrastructure honesty (T-TAK-A / spec §2): spawn error, timeout, signal, a rejection
 * without the intended rule id, or an empty selection classifies as
 * `infrastructure-failure` — never detection, never a green.
 *
 * Prior-art: docs/test-assurance-kernel/s1/prior-art.md area (b) (ADAPT of the in-repo
 * conformance-driver shape + BUILD glue; the Batch-C scratch/patch/evaluator mechanics
 * are REUSED, not reimplemented).
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import {
  buildScratch,
  childEnv,
  ConformanceError,
  REPO_ROOT,
  runVitest,
  type ExecutedCase,
  type PatchRecord,
  type ScenarioRun,
  type ScenarioSpec,
} from './52-subprocess-status-conformance.ts';

/** Error raised BEFORE any runner spawn when preconditions are violated (fail-closed). */
export { ConformanceError };

/** The delivered artifact pieces the scratch root must receive (all copied VERBATIM). */
export const DELIVERED_CONFIG_REL = 'eslint.config.mjs';
export const DELIVERED_RULE_TWINS = [
  'packages/core/eslint-rules/no-vacuous-assertion.mjs',
  'packages/core/eslint-rules/require-effective-assertion.mjs',
] as const;

/** The real-CLI probe input: a Q1 bad corpus case planted as a scratch test file. */
export const DELIVERY_PROBE_INPUT: ExecutedCase = {
  caseId: 'q1/bad.literal-identity (delivery probe input)',
  corpusPath: 'scripts/test-assurance/corpus/q1-vacuous/bad.literal-identity.ts',
  scratchName: 'probe-vacuous.test.ts',
};

/** Q6 corpus cases (frozen ids — reconciled against expectations.json by the principle). */
export const Q6_DELIVERY_SPEC: ScenarioSpec = {
  id: 'q6',
  description:
    'in-memory plan valid while the delivered config is disconnected: severity forced off (A04)',
  cases: [
    {
      caseId: 'q6/bad.disconnected-config',
      corpusPath: 'scripts/test-assurance/corpus/q6-disconnected/bad.disconnected-config.ts',
      scratchName: 'q6-bad-disconnected.test.ts',
    },
    {
      caseId: 'q6/good.wired-config',
      corpusPath: 'scripts/test-assurance/corpus/q6-disconnected/good.wired-config.ts',
      scratchName: 'q6-good-wired-config.test.ts',
    },
  ],
  // Declared for the shared spec shape; the delivery scenario applies this patch through
  // applyDeliveredConfigEdge (the target is the scratch ROOT config, not tests/).
  counterfactual: {
    label: 'q6 edge A: delivered severity error -> off',
    from: "'rules-as-tests/no-vacuous-assertion': 'error',",
    to: "'rules-as-tests/no-vacuous-assertion': 'off',",
    appliesTo: [DELIVERED_CONFIG_REL],
  },
};

/** The two representative wiring edges of the ESLint-rule delivery family (Task 7 item 1). */
export interface DeliveryEdge {
  label: string;
  from: string;
  to: string;
}

export const SEVERITY_OFF_EDGE: DeliveryEdge = Q6_DELIVERY_SPEC.counterfactual;
export const UNREGISTER_EDGE: DeliveryEdge = {
  label: 'q6 edge B: delivered rule unregistered from the config',
  from: "'rules-as-tests/no-vacuous-assertion': 'error',",
  to: '',
};

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

/**
 * Emit the DELIVERED artifact into the scratch root: the repo's root `eslint.config.mjs`
 * VERBATIM + the built rule twins at the same relative depth (so the config's relative
 * imports resolve) + the real-CLI probe input. Fails closed on any missing piece
 * (infrastructure precondition — never silently skipped).
 */
export function emitDeliveredArtifact(scratchRoot: string): { configSha256: string } {
  const cfgSrc = resolve(REPO_ROOT, DELIVERED_CONFIG_REL);
  if (!existsSync(cfgSrc)) {
    throw new ConformanceError(`delivered root config missing: ${DELIVERED_CONFIG_REL}`);
  }
  copyFileSync(cfgSrc, join(scratchRoot, DELIVERED_CONFIG_REL));
  mkdirSync(join(scratchRoot, 'packages', 'core', 'eslint-rules'), { recursive: true });
  for (const twin of DELIVERED_RULE_TWINS) {
    const src = resolve(REPO_ROOT, twin);
    if (!existsSync(src)) {
      throw new ConformanceError(
        `built rule twin missing: ${twin} — run scripts/build-shipped-eslint-rules.sh first (infrastructure precondition, not a detection result)`,
      );
    }
    copyFileSync(src, join(scratchRoot, twin));
  }
  const probeSrc = resolve(REPO_ROOT, DELIVERY_PROBE_INPUT.corpusPath);
  if (!existsSync(probeSrc)) {
    throw new ConformanceError(`delivery probe input missing: ${DELIVERY_PROBE_INPUT.corpusPath}`);
  }
  mkdirSync(join(scratchRoot, 'tests'), { recursive: true });
  copyFileSync(probeSrc, join(scratchRoot, 'tests', DELIVERY_PROBE_INPUT.scratchName));
  return { configSha256: sha256(readFileSync(join(scratchRoot, DELIVERED_CONFIG_REL), 'utf8')) };
}

export type DeliveryProbeClassification =
  | 'delivery-live' // rejected WITH the intended rule id — the artifact enforces through the real runner
  | 'delivery-silent' // the same input passes — the delivery is disconnected
  | 'infrastructure-failure'; // spawn error / timeout / reject-without-intended-rule — never proof either way

export interface DeliveryProbe {
  command: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  classification: DeliveryProbeClassification;
  /** the intended rule id appeared in stdout (a reject for the WRONG reason is not delivery-live) */
  ruleMentioned: boolean;
  stdoutTail: string;
  durationMs: number;
  detail?: string;
}

const PROBE_TIMEOUT_MS = 60_000;

/**
 * Run the REAL eslint CLI over the scratch root against the planted vacuous probe — the
 * delivery-liveness observation of the emitted artifact (K5: emitted config -> invoked
 * runner -> gate). A rejection WITHOUT the intended rule id is infrastructure-failure,
 * not live delivery (a wrong-reason reject proves nothing).
 */
export function runDeliveryLiveness(
  scratchRoot: string,
  eslintBin: string = resolve(REPO_ROOT, 'node_modules/.bin/eslint'),
): DeliveryProbe {
  const command = `eslint ${DELIVERY_PROBE_INPUT.scratchName} (cwd=${relative(REPO_ROOT, scratchRoot) || scratchRoot})`;
  const started = Date.now();
  let res: ReturnType<typeof spawnSync>;
  try {
    res = spawnSync(eslintBin, [join('tests', DELIVERY_PROBE_INPUT.scratchName)], {
      cwd: scratchRoot,
      env: childEnv(),
      encoding: 'utf8',
      timeout: PROBE_TIMEOUT_MS,
      killSignal: 'SIGTERM',
    });
  } catch (err) {
    return infraProbe(command, `spawn threw: ${(err as Error).message}`, Date.now() - started);
  }
  const timedOut = res.error !== undefined && (res.error as NodeJS.ErrnoException).code === 'ETIMEDOUT';
  if (timedOut || res.signal) {
    return infraProbe(
      command,
      `probe timed out or signalled (signal=${String(res.signal)})`,
      Date.now() - started,
    );
  }
  if (res.error && !timedOut) {
    return infraProbe(
      command,
      `spawn failed: ${(res.error as NodeJS.ErrnoException).code ?? res.error.message}`,
      Date.now() - started,
    );
  }
  const stdout = String(res.stdout ?? '');
  const ruleMentioned = stdout.includes('rules-as-tests/no-vacuous-assertion');
  const exitCode = res.status ?? null;
  const classification: DeliveryProbeClassification =
    exitCode === 1 && ruleMentioned
      ? 'delivery-live'
      : exitCode === 0
        ? 'delivery-silent'
        : 'infrastructure-failure';
  return {
    command,
    exitCode,
    signal: res.signal ?? null,
    timedOut: false,
    classification,
    ruleMentioned,
    stdoutTail: stdout.slice(-2000),
    durationMs: Date.now() - started,
    detail:
      classification === 'infrastructure-failure'
        ? `exit=${exitCode}, intended rule mentioned=${ruleMentioned} — a reject without the intended rule id is not a live delivery`
        : undefined,
  };
}

function infraProbe(command: string, detail: string, durationMs: number): DeliveryProbe {
  return {
    command,
    exitCode: null,
    signal: null,
    timedOut: false,
    classification: 'infrastructure-failure',
    ruleMentioned: false,
    stdoutTail: '',
    durationMs,
    detail,
  };
}

/**
 * Apply a delivery edge to the scratch-EMITTED config (the counterfactual lands on the
 * delivered artifact). Fails closed unless the edge applies EXACTLY ONCE; records the
 * principle-52 patch honesty shape (sha256 before/after, occurrences).
 */
export function applyDeliveredConfigEdge(scratchRoot: string, edge: DeliveryEdge): PatchRecord {
  const p = join(scratchRoot, DELIVERED_CONFIG_REL);
  const before = readFileSync(p, 'utf8');
  const occurrences = before.split(edge.from).length - 1;
  if (occurrences !== 1) {
    throw new ConformanceError(
      `delivery edge '${edge.label}' does not apply exactly once to ${DELIVERED_CONFIG_REL} (occurrences=${occurrences}) — refusing to run an unproven counterfactual`,
    );
  }
  writeFileSync(p, before.replace(edge.from, edge.to));
  const after = readFileSync(p, 'utf8');
  return {
    label: edge.label,
    patchSha256: sha256(`${edge.label}\n${edge.from}\n${edge.to}`),
    scratchName: DELIVERED_CONFIG_REL,
    beforeSha256: sha256(before),
    afterSha256: sha256(after),
    occurrences,
  };
}

export interface DeliveryOutcome {
  spec: ScenarioSpec;
  scratchRoot: string;
  configSha256: string;
  baseline: ScenarioRun;
  liveBaseline: DeliveryProbe;
  edge: PatchRecord;
  counterfactual: ScenarioRun;
  liveBroken: DeliveryProbe;
}

/**
 * Full Q6 delivery-conformance scenario: scratch + delivered artifact -> baseline (both
 * companions pass; CLI delivery-live) -> severity-off edge on the emitted config ->
 * counterfactual (good dies on the intended assertion; bad survives; CLI delivery-silent).
 * The whole scratch root is throwaway — repo files are never mutated.
 */
export function runDeliveryScenario(eslintBin?: string): DeliveryOutcome {
  const scratchRoot = join(tmpdir(), `s1-p53-${Q6_DELIVERY_SPEC.id}-${process.pid}-${Date.now().toString(36)}`);
  let built = false;
  try {
    buildScratch(Q6_DELIVERY_SPEC, scratchRoot);
    built = true;
    const { configSha256 } = emitDeliveredArtifact(scratchRoot);
    const filters = Q6_DELIVERY_SPEC.cases.map((c) => `tests/${c.scratchName}`);
    const baseline = runVitest(scratchRoot, filters, 'baseline');
    const liveBaseline = runDeliveryLiveness(scratchRoot, eslintBin);
    const edge = applyDeliveredConfigEdge(scratchRoot, SEVERITY_OFF_EDGE);
    const counterfactual = runVitest(scratchRoot, filters, 'counterfactual');
    const liveBroken = runDeliveryLiveness(scratchRoot, eslintBin);
    return { spec: Q6_DELIVERY_SPEC, scratchRoot, configSha256, baseline, liveBaseline, edge, counterfactual, liveBroken };
  } finally {
    if (built) rmSync(scratchRoot, { recursive: true, force: true });
  }
}

// ─── K6: corpus <-> registry reconciliation (bidirectional, fail-closed) ─────────

export interface RegistryMismatch {
  kind: 'registered-but-missing' | 'on-disk-but-unregistered' | 'empty-population';
  detail: string;
}

/** Recursively list every file under `corpusDir` as repo-relative paths. */
export function corpusPopulation(corpusDir: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const d of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, d.name);
      if (d.isDirectory()) walk(p);
      else out.push(p);
    }
  };
  walk(corpusDir);
  return out.map((p) => relative(REPO_ROOT, p)).sort();
}

/**
 * Bidirectional reconciliation between the frozen registry (expectations.json case paths)
 * and the corpus population on disk. Both directions fail closed:
 *   - registered-but-missing     (a deleted path must never silently leave the registry)
 *   - on-disk-but-unregistered   (a deleted registry KEY must never silently orphan a file;
 *                                 a new unlisted extension like `*.test.mts` lands here too)
 *   - empty-population           (an empty corpus selection is never green [T-TAK-A])
 */
export function reconcileCorpusRegistry(corpusDir: string, registeredPaths: Iterable<string>): RegistryMismatch[] {
  const disk = new Set(corpusPopulation(corpusDir));
  if (disk.size === 0) {
    return [{ kind: 'empty-population', detail: `corpus population on disk is empty: ${relative(REPO_ROOT, corpusDir) || corpusDir} [T-TAK-A]` }];
  }
  const mismatches: RegistryMismatch[] = [];
  const registered = new Set(registeredPaths);
  for (const p of [...registered].sort()) {
    if (!disk.has(p)) {
      mismatches.push({ kind: 'registered-but-missing', detail: `registered case path missing on disk: ${p}` });
    }
  }
  for (const p of [...disk].sort()) {
    if (!registered.has(p)) {
      mismatches.push({
        kind: 'on-disk-but-unregistered',
        detail: `corpus file on disk is NOT registered in expectations.json (deleted key, new unlisted extension?): ${p}`,
      });
    }
  }
  return mismatches;
}

// ─── K6: principle-discovery ratchet (bound to the REAL vitest include grammar) ──

export interface DiscoveryMismatch {
  path: string;
  reason: 'not-matched-by-include-grammar' | 'tracked-but-missing-on-disk';
}

/**
 * Parse the `test.include` entries out of the REAL packages/core vitest config text.
 * Fails closed when the config or its include block is missing/empty — a config that
 * selects nothing must never read as a healthy grammar.
 */
export function parseVitestInclude(configPath: string): string[] {
  if (!existsSync(configPath)) {
    throw new ConformanceError(`vitest config missing: ${relative(REPO_ROOT, configPath) || configPath}`);
  }
  const src = readFileSync(configPath, 'utf8');
  const block = src.match(/include:\s*\[([^\]]*)\]/s);
  if (!block) {
    throw new ConformanceError(`vitest config carries no test.include block: ${relative(REPO_ROOT, configPath) || configPath}`);
  }
  const globs = [...block[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
  if (globs.length === 0) {
    throw new ConformanceError(`vitest test.include is empty — discovery must fail closed [T-TAK-A]`);
  }
  return globs;
}

/** Convert the include grammar's `*`/`**` subset to a RegExp (other metachars escaped). */
export function includeGlobToRegExp(glob: string): RegExp {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        // `**/` matches zero or more leading directories; bare `**` matches anything.
        if (glob[i + 2] === '/') {
          re += '(?:.*/)?';
          i += 2;
        } else {
          re += '.*';
          i += 1;
        }
      } else {
        re += '[^/]*';
      }
    } else if ('\\^$.|?+()[]{}'.includes(c)) {
      re += `\\${c}`;
    } else {
      re += c;
    }
  }
  return new RegExp(`^${re}$`);
}

/**
 * The principle-family discovery ratchet: every TRACKED principle test file must (a) exist
 * on disk and (b) match at least one include grammar entry — otherwise a rename/move out
 * of the runner's selection would silently un-deliver a principle (the K6 edge Task 7
 * breaks in replay-principle-rename-break.sh). Untracked files are work-in-progress and
 * deliberately not flagged.
 */
export function principleDiscoveryMismatches(
  trackedFiles: string[],
  packageRoot: string,
  includeGlobs: string[],
): DiscoveryMismatch[] {
  const regexes = includeGlobs.map(includeGlobToRegExp);
  const mismatches: DiscoveryMismatch[] = [];
  for (const repoRel of trackedFiles) {
    const abs = resolve(REPO_ROOT, repoRel);
    if (!existsSync(abs)) {
      mismatches.push({ path: repoRel, reason: 'tracked-but-missing-on-disk' });
      continue;
    }
    const pkgRel = relative(packageRoot, abs);
    if (!regexes.some((re) => re.test(pkgRel))) {
      mismatches.push({ path: repoRel, reason: 'not-matched-by-include-grammar' });
    }
  }
  return mismatches.sort((a, b) => a.path.localeCompare(b.path));
}

// ─── K6: principle pairing ratchet (the rename-out-of-grammar catch) ─────────────

export interface OrphanedModule {
  /** core-root-relative module path, e.g. `principles/52-subprocess-status-conformance.ts` */
  module: string;
  /** the principle number whose test pairing broke */
  number: string;
}

/** Top-level numbered principle modules on disk (`NN-slug.ts`, excluding `*.test.ts`). */
export function numberedPrincipleModules(coreRoot: string): string[] {
  const dir = resolve(coreRoot, 'principles');
  if (!existsSync(dir)) {
    throw new ConformanceError(`principles directory missing: ${dir}`);
  }
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && /^\d+-.*\.ts$/.test(d.name) && !d.name.endsWith('.test.ts'))
    .map((d) => `principles/${d.name}`)
    .sort();
}

/**
 * The LIVE discovery ratchet, bound to the repo's paired-negative discipline (principle
 * 02): every numbered principle module must keep at least one sibling `<n>-*.test.ts`
 * that the runner's include grammar actually SELECTS. The population is grammar-
 * INDEPENDENT (the module's number), which is what makes the rename edge reachable: a
 * principle test renamed outside the vitest include glob silently un-delivers the
 * principle — the runner just runs one file fewer — while the module stays behind
 * orphaned. An unnumbered helper (`rule-channel-glob.ts` etc.) is out of scope; a module
 * committed without its test pair fails here by construction.
 */
export function principleDiscoveryRatchet(coreRoot: string, includeGlobs: string[]): OrphanedModule[] {
  const regexes = includeGlobs.map(includeGlobToRegExp);
  const dir = resolve(coreRoot, 'principles');
  const orphans: OrphanedModule[] = [];
  for (const moduleRel of numberedPrincipleModules(coreRoot)) {
    const number = moduleRel.match(/^principles\/(\d+)-/)?.[1];
    if (!number) continue;
    const hasSelectedTest = readdirSync(dir).some((name) => {
      if (!name.startsWith(`${number}-`) || !name.endsWith('.test.ts')) return false;
      return regexes.some((re) => re.test(`principles/${name}`));
    });
    if (!hasSelectedTest) {
      orphans.push({ module: moduleRel, number });
    }
  }
  return orphans.sort((a, b) => a.module.localeCompare(b.module));
}
