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
  readFileSync,
  readlinkSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { symlinkOrJunctionOrSkip } from './symlink-or-junction-or-skip.ts';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const SCRIPT = resolve(REPO_ROOT, 'scripts/worktree-node-modules.sh');

// Every case here spawns scripts/worktree-node-modules.sh under bash against a fresh
// primary + linked git worktree, so multi-second runtimes under load are inherent and the
// vitest 5s default is a mis-set gate rather than a signal. A full Mac run of `npm --prefix
// packages/core run test:hooks` (M2 Max, load 3.8 -> 6.9, 260 s, measured 2026-10-01) timed
// out «keeps a mode change the user made before the install» here at 5000ms (earlier runs
// lost the nested-layer REFUSAL / without-node / space cases), while the same suite passed
// 87/87 files on Linux, and a different case fails on each run.
// 30_000 is the SLOW_SHELL_MS convention of the sibling shell-spawning suites
// (end-of-turn-reminder, dup-detect-empty-arg, priority-score-branch-matcher).
const SLOW_SHELL_MS = 30_000;

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

describe('worktree-node-modules.sh — provisioning SSOT', { timeout: SLOW_SHELL_MS }, () => {
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

  it('re-points a DANGLING symlink (not provisioned, but safe to replace)', (ctx) => {
    seed();
    // dangling but dir-shaped and absolute: the 'dir' hint takes the junction arm on
    // win32 (junctions may dangle); POSIX ignores the type (byte-identical link)
    symlinkOrJunctionOrSkip(
      ctx,
      resolve(primary, 'gone-away'),
      resolve(wt, 'node_modules'),
      'dir',
    );
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

describe('worktree-node-modules.sh — nested workspace layers', { timeout: SLOW_SHELL_MS }, () => {
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

  it('NEGATIVE: a root link to anything but the primary root layer gets no nested layer either', (ctx) => {
    seed({ dirs: [SPA], workspaces: ['packages/*'] });
    installInPrimary(SPA, 'eslint-plugin-jsx-a11y');
    mkdirSync(resolve(primary, 'elsewhere/node_modules/x'), { recursive: true });
    symlinkOrJunctionOrSkip(
      ctx,
      resolve(primary, 'elsewhere/node_modules'),
      resolve(wt, 'node_modules'),
    );

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

/**
 * LOCK-AWARE arm (incident 2026-09-30, worktree brave-lumiere-dd3388, branch
 * join/one-button-union): the branch's locks added oxlint, the primary's installed tree lacked
 * it, and the worktree — symlinked into that tree — failed `tsc --noEmit` with TS2307 on
 * `oxlint/plugins-dev` plus several vitest files: dependency reds masquerading as code reds.
 *
 * A link is only a valid delivery when the primary's INSTALLED tree (npm's hidden lockfile,
 * node_modules/.package-lock.json) carries every direct dependency the worktree's lock plans,
 * at exactly the planned version. Otherwise the helper must not link: --check reports 3
 * (needs a real install), --apply unlinks every layer and installs for real, never through a
 * symlink (PR #1399: an install through the link reifies the SHARED clone and prunes it).
 *
 * npm itself is replaced by a recording stub (WNM_NPM) — no network, and the stub observes the
 * one property that matters: whether either node_modules path was a symlink when it ran.
 */
describe('worktree-node-modules.sh — lock-aware provisioning', { timeout: SLOW_SHELL_MS }, () => {
  let stubDir: string;
  let npmLog: string;

  type Lock = Record<string, string>; // direct dependency name -> planned/installed version

  /** A lockfileVersion-3 package-lock.json planning `deps` as direct devDependencies. */
  function lockJson(deps: Lock): string {
    const packages: Record<string, unknown> = {
      '': { name: 'fixture', devDependencies: Object.fromEntries(Object.keys(deps).map((n) => [n, '*'])) },
    };
    for (const [n, v] of Object.entries(deps)) packages[`node_modules/${n}`] = { version: v, dev: true };
    return `${JSON.stringify({ name: 'fixture', lockfileVersion: 3, requires: true, packages }, null, 2)}\n`;
  }

  /** Primary whose INSTALLED tree holds `installed`; worktree whose lock plans `planned`. */
  function seedLocks(installed: Lock, planned: Lock, opts: { hiddenLock?: boolean } = {}): void {
    seed();
    writeFileSync(resolve(primary, 'package-lock.json'), lockJson(installed));
    if (opts.hiddenLock !== false)
      writeFileSync(resolve(primary, 'node_modules/.package-lock.json'), lockJson(installed));
    writeFileSync(resolve(wt, 'package-lock.json'), lockJson(planned));
    // A tracked file npm chmods +x when it links a workspace `bin` (the incident's
    // packages/core/synthesizer/verify-provenance-cli.ts went 644 -> 755).
    writeFileSync(resolve(wt, 'packages/core/cli.ts'), '// bin target\n', { mode: 0o644 });
    writeFileSync(resolve(wt, 'packages/core/package-lock.json'), lockJson(planned));
    writeFileSync(resolve(wt, '.gitignore'), 'node_modules\n'); // as in any real npm repo
    execSync('git add -A && git -c user.email=t@e.com -c user.name=t commit -q -m locks', { cwd: wt });
  }

  function writeStub(body = ''): void {
    stubDir = mkdtempSync(resolve(tmpdir(), 'wnm-npm-'));
    npmLog = resolve(stubDir, 'npm.log');
    const stub = resolve(stubDir, 'npm');
    writeFileSync(
      stub,
      [
        '#!/usr/bin/env bash',
        'root_link=0; core_link=0',
        '[ -L node_modules ] && root_link=1',
        '[ -L packages/core/node_modules ] && core_link=1',
        `printf '%s|%s|root_link=%s|core_link=%s\\n' "$PWD" "$*" "$root_link" "$core_link" >> "${npmLog}"`,
        // What a real install leaves behind: a real tree, a rewritten lock, a chmodded bin target.
        'if [ "${1:-}" = ci ]; then mkdir -p packages/core/node_modules/dep; else mkdir -p node_modules/dep; fi',
        'printf "\\n" >> package-lock.json',
        'if [ "${1:-}" = ci ]; then printf "\\n" >> packages/core/package-lock.json; fi',
        'chmod 755 packages/core/cli.ts',
        body,
      ].join('\n'),
      { mode: 0o755 },
    );
  }

  function runNpm(mode: '--check' | '--apply'): { status: number; out: string } {
    try {
      const out = execFileSync('bash', [SCRIPT, mode, wt, primary], {
        encoding: 'utf8',
        stdio: 'pipe',
        env: { ...process.env, WNM_NPM: resolve(stubDir, 'npm') },
      });
      return { status: 0, out };
    } catch (e) {
      const err = e as { status?: number; stderr?: string; stdout?: string };
      return { status: err.status ?? -1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
    }
  }

  const npmCalls = (): string[] =>
    existsSync(npmLog) ? readFileSync(npmLog, 'utf8').trim().split('\n').filter(Boolean) : [];

  beforeEach(() => writeStub());
  afterEach(() => {
    if (stubDir) rmSync(stubDir, { recursive: true, force: true });
  });

  it('DIVERGED (fresh worktree): a direct dep missing from the primary tree -> real install, no link', () => {
    seedLocks({ vitest: '4.1.8' }, { vitest: '4.1.8', oxlint: '1.2.3' });

    expect(runNpm('--check').status).toBe(3);
    const r = runNpm('--apply');
    expect(r.status, r.out).toBe(0);

    expect(lstatSync(resolve(wt, 'node_modules')).isSymbolicLink()).toBe(false);
    expect(lstatSync(resolve(wt, 'packages/core/node_modules')).isSymbolicLink()).toBe(false);
    const calls = npmCalls();
    // CI's order (.github/workflows/audit-self.yml principles-meta-tests): the standalone core
    // install first, then the root workspace install, which settles packages/core/node_modules
    // into the ROOT lock's layout — the layout every committed bundle is built against.
    expect(calls.map((c) => c.split('|')[1])).toEqual(['ci --prefix packages/core', 'install --no-save']);
    // Never through a link: both layers were real (or absent) when npm ran.
    for (const c of calls) expect(c, c).toMatch(/root_link=0\|core_link=0$/);
    // The shared clone is untouched.
    expect(existsSync(resolve(primary, 'node_modules/dep'))).toBe(false);
  });

  it('DIVERGED (the incident): an already-linked worktree whose lock moved is unlinked, then installed', (ctx) => {
    seedLocks({ vitest: '4.1.8' }, { vitest: '4.1.8', oxlint: '1.2.3' });
    symlinkOrJunctionOrSkip(ctx, resolve(primary, 'node_modules'), resolve(wt, 'node_modules'));
    symlinkOrJunctionOrSkip(
      ctx,
      resolve(primary, 'packages/core/node_modules'),
      resolve(wt, 'packages/core/node_modules'),
    );

    expect(runNpm('--check').status).toBe(3);
    expect(runNpm('--apply').status).toBe(0);

    expect(lstatSync(resolve(wt, 'node_modules')).isSymbolicLink()).toBe(false);
    for (const c of npmCalls()) expect(c, c).toMatch(/root_link=0\|core_link=0$/);
    expect(existsSync(resolve(primary, 'node_modules/dep'))).toBe(false);
    expect(existsSync(resolve(primary, 'packages/core/node_modules/.keep'))).toBe(true);
  });

  it('DIVERGED with a NESTED workspace link: every node_modules link is dropped before npm runs', (ctx) => {
    // The nested-layer links (packages/<ws>/node_modules -> the primary's) are delivery links
    // too; npm reifying through one would write into the shared clone's workspace layer.
    seedLocks({ vitest: '4.1.8' }, { vitest: '4.1.8', oxlint: '1.2.3' });
    const WS = 'packages/preset-react-spa';
    mkdirSync(resolve(primary, WS, 'node_modules/eslint-plugin-jsx-a11y'), { recursive: true });
    mkdirSync(resolve(wt, WS), { recursive: true });
    symlinkOrJunctionOrSkip(ctx, resolve(primary, 'node_modules'), resolve(wt, 'node_modules'));
    symlinkOrJunctionOrSkip(
      ctx,
      resolve(primary, WS, 'node_modules'),
      resolve(wt, WS, 'node_modules'),
    );
    rmSync(stubDir, { recursive: true, force: true });
    writeStub(`[ -L ${WS}/node_modules ] && echo NESTED_LINK >> "${'$'}(dirname "$0")/npm.log"; mkdir -p ${WS}/node_modules/written`);

    expect(runNpm('--apply').status).toBe(0);

    expect(readFileSync(npmLog, 'utf8')).not.toContain('NESTED_LINK');
    expect(existsSync(resolve(primary, WS, 'node_modules/written'))).toBe(false);
    expect(existsSync(resolve(primary, WS, 'node_modules/eslint-plugin-jsx-a11y'))).toBe(true);
  });

  it('DIVERGED by version: the same direct dep at another exact version is not a valid link', () => {
    seedLocks({ vitest: '4.1.8' }, { vitest: '4.1.9' });
    expect(runNpm('--check').status).toBe(3);
  });

  it('PAIRED-NEGATIVE: a lock the primary tree satisfies still links, and npm never runs', () => {
    // Transitive / extra installed packages are irrelevant; only planned direct deps count.
    seedLocks({ vitest: '4.1.8', extra: '1.0.0' }, { vitest: '4.1.8' });
    expect(runNpm('--check').status).toBe(1);
    expect(runNpm('--apply').status).toBe(0);
    expect(readlinkSync(resolve(wt, 'node_modules'))).toBe(resolve(primary, 'node_modules'));
    expect(npmCalls()).toEqual([]);
    expect(runNpm('--check').status).toBe(0);
  });

  it('restores what npm rewrites: the lockfile bytes and tracked file modes', () => {
    seedLocks({ vitest: '4.1.8' }, { vitest: '4.1.8', oxlint: '1.2.3' });
    const before = readFileSync(resolve(wt, 'package-lock.json'), 'utf8');
    expect(runNpm('--apply').status).toBe(0);
    expect(readFileSync(resolve(wt, 'package-lock.json'), 'utf8')).toBe(before);
    expect(statSync(resolve(wt, 'packages/core/cli.ts')).mode & 0o777).toBe(0o644);
    expect(execSync('git status --porcelain', { cwd: wt, encoding: 'utf8' })).toBe('');
  });

  it('a failed install exits 2 and names the exact commands', () => {
    rmSync(stubDir, { recursive: true, force: true });
    writeStub('exit 1');
    seedLocks({ vitest: '4.1.8' }, { vitest: '4.1.8', oxlint: '1.2.3' });
    const before = readFileSync(resolve(wt, 'package-lock.json'), 'utf8');
    const r = runNpm('--apply');
    expect(r.status).toBe(2);
    expect(r.out).toContain('npm install --no-save');
    expect(r.out).toContain('npm ci --prefix packages/core');
    // The failure path restores too: no rewritten lock, no leftover bin-target mode change.
    expect(readFileSync(resolve(wt, 'package-lock.json'), 'utf8')).toBe(before);
    expect(statSync(resolve(wt, 'packages/core/cli.ts')).mode & 0o777).toBe(0o644);
    expect(execSync('git status --porcelain', { cwd: wt, encoding: 'utf8' })).toBe('');
  });

  it('restores the packages/core lockfile that `npm ci --prefix packages/core` rewrote', () => {
    seedLocks({ vitest: '4.1.8' }, { vitest: '4.1.8', oxlint: '1.2.3' });
    const before = readFileSync(resolve(wt, 'packages/core/package-lock.json'), 'utf8');
    expect(runNpm('--apply').status).toBe(0);
    expect(readFileSync(resolve(wt, 'packages/core/package-lock.json'), 'utf8')).toBe(before);
  });

  it("keeps a mode change the user made before the install (it is the user's, not npm's)", () => {
    seedLocks({ vitest: '4.1.8' }, { vitest: '4.1.8', oxlint: '1.2.3' });
    writeFileSync(resolve(wt, 'run.sh'), '#!/bin/sh\n', { mode: 0o644 });
    execSync('git add run.sh && git -c user.email=t@e.com -c user.name=t commit -q -m run', { cwd: wt });
    execSync('chmod 755 run.sh', { cwd: wt });
    expect(runNpm('--apply').status).toBe(0);
    expect(statSync(resolve(wt, 'run.sh')).mode & 0o777).toBe(0o755);
    expect(statSync(resolve(wt, 'packages/core/cli.ts')).mode & 0o777).toBe(0o644);
  });

  it('restores even when the install is interrupted (SIGTERM from a hook timeout)', () => {
    rmSync(stubDir, { recursive: true, force: true });
    // The stub signals the helper itself: the topmost ancestor still running the helper script
    // (a forked `( cd && npm )` subshell carries the same command line, so walk past it).
    writeStub(
      [
        'p=$PPID',
        'while :; do',
        '  pp=$(ps -o ppid= -p "$p" | tr -d " ")',
        '  ps -o command= -p "$pp" | grep -q worktree-node-modules.sh || break',
        '  p=$pp',
        'done',
        // Both layers exist as real dirs when the signal lands, so only the marker can tell
        // this half-done install from one the user made.
        'mkdir -p packages/core/node_modules/dep',
        'kill -TERM "$p"; sleep 1',
      ].join('\n'),
    );
    seedLocks({ vitest: '4.1.8' }, { vitest: '4.1.8', oxlint: '1.2.3' });
    const before = readFileSync(resolve(wt, 'package-lock.json'), 'utf8');
    expect(runNpm('--apply').status).not.toBe(0);
    expect(readFileSync(resolve(wt, 'package-lock.json'), 'utf8')).toBe(before);
    expect(statSync(resolve(wt, 'packages/core/cli.ts')).mode & 0o777).toBe(0o644);
    // An interrupted install is not a provisioned one: the next check must not pass it.
    expect(runNpm('--check').status).toBe(3);
  });

  it('a real install the helper made is re-checked when the lock moves again', () => {
    seedLocks({ vitest: '4.1.8' }, { vitest: '4.1.8', oxlint: '1.2.3' });
    expect(runNpm('--apply').status).toBe(0);
    expect(runNpm('--check').status).toBe(0);
    writeFileSync(resolve(wt, 'package-lock.json'), lockJson({ vitest: '4.1.8', oxlint: '1.3.0' }));
    expect(runNpm('--check').status).toBe(3);
  });

  it('--check on a diverged, linked worktree never writes', (ctx) => {
    seedLocks({ vitest: '4.1.8' }, { vitest: '4.1.8', oxlint: '1.2.3' });
    symlinkOrJunctionOrSkip(ctx, resolve(primary, 'node_modules'), resolve(wt, 'node_modules'));
    expect(runNpm('--check').status).toBe(3);
    expect(lstatSync(resolve(wt, 'node_modules')).isSymbolicLink()).toBe(true);
    expect(npmCalls()).toEqual([]);
  });

  it('a non-npm lockfile is never installed by the helper: exit 2, nothing touched', () => {
    seed();
    writeFileSync(resolve(primary, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n');
    writeFileSync(resolve(wt, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\nextra: 1\n');
    expect(runNpm('--check').status).toBe(3);
    const r = runNpm('--apply');
    expect(r.status).toBe(2);
    expect(r.out).toContain('pnpm install --frozen-lockfile');
    expect(existsSync(resolve(wt, 'node_modules'))).toBe(false);
    expect(npmCalls()).toEqual([]);
  });

  it("a workspace's nested plan is compared at its nested path, before the root layer", () => {
    // packages/other plans eslint 8 nested under itself while the root layer holds eslint 9.
    // Node resolves the nested copy first, so that is the version the comparison must use.
    const lock = (otherNested: string, root: string): string =>
      `${JSON.stringify({
        lockfileVersion: 3,
        packages: {
          '': { workspaces: ['packages/other'] },
          'packages/other': { devDependencies: { eslint: '*' } },
          'packages/other/node_modules/eslint': { version: otherNested },
          'node_modules/eslint': { version: root },
          'node_modules/@scope/other': { resolved: 'packages/other', link: true },
        },
      })}\n`;
    seed();
    writeFileSync(resolve(wt, 'package-lock.json'), lock('8.57.1', '9.0.0'));
    // The root copy differs (9.9.9), but node never reaches it for packages/other: faithful.
    writeFileSync(resolve(primary, 'node_modules/.package-lock.json'), lock('8.57.1', '9.9.9'));
    expect(runNpm('--check').status).toBe(1);
    writeFileSync(resolve(primary, 'node_modules/.package-lock.json'), lock('8.50.0', '8.57.1'));
    // The root copy happens to be 8.57.1, but node never reaches it for packages/other.
    expect(runNpm('--check').status).toBe(3);
  });

  it('a lockfileVersion-1 lock (no `packages`) falls back to the byte compare', () => {
    seed();
    writeFileSync(resolve(primary, 'node_modules/.package-lock.json'), '{"lockfileVersion":3,"packages":{}}\n');
    writeFileSync(resolve(primary, 'package-lock.json'), '{"lockfileVersion":1,"dependencies":{"a":{"version":"1.0.0"}}}\n');
    writeFileSync(resolve(wt, 'package-lock.json'), '{"lockfileVersion":1,"dependencies":{"a":{"version":"2.0.0"}}}\n');
    expect(runNpm('--check').status).toBe(3);
  });

  it('FALLBACK: without a hidden lockfile in the primary, a byte-different lock counts as diverged', () => {
    seedLocks({ vitest: '4.1.8' }, { vitest: '4.1.9' }, { hiddenLock: false });
    expect(runNpm('--check').status).toBe(3);
  });

  it('FALLBACK paired-negative: without a hidden lockfile, a byte-identical lock still links', () => {
    seedLocks({ vitest: '4.1.8' }, { vitest: '4.1.8' }, { hiddenLock: false });
    expect(runNpm('--check').status).toBe(1);
  });
});
