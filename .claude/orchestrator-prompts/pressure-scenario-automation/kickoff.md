# Kickoff — auto-generate pressure-scenarios from rule text (unlock consumer rule-liveness-probing)

> **Type:** full-cycle R-phase → spec → plan → impl. Self-contained.
> **Branch base:** `staging`. **Related:** #552, SSOT #115 (manual-rule-liveness-prober), N5 give-back.

## Why this exists (the falsifier that flips the #552 decision)

Brainstorm conclusion (this session): `manual-rule-liveness-prober` stays a **factory tool**, NOT a consumer feature — because using it requires hand-authoring a **pressure-scenario** (a `baseline-prompt` + `observable-failure` + `observable-compliance`) per rule, and writing a *good* adversarial scenario is **expert work**. Evidence it's hard: the framework had to strengthen its own R10/R18 scenarios (authority+sunk-cost) after a non-failing time-only baseline (SSOT #115 / T-V3-B). A typical consumer would write weak scenarios → false "rule is dead" verdicts → worse than nothing.

**The explicit falsifier:** if an AI can **generate a strong pressure-scenario from the rule's text**, the expert barrier drops and consumer-facing rule-liveness-probing becomes viable. That is this track.

## Goal

A generator: input = a rule's policy text (e.g. a `.ai-factory/RULES.md` entry, a `.claude/rules/*` constraint); output = a validated `pressure-scenario` (the manifest shape: `baseline-prompt` / `observable-failure` / `observable-compliance` / `pressure ∈ {time,authority,sunk-cost,scope-creep}`) strong enough that a fresh agent fails RED without the rule and complies GREEN with it.

## Scope (research first)

- **R-phase:** survey how to generate **strong adversarial scenarios** — prompt-engineering for forcing-vectors, anti-patterns (the weak-trap → false-negative failure mode), and how to *validate* a generated scenario is actually pressuring (auto re-run RED→GREEN; reject scenarios where baseline doesn't fail). BFR-default search (DeepWiki + WebSearch ≥3 phrasings) — does AI Factory / Superpowers already generate test scenarios? (cf. SP `writing-skills` pressure-scenario methodology, SSOT #55/#115).
- **Open design questions for the R-phase (do not pre-answer):** who triggers generation (install-time? on-demand?); how generated scenarios are stored on the consumer side (consumer has no manifest today — #552 A); guardrail against weak auto-traps; cost (each validation = ≥2 dispatches, session-bound, no paid CI).
- **Dependency:** likely sits on top of the [shipped-artifact-liveness-gap](../shipped-artifact-liveness-gap/kickoff.md) track and the #552 consumer-manifest question.

## Acceptance (R-phase)

- Research-patch with: feasibility verdict, generation+validation design, anti-pattern catalogue (weak-trap detection), prior-art by SSOT ID, and an explicit statement of whether this flips #552 to "consumer-adapt the prober".

## §AI-traps (per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active traps: **T2** (designing a generator ≠ proving it generates *strong* traps — must run RED→GREEN on generated output), **T11/T12** (search for existing scenario-generators before BUILD), **T6** (no self-reported "high confidence" — quantify scenario strength by actual RED→GREEN pass-rate), **T16** (a generator that emits plausible-looking scenarios that don't actually pressure).
Domain-specific: **T-genscenario-A** — «accept a generated scenario because it *reads* adversarial» — every generated scenario MUST be auto-validated by an actual RED→GREEN dispatch (baseline must fail) before it's trusted; an unvalidated generated trap is exactly the weak-trap false-negative this track exists to prevent.

## References
- SSOT #115 ([prior-art-evaluations.md:188](../../../docs/meta-factory/prior-art-evaluations.md)) — the prober + its "Trigger to revisit" (incl. N5 give-back).
- `agents/manual-rule-liveness-prober.md` — the consumer of these scenarios.
- #552 (why the prober isn't consumer-shipped today).

## §autonomous-dispatch — park-don't-guess (aif-handoff agent, non-negotiable)

> **aif agent — fork discipline (non-negotiable):** On ANY genuine fork or ambiguity — two defensible designs, an undecided choice, or any of the kickoff's explicitly-listed **«Open design questions for the R-phase (do not pre-answer)»** (who triggers generation: install-time vs on-demand; how generated scenarios are stored consumer-side given #552 A; the weak-auto-trap guardrail; the per-validation cost) — **do NOT pick.** Instead, **park it as a question** (set the task to `manualReviewRequired` / `blocked_external`, stating the fork as «Option A → consequence X / Option B → consequence Y») and **stop that task.** Proceed only on the unambiguous parts. The **#552-flip verdict** in particular is surfaced as **DECISION-NEEDED for the maintainer** (reviewer-discipline §2) — the R-phase states the evidence both ways; it does NOT decide the flip. Guessing a fork to "keep moving" is the exact weak-trap / false-negative failure this whole track exists to prevent.

This R-phase ships a **Markdown research-patch only** (`docs/meta-factory/research-patches/<ship-date>-pressure-scenario-automation.md`) — NOT generator implementation code (T5). Every feasibility claim must be backed by an actual RED→GREEN dispatch on generated output (T2/T6/T-genscenario-A), not described.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
