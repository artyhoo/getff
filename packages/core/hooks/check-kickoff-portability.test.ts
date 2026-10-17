/**
 * Paired-negative contract for check-kickoff-portability.sh — the D5 fail-loud
 * pre-push gate (cross-session kickoff portability I-phase, SSOT #116).
 *
 * Script under test: packages/core/audit-self/check-kickoff-portability.sh
 * Wired into: packages/core/hooks/pre-push.ts (section 3e).
 *
 * Kickoff D5 acceptance (paired):
 *   - an in-flight umbrella with an untracked kickoff.md TRIPS the check
 *   - the same umbrella once `git add`-ed PASSES
 *   - a closed (done.md-only) umbrella NEVER trips
 * Plus the warn→fail flip is wired + tested (T19 — "CI checks form, not that D5's
 * warn→fail flip is wired"): same untracked-kickoff state yields exit 0 (warn) vs
 * exit 1 (KICKOFF_PORTABILITY_WARN_ONLY=false).
 *
 * T3 compliance: each assertion cites the script region it targets.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { spawnBashOrSkip, type Skippable } from './spawn-bash-or-skip.ts';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const SCRIPT = resolve(
  REPO_ROOT,
  'packages/core/audit-self/check-kickoff-portability.sh',
);

const sandboxes: string[] = [];
afterEach(() => {
  for (const d of sandboxes.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** A temp git repo with an initial commit (so `git ls-files` works). */
function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'kickoff-portability-test-'));
  sandboxes.push(dir);
  execSync('git init -q', { cwd: dir });
  execSync('git config user.email t@t.com', { cwd: dir });
  execSync('git config user.name Test', { cwd: dir });
  execSync('git config commit.gpgsign false', { cwd: dir });
  writeFileSync(join(dir, 'README.md'), 'base\n');
  execSync('git add README.md && git commit -q -m init', { cwd: dir });
  return dir;
}

function writeKickoff(dir: string, umbrella: string): string {
  const rel = `.claude/orchestrator-prompts/${umbrella}/kickoff.md`;
  const p = join(dir, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, `# ${umbrella}\n\n> **Type:** I-phase\n`, 'utf8');
  return rel;
}

function writeDone(dir: string, umbrella: string): void {
  const p = join(dir, `.claude/orchestrator-prompts/${umbrella}/done.md`);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, `# ${umbrella} — DONE\n- Final PR: #1\n`, 'utf8');
}

function run(
  ctx: Skippable,
  dir: string,
  warnOnly: string,
): { status: number; stdout: string; stderr: string } {
  // POSIX: byte-identical spawnSync pass-through; win32: Git Bash or named skip (#1799).
  const r = spawnBashOrSkip(ctx, 'bash', [SCRIPT], {
    encoding: 'utf8',
    env: {
      ...process.env,
      REPO_ROOT: dir,
      KICKOFF_PORTABILITY_WARN_ONLY: warnOnly,
    },
  });
  return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

describe('check-kickoff-portability.sh — D5 paired-negative contract', () => {
  it('NEGATIVE (enforce) — in-flight umbrella with UNTRACKED kickoff → exit 1 + ❌ (KICKOFF_PORTABILITY_WARN_ONLY=false)', (ctx) => {
    // Targets the untracked-detection + enforce branch (WARN_ONLY=false → exit 1).
    const dir = makeRepo();
    writeKickoff(dir, 'inflight-umbrella'); // NOT git add-ed
    const r = run(ctx, dir, 'false');
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('inflight-umbrella');
    expect(r.stderr).toContain('❌ kickoff not portable');
  });

  it('POSITIVE (enforce) — once `git add`-ed, the same umbrella PASSES → exit 0 + ✅', (ctx) => {
    // Paired positive: only difference is the kickoff is now tracked (git ls-files lists it).
    const dir = makeRepo();
    const rel = writeKickoff(dir, 'inflight-umbrella');
    execSync(`git add "${rel}"`, { cwd: dir });
    const r = run(ctx, dir, 'false');
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('✅ kickoff-portability: all in-flight kickoffs are git-tracked');
  });

  it('NEVER-TRIPS — closed umbrella (done.md present) with untracked kickoff → exit 0 even when enforcing', (ctx) => {
    // Targets the `[ -f "${dir}done.md" ] && continue` guard — closed umbrellas excluded.
    const dir = makeRepo();
    writeKickoff(dir, 'closed-umbrella'); // untracked kickoff…
    writeDone(dir, 'closed-umbrella'); // …but done.md present → never trips
    const r = run(ctx, dir, 'false');
    expect(r.status).toBe(0);
    expect(r.stderr).not.toContain('closed-umbrella');
  });

  it('WARN→FAIL FLIP (T19) — same untracked-kickoff state: warn-only → exit 0 + ⚠; enforce → exit 1', (ctx) => {
    // Proves the flip is wired (not just the default): identical state, env toggles outcome.
    const dir = makeRepo();
    writeKickoff(dir, 'flip-umbrella'); // untracked

    const warn = run(ctx, dir, 'true');
    expect(warn.status).toBe(0); // warn-only does NOT block
    expect(warn.stderr).toContain('⚠ kickoff-portability');
    expect(warn.stderr).toContain('flip-umbrella');

    const enforce = run(ctx, dir, 'false');
    expect(enforce.status).toBe(1); // same state, enforcing → blocks
  });

  it('CONSUMER NO-OP — repo without .claude/orchestrator-prompts → exit 0 (even enforcing)', (ctx) => {
    // Targets the `[ -d "$PROMPTS_DIR" ] || exit 0` consumer-safe guard.
    const dir = makeRepo(); // no orchestrator-prompts created
    const r = run(ctx, dir, 'false');
    expect(r.status).toBe(0);
  });
});
