# Kickoff — `/story` session-recap (skill + Stop-hook story branch)

> **Type:** I-phase (implementation). Single atomic PR. **Dispatch target:** aif-handoff autonomous worker.
> **Self-contained:** every exact change is embedded. Executable on the current `staging` base alone — all files it MODIFIES already exist there; new files it CREATES are given in full. Do NOT depend on reading the plan/spec (they live on another branch, may be absent in the container base).

## Goal (one line)

When work is done (a PR was just pushed), tell the human the story of the whole session in plain, engaging language — via a new `/story` skill (manual) AND a new Stop-hook branch (auto on PR-create). One shared, localized instruction is the single source of truth for both.

## Why

The existing per-turn recap (`## 🟢 …`, `aif_msg_eot_branch_a/_c`) is a dense self-diagnostic checklist "for your own sake" — not optimised to be read with pleasure, and it fires every substantial turn. The maintainer wants a SEPARATE, reader-facing, engaging "story-in-acts" recap that fires only when work is done. Different job, parallel to the existing Branch A vs C split. Language follows `AIF_HOOK_LANG` (EN canonical / RU operator) — hook-style: the WHOLE instruction is localized, so output language follows the active pack.

## Scope (STRICT)

- **IN:** `.claude/hooks/lang/{en,ru}.sh` (+ `check-parity.sh`), `.claude/hooks/end-of-turn-reminder.sh`, its test `packages/core/hooks/end-of-turn-reminder.test.ts`, NEW `.claude/skills/story/`, NEW `packages/core/skills/emit-story-prompt.test.ts`, one SSOT row.
- **OUT (do NOT touch):** the `/pipeline` skill (separate PR), the existing Branch A/B/C recap wording, any unrelated file.

## Task 1 — SSOT row (prior-art residue)

Compute the next free id on THIS base:
```bash
grep -oE '^\| [0-9]+ ' docs/meta-factory/prior-art-evaluations.md | tr -d '| ' | sort -n | tail -1
```
Add 1 → call it `N`. Append one row at the end of the register table (replace `N`):
```text
| N | `session-report` CC plugin = usage analytics (tokens/cache HTML dashboard); ecosystem session-recap skills (`annikalewis/claude-recap`, Ben Poole) = cross-session memory ("where did we leave off") | Engaging plain-language story-in-acts completion recap for the human (`/story` skill + Stop-hook branch) | 2026-06-16 | 2026-06-16 | REJECT (session-report) · REFERENCE (claude-recap) | T16 problem-class check: session-report = usage/cost analytics → REJECT (different problem). claude-recap et al. = memory/continuity archaeology for the NEXT session → REFERENCE only: reusable bit is "read ~/.claude/projects/*.jsonl transcript directly", already present (end-of-turn-reminder.sh reads transcript_path). Story-in-acts style is maintainer taste → BUILD (cheap: lang-function + skill + helper + hook branch, no new dep). Survey 2026-06-16: installed companions + SSOT + WebSearch x2. | If a companion ships a human-facing engaging-completion-recap (not analytics, not memory) — re-evaluate ADOPT. |
```
Commit:
```text
docs(ssot): session-report REJECT + claude-recap REFERENCE for /story recap

Prior-art: skipped — SSOT register append documenting the build-vs-reuse verdict for /story; no new capability in this commit.
```

## Task 2 — shared story prose + marker (both lang packs) + parity

Append to `.claude/hooks/lang/en.sh`:
```bash
# Story-recap heading (Stop-hook story branch + /story skill greps/embeds this).
AIF_STORY_MARKER='## 🎬 The story'

# Stop hook story branch / /story skill: engaging plain-language session recap when
# work is done (a PR was pushed). Hook-style: the whole instruction is localized so
# output language follows the active pack. ${anchor:-} is safe when unset (the /story
# skill has no transcript anchor and names the goal from context).
aif_msg_eot_branch_story() {
  cat <<EOF
The work is done (a PR was just pushed) — now tell the human the story of this whole session, primarily for them.
You MUST begin the block with exactly the line "${AIF_STORY_MARKER}" — so the human spots it at a glance.

Session goal (from the title / first instruction): "${anchor:-(name it yourself from context)}".

Tell it as a story, in plain, engaging language — NOT a dry checklist:
• Open in one sentence — what we set out to do and why, in human terms.
• By acts — the narrative arc of the key moves, named (file / PR / decision): what we did, what went wrong, how we fixed it.
• Explain jargon on the spot — hit a term (egress, caffeinate, Docker) → give a one-line analogy right there.
• Be honest — where it is thinly verified (one run, one case), what you are least sure of, what is still left.
• End on the human — the one thing left for them to decide or do ("one step — your go").
Tone: interesting, like a story; no filler, no self-congratulation; truth over smoothness. If a part does not come out concrete, say so plainly.
EOF
}
```
Append to `.claude/hooks/lang/ru.sh`:
```bash
# Заголовок story-пересказа (story-ветка Stop-хука + скил /story).
AIF_STORY_MARKER='## 🎬 Как это было'

# Story-ветка Stop-хука / скил /story: живой пересказ сессии простыми словами, когда
# работа сдана (запушен PR). Hook-style: вся инструкция локализована, поэтому язык
# вывода следует активному паку. ${anchor:-} безопасен при unset (у /story нет
# transcript-anchor — цель называет сам из контекста).
aif_msg_eot_branch_story() {
  cat <<EOF
Работа сдана (только что запушен PR) — расскажи человеку историю всей сессии, в первую очередь для него.
ОБЯЗАТЕЛЬНО начни блок ровно со строки "${AIF_STORY_MARKER}" — чтобы человек опознал его с ходу.

Цель сессии (из названия / первого задания): "${anchor:-(назови сам из контекста)}".

Рассказывай как историю, простым и живым языком — НЕ сухим чеклистом:
• Открой одной фразой — что вообще затевали и зачем, по-человечески.
• По актам — сюжетная арка ключевых ходов, с именами (файл / PR / решение): что делали, что пошло не так, как починили.
• Жаргон объясняй на месте — встретил термин (egress, caffeinate, Docker) → тут же аналогия одной строкой.
• Будь честен — где проверено слабо (1 прогон, 1 случай), в чём меньше всего уверен, что осталось.
• Кончи на человеке — одна вещь, которую решить/сделать ему («один шаг — твоё „го"»).
Тон: интересно, как история; без воды и само-поздравления; правда важнее гладкости. Если пункт не выходит конкретным — скажи прямо.
EOF
}
```
In `.claude/hooks/lang/check-parity.sh`, after the line `grep -qE '^AIF_RECAP_MARKER=' "$1" && echo 'AIF_RECAP_MARKER'`, add inside the same `{ }` block:
```bash
    grep -qE '^AIF_STORY_MARKER=' "$1" && echo 'AIF_STORY_MARKER'
```
Verify: `bash .claude/hooks/lang/check-parity.sh` → `OK`. Commit:
```text
feat(hooks): add aif_msg_eot_branch_story + AIF_STORY_MARKER (shared /story SSOT prose)

Prior-art: prior-art-evaluations.md#N (claude-recap REFERENCE / session-report REJECT — narrative recap, problem-class mismatch with analytics/memory).
```

## Task 3 — Stop-hook story branch (TDD, precise text anchors)

**Test first.** In `packages/core/hooks/end-of-turn-reminder.test.ts`, add this helper next to `assistantTextAndToolUse`:
```typescript
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
```
Add this `describe` block inside the top-level `describe.skipIf(!JQ)(...)` (before its final `});`):
```typescript
  describe('story branch — PR-create → engaging completion recap (RU default)', () => {
    it('`gh pr create` tool_use → emits 🎬 story (not the dry recap)', () => {
      const tr = writeTranscript([
        aiTitle('Цель сессии'),
        userTurn('первое задание'),
        assistantBashToolUse('Открываю PR.', 'gh pr create --base staging --title x --body y'),
      ]);
      const r = runHook({ transcript_path: tr, stop_hook_active: false, session_id: 'story-ghpr' });
      expect(r.status, `stderr: ${r.stderr}`).toBe(0);
      expect(r.stdout, 'gh pr create turn must fire the story branch').not.toBe('');
      const payload = JSON.parse(r.stdout);
      expect(payload.decision).toBe('block');
      expect(payload.reason).toContain('## 🎬 Как это было');
      expect(payload.reason).toMatch(/по актам/);
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
```
Run `npx vitest run packages/core/hooks/end-of-turn-reminder.test.ts -t story` → expect FAIL.

**Implement** in `.claude/hooks/end-of-turn-reminder.sh` — five precise edits (anchor on the quoted text, NOT line numbers):

Edit A — detection. Find the line assigning `text` (it starts with `text=$(echo "$last_line" | jq -r`). Immediately AFTER its closing line, insert:
```bash
# -- story branch detection: a PR was just created this turn → engaging recap ----
session_id=$(echo "$input" | jq -r '.session_id // "nosession"' 2>/dev/null || echo "nosession")
story_signal=""
_gh=$(echo "$last_line" | jq -r '.message.content[]? | select(.type=="tool_use" and .name=="Bash") | .input.command // empty' 2>/dev/null | grep -c 'gh pr create' || true)
_url=$(printf '%s' "$text" | grep -oE 'github\.com/[^ )]+/pull/[0-9]+' | head -1 || true)
if [ "${_gh:-0}" -gt 0 ] || [ -n "$_url" ]; then
  story_signal="${_url:-pr-created}"
fi
```

Edit B — keep the empty-text exit from killing a tool-only PR turn. Replace:
```bash
if [ -z "$text" ] && [ "$has_askuserquestion" != "true" ]; then
```
with:
```bash
if [ -z "$text" ] && [ "$has_askuserquestion" != "true" ] && [ -z "$story_signal" ]; then
```

Edit C — already-told guard + debounce. Find the existing already-recapped guard block (the `if … grep -qF "$AIF_RECAP_MARKER"; then exit 0; fi`). Immediately AFTER its closing `fi`, insert:
```bash
# Story already told this turn → do not re-inject.
if [ -n "$story_signal" ] && [ -n "$text" ] && printf '%s' "$text" | grep -qF "$AIF_STORY_MARKER"; then
  exit 0
fi
# Debounce by PR: same PR already storied this session → fall through to normal branches.
if [ -n "$story_signal" ]; then
  story_flag="${TMPDIR:-/tmp}/aif-story-${session_id}"
  if [ -f "$story_flag" ] && [ "$(cat "$story_flag" 2>/dev/null || true)" = "$story_signal" ]; then
    story_signal=""
  fi
fi
```

Edit D — do not let the short-turn early-exit swallow a story turn. Replace:
```bash
if [ "$long_text" = "false" ] && [ "$asked" = "false" ]; then
  exit 0
fi
```
with:
```bash
if [ "$long_text" = "false" ] && [ "$asked" = "false" ] && [ -z "$story_signal" ]; then
  exit 0
fi
```

Edit E — branch selection: story FIRST. Find the selection that begins `if [ "$long_text" = "true" ] && [ "$asked" = "true" ]; then` … and prepend a story branch so it reads:
```bash
if [ -n "$story_signal" ]; then
  reminder=$(aif_msg_eot_branch_story)
  printf '%s' "$story_signal" > "${TMPDIR:-/tmp}/aif-story-${session_id}" 2>/dev/null || true
elif [ "$long_text" = "true" ] && [ "$asked" = "true" ]; then
  reminder=$(aif_msg_eot_branch_c)
elif [ "$long_text" = "true" ]; then
  reminder=$(aif_msg_eot_branch_a)
elif [ "$asked" = "true" ]; then
  reminder=$(aif_msg_eot_branch_b)
fi
```

Run the **FULL** suite — every pre-existing case MUST stay green:
```bash
npx vitest run packages/core/hooks/end-of-turn-reminder.test.ts
```
Commit:
```text
feat(hooks): Stop-hook story branch on PR-create (trigger A + debounce)

Prior-art: prior-art-evaluations.md#N (claude-recap REFERENCE — transcript-read reused; story style BUILT).
```

## Task 4 — `/story` skill helper (TDD)

**Test first** — create `packages/core/skills/emit-story-prompt.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HELPER = resolve(REPO_ROOT, '.claude/skills/story/helpers/emit-story-prompt.sh');

function run(lang?: string): string {
  const env = { ...process.env };
  if (lang === undefined) delete env.AIF_HOOK_LANG;
  else env.AIF_HOOK_LANG = lang;
  return execFileSync('bash', [HELPER], { env, encoding: 'utf8' });
}

describe('emit-story-prompt.sh', () => {
  it('default → English story instruction with the 🎬 marker', () => {
    const out = run(undefined);
    expect(out).toContain('## 🎬 The story');
    expect(out).toMatch(/by acts/i);
  });
  it('AIF_HOOK_LANG=ru → Russian story instruction', () => {
    const out = run('ru');
    expect(out).toContain('## 🎬 Как это было');
    expect(out).toMatch(/по актам/);
  });
  it('unknown lang → English fallback (non-empty)', () => {
    const out = run('zz');
    expect(out).toContain('## 🎬 The story');
    expect(out.trim().length).toBeGreaterThan(0);
  });
});
```
Run → FAIL (helper absent). **Create** `.claude/skills/story/helpers/emit-story-prompt.sh` then `chmod +x` it:
```bash
#!/usr/bin/env bash
# @cc-only-rationale: internal /story skill helper — bridges the markdown skill to the shared hook lang pack; not shipped to consumer projects via install.sh
# @dual-pair: session-story-recap
#
# Sources the active-language hook lang pack (AIF_HOOK_LANG, default en, EN
# fallback) and echoes the full story-instruction prose (aif_msg_eot_branch_story).
# The /story SKILL.md invokes this via `!bash` (markdown cannot `source`), then
# narrates by acts. Single SSOT: the prose lives only in .claude/hooks/lang/{en,ru}.sh.
set -euo pipefail

_repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
_lang_file="${_repo}/.claude/hooks/lang/${AIF_HOOK_LANG:-en}.sh"
[ -f "$_lang_file" ] || _lang_file="${_repo}/.claude/hooks/lang/en.sh"
# shellcheck source=/dev/null
. "$_lang_file"

anchor="${anchor:-}"   # /story has no transcript anchor; the skill names the goal from context
aif_msg_eot_branch_story
```
Run `npx vitest run packages/core/skills/emit-story-prompt.test.ts` → PASS. Commit:
```text
feat(skills): /story emit-story-prompt helper (sources shared hook pack, i18n)

Prior-art: skipped — thin SSOT-bridge helper, no new capability/dependency (reuses Task 2 prose).
```

## Task 5 — `/story` SKILL.md + principle-test probe

**Create** `.claude/skills/story/SKILL.md`:
````markdown
---
name: story
description: Tell the story of this session in plain, engaging language — by acts, with jargon explained, honest about what's left. Use when work is done / a PR was pushed, or when the user asks to recap what was done ("расскажи что сделали", "расскажи историю", "story", "recap", "по актам"). Output language follows AIF_HOOK_LANG (RU operator / EN default).
---

# /story — session recap as a story

Narrate the whole session as an engaging, plain-language story for the human — the
reader-facing companion to the dry per-turn self-diagnostic recap (`## 🟢`). Different
jobs: a story for the reader vs. a checklist for your own sake.

## Steps

1. Get the localized story instruction. Run:
   `!bash ${CLAUDE_SKILL_DIR}/helpers/emit-story-prompt.sh`
   It prints the full story-spec in the operator's language (English by default;
   Russian when `AIF_HOOK_LANG=ru`) — the single source of truth, shared with the
   Stop-hook `aif_msg_eot_branch_story` branch.

2. Tell the story, following that instruction exactly: open in one sentence, then by
   acts (named files / PRs / decisions), explain jargon on the spot, be honest about
   what's thin / uncertain / left, end on the one thing left for the human. Begin with
   the marker line the instruction gives you (`## 🎬 …`).

3. Write in the language the emitted instruction uses — do not translate it.

## Paired-negative (what this skill must NOT do)

- ❌ Do NOT emit a dry self-diagnostic checklist (that is the `## 🟢` recap's job) — if
  the output reads like a status report rather than a story, it is wrong.
- ❌ Do NOT translate the emitted instruction — render in the pack's language as-is.
- ✅ A correct invocation begins with `## 🎬`, reads as a narrative by acts, and ends on
  the human's next decision.

## Notes

- All skill files are English-canonical (public repo); Russian reaches the operator only
  via the lang pack selected by `AIF_HOOK_LANG`.
````

**Principle-test probe (mandatory — a new SKILL.md is on a watched path).** Run:
```bash
grep -rn 'EXEMPT_\|allowlist\|skip' packages/core/principles/ | grep -E '\.(test\.)?ts:' | head -20
npx vitest run packages/core/principles
```
Expect PASS. If principle 15 (paired-negative) or 10 (scope annotation) fires on `.claude/skills/story/SKILL.md`: principle 15 is satisfied by the `## Paired-negative` block above; for principle 10 add the scope annotation the failing test names (or add to its `EXEMPT_*` allowlist only if genuinely exempt). Re-run until green. Commit:
```text
feat(skills): add /story skill (engaging session recap, hook-style i18n)

Prior-art: prior-art-evaluations.md#N (claude-recap REFERENCE / session-report REJECT).
```

## Task 6 — verify + open PR

```bash
bash .claude/hooks/lang/check-parity.sh
npx vitest run packages/core/hooks/end-of-turn-reminder.test.ts packages/core/skills/emit-story-prompt.test.ts
npx vitest run packages/core/principles
```
All green. Then own cold-QA the diff (T19): story fires ONLY on PR signal; all pre-existing hook cases green; no Russian in `en.sh` / English-canonical skill files; `${anchor:-}` safe under `set -u`. Open ONE atomic PR, base `staging`, title `feat: /story session-recap skill + Stop-hook story branch`. **Stop after opening — do NOT merge; operator reviews.**

## Acceptance criteria

- `bash .claude/hooks/lang/check-parity.sh` → `OK`.
- Full `end-of-turn-reminder.test.ts` green (all pre-existing + 3 new story cases).
- `emit-story-prompt.test.ts` green (3/3).
- `packages/core/principles` green (incl. principle 12 on this kickoff, 15/10 on the new skill).
- `AIF_HOOK_LANG=ru bash .claude/skills/story/helpers/emit-story-prompt.sh | head -1` → references `## 🎬 Как это было`.
- `git diff` touches ONLY in-scope files; no `/pipeline` change.

## AI-laziness traps — REQUIRED (per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

**Active traps: T3, T5, T15, T16, T19** + two domain-specific.

- **T3** (plausible-without-verification): every "passes" backed by pasted command output, never prose-only.
- **T5** (bundling): `/story` only — do NOT also fix `/pipeline` (separate PR). Note observations, don't edit.
- **T15** (self-application): the feature is test-covered (Tasks 3, 4) — do not skip tests "because small".
- **T16** (pattern-matching-on-name): survey already done (REJECT session-report, REFERENCE claude-recap) — do not re-adopt a companion; implement the known design.
- **T19** (own cold-QA before handoff): re-read the diff + run the FULL acceptance block before the PR; CI-green ≠ design-correct.
- **T-Story-A** (hook surgery by eyeball): `end-of-turn-reminder.sh` is ~200 lines with `set -euo pipefail`; apply the EXACT old→new anchors (Edits A–E), then run the FULL existing test suite — every pre-existing case MUST stay green. A broken hook silently mutes the maintainer's recaps. If an anchor text does not match verbatim, PARK and ask (see below) — do NOT improvise the insert point.
- **T-Story-B** (skip the principle probe): a new `SKILL.md` trips principle 15/10 if the paired-negative/scope rules aren't met (precedent: PR #264 pushed twice). Run `packages/core/principles` BEFORE opening the PR, not after.

## Genuine-fork → PARK, do not guess

This is fully specified. **If** an anchor in Edit A–E does not match the hook verbatim (the hook drifted), or a pre-existing test fails for a reason not covered here, or principle 10/15 wants something ambiguous — do NOT guess and do NOT silently pick. **Park the task and ask the operator** (aif park primitive). Genuine fork = no clearly-better option on the merits. A clear call → make it and say what you did.

## PR strategy

- One atomic PR, base `staging`. Stop after opening; operator merges.
- PR body MUST carry the §1.7 self-check the `discipline-self-check.yml` gate requires: `### §1.7 Forward-check applied` + `### §1.7 Backward-check applied`, EACH with a concrete `file:line` citation.

## Operator references (may be absent from the container base — do not depend on them)

- Plan: `docs/superpowers/plans/2026-06-16-session-story-recap.md`
- Spec: `docs/superpowers/specs/2026-06-16-session-story-recap-design.md`
- Sibling effort (separate PR): `/pipeline` i18n fix — `.claude/orchestrator-prompts/pipeline-i18n-fix/kickoff.md`

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
