---
paths:
  - ".github/workflows/**"
  - ".github/actions/**"
---

# No paid LLM in CI — discipline rule

<!-- globs: .github/workflows/**, .github/actions/** -->
<!-- inject: No paid LLM in CI. API-billed calls in .github/workflows/ violate policy. See §4 escape hatch for authorized override. -->
<!-- glob-liveness: allow .github/actions/** no composite action exists yet in this repo; scope is forward-declared for when one ships (CTX Stage 1 render-rule-index.mjs liveness check) -->

> **Class:** A — companion principle test shipped at [packages/core/principles/17-no-paid-llm-in-ci.test.ts](../../packages/core/principles/17-no-paid-llm-in-ci.test.ts) (#132/#133, 2026-05-22); deterministic grep over `.github/workflows/*.yml` for paid-API-LLM usage (Track 3 §3.4 mechanism, DN-6).
> **Fires:** editing `.github/workflows/**` or `.github/actions/**`.
> **Authoritative for:** no-paid-LLM-in-CI policy rationale, scope (CI/GH Actions surface), escape-hatch process (explicit operator override per session with rationale), AI-agnostic sub-agent fallback pattern.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../README.md#why-this-exists). Companion invariant declaration — see [README.md §What must not break](../../README.md).

> **Origin:** 2026-05-12. Wave 8 substantive compliance research surfaced the policy via operator dialogue; codified in repo following the post-Wave-9 memory-to-docs codification audit ([docs/meta-factory/research-patches/2026-05-13-memory-to-docs-codification-audit.md](../../docs/meta-factory/research-patches/2026-05-13-memory-to-docs-codification-audit.md)).

## §1 The policy

No API-billed LLM calls in CI/GH Actions infrastructure beyond the operator's existing Claude Code Max subscription. Any semantic LLM check ships as an AI-agnostic sub-agent (markdown prompt file under `agents/*.md`) consumed by an active AI session running on the operator's or consumer's own Claude Code / Cursor / Codex / Aider subscription. No proxy billing.

## §2 Scope

- **In scope:** `.github/workflows/*.yml`, any CI-side automation, scheduled/cron-triggered jobs, background services tied to the repo.
- **In scope:** any binary or script invoked from CI that calls Anthropic API / OpenAI API / Claude SDK / `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`.
- **Out of scope:** session-bound LLM use (operator running `claude` CLI; consumer running `/aif-verify` inside their Claude Code session) — these are subscription-bundled, not paid-API.
- **Out of scope:** context7 MCP queries inside active sessions (free tier).

## §3 Why

Operator (2026-05-12) confirmed «если это платно — то этого не будет» as project-wide policy across entire roadmap, including future Phase 9+ / Phase 10+ initiatives where earlier specs assumed «LLM v2 invocation in L2/L3/L4 = Gate 5 fires». See [docs/meta-factory/research-patches/2026-05-11-llm-usage-audit.md](../../docs/meta-factory/research-patches/2026-05-11-llm-usage-audit.md) for cost classification.

The policy prevents silent recurring cost: a CI-side LLM call costs $X per invocation × frequency × developers, billable to the project regardless of who pushed. Subscription bundles distribute cost to the operator individually.

## §4 Escape hatch

Operator may explicitly override the policy **per session** with rationale:

> «I am authorizing paid LLM in CI for <specific task> at <budget cap>, valid until <date or condition>.»

Override is not durable. Subsequent sessions assume policy = active unless re-authorized. The override is **not committed** as a project change without a separate maintainer-edit PR that updates this rule + README invariant in tandem.

## §5 How to apply

When designing any new discipline / CI gate / automation:

1. Ask: «does this require an API key with billing to function?» If yes → reject design; seek AI-agnostic alternative.
2. AI-agnostic alternatives in order of preference:
   - Deterministic check (regex, AST, grep, bash test) — no LLM at all.
   - AI-agnostic sub-agent prompt under `agents/*.md` — read by active session, not invoked from CI.
   - Mark as «deferred — depends on policy change» in `open-questions.md` if neither option fits.
3. When classifying new triggers in `open-questions.md §13.x`: «LLM in CI» = **DEFER-permanent** under this policy, not «armed-and-waiting».

## §6 Anti-patterns

- **`#paid-llm-creep`** — adding a workflow step that calls Anthropic / OpenAI API directly, hidden behind a feature flag or «opt-in» env var. Even opt-in becomes default-by-precedent once it lands. Counter: pre-merge grep on workflow diffs for API call patterns.
- **`#subscription-conflation`** — treating «consumer's Claude Code subscription» as guaranteed; framework cannot assume consumer-side subscription. Hybrid LLM use must degrade gracefully to deterministic check if no subscription detected.
- **`#policy-bypass-via-cron`** — moving paid LLM call out of `.github/workflows/` into an external cron/scheduled service. Same cost, different invoice. Counter: scope §2 covers «background services tied to the repo».

## §7 Cross-references

- [README.md §What must not break](../../README.md) — invariant declaration (commit 2 of memory-codification PR).
- [docs/meta-factory/research-patches/2026-05-11-llm-usage-audit.md](../../docs/meta-factory/research-patches/2026-05-11-llm-usage-audit.md) — full inventory of LLM touchpoints with cost classification.
- [agents/compliance-verifier.md](../../agents/compliance-verifier.md), [agents/review-sidecar.md](../../agents/review-sidecar.md), [agents/living-docs-auditor.md](../../agents/living-docs-auditor.md) — AI-agnostic sub-agent pattern precedents.
- [docs/meta-factory/open-questions.md §13.10#4](../../docs/meta-factory/open-questions.md) — Gate 5 re-classification under this policy.
