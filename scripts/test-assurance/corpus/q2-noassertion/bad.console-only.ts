import { describe, it } from 'vitest';

// Q2 bad case — logging-only body: the body runs, but no assertion call is present.
// A green result here is runner mechanics, not verified behavior (spec §2: status
// alone is never proof).
describe('q2 bad: logging-only body', () => {
  it('logs a success string instead of asserting', () => {
    console.log('subprocess verification passed');
  });
});
