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
 * Check whether the hook's own tsx resolution will succeed.
 * The hook computes REPO_ROOT as: cd "$(dirname "$0")/../.." (hook:9).
 * dirname($0) = .claude/hooks → ../.. = repo root.
 * tsx must be at $REPO_ROOT/node_modules/.bin/tsx (hook:10).
 * In a git worktree, node_modules may be absent unless symlinked from the main repo.
 * HERE is packages/core/hooks/ → ../../.. = repo root — same computation.
 */
function hasTsxForHook(): boolean {
  const tsxPath = resolve(REPO_ROOT, 'node_modules/.bin/tsx');
  try {
    execSync(`test -x "${tsxPath}"`, { stdio: 'ignore' });
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
   * Run a copy of the (possibly mutation-swapped) hook from an isolated temp dir
   * where REPO_ROOT/node_modules/.bin/tsx cannot resolve → forces hook:26 to fire.
   */
  function runHookNoTsx(stdinJson: object): { status: number; stderr: string } {
    const dir = mkdtempSync(join(tmpdir(), 'vp-notsx-'));
    tmpFiles.push(dir);
    const hookCopy = join(dir, 'validate-prompt.sh');
    copyFileSync(HOOK, hookCopy);
    const r = spawnSync('bash', [hookCopy], {
      input: JSON.stringify(stdinJson),
      encoding: 'utf8',
      timeout: 15_000,
    });
    return { status: r.status ?? -1, stderr: r.stderr ?? '' };
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

describe.skipIf(!JQ || !GH || !TSX)(
  'validate-prompt.sh — content validation via validate-batch-spec.ts (jq + tsx + gh required)',
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
});
