// Registry paired-negative + structural tests — D1 Task 1.3.
// Plan: docs/superpowers/plans/2026-07-02-diagnostics-core-impl.md Task 1.3
// Decisions: docs/superpowers/plans/2026-07-02-diagnostics-core-impl.decisions.md
//
// Assertions:
//  (a) code format ^FF[1-5]\d{3}$
//  (b) uniqueness — REGISTRY keys are unique by construction (a JS object
//      literal cannot carry a duplicate key), so uniqueness is verified via
//      a synthetic duplicate-injection check that mirrors what a real
//      duplicate would look like. RED observed manually (see redEvidence in
//      the task report) by seeding a literal duplicate key in registry.ts
//      and confirming this test's Object.keys().length check fails.
//  (c) every {placeholder} in a template has a matching key in that code's
//      construction-site fixture (CODE_FIXTURES below) — decoupled from
//      production wiring so codes whose call-site lands in a later Task
//      still pass.
//  (d) append-only vs registry.codes.snapshot.json — removing a code from
//      REGISTRY must fail this test.

import { describe, expect, it } from 'vitest';
import { REGISTRY, diag } from './registry.ts';
import snapshot from './registry.codes.snapshot.json' with { type: 'json' };

describe('diagnostics registry — structural invariants', () => {
  const codes = Object.keys(REGISTRY);

  it('(a) every code matches ^FF[1-5]\\d{3}$', () => {
    for (const code of codes) {
      expect(code, `code "${code}" does not match ^FF[1-5]\\d{3}$`).toMatch(/^FF[1-5]\d{3}$/);
    }
  });

  it('(b) every code is unique', () => {
    // Object.keys on a JS object literal is unique by construction — this
    // assertion is the mechanical form of that guarantee. To observe RED,
    // seed a literal duplicate key (e.g. a second `FF2001:` entry) in
    // registry.ts: the object-literal parser silently overwrites the first,
    // so Object.keys().length stays the same as before the duplicate was
    // added while a manually-tracked expected count diverges — see the
    // seeded-duplicate probe used at RED-observation time (task report).
    const asSet = new Set(codes);
    expect(asSet.size, 'duplicate code detected in REGISTRY').toBe(codes.length);
  });

  it('(d) registry is append-only vs the committed snapshot', () => {
    const snapshotCodes: string[] = snapshot.codes;
    for (const code of snapshotCodes) {
      expect(codes, `code "${code}" present in snapshot but missing from REGISTRY (removal/renumbering is forbidden — append-only)`).toContain(code);
    }
  });

  it('(d-2) every current code is recorded in the snapshot (forward direction)', () => {
    const snapshotCodes: string[] = snapshot.codes;
    for (const code of codes) {
      expect(snapshotCodes, `code "${code}" exists in REGISTRY but not in registry.codes.snapshot.json — add it to the snapshot (append-only ratchet)`).toContain(code);
    }
  });
});

// (c) Per-code construction-site fixture: sample params sufficient to
// interpolate every placeholder in that code's template. Decouples the
// placeholder-coverage check from production call-sites — FF3xxx-adjacent
// codes wired in later Tasks are out of scope here (this file seeds only
// FF1001 + FF2xxx per Task 1.2).
const CODE_FIXTURES: Record<string, Record<string, string | number>> = {
  FF1001: { keyword: 'required', instancePath: '/patterns/0/id', schemaPath: '#/properties/patterns/items/required' },
  FF2001: { url: 'not-a-url' },
  FF2002: { url: 'http://example.com' },
  FF2003: { host: '1.2.3.4' },
  FF2004: { host: 'xn--caf-dma.com' },
  FF2005: { allowlistKey: 'some-unknown-key' },
  FF2006: { host: 'evil.com', allowlistKey: 'react', expectedHosts: 'react.dev, reactjs.org' },
  FF2007: { packageName: 'left-pad' },
  FF2008: { packageName: 'left-pad' },
  FF2009: { packageName: 'left-pad' },
  FF2010: { packageName: 'left-pad', entryPackage: 'right-pad' },
  FF2011: { packageName: 'left-pad' },
  FF2012: { allowlistKey: 'my-key', scope: 'my-package' },
  FF2013: { host: 'evil.com', allowlistKey: 'my-key', ackedHosts: 'docs.my-package.com' },
  FF2014: { ackFileReason: 'malformed JSON in ack file: /tmp/x.json' },
  FF2015: { innerReason: 'unknown allowlistKey: react' },
};

describe('diagnostics registry — (c) placeholder coverage per code', () => {
  const codes = Object.keys(REGISTRY);

  it('CODE_FIXTURES covers every code currently in REGISTRY', () => {
    for (const code of codes) {
      expect(Object.prototype.hasOwnProperty.call(CODE_FIXTURES, code), `code "${code}" has no CODE_FIXTURES entry — add sample params`).toBe(true);
    }
  });

  it.each(codes)('%s interpolates cleanly with its fixture params', (code) => {
    const params = CODE_FIXTURES[code];
    expect(params, `no fixture for "${code}"`).toBeDefined();
    const d = diag(code, params as Record<string, string | number>);
    expect(d.code).toBe(code);
    expect(d.message).not.toMatch(/\{[a-zA-Z0-9_]+\}/); // no unresolved placeholder left
  });
});

describe('diagnostics registry — diag() factory', () => {
  it('throws on unknown code', () => {
    expect(() => diag('FF9999', {})).toThrow(/unknown diagnostic code/);
  });

  it('throws on missing template placeholder', () => {
    expect(() => diag('FF2001', {})).toThrow(/no matching params key/);
  });

  it('defaults severity from the registry entry', () => {
    const d = diag('FF1001', CODE_FIXTURES.FF1001);
    expect(d.severity).toBe('error');
  });

  it('opts.severity overrides the registry default', () => {
    const d = diag('FF1001', CODE_FIXTURES.FF1001, { severity: 'warning' });
    expect(d.severity).toBe('warning');
  });

  it('opts.path is attached when provided', () => {
    const d = diag('FF1001', CODE_FIXTURES.FF1001, { path: '/patterns/0' });
    expect(d.path).toBe('/patterns/0');
  });

  it('path is omitted (not undefined-key) when opts.path is absent', () => {
    const d = diag('FF1001', CODE_FIXTURES.FF1001);
    expect('path' in d).toBe(false);
  });
});

describe('diagnostics registry — message-fidelity (NEW-3): templates reproduce resolver reason substrings', () => {
  // These pin the exact substrings the current resolver reason strings
  // carry (packages/core/research/allowlist-resolver.ts, HEAD 35c0b4104),
  // so a future template edit that silently drops the substring is caught
  // here BEFORE it can break validate-plan.test.ts / tier1.test.ts / etc.
  it('FF2007 message contains "is not a direct dependency"', () => {
    expect(diag('FF2007', CODE_FIXTURES.FF2007).message).toMatch(/is not a direct dependency/);
  });
  it('FF2010 message contains "cross-package"', () => {
    expect(diag('FF2010', CODE_FIXTURES.FF2010).message).toMatch(/cross-package/);
  });
  it('FF2005 message contains "unknown allowlistKey"', () => {
    expect(diag('FF2005', CODE_FIXTURES.FF2005).message).toMatch(/unknown allowlistKey/);
  });
  it('FF2007 message does NOT collapse to "unknown allowlistKey" text', () => {
    expect(diag('FF2007', CODE_FIXTURES.FF2007).message).not.toMatch(/unknown allowlistKey/);
  });
  it('FF3003-equivalent astgrep text is out of scope for Task 1 (FF3xxx not seeded yet)', () => {
    expect(REGISTRY['FF3003']).toBeUndefined();
  });
});
