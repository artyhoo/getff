import { describe, expect, it } from 'vitest';
import { formatStamp } from './lookalike.ts';

// Wrong-import case — REVIEW-CHANNEL-ROUTED (honest limit, spec §1: a universal
// semantic detector is not to be advertised). The test asserts against the
// look-alike module instead of the delivered `./delivered.ts`; the assertion is
// consistent with the module it actually imported, so it is green and no
// syntax-only gate may claim it. Detection channel: the named cold-review
// protocol + blocking dispositions queue (see s1/honest-limits.md,
// s1/dispositions.md) — recorded here so the class has an explicit channel,
// never a silent skip.
describe('wrong import (review-routed): asserts the look-alike module', () => {
  it('formatStamp renders the epoch', () => {
    expect(formatStamp(0)).toBe('1970-01-01T00:00:00.000Z');
  });
});
