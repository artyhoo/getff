---
title: kickoff-staging-placement rule
description: The rule that a dispatch-input kickoff is merged to the staging branch before anyone is told to dispatch against it, because every dispatch consumer reads kickoffs from staging and a branch-only kickoff is invisible to them.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .agents/rules/kickoff-staging-placement.md
  - .agents/rules/00-rule-index.md
  - packages/core/principles/44-kickoff-authoring-traps.test.ts
  - packages/core/principles/kickoff-population.ts
  - .claude/hooks/check-kickoff-traps.sh
  - .claude/hooks/inject-matching-rule.sh
  - scripts/link-coordination.sh
  - docs/site/reference/F1.json
  - docs/site/reference/F1.md
  - docs/site/terms.md
executed:
  - { example: stage-kickoff-regex, stack: repo, date: 2026-10-11, result: population-ts-line-34 }
---

# kickoff-staging-placement rule

## Fact card

What each row means: [how to read a rule page](../F1.md#how-to-read-a-rule-page).

<!-- vale off -->
<!-- vale-reason: the card quotes the rule file's own header text verbatim, in the rule file's voice rather than this site's -->

<!-- getff:begin section=F1-card-kickoff-staging-placement plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `kickoff-staging-placement` |
| kind | rule |
| ships-to | framework |
| description | where dispatch-input kickoffs must live before a `/pipeline` or aif dispatch is initiated, and why; the edit-time reminder mechanism; **the kickoff-authoring failure modes that render as success on this surface** (§5) — an authoring mistake under `.claude/orchestrator-prompts/**` that produces no warning at any channel. |
| source | `.agents/rules/kickoff-staging-placement.md:14` |
| class | A |
| fires | editing/creating any file under `.claude/orchestrator-prompts/<umbrella>/`. |
| channels | paths:(1), edit-time inject |
<!-- getff:end section=F1-card-kickoff-staging-placement -->

<!-- vale on -->

## Explanation

The framework's work is dispatched from written briefs. A pipeline run or a handoff
worker does not get a verbal summary; it reads a kickoff file and executes it. Those
dispatch sessions run against the `staging` branch, and they look for the brief there.
So a kickoff that exists only on a feature worktree branch — written, committed, ready —
is invisible to the very session it was written for. This is not hypothetical: the
first time it happened, a pipeline run on staging resolved to a stale plan with the
same name and fixed the wrong thing. The [rule](../../terms.md#rule) is a sequence:
author the kickoff, merge it to staging, and only then hand out the dispatch.

The `class` row is `A`, and the honest reading is in the rule's own header: the
merge-timing sequence itself is enforced by no gate, because at authoring time the right answer
to "is it on staging yet?" is legitimately no — no check at any branch-scoped channel
can assert a *timing* rule. What makes the class an A is the rest of the shipped
surface: three authoring mistakes on this directory that render as success, each gated
at its own earliest reachable channel, with the companion principle test as the durable
backstop for commits no local hook runs. Two of the three are worth knowing because
their damage is deferred — everything looks green when the mistake is made.

The first: this directory is gitignored with per-umbrella exceptions, and a
coordination helper adopts files git does not track into a shared store, leaving a symlink
behind. Write a new kickoff, run `git add` in a later step, and the commit can take
the 84-byte link instead of the 232-line brief. Status output shows a normal path;
everything reads fine through the link; the commit is worthless as a copy, and a later
cleanup of the store destroys the only real one. A pre-commit section now rejects a
symlinked kickoff outright.

The second is a naming trap. Stage kickoffs must match a strict pattern — a letter, a
digit, optionally letters and digits — and the pattern deliberately keeps dotted sidecar
files out. A name like `kickoff-bs0.md` just misses it: the single letter consumes
`b`, then the required digit meets `s`. Every gate then treats the file as a
deliberate sidecar and reports green having examined nothing. The pattern lives in
one shared module, which the test and the shell twin both resolve against:

```bash
grep -n "STAGE_KICKOFF_RE =" packages/core/principles/kickoff-population.ts
```

```text
34:export const STAGE_KICKOFF_RE = /^kickoff-[a-z]\d[a-z0-9]*\.md$/;
```

`kickoff-b0.md` matches; `kickoff-bs0.md` does not. A name that resolves to neither
the stage form nor a named sidecar is now a loud error naming both alternatives.

The `channels` row names `paths:(1)` and `edit-time inject`: the rule's scope is this
one directory, and an edit-time [injector](../../terms.md#channel) delivers a one-line
reminder on any write under it — the earliest channel that can fire, since dispatch
can precede any push.

What the rule does not do: it cannot stop a dispatch issued before the merge — the
violation is a message a human or agent sends, and no check sees it at send time. The
rule file reserves a promotion path for a dispatch-preflight gate should another
wrong-target dispatch incident fire; none has since the rule landed.

## Evidence

Checked 2026-10-11 against the working tree this batch was written in.

- The rule sequence and why a branch-only kickoff is invisible:
  `.claude/rules/kickoff-staging-placement.md:19` to `:28` (`§1`), origin incident at
  `:17`.
- The Class-A header with the honest scope note that §1 itself is enforced by no gate: `:12`.
- The edit-time mechanism and why no push-time gate exists for merge timing: `:34`
  to `:36` (`§3`), delivered by `.claude/hooks/inject-matching-rule.sh`.
- The promotion record — both anti-patterns, their channels, and the errors-not-
  warnings rationale: `:41` to `:48`; the not-yet-fired preflight promotion at `:40`.
- The symlink trap (§5.2) and its measured incident commit: `:59` to `:69`; the
  commit it names is `9e046c6d55` — carried from the rule file; the object is
  not present in this branch's store.
- The naming trap (§5.3), the near-miss account, and the counter: `:71` to `:79`.
- The regex quoted above: `packages/core/principles/kickoff-population.ts:34`.
- The companion test and its arms:
  `packages/core/principles/44-kickoff-authoring-traps.test.ts:90` (suite),
  `:91` (the symlink arm, with an anti-tautology assertion at `:111`), `:128`
  (the naming arm).
- The pre-commit gate section and the edit-time hook arm for the same two traps:
  `.husky/pre-commit` and `.claude/hooks/check-kickoff-traps.sh` (arm 3).
- The index row grading this rule class `A` with channels `paths:(1), edit-time
  inject`: `.claude/rules/00-rule-index.md:26`.
