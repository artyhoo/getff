---
title: rule-research skill
description: The skill that sends your AI agent to the official docs of your stack and brings back lint rules that are proven to fire.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .claude/skills/rule-research/SKILL.md
  - agents/rule-researcher.md
  - packages/core/research/allowlist.ts
  - install.sh
  - setup
  - setup.d/10-skills.sh
  - setup.d/45-python.sh
  - setup.d/80-rule-bootstrap.sh
  - setup.d/lib.sh
  - docs/site/reference/B.json
  - docs/site/reference/B.md
  - docs/site/terms.md
executed:
  - { example: list-rule-research-and-its-protocol, stack: ts-server, date: 2026-09-21, result: listed }
---

# rule-research skill

## Fact card

What each row means: [how to read a fact card](../B.md#how-to-read-a-fact-card).

<!-- vale off -->
<!-- vale-reason: the description row is the skill's own frontmatter, quoted verbatim, including its Russian trigger words -->

<!-- getff:begin section=B-card-rule-research plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `rule-research` |
| kind | skill |
| ships-to | core: python, react-native, react-next, react-spa, ts-server |
| description | Use when a consumer wants to bootstrap stack-aware ESLint rules from LIVE documentation rather than ship pre-baked recipes. Triggers: rule research, research stack practices, generate eslint rule from docs, bootstrap rules for my stack, rules-research, rule-bootstrapping, no-head-element, исследовать практики стека, сгенерировать правило из документации. |
| source | `.claude/skills/rule-research/SKILL.md:3` |
| invocation | auto |
| posture | portable |
| operator-twin | .claude/skills/rule-research/SKILL.md |
<!-- getff:end section=B-card-rule-research -->

<!-- vale on -->

## Explanation

This is one of the [skills](../B.md) getff installs. You get new lint
[rules](../../terms.md#rule) that come from the current docs of your
[stack](../../terms.md#stack), not from what your agent remembers. Each rule arrives
with a test that proves it can [fire](../../terms.md#fire). Without the skill, an agent
writes a rule by hand from memory, and nothing shows the rule ever catches anything.

The agent picks the [skill](../../terms.md#skill) up by itself when you ask it to
research practices for your stack.

The skill file is 32 lines and holds no method of its own. It points at one longer file,
`agents/rule-researcher.md`, which the installer puts in `.claude/agents/`. That file is
the method, and any agent can read it. In plain words, it tells the agent to:

1. Detect your stack from your package manifest and the framework config.
2. Read the official docs. It uses the context7 and deepwiki doc servers when you have
   them, and plain web search and fetch when you do not.
3. Turn a practice into a rule only when it fits one narrow shape: forbid one piece of
   syntax in one file, with a bad and a good sample that differ by one token. Anything
   wider is written down as a finding and gets no rule.
4. Fetch each source page, keep a quote from it, and check the host against an allowed
   list. A source that is not allowed fails closed.
5. Show you the whole list and wait for one yes or no.
6. Write two JSON files under `.ai-factory/rules-research/`, which you commit.

The agent does not build the rule. You run the getff installer again with `--full`, and
a fixed script turns the two files into a rule plus its firing test.

To see both halves in your project, list them:

```bash
ls .claude/skills/rule-research .claude/agents/rule-researcher.md
```

```text
.claude/agents/rule-researcher.md

.claude/skills/rule-research:
SKILL.md
```

What the skill does not do: it enforces nothing, because it is part of the
[soft layer](../../terms.md#soft-layer-and-hard-layer). It covers a small class of rules.
Cross-file checks, such as import boundaries, stay findings. The method file admits that
ready-made lint plugins often cover the same ground. The `python`
[lane](../../terms.md#lane) has its own arm that produces ast-grep rules. The Rust arm
is a pointer only, and the `go` lane is out of scope. The skill text says to run
`./setup --full`. That `setup` file lives in the getff repository, not in your project.

## Evidence

- The description is line 3 of `.claude/skills/rule-research/SKILL.md`. Line 16 says the
  skill is a thin entry point to `agents/rule-researcher.md`. Line 22 is the fail-closed
  source check.
- The six steps are lines 97 to 150 of `agents/rule-researcher.md`. The narrow rule shape
  is line 117. The two output files are lines 30 and 31. The Rust and Go limits are
  lines 262 and 293.
- The built-in allowed hosts start on line 20 of `packages/core/research/allowlist.ts`.
- The skill is in `GETFF_SKILLS_CORE`, line 63 of `setup.d/lib.sh`, copied by lines 143
  to 145 of `setup.d/10-skills.sh`. The `python` lane copies it on line 1233 of
  `setup.d/45-python.sh`. The method file is on the installer's list at line 226 of
  `install.sh`.
- The step that reads the two JSON files is `setup.d/80-rule-bootstrap.sh`, lines 40 to
  54. With no files it prints guidance and ships no rule. `--full` is line 11 of `setup`.
- The card is built from `docs/site/reference/B.json`.
