import { describe, it } from 'vitest';

// Q2 bad case — awaited side effect with no assertion about it. The await makes the
// body asynchronous, which the decidable contract deliberately does NOT treat as
// effective: awaiting is not asserting (spec §5: recognize «asynchronous
// assertions» — this file has none).
describe('q2 bad: await without assertion', () => {
  it('awaits the runner and checks nothing', async () => {
    await Promise.resolve({ ok: true });
  });
});
