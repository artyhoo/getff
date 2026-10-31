import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The real CLI tests exercise native delivery and fallback against narrow enrollment
// fixtures. Including them here keeps the project-local adapter in the normal suite.
describe('advisor role reminder delivery boundary', () => {
  it('preserves bytes and rejects unbound authority across context lifecycles', (ctx) => {
    // win32: the fixture's own test module imports `fcntl` — a POSIX-only Python stdlib
    // module (record locking) absent from Windows Python — so the whole unittest payload
    // dies at import (`ModuleNotFoundError: No module named 'fcntl'`, run 38988360013)
    // before any assertion runs. No Windows analog exists to shim. POSIX arm unchanged.
    if (process.platform === 'win32') {
      ctx.skip(
        'skipped on win32: fixture imports fcntl (POSIX-only Python stdlib; ModuleNotFoundError on Windows) — #1799',
      );
    }
    const root = fileURLToPath(new URL('../../../', import.meta.url));
    const run = spawnSync(
      'python3',
      ['-B', '-m', 'unittest', 'discover', '-s', 'tests/advisor-role-reminders', '-v'],
      { cwd: root, encoding: 'utf8', stdio: 'pipe' },
    );
    expect(run.status, run.stderr).toBe(0);
  });
});
