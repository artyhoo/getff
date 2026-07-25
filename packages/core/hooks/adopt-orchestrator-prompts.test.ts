/**
 * Functional tests for the PostToolUse adopt-on-write hook
 * (.claude/hooks/adopt-orchestrator-prompts.sh).
 *
 * The gap this closes: a NEW gitignored file born mid-session under
 * .claude/orchestrator-prompts/*\/ inside a worktree is sole-copy and dies if the
 * worktree is deleted before the next session-start adoption sweep. The hook fires
 * the EXISTING scripts/link-coordination.sh adopt-then-link arm (SSOT #110) at
 * write-time so adoption is mechanical at the earliest reachable channel.
 *
 * IMPORTANT (T-CAH-A): these tests exercise the HOOK FIRING on a write — they feed
 * the PostToolUse stdin JSON {"tool_input":{"file_path":"…"}} to the real hook and
 * assert the resulting file/CANON state. They do NOT call link-coordination.sh
 * directly (that script already has its own suite, link-coordination.test.ts). The
 * bug was never adopt-then-link — it was that nothing FIRED it; that is what we test.
 *
 * Isolation: every run sets CLAUDE_COORDINATION_DIR to a temp $CANON — the real
 * ~/.claude-coordination store is never touched. The worktree root is a standalone
 * temp dir; the hook derives it from the written path, so no real git worktree or
 * git repo is needed.
 *
 * Spawns the real hook with fixture stdin (the check-hook-marker.test.ts precedent).
 * Skips gracefully when `jq` is unavailable (the link-coordination.test.ts RSYNC
 * precedent) — the hook itself no-ops without jq, so jq-less coverage is honest-empty.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HOOK = resolve(REPO_ROOT, '.claude/hooks/adopt-orchestrator-prompts.sh');

function hasJq(): boolean {
  try {
    execSync('command -v jq', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
const JQ = hasJq();

interface RunResult {
  stdout: string;
  stderr: string;
  status: number;
}

/** Fire the hook with the PostToolUse stdin contract for a written `filePath`. */
function runHook(filePath: string, canon: string): RunResult {
  const r = spawnSync('bash', [HOOK], {
    input: JSON.stringify({ tool_input: { file_path: filePath } }),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_COORDINATION_DIR: canon },
  });
  return {
    stdout: (r.stdout ?? '').trim(),
    stderr: (r.stderr ?? '').trim(),
    status: r.status ?? -1,
  };
}

/**
 * Standalone temp worktree with `.claude/orchestrator-prompts/<umbrella>/`.
 * Not a real git worktree — the hook derives the worktree root from the path.
 */
function makeWorktree(name: string, umbrella = 'my-umbrella'): string {
  const wt = mkdtempSync(resolve(tmpdir(), `adopt-hook-${name}-`));
  mkdirSync(resolve(wt, '.claude/orchestrator-prompts', umbrella), { recursive: true });
  return wt;
}

function promptFile(wt: string, rel: string): string {
  return resolve(wt, '.claude/orchestrator-prompts', rel);
}

const dirs: string[] = [];
function tmpCanon(): string {
  const c = mkdtempSync(resolve(tmpdir(), 'adopt-hook-canon-'));
  dirs.push(c);
  return c;
}
function track(d: string): string {
  dirs.push(d);
  return d;
}

afterEach(() => {
  for (const d of dirs.splice(0)) {
    try { rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

describe.skipIf(!JQ)('adopt-orchestrator-prompts.sh — PostToolUse adopt-on-write', () => {
  let canon: string;
  beforeEach(() => {
    canon = tmpCanon();
  });

  // ── (green) ADOPT-ON-WRITE ──────────────────────────────────────────────────
  it('adopts a new real prompt file on write: becomes a symlink, content moves to $CANON', () => {
    const wt = track(makeWorktree('adopt'));
    const foo = promptFile(wt, 'my-umbrella/foo.md');
    writeFileSync(foo, '# fresh kickoff\nBorn in a worktree.\n');

    // Pre-condition: real file, CANON empty.
    expect(lstatSync(foo).isSymbolicLink()).toBe(false);

    const r = runHook(foo, canon);
    expect(r.status, `hook stderr: ${r.stderr}`).toBe(0);

    // Post: worktree path is now a symlink, real content lives in $CANON.
    expect(existsSync(foo), 'foo.md still resolves').toBe(true);
    expect(lstatSync(foo).isSymbolicLink(), 'foo.md must be a symlink after adoption').toBe(true);

    const canonFile = resolve(canon, 'my-umbrella/foo.md');
    expect(existsSync(canonFile), 'CANON holds the adopted file').toBe(true);
    expect(readFileSync(canonFile, 'utf8')).toContain('Born in a worktree.');
    // Reading through the symlink still yields the original content.
    expect(readFileSync(foo, 'utf8')).toContain('Born in a worktree.');
  });

  // ── (green) IDEMPOTENT ──────────────────────────────────────────────────────
  it('is idempotent: firing again on an already-adopted file leaves it a symlink, no conflict', () => {
    const wt = track(makeWorktree('idem'));
    const foo = promptFile(wt, 'my-umbrella/foo.md');
    writeFileSync(foo, '# kickoff\n');

    const r1 = runHook(foo, canon);
    expect(r1.status, `first run stderr: ${r1.stderr}`).toBe(0);
    expect(lstatSync(foo).isSymbolicLink()).toBe(true);

    // Fire again — must not conflict, must stay a symlink, exit 0.
    const r2 = runHook(foo, canon);
    expect(r2.status, `second run stderr: ${r2.stderr}`).toBe(0);
    expect(lstatSync(foo).isSymbolicLink(), 'still a symlink after re-fire').toBe(true);
    expect(readFileSync(resolve(canon, 'my-umbrella/foo.md'), 'utf8')).toBe('# kickoff\n');
  });

  // ── (negative) SKIP-LIST: tracked done.md / README.md are never adopted ──────
  it('PAIRED-NEGATIVE: writing done.md leaves it a REAL file (tracked-skip, not over-adopted)', () => {
    const wt = track(makeWorktree('neg-done'));
    const done = promptFile(wt, 'my-umbrella/done.md');
    writeFileSync(done, '# my-umbrella — DONE\n');

    const r = runHook(done, canon);
    expect(r.status, `hook stderr: ${r.stderr}`).toBe(0);

    expect(lstatSync(done).isSymbolicLink(), 'done.md must NOT be symlinked').toBe(false);
    expect(readFileSync(done, 'utf8')).toBe('# my-umbrella — DONE\n');
    // Nothing about done.md leaked into $CANON.
    expect(existsSync(resolve(canon, 'my-umbrella/done.md'))).toBe(false);
  });

  it('PAIRED-NEGATIVE: writing umbrella README.md leaves it a REAL file (tracked-skip)', () => {
    const wt = track(makeWorktree('neg-readme'));
    const readme = promptFile(wt, 'my-umbrella/README.md');
    writeFileSync(readme, '# umbrella readme\n');

    const r = runHook(readme, canon);
    expect(r.status, `hook stderr: ${r.stderr}`).toBe(0);

    expect(lstatSync(readme).isSymbolicLink(), 'README.md must NOT be symlinked').toBe(false);
    expect(readFileSync(readme, 'utf8')).toBe('# umbrella readme\n');
    expect(existsSync(resolve(canon, 'my-umbrella/README.md'))).toBe(false);
  });

  // ── (guard) PATH-FILTER: off-path write does NOT fire adoption ──────────────
  it('TRIGGER-GATE: an off-path write does not fire adoption (in-script path filter)', () => {
    const wt = track(makeWorktree('offpath'));
    // A real adoptable file sits inside orchestrator-prompts...
    const inside = promptFile(wt, 'my-umbrella/foo.md');
    writeFileSync(inside, '# should stay real\n');
    // ...but the hook is invoked for a write OUTSIDE orchestrator-prompts.
    const outside = resolve(wt, 'src/notes.md');
    mkdirSync(dirname(outside), { recursive: true });
    writeFileSync(outside, 'unrelated\n');

    const r = runHook(outside, canon);
    expect(r.status, `hook stderr: ${r.stderr}`).toBe(0);

    // Path filter must have short-circuited BEFORE link-coordination ran, so the
    // inside file was never adopted.
    expect(lstatSync(inside).isSymbolicLink(), 'inside file must stay real — hook gated by path').toBe(false);
    expect(existsSync(resolve(canon, 'my-umbrella')), '$CANON untouched').toBe(false);
  });

  // ── (negative) LOUD-SKIP: missing helper is announced, never silent ─────────
  // Regression (handoff item 2, 2026-07-25): the hook resolved the helper from ONE
  // hard-coded path and `exit 0`'d silently when absent — inert with zero signal.
  // Now: tiered resolution (project root → own checkout → written-file worktree) and
  // a LOUD DID-NOT-RUN notice on the additionalContext channel when every tier misses.
  it('LOUD-SKIP: helper absent in every tier → DID-NOT-RUN notice on stdout+stderr, exit 0, no adoption', () => {
    // Copy the hook into a bare fake root so tier 2 ($0-based) has no scripts/ dir;
    // point tier 1 (CLAUDE_PROJECT_DIR) at the same bare root; the temp worktree
    // (tier 3) has no scripts/ either.
    const fakeRoot = track(mkdtempSync(resolve(tmpdir(), 'adopt-hook-fakeroot-')));
    mkdirSync(resolve(fakeRoot, '.claude/hooks'), { recursive: true });
    const hookCopy = resolve(fakeRoot, '.claude/hooks/adopt-orchestrator-prompts.sh');
    writeFileSync(hookCopy, readFileSync(HOOK, 'utf8'), { mode: 0o755 });

    const wt = track(makeWorktree('loudskip'));
    const foo = promptFile(wt, 'my-umbrella/foo.md');
    writeFileSync(foo, '# kickoff\n');

    const r = spawnSync('bash', [hookCopy], {
      input: JSON.stringify({ tool_input: { file_path: foo } }),
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_COORDINATION_DIR: canon, CLAUDE_PROJECT_DIR: fakeRoot },
    });

    expect(r.status, `hook stderr: ${r.stderr}`).toBe(0); // still never a gate
    expect(r.stdout ?? '').toContain('DID NOT RUN'); // additionalContext JSON reaches the model
    expect(r.stderr ?? '').toContain('link-coordination.sh not found'); // terminal reader channel
    expect(lstatSync(foo).isSymbolicLink(), 'no adoption ran').toBe(false);
    expect(readdirSync(canon).length, '$CANON stays empty').toBe(0);
  });

  // ── (guard) FLUSH-GUARD: a not-yet-flushed (absent) file is a clean no-op ────
  it('FLUSH-GUARD: an absent file path is a no-op (exit 0, no $CANON writes)', () => {
    const wt = track(makeWorktree('flush'));
    const ghost = promptFile(wt, 'my-umbrella/never-flushed.md'); // never written

    const r = runHook(ghost, canon);
    expect(r.status, `hook stderr: ${r.stderr}`).toBe(0);
    // $CANON has no umbrella dir — adoption never ran.
    expect(readdirSync(canon).length, '$CANON stays empty').toBe(0);
  });
});
