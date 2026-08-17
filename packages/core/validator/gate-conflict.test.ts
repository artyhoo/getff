import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { runConflictGate } from './gate-conflict.ts';
import { synthesize } from '../synthesizer/synthesize.ts';
import type { ResearchEntry, ResearchPlan } from '../research/types.ts';
import type { SynthesisPlan } from '../synthesizer/types.ts';

const provenance = {
  url: 'https://nextjs.org/docs/app',
  allowlistKey: 'next.official',
  fetchedAt: '2026-05-08',
};

const entry = (id: string): ResearchEntry => ({
  id,
  summary: `summary for ${id}`,
  bestPractices: [],
  antiPatterns: [],
  provenance: [provenance],
});

const plan = (overrides: Partial<ResearchPlan> = {}): ResearchPlan => ({
  framework: 'next',
  version: '16.0.0',
  patterns: [],
  missing: [],
  drift: null,
  ...overrides,
});

describe('L4 gate 6 — cross-rule conflict', () => {
  it('passes for empty plan', () => {
    const synthPlan = synthesize(plan({ framework: null }));
    const result = runConflictGate(synthPlan);
    expect(result.status).toBe('pass');
  });

  it('passes for next-16 fixture (3 recipes — RSC reuses preset rule, not orphan)', () => {
    const synthPlan = synthesize(
      plan({
        patterns: [
          entry('nextjs-app-router'),
          entry('nextjs-pages-router'),
          entry('next-r12-no-server-imports-in-client'),
        ],
      }),
    );
    const result = runConflictGate(synthPlan);
    expect(result.failures).toEqual([]);
    expect(result.status).toBe('pass');
  });

  it('fails when a synthesized rule references an orphan plugin rule', () => {
    const orphan: SynthesisPlan = {
      framework: 'next',
      version: '16.0.0',
      rules: [
        {
          id: 'G99',
          title: 'orphan',
          stack: ['react-next'],
          check: { type: 'eslint', rule: 'rules-as-tests/does-not-exist' },
          examples: { bad: 'b', good: 'g' },
          'negative-test': { input: ['x'], 'expect-violation': 'foo' },
          research: { entryId: 'x', provenance: [provenance] },
        },
      ],
      rulesMd: '',
      eslintConfigSnippet: JSON.stringify({
        'rules-as-tests/does-not-exist': 'error',
      }),
    };
    const result = runConflictGate(orphan);
    expect(result.status).toBe('fail');
    expect(result.failures[0].reason).toMatch(/does not exist in the preset plugin registry/);
  });

  it('fails when an eslint-checked rule has no eslintConfigSnippet entry (snippet drop)', () => {
    const dropped: SynthesisPlan = {
      framework: 'next',
      version: '16.0.0',
      rules: [
        {
          id: 'G99',
          title: 'snippet drop',
          stack: ['react-next'],
          check: { type: 'eslint', rule: 'no-restricted-imports' },
          examples: { bad: 'b', good: 'g' },
          'negative-test': { input: ['x'], 'expect-violation': 'no-restricted-imports' },
          research: { entryId: 'x', provenance: [provenance] },
        },
      ],
      rulesMd: '',
      eslintConfigSnippet: '{}',
    };
    const result = runConflictGate(dropped);
    expect(result.status).toBe('fail');
    expect(result.failures[0].ruleId).toBe('G99');
    expect(result.failures[0].reason).toMatch(/eslintConfigSnippet has no entry/);
  });
});

// U10 option b (2026-08-17) — with the plugin registry unresolvable, «not in the registry»
// says nothing about the rule, so arm (a) must degrade rather than raise a false FF3008.
const NO_BARREL = resolve(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'negative-corpus',
);

describe('L4 gate 6 — plugin registry resolution (U10 option b)', () => {
  const pluginRulePlan = (): SynthesisPlan => ({
    framework: 'next',
    version: '16.0.0',
    rules: [
      {
        id: 'G96',
        title: 'plugin rule reference',
        stack: ['react-next'],
        check: { type: 'eslint', rule: 'rules-as-tests/no-server-imports-in-client' },
        examples: { bad: 'b', good: 'g' },
        'negative-test': { input: ['x'], 'expect-violation': 'foo' },
        research: { entryId: 'x', provenance: [provenance] },
      },
    ],
    rulesMd: '',
    eslintConfigSnippet: JSON.stringify({
      'rules-as-tests/no-server-imports-in-client': 'error',
    }),
  });

  it('degrades instead of reporting a false orphan when the registry is unresolvable', () => {
    const result = runConflictGate(pluginRulePlan(), {
      cwd: NO_BARREL,
      workspaceSpecifiers: [],
    });
    expect(result.status).toBe('degrade');
    expect(result.failures).toEqual([]);
    expect(result.degraded?.[0].code).toBe('FF3022');
    expect(result.degraded?.[0].ruleId).toBe('G96');
  });

  it('still reports a REAL orphan once the registry resolves (degrade does not swallow it)', () => {
    const orphan = pluginRulePlan();
    orphan.rules[0].check = { type: 'eslint', rule: 'rules-as-tests/does-not-exist' };
    orphan.eslintConfigSnippet = JSON.stringify({
      'rules-as-tests/does-not-exist': 'error',
    });
    const result = runConflictGate(orphan, { cwd: NO_BARREL });
    expect(result.status).toBe('fail');
    expect(result.failures[0].code).toBe('FF3008');
    expect(result.degraded).toBeUndefined();
  });
});
