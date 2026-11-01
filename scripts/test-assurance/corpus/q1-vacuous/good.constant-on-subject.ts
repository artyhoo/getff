import { describe, expect, it } from 'vitest';

// Q1 good companion — a legitimate CONSTANT EXPECTED VALUE on a real subject
// (spec §5 keep-list: «legitimate constant expected values»). The expected side is
// a constant; the SUBJECT is a real call, so the assertion can fail when the
// subject misbehaves.
const STATUS_OK = 'ok';

function normalizeStatus(raw: string): string {
  return raw.trim().toLowerCase() === 'ok' ? STATUS_OK : 'failed';
}

describe('q1 good: constant expected value on a real subject', () => {
  it('maps the accepted status to the documented constant', () => {
    expect(normalizeStatus('OK')).toBe(STATUS_OK);
  });
  it('maps an unknown status to the failed constant', () => {
    expect(normalizeStatus('bogus')).toBe('failed');
  });
});
