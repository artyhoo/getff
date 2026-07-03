# Multi-Toolchain "Convention Compiler" (MT) — decision resolutions

> **Authoritative for:** MT-umbrella decision resolutions — Decision #1 (the four tier-vocabulary
> names, RESOLVED provisional) + the two surfaced owner decisions (README widening; AGENTS.md
> fenced-block ownership) that BLOCK MT implementation.
> **NOT authoritative for:** the MT design/architecture — see the
> [spec](../specs/2026-07-03-multi-toolchain-convention-compiler-design.md); the R-phase evidence —
> see [research-patches/2026-07-02-multi-toolchain-generalization.md](../../meta-factory/research-patches/2026-07-02-multi-toolchain-generalization.md);
> project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).

**Baseline:** authored on branch `docs/mt-umbrella-authoring` off `origin/staging` (HEAD at
`6b9943098` at branch time). Every `file:line` below was re-opened against this tree; re-verify at
MT-dispatch time (README/INSTALL-FOR-AI line numbers drift).

---

## Decision #1 — the four tier-vocabulary names (RESOLVED — provisional)

**Decision:** adopt the [MT patch §9 p.10](../../meta-factory/research-patches/2026-07-02-multi-toolchain-generalization.md)
names as canonical. Four **orthogonal** vocabularies, four names — naming them now (rather than
leaving `TBD`/placeholder) UN-blocks MT authoring, per the §9 p.10 "fix before MT-kickoff" obligation
and the kickoff STOP line "use these names, not placeholders".

| Name | One-line definition | Populates / governs |
|---|---|---|
| **`provenance-tier`** | the doc-source trust level of a convention's evidence: Tier 0 curated / Tier 1 derived-from-installed-metadata / Tier 2 human-acked | `ConventionNode.provenance[]`; rides the trust-tiers resolver (S1/S2) |
| **`confidence-tier`** | a clippy-style per-rule false-positive contract, ordered by clippy's own multi-level lint ladder (`allow → warn → deny → deny-by-default`) — deny-by-default rules must be FP-free | whether a rule may render as a gate-blocking rule vs a warning |
| **`capability-class`** | selector expressibility: `syntax \| type-aware \| dep-graph` | `ConventionNode.selectorClass`; each backend's matrix maps class → `yes/partial/no` |
| **`assert-tier`** | the doc-test ladder: `compile_fail → no_run → run → should_panic`; Go `Output` tier | the (post-MVP) doc-test render surface only |

**Why these names over alternatives:**

- Each name says what it is an axis *of* — the noun before `-tier`/`-class` disambiguates. A single
  generic `trust-tier` / `tier` was rejected: conflating four orthogonal axes under one word is
  exactly `#pattern-matching-on-name` (T16, [ai-laziness-traps.md §2](../../../.claude/rules/ai-laziness-traps.md))
  — a reader would assume `confidence` and `provenance` are levels of one scale.
- `capability-class` uses `-class` (not `-tier`) deliberately: the three selector kinds are a
  *classification*, not an ordered ladder (a `dep-graph` rule is not "more" than a `syntax` rule),
  whereas `provenance`/`confidence`/`assert` ARE ordered ladders → `-tier`.
- `provenance-tier` reuses the trust-tiers vocabulary already shipped
  ([research-source-trust.md](../../../.claude/rules/research-source-trust.md)) — no new coinage where
  an established one fits (build-first-reuse-default: ADOPT VOCABULARY).
- `assert-tier` mirrors the Rust/Go doc-test ladder verbatim (MT patch §4.5) — the ecosystems named
  it; we ADOPT the naming rather than invent a parallel one.

**Provisional — maintainer may rename at MT-kickoff dispatch.** These names are the design's
working vocabulary so authoring can proceed with concrete identifiers; they are NOT a frozen API. If
the maintainer prefers different names, they are a mechanical rename before S1 code lands (the IR
types do not exist yet). What is NOT provisional is the *count and orthogonality* (four independent
axes) — that is load-bearing from the R-phase.

---

## Owner decision #1 — README widening (SURFACED, NOT decided) — BLOCKS MT implementation

**The fork:** `README.md:8` pins the product to *"server-side TypeScript and React/Next.js stacks"*,
and `README.md:237-243` (the "What stack does it support?" section) enumerates four TS/React stacks
only. Treating MT (`{toolchain: npm|cargo|go|maven, stack}`) as **product scope** requires widening
this framing to multi-toolchain. `README.md` is **maintainer-owned** (CLAUDE.md Artifact Ownership
Contract — "goal-redefinition is structural change; README is read-only for all reviewer /
implementation / planning sessions"). This planning session therefore does **NOT edit `README.md`**.

**Why it is a blocker (not a nicety):** MT patch §9 p.11 records "README widening is a **deliberate
maintainer edit**, prerequisite to treating MT as product scope (Artifact Ownership Contract)". S3
(generalize-from-three) and any consumer-facing MT claim depend on the product's stated scope
covering multiple toolchains. Shipping MT code while the README still says "TS/React only" would make
the shipped product contradict its own goal statement — a `#discipline-theatre` gap at the doc layer
(the exact class the framework exists to prevent).

**PREPARED DRAFT DIFF — DRAFT, awaiting maintainer approval; NOT applied.** A proposed rewrite of
`README.md:8` (the one-line pin) and the "What stack does it support?" section (`README.md:237`) to
mention the multi-toolchain roadmap. The maintainer applies this (or a variant) as a deliberate edit;
it is reproduced here so the decision is concrete, not hand-wavy:

```diff
--- a/README.md
+++ b/README.md
@@ -8 +8 @@
-> Companion to AI Factory + aif-handoff + Superpowers (today) — broader AI-runtime integration on roadmap. Deploys into Claude Code / Cursor / Codex via standard project install. Converts every codebase rule into an executable artifact that fails at the earliest reachable channel (edit-time → pre-commit → pre-push → CI → production audit). Adds Living Documentation enforcement and 5-layer framework for AI-resistant codebases — server-side TypeScript and React/Next.js stacks.
+> Companion to AI Factory + aif-handoff + Superpowers (today) — broader AI-runtime integration on roadmap. Deploys into Claude Code / Cursor / Codex via standard project install. Converts every codebase rule into an executable artifact that fails at the earliest reachable channel (edit-time → pre-commit → pre-push → CI → production audit). Adds Living Documentation enforcement and 5-layer framework for AI-resistant codebases — server-side TypeScript and React/Next.js stacks today, with a multi-toolchain roadmap (Rust/cargo next) via the Convention-Compiler design.
@@ What stack does it support? (§237) — illustrative only: hand-apply after the react-native
   bullet; NOT a `git apply`-able hunk (non-standard header, insertion point named in prose) @@
+
+### Multi-toolchain roadmap
+
+Beyond the TypeScript/React stacks above, the framework is being generalized one level up —
+`{toolchain: npm|cargo|go|maven, stack}` — via the **Convention Compiler** (narrow-core IR +
+per-backend capability matrix). Rust/cargo is the first non-npm backend. This is roadmap, not
+shipped: today only the TS/React stacks are installable. See
+`docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md`.
```

**Blocker statement:** MT IMPLEMENTATION (S1 code onward) cannot start until the maintainer resolves
this — either by applying a README widening (product scope includes multi-toolchain) or by explicitly
scoping MT as internal/experimental-only (not yet product scope). The kickoff §2 STOP line encodes
this.

---

## Owner decision #2 — AGENTS.md fenced-block ownership (RESOLVED: Option A, 2026-07-03)

**The fork:** two shipped-artefact authority positions collide on `AGENTS.md`:

- `INSTALL-FOR-AI.md:301-316` **sanctions consumer edits** to `AGENTS.md`: it is listed under
  "What `--refresh` never touches" as a **consumer-authored file** ("filled in by you"), and the
  three-layer model treats a consumer's in-place edits as their own (Layer 2 / Layer 3 `.override.md`).
- MT patch §9 p.5 proposes **framework-owned fenced blocks + per-surface hashes** inside AGENTS.md
  (render surface 6), so the compiler can detect drift "within one regenerate cycle". That requires
  the framework to *own* a region inside a file the current authority model says the consumer owns.

This is a genuine shipped-artefact authority-model fork — a "which way should the product go?"
question, not a design detail. Per [reviewer-discipline.md §2](../../../.claude/rules/reviewer-discipline.md)
and the Artifact Ownership Contract, a planning session surfaces it with both options + consequences;
it does **NOT** decide. **Maintainer call.**

**Option A — framework-owned fenced regions inside consumer-owned files, with drift detection.**
The framework injects clearly-delimited fenced blocks (with per-surface content hashes) into
AGENTS.md; the surrounding file stays consumer-owned. `--refresh` / a drift probe re-hashes the fenced
region and flags divergence.

- *Consequence (+):* the "executable AI-docs" surface (MT patch §0, the flagship empty niche) becomes
  real — an AGENTS.md paragraph can be asserted against code, drift caught within one regenerate cycle
  (surface 6, P3 proved this is currently a real gap: `grep -rln "Enforces"` = zero readers).
- *Consequence (−):* it partially reverses the `INSTALL-FOR-AI.md:301-316` "AGENTS.md is fully
  consumer-authored" promise — a consumer editing inside a framework-owned fence now conflicts with
  refresh; the three-layer model needs a fourth state ("framework-owned region inside a consumer file").
  The honest claim stays bounded to "detected within one regenerate cycle", never "impossible" (MT
  patch §9 p.5) — because consumer edits are still sanctioned outside the fence.

**Option B — AGENTS.md stays fully consumer-owned; no framework drift claim.**
Keep `INSTALL-FOR-AI.md:301-316` as-is; the compiler renders AI-doc *suggestions* the consumer pastes,
with no framework-owned region and no per-surface hash.

- *Consequence (+):* zero authority-model change; the three-layer model and `--refresh` semantics are
  untouched; no consumer-edit conflict.
- *Consequence (−):* surface 6 (drift detection) is impossible for AGENTS.md — the "executable
  AI-docs" niche stays unoccupied *for this file class*; the framework cannot claim its shipped
  AGENTS.md stays true to the code (the P3 gap persists by design).

**RESOLVED — Option A (maintainer decision, 2026-07-03).** The executable-AI-docs surface is worth
introducing a framework-owned fenced region into the (otherwise consumer-owned) AGENTS.md, because
drift-detection of convention-vs-code is the project's flagship niche (MT patch §0). Implementation +
the owed `INSTALL-FOR-AI.md:301-316` / three-layer-model reconciliation are tracked as **WI-1** in the
[`executable-aidocs-and-cargo-followups` umbrella](../../../.claude/orchestrator-prompts/executable-aidocs-and-cargo-followups/kickoff.md)
(deferred; picked up on maintainer go — likely its own umbrella at that point). Until then, surface 6
stays post-MVP (spec §5) and MT MVP ships without an AGENTS.md drift detector.

---

## See also

- [specs/2026-07-03-multi-toolchain-convention-compiler-design.md](../specs/2026-07-03-multi-toolchain-convention-compiler-design.md) — the MT design (§5 surfaces, §6 tier vocabularies, §9 non-goals).
- [research-patches/2026-07-02-multi-toolchain-generalization.md §9 p.5/p.10/p.11](../../meta-factory/research-patches/2026-07-02-multi-toolchain-generalization.md) — the R-phase origin of the four names, surface 6, and the README-widening prerequisite.
- [.claude/orchestrator-prompts/multi-toolchain-convention-compiler/kickoff.md](../../../.claude/orchestrator-prompts/multi-toolchain-convention-compiler/kickoff.md) — the umbrella kickoff whose STOP lines encode these two blockers.
- [CLAUDE.md `Artifact Ownership Contract`](../../../CLAUDE.md) — README + shipped-agent ownership boundaries these owner decisions respect.
- [INSTALL-FOR-AI.md](../../../INSTALL-FOR-AI.md) — the three-layer authority model Owner decision #2 forks against (lines ~301-316).
