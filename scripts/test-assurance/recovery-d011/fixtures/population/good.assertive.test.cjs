const { describe, expect, it } = require('vitest');

// recovery-d011 naming-population good fixture (CJS) — constant on a real subject call.
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
