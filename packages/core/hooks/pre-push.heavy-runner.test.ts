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
});

function existsRecord(): boolean {
  try {
    readFileSync(record);
    return true;
  } catch {
    return false;
  }
}
