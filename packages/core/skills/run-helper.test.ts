/**
 * Paired-negative tests for run-helper.sh — the bg-helper completion barrier.
 *
 * run-helper.sh runs a target helper as a child and ALWAYS appends a terminal
 * trailer `=== <name>: END rc=<n> (lines=<m>) ===` to stdout, so a session
 * reading the helper's output in the background can distinguish "finished
 * (rc=N)" from "still running / crashed". The trailer is appended by the parent
 * wrapper, so it fires even when the child exits non-zero or dies mid-output.
 *
 * Principle 02 contract (both arms required):
 *   ✅ Positive: clean child (exit 0) → stdout verbatim + `rc=0` trailer + wrapper exit 0
 *   ❌ Paired-negative: child exits non-zero / crashes mid-output → trailer STILL
 *      present with the REAL non-zero rc, AND the wrapper propagates that non-zero
 *      exit (the load-bearing case).
 *
 * T-BGB-A guard (per kickoff §5): the `END rc=0` trailer proves the child
 * FINISHED + its exit code — NOT that its work was semantically complete. These
 * tests assert completion-signal + exit-propagation only, never content-completeness.
 *
 * The test MUST FAIL if run-helper.sh is reverted to a shape that (a) swallows the
 * trailer on child failure, or (b) lets the wrapper's own trailer echo clobber the
 * child's exit status.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, chmodSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const WRAPPER = resolve(
  REPO_ROOT,
  '.claude/skills/pipeline/helpers/run-helper.sh',
);

const tmpDirs: string[] = [];

/** Write an inline fixture helper script and return its path. */
function fixtureScript(body: string): string {
  const tmp = mkdtempSync(join(tmpdir(), 'run-helper-'));
  tmpDirs.push(tmp);
  const path = join(tmp, 'child.sh');
  writeFileSync(path, `#!/usr/bin/env bash\n${body}\n`, 'utf8');
  chmodSync(path, 0o755);
  return path;
}

/** Run the wrapper against a child + args; return exit status + stdout. */
function run(child: string, ...args: string[]) {
  const r = spawnSync('bash', [WRAPPER, child, ...args], { encoding: 'utf8' });
  return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

afterEach(() => {
  while (tmpDirs.length) rmSync(tmpDirs.pop()!, { recursive: true, force: true });
});

// Every case here spawns the real run-helper.sh and does real filesystem/git work in a
// sandbox — multi-second runtimes are inherent, so the vitest 5s default is a mis-set
// gate rather than a signal, not a budget these tests were ever meant to meet. Measured
// 2026-08-10 (`vitest run skills/`, macOS): the untimed cases below time out at 5000ms
// while the underlying script succeeds. 30_000 is the SLOW_SHELL_MS convention already
// used by the sibling shell-spawning suites (dup-detect, create-worktree,
// priority-score-synthetic), applied here per the #1363 precedent.
const SLOW_SHELL_MS = 30_000;

describe('run-helper.sh — bg-helper completion barrier', { timeout: SLOW_SHELL_MS }, () => {
  it('positive: clean child → stdout verbatim, rc=0 trailer, wrapper exit 0', () => {
    const child = fixtureScript("printf 'hello\\nworld\\n'\nexit 0");
    const r = run(child);

    // (a) child stdout appears verbatim, before the trailer
    expect(r.stdout).toContain('hello\nworld\n');
    // (b) trailer line with the basename, rc=0 and the forwarded line count (2)
    expect(r.stdout).toMatch(/^=== child\.sh: END rc=0 \(lines=2\) ===$/m);
    // (c) wrapper propagates the clean exit status (downstream asserts toBe(0))
    expect(r.status).toBe(0);
  });

  it('paired-negative: child prints partial output then exits 1 → trailer STILL present with real rc, wrapper propagates non-zero', () => {
    // Child emits one line, then fails — the whole point: the trailer must fire
    // from the PARENT even though the child never reached a clean end.
    const child = fixtureScript("printf 'partial\\n'\nexit 1");
    const r = run(child);

    // (a) the trailer is STILL present despite the child failing
    expect(r.stdout).toMatch(/^=== child\.sh: END rc=1 \(lines=1\) ===$/m);
    // (b) the trailer shows the REAL non-zero code (rc=1), not a swallowed 0.
    //     This is completion + exit-code signal ONLY — NOT a claim the child's
    //     work was semantically complete (T-BGB-A).
    expect(r.stdout).toContain('rc=1');
    // (c) the wrapper propagates the non-zero exit — must NOT be clobbered to 0
    //     by the trailer echo (HARD CONSTRAINT 1: exit-propagation).
    expect(r.status).not.toBe(0);
    expect(r.status).toBe(1);
  });

  it('paired-negative: child dies mid-output via SIGKILL → trailer STILL present, wrapper propagates non-zero', () => {
    // Crash-mid-output variant: a per-script `echo END` would never fire here;
    // the parent wrapper's trailer must fire regardless.
    const child = fixtureScript("printf 'before-crash\\n'\nkill -9 \"$$\"");
    const r = run(child);

    // trailer present at all (rc reflects the signal death, non-zero)
    expect(r.stdout).toMatch(/=== child\.sh: END rc=\d+ \(lines=\d+\) ===/);
    expect(r.status).not.toBe(0);
  });

  it('trailer is `=== `-prefixed so the candidate parser filter strips it (parse-safety, HARD CONSTRAINT 4)', () => {
    const child = fixtureScript("printf 'x\\n'\nexit 0");
    const r = run(child);
    const trailer = r.stdout.split('\n').find((l) => /END rc=/.test(l)) ?? '';
    // Mirrors classify-each-candidate.sh:52 `awk '... && !/^=== /'` — the filter
    // drops any line starting with `=== `, so the trailer can never become a
    // spurious candidate.
    expect(trailer.startsWith('=== ')).toBe(true);
  });
});
