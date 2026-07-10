---
name: using-rules-as-tests
description: Use when starting any conversation in a repo that has the rules-as-tests plugin installed — establishes how to find and use the rules-as-tests skills, the instruction-priority ladder (the project's own CLAUDE.md/AGENTS.md win), and the "invoke the relevant skill before responding" discipline. Trigger on session start, before any first reply, and whenever code quality, linting, CI, pre-commit/pre-push hooks, architecture rules, mutation/contract testing, or "stop the AI breaking my conventions" comes up.
---

# Using Rules-as-Tests

> **Authoritative for:** the rules-as-tests plugin's skill-activation protocol — the instruction-priority ladder (the consumer's own instructions win), the "invoke the relevant skill before responding" discipline, and the in-plugin skill map.
> **NOT authoritative for:** the host project's goal or conventions (its own `CLAUDE.md`/`AGENTS.md` win); the rules-as-tests methodology itself — see the `rules-as-tests` skill.

This is your entry point to the **rules-as-tests** plugin: a discipline for turning every codebase convention into an executable artifact that **fails at the earliest reachable channel** (edit-time → pre-commit → pre-push → CI → production). Its thesis: **documents lie; tests don't.** That matters most when an AI writes the code, because LLMs reliably violate undocumented conventions and write plausible-but-vacuous tests.

## Instruction priority (read this first)

This skill changes default behaviour, but **the host project's own instructions always win**:

1. **The project's `CLAUDE.md` / `AGENTS.md` / direct user requests** — highest. If they say "don't use TDD" and a skill says "always TDD", follow the project.
2. **rules-as-tests skills** — override default model behaviour where they conflict.
3. **Default system behaviour** — lowest.

The plugin never overrides the consumer's repo. It supplies discipline; the consumer stays in control.

## The rule

**Invoke the relevant skill BEFORE you respond or act — even before clarifying questions.** If there is even a ~1% chance a skill applies to what you are about to do, invoke it to check. If it turns out not to fit, you do not have to use it. Knowing the concept is not the same as using the skill — invoke it; skills evolve.

Access skills with the **Skill tool** (Claude Code) / your harness's skill mechanism. Never read a skill file with the Read tool to "use" it — invoke it.

## Skills in this plugin

| Skill | Invoke when |
|---|---|
| `rules-as-tests` | The user is setting up or reasoning about enforcement: linting, CI, pre-commit/pre-push hooks, architecture/dependency rules, meta-tests, spec-by-example, mutation testing (Stryker), contract testing (Pact), living documentation, fitness functions, or "make my codebase resist AI agents breaking conventions". This is the core methodology skill. |
| `installing-enforcement` | The user wants to actually **wire** the hard layer (git hooks + CI) into their repo — see the `/getff:install-enforcement` command. (Ships in S5.) |

## What the plugin delivers (and what it honestly does not)

- **Soft layer (this plugin):** skills, sub-agents, and session hooks that run *inside the agent session* — advice, rule-injection, review sidecars. Installed by `/plugin install`.
- **Hard layer (a command, not the plugin):** the git-hook + CI enforcement that actually fails the build lives in the consumer's git/CI infra. A plugin must never silently mutate a repo's git/CI, so it is reached **only** through the opt-in `/getff:install-enforcement` command. A plugin that claimed to install the 5-channel enforcement by itself would be lying — exactly the failure this project's thesis exists to prevent.

## Red flags (you are rationalizing — stop and invoke the skill)

| Thought | Reality |
|---|---|
| "This is just a quick lint/CI question" | Questions are tasks. Invoke `rules-as-tests`. |
| "I know how ESLint/Stryker/Pact works" | Knowing the tool ≠ applying this framework's layer model. Invoke it. |
| "Let me read the codebase first" | The skill tells you *how* to read it for enforcement gaps. Invoke first. |
| "The plugin can set up the git hooks for me" | No — the hard layer is opt-in via `/getff:install-enforcement`. Don't promise what the soft layer can't do. |
| "I'll add a test that passes" | A test that can't fail is theatre. The skill's mutation layer exists to catch exactly that. |

## Skill priority when several could apply

Process / methodology skills first (they decide *how* to approach the task), implementation skills second. "Let's harden this repo against AI drift" → invoke `rules-as-tests` first, then act on its guidance.
