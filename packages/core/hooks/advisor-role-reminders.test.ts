import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The real CLI tests exercise native delivery and fallback against narrow enrollment
// fixtures. Including them here keeps the project-local adapter in the normal suite.
describe('advisor role reminder delivery boundary', () => {
  it('preserves bytes and rejects unbound authority across context lifecycles', () => {
    const root = fileURLToPath(new URL('../../../', import.meta.url));
    const run = spawnSync(
      'python3',
      ['-B', '-m', 'unittest', 'discover', '-s', 'tests/advisor-role-reminders', '-v'],
      { cwd: root, encoding: 'utf8', stdio: 'pipe' },
    );
    expect(run.status, run.stderr).toBe(0);
  });
});
