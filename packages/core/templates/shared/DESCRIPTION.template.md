# <PROJECT_NAME>

> Fill the marked region below. This file is loaded by every AI agent at session start.
> Keep ≤150 lines. Cold content goes to `.claude/skills/` and `.claude/rules/`.
>
> **Authoritative for:** the consumer-project passport — the getff-owned marked region below is the project's goal source of truth (goal scope / goal core / invariants / never / non-goals).
> **NOT authoritative for:** the consumer's own prose outside the marked region (project narrative lives in the consumer's README.md) and the concrete stack — fill that from the real dependency tree.

<!-- getff:begin section=passport -->
<!-- getff-owned region: the passport's goal source of truth. Fill the marked placeholders;
     getff refreshes this region's scaffolding, never your filled values. -->

### Goal scope

<One paragraph: what this project IS — domain, primary users, core value proposition.>

### Goal core

<One sentence every change must serve. A change that does not serve it does not ship.>

### Invariants

<Properties every change must preserve. Enforce mechanically (lint/test/CI) where possible.>

- Example: the public API stays backwards-compatible within the current major version.

### Never

<Things this project will never do, even when asked — stops the AI from widening scope.>

- Example: no new runtime dependency without a recorded decision.

### Non-goals

<Things explicitly NOT in scope.>

- Example: no offline mode in v1.

<!-- getff:end section=passport -->

## Stack

<The project's actual stack — fill from the real dependency tree.>

- **Runtime:** <runtime + version>
- **Language:** <language + strictness profile>
- **Framework:** <web framework, if any>
- **Persistence:** <database + access layer, if any>
- **Tests:** <runner + property-based / mutation tooling, if any>
- **Lint / format:** <linter + formatter>
- **CI:** <CI system + required checks>

## Source-of-truth pointers

- DB schema: `<path in this repo>`
- API contract: `<path in this repo>`
- Rules (enforced): `.ai-factory/RULES.md`
- Layer rules: `.ai-factory/ARCHITECTURE.md`

## Workflow

Before every commit / PR, run the gate this installer ships (unconditional — needs no extra install):

- `./scripts/audit-ai-docs.sh` — drift + code-vs-docs probes.
- the git pre-push hook fires on `git push` — getff's own rule checks (rule-glob liveness, lint-staged resolution, generated-rule firing, command/script check liveness, changed-Markdown links), not your typecheck or tests. Where it installs depends on the lane: `.husky/pre-push` on the npm stacks, `.getff/hooks/pre-push` on the python lane; the cargo and go lanes install no pre-push hook yet — the script above is their local gate.
- CI gates the PR (`ci-success` required check) — the last-resort authority, independent of local tooling.

For the lifecycle past install — First Steps per install depth, the daily cycle, and what degrades when a capability is absent — see `.ai-factory/AI-USAGE-GUIDE.md`.

Don't bypass the pre-push hook with `--no-verify` where your install ships one, and don't skip `./scripts/audit-ai-docs.sh`. If a rule is genuinely incompatible — discuss it, don't silently skip.

## NDA / security

<Project-specific security rules. Examples:>
- Never commit `.env*` files except `.env.example`.
- All secrets accessed via the secrets manager, never inline.
- PII fields: <list>. Encrypted at rest + in logs.
