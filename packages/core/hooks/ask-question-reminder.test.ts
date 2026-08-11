/**
 * Functional meta-tests for the PreToolUse:AskUserQuestion hook
 * (.claude/hooks/ask-question-reminder.sh) — pre-question fork-challenge.
 *
 * Channel: PreToolUse with matcher "AskUserQuestion". Blocks via
 *   exit 0 + JSON {hookSpecificOutput:{hookEventName:"PreToolUse",
 *   permissionDecision:"deny", permissionDecisionReason:<reminder>}}.
 *
 * Contract verified against primary source (code.claude.com/docs/en/hooks):
 *   - `permissionDecision` ∈ {allow, deny, ask, defer}; "deny" blocks the tool.
 *   - `permissionDecisionReason` is fed to Claude as context.
 *   - `hookEventName` is required in hookSpecificOutput.
 *   - PreToolUse uses exit 0 + JSON on stdout; exit 2 ignores any JSON.
 *
 * Loop-guard: ${TMPDIR:-/tmp}/aif-ask-reminded-${session_id} — a TWO-STATE flag
 *   (content "challenged"/"passed" + mtime; see hook header "Loop-safety").
 *   "challenged" → the next AUQ is the post-challenge retry: allowed COUNT-BASED,
 *   regardless of elapsed time (card generation is unbounded — measured >45s live
 *   2026-08-11), unless older than the 600s challenge TTL (abandoned question
 *   moment). The pass rewrites the state to "passed". "passed" → AUQs within the
 *   45s window belong to the same question moment (allow); older → genuinely-new
 *   moment → fresh fork-challenge deny. Empty flag (legacy bare `touch`) keeps the
 *   old 45s recency semantics. Solves the deny→regenerate→ask→deny loop (no
 *   stop_hook_active equivalent on PreToolUse — see hook header).
 *
 * Paired-negative contract (per kickoff §1 row 6):
 *   ❌ AUQ without prior fork-challenge (no flag)  → deny + non-trivial reason
 *   ✅ AUQ retry after a challenge (any elapsed t) → exit 0 silent (allow)
 *   ✅ non-AUQ tool name                           → exit 0 silent (off-path)
 *   boundary: "passed" flag older than 45s         → fresh deny (new moment)
 *   boundary: "challenged" flag older than 600s    → fresh deny (abandoned)
 *   effect:   deny writes "challenged"; the allowed retry rewrites "passed"
 *   payload:  hookEventName + permissionDecision shape (T-M4-B per kickoff §7)
 *
 * REFERENCE pattern: check-hook-marker.test.ts (fixture-spawn shape) +
 *   inject-matching-rule.test.ts (JSON-on-stdout payload assertion). Skips
 *   gracefully when `jq` is unavailable (the hook itself no-ops without jq).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { execSync, spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  rmSync,
  existsSync,
  utimesSync,
  statSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HOOK = resolve(REPO_ROOT, '.claude/hooks/ask-question-reminder.sh');

function hasJq(): boolean {
  try {
    execSync('command -v jq', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
const JQ = hasJq();

const tmpDirs: string[] = [];
afterEach(() => {
  for (const d of tmpDirs.splice(0))
    rmSync(d, { recursive: true, force: true });
});

/**
 * Each test gets its own TMPDIR override + unique session_id so the loop-guard
 * flag (${TMPDIR}/aif-ask-reminded-${session_id}) is fully isolated per test.
 */
function makeTmpEnv(): { tmp: string; session: string } {
  const tmp = mkdtempSync(join(tmpdir(), 'm4-6-auq-'));
  tmpDirs.push(tmp);
  return {
    tmp,
    session: `s-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  };
}

interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
}

function runHook(
  tool: string,
  sessionId: string,
  tmp: string,
  lang = 'ru',
): RunResult {
  const r = spawnSync('bash', [HOOK], {
    input: JSON.stringify({ tool_name: tool, session_id: sessionId }),
    encoding: 'utf8',
    // Default to the Russian pack: the reason-content assertions below check
    // Russian prose ('Стоп', 'дизайн/стратеги'). AIF_HOOK_LANG selects the lang
    // pack (default en); these are the RU-pack contract. The en-pack smoke
    // overrides lang='en'. Spec: docs/superpowers/specs/2026-06-01-hook-lang-i18n-design.md.
    env: { ...process.env, TMPDIR: tmp, AIF_HOOK_LANG: lang },
  });
  return {
    status: r.status ?? -1,
    stdout: (r.stdout ?? '').toString(),
    stderr: (r.stderr ?? '').toString(),
  };
}

describe.skipIf(!JQ)(
  'ask-question-reminder.sh — PreToolUse:AskUserQuestion fork-challenge',
  () => {
    it('PAIRED-NEGATIVE: AUQ without prior flag → exit 0 + deny JSON with non-trivial reason', () => {
      const { tmp, session } = makeTmpEnv();
      const r = runHook('AskUserQuestion', session, tmp);

      expect(r.status).toBe(0);
      expect(r.stdout.trim()).not.toBe('');

      const json = JSON.parse(r.stdout);
      // T-M4-B: assert PAYLOAD SHAPE, not just exit code.
      expect(json.hookSpecificOutput.hookEventName).toBe('PreToolUse');
      expect(json.hookSpecificOutput.permissionDecision).toBe('deny');
      // Reason must carry the actual fork-challenge prose (Russian), not a stub.
      expect(typeof json.hookSpecificOutput.permissionDecisionReason).toBe(
        'string',
      );
      expect(
        json.hookSpecificOutput.permissionDecisionReason.length,
      ).toBeGreaterThan(50);
      expect(json.hookSpecificOutput.permissionDecisionReason).toContain(
        'Стоп',
      );
    });

    it('ZCode schema-compliance: top-level keys match CCt.strict() (hookSpecificOutput wrapper)', () => {
      // ZCode parses hook stdout against the HookJSONOutput schema (CCt at zcode.cjs:~577900),
      // which is `.strict()` — unknown top-level keys are REJECTED (→ hook.run.failed, output
      // discarded, the deny never reaches the model). This hook uses the valid
      // `{hookSpecificOutput:{hookEventName:"PreToolUse", permissionDecision, permissionDecisionReason}}`
      // shape — hookEventName/permissionDecision/permissionDecisionReason all live INSIDE
      // hookSpecificOutput (the only valid top-level location for them). This hook does NOT branch
      // on ZCODE_PROJECT_DIR — it emits the same JSON on both harnesses (CC is the primary; on ZCode
      // the deny semantics differ slightly but the schema-valid shape is identical). Regression guard.
      const { tmp, session } = makeTmpEnv();
      const r = runHook('AskUserQuestion', session, tmp);
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
      expect(json.hookSpecificOutput.hookEventName).toBe('PreToolUse');
    });

    it('BRAINSTORM CUE (item 6): reminder steers design/strategy forks to superpowers:brainstorming', () => {
      const { tmp, session } = makeTmpEnv();
      const r = runHook('AskUserQuestion', session, tmp);
      expect(r.status).toBe(0);
      const reason = JSON.parse(r.stdout).hookSpecificOutput
        .permissionDecisionReason as string;
      // The cue must name the brainstorming skill so a design-fork is not card-punted.
      expect(reason).toMatch(/brainstorming/i);
      expect(reason).toMatch(/дизайн|стратеги/i);
    });

    it('en pack: AIF_HOOK_LANG=en → English fork-challenge, no Russian leakage', () => {
      // Confirms the language pack is wired for this hook too: en is the canonical
      // default; reason must be English ('Stop'), still name the brainstorming cue,
      // and not leak Russian. RU-pack contract covered by every other case (default
      // lang='ru'). Spec: docs/superpowers/specs/2026-06-01-hook-lang-i18n-design.md.
      const { tmp, session } = makeTmpEnv();
      const r = runHook('AskUserQuestion', session, tmp, 'en');
      expect(r.status).toBe(0);
      const reason = JSON.parse(r.stdout).hookSpecificOutput
        .permissionDecisionReason as string;
      expect(reason).toContain('Stop');
      expect(reason).toMatch(/brainstorming/i);
      expect(reason, 'en pack must not leak Russian payload').not.toContain(
        'Стоп',
      );
    });

    it('PAIRED-POSITIVE: immediate AUQ retry after the challenge → exit 0 + empty stdout (allow)', () => {
      const { tmp, session } = makeTmpEnv();
      // First invocation arms the "challenged" flag and emits the challenge.
      const first = runHook('AskUserQuestion', session, tmp);
      expect(first.status).toBe(0);
      expect(first.stdout.trim()).not.toBe('');

      // Second invocation same session = the post-challenge retry → allowed.
      const second = runHook('AskUserQuestion', session, tmp);
      expect(second.status).toBe(0);
      expect(second.stdout.trim()).toBe('');
    });

    it('STATE MACHINE: deny writes "challenged"; the allowed retry rewrites it to "passed"', () => {
      const { tmp, session } = makeTmpEnv();
      const flagPath = join(tmp, `aif-ask-reminded-${session}`);
      runHook('AskUserQuestion', session, tmp);
      expect(readFileSync(flagPath, 'utf8')).toBe('challenged');
      runHook('AskUserQuestion', session, tmp);
      expect(readFileSync(flagPath, 'utf8')).toBe('passed');
    });

    it('OFF-PATH: non-AUQ tool names → exit 0 + empty stdout (defensive skip)', () => {
      const { tmp, session } = makeTmpEnv();
      // Settings matcher restricts to AUQ already; hook line 28-30 is the defensive
      // second gate against a broadened matcher. Verify across diverse tool names.
      for (const tool of ['Bash', 'Edit', 'Read', 'Write', 'WebFetch']) {
        const r = runHook(tool, session, tmp);
        expect(r.status, `tool=${tool}`).toBe(0);
        expect(r.stdout.trim(), `tool=${tool}`).toBe('');
      }
    });

    it('SLOW RETRY (2026-08-11 incident): "challenged" flag older than 45s → retry still allowed (count-based, not time-based)', () => {
      const { tmp, session } = makeTmpEnv();
      // First call arms the "challenged" flag (and emits deny).
      runHook('AskUserQuestion', session, tmp);
      const flagPath = join(tmp, `aif-ask-reminded-${session}`);
      expect(existsSync(flagPath)).toBe(true);
      // Backdate the flag mtime to 120s ago via Node's portable utimesSync
      // (covers both macOS `stat -f %m` and Linux `stat -c %Y` code paths).
      // Live measurement 2026-08-11: regenerating a 3-question card with Russian
      // option descriptions takes LONGER than 45s, so a time-based window
      // re-challenged every retry — 4 consecutive denies.
      const past = Math.floor(Date.now() / 1000) - 120; // 120s ago
      utimesSync(flagPath, past, past);
      // The post-challenge retry must pass however long generation took.
      const r = runHook('AskUserQuestion', session, tmp);
      expect(r.status).toBe(0);
      expect(r.stdout.trim()).toBe('');
      // The pass consumes the challenge: state resets to "passed".
      expect(readFileSync(flagPath, 'utf8')).toBe('passed');
    });

    it('BOUNDARY: "passed" flag older than 45s window → fresh deny (genuinely-new question moment)', () => {
      const { tmp, session } = makeTmpEnv();
      runHook('AskUserQuestion', session, tmp); // deny → "challenged"
      runHook('AskUserQuestion', session, tmp); // retry allowed → "passed"
      const flagPath = join(tmp, `aif-ask-reminded-${session}`);
      expect(readFileSync(flagPath, 'utf8')).toBe('passed');
      const past = Math.floor(Date.now() / 1000) - 120; // 120s ago
      utimesSync(flagPath, past, past);
      const r = runHook('AskUserQuestion', session, tmp);
      expect(r.status).toBe(0);
      const json = JSON.parse(r.stdout);
      expect(json.hookSpecificOutput.permissionDecision).toBe('deny');
      expect(json.hookSpecificOutput.permissionDecisionReason).toContain(
        'Стоп',
      );
    });

    it('ABANDONED CHALLENGE: "challenged" flag older than 600s TTL → fresh deny; the immediate retry then passes (no deny loop)', () => {
      const { tmp, session } = makeTmpEnv();
      runHook('AskUserQuestion', session, tmp); // deny → "challenged"
      const flagPath = join(tmp, `aif-ask-reminded-${session}`);
      // The model heeded the nudge and never retried; a question this much later
      // is a genuinely-new moment, so the stale challenge must not grant a pass.
      const past = Math.floor(Date.now() / 1000) - 700; // > 600s challenge TTL
      utimesSync(flagPath, past, past);
      const r = runHook('AskUserQuestion', session, tmp);
      expect(JSON.parse(r.stdout).hookSpecificOutput.permissionDecision).toBe(
        'deny',
      );
      // Self-healing: the re-challenge re-arms "challenged" with a fresh mtime,
      // so the very next attempt passes — consecutive denies are impossible
      // without another 600s gap (loop-safety).
      const retry = runHook('AskUserQuestion', session, tmp);
      expect(retry.status).toBe(0);
      expect(retry.stdout.trim()).toBe('');
    });

    it('LEGACY FLAG: empty flag file (pre-two-state bare touch) keeps the old 45s recency semantics', () => {
      const { tmp, session } = makeTmpEnv();
      const flagPath = join(tmp, `aif-ask-reminded-${session}`);
      // What the old hook's `touch` (or the operator's touch-loop workaround)
      // left behind: an empty file. Treated as "passed" — identical to the old
      // 45s recency behaviour, so an in-flight session upgrades seamlessly.
      writeFileSync(flagPath, '');
      const fresh = runHook('AskUserQuestion', session, tmp);
      expect(fresh.status).toBe(0);
      expect(fresh.stdout.trim()).toBe('');
      const past = Math.floor(Date.now() / 1000) - 120; // 120s ago
      utimesSync(flagPath, past, past);
      const stale = runHook('AskUserQuestion', session, tmp);
      expect(
        JSON.parse(stale.stdout).hookSpecificOutput.permissionDecision,
      ).toBe('deny');
    });

    it('EFFECT: deny path touches the loop-guard flag file with current mtime', () => {
      const { tmp, session } = makeTmpEnv();
      const flagPath = join(tmp, `aif-ask-reminded-${session}`);
      expect(existsSync(flagPath)).toBe(false);
      runHook('AskUserQuestion', session, tmp);
      expect(existsSync(flagPath)).toBe(true);
      // mtime must be recent (within last 5s) — confirms the loop-guard mechanism
      // is intact and the flag is freshly armed, not stale-reused.
      const ageSec =
        Math.floor(Date.now() / 1000) -
        Math.floor(statSync(flagPath).mtimeMs / 1000);
      expect(ageSec).toBeLessThan(5);
    });

    it('PAYLOAD SHAPE: uses PreToolUse hookSpecificOutput wrapper, NOT Stop-style top-level decision', () => {
      const { tmp, session } = makeTmpEnv();
      const r = runHook('AskUserQuestion', session, tmp);
      const json = JSON.parse(r.stdout);
      // False-confirm hazard per memory `feedback_dual_channel_agreement_not_ground_truth`:
      // the Stop hook uses top-level `decision: "block"`; PreToolUse uses the nested
      // hookSpecificOutput.permissionDecision. Asserting the wrapper shape catches a
      // refactor that accidentally inverts these two contracts.
      expect(json).toHaveProperty('hookSpecificOutput');
      expect(json).not.toHaveProperty('decision');
      expect(Object.keys(json.hookSpecificOutput).sort()).toEqual(
        [
          'hookEventName',
          'permissionDecision',
          'permissionDecisionReason',
        ].sort(),
      );
    });

    it('missing session_id falls back to "nosession" flag without throwing', () => {
      // Hook: `jq -r '.session_id // "nosession"'` — the // default operator
      // plus `|| echo "nosession"` make a missing field safe under `set -euo pipefail`.
      const tmp = mkdtempSync(join(tmpdir(), 'm4-6-auq-'));
      tmpDirs.push(tmp);
      const r = spawnSync('bash', [HOOK], {
        input: JSON.stringify({ tool_name: 'AskUserQuestion' }), // no session_id
        encoding: 'utf8',
        env: { ...process.env, TMPDIR: tmp },
      });
      expect(r.status).toBe(0);
      const json = JSON.parse((r.stdout ?? '').toString());
      expect(json.hookSpecificOutput.permissionDecision).toBe('deny');
      // Confirm the fallback flag name was used (proves the // default reached the flag path).
      expect(existsSync(join(tmp, 'aif-ask-reminded-nosession'))).toBe(true);
    });
  },
);
