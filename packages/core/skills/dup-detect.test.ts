/**
 * Paired-negative tests for dup-detect.sh L3 semantic dup-detect helper.
 *
 * Stage 5.A of umbrella meta-orchestrator-planner-completeness: verifies that
 * the helper correctly flags kickoff-vs-merged-PR overlap via both xref and
 * Jaccard signals, and that removing each fixture causes the expected drop.
 *
 * Principle 02 contract (both arms required):
 *   ✅ Positive: fixture present → POTENTIAL_DUPE emitted
 *   ❌ Paired-negative: fixture scrubbed → OK emitted, no POTENTIAL_DUPE
 *
 * The test MUST FAIL if dup-detect.sh is reverted to a no-op returning only OK lines.
 *
 * Seams used (env vars forwarded to the shell script):
 *   REPO_ROOT            — points to a temp fixture dir mimicking repo structure
 *   MO_GH_BIN            — path to a mock-gh script returning JSON fixture data
 *   MO_PR_WINDOW_DAYS    — controls lookback window (set to 9999 to avoid date drift)
 *   MO_JACCARD_THRESHOLD — controls Jaccard gate (default 30; seam test uses 99)
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
  chmodSync,
} from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT_REAL = resolve(HERE, '../../..');
const SCRIPT = resolve(
  REPO_ROOT_REAL,
  '.claude/skills/pipeline/helpers/dup-detect.sh',
);

// Every test here spawns the real dup-detect.sh, which walks a sandbox umbrella
// tree and shells out per umbrella (plus a mock `gh`) — multi-second runtimes are
// inherent, so the vitest 5s default is a mis-set gate rather than a signal. Run in
// isolation the cases measure 1.8-3.7s; under full-suite parallel load
// (`vitest run hooks/ skills/`, measured 2026-08-10) eight of them time out at
// 5000ms. 30_000 is the SLOW_SHELL_MS convention already used by the sibling
// shell-spawning suites (priority-score-synthetic, priority-score-skip-closed,
// done-md-completion-filter, pre-push.consumer-layout).
const SLOW_SHELL_MS = 30_000;

// ── Fixture state shared across tests ────────────────────────────────────────

let tmpRoot: string;
let promptsDir: string;
let mockGhBin: string;

/** Run dup-detect.sh with fixture env vars injected. */
function runScript(umbrella: string, extraEnv: Record<string, string> = {}): string {
  try {
    return execFileSync('bash', [SCRIPT, umbrella], {
      encoding: 'utf8',
      env: {
        ...process.env,
        REPO_ROOT: tmpRoot,
        MO_GH_BIN: mockGhBin,
        MO_PR_WINDOW_DAYS: '9999', // avoid real date cutoff in tests
        GIT_DIR: '', // prevent git ops in tmpRoot
        ...extraEnv,
      },
    }).trim();
  } catch (err: unknown) {
    // execFileSync throws when exit code != 0; return stderr+stdout for diagnosis
    const e = err as { stdout?: string; stderr?: string };
    return ((e.stdout ?? '') + (e.stderr ?? '')).trim();
  }
}

/** Write UTF-8 file, creating parent dirs as needed. */
function write(filePath: string, content: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
}

// ── Fixture setup / teardown ──────────────────────────────────────────────────

const createdDirs: string[] = [];

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'dup-detect-test-'));
  createdDirs.push(tmpRoot);
  promptsDir = join(tmpRoot, '.claude', 'orchestrator-prompts');
  mkdirSync(promptsDir, { recursive: true });

  // Default mock-gh: returns one merged PR #205 "F.3 UX implementation"
  const binDir = join(tmpRoot, 'bin');
  mkdirSync(binDir, { recursive: true });
  mockGhBin = join(binDir, 'mock-gh');
  write(
    mockGhBin,
    [
      '#!/usr/bin/env bash',
      'echo \'[{"number":205,"title":"F.3 UX implementation"}]\'',
    ].join('\n'),
  );
  chmodSync(mockGhBin, 0o755);
});

afterEach(() => {
  for (const d of createdDirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
});

// ── Test 1: POS xref — kickoff mentions #205 explicitly ─────────────────────

describe('dup-detect.sh — Test 1: POS xref', { timeout: SLOW_SHELL_MS }, () => {
  it('kickoff containing "PR #205" → POTENTIAL_DUPE with basis=xref', () => {
    write(
      join(promptsDir, 'test-xref', 'kickoff.md'),
      '# Kickoff\n\n> **Origin:** supersedes PR #205 which shipped partial work.\n\n## § scope\n\n- fix remaining items\n',
    );
    const out = runScript('test-xref');
    expect(out).toContain('POTENTIAL_DUPE:');
    expect(out).toContain('#205');
    expect(out).toContain('basis=xref');
    expect(out).not.toContain('OK:');
  });
});

// ── Test 2: POS jaccard — high-overlap tokens ─────────────────────────────────

describe('dup-detect.sh — Test 2: POS jaccard', { timeout: SLOW_SHELL_MS }, () => {
  it('kickoff with overlapping tokens → POTENTIAL_DUPE with basis=jaccard', () => {
    // mock-gh returns PR with title containing tokens that will overlap with kickoff §headers
    write(
      mockGhBin,
      [
        '#!/usr/bin/env bash',
        'echo \'[{"number":300,"title":"feat: planner decomposition heuristics skill assignment"}]\'',
      ].join('\n'),
    );
    chmodSync(mockGhBin, 0o755);

    write(
      join(promptsDir, 'test-jaccard', 'kickoff.md'),
      [
        '# Kickoff',
        '',
        '## § scope',
        '',
        '- decomposition heuristics for planner',
        '- skill assignment logic',
        '- heuristic evaluation',
        '',
      ].join('\n'),
    );
    const out = runScript('test-jaccard');
    expect(out).toContain('POTENTIAL_DUPE:');
    expect(out).toContain('basis=jaccard');
    expect(out).toContain('score=');
    expect(out).not.toContain('OK:');
  });
});

// ── Test 3: NEG paired with Test 1 — #205 ref removed ───────────────────────

describe('dup-detect.sh — Test 3: NEG xref (paired with Test 1)', { timeout: SLOW_SHELL_MS }, () => {
  it('kickoff without #205 reference + no token overlap → OK line, no POTENTIAL_DUPE', () => {
    write(
      join(promptsDir, 'test-neg-xref', 'kickoff.md'),
      '# Kickoff\n\n## § scope\n\n- unrelated task with totally different vocabulary\n- nothing about F3\n',
    );
    const out = runScript('test-neg-xref');
    expect(out).toContain('OK:');
    expect(out).not.toContain('POTENTIAL_DUPE:');
  });
});

// ── Test 4: NEG paired with Test 2 — tokens scrubbed below threshold ──────────

describe('dup-detect.sh — Test 4: NEG jaccard threshold (paired with Test 2)', { timeout: SLOW_SHELL_MS }, () => {
  it('kickoff with scrubbed tokens → OK line when threshold not met', () => {
    write(
      mockGhBin,
      [
        '#!/usr/bin/env bash',
        'echo \'[{"number":300,"title":"feat: planner decomposition heuristics skill assignment"}]\'',
      ].join('\n'),
    );
    chmodSync(mockGhBin, 0o755);

    // Kickoff has NO overlap with PR title tokens (all different words)
    write(
      join(promptsDir, 'test-neg-jaccard', 'kickoff.md'),
      [
        '# Kickoff',
        '',
        '## § scope',
        '',
        '- completely unrelated topic about something else entirely',
        '- nothing here matches merged pull request title words',
        '',
      ].join('\n'),
    );
    const out = runScript('test-neg-jaccard');
    expect(out).toContain('OK:');
    expect(out).not.toContain('POTENTIAL_DUPE:');
  });
});

// ── Test 5: NEG fail-soft — gh unavailable ────────────────────────────────────

describe('dup-detect.sh — Test 5: NEG fail-soft gh unavailable', { timeout: SLOW_SHELL_MS }, () => {
  it('gh returns exit-1 → PR-based signals skipped, script continues + exit code 0', () => {
    // Replace mock-gh with one that exits 1
    write(mockGhBin, '#!/usr/bin/env bash\nexit 1\n');
    chmodSync(mockGhBin, 0o755);

    write(
      join(promptsDir, 'test-fail-soft', 'kickoff.md'),
      '# Kickoff\n\n## § scope\n\n- some task\n',
    );
    const out = runScript('test-fail-soft');
    // New contract: gh failure no longer early-exits. The "(gh unavailable …)" note
    // goes to stderr; stdout still carries the normal per-umbrella line so the
    // gh-independent deliverable check (Signal 3) can run. Here GIT_DIR is nulled so
    // Signal 3 finds nothing → OK line. (Was: stdout "dup-detect skipped" + early exit.)
    expect(out).toContain('OK:');
    expect(out).not.toContain('POTENTIAL_DUPE:');
    // The script must still exit 0 on gh failure
    // We verify this by running via shell and checking exit
    let exitCode = 0;
    try {
      execFileSync('bash', [SCRIPT, 'test-fail-soft'], {
        encoding: 'utf8',
        env: {
          ...process.env,
          REPO_ROOT: tmpRoot,
          MO_GH_BIN: mockGhBin,
          MO_PR_WINDOW_DAYS: '9999',
          GIT_DIR: '',
        },
      });
    } catch {
      exitCode = 1;
    }
    expect(exitCode).toBe(0);
  });
});

// ── Test 6: NEG missing kickoff ───────────────────────────────────────────────

describe('dup-detect.sh — Test 6: NEG missing kickoff', { timeout: SLOW_SHELL_MS }, () => {
  it('umbrella dir has no kickoff.md → MISSING: line, exit 0', () => {
    // Create dir but NO kickoff.md
    mkdirSync(join(promptsDir, 'test-missing'), { recursive: true });
    const out = runScript('test-missing');
    expect(out).toContain('MISSING:');
    expect(out).not.toContain('POTENTIAL_DUPE:');
  });
});

// ── Test 7: --all smoke — two umbrellas, one POS one NEG ─────────────────────

describe('dup-detect.sh — Test 7: --all smoke', { timeout: SLOW_SHELL_MS }, () => {
  it('--all with two umbrellas emits POTENTIAL_DUPE for xref-one and OK for clean-one', () => {
    // Umbrella 1: mentions #205 → POTENTIAL_DUPE
    write(
      join(promptsDir, 'alpha-xref', 'kickoff.md'),
      '# Kickoff\n\n> supersedes PR #205.\n\n## § scope\n\n- task items\n',
    );
    // Umbrella 2: no overlap → OK
    write(
      join(promptsDir, 'beta-clean', 'kickoff.md'),
      '# Kickoff\n\n## § scope\n\n- completely unrelated topic with different vocabulary\n',
    );

    const out = runScript('--all');
    // alpha-xref must flag
    expect(out).toContain('POTENTIAL_DUPE:');
    expect(out).toContain('#205');
    // beta-clean must be OK
    expect(out).toContain('OK:');
    expect(out).toContain('beta-clean');
  });
});

// ── Test 8: Threshold seam — MO_JACCARD_THRESHOLD=99 suppresses jaccard hits ─

describe('dup-detect.sh — Test 8: MO_JACCARD_THRESHOLD seam', { timeout: SLOW_SHELL_MS }, () => {
  it('MO_JACCARD_THRESHOLD=99 suppresses jaccard matches that would fire at 30', () => {
    write(
      mockGhBin,
      [
        '#!/usr/bin/env bash',
        'echo \'[{"number":300,"title":"feat: planner decomposition heuristics skill assignment"}]\'',
      ].join('\n'),
    );
    chmodSync(mockGhBin, 0o755);

    write(
      join(promptsDir, 'test-threshold', 'kickoff.md'),
      [
        '# Kickoff',
        '',
        '## § scope',
        '',
        '- decomposition heuristics for planner',
        '- skill assignment logic',
        '',
      ].join('\n'),
    );
    // At threshold=30 this WOULD fire (as in Test 2); at 99 it must not
    const out = runScript('test-threshold', { MO_JACCARD_THRESHOLD: '99' });
    expect(out).toContain('OK:');
    expect(out).not.toContain('POTENTIAL_DUPE:');
  });
});

// ── Signal 3: deliverable-already-on-staging ─────────────────────────────────
//
// These tests need a REAL git ref to ls-tree, so they init a throwaway git repo
// at tmpRoot and commit a fixture research-patch. GIT_DIR is intentionally NOT
// nulled here (the other tests null it to block git ops; Signal 3 needs git).

/** Init a git repo at tmpRoot and commit the given files (path→content). */
function initGitRepo(files: Record<string, string>): void {
  const run = (args: string[]) =>
    execFileSync('git', args, { cwd: tmpRoot, encoding: 'utf8', env: { ...process.env } });
  run(['init', '-q']);
  run(['config', 'user.email', 'test@example.com']);
  run(['config', 'user.name', 'Test']);
  for (const [rel, content] of Object.entries(files)) {
    write(join(tmpRoot, rel), content);
  }
  run(['add', '-A']);
  run(['commit', '-q', '-m', 'fixture']);
}

/** Run dup-detect.sh against a real git ref (GIT_DIR left intact). */
function runScriptS3(umbrella: string, extraEnv: Record<string, string> = {}): string {
  try {
    return execFileSync('bash', [SCRIPT, umbrella], {
      encoding: 'utf8',
      env: {
        ...process.env,
        REPO_ROOT: tmpRoot,
        MO_GH_BIN: mockGhBin,
        MO_PR_WINDOW_DAYS: '9999',
        MO_DELIVERABLE_REF: 'HEAD',
        ...extraEnv,
      },
    }).trim();
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string };
    return ((e.stdout ?? '') + (e.stderr ?? '')).trim();
  }
}

describe('dup-detect.sh — Test 9: POS deliverable-on-staging (dogfood)', { timeout: SLOW_SHELL_MS }, () => {
  it('umbrella whose >=2 slug-tokens match a committed research-patch → basis=deliverable-on-staging', () => {
    // Commit the deliverable on the ref (mirrors the real 2026-05-25 mutation miss).
    initGitRepo({
      'docs/meta-factory/research-patches/2026-05-25-mutation-discipline-audit.md':
        '# mutation discipline audit\n\nfindings\n',
    });
    // Kickoff is on the working tree only (uncommitted draft) and neither cites a
    // PR# nor shares title tokens with the default mock PR (#205 "F.3 UX implementation").
    write(
      join(promptsDir, 'mutation-discipline-umbrella', 'kickoff.md'),
      '# Kickoff\n\n## § scope\n\n- close the discipline-theatre gap\n',
    );
    const out = runScriptS3('mutation-discipline-umbrella');
    expect(out).toContain('POTENTIAL_DUPE:');
    expect(out).toContain('basis=deliverable-on-staging');
    expect(out).toContain('2026-05-25-mutation-discipline-audit.md');
    expect(out).not.toContain('OK:');
  });

  it('strips -meta-launch suffix before tokenising (same deliverable still matches)', () => {
    initGitRepo({
      'docs/meta-factory/research-patches/2026-05-25-mutation-discipline-audit.md':
        '# mutation discipline audit\n',
    });
    write(
      join(promptsDir, 'mutation-discipline-umbrella-meta-launch', 'kickoff.md'),
      '# Kickoff\n\n## § scope\n\n- meta launch wrapper\n',
    );
    const out = runScriptS3('mutation-discipline-umbrella-meta-launch');
    expect(out).toContain('basis=deliverable-on-staging');
  });

  it('still fires when gh is unavailable (deliverable check is gh-independent)', () => {
    // Regression: Signal 3 uses only `git ls-tree`, not gh. A failing gh must NOT
    // early-exit the script before the deliverable check runs (the dogfood gap).
    initGitRepo({
      'docs/meta-factory/research-patches/2026-05-25-mutation-discipline-audit.md':
        '# mutation discipline audit\n',
    });
    write(
      join(promptsDir, 'mutation-discipline-umbrella', 'kickoff.md'),
      '# Kickoff\n\n## § scope\n\n- close the discipline-theatre gap\n',
    );
    // MO_GH_BIN=false → `false pr list …` exits non-zero → gh-unavailable branch.
    const out = runScriptS3('mutation-discipline-umbrella', { MO_GH_BIN: 'false' });
    expect(out).toContain('basis=deliverable-on-staging');
  });
});

describe('dup-detect.sh — Test 10: NEG deliverable-on-staging (paired with Test 9)', { timeout: SLOW_SHELL_MS }, () => {
  it('umbrella with no matching committed deliverable → no deliverable-on-staging signal', () => {
    // Same committed file, but the umbrella shares <2 significant tokens with it.
    initGitRepo({
      'docs/meta-factory/research-patches/2026-05-25-mutation-discipline-audit.md':
        '# mutation discipline audit\n',
    });
    write(
      join(promptsDir, 'widget-rendering-umbrella', 'kickoff.md'),
      '# Kickoff\n\n## § scope\n\n- unrelated widget rendering work\n',
    );
    const out = runScriptS3('widget-rendering-umbrella');
    expect(out).not.toContain('deliverable-on-staging');
    // No other signal fires either (no #205 xref, no title-token overlap) → OK.
    expect(out).toContain('OK:');
  });

  it('single shared token is below the >=2 floor → no deliverable-on-staging signal', () => {
    // Filename shares ONLY "mutation" with the umbrella (discipline absent) → 1 token.
    initGitRepo({
      'docs/meta-factory/research-patches/2026-05-12-wave-9-2-stryker-mutation-audit.md':
        '# stryker mutation audit\n',
    });
    write(
      join(promptsDir, 'mutation-discipline-umbrella', 'kickoff.md'),
      '# Kickoff\n\n## § scope\n\n- discipline gap\n',
    );
    const out = runScriptS3('mutation-discipline-umbrella');
    expect(out).not.toContain('deliverable-on-staging');
  });
});

// ── Test 11: MO_UMBRELLA_SUBSET seam (Caller A skip-closed opt-in) ───────────
//
// AC-3 of pipeline-completion-scan-skip-closed: dup-detect must scan ONLY the
// provided subset when MO_UMBRELLA_SUBSET is set (Caller A), and scan ALL umbrellas
// when it is unset (Caller B / plain --all — behaviour unchanged). dup-detect stays
// closure-agnostic: it does not decide what is "closed", it scans the names handed in.

describe('dup-detect.sh — Test 11: MO_UMBRELLA_SUBSET seam (paired-negative)', { timeout: SLOW_SHELL_MS }, () => {
  it('POSITIVE: --all with MO_UMBRELLA_SUBSET scans ONLY the named subset', () => {
    // Three umbrellas with unrelated vocab (all → OK lines). With the subset set to
    // alpha+gamma, beta must NOT be scanned (its line is absent from output).
    for (const n of ['subset-alpha', 'subset-beta', 'subset-gamma']) {
      write(
        join(promptsDir, n, 'kickoff.md'),
        `# Kickoff\n\n## § scope\n\n- unrelated topic with distinct vocabulary for ${n}\n`,
      );
    }
    const out = runScript('--all', {
      MO_UMBRELLA_SUBSET: 'subset-alpha\nsubset-gamma',
    });
    expect(out).toContain('subset-alpha');
    expect(out).toContain('subset-gamma');
    // beta excluded from the subset → never scanned → absent from output
    expect(out).not.toContain('subset-beta');
  });

  it('PAIRED-NEGATIVE: --all WITHOUT MO_UMBRELLA_SUBSET scans ALL umbrellas (Caller B unchanged)', () => {
    for (const n of ['subset-alpha', 'subset-beta', 'subset-gamma']) {
      write(
        join(promptsDir, n, 'kickoff.md'),
        `# Kickoff\n\n## § scope\n\n- unrelated topic with distinct vocabulary for ${n}\n`,
      );
    }
    const out = runScript('--all'); // no MO_UMBRELLA_SUBSET → full glob
    expect(out).toContain('subset-alpha');
    expect(out).toContain('subset-beta');
    expect(out).toContain('subset-gamma');
  });
});

// ── T15 recursive self-application + script structure check ──────────────────

describe('dup-detect.sh — T15 self-application documentation', { timeout: SLOW_SHELL_MS }, () => {
  it('script exists, is executable, contains required markers and seam vars', () => {
    expect(existsSync(SCRIPT)).toBe(true);
    const src = readFileSync(SCRIPT, 'utf8');
    // Seam markers
    expect(src).toContain('MO_GH_BIN');
    expect(src).toContain('MO_PR_WINDOW_DAYS');
    expect(src).toContain('MO_JACCARD_THRESHOLD');
    expect(src).toContain('MO_DELIVERABLE_REF');
    expect(src).toContain('MO_DELIVERABLE_DIRS');
    expect(src).toContain('MO_UMBRELLA_SUBSET');
    expect(src).toContain('REPO_ROOT');
    // Dual-implementation marker
    expect(src).toContain('@cc-only-rationale');
    // Both output-format strings
    expect(src).toContain('POTENTIAL_DUPE:');
    expect(src).toContain('OK:');
    // All three signal labels
    expect(src).toContain('basis=xref');
    expect(src).toContain('basis=jaccard');
    expect(src).toContain('basis=deliverable-on-staging');
  });
});

// ── Perf-regression structural guard ─────────────────────────────────────────
//
// The whole reason this helper exists in its current form is a performance property:
// `/pipeline` no-arg overran a 120s harness `!`-fence because check_umbrella ran an
// O(umbrellas × deliverables/PRs) subshell storm (per-deliverable `comm -12 <(...)` +
// per-PR `comm`/`sort`/`tok_stdin`). That was replaced by ONE awk pass per signal over
// indexes precomputed ONCE (precompute_prs + _DELIV_INDEX). Every OTHER test here asserts
// only STDOUT — so a revert to the comm/sort/grep chain would be byte-identical output and
// keep them all green while silently reintroducing the ~469s timeout (verified by the
// completeness reviewer: a `sleep 0.3` per umbrella left output identical and all tests
// passing). Per the project thesis "documents lie; tests don't", a load-bearing perf
// property with no executable guard is the armed-but-not-fired gap this block closes.
//
// A wall-clock assertion is deliberately avoided (CI-runner variance → flake; cf. the
// priority-score-skip-closed.test.ts precedent, which guards its sibling 446s→76s
// optimisation by MECHANISM, not by timing). This guard pins the mechanism structurally:
// the awk passes + the once-only precomputes must stay, and the per-item `comm` storm must
// not return. Non-vacuous: the pre-fix script (HEAD~2) contained `comm -12` and no
// precompute_prs, so this block would have been RED on it.
describe('dup-detect.sh — perf-regression structural guard (anti-revert to the O(n²) subshell storm)', { timeout: SLOW_SHELL_MS }, () => {
  it('keeps the once-only precomputes and the awk intersection passes; forbids the per-item comm storm', () => {
    const src = readFileSync(SCRIPT, 'utf8');

    // Once-only precompute mechanism must remain (a revert re-tokenising per umbrella/PR
    // would drop these). PR facts parsed once; deliverable "PATH<TAB>TOKEN" index built once.
    expect(src).toContain('precompute_prs');
    expect(src).toContain('_DELIV_INDEX');

    // The two hot loops must stay awk-based. These literals are the intersection kernels:
    //  - Signal 2 jaccard score = floor(100·|A∩B|/|A∪B|) computed in awk;
    //  - Signal 3 deliverable overlap counted per path in awk (>=2 floor).
    expect(src).toMatch(/int\(100 \* ic \/ uc\)/); // Signal 2 awk score kernel
    expect(src).toMatch(/c\[ord\[k\]\] >= 2/); //     Signal 3 awk overlap kernel

    // The per-item `comm -12 <(...)` intersection — the exact O(umbrellas × items) storm
    // the awk passes replaced — must NOT reappear anywhere in the script. A revert to it is
    // output-identical but catastrophic at runtime, so this is the load-bearing assertion.
    expect(src).not.toMatch(/comm\s+-12/);
  });
});
