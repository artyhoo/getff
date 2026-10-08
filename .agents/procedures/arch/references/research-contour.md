# arch — research contour

> **Authoritative for:** the selected arch procedure sections below; read when routed by [the skill card](../SKILL.md).
> **NOT authoritative for:** project goal or unrelated skill modes. Commands execute from the project root unless stated otherwise.

## §1.5 Research contour — idea → distillate BEFORE design (delta #0)

When the idea touches a **new capability**, an **unfamiliar domain**, or needs a **BFR verdict**, run a research contour before §1's ideation. Tier-0/Tier-1 work (per [CLAUDE.md «Task-tier routing»](../../../../CLAUDE.md)) skips this contour **explicitly** — one line in the artefact saying so, never silently.

**Seats as relative tiers, never model names** (handoff decision 2; same posture as [night-mode/SKILL.md](../../night-mode/SKILL.md) «Overnight model posture», the tier→model instantiation SSOT — point at it, do not restate it).

### 1. Research-spec template (verifier seat authors BEFORE dispatch)

Two fields are REQUIRED and the template says so:

- **pre-mortem paragraph** — «what would have to be true for this idea to fail»
- **acceptance-criteria line** — «what test would prove this idea wrong»

Both before any code exists.

### 2. Execution + freshness bar (binding)

The research runs on the executor tier in aif. **Freshness bar:** every source dated, freshest first; no stale source enters the distillate without fresh confirmation.

### 3. Distillation + idea verdict

The verifier seat **spot-checks sources** (not curation only), distills, carries a «current as of `<date>`» line, and issues `GO | rework | kill`. Killed ideas land in the prior-art SSOT ([docs/meta-factory/prior-art-evaluations.md](../../../../docs/meta-factory/prior-art-evaluations.md)) with their reasons.

### 4. Membrane + K-pass + bounded drill-down (ADR-4)

The ideation seat consumes distillates; the executor seat consumes specs/kickoffs; the verifier seat sees both directions. This is a **default with bounded recourse, not epistemic isolation** — state it explicitly, because the earlier framing implied isolation.

**K-pass station.** A K1/K2 pass (anchors exist as claimed · quoted outputs reproduce) runs **on each distillate before it is consumed**, by a seat **cold for that distillate** (cold as defined in §2), so the distiller's defects die at the distiller's channel. Evidence: a verifier seat shipped two non-reproducing quotes inside a confirmed-findings cold review. On failure the distillate goes back to the distiller (rework); **2+ consecutive rework rounds → surface to the operator**.

**Drill-down, bounded and symmetric** for both consuming seats: first choice is «ask the producing seat to re-verify claim X» (one round-trip, membrane intact); direct opening of a cited source is capped at **≤3 per artifact**; **every** drill-down is recorded IN the resulting artifact, naming the claim and what changed. The next verification look (critique or acceptance) treats an **unrecorded** drill-down as a finding — without a named consumer this is `#warning-nobody-reads` ([attention-is-not-a-mechanism.md §2](../../../rules/attention-is-not-a-mechanism.md)).

**Scope** stays cited-sources-only; browsing stays blocked.
