import { describe, expect, it } from 'vitest';

// recovery-d011 naming-population good fixture — constant expected value on a
// real subject call (same keep-list class as corpus q1-vacuous/good.constant-on-subject.ts).
const STATUS_OK = 'ok';
function normalizeStatus(raw) {
  return raw.trim().toLowerCase() === 'ok' ? STATUS_OK : 'failed';
}
describe('recovery-d011 population good', () => {
  it('asserts the subject output against a constant', () => {
    expect(normalizeStatus(' Ok ')).toBe(STATUS_OK);
    expect(normalizeStatus(' no ')).toBe('failed');
  });
});
