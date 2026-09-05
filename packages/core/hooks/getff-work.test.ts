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
 * Two distinct fixtures, deliberately:
 *   - FRESH-CONSUMER-SMOKE runs against a per-test temp git repo (mirrors
 *     create-worktree.test.ts) — it is about the SHIPPED script set in a clean
 *     consumer repo.
 *   - The three worktree-creating cases run against the REAL repo, because the
 *     wrapper's value is precisely that it works in this repo's layout. That
 *     means they mutate real worktree state, so they MUST use per-run-unique
 *     names and MUST clean up after themselves — see uniqueName() below.
 *     (Header used to claim all tests were temp-repo isolated. That was false:
 *     runScript spawns the REAL scripts/getff-work.sh, and create-worktree.sh
 *     derives its target from `git rev-parse --show-toplevel` of the cwd
 *     (scripts/create-worktree.sh:33,60-61). Fixed 2026-08-12 — see the
 *     self-poisoning note on uniqueName().)
 *
 * Reference: packages/core/hooks/create-worktree.test.ts (sibling).
 * T3 compliance: each assertion cites command + output excerpt.
 */
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { execSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const SCRIPT = resolve(REPO_ROOT, 'scripts/getff-work.sh');

// Every test here spawns a real `bash scripts/getff-work.sh` (or its callee
// create-worktree.sh), which does real work: `git worktree add`, node_modules
// wiring, then a package-manager install inside the freshly created worktree.
// Multi-second runtimes are inherent, not a regression — the 5s vitest default is
// a mis-set gate, not a signal (it produced 4 red / 3 green on a clean staging
// tree, and one marginal CI red that went green on re-run, blocking an unrelated
// comment-only PR).
//
// Sizing evidence (macOS, clean tree, 2026-08-10). Timing the wrapper directly on
// a cold worktree:
//   `time bash scripts/getff-work.sh timing-probe --no-launch` → 30.8s total,
//   of which the dominant leg is the step-2 `npm ci` inside the new worktree.
// The three worktree-creating cases each measured 31.4s / 33.2s / 31.4s under
// vitest; the temp-repo case (FRESH-CONSUMER-SMOKE, no root lockfile → no install
// leg) measured 9.6s. So 30_000 — the value the sibling suites use — is itself too
// tight here; 60_000 is ~2× the measured cold cost and has repo precedent
// (principles/20-bundle-classification.paired-negative.test.ts uses 60_000; the
// root vitest.config.ts testTimeout is 60_000 with a documented 120_000 ceiling).
// Sibling shell-spawning suites that DON'T pay an npm-install leg stay at 30_000
// (priority-score-synthetic, priority-score-skip-closed, done-md-completion-filter,
// pre-push.consumer-layout).
const SLOW_SHELL_MS = 60_000;

// FRESH-CONSUMER-SMOKE carries its OWN spawnSync guard so a hung create-worktree.sh
// fails with the captured-output assertion message rather than a bare vitest
// timeout. That only works while SLOW_SHELL_MS outlives this guard — keep the
// inequality if either number is ever retuned.
const SPAWN_GUARD_MS = 30_000;

function runScript(
  args: string[],
  env?: Record<string, string>,
): { status: number; stdout: string; stderr: string } {
  const r = spawnSync('bash', [SCRIPT, ...args], {
    encoding: 'utf8',
    // Pin the cwd: create-worktree.sh resolves its target repo via
    // `git rev-parse --show-toplevel` (scripts/create-worktree.sh:33), so an
    // inherited cwd would put the debris somewhere cleanupRealWorktrees()
    // cannot predict.
    cwd: REPO_ROOT,
    env: { ...process.env, ...env },
  });
  return {
    status: r.status ?? -1,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
  };
}

// Worktree names claimed by the current test, drained by cleanupRealWorktrees().
const claimedNames: string[] = [];

/**
 * Per-run-unique worktree name — the fix for a self-poisoning test suite.
 *
 * Incident 2026-08-12: these cases used the fixed names smoke-cc / smoke-noncc /
 * smoke-nolaunch. create-worktree.sh claims branch `worktree-<name>`
 * (create-worktree.sh:61), and branch names are repo-global — shared by every
 * worktree of this repo. So a GREEN run left three worktrees + three branches
 * behind, and the NEXT run anywhere in the repo hit `git worktree add` failing
 * on the taken branch → create-worktree.sh exit 1 → the wrapper exit 1 → three
 * red tests. Observed: the three branches were still held by a months-old
 * session's nested worktrees, and re-running the suite reproduced the debris
 * exactly. Unique names make the collision impossible by construction; the
 * cleanup below keeps the repo from accumulating them.
 */
function uniqueName(stem: string): string {
  const name = `${stem}-${process.pid.toString(36)}${randomBytes(3).toString('hex')}`;
  claimedNames.push(name);
  return name;
}

/** Remove worktrees + branches this test claimed in the REAL repo. */
function cleanupRealWorktrees(): void {
  for (const name of claimedNames.splice(0)) {
    const branch = `worktree-${name}`;
    // Ask git where the worktree landed rather than re-deriving
    // create-worktree.sh's path formula — the formula is the thing under test.
    try {
      execSync(`git -C "${REPO_ROOT}" worktree list --porcelain`, { encoding: 'utf8' })
        .split('\n\n')
        .filter((block) => block.includes(`branch refs/heads/${branch}`))
        .map((block) =>
          block
            .split('\n')
            .find((l) => l.startsWith('worktree '))
            ?.replace(/^worktree\s+/, '')
            .trim(),
        )
        .forEach((p) => {
          if (!p) return;
          try {
            execSync(`git -C "${REPO_ROOT}" worktree remove --force "${p}"`, { stdio: 'ignore' });
          } catch {
            /* ignore */
          }
        });
    } catch {
      /* ignore */
    }
    // -D (not -d): the branch is throwaway test debris that never receives a
    // commit, but it can read as "unmerged" whenever origin/HEAD has moved on.
    try {
      execSync(`git -C "${REPO_ROOT}" branch -D "${branch}"`, { stdio: 'ignore' });
    } catch {
      /* ignore */
    }
  }
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

describe('getff-work.sh — workspace one-command (AC-5)', { timeout: SLOW_SHELL_MS }, () => {
  let tmpRepo: string;
  beforeEach(() => {
    tmpRepo = setupTempRepo();
  });
  afterEach(() => {
    // Debris in the REAL repo first — leaving it behind is what turned this
    // suite red in the first place (see uniqueName()).
    cleanupRealWorktrees();
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
    const name = uniqueName('smoke-cc');
    const r = runScript(
      [name, '--no-launch'],
      { CLAUDE_CODE_SESSION_ID: 'fake-cc-session-id' },
    );
    expect(r.status, `getff-work.sh exit code. output:\n${r.stdout}${r.stderr}`).toBe(0);
    expect(r.stdout).toMatch(/CC deferral|deferring|CLAUDE_CODE_SESSION_ID/i);
    expect(r.stdout).toMatch(new RegExp(`claude -w\\s+${name}`));
    // The wrapper does NOT itself spawn a `claude` session; verify it ends with
    // the "done (CC deferral)" line, not a session-launch log.
    expect(r.stdout).toMatch(/done \(CC deferral\)/);
  });

  // ✅ NON-CC-PRINT
  it('NON-CC-PRINT: no CC env → prints ready command, does NOT spawn a session', () => {
    // Ensure CC env is unset for this test.
    const r = runScript([uniqueName('smoke-noncc'), '--no-launch'], {
      CLAUDE_CODE_SESSION_ID: '',
    });
    expect(r.status, `getff-work.sh exit code. output:\n${r.stdout}${r.stderr}`).toBe(0);
    // Without CC env, the wrapper prints a ready command for the operator to run.
    expect(r.stdout).toMatch(/cd\s+\S+/);
    expect(r.stdout).not.toMatch(/CC deferral/);
  });

  // ✅ NO-LAUNCH-FLAG (force print even in TTY)
  it('NO-LAUNCH-FLAG: --no-launch forces print-only path', () => {
    // CLAUDE_CODE_SESSION_ID must be cleared: the asserted "done (--no-launch /
    // non-TTY)" line lives on the NON-CC path (getff-work.sh:153-156), and the
    // CC check at getff-work.sh:119 exits at :129 before ever reaching it. This
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
    const r = runScript([uniqueName('smoke-nolaunch'), '--no-launch'], {
      CLAUDE_CODE_SESSION_ID: '',
    });
    expect(r.status, `getff-work.sh exit code. output:\n${r.stdout}${r.stderr}`).toBe(0);
    expect(r.stdout).toMatch(/reason=flag/);
  });

  // ✅ NO-LAUNCH-FLAG paired-negative (same run, flag withheld)
  it('NO-LAUNCH-FLAG (neg): without --no-launch the same print-only path reports reason=non-tty', () => {
    // Identical invocation minus the flag. Print-only is still reached (spawnSync is non-TTY),
    // so this pins the auto-enable path to its own reason value — which is what makes the
    // positive above falsifiable rather than a restatement of "the runner has no TTY".
    const r = runScript([uniqueName('smoke-nolaunch-neg')], { CLAUDE_CODE_SESSION_ID: '' });
    expect(r.status, `getff-work.sh exit code. output:\n${r.stdout}${r.stderr}`).toBe(0);
    expect(r.stdout).toMatch(/reason=non-tty/);
    expect(r.stdout, 'the flag was not passed — reason must not claim it was').not.toMatch(
      /reason=flag/,
    );
  });

  // ✅ NO-INSTALL-THROUGH-DELIVERY-SYMLINK (paired-negative for the 2026-08-16 incident)
  it('step 2 does NOT install through the worktree node_modules delivery symlink — the primary tree survives', () => {
    // Incident 2026-08-16 (staging RED at fa8da9406c): create-worktree.sh provisions
    // <worktree>/node_modules as a symlink to the PRIMARY's tree
    // (worktree-node-modules.sh:131), and step 2 then ran `npm ci` with that worktree as
    // cwd — so npm reified the PRIMARY's real node_modules against the worktree's lock,
    // pruning 673 of 835 packages and emptying node_modules/.bin. Every vitest child
    // spawned afterwards died on
    // `Cannot find module '<root>/node_modules/vitest/suppress-warnings.cjs'`:
    // 972/972 tests passed, 25 unhandled errors, exit 1 — a red no assertion explained.
    //
    // The assertion is the primary's own package count across a real wrapper run: it is
    // the quantity the defect moved, and it cannot pass by construction if the install
    // writes through the link again.
    const primaryNodeModules = resolve(REPO_ROOT, 'node_modules');
    const before = existsSync(primaryNodeModules)
      ? readdirSync(primaryNodeModules).length
      : 0;
    expect(
      before,
      'precondition: the primary checkout must be installed for this case to mean anything',
    ).toBeGreaterThan(100);

    const r = runScript([uniqueName('smoke-nmguard'), '--no-launch'], {
      CLAUDE_CODE_SESSION_ID: '',
    });
    expect(r.status, `getff-work.sh exit code. output:\n${r.stdout}${r.stderr}`).toBe(0);

    const after = readdirSync(primaryNodeModules).length;
    expect(
      after,
      `the primary's node_modules lost entries during a wrapper run (${before} → ${after}). ` +
        `That is the delivery-symlink write-through defect, not a flake. output:\n${r.stdout}`,
    ).toBe(before);
    // And the skip is announced rather than silent — a silent skip would be
    // indistinguishable from an install that did nothing.
    expect(r.stdout).toMatch(/delivery symlink into the primary checkout/);
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
      { cwd: tmpRepo, encoding: 'utf8', timeout: SPAWN_GUARD_MS },
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
