import { describe, expect, it } from 'vitest';

// recovery-d011 naming-population bad fixture — literal-identity vacuous assertion
// (same defect class as the frozen corpus q1-vacuous/bad.literal-identity.ts).
describe('recovery-d011 population bad', () => {
  it('passes no matter what the subject does', () => {
    expect(true).toBe(true);
  });
});
