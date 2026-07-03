# Stage B (validator-chain) — research pipeline as named gates — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Authoritative for:** implementation sequencing of stage B (research pipeline re-expressed as named gates): the `research/gates/` build order, the `shape`/`provenance` gate decomposition, the research-side report shape, RED-first paired-negative order, the `tier1ReasonToDiagnostic`-cleanup decision, commit/PR discipline.
> **NOT authoritative for:** the stage-B *design/scope* — owned by the [spec §9](../specs/2026-07-02-diagnostics-core-design.md); the D1 shapes B builds on — owned by the [D1 spec §3.3/§3.4](../specs/2026-07-02-diagnostics-core-design.md) + [D1 decisions](2026-07-02-diagnostics-core-impl.decisions.md); trust-tier resolver design — owned by [`.claude/rules/research-source-trust.md`](../../../.claude/rules/research-source-trust.md); project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).

## Pre-merge caveat (READ FIRST)

This plan was authored from the **D1 shapes on branch `feat/diagnostics-core-d1`** (HEAD `49362297a`), **before** D1 merges to `staging`. D1 is complete, green, and self-reviewed; only its merge is owner-blocked by an **unrelated pre-existing staging issue** (#861 F1). Consequences (binding):

- **B's IMPLEMENTATION is gated on D1 landing on `staging`.** B branches from a D1-containing `staging`. Do NOT start B's code before D1 is on `staging`.
- The D1→B merge reconciliation is expected to be a **cosmetic guard only** — the shapes recorded here are final (D1 is done, not in flux). The one moving part is the shared `allowlist-resolver.ts` (also touched by the `trust-tiers-did-review` line — see the coupling note below). **Re-confirm every `file:line` in this plan at B implementation time** (`git grep` the symbol, not the line number — resolver lines drift ~10/edit, see D1 decisions "Drift summary").
- Every shape claim below carries a `file:line` from the **live `feat/diagnostics-core-d1` tree** (T3 empirical). Where spec §9's sketch and the code diverge, **the code is truth** — divergences are flagged inline.

## Goal

Re-express `checkResearchPlan`'s internals as **named gates** (`shape`, `provenance`) mirroring the L4 aggregator pattern ([`validator/validate.ts`](../../../packages/core/validator/validate.ts)), producing a **research-side report** `{ok, gates: {…}}` that mirrors `ValidationReport` (a research-specific gate map — **NO generic aggregator over both plan types**, spec §9 explicit). The public dual API from D1 (`checkResearchPlan` → diagnostics, `validateResearchPlan` → throws with `.diagnostics`) is **unchanged**; all current callers are untouched (zero behavior change).

## Architecture

D1 already delivered the diagnostic model (`Diagnostic {code, severity, path?, params, message}`), the FF registry, and the accumulation dual API. **Today `checkResearchPlan` accumulates inline** — one flat loop that runs the ajv shape check then walks every entry's provenance ([`validate-plan.ts:61-103`](../../../packages/core/research/validate-plan.ts)). Stage B **factors that inline accumulation into two named gate functions** and an aggregator, symmetric to L4's `validate()`:

- `runShapeGate(plan) → GateOutcome` — the ajv shape check (FF1001), wrapping `validateResearchPlanShape` + `ajvErrorsToDiagnostics`.
- `runProvenanceGate(plan, ctx?) → GateOutcome` — the per-entry provenance walk (FF2xxx), wrapping `resolveAllowedSources` + `validateProvenance`.
- A pure aggregator (research-side) that runs `shape` first and **skips `provenance` when `shape` fails** (short-circuit, same discipline as `validate.ts:24-31`), returning `ResearchValidationReport {ok, gates: {shape, provenance}}`.
- `checkResearchPlan` becomes a **thin adapter** over the aggregator: flatten the report's gate failures into the `PlanCheckResult.diagnostics` array it returns today. `validateResearchPlan` stays the throw-adapter over `checkResearchPlan` — **byte-unchanged**.

This is **symmetry by pattern, not by abstraction**: the research report is a *separate* type with a *research-specific* gate map; there is deliberately no generic `Report<G>` parameterized over plan types (that question is designed later on 3 data points — L4 + B + the Rust pipeline, spec §9 / MT umbrella, explicitly OUT of B).

## Tech Stack

TypeScript (Node 20+, ESM, `.ts` imports), vitest, Ajv (already a dep, via `internal-validators.ts` + `diagnostics/ajv.ts`), **zero new npm dependencies**. Reuses the D1 `diagnostics/` package (`diag`, `Diagnostic`, `ajvErrorsToDiagnostics`) and the L4 `GateOutcome`/`GateFailure` shape ([`validator/types.ts:8-20`](../../../packages/core/validator/types.ts)) — see DN-B-2 on whether to reuse that type or mint a research-local twin.

## Global Constraints

- **Zero behavior change for current callers** (D1 AC-3, unchanged for B). The `validateResearchPlan` consumers: [`synthesizer/file-clients.ts:46`](../../../packages/core/synthesizer/file-clients.ts), [`synthesizer/cli.ts:69`](../../../packages/core/synthesizer/cli.ts), [`packages/meta-factory/src/research/index.ts:6`](../../../packages/meta-factory/src/research/index.ts) (re-export), and `checkResearchPlan`'s own throw-adapter. The 1-arg Tier-0 wrapper's 3 consumers (`load.ts:14`, `validate-plan.ts:14`, `research-adapter-anthropic.ts:9`) are untouched by B. **Existing suites stay untouched-green** — `validate-plan.test.ts`'s accumulation + fidelity asserts (`:104-196`) are the primary backstop; they must pass byte-unchanged.
- **NO generic aggregator over both plan types** (spec §9). Research report is a research-specific type. No `renderer framework`. No D2 at-touch migrations (`InstallReport`/`VerifyResult`/`DriftReport`/`ProvenanceMismatch`). No multi-toolchain / cargo / Convention Compiler work (future MT umbrella — explicitly NOT stage B).
- **TDD, RED-first**: one paired-negative per gate, each observed **RED before** its gate exists / is wired. Schema-fail **skips** the provenance gate (short-circuit) — this skip is itself paired-negative-tested (a shape-invalid plan must yield a `skip` provenance outcome, not a `pass` and not a crash).
- **English-only** doc + code (principle 22). **≤600 lines** per markdown file (pre-commit gate) — this plan complies.
- **One PR onto `staging`** (branch from a D1-containing `staging`). Conventional commits; one logical commit per Task where practical.
- **Capability commit**: B adds a new `packages/core/research/gates/` subdir with files likely ≥50 LOC → capability commit → `Prior-art:` trailer required (see §Capability-commit note).

## Live-tree findings (spec §9 sketch vs code — T3, `file:line` on `feat/diagnostics-core-d1`)

### F1 — scopeLock and ackFile are NOT separable gates (they fold into `provenance`)

Spec §9 says "*and — if S2 shipped them as separate checks — `scopeLock` and `ackFile`*". **Verified against the live resolver: S2 did NOT ship them as separable checks.**

- **scope-lock is inline inside `validateProvenance`/`validateUrlAgainstTiers`**, not a standalone function: the Tier-1 cross-package check ([`allowlist-resolver.ts:290-293`](../../../packages/core/research/allowlist-resolver.ts) → `FF2010`) and the Tier-2 scoped-ack check ([`:308-311`](../../../packages/core/research/allowlist-resolver.ts) → `FF2012`) are two branches within the tier walk. There is no `checkScopeLock(...)` seam to lift into a gate.
- **ack-file validation happens at resolve time, not provenance time**: `loadAckFile` ([`:70-120`](../../../packages/core/research/allowlist-resolver.ts)) throws `AckFileError` (→ `FF2014`) during `resolveAllowedSources` ([`:181-184`](../../../packages/core/research/allowlist-resolver.ts)), which runs **once per `checkResearchPlan` call** ([`validate-plan.ts:76`](../../../packages/core/research/validate-plan.ts)), before any per-entry provenance walk. It is a fail-closed load-time throw, not a per-entry gate outcome.

**Conclusion:** the stage-B gate set is **two gates — `shape` and `provenance`** — not four. `scopeLock` folds into `provenance` (its FF2010/FF2012 diagnostics surface through the provenance gate's failures). `ackFile` is a resolve-time throw that the aggregator must decide how to surface (see DN-B-3). This matches spec §9's own conditional ("*if S2 shipped them as separate checks*") — S2 did not, so the condition is false.

### F2 — `checkResearchPlan` today is inline, not gate-structured

`checkResearchPlan` ([`validate-plan.ts:61-103`](../../../packages/core/research/validate-plan.ts)) runs the shape check ([`:66-69`](../../../packages/core/research/validate-plan.ts)) then a flat provenance loop ([`:77-99`](../../../packages/core/research/validate-plan.ts)) into one `diagnostics[]`. **It does NOT short-circuit** — provenance is checked even when shape fails (the `Array.isArray(patterns)` guard at `:71-74` lets both run independently, per the doc comment `:52-60`). Stage B's aggregator **introduces the short-circuit** (shape-fail ⇒ provenance `skip`) to mirror `validate.ts:24` — this is a **behavior refinement inside the accumulation, NOT a public-API change** (the public dual API returns the same "≥2 diagnostics" for the AC-2 test's two-independent-violations fixture ONLY IF the fixture keeps a *valid shape* on the provenance-failing entry — see DN-B-4: confirm the AC-2 fixture still yields ≥2 under short-circuit, or the short-circuit changes an asserted count).

### F3 — `tier1ReasonToDiagnostic` substring-bridge is at :342-350 (D1 residue)

The `tier1ReasonToDiagnostic` string-bridge ([`allowlist-resolver.ts:342-350`](../../../packages/core/research/allowlist-resolver.ts)) maps `tier1For`'s reason **strings** back to FF2xxx codes by `reason.includes(...)` — the exact stringly-typed pattern D1 exists to kill, surviving because `tier1For` returns `Tier1Result {ok, reason}` ([`:171-173`](../../../packages/core/research/allowlist-resolver.ts)) which D1 deliberately did **not** migrate (D1 decisions DN-D1-5: "*DO NOT touch `tier1For(...)`*"). This is the "natural cleanup opportunity" spec §9 / the task brief flags — resolved as **DN-B-1** below (a genuine fork: in B's scope or a separate follow-up).

## DECISION-NEEDED / open design points (surface at implementation — do NOT bake in silently)

### DN-B-1 — `tier1ReasonToDiagnostic` cleanup: in B, or a separate follow-up?

**The fork.** Folding `tier1For` into the named `provenance` gate is the point where the `tier1ReasonToDiagnostic` substring-bridge ([`allowlist-resolver.ts:342-350`](../../../packages/core/research/allowlist-resolver.ts)) *could* be eliminated: change `tier1For` to return code-carrying failures (`Diagnostic | Tier1Ok`) directly, so `validateUrlAgainstTiers:302` reads the code off the result instead of re-deriving it from a string. But `tier1For` is on the **trust-tiers-owned resolver surface**.

- **Option A — do it in B.** Change `tier1For`'s return type from `Tier1Result {ok, reason}` to a code-carrying shape; delete `tier1ReasonToDiagnostic`. Consequence: kills the last stringly-typed reason-bridge in the research pipeline (aligns with D1's whole-purpose); but changes a **trust-tiers-designed API** (`Tier1Result` is exported, referenced by `research-source-trust.md`'s tier model) and touches `tier1.test.ts` (which reads `tier1For(...).reason` at `:150-153` per D1 decisions DN-D1-5) — a second migration on a file the trust-tiers umbrella also edits.
- **Option B — separate follow-up.** Leave `tier1For` + `tier1ReasonToDiagnostic` as-is in B; file a follow-up (trust-tiers handoff) to migrate `tier1For` to codes. Consequence: B stays a clean single-concern "research pipeline as gates" PR with zero trust-tiers-surface edits; the substring-bridge lives one more cycle.

**Editability check (T3):** `allowlist-resolver.ts` **is editable** (D1 already migrated `validateProvenance` in it; D1 decisions DN-D1-5 confirms "`allowlist-resolver.ts` is explicitly 'now yours'"). The **forbidden set is only** [`.claude/rules/research-source-trust.md`](../../../.claude/rules/research-source-trust.md) + [`packages/core/principles/30-research-source-trust.test.ts`](../../../packages/core/principles/30-research-source-trust.test.ts) (both verified present, both off-limits). So Option A is *mechanically* B's to make — **but** `Tier1Result` is a trust-tiers-*designed* contract; changing its shape is an **API-ownership question**, not a file-permission one. **Recommended lean (not baked): Option B** — B's stated scope is "research pipeline as named gates", and `tier1For`'s return-type change is a resolver-internal API change that widens B's blast radius onto the trust-tiers surface and its tests. Keep B single-concern; hand the `tier1For`→codes migration to a trust-tiers-owned follow-up. **Maintainer/implementer decides at impl with the AC-2/tier1.test.ts diff in hand.**

### DN-B-2 — reuse L4 `GateOutcome`/`GateFailure`, or mint a research-local twin?

Spec §9 says each gate "*returns `GateOutcome`-shaped results with `code`-carrying failures*". Two readings:

- **Option A — import the L4 `GateOutcome`/`GateFailure`** from [`validator/types.ts`](../../../packages/core/validator/types.ts) verbatim. Consequence: literal type identity, zero duplication; but couples the research pipeline to the L4 validator's type module (a cross-package-directory import `research/ → validator/`), and `GateFailure.reason: string` + `code: string` was shaped for L4's gate branches (`ruleId?` field is L4-specific).
- **Option B — mint a research-local `ResearchGateOutcome`** with a `Diagnostic[]` failure list (not `GateFailure[]`). Consequence: the research gate carries full `Diagnostic` objects (research already speaks `Diagnostic`, unlike L4 which speaks `GateFailure` + a `to-diagnostics` adapter), so `checkResearchPlan` flattens `report.gates.*.diagnostics` with no re-wrap; but it is a *second* gate-outcome shape (mild "symmetry by pattern" divergence — the shapes rhyme but aren't identical).

**Recommended lean (not baked): Option B** — the research pipeline is natively `Diagnostic`-typed (D1 made `validateProvenance → Diagnostic | null`), so a research gate whose `failures: Diagnostic[]` is the honest shape; L4 needed `GateFailure` + adapter because its gates predate `Diagnostic`. "Symmetry by pattern, not abstraction" (spec §9) *supports* a rhyming-but-distinct type over a forced shared one. **Decide at impl.**

### DN-B-3 — how does the `provenance` gate surface the `AckFileError` throw (F1)?

`resolveAllowedSources` throws `AckFileError` (FF2014) at load time, before the per-entry walk. In a gate-structured world, a throw mid-aggregator is awkward.

- **Option A — let it propagate** (status quo). `checkResearchPlan` already lets `resolveAllowedSources(ctx)` throw ([`validate-plan.ts:76`](../../../packages/core/research/validate-plan.ts) — no try/catch); a malformed ack file throws out of `checkResearchPlan` today. Keep that; the `provenance` gate only runs *after* a successful resolve. Zero behavior change.
- **Option B — catch and convert to a gate failure**. Wrap the resolve in the aggregator; on `AckFileError`, emit a `provenance` gate `fail` carrying the error's `.diagnostics` (the FF2014 diagnostic D1 already attached, [`allowlist-resolver.ts:60-67`](../../../packages/core/research/allowlist-resolver.ts)). Consequence: uniform "everything is a gate outcome"; **but** it changes behavior — a malformed ack file currently *throws* (callers see an exception), and converting to a returned failure is an AC-3 behavior change unless every caller is re-checked.

**Recommended lean (not baked): Option A** — preserve the throw (zero behavior change, AC-3). The ack-file malformed case is a fail-closed *load* error, not a per-entry validation outcome; keeping it a throw is honest to F1. **Decide at impl after grepping whether any caller distinguishes throw-vs-failure for ack errors.**

### DN-B-4 — does the short-circuit (F2) change the AC-2 accumulation count?

Stage B introduces shape-fail ⇒ provenance-`skip` (mirroring `validate.ts:24`). The existing AC-2 test ([`validate-plan.test.ts:104-160`](../../../packages/core/research/validate-plan.test.ts)) asserts a two-independent-violations fixture yields **≥2 diagnostics** (1 FF1001 shape + 1 FF2xxx provenance). **That fixture's shape-failing entry (`bad-shape-entry`, missing `summary`) makes the WHOLE plan shape-invalid** — so under a strict short-circuit, provenance would be *skipped* and the count would drop to 1 (only FF1001), turning that existing test RED. **This is a real tension the implementer MUST resolve before writing the aggregator**:

- **Option A — shape gate is per-plan, short-circuit as L4 does** → AC-2 fixture yields 1 diagnostic → the existing test breaks. Requires editing `validate-plan.test.ts` (an existing suite — normally untouched-green). REJECT unless spec §9 intends this (it does not — "callers untouched").
- **Option B — provenance still runs on shape-valid *entries* even when other entries are shape-invalid** (preserve today's independent-accumulation semantics; the "short-circuit" applies only to *hard* top-level shape failure where `patterns` isn't even an array). This keeps the AC-2 count at ≥2 and `validate-plan.test.ts` byte-unchanged. The "schema-fail skips downstream gates" discipline then means: *a plan whose top-level schema is so broken there's nothing iterable* skips provenance — matching today's `maybePatterns === undefined` guard ([`validate-plan.ts:71-74`](../../../packages/core/research/validate-plan.ts)).

**Recommended lean (not baked): Option B** — it satisfies both "schema-fail skips downstream" (for un-iterable plans) AND "callers untouched" (AC-2 fixture unchanged). This is the reading that keeps `validate-plan.test.ts` green. **Confirm at impl by running the existing AC-2 test against the new aggregator BEFORE touching any fixture — if it goes RED, the short-circuit is too aggressive (Option A leaked in).**

## Tasks (TDD, RED-first; checkboxes for `executing-plans`)

> **Precondition (binding):** D1 is merged to `staging`; B branches from that `staging`. Run the pre-dispatch in-flight probe (CLAUDE.md Operational conventions) + re-confirm F1-F3 `file:line` against the branch tip before Task 1.

### Task 0 — baseline re-confirm (no code)
- [ ] 0.1 `git grep -n 'tier1ReasonToDiagnostic\|tier1For\|validateUrlAgainstTiers' packages/core/research/allowlist-resolver.ts` — re-anchor F1/F3 line numbers on the D1-merged `staging`.
- [ ] 0.2 Run `npx vitest run packages/core/research/validate-plan.test.ts` — capture the current green baseline (the untouched-green target).
- [ ] 0.3 Resolve DN-B-1..4 with evidence (or escalate DN-B-1 to the maintainer). Record each resolution inline in the eventual PR body.

### Task 1 — `shape` gate (RED first)
- [ ] 1.1 **RED**: write the `shape`-gate paired-negative in a new `research/gates/shape.test.ts` — a shape-invalid plan yields a `GateOutcome`-shaped `fail` with an `FF1001` diagnostic; a valid plan yields `pass`. Observe RED (gate doesn't exist yet).
- [ ] 1.2 `research/gates/shape.ts` — `runShapeGate(plan) → outcome` wrapping `validateResearchPlanShape` + `ajvErrorsToDiagnostics` ([reused from D1](../../../packages/core/research/validate-plan.ts) `:66-69`). GREEN.

### Task 2 — `provenance` gate (RED first)
- [ ] 2.1 **RED**: `research/gates/provenance.test.ts` — a plan with one out-of-allowlist provenance URL yields a `fail` carrying an `FF2xxx` diagnostic (scope-lock FF2010/FF2012 surface HERE per F1); a plan with valid provenance yields `pass`. Observe RED.
- [ ] 2.2 `research/gates/provenance.ts` — `runProvenanceGate(plan, ctx?) → outcome`, lifting the per-entry loop from [`validate-plan.ts:77-99`](../../../packages/core/research/validate-plan.ts) (resolve once via `resolveAllowedSources`, walk entries, thread `entryPackage`). GREEN.

### Task 3 — research-side aggregator + report (RED first)
- [ ] 3.1 **RED**: `research/gates/report.test.ts` — the short-circuit paired-negative: a plan whose top-level shape is un-iterable (`patterns` not an array) yields `provenance` outcome `skip` (NOT `pass`, NOT a crash); a shape-valid-but-provenance-invalid plan yields `shape:pass, provenance:fail`. Observe RED. (Resolve DN-B-4 first — the fixture design depends on it.)
- [ ] 3.2 `research/gates/report.ts` — `ResearchValidationReport {ok, gates: {shape, provenance}}` type (DN-B-2 shape) + a pure aggregator running `shape` then (short-circuit-aware, DN-B-4) `provenance`. GREEN.

### Task 4 — re-wire `checkResearchPlan` as a thin adapter (zero-behavior-change)
- [ ] 4.1 Re-express `checkResearchPlan` ([`validate-plan.ts:61-103`](../../../packages/core/research/validate-plan.ts)) to call the aggregator and flatten `report.gates.*` failures into the same `PlanCheckResult.diagnostics` array it returns today. `validateResearchPlan` throw-adapter (`:124-151`) **byte-unchanged**. The `EntryIdMap` path-attribution (`:82-95`) must survive — decide whether it lives in the `provenance` gate or the flatten step.
- [ ] 4.2 Run `npx vitest run packages/core/research/validate-plan.test.ts` — **must be byte-unchanged-green** (AC-2 accumulation `:104-160`, NEW-3 fidelity `:174-196`, B2-closure `:30-94`). If any goes RED, the re-wire changed public behavior — STOP, the short-circuit or the flatten drifted (revisit DN-B-4).
- [ ] 4.3 (DN-B-1 = Option A only) migrate `tier1For` → code-carrying return; delete `tier1ReasonToDiagnostic`; migrate `tier1.test.ts` reason-reads. **Skip this task entirely if DN-B-1 = Option B** (file the follow-up instead).

### Task 5 — acceptance + capability obligations
- [ ] 5.1 `npx vitest run packages/core/` green; the 3 gate paired-negatives (1.1/2.1/3.1) were RED-first.
- [ ] 5.2 Zero-behavior-change sweep: the `validateResearchPlan` callers (`file-clients.ts:46`, `cli.ts:69`, `meta-factory` re-export) + the 1-arg-wrapper's 3 consumers — existing suites untouched-green. No L4 / `validator/` file touched (B is research-only).
- [ ] 5.3 Principle 09 (headers) + 22 (English) green; new `research/gates/*.ts` are code (no `REQUIRED_HEADER_DOCS` entry — sentinel stays 85, D1 baseline). §1.7 Forward/Backward in the PR body; md files < 600 lines.
- [ ] 5.4 Capability-commit: `Prior-art:` trailer on the commit introducing `research/gates/` (see §Capability-commit note).

## Acceptance → spec §9 mapping

Every spec §9 bullet has a home above:

- "*named gates `shape` / `provenance` … `GateOutcome`-shaped, `code`-carrying*" → Task 1 + Task 2 (+ F1: scopeLock/ackFile fold into `provenance`, not separate gates).
- "*research-side report `{ok, gates: {…}}` mirroring `ValidationReport`; NO generic aggregator*" → Task 3 (DN-B-2: research-specific type, not a shared abstraction).
- "*public dual API unchanged; callers untouched*" → Task 4.2 + Task 5.2 (untouched-green sweep).
- "*paired negatives, one per gate, each RED first; schema-fail skips downstream*" → Tasks 1.1 / 2.1 / 3.1 (RED-first) + Task 3.1 (short-circuit, DN-B-4).

Do not close B until each is verified with a command + observed output (T3), not "would".

## Out of B's scope (recorded so B stays one PR)

- **Generic gate framework** parameterized over plan types (L4 + research). Designed later on 3 data points (L4 + B + Rust pipeline) — MT umbrella, spec §9.
- **Renderer framework** (D1 shipped one adapter `to-diagnostics.ts`; B adds none).
- **D2 at-touch migrations**: `InstallReport`, `VerifyResult`, `DriftReport`, `ProvenanceMismatch` (spec §4 — gain `code` when *next touched*, not by B).
- **Multi-toolchain / cargo / Convention Compiler** — the future MT umbrella, explicitly NOT stage B (spec §9).
- **`tier1For`→codes migration IF DN-B-1 = Option B** — a trust-tiers-owned follow-up, not B.

## Capability-commit note

B adds a new subdirectory `packages/core/research/gates/` with files likely ≥50 LOC (the two gate functions + aggregator) → **capability commit** (`.husky/pre-push` detects "new file ≥50 LOC under a new subdirectory of `packages/core/<new-dir>/`"; `research/gates/` is a new dir). The diagnostics model + gate pattern are **already covered by SSOT #189–#194** (rustc REFERENCE, tsc ADAPT, SARIF KEEP-NARROW, zod ADOPT-VOCAB, Fowler ADAPT, ajv ADOPT) landed in the D1 PR — B **reuses** that model, adding no new capability *class*. So B's trailer is a **REUSE/escape-hatch** citation, not a new SSOT entry:

```text
Prior-art: prior-art-evaluations.md#193 (Fowler Notification, ADAPT — B re-expresses the D1 accumulation as named gates; the aggregator+short-circuit pattern is ADOPTED from validator/validate.ts, itself covered by the D1 diagnostics SSOT set #189-#194). No new capability class — REUSE of the D1 model.
```

Confirm at impl whether the pre-push parser accepts the REUSE-citation form or wants the escape hatch (`Prior-art: skipped — reuses D1 diagnostics model (SSOT #189-#194), no new capability class`). If a genuinely new pattern surfaces (it should not — B is a re-expression), add an SSOT entry in the same commit per CLAUDE.md.

## §1.7 obligation for the B PR

The eventual B PR body MUST carry the §1.7 Forward/Backward self-reflexive block (per [phase-research-coverage.md §1.7](../../../.claude/rules/phase-research-coverage.md)):

- **Forward-check:** complies with `no-paid-llm-in-ci.md` (gates are deterministic vitest/TS, zero API calls); `build-first-reuse-default.md` (REUSE of the D1 diagnostics model + the L4 aggregator pattern — no BUILD-without-search); `doc-authority-hierarchy.md` (this plan carries the header above); `dual-implementation-discipline.md §2(iv)` (research gates are TypeScript package capabilities under `packages/core/research/gates/`, not a hook/agent/skill delivery-channel artefact — §2 non-trigger, no portable-fallback triage).
- **Backward-check:** codifies spec §9 (research pipeline as named gates) mirroring the L4 pattern; supersedes nothing; the D1 accumulation dual API is re-expressed, not replaced. Self-applies — the RED-first paired-negative per gate is the same discipline the L4 gates ship with.

## Commit / PR discipline

- Branch from a **D1-containing `staging`** (precondition above); **one PR** onto `staging`. Conventional commits; one logical commit per Task where practical so a long run lands durably.
- Do NOT push to `main` (git-safety blocks base=main). Do NOT open a second PR beyond this umbrella (surface any adjacent systemic finding as an observation per CLAUDE.md PR strategy).
- Do NOT edit the forbidden trust-tiers set (`.claude/rules/research-source-trust.md`, `packages/core/principles/30-research-source-trust.test.ts`). `allowlist-resolver.ts` is editable, but touching `tier1For`'s API (DN-B-1 Option A) is an API-ownership call — escalate if unsure.
