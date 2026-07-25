// go EcosystemAdapter — the fourth concrete implementation of the EcosystemAdapter
// seam (allowlist-resolver.ts). All local fs, zero network, zero binary invocation
// (offline-determinism invariant, research-source-trust.md §5; mirrors
// ecosystem-npm.ts / ecosystem-cargo.ts / ecosystem-python.ts).
//
// Stage J3 of the adapter-factory conformance jig — first NEW family stamped
// through the 22-arm conformance suite. Binding design:
//   docs/superpowers/specs/2026-07-22-adapter-jig-design.md §2 (F1-F11) + §2.1
//   (go Tier-1 host-derivation hard node). Contract:
//   docs/superpowers/specs/2026-07-22-adapter-jig-contract.md (frozen rows F1-F11).
//
// §2.1 hard node — go has NO registry metadata document carrying `homepage` and
// `repository`. The module path itself (`github.com/user/repo`) IS the identity.
// Per F3 (frozen): adapters FEED the tier1For pipeline; they NEVER re-implement
// or bypass it. So this adapter SYNTHESIZES `{homepage, repository}`-shaped raw
// URLs from the module path inside `readInstalledMeta`, and hands them to the
// unchanged `tier1For` (allowlist-resolver.ts:189-243). It MUST NOT add a
// go-shaped branch inside tier1For; it MUST NOT skip the pipeline for go; it
// MUST NOT pre-canonicalize or pre-reject the URL (T-AJ3-A falsifier — the
// adapter's job is to FEED, the pipeline's job is to REJECT/ACCEPT).

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { EcosystemAdapter, InstalledMeta } from './allowlist-resolver.ts';

/** Rejects a dependency name containing path-traversal segments before any URL
 *  synthesis. Mirrors the per-adapter `isUnsafeDepName` in ecosystem-npm.ts /
 *  ecosystem-cargo.ts / ecosystem-python.ts (each adapter carries its own private
 *  copy — the precondition tripwire at ecosystem-adapter-precondition.test.ts
 *  greps every adapter impl file for the textual signal).
 *
 *  Go module paths legitimately contain `/` (e.g. `github.com/user/repo`), so
 *  this guard diverges from npm/cargo/python: it rejects `..` (path-traversal
 *  signal — disallowed by the go module path spec) and `\\` (windows separator
 *  defense), but NOT the unix separator `/`. The dep NAME surface is the only
 *  traversal vector for go: cargo's VALUE-containment (`resolvedWithinRoot`
 *  over path-override / workspace-member / vendored branches) has no go
 *  equivalent — `readInstalledMeta` synthesizes URLs without any FS join. */
function isUnsafeDepName(name: string): boolean {
  return name.includes('..') || name.includes('\\');
}

/** Strips a `//` line comment from a go.mod line. NOT quote-aware — go.mod has
 *  no string literals in require directives. Mirrors ecosystem-python.ts
 *  stripComments shape, specialised for go.mod's `//` marker. Returns the
 *  code-only segment and whether the original line carried an `indirect` marker
 *  (the marker is what B3 filters on; it lives in the comment portion). */
function stripLineComment(raw: string): { code: string; indirect: boolean } {
  const idx = raw.indexOf('//');
  if (idx < 0) return { code: raw.trim(), indirect: false };
  const comment = raw.slice(idx);
  return { code: raw.slice(0, idx).trim(), indirect: /\bindirect\b/.test(comment) };
}

/** Parses a go.mod file's direct dependencies.
 *
 *  go.mod has two require forms (B3 — direct-deps-only):
 *    1. Block:    `require ( ... )`
 *    2. Single:   `require github.com/user/repo v1.0.0`
 *
 *  Lines inside either form may carry `// indirect` — a marker that the dep is
 *  TRANSITIVE, not direct. Per B3 (adapter-jig arm direct-deps-only), those MUST
 *  be filtered out so tier1For's direct-dep gate doesn't silently widen
 *  (allowlist-resolver.ts:211 — the gate consumes `listDirectDeps` BEFORE reading
 *  the candidate dependency's metadata; an over-broad set here lets a transitive
 *  dep's poisoned metadata reach Tier-1 trust).
 *
 *  Fail-closed: missing/malformed ⇒ empty set (matches npm/cargo/pip posture).
 *  Hand-rolled subset parser — NOT a general go.mod parser. `replace` and
 *  `exclude` directives are deliberately not interpreted. */
function parseGoModDirectDeps(text: string): Set<string> {
  const names = new Set<string>();
  const lines = text.split('\n');
  let i = 0;
  while (i < lines.length) {
    const { code: line, indirect: lineIndirect } = stripLineComment(lines[i]!);
    i++;

    if (line === '') continue;

    // Single-line require: `require <mod> <ver>`.
    const single = /^require\s+(\S+)\s+(\S+)/.exec(line);
    if (single) {
      // A single-line `require (` opens a block instead — handled below.
      if (single[1] === '(') continue;
      if (!lineIndirect) {
        names.add(single[1]!);
      }
      continue;
    }

    // Block require open: `require (`. Collect entries into a buffer; commit
    // ONLY on a properly-closed `)`. If the block runs off EOF without closing,
    // discard the in-progress entries (fail-closed — an unterminated block is
    // malformed; its contents are not finalized and must not be enumerated).
    if (/^require\s*\($/.test(line)) {
      const blockBuf = new Set<string>();
      let closed = false;
      while (i < lines.length) {
        const bRaw = lines[i]!;
        i++;
        const { code: bLine, indirect: bIndirect } = stripLineComment(bRaw);
        if (bLine === ')') {
          closed = true;
          break;
        }
        if (bLine === '') continue;
        const m = /^(\S+)\s+(\S+)/.exec(bLine);
        if (m && !bIndirect) {
          blockBuf.add(m[1]!);
        }
      }
      if (closed) {
        for (const name of blockBuf) names.add(name);
      }
    }
    // Unrecognized directives (replace, exclude, go, toolchain, module, etc.)
    // contribute nothing — fail-closed, no false-positive dep enumeration.
  }
  return names;
}

/** Returns the first path segment of a go module path — the host-bearing
 *  portion for a module like `github.com/user/repo`. For `internal/foo` returns
 *  `internal`; for `example` (no `/`) returns `example`. */
function firstSegment(modPath: string): string {
  const idx = modPath.indexOf('/');
  return idx === -1 ? modPath : modPath.slice(0, idx);
}

/** Returns true if a string is plausibly a hostname (contains a `.`). Used to
 *  distinguish a module path whose first segment is a real host
 *  (`github.com/...`, `golang.org/...`, `evil.example.com/...`) from one whose
 *  first segment is single-label (`internal/foo`, `example`) — single-label has
 *  no host semantics, so the adapter returns null and tier1For's miss path
 *  falls through to Tier-0 / Tier-2. */
function segmentLooksLikeHost(seg: string): boolean {
  return seg.includes('.');
}

export const goAdapter: EcosystemAdapter = {
  ecosystem: 'go',

  listDirectDeps(root: string): Set<string> {
    const goModPath = join(root, 'go.mod');
    if (!existsSync(goModPath)) return new Set();
    let text: string;
    try {
      text = readFileSync(goModPath, 'utf8');
    } catch {
      return new Set();
    }
    return parseGoModDirectDeps(text);
  },

  readInstalledMeta(_root: string, pkg: string): InstalledMeta | null {
    // Reject path-traversal names before any URL synthesis — `..` is not
    // legitimate in a go module path (spec disallows it).
    if (isUnsafeDepName(pkg)) return null;

    // §2.1 hard node: go has NO registry metadata document. Synthesize a
    // {homepage, repository} surface from the module path and feed it RAW to
    // the unchanged tier1For pipeline (F3 frozen — adapters FEED it; never
    // bypass). Do NOT short-circuit tier1For's rejection chain — no
    // pre-canonicalization, no pre-rejection inside the adapter (T-AJ3-A).
    const first = firstSegment(pkg);
    if (!segmentLooksLikeHost(first)) {
      // Single-label first segment (e.g. `internal/foo`, `example`) — no
      // plausible host ⇒ Tier-1 miss. Returning null here is the honest "no
      // metadata" answer; tier1For will fall through to Tier-0 / Tier-2
      // (mirrors cargo's registry-only gap posture).
      return null;
    }
    // Hand the RAW URL to tier1For. Multi-tenant hosts (github.com etc.) WILL
    // be rejected downstream by tier1For's multi-tenant-apex reject stage —
    // NOT by this adapter. Single-tenant hosts (golang.org, evil.example.com)
    // pass through; whether they pass tier1For is a function of the
    // multi-tenant-hosts.json set, NOT a function of this adapter's logic.
    const url = `https://${pkg}`;
    return { homepage: url, repository: url };
  },
};
