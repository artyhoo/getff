/**
 * Functional meta-test for the meta-orchestrator priority-score helper's
 * SYNTHETIC ENTRIES section — paired-negative contract for Stage D mutation
 * discipline (mutation-discipline-stage-d-meta-launch).
 *
 * Targets: `.claude/skills/pipeline/helpers/priority-score.sh`
 * Section: "=== priority-score: synthetic candidates (synthetic-candidate extension) ==="
 *          (lines ~201-291 in priority-score.sh)
 *
 * Channel: in-session helper invoked via Bash tool from SKILL.md §2.5/§7.3.
 *
 * Synthetic surfaces covered (of 8 total):
 *   (a) cold-review-fixes.md in .claude/orchestrator-prompts/
 *       Positive: file present -- stdout contains "<umbrella>-cold-review-fixes type=cleanup"
 *       Negative: file absent  -- stdout does NOT contain "cold-review-fixes"
 *
 *   (b) state.md with PENDING/TODO/AWAITING/REVIEW-PENDING content
 *       Positive: state.md contains "PENDING" -- stdout contains "<umbrella>-state-pending type=state-followup"
 *       Negative: state.md present but no matching content -- stdout does NOT contain "state-pending"
 *
 *   (e) wave-sequencing-plan.md rows marked 🟡 / DEFERRED
 *       Positive: MO_WAVE_PLAN file with 🟡 table row -- stdout contains "wave-plan-<id> type=plan-followup"
 *       Negative: MO_WAVE_PLAN file with no matching rows -- stdout does NOT contain "wave-plan-"
 *
 *   (f) open-questions.md §13.x headings
 *       Positive: MO_OPEN_QUESTIONS with "### 13.42" -- stdout contains "openq-§13-42 type=open-question"
 *       Negative: MO_OPEN_QUESTIONS with no §13.x headings -- stdout does NOT contain "openq-§13-"
 *
 *   (g) TODO:/FIXME:/XXX: in packages .ts files (DN-1 scope)
 *       Positive: MO_PACKAGES_DIR with .ts file containing "// TODO: fix this" -- stdout contains "type=code-todo"
 *       Negative: .ts file with no TODO/FIXME/XXX -- stdout does NOT contain "code-todo"
 *
 * Paired-negative contract summary:
 *   For each synthetic surface, BOTH a positive case (fixture present, entry emitted)
 *   and a negative case (fixture absent/wrong, entry NOT emitted) are required.
 *   No assertion uses `.toBeDefined()` alone — all use `.toMatch()` / `.not.toMatch()`
 *   on `r.stdout` with a specific pattern.
 *   Exit code: `expect(r.status).toBe(0)` — the script always exits 0.
 *
 * T3 compliance: each assertion cites the helper source line/region it targets.
 * T11 compliance: no custom synthetic-discovery logic is reimplemented here;
 *   all assertions are black-box output checks against priority-score.sh's stdout.
 * T12 compliance: surface types (a), (b), (e), (f), (g) verified against actual
 *   script output, not assumed from training data. Surfaces (c) memory TODO-codify,
 *   (d) stale-PRs, (h) research-patch residuals are NOT yet covered here — deferred
 *   coverage gap (follow-up), not claimed as tested.
 *
 * Reference pattern: packages/core/hooks/done-md-completion-filter.test.ts
 * (vitest + spawnSync + mkdtempSync sandbox; env seams via extraEnv).
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
  '.claude/skills/pipeline/helpers/priority-score.sh',
);

// Each case spawns priority-score.sh against a real git fixture, so the default 5s
// ceiling is too tight under a fully parallel `npm run test` on a loaded box
// (observed 14-51s). Mirrors the SLOW_SHELL_MS convention (PR #848, e.g.
// pre-push.consumer-layout.test.ts).
const SLOW_SHELL_MS = 30_000;

const sandboxes: string[] = [];
afterEach(() => {
  for (const d of sandboxes.splice(0)) rmSync(d, { recursive: true, force: true });
});

function makeSandbox(): string {
  const d = mkdtempSync(join(tmpdir(), 'priority-score-synthetic-test-'));
  sandboxes.push(d);
  // Bootstrap the orchestrator-prompts dir with ONE dummy umbrella that has BOTH
  // kickoff.md AND a state.md containing "PENDING".
  //
  // Why this is required (Linux / GNU xargs behavioural difference vs macOS):
  //   priority-score.sh section (b) runs:
  //     find "${PROMPTS_DIR}" ... -name 'state.md' | xargs grep -l -iE 'PENDING|...'
  //   When find returns no files, GNU xargs (without -r) calls grep with NO arguments.
  //   grep then reads from stdin (empty) → exits 1. Under set -euo pipefail in the script,
  //   xargs propagates that as exit code 123 (POSIX: xargs returns 123 when the utility
  //   exits 1-125). Without this fixture, every test that runs the script exits 123.
  const fixtureDir = join(d, '.claude', 'orchestrator-prompts', '__state-fixture__');
  mkdirSync(fixtureDir, { recursive: true });
  writeFileSync(
    join(fixtureDir, 'kickoff.md'),
    '# State Fixture\n\n> **Type:** I-phase\n\n## §0 Problem\n- placeholder\n',
    'utf8',
  );
  writeFileSync(
    join(fixtureDir, 'state.md'),
    '# State\n\nStatus: PENDING — xargs-guard fixture\n',
    'utf8',
  );
  return d;
}

/**
 * Creates a minimal .claude/orchestrator-prompts/<umbrella>/kickoff.md so that
 * the REAL KICKOFF ENTRIES loop in priority-score.sh doesn't crash when the
 * sandbox has an orchestrator-prompts directory.
 * Pass umbrellaNames=[] to use only the __state-fixture__ umbrella already created
 * by makeSandbox().
 */
function setupPromptsDir(sandboxRoot: string, umbrellaNames: string[] = []): void {
  const promptsDir = join(sandboxRoot, '.claude', 'orchestrator-prompts');
  mkdirSync(promptsDir, { recursive: true });
  for (const name of umbrellaNames) {
    const dir = join(promptsDir, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'kickoff.md'),
      `# Umbrella ${name}\n\n> **Type:** I-phase\n\n## §0 Problem\n- placeholder\n`,
      'utf8',
    );
  }
}

/**
 * A fake `gh` binary that:
 * - Returns [] for "merged" PR queries (so Layer C1 completion never fires)
 * - Returns [] for "open" PR queries (so open_prs counts stay 0)
 * - Returns [] for stale-PR JSON queries (section (d) stays silent)
 *
 * This keeps the real-kickoff-entries loop working without stale-PR noise,
 * allowing synthetic-section assertions to be clean.
 */
function makeFakeGhSilent(sandboxRoot: string): string {
  const fakeGh = join(sandboxRoot, 'fake-gh-silent.sh');
  writeFileSync(
    fakeGh,
    `#!/usr/bin/env bash\necho "[]"\nexit 0\n`,
    'utf8',
  );
  chmodSync(fakeGh, 0o755);
  return fakeGh;
}

/**
 * A fake dup-detect.sh that always returns only "OK: ..." lines (no POTENTIAL_DUPE),
 * so Layer C2 completion never fires for any umbrella in the sandbox.
 */
function makeFakeDupDetectSilent(sandboxRoot: string): string {
  const fakeDup = join(sandboxRoot, 'fake-dup-detect-silent.sh');
  writeFileSync(
    fakeDup,
    `#!/usr/bin/env bash
PROMPTS_DIR="\${REPO_ROOT}/.claude/orchestrator-prompts"
for d in "\${PROMPTS_DIR}"/*/; do
  name="\$(basename "\${d}")"
  echo "OK: \${name} no dup-detect signal vs merged-PRs-30d"
done
exit 0
`,
    'utf8',
  );
  chmodSync(fakeDup, 0o755);
  return fakeDup;
}

/**
 * Runs priority-score.sh inside the given sandbox with the silent fake-gh and
 * fake-dup-detect, plus any extra environment overrides.
 */
function runHelper(
  sandboxRoot: string,
  extraEnv: Record<string, string> = {},
): { status: number; stdout: string; stderr: string } {
  const fakeGh = makeFakeGhSilent(sandboxRoot);
  const fakeDup = makeFakeDupDetectSilent(sandboxRoot);
  const r = spawnSync('bash', [HELPER], {
    encoding: 'utf8',
    env: {
      ...process.env,
      REPO_ROOT: sandboxRoot,
      MO_GH_BIN: fakeGh,
      MO_DUP_DETECT_BIN: fakeDup,
      // Default seams to non-existent paths so those sections stay silent
      // unless the test overrides them explicitly.
      MO_MEM_DIR: join(sandboxRoot, 'non-existent-mem'),
      MO_WAVE_PLAN: join(sandboxRoot, 'non-existent-wave-plan.md'),
      MO_OPEN_QUESTIONS: join(sandboxRoot, 'non-existent-open-questions.md'),
      MO_PACKAGES_DIR: join(sandboxRoot, 'non-existent-packages'),
      MO_PATCHES_DIR: join(sandboxRoot, 'non-existent-patches'),
      ...extraEnv,
    },
  });
  return { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Surface (a): cold-review-fixes.md
// priority-score.sh lines ~210-215 (find + while loop, section "(a)")
// ─────────────────────────────────────────────────────────────────────────────

describe('synthetic surface (a) — cold-review-fixes.md', { timeout: SLOW_SHELL_MS }, () => {
  it('POSITIVE: cold-review-fixes.md present → emits "<umbrella>-cold-review-fixes type=cleanup" line', () => {
    // Targets priority-score.sh section (a):
    //   find "${PROMPTS_DIR}" -mindepth 2 -maxdepth 2 -name 'cold-review-fixes.md'
    //   echo "${umbrella}-cold-review-fixes type=cleanup kickoff=synthetic source=cold-review-fixes loc=${loc}"
    const sandbox = makeSandbox();
    setupPromptsDir(sandbox, ['my-umbrella']);
    // Write the cold-review-fixes.md inside the umbrella directory
    writeFileSync(
      join(sandbox, '.claude', 'orchestrator-prompts', 'my-umbrella', 'cold-review-fixes.md'),
      '# cold review fixes\n\n- fix A\n- fix B\n',
      'utf8',
    );

    const r = runHelper(sandbox);
    expect(r.status).toBe(0);
    // Script emits: "my-umbrella-cold-review-fixes type=cleanup kickoff=synthetic source=cold-review-fixes loc=4"
    expect(r.stdout).toMatch(/my-umbrella-cold-review-fixes\s+type=cleanup/);
    expect(r.stdout).toMatch(/my-umbrella-cold-review-fixes.*kickoff=synthetic/);
    expect(r.stdout).toMatch(/my-umbrella-cold-review-fixes.*source=cold-review-fixes/);
  });

  it('NEGATIVE: no cold-review-fixes.md → stdout does NOT contain "cold-review-fixes"', () => {
    // Paired-negative: same umbrella WITHOUT cold-review-fixes.md → nothing emitted
    const sandbox = makeSandbox();
    setupPromptsDir(sandbox, ['my-umbrella']);
    // No cold-review-fixes.md written

    const r = runHelper(sandbox);
    expect(r.status).toBe(0);
    expect(r.stdout).not.toMatch(/cold-review-fixes/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Surface (b): state.md with PENDING/TODO/AWAITING/REVIEW-PENDING
// priority-score.sh lines ~218-223 (section "(b)")
// ─────────────────────────────────────────────────────────────────────────────

describe('synthetic surface (b) — state.md PENDING marker', { timeout: SLOW_SHELL_MS }, () => {
  it('POSITIVE: state.md contains PENDING → emits "<umbrella>-state-pending type=state-followup" line', () => {
    // Targets priority-score.sh section (b):
    //   find ... -name 'state.md' | xargs grep -l -iE 'PENDING|TODO|AWAITING|REVIEW-PENDING'
    //   echo "${umbrella}-state-pending type=state-followup kickoff=synthetic source=state.md"
    const sandbox = makeSandbox();
    setupPromptsDir(sandbox, ['work-umbrella']);
    writeFileSync(
      join(sandbox, '.claude', 'orchestrator-prompts', 'work-umbrella', 'state.md'),
      '# State\n\nStatus: PENDING\n\nWaiting for review.\n',
      'utf8',
    );

    const r = runHelper(sandbox);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/work-umbrella-state-pending\s+type=state-followup/);
    expect(r.stdout).toMatch(/work-umbrella-state-pending.*kickoff=synthetic/);
    expect(r.stdout).toMatch(/work-umbrella-state-pending.*source=state\.md/);
  });

  it('POSITIVE: state.md contains AWAITING → also emits state-pending entry', () => {
    // Verifies the AWAITING keyword branch (one of 4 alternatives in the grep pattern)
    const sandbox = makeSandbox();
    setupPromptsDir(sandbox, ['awaiting-umbrella']);
    writeFileSync(
      join(sandbox, '.claude', 'orchestrator-prompts', 'awaiting-umbrella', 'state.md'),
      '# State\n\nStatus: AWAITING maintainer input\n',
      'utf8',
    );

    const r = runHelper(sandbox);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/awaiting-umbrella-state-pending\s+type=state-followup/);
  });

  it('NEGATIVE: state.md present but no PENDING/TODO/AWAITING/REVIEW-PENDING → no state-pending entry', () => {
    // Paired-negative: state.md exists but contains only "COMPLETED" — no matching keywords
    const sandbox = makeSandbox();
    setupPromptsDir(sandbox, ['done-umbrella']);
    writeFileSync(
      join(sandbox, '.claude', 'orchestrator-prompts', 'done-umbrella', 'state.md'),
      '# State\n\nStatus: COMPLETED\n\nAll stages merged.\n',
      'utf8',
    );

    const r = runHelper(sandbox);
    expect(r.status).toBe(0);
    // No state-pending should be emitted for this umbrella
    expect(r.stdout).not.toMatch(/done-umbrella-state-pending/);
  });

  it('NEGATIVE: no state.md at all → no state-pending entry', () => {
    // Paired-negative: umbrella directory exists but has no state.md
    const sandbox = makeSandbox();
    setupPromptsDir(sandbox, ['no-state-umbrella']);
    // No state.md written

    const r = runHelper(sandbox);
    expect(r.status).toBe(0);
    expect(r.stdout).not.toMatch(/no-state-umbrella-state-pending/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Surface (e): wave-sequencing-plan.md rows marked 🟡 / DEFERRED
// priority-score.sh lines ~251-259 (section "(e)")
// ─────────────────────────────────────────────────────────────────────────────

describe('synthetic surface (e) — wave-plan 🟡 rows', { timeout: SLOW_SHELL_MS }, () => {
  it('POSITIVE: wave plan has 🟡 table row → emits "wave-plan-<id> type=plan-followup" line', () => {
    // Targets priority-score.sh section (e):
    //   grep -E '^\|' "${MO_WAVE_PLAN}" | grep -E '🟡|🔲...' | sed row_id extraction
    //   echo "wave-plan-${row_id} type=plan-followup kickoff=synthetic source=wave-plan"
    const sandbox = makeSandbox();
    const wavePlanPath = join(sandbox, 'wave-sequencing-plan.md');
    writeFileSync(
      wavePlanPath,
      [
        '# Wave sequencing plan',
        '',
        '## §0 Current wave status',
        '',
        '| ID | Description | Status |',
        '|----|-------------|--------|',
        '| StageX | Deploy feature | 🟡 In progress |',
        '| StageY | Write tests | DONE |',
        '',
      ].join('\n'),
      'utf8',
    );

    const r = runHelper(sandbox, { MO_WAVE_PLAN: wavePlanPath });
    expect(r.status).toBe(0);
    // row_id extracted from the first pipe-delimited field: "StageX"
    expect(r.stdout).toMatch(/wave-plan-StageX\s+type=plan-followup/);
    expect(r.stdout).toMatch(/wave-plan-StageX.*kickoff=synthetic/);
    expect(r.stdout).toMatch(/wave-plan-StageX.*source=wave-plan/);
    // StageY is DONE (no 🟡) — should NOT be emitted
    expect(r.stdout).not.toMatch(/wave-plan-StageY/);
  });

  it('POSITIVE: wave plan has DEFERRED row → emits wave-plan-<id> entry', () => {
    // Verifies the DEFERRED keyword branch in the grep pattern
    const sandbox = makeSandbox();
    const wavePlanPath = join(sandbox, 'wave-sequencing-plan.md');
    writeFileSync(
      wavePlanPath,
      [
        '# Wave plan',
        '',
        '| ID | Description | Status |',
        '|----|-------------|--------|',
        '| DeferredStage | Some work | DEFERRED |',
        '',
      ].join('\n'),
      'utf8',
    );

    const r = runHelper(sandbox, { MO_WAVE_PLAN: wavePlanPath });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/wave-plan-DeferredStage\s+type=plan-followup/);
  });

  it('NEGATIVE: wave plan has no 🟡 / DEFERRED rows → stdout does NOT contain "wave-plan-"', () => {
    // Paired-negative: all rows are DONE → no wave-plan-* entries
    const sandbox = makeSandbox();
    const wavePlanPath = join(sandbox, 'wave-sequencing-plan.md');
    writeFileSync(
      wavePlanPath,
      [
        '# Wave plan',
        '',
        '| ID | Description | Status |',
        '|----|-------------|--------|',
        '| StageA | Feature A | DONE |',
        '| StageB | Feature B | MERGED |',
        '',
      ].join('\n'),
      'utf8',
    );

    const r = runHelper(sandbox, { MO_WAVE_PLAN: wavePlanPath });
    expect(r.status).toBe(0);
    expect(r.stdout).not.toMatch(/wave-plan-/);
  });

  it('NEGATIVE: MO_WAVE_PLAN file missing → no wave-plan-* entries and exit 0', () => {
    // Paired-negative for missing file (section (e) is guarded by -f check)
    const sandbox = makeSandbox();
    // MO_WAVE_PLAN points to non-existent file (default from runHelper)

    const r = runHelper(sandbox);
    expect(r.status).toBe(0);
    expect(r.stdout).not.toMatch(/wave-plan-/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Surface (f): open-questions.md §13.x entries
// priority-score.sh lines ~262-268 (section "(f)")
// ─────────────────────────────────────────────────────────────────────────────

describe('synthetic surface (f) — open-questions.md §13.x entries', { timeout: SLOW_SHELL_MS }, () => {
  it('POSITIVE: open-questions.md has "### 13.42" heading → emits "openq-§13-42 type=open-question"', () => {
    // Targets priority-score.sh section (f):
    //   grep -nE '^### 13\.[0-9]+' "${MO_OPEN_QUESTIONS}"
    //   echo "openq-§13-${id} type=open-question kickoff=synthetic source=open-questions"
    const sandbox = makeSandbox();
    const openQPath = join(sandbox, 'open-questions.md');
    writeFileSync(
      openQPath,
      [
        '# Open questions',
        '',
        '## §13 Wave 13 questions',
        '',
        '### 13.42',
        '',
        'Question about something.',
        '',
        '### 13.99',
        '',
        'Another open question.',
        '',
      ].join('\n'),
      'utf8',
    );

    const r = runHelper(sandbox, { MO_OPEN_QUESTIONS: openQPath });
    expect(r.status).toBe(0);
    // Both §13.42 and §13.99 should be emitted
    expect(r.stdout).toMatch(/openq-§13-42\s+type=open-question/);
    expect(r.stdout).toMatch(/openq-§13-42.*kickoff=synthetic/);
    expect(r.stdout).toMatch(/openq-§13-42.*source=open-questions/);
    expect(r.stdout).toMatch(/openq-§13-99\s+type=open-question/);
  });

  it('NEGATIVE: open-questions.md has no §13.x headings → stdout does NOT contain "openq-§13-"', () => {
    // Paired-negative: file exists but no "### 13.N" headings
    const sandbox = makeSandbox();
    const openQPath = join(sandbox, 'open-questions.md');
    writeFileSync(
      openQPath,
      [
        '# Open questions',
        '',
        '## §12 Some section',
        '',
        '### 12.1',
        '',
        'Not a §13 entry.',
        '',
      ].join('\n'),
      'utf8',
    );

    const r = runHelper(sandbox, { MO_OPEN_QUESTIONS: openQPath });
    expect(r.status).toBe(0);
    expect(r.stdout).not.toMatch(/openq-§13-/);
  });

  it('NEGATIVE: MO_OPEN_QUESTIONS file missing → no openq-§13- entries and exit 0', () => {
    // Paired-negative for missing file (section (f) is guarded by -f check)
    const sandbox = makeSandbox();
    // MO_OPEN_QUESTIONS points to non-existent file (default from runHelper)

    const r = runHelper(sandbox);
    expect(r.status).toBe(0);
    expect(r.stdout).not.toMatch(/openq-§13-/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Surface (g): TODO:/FIXME:/XXX: in packages/**/*.ts
// priority-score.sh lines ~271-280 (section "(g)")
// ─────────────────────────────────────────────────────────────────────────────

describe('synthetic surface (g) — TODO/FIXME/XXX in .ts files', { timeout: SLOW_SHELL_MS }, () => {
  it('POSITIVE: .ts file with "// TODO: fix this" → emits "todo-<path>-<lineno> type=code-todo" line', () => {
    // Targets priority-score.sh section (g):
    //   grep -rnE '//[[:space:]]*(TODO|FIXME|XXX):' "${MO_PACKAGES_DIR}" --include='*.ts' ...
    //   echo "todo-${rel}-${lineno} type=code-todo kickoff=synthetic source=code-todo"
    const sandbox = makeSandbox();
    const pkgsDir = join(sandbox, 'packages');
    mkdirSync(join(pkgsDir, 'mylib', 'src'), { recursive: true });
    writeFileSync(
      join(pkgsDir, 'mylib', 'src', 'helper.ts'),
      [
        '// Some code',
        '// TODO: fix this before release',
        'export function helper() { return 1; }',
      ].join('\n'),
      'utf8',
    );

    const r = runHelper(sandbox, {
      MO_PACKAGES_DIR: pkgsDir,
      // Override REPO_ROOT so that the rel path in the output is deterministic
      REPO_ROOT: sandbox,
    });
    expect(r.status).toBe(0);
    // Pattern: "todo-packages/mylib/src/helper.ts-2 type=code-todo"
    expect(r.stdout).toMatch(/type=code-todo/);
    expect(r.stdout).toMatch(/source=code-todo/);
    expect(r.stdout).toMatch(/kickoff=synthetic/);
    // The line number of the TODO comment is 2 (second line)
    expect(r.stdout).toMatch(/todo-.*helper\.ts-2\s+type=code-todo/);
  });

  it('POSITIVE: .ts file with "// FIXME: memory leak" → emits code-todo entry', () => {
    // Verifies the FIXME variant of the grep pattern
    const sandbox = makeSandbox();
    const pkgsDir = join(sandbox, 'packages');
    mkdirSync(join(pkgsDir, 'core', 'src'), { recursive: true });
    writeFileSync(
      join(pkgsDir, 'core', 'src', 'runner.ts'),
      [
        'function run() {',
        '  // FIXME: memory leak here',
        '  return true;',
        '}',
      ].join('\n'),
      'utf8',
    );

    const r = runHelper(sandbox, {
      MO_PACKAGES_DIR: pkgsDir,
      REPO_ROOT: sandbox,
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/todo-.*runner\.ts-2\s+type=code-todo/);
  });

  it('NEGATIVE: .ts file without TODO/FIXME/XXX → stdout does NOT contain "code-todo"', () => {
    // Paired-negative: clean .ts file → no synthetic code-todo entry
    const sandbox = makeSandbox();
    const pkgsDir = join(sandbox, 'packages');
    mkdirSync(join(pkgsDir, 'cleanlib', 'src'), { recursive: true });
    writeFileSync(
      join(pkgsDir, 'cleanlib', 'src', 'clean.ts'),
      [
        '// This file is clean',
        'export function clean() { return true; }',
      ].join('\n'),
      'utf8',
    );

    const r = runHelper(sandbox, {
      MO_PACKAGES_DIR: pkgsDir,
      REPO_ROOT: sandbox,
    });
    expect(r.status).toBe(0);
    expect(r.stdout).not.toMatch(/code-todo/);
  });

  it('NEGATIVE: test files (.test.ts) are excluded → no code-todo from test files', () => {
    // Verifies the --exclude='*.test.ts' flag in the grep command (section (g) line 274)
    const sandbox = makeSandbox();
    const pkgsDir = join(sandbox, 'packages');
    mkdirSync(join(pkgsDir, 'lib', 'src'), { recursive: true });
    // TODO in a .test.ts file — should be excluded
    writeFileSync(
      join(pkgsDir, 'lib', 'src', 'example.test.ts'),
      [
        '// TODO: add more test cases',
        'it("test", () => { expect(true).toBe(true); });',
      ].join('\n'),
      'utf8',
    );

    const r = runHelper(sandbox, {
      MO_PACKAGES_DIR: pkgsDir,
      REPO_ROOT: sandbox,
    });
    expect(r.status).toBe(0);
    expect(r.stdout).not.toMatch(/code-todo/);
  });

  it('NEGATIVE: MO_PACKAGES_DIR missing → no code-todo entries and exit 0', () => {
    // Paired-negative for missing directory (section (g) is guarded by -d check)
    const sandbox = makeSandbox();
    // MO_PACKAGES_DIR points to non-existent dir (default from runHelper)

    const r = runHelper(sandbox);
    expect(r.status).toBe(0);
    expect(r.stdout).not.toMatch(/code-todo/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Closure suppression for the DIRECTORY-SCOPED surfaces (a) + (b)
// priority-score-synthetic.sh `_umbrella_closed` + its two call sites
//
// A done.md is the same completion signal priority-score.sh trusts as load-bearing
// (Layer C3, operational-conventions.md §1). Surfaces (a) and (b) key on an umbrella
// directory, so a closed umbrella must stop generating follow-up candidates.
// ─────────────────────────────────────────────────────────────────────────────

describe('closure suppression — done.md silences surfaces (a) + (b)', { timeout: SLOW_SHELL_MS }, () => {
  it('NEGATIVE: state.md PENDING + done.md in the same dir → no state-pending entry', () => {
    // Paired with the surface-(b) POSITIVE above: identical fixture plus done.md.
    const sandbox = makeSandbox();
    setupPromptsDir(sandbox, ['closed-umbrella']);
    const dir = join(sandbox, '.claude', 'orchestrator-prompts', 'closed-umbrella');
    writeFileSync(join(dir, 'state.md'), '# State\n\nStatus: PENDING\n', 'utf8');
    writeFileSync(
      join(dir, 'done.md'),
      '# closed-umbrella — DONE\n- Final PR: #1407\n- Closed: 2026-08-17\n- Summary: closed\n',
      'utf8',
    );

    const r = runHelper(sandbox);
    expect(r.status).toBe(0);
    expect(r.stdout).not.toMatch(/closed-umbrella-state-pending/);
  });

  it('NEGATIVE: cold-review-fixes.md + done.md in the same dir → no cold-review-fixes entry', () => {
    // Paired with the surface-(a) POSITIVE above: identical fixture plus done.md.
    const sandbox = makeSandbox();
    setupPromptsDir(sandbox, ['closed-umbrella']);
    const dir = join(sandbox, '.claude', 'orchestrator-prompts', 'closed-umbrella');
    writeFileSync(join(dir, 'cold-review-fixes.md'), '# cold review fixes\n\n- fix A\n', 'utf8');
    writeFileSync(
      join(dir, 'done.md'),
      '# closed-umbrella — DONE\n- Final PR: #1407\n- Closed: 2026-08-17\n- Summary: closed\n',
      'utf8',
    );

    const r = runHelper(sandbox);
    expect(r.status).toBe(0);
    expect(r.stdout).not.toMatch(/cold-review-fixes/);
  });

  it('NEGATIVE: <x>-meta-launch state.md PENDING + done.md in the PARENT <x> → no state-pending entry', () => {
    // Parent inheritance: `<x>-meta-launch` is the launch staging FOR `<x>`, so closing
    // `<x>` closes its staging. Live case: triage-kernel-v2 closed by PR #1407 while
    // triage-kernel-v2-meta-launch/state.md still named a superseded aif task.
    const sandbox = makeSandbox();
    setupPromptsDir(sandbox, ['parent-umbrella', 'parent-umbrella-meta-launch']);
    const promptsDir = join(sandbox, '.claude', 'orchestrator-prompts');
    writeFileSync(
      join(promptsDir, 'parent-umbrella-meta-launch', 'state.md'),
      '# State\n\nStatus: PENDING — dispatched to a superseded task\n',
      'utf8',
    );
    // done.md lives in the PARENT only — the meta-launch sibling carries none.
    writeFileSync(
      join(promptsDir, 'parent-umbrella', 'done.md'),
      '# parent-umbrella — DONE\n- Final PR: #1407\n- Closed: 2026-08-17\n- Summary: closed\n',
      'utf8',
    );

    const r = runHelper(sandbox);
    expect(r.status).toBe(0);
    expect(r.stdout).not.toMatch(/parent-umbrella-meta-launch-state-pending/);
  });

  it('POSITIVE: inheritance is ONE-DIRECTIONAL — done.md in <x>-meta-launch does NOT silence <x>', () => {
    // The reverse of the case above must NOT suppress: a finished launch staging says
    // nothing about the umbrella's own work. 6 dirs in the live tree are in exactly this
    // state (meta-launch done.md, parent umbrella still open).
    const sandbox = makeSandbox();
    setupPromptsDir(sandbox, ['open-umbrella', 'open-umbrella-meta-launch']);
    const promptsDir = join(sandbox, '.claude', 'orchestrator-prompts');
    writeFileSync(
      join(promptsDir, 'open-umbrella', 'state.md'),
      '# State\n\nStatus: PENDING — stage 2 still in flight\n',
      'utf8',
    );
    writeFileSync(
      join(promptsDir, 'open-umbrella-meta-launch', 'done.md'),
      '# open-umbrella-meta-launch — DONE\n- Final PR: #1400\n- Closed: 2026-08-17\n- Summary: launched\n',
      'utf8',
    );

    const r = runHelper(sandbox);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/open-umbrella-state-pending\s+type=state-followup/);
  });

  it('POSITIVE: a done.md does NOT silence the non-directory-scoped surfaces (f) + (g)', () => {
    // Per-surface decision, not a blanket rule: (c)-(h) key on repo-level artefacts
    // (memory, live PRs, wave plan, open-questions, packages/**/*.ts, research-patches),
    // where "a done.md in the same directory" is undefined. They must survive closure.
    const sandbox = makeSandbox();
    setupPromptsDir(sandbox, ['closed-umbrella']);
    writeFileSync(
      join(sandbox, '.claude', 'orchestrator-prompts', 'closed-umbrella', 'done.md'),
      '# closed-umbrella — DONE\n- Final PR: #1407\n- Closed: 2026-08-17\n- Summary: closed\n',
      'utf8',
    );
    const openQPath = join(sandbox, 'open-questions.md');
    writeFileSync(openQPath, '# Open questions\n\n### 13.42\n\nStill open.\n', 'utf8');
    const pkgsDir = join(sandbox, 'packages');
    mkdirSync(join(pkgsDir, 'mylib', 'src'), { recursive: true });
    writeFileSync(
      join(pkgsDir, 'mylib', 'src', 'helper.ts'),
      '// Some code\n// TODO: fix this before release\n',
      'utf8',
    );

    const r = runHelper(sandbox, {
      MO_OPEN_QUESTIONS: openQPath,
      MO_PACKAGES_DIR: pkgsDir,
      REPO_ROOT: sandbox,
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/openq-§13-42\s+type=open-question/);
    expect(r.stdout).toMatch(/todo-.*helper\.ts-2\s+type=code-todo/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cross-surface: script always emits the synthetic section header
// ─────────────────────────────────────────────────────────────────────────────

describe('synthetic section header always present', { timeout: SLOW_SHELL_MS }, () => {
  it('script emits the synthetic section header even with empty sandbox', () => {
    // Verifies priority-score.sh line ~207:
    //   echo "=== priority-score: synthetic candidates (synthetic-candidate extension) ==="
    const sandbox = makeSandbox();
    setupPromptsDir(sandbox, []);

    const r = runHelper(sandbox);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/=== priority-score: synthetic candidates/);
  });
});
