// L4 Gate 2 — rule-tester roundtrip.
// Per architecture.md §2.6 + Phase 6 retro: each synthesized rule with
// check.type === 'eslint' must be runnable. Gate runs the rule against
// (a) negative-test.input — expects matching violation, (b) examples.good
// — expects no violation. Skip rules with check.type ∈ {manual,command,script}.
//
// Built-in ESLint rules (e.g. no-restricted-imports) are configured directly
// from plan.eslintConfigSnippet. Plugin rules (e.g. rules-as-tests/...) are
// resolved through the @rules-as-tests/preset-next-15-canonical plugin
// registry — explicit map below; v1 covers the one plugin currently emitted
// by recipes (no-server-imports-in-client). Recipe expansion (Phase 8 R12/14/20)
// will add entries here.

import { Linter } from 'eslint';
// Namespace import — @typescript-eslint/parser is CJS and exposes parse/parseForESLint
// directly on the module object. A default import resolves to a wrapped shape under
// tsx/Node ESM interop and silently parses TypeScript syntax as JavaScript (e.g. a
// `: FormData` parameter annotation produces "Unexpected token :"). Phase 8 R14 was
// the first plugin-rule negative-test with TS-only syntax; the default-import shape
// only failed on that case, which is why the fixture tests never tripped.
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

// `plugins` and `parser` types in ESLint 10's flat config are stricter than
// what @typescript-eslint/utils RuleModule and @typescript-eslint/parser
// statically produce. Both are runtime-compatible — cast at the seam.
//
// The `rules-as-tests` namespace unions the core plugin (the exempt-aware wrapper
// the declarative tier emits) with the preset-next-15-canonical plugin (handwritten
// rules for Next.js), and the preset-react-spa plugin (handwritten rules for React SPA,
// including require-error-boundary). A consumer receives all under one barrel
// (install.sh copies core + preset into eslint-rules-local), so the gate must resolve
// the same union — which is exactly what preset-plugin-resolver.ts resolves, barrel first.
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

function matches(
  message: Linter.LintMessage,
  expected: string,
  ruleName: string,
): boolean {
  if (message.messageId === expected) return true;
  if (message.ruleId === expected) return true;
  if (message.ruleId === ruleName) return true;
  return false;
}

function runEslintRoundtrip(
  rule: SynthesizedRule,
  parsedSnippet: Record<string, unknown>,
  registry: PluginRegistry,
  degraded: GateDegrade[],
): GateFailure[] {
  if (rule.check.type !== 'eslint' && rule.check.type !== 'declarative') return [];

  // ast-grep engine is reserved but not wired in S2 — explicit deferred-marker per decision (i)
  if (rule.check.type === 'declarative' && rule.check.engine === 'ast-grep') {
    return [
      {
        ruleId: rule.id,
        code: 'FF3003',
        reason:
          'ast-grep engine reserved but not wired — deferred per generator-forbid-mvp decision (i)',
      },
    ];
  }

  const negativeTest = rule['negative-test'];
  if (!negativeTest) {
    return [
      {
        ruleId: rule.id,
        code: 'FF3004',
        reason:
          'eslint rule has no negative-test (gate 1 catches this; gate 2 cannot run without it)',
      },
    ];
  }
  // eslint type uses check.rule; declarative+eslint-restricted derives the
  // exempt-aware wrapper the synthesizer emits (not the built-in no-restricted-syntax).
  const ruleName =
    rule.check.type === 'eslint'
      ? rule.check.rule
      : ESLINT_RESTRICTED_RULE_NAME;
  // Roundtripping an unregistered plugin rule throws inside linter.verify ("Could not find
  // plugin") — record the skip instead of crashing the shipped bin.
  if (isUnresolvablePluginRule(ruleName, registry)) {
    degraded.push(degradeFor('ruleTester', ruleName, registry, rule.id));
    return [];
  }
  // Declarative rules are tested in ISOLATION against their OWN emitted entry (matched by
  // selector in the merged snippet) — never the whole merged set — so a sibling rule's
  // selector cannot fire on this rule's examples (e.g. R14's good code lacks 'use server',
  // which R20 would flag). Fall back to the spec entry if the rule is not in the snippet.
  const ruleConfig =
    rule.check.type === 'declarative'
      ? (extractDeclarativeRuleConfigFromSnippet(
          parsedSnippet,
          rule.check.selector,
        ) ?? declarativeRestrictedConfigEntry(rule.check))
      : (parsedSnippet[ruleName] ?? 'error');
  const config = buildSingleRuleConfig(ruleName, ruleConfig, registry);
  const linter = new Linter();
  const failures: GateFailure[] = [];

  for (const [idx, input] of negativeTest.input.entries()) {
    const negMessages = linter.verify(input, config, {
      filename: 'negative-test.tsx',
    });
    const negMatched = negMessages.some((m) =>
      matches(m, negativeTest['expect-violation'], ruleName),
    );
    if (!negMatched) {
      failures.push({
        ruleId: rule.id,
        code: 'FF3005',
        reason: `negative-test.input[${idx}] did not produce expected violation '${negativeTest['expect-violation']}' for rule '${ruleName}'; got ${JSON.stringify(
          negMessages.map((m) => ({ rule: m.ruleId, messageId: m.messageId })),
        )}`,
      });
    }
  }

  const posMessages = linter.verify(rule.examples.good, config, {
    filename: 'example-good.tsx',
  });
  const posViolation = posMessages.find((m) => m.ruleId === ruleName);
  if (posViolation) {
    failures.push({
      ruleId: rule.id,
      code: 'FF3006',
      reason: `examples.good produced unexpected violation: rule='${posViolation.ruleId}' message='${posViolation.message}'`,
    });
  }

  // safeForms: KNOWN-SAFE multi-token idioms of the forbidden construct (e.g.
  // Object.prototype.hasOwnProperty.call(o,k), the `x == null` null-check). examples.good
  // cannot carry them — gate-single-token-diff constrains good to ~1 token from bad — so an
  // over-broad selector matching a safe form was previously invisible to every gate (GH #915
  // obs 4). Each safe form must verify violation-free, exactly like examples.good.
  for (const [idx, safeForm] of (rule.examples.safeForms ?? []).entries()) {
    const safeMessages = linter.verify(safeForm, config, {
      filename: `example-safe-form-${idx}.tsx`,
    });
    const safeViolation = safeMessages.find((m) => m.ruleId === ruleName);
    if (safeViolation) {
      failures.push({
        ruleId: rule.id,
        code: 'FF3021',
        reason: `examples.safeForms[${idx}] produced unexpected violation — selector is broader than its rationale (matches a known-safe form): rule='${safeViolation.ruleId}' message='${safeViolation.message}'`,
      });
    }
  }

  return failures;
}

export function runRuleTesterGate(
  plan: SynthesisPlan,
  opts?: PresetResolutionOptions,
): GateOutcome {
  const eslintRules = plan.rules.filter(
    (r) => r.check.type === 'eslint' || r.check.type === 'declarative',
  );
  if (eslintRules.length === 0) {
    return { status: 'n/a', failures: [] };
  }
  const registry = resolvePluginRegistry(opts);
  const parsedSnippet = JSON.parse(plan.eslintConfigSnippet) as Record<
    string,
    unknown
  >;
  const failures: GateFailure[] = [];
  const degraded: GateDegrade[] = [];
  for (const rule of eslintRules) {
    failures.push(
      ...runEslintRoundtrip(rule, parsedSnippet, registry, degraded),
    );
  }
  return gateOutcome(failures, degraded);
}
