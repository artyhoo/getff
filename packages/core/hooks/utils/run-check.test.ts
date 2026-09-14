/**
 * Paired-negative + behaviour tests for runCheck().
 *
 * Mocks the `child_process` boundary à la Aider's `@patch("subprocess.Popen")`
 * (test_linter.py) — no real shell-outs. Covers the cases Aider's test covers
 * (non-zero exit, stderr capture) PLUS the timeout case Aider omits, which is
 * the gap this port deliberately exceeds (research patch §4.8.X.1).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const spawnSyncMock = vi.fn();
vi.mock('node:child_process', () => ({
  spawnSync: (...args: unknown[]) => spawnSyncMock(...args),
}));

const existsSyncMock = vi.fn(() => true);
vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => existsSyncMock(...(args as [])),
}));

const {
  runCheck,
  resolveNodeToolShim,
  DEFAULT_TIMEOUT_MS,
  TIMEOUT_EXIT_CODE,
  SPAWN_FAILURE_EXIT_CODE,
} = await import('./run-check.ts');

type SpawnReturn = {
  status: number | null;
  signal: NodeJS.Signals | null;
  stdout: string | null;
  stderr: string | null;
  error?: NodeJS.ErrnoException;
};
const ret = (o: Partial<SpawnReturn>): SpawnReturn => ({
  status: 0,
  signal: null,
  stdout: '',
  stderr: '',
  error: undefined,
  ...o,
});

describe('runCheck', () => {
  beforeEach(() => spawnSyncMock.mockReset());

  it('returns exit 0 + stdout on success', () => {
    spawnSyncMock.mockReturnValue(ret({ status: 0, stdout: 'ok\n' }));
    const r = runCheck('echo', ['hi']);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toBe('ok\n');
    expect(r.timedOut).toBe(false);
    expect(r.notFound).toBe(false);
  });

  it('propagates a non-zero exit code and stderr (Aider non-zero case)', () => {
    spawnSyncMock.mockReturnValue(ret({ status: 2, stderr: 'boom\n' }));
    const r = runCheck('actionlint', []);
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toBe('boom\n');
    expect(r.timedOut).toBe(false);
  });

  it('maps an ETIMEDOUT timeout to exit 124 + timedOut (case Aider omits)', () => {
    const error = Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' });
    spawnSyncMock.mockReturnValue(
      ret({ status: null, signal: 'SIGTERM', stdout: 'partial', error }),
    );
    const r = runCheck('lychee', ['--offline'], { timeoutMs: 5 });
    expect(r.timedOut).toBe(true);
    expect(r.exitCode).toBe(TIMEOUT_EXIT_CODE);
  });

  it('detects a timeout from ETIMEDOUT alone (no SIGTERM signal)', () => {
    // Isolates the errCode branch from the signal fallback.
    const error = Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' });
    spawnSyncMock.mockReturnValue(ret({ status: null, signal: null, error }));
    const r = runCheck('slow', []);
    expect(r.timedOut).toBe(true);
    expect(r.exitCode).toBe(TIMEOUT_EXIT_CODE);
  });

  it('treats a bare SIGTERM (no error object) as a timeout too', () => {
    spawnSyncMock.mockReturnValue(ret({ status: null, signal: 'SIGTERM' }));
    const r = runCheck('hang', []);
    expect(r.timedOut).toBe(true);
    expect(r.exitCode).toBe(TIMEOUT_EXIT_CODE);
  });

  it('flags notFound + exit 127 when the binary is missing (ENOENT)', () => {
    const error = Object.assign(new Error('spawn missing ENOENT'), {
      code: 'ENOENT',
    });
    spawnSyncMock.mockReturnValue(ret({ status: null, error }));
    const r = runCheck('missing-tool', []);
    expect(r.notFound).toBe(true);
    expect(r.timedOut).toBe(false);
    expect(r.exitCode).toBe(SPAWN_FAILURE_EXIT_CODE);
    expect(r.stderr).toContain('ENOENT');
  });

  it('maps a non-ENOENT spawn error (e.g. EACCES) to exit 127 without notFound', () => {
    const error = Object.assign(new Error('permission denied'), {
      code: 'EACCES',
    });
    spawnSyncMock.mockReturnValue(ret({ status: null, error }));
    const r = runCheck('blocked', []);
    expect(r.notFound).toBe(false);
    expect(r.exitCode).toBe(SPAWN_FAILURE_EXIT_CODE);
  });

  it('preserves real stderr on a spawn error instead of overwriting with the message', () => {
    // Guards the `stderr.length === 0` condition: a non-empty stderr wins.
    const error = Object.assign(new Error('boom message'), { code: 'EACCES' });
    spawnSyncMock.mockReturnValue(
      ret({ status: null, stderr: 'actual stderr\n', error }),
    );
    const r = runCheck('blocked', []);
    expect(r.stderr).toBe('actual stderr\n');
    expect(r.stderr).not.toContain('boom message');
  });

  it('coerces a null status (signal exit, no error) to exit 1', () => {
    spawnSyncMock.mockReturnValue(ret({ status: null, signal: 'SIGINT' }));
    const r = runCheck('interrupted', []);
    expect(r.exitCode).toBe(1);
    expect(r.timedOut).toBe(false);
  });

  it('passes cwd / args / timeout / env through to spawnSync', () => {
    spawnSyncMock.mockReturnValue(ret({}));
    const env = { FOO: 'bar' } as NodeJS.ProcessEnv;
    runCheck('git', ['status'], { cwd: '/tmp/x', timeoutMs: 9999, env });
    const [cmd, args, options] = spawnSyncMock.mock.calls[0];
    expect(cmd).toBe('git');
    expect(args).toEqual(['status']);
    expect(options.cwd).toBe('/tmp/x');
    expect(options.timeout).toBe(9999);
    expect(options.env).toBe(env);
    expect(options.encoding).toBe('utf8');
  });

  // Guards the ArithmeticOperator mutants on maxBuffer (32 * 1024 * 1024).
  // Mutations produce 32 (32 * 1024 / 1024) or 32 (32 / 1024 * 1024 ≈ 32).
  // Both are far below the intended 32 MB; asserting > 1 MB kills both survivors.
  it('passes a maxBuffer of at least 1 MB to spawnSync (guards 32*1024*1024 arithmetic)', () => {
    spawnSyncMock.mockReturnValue(ret({}));
    runCheck('git', ['status']);
    const options = spawnSyncMock.mock.calls[0][2];
    expect(options.maxBuffer).toBe(32 * 1024 * 1024); // exact: 33_554_432
  });

  it('defaults the timeout to DEFAULT_TIMEOUT_MS', () => {
    spawnSyncMock.mockReturnValue(ret({}));
    runCheck('git', ['status']);
    expect(spawnSyncMock.mock.calls[0][2].timeout).toBe(DEFAULT_TIMEOUT_MS);
  });

  it('defaults args to an empty array', () => {
    spawnSyncMock.mockReturnValue(ret({}));
    runCheck('actionlint');
    expect(spawnSyncMock.mock.calls[0][1]).toEqual([]);
  });
});

/**
 * Paired positive+negative for the Windows npm/npx rewrite. Platform, execPath
 * and the on-disk probe are injected, so every case runs identically on a Linux
 * CI runner and on a Windows developer machine — the branch is never skipped for
 * being "the other platform".
 */
describe('resolveNodeToolShim (Windows npm/npx rewrite)', () => {
  const WIN_NODE = 'C:\\Program Files\\nodejs\\node.exe';
  const yes = () => true;
  const no = () => false;

  it('POSITIVE: rewrites npm on win32 to node + npm-cli.js when the CLI is on disk', () => {
    const r = resolveNodeToolShim('npm', ['ci'], 'win32', WIN_NODE, yes);
    expect(r.cmd).toBe(WIN_NODE);
    // Exact, not a loose regex: with a POSIX `dirname` the win32 branch yields
    // `node_modules/npm/bin/npm-cli.js`, which a [\\/] alternation still matches.
    // The drive prefix is what proves the win32 path flavour was the one used.
    expect(r.args[0]).toBe(
      'C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js',
    );
    expect(r.args.slice(1)).toEqual(['ci']);
  });

  it('POSITIVE: rewrites npx on win32 to the npx-cli.js sibling, not npm-cli.js', () => {
    const r = resolveNodeToolShim(
      'npx',
      ['tsx', '--version'],
      'win32',
      WIN_NODE,
      yes,
    );
    expect(r.args[0]).toMatch(/npx-cli\.js$/);
    expect(r.args.slice(1)).toEqual(['tsx', '--version']);
  });

  it('keeps arguments as discrete argv entries — no shell, nothing to escape', () => {
    // The reason this is not `shell: true`: runCheck is the single funnel for
    // utils/git.ts, which passes branch names and commit messages through it.
    const nasty = 'a branch & echo pwned';
    const r = resolveNodeToolShim(
      'npm',
      ['run', nasty],
      'win32',
      WIN_NODE,
      yes,
    );
    expect(r.args).toHaveLength(3);
    expect(r.args[2]).toBe(nasty);
  });

  it('NEGATIVE: leaves npm untouched on win32 when the CLI is absent (nvm/volta layout)', () => {
    const r = resolveNodeToolShim('npm', ['ci'], 'win32', WIN_NODE, no);
    expect(r.cmd).toBe('npm');
    expect(r.args).toEqual(['ci']);
  });

  it('NEGATIVE: leaves npm untouched off win32 — the shim problem is Windows-only', () => {
    const r = resolveNodeToolShim('npm', ['ci'], 'linux', '/usr/bin/node', yes);
    expect(r.cmd).toBe('npm');
    expect(r.args).toEqual(['ci']);
  });

  it('NEGATIVE: leaves a real .exe (git) untouched on win32 — only npm/npx are shims', () => {
    const r = resolveNodeToolShim('git', ['status'], 'win32', WIN_NODE, yes);
    expect(r.cmd).toBe('git');
    expect(r.args).toEqual(['status']);
  });

  it('is wired into runCheck, not merely exported', () => {
    const platform = process.platform;
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      configurable: true,
    });
    try {
      existsSyncMock.mockReturnValue(true);
      spawnSyncMock.mockReset();
      spawnSyncMock.mockReturnValue(ret({}));
      runCheck('npx', ['--version']);
      const [cmd, args] = spawnSyncMock.mock.calls[0];
      expect(cmd).toBe(process.execPath);
      expect((args as string[])[0]).toMatch(/npx-cli\.js$/);
    } finally {
      Object.defineProperty(process, 'platform', {
        value: platform,
        configurable: true,
      });
    }
  });
});
