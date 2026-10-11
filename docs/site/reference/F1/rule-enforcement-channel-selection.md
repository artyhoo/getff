---
title: rule-enforcement-channel-selection rule
description: The rule for choosing where a rule lives — mechanically detectable violations become gates, judgment calls become injections, and the trigger is always the narrowest deterministic one that fires reliably.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .agents/rules/rule-enforcement-channel-selection.md
  - .agents/rules/00-rule-index.md
  - packages/core/principles/31-rule-channel-declaration.test.ts
  - packages/core/principles/31-rule-channel-declaration.ts
  - .claude/hooks/inject-matching-rule.sh
  - docs/site/reference/F1.json
  - docs/site/reference/F1.md
  - docs/site/terms.md
executed:
  - { example: always-on-ceiling, stack: repo, date: 2026-10-11, result: length-gt-4-throws }
---

# rule-enforcement-channel-selection rule

## Fact card

What each row means: [how to read a rule page](../F1.md#how-to-read-a-rule-page).

<!-- vale off -->
<!-- vale-reason: the card quotes the rule file's own header text verbatim, in the rule file's voice rather than this site's -->

<!-- getff:begin section=F1-card-rule-enforcement-channel-selection plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `rule-enforcement-channel-selection` |
| kind | rule |
| ships-to | framework |
| description | rule-enforcement-channel-selection discipline — §1 the two-axis principle, §2 triggers/non-triggers, §3 the selection procedure, §4 channel catalogue (this repo), §5 anti-patterns, §6 promotion/retirement. |
| source | `.agents/rules/rule-enforcement-channel-selection.md:13` |
| class | A |
| fires | codifying any new rule / choosing its enforcement channel. |
| channels | paths:(3), edit-time inject |
<!-- getff:end section=F1-card-rule-enforcement-channel-selection -->

<!-- vale on -->

## Explanation

Every rule on this site answers a second question besides "what is the
discipline?": where does it live? The origin incident for this
[rule](../../terms.md#rule) was an agent stumbling over a merge flow that was
recorded — in memory, the least reliable place to keep anything. The root insight
of the maintainer became the rule: "remember reliably" and "put in memory" are not the
same act, and a convention that must hold across sessions needs a delivery
[channel](../../terms.md#channel) chosen deliberately, not parked where recall
happens to find it.

The choice runs along two independent axes. Axis one is detectability: if a
violation is mechanically detectable, build a [gate](../../terms.md#gate) — a
deterministic check that blocks — at the earliest reachable moment; if it needs
judgment, inject the rule's text at the decision point instead. The two are not
of the same kind: a judgment rule cannot be gated, so injection is the only tool, not a
weaker gate. Axis two is breadth: pick the narrowest deterministic trigger that
still fires reliably, in a strict reliability order — a path-scoped hook first,
the always-on digest only for the few invariants relevant every turn, semantic
triggering only for convenience, and memory never as the primary channel for
anything load-bearing. The rule's catalogue table prices eleven concrete channels
by standing cost and reliability, and draws the gate/injection line on one
property: the exit code. A hook that exits nonzero blocks; one that prints
context informs.

The `class` row is `A`: a companion test ships, and it enforces the axis-choice's
bookkeeping — every git-tracked rule file must declare its channel through one of
four branches (path frontmatter, a globs marker, always-on membership, or a
channel marker pointing at an artifact that really exists). The always-on branch
carries a hard ceiling, because "reserve always-on for the 3–4 sweeping
invariants" would otherwise be advice:

```bash
grep -n "ALWAYS_ON_CORE" packages/core/principles/31-rule-channel-declaration.ts | head -4
```

```text
22: *   (c) is named in ALWAYS_ON_CORE (asserted length <= 4 — the Tier-0 core, always resident), OR
58: * set, so a growing ALWAYS_ON_CORE would silently undo that work).
60:export const ALWAYS_ON_CORE: readonly string[] = [
66:if (ALWAYS_ON_CORE.length > 4) {
```

A fifth always-on rule does not merely look untidy — the test throws. The
accompanying source comment states why the ceiling is load-bearing: a growing
always-on core would silently undo the re-scoping work that moved rules off it.

This rule is also its own best specimen: it was the first file in the repository to
carry both the native path frontmatter and the marker the edit-time injector reads —
the same scope delivered through two channels, one per harness, kept identical by
convention and checked for set-equality by the companion test.

What the rule does not do: no test decides whether a rule sits at the *narrowest*
channel — the companion gate verifies a channel is declared and live, not that the
choice was optimal. That call stays judgment, and the rule says so in its own
self-application section rather than letting a reader assume optimality is enforced.

## Evidence

Checked 2026-10-11 against the working tree this batch was written in.

- The Class-A header with the promotion history (C → B → A, with dates) and the
  activation line: `.claude/rules/rule-enforcement-channel-selection.md:11`.
- The origin incident and its maintainer insight: `:16`.
- `§1` the two axes: `:18` to `:34` — detectability at `:22` to `:25` (the
  not-rankable line at `:25`), the reliability order at `:29`, semantic-below-
  always-on at `:32`, and the origin fix at `:34`.
- `§2` triggers and non-triggers: `:36` to `:40`.
- `§3` the five-step selection procedure: `:42` to `:50` (never-memory at `:49`,
  record-the-channel at `:50`).
- `§4` the channel catalogue: `:52` to `:74` — table at `:54` to `:66`, the
  exit-code distinction at `:68`, the injector mechanism at `:70`, the dual-pair
  note at `:72`, the read-vs-edit timing reconcile at `:74`.
- `§5` the six anti-patterns, including memory-as-primary and gate-where-judgment:
  `:76` to `:83`.
- `§6` the Class-A promotion record and what principle 31 asserts: `:85` to `:93`
  (the four branches and the ceiling at `:87`).
- `§7` self-application, including the honest "no test decides narrowest": `:95`
  to `:97`.
- The companion module quoted above:
  `packages/core/principles/31-rule-channel-declaration.ts:22`, `:58`, `:60`, `:66`
  (suite: `packages/core/principles/31-rule-channel-declaration.test.ts`).
- The scope markers: `:3` to `:7` (`paths:` frontmatter, three patterns), `:112`
  (`<!-- globs: -->`), `:113` (`<!-- inject: -->`); the injector itself:
  `.claude/hooks/inject-matching-rule.sh`.
- The index row grading this rule class `A` with channels `paths:(3), edit-time
  inject`: `.claude/rules/00-rule-index.md:35`.
