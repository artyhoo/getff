import { describe, expect, it } from 'vitest';

// Q1 bad case — literal-only success (spec §5: «An assertion independent of the
// subject's output (constant versus constant; fabricated success or status)»).
// S0 probe seed: docs/test-assurance-kernel/s0/logs/probes/q1-scratch/vacuous.test.ts.
describe('q1 bad: literal identity', () => {
  it('passes no matter what the subject does', () => {
    expect(true).toBe(true);
  });
});
