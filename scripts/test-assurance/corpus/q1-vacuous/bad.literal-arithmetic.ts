import { describe, expect, it } from 'vitest';

// Q1 bad case — both sides computed from literals (S0 probe seed, second case of
// vacuous.test.ts). The subject expression is pure-literal: no system-under-test
// value can influence the outcome.
describe('q1 bad: literal arithmetic', () => {
  it('computes both sides from literals', () => {
    expect(1 + 1).toBe(2);
  });
});
