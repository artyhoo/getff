import { describe, expect, it } from 'vitest';
import { runRuleTesterGate } from './gate-rule-tester.ts';
import { synthesize } from '../synthesizer/synthesize.ts';
import type { ResearchEntry, ResearchPlan } from '../research/types.ts';
import type { SynthesisPlan } from '../synthesizer/types.ts';

const DECLARATIVE_ESLINT_RESTRICTED_PLAN: SynthesisPlan = {
  framework: 'next',
  version: '16.0.0',
  rules: [
    {
      id: 'G1',
      title: 'Forbid .only in tests (declarative)',
      stack: ['react-next'],
      check: {
        type: 'declarative',
        engine: 'eslint-restricted',
        selector:
          "CallExpression[callee.object.name=/^(describe|it|test)$/][callee.property.name='only']",
        message: 'remove .only — it silently disables sibling tests',
        presence: 'forbid',
      } as never,
      examples: {
        bad: "it.only('test', () => {})",
        good: "it('test', () => {})",
      },
      'negative-test': {
        input: ["it.only('test', () => {})"],
        'expect-violation': 'rules-as-tests/restricted-syntax-audit-exempt',
      },
      research: { entryId: 'test-only-forbid', provenance: [] },
    },
  ],
  rulesMd: '',
  eslintConfigSnippet: JSON.stringify({
    'rules-as-tests/restricted-syntax-audit-exempt': [
      'error',
      {
        selector:
          "CallExpression[callee.object.name=/^(describe|it|test)$/][callee.property.name='only']",
        message: 'remove .only — it silently disables sibling tests',
      },
    ],
  }),
};

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

describe('L4 gate 2 — rule-tester roundtrip', () => {
  it('marks status n/a when plan has no eslint-checked rules', () => {
    const synthPlan = synthesize(plan({ framework: null }));
    const result = runRuleTesterGate(synthPlan);
    expect(result.status).toBe('n/a');
  });

  it('marks status n/a when only manual rules are present', () => {
    const synthPlan = synthesize(plan({ patterns: [entry('nextjs-pages-router')] }));
    expect(synthPlan.rules).toHaveLength(1);
    expect(synthPlan.rules[0].check.type).toBe('manual');
    const result = runRuleTesterGate(synthPlan);
    expect(result.status).toBe('n/a');
  });

  it('passes for the next-16 fixture (G1 builtin + G3 plugin)', () => {
    const synthPlan = synthesize(
      plan({
        patterns: [
          entry('nextjs-app-router'),
          entry('next-r12-no-server-imports-in-client'),
        ],
      }),
    );
    const result = runRuleTesterGate(synthPlan);
    expect(result.failures).toEqual([]);
    expect(result.status).toBe('pass');
  });

  it('passes for the full 3-recipe next-16 plan; manual rule is skipped', () => {
    const synthPlan = synthesize(
      plan({
        patterns: [
          entry('nextjs-app-router'),
          entry('nextjs-pages-router'),
          entry('next-r12-no-server-imports-in-client'),
        ],
      }),
    );
    const result = runRuleTesterGate(synthPlan);
    expect(result.status).toBe('pass');
  });

  it('fails when negative-test.input does not produce the expected violation', () => {
    const synthPlan = synthesize(
      plan({ patterns: [entry('nextjs-app-router')] }),
    );
    const broken: SynthesisPlan = {
      ...synthPlan,
      rules: synthPlan.rules.map((r) => ({
        ...r,
        'negative-test': {
          input: ['// no imports here, just a comment'],
          'expect-violation': 'no-restricted-imports',
        },
      })),
    };
    const result = runRuleTesterGate(broken);
    expect(result.status).toBe('fail');
    expect(result.failures[0].ruleId).toBe('G1');
    expect(result.failures[0].reason).toMatch(/did not produce expected violation/);
  });

  it('fails when examples.good triggers a false positive', () => {
    const synthPlan = synthesize(
      plan({ patterns: [entry('nextjs-app-router')] }),
    );
    const broken: SynthesisPlan = {
      ...synthPlan,
      rules: synthPlan.rules.map((r) => ({
        ...r,
        examples: {
          ...r.examples,
          good: "import { useRouter } from 'next/router';\nexport default function Page() { return null; }",
        },
      })),
    };
    const result = runRuleTesterGate(broken);
    expect(result.status).toBe('fail');
    expect(result.failures[0].reason).toMatch(/examples\.good produced unexpected violation/);
  });

  it('fails when an eslint rule is missing negative-test', () => {
    const synthPlan = synthesize(
      plan({ patterns: [entry('nextjs-app-router')] }),
    );
    const broken: SynthesisPlan = {
      ...synthPlan,
      rules: synthPlan.rules.map((r) => {
        const { 'negative-test': _drop, ...rest } = r;
        return rest;
      }),
    };
    const result = runRuleTesterGate(broken);
    expect(result.status).toBe('fail');
    expect(result.failures[0].reason).toMatch(/no negative-test/);
  });
});

describe('L4 gate 2 — declarative check type (S2-A)', () => {
  it('runs declarative+eslint-restricted rule: bad reddens, good greens (pass)', () => {
    const result = runRuleTesterGate(DECLARATIVE_ESLINT_RESTRICTED_PLAN);
    expect(result.failures).toEqual([]);
    expect(result.status).toBe('pass');
  });

  it('emits explicit deferred-marker for declarative+ast-grep (not silent n/a)', () => {
    const astGrepPlan: SynthesisPlan = {
      framework: 'next',
      version: '16.0.0',
      rules: [
        {
          id: 'G1',
          title: 'Forbid self-compare (ast-grep — deferred)',
          stack: ['react-next'],
          check: {
            type: 'declarative',
            engine: 'ast-grep',
            selector: '$A === $A',
            message: 'self-compare is always true',
            presence: 'forbid',
          } as never,
          examples: { bad: 'if (x === x) {}', good: 'if (x === y) {}' },
          'negative-test': {
            input: ['if (x === x) {}'],
            'expect-violation': 'no-restricted-syntax',
          },
          research: { entryId: 'self-compare-forbid', provenance: [] },
        },
      ],
      rulesMd: '',
      eslintConfigSnippet: '{}',
    };
    const result = runRuleTesterGate(astGrepPlan);
    expect(result.status).toBe('fail');
    expect(result.failures[0].reason).toMatch(
      /ast-grep engine reserved but not wired/,
    );
  });

  it('marks n/a when plan has only declarative rules with no engine match (non-declarative/non-eslint)', () => {
    // manual rule should still be n/a — declarative admission must not break the n/a path
    const synthPlan = synthesize(plan({ patterns: [entry('nextjs-pages-router')] }));
    expect(synthPlan.rules[0].check.type).toBe('manual');
    const result = runRuleTesterGate(synthPlan);
    expect(result.status).toBe('n/a');
  });
});

describe('L4 gate 2 — examples.safeForms probe (GH #915 obs 4)', () => {
  // The motivating incident: MemberExpression[property.name='hasOwnProperty'] also matches the
  // KNOWN-SAFE Object.prototype.hasOwnProperty.call(obj, key) idiom — a multi-token safe form
  // that examples.good structurally cannot carry (gate-single-token-diff constrains good to
  // ~1 token from bad), so no gate saw the over-broad selector before safeForms existed.
  const hasOwnPropertyPlan = (safeForms?: string[]): SynthesisPlan => ({
    framework: 'ts-server',
    version: null,
    rules: [
      {
        id: 'G1',
        title: 'Prefer Object.hasOwn over direct hasOwnProperty',
        stack: ['ts-server'],
        check: {
          type: 'declarative',
          engine: 'eslint-restricted',
          selector: "MemberExpression[property.name='hasOwnProperty']",
          message: 'use Object.hasOwn(obj, key) — direct .hasOwnProperty can be shadowed',
          presence: 'forbid',
        } as never,
        examples: {
          bad: 'obj.hasOwnProperty(key);',
          good: 'Object.hasOwn(obj, key);',
          ...(safeForms ? { safeForms } : {}),
        },
        'negative-test': {
          input: ['obj.hasOwnProperty(key);'],
          'expect-violation': 'rules-as-tests/restricted-syntax-audit-exempt',
        },
        research: { entryId: 'no-direct-hasownproperty', provenance: [] },
      },
    ],
    rulesMd: '',
    eslintConfigSnippet: JSON.stringify({
      'rules-as-tests/restricted-syntax-audit-exempt': [
        'error',
        {
          selector: "MemberExpression[property.name='hasOwnProperty']",
          message: 'use Object.hasOwn(obj, key) — direct .hasOwnProperty can be shadowed',
        },
      ],
    }),
  });

  it('passes when no safeForms are declared (field is optional — pre-#915 plans unaffected)', () => {
    const result = runRuleTesterGate(hasOwnPropertyPlan());
    expect(result.status).toBe('pass');
  });

  it('passes when declared safeForms do not match the selector (non-firing safe form)', () => {
    const result = runRuleTesterGate(
      hasOwnPropertyPlan(['Object.hasOwn(other, key);', 'const hasOwnProperty = 1;']),
    );
    expect(result.failures).toEqual([]);
    expect(result.status).toBe('pass');
  });

  it('fails with FF3021 when a safe form fires — the motivating hasOwnProperty.call over-broad selector', () => {
    const result = runRuleTesterGate(
      hasOwnPropertyPlan(['Object.prototype.hasOwnProperty.call(obj, key);']),
    );
    expect(result.status).toBe('fail');
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].code).toBe('FF3021');
    expect(result.failures[0].reason).toMatch(/safeForms\[0\]/);
    expect(result.failures[0].reason).toMatch(/broader than its rationale/);
  });

  it('reports the failing index when only one of several safeForms fires', () => {
    const result = runRuleTesterGate(
      hasOwnPropertyPlan([
        'Object.hasOwn(obj, key);',
        'Object.prototype.hasOwnProperty.call(obj, key);',
      ]),
    );
    expect(result.status).toBe('fail');
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].reason).toMatch(/safeForms\[1\]/);
  });
});
