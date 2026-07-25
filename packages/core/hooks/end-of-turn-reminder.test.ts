/**
 * Functional tests for the Stop hook .claude/hooks/end-of-turn-reminder.sh —
 * Track M.4.5 (paired-negative gap closure post-PR #183, per kickoff at
 * .claude/orchestrator-prompts/m4-bash-hook-tests/kickoff.md §1 row 5).
 *
 * Channel: Stop hook. JSON output contract (verified against hook source
 * .claude/hooks/end-of-turn-reminder.sh:249-259 + memory
 * project_eot_hook_redesign_approved 2026-05-22): on a trigger turn the hook
 * emits `{decision: "block", reason: <MODEL-bound recap>, systemMessage:
 * <USER-bound glance-line>}` and exits 0. Per T-M4-B the test must assert
 * PAYLOAD SHAPE, not just exit code — exit-code-only would have missed both
 * #81's broken `systemMessage`-delivery and the round-1 AskUserQuestion
 * false-suppress regression that prior cold-review caught.
 *
 * Pattern: spawnSync(bash, [HOOK], {input: JSON}) + on-disk JSONL transcript,
 * REFERENCEing the check-hook-marker.test.ts:50-64 fixture-spawn shape (no new
 * test framework, no bats dep — T-M4-A counter). Skips gracefully when `jq`
 * is unavailable on the runner.
 *
 * Paired-negative contract (kickoff §1 row 5):
 *   ❌ skip-condition NOT met but reminder skipped → fail
 *      (i.e. on a real trigger turn the hook MUST emit JSON, not exit silent)
 *   ✅ skip-condition met → exit 0 silent
 *   boundary: AskUserQuestion-only turn after prior "## 🟢" recap — must FIRE
 *      (B2 idle-suppress fix at hook:129-131; this is the regression-guard).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { execSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HOOK = resolve(REPO_ROOT, '.claude/hooks/end-of-turn-reminder.sh');

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
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/**
 * Build a JSONL transcript file matching the format hook:21-44 parses
 * (`grep '"type":"ai-title"|"user"|"assistant"'` + jq over `.message.content`).
 * Returns the transcript_path the hook expects in its stdin.
 */
function writeTranscript(lines: Record<string, unknown>[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'm4-5-eot-'));
  tmpDirs.push(dir);
  const transcript = join(dir, 'transcript.jsonl');
  writeFileSync(transcript, lines.map((l) => JSON.stringify(l)).join('\n') + '\n', 'utf8');
  return transcript;
}

function aiTitle(title: string) {
  return { type: 'ai-title', aiTitle: title };
}

function userTurn(text: string) {
  return { type: 'user', message: { content: text } };
}

function assistantText(text: string) {
  return {
    type: 'assistant',
    message: { content: [{ type: 'text', text }] },
  };
}

function assistantTextAndToolUse(text: string, toolName: string) {
  return {
    type: 'assistant',
    message: {
      content: [
        { type: 'text', text },
        { type: 'tool_use', name: toolName, input: {} },
      ],
    },
  };
}

function assistantToolUseOnly(toolName: string) {
  return {
    type: 'assistant',
    message: { content: [{ type: 'tool_use', name: toolName, input: {} }] },
  };
}

function assistantBashToolUse(text: string, command: string) {
  return {
    type: 'assistant',
    message: {
      content: [
        { type: 'text', text },
        { type: 'tool_use', name: 'Bash', input: { command } },
      ],
    },
  };
}

function runHook(
  stdin: Record<string, unknown>,
  env?: Record<string, string>,
): { status: number; stdout: string; stderr: string } {
  const r = spawnSync('bash', [HOOK], {
    input: JSON.stringify(stdin),
    encoding: 'utf8',
    // Default to the Russian pack: the assertions below check Russian payload
    // content and the transcripts embed the Russian recap marker. AIF_HOOK_LANG
    // selects the lang pack (default en); these cases are the RU-pack contract.
    // A test may override via env: { AIF_HOOK_LANG: 'en' } (see en-pack smoke).
    env: { ...process.env, AIF_HOOK_LANG: 'ru', ...env },
  });
  return { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/**
 * Make `body` the payload the hook's probe reads, for the duration of `fn`.
 *
 * The F10 arm's entire contract is a function of what GET /tasks returns, so a
 * test that cannot control that body cannot test the arm at all — which is why
 * the arm shipped with zero in-flight coverage.
 *
 * The fixture is a `file://` base URL rather than an HTTP server, and both
 * rejected alternatives are worth recording because each looks correct:
 *   - a one-shot `nc -l` (the original) serves a single connection, spells its
 *     flags differently on BSD and GNU, and when `nc` is absent degrades into a
 *     test that silently asserts nothing.
 *   - an in-process `node:http` server CANNOT work here: runHook uses
 *     spawnSync, which blocks the event loop, so the server never accepts the
 *     connection and every case fails as "probe unreachable".
 * The hook only ever consumes curl's stdout, so `file://<dir>` + a file named
 * `tasks` exercises the identical code path (curl → jq → predicate) with no
 * port, process or platform dependency.
 */
function withTasks<T>(body: string, fn: (url: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), 'f10-tasks-'));
  tmpDirs.push(dir);
  writeFileSync(join(dir, 'tasks'), body, 'utf8');
  return fn(`file://${dir}`);
}

/** A minimal aif task object — only the fields the arm's filter reads. */
function task(status: string): Record<string, unknown> {
  return { id: `t-${status}`, title: `task ${status}`, status, paused: false };
}

/** Write a fresh orchestration-mode marker file; returns its path. */
function writeMarker(): string {
  const dir = mkdtempSync(join(tmpdir(), 'm4-5-marker-'));
  tmpDirs.push(dir);
  const p = join(dir, 'orchestration-mode');
  writeFileSync(p, '');
  return p;
}

/** Build a long markdown-shaped text (>500 chars) that triggers long_text=true. */
function longMarkdownText(): string {
  // hook:93-97 requires text_length > 500 AND match of ^#|^- |^\* |\*\*|```|[..](..)
  const block = [
    '## Раздел один',
    '- пункт первый, чуть длиннее обычного',
    '- пункт второй, опять текстовый',
    '- пункт третий — добавим **акцент**',
    '',
    '## Раздел два',
    '- вложенный пункт А',
    '- вложенный пункт Б',
    '- ссылка [пример](https://example.com)',
    '',
    'обычный абзац без маркеров чтобы добить длину выше пятисот символов',
    'и ещё одна строка для верности',
  ].join('\n');
  // Pad to comfortably exceed 500.
  return block + '\n\n' + 'хвост'.repeat(40);
}

describe.skipIf(!JQ)('end-of-turn-reminder.sh — Stop hook JSON contract & paired-negative shape', () => {
  // ---------------------------------------------------------------------------
  // ❌ NEGATIVE — trigger turns: reminder MUST fire (JSON output with the full
  // {decision, reason, systemMessage} payload shape per T-M4-B).
  // ---------------------------------------------------------------------------

  it('Branch A (long markdown, no question) → emits decision:block + reason + 🎯 systemMessage', () => {
    const tr = writeTranscript([
      aiTitle('Тестовая цель сессии'),
      userTurn('первое задание'),
      assistantText(longMarkdownText() + '\n\nИтог: всё описано.'),
    ]);
    const r = runHook({ transcript_path: tr, stop_hook_active: false });
    expect(r.status, `stderr: ${r.stderr}`).toBe(0);
    expect(r.stdout, 'reminder must fire on long markdown turn (skip-condition NOT met)').not.toBe('');
    const payload = JSON.parse(r.stdout);
    expect(payload.decision).toBe('block');
    expect(typeof payload.reason).toBe('string');
    expect(payload.reason.length).toBeGreaterThan(100);
    expect(payload.systemMessage).toMatch(/^🎯 /);
    expect(payload.systemMessage).toContain('Тестовая цель сессии');
    // Branch A recommendation-laziness nudge (added 2026-05-25, follow-up to
    // defer-reflex Stage 2 REJECT) — Branch A must mirror Branch B/C fork-check
    // since defer-reflex incidents happen in long recap turns without questions.
    expect(payload.reason).toMatch(/рекомендовал|жду твоего решения|перекладывай/i);
  });

  it('ZCode schema-compliance: top-level keys match CCt.strict() — no stray hookEventName', () => {
    // ZCode parses hook stdout against the HookJSONOutput schema (CCt at zcode.cjs:~577900),
    // which is `.strict()` — unknown top-level keys are REJECTED (→ hook.run.failed, output
    // discarded). This Stop hook emits `{decision, reason, systemMessage}` UNCONDITIONALLY
    // (hook:233-237) — all three are in the allowed set today, but there is NO guard against a
    // future edit adding `hookEventName` (or any other key) at top level, which ZCode would
    // silently reject. Regression guard (cold backward-sweep finding GAP-1): pin the allowed
    // top-level set so any added key fails this test. Precedent: ask-question-reminder.test.ts:139.
    const tr = writeTranscript([
      aiTitle('Тестовая цель сессии'),
      userTurn('первое задание'),
      assistantText(longMarkdownText() + '\n\nИтог: всё описано.'),
    ]);
    const r = runHook({ transcript_path: tr, stop_hook_active: false });
    expect(r.stdout, 'reminder must fire to exercise the JSON path').not.toBe('');
    const parsed = JSON.parse(r.stdout);
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
    const unknownKeys = Object.keys(parsed).filter(
      (k) => !allowedTopLevel.has(k),
    );
    expect(
      unknownKeys,
      `ZCode CCt.strict() rejects unknown top-level keys: ${unknownKeys.join(', ')}`,
    ).toEqual([]);
    expect(
      parsed.hookEventName,
      'hookEventName must NOT be at top level (CCt.strict rejects it)',
    ).toBeUndefined();
  });

  // ── orchestration-mode (marker-gated; normal mode byte-for-byte) ──────────────
  describe('orchestration-mode — Bug A: decision-mention no longer false-fires in-mode', () => {
    it('IN-MODE — short "я выбрал Option A." (decision mention, no ?) → silent', () => {
      const tr = writeTranscript([
        aiTitle('Цель'),
        userTurn('задание'),
        assistantText('Ок, я выбрал Option A и поехал дальше.'),
      ]);
      const r = runHook(
        { transcript_path: tr, stop_hook_active: false },
        { ORCHESTRATION_MODE_MARKER: writeMarker() },
      );
      expect(r.status, `stderr: ${r.stderr}`).toBe(0);
      expect(r.stdout, 'decision-mention in-mode must NOT fire').toBe('');
    });

    it('IN-MODE — short text ending in "… A или B?" → still fires (trailing ? kept)', () => {
      const tr = writeTranscript([aiTitle('Цель'), userTurn('задание'), assistantText('Что берём — A или B?')]);
      const r = runHook(
        { transcript_path: tr, stop_hook_active: false },
        { ORCHESTRATION_MODE_MARKER: writeMarker() },
      );
      expect(r.stdout, 'real question in-mode must fire').not.toBe('');
      expect(JSON.parse(r.stdout).decision).toBe('block');
    });

    it('NORMAL-MODE — short "я выбрал Option A." is SILENT (claim-scan removed)', () => {
      // Was a "regex still active" guard from when normal mode fired on bare decision
      // mentions. The claim-scan has since been removed (see the "claim-scan removed"
      // cases below): a short decision mention with no question and no long-markdown is
      // now silent in BOTH modes. This is the normal-mode paired-negative for that removal.
      const tr = writeTranscript([
        aiTitle('Цель'),
        userTurn('задание'),
        assistantText('Ок, я выбрал Option A и поехал дальше.'),
      ]);
      const r = runHook({ transcript_path: tr, stop_hook_active: false }); // no marker
      expect(r.stdout, 'normal mode: short decision mention is silent post-claim-scan-removal').toBe('');
    });
  });

  describe('orchestration-mode — recap (b): fires on short structured status in-mode', () => {
    // Realistic dense orchestration status: >200 (in-mode recap_min) but <500
    // (normal-mode threshold) — so it fires in-mode and stays silent normally.
    const shortStructured =
      '## Статус aif-задачи\n' +
      '- запарковал task d7585d71 на форке isParked vs retarget\n' +
      '- жду ответа оператора, нужно решение по плану egress\n' +
      '- следующий шаг — harvest после ответа, потом PR в staging\n' +
      '- риск: rework-путь не коммитит, чиним на нашей стороне';

    it('IN-MODE — short STRUCTURED status (<500, markdown) → recap fires', () => {
      const tr = writeTranscript([aiTitle('Цель'), userTurn('задание'), assistantText(shortStructured)]);
      const r = runHook(
        { transcript_path: tr, stop_hook_active: false },
        { ORCHESTRATION_MODE_MARKER: writeMarker() },
      );
      expect(r.stdout, 'short structured status in-mode must fire recap').not.toBe('');
      expect(JSON.parse(r.stdout).decision).toBe('block');
    });

    it('IN-MODE — short UNSTRUCTURED chatter "ок, удалил" → silent (markdown gate holds)', () => {
      const tr = writeTranscript([aiTitle('Цель'), userTurn('задание'), assistantText('ок, удалил')]);
      const r = runHook(
        { transcript_path: tr, stop_hook_active: false },
        { ORCHESTRATION_MODE_MARKER: writeMarker() },
      );
      expect(r.stdout, 'unstructured chatter must stay silent').toBe('');
    });

    it('NORMAL-MODE — short structured status → silent (threshold unchanged)', () => {
      const tr = writeTranscript([aiTitle('Цель'), userTurn('задание'), assistantText(shortStructured)]);
      const r = runHook({ transcript_path: tr, stop_hook_active: false }); // no marker
      expect(r.stdout, 'normal mode keeps 500-char threshold').toBe('');
    });

    it('STALE marker (mtime past TTL) → behaves as normal mode', () => {
      const tr = writeTranscript([aiTitle('Цель'), userTurn('задание'), assistantText(shortStructured)]);
      const m = writeMarker();
      execSync(
        `touch -t $(date -v-7H +%Y%m%d%H%M 2>/dev/null || date -d '7 hours ago' +%Y%m%d%H%M) "${m}"`,
      );
      const r = runHook({ transcript_path: tr, stop_hook_active: false }, { ORCHESTRATION_MODE_MARKER: m });
      expect(r.stdout, 'stale marker must not enable in-mode').toBe('');
    });
  });

  it('Branch B (short text ending in ?, no claim) → emits JSON; reason mentions fork-challenge', () => {
    const tr = writeTranscript([
      aiTitle('Цель сессии B'),
      userTurn('первое задание'),
      assistantText('Какой вариант предпочитаешь — A или B?'),
    ]);
    const r = runHook({ transcript_path: tr, stop_hook_active: false });
    expect(r.status).toBe(0);
    expect(r.stdout, 'reminder must fire on bare question turn').not.toBe('');
    const payload = JSON.parse(r.stdout);
    expect(payload.decision).toBe('block');
    // Branch B reminder body must reference the fork-vs-pseudo-fork discipline,
    // not just be a generic "answer the question" nudge.
    expect(payload.reason).toMatch(/настоящая развилка|рекомендация/i);
    expect(payload.systemMessage).toMatch(/^🎯 /);
  });

  it('Branch C (long markdown AND trailing question) → emits JSON; reason includes both work-recap and question-check', () => {
    const tr = writeTranscript([
      aiTitle('Цель сессии C'),
      userTurn('первое задание'),
      assistantText(longMarkdownText() + '\n\nКакой подход предпочитаешь — X или Y?'),
    ]);
    const r = runHook({ transcript_path: tr, stop_hook_active: false });
    expect(r.status).toBe(0);
    expect(r.stdout).not.toBe('');
    const payload = JSON.parse(r.stdout);
    expect(payload.decision).toBe('block');
    // Branch C marker: explicitly mentions BOTH the long-answer recap and the
    // question; hook:177-178 wording.
    expect(payload.reason).toContain('длинный ответ');
    expect(payload.reason).toContain('вопрос');
    expect(payload.systemMessage).toMatch(/^🎯 /);
  });

  // NOTE: the former "Branch D" (short turn with a factual claim → claim-only
  // re-verify) was REMOVED 2026-06-01 with the claim-scan detector itself
  // (recall ≈0.43 / precision ≈0.20-0.25, cry-wolf). A short factual-report turn
  // with no question now stays silent — see the "short turn … → exit 0 silent"
  // case below. Rationale: research-patches/2026-06-01-remove-claim-detector.md.
  it('short turn with a file:line citation but no question → exit 0 silent (claim-scan removed)', () => {
    const tr = writeTranscript([
      aiTitle('Цель сессии D'),
      userTurn('первое задание'),
      assistantText('Готово. Поправил packages/core/hooks/foo.ts:42 как просил.'),
    ]);
    const r = runHook({ transcript_path: tr, stop_hook_active: false });
    expect(r.status, `stderr: ${r.stderr}`).toBe(0);
    expect(r.stdout, 'short claim-bearing turn with no question must now stay silent').toBe('');
  });

  it('Branch B via AskUserQuestion tool_use (no text) → emits JSON; has_askuserquestion path', () => {
    // hook:35-39 detects AskUserQuestion in tool_use; hook:42 keeps the turn
    // even with empty text when has_askuserquestion=true (boundary case).
    const tr = writeTranscript([
      aiTitle('Цель сессии AUQ'),
      userTurn('первое задание'),
      assistantToolUseOnly('AskUserQuestion'),
    ]);
    const r = runHook({ transcript_path: tr, stop_hook_active: false });
    expect(r.status).toBe(0);
    expect(r.stdout, 'AskUserQuestion-only turn must fire (has_askuserquestion → asked=true)').not.toBe('');
    const payload = JSON.parse(r.stdout);
    expect(payload.decision).toBe('block');
    expect(payload.systemMessage).toMatch(/^🎯 /);
  });

  it('PAIRED-NEGATIVE: a bare NON-question tool call (no text) → exit 0 silent (hook:53-54)', () => {
    // Companion to the AskUserQuestion case above. A tool-use-only turn whose
    // tool is NOT AskUserQuestion has empty text AND has_askuserquestion=false,
    // so hook:53-54 must exit 0 silent — a bare Bash/Read call is not a recap
    // moment. The mutation tool (B.2) showed this hook:54 `exit 0` was uncovered.
    const tr = writeTranscript([
      aiTitle('Цель сессии'),
      userTurn('первое задание'),
      assistantToolUseOnly('Bash'),
    ]);
    const r = runHook({ transcript_path: tr, stop_hook_active: false });
    expect(r.status, `stderr: ${r.stderr}`).toBe(0);
    expect(
      r.stdout,
      'a bare non-question tool call (empty text, not AskUserQuestion) must stay silent',
    ).toBe('');
  });

  // ---------------------------------------------------------------------------
  // ✅ POSITIVE — skip conditions met: hook exits 0 silent (no stdout JSON).
  // ---------------------------------------------------------------------------

  it('stop_hook_active=true → exit 0 silent (loop guard at hook:7-10)', () => {
    const tr = writeTranscript([
      aiTitle('any'),
      userTurn('x'),
      assistantText(longMarkdownText()),
    ]);
    const r = runHook({ transcript_path: tr, stop_hook_active: true });
    expect(r.status).toBe(0);
    expect(r.stdout, 'stop_hook_active loop guard must short-circuit before any output').toBe('');
  });

  it('missing transcript_path → exit 0 silent (hook:12-15)', () => {
    const r = runHook({ stop_hook_active: false });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
  });

  it('transcript file does not exist → exit 0 silent (hook:13 "! -f" branch)', () => {
    const r = runHook({ transcript_path: '/tmp/m4-5-nonexistent-transcript.jsonl', stop_hook_active: false });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
  });

  it('transcript has no assistant turn → exit 0 silent (hook:30-33)', () => {
    const tr = writeTranscript([aiTitle('cel'), userTurn('первое задание')]);
    const r = runHook({ transcript_path: tr, stop_hook_active: false });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
  });

  it('short turn with no question, no claim, no long markdown → exit 0 silent (hook:171-173)', () => {
    const tr = writeTranscript([
      aiTitle('cel'),
      userTurn('первое задание'),
      assistantText('готово, поправил заголовок.'),
    ]);
    const r = runHook({ transcript_path: tr, stop_hook_active: false });
    expect(r.status).toBe(0);
    expect(r.stdout, 'short factual report with no fork should not fire a recap').toBe('');
  });

  // ---------------------------------------------------------------------------
  // BOUNDARY / REGRESSION GUARD — B2 idle-suppress fix (hook:128-131).
  // Round-1 cold-review of the EOT redesign caught an AskUserQuestion
  // false-suppress where the recap-after-recap idle path would eat a genuine
  // new question. Memory project_eot_hook_redesign_approved 2026-05-22 records
  // this as a fixed BLOCKER. This test pins the fix in place.
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
//  BOUNDARY — already-recapped guard (hook:48-54). The current assistant turn
//  itself contains "## 🟢 Простыми словами" → re-firing would inject the recap
//  instruction over an existing recap. Complements stop_hook_active guard for
//  natural-turn proactive recaps (stop_hook_active=false). Paired-negative
//  per ~/.claude/rules/testing.md: must skip on exact marker, must NOT
//  over-suppress on look-alike marker that misses "Простыми словами".
//  ---------------------------------------------------------------------------

  it('already-recapped guard: current turn contains "## 🟢 Простыми словами" → exit 0 silent', () => {
    const tr = writeTranscript([
      aiTitle('Цель сессии'),
      userTurn('первое задание'),
      assistantText(
        '## 🟢 Простыми словами\n\nЗакрыл шаг X. Дальше — Y.\n\n' + longMarkdownText(),
      ),
    ]);
    const r = runHook({ transcript_path: tr, stop_hook_active: false });
    expect(r.status).toBe(0);
    expect(
      r.stdout,
      'already-recapped guard: long markdown turn that ALREADY contains the canonical recap marker must not re-inject reminder',
    ).toBe('');
  });

  it('already-recapped guard does NOT over-fire: "## 🟢" without "Простыми словами" → reminder still fires', () => {
    // Negative companion to the previous test. Confirms the guard matches the
    // FULL canonical marker, not just the 🟢 emoji — so a long markdown turn
    // that mentions "## 🟢 Что-то ещё" must still trigger Branch A.
    const tr = writeTranscript([
      aiTitle('Цель сессии'),
      userTurn('первое задание'),
      assistantText('## 🟢 Прогресс\n\n' + longMarkdownText()),
    ]);
    const r = runHook({ transcript_path: tr, stop_hook_active: false });
    expect(r.status).toBe(0);
    expect(
      r.stdout,
      'partial marker (🟢 without "Простыми словами") must NOT trigger the guard — Branch A must still fire',
    ).not.toBe('');
    const payload = JSON.parse(r.stdout);
    expect(payload.decision).toBe('block');
  });

  // ---------------------------------------------------------------------------
  //  idle-suppress — the MAJOR-1 re-ping guard (hook:135-156). Suppresses a
  //  short question turn ONLY when the PREVIOUS assistant turn already emitted a
  //  "## 🟢" recap AND the current turn's first 120 chars appear verbatim in it
  //  (an idle re-ping of the same question). A genuinely new question, or a long
  //  answer, must still fire. This block was surfaced as fully un-covered by the
  //  bash mutation tool (B.2): the &&/|| operators on hook:135/145 and the
  //  idle_suppress `exit 0` survived. These cases pin the divergent behaviour.
  // ---------------------------------------------------------------------------
  describe('idle-suppress re-ping guard (hook:135-156)', () => {
    const RECAP = '## 🟢 Простыми словами';

    it('re-ping: short question repeated verbatim after a "## 🟢" recap → exit 0 silent', () => {
      const question = 'Так продолжать ли с шагом Y?';
      const tr = writeTranscript([
        aiTitle('Цель сессии'),
        userTurn('первое задание'),
        // previous assistant turn: a recap that CONTAINS the question text
        assistantText(`${RECAP}\n\nЗакрыл шаг X. ${question}`),
        // current assistant turn: the SAME short question re-pinged (asked, short)
        assistantText(question),
      ]);
      const r = runHook({ transcript_path: tr, stop_hook_active: false });
      expect(r.status, `stderr: ${r.stderr}`).toBe(0);
      expect(
        r.stdout,
        'an idle re-ping of the same question after a recap must be suppressed (silent)',
      ).toBe('');
    });

    it('PAIRED-NEGATIVE: a NEW short question after a recap → still FIRES (decision:block)', () => {
      const tr = writeTranscript([
        aiTitle('Цель сессии'),
        userTurn('первое задание'),
        assistantText(`${RECAP}\n\nЗакрыл шаг X.`),
        // genuinely new question — its text does NOT appear in the prev recap
        assistantText('А что насчёт совсем другого вопроса Z?'),
      ]);
      const r = runHook({ transcript_path: tr, stop_hook_active: false });
      expect(r.status, `stderr: ${r.stderr}`).toBe(0);
      expect(
        r.stdout,
        'a genuinely new question after a recap must NOT be suppressed — it must fire',
      ).not.toBe('');
      expect(JSON.parse(r.stdout).decision).toBe('block');
    });

    it('long answer that re-pings a recap → long_text wins, Branch C still FIRES', () => {
      // Single-LINE long text: hook:145 compares `current_short` (first 120 bytes,
      // newlines→spaces) against prev_text via `grep -qF`. A single-line prefix
      // matches prev verbatim, so the idle-suppress inner condition WOULD be met —
      // making the entry guard (asked && long_text=false) the sole thing keeping
      // a long answer firing. This is what kills the hook:135 &&→|| mutant.
      const longLine =
        'Длинный однострочный ответ с **акцентом** ' +
        'и продолжением мысли которое тянется дальше '.repeat(12) +
        'итого какой подход выбрать — X или Y?';
      const tr = writeTranscript([
        aiTitle('Цель сессии'),
        userTurn('первое задание'),
        // prev recap CONTAINS the long line verbatim (so current_short ⊂ prev_text)…
        assistantText(`${RECAP}\n\n${longLine}`),
        // …but the current turn is itself long (>500) + ends in '?' → long_text=true,
        // so the idle-suppress entry condition (asked && long_text=false) is false.
        assistantText(longLine),
      ]);
      const r = runHook({ transcript_path: tr, stop_hook_active: false });
      expect(r.status, `stderr: ${r.stderr}`).toBe(0);
      expect(
        r.stdout,
        'a long answer must fire (Branch C) even if its prefix re-pings a recap — long_text overrides idle-suppress',
      ).not.toBe('');
      expect(JSON.parse(r.stdout).decision).toBe('block');
    });

    it('B2 contract: an AskUserQuestion turn that re-pings a recap → must FIRE (never idle-suppress)', () => {
      // hook:137 short-circuits idle-suppress when has_askuserquestion=true — an
      // AskUserQuestion turn is ALWAYS a live decision, even if its text echoes a
      // prior recap. Without this the operator question would be silently eaten.
      const question = 'Так продолжать ли с шагом Y?';
      const tr = writeTranscript([
        aiTitle('Цель сессии'),
        userTurn('первое задание'),
        assistantText(`${RECAP}\n\nЗакрыл шаг X. ${question}`),
        // current turn: same text BUT carries an AskUserQuestion tool_use → asked
        // via has_askuserquestion=true, and hook:137 must veto suppression.
        assistantTextAndToolUse(question, 'AskUserQuestion'),
      ]);
      const r = runHook({ transcript_path: tr, stop_hook_active: false });
      expect(r.status, `stderr: ${r.stderr}`).toBe(0);
      expect(
        r.stdout,
        'an AskUserQuestion turn must fire even when its text re-pings a recap (B2 guard, hook:137)',
      ).not.toBe('');
      expect(JSON.parse(r.stdout).decision).toBe('block');
    });
  });

  // ---------------------------------------------------------------------------
  // en-pack smoke — AIF_HOOK_LANG=en (canonical default). Confirms the language
  // pack is wired and emits English payload + the English recap marker, with no
  // Russian leakage. The RU-pack contract is covered by every other case above
  // (suite default AIF_HOOK_LANG=ru). Spec: docs/superpowers/specs/
  // 2026-06-01-hook-lang-i18n-design.md.
  // ---------------------------------------------------------------------------
  it('en pack: Branch C with AIF_HOOK_LANG=en → English reason + English recap marker', () => {
    const tr = writeTranscript([
      aiTitle('Session goal EN'),
      userTurn('first task'),
      assistantText(longMarkdownText() + '\n\nWhich approach do you prefer — X or Y?'),
    ]);
    const r = runHook({ transcript_path: tr, stop_hook_active: false }, { AIF_HOOK_LANG: 'en' });
    expect(r.status, `stderr: ${r.stderr}`).toBe(0);
    expect(r.stdout, 'en pack must fire Branch C on long markdown + trailing question').not.toBe('');
    const payload = JSON.parse(r.stdout);
    expect(payload.decision).toBe('block');
    expect(payload.reason).toContain('## 🟢 In plain words');
    expect(payload.reason).toMatch(/long answer|fork-question/i);
    expect(payload.reason, 'en pack must not leak Russian payload').not.toMatch(/Стоп|развилк/);
  });

  it('B2 fix: AskUserQuestion-only turn after prior "## 🟢" recap → must FIRE (not suppressed)', () => {
    // Scenario: previous assistant turn produced a recap (contains "## 🟢"),
    // current turn is AskUserQuestion-only with empty text. Without the B2
    // short-circuit at hook:128-131 the `grep -qF ""` against empty
    // current_short would match anything → idle_suppress=true → hook eats
    // the genuine new question.
    const tr = writeTranscript([
      aiTitle('Цель сессии B2'),
      userTurn('первое задание'),
      assistantText('## 🟢 Простыми словами\n\nЗакрыл предыдущий шаг. Дальше? Option A или Option B?'),
      assistantToolUseOnly('AskUserQuestion'),
    ]);
    const r = runHook({ transcript_path: tr, stop_hook_active: false });
    expect(r.status).toBe(0);
    expect(r.stdout, 'B2 regression guard: AUQ-only turn after recap must still fire').not.toBe('');
    const payload = JSON.parse(r.stdout);
    expect(payload.decision).toBe('block');
  });

  describe('story branch — PR-create → engaging completion recap (RU default)', () => {
    it('`gh pr create` tool_use → emits 🎬 story (not the dry recap)', () => {
      const tdir = mkdtempSync(join(tmpdir(), 'm4-5-story-ghpr-'));
      tmpDirs.push(tdir);
      const tr = writeTranscript([
        aiTitle('Цель сессии'),
        userTurn('первое задание'),
        assistantBashToolUse('Открываю PR.', 'gh pr create --base staging --title x --body y'),
      ]);
      const r = runHook({ transcript_path: tr, stop_hook_active: false, session_id: 'story-ghpr' }, { TMPDIR: tdir });
      expect(r.status, `stderr: ${r.stderr}`).toBe(0);
      expect(r.stdout, 'gh pr create turn must fire the story branch').not.toBe('');
      const payload = JSON.parse(r.stdout);
      expect(payload.decision).toBe('block');
      expect(payload.reason).toContain('## 🎬 Как это было');
      // case-insensitive: the RU prose bullet is capitalized ("По актам")
      expect(payload.reason).toMatch(/по актам/i);
    });

    it('NO PR signal: long markdown → dry recap (## 🟢), NOT 🎬 (paired-negative)', () => {
      const tr = writeTranscript([aiTitle('Цель'), userTurn('задание'), assistantText(longMarkdownText())]);
      const r = runHook({ transcript_path: tr, stop_hook_active: false, session_id: 'story-none' });
      const payload = JSON.parse(r.stdout);
      expect(payload.reason).toContain('## 🟢 Простыми словами');
      expect(payload.reason, 'no PR → no story branch').not.toContain('## 🎬');
    });

    it('debounce: same PR storied twice in one session → second turn silent', () => {
      const tdir = mkdtempSync(join(tmpdir(), 'm4-5-story-'));
      tmpDirs.push(tdir);
      const mkTr = () => writeTranscript([
        aiTitle('Цель'), userTurn('задание'),
        assistantText('PR открыт: https://github.com/o/r/pull/777'),
      ]);
      const first = runHook({ transcript_path: mkTr(), stop_hook_active: false, session_id: 'story-dbnc' }, { TMPDIR: tdir });
      expect(first.stdout).not.toBe('');
      expect(JSON.parse(first.stdout).reason).toContain('## 🎬');
      const second = runHook({ transcript_path: mkTr(), stop_hook_active: false, session_id: 'story-dbnc' }, { TMPDIR: tdir });
      expect(second.stdout, 'same PR must not re-fire (debounce)').toBe('');
    });
  });
});

// =============================================================================
// zcode-parity-step1 — Bespoke #1 Part A (grep alternation) + Part B (thin-recap).
// plan-v3 §"Bespoke #1". Fixtures: tests/fixtures/{zcode-synthetic,cc-transcript-legacy}
// -transcript.jsonl (byte-pinned shapes — see fixture file headers / generation script).
//
// Part A: the `grep -E '"(type|role)":"assistant"'` alternation is load-bearing BOTH arms:
//   - CC legacy transcript: outer `"type":"assistant"` per entry → type arm matches.
//   - ZCode synthetic transcript: `{message:{…,role:"assistant"}}` with NO outer type →
//     role arm matches (type arm returns 0 → pre-fix hook was runtime-DEAD on ZCode).
// Both arms are tested in ISOLATION so a future edit collapsing to `"type"` only is caught.
//
// Part B: a ZCode-gated thin-recap branch emits `{decision:"block", reason, systemMessage}`
// (T-ZP-B: `reason` field, NOT `additionalContext`) when last text > 500 chars AND
// markdown-dense. Non-ZCode env must NOT fire (CC dogfood byte-for-byte unchanged).
// =============================================================================
describe.skipIf(!JQ)('end-of-turn-reminder.sh — zcode-parity Bespoke #1 (Part A grep + Part B thin-recap)', () => {
  const ZCODE_FIXTURE = resolve(REPO_ROOT, 'tests/fixtures/zcode-synthetic-transcript.jsonl');
  const CC_FIXTURE = resolve(REPO_ROOT, 'tests/fixtures/cc-transcript-legacy.jsonl');

  // ---- Part A: grep alternation — both arms load-bearing, tested in isolation ----------

  it('zcode_synthetic_transcript_last_line_extracted_via_role: synthetic line has no outer type → matched via role arm', () => {
    // plan-v3 §1.7 Forward row 7 + Backward "role arm dropped" row.
    // Pre-fix: grep '"type":"assistant"' alone returned 0 lines on this fixture →
    // last_line empty → hook exit 0 (runtime-DEAD on ZCode).
    // Post-fix: the `role` arm of the alternation matches → last_line non-empty → hook proceeds.
    const r = runHook(
      { transcript_path: ZCODE_FIXTURE, stop_hook_active: false },
      // NOTE: ZCODE_PROJECT_DIR UNSET here — we want to exercise Part A's last_line extraction
      // IN ISOLATION from Part B. Part B fires later; with ZCODE_PROJECT_DIR unset, Part B is
      // skipped and the existing cascade runs. The cascade emits its own decision:block on the
      // long markdown fixture, proving last_line was extracted (non-empty) — which is the
      // Part A contract. The point of THIS test is: the hook did NOT exit-0-early at hook:54.
      { AIF_HOOK_LANG: 'en' },
    );
    expect(r.status, `stderr: ${r.stderr}`).toBe(0);
    expect(
      r.stdout,
      'Part A role-arm: synthetic ZCode line must produce non-empty last_line (hook did NOT exit at :54)',
    ).not.toBe('');
    // If last_line was empty, the hook would have exited 0 silent at hook:54 and stdout
    // would be ''. Non-empty stdout proves the role arm matched.
    const parsed = JSON.parse(r.stdout);
    expect(parsed.decision).toBe('block');
  });

  it('cc_transcript_last_line_extracted_via_type: CC fixture outer type → matched via type arm', () => {
    // plan-v3 §1.7 Forward row 8 + Backward "type arm dropped" row.
    // CC legacy shape carries an OUTER "type":"assistant" field (verified Mode A on
    // ~/.claude/projects/-Users-art-code-BDDS/0b42f1ff-*.jsonl). The type arm of the
    // alternation matches it. CC fixture has a SHORT assistant reply ("Short CC assistant
    // reply.") so the cascade stays silent — but the role-line extraction must NOT have
    // bailed out at hook:54 (which would happen if BOTH arms missed). We assert exit 0
    // AND that the hook did not crash on jq parsing of the extracted line.
    const r = runHook(
      { transcript_path: CC_FIXTURE, stop_hook_active: false },
      { AIF_HOOK_LANG: 'en' },
    );
    expect(r.status, `stderr: ${r.stderr}`).toBe(0);
    // CC short reply → no recap branch fires → silent exit 0 (the hook ran cleanly through
    // the last_line extraction + text parsing without erroring). A jq failure on the parsed
    // last_line would surface as non-zero exit under `set -euo pipefail`.
    expect(r.stdout).toBe('');
    // Direct grep proof of the asymmetry (re-asserted here so the test is self-documenting
    // and fails loudly if the fixture drifts).
    const typeMatches = execSync(
      `grep -cE '"type":"assistant"' "${CC_FIXTURE}" 2>/dev/null || echo 0`,
    ).toString().trim();
    expect(parseInt(typeMatches, 10), 'CC fixture must have outer "type":"assistant"').toBeGreaterThan(0);
  });

  it('Part A both arms proven asymmetric via direct grep on fixtures (load-bearing alternation)', () => {
    // T7 anti-pattern guard: a future edit collapsing the alternation to `"type"` only is the
    // canonical regression. This test pins the asymmetry directly so it cannot drift.
    // ZCode fixture MUST NOT match the type arm (only role); CC fixture matches both.
    // We use single-quoted grep patterns (no shell escaping of the inner doubles).
    const zcodeTypeCount = parseInt(
      execSync(`grep -cE '"type":"assistant"' "${ZCODE_FIXTURE}" || true`).toString().trim() || '0',
      10,
    );
    const zcodeRoleCount = parseInt(
      execSync(`grep -cE '"role":"assistant"' "${ZCODE_FIXTURE}" || true`).toString().trim() || '0',
      10,
    );
    // The alternation pattern: shell-single-quote wraps the whole pattern so the inner
    // double-quotes pass through literally to grep.
    const zcodeAltCount = parseInt(
      execSync(`grep -cE '"(type|role)":"assistant"' "${ZCODE_FIXTURE}" || true`).toString().trim() || '0',
      10,
    );
    expect(zcodeTypeCount, 'ZCode fixture must have ZERO outer "type":"assistant" (only role)').toBe(0);
    expect(zcodeRoleCount, 'ZCode fixture must match the role arm').toBeGreaterThan(0);
    expect(zcodeAltCount, 'ZCode fixture must match the full alternation').toBeGreaterThan(0);
  });

  // ---- Part B: thin-recap branch (ZCode-gated, reason field) --------------------------

  it('zcode_long_markdown_emits_block_decision_with_reason_field: >500 chars markdown under _is_zcode → {decision:block, reason}', () => {
    // plan-v3 §1.7 Forward row 9 + Backward "branch absent" + "additionalContext instead of reason" rows.
    // The thin-recap branch fires when _is_zcode AND text > 500 AND markdown-dense.
    // The fixture's assistant text is 676 chars with ## headings + ** bold + blank lines.
    const r = runHook(
      { transcript_path: ZCODE_FIXTURE, stop_hook_active: false },
      { ZCODE_PROJECT_DIR: '/fake-zcode-root', AIF_HOOK_LANG: 'en' },
    );
    expect(r.status, `stderr: ${r.stderr}`).toBe(0);
    expect(r.stdout, 'Part B must fire on ZCode + long markdown').not.toBe('');
    const parsed = JSON.parse(r.stdout);
    expect(parsed.decision).toBe('block');
    expect(typeof parsed.reason).toBe('string');
    expect(parsed.reason.length, 'reason must be a substantive nudge, not empty').toBeGreaterThan(100);
    // The Branch A instruction begins with the recap marker — pin it so a future edit
    // pointing Part B at the wrong message function is caught.
    expect(parsed.reason).toContain('## 🟢');
    // systemMessage is the user-UI glance line (optional but emitted).
    expect(parsed.systemMessage).toMatch(/^🎯 /);
  });

  it('thin_recap_emits_reason_not_additional_context: emitted JSON has reason, NOT additionalContext (T-ZP-B)', () => {
    // plan-v3 §1.7 Backward "Part B uses additionalContext instead of reason" row.
    // Stop-hook field for delivering the nudge to the MODEL is `reason` (NOT additionalContext,
    // which is a PostToolUse/PreToolUse field — comment at hook:227 documents this).
    // This test fails if anyone swaps the field by pattern-matching on other hooks.
    const r = runHook(
      { transcript_path: ZCODE_FIXTURE, stop_hook_active: false },
      { ZCODE_PROJECT_DIR: '/fake-zcode-root', AIF_HOOK_LANG: 'en' },
    );
    expect(r.status, `stderr: ${r.stderr}`).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.reason, 'reason field MUST be present (Stop-hook model-bound delivery)').toBeDefined();
    expect(parsed.additionalContext, 'additionalContext MUST NOT appear on Stop-hook emit (wrong channel)').toBeUndefined();
  });

  it('non_zcode_skips_thin_recap: under non-ZCode env, Part B branch does not fire', () => {
    // plan-v3 §1.7 Forward row 10 + Backward "_is_zcode gate absent" row.
    // Without ZCODE_PROJECT_DIR, Part B MUST be skipped — otherwise CC dogfood would get
    // a duplicate nudge (Part B + the existing cascade both firing).
    // We use a SHORT markdown turn here so the cascade ALSO stays silent — that way a
    // non-empty stdout can ONLY mean Part B fired (isolating the gate).
    const shortMarkdown = '## short\n\n- a\n- b\n- c\n';  // <500 chars, has ##
    const tr = writeTranscript([
      { type: 'ai-title', aiTitle: 'goal' },
      { type: 'user', message: { content: 'do something' } },
      assistantText(shortMarkdown),
    ]);
    const r = runHook(
      { transcript_path: tr, stop_hook_active: false },
      { AIF_HOOK_LANG: 'en' },  // NO ZCODE_PROJECT_DIR
    );
    expect(r.status, `stderr: ${r.stderr}`).toBe(0);
    expect(
      r.stdout,
      'Part B must NOT fire without ZCODE_PROJECT_DIR (short text → all branches silent)',
    ).toBe('');
  });

  it('non_zcode_long_markdown_still_uses_existing_cascade: Part B skipped, Branch A still fires on long markdown', () => {
    // Paired-negative companion: a long-markdown turn on non-ZCode MUST still trigger the
    // existing Branch A cascade (proving Part B is additive, not a replacement). This is
    // the "byte-for-byte unchanged on CC dogfood" contract.
    const tr = writeTranscript([
      { type: 'ai-title', aiTitle: 'goal' },
      { type: 'user', message: { content: 'do something' } },
      assistantText(longMarkdownText()),
    ]);
    const r = runHook(
      { transcript_path: tr, stop_hook_active: false },
      { AIF_HOOK_LANG: 'en' },  // NO ZCODE_PROJECT_DIR
    );
    expect(r.status, `stderr: ${r.stderr}`).toBe(0);
    expect(r.stdout, 'existing Branch A cascade must still fire on long markdown (CC dogfood unchanged)').not.toBe('');
    const parsed = JSON.parse(r.stdout);
    expect(parsed.decision).toBe('block');
    expect(parsed.reason).toBeDefined();
  });
});

/**
 * F10 autonomy arm — spec: .claude/rules/autonomous-loop-continuity.md §1.
 *
 * The failure this closes: an unattended orchestrator ends its turn as soon as it has
 * something reportable while dispatched work is still running. The shape that matters is a
 * SHORT turn — the one every existing branch deliberately exits 0 on — so these cases use a
 * short-chatter transcript and assert the arm blocks anyway.
 *
 * The probe is pointed at an unreachable port in every case here: the tests must not depend
 * on a live aif runtime, and the fail-CLOSED branch is itself part of the contract.
 */
describe('end-of-turn-reminder.sh — F10 autonomy arm', () => {
  const DEAD_AIF = 'http://127.0.0.1:59997';

  it('OFF by default: a short turn stays silent even with work conceivably in flight', () => {
    const tr = writeTranscript([{ type: 'assistant', message: { content: [{ type: 'text', text: 'ok' }] } }]);
    const r = runHook({ transcript_path: tr, stop_hook_active: false, session_id: 'f10-off' });
    expect(r.status).toBe(0);
    expect(r.stdout.trim(), 'no autonomy block without AIF_AUTONOMOUS=1').toBe('');
  });

  it('ON + unreachable probe: blocks and NAMES the degradation (fail-closed, not all-clear)', () => {
    const tr = writeTranscript([{ type: 'assistant', message: { content: [{ type: 'text', text: 'ok' }] } }]);
    const r = runHook(
      { transcript_path: tr, stop_hook_active: false, session_id: 'f10-dead' },
      { AIF_AUTONOMOUS: '1', RUNTIME_BRIDGE_AIF_URL: DEAD_AIF },
    );
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout) as { decision: string; reason: string };
    expect(parsed.decision, 'a broken probe must not read as an all-clear').toBe('block');
    expect(parsed.reason).toMatch(/probe FAILED/);
    expect(parsed.reason, 'must not claim the check passed').toMatch(/not an all-clear/);
  });

  it('the loop guard holds: stop_hook_active=true never blocks, however work looks', () => {
    const tr = writeTranscript([{ type: 'assistant', message: { content: [{ type: 'text', text: 'ok' }] } }]);
    const r = runHook(
      { transcript_path: tr, stop_hook_active: true, session_id: 'f10-guard' },
      { AIF_AUTONOMOUS: '1', RUNTIME_BRIDGE_AIF_URL: DEAD_AIF },
    );
    expect(r.status).toBe(0);
    expect(r.stdout.trim(), 'at most ONE forced reconsideration per stop chain — never a spin').toBe('');
  });

  it('an empty task list is a genuine all-clear: no block', () => {
    // Serve a literal empty array, so "no work in flight" is distinguished from "probe broke".
    const tr = writeTranscript([{ type: 'assistant', message: { content: [{ type: 'text', text: 'ok' }] } }]);
    const r = withTasks('[]', (url) =>
      runHook(
        { transcript_path: tr, stop_hook_active: false, session_id: 'f10-empty' },
        { AIF_AUTONOMOUS: '1', RUNTIME_BRIDGE_AIF_URL: url },
      ),
    );
    expect(r.status).toBe(0);
    expect(r.stdout, 'must never fabricate in-flight work').not.toMatch(/task\(s\) still in flight/);
    expect(r.stdout.trim(), 'an empty queue is a real all-clear, not a degraded probe').toBe('');
  });

  // ── In-flight contract ──────────────────────────────────────────────────────
  // Everything above this line points the probe at a DEAD port, so until these
  // were added the arm's entire reason to exist — "there is work in flight, do
  // not stop" — had zero coverage. A 2026-07-24 mutation campaign proved it:
  // inverting the comparison, deleting the `paused` filter, dropping a status
  // from the list, and muting the in-flight branch outright ALL left the suite
  // green. A suite that stays green with the mechanism disabled is not a gate.

  it('PAIRED-POSITIVE: an in-flight task blocks the stop and names the count', () => {
    const tr = writeTranscript([assistantText('ok')]);
    const r = withTasks(JSON.stringify([task('implementing')]), (url) =>
      runHook(
        { transcript_path: tr, stop_hook_active: false, session_id: 'f10-live' },
        { AIF_AUTONOMOUS: '1', RUNTIME_BRIDGE_AIF_URL: url },
      ),
    );
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout) as { decision: string; reason: string };
    expect(parsed.decision, 'work in flight must not let the turn end').toBe('block');
    expect(parsed.reason).toMatch(/1 aif task\(s\) still in flight/);
    expect(parsed.reason, 'the directive is the payload, not just the fact').toMatch(/Do NOT end the turn on a report/);
  });

  it('counts every NON-TERMINAL status, not a hand-maintained subset', () => {
    // The shipped predicate enumerated {planning, implementing, review,
    // blocked_external} — a strict subset of the real vocabulary in
    // packages/runtime-bridge/src/types.ts. `backlog` was the sharp miss: at
    // coordinator cap, dispatched tasks queue there, so the arm went silent with
    // work about to run. Enumerating terminal statuses instead makes any status
    // added upstream count as in-flight by default.
    for (const status of ['backlog', 'planning', 'plan_ready', 'implementing', 'review', 'blocked_external']) {
      const tr = writeTranscript([assistantText('ok')]);
      const r = withTasks(JSON.stringify([task(status)]), (url) =>
        runHook(
          { transcript_path: tr, stop_hook_active: false, session_id: `f10-st-${status}` },
          { AIF_AUTONOMOUS: '1', RUNTIME_BRIDGE_AIF_URL: url },
        ),
      );
      expect(r.stdout, `status "${status}" is non-terminal and MUST count as in flight`)
        .toMatch(/still in flight/);
    }
  });

  it('PAIRED-NEGATIVE: terminal statuses are not in flight (or every turn would block forever)', () => {
    for (const status of ['done', 'verified']) {
      const tr = writeTranscript([assistantText('ok')]);
      const r = withTasks(JSON.stringify([task(status)]), (url) =>
        runHook(
          { transcript_path: tr, stop_hook_active: false, session_id: `f10-term-${status}` },
          { AIF_AUTONOMOUS: '1', RUNTIME_BRIDGE_AIF_URL: url },
        ),
      );
      expect(r.stdout.trim(), `"${status}" is terminal — counting it would block every turn forever`).toBe('');
    }
  });

  it('PAIRED-NEGATIVE: a PAUSED task does not count (it cannot advance)', () => {
    const tr = writeTranscript([assistantText('ok')]);
    const r = withTasks(JSON.stringify([{ ...task('implementing'), paused: true }]), (url) =>
      runHook(
        { transcript_path: tr, stop_hook_active: false, session_id: 'f10-paused' },
        { AIF_AUTONOMOUS: '1', RUNTIME_BRIDGE_AIF_URL: url },
      ),
    );
    expect(r.stdout.trim(), 'a paused task is not progressing; blocking on it would spin').toBe('');
  });

  // ── Guard-shadowing regression (the 2026-07-24 cold-audit BLOCKER) ──────────
  // The arm used to sit at the BOTTOM of the hook, behind six `exit 0` guards.
  // The already-recapped guard exits when the turn carries $AIF_RECAP_MARKER —
  // and an orchestrator that "ends its turn on a report" is emitting exactly
  // that, using the marker this hook's own payloads instruct it to use. So the
  // mechanism was silent in precisely its motivating case, and got worse the
  // longer a session ran. These two are the regression guards.

  it('a RECAP-MARKED turn still receives the continuation directive', () => {
    const tr = writeTranscript([assistantText(`${'детали '.repeat(120)}\n\n## 🟢 Простыми словами\nвсё готово`)]);
    const r = withTasks(JSON.stringify([task('implementing')]), (url) =>
      runHook(
        { transcript_path: tr, stop_hook_active: false, session_id: 'f10-recap' },
        { AIF_AUTONOMOUS: '1', RUNTIME_BRIDGE_AIF_URL: url },
      ),
    );
    const parsed = JSON.parse(r.stdout) as { decision: string; reason: string };
    expect(parsed.decision).toBe('block');
    expect(parsed.reason, 'the recap guard must suppress the RECAP, never the autonomy directive')
      .toMatch(/still in flight/);
  });

  it('an IDLE-SUPPRESSED re-ping still receives the continuation directive', () => {
    // idle_suppress fires when the previous turn already recapped and the current
    // turn repeats it verbatim (a re-ping). Suppressing the recap is right;
    // suppressing the autonomy directive is not — an idle re-ping while work is
    // dispatched is the F10 shape almost by definition.
    const q = 'Продолжать со следующим этапом?';
    const tr = writeTranscript([
      aiTitle('goal'),
      userTurn('go'),
      assistantText(`## 🟢 Простыми словами\nсделано.\n${q}`),
      assistantText(q),
    ]);
    const r = withTasks(JSON.stringify([task('planning')]), (url) =>
      runHook(
        { transcript_path: tr, stop_hook_active: false, session_id: 'f10-idle' },
        { AIF_AUTONOMOUS: '1', RUNTIME_BRIDGE_AIF_URL: url },
      ),
    );
    expect(r.stdout, 'idle-suppression must suppress the RE-PING, not the autonomy directive')
      .toMatch(/still in flight/);
  });

  it('a STORY-TOLD turn still receives the continuation directive', () => {
    // The story-debounce guard suppresses re-telling the same PR's story. Like the
    // recap guard, its bare exit also swallowed the autonomy directive — and this
    // one fires right after `gh pr create`, i.e. at a moment when dispatched work
    // very plausibly is still running.
    const tr = writeTranscript([
      assistantBashToolUse(`## 🎬 Как это было\nоткрыл PR`, 'gh pr create --fill'),
    ]);
    const r = withTasks(JSON.stringify([task('implementing')]), (url) =>
      runHook(
        { transcript_path: tr, stop_hook_active: false, session_id: 'f10-story' },
        { AIF_AUTONOMOUS: '1', RUNTIME_BRIDGE_AIF_URL: url },
      ),
    );
    expect(r.stdout, 'story debounce must suppress the STORY, not the autonomy directive')
      .toMatch(/still in flight/);
  });

  it('a TOOL-ONLY turn still receives the continuation directive', () => {
    const tr = writeTranscript([
      { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: 'ls' } }] } },
    ]);
    const r = withTasks(JSON.stringify([task('implementing')]), (url) =>
      runHook(
        { transcript_path: tr, stop_hook_active: false, session_id: 'f10-toolonly' },
        { AIF_AUTONOMOUS: '1', RUNTIME_BRIDGE_AIF_URL: url },
      ),
    );
    expect(r.stdout, 'a turn ending on a tool call with work in flight is still F10').toMatch(/still in flight/);
  });

  // ── Shape fail-closed ──────────────────────────────────────────────────────
  // Malformed BYTES were already handled. Well-formed JSON of the wrong SHAPE
  // was not: the filter yields a legitimate-looking 0 and the arm reports a
  // clean all-clear forever. `{"tasks":[…]}` is the most plausible upstream
  // evolution of this endpoint, which is what makes it worth a gate.

  it('PAIRED-NEGATIVE: a non-array payload is a DEGRADED probe, not an all-clear', () => {
    const tr = writeTranscript([assistantText('ok')]);
    const r = withTasks(JSON.stringify({ tasks: [task('implementing')] }), (url) =>
      runHook(
        { transcript_path: tr, stop_hook_active: false, session_id: 'f10-envelope' },
        { AIF_AUTONOMOUS: '1', RUNTIME_BRIDGE_AIF_URL: url },
      ),
    );
    const parsed = JSON.parse(r.stdout) as { decision: string; reason: string };
    expect(parsed.decision, 'a shape change must never read as "nothing in flight"').toBe('block');
    expect(parsed.reason).toMatch(/NON-ARRAY payload/);
    expect(parsed.reason).toMatch(/not an all-clear/);
  });

  it('PAIRED-NEGATIVE: an array of non-task elements is a DEGRADED probe', () => {
    const tr = writeTranscript([assistantText('ok')]);
    const r = withTasks(JSON.stringify(['a', 'b']), (url) =>
      runHook(
        { transcript_path: tr, stop_hook_active: false, session_id: 'f10-nonobj' },
        { AIF_AUTONOMOUS: '1', RUNTIME_BRIDGE_AIF_URL: url },
      ),
    );
    const parsed = JSON.parse(r.stdout) as { decision: string; reason: string };
    expect(parsed.decision, 'an array of non-objects silently counted 0 before').toBe('block');
    expect(parsed.reason).toMatch(/non-task element/);
  });

  it('the autonomy line rides ALONG with a normal recap block, never replacing it', () => {
    // A long substantive turn triggers Branch A. The continuation directive must
    // be appended, not swap the recap out — dropping either loses information the
    // model needs in the same turn.
    const tr = writeTranscript([aiTitle('goal'), userTurn('go'), assistantText(longMarkdownText())]);
    const r = withTasks(JSON.stringify([task('review')]), (url) =>
      runHook(
        { transcript_path: tr, stop_hook_active: false, session_id: 'f10-both' },
        { AIF_AUTONOMOUS: '1', RUNTIME_BRIDGE_AIF_URL: url },
      ),
    );
    const parsed = JSON.parse(r.stdout) as { decision: string; reason: string; systemMessage?: string };
    expect(parsed.decision).toBe('block');
    expect(parsed.reason, 'recap half').toMatch(/🟢/);
    expect(parsed.reason, 'autonomy half').toMatch(/still in flight/);
  });

  // ── ZCode thin-recap arm autonomy append ─────────────────────────────────
  // The ZCode thin-recap branch (hook ~line 219) builds `_ze_reason` from
  // `aif_msg_eot_branch_a` and then appends `autonomy_line` separately. M8 of
  // this PR's mutation campaign proved the append had ZERO coverage — stripping
  // it left the suite GREEN. A ZCode path needs an explicit ZCode test.

  it('PAIRED-NEGATIVE: ZCode thin-recap arm appends autonomy_line to its own reason', () => {
    // Triggers the thin-recap branch: ZCODE_PROJECT_DIR set + >500 char markdown-dense text.
    // A dispatched task is in flight, so the autonomy directive MUST reach the model
    // on the SAME channel as the ZCode recap (single block decision, not two).
    const tr = writeTranscript([aiTitle('goal'), userTurn('go'), assistantText(longMarkdownText())]);
    const r = withTasks(JSON.stringify([task('implementing')]), (url) =>
      runHook(
        { transcript_path: tr, stop_hook_active: false, session_id: 'f10-zcode-append' },
        {
          AIF_AUTONOMOUS: '1',
          RUNTIME_BRIDGE_AIF_URL: url,
          ZCODE_PROJECT_DIR: '/fake-zcode-root',
          AIF_HOOK_LANG: 'en',
        },
      ),
    );
    const parsed = JSON.parse(r.stdout) as { decision: string; reason: string };
    expect(parsed.decision, 'ZCode thin-recap arm must block when work is in flight').toBe('block');
    // The recap half (Branch A instruction begins with the recap marker):
    expect(parsed.reason, 'ZCode arm recap half must still be delivered').toMatch(/🟢/);
    // The autonomy half — the M8 mutation strips exactly this; without a test that
    // asserts it under ZCODE_PROJECT_DIR, the append can be removed silently.
    expect(parsed.reason, 'ZCode arm autonomy half must be appended, not dropped').toMatch(/still in flight/);
  });
});
