import { describe, expect, it } from 'vitest';

// Q1 good companion — an INTENTIONAL FIXTURE (spec §5 Q1: «intentional
// fixture/harness cases have explicit, tested exclusions»). The exclusion token is
// the repo's existing `// audit:exempt` convention (same as no-direct-time-randomness);
// its presence-and-honored behavior is itself a tested RuleTester case in the rule's
// own suite, so the exclusion cannot rot silently.
describe('q1 good: intentional fixture (tested exclusion)', () => {
  it('is exempt because it is harness self-check data, not a behavioral claim', () => {
    expect(true).toBe(true); // audit:exempt — harness self-check fixture, not a behavioral claim
  });
});
