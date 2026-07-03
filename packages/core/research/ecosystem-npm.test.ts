// Task 2.2 — npm EcosystemAdapter: direct deps + installed metadata (offline).
// Kickoff §4 edge cases: scoped names, npm alias resolves by KEY, workspace symlinks.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { npmAdapter, extractHttpsHost } from './ecosystem-npm.ts';

function makeRoot(opts: {
  pkgJson: Record<string, unknown>;
  installed?: Record<string, Record<string, unknown> | 'symlink-to-workspace'>;
  workspacePkgs?: Record<string, Record<string, unknown>>;
}): string {
  const root = mkdtempSync(join(tmpdir(), 'npm-adapter-'));
  writeFileSync(join(root, 'package.json'), JSON.stringify(opts.pkgJson, null, 2));
  const nm = join(root, 'node_modules');
  mkdirSync(nm, { recursive: true });
  for (const [name, meta] of Object.entries(opts.installed ?? {})) {
    if (meta === 'symlink-to-workspace') continue; // handled below
    const dir = name.startsWith('@') ? join(nm, ...name.split('/')) : join(nm, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'package.json'), JSON.stringify(meta, null, 2));
  }
  // Workspace symlink support: create a real dir elsewhere, symlink node_modules/<name> to it.
  if (opts.workspacePkgs) {
    const wsRoot = mkdtempSync(join(tmpdir(), 'npm-adapter-ws-'));
    for (const [name, meta] of Object.entries(opts.workspacePkgs)) {
      const realDir = join(wsRoot, name);
      mkdirSync(realDir, { recursive: true });
      writeFileSync(join(realDir, 'package.json'), JSON.stringify(meta, null, 2));
      const linkPath = name.startsWith('@') ? join(nm, ...name.split('/')) : join(nm, name);
      mkdirSync(join(linkPath, '..'), { recursive: true });
      symlinkSync(realDir, linkPath, 'dir');
    }
  }
  return root;
}

describe('npmAdapter.listDirectDeps', () => {
  it('lists a direct dependency present in node_modules', () => {
    const root = makeRoot({
      pkgJson: { dependencies: { 'drizzle-orm': '^0.40.0' } },
      installed: { 'drizzle-orm': { name: 'drizzle-orm', version: '0.40.0' } },
    });
    expect(npmAdapter.listDirectDeps(root).has('drizzle-orm')).toBe(true);
  });

  it('lists a devDependency present in node_modules', () => {
    const root = makeRoot({
      pkgJson: { devDependencies: { vitest: '^4.0.0' } },
      installed: { vitest: { name: 'vitest', version: '4.0.0' } },
    });
    expect(npmAdapter.listDirectDeps(root).has('vitest')).toBe(true);
  });

  it('excludes a transitive-only dep (present in node_modules, absent from package.json)', () => {
    const root = makeRoot({
      pkgJson: { dependencies: { 'drizzle-orm': '^0.40.0' } },
      installed: {
        'drizzle-orm': { name: 'drizzle-orm', version: '0.40.0' },
        'some-transitive-dep': { name: 'some-transitive-dep', version: '1.0.0' },
      },
    });
    const deps = npmAdapter.listDirectDeps(root);
    expect(deps.has('drizzle-orm')).toBe(true);
    expect(deps.has('some-transitive-dep')).toBe(false);
  });

  it('excludes a declared dep NOT actually installed in node_modules', () => {
    const root = makeRoot({
      pkgJson: { dependencies: { 'not-installed-pkg': '^1.0.0' } },
      installed: {},
    });
    expect(npmAdapter.listDirectDeps(root).has('not-installed-pkg')).toBe(false);
  });

  it('resolves a scoped dependency name (@scope/name)', () => {
    const root = makeRoot({
      pkgJson: { dependencies: { '@scope/name': '^1.0.0' } },
      installed: { '@scope/name': { name: '@scope/name', version: '1.0.0' } },
    });
    expect(npmAdapter.listDirectDeps(root).has('@scope/name')).toBe(true);
  });

  it('resolves an npm alias by KEY (declared alias, not the real package name)', () => {
    // "x": "npm:real-package@1" — npm installs the REAL package under node_modules/x.
    const root = makeRoot({
      pkgJson: { dependencies: { x: 'npm:real-package@1' } },
      installed: { x: { name: 'real-package', version: '1.0.0' } },
    });
    const deps = npmAdapter.listDirectDeps(root);
    expect(deps.has('x')).toBe(true);
    expect(deps.has('real-package')).toBe(false);
  });

  it('rejects a path-traversal dependency name (no fs escape) — research-source-trust.md §5 item D, now hardened', () => {
    // Non-vacuous falsifier: plant a package.json OUTSIDE node_modules/ at
    // the exact location a "../evil-escape" traversal would land on
    // (root/node_modules/../evil-escape/package.json === root/evil-escape/package.json).
    // Before the §5 item D guard, installedPkgJsonPath's plain `join` would
    // resolve straight to it; the guard must reject the name before that
    // join ever runs, regardless of what's on disk.
    const root = makeRoot({ pkgJson: {}, installed: {} });
    const escapeDir = join(root, 'evil-escape');
    mkdirSync(escapeDir, { recursive: true });
    writeFileSync(
      join(escapeDir, 'package.json'),
      JSON.stringify({ name: 'evil-escape', homepage: 'https://evil.example' }, null, 2),
    );
    expect(npmAdapter.readInstalledMeta(root, '../evil-escape')).toBeNull();
    expect(npmAdapter.readInstalledMeta(root, 'nested/../../evil-escape')).toBeNull();
  });

  it('resolves a workspace-linked package via its symlinked package.json', () => {
    const root = makeRoot({
      pkgJson: { dependencies: { '@workspace/lib': '*' } },
      workspacePkgs: {
        '@workspace/lib': { name: '@workspace/lib', version: '0.0.0', homepage: 'https://example.com' },
      },
    });
    const deps = npmAdapter.listDirectDeps(root);
    expect(deps.has('@workspace/lib')).toBe(true);
    const meta = npmAdapter.readInstalledMeta(root, '@workspace/lib');
    expect(meta?.homepage).toBe('https://example.com');
  });
});

describe('npmAdapter.readInstalledMeta', () => {
  it('reads homepage + repository from the installed package.json', () => {
    const root = makeRoot({
      pkgJson: { dependencies: { 'drizzle-orm': '^0.40.0' } },
      installed: {
        'drizzle-orm': {
          name: 'drizzle-orm',
          version: '0.40.0',
          homepage: 'https://orm.drizzle.team',
          repository: { type: 'git', url: 'git+https://github.com/drizzle-team/drizzle-orm.git' },
        },
      },
    });
    const meta = npmAdapter.readInstalledMeta(root, 'drizzle-orm');
    expect(meta?.homepage).toBe('https://orm.drizzle.team');
    expect((meta?.repository as { url?: string })?.url).toContain('github.com');
  });

  it('returns null for a missing installed package.json', () => {
    const root = makeRoot({ pkgJson: {}, installed: {} });
    expect(npmAdapter.readInstalledMeta(root, 'nonexistent-pkg')).toBeNull();
  });
});

describe('extractHttpsHost — table test for the five repository forms', () => {
  it('plain https:// URL string', () => {
    expect(extractHttpsHost('https://orm.drizzle.team')).toBe('orm.drizzle.team');
  });
  it('git+https:// URL string (strip git+ prefix)', () => {
    expect(extractHttpsHost('git+https://github.com/drizzle-team/drizzle-orm.git')).toBe(
      'github.com',
    );
  });
  it('{type,url} object form (recurse on url)', () => {
    expect(
      extractHttpsHost({ type: 'git', url: 'https://github.com/drizzle-team/drizzle-orm' }),
    ).toBe('github.com');
  });
  it('org/repo shorthand — no https host extractable, returns null', () => {
    expect(extractHttpsHost('drizzle-team/drizzle-orm')).toBeNull();
  });
  it('git@ SSH URL — no https host extractable, returns null', () => {
    expect(extractHttpsHost('git@github.com:drizzle-team/drizzle-orm.git')).toBeNull();
  });
  it('git:// URL — no https host extractable, returns null', () => {
    expect(extractHttpsHost('git://github.com/drizzle-team/drizzle-orm.git')).toBeNull();
  });
  it('undefined input — returns null', () => {
    expect(extractHttpsHost(undefined)).toBeNull();
  });
});
