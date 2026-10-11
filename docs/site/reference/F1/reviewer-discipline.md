---
title: reviewer-discipline rule
description: The rule that a reviewer reports instead of decides — when a finding turns on project strategy, the reviewer names the decision, describes both options' consequences, and stops.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .agents/rules/reviewer-discipline.md
  - .agents/rules/00-rule-index.md
  - agents/reviewer-discipline.md
  - docs/site/reference/F1.json
  - docs/site/reference/F1.md
  - docs/site/terms.md
executed:
  - { example: channel-target-check, stack: repo, date: 2026-10-11, result: agent-description-line-3 }
---

# reviewer-discipline rule

## Fact card

What each row means: [how to read a rule page](../F1.md#how-to-read-a-rule-page).

<!-- vale off -->
<!-- vale-reason: the card quotes the rule file's own header text verbatim, in the rule file's voice rather than this site's -->

<!-- getff:begin section=F1-card-reviewer-discipline plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `reviewer-discipline` |
| kind | rule |
| ships-to | framework |
| description | reviewer-discipline rule — §1 reviewer/orchestrator role separation, §2 surface-as-decision-needed pattern, §3 anti-patterns (`#role-swap-mid-session`, `#strategy-decided-by-reviewer`), §4 promotion / retirement triggers, §5 classification, §6 severity contract + ESCALATED grammar, §6.1 the deployed three-axis triage rubric + its per-axis measurement provenance, §6.2 the calibrated L4 round-budget config + its derivation and provenance label. |
| source | `.agents/rules/reviewer-discipline.md:7` |
| class | C |
| fires | review sessions (`/review`, `/ultrareview`, or a prose "проверь"/verdict ask). |
| channels | agent |
<!-- getff:end section=F1-card-reviewer-discipline -->

<!-- vale on -->

## Explanation

A review exists to falsify, not to steer. The incident behind this
[rule](../../terms.md#rule): mid-review, a reviewer session was asked whether an
architecture section described a future spec or an active requirement — and answered
it, making an orchestrator-track strategy call from inside the review seat. The harm
is structural, not personal: a reviewer who picks strategy becomes a second
orchestrator, and the independent-verification property the review existed for is
gone. The discipline is a four-step surface pattern with a name sharp enough to
quote: when a finding turns on "which way should the project go?", write
`DECISION-NEEDED: <summary>`, describe both options' downstream consequences
without endorsing either ("Option A → consequence X" / "Option B → consequence Y"),
flag that the answer belongs to the maintainer or a separate orchestrator session —
and stop. The reviewer can describe what each path implies; the reviewer cannot
pick between them.

The `class` row is `C`, and the rule file is candid about how it got there: an
earlier draft claimed a compensating mechanism, an audit probed that claim, and the
probe found the cited agent was scoped to a different review entirely — the
name-matching trap the framework catalogues as assuming a tool does what its label
says. So the class was re-drawn to prose-only, honestly. What the rule does have is
a delivery surface: a named agent protocol file that a review session reads at
review time, wired in by the card's `agent` [channel](../../terms.md#channel) marker
— and the channel-declaration gate keeps that pointer honest, verifying the pointed-at
file exists. Its own frontmatter turns out to carry the whole thesis in one line:

```bash
grep -n "DECISION-NEEDED" agents/reviewer-discipline.md
ls packages/core/principles/ | grep -ci reviewer
```

```text
3:description: Review-session protocol for reviewer/orchestrator role separation — when a finding needs a project-strategy call, surface it as DECISION-NEEDED with both options described, never pick a side. Reports; does not decide.
0
```

"Reports; does not decide." — and the second command confirms there is no companion
principle test, exactly as a Class-C row should read.

The rule's later sections are unusually heavy for a prose rule: a severity contract
under which only a finding with a concrete failure scenario may spawn a re-review
round, and a three-axis triage rubric quoted verbatim from a measured bench prompt —
verbatim because a reworded question was never measured, so each axis travels with
an explicit provenance label (`layer` is corpus-measured; `class` was measured and
did not pay; `whose` is judgment-only and is never to be cited as validated). A
round-budget table derives its numbers from a measured audit corpus and labels
itself corpus-derived, uncalibrated — starting points, never constants.

What the rule does not do: it does not gate. A prose "please review" ask that
bypasses the agent protocol entirely is accepted partial coverage by the rule's own
text, and counts against the promotion counter only if a role-swap actually
results. No check reads a reviewer's report and detects strategy-picking — that is
judgment — so promotion to a mechanical test waits on the incident threshold the
rule names: three cross-session role-swaps within six months.

## Evidence

Checked 2026-10-11 against the working tree this batch was written in.

- The Class-C header and its reclass record (commit 4d52a72): `.claude/rules/reviewer-discipline.md:5`.
- The origin incident: `:10`.
- `§1` the discipline and the cannot-pick line: `:12` to `:20` (`:18`); the
  alt-channel note naming the agent protocol: `:20`.
- `§2` the four-step DECISION-NEEDED pattern: `:22` to `:31` (steps at `:26` to `:29`,
  the independence rationale at `:31`).
- `§3` the anti-pattern family: `:33` to `:37`.
- `§4` the promotion trigger (3 incidents / 6 months) and retirement: `:39` to `:42`.
- `§5` why Class C — the audit that probed the claimed compensating mechanism and
  found it scoped elsewhere: `:44` to `:54` (the probe at `:50`).
- `§6` the severity contract and the `Failure-scenario:` discriminator: `:56` to
  `:65` (recorded-premise test at `:60`, contract at `:61`, zero-finding legitimacy
  at `:62`).
- `§6.1` the verbatim-quoted rubric and its per-axis provenance labels: `:67` to
  `:99` (do-not-reword rule at `:70`, quoted yardstick `:72` to `:90`, labels at
  `:92` to `:97`).
- `§6.2` the round budgets, config-not-statute, with their provenance label and
  falsifiers: `:101` to `:125` (`:103`, `:121`, `:123`).
- The channel target the grep above reads: `agents/reviewer-discipline.md:3`; the
  rule's channel marker pointing at it: `.claude/rules/reviewer-discipline.md:3`.
- The index row grading this rule class `C` with channel `agent`:
  `.claude/rules/00-rule-index.md:34`.
