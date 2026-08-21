# KICKOFF — guard-liveness **v1 / ESLint** (sub-wave of N9? umbrella)

> **Type:** I-phase (build). **Sub-wave v1 of the guard-liveness umbrella** — sibling sub-waves: v0 (audit, separate kickoff), v1.5 (command/script, kickoff after v0), v3 (manual via Superpowers, kickoff after v0). This brief is ESLint-only.
> **Design SSOT:** [docs/meta-factory/research-patches/2026-05-23-guard-liveness-gate.md](../../../docs/meta-factory/research-patches/2026-05-23-guard-liveness-gate.md) §3 sub-wave row v1.
> **Admission:** proposed candidate (see [wave-sequencing-plan.md §0](../../../docs/meta-factory/wave-sequencing-plan.md)). Launch order = maintainer call.
> **Parallel-start partner:** v0 audit kickoff at [guard-liveness-v0-audit/kickoff.md](../guard-liveness-v0-audit/kickoff.md) — different surface (audit doc), no shared state; v0 may re-scope v1.5/v3 but does not block v1.

## §0 Why this wave (origin)
[principle 02](../../../packages/core/principles/02-paired-negative-test.test.ts) checks that a rule *has* a `bad` example (structural) but never runs it through the real guard — its own header flags this as the deferred "Phase 5" limit (lines 14–16). Result: a guard could be decorative (green on a real violation) and nothing notices. This wave closes that for ESLint-type guards, change-scoped, at the earliest fitting channel.

## §1 Core deliverable
A **change-scoped guard-liveness gate** that, when a rule is added/changed, proves its `bad` corpus trips the real ESLint guard — every bypass variant — and that `good` stays clean. Plus the schema widening that makes "every bypass variant" expressible.

## §2 Scope (v1 — ESLint only; hold the line)
**IN:**
1. **Schema:** `NegativeTest.input: string` → `string[]` ([synthesizer/types.ts:14-17](../../../packages/core/synthesizer/types.ts) + `rules-manifest.schema.json` + manifest data). ≥1 required. Accept bare string as 1-element array (migration shim) OR migrate manifest in-PR — implementer picks, documents which.
2. **pre-commit gate (structural):** changed rule has a non-empty `bad` corpus (≥1 entry).
3. **pre-push gate (liveness, change-scoped):** for each rule touched in the diff with `check.type === 'eslint'`, run the reused `gate-rule-tester` roundtrip — every `input` → violation; `examples.good` → clean. Block on failure. Lives beside `s17`/`prior-art` in `packages/core/hooks/`.
4. **principle 02 extension:** assert the `bad` array is non-empty AND variants are distinct (anti-tautology, mirrors existing `bad !== good` arm).

**OUT (v1 — do NOT build; record as follow-up with trigger):**
- CI/pre-merge **full-sweep** of all guards (guard-rot regression) → v2; shares the "expensive on full set" property with the deferred Stryker gate ([open-questions.md:120](../../../docs/meta-factory/open-questions.md)).
- `check.type ∈ {manual, command, script}` liveness → unsolved "how to inject a violation into a manual rule" research question. Out of scope; §7.

## §3 Method (MANDATORY before any code — BFR-default §3 + [phase-research-coverage.md §1](../../../.claude/rules/phase-research-coverage.md))
The design patch's BUILD verdict is **provisional** — only 1 WebSearch phrasing was run. Before writing the BUILD `Prior-art:` SSOT row:
1. **Complete the search-coverage checklist:** ≥2 more WebSearch phrasings + a DeepWiki re-probe on "declarative lint-rule negative-test liveness gate / pre-push". Cite results. If a production tool surfaces → flip BUILD→ADOPT and STOP for re-scope.
2. **Reuse, don't rebuild:** the roundtrip engine is [`gate-rule-tester.ts`](../../../packages/core/validator/gate-rule-tester.ts). Confirm you are wrapping it, not re-implementing ESLint `Linter` invocation.
3. **Channel basis:** re-read [rule-enforcement-channel-selection.md §3](../../../.claude/rules/rule-enforcement-channel-selection.md) — declare the chosen channel in each new check's header.

## §4 Discipline obligations on the implementing PR
- **Capability commit** (new dep? new ≥50/80 LOC files?) → `Prior-art:` trailer citing the completed §3 verdict + this patch.
- **§1.7 self-reflexive** trailer (rule/principle/schema change touches discipline surface) — H3 `### §1.7 Forward/Backward-check applied` + ≥1 file:line in BOTH sections.
- **Stryker ≥80% (D4)** on the new TS check logic — run locally, record the score (per the s17/prior-art precedent).
- **principle 02** must stay green after the array migration (update its arms in the same commit).
- **Self-application (recursive):** this gate guards *rules*; ensure the project's own ESLint guards each gain a multi-variant `bad` corpus where one is currently thin — the gate must pass on its own repo.

## §5 AI-laziness traps (per [.claude/rules/ai-laziness-traps.md §3](../../../.claude/rules/ai-laziness-traps.md) — cite + enumerate + extend)
Active: **T2** (designing the check ≠ running it — run it against the real manifest, report findings), **T3** (file:line / command-output per claim — no prose-only "it works"), **T5** (this is I-phase: don't smuggle unrelated rule edits — only the gate + schema), **T11** (prior-art BEFORE proposing — §3 step 1 is non-negotiable; the verdict is provisional), **T13** (`gate-rule-tester` is ADOPTED — confirm it actually covers OUR roundtrip need, don't assume), **T15** (self-application — the gate must run green on this repo's own guards, §4 last bullet), **T16** (pattern-matching-on-name — "RuleTester" / "negative-test" sound like the whole job; verify the engine's roundtrip semantics match per-bypass-variant blocking, not just single-case).
Domain-specific:
- **T-GLG-A:** «schema is `string[]` now → all rules have multiple bypass variants». FALSE after a string→[string] shim — a 1-element array is still one variant. Counter: report how many rules actually gained a *second* variant vs. trivially wrapped; don't claim "all bypass attempts covered" from the type change alone.
- **T-GLG-B:** «change-scoped, so I tested the one rule I touched → done». Counter: also run the gate against a deliberately-broken `bad` example (mutate one to NOT violate) and confirm the gate goes RED — prove the gate itself catches, per the project's own paired-negative thesis (the gate needs its own negative test).

## §6 Phase -1 (before dispatch)
Cold-review THIS kickoff (1× Opus): stale refs, ambiguity, missing constraints, §5 substance. Grep memory for "guard-liveness" / "principle 02" / "gate-rule-tester" so the reviewer inherits context (Phase -1 subagent has no memory access). Address BLOCKER/MAJOR, then proceed.

## §7 Sibling sub-waves (NOT follow-ups — planned siblings in the same umbrella)
- **v0 — audit** (parallel start): per-rule criticality table for the 26 manifest rules; informs v1.5 and v3 scope. Kickoff: `guard-liveness-v0-audit/kickoff.md`.
- **v1.5 — command / script** (after v0): per-rule "pre-condition fixture" schema + runner; pre-commit (fixture presence) + pre-push (change-scoped fixture-runs). Kickoff authored after v0 lands.
- **v3 — manual via Superpowers** (after v0): dogfood SP's `writing-skills` pressure-scenario pattern through an AI-agnostic sub-agent prompt; session-bound probe (not CI). Strong N5 give-back precursor. Kickoff authored after v0 lands.
- **v2 — full-sweep regression** (deferred, NOT in this umbrella): CI/pre-merge sweep of ALL guards for guard-rot. Trigger: ≥1 guard-rot incident OR routine want.
- **N5 give-back:** v1 (this) + v3 are both prime contribution material. Surface to N5 when it unblocks (after N7 live-dogfood).

## §4c Autonomous dispatch — park-don't-guess (aif agent contract)

> **aif agent — fork discipline (non-negotiable):** on ANY genuine fork or ambiguity (two defensible implementations, an undecided design choice, a missing spec detail that changes behaviour) — do NOT pick: park it as a question (set the task to `manualReviewRequired` / `blocked_external`, stating the fork as «Option A → consequence X / Option B → consequence Y») and stop that task. Proceed only on the unambiguous parts. Guessing a fork to «keep moving» is the failure this loop exists to prevent. Bridge env carries `AGENT_MAX_REVIEW_ITERATIONS=1` — not converged in one review pass → hand to human, don't keep guessing.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
