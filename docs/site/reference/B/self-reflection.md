---
title: self-reflection skill
description: What the self-reflection skill is, why you will not find it in your project, and what to borrow from it if you write rules of your own.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .claude/skills/self-reflection/SKILL.md
  - .claude/skills/self-reflection/references/forward-checklist.md
  - .claude/skills/self-reflection/references/backward-checklist.md
  - .claude/skills/self-reflection/references/anti-patterns-with-examples.md
  - CLAUDE.md
  - docs/meta-factory/EXECUTION-PLAN.md
  - docs/meta-factory/prior-art-evaluations.md
  - .github/workflows/discipline-self-check.yml
  - setup.d/10-skills.sh
  - setup.d/lib.sh
  - packages/core/principles/15-skill-paired-negative.test.ts
  - docs/site/reference/B.json
  - docs/site/reference/B.md
  - docs/site/terms.md
docs-refresh: deferred — re-verified 2026-09-22, the cited register gained rows 284-287 and a dated note on row 283, and CLAUDE.md gained one skill-routing line for domain-modeling; counts are renderer-owned and no prose here depends on either; clears at the next gold refresh of this page
executed:
  - { example: list-framework-skill, stack: repo, date: 2026-09-21, result: listed }
---

# self-reflection skill

## Fact card

What each row means: [how to read a fact card](../B.md#how-to-read-a-fact-card).

<!-- vale off -->
<!-- vale-reason: the description row is the skill's own frontmatter, quoted verbatim, including its Russian wake words and internal paths -->

<!-- getff:begin section=B-card-self-reflection plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `self-reflection` |
| kind | skill |
| ships-to | no lane (no-lane) |
| description | Use when introducing or extending a rule, principle, pattern, methodology, discipline, or process change in this repository. Auto-trigger on «правило», «принцип», «дисциплина», «методология», «процесс», recommend, introduce rule, new principle, discipline change, process rule, meta, recursive, applies to itself, check own work, self-review, forward check, backward check, closing recommendation, discipline-bearing artefact, self-reflection, anti-pattern, or any edit touching `.claude/rules/`, `packages/core/principles/`, `docs/meta-factory/EXECUTION-PLAN.md`, `docs/meta-factory/prior-art-evaluations.md`, `CLAUDE.md`. Do NOT trigger on simple typo fixes, code edits without rule changes, or routine PR work. |
| source | `.claude/skills/self-reflection/SKILL.md:3` |
| invocation | auto |
| posture | portable |
| operator-twin | .claude/skills/self-reflection/SKILL.md |
<!-- getff:end section=B-card-self-reflection -->

<!-- vale on -->

## Explanation

You will not find this [skill](../../terms.md#skill) in your project. getff uses it on
itself and never installs it, at any [depth](../../terms.md#depth). It has a page here
because it appears in the [skills table](../B.md), and because the habit it teaches is
worth borrowing if you write [rules](../../terms.md#rule) of your own.

The habit is this. An agent that proposes a new rule thinks hard about the rule and
forgets that the proposal must follow the rules that already exist. The skill lists
three times this happened in the getff repository. In one, a planning document quietly
redefined the project goal it was written to protect.

So before the agent closes any proposal for a new rule or process change, the skill
makes it answer two questions in writing:

- **Forward check.** Does the proposal obey every rule that is already in force?
- **Backward check.** Which existing files fall under the new rule? List all of them,
  not a sample. Each one either complies or gets a named exemption.

The agent picks the skill up by itself. Its description wakes it on words like "rule",
"principle", and "process change", and on any edit to the getff rule files. The skill
tells the agent to stay quiet for typo fixes, test data, and routine refactors.

For this skill the card's `ships-to: no lane` is simply true. The installer's comments
call it specific to getff's own development, and it is in none of the install lists.

Inside are one main file and three longer checklists that the agent opens only when
needed. This listing is from the getff repository itself:

```bash
ls .claude/skills/self-reflection .claude/skills/self-reflection/references
```

```text
.claude/skills/self-reflection:
SKILL.md
references

.claude/skills/self-reflection/references:
anti-patterns-with-examples.md
backward-checklist.md
forward-checklist.md
```

In the getff repository the two written answers are not optional. A CI job reads the
pull request description and goes [red](../../terms.md#red-and-green) when either
section is missing, shorter than 40 characters, or has no `file:line` citation. That job
is the [gate](../../terms.md#gate). The skill is how the agent learns the expected shape
before the gate [fires](../../terms.md#fire).

What the skill does not do for you: nothing arrives in your project, and the CI job is
not installed either. The checklists name getff's own files and numbered rules, so they
will not work as written anywhere else. If you want the habit, copy the two questions
into your own pull request template. The skill also has no "with and without" sections.
The test that demands them lists it as an exception.

## Evidence

- The description is line 3 of `.claude/skills/self-reflection/SKILL.md`. The posture
  marker is line 6. The three incidents are lines 17 to 19. The "do not use when" list
  is lines 36 to 41.
- The two required sections and their minimums are lines 45 to 63 of the same file.
- The CI job is `.github/workflows/discipline-self-check.yml`. Line 102 matches the
  forward-check heading and line 115 is the error for a section under 40 characters.
- The decision not to install the skill is lines 132 to 135 of `setup.d/10-skills.sh`.
  The three install lists are lines 63 to 65 of `setup.d/lib.sh`, and the name is in
  none of them.
- The exception list that names this skill is line 36 of
  `packages/core/principles/15-skill-paired-negative.test.ts`.
- The card above is built from the `self-reflection` entry in
  `docs/site/reference/B.json`, which starts at line 324.
