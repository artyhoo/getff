/**
 * Functional meta-tests for the PostToolUse rule-injector hook
 * (.claude/hooks/inject-matching-rule.sh) — the Class-B compensating mechanism
 * for .claude/rules/rule-enforcement-channel-selection.md (§4).
 *
 * Asserts the verified PostToolUse injection contract (code.claude.com/docs/en/hooks.md):
 *   - non-blocking injection MUST be JSON {hookSpecificOutput:{hookEventName,additionalContext}}
 *   - matching path → injects the rule's `<!-- inject: -->` summary
 *   - non-match / wrong tool → silent (empty stdout, exit 0)
 *   - session-cache → at most once per session_id
 *   - prose that documents the marker syntax is NOT mis-detected (own-line anchor)
 *
 * S6 honest-no-op paired fixture (kickoff §4): when the consumer has NO rules corpus
 * (RULES_DIR missing OR empty of .md files), the hook reports ONCE per session loudly,
 * then stays quiet. Both halves asserted: first call emits, second call is silent.
 * Control: hook still fires normally when a corpus IS present. Test seam: RULES_DIR_OVERRIDE.
 *
 * Skips gracefully when `jq` is unavailable (the hook itself no-ops without jq).
 */
import { describe, it, expect } from 'vitest';
import { execSync, execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HOOK = resolve(REPO_ROOT, '.claude/hooks/inject-matching-rule.sh');

function hasJq(): boolean {
  try {
    execSync('command -v jq', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
const JQ = hasJq();

/** Run the hook with a stdin payload; return trimmed stdout. Optional env overrides for the
 * S6 test seam (RULES_DIR_OVERRIDE). */
function runHook(input: Record<string, unknown>, env?: NodeJS.ProcessEnv): string {
  return execFileSync('bash', [HOOK], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: env ? { ...process.env, ...env } : undefined,
  }).trim();
}

function payload(tool: string, relPath: string, session: string) {
  return {
    tool_name: tool,
    session_id: session,
    tool_input: { file_path: resolve(REPO_ROOT, relPath) },
  };
}

const uniq = () => `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;

describe.skipIf(!JQ)(
  'inject-matching-rule.sh — PostToolUse rule-injector',
  () => {
    it('matching path (.claude/rules/**) on Edit → valid additionalContext JSON', () => {
      const out = runHook(
        payload('Edit', '.claude/rules/some-new-rule.md', uniq()),
      );
      const json = JSON.parse(out);
      expect(json.hookSpecificOutput.hookEventName).toBe('PostToolUse');
      // guards the own-line-anchor fix: we get the real `<!-- inject: -->` summary,
      // not a mis-match against the prose that documents the marker syntax.
      expect(json.hookSpecificOutput.additionalContext).toContain(
        'Channel-selection',
      );
      // and the injected summary itself must not leak the glob-subset doc text.
      expect(json.hookSpecificOutput.additionalContext).not.toContain(
        'subset:',
      );
    });

    it('ZCode schema-compliance: top-level keys match CCt.strict() (hookSpecificOutput wrapper)', () => {
      // ZCode parses hook stdout against the HookJSONOutput schema (CCt at zcode.cjs:~577900),
      // which is `.strict()` — unknown top-level keys are REJECTED (→ hook.run.failed, output
      // discarded). This hook uses the valid `{hookSpecificOutput:{hookEventName, additionalContext}}`
      // shape (hookEventName INSIDE hookSpecificOutput is allowed by the discriminated union Uan;
      // top-level hookEventName is NOT). Regression guard: catches anyone flattening the wrapper.
      const out = runHook(
        payload('Edit', '.claude/rules/schema-test.md', uniq()),
      );
      const json = JSON.parse(out);
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
      const unknownKeys = Object.keys(json).filter(
        (k) => !allowedTopLevel.has(k),
      );
      expect(
        unknownKeys,
        `ZCode CCt.strict() rejects unknown top-level keys: ${unknownKeys.join(', ')}`,
      ).toEqual([]);
      expect(
        json.hookEventName,
        'hookEventName must NOT be at top level — only inside hookSpecificOutput',
      ).toBeUndefined();
      expect(json.hookSpecificOutput.hookEventName).toBe('PostToolUse');
    });

    it('matching path (packages/core/principles/**) → injects', () => {
      const out = runHook(
        payload('Write', 'packages/core/principles/99-x.test.ts', uniq()),
      );
      expect(JSON.parse(out).hookSpecificOutput.additionalContext).toContain(
        'Channel-selection',
      );
    });

    it('non-matching path → silent (empty stdout)', () => {
      expect(runHook(payload('Write', 'src/app.ts', uniq()))).toBe('');
    });

    it('non-edit tool (Read) → silent even on a matching path', () => {
      expect(
        runHook(payload('Read', '.claude/rules/some-new-rule.md', uniq())),
      ).toBe('');
    });

    it('session-cache: injects at most once per session_id', () => {
      const s = uniq();
      const first = runHook(payload('Edit', '.claude/rules/a.md', s));
      const second = runHook(payload('Edit', '.claude/rules/b.md', s));
      expect(first).not.toBe('');
      expect(second).toBe('');
    });

    it('output is non-blocking (exit 0) — execFileSync would throw on non-zero', () => {
      // matching-path run already executed above without throwing; assert explicitly here too
      expect(() =>
        runHook(payload('Edit', '.claude/rules/c.md', uniq())),
      ).not.toThrow();
    });
  },
);

/**
 * S6 honest-no-op paired fixture (kickoff §4). When RULES_DIR has no .md corpus
 * (directory missing OR empty), the hook reports ONCE per session loudly, then stays
 * quiet. Both halves asserted; control proves the hook still fires normally with a corpus.
 *
 * T-HS-A binding: PRIMARY assertions are output presence / exit code / JSON shape;
 * wording checks are SECONDARY (non-load-bearing). Test seam = RULES_DIR_OVERRIDE env
 * (kickoff §2 planner decision 2, option a).
 */
describe.skipIf(!JQ)(
  'inject-matching-rule.sh — S6 honest no-op (corpus absent → report once, then quiet)',
  () => {
    /** Build a unique non-existent RULES_DIR path → triggers corpus-absent branch. */
    function absentRulesPath(): string {
      return join(tmpdir(), `no-rules-${uniq()}`);
    }

    /** Build a real temp RULES_DIR containing one fake rule with globs+inject markers. */
    function presentRulesPathWithFakeRule(): string {
      const dir = mkdtempSync(join(tmpdir(), `with-rules-${uniq()}-`));
      writeFileSync(
        join(dir, 'fake-rule.md'),
        [
          '<!-- globs: .claude/rules/** -->',
          '<!-- inject: Fake-rule-summary -->',
          '# Fake rule for S6 control test',
          '',
        ].join('\n'),
      );
      return dir;
    }

    it('corpus absent (RULES_DIR missing) → emits JSON report on first call (T-HS-A primary)', () => {
      const out = runHook(
        payload('Edit', '.claude/rules/some-rule.md', uniq()),
        { RULES_DIR_OVERRIDE: absentRulesPath() },
      );
      // PRIMARY (T-HS-A): observable output presence first.
      expect(out).not.toBe('');
      const json = JSON.parse(out);
      expect(json.hookSpecificOutput.hookEventName).toBe('PostToolUse');
      // SECONDARY (wording — non-load-bearing per T-HS-A).
      expect(json.hookSpecificOutput.additionalContext).toContain('inject-matching-rule');
      expect(json.hookSpecificOutput.additionalContext).toContain('no rules corpus');
    });

    it('corpus absent → second call with same session_id is silent (once-per-session)', () => {
      const empty = absentRulesPath();
      const session = uniq();
      const first = runHook(
        payload('Edit', '.claude/rules/a.md', session),
        { RULES_DIR_OVERRIDE: empty },
      );
      const second = runHook(
        payload('Edit', '.claude/rules/b.md', session),
        { RULES_DIR_OVERRIDE: empty },
      );
      // Both halves asserted (kickoff §4): first reports, second does not repeat.
      expect(first).not.toBe('');
      expect(second).toBe('');
    });

    it('corpus absent + new session → reports again (cache is per-session, not per-install)', () => {
      const empty = absentRulesPath();
      const firstSession = uniq();
      const secondSession = uniq();
      const first = runHook(
        payload('Edit', '.claude/rules/a.md', firstSession),
        { RULES_DIR_OVERRIDE: empty },
      );
      const second = runHook(
        payload('Edit', '.claude/rules/b.md', secondSession),
        { RULES_DIR_OVERRIDE: empty },
      );
      expect(first).not.toBe('');
      expect(second).not.toBe('');
    });

    it('corpus absent → exit 0 (non-blocking, even when reporting)', () => {
      expect(() =>
        runHook(
          payload('Edit', '.claude/rules/c.md', uniq()),
          { RULES_DIR_OVERRIDE: absentRulesPath() },
        ),
      ).not.toThrow();
    });

    it('corpus present (control) → hook still fires normal injection, no-op path did not disable it', () => {
      const rules = presentRulesPathWithFakeRule();
      try {
        const out = runHook(
          payload('Edit', '.claude/rules/x.md', uniq()),
          { RULES_DIR_OVERRIDE: rules },
        );
        const json = JSON.parse(out);
        expect(json.hookSpecificOutput.hookEventName).toBe('PostToolUse');
        expect(json.hookSpecificOutput.additionalContext).toContain('Fake-rule-summary');
      } finally {
        rmSync(rules, { recursive: true, force: true });
      }
    });
  },
);
