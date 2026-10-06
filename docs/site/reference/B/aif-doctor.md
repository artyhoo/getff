---
title: aif-doctor skill
description: The troubleshooting skill for the optional task runtime, so a stuck task gets a diagnosis and one proposed fix instead of an hour of guessing.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .claude/skills/aif-doctor/SKILL.md
  - .claude/skills/aif-doctor/references/failure-catalogue.md
  - .claude/skills/aif-doctor/references/inventory-and-triage.md
  - .claude/skills/aif-doctor/references/mutation-tiers.md
  - .claude/skills/aif-doctor/references/scope-and-evidence.md
  - .claude/skills/aif-doctor/helpers/aif-agent-target.sh
  - .claude/skills/aif-doctor/helpers/heal.sh
  - .claude/skills/aif-doctor/helpers/refresh-aif-base.sh
  - .claude/skills/dispatcher/SKILL.md
  - .claude/skills/dispatcher/references/execution.md
  - scripts/render-reference.mjs
  - install.sh
  - setup.d/10-skills.sh
  - setup.d/lib.sh
  - docs/site/reference/B.json
  - docs/site/reference/B.md
  - docs/site/terms.md
docs-refresh: deferred — re-verified 2026-09-30, the only change to the cited setup.d/lib.sh in this range renumbers one in-comment pointer into setup.d/45-python.sh at line 716, far below the line 65 factory list this page names, which did not move; clears at the next gold refresh of this page
executed:
  - { example: list-skill-in-repo, stack: repo, date: 2026-09-30, result: listed }
docs-refresh: deferred — re-verified 2026-09-30, the cited install.sh, setup.d/10-skills.sh and setup.d/lib.sh changed in this range for the one-button landing (the refresh record, the generic stack, the handoff hook group), and every line this page cites is unchanged (setup.d/lib.sh:65 the factory list, setup.d/10-skills.sh:170-174 and 194, install.sh:17); clears at the next gold refresh of this page
docs-refresh: deferred — re-verified 2026-09-30, the only change to the cited install.sh in this range rewrites one in-comment citation at line 1202 (pre-push.ts:2077-2080 becomes :2059-2062) with the line count unchanged, far below the line 17 this page names; clears at the next gold refresh of this page <!-- cite:historical both pre-push.ts numbers name the staging commit that wrote this line, not the current file -->
---

# aif-doctor skill

## Fact card

What each row means: [how to read a fact card](../B.md#how-to-read-a-fact-card).

<!-- vale off -->
<!-- vale-reason: the description row is the skill's own frontmatter, quoted verbatim, including its Russian wake phrases -->

<!-- getff:begin section=B-card-aif-doctor plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `aif-doctor` |
| kind | skill |
| ships-to | no lane (no-lane) |
| description | Use when the aif-handoff runtime is misbehaving — a task is stuck or crash-looping, new tasks stay backlog at capacity, the claude runtime is broken. Triggers: aif-doctor, aif health, task stuck, задача висит, runtime broken, рантайм сломан, aif не отвечает, capacity skipping, native binary not installed, why won't my task start. Invokable when the dispatcher is NOT running. NOT for running the dispatch loop (/dispatcher) or planning (/pipeline). |
| source | `.claude/skills/aif-doctor/SKILL.md:3` |
| invocation | slash-only |
| posture | cc-only |
| operator-twin | .claude/skills/aif-doctor/SKILL.md |
<!-- getff:end section=B-card-aif-doctor -->

<!-- vale on -->

## Explanation

This is one of the [skills](../B.md) for people who run `aif-handoff`. That is a
separate task runtime: it runs agent tasks inside Docker containers on your machine.
When a task there hangs, restarts in a loop, or never starts, the cause is usually the
environment and not your code. This [skill](../../terms.md#skill) gives the agent a
fixed checklist for that moment. You get a named failure, the evidence, and one fix with
a note on how to undo it. If you do not run that runtime, you do not need this skill.

Two card rows need a correction. `ships-to` reads "no lane". What is true is that you
get the skill at the `factory` [depth](../../terms.md#depth), with `--profile factory`
or `--with-aif-suite`.
The [skills overview](../B.md) explains that defect. The `invocation` row reads
`slash-only`, but the skill file sets `disable-model-invocation: false` and says it also
wakes on phrases such as "task stuck". You can type `/aif-doctor`, and the agent can
also load it by itself.

Inside, the skill works in four moves. The last move comes in two kinds:

| Move | What happens | Needs your "go" |
|---|---|---|
| Look | read-only probes: the runtime's health address, its task list, `docker ps`, the error lines of the agent's container log | no |
| Name | match what it saw against a catalogue of ten failures the authors observed live | no |
| Propose | print the one matching fix, the evidence, and how to reverse it | no |
| Change | small reversible fixes, such as a git setting or a retry, are applied and logged | no |
| Change | task creation/deletion, active smoke that may start an executor, standing project configuration, or container restarts | yes, unless already explicitly authorized for that exact scope |

When nothing in the catalogue matches, the skill tells the agent to say so and not to
guess. It also tells the agent to leave slow tasks alone, because the runtime has its
own watchdog for those. One failure hides from that watchdog: when the model provider
refuses every request because the plan's quota is spent, the task looks alive and makes
no progress. The only record of the cause is an error line in the container log, so the
skill reads those lines on every run. Two failures are found by counting container log lines over a
time window. The count is printed only when the log that was read covers the whole
window. Otherwise the skill prints `WINDOW-UNCOVERED` and the reason, never a
misleading 0. No default install contains this skill, so the example runs in the getff repository:

```bash
ls .claude/skills/aif-doctor .claude/skills/aif-doctor/helpers
```

```text
.claude/skills/aif-doctor:
SKILL.md
helpers
references

.claude/skills/aif-doctor/helpers:
aif-agent-target.sh
heal.sh
refresh-aif-base.sh
```

`aif-agent-target.sh` finds the runtime's agent container and the docker context it runs
on. It uses a container only when exactly one matches, and it prints the name and the
context. With two or more matches it names them and stops. When your current docker
context has none, it asks the other contexts, and it waits a bounded time for each. If your
current context does not answer in time, it stops rather than pick a container elsewhere.

The other two helpers bring a stale copy of your repository inside the runtime's container
up to date. `heal.sh` always exits with 0, so a failed refresh warns and never blocks.
`refresh-aif-base.sh` runs git inside the container as the user who owns that copy. Git
run as the container's default user, root, leaves files the runtime's tasks cannot
write, and the next task then fails before it starts.

What the skill does not do: it does not plan work or repair your network. It
only names a network block. It is a runbook from the maintainers' own setup. It
assumes the runtime answers on `localhost:3009` and that container names contain `aif`.
Its passive inventory reads health, status and container logs. Active bridge smoke and
standing parallel configuration are separate authorized changes. The runtime helper path
under `packages/runtime-bridge/` exists only in the framework repository; installed
consumers resolve their delivered vendor copy. The posture row says `cc-only`:
any agent can read the file, and only Claude Code loads it from a slash command. It is
part of the [soft layer](../../terms.md#soft-layer-and-hard-layer).

## Evidence

Skill evidence refreshed on 2026-10-06 to follow conditional procedure owners.
Helper/install examples are unchanged except the doctor directory now includes references.
No live runtime certification is claimed.

- The strict-YAML description and invocation flag are in `.claude/skills/aif-doctor/SKILL.md`.
  The card identifies passive inventory and the Tier-2 authorization floor.
- `.claude/skills/aif-doctor/references/inventory-and-triage.md` owns the read-only
  inventory commands, watchdog note and four diagnosis moves.
- `.claude/skills/aif-doctor/references/failure-catalogue.md` owns sections 3.1 to 3.10,
  including covered log windows, provider quota and repository ownership.
- `.claude/skills/aif-doctor/references/mutation-tiers.md` distinguishes reversible
  Tier-1 repairs from Tier-2 active smoke, standing configuration and destructive changes.
- `.claude/skills/aif-doctor/references/scope-and-evidence.md` records the network limit.
- The framework and consumer runtime paths are the substrate table in
  `.claude/skills/dispatcher/references/execution.md`.
- `.claude/skills/aif-doctor/helpers/aif-agent-target.sh` states its rules in its header,
  lines 14 to 22, and its exit codes on lines 37 to 39.
- `.claude/skills/aif-doctor/helpers/refresh-aif-base.sh` reads the owner of the copy on
  line 116 and runs every git command as that user on line 122.
- `.claude/skills/aif-doctor/helpers/heal.sh` states its "always exits 0" contract on
  line 12.
- The skill belongs to the `factory` list on line 65 of `setup.d/lib.sh`. The installer
  copies that list on lines 170 to 174 of `setup.d/10-skills.sh`, and marks the helpers
  executable on line 194. Line 17 of `install.sh` names the flag.
- The card above is built from `docs/site/reference/B.json`.
