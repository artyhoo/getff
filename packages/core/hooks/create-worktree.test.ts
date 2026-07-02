/**
 * Functional meta-tests for the portable worktree script
 * (scripts/create-worktree.sh) — the BUILD half of the dual-channel
 * worktree-create capability (verdict combo b+c, research patch
 * 2026-05-30-worktree-create-dual-channel.md §5).
 *
 * This is the CLI/CI/agent-callable sibling of the CC-only WorktreeCreate hook
 * (.claude/hooks/worktree-setup.sh). Same semantic check, two delivery channels
 * sharing the `worktree-create-setup` dual-pair anchor (dual-implementation-
 * discipline.md §5-§7). The hook reads JSON stdin; this script reads CLI args.
 *
 *   Usage  : bash scripts/create-worktree.sh <name> [<project-dir>] [<base-ref>]
 *   stdout : the worktree absolute path (ONLY thing on stdout)
 *   exit   : 0 = success ; non-zero = creation failed
 *
 * Tests run against a per-test temporary git repo so they neither touch the
 * real repo nor depend on origin/HEAD. Paired-negative scenarios assert the
 * failure modes the script is paid to detect (missing name, unresolvable
 * base ref) — principle-02 discipline applied to a bash artefact.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync, execSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readlinkSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const SCRIPT = resolve(REPO_ROOT, 'scripts/create-worktree.sh');

interface Result {
  stdout: string;
  stderr: string;
  status: number;
}

function runScript(args: string[], env: Record<string, string> = {}): Result {
  try {
    const stdout = execFileSync('bash', [SCRIPT, ...args], {
      encoding: 'utf8',
      env: { ...process.env, ...env },
    });
    return { stdout: stdout.toString().trim(), stderr: '', status: 0 };
  } catch (e) {
    const err = e as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number };
    return {
      stdout: (err.stdout?.toString() ?? '').trim(),
      stderr: (err.stderr?.toString() ?? '').trim(),
      status: err.status ?? 1,
    };
  }
}

function setupTempRepo(): string {
  const dir = mkdtempSync(resolve(tmpdir(), 'cwt-test-'));
  execSync('git init -q -b main', { cwd: dir });
  execSync('git config user.email test@example.com', { cwd: dir });
  execSync('git config user.name test', { cwd: dir });
  writeFileSync(resolve(dir, 'README.md'), 'test repo\n');
  // Track packages/core/ so the worktree checkout creates the directory —
  // matches production layout where the dir always exists in HEAD.
  mkdirSync(resolve(dir, 'packages/core'), { recursive: true });
  writeFileSync(resolve(dir, 'packages/core/.keep'), '');
  execSync('git add . && git commit -q -m init', { cwd: dir });
  // Primary node_modules — symlink target.
  mkdirSync(resolve(dir, 'node_modules'), { recursive: true });
  writeFileSync(resolve(dir, 'node_modules/.keep'), '');
  return dir;
}

function teardown(dir: string): void {
  try {
    const list = execSync(`git -C "${dir}" worktree list --porcelain`, { encoding: 'utf8' });
    for (const line of list.split('\n')) {
      const m = line.match(/^worktree (.+)$/);
      if (m && m[1] !== dir) {
        try {
          execSync(`git -C "${dir}" worktree remove "${m[1]}" --force`, { stdio: 'ignore' });
        } catch {
          /* best-effort */
        }
      }
    }
  } catch {
    /* repo may already be torn down */
  }
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* OS will collect /tmp */
  }
}

describe('create-worktree.sh — portable worktree setup', () => {
  let repo: string;

  beforeEach(() => {
    repo = setupTempRepo();
  });
  afterEach(() => {
    teardown(repo);
  });

  it('valid name → creates worktree, prints absolute path on stdout, exit 0', () => {
    const r = runScript(['my-wt', repo]);
    expect(r.status).toBe(0);
    const expected = `${repo}/.claude/worktrees/my-wt`;
    expect(r.stdout).toBe(expected);
    expect(existsSync(expected)).toBe(true);
  });

  it('symlinks node_modules from primary checkout (D2 workspace optimisation)', () => {
    const r = runScript(['sym-root', repo]);
    expect(r.status).toBe(0);
    const wt = `${repo}/.claude/worktrees/sym-root`;
    expect(readlinkSync(`${wt}/node_modules`)).toBe(`${repo}/node_modules`);
  });

  it('symlinks packages/core/node_modules to the primary REAL nested dir when it exists (shadowing fix, 2026-07-02)', () => {
    // Primary carries a real nested layer (root lock plans diverging dep
    // versions there) — the worktree link must target IT, not ../../node_modules,
    // or esbuild bundles root versions and synth-bundle --check false-drifts.
    mkdirSync(resolve(repo, 'packages/core/node_modules'), { recursive: true });
    writeFileSync(resolve(repo, 'packages/core/node_modules/.keep'), '');
    const r = runScript(['sym-core-nested', repo]);
    expect(r.status).toBe(0);
    const wt = `${repo}/.claude/worktrees/sym-core-nested`;
    expect(readlinkSync(`${wt}/packages/core/node_modules`)).toBe(
      `${repo}/packages/core/node_modules`,
    );
  });

  it('falls back to ../../node_modules when primary has no nested packages/core/node_modules', () => {
    const r = runScript(['sym-core', repo]);
    expect(r.status).toBe(0);
    const wt = `${repo}/.claude/worktrees/sym-core`;
    expect(readlinkSync(`${wt}/packages/core/node_modules`)).toBe('../../node_modules');
  });

  it('branch name follows convention: worktree-<name>', () => {
    runScript(['branch-conv', repo]);
    const wtList = execSync(`git -C "${repo}" worktree list --porcelain`, { encoding: 'utf8' });
    expect(wtList).toContain('branch refs/heads/worktree-branch-conv');
  });

  it('idempotent: re-invoke with same name → reuse (same stdout path, exit 0)', () => {
    const a = runScript(['idem', repo]);
    const b = runScript(['idem', repo]);
    expect(a.status).toBe(0);
    expect(b.status).toBe(0);
    expect(b.stdout).toBe(a.stdout);
  });

  it('stdout is a single line, absolute path (orchestration contract)', () => {
    const r = runScript(['one-line', repo]);
    expect(r.status).toBe(0);
    expect(r.stdout.split('\n').length).toBe(1);
    expect(r.stdout.startsWith('/')).toBe(true);
  });

  it('explicit base-ref arg is honoured (worktree based on the named ref)', () => {
    // Create a divergent branch with a distinctive marker file.
    execSync('git -C "' + repo + '" checkout -q -b feature-x', { cwd: repo });
    writeFileSync(resolve(repo, 'MARKER.txt'), 'from-feature-x\n');
    execSync('git -C "' + repo + '" add MARKER.txt && git -C "' + repo + '" commit -q -m marker', {
      cwd: repo,
    });
    execSync('git -C "' + repo + '" checkout -q main', { cwd: repo });

    const r = runScript(['based', repo, 'feature-x']);
    expect(r.status).toBe(0);
    expect(existsSync(`${repo}/.claude/worktrees/based/MARKER.txt`)).toBe(true);
  });

  it('WORKTREE_BASE_REF env is honoured when no explicit arg (configurable trunk)', () => {
    execSync('git -C "' + repo + '" checkout -q -b release', { cwd: repo });
    writeFileSync(resolve(repo, 'REL.txt'), 'from-release\n');
    execSync('git -C "' + repo + '" add REL.txt && git -C "' + repo + '" commit -q -m rel', {
      cwd: repo,
    });
    execSync('git -C "' + repo + '" checkout -q main', { cwd: repo });

    const r = runScript(['env-base', repo], { WORKTREE_BASE_REF: 'release' });
    expect(r.status).toBe(0);
    expect(existsSync(`${repo}/.claude/worktrees/env-base/REL.txt`)).toBe(true);
  });

  it('project-dir defaults to git toplevel when omitted (run from inside repo)', () => {
    const r = (() => {
      try {
        const stdout = execFileSync('bash', [SCRIPT, 'default-dir'], {
          encoding: 'utf8',
          cwd: repo,
        });
        return { stdout: stdout.toString().trim(), stderr: '', status: 0 };
      } catch (e) {
        const err = e as { stdout?: Buffer | string; status?: number };
        return { stdout: (err.stdout?.toString() ?? '').trim(), stderr: '', status: err.status ?? 1 };
      }
    })();
    expect(r.status).toBe(0);
    // git rev-parse --show-toplevel canonicalises symlinks (macOS /tmp →
    // /private/tmp), so compare against the resolved repo path.
    expect(r.stdout).toBe(`${realpathSync(repo)}/.claude/worktrees/default-dir`);
  });

  // ── Paired-negative scenarios: failure modes the script is paid to detect ──

  it('PAIRED-NEGATIVE: missing name (no args) → exit non-zero, no stdout', () => {
    const r = runScript([]);
    expect(r.status).not.toBe(0);
    expect(r.stdout).toBe('');
  });

  it('PAIRED-NEGATIVE: explicit non-existent base-ref → exit non-zero, no stdout', () => {
    const r = runScript(['bad-base', repo, 'origin/does-not-exist-anywhere']);
    expect(r.status).not.toBe(0);
    expect(r.stdout).toBe('');
  });
});
