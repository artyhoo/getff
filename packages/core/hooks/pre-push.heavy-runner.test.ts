/**
 * PREPUSH_HEAVY_RUNNER — the opt-in wrapper for the four vitest suite sections
 * (principles-meta, ir-meta, backends-meta, composition-meta).
 *
 * Why it exists: on a Mac loaded by other sessions (load average 40-158), principle
 * 31's glob-parity test timed out at 5000 ms on 4 consecutive pushes while taking
 * 1.8 s alone. The operator's machine runs heavy commands on another host through a
 * runner (`pc-run <cmd> [args...]`: mirrors the cwd's repo, runs there, returns the
 * real exit code). A git hook spawns npm from node, so it never passed through that
 * runner. The env var hands the suites to it.
 *
 * The contract pinned here, end to end through the real hook:
 *   - unset → the suite runs exactly as before (`npm --prefix <core> run <script>`),
 *     so consumers and CI are untouched;
 *   - set → `<runner> npm run <script>` with cwd = packages/core and NO absolute path
 *     in argv (a runner that re-roots the cwd onto a mirror cannot translate one);
 *   - the runner's exit code is the gate: non-zero blocks the push;
 *   - a runner that does not exist fails loudly and names the variable.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  chmodSync,
  rmSync,
  realpathSync,
  existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = resolve(HERE, 'pre-push.ts');
// The hook passes CORE as it resolves it (no realpath); `pwd -P` reports the real path.
const CORE = resolve(HERE, '..');
const CORE_REAL = realpathSync(CORE);

// Every case here spawns the pre-push hook (`node --import tsx/esm pre-push.ts`, own
// spawnSync cap 60_000), so multi-second runtimes under load are inherent and the vitest 5s
// default is a mis-set gate rather than a signal. A full Mac run of `npm --prefix
// packages/core run test:hooks` (M2 Max, load 3.8 -> 6.9, 260 s, measured 2026-10-01) timed
// out 2 cases here at 5000ms (principles-meta and «empty value = unset»), while the same
// suite passed 87/87 files on Linux, and a different case fails on each run.
// 30_000 is the SLOW_SHELL_MS convention of the sibling shell-spawning suites
// (end-of-turn-reminder, dup-detect-empty-arg, priority-score-branch-matcher).
const SLOW_SHELL_MS = 30_000;

let dir = '';
let runner = '';
let record = '';

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'heavy-runner-'));
  runner = join(dir, 'runner.sh');
  record = join(dir, 'record.txt');
  // Records cwd + argv, exits with FAKE_RC. Never runs the suite itself.
  writeFileSync(
    runner,
    '#!/bin/sh\n' +
      `{ pwd -P; for a in "$@"; do printf '%s\\n' "$a"; done; } > '${record}'\n` +
      'exit "${FAKE_RC:-0}"\n',
  );
  chmodSync(runner, 0o755);
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

function hook(section: string, env: Record<string, string>) {
  rmSync(record, { force: true });
  return spawnSync(process.execPath, ['--import', 'tsx/esm', HOOK], {
    cwd: CORE,
    input: '',
    encoding: 'utf8',
    env: { ...process.env, PREPUSH_ONLY: section, ...env },
    timeout: 60_000,
  });
}

describe('PREPUSH_HEAVY_RUNNER', { timeout: SLOW_SHELL_MS }, () => {
  const cases: Array<[string, string]> = [
    ['principles-meta', 'test:principles'],
    ['ir-meta', 'test:ir'],
    ['backends-meta', 'test:backends'],
    ['composition-meta', 'test:composition'],
  ];

  for (const [section, script] of cases) {
    it(`${section}: hands \`npm run ${script}\` to the runner from packages/core`, () => {
      const r = hook(section, { PREPUSH_HEAVY_RUNNER: runner, FAKE_RC: '0' });
      expect(r.status, r.stderr).toBe(0);
      const [cwd, ...argv] = readFileSync(record, 'utf8').trim().split('\n');
      expect(cwd).toBe(CORE_REAL);
      expect(argv).toEqual(['npm', 'run', script]);
      expect(argv.some((a) => a.startsWith('/'))).toBe(false);
    });
  }

  it("the runner's non-zero exit blocks the push", () => {
    const r = hook('ir-meta', { PREPUSH_HEAVY_RUNNER: runner, FAKE_RC: '3' });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/IR grammar-gate tests failed/);
  });

  it('a runner that does not exist fails loudly and names the variable', () => {
    const r = hook('ir-meta', {
      PREPUSH_HEAVY_RUNNER: join(dir, 'no-such-runner'),
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/PREPUSH_HEAVY_RUNNER/);
    expect(existsRecord()).toBe(false);
  });

  it('a runner that is not executable fails loudly and names the variable', () => {
    const plain = join(dir, 'not-executable.sh');
    writeFileSync(plain, '#!/bin/sh\nexit 0\n');
    chmodSync(plain, 0o644);
    const r = hook('ir-meta', { PREPUSH_HEAVY_RUNNER: plain });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/PREPUSH_HEAVY_RUNNER='.*not-executable\.sh' could not be started/);
    expect(r.stderr).not.toMatch(/IR grammar-gate tests failed/);
  });

  it('empty value = unset: the suite does not go through the runner', () => {
    // Fake npm first on PATH proves which path ran without running a real suite.
    const bin = join(dir, 'bin');
    spawnSync('mkdir', ['-p', bin]);
    const npmRecord = join(dir, 'npm-record.txt');
    writeFileSync(
      join(bin, 'npm'),
      `#!/bin/sh\nprintf '%s\\n' "$@" > '${npmRecord}'\nexit 0\n`,
    );
    chmodSync(join(bin, 'npm'), 0o755);
    const r = hook('ir-meta', {
      PREPUSH_HEAVY_RUNNER: '',
      PATH: `${bin}:${process.env['PATH'] ?? ''}`,
    });
    expect(r.status, r.stderr).toBe(0);
    expect(existsRecord()).toBe(false);
    expect(readFileSync(npmRecord, 'utf8').trim().split('\n')).toEqual([
      '--prefix',
      CORE,
      'run',
      'test:ir',
    ]);
  });

  // ── The runner boundary scrubs git's hook-env (D2081-S01, PR #2081) ──────────
  //
  // The empty-value arm above and the four argv arms spawn the runner through
  // `run()`-equivalent scrubbing only by accident of what they assert. The dispatch
  // the runner rides (runCoreSuite's PREPUSH_HEAVY_RUNNER arm) is a DIRECT
  // `runCheck()` call — until it handed the runner the invoking hook's raw
  // environment, a pre-push from a linked worktree exported an absolute GIT_DIR
  // pointing at that worktree, and the runner's fixture git children re-targeted
  // THERE: the same `core.bare=true` poison the fixture-side scrub (PR #2081,
  // fc41e0b986b + c05dbc0a1f2) fixed for every OTHER child. githooks(5) prescribes
  // `unset $(git rev-parse --local-env-vars)` before touching a foreign repository;
  // the runner boundary must hand the runner that same scrubbed env — while KEEPING
  // the object-directory family (GIT_OBJECT_DIRECTORY et al.) the heavy-runner
  // contract exports deliberately, because arms reading the pushed (quarantined)
  // objects need them (pre-push.ts HOOK_LEAKED_DISCOVERY_VARS comment).
  //
  // Both arms below go through the REAL hook (`node --import tsx pre-push.ts`,
  // PREPUSH_ONLY=ir-meta) with a planted invoking-worktree environment and a SECOND
  // scratch repository standing in for the checkout the runner must not touch — the
  // exact damage shape measured on #2081: a fixture `git init <path>` under an
  // inherited GIT_DIR exits 0, creates nothing at <path>, and re-initialises the
  // GIT_DIR repository, writing `bare = true` into its config.

  /**
   * The discovery-set variables a linked-worktree pre-push exports into the hook.
   *
   * `second` is the COMMON dir of the standing-in repository; the GIT_DIR target is
   * its LINKED-WORKTREE admin directory — exactly what git exports to a hook fired
   * from a linked worktree (principle 46's header: GIT_DIR=<common>/.git/worktrees/<name>,
   * and NO GIT_WORK_TREE). Replication measured 2026-10-09 (git 2.53.0, throwaway
   * fixture): with that GIT_DIR, a child `git init <path>` exits 0, creates nothing
   * at <path>, and writes `bare = true` into the COMMON config.
   */
  const PLANTED_INVOKER_ENV = (second: string): Record<string, string> => ({
    GIT_DIR: join(second, '.git', 'worktrees', 'linked'),
    GIT_COMMON_DIR: join(second, '.git'),
    GIT_INDEX_FILE: join(second, '.git', 'worktrees', 'linked', 'index'),
    GIT_PREFIX: '',
  });

  /**
   * Build the standing-in "invoking checkout": a repository with one commit and a
   * linked worktree, so `.git/worktrees/linked/` exists for GIT_DIR to name.
   */
  function makeInvokerRepo(second: string): void {
    spawnSync('git', ['init', '-q', second]);
    spawnSync('git', [
      '-C',
      second,
      '-c',
      'user.email=fixture@test',
      '-c',
      'user.name=fixture',
      'commit',
      '-q',
      '--allow-empty',
      '-m',
      'seed',
    ]);
    spawnSync('git', ['-C', second, 'worktree', 'add', '-q', join(second, '..', 'invoker-wt')]);
  }

  /** `core.bare` as git parses the config file, or '(absent)' when the key is not there. */
  function coreBare(configFile: string): string {
    const r = spawnSync(
      'git',
      ['config', '--file', configFile, '--type=bool', '--get', 'core.bare'],
      { encoding: 'utf8' },
    );
    return r.status === 0 ? r.stdout.trim() : '(absent)';
  }

  it('scrubs the hook-env off the runner: a planted GIT_DIR cannot retarget its git', () => {
    // The "invoking checkout" — a second repository whose COMMON config `git init`
    // has just written with `bare = false`, so any `bare = true` afterwards is a
    // WRITE by the defect mechanism, distinguishable from a config that never
    // mentioned the key.
    const second = join(dir, 'invoker-repo');
    makeInvokerRepo(second);
    expect(coreBare(join(second, '.git', 'config'))).toBe('false');

    const probe = join(dir, 'probe-init');
    const capture = join(dir, 'probe-runner-env.txt');
    const probeRunner = join(dir, 'probe-runner.sh');
    // Records its full environment, then does the exact thing a suite's fixture
    // git does — `git init <path>` — and exits 0 so the hook section passes.
    writeFileSync(
      probeRunner,
      '#!/bin/sh\n' +
        `env > '${capture}'\n` +
        `git init '${probe}' >/dev/null 2>&1\n` +
        'exit 0\n',
    );
    chmodSync(probeRunner, 0o755);

    const r = hook('ir-meta', {
      PREPUSH_HEAVY_RUNNER: probeRunner,
      ...PLANTED_INVOKER_ENV(second),
    });
    expect(r.status, r.stderr).toBe(0);

    // The init landed at its argument — the runner's git resolved its own repo,
    // not the planted GIT_DIR (pre-fix nothing is created at the path at all).
    expect(existsSync(join(probe, '.git', 'HEAD')), 'probe init landed').toBe(
      true,
    );
    // …and no `bare` write landed in the second repository's SHARED config —
    // the `core.bare=true` poison that took the main checkout down on #2081.
    expect(coreBare(join(second, '.git', 'config'))).toBe('false');

    // The recorded environment carries none of the discovery set.
    const keys = new Set(
      readFileSync(capture, 'utf8')
        .split('\n')
        .filter((l) => l.includes('='))
        .map((l) => l.slice(0, l.indexOf('='))),
    );
    for (const key of Object.keys(PLANTED_INVOKER_ENV(second))) {
      expect(keys.has(key), `${key} scrubbed off the runner env`).toBe(false);
    }
  });

  it('keeps the object-directory vars the runner contract relies on', () => {
    // GIT_OBJECT_DIRECTORY / GIT_ALTERNATE_OBJECT_DIRECTORIES /
    // GIT_QUARANTINE_PATH stay exported BY DESIGN (arms reading the pushed
    // quarantined objects need them) — the scrub is deliberately narrow, so the
    // runner must still SEE a planted object-directory var even as GIT_DIR dies.
    const second = join(dir, 'invoker-repo-obj');
    makeInvokerRepo(second);
    const capture = join(dir, 'obj-runner-env.txt');
    const objRunner = join(dir, 'obj-runner.sh');
    writeFileSync(objRunner, `#!/bin/sh\nenv > '${capture}'\nexit 0\n`);
    chmodSync(objRunner, 0o755);

    const r = hook('ir-meta', {
      PREPUSH_HEAVY_RUNNER: objRunner,
      ...PLANTED_INVOKER_ENV(second),
      GIT_OBJECT_DIRECTORY: join(second, '.git', 'objects'),
      GIT_ALTERNATE_OBJECT_DIRECTORIES: join(second, '.git', 'objects', 'alt'),
    });
    expect(r.status, r.stderr).toBe(0);

    const keys = new Set(
      readFileSync(capture, 'utf8')
        .split('\n')
        .filter((l) => l.includes('='))
        .map((l) => l.slice(0, l.indexOf('='))),
    );
    expect(keys.has('GIT_OBJECT_DIRECTORY')).toBe(true);
    expect(keys.has('GIT_ALTERNATE_OBJECT_DIRECTORIES')).toBe(true);
    expect(keys.has('GIT_DIR')).toBe(false);
  });
});

function existsRecord(): boolean {
  try {
    readFileSync(record);
    return true;
  } catch {
    return false;
  }
}
