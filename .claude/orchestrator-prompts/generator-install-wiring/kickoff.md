# generator → install wiring — kickoff

> **Tracking issue:** [#728](https://github.com/artyhoo/rules-as-tests-aif/issues/728) — full context, evidence, and open questions.
> **Reframed 2026-06-26** from "wire the synthesizer's side-files in" to **"install drives the synthesizer as the source for the rules-as-tests config slice; the hand-written preset becomes the oracle"** — after a scouting session found the original framing inconsistent with principle 26 (which landed later, #696). See §0.

## 0. Why this was reframed (read first)

The original kickoff said: *"the synthesizer emits 4 side files nobody reads → wire them into the consumer's real ESLint config."* Investigation on `origin/staging` (be999a8b3) showed that is only half-true and the literal task is internally inconsistent:

- The synthesizer's output **already reaches the consumer** — not via side-files, but via a **hand-inlined preset template** (`packages/preset-next-15-canonical/templates/eslint.config.react.mjs:223,232,247`), and a drift guard (`packages/core/principles/26-template-selector-sync.test.ts`) already asserts the template's selectors match what the synthesizer generates.
- The original §6 demanded "keep principle 26 green" **and** install-time wiring of the same selectors — duplication by construction.

The **maintainer's actual intent**: the presets were hand-authored first as the **gold reference**. The generator's job is to reproduce that gold; the end-state is the generator *driving* the install, with the preset retained only as the comparison **oracle**. So "the preset already has these rules" is not a reason to skip the work — it is the oracle that makes the swap safe. This kickoff is that work.

## 1. Goal (one sentence)

During install, run the **deterministic** synthesizer for the detected stack and make its emitted *rules-as-tests* slice the **source** of that slice in the consumer's real ESLint config + barrel, by generalizing the single-rule (R2) AST-wirer to an N-rule wirer; keep the hand-written preset as the **oracle** the generated output is tested against.

## 2. Ground truth (verified on `origin/staging` be999a8b3 — re-verify before trusting)

- **Generator engine exists + works.** `packages/core/synthesizer/synthesize.ts:98-111` compiles each declarative recipe `{selector,message}` into the `rules-as-tests/restricted-syntax-audit-exempt` wrapper config. Deterministic path = `synthesize.ts` + `compile-declarative-md.ts`. **Do NOT use `generate.ts`** (live-LLM, forbidden in install — principle 17).
- **Generator owns only the AIF rules-as-tests slice**, not the whole config. The preset additionally ships typescript-eslint / react / jsx-a11y / next-plugin blocks the generator neither produces nor should.
- **The slice is currently hand-inlined into the preset template** (`eslint.config.react.mjs:223,232,247`) and **already compared to the generator** by principle 26. "Build generator + compare to gold" is, for the wrapper-selector slice, already shipped.
- **Install does NOT call the synthesizer.** `setup.d/40-configs.sh` copies hand-written rule files + regenerates the barrel; `setup.d/99-finalize.sh:32` runs only the **R2-specific** wirer `packages/core/install/wire-eslint-r2.ts`. `git grep synthes -- setup.d/ install.sh` → nothing.
- **The wirer to generalize:** `packages/core/install/wire-eslint-r2.ts` (+ `wire-eslint-r2.test.ts`, `tests/install-sh/r2-auto-wire.test.sh`). It appends a single hardcoded element `{ rules: { 'rules-as-tests/no-unsafe-zod-parse': 'error' } }` with bare→self-contained probe escalation.
- **§7 liveness is GREEN** (already checked this session): `tests/install-sh/f17-lint-rules-planted-violation.test.sh` passes on Node v24 — a generated rule, once in the barrel + config, actually runs. No liveness blocker.

## 3. Steps

1. **Confirm the slice equality empirically.** Diff the synthesizer's emitted *rules-as-tests* slice for react-next against the hand-inlined preset block; show they match (this is the gold the oracle test will pin). Paste the diff — baseline.
2. **Generalize the wirer.** `wire-eslint-r2.ts` (single rule) → an N-rule wirer that ingests the synthesizer's emitted `rules` object and AST-merges it into the consumer's resolved ESLint config, idempotently and non-destructively. R2 becomes a special case. **Watch flat-config override semantics:** the preset already configures the `restricted-syntax-audit-exempt` wrapper **once** (`eslint.config.react.mjs:247`, on `RULE_GLOBS.boundary`, carrying the R14/R20 selectors). The synthesizer emits that same wrapper for the same globs — so merge into **that** entry's existing selector array, do NOT append a sibling config object that clobbers it (last-wins per file). **Correction to #728 OQ3:** the `TSEnumDeclaration` selector (`eslint.config.react.mjs:127`) is **not** on this wrapper — it sits under the *built-in* `no-restricted-syntax` rule (L124), which the synthesizer never produces. That block is out of scope; do not merge generated selectors into it.
3. **Call the deterministic synthesizer from the install layer.** In the appropriate `setup.d/*` layer, run `synthesize.ts` for the detected stack, then invoke the generalized wirer. Honor `--dry-run` (write nothing) and the `FULL`/byte-identical gate semantics (`LAYERS.md`).
4. **Merge into the barrel.** Generated rule references flow into `eslint-rules-local/index.ts` the same regenerated way copied rules do.
5. **Reframe principle 26 as generated-vs-gold.** Once the generator is the source, "template hand-inlines selectors" is no longer the invariant. Decide with the maintainer: (a) assert generated install output == the hand-written gold preset, or (b) keep the template as gold and assert install reproduces it. Either keeps a drift guard in both directions.
6. **Tests (TDD, preset = gold).** Add a paired-negative/principle test proving a generated rule is *actually applied* on the consumer (planted violation trips it) + a negative (remove the rule → planted violation passes). Demonstrate on **react-next** (recipes exist there). Keep principles 17, 21, 25 green.

## 4. Build-vs-reuse mandate

- **REUSE, do not rebuild:** generalize `wire-eslint-r2.ts`; reuse the installed ESLint engine + ts-morph AST machinery. A from-scratch wirer is `#parallel-evolution-creep`.
- Before any **capability commit**, run the prior-art consult + add the `Prior-art:` trailer. Relevant SSOT rows: #120 (install auto-wires R2 by reading the repo), #118 (`check:enforced` resolved-config gate), #114 (guard-liveness). If the generalization is "glue over reused engine", say so in the trailer.

## 5. Constraints / invariants (hard)

- **No paid LLM in CI / install.** Deterministic path only (`synthesize.ts` / `compile-declarative-md.ts`), NOT `generate.ts` (principle 17).
- **Sole-writer + provenance preserved.** Synthesizer stays the only writer of generated rule artifacts; keep the provenance header + S5 anti-hand-edit hash. The wirer must not hand-edit emitted rule bodies.
- **Idempotent + non-destructive** on the consumer config (same discipline as the R2 wirer + `--wire-ci`).
- **Agnostic core.** Substrate-agnostic wiring (no Claude-Code dependency); keep principle 21 green.
- **Stay in scope** (CLAUDE.md «PR strategy»): if you spot the `.ts`-loader liveness issue (§7) or anything else systemic, surface it — do NOT expand this PR.

## 6. Acceptance gates (done when…)

- `bash setup react-next` on a clean consumer produces an ESLint config + barrel whose *rules-as-tests* slice is **generated by the synthesizer** (shown by diff) and **equal to the hand-written gold preset** (oracle test green).
- A planted violation for a generated rule **fails at the earliest reachable channel** (edit-time / pre-push), proven on the executor's Node version (T-GIW-A: `eslint --print-config <boundary-file>` shows the generated rule present, plus a RED planted-violation run).
- `bash setup ts-server` → empty synth (no recipes for ts-server) → graceful idempotent no-op.
- Re-running install is a no-op; `--dry-run` writes nothing.
- New paired-negative/principle test green; principles 17, 21, 25, (reframed) 26 stay green; `make self-audit` green.

## 7. Dependency / risk note

- **ts-server has zero recipes** (all `appliesTo: ["next"]`), so the synthesizer emits `{}` for it. The literal "ts-server config contains synthesized rules" is unsatisfiable by construction — the end-to-end planted-violation demo runs on **react-next**; ts-server is verified as a graceful no-op. Authoring a ts-server recipe is OUT of scope (separate task).
- **Behavioral equivalence is expected, not vacuity.** For supported stacks the generated slice is byte-identical to the hand-inlined preset (principle 26 guarantees it) → no observable enforcement change. The value is architectural (single source recipes → synthesizer → install; hand-copy removed; gold preset retained as oracle).
- Base rule enforcement is **live** on the consumer (§7 f17 green on Node v24). If a planted violation does not fire on your machine, fix that liveness path FIRST (or surface and stop) — otherwise you wire generated rules that silently never run.

## 8. AI-laziness traps (per `.claude/rules/ai-laziness-traps.md` §3)

Active traps: **T2** (designing ≠ running — actually wire it + show a planted violation failing, no "would wire"), **T3** (every finding = command + output or file:line), **T5** (implementation only; don't bundle unrelated fixes), **T11/T16** (consult prior-art before any new mechanism; verify the reused R2 wirer's problem-class matches N-rule wiring), **T14** (clean run + low coverage ≠ "works" — prove the generated rule is APPLIED, not just present), **T15** (self-application: `make self-audit` green after), **T19** (own cold-QA before handoff — CI green ≠ design review).

Domain-specific trap — **T-GIW-A**: «emitted files exist / output equals preset, therefore done». Equality with the gold preset is the oracle pass, NOT proof of enforcement. The gate is a generated rule **applied in the resolved consumer config** and **tripping a planted violation**. Falsify by `eslint --print-config <boundary-file>` showing the generated rule present + a RED planted-violation run.

Domain-specific trap — **T-GIW-B** (oracle tautology): the gold side of the oracle test MUST read the **shipped preset template file** as a static string; never re-run the synthesizer to produce *both* sides of the equality (`synth == synth` stays green even if the preset drifts). Same paired-negative discipline principle 26 already enforces — falsify by mutating the preset template selector and confirming the oracle goes RED.

## 9. aif autonomous dispatch — park-don't-guess contract (SKILL §4c, mandatory under autonomous bridge dispatch)

**aif agent — fork discipline (non-negotiable):** On ANY genuine fork or ambiguity (two defensible implementations, an undecided design choice, a missing spec detail that changes behaviour) — **do NOT pick.** Park it as a question (set the task to `manualReviewRequired` / `blocked_external` with the fork stated as «Option A → consequence X / Option B → consequence Y») and **stop that task.** Proceed only on the unambiguous parts. Guessing a fork to "keep moving" is the failure this loop exists to prevent.

**Pre-identified fork in this kickoff — park it, do not decide:** §3 step 5 (principle 26 reframe) is an explicit maintainer-owned choice — «(a) assert generated install output == hand-written gold preset» vs «(b) keep the template as gold and assert install reproduces it». Both keep a drift guard in both directions; the choice is the maintainer's. Implement steps 1–4 + 6 (which are unambiguous), and **park step 5 as a question** with both options stated. Do NOT silently wire one branch of the reframe.

**Conservative config (set on bridge env before dispatch):** `AGENT_MAX_REVIEW_ITERATIONS=1` (not converged in 1 pass → hand to human, don't keep guessing), `AGENT_AUTO_REVIEW_STRATEGY=closure_first`, `AGENT_SKIP_REVIEW=false`.

**Egress (mandatory after `status=done`):** aif does NOT push or open PRs by design — run `npx tsx packages/runtime-bridge/src/cli/harvest.ts <taskId> --base staging` to push the branch from the container + open the PR.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
