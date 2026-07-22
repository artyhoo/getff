// Stage S4 — cargo EcosystemAdapter: direct deps + installed metadata (offline).
// Mirrors ecosystem-npm.test.ts's table shape for the cargo toolchain axis.
// Kickoff: .claude/orchestrator-prompts/rule-research-trust-tiers/kickoff.md §5 S4.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { cargoAdapter } from './ecosystem-cargo.ts';
import { resolveAllowedSources, validateProvenance } from './allowlist-resolver.ts';
import type { Provenance } from './types.ts';

const PROV = (over: Partial<Provenance> & { url: string }): Provenance =>
  ({ fetchedAt: '2026-07-03T00:00:00Z', allowlistKey: 'unused-in-these-tests', ...over }) as Provenance;

function makeRoot(opts: {
  rootManifest: string; // raw Cargo.toml text for the consumer root
  vendored?: Record<string, string>; // vendor/<name>/Cargo.toml raw text
  pathDeps?: Record<string, string>; // <relative-dir>/Cargo.toml raw text (path deps)
}): string {
  const root = mkdtempSync(join(tmpdir(), 'cargo-adapter-'));
  writeFileSync(join(root, 'Cargo.toml'), opts.rootManifest);
  for (const [name, text] of Object.entries(opts.vendored ?? {})) {
    const dir = join(root, 'vendor', name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'Cargo.toml'), text);
  }
  for (const [relDir, text] of Object.entries(opts.pathDeps ?? {})) {
    const dir = join(root, relDir);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'Cargo.toml'), text);
  }
  return root;
}

describe('cargoAdapter.listDirectDeps', () => {
  it('lists a direct dependency declared in [dependencies]', () => {
    const root = makeRoot({
      rootManifest: `
[package]
name = "consumer"
version = "0.1.0"

[dependencies]
serde = "1.0"
`,
      vendored: { serde: `[package]\nname = "serde"\nversion = "1.0.0"\n` },
    });
    expect(cargoAdapter.listDirectDeps(root).has('serde')).toBe(true);
  });

  it('lists a dev-dependency declared in [dev-dependencies]', () => {
    const root = makeRoot({
      rootManifest: `
[package]
name = "consumer"
version = "0.1.0"

[dev-dependencies]
proptest = "1.0"
`,
      vendored: { proptest: `[package]\nname = "proptest"\nversion = "1.0.0"\n` },
    });
    expect(cargoAdapter.listDirectDeps(root).has('proptest')).toBe(true);
  });

  it('lists a build-dependency declared in [build-dependencies]', () => {
    const root = makeRoot({
      rootManifest: `
[package]
name = "consumer"
version = "0.1.0"

[build-dependencies]
cc = "1.0"
`,
      vendored: { cc: `[package]\nname = "cc"\nversion = "1.0.0"\n` },
    });
    expect(cargoAdapter.listDirectDeps(root).has('cc')).toBe(true);
  });

  it('excludes a dep declared but with no locally-resolvable manifest (fail closed, not a network fetch)', () => {
    const root = makeRoot({
      rootManifest: `
[package]
name = "consumer"
version = "0.1.0"

[dependencies]
not-locally-resolvable = "1.0"
`,
    });
    // Declared in Cargo.toml, but no vendor/path/workspace manifest exists locally.
    expect(cargoAdapter.listDirectDeps(root).has('not-locally-resolvable')).toBe(false);
  });

  // @arm:B3:neg direct-deps-only (adapter-jig B3, cargo lane — the TRUE
  // transitive-with-attacker-metadata negative: a crate locally resolvable in
  // vendor/ with a poisoned homepage but NOT declared in the root manifest must
  // never be listed, so tier1For (which gates on listDirectDeps FIRST,
  // allowlist-resolver.ts:211) never reads its metadata. Distinct from the
  // declared-but-unresolvable exclusion above. RED-proof: inverted assertion
  // (`has('poison') → toBe(true)`) observed failing ("expected false to be
  // true") before landing this GREEN form.
  it('a vendored-but-UNDECLARED crate (attacker metadata) is NOT a direct dep — Tier-1 misses, evil-transitive.example never authorized', () => {
    const root = makeRoot({
      rootManifest: `
[package]
name = "consumer"
version = "0.1.0"

[dependencies]
serde = "1.0"
`,
      vendored: {
        serde: `[package]\nname = "serde"\nversion = "1.0.0"\n`,
        poison: `[package]\nname = "poison"\nversion = "1.0.0"\nhomepage = "https://evil-transitive.example"\n`,
      },
    });
    const deps = cargoAdapter.listDirectDeps(root);
    // Control: the declared+vendored dep IS listed (proves the exclusion below
    // is the undeclared-ness, not a general vendored-branch breakage).
    expect(deps.has('serde')).toBe(true);
    expect(deps.has('poison')).toBe(false);
    const resolved = resolveAllowedSources({ root, adapter: cargoAdapter });
    const r = resolved.tier1For('cargo:poison');
    expect(r).toMatchObject({
      ok: false,
      reason: expect.stringContaining('not a direct dependency'),
    });
  });

  it('resolves an in-tree path dependency', () => {
    // FIX A containment (research-source-trust.md §5 BLOCKER): a path
    // dependency must resolve WITHIN root to get Tier-1 derivation. This
    // test uses an in-tree sibling directory (`crates/local-lib`), matching
    // the module's own documented scope (ecosystem-cargo.ts header comment,
    // "a path dependency's directory ... resolved relative to `root`") — NOT
    // a `../`-escaping out-of-tree path, which is now (correctly) rejected;
    // see the dedicated BLOCKER-exploit tests below for that surface.
    const root = makeRoot({
      rootManifest: `
[package]
name = "consumer"
version = "0.1.0"

[dependencies]
local-lib = { path = "crates/local-lib" }
`,
      pathDeps: {
        'crates/local-lib': `[package]\nname = "local-lib"\nversion = "0.1.0"\nhomepage = "https://local-lib.example"\n`,
      },
    });
    const deps = cargoAdapter.listDirectDeps(root);
    expect(deps.has('local-lib')).toBe(true);
    const meta = cargoAdapter.readInstalledMeta(root, 'local-lib');
    expect(meta?.homepage).toBe('https://local-lib.example');
  });

  it('rejects an out-of-tree sibling-dir path dependency for Tier-1 purposes (containment: no Tier-1 convenience for out-of-tree deps, not a security hole — falls through to Tier-0/Tier-2)', () => {
    const root = makeRoot({
      rootManifest: `
[package]
name = "consumer"
version = "0.1.0"

[dependencies]
local-lib = { path = "../local-lib" }
`,
      pathDeps: {
        '../local-lib': `[package]\nname = "local-lib"\nversion = "0.1.0"\nhomepage = "https://local-lib.example"\n`,
      },
    });
    expect(cargoAdapter.listDirectDeps(root).has('local-lib')).toBe(false);
    expect(cargoAdapter.readInstalledMeta(root, 'local-lib')).toBeNull();
  });

  it('resolves a workspace member', () => {
    const root = makeRoot({
      rootManifest: `
[workspace]
members = ["crates/member-a"]

[package]
name = "consumer"
version = "0.1.0"

[dependencies]
member-a = { path = "crates/member-a" }
`,
      pathDeps: {
        'crates/member-a': `[package]\nname = "member-a"\nversion = "0.1.0"\n`,
      },
    });
    expect(cargoAdapter.listDirectDeps(root).has('member-a')).toBe(true);
  });

  it('malformed root Cargo.toml yields empty deps (fail closed, not a throw)', () => {
    const root = mkdtempSync(join(tmpdir(), 'cargo-adapter-'));
    writeFileSync(join(root, 'Cargo.toml'), '[dependencies\nserde = "1.0"');
    expect(() => cargoAdapter.listDirectDeps(root)).not.toThrow();
    expect(cargoAdapter.listDirectDeps(root).size).toBe(0);
  });

  it('missing root Cargo.toml yields empty deps', () => {
    const root = mkdtempSync(join(tmpdir(), 'cargo-adapter-'));
    expect(cargoAdapter.listDirectDeps(root).size).toBe(0);
  });
});

describe('cargoAdapter.readInstalledMeta', () => {
  it('reads homepage + repository from a vendored Cargo.toml (documentation field present in the manifest but NOT surfaced — InstalledMeta trust surface is homepage/repository only)', () => {
    const root = makeRoot({
      rootManifest: `
[package]
name = "consumer"
version = "0.1.0"

[dependencies]
serde = "1.0"
`,
      vendored: {
        serde: `
[package]
name = "serde"
version = "1.0.0"
homepage = "https://serde.rs"
repository = "https://github.com/serde-rs/serde"
documentation = "https://docs.rs/serde"
`,
      },
    });
    const meta = cargoAdapter.readInstalledMeta(root, 'serde');
    expect(meta?.homepage).toBe('https://serde.rs');
    expect(meta?.repository).toBe('https://github.com/serde-rs/serde');
  });

  it('quote-aware comment stripping: a homepage URL containing a literal `#` fragment is parsed intact, not truncated at the `#`', () => {
    const root = makeRoot({
      rootManifest: `
[package]
name = "consumer"
version = "0.1.0"

[dependencies]
fragged = "1.0"
`,
      vendored: {
        fragged: `
[package]
name = "fragged"
version = "0.1.0"
homepage = "https://good.example/x#frag" # a real trailing comment, stripped
`,
      },
    });
    const meta = cargoAdapter.readInstalledMeta(root, 'fragged');
    expect(meta?.homepage).toBe('https://good.example/x#frag');
  });

  it('returns null for a dep with no locally-resolvable manifest (registry-cache derivation out of scope for S4)', () => {
    const root = makeRoot({
      rootManifest: `
[package]
name = "consumer"
version = "0.1.0"

[dependencies]
registry-only-dep = "1.0"
`,
    });
    expect(cargoAdapter.readInstalledMeta(root, 'registry-only-dep')).toBeNull();
  });

  it('returns null for malformed vendored Cargo.toml (fail closed, never guesses a host)', () => {
    const root = makeRoot({
      rootManifest: `
[package]
name = "consumer"
version = "0.1.0"

[dependencies]
broken = "1.0"
`,
      vendored: { broken: '[package\nhomepage = "https://evil.example"' },
    });
    expect(cargoAdapter.readInstalledMeta(root, 'broken')).toBeNull();
  });

  it('drops a repository inline-table field it cannot trivially extract (fail closed, no guess)', () => {
    const root = makeRoot({
      rootManifest: `
[package]
name = "consumer"
version = "0.1.0"

[dependencies]
weird-repo = "1.0"
`,
      vendored: {
        'weird-repo': `
[package]
name = "weird-repo"
version = "0.1.0"
repository = { workspace = true }
`,
      },
    });
    const meta = cargoAdapter.readInstalledMeta(root, 'weird-repo');
    expect(meta?.repository).toBeUndefined();
  });

  it('rejects a path-traversal dependency name (no fs escape) — non-vacuous: a real Cargo.toml sits at the escape target', () => {
    // Non-vacuous per FIX B item 3: plant a REAL Cargo.toml at the escape
    // target so that removing the isUnsafeDepName guard would flip this test
    // RED (the previous version passed trivially even with the guard removed,
    // because no manifest existed at the resolved path either way).
    const root = makeRoot({
      rootManifest: `
[package]
name = "consumer"
version = "0.1.0"
`,
    });
    // Plant a real, parseable Cargo.toml two levels above `root` — this is
    // where '../../etc/foo' and 'nested/../../escape' would resolve to
    // (root/../../etc/foo/Cargo.toml, root/nested/../../escape/Cargo.toml).
    const outside = resolve(root, '..', '..', 'etc', 'foo');
    mkdirSync(outside, { recursive: true });
    writeFileSync(
      join(outside, 'Cargo.toml'),
      '[package]\nname = "foo"\nhomepage = "https://evil.example"\n',
    );
    const outside2 = resolve(root, 'nested', '..', '..', 'escape');
    mkdirSync(outside2, { recursive: true });
    writeFileSync(
      join(outside2, 'Cargo.toml'),
      '[package]\nname = "escape"\nhomepage = "https://evil.example"\n',
    );

    expect(cargoAdapter.readInstalledMeta(root, '../../etc/foo')).toBeNull();
    expect(cargoAdapter.readInstalledMeta(root, 'nested/../../escape')).toBeNull();
  });

  // ── BLOCKER exploit reproduction (FIX B items 1-2) ──────────────────────
  // resolveDepManifestPath's isUnsafeDepName(pkg) guard (line 226) only
  // covers the DEPENDENCY NAME. It does NOT cover the `path =` VALUE (the
  // path-override branch's traversal check was a dead, empty `if` block) nor
  // the `[workspace] members` VALUE (zero containment at all). Both let a
  // consumer-controlled Cargo.toml declare a dependency whose manifest is
  // read from OUTSIDE `root`, laundering an attacker-controlled `homepage`
  // into Tier-1 trust.

  it('BLOCKER exploit — path-override `path = "../outside"` escapes root and its homepage gets authorized as Tier-1 (pre-fix: RED / authorized; post-fix: GREEN / rejected)', () => {
    const root = makeRoot({
      rootManifest: `
[package]
name = "consumer"
version = "0.1.0"

[dependencies]
poison = { path = "../outside" }
`,
    });
    // Attacker-controlled manifest OUTSIDE root (but still inside the shared
    // tmp parent — a single "../" is enough to demonstrate the escape and
    // matches the realistic Cargo sibling-dir convention the dead guard
    // claimed to allow).
    const outside = resolve(root, '..', 'outside');
    mkdirSync(outside, { recursive: true });
    writeFileSync(
      join(outside, 'Cargo.toml'),
      '[package]\nname = "poison"\nhomepage = "https://evil-docs.example"\n',
    );

    // Adapter-level: the poisoned manifest must not be reachable/resolvable.
    expect(cargoAdapter.readInstalledMeta(root, 'poison')).toBeNull();
    expect(cargoAdapter.listDirectDeps(root).has('poison')).toBe(false);

    // Resolver-level: the evil host must not be authorized via Tier-1.
    const resolved = resolveAllowedSources({ root, adapter: cargoAdapter });
    const diag = validateProvenance(
      PROV({ url: 'https://evil-docs.example/x', packageName: 'cargo:poison' }),
      resolved,
      { entryPackage: 'cargo:poison' },
    );
    expect(diag).not.toBeNull();
  });

  it('BLOCKER exploit — workspace-member `members = ["../../evil-member"]` escapes root and its homepage gets authorized as Tier-1 (pre-fix: RED / authorized; post-fix: GREEN / rejected)', () => {
    const root = makeRoot({
      rootManifest: `
[workspace]
members = ["../../evil-member"]

[package]
name = "consumer"
version = "0.1.0"

[dependencies]
poison-member = { workspace = true }
`,
    });
    // Attacker-controlled workspace-member manifest OUTSIDE root.
    const outside = resolve(root, '..', '..', 'evil-member');
    mkdirSync(outside, { recursive: true });
    writeFileSync(
      join(outside, 'Cargo.toml'),
      '[package]\nname = "poison-member"\nhomepage = "https://evil-docs-member.example"\n',
    );

    expect(cargoAdapter.readInstalledMeta(root, 'poison-member')).toBeNull();
    expect(cargoAdapter.listDirectDeps(root).has('poison-member')).toBe(false);

    const resolved = resolveAllowedSources({ root, adapter: cargoAdapter });
    const diag = validateProvenance(
      PROV({ url: 'https://evil-docs-member.example/x', packageName: 'cargo:poison-member' }),
      resolved,
      { entryPackage: 'cargo:poison-member' },
    );
    expect(diag).not.toBeNull();
  });

  it('legitimate in-tree path dependency still resolves (containment allows in-tree, rejects out-of-tree)', () => {
    const root = makeRoot({
      rootManifest: `
[package]
name = "consumer"
version = "0.1.0"

[dependencies]
local-lib = { path = "crates/local-lib" }
`,
      pathDeps: {
        'crates/local-lib': `[package]\nname = "local-lib"\nversion = "0.1.0"\nhomepage = "https://local-lib.example"\n`,
      },
    });
    const meta = cargoAdapter.readInstalledMeta(root, 'local-lib');
    expect(meta?.homepage).toBe('https://local-lib.example');
    expect(cargoAdapter.listDirectDeps(root).has('local-lib')).toBe(true);
  });

  it('legitimate in-tree workspace member still resolves', () => {
    const root = makeRoot({
      rootManifest: `
[workspace]
members = ["crates/member-a"]

[package]
name = "consumer"
version = "0.1.0"

[dependencies]
member-a = { path = "crates/member-a" }
`,
      pathDeps: {
        'crates/member-a': `[package]\nname = "member-a"\nversion = "0.1.0"\nhomepage = "https://member-a.example"\n`,
      },
    });
    expect(cargoAdapter.listDirectDeps(root).has('member-a')).toBe(true);
    expect(cargoAdapter.readInstalledMeta(root, 'member-a')?.homepage).toBe(
      'https://member-a.example',
    );
  });
});

// ── SECOND BLOCKER: symlink containment bypass (research-source-trust.md §5
// item 2 re-review) ─────────────────────────────────────────────────────────
// isWithinRoot (line ~245) is a purely LEXICAL string check on path.resolve()
// output — resolve() does NOT dereference symlinks — while the manifest read
// (existsSync/readFileSync in readManifest) DOES follow them. An in-tree
// symlink pointing out-of-tree therefore bypasses containment on all three
// resolution branches (path-override, workspace-member, and vendored — the
// last of which had NO isWithinRoot check at all). FIX A requires containment
// on the symlink-resolved REAL path (realpathSync), canonicalizing BOTH the
// candidate AND root before comparing (root itself may sit under a symlinked
// ancestor, e.g. /tmp -> /private/tmp on macOS — one-sided realpath would
// false-reject legitimate in-tree deps; see the positive-control test below).
// @arm:B2:neg value-guard-containment (cargo KNOWN surfaces: all three resolution
// branches — path-override, workspace-member, vendored — escape via in-tree
// symlink out-of-tree → rejected. Each was observed RED pre-fix per the header
// above; RED-proof re-observed at jig time: the temporarily-inverted
// `.not.toBeNull()` on the path-override exploit failed with "expected null not
// to be null" — the fixtures still discriminate post-fix.)
describe('cargoAdapter — symlink containment (2nd BLOCKER, realpath-based)', () => {
  it('BLOCKER exploit — path-override through an in-tree symlink to an out-of-tree Cargo.toml is rejected (pre-fix: RED / authorized; post-fix: GREEN / rejected)', () => {
    const root = mkdtempSync(join(tmpdir(), 'cargo-symlink-root-'));
    const outside = mkdtempSync(join(tmpdir(), 'cargo-symlink-outside-'));
    writeFileSync(
      join(outside, 'Cargo.toml'),
      '[package]\nname = "poison"\nhomepage = "https://evil-docs.example"\n',
    );
    // In-tree symlink whose TARGET is outside root.
    symlinkSync(outside, join(root, 'link'));
    writeFileSync(
      join(root, 'Cargo.toml'),
      `
[package]
name = "consumer"
version = "0.1.0"

[dependencies]
poison = { path = "./link" }
`,
    );

    expect(cargoAdapter.readInstalledMeta(root, 'poison')).toBeNull();
    expect(cargoAdapter.listDirectDeps(root).has('poison')).toBe(false);

    const resolved = resolveAllowedSources({ root, adapter: cargoAdapter });
    expect(resolved.tier1For('cargo:poison').ok).toBe(false);
    const diag = validateProvenance(
      PROV({ url: 'https://evil-docs.example/x', packageName: 'cargo:poison' }),
      resolved,
      { entryPackage: 'cargo:poison' },
    );
    expect(diag).not.toBeNull();
  });

  it('BLOCKER exploit — workspace-member through an in-tree symlink to an out-of-tree Cargo.toml is rejected (pre-fix: RED / authorized; post-fix: GREEN / rejected)', () => {
    const root = mkdtempSync(join(tmpdir(), 'cargo-symlink-root-'));
    const outside = mkdtempSync(join(tmpdir(), 'cargo-symlink-outside-'));
    writeFileSync(
      join(outside, 'Cargo.toml'),
      '[package]\nname = "poison-member"\nhomepage = "https://evil-docs-member.example"\n',
    );
    symlinkSync(outside, join(root, 'memlink'));
    writeFileSync(
      join(root, 'Cargo.toml'),
      `
[workspace]
members = ["memlink"]

[package]
name = "consumer"
version = "0.1.0"

[dependencies]
poison-member = { workspace = true }
`,
    );

    expect(cargoAdapter.readInstalledMeta(root, 'poison-member')).toBeNull();
    expect(cargoAdapter.listDirectDeps(root).has('poison-member')).toBe(false);

    const resolved = resolveAllowedSources({ root, adapter: cargoAdapter });
    expect(resolved.tier1For('cargo:poison-member').ok).toBe(false);
    const diag = validateProvenance(
      PROV({ url: 'https://evil-docs-member.example/x', packageName: 'cargo:poison-member' }),
      resolved,
      { entryPackage: 'cargo:poison-member' },
    );
    expect(diag).not.toBeNull();
  });

  it('BLOCKER exploit — vendored dep directory symlinked out-of-tree is rejected (this branch had ZERO containment pre-fix)', () => {
    const root = mkdtempSync(join(tmpdir(), 'cargo-symlink-root-'));
    const outside = mkdtempSync(join(tmpdir(), 'cargo-symlink-outside-'));
    writeFileSync(
      join(outside, 'Cargo.toml'),
      '[package]\nname = "serde"\nhomepage = "https://evil-vendor.example"\n',
    );
    mkdirSync(join(root, 'vendor'), { recursive: true });
    // vendor/serde -> outside (an out-of-tree dir), instead of a real subdir.
    symlinkSync(outside, join(root, 'vendor', 'serde'));
    writeFileSync(
      join(root, 'Cargo.toml'),
      `
[package]
name = "consumer"
version = "0.1.0"

[dependencies]
serde = "1.0"
`,
    );

    expect(cargoAdapter.readInstalledMeta(root, 'serde')).toBeNull();
    expect(cargoAdapter.listDirectDeps(root).has('serde')).toBe(false);

    const resolved = resolveAllowedSources({ root, adapter: cargoAdapter });
    expect(resolved.tier1For('cargo:serde').ok).toBe(false);
    const diag = validateProvenance(
      PROV({ url: 'https://evil-vendor.example/x', packageName: 'cargo:serde' }),
      resolved,
      { entryPackage: 'cargo:serde' },
    );
    expect(diag).not.toBeNull();
  });

  // @arm:B2:pos value-guard-containment (safe in-tree resolution passes — the
  // containment guard does not over-reject legitimate in-tree symlink aliases)
  it('POSITIVE control — an in-tree symlink whose TARGET is also within root still resolves normally (realpath must not over-reject legitimate in-tree symlinks)', () => {
    // This is the test that would FALSE-FAIL if containment realpath'd only
    // the candidate side and compared it against a lexical (non-realpath'd)
    // root: real/foo is genuinely inside root, and crates/foo is merely an
    // in-tree symlink alias for it — both should be treated as within root.
    const root = mkdtempSync(join(tmpdir(), 'cargo-symlink-root-'));
    mkdirSync(join(root, 'real', 'foo'), { recursive: true });
    writeFileSync(
      join(root, 'real', 'foo', 'Cargo.toml'),
      '[package]\nname = "foo"\nversion = "0.1.0"\nhomepage = "https://serde.rs"\n',
    );
    mkdirSync(join(root, 'crates'), { recursive: true });
    // crates/foo -> root/real/foo (target IS within root).
    symlinkSync(join(root, 'real', 'foo'), join(root, 'crates', 'foo'));
    writeFileSync(
      join(root, 'Cargo.toml'),
      `
[package]
name = "consumer"
version = "0.1.0"

[dependencies]
foo = { path = "crates/foo" }
`,
    );

    const meta = cargoAdapter.readInstalledMeta(root, 'foo');
    expect(meta?.homepage).toBe('https://serde.rs');
    expect(cargoAdapter.listDirectDeps(root).has('foo')).toBe(true);

    const resolved = resolveAllowedSources({ root, adapter: cargoAdapter });
    const t1 = resolved.tier1For('cargo:foo');
    expect(t1.ok).toBe(true);
  });

  it('absolute-path escape — `path = "/abs/evil"` is rejected (isWithinRoot already covers this; added missing explicit coverage)', () => {
    const root = mkdtempSync(join(tmpdir(), 'cargo-symlink-root-'));
    const outside = mkdtempSync(join(tmpdir(), 'cargo-abs-outside-'));
    writeFileSync(
      join(outside, 'Cargo.toml'),
      '[package]\nname = "abs-poison"\nhomepage = "https://evil-abs.example"\n',
    );
    writeFileSync(
      join(root, 'Cargo.toml'),
      `
[package]
name = "consumer"
version = "0.1.0"

[dependencies]
abs-poison = { path = "${outside}" }
`,
    );

    expect(cargoAdapter.readInstalledMeta(root, 'abs-poison')).toBeNull();
    expect(cargoAdapter.listDirectDeps(root).has('abs-poison')).toBe(false);
  });

  it('absolute-path escape — `[workspace] members = ["/abs/evil"]` is rejected (added missing explicit coverage)', () => {
    const root = mkdtempSync(join(tmpdir(), 'cargo-symlink-root-'));
    const outside = mkdtempSync(join(tmpdir(), 'cargo-abs-outside-'));
    writeFileSync(
      join(outside, 'Cargo.toml'),
      '[package]\nname = "abs-poison-member"\nhomepage = "https://evil-abs-member.example"\n',
    );
    writeFileSync(
      join(root, 'Cargo.toml'),
      `
[workspace]
members = ["${outside}"]

[package]
name = "consumer"
version = "0.1.0"

[dependencies]
abs-poison-member = { workspace = true }
`,
    );

    expect(cargoAdapter.readInstalledMeta(root, 'abs-poison-member')).toBeNull();
    expect(cargoAdapter.listDirectDeps(root).has('abs-poison-member')).toBe(false);
  });
});

// ── LOW correctness follow-up: manifest name-symmetry across all three
// resolution branches (final adversarial audit, non-security). The
// workspace-member branch already verifies the resolved manifest's declared
// `[package] name` matches the requested dep (resolveDepManifestPath, the
// `for (const memberDir of ...)` loop). The vendored and path-override
// branches did NOT — they trusted whatever manifest sat at the resolved
// path/dir key, even if its OWN declared name differed from the requested
// dep. Not a security hole (all candidate manifests are already in-tree,
// PR-reviewed, containment-checked) — but the invariant "a manifest is
// trusted for pkg X only if it declares name = X" should hold uniformly.
describe('cargoAdapter — manifest name-symmetry across resolution branches', () => {
  it('path-override: a manifest at the resolved path declaring a DIFFERENT name is not trusted for the requested dep (mismatch rejected)', () => {
    const root = makeRoot({
      rootManifest: `
[package]
name = "consumer"
version = "0.1.0"

[dependencies]
poison = { path = "crates/mislabeled" }
`,
      pathDeps: {
        'crates/mislabeled': `[package]\nname = "somethingelse"\nversion = "0.1.0"\nhomepage = "https://mismatch.example"\n`,
      },
    });

    expect(cargoAdapter.readInstalledMeta(root, 'poison')).toBeNull();

    const resolved = resolveAllowedSources({ root, adapter: cargoAdapter });
    expect(resolved.tier1For('cargo:poison').ok).toBe(false);
  });

  it('vendored: a manifest at vendor/<pkg>/Cargo.toml declaring a DIFFERENT name is not trusted for the requested dep (mismatch rejected)', () => {
    const root = makeRoot({
      rootManifest: `
[package]
name = "consumer"
version = "0.1.0"

[dependencies]
serde = "1.0"
`,
      vendored: {
        serde: `[package]\nname = "notserde"\nversion = "1.0.0"\nhomepage = "https://mismatch-vendor.example"\n`,
      },
    });

    expect(cargoAdapter.readInstalledMeta(root, 'serde')).toBeNull();

    const resolved = resolveAllowedSources({ root, adapter: cargoAdapter });
    expect(resolved.tier1For('cargo:serde').ok).toBe(false);
  });

  it('positive control: path-override manifest correctly declaring the matching name still resolves (name-symmetry check does not over-reject)', () => {
    const root = makeRoot({
      rootManifest: `
[package]
name = "consumer"
version = "0.1.0"

[dependencies]
foo = { path = "crates/foo" }
`,
      pathDeps: {
        'crates/foo': `[package]\nname = "foo"\nversion = "0.1.0"\nhomepage = "https://foo.example"\n`,
      },
    });

    const meta = cargoAdapter.readInstalledMeta(root, 'foo');
    expect(meta?.homepage).toBe('https://foo.example');

    const resolved = resolveAllowedSources({ root, adapter: cargoAdapter });
    expect(resolved.tier1For('cargo:foo').ok).toBe(true);
  });

  it('positive control: vendored manifest correctly declaring the matching name still resolves (name-symmetry check does not over-reject)', () => {
    const root = makeRoot({
      rootManifest: `
[package]
name = "consumer"
version = "0.1.0"

[dependencies]
serde = "1.0"
`,
      vendored: {
        serde: `[package]\nname = "serde"\nversion = "1.0.0"\nhomepage = "https://serde.rs"\n`,
      },
    });

    const meta = cargoAdapter.readInstalledMeta(root, 'serde');
    expect(meta?.homepage).toBe('https://serde.rs');

    const resolved = resolveAllowedSources({ root, adapter: cargoAdapter });
    expect(resolved.tier1For('cargo:serde').ok).toBe(true);
  });
});

// ── FIX C: duplicate [package] tables must fail-closed (parser robustness) ──
describe('cargoAdapter — duplicate [package] table (fail-closed, MINOR)', () => {
  it('a manifest with two conflicting [package] tables yields null (never guesses which host is "the" host)', () => {
    const root = mkdtempSync(join(tmpdir(), 'cargo-dup-package-root-'));
    writeFileSync(
      join(root, 'Cargo.toml'),
      `
[package]
name = "consumer"
version = "0.1.0"

[dependencies]
dup = "1.0"
`,
    );
    mkdirSync(join(root, 'vendor', 'dup'), { recursive: true });
    // Two [package] tables in the SAME manifest, with different homepages —
    // a position-dependent (last-write-wins) parser would silently pick one.
    writeFileSync(
      join(root, 'vendor', 'dup', 'Cargo.toml'),
      `
[package]
name = "dup"
homepage = "https://first.example"

[package]
name = "dup"
homepage = "https://second.example"
`,
    );

    expect(cargoAdapter.readInstalledMeta(root, 'dup')).toBeNull();
  });
});
