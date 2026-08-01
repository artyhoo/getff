// Stage J3 — go EcosystemAdapter: direct deps + synthesized module-path metadata.
// Mirrors ecosystem-cargo.test.ts's paired positive+negative shape for the go
// toolchain axis. Kickoff: .ai-factory/plans/feature-adapter-jig-j3-d4db43.md §2.
// Binding hard node: docs/superpowers/specs/2026-07-22-adapter-jig-design.md §2.1.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { goAdapter } from './ecosystem-go.ts';

function makeRoot(goMod: string): string {
  const root = mkdtempSync(join(tmpdir(), 'go-adapter-'));
  writeFileSync(join(root, 'go.mod'), goMod);
  return root;
}

describe('goAdapter.listDirectDeps', () => {
  it('parses a single-line require declaration', () => {
    const root = makeRoot(`module example.com/consumer

go 1.23

require github.com/foo/bar v1.2.3
`);
    const deps = goAdapter.listDirectDeps(root);
    expect(deps.has('github.com/foo/bar')).toBe(true);
    expect(deps.size).toBe(1);
  });

  it('parses a require block with multiple declarations', () => {
    const root = makeRoot(`module example.com/consumer

go 1.23

require (
\tgithub.com/foo/bar v1.2.3
\tgithub.com/baz/qux v2.0.0
)
`);
    const deps = goAdapter.listDirectDeps(root);
    expect(deps.has('github.com/foo/bar')).toBe(true);
    expect(deps.has('github.com/baz/qux')).toBe(true);
    expect(deps.size).toBe(2);
  });

  // @arm:B3:pos direct-deps-only (go lane — block form, declared DIRECT deps
  // are listed). Sibling family pairs: ecosystem-cargo.test.ts / ecosystem-python.test.ts
  // / ecosystem-npm via ecosystem-adapter-precondition.test.ts Part B.
  it('filters // indirect markers from a require block (B3 — direct-deps-only)', () => {
    const root = makeRoot(`module example.com/consumer

go 1.23

require (
\tgithub.com/direct/one v1.0.0
\tgithub.com/transitive/two v2.0.0 // indirect
\tgithub.com/transitive/three v3.0.0 // indirect
\tgithub.com/direct/four v4.0.0
)
`);
    const deps = goAdapter.listDirectDeps(root);
    expect(deps.has('github.com/direct/one')).toBe(true);
    expect(deps.has('github.com/direct/four')).toBe(true);
    // @arm:B3:neg direct-deps-only (go lane — `// indirect` deps MUST NOT
    // appear in the direct-dep set; if they did, tier1For's direct-dep gate
    // (allowlist-resolver.ts:211) would silently widen to transitive deps,
    // letting a transitive dep's poisoned metadata reach Tier-1 trust.)
    expect(deps.has('github.com/transitive/two')).toBe(false);
    expect(deps.has('github.com/transitive/three')).toBe(false);
    expect(deps.size).toBe(2);
  });

  it('filters // indirect markers from a single-line require (B3)', () => {
    const root = makeRoot(`module example.com/consumer

go 1.23

require github.com/direct/one v1.0.0
require github.com/transitive/two v2.0.0 // indirect
`);
    const deps = goAdapter.listDirectDeps(root);
    expect(deps.has('github.com/direct/one')).toBe(true);
    expect(deps.has('github.com/transitive/two')).toBe(false);
    expect(deps.size).toBe(1);
  });

  // A1 — no-throw on malformed go.mod. The fail-closed contract: a malformed
  // require block (unbalanced parens, missing version) returns an empty set,
  // NEVER throws. tier1For's miss path then falls through cleanly.
  it('returns empty set when go.mod is missing', () => {
    const root = mkdtempSync(join(tmpdir(), 'go-adapter-no-gomod-'));
    expect(goAdapter.listDirectDeps(root).size).toBe(0);
  });

  it('returns empty set when go.mod has an unbalanced require block (fail-closed, no throw)', () => {
    const root = makeRoot(`module example.com/consumer

require (
\tgithub.com/foo/bar v1.0.0
\t// closing paren missing
`);
    // The unterminated block consumes to EOF without throwing; zero deps
    // enumerated from it (the block never closed, so its entries do not
    // finalize — the parser is fail-closed, not fail-loud).
    expect(goAdapter.listDirectDeps(root).size).toBe(0);
  });

  it('does not parse `replace` or `exclude` directives as dependencies', () => {
    const root = makeRoot(`module example.com/consumer

go 1.23

require github.com/foo/bar v1.0.0

replace github.com/foo/bar => github.com/fork/bar v1.0.0
exclude github.com/bad/old v0.9.0
`);
    const deps = goAdapter.listDirectDeps(root);
    expect(deps.has('github.com/foo/bar')).toBe(true);
    expect(deps.has('github.com/fork/bar')).toBe(false);
    expect(deps.has('github.com/bad/old')).toBe(false);
  });
});

describe('goAdapter.readInstalledMeta', () => {
  // @arm:B1:pos poisoned-host-negative-design (go lane — REAL-host module path
  // produces RAW URLs fed to tier1For unmodified). The adapter's job is to
  // FEED, not to ACCEPT/REJECT. tier1For's multi-tenant reject stage
  // (allowlist-resolver.ts:189-243) handles the github.com reject downstream.
  it('synthesizes homepage+repository URLs from a host-bearing module path (feeds tier1For RAW)', () => {
    const root = mkdtempSync(join(tmpdir(), 'go-adapter-meta-'));
    const meta = goAdapter.readInstalledMeta(root, 'github.com/user/repo');
    expect(meta).not.toBeNull();
    expect(meta!.homepage).toBe('https://github.com/user/repo');
    expect(meta!.repository).toBe('https://github.com/user/repo');
  });

  it('synthesizes URLs for golang.org/x/... modules (single-tenant host, NOT in multi-tenant set)', () => {
    const root = mkdtempSync(join(tmpdir(), 'go-adapter-golang-org-'));
    const meta = goAdapter.readInstalledMeta(root, 'golang.org/x/text');
    expect(meta).not.toBeNull();
    expect(meta!.homepage).toBe('https://golang.org/x/text');
    expect(meta!.repository).toBe('https://golang.org/x/text');
    // Sanity: golang.org is NOT in multi-tenant-hosts.json — so tier1For's
    // multi-tenant-apex reject stage will not fire on this URL. The adapter
    // does not check the multi-tenant set itself; it feeds RAW.
    expect(meta!.homepage).not.toContain('github.com');
  });

  // MINOR 3 fix (pre-egress fidelity audit 2026-07-25): single-label rejection
  // is one of the stages frozen INSIDE tier1For (`if (!host.includes('.')) continue;`
  // at allowlist-resolver.ts:243). Returning null here for a single-label first
  // segment was a partial F3 bypass — the adapter's job is to FEED, not reject.
  // The adapter now passes single-label URLs through RAW; tier1For rejects them.
  it('passes single-label module paths through RAW (single-label rejection lives in tier1For, not the adapter)', () => {
    const root = mkdtempSync(join(tmpdir(), 'go-adapter-single-label-'));
    const a = goAdapter.readInstalledMeta(root, 'internal');
    expect(a).not.toBeNull();
    expect(a!.homepage).toBe('https://internal');
    expect(a!.repository).toBe('https://internal');
    const b = goAdapter.readInstalledMeta(root, 'example');
    expect(b).not.toBeNull();
    expect(b!.homepage).toBe('https://example');
    const c = goAdapter.readInstalledMeta(root, 'internal/foo');
    expect(c).not.toBeNull();
    expect(c!.homepage).toBe('https://internal/foo');
    // Sanity: every synthesized URL has a single-label hostname — tier1For's
    // `!host.includes('.')` stage (allowlist-resolver.ts:243) will reject each.
    for (const m of [a, b, c]) {
      expect(new URL(m!.homepage!).hostname.includes('.')).toBe(false);
    }
  });

  // @arm:B1:neg poisoned-host-negative-design (go lane — the falsifier the
  // §2.1 hard-node names: a module path whose FIRST segment contains a `.` but
  // is NOT the host the URL LOOKS LIKE it should yield. The synthesized URL is
  // `https://evil.example.com/github.com/real/repo`; `new URL(...).hostname`
  // extracts `evil.example.com`, NOT `github.com`. The B1 ASYMMETRY (load-bearing
  // — T-AJ3-A falsifier per kickoff §2.1 sub-node): `evil.example.com` is
  // SINGLE-TENANT (NOT in multi-tenant-hosts.json), so it would PASS
  // tier1For's reject chain either way. **This negative catches a
  // `github.com`-SUBSTRING extractor (a buggy adapter that scans the URL for
  // "github.com" and extracts THAT instead of the real hostname) — it does NOT
  // catch a multi-tenant bypass of `github.com/user/repo` itself (which is
  // multi-tenant and rejected by tier1For anyway).** A future reader who
  // assumes the B1 negative is "what catches bypasses" will mis-attribute the
  // protection. The bypass defense lives in tier1For's URL parser, NOT here.)
  it('does NOT extract `github.com` from a path that merely CONTAINS it (T-AJ3-A falsifier)', () => {
    const root = mkdtempSync(join(tmpdir(), 'go-adapter-b1-'));
    const meta = goAdapter.readInstalledMeta(root, 'evil.example.com/github.com/real/repo');
    expect(meta).not.toBeNull();
    expect(meta!.homepage).toBe('https://evil.example.com/github.com/real/repo');
    // The URL hostname is `evil.example.com`, NOT `github.com` — verified by
    // `new URL(meta!.homepage).hostname`. The adapter must not extract a
    // substring; the URL parser's `.hostname` is the only legitimate extractor.
    const host = new URL(meta!.homepage ?? '').hostname;
    expect(host).toBe('evil.example.com');
    expect(host).not.toBe('github.com');
  });

  // @arm:B2:neg name-guard-containment (go lane — dep-NAME traversal guard.
  // `..` segments are disallowed by the go module path spec; the adapter
  // rejects them BEFORE any URL synthesis. distinct from cargo's VALUE-surface
  // guard, which go does not need — `readInstalledMeta` does not join the dep
  // name into any filesystem path.)
  it('rejects a path-traversal package name (isUnsafeDepName — fail-closed)', () => {
    const root = mkdtempSync(join(tmpdir(), 'go-adapter-traversal-'));
    expect(goAdapter.readInstalledMeta(root, '../escape')).toBeNull();
    expect(goAdapter.readInstalledMeta(root, 'github.com/../etc/passwd')).toBeNull();
    expect(goAdapter.readInstalledMeta(root, 'foo\\bar')).toBeNull();
    // Sanity: a legitimate `/`-bearing module path is NOT rejected — go
    // module paths legitimately contain `/` (divergence from npm/cargo/pip
    // guards which reject `/`).
    expect(goAdapter.readInstalledMeta(root, 'github.com/user/repo')).not.toBeNull();
  });
});
