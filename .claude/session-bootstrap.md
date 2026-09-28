# Session bootstrap — read first

> **Trigger:** every session start, before any other action.
> **Why:** persists project goal + invariants across context compaction. Implements AIF Step 0 / Cline re-read pattern — more robust than CLAUDE.md compaction-block which depends on compactor cooperation.
>
> **Authoritative for:** operational restatement of project goal + invariants for AI session start; reading order; reviewer drift-prevention check.
> **NOT authoritative for:** project goal, methodology, design invariants — see [README.md#why-this-exists](../README.md#why-this-exists). This file's goal section delegates upward — it cannot drift because it is a pointer.

## Goal (do not redefine)

AI agents can't silently bypass undocumented conventions. Every rule is an executable artifact that fails at the earliest reachable channel — edit-time → pre-commit → pre-push → CI → production audit. **CI = last-resort gate.** See [README.md#why-this-exists](../README.md#why-this-exists) for full statement and «what must not break» invariants.

## Methodology (do not elevate to goal)

Recursive self-application — framework validates itself via own logic. Quality signal (GCC bootstrap precedent, `rustc` compile-self analogy), not the project's goal.

## Invariants

The invariant list lives in one place: [README.md «What must not break (invariants)»](../README.md#what-must-not-break-invariants). This file does not restate it. The session digest's `Invariants:` line (injected on every prompt and subagent start by [`.claude/hooks/inject-session-bootstrap.sh`](hooks/inject-session-bootstrap.sh)) is rendered from that README block by [`scripts/render-invariants.mjs`](../scripts/render-invariants.mjs); `--check` fails at pre-push (`invariants-render` section) and in CI (the hook's vitest suite) whenever the two differ.

## Project anchor (digest block)

One compact anchor for every fresh agent and subagent. Consumed by the digest hooks
(`inject-project-digest` on UserPromptSubmit; `inject-subagent-context` prepends it to each
ZCode subagent's prompt; `inject-subagent-digest` serves the same role on CC) — the block
between the markers below is extracted verbatim, so keep it self-contained and short.
Empty block = hooks no-op by design (zero-setup default).

<!-- digest:start -->
Project: rules-as-tests-aif — a framework repo that is self-hosting (it enforces its own rules on itself). Goal SSOT: README.md#why-this-exists — never redefine the goal here or in task docs.
Repo map: README.md (goal) → .claude/session-bootstrap.md (this anchor, reading order) → CLAUDE.md (AI-tooling conventions) → .claude/rules/*.md (discipline rules; index: 00-rule-index.md) → docs/meta-factory/prior-art-evaluations.md (build-vs-reuse SSOT) + EXECUTION-PLAN.md → packages/core/ (enforcement machinery: principles meta-tests, synthesizer) → docs/meta-factory/research-patches/ (dated evidence records).
Hard pointers: keep `make self-audit` green (recursive self-application); every capability commit carries a build-vs-reuse verdict (`Prior-art:` trailer); hooks SSOT is `.claude/hooks/*.sh` — ZCode consumes rendered plugin twins, edit the source, never the twin; new research patches require a §1.7 self-review section; staging PRs carry `## Fidelity verdict` + §1.7 Forward/Backward-check sections; agent must not edit `.claude/settings.json`.
<!-- digest:end -->

## Reading order for new context

1. **[README.md](../README.md)** — goal hierarchy (authoritative for goal / methodology / invariants)
2. **This file** — operational restatement for current session
3. **[CLAUDE.md](../CLAUDE.md)** — AI-tooling conventions + Artifact Ownership Contract
4. Task-specific docs (EXECUTION-PLAN, retros, research, prior-art-evaluations) — **operational**, NOT goal-redefining

## Reviewer drift-prevention check

When evaluating any doc claim that reads as «authoritative for the project», apply this:

```mermaid
flowchart LR
    R[Reading any doc] --> A{Does README<br/>own this claim?}
    A -->|README owns it| C[Use README<br/>as source]
    A -->|Other doc owns it<br/>within its scope| B[Apply only<br/>within scope]
    B --> D[Reach verdict<br/>against README goal]
    C --> D
```

If you find yourself reasoning under a goal that contradicts README — stop. The contradicting doc has drifted, not README. Surface as a coverage-gap patch under [docs/meta-factory/research-patches/](../docs/meta-factory/research-patches/).

## When this file needs updating

- New invariant added to project — edit README.md only; the digest line is re-rendered from it (pre-commit re-renders it when README.md is staged; by hand: `node scripts/render-invariants.mjs --write`)
- Reading order changes (e.g. new always-loaded doc adopted) — update list
- Reviewer drift-prevention pattern evolves — update Mermaid

**Do not modify the goal/methodology sections** — they delegate to README. If README changes, this file is automatically stale until refreshed manually.
