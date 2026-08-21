# react-spa generator oracle-coverage parity (match react-native) — kickoff

> **Class:** operational kickoff (dispatch input).
> **Authoritative for:** scope of GH #727 — give **react-spa** a synthesizer generate-path oracle-coverage test mirroring the existing react-native one, closing the Stage-1-preset asymmetry (RN covered, SPA not).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Live-LLM Path-A proof, Path B, Gate 3 (Stryker), Gate 5 — deferred per their own triggers (see §5 out-of-scope).
> **Base branch:** `staging` (NOT `main` — promote manually).
> **Tracking issue:** [#727](https://github.com/artyhoo/rules-as-tests-aif/issues/727) — grounded current state + oracle confirmation (3 IDs).

## §1 Goal (one phrase)

A `react-spa` generate-path test exists and is green, covering **every** `RULES.react-spa.md` oracle ID — full parity with the react-native generate-test's oracle-coverage block — so both Stage-1 presets are generator-pipeline-covered, not one hand-only.

## §2 Grounded current state (verified, `origin/staging` 2026-06-26)

- **react-native — covered.** `packages/core/synthesizer/generate.test.ts` runs a recipe-less RN `ResearchPlan` (`fixtures/rn-research-plan.json`) through `synthesizeGenerate(...)` and asserts: (a) L4 accepts, (b) the emitted rule set fires (FlatList → FlashList), (c) **oracle coverage** against `RULES.react-native.md` (IDs R12/R14/R15/R18). The LLM `GenerateClient` is a **deterministic stub** (`generate-stubs.ts:stubGenerateRN`) — proves the *pipeline* handles RN's documented rule set, not a live LLM.
- **react-spa — not covered.** `grep -rn 'react-spa' packages/core/synthesizer/*.test.ts fixtures/` → empty. No fixture, no `stubGenerateReactSPA`, no oracle-coverage test.
- **Oracle = `RULES.react-spa.md:15-18` = 3 IDs:** `R-SPA-EB` (error-boundary — custom AST rule `packages/preset-react-spa/eslint-rules/require-error-boundary.ts`, BUILD, SSOT #140) · `R-SPA-A11Y` (`eslint-plugin-jsx-a11y`, ADOPT) · `R-SPA-HOOKS` (`eslint-plugin-react-hooks`, ADOPT). Near-mirror of RN (RN = 4 IDs, 2 custom).

## §3 The task (mirror the RN treatment)

1. Add a frozen `packages/core/synthesizer/fixtures/react-spa-research-plan.json` (oracle = `RULES.react-spa.md`).
2. Add `stubGenerateReactSPA` to `generate-stubs.ts` returning the react-spa rule set (`require-error-boundary` + the two plugin-sourced rules).
3. Add a `generate.test.ts` block (or sibling test) asserting: **L4 accepts** the plan; `require-error-boundary` **fires** on a paired bad/good fixture (missing `ErrorBoundary` ancestor → error; present → clean); the emitted set **covers every** `RULES.react-spa.md` oracle ID. Only `R-SPA-EB` needs a real L4-validated stub-generated rule + paired fixture; `R-SPA-A11Y` / `R-SPA-HOOKS` assert **plugin presence** (manual coverage, exactly like RN R14/R15, which are not in L4 `KNOWN_PLUGINS`).

## §4 Scope

**In:** the react-spa synthesizer generate-path test + its fixture + stub. Small — **NOT an epic** (~1–2 h; oracle discharged per the issue comment). **Out:** §5.

## §5 Out of scope (deferred — do not pull in)

- Live-LLM proof of Path A (non-deterministic; not unit-tested — same boundary as RN).
- Path B (LLM authors AST source), Gate 3 (Stryker), Gate 5 (two-AI review) — own deferred triggers per [open-questions.md §13.10](../../../docs/meta-factory/open-questions.md).

## §6 Acceptance (deterministic)

- A react-spa generate-path test exists and is **green**; covers **all 3** `RULES.react-spa.md` oracle IDs (parity with the RN test's oracle-coverage block).
- `require-error-boundary` paired fixture: bad (no `ErrorBoundary`) → error; good → clean (principle 02).
- `make self-audit` green.

## §7 Build-vs-reuse (per [build-first-reuse-default.md](../../rules/build-first-reuse-default.md))

Mirror the existing RN treatment — template: `generate.test.ts` RN oracle-coverage block + `generate-stubs.ts:stubGenerateRN`. No new machinery; each new rule/fixture follows principle 02 (paired negative). Prior-art SSOT to cite: **#140** (`require-error-boundary` BUILD).

## §8 AI-laziness traps (per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active traps: **T1** (cover ALL 3 oracle IDs — "require-error-boundary fires, looks done" is a sampling artifact, not parity), **T14** (clean ≠ covered: a green test on 1 of 3 IDs is "partial coverage", not "parity"; assert the full oracle set), **T16** (don't assume react-spa's gap rule is the same problem-class as RN's `flatlist` rule — verify each emitted rule against `RULES.react-spa.md`), **T15** (self-application: the oracle-coverage assertion fails if an oracle ID is dropped from the emitted set).

Domain trap **T-SPA-ORACLE-A**: tempted to assert only `require-error-boundary` fires and call it parity — the RN test covers **all 4** oracle IDs including plugin-sourced ones. SPA parity = cover **all 3** (`R-SPA-EB` real-rule + `R-SPA-A11Y`/`R-SPA-HOOKS` plugin-presence). One-rule coverage masquerading as parity is the exact "stranded hand-maintained preset" gap this issue closes.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
