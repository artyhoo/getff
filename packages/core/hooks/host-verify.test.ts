/**
 * Functional tests for scripts/host-verify.sh — the destination-environment
 * verification runner. Tests the runner's own contract (independent of the gate
 * that calls it): exit codes, pipefail propagation, timeout bound, and the
 * umbrella-arg path-traversal rejection.
 *
 * REPO-IDENTITY GUARD (2026-09-30, the deferred half of the getff#1971 backward sweep): the
 * runner executed a contract from the CURRENT cwd's git toplevel, so `bash /abs/path/scripts/
 * host-verify.sh <kickoff>` run from a scratch consumer repo executed that contract — and
 * whatever it writes — inside the foreign repo. Run mode now refuses (exit 3) unless the cwd
 * is a checkout of the repository the runner lives in (the physical git common dirs match —
 * the predicate of scripts/link-coordination.sh, #1967). `--list` never executes anything and
 * stays unguarded, so every programmatic caller (all of them use --list) is unaffected.
 * Fixtures therefore install the runner into their own throwaway repo — the production shape.
 *
 *   (g1) FOREIGN CWD + another checkout's runner: refused (exit 3), no marker anywhere
 *   (g2) OWN LINKED WORKTREE as cwd + the primary's runner: runs, in the worktree
 *   (g3) OWN CHECKOUT + a kickoff OUTSIDE any git checkout (the canon-symlink case): runs in the cwd
 *   (g4) cwd outside any git checkout: refused (exit 3)
 *   (g5) --list from a foreign cwd: still lists (read-only, unguarded)
 *   (g6) CDPATH naming a dir with its own scripts/: a relative invocation from the own
 *        checkout still resolves the runner's repo correctly and runs
 *   (g-neg) PAIRED-NEGATIVE: with the guard block stripped, the foreign cwd repo IS written
 *
 * spec: .claude/rules/destination-environment-verification.md §1
 */
import { describe, it, expect, afterEach } from 'vitest';
import { execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const RUNNER = resolve(REPO_ROOT, 'scripts/host-verify.sh');

const tmpDirs: string[] = [];
afterEach(() => {
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

// Write `body` to a kickoff.md at a repo-relative path matching the gate's
// suffix matcher (orchestrator-prompts/<wave>/kickoff.md), inside a temp dir
// that is its own git repo so git rev-parse --show-toplevel resolves to the
// temp dir, not the real repo.
function writeKickoffInTempRepo(body: string): { kickoff: string; repoRoot: string } {
  const repoRoot = mkdtempSync(join(tmpdir(), 'hv-runner-'));
  tmpDirs.push(repoRoot);
  // Init a git repo so host-verify.sh's `git rev-parse --show-toplevel` resolves.
  try { execSync(`git -C ${repoRoot} init -q`, { stdio: 'ignore' }); } catch { /* git absent — runner falls back to pwd */ }
  const dir = join(repoRoot, '.claude', 'orchestrator-prompts', 'test-umbrella');
  mkdirSync(dir, { recursive: true });
  const kickoff = join(dir, 'kickoff.md');
  writeFileSync(kickoff, body, 'utf8');
  return { kickoff, repoRoot };
}

/** Install the runner into `<repo>/scripts/` — the production shape the repo-identity guard expects. */
function installRunner(repo: string, src: string = readFileSync(RUNNER, 'utf8')): string {
  mkdirSync(join(repo, 'scripts'), { recursive: true });
  const p = join(repo, 'scripts', 'host-verify.sh');
  writeFileSync(p, src, { mode: 0o755 });
  return p;
}

function runRunner(
  args: string[],
  env: Record<string, string> = {},
): { status: number; stdout: string; stderr: string } {
  // With a fixture cwd, run the fixture's own copy of the runner (run mode refuses a cwd that
  // is not a checkout of the runner's repository); without one, run this repo's runner.
  const runner = env.HV_CWD ? installRunner(env.HV_CWD) : RUNNER;
  const r = spawnSync('bash', [runner, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
    cwd: env.HV_CWD || undefined,
  });
  return { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

// Mirror the runner's own binary resolution: scripts/host-verify.sh:490 probes
// `for _t in timeout gtimeout` and uses whichever it finds first. A skip-probe that
// checks only `timeout` would silently skip the timeout case on a host with only
// `gtimeout` (e.g. macOS with Homebrew coreutils) even though the runner would
// actually run the test successfully. Match the runner's resolution exactly.
const HAS_TIMEOUT_BIN = (() => {
  for (const bin of ['timeout', 'gtimeout']) {
    try { execSync(`command -v ${bin}`, { stdio: 'ignore' }); return true; } catch { /* keep scanning */ }
  }
  return false;
})();

describe('host-verify.sh — runner contract', () => {
  it('a failing substantive command → exit 1', () => {
    // `test -f` with args is substantive (passes the no-op guard) but fails here.
    const { kickoff, repoRoot } = writeKickoffInTempRepo(
      '# k\n\n```bash host-verify\ntest -f /nonexistent-host-verify-marker-xyz-123\n```\n',
    );
    const r = runRunner([kickoff], { HV_CWD: repoRoot });
    expect(r.status).toBe(1);
  });

  it('pipefail inside the child catches a pipeline failure (false | tee)', () => {
    // Without `bash -o pipefail -c`, `false | tee /dev/null` would report tee's exit (0).
    // `test -f` makes the line substantive (escapes the no-op guard); the pipeline fails.
    const { kickoff, repoRoot } = writeKickoffInTempRepo(
      '# k\n\n```bash host-verify\ntest -f /no-such-file-xyz | tee /dev/null\n```\n',
    );
    const r = runRunner([kickoff], { HV_CWD: repoRoot });
    expect(r.status).toBe(1);
  });

  it.skipIf(
    // Skip ONLY the timeout case when neither binary is available. The other six
    // tests do not depend on `timeout`/`gtimeout` and were previously dropped
    // by the `describe.skipIf` wrapper when only `timeout` (not `gtimeout`) was
    // probed on a host that had `gtimeout` instead.
    !HAS_TIMEOUT_BIN,
  )('timeout kills a hung command before the default 900s', () => {
    // `sleep 5` under a 1s timeout must be killed → non-zero exit.
    const { kickoff, repoRoot } = writeKickoffInTempRepo(
      '# k\n\n```bash host-verify\nsleep 5\n```\n',
    );
    const r = runRunner([kickoff], { HV_CWD: repoRoot, HOST_VERIFY_TIMEOUT: '1' });
    expect(r.status, `stdout=${r.stdout} stderr=${r.stderr}`).not.toBe(0);
  });

  it('umbrella arg containing `/` is rejected as path traversal → exit 2', () => {
    const r = runRunner(['a/../b']);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/umbrella name must not contain/);
  });

  it('umbrella arg containing `..` is rejected → exit 2', () => {
    const r = runRunner(['..foo']);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/umbrella name must not contain/);
  });

  it('a passing contract → exit 0', () => {
    // `test -d .git` is substantive (escapes no-op guard) and true in the temp git repo.
    // The runner cd's into REPO_ROOT (resolved via `git rev-parse --show-toplevel`),
    // which is the temp dir we initialised as a git repo.
    const { kickoff, repoRoot } = writeKickoffInTempRepo(
      '# k\n\n```bash host-verify\ntest -d .git\n```\n',
    );
    const r = runRunner([kickoff], { HV_CWD: repoRoot });
    expect(r.status).toBe(0);
  });

  it('--list mode prints commands without running them → exit 0', () => {
    // Probe with a real side effect: touch a file. If --list executes the command,
    // the file appears; if it only lists, the file is absent.
    const { kickoff, repoRoot } = writeKickoffInTempRepo(
      '# k\n\n```bash host-verify\ntest -d .git\ntouch host-verify-list-mode-probe\n```\n',
    );
    const probePath = join(repoRoot, 'host-verify-list-mode-probe');
    const r = runRunner(['--list', kickoff], { HV_CWD: repoRoot });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/test -d \.git/);
    expect(r.stdout).toMatch(/touch host-verify-list-mode-probe/);
    // The probe file must NOT exist — --list must not execute commands.
    expect(require('node:fs').existsSync(probePath)).toBe(false);
  });
});

describe('host-verify.sh — repo-identity guard (run mode)', () => {
  const MARKER = 'hv-guard-marker';
  const CONTRACT = `# k\n\n\`\`\`bash host-verify\ntouch ${MARKER}\n\`\`\`\n`;

  function committedRepo(prefix: string): string {
    const dir = mkdtempSync(join(tmpdir(), prefix));
    tmpDirs.push(dir);
    execSync('git init -q -b main', { cwd: dir });
    execSync('git config user.email test@example.com && git config user.name test', { cwd: dir });
    writeFileSync(join(dir, '.gitignore'), `${MARKER}\nwt-*/\nscripts/\n`);
    const kdir = join(dir, '.claude', 'orchestrator-prompts', 'guard-umbrella');
    mkdirSync(kdir, { recursive: true });
    writeFileSync(join(kdir, 'kickoff.md'), CONTRACT, 'utf8');
    execSync('git add -A && git commit -q -m init', { cwd: dir });
    return dir;
  }

  const kickoffOf = (repo: string): string =>
    join(repo, '.claude', 'orchestrator-prompts', 'guard-umbrella', 'kickoff.md');

  function runWith(
    runner: string,
    args: string[],
    cwd: string,
    extra: Record<string, string> = {},
  ): { status: number; out: string } {
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (v !== undefined && !k.startsWith('GIT_')) env[k] = v;
    }
    const r = spawnSync('bash', [runner, ...args], { cwd, env: { ...env, ...extra }, encoding: 'utf8' });
    return { status: r.status ?? -1, out: `${r.stdout}${r.stderr}` };
  }

  it('(g1) FOREIGN CWD + another checkout\'s runner: refused (exit 3), the contract never runs', () => {
    const own = committedRepo('hv-own-');
    const foreign = committedRepo('hv-foreign-');
    const r = runWith(installRunner(own), [kickoffOf(own)], foreign);
    expect(r.status, r.out).toBe(3);
    expect(r.out).toContain('not a checkout of');
    expect(existsSync(join(foreign, MARKER)), 'nothing may run in the foreign cwd repo').toBe(false);
    expect(existsSync(join(own, MARKER)), 'a refusal runs nothing anywhere').toBe(false);
  });

  it('(g2) OWN LINKED WORKTREE as cwd + the primary\'s runner: runs in the worktree', () => {
    const own = committedRepo('hv-own-');
    const runner = installRunner(own);
    const wt = join(own, 'wt-linked');
    execSync(`git worktree add -q "${wt}" HEAD`, { cwd: own });
    const r = runWith(runner, [kickoffOf(wt)], wt);
    expect(r.status, r.out).toBe(0);
    expect(existsSync(join(wt, MARKER)), r.out).toBe(true);
    expect(existsSync(join(own, MARKER))).toBe(false);
  });

  it('(g3) OWN CHECKOUT + a kickoff outside any git checkout: runs in the cwd repo', () => {
    const own = committedRepo('hv-own-');
    const canon = mkdtempSync(join(tmpdir(), 'hv-canon-'));
    tmpDirs.push(canon);
    writeFileSync(join(canon, 'kickoff.md'), CONTRACT, 'utf8');
    const r = runWith(installRunner(own), [join(canon, 'kickoff.md')], own);
    expect(r.status, r.out).toBe(0);
    expect(existsSync(join(own, MARKER)), r.out).toBe(true);
  });

  it('(g4) cwd outside any git checkout: refused (exit 3)', () => {
    const own = committedRepo('hv-own-');
    const bare = mkdtempSync(join(tmpdir(), 'hv-nogit-'));
    tmpDirs.push(bare);
    const r = runWith(installRunner(own), [kickoffOf(own)], bare);
    expect(r.status, r.out).toBe(3);
    expect(existsSync(join(bare, MARKER))).toBe(false);
  });

  it('(g5) --list from a foreign cwd still lists (read-only, unguarded)', () => {
    const own = committedRepo('hv-own-');
    const foreign = committedRepo('hv-foreign-');
    const r = runWith(installRunner(own), ['--list', kickoffOf(own)], foreign);
    expect(r.status, r.out).toBe(0);
    expect(r.out).toContain(`touch ${MARKER}`);
    expect(existsSync(join(foreign, MARKER))).toBe(false);
  });

  it('(g6) CDPATH naming a dir with its own scripts/: a relative run from the own checkout still works', () => {
    const own = committedRepo('hv-own-');
    installRunner(own);
    const decoy = mkdtempSync(join(tmpdir(), 'hv-decoy-'));
    tmpDirs.push(decoy);
    mkdirSync(join(decoy, 'scripts'));
    const r = runWith('scripts/host-verify.sh', [kickoffOf(own)], own, { CDPATH: decoy });
    expect(r.status, r.out).toBe(0);
    expect(existsSync(join(own, MARKER)), r.out).toBe(true);
  });

  it('(g-neg) PAIRED-NEGATIVE: with the guard block stripped, the foreign cwd repo IS written', () => {
    const src = readFileSync(RUNNER, 'utf8');
    const stripped = src.replace(/# ── REPO-IDENTITY GUARD[\s\S]*?# ── END REPO-IDENTITY GUARD[^\n]*\n/, '');
    expect(stripped, 'the REPO-IDENTITY GUARD block must be present to strip').not.toBe(src);
    const own = committedRepo('hv-own-');
    const foreign = committedRepo('hv-foreign-');
    runWith(installRunner(own, stripped), [kickoffOf(own)], foreign);
    expect(existsSync(join(foreign, MARKER)), 'without the guard the contract runs in the foreign cwd').toBe(true);
  });
});
