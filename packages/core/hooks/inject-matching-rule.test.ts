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
 * Skips gracefully when `jq` is unavailable (the hook itself no-ops without jq).
 */
import { describe, it, expect } from 'vitest';
import { execSync, execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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

/** Run the hook with a stdin payload; return trimmed stdout. */
function runHook(input: Record<string, unknown>): string {
  return execFileSync('bash', [HOOK], {
    input: JSON.stringify(input),
    encoding: 'utf8',
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
