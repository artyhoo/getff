// Firing harness runner — MT umbrella S3b PR-1 (npm-eslint-declarative backend).
// Spec: docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md §5.
//
// The RED of TDD for a rendered rule: fires the REAL eslint built-in `no-restricted-syntax`
// rule (borrowed runner — SSOT #154, ADOPT ESLint's own linter, do not reimplement) against
// a code sample and returns the set of ruleIds that reported. Pure over its inputs modulo the
// in-process eslint Linter (no spawn, no fs, no network) — so it unit-tests without a cargo-
// style external toolchain, and the firing test can assert the paired negative/positive.

import { Linter, type Rule } from 'eslint';
// eslint 9 removed the `eslint/rules/<name>` deep-export path; the built-in RuleModule map is
// exposed only through the documented `use-at-your-own-risk` entry point (typed as
// Map<string, Rule.RuleModule>).
import { builtinRules } from 'eslint/use-at-your-own-risk';

export interface NpmFiringContract {
  command: string;
  expectedRuleId: string;
}

/**
 * The built-in ESLint `no-restricted-syntax` RuleModule, borrowed for the firing test
 * (SSOT #154 — ADOPT ESLint's own rule + RuleTester, do not reimplement). Resolved via the
 * documented `use-at-your-own-risk` map because eslint 9 dropped the `eslint/rules/*` path.
 */
export function noRestrictedSyntaxRule(): Rule.RuleModule {
  const rule = builtinRules.get('no-restricted-syntax');
  if (!rule) throw new Error('no-restricted-syntax not found in eslint builtinRules');
  return rule;
}

/** A rendered declarative rule reduced to the two fields the firing runner needs. */
export interface RenderedRestrictedRule {
  selector: string;
  message: string;
}

/**
 * Fire the built-in `no-restricted-syntax` rule (configured from the rendered rule's
 * selector + message) against `code`, and return the set of ruleIds that reported.
 * Uses eslint's in-process Linter (the same mechanism the L4 rule-tester gate uses).
 */
export function fireRestricted(rule: RenderedRestrictedRule, code: string): Set<string> {
  const linter = new Linter();
  const config: Linter.Config[] = [
    {
      files: ['**/*.{ts,tsx,js,jsx}'],
      languageOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      rules: {
        'no-restricted-syntax': ['error', { selector: rule.selector, message: rule.message }],
      },
    },
  ];
  const messages = linter.verify(code, config, { filename: 'firing-sample.ts' });
  const ruleIds = new Set<string>();
  for (const m of messages) {
    if (typeof m.ruleId === 'string' && m.ruleId.length > 0) ruleIds.add(m.ruleId);
  }
  return ruleIds;
}
