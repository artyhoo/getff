/**
 * Functional tests for the PostToolUse doc-authority-header gate
 * (.claude/hooks/check-doc-authority-header.sh) — the consumer-shippable, zero-dep
 * reimplementation of the framework-internal check-doc-authority.sh.
 *
 * Channel: edit-time PostToolUse. Fires on Edit|Write of .claude/rules/*.md or
 * .claude/skills/[name]/SKILL.md — a consumer-authored doc-authority-bearing doc must
 * declare its scope with the load-bearing header line (a blockquote starting with
 * the "Authoritative for:" marker).
 *
 * Contract (from hook source):
 *   - non-scoped path / wrong tool / empty path        → exit 0 (silent)
 *   - scoped doc WITH the load-bearing header line     → exit 0 (silent)
 *   - scoped doc WITHOUT header, under CC              → exit 2 + stderr (PostToolUse feedback)
 *   - scoped doc WITHOUT header, under ZCode           → exit 0 + {additionalContext} JSON
 *     (PostToolUse cannot block on ZCode — schema Uan rejects permissionDecision for
 *     PostToolUse; exit 2 + stderr is swallowed silently. The JSON branch surfaces the
 *     violation as advisory context, the best available mechanism.)
 *   - AIF_DOC_AUTHORITY=0                               → exit 0 (repo-wide opt-out)
 *   - per-file exemption HTML comment (20+ char reason) → exit 0
 *   - jq unavailable                                    → exit 0 (graceful skip)
 *
 * Skips gracefully when jq is unavailable (the hook no-ops too).
 *
 * Sandbox isolation (mirrors check-doc-authority.test.ts: writes to a temp repo-rooted
 * .claude/rules/ so the scope matcher fires against a real on-disk file).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { execSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HOOK = resolve(REPO_ROOT, '.claude/hooks/check-doc-authority-header.sh');

function hasJq(): boolean {
  try {
    execSync('command -v jq', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
const JQ = hasJq();

const tmpRepos: string[] = [];
afterEach(() => {
  for (const d of tmpRepos.splice(0))
    rmSync(d, { recursive: true, force: true });
});

// Make a temp repo-rooted .claude/rules/<name>.md with the given body. Returns its abs path.
function writeRuleDoc(body: string, name = 'test-rule.md'): string {
  const repo = mkdtempSync(join(tmpdir(), 'dah-test-'));
  tmpRepos.push(repo);
  mkdirSync(join(repo, '.claude', 'rules'), { recursive: true });
  const abs = join(repo, '.claude', 'rules', name);
  writeFileSync(abs, body, 'utf8');
  return abs;
}

function runHook(
  absPath: string,
  env: Record<string, string> = {},
): { status: number; stdout: string; stderr: string } {
  // Default-scrub ZCODE_PROJECT_DIR: the runner may execute inside zcode, which would flip
  // the JSON branch and break the CC-exit-2 assertions. Mirrors deps-hash-check.test.ts:106.
  const fullEnv = { ...process.env };
  if (env.ZCODE_PROJECT_DIR === undefined) delete fullEnv.ZCODE_PROJECT_DIR;
  else fullEnv.ZCODE_PROJECT_DIR = env.ZCODE_PROJECT_DIR;
  if (env.CLAUDE_PROJECT_DIR !== undefined)
    fullEnv.CLAUDE_PROJECT_DIR = env.CLAUDE_PROJECT_DIR;
  else if (env.ZCODE_PROJECT_DIR !== undefined)
    fullEnv.CLAUDE_PROJECT_DIR = env.ZCODE_PROJECT_DIR;
  const r = spawnSync('bash', [HOOK], {
    input: JSON.stringify({
      tool_name: 'Edit',
      tool_input: { file_path: absPath },
    }),
    encoding: 'utf8',
    env: fullEnv,
  });
  return {
    status: r.status ?? -1,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
  };
}

describe.skipIf(!JQ)(
  'check-doc-authority-header.sh - PostToolUse doc-authority gate (consumer)',
  () => {
    it('PAIRED-POSITIVE: scoped rule WITH header line -> exit 0, silent', () => {
      const abs = writeRuleDoc(
        `# R\n\n> **Authoritative for:** this rule's scope.\n`,
      );
      const r = runHook(abs, { CLAUDE_PROJECT_DIR: resolve(abs, '../../..') });
      expect(r.status).toBe(0);
      expect(r.stdout).toBe('');
      expect(r.stderr).toBe('');
    });

    it('CC: scoped rule WITHOUT header -> exit 2 + stderr diagnostic (PostToolUse feedback)', () => {
      const abs = writeRuleDoc(`# R\n\nNo authority header here.\n`);
      const r = runHook(abs, { CLAUDE_PROJECT_DIR: resolve(abs, '../../..') });
      expect(r.status).toBe(2);
      expect(r.stderr).toContain('doc-authority');
      expect(r.stderr).toContain('Authoritative for');
      expect(r.stdout).toBe('');
    });

    it('ZCODE: scoped rule WITHOUT header under ZCODE_PROJECT_DIR -> schema-valid {additionalContext} JSON, exit 0', () => {
      // ZCode parses hook stdout against the HookJSONOutput schema (CCt at zcode.cjs:~577900),
      // which is `.strict()` - unknown top-level keys are REJECTED (hook.run.failed, output
      // discarded). PostToolUse cannot block on ZCode (schema Uan rejects permissionDecision;
      // exit 2 is swallowed). The ZCode branch emits schema-valid `{additionalContext}` JSON and
      // exits 0 - advisory, the best available mechanism. Regression guard: catches a prior shape
      // that emitted `{hookEventName, additionalContext}` at top level (silently rejected).
      const abs = writeRuleDoc(`# R\n\nNo header.\n`);
      const r = runHook(abs, { ZCODE_PROJECT_DIR: resolve(abs, '../../..') });
      expect(r.status, 'ZCode path exits 0 (advisory, non-blocking)').toBe(0);
      expect(r.stderr).toBe('');
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
      ).toContain('doc-authority');
      expect(
        parsed.hookEventName,
        'hookEventName must NOT be at top level (CCt.strict rejects it)',
      ).toBeUndefined();
    });

    it('off-path: a .md outside .claude/rules/ -> exit 0 (silent)', () => {
      // Place a file OUTSIDE the rules scope (top-level of the repo, not .claude/rules/*.md).
      const repo = mkdtempSync(join(tmpdir(), 'dah-offpath-'));
      tmpRepos.push(repo);
      const abs = join(repo, 'random.md');
      writeFileSync(abs, `# R\nNo header.\n`, 'utf8');
      const r = runHook(abs, { CLAUDE_PROJECT_DIR: repo });
      expect(r.status).toBe(0);
    });

    it('per-file exemption: 20+ char reason HTML comment -> exit 0', () => {
      const abs = writeRuleDoc(
        `# R\n<!-- doc-authority: exempt this is a long enough reason to skip -->\n`,
      );
      const r = runHook(abs, { CLAUDE_PROJECT_DIR: resolve(abs, '../../..') });
      expect(r.status).toBe(0);
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
  /**
   * Run the hook with jq genuinely absent.
   *
   * TMPDIR is redirected to a fresh dir per call because the hook's notice is
   * once-per-session, keyed by a flag file under TMPDIR (GH #934's «no per-turn
   * error-spam» requirement, preserved literally). Sharing the real TMPDIR would
   * make the first run announce and every later run silent — a self-poisoning,
   * order-dependent test. Caller controls the session via `tmpDir`/`sessionId`.
   */
  function runNoJq(
    filePath: string,
    opts: { tmpDir?: string; sessionId?: string } = {},
  ): { status: number; stdout: string; stderr: string } {
    const binDir = _mkdtempSync(_join(_tmpdir(), 'nojq-'));
    // sed/tr/head back the jq-free escaper + crude path parse; masking them too would
    // test the harness, not the hook. dirname backs the REPO_ROOT fallback line.
    for (const tool of ['sed', 'tr', 'cat', 'head', 'dirname', 'grep', 'sort', 'awk', 'stat', 'date']) {
      const real = _spawnSync('/usr/bin/which', [tool], { encoding: 'utf8' }).stdout?.trim();
      if (real) _symlinkSync(real, _join(binDir, tool));
    }
    const env: Record<string, string> = {
      ...process.env,
      PATH: binDir,
      TMPDIR: opts.tmpDir ?? _mkdtempSync(_join(_tmpdir(), 'dahsess-')),
    } as Record<string, string>;
    delete env.ZCODE_PROJECT_DIR;
    const r = _spawnSync('/bin/bash', [HOOK], {
      input: JSON.stringify({
        tool_name: 'Write',
        session_id: opts.sessionId ?? 'test-session',
        tool_input: { file_path: filePath },
      }),
      encoding: 'utf8',
      env,
    });
    return { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
  }

  it('jq missing + in-scope path → hookSpecificOutput.additionalContext says DID NOT RUN (exit 0)', () => {
    const { status, stdout } = runNoJq('/x/.claude/rules/some-rule.md');
    expect(status).toBe(0);
    const parsed = JSON.parse(stdout.trim()) as {
      hookSpecificOutput: { hookEventName: string; additionalContext: string };
    };
    expect(parsed.hookSpecificOutput.hookEventName).toBe('PostToolUse');
    expect(parsed.hookSpecificOutput.additionalContext).toMatch(/DID NOT RUN/);
    expect(parsed.hookSpecificOutput.additionalContext).toMatch(/not a pass/i);
  });

  it('the notice is once per session — a second in-scope edit is silent (GH #934 no per-turn spam)', () => {
    const session = _mkdtempSync(_join(_tmpdir(), 'dahsess-'));
    const first = runNoJq('/x/.claude/rules/some-rule.md', { tmpDir: session });
    expect(first.stdout).toMatch(/DID NOT RUN/);

    const second = runNoJq('/x/.claude/rules/other-rule.md', { tmpDir: session });
    expect(second.status).toBe(0);
    expect(second.stdout.trim()).toBe('');
  });

  it('jq missing + OUT-of-scope path → silent exit 0 (no per-edit spam in a jq-less env)', () => {
    const { status, stdout } = runNoJq('/x/docs/guide.md');
    expect(status).toBe(0);
    expect(stdout.trim()).toBe('');
  });
});
