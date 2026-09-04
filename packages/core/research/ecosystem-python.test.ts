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

import { pipAdapter } from './ecosystem-python.ts';
import { resolveAllowedSources } from './allowlist-resolver.ts';
import { mkdtempSync, writeFileSync, mkdirSync, symlinkSync } from 'node:fs';
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

  it('returns null when METADATA is unreadable (a directory, not a file) — readFileSync fail-closed (spec §5 item 3)', () => {
    const root = mkdtempSync(join(tmpdir(), 'pip-adapter-'));
    const di = join(root, '.venv', 'lib', 'python3.14', 'site-packages', 'weird-1.0.dist-info');
    // Make METADATA a DIRECTORY: resolvedWithinRoot succeeds (it exists, in-tree),
    // then readFileSync throws EISDIR → caught → continue → null (never a guess).
    mkdirSync(join(di, 'METADATA'), { recursive: true });
    expect(pipAdapter.readInstalledMeta(root, 'weird')).toBeNull();
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

  // @arm:B2:neg value-guard-containment (python KNOWN surface: venv lib symlink
  // out-of-tree → readInstalledMeta null. RED-proof re-observed at jig time: the
  // temporarily-inverted `.not.toBeNull()` failed with "expected null not to be
  // null" — the fixture still discriminates post-fix.)
  it('rejects a venv lib symlinked OUT-OF-TREE (VALUE containment via realpath both sides) — spec §5 item 5', () => {
    const root = mkdtempSync(join(tmpdir(), 'pip-adapter-'));
    // Attacker-controlled tree OUTSIDE root, shaped like a real venv lib dir.
    const outside = mkdtempSync(join(tmpdir(), 'pip-evil-'));
    const outSp = join(outside, 'python3.14', 'site-packages', 'Evil-1.0.dist-info');
    mkdirSync(outSp, { recursive: true });
    writeFileSync(join(outSp, 'METADATA'), 'Metadata-Version: 2.1\nName: evil\nProject-URL: Homepage, https://evil.example/\n');
    // In-tree symlink `.venv/lib` -> the out-of-tree attacker dir. The candidate
    // path is LEXICALLY within root (root/.venv/lib), so a lexical-only check
    // would pass; realpath-both-sides in resolvedWithinRoot must reject it.
    mkdirSync(join(root, '.venv'), { recursive: true });
    symlinkSync(outside, join(root, '.venv', 'lib'));
    expect(pipAdapter.readInstalledMeta(root, 'evil')).toBeNull();
  });

  it('drops a FOLDED (RFC 822 line-continuation) homepage field — fail-closed, never a truncated guess (spec §4.2 step 4)', () => {
    const root = makeVenvRoot({
      distInfos: {
        f: {
          dirName: 'folded-1.0.dist-info',
          // The Project-URL Homepage value is folded onto a continuation line.
          metadata: 'Metadata-Version: 2.1\nName: folded\nProject-URL: Homepage, https://ex.example/very/\n  long/continued/path\n',
        },
      },
    });
    const meta = pipAdapter.readInstalledMeta(root, 'folded');
    // Matched by Name:, but the folded homepage is dropped → homepage undefined.
    expect(meta).not.toBeNull();
    expect(meta?.homepage).toBeUndefined();
  });
});

// --- D7 (S1 getff-any-stack-trace): `Project-URL: Documentation, <url>` reader -------
//
// Spec: docs/superpowers/specs/2026-07-23-getff-any-stack-closure-design.md §4 W1-2.
// The `documentation` field joins `homepage` and `repository` as a Tier-1 candidate
// host source. Precedence vs. Homepage is intentionally NOT invented — both populate
// separate InstalledMeta fields and the resolver admits either host independently
// (kickoff §4 park-trigger satisfied by NOT collapsing).
describe('pipAdapter.readInstalledMeta — D7 Project-URL: Documentation', () => {
  it('parses `Project-URL: Documentation, <url>` into meta.documentation', () => {
    const root = makeVenvRoot({
      distInfos: {
        fa: {
          dirName: 'fastapi-0.100.dist-info',
          // Real FastAPI METADATA shape (apex host, NOT a multi-tenant apex).
          metadata:
            'Metadata-Version: 2.1\nName: fastapi\nProject-URL: Documentation, https://fastapi.tiangolo.com/\n',
        },
      },
    });
    const meta = pipAdapter.readInstalledMeta(root, 'fastapi');
    expect(meta?.documentation).toBe('https://fastapi.tiangolo.com/');
    // Homepage field is independently absent — the reader does NOT collapse Documentation
    // into Homepage to invent a value when Homepage is missing.
    expect(meta?.homepage).toBeUndefined();
  });

  it('populates BOTH homepage AND documentation when both Project-URL fields are present', () => {
    const root = makeVenvRoot({
      distInfos: {
        sa: {
          dirName: 'sqlalchemy-2.0.dist-info',
          // SQLAlchemy shape: Homepage=different domain, Documentation=docs.sqlalchemy.org.
          metadata:
            'Metadata-Version: 2.1\nName: sqlalchemy\nProject-URL: Homepage, https://www.sqlalchemy.org/\nProject-URL: Documentation, https://docs.sqlalchemy.org/\n',
        },
      },
    });
    const meta = pipAdapter.readInstalledMeta(root, 'sqlalchemy');
    expect(meta?.homepage).toBe('https://www.sqlalchemy.org/');
    expect(meta?.documentation).toBe('https://docs.sqlalchemy.org/');
  });

  it('drops a FOLDED Project-URL: Documentation field — same RFC 822 fail-closed discipline as Homepage', () => {
    const root = makeVenvRoot({
      distInfos: {
        f: {
          dirName: 'folded-doc-1.0.dist-info',
          // The Documentation value is folded onto a continuation line.
          metadata:
            'Metadata-Version: 2.1\nName: folded-doc\nProject-URL: Documentation, https://docs.example/very/\n  long/continued/path\n',
        },
      },
    });
    const meta = pipAdapter.readInstalledMeta(root, 'folded-doc');
    expect(meta).not.toBeNull();
    // Folded value is dropped entirely (never a truncated first-line guess).
    expect(meta?.documentation).toBeUndefined();
  });

  it('case-insensitive on the Documentation label (PyPI normalizes; reader matches the normalization)', () => {
    const root = makeVenvRoot({
      distInfos: {
        c: {
          dirName: 'case-1.0.dist-info',
          metadata:
            'Metadata-Version: 2.1\nName: case\nProject-URL: documentation, https://docs.case.example/\n',
        },
      },
    });
    expect(pipAdapter.readInstalledMeta(root, 'case')?.documentation).toBe(
      'https://docs.case.example/',
    );
  });

  it('does NOT confuse Documentation with a similarly-prefixed Project-URL label (scoped match)', () => {
    const root = makeVenvRoot({
      distInfos: {
        s: {
          dirName: 'strict-1.0.dist-info',
          // `Documentation-Source` is NOT `Documentation` — the reader must NOT match.
          // (A label like `Documentation, Github, <url>` would parse under the same
          // RFC-822-first-comma rule the Homepage reader uses; the resulting
          // `Github, <url>` value is then rejected downstream by the URL validator
          // because it isn't an https URL. So no separate guard is needed here —
          // the multi-tenant apex + URL-shape filter chain catches both shapes.)
          metadata:
            'Metadata-Version: 2.1\nName: strict\n' +
            'Project-URL: Documentation-Source, https://wrong.example/\n',
        },
      },
    });
    const meta = pipAdapter.readInstalledMeta(root, 'strict');
    // Prefix-overlap case: must NOT match.
    expect(meta?.documentation).toBeUndefined();
  });
});

// --- adapter-jig B3: direct-deps-only (transitive exclusion, pip lane) ---------
//
// Spec §3.2 B3: listDirectDeps returns DIRECT dependencies only — never the
// transitive closure. This is the load-bearing trust assumption the resolver
// delegates to the adapter (allowlist-resolver.ts:211 gates on
// `listDirectDeps(root).has(bareName)` BEFORE any metadata read): a
// closure-listing adapter would silently widen Tier-1 trust to every transitive
// dep's self-declared metadata. Retrofit gap this closes: the python
// transitive-exclusion (ecosystem-python.ts:219 reads ONLY pyproject.toml) was
// entirely untested — a plausible convenience refactor (scan .dist-info dirs to
// catch deps missing from pyproject) would have widened trust with zero RED.
//
// RED-proof: inverted assertion (`has('evil') → toBe(true)`) observed failing
// ("expected false to be true") before landing this GREEN form.
describe('pipAdapter — direct-deps-only: transitive exclusion gates Tier-1 (adapter-jig B3)', () => {
  // @arm:B3:pos direct-deps-only (declared dep passes the full derivation gate)
  it('a pyproject-declared dep IS a direct dep and derives its Tier-1 host', () => {
    const root = makeVenvRoot({
      pyproject: `[project]\nname = "consumer"\ndependencies = ["requests"]\n`,
      distInfos: {
        requests: {
          dirName: 'Requests-2.31.0.dist-info',
          metadata:
            'Metadata-Version: 2.1\nName: requests\nProject-URL: Homepage, https://python-requests.org\n',
        },
      },
    });
    expect(pipAdapter.listDirectDeps(root).has('requests')).toBe(true);
    const resolved = resolveAllowedSources({ root, adapter: pipAdapter });
    expect(resolved.tier1For('pip:requests')).toMatchObject({
      ok: true,
      hosts: ['python-requests.org'],
    });
  });

  // @arm:B3:neg direct-deps-only (transitive-only shape with attacker metadata)
  it('a package present ONLY in the venv (not declared in pyproject) is NOT a direct dep — Tier-1 misses, evil.example never authorized', () => {
    const root = makeVenvRoot({
      pyproject: `[project]\nname = "consumer"\ndependencies = ["requests"]\n`,
      distInfos: {
        evil: {
          dirName: 'Evil-1.0.dist-info',
          metadata:
            'Metadata-Version: 2.1\nName: evil\nProject-URL: Homepage, https://evil.example\n',
        },
      },
    });
    expect(pipAdapter.listDirectDeps(root).has('evil')).toBe(false);
    const resolved = resolveAllowedSources({ root, adapter: pipAdapter });
    const r = resolved.tier1For('pip:evil');
    expect(r).toMatchObject({
      ok: false,
      reason: expect.stringContaining('not a direct dependency'),
    });
  });
});
