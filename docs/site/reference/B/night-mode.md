---
title: night-mode skill
description: The skill that lets your AI agent keep working on a well-scoped task while you are away, and leaves you a morning report instead of a stalled session.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - setup
  - setup.d/companions.manifest
  - .claude/skills/night-mode/SKILL.md
  - setup.d/10-skills.sh
  - setup.d/lib.sh
  - docs/site/reference/B.json
  - docs/site/reference/B.md
  - docs/site/terms.md
executed:
  - { example: list-night-mode-sections, stack: ts-server, date: 2026-09-21, result: listed }
---

# night-mode skill

## Fact card

What each row means: [how to read a fact card](../B.md#how-to-read-a-fact-card).

<!-- vale off -->
<!-- vale-reason: the description row is the skill's own frontmatter, quoted verbatim, including its Russian wake phrases -->

<!-- getff:begin section=B-card-night-mode plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `night-mode` |
| kind | skill |
| ships-to | env: react-native, react-next, react-spa, ts-server |
| description | Use when running a task FULLY AUTONOMOUSLY (overnight / unattended) as an orchestrator. Trigger on «работай всю ночь автономно», «оставляю на ночь», «прогони сам до готовности», «автономный режим», night mode, overnight autonomous, run to completion unattended. NOT for a single delegated edit (/orchestrator) or a one-shot review (/reviewer). |
| source | `.claude/skills/night-mode/SKILL.md:3` |
| invocation | auto |
| posture | portable-designed-not-proven |
| operator-twin | .claude/skills/night-mode/SKILL.md |
<!-- getff:end section=B-card-night-mode -->

<!-- vale on -->

## Explanation

This is one of the [skills](../B.md) getff installs at the `env`
[depth](../../terms.md#depth). It is for the evening when you hand your agent a clear
task and go to sleep. Without it, an unattended run tends to fail in the same few ways.
It stops at the first open question and waits for you all night. Or it quietly makes a
choice that was yours to make. Or it dies when the model's rate limit resets. This
[skill](../../terms.md#skill) gives the agent a policy for each of those moments, so you
wake up to finished work and a list of what is left for you.

The agent picks the skill up by itself when you say "night mode", "overnight
autonomous", or "run to completion unattended". The skill is thin on purpose. The build loop itself is not in it. One session
coordinates, a fresh [sub-agent](../../terms.md#sub-agent) builds each increment, and
other sub-agents review it. That loop belongs to a companion skill named
`superpowers:subagent-driven-development`, which the skill file shortens to "SDD". This skill adds only what an unattended run
needs on top:

| Moment | What the agent does |
|---|---|
| A technical choice comes up | decides, and writes down why |
| A choice of taste or strategy comes up | logs it in a decisions file, keeps working, and leaves it for you |
| One increment will not converge | stops after about four rework rounds, marks it blocked, and moves on |
| The model returns a rate-limit error | waits 20 to 30 minutes and resumes. Every finished increment is committed first |
| A claim about a tool's behavior carries weight | tests it, and never reasons it out from memory |
| All increments are done | reviews the whole change once more, then writes the morning report |

Read one line of the skill before you use it. Starting this skill counts as your
permission to work without asking. The agent may then push, open pull requests, and
squash-merge into a branch named `staging`. It must stop and ask before a merge into
`main`, after a second failed review of the same work, and on any choice it logged.

To see what the installed skill covers, list its sections:

```bash
grep -n '^## ' .claude/skills/night-mode/SKILL.md
```

```text
15:## The loop is SDD (do not reinvent)
23:## The overnight delta (all this skill actually owns)
44:## Terminal condition + morning report
48:## Seat lifecycle
55:## Without this skill
59:## With this skill
63:## See also
```

What the skill does not do: it does not contain the build loop, so it needs the
companion skill named above. It comes from the separate superpowers plugin. The `setup`
wrapper offers to install that plugin as an optional companion (with `-y` it installs it without asking) and skips it when you
already have it.
The skill is part of the [soft layer](../../terms.md#soft-layer-and-hard-layer). Its own
text calls the permission paragraph "prose, not a mechanism". What really stops a bad
merge is your [gates](../../terms.md#gate), not this skill. Two parts only work inside
the getff repository or with a task runtime. The "ask an advisor" step uses a script
that the skill says is not shipped. The rework command is present only at the `factory`
depth. The posture row is honest too: the skill is designed for agents other than
Claude Code, and nobody has yet run it end to end on one.

## Evidence

- The description and the `auto` invocation come from line 3 of
  `.claude/skills/night-mode/SKILL.md`. The posture marker is line 6. Line 19 states
  that a full run on another agent is "not yet exercised".
- The companion loop is named on lines 13 and 17. The two kinds of choice are line 27.
  The four-round cap is line 28, the rate-limit wait line 29, the "test it" rule line 31.
- The permission to push and merge, and the cases that must stop, are line 35. Line 38
  calls that paragraph prose and not a mechanism. Line 27 says the advisor script "is
  not shipped". The finish conditions and the morning report are line 46.
- The skill belongs to the `env` list on line 62 of `setup.d/lib.sh`. The installer
  copies that list on lines 157 to 161 of `setup.d/10-skills.sh`. Lines 92 to 104 of the
  same file record why it moved from `factory` to `env`.
- The superpowers plugin is an optional companion: line 17 of
  `setup.d/companions.manifest`. The loop that offers each companion is lines 92 to 104
  of `setup`.
- The card above is built from `docs/site/reference/B.json`.
