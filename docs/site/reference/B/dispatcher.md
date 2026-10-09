---
title: dispatcher skill
description: The skill that runs a planned job step by step through the optional task runtime, so no step is sent twice and no finished step is left without a pull request.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - setup
  - setup.d/companions.manifest
  - .claude/skills/dispatcher/SKILL.md
  - .claude/skills/dispatcher/references/execution.md
  - .claude/skills/dispatcher/references/harvest.md
  - .claude/skills/dispatcher/references/invocation.md
  - .claude/skills/dispatcher/references/parks.md
  - .claude/skills/dispatcher/references/scope-and-provenance.md
  - .claude/skills/dispatcher/helpers/probe-inflight.sh
  - install.sh
  - setup.d/10-skills.sh
  - setup.d/lib.sh
  - docs/site/reference/B.json
  - docs/site/reference/B.md
  - docs/site/reference/B/pipeline.md
  - docs/site/reference/B/aif-doctor.md
  - docs/site/terms.md
executed:
  - { example: probe-without-job-name, stack: repo, date: 2026-09-21, result: probe-incomplete }
docs-refresh: deferred — re-verified 2026-09-28, this range adds the check-zcode-mirror refresh pair at line 1114 of the cited install.sh, far below the line 17 this page names, and no other cited source moved; clears at the next gold refresh of this page
---

# dispatcher skill

## Fact card

What each row means: [how to read a fact card](../B.md#how-to-read-a-fact-card).

<!-- vale off -->
<!-- vale-reason: the description row is the skill's own frontmatter, quoted verbatim, including the maintainers' internal vocabulary -->

<!-- getff:begin section=B-card-dispatcher plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `dispatcher` |
| kind | skill |
| ships-to | no lane (no-lane) |
| description | Use when you need to EXECUTE a chosen umbrella's stages through the aif-control loop. Triggers: dispatcher, execute umbrella, run stages, aif loop, harvest PR, stage gate advance. Invocation channel: explicit /dispatcher only — disable-model-invocation:true is a channel flag and not a permission (§0). NOT for planning — priority and launch-table are /pipeline. |
| source | `.claude/skills/dispatcher/SKILL.md:3` |
| invocation | slash-only |
| posture | cc-native-with-fallback |
| operator-twin | .claude/skills/dispatcher/SKILL.md |
<!-- getff:end section=B-card-dispatcher -->

<!-- vale on -->

## Explanation

This is one of the [skills](../B.md) for people who run `aif-handoff`. That is a
separate task runtime: it runs agent tasks inside Docker containers. The
[pipeline](pipeline.md) skill plans a larger job. This [skill](../../terms.md#skill)
carries the plan out. Done by hand, each step of a job takes six to ten small actions,
and the skill's own text names the one people forget most: turning the finished work
into a pull request. The skill puts those actions in a fixed order, so you are asked
only when a real decision is yours. Without that runtime, the skill has nothing to drive.

The card's `ships-to` row reads "no lane". What is true is that you get the skill at the
`factory` [depth](../../terms.md#depth), with `--profile factory` or
`--with-aif-suite`. The
[skills overview](../B.md) explains that defect. The agent never loads this skill by
itself. You type `/dispatcher <job-name>`. The description calls a job an "umbrella".

Inside, the skill is a loop that runs once per step of the job:

| Move | What happens |
|---|---|
| Guard | one script checks six places for work already started on this job |
| Send | the written brief for the step goes to the runtime as a task |
| Watch | the agent polls the task once per turn |
| Answer | a technical question from the task is answered by the agent. A question of scope or direction comes to you |
| Collect | the finished branch is pushed from your machine and a pull request is opened |
| Review | a fresh reviewer reads the pull request's changes |
| Advance | the next step starts only after this pull request is merged |

The guard matters most, and you can see its character without a runtime. No default
install contains this skill, so the example runs in the getff repository. Here the guard
runs with no job name:

```bash
env -u SLUG bash .claude/skills/dispatcher/helpers/probe-inflight.sh
```

```text
SIGNAL error SLUG-not-set
VERDICT: PROBE-INCOMPLETE
```

A check that could not be asked never counts as a clean answer. On that verdict the
agent must stop and show it to you.

What the skill does not do: it does not plan, rank, or write code itself. It wires four
command-line tools that come with the runtime connection at the `factory` depth, and it
adds none. When the runtime itself misbehaves, it hands over to
[aif-doctor](aif-doctor.md). The automatic answer to technical questions needs a
companion skill, `superpowers:brainstorming`, from the separate superpowers plugin. The
`setup` wrapper offers to install that plugin as an optional companion (with `-y` it installs it without asking). Without it,
every question comes to you. The examples in the skill collect work
into a branch named `staging`. The skill calls itself "prose-only", so it is part of the
[soft layer](../../terms.md#soft-layer-and-hard-layer). The checks with teeth are the
guard script and your own [gates](../../terms.md#gate).

## Evidence

Skill evidence refreshed on 2026-10-06 to follow conditional procedure owners;
helper/install examples are unchanged. No live runtime certification is claimed.

- The strict-YAML description and manual-only flag are in `.claude/skills/dispatcher/SKILL.md`.
  The card routes each action to its procedure before execution.
- `.claude/skills/dispatcher/references/invocation.md` owns invocation and the prose-only
  classification; `execution.md` owns the substrate table and the guard/send/watch/
  collect/review/advance loop, including six in-flight signals and PROBE-INCOMPLETE.
- `.claude/skills/dispatcher/references/parks.md` owns question types, companion fallback,
  and technical answers; `scope-and-provenance.md` owns the out-of-scope limits and origin.
- `.claude/skills/dispatcher/helpers/probe-inflight.sh` prints that verdict on lines 74
  to 78, before it touches git, Docker, or the network.
- The skill belongs to the `factory` list on line 65 of `setup.d/lib.sh`. The installer
  copies that list on lines 170 to 174 of `setup.d/10-skills.sh`. Line 17 of
  `install.sh` names the flag.
- The superpowers plugin is an optional companion: the `superpowers` row of
  `setup.d/companions.manifest`. The loop that offers each companion is lines 122 to 134
  of `setup`.
- The card above is built from `docs/site/reference/B.json`.
