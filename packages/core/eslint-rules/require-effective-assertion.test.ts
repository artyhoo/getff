import { RuleTester } from '@typescript-eslint/rule-tester';
import { afterAll, describe, it } from 'vitest';
import { requireEffectiveAssertion } from './require-effective-assertion.ts';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester();

ruleTester.run('require-effective-assertion', requireEffectiveAssertion, {
  valid: [
    // plain expect
    `it('has an assertion', () => { expect(parse('x')).toEqual({}); });`,
    // expect* — expectTypeOf counts (kill the prefix mutants one prefix at a time)
    `it('type assertion', () => { expectTypeOf(value).toMatchTypeOf<string>(); });`,
    // assert*-named helper (the Q2 keep-list: helper substance is a documented limit)
    `it('helper assertion', () => { assertParsedShape(value); });`,
    // verify*-named helper
    `it('verify helper', () => { verifySealed(envelope); });`,
    // MemberExpression callee with a recognized property name
    `it('member assertion', () => { chai.expect(actual).toBe(1); });`,
    // node:assert style — the prefix lives on the OBJECT (population K4 regression, caught
    // by the real-population sweep: assert.equal/assert.ok/assert.match are effective)
    `it('node assert', () => { assert.equal(parse(raw), 7); assert.ok(exists(p)); });`,
    // await alone is NOT effective — but await + expect is
    `it('awaits then asserts', async () => { const r = await load(); expect(r).toBeDefined(); });`,
    // returned expect (promise-returning test)
    `it('returns an assertion', () => expect(run()).resolves.toBe(1));`,
    // skipped variants are exempt — one paired negative per variant (kill EXEMPT_VARIANTS mutants)
    `it.skip('skipped', () => {});`,
    `it.skipIf(cond)('conditionally skipped', () => {});`,
    `it.todo('implement me');`,
    `test.fails('known broken', () => { expect(1).toBe(2); });`,
    // exempt line — the tested exclusion
    `it('placeholder', () => { console.log('wiring only'); }); // audit:exempt — scaffold`,
    // vitest utility calls with an assertion inside count (descend into non-test calls)
    `it('eventually asserts', async () => { await vi.waitFor(() => expect(flag).toBe(true)); });`,
  ],
  invalid: [
    // comment-only body — the Q2 archetype
    {
      code: `it('comment only', () => {
        // TODO: assert the parsed payload once the parser lands
      });`,
      errors: [{ messageId: 'noEffectiveAssertion' }],
    },
    // empty body
    {
      code: `it('empty body', () => {});`,
      errors: [{ messageId: 'noEffectiveAssertion' }],
    },
    // console-only body — output is not verification
    {
      code: `it('console only', () => { console.log(build()); });`,
      errors: [{ messageId: 'noEffectiveAssertion' }],
    },
    // awaiting without asserting — the "it ran" trap
    {
      code: `it('awaits only', async () => { await Promise.resolve({ ok: true }); });`,
      errors: [{ messageId: 'noEffectiveAssertion' }],
    },
    // an unrecognized call name does not count (kill the prefix-match mutants)
    {
      code: `it('inspect only', () => { inspect(build()); });`,
      errors: [{ messageId: 'noEffectiveAssertion' }],
    },
    // the nested case in reverse: an inner assertion does NOT excuse the outer body
    {
      code: `it('outer hollow', () => {
        it('inner', () => { expect(1).toBe(1); });
      });`,
      errors: [{ messageId: 'noEffectiveAssertion' }],
    },
    // `.only` still runs — it needs an assertion like any other variant
    {
      code: `it.only('focused but hollow', () => { setup(); });`,
      errors: [{ messageId: 'noEffectiveAssertion' }],
    },
    // the exempt token on the WRONG line does not suppress (kill line-offset mutants)
    {
      code: `// audit:exempt
      it('misplaced exemption', () => { console.log('wiring'); });`,
      errors: [{ messageId: 'noEffectiveAssertion' }],
    },
  ],
});
