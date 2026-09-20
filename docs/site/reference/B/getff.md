---
title: getff skill
description: The skill that teaches your AI agent to turn a team convention into a check that fails, instead of a sentence it may ignore.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - skills/getff/SKILL.md
  - skills/getff/references/checks-map.md
  - skills/getff/references/ai-traps.md
  - setup.d/10-skills.sh
  - docs/site/reference/B.json
  - docs/site/reference/B.md
  - docs/site/terms.md
  - packages/core/principles/15-skill-paired-negative.test.ts
  - packages/core/principles/46-reference-generator-arms.test.ts
  - tests/install-sh/baselines/ts-server/greenfield.fingerprint
executed:
  - { example: list-installed-skill, stack: ts-server, date: 2026-09-20, result: listed }
---

# getff skill

## Fact card

What each row means: [how to read a fact card](../B.md#how-to-read-a-fact-card).

<!-- vale off -->
<!-- vale-reason: the description row is the skill's own frontmatter, quoted verbatim, and it names the project's retired name -->

<!-- getff:begin section=B-card-getff plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `getff` |
| kind | skill |
| ships-to | core: python, react-native, react-next, react-spa, ts-server |
| description | Use when treating any codebase rule (architectural, naming, dependency, test-quality, contract, SLO) as an executable test that fails the build when violated, or when the user asks about enforcing code quality, fighting AI-generated code drift, setting up linters/tests/CI/pre-commit hooks, designing review processes, mutation testing, contract testing, fitness functions, observability-driven development, SLO-as-code, or any version of "how do I make my codebase resistant to AI agents breaking my conventions". Also trigger on any mention of ArchUnit, Stryker, Pact, dependency-cruiser, AI Factory (aif), Husky, lint-staged, ESLint flat config, Zod validation strategy, or shift-left/shift-right testing. Strongly trigger when the user mentions Claude Code, Cursor, or Copilot writing code that "looks fine but is wrong" — that is the core problem this skill addresses. |
| source | `skills/getff/SKILL.md:3` |
| invocation | auto |
| posture | portable |
| operator-twin | no operator twin (no-operator-twin) |
<!-- getff:end section=B-card-getff -->

<!-- vale on -->

## Explanation

This is one of the [skills](../B.md) getff installs. It is the
[skill](../../terms.md#skill) your agent loads when you ask it to enforce
something. It stops the agent from answering "I'll be careful" and points it at the
tool that can make the [rule](../../terms.md#rule) fail. You get the same advice whether
you ask about linting, architecture checks, or tests that pass without proving anything.

The agent picks the skill up by itself. Its description lists the topics that wake it:
code quality, drift from AI-written code, pre-commit and CI setup, mutation testing,
contract testing. You do not type a command. Ask your question in plain words and the
agent reads the skill first.

Inside, the skill sorts every rule into one of five layers, each with its own tool:

| Layer | What it checks | Typical tool |
|---|---|---|
| Architecture tests | structure: layers, cycles, banned imports | ESLint, dependency-cruiser |
| Meta-tests | the test suite itself: real assertions, no logic in tests | AST scans, the Vitest ESLint plugin |
| Specification by example | input and output pairs that act as the spec | Vitest `it.each`, fast-check, Zod |
| Mutation testing | whether the tests would notice a bug | Stryker |
| Living documentation | tests and generated docs as the source of truth | test names, generated specs |

The skill stays small on purpose. Five reference files sit next to it, and the agent
opens one only when your question needs it. The map of where each check runs is
`references/checks-map.md`. The list of what AI agents break most often, and which rule
catches each case, is `references/ai-traps.md`.

To see what landed in your project, list the folder:

```bash
ls .claude/skills/getff .claude/skills/getff/references
```

```text
.claude/skills/getff:
SKILL.md
references

.claude/skills/getff/references:
ai-traps.md
checks-map.md
doc-organization.md
overview.md
self-testing-docs.md
```

The installed copy differs from the source in one way. Links that pointed into the
framework repository now point at GitHub, so none of them dangle in your project.

What the skill does not do: it enforces nothing. It is part of the
[soft layer](../../terms.md#soft-layer-and-hard-layer), so an agent may read it and
still go its own way. The gates that fail regardless of the agent are the git hooks and
CI that the installer wires. Most of the ready-made configs the skill names are npm
ones. On the `python` [lane](../../terms.md#lane) the skill still installs and the layer
model still holds, but you pick the tools yourself. The `cargo` and `go` lanes do not
receive skills at all.

## Evidence

- The description and the invocation mode come from line 3 of `skills/getff/SKILL.md`.
  The posture marker is line 6 of the same file.
- The installer copies this skill from the repository root and rewrites its links:
  `setup.d/10-skills.sh`, lines 22 to 27.
- `ships-to` is measured, not declared. The path `.claude/skills/getff/` appears six
  times in the install fingerprint of each of five stacks, for example
  `tests/install-sh/baselines/ts-server/greenfield.fingerprint`. It appears zero times
  in the `cargo` and `go` fingerprints.
- The card above is built from `docs/site/reference/B.json`. Arm A of
  `packages/core/principles/46-reference-generator-arms.test.ts` fails when the
  generated card and the hand-checked card differ by one byte.
- The skill has no "with and without" sections yet. The test that demands them,
  `packages/core/principles/15-skill-paired-negative.test.ts`, lists this skill as an
  exception at line 39.
