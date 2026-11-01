import { RuleTester } from '@typescript-eslint/rule-tester';
import { afterAll, describe, it } from 'vitest';
import { noVacuousAssertion } from './no-vacuous-assertion.ts';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester();

ruleTester.run('no-vacuous-assertion', noVacuousAssertion, {
  valid: [
    // real subject with a constant expected value — the Q1 keep-list
    `const STATUS_OK = 'ok';
     it('maps OK', () => { expect(normalizeStatus('OK')).toBe(STATUS_OK); });`,
    // identifier subject is NEVER reported (no dataflow claim)
    `it('uses a constant subject', () => { expect(someConstant).toBe('x'); });`,
    // call subject is NEVER reported
    `it('calls the subject', () => { expect(compute()).toBe(2); });`,
    // template WITH a substitution is a real subject
    `it('interpolates', () => { expect(\`v-\${version}\`).toBe('v-1'); });`,
    // snapshot and structural matchers over a real subject
    `it('snapshots', () => { expect(render(state)).toMatchSnapshot(); });`,
    // exempt line — the tested exclusion (intentional harness fixture)
    `it('self-checks the harness', () => { expect(true).toBe(true); // audit:exempt — fixture
     });`,
    // outside a test body — outside the declared scope
    `const sanity = expect(true).toBe(true);`,
    // expect with no arguments cannot be judged — not a pure-literal report
    `it('no arg', () => { expect(); });`,
  ],
  invalid: [
    // literal identity — the Q1 archetype
    {
      code: `it('vacuous', () => { expect(true).toBe(true); });`,
      errors: [{ messageId: 'vacuousAssertion' }],
    },
    // literal arithmetic — recomputes a constant, still literal-only
    {
      code: `it('arithmetic', () => { expect(1 + 1).toBe(2); });`,
      errors: [{ messageId: 'vacuousAssertion' }],
    },
    // string literal identity
    {
      code: `it('string identity', () => { expect('deploy-ok').toBe('deploy-ok'); });`,
      errors: [{ messageId: 'vacuousAssertion' }],
    },
    // negation does not rescue a literal-only subject
    {
      code: `it('negated', () => { expect(false).not.toBe(true); });`,
      errors: [{ messageId: 'vacuousAssertion' }],
    },
    // fabricated status: the expected value is produced, the subject is still a bare literal
    {
      code: `it('fabricated', () => { expect(0).toBe(0); });`,
      errors: [{ messageId: 'vacuousAssertion' }],
    },
    // substitution-free template literal is still a pure literal
    {
      code: "it('template', () => { expect(`ok`).toBe('ok'); });",
      errors: [{ messageId: 'vacuousAssertion' }],
    },
    // unary over a literal
    {
      code: `it('unary', () => { expect(-1).toBe(-1); });`,
      errors: [{ messageId: 'vacuousAssertion' }],
    },
    // paired negatives over the UNARY_PURE_OPERATORS set (kills per-operator mutants)
    {
      code: `it('typeof literal', () => { expect(typeof 'a').toBe('string'); });`,
      errors: [{ messageId: 'vacuousAssertion' }],
    },
    {
      code: `it('void literal', () => { expect(void 0).toBe(undefined); });`,
      errors: [{ messageId: 'vacuousAssertion' }],
    },
    // fires under it.only / test.each wrappers too (kill the wrapper-seeing-through mutants)
    {
      code: `it.only('only variant', () => { expect(true).toBe(true); });`,
      errors: [{ messageId: 'vacuousAssertion' }],
    },
    {
      code: `test.each([1])('each variant', (n) => { expect(1 + 1).toBe(2); });`,
      errors: [{ messageId: 'vacuousAssertion' }],
    },
    // the exempt token on the WRONG line does not suppress (kill line-offset mutants)
    {
      code: `// audit:exempt
     it('misplaced exemption', () => { expect(true).toBe(true); });`,
      errors: [{ messageId: 'vacuousAssertion' }],
    },
  ],
});
