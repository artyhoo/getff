# Multi-Toolchain "Convention Compiler" (MT) — design

> **Status:** design authored in the MT-umbrella planning session (2026-07-03), on the R-phase base
> [research-patches/2026-07-02-multi-toolchain-generalization.md](../../meta-factory/research-patches/2026-07-02-multi-toolchain-generalization.md)
> (v0.2 architecture, §8/§9). Implementation is BLOCKED on two owner decisions (README widening +
> AGENTS.md fenced-block ownership) and on a Rust toolchain for live firing — see §7 and the
> [decisions doc](../plans/2026-07-03-multi-toolchain-convention-compiler.decisions.md).
> **Authoritative for:** the MT Convention-Compiler design — the three-plane shape (narrow-core IR
> + per-backend capability matrix), the IR v0 node shape, the four tier vocabularies, the six
> render surfaces with MVP cut lines, and how the three real backends map to the frame.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).
> The R-phase evidence (per-toolchain capability matrix, prior-art verdicts, probe results) — see the
> [2026-07-02 MT patch](../../meta-factory/research-patches/2026-07-02-multi-toolchain-generalization.md).
> The trust-tier resolver / ecosystem-adapter seam MT rides — see
> [.claude/orchestrator-prompts/rule-research-trust-tiers/kickoff.md §5 S1](../../../.claude/orchestrator-prompts/rule-research-trust-tiers/kickoff.md).

## §1 Problem

The framework must work for any language/stack: parametrization rises one level, from `{stack}`
inside the npm toolchain to `{toolchain: npm|cargo|go|maven|…, stack}`, Rust first (maintainer
direction, 2026-07-02). The R-phase closed the "does this generalize at all?" question — the
`{toolchain, stack}` generalization is **viable as data** in all five surveyed toolchains (MT patch
§0/§2). What remains is a design the MT umbrella can implement against without re-deriving the
architecture: what the IR node is, which surfaces render from it, what degrades and how, and which
real backends the generic frame is generalized *from* (never speculatively designed).

This spec is that design. It **cites** the R-phase patch rather than restating it — §2's per-toolchain
capability matrix, §3's mechanism steals, §7's competitive check, and §10's probe results are the
evidence base; this spec is the buildable shape on top.

## §2 The three-plane shape (NOT an LLVM / union-IR)

getff is a compiler for conventions. The classic three-stage shape (MT patch §8) — **but the v0.2
adversarial review (MT patch §9 p.1) rejects the union-IR reading of it**:

> NOT an LLVM. **Narrow-core IR + per-backend capability negotiation** (the WASM/LSP survivor
> pattern; union-shaped universal IRs die — UAST, github/semantic, LSIF). **The capability matrix IS
> the architecture.** (MT patch §9 p.1)

The three planes:

1. **Frontends — knowledge acquisition.** Produce IR from live research over tier-trusted docs
   (trust-tiers S1–S4 ecosystem adapters), maintainer-authored conventions, and (future) captured
   conventions. LLM is allowed ONLY here, always behind provenance gates (fetch+quote, taint banner).
2. **Narrow-core IR — the Convention grammar (the SSOT).** One node ≈ §3 below. Grammar-level gates
   run HERE, once, toolchain-independent (schema, tautology, conflict, coverage).
3. **Backends — per-`{toolchain}` renderers**, each declaring a capability matrix over
   `selectorClass` values (fail-closed on inexpressible, ast-grep escape hatch), each emitting up to
   six render surfaces (§5) from the same IR node.

The **narrow-core** discipline is load-bearing: a node carries only what every backend can negotiate
against, and each backend *declares* which grammar elements it can express (MT patch §4 invariant 2).
An inexpressible rule degrades explicitly with an FF-coded diagnostic — never silently dropped,
never silently approximated. This is why the design is a capability matrix and not a lowest-common-
denominator union: the matrix records per-backend `yes/partial/no` (MT patch §2 rows), and the
degradation is data.

## §3 IR v0 node shape (MT patch §9 p.2)

```ts
interface ConventionNode {
  id: string;
  claim: string;                       // human prose — the convention stated once
  anchors: string[];                   // FF-rule-ID namespace ONLY (not free-form symbols)
  selectorClass: 'syntax' | 'type-aware' | 'dep-graph';
  params: Record<string, string | number>;
  defaultSeverity: 'error' | 'warning' | 'note';   // a rendering detail, not the gate policy
  provenance: Provenance[];            // tier-trusted source chain (trust-tiers)
  pairedExamples: {                    // MANDATORY — the paired-negative invariant, at IR level
    positive: string;                  // compliant sample (must stay clean)
    negative: string;                  // violating sample (must fire the rule)
  };
}
```

Two v0 scoping decisions carried verbatim from the R-phase (MT patch §9 p.2):

- **`selectorClass` is exactly `syntax | type-aware | dep-graph`.** `doc-level | process` are
  **descoped** from the v0 enum — non-goal until a named **self-hosting milestone** (the repo's own
  principle-test/hook infrastructure already IS that backend on a different substrate; gluing
  substrates at v0 = union-IR death). P1 confirmed this empirically: reverse-compiling `CLAUDE.md`
  yielded 60% doc-level/process units that a v0 IR correctly cannot represent (MT patch §10 P1).
- **`anchors` are FF-rule-ID namespace only** (not arbitrary symbols). This keeps the anchor a
  machine-resolvable reference into the diagnostics registry (D1 FF codes), not a prose pointer —
  the principle-08 broken-ref pattern generalizes to dangling anchors = CI failure.
- **`pairedExamples` is MANDATORY.** A node without a paired positive+negative is a schema violation
  at the grammar-gate plane. The framework's own paired-negative discipline becomes an IR invariant,
  not a per-backend convention.

## §4 RenderOutcome — nothing silent (MT patch §9 p.3)

Each backend returns, per node, a `RenderOutcome`:

```ts
type RenderOutcome =
  | { kind: 'rendered'; surfaces: RenderedSurface[] }
  | { kind: 'degraded'; code: string /* FF */; note: string }   // partial — e.g. severity lost on ruff
  | { kind: 'refused'; code: string /* FF */; note: string };   // inexpressible in this toolchain
```

An **end-of-render assert** closes the loop: every node in the plan resolves to exactly one of the
three outcomes, and a `refused`/`degraded` outcome carries an FF code (the D1 diagnostics model is
the IR-level error language — MT patch §8 p.4). "Nothing silent — including severity loss on ruff"
(MT patch §9 p.3): ruff has no per-rule severity, so a node with a non-default severity renders
`degraded(FF)` on the ruff backend rather than silently downgrading. The `ErrorGuaranteed`
discipline reduces to this cheap end-of-render assert (MT patch §9 p.3).

## §5 The six render surfaces (MT patch §8 p.3 + §9 p.4/p.5) — with MVP cut lines

From one IR node, a backend renders up to six surfaces:

| # | Surface | What it emits | MVP? |
|---|---|---|---|
| 1 | **rule** | native config: eslint config / `clippy.toml`+`deny.toml` / golangci yaml / ruff toml / PMD xml / ast-grep YAML | **IN** — per-node projection |
| 2 | **firing test** | contract `{command, jsonPath, expectedCode}` + paired positive; runners borrowed (RuleTester / `cargo clippy --message-format=json` / `go test` / pytest / JUnit) — **we build no runner** | **IN** — per-node projection |
| 3 | **AI-doc** | AGENTS.md/CLAUDE.md section — **composition over node SETS, not 1:1** (MT patch §9 p.4); every rendered paragraph carries anchor + enforcement-status line («Enforced: eslint ✅ · clippy ✅») | **IN** (the composition form; P1-validated) |
| 4 | **doc-test** | rustdoc / Go Example / pytest-doctest / twoslash wrapper where native (§4.5 tier ladder) | **CUT from MVP** — negotiated extension |
| 5 | **wiring** | hooks / CI at the toolchain's earliest reachable channel | **CUT from MVP** — negotiated extension |
| 6 | **lockfile/detector** | fenced framework-owned blocks inside consumer-owned files + per-surface hashes; honest claim = «drift detected within one regenerate cycle», never «impossible» (MT patch §9 p.5) | **post-MVP milestone** — P3 proved it load-bearing (no current tool reads the `Enforces` assertion column) |

**Surface 3 is composition, not projection** — the decisive P1 finding (MT patch §10 P1): the
CLAUDE.md reverse-compile measured a 1:1 doc→node ratio of only 7.5% and an N:1 (composition) ratio
of 32.5%, so a naive 1:1 doc compiler would fabricate ~24 phantom nodes. The AI-doc surface therefore
composes over node **sets**, and each paragraph resolves *transitively* (anchor → rule → firing test)
— "executable AI-docs" needs no separate doc-claim runner (MT patch §9 p.6).

**Surface 6 is the first post-MVP milestone**, not v0. P3 flipped an AGENTS.md `Enforces` assertion
to its semantic opposite and every AGENTS.md-touching tool passed GREEN (`grep -rln "Enforces"`
across the shipped tree = zero hits) — so the drift detector fills an unoccupied position (MT patch
§10 P3). The honest claim is bounded: consumer edits to these files are **sanctioned by our own
authority model** (INSTALL-FOR-AI three-layer model), so drift can only be "detected within one
regenerate cycle", never made impossible. See the [decisions doc](../plans/2026-07-03-multi-toolchain-convention-compiler.decisions.md)
Owner decision #2 — the fenced-block ownership fork is an unresolved maintainer call.

## §6 The four tier vocabularies (MT patch §9 p.10)

The IR node and its backends reference four **distinct** tier vocabularies. Naming them before the
MT umbrella (rather than leaving placeholders) is a §9 p.10 obligation — the canonical names are
resolved in the [decisions doc Decision #1](../plans/2026-07-03-multi-toolchain-convention-compiler.decisions.md):

- **`provenance-tier`** — the S1/S2 doc-source trust level (Tier 0 curated / Tier 1 derived /
  Tier 2 acked). Rides the trust-tiers resolver; populates `ConventionNode.provenance[]`.
- **`confidence-tier`** — a clippy-style per-rule false-positive contract (deny-by-default tier must
  be FP-free ≙ our trust-tiers; MT patch §3). A rule's confidence tier governs whether it may be
  rendered as a gate-blocking rule or only a warning.
- **`capability-class`** — the selector expressibility class (`syntax | type-aware | dep-graph`) =
  `ConventionNode.selectorClass`. A backend's capability matrix maps each class to `yes/partial/no`.
- **`assert-tier`** — the doc-test ladder (`compile_fail → no_run → run → should_panic`; Go `Output`
  tier). Only relevant to the (post-MVP) doc-test surface; a tier downgrade is a reviewable diff, and
  a *silent* downgrade must be loud (Go's trap — MT patch §4.5 rule 1).

These four are **orthogonal axes**, not levels of one scale — conflating them is `#pattern-matching-
on-name` (T16). The decisions doc records why these names over alternatives.

## §7 How the three real backends map to the frame (generalize-from-three, not speculative)

The generic frame is **generalized from three real backends, only after cargo v0 lands** — never
designed speculatively (MT patch §8 last paragraph: "lets the generic frame emerge from three real
backends"). The three data points:

| Backend | Status | Maps to the frame as |
|---|---|---|
| **L4-npm** | **existing** — today's L1–L5 pipeline IS the npm backend + npm frontend already | the reference backend; its `SynthesizedRule` shape (`packages/core/synthesizer/types.ts`, the `ManifestCheck` union already carries `engine?: 'eslint-restricted' \| 'ast-grep'`) is the embryo of the IR node's rule surface |
| **B-research gates** | **just shipped** (`packages/core/research/gates/report.ts`, `shape.ts`, `provenance.ts`) | the IR-level grammar-gate plane made concrete: named gates (`shape` → FF1xxx, `provenance` → FF2xxx) returning `GateOutcome`-shaped results — the "grammar-level gates run HERE, once" plane (§2) |
| **cargo-backend-v0** | **MT's first deliverable** — `clippy.toml` renderer + firing harness (MT patch §8 stage 3 / P4 contract) | the second *rendering* backend, the one that forces the capability matrix to be real (clippy.toml caps out fast — no new lints — so ast-grep escape-hatch negotiation gets exercised) |

Only with L4-npm + B-research + cargo-v0 as three real reference points does the generic frame get
extracted (name the IR types, factor the shared renderer contract). Extracting it earlier — from
one or two backends — risks the union-IR the R-phase rejected (MT patch §9 p.1).

## §8 Honest environment caveat (P4)

The cargo firing harness can be **authored** in the MT umbrella but **not live-verified** until a
Rust toolchain is present. Verified this session (MT patch §10 P4): the Rust toolchain (`cargo`,
`rustc`, `clippy`) is ABSENT in the current dev env; only `ast-grep 0.44.0` is installed. The P4
firing-test contract
(`{command: "cargo clippy --message-format=json", jsonPath: "$.message.code.code", expectedCode:
"clippy::disallowed_methods"}`) is **grounded in documentation** (MT patch §2 JSON-diagnostics row +
rustc `DiagnosticCode`), not invented — but no `cargo clippy` run has confirmed the JSON path
end-to-end. The MT umbrella MUST run P4's live-fire on a Rust-toolchain env before claiming the
cargo backend green; a designed-but-unfired firing harness is `#discipline-theatre` if shipped as
"working" (T15 — the frame's own firing tests must actually fire). P5 (ast-grep) and P6 (status-line
render) WERE live/demonstrated this session and need no re-run.

## §9 What MT is NOT (non-goals)

- **NOT a union-IR / universal AST** (MT patch §9 p.1). The narrow-core + capability matrix is the
  whole point; a node carries no toolchain-specific fields.
- **NOT a runner.** Every firing test and doc-test targets an *existing* per-toolchain harness
  (RuleTester / cargo / go test / pytest / JUnit) — "we build no runner" (MT patch §8 p.3).
- **NOT one commit.** cargo-v0 is one deliverable; generalize-from-three is a separate, later step;
  surface 6 (drift detector) is post-MVP. Collapsing them is a scope violation the kickoff STOP-lines
  forbid.
- **NOT a product-scope widening on its own authority.** Treating MT as product scope requires the
  README widening (TS/React pin → multi-toolchain), which is a deliberate maintainer edit
  (Artifact Ownership Contract) — surfaced, not decided, in the decisions doc.
- **NOT `doc-level | process` selectors at v0** — deferred to the self-hosting milestone (§3).

### Deferred invention milestones (patch §9.1 — "do not lose")

MT patch §9.1 names four inventions under a verbatim "do not lose" banner — no ecosystem has them,
getff would be building genuinely new ground. None of the four are v0 scope; each is dispositioned
here explicitly so a future stage session does not have to guess deferred-vs-dropped:

- **(a) LLM-taint as a typed IR property** — **NOT** a v0 `ConventionNode` field. The v0 node (§3)
  stays minimal per MT patch §9 p.2, which fixes the v0 node shape and descopes `doc-level|process`;
  adding a taint field now would be exactly the kind of union-IR scope creep §2 rejects. At v0, taint
  stays a **frontend-boundary provenance concern** — the existing taint banner (frontends emit LLM
  output only behind a provenance gate, §~44 above) — not an IR-level typed property. It becomes a
  typed IR property only at this post-MVP milestone, if/when triggered.
- **(b) Convention-lifecycle-as-data** — post-MVP milestone. The repo's own Class A/B/C practice
  ([reviewer-discipline.md §5](../../../.claude/rules/reviewer-discipline.md),
  [ci-tool-pinning.md §6](../../../.claude/rules/ci-tool-pinning.md)) exported to consumers as
  promotion/demotion/retirement-with-evidence-triggers data, once a real consumer need surfaces it.
  Out of cargo-v0 scope.
- **(c) Dead-convention detection** — post-MVP milestone, knip/deptry-shaped (rule never fires across
  the consumer corpus in N months ⇒ retirement signal). Out of cargo-v0 scope.
- **(d) Unified suppression discipline** — post-MVP milestone, RUF100/`--report-unused-disable-
  directives`-shaped (one suppression IR object rendering to `//nolint` / `# noqa` /
  `eslint-disable` + one unused-suppression audit). Out of cargo-v0 scope.

All four are **tracked, not v0** — the same "post-MVP milestone" status as render surface 6 (§5).
They are not re-litigated per stage; a stage that wants to pull one forward must do so as an explicit,
separate scope decision, not by osmosis during S1/S2/S3.

**§9 p.12 cross-pollination invariant — a standing rule, not a deferred item.** MT patch §9 p.12
records a maintainer directive: when toolchain X lacks a mechanism, the backend ports the
best-of-class mechanism from another ecosystem rather than dropping the capability. Unlike (a)-(d)
above, this is **already honored in substance today**, not something deferred: the ast-grep escape
hatch fills the Rust/Python declarative-rule gap (§2 "Python enters via ast-grep escape hatch by
default"; MT patch §9 p.8/P5), and `assert-tier` (§6) generalizes Go's `Output` tier + rustdoc
`compile_fail` across every doc-test backend. This invariant is **standing** — every current and
future backend (S2's cargo-v0 included) MUST follow it when it hits a per-toolchain gap; it is not a
milestone to schedule.

## §10 See also

- [research-patches/2026-07-02-multi-toolchain-generalization.md](../../meta-factory/research-patches/2026-07-02-multi-toolchain-generalization.md) — the R-phase base (§8 sketch, §9 v0.2, §10 probe results incl. P4–P6).
- [.claude/orchestrator-prompts/multi-toolchain-convention-compiler/kickoff.md](../../../.claude/orchestrator-prompts/multi-toolchain-convention-compiler/kickoff.md) — the MT umbrella kickoff (stages, AI-traps, STOP lines).
- [../plans/2026-07-03-multi-toolchain-convention-compiler.decisions.md](../plans/2026-07-03-multi-toolchain-convention-compiler.decisions.md) — the four tier-vocab names + two owner decisions (README widening, AGENTS.md ownership).
- [specs/2026-07-02-diagnostics-core-design.md](2026-07-02-diagnostics-core-design.md) — D1: the FF-code diagnostics model that is MT's IR-level error language.
- [.claude/orchestrator-prompts/rule-research-trust-tiers/kickoff.md](../../../.claude/orchestrator-prompts/rule-research-trust-tiers/kickoff.md) — the ecosystem-adapter seam MT's frontends/detectors ride (`{toolchain, stack}` parametrization).
- [packages/core/synthesizer/types.ts](../../../packages/core/synthesizer/types.ts) — the `ManifestCheck` union (`engine?: 'eslint-restricted' | 'ast-grep'`) that is the embryo of the IR node's rule surface.
- [packages/core/research/gates/report.ts](../../../packages/core/research/gates/report.ts) — the B-research gate plane (named gates, the IR-level grammar-gate reference backend).
