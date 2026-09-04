# Kickoff — M2 probe: shipped-agent behavioural liveness (Stage 2, Phase 2 of shipped-artifact-liveness-gap)

> **Type:** I-phase (build-only). Single buildable task. Base: `staging`.
> **Context:** R-phase PR #566 (verdict Option C phased). Phase 1 (M1 gate) shipped #576. This is **Phase 2 = M2 probe**.
> **MAINTAINER DIRECTIVE (binding):** **BUILD the probe artifact NOW, but do NOT run it.** It ships **DORMANT** — a ready, operator-run probe that is NOT yet a mandatory step. It activates only when its §5.2 promotion trigger fires (a 2nd dispatch-fabrication incident, OR #550 post-install acceptance ships — whichever first). Both triggers are currently UNFIRED (#550 open; only #551 recorded).

## What M1 leaves uncovered (why this exists)

M1 (the gate, shipped #576) checks that shipped agents' `tools:` NAMES are CC-canonical — a **form-check**. It does NOT prove an agent with valid names actually **uses** its tools when dispatched (the T-liveness-A residue). M2 is the **behaviour-check** that closes that gap. Because running it = an LLM dispatch, it is **session-bound, operator-run, NEVER a GitHub Action** ([no-paid-llm-in-ci.md §1](../../rules/no-paid-llm-in-ci.md)).

## Goal

A **dormant, ready-to-run** behavioural liveness probe for the framework's shipped sub-agents — an AI-agnostic prompt (+ fixtures) that, **when an operator runs it**, dispatches each shipped agent against a fixture task and asserts an observable signal: `tool_uses > 0` and/or a RED→GREEN delta (the agent fails the fixture **without** its tools, succeeds **with** them).

## Scope — ADAPT #115, do NOT build new (BFR)

The RED→GREEN, fresh-subagent-per-pass machinery already exists in [`agents/manual-rule-liveness-prober.md`](../../../agents/manual-rule-liveness-prober.md) (SSOT #115). **ADAPT it**: copy its structure into a new `agents/shipped-agent-liveness-prober.md` and **retarget** it from «manifest manual rule» → «shipped sub-agent». Do NOT design a parallel mechanism from scratch.

## Deliverable (build-only)

1. **`agents/shipped-agent-liveness-prober.md`** — the probe prompt (ADAPT of #115). It must:
   - Enumerate the **shipped** sub-agents — the install.sh-copied surface (mirror the enumeration already in `packages/core/principles/21-shipped-agent-tools-valid.test.ts`, which excludes authoring-only agents per #552). Do NOT hardcode a list that can drift; reference the shipped surface.
   - For each, describe the dispatch + the observable assertion (`tool_uses > 0` and/or RED→GREEN).
   - Carry a **DORMANCY header**: «Status: DORMANT — not a mandatory step. Promotion trigger (§5.2 of research-patch 2026-06-16): 2nd dispatch-fabrication incident OR #550 post-install acceptance ships. NEVER runs in CI (no-paid-llm).»
2. **Fixtures** — a minimal per-agent task scenario (markdown/JSON data, NOT code under `packages/`) that genuinely requires the agent's tools, so the RED→GREEN delta is real.
3. The probe is **AI-agnostic prose** (like #115), session-bound — NOT wired into any CI workflow, NOT a principle test.

## Build-only discipline (CRITICAL — do NOT run the probe)

- **Do NOT live-dispatch the shipped agents** as part of building this. Building = authoring the prompt + fixtures. *Running* the probe (actually dispatching agents, spending LLM) is the operator's deferred step, gated on the trigger.
- A **static** build-time sanity is allowed and encouraged: the prompt is well-formed, the fixtures parse, the enumerated agents exist, the assertions are concrete. That is NOT «running the probe» — it's checking the artifact is well-built.
- Behavioural validation (does the probe actually catch a dead agent?) is **deferred to first operator run** — that is inherent to a Class-C session-bound probe (it cannot be CI-tested; that is WHY M1 is the CI gate and M2 is the operator probe). Note this honestly in the artifact; do NOT fake a «verified RED→GREEN» that required no real dispatch (that would be `#discipline-theatre`).

## NOT in scope (defer / do not build)

- Do NOT run the probe / dispatch any shipped agent for real.
- Do NOT wire it into CI / GitHub Actions (no-paid-llm — it is operator-run by design).
- Do NOT make it a mandatory step or a principle test — it ships DORMANT.
- Do NOT re-touch M1 (the gate, already shipped #576) or the 6 agents (already canonical via #571).
- Do NOT add a code module ≥80 LOC under `packages/` (keep it agent-prose + data — this is a Class-C prose artifact, not a capability commit). If a runner script feels necessary, PARK the question rather than building one.

## §AI-traps active (per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active: **T2** (designing ≠ running — but here the inverse: build the ARTIFACT, do not run the probe; produce a concrete prompt+fixtures, not a vague «would dispatch» description), **T5** (stay in scope: probe artifact only, no live runs, no CI wiring), **T13/T16** (ADAPT #115 deliberately — verify its RED→GREEN machinery transfers to «shipped sub-agent» problem class; name the match explicitly), **T15** (the probe is the framework probing its OWN shipped artefacts — recursive self-application; note how it would have caught #551 behaviourally, not just by name).
Domain-specific: **T-M2PROBE-A** — «building it = a licence to run it once to 'prove' it works». NO. The maintainer directive is build-only-dont-run; a single 'just to test' live dispatch IS running the probe (cost + premature). Static sanity only; behavioural proof is the operator's deferred first run.

## Autonomous-dispatch park contract (aif-handoff executor — read this)

You are dispatched autonomously to BUILD the dormant probe artifact. Non-negotiable:

**Park-don't-guess:** on ANY genuine fork or ambiguity, do NOT pick — **park it as a question** (set the task to `manualReviewRequired` / `blocked_external`, state it «Option A → consequence X / Option B → consequence Y») and stop; proceed only on the unambiguous parts. Likely-park triggers: (a) a fixture genuinely needs a runner script ≥80 LOC under `packages/` (would make this a capability commit — park, don't silently build it); (b) the shipped-agent enumeration is ambiguous (which agents are «shipped» vs authoring-only); (c) #115's structure doesn't cleanly retarget and a real design choice appears. BUILD-only and DORMANT are DECIDED — not forks.

**Capability-park:** if building a faithful ADAPT of #115 requires actually dispatching an agent to verify, **do NOT** — that is running the probe, explicitly out of scope. Park instead with «behavioural validation requires a live dispatch, which is the operator's deferred step».

Deliverable = the probe prompt + fixtures, committed on your task branch, marked DORMANT. Egress (push/PR + §1.7 body) is the orchestrator's job via harvest — not yours.

## See also
- `agents/manual-rule-liveness-prober.md` (#115) — the ADAPT source.
- `docs/meta-factory/research-patches/2026-06-16-shipped-artifact-liveness.md` §4 M2 / §5.1 / §5.2 (trigger) — binding research.
- `packages/core/principles/21-shipped-agent-tools-valid.test.ts` (#576) — the M1 gate this complements; reuse its shipped-surface enumeration.

<!-- host-verify: none — build-only prose deliverable (own §Deliverable: agents/shipped-agent-liveness-prober.md + data fixtures, DORMANT by design, never runs in CI): the enforced machine surface is principle 21 (21-shipped-agent-tools-valid.test.ts) in the m1-gate contract -->
