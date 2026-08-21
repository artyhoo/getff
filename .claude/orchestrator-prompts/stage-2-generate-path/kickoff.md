# stage-2-generate-path — the LLM generate-path (rules-factory) for #646 Stage 2

- **Type:** mixed. Stage 0 = R-phase (reuse gate, doc output). Stages 1+ = implementation (capability commits) — scope contingent on the Stage-0 verdict.
- **Opened:** 2026-06-22.
- **Base:** staging.
- **Issue:** [#646](https://github.com/Yhooi2/rules-as-tests-aif/issues/646) **Stage 2** — fires the deferred Phase-5 v2 trigger ([open-questions.md §13.10](../../../docs/meta-factory/open-questions.md)).
- **Brainstorm SSOT:** [docs/superpowers/specs/2026-06-22-stage-2-generate-path-design.md](../../../docs/superpowers/specs/2026-06-22-stage-2-generate-path-design.md) — read it first; this kickoff operationalises it.
- **Forks ratified (operator, 2026-06-22):** entry point = **L3-live-first against the existing L4**; generation scope = **Path A only** (Path B out of scope, separate later trigger). Do NOT re-litigate (see "Already decided").

## What

Turn the deterministic v1 pipeline (L1→L5, already shipped) into a **live generate-path**: a consumer points the tool at any stack and gets researched → synthesized → self-validated → installed enforcement rules, install-time on their own subscription, **never in CI**. This is the goal README §Methodology names ([README.md:56](../../../README.md)); the Stage-1 curated presets are the proving cases.

**Reframe (load-bearing, verified against `staging` 2026-06-22):** Stage 2 is NOT "build the pipeline". All six layers exist deterministically — including **L4 (`packages/core/validator/`, gates 1/2/4/6 REQUIRED, Phase 7, commits `f24cd44`→`b5f2830`)**, which is provenance-agnostic (`validate(plan)` doesn't care whether the plan is a recipe or LLM output). Stage 2 = **swap curated inputs for live-LLM inputs at L2/L3, leave L4/L5 byte-identical.**

## Inputs (SSOT)

- Brainstorm spec (above) — §2 ground-truth table, §4-§5 fork rationale, §6 reuse gate, §7 sequence, §8 risks.
- [docs/meta-factory/architecture.md](../../../docs/meta-factory/architecture.md) §2.4–2.7 (L2/L3/L4/L5 contracts), §3 (Path A/B).
- [docs/meta-factory/open-questions.md §13.10](../../../docs/meta-factory/open-questions.md) entries #2 (Path A LLM gen + **unchecked-prior-art note**), #3/#4/#5 (Path B + gates 5/3 — all OUT of scope here).
- [docs/meta-factory/retros/phase-5.md](../../../docs/meta-factory/retros/phase-5.md) — deterministic-v1 pivot + v2-trigger precedent.
- Layer code: `packages/core/{detector,research,synthesizer,validator,installer}/`.

## Already decided — do NOT re-litigate

- **L4 is already built** — do not "build L4". Exercise/harden the existing one on non-curated input.
- **L3-live-first** holding L2 fixed (frozen curated `ResearchPlan`) — isolates the one new variable ("LLM picks from menu").
- **Path A only** — LLM configures existing plugins, never authors TypeScript. This keeps Stage-2 v1 inside the existing $0 deterministic gates (Path B is what would need gates 3+5).
- **No paid LLM in CI** ([no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md)) — generation is install-time on the consumer's subscription. Non-negotiable.
- **Curated presets stay authoritative** for their stacks even after live-gen (v2 = strict superset).

## Stages (stage-gated; later-stage scope is contingent on Stage 0)

### Stage 0 — R-phase: build-vs-reuse gate (BLOCKING, doc output, no code)

Discharge [spec §6](../../../docs/superpowers/specs/2026-06-22-stage-2-generate-path-design.md). Per [build-first-reuse-default.md §3](../../../.claude/rules/build-first-reuse-default.md): DeepWiki + WebSearch ≥3 phrasings each on **AIF `/aif-evolve`** (LLM-driven rule synthesis — already a dependency; possible REUSE of the L3-live step) and the **Oh My ClaudeCode** family; consult prior-art SSOT. Output: a research-patch under `docs/meta-factory/research-patches/` with a per-candidate ADOPT/ADAPT/BUILD verdict + new `prior-art-evaluations.md` entries. **Gate:** the verdict sets the scope of Stages 2-4 — if `/aif-evolve` is ADOPT/ADAPT, the L3-live build may collapse to integration. No L2/L3 code may land before this verdict.

**✅ R-phase discharged (2026-06-22):** [research-patch `2026-06-22-stage-2-generate-path-prior-art.md`](../../../docs/meta-factory/research-patches/2026-06-22-stage-2-generate-path-prior-art.md). Verdict: **`/aif-evolve` = REFERENCE → the L3-live synthesizer stays BUILD** (not integration — decisive primary-source evidence: different input, output, gate); **Oh My ClaudeCode = REJECT** (orchestration manager, no rule generation). 15 new SSOT entries appended (#154–#168); existing #1/#50/#66/#105 cross-linked, verdicts unchanged. Net Stage 2-4 scope: BUILD the menu-picker prompt + plan contract, REUSE the existing L4, ADAPT the test/UX patterns (Semgrep/OpenRewrite/GritQL gates; CEGIS/Reflexion loop; Renovate/Nx UX).

### Stage 1 — L4 adversarial hardening (no LLM, deterministic)

Hand-author deliberately-bad `SynthesisPlan` fixtures (tautological rule, never-firing rule, rule conflicting with an existing one); confirm gates 1/2/4/6 **reject** each. Snapshot-tested. This is the precondition that makes non-deterministic upstream safe — cheap, $0, fully testable. Paired valid/invalid corpus per principle 02.

### Stage 2 — L3-live, fixed plan, proving-case stack

LLM "picks from menu" against a **frozen** curated `ResearchPlan` for a proving-case stack (Next / react-spa / react-native). **Assert:** (a) the existing L4 accepts the output, (b) output rules match the curated recipe (regression oracle; empty or explainably-non-empty diff). Scope per Stage-0 verdict (REUSE vs BUILD).

### Stage 3 — L2-live, proving-case stack

Swap the frozen plan for live `web_search` under `allowed_domains` (the `allowlist.ts` API already mirrors Anthropic's, "friction-free upgrade" per phase-5 §5.3). Assert the live-researched plan still drives an L4-accepted synthesis. Revisit `drift.ts` cadence for live mode.

### Stage 4 — end-to-end, genuinely-new stack

Full L1→L5 on a stack with **no** curated oracle (candidate: SvelteKit/Vite — low-BUILD). The real proof the factory generalizes. Acceptance tolerates a small BUILD set (most rules ADOPT).

### Stage 5 — opt-in wiring

`--generate` / `AIF_RESEARCH=llm` flag, install-time on the consumer's subscription, degrades to `research-only` (emit `ResearchPlan` as findings report) when opted-out or when L4 rejects everything.

**OUT of scope (HARD):** Path B (LLM authors AST rule TS), gate 3 (Stryker mutation), gate 5 (two-AI review). Their own later trigger per [open-questions.md §13.10 #3/#4/#5](../../../docs/meta-factory/open-questions.md).

## Acceptance criteria

- ✅ **(met 2026-06-22)** Stage 0 research-patch lands with per-candidate verdict + SSOT entries before any L2/L3 code — [patch](../../../docs/meta-factory/research-patches/2026-06-22-stage-2-generate-path-prior-art.md), SSOT #154–#168.
- L4 rejects every adversarial fixture (Stage 1); existing gates unchanged.
- For ≥1 proving-case stack: LLM-sourced `SynthesisPlan` passes the existing L4 and reproduces the curated recipe (Stage 2).
- For ≥1 genuinely-new stack: full L1→L5 produces ≥1 L4-validated rule that catches its target antipattern (Stage 4).
- Next/react-spa/react-native curated paths stay byte-identical (`make self-audit` green).
- Zero paid-LLM-in-CI: all generation is install-time; CI cost = $0.

## Capability-commit discipline

Stages 1-5 introduce capability commits (new code under `packages/core/`). Each carries a `Prior-art:` trailer citing the Stage-0 SSOT entries per [CLAUDE.md «Build-vs-reuse invariant»](../../../CLAUDE.md). Each BUILT rule ships a paired valid/invalid test (principle 02), AST-over-grep where applicable (principle 03).

## AI-laziness traps (`.claude/rules/ai-laziness-traps.md` §2 — active for this umbrella)

Active traps for this umbrella: **T2**, **T3**, **T11**, **T12**, **T13**, **T15**, **T16**, **T20**.

- **T11 / T12** (don't design without prior-art / don't skip the literature sweep) — Stage 0 IS this trap's countermeasure; the reuse gate must run DeepWiki+WebSearch live, not from training-data confidence about `/aif-evolve`.
- **T13 / T16** (ADOPTED ≠ zero-work; pattern-matching-on-name) — if Stage 0 says `/aif-evolve` is ADOPT, verify its problem-class actually matches "LLM picks ESLint rules from a menu" before wiring it; "evolve" sounding adjacent is not evidence.
- **T2 / T3** (designing ≠ running; no prose-only findings) — every stage's claim needs command output (L4 accept/reject result, diff against curated recipe), not "would validate".
- **T15** (self-application) — the generated rules must satisfy the same principle 02/03 + doc-authority discipline the framework enforces on consumers; the generator is held to its own gate.
- **T20** (inline-verdict-without-evidence) — no ADOPT/BUILD call in Stage 0 without a preceding evidence-bearing tool call quoted in the same turn.
- **Domain-specific — T-S2-A:** the AI is tempted to "build L4" because the Stage-1 design doc says it doesn't exist. **File-verified FALSE** (`packages/core/validator/validate.ts`): L4 ships gates 1/2/4/6. Counter: exercise/harden the existing validator; do not author a parallel one (`#parallel-evolution-creep`).
- **Domain-specific — T-S2-B:** the AI is tempted to snapshot-test live L2/L3 output for determinism. Counter: the testable surface is the **L4 verdict on the output**, not the LLM's exact bytes — design tests around "does the plan pass the gates".

## §1.7 self-reflexive note

- **Forward-check:** complies with [no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md) (generation install-time on consumer subscription, never CI; Stage 0 research is author-time); [build-first-reuse-default.md](../../../.claude/rules/build-first-reuse-default.md) (Stage 0 IS the reuse gate — BUILD only after `/aif-evolve`/OMC verdict); [doc-authority-hierarchy.md §2-§3](../../../.claude/rules/doc-authority-hierarchy.md) (brainstorm spec + any Stage-0 patch carry headers); [kickoff-staging-placement.md §1](../../../.claude/rules/kickoff-staging-placement.md) (this kickoff must be merged to `staging` before any `/pipeline` or `/dispatcher` run).
- **Backward-check:** operationalises the 2026-06-22 brainstorm spec + the ratified forks; corrects (does not silently inherit) the Stage-1 design-doc L4-already-exists drift; fires the deferred Phase-5 v2 trigger per [2026-06-19-multi-stack-hybrid-design.md §4](../../../docs/superpowers/specs/2026-06-19-multi-stack-hybrid-design.md). Supersedes nothing.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
