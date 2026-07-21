/**
 * Functional tests for the SubagentDigest BACKUP hook
 * (.claude/hooks/inject-subagent-context.sh) — the zcode-fallback for the CC-first primary
 * (inject-subagent-digest.sh on SubagentStart, which has no zcode equivalent).
 *
 * Architecture (CC-first, backup-only-if-primary-fails):
 *   • PRIMARY: SubagentStart event + additionalContext → inject-subagent-digest.sh (CC-native,
 *     persistent lifecycle context). Tested separately in inject-subagent-digest.test.ts.
 *   • BACKUP (this hook): PreToolUse:Agent + updatedInput. Gated by _is_zcode so it fires ONLY
 *     on zcode (SubagentStart absent there); on CC it exits 0 silently (primary handles it,
 *     no double injection).
 *
 * Hook contract:
 *   - CC (ZCODE_PROJECT_DIR unset): exit 0, NO stdout (silent — primary owns CC).
 *   - zcode (ZCODE_PROJECT_DIR set): emits {hookSpecificOutput:{hookEventName:"PreToolUse",
 *     updatedInput:{...original tool_input, prompt: original + digest}}} — exit 0, non-blocking.
 *   - updatedInput must echo back ALL original fields (description, prompt, + any optional
 *     subagent_type/model/run_in_background); the host re-validates against the Agent
 *     runtimeInputSchema and silently reverts to the original if a required field is missing.
 *
 * Declared degradation (asserted): the digest is one-shot on zcode (becomes the subagent's
 * first user message), not persistent-lifecycle as on CC — honest, best-available.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HOOK = resolve(REPO_ROOT, '.claude/hooks/inject-subagent-context.sh');
const SOURCE_DIGEST = resolve(REPO_ROOT, '.claude/hooks/inject-session-bootstrap.sh');

// Hermetic fixture (mirrors inject-project-digest.test.ts:makeTempRepo). The hook reads its
// digest from the `<!-- digest:start -->…<!-- digest:end -->` block of
// `$CLAUDE_PROJECT_DIR/.claude/session-bootstrap.md` (hook:44-54). The REAL repo's
// session-bootstrap.md carries no such block by design — the framework's main-session digest is
// emitted dynamically by inject-session-bootstrap.sh's heredoc, never cached as a static block
// (a static copy would drift from the heredoc's dynamic AIF_HOOK_LANG line). So the zcode-branch
// tests MUST supply their own fixture via CLAUDE_PROJECT_DIR instead of relying on the real file.
// We seed the fixture block with inject-session-bootstrap.sh's own output so the SSOT/no-drift
// assertion (`appended ⊇ source digest`) stays meaningful (verifies the hook reads + appends the
// block verbatim, without mangling).
let FIXTURE_ROOT: string;
beforeAll(() => {
  const sourceDigest = execFileSync(
    'bash',
    ['-c', `env -u ZCODE_PROJECT_DIR bash "${SOURCE_DIGEST}"`],
    { encoding: 'utf8' },
  ).trim();
  FIXTURE_ROOT = mkdtempSync(join(tmpdir(), 'isc-test-'));
  mkdirSync(join(FIXTURE_ROOT, '.claude'), { recursive: true });
  writeFileSync(
    join(FIXTURE_ROOT, '.claude', 'session-bootstrap.md'),
    `# Bootstrap\n\n<!-- digest:start -->\n${sourceDigest}\n<!-- digest:end -->\n`,
    'utf8',
  );
});
afterAll(() => {
  if (FIXTURE_ROOT) rmSync(FIXTURE_ROOT, { recursive: true, force: true });
});

/** Run the hook with a PreToolUse:Agent stdin payload and explicit env control. */
function runHook(
  input: Record<string, unknown>,
  env: Record<string, string | undefined>,
): { status: number; stdout: string } {
  // spawnSync inherits process.env by default; we explicitly delete ZCODE_PROJECT_DIR for the
  // CC branch because the test runner may itself run inside zcode (env carries the var).
  const fullEnv = { ...process.env };
  if (env.ZCODE_PROJECT_DIR === undefined) delete fullEnv.ZCODE_PROJECT_DIR;
  else fullEnv.ZCODE_PROJECT_DIR = env.ZCODE_PROJECT_DIR;
  // CLAUDE_PROJECT_DIR selects the digest-source root (hook:44); zcode-branch tests point it at
  // the hermetic fixture so the hook reads a populated digest block instead of the real file.
  if (env.CLAUDE_PROJECT_DIR !== undefined) fullEnv.CLAUDE_PROJECT_DIR = env.CLAUDE_PROJECT_DIR;
  const r = execFileSync('bash', [HOOK], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: fullEnv,
  });
  // execFileSync throws on non-zero; return trimmed stdout for the JSON branches.
  return { status: 0, stdout: r };
}

/** Run the hook capturing exit code (for the silent CC branch that produces no stdout). */
function runHookStatus(
  input: Record<string, unknown>,
  env: Record<string, string | undefined>,
): { status: number; stdout: string } {
  const fullEnv = { ...process.env };
  if (env.ZCODE_PROJECT_DIR === undefined) delete fullEnv.ZCODE_PROJECT_DIR;
  else fullEnv.ZCODE_PROJECT_DIR = env.ZCODE_PROJECT_DIR;
  if (env.CLAUDE_PROJECT_DIR !== undefined) fullEnv.CLAUDE_PROJECT_DIR = env.CLAUDE_PROJECT_DIR;
  try {
    const stdout = execFileSync('bash', [HOOK], {
      input: JSON.stringify(input),
      encoding: 'utf8',
      env: fullEnv,
    });
    return { status: 0, stdout };
  } catch (e) {
    const err = e as { status?: number; stdout?: string };
    return { status: err.status ?? -1, stdout: err.stdout ?? '' };
  }
}

const agentPayload = (overrides: Partial<Record<string, unknown>> = {}) => ({
  tool_name: 'Agent',
  tool_input: {
    description: 'investigate the bundle',
    prompt: 'Find how updatedInput is applied in the hook executor.',
    subagent_type: 'Explore',
    model: 'sonnet',
    run_in_background: false,
    ...overrides,
  },
});

describe('inject-subagent-context.sh — CC-first backup gated by _is_zcode', () => {
  it('CC branch (ZCODE_PROJECT_DIR unset): silent exit 0, no stdout — primary owns CC', () => {
    const { status, stdout } = runHookStatus(agentPayload(), { ZCODE_PROJECT_DIR: undefined });
    expect(status).toBe(0);
    expect(stdout).toBe('');
  });

  it('zcode branch: emits PreToolUse JSON with updatedInput.prompt enriched by the digest', () => {
    const { status, stdout } = runHook(agentPayload(), { ZCODE_PROJECT_DIR: REPO_ROOT, CLAUDE_PROJECT_DIR: FIXTURE_ROOT });
    expect(status).toBe(0);
    const json = JSON.parse(stdout);
    expect(json.hookSpecificOutput.hookEventName).toBe('PreToolUse');
    const updated = json.hookSpecificOutput.updatedInput;
    // prompt augmented with the digest anchor marker + content
    expect(updated.prompt).toContain('[subagent context anchor]');
    expect(updated.prompt).toContain('earliest reachable channel');
    expect(updated.prompt.startsWith('Find how updatedInput')).toBe(true); // original prompt preserved as prefix
  });

  it('updatedInput preserves ALL original tool_input fields (fR re-validates)', () => {
    const { stdout } = runHook(agentPayload(), { ZCODE_PROJECT_DIR: REPO_ROOT, CLAUDE_PROJECT_DIR: FIXTURE_ROOT });
    const updated = JSON.parse(stdout).hookSpecificOutput.updatedInput;
    expect(updated.description).toBe('investigate the bundle');
    expect(updated.subagent_type).toBe('Explore');
    expect(updated.model).toBe('sonnet');
    expect(updated.run_in_background).toBe(false);
  });

  it('Task alias also triggers the hook (matcher Agent|Task)', () => {
    const { stdout } = runHook(agentPayload(), { ZCODE_PROJECT_DIR: REPO_ROOT, CLAUDE_PROJECT_DIR: FIXTURE_ROOT });
    expect(JSON.parse(stdout).hookSpecificOutput.hookEventName).toBe('PreToolUse');
    const taskPayload = agentPayload();
    taskPayload.tool_name = 'Task';
    const { stdout: stdoutTask } = runHook(taskPayload, {
      ZCODE_PROJECT_DIR: REPO_ROOT,
      CLAUDE_PROJECT_DIR: FIXTURE_ROOT,
    });
    expect(JSON.parse(stdoutTask).hookSpecificOutput.hookEventName).toBe('PreToolUse');
  });

  it('ZCode schema-compliance: top-level keys match CCt.strict() (hookSpecificOutput wrapper)', () => {
    // ZCode parses hook stdout against the HookJSONOutput schema (CCt at zcode.cjs:~577900),
    // which is `.strict()` — unknown top-level keys are REJECTED (→ hook.run.failed, output
    // discarded). This hook uses the valid `{hookSpecificOutput:{hookEventName, updatedInput}}`
    // shape (hookEventName INSIDE hookSpecificOutput is allowed by the discriminated union Uan;
    // top-level hookEventName is NOT). Regression guard: catches anyone flattening the wrapper
    // or leaking hookEventName to top level (a prior shape emitted it top-level and was silently
    // rejected by ZCode). Precedent: inject-matching-rule.test.ts:72-105.
    const { stdout } = runHook(agentPayload(), { ZCODE_PROJECT_DIR: REPO_ROOT, CLAUDE_PROJECT_DIR: FIXTURE_ROOT });
    const json = JSON.parse(stdout);
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
    const unknownKeys = Object.keys(json).filter((k) => !allowedTopLevel.has(k));
    expect(
      unknownKeys,
      `ZCode CCt.strict() rejects unknown top-level keys: ${unknownKeys.join(', ')}`,
    ).toEqual([]);
    expect(
      json.hookEventName,
      'hookEventName must NOT be at top level — only inside hookSpecificOutput',
    ).toBeUndefined();
    expect(json.hookSpecificOutput.hookEventName).toBe('PreToolUse');
  });

  it('non-Agent/Task tool: silent exit 0 even under zcode (defensive tool filter)', () => {
    const { status, stdout } = runHookStatus(
      { tool_name: 'Bash', tool_input: { command: 'ls' } },
      { ZCODE_PROJECT_DIR: REPO_ROOT },
    );
    expect(status).toBe(0);
    expect(stdout).toBe('');
  });

  it('non-string prompt (number/null/missing/array tool_input): graceful exit 0, no updatedInput, no stderr noise', () => {
    // The Agent runtimeInputSchema requires prompt:string. A malformed dispatch (prompt:123,
    // prompt:null, missing prompt, array tool_input) must NOT crash jq (type error) nor emit
    // updatedInput (fR would revert anyway, but we guard to avoid stderr noise). Silent exit 0.
    const cases = [
      { description: 'x', prompt: 123 },
      { description: 'x', prompt: null },
      { description: 'x' }, // missing prompt
      [1, 2, 3], // array tool_input
    ];
    for (const tool_input of cases) {
      const { status, stdout } = runHookStatus(
        { tool_name: 'Agent', tool_input },
        { ZCODE_PROJECT_DIR: REPO_ROOT },
      );
      expect(status).toBe(0);
      expect(stdout).toBe(''); // no updatedInput emitted on bad prompt type
    }
  });

    it('SSOT: the digest appended === inject-session-bootstrap.sh plain output (no drift)', () => {
    const { stdout } = runHook(agentPayload(), { ZCODE_PROJECT_DIR: REPO_ROOT, CLAUDE_PROJECT_DIR: FIXTURE_ROOT });
    const appended = JSON.parse(stdout).hookSpecificOutput.updatedInput.prompt as string;
    const sourcePlain = execFileSync(
      'bash',
      ['-c', `env -u ZCODE_PROJECT_DIR bash "${SOURCE_DIGEST}"`],
      { encoding: 'utf8' },
    ).trim();
    // The digest is appended after the original prompt + a separator; verify it's verbatim.
    expect(appended).toContain(sourcePlain);
  });
});
