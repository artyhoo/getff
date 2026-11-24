---
name: getff-experience
description: 'Use when beginning substantive implementation, debugging, integration, or design work in the getff repository and about to choose an approach — before writing code, fixing an unfamiliar failure, or committing to a plan. Triggers: starting a feature, bugfix, gate/CI/hook/renderer/tooling change in getff; a distinctive build, test, or runtime error. Not for trivial edits, mechanical continuation of in-flight work, or when the current task already supplies the needed prior solution.'
---

<!-- @harness-posture: portable — pure prose skill; every reference is markdown readable on any harness, no hook or harness-specific primitive required -->

# getff-experience — one governed experience lookup per work unit

> **Authoritative for:** the getff-experience skill — work-unit definition, the single `MemHub_recall` call contract (query shape, arguments, one-call rule, failure semantics), lead-not-authority use of results, and one-line handoff retention.
> **NOT authoritative for:** the MemHub provider and its own skill (`~/.claude/skills/memhub-recall/SKILL.md` on Claude Code, `~/.codex/skills/memhub-recall/SKILL.md` on Codex) — its notice, receipts, permissions and denial semantics govern every call and are never re-described here. Project goal — [README.md#why-this-exists](../../../README.md#why-this-exists).

## When to use

A work unit begins when you can name a concrete outcome or problem, its component, and what distinguishes it from routine edits: starting substantive implementation, debugging, integration, or design work here, before choosing an approach.

Skip: trivial edits, mechanical continuation, and tasks whose current context already supplies the needed recall or solution (generic model familiarity does not count as supplied). A genuinely different obstacle starts a new work unit.

## The one lookup

Use 3–6 concise English action/component terms plus exact error or file identifiers. Translate the task meaning, never add the suspected solution; omit generic repository words when a distinctive component identifies the work.

1. Load the installed memhub-recall provider skill once per usable context; do not reload it per query.
2. Call `MemHub_recall` — the governed store — once per work unit. Build `query` only from the starting task or error text: at most 240 Unicode characters, distinctive identifiers first (error codes, file and component names), never seeded with a suspected answer. Arguments: `limit: 2`, `character_budget: 2000`, `timeout_ms: 30000`; omit scope. Prefer `MemHub_recall` over `MemHub_context` (whose fast inner deadlines often return partial-empty); never call both; never substitute raw-conversation, ask, or fresh-synthesis tools.
3. One call total. No follow-up, rephrasing, or retry after an empty, timeout, denied, errored, or permission-changed result. If the provider or tool is missing or unavailable, continue without it, state that plainly, never report a lookup as done.

## Using the result

Treat a specific applicable item as a lead to verify, not an authority: current task and repository source evidence take precedence. Keep the provider's action notice and result state (partial / empty / error) intact; cite the source actually used. No extra verification ritual beyond the task's own checks.

## Retain one line

Keep one short task-context/handoff line: work unit, query/result state, useful detail with source ID if used, limitations. Editing, testing, and resume inside the same outcome reuse that line instead of querying again. No database, cache, or helper service.

## Without this skill

Each getff task starts from the agent's own bearings: a predating, prompt-absent lesson — a gate invocation form, a CI registration constraint — is re-derived or missed, and resume re-searches because no lookup was recorded.

## With this skill

Before choosing an approach the agent makes exactly one bounded governed lookup keyed to the task's own identifiers, keeps the provider's truthful state, uses a returned step as a cited lead, and retains one line so the same unit never queries twice.
