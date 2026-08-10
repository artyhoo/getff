/**
 * Paired-negative tests for priority-score.sh L1 discovery surface extension.
 *
 * Stage 2 of umbrella meta-orchestrator-planner-completeness: verifies that the
 * extended helper emits synthetic candidate entries for all 5 non-kickoff surface
 * types, and that removing each fixture causes only that surface's entry to drop.
 *
 * Principle 02 contract (both arms required):
 *   ✅ Positive: fixture present → synthetic entry emitted
 *   ❌ Paired-negative: fixture removed → that entry drops; others remain
 *
 * The test MUST FAIL if priority-score.sh is reverted to kickoff-only enumeration.
 *
 * Seams used (env vars forwarded to the shell script):
 *   REPO_ROOT   — points to a temp fixture dir mimicking repo structure
 *   MO_MEM_DIR  — points to a temp dir mimicking the memory directory
 *   MO_GH_BIN   — path to a mock-gh script that returns JSON fixture data
 *   MO_WAVE_PLAN — path to a temp wave-sequencing-plan.md fixture
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
  unlinkSync,
  chmodSync,
} from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT_REAL = resolve(HERE, '../../..');
const SCRIPT = resolve(
  REPO_ROOT_REAL,
  '.claude/skills/pipeline/helpers/priority-score.sh',
);
// Stage-4 split (2026-06-03): synthetic-candidate emission moved out of
// priority-score.sh into this sibling, which priority-score.sh invokes at runtime.
// The `source=<surface>` labels now live here, not in SCRIPT.
const SYNTH = resolve(
  REPO_ROOT_REAL,
  '.claude/skills/pipeline/helpers/priority-score-synthetic.sh',
);

// ── Fixture state shared across each test ────────────────────────────────────

let tmpRoot: string; // acts as REPO_ROOT for the script
let promptsDir: string; // tmpRoot/.claude/orchestrator-prompts
let memDir: string; // MO_MEM_DIR
let wavePlan: string; // MO_WAVE_PLAN path
let mockGhBin: string; // MO_GH_BIN path
let openQuestionsFile: string;     // (f) MO_OPEN_QUESTIONS path
let packagesDir: string;           // (g) MO_PACKAGES_DIR path
let patchesDir: string;            // (h) MO_PATCHES_DIR path

/** Run priority-score.sh with all fixture env vars injected. */
function runScript(extraEnv: Record<string, string> = {}): string {
  return execFileSync('bash', [SCRIPT], {
    encoding: 'utf8',
    env: {
      ...process.env,
      REPO_ROOT: tmpRoot,
      MO_MEM_DIR: memDir,
      MO_GH_BIN: mockGhBin,
      MO_WAVE_PLAN: wavePlan,
      MO_OPEN_QUESTIONS: openQuestionsFile,  // NEW (f)
      MO_PACKAGES_DIR: packagesDir,          // NEW (g)
      MO_PATCHES_DIR: patchesDir,            // NEW (h)
      // Silence git operations inside the script — tmpRoot is not a real repo
      GIT_DIR: '', // unset so `git rev-parse` falls back to `pwd`
      ...extraEnv,
    },
  }).trim();
}

/** Write a UTF-8 file to path, creating parent dirs as needed. */
function write(filePath: string, content: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
}

// ── Fixture setup / teardown ──────────────────────────────────────────────────

const createdDirs: string[] = [];

beforeEach(() => {
  // Create isolated temp fixture root
  tmpRoot = mkdtempSync(join(tmpdir(), 'mo-planner-test-'));
  createdDirs.push(tmpRoot);

  promptsDir = join(tmpRoot, '.claude', 'orchestrator-prompts');
  mkdirSync(promptsDir, { recursive: true });

  memDir = join(tmpRoot, 'memory');
  mkdirSync(memDir, { recursive: true });

  // wave-sequencing-plan.md fixture (§0 rows with 🟡/🔲 NOT blocked/DEFERRED)
  const waveDir = join(tmpRoot, 'docs', 'meta-factory');
  mkdirSync(waveDir, { recursive: true });
  wavePlan = join(waveDir, 'wave-sequencing-plan.md');
  write(
    wavePlan,
    [
      '# Wave sequencing plan',
      '',
      '## §0 — Verified status snapshot',
      '',
      '| Wave | What | Verified status | Evidence |',
      '|---|---|---|---|',
      '| N1 | done wave | ✅ DONE | PR #1 |',
      '| N2 | partial wave | 🟡 verdicts done, application pending | research |',
      '| N6b | not-blocked wave | 🔲 not started — **NOT blocked** | niche-roadmap |',
      '| M6 | deferred | **DEFERRED** — gated on consumer-side | audit umbrella |',
      '',
    ].join('\n'),
  );

  // mock-gh binary — returns a JSON array with one stale PR (updatedAt = epoch 0)
  const mockGhDir = join(tmpRoot, 'bin');
  mkdirSync(mockGhDir, { recursive: true });
  mockGhBin = join(mockGhDir, 'mock-gh');
  write(
    mockGhBin,
    [
      '#!/usr/bin/env bash',
      '# Mock gh for testing — returns a single stale PR (updatedAt epoch 0 = 1970-01-01)',
      'echo \'[{"number":99,"title":"stale PR","updatedAt":"1970-01-01T00:00:00Z"}]\'',
    ].join('\n'),
  );
  chmodSync(mockGhBin, 0o755);

  // (f) open-questions fixture
  const docsMetaDir = join(tmpRoot, 'docs', 'meta-factory');
  mkdirSync(docsMetaDir, { recursive: true });
  openQuestionsFile = join(docsMetaDir, 'open-questions.md');
  write(
    openQuestionsFile,
    [
      '# Open questions',
      '',
      '### 13.42 Some open question',
      '',
      'Some content.',
      '',
      '### 13.43 Another open question',
      '',
      'More content.',
      '',
      '### 13.44 Yet another question',
      '',
      'Even more content.',
      '',
      '### Random thing',
      '',
      'This heading is NOT §13 — must not be emitted.',
      '',
    ].join('\n'),
  );

  // (g) packages-TODO fixtures
  packagesDir = join(tmpRoot, 'packages');
  mkdirSync(join(packagesDir, 'core'), { recursive: true });
  // positive: real // TODO:
  write(join(packagesDir, 'core', 'sample-real.ts'), '// TODO: do thing\nexport const x = 1;\n');
  // positive: real // FIXME:
  write(join(packagesDir, 'core', 'sample-fixme.ts'), '// FIXME: bug\nexport const y = 2;\n');
  // negative: string literal TODO without // prefix
  write(join(packagesDir, 'core', 'sample-string-todo.ts'), "const msg = 'TODO: fixture data';\nexport { msg };\n");
  // negative: .test.ts file (must be excluded)
  write(join(packagesDir, 'core', 'sample-real.test.ts'), '// TODO: skip via .test.ts\nit("x", () => {});\n');
  // negative: node_modules (must be excluded)
  mkdirSync(join(packagesDir, 'node_modules', 'some-pkg'), { recursive: true });
  write(join(packagesDir, 'node_modules', 'some-pkg', 'index.ts'), '// TODO: ignored\nexport {};\n');

  // (h) research-patches fixtures
  patchesDir = join(tmpRoot, 'docs', 'meta-factory', 'research-patches');
  mkdirSync(patchesDir, { recursive: true });
  // positive: patch with residual sections
  write(
    join(patchesDir, '2026-05-26-sample-patch.md'),
    [
      '# Sample patch',
      '',
      '## §future',
      '',
      'Future work here.',
      '',
      '## Known residuals',
      '',
      'Some residuals here.',
      '',
    ].join('\n'),
  );
  // negative: clean patch with no residual sections
  write(
    join(patchesDir, '2026-05-26-clean-patch.md'),
    [
      '# Clean patch',
      '',
      '## §summary',
      '',
      'No residuals here.',
      '',
    ].join('\n'),
  );

  // (a) cold-review-fixes.md fixture
  const coldDir = join(promptsDir, 'test-umbrella-a');
  write(join(coldDir, 'cold-review-fixes.md'), '# Cold review fixes\n\n- FIX-1: something\n');

  // (b) state.md with PENDING fixture
  const stateDir = join(promptsDir, 'test-umbrella-b');
  write(
    join(stateDir, 'state.md'),
    '# State\n\n**Status:** PENDING — awaiting maintainer approval\n',
  );

  // (c) memory file with TODO-codify: fixture
  write(
    join(memDir, 'feedback_some_convention.md'),
    '---\nname: some-convention\n---\n\nTODO-codify: move this to .claude/rules/\n',
  );
  // Also a memory file WITHOUT TODO-codify (should not appear in output)
  write(
    join(memDir, 'feedback_clean.md'),
    '---\nname: clean-memory\n---\n\nNo codification needed.\n',
  );
});

afterEach(() => {
  for (const d of createdDirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
});

// ── POSITIVE TESTS ────────────────────────────────────────────────────────────

// Every case here spawns the real priority-score.sh and does real filesystem/git work in a
// sandbox — multi-second runtimes are inherent, so the vitest 5s default is a mis-set
// gate rather than a signal, not a budget these tests were ever meant to meet. Measured
// 2026-08-10 (`vitest run skills/`, macOS): the untimed cases below time out at 5000ms
// while the underlying script succeeds. 30_000 is the SLOW_SHELL_MS convention already
// used by the sibling shell-spawning suites (dup-detect, create-worktree,
// priority-score-synthetic), applied here per the #1363 precedent.
const SLOW_SHELL_MS = 30_000;

describe('priority-score.sh — L1 synthetic discovery surfaces (positive cases)', { timeout: SLOW_SHELL_MS }, () => {
  it('(a) cold-review-fixes.md → emits source=cold-review-fixes entry', () => {
    const out = runScript();
    expect(out).toContain('source=cold-review-fixes');
    expect(out).toContain('test-umbrella-a-cold-review-fixes');
    expect(out).toContain('type=cleanup');
    expect(out).toContain('kickoff=synthetic');
  });

  it('(b) state.md with PENDING → emits source=state.md entry', () => {
    const out = runScript();
    expect(out).toContain('source=state.md');
    expect(out).toContain('test-umbrella-b-state-pending');
    expect(out).toContain('type=state-followup');
  });

  it('(c) memory file with TODO-codify → emits source=memory entry', () => {
    const out = runScript();
    expect(out).toContain('source=memory');
    expect(out).toContain('memory-codify-feedback_some_convention');
    expect(out).toContain('type=memory-followup');
  });

  it('(c) memory file WITHOUT TODO-codify → NOT in output', () => {
    const out = runScript();
    // The clean file must NOT appear
    expect(out).not.toContain('memory-codify-feedback_clean');
  });

  it('(d) stale open PR (mock-gh returns epoch-0 updatedAt) → emits source=open-pr entry', () => {
    const out = runScript();
    expect(out).toContain('source=open-pr');
    expect(out).toContain('stale-pr-99');
    expect(out).toContain('type=stalled');
  });

  it('(e) wave-plan rows with 🟡/NOT blocked/DEFERRED → emit source=wave-plan entries', () => {
    const out = runScript();
    expect(out).toContain('source=wave-plan');
    expect(out).toContain('wave-plan-N2');
    expect(out).toContain('wave-plan-N6b');
    // DEFERRED row — M6
    expect(out).toContain('wave-plan-M6');
    expect(out).toContain('type=plan-followup');
  });

  it('(e) ✅ wave-plan row DONE is NOT included', () => {
    const out = runScript();
    // N1 is ✅ DONE — must NOT appear in synthetic output
    expect(out).not.toContain('wave-plan-N1');
  });

  it('all 5 surface types present in a single run', () => {
    const out = runScript();
    expect(out).toContain('source=cold-review-fixes');
    expect(out).toContain('source=state.md');
    expect(out).toContain('source=memory');
    expect(out).toContain('source=open-pr');
    expect(out).toContain('source=wave-plan');
  });

  it('(f) open-questions §13.x entries → emit source=open-questions entries', () => {
    const out = runScript();
    expect(out).toContain('source=open-questions');
    expect(out).toContain('openq-§13-42');
    expect(out).toContain('openq-§13-43');
    expect(out).toContain('type=open-question');
  });

  it('(f) non-§13 headings → NOT emitted', () => {
    const out = runScript();
    expect(out).not.toContain('openq-§13-Random');
    expect(out).not.toMatch(/openq-[^§]/); // namespace must always carry §
  });

  it('(g) // TODO: in packages/**/*.ts → emit source=code-todo entry', () => {
    const out = runScript();
    expect(out).toContain('source=code-todo');
    expect(out).toContain('todo-packages/core/sample-real.ts');
    expect(out).toContain('type=code-todo');
  });

  it('(g) // FIXME: also emits', () => {
    const out = runScript();
    expect(out).toContain('todo-packages/core/sample-fixme.ts');
  });

  it('(g) string literal "TODO:" without // prefix → NOT emitted', () => {
    const out = runScript();
    expect(out).not.toContain('todo-packages/core/sample-string-todo.ts');
  });

  it('(g) .test.ts files excluded → NOT emitted', () => {
    const out = runScript();
    expect(out).not.toContain('todo-packages/core/sample-real.test.ts');
  });

  it('(g) node_modules excluded → NOT emitted', () => {
    const out = runScript();
    expect(out).not.toContain('todo-packages/node_modules');
  });

  it('(h) research-patches with §future / Known residuals → emit source=research-patch-residual entries', () => {
    const out = runScript();
    expect(out).toContain('source=research-patch-residual');
    // m3 fix: assert full namespace including anchor slug (not just patch basename)
    expect(out).toMatch(/residual-2026-05-26-sample-patch-(future|known-residuals)/);
    expect(out).toContain('type=residual');
    // anchor slug discipline: § stripped, spaces→dash, lowercased
    expect(out).not.toContain('residual-2026-05-26-sample-patch-§future'); // § must be stripped
    expect(out).not.toMatch(/residual-2026-05-26-sample-patch- /); // no raw spaces
  });

  it('(h) patch without residual sections → NOT emitted', () => {
    const out = runScript();
    expect(out).not.toContain('residual-2026-05-26-clean-patch');
  });
});

// ── PAIRED-NEGATIVE TESTS (principle 02) ─────────────────────────────────────

describe('priority-score.sh — L1 paired-negative (each surface individually removed)', { timeout: SLOW_SHELL_MS }, () => {
  it('PAIRED-NEGATIVE (a): remove cold-review-fixes.md → that entry drops, others remain', () => {
    // Remove the fixture
    unlinkSync(join(promptsDir, 'test-umbrella-a', 'cold-review-fixes.md'));

    const out = runScript();
    // The cold-review-fixes entry must be gone
    expect(out).not.toContain('source=cold-review-fixes');
    // But other surfaces must still be present
    expect(out).toContain('source=state.md');
    expect(out).toContain('source=memory');
    expect(out).toContain('source=wave-plan');
  });

  it('PAIRED-NEGATIVE (b): remove state.md → that entry drops, others remain', () => {
    unlinkSync(join(promptsDir, 'test-umbrella-b', 'state.md'));

    const out = runScript();
    expect(out).not.toContain('source=state.md');
    // Others remain
    expect(out).toContain('source=cold-review-fixes');
    expect(out).toContain('source=memory');
    expect(out).toContain('source=wave-plan');
  });

  it('PAIRED-NEGATIVE (c): remove memory TODO-codify file → that entry drops, others remain', () => {
    unlinkSync(join(memDir, 'feedback_some_convention.md'));

    const out = runScript();
    expect(out).not.toContain('memory-codify-feedback_some_convention');
    // Others remain
    expect(out).toContain('source=cold-review-fixes');
    expect(out).toContain('source=state.md');
    expect(out).toContain('source=wave-plan');
  });

  it('PAIRED-NEGATIVE (d): mock-gh returns no stale PRs → source=open-pr drops, others remain', () => {
    // Replace mock-gh with one that returns empty array
    write(mockGhBin, '#!/usr/bin/env bash\necho \'[]\'\n');
    chmodSync(mockGhBin, 0o755);

    const out = runScript();
    expect(out).not.toContain('source=open-pr');
    // Others remain
    expect(out).toContain('source=cold-review-fixes');
    expect(out).toContain('source=state.md');
    expect(out).toContain('source=memory');
    expect(out).toContain('source=wave-plan');
  });

  it('PAIRED-NEGATIVE (e): wave-plan contains no 🟡/NOT blocked/DEFERRED rows → wave-plan drops, others remain', () => {
    // Replace wave-plan with only DONE rows
    write(
      wavePlan,
      [
        '# Wave sequencing plan',
        '',
        '## §0 — Verified status snapshot',
        '',
        '| Wave | What | Status |',
        '|---|---|---|',
        '| N1 | done wave | ✅ DONE |',
        '| N3 | another done | ✅ DONE |',
        '',
      ].join('\n'),
    );

    const out = runScript();
    expect(out).not.toContain('source=wave-plan');
    // Others remain
    expect(out).toContain('source=cold-review-fixes');
    expect(out).toContain('source=state.md');
    expect(out).toContain('source=memory');
  });

  it('PAIRED-NEGATIVE (f): remove open-questions §13 entries → that surface drops, others remain', () => {
    write(openQuestionsFile, '# Open questions\n\n## §1 Closed\n\n(empty)\n');
    const out = runScript();
    expect(out).not.toContain('source=open-questions');
    expect(out).toContain('source=cold-review-fixes'); // others remain
  });

  it('PAIRED-NEGATIVE (g): remove all // TODO in packages → that surface drops, others remain', () => {
    unlinkSync(join(packagesDir, 'core', 'sample-real.ts'));
    unlinkSync(join(packagesDir, 'core', 'sample-fixme.ts'));
    const out = runScript();
    expect(out).not.toContain('source=code-todo');
    expect(out).toContain('source=cold-review-fixes');
  });

  it('PAIRED-NEGATIVE (h): remove residual section → that surface drops, others remain', () => {
    write(join(patchesDir, '2026-05-26-sample-patch.md'), '# Sample patch\n\nNo residuals.\n');
    const out = runScript();
    expect(out).not.toContain('source=research-patch-residual');
    expect(out).toContain('source=cold-review-fixes');
  });
});

// ── ANTI-TAUTOLOGY CHECK ──────────────────────────────────────────────────────

describe('priority-score.sh — anti-tautology verification', { timeout: SLOW_SHELL_MS }, () => {
  it('reverted script (kickoff-only) would FAIL this test — both arms verified', () => {
    // This test documents that the positive test above would fail if the script only
    // enumerated kickoff.md entries (i.e., if L1 extension were reverted).
    // We simulate "revert" by writing a dummy state.md WITHOUT the PENDING keyword
    // into a different dir — verifying that absence of PENDING prevents emission.
    const cleanStateDir = join(promptsDir, 'test-umbrella-clean');
    write(join(cleanStateDir, 'state.md'), '# State\n\n**Status:** DONE — all clear\n');

    const out = runScript();
    // The clean state.md dir must NOT produce a state-pending entry
    expect(out).not.toContain('test-umbrella-clean-state-pending');
    // But the original PENDING one still fires
    expect(out).toContain('test-umbrella-b-state-pending');
  });

  it('synthetic namespace does NOT shadow real kickoff entries', () => {
    // Create a real kickoff.md in a new dir — its name must appear as kickoff=exists,
    // while any synthetic entry uses the <umbrella>-<reason> suffix form.
    const realDir = join(promptsDir, 'my-real-umbrella');
    write(
      join(realDir, 'kickoff.md'),
      '> **Type:** I-phase build\n\n# My Real Umbrella\n',
    );

    const out = runScript();
    // Real kickoff entry — no synthetic suffix
    expect(out).toMatch(/\bmy-real-umbrella\b.*kickoff=exists/);
    // Synthetic entries for this dir (if any sub-files match) would have suffix
    // This test documents the namespace discipline:
    expect(out).not.toMatch(/\bmy-real-umbrella\b.*kickoff=synthetic/);
  });
});

// ── T15 RECURSIVE SELF-APPLICATION NOTE ──────────────────────────────────────

describe('priority-score.sh — T15 self-application documentation', { timeout: SLOW_SHELL_MS }, () => {
  it(
    'T15 dogfood: umbrella kickoff is discoverable via real repo run ' +
      '(run manually: bash .claude/skills/pipeline/helpers/priority-score.sh | grep planner-completeness)',
    () => {
      // This test CANNOT run against the live orchestrator-prompts directory because
      // .claude/orchestrator-prompts/ is gitignored and not present in the worktree.
      // The dogfood verification is done manually (see REPORT step 5).
      // This test documents the self-application requirement per kickoff §4 + T-PC-A.
      //
      // The script IS present at SCRIPT path — verify it exists and is executable.
      expect(existsSync(SCRIPT)).toBe(true);
      expect(existsSync(SYNTH)).toBe(true);
      // priority-score.sh must wire in the synthetic extension (not kickoff-only).
      // Stage-4 split (2026-06-03) moved the synthetic emission to SYNTH, which
      // SCRIPT invokes at runtime — assert the wiring + SCRIPT-owned seams here.
      const src = readFileSync(SCRIPT, 'utf8');
      expect(src).toContain('priority-score-synthetic.sh');
      expect(src).toContain('MO_GH_BIN');
      expect(src).toContain('@cc-only-rationale');
      // The 8 synthetic `source=<surface>` labels now live in SYNTH.
      const synthSrc = readFileSync(SYNTH, 'utf8');
      expect(synthSrc).toContain('source=cold-review-fixes');
      expect(synthSrc).toContain('source=state.md');
      expect(synthSrc).toContain('source=memory');
      expect(synthSrc).toContain('source=open-pr');
      expect(synthSrc).toContain('source=wave-plan');
      expect(synthSrc).toContain('source=open-questions');
      expect(synthSrc).toContain('source=code-todo');
      expect(synthSrc).toContain('source=research-patch-residual');
    },
  );
});

// ── CONSUMER-USABLE /pipeline: agnostic .ai-factory discovery (2026-06-16) ────

describe('priority-score.sh — agnostic orch-home discovery (consumer)', { timeout: SLOW_SHELL_MS }, () => {
  it('discovers a kickoff under .ai-factory/orchestrator-prompts when .claude/ is absent (consumer)', () => {
    const repo = mkdtempSync(join(tmpdir(), 'consumer-disc-'));
    createdDirs.push(repo);
    const k = join(repo, '.ai-factory/orchestrator-prompts/demo');
    mkdirSync(k, { recursive: true });
    writeFileSync(join(k, 'kickoff.md'), 'Type: fix\n\n## §1 Sub-wave\n| A | do x |\n');
    const out = execFileSync('bash', [SCRIPT], {
      env: { ...process.env, REPO_ROOT: repo, GIT_DIR: '' },
      encoding: 'utf8',
    });
    expect(out).toContain('demo');
  });
});
