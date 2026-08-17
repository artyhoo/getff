/**
 * Functional meta-tests for the PostToolUse hook validate-prompt.sh
 * (.claude/hooks/validate-prompt.sh) — Wave 7 sub-wave 7.2.b,
 * batch-spec validation on Edit|Write to .claude/orchestrator-prompts/**\/*.md.
 *
 * Actual contract (hook:1-34):
 *   - PostToolUse hook, NOT UserPromptSubmit (name is misleading per hook:2 comment).
 *   - Stdin JSON shape: { tool_input: { file_path: string } }  (hook:18)
 *   - Path filter: only .claude/orchestrator-prompts/**\/*.md (hook:21)
 *   - Exit 0 — pass, skip (path mismatch, jq absent, tsx absent), or exit-2 from validator
 *   - Exit 1 — validator found invalid/missing SHA refs in the orchestrator-prompt file
 *   - Exit 2 from validate-batch-spec.ts → hook maps to exit 0 (hook:33)
 *
 * Paired-negative contract:
 *   ❌ orchestrator-prompt .md with a FAKE action SHA → exit 2 (blocked by validator)
 *   ✅ orchestrator-prompt .md with NO action SHAs → exit 0 (nothing to validate)
 *   ✅ path outside .claude/orchestrator-prompts/ → exit 0 (off-path skip, hook:21)
 *   ✅ path matching but non-.md extension → exit 0 (off-path skip, hook:21)
 *   ✅ empty file_path in JSON → exit 0 (empty string skip, hook:21)
 *   ✅ completely empty stdin → exit 0 (jq defaults to "", hook:18)
 *   Boundary: exit codes verified per T-M4-B (payload shape, not just «runs»).
 *
 * Spawns the real hook with spawnSync + fixture files (check-hook-marker.test.ts pattern).
 * Skips gracefully when `jq` is unavailable.
 *
 * Note on TSX / validate-batch-spec.ts interaction: the hook delegates to
 * validate-batch-spec.ts which calls the gh CLI for SHA verification. When gh
 * is absent or returns exit 2 (tooling unavailable), the hook maps that to 0.
 * Tests that depend on the validator being called use a fixture .md with a
 * clearly fake SHA — which gh will report as 404 → exit 2 from the validator
 * → surfaced as exit 2 by the hook (the model-visible PostToolUse channel).
 * If gh is entirely unavailable, the validator exits 2 → hook exits 0 → those
 * tests are skipped with `.skipIf(!GH)`.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { execSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, copyFileSync, symlinkSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HOOK = resolve(REPO_ROOT, '.claude/hooks/validate-prompt.sh');

// ── tooling guards ─────────────────────────────────────────────────────────────

function hasJq(): boolean {
  try {
    execSync('command -v jq', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function hasGh(): boolean {
  try {
    execSync('gh --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check whether the hook's own tsx resolution will succeed. Post-fix the hook resolves tsx
 * through a 3-tier list (`_resolve_tsx`, mirroring check-doc-authority.sh:48-62): repo-local,
 * main-worktree via `git --git-common-dir`, then `command -v tsx` on PATH. This guard must
 * mirror that tier list or every test under describe.skipIf(!TSX) silently skips when the
 * suite happens to run in a linked worktree (the very defect class this sweep closes — the
 * container itself is one: tsx at /app/node_modules/.bin/tsx, not REPO_ROOT/node_modules/...).
 */
function hasTsxForHook(): boolean {
  // Tier 1: repo-local.
  try {
    execSync(`test -x "${resolve(REPO_ROOT, 'node_modules/.bin/tsx')}"`, { stdio: 'ignore' });
    return true;
  } catch {
    // fall through
  }
  // Tier 2: main worktree via git --git-common-dir.
  try {
    const common = execSync(`git -C "${REPO_ROOT}" rev-parse --git-common-dir`, {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    }).trim();
    if (common) {
      const abs = common.startsWith('/') ? common : resolve(REPO_ROOT, common);
      const mainRoot = abs.split('/').slice(0, -1).join('/');
      execSync(`test -x "${mainRoot}/node_modules/.bin/tsx"`, { stdio: 'ignore' });
      return true;
    }
  } catch {
    // fall through
  }
  // Tier 3: tsx on PATH.
  try {
    execSync('command -v tsx', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const JQ = hasJq();
const GH = hasGh();
const TSX = hasTsxForHook();

// ── temp file management ───────────────────────────────────────────────────────

const tmpFiles: string[] = [];
afterEach(() => {
  for (const f of tmpFiles.splice(0)) rmSync(f, { recursive: true, force: true });
});

/**
 * Write a fixture .md file under a temp dir mirroring the
 * .claude/orchestrator-prompts/<name>/ hierarchy so the hook's path filter
 * (hook:21 — must contain ".claude/orchestrator-prompts/" and end in ".md") fires.
 *
 * Returns the absolute path of the written file.
 */
function writeOrchestratorPrompt(content: string, name = 'kickoff.md'): string {
  const dir = mkdtempSync(join(tmpdir(), 'vp-test-'));
  // Create the path segment the hook checks for (hook:21)
  const subdir = join(dir, '.claude', 'orchestrator-prompts', 'test-wave');
  mkdirSync(subdir, { recursive: true });
  const abs = join(subdir, name);
  writeFileSync(abs, content, 'utf8');
  tmpFiles.push(dir);
  return abs;
}

// ── hook runner ───────────────────────────────────────────────────────────────

/**
 * Run validate-prompt.sh with the given stdin JSON. Returns exit code.
 * Uses `spawnSync` identical to the check-hook-marker.test.ts reference pattern.
 * env merged onto process.env; default-scrubs ZCODE_PROJECT_DIR so CC-arms stay in the
 * exit-code branch (mirrors deps-hash-check.test.ts:106). Pass ZCODE_PROJECT_DIR to
 * exercise the JSON additionalContext branch (hook:47-50).
 */
function runHook(
  stdinJson: object,
  env: Record<string, string> = {},
): { status: number; stderr: string; stdout: string } {
  const fullEnv = { ...process.env };
  if (env.ZCODE_PROJECT_DIR === undefined) delete fullEnv.ZCODE_PROJECT_DIR;
  else fullEnv.ZCODE_PROJECT_DIR = env.ZCODE_PROJECT_DIR;
  const r = spawnSync('bash', [HOOK], {
    input: JSON.stringify(stdinJson),
    encoding: 'utf8',
    // Allow up to 15s — validator may make gh API calls
    timeout: 15_000,
    env: fullEnv,
  });
  return {
    status: r.status ?? -1,
    stderr: r.stderr ?? '',
    stdout: r.stdout ?? '',
  };
}

// ── off-path / skip tests (no gh dependency) ──────────────────────────────────

describe.skipIf(!JQ)('validate-prompt.sh — off-path skip conditions (jq required)', () => {
  it('PAIRED-POSITIVE: path outside orchestrator-prompts/ → exit 0 (hook:21 path filter)', () => {
    // path does NOT contain ".claude/orchestrator-prompts/"
    const result = runHook({ tool_input: { file_path: '/tmp/some-random/kickoff.md' } });
    expect(result.status).toBe(0);
  });

  it('PAIRED-POSITIVE: path under orchestrator-prompts/ but non-.md → exit 0 (hook:21)', () => {
    const abs = writeOrchestratorPrompt('# content', 'kickoff.sh');
    // Replace .md extension — must NOT end in ".md" to test the filter boundary
    const shPath = abs.replace(/\.md$/, '.sh');
    writeFileSync(shPath, '# shell file', 'utf8');
    tmpFiles.push(shPath);
    const result = runHook({ tool_input: { file_path: shPath } });
    expect(result.status).toBe(0);
  });

  it('PAIRED-POSITIVE: empty file_path in JSON → exit 0 (hook:21 empty-string guard)', () => {
    const result = runHook({ tool_input: { file_path: '' } });
    expect(result.status).toBe(0);
  });

  it('PAIRED-POSITIVE: file_path key absent in JSON → exit 0 (jq defaults to "", hook:18)', () => {
    // jq -r '.tool_input.file_path // ""' on missing key → ""
    const result = runHook({ tool_input: {} });
    expect(result.status).toBe(0);
  });

  it('PAIRED-POSITIVE: completely empty JSON object stdin → exit 0 (hook:18 graceful parse)', () => {
    const result = runHook({});
    expect(result.status).toBe(0);
  });

  it('PAIRED-POSITIVE: .md inside orchestrator-prompts path with no action SHAs → exit 0 (tsx skip or validator no-op)', () => {
    // Fixture file IS in a path containing ".claude/orchestrator-prompts/" and ends in ".md".
    // Two outcomes, both exit 0:
    //   - tsx not found at $HOOK_REPO_ROOT/node_modules/.bin/tsx → hook:26 graceful skip → exit 0
    //   - tsx found + no action SHAs in file → validator exits 0 → hook exits 0
    const abs = writeOrchestratorPrompt('# Kickoff doc with no action SHAs\n\nJust markdown.\n');
    const result = runHook({ tool_input: { file_path: abs } });
    expect(result.status).toBe(0);
  });
});

// ── degraded-tooling graceful-skip (deterministic, no gh) ─────────────────────
//
// The bash mutation tool (B.2) surfaced that the `exit 0` on the tsx-unavailable
// graceful-skip (hook:26-27) had no coverage — flipping it to `exit 1` survived.
// We force the tsx-absent path deterministically by running a COPY of the hook
// from a temp dir whose `../../node_modules/.bin/tsx` does not exist, so the hook
// computes an absent TSX and must exit 0 (never block a tool call for missing
// dev-tooling). Independent of the suite's TSX guard — it CREATES the condition.

describe.skipIf(!JQ)('validate-prompt.sh — tsx-unavailable graceful skip (hook:26-27)', () => {
  /**
   * Run a copy of the (possibly mutation-swapped) hook from an isolated temp dir where
   * REPO_ROOT/node_modules/.bin/tsx cannot resolve AND tsx is scrubbed from PATH → forces
   * the tsx-tier resolution to miss on every tier (hook now resolves via `_resolve_tsx`,
   * not a single literal path). The PATH scrub is mandatory post-fix: tier 3 (`command -v
   * tsx`) would otherwise find the test env's tsx and the graceful skip would not fire.
   */
  function runHookNoTsx(stdinJson: object): { status: number; stderr: string; stdout: string } {
    const dir = mkdtempSync(join(tmpdir(), 'vp-notsx-'));
    tmpFiles.push(dir);
    const hookCopy = join(dir, 'validate-prompt.sh');
    copyFileSync(HOOK, hookCopy);
    // Scrub tsx from PATH so tier 3 misses too (post-fix the hook has a tier list).
    const binDir = mkdtempSync(join(tmpdir(), 'vp-notsx-bin-'));
    tmpFiles.push(binDir);
    for (const tool of ['sed', 'tr', 'cat', 'head', 'dirname', 'grep', 'sort', 'awk', 'git', 'jq', 'printf']) {
      const real = spawnSync('/usr/bin/which', [tool], { encoding: 'utf8' }).stdout?.trim();
      if (real) symlinkSync(real, join(binDir, tool));
    }
    const env: Record<string, string> = { ...process.env, PATH: binDir } as Record<string, string>;
    delete env.ZCODE_PROJECT_DIR;
    const r = spawnSync('/bin/bash', [hookCopy], {
      input: JSON.stringify(stdinJson),
      encoding: 'utf8',
      timeout: 15_000,
      env,
    });
    return { status: r.status ?? -1, stderr: r.stderr ?? '', stdout: r.stdout ?? '' };
  }

  it('PAIRED-POSITIVE: matching .md path but tsx unavailable → exit 0 (graceful skip, never block)', () => {
    // file_path matches hook:21 (contains .claude/orchestrator-prompts/ + .md) so the
    // path filter does NOT skip; the ONLY reason this exits 0 is the tsx-absent guard.
    const r = runHookNoTsx({
      tool_input: { file_path: '/x/.claude/orchestrator-prompts/test-wave/kickoff.md' },
    });
    expect(r.status, `tsx-absent must exit 0 (graceful), not block. stderr: ${r.stderr}`).toBe(0);
  });

  it('PAIRED-POSITIVE: jq unavailable on PATH → exit 0 (graceful skip, hook:14-16)', () => {
    // Run the hook with a PATH that has `dirname` (needed by hook:9) but NOT `jq`,
    // forcing the hook:14 `command -v jq` check to fail → exit 0. This covers the
    // jq-unavailable graceful-skip the mutation tool flagged (hook:15 `exit 0`).
    const binDir = mkdtempSync(join(tmpdir(), 'vp-nojq-bin-'));
    tmpFiles.push(binDir);
    // symlink only the externals the hook touches BEFORE the jq check (hook:9 dirname)
    symlinkSync('/usr/bin/dirname', join(binDir, 'dirname'));
    const r = spawnSync('/bin/bash', [HOOK], {
      input: JSON.stringify({ tool_input: { file_path: '/whatever/kickoff.md' } }),
      encoding: 'utf8',
      timeout: 15_000,
      env: { PATH: binDir }, // jq deliberately absent
    });
    expect(
      r.status,
      `jq-absent must exit 0 (graceful), not block. stderr: ${r.stderr}`,
    ).toBe(0);
  });
});

// ── content-level validation tests (require jq + tsx + gh CLI) ───────────────
//
// tsx check: the hook resolves tsx at $REPO_ROOT/node_modules/.bin/tsx where REPO_ROOT
// is computed from the hook's own location (hook:9-10). In a git worktree without a
// node_modules symlink, tsx will be absent and the hook exits 0 via graceful skip (hook:26),
// making the PAIRED-NEGATIVE (expects exit 1) unreachable. Guard with TSX to skip safely.

// Each case spawns the hook, which spawns `tsx validate-batch-spec.ts`, which in
// turn shells out to `gh` — a three-deep process chain whose cost is inherent. Two
// cases already carried `timeout: 15_000`; the fake-SHA paired-negative did not and
// timed out at 5000ms under full-suite parallel load (`vitest run hooks/ skills/`,
// measured 2026-08-10). Suite-level default so every case is covered.
describe.skipIf(!JQ || !GH || !TSX)(
  'validate-prompt.sh — content validation via validate-batch-spec.ts (jq + tsx + gh required)',
  { timeout: 30_000 },
  () => {
    it('PAIRED-POSITIVE: orchestrator-prompt with no action SHAs → exit 0 (nothing to validate)', () => {
      const abs = writeOrchestratorPrompt(
        '# Wave N kickoff\n\nNo action refs here, just prose.\n',
      );
      const result = runHook({ tool_input: { file_path: abs } });
      expect(result.status).toBe(0);
    });

    it('PAIRED-POSITIVE: action SHA inside a code fence → exit 0 (fence-skip, validate-batch-spec.ts:104-112)', () => {
      // refs inside ```git or ```bash fences are documentation examples — validator skips them
      const content = [
        '# Kickoff',
        '',
        'Example usage:',
        '```git',
        'uses: actions/checkout@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa # v4',
        '```',
        '',
        'No live refs outside fence.',
      ].join('\n');
      const abs = writeOrchestratorPrompt(content);
      const result = runHook({ tool_input: { file_path: abs } });
      expect(result.status).toBe(0);
    });

    it('PAIRED-NEGATIVE: orchestrator-prompt with a clearly fake action SHA → exit 2 (validator exit 1 → hook exit 2, the model-visible channel)', () => {
      // Uses a plausible-looking but certainly non-existent SHA so gh API returns 404,
      // making validate-batch-spec.ts emit exit 1 which the hook propagates unchanged.
      // 40-char hex string that will never resolve to a real commit.
      // T-M4-B payload shape verified: exit code 1 (blocking) not just "non-zero".
      const fakeRef =
        'uses: actions/checkout@0000000000000000000000000000000000000000 # v-fake';
      const content = `# Kickoff with bad SHA\n\n${fakeRef}\n`;
      const abs = writeOrchestratorPrompt(content);
      const result = runHook({ tool_input: { file_path: abs } });
      // validator exits 1 (non-resolvable SHA) → hook maps it to exit 2 (exit-2 stderr is
      // the only non-JSON channel the model receives on PostToolUse; verified 2026-07-24)
      expect(result.status).toBe(2);
    });

    it('ZCODE: violating orchestrator-prompt under ZCODE_PROJECT_DIR → schema-valid {additionalContext} JSON, exit 0 (advisory, not gate)', () => {
      // ZCode parses hook stdout against the HookJSONOutput schema (CCt at zcode.cjs:~577900),
      // which is `.strict()` — unknown top-level keys are REJECTED (→ hook.run.failed, output
      // discarded). PostToolUse cannot block on ZCode (schema Uan rejects permissionDecision;
      // exit 1 is swallowed as HookRunFailed, not surfaced). The ZCode branch (hook:47-50) emits
      // schema-valid `{additionalContext}` JSON and exits 0 — advisory, the best available
      // mechanism. Regression guard: catches the prior shape that emitted
      // `{hookEventName, additionalContext}` at top level and was silently rejected by ZCode.
      const fakeRef =
        'uses: actions/checkout@0000000000000000000000000000000000000000 # v-fake';
      const content = `# Kickoff with bad SHA\n\n${fakeRef}\n`;
      const abs = writeOrchestratorPrompt(content);
      const r = runHook(
        { tool_input: { file_path: abs } },
        { ZCODE_PROJECT_DIR: REPO_ROOT },
      );
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
      ).toContain('validate-prompt');
      expect(
        parsed.hookEventName,
        'hookEventName must NOT be at top level (CCt.strict rejects it)',
      ).toBeUndefined();
    });
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// Dependency-missing SKIP must reach the model, not just stderr (aif-parity F1,
// criterion (a) — silent `command -v jq || exit 0` guards; sibling of the
// check-doc-authority.sh fix shipped in #1116). Channel semantics live-verified
// 2026-07-24: research-patches/2026-07-24-posttooluse-channel-verification.md.
// ═══════════════════════════════════════════════════════════════════════════════
import { mkdtempSync as _mkdtempSync, symlinkSync as _symlinkSync } from 'node:fs';
import { join as _join } from 'node:path';
import { tmpdir as _tmpdir } from 'node:os';
import { spawnSync as _spawnSync } from 'node:child_process';

describe('dependency-missing skip is announced on the model channel', () => {
  function runNoJq(filePath: string): { status: number; stdout: string; stderr: string } {
    const binDir = _mkdtempSync(_join(_tmpdir(), 'nojq-'));
    // sed/tr/head back the jq-free escaper + crude path parse; masking them too would
    // test the harness, not the hook. dirname backs the REPO_ROOT fallback line.
    for (const tool of ['sed', 'tr', 'cat', 'head', 'dirname', 'grep', 'sort', 'awk', 'stat', 'date', 'touch']) {
      const real = _spawnSync('/usr/bin/which', [tool], { encoding: 'utf8' }).stdout?.trim();
      if (real) _symlinkSync(real, _join(binDir, tool));
    }
    const env: Record<string, string> = { ...process.env, PATH: binDir } as Record<string, string>;
    delete env.ZCODE_PROJECT_DIR;
    const r = _spawnSync('/bin/bash', [HOOK], {
      input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: filePath } }),
      encoding: 'utf8',
      env,
    });
    return { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
  }

  it('jq missing + in-scope path → hookSpecificOutput.additionalContext says DID NOT RUN (exit 0)', () => {
    const { status, stdout } = runNoJq('/x/.claude/orchestrator-prompts/wave-1/batch-2.md');
    expect(status).toBe(0);
    const parsed = JSON.parse(stdout.trim()) as {
      hookSpecificOutput: { hookEventName: string; additionalContext: string };
    };
    expect(parsed.hookSpecificOutput.hookEventName).toBe('PostToolUse');
    expect(parsed.hookSpecificOutput.additionalContext).toMatch(/DID NOT RUN/);
    expect(parsed.hookSpecificOutput.additionalContext).toMatch(/not a pass/i);
  });

  it('jq missing + OUT-of-scope path → silent exit 0 (no per-edit spam in a jq-less env)', () => {
    const { status, stdout } = runNoJq('/x/src/index.ts');
    expect(status).toBe(0);
    expect(stdout.trim()).toBe('');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Manual-twin drift guard (V3, 2026-07-24). plugin/hooks/validate-prompt is a
// hand-maintained twin (`@plugin-transform: manual`) — the generator counts it but
// never rewrites it, so fixes applied to the source can silently miss the twin
// (observed: #1116 fixed the source's silent skips; the twin kept the old
// stderr-only skip until 2026-07-24). ZCode consumers reach hooks ONLY via the
// plugin channel (zcode-parity-doctrine.md §4), so a drifted twin = unfixed on
// ZCode. These assertions lock the fix-invariants both files must share; a
// sync-touch of the twin is required whenever they change in the source.
// ═══════════════════════════════════════════════════════════════════════════════
import { readFileSync as _readFileSync } from 'node:fs';
import { resolve as _resolve } from 'node:path';

describe('manual plugin twin carries the same channel fixes as the source', () => {
  const twinPath = _resolve(REPO_ROOT, 'plugin/hooks/validate-prompt');
  const twin = _readFileSync(twinPath, 'utf8');
  const source = _readFileSync(HOOK, 'utf8');

  it('twin announces dependency-missing skips via _emit_skip (not bare stderr)', () => {
    expect(twin).toContain('_emit_skip');
    expect(twin).not.toMatch(/jq unavailable — skipping/);
  });

  it('twin routes CC violations to exit 2 (the model-visible channel)', () => {
    expect(twin).toMatch(/\[\[ \$STATUS -ne 0 \]\] && exit 2/);
  });

  it('twin keeps its declared divergence (T-PLUG-A validator guard)', () => {
    expect(twin).toContain('T-PLUG-A');
  });

  it('source and twin share the same skip-notice wording (drift tell)', () => {
    const notice = /batch-spec validation DID NOT RUN/;
    expect(source).toMatch(notice);
    expect(twin).toMatch(notice);
  });

  it('twin carries _resolve_tsx (drift tell for the tier fix, T-SWEEP-B)', () => {
    // Locks the 2026-07-24 tier-resolution sweep: the manual twin must carry the SAME
    // _resolve_tsx function as the source, or ZCode consumers (who reach the hook via the
    // plugin channel only) keep silently no-op'ing in linked worktrees.
    expect(source).toContain('_resolve_tsx');
    expect(twin).toContain('_resolve_tsx');
    // Both must have retired the pre-fix single-literal-path resolution.
    expect(source).not.toMatch(/^TSX="\$REPO_ROOT\/node_modules\/\.bin\/tsx"$/m);
    expect(twin).not.toMatch(/^TSX="\$REPO_ROOT\/node_modules\/\.bin\/tsx"$/m);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Tier-based tsx resolution — paired-negative for the linked-worktree defect class
// (kickoff §3 criteria 1-5; plan Phase C Task 3). The defect: a PostToolUse hook
// resolved tsx from a single hard-coded path `$REPO_ROOT/node_modules/.bin/tsx`,
// which misses in every linked worktree → silent skip → gate inert. The fix: a tier
// list (repo-local → main-worktree via git --git-common-dir → PATH). Each test below
// would have observed silent-exit-0 pre-fix (the defect), and observes a meaningful
// outcome post-fix (check runs OR loud skip notice).
// ═══════════════════════════════════════════════════════════════════════════════
import { execSync as _execSync } from 'node:child_process';
import {
  copyFileSync as _copyFileSync,
  rmSync as _rmSync,
  writeFileSync as _writeFileSync,
  mkdirSync as _mkdirSync,
} from 'node:fs';

const tmpWorktrees: string[] = [];
afterEach(() => {
  // Remove worktrees first (git-tracked), then any leftover temp dirs.
  for (const wt of tmpWorktrees.splice(0)) {
    try {
      _execSync(`git worktree remove --force "${wt}" 2>&1`, { stdio: 'pipe' });
    } catch {
      _rmSync(wt, { recursive: true, force: true });
    }
  }
});

/**
 * Build a minimal PATH bin dir containing core utils but NOT tsx — so tier 3
 * (`command -v tsx`) deterministically misses. Pre-fix the hook only checked
 * REPO_ROOT/node_modules/.bin/tsx; post-fix the tier list also consults PATH, so
 * PATH must be scrubbed to isolate tier-1 / tier-2 behaviour.
 */
function scrubbedPathBin(): string {
  const binDir = _mkdtempSync(_join(_tmpdir(), 'vp-scrubbed-bin-'));
  for (const tool of ['sed', 'tr', 'cat', 'head', 'dirname', 'grep', 'sort', 'awk', 'git', 'jq', 'printf', 'bash', 'sh', 'node']) {
    const real = _spawnSync('/usr/bin/which', [tool], { encoding: 'utf8' }).stdout?.trim();
    if (real) _symlinkSync(real, _join(binDir, tool));
  }
  return binDir;
}

/**
 * Write a violating orchestrator-prompt .md under <repoRoot>/.claude/orchestrator-prompts/
 * so the hook's path filter fires. Returns the absolute path. Uses a clearly-fake SHA so
 * the validator (when it runs) reports exit 1 → hook maps to exit 2.
 */
function writeViolatingOrchestratorPrompt(repoRoot: string): string {
  const sub = _join(repoRoot, '.claude', 'orchestrator-prompts', 'tier-test');
  _mkdirSync(sub, { recursive: true });
  const abs = _join(sub, 'kickoff.md');
  _writeFileSync(
    abs,
    '# Tier-test kickoff\n\nuses: actions/checkout@0000000000000000000000000000000000000000 # v-fake\n',
    'utf8',
  );
  return abs;
}

// These cases build a REAL linked git worktree per test and run the hook through a
// scrubbed PATH — inherently multi-second, so the vitest 5s default is a mis-set
// gate rather than a signal. Most cases here already carried a per-test
// `timeout: 30_000`; C1/C2 did not, and both timed out at 5000ms under full-suite
// parallel load (`vitest run hooks/ skills/`, measured 2026-08-10). A suite-level
// default closes that gap for every case, present and future; the per-test values
// below are now redundant-but-harmless restatements of it.
describe('tier-based tsx resolution (paired-negative for the worktree defect class)', { timeout: 30_000 }, () => {
  it('C1: linked worktree (no local node_modules, main has tsx, PATH scrubbed) → hook runs check (NOT silent exit 0)', () => {
    // Setup: real linked worktree of REPO_ROOT. The worktree has NO node_modules (git
    // worktree add doesn't copy it); the main worktree at <repo-root>/../.. DOES have
    // node_modules/.bin/tsx (this repo's dev dep). Scrub tsx from PATH so tier 3 misses.
    // Tier 2 is the only path that can resolve tsx — exactly the defect class scenario.
    const wt = _mkdtempSync(_join(_tmpdir(), 'vp-c1-wt-'));
    _rmSync(wt, { recursive: true, force: true });
    _execSync(`git worktree add --detach "${wt}" 2>&1`, { stdio: 'pipe' });
    tmpWorktrees.push(wt);
    // Overwrite the worktree's checked-out hook with the FIXED working-tree version
    // (HEAD's hook is the pre-fix version; the worktree checks out HEAD).
    const wtHook = _join(wt, '.claude/hooks/validate-prompt.sh');
    _copyFileSync(HOOK, wtHook);

    const binDir = scrubbedPathBin();
    const abs = writeViolatingOrchestratorPrompt(wt);
    const env: Record<string, string> = {
      ...process.env,
      CLAUDE_PROJECT_DIR: wt,
      PATH: binDir,
    } as Record<string, string>;
    delete env.ZCODE_PROJECT_DIR;
    const r = _spawnSync('/bin/bash', [wtHook], {
      input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: abs } }),
      encoding: 'utf8',
      timeout: 30_000,
      env,
    });
    // POST-FIX: tier 2 resolved tsx → hook ran the validator. Three observable outcomes:
    //   - status 2 (gh verified the SHA as fake) — the violation reached the model
    //   - status 0 + stdout has "gh CLI unavailable" (gh missing → soft-skip, but the
    //     hook RAN past tsx resolution)
    //   - status 0 + stdout has "validate-prompt" (any other validator-driven output)
    // The DEFECT shape (silent exit 0 + empty stdout) is asserted AGAINST.
    const out = (r.stdout ?? '').trim();
    const err = (r.stderr ?? '').trim();
    const ranCheck =
      r.status === 2 || /gh CLI unavailable/i.test(out) || /validate-prompt/i.test(out);
    expect(
      ranCheck,
      `C1 FAIL: expected hook to run check, got status=${r.status} stdout="${out.slice(0, 200)}" stderr="${err.slice(0, 200)}". ` +
        `If status=0 + empty stdout, the tier-2 resolution missed (the defect).`,
    ).toBe(true);
    // Specifically: NO tsx-skip-notice (would prove tier miss, the defect).
    expect(out).not.toMatch(/tsx not found/i);
  });

  it('C2: precedence held — repo-local tsx wins when present (structural; verified by tier-1 hit)', () => {
    // Structural test (plan: "precedence tests don't have a clean pre-fix RED; criterion 2
    // is verified by the test existing + passing"). Setup: REPO_ROOT with a sentinel tsx
    // at $REPO_ROOT/node_modules/.bin/tsx that echoes a marker; tier 2 also available.
    // Assert: sentinel invoked (marker visible) → tier 1 precedence held.
    const dir = _mkdtempSync(_join(_tmpdir(), 'vp-c2-'));
    const nmBin = _join(dir, 'node_modules', '.bin');
    _mkdirSync(nmBin, { recursive: true });
    // Sentinel: prints a marker to stderr, then exits 0 (so the hook proceeds; we only
    // need to prove THIS binary was invoked, not what it does to the validator path).
    const sentinel = _join(nmBin, 'tsx');
    _writeFileSync(
      sentinel,
      '#!/bin/sh\necho "TIER1_SENTINEL_INVOKED" >&2\nexit 0\n',
      'utf8',
    );
    _execSync(`chmod +x "${sentinel}"`);
    // Make the dir look like a linked worktree too (so tier 2 also has a candidate),
    // to actually exercise the precedence. Simplest: also place a real tsx shim at the
    // main-worktree path via a fake .git file.
    const fakeMain = _mkdtempSync(_join(_tmpdir(), 'vp-c2-main-'));
    const fakeMainNm = _join(fakeMain, 'node_modules', '.bin');
    _mkdirSync(fakeMainNm, { recursive: true });
    _writeFileSync(
      _join(fakeMainNm, 'tsx'),
      '#!/bin/sh\necho "TIER2_INVOKED_WRONG" >&2\nexit 0\n',
      'utf8',
    );
    _execSync(`chmod +x "${fakeMainNm}/tsx"`);
    // Write .git file pointing at a fake gitdir under fakeMain
    _writeFileSync(_join(dir, '.git'), `gitdir: ${fakeMain}/.git\n`, 'utf8');
    _mkdirSync(_join(fakeMain, '.git'), { recursive: true });

    const abs = writeViolatingOrchestratorPrompt(dir);
    const binDir = scrubbedPathBin();
    // ALSO put a wrong-tier sentinel on PATH (tier 3)
    _writeFileSync(
      _join(binDir, 'tsx'),
      '#!/bin/sh\necho "TIER3_INVOKED_WRONG" >&2\nexit 0\n',
      'utf8',
    );
    _execSync(`chmod +x "${binDir}/tsx"`);
    const env: Record<string, string> = {
      ...process.env,
      CLAUDE_PROJECT_DIR: dir,
      PATH: binDir,
    } as Record<string, string>;
    delete env.ZCODE_PROJECT_DIR;
    const hookCopy = _join(dir, 'validate-prompt.sh');
    _copyFileSync(HOOK, hookCopy);
    const r = _spawnSync('/bin/bash', [hookCopy], {
      input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: abs } }),
      encoding: 'utf8',
      timeout: 30_000,
      env,
    });
    expect(
      r.stderr,
      `C2 FAIL: expected TIER1_SENTINEL_INVOKED in stderr; got status=${r.status} stderr="${(r.stderr ?? '').slice(0, 300)}"`,
    ).toContain('TIER1_SENTINEL_INVOKED');
    expect(r.stderr).not.toContain('TIER2_INVOKED_WRONG');
    expect(r.stderr).not.toContain('TIER3_INVOKED_WRONG');
  });

  it('C3: non-git REPO_ROOT, tsx on PATH → tier 3 resolves → hook runs check', () => {
    // Setup: temp dir NOT a git repo (tier 2 `git rev-parse` fails silently); no
    // node_modules (tier 1 misses); real tsx available on PATH (tier 3 hits).
    // Pre-fix: only REPO_ROOT/node_modules/.bin/tsx was checked → exit 0 silent (defect).
    const dir = _mkdtempSync(_join(_tmpdir(), 'vp-c3-'));
    const abs = writeViolatingOrchestratorPrompt(dir);
    const binDir = scrubbedPathBin();
    // Place the REAL tsx (resolved via the existing test env's PATH) into binDir.
    const realTsx = _spawnSync('/usr/bin/which', ['tsx'], { encoding: 'utf8' }).stdout?.trim();
    if (realTsx) _symlinkSync(realTsx, _join(binDir, 'tsx'));
    const hookCopy = _join(dir, 'validate-prompt.sh');
    _copyFileSync(HOOK, hookCopy);
    const env: Record<string, string> = {
      ...process.env,
      CLAUDE_PROJECT_DIR: dir,
      PATH: binDir,
    } as Record<string, string>;
    delete env.ZCODE_PROJECT_DIR;
    const r = _spawnSync('/bin/bash', [hookCopy], {
      input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: abs } }),
      encoding: 'utf8',
      timeout: 30_000,
      env,
    });
    // Hook ran past tsx resolution. Same observable contract as C1: NOT silent exit 0.
    const out = (r.stdout ?? '').trim();
    const ranCheck =
      r.status === 2 || /gh CLI unavailable/i.test(out) || /validate-prompt/i.test(out);
    expect(
      ranCheck,
      `C3 FAIL: expected hook to run via tier 3, got status=${r.status} stdout="${out.slice(0, 200)}"`,
    ).toBe(true);
    expect(out).not.toMatch(/tsx not found/i);
  });

  it('C4: non-git REPO_ROOT, no tier resolves → no crash, no git error leaked on model channel', () => {
    // Setup: temp dir NOT under any git repo; tsx scrubbed from PATH; no node_modules.
    // Criterion 4: must degrade safely — no hang, no crash, no git error reaching the model.
    const dir = _mkdtempSync(_join(_tmpdir(), 'vp-c4-'));
    const abs = writeViolatingOrchestratorPrompt(dir);
    const binDir = scrubbedPathBin();
    const hookCopy = _join(dir, 'validate-prompt.sh');
    _copyFileSync(HOOK, hookCopy);
    const env: Record<string, string> = {
      ...process.env,
      CLAUDE_PROJECT_DIR: dir,
      PATH: binDir,
    } as Record<string, string>;
    delete env.ZCODE_PROJECT_DIR;
    const r = _spawnSync('/bin/bash', [hookCopy], {
      input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: abs } }),
      encoding: 'utf8',
      timeout: 30_000,
      env,
    });
    expect(r.status, `C4: status must be 0 (graceful skip), got ${r.status}`).toBe(0);
    // Critical assertion: no `fatal: not a git repository` or similar leaked to model.
    const combined = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    expect(
      combined,
      `C4 FAIL: git error leaked. stdout+stderr was: "${combined.slice(0, 300)}"`,
    ).not.toMatch(/fatal: not a git repository|fatal: this operation must be run in a work tree/i);
  });

  it('C5: no tier resolves → skip notice fires on model channel + exit 0 (criterion 5)', () => {
    // Same setup as C4; the load-bearing assertion here is the SKIP NOTICE reaches the
    // model (hookSpecificOutput.additionalContext), not just stderr. This is the
    // paired-negative for "silent exit 0 = defect".
    const dir = _mkdtempSync(_join(_tmpdir(), 'vp-c5-'));
    const abs = writeViolatingOrchestratorPrompt(dir);
    const binDir = scrubbedPathBin();
    const hookCopy = _join(dir, 'validate-prompt.sh');
    _copyFileSync(HOOK, hookCopy);
    const env: Record<string, string> = {
      ...process.env,
      CLAUDE_PROJECT_DIR: dir,
      PATH: binDir,
    } as Record<string, string>;
    delete env.ZCODE_PROJECT_DIR;
    const r = _spawnSync('/bin/bash', [hookCopy], {
      input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: abs } }),
      encoding: 'utf8',
      timeout: 30_000,
      env,
    });
    expect(r.status, `C5: status must be 0 (skip + exit 0), got ${r.status}`).toBe(0);
    expect(r.stdout.trim(), `C5 FAIL: stdout empty (silent skip — the defect). stdout="${r.stdout}"`).not.toBe('');
    const parsed = JSON.parse(r.stdout.trim()) as {
      hookSpecificOutput?: { hookEventName?: string; additionalContext?: string };
    };
    expect(parsed.hookSpecificOutput?.hookEventName ?? parsed.hookSpecificOutput?.additionalContext).toBeTruthy();
    const ctx =
      parsed.hookSpecificOutput?.additionalContext ?? JSON.stringify(parsed);
    expect(ctx).toMatch(/DID NOT RUN/);
    expect(ctx).toMatch(/not a pass/i);
  });
});
