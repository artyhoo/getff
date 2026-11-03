/**
 * Functional meta-tests for the PostToolUse memory-codification reminder
 * (.claude/hooks/inject-memory-codification.sh) — the write-time alt-channel for
 * .claude/rules/memory-codification.md §3 (evicted from always-on rule context,
 * CTX Stage 1).
 *
 * Asserts the verified PostToolUse injection contract (code.claude.com/docs/en/hooks.md):
 *   - non-blocking injection MUST be JSON {hookSpecificOutput:{hookEventName,additionalContext}}
 *   - a Write whose target path has a "/memory/" segment → injects the codification reminder
 *   - a Write to any other path → silent (empty stdout, exit 0)
 *   - a non-Write tool (Read, Edit) on a /memory/ path → silent (fires on Write only, mirrors
 *     the memory store being WRITTEN, not merely read)
 *   - session-cache → at most once per session_id
 *
 * Skips gracefully when `jq` is unavailable (the hook itself no-ops without jq).
 */
import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { spawnBashOrSkip, type Skippable } from './spawn-bash-or-skip.ts';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HOOK = resolve(REPO_ROOT, '.agents/hooks/inject-memory-codification.sh');

function hasJq(): boolean {
  try {
    execSync('command -v jq', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
const JQ = hasJq();

/** Run the hook with a stdin payload; return the raw spawn result.
 *  POSIX: byte-identical spawnSync pass-through; win32: Git Bash or named skip (#1799). */
function runHookRaw(ctx: Skippable, input: Record<string, unknown>) {
  return spawnBashOrSkip(ctx, 'bash', [HOOK], {
    input: JSON.stringify(input),
    encoding: 'utf8',
  });
}

/** Run the hook with a stdin payload; return trimmed stdout. */
function runHook(ctx: Skippable, input: Record<string, unknown>): string {
  return (runHookRaw(ctx, input).stdout ?? '').trim();
}

function payload(tool: string, absPath: string, session: string) {
  return {
    tool_name: tool,
    session_id: session,
    tool_input: { file_path: absPath },
  };
}

const uniq = () => `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;

describe.skipIf(!JQ)(
  'inject-memory-codification.sh — PostToolUse memory-codification reminder',
  () => {
    it('Write to a /memory/-segment path → valid additionalContext JSON', (ctx) => {
      const out = runHook(ctx,
        payload(
          'Write',
          '/Users/art/.claude/projects/-Users-art-code-foo/memory/feedback_x.md',
          uniq(),
        ),
      );
      const json = JSON.parse(out);
      expect(json.hookSpecificOutput.hookEventName).toBe('PostToolUse');
      // GH #934 batch D: the message is now GENERIC — points at the consumer's own repo
      // (CLAUDE.md / .claude/rules/*.md), no framework-internal doc ref (the old
      // `memory-codification.md` pointer was a maintainer-only artefact, wrong at a consumer's).
      expect(json.hookSpecificOutput.additionalContext).toContain('Codify');
      expect(json.hookSpecificOutput.additionalContext).toContain('CLAUDE.md');
      expect(json.hookSpecificOutput.additionalContext).not.toContain(
        'docs/meta-factory',
      );
    });

    it('ZCode schema-compliance: top-level keys match CCt.strict() (hookSpecificOutput wrapper)', (ctx) => {
      // ZCode parses hook stdout against the HookJSONOutput schema (CCt at zcode.cjs:~577900),
      // which is `.strict()` — unknown top-level keys are REJECTED (→ hook.run.failed, output
      // discarded). This hook uses the valid `{hookSpecificOutput:{hookEventName, additionalContext}}`
      // shape (hookEventName INSIDE hookSpecificOutput is allowed; top-level is NOT). Regression
      // guard: catches anyone flattening the wrapper to top-level hookEventName.
      const out = runHook(ctx,
        payload(
          'Write',
          '/Users/art/.claude/projects/-Users-art-code-foo/memory/schema_y.md',
          uniq(),
        ),
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
    });

    it('Write to a normal (non-memory) path → silent (empty stdout)', (ctx) => {
      expect(
        runHook(ctx, payload('Write', resolve(REPO_ROOT, 'src/app.ts'), uniq())),
      ).toBe('');
    });

    it('Write to a path merely containing "memory" as a substring, not a "/memory/" segment → silent', (ctx) => {
      expect(
        runHook(
          ctx,
          payload('Write', resolve(REPO_ROOT, 'src/memory-utils.ts'), uniq()),
        ),
      ).toBe('');
    });

    it('non-Write tool (Read) on a /memory/ path → silent even though the path matches', (ctx) => {
      expect(
        runHook(
          ctx,
          payload(
            'Read',
            '/Users/art/.claude/projects/-Users-art-code-foo/memory/feedback_x.md',
            uniq(),
          ),
        ),
      ).toBe('');
    });

    it('non-Write tool (Edit) on a /memory/ path → silent (fires on Write only)', (ctx) => {
      expect(
        runHook(
          ctx,
          payload(
            'Edit',
            '/Users/art/.claude/projects/-Users-art-code-foo/memory/feedback_x.md',
            uniq(),
          ),
        ),
      ).toBe('');
    });

    it('session-cache: injects at most once per session_id', (ctx) => {
      const s = uniq();
      const first = runHook(
        ctx,
        payload(
          'Write',
          '/Users/art/.claude/projects/-Users-art-code-foo/memory/a.md',
          s,
        ),
      );
      const second = runHook(
        ctx,
        payload(
          'Write',
          '/Users/art/.claude/projects/-Users-art-code-foo/memory/b.md',
          s,
        ),
      );
      expect(first).not.toBe('');
      expect(second).toBe('');
    });

    it('output is non-blocking (exit 0) — execFileSync would throw on non-zero', (ctx) => {
      // exit 0 ⇔ the old execFileSync form did not throw
      expect(runHookRaw(ctx, payload(
        'Write',
        '/Users/art/.claude/projects/-Users-art-code-foo/memory/c.md',
        uniq(),
      )).status).toBe(0);
    });
  },
);
