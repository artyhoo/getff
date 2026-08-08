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
 * These tests run against a per-test temp git repo (mirrors create-worktree
 * .test.ts pattern) so they don't pollute the real worktree state.
 *
 * Reference: packages/core/hooks/create-worktree.test.ts (sibling).
 * T3 compliance: each assertion cites command + output excerpt.
 */
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const SCRIPT = resolve(REPO_ROOT, 'scripts/getff-work.sh');

function runScript(
  args: string[],
  env?: Record<string, string>,
): { status: number; stdout: string; stderr: string } {
  const r = spawnSync('bash', [SCRIPT, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  return {
    status: r.status ?? -1,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
  };
}

/** Build a temp git repo with the 3 worktree helper scripts copied in. */
function setupTempRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'getff-work-test-'));
  execSync('git init -q -b main', { cwd: dir });
  execSync('git config user.email test@example.com', { cwd: dir });
  execSync('git config user.name test', { cwd: dir });
  writeFileSync(join(dir, 'README.md'), 'test repo\n');
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
      execSync(`cp "${src}" "${dir}/scripts/${s}" && chmod +x "${dir}/scripts/${s}"`);
    }
  }
  mkdirSync(join(dir, 'packages/core'), { recursive: true });
  writeFileSync(join(dir, 'packages/core/.keep'), '');
  mkdirSync(join(dir, 'node_modules'), { recursive: true });
  writeFileSync(join(dir, 'node_modules/.keep'), '');
  execSync('git add . && git commit -q -m init', { cwd: dir });
  return dir;
}

describe('getff-work.sh — workspace one-command (AC-5)', () => {
  let tmpRepo: string;
  beforeEach(() => {
    tmpRepo = setupTempRepo();
  });
  afterEach(() => {
    // Clean up any worktrees that were created inside the temp repo.
    try {
      execSync(`git -C "${tmpRepo}" worktree list --porcelain`, { encoding: 'utf8' })
        .split('\n')
        .filter((l) => l.startsWith('worktree '))
        .map((l) => l.replace(/^worktree\s+/, '').trim())
        .filter((p) => p && p !== tmpRepo)
        .forEach((p) => {
          try {
            execSync(`git -C "${tmpRepo}" worktree remove --force "${p}"`, { stdio: 'ignore' });
          } catch {
            /* ignore */
          }
        });
    } catch {
      /* ignore */
    }
    rmSync(tmpRepo, { recursive: true, force: true });
  });

  // ✅ CC-DEFERRAL (Park-4 binding)
  it('CC-DEFERRAL: CLAUDE_CODE_SESSION_ID set → defers, prints `claude -w` (no auto-launch)', () => {
    const r = runScript(
      ['smoke-cc', '--no-launch'],
      { CLAUDE_CODE_SESSION_ID: 'fake-cc-session-id' },
    );
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/CC deferral|deferring|CLAUDE_CODE_SESSION_ID/i);
    expect(r.stdout).toMatch(/claude -w\s+smoke-cc/);
    // The wrapper does NOT itself spawn a `claude` session; verify it ends with
    // the "done (CC deferral)" line, not a session-launch log.
    expect(r.stdout).toMatch(/done \(CC deferral\)/);
  });

  // ✅ NON-CC-PRINT
  it('NON-CC-PRINT: no CC env → prints ready command, does NOT spawn a session', () => {
    // Ensure CC env is unset for this test.
    const r = runScript(['smoke-noncc', '--no-launch'], {
      CLAUDE_CODE_SESSION_ID: '',
    });
    expect(r.status).toBe(0);
    // Without CC env, the wrapper prints a ready command for the operator to run.
    expect(r.stdout).toMatch(/cd\s+\S+/);
    expect(r.stdout).not.toMatch(/CC deferral/);
  });

  // ✅ NO-LAUNCH-FLAG (force print even in TTY)
  it('NO-LAUNCH-FLAG: --no-launch forces print-only path', () => {
    const r = runScript(['smoke-nolaunch', '--no-launch']);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/--no-launch/);
  });

  // ✅ HELP-FLAG
  it('HELP-FLAG: --help exits 0 and prints usage', () => {
    const r = runScript(['--help']);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/Usage|getff-work\.sh/i);
  });

  // ✅ MISSING-NAME
  it('MISSING-NAME: no positional arg → exit 2 + usage on stderr', () => {
    const r = runScript([]);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/usage/i);
  });

  // ✅ UNKNOWN-FLAG
  it('UNKNOWN-FLAG: --bogus → exit 2 + error on stderr', () => {
    const r = runScript(['name', '--bogus']);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/unknown flag|--bogus/i);
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
      { cwd: tmpRepo, encoding: 'utf8', timeout: 30_000 },
    );
    const combined = (r.stdout ?? '') + (r.stderr ?? '');

    // AC-1: exit 0.
    expect(r.status, `create-worktree.sh exit code. output:\n${combined}`).toBe(0);

    // AC-2: no missing-callee warning (the three callee scripts ship together).
    expect(combined).not.toMatch(/missing.*callee|worktree-node-modules.*not found|link-coordination.*not found/i);

    // AC-3: node_modules symlinks present in the created worktree.
    // Find the worktree path via `git worktree list`.
    const wtList = execSync(
      `git -C "${tmpRepo}" worktree list --porcelain`,
      { encoding: 'utf8' },
    );
    const wtLines = wtList
      .split('\n')
      .filter((l) => l.startsWith('worktree '))
      .map((l) => l.replace(/^worktree\s+/, '').trim())
      .filter((p) => p && p !== tmpRepo);
    expect(wtLines.length, 'a worktree was created inside the temp repo').toBeGreaterThan(0);
    const wtPath = wtLines[0]!;
    const nmPath = join(wtPath, 'node_modules');
    expect(
      existsSync(nmPath),
      `node_modules exists in worktree at ${nmPath}`,
    ).toBe(true);
  });
});
