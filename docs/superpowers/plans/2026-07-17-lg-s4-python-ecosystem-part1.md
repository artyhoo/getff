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

