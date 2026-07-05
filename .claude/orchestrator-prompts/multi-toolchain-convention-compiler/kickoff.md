<!-- scope: kickoff — multi-toolchain-convention-compiler (MT) umbrella. R-phase DONE in a prior patch; dispatch = I-phase stages. -->

# multi-toolchain-convention-compiler (MT) — kickoff

> **Goal of this umbrella:** raise the framework's parametrization one level — from `{stack}` inside
> the npm toolchain to `{toolchain: npm|cargo|go|maven|…, stack}` — by building the **Convention
> Compiler**: a narrow-core IR + per-backend capability matrix that renders one convention into
> native artifacts across toolchains, Rust first. NOT a goal change — serves
> [README.md#why-this-exists](../../../README.md#why-this-exists) (every rule stays an executable
> artifact failing at the earliest reachable channel); it widens the *toolchains* the existing goal
> covers. Treating MT as product scope was gated on a maintainer README-widening decision — RESOLVED 2026-07-03 (#870, README widened); see the decisions doc.
> Surface 3 (AI-doc composition) is IN this umbrella as **Stage S4** (owner decision 2026-07-03) —
> the final stage; its merge closes the MVP and writes done.md.
> **R-phase status:** DONE — this umbrella's research base is
> [research-patches/2026-07-02-multi-toolchain-generalization.md](../../../docs/meta-factory/research-patches/2026-07-02-multi-toolchain-generalization.md)
> (§0 verdict, §2 per-toolchain capability matrix, §8 Convention-Compiler sketch, §9 v0.2 architecture,
> §10 probe results P1–P6). Design spec:
> [specs/2026-07-03-multi-toolchain-convention-compiler-design.md](../../../docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md).

---

## §0 Research base + re-verify obligation

This kickoff cites the R-phase patch as its base **per that patch's `## Prevention` section**. Before
any stage dispatch, the executing session MUST:

- **Re-verify the volatile facts** marked in the [MT patch §5](../../../docs/meta-factory/research-patches/2026-07-02-multi-toolchain-generalization.md)
  (tool versions, licenses, stability disclaimers — the research dates 2026-07-02): re-check
  `ast-grep` version (0.44.0 at research time, pre-1.0), `clippy.toml` "unstable, may be deprecated"
  disclaimer, Semgrep license state, and the crates.io/PyPI registry-metadata facts.
- **Run the phase-research-coverage §1 six-item checklist ONLY on NEW candidates** surfaced after
  2026-07-02 (the pre-2026-07-02 candidates carry verdicts already — MT patch §5).
- **Re-verify volatile in-repo facts** at ship time (not from this doc): the `ManifestCheck` engine
  enum in `packages/core/synthesizer/types.ts`, the B-research gate file layout under
  `packages/core/research/gates/`, and the current free principle-slot / principle-09 sentinel if any
  doc obligation fires.

## §1 Target architecture (from the spec — do not re-derive)

The design is fixed in the [spec](../../../docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md).
The load-bearing shape for dispatchers:

- **Three planes:** frontends (research → IR, LLM only here, provenance-gated) → **narrow-core IR**
  (the SSOT grammar; grammar-gates run here once) → per-`{toolchain}` renderers (capability matrix,
  fail-closed, ast-grep escape hatch). **NOT a union-IR / LLVM** (spec §2; MT patch §9 p.1) — the
  capability matrix IS the architecture.
- **IR v0 node** (spec §3): `{id, claim, anchors[] (FF-rule-ID namespace only), selectorClass:
  syntax|type-aware|dep-graph, params, defaultSeverity, provenance[], pairedExamples{positive,
  negative} MANDATORY}`. `doc-level|process` is DESCOPED to a self-hosting milestone — do not add it.
- **The FOUR tier vocabularies** (spec §6; canonical names in the decisions doc): `provenance-tier`,
  `confidence-tier`, `capability-class`, `assert-tier`. Use these names, not placeholders.
- **RenderOutcome ∈ {rendered | degraded(FF) | refused(FF)}** + end-of-render assert (spec §4) —
  nothing silent, including severity loss on ruff.
- **Six render surfaces** (spec §5): rule + firing-test are MVP per-node projections; AI-doc is MVP
  as composition-over-node-SETS; doc-test + wiring are cut from MVP; lockfile/detector (surface 6) is
  post-MVP.

## §2 Stages (each = one PR onto staging, branch from staging; do NOT collapse into one commit)

**S1 — name the IR + the four vocabularies (extract grammar types).**
Extract the `ConventionNode` types (spec §3) from today's `ResearchEntry`/`SynthesisPlan` embryo;
wire the four tier vocabularies (spec §6) as named types with the decisions-doc canonical names. No
new backend in S1 — this is the IR-plane made explicit. Paired negatives: a node missing
`pairedExamples` fails the grammar gate; a node with a `doc-level` selectorClass fails (descoped).

**S2 — cargo-backend-v0 (`clippy.toml` renderer + firing harness).**
The `clippy.toml` renderer (MT patch §8 stage 3 / P4 contract) + the firing-test-as-data harness
`{command, jsonPath, expectedCode}` (spec §4 invariant). **BLOCKED on a Rust toolchain for live
firing** — the harness is authorable but P4's live-fire (`cargo clippy --message-format=json`) MUST
run on a Rust-toolchain env before the backend is claimed green (spec §8). A designed-but-unfired
harness shipped as "working" is `#discipline-theatre` (**T15**). Paired negatives per the P4 fixture
(invalid crate calls `std::env::var` → fires `clippy::disallowed_methods`; valid wraps it → clean).

**S3 — generalize-from-three (extract the generic frame).**
ONLY after L4-npm (existing) + B-research gates (shipped) + cargo-v0 (S2) are three real reference
backends: factor the shared renderer contract + name the generic IR types (spec §7). **Do NOT build
the union-IR** the R-phase rejects (MT patch §9 p.1); extracting the frame from <3 backends risks
exactly that. This stage is gated on S2 landing AND on the README-widening owner decision (RESOLVED — #870; see the decisions doc).

**S3 execution split (3a-ii):** S3 runs as (3b) npm-on-IR — ConventionNode→SynthesizedRule adapter +
the npm backend starts emitting per-node RenderOutcome (importing the type from backends/cargo, no
copy) — then (3c) the frame extraction hoists `@hoist-at-s3` units into backends/shared **immediately
after** (the two-copies window must not outlive one stage). Extraction from <2 live IR emitters is the
union-IR backdoor the STOP line forbids.

**S4 — surface 3: AI-doc composition (final MVP stage).**
Composition over node SETS per spec §5.1 (DocPlan-as-data; derived enforcement lines;
fence without hashes — surface 6 stays WI-1). Demo region is injected into the repo root
AGENTS.md (owner decision 2026-07-03): section «Configuration access», cargo node
(live-fired) + npm node (RuleTester), counter-run RED transcript in the PR body. Gates
claim FF8xxx. The session that merges the last S4 PR writes this umbrella's done.md
(CLAUDE.md umbrella-closure convention) — no earlier stage does.

**Scope boundaries:** the §9.1 invention gaps (LLM-taint-as-IR-property, convention-lifecycle-as-data,
dead-convention-detection, unified-suppression) are post-MVP milestones tracked in the design spec's
"Deferred invention milestones" subsection — OUT of cargo-v0 scope; the §9 p.12 cross-pollination
invariant is a standing per-backend rule (honored in substance today).

**STOP lines (binding):**

- ~~MT implementation is BLOCKED on the README-widening owner decision~~ — RESOLVED 2026-07-03 (#870): README widened by deliberate maintainer edit; S1 may start. (Original gate recorded in the decisions doc, Owner decision #1.)
- The cargo backend's live-fire is BLOCKED on a **Rust toolchain** (spec §8) — design in any env,
  claim green only after a real `cargo clippy` run.
- **Do NOT collapse MT into one commit** — S1/S2/S3 are separate PRs (spec §9 non-goal).
- **Do NOT build the union-IR** — narrow-core + capability matrix only.
- done.md is written ONLY at the S4 final-PR merge — writing it earlier is a closure-convention violation.

## §3 Discipline

- Branch per stage, base `staging`; principle tests green
  (`npm --prefix packages/core run test:principles`); §1.7 Forward/Backward in each PR body.
- New spec + decisions doc carry doc-authority headers per
  [doc-authority-hierarchy.md §3](../../rules/doc-authority-hierarchy.md); this kickoff needs no
  doc-authority header (filename-convention authority, doc-authority §2) but satisfies principle 12
  via §4 below.
- **Kickoff-staging-placement discipline** ([kickoff-staging-placement.md §1](../../rules/kickoff-staging-placement.md)):
  this kickoff is a TRACKED file read from `staging` by every dispatch consumer. It MUST reach
  `staging` (via a merged PR) BEFORE any `/pipeline multi-toolchain-convention-compiler` or aif
  dispatch is initiated — a kickoff living only on a feature branch is invisible to the dispatcher
  (`#dispatch-before-staging`). Sequence: merge this kickoff → then dispatch.

## §4 AI-laziness traps (principle-12 compliant)

Per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md) (trap catalogue) and §3
(kickoff-author obligations), the traps active for an MT design/impl umbrella:

**Active traps: T1, T5, T11, T12, T13, T15, T16** (one-line why each):

- **T1** («3 examples clean → done») — the capability matrix has 5 toolchains × many selectorClasses;
  sampling 3 cells clean is a sampling artifact. Depth floor = 5 cells per claim, per §2 of the rule.
- **T5** (bundling impl findings into design) — this is a planning/design umbrella; do not edit
  `packages/` code while authoring. Surface findings, propose mechanisms, leave the fix to the stage.
- **T11** (custom solution without prior-art check) — every renderer/harness decision consults the
  MT patch §5 SSOT draft rows + `build-first-reuse-default.md` before any "I propose" (BUILD verdict
  requires the §3 mechanism confirming no upstream fit — runners are REFERENCE, generation is BUILD).
- **T12** (skipping the literature sweep — "I already know ast-grep/clippy") — versions/licenses move
  (Semgrep re-license precedent); re-verify volatile facts at ship (§0), do not trust training data.
- **T13** (ADOPTED items are zero-work) — ast-grep/clippy/PMD are ADOPTED as renderer targets; each
  carries an upstream-problem-class statement to re-check (MT patch §5 rows), not a free pass.
- **T15** (self-application skipped) — the frame's own renderers MUST pass the capability-matrix
  discipline they enforce; a cargo firing harness that is designed but never fired is the docs-layer
  `#discipline-theatre` (spec §8). Every stage includes a self-application check.
- **T16** (`#pattern-matching-on-name`) — the four tier vocabularies are orthogonal axes, not one
  scale; treating `confidence-tier` and `provenance-tier` as interchangeable because both say "tier"
  is T16. Each ADOPTED backend needs «upstream problem class X vs our problem class Y — match?
  evidence» (MT patch §5).

**Domain-specific traps for this umbrella:**

- **T-MT-A** — «declaring a renderer's capability-matrix cell ✅ without a firing test proving the
  native linter actually expresses the rule». Counter: a `yes` cell in any backend's matrix requires
  a paired RED/GREEN firing test (the P5 ast-grep case is the template; the P4 cargo case is DESIGNED
  and must be fired on a Rust toolchain before its cells are marked ✅). A matrix cell claimed
  expressible with no firing evidence is the MT specialization of `#discipline-theatre`.
- **T-MT-B** — «building the union-IR the R-phase rejects because it feels more general». Counter: the
  narrow-core + per-backend capability matrix IS the architecture (spec §2; MT patch §9 p.1); any node
  field that is toolchain-specific, or any "universal AST" ambition, is T-MT-B. Falsifier: a proposed
  IR node carries a field only one backend reads.
- **T-MT-C** — «marking the cargo backend green from a designed-but-unfired harness». Counter: spec §8
  — `cargo`/`clippy` are ABSENT in the authoring env; live-fire is deferred to a Rust-toolchain env
  and MUST run before any green claim. Faking a pass here is the exact failure T15/T-MT-A guard.
- **T-MT-D** — «a stage's design step declares completeness before hitting all its declared surfaces».
  Repurposes canonical T4's shape ("closing R-phase prematurely") for THIS umbrella's I-phase: the
  R-phase itself is DONE (MT patch), but each of S1/S2/S3's own *design* step must hit every surface
  §1/§2 declares for that stage, not stop at "looks comprehensive". Counter: cross-check the stage's
  output against its own declared surface list (spec §5 for S1's IR fields, §7 for S3's three
  reference backends) before calling the design step done.

## §5 See also

- [research-patches/2026-07-02-multi-toolchain-generalization.md](../../../docs/meta-factory/research-patches/2026-07-02-multi-toolchain-generalization.md) — the R-phase base (§0/§2/§8/§9/§10).
- [specs/2026-07-03-multi-toolchain-convention-compiler-design.md](../../../docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md) — the MT design this kickoff dispatches against.
- [../../../docs/superpowers/plans/2026-07-03-multi-toolchain-convention-compiler.decisions.md](../../../docs/superpowers/plans/2026-07-03-multi-toolchain-convention-compiler.decisions.md) — four tier-vocab names + two owner decisions (README widening, AGENTS.md ownership).
- [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md) — the trap catalogue this §4 instantiates.
- [.claude/rules/kickoff-staging-placement.md](../../rules/kickoff-staging-placement.md) — the merge-before-dispatch discipline §3 cites.
- [.claude/orchestrator-prompts/rule-research-trust-tiers/kickoff.md](../rule-research-trust-tiers/kickoff.md) — the ecosystem-adapter seam MT's frontends ride.
