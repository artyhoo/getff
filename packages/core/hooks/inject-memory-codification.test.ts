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
import { execSync, execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HOOK = resolve(REPO_ROOT, '.claude/hooks/inject-memory-codification.sh');

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

function payload(tool: string, absPath: string, session: string) {
  return {
    tool_name: tool,
    session_id: session,
    tool_input: { file_path: absPath },
  };
}

const uniq = () => `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;

describe.skipIf(!JQ)('inject-memory-codification.sh — PostToolUse memory-codification reminder', () => {
  it('Write to a /memory/-segment path → valid additionalContext JSON', () => {
    const out = runHook(
      payload('Write', '/Users/art/.claude/projects/-Users-art-code-foo/memory/feedback_x.md', uniq()),
    );
    const json = JSON.parse(out);
    expect(json.hookSpecificOutput.hookEventName).toBe('PostToolUse');
    // GH #934 batch D: the message is now GENERIC — points at the consumer's own repo
    // (CLAUDE.md / .claude/rules/*.md), no framework-internal doc ref (the old
    // `memory-codification.md` pointer was a maintainer-only artefact, wrong at a consumer's).
    expect(json.hookSpecificOutput.additionalContext).toContain('Codify');
    expect(json.hookSpecificOutput.additionalContext).toContain('CLAUDE.md');
    expect(json.hookSpecificOutput.additionalContext).not.toContain('docs/meta-factory');
  });

  it('Write to a normal (non-memory) path → silent (empty stdout)', () => {
    expect(runHook(payload('Write', resolve(REPO_ROOT, 'src/app.ts'), uniq()))).toBe('');
  });

  it('Write to a path merely containing "memory" as a substring, not a "/memory/" segment → silent', () => {
    expect(runHook(payload('Write', resolve(REPO_ROOT, 'src/memory-utils.ts'), uniq()))).toBe('');
  });

  it('non-Write tool (Read) on a /memory/ path → silent even though the path matches', () => {
    expect(
      runHook(payload('Read', '/Users/art/.claude/projects/-Users-art-code-foo/memory/feedback_x.md', uniq())),
    ).toBe('');
  });

  it('non-Write tool (Edit) on a /memory/ path → silent (fires on Write only)', () => {
    expect(
      runHook(payload('Edit', '/Users/art/.claude/projects/-Users-art-code-foo/memory/feedback_x.md', uniq())),
    ).toBe('');
  });

  it('session-cache: injects at most once per session_id', () => {
    const s = uniq();
    const first = runHook(
      payload('Write', '/Users/art/.claude/projects/-Users-art-code-foo/memory/a.md', s),
    );
    const second = runHook(
      payload('Write', '/Users/art/.claude/projects/-Users-art-code-foo/memory/b.md', s),
    );
    expect(first).not.toBe('');
    expect(second).toBe('');
  });

  it('output is non-blocking (exit 0) — execFileSync would throw on non-zero', () => {
    expect(() =>
      runHook(payload('Write', '/Users/art/.claude/projects/-Users-art-code-foo/memory/c.md', uniq())),
    ).not.toThrow();
  });
});
