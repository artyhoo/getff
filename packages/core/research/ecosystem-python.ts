// pip EcosystemAdapter — the third concrete implementation of the EcosystemAdapter
// seam (allowlist-resolver.ts). All local fs, zero network, zero binary invocation
// (offline-determinism invariant, research-source-trust.md §5; mirrors
// ecosystem-npm.ts / ecosystem-cargo.ts). LG-S4 of the live-generation umbrella.
// Design: docs/superpowers/specs/2026-07-17-lg-s4-python-ecosystem-adapter-design.md.
// Research: docs/meta-factory/research-patches/2026-07-16-lg-s4-python-ecosystem-adapter.md.

/** PEP 503 canonical name normalization: lowercase, collapse runs of [-_.] to a
 *  single hyphen. PEP 503 §"Normalized names". Applied to BOTH the requested
 *  package name and the dist-info METADATA `Name:` before equality comparison,
 *  so hyphen/underscore case-variants unify (my-pkg ≡ my_pkg ≡ My_Pkg). */
export function normalizePep503(name: string): string {
  return name.toLowerCase().replace(/[-_.]+/g, '-');
}

/** PEP 508 subset: extracts the bare dependency name from a requirement spec.
 *  Strategy (fail-closed): match the leading name token, strip extras `[…]`,
 *  version specifiers, and environment markers. The name must start with a
 *  letter/digit and contain only PEP 508 name chars `[A-Za-z0-9._-]` until a
 *  delimiter (`[`, a version op, `;`, `@`, `(`, end). Unrecognized shapes
 *  (URL `@` requirements, legacy parenthesized `(>=1.0)`, version-op-leading)
 *  return null — documented drops (spec §4.1 limitations). */
export function extractPep508Name(spec: string): string | null {
  const s = spec.trim();
  if (s === '') return null;
  // Reject version-op-leading and parenthesized/URL forms up front.
  if (/^[><=~!]/.test(s)) return null;
  if (s.includes('(')) return null;
  // Capture the leading name run up to the first delimiter.
  const m = /^([A-Za-z0-9][A-Za-z0-9._-]*)/.exec(s);
  if (m === null) return null;
  // If a `@` follows the name (URL requirement), drop it.
  const afterName = s.slice(m[1]!.length).trimStart();
  if (afterName.startsWith('@')) return null;
  return normalizePep503(m[1]!);
}

import { existsSync, readFileSync, realpathSync, readdirSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import type { EcosystemAdapter, InstalledMeta } from './allowlist-resolver.ts';

/** Strips `#` line comments. Quote-aware: a `#` inside a double-quoted string
 *  is NOT a comment start. Mirrors ecosystem-cargo.ts stripComments. */
function stripComments(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]!;
        if (ch === '"') { inQuotes = !inQuotes; continue; }
        if (ch === '#' && !inQuotes) return line.slice(0, i);
      }
      return line;
    })
    .join('\n');
}

interface ParsedPyproject {
  /** Section header → raw body lines (for header-prefix matching, e.g. tool.poetry.). */
  sections: Map<string, string[]>;
}

/** Hand-rolled TOML subset parser. Fail-closed: any exception yields the empty
 *  shape. Sections split on `[header]` lines. This parser captures body lines
 *  per section; the dep-extraction functions below interpret each section. */
function parsePyproject(text: string): ParsedPyproject {
  const empty: ParsedPyproject = { sections: new Map() };
  try {
    const stripped = stripComments(text);
    const sections = new Map<string, string[]>();
    let current = '';
    for (const rawLine of stripped.split('\n')) {
      const line = rawLine.trim();
      if (line === '') continue;
      const headerMatch = /^\[([^\]]+)\]$/.exec(line);
      if (headerMatch) {
        current = headerMatch[1]!.trim();
        if (!sections.has(current)) sections.set(current, []);
        continue;
      }
      if (current === '') continue; // lines before any header — ignored
      sections.get(current)!.push(line);
    }
    return { sections };
  } catch {
    return empty;
  }
}

/** Extracts PEP 508 names from a `[project]` section's body lines. Recognizes
 *  `dependencies = ["…", "…"]` (single-line array) and
 *  `[project.optional-dependencies]` tables `key = ["…", …]`.
 *
 *  NOTE: the closing `]` of the array is matched quote-aware — a `]` inside a
 *  quoted string (e.g. `django[bcrypt]`) is not treated as the array terminator.
 *  This is the one deviation from the brief's literal regex (`[^\]]*`), which
 *  would mis-truncate the array at `django[` and fail the spec-1 test. */
function extractPep621Deps(sectionBody: string[]): Set<string> {
  const names = new Set<string>();
  for (const line of sectionBody) {
    // Single-line string array: `key = [ "PEP508", "PEP508", … ]` (optional trailing comma).
    // The body group is quote-aware so `]` inside a quoted dep spec is not a terminator.
    const arr = /^\s*([A-Za-z0-9_.-]+)\s*=\s*\[((?:[^"\]]|"[^"]*")*)\]\s*$/.exec(line);
    if (arr) {
      const inner = arr[2]!;
      for (const quoted of inner.match(/"([^"]*)"/g) ?? []) {
        const spec = quoted.slice(1, -1);
        const name = extractPep508Name(spec);
        if (name !== null) names.add(name);
      }
    }
    // Non-array lines (e.g. `name = "myproj"`) contribute nothing.
  }
  return names;
}

/** Extracts dep names from a Poetry-style section: KEYS are names; values
 *  (version string or inline-table) are ignored. EXCLUDES the `python` key.
 *  Supports `foo = "^1.0"` and `foo = { version = "^1.0" }` (single-line inline
 *  table). Quoted keys (`"odd-pkg" = "^1.0"`) are NOT matched (documented drop).
 *
 *  NOTE: multi-line inline tables (`foo = {` with no closing `}` on the same
 *  line) are DROPPED — the brief's literal regex (`/^\s*(key)\s*=/`) would
 *  wrongly match `complex` from `complex = {`, failing the "DROPS multi-line
 *  inline tables" Poetry test. This matches the brief's prose intent (single-
 *  line inline tables supported, multi-line dropped). */
function extractPoetryDeps(sectionBody: string[]): Set<string> {
  const names = new Set<string>();
  for (const line of sectionBody) {
    const bare = /^\s*([A-Za-z0-9_.-]+)\s*=/.exec(line);
    if (bare) {
      const key = bare[1]!;
      if (key === 'python') continue;
      // Drop multi-line inline tables: opens `{` without a matching `}` on this line.
      const afterEq = line.slice(bare[0]!.length);
      if (afterEq.includes('{') && !afterEq.includes('}')) continue;
      names.add(normalizePep503(key));
    }
  }
  return names;
}

/** Rejects a dependency name containing path-traversal or separator segments
 *  before it is ever joined into a filesystem path. Mirrors the per-adapter
 *  `isUnsafeDepName` in ecosystem-npm.ts:21 / ecosystem-cargo.ts:252 (each
 *  adapter carries its own private copy — cargo's is NOT exported). */
function isUnsafeDepName(name: string): boolean {
  return name.includes('..') || name.includes('/') || name.includes(sep) || name.includes('\\');
}

/** Lexical within-root check on already-absolute paths. Low-level primitive;
 *  the containment gate is `resolvedWithinRoot` (realpath both sides). */
function isWithinRoot(candidateAbs: string, root: string): boolean {
  const base = root.endsWith(sep) ? root : root + sep;
  return candidateAbs === root || candidateAbs.startsWith(base);
}

/** Resolves `resolve(root, ...segments)` and returns it ONLY if (a) it exists
 *  and (b) its REALPATH (symlink-resolved) lies within root's OWN realpath.
 *  Canonicalizes BOTH sides before comparison (canonicalizing only the
 *  candidate would false-reject legitimate in-tree paths when root itself sits
 *  under a symlinked ancestor, e.g. macOS /tmp → /private/tmp). Fail-closed on
 *  any realpath error. Mirrors ecosystem-cargo.ts:289 resolvedWithinRoot. */
function resolvedWithinRoot(root: string, ...segments: string[]): string | null {
  const candidate = resolve(root, ...segments);
  if (!isWithinRoot(candidate, root)) return null;
  if (!existsSync(candidate)) return null;
  let real: string;
  let realRoot: string;
  try {
    real = realpathSync(candidate);
    realRoot = realpathSync(root);
  } catch {
    return null;
  }
  return isWithinRoot(real, realRoot) ? candidate : null;
}

/** Reads the `Name:` field from RFC 822 METADATA. Returns null if absent
 *  (fail-closed — spec §4.2 / research §5 Edge 4). Does NOT use the dir name. */
function readMetadataName(text: string): string | null {
  for (const line of text.split('\n')) {
    if (line === '') break; // end of headers
    const m = /^Name:\s*(.*)$/.exec(line);
    if (m) return m[1]!.trim();
  }
  return null;
}

/** Reads homepage from METADATA: prefers `Project-URL: Homepage, <url>`,
 *  falls back to deprecated `Home-page: <url>`. RFC 822 line folding is
 *  UNSUPPORTED and fail-closed (spec §4.2 step 4): a matched field whose NEXT
 *  line is a continuation (starts with whitespace, non-empty) is DROPPED —
 *  a truncated first-line value is never returned (a guess), the field is
 *  discarded entirely. */
function readHomepageFromMetadata(text: string): string | undefined {
  const lines = text.split('\n');
  let homePage: string | undefined;
  let projectUrlHomepage: string | undefined;
  const isFolded = (i: number): boolean => {
    const next = lines[i + 1];
    return next !== undefined && next !== '' && /^[ \t]/.test(next);
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line === '') break;
    const hp = /^Home-page:\s*(.*)$/.exec(line);
    if (hp) { if (!isFolded(i)) homePage = hp[1]!.trim(); continue; }
    const pu = /^Project-URL:\s*Homepage\s*,\s*(.*)$/i.exec(line);
    if (pu) { if (!isFolded(i)) projectUrlHomepage = pu[1]!.trim(); continue; }
  }
  return projectUrlHomepage ?? homePage;
}

export const pipAdapter: EcosystemAdapter = {
  ecosystem: 'pip',

  listDirectDeps(root: string): Set<string> {
    const pyprojectPath = join(root, 'pyproject.toml');
    if (!existsSync(pyprojectPath)) return new Set();
    let text: string;
    try {
      text = readFileSync(pyprojectPath, 'utf8');
    } catch {
      return new Set();
    }
    const parsed = parsePyproject(text);
    const names = new Set<string>();
    for (const [header, body] of parsed.sections) {
      if (header === 'project') {
        // PEP 621: only `dependencies = [...]` (other [project] fields are not deps).
        for (const line of body) {
          if (/^\s*dependencies\s*=/.test(line)) {
            for (const n of extractPep621Deps([line])) names.add(n);
          }
        }
      } else if (header === 'project.optional-dependencies') {
        for (const n of extractPep621Deps(body)) names.add(n);
      } else if (
        header === 'tool.poetry.dependencies' ||
        /^tool\.poetry\.group\.[A-Za-z0-9_-]+\.dependencies$/.test(header)
      ) {
        for (const n of extractPoetryDeps(body)) names.add(n);
      }
      // Unrecognized headers — fail-closed, contribute nothing.
    }
    return names;
  },

  readInstalledMeta(root: string, pkg: string): InstalledMeta | null {
    if (isUnsafeDepName(pkg)) return null;
    const normalizedPkg = normalizePep503(pkg);

    // Candidate venv roots inside root only: .venv/ and venv/.
    for (const venvName of ['.venv', 'venv']) {
      const venvLib = resolvedWithinRoot(root, venvName, 'lib');
      if (venvLib === null) continue;
      let pythonDirs: string[];
      try {
        pythonDirs = readdirSync(venvLib, { withFileTypes: true })
          .filter((e) => e.isDirectory() && e.name.startsWith('python'))
          .map((e) => e.name);
      } catch {
        continue;
      }
      for (const pyDir of pythonDirs) {
        const sitePackages = resolvedWithinRoot(root, venvName, 'lib', pyDir, 'site-packages');
        if (sitePackages === null) continue;
        let distInfoDirs: string[];
        try {
          distInfoDirs = readdirSync(sitePackages, { withFileTypes: true })
            .filter((e) => e.isDirectory() && e.name.endsWith('.dist-info'))
            .map((e) => e.name);
        } catch {
          continue;
        }
        for (const diName of distInfoDirs) {
          const metadataPath = resolvedWithinRoot(root, venvName, 'lib', pyDir, 'site-packages', diName, 'METADATA');
          if (metadataPath === null) continue;
          let text: string;
          try {
            text = readFileSync(metadataPath, 'utf8');
          } catch {
            continue;
          }
          // Read the Name: field (NOT the dir name — see spec §4.2 / research §5 Edge 4).
          const nameField = readMetadataName(text);
          if (nameField === null) continue; // no Name: header — fail-closed
          if (normalizePep503(nameField) !== normalizedPkg) continue;
          // Matched — extract homepage/repository.
          return { homepage: readHomepageFromMetadata(text), repository: undefined };
        }
      }
    }
    return null; // no venv under root, or no matching dist-info
  },
};
