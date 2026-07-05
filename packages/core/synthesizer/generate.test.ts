// Stage 4 — L4-verdict tests for synthesizeGenerate (recipe-less generate-path).
// Testable surface = the L4 verdict on the output + rule firing, NOT the plan bytes (T-S4-B).
// Stubs inject deterministic selections; no live LLM calls (no-paid-llm-in-ci.md).
// Principle 02 (paired-negative): valid case (a,b) + invalid negative case (c).
// Oracle coverage (T7): emitted set covers R12/R14/R15/R18 from RULES.react-native.md.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Linter } from 'eslint';
import * as tseslintParser from '@typescript-eslint/parser';
import { synthesizeGenerate } from './generate.ts';
import { stubGenerateRN, stubGenerateBad, stubGenerateForbid } from './generate-stubs.ts';
import type { GenerateClient, GenerateSelection, Menu } from './generate-port.ts';
import { validate } from '../validator/validate.ts';
import type { ResearchPlan } from '../research/types.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(HERE, 'fixtures');

// Frozen RN ResearchPlan — recipe-less proving case (no recipes/*.json for react-native)
const rnPlan: ResearchPlan = JSON.parse(
  readFileSync(resolve(FIXTURES, 'rn-research-plan.json'), 'utf8'),
) as ResearchPlan;

// R18 fixture strings — SOURCE of truth; gate reads strings, not files
const flatlistBadCode = readFileSync(resolve(FIXTURES, 'flatlist.bad.tsx'), 'utf8');
const flatlistGoodCode = readFileSync(resolve(FIXTURES, 'flatlist.good.tsx'), 'utf8');

describe('synthesizeGenerate — Stage 4 recipe-less generate-path (React Native)', () => {
  // (a) L4 accepts: validate(synthesizeGenerate(rnPlan, stubGenerateRN)).ok === true
  it('(a) stubGenerateRN: L4 accepts the generated SynthesisPlan', async () => {
    const plan = await synthesizeGenerate(rnPlan, stubGenerateRN);
    const report = validate(plan);
    expect(report.ok).toBe(true);
  });

  // (b) R18 no-restricted-imports fires on flatlist.bad.tsx, clean on flatlist.good.tsx
  it('(b) stubGenerateRN: R18 no-restricted-imports fires on bad FlatList import, clean on FlashList', async () => {
    const plan = await synthesizeGenerate(rnPlan, stubGenerateRN);
    const r18 = plan.rules.find(
      (r) => r.check.type === 'eslint' && r.check.rule === 'no-restricted-imports',
    );
    expect(r18).toBeDefined();

    const parsedSnippet = JSON.parse(plan.eslintConfigSnippet) as Record<string, unknown>;
    const ruleName = 'no-restricted-imports';
    const ruleConfig = parsedSnippet[ruleName];

    const config: Linter.Config[] = [
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
        rules: { [ruleName]: ruleConfig as Linter.RuleEntry },
      },
    ];
    const linter = new Linter();

    // Bad: FlatList import must trigger the rule
    const badMessages = linter.verify(flatlistBadCode, config, { filename: 'flatlist.bad.tsx' });
    expect(badMessages.some((m) => m.ruleId === ruleName)).toBe(true);

    // Good: FlashList import must be clean
    const goodMessages = linter.verify(flatlistGoodCode, config, { filename: 'flatlist.good.tsx' });
    expect(goodMessages.filter((m) => m.ruleId === ruleName)).toHaveLength(0);
  });

  // (c) Paired negative (principle 02): stubGenerateBad overrides eslintConfig with a
  // tautological no-restricted-imports rule that forbids 'react'.
  // negative-corpus/unrelated.tsx imports 'react' → L4 gate 4 (tautology) fires → ok === false.
  it('(c) stubGenerateBad: L4 rejects the tautological SynthesisPlan (paired negative)', async () => {
    const plan = await synthesizeGenerate(rnPlan, stubGenerateBad);
    const report = validate(plan);
    expect(report.ok).toBe(false);
  });

  // (d) Seam i-2: a forbid-expressible candidate is routed to a FULL declarative rule
  // (presence + negative-test + no-restricted-syntax inset), inheriting the executable L4
  // roundtrip — NOT emitted as `manual` (which L4 silently skips).
  it('(d) stubGenerateForbid: forbid candidate → declarative rule, L4 accepts + roundtrips', async () => {
    const plan = await synthesizeGenerate(rnPlan, stubGenerateForbid);
    const rule = plan.rules[0];
    expect(rule.check.type).toBe('declarative');
    expect(rule.check).toMatchObject({
      presence: 'forbid',
      selector: "CallExpression[callee.name='foo']",
    });
    const report = validate(plan);
    expect(report.ok).toBe(true);
    expect(report.gates.ruleTester.status).toBe('pass');
    expect(report.gates.singleTokenDiff.status).toBe('pass');
    expect(report.gates.messageIdCoverage.status).toBe('pass');
  });

  // (e/f) GH #915 obs 4 — PIPELINE-level safeForms coverage (generate → IR wire → validate).
  // The unit tests in gate-rule-tester.test.ts call the gate directly; these prove safeForms
  // SURVIVES the declarative IR round-trip (to-node.ts mergeEnrichment previously dropped it —
  // the probe was dead on the real path) and that the verdict flows through validate().
  const forbidWithSafeForms = (safeForms: string[]): GenerateClient => ({
    async generate(_menu: Menu): Promise<GenerateSelection> {
      const base = await stubGenerateForbid.generate(_menu);
      return {
        rules: [
          {
            ...base.rules[0],
            examples: { ...base.rules[0].examples, safeForms },
          },
        ],
      };
    },
  });

  it('(e) safeForms survives the declarative IR round-trip and a clean safe form passes L4', async () => {
    const plan = await synthesizeGenerate(rnPlan, forbidWithSafeForms(['const foo = 1;']));
    // Round-trip proof: the wired declarative rule still carries safeForms.
    expect(plan.rules[0].examples.safeForms).toEqual(['const foo = 1;']);
    const report = validate(plan);
    expect(report.ok).toBe(true);
    expect(report.gates.ruleTester.status).toBe('pass');
  });

  it('(f, paired-negative) a FIRING safe form fails validate() with FF3021 on the real pipeline', async () => {
    // 'foo()' matches the forbid selector — an over-broad-selector stand-in.
    const plan = await synthesizeGenerate(rnPlan, forbidWithSafeForms(['foo()']));
    const report = validate(plan);
    expect(report.ok).toBe(false);
    expect(report.gates.ruleTester.status).toBe('fail');
    expect(report.gates.ruleTester.failures.some((f) => f.code === 'FF3021')).toBe(true);
  });
});

// T7 — Oracle coverage: emitted rule set covers RULES.react-native.md oracle IDs.
// Option A resolution: R12+R18 as check.type:'eslint' (L4 roundtripped);
//                      R14+R15 as check.type:'manual' (plugin rules, honest about harness limit).
describe('synthesizeGenerate — oracle coverage against RULES.react-native.md', () => {
  it('covers R12-RN (rn-web-globals) as L4-validated eslint rule', async () => {
    const plan = await synthesizeGenerate(rnPlan, stubGenerateRN);
    const r12 = plan.rules.find((r) => r.research.entryId === 'rn-web-globals');
    expect(r12).toBeDefined();
    expect(r12?.check.type).toBe('eslint');
    if (r12?.check.type === 'eslint') {
      expect(r12.check.rule).toBe('no-restricted-globals');
    }
  });

  it('covers R14-RN (rn-styles) as manual (plugin rule, not in L4 KNOWN_PLUGINS)', async () => {
    const plan = await synthesizeGenerate(rnPlan, stubGenerateRN);
    const r14 = plan.rules.find((r) => r.research.entryId === 'rn-styles');
    expect(r14).toBeDefined();
    expect(r14?.check.type).toBe('manual');
  });

  it('covers R15-RN (rn-a11y) as manual (plugin rule, not in L4 KNOWN_PLUGINS)', async () => {
    const plan = await synthesizeGenerate(rnPlan, stubGenerateRN);
    const r15 = plan.rules.find((r) => r.research.entryId === 'rn-a11y');
    expect(r15).toBeDefined();
    expect(r15?.check.type).toBe('manual');
  });

  it('covers R18-RN (rn-list-perf) as L4-validated eslint rule filling the documented gap', async () => {
    const plan = await synthesizeGenerate(rnPlan, stubGenerateRN);
    const r18 = plan.rules.find((r) => r.research.entryId === 'rn-list-perf');
    expect(r18).toBeDefined();
    expect(r18?.check.type).toBe('eslint');
    if (r18?.check.type === 'eslint') {
      // R18 uses the EXISTING no-restricted-imports built-in (Path A — no invented selector)
      expect(r18.check.rule).toBe('no-restricted-imports');
    }
    // Confirm the no-restricted-imports config targets react-native/FlatList
    const parsedSnippet = JSON.parse(plan.eslintConfigSnippet) as Record<string, unknown>;
    const riConfig = parsedSnippet['no-restricted-imports'] as unknown[];
    expect(riConfig).toBeDefined();
    const opts = riConfig[1] as { paths?: Array<{ name: string; importNames?: string[] }> };
    const rnPath = opts?.paths?.find((p) => p.name === 'react-native');
    expect(rnPath).toBeDefined();
    expect(rnPath?.importNames).toContain('FlatList');
  });

  it('total coverage: all 4 oracle entry IDs present in emitted rule set', async () => {
    const plan = await synthesizeGenerate(rnPlan, stubGenerateRN);
    const coveredEntryIds = plan.rules.map((r) => r.research.entryId);
    // R12 + R14 + R15 + R18 (Option A: R14/R15 as manual — factory selected the right plugin rules)
    expect(coveredEntryIds).toContain('rn-web-globals');
    expect(coveredEntryIds).toContain('rn-styles');
    expect(coveredEntryIds).toContain('rn-a11y');
    expect(coveredEntryIds).toContain('rn-list-perf');
    // Proof: recipe-less path produced ≥1 L4-validated RN rule with NO recipe file present
    const eslintRules = plan.rules.filter((r) => r.check.type === 'eslint');
    expect(eslintRules.length).toBeGreaterThanOrEqual(1);
  });
});
