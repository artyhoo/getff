import { describe, it } from 'vitest';

// Q2 good companion — a legitimate ASSERTION HELPER (spec §5 keep-list: «helper
// assertions»). The decidable static contract recognizes assert*/verify*-named
// calls; whether the helper itself asserts substantively is the helper's own
// suite's obligation — recorded as an honest limit (honest-limits.md), not
// claimed by the syntax gate.
interface ParsedConfig {
  stage: string;
}

function assertParsedShape(value: unknown): asserts value is ParsedConfig {
  if (typeof value !== 'object' || value === null || !('stage' in value)) {
    throw new TypeError('config must carry a stage');
  }
}

describe('q2 good: assertion helper', () => {
  it('validates through the shared helper', () => {
    const value: unknown = JSON.parse('{"stage":"S1"}');
    assertParsedShape(value);
  });
});
