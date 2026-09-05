/**
 * Functional meta-tests for the PostToolUse authority-header gate
 * (.claude/hooks/check-doc-authority.sh) — paired-negative contract for
 * doc-authority-hierarchy.md §2 enforcement (every REQUIRED_HEADER_DOCS path
 * edited post-Edit/Write must contain "> **Authoritative for:**" in its content).
 *
 * Reference pattern: packages/core/hooks/check-hook-marker.test.ts
 * (vitest + spawnSync + tempdir sandbox + jq-availability skip).
 *
 * Paired-negative contract:
 *   ❌ a REQUIRED_HEADER_DOCS file edited WITHOUT `Authoritative for:` → exit 2
 *   ✅ same file WITH `> **Authoritative for:**` header              → exit 0
 *   ✅ a non-required file edited (e.g. packages/foo.ts)             → exit 0
 *   ✅ boundary: `Authoritative for:` appears mid-prose (not in blockquote) → exit 2
 *   ✅ boundary: `Authoritative for:` only inside fenced code block → exit 2 (stripped)
 *
 * Sandbox isolation (real-docs-overwrite hazard — same class as the 2026-07-02
 * .claude/hooks seeded-break leak, PR #844): this suite previously overwrote the
 * REAL tracked .claude/rules/doc-authority-hierarchy.md with fixture content and
 * restored it in afterEach — a killed run or two concurrent suite instances
 * interleaving overwrite/restore could leak fixture content into the tracked doc.
 * Now the hook runs against a sandbox stand-in repo root instead:
 *   - the hook resolves REPO_ROOT from its own location
 *     (check-doc-authority.sh line 11: `cd "$(dirname "$0")/../.."`), so a copy
 *     at <tmpdir>/.claude/hooks/ treats <tmpdir> as the repo root;
 *   - the hook delegates to $REPO_ROOT/packages/core/principles/
 *     09-doc-authority-hierarchy.bin.ts (line 12) and graceful-skips (exit 0)
 *     when it is absent (line 27) — so the bin AND its relative import are
 *     copied into the sandbox; a degenerate sandbox that silently skips would
 *     turn the exit-1 arms into failures, so the PAIRED-NEGATIVE test doubles
 *     as the sandbox-integrity canary;
 *   - the hook needs $REPO_ROOT/node_modules/.bin/tsx (line 13, skip at 29-31)
 *     — provided via a node_modules symlink into the real checkout;
 *   - the bin resolves doc paths from process.cwd()
 *     (09-doc-authority-hierarchy.ts line 275: `repoRoot = process.cwd()`), so
 *     runHook spawns with cwd=<tmpdir>.
 * Fixture "required docs" live only in the sandbox; the real tracked docs are
 * never written. The final tree-guard test asserts exactly that (delta-based
 * `git status --porcelain`, mirroring the PR #844 hooks-tree-guard semantics —
 * deterministic git-only, no LLM, advisory when git is unavailable).
 *
 * Spawns the sandbox copy of the real hook with fixture stdin (spawnSync).
 * Skips gracefully when `jq` is unavailable.
 *
 * T3 compliance: each assertion cites the hook source line it targets.
 * T-M4-B compliance: asserts both exit code AND stderr diagnostic text.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { execSync, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { REQUIRED_HEADER_DOCS } from '../principles/09-doc-authority-hierarchy.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const REAL_HOOK = resolve(REPO_ROOT, '.claude/hooks/check-doc-authority.sh');
const REAL_BIN = resolve(
  REPO_ROOT,
  'packages/core/principles/09-doc-authority-hierarchy.bin.ts',
);
const REAL_MODULE = resolve(
  REPO_ROOT,
  'packages/core/principles/09-doc-authority-hierarchy.ts',
);

/**
 * REQUIRED_HEADER_DOCS target for the ❌/✅ paired tests — the sandbox path the
 * hook must classify as required. Any static-list entry works; this one names
 * the very rule the hook enforces.
 * (09-doc-authority-hierarchy.ts line 38: '.claude/rules/doc-authority-hierarchy.md')
 */
const FIXTURE_REQUIRED_DOC = '.claude/rules/doc-authority-hierarchy.md';

/**
 * Real tracked paths this suite historically wrote (and their folder, in case
 * FIXTURE_REQUIRED_DOC is ever repointed at a sibling rule): guarded by the
 * final tree-guard test. CLAUDE.md was the other required-doc fixture target
 * named by the pre-sandbox isolation strategy.
 */
const GUARD_PATHSPECS = ['.claude/rules/', 'CLAUDE.md'] as const;

/**
 * Porcelain status of the guarded real paths, or null when git/checkout is
 * unavailable (advisory — mirrors PR #844 snapshotHooksTree). GIT_* env is
 * scrubbed so hook-spawned runs (relative GIT_DIR) and worktrees resolve by
 * cwd; --no-optional-locks keeps concurrent suite instances from contending
 * on the index.
 */
function snapshotGuardPaths(): string | null {
  const env = { ...process.env };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_INDEX_FILE;
  delete env.GIT_COMMON_DIR;
  try {
    return execSync(
      `git --no-optional-locks status --porcelain=v1 -- ${GUARD_PATHSPECS.join(' ')}`,
      {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env,
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    );
  } catch {
    return null;
  }
}

// Snapshot BEFORE the sandbox is built or any test runs — the guard test at the
// bottom compares against this. Delta-based, not absolute-clean: a legitimately
// dirty worktree (developer edits in flight) must not fail the suite.
const TREE_BEFORE = snapshotGuardPaths();

// Per-run sandbox mirroring the repo-root layout the hook expects. realpathSync
// so the hook's own `cd … && pwd` (physical on symlinked macOS /var →
// /private/var) and the fixture paths we pass agree on one textual prefix —
// otherwise the REL_PATH strip (check-doc-authority.sh line 23) silently
// misses and every test degenerates to the outside-repo exit 0 (line 24).
const SANDBOX = realpathSync(mkdtempSync(join(tmpdir(), 'check-doc-auth-')));
mkdirSync(join(SANDBOX, '.claude', 'hooks'), { recursive: true });
mkdirSync(join(SANDBOX, '.claude', 'rules'), { recursive: true });
mkdirSync(join(SANDBOX, 'packages', 'core', 'principles'), { recursive: true });
const HOOK = join(SANDBOX, '.claude', 'hooks', 'check-doc-authority.sh');
copyFileSync(REAL_HOOK, HOOK);
copyFileSync(
  REAL_BIN,
  join(
    SANDBOX,
    'packages',
    'core',
    'principles',
    '09-doc-authority-hierarchy.bin.ts',
  ),
);
copyFileSync(
  REAL_MODULE,
  join(
    SANDBOX,
    'packages',
    'core',
    'principles',
    '09-doc-authority-hierarchy.ts',
  ),
);
// The hook resolves tsx at $REPO_ROOT/node_modules/.bin/tsx (line 13); symlink
// the whole tree so the sandbox needs no install. Chains through the worktree
// symlink when the checkout itself symlinks node_modules.
symlinkSync(
  join(REPO_ROOT, 'node_modules'),
  join(SANDBOX, 'node_modules'),
  'dir',
);

/** Extra tempdirs created by individual tests (outside-repo fixtures). */
const extraTmpDirs: string[] = [];
/** Extra git repos created by tier tests (worktree cleanup before dir removal). */
const extraGitRepos: string[] = [];

afterAll(() => {
  for (const repo of extraGitRepos.splice(0)) {
    try { execSync(`git -C "${repo}" worktree remove --all --force 2>/dev/null`, { stdio: 'ignore' }); } catch {}
    rmSync(repo, { recursive: true, force: true });
  }
  rmSync(SANDBOX, { recursive: true, force: true });
  for (const d of extraTmpDirs.splice(0))
    rmSync(d, { recursive: true, force: true });
});

function hasJq(): boolean {
  try {
    execSync('command -v jq', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
const JQ = hasJq();

// The hook spawns $REPO_ROOT/node_modules/.bin/tsx; when it is absent the hook
// graceful-skips (exit 0) rather than running the bin, so the exit-1 assertions
// below would false-fail. The sandbox symlink points at this same tree, so the
// real checkout's tsx presence is the precondition. Skip when tsx is not
// resolvable (e.g. a worktree whose node_modules was never symlinked). CI
// installs it (root npm install), so the gate still runs there.
const TSX = existsSync(resolve(REPO_ROOT, 'node_modules/.bin/tsx'));

/**
 * Run the sandbox hook, feeding it `absPath` as tool_input.file_path.
 * Returns { status, stderr }.
 *
 * hook stdin contract: JSON with `.tool_input.file_path`
 * (check-doc-authority.sh line 19: `cat | jq -r '.tool_input.file_path // ""'`)
 *
 * cwd is set to SANDBOX so that `tsx "$BIN" "$REL_PATH"` invoked inside the
 * hook inherits a process.cwd() matching the sandbox repo root — the bin.ts
 * resolves file paths relative to process.cwd() (09-doc-authority-hierarchy.ts
 * line 275: `repoRoot: string = process.cwd()`).
 */
function runHook(
  absPath: string,
  env: Record<string, string> = {},
): { status: number; stderr: string; stdout: string } {
  // Default-scrub ZCODE_PROJECT_DIR: the runner may execute inside zcode (the framework's own
  // dev harness), which would flip _emit_ctx to the JSON branch and break the CC exit-code
  // assertions below. The ZCode-JSON case passes ZCODE_PROJECT_DIR explicitly. Mirrors
  // deps-hash-check.test.ts:106.
  const fullEnv = { ...process.env };
  if (env.ZCODE_PROJECT_DIR === undefined) delete fullEnv.ZCODE_PROJECT_DIR;
  else fullEnv.ZCODE_PROJECT_DIR = env.ZCODE_PROJECT_DIR;
  const r = spawnSync('bash', [HOOK], {
    input: JSON.stringify({
      tool_name: 'Edit',
      tool_input: { file_path: absPath },
    }),
    encoding: 'utf8',
    cwd: SANDBOX,
    env: fullEnv,
  });
  return {
    status: r.status ?? -1,
    stderr: r.stderr ?? '',
    stdout: r.stdout ?? '',
  };
}

/**
 * Write `content` to the sandbox copy of FIXTURE_REQUIRED_DOC and return its
 * absolute path. Overwrites freely — the sandbox is throwaway, nothing to
 * restore, and a killed run leaks nothing into the real tree.
 */
function writeFixtureDoc(content: string): string {
  const abs = join(SANDBOX, FIXTURE_REQUIRED_DOC);
  writeFileSync(abs, content, 'utf8');
  return abs;
}

/** Minimal content that satisfies AUTHORITY_HEADER_RE (09-doc-authority-hierarchy.ts line 15) */
const VALID_HEADER = `# Test fixture

> **Authoritative for:** test purposes only.
> **NOT authoritative for:** production use.

Some body text.
`;

/** Content WITHOUT the required blockquote marker */
const MISSING_HEADER = `# Test fixture

Some body text with no authority header.
`;

describe.skipIf(!JQ || !TSX)(
  'check-doc-authority.sh — PostToolUse authority header gate',
  () => {
    // ──────────────────────────────────────────────────────────────────────────
    // PAIRED-NEGATIVE: the core contract
    // ──────────────────────────────────────────────────────────────────────────

    it('PAIRED-NEGATIVE: REQUIRED_HEADER_DOC written WITHOUT `> **Authoritative for:**` → exit 2 + diagnostic', () => {
      // check-doc-authority.sh line 33: `"$TSX" "$BIN" "$REL_PATH"` — delegates to bin
      // 09-doc-authority-hierarchy.bin.ts line 37-42: exits 1 when violations found
      // 09-doc-authority-hierarchy.ts line 15: AUTHORITY_HEADER_RE = /^> \*\*Authoritative for:\*\*/m
      // Doubles as the sandbox-integrity canary: a mis-built sandbox trips the
      // hook's graceful skips (lines 27, 29-31) → exit 0 → this test fails loud.
      const abs = writeFixtureDoc(MISSING_HEADER);
      const { status, stderr } = runHook(abs);
      expect(status).toBe(2);
      // 09-doc-authority-hierarchy.bin.ts line 39: `process.stderr.write(\`FAIL  ${v.path}: ${v.reason}\n\`)`
      expect(stderr).toMatch(/FAIL/);
      expect(stderr).toMatch(/missing.*Authoritative for/i);
    });

    it('PAIRED-POSITIVE: same REQUIRED_HEADER_DOC WITH `> **Authoritative for:**` → exit 0', () => {
      // check-doc-authority.sh line 33: delegates to tsx "$BIN" "$REL_PATH"
      // 09-doc-authority-hierarchy.ts line 252-254: hasAuthorityHeader returns true
      // 09-doc-authority-hierarchy.bin.ts line 44-46: exits 0 with OK message on stdout
      const abs = writeFixtureDoc(VALID_HEADER);
      const { status } = runHook(abs);
      expect(status).toBe(0);
    });

    // ──────────────────────────────────────────────────────────────────────────
    // OFF-PATH skips
    // ──────────────────────────────────────────────────────────────────────────

    it('off-path: a non-REQUIRED file inside repo → exit 0', () => {
      // check-doc-authority.sh line 23: REL_PATH = strip REPO_ROOT prefix
      // 09-doc-authority-hierarchy.ts line 237-242: selectRequiredPaths returns [] for non-required paths
      // empty filtered list → 09-doc-authority-hierarchy.bin.ts line 31-33: process.exit(0) silently
      const abs = join(
        SANDBOX,
        'packages',
        'core',
        `test-tmp-check-doc-${Date.now()}.ts`,
      );
      writeFileSync(abs, '// no authority header\n', 'utf8');
      const { status } = runHook(abs);
      expect(status).toBe(0);
    });

    it('off-path: a path outside repo entirely → exit 0', () => {
      // check-doc-authority.sh line 24: `[[ "$REL_PATH" = "$ABS_PATH" ]] && exit 0`
      // When the absolute path has no REPO_ROOT (= sandbox) prefix, the bash strip
      // is a no-op so REL_PATH == ABS_PATH → early exit 0 before even reaching the bin
      const tmpDir = realpathSync(
        mkdtempSync(join(tmpdir(), 'check-doc-auth-offpath-')),
      );
      extraTmpDirs.push(tmpDir);
      const abs = join(tmpDir, 'CLAUDE.md'); // named like a required doc, but outside the sandbox repo
      writeFileSync(abs, MISSING_HEADER, 'utf8');
      const { status } = runHook(abs);
      expect(status).toBe(0);
    });

    it('off-path: empty stdin file_path → exit 0', () => {
      // check-doc-authority.sh line 20: `[[ -z "$ABS_PATH" ]] && exit 0`
      // jq -r '.tool_input.file_path // ""' on a payload without file_path key returns ""
      const r = spawnSync('bash', [HOOK], {
        input: JSON.stringify({ tool_name: 'Edit', tool_input: {} }),
        encoding: 'utf8',
        cwd: SANDBOX,
      });
      expect(r.status).toBe(0);
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Boundary: mid-prose mention does NOT satisfy the blockquote regex
    // ──────────────────────────────────────────────────────────────────────────

    it('boundary: `Authoritative for:` in mid-prose (no blockquote) → exit 2', () => {
      // 09-doc-authority-hierarchy.ts line 15: AUTHORITY_HEADER_RE = /^> \*\*Authoritative for:\*\*/m
      // Only `> **Authoritative for:**` at line-start (after `>`) matches.
      // Plain prose "Authoritative for:" does NOT match → FAIL
      const content =
        '# Test fixture\n\nThis doc is authoritative for certain things but lacks the blockquote form.\n';
      const abs = writeFixtureDoc(content);
      const { status, stderr } = runHook(abs);
      expect(status).toBe(2);
      expect(stderr).toMatch(/FAIL/);
    });

    it('boundary: `Authoritative for:` inside a fenced code block → exit 2 (stripped)', () => {
      // 09-doc-authority-hierarchy.ts line 248-250: stripFencedCodeBlocks() removes ``` blocks
      // before AUTHORITY_HEADER_RE is tested. Content inside ``` does not satisfy the check.
      const content = [
        '# Test fixture',
        '',
        'Some prose.',
        '',
        '```markdown',
        '> **Authoritative for:** inside a code block — stripped out',
        '```',
        '',
      ].join('\n');
      const abs = writeFixtureDoc(content);
      const { status, stderr } = runHook(abs);
      expect(status).toBe(2);
      expect(stderr).toMatch(/FAIL/);
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Sanity: our fixture doc IS in REQUIRED_HEADER_DOCS
    // ──────────────────────────────────────────────────────────────────────────

    it('sanity: FIXTURE_REQUIRED_DOC is actually in REQUIRED_HEADER_DOCS', () => {
      // T3: verify our fixture choice against the canonical list
      // (09-doc-authority-hierarchy.ts line 38: '.claude/rules/doc-authority-hierarchy.md')
      expect(REQUIRED_HEADER_DOCS).toContain(FIXTURE_REQUIRED_DOC);
    });

    it('ZCODE: violation under ZCODE_PROJECT_DIR → schema-valid {additionalContext} JSON, exit 0 (advisory)', () => {
      // ZCode parses hook stdout against the HookJSONOutput schema (CCt at zcode.cjs:~577900),
      // which is `.strict()` — unknown top-level keys are REJECTED (→ hook.run.failed, output
      // discarded). The ZCode branch (_emit_ctx at hook line 14-16) emits schema-valid
      // `{additionalContext}` and exits 0 — PostToolUse cannot block on ZCode (schema Uan rejects
      // permissionDecision for PostToolUse; post-mutation by definition), so the violation surfaces
      // as advisory context. Regression guard: a prior shape emitted
      // `{hookEventName, additionalContext}` at top level and was silently rejected by ZCode.
      const abs = writeFixtureDoc(MISSING_HEADER);
      const r = runHook(abs, { ZCODE_PROJECT_DIR: SANDBOX });
      expect(r.status, 'ZCode path exits 0 (advisory, non-blocking)').toBe(0);
      expect(r.stdout.trim(), 'ZCode path emits non-empty JSON').not.toBe('');
      const allowedTopLevel = new Set([
        'additionalContext',
        'additional_context',
        'continue',
        'decision',
        'hookSpecificOutput',
        'reason',
        'stopReason',
        'suppressOutput',
        'systemMessage',
      ]);
      const parsed = JSON.parse(r.stdout);
      const unknownKeys = Object.keys(parsed).filter(
        (k) => !allowedTopLevel.has(k),
      );
      expect(
        unknownKeys,
        `ZCode CCt.strict() rejects unknown top-level keys: ${unknownKeys.join(', ')}`,
      ).toEqual([]);
      expect(
        parsed.additionalContext,
        'violation text rides inside additionalContext',
      ).toContain('check-doc-authority');
      expect(
        parsed.hookEventName,
        'hookEventName must NOT be at top level (CCt.strict rejects it)',
      ).toBeUndefined();
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Tree-guard: the real tracked docs stayed untouched (runs last — vitest
    // executes tests in registration order within a file)
    // ──────────────────────────────────────────────────────────────────────────

    it('tree-guard: real tracked doc paths show no git delta after this suite', () => {
      // Regression tripwire for the pre-sandbox hazard: fixture content leaking
      // into the real .claude/rules/doc-authority-hierarchy.md / CLAUDE.md.
      // Delta vs the module-load snapshot, so pre-existing developer edits pass.
      const after = snapshotGuardPaths();
      if (TREE_BEFORE === null || after === null) return; // advisory without git
      expect(after).toBe(TREE_BEFORE);
    });
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// Dependency-missing SKIP must reach the model, not just stderr.
//
// On an exit-0 PostToolUse the model receives ONLY JSON hookSpecificOutput —
// plain stdout/stderr reaches nobody (inject-matching-rule.sh:17,89-90). So a
// stderr-only "jq unavailable — skipping" is indistinguishable from a PASS: the
// gate reads as alive in a settings audit while enforcing nothing. Observed live
// in the aif container (jq absent) on 2026-07-23 —
// docs/meta-factory/research-patches/2026-07-23-aif-parity-s4-synthesis.md §3 item 1.
// ═══════════════════════════════════════════════════════════════════════════════
describe('check-doc-authority.sh — dependency-missing skip is announced, not silent', () => {
  /**
   * Run the hook with `jq` genuinely absent from PATH. sed/tr/cat are symlinked in
   * because the jq-free JSON escaper needs them — masking those too would test the
   * harness, not the hook.
   */
  function runWithoutJq(extraEnv: Record<string, string> = {}): {
    status: number;
    stdout: string;
    stderr: string;
  } {
    const binDir = mkdtempSync(join(tmpdir(), 'nojq-'));
    for (const tool of ['sed', 'tr', 'cat']) {
      const real = spawnSync('/usr/bin/which', [tool], { encoding: 'utf8' }).stdout?.trim();
      if (real) symlinkSync(real, join(binDir, tool));
    }
    const fullEnv: Record<string, string> = { ...process.env, PATH: binDir } as Record<
      string,
      string
    >;
    delete fullEnv.ZCODE_PROJECT_DIR;
    Object.assign(fullEnv, extraEnv);
    // Absolute bash path: the masked PATH cannot resolve `bash` itself.
    const r = spawnSync('/bin/bash', [HOOK], {
      input: JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: join(SANDBOX, 'x.md') } }),
      encoding: 'utf8',
      cwd: SANDBOX,
      env: fullEnv,
    });
    return { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
  }

  it('CC: jq missing → hookSpecificOutput.additionalContext states the check DID NOT RUN (exit 0)', () => {
    const { status, stdout } = runWithoutJq();

    expect(status).toBe(0);
    const parsed = JSON.parse(stdout.trim()) as {
      hookSpecificOutput: { hookEventName: string; additionalContext: string };
    };
    expect(parsed.hookSpecificOutput.hookEventName).toBe('PostToolUse');
    expect(parsed.hookSpecificOutput.additionalContext).toMatch(/DID NOT RUN/);
    // The load-bearing half: a skip must not be readable as a pass.
    expect(parsed.hookSpecificOutput.additionalContext).toMatch(/not a pass/i);
  });

  it('ZCode: jq missing → bare additionalContext (harness parity preserved)', () => {
    const { status, stdout } = runWithoutJq({ ZCODE_PROJECT_DIR: '/tmp' });

    expect(status).toBe(0);
    const parsed = JSON.parse(stdout.trim()) as {
      additionalContext: string;
      hookSpecificOutput?: unknown;
    };
    expect(parsed.additionalContext).toMatch(/DID NOT RUN/);
    expect(parsed.hookSpecificOutput).toBeUndefined();
  });

  it('the human/log channel is kept as well (stderr still carries the notice)', () => {
    const { stderr } = runWithoutJq();

    expect(stderr).toMatch(/jq unavailable/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TSX RESOLUTION TIERS — linked worktrees carry no node_modules, so the hook must
// resolve tsx through: 1. repo-local  2. main-worktree via git --git-common-dir
// 3. tsx on PATH.  Kickoff §3 criteria 1-5.
//
// The defect (kickoff §1): TSX was hard-coded to $REPO_ROOT/node_modules/.bin/tsx,
// which is ABSENT in linked worktrees → the gate was structurally inert there.
// ═══════════════════════════════════════════════════════════════════════════════

/** PATH with all tsx-containing directories removed — isolates tiers 1/2 from tier 3. */
function pathWithoutTsx(): string {
  return (process.env.PATH || '')
    .split(':')
    .filter((dir) => !existsSync(join(dir, 'tsx')))
    .join(':');
}

describe.skipIf(!JQ || !TSX)(
  'check-doc-authority.sh — tsx resolution tiers',
  () => {
    /**
     * Build a minimal git repo mirroring the repo-root layout the hook expects.
     * node_modules is symlinked AFTER the initial commit so linked worktrees
     * checked out from this repo do NOT inherit it (linked worktrees carry no
     * node_modules — the exact defect condition).
     */
    function makeGitRepo(opts: { nodeModules: boolean }): string {
      const root = realpathSync(mkdtempSync(join(tmpdir(), 'tier-git-')));
      execSync('git init -q && git config user.email t@t && git config user.name T', { cwd: root });
      mkdirSync(join(root, '.claude', 'hooks'), { recursive: true });
      mkdirSync(join(root, '.claude', 'rules'), { recursive: true });
      mkdirSync(join(root, 'packages', 'core', 'principles'), { recursive: true });
      copyFileSync(REAL_HOOK, join(root, '.claude', 'hooks', 'check-doc-authority.sh'));
      copyFileSync(
        REAL_BIN,
        join(root, 'packages', 'core', 'principles', '09-doc-authority-hierarchy.bin.ts'),
      );
      copyFileSync(
        REAL_MODULE,
        join(root, 'packages', 'core', 'principles', '09-doc-authority-hierarchy.ts'),
      );
      writeFileSync(join(root, '.gitignore'), 'node_modules\n');
      writeFileSync(join(root, 'README'), 'init\n');
      execSync('git add -A && git commit -qm init', { cwd: root });
      if (opts.nodeModules) {
        symlinkSync(join(REPO_ROOT, 'node_modules'), join(root, 'node_modules'), 'dir');
      }
      return root;
    }

    // ── Criterion 1: TIER 2 resolves in linked worktree ──────────────────────

    it('tier 2: linked worktree resolves tsx from main worktree — check RUNS (exit 2)', () => {
      // _resolve_tsx tier 2: git rev-parse --git-common-dir → main worktree root
      const main = makeGitRepo({ nodeModules: true });
      extraGitRepos.push(main);

      // Linked worktree: checked out from commit → has hook+bin but NOT node_modules
      const wt = join(
        tmpdir(),
        `tier2-wt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      );
      execSync(`git -C "${main}" worktree add --detach -q "${wt}"`);

      // Fixture: required doc WITHOUT authority header
      // (mkdir: git doesn't track empty dirs → .claude/rules/ absent in worktree checkout)
      mkdirSync(join(wt, '.claude', 'rules'), { recursive: true });
      const docPath = join(wt, '.claude', 'rules', 'doc-authority-hierarchy.md');
      writeFileSync(docPath, MISSING_HEADER, 'utf8');

      // PATH stripped of tsx so tier 3 cannot rescue — tier 2 is the ONLY path
      const fullEnv = { ...process.env, PATH: pathWithoutTsx() } as Record<string, string>;
      delete fullEnv.CLAUDE_PROJECT_DIR;
      delete fullEnv.ZCODE_PROJECT_DIR;
      const r = spawnSync('bash', [join(wt, '.claude', 'hooks', 'check-doc-authority.sh')], {
        input: JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: docPath } }),
        encoding: 'utf8',
        cwd: wt,
        env: fullEnv,
      });

      expect(r.status, `stderr: ${r.stderr}`).toBe(2);
      expect(r.stderr ?? '').toMatch(/FAIL/);
      expect(r.stderr ?? '').toMatch(/missing.*Authoritative for/i);
    });

    // ── Criterion 2: PRECEDENCE — tier 1 wins over PATH ──────────────────────

    it('tier 1 precedence: repo-local tsx used even when PATH has a different tsx', () => {
      // Fake tsx on PATH — would produce wrong output if tier 3 were used
      const fakeDir = mkdtempSync(join(tmpdir(), 'fake-tsx-'));
      extraTmpDirs.push(fakeDir);
      writeFileSync(
        join(fakeDir, 'tsx'),
        '#!/usr/bin/env bash\necho "FAKE_PATH_TSX_INVOKED" >&2\nexit 99\n',
      );
      execSync(`chmod +x "${join(fakeDir, 'tsx')}"`);

      // SANDBOX has real node_modules → tier 1. Fake tsx placed FIRST on PATH.
      const abs = writeFixtureDoc(MISSING_HEADER);
      const fullEnv = {
        ...process.env,
        PATH: `${fakeDir}:${process.env.PATH}`,
      } as Record<string, string>;
      delete fullEnv.ZCODE_PROJECT_DIR;
      const r = spawnSync('bash', [HOOK], {
        input: JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: abs } }),
        encoding: 'utf8',
        cwd: SANDBOX,
        env: fullEnv,
      });

      // Tier 1 used → real check runs → /FAIL/.  Tier 3 used (bug) → /FAKE_PATH_TSX/.
      expect(r.status, `stderr: ${r.stderr}`).toBe(2);
      expect(r.stderr ?? '').toMatch(/FAIL/);
      expect(r.stderr ?? '').not.toMatch(/FAKE_PATH_TSX_INVOKED/);
    });

    // ── Criterion 3: TIER 3 (PATH) works when tiers 1/2 absent ───────────────

    it('tier 3: tsx on PATH resolves when repo-local and main-worktree absent', () => {
      // Non-git sandbox, no node_modules → tiers 1+2 miss, tier 3 must resolve
      const box = realpathSync(mkdtempSync(join(tmpdir(), 'tier3-')));
      extraTmpDirs.push(box);
      mkdirSync(join(box, '.claude', 'hooks'), { recursive: true });
      mkdirSync(join(box, '.claude', 'rules'), { recursive: true });
      mkdirSync(join(box, 'packages', 'core', 'principles'), { recursive: true });
      copyFileSync(REAL_HOOK, join(box, '.claude', 'hooks', 'check-doc-authority.sh'));
      copyFileSync(
        REAL_BIN,
        join(box, 'packages', 'core', 'principles', '09-doc-authority-hierarchy.bin.ts'),
      );
      copyFileSync(
        REAL_MODULE,
        join(box, 'packages', 'core', 'principles', '09-doc-authority-hierarchy.ts'),
      );

      const docPath = join(box, '.claude', 'rules', 'doc-authority-hierarchy.md');
      writeFileSync(docPath, MISSING_HEADER, 'utf8');

      const fullEnv = { ...process.env } as Record<string, string>;
      delete fullEnv.CLAUDE_PROJECT_DIR;
      delete fullEnv.ZCODE_PROJECT_DIR;
      const r = spawnSync('bash', [join(box, '.claude', 'hooks', 'check-doc-authority.sh')], {
        input: JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: docPath } }),
        encoding: 'utf8',
        cwd: box,
        env: fullEnv,
      });

      expect(r.status, `stderr: ${r.stderr}`).toBe(2);
      expect(r.stderr ?? '').toMatch(/FAIL/);
    });

    // ── Criterion 5: non-git dir → tier 2 skipped quietly ────────────────────

    it('criterion 5: non-git dir → tier 2 skipped quietly, no git error on model channel', () => {
      // Non-git sandbox, no node_modules. Tier 2 calls git rev-parse which fails
      // outside a repo → must be swallowed, not leaked to stderr/stdout.
      const box = realpathSync(mkdtempSync(join(tmpdir(), 'nogit-')));
      extraTmpDirs.push(box);
      mkdirSync(join(box, '.claude', 'hooks'), { recursive: true });
      mkdirSync(join(box, '.claude', 'rules'), { recursive: true });
      mkdirSync(join(box, 'packages', 'core', 'principles'), { recursive: true });
      copyFileSync(REAL_HOOK, join(box, '.claude', 'hooks', 'check-doc-authority.sh'));
      copyFileSync(
        REAL_BIN,
        join(box, 'packages', 'core', 'principles', '09-doc-authority-hierarchy.bin.ts'),
      );
      copyFileSync(
        REAL_MODULE,
        join(box, 'packages', 'core', 'principles', '09-doc-authority-hierarchy.ts'),
      );

      const docPath = join(box, '.claude', 'rules', 'doc-authority-hierarchy.md');
      writeFileSync(docPath, MISSING_HEADER, 'utf8');

      const fullEnv = { ...process.env } as Record<string, string>;
      delete fullEnv.CLAUDE_PROJECT_DIR;
      delete fullEnv.ZCODE_PROJECT_DIR;
      const r = spawnSync('bash', [join(box, '.claude', 'hooks', 'check-doc-authority.sh')], {
        input: JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: docPath } }),
        encoding: 'utf8',
        cwd: box,
        env: fullEnv,
      });

      // Tier 3 resolved → check ran
      expect(r.status, `stderr: ${r.stderr}`).toBe(2);
      // No git error leaked to either channel
      expect(r.stderr ?? '').not.toMatch(/fatal:.*not a git repository/i);
      expect(r.stdout ?? '').not.toMatch(/fatal:.*not a git repository/i);
    });
  },
);

// ── Criterion 4: no tsx anywhere → existing skip notice ──────────────────────

describe('check-doc-authority.sh — tsx not found (all tiers miss) → existing skip', () => {
  it('all tiers miss → _emit_skip notice on model channel, exit 0', () => {
    // No node_modules (tier 1 miss), not a git repo (tier 2 miss),
    // PATH stripped of tsx (tier 3 miss) → must hit the existing _emit_skip.
    const box = realpathSync(mkdtempSync(join(tmpdir(), 'all-miss-')));
    extraTmpDirs.push(box);
    mkdirSync(join(box, '.claude', 'hooks'), { recursive: true });
    mkdirSync(join(box, 'packages', 'core', 'principles'), { recursive: true });
    copyFileSync(REAL_HOOK, join(box, '.claude', 'hooks', 'check-doc-authority.sh'));
    copyFileSync(
      REAL_BIN,
      join(box, 'packages', 'core', 'principles', '09-doc-authority-hierarchy.bin.ts'),
    );
    copyFileSync(
      REAL_MODULE,
      join(box, 'packages', 'core', 'principles', '09-doc-authority-hierarchy.ts'),
    );

    const fullEnv = { ...process.env, PATH: pathWithoutTsx() } as Record<string, string>;
    delete fullEnv.CLAUDE_PROJECT_DIR;
    delete fullEnv.ZCODE_PROJECT_DIR;
    const r = spawnSync('/bin/bash', [join(box, '.claude', 'hooks', 'check-doc-authority.sh')], {
      input: JSON.stringify({
        tool_name: 'Edit',
        tool_input: { file_path: join(box, 'CLAUDE.md') },
      }),
      encoding: 'utf8',
      cwd: box,
      env: fullEnv,
    });

    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout.trim()) as {
      hookSpecificOutput: { hookEventName: string; additionalContext: string };
    };
    expect(parsed.hookSpecificOutput.hookEventName).toBe('PostToolUse');
    expect(parsed.hookSpecificOutput.additionalContext).toMatch(/DID NOT RUN/);
    expect(parsed.hookSpecificOutput.additionalContext).toMatch(/not a pass/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Consumer-layout resolution (#1597 review ledger L-2 + F-3).
//
// L-2: the hook resolved `$REPO_ROOT/packages/core/principles/09-…bin.ts` and, when that
// file was absent, ran `[[ ! -f "$BIN" ]] && exit 0`. No consumer install ships packages/core
// (install.sh vendors only packages/runtime-bridge), so on the marketplace-plugin channel the
// gate was a PERMANENT silent no-op: a consumer editing a header-less .claude/rules/*.md got
// exit 0 and empty output, which on an exit-0 PostToolUse is byte-indistinguishable from a
// clean pass. The hook now resolves through a tier list and ANNOUNCES the miss on the model
// channel. RED against the pre-fix hook: it produced no stdout at all here.
//
// Why exit 0 and not a non-zero block: a missing dependency must never block the consumer's
// edit — this is a SKIP. The load-bearing assertion is therefore the notice reaching the
// model channel (hookSpecificOutput.additionalContext), not the exit code.
//
// F-3: the tsx spawn is now guarded by an extension prefilter, so a non-markdown edit costs
// nothing (measured 0.44-0.46 s of cold tsx per no-op edit pre-fix).
// ═══════════════════════════════════════════════════════════════════════════════
describe.skipIf(!hasJq())('consumer layout without packages/core (L-2, F-3)', () => {
  /** A scratch tree shaped like a consumer install: .claude/ only, no packages/core. */
  function consumerTree(): string {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'cda-consumer-')));
    extraTmpDirs.push(root);
    mkdirSync(join(root, '.claude', 'rules'), { recursive: true });
    writeFileSync(join(root, '.claude', 'rules', 'foo.md'), '# Foo\n\nNo header.\n', 'utf8');
    writeFileSync(join(root, 'app.ts'), 'export const a = 1;\n', 'utf8');
    return root;
  }

  /**
   * Private TMPDIR per consumer tree. `_emit_skip_once` keys its once-per-session flag on
   * $TMPDIR + session_id; real session ids are unique per CC session, but a fixed test id
   * plus the shared /tmp would let one run's flag silence the next run's assertion.
   */
  function run(root: string, relPath: string, sessionId: string, hook = REAL_HOOK) {
    const flags = join(root, '.flags');
    mkdirSync(flags, { recursive: true });
    const env = { ...process.env, CLAUDE_PROJECT_DIR: root, TMPDIR: flags } as Record<
      string,
      string
    >;
    delete env.ZCODE_PROJECT_DIR;
    return spawnSync('/bin/bash', [hook], {
      input: JSON.stringify({
        session_id: sessionId,
        tool_name: 'Write',
        tool_input: { file_path: join(root, relPath) },
      }),
      encoding: 'utf8',
      cwd: root,
      env,
    });
  }

  it('L-2: bin unresolvable → loud SKIP on the model channel, never a silent exit 0', () => {
    const root = consumerTree();
    const r = run(root, '.claude/rules/foo.md', 'sess-L2-a');
    expect(r.status, 'a dependency miss is a SKIP, not a block').toBe(0);
    expect(
      r.stdout.trim(),
      'empty stdout is the DEFECT shape: on an exit-0 PostToolUse the model sees only JSON',
    ).not.toBe('');
    const ctx = (
      JSON.parse(r.stdout.trim()) as {
        hookSpecificOutput: { hookEventName: string; additionalContext: string };
      }
    ).hookSpecificOutput;
    expect(ctx.hookEventName).toBe('PostToolUse');
    expect(ctx.additionalContext).toMatch(/DID NOT RUN/);
    expect(ctx.additionalContext).toMatch(/not a pass/i);
    // Names the consumer-side replacement gate, so the notice is actionable.
    expect(ctx.additionalContext).toMatch(/check-doc-authority-header\.sh/);
  });

  it('L-2: the notice is announced once per session, not on every edit', () => {
    const root = consumerTree();
    const first = run(root, '.claude/rules/foo.md', 'sess-L2-b');
    const second = run(root, '.claude/rules/foo.md', 'sess-L2-b');
    expect(first.stdout.trim()).not.toBe('');
    expect(second.stdout.trim(), 'second edit in the same session must stay quiet').toBe('');
  });

  it('L-2: AIF_DOC_AUTHORITY=0 is the recorded opt-out — no notice at all', () => {
    const root = consumerTree();
    const flags = join(root, '.flags');
    mkdirSync(flags, { recursive: true });
    const env = { ...process.env, CLAUDE_PROJECT_DIR: root, TMPDIR: flags, AIF_DOC_AUTHORITY: '0' } as Record<
      string,
      string
    >;
    delete env.ZCODE_PROJECT_DIR;
    const r = spawnSync('/bin/bash', [REAL_HOOK], {
      input: JSON.stringify({
        session_id: 'sess-L2-c',
        tool_name: 'Write',
        tool_input: { file_path: join(root, '.claude/rules/foo.md') },
      }),
      encoding: 'utf8',
      cwd: root,
      env,
    });
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('');
  });

  it('F-3: a non-markdown edit exits before the notice (and before any tsx spawn)', () => {
    const root = consumerTree();
    const r = run(root, 'app.ts', 'sess-F3-a');
    expect(r.status).toBe(0);
    expect(r.stdout.trim(), 'code edits must not reach the doc-authority machinery').toBe('');
  });

  it('F-3 (RED on old code): the pre-fix hook had no extension prefilter before the spawn', () => {
    const src = readFileSync(REAL_HOOK, 'utf8');
    const prefilterAt = src.indexOf('*.md | *.markdown)');
    const spawnAt = src.indexOf('"$TSX" "$BIN"');
    expect(prefilterAt, 'extension prefilter must exist').toBeGreaterThan(-1);
    expect(spawnAt).toBeGreaterThan(-1);
    expect(prefilterAt, 'prefilter must precede the tsx spawn').toBeLessThan(spawnAt);
  });
});
