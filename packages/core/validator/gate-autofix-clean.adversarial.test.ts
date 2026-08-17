// Gate 9 adversarial corpus — autofix-clean anti-vacuity hardening.
// Paired bad/valid plans prove the gate discriminates — not just always-rejects.
// Principle 02 (paired-negative): BAD fixture + VALID counterpart both required.
// NET-NEW: no autofix logic exists in synthesizer/validator today. Forward-protects
// S4/G3b; for forbid-only MVP most rules are n/a, but the gate is real.
//
// BAD uses a hand-authored plan with a fixable rule (no-extra-parens) where ONE
// pass of fix application leaves the same-rule violation in the output.
// VALID uses no-var whose one-pass fix cleanly removes all violations.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { runAutofixCleanGate } from './gate-autofix-clean.ts';
import type { SynthesisPlan } from '../synthesizer/types.ts';

const provenance = {
  url: 'https://nextjs.org/docs/app',
  allowlistKey: 'next.official',
  fetchedAt: '2026-05-08',
};

// BAD: eslint rule 'no-extra-parens' on '((x))'.
// One pass of fix application removes the OUTER parens → '(x)'.
// Re-verify on '(x)' → same rule fires again (inner parens are still extra).
// Gate MUST reject this plan (fix is not clean after one pass).
export const autofixCleanBadPlan: SynthesisPlan = {
  framework: 'next',
  version: '16.0.0',
  rules: [
    {
      id: 'G87',
      title: 'adversarial-autofix-clean-bad',
      stack: ['react-next'],
      check: { type: 'eslint', rule: 'no-extra-parens' },
      examples: { bad: '((x))', good: 'x' },
      'negative-test': {
        input: ['((x))'],
        'expect-violation': 'no-extra-parens',
      },
      research: { entryId: 'adv-afc-bad', provenance: [provenance] },
    },
  ],
  rulesMd: '',
  eslintConfigSnippet: JSON.stringify({ 'no-extra-parens': 'error' }),
};

// VALID (paired counterpart): eslint rule 'no-var' on 'var x = 1;'.
// One pass of fix application converts var → const → 'const x = 1;'.
// Re-verify on 'const x = 1;' → no-var does NOT fire.
// Gate MUST accept this plan (fix is clean after one pass).
export const autofixCleanValidPlan: SynthesisPlan = {
  framework: 'next',
  version: '16.0.0',
  rules: [
    {
      id: 'G86',
      title: 'adversarial-autofix-clean-valid',
      stack: ['react-next'],
      check: { type: 'eslint', rule: 'no-var' },
      examples: { bad: 'var x = 1;', good: 'const x = 1;' },
      'negative-test': {
        input: ['var x = 1;'],
        'expect-violation': 'no-var',
      },
      research: { entryId: 'adv-afc-valid', provenance: [provenance] },
    },
  ],
  rulesMd: '',
  eslintConfigSnippet: JSON.stringify({ 'no-var': 'error' }),
};

describe('L4 gate 9 — autofix-clean adversarial corpus (paired bad/valid)', () => {
  it('BAD: rejects rule whose one-pass fix leaves same-rule violation in output', () => {
    const result = runAutofixCleanGate(autofixCleanBadPlan);
    expect(result.status).toBe('fail');
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]!.ruleId).toBe('G87');
    expect(result.failures[0]!.reason).toMatch(/autofix-clean/);
    expect(result.failures[0]!.reason).toMatch(/no-extra-parens/);
  });

  it('VALID (paired): accepts rule whose one-pass fix cleanly removes violations', () => {
    const result = runAutofixCleanGate(autofixCleanValidPlan);
    expect(result.status).toBe('pass');
    expect(result.failures).toEqual([]);
  });
});

// U10 option b (2026-08-17) — the fifth gate carrying the unpublishable static import (the
// freeze doc's U10 WARNING table listed only four). Same paired shape as the other gates.
const NO_BARREL = resolve(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'negative-corpus',
);

describe('L4 gate 9 — plugin registry resolution (U10 option b)', () => {
  const pluginRulePlan = (): SynthesisPlan => ({
    framework: 'next',
    version: '16.0.0',
    rules: [
      {
        id: 'G95',
        title: 'plugin rule roundtrip',
        stack: ['react-next'],
        check: { type: 'eslint', rule: 'rules-as-tests/always-fires' },
        examples: { bad: 'const x = 1;', good: '// nothing' },
        'negative-test': { input: ['const x = 1;'], 'expect-violation': 'always' },
        research: {
          entryId: 'u10',
          provenance: [
            {
              url: 'https://nextjs.org/docs/app',
              allowlistKey: 'next.official',
              fetchedAt: '2026-05-08',
            },
          ],
        },
      },
    ],
    rulesMd: '',
    eslintConfigSnippet: JSON.stringify({ 'rules-as-tests/always-fires': 'error' }),
  });

  it('degrades — not n/a, not crash — when the registry is unresolvable', () => {
    const result = runAutofixCleanGate(pluginRulePlan(), {
      cwd: NO_BARREL,
      workspaceSpecifiers: [],
    });
    // n/a would be the pre-fix answer shape ("no rule shipped a fixer") and would hide the
    // fact that the gate never got to look.
    expect(result.status).toBe('degrade');
    expect(result.failures).toEqual([]);
    expect(result.degraded?.[0].code).toBe('FF3022');
    expect(result.degraded?.[0].ruleId).toBe('G95');
  });

  it('leaves the resolved path unchanged (no degraded field when the registry resolves)', () => {
    const result = runAutofixCleanGate(autofixCleanValidPlan);
    expect(result.status).toBe('pass');
    expect(result.degraded).toBeUndefined();
  });
});
