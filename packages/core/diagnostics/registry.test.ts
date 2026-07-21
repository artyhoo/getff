// Registry paired-negative + structural tests — D1 Task 1.3.
// Plan: docs/superpowers/plans/2026-07-02-diagnostics-core-impl.md Task 1.3
// Decisions: docs/superpowers/plans/2026-07-02-diagnostics-core-impl.decisions.md
//
// Assertions:
//  (a) code format ^FF[1-8]\d{3}$
//  (b) uniqueness — checked against the RAW SOURCE TEXT of registry.ts, not
//      Object.keys(REGISTRY). A JS object literal silently collapses a
//      duplicate key before Object.keys() ever runs (the parser keeps only
//      the last occurrence), so any check built on Object.keys/REGISTRY is
//      a tautology that can never observe a real duplicate. Reading the
//      source text and counting `FFxxxx:` key declarations sidesteps the
//      parser collapse entirely — a genuine duplicate `FF2001:` block in
//      registry.ts shows up as two textual occurrences, which this test
//      catches. RED observed by seeding a real second `FF2001:` entry in
//      registry.ts and confirming this test fails (see redEvidence in the
//      task report).
//  (c) every {placeholder} in a template has a matching key in that code's
//      construction-site fixture (CODE_FIXTURES below) — decoupled from
//      production wiring so codes whose call-site lands in a later Task
//      still pass.
//  (d) append-only vs registry.codes.snapshot.json — removing a code from
//      REGISTRY must fail this test.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { REGISTRY, diag } from './registry.ts';

const snapshot = JSON.parse(
  readFileSync(new URL('./registry.codes.snapshot.json', import.meta.url), 'utf8'),
) as { codes: string[] };

// Raw source text of registry.ts — read independently of the compiled/parsed
// REGISTRY object so (b) can see a duplicate key BEFORE the JS object-literal
// parser silently collapses it (which is what makes an Object.keys()-based
// check a tautology — see comment block above).
const registrySource = readFileSync(new URL('./registry.ts', import.meta.url), 'utf8');

// Matches top-level `FFxxxx: {` key declarations inside the REGISTRY object
// literal, e.g. "  FF2001: {" — the exact shape every entry in registry.ts
// uses (see registry.ts:31, :40, etc.).
const REGISTRY_KEY_DECL_RE = /^\s{2}(FF[1-8]\d{3}):\s*\{/gm;

function extractRegistryKeyDeclarations(source: string): string[] {
  const keys: string[] = [];
  for (const match of source.matchAll(REGISTRY_KEY_DECL_RE)) {
    keys.push(match[1]);
  }
  return keys;
}

describe('diagnostics registry — structural invariants', () => {
  const codes = Object.keys(REGISTRY);

  it('(a) every code matches ^FF[1-8]\\d{3}$', () => {
    for (const code of codes) {
      expect(code, `code "${code}" does not match ^FF[1-8]\\d{3}$`).toMatch(/^FF[1-8]\d{3}$/);
    }
  });

  it('(b) every code is unique (checked against registry.ts source text)', () => {
    const declaredKeys = extractRegistryKeyDeclarations(registrySource);
    expect(declaredKeys.length, 'no FFxxxx: key declarations found in registry.ts — regex drifted from source shape').toBeGreaterThan(0);
    const asSet = new Set(declaredKeys);
    expect(
      asSet.size,
      `duplicate code detected in registry.ts source text: ${JSON.stringify(declaredKeys)}`,
    ).toBe(declaredKeys.length);
  });

  it('(b-2) source-text key declarations match REGISTRY runtime keys 1:1', () => {
    // Cross-check: the source-text extraction in (b) must agree with what
    // the parsed REGISTRY object actually exposes, so (b) cannot silently
    // drift from what diag() actually sees at runtime.
    const declaredKeys = extractRegistryKeyDeclarations(registrySource);
    expect(new Set(declaredKeys)).toEqual(new Set(codes));
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
  FF2016: { packageName: 'cargo:serde' },
  // --- FF3xxx: L4 semantic gates (Task 4, DN-D1-4) ---
  FF3001: { details: 'must have required property \'framework\' at /' },
  FF3002: { checkType: 'eslint' },
  FF3003: {},
  FF3004: {},
  FF3005: { idx: 0, expectViolation: 'no-restricted-imports', ruleName: 'no-restricted-imports', got: '[]' },
  FF3006: { ruleId: 'no-restricted-imports', message: 'unexpected violation' },
  FF3007: { ruleName: 'no-restricted-imports', fileName: 'unrelated.tsx', details: "'react' import is restricted" },
  FF3008: { ruleName: 'rules-as-tests/no-such-rule', knownRules: 'rules-as-tests/no-server-imports-in-client' },
  FF3009: { ruleName: 'no-debugger' },
  FF3010: {},
  FF3011: { distance: 22, threshold: 5 },
  FF3012: {},
  FF3013: { declaredMessage: 'Do not use generators', emittedMessage: 'No generators!' },
  FF3014: { declaredMessageId: 'noGen', emittedMessageId: 'other' },
  FF3015: {},
  FF3016: { ruleName: 'no-extra-parens', details: 'Unexpected token' },
  FF3017: { ruleName: 'no-extra-parens', count: 1 },
  FF3018: {},
  FF3019: {},
  FF3020: { count: 1, plural: '' },
  FF3021: { idx: 0, ruleId: 'rules-as-tests/restricted-syntax-audit-exempt', message: 'use Object.hasOwn' },
  // --- FF6xxx: IR grammar gates (MT umbrella S1) ---
  FF6001: { nodeId: 'n1' },
  FF6002: { id: 'n1', count: 2 },
  FF6003: { anchor: 'FF9999', nodeId: 'n1' },
  FF6004: { op: 'all', nodeId: 'n1' },
  // --- FF7xxx: render outcomes (MT umbrella S2 — cargo backend v0) ---
  FF7001: { backend: 'cargo-clippy-toml', selectorClass: 'syntax', nodeId: 'n1' },
  FF7002: { backend: 'cargo-clippy-toml', nodeId: 'n1', missing: 'path' },
  FF7003: { backend: 'cargo-clippy-toml', requested: 'error', nodeId: 'n1' },
  // --- FF8xxx: composition/doc plane (MT umbrella S4 — DocPlan composition gate) ---
  FF8001: { nodeId: 'ghost-1', where: 'section "intro"' },
  FF8002: { nodeId: 'n1', reason: 'reason under 20 chars' },
  FF8003: { nodeId: 'n1', detail: 'placed in both a section and excluded[]' },
  FF8004: { nodeId: 'n1', backend: 'npm-eslint-declarative' },
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
  it('FF3003 astgrep-deferred message matches gate-rule-tester.test.ts:206 assertion', () => {
    expect(diag('FF3003', CODE_FIXTURES.FF3003).message).toMatch(
      /ast-grep engine reserved but not wired/,
    );
  });
});
