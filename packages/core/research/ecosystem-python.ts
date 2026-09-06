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

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { EcosystemAdapter, InstalledMeta } from './allowlist-resolver.ts';
// R-1 (ledger-1597-fixes): the NAME + VALUE guards are the shared definitions in
// research-path-guards.ts — ONE definition per guard, so a hardening fix reaches
// every adapter at once instead of dying in a private copy. This adapter's
// contract is unchanged: isUnsafeDepName rejects a traversal ("..") or
// separator-bearing dep name before any join, and resolvedWithinRoot is the
// realpath-both-sides VALUE containment gate over the venv site-packages path
// (research-source-trust.md §5 item 2).
import { isUnsafeDepName, resolvedWithinRoot } from './research-path-guards.ts';

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
 *  `[project.optional-dependencies]` tables `key = ["…", …]`. Multi-line
 *  arrays are handled by the CALLER for `[project]` (see {@link collectArrayLines}
 *  in listDirectDeps): the accumulated lines are re-joined into the single-line
 *  shape before reaching this function.
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

/** Collects the body lines of a (possibly multi-line) TOML string-array value
 *  that OPENS on `body[start]` (`key = [ …`). Returns the accumulated lines
 *  (opening line through the line closing the array) plus the index of the next
 *  unconsumed line. Quote-aware: brackets inside a double-quoted spec (e.g.
 *  `django[bcrypt]`) are not array brackets. Returns null when the array is
 *  left unterminated at the end of the section body — fail-closed: the caller
 *  contributes NOTHING for that key (A7-1 keeps the malformed-input posture). */
function collectArrayLines(body: string[], start: number): { lines: string[]; next: number } | null {
  const lines: string[] = [];
  let depth = 0;
  let inQuotes = false;
  for (let i = start; i < body.length; i++) {
    const line = body[i]!;
    lines.push(line);
    for (let j = 0; j < line.length; j++) {
      const ch = line[j]!;
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (inQuotes) continue;
      if (ch === '[') depth++;
      else if (ch === ']') depth--;
    }
    if (depth <= 0 && !inQuotes) return { lines, next: i + 1 };
  }
  return null;
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

/** Reads the D7 `Project-URL: Documentation, <url>` field from METADATA (S1 of the
 *  getff-any-stack-trace umbrella; spec §4 W1-2). Same RFC 822 line-folding discipline
 *  as {@link readHomepageFromMetadata} — folded values are REJECTED, never partially
 *  accepted. There is NO deprecated single-line `Documentation:` form (PyPI only ever
 *  exposed this via Project-URL), so unlike Homepage there is nothing to fall back to.
 *
 *  Precedence vs. Homepage: this reader does NOT collapse Documentation and Homepage
 *  into a single value — both populate separate `InstalledMeta` fields and the resolver
 *  (`allowlist-resolver.ts` `tier1For` candidateFields) admits EITHER host independently.
 *  The umbrella kickoff §4 park-trigger ("do not invent a precedence rule when both
 *  fields are present and disagree") is satisfied by NOT collapsing: both hosts are
 *  Tier-1-eligible, neither wins over the other. The multi-tenant apex guard (DN #6)
 *  stays the load-bearing containment — a `github.com` Documentation URL is rejected
 *  there, exactly as a `github.com` Homepage already is. */
function readDocumentationFromMetadata(text: string): string | undefined {
  const lines = text.split('\n');
  let projectUrlDocumentation: string | undefined;
  const isFolded = (i: number): boolean => {
    const next = lines[i + 1];
    return next !== undefined && next !== '' && /^[ \t]/.test(next);
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line === '') break;
    const pu = /^Project-URL:\s*Documentation\s*,\s*(.*)$/i.exec(line);
    if (pu) { if (!isFolded(i)) projectUrlDocumentation = pu[1]!.trim(); continue; }
  }
  return projectUrlDocumentation;
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
        // PEP 621: only `dependencies = [...]` (other [project] fields are not deps —
        // the key filter stays, so multi-line `classifiers`/`authors` arrays still
        // contribute nothing). The array value may span multiple lines (the dominant
        // uv/hatch/pdm form — A7-1): accumulate from the opening `[` to its
        // quote-aware closing `]`, re-join into the single-line shape, and hand that
        // to extractPep621Deps. Unterminated arrays contribute nothing (fail-closed).
        for (let i = 0; i < body.length; ) {
          if (!/^\s*dependencies\s*=\s*\[/.test(body[i]!)) { i++; continue; }
          const acc = collectArrayLines(body, i);
          if (acc === null) break; // unterminated multi-line array — fail-closed
          for (const n of extractPep621Deps([acc.lines.join(' ')])) names.add(n);
          i = acc.next;
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
          // Matched — extract homepage/documentation/repository. D7 (S1 getff-any-stack-trace):
          // `documentation` is parsed alongside `homepage`; both populate separate InstalledMeta
          // fields and the resolver's `tier1For` admits either host independently (spec §4 W1-2).
          return {
            homepage: readHomepageFromMetadata(text),
            documentation: readDocumentationFromMetadata(text),
            repository: undefined,
          };
        }
      }
    }
    return null; // no venv under root, or no matching dist-info
  },
};
