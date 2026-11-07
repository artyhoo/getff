---
title: ai-laziness-traps rule
description: The rule that names 22 ways an AI agent produces the shape of work without the work, and makes every delegated kickoff cite the ones it is exposed to.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .agents/rules/ai-laziness-traps.md
  - .agents/rules/00-rule-index.md
  - packages/core/principles/12-ai-laziness-traps.test.ts
  - .claude/orchestrator-prompts/getff-ai-site/kickoff-s1rf1a.md
  - docs/site/reference/F1.json
  - docs/site/reference/F1.md
  - docs/site/reference/F1/ai-laziness-digest.md
  - docs/site/terms.md
executed:
  - { example: kickoff-citation-and-enumeration, stack: repo, date: 2026-10-07, result: printed }
docs-refresh: deferred — re-verified 2026-10-12, the cited overview changed only its batch-status paragraph, class-list links and frontmatter sources (the all-30 refresh after the F1b merge); this sheet's only anchor into it, #how-to-read-a-rule-page, is untouched; clears at the next gold refresh of this page
---

# ai-laziness-traps rule

## Fact card

What each row means: [how to read a rule page](../F1.md#how-to-read-a-rule-page).

<!-- vale off -->
<!-- vale-reason: the card quotes the rule file's own header text verbatim, in the rule file's voice rather than this site's -->

<!-- getff:begin section=F1-card-ai-laziness-traps plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `ai-laziness-traps` |
| kind | rule |
| ships-to | framework |
| description | ai-laziness-traps discipline rule — §1 problem this solves, §2 canonical trap catalogue, §3 kickoff-author obligations (cite + extend, no blanket reference), §4 anti-patterns, §5 promotion / retirement triggers. |
| source | `.agents/rules/ai-laziness-traps.md:20` |
| class | A |
| fires | any R-phase, audit, sample-based investigation, or open-ended AI task. |
| channels | paths:(8), edit-time inject |
<!-- getff:end section=F1-card-ai-laziness-traps -->

<!-- vale on -->

## Explanation

An AI agent whose stopping point is "when I am done" drifts to the path of least
resistance: it produces the shape of the expected output without performing the work
behind it. This [rule](../../terms.md#rule) is the project's field guide to that
failure. Its catalogue names 22 traps — T1, sampling three surfaces and calling the
category clean, is the first — and for each one states the
trigger, the output a lazy agent is tempted to produce, and the countermeasure.

The catalogue does nothing by itself. The rule's leverage is on documents that
delegate work: every kickoff (a brief that sends an AI session to do a job) must cite
this rule, list which traps apply to its task, and add at least one trap of its own.
A blanket "see the traps rule" without naming the numbers is itself the T7 failure —
patterning the prompt instead of reasoning against it. The companion
[ai-laziness-digest](ai-laziness-digest.md) rule keeps one line per trap resident
in every session so the numbers are in front of the agent at the moment of work.

This is a class `A` rule: an executable test ships with it. The test walks every
tracked kickoff file and fails any that neither cites the rule nor references trap
numbers. Here is a kickoff that passes, from the batch of pages you are reading:

```bash
grep -n "rules/ai-laziness-traps" .claude/orchestrator-prompts/getff-ai-site/kickoff-s1rf1a.md
grep -n "Active traps" .claude/orchestrator-prompts/getff-ai-site/kickoff-s1rf1a.md
```

```text
146:See [ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md).
147:Active traps: **T1**, **T2**, **T3**, **T8**, **T10**, **T14**, **T15**, **T19**, **T21**.
```

The `channels` row says where the rule reaches you: the files it scopes load at
read time, and an edit-time injection re-surfaces its summary when you edit them.
What the rule does not do: it cannot tell a real trap citation from a copy-pasted
one, and it does not judge whether the delegated session actually applied the
counters. A kickoff can satisfy the gate with a rule citation alone. Enumerating
applicable traps and adding a task-specific trap remain review-time obligations;
the gate does not prove either was done.

## Evidence

Checked 2026-10-07 against the working tree this batch was written in; citations, counts and captured outputs re-verified 2026-10-10 against the merge-forward tree. Pins re-verified 2026-10-12 at the universal-integration branch head: the range's rule/test/workflow edits (including the in-body citation renumber) shifted no pin cited on this page — every pin was re-read at the current base and still shows the quoted content.

- The catalogue spans `### T1` at `.claude/rules/ai-laziness-traps.md:47` through
  `### T22` at `:186`; 22 headings, counted live on the digest sheet.
- The kickoff obligations this rule imposes, including the blanket-reference
  rejection, are `§3` at `.claude/rules/ai-laziness-traps.md:196` and `:204`.
- The shipped test and what it requires:
  `packages/core/principles/12-ai-laziness-traps.test.ts:2` names the enforcement;
  `:14` to `:17` list the four citation forms it accepts; `:122` runs the check over
  all non-exempt kickoffs.
- The greps above ran at this base; both lines are in the kickoff that produced
  this page family.
- The index row grading this rule class `A` with channels
  `paths:(8), edit-time inject`: `.claude/rules/00-rule-index.md:11`.
