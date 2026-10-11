---
title: Check your framework rules
description: Find the rule that governs your change in the framework repo, read what its class and channels actually promise, and run the check that backs it.
kind: guide
sources:
  - .agents/rules/00-rule-index.md
  - .agents/rules/seat-lifecycle.md
  - .agents/rules/doc-authority-hierarchy.md
  - .agents/rules/rule-enforcement-channel-selection.md
  - scripts/render-rule-index.mjs
  - AGENTS.md
  - packages/core/skills/seat-lifecycle-pointer.test.ts
  - docs/site/reference/F1.json
  - docs/site/reference/F1.md
  - docs/site/terms.md
executed:
  - { example: locate-rule-row, stack: repo, date: 2026-10-11, result: index-row-36 }
  - { example: class-and-fires-lines, stack: repo, date: 2026-10-11, result: class-b-pointer-mechanism }
  - { example: rule-index-check, stack: repo, date: 2026-10-11, result: exit-0-up-to-date }
  - { example: pointer-promise, stack: repo, date: 2026-10-11, result: regex-line-20-count-1 }
---

# Check your framework rules

The getff framework is developed under its own rules: about forty documents in
`.claude/rules/` that declare when they apply and how they are enforced. Those
declarations are checkable claims, not decoration — a rule that says a test
exists is saying something you can run. This guide walks one rule from the index
to its enforcement, inside a clone of the framework repository. The rules are
part of the framework's own development loop; they are not installed into your
project, and nothing here asks them to be.

Each [rule](../terms.md#rule) declares two things worth checking before you
trust the prose. The class letter says what enforces it: `A` for a test in
`packages/core/principles/`, `B` for a named mechanism that ships without a
dedicated test, `C` for prose that only records the trigger which would build
one. The channels say where it fires: a `paths:(N)` count for edits under named
paths, `edit-time inject` for a reminder delivered as you edit, `hook` or
`always-on core` for the rest. A Class C rule's text is a promise about future
enforcement — it is not a [gate](../terms.md#gate) that exists today.

## Prerequisites

- A clone of the getff repository with dependencies installed (`npm install`
  once from the repo root).
- Node.js. The commands use `grep` and `npx tsx`; nothing else.
- No project gets modified. Every path in this guide lives inside the clone.

## Steps

1. Find the rule. The rules folder has a generated index with one row per rule,
   already carrying the class and the channels:

   ```bash
   grep -n "seat-lifecycle" .claude/rules/00-rule-index.md
   ```

   ```text
   36:| `seat-lifecycle.md` | B | seat birth, self-cleaning handoff, or retirement in a seat session. | paths:(8) |
   ```

   The row names the file and gives you both facts: class `B`, one
   [channel](../terms.md#channel) — a path scope of eight entries.

2. Read the rule's own header. Open `.claude/rules/seat-lifecycle.md` and read
   the blockquote at the top. The class line and the fires line are the
   operative ones:

   ```bash
   grep -m1 "^> \*\*Class:\*\*" .claude/rules/seat-lifecycle.md
   grep -m1 "^> \*\*Fires:\*\*" .claude/rules/seat-lifecycle.md
   ```

   ```text
   > **Class:** B — the compensating mechanism ships in the same PR: the all-four-carry-the-pointer …
   > **Fires:** seat birth, self-cleaning handoff, or retirement in a seat session.
   ```

   The class line runs long; the front of it is shown. `B` here means no
   dedicated test, but a named mechanism — whatever the sentence after the dash
   points at. The header continues with **Authoritative for**, the scope the
   rule claims, and **NOT authoritative for**, the scope it explicitly does not.

3. Run the check the whole folder owes you. The index is generated from the rule
   files, and a checker asserts the rendering is current and every rule carries
   the required fields:

   ```bash
   npx tsx scripts/render-rule-index.mjs --check
   ```

   ```text
   ✓ rule-index up-to-date (00-rule-index.md + AGENTS.md region)
   ```

   The command exits 0. Editing a rule's header without regenerating the index
   turns this check red on the next run.

4. Check the class promise against the tree. Seat-lifecycle's class-B mechanism
   is a pointer check: the four seat skills must each link to the rule. Two
   greps confirm the promise is real — the test that enforces it, and one skill
   carrying its pointer:

   ```bash
   grep -n "POINTER" packages/core/skills/seat-lifecycle-pointer.test.ts | head -1
   grep -c "seat-lifecycle" .claude/skills/pipeline/SKILL.md
   ```

   ```text
   20:const POINTER = /rules\/seat-lifecycle\.md/;
   1
   ```

   For a class `A` rule, this step is instead the rule's own suite in
   `packages/core/principles/`, run with `npx vitest run <file>` once
   dependencies are installed. For a class `C` rule there is no step to run:
   the honest check is reading the promotion criterion in the rule and
   confirming nothing in the tree claims the [gate](../terms.md#gate) exists.

## Verify

The index check is green on a healthy tree, and it is the check to re-run after
any rule edit. The regenerator is its pair:
`npx tsx scripts/render-rule-index.mjs --write` refreshes the index and the
mirrored region of `AGENTS.md`; re-run the check and it must return to green:

```bash
npx tsx scripts/render-rule-index.mjs --check
```

```text
✓ rule-index up-to-date (00-rule-index.md + AGENTS.md region)
```

Then read the rule's page in the [rules reference](../reference/F1.md) — each
sheet quotes the rule's source with file and line anchors. Diff what the page
claims against the header you just read; when they disagree, the rule file wins,
and the page is the thing to report.

## Variations

- **You edited a rule and the check went red.** That is the check working. Run
  the regenerator named in Verify and commit the regenerated index with your
  rule change, so the next reader's `--check` is green too.
- **The rule you need is class `C` and you want enforcement anyway.** The rule
  records the trigger that promotes it — usually documented incidents, counted
  in its promotion section. Record the incident rather than building a side
  [gate](../terms.md#gate); an ungated rule with a recorded trigger is the
  designed state.
- **You want the readable version first.** All thirty rules have pages under
  [F1](../reference/F1.md), each with a fact card —
  [how to read a rule page](../reference/F1.md#how-to-read-a-rule-page)
  explains the rows before you go to the source.
