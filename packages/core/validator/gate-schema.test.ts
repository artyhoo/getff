import { describe, expect, it } from 'vitest';
import { runSchemaGate } from './gate-schema.ts';
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

describe('L4 gate 1 — schema check', () => {
  it('passes for an empty SynthesisPlan (own-repo case)', () => {
    const synthPlan = synthesize(plan({ framework: null }));
    const result = runSchemaGate(synthPlan);
    expect(result.status).toBe('pass');
    expect(result.failures).toEqual([]);
  });

  it('passes for the next-16 fixture plan (3 recipes)', () => {
    const synthPlan = synthesize(
      plan({
        patterns: [
          entry('nextjs-app-router'),
          entry('nextjs-pages-router'),
          entry('next-r12-no-server-imports-in-client'),
        ],
      }),
    );
    const result = runSchemaGate(synthPlan);
    expect(result.status).toBe('pass');
  });

  it('passes for a live-path rule whose provenance carries packageName (rule-researcher protocol shape)', () => {
    // The rule-researcher protocol's Tier-1 entry shape REQUIRES provenance `packageName`
    // (scope-lock: «provenance `packageName` must equal it», agents/rule-researcher.md), and
    // research/types.ts declares it optional. The external gate (partitionResearchPlan)
    // accepts it; the L4 Provenance schema must accept it too, else every protocol-following
    // research file degrades the WHOLE plan to research-only via FF3001 — measured live
    // 2026-10-06 on a svelte-kit W2 install (`setup --full`): silent, the CLI printed
    // mode:"research-only" with dropped:[]. This plan literal is that run's synthesized
    // G1 verbatim (synthesizeGenerate — the live path; `synthesize()` emits no `research`
    // field, so the preset-lane fixtures never see this).
    const tier1: SynthesisPlan = {
      framework: 'svelte-kit',
      version: '3.0.1',
      rules: [
        {
          id: 'G1',
          title: 'Use $app/state instead of the removed $app/stores module',
          stack: ['svelte-kit'],
          check: {
            type: 'declarative',
            presence: 'forbid',
            selector: "ImportDeclaration[source.value='$app/stores']",
            message: "Import from '$app/state' instead — '$app/stores' was removed in SvelteKit 3.0.",
            engine: 'eslint-restricted',
          },
          examples: {
            bad: "import { page } from '$app/stores';\nexport const path = page.url.pathname;\n",
            good: "import { page } from '$app/state';\nexport const path = page.url.pathname;\n",
          },
          research: {
            entryId: 'svelte-kit-no-app-stores',
            provenance: [
              {
                url: 'https://svelte.dev/docs/kit/$app-stores',
                allowlistKey: 'svelte',
                packageName: 'svelte',
                fetchedAt: '2026-10-06T00:00:00.000Z',
                tier: 2,
              },
            ],
            tier: 2,
          },
          'negative-test': {
            input: ["import { page } from '$app/stores';\nexport const path = page.url.pathname;\n"],
            'expect-violation': 'no-restricted-syntax',
          },
        },
      ],
      rulesMd: '',
      eslintConfigSnippet: '{}',
    };
    const result = runSchemaGate(tier1);
    expect(result.status).toBe('pass');
    expect(result.failures).toEqual([]);
  });

  it('fails when a top-level required field is missing', () => {
    const malformed = { framework: 'next', rules: [], rulesMd: '', eslintConfigSnippet: '{}' };
    const result = runSchemaGate(malformed);
    expect(result.status).toBe('fail');
    expect(result.failures[0].reason).toMatch(/schema violation/i);
  });

  it('fails when a SynthesizedRule has malformed check shape', () => {
    const malformed: SynthesisPlan = {
      framework: 'next',
      version: '16.0.0',
      rules: [
        {
          id: 'G1',
          title: 't',
          stack: ['react-next'],
          check: { type: 'eslint' } as never,
          examples: { bad: 'b', good: 'g' },
          research: { entryId: 'x', provenance: [] },
        },
      ],
      rulesMd: '',
      eslintConfigSnippet: '{}',
    };
    const result = runSchemaGate(malformed);
    expect(result.status).toBe('fail');
  });

  it('fails when an eslint-checked rule has no negative-test (semantic check)', () => {
    const malformed: SynthesisPlan = {
      framework: 'next',
      version: '16.0.0',
      rules: [
        {
          id: 'G1',
          title: 'no-restricted-imports rule',
          stack: ['react-next'],
          'applies-to': ['src/app/**/*.tsx'],
          check: { type: 'eslint', rule: 'no-restricted-imports' },
          examples: { bad: 'b', good: 'g' },
          research: { entryId: 'x', provenance: [provenance] },
        },
      ],
      rulesMd: '',
      eslintConfigSnippet: '{}',
    };
    const result = runSchemaGate(malformed);
    expect(result.status).toBe('fail');
    expect(result.failures[0].ruleId).toBe('G1');
    expect(result.failures[0].reason).toMatch(/negative-test/);
  });

  it('does not flag manual-checked rules for missing negative-test', () => {
    const synthPlan = synthesize(
      plan({ patterns: [entry('nextjs-pages-router')] }),
    );
    expect(synthPlan.rules[0].check.type).toBe('manual');
    const result = runSchemaGate(synthPlan);
    expect(result.status).toBe('pass');
  });

  it('fails when a declarative-checked rule has no negative-test (semantic check)', () => {
    const malformed: SynthesisPlan = {
      framework: 'next',
      version: '16.0.0',
      rules: [
        {
          id: 'G1',
          title: 'Forbid .only in tests',
          stack: ['react-next'],
          check: {
            type: 'declarative',
            engine: 'eslint-restricted',
            selector: "CallExpression[callee.property.name='only']",
            message: 'remove .only',
            presence: 'forbid',
          } as never,
          examples: {
            bad: "it.only('t', () => {})",
            good: "it('t', () => {})",
          },
          research: { entryId: 'test-only-forbid', provenance: [] },
        },
      ],
      rulesMd: '',
      eslintConfigSnippet: '{}',
    };
    const result = runSchemaGate(malformed);
    expect(result.status).toBe('fail');
    expect(result.failures[0].ruleId).toBe('G1');
    expect(result.failures[0].reason).toMatch(/negative-test/);
  });
});
