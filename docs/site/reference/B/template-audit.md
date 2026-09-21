---
title: template-audit skill
description: A short checklist your AI agent can use to judge whether the agent instructions getff generated for you still say that every rule is a test.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .claude/skills/template-audit/SKILL.md
  - AGENTS.md
  - packages/core/audit-self/template-render.audit.ts
  - packages/core/package.json
  - packages/core/principles/15-skill-paired-negative.test.ts
  - setup.d/10-skills.sh
  - setup.d/45-python.sh
  - setup.d/lib.sh
  - docs/site/reference/B.json
  - docs/site/reference/B.md
  - docs/site/terms.md
  - tests/install-sh/baselines/python/greenfield.fingerprint
executed:
  - { example: list-template-audit-and-packages-core, stack: ts-server, date: 2026-09-21, result: listed }
docs-refresh: deferred — re-verified 2026-09-21, only two hash values changed in the cited python install fingerprint (refresh-baseline.json and the tool-bootstrapping skill); every line and path this page cites is unchanged; clears at the next gold refresh of this page
---

# template-audit skill

## Fact card

What each row means: [how to read a fact card](../B.md#how-to-read-a-fact-card).

<!-- vale off -->
<!-- vale-reason: the description row is the skill's own frontmatter, quoted verbatim, and is not site prose -->

<!-- getff:begin section=B-card-template-audit plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `template-audit` |
| kind | skill |
| ships-to | core: react-native, react-next, react-spa, ts-server |
| description | Use when auditing rendered templates via local advisory review. Triggers: template, audit, render, generated docs, AGENTS.md, paraphrase, cue placement, local advisory, template-render, audit-template. |
| source | `.claude/skills/template-audit/SKILL.md:3` |
| invocation | auto |
| posture | portable |
| operator-twin | .claude/skills/template-audit/SKILL.md |
<!-- getff:end section=B-card-template-audit -->

<!-- vale on -->

## Explanation

This is one of the [skills](../B.md) getff installs. The installer writes an `AGENTS.md`
file into your project from a template, and your agent reads it. If its wording drifts
from "every [rule](../../terms.md#rule) is a test that fails" to "here are some
suggestions", your agent starts treating rules as optional. This
[skill](../../terms.md#skill) gives the agent three questions to ask about the generated
file. They cover the part that the fixed checks leave to a reader with judgment.

The agent picks the skill up by itself. The words that wake it include "template" and
"audit". Those are common words, so expect it to load more often than you need it.

Inside are two steps. Step 1 runs `npm --prefix packages/core run test:template-render`.
That test installs getff into temporary folders and runs fixed checks on the generated
files. If it fails, the skill says to stop and fix that first.

Step 2 is the three questions. The agent answers them in your current session, with no
extra API call:

- Does the generated file still say that every rule is an executable test, or has it
  softened into advice?
- Is the pointer to the session start file within the first 10 lines?
- Does the list of accepted phrasings inside the test still match the template's words?

The skill says to report the answers as advice that blocks nothing, and to open a
follow-up issue when the wording has drifted.

Now the honest part. List the skill and the folder that step 1 points at:

```bash
ls .claude/skills/template-audit packages/core
```

```text
.claude/skills/template-audit:
SKILL.md

packages/core:
eslint-rules
hooks
```

Your project's `packages/core` holds lint rules and hooks. It has no package manifest
and no test file, so step 1 cannot run in your project. The third question also needs
the test file. Both only work inside the getff repository.

What the skill does not do: it checks nothing by itself and blocks nothing. It is part of
the [soft layer](../../terms.md#soft-layer-and-hard-layer). In your project, the useful
part is the first two questions, asked about your own `AGENTS.md`. The skill is absent on
the `python` [lane](../../terms.md#lane), which receives four skills and not this one.

## Evidence

- In `.claude/skills/template-audit/SKILL.md`: the description is line 3, the step 1
  command is line 20, the questions are lines 29 to 34, and "not blocking" is line 36.
- The `test:template-render` script is line 63 of `packages/core/package.json`. The test
  is `packages/core/audit-self/template-render.audit.ts`. Lines 4 to 11 of that file say
  which checks run in CI and which three are left to this skill.
- The skill is in `GETFF_SKILLS_CORE`, line 63 of `setup.d/lib.sh`, copied by lines 143
  to 145 of `setup.d/10-skills.sh`. Line 67 there says what it is for.
- The `python` lane copies four skills by name, lines 1229 to 1235 of
  `setup.d/45-python.sh`, and this skill is missing from
  `tests/install-sh/baselines/python/greenfield.fingerprint`.
- The card is built from `docs/site/reference/B.json`. Line 37 of
  `packages/core/principles/15-skill-paired-negative.test.ts` exempts this skill from
  the "with and without" sections.
