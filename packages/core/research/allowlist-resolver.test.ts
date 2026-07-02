// Tiered allowlist resolver — S1 suite (Tier 0 + Tier 2).
// Paired negatives per kickoff §5 S1 (each observed RED before its fix — TDD).
import { describe, it, expect } from 'vitest';
import {
  canonicalizeHost,
  isIpLiteral,
  hasPunycodeLabel,
  hostMatches,
} from './allowlist-resolver.ts';

describe('host invariant helpers', () => {
  it('canonicalizes case and trailing dot; rejects IP literals (bare IPv4 + bracketed IPv6)', () => {
    expect(canonicalizeHost('NextJS.org.')).toBe('nextjs.org');
    expect(isIpLiteral('127.0.0.1')).toBe(true);
    expect(isIpLiteral('[::1]')).toBe(true); // URL.hostname keeps brackets
    expect(isIpLiteral('nextjs.org')).toBe(false);
  });
  it('detects xn-- per DNS label (URL.hostname is already ASCII)', () => {
    expect(hasPunycodeLabel('xn--caf-dma.com')).toBe(true);
    expect(hasPunycodeLabel('docs.xn--caf-dma.com')).toBe(true);
    expect(hasPunycodeLabel('nextjs.org')).toBe(false);
  });
  it('matches bare domain inclusive of subdomains, segment-safe', () => {
    expect(hostMatches('nextjs.org', ['nextjs.org'])).toBe(true);
    expect(hostMatches('docs.nextjs.org', ['nextjs.org'])).toBe(true);
    expect(hostMatches('evilnextjs.org', ['nextjs.org'])).toBe(false); // no substring match
  });
});

// --- Task 1.2: Tier-2 ack file — fail-closed parsing ---
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadAckFile, AckFileError } from './allowlist-resolver.ts';

function ackFile(entries: unknown[]): string {
  const p = join(mkdtempSync(join(tmpdir(), 'ack-')), 'research-allowlist.json');
  writeFileSync(p, JSON.stringify({ entries }, null, 2));
  return p;
}
const GOOD = {
  key: 'drizzle.docs',
  hosts: ['orm.drizzle.team'],
  reason: 'ORM docs for researched practices',
  ackedBy: 'art',
  ackedAt: '2026-07-02',
};

describe('Tier-2 ack file — fail-closed parsing', () => {
  it('S1-N2: entry WITHOUT ack fields fails', () => {
    const { ackedBy: _drop, ...noAck } = GOOD;
    expect(() => loadAckFile(ackFile([noAck]))).toThrow(AckFileError);
  });
  it('S1-N3: malformed ackedAt date fails (shape-valid but not a real date)', () => {
    expect(() => loadAckFile(ackFile([{ ...GOOD, ackedAt: 'yesterday' }]))).toThrow(AckFileError);
    expect(() => loadAckFile(ackFile([{ ...GOOD, ackedAt: '2026-13-45' }]))).toThrow(AckFileError);
  });
  it('rejects IP-literal hosts, single-label hosts, and duplicate keys (cross-tier invariant, fail-closed)', () => {
    expect(() => loadAckFile(ackFile([{ ...GOOD, hosts: ['127.0.0.1'] }]))).toThrow(AckFileError);
    // A bare TLD (single-label host) authorizes an entire TLD via hostMatches (`host === 'com'
    // || host.endsWith('.com')`) — a whole-*.com widening from a human typo (`com` for `docs.com`).
    // Rejected at load time, same fail-closed family as the IP-literal reject above.
    expect(() => loadAckFile(ackFile([{ ...GOOD, hosts: ['com'] }]))).toThrow(AckFileError);
    expect(() => loadAckFile(ackFile([GOOD, { ...GOOD, reason: 'dup' }]))).toThrow(AckFileError);
  });
  it('positive control: a well-formed two-label ack loads, hosts canonicalized', () => {
    const m = loadAckFile(ackFile([{ ...GOOD, hosts: ['ORM.Drizzle.Team.'] }]));
    expect(m.get('drizzle.docs')?.hosts).toEqual(['orm.drizzle.team']);
  });
  it('D1 NEW-2: every AckFileError throw site carries .diagnostics: [FF2014] (message unchanged)', () => {
    const assertFF2014 = (fn: () => void, expectedMessage?: string) => {
      let caught: unknown;
      try {
        fn();
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(AckFileError);
      const err = caught as InstanceType<typeof AckFileError>;
      expect(err.diagnostics).toHaveLength(1);
      expect(err.diagnostics[0]?.code).toBe('FF2014');
      expect(err.diagnostics[0]?.message).toBe(err.message);
      if (expectedMessage !== undefined) expect(err.message).toBe(expectedMessage);
    };
    // bad shape (missing ackedBy)
    const { ackedBy: _drop, ...noAck } = GOOD;
    assertFF2014(() => loadAckFile(ackFile([noAck])));
    // malformed ackedAt date
    assertFF2014(() => loadAckFile(ackFile([{ ...GOOD, ackedAt: 'yesterday' }])));
    // IP-literal host
    assertFF2014(() => loadAckFile(ackFile([{ ...GOOD, hosts: ['127.0.0.1'] }])));
    // single-label host (#857)
    assertFF2014(() => loadAckFile(ackFile([{ ...GOOD, hosts: ['com'] }])));
    // duplicate key
    assertFF2014(() => loadAckFile(ackFile([GOOD, { ...GOOD, reason: 'dup' }])));
    // bad JSON (raw, non-entries write)
    const p = join(mkdtempSync(join(tmpdir(), 'ack-badjson-')), 'research-allowlist.json');
    writeFileSync(p, '{ not valid json');
    assertFF2014(() => loadAckFile(p));
  });
  it('missing file resolves to empty (fail-closed default, not an error)', () => {
    expect(loadAckFile('/nonexistent/research-allowlist.json').size).toBe(0);
  });
});

// --- Task 1.3: resolveAllowedSources + two-arg validateProvenance (Tiers 0+2) ---
import { resolveAllowedSources, validateProvenance } from './allowlist-resolver.ts';
import type { Provenance } from './types.ts';

const PROV = (over: { url: string; allowlistKey: string }): Provenance => ({
  fetchedAt: '2026-07-02T00:00:00Z',
  ...over,
});
const ctxWith = (entries: unknown[]) =>
  resolveAllowedSources({ root: '/tmp/unused', ackFilePath: ackFile(entries) });

describe('validateProvenance(p, resolved) — S1 tiers 0+2', () => {
  const resolvedEmpty = resolveAllowedSources(); // no ctx: tier0 only, tier2 empty, zero fs

  it('S1-N1: unknown key still fails', () => {
    const v = validateProvenance(
      PROV({ url: 'https://orm.drizzle.team/docs', allowlistKey: 'drizzle.docs' }),
      resolvedEmpty,
    );
    expect(v).not.toBeNull();
    expect(v?.code).toBe('FF2005');
    expect(v?.message).toMatch(/unknown allowlistKey/);
  });
  it('S1-N4: http:// fails even for a known key', () => {
    const v = validateProvenance(
      PROV({ url: 'http://nextjs.org/docs', allowlistKey: 'next.official' }),
      resolvedEmpty,
    );
    expect(v).not.toBeNull();
    expect(v?.code).toBe('FF2002');
    expect(v?.message).toMatch(/non-https/);
  });
  it('S1-N5: xn-- host fails outside an explicit Tier-2 ack', () => {
    const resolved = ctxWith([GOOD]); // acks orm.drizzle.team only
    const v = validateProvenance(
      PROV({ url: 'https://xn--caf-dma.com/x', allowlistKey: 'drizzle.docs' }),
      resolved,
    );
    // Not punycode-specific here: the ack exists for this key but does not
    // cover this host at all (acked hosts: orm.drizzle.team only), so this
    // hits the Tier-2 host-mismatch branch (FF2013) before the punycode
    // carve-out check is ever reached. Message still contains "xn--" (the
    // host itself), matching the original pre-migration assertion's intent.
    expect(v).not.toBeNull();
    expect(v?.code).toBe('FF2013');
    expect(v?.message).toMatch(/xn--|punycode/);
  });
  it('carve-out: an explicitly-acked punycode host passes (kickoff §4)', () => {
    const resolved = ctxWith([{ ...GOOD, key: 'idn.docs', hosts: ['xn--caf-dma.com'] }]);
    const v = validateProvenance(
      PROV({ url: 'https://xn--caf-dma.com/x', allowlistKey: 'idn.docs' }),
      resolved,
    );
    expect(v).toBeNull();
  });
  it('positive control: well-formed ack authorizes its key + host (subdomain-inclusive)', () => {
    const resolved = ctxWith([GOOD]);
    expect(
      validateProvenance(
        PROV({ url: 'https://orm.drizzle.team/docs/rls', allowlistKey: 'drizzle.docs' }),
        resolved,
      ),
    ).toBeNull();
    expect(
      validateProvenance(
        PROV({ url: 'https://docs.orm.drizzle.team/x', allowlistKey: 'drizzle.docs' }),
        resolved,
      ),
    ).toBeNull();
  });
  it('Tier-2 scope-lock: scoped ack rejects a mismatched entryPackage', () => {
    const resolved = ctxWith([{ ...GOOD, scope: 'drizzle-orm' }]);
    const p = PROV({ url: 'https://orm.drizzle.team/docs', allowlistKey: 'drizzle.docs' });
    expect(validateProvenance(p, resolved, { entryPackage: 'drizzle-orm' })).toBeNull();
    const rejected = validateProvenance(p, resolved, { entryPackage: 'hono' });
    expect(rejected).not.toBeNull();
    expect(rejected?.code).toBe('FF2012');
  });
  it('Tier-0 regression: builtin key + host passes through the new path; IP literal rejected', () => {
    expect(
      validateProvenance(
        PROV({ url: 'https://nextjs.org/docs', allowlistKey: 'next.official' }),
        resolvedEmpty,
      ),
    ).toBeNull();
    const rejected = validateProvenance(
      PROV({ url: 'https://127.0.0.1/docs', allowlistKey: 'next.official' }),
      resolvedEmpty,
    );
    expect(rejected).not.toBeNull();
    expect(rejected?.code).toBe('FF2003');
  });
  // The one-arg wrapper is NOT byte-identical to the pre-refactor validator: the §4
  // cross-tier invariants apply to Tier-0 too, so three edge inputs diverge. Pinned
  // here so the divergence is a tested invariant, not an untested "zero behavior
  // change" prose claim (the project's own #trap-stated-but-not-enforced).
  it('Tier-0 §4 cross-tier divergences from the pre-refactor validator are pinned', () => {
    // (a) trailing-dot FQDN of an allowed host: pre-refactor returned ok:false
    // (hostname "nextjs.org." did not match); canonicalization now resolves ok:true.
    expect(
      validateProvenance(
        PROV({ url: 'https://nextjs.org./docs', allowlistKey: 'next.official' }),
        resolvedEmpty,
      ),
    ).toBeNull();
    // (b) IP-literal on a Tier-0 key: pre-refactor generic "host ... not allowed";
    // now a specific IP-literal reason. Diagnostic stays non-null either way.
    const ip = validateProvenance(
      PROV({ url: 'https://127.0.0.1/docs', allowlistKey: 'next.official' }),
      resolvedEmpty,
    );
    expect(ip).not.toBeNull();
    expect(ip?.code).toBe('FF2003');
    expect(ip?.message).toMatch(/IP-literal/);
    // (c) punycode on a Tier-0 key: pre-refactor generic "host ... not allowed";
    // now a specific punycode reason. Diagnostic stays non-null either way.
    const idn = validateProvenance(
      PROV({ url: 'https://xn--caf-dma.com/x', allowlistKey: 'next.official' }),
      resolvedEmpty,
    );
    expect(idn).not.toBeNull();
    expect(idn?.code).toBe('FF2004');
    expect(idn?.message).toMatch(/punycode|xn--/);
  });
});
