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
   `bash .agents/procedures/story/helpers/emit-story-prompt.sh`
   It prints the full story-spec in the operator's language (English by default;
   Russian when `AIF_HOOK_LANG=ru`) — the single source of truth, shared with the
   Stop-hook `aif_msg_eot_branch_story` branch.

   Preserve the helper's exit status and stderr. If it fails or emits no instruction,
   report the failed command and stop: no story block can be rendered from a missing
   instruction. Reading a pack or reconstructing the format is not a successful run.

2. Render the recap, following that instruction exactly — the five session-scale sections:
   why all this was (one sentence); what is different now (per change: before, after, what it
   gives the operator — no chronology); what was decided and by whom (one line each); what is
   least sure; and the two-line closing (Me / From you). Write in short sentences of one idea
   each, with `CONTEXT.md` terms written bare and other jargon in plain words. Begin with
   the marker line the instruction gives you (`## 🎬 …`).

   Build the recap from a session fact ledger before writing the five sections:

   | Ledger field | Value comes from |
   | --- | --- |
   | Before / after / observed benefit | Supplied session facts or an observed result; an expected benefit is labelled expected and its consumer prerequisites also need supplied or observed evidence |
   | Test result | The exact reported outcome; test cases, executions, file sizes and CI results each need their own evidence |
   | Delivery | The reported PR-push statement; separate evidence for PR existence, other pushes, merge, publication and local/remote state |
   | Decisions | The stated choice and its stated owner |
   | Open decision | The operator's pending choice, preserved as pending |

   A field without evidence has the value **unknown**, not a guessed value or a
   negative claim. "A regression test passed" supplies its outcome, not its execution
   count or a CI result. "No PR was pushed" supplies only that push fact; PR existence,
   other pushes and local/remote state stay unknown. Render it as "No PR was pushed",
   with its PR scope intact, rather than a general push status.
   Export capability, consumer requirements, expected compatibility and the actual
   downstream result are separate facts. Semicolon support and a passed regression
   test establish export behavior, not which delimiter an accounting importer needs
   or accepts. Even an expected benefit needs supplied or observed evidence for its
   consumer prerequisites; calling it "expected" does not permit inventing them.
   If those prerequisites are unknown, expected compatibility is unknown too.
   An actual import result or a claim that import was never run needs its own evidence.

   Render ledger-backed changes and decisions in sections 2 and 3. In section 4,
   include the test outcome, execution count, tested file size, CI result, and each
   delivery field (reported PR-push fact, PR existence, other pushes, merge,
   publication, local/remote state). Each
   absent value is explicitly unknown; these are separate fields, not one status.
   Section 5 keeps the pending operator choice in "From you";
   "Me" describes only an authorized next action or waiting for that choice.
   The helper gives the format and language; its template premises supply no session
   facts. Finally compare each factual statement against its ledger field. Remove a
   statement whose only source is the helper, an inference from silence, or a guessed
   quantity. A recap does not authorize executing an unresolved decision.

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

<!-- getff:common-invocation-binding -->
## Common invocation binding

Preserve the complete supplied arguments and operator request. Before resolving a
relative command, input or resource, bind the nearest ancestor of the current cwd
that contains `.agents/procedures/story/SKILL.md`; do not substitute an enclosing
Git root or the framework source checkout. Keep absolute supplied input paths unchanged.
Resolve project-relative inputs against that bound project and procedure-relative
resources against its canonical procedure directory. If no such ancestor exists,
STOP with the missing installed-project prerequisite before executing a helper.
For a shell helper, change to that bound project first and quote every path and
argument separately; keep its exit status and diagnostics. Discovery does not grant
permissions, hook trust, global configuration changes or external messaging.
When explaining an idea, design or workflow with meaningful relationships, use a
small Mermaid diagram plus equivalent readable text in an existing permitted output
section. Preserve strict report grammars and closing anchors. Show only supplied or
verified relationships, label uncertainty, and do not depict an unobserved execution
or authorization as completed. Skip diagrams when they add no explanatory value.
<!-- /getff:common-invocation-binding -->
