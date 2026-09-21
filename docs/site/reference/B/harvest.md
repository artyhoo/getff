---
title: harvest skill
description: The skill that walks your agent through turning a finished task-runtime branch into a pull request without skipping a check.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .claude/skills/harvest/SKILL.md
  - scripts/run-local-ci-sweep.sh
  - setup.d/10-skills.sh
  - setup.d/lib.sh
  - docs/site/reference/B.json
  - docs/site/reference/B.md
  - docs/site/terms.md
executed:
  - { example: sweep-script-usage, stack: repo, date: 2026-09-21, result: printed }
---

# harvest skill

## Fact card

What each row means: [how to read a fact card](../B.md#how-to-read-a-fact-card).

<!-- vale off -->
<!-- vale-reason: the description row is the skill's own frontmatter, quoted verbatim, with its internal section pointer and flag name -->

<!-- getff:begin section=B-card-harvest plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `harvest` |
| kind | skill |
| ships-to | no lane (no-lane) |
| description | Use when harvesting a finished aif-agent branch into a PR after acceptance. Triggers: harvest, harvest aif branch, egress aif task, push harvested work, post-acceptance harvest. Invocation channel: explicit /harvest only — disable-model-invocation:true is a channel flag and not a permission (§0). |
| source | `.claude/skills/harvest/SKILL.md:3` |
| invocation | slash-only |
| posture | portable |
| operator-twin | .claude/skills/harvest/SKILL.md |
<!-- getff:end section=B-card-harvest -->

<!-- vale on -->

## Explanation

This is one of the [skills](../B.md) getff installs at the `factory`
[depth](../../terms.md#depth). It is the [skill](../../terms.md#skill) you start when a
background agent has finished a task on its own branch and you want that work in a pull
request. You get one fixed order of steps, so the branch reaches review with its checks
already run. Without it, the usual result is a push that turns CI
[red](../../terms.md#red-and-green) on a check nobody re-ran locally.

The skill is only useful if you run aif-handoff, the task runtime that the `factory`
depth is built around. That runtime executes each task in a container, on a branch of
its own. "Harvest" means bringing that branch out of the container and opening the pull
request. If you do not run that runtime, this skill has nothing to work on.

The card says `ships-to: no lane`. What is true: the skill installs when you pass
`--profile factory` or `--with-aif-suite`. The [family overview](../B.md) explains why
the card reads otherwise.

You start it yourself. Type `/harvest` in [Claude Code](../../terms.md#claude-code),
followed by a task id or a branch name if you like. The agent never starts it alone,
because the steps push code and open a pull request. That only limits how the skill
starts. An agent you already asked to do this work may still read the file and follow it.

Inside, the skill has four parts:

| Part | What the agent does |
|---|---|
| Bring the work out | pushes the committed work only, never the container's dirty working tree |
| Reconcile | resolves files that two parallel branches both edited |
| Run the checks | runs one script that repeats the CI checks your change touches |
| Review and open | gets a fresh review of the diff, then opens the pull request |

The first part carries the most detail. The default is to copy the branch to your own
machine and push from there, so your normal pre-push checks run. Landing the commit
through the GitHub API is the last resort, for when your own machine cannot reach GitHub
either. That path skips the pre-push checks, so the check script becomes mandatory.

The check script is `scripts/run-local-ci-sweep.sh`. The installer delivers it together
with the skill. With no flag it runs the [gates](../../terms.md#gate) that match what
your branch changed, plus a few that run on every branch because any file can be the one
they check (a cited line, a source a docs page names). Here it prints its usage, from the
getff repository itself:

```bash
bash scripts/run-local-ci-sweep.sh --help
```

```text
usage: run-local-ci-sweep.sh [--full] [--base <ref>] [--list-gates]
env:   SWEEP_LOG_DIR=<dir>   per-gate output logs land here (default: a fresh mktemp -d)
exit:  0 gates passed (or nothing to do on a clean tree) · 1 a gate failed
       2 bad usage · 3 refused: dirty tree, committed diff selected no gates
```

What the skill does not do: it enforces nothing by itself. It is part of the
[soft layer](../../terms.md#soft-layer-and-hard-layer). The gates are the script and your
git hooks. The skill is the reminder to run them in order. It was also written for the
getff repository first. It names a `staging` branch, pull-request body sections, and
review agents that your project may not have, so adapt those parts. Some checks stay
CI-only, and the skill says so: whole-tree Markdown checks are not in the local script.

## Evidence

- The description is line 3 of `.claude/skills/harvest/SKILL.md`. Line 6 of the same
  file is `disable-model-invocation: true`, which the card shows as `slash-only`. The
  posture marker is line 18.
- The four parts are the sections that start at lines 41, 59, 63, and 76 of that file.
  The default push path is step 4 (line 54). The last-resort path is step 5 (line 55).
  The CI-only checks are named at line 74.
- The list of `factory` skills is line 65 of `setup.d/lib.sh`. The loop that copies
  them runs only for `factory` or `--with-aif-suite`: `setup.d/10-skills.sh`, lines 170
  to 174.
- The same block delivers `scripts/run-local-ci-sweep.sh` next to the skill:
  `setup.d/10-skills.sh`, lines 175 to 182. The usage text printed above is lines 145 to
  148 of that script.
- The card above is built from the `harvest` entry in `docs/site/reference/B.json`,
  which starts at line 159.
