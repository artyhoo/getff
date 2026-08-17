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
import {
  degradeFor,
  gateOutcome,
  isUnresolvablePluginRule,
  knownPlugins,
  resolvePluginRegistry,
  type PluginRegistry,
  type PresetResolutionOptions,
} from './preset-plugin-resolver.ts';
import {
  ESLINT_RESTRICTED_RULE_NAME,
  declarativeRestrictedConfigEntry,
  extractDeclarativeRuleConfigFromSnippet,
} from '../synthesizer/compile-declarative-md.ts';
import type { SynthesisPlan, SynthesizedRule } from '../synthesizer/types.ts';
import type { GateDegrade, GateFailure, GateOutcome } from './types.ts';

// `rules-as-tests` unions core (the exempt-aware wrapper) + preset (handwritten) rules,
// matching the single barrel a consumer receives from install.sh — resolved dynamically
// (preset-plugin-resolver.ts), barrel first, then the workspace packages, then degrade.
function buildSingleRuleConfig(
  ruleName: string,
  ruleConfig: unknown,
  registry: PluginRegistry,
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
      plugins: knownPlugins(registry),
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
  registry: PluginRegistry,
  degraded: GateDegrade[],
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
  // Linting an unregistered plugin rule throws inside linter.verify ("Could not find
  // plugin") — record the skip instead of crashing the shipped bin.
  if (isUnresolvablePluginRule(ruleName, registry)) {
    degraded.push(degradeFor('autofixClean', ruleName, registry, rule.id));
    return { hadFixer: false };
  }
  // Declarative rules are tested in ISOLATION against their OWN emitted entry (see
  // gate-rule-tester) — not the whole merged snippet.
  const ruleConfig =
    rule.check.type === 'declarative'
      ? (extractDeclarativeRuleConfigFromSnippet(
          parsedSnippet,
          rule.check.selector,
        ) ?? declarativeRestrictedConfigEntry(rule.check))
      : (parsedSnippet[ruleName] ?? 'error');
  const config = buildSingleRuleConfig(ruleName, ruleConfig, registry);
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

export function runAutofixCleanGate(
  plan: SynthesisPlan,
  opts?: PresetResolutionOptions,
): GateOutcome {
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
  const registry = resolvePluginRegistry(opts);
  let anyHadFixer = false;
  const failures: GateFailure[] = [];
  const degraded: GateDegrade[] = [];

  for (const rule of applicableRules) {
    const result = checkRule(rule, parsedSnippet, registry, degraded);
    if (result.hadFixer) {
      anyHadFixer = true;
      failures.push(...result.failures);
    }
  }

  // n/a keeps its meaning — «no rule shipped a fixer» — but only when nothing was skipped:
  // a degraded run cannot know whether the rules it could not lint have fixers.
  if (!anyHadFixer && failures.length === 0 && degraded.length === 0) {
    return { status: 'n/a', failures: [] };
  }
  return gateOutcome(failures, degraded);
}
