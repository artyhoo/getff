/**
 * guard-liveness-fullsweep.ts — Periodic FULL-SWEEP guard-liveness orchestrator (Wave guard-liveness v2).
 *
 * @channel CI full-sweep — the LAST-RESORT backstop (README#why-this-exists: CI is
 *   the last-resort gate, not the primary one; rule-enforcement-channel-selection.md §3).
 *   v1 / v1.5 / v3 are CHANGE-SCOPED (they verify only the rules a PR touches, via
 *   `git diff`). A rule shipped clean today can rot tomorrow without being re-touched
 *   — its dependency updates, its target file is renamed, the manifest entry drifts —
 *   and the change-scoped gate never re-runs it. v2 fills that regression hole by
 *   re-invoking the three already-shipped mechanisms over the ENTIRE manifest, with
 *   NO git-diff scoping, gating PRs into `main` (staging→main promotion is the last
 *   reachable channel before prod).
 *
 * v2 ONLY ORCHESTRATES — it adds NO new gate logic (kickoff §2 OUT / T5). It calls
 * the existing pure primitives verbatim:
 *   - v1   ESLint arm      → runGuardLivenessCheck(allEslintIds, manifest)        (guard-liveness.ts)
 *   - v1.5 cmd/script arm  → runCmdScriptLivenessCheck(allCmdScriptIds, manifest) (cmd-script-liveness.ts)
 *   - v3   structural arm  → principle 02 (the SSOT for pressure-scenario / negative-test /
 *                            fixture well-formedness), invoked as a subprocess via run-check.ts
 *                            (SSOT #54). The full RED→GREEN LLM probe (agents/manual-rule-liveness-prober.md)
 *                            stays SESSION-BOUND — no-paid-llm-in-ci.md forbids an LLM in CI, so the CI
 *                            sweep covers only the deterministic structural arm.
 *
 * Prior-art (capability commit): no off-the-shelf tool orchestrates in-repo TypeScript
 * predicate functions over a rule-manifest corpus. pre-commit / lefthook run external
 * hooks over a FILE corpus (problem-class mismatch — T16 pattern-matching-on-name);
 * Stryker is a mutation runner tied to mutation concepts; all delegate scheduling to the
 * CI platform. The ADOPT target is GitHub Actions' own primitives (a `main`-gating
 * workflow) + this thin TS driver that loops the three shipped pure functions over the
 * full corpus, emits JSON, exits non-zero on a real FAILURE. BUILD verdict per
 * docs/meta-factory/research-patches/2026-05-23-guard-liveness-gate.md §3 (v2 row).
 *
 * Fail policy (the agent-flagged I-phase decision): exit non-zero ONLY on a real
 * liveness FAILURE — a guard that does not catch its own violation (kickoff §2.2:
 * "fail if any guard's bad-corpus / fixture / pressure-scenario doesn't trip its real
 * check"). `skip` (uninstalled plugin / unavailable binary / consumer-only artifact),
 * `no-data`, and `exempt` are TOLERATED but REPORTED with explicit coverage counts so a
 * silently-growing skip set is visible to the reviewer (T14 — never confuse "swept" with
 * "no rot"; report which rules were and were NOT exercised). This is consistent with the
 * change-scoped gates' own skip-on-unavailable behaviour (guard-liveness.ts SKIP precedent).
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCheck } from '../utils/run-check.ts';
import {
  runGuardLivenessCheck,
  type GuardLivenessReport,
  type ManifestRule,
} from './guard-liveness.ts';
import {
  runCmdScriptLivenessCheck,
  type CmdScriptLivenessReport,
  type CmdScriptRule,
} from './cmd-script-liveness.ts';
import { isDirectRun } from '../../install/is-direct-run.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = resolve(HERE, '../../../..');
const MANIFEST_REL = 'packages/core/manifest/rules-manifest.json';

/** Result of the v3 deterministic structural arm (principle 02 subprocess). */
export interface StructuralArmResult {
  passed: boolean;
  /** Captured subprocess output (truncated by the caller for display). */
  output: string;
  reason?: string;
}

export interface FullSweepReport {
  /** v1 — ESLint roundtrip arm over ALL eslint rules. */
  eslint: GuardLivenessReport;
  /** v1.5 — command/script liveness arm over ALL command/script rules. */
  cmdScript: CmdScriptLivenessReport;
  /** v3 — deterministic structural arm (manifest well-formedness incl. manual pressure-scenarios). */
  structural: StructuralArmResult;
  /** Manual rule IDs in the manifest (coverage transparency — the v3 LLM arm is session-bound). */
  manualRuleIds: string[];
}

/** Injectable runner for the v3 structural arm (default spawns vitest on principle 02). */
export type StructuralRunner = (repoRoot: string, run: typeof runCheck) => StructuralArmResult;

export interface FullSweepOptions {
  /** Repo root for manifest + workflow + script resolution (injectable for tests). */
  repoRoot?: string;
  /** Pre-parsed manifest (injectable for tests; default: read from disk). */
  manifest?: Record<string, ManifestRule & CmdScriptRule>;
  /** Subprocess primitive (injectable for tests). Defaults to runCheck. */
  runCheckFn?: typeof runCheck;
  /** v3 structural arm runner (injectable for tests). Default: principle 02 via vitest. */
  structuralRunner?: StructuralRunner;
}

/**
 * Default v3 structural arm: delegate to principle 02 (the SSOT for pressure-scenario /
 * negative-test / fixture well-formedness) run as a subprocess. We do NOT duplicate the
 * well-formedness assertions here — v2 orchestrates, it does not re-implement (T5).
 */
function defaultStructuralRunner(repoRoot: string, run: typeof runCheck): StructuralArmResult {
  const coreDir = resolve(repoRoot, 'packages/core');
  const r = run(
    'npx',
    ['vitest', 'run', '--reporter=dot', 'principles/02-paired-negative-test.test.ts'],
    { cwd: coreDir, timeoutMs: 180_000 },
  );
  if (r.notFound) {
    return {
      passed: false,
      output: '',
      reason: "vitest not available — run `npm ci` at the repo root before the full-sweep",
    };
  }
  if (r.timedOut) {
    return { passed: false, output: (r.stdout + r.stderr).trim(), reason: 'principle 02 timed out' };
  }
  return {
    passed: r.exitCode === 0,
    output: (r.stdout + r.stderr).trim(),
    reason: r.exitCode === 0 ? undefined : `principle 02 exited ${r.exitCode}`,
  };
}

/** Enumerate every rule of a given check.type from the manifest. */
function ruleIdsByType(
  manifest: Record<string, { check?: { type?: string } }>,
  types: string[],
): string[] {
  return Object.keys(manifest).filter(
    (k) => manifest[k] && manifest[k].check && types.includes(manifest[k].check!.type ?? ''),
  );
}

/**
 * Run the full-sweep over every rule in the manifest. The two TS arms are pure
 * (no git); the structural arm shells out to principle 02 via run-check.
 */
export function runFullSweep(opts: FullSweepOptions = {}): FullSweepReport {
  const repoRoot = opts.repoRoot ?? DEFAULT_REPO_ROOT;
  const run = opts.runCheckFn ?? runCheck;
  const manifest =
    opts.manifest ??
    (JSON.parse(readFileSync(resolve(repoRoot, MANIFEST_REL), 'utf8')) as Record<
      string,
      ManifestRule & CmdScriptRule
    >);

  const eslintIds = ruleIdsByType(manifest, ['eslint']);
  const cmdScriptIds = ruleIdsByType(manifest, ['command', 'script']);
  const manualRuleIds = ruleIdsByType(manifest, ['manual']);

  const eslint = runGuardLivenessCheck(eslintIds, manifest);
  const cmdScript = runCmdScriptLivenessCheck(cmdScriptIds, manifest, { repoRoot, runCheckFn: run });
  const structuralRunner = opts.structuralRunner ?? defaultStructuralRunner;
  const structural = structuralRunner(repoRoot, run);

  return { eslint, cmdScript, structural, manualRuleIds };
}

/**
 * The gate verdict. FAIL iff a guard failed to catch its own violation OR the
 * structural arm failed. skip / no-data / exempt are tolerated (reported, not failed).
 */
export function hasFailures(report: FullSweepReport): boolean {
  return (
    report.eslint.failures.length > 0 ||
    report.cmdScript.failures.length > 0 ||
    !report.structural.passed
  );
}

/** Human-readable report with explicit per-arm coverage counts (T14). */
export function formatReport(report: FullSweepReport): string {
  const { eslint, cmdScript, structural, manualRuleIds } = report;
  const lines: string[] = [];
  lines.push('═══ guard-liveness FULL-SWEEP (last-resort backstop, PRs → main) ═══');

  // v1 — ESLint arm
  lines.push(
    `\n▸ v1 ESLint arm: ${eslint.passed.length} passed, ${eslint.failures.length} FAILED, ` +
      `${eslint.skipped.length} skipped, ${eslint.noData.length} no-data`,
  );
  for (const s of eslint.skipped) lines.push(`    ℹ SKIP ${s}`);
  for (const id of eslint.noData) lines.push(`    ⚠ ${id}: no negative-test data`);
  for (const f of eslint.failures) {
    lines.push(`    ❌ ${f.ruleId}:`);
    for (const m of f.failures) lines.push(`        - ${m}`);
  }

  // v1.5 — cmd/script arm
  lines.push(
    `\n▸ v1.5 cmd/script arm: ${cmdScript.passed.length} passed, ${cmdScript.failures.length} FAILED, ` +
      `${cmdScript.skipped.length} skipped, ${cmdScript.exempt.length} exempt, ${cmdScript.noData.length} no-data`,
  );
  for (const s of cmdScript.skipped) lines.push(`    ℹ SKIP ${s}`);
  for (const e of cmdScript.exempt) lines.push(`    ℹ EXEMPT ${e}`);
  for (const nd of cmdScript.noData) lines.push(`    ⚠ ${nd}`);
  for (const f of cmdScript.failures) {
    lines.push(`    ❌ ${f.ruleId} [${f.mode ?? 'unknown'}]:`);
    for (const m of f.failures) lines.push(`        - ${m}`);
  }

  // v3 — structural arm (manual pressure-scenarios via principle 02; LLM probe is session-bound)
  lines.push(
    `\n▸ v3 structural arm (principle 02 — manifest well-formedness incl. ${manualRuleIds.length} manual ` +
      `pressure-scenarios): ${structural.passed ? '✅ passed' : '❌ FAILED'}` +
      (structural.reason ? ` — ${structural.reason}` : ''),
  );
  lines.push(
    `    ℹ the manual RED→GREEN LLM probe (agents/manual-rule-liveness-prober.md) is session-bound ` +
      `(no-paid-llm-in-ci); CI covers the deterministic structural arm only.`,
  );
  if (!structural.passed && structural.output) {
    lines.push(`    ${structural.output.split('\n').slice(-12).join('\n    ')}`);
  }

  lines.push(
    `\n${hasFailures(report) ? '❌ FULL-SWEEP FAILED' : '✅ FULL-SWEEP GREEN'} — ` +
      'a FAILED arm means a guard did not catch its own violation (guard-rot). ' +
      'skip/no-data/exempt are tolerated; review the counts above for coverage drift.',
  );
  return lines.join('\n');
}

/** CLI entry: run the sweep, print the report + a machine-readable JSON line, exit. */
function main(): void {
  const report = runFullSweep();
  process.stdout.write(formatReport(report) + '\n');
  // Machine-readable summary (kickoff §2.2 "JSON report").
  const json = {
    failed: hasFailures(report),
    eslint: {
      passed: report.eslint.passed.length,
      failed: report.eslint.failures.length,
      skipped: report.eslint.skipped.length,
      noData: report.eslint.noData.length,
    },
    cmdScript: {
      passed: report.cmdScript.passed.length,
      failed: report.cmdScript.failures.length,
      skipped: report.cmdScript.skipped.length,
      exempt: report.cmdScript.exempt.length,
      noData: report.cmdScript.noData.length,
    },
    structural: { passed: report.structural.passed },
    manualRules: report.manualRuleIds.length,
  };
  process.stdout.write('\nFULLSWEEP_JSON=' + JSON.stringify(json) + '\n');
  process.exit(hasFailures(report) ? 1 : 0);
}

// Run only when invoked directly (not when imported by the test or another module).
if (isDirectRun(process.argv[1], import.meta.url)) {
  main();
}
