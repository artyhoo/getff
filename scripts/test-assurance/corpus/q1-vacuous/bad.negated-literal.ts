import { describe, expect, it } from 'vitest';

// Q1 bad case — negated form: `expect(<literal>).not.<matcher>(<literal>)`. Vacuity
// does not depend on the negation flag; the decidable contract keys on the
// literal-only subject.
describe('q1 bad: negated literal pair', () => {
  it('cannot fail because both sides are literals', () => {
    expect(false).not.toBe(true);
  });
});
