# Kickoff — framework must liveness-test its OWN shipped agents/capabilities (root cause of #551)

> **Type:** full-cycle R-phase → spec → plan → impl. Self-contained.
> **Branch base:** `staging`. **Related:** #550 (post-install functional acceptance), #551, #552.

## The gap (root cause, not a symptom)

#551 happened because the framework **validated its own anti-hallucination sub-agents by prose audit** — prior audits called `agents/*.md` "cross-provider-safe" and "minimal and accurate" ([research-patches/2026-05-12-§13.31-...audit-research.md:198](../../../docs/meta-factory/research-patches/2026-05-12-§13.31-project-theatre-audit-research.md); [2026-05-16-skills-agents-audit.md:135,146](../../../docs/meta-factory/research-patches/2026-05-16-skills-agents-audit.md)) — but **never ran them**. So 5 agents shipped that fabricate on dispatch. The project's own thesis — «documents lie; tests don't; every rule is an executable artifact» ([README.md#why-this-exists](../../../README.md)) — was **not applied to its own shipped artefacts**. `npm run validate` is green while the agents are dead. This is the `#recursive-self-application-gap` ([phase-research-coverage.md §4](../../rules/phase-research-coverage.md)) at the framework's own delivery layer.

## Goal

A mechanism that proves every **shipped capability** (sub-agents, skills, hooks, mutation gate, custom rules) actually *works* in a consumer — not just "file is present / frontmatter parses". «Looks fine, registers, silently does nothing» must fail at the earliest reachable channel.

## Scope (research first — no premature build)

- **R-phase:** survey best-practices + anti-patterns for agent/capability **liveness testing** (not unit tests — does the dispatched thing actually use its tools / does the gate actually fire). Prior art: #550 meta-proposal (post-install smoke), #551 suggested guardrail (tools-name allow-list), AIF self-tests. Run BFR-default search (DeepWiki + WebSearch ≥3 phrasings) before any BUILD.
- **Candidate channels (do NOT pre-decide — that's the R-phase output):**
  - cheap deterministic **gate**: every `agents/*.md` `tools:` entry ∈ known CC tool-name allow-list (catches #551 exactly; CC-specific — weigh vs agnosticism).
  - **liveness probe**: post-install smoke that actually dispatches each shipped agent / fires each gate and asserts `tool_uses>0` / exit code (agnostic in spirit; bigger; ties to #550).
- **Constraint:** no paid LLM in CI ([no-paid-llm-in-ci.md](../../rules/no-paid-llm-in-ci.md)) — any dispatch-based probe is session-bound/operator-run, never a GitHub Action.

## Acceptance (R-phase)

- Research-patch under `docs/meta-factory/research-patches/` with the survey + verdict (gate vs probe vs both), prior-art cited by SSOT ID, and a concrete mechanism proposal with promotion criteria.
- Explicit recursive-self-application note: how the mechanism would have caught #551.

## §AI-traps (per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active traps: **T2** (designing the methodology ≠ running it — the audit must actually dispatch agents), **T11/T12** (prior-art + literature search before "I propose a gate"), **T15** (self-application mandatory — does the proposed mechanism test ITSELF?), **T16** (pattern-matching-on-name — a check named "validate" that doesn't run the artifact), **T1/T14** (don't conclude "covered" from a shallow sample).
Domain-specific: **T-liveness-A** — «proposing a name-allowlist gate and calling liveness *solved*» — a valid-name `tools:` still doesn't prove the agent *uses* the tools; distinguish form-check from behaviour-check explicitly.

## References
- #550 (tracking), #551 (the incident), #552 (prober shipping).
- [phase-research-coverage.md §4](../../rules/phase-research-coverage.md) `#recursive-self-application-gap`; [ai-laziness-traps.md](../../rules/ai-laziness-traps.md) `#discipline-theatre` family.

<!-- host-verify: none — R-phase research-first kickoff (own Scope: research first — no premature build): deliverable is the research patch; the build stages live in the m1/m2/postinstall kickoffs that carry their own contracts -->
