/**
 * Unit tests for plugin/hooks/_zcode-emit — the universal emit-wrapper helper
 * (Mechanism 1, plan-v3 §"Mechanism 1").
 *
 * Sourcing contract: the adopter defines `_is_zcode`, then sources this file.
 *   _is_zcode() { [ -n "${ZCODE_PROJECT_DIR:-}" ]; }    # canonical form
 *   source "${SCRIPT_DIR}/_zcode-emit"
 *   result | _ze_emit                                    # adopter emits via _ze_emit
 *
 * Classification matrix (plan-v3 §"Edge cases"):
 *   empty stdin                       → silent (no stdout, exit 0)
 *   valid JSON + allowed top-level key → byte-identical pass-through
 *   valid JSON + zero allowed keys    → wrap as {additionalContext:<raw bytes>}
 *   plain text                        → wrap as {additionalContext:"<escaped>"}
 *   multi-line JSON + trailing \n     → strip → classify → re-emit (pass-through preserves bytes)
 *   already-JSON input                → pass-through (double-wrap prevention)
 *
 * Non-ZCode gate: `ZCODE_PROJECT_DIR` unset → `_ze_emit` cats stdin unchanged
 * (the helper is a no-op when sourced by CC-dogfood-path scripts).
 *
 * Allowed top-level keys (any one → pass-through):
 *   additionalContext, additional_context, hookSpecificOutput, hookEventName,
 *   decision, reason, systemMessage, continue, stopReason, suppressOutput.
 * Mirrors every shape the codebase emits today (verified via grep across plugin/hooks/):
 *   {additionalContext}                      PostToolUse/PreToolUse/UserPromptSubmit
 *   {hookSpecificOutput:{...}}               SubagentStart
 *   {hookEventName, additionalContext}       legacy UserPromptSubmit (deps-hash-check)
 *   {decision:"block", reason, systemMessage} Stop hook (end-of-turn-reminder)
 *
 * §1.7 Backward-check contract: each forward test below is the failing-on-regression
 * counterpart for a plan-v3 §1.7 Backward-check row. Removing the helper entirely
 * makes every `_ze_classify`/`_ze_emit` test fail with "function not defined".
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HELPER = resolve(REPO_ROOT, 'plugin/hooks/_zcode-emit');

/**
 * Invoke the helper in a fresh bash subshell. `zeEnv` controls whether the
 * `_is_zcode` predicate returns true (we inject ZCODE_PROJECT_DIR to match the
 * canonical form); `zeStdin` is piped to the chosen function.
 *
 * We do NOT rely on the adopter's `_is_zcode` definition here — we provide the
 * canonical one inline so the test exercises the helper's classification logic
 * in isolation, exactly as a future adopter would compose it (plan-v3 §"Composition").
 */
function runHelper(
  fn: '_ze_classify' | '_ze_emit',
  stdin: string,
  opts: { zcode?: boolean } = {},
): { status: number; stdout: string; stderr: string } {
  // Source the helper, then call the chosen function. The canonical `_is_zcode`
  // predicate is defined inline before sourcing (sourcing contract).
  const script = [
    `_is_zcode() { [ -n "\${ZCODE_PROJECT_DIR:-}" ]; }`,
    `source "${HELPER}"`,
    `${fn}`,
  ].join('\n');
  const env = {
    ...process.env,
    ...(opts.zcode ? { ZCODE_PROJECT_DIR: '/fake-zcode-root' } : {}),
  };
  // Explicitly unset ZCODE_PROJECT_DIR when not zcode (process.env may leak it).
  if (!opts.zcode) env.ZCODE_PROJECT_DIR = '';
  const r = spawnSync('bash', ['-c', script], {
    input: stdin,
    encoding: 'utf8',
    env,
  });
  return { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

describe('_zcode-emit helper — _ze_classify classification matrix', () => {
  it('empty_silent_exit0: empty stdin → no stdout, exit 0', () => {
    // plan-v3 §"Edge cases" row 1: empty stdin must NOT emit {"additionalContext:""}.
    const r = runHelper('_ze_classify', '');
    expect(r.status, `stderr: ${r.stderr}`).toBe(0);
    expect(r.stdout).toBe('');
  });

  it('whitespace_only_silent_exit0: whitespace-only stdin → no stdout, exit 0', () => {
    // Boundary: tr-d-strip guard must catch pure whitespace, not just empty string.
    const r = runHelper('_ze_classify', '   \n\t  \n');
    expect(r.status, `stderr: ${r.stderr}`).toBe(0);
    expect(r.stdout).toBe('');
  });

  it('passthrough_valid_json_allowed_key: {"system":[…]} → byte-identical pass-through', () => {
    // plan-v3 §1.7 Forward row 1: stdin {"additionalContext":[...]} → stdout byte-identical.
    // (Using additionalContext as the allowed key — the canonical PostToolUse shape.)
    const input = '{"additionalContext":"hello world"}';
    const r = runHelper('_ze_classify', input);
    expect(r.status, `stderr: ${r.stderr}`).toBe(0);
    // Byte-identical: stdout must equal input verbatim (no jq reserialization, no trailing nl added).
    expect(r.stdout).toBe(input);
  });

  it('passthrough_preserves_all_allowed_keys: each allowed key → pass-through', () => {
    // Sweep over the full allowed-key set so a regression on any one is caught.
    const cases = [
      '{"additionalContext":"x"}',
      '{"additional_context":"x"}',
      '{"hookSpecificOutput":{"hookEventName":"SubagentStart","additionalContext":"x"}}',
      '{"hookEventName":"UserPromptSubmit","additionalContext":"x"}',
      '{"decision":"block","reason":"go","systemMessage":"gl"}',
      '{"continue":true}',
      '{"stopReason":"end_turn"}',
      '{"suppressOutput":true}',
    ];
    for (const input of cases) {
      const r = runHelper('_ze_classify', input);
      expect(r.status, `stderr on ${input}: ${r.stderr}`).toBe(0);
      expect(r.stdout, `pass-through failed for ${input}`).toBe(input);
    }
  });

  it('wrap_plain_text: stdin `hello` → stdout {"additionalContext":"hello"}', () => {
    // plan-v3 §1.7 Forward row 2: plain text wraps as additionalContext.
    const r = runHelper('_ze_classify', 'hello');
    expect(r.status, `stderr: ${r.stderr}`).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.additionalContext).toBe('hello');
    // No other top-level key leaks.
    expect(Object.keys(parsed)).toEqual(['additionalContext']);
  });

  it('wrap_plain_text_escapes_special_chars: quotes + backslash + newline', () => {
    // Defense check: jq -Rs string-escapes safely (no JSON injection / parse break).
    const r = runHelper('_ze_classify', 'he said "hi"\nwith `back`slash \\');
    expect(r.status, `stderr: ${r.stderr}`).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.additionalContext).toBe('he said "hi"\nwith `back`slash \\');
  });

  it('wrap_zero_allowed_keys: {"foo":"bar"} → wrapped as {additionalContext:"<raw>"}', () => {
    // plan-v3 §"Edge cases" row 3: valid JSON but no allowed top-level key → wrap raw bytes.
    const input = '{"foo":"bar"}';
    const r = runHelper('_ze_classify', input);
    expect(r.status, `stderr: ${r.stderr}`).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.additionalContext).toBe(input);
    // No foo leaked to top level (would be a ZCode schema violation).
    expect(parsed.foo).toBeUndefined();
  });

  it('multiline_trailing_newline: multi-line JSON + \\n after } → pass-through (trailing \\n stripped)', () => {
    // plan-v3 §"Edge cases" row 5: pretty-printed JSON + trailing newline →
    // "strip → classify → re-emit". The `$(cat)` command substitution that captures
    // stdin strips trailing newlines (bash invariant), so the re-emitted payload
    // loses the trailing `\n` but preserves the adopter's chosen pretty-printing.
    // This is the documented behaviour (strip-then-emit), not a bug.
    const input = '{\n  "additionalContext": "value"\n}\n';
    const r = runHelper('_ze_classify', input);
    expect(r.status, `stderr: ${r.stderr}`).toBe(0);
    // Trailing newline stripped (bash $(cat) invariant); body byte-identical.
    expect(r.stdout).toBe(input.replace(/\n$/, ''));
    // Sanity: still valid JSON with the right key + value.
    const parsed = JSON.parse(r.stdout);
    expect(parsed.additionalContext).toBe('value');
  });

  it('double_wrap_prevention: already-wrapped JSON → pass-through (never re-wrapped)', () => {
    // plan-v3 §"Edge cases" row 6 / §1.7 Forward row 4: an already-additionalContext
    // JSON must NOT be re-wrapped (would produce {additionalContext:'{additionalContext:…}'}).
    const input = '{"additionalContext":"already wrapped"}';
    const r = runHelper('_ze_classify', input);
    expect(r.status, `stderr: ${r.stderr}`).toBe(0);
    expect(r.stdout).toBe(input);
    // Sanity: stdout is single-level JSON, not a nested stringified blob.
    const parsed = JSON.parse(r.stdout);
    expect(typeof parsed.additionalContext).toBe('string');
    expect(parsed.additionalContext).toBe('already wrapped');
  });

  it('decision_block_passthrough: Stop-hook shape → byte-identical', () => {
    // The end-of-turn-reminder Stop-hook emit shape — load-bearing for Bespoke #1 Part B.
    const input = '{"decision":"block","reason":"recap nudge","systemMessage":"🎯 goal"}';
    const r = runHelper('_ze_classify', input);
    expect(r.status, `stderr: ${r.stderr}`).toBe(0);
    expect(r.stdout).toBe(input);
  });

  it('non_json_garbage_wraps_safely: stray chars → wrapped (jq -Rs escapes)', () => {
    // Not valid JSON, contains braces but not parseable. Must wrap as text.
    const r = runHelper('_ze_classify', 'not json {broken');
    expect(r.status, `stderr: ${r.stderr}`).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.additionalContext).toBe('not json {broken');
  });
});

describe('_zcode-emit helper — _ze_emit _is_zcode gate', () => {
  it('non_zcode_passthrough_cat: ZCODE_PROJECT_DIR unset → _ze_emit cats stdin unchanged', () => {
    // plan-v3 §1.7 Forward row 5 + Backward "non-ZCode gate": on CC dogfood the
    // helper is a no-op; stdin (plain text, JSON, anything) is passed through byte-for-byte.
    const cases = ['plain text here', '{"additionalContext":"x"}', 'multi\nline\ntext'];
    for (const input of cases) {
      const r = runHelper('_ze_emit', input, { zcode: false });
      expect(r.status, `stderr on ${JSON.stringify(input)}: ${r.stderr}`).toBe(0);
      expect(r.stdout, `non-zcode cat must be byte-identical for ${JSON.stringify(input)}`).toBe(input);
    }
  });

  it('zcode_routes_to_classify: ZCODE_PROJECT_DIR set → _ze_emit classifies (plain text wraps)', () => {
    // The gate routes through _ze_classify when _is_zcode=true. Same input that
    // cats unchanged on non-ZCode wraps as {additionalContext} on ZCode.
    const r = runHelper('_ze_emit', 'hello', { zcode: true });
    expect(r.status, `stderr: ${r.stderr}`).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.additionalContext).toBe('hello');
  });

  it('zcode_passes_through_allowed_json: valid JSON with allowed key → byte-identical', () => {
    // End-to-end through the gate: pass-through path on ZCode for allowed JSON.
    const input = '{"additionalContext":"x"}';
    const r = runHelper('_ze_emit', input, { zcode: true });
    expect(r.status, `stderr: ${r.stderr}`).toBe(0);
    expect(r.stdout).toBe(input);
  });

  it('zcode_empty_silent: empty stdin on ZCode → silent', () => {
    // End-to-end: empty path composes through the gate (no stray empty-context emit).
    const r = runHelper('_ze_emit', '', { zcode: true });
    expect(r.status, `stderr: ${r.stderr}`).toBe(0);
    expect(r.stdout).toBe('');
  });
});

describe('_zcode-emit helper — sourcing contract', () => {
  it('adopter_must_define_is_zcode: helper does not define its own _is_zcode', () => {
    // Sourcing the helper alone MUST NOT define _is_zcode — the adopter owns it
    // (canonical form verified across 7 plugin twins). This is the composition
    // contract from plan-v3 §"Composition (option d, verified correct)".
    // `declare -F <name>` prints the function name if defined, exits non-zero + empty
    // stdout if not — a clean signal without bash's noisy `type: not found` stderr.
    const r = spawnSync(
      'bash',
      ['-c', `source "${HELPER}"; declare -F _is_zcode || echo "NOT-DEFINED"`],
      { encoding: 'utf8' },
    );
    expect(r.stdout.trim()).toBe('NOT-DEFINED');
  });

  it('helper_defines_two_functions: _ze_classify and _ze_emit are exported on source', () => {
    const r = spawnSync(
      'bash',
      ['-c', `source "${HELPER}"; declare -F _ze_classify _ze_emit`],
      { encoding: 'utf8' },
    );
    expect(r.stdout.trim().split('\n').sort()).toEqual([
      '_ze_classify',
      '_ze_emit',
    ]);
  });
});
