<!-- scope: kickoff — ir-unfreeze umbrella (OWNER-FORK-1: unfreeze the neutral ConventionNode IR to a relational shape, or stay narrow). Status: R-phase LANDED (docs/meta-factory/research-patches/2026-07-21-ir-unfreeze.md, merged to staging e5f07ec3d #1061); owner preconditions RESOLVED 2026-07-21 (operator, rule-tests design session): OWNER-FORK-1 = UNFREEZE; IR shape = Option B (structured relational rule-object / discriminated union). Record + falsifiers: docs/superpowers/specs/2026-07-21-rule-tests-surface-design.md §9 R3. Umbrella is DISPATCHABLE once this record is on staging. Base = frozen ConventionNode (ir/types.ts:3, verified origin/staging 8747d8453) + the LG-S1 python census data (40/93, +53.3pt relational delta). Stages implement Option B; NO stage may re-decide the shape (STOP lines stand). -->

# ir-unfreeze — kickoff

> **Goal of this umbrella:** IF the owner resolves OWNER-FORK-1 to UNFREEZE, deliver a **relational** `ConventionNode` IR — one that carries `not:`/`has:`/`all:`/`any:` relational composition — so the ~53% of real conventions the frozen flat-`params` IR cannot *precisely* express become expressible, WITHOUT breaking the 24 existing consumers or the byte-locks. Serves [README.md#why-this-exists](../../../README.md#why-this-exists): «generated executable rules … fail at the earliest reachable channel» — a relational IR raises the fraction of real conventions that become executable rules at all.
> **What already exists (verified 2026-07-21 @ `origin/staging` `8747d8453`):** the FROZEN node (`ir/types.ts:32-41`, freeze at `:3`); its JSON-Schema mirror (`ir/convention-node.schema.json:6`/`:26-28`, scalar-only params ceiling); the grammar gate (`ir/gates/grammar.ts`); 4 render backends (astgrep/ruff/cargo/npm) that read `params` today; **24 ConventionNode consumers** (R-patch §0 table); the byte-exact order-sensitive lock (`synthesizer/to-node.test.ts:129-137`). The measured need: the LG-S1 python census (40.0% flat-precise / 93.3% flat+relational, n=15; +53.3pt / 8 conventions gated behind the relational unfreeze, incl. all 3 «require-via-ban» cases).
> **The owner precondition (BINDING — read before any dispatch):** the **IR shape is Option A (`patterns: string[]` / string-composed relational params) vs Option B (structured relational rule-object / discriminated union)** — surfaced in [2026-07-21-ir-unfreeze.md §1](../../../docs/meta-factory/research-patches/2026-07-21-ir-unfreeze.md), which picks NEITHER («OWNER DECIDES — this patch does not pick»). **Stages S1..S4 below are PROVISIONAL: the IR shape (Option A vs B) is an owner precondition, not a stage decision. A stage may NOT pick Option A vs B, and may NOT unfreeze the IR before the owner has resolved the fork.**

---

## §0 Research base + re-verify obligation

Authoritative research base: [2026-07-21-ir-unfreeze.md](../../../docs/meta-factory/research-patches/2026-07-21-ir-unfreeze.md) (§0 ground truth + 24-consumer table, §1 the parked design-fork, §2 blast-radius map, §3 rust-census GAP, §4 backward-compat). DATA: [2026-07-13-lg-s1-expressibility-census.md](../../../docs/meta-factory/research-patches/2026-07-13-lg-s1-expressibility-census.md). Before any stage dispatch the executing session MUST re-verify volatile facts live (T3/T12):

- **Frozen-IR state:** re-confirm `ir/types.ts:3` still reads FROZEN and no field was added, and the consumer count (`git grep -l "ConventionNode" origin/staging -- "packages/core/**/*.ts" | grep -v test | wc -l`) — the R-patch measured **24** at `8747d8453`; re-count at ship time (staging moves).
- **Owner precondition resolved?** Do NOT dispatch S1 until the owner has recorded the Option-A-vs-B pick. Absent that record → STOP and surface, do not guess (R-patch §1 STOP).
- **Byte-lock baseline:** re-read `synthesizer/to-node.test.ts:129-137` (order-sensitive lock) + the drift gate `backends/python-templates-drift.test.ts:25` before touching any render shape — the regen is deterministic but the lock is order-sensitive (R-patch §2b/§2d).
- **Rust census GAP:** the unfreeze decision is python-data-only (R-patch §3). If the owner wants rust weighed, a rust census is a PREREQUISITE research task, not a stage here.
- **Prior-art (BFR §3, [build-first-reuse-default.md §3](../../rules/build-first-reuse-default.md)):** a relational IR is an ADAPT of ast-grep's own `any/all/not/has` relational vocabulary (not a novel BUILD). The capability commit that lands the IR change carries the `Prior-art:` trailer + a new SSOT row (re-grep the register tail at commit time, T20).

## §1 Target architecture (FIXED only AFTER the owner resolves §1 of the R-patch)

- **ONE change to the neutral IR** — `ir/types.ts` `ConventionNode.params` gains a relational capacity (Option A: widened value type / `patterns?: string[]`; Option B: a typed relational tree). The **shape is the owner's pick, not a stage decision.** Whichever variant: the frozen scalar-only node stays a valid legacy instance (R-patch §4 backward-compat — no forced migration).
- **The JSON-Schema mirror** `ir/convention-node.schema.json` widens in lock-step (`:6` `additionalProperties:false` and `:26-28` params scalar ceiling — both gate the change; R-patch §0/§2a).
- **The grammar gate** `ir/gates/grammar.ts` keeps validating (ajv shape + FF600x semantics); a relational unfreeze MAY add an FF-code for malformed relational params (Option-A string-blobs can't be deep-ajv-validated; Option-B trees can — R-patch §2a).
- **The 4 render backends** each decide degrade-vs-refuse for relational params, reusing the existing `selectorClass`-refusal pattern (FF7001, `render-astgrep.ts:14-15`): astgrep = the primary relational-YAML insertion point (`render-astgrep.ts:26` «does not yet specialise the emitted `rule:` shape»); ruff/cargo/npm = mostly refuse (no relational surface — R-patch §2c).
- **Byte-locks + drift + snapshot tests** re-baseline once, deterministically, via in-file regen commands (R-patch §2d) — a mechanical step.

## §2 Stages (PROVISIONAL — each = one PR onto staging, branch from staging; do NOT collapse; do NOT start before the owner precondition is resolved)

**S1 — grammar + IR shape change + backward-compat (smallest honest slice).** Land the owner-chosen relational shape in `ir/types.ts` + `convention-node.schema.json` + `ir/gates/grammar.ts`, with the legacy scalar node proven still valid (byte-lock `to-node.test.ts:129-137` green, no forced migration — R-patch §4). No backend renders relational yet; S1 is the IR + gate + compat proof only.

**S2 — astgrep render + one more backend.** Teach `render-astgrep.ts` to emit the relational `rule:` YAML (the `:26` insertion point) and fire RED on a scratch consumer for a real relational convention from the census's 8-convention delta (e.g. one require-via-ban case). Plus ONE more backend's degrade-vs-refuse decision wired (ruff or npm).

**S3 — ruff + cargo + byte-lock updates.** Complete the remaining backends' degrade-vs-refuse (ruff/cargo/clippy — mostly FF7001 refuse for relational, R-patch §2c) and re-baseline the drift/snapshot/byte-lock tests deterministically (`python-templates-drift.test.ts`, `snapshot.test.ts`, `to-node.test.ts` — R-patch §2d).

**S4 — hardening + `done.md`.** Full consumer sweep (all 24 type-check + exhaustiveness under Option B), the capability-commit `Prior-art:` trailer + SSOT row, and the umbrella `done.md` (CLAUDE.md «Umbrella closure convention»). If the owner resolved to STAY NARROW instead of unfreeze, S1..S4 do not run — `done.md` records the no-unfreeze decision and the umbrella closes without an IR change.

## §3 «Works» per stage (explicit + testable)

A relational node → rendered relational rule → firing test that fires RED on the bad example, clean on the good (the census's fired-exit-code discipline). python/astgrep = `ast-grep scan` exit 1 RED / exit 0 clean (CI-capable); the legacy scalar path stays byte-identical (the `to-node.test.ts` lock). No «render ≠ fire» over-claim (T-LG-B lineage): a green render is not a firing proof.

## §4 AI-laziness traps

See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md). **Active traps for this umbrella: T2, T3, T11, T12, T14, T15, T20, T21.**

- **T3** — every `file:line` (the 24 consumers, the byte-locks, the schema ceiling) re-verified live against `origin/staging` at ship, never from this doc or the R-patch alone (staging moves).
- **T11** — the relational IR is an ADAPT of ast-grep's `any/all/not/has` vocabulary, not a novel custom mechanism; the BFR §3 consult + SSOT row land with the capability commit before any «I propose this shape».
- **T14** — the rust expressibility is a stated GAP (R-patch §3), not «clean»: the unfreeze is python-data-only; do NOT report rust coverage that was never measured.
- **T15** — self-application: this umbrella unfreezes the IR for CONSUMER conventions; it does NOT make the framework's own rules self-generating (explicit non-goal, inherited from live-generation §self-application).
- **T20** — no «Option A» / «Option B» / «works» verdict without the same-turn evidence run quoted (the R-patch §1/§2 file:line, the census fired exit codes).
- **T21** — the S1..S4 backward-checks ENUMERATE the sibling ConventionNode consumers + the byte-lock/drift surfaces (R-patch §2 population), they do NOT restate the stage's own diff; delegate the class-sweep to a cold sub-agent, never hand it the PR.

**Domain-specific traps:**

- **T-LG-D — «unfreeze the IR to make researched rules expressive» (unilateral scope creep on a frozen artifact).** Quoted verbatim from [live-generation/kickoff.md §4](../live-generation/kickoff.md): «OWNER-FORK-1 — the census decides, the owner calls, and any unfreeze is a separate MT-plane umbrella touching every ConventionNode consumer. A live-gen stage may NOT add an IR field to «make the demo work».» In THIS umbrella the trap specializes: even here, a STAGE may not unfreeze before the owner has resolved the Option-A-vs-B precondition, and may not silently pick the shape to «make S2 render».
- **T-IRU-A — «pick one Option because it's less work / more elegant» (design-fork pre-emption, either direction).** Counter: Option A vs B is a genuine **invariant-vs-invariant** owner call (R-patch §1) — Option A anchored to the maintenance-budget / YAGNI invariant (BFR §2 — smallest surface meeting measured need), Option B anchored to the earliest-channel type-safety invariant (README invariant 4). Neither dominates a priori. A stage that defaults to EITHER — A because it is less work, OR B because it is «more type-safe / the projecty thing to do» — has *made the owner's decision for them* (the §1 STOP). Surface the fork with both principled anchors; do not resolve it.

## §5 See also

- [docs/meta-factory/research-patches/2026-07-21-ir-unfreeze.md](../../../docs/meta-factory/research-patches/2026-07-21-ir-unfreeze.md) — this umbrella's R-phase (§0 ground truth + 24-consumer table, §1 parked Option-A-vs-B fork, §2 blast-radius, §3 rust GAP, §4 backward-compat).
- [docs/meta-factory/research-patches/2026-07-13-lg-s1-expressibility-census.md](../../../docs/meta-factory/research-patches/2026-07-13-lg-s1-expressibility-census.md) — the DATA (40/93, +53.3pt relational delta, 3 require-via-ban cases).
- [.claude/orchestrator-prompts/live-generation/kickoff.md](../live-generation/kickoff.md) §1/§4 (T-LG-D)/STOP — the scope boundary that hands OWNER-FORK-1 to this umbrella.
- `packages/core/ir/types.ts` (`:3` freeze, `:32-41` node) + `packages/core/ir/convention-node.schema.json` (`:6`/`:26-28` scalar ceiling) — the FROZEN artifact this umbrella decides whether to unfreeze.
- [.claude/rules/ai-laziness-traps.md](../../rules/ai-laziness-traps.md), [build-first-reuse-default.md](../../rules/build-first-reuse-default.md), [no-paid-llm-in-ci.md](../../rules/no-paid-llm-in-ci.md), [doc-authority-hierarchy.md](../../rules/doc-authority-hierarchy.md).

## §6 STOP lines (binding)

- **NO stage may unfreeze the IR** (`ir/types.ts:3`) before the owner has resolved OWNER-FORK-1 (unfreeze-vs-stay-narrow) AND the Option-A-vs-B IR-shape precondition (R-patch §1). Absent either record → STOP and surface.
- **A stage may NOT pick Option A vs Option B.** The shape is an owner precondition, not a stage decision. Defaulting to the smaller-diff option IS picking (T-IRU-A).
- **NO forced migration of the 24 consumers.** The frozen scalar node stays a valid legacy instance (R-patch §4); relational is additive-opt-in.
- **The byte-exact order-sensitive lock** (`to-node.test.ts:129-137`) MUST stay green for legacy scalar nodes — a params-shape change that reorders keys breaks it.
- **NO rust coverage claim** without a real fired rust census (R-patch §3 GAP) — the unfreeze is python-data-only until then.
- **NO paid LLM in CI** — relational-params semantic validation, where not ajv-checkable (Option A string-blobs), routes to a session-side / cold-agent check, never a CI LLM gate ([no-paid-llm-in-ci.md](../../rules/no-paid-llm-in-ci.md)).

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
