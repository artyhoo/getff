/**
 * Functional tests for the dual-event consumer hook inject-project-digest.sh —
 * the project-agnostic adaptation of inject-session-bootstrap.sh / inject-subagent-digest.sh.
 *
 * Shipped to consumer CC projects (GH #934 batch D). Injects the CONSUMER's OWN anchor:
 * the digest block (between <!-- digest:start --> and <!-- digest:end --> markers) of THEIR
 * .claude/session-bootstrap.md. Zero-setup: empty/absent block -> injects nothing.
 *
 * One hook, two events (registered on both — output format differs per the CC contract):
 *   - UserPromptSubmit  -> plain stdout is auto-injected into the prompt context.
 *   - SubagentStart     -> context must be JSON hookSpecificOutput.additionalContext (needs jq).
 *
 * The shared digest source is the block between the markers in .claude/session-bootstrap.md,
 * so the main session AND every dispatched subagent get the same project anchor from ONE SSOT.
 *
 * Paired-negative contract:
 *   - digest block present + UserPromptSubmit stdin -> plain stdout = block content verbatim
 *   - digest block present + SubagentStart stdin (jq) -> JSON {hookSpecificOutput:{hookEventName,
 *     additionalContext}}; hookEventName inside the wrapper (NOT top level — ZCode CCt.strict()
 *     rejects top-level hookEventName).
 *   - no .claude/session-bootstrap.md -> silent exit 0 (zero-setup default)
 *   - file present but no digest markers -> silent exit 0 (empty block, ships empty on purpose)
 *   - whitespace-only block -> silent exit 0
 *   - jq absent + SubagentStart -> falls back to plain-stdout path (EVENT stays "")
 *
 * Sandbox: the hook computes REPO_ROOT as `cd "$(dirname "$0")/../.."` (hook:18), then reads
 * `$REPO_ROOT/.claude/session-bootstrap.md` (hook:19). We mirror this by copying the hook into
 * a temp repo-rooted layout (.hooks/inject-project-digest.sh) and writing the fixture
 * session-bootstrap.md at <tmp>/.claude/session-bootstrap.md. The temp hook's REPO_ROOT
 * computation then resolves to the temp dir, isolating the test from this repo's real file.
 *
 * ZCode schema arm: this hook is consumer-only and ships via install.sh (NOT in
 * .ai-factory/harness-model.json -> emitPlugin does not render it to plugin/hooks/hooks.json).
 * The JSON SubagentStart branch must still be schema-valid for any harness or manual replay;
 * the dedicated arm guards the output shape against CCt.strict() (regression: a prior shape
 * emitted {hookEventName, additionalContext} at top level and was silently rejected by ZCode).
 *
 * Skips gracefully when jq is unavailable (the SubagentStart path needs jq; the UserPromptSubmit
 * path uses awk and works without jq).
 * Precedent: inject-subagent-digest.test.ts (SSOT+schema pattern), deps-hash-check.test.ts:164.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { execSync, spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  copyFileSync,
  rmSync,
} from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HOOK_SOURCE = resolve(
  REPO_ROOT,
  '.claude/hooks/inject-project-digest.sh',
);

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

/**
 * Build a temp repo: <tmp>/.claude/session-bootstrap.md with the given body, and a copy of the
 * hook at <tmp>/.claude/hooks/inject-project-digest.sh so the hook's REPO_ROOT computation
 * (dirname $0/../..) resolves to <tmp> (mirrors the real .claude/hooks/ depth-2 layout).
 * Returns { hookAbs, repoRoot }.
 */
function makeTempRepo(sessionBootstrapBody: string): {
  hookAbs: string;
  repoRoot: string;
} {
  const repoRoot = mkdtempSync(join(tmpdir(), 'ipd-test-'));
  tmpRepos.push(repoRoot);
  mkdirSync(join(repoRoot, '.claude', 'hooks'), { recursive: true });
  writeFileSync(
    join(repoRoot, '.claude', 'session-bootstrap.md'),
    sessionBootstrapBody,
    'utf8',
  );
  const hookAbs = join(
    repoRoot,
    '.claude',
    'hooks',
    'inject-project-digest.sh',
  );
  copyFileSync(HOOK_SOURCE, hookAbs);
  return { hookAbs, repoRoot };
}

const DIGEST_BODY = `# Project bootstrap

<!-- digest:start -->
This is the consumer's project anchor.
Earliest reachable channel: edit-time.
<!-- digest:end -->

Rest of the doc.
`;

/** Run the hook with the given stdin payload (hook reads stdin to detect hook_event_name). */
function runHook(
  hookAbs: string,
  stdin: object | null,
): { status: number; stdout: string; stderr: string } {
  const r = spawnSync('bash', [hookAbs], {
    input: stdin === null ? '' : JSON.stringify(stdin),
    encoding: 'utf8',
  });
  return {
    status: r.status ?? -1,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
  };
}

describe('inject-project-digest.sh — consumer dual-event anchor injector', () => {
  it('UserPromptSubmit path: digest block -> plain stdout = block content verbatim (exit 0)', () => {
    // The hook reads stdin only to detect hook_event_name; for UserPromptSubmit (or jq-absent)
    // the EVENT stays "" and the plain-stdout branch (hook:42) fires.
    const { hookAbs } = makeTempRepo(DIGEST_BODY);
    const r = runHook(hookAbs, { hook_event_name: 'UserPromptSubmit' });
    expect(r.status).toBe(0);
    // Plain stdout carries the block content (awk-extracted, markers stripped).
    expect(r.stdout).toContain("consumer's project anchor");
    expect(r.stdout).toContain('edit-time');
    // Markers themselves are NOT part of the block.
    expect(r.stdout).not.toContain('digest:start');
    expect(r.stdout).not.toContain('digest:end');
  });

  it('zero-setup: no .claude/session-bootstrap.md -> silent exit 0', () => {
    // hook:20 — [ -f "$DIGEST_FILE" ] || exit 0. Build a temp repo then DELETE the file.
    const repoRoot = mkdtempSync(join(tmpdir(), 'ipd-nofile-'));
    tmpRepos.push(repoRoot);
    mkdirSync(join(repoRoot, '.claude', 'hooks'), { recursive: true });
    const hookAbs = join(
      repoRoot,
      '.claude',
      'hooks',
      'inject-project-digest.sh',
    );
    copyFileSync(HOOK_SOURCE, hookAbs);
    // No .claude/session-bootstrap.md written.
    const r = runHook(hookAbs, { hook_event_name: 'UserPromptSubmit' });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
  });

  it('empty markers: file present but no digest:start/end -> silent exit 0 (ships empty on purpose)', () => {
    const { hookAbs } = makeTempRepo('# Project doc\n\nNo markers here.\n');
    const r = runHook(hookAbs, { hook_event_name: 'UserPromptSubmit' });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
  });

  it('whitespace-only block -> silent exit 0 (hook:28 stripped-space guard)', () => {
    const body = `# P\n\n<!-- digest:start -->\n   \n\t\n<!-- digest:end -->\n`;
    const { hookAbs } = makeTempRepo(body);
    const r = runHook(hookAbs, { hook_event_name: 'UserPromptSubmit' });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
  });
});

describe.skipIf(!JQ)(
  'inject-project-digest.sh — SubagentStart JSON path (jq required)',
  () => {
    it('SubagentStart: digest block -> JSON {hookSpecificOutput:{hookEventName, additionalContext}}', () => {
      const { hookAbs } = makeTempRepo(DIGEST_BODY);
      const r = runHook(hookAbs, { hook_event_name: 'SubagentStart' });
      expect(r.status).toBe(0);
      const json = JSON.parse(r.stdout);
      expect(json.hookSpecificOutput.hookEventName).toBe('SubagentStart');
      expect(typeof json.hookSpecificOutput.additionalContext).toBe('string');
      expect(json.hookSpecificOutput.additionalContext).toContain(
        "consumer's project anchor",
      );
    });

    it('ZCode schema-compliance: top-level keys match CCt.strict() (hookSpecificOutput wrapper)', () => {
      // ZCode parses hook stdout against the HookJSONOutput schema (CCt at zcode.cjs:~577900),
      // which is `.strict()` — unknown top-level keys are REJECTED (-> hook.run.failed, output
      // discarded). This hook uses the valid {hookSpecificOutput:{hookEventName, additionalContext}}
      // shape (hookEventName INSIDE hookSpecificOutput is allowed by the discriminated union Uan;
      // top-level hookEventName is NOT). Regression guard: catches anyone flattening the wrapper
      // or leaking hookEventName to top level (a prior shape emitted it top-level and was silently
      // rejected by ZCode). Precedent: inject-matching-rule.test.ts:72.
      // NOTE: consumer-only hook — ships via install.sh, NOT in harness-model.json, so emitPlugin
      // does not render it to plugin/hooks/hooks.json (architectural gap, separate owner-decision).
      // The JSON shape must still be schema-valid for manual replay / any harness.
      const { hookAbs } = makeTempRepo(DIGEST_BODY);
      const r = runHook(hookAbs, { hook_event_name: 'SubagentStart' });
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
        'hookEventName must NOT be at top level — only inside hookSpecificOutput',
      ).toBeUndefined();
      expect(json.hookSpecificOutput.hookEventName).toBe('SubagentStart');
    });

    it('SSOT: SubagentStart additionalContext === UserPromptSubmit plain stdout (same block, one source)', () => {
      // Dual-event contract: both events deliver the SAME block from ONE source. A divergence
      // would mean the two paths drift (#two-prompts-drift anti-pattern).
      const { hookAbs } = makeTempRepo(DIGEST_BODY);
      const ups = runHook(hookAbs, { hook_event_name: 'UserPromptSubmit' })
        .stdout;
      const ss = JSON.parse(
        runHook(hookAbs, { hook_event_name: 'SubagentStart' }).stdout,
      ).hookSpecificOutput.additionalContext as string;
      // The SubagentStart path uses jq --arg (preserves trailing newline); the UserPromptSubmit
      // path uses printf '%s\n'. Both carry the block content; compare trimmed to absorb the
      // trailing-newline difference.
      expect(ss.trim()).toBe(ups.trim());
    });
  },
);

// =============================================================================
// B1 source-level fix (zcode-parity-step1, plan-v3 §"B1"): env-first REPO_ROOT.
// Pre-fix: REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)" — $0-relative only. Correct
// when install.sh copies the hook INTO the consumer repo (.claude/hooks/depth-2); WRONG
// for a future plugin-twin payload ($0 = ${CLAUDE_PLUGIN_ROOT}/hooks/, resolves to the
// plugin payload dir, NOT the consumer root). The `$(cd …)` is a subshell — cwd change is
// discarded, only the path string is captured — so the deps-hash-check cd-guard form is
// inapplicable (T16).
// Post-fix: REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}" — env-first
// with $0-relative fallback. Matches the 7 already-fixed plugin twins (verified Mode A).
//
// §1.7 Backward contract (strengthened vs v2): "fixture IS read WITH rewrite; fixture is
// NOT read WITHOUT rewrite" — the test below simulates the plugin-twin scenario where
// $0-relative resolves to the WRONG dir (a fake payload dir) but CLAUDE_PROJECT_DIR points
// to the consumer root holding the fixture. With the rewrite: fixture read. Without: silent
// exit 0 ($0-relative lands in the payload dir, no session-bootstrap.md there).
// =============================================================================
describe('inject-project-digest.sh — B1 env-first REPO_ROOT resolution (zcode-parity-step1)', () => {
  /**
   * Build the plugin-twin scenario: hook at <payload>/.claude/hooks/inject-project-digest.sh
   * (a SEPARATE temp dir from the consumer root), fixture at <consumer>/.claude/session-bootstrap.md.
   * With the B1 rewrite + CLAUDE_PROJECT_DIR=<consumer>: fixture IS read.
   * Without the rewrite: $0-relative resolves to <payload>/../.. = a temp parent with no
   * .claude/session-bootstrap.md → silent exit 0.
   */
  function makePluginTwinScenario(sessionBootstrapBody: string): {
    hookAbs: string;
    consumerRoot: string;
    payloadRoot: string;
  } {
    const consumerRoot = mkdtempSync(join(tmpdir(), 'ipd-b1-consumer-'));
    const payloadRoot = mkdtempSync(join(tmpdir(), 'ipd-b1-payload-'));
    tmpRepos.push(consumerRoot, payloadRoot);
    mkdirSync(join(consumerRoot, '.claude'), { recursive: true });
    writeFileSync(
      join(consumerRoot, '.claude', 'session-bootstrap.md'),
      sessionBootstrapBody,
      'utf8',
    );
    // Place the hook at <payload>/.claude/hooks/ — depth-2 mirroring the real layout, but
    // under a SEPARATE root from the consumer. $0-relative REPO_ROOT computation resolves to
    // <payload> (NOT <consumerRoot>), so without the env-first arm the fixture is invisible.
    mkdirSync(join(payloadRoot, '.claude', 'hooks'), { recursive: true });
    const hookAbs = join(
      payloadRoot,
      '.claude',
      'hooks',
      'inject-project-digest.sh',
    );
    copyFileSync(HOOK_SOURCE, hookAbs);
    return { hookAbs, consumerRoot, payloadRoot };
  }

  it('env_var_first_resolution_reads_consumer_root: CLAUDE_PROJECT_DIR set → fixture at consumer root IS read', () => {
    // plan-v3 §1.7 Forward row 11: with the rewrite, the env-first arm wins and the fixture
    // at $CLAUDE_PROJECT_DIR/.claude/session-bootstrap.md is read.
    const { hookAbs, consumerRoot } = makePluginTwinScenario(DIGEST_BODY);
    const r = runHookWithEnv(hookAbs, { hook_event_name: 'UserPromptSubmit' }, {
      CLAUDE_PROJECT_DIR: consumerRoot,
    });
    expect(r.status, `stderr: ${r.stderr}`).toBe(0);
    // The fixture's digest content reaches stdout — proves env-first resolution read it.
    expect(r.stdout).toContain("consumer's project anchor");
    expect(r.stdout).toContain('edit-time');
  });

  it('dogfood_fallback_when_env_unset: CLAUDE_PROJECT_DIR unset → $0-relative fallback resolves correctly', () => {
    // plan-v3 §1.7 Forward row 12: the fallback arm preserves dogfood behaviour (hook copied
    // into the consumer repo at .claude/hooks/depth-2 — $0-relative resolves to consumer root).
    // We use makeTempRepo (hook + fixture under the SAME temp root) and UNSET the env var.
    const { hookAbs } = makeTempRepo(DIGEST_BODY);
    const r = runHookWithEnv(
      hookAbs,
      { hook_event_name: 'UserPromptSubmit' },
      { CLAUDE_PROJECT_DIR: '' },  // explicit unset (process.env may leak it)
    );
    expect(r.status, `stderr: ${r.stderr}`).toBe(0);
    // Fallback resolves correctly: $0-relative computation lands at the temp repo root,
    // fixture IS read, digest content reaches stdout.
    expect(r.stdout).toContain("consumer's project anchor");
  });

  it('backward_plugin_twin_fixture_not_read_without_rewrite: simulated pre-fix behaviour → silent exit 0', () => {
    // plan-v3 §1.7 Backward row "B1 rewrite absent": WITHOUT the env-first arm, the plugin-twin
    // scenario resolves REPO_ROOT to the payload dir (no session-bootstrap.md there) → silent exit 0.
    // We SIMULATE the pre-fix behaviour by UNSETTING CLAUDE_PROJECT_DIR in the plugin-twin
    // scenario (where hook and fixture live under DIFFERENT temp roots). This is the
    // "fixture is NOT read without rewrite" half of the strengthened backward contract.
    const { hookAbs } = makePluginTwinScenario(DIGEST_BODY);
    const r = runHookWithEnv(
      hookAbs,
      { hook_event_name: 'UserPromptSubmit' },
      { CLAUDE_PROJECT_DIR: '' },  // simulate pre-fix: env-first arm absent
    );
    expect(r.status, `stderr: ${r.stderr}`).toBe(0);
    // $0-relative resolves to <payload>/../.. (a temp parent) — no session-bootstrap.md there.
    // Hook hits the `[ -f "$DIGEST_FILE" ] || exit 0` guard at hook:20 and stays silent.
    expect(r.stdout, 'pre-fix plugin-twin path: fixture absent under $0-relative → silent').toBe('');
  });
});

/**
 * Run the hook with an explicit env override (so we can unset CLAUDE_PROJECT_DIR by setting
 * it to '' — Node's spawnSync env replaces process.env entirely when provided).
 */
function runHookWithEnv(
  hookAbs: string,
  stdin: object | null,
  envOverride: Record<string, string>,
): { status: number; stdout: string; stderr: string } {
  // Build a fresh env: start from a clean baseline (PATH + HOME + tmpdir essentials),
  // then apply the override. This PREVENTS process.env.CLAUDE_PROJECT_DIR leaking in
  // when the test wants it unset.
  const cleanEnv: Record<string, string> = {
    PATH: process.env.PATH ?? '/usr/bin:/bin',
    HOME: process.env.HOME ?? '/tmp',
    TMPDIR: process.env.TMPDIR ?? '/tmp',
    ...envOverride,
  };
  const r = spawnSync('bash', [hookAbs], {
    input: stdin === null ? '' : JSON.stringify(stdin),
    encoding: 'utf8',
    env: cleanEnv,
  });
  return {
    status: r.status ?? -1,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
  };
}
