/**
 * guard-liveness.ts — Change-scoped ESLint guard-liveness check (Wave guard-liveness v1).
 *
 * Channel: pre-push (liveness — runs ESLint roundtrip).
 * Pre-commit structural check (non-empty input array) lives in .husky/pre-commit.
 *
 * @channel pre-push gate
 * @dual-pair: guard-liveness-eslint
 * @cc-only-rationale: the TypeScript pre-push gate is the primary channel; a portable
 *   agent-prompt form is planned as v3 (manual rules via Superpowers companion).
 *
 * Reuses the ESLint roundtrip logic from validator/gate-rule-tester.ts: the same
 * `Linter`, `buildSingleRuleConfig`, and `matches` pattern — wrapped for manifest
 * rules rather than synthesized rules. T16 problem-class verified: both check that
 * code input → violation; difference is the source (synthesizer plan vs. manifest).
 *
 * Plugin registry covers the rules-as-tests namespace from both packages:
 *   - packages/core/eslint-rules: R2/R7/R8
 *   - packages/preset-next-15-canonical/eslint-rules: R12/R14/R20
 *
 * Rules using unavailable plugins (R5 @typescript-eslint, R15 jsx-a11y, R16 @next/next)
 * are skipped with a visible SKIP notice — not failures. The check captures the intent;
 * install the plugin to enable full coverage.
 */

import { Linter } from 'eslint';
import * as tseslintParser from '@typescript-eslint/parser';
import corePlugin from '../../eslint-rules/index.ts';
// Package-name import — same style as the validator precedents
// (gate-rule-tester.ts / gate-conflict.ts / gate-tautology.ts). This module is
// lazily imported by pre-push.ts (guardLivenessSection), so the workspace
// symlink + the preset's own deps (@typescript-eslint/utils) are only required
// when the gate actually runs — i.e. after a root-level install.
import presetPlugin from '@rules-as-tests/preset-next-15-canonical/eslint-rules';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute as pathIsAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { runCheck } from '../utils/run-check.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../../..');
const MANIFEST_PATH = resolve(REPO_ROOT, 'packages/core/manifest/rules-manifest.json');

/** Merged plugin providing all rules-as-tests/* rules (core + preset). */
const KNOWN_PLUGINS: Record<string, unknown> = {
  'rules-as-tests': {
    meta: { name: '@rules-as-tests/all', version: '0.1.0' },
    rules: {
      ...corePlugin.rules,
      ...presetPlugin.rules,
    },
  },
};

/** Extract the ESLint plugin namespace from a rule name, or null for built-in rules. */
function getPluginKey(ruleName: string): string | null {
  if (!ruleName.includes('/')) return null; // built-in (e.g. no-throw-literal)
  if (ruleName.startsWith('@')) {
    const parts = ruleName.split('/');
    // 3 parts = scoped plugin with sub-name (@next/next/no-img-element → @next/next);
    // 2 parts = scope IS the plugin (@typescript-eslint/no-floating-promises → @typescript-eslint).
    return parts.length >= 3 ? `${parts[0]}/${parts[1]}` : parts[0];
  }
  return ruleName.split('/')[0]; // e.g. rules-as-tests, jsx-a11y
}

function buildRuleConfig(ruleName: string, ruleConfig: unknown): Linter.Config[] {
  return [
    {
      files: ['**/*.{ts,tsx,js,jsx}'],
      languageOptions: {
        parser: tseslintParser as Linter.Parser,
        parserOptions: {
          ecmaFeatures: { jsx: true },
          ecmaVersion: 'latest' as const,
          sourceType: 'module' as const,
        },
      },
      plugins: KNOWN_PLUGINS,
      rules: { [ruleName]: ruleConfig as Linter.RuleEntry },
    },
  ] as Linter.Config[];
}

function matchesViolation(
  message: Linter.LintMessage,
  expected: string,
  ruleName: string,
): boolean {
  if (message.messageId === expected) return true;
  if (message.ruleId === expected) return true;
  if (message.ruleId === ruleName) return true;
  return false;
}

export interface ManifestNegativeTest {
  input: string[];
  'expect-violation': string;
  eslintRuleConfig?: unknown;
}

export interface ManifestRule {
  check: { type: string; rule?: string };
  examples: { bad: string; good: string };
  'negative-test'?: ManifestNegativeTest;
}

export type RuleLivenessStatus = 'pass' | 'fail' | 'skipped' | 'no-data' | 'n/a';

export interface RuleLivenessResult {
  status: RuleLivenessStatus;
  reason?: string;
  failures?: string[];
}

export interface GuardLivenessFailure {
  ruleId: string;
  failures: string[];
}

export interface GuardLivenessReport {
  failures: GuardLivenessFailure[];
  skipped: string[];  // rules where plugin not registered
  passed: string[];
  noData: string[];   // ESLint rules without negative-test data
}

/** Run the ESLint roundtrip for a single manifest rule. Pure — no I/O. */
export function runRuleLiveness(ruleId: string, rule: ManifestRule): RuleLivenessResult {
  if (rule.check.type !== 'eslint') return { status: 'n/a' };

  const ruleName = rule.check.rule;
  if (!ruleName) return { status: 'n/a' };

  const nt = rule['negative-test'];
  if (!nt || !Array.isArray(nt.input) || nt.input.length === 0) {
    return { status: 'no-data', reason: 'missing or empty negative-test.input' };
  }

  const pluginKey = getPluginKey(ruleName);
  if (pluginKey !== null && !(pluginKey in KNOWN_PLUGINS)) {
    return {
      status: 'skipped',
      reason: `plugin '${pluginKey}' not registered in KNOWN_PLUGINS — install the plugin to enable liveness check`,
    };
  }

  const ruleConfig = nt.eslintRuleConfig ?? 'error';
  const config = buildRuleConfig(ruleName, ruleConfig);
  const linter = new Linter();
  const failures: string[] = [];

  for (const [idx, input] of nt.input.entries()) {
    const messages = linter.verify(input, config, { filename: 'negative-test.tsx' });
    const matched = messages.some((m) => matchesViolation(m, nt['expect-violation'], ruleName));
    if (!matched) {
      const got = JSON.stringify(messages.map((m) => ({ rule: m.ruleId, messageId: m.messageId })));
      failures.push(
        `input[${idx}] did not produce '${nt['expect-violation']}' for '${ruleName}'; got ${got}`,
      );
    }
  }

  const goodMessages = linter.verify(rule.examples.good, config, { filename: 'example-good.tsx' });
  const goodViolation = goodMessages.find((m) => m.ruleId === ruleName);
  if (goodViolation) {
    failures.push(
      `examples.good produced unexpected violation: rule='${goodViolation.ruleId}' msg='${goodViolation.message}'`,
    );
  }

  if (failures.length > 0) return { status: 'fail', failures };
  return { status: 'pass' };
}

/** Get ESLint rule IDs that changed between the base manifest and the current manifest. */
export function getChangedEslintRuleIds(
  baseManifestJson: string | null,
  currentManifestJson: string,
): string[] {
  const current = JSON.parse(currentManifestJson) as Record<string, ManifestRule>;
  if (!baseManifestJson) {
    return Object.keys(current).filter((k) => current[k].check.type === 'eslint');
  }
  let base: Record<string, ManifestRule>;
  try {
    base = JSON.parse(baseManifestJson) as Record<string, ManifestRule>;
  } catch {
    return Object.keys(current).filter((k) => current[k].check.type === 'eslint');
  }
  const changed: string[] = [];
  for (const [id, rule] of Object.entries(current)) {
    if (rule.check.type !== 'eslint') continue;
    const baseRule = base[id];
    if (!baseRule || JSON.stringify(baseRule) !== JSON.stringify(rule)) {
      changed.push(id);
    }
  }
  return changed;
}

/** Run the guard-liveness check on the given rule IDs against the provided manifest. Pure. */
export function runGuardLivenessCheck(
  ruleIds: string[],
  manifest: Record<string, ManifestRule>,
): GuardLivenessReport {
  const report: GuardLivenessReport = { failures: [], skipped: [], passed: [], noData: [] };
  for (const id of ruleIds) {
    const rule = manifest[id];
    if (!rule) continue;
    const result = runRuleLiveness(id, rule);
    switch (result.status) {
      case 'pass':
        report.passed.push(id);
        break;
      case 'fail':
        report.failures.push({ ruleId: id, failures: result.failures ?? [] });
        break;
      case 'skipped':
        report.skipped.push(`${id}: ${result.reason ?? 'plugin not available'}`);
        break;
      case 'no-data':
        report.noData.push(id);
        break;
      case 'n/a':
        break;
    }
  }
  return report;
}

/**
 * Gate function for pre-push: loads the manifest, determines changed ESLint rules,
 * and runs the liveness check. Reads the base manifest via `git show`.
 * Also runs the S1 test-quality arm (Q1/Q2 lint of changed test-bearing files) at the
 * same invocation — a violation or an infrastructure error lands in `report.failures`.
 */
export function runGuardLivenessGate(base: string): GuardLivenessReport {
  const currentJson = readFileSync(MANIFEST_PATH, 'utf8');
  const baseResult = runCheck('git', ['show', `${base}:packages/core/manifest/rules-manifest.json`], {
    cwd: REPO_ROOT,
  });
  const baseJson = baseResult.exitCode === 0 ? baseResult.stdout : null;
  const changedIds = getChangedEslintRuleIds(baseJson, currentJson);
  const manifest = JSON.parse(currentJson) as Record<string, ManifestRule>;
  const report =
    changedIds.length === 0
      ? { failures: [], skipped: [], passed: [], noData: [] }
      : runGuardLivenessCheck(changedIds, manifest);
  const testQuality = runTestQualityGate(base);
  if (testQuality) report.failures.push(testQuality);
  return report;
}

// ─── Test-quality arm (S1 kernel, Q1/Q2) ─────────────────────────────────────
// Lints CHANGED test-bearing files through the real Q1/Q2 rules at the existing
// pre-push invocation (pre-push.ts already imports this module; no pre-push edit).
// Fail-closed discipline: an infrastructure error (git failure, unreadable file,
// rule crash) is a FAILURE here, never a silent pass — a green exit from a broken
// run is not detection.

/** The two S1 test-quality rules, at the severity the gate enforces. */
export const TEST_QUALITY_RULES = ['no-vacuous-assertion', 'require-effective-assertion'] as const;

export const TEST_QUALITY_FAILURE_RULE_ID = 'test-quality (Q1/Q2) changed-file lint';

/** Decidable path test: `*.test.*` / `*.spec.*`, or a `tests/` / `__tests__/` segment. */
export function isTestBearingPath(path: string): boolean {
  if (/\.(test|spec|unit|audit|integration)\.[cm]?[jt]sx?$/.test(path)) return true;
  return /(^|\/)(tests|__tests__)\//.test(path);
}

export interface TestQualityLivenessResult {
  /** The selection actually linted — a run that linted nothing is not a detection run. */
  files: string[];
  /** Per-file violations, verbatim ESLint messages. */
  violations: string[];
  /** Selected test-bearing paths outside the lintable extension set (e.g. tests/*.md) —
   *  recorded, never silently clean (D011 S1-R2 selector/carrier companion). */
  nonLintable: string[];
  /** Selected test-bearing inputs recognized as the canonical frozen intentional-fixture
   *  SOURCE inputs (Root exact-30 projection below) — reported distinctly as intentional
   *  SOURCE, never counted as linted/detected/live-passing. No-detection semantics: a file
   *  here is NOT linted and NOT evidence of Q1/Q2 liveness. */
  sourceClassified: string[];
  /** Infrastructure error (git/IO/rule crash) — the caller MUST fail closed on this. */
  error?: string;
}

// ─── Frozen intentional-fixture SOURCE role (unit 46, Root exact-30) ─────────
// ADAPT of the existing canonical S2 intentional-fixture SOURCE classification
// (SSOT #317 + Root inputs 3683be5e…): the exact 30 already-declared SOURCE
// tuples — 26 population fixtures (expectations-recovery population_manifest,
// byte-equal to the glv-probe FREEZE) + 4 r4-runner source lanes — projected as
// a FINITE IMMUTABLE map. This is a projection of existing Root-admitted data,
// not an author-maintained or caller-extendable registry: nothing outside these
// exact path+bytes pairs can ever inherit SOURCE status, and callers have no
// boolean/role/pattern authority over it. The Q1/Q2 rules, the inline config,
// the coveredSuffixes fail-closed arm and the selector semantics are untouched.
// Same bad bytes at TARGET (recovery-d011-population/**) or any ordinary live
// path are STILL linted — the role binds to the exact canonical path+bytes, so
// the recovery oracle's TARGET detection expectations keep firing.

/** The two SOURCE stores — the only prefixes where SOURCE recognition may apply.
 *  Runtime-immutable (unit 47 repair #4): `as const` is a TypeScript-only fiction;
 *  Object.freeze makes the projection unwritable at runtime, so no caller can add
 *  a store prefix, extend the tuple, or rebind either export. */
export const FROZEN_SOURCE_STORES = Object.freeze([
  'scripts/test-assurance/recovery-d011/fixtures/population',
  'scripts/test-assurance/recovery-d011/fixtures/r4-runner',
] as const);

/** Exact canonical repo-relative path → sha256 of the Root-admitted frozen bytes.
 *  Runtime-immutable (unit 47 repair #4): a caller can neither add an unknown
 *  path/hash pair nor modify a canonical pin to make its own bytes admissible. */
export const FROZEN_SOURCE_SHA256: Readonly<Record<string, string>> = Object.freeze({
  'scripts/test-assurance/recovery-d011/fixtures/population/__tests__/bad.vacuous-dir.ts': 'ae09efd0c6dae2d2816b1e476dc117bbdb52ab507fd481022e91973e64221fe2',
  'scripts/test-assurance/recovery-d011/fixtures/population/__tests__/good.assertive-dir.ts': '3a07373d19969577ff81cf516451e0dd61c06dcf95fc940f2d2be8b9332d5003',
  'scripts/test-assurance/recovery-d011/fixtures/population/bad.vacuous.audit.ts': 'ae09efd0c6dae2d2816b1e476dc117bbdb52ab507fd481022e91973e64221fe2',
  'scripts/test-assurance/recovery-d011/fixtures/population/bad.vacuous.integration.ts': 'ae09efd0c6dae2d2816b1e476dc117bbdb52ab507fd481022e91973e64221fe2',
  'scripts/test-assurance/recovery-d011/fixtures/population/bad.vacuous.spec.mjs': 'ae09efd0c6dae2d2816b1e476dc117bbdb52ab507fd481022e91973e64221fe2',
  'scripts/test-assurance/recovery-d011/fixtures/population/bad.vacuous.test.cjs': 'be847625874b518218536e240584d9dd587d05aa9006366612b0fed9c64acb67',
  'scripts/test-assurance/recovery-d011/fixtures/population/bad.vacuous.test.cts': 'ae09efd0c6dae2d2816b1e476dc117bbdb52ab507fd481022e91973e64221fe2',
  'scripts/test-assurance/recovery-d011/fixtures/population/bad.vacuous.test.js': 'ae09efd0c6dae2d2816b1e476dc117bbdb52ab507fd481022e91973e64221fe2',
  'scripts/test-assurance/recovery-d011/fixtures/population/bad.vacuous.test.jsx': 'ae09efd0c6dae2d2816b1e476dc117bbdb52ab507fd481022e91973e64221fe2',
  'scripts/test-assurance/recovery-d011/fixtures/population/bad.vacuous.test.mjs': 'ae09efd0c6dae2d2816b1e476dc117bbdb52ab507fd481022e91973e64221fe2',
  'scripts/test-assurance/recovery-d011/fixtures/population/bad.vacuous.test.mts': 'ae09efd0c6dae2d2816b1e476dc117bbdb52ab507fd481022e91973e64221fe2',
  'scripts/test-assurance/recovery-d011/fixtures/population/bad.vacuous.test.ts': 'ae09efd0c6dae2d2816b1e476dc117bbdb52ab507fd481022e91973e64221fe2',
  'scripts/test-assurance/recovery-d011/fixtures/population/bad.vacuous.test.tsx': 'ae09efd0c6dae2d2816b1e476dc117bbdb52ab507fd481022e91973e64221fe2',
  'scripts/test-assurance/recovery-d011/fixtures/population/bad.vacuous.unit.ts': 'ae09efd0c6dae2d2816b1e476dc117bbdb52ab507fd481022e91973e64221fe2',
  'scripts/test-assurance/recovery-d011/fixtures/population/good.assertive.audit.ts': '3a07373d19969577ff81cf516451e0dd61c06dcf95fc940f2d2be8b9332d5003',
  'scripts/test-assurance/recovery-d011/fixtures/population/good.assertive.integration.ts': '3a07373d19969577ff81cf516451e0dd61c06dcf95fc940f2d2be8b9332d5003',
  'scripts/test-assurance/recovery-d011/fixtures/population/good.assertive.spec.mjs': '31de17200a3409736d21d0b03076b6a7204a3fd414fea9e0193efc2df2358571',
  'scripts/test-assurance/recovery-d011/fixtures/population/good.assertive.test.cjs': '447b746f4a0bc807bfc6647b609f730eaad2107cdcb041ecfda29f7bcfaae197',
  'scripts/test-assurance/recovery-d011/fixtures/population/good.assertive.test.cts': '3a07373d19969577ff81cf516451e0dd61c06dcf95fc940f2d2be8b9332d5003',
  'scripts/test-assurance/recovery-d011/fixtures/population/good.assertive.test.js': '31de17200a3409736d21d0b03076b6a7204a3fd414fea9e0193efc2df2358571',
  'scripts/test-assurance/recovery-d011/fixtures/population/good.assertive.test.jsx': '31de17200a3409736d21d0b03076b6a7204a3fd414fea9e0193efc2df2358571',
  'scripts/test-assurance/recovery-d011/fixtures/population/good.assertive.test.mjs': '31de17200a3409736d21d0b03076b6a7204a3fd414fea9e0193efc2df2358571',
  'scripts/test-assurance/recovery-d011/fixtures/population/good.assertive.test.mts': '3a07373d19969577ff81cf516451e0dd61c06dcf95fc940f2d2be8b9332d5003',
  'scripts/test-assurance/recovery-d011/fixtures/population/good.assertive.test.ts': '3a07373d19969577ff81cf516451e0dd61c06dcf95fc940f2d2be8b9332d5003',
  'scripts/test-assurance/recovery-d011/fixtures/population/good.assertive.test.tsx': '3a07373d19969577ff81cf516451e0dd61c06dcf95fc940f2d2be8b9332d5003',
  'scripts/test-assurance/recovery-d011/fixtures/population/good.assertive.unit.ts': '3a07373d19969577ff81cf516451e0dd61c06dcf95fc940f2d2be8b9332d5003',
  'scripts/test-assurance/recovery-d011/fixtures/r4-runner/healthy.test.ts': 'a7ee1b5ab2baeb5f7610854f618a7b3b416d5a955699324bd3f27725b277077b',
  'scripts/test-assurance/recovery-d011/fixtures/r4-runner/intended-fail.test.ts': '22255207e7b6569454cb2f0928c545b693ef35b455b549c6a239fa877802a050',
  'scripts/test-assurance/recovery-d011/fixtures/r4-runner/skipped.test.ts': '44768dd4c3c17af000c3e622c8bf42aa14ccbdd31c25cd9c8091641bc5525e36',
  'scripts/test-assurance/recovery-d011/fixtures/r4-runner/unhandled.test.ts': '3c720c8e562121acc117ee352ef89427b14f006ac83fa5b5c776b828a8a96798',
});

/** Outcome of the frozen-SOURCE role probe for one selected path. */
export type FrozenSourceClassification =
  | { status: 'not-in-store' }
  | { status: 'unknown-in-store' }
  | { status: 'known-source' }
  | { status: 'refused'; reason: string };

/**
 * Classify one repo-relative selected path against the frozen SOURCE role.
 * Fail-closed contract (Root unit-46 brief §A):
 * - a path outside both SOURCE stores is `not-in-store` (ordinary lint lane —
 *   the original selector/extension/config semantics apply unchanged);
 * - a path inside a store but absent from the exact-30 map is `unknown-in-store`:
 *   detected, NEVER immune — the gate lane (runTestQualityLiveness) treats it as a
 *   HARD failure (unit 47 repair #2): a selected test-bearing input inside either
 *   SOURCE store that is not one of the exact 30 refuses, healthy or bad bytes
 *   alike, because store prefixes detect unknowns, they never authorize them;
 * - an exact-30 path is `known-source` ONLY when the live entry is a regular
 *   non-executable file, not a symlink (self or any parent link), canonically
 *   contained in the store, readable, and byte-identical to the frozen sha256;
 * - anything else (symlink, traversal/absolute/noncanonical alias, escape,
 *   missing/unreadable, executable mode, byte mismatch) is `refused` — the
 *   caller must fail closed on it, never silently skip or fall back to clean.
 *
 * `rootDir` is injectable for the scratch-root test lane; production callers
 * use the module's REPO_ROOT default. The refused branch does NOT read
 * arbitrary escaped targets: containment is proven before the single read.
 */
export function classifyFrozenSourceInput(relPath: string, rootDir: string = REPO_ROOT): FrozenSourceClassification {
  const store = FROZEN_SOURCE_STORES.find((s) => relPath === s || relPath.startsWith(`${s}/`));
  if (!store) return { status: 'not-in-store' };
  // Noncanonical alias forms are refused outright — only the exact canonical
  // repo-relative spelling may even be CONSIDERED for the role (before the map
  // lookup, so a traversal twin of a known name never reads as a mere unknown).
  if (pathIsAbsolute(relPath) || relPath.includes('\\') || relPath.includes('\0') || /(^|\/)\.\.?(\/|$)/.test(relPath)) {
    return { status: 'refused', reason: 'noncanonical path form (absolute, backslash, NUL, or dot-segment alias)' };
  }
  const expected = FROZEN_SOURCE_SHA256[relPath];
  if (!expected) return { status: 'unknown-in-store' };
  // Lexical store containment BEFORE any read: a traversal alias that resolves
  // outside its store is refused without reading whatever it points at.
  const storeAbs = resolve(rootDir, store);
  const abs = resolve(rootDir, relPath);
  if (abs !== storeAbs && !abs.startsWith(`${storeAbs}/`)) {
    return { status: 'refused', reason: 'path traversal or alias escaping the SOURCE store' };
  }
  // Full canonicalization: the file's real position, expressed relative to the
  // REAL root, must equal the exact frozen repo-relative spelling. This single
  // equality refuses self-symlinks, every symlinked ancestor (parent links)
  // and any alias surviving the lexical checks — including when rootDir itself
  // carries symlink components (macOS /tmp, /var), because both sides are
  // canonicalized through the same rootReal.
  let rootReal: string;
  let real: string;
  try {
    rootReal = realpathSync(rootDir);
    real = realpathSync(abs);
  } catch (err) {
    return { status: 'refused', reason: `missing or unreadable: ${(err as Error).message}` };
  }
  if (relative(rootReal, real) !== relPath) {
    return { status: 'refused', reason: 'parent-link or noncanonical alias on SOURCE path' };
  }
  let st: ReturnType<typeof lstatSync>;
  try {
    st = lstatSync(abs);
  } catch (err) {
    return { status: 'refused', reason: `missing or unreadable: ${(err as Error).message}` };
  }
  if (st.isSymbolicLink()) return { status: 'refused', reason: 'symlink at SOURCE path' };
  if (!st.isFile()) return { status: 'refused', reason: `not a regular file (mode ${st.mode.toString(8)})` };
  // Regular non-executable 100644/blob identity: the executable bit is the Git
  // mode discriminator (0600 vs 0644 is NOT a mode change and stays accepted).
  if (st.mode & 0o111) return { status: 'refused', reason: `executable mode ${st.mode.toString(8)} is not the frozen 100644 identity` };
  let bytes: Buffer;
  try {
    bytes = readFileSync(abs);
  } catch (err) {
    return { status: 'refused', reason: `unreadable: ${(err as Error).message}` };
  }
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== expected) {
    return { status: 'refused', reason: `byte mismatch (live sha256 ${actual}, frozen ${expected})` };
  }
  return { status: 'known-source' };
}

/** Lint the given files (repo-relative) with the Q1/Q2 rules. Pure w.r.t. the FS reads.
 *  `rootDir` is injectable for the owned scratch-root test lane (same seam the
 *  classifier exposes); production callers use the module's REPO_ROOT default. */
export function runTestQualityLiveness(files: string[], rootDir: string = REPO_ROOT): TestQualityLivenessResult {
  const result: TestQualityLivenessResult = { files: [], violations: [], nonLintable: [], sourceClassified: [] };
  const rules = Object.fromEntries(
    TEST_QUALITY_RULES.map((r) => [`rules-as-tests/${r}`, 'error' as const]),
  );
  const config: Linter.Config[] = [
    {
      // Explicit extension globs — a files-less flat-config block defaults to `**/*.mjs`
      // only, and `**/*` does not match nested `.ts` paths (ESLint 10 Linter semantics;
      // measured 2026-10-08). Silent no-match on `.ts` would hollow out the arm.
      // Brace form (D011 S1-R2): this set is exactly the extension population
      // isTestBearingPath can select — .mts/.cts included, no silent hole.
      files: ['**/*.{ts,tsx,mts,cts,mjs,cjs,js,jsx}'],
      languageOptions: {
        parser: tseslintParser as Linter.Parser,
        parserOptions: {
          ecmaFeatures: { jsx: true },
          ecmaVersion: 'latest' as const,
          sourceType: 'module' as const,
        },
      },
      // Runtime-valid plugins; the RuleModule-vs-RuleDefinition structural mismatch is
      // an @typescript-eslint/utils typing artifact, cast here like the neighbors above.
      plugins: KNOWN_PLUGINS as unknown as NonNullable<Linter.Config['plugins']>,
      rules: rules as Linter.RulesRecord,
    },
  ];
  // Fail-closed cover check (D011 S1-R2, amended-1 F1): a selected test-bearing file
  // matched by NO config block lints to zero messages and would read as clean — the
  // gate refuses that state instead of trusting it. Derivation MATCHES the config's own
  // files globs: a trailing `.{alt,alt}` brace list expands against the stem dot
  // (verified: yields .ts .tsx .mts .cts .mjs .cjs .js .jsx for the line above); a plain
  // extension glob contributes its suffix. Any future selector/carrier divergence is a
  // failure, never a silent bypass.
  const coveredSuffixes: string[] = [];
  for (const block of config) {
    const globs: string[] = Array.isArray(block.files) ? (block.files as string[]) : [];
    for (const glob of globs) {
      const brace = glob.match(/\.\{([^}]+)\}$/);
      if (brace) {
        const stem = glob.slice(0, glob.lastIndexOf('{'));
        const dot = stem.lastIndexOf('.') === -1 ? '' : stem.slice(stem.lastIndexOf('.'));
        for (const ext of brace[1].split(',')) coveredSuffixes.push(`${dot}${ext.trim()}`);
      } else if (glob.includes('.')) {
        coveredSuffixes.push(glob.slice(glob.lastIndexOf('.')));
      }
    }
  }
  const LINTABLE = /^\.[cm]?[jt]sx?$/;
  const linter = new Linter();
  for (const file of files) {
    if (!isTestBearingPath(file)) continue;
    const fileExt = file.slice(file.lastIndexOf('.'));
    if (!LINTABLE.test(fileExt)) {
      result.nonLintable.push(file); // dir-selected non-lintable (e.g. tests/*.md): recorded, never silently clean
      continue;
    }
    if (!coveredSuffixes.some((s) => s === fileExt)) {
      result.error = `no test-quality configuration covers selected file '${file}' (D011 S1-R2 fail-closed) — a selected-but-unmatched test file is never silently clean`;
      return result;
    }
    // Frozen intentional-fixture SOURCE role (unit 46/47): the exact-30 canonical
    // SOURCE inputs are classified as intentional SOURCE and NEVER linted or
    // counted as detected/live-passing; every refusal below is an infrastructure
    // FAILURE (fail-closed), never a silent skip or a fall-back-to-clean. A
    // `not-in-store` verdict falls through to the ordinary lint lane unchanged.
    // An `unknown-in-store` verdict is a HARD failure (unit 47 repair #2): a
    // selected test-bearing input inside either SOURCE store that is not one of
    // the exact 30 refuses — healthy or bad bytes alike — because the store
    // prefixes detect unknowns, they never authorize them.
    const sourceRole = classifyFrozenSourceInput(file, rootDir);
    if (sourceRole.status === 'refused') {
      result.error = `frozen SOURCE input '${file}' refused: ${sourceRole.reason}`;
      return result;
    }
    if (sourceRole.status === 'unknown-in-store') {
      result.error = `selected test-bearing input '${file}' inside a frozen SOURCE store is not part of the canonical exact-30 projection — unknown SOURCE-store inputs are a hard failure, never silently linted or immune`;
      return result;
    }
    if (sourceRole.status === 'known-source') {
      result.sourceClassified.push(file);
      continue;
    }
    result.files.push(file);
    let source: string;
    try {
      source = readFileSync(resolve(rootDir, file), 'utf8');
    } catch (err) {
      result.error = `unreadable changed test file '${file}': ${(err as Error).message}`;
      return result;
    }
    let messages: Linter.LintMessage[];
    try {
      messages = linter.verify(source, config, { filename: file });
    } catch (err) {
      result.error = `ESLint crashed on '${file}': ${(err as Error).message}`;
      return result;
    }
    for (const m of messages) {
      if (m.fatal) {
        result.error = `parse error in changed test file '${file}': ${m.message}`;
        return result;
      }
      if (m.ruleId && TEST_QUALITY_RULES.some((r) => m.ruleId === `rules-as-tests/${r}`)) {
        result.violations.push(`${file}:${m.line} [${m.ruleId}] ${m.message}`);
      }
    }
  }
  return result;
}

/** Changed files vs a base (merge-base diff), as pre-push's change scope defines it.
 *  NUL-delimited (unit 47 repair #3): `git diff -z` emits exact raw filenames with
 *  no quoting and no octal escaping (the non-`-z` form quotes non-ASCII paths as
 *  `"\302\247..."`, which a newline split would hand to the classifier verbatim),
 *  and the split keeps each name end to end — no trim, so leading/trailing
 *  whitespace in a committed filename survives as its own distinct identity and
 *  can never collapse onto a known SOURCE spelling. runCheck preserves raw
 *  stdout, so no runner change is needed. */
export function getChangedFilesVsBase(base: string, rootDir: string = REPO_ROOT): { files: string[]; error?: string } {
  // `rootDir` is the minimal filesystem seam (Root unit-47 remainder, same shape the
  // classifier and liveness lanes already expose) so the REAL caller can run against an
  // owned isolated Git fixture in tests; every production call keeps the REPO_ROOT default.
  const diff = runCheck('git', ['diff', '--name-only', '--diff-filter=ACMR', '-z', `${base}...HEAD`], {
    cwd: rootDir,
  });
  if (diff.exitCode !== 0) {
    return { files: [], error: `git diff failed for base '${base}': ${diff.stderr.trim()}` };
  }
  return { files: diff.stdout.split('\0').filter(Boolean) };
}

/**
 * The arm at the pre-push invocation: change-scope → Q1/Q2 lint of changed test files.
 * Returns null when there is nothing to report (no test-bearing change, no violation);
 * a GuardLivenessFailure when the lint found violations or hit an infrastructure error.
 */
export function runTestQualityGate(base: string, rootDir: string = REPO_ROOT): GuardLivenessFailure | null {
  // `rootDir` threads the same minimal filesystem seam through caller → liveness so the
  // REAL gate runs consistently against an owned fixture root; production callers keep
  // the REPO_ROOT default (runGuardLivenessGate calls this with base only).
  const { files, error: diffError } = getChangedFilesVsBase(base, rootDir);
  if (diffError) return { ruleId: TEST_QUALITY_FAILURE_RULE_ID, failures: [diffError] };
  const result = runTestQualityLiveness(files, rootDir);
  if (result.error) return { ruleId: TEST_QUALITY_FAILURE_RULE_ID, failures: [result.error] };
  if (result.violations.length === 0) return null;
  return { ruleId: TEST_QUALITY_FAILURE_RULE_ID, failures: result.violations };
}
