---
title: aif-doctor skill
description: The troubleshooting skill for the optional task runtime, so a stuck task gets a diagnosis and one proposed fix instead of an hour of guessing.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .claude/skills/aif-doctor/SKILL.md
  - .claude/skills/aif-doctor/helpers/heal.sh
  - .claude/skills/dispatcher/SKILL.md
  - scripts/render-reference.mjs
  - install.sh
  - setup.d/10-skills.sh
  - setup.d/lib.sh
  - docs/site/reference/B.json
  - docs/site/reference/B.md
  - docs/site/terms.md
executed:
  - { example: list-skill-in-repo, stack: repo, date: 2026-09-21, result: listed }
docs-refresh: deferred — re-verified 2026-09-24, the only change to the cited setup.d/10-skills.sh in this range swaps two in-comment pointers (arch/SKILL.md line 94 becomes the «Effort-worthiness» paragraph name) with the line count unchanged, so every line number this page cites still holds; clears at the next gold refresh of this page
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
| Name | match what it saw against a catalogue of nine failures the authors observed live | no |
| Propose | print the one matching fix, the evidence, and how to reverse it | no |
| Change | small reversible fixes, such as a git setting or a retry, are applied and logged | no |
| Change | anything that deletes a task record or restarts a container | yes |

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

.claude/skills/aif-doctor/helpers:
heal.sh
refresh-aif-base.sh
```

The two helpers bring a stale copy of your repository inside the runtime's container up
to date. `heal.sh` always exits with 0, so a failed refresh warns and never blocks.

What the skill does not do: it does not run tasks, plan work, or repair your network. It
only names a network block. It is a runbook from the maintainers' own setup. It
assumes the runtime answers on `localhost:3009` and that container names contain `aif`.
Three of its probes are scripts under `packages/runtime-bridge/`. The `dispatcher` skill
says that path exists only in the framework repository. The posture row says `cc-only`:
any agent can read the file, and only Claude Code loads it from a slash command. It is
part of the [soft layer](../../terms.md#soft-layer-and-hard-layer).

## Evidence

- The description comes from line 3 of `.claude/skills/aif-doctor/SKILL.md`. Line 5
  sets `disable-model-invocation: false`, and line 38 says the skill "auto-fires". The
  posture marker is line 20.
- Line 328 of `scripts/render-reference.mjs` prints `slash-only` whenever that key is
  present, whatever its value. That explains the card row.
- The probes are lines 51 to 59, with the address on line 55 and the container filter
  on line 57. The watchdog note is line 61. The four moves are lines 69 to 72. Line 69
  adds the read of the log's error lines, and line 70 holds the "do not guess" rule.
- The catalogue is sections 3.1 to 3.9, from line 82. Section 3.9, the spent
  provider quota, starts on line 241. The log-window check is the
  section 3.7 block, lines 160 to 196, and section 3.8 reuses it on lines 225 to 228.
  The two kinds of change start on lines 271 and 290. The network limit is line 318.
- `.claude/skills/aif-doctor/helpers/heal.sh` states its "always exits 0" contract on
  line 12. Line 55 of `.claude/skills/dispatcher/SKILL.md` says the `packages/` path
  exists only in the framework repository.
- The skill belongs to the `factory` list on line 65 of `setup.d/lib.sh`. The installer
  copies that list on lines 170 to 174 of `setup.d/10-skills.sh`, and marks the helpers
  executable on line 194. Line 17 of `install.sh` names the flag.
- The card above is built from `docs/site/reference/B.json`.
