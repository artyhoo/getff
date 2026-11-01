import { describe, it } from 'vitest';

// Q2 bad case — empty body (S0 probe seed, second case of noassertion.test.ts).
describe('q2 bad: empty body', () => {
  it('declares coverage without executing anything', () => {});
});
