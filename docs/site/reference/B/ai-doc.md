---
title: ai-doc skill
description: The skill that makes your AI agent ask where a new convention should be enforced before it writes another always-loaded instruction file.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .claude/skills/ai-doc/SKILL.md
  - .claude/skills/ai-doc/anthropic-and-aif-residue.md
  - .claude/rules/rule-enforcement-channel-selection.md
  - .claude/rules/doc-authority-hierarchy.md
  - setup.d/10-skills.sh
  - setup.d/lib.sh
  - setup.d/45-python.sh
  - docs/site/reference/B.json
  - docs/site/reference/B.md
  - docs/site/terms.md
  - packages/core/principles/15-skill-paired-negative.test.ts
  - tests/install-sh/baselines/ts-server/greenfield.fingerprint
  - tests/install-sh/baselines/python/greenfield.fingerprint
executed:
  - { example: list-installed-ai-doc, stack: ts-server, date: 2026-09-21, result: listed }
docs-refresh: deferred — re-verified 2026-09-21, only the hash values on lines 7 and 162 of the cited install fingerprint changed (pre-push.ts and refresh-baseline.json); every line and path this page cites is unchanged; clears at the next gold refresh of this page
---

# ai-doc skill

## Fact card

What each row means: [how to read a fact card](../B.md#how-to-read-a-fact-card).

<!-- vale off -->
<!-- vale-reason: the description row is the skill's own frontmatter, quoted verbatim, including its Russian trigger words -->

<!-- getff:begin section=B-card-ai-doc plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `ai-doc` |
| kind | skill |
| ships-to | core: react-native, react-next, react-spa, ts-server |
| description | Use when creating or fixing an AI-facing doc/rule/skill/agent in this repo (SKILL.md, .claude/rules/*, agents/*, CLAUDE.md, AGENTS.md) — to apply the project's context-hygiene + rule-as-test + AI-agnostic authoring standard. Triggers: write a rule, author a skill, fix a doc, doc-authority header, progressive disclosure, channel selection, документация, правило, скилл. |
| source | `.claude/skills/ai-doc/SKILL.md:3` |
| invocation | auto |
| posture | portable |
| operator-twin | .claude/skills/ai-doc/SKILL.md |
<!-- getff:end section=B-card-ai-doc -->

<!-- vale on -->

## Explanation

This is one of the [skills](../B.md) getff installs. You get it for the day you write
instructions for your own agent: a new [skill](../../terms.md#skill) or a rule file.
Left alone, an agent puts every new instruction into a file that loads in every session.
The skill file says so itself, in its "Without this skill" section. This skill makes the
agent ask a better question first: can a script catch the mistake instead?

The agent picks the skill up by itself when you say "write a rule" or "author a skill".
You do not type a command.

Inside, the skill is short on purpose. It calls itself a thin wrapper. The writing method
itself belongs to another skill, `superpowers:writing-skills`, which comes from the
separate superpowers plugin. What `ai-doc` adds is four judgment calls:

- **Pick the [channel](../../terms.md#channel) first.** If a script can detect the
  mistake, build a [gate](../../terms.md#gate). If not, show the text only when the agent
  edits the matching files. Keep the always-loaded set to three or four items.
- **A [rule](../../terms.md#rule) is a test.** The check is code. The prose about it is
  loaded on demand.
- **Work with any agent.** Use a plain marker comment for file patterns, so the file still
  makes sense outside Claude Code.
- **Say what the document owns.** Every main document opens with a short header that
  names what it is the authority for, and what it is not.

A second file, `anthropic-and-aif-residue.md`, is opened only when needed. It holds a
table for grading how strongly a rule is enforced, and tips for skill descriptions.

To see what landed in your project, list the folder:

```bash
ls .claude/skills/ai-doc
```

```text
SKILL.md
anthropic-and-aif-residue.md
```

What the skill does not do: it enforces nothing. It is part of the
[soft layer](../../terms.md#soft-layer-and-hard-layer), so the agent may read it and
still write a wall of prose. It was written for the getff repository first, and its
description still says "in this repo". Two of its four points name rule files,
`rule-enforcement-channel-selection.md` and `doc-authority-hierarchy.md`. Those files
live in the getff repository. The project used for the example above has no
`.claude/rules` folder, so your agent gets only the one-line summary in the skill. The
skill is also absent on the `python` [lane](../../terms.md#lane), which gets four skills.

## Evidence

- The description and the invocation mode come from line 3 of
  `.claude/skills/ai-doc/SKILL.md`. The posture marker is line 6. The four judgment calls
  are lines 25 to 28. The "Without this skill" text is line 32. The grading table is
  lines 17 to 21 of `.claude/skills/ai-doc/anthropic-and-aif-residue.md`.
- The skill is in the always-installed list, `GETFF_SKILLS_CORE`, on line 61 of
  `setup.d/lib.sh`. Lines 136 to 138 of `setup.d/10-skills.sh` copy that list. Lines 61
  to 63 there say why it ships to you.
- The `python` lane copies four skills by name, and `ai-doc` is not one of them:
  `setup.d/45-python.sh`, lines 1226 to 1232.
- `ships-to` is measured: `tests/install-sh/baselines/ts-server/greenfield.fingerprint`
  lists the skill's two files, `tests/install-sh/baselines/python/greenfield.fingerprint` none.
- The two rule files it names: `.claude/rules/rule-enforcement-channel-selection.md` and
  `.claude/rules/doc-authority-hierarchy.md`.
- The card is built from `docs/site/reference/B.json`. The "with and without" sections
  are required by `packages/core/principles/15-skill-paired-negative.test.ts`.
