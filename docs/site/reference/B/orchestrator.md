---
title: orchestrator skill
description: The skill that teaches your AI agent to split a larger job into pieces, hand the pieces to helper agents, and keep its own context free for the decisions.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - setup
  - setup.d/companions.manifest
  - .claude/skills/orchestrator/SKILL.md
  - .claude/skills/orchestrator/references/discovery.md
  - .claude/skills/orchestrator/references/queue-mode.md
  - setup.d/10-skills.sh
  - setup.d/lib.sh
  - docs/site/reference/B.json
  - docs/site/reference/B.md
  - docs/site/terms.md
executed:
  - { example: list-orchestrator-references, stack: ts-server, date: 2026-09-21, result: listed }
---

# orchestrator skill

## Fact card

What each row means: [how to read a fact card](../B.md#how-to-read-a-fact-card).

<!-- vale off -->
<!-- vale-reason: the card is generated output pasted verbatim, including its known empty description row with one extra cell -->

<!-- getff:begin section=B-card-orchestrator plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `orchestrator` |
| kind | skill |
| ships-to | env: react-native, react-next, react-spa, ts-server |
| description | | |
| source | `.claude/skills/orchestrator/SKILL.md:3` |
| invocation | auto |
| posture | cc-native-with-fallback |
| operator-twin | .claude/skills/orchestrator/SKILL.md |
<!-- getff:end section=B-card-orchestrator -->

<!-- vale on -->

## Explanation

This is one of the [skills](../B.md) getff installs at the `env`
[depth](../../terms.md#depth). It helps when you give your agent a batch of work: ten
small fixes on one theme, or a task that falls into three or more independent parts. An
agent that does all of that itself fills its context with searches and edits, and runs
out of room halfway. An agent that delegates carelessly does no better. Its helpers get
commands that do not exist in your project, or two of them edit the same file. This
[skill](../../terms.md#skill) gives the agent a routine that avoids both.

The description row in the card is empty. That is a known defect of the generator, which
the [skills overview](../B.md) describes. The agent picks the skill up by itself when
you say "delegate", "batch fixes", or "orchestrator", or when a job splits into three or
more parts. It skips a trivial edit of five lines or fewer in one file.

Inside, the skill sorts work by size first:

| The work | Who does it |
|---|---|
| One file, five lines or fewer, path known | the main agent edits it directly |
| Two or more files, a search, or a logic change | a helper [sub-agent](../../terms.md#sub-agent) in its own isolated copy of the code |
| Research, audit, or verification | a helper sub-agent that reports back into the main session |
| Independent batches | several helpers at once, only when no two of them edit the same file |
| Two or more queued research tasks, and you granted autonomy | "Queue mode", a cycle of worker, check, and reviewer |

Around that table sit four habits. The agent looks your project over once: commit
style, base branch, and the real build and test commands. It has a fresh reviewer read
any long instruction before a helper acts on it. It adds up the tokens each helper
reports and changes its way of working before the rate limit hits. It aims for one pull
request per job.

The details live in reference files next to the skill, and the agent opens one only
when needed. To see them, list the folder:

```bash
ls .claude/skills/orchestrator/references
```

```text
ai-laziness-traps-orchestrator.md
batch-prompt-template.md
discovery.md
glossary.md
phase-minus-1.md
queue-mode.md
quota-and-burn.md
rationale.md
reviewer-template.md
worker-template.md
```

What the skill does not do: it does not contain the build-and-review loop. It calls
itself a thin wrapper over companion skills from the separate superpowers plugin. The
`setup` wrapper offers to install that plugin as an optional companion (with `-y` it installs it without asking) and skips it when
you already have it. Its model advice and token thresholds are written
for Claude models on one subscription plan. Treat them as a starting point. The skill
names a sibling skill, `dispatcher`, which you only have at the `factory` depth. It is
part of the [soft layer](../../terms.md#soft-layer-and-hard-layer): it guides the agent
and blocks nothing.

## Evidence

- The description is lines 3 to 9 of `.claude/skills/orchestrator/SKILL.md`. It spans
  several lines, which is why the card row is empty. The posture marker is line 13.
- Line 40 is where the skill calls itself a thin wrapper and names its companions.
  Line 49 states the "one pull request" goal. Line 99 ties the model advice to one plan.
- The size table is lines 124 to 133. The project look-over is lines 75 to 81, with the
  full checklist in `.claude/skills/orchestrator/references/discovery.md`.
- The fresh-reviewer step starts on line 225. The "no two batches edit the same file"
  check is line 346. The token thresholds are lines 199 to 205. Queue mode is lines 423
  to 427, with details in `.claude/skills/orchestrator/references/queue-mode.md`.
- The skill belongs to the `env` list on line 64 of `setup.d/lib.sh`. Lines 83 to 91 of
  `setup.d/10-skills.sh` record why. Lines 34 and 35 of the skill file name `dispatcher`
  as a `factory` skill, without a link.
- The superpowers plugin is an optional companion: line 17 of
  `setup.d/companions.manifest`. The loop that offers each companion is lines 92 to 104
  of `setup`.
- The card above is built from `docs/site/reference/B.json`.
