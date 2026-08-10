/**
 * Functional meta-test for the meta-orchestrator dup-detect helper's empty-arg
 * branch (.claude/skills/pipeline/helpers/dup-detect.sh) — paired-negative
 * contract for Stage 4 P4-b (meta-orch-no-arg-overview umbrella, 2026-05-28).
 *
 * Channel: in-session helper invoked via Bash tool from SKILL.md §2.5 Step 2.
 * Class C → Class A-via-companion-test (this file is the companion test).
 *
 * Paired-negative contract (Stage 4 P4-b scope = empty-arg semantics):
 *
 *   ✅ EMPTY-ARG-EQUALS-ALL: `dup-detect.sh ""` returns identical output to
 *      `dup-detect.sh --all` (silent fall-through, no Usage/exit 1)
 *   ✅ EXPLICIT-ALL: `dup-detect.sh --all` still iterates all umbrellas (regression)
 *   ✅ VALID-UMBRELLA-NAME: `dup-detect.sh <existing-name>` checks only that one
 *      umbrella (named-path branch preserved, not collapsed into --all)
 *   ❌ MISSING-UMBRELLA: `dup-detect.sh <nonexistent>` emits the existing
 *      MISSING-error path (`MISSING: <name> no kickoff.md found`), exit 0 —
 *      NOT the old `Usage:` + exit 1
 *   ❌ NO-PROMPTS-DIR: empty arg with absent .claude/orchestrator-prompts/
 *      emits `(no orchestrator-prompts dir)` and exits 0 (via --all branch)
 *
 * T3 compliance: each assertion cites the helper source line/region it targets.
 * T-M4-B compliance: asserts both exit code AND stdout marker.
 *
 * Reference pattern: packages/core/hooks/delta-write-from-state.test.ts
 * (vitest + spawnSync + mkdtempSync sandbox).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  chmodSync,
} from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HELPER = resolve(
  REPO_ROOT,
  '.claude/skills/pipeline/helpers/dup-detect.sh',
);

// Every test here spawns the real dup-detect.sh, which walks a sandbox umbrella
// tree and shells out per umbrella — multi-second runtimes are inherent, so the
// vitest 5s default is a mis-set gate rather than a signal. Run in isolation the
// cases measure 2.0-3.6s; under full-suite parallel load (`vitest run hooks/
// skills/`, measured 2026-08-10) all four time out at 5000ms. 30_000 is the
// SLOW_SHELL_MS convention already used by the sibling shell-spawning suites
// (priority-score-synthetic, priority-score-skip-closed,
// done-md-completion-filter, pre-push.consumer-layout).
const SLOW_SHELL_MS = 30_000;

const sandboxes: string[] = [];
afterEach(() => {
  for (const d of sandboxes.splice(0)) rmSync(d, { recursive: true, force: true });
});

function makeSandbox(): string {
  const d = mkdtempSync(join(tmpdir(), 'dup-detect-empty-arg-test-'));
  sandboxes.push(d);
  return d;
}

/**
 * Sets up a fake repo layout under sandboxRoot with:
 *   - .claude/orchestrator-prompts/<name>/kickoff.md per `umbrellaNames`
 *   - a fake `gh` binary that prints `[]` (empty JSON array — no merged PRs in
 *     the 30-day window, so all umbrellas resolve to `OK: ... no dup-detect signal`).
 * Returns the path to the fake gh binary (for MO_GH_BIN env).
 */
function setupRepo(sandboxRoot: string, umbrellaNames: string[]): string {
  const promptsDir = join(sandboxRoot, '.claude', 'orchestrator-prompts');
  for (const name of umbrellaNames) {
    const dir = join(promptsDir, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'kickoff.md'),
      `# Umbrella ${name}\n\n## §0 Problem\n- placeholder bullet for tok_stdin\n`,
      'utf8',
    );
  }
  const fakeGh = join(sandboxRoot, 'fake-gh.sh');
  writeFileSync(fakeGh, '#!/usr/bin/env bash\necho "[]"\nexit 0\n', 'utf8');
  chmodSync(fakeGh, 0o755);
  return fakeGh;
}

function runHelper(
  sandboxRoot: string,
  fakeGh: string,
  args: string[],
): { status: number; stdout: string; stderr: string } {
  const r = spawnSync('bash', [HELPER, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      REPO_ROOT: sandboxRoot,
      MO_GH_BIN: fakeGh,
    },
  });
  return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

describe('dup-detect.sh — empty arg = --all (paired-negative contract)', { timeout: SLOW_SHELL_MS }, () => {
  it('EMPTY-ARG-EQUALS-ALL: `dup-detect.sh ""` returns identical output to `dup-detect.sh --all`', () => {
    // Targets dup-detect.sh:70 — `if [[ -z "${ARG}" || "${ARG}" == "--all" ]]`
    // (P4-b collapse: empty arg falls through to the --all branch silently,
    // emitting one line per umbrella). Old behavior emitted Usage: + exit 1.
    const sandbox = makeSandbox();
    const fakeGh = setupRepo(sandbox, ['alpha-umbrella', 'beta-umbrella']);

    const empty = runHelper(sandbox, fakeGh, ['']);
    const explicit = runHelper(sandbox, fakeGh, ['--all']);

    expect(empty.status).toBe(0);
    expect(explicit.status).toBe(0);
    expect(empty.stdout).toBe(explicit.stdout);
    // Both must have emitted one OK line per umbrella (gh fixture returns no PRs).
    expect(empty.stdout).toMatch(/OK: alpha-umbrella no dup-detect signal/);
    expect(empty.stdout).toMatch(/OK: beta-umbrella no dup-detect signal/);
    // And critically, NOT the old error path.
    expect(empty.stdout).not.toMatch(/Usage:/);
    expect(empty.stderr).not.toMatch(/Usage:/);
  });

  it('EXPLICIT-ALL: `dup-detect.sh --all` still iterates all umbrellas (regression)', () => {
    // Targets dup-detect.sh:73 — `for d in "${PROMPTS_DIR}"/*/; do check_umbrella ...`
    // The --all branch must continue to work after the empty-arg collapse.
    const sandbox = makeSandbox();
    const fakeGh = setupRepo(sandbox, ['one-umbrella', 'two-umbrella', 'three-umbrella']);

    const r = runHelper(sandbox, fakeGh, ['--all']);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/OK: one-umbrella/);
    expect(r.stdout).toMatch(/OK: two-umbrella/);
    expect(r.stdout).toMatch(/OK: three-umbrella/);
  });

  it('VALID-UMBRELLA-NAME: `dup-detect.sh <name>` checks one umbrella only (named-path branch preserved)', () => {
    // Targets dup-detect.sh:76 — `else check_umbrella "${ARG}"; fi`. The named
    // path must NOT collapse into --all when a real umbrella name is given.
    const sandbox = makeSandbox();
    const fakeGh = setupRepo(sandbox, ['solo-umbrella', 'other-umbrella']);

    const r = runHelper(sandbox, fakeGh, ['solo-umbrella']);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/OK: solo-umbrella/);
    // The OTHER umbrella must NOT appear — confirms named-path was taken,
    // not the --all iteration.
    expect(r.stdout).not.toMatch(/other-umbrella/);
  });

  it('MISSING-UMBRELLA: `dup-detect.sh <nonexistent>` preserves original MISSING error path (not the old Usage:+exit 1)', () => {
    // Targets dup-detect.sh:39 — `if [[ ! -f "${kickoff}" ]]; then echo "MISSING: ..."`.
    // Confirms malformed-but-non-empty arg still hits the existing per-umbrella
    // MISSING path. The empty-arg → --all collapse must not change this branch.
    const sandbox = makeSandbox();
    const fakeGh = setupRepo(sandbox, ['real-umbrella']);

    const r = runHelper(sandbox, fakeGh, ['nonexistent-umbrella']);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/MISSING: nonexistent-umbrella no kickoff\.md found/);
    expect(r.stdout).not.toMatch(/Usage:/);
  });

  it('NO-PROMPTS-DIR: empty arg with absent .claude/orchestrator-prompts/ emits `(no orchestrator-prompts dir)` and exits 0', () => {
    // Targets dup-detect.sh:72 — `if [[ ! -d "${PROMPTS_DIR}" ]]; then echo "..."; exit 0`.
    // Empty arg must reach the --all branch and gracefully handle missing dir,
    // not crash and not emit the old Usage: error.
    const sandbox = makeSandbox();
    // setupRepo NOT called — no .claude/orchestrator-prompts/ on disk.
    const fakeGh = join(sandbox, 'fake-gh.sh');
    writeFileSync(fakeGh, '#!/usr/bin/env bash\necho "[]"\nexit 0\n', 'utf8');
    chmodSync(fakeGh, 0o755);

    const r = runHelper(sandbox, fakeGh, ['']);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/\(no orchestrator-prompts dir\)/);
    expect(r.stdout).not.toMatch(/Usage:/);
  });
});
