import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { runTautologyGate } from './gate-tautology.ts';
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

describe('L4 gate 4 — tautology check (negative-corpus)', () => {
  it('returns n/a when plan has no eslint rules', () => {
    const synthPlan = synthesize(plan({ framework: null }));
    const result = runTautologyGate(synthPlan);
    expect(result.status).toBe('n/a');
  });

  it('returns n/a when only manual rules are present', () => {
    const synthPlan = synthesize(plan({ patterns: [entry('nextjs-pages-router')] }));
    expect(synthPlan.rules[0].check.type).toBe('manual');
    const result = runTautologyGate(synthPlan);
    expect(result.status).toBe('n/a');
  });

  it('passes for the next-16 fixture (3 recipes, eslint rules cover G1+G3)', () => {
    const synthPlan = synthesize(
      plan({
        patterns: [
          entry('nextjs-app-router'),
          entry('nextjs-pages-router'),
          entry('next-r12-no-server-imports-in-client'),
        ],
      }),
    );
    const result = runTautologyGate(synthPlan);
    expect(result.failures).toEqual([]);
    expect(result.status).toBe('pass');
  });

  it('fails when a synthetic tautology rule is injected (no-restricted-imports forbidding `react`)', () => {
    // Construct a tautology: forbid `react`, which `unrelated.tsx` imports.
    const tautologyPlan: SynthesisPlan = {
      framework: 'next',
      version: '16.0.0',
      rules: [
        {
          id: 'G99',
          title: 'tautology',
          stack: ['react-next'],
          check: { type: 'eslint', rule: 'no-restricted-imports' },
          examples: { bad: 'import x from "react"', good: '// nothing' },
          'negative-test': {
            input: ['import x from "react"'],
            'expect-violation': 'no-restricted-imports',
          },
          research: { entryId: 'taut', provenance: [provenance] },
        },
      ],
      rulesMd: '',
      eslintConfigSnippet: JSON.stringify({
        'no-restricted-imports': [
          'error',
          { paths: [{ name: 'react', message: 'taut' }] },
        ],
      }),
    };
    const result = runTautologyGate(tautologyPlan);
    expect(result.status).toBe('fail');
    expect(result.failures[0].ruleId).toBe('G99');
    expect(result.failures[0].reason).toMatch(/tautology/);
    expect(result.failures[0].reason).toMatch(/unrelated\.tsx/);
  });
});

// U10 option b (2026-08-17) — the plugin registry is resolved dynamically
// (preset-plugin-resolver.ts) instead of statically imported from an unpublishable package.
// These are the paired negatives the operator's falsifier demands: (a) proves the consumer
// barrel really drives the gate, (b) proves the no-registry path degrades rather than
// passing or crashing.
const HERE = dirname(fileURLToPath(import.meta.url));
const BARREL_FIXTURE = resolve(HERE, 'fixtures', 'consumer-barrel');
const NO_BARREL = resolve(HERE, 'fixtures', 'negative-corpus');

const barrelRulePlan = (): SynthesisPlan => ({
  framework: 'next',
  version: '16.0.0',
  rules: [
    {
      id: 'G98',
      title: 'barrel-sourced plugin rule',
      stack: ['react-next'],
      check: { type: 'eslint', rule: 'rules-as-tests/always-fires' },
      examples: { bad: 'const x = 1;', good: '// nothing' },
      'negative-test': {
        input: ['const x = 1;'],
        'expect-violation': 'always',
      },
      research: { entryId: 'barrel', provenance: [provenance] },
    },
  ],
  rulesMd: '',
  eslintConfigSnippet: JSON.stringify({
    'rules-as-tests/always-fires': 'error',
  }),
});

describe('L4 gate 4 — plugin registry resolution (U10 option b)', () => {
  const cwd = process.cwd();
  afterEach(() => process.chdir(cwd));

  it('(a) catches a tautology in a rule that ONLY the consumer barrel supplies', () => {
    // workspaceSpecifiers: [] removes tier (ii) entirely, so the barrel is the only possible
    // source of `always-fires`. Catching the tautology is only reachable if the barrel loaded.
    const result = runTautologyGate(barrelRulePlan(), {
      cwd: BARREL_FIXTURE,
      workspaceSpecifiers: [],
    });
    expect(result.status).toBe('fail');
    expect(result.failures[0].code).toBe('FF3007');
    expect(result.failures[0].ruleId).toBe('G98');
    expect(result.failures[0].reason).toMatch(/fires unconditionally/);
  });

  it('(a2) same catch with NO options — the default anchor is the real process.cwd()', () => {
    process.chdir(BARREL_FIXTURE);
    const result = runTautologyGate(barrelRulePlan());
    expect(result.status).toBe('fail');
    expect(result.failures[0].code).toBe('FF3007');
  });

  it('(b) degrades — not pass, not crash — when neither tier resolves', () => {
    const result = runTautologyGate(barrelRulePlan(), {
      cwd: NO_BARREL,
      workspaceSpecifiers: [],
    });
    expect(result.status).toBe('degrade');
    expect(result.status).not.toBe('pass');
    expect(result.failures).toEqual([]);
    expect(result.degraded?.[0].code).toBe('FF3022');
    expect(result.degraded?.[0].ruleId).toBe('G98');
    expect(result.degraded?.[0].reason).toMatch(/could not be resolved/);
    expect(result.degraded?.[0].reason).toMatch(/rules-as-tests\/always-fires/);
  });

  it('(b2) a degraded run still checks the rules it CAN check (built-ins keep working)', () => {
    const mixed = barrelRulePlan();
    mixed.rules.push({
      id: 'G97',
      title: 'built-in tautology',
      stack: ['react-next'],
      check: { type: 'eslint', rule: 'no-restricted-imports' },
      examples: { bad: 'import x from "react"', good: '// nothing' },
      'negative-test': {
        input: ['import x from "react"'],
        'expect-violation': 'no-restricted-imports',
      },
      research: { entryId: 'taut', provenance: [provenance] },
    });
    mixed.eslintConfigSnippet = JSON.stringify({
      'rules-as-tests/always-fires': 'error',
      'no-restricted-imports': [
        'error',
        { paths: [{ name: 'react', message: 'taut' }] },
      ],
    });
    const result = runTautologyGate(mixed, {
      cwd: NO_BARREL,
      workspaceSpecifiers: [],
    });
    // A real finding outranks the degrade — the gate fails AND says what it skipped.
    expect(result.status).toBe('fail');
    expect(result.failures[0].ruleId).toBe('G97');
    expect(result.degraded?.[0].ruleId).toBe('G98');
  });

  it('leaves the monorepo path byte-identical: no degraded field when everything resolves', () => {
    const synthPlan = synthesize(
      plan({ patterns: [entry('next-r12-no-server-imports-in-client')] }),
    );
    const result = runTautologyGate(synthPlan);
    expect(result.status).toBe('pass');
    expect(result.degraded).toBeUndefined();
  });
});
