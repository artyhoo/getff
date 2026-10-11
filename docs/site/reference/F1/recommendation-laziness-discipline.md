---
title: recommendation-laziness-discipline rule
description: The rule that a verdict arrives with its evidence — cite the source, quote the output, state what would falsify it — and that when a zero-click dispatch path exists, an agent must not end its turn offering a button instead.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .agents/rules/recommendation-laziness-discipline.md
  - .agents/rules/00-rule-index.md
  - .claude/hooks/inject-session-bootstrap.sh
  - .claude/hooks/end-of-turn-reminder.sh
  - .claude/settings.json
  - packages/core/hooks/end-of-turn-reminder.test.ts
  - .agents/rules/ai-laziness-traps.md
  - .agents/rules/phase-research-coverage.md
  - docs/site/reference/F1.json
  - docs/site/reference/F1.md
  - docs/site/terms.md
executed:
  - { example: channel-anchor-counts, stack: repo, date: 2026-10-11, result: digest-2-chip-1 }
---

# recommendation-laziness-discipline rule

## Fact card

What each row means: [how to read a rule page](../F1.md#how-to-read-a-rule-page).

<!-- vale off -->
<!-- vale-reason: the card quotes the rule file's own header text verbatim, in the rule file's voice rather than this site's -->

<!-- getff:begin section=F1-card-recommendation-laziness-discipline plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `recommendation-laziness-discipline` |
| kind | rule |
| ships-to | framework |
| description | mechanism layer + named anti-pattern catalogue for the inline-chat verdict-without-evidence pattern, fork closure (a fork closes only on an explicit operator choice), the liability-shield pattern, the zero-click dispatch-channel order, and the human-touchpoint justification; promotion criterion in §6. |
| source | `.agents/rules/recommendation-laziness-discipline.md:8` |
| class | B |
| fires | before a verdict, an ambiguous fork, or a dispatch. |
| channels | digest, hook |
<!-- getff:end section=F1-card-recommendation-laziness-discipline -->

<!-- vale on -->

## Explanation

An agent's cheapest escape from hard work is the unbacked verdict. "Recommend
option A" costs nothing to write, sounds decisive, and — unless someone asks *what
makes you say that* — ends the discussion. This
[rule](../../terms.md#rule) makes the backing non-optional: a verdict or
recommendation must cite its source by identifier, quote the evidence that grounds
it, and state what would falsify it. An unbacked verdict is not forbidden — it is
labelled provisional, which in practice means it carries no weight. The rule also
governs the opposite laziness: hoarding a decision that is not yours. When options
are genuinely both legitimate and strategic, surface the fork with each option's
consequences and stop; when the merits clearly favor one path, say so and act.

The `class` row is `B`, and the card's two `channels` — `digest, hook` — split
neatly along the rule's two halves. The judgment half (back your verdicts) is
delivered by an always-on digest line injected at every session start, because
whether a given sentence is a verdict is a judgment no deterministic check can make;
a scan for verdict-shaped words was tried and dropped after benchmarking found its
false-positive rate unusable. The digest line's presence in the injector:

```bash
grep -c "Recommendation discipline" .claude/hooks/inject-session-bootstrap.sh
grep -c "#CHIP anchor" .claude/hooks/end-of-turn-reminder.sh
```

```text
2
1
```

The mechanizable half ships as a [gate](../../terms.md#gate) — a Stop-hook arm
anchored in the end-of-turn reminder. Its subject is a specific laziness observed
live: a session ended its round by offering a clickable "spawn next stage" chip at
the very moment an automatic dispatch path was up and healthy — trading a zero-click
dispatch for one that waits for a human. The arm reads structure only: whether this
turn invoked the spawn tool, whether the named kickoff is one the automatic
dispatcher would actually handle, and whether that file opts out via a marker line.
All conditions holding, ending the turn with the chip is an error with an escape
token, not a warning. Everything else about chips is judgment and stays with the
prose.

Both channels are counted in the grep above. The digest arm's count is two
because the matcher hits the `H1_LINE` definition and a pointer comment quoting
it; the hook anchor's count is one — and the hook arm carries paired
self-tests of its own.

What the rule does not do: it cannot stop an unbacked verdict from being *spoken* —
the digest reminds every session, and nothing audits the reminder's effect. And its
gate's scope is deliberately narrow: a chip naming no dispatchable kickoff is
untouched, left to the same human judgment the digest informs.

## Evidence

Checked 2026-10-11 against the working tree this batch was written in.

- The Class-B header and the shipped mechanizable slice:
  `.claude/rules/recommendation-laziness-discipline.md:6`.
- The rule's evidence requirements and fork-handling: `:26` to `:44` (`§3`) —
  verdict backing at `:32`, fork surfacing at `:36`, fork closure at `:38`, the
  liability shield at `:40`, the zero-click-dispatch principle at `:44`.
- Channel (A), the always-on digest arm: `:50` — delivered by
  `.claude/hooks/inject-session-bootstrap.sh`, where the digest line is defined at
  `inject-session-bootstrap.sh:92` and registered in `.claude/settings.json`
  around `:265` to `:269`.
- Channel (B), the dropped text-scan, with its measured false-positive rate:
  `:54` to `:58`.
- Channel (D), the shipped Stop-hook arm and why it is not the dropped scan
  revived: `:60`.
- The hook arm itself: `.claude/hooks/end-of-turn-reminder.sh:808` (the anchor the
  count above finds), with its conditions and escape token documented at `:810`
  to `:830`; paired self-tests at
  `packages/core/hooks/end-of-turn-reminder.test.ts`.
- The parent discipline this rule operationalises:
  `.claude/rules/phase-research-coverage.md:99` (`§1.12`), and the trap catalogue
  entry it shares DNA with: `.claude/rules/ai-laziness-traps.md` `T20`.
- The index row grading this rule class `B` with channels `digest, hook`:
  `.claude/rules/00-rule-index.md:32`.
