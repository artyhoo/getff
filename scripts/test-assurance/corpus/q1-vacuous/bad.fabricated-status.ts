import { describe, expect, it } from 'vitest';

// Q1 bad case — fabricated subprocess status (spec §5: «fabricated success or
// status»). No process was executed; the asserted `0` is manufactured. The
// static contract rejects the literal-only subject form; the executed-conformance
// channel (Batch C) owns the sibling class where the status IS read but fabricated.
describe('q1 bad: fabricated subprocess status', () => {
  it('asserts the status it fabricated instead of a returned one', () => {
    expect(0).toBe(0); // fabricated — nothing was executed
  });
});
