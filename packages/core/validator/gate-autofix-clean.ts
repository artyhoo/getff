// L4 Gate 9 — autofix-clean anti-vacuity check.
// Per architecture.md §2.6 anti-vacuity cluster:
// For each eslint or declarative (non-ast-grep) rule, applies ONE pass of
// ESLint's fix patches from examples.bad and re-verifies the result:
//   (a) fixed output must parse (no fatal errors)
//   (b) fixed output must have no same-rule violations remaining
//       (violation removed and no new same-rule violation introduced)
// If no fixable violations are found for a rule → n/a for that rule.
// If all rules are n/a → gate returns n/a (typical for no-restricted-syntax
// forbid rules which have no fixer in the current MVP).
//
// NET-NEW: linter.verifyAndFix is unused elsewhere in synthesizer/validator.
// This gate forward-protects S4/G3b when generated rules gain fixers.
// The BAD adversarial fixture (no-extra-parens on ((x))) proves the gate is
// non-vacuous even though current MVP rules always return n/a per-rule.
//
// Applies to check.type === 'eslint' AND 'declarative' (non-ast-grep).
// ast-grep: explicit deferred-marker per generator-forbid-mvp decision (i).

import { Linter } from 'eslint';
import * as tseslintParser from '@typescript-eslint/parser';
import presetPlugin from '@rules-as-tests/preset-next-15-canonical/eslint-rules';
import corePlugin from '../eslint-rules/index.ts';
import {
  ESLINT_RESTRICTED_RULE_NAME,
  declarativeRestrictedConfigEntry,
  extractDeclarativeRuleConfigFromSnippet,
} from '../synthesizer/compile-declarative-md.ts';
import type { SynthesisPlan, SynthesizedRule } from '../synthesizer/types.ts';
import type { GateFailure, GateOutcome } from './types.ts';

// `rules-as-tests` unions core (the exempt-aware wrapper) + preset (handwritten) rules,
// matching the single barrel a consumer receives from install.sh.
const KNOWN_PLUGINS: Record<string, unknown> = {
  'rules-as-tests': {
    rules: { ...corePlugin.rules, ...presetPlugin.rules },
  },
};

function buildSingleRuleConfig(
  ruleName: string,
  ruleConfig: unknown,
): Linter.Config[] {
  return [
    {
      files: ['**/*.{ts,tsx,js,jsx}'],
      languageOptions: {
        parser: tseslintParser,
        parserOptions: {
          ecmaFeatures: { jsx: true },
          ecmaVersion: 'latest',
          sourceType: 'module',
        },
      },
      plugins: KNOWN_PLUGINS,
      rules: { [ruleName]: ruleConfig as Linter.RuleEntry },
    },
  ] as Linter.Config[];
}

const PARSE_ONLY_CONFIG: Linter.Config[] = [
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      parser: tseslintParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
  },
] as Linter.Config[];

type FixInfo = NonNullable<Linter.LintMessage['fix']>;

function applyOnePatchPass(
  code: string,
  messages: Linter.LintMessage[],
  ruleName: string,
): string | null {
  const fixes = messages
    .filter(
      (m): m is Linter.LintMessage & { fix: FixInfo } =>
        m.ruleId === ruleName && m.fix != null,
    )
    .map((m) => m.fix)
    .sort((a, b) => a.range[0] - b.range[0]);

  if (fixes.length === 0) return null;

  let result = '';
  let lastIndex = 0;
  for (const fix of fixes) {
    if (fix.range[0] < lastIndex) continue;
    result += code.slice(lastIndex, fix.range[0]);
    result += fix.text;
    lastIndex = fix.range[1];
  }
  result += code.slice(lastIndex);
  return result;
}

type RuleCheckResult =
  | { hadFixer: false }
  | { hadFixer: true; failures: GateFailure[] };

function checkRule(
  rule: SynthesizedRule,
  parsedSnippet: Record<string, unknown>,
): RuleCheckResult {
  if (rule.check.type !== 'eslint' && rule.check.type !== 'declarative') {
    return { hadFixer: false };
  }

  if (rule.check.type === 'declarative' && rule.check.engine === 'ast-grep') {
    return {
      hadFixer: true,
      failures: [
        {
          ruleId: rule.id,
          code: 'FF3015',
          reason:
            'ast-grep engine reserved but not wired — deferred per generator-forbid-mvp decision (i)',
        },
      ],
    };
  }

  const ruleName =
    rule.check.type === 'eslint'
      ? rule.check.rule
      : ESLINT_RESTRICTED_RULE_NAME;
  // Declarative rules are tested in ISOLATION against their OWN emitted entry (see
  // gate-rule-tester) — not the whole merged snippet.
  const ruleConfig =
    rule.check.type === 'declarative'
      ? (extractDeclarativeRuleConfigFromSnippet(
          parsedSnippet,
          rule.check.selector,
        ) ?? declarativeRestrictedConfigEntry(rule.check))
      : (parsedSnippet[ruleName] ?? 'error');
  const config = buildSingleRuleConfig(ruleName, ruleConfig);
  const linter = new Linter();

  const messages = linter.verify(rule.examples.bad, config, {
    filename: 'bad-example.tsx',
  });

  const fixedCode = applyOnePatchPass(rule.examples.bad, messages, ruleName);
  if (fixedCode === null) {
    return { hadFixer: false };
  }

  const parseMessages = linter.verify(fixedCode, PARSE_ONLY_CONFIG, {
    filename: 'fixed.tsx',
  });
  const parseErrors = parseMessages.filter((m) => m.fatal);
  if (parseErrors.length > 0) {
    return {
      hadFixer: true,
      failures: [
        {
          ruleId: rule.id,
          code: 'FF3016',
          reason: `autofix-clean: fixer for '${ruleName}' produced unparseable output — ${parseErrors.map((m) => m.message).join('; ')}`,
        },
      ],
    };
  }

  const fixedMessages = linter.verify(fixedCode, config, {
    filename: 'fixed.tsx',
  });
  const remainingViolations = fixedMessages.filter(
    (m) => m.ruleId === ruleName,
  );
  if (remainingViolations.length > 0) {
    return {
      hadFixer: true,
      failures: [
        {
          ruleId: rule.id,
          code: 'FF3017',
          reason: `autofix-clean: fixer for '${ruleName}' left ${remainingViolations.length} violation(s) in fixed output — fix is incomplete or introduces new same-rule violations`,
        },
      ],
    };
  }

  return { hadFixer: true, failures: [] };
}

export function runAutofixCleanGate(plan: SynthesisPlan): GateOutcome {
  const applicableRules = plan.rules.filter(
    (r) => r.check.type === 'eslint' || r.check.type === 'declarative',
  );
  if (applicableRules.length === 0) {
    return { status: 'n/a', failures: [] };
  }

  const parsedSnippet = JSON.parse(plan.eslintConfigSnippet) as Record<
    string,
    unknown
  >;
  let anyHadFixer = false;
  const failures: GateFailure[] = [];

  for (const rule of applicableRules) {
    const result = checkRule(rule, parsedSnippet);
    if (result.hadFixer) {
      anyHadFixer = true;
      failures.push(...result.failures);
    }
  }

  if (!anyHadFixer) {
    return { status: 'n/a', failures: [] };
  }
  return failures.length === 0
    ? { status: 'pass', failures: [] }
    : { status: 'fail', failures };
}
