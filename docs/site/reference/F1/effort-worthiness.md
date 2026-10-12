---
title: effort-worthiness rule
description: The rule that flips the burden of proof onto more process — extra rounds, probes and budgets must argue what they buy, because rigour spent where nothing breaks is cost with no goal progress.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .agents/rules/effort-worthiness.md
  - .agents/rules/00-rule-index.md
  - packages/core/hooks/checks/pr-body-fidelity.ts
  - .agents/rules/reviewer-discipline.md
  - packages/core/principles/31-rule-channel-declaration.ts
  - docs/site/reference/F1.json
  - docs/site/reference/F1.md
  - docs/site/terms.md
executed:
  - { example: failure-scenario-regex, stack: repo, date: 2026-10-07, result: re-at-92 }
docs-refresh: deferred — re-verified 2026-10-12: the cited reviewer-discipline rule changed only one citation renumber forced by lines added above it; no budget or convergence-cap claim this sheet maps changed; clears at the next gold refresh of this page
---

# effort-worthiness rule

## Fact card

What each row means: [how to read a rule page](../F1.md#how-to-read-a-rule-page).

<!-- vale off -->
<!-- vale-reason: the card quotes the rule file's own header text verbatim, in the rule file's voice rather than this site's -->

<!-- the card below is generated verbatim from the rule registry; its description is
     truncated mid-sentence at source — the continuation is summarised in the Explanation -->

<!-- getff:begin section=F1-card-effort-worthiness plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `effort-worthiness` |
| kind | rule |
| ships-to | framework |
| description | the effort-worthiness discipline — §1 the rule + four-test card, |
| source | `.agents/rules/effort-worthiness.md:10` |
| class | C |
| fires | any effort/rigor fork: probe demand, extra round, budget breach. |
| channels | skill-embed(4) |
<!-- getff:end section=F1-card-effort-worthiness -->

<!-- vale on -->

## Explanation

Most process rules push towards more rigour: add a gate, run another audit,
demand another probe. This [rule](../../terms.md#rule) pushes the other way.
Its default is practice-first: the burden of proof sits on *more* process, and
anyone demanding an extra round has to say what breaks if it is skipped and
what the learning-in-practice would have cost. Reversibility, not importance,
sets the weight — cheap-to-undo work gets light process even when it matters,
because a mistake can be reverted faster than a committee can meet.

The rule compresses the test into four questions, and grades its demands by
layer: a one-line fix does not owe the same argument a shipped gate owes. The
bulk of the file is a six-layer loop that turns the philosophy into concrete
instruments, and one of those instruments is mechanical. A review finding that
triggers a rework round must carry a `Failure-scenario:` line — the concrete
input that flips the behaviour — and a deterministic check enforces that on
opened findings:

```bash
grep -n "FAILURE_SCENARIO_RE" packages/core/hooks/checks/pr-body-fidelity.ts | head -3
```

```text
92:const FAILURE_SCENARIO_RE = /Failure-scenario:/;
173:      let has = FAILURE_SCENARIO_RE.test(ls[i]);
176:        has = FAILURE_SCENARIO_RE.test(ls[j]);
```

The regex at `:92` is the gate's detection; the hits at `:173` and `:176`
are the `test()` sites that scan a graded finding and its continuation
lines for the marker. The gate's honest scope is stated by the arm comment
at `packages/core/hooks/checks/pr-body-fidelity.ts:161` — the deterministic
half checks presence, not quality. A finding can satisfy the regex with a
vague scenario; judging that is review work, not regex work.

The `class` row is `C` and the channels row says `skill-embed(4)`: the rule is
carried into four files as embedded summaries, so an agent meets the
discipline at the moment it decides how much process to spend. The honest
state of those four carriers at this base: the reviewer-discipline carrier is
live — that file embeds the four-test card and states the rule's severity
config — while the three skill files the other markers name carry no
effort-worthiness embed at all. The companion channel-marker check passes a
rule on any one live marker and reports the rest as diagnostics, so the rule
reads green with three stale markers. This page records that state rather
than smoothing it over; tidying the stale markers is maintenance outside this
documentation batch.

One more honest note, on the card above: its `description` row ends
mid-sentence because the generated rule registry's one-line summary for this
rule is truncated at source — the same extraction defect documented on the
[family overview](../F1.md). The card is byte-for-byte what the generator
produces; the truncated sentence's actual continuation is the six-layer loop
and the layers' anti-patterns, summarised on this page instead.

What the rule does not do: nothing checks whether the four questions were
answered honestly — that is judgment, and the rule says so. Its budget layer
deliberately never auto-cancels: a breached budget forces an explicit ask to
the advisor or concept holder, never a silent push-through and never a
guillotine.

## Evidence

Checked 2026-10-07 against the working tree this batch was written in; citations, counts and captured outputs re-verified 2026-10-10 against the merge-forward tree.

- The rule text: `.claude/rules/effort-worthiness.md` — four skill-embed
  channel markers at `:3` to `:6`, class `C` at `:8`, the fires line at `:9`,
  and the 2026-08-10 origin (a review-effort audit finding ~34% of
  finding-list length was padding) at `:17`.
- The practice-first default and the burden of proof: `:25` (§1); the
  four-test card at `:36` to `:39`; the materiality-by-layer table at `:41`.
- The six-layer loop: §2 at `:50` — the L0 rigour label, the L1 four-test
  card, L2 precedent *recording* (not reliance), L3's mechanical skeleton,
  L4's budget-forces-an-ASK semantic, and L5's advisor judge.
- The shipped L3 half: `packages/core/hooks/checks/pr-body-fidelity.ts` —
  the requirement comment at `:36`, the regex at `:92`, and the
  severity-contract arm at `:161` to `:176` (empty or absent fails; numbered
  and table-shaped findings are exempted, per the nuance at `:69` to `:80`).
- The live carrier: `.claude/rules/reviewer-discipline.md:63` to `:64` (the
  embed and the four-test card pointer), with the L4 numbers config at `:103`
  and the rounds-only note at `:113`. The three stale markers name
  `.claude/skills/dispatcher/SKILL.md`, `.claude/skills/night-mode/SKILL.md`
  and `.claude/skills/arch/SKILL.md` — none contains the string.
- The companion channel-marker check's pass-on-any-live semantics:
  `packages/core/principles/31-rule-channel-declaration.ts` — a marker counts
  when its artifact exists and contains the anchor string; non-live markers
  become diagnostic reasons, and one live marker passes the rule.
- The index row grading this rule class `C` with channels `skill-embed(4)`:
  `.claude/rules/00-rule-index.md:22`.
