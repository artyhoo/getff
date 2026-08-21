# Generation live-delivery (thesis-realization) — R-phase scoping kickoff

> Scope: **R-phase scoping kickoff** for the `generation-live-delivery` umbrella — closing the gap between the project's generation thesis and its shipped reality (the synthesizer is currently an aspirational SSOT; presets carry delivery). This is a **scoping/research kickoff**, not an implementation kickoff — the work is large and needs design before an I-phase. NOT authoritative for project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).

> **Staging-placement reminder** ([kickoff-staging-placement.md §1](../../rules/kickoff-staging-placement.md)): tracked dispatch-input read from `staging`. Merge to `staging` before any dispatch.

## §0 Why — the thesis-vs-reality gap (verified 2026-06-28)

The project's thesis: a meta-factory **GENERATES** executable rule artifacts — "static configs go stale; generated executable rules don't". The shipped reality, verified during the `multi-stack-monorepo` (§13.5) Step-0:

- The synthesizer (Pipeline A's `synth-and-wire`) is a **drift-correcting NO-OP overlay** — the hand-authored **presets carry delivery** (`packages/core/install/synth-and-wire.ts:6-8`; principle 26 `26-template-selector-sync.test.ts` keeps presets byte-synced to recipes).
- The full generation engine (**Pipeline B**, `packages/core/installer/`, `rules-lock.json`) is **NOT wired into consumer install** (zero callers in `install.sh`/`setup.d`; exposed only as the `rules-as-tests-install` bin).
- **All 10 synthesizer recipes target `next`** (`appliesTo:["next"]`). ts-server / react-native / react-spa have **no recipes**; their rules ship via hand-authored (recipe-synced) presets + upstream plugins. Core custom rules R2/R7/R8 (`packages/core/eslint-rules/`) are universal but delivered via core + preset, not synth.

⇒ The generation thesis is **realized for react-next** (partially, redundantly — synth is a no-op there too) and **thin for other stacks**. The live delivery is presets, not generation. **This umbrella decides whether and how to make generation the live delivery.**

## §1 Origin

Surfaced during the `multi-stack-monorepo` (§13.5) umbrella, 2026-06-28, when the operator pushed back on a drift toward "place static presets per workspace" with "the goal is generation, not presets". Verification then exposed that the synthesizer is not the live delivery anywhere. **Operator decision (2026-06-28):** §13.5 stays narrow (Path A — per-workspace scoping primitive + recipe-synced delivery); this thesis-realization is a **separate umbrella, opened now**. §13.5 L2 ships the per-workspace **scoping primitive** that this umbrella will consume — it is the first brick.

## §2 Open questions for the R-phase (research before any I-phase)

1. **Live delivery vs SSOT-projection.** Should the synthesizer EMIT the consumer's config directly (retiring preset-as-delivery), or stay an SSOT with presets as a generated/validated projection? What does "generated, not stale" actually require operationally?
2. **Wiring Pipeline B.** If live: how to wire `packages/core/installer/` (`install.ts` `buildLock`/`emit`, `rules-lock.json`) into `install.sh`/`setup.d` without regressing the shipped preset path? Migration + back-compat strategy.
3. **Per-stack generation coverage.** Author recipes / custom rules for ts-server / react-native / react-spa? What custom rules does each stack warrant (genuine domain work — what does a Hono/ts-server app or an Expo/RN app need enforced beyond universal R2/R7/R8)?
4. **Principle 26 evolution.** If presets become generated output rather than hand-authored, does `26-template-selector-sync` change from "hand-authored template matches recipes" to "generated output matches recipes"? Does it still earn its keep?
5. **Prior-art / BFR consult** for "generate lint config from a rule SSOT" / config-as-generated-artifact patterns (DeepWiki + WebSearch ≥3 phrasings; SSOT consult). The generation engine itself may have upstream analogs to REFERENCE/ADOPT.

## §3 Build-vs-reuse + traps (for the R-phase session)

- Run the [build-first-reuse-default.md §3](../../rules/build-first-reuse-default.md) 6-layer mechanism on Q5 before any "build the generation engine" verdict; cite SSOT by ID.
- Active [ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md): **T11/T12** (don't design the engine without prior-art search), **T16** (Pipeline B "looks like" a generator — verify it solves OUR delivery problem, not just emits a lockfile), **T2/T4** (designing the methodology ≠ doing the research), **T15** (self-apply: does the generation engine generate ITS OWN enforcement?).

## §4 Sequencing

| Stage | Scope (one line) | Depends on |
|---|---|---|
| generation-live-delivery | R-phase scoping: decide whether/how generation becomes the live delivery (§0) | §13.5 L2 (Path A) ships the per-workspace scoping primitive |

The scoping primitive is the brick this umbrella builds on.

- **Large + exploratory** → R-phase (this kickoff drives research) → then an I-phase per the research verdict. Do NOT jump to implementation.
- This umbrella is the home for the §3b OUT-OF-SCOPE items deferred by the §13.5 L2 kickoff.

## §5 See also

- `.claude/orchestrator-prompts/multi-stack-monorepo/kickoff.md` — §13.5 L2 (Path A); §3b lists the deferred items this umbrella owns; ships the scoping brick.
- [docs/meta-factory/multi-stack-monorepo-research.md](../../../docs/meta-factory/multi-stack-monorepo-research.md) — where the two-pipeline / synth-aspirational findings were first surfaced.
- [.claude/rules/build-first-reuse-default.md](../../rules/build-first-reuse-default.md), [ai-laziness-traps.md](../../rules/ai-laziness-traps.md), [doc-authority-hierarchy.md](../../rules/doc-authority-hierarchy.md).
- Architectural finding (memory): `project_multi_stack_i2_state.md` — two pipelines, synth = no-op overlay, Pipeline B unwired, recipes all `next`.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
