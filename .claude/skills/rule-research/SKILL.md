---
name: rule-research
description: Use when a consumer wants to bootstrap stack-aware ESLint rules from LIVE documentation rather than ship pre-baked recipes — research a stack's best-practices / anti-patterns into an executable rule + firing test via the rule-bootstrapping bridge. Triggers: rule research, research stack practices, generate eslint rule from docs, bootstrap rules for my stack, rules-research, rule-bootstrapping, no-head-element, исследовать практики стека, сгенерировать правило из документации.
---

<!-- @dual-pair: rule-research-protocol -->
<!-- spec: agents/rule-researcher.md -->

# rule-research

> **Authoritative for:** the Claude Code trigger for the rule-research protocol — a thin wrapper; the canonical, AI-agnostic protocol lives in `agents/rule-researcher.md`.
> **NOT authoritative for:** project goal — see README.md#why-this-exists; the protocol itself (detection, the L4-expressibility filter, provenance discipline, file contract) — see `agents/rule-researcher.md`.

This skill is a thin entry point. The full protocol — detect stack → research practices from canonical docs (context7 + deepwiki + a real fetch) → author a `ResearchPlan` + `GenerateSelection` filtered to L4-expressible rules → write two committed JSON files — is `agents/rule-researcher.md`. Follow it directly; this wrapper exists only so the protocol is reachable by a Claude Code trigger without duplicating its logic (single source of truth, per `dual-implementation-discipline.md §7`).

Provenance for every researched practice is gated by the tiered trust model — see [`.claude/rules/research-source-trust.md`](../../rules/research-source-trust.md) for the discipline (Tier 0 builtin / Tier 1 derived from a direct dependency's own metadata / Tier 2 consumer-acked) and `agents/rule-researcher.md`'s "Trust tiers" table for the per-practice mechanics.

## Run-moment provenance check {#research-run}

Before authoring a provenance entry against a live research source, re-check `resolveAllowedSources`/`validateProvenance` (`packages/core/research/allowlist-resolver.ts`) resolves it — a source that fails Tier 0/1/2 fails closed, it does not silently pass through.

To run: open `agents/rule-researcher.md` and execute its numbered protocol against the current project, then run `./setup --full` to synthesize the researched rules.

## Without this skill

An agent researching a stack's practices hand-authors ESLint rules ad-hoc — with unverified provenance and no L4-expressibility check — and ships inert "manual" rules that pass validation **without a firing test**, the discipline-theatre this project exists to eliminate. Fresh, stack-specific knowledge that lives only in live docs is missed because the agent works from stale training data.

## With this skill

The agent follows `agents/rule-researcher.md`: it fetches canonical official docs (quoted provenance), proposes a rule **only** when the practice is a single-file forbid-selector with a single-token-diff pair, and writes two committed JSON files. The deterministic factory turns them into an executable rule + firing test — or records a research-only finding when a practice is not L4-expressible. Every shipped rule is provably non-vacuous.
