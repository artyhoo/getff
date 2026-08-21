# Rule-bootstrapping I-phase SPIKE — wire the install-time pipeline skeleton

> Scope: I-phase implementation kickoff (a SPIKE) — wire the rule-bootstrapping pipeline SKELETON end-to-end on ONE stack. NOT authoritative for project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).

> **Staging-placement reminder** ([kickoff-staging-placement.md §1](../../rules/kickoff-staging-placement.md)): tracked dispatch-input read from `staging`. This kickoff is REVIEWED + REFINED in a session, then dispatched to aif from the refined local copy. Keep it on `staging` so a fresh review session finds it.

> **Process (operator decision 2026-06-28):** do NOT dispatch this to aif directly. A review session iterates verify→fix on THIS kickoff until reviewers return GO, and ONLY THEN dispatches to aif. See the companion review-session prompt.

## §0 Goal of the spike

Wire the rule-bootstrapping pipeline SKELETON end-to-end at install time on ONE stack (`react-next`): a `RuleResearchClient` port (STUBBED in this spike) → the existing `generate.ts` factory (rule + paired-negative test) → the existing-but-DEAD `buildLock` → `rules-lock.json`, behind a `--full`-gated, session-bound install-time entry ($0 in CI). This de-risks the seam and REVIVES the dead lock. The LIVE MCP-research adapter (context7/deepwiki + tool-bootstrapping-discovered MCPs) is the NEXT slice — OUT of this spike (it is agent-session work, not container-buildable). This is an I-PHASE (code + tests).

## §1 Why this spike (architecture, decided)

Vision: one-button `./setup` live-researches a stack's best-practices/anti-patterns and generates ESLint rules + guarding tests, on a stable universal core. Operator decisions (ratified 2026-06-28):

- **Operator leans agent-driven research** (a session uses MCP channels) — but **Q1 (agent-driven vs code-driven) is formally PARKED per #798 §3**, and this spike commits to NEITHER side: it STUBS the research substrate (the stub finding is fixed data, agnostic to who produces the live version). context7/deepwiki are the **SEED**; the live flow then discovers+installs stack-specific MCPs/skills (the existing `tool-bootstrapping` mechanism, Rules 1-2) and researches with the ENRICHED toolset. **rule-bootstrapping COMPOSES with tool-bootstrapping** (stage 1 = acquire research tools; stage 2 = use them → rules).
- Because the live research is agent/session work (and MCP availability inside an autonomous container is uncertain), **this spike does NOT do live research.** It builds the deterministic SKELETON behind a `RuleResearchClient` **port + stub**, so the live adapter plugs in next without re-plumbing.

## §2 Verified grounding (re-confirm each; recon 2026-06-28 + R-phase #798 `docs/meta-factory/research-patches/2026-06-28-rule-bootstrapping.md`)

- **Factory exists, unwired:** `synthesizeGenerate(plan, client)` (`packages/core/synthesizer/generate.ts:20`; the paired-negative-test requirement is at `generate.ts:84-90`) → ESLint rule + paired-negative test; L4 degrades to research-only if rejected. **Note the TWO inputs:** `plan: ResearchPlan` (the menu/findings) AND `client: GenerateClient` (authors the rule body → `GenerateSelection`). Generate port: `packages/core/synthesizer/generate-port.ts` (`GenerateClient`@49-51, `GenerateSelection`@45, `GenerateCandidate`@14); generate stubs: `packages/core/synthesizer/generate-stubs.ts` (`stubGenerateRN`@18 / `stubGenerateBad`@195); existing seam runner: `packages/core/synthesizer/generate-cli.ts:22` `runGeneratePath(plan, client)` (chains `synthesizeGenerate → L4 validate → {mode:'synthesis'|'research-only'}`).
- **Research port pattern to MIRROR:** `packages/core/research/research-port.ts` (`ResearchClient` + `stubFrozenResearch`) — copy this shape for the new `RuleResearchClient`.
- **Lock exists, DEAD:** `packages/core/installer/install.ts:41` `buildLock(plan, emittedAt)` → `rules-lock.json` (ruleIds+emittedAt+sourceFingerprint); `install.ts:108-122` lock-collision guard (skipped when `opts.force`; ruleIds-drift check at `install.ts:66-77`); `install(plan, opts)` (`install.ts:88`) = pre-validate → emit (`install.ts:136`) → buildLock (`install.ts:137`) → post-validate, writing to `<consumerRoot>/.ai-factory/synthesizer-output/` (`install.ts:18` `OUTPUT_SUBPATH`). ZERO install-flow callers today (only the unused `rules-as-tests-install` bin).
- **Install seam:** `setup.d/99-finalize.sh` already shells out to `packages/core/install/synth-and-wire.bundle.mjs` (deterministic, "no LLM; no network", principle 17). `--full` gate pattern: `install.sh` sets a FULL carrier; `setup.d/05-mcp.sh` is gated on it (no-ops on non-full/snapshot → byte-identical preserved).
- **$0-in-CI invariant:** `tests/agnosticism/probes/paid.sh` asserts no `ANTHROPIC_API_KEY`; principle 17 (`packages/core/principles/17-no-paid-llm-in-ci.test.ts`). The CI self-install path MUST stay on the deterministic/stub route.

## §3 Build steps (the spike)

1. **`RuleResearchClient` port + deterministic stub (research/menu half).** New `packages/core/synthesizer/rule-research-port.ts` mirroring `research-port.ts`'s `ResearchClient` INTERFACE SHAPE (T16 — same injectable live/stub seam): `research(detection: DetectionResult) → ResearchPlan` (the `{framework, version, patterns[], missing[], drift}` menu `synthesizeGenerate` consumes as its `plan` arg). `stubRuleResearch` returns a FIXED react-next `ResearchPlan` with ONE pattern (a real, well-known react-next practice/anti-pattern — e.g. "no raw `<img>`; use `next/image`"). NOTE: unlike `stubFrozenResearch` (which DELEGATES to the real `research()`), this stub IGNORES its `detection` arg and returns hardcoded data (underscore-prefix convention, like `stubGenerateRN`); model the full shape on the existing `packages/core/synthesizer/fixtures/rn-research-plan.json` (`ResearchEntry` = `id`/`summary`/`bestPractices[]`/`antiPatterns[]`/`provenance[]`; plan-level `missing[]` + `drift`). Document the port as the plug-in seam where the LIVE MCP adapter slots in next (OUT of this spike).
2. **Rule-body stub + seam to the factory (generate half).** `synthesizeGenerate(plan, client)` (`generate.ts:20`) takes TWO SEPARATE inputs — `plan: ResearchPlan` (from step 1) AND `client: GenerateClient` that authors the rule body → `GenerateSelection` (`generate-port.ts:45-51`); they are NOT interchangeable. Reuse the existing stub `GenerateClient` pattern (mirror `stubGenerateRN`, `generate-stubs.ts:18`): a FIXED `GenerateSelection` with ONE `GenerateCandidate` whose `entryId` MATCHES the step-1 pattern `id` (else `synthesizeGenerate` silently drops it, `generate.ts:47`), carrying `eslintConfig` (or `presence:'forbid'`+`selector`), `examples{bad,good}`, and `negativeTest`. **Call chain:** `const plan = await stubRuleResearch.research(detection)` → `runGeneratePath(plan, stubGenerateClient)` (`generate-cli.ts:22`) — the research stub yields the `plan` arg, the generate stub is the separate `client` arg. The factory is called UNCHANGED — this is the #798 §4 seam: the live/stub part supplies only data conforming to `GenerateCandidate`, never TS. A real `findings → GenerateSelection` transform is the LIVE adapter's job (OUT of this spike); the stub returns a fixed selection.
3. **Revive the lock — do NOT double-emit.** Branch on `runGeneratePath`'s result: on `mode:'synthesis'`, pass the returned `SynthesisPlan` STRAIGHT to `install(plan, {consumerRoot, force:true})` (`install.ts:88`). Do NOT call `emit()` first — `install()` ALREADY calls `emit()` internally (`install.ts:136`) before `buildLock` (`install.ts:137`) and re-validate (`install.ts:150`), so a separate `emit()` is redundant double-work. The `lock-collision` guard (`install.ts:108-122`) fires when a `rules-lock.json` from a PRIOR run already exists; `force:true` (or a pre-cleaned output dir) keeps the fixture re-runnable past it. This is the first time the dead `buildLock` runs in a real flow → a real `rules-lock.json` is produced.
4. **Install-time `--full` gate.** A new `setup.d/` step (or a guarded branch in `99-finalize.sh`) that runs steps 1-3 ONLY on the `--full` carrier + session-bound — NEVER in the CI self-install path. The new step MUST early-return when the FULL carrier is unset (mirror `setup.d/05-mcp.sh:13` `if [ -z "${FULL:-}" ]; then return 0`). Opted-out / non-full path = byte-identical (L4/L5 snapshots unchanged).
5. **Tests (paired-negative, $0):** a good stub finding → a rule+test that FIRES (non-vacuous: real `Linter.verify` violation + clean case); a bad/tautological stub finding → L4 REJECTS (`validate().ok === false`) → `runGeneratePath` degrades to `{mode:'research-only'}`, so `install()` is never reached and no rule ships (reuse the `stubGenerateBad` pattern, `generate-stubs.ts:195`). Mirror `generate.test.ts`. **Before Done, run the L4/L5 snapshot + install tests on the non-`--full` path and confirm ZERO diff** — proves the opted-out path stayed byte-identical (no silent snapshot regression).

## §4 Hard constraints

- **Capability commit:** the new port/wiring is a capability commit (a new ≥80-LOC file under `packages/`, or any new `package.json` dependency) → the commit MUST carry a `Prior-art:` trailer citing the bridge's SSOT row AND land that SSOT row in the **SAME commit** (`docs/meta-factory/prior-art-evaluations.md`, append-only). Row content = the rule-research bridge (BUILD), drafted in the #798 R-phase doc §11. **SSOT-id collision — re-grep, do NOT hard-code:** both #798 §11 (this bridge) AND #797 §6 (golden-file pattern, REFERENCE) drafted a `#183` against the same register (current max = #182); whichever I-phase lands first takes #183. Re-grep the max id at commit time (`grep -nE '^\| *18[0-9]' docs/meta-factory/prior-art-evaluations.md`), claim the NEXT FREE id (#183 or #184), and make the `Prior-art:` trailer cite that same id. A missing trailer / separate-commit SSOT row trips `.husky/pre-push`.
- **$0-in-CI:** no live LLM / no network in the spike. The stub is the only research source here. CI self-install path unchanged.
- **L4/L5 byte-identical for the opted-out path** (don't regress existing snapshots). The new pipeline runs only behind the `--full` install-time gate.
- Do NOT build the live MCP-research adapter, per-stack beyond react-next, the rules-ledger, or the recursive tool-discovery — those are the NEXT slices (name them in a closing "Next slices" section of the PR/commit body).
- Do NOT touch the universal core rules (`packages/core/eslint-rules/`).

## §5 AI-laziness traps (per [ai-laziness-traps.md §3](../../rules/ai-laziness-traps.md))

See `.claude/rules/ai-laziness-traps.md §2` for the full catalogue. Active traps for this I-phase: **T3, T15, T16**.

- **T15** — the spike's generated rule MUST come WITH its guarding test (paired-negative); a rule without a firing test is `#discipline-theatre`.
- **T16** — TWO distinct ports, each reused because its problem-class matches (injectable live/stub seam), not because the names rhyme: `RuleResearchClient` mirrors `ResearchClient` (research → menu), and the rule-body stub mirrors the `GenerateClient` pattern (menu → rule body). State each match explicitly; do NOT conflate the two (they solve different sub-problems).
- **T3** — re-read every `file:line` in §2; do not trust recalled line numbers.

**Domain-specific trap (NOT in the canonical catalogue):**

- **T-RBI-A** — do NOT let the stub-research spike silently become "the feature": it proves the SKELETON only. The PR/commit body MUST state plainly "research is STUBBED here; live MCP adapter is the next slice" — never imply live research works.

## §6 Fork discipline (park-don't-guess — for the aif executor)

On ANY genuine fork (e.g. exact install-time hook location: new `setup.d/NN-*.sh` step vs a guarded branch in `99-finalize.sh`; whether the stub finding is a real react-next practice or synthetic) where two designs are defensible — do NOT pick. **Park it as a question** (set the task to `manualReviewRequired` / `blocked_external`, state «Option A → consequence X / Option B → consequence Y») and stop that part; proceed on the unambiguous parts. Guessing a fork to "keep moving" is the failure this exists to prevent. (NOT a fork: `rules-lock.json` placement is fixed — `install()` writes it to `<consumerRoot>/.ai-factory/synthesizer-output/`, `install.ts:18`; don't park a settled question.)

## §7 Done

`./setup --full` on a react-next fixture runs stub-research → `generate.ts` → emits a rule+guarding test → `buildLock` writes a real `rules-lock.json`; the opted-out path is byte-identical; paired-negative tests green; the capability commit carries a `Prior-art:` trailer + the bridge's SSOT row (next-free id per §4) in the same commit. Commit on a feature branch off `staging`; do NOT push — the host harvests.

## §8 See also

- `docs/meta-factory/research-patches/2026-06-28-rule-bootstrapping.md` — the R-phase design this spike implements (§4 seam, §11 SSOT #183 draft).
- `docs/meta-factory/research-patches/2026-06-28-generation-live-delivery.md` — sibling R-phase (delivery axis; its Q1 — live-emit vs SSOT-projection — is PARKED, a DIFFERENT question from #798's agent-vs-code Q1). It also drafts a `#183` SSOT row (see §4 id-collision note).
- [.claude/rules/ai-laziness-traps.md](../../rules/ai-laziness-traps.md), [build-first-reuse-default.md](../../rules/build-first-reuse-default.md), [kickoff-staging-placement.md](../../rules/kickoff-staging-placement.md).

```bash host-verify
# Retro-marked 2026-08-21: §7 Done requires the opted-out path byte-identical — the snapshot compare is that gate
SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh
```
