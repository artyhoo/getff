import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectStack } from './index.ts';
import { readPythonCargo } from './read-python-cargo.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const TMP = resolve(REPO_ROOT, '.tmp-detector-pycargo-test');

function write(rel: string, content: string) {
  mkdirSync(TMP, { recursive: true });
  writeFileSync(resolve(TMP, rel), content);
}

describe('detectStack — python (pyproject.toml) priority 4', () => {
  beforeEach(() => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });
  });
  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it('PEP 621 fastapi → python stack, framework.name=fastapi, medium confidence', () => {
    write(
      'pyproject.toml',
      ['[project]', 'name = "svc"', 'dependencies = ["fastapi>=0.110", "uvicorn"]', ''].join('\n'),
    );
    const r = detectStack(TMP);
    expect(r.stack).toBe('python');
    expect(r.framework.name).toBe('fastapi');
    expect(r.runtime.name).toBe('python');
    expect(r.confidence).toBe('medium');
    expect(r.severity).toBe('warn');
    expect(r.weight).toBe(1);
    expect(r.source).toBe('pyproject.toml');
  });

  it('Poetry [tool.poetry.dependencies] django → python stack, framework.name=django', () => {
    write(
      'pyproject.toml',
      ['[tool.poetry.dependencies]', 'python = "^3.11"', 'django = "^5.0"', ''].join('\n'),
    );
    const r = detectStack(TMP);
    expect(r.stack).toBe('python');
    expect(r.framework.name).toBe('django');
  });

  it('PEP 508 requirement string with extras (flask) → framework.name=flask', () => {
    write(
      'pyproject.toml',
      ['[project]', 'dependencies = ["flask[async]>=3.0", "requests"]', ''].join('\n'),
    );
    const r = detectStack(TMP);
    expect(r.stack).toBe('python');
    expect(r.framework.name).toBe('flask');
  });

  it('SQLAlchemy (PEP 503 case/underscore normalization) → framework.name=sqlalchemy', () => {
    write('pyproject.toml', ['[project]', 'dependencies = ["SQLAlchemy>=2.0"]', ''].join('\n'));
    const r = detectStack(TMP);
    expect(r.stack).toBe('python');
    expect(r.framework.name).toBe('sqlalchemy');
  });

  it('framework precedence: fastapi wins over sqlalchemy when both present', () => {
    write(
      'pyproject.toml',
      ['[project]', 'dependencies = ["sqlalchemy>=2.0", "fastapi>=0.110"]', ''].join('\n'),
    );
    const r = detectStack(TMP);
    expect(r.framework.name).toBe('fastapi');
  });

  it('python stack with no recognized framework → framework.name=null (honest)', () => {
    write('pyproject.toml', ['[project]', 'dependencies = ["requests", "click"]', ''].join('\n'));
    const r = detectStack(TMP);
    expect(r.stack).toBe('python');
    expect(r.framework.name).toBeNull();
  });

  it('python stack → missing[] is empty (JS known-packages do not apply)', () => {
    write('pyproject.toml', ['[project]', 'dependencies = ["fastapi"]', ''].join('\n'));
    const r = detectStack(TMP);
    expect(r.missing).toEqual([]);
  });
});

describe('detectStack — cargo (Cargo.toml) priority 4', () => {
  beforeEach(() => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });
  });
  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it('Cargo.toml → cargo stack, framework.name=null (no rust framework detection — T14)', () => {
    write(
      'Cargo.toml',
      ['[package]', 'name = "svc"', 'version = "0.1.0"', '', '[dependencies]', 'serde = "1.0"', ''].join('\n'),
    );
    const r = detectStack(TMP);
    expect(r.stack).toBe('cargo');
    expect(r.framework.name).toBeNull();
    expect(r.runtime.name).toBe('cargo');
    expect(r.confidence).toBe('medium');
    expect(r.source).toBe('Cargo.toml');
  });

  it('cargo stack → missing[] is empty', () => {
    write('Cargo.toml', ['[package]', 'name = "svc"', ''].join('\n'));
    const r = detectStack(TMP);
    expect(r.missing).toEqual([]);
  });
});

describe('detectStack — manifest precedence (package.json wins over pyproject/Cargo)', () => {
  beforeEach(() => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });
  });
  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it('package.json + pyproject.toml both present → package.json (ts-server) wins', () => {
    write('package.json', JSON.stringify({ name: 'poly', dependencies: { zod: '^3.24.0' } }));
    write('pyproject.toml', ['[project]', 'dependencies = ["fastapi"]', ''].join('\n'));
    const r = detectStack(TMP);
    expect(r.stack).toBe('ts-server');
    expect(r.source).toBe('package.json');
  });

  // @arm:A2:pos polyglot-precedence-pinned (previously-unpinned combination — a
  // precedence flip on package.json+Cargo.toml was silent before this arm; spec §3.1
  // A2 row + W1 #1074 MINOR characterization-precedent)
  it('package.json + Cargo.toml both present (no pyproject) → package.json (ts-server) wins', () => {
    write('package.json', JSON.stringify({ name: 'poly', dependencies: { zod: '^3.24.0' } }));
    write('Cargo.toml', ['[package]', 'name = "svc"', 'version = "0.1.0"', ''].join('\n'));
    const r = detectStack(TMP);
    expect(r.stack).toBe('ts-server');
    expect(r.source).toBe('package.json');
  });

  it('all three manifests present → package.json (ts-server) wins over both', () => {
    write('package.json', JSON.stringify({ name: 'poly', dependencies: { zod: '^3.24.0' } }));
    write('pyproject.toml', ['[project]', 'dependencies = ["fastapi"]', ''].join('\n'));
    write('Cargo.toml', ['[package]', 'name = "svc"', 'version = "0.1.0"', ''].join('\n'));
    const r = detectStack(TMP);
    expect(r.stack).toBe('ts-server');
    expect(r.source).toBe('package.json');
  });
});

describe('detectStack — python/cargo precedence (pyproject.toml wins over Cargo.toml)', () => {
  beforeEach(() => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });
  });
  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  // Real case: PyO3/maturin hybrids ship both pyproject.toml and Cargo.toml and
  // no package.json. read-python-cargo checks pyproject.toml first → python wins.
  it('pyproject.toml + Cargo.toml both present, no package.json → python wins (deterministic)', () => {
    write('pyproject.toml', ['[project]', 'dependencies = ["fastapi"]', ''].join('\n'));
    write('Cargo.toml', ['[package]', 'name = "svc"', 'version = "0.1.0"', ''].join('\n'));
    const r = detectStack(TMP);
    expect(r.stack).toBe('python');
    expect(r.source).toBe('pyproject.toml');
    expect(r.framework.name).toBe('fastapi');
  });
});

// @arm:A2:neg polyglot-precedence-pinned — RED-proof / precedence-flip detector.
// The index.ts readManifest→readPythonCargo ORDERING is the ONLY defense behind the
// ts-server outcomes characterized above: readPythonCargo itself happily claims a
// package.json+Cargo.toml root (first assertion), so reordering the chain flips
// detectStack's observable output and REDs the characterization tests in this file
// (spec §3.1 A2: "a precedence flip without a matching test update is RED"). Landed
// RED-proven twice against current code: (1) inverted assertions — expected 'cargo' /
// 'python' / pipAdapter, observed FAIL (received 'ts-server' / npmAdapter); (2) a
// reorder stub in index.ts (readPythonCargo hoisted above readManifest) REDs the
// package.json-wins tests. If the FIRST assertion below ever fails, the sub-reader
// stopped claiming polyglot roots — the arm's fixtures went vacuous and must be
// re-proven discriminating before any green is trusted.
describe('detectStack — A2 RED-proof: precedence ordering is the only defense (flip detector)', () => {
  beforeEach(() => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });
  });
  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it('readPythonCargo alone claims a package.json+Cargo.toml root as cargo; only the index.ts ordering yields ts-server', () => {
    write('package.json', JSON.stringify({ name: 'poly', dependencies: { zod: '^3.24.0' } }));
    write('Cargo.toml', ['[package]', 'name = "svc"', 'version = "0.1.0"', ''].join('\n'));
    // The losing reader WOULD win but for the ordering — proves the fixture is
    // non-vacuous (both readers genuinely claim this root).
    const sub = readPythonCargo(TMP);
    expect(sub).not.toBeNull();
    expect(sub!.stack).toBe('cargo');
    // The ordering decides the production observable.
    expect(detectStack(TMP).stack).toBe('ts-server');
  });
});
