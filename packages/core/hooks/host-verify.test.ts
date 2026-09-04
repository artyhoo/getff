/**
 * Functional tests for scripts/host-verify.sh — the destination-environment
 * verification runner. Tests the runner's own contract (independent of the gate
 * that calls it): exit codes, pipefail propagation, timeout bound, and the
 * umbrella-arg path-traversal rejection.
 *
 * spec: .claude/rules/destination-environment-verification.md §1
 */
import { describe, it, expect, afterEach } from 'vitest';
import { execSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
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

function runRunner(
  args: string[],
  env: Record<string, string> = {},
): { status: number; stdout: string; stderr: string } {
  const r = spawnSync('bash', [RUNNER, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
    cwd: env.HV_CWD || undefined,
  });
  return { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

// Mirror the runner's own binary resolution: scripts/host-verify.sh:415 probes
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
