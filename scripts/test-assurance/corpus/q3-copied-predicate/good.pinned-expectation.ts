import { describe, expect, it } from 'vitest';
import { isAdult } from './subject.ts';

// Q3 good companion — the DELIVERED predicate is invoked and the expected values
// are PINNED FACTS (an independent oracle), not recomputed through the predicate
// under test. Batch D proves this companion kills the pinned boundary faults
// (MIN_AGE weakened; boundary `>=` shifted) that the bad companions survive.
describe('q3 good: delivered predicate against pinned boundary facts', () => {
  it('rejects below the age of majority', () => {
    expect(isAdult(17)).toBe(false);
  });
  it('accepts at the age of majority', () => {
    expect(isAdult(18)).toBe(true);
  });
});
