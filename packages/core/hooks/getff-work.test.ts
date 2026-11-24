/**
 * Contract tests for getff-work.sh — the workspace one-command
 * (beta-delivery-ux S2 / spec A9 §5 AC-5).
 *
 * AC-5: A9 smoke on CC AND one non-CC harness.
 *   - CC path = native deferral (prove no wrapper fires; per §8a Park-4).
 *   - non-CC = launch or exact printed command.
 *
 *   ✅ CC-DEFERRAL:    CLAUDE_CODE_SESSION_ID set → defers, prints `claude -w`
 *   ✅ NON-CC-PRINT:   no CC env → prints ready command, does NOT spawn a session
 *   ✅ NO-LAUNCH-FLAG:  --no-launch forces print-only
 *   ✅ HELP-FLAG:      --help exits 0, prints usage
 *   ✅ MISSING-NAME:   no positional arg → exit 2, usage on stderr
 *   ✅ UNKNOWN-FLAG:   --bogus → exit 2, error on stderr
 *
 * All worktree-creating cases use disposable consumer repositories with the
 * shipped scripts. This avoids depending on the host primary's installed lock.
 * Each fixture owns and removes its own worktrees and branch metadata.
 *
 * Reference: packages/core/hooks/create-worktree.test.ts (sibling).
 * T3 compliance: each assertion cites command + output excerpt.
 */
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { execFileSync, execSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');

// Preserve the existing per-case and spawn guards; fixture work never needs network.
const SLOW_SHELL_MS = 60_000;

// FRESH-CONSUMER-SMOKE carries its OWN spawnSync guard so a hung create-worktree.sh
// fails with the captured-output assertion message rather than a bare vitest
// timeout. That only works while SLOW_SHELL_MS outlives this guard — keep the
// inequality if either number is ever retuned.
const SPAWN_GUARD_MS = 30_000;

function fixtureEnv(repo: string): NodeJS.ProcessEnv {
  const bin = join(repo, 'bin');
  return {
    ...process.env,
    WORKTREE_BASE_REF: 'HEAD',
    CLAUDE_COORDINATION_DIR: join(repo, 'coordination'),
    PATH: `${bin}:${process.env.PATH}`,
    WNM_NPM: join(bin, 'npm'),
    NPM_LOG: join(repo, 'npm.log'),
    CLI_LAUNCH_LOG: join(repo, 'harness-launch.log'),
  };
}

function runScript(
  repo: string,
  args: string[],
  env?: Record<string, string>,
): { status: number; stdout: string; stderr: string } {
  const r = spawnSync('bash', [join(repo, 'scripts/getff-work.sh'), ...args], {
    encoding: 'utf8',
    cwd: repo,
    env: { ...fixtureEnv(repo), ...env },
  });
  return {
    status: r.status ?? -1,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
  };
}

function uniqueName(stem: string): string {
  return stem; // Each case owns a separate repository and branch namespace.
}

/** Assert the actual dependency delivery and observable no-write contract. */
function expectSafeDelivery(
  repo: string,
  name: string,
  result: ReturnType<typeof runScript>,
): void {
  const wtModules = join(repo, '.claude/worktrees', name, 'node_modules');
  const installed = join(repo, 'node_modules');
  expect(result.status, result.stdout + result.stderr).toBe(0);
  expect(lstatSync(wtModules).isSymbolicLink()).toBe(true);
  expect(realpathSync(wtModules)).toBe(realpathSync(installed));
  expect(
    existsSync(join(repo, 'npm.log')),
    'npm must not run through the link',
  ).toBe(false);
  expect(readFileSync(join(installed, 'fixture-dep/index.js'), 'utf8')).toBe(
    'original primary content\n',
  );
  expect(result.stdout).toMatch(/delivery symlink into the primary checkout/);
}

function seedAlignedInstall(repo: string): void {
  const lock = JSON.stringify({
    lockfileVersion: 3,
    packages: {
      '': { dependencies: { 'fixture-dep': '1.2.3' } },
      'node_modules/fixture-dep': { version: '1.2.3' },
    },
  });
  writeFileSync(
    join(repo, 'package.json'),
    '{"name":"fixture","private":true,"dependencies":{"fixture-dep":"1.2.3"}}\n',
  );
  writeFileSync(join(repo, 'package-lock.json'), `${lock}\n`);
  writeFileSync(join(repo, 'node_modules/.package-lock.json'), `${lock}\n`);
  mkdirSync(join(repo, 'node_modules/fixture-dep'));
  writeFileSync(
    join(repo, 'node_modules/fixture-dep/index.js'),
    'original primary content\n',
  );
  execFileSync('git', ['add', 'package.json', 'package-lock.json'], {
    cwd: repo,
  });
  execFileSync('git', ['commit', '-q', '-m', 'aligned lock'], { cwd: repo });
}

/** Build a temp git repo with the 3 worktree helper scripts copied in. */
function setupTempRepo(prefix = 'getff-work-test-'): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  execSync('git init -q -b main', { cwd: dir });
  execSync('git config user.email test@example.com', { cwd: dir });
  execSync('git config user.name test', { cwd: dir });
  writeFileSync(join(dir, 'README.md'), 'test repo\n');
  writeFileSync(join(dir, '.gitignore'), 'node_modules\n.claude/worktrees\n');
  // Mirror production layout: scripts/create-worktree.sh + callees exist in the worktree.
  // R2 (S2 rework round 1): getff-work.sh is part of the shipped worktree-script set
  // (setup.d/85-worktree-scripts.sh WORKTREE_SCRIPTS array). Include it so the
  // fresh-consumer smoke (FRESH-CONSUMER-SMOKE below) tests the FULL shipped set.
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  for (const s of [
    'create-worktree.sh',
    'worktree-node-modules.sh',
    'link-coordination.sh',
    'getff-work.sh',
  ]) {
    const src = join(REPO_ROOT, 'scripts', s);
    if (existsSync(src)) {
      // Use cp via execSync (copyFileSync would not preserve mode).
      execSync(
        `cp "${src}" "${dir}/scripts/${s}" && chmod +x "${dir}/scripts/${s}"`,
      );
    }
  }
  mkdirSync(join(dir, 'packages/core'), { recursive: true });
  writeFileSync(join(dir, 'packages/core/.keep'), '');
  mkdirSync(join(dir, 'node_modules'), { recursive: true });
  writeFileSync(join(dir, 'node_modules/.keep'), '');
  execSync('git add . && git commit -q -m init', { cwd: dir });
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  writeFileSync(
    join(bin, 'npm'),
    '#!/bin/bash\nprintf "%s\\n" "$*" >> "$NPM_LOG"\nmkdir -p node_modules/fixture-dep\nprintf "npm wrote\\n" > node_modules/fixture-dep/index.js\n',
    { mode: 0o755 },
  );
  for (const cli of ['codex', 'zcode', 'claude']) {
    writeFileSync(
      join(bin, cli),
      '#!/bin/bash\nprintf "%s\\n" "$0" >> "$CLI_LAUNCH_LOG"\nexit 99\n',
      { mode: 0o755 },
    );
  }
  return dir;
}

describe(
  'getff-work.sh — workspace one-command (AC-5)',
  { timeout: SLOW_SHELL_MS },
  () => {
    let tmpRepo: string;
    beforeEach(() => {
      tmpRepo = setupTempRepo();
    });
    afterEach(() => {
      const launches = existsSync(join(tmpRepo, 'harness-launch.log'));
      const listing = execFileSync('git', ['worktree', 'list', '--porcelain'], {
        cwd: tmpRepo,
        encoding: 'utf8',
      });
      const worktrees = listing
        .split('\n')
        .filter((line) => line.startsWith('worktree '))
        .map((line) => line.slice('worktree '.length))
        .filter((path) => path !== tmpRepo);
      for (const path of worktrees) {
        const ownedPrefix = join(tmpRepo, '.claude/worktrees') + '/';
        if (!path.startsWith(ownedPrefix))
          throw new Error(`Unowned worktree: ${path}`);
        execFileSync('git', ['worktree', 'remove', '--force', path], {
          cwd: tmpRepo,
        });
      }
      const remaining = execFileSync(
        'git',
        ['worktree', 'list', '--porcelain'],
        { cwd: tmpRepo, encoding: 'utf8' },
      );
      expect(
        remaining.split('\n').filter((line) => line.startsWith('worktree ')),
      ).toHaveLength(1);
      rmSync(tmpRepo, { recursive: true, force: true });
      expect(existsSync(tmpRepo)).toBe(false);
      expect(launches, 'no actual harness may launch').toBe(false);
    });

    it.each([
      ['thread', { CODEX_THREAD_ID: 'test-codex-thread' }],
      ['harness', { AIF_HARNESS: 'codex' }],
    ])(
      'CODEX-READY-TEMP: explicit %s prefers Codex and quotes the worktree path',
      (_signal, signal) => {
        // A space in the consumer root makes shell quoting observable. No root or core
        // package/lockfile exists in this fixture, so neither provisioning leg installs.
        rmSync(tmpRepo, { recursive: true, force: true });
        tmpRepo = realpathSync(setupTempRepo('getff work codex-'));
        const bin = join(tmpRepo, 'bin');
        const launches = join(tmpRepo, 'launches.log');
        mkdirSync(bin, { recursive: true });
        for (const cli of ['codex', 'zcode', 'claude']) {
          writeFileSync(
            join(bin, cli),
            '#!/usr/bin/env bash\nprintf "%s\\n" "$0" >> "$CLI_LAUNCH_LOG"\nexit 99\n',
            { mode: 0o755 },
          );
        }
        const env = {
          ...process.env,
          CLAUDE_CODE_SESSION_ID: '',
          CODEX_THREAD_ID: '',
          AIF_HARNESS: '',
          ZCODE_SESSION_ID: '',
          WORKTREE_BASE_REF: 'HEAD',
          CLAUDE_COORDINATION_DIR: join(tmpRepo, 'coordination'),
          PATH: `${bin}:${process.env.PATH}`,
          CLI_LAUNCH_LOG: launches,
          ...signal,
        };
        const args = [
          join(tmpRepo, 'scripts/getff-work.sh'),
          'codex-ready',
          '--no-launch',
        ];
        const result = spawnSync('bash', args, {
          cwd: tmpRepo,
          env,
          encoding: 'utf8',
          timeout: SPAWN_GUARD_MS,
        });
        const output = `${result.stdout}${result.stderr}`;
        expect(result.status, output).toBe(0);
        expect(existsSync(launches), output).toBe(false);
        const command = result.stdout
          .split('\n')
          .find((line) => /^\s+codex -C /.test(line));
        expect(command, output).toBeDefined();
        expect(result.stdout, output).not.toMatch(/^\s+(zcode|claude)\b/m);
        // Parse the printed shell line with a function argument catcher; never invoke
        // the installed Codex executable, even if the output selects it correctly.
        const parsed = spawnSync(
          'bash',
          ['-c', 'codex() { printf "%s\\n" "$#" "$@"; };\n' + command],
          {
            cwd: tmpRepo,
            env,
            encoding: 'utf8',
            timeout: SPAWN_GUARD_MS,
          },
        );
        expect(parsed.status, `${parsed.stdout}${parsed.stderr}`).toBe(0);
        expect(parsed.stdout.split('\n')).toEqual([
          '2',
          '-C',
          join(tmpRepo, '.claude/worktrees/codex-ready'),
          '',
        ]);
        expect(existsSync(launches)).toBe(false);

        // Both explicit Codex signals must still defer when CC owns the session.
        const deferred = spawnSync('bash', args, {
          cwd: tmpRepo,
          env: { ...env, CLAUDE_CODE_SESSION_ID: 'test-cc-session' },
          encoding: 'utf8',
          timeout: SPAWN_GUARD_MS,
        });
        expect(deferred.status, `${deferred.stdout}${deferred.stderr}`).toBe(0);
        expect(deferred.stdout).toContain('done (CC deferral)');
        expect(deferred.stdout).toContain('claude -w codex-ready');
        expect(deferred.stdout).not.toMatch(/^\s+codex -C /m);
        expect(existsSync(launches)).toBe(false);
      },
    );

    // ✅ CC-DEFERRAL (Park-4 binding)
    it('consumer CC-DEFERRAL: CLAUDE_CODE_SESSION_ID set → defers, prints `claude -w` (no auto-launch)', () => {
      const name = uniqueName('smoke-cc');
      const r = runScript(tmpRepo, [name, '--no-launch'], {
        CLAUDE_CODE_SESSION_ID: 'fake-cc-session-id',
      });
      expect(
        r.status,
        `getff-work.sh exit code. output:\n${r.stdout}${r.stderr}`,
      ).toBe(0);
      expect(r.stdout).toMatch(/CC deferral|deferring|CLAUDE_CODE_SESSION_ID/i);
      expect(r.stdout).toMatch(new RegExp(`claude -w\\s+${name}`));
      // The wrapper does NOT itself spawn a `claude` session; verify it ends with
      // the "done (CC deferral)" line, not a session-launch log.
      expect(r.stdout).toMatch(/done \(CC deferral\)/);
    });

    // ✅ NON-CC-PRINT
    it('consumer NON-CC-PRINT: no CC env → prints ready command, does NOT spawn a session', () => {
      // Ensure CC env is unset for this test.
      const r = runScript(tmpRepo, [uniqueName('smoke-noncc'), '--no-launch'], {
        CLAUDE_CODE_SESSION_ID: '',
      });
      expect(
        r.status,
        `getff-work.sh exit code. output:\n${r.stdout}${r.stderr}`,
      ).toBe(0);
      // Without CC env, the wrapper prints a ready command for the operator to run.
      expect(r.stdout).toMatch(/cd\s+\S+/);
      expect(r.stdout).not.toMatch(/CC deferral/);
    });

    // ✅ NO-LAUNCH-FLAG (force print even in TTY)
    it('consumer NO-LAUNCH-FLAG: --no-launch forces print-only path', () => {
      // CLAUDE_CODE_SESSION_ID must be cleared: the asserted "done (--no-launch /
      // non-TTY)" line lives on the NON-CC path (getff-work.sh:200-203), and the
      // CC check at getff-work.sh:160 exits at :170 before ever reaching it. This
      // test inherited the ambient env, so it passed in CI and failed inside any
      // real CC session — a latent env-dependency that the branch-collision
      // failure masked until 2026-08-12.
      //
      // The assertion is on `reason=flag`, not on the literal '--no-launch'. The print-only line
      // reads '✓ done (--no-launch / non-TTY; reason=…)' and is also produced by the non-TTY
      // auto-enable at getff-work.sh:68-71 — and spawnSync is never a TTY. So a bare
      // toMatch(/--no-launch/) held whether or not the flag was parsed at all: breaking the
      // `--no-launch) NO_LAUNCH=1` arm left this test green while the operator's flag was
      // silently ignored in a real terminal. `reason` is the only observable that separates the
      // two paths under a test runner; the paired-negative below pins the other value.
      const r = runScript(
        tmpRepo,
        [uniqueName('smoke-nolaunch'), '--no-launch'],
        {
          CLAUDE_CODE_SESSION_ID: '',
        },
      );
      expect(
        r.status,
        `getff-work.sh exit code. output:\n${r.stdout}${r.stderr}`,
      ).toBe(0);
      expect(r.stdout).toMatch(/reason=flag/);
    });

    // ✅ NO-LAUNCH-FLAG paired-negative (same run, flag withheld)
    it('consumer NO-LAUNCH-FLAG (neg): without --no-launch the same print-only path reports reason=non-tty', () => {
      // Identical invocation minus the flag. Print-only is still reached (spawnSync is non-TTY),
      // so this pins the auto-enable path to its own reason value — which is what makes the
      // positive above falsifiable rather than a restatement of "the runner has no TTY".
      const r = runScript(tmpRepo, [uniqueName('smoke-nolaunch-neg')], {
        CLAUDE_CODE_SESSION_ID: '',
      });
      expect(
        r.status,
        `getff-work.sh exit code. output:\n${r.stdout}${r.stderr}`,
      ).toBe(0);
      expect(r.stdout).toMatch(/reason=non-tty/);
      expect(
        r.stdout,
        'the flag was not passed — reason must not claim it was',
      ).not.toMatch(/reason=flag/);
    });

    // The fixture contains real installed package content and a matching hidden lock.
    it('consumer: delivery symlink prevents install and preserves primary content', () => {
      seedAlignedInstall(tmpRepo);
      const name = uniqueName('smoke-nmguard');
      const result = runScript(tmpRepo, [name, '--no-launch'], {
        CLAUDE_CODE_SESSION_ID: '',
      });
      expectSafeDelivery(tmpRepo, name, result);
    });

    it('consumer: the delivery guard rejects an install-through-link mutant', () => {
      seedAlignedInstall(tmpRepo);
      const copy = join(tmpRepo, 'scripts/getff-work.sh');
      const original = readFileSync(copy, 'utf8');
      const guard =
        'if [ -n "$PKG_MANAGER" ] && [ -L "$WORKTREE_PATH/node_modules" ]; then';
      expect(original).toContain(guard);
      writeFileSync(copy, original.replace(guard, 'if false; then'));
      const name = uniqueName('smoke-mutant');
      const result = runScript(tmpRepo, [name, '--no-launch'], {
        CLAUDE_CODE_SESSION_ID: '',
      });
      expect(result.status, result.stdout + result.stderr).toBe(0);
      expect(
        lstatSync(
          join(tmpRepo, '.claude/worktrees', name, 'node_modules'),
        ).isSymbolicLink(),
      ).toBe(true);
      const invocation = readFileSync(join(tmpRepo, 'npm.log'), 'utf8');
      const primaryAfter = readFileSync(
        join(tmpRepo, 'node_modules/fixture-dep/index.js'),
        'utf8',
      );
      expect(invocation).toMatch(/^ci/m);
      expect(primaryAfter).toBe('npm wrote\n');
      expect(() => expectSafeDelivery(tmpRepo, name, result)).toThrow(
        /npm must not run through the link/,
      );
      console.log(
        'MUTANT-WITNESS',
        JSON.stringify({
          fixture: tmpRepo,
          invocation,
          primaryBefore: 'original primary content\n',
          primaryAfter,
          safetyAssertion: 'npm must not run through the link',
        }),
      );
    });

    // ✅ HELP-FLAG
    it('HELP-FLAG: --help exits 0 and prints usage', () => {
      const r = runScript(tmpRepo, ['--help']);
      expect(r.status).toBe(0);
      expect(r.stdout).toMatch(/Usage|getff-work\.sh/i);
    });

    // ✅ MISSING-NAME
    it('MISSING-NAME: no positional arg → exit 2 + usage on stderr', () => {
      const r = runScript(tmpRepo, []);
      expect(r.status).toBe(2);
      expect(r.stderr).toMatch(/usage/i);
    });

    // ✅ UNKNOWN-FLAG
    it('UNKNOWN-FLAG: --bogus → exit 2 + error on stderr', () => {
      const r = runScript(tmpRepo, ['name', '--bogus']);
      expect(r.status).toBe(2);
      expect(r.stderr).toMatch(/unknown flag|--bogus/i);
    });

    // ✅ NO-DOUBLE-INSTALL: when the provisioning helper already installed the worktree for real
    // (its lock diverges from the primary's installed tree), step 2 must not run a second install.
    it('NO-DOUBLE-INSTALL: a worktree the helper installed for real is not re-installed by step 2', () => {
      const lock = (deps: Record<string, string>): string =>
        `${JSON.stringify({
          lockfileVersion: 3,
          packages: {
            '': {
              devDependencies: Object.fromEntries(
                Object.keys(deps).map((n) => [n, '*']),
              ),
            },
            ...Object.fromEntries(
              Object.entries(deps).map(([n, v]) => [
                `node_modules/${n}`,
                { version: v },
              ]),
            ),
          },
        })}\n`;
      writeFileSync(
        join(tmpRepo, 'package-lock.json'),
        lock({ vitest: '4.1.8', oxlint: '1.2.3' }),
      );
      writeFileSync(
        join(tmpRepo, 'package.json'),
        '{"name":"fixture","private":true}\n',
      );
      writeFileSync(join(tmpRepo, '.gitignore'), 'node_modules\n');
      execSync('git add -A && git commit -q -m locks', { cwd: tmpRepo });
      // The primary's INSTALLED tree lacks oxlint, so the helper must install for real.
      writeFileSync(
        join(tmpRepo, 'node_modules/.package-lock.json'),
        lock({ vitest: '4.1.8' }),
      );
      const stubDir = mkdtempSync(join(tmpdir(), 'getff-work-npm-'));
      const npmLog = join(stubDir, 'npm.log');
      writeFileSync(
        join(stubDir, 'npm'),
        `#!/usr/bin/env bash\nprintf '%s\\n' "$*" >> "${npmLog}"\nmkdir -p node_modules/dep\n`,
        { mode: 0o755 },
      );

      const r = spawnSync(
        'bash',
        [join(tmpRepo, 'scripts/getff-work.sh'), 'smoke-once', '--no-launch'],
        {
          cwd: tmpRepo,
          encoding: 'utf8',
          timeout: SPAWN_GUARD_MS,
          // PATH: step 2 calls bare `npm`; the stub stands in for it too, so a second install is logged.
          env: {
            ...fixtureEnv(tmpRepo),
            CLAUDE_CODE_SESSION_ID: '',
            WNM_NPM: join(stubDir, 'npm'),
            PATH: `${stubDir}:${tmpRepo}/bin:${process.env.PATH}`,
          },
        },
      );
      const out = `${r.stdout}${r.stderr}`;
      rmSync(stubDir, { recursive: true, force: true });

      expect(r.status, out).toBe(0);
      expect(out).toMatch(/installed .* for real/);
      expect(out).toMatch(
        /already installed for real by worktree-node-modules/,
      );
      expect(out).not.toMatch(/Dep wiring: npm/);
    });

    // ✅ FRESH-CONSUMER-SMOKE (R6 — §8a Park-6 BINDING): the shipped create-worktree.sh
    // must work in a clean consumer repo with the full shipped script set. Three
    // observables asserted: exit 0, no missing-callee warning, node_modules symlinks
    // present in the created worktree. setupTempRepo mirrors a fresh consumer repo
    // (clean git init + shipped scripts/ + minimal packages/core + node_modules/).
    it('FRESH-CONSUMER-SMOKE: shipped create-worktree.sh in clean repo → exit 0, no missing-callee, node_modules present', () => {
      // Run create-worktree.sh as a consumer would (from the repo root).
      const r = spawnSync(
        'bash',
        [join(tmpRepo, 'scripts/create-worktree.sh'), 'smoke-fresh'],
        {
          cwd: tmpRepo,
          env: fixtureEnv(tmpRepo),
          encoding: 'utf8',
          timeout: SPAWN_GUARD_MS,
        },
      );
      const combined = (r.stdout ?? '') + (r.stderr ?? '');

      // AC-1: exit 0.
      expect(
        r.status,
        `create-worktree.sh exit code. output:\n${combined}`,
      ).toBe(0);

      // AC-2: no missing-callee warning (the three callee scripts ship together).
      expect(combined).not.toMatch(
        /missing.*callee|worktree-node-modules.*not found|link-coordination.*not found/i,
      );

      // AC-3: node_modules symlinks present in the created worktree.
      // Find the worktree path via `git worktree list`.
      const wtList = execSync(`git -C "${tmpRepo}" worktree list --porcelain`, {
        encoding: 'utf8',
      });
      const wtLines = wtList
        .split('\n')
        .filter((l) => l.startsWith('worktree '))
        .map((l) => l.replace(/^worktree\s+/, '').trim())
        .filter((p) => p && p !== tmpRepo);
      expect(
        wtLines.length,
        'a worktree was created inside the temp repo',
      ).toBeGreaterThan(0);
      const wtPath = wtLines[0]!;
      const nmPath = join(wtPath, 'node_modules');
      expect(
        existsSync(nmPath),
        `node_modules exists in worktree at ${nmPath}`,
      ).toBe(true);
    });
  },
);
