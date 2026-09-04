// Stage S4 — ecosystem-prefix dispatch in tier1For (research-source-trust.md §4).
// A `packageName` may carry an explicit "<ecosystem>:<bareName>" prefix
// (ecosystem-name.ts). tier1For must: (1) strip a prefix matching the wired
// adapter's ecosystem before calling listDirectDeps/readInstalledMeta with the
// bare name; (2) fail-closed miss when the prefix does NOT match the wired
// adapter's ecosystem (cross-ecosystem request against a single-ecosystem
// ResolveCtx); (3) treat an unprefixed name as npm-implicit (back-compat,
// unchanged from S2/S3).
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveAllowedSources, validateProvenance } from './allowlist-resolver.ts';
import { npmAdapter } from './ecosystem-npm.ts';
import { cargoAdapter } from './ecosystem-cargo.ts';
import type { Provenance } from './types.ts';

const PROV = (over: Partial<Provenance> & { url: string; allowlistKey: string }): Provenance =>
  ({ fetchedAt: '2026-07-03T00:00:00Z', ...over }) as Provenance;

function makeCargoRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'ecosystem-prefix-cargo-'));
  writeFileSync(
    join(root, 'Cargo.toml'),
    `[package]\nname = "consumer"\nversion = "0.1.0"\n\n[dependencies]\nserde = "1.0"\n`,
  );
  const vendorDir = join(root, 'vendor', 'serde');
  mkdirSync(vendorDir, { recursive: true });
  writeFileSync(
    join(vendorDir, 'Cargo.toml'),
    `[package]\nname = "serde"\nversion = "1.0.0"\nhomepage = "https://serde.rs"\n`,
  );
  return root;
}

function makeNpmRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'ecosystem-prefix-npm-'));
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({ dependencies: { 'drizzle-orm': '^0.40.0' } }, null, 2),
  );
  const nm = join(root, 'node_modules', 'drizzle-orm');
  mkdirSync(nm, { recursive: true });
  writeFileSync(
    join(nm, 'package.json'),
    JSON.stringify({ name: 'drizzle-orm', homepage: 'https://orm.drizzle.team' }, null, 2),
  );
  return root;
}

function makeCargoRootWithHomepage(homepage: string): string {
  const root = mkdtempSync(join(tmpdir(), 'ecosystem-prefix-cargo-mth-'));
  writeFileSync(
    join(root, 'Cargo.toml'),
    `[package]\nname = "consumer"\nversion = "0.1.0"\n\n[dependencies]\nserde = "1.0"\n`,
  );
  const vendorDir = join(root, 'vendor', 'serde');
  mkdirSync(vendorDir, { recursive: true });
  writeFileSync(
    join(vendorDir, 'Cargo.toml'),
    `[package]\nname = "serde"\nversion = "1.0.0"\nhomepage = "${homepage}"\n`,
  );
  return root;
}

describe('tier1For — ecosystem-prefix dispatch (S4)', () => {
  // @arm:B2:pos value-guard-containment (a KNOWN prefix matching the wired
  // adapter resolves — the paired positive for the F4 fail-closed negatives below)
  it('cargo: prefix with cargo adapter resolves Tier-1', () => {
    const root = makeCargoRoot();
    const resolved = resolveAllowedSources({ root, adapter: cargoAdapter });
    expect(resolved.tier1For('cargo:serde')).toMatchObject({ ok: true, hosts: ['serde.rs'] });
  });

  it('cargo: a multi-tenant-host homepage (github.com) is dropped by the SHARED candidateFields filter chain — not just an npm-specific rule (research-source-trust.md §5 item C)', () => {
    // Negative arm: homepage is a known multi-tenant apex — must NOT
    // authorize Tier-1 (proves the drop happens via the shared
    // canonicalize→IP-literal→punycode→isMultiTenantHost chain in
    // resolveAllowedSources's tier1For, on the cargo derivation surface,
    // not a parallel filter specific to npm).
    const poisonedRoot = makeCargoRootWithHomepage('https://github.com');
    const poisonedResolved = resolveAllowedSources({ root: poisonedRoot, adapter: cargoAdapter });
    const r = poisonedResolved.tier1For('cargo:serde');
    expect(r.ok).toBe(false);

    // Positive control: a clean, single-tenant host still authorizes —
    // proves the drop above is host-specific (multi-tenant), not a general
    // cargo-derivation breakage.
    const cleanRoot = makeCargoRootWithHomepage('https://serde.rs');
    const cleanResolved = resolveAllowedSources({ root: cleanRoot, adapter: cargoAdapter });
    expect(cleanResolved.tier1For('cargo:serde')).toMatchObject({
      ok: true,
      hosts: ['serde.rs'],
    });
  });

  it('cargo: prefix with npm adapter wired fails closed (ecosystem mismatch, not silently tried as npm)', () => {
    const root = makeNpmRoot();
    const resolved = resolveAllowedSources({ root, adapter: npmAdapter });
    const r = resolved.tier1For('cargo:serde');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/ecosystem mismatch|ecosystem/i);
  });

  it('ecosystem mismatch surfaces its own diagnostic code (FF2016), distinct from the generic no-eligible-host FF2009', () => {
    const root = makeNpmRoot();
    const resolved = resolveAllowedSources({ root, adapter: npmAdapter });
    const v = validateProvenance(
      PROV({
        url: 'https://serde.rs/derive.html',
        allowlistKey: 'cargo:serde', // unknown to Tier-0 — falls through to Tier-1
        packageName: 'cargo:serde',
      }),
      resolved,
      { entryPackage: 'cargo:serde' },
    );
    expect(v).not.toBeNull();
    expect(v?.code).toBe('FF2016');
  });

  it('npm: prefix with npm adapter resolves Tier-1 (explicit prefix, same result as unprefixed)', () => {
    const root = makeNpmRoot();
    const resolved = resolveAllowedSources({ root, adapter: npmAdapter });
    expect(resolved.tier1For('npm:drizzle-orm')).toMatchObject({
      ok: true,
      hosts: ['orm.drizzle.team'],
    });
  });

  it('unprefixed name defaults to npm (back-compat, unchanged behavior)', () => {
    const root = makeNpmRoot();
    const resolved = resolveAllowedSources({ root, adapter: npmAdapter });
    expect(resolved.tier1For('drizzle-orm')).toMatchObject({
      ok: true,
      hosts: ['orm.drizzle.team'],
    });
  });

  // Title drift fixed at adapter-jig time: since LG-S4 shipped pipAdapter, `pip`
  // is a KNOWN prefix (ecosystem-name.ts KNOWN_ECOSYSTEM_PREFIXES), so this
  // fixture exercises the cross-ecosystem MISMATCH branch (known prefix ≠ wired
  // adapter), NOT the parse-level 'unknown' branch — the genuinely-unknown-prefix
  // F4 fixture is the gem: test below.
  it('known-but-unwired ecosystem prefix (pip: vs cargo adapter) fails closed via the mismatch branch', () => {
    const root = makeCargoRoot();
    const resolved = resolveAllowedSources({ root, adapter: cargoAdapter });
    const r = resolved.tier1For('pip:requests');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/ecosystem "pip"/);
  });

  // @arm:B2:neg value-guard-containment (F4 fail-closed: a genuinely-UNKNOWN
  // prefix — gem: has no adapter — parses to ecosystem:'unknown'
  // (ecosystem-name.ts:45) and can match NO wired adapter, so tier1For always
  // misses. The reason string pins the 'unknown' parse verdict, discriminating
  // this branch from the known-prefix mismatch above. RED-proof: inverted
  // assertion (`ok → toBe(true)`) observed failing ("expected false to be
  // true") before landing this GREEN form.)
  it('genuinely-unknown prefix (gem: — no adapter exists) hits the F4 unknown fail-closed branch', () => {
    const root = makeCargoRoot();
    const resolved = resolveAllowedSources({ root, adapter: cargoAdapter });
    const r = resolved.tier1For('gem:rails');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/ecosystem "unknown"/);
  });

  it('scope-lock stays prefix-consistent: the RAW-STRING check requires BOTH sides to carry the identical prefixed-or-bare form via validateProvenance', () => {
    const root = makeCargoRoot();
    const resolved = resolveAllowedSources({ root, adapter: cargoAdapter });
    // entryPackage carries the SAME prefixed form as packageName — passes.
    const vOk = validateProvenance(
      PROV({
        url: 'https://serde.rs/derive.html',
        allowlistKey: 'cargo:serde',
        packageName: 'cargo:serde',
      }),
      resolved,
      { entryPackage: 'cargo:serde' },
    );
    expect(vOk).toBeNull();

    // entryPackage is a DIFFERENT package (even same ecosystem) — scope-lock fails.
    const vCross = validateProvenance(
      PROV({
        url: 'https://serde.rs/derive.html',
        allowlistKey: 'cargo:serde',
        packageName: 'cargo:serde',
      }),
      resolved,
      { entryPackage: 'cargo:other-crate' },
    );
    expect(vCross).not.toBeNull();
    expect(vCross?.code).toBe('FF2010');
  });

  it('scope-lock asymmetric-prefix case: packageName="cargo:serde" vs entryPackage="serde" (bare) is a RAW-STRING mismatch — fails closed (FF2010), same crate name notwithstanding', () => {
    // Documents the actual behavior (not a forced change): the scope-lock at
    // allowlist-resolver.ts (`packageName !== opts.entryPackage`) is a plain
    // `!==` on the two strings AS GIVEN — it does not parse either side via
    // parseEcosystemName first. A caller that (by mistake, or by an
    // inconsistent agent-protocol convention) passes a prefixed packageName
    // against a bare entryPackage for the "same" crate sees a scope-lock
    // MISMATCH, not a match on the underlying bare name. This is fail-closed
    // (the request is REJECTED, never silently over-authorized), so it is
    // NOT a security regression — but it IS a caller-ergonomics trap worth
    // flagging: a caller must keep both sides of a scope-locked pair in the
    // SAME form (both prefixed, or both bare) or a legitimate same-package
    // request will be rejected. See summary for the flag to the operator.
    const root = makeCargoRoot();
    const resolved = resolveAllowedSources({ root, adapter: cargoAdapter });
    const vAsymmetric = validateProvenance(
      PROV({
        url: 'https://serde.rs/derive.html',
        allowlistKey: 'cargo:serde',
        packageName: 'cargo:serde',
      }),
      resolved,
      { entryPackage: 'serde' },
    );
    expect(vAsymmetric).not.toBeNull();
    expect(vAsymmetric?.code).toBe('FF2010');
  });
});
