/**
 * Paired-negative tests for plan-currency-check.sh kickoff existence check behavior.
 *
 * Targets lines ~67-88 of plan-currency-check.sh: the "kickoff existence check" section.
 * The existing plan-currency-check.test.ts covers L2 reverse-currency (UNTRACKED-* entries).
 * This file exclusively covers the "kickoff: EXISTS / MISSING" output behavior — distinct
 * from the UNTRACKED-KICKOFF L2 extension covered in the sibling test file.
 *
 * Paired-negative contract (3 groups, 4 arms total):
 *
 *   Group 1 — Single-umbrella mode (UMBRELLA arg provided):
 *     POSITIVE: kickoff.md present → stdout contains "kickoff: EXISTS at ..."
 *     NEGATIVE: kickoff.md absent → stdout contains "kickoff: MISSING — ... not found"
 *
 *   Group 2 — All-umbrellas mode (no UMBRELLA arg):
 *     POSITIVE: two dirs, one has kickoff.md and one does not →
 *       stdout contains "EXISTS: has-kickoff/kickoff.md" AND "MISSING: no-kickoff/"
 *     NEGATIVE (pure negative space): no umbrella dirs → stdout has neither EXISTS: nor MISSING:
 *
 *   Group 3 — Section headers always present:
 *     Both modes always emit "=== plan-currency-check:" and "--- kickoff existence check ---"
 *     regardless of umbrella dir presence.
 *
 * T3 compliance: each assertion cites the script line/region it targets
 *   (script line numbers are approximate; they reference plan-currency-check.sh as of Stage D).
 *
 * Mutation-sanity: this test MUST FAIL if the "EXISTS"/"MISSING" output strings in
 *   plan-currency-check.sh lines 71-73 change without updating the assertions below.
 *
 * Seams used:
 *   REPO_ROOT    — temp dir mimicking repo root (controls kickoff.md presence)
 *   MO_GH_BIN   — stub returning "[]" so gh JSON sections don't block the kickoff section
 *   MO_WAVE_PLAN — temp fixture file (needed to avoid WARN about missing wave plan in L2 block)
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  chmodSync,
} from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT_REAL = resolve(HERE, '../../..');
const SCRIPT = resolve(
  REPO_ROOT_REAL,
  '.claude/skills/pipeline/helpers/plan-currency-check.sh',
);

// ── Helpers ───────────────────────────────────────────────────────────────────

const sandboxes: string[] = [];
afterEach(() => {
  for (const d of sandboxes.splice(0)) rmSync(d, { recursive: true, force: true });
});

function makeSandbox(): string {
  const d = mkdtempSync(join(tmpdir(), 'plan-kickoff-test-'));
  sandboxes.push(d);
  return d;
}

/** Write UTF-8 content to filePath, creating parent dirs as needed. */
function write(filePath: string, content: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
}

/**
 * Create a fake `gh` stub at <sandboxRoot>/bin/mock-gh that returns "[]" for any call.
 * This stubs away the open-PR and merged-PR sections so they do not produce noise.
 */
function makeFakeGh(sandboxRoot: string): string {
  const binDir = join(sandboxRoot, 'bin');
  mkdirSync(binDir, { recursive: true });
  const stubPath = join(binDir, 'mock-gh');
  writeFileSync(stubPath, '#!/usr/bin/env bash\necho "[]"\nexit 0\n', 'utf8');
  chmodSync(stubPath, 0o755);
  return stubPath;
}

/**
 * Create a minimal wave-sequencing-plan.md fixture so the L2 reverse-currency block
 * does not emit a WARN about a missing wave plan (keeps stdout clean for assertions).
 */
function makeWavePlan(sandboxRoot: string): string {
  const planPath = join(sandboxRoot, 'docs', 'meta-factory', 'wave-sequencing-plan.md');
  write(planPath, '# Wave plan (minimal fixture)\n');
  return planPath;
}

/**
 * Initialize a minimal git repository in dir so git commands inside the script
 * do not produce hard errors (fetch will fail softly — that is acceptable).
 */
function initGitRepo(dir: string): void {
  const result = spawnSync('git', ['-C', dir, 'init'], { encoding: 'utf8' });
  if (result.status !== 0) return; // git unavailable — tests rely on graceful degradation
  spawnSync('git', ['-C', dir, 'config', 'user.email', 't@t.com'], { encoding: 'utf8' });
  spawnSync('git', ['-C', dir, 'config', 'user.name', 'Test'], { encoding: 'utf8' });
}

/**
 * Run plan-currency-check.sh with injected seams.
 * umbrella: optional positional arg (empty string = no-arg / all-umbrellas mode).
 */
function runScript(
  sandboxRoot: string,
  fakeGh: string,
  wavePlanPath: string,
  umbrella = '',
  extraEnv: Record<string, string> = {},
): { status: number; stdout: string } {
  const args = umbrella ? [SCRIPT, umbrella] : [SCRIPT];
  const r = spawnSync('bash', args, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      REPO_ROOT: sandboxRoot,
      MO_GH_BIN: fakeGh,
      MO_WAVE_PLAN: wavePlanPath,
      ...extraEnv,
    },
  });
  return { status: r.status ?? -1, stdout: r.stdout ?? '' };
}

// ── Group 1: Single-umbrella mode (UMBRELLA arg provided) ─────────────────────

describe('plan-currency-check.sh kickoff existence check — single-umbrella mode', () => {
  it('POSITIVE: kickoff.md present → stdout contains "kickoff: EXISTS at ..."', () => {
    // Targets script lines ~69-72: the [[ -f "${KICKOFF_PATH}" ]] positive branch.
    // Mutation-sanity: if "EXISTS at" is removed from the echo, this assertion fails.
    const sandbox = makeSandbox();
    initGitRepo(sandbox);
    const fakeGh = makeFakeGh(sandbox);
    const wavePlan = makeWavePlan(sandbox);

    // Create the kickoff.md that the script checks
    write(
      join(sandbox, '.claude', 'orchestrator-prompts', 'my-umbrella', 'kickoff.md'),
      '# My Umbrella\n\n> **Type:** I-phase\n',
    );

    const r = runScript(sandbox, fakeGh, wavePlan, 'my-umbrella');
    // Exit 0 even when kickoff exists (script is informational)
    expect(r.status).toBe(0);
    // Script line ~71: echo "kickoff: EXISTS at .claude/orchestrator-prompts/${UMBRELLA}/kickoff.md"
    expect(r.stdout).toMatch('kickoff: EXISTS at .claude/orchestrator-prompts/my-umbrella/kickoff.md');
  });

  it('NEGATIVE: kickoff.md absent → stdout contains "kickoff: MISSING — ... not found"', () => {
    // Targets script lines ~69-73: the else branch of the kickoff existence check.
    // Mutation-sanity: if "MISSING —" is removed from the echo, this assertion fails.
    const sandbox = makeSandbox();
    initGitRepo(sandbox);
    const fakeGh = makeFakeGh(sandbox);
    const wavePlan = makeWavePlan(sandbox);

    // Do NOT create any kickoff.md — the [[ -f ]] check must handle that gracefully.
    // The orchestration home itself IS created (empty) so resolve_orch_home() takes the
    // FRAMEWORK branch: this arm pins the framework-layout message. The consumer-layout
    // counterpart lives in Group 4. Without this mkdir the resolver would fall through to
    // .ai-factory/ and the assertion below would be pinning the wrong home.
    mkdirSync(join(sandbox, '.claude', 'orchestrator-prompts'), { recursive: true });

    const r = runScript(sandbox, fakeGh, wavePlan, 'my-umbrella');
    expect(r.status).toBe(0);
    // Script line ~73: echo "kickoff: MISSING — ${_ORCH_REL}/${UMBRELLA}/kickoff.md not found"
    expect(r.stdout).toMatch('kickoff: MISSING — .claude/orchestrator-prompts/my-umbrella/kickoff.md not found');
    // Confirm positive arm did NOT fire
    expect(r.stdout).not.toMatch('kickoff: EXISTS at');
  });
});

// ── Group 2: All-umbrellas mode (no UMBRELLA arg) ─────────────────────────────

describe('plan-currency-check.sh kickoff existence check — all-umbrellas mode', () => {
  it('POSITIVE: one dir WITH kickoff.md and one dir WITHOUT → stdout contains both EXISTS: and MISSING:', () => {
    // Targets script lines ~76-87: the find + while loop that iterates all umbrella dirs.
    // Mutation-sanity: changing "EXISTS:" or "MISSING:" in the echo breaks both arms.
    const sandbox = makeSandbox();
    initGitRepo(sandbox);
    const fakeGh = makeFakeGh(sandbox);
    const wavePlan = makeWavePlan(sandbox);

    const promptsDir = join(sandbox, '.claude', 'orchestrator-prompts');
    // has-kickoff: kickoff.md present
    write(join(promptsDir, 'has-kickoff', 'kickoff.md'), '# Has Kickoff\n');
    // no-kickoff: directory exists but no kickoff.md
    mkdirSync(join(promptsDir, 'no-kickoff'), { recursive: true });

    const r = runScript(sandbox, fakeGh, wavePlan, '' /* no-arg = all-umbrellas mode */);
    expect(r.status).toBe(0);
    // Script line ~82: echo "  EXISTS: ${dir}/kickoff.md"
    expect(r.stdout).toMatch('EXISTS: has-kickoff/kickoff.md');
    // Script line ~84: echo "  MISSING: ${dir}/ (no kickoff.md)"
    expect(r.stdout).toMatch('MISSING: no-kickoff/');
  });

  it('NEGATIVE (pure negative space): no umbrella dirs at all → stdout has neither EXISTS: nor MISSING:', () => {
    // Paired-negative for Group 2: when .claude/orchestrator-prompts/ exists but is empty,
    // the find loop produces no output — no false positives.
    // Mutation-sanity: if the loop has a bug emitting output on empty dirs, this assertion fails.
    const sandbox = makeSandbox();
    initGitRepo(sandbox);
    const fakeGh = makeFakeGh(sandbox);
    const wavePlan = makeWavePlan(sandbox);

    // Create the orchestrator-prompts dir but leave it empty (no umbrella subdirs)
    mkdirSync(join(sandbox, '.claude', 'orchestrator-prompts'), { recursive: true });

    const r = runScript(sandbox, fakeGh, wavePlan, '');
    expect(r.status).toBe(0);
    // Negative-space contract: neither EXISTS: nor MISSING: should appear in stdout
    expect(r.stdout).not.toMatch(/EXISTS:/);
    expect(r.stdout).not.toMatch(/MISSING:/);
  });
});

// ── Group 3: Section headers always present ───────────────────────────────────

describe('plan-currency-check.sh kickoff existence check — section headers', () => {
  it('single-umbrella mode: section headers always present regardless of kickoff existence', () => {
    // Targets script line ~30: echo "=== plan-currency-check: ..."
    // Targets script line ~67: echo "--- kickoff existence check ---"
    // These are unconditional echoes — they must appear whether kickoff exists or not.
    const sandbox = makeSandbox();
    initGitRepo(sandbox);
    const fakeGh = makeFakeGh(sandbox);
    const wavePlan = makeWavePlan(sandbox);
    // No kickoff.md — verifying headers appear even in missing-kickoff path

    const r = runScript(sandbox, fakeGh, wavePlan, 'some-umbrella');
    expect(r.status).toBe(0);
    // Script line ~30: top-level header
    expect(r.stdout).toMatch('=== plan-currency-check:');
    // Script line ~67: kickoff section header
    expect(r.stdout).toMatch('--- kickoff existence check ---');
  });

  it('all-umbrellas mode: section headers always present even when no umbrella dirs exist', () => {
    // Same unconditional-echo contract verified for the no-arg path.
    const sandbox = makeSandbox();
    initGitRepo(sandbox);
    const fakeGh = makeFakeGh(sandbox);
    const wavePlan = makeWavePlan(sandbox);
    // Empty orchestrator-prompts dir
    mkdirSync(join(sandbox, '.claude', 'orchestrator-prompts'), { recursive: true });

    const r = runScript(sandbox, fakeGh, wavePlan, '');
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch('=== plan-currency-check:');
    expect(r.stdout).toMatch('--- kickoff existence check ---');
    // In no-arg mode, the "--- all umbrella kickoffs ---" sub-header also appears unconditionally
    // (script line ~76)
    expect(r.stdout).toMatch('--- all umbrella kickoffs ---');
  });
});

// ── Group 4: CONSUMER layout (.ai-factory/orchestrator-prompts) ───────────────
//
// Groups 1-3 above all build their sandbox under `.claude/orchestrator-prompts/` — the
// FRAMEWORK dogfood layout. That is the whole test gap: resolve_orch_home() (lib/common.sh)
// returns `.ai-factory/orchestrator-prompts` when no `.claude/orchestrator-prompts` dir
// exists (dual-implementation-discipline.md §3), and a consumer install always takes that
// branch — but no arm here ever exercised it, so hardcoded `.claude/orchestrator-prompts`
// paths inside the script were invisible to CI.
//
// Two distinct defect classes are pinned below:
//   (a) FUNCTIONAL — the no-arg `find` scanned a hardcoded `.claude/orchestrator-prompts`,
//       which does not exist in a consumer; stderr was swallowed by `2>/dev/null` so the
//       "all umbrella kickoffs" section silently rendered EMPTY even with kickoffs present.
//   (b) COSMETIC-BUT-MISLEADING — named-mode EXISTS/MISSING messages printed a
//       `.claude/orchestrator-prompts/...` path while the existence test itself used the
//       correctly-resolved home, i.e. the message named a file that does not exist.

describe('plan-currency-check.sh kickoff existence check — consumer layout (.ai-factory)', () => {
  it('POSITIVE (functional): no-arg mode lists umbrellas under .ai-factory/orchestrator-prompts', () => {
    // Targets the no-arg `find "$(resolve_orch_home)" -mindepth 1 -maxdepth 1 -type d` scan.
    // Mutation-sanity: reverting that find to a hardcoded `${REPO_ROOT}/.claude/
    // orchestrator-prompts` makes both assertions fail (find errors, stderr swallowed,
    // section renders empty) — this is the arm the framework-only sandboxes never covered.
    const sandbox = makeSandbox();
    initGitRepo(sandbox);
    const fakeGh = makeFakeGh(sandbox);
    const wavePlan = makeWavePlan(sandbox);

    // Consumer layout: .ai-factory/, and deliberately NO .claude/orchestrator-prompts
    const promptsDir = join(sandbox, '.ai-factory', 'orchestrator-prompts');
    write(join(promptsDir, 'stage6-auth', 'kickoff.md'), '# Stage 6 Auth\n');
    mkdirSync(join(promptsDir, 'stage8-polish'), { recursive: true });

    const r = runScript(sandbox, fakeGh, wavePlan, '');
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch('EXISTS: stage6-auth/kickoff.md');
    expect(r.stdout).toMatch('MISSING: stage8-polish/');
  });

  it('NEGATIVE (resolver precedence intact): .claude/ layout still wins when present', () => {
    // Paired-negative for the arm above: the fix must not invert resolve_orch_home()'s
    // precedence. With BOTH dirs present the framework dogfood home wins, so the
    // .ai-factory umbrella must NOT be listed.
    const sandbox = makeSandbox();
    initGitRepo(sandbox);
    const fakeGh = makeFakeGh(sandbox);
    const wavePlan = makeWavePlan(sandbox);

    write(
      join(sandbox, '.claude', 'orchestrator-prompts', 'framework-umbrella', 'kickoff.md'),
      '# Framework\n',
    );
    write(
      join(sandbox, '.ai-factory', 'orchestrator-prompts', 'consumer-umbrella', 'kickoff.md'),
      '# Consumer\n',
    );

    const r = runScript(sandbox, fakeGh, wavePlan, '');
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch('EXISTS: framework-umbrella/kickoff.md');
    expect(r.stdout).not.toMatch('consumer-umbrella');
  });

  it('POSITIVE (message): named mode reports the .ai-factory path it actually checked', () => {
    // Targets the named-mode EXISTS echo. Mutation-sanity: hardcoding
    // `.claude/orchestrator-prompts` in that echo makes the `not.toMatch` arm fail.
    const sandbox = makeSandbox();
    initGitRepo(sandbox);
    const fakeGh = makeFakeGh(sandbox);
    const wavePlan = makeWavePlan(sandbox);

    write(
      join(sandbox, '.ai-factory', 'orchestrator-prompts', 'stage6-auth', 'kickoff.md'),
      '# Stage 6 Auth\n',
    );

    const r = runScript(sandbox, fakeGh, wavePlan, 'stage6-auth');
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(
      'kickoff: EXISTS at .ai-factory/orchestrator-prompts/stage6-auth/kickoff.md',
    );
    expect(r.stdout).not.toMatch('.claude/orchestrator-prompts');
  });

  it('NEGATIVE (message): named mode MISSING line also names the .ai-factory path', () => {
    // Paired-negative for the arm above — the else branch of the same existence test.
    const sandbox = makeSandbox();
    initGitRepo(sandbox);
    const fakeGh = makeFakeGh(sandbox);
    const wavePlan = makeWavePlan(sandbox);
    // Consumer home exists but the named umbrella does not
    mkdirSync(join(sandbox, '.ai-factory', 'orchestrator-prompts'), { recursive: true });

    const r = runScript(sandbox, fakeGh, wavePlan, 'stage6-auth');
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(
      'kickoff: MISSING — .ai-factory/orchestrator-prompts/stage6-auth/kickoff.md not found',
    );
    expect(r.stdout).not.toMatch('kickoff: EXISTS at');
  });
});
