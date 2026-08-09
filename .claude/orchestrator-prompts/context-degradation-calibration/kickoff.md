# Kickoff: context-degradation-calibration — R-phase, single task

<!-- bridge-profile: Z.AI GLM-5.2 SDK -->

> **Type:** R-phase (research only — no source edits, T5). **Tier:** aif executor tier
> (per [CLAUDE.md «Task-tier routing»](../../../CLAUDE.md) → tier-home doc); the
> `bridge-profile` marker above names the unique executor-profile display name (live
> `/runtime-profiles` list, 2026-08-09) per the active acceptance-contour marker rule —
> the marker is dispatch-INERT (`runtime-bridge-dispatch.sh` fires only on a first-line
> `bridge: auto`), so the sequencing note below is unaffected.
> **Dispatch:** ONLY after this kickoff merges to staging
> ([kickoff-staging-placement.md](../../rules/kickoff-staging-placement.md)) — via
> `/dispatcher context-degradation-calibration`. This file deliberately carries **no
> `bridge: auto` marker**: the write-time auto-dispatch hook must NOT fire before the
> staging merge (spec §6 S4 sequencing).
> **Design context:** [docs/superpowers/specs/2026-08-09-pipeline-chips-session-bus-design.md](../../../docs/superpowers/specs/2026-08-09-pipeline-chips-session-bus-design.md)
> D6/D7/D9 — this task calibrates the handoff-threshold parameters.

## §0 Goal

Produce evidence-backed calibration for the context-handoff policy (design D6): at what
context size does output quality degrade for the **top two Claude tiers as of the run date**
(today: Fable 5 / Opus family — verify current names at run time, do not assume), for OUR task
classes (agentic coding, design/spec authoring, review verdicts, mechanical git/CI tails), and
what transition practice (handoff-to-fresh-session vs auto-compact vs summary-carryover)
preserves the most quality per token.

**Pre-mortem (what would have to be true for this task to fail):** degradation onset varies so
much by task type that a single token threshold misleads more than helps — in that case the
deliverable becomes a per-task-class table + a sharper classifier, NOT a forced single number.

**Acceptance (what would prove the current numbers wrong):** measured/reported quality at 300k
indistinguishable from 100k for our task classes → thresholds rise; already degraded at ~150k
→ thresholds drop. Current provisional parameters under test: T_soft(200k)=70%/~140k,
T_soft(1M)=300k, working ceiling ~500k for mechanical tails.

## §1 Research questions

- **RQ1:** Degradation onset per model tier (Aug 2026 state): public long-context evals,
  first-party guidance, practitioner reports for *agentic/coding* workloads specifically.
- **RQ2:** Task-class variance: does mechanical-tail work (commit/merge/regen with external
  gates) tolerate deeper context than judgment work (design, review, debugging)? Evidence per
  class, not intuition.
- **RQ3:** Transition practices compared: fresh-session handoff via residue doc vs auto-compact
  vs summary-carryover — quality retention, token cost, failure modes (each source dated).
- **RQ4:** Classifier refinement: concrete signals a session can self-check to classify its
  tail as mechanical vs judgment (beyond the design's prose list).

## §2 Permitted files

Exactly ONE file may be created; nothing else in the tree may be touched:

- `docs/meta-factory/research-patches/<run-date>-context-degradation-calibration.md`

Recording a fired PARK is not a file write (see /pipeline §5 park-record contract): it lands
in the park payload + the PR's `## Parked questions`, and its correction lands as a separate
owner commit — so this allowlist deliberately names no park-record artefact.

## §3 Method + freshness bar

WebSearch + first-party docs sweep, ≥3 phrasings per RQ (long-context degradation / context
rot / effective context window / lost-in-the-middle agentic). **Freshness bar (binding, per
arch §1.5):** every source carries its date in the citation; freshest first; no pre-2026
source enters a load-bearing claim without fresh confirmation. Negative-existence claims
(«no eval exists for X») require the 6-item search-coverage checklist
([phase-research-coverage.md](../../rules/phase-research-coverage.md)). Distillate carries a
«current as of <date>» line.

## §4 Deliverable

One research-patch (the §2 file) with: §findings per RQ (each claim: source + date, or
`INCONCLUSIVE-needs-human`), §calibrated-parameters (proposed T_soft / ceiling per window +
per-task-class deltas, with the falsifier for each number), §classifier-refinement (RQ4
signals), §self-application (T15: at what context size was THIS research session, and did its
own quality hold?), «current as of» line.

**Consumption gate (arch §1.5 stations — do not skip):** before the patch's numbers enter the
design (spec D6/D7 parameters), it receives (a) a cold K1/K2 pass (anchors exist as claimed ·
quoted outputs reproduce) by a seat that did not author it, and (b) a verifier
`GO | rework | kill` verdict. The harvesting session owns dispatching both.

## §4c Park-don't-guess

If a genuine fork emerges that changes what to calibrate (e.g. the acceptance criteria
themselves look wrong, or first-party guidance contradicts the operator's 300k floor), do not
guess — park it as a question with the fork stated as «Option A → consequence X / Option B →
consequence Y» and continue on the other RQs.

## §5 AI-traps active

Per [ai-laziness-traps.md §2–§3](../../rules/ai-laziness-traps.md). Active traps for this
R-phase: T1, T3, T4, T6, T7, T12, T14, T15, T20.

- T3/T20 — every threshold claim needs a dated source citation, no prose-only numbers.
- T12 — long-context research moves monthly; WebSearch at proposing time, never from memory.
- T14 — thin evidence for a task class → report «coverage insufficient», not «no degradation».
- T15 — §self-application section is mandatory (see §4).
- **T-CDC-A (domain-specific):** long-context benchmarks mostly measure retrieval
  (needle-in-haystack), NOT agentic-coding quality. Adopting a retrieval benchmark number as
  our handoff threshold without a task-class match argument is T16-shaped — every adopted
  number must state «benchmark problem class: X; our problem class: Y; match evidence: …».

## §5b Host-verify contract

The worker runs in the aif container; acceptance happens on the HOST
([destination-environment-verification.md §1](../../rules/destination-environment-verification.md)).
Before accepting, run:

```host-verify
ls docs/meta-factory/research-patches/*context-degradation-calibration.md
bash scripts/run-local-ci-sweep.sh
```

(Deliverable present + diff-aware local CI sweep green on the host — the research-patch is a
docs surface, so the sweep covers the markdown/link gates that apply to it.)

## §6 Stop conditions

Stop and park when: (a) all four RQs answered or explicitly INCONCLUSIVE with coverage stated;
(b) a §4c fork fires on the acceptance criteria; (c) source landscape turns out thinner than
5 dated 2026 sources total — report «insufficient external evidence; propose in-house
measurement protocol instead» rather than padding with stale citations.
