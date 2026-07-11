/**
 * Paired tests for the dispatch.ts entrypoint guard (isDirectCliInvocation).
 *
 * Contract under test:
 *   1. Importing src/cli/dispatch.js for its named exports is side-effect-free:
 *      main() must NOT run, process.exit must NOT be called. Pre-guard this was
 *      RED — the top-level main().catch() ran on import, hit process.exit(0)
 *      (dispatch.ts:96), and vitest surfaced it as 2 unhandled rejections,
 *      failing `npm run test` locally with 174/174 tests green.
 *   2. Positive control: executing dispatch.ts directly as a script still runs
 *      main() — no args → exit 0 + "no kickoff path provided" on stderr
 *      (the non-blocking injection contract, exit 0 always).
 *
 * T3 compliance: assertions name the source file:line they target.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const CLI = resolve(HERE, '../src/cli/dispatch.ts');
const TSX = resolve(REPO_ROOT, 'node_modules/.bin/tsx');

// Shell spawn of tsx cold-compiles the CLI; slow shells need headroom
// (SLOW_SHELL_MS precedent, PR #848).
const SLOW_SHELL_MS = 30_000;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('dispatch.ts entrypoint guard (dispatch.ts isDirectCliInvocation)', () => {
  it('importing the module does NOT run main(): process.exit never called', async () => {
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never);

    const mod = await import('../src/cli/dispatch.js');
    // Flush microtasks + one macrotask: pre-guard, main() reached its
    // process.exit(0) branch (dispatch.ts:96) within the first tick.
    await new Promise((r) => setImmediate(r));

    expect(exitSpy).not.toHaveBeenCalled();
    // Named exports stay importable — the guard must not hide them.
    expect(typeof mod.runPreflight).toBe('function');
    expect(typeof mod.resolveKickoffPath).toBe('function');
    expect(typeof mod.dispatchUsesForce).toBe('function');
  });

  it(
    'positive control: direct script execution still runs main() (exit 0, stderr message)',
    () => {
      const r = spawnSync(TSX, [CLI], {
        encoding: 'utf8',
        timeout: SLOW_SHELL_MS,
        env: { ...process.env, RUNTIME_BRIDGE_MODE: 'manual' },
      });

      // dispatch.ts:94-97 — no kickoff path → stderr note, exit 0 (never blocks).
      expect(r.status).toBe(0);
      expect(r.stderr).toContain('no kickoff path provided');
    },
    SLOW_SHELL_MS + 5_000,
  );
});
