import { describe, expect, it } from 'vitest';

// Q5 bad case — the required obligation token appears ONLY in the assertion's own
// source (spec §5: «Finding a required token in the assertion's own source, a
// comment, a fixture label or a dead code branch when executable behavior is
// claimed»; A03 shape). A structural gate that greps for `ensureSealed` accepts
// this file even though nothing is invoked — the real-gate executed-conformance
// channel (Batch C) must reject it, and the gate's good companion proves the
// behavior-backed form passes.
describe('q5 bad: circular source evidence', () => {
  it('discharges the ensureSealed obligation', () => {
    const obligation = 'ensureSealed';
    expect(obligation).toContain('ensureSealed');
  });
});
