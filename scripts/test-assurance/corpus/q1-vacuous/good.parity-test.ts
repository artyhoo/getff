import { describe, expect, it } from 'vitest';

// Q1 good companion — a legitimate PARITY test (spec §5 keep-list: «parity tests»).
// Recorded limit (honest-limits.md): parity cannot establish that BOTH sides are
// correct; it establishes agreement. Both matcher sides are real calls, so the
// static contract admits it — the semantic limit belongs to review, not to a
// syntax gate (spec §1).
function implA(xs: number[]): number {
  return xs.reduce((acc, x) => acc + x, 0);
}

function implB(xs: number[]): number {
  let total = 0;
  for (const x of xs) total += x;
  return total;
}

describe('q1 good: parity between two implementations', () => {
  it('both sum implementations agree on the sample input', () => {
    expect(implA([1, 2, 3])).toEqual(implB([1, 2, 3]));
  });
});
