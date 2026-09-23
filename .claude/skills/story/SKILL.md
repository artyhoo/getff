---
name: story
description: Use when work is done / a PR was pushed, or when the user asks to recap what was done — «расскажи что сделали», «расскажи историю», «что изменилось за сессию», story, recap.
---

<!-- @harness-posture: cc-native-with-fallback — !shell injection (SKILL.md:20) + Stop-hook auto-emission (SKILL.md:23) are CC-native; degradation: run helpers/emit-story-prompt.sh manually / recap on request -->

> **Authoritative for:** /story skill — the session-scale plain-words recap of what changed this session; localized to the operator's language via AIF_HOOK_LANG; single SSOT for the recap spec shared with the Stop-hook branch.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Per-turn self-diagnostic recap (`## 🟢`) — that is a separate output.

# /story — the session recap in plain words

Recap the whole session for the human in plain words — the reader-facing companion to
the dry per-turn self-diagnostic recap (`## 🟢`). Different jobs: a plain-words account
of what changed for the reader vs. a checklist for your own sake.

## Steps

1. Get the localized story instruction. Run:
   `!bash ${CLAUDE_SKILL_DIR}/helpers/emit-story-prompt.sh`
   It prints the full story-spec in the operator's language (English by default;
   Russian when `AIF_HOOK_LANG=ru`) — the single source of truth, shared with the
   Stop-hook `aif_msg_eot_branch_story` branch.

2. Render the recap, following that instruction exactly — the five session-scale sections:
   why all this was (one sentence); what is different now (per change: before, after, what it
   gives the operator — no chronology); what was decided and by whom (one line each); what is
   least sure; and the two-line closing (Me / From you). Explain jargon on the spot. Begin with
   the marker line the instruction gives you (`## 🎬 …`).

3. Write in the language the emitted instruction uses — do not translate it.

## Without this skill

The agent closes a finished session with the dense per-turn `## 🟢` self-diagnostic
checklist (or nothing) — a status report written "for the AI's own sake", not a
plain-words account the human can read and act on. The completion-recap wording also
drifts independently of the Stop-hook story branch, since there is no shared source.

## With this skill

The agent emits one shared, localized recap instruction (the same SSOT the Stop-hook
`aif_msg_eot_branch_story` branch uses) and renders the session-scale recap — what is
different now for the operator (before → after → what it gives them), what was decided and
by whom, honest about what is thin or still left, and ending on the human's next decision.
It begins with the `## 🎬` marker so the human spots it at a glance.

## Paired-negative (what this skill must NOT do)

- ❌ Do NOT emit a dry self-diagnostic checklist (that is the `## 🟢` recap's job) — if
  the output reads like a status report instead of the five plain-words sections, it is
  wrong.
- ❌ Do NOT translate the emitted instruction — render in the pack's language as-is.
- ✅ A correct invocation begins with `## 🎬 What changed this session`, renders the five
  session-scale sections without chronology, and ends on the human's next decision.

## Notes

- All skill files are English-canonical (public repo); Russian reaches the operator only
  via the lang pack selected by `AIF_HOOK_LANG`.
