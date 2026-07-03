---
name: story
description: Use when work is done / a PR was pushed, or when the user asks to recap what was done ("расскажи что сделали", "расскажи историю", "story", "recap", "по актам") — tells the story of this session in plain, engaging language, by acts, with jargon explained, honest about what's left. Output language follows AIF_HOOK_LANG (RU operator / EN default).
---

> **Authoritative for:** /story skill — session recap narrated as a story by acts; localized to the operator's language via AIF_HOOK_LANG; single SSOT for the story spec shared with the Stop-hook branch.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Per-turn self-diagnostic recap (`## 🟢`) — that is a separate output.

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

## Without this skill

The agent closes a finished session with the dense per-turn `## 🟢` self-diagnostic
checklist (or nothing) — a status report written "for the AI's own sake", not an
engaging account the human can read with pleasure. The completion-recap wording also
drifts independently of the Stop-hook story branch, since there is no shared source.

## With this skill

The agent emits one shared, localized story instruction (the same SSOT the Stop-hook
`aif_msg_eot_branch_story` branch uses) and narrates the whole session as a story — by
acts, with jargon explained on the spot, honest about what is thin or still left, and
ending on the human's next decision. It begins with the `## 🎬` marker so the human
spots it at a glance.

## Paired-negative (what this skill must NOT do)

- ❌ Do NOT emit a dry self-diagnostic checklist (that is the `## 🟢` recap's job) — if
  the output reads like a status report rather than a story, it is wrong.
- ❌ Do NOT translate the emitted instruction — render in the pack's language as-is.
- ✅ A correct invocation begins with `## 🎬`, reads as a narrative by acts, and ends on
  the human's next decision.

## Notes

- All skill files are English-canonical (public repo); Russian reaches the operator only
  via the lang pack selected by `AIF_HOOK_LANG`.
