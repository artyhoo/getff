---
title: ai-laziness-digest rule
description: The rule that keeps a one-line counter for every laziness trap resident in every session, so the counters cannot silently drift away from the catalogue they compress.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .agents/rules/ai-laziness-digest.md
  - .agents/rules/ai-laziness-traps.md
  - .agents/rules/00-rule-index.md
  - packages/core/principles/12-ai-laziness-traps.test.ts
  - packages/core/principles/35-ai-laziness-digest-anti-drift.test.ts
  - docs/site/reference/F1.json
  - docs/site/reference/F1.md
  - docs/site/reference/F1/ai-laziness-traps.md
  - docs/site/terms.md
executed:
  - { example: counters-match-catalogue, stack: repo, date: 2026-10-07, result: 22-and-22 }
---

# ai-laziness-digest rule

## Fact card

What each row means: [how to read a rule page](../F1.md#how-to-read-a-rule-page).

<!-- vale off -->
<!-- vale-reason: the card quotes the rule file's own header text verbatim, in the rule file's voice rather than this site's -->

<!-- getff:begin section=F1-card-ai-laziness-digest plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `ai-laziness-digest` |
| kind | rule |
| ships-to | framework |
| description | the resident hot digest — every §2 T-number + its one-line counter (exact-prefix quotes from the catalogue). |
| source | `.agents/rules/ai-laziness-digest.md:5` |
| class | A |
| fires | any R-phase, audit, sample-based investigation, or open-ended AI task. |
| channels | always-on core |
<!-- getff:end section=F1-card-ai-laziness-digest -->

<!-- vale on -->

## Explanation

The parent [rule](../../terms.md#rule) [ai-laziness-traps](ai-laziness-traps.md) keeps
a catalogue of 22 named traps — each one a way an AI agent under pressure produces the
shape of work without the work. The catalogue is long on purpose: every entry carries a
trigger, a tempted output, and a countermeasure. Long is also the problem. A session that
loads the whole catalogue every turn pays for it every turn, and a session that never
loads it applies nothing.

This rule is the compromise. It keeps exactly one line per trap — the counter — and
delivers those 22 lines to every session at start. That is the `always-on core`
[channel](../../terms.md#channel): the one breadth level this project reserves for the
few invariants that must be in front of the agent all the time. The parent catalogue
stays on demand; the counters are always resident.

Resident text rots quietly: a catalogue entry gets reworded, the resident one-liner
keeps the old words, and after a few months they disagree. So the class here is `A` —
an executable test ships with the rule. It reads both files and requires each counter
to be a contiguous verbatim quote of its catalogue entry, at least 60 characters of it,
with the whole digest capped at 8 KB. If the catalogue grows a twenty-third trap and
the digest does not grow the matching line, the test fails. If a counter drifts even a
few characters from its source entry, the test fails.

Here is the pairing the test guards, counted live in the getff repository:

```bash
grep -c "^### T" .claude/rules/ai-laziness-traps.md
grep -c "^- \*\*T" .claude/rules/ai-laziness-digest.md
```

```text
22
22
```

What the rule does not do: the counters are memory anchors, not the discipline. The
full entry — trigger, tempted output, countermeasure — still lives only in the parent
catalogue, and following a counter at the moment of work is judgment no test can make.
The digest also does not police whether an agent obeyed anything; it guarantees the
one-liners cannot silently stop matching what the catalogue actually says.

## Evidence

Checked 2026-10-07 against the working tree this batch was written in; citations, counts and captured outputs re-verified 2026-10-10 against the merge-forward tree. Pins re-verified 2026-10-12 at the universal-integration branch head: the range's rule/test/workflow edits (including the in-body citation renumber) shifted no pin cited on this page — every pin was re-read at the current base and still shows the quoted content.

- The digest carries counters T1 through T22 as exact-prefix quotes:
  `.claude/rules/ai-laziness-digest.md:12` (T1) and
  `.claude/rules/ai-laziness-digest.md:33` (T22).
- The catalogue carries the matching 22 entries — the two `grep -c` commands above
  return 22 and 22.
- The anti-drift gate is a shipped test:
  `packages/core/principles/35-ai-laziness-digest-anti-drift.test.ts:35` sets the
  60-character minimum quote, `:38` the 8192-byte digest cap, and `:93` the
  length floor it enforces per line.
- The parent rule's own gate (principle 12) checks that every kickoff cites the
  catalogue and enumerates which traps apply:
  `packages/core/principles/12-ai-laziness-traps.test.ts:120`.
- The index row that grades this rule class `A` with the `always-on core` channel:
  `.claude/rules/00-rule-index.md:10`.
