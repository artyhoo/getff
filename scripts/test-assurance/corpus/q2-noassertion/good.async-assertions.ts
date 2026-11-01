import { describe, expect, it } from 'vitest';

// Q2 good companion — a legitimate ASYNC assertion (spec §5 keep-list:
// «asynchronous assertions»). The expectation is await-wrapped; the decidable
// contract counts expect-calls inside the body regardless of await nesting.
async function unstable(): Promise<string> {
  return Promise.reject(new Error('boom'));
}

describe('q2 good: async assertion', () => {
  it('rejects with the documented error', async () => {
    await expect(unstable()).rejects.toThrow(/boom/);
  });
});
