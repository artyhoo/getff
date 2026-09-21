---
title: pipeline skill
description: The planning skill that checks your work plan against what is really merged, ranks what to do next, and refuses to start a step before the step it depends on has landed.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .claude/skills/pipeline/SKILL.md
  - .claude/skills/pipeline/helpers/list-presets.sh
  - .claude/skills/pipeline/helpers/lib/common.sh
  - setup.d/10-skills.sh
  - setup.d/30-templates.sh
  - setup.d/lib.sh
  - docs/site/reference/B.json
  - docs/site/reference/B.md
  - docs/site/terms.md
executed:
  - { example: list-pipeline-presets, stack: ts-server, date: 2026-09-21, result: listed }
docs-refresh: deferred — re-verified 2026-09-22, the cited sources changed only in code-comment line-number citations; no source changed its line count, and no line this page cites or quotes was touched; clears at the next gold refresh of this page
---

# pipeline skill

## Fact card

What each row means: [how to read a fact card](../B.md#how-to-read-a-fact-card).

<!-- vale off -->
<!-- vale-reason: the description row is the skill's own frontmatter, quoted verbatim, including the maintainers' internal vocabulary -->

<!-- getff:begin section=B-card-pipeline plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `pipeline` |
| kind | skill |
| ships-to | env: react-native, react-next, react-spa, ts-server |
| description | Use when you have ≥2 in-flight wave umbrellas with cross-stage dependencies, suspect drift between wave-sequencing-plan.md and live git reality, or need to dispatch the next wave with verified Stage N→N+1 gates. Triggers: pipeline, wave orchestrator, wave plan, stage-gate, umbrella priority, waves parallel/sequential, wave-sequencing-plan drift. Invocation channel: explicit /pipeline only — disable-model-invocation:true is a channel flag and not a permission (§0). |
| source | `.claude/skills/pipeline/SKILL.md:3` |
| invocation | slash-only |
| posture | cc-native-with-fallback |
| operator-twin | .claude/skills/pipeline/SKILL.md |
<!-- getff:end section=B-card-pipeline -->

<!-- vale on -->

## Explanation

This is one of the [skills](../B.md) getff installs at the `env`
[depth](../../terms.md#depth). It is for the moment when you run several larger jobs
with an AI agent at once, and each job has ordered steps. Plans go stale fast in that
situation. The plan file says a step is merged, and GitHub says it is not. An agent that
trusts the file starts the next step on top of code that is not there. This
[skill](../../terms.md#skill) makes the agent look at the real state first, then plan.

The description uses the maintainers' own words. An "umbrella" is one larger job. A
"wave" or "stage" is one step of it. A "kickoff" is the written brief for a step. In your
project the briefs and the plan live under `.ai-factory/orchestrator-prompts/`. The agent
never loads this skill by itself. You type it in Claude Code:

| You type | You get |
|---|---|
| `/pipeline` | an overview and a ranking of the open jobs |
| `/pipeline 3` | the top three |
| `/pipeline <job-name>` | the plan check, then a launch table for that job |
| `/pipeline list` | the ready-made ways to run a job, called presets |
| `/pipeline status` | a read-only summary of running tasks, open questions, and pull requests |

Inside, four things happen in order. First the skill compares the plan file with the
output of `gh pr list` and reports every mismatch. The real state always wins. Then it
scores the open jobs on four weighted questions and recommends one. When two jobs tie, it
asks you and does not pick. Then it writes a launch table: one row per step, with how
that step should be run. Before each later step it checks on GitHub that the earlier
step's pull request is merged. If not, the agent halts and tells you what is missing.

One of the skill's helper scripts prints the presets. You can run it yourself:

```bash
bash .claude/skills/pipeline/helpers/list-presets.sh
```

```text
aif — Autonomous overnight aif-handoff dispatch (project-default profiles, no marker) (mode=autonomous)
economy — Cost-conscious whole-line on executor tier (mode=whole-line-executor, marker=Z.AI GLM-5.3 SDK)
night — Night-mode unattended single-session (mode=mode-a-inline)
sdd — Interactive single-feature SDD (mode=in-session)
```

What the skill does not do: it writes no product code and it decides no strategy. Its
own text lists both as out of scope. It was built for the way the getff maintainers work,
and it shows. The merged check searches for pull requests into a branch named `staging`.
The `aif` preset hands work to a task runtime that only the `factory` depth installs.
One part of `/pipeline status` reads that runtime too. Without it, the skill says that
part prints a "bridge unreachable" note and the rest still works. You need the `gh`
command, and `jq` for the preset list. The skill is part of the
[soft layer](../../terms.md#soft-layer-and-hard-layer). Its own text says an agent can
ignore the data it is shown and go on.

## Evidence

- The description comes from line 3 of `.claude/skills/pipeline/SKILL.md`. Line 6 sets
  `disable-model-invocation: true`, which is why the card says `slash-only`. The posture
  marker is line 20.
- The five forms of the command are routed on line 44. The preset list is lines 60 to
  76. The status summary and what it prints without the runtime are lines 246 to 266.
- The plan comparison is lines 106 to 115, and line 114 says the real state wins. The
  four weighted questions are lines 142 to 145. The tie rule is line 159.
- The merged check is line 408, with its `base:staging` search. The halt message is
  lines 413 to 422. The two "Does NOT" limits are lines 486 and 487. Line 22 admits that
  an agent can ignore injected data.
- `.claude/skills/pipeline/helpers/list-presets.sh` only reads the preset files. Lines
  25 to 28 show it needs `jq`.
- The folder for briefs is resolved on lines 50 to 57 of
  `.claude/skills/pipeline/helpers/lib/common.sh`, and created by line 17 of
  `setup.d/30-templates.sh`.
- The skill belongs to the `env` list on line 64 of `setup.d/lib.sh`. Lines 92 to 95 of
  `setup.d/10-skills.sh` record why.
- The card above is built from `docs/site/reference/B.json`.
