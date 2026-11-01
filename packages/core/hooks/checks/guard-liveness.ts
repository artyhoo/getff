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
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
  /** Infrastructure error (git/IO/rule crash) — the caller MUST fail closed on this. */
  error?: string;
}

/** Lint the given files (repo-relative) with the Q1/Q2 rules. Pure w.r.t. the FS reads. */
export function runTestQualityLiveness(files: string[]): TestQualityLivenessResult {
  const result: TestQualityLivenessResult = { files: [], violations: [], nonLintable: [] };
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
    result.files.push(file);
    let source: string;
    try {
      source = readFileSync(resolve(REPO_ROOT, file), 'utf8');
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

/** Changed files vs a base (merge-base diff), as pre-push's change scope defines it. */
export function getChangedFilesVsBase(base: string): { files: string[]; error?: string } {
  const diff = runCheck('git', ['diff', '--name-only', '--diff-filter=ACMR', `${base}...HEAD`], {
    cwd: REPO_ROOT,
  });
  if (diff.exitCode !== 0) {
    return { files: [], error: `git diff failed for base '${base}': ${diff.stderr.trim()}` };
  }
  return { files: diff.stdout.split('\n').map((s) => s.trim()).filter(Boolean) };
}

/**
 * The arm at the pre-push invocation: change-scope → Q1/Q2 lint of changed test files.
 * Returns null when there is nothing to report (no test-bearing change, no violation);
 * a GuardLivenessFailure when the lint found violations or hit an infrastructure error.
 */
export function runTestQualityGate(base: string): GuardLivenessFailure | null {
  const { files, error: diffError } = getChangedFilesVsBase(base);
  if (diffError) return { ruleId: TEST_QUALITY_FAILURE_RULE_ID, failures: [diffError] };
  const result = runTestQualityLiveness(files);
  if (result.error) return { ruleId: TEST_QUALITY_FAILURE_RULE_ID, failures: [result.error] };
  if (result.violations.length === 0) return null;
  return { ruleId: TEST_QUALITY_FAILURE_RULE_ID, failures: result.violations };
}
