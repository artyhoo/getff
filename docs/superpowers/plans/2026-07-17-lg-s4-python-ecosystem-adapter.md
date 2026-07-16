# LG-S4 ecosystem-python.ts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a third `EcosystemAdapter` (`pipAdapter`) for python Tier-1 source-trust derivation, plus an unwired-debt tripwire that prevents the adapter from silently becoming dead code — closing the live-generation umbrella LG-S4.

**Architecture:** A root-locked-venv adapter (`ecosystem-python.ts`) mirrors the npm/cargo pattern: reads `pyproject.toml` for direct-dep names (PEP 508 extraction + PEP-503 normalization), reads `.dist-info/METADATA` from a root-local `.venv/` for homepage/repository. Local re-implementation of `resolvedWithinRoot` + `isUnsafeDepName` (cargo's copies are NOT exported — reuse-by-pattern). A tripwire test (`ecosystem-unwired-debt.test.ts`) counts unwired adapters against a strict BASELINE literal to catch silent debt growth.

**Tech Stack:** TypeScript, vitest, `node:fs`/`node:path`/`node:os`, PEP 508 (hand-rolled subset), RFC 822 METADATA parsing, TOML subset (hand-rolled, mirror cargo's `parseCargoToml`).

**Base:** `origin/staging` @ `de7fc9d4c` (LG-S3 merged). Worktree `claude/lg-s4-python-ecosystem`.

## Global Constraints

- **NO network, NO binary invocation** (offline-determinism — `research-source-trust.md §5`). Never shell out to `pip`/`python`/`poetry`/`uv`.
- **Containment:** every fs path derived from a dep name OR a manifest-declared value must lie within `root`'s own realpath, canonicalized on BOTH sides (`resolvedWithinRoot`, local copy).
- **Fail-closed:** any ambiguity, unrecognized shape, or parse error drops the field/entry (returns undefined/empty/null), NEVER guesses.
- **No new `ConventionNode` fields** (`ir/types.ts:3` frozen) — this plan touches none.
- **No edits to `ecosystem-cargo.ts`/`ecosystem-npm.ts`** — reuse-by-pattern only (re-implement locally).
- TS strict, no `any`.
- §1.7 Forward/Backward in the LG-S4 PR body (capability commit — see Task 7).

**Spec:** `docs/superpowers/specs/2026-07-17-lg-s4-python-ecosystem-adapter-design.md` (4-iteration reviewed). **Research base:** `docs/meta-factory/research-patches/2026-07-16-lg-s4-python-ecosystem-adapter.md` §4-§5 (live probes).

---

## File Structure

- **Create** `packages/core/research/ecosystem-python.ts` — the `pipAdapter` + PEP 508 extractor + PEP-503 normalizer + pyproject TOML subset parser + RFC 822 METADATA reader + local `resolvedWithinRoot`/`isUnsafeDepName`.
- **Create** `packages/core/research/ecosystem-python.test.ts` — full TDD suite (mirrors `ecosystem-cargo.test.ts` shape).
- **Create** `packages/core/research/ecosystem-unwired-debt.test.ts` — the tripwire (mirrors `ecosystem-adapter-precondition.test.ts` detector idiom).
- **Modify** `packages/core/research/ecosystem-name.ts:22` — add `'pip'` to `KNOWN_ECOSYSTEM_PREFIXES`.
- **Modify** `INSTALL-FOR-AI.md` — add python venv convention note (Task 6).
- **Create** `.claude/orchestrator-prompts/live-generation/done.md` — umbrella closure + gap log (Task 7, final).

---

### Task 1: PEP 508 name extraction + PEP-503 normalization (pure, no fs)

**Files:**
- Create: `packages/core/research/ecosystem-python.ts` (initial — the pure helpers only)
- Test: `packages/core/research/ecosystem-python.test.ts` (initial — pure-helper tests)

**Interfaces:**
- Produces: `normalizePep503(name: string): string` (lowercase; collapse runs of `[-_.]` to a single `-`); `extractPep508Name(spec: string): string | null` (bare canonical name from a PEP 508 string, PEP-503-normalized; `null` if unparseable).

- [ ] **Step 1: Write failing tests for `normalizePep503`**

Append to `ecosystem-python.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { normalizePep503, extractPep508Name } from './ecosystem-python.ts';

describe('normalizePep503', () => {
  it('lowercases and collapses [-_.] runs to a single -', () => {
    expect(normalizePep503('Django')).toBe('django');
    expect(normalizePep503('my_pkg')).toBe('my-pkg');
    expect(normalizePep503('my.pkg')).toBe('my-pkg');
    expect(normalizePep503('backports.tarfile')).toBe('backports-tarfile');
    expect(normalizePep503('foo-1')).toBe('foo-1');
    expect(normalizePep503('2to3')).toBe('2to3');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && npx vitest run research/ecosystem-python.test.ts`
Expected: FAIL — module `./ecosystem-python.ts` not found.

- [ ] **Step 3: Implement `normalizePep503`**

Create `packages/core/research/ecosystem-python.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && npx vitest run research/ecosystem-python.test.ts`
Expected: PASS.

- [ ] **Step 5: Write failing tests for `extractPep508Name`**

Append to the test file:

```typescript
describe('extractPep508Name', () => {
  it('extracts the bare name from PEP 508 spec strings (normalized)', () => {
    expect(extractPep508Name('django')).toBe('django');
    expect(extractPep508Name('django>=5.0')).toBe('django');
    expect(extractPep508Name('django[bcrypt]>=5.0')).toBe('django');
    expect(extractPep508Name('django[bcrypt]>=5.0; python_version>="3.10"')).toBe('django');
    expect(extractPep508Name('pytest>=7.0,<8.0')).toBe('pytest');
    expect(extractPep508Name('uvicorn[standard]')).toBe('uvicorn');
    expect(extractPep508Name('My_Pkg')).toBe('my-pkg');
  });

  it('returns null for unparseable / non-name shapes (fail-closed)', () => {
    expect(extractPep508Name('>=1.0')).toBeNull();      // starts with a version op
    expect(extractPep508Name('')).toBeNull();
    expect(extractPep508Name('   ')).toBeNull();
  });

  it('returns null for URL @ requirements and legacy parenthesized forms (documented drop)', () => {
    expect(extractPep508Name('my-pkg @ https://example.com/foo.tar.gz')).toBeNull();
    expect(extractPep508Name('package (>=1.0)')).toBeNull();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd packages/core && npx vitest run research/ecosystem-python.test.ts`
Expected: FAIL — `extractPep508Name` not exported.

- [ ] **Step 7: Implement `extractPep508Name`**

Append to `ecosystem-python.ts`:

```typescript
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
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd packages/core && npx vitest run research/ecosystem-python.test.ts`
Expected: PASS (all cases).

- [ ] **Step 9: Commit**

```bash
git add packages/core/research/ecosystem-python.ts packages/core/research/ecosystem-python.test.ts
git commit -m "feat(live-generation): LG-S4 T1 — PEP 508 name extraction + PEP-503 normalize"
```

---

### Task 2: pyproject.toml subset parser → `listDirectDeps`

**Files:**
- Modify: `packages/core/research/ecosystem-python.ts` (add TOML parser + `listDirectDeps`)
- Modify: `packages/core/research/ecosystem-python.test.ts` (add parser tests)

**Interfaces:**
- Consumes: `extractPep508Name` (Task 1).
- Produces: `parsePyproject(text: string): ParsedPyproject` (internal); `listDirectDeps` method (on the adapter object, Task 4 wires it).

- [ ] **Step 1: Write failing tests for `listDirectDeps` (PEP 621 array-field under `[project]`)**

Append:

```typescript
import { pipAdapter } from './ecosystem-python.ts';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function makePyprojectRoot(pyprojectText: string): string {
  const root = mkdtempSync(join(tmpdir(), 'pip-adapter-'));
  writeFileSync(join(root, 'pyproject.toml'), pyprojectText);
  return root;
}

describe('pipAdapter.listDirectDeps — PEP 621', () => {
  it('extracts names from [project] dependencies array (single-line)', () => {
    const root = makePyprojectRoot(`[project]
name = "myproj"
dependencies = ["requests>=2.0", "click", "django[bcrypt]>=5.0; python_version>='3.10'"]
`);
    expect(pipAdapter.listDirectDeps(root)).toEqual(new Set(['requests', 'click', 'django']));
  });

  it('extracts names from [project.optional-dependencies] (each value an array)', () => {
    const root = makePyprojectRoot(`[project]
name = "myproj"
dependencies = ["click"]
[project.optional-dependencies]
test = ["pytest>=8.0", "pytest-mock"]
dev = ["ruff"]
`);
    const deps = pipAdapter.listDirectDeps(root);
    expect(deps.has('pytest')).toBe(true);
    expect(deps.has('pytest-mock')).toBe(true);
    expect(deps.has('ruff')).toBe(true);
    expect(deps.has('click')).toBe(true);
  });

  it('returns empty set when pyproject.toml is absent', () => {
    const root = mkdtempSync(join(tmpdir(), 'pip-adapter-'));
    expect(pipAdapter.listDirectDeps(root)).toEqual(new Set());
  });

  it('returns empty set when pyproject.toml is malformed (fail-closed)', () => {
    const root = makePyprojectRoot(`this is not valid toml [[[`);
    expect(pipAdapter.listDirectDeps(root)).toEqual(new Set());
  });

  it('DROPS multi-line arrays (documented limitation, fail-closed)', () => {
    const root = makePyprojectRoot(`[project]
dependencies = [
  "requests>=2.0",
  "click",
]
`);
    expect(pipAdapter.listDirectDeps(root)).toEqual(new Set());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && npx vitest run research/ecosystem-python.test.ts`
Expected: FAIL — `pipAdapter` not exported.

- [ ] **Step 3: Implement the TOML parser + `listDirectDeps`**

Append to `ecosystem-python.ts`:

```typescript
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { readdirSync } from 'node:fs';
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
 *  `[project.optional-dependencies]` tables `key = ["…", …]`. */
function extractPep621Deps(sectionBody: string[]): Set<string> {
  const names = new Set<string>();
  for (const line of sectionBody) {
    // Single-line string array: `key = [ "PEP508", "PEP508", … ]` (optional trailing comma).
    const arr = /^\s*([A-Za-z0-9_.-]+)\s*=\s*\[([^\]]*)\]\s*$/.exec(line);
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
 *  table). Quoted keys (`"odd-pkg" = "^1.0"`) are NOT matched (documented drop). */
function extractPoetryDeps(sectionBody: string[]): Set<string> {
  const names = new Set<string>();
  for (const line of sectionBody) {
    const bare = /^\s*([A-Za-z0-9_.-]+)\s*=/.exec(line);
    if (bare) {
      const key = bare[1]!;
      if (key === 'python') continue;
      names.add(normalizePep503(key));
    }
  }
  return names;
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

  readInstalledMeta(_root: string, _pkg: string): InstalledMeta | null {
    // Implemented in Task 4.
    return null;
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && npx vitest run research/ecosystem-python.test.ts`
Expected: PASS (PEP 621 + optional + absent + malformed + multiline-drop).

- [ ] **Step 5: Write failing tests for Poetry tables**

Append:

```typescript
describe('pipAdapter.listDirectDeps — Poetry', () => {
  it('extracts KEYS from [tool.poetry.dependencies] (excludes python)', () => {
    const root = makePyprojectRoot(`[tool.poetry.dependencies]
python = "^3.11"
requests = "^2.31"
click = "^8.1"
`);
    const deps = pipAdapter.listDirectDeps(root);
    expect(deps.has('requests')).toBe(true);
    expect(deps.has('click')).toBe(true);
    expect(deps.has('python')).toBe(false);
  });

  it('extracts from [tool.poetry.group.<g>.dependencies] (Poetry 1.2+)', () => {
    const root = makePyprojectRoot(`[tool.poetry.group.dev.dependencies]
ruff = "^0.1.0"
[tool.poetry.group.test.dependencies]
pytest = "^8.0"
`);
    const deps = pipAdapter.listDirectDeps(root);
    expect(deps.has('ruff')).toBe(true);
    expect(deps.has('pytest')).toBe(true);
  });

  it('DROPS quoted-key deps (documented limitation)', () => {
    const root = makePyprojectRoot(`[tool.poetry.dependencies]
"odd-pkg" = "^1.0"
normal = "^2.0"
`);
    const deps = pipAdapter.listDirectDeps(root);
    expect(deps.has('odd-pkg')).toBe(false);
    expect(deps.has('normal')).toBe(true);
  });

  it('DROPS multi-line inline tables (documented limitation)', () => {
    const root = makePyprojectRoot(`[tool.poetry.dependencies]
complex = {
  version = "^1.0",
}
simple = "^2.0"
`);
    const deps = pipAdapter.listDirectDeps(root);
    expect(deps.has('complex')).toBe(false);
    expect(deps.has('simple')).toBe(true);
  });
});
```

- [ ] **Step 6: Run test — all should pass (parser already handles these)**

Run: `cd packages/core && npx vitest run research/ecosystem-python.test.ts`
Expected: PASS (the Step-3 implementation already covers these shapes).

- [ ] **Step 7: Commit**

```bash
git add packages/core/research/ecosystem-python.ts packages/core/research/ecosystem-python.test.ts
git commit -m "feat(live-generation): LG-S4 T2 — pyproject.toml parser + listDirectDeps"
```

---

### Task 3: Local containment helpers (`resolvedWithinRoot` + `isUnsafeDepName`)

**Files:**
- Modify: `packages/core/research/ecosystem-python.ts` (add the helpers)
- Modify: `packages/core/research/ecosystem-python.test.ts` (add guard tests)

**Interfaces:**
- Produces: `isUnsafeDepName(name): boolean` (reject `..`, `/`, `\`, platform-sep); `resolvedWithinRoot(root, ...segments): string | null` (realpath-canonicalize BOTH sides, lexical within-root check). Both private to the module (mirror npm/cargo — NOT exported).

- [ ] **Step 1: Write failing tests for the traversal guards (behavioural, via readInstalledMeta later — here test isUnsafeDepName directly through an exported test-only seam OR via a direct edge in Task 4)**

Because the helpers are private, test them THROUGH `readInstalledMeta` (Task 4) and through a `pipAdapter.listDirectDeps` negative control here. For now, add the positive-control test that documents the contract:

Append:

```typescript
describe('pipAdapter — traversal-guard contract (research-source-trust.md §5 item 2)', () => {
  it('listDirectDeps does not throw on a pyproject with path-traversal-shaped keys (they are just names, not joined here)', () => {
    // Dep NAMES that contain `..` are captured by the parser as names; they fail later
    // in readInstalledMeta (Task 4). listDirectDeps itself is pure-string on names.
    const root = makePyprojectRoot(`[tool.poetry.dependencies]
"../evil" = "^1.0"
`);
    // Does not throw; the quoted-key drop means ../evil is NOT captured anyway.
    expect(() => pipAdapter.listDirectDeps(root)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it passes (already covered by quoted-key drop)**

Run: `cd packages/core && npx vitest run research/ecosystem-python.test.ts`
Expected: PASS.

- [ ] **Step 3: Implement the local helpers (they are used by Task 4's readInstalledMeta)**

Append to `ecosystem-python.ts` (above `pipAdapter`):

```typescript
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
```

- [ ] **Step 4: Run full test suite — no regressions**

Run: `cd packages/core && npx vitest run research/ecosystem-python.test.ts`
Expected: PASS (helpers unused yet; compile-check only).

- [ ] **Step 5: Commit**

```bash
git add packages/core/research/ecosystem-python.ts packages/core/research/ecosystem-python.test.ts
git commit -m "feat(live-generation): LG-S4 T3 — local containment helpers (resolvedWithinRoot, isUnsafeDepName)"
```

---

### Task 4: `readInstalledMeta` — venv discovery + `Name:`-from-METADATA matching

**Files:**
- Modify: `packages/core/research/ecosystem-python.ts` (implement `readInstalledMeta`)
- Modify: `packages/core/research/ecosystem-python.test.ts` (the core RED/GREEN tests)

**Interfaces:**
- Consumes: `normalizePep503` (T1), `isUnsafeDepName` + `resolvedWithinRoot` (T3).
- Produces: `pipAdapter.readInstalledMeta(root, pkg): InstalledMeta | null`.

- [ ] **Step 1: Write failing tests (happy path + the Name:-from-METADATA method)**

Append a venv helper + tests:

```typescript
function makeVenvRoot(opts: {
  pyproject?: string;
  venvDir?: string; // default '.venv'
  pythonVersion?: string; // default '3.14'
  distInfos?: Record<string, { metadata: string; dirName: string }>; // dirName → METADATA text
}): string {
  const root = mkdtempSync(join(tmpdir(), 'pip-adapter-'));
  if (opts.pyproject) writeFileSync(join(root, 'pyproject.toml'), opts.pyproject);
  const venv = opts.venvDir ?? '.venv';
  const pyVer = opts.pythonVersion ?? '3.14';
  const sp = join(root, venv, 'lib', `python${pyVer}`, 'site-packages');
  mkdirSync(sp, { recursive: true });
  for (const [, info] of Object.entries(opts.distInfos ?? {})) {
    const di = join(sp, info.dirName);
    mkdirSync(di, { recursive: true });
    writeFileSync(join(di, 'METADATA'), info.metadata);
  }
  return root;
}

describe('pipAdapter.readInstalledMeta — happy path + Name: method', () => {
  it('extracts Homepage from Project-URL (preferred form)', () => {
    const root = makeVenvRoot({
      distInfos: {
        django: {
          dirName: 'Django-5.0.dist-info',
          metadata: 'Metadata-Version: 2.1\nName: Django\nProject-URL: Homepage, https://www.djangoproject.com/\n',
        },
      },
    });
    const meta = pipAdapter.readInstalledMeta(root, 'django');
    expect(meta?.homepage).toBe('https://www.djangoproject.com/');
  });

  it('matches a HYPHENATED package by Name: field (not dir-name) — django-stubs', () => {
    const root = makeVenvRoot({
      distInfos: {
        ds: {
          dirName: 'django_stubs-5.0.2.dist-info',
          metadata: 'Metadata-Version: 2.1\nName: django-stubs\nProject-URL: Homepage, https://github.com/typeddjango/django-stubs\n',
        },
      },
    });
    const meta = pipAdapter.readInstalledMeta(root, 'django-stubs');
    expect(meta?.homepage).toBe('https://github.com/typeddjango/django-stubs');
  });

  it('matches a DIGIT-LEADING-NAME package by Name: — foo-1', () => {
    const root = makeVenvRoot({
      distInfos: {
        f: {
          dirName: 'foo-1-1.0.dist-info',
          metadata: 'Metadata-Version: 2.1\nName: foo-1\nProject-URL: Homepage, https://foo.example\n',
        },
      },
    });
    expect(pipAdapter.readInstalledMeta(root, 'foo-1')?.homepage).toBe('https://foo.example');
  });

  it('falls back to deprecated Home-page: header', () => {
    const root = makeVenvRoot({
      distInfos: {
        x: {
          dirName: 'x-1.0.dist-info',
          metadata: 'Metadata-Version: 2.1\nName: x\nHome-page: https://x.example\n',
        },
      },
    });
    expect(pipAdapter.readInstalledMeta(root, 'x')?.homepage).toBe('https://x.example');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && npx vitest run research/ecosystem-python.test.ts`
Expected: FAIL — readInstalledMeta still returns null (stub from Task 2).

- [ ] **Step 3: Implement `readInstalledMeta`**

Replace the stub in `pipAdapter`:

```typescript
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
```

Add the metadata helpers above `pipAdapter`:

```typescript
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
 *  falls back to deprecated `Home-page: <url>`. Folded continuation lines
 *  are NOT supported — a field whose next line starts with whitespace is
 *  treated as ended (truncated URLs are NOT returned; the peek-next-line is
 *  implicitly handled because we match the header line and stop). */
function readHomepageFromMetadata(text: string): string | undefined {
  let homePage: string | undefined;
  let projectUrlHomepage: string | undefined;
  for (const line of text.split('\n')) {
    if (line === '') break;
    const hp = /^Home-page:\s*(.*)$/.exec(line);
    if (hp) { homePage = hp[1]!.trim(); continue; }
    const pu = /^Project-URL:\s*Homepage\s*,\s*(.*)$/i.exec(line);
    if (pu) { projectUrlHomepage = pu[1]!.trim(); continue; }
  }
  return projectUrlHomepage ?? homePage;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && npx vitest run research/ecosystem-python.test.ts`
Expected: PASS (happy + hyphen + digit + Home-page fallback).

- [ ] **Step 5: Write failing tests for the gap / fail-closed cases**

Append:

```typescript
describe('pipAdapter.readInstalledMeta — gaps & fail-closed', () => {
  it('returns null when no venv exists under root', () => {
    const root = mkdtempSync(join(tmpdir(), 'pip-adapter-'));
    expect(pipAdapter.readInstalledMeta(root, 'anything')).toBeNull();
  });

  it('returns null when venv exists but package is absent', () => {
    const root = makeVenvRoot({ distInfos: {} });
    expect(pipAdapter.readInstalledMeta(root, 'missing')).toBeNull();
  });

  it('returns null when dist-info exists but METADATA has NO Name: header', () => {
    const root = makeVenvRoot({
      distInfos: {
        bad: { dirName: 'bad-1.0.dist-info', metadata: 'Metadata-Version: 2.1\nVersion: 1.0\n' },
      },
    });
    expect(pipAdapter.readInstalledMeta(root, 'bad')).toBeNull();
  });

  it('rejects a traversal pkg name (isUnsafeDepName) before any path join', () => {
    const root = makeVenvRoot({ distInfos: {} });
    expect(pipAdapter.readInstalledMeta(root, '../evil')).toBeNull();
  });

  it('searches a second python* dir when multiple exist (edge case)', () => {
    const root = mkdtempSync(join(tmpdir(), 'pip-adapter-'));
    const sp1 = join(root, '.venv', 'lib', 'python3.14', 'site-packages');
    const sp2 = join(root, '.venv', 'lib', 'python3.99', 'site-packages');
    mkdirSync(sp1, { recursive: true });
    mkdirSync(sp2, { recursive: true });
    const di = join(sp2, 'Django-5.0.dist-info');
    mkdirSync(di, { recursive: true });
    writeFileSync(join(di, 'METADATA'), 'Metadata-Version: 2.1\nName: Django\nProject-URL: Homepage, https://www.djangoproject.com/\n');
    expect(pipAdapter.readInstalledMeta(root, 'django')?.homepage).toBe('https://www.djangoproject.com/');
  });
});
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd packages/core && npx vitest run research/ecosystem-python.test.ts`
Expected: PASS (all gap cases).

- [ ] **Step 7: Commit**

```bash
git add packages/core/research/ecosystem-python.ts packages/core/research/ecosystem-python.test.ts
git commit -m "feat(live-generation): LG-S4 T4 — readInstalledMeta (venv discovery + Name: matching)"
```

---

### Task 5: `'pip'` prefix + the unwired-debt tripwire

**Files:**
- Modify: `packages/core/research/ecosystem-name.ts:22` (add `'pip'`)
- Create: `packages/core/research/ecosystem-unwired-debt.test.ts`

**Interfaces:**
- Consumes: `parseEcosystemName` (existing) — must now route `pip:<name>` correctly.
- Produces: tripwire test asserting `unwiredCount === BASELINE` (BASELINE=2 after this task: cargo + python).

- [ ] **Step 1: Write failing tripwire test**

Create `packages/core/research/ecosystem-unwired-debt.test.ts`:

```typescript
// Unwired-debt tripwire — the anti-forget mechanism for EcosystemAdapter wiring.
// LG-S4 (live-generation umbrella). Spec §6.
// Mirrors ecosystem-adapter-precondition.test.ts's git-aware idiom: detects adapter
// implementation files via git ls-files + the `: EcosystemAdapter =` regex, then
// checks whether each adapter symbol appears in a production wiring site
// (any of the 5 ResolveCtx-accepting APIs: validateResearchPlan, resolveAllowedSources,
// checkResearchPlan, runProvenanceGate, runResearchValidation — all thread
// `adapter: <symbol>` through a ResolveCtx literal).
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');

function trackedResearchSources(): string[] {
  const out = execFileSync('git', ['ls-files', '-z', 'packages/core/research/*.ts'], {
    cwd: REPO_ROOT, encoding: 'utf8',
  });
  return out.split('\0').filter(Boolean)
    .filter((rel) => !rel.endsWith('.test.ts'))
    .map((rel) => resolve(REPO_ROOT, rel));
}

function adapterImplFiles(): { file: string; symbol: string }[] {
  // Matches `export const <symbol>: EcosystemAdapter =` (the typed-const idiom npm/cargo/python use).
  const out: { file: string; symbol: string }[] = [];
  const RE = /export\s+const\s+([A-Za-z0-9_]+)\s*:\s*EcosystemAdapter\s*=/;
  for (const f of trackedResearchSources()) {
    const m = RE.exec(readFileSync(f, 'utf8'));
    if (m) out.push({ file: f, symbol: m[1]! });
  }
  return out;
}

/** An adapter is WIRED if its symbol appears in a `ResolveCtx` object-literal
 *  (`adapter: <symbol>`), an assignment (`ctx.adapter = <symbol>`), or shorthand
 *  anywhere in non-test source. This catches all 5 ResolveCtx-accepting APIs
 *  uniformly (validateResearchPlan, resolveAllowedSources, checkResearchPlan,
 *  runProvenanceGate, runResearchValidation). */
function isWired(symbol: string): boolean {
  const grep = execFileSync(
    'git',
    ['grep', '-l', '--', `adapter: ${symbol}`, `adapter:${symbol}`, `${symbol}`],
    { cwd: REPO_ROOT, encoding: 'utf8' },
  ).split('\n').filter(Boolean)
    .filter((rel) => rel.endsWith('.ts') && !rel.endsWith('.test.ts'))
    .filter((rel) => !rel.includes('/research/ecosystem-')); // the adapter's own decl file
  // At least one non-test, non-self file references the symbol in a ctx-adjacent form.
  return grep.some((rel) => {
    const text = readFileSync(join(REPO_ROOT, rel), 'utf8');
    return new RegExp(`adapter\\s*:\\s*${symbol}\\b`).test(text)
      || new RegExp(`\\.adapter\\s*=\\s*${symbol}\\b`).test(text);
  });
}

describe('unwired-debt tripwire (spec §6)', () => {
  // BASELINE = current count of unwired adapters. Edited in-lockstep with any
  // wiring change: LG-S4 sets it to 2 (cargo + python unwired; npm wired).
  // Future wiring-umbrella decrements per wired adapter. Strict equality catches
  // BOTH silent growth (3 > 2) AND silent partial-wiring (1 < 2 without BASELINE edit).
  const BASELINE = 2;

  it('the number of unwired EcosystemAdapters equals BASELINE (strict — no silent debt drift)', () => {
    const impls = adapterImplFiles();
    const unwired = impls.filter((a) => !isWired(a.symbol));
    expect(
      { total: impls.length, unwired: unwired.length, unwiredSymbols: unwired.map((a) => a.symbol), BASELINE },
      `Unwired-adapter count drift: ${unwired.length} unwired (symbols: ${unwired.map((a) => a.symbol).join(', ')}) vs BASELINE ${BASELINE}. ` +
        `If you wired an adapter, DECREMENT BASELINE in this test. If you added an adapter, the wiring-umbrella must wire it (or bump BASELINE with rationale).`,
    ).toEqual({ total: impls.length, unwired: BASELINE, unwiredSymbols: unwired.map((a) => a.symbol), BASELINE });
  });

  it('detector sanity: npmAdapter is detected as wired (the baseline reference)', () => {
    expect(isWired('npmAdapter')).toBe(true);
  });
});
```

- [ ] **Step 2: Add `'pip'` to the prefix set**

Edit `packages/core/research/ecosystem-name.ts:22`:

```typescript
const KNOWN_ECOSYSTEM_PREFIXES: ReadonlySet<string> = new Set(['npm', 'cargo', 'pip']);
```

- [ ] **Step 3: Run tripwire test to verify it fails (BASELINE drift: should be 2 unwired but pipAdapter not yet wired into BASELINE expectations)**

Run: `cd packages/core && npx vitest run research/ecosystem-unwired-debt.test.ts`
Expected: PASS — pipAdapter (Task 4) + cargoAdapter = 2 unwired, npmAdapter wired. BASELINE=2. (This test SHOULD pass once Tasks 1-4 land; if it fails, the detector regex needs fixing.)

- [ ] **Step 4: Run the prefix test to confirm `pip:` routes correctly**

Run: `cd packages/core && npx vitest run research/ecosystem-name.test.ts`
Expected: PASS (existing tests still green; `pip:` now parses to ecosystem `pip`).

- [ ] **Step 5: Run the precondition tripwire to confirm re-arm**

Run: `cd packages/core && npx vitest run research/ecosystem-adapter-precondition.test.ts`
Expected: PASS — `pipAdapter` file carries `isUnsafeDepName` (Task 3), so the traversal-guard signal is present. (If FAIL, add the `isUnsafeDepName` textual signal to `ecosystem-python.ts`.)

- [ ] **Step 6: Commit**

```bash
git add packages/core/research/ecosystem-name.ts packages/core/research/ecosystem-unwired-debt.test.ts
git commit -m "feat(live-generation): LG-S4 T5 — 'pip' prefix + unwired-debt tripwire"
```

---

### Task 6: INSTALL-FOR-AI.md venv-convention note

**Files:**
- Modify: `INSTALL-FOR-AI.md` (add a python-stack section note)

- [ ] **Step 1: Locate the python-stack section in INSTALL-FOR-AI.md**

Run: `grep -n "python\|venv\|pyproject" INSTALL-FOR-AI.md`
If no python section exists, append one at the end of the file.

- [ ] **Step 2: Add the venv-convention note**

Append (or insert under the python section):

```markdown
## Python Tier-1 source trust (LG-S4)

Researched python rules can derive Tier-1 documentation-source trust from an
installed package's own metadata **when a root-local virtualenv is present**
(`<root>/.venv/` or `<root>/venv/`). A system-installed python (no project-local
venv) yields Tier-0 trust only — no regression, but no Tier-1 derivation.

Supported `pyproject.toml` forms (single-line, fail-closed on others):
- PEP 621 `[project] dependencies = ["..."]`
- PEP 621 `[project.optional-dependencies]`
- Poetry `[tool.poetry.dependencies]` and `[tool.poetry.group.<g>.dependencies]`

Known limitations (dropped, fail-closed — documented gaps):
- Multi-line arrays and multi-line inline tables are not parsed.
- Quoted-key Poetry deps (`"odd-pkg" = "^1.0"`) are not matched.
- Legacy setuptools parenthesized and URL `@` PEP 508 forms are not parsed.
```

- [ ] **Step 3: Commit**

```bash
git add INSTALL-FOR-AI.md
git commit -m "docs(live-generation): LG-S4 T6 — INSTALL-FOR-AI python venv convention"
```

---

### Task 7: `done.md` + PR (umbrella closure) — capability commit

**Files:**
- Create: `.claude/orchestrator-prompts/live-generation/done.md`
- README draft-diff goes in the PR body (README is maintainer-owned).

- [ ] **Step 1: Write `done.md`**

Create `.claude/orchestrator-prompts/live-generation/done.md` following the existing `done.md` schema (see `.claude/orchestrator-prompts/python-delivery-v0/done.md` for the template). Content must include:
- The umbrella's goal restatement (3-stack autogeneration).
- Stage status: LG-S1 (#1005), LG-S2 (#1006), LG-S3 (#1010), LG-S4 (this PR) — all merged.
- **Gap log (the critical anti-forget record):**
  - (a) **Wiring gap:** cargo + python adapters are unwired (0 production callers thread them into a `ResolveCtx`). The LG bridges (`research-to-node.ts:183`, `research-to-clippy-node.ts:196`) are Tier-0-only; `detectStack` is JS-only. Wiring BOTH adapters is a **future umbrella** — the `ecosystem-unwired-debt.test.ts` tripwire (BASELINE=2) makes this debt mechanically visible.
  - (b) **Staleness gap:** per-manifest deps-hash staleness was MOVED OUT of LG-S4 (owner decision 2026-07-17; rationale: bash-only `.toml`-parsing hook needed for python/rust consumers without Node). Separate task.
  - (c) **Coverage gaps:** §4.1 limitations (multi-line arrays/tables, quoted-key Poetry, legacy/URL PEP 508).
- **Scope deviation record:** kickoff §2 placed staleness IN LG-S4; spec §7 (owner decision) moved it OUT.

- [ ] **Step 2: Run the FULL suite green**

Run:
```bash
cd packages/core
npx vitest run research/ecosystem-python.test.ts research/ecosystem-unwired-debt.test.ts research/ecosystem-adapter-precondition.test.ts research/ecosystem-name.test.ts
npm run test:principles
npm run test:backends
npm run test:composition
npm run test:live-generation
```
Expected: ALL PASS.

- [ ] **Step 3: Prepare the README draft-diff (in PR body, NOT committed)**

Draft a one-line addition under the python-stack section of README.md noting that researched rules can derive Tier-1 trust from an installed package's metadata when a root-local venv is present. Include this as a ```diff``` block in the PR body (maintainer-owned artifact).

- [ ] **Step 4: Push the branch and open the PR**

```bash
git push -u origin claude/lg-s4-python-ecosystem
gh pr create --title "feat(live-generation): LG-S4 — ecosystem-python.ts adapter + unwired-debt tripwire" --body-file .github/PR-BODY-lg-s4.md
```

(PR body must include `### §1.7 Forward-check applied` + `### §1.7 Backward-check applied` sections with ≥1 `file:line` citation each — capability commit gate.)

- [ ] **Step 5: Wait for CI green, then report for merge**

Run: `~/.claude/scripts/ci-wait.sh <PR-number>`
Expected: exit 0 (green). Report the PR for owner merge (the merging session writes `done.md` per kickoff STOP-line `done.md ONLY at the LG-S4 final-PR merge`).

---

## Self-Review (run before handing off)

**1. Spec coverage:**
- §4.1 (listDirectDeps + PEP 508 + TOML + limitations) → Tasks 1, 2. ✅
- §4.2 (readInstalledMeta + venv + Name: method + containment) → Tasks 3, 4. ✅
- §4.3 (`'pip'` prefix) → Task 5. ✅
- §4.4 (wiring = none) → implicit (no wiring task; tripwire in Task 5 enforces). ✅
- §8.1 (INSTALL + README draft) → Task 6. ✅
- §6 (tripwire) → Task 5. ✅
- §7 (staleness OUT — recorded in done.md) → Task 7. ✅
- §5 (TDD test plan, all 6 groups) → Tasks 1-4. ✅

**2. Placeholder scan:** no TBD/TODO; every code step has full code; every test step has real assertions.

**3. Type consistency:** `EcosystemAdapter`/`InstalledMeta` (imported from `allowlist-resolver.ts`), `normalizePep503`/`extractPep508Name`/`pipAdapter` — names consistent across tasks.

**4. Tripwire BASELINE math:** pre-LG-S4 unwired=1 (cargo); LG-S4 lands pipAdapter (unwired) → 2; BASELINE=2. npmAdapter wired (file-clients.ts:46, cli.ts:69). `isWired('npmAdapter')=true`, `isWired('cargoAdapter')=false`, `isWired('pipAdapter')=false` → 2 unwired === BASELINE 2. ✅
