// Firing harness — live-fire tests (MT umbrella S3b PR-1, npm-eslint-declarative backend).
// Spec: docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md §5.
//
// This is the RED of TDD for a RENDERED rule: it fires the REAL eslint built-in
// `no-restricted-syntax` (borrowed runner — SSOT #154 ADOPT ESLint's own rule + RuleTester,
// do not reimplement) against the canonical fixture samples and asserts the paired negative
// fires / positive is silent. eslint runs in-process (no external toolchain to gate on
// CI-vs-dev, unlike the cargo backend), so this whole suite is always-on in CI.
//
// The rendered rule under test is DERIVED from the canonical syntax node's params —
// self-application (T15): the firing test fires exactly what the adapter renders, not a
// hand-authored config.

import { RuleTester } from '@typescript-eslint/rule-tester';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import type { ConventionNode } from '../../ir/types.ts';
import { fireRestricted, noRestrictedSyntaxRule, type NpmFiringContract } from './firing-runner.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTRACT: NpmFiringContract = JSON.parse(
  readFileSync(join(__dirname, 'firing-contract.json'), 'utf8'),
) as NpmFiringContract;

// Bind eslint's native RuleTester statics to vitest's globals (it defaults to Mocha-style
// globals that vitest does not expose without `globals: true`).
RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

// The canonical syntax node (brief P1) — the firing test's source of truth for the rendered
// rule. Same node the producer would build; the firing config is derived from its params,
// proving the rendered rule actually fires (self-application, T15).
const SYNTAX_NODE: ConventionNode = {
  id: 'no-direct-process-env',
  claim: 'Read configuration through a typed config module, never process.env directly',
  anchors: [],
  selectorClass: 'syntax',
  params: {
    selector: "MemberExpression[object.name='process'][property.name='env']",
    presence: 'forbid',
  },
  defaultSeverity: 'error',
  provenance: [],
  pairedExamples: {
    negative: 'const url = process.env.DATABASE_URL;',
    positive: 'const url = config.databaseUrl;',
  },
};

const SELECTOR = SYNTAX_NODE.params['selector'] as string;
const MESSAGE = SYNTAX_NODE.claim;
// The borrowed eslint builtin RuleModule (eslint's `Rule.RuleModule`) is structurally
// compatible with what @typescript-eslint/rule-tester runs, but its static type differs —
// cast at the seam. (tseslint's RuleTester carries the typed afterAll/describe/it statics
// vitest binds below, which eslint's own RuleTester type omits.)
const RULE = noRestrictedSyntaxRule() as never;

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
});

// R1/R2 — paired valid/invalid firing via the borrowed RuleTester + builtin rule (SSOT #154).
ruleTester.run('no-restricted-syntax', RULE, {
  valid: [
    // positive example: conforming code — the selector must NOT match.
    { code: SYNTAX_NODE.pairedExamples.positive, options: [{ selector: SELECTOR, message: MESSAGE }] },
  ],
  invalid: [
    // negative example: the violating code — the selector MUST match, exactly one report.
    {
      code: SYNTAX_NODE.pairedExamples.negative,
      options: [{ selector: SELECTOR, message: MESSAGE }],
      errors: [{ messageId: 'restrictedSyntax' }],
    },
  ],
});

describe('firing harness — no-restricted-syntax borrowed runner (fireRestricted)', () => {
  it('R3: the negative fixture fires -> ruleIds contains the contract expectedRuleId', () => {
    const ruleIds = fireRestricted(
      { selector: SELECTOR, message: MESSAGE },
      SYNTAX_NODE.pairedExamples.negative,
    );
    expect(ruleIds.has(CONTRACT.expectedRuleId)).toBe(true);
  });

  it('R4: the positive fixture is silent -> ruleIds does NOT contain the contract expectedRuleId', () => {
    const ruleIds = fireRestricted(
      { selector: SELECTOR, message: MESSAGE },
      SYNTAX_NODE.pairedExamples.positive,
    );
    expect(ruleIds.has(CONTRACT.expectedRuleId)).toBe(false);
    expect(ruleIds.size).toBe(0);
  });
});

describe('N6 — vacuous-pass protection (a RuleTester invalid-case with no violation must FAIL)', () => {
  // eslint's native RuleTester defers each case into `RuleTester.it(text, fn)`. When `it` is
  // vitest's async scheduler (as bound at the top of this file), the case's assertion throw
  // lands in a nested test rather than propagating out of `.run()` — so a naive
  // `expect(() => tester.run(...)).toThrow()` is VACUOUS (it never sees the throw). To observe
  // the vacuous-pass failure synchronously, this block rebinds the statics to INLINE executors
  // (`(_, fn) => fn()`) around the local run, so `.run()` executes each case immediately and
  // rethrows RuleTester's "Should have 1 error but had 0". The rebind is restored afterwards.
  function runSynchronously(fn: () => void): () => void {
    const savedDescribe = RuleTester.describe;
    const savedIt = RuleTester.it;
    const savedItOnly = RuleTester.itOnly;
    return () => {
      const inline = (_text: string, body: () => void): void => body();
      RuleTester.describe = inline as typeof RuleTester.describe;
      RuleTester.it = inline as typeof RuleTester.it;
      RuleTester.itOnly = inline as typeof RuleTester.itOnly;
      try {
        fn();
      } finally {
        RuleTester.describe = savedDescribe;
        RuleTester.it = savedIt;
        RuleTester.itOnly = savedItOnly;
      }
    };
  }

  it('RuleTester throws when an invalid-case produces zero violations (proves the firing gate is not vacuous)', () => {
    const localTester = new RuleTester({
      languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    });
    // The `invalid` case is CONFORMING code (the process.env selector cannot match
    // config.databaseUrl) — RuleTester MUST throw "Should have 1 error but had 0". If it did
    // NOT throw, an invalid-case with no violation would silently "pass" (vacuous), the exact
    // failure this test guards against.
    expect(
      runSynchronously(() => {
        localTester.run('no-restricted-syntax', RULE, {
          valid: [],
          invalid: [
            {
              code: SYNTAX_NODE.pairedExamples.positive,
              options: [{ selector: SELECTOR, message: MESSAGE }],
              errors: [{ messageId: 'restrictedSyntax' }],
            },
          ],
        });
      }),
    ).toThrow();
  });
});
