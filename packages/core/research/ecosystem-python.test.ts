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
