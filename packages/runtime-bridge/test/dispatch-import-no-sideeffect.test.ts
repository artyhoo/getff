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
 *      main() — no args → exit 1 + "no kickoff path provided" on stderr. A path
 *      the CLI cannot READ is not a dispatch outcome the exit-0 injection contract
 *      covers; it is a caller defect (/dispatcher, /pipeline, an operator typo),
 *      and exit 0 made a wrapper checking $? record the stage as dispatched
 *      (#1597 ledger A6-2). The HOOK is unaffected: it captures stdout in a command
 *      substitution, never inspects the status, and exits 0 unconditionally.
 *
 * The same pair is asserted for src/cli/claim.ts (the two-phase claim entrypoint,
 * spec §5.3): it carries the identical isDirectCliInvocation guard, so it can regress
 * the identical way. Its exit contract deliberately DIFFERS from dispatch.ts — claim.ts
 * is skill/operator-invoked rather than a PostToolUse hook, so a bad invocation exits
 * non-zero instead of exiting 0 (see the claim.ts docblock).
 *
 * T3 compliance: assertions name the source file:line they target.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const CLI = resolve(HERE, '../src/cli/dispatch.ts');
const CLAIM_CLI = resolve(HERE, '../src/cli/claim.ts');
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
    'positive control: direct script execution still runs main() (exit 1, stderr message)',
    () => {
      const r = spawnSync(TSX, [CLI], {
        encoding: 'utf8',
        timeout: SLOW_SHELL_MS,
        env: { ...process.env, RUNTIME_BRIDGE_MODE: 'manual' },
      });

      // A6-2: no kickoff path is a CALLER defect, not a dispatch outcome → exit 1.
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('no kickoff path provided');
    },
    SLOW_SHELL_MS + 5_000,
  );

  it(
    'A6-2: an unreadable kickoff path exits NON-zero and names the path',
    () => {
      const missing = join(tmpdir(), `no-such-kickoff-${process.pid}.md`);
      const r = spawnSync(TSX, [CLI, missing], {
        encoding: 'utf8',
        timeout: SLOW_SHELL_MS,
        env: { ...process.env, RUNTIME_BRIDGE_MODE: 'manual' },
      });

      // Pre-fix: exit 0 + stderr only → a pipeline wrapper checking $? recorded the
      // stage as dispatched while nothing was dispatched.
      expect(r.status).toBe(1);
      expect(r.stderr).toContain(missing);
      expect(r.stdout).toBe('');
    },
    SLOW_SHELL_MS + 5_000,
  );
});

describe('claim.ts entrypoint guard (claim.ts isDirectCliInvocation)', () => {
  it('importing the module does NOT run main(): process.exit never called', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    const mod = await import('../src/cli/claim.js');
    await new Promise((r) => setImmediate(r));

    expect(exitSpy).not.toHaveBeenCalled();
    expect(typeof mod.parseClaimArgs).toBe('function');
    expect(typeof mod.requireClaimBackend).toBe('function');
    expect(typeof mod.handleFromTaskId).toBe('function');
  });

  it(
    'positive control: direct execution runs main() and exits NON-zero on a bad verb',
    () => {
      const r = spawnSync(TSX, [CLAIM_CLI], {
        encoding: 'utf8',
        timeout: SLOW_SHELL_MS,
        env: { ...process.env, RUNTIME_BRIDGE_MODE: 'manual' },
      });

      // claim.ts is NOT a hook entrypoint: a claim that silently failed is worse
      // than no claim, so the exit-0-always contract does not apply here.
      expect(r.status).toBe(2);
      expect(r.stderr).toContain('expected create|release|cancel');
    },
    SLOW_SHELL_MS + 5_000,
  );

  it(
    'refuses to claim on a backend with no queue rather than falling back to manual',
    () => {
      const r = spawnSync(TSX, [CLAIM_CLI, 'cancel', 'task-x'], {
        encoding: 'utf8',
        timeout: SLOW_SHELL_MS,
        env: { ...process.env, RUNTIME_BRIDGE_MODE: 'manual' },
      });
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('cannot hold a claim');
    },
    SLOW_SHELL_MS + 5_000,
  );
});
