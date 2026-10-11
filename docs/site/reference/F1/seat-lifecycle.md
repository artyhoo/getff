---
title: seat-lifecycle rule
description: The protocol that gives long-lived agent seats one lifecycle — birth in an isolated worktree, work, a self-cleaning handoff, retirement with nothing load-bearing left in memory — as one source of truth the seat skills point at.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .agents/rules/seat-lifecycle.md
  - .agents/rules/00-rule-index.md
  - packages/core/skills/seat-lifecycle-pointer.test.ts
  - .claude/hooks/end-of-turn-reminder.sh
  - .claude/skills/arch/SKILL.md
  - .claude/skills/pipeline/SKILL.md
  - .claude/skills/dispatcher/SKILL.md
  - .claude/skills/night-mode/SKILL.md
  - docs/site/reference/F1.json
  - docs/site/reference/F1.md
  - docs/site/terms.md
executed:
  - { example: pointer-check, stack: repo, date: 2026-10-11, result: four-skills-one-pointer-each }
---

# seat-lifecycle rule

## Fact card

What each row means: [how to read a rule page](../F1.md#how-to-read-a-rule-page).

<!-- vale off -->
<!-- vale-reason: the card quotes the rule file's own header text verbatim, in the rule file's voice rather than this site's -->

<!-- getff:begin section=F1-card-seat-lifecycle plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `seat-lifecycle` |
| kind | rule |
| ships-to | framework |
| description | the lifecycle SEQUENCE — §1 the four phases, which settled |
| source | `.agents/rules/seat-lifecycle.md:22` |
| class | B |
| fires | seat birth, self-cleaning handoff, or retirement in a seat session. |
| channels | paths:(8) |
<!-- getff:end section=F1-card-seat-lifecycle -->

<!-- vale on -->

## Explanation

A long-running agent session — a "seat" — is born, works, hands off, and retires.
Before this [rule](../../terms.md#rule), each of the four seat skills carried its
own divergent (or missing) version of that cycle: the parallel-evolution problem
where four copies of one protocol drift four ways. The fix is structural: one
source of truth that sequences the lifecycle, and pointer blocks in the skills that
add nothing of their own. The rule is explicit about the boundary — it sequences,
it never re-describes; every mechanism in its four phases is owned by another
document, and growing a fifth description of a loop an owner already carries is the
rule's first-named anti-pattern.

The population is pinned precisely: exactly three registry roles (arch, pipeline,
dispatcher) have seat lifecycles; night is a mode existing seats enter, never a
fourth role. The four phases each reuse a settled mechanism — birth verifies an
isolated worktree (a repo-root session is ineligible as a seat), self-cleaning
breaks at stage boundaries and never mid-harvest, retirement leaves nothing
load-bearing in working memory. Steps that depend on unbuilt machinery are labelled
inert rather than improvised.

The handoff shape is the section most seats feel daily: keep the handoff document a
thin index — a table of "task in front of you → open only this file" pointers, with
state living in per-topic files that each open with a "Read when:" line. A
Stop-hook arm enforces the shape mechanically: an in-band handoff file with no table
row naming a topic file, or one over an eighty-line cap, blocks ending the turn,
with an escape token for genuine exceptions. The judgment half — whether the topic
files' "Read when:" lines are honest — is stated as not machine-checked, because a
partial resolve would read as a guarantee.

The `class` row is `B`: the compensating mechanism is a pointer check asserting
every skill the rule scopes actually links here — the link, not the lifecycle, is
what a deterministic check can own:

```bash
grep -n "POINTER" packages/core/skills/seat-lifecycle-pointer.test.ts | head -2
grep -c "seat-lifecycle" .claude/skills/arch/SKILL.md .claude/skills/pipeline/SKILL.md .claude/skills/dispatcher/SKILL.md .claude/skills/night-mode/SKILL.md
```

```text
20:const POINTER = /rules\/seat-lifecycle\.md/;
.claude/skills/dispatcher/SKILL.md:1
.claude/skills/arch/SKILL.md:1
.claude/skills/night-mode/SKILL.md:1
.claude/skills/pipeline/SKILL.md:1
```

Four skills, one pointer each — the all-carry-the-pointer invariant, green.

What the rule does not do: it cannot detect a lifecycle phase being skipped — the
pointer test checks that skills point at the protocol, not that seats follow it;
behavior promotion waits on two documented incidents. And the deliberately inert
steps stay inert until their dependency probes land, which the rule records as the
honest state rather than a gap.

## Evidence

Checked 2026-10-11 against the working tree this batch was written in.

- The Class-B header naming the pointer test and the read-time-only channel:
  `.claude/rules/seat-lifecycle.md:16` to `:20`.
- The origin (autonomous-night v3 design; the artifact-first handoff lineage):
  `:36` to `:41`.
- `§1` the four phases and the population pin: `:43` to `:74` — roles at `:45` to
  `:51`, birth at `:53`, work at `:59`, self-cleaning at `:61`, retirement at `:69`.
- `§1.1` the thin-index handoff, the D40 Stop-hook arm, the 80-line cap and its
  escape token, and the not-machine-checked half: `:76` to `:93` (the gate at
  `:86` to `:89`, the judgment half at `:90` to `:92`).
- `§2` the four anti-patterns, led by the fifth-description: `:95` to `:107`.
- `§3` promotion (≥2 incidents) and retirement: `:109` to `:115`.
- The pointer test quoted above:
  `packages/core/skills/seat-lifecycle-pointer.test.ts:20`, `:22`; the four skill
  files the grep reads: `.claude/skills/arch/SKILL.md`,
  `.claude/skills/pipeline/SKILL.md`, `.claude/skills/dispatcher/SKILL.md`,
  `.claude/skills/night-mode/SKILL.md` (one pointer each).
- The Stop-hook arm `§1.1` binds: `.claude/hooks/end-of-turn-reminder.sh`.
- The scope markers: `:3` to `:12` (`paths:` frontmatter, eight entries — the four
  skills under both delivery roots).
- The index row grading this rule class `B` with channel `paths:(8)`:
  `.claude/rules/00-rule-index.md:36`.
