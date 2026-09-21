---
title: rule-tests skill
description: The skill that has your AI agent repair the test samples of a generated rule without touching the rule, and prove the repair by firing that one rule alone.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .claude/skills/rule-tests/SKILL.md
  - agents/rule-test-author.md
  - packages/core/synthesizer/run-rule-tests-firing.sh
  - install.sh
  - setup.d/10-skills.sh
  - setup.d/45-python.sh
  - setup.d/lib.sh
  - docs/site/reference/B.json
  - docs/site/reference/B.md
  - docs/site/reference/B/rule-research.md
  - docs/site/terms.md
  - packages/core/principles/15-skill-paired-negative.test.ts
executed:
  - { example: list-rule-tests-and-its-runner, stack: ts-server, date: 2026-09-21, result: listed }
docs-refresh: deferred — re-verified 2026-09-22, the cited sources changed only in code-comment line-number citations; no source changed its line count, and no line this page cites or quotes was touched; clears at the next gold refresh of this page
---

# rule-tests skill

## Fact card

What each row means: [how to read a fact card](../B.md#how-to-read-a-fact-card).

<!-- vale off -->
<!-- vale-reason: the description row is the skill's own frontmatter, quoted verbatim, including its Russian trigger words -->

<!-- getff:begin section=B-card-rule-tests plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `rule-tests` |
| kind | skill |
| ships-to | core: python, react-native, react-next, react-spa, ts-server |
| description | Use when a consumer has an EXISTING generated rule whose firing test material is missing, broken, or needs a bypass variant. Triggers: rule tests, repair test material, fix negative-test, rule test material, verify the rule fires, rule-tests, починить тест правила, исправить негативный тест, проверить что правило срабатывает, тестовый материал для правила. NOT for creating new rules (/rule-research). |
| source | `.claude/skills/rule-tests/SKILL.md:3` |
| invocation | auto |
| posture | portable |
| operator-twin | .claude/skills/rule-tests/SKILL.md |
<!-- getff:end section=B-card-rule-tests -->

<!-- vale on -->

## Explanation

This is one of the [skills](../B.md) getff installs. It is the partner of
[rule-research](rule-research.md). That skill creates a [rule](../../terms.md#rule).
This one keeps the proof that the rule still can [fire](../../terms.md#fire). You need
it when the code samples that test a generated rule are missing or broken, or when you
want one more sample that tries to sneak past the rule.

Without it, an agent takes the short road. It edits the rule until the failing test goes
[green](../../terms.md#red-and-green). That turns the protection upside down, and the
skill file names this exact failure. With the [skill](../../terms.md#skill), the agent
edits only the samples and never the rule.

The agent picks the skill up by itself when you ask it to repair a rule's test material.

Like its partner, the skill file is short. The real method is
`agents/rule-test-author.md`, installed into `.claude/agents/`. It has three steps:

1. Read the rule as it was delivered to your project, never from memory.
2. Write or repair the samples. On the npm stacks that is the `negative-test` entry of
   the rule in `.ai-factory/synthesizer-output/rules-manifest-additions.json`. On the
   `python` [lane](../../terms.md#lane) it is a small JSON file under
   `.ai-factory/rule-tests/`.
3. Fire that single rule in a temporary folder that holds nothing else, and paste the
   tool's own output. Some linters report the same code for many rules, so a green run
   of the whole config cannot tell you which rule fired.

The method also covers stale rules. The agent reads two records your project already
keeps, tells you what they do and do not prove, and offers to regenerate. It runs
nothing until you say yes.

To see the skill, its method file, and the script the pre-push step uses to fire samples:

```bash
ls .claude/skills/rule-tests .claude/agents/rule-test-author.md scripts/run-rule-tests-firing.sh
```

```text
.claude/agents/rule-test-author.md
scripts/run-rule-tests-firing.sh

.claude/skills/rule-tests:
SKILL.md
```

What the skill does not do: it never creates a rule and never edits one. It is part of
the [soft layer](../../terms.md#soft-layer-and-hard-layer), so it cannot stop an agent
that ignores it. The method file is open about coverage. The full repair loop works
today on the npm stacks and for ast-grep rules. For ruff and cargo rules, the framework
has no checked-in sample set yet. The staleness check sees changed dependencies only. It
cannot tell you that the docs behind a rule have aged.

## Evidence

- The description is line 3 of `.claude/skills/rule-tests/SKILL.md`. Line 16 says it
  never edits the rule. Line 31 names the "edit the rule to go green" failure.
- In `agents/rule-test-author.md`: what may be edited is lines 28 and 29, the three steps
  are lines 35 to 46, the reason for firing one rule alone is line 50, coverage per lane
  is lines 67 to 70, and the staleness steps are lines 78 to 89.
- The firing script is copied from `packages/core/synthesizer/run-rule-tests-firing.sh`
  by line 1089 of `install.sh`. The method file is on the installer's list at line 228.
- The skill is in `GETFF_SKILLS_CORE`, line 63 of `setup.d/lib.sh`, copied by lines 143
  to 145 of `setup.d/10-skills.sh`. The `python` lane copies it on line 1233 of
  `setup.d/45-python.sh`.
- The card is built from `docs/site/reference/B.json`. The "with and without" sections
  are required by `packages/core/principles/15-skill-paired-negative.test.ts`.
