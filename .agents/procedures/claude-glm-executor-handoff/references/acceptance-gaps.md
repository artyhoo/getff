# GLM acceptance gaps and provenance

> **Authoritative for:** the scoped glm acceptance gaps and provenance detail routed from [the skill card](../SKILL.md).
> **NOT authoritative for:** skill activation, shared gates, or project goal; those remain with the card and its declared owners.

## §5 Honest gaps — designed-not-proven

Per `night-mode` §5 (empirical-over-inferred) — the following claims about GLM-5.2-as-executor are **plausible but not yet probed end-to-end in this repo**:

1. **Status-field reliability.** Whether GLM-5.2 reliably emits parseable `DONE`/`BLOCKED`/`PARTIAL` status fields when asked is **assumed from the function-calling spec, not tested**. A live probe (dispatch 5 GLM tasks, count status-field parse failures) is the precondition for trusting §3.
2. **Tool-loop convergence.** Whether GLM-5.2 actually converges inside the `<constraints>` iteration cap on real agentic tasks, vs. looping until capped, is **asserted from pricing model, not measured**.
3. **Capability delta Sonnet vs GLM-5.2.** The 3-tier routing assumes Sonnet > GLM-5.2 on the relevant axes (so Sonnet-as-bottom-up-reviewer is a capability gate, not peer review). Public benchmarks put GLM-5.2 in the same rough tier as Sonnet on many axes. If on the maintainer's task mix GLM ≈ Sonnet, the routing reduces to peer review with fresh context — `night-mode`'s single-tier-harness collapse rule covers that case, but the framing here must be honest about it. Run a blind comparison (3 task classes, both models, fixed rubric) before treating Sonnet-as-reviewer as a capability gate.
4. **Per-agent `model:` frontmatter in one aif container.** §1 D3 claims aif supports Opus-coordinator + GLM-worker in the same container via per-agent `model:` frontmatter. The two cited sources (`2026-06-02-aif-parallel-dispatch-design.md:64` + `agent-collision-resolution/kickoff.md:21`) prove aif loads agent definitions with frontmatter AND that aif runs per-task model — but the **leap to "mixed models in one container via `model:` frontmatter"** is inference from maintainer experience, not directly verified in those citations. A live probe (one aif container with two agents on different `model:` values, both invoked in one run) is the precondition for trusting §0's framing.
5. **GLM must NOT be a coordinator.** This skill assumes the coordinator is Claude-family (Opus or Sonnet). GLM-5.2 as coordinator is out of scope: parsing `BLOCKER: advisor-consult:` prefixes, routing on them, dispatching advisor subagents — these are exactly the tool-call-reliability claims that §5 #1 and #2 mark as unproven. Keep GLM worker-only.

**Promotion criterion:** before this skill is trusted in production, each of #1–#4 should be backed by a research patch in `docs/meta-factory/research-patches/` recording a live probe. #5 is a usage guard, not a probe target. Until then, treat the GLM-edge contract as **designed-not-proven**, matching `night-mode`'s own stated posture on non-CC harnesses. The verified facts in §1 stand independently (sourced from Z.ai docs); the contract sections (§2–§4) are the designed-not-proven parts.

## See also

- [`.claude/skills/night-mode/SKILL.md`](../../night-mode/SKILL.md) — tier posture + advisor strategy + verification discipline this skill subordinates to.
- [`agents/orchestrator-worker-discipline.md`](../../../../agents/orchestrator-worker-discipline.md) — REPORT output schema (Status: DONE|BLOCKED|PARTIAL) consumed by §3; reviewer-discipline layer (GO/REVISE/STOP) referenced by §4.
- `superpowers:subagent-driven-development` (SSOT #64) — the dispatch loop this skill is a thin adapter over.
- [`.claude/rules/source-before-shape.md`](../../../rules/source-before-shape.md) — the rule this skill was authored under.
- [`docs/meta-factory/research-patches/2026-07-18-claude-glm-executor-handoff-facts.md`](../../../../docs/meta-factory/research-patches/2026-07-18-claude-glm-executor-handoff-facts.md) — research provenance: verified-facts sweep, refuted-folklore log, probe design.
- [Z.ai GLM-5.2 docs](https://docs.z.ai/guides/llm/glm-5.2) · [concept-param](https://docs.z.ai/guides/overview/concept-param) · [thinking-mode](https://docs.z.ai/guides/capabilities/thinking-mode) · [function-calling](https://docs.z.ai/guides/capabilities/function-calling) · [pricing](https://docs.z.ai/guides/overview/pricing) — primary sources for §1.

## Original framing (historical; mixed-model support remains inferred)

A **thin adapter** for the narrow case where an in-aif Claude coordinator dispatches to a GLM worker (executor tier glm-5.3). aif-handoff supports per-agent `model:` frontmatter natively (`implement-coordinator` → Opus, `implement-worker` → glm-5.3 — verified per `docs/superpowers/specs/2026-06-02-aif-parallel-dispatch-design.md:64` live `model=sonnet, transport=cli` and `settingSources:["project"]` per `agent-collision-resolution/kickoff.md:21`). This skill tells the coordinator **how to write the prompt** for that GLM worker; aif's agent definition tells aif **which model to spawn**. Both are needed; this owns only the prompt side.
