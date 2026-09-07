// packages/runtime-bridge/test/cli-symlink-entry.test.ts
/**
 * A6-1 (#1597 ledger): four CLIs gated main() on a naive
 * `fileURLToPath(import.meta.url) === process.argv[1]` compare. Invoked through ANY
 * symlinked path — a `bin/` shim, `node_modules/.bin`, an absolute path under macOS
 * /tmp → /private/tmp — the compare is false, so the CLI exited 0 having done nothing,
 * printing nothing. Silent no-op, not an error.
 *
 * Each case below runs the real CLI through a real symlink with an invocation that
 * needs NO network (a missing required flag / an unknown flag) and asserts the CLI
 * actually ran: exit 1 + its own diagnostic. Pre-fix all four are RED (exit 0, empty
 * stderr). The shared guard is src/cli/cliEntry.ts `isMain`.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const TSX = resolve(REPO_ROOT, 'node_modules/.bin/tsx');

// Shell spawn of tsx cold-compiles the CLI; slow shells need headroom
// (SLOW_SHELL_MS precedent, PR #848).
const SLOW_SHELL_MS = 30_000;

const linkDir = mkdtempSync(join(tmpdir(), 'rb-cli-symlink-'));
afterAll(() => rmSync(linkDir, { recursive: true, force: true }));

/** Symlink <linkDir>/<name> → src/cli/<name>.ts and run it, exactly as a bin shim would. */
function runViaSymlink(name: string, args: string[]) {
  const link = join(linkDir, name);
  symlinkSync(resolve(HERE, `../src/cli/${name}.ts`), link);
  return spawnSync(TSX, [link, ...args], {
    encoding: 'utf8',
    timeout: SLOW_SHELL_MS,
    env: {
      ...process.env,
      RUNTIME_BRIDGE_MODE: 'manual',
      // Scrub the ambient config so the CLIs hit their arg-validation path, never the network.
      HANDOFF_TASK_ID: '',
      RUNTIME_BRIDGE_AIF_PROJECT_ID: '',
    },
  });
}

describe('CLIs invoked through a symlink still run (A6-1)', () => {
  it(
    'park.ts: missing --task is reported, not silently skipped',
    () => {
      const r = runViaSymlink('park', []);
      expect(r.stderr).toContain('missing required --task');
      expect(r.status).toBe(1);
    },
    SLOW_SHELL_MS + 5_000,
  );

  it(
    'answer.ts: missing --task is reported, not silently skipped',
    () => {
      const r = runViaSymlink('answer', []);
      expect(r.stderr).toContain('missing required --task');
      expect(r.status).toBe(1);
    },
    SLOW_SHELL_MS + 5_000,
  );

  it(
    'questions.ts: a bad flag is reported, not silently skipped',
    () => {
      const r = runViaSymlink('questions', ['--bogus-flag']);
      expect(r.stderr).toMatch(/unknown option/i);
      expect(r.status).toBe(1);
    },
    SLOW_SHELL_MS + 5_000,
  );

  it(
    'ensure-parallel.ts: missing --project is reported, not silently skipped',
    () => {
      const r = runViaSymlink('ensure-parallel', []);
      expect(r.stderr).toContain('missing --project');
      expect(r.status).toBe(1);
    },
    SLOW_SHELL_MS + 5_000,
  );
});
