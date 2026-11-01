import { describe, expect, it } from 'vitest';
import { formatStamp } from './delivered.ts';

// Wrong-import good companion — the DELIVERED implementation is imported and its
// documented behavior asserted.
describe('wrong import (review-routed) good companion: asserts the delivered module', () => {
  it('formatStamp renders an ISO-8601 stamp of the given instant', () => {
    expect(formatStamp(0)).toBe('1970-01-01T00:00:00.000Z');
    expect(formatStamp(86_400_000)).toBe('1970-01-02T00:00:00.000Z');
  });
});
