// cargo EcosystemAdapter — the first non-JS implementation of the EcosystemAdapter
// seam (allowlist-resolver.ts), landing S4 (§4 ecosystem-prefix reservation).
// All local fs, ZERO network, ZERO cargo/rustc binary invocation — this repo's
// dev env has neither installed, and shelling out to `cargo metadata` would add
// an external-process dependency the resolver's offline-determinism invariant
// forbids (allowlist-resolver.ts:1-11 header). Mirrors ecosystem-npm.ts's shape.
//
// --- Minimal Cargo.toml subset parsed (fail-closed contract) ---
// This is a hand-rolled parser for the SMALL subset of TOML that Cargo.toml
// metadata needs — NOT a general TOML parser. No TOML dependency was added
// (would be a capability commit; a general parser is also unnecessary surface
// for 4 known table headers + plain string fields). Subset:
//   - Table headers: [package], [dependencies], [dev-dependencies],
//     [build-dependencies], [workspace], [workspace.dependencies].
//   - `#` line comments (stripped before parsing, quote-aware — a `#` inside
//     a quoted string value, e.g. a homepage URL fragment
//     `"https://good.example/x#frag"`, is NOT treated as a comment start).
//   - Plain `key = "value"` string fields — used for [package] homepage /
//     repository, and for path = "..." inside a dependency's inline table.
//     NOTE: `documentation` is parsed as a generic [package] string field
//     like any other, but it is NOT part of the trust surface — InstalledMeta
//     (below) exposes homepage/repository only; documentation is never read
//     by readInstalledMeta or by the resolver's Tier-1 candidateFields.
//   - Dependency table KEYS under [dependencies]/[dev-dependencies]/
//     [build-dependencies] — both bare-string form (`serde = "1.0"`) and
//     inline-table form (`local-lib = { path = "../local-lib" }`).
//   - `[workspace] members = [...]` string array.
// FAIL-CLOSED CONTRACT: any ambiguity, unrecognized shape, or parse error
// drops the field / entry (returns undefined/empty) — it NEVER guesses a host
// or a dependency's location. In particular:
//   - `repository = { workspace = true }` (or any inline table without a
//     trivially-extractable bare `url`/string) is DROPPED, not guessed.
//   - A malformed manifest (unbalanced `[`, etc.) yields an empty parse, not
//     a throw and not a partial/guessed result.
//   - Duplicate `[package]` tables in the same manifest are AMBIGUOUS —
//     rather than last-write-wins (position-dependent host), all [package]
//     fields are dropped entirely (research-source-trust.md §5, parser
//     robustness note).
//
// --- readInstalledMeta scope (documented cap) ---
// A dependency's OWN Cargo.toml is read from a LOCALLY-RESOLVABLE location
// under the consumer's control only:
//   (a) a path dependency's directory (`{ path = "../foo" }`, relative to the
//       manifest declaring it — resolved relative to `root` here, matching
//       this adapter's single-manifest-root model);
//   (b) a vendored dependency (`cargo vendor` layout: vendor/<name>/Cargo.toml
//       — DeepWiki-verified 2026-07-03, rust-lang/cargo: DirectorySource lays
//       out one subdirectory per vendored crate with a full Cargo.toml copy,
//       resolvable purely from the local filesystem);
//   (c) a workspace member (`[workspace] members = [...]`, each entry a
//       relative dir containing its own Cargo.toml).
// FOLLOW-UP CAP (explicitly out of scope for S4): the common case of a
// registry-resolved dependency cached under $CARGO_HOME/registry/src/... is
// NOT derived here. That cache's directory names embed a source-registry hash
// (not just name+version) and locating it robustly needs either Cargo.lock
// parsing or a `cargo metadata` shell-out — both are a materially bigger scope
// than this adapter's local-fs-only contract. This is an honest fail-closed
// gap, not a security hole: a registry-only dependency simply does not get
// Tier-1 (falls through to Tier-0/Tier-2), same as any other cargoAdapter miss.

import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import type { EcosystemAdapter, InstalledMeta } from './allowlist-resolver.ts';
import { extractHttpsHost } from './ecosystem-npm.ts';

const DEP_TABLE_HEADERS = ['dependencies', 'dev-dependencies', 'build-dependencies'] as const;

interface ParsedManifest {
  packageFields: Map<string, string>; // [package] plain string fields
  depNames: Set<string>; // union of the three dep-table KEYS
  depPathOverride: Map<string, string>; // dep name -> path= value (if inline table had one)
  workspaceMembers: string[]; // [workspace] members = [...]
}

/** Strips `#` line comments. Quote-aware: a `#` inside a double-quoted
 *  string value (e.g. a homepage URL fragment `"https://good.example/x#frag"`)
 *  is NOT treated as a comment start — only a `#` OUTSIDE any quoted string
 *  begins a comment. This subset does not need to handle escaped quotes
 *  inside Cargo.toml string values (none of the fields this parser reads
 *  legitimately contain an escaped `"`), so a simple quote-toggle per `"` is
 *  sufficient and fail-closed (worst case: a comment survives into a value
 *  it shouldn't, which the downstream regexes then fail to match — dropped,
 *  never guessed). */
function stripComments(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          inQuotes = !inQuotes;
          continue;
        }
        if (ch === '#' && !inQuotes) {
          return line.slice(0, i);
        }
      }
      return line;
    })
    .join('\n');
}

/** Extracts the bare string value from `path = "..."` inside an inline table
 *  fragment (e.g. `{ path = "../local-lib" }`). Returns undefined if absent —
 *  fail-closed, never guesses. */
function extractInlineTableStringField(inlineTable: string, field: string): string | undefined {
  const re = new RegExp(`\\b${field}\\s*=\\s*"([^"]*)"`);
  const m = inlineTable.match(re);
  return m?.[1];
}

/** Hand-rolled minimal TOML subset parser. Fail-closed: any exception during
 *  parsing yields the empty-manifest shape, never a partial guess. */
function parseCargoToml(text: string): ParsedManifest {
  const empty: ParsedManifest = {
    packageFields: new Map(),
    depNames: new Set(),
    depPathOverride: new Map(),
    workspaceMembers: [],
  };
  try {
    const stripped = stripComments(text);
    const lines = stripped.split('\n');

    // Split into table sections by header line. A "section" is the header
    // name (e.g. "package", "dependencies") plus every line until the next
    // `[...]` header (or `[[...]]` — not used by Cargo.toml package metadata,
    // deliberately unsupported: falls through as an unrecognized header, its
    // body lines contribute nothing).
    type Section = { header: string; bodyLines: string[] };
    const sections: Section[] = [];
    let current: Section | null = null;
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line === '') continue;
      const headerMatch = /^\[([^\]]+)\]$/.exec(line);
      if (headerMatch) {
        current = { header: headerMatch[1]!.trim(), bodyLines: [] };
        sections.push(current);
        continue;
      }
      if (current) current.bodyLines.push(line);
      // Lines before any header (should not occur in valid Cargo.toml) are
      // silently ignored — fail-closed, not a throw.
    }

    const packageFields = new Map<string, string>();
    const depNames = new Set<string>();
    const depPathOverride = new Map<string, string>();
    const workspaceMembers: string[] = [];
    // FIX C (research-source-trust.md §5 — parser robustness, MINOR): a
    // manifest with more than one [package] table is AMBIGUOUS — a
    // last-write-wins merge would silently pick whichever table happened to
    // be read last, yielding a position-dependent host. Fail-closed: track
    // how many [package] headers were seen; if >1, drop package identity
    // entirely (packageFields stays empty) rather than guess which table is
    // "the" one. This makes readInstalledMeta's `!has('name')` check (which
    // already fails closed on a missing name) also fail closed here, since a
    // real Cargo.toml always declares `name`.
    let packageTableCount = 0;

    for (const section of sections) {
      if (section.header === 'package') {
        packageTableCount++;
        if (packageTableCount > 1) {
          packageFields.clear(); // ambiguous — drop whatever the first table set too
          continue;
        }
        for (const line of section.bodyLines) {
          const kv = /^([A-Za-z0-9_-]+)\s*=\s*"([^"]*)"$/.exec(line);
          if (kv) {
            packageFields.set(kv[1]!, kv[2]!);
            continue;
          }
          // Non-string [package] field (e.g. `edition = "2021"` is a string
          // and matches above; `resolver = 2` is a bare number — irrelevant
          // to our fields, silently skipped, not guessed).
        }
        continue;
      }
      if ((DEP_TABLE_HEADERS as readonly string[]).includes(section.header)) {
        for (const line of section.bodyLines) {
          // Bare-string dep: `serde = "1.0"`
          const bare = /^([A-Za-z0-9_.-]+)\s*=\s*"[^"]*"$/.exec(line);
          if (bare) {
            depNames.add(bare[1]!);
            continue;
          }
          // Inline-table dep: `local-lib = { path = "../local-lib" }`
          const inline = /^([A-Za-z0-9_.-]+)\s*=\s*\{(.*)\}\s*$/.exec(line);
          if (inline) {
            const name = inline[1]!;
            depNames.add(name);
            const pathVal = extractInlineTableStringField(inline[2]!, 'path');
            if (pathVal !== undefined) depPathOverride.set(name, pathVal);
            continue;
          }
          // Unrecognized dependency-line shape (e.g. multi-line inline table,
          // workspace = true with no path) — the dep name is NOT captured;
          // fail-closed (a dep we can't parse is not treated as resolvable).
        }
        continue;
      }
      if (section.header === 'workspace') {
        // members = ["a", "b"] — single-line array only (fail-closed subset).
        const membersLine = section.bodyLines.find((l) => /^members\s*=/.test(l));
        if (membersLine) {
          const arrMatch = /\[(.*)\]/.exec(membersLine);
          if (arrMatch) {
            const items = arrMatch[1]!
              .split(',')
              .map((s) => s.trim())
              .filter((s) => s.length > 0)
              .map((s) => {
                const strMatch = /^"([^"]*)"$/.exec(s);
                return strMatch?.[1];
              })
              .filter((s): s is string => s !== undefined);
            workspaceMembers.push(...items);
          }
        }
        continue;
      }
      // Unrecognized header (e.g. "workspace.dependencies", "lib", "features",
      // "profile.release") — deliberately not parsed further; contributes
      // nothing (fail-closed, not an error).
    }

    return { packageFields, depNames, depPathOverride, workspaceMembers };
  } catch {
    return empty;
  }
}

function readManifest(path: string): ParsedManifest | null {
  if (!existsSync(path)) return null;
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return null;
  }
  return parseCargoToml(text);
}

/** Rejects a dependency name containing path-traversal or separator segments
 *  before it is ever joined into a filesystem path (research-source-trust.md
 *  §5 item D harden-criterion — now LIVE because cargoAdapter is a second
 *  EcosystemAdapter implementation). Fail-closed: returns true (reject) for
 *  any name containing `..` or a path separator (`/` or the platform sep). */
function isUnsafeDepName(name: string): boolean {
  return name.includes('..') || name.includes('/') || name.includes(sep) || name.includes('\\');
}

/** Is `candidateAbs` equal to `root`, or nested inside it? Both arguments
 *  MUST already be absolute (resolved) paths. Purely LEXICAL — this does NOT
 *  dereference symlinks; a symlink whose target lies outside `root` is NOT
 *  caught by this check alone (path.resolve() never follows symlinks). It
 *  remains the low-level string-containment primitive; the actual
 *  containment gate used by resolveDepManifestPath is resolvedWithinRoot
 *  (below), which additionally realpath-canonicalizes both sides before
 *  ever calling this function — that is what makes containment robust to
 *  in-tree symlinks pointing out-of-tree (research-source-trust.md §5 item 2
 *  2nd BLOCKER). Kept as a separate exported-shape primitive for the
 *  lexical-only absolute-path / `..`-segment cases, which need no fs access. */
function isWithinRoot(candidateAbs: string, root: string): boolean {
  const base = root.endsWith(sep) ? root : root + sep;
  return candidateAbs === root || candidateAbs.startsWith(base);
}

/** Resolves `resolve(root, ...segments)` and returns it ONLY if it both (a)
 *  exists on disk and (b) its REALPATH (symlink-resolved) lies within
 *  root's OWN realpath. Both sides are canonicalized before comparison —
 *  canonicalizing only the candidate side (and comparing against a lexical
 *  `root`) would FALSE-REJECT legitimate in-tree paths whenever `root`
 *  itself sits under a symlinked ancestor (e.g. macOS `/tmp` -> `/private/tmp`,
 *  which every tmp-based test root here inherits). Fail-closed: any
 *  realpath() error (broken symlink, permission failure, race) rejects
 *  rather than guesses. This is the containment gate for all three
 *  dependency-manifest resolution branches (vendored, path-override,
 *  workspace-member) — the VALUE surfaces, as opposed to isUnsafeDepName
 *  which only guards the dependency NAME. Tier-1 derives trust exclusively
 *  from manifests inside the consumer's own (real, not merely lexical)
 *  project tree; anything whose real location resolves outside root's real
 *  location is fail-closed here — no security loss, only no Tier-1
 *  convenience for an out-of-tree/symlink-escaped dependency (it still
 *  falls through to Tier-0/Tier-2). */
function resolvedWithinRoot(root: string, ...segments: string[]): string | null {
  const candidate = resolve(root, ...segments);
  if (!isWithinRoot(candidate, root)) return null; // cheap lexical reject first (handles absolute-path / `..` escapes with no fs access)
  if (!existsSync(candidate)) return null; // must exist to read + to realpath
  let real: string;
  let realRoot: string;
  try {
    real = realpathSync(candidate);
    realRoot = realpathSync(root);
  } catch {
    return null; // fail-closed on any realpath error (broken symlink, EPERM, race)
  }
  return isWithinRoot(real, realRoot) ? candidate : null;
}

/** Resolves the locally-available Cargo.toml path for a direct dependency,
 *  trying (in order): vendored layout, path-dependency override, workspace
 *  member directory. Returns null if none resolve. Rejects unsafe names
 *  BEFORE any join (§5 item D), and rejects a resolved path whose REALPATH
 *  (symlink-resolved) lies outside `root`'s own realpath, on ALL THREE
 *  branches (§5 item 2's 2nd BLOCKER — an in-tree symlink pointing
 *  out-of-tree bypassed the earlier lexical-only isWithinRoot check on
 *  every branch, including vendored, which previously had NO containment
 *  check at all; see resolvedWithinRoot above).
 *
 *  Manifest name-symmetry (LOW correctness follow-up, final adversarial
 *  audit, non-security): a manifest is trusted for `pkg` only if its OWN
 *  `[package] name` field equals `pkg` — on ALL THREE branches, not just
 *  workspace-member (which already enforced this). Without this check, a
 *  vendored/path-override manifest declaring a DIFFERENT name than the key
 *  it was resolved under (vendor/<pkg>/ dir name, or the dep's inline-table
 *  key) would still have its homepage/repository derived and authorized
 *  under `pkg`'s Tier-1 scope-lock — a correctness asymmetry, not a
 *  trust-boundary crossing (the manifest is already in-tree and
 *  containment-checked either way). Fail-closed: an unreadable manifest or
 *  a name mismatch on either branch falls through (never returned), exactly
 *  mirroring the workspace-member branch's existing behaviour. */
function resolveDepManifestPath(
  root: string,
  pkg: string,
  parsedRoot: ParsedManifest,
): string | null {
  if (isUnsafeDepName(pkg)) return null;

  // (b) vendored: vendor/<name>/Cargo.toml — trusted only if its own
  // declared name matches pkg.
  const vendorPath = resolvedWithinRoot(root, 'vendor', pkg, 'Cargo.toml');
  if (vendorPath !== null) {
    const vendorParsed = readManifest(vendorPath);
    if (vendorParsed?.packageFields.get('name') === pkg) return vendorPath;
  }

  // (a) path dependency: inline-table `path = "..."`, resolved relative to
  // root — trusted only if its own declared name matches pkg.
  const pathOverride = parsedRoot.depPathOverride.get(pkg);
  if (pathOverride !== undefined) {
    const candidate = resolvedWithinRoot(root, pathOverride, 'Cargo.toml');
    if (candidate !== null) {
      const pathParsed = readManifest(candidate);
      if (pathParsed?.packageFields.get('name') === pkg) return candidate;
    }
  }

  // (c) workspace member: [workspace] members includes a dir whose Cargo.toml
  // declares name == pkg.
  for (const memberDir of parsedRoot.workspaceMembers) {
    const memberManifestPath = resolvedWithinRoot(root, memberDir, 'Cargo.toml');
    if (memberManifestPath === null) continue;
    const memberParsed = readManifest(memberManifestPath);
    if (memberParsed?.packageFields.get('name') === pkg) return memberManifestPath;
  }

  return null;
}

export const cargoAdapter: EcosystemAdapter = {
  ecosystem: 'cargo',

  listDirectDeps(root: string): Set<string> {
    const rootManifestPath = join(root, 'Cargo.toml');
    const parsedRoot = readManifest(rootManifestPath);
    if (parsedRoot === null) return new Set();

    const direct = new Set<string>();
    for (const name of parsedRoot.depNames) {
      if (resolveDepManifestPath(root, name, parsedRoot) !== null) {
        direct.add(name);
      }
    }
    return direct;
  },

  readInstalledMeta(root: string, pkg: string): InstalledMeta | null {
    if (isUnsafeDepName(pkg)) return null;
    const rootManifestPath = join(root, 'Cargo.toml');
    const parsedRoot = readManifest(rootManifestPath);
    if (parsedRoot === null) return null;

    const depManifestPath = resolveDepManifestPath(root, pkg, parsedRoot);
    if (depManifestPath === null) return null;

    const depParsed = readManifest(depManifestPath);
    if (depParsed === null) return null;
    // A valid Cargo.toml [package] section always declares `name` (Cargo
    // itself refuses to build without it). Its absence means the manifest
    // failed to parse into a recognizable [package] table (e.g. malformed
    // `[package` with no closing bracket, silently producing an empty
    // section) — fail closed to null rather than an empty-but-truthy object.
    if (!depParsed.packageFields.has('name')) return null;

    const homepage = depParsed.packageFields.get('homepage');
    const repository = depParsed.packageFields.get('repository');
    return { homepage, repository };
  },
};

// Re-exported for tests/consumers that want to reuse the same host-extraction
// logic cargoAdapter's caller (tier1For) applies — mirrors ecosystem-npm.ts's
// own extractHttpsHost re-export pattern. cargoAdapter itself does not call
// this; tier1For (allowlist-resolver.ts) extracts hosts from InstalledMeta
// uniformly across ecosystems via its own extractHttpsHostFromMeta.
export { extractHttpsHost };
