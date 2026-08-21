# Kickoff — pressure-scenario generator (I-phase, pilot)

> **Type:** I-phase build (pilot). **Branch base:** `staging`.
> **Origin:** maintainer decided #552-flip = **Option A** (2026-06-16) on the strength of the R-phase research-patch [`docs/meta-factory/research-patches/2026-06-16-pressure-scenario-automation.md`](../../../docs/meta-factory/research-patches/2026-06-16-pressure-scenario-automation.md) (merged PR #572). This is the I-phase that Option A unlocks.
> **Posture:** PILOT. Maintainer is consumer-zero — will dogfood and file issues. Build the minimal working generator, not the fully-general one. Lean defaults below are deliberate and reversible.

## Why this exists

The R-phase proved it is **FEASIBLE** (but LOW confidence, n=1) for an AI to generate a *strong* pressure-scenario from a rule's policy text and auto-validate it via a real RED→GREEN dispatch. Flipping #552 means: build the generator so `manual-rule-liveness-prober` can become consumer-usable. This kickoff builds the pilot generator.

## Goal

A generator: **input** = a rule's policy text (a `.ai-factory/RULES.md` entry or a `.claude/rules/*` constraint); **output** = a *validated* `pressure-scenario` (`baseline-prompt` / `observable-failure` / `observable-compliance` / `pressure ∈ {time,authority,sunk-cost,scope-creep}`) that has been **proven** to make a fresh agent fail RED without the rule and comply GREEN with it. An unvalidated scenario is never emitted.

## Baked design decisions (maintainer-set §6 pilot defaults — do NOT re-litigate)

1. **§6.1 trigger = on-demand.** Consumer invokes generation in an active session (e.g. `/aif-generate-scenarios <rule-id>`). NOT install-time (install-time would call an LLM in CI → violates [`no-paid-llm-in-ci.md §1`](../../rules/no-paid-llm-in-ci.md)). All generation+validation is session-bound.
2. **§6.2 storage = separate consumer-local file** `.ai-factory/generated-scenarios.json` (NOT the rules-manifest — the consumer has no writable manifest today, #552-A is unresolved; decouple from it). The prober reads scenarios from this file.
3. **§6.3 guardrail = generator-enforced reject-gate (NON-NEGOTIABLE).** The generator MUST run the §4 static checks AND a mandatory Pass-1 RED validation, and MUST refuse to emit any scenario whose baseline does not actually fail. This is the core value — a generator that emits unvalidated scenarios is exactly the weak-trap failure this track exists to prevent.
4. **§6.4 cost = accept + document.** ≥2 LLM dispatches per scenario, session-bound. Document the cost («generating for N rules ≈ ≥2N dispatches»). NO batching in the pilot (batching risks cross-contamination per R-phase §5.6).

## Hard requirement — isolation (R-phase §5.6 / W2 contamination finding)

The R-phase found a **real contamination bug**: an ambient harness that auto-loads project rules can leak the rule into the RED (baseline) pass → the baseline does NOT fail → false GREEN. The generator's validation loop MUST run the RED pass in an **isolated context with no ambient rule auto-load**, and MUST treat a non-failing baseline as `BASELINE-DIDN'T-FAIL (T-V3-B)` → reject + regenerate (or strengthen the pressure vector), never accept. **This is the make-or-break acceptance criterion** — a generator that doesn't solve isolation produces false-positive «rule is live» verdicts.

## Acceptance (I-phase)

- Generator code (lean, session-bound) that emits a `pressure-scenario` from rule text.
- The §6.3 reject-gate: static checks + mandatory Pass-1 RED validation; refuses to emit on non-failing baseline.
- Isolation solved (above) — demonstrated on ≥1 case where an ambient rule WOULD have contaminated, and the gate catches it.
- An end-to-end run on ≥2 *different* rule types (not just code-pattern) showing RED→GREEN PASS on emitted scenarios + at least one rejected weak-trap. (Counters R-phase n=1 limitation a step further — still pilot, not production benchmark.)
- Written to `.ai-factory/generated-scenarios.json`; prober can consume.
- NO new paid-LLM-in-CI; NO npm-dep bloat (BFR-default + substrate purity).

## §autonomous-dispatch — park-don't-guess (aif-handoff agent, non-negotiable)

> **aif agent — fork discipline (non-negotiable):** On ANY genuine fork or ambiguity not already decided by the «Baked design decisions» above — **do NOT pick.** Instead, **park it as a question** (set the task to `manualReviewRequired` / `blocked_external`, stating the fork as «Option A → consequence X / Option B → consequence Y») and **stop that task.** Proceed only on the unambiguous parts. Especially: if the **isolation requirement** cannot be solved within the harness without an architectural choice that changes behaviour, PARK it — do not ship a generator that emits unvalidated/contaminated scenarios. Guessing here reintroduces the exact weak-trap false-negative this track exists to prevent.

## §AI-traps (per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active: **T2** (building the generator ≠ proving it emits *validated* scenarios — must run real RED→GREEN on emitted output, not describe), **T5** (this is the I-phase — write code; do NOT just produce another research doc), **T6** (quantify by actual pass-rate + reject-rate, no «high confidence» prose), **T16** (don't reuse SSOT #64/#115 dispatch shape assuming problem-class match without checking), **T-genscenario-A** (never emit a scenario that only *reads* adversarial — the reject-gate must have actually run).
Domain-specific: **T-PSG-A** — «declare isolation solved because the happy-path RED failed» — you MUST demonstrate the gate on a case where ambient contamination WOULD occur, else isolation is unproven.

## References

- R-phase patch (merged): `docs/meta-factory/research-patches/2026-06-16-pressure-scenario-automation.md` — §2 generation procedure, §4 validation loop, §5.6 contamination finding, §3 weak-trap catalogue W1–W6.
- `agents/manual-rule-liveness-prober.md` — the consumer of generated scenarios (Step 5 `BASELINE-DIDN'T-FAIL` detector).
- SSOT #115 (`prior-art-evaluations.md`) — verdict to update to ADAPT+generative when this ships.
- #552 — the consumer-manifest question (kept decoupled per §6.2).

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
