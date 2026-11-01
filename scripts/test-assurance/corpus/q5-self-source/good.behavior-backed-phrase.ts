import { describe, expect, it } from 'vitest';

// Q5 good companion — the obligation token is backed by INVOKED behavior: the real
// helper runs and its observable effect is asserted (not merely named).
let sealed = false;

export function ensureSealed(): boolean {
  sealed = true;
  return sealed;
}

describe('q5 good: phrase backed by invoked behavior', () => {
  it('ensureSealed seals the unit', () => {
    expect(ensureSealed()).toBe(true);
    expect(sealed).toBe(true);
  });
});
