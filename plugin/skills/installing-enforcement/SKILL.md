---
name: installing-enforcement
description: Use when the user wants to actually WIRE the hard enforcement layer (git pre-commit/pre-push hooks + CI) into their repo, or asks "how do I make these rules actually fail the build / block a commit / run in CI", or wants to turn the rules-as-tests methodology from advice into a build-failing gate. Explains the soft-vs-hard boundary and points at the /getff:install-enforcement command.
---

# Installing Enforcement

> **Authoritative for:** when and how to wire the plugin's hard enforcement layer (git hooks + CI) — the soft-vs-hard split and the `/getff:install-enforcement` flow.
> **NOT authoritative for:** the installer's deploy mechanics (those live in the project's `install.sh`); the project goal (see the consumer's own README / the framework `README#why-this-exists`).

The getff plugin ships in **two layers**. Knowing which one a request needs is the
whole job of this skill.

## The two layers

| Layer | What it is | How it ships |
|---|---|---|
| **Soft** (session-scoped) | skills, sub-agents, advisory/inject session hooks — they run *inside the agent session* and *advise* | **already live** the moment `/plugin install` finishes |
| **Hard** (repo-scoped) | `.husky` pre-commit/pre-push git hooks, the CI workflow, dev-deps, ESLint/vitest/Stryker configs — they *fail the build* | **opt-in**, via `/getff:install-enforcement` |

A plugin can **never** silently wire a consumer's git/CI — so the hard layer is deliberately
behind an explicit command, not the install. This is the project's own thesis applied to its
packaging: a plugin that *claimed* to install the build-failing enforcement by itself would be
exactly the "documents lie" failure the framework exists to prevent.

## When to wire the hard layer

Wire it when the user wants violations to **actually block** — a commit rejected, a PR red in CI —
not merely surfaced in the session. Signals: "make this fail the build", "block the commit",
"run in CI", "enforce, don't just advise", "set up the git hooks".

Do **not** wire it when the user only wants the methodology/advice (the soft layer already covers
that) or is just exploring.

## How to wire it

Run **`/getff:install-enforcement`**. It:

1. detects/confirms the stack (`ts-server` | `react-next`),
2. **previews** the changes (dry-run — writes nothing),
3. asks for explicit `[y/N]` consent,
4. on yes, fetches the project's **official `install.sh`** (Option C — pinned to the plugin
   version, no bundled copy) and runs it against the current repo, wiring `.husky` + CI.

The installer is idempotent and never overwrites existing files without `--force`. After wiring,
remind the user to commit the new `.husky/` + workflow and install the dev-deps the hooks need.

## Honest boundary (T16)

Never tell the user the *plugin* installed the git hooks/CI. The plugin delivered the soft layer;
**they** opted into the hard layer via this command, which ran the official installer in their
repo. Keep that distinction explicit — it is the difference between honest packaging and theatre.
