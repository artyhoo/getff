/**
 * Paired test for scripts/worktree-node-modules.sh — the single source of truth for worktree
 * node_modules provisioning, shared by .claude/hooks/worktree-setup.sh (CC channel) and
 * scripts/create-worktree.sh (portable channel).
 *
 * The load-bearing arm is CACHE-POISON (incident 2026-07-23): vitest materialises
 * `node_modules/.vite` inside a worktree the first time any suite runs there — including the
 * principles section of packages/core/hooks/pre-push.ts itself. The path then EXISTS, so the
 * old `[[ ! -e … ]]` guards in both channels were permanently false and the worktree could
 * never be provisioned; worse, `ln -sfn TARGET node_modules` against that directory produces
 * `node_modules/node_modules` — a link nested INSIDE the cache instead of replacing the path.
 * A live census found 32 of 125 worktrees in that state. Both the "heals it" and the "does not
 * nest" assertions below fail against the pre-fix logic.
 *
 * The REFUSAL arm is the guard on the other side: a worktree holding a real install must never
 * be clobbered, no matter how convenient replacing it would be.
 *
 * The NESTED-LAYER arms (2026-09-30): the root lock plans nested layers for workspaces other than
 * packages/core — packages/preset-react-spa/node_modules/eslint-plugin-jsx-a11y (absent from the
 * root layer) and eslint-plugin-react-hooks 6.1.1 (the root layer has 7.1.1). A census found all
 * 73 root-linked worktrees carrying preset-react-spa without that layer, so code there resolved
 * react-hooks 7.1.1 and could not resolve jsx-a11y at all. Each positive arm is paired with a
 * negative: a cache-only primary layer, a workspace the worktree lacks, and a directory outside
 * `workspaces` are all left unlinked.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync, execSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const SCRIPT = resolve(REPO_ROOT, 'scripts/worktree-node-modules.sh');

let primary: string;
let wt: string;

/**
 * Primary checkout + a worktree directory, both bare of node_modules. `dirs` are extra tracked
 * directories (workspaces or not); `workspaces` becomes the root package.json field when given.
 */
function seed(
  opts: { primaryCore?: boolean; dirs?: string[]; workspaces?: string[] | { packages: string[] } } = {},
): void {
  primary = mkdtempSync(resolve(tmpdir(), 'wnm-primary-'));
  execSync('git init -q -b main', { cwd: primary });
  execSync('git config user.email t@e.com && git config user.name t', { cwd: primary });
  writeFileSync(resolve(primary, 'README.md'), 'x\n');
  for (const d of ['packages/core', ...(opts.dirs ?? [])]) {
    mkdirSync(resolve(primary, d), { recursive: true });
    writeFileSync(resolve(primary, d, '.keep'), '');
  }
  if (opts.workspaces) {
    writeFileSync(
      resolve(primary, 'package.json'),
      JSON.stringify({ name: 'root', private: true, workspaces: opts.workspaces }),
    );
  }
  execSync('git add . && git commit -q -m init', { cwd: primary });

  mkdirSync(resolve(primary, 'node_modules/.bin'), { recursive: true });
  writeFileSync(resolve(primary, 'node_modules/.bin/tsx'), '#!/bin/sh\n');
  if (opts.primaryCore !== false) {
    // The primary's REAL nested layer — the root lock plans dep versions here that diverge
    // from the root layer (incident 2026-07-02).
    mkdirSync(resolve(primary, 'packages/core/node_modules'), { recursive: true });
    writeFileSync(resolve(primary, 'packages/core/node_modules/.keep'), '');
  }

  wt = resolve(primary, '.claude/worktrees/w');
  execSync(`git worktree add -q "${wt}" -b wt main`, { cwd: primary });
}

function run(mode: '--check' | '--apply', env: NodeJS.ProcessEnv = {}): number {
  try {
    execFileSync('bash', [SCRIPT, mode, wt, primary], {
      encoding: 'utf8',
      stdio: 'pipe',
      env: { ...process.env, ...env },
    });
    return 0;
  } catch (e) {
    return (e as { status?: number }).status ?? -1;
  }
}

/** Reproduce what vitest leaves behind on its first run inside a worktree. */
function plantViteCache(): void {
  mkdirSync(resolve(wt, 'node_modules/.vite'), { recursive: true });
  writeFileSync(resolve(wt, 'node_modules/.vite/deps.json'), '{}');
  mkdirSync(resolve(wt, 'node_modules/.vite-temp'), { recursive: true });
  mkdirSync(resolve(wt, 'packages/core/node_modules/.vite'), { recursive: true });
}

/** A real installed package inside the primary's `<dir>/node_modules`. */
function installInPrimary(dir: string, pkg: string): void {
  mkdirSync(resolve(primary, dir, 'node_modules', pkg), { recursive: true });
  writeFileSync(resolve(primary, dir, 'node_modules', pkg, 'package.json'), '{}');
}

afterEach(() => {
  if (primary) rmSync(primary, { recursive: true, force: true });
});

describe('worktree-node-modules.sh — provisioning SSOT', () => {
  it('CACHE POISON: heals a node_modules holding only .vite* caches, without nesting', () => {
    seed();
    plantViteCache();

    // Pre-fix state: the path exists, so both channels' `[[ ! -e … ]]` guards skipped it.
    expect(existsSync(resolve(wt, 'node_modules'))).toBe(true);
    expect(lstatSync(resolve(wt, 'node_modules')).isSymbolicLink()).toBe(false);
    expect(run('--check')).toBe(1); // fixable, not yet provisioned

    expect(run('--apply')).toBe(0);

    expect(lstatSync(resolve(wt, 'node_modules')).isSymbolicLink()).toBe(true);
    expect(readlinkSync(resolve(wt, 'node_modules'))).toBe(resolve(primary, 'node_modules'));
    // The nesting footgun: `ln -sfn TARGET <existing dir>` would have created this.
    expect(existsSync(resolve(wt, 'node_modules/node_modules'))).toBe(false);
    // The whole point — the toolchain is reachable again.
    expect(existsSync(resolve(wt, 'node_modules/.bin/tsx'))).toBe(true);
    expect(run('--check')).toBe(0);
  });

  it('points packages/core at the primary REAL nested dir, not ../../node_modules', () => {
    seed({ primaryCore: true });
    expect(run('--apply')).toBe(0);
    // A ../../node_modules link would SHADOW the nested layer and fake synth-bundle drift
    // in every fresh worktree (incident 2026-07-02).
    expect(readlinkSync(resolve(wt, 'packages/core/node_modules'))).toBe(
      resolve(primary, 'packages/core/node_modules'),
    );
  });

  it('falls back to ../../node_modules when the primary has no nested dir', () => {
    seed({ primaryCore: false });
    expect(run('--apply')).toBe(0);
    expect(readlinkSync(resolve(wt, 'packages/core/node_modules'))).toBe('../../node_modules');
  });

  it('REFUSAL: never clobbers a worktree holding a real install', () => {
    seed();
    mkdirSync(resolve(wt, 'node_modules/some-package'), { recursive: true });
    writeFileSync(resolve(wt, 'node_modules/some-package/index.js'), '// real\n');
    mkdirSync(resolve(wt, 'packages/core/node_modules/dep'), { recursive: true });

    expect(run('--check')).toBe(0); // a real install IS provisioned
    expect(run('--apply')).toBe(0);

    expect(lstatSync(resolve(wt, 'node_modules')).isSymbolicLink()).toBe(false);
    expect(existsSync(resolve(wt, 'node_modules/some-package/index.js'))).toBe(true);
  });

  it('re-points a DANGLING symlink (not provisioned, but safe to replace)', () => {
    seed();
    symlinkSync(resolve(primary, 'gone-away'), resolve(wt, 'node_modules'));
    expect(run('--check')).toBe(1);
    expect(run('--apply')).toBe(0);
    expect(readlinkSync(resolve(wt, 'node_modules'))).toBe(resolve(primary, 'node_modules'));
  });

  it('is idempotent — a second apply changes nothing', () => {
    seed();
    expect(run('--apply')).toBe(0);
    const before = readlinkSync(resolve(wt, 'node_modules'));
    expect(run('--apply')).toBe(0);
    expect(readlinkSync(resolve(wt, 'node_modules'))).toBe(before);
    expect(existsSync(resolve(wt, 'node_modules/node_modules'))).toBe(false);
  });

  it('exits 2 when the primary itself has no node_modules (unfixable, no partial state)', () => {
    seed();
    rmSync(resolve(primary, 'node_modules'), { recursive: true, force: true });
    rmSync(resolve(primary, 'packages/core/node_modules'), { recursive: true, force: true });
    plantViteCache();

    expect(run('--apply')).toBe(2);
    // Nothing half-applied: the cache dir is still a plain dir, no symlink was left behind.
    expect(lstatSync(resolve(wt, 'node_modules')).isSymbolicLink()).toBe(false);
  });

  it('--check never writes', () => {
    seed();
    plantViteCache();
    expect(run('--check')).toBe(1);
    expect(lstatSync(resolve(wt, 'node_modules')).isSymbolicLink()).toBe(false);
    expect(existsSync(resolve(wt, 'node_modules/.vite/deps.json'))).toBe(true);
  });
});

describe('worktree-node-modules.sh — nested workspace layers', () => {
  const SPA = 'packages/preset-react-spa';

  it('links a workspace nested layer the primary has, so its planned deps resolve', () => {
    seed({ dirs: [SPA], workspaces: ['packages/*'] });
    installInPrimary(SPA, 'eslint-plugin-jsx-a11y');
    expect(run('--apply')).toBe(0);
    // Pre-fix: root + core are linked and --check says provisioned, yet this layer is missing.
    rmSync(resolve(wt, SPA, 'node_modules'), { recursive: true, force: true });
    expect(run('--check')).toBe(1);

    expect(run('--apply')).toBe(0);

    expect(readlinkSync(resolve(wt, SPA, 'node_modules'))).toBe(resolve(primary, SPA, 'node_modules'));
    expect(existsSync(resolve(wt, SPA, 'node_modules/eslint-plugin-jsx-a11y/package.json'))).toBe(true);
    expect(run('--check')).toBe(0);
  });

  it('NEGATIVE: a primary layer holding only .vite* caches is not linked', () => {
    seed({ dirs: ['packages/runtime-bridge'], workspaces: ['packages/*'] });
    mkdirSync(resolve(primary, 'packages/runtime-bridge/node_modules/.vite'), { recursive: true });

    expect(run('--apply')).toBe(0);

    expect(existsSync(resolve(wt, 'packages/runtime-bridge/node_modules'))).toBe(false);
    expect(run('--check')).toBe(0);
  });

  it('heals a worktree nested layer poisoned by a .vite* cache, without nesting', () => {
    seed({ dirs: [SPA], workspaces: ['packages/*'] });
    installInPrimary(SPA, 'eslint-plugin-jsx-a11y');
    mkdirSync(resolve(wt, SPA, 'node_modules/.vite-temp'), { recursive: true });
    expect(run('--check')).toBe(1);

    expect(run('--apply')).toBe(0);

    expect(readlinkSync(resolve(wt, SPA, 'node_modules'))).toBe(resolve(primary, SPA, 'node_modules'));
    expect(existsSync(resolve(wt, SPA, 'node_modules/node_modules'))).toBe(false);
  });

  it('a real install in a worktree nested layer counts as provisioned and is left alone', () => {
    seed({ dirs: [SPA], workspaces: ['packages/*'] });
    installInPrimary(SPA, 'eslint-plugin-jsx-a11y');
    mkdirSync(resolve(wt, SPA, 'node_modules/own-dep'), { recursive: true });
    writeFileSync(resolve(wt, SPA, 'node_modules/own-dep/index.js'), '// real\n');

    expect(run('--apply')).toBe(0);

    expect(lstatSync(resolve(wt, SPA, 'node_modules')).isSymbolicLink()).toBe(false);
    expect(existsSync(resolve(wt, SPA, 'node_modules/own-dep/index.js'))).toBe(true);
  });

  it('REFUSAL: a regular file at a nested layer path exits 2 and is left untouched', () => {
    seed({ dirs: [SPA], workspaces: ['packages/*'] });
    installInPrimary(SPA, 'eslint-plugin-jsx-a11y');
    writeFileSync(resolve(wt, SPA, 'node_modules'), 'not a directory\n');

    // Unfixable in BOTH modes — --check must not call it fixable when --apply will refuse.
    expect(run('--check')).toBe(2);
    expect(run('--apply')).toBe(2);

    expect(lstatSync(resolve(wt, SPA, 'node_modules')).isFile()).toBe(true);
  });

  it('NEGATIVE: never creates a workspace directory the worktree does not have', () => {
    seed({ workspaces: ['packages/*'] });
    installInPrimary('packages/untracked-ws', 'dep'); // exists only in the primary

    expect(run('--apply')).toBe(0);

    expect(existsSync(resolve(wt, 'packages/untracked-ws'))).toBe(false);
    // …and does not count it as missing either, or --check could never converge.
    expect(run('--check')).toBe(0);
  });

  it('follows the package.json workspaces field, and links nothing outside it', () => {
    seed({ dirs: ['apps/web', 'tools/gen'], workspaces: ['apps/*'] });
    installInPrimary('apps/web', 'react');
    installInPrimary('tools/gen', 'dep'); // a real nested dir, but not a workspace

    expect(run('--apply')).toBe(0);

    expect(readlinkSync(resolve(wt, 'apps/web/node_modules'))).toBe(resolve(primary, 'apps/web/node_modules'));
    expect(existsSync(resolve(wt, 'tools/gen/node_modules'))).toBe(false);
  });

  it("NEGATIVE: a worktree with its OWN root install gets no primary nested layer planted in it", () => {
    // An install run in that worktree (npm ci / pnpm install) passes every root-link guard and
    // would then reify packages/<ws>/node_modules THROUGH the link, into the shared clone.
    seed({ dirs: [SPA], workspaces: ['packages/*'] });
    installInPrimary(SPA, 'eslint-plugin-jsx-a11y');
    mkdirSync(resolve(wt, 'node_modules/.pnpm'), { recursive: true });
    writeFileSync(resolve(wt, 'node_modules/.modules.yaml'), 'layoutVersion: 5\n');

    expect(run('--apply')).toBe(0);

    expect(existsSync(resolve(wt, SPA, 'node_modules'))).toBe(false);
    expect(run('--check')).toBe(0);
  });

  it('NEGATIVE: a root link to anything but the primary root layer gets no nested layer either', () => {
    seed({ dirs: [SPA], workspaces: ['packages/*'] });
    installInPrimary(SPA, 'eslint-plugin-jsx-a11y');
    mkdirSync(resolve(primary, 'elsewhere/node_modules/x'), { recursive: true });
    symlinkSync(resolve(primary, 'elsewhere/node_modules'), resolve(wt, 'node_modules'));

    expect(run('--apply')).toBe(0);

    expect(existsSync(resolve(wt, SPA, 'node_modules'))).toBe(false);
  });

  it('NEGATIVE: without node, no workspace is guessed — nothing nested is linked', () => {
    // CC-launched hooks run with a stripped PATH; a `packages/*` guess would link non-workspace
    // dirs in a repo whose workspaces are elsewhere, and differ from what pre-push links.
    seed({ dirs: [SPA], workspaces: ['packages/*'] });
    installInPrimary(SPA, 'eslint-plugin-jsx-a11y');

    expect(run('--apply', { WNM_NODE: '/nonexistent/node' })).toBe(0);

    expect(existsSync(resolve(wt, SPA, 'node_modules'))).toBe(false);
  });

  it('reads the { packages: [...] } form and applies ! exclusions', () => {
    seed({
      dirs: ['libs/a', 'libs/skip'],
      workspaces: { packages: ['libs/*', '!libs/skip'] },
    });
    installInPrimary('libs/a', 'dep');
    installInPrimary('libs/skip', 'dep');

    expect(run('--apply')).toBe(0);

    expect(readlinkSync(resolve(wt, 'libs/a/node_modules'))).toBe(resolve(primary, 'libs/a/node_modules'));
    expect(existsSync(resolve(wt, 'libs/skip/node_modules'))).toBe(false);
    expect(run('--check')).toBe(0);
  });

  it('expands a workspace pattern containing a space inside the worktree', () => {
    seed({ dirs: ['my pkgs/web'], workspaces: ['my pkgs/*'] });
    installInPrimary('my pkgs/web', 'dep');

    expect(run('--apply')).toBe(0);

    expect(readlinkSync(resolve(wt, 'my pkgs/web/node_modules'))).toBe(
      resolve(primary, 'my pkgs/web/node_modules'),
    );
  });

  it.skipIf(process.getuid?.() === 0)('a link that could not be created exits 2, not "provisioned"', () => {
    seed({ dirs: [SPA], workspaces: ['packages/*'] });
    installInPrimary(SPA, 'eslint-plugin-jsx-a11y');
    chmodSync(resolve(wt, SPA), 0o555); // ln cannot write into the workspace dir
    try {
      expect(run('--apply')).toBe(2);
      expect(run('--check')).toBe(1);
    } finally {
      chmodSync(resolve(wt, SPA), 0o755);
    }
  });
});
