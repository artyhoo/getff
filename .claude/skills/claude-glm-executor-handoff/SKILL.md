---
name: claude-glm-executor-handoff
description: Use when an in-aif Claude coordinator (Opus or Sonnet, e.g. `implement-coordinator` / `plan-coordinator`) is about to dispatch an executable task to a GLM-5.2 worker (any agent with `model: glm-5.2` or a GLM-family model in its frontmatter). Triggers: writing a dispatch prompt for a GLM worker inside aif-handoff, "GLM executor", "implement-worker GLM", cross-model dispatch within aif, planning a handoff to GLM-5.2, parsing a GLM worker's REPORT back into the coordinator loop. Owns the input-prompt contract for that cross-model edge + GLM-5.2-specific behavioural deltas (text-only I/O, reasoning_effort modes, function-calling shape). Does NOT own: tier posture (night-mode owns), the dispatch loop (SDD owns), the REPORT output schema (orchestrator-worker-discipline owns). NOT for Claude→Claude worker dispatch (use SDD directly — same provider, no contract divergence).
---

> **Authoritative for:** the **input-prompt contract** for an in-aif Claude coordinator (Opus/Sonnet) → GLM-5.2 worker dispatch edge, and the **GLM-5.2-specific behavioural deltas** (verified facts only — text-only I/O, `reasoning_effort` value-collapse, Anthropic-compat endpoint mechanics) that distinguish such a handoff from an intra-Claude worker dispatch.
> **NOT authoritative for:** the executor + dual-reviewer dispatch **loop** — that is `superpowers:subagent-driven-development` (SSOT #64). The **relative-tier model posture** (Opus/Sonnet/GLM as an instantiation of "top/mid/cheaper" tier roles) — that is [`night-mode/SKILL.md`](../night-mode/SKILL.md) §1; this skill assumes the instantiation without restating it. The **REPORT output schema** (`Status: DONE|BLOCKED|PARTIAL`, `Deliverable`, `Evidence`, `BLOCKER`, `MINOR`) — that is [`agents/orchestrator-worker-discipline.md`](../../../agents/orchestrator-worker-discipline.md). **Dispatch mechanics** (REST, worktrees, agent-definition loading) — that is `dispatcher` + `runtime-bridge`. Project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).

# Claude → GLM executor handoff (in-aif, cross-model edge)

A **thin adapter** for the narrow case where an in-aif Claude coordinator dispatches to a GLM-5.2 worker. aif-handoff supports per-agent `model:` frontmatter natively (`implement-coordinator` → Opus, `implement-worker` → GLM-5.2 — verified per `docs/superpowers/specs/2026-06-02-aif-parallel-dispatch-design.md:64` live `model=sonnet, transport=cli` and `settingSources:["project"]` per `agent-collision-resolution/kickoff.md:21`). This skill tells the coordinator **how to write the prompt** for that GLM worker; aif's agent definition tells aif **which model to spawn**. Both are needed; this owns only the prompt side.

## §0 When this fires (and when it does NOT)

**Applies** to a dispatch edge inside aif-handoff where:

- The coordinator agent runs on a Claude-family model (Opus or Sonnet), AND
- The worker agent's frontmatter sets `model:` to a GLM-family model (GLM-5.2 / GLM-4.6 / etc.).

**Does NOT apply** to:

- **Claude→Claude worker dispatch** inside aif (Opus coordinator → Sonnet worker, etc.) — same provider, similar distribution; SDD + `night-mode` cover this directly. The contract below is overkill for intra-Claude edges.
- **Tier selection** — which model fills which role is owned by `night-mode` §1.
- **aif dispatch mechanics** (worktrees, REST, agent spawning) — owned by `dispatcher` + `runtime-bridge`.

If you catch yourself applying this to a Claude→Claude edge, stop — you are doing `#parallel-evolution-creep` on SDD.

## §1 GLM-5.2 facts (verified, source-grounded)

Each row carries its primary source. Re-verify before relying on a row — Z.ai doc paths migrate (`/api/paas/v4/` vs `/api/coding/paas/v4/`) and `reasoning_effort` is GLM-5.2-only (present-tense per spec; future models unverified).

| #      | Delta                                           | Source-grounded fact                                                                                                                                                                                                                                                                                                                                                                                                                                 | Implication for the dispatch prompt                                                                                                                                                                                                                                                                                   | Source                                                                                                                                   |
| ------ | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **D1** | **Text-only I/O**                               | GLM-5.2 input and output are text-only. Images are handled by a separate **Vision MCP Server backed by GLM-4.6V** — a different model accessed via MCP, not GLM-5.2 itself.                                                                                                                                                                                                                                                                          | If the task involves a screenshot/mockup/diagram, the coordinator (Claude, which has vision) must describe the visual **as structured text** in `<context>`. Do not hand GLM an image path and expect it to work.                                                                                                     | [docs.z.ai/guides/llm/glm-5.2](https://docs.z.ai/guides/llm/glm-5.2) spec card                                                           |
| **D2** | **`reasoning_effort` ladder + value collapse**  | Accepted values: `max` \| `xhigh` \| `high` \| `medium` \| `low` \| `minimal` \| `none`. Default: `max`. **Effective behaviours collapse:** `medium` and `low` both map to `high`; `xhigh` maps to `max`; `none`/`minimal` skip thinking. **Distinct behaviours:** only `max`, `high`, `none`/`minimal`. Per-request toggle via `thinking: {type: "enabled"\|"disabled"}`. **GLM-5.2 only.**                                                         | Do not set `medium` expecting a middle tier — you silently get `high`. Route by task cost: routine/mechanical → `high` (saves latency); multi-step architectural or verification-heavy → `max` with explicit "plan, then execute, then verify" in `<task>`. Don't pay `max`-effort latency for boilerplate.           | [concept-param](https://docs.z.ai/guides/overview/concept-param); [thinking-mode](https://docs.z.ai/guides/capabilities/thinking-mode)   |
| **D3** | **Anthropic-compatible endpoint + aif profile** | `https://api.z.ai/api/anthropic` exposes GLM-5.2 behind a `/v1/messages`-shaped endpoint. Claude Code targets it via `ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic` + `ANTHROPIC_AUTH_TOKEN=<z.ai key>`. **Two endpoint classes**: (a) **GLM Coding Plan** (`/api/anthropic` Anthropic-shape AND `/api/coding/paas/v4` OpenAI-shape) — subscription-gated; (b) **Pay-as-you-go** (`/api/paas/v4/` OpenAI-shape only — no Anthropic equivalent). | The transport is solved by aif's runtime profile — set the profile to point at the Z.ai Anthropic endpoint and the in-aif Claude binary speaks to GLM as if it were Anthropic. **Per-agent model override** (Opus coordinator + GLM worker in one container) is aif-native via agent-definition `model:` frontmatter. | [devpack/quick-start](https://docs.z.ai/devpack/quick-start); [devpack/tool/claude](https://docs.z.ai/devpack/tool/claude); OpenAPI spec |
| **D4** | **Function-calling shape**                      | OpenAI-style `tools` + `tool_choice="auto"` + streaming tool args (`tool_stream=true`, GLM-4.6-and-above) + interleaved thinking between tool calls. Naming follows the standard OpenAI schema convention.                                                                                                                                                                                                                                           | Name every available tool explicitly in the dispatch prompt's `<tools>` block — do not rely on GLM inferring availability from context. This is _generic OpenAI-schema practice_, not GLM-specific; included because the cost of skipping it on a weaker-reasoning executor is higher.                                | [function-calling](https://docs.z.ai/guides/capabilities/function-calling); OpenAPI spec                                                 |
| **D5** | **Pricing model**                               | Per-million-tokens: $1.4 input / $4.4 output. **Or** flat $18/mo GLM Coding Plan subscription (for use inside Claude Code / Cline / etc).                                                                                                                                                                                                                                                                                                            | A stuck agentic loop **does** burn cost — via token volume, not via a fictional per-prompt multiplier (see §2 F2). State an explicit iteration/step cap in `<constraints>` for open-ended agentic dispatch regardless.                                                                                                | [pricing](https://docs.z.ai/guides/overview/pricing)                                                                                     |

### Refuted folklore (sidebar — do not re-import these claims)

| #      | Refuted claim                                                                          | Verdict                                     | Why cut                                                                                                                                                                                                                                                                               |
| ------ | -------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F1** | "Zhipu prescribes context-before-instruction ordering for the 1M-token window."        | **UNVERIFIABLE**                            | Z.ai's own [best-practice §2](https://docs.z.ai/devpack/resources/best-practice) and [GLM-5.2 guide](https://docs.z.ai/guides/llm/glm-5.2) emphasise structured task input but **never prescribe a positional ordering rule**. Generic long-context folklore mis-attributed to Zhipu. |
| **F2** | "GLM charges per 'prompt' (~15-20 underlying invocations per prompt)."                 | **REFUTED**                                 | [Pricing](https://docs.z.ai/guides/overview/pricing) is per-million-tokens or flat $18/mo. No documented "prompt" unit.                                                                                                                                                               |
| **F3** | "Tool-calling is reliable when tools are declared up front" (strong-reliability half). | **PARTIALLY CONFIRMED, marketing half cut** | Mechanics (OpenAI schema, explicit naming) verified — D4 carries those. The "strong agentic reliability" half is marketing language with no tool-use benchmark cited.                                                                                                                 |

## §2 Input contract for the GLM edge

When dispatching to a GLM worker, structure the **input** prompt with these six blocks. The **output** (REPORT schema) is owned by `agents/orchestrator-worker-discipline.md` — do not re-describe it.

```text
<task>         one atomic objective, single verb, single deliverable
<context>      only what THIS step needs — summarized, not raw-forwarded
<constraints>  hard boundaries + iteration cap (cost control; see §1 D5)
<tools>        every available tool named explicitly (see §1 D4)
<output>       require the REPORT Status field (DONE|BLOCKED|PARTIAL)
               per orchestrator-worker-discipline.md
<verify>       checkable pass/fail criteria the worker can self-run before returning
```

### Rules that matter most on the GLM edge

1. **Atomicity > detail.** A weaker-reasoning executor optimizes one goal; multi-goal prompts drift silently. If you wrote "and" between two kinds of work, split into sequential dispatches.
2. **Never forward raw conversation.** Summarize what's load-bearing for THIS step. GLM treats pasted chat artifacts as ambiguous instruction content, not inert background.
3. **REPORT `Status` field is mandatory.** Without it, the coordinator parses prose — the #1 multi-agent-handoff failure mode. Map the worker's reply through the REPORT schema (`DONE`/`BLOCKED`/`PARTIAL`); never accept unverified prose as success.
4. **One example > one paragraph.** Tasks with a "shape" (commit style, diff format, naming convention) — show one good instance. Different training distribution means abstract specs under-perform.
5. **Delimit instruction from data explicitly.** `<context>` content is **data**, not instruction. Critical when context includes file/web content the coordinator doesn't fully control.
6. **Verification is a separate reviewer pass.** A different agent (per `orchestrator-worker-discipline.md` reviewer-discipline layer) runs the `<verify>` criteria — do not trust the GLM worker's self-reported `DONE`. See §3.

This contract is not GLM-specific in shape — it applies to any weaker-reasoning executor-handoff. It lives here (not in `orchestrator-worker-discipline.md`) only because the GLM edge is the live use case; if a future second cross-provider executor appears, promote this section to `orchestrator-worker-discipline.md` as the input-side companion to its REPORT output schema, and leave only the GLM-specific deltas here.

## §3 Status translation (GLM reply → orchestrator REPORT)

The coordinator consumes the GLM worker's reply through the **REPORT schema** owned by `orchestrator-worker-discipline.md`:

| GLM reply shape                                                  | Map to REPORT `Status`                                                                                                           |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `<verify>` criteria all pass + artifact produced                 | `DONE`                                                                                                                           |
| Artifact produced but `<verify>` not self-passed, or partial     | `PARTIAL`                                                                                                                        |
| Cannot proceed (missing dep, signature conflict, ambiguous spec) | `BLOCKED` with the spec quote in the existing `BLOCKER:` field                                                                   |
| GLM returns a clarification request instead of an artifact       | treat as `BLOCKED` with `BLOCKER: <spec quote>` — do **not** silently retry, do **not** extend the REPORT schema with new syntax |

If GLM does not emit a parseable status, treat as `BLOCKED` (not as `DONE` — never accept unverified prose as success).

## §4 Recovery protocol

When the GLM worker returns a non-`DONE` status:

- **`PARTIAL`** → bottom-up reviewer (per `orchestrator-worker-discipline.md` reviewer-discipline layer) triages: is the gap mechanical (re-dispatch with sharper `<verify>`) or architectural (escalate to top-down reviewer for re-plan)? Cap re-dispatch at **2 iterations**; on the 3rd, escalate. This cap is stricter than `night-mode`'s per-increment 4-iteration cap (delta item 2) because cross-provider re-dispatch carries round-trip latency the intra-provider case does not.
- **`BLOCKED: <spec quote>`** → top-down reviewer (Opus tier per `night-mode` §1) re-plans the dispatch. The blocker is a signal that the original prompt was ambiguous, not that GLM is "dumb" — fix the prompt, do not repeat it. Cap clarification cycles at **2**; on the 3rd, the task is genuinely under-specified and needs a human.
- **`BLOCKED` (other)** → escalate to human or re-plan at the pipeline level. Do not retry blindly.

**Hard caps** (per-task, recorded in dispatch state):

- Re-dispatch (`PARTIAL`): max 2
- Clarification cycles: max 2
- Total tool-call iterations inside one GLM agentic dispatch: stated in `<constraints>` (typically 3–5)

A task that exceeds its cap is marked `BLOCKED` at the pipeline level and surfaced in the morning report (per `night-mode` terminal condition).

## §5 Honest gaps — designed-not-proven

Per `night-mode` §5 (empirical-over-inferred) — the following claims about GLM-5.2-as-executor are **plausible but not yet probed end-to-end in this repo**:

1. **Status-field reliability.** Whether GLM-5.2 reliably emits parseable `DONE`/`BLOCKED`/`PARTIAL` status fields when asked is **assumed from the function-calling spec, not tested**. A live probe (dispatch 5 GLM tasks, count status-field parse failures) is the precondition for trusting §3.
2. **Tool-loop convergence.** Whether GLM-5.2 actually converges inside the `<constraints>` iteration cap on real agentic tasks, vs. looping until capped, is **asserted from pricing model, not measured**.
3. **Capability delta Sonnet vs GLM-5.2.** The 3-tier routing assumes Sonnet > GLM-5.2 on the relevant axes (so Sonnet-as-bottom-up-reviewer is a capability gate, not peer review). Public benchmarks put GLM-5.2 in the same rough tier as Sonnet on many axes. If on the maintainer's task mix GLM ≈ Sonnet, the routing reduces to peer review with fresh context — `night-mode`'s single-tier-harness collapse rule covers that case, but the framing here must be honest about it. Run a blind comparison (3 task classes, both models, fixed rubric) before treating Sonnet-as-reviewer as a capability gate.
4. **Per-agent `model:` frontmatter in one aif container.** §1 D3 claims aif supports Opus-coordinator + GLM-worker in the same container via per-agent `model:` frontmatter. The two cited sources (`2026-06-02-aif-parallel-dispatch-design.md:64` + `agent-collision-resolution/kickoff.md:21`) prove aif loads agent definitions with frontmatter AND that aif runs per-task model — but the **leap to "mixed models in one container via `model:` frontmatter"** is inference from maintainer experience, not directly verified in those citations. A live probe (one aif container with two agents on different `model:` values, both invoked in one run) is the precondition for trusting §0's framing.
5. **GLM must NOT be a coordinator.** This skill assumes the coordinator is Claude-family (Opus or Sonnet). GLM-5.2 as coordinator is out of scope: parsing `BLOCKER: advisor-consult:` prefixes, routing on them, dispatching advisor subagents — these are exactly the tool-call-reliability claims that §5 #1 and #2 mark as unproven. Keep GLM worker-only.

**Promotion criterion:** before this skill is trusted in production, each of #1–#4 should be backed by a research patch in `docs/meta-factory/research-patches/` recording a live probe. #5 is a usage guard, not a probe target. Until then, treat the GLM-edge contract as **designed-not-proven**, matching `night-mode`'s own stated posture on non-CC harnesses. The verified facts in §1 stand independently (sourced from Z.ai docs); the contract sections (§2–§4) are the designed-not-proven parts.

## Without this skill

A Claude coordinator inside aif-handoff dispatches to a GLM-5.2 worker using a prompt written «as for another Claude» — and the cross-provider divergence silently corrupts the handoff: an image path is passed that GLM cannot read (D1); `reasoning_effort: medium` is set expecting a middle tier and silently behaves as `high` (D2); the worker's reply lacks a parseable status field and the coordinator either accepts unverified prose as success or stalls parsing freeform text; on a `BLOCKED` return the coordinator blindly retries the same prompt instead of re-planning. None of these failure modes are caught at the dispatch moment — they propagate to the next pipeline step.

## With this skill

The coordinator writes the dispatch prompt in the 6-block contract with explicit tool names, an iteration cap, and a required REPORT `Status` field; it describes images as structured text (D1), routes `reasoning_effort` by task cost with awareness of the value-collapse (D2), and treats the worker's reply through the §3 status-translation map. On non-`DONE` returns, the §4 recovery protocol caps re-dispatch and clarification cycles, escalates to top-down reviewer on architectural blocks, and surfaces under-specified tasks as `BLOCKED` rather than silently looping. The skill subordinates to `night-mode` for tier posture, `orchestrator-worker-discipline` for REPORT schema, and SDD for the dispatch loop — it owns only the GLM-specific input contract and behavioural deltas, plus an honest-gaps marker listing what is designed-not-proven until live probes land.

## See also

- [`.claude/skills/night-mode/SKILL.md`](../night-mode/SKILL.md) — tier posture + advisor strategy + verification discipline this skill subordinates to.
- [`agents/orchestrator-worker-discipline.md`](../../../agents/orchestrator-worker-discipline.md) — REPORT output schema (Status: DONE|BLOCKED|PARTIAL) consumed by §3; reviewer-discipline layer (GO/REVISE/STOP) referenced by §4.
- `superpowers:subagent-driven-development` (SSOT #64) — the dispatch loop this skill is a thin adapter over.
- [`.claude/rules/source-before-shape.md`](../../rules/source-before-shape.md) — the rule this skill was authored under.
- [`docs/meta-factory/research-patches/2026-07-18-claude-glm-executor-handoff-facts.md`](../../../docs/meta-factory/research-patches/2026-07-18-claude-glm-executor-handoff-facts.md) — research provenance: verified-facts sweep, refuted-folklore log, probe design.
- [Z.ai GLM-5.2 docs](https://docs.z.ai/guides/llm/glm-5.2) · [concept-param](https://docs.z.ai/guides/overview/concept-param) · [thinking-mode](https://docs.z.ai/guides/capabilities/thinking-mode) · [function-calling](https://docs.z.ai/guides/capabilities/function-calling) · [pricing](https://docs.z.ai/guides/overview/pricing) — primary sources for §1.
