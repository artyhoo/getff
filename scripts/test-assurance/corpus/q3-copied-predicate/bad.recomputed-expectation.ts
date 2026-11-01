import { describe, expect, it } from 'vitest';

// Q3 bad case — RECOMPUTED EXPECTATION (spec §5: «Reimplementing the production
// predicate in the test and asserting the copy instead of invoking the delivered
// implementation»). The local copy never imports ./subject — that is the defect.
// Detection channel: the pinned-fault counterfactual audit (Batch D), NOT a static
// rule — no AST-dataflow claim is made (kickoff constraint).
function isAdultCopy(age: number): boolean {
  return age >= 18;
}

describe('q3 bad: local copy instead of the delivered predicate', () => {
  it('checks the boundary against its own copy', () => {
    expect(isAdultCopy(21)).toBe(true);
  });
});
