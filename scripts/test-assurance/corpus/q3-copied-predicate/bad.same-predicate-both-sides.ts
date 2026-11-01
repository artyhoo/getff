import { describe, expect, it } from 'vitest';
import { isAdult } from './subject.ts';

// Q3 bad case — SAME DECISION LOGIC ON BOTH SIDES (spec §5: «Computing expected
// output with the same decision logic as actual output»). The expected value is
// produced by the same delivered call under test, so the comparison cannot
// diverge from the implementation. Counterfactual channel (Batch D), not static.
describe('q3 bad: expected computed with the same predicate', () => {
  it('compares the predicate to itself', () => {
    expect(isAdult(21)).toBe(isAdult(21));
  });
});
