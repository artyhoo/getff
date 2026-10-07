/**
 * Paired-negative tests for the coordination-sync step in BOTH the CC
 * WorktreeCreate hook (.claude/hooks/worktree-setup.sh) and the portable
 * script (scripts/create-worktree.sh).
 *
 * After the J5 → symlink-to-canonical migration (SSOT #110), both helpers
 * call `scripts/link-coordination.sh` instead of running rsync directly.
 * The positive test checks that state.md is reachable AS A SYMLINK pointing
 * into $CANON; the paired-negative test strips the link-coordination.sh call
 * and asserts the kickoff is absent (proving the wiring is load-bearing).
 *
 * The former rsync NON-DESTRUCTIVE test has been removed — its premise (rsync
 * in the hook) is gone; done.md non-destructive behaviour is covered by
 * link-coordination.test.ts (b) which tests the symlink helper directly.
 *
 * Runs against temporary git repos (no network, no real-repo side-effects).
 * Sets CLAUDE_COORDINATION_DIR to a temp dir in every test — never touches $HOME.
 * Skips gracefully when `jq` (hook only) is unavailable.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync, execSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HOOK = resolve(REPO_ROOT, '.agents/hooks/worktree-setup.sh');
const SCRIPT = resolve(REPO_ROOT, 'scripts/create-worktree.sh');
const LINK_COORDINATION = resolve(REPO_ROOT, 'scripts/link-coordination.sh');

// ── Availability checks ──────────────────────────────────────────────────────

function hasJq(): boolean {
  try {
    execSync('command -v jq', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
const JQ = hasJq();

// ── Helpers ──────────────────────────────────────────────────────────────────

interface Result {
  stdout: string;
  stderr: string;
  status: number;
}

function runHook(
  input: Record<string, unknown>,
  env: Record<string, string> = {},
): Result {
  try {
    const stdout = execFileSync('bash', [HOOK], {
      input: JSON.stringify(input),
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

/** Build a temp repo whose .claude/orchestrator-prompts/ has gitignored kickoffs. */
function setupRepoWithKickoffs(): string {
  const dir = mkdtempSync(resolve(tmpdir(), 'j5-hyd-test-'));
  execSync('git init -q -b main', { cwd: dir });
  execSync('git config user.email test@example.com', { cwd: dir });
  execSync('git config user.name test', { cwd: dir });
  writeFileSync(resolve(dir, 'README.md'), 'test\n');

  // Minimal packages/core/ layout (hook symlinks into it)
  mkdirSync(resolve(dir, 'packages/core'), { recursive: true });
  writeFileSync(resolve(dir, 'packages/core/.keep'), '');

  // .gitignore mirroring production (.claude/orchestrator-prompts/* gitignored;
  // subdir skeleton and done.md tracked)
  const gitignore = [
    'node_modules',
    '.claude/orchestrator-prompts/*',
    '!.claude/orchestrator-prompts/README.md',
    '!.claude/orchestrator-prompts/*/',
    '.claude/orchestrator-prompts/*/*',
    '!.claude/orchestrator-prompts/*/done.md',
  ].join('\n');
  writeFileSync(resolve(dir, '.gitignore'), gitignore + '\n');

  // Skeleton: tracked root README + umbrella subdir skeleton
  mkdirSync(resolve(dir, '.claude/orchestrator-prompts/my-umbrella'), { recursive: true });
  writeFileSync(resolve(dir, '.claude/orchestrator-prompts/README.md'), '# OPs\n');
  // done.md is tracked (skeleton)
  writeFileSync(resolve(dir, '.claude/orchestrator-prompts/my-umbrella/done.md'), 'done-from-primary\n');

  execSync('git add . && git commit -q -m init', { cwd: dir });

  // Now add a gitignored state.md to the primary checkout (not committed).
  // SSOT #116: kickoff.md is a tracked durable doc (link-coordination skips */kickoff.md);
  // state.md is the per-umbrella gitignored regenerable runtime the helpers seed + symlink.
  writeFileSync(
    resolve(dir, '.claude/orchestrator-prompts/my-umbrella/state.md'),
    '# my-umbrella state\nThis is the real runtime state content.\n',
  );

  // Primary node_modules symlink target
  mkdirSync(resolve(dir, 'node_modules'), { recursive: true });
  writeFileSync(resolve(dir, 'node_modules/.keep'), '');

  // Provide link-coordination.sh in the temp repo so the wiring call
  // `bash "$PROJECT_DIR/scripts/link-coordination.sh"` resolves correctly
  // when the real SCRIPT / HOOK sets PROJECT_DIR to this temp dir.
  mkdirSync(resolve(dir, 'scripts'), { recursive: true });
  execSync(`ln -sf "${LINK_COORDINATION}" "${resolve(dir, 'scripts/link-coordination.sh')}"`);

  return dir;
}

function hookPayload(name: string, cwd: string): Record<string, unknown> {
  return {
    session_id: 'sess-j5',
    transcript_path: '/tmp/no-transcript.jsonl',
    cwd,
    hook_event_name: 'WorktreeCreate',
    name,
  };
}

function teardown(dir: string): void {
  try {
    const list = execSync(`git -C "${dir}" worktree list --porcelain`, { encoding: 'utf8' });
    for (const line of list.split('\n')) {
      const m = line.match(/^worktree (.+)$/);
      if (m && m[1] !== dir) {
        try {
          execSync(`git -C "${dir}" worktree remove "${m[1]}" --force`, { stdio: 'ignore' });
        } catch { /* best-effort */ }
      }
    }
  } catch { /* repo may already be torn down */ }
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch { /* OS will collect /tmp */ }
}

// ── Hook tests (CC WorktreeCreate) ───────────────────────────────────────────

describe.skipIf(!JQ)(
  'worktree-setup.sh — coordination-sync via link-coordination.sh (hook)',
  () => {
    let repo: string;
    let canon: string;

    beforeEach(() => {
      repo = setupRepoWithKickoffs();
      canon = mkdtempSync(resolve(tmpdir(), 'j5-hyd-canon-'));
    });
    afterEach(() => {
      teardown(repo);
      try { rmSync(canon, { recursive: true, force: true }); } catch { /* ignore */ }
    });

    it('POSITIVE: state.md present AS A SYMLINK in worktree after creation', () => {
      const r = runHook(hookPayload('hyd-pos', repo), {
        CLAUDE_PROJECT_DIR: repo,
        CLAUDE_COORDINATION_DIR: canon,
      });
      expect(r.status).toBe(0);
      const wt = `${repo}/.claude/worktrees/hyd-pos`;
      const statePath = `${wt}/.claude/orchestrator-prompts/my-umbrella/state.md`;
      expect(existsSync(statePath), 'state.md must exist').toBe(true);
      // With symlink-to-canonical, state.md is a symlink (adopted from primary seed)
      expect(lstatSync(statePath).isSymbolicLink(), 'state.md must be a symlink into $CANON').toBe(true);
      const content = readFileSync(statePath, 'utf8');
      expect(content).toContain('my-umbrella state');
    });

    it('PAIRED-NEGATIVE: without link-coordination.sh call, state.md is ABSENT (T-coord-sync)', () => {
      // Create a stripped version of the hook without the link-coordination.sh call
      // and verify the worktree does NOT contain the kickoff.
      const strippedHook = (() => {
        const src = readFileSync(HOOK, 'utf8');
        // Remove the line calling link-coordination.sh
        return src.replace(
          /bash "\$PROJECT_DIR\/scripts\/link-coordination\.sh".*\n/,
          '',
        );
      })();

      const tmpHook = resolve(tmpdir(), 'worktree-setup-stripped.sh');
      writeFileSync(tmpHook, strippedHook, { mode: 0o755 });

      try {
        const result = execFileSync('bash', [tmpHook], {
          input: JSON.stringify(hookPayload('hyd-neg', repo)),
          encoding: 'utf8',
          env: { ...process.env, CLAUDE_PROJECT_DIR: repo, CLAUDE_COORDINATION_DIR: canon },
        });
        const wt = result.trim();
        // Worktree was created but kickoff must be ABSENT (the gap)
        expect(
          existsSync(`${wt}/.claude/orchestrator-prompts/my-umbrella/state.md`),
        ).toBe(false);
      } finally {
        try { rmSync(tmpHook); } catch { /* ignore */ }
      }
    });
  },
);

// ── Script tests (create-worktree.sh portable) ───────────────────────────────

describe(
  'create-worktree.sh — coordination-sync via link-coordination.sh (portable script)',
  () => {
    let repo: string;
    let canon: string;

    beforeEach(() => {
      repo = setupRepoWithKickoffs();
      canon = mkdtempSync(resolve(tmpdir(), 'j5-script-canon-'));
    });
    afterEach(() => {
      teardown(repo);
      try { rmSync(canon, { recursive: true, force: true }); } catch { /* ignore */ }
    });

    it('POSITIVE: state.md present AS A SYMLINK in worktree after script run', () => {
      const r = runScript(['hyd-script-pos', repo], { CLAUDE_COORDINATION_DIR: canon });
      expect(r.status).toBe(0);
      const wt = `${repo}/.claude/worktrees/hyd-script-pos`;
      const statePath = `${wt}/.claude/orchestrator-prompts/my-umbrella/state.md`;
      expect(existsSync(statePath), 'state.md must exist').toBe(true);
      expect(lstatSync(statePath).isSymbolicLink(), 'state.md must be a symlink').toBe(true);
    });

    it('PAIRED-NEGATIVE (script): without link-coordination.sh call, state.md absent (T-coord-sync)', () => {
      const strippedScript = (() => {
        const src = readFileSync(SCRIPT, 'utf8');
        // Remove the line calling link-coordination.sh
        return src.replace(
          /bash "\$PROJECT_DIR\/scripts\/link-coordination\.sh".*\n/,
          '',
        );
      })();

      const tmpScript = resolve(tmpdir(), 'create-worktree-stripped.sh');
      writeFileSync(tmpScript, strippedScript, { mode: 0o755 });

      try {
        const result = execFileSync('bash', [tmpScript, 'hyd-script-neg', repo], {
          encoding: 'utf8',
          env: { ...process.env, CLAUDE_COORDINATION_DIR: canon },
        });
        const wt = result.trim();
        expect(
          existsSync(`${wt}/.claude/orchestrator-prompts/my-umbrella/state.md`),
        ).toBe(false);
      } finally {
        try { rmSync(tmpScript); } catch { /* ignore */ }
      }
    });

    it('DUAL-PAIR PARITY: hook and script both produce symlinks (when jq available)', () => {
      // Both must link the kickoff as a symlink — T-coord-parity guard
      // (only testing the script here; hook parity tested in the hook suite above when JQ=true)
      const r = runScript(['hyd-parity', repo], { CLAUDE_COORDINATION_DIR: canon });
      expect(r.status).toBe(0);
      const wt = `${repo}/.claude/worktrees/hyd-parity`;
      const statePath = `${wt}/.claude/orchestrator-prompts/my-umbrella/state.md`;
      expect(existsSync(statePath), 'state.md must exist').toBe(true);
      expect(lstatSync(statePath).isSymbolicLink(), 'state.md must be symlink').toBe(true);
      const content = readFileSync(statePath, 'utf8');
      expect(content).toContain('my-umbrella state');
    });
  },
);
