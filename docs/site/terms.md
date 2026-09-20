---
title: Terms
description: The site glossary — what each term means here, which spellings are wrong, and the registry of artifact names.
kind: glossary
sources:
  - docs/site/ai-agents.md
  - docs/site/how-it-works.md
  - docs/site/index.md
  - docs/site/installation.md
  - docs/site/quick-start.md
  - docs/site/reference/B.md
  - docs/site/why.md
  - docs/superpowers/specs/2026-09-14-getff-ai-docs-quality-contract-design.md
---

# Terms

This page fixes the words the site uses. Every page is expected to use a term as it is
defined here, and to link to this page on first mention. When two spellings of one idea
exist, the entry below says which one to use — and the Vale profile enforces the
name-class entries mechanically.

## Terms

Each entry gives a one-sentence definition and the forms that must not be used. An entry
marked `Do not use (name):` is **name-class**: its forbidden forms are compiled into the
Vale substitution rule and fail the build. A plain `Do not use:` list is guidance the
form auditor judges. Definitions are claims and belong to the claims auditor's scope,
not to this page's enforcement.

<!-- vale off -->
<!-- vale-reason: the entries below exist to name the forbidden spellings; suppressing the substitution rule on this block is the page's whole point -->

### getff

The framework this site documents — an installable convention set that makes agent
guardrails executable tests rather than prose promises.

Do not use (name): AI Factory — the project's former name, retired. It survives in
history documents and in one installer output line, `AI Factory templates →
.ai-factory/`, which [Installation](installation.md#preview-first) explains.

### Claude Code

The coding agent CLI the framework's hooks and skills run inside.

Do not use (name): CC — the abbreviation collides with plain-text license names and is
not expanded at first use anywhere on the site.

### sub-agent

A delegated agent session spawned by another agent session, with its own context window.

Do not use (name): subagent — the closed compound hides the word boundary and reads
worse in headings.

### artifact

A thing the framework produces or installs — a hook, a skill, a rule file, a report.

Do not use (name): artefact — the British spelling; this site uses the American form
everywhere.

### convention

Something your team agreed the code must do or must never do, before anything enforces it.

Owner page: [Why getff](why.md).

Do not use: guideline, best practice — both suggest the reader may skip it; a convention
here is meant to be enforced.

### rule

A convention written as a check that a tool runs, so breaking it fails instead of
passing unnoticed.

Owner page: [How it works](how-it-works.md).

Do not use: policy, guardrail — marketing words with no fixed meaning on this site.

### gate

A command that exits non-zero when a rule is broken, which stops the commit, the push,
or the build it guards.

Owner page: [How it works](how-it-works.md).

Do not use: hook — a hook is one place a gate can run from, not the gate itself; keep
the word for git hooks and Claude Code hooks.

### channel

The moment a gate runs: edit-time, pre-commit, pre-push, CI, or production audit. getff
puts every rule on the earliest channel that can reach it, and treats CI as the last resort.

Owner page: [How it works](how-it-works.md).

Do not use: stage, phase — both already mean other things in install and rollout text.

### fire

A rule fires when its gate goes red on code that breaks it. A rule that has never been
seen to fire is an unproven claim.

Owner page: [Quick start](quick-start.md).

Do not use: trigger, trip — one verb for one event keeps search and the glossary aligned.

### red and green

Red means a gate failed and named what broke. Green means it ran and found nothing.
A gate that did not run is neither.

Owner page: [Quick start](quick-start.md).

Do not use: pass or fail for a gate that was skipped — say skipped.

### self-check

The proof an installer runs on itself: it plants a violation, watches the gate go red,
then checks that clean input stays green.

Owner page: [Quick start](quick-start.md).

Do not use: smoke test — a smoke test only shows the tool starts; a self-check shows
the rule fires.

### stack

What you name when you install: one of `ts-server`, `react-next`, `react-spa`,
`react-native`, `python`, `cargo`, or `go`.

Owner page: [Installation](installation.md).

Do not use: platform, target, preset — preset is an internal package name, not a
reader-facing choice.

### lane

A stack that enforces rules with its own native tools instead of npm and ESLint. There
are three lanes: `python`, `cargo`, and `go`. Every lane is a stack. The four npm stacks
are not lanes. The generated status tables call `ts-server` the "Default TS lane". That
is internal wording from the installer's data file. Read it as "the default TypeScript
stack".

Owner page: [Installation](installation.md).

Do not use: toolchain — the toolchain is what a lane runs on, not the lane.

### depth

How much getff installs: `core` (rules and their gates), `env` (core plus the design,
review, and orchestration skills), or `factory` (env plus the skills that drive a task
runtime).

Owner page: [Installation](installation.md).

Do not use: tier, profile, level — `--profile` is the flag that selects a depth; the
thing it selects is the depth.

### soft layer and hard layer

The soft layer is what an agent reads and may follow: skills, agents, and session hooks.
The hard layer is what fails regardless of who wrote the code: git hooks and CI. The
Claude Code plugin delivers the soft layer only.

Owner page: [Installation](installation.md).

Do not use: advisory mode, strict mode — the layers are different artifacts, not one
artifact in two modes.

### skill

A folder with a `SKILL.md` file that tells an AI agent how to do one kind of task, loaded
only when the task calls for it.

Owner page: the [skills family overview](reference/B.md).

Do not use: prompt, command — a skill may be started by a slash command, but the command
is only the way in.

### fact card

The table at the top of a reference page. A script builds it from the framework's own
files, so nobody types it and nobody can let it drift.

Owner page: the [skills family overview](reference/B.md).

Do not use: info box, summary table.

### fence region

A marked span of a file that a generator owns. Text between the begin and end markers is
rewritten on every run; text outside them is yours.

Owner page: [How it works](how-it-works.md).

Do not use: generated block, managed section — one name for one mechanism.

### twin

The plain Markdown copy of a page, served at the page address plus `.md`, written for
AI agents to read.

Owner page: [Use getff with your AI agent](ai-agents.md).

Do not use: mirror, raw page.

### verified-at

The framework commit a page was checked against. The twin carries it; the human page
does not show it.

Owner page: [Use getff with your AI agent](ai-agents.md).

Do not use: last updated — a date says when someone touched the page, not what it was
checked against.

### beta, alpha, early, experimental

The four maturity labels. Each stack carries exactly one, and the definitions live in
one file that every page renders from. Beta: one-command install, and a rule provably
fires on your code. Alpha: installs and fires on verified fixtures. Early: installs and
wires real rules, with a rule pack that is still growing. Experimental: scaffold and
templates only.

Owner page: [Introduction](index.md).

Do not use: stable, production-ready, preview — none of them is a label the status file
defines.

<!-- vale on -->

## Artifact names

The registry of artifact names the site may refer to, generated from the reference
families' member registries. Names only — the definitions live on the artifacts' own
pages.

<!-- getff:begin section=artifact-names plan=scripts/render-reference.mjs -->
<!-- generated region: filled by the D29 generator's terms.md arm (not yet built — the
     reference family JSONs under docs/site/reference/ are the interim registry). -->
<!-- getff:end section=artifact-names -->
