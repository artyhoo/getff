/**
 * Functional meta-tests for the portable worktree script
 * (scripts/create-worktree.sh) — the BUILD half of the dual-channel
 * worktree-create capability (verdict combo b+c, research patch
 * 2026-05-30-worktree-create-dual-channel.md §5).
 *
 * This is the CLI/CI/agent-callable sibling of the CC-only WorktreeCreate hook
 * (.claude/hooks/worktree-setup.sh). Same semantic check, two delivery channels
 * sharing the `worktree-create-setup` dual-pair anchor (dual-implementation-
 * discipline.md §5-§7). The hook reads JSON stdin; this script reads CLI args.
 *
 *   Usage  : bash scripts/create-worktree.sh <name> [<project-dir>] [<base-ref>]
 *   stdout : the worktree absolute path (ONLY thing on stdout)
 *   exit   : 0 = success ; non-zero = creation failed
 *
 * Tests run against a per-test temporary git repo so they neither touch the
 * real repo nor depend on origin/HEAD. Paired-negative scenarios assert the
 * failure modes the script is paid to detect (missing name, unresolvable
 * base ref) — principle-02 discipline applied to a bash artefact.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import {
  spawnBashOrSkip,
  fromMsysPath,
  toMsysArg,
  type Skippable,
} from './spawn-bash-or-skip.ts';
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readlinkSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const SCRIPT = resolve(REPO_ROOT, 'scripts/create-worktree.sh');

// This suite spawns the real create-worktree.sh, which does real git + filesystem
// work (worktree add, node_modules wiring, and — in the SELF-HEAL case — an
// `npm ci --prefix packages/core`). Multi-second runtimes are inherent, so the
// vitest 5s default is a mis-set gate rather than a signal: run in isolation the
// SELF-HEAL case measures 3.2s, but under full-suite parallel load
// (`vitest run hooks/ skills/`, measured 2026-08-10) it times out at 5000ms.
// 30_000 is the SLOW_SHELL_MS convention already used by the sibling shell-spawning
// suites (priority-score-synthetic, priority-score-skip-closed,
// done-md-completion-filter, pre-push.consumer-layout).
const SLOW_SHELL_MS = 30_000;

interface Result {
  stdout: string;
  stderr: string;
  status: number;
}

function runScript(
  ctx: Skippable,
  args: string[],
  env: Record<string, string> = {},
): Result {
  // POSIX: byte-identical spawnSync pass-through; win32: Git Bash or named skip (#1799).
  // toMsysArg: a drive-letter repo arg must reach the SUT in MSYS form — bash performs no
  // argv translation for CreateProcess-passed strings, so the native spelling breaks the
  // SUT's `${repo}/…` composition (run 40340771916 class C1; same seam contract the
  // default-dir arm's comparison already encodes below).
  const r = spawnBashOrSkip(ctx, 'bash', [SCRIPT, ...args.map(toMsysArg)], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  return {
    stdout: (r.stdout ?? '').trim(),
    stderr: (r.stderr ?? '').trim(),
    status: r.status ?? 1,
  };
}

function setupTempRepo(): string {
  const dir = mkdtempSync(resolve(tmpdir(), 'cwt-test-'));
  execSync('git init -q -b main', { cwd: dir });
  execSync('git config user.email test@example.com', { cwd: dir });
  execSync('git config user.name test', { cwd: dir });
  writeFileSync(resolve(dir, 'README.md'), 'test repo\n');
  // Track packages/core/ so the worktree checkout creates the directory —
  // matches production layout where the dir always exists in HEAD.
  mkdirSync(resolve(dir, 'packages/core'), { recursive: true });
  writeFileSync(resolve(dir, 'packages/core/.keep'), '');
  execSync('git add . && git commit -q -m init', { cwd: dir });
  // Primary node_modules — symlink target.
  mkdirSync(resolve(dir, 'node_modules'), { recursive: true });
  writeFileSync(resolve(dir, 'node_modules/.keep'), '');
  // This script delegates provisioning to scripts/worktree-node-modules.sh (single source of
  // truth shared with .claude/hooks/worktree-setup.sh). The fixture must ship that dependency
  // or the call silently no-ops on its `|| true` and every symlink assertion below fails.
  mkdirSync(resolve(dir, 'scripts'), { recursive: true });
  copyFileSync(
    resolve(REPO_ROOT, 'scripts/worktree-node-modules.sh'),
    resolve(dir, 'scripts/worktree-node-modules.sh'),
  );
  return dir;
}

function teardown(dir: string): void {
  try {
    const list = execSync(`git -C "${dir}" worktree list --porcelain`, {
      encoding: 'utf8',
    });
    for (const line of list.split('\n')) {
      const m = line.match(/^worktree (.+)$/);
      if (m && m[1] !== dir) {
        try {
          execSync(`git -C "${dir}" worktree remove "${m[1]}" --force`, {
            stdio: 'ignore',
          });
        } catch {
          /* best-effort */
        }
      }
    }
  } catch {
    /* repo may already be torn down */
  }
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* OS will collect /tmp */
  }
}

// win32: the SUT (create-worktree.sh) links node_modules with `ln -s`, which MSYS copies by
// default (nativestrict needs admin/Dev-Mode) — the link-shape assertions cannot hold (#1799).
// SELF-HEAL cold-primary stays live: it only asserts the NOT-a-symlink shape.
const WIN_SUT_LINK = process.platform === 'win32';

describe(
  'create-worktree.sh — portable worktree setup',
  { timeout: SLOW_SHELL_MS },
  () => {
    let repo: string;

    beforeEach(() => {
      repo = setupTempRepo();
    });
    afterEach(() => {
      teardown(repo);
    });

    it('valid name → creates worktree, prints absolute path on stdout, exit 0', (ctx) => {
      const r = runScript(ctx, ['my-wt', repo]);
      expect(r.status).toBe(0);
      const expected = `${repo}/.claude/worktrees/my-wt`;
      // On win32 the SUT prints the MSYS form of the repo arg it was handed (`/c/Users/…`,
      // true case) while node's tmpdir/mkdtemp spell the same tree with backslashes and
      // 8.3 names — compare separator- and case-insensitively after fromMsysPath, the same
      // idiom as the default-dir arm below (run 40340771916 class C1).
      if (process.platform === 'win32') {
        const norm = (p: string) => p.replace(/[\\/]/g, '/').toLowerCase();
        expect(norm(fromMsysPath(r.stdout)), `${r.stdout} vs ${expected}`).toBe(
          norm(expected),
        );
      } else {
        expect(r.stdout).toBe(expected);
      }
      expect(existsSync(expected)).toBe(true);
    });

    // win32: the SUT links with `ln -s` (MSYS copies) — see WIN_SUT_LINK.
    it.skipIf(WIN_SUT_LINK)(
      'symlinks node_modules from primary checkout (D2 workspace optimisation)',
      (ctx) => {
        const r = runScript(ctx, ['sym-root', repo]);
        expect(r.status).toBe(0);
        const wt = `${repo}/.claude/worktrees/sym-root`;
        expect(readlinkSync(`${wt}/node_modules`)).toBe(`${repo}/node_modules`);
      },
    );

    // win32: the SUT links with `ln -s` (MSYS copies) — see WIN_SUT_LINK.
    it.skipIf(WIN_SUT_LINK)(
      'symlinks packages/core/node_modules to the primary REAL nested dir when it exists (shadowing fix, 2026-07-02)',
      (ctx) => {
        // Primary carries a real nested layer (root lock plans diverging dep
        // versions there) — the worktree link must target IT, not ../../node_modules,
        // or esbuild bundles root versions and synth-bundle --check false-drifts.
        mkdirSync(resolve(repo, 'packages/core/node_modules'), {
          recursive: true,
        });
        writeFileSync(resolve(repo, 'packages/core/node_modules/.keep'), '');
        const r = runScript(ctx, ['sym-core-nested', repo]);
        expect(r.status).toBe(0);
        const wt = `${repo}/.claude/worktrees/sym-core-nested`;
        expect(readlinkSync(`${wt}/packages/core/node_modules`)).toBe(
          `${repo}/packages/core/node_modules`,
        );
      },
    );

    // win32: the SUT links with `ln -s` (MSYS copies) — see WIN_SUT_LINK.
    it.skipIf(WIN_SUT_LINK)(
      'falls back to ../../node_modules when primary has no nested packages/core/node_modules',
      (ctx) => {
        const r = runScript(ctx, ['sym-core', repo]);
        expect(r.status).toBe(0);
        const wt = `${repo}/.claude/worktrees/sym-core`;
        expect(readlinkSync(`${wt}/packages/core/node_modules`)).toBe(
          '../../node_modules',
        );
      },
    );

    // ── Self-heal: tsx toolchain reachability (incident 2026-07-21) ──

    it('SELF-HEAL: cold primary (tsx unreachable at both probe paths) → installs packages/core so tsx becomes reachable', (ctx) => {
      // Reproduce a worktree created while the primary was still cold: no tsx in
      // either probe path, so symlink delivery cannot surface it. Stub `npm` on
      // PATH so the self-heal `npm ci --prefix` is deterministic + offline — it
      // just materialises the tsx bin a real install would produce.
      const fakeBin = mkdtempSync(resolve(tmpdir(), 'cwt-fakenpm-'));
      writeFileSync(
        resolve(fakeBin, 'npm'),
        [
          '#!/usr/bin/env bash',
          'prefix=""',
          'while [ $# -gt 0 ]; do case "$1" in --prefix) prefix="$2"; shift 2;; *) shift;; esac; done',
          '[ -n "$prefix" ] || exit 1',
          'mkdir -p "$prefix/node_modules/.bin"',
          'printf "#!/bin/sh\\necho tsx\\n" > "$prefix/node_modules/.bin/tsx"',
          'chmod +x "$prefix/node_modules/.bin/tsx"',
        ].join('\n') + '\n',
        { mode: 0o755 },
      );
      // packages/core must carry a COMMITTED lockfile for the self-heal `npm ci`
      // to run (production tracks it, so every worktree checkout has it; the guard
      // skips self-heal without it). Commit it so the worktree checkout includes it.
      writeFileSync(resolve(repo, 'packages/core/package-lock.json'), '{}\n');
      execSync(
        'git add packages/core/package-lock.json && git commit -q -m lock',
        { cwd: repo },
      );
      try {
        const r = runScript(ctx, ['self-heal', repo], {
          PATH: `${fakeBin}:${process.env.PATH}`,
        });
        expect(r.status).toBe(0);
        const wt = `${repo}/.claude/worktrees/self-heal`;
        // tsx now reachable at the first probe path, in a REAL dir (the tsx-less
        // delivery symlink was dropped before the local install).
        expect(existsSync(`${wt}/packages/core/node_modules/.bin/tsx`)).toBe(
          true,
        );
        expect(
          lstatSync(`${wt}/packages/core/node_modules`).isSymbolicLink(),
        ).toBe(false);
      } finally {
        rmSync(fakeBin, { recursive: true, force: true });
      }
    });

    // win32: the SUT links with `ln -s` (MSYS copies) — see WIN_SUT_LINK.
    it.skipIf(WIN_SUT_LINK)(
      'SELF-HEAL NO-OP: tsx already reachable via root-node_modules symlink → no reinstall, delivery symlink preserved',
      (ctx) => {
        // Warm primary in workspace-hoist layout: tsx in ROOT node_modules. The
        // worktree's root symlink surfaces it via the 2nd probe path, so self-heal
        // must NOT fire (must not clobber the packages/core delivery symlink). Stub
        // `npm` to fail loudly so an erroneous reinstall would break the assertions.
        mkdirSync(resolve(repo, 'node_modules/.bin'), { recursive: true });
        writeFileSync(
          resolve(repo, 'node_modules/.bin/tsx'),
          '#!/bin/sh\necho tsx\n',
          { mode: 0o755 },
        );
        const fakeBin = mkdtempSync(resolve(tmpdir(), 'cwt-fakenpm-noop-'));
        writeFileSync(
          resolve(fakeBin, 'npm'),
          '#!/usr/bin/env bash\nexit 7\n',
          { mode: 0o755 },
        );
        try {
          const r = runScript(ctx, ['noop', repo], {
            PATH: `${fakeBin}:${process.env.PATH}`,
          });
          expect(r.status).toBe(0);
          const wt = `${repo}/.claude/worktrees/noop`;
          // Delivery symlink intact (self-heal did not clobber it).
          expect(
            lstatSync(`${wt}/packages/core/node_modules`).isSymbolicLink(),
          ).toBe(true);
          // tsx reachable via the root-node_modules symlink (2nd probe path).
          expect(existsSync(`${wt}/node_modules/.bin/tsx`)).toBe(true);
        } finally {
          rmSync(fakeBin, { recursive: true, force: true });
        }
      },
    );

    it('branch name follows convention: worktree-<name>', (ctx) => {
      runScript(ctx, ['branch-conv', repo]);
      const wtList = execSync(`git -C "${repo}" worktree list --porcelain`, {
        encoding: 'utf8',
      });
      expect(wtList).toContain('branch refs/heads/worktree-branch-conv');
    });

    it('idempotent: re-invoke with same name → reuse (same stdout path, exit 0)', (ctx) => {
      const a = runScript(ctx, ['idem', repo]);
      const b = runScript(ctx, ['idem', repo]);
      expect(a.status).toBe(0);
      expect(b.status).toBe(0);
      expect(b.stdout).toBe(a.stdout);
    });

    it('stdout is a single line, absolute path (orchestration contract)', (ctx) => {
      const r = runScript(ctx, ['one-line', repo]);
      expect(r.status).toBe(0);
      expect(r.stdout.split('\n').length).toBe(1);
      expect(r.stdout.startsWith('/')).toBe(true);
    });

    it('explicit base-ref arg is honoured (worktree based on the named ref)', (ctx) => {
      // Create a divergent branch with a distinctive marker file.
      execSync('git -C "' + repo + '" checkout -q -b feature-x', { cwd: repo });
      writeFileSync(resolve(repo, 'MARKER.txt'), 'from-feature-x\n');
      execSync(
        'git -C "' +
          repo +
          '" add MARKER.txt && git -C "' +
          repo +
          '" commit -q -m marker',
        {
          cwd: repo,
        },
      );
      execSync('git -C "' + repo + '" checkout -q main', { cwd: repo });

      const r = runScript(ctx, ['based', repo, 'feature-x']);
      expect(r.status).toBe(0);
      expect(existsSync(`${repo}/.claude/worktrees/based/MARKER.txt`)).toBe(
        true,
      );
    });

    it('WORKTREE_BASE_REF env is honoured when no explicit arg (configurable trunk)', (ctx) => {
      execSync('git -C "' + repo + '" checkout -q -b release', { cwd: repo });
      writeFileSync(resolve(repo, 'REL.txt'), 'from-release\n');
      execSync(
        'git -C "' +
          repo +
          '" add REL.txt && git -C "' +
          repo +
          '" commit -q -m rel',
        {
          cwd: repo,
        },
      );
      execSync('git -C "' + repo + '" checkout -q main', { cwd: repo });

      const r = runScript(ctx, ['env-base', repo], {
        WORKTREE_BASE_REF: 'release',
      });
      expect(r.status).toBe(0);
      expect(existsSync(`${repo}/.claude/worktrees/env-base/REL.txt`)).toBe(
        true,
      );
    });

    it('project-dir defaults to git toplevel when omitted (run from inside repo)', (ctx) => {
      // POSIX: byte-identical spawnSync pass-through; win32: Git Bash or named skip (#1799).
      const res = spawnBashOrSkip(ctx, 'bash', [SCRIPT, 'default-dir'], {
        encoding: 'utf8',
        cwd: repo,
      });
      const r = {
        stdout: (res.stdout ?? '').trim(),
        stderr: (res.stderr ?? '').trim(),
        status: res.status ?? 1,
      };
      expect(r.status).toBe(0);
      // git rev-parse --show-toplevel canonicalises symlinks (macOS /tmp →
      // /private/tmp), so compare against the resolved repo path. On win32 the
      // SUT speaks MSYS (`/c/…`, true case, via the rev-parse dialect shim) while
      // node's realpathSync.native expands 8.3 names and uses backslashes — compare
      // separator- and case-insensitively after fromMsysPath (#1799).
      if (process.platform === 'win32') {
        const norm = (p: string) => p.replace(/[\\/]/g, '/').toLowerCase();
        expect(
          norm(fromMsysPath(r.stdout)),
          `${r.stdout} vs ${realpathSync.native(repo)}`,
        ).toBe(
          norm(`${realpathSync.native(repo)}/.claude/worktrees/default-dir`),
        );
      } else {
        expect(r.stdout).toBe(
          `${realpathSync(repo)}/.claude/worktrees/default-dir`,
        );
      }
    });

    // ── Paired-negative scenarios: failure modes the script is paid to detect ──

    it('PAIRED-NEGATIVE: missing name (no args) → exit non-zero, no stdout', (ctx) => {
      const r = runScript(ctx, []);
      expect(r.status).not.toBe(0);
      expect(r.stdout).toBe('');
    });

    it('PAIRED-NEGATIVE: explicit non-existent base-ref → exit non-zero, no stdout', (ctx) => {
      const r = runScript(ctx, [
        'bad-base',
        repo,
        'origin/does-not-exist-anywhere',
      ]);
      expect(r.status).not.toBe(0);
      expect(r.stdout).toBe('');
    });
  },
);
