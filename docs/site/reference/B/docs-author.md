---
title: docs-author skill
description: What the docs-author skill is, why it never lands in your project, and how it keeps the pages of this site consistent.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .claude/skills/docs-author/SKILL.md
  - .claude/skills/docs-author/references/page-kinds.md
  - .claude/skills/docs-author/references/criteria-card.md
  - .claude/skills/docs-author/references/craft.md
  - .claude/skills/docs-author/references/terms.md
  - scripts/docs-check.mjs
  - setup.d/10-skills.sh
  - setup.d/lib.sh
  - docs/site/reference/B/getff.md
  - docs/site/reference/B.json
  - docs/site/reference/B.md
  - docs/site/terms.md
executed:
  - { example: check-one-page, stack: repo, date: 2026-09-21, result: pass }
---

# docs-author skill

## Fact card

What each row means: [how to read a fact card](../B.md#how-to-read-a-fact-card).

<!-- vale off -->
<!-- vale-reason: the description row is the skill's own frontmatter, quoted verbatim, including its Russian wake words and internal terms -->

<!-- getff:begin section=B-card-docs-author plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `docs-author` |
| kind | skill |
| ships-to | no lane (no-lane) |
| description | Use when writing or editing any getff.ai docs page under docs/site/ (including the glossary terms.md), when picking a page kind or filling the reader-comfort card, or when running a docs refresh over touched pages — to apply the kind registry, the craft contract, and the docs-check done-checklist. Triggers: write a docs page, new page under docs/site, glossary entry, terms.md, docs refresh, gold page, Diátaxis, задокументировать, страница документации. |
| source | `.claude/skills/docs-author/SKILL.md:3` |
| invocation | auto |
| posture | portable |
| operator-twin | .claude/skills/docs-author/SKILL.md |
<!-- getff:end section=B-card-docs-author -->

<!-- vale on -->

## Explanation

You will not find this [skill](../../terms.md#skill) in your project. It is the skill
the getff team's agents load when they write the site you are reading, this page
included. getff never installs it, at any [depth](../../terms.md#depth). It has a page
because it appears in the [skills table](../B.md). It also explains why every page here
has the same shape, which helps you judge how far to trust one.

The problem it solves is drift. Without one fixed interface, each writer remembers the
house style a little differently, and each page coins its own word for the same idea.
The skill puts the whole contract in one place, so the writer holds it from the first
line instead of meeting it as a surprise at commit time.

The agent picks the skill up by itself. Its description wakes it when someone writes or
edits a page under `docs/site/`, adds a glossary entry, or refreshes pages after a
change. For this skill the card's `ships-to: no lane` is simply true. It is in none of
the installer's three lists.

Inside, the skill carries five things:

| Part | What it fixes |
|---|---|
| Seven page kinds | every page declares one kind, and each kind has required sections in a set order |
| The reader card | thirteen criteria grouped under five reader questions: find, understand, do, trust, same words |
| The craft contract | why before how, second person, short sentences, real output for every example |
| The glossary duty | one glossary, `docs/site/terms.md`, and a new term goes there before a page uses it |
| The done checklist | run the examples, link the terms, run the checker, fill the card in the commit |

The skill is deliberately thin. General advice on documentation structure stays with an
outside plugin that the skill points to and never repeats. The checker in the last row
is `scripts/docs-check.mjs`. Here it runs on the
[getff skill](getff.md) page, from the getff repository itself:

```bash
node scripts/docs-check.mjs docs/site/reference/B/getff.md
```

```text
docs-check: severity lenient — pages 1, prose 0, skipped 0
  SKIP vale — vale binary absent — spelling/Names not run (lenient; set VALE_BIN)
docs-check: PASS — 0 errors, 0 suggestion(s)
```

The `SKIP` line is honest reporting. The spelling and names tool was not installed on
the machine that ran this, so that part of the check did not run.

What the skill does not do: it blocks nothing. It is part of the
[soft layer](../../terms.md#soft-layer-and-hard-layer). The [gates](../../terms.md#gate)
are the checker, a pre-push check, and CI, and they [fire](../../terms.md#fire) whether
or not the writer loaded the skill. The skill also cannot judge good writing. That is
left to a separate reviewing agent that compares its own verdict with the writer's card.
And it is no use outside the getff repository as written, because its paths point at
this site. If you want the same discipline for your docs, read its five parts as a
template.

## Evidence

- The description is line 3 of `.claude/skills/docs-author/SKILL.md`. The posture marker
  is line 6. The five parts start at lines 35, 51, 60, 73, and 80. The pointer to the
  outside plugin is lines 20 to 33.
- The page kinds and their required sections are in
  `.claude/skills/docs-author/references/page-kinds.md`. The checker holds the same
  list: `scripts/docs-check.mjs`, line 85.
- The thirteen criteria are in `.claude/skills/docs-author/references/criteria-card.md`.
  The long craft contract is `.claude/skills/docs-author/references/craft.md`.
- `.claude/skills/docs-author/references/terms.md` points to the real glossary and says
  it is not a copy.
- The installer's three lists are lines 61 to 63 of `setup.d/lib.sh`. The name
  `docs-author` is in none of them, and `setup.d/10-skills.sh` never mentions it.
- The card above is built from the `docs-author` entry in `docs/site/reference/B.json`,
  which starts at line 113.
