/**
 * Functional tests for the plugin SessionStart bootstrap hook (plugin/hooks/session-start).
 *
 * Plugin-only hook (NO dogfood .claude/hooks/ twin — exists solely in the plugin channel).
 * Invoked via run-hook.cmd from plugin/hooks/hooks.json (matcher: startup|clear|compact).
 * Injects the getff entry-point context so the using-getff skill auto-triggers without a
 * manual Skill invocation at session start.
 *
 * One hook, dual-harness via inline _emit_bootstrap branching (hook:26-33):
 *   - CC (ZCODE_PROJECT_DIR unset): plain SessionStart stdout is auto-injected into context.
 *   - ZCode (ZCODE_PROJECT_DIR set): stdout must be strict-JSON {additionalContext} (plain is
 *     discarded + the run is marked failed under CCt.strict()).
 *
 * Contract:
 *   - CC path: plain stdout carries the bootstrap block (anchor marker present).
 *   - ZCode path: JSON {additionalContext} where additionalContext carries the block.
 *   - ZCode top-level keys must be in the allowed set (CCt.strict() rejects unknowns);
 *     hookEventName must NOT be at top level (regression guard — cold backward-sweep GAP-3).
 *   - jq absent + ZCode: falls back to plain stdout (graceful degradation).
 *
 * NOTE: this hook is plugin-only and is NOT in .ai-factory/harness-model.json (it ships as
 * part of the getff plugin payload, not rendered by emitPlugin from the framework SSOT). The
 * test runs it directly via bash (on Unix run-hook.cmd just execs the named script).
 *
 * Skips gracefully when jq is unavailable (the ZCode JSON branch needs jq).
 * Precedent: inject-project-digest.test.ts (temp-repo + dual-event pattern),
 * deps-hash-check.test.ts:164 (ZCode schema arm).
 */
import { describe, it, expect } from 'vitest';
import { execSync, spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HOOK = resolve(REPO_ROOT, 'plugin/hooks/session-start');

function hasJq(): boolean {
  try {
    execSync('command -v jq', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
const JQ = hasJq();

/** Run the hook with explicit env control. SessionStart does not read stdin for dispatch. */
function runHook(
  env: Record<string, string | undefined>,
): { status: number; stdout: string; stderr: string } {
  const fullEnv = { ...process.env };
  if (env.ZCODE_PROJECT_DIR === undefined) delete fullEnv.ZCODE_PROJECT_DIR;
  else fullEnv.ZCODE_PROJECT_DIR = env.ZCODE_PROJECT_DIR;
  const r = spawnSync('bash', [HOOK], {
    input: '',
    encoding: 'utf8',
    env: fullEnv,
  });
  return {
    status: r.status ?? -1,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
  };
}

describe('session-start — plugin SessionStart bootstrap (CC plain-stdout path)', () => {
  it('CC: plain stdout carries the getff bootstrap anchor block (exit 0)', () => {
    const r = runHook({ ZCODE_PROJECT_DIR: undefined });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('[getff plugin — session bootstrap]');
    expect(r.stdout).toContain('using-getff');
    expect(r.stdout).toContain('earliest reachable channel');
  });

  it('CC: plain stdout mentions the instruction-priority ladder (repo wins)', () => {
    const r = runHook({ ZCODE_PROJECT_DIR: undefined });
    expect(r.stdout).toContain('Instruction priority');
    expect(r.stdout).toContain('WIN over');
  });
});

describe.skipIf(!JQ)(
  'session-start — ZCode JSON path + schema-compliance (jq required)',
  () => {
    it('ZCode: emits {additionalContext} JSON carrying the bootstrap block', () => {
      const r = runHook({ ZCODE_PROJECT_DIR: REPO_ROOT });
      expect(r.status).toBe(0);
      const json = JSON.parse(r.stdout);
      expect(typeof json.additionalContext).toBe('string');
      expect(json.additionalContext).toContain('[getff plugin — session bootstrap]');
      expect(json.additionalContext).toContain('using-getff');
    });

    it('ZCode schema-compliance: top-level keys match CCt.strict() (no stray hookEventName)', () => {
      // ZCode parses hook stdout against the HookJSONOutput schema (CCt at zcode.cjs:~577900),
      // which is `.strict()` — unknown top-level keys are REJECTED (→ hook.run.failed, output
      // discarded). This plugin hook emits a minimal {additionalContext} shape today, but there
      // was NO guard against a future edit adding hookEventName (or any other key) at top level,
      // which ZCode would silently reject. Regression guard (cold backward-sweep finding GAP-3):
      // pin the allowed top-level set. Precedent: ask-question-reminder.test.ts:139.
      const r = runHook({ ZCODE_PROJECT_DIR: REPO_ROOT });
      const json = JSON.parse(r.stdout);
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
        'hookEventName must NOT be at top level (CCt.strict rejects it)',
      ).toBeUndefined();
    });

    it('SSOT: ZCode additionalContext === CC plain stdout (same block, one source)', () => {
      // Dual-harness contract: both paths deliver the SAME bootstrap block from ONE source
      // (the heredoc at hook:35-58). A divergence would mean the two paths drift.
      const cc = runHook({ ZCODE_PROJECT_DIR: undefined }).stdout;
      const zcode = JSON.parse(runHook({ ZCODE_PROJECT_DIR: REPO_ROOT }).stdout)
        .additionalContext as string;
      expect(zcode.trim()).toBe(cc.trim());
    });
  },
);
