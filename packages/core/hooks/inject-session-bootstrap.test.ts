/**
 * Functional tests for the UserPromptSubmit bootstrap-injection hook
 * (.claude/hooks/inject-session-bootstrap.sh) — Wave 7 sub-wave 7.2.a.
 *
 * Contract (from hook source lines 1-14):
 *   - UserPromptSubmit hook: stdout is injected into Claude Code's prompt
 *     context automatically by the harness (line 3).
 *   - Always emits the static digest via heredoc (lines 6-14); no session cache,
 *     no skip conditions, stdin is ignored.
 *   - Digest is bounded by sentinel tags:
 *       opening: "[session-bootstrap digest — auto-injected at prompt submit]" (line 7)
 *       closing: "[/session-bootstrap digest]" (line 13)
 *   - Content invariants (lines 8-12): project goal, 4 invariants, Step-0 reading
 *     order, recommendation discipline.
 *
 * Paired-negative contract:
 *   ❌ hook output MUST NOT be empty (the core injection contract)
 *   ✅ stdout contains the opening sentinel tag (line 7)
 *   ✅ stdout contains the closing sentinel tag (line 13)
 *   ✅ stdout contains the goal anchor phrase (line 8)
 *   ✅ repeat invocations (same or different session_id) still emit (no false cache)
 *   ✅ exit code is 0 on every invocation
 *
 * Reference pattern: check-hook-marker.test.ts (vitest + spawnSync harness).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HOOK = resolve(REPO_ROOT, '.claude/hooks/inject-session-bootstrap.sh');

/**
 * Run the hook with a simulated UserPromptSubmit stdin payload.
 * The hook ignores stdin (pure stdout emitter, line 6-14) but we send
 * realistic input matching CC's UserPromptSubmit shape for accuracy.
 *
 * env is merged onto process.env (used to simulate ZCODE_PROJECT_DIR for the ZCode JSON path —
 * mirrors deps-hash-check.test.ts:106). Default-scrub ZCODE_PROJECT_DIR so the CC-plain-text
 * assertions below do not flip to the ZCode-JSON branch when the suite runs inside ZCode itself.
 */
function runHook(
  session_id = 'test-session',
  env: Record<string, string> = {},
  shell = 'bash',
): { stdout: string; status: number } {
  // Spread `env` — it used to be dropped except for ZCODE_PROJECT_DIR, so any
  // case passing another variable silently tested the ambient environment
  // instead of the one it asked for. A test that cannot set a variable cannot
  // test a variable-gated branch; the `env-plumbing sanity` case below pins this
  // so it cannot rot back.
  const fullEnv = { ...process.env, ...env };
  // Default-scrub every variable the R4 consumer-aware resolution reads (kickoff
  // R4 dispatch item g): an ambient export from the operator's senior session
  // would silently point the hook at the wrong tree (CLAUDE_PROJECT_DIR wins the
  // root resolution; AIF_AUTONOMOUS/AIF_HOOK_LANG gate blocks). Each is set
  // explicitly by the arm that needs it.
  for (const k of [
    'ZCODE_PROJECT_DIR',
    'CLAUDE_PROJECT_DIR',
    'AIF_AUTONOMOUS',
    'AIF_HOOK_LANG',
  ]) {
    if (env[k] === undefined) delete fullEnv[k];
  }
  const r = spawnSync(shell, [HOOK], {
    input: JSON.stringify({
      hook_event_name: 'UserPromptSubmit',
      session_id,
      prompt: 'test prompt',
      transcript_path: '/tmp/test-transcript.jsonl',
    }),
    encoding: 'utf8',
    env: fullEnv,
  });
  return {
    stdout: r.stdout ?? '',
    status: r.status ?? -1,
  };
}

// sentinel tags from hook source lines 7 and 13
const OPENING_TAG =
  '[session-bootstrap digest — auto-injected at prompt submit]';
const CLOSING_TAG = '[/session-bootstrap digest]';

// key goal anchor phrase from hook source line 8
const GOAL_ANCHOR = "AI agents can't silently bypass undocumented conventions";

describe('inject-session-bootstrap.sh — UserPromptSubmit bootstrap injection', () => {
  it('PAIRED-NEGATIVE: output MUST NOT be empty (core injection contract, hook line 6-14)', () => {
    const { stdout } = runHook();
    // This is the load-bearing negative assertion:
    // if the hook stops emitting, this test fails — regression caught.
    expect(stdout.trim()).not.toBe('');
  });

  it('PAIRED-POSITIVE: stdout contains opening sentinel tag (hook line 7)', () => {
    const { stdout } = runHook();
    expect(stdout).toContain(OPENING_TAG);
  });

  it('PAIRED-POSITIVE: stdout contains closing sentinel tag (hook line 13)', () => {
    const { stdout } = runHook();
    expect(stdout).toContain(CLOSING_TAG);
  });

  it('PAIRED-POSITIVE: output is bounded — opening tag appears before closing tag', () => {
    const { stdout } = runHook();
    const openIdx = stdout.indexOf(OPENING_TAG);
    const closeIdx = stdout.indexOf(CLOSING_TAG);
    // Boundary assertion: both tags present and in correct order.
    expect(openIdx).toBeGreaterThanOrEqual(0);
    expect(closeIdx).toBeGreaterThan(openIdx);
  });

  it('PAIRED-POSITIVE: stdout contains goal anchor phrase (hook line 8)', () => {
    const { stdout } = runHook();
    expect(stdout).toContain(GOAL_ANCHOR);
  });

  it('PAIRED-POSITIVE: hook exits 0 (non-zero would prevent injection, hook line 6)', () => {
    const { status } = runHook();
    expect(status).toBe(0);
  });

  it('PAIRED-POSITIVE: repeat invocation with same session_id still emits (no false cache)', () => {
    // Hook has no session cache (no /tmp flag file, no stdin session_id check, lines 1-14).
    // Both calls must produce non-empty output.
    const first = runHook('repeat-session-test');
    const second = runHook('repeat-session-test');
    expect(first.stdout.trim()).not.toBe('');
    expect(second.stdout.trim()).not.toBe('');
  });

  it('PAIRED-POSITIVE: repeat invocation output is identical (static digest, hook lines 6-14)', () => {
    const first = runHook('idempotent-check-1');
    const second = runHook('idempotent-check-2');
    // Static heredoc — same content every time regardless of input.
    expect(first.stdout).toBe(second.stdout);
  });

  it('PAYLOAD SHAPE: output is plain text, NOT JSON (UserPromptSubmit ≠ PostToolUse contract)', () => {
    // UserPromptSubmit hooks inject via plain stdout (hook line 3), NOT via
    // JSON hookSpecificOutput (that is PostToolUse semantics).
    // Asserting the correct channel contract: the output must NOT be parseable
    // as a JSON object with hookSpecificOutput — otherwise the wrong protocol
    // is used and the injection would silently fail.
    const { stdout } = runHook();
    let parsed: unknown;
    try {
      parsed = JSON.parse(stdout);
    } catch {
      parsed = null;
    }
    // The output is plain text, not a JSON envelope.
    expect(parsed).toBeNull();
  });

  it('ZCODE: under ZCODE_PROJECT_DIR the digest is emitted as schema-valid {additionalContext} (CCt.strict compliant)', () => {
    // ZCode parses hook stdout against the HookJSONOutput schema (CCt at zcode.cjs:~577900),
    // which is `.strict()` — unknown top-level keys are REJECTED (→ hook.run.failed, output
    // discarded, no digest reaches the session). The ZCode branch (_emit_ctx at hook line 16-18)
    // MUST emit the schema-valid `{additionalContext}` shape: only `additionalContext` at top
    // level, NO `hookEventName` (it is rejected by .strict() — a prior shape emitted
    // `{hookEventName, additionalContext}` and was silently rejected by ZCode, caught via
    // bundle re-inspection 2026-07-18). This test guards both the JSON branch AND schema
    // compliance — catches the exact regression that broke live ZCode delivery.
    const { stdout, status } = runHook('zcode-test', {
      ZCODE_PROJECT_DIR: REPO_ROOT,
    });
    expect(status).toBe(0);
    // Must parse as JSON. CCt.strict() allows ONLY these top-level keys:
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
    const parsed = JSON.parse(stdout);
    const unknownKeys = Object.keys(parsed).filter(
      (k) => !allowedTopLevel.has(k),
    );
    expect(
      unknownKeys,
      `ZCode CCt.strict() rejects unknown top-level keys: ${unknownKeys.join(', ')}`,
    ).toEqual([]);
    // The digest content rides inside additionalContext:
    expect(parsed.additionalContext).toContain(OPENING_TAG);
    expect(parsed.additionalContext).toContain(CLOSING_TAG);
    expect(parsed.additionalContext).toContain(GOAL_ANCHOR);
    // hookEventName MUST NOT appear at top level (regression guard):
    expect(
      parsed.hookEventName,
      'hookEventName must NOT be emitted at top level (CCt.strict rejects it)',
    ).toBeUndefined();
  });

  it('env-plumbing sanity: a non-ZCODE variable reaches the hook (pins runHook env-spread fix)', () => {
    // Pins the `{ ...process.env, ...env }` spread at line 53. A prior version of
    // runHook silently dropped every `env` key except ZCODE_PROJECT_DIR, so any
    // test passing another variable was a no-op — it asserted ambient process.env
    // instead of the variable it asked for, and a regression that re-restricted
    // the spread would be invisible to every existing test (the CLAUDE_PROJECT_DIR
    // foreign-root test in the sibling check-kickoff-traps suite exercises
    // ZCODE-only plumbing; the ZCODE test above exercises ZCODE explicitly).
    //
    // Choice of variable: AIF_HOOK_LANG is read at hook line 38 and, for any
    // non-en/non-empty value, the * branch at hook line 44 echoes the value back
    // in the digest as `(AIF_HOOK_LANG=<value>)`. Using a sentinel rather than
    // `ru` makes the test robust against an ambient AIF_HOOK_LANG=ru in
    // process.env (the operator's live setting per kickoff §1) — the sentinel
    // appears in output ONLY if the value we passed reached the hook.
    //
    // Falsifier: revert line 53 to `{ ...process.env }` (omitting `...env`) or
    // to the old ZCODE-only form — this assertion goes RED because the sentinel
    // never reaches the hook, so the `[output-language]` line is absent.
    const sentinel = 'env-plumbing-test-marker';
    const { stdout } = runHook('env-plumbing-sanity', {
      AIF_HOOK_LANG: sentinel,
    });
    expect(stdout).toContain('[output-language]');
    expect(stdout).toContain(`AIF_HOOK_LANG=${sentinel}`);
  });

  it('AUTONOMY-BLOCK §2: under AIF_AUTONOMOUS=1 the digest carries the §2 wait-rule prescription (proposal 2 pairing)', () => {
    // Pins the BINDING pairing from session-start-token-audit S2 Note B: excluding
    // autonomous-loop-continuity.md from always-on load (via claudeMdExcludes — proposal 3)
    // is safe ONLY if the §2 wait-rule prescription is delivered by another channel. This
    // asserts that channel (the AIF_AUTONOMOUS=1 autonomy block in inject-session-bootstrap.sh)
    // actually carries the §2 line. Without this assertion, removing the rule from always-on
    // load would silently strand §2 — the failure mode Note B exists to prevent.
    //
    // Counter-falsifier: revert proposal 2 part A (no §2 line in the autonomy block) — this
    // test goes RED because the §2 markers are absent from the AIF_AUTONOMOUS=1 digest.
    const { stdout } = runHook('autonomy-block-test', {
      AIF_AUTONOMOUS: '1',
    });
    expect(stdout).toContain('[autonomy]');
    // The §2 prescription must name the bounded-waiter invariant:
    expect(stdout).toContain('silence');
    expect(stdout).toContain('terminal verdict');
    expect(stdout).toContain('--timeout-ms');
    // And it must point at the repo's canonical waiter:
    expect(stdout).toContain('await.ts');
    // The 4 items must all be present (the autonomy block enumerates them):
    expect(stdout).toContain('(1) Cold sub-agents');
    expect(stdout).toContain('(2) Do NOT end a turn');
    expect(stdout).toContain('(3) A constraint you cannot trace');
    expect(stdout).toContain('(4) §2 wait rule');
  });
});

// ---------------------------------------------------------------------------
// R4 (consumer-refresh-integrity, issue 1484): consumer-aware digest.
//
// Consumers receive this hook via the plugin twin, where the framework tree the
// digest cites (.claude/rules/*, Makefile targets, CLAUDE.md, README.md) does
// not exist. The hook now existence-checks every path-shaped citation at render
// time and degrades an absent target to its NAME (canonical forms asserted as
// literals below) — never dropping the invariant text. The framework tree must
// render byte-identically to the pre-R4 golden (dogfood unchanged, hard arm).
// ---------------------------------------------------------------------------

const RULE_NAMES = [
  'build-first-reuse-default',
  'recommendation-laziness-discipline',
  'phase-research-coverage',
  'ai-laziness-traps',
] as const;

const fixtureRoots: string[] = [];
afterEach(() => {
  for (const root of fixtureRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

/** Empty-or-populated consumer tree in tmp; served to the hook via CLAUDE_PROJECT_DIR. */
function makeFixture(files: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'r4-digest-fixture-'));
  fixtureRoots.push(root);
  for (const [rel, content] of Object.entries(files)) {
    const full = join(root, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

const fullRulesFixture = (): Record<string, string> => {
  const files: Record<string, string> = {
    'README.md': '# consumer readme\n',
    'CLAUDE.md': '# consumer claude md\n',
    '.claude/session-bootstrap.md': '# consumer bootstrap\n',
  };
  for (const name of RULE_NAMES) files[`.claude/rules/${name}.md`] = `# ${name}\n`;
  return files;
};

// Byte-exact golden of the framework-tree digest, captured on clean base
// bfb964c68d via `env -u ZCODE_PROJECT_DIR -u AIF_AUTONOMOUS -u AIF_HOOK_LANG
// -u CLAUDE_PROJECT_DIR bash .claude/hooks/inject-session-bootstrap.sh`
// (R4 dispatch VERIFY 3). Any framework-tree render change breaks this arm.
const FRAMEWORK_GOLDEN = `[session-bootstrap digest — auto-injected at prompt submit]
Goal: AI agents can't silently bypass undocumented conventions. Every rule is an executable artifact that fails at the earliest reachable channel — edit-time → pre-commit → pre-push → CI → production audit. CI = last-resort gate. (README.md#why-this-exists)
Invariants: (1) build-vs-reuse SSOT consult before capability commit + build-first-reuse-default discipline (.claude/rules/build-first-reuse-default.md); (2) recursive self-application green (make self-audit); (3) search-coverage 6-item checklist on negative-existence claims; (4) multi-channel enforcement — every rule fails at earliest reachable channel (CI = last resort).
Step-0 reading order: README.md → .claude/session-bootstrap.md → CLAUDE.md → task-specific docs.
Recommendation discipline (H1): before issuing a verdict/recommendation (ADOPT/BUILD/REJECT/DEFER, «we should X», «use Y», «pick A over B») — (1) cite SSOT/prior-art by ID, (2) give file:line or command-output evidence, (3) state what would falsify it («wrong if …»), (4) for «nothing exists» claims run the 6-item search check. An unbacked verdict is provisional, not load-bearing. This is a reminder, not a gate. (see also .claude/rules/recommendation-laziness-discipline.md + T-trap in ai-laziness-traps.md §2) (.claude/rules/phase-research-coverage.md §1.7)
Full bootstrap + reviewer drift-prevention flowchart: .claude/session-bootstrap.md
[/session-bootstrap digest]
`;

describe('inject-session-bootstrap.sh — R4 consumer-aware digest (issue 1484)', () => {
  it('R4(b) framework tree: digest is BYTE-IDENTICAL to the pre-R4 golden (dogfood unchanged)', () => {
    // CLAUDE_PROJECT_DIR/AIF_* are scrubbed by runHook; the hook falls back to
    // its own $0-relative root = this repo, where every cited target exists.
    const { stdout, status } = runHook('r4-golden');
    expect(status).toBe(0);
    expect(stdout).toBe(FRAMEWORK_GOLDEN);
  });

  it('R4(a) bare consumer tree (no rules/Makefile/CLAUDE.md/README): invariant text kept, canonical degradations, zero dead paths', () => {
    const fixture = makeFixture(); // empty tree — the extreme consumer
    const { stdout, status } = runHook('r4-bare-consumer', {
      CLAUDE_PROJECT_DIR: fixture,
    });
    expect(status).toBe(0);
    // Sentinel + invariant text survives in full:
    expect(stdout).toContain(OPENING_TAG);
    expect(stdout).toContain(CLOSING_TAG);
    expect(stdout).toContain(GOAL_ANCHOR);
    expect(stdout).toContain(
      'Invariants: (1) build-vs-reuse SSOT consult before capability commit + build-first-reuse-default discipline (rule build-first-reuse-default); (2) recursive self-application green; (3) search-coverage 6-item checklist on negative-existence claims; (4) multi-channel enforcement — every rule fails at earliest reachable channel (CI = last resort).',
    );
    // Canonical degradation literals:
    expect(stdout).toContain('Step-0 reading order: task-specific docs.');
    expect(stdout).toContain(
      '(see also rule recommendation-laziness-discipline + T-trap in ai-laziness-traps §2) (rule phase-research-coverage §1.7)',
    );
    expect(stdout).toContain(
      'Full bootstrap + reviewer drift-prevention flowchart: session-bootstrap digest only (bootstrap file absent in this tree)',
    );
    // Zero path-shaped citations to nonexistent targets (T-CRI-A: output asserts,
    // not source greps):
    expect(stdout).not.toContain('.claude/rules/');
    expect(stdout).not.toContain('(README.md#why-this-exists)');
    expect(stdout).not.toContain('make self-audit');
    expect(stdout).not.toContain('CLAUDE.md');
    expect(stdout).not.toContain('README.md');
    expect(stdout).not.toContain('.claude/session-bootstrap.md');
  });

  it('R4(c1) rules present, Makefile absent: only the make self-audit citation degrades', () => {
    const fixture = makeFixture(fullRulesFixture());
    const { stdout, status } = runHook('r4-no-makefile', {
      CLAUDE_PROJECT_DIR: fixture,
    });
    expect(status).toBe(0);
    expect(stdout).toContain('(.claude/rules/build-first-reuse-default.md)');
    expect(stdout).toContain(
      'Step-0 reading order: README.md → .claude/session-bootstrap.md → CLAUDE.md → task-specific docs.',
    );
    expect(stdout).toContain('(README.md#why-this-exists)');
    expect(stdout).not.toContain('make self-audit'); // the only degraded citation
  });

  it('R4(c2) Makefile with self-audit target, rules absent: only rule refs degrade', () => {
    const fixture = makeFixture({
      Makefile: 'self-audit:\n\techo audit\n',
      'README.md': '# readme\n',
    });
    const { stdout, status } = runHook('r4-no-rules', {
      CLAUDE_PROJECT_DIR: fixture,
    });
    expect(status).toBe(0);
    expect(stdout).toContain('(rule build-first-reuse-default)');
    expect(stdout).toContain('(make self-audit)');
    // README.md alive in the fixture → stays in Step-0 with the dead ones dropped:
    expect(stdout).toContain('Step-0 reading order: README.md → task-specific docs.');
  });

  it('R4(d) ZCode JSON branch: degradation rides inside {additionalContext} on a consumer tree', () => {
    const fixture = makeFixture(); // empty consumer tree
    const { stdout, status } = runHook('r4-zcode-consumer', {
      ZCODE_PROJECT_DIR: fixture,
    });
    expect(status).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.additionalContext).toContain('(rule build-first-reuse-default)');
    expect(parsed.additionalContext).toContain('recursive self-application green;');
    expect(parsed.additionalContext).not.toContain('.claude/rules/');
  });

  it('R4(d) ZCode JSON branch on the framework tree: golden content rides {additionalContext} unchanged', () => {
    const { stdout, status } = runHook('r4-zcode-framework', {
      ZCODE_PROJECT_DIR: REPO_ROOT,
    });
    expect(status).toBe(0);
    expect(JSON.parse(stdout).additionalContext).toBe(
      FRAMEWORK_GOLDEN.replace(/\n$/, ''),
    );
  });

  it('R4(e) fail-open: unreachable tree degrades every citation and STILL exits 0; repeat calls stable', () => {
    // A nonexistent root: every -f test is false, but the hook must never fail
    // (a failed run marks the ZCode run failed).
    const ghost = join(tmpdir(), 'r4-digest-ghost-root-does-not-exist');
    const first = runHook('r4-fail-open-1', { CLAUDE_PROJECT_DIR: ghost });
    const second = runHook('r4-fail-open-2', { CLAUDE_PROJECT_DIR: ghost });
    expect(first.status).toBe(0);
    expect(second.status).toBe(0);
    expect(first.stdout).toBe(second.stdout);
    expect(first.stdout).toContain('(rule build-first-reuse-default)');
    expect(first.stdout).toContain(GOAL_ANCHOR);
  });

  it('R4(f1) /bin/bash (stock macOS bash 3.2): degraded digest intact, exit 0', () => {
    // runHook normally takes `bash` from PATH (possibly 5.x) — a bash-4ism would
    // pass every arm above and still kill the injection on consumer macOS.
    const fixture = makeFixture();
    const { stdout, status } = runHook(
      'r4-binbash',
      { CLAUDE_PROJECT_DIR: fixture },
      '/bin/bash',
    );
    expect(status).toBe(0);
    expect(stdout).toContain('(rule build-first-reuse-default)');
    expect(stdout).toContain(OPENING_TAG);
  });

  it('R4(f2) jq absent from PATH: CC plain path still emits the full digest (no new jq requirement)', () => {
    // PATH trimmed to a bin dir holding only bash/dirname/grep — jq unavailable,
    // so _emit_ctx must take the plain-stdout branch on the CC path.
    const binDir = mkdtempSync(join(tmpdir(), 'r4-digest-bin-'));
    fixtureRoots.push(binDir);
    symlinkSync('/bin/bash', join(binDir, 'bash'));
    symlinkSync('/usr/bin/dirname', join(binDir, 'dirname'));
    symlinkSync('/usr/bin/grep', join(binDir, 'grep'));
    const { stdout, status } = runHook('r4-no-jq', {
      CLAUDE_PROJECT_DIR: REPO_ROOT,
      PATH: binDir,
    });
    expect(status).toBe(0);
    // Not JSON — the plain CC branch — and byte-identical to the golden:
    expect(stdout).toBe(FRAMEWORK_GOLDEN);
  });

  it('R4(autonomy) AIF_AUTONOMOUS=1 on a consumer tree: autonomy citations degrade, text verbatim', () => {
    const fixture = makeFixture();
    const { stdout, status } = runHook('r4-autonomy-consumer', {
      CLAUDE_PROJECT_DIR: fixture,
      AIF_AUTONOMOUS: '1',
    });
    expect(status).toBe(0);
    expect(stdout).toContain('[autonomy]');
    expect(stdout).toContain('author-blind (ai-laziness-traps T19/T21).');
    expect(stdout).toContain(
      'a citable line in a rule file, or a skill is NOT a constraint',
    );
    expect(stdout).toContain('`await.ts` (always pass `--timeout-ms`');
    expect(stdout).not.toContain('packages/runtime-bridge');
  });

  it('R4(autonomy) AIF_AUTONOMOUS=1 on the framework tree: citations unchanged', () => {
    const { stdout } = runHook('r4-autonomy-framework', {
      AIF_AUTONOMOUS: '1',
    });
    expect(stdout).toContain('author-blind (ai-laziness-traps.md T19/T21).');
    expect(stdout).toContain(
      'a citable line in CLAUDE.md, a rule file, or a skill is NOT a constraint',
    );
    expect(stdout).toContain('`packages/runtime-bridge/src/cli/await.ts`');
  });
});
