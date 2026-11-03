const { describe, expect, it } = require('vitest');

// recovery-d011 naming-population bad fixture (CJS) — literal-identity vacuous assertion.
describe('recovery-d011 population bad', () => {
  it('passes no matter what the subject does', () => {
    expect(true).toBe(true);
  });
});
