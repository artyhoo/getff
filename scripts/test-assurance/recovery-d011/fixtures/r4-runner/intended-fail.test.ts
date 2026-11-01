import { describe, expect, it } from 'vitest';

// recovery-d011 R4 control — an intended assertion failure.
// Expected classification under the strict runner-result grammar: detection
// (intended-failure detection is preserved separately from infrastructure errors).
describe('r4 intended-failure control', () => {
  it('fails a real assertion on purpose', () => {
    expect(1 + 1).toBe(3);
  });
});
