import { describe, expect, it } from 'vitest';

// Q1 bad case — fabricated string literal compared to itself. The boundary form of
// the class (the static contract must cover non-boolean literals, not only true/false).
describe('q1 bad: string literal identity', () => {
  it('compares a fabricated literal to itself', () => {
    expect('deploy-ok').toBe('deploy-ok');
  });
});
