<!-- scope:ir-unfreeze -->
# IR unfreeze (OWNER-FORK-1) — R-phase research-patch

> **Scope:** OWNER-FORK-1 — «unfreeze the neutral `ConventionNode` IR to a relational shape, or stay narrow?». This patch is DATA (the LG-S1 census) + BLAST-RADIUS (every ConventionNode consumer + the surfaces an unfreeze disturbs) + DESIGN-ALTERNATIVES (two IR shapes, PARKED). It **decides nothing** — the fork is the owner's; the actual unfreeze is a separate later umbrella. Folder-authority: [research-patches/](.) (scope-bound by gap). NOT authoritative for project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).
> **Status:** LANDED on `feat/fork1-rphase` as the OWNER-FORK-1 durable record feeding an `ir-unfreeze` umbrella kickoff. The unfreeze decision — and the Option-A-vs-B IR-shape pick — is an owner precondition, not closed here.
> **Data source:** [2026-07-13-lg-s1-expressibility-census.md](2026-07-13-lg-s1-expressibility-census.md) (the measured python expressibility data: 40.0% flat-precise / 93.3% flat+relational, n=15; the +53.3pt / 8-convention delta gated behind a relational unfreeze, incl. all **3** «require-via-ban» cases).
> **Method:** live re-read of the frozen IR + grammar gate + all 24 ConventionNode consumers against `origin/staging` tip `8747d8453`; every `file:line` re-confirmed with `git show origin/staging:<path>` / `git grep`. No prose-only load-bearing claim ([ai-laziness-traps.md](../../../.claude/rules/ai-laziness-traps.md) T3/T11/T15/T21). No `.ts` source modified — research only.
> **Date:** 2026-07-21.

---

## §0 Ground truth — the frozen IR and its consumer population

**The frozen node** (`packages/core/ir/types.ts:32-41`, verified `git show origin/staging:packages/core/ir/types.ts`):

```ts
export interface ConventionNode {
  id: string;
  claim: string;
  anchors: string[];       // FF-code namespace only (^FF\d{4}$), resolvable into diagnostics REGISTRY
  selectorClass: CapabilityClass;   // 'syntax' | 'type-aware' | 'dep-graph'  (types.ts:8)
  params: Record<string, string | number>;   // ← the frozen ceiling: FLAT SCALARS ONLY
  defaultSeverity: Severity;
  provenance: Provenance[];
  pairedExamples: PairedExamples;   // MANDATORY (grammar gate enforces)
}
```

**Why frozen.** `types.ts:3` states it verbatim: `// Node fields are FIXED by spec §3 — do not add fields (no capabilityTier/confidenceTier on the node: v0.2 dropped them).` The freeze is a deliberate spec-§3 decision, re-asserted at the kickoff level: `live-generation/kickoff.md:25` — «**FROZEN** — `ir/types.ts:3`; no field added unless OWNER-FORK-1 resolves to unfreeze, which is a separate MT-plane umbrella» — and as a binding STOP line (`kickoff.md:58`): «NO new `ConventionNode` fields … unless OWNER-FORK-1 resolves to unfreeze … a live-gen stage may NOT unfreeze the IR unilaterally.»

**The expressibility ceiling is `params`.** `params: Record<string, string | number>` (types.ts:37) is a **flat scalar map** — it cannot carry a relational structure (`not:` / `has:` / `all:` / `any:`). The census (§Data source) measured that this ceiling excludes 53.3% of real python conventions from *precise* expression. The JSON-Schema mirror enforces the same ceiling independently: `convention-node.schema.json:6` `"additionalProperties": false` (no new node field) and `:26-28` `"params": { …, "additionalProperties": { "type": ["string", "number"] } }` (params values are scalar string|number, no nested object/array). Any unfreeze touches BOTH the TS type and this schema.

**Consumer population — 24 files** (verified `git grep -l "ConventionNode" origin/staging -- "packages/core/**/*.ts" | grep -v test | wc -l` = 24):

| # | file | role vs the node |
|---|---|---|
| 1 | `backends/astgrep/render-astgrep.ts` | render backend (astgrep YAML) — reads `params.pattern` |
| 2 | `backends/cargo/demo/demo-node.ts` | cargo demo node |
| 3 | `backends/cargo/render-clippy.ts` | render backend (clippy.toml) — reads `params.path` |
| 4 | `backends/cargo/write-clippy.ts` | clippy writer |
| 5 | `backends/npm/from-node.ts` | render backend (npm declarative) — `params.selector/presence` |
| 6 | `backends/ruff/render-ruff.ts` | render backend (ruff TOML) — reads `params.kind/pattern` |
| 7 | `backends/shared/render-outcome.ts` | shared render-outcome type |
| 8 | `backends/shared/toolchain-backend.ts` | shared backend interface |
| 9 | `composition/compose.ts` | composition over nodes |
| 10 | `composition/demo/root-agents-demo.ts` | composition demo |
| 11 | `composition/enforcement-line.ts` | enforcement-line projection |
| 12 | `composition/gates/composition-gate.ts` | composition gate |
| 13 | `composition/types.ts` | composition types |
| 14 | `diagnostics/registry.ts` | FF-code registry (anchors resolve here) |
| 15 | `ir/gates/grammar.ts` | **the grammar gate** (validates the node) |
| 16 | `ir/types.ts` | **the frozen definition** |
| 17 | `python-starter/render-python-templates.ts` | python starter render |
| 18 | `python-starter/starter-nodes.ts` | python starter node data |
| 19 | `synthesizer/render-researched-astgrep.ts` | synth researched-astgrep render |
| 20 | `synthesizer/render-researched-clippy.ts` | synth researched-clippy render |
| 21 | `synthesizer/research-to-clippy-node.ts` | research→clippy node projection |
| 22 | `synthesizer/research-to-node.ts` | research→node projection |
| 23 | `synthesizer/synthesize.ts` | synthesizer врезка |
| 24 | `synthesizer/to-node.ts` | **the producer врезка** (byte-identity lock) |

This is the blast-radius population. Not all 24 need code changes for every variant (§2 maps which), but all 24 type-check against `ConventionNode` and so are candidates.

## §1 The relational-IR DESIGN-FORK — PARKED, do NOT choose

The census's decision-relevant delta (`+53.3pt`, 8 conventions, incl. all 3 «require-via-ban» cases; census §1/§2) is reachable only by letting `params` carry a **relational** shape. There are two honest ways to unfreeze. This section surfaces BOTH with balanced pros/cons; it picks NEITHER.

> **Owner note — census hedge (surfaced here, in the decision-relevant section):** the census names **3** require-via-ban cases (require-type-hints / require-future-annotations / require-docstring) but flags a possible wider **5**-case set («if the author intended a wider 5-case set, the additional 2 must be enumerated», census §1:23). This patch quotes the **named source of truth (3)**; the owner should be aware the positive-best-practice expressibility delta could be *marginally larger* if the 2 unnamed cases exist. It does not change the fork (both variants express the require-via-ban class identically) — only the *size* of the win, not the *choice*.

### Option A — `patterns: string[]` / string-composed relational params

Let the node carry a list of ast-grep relational sub-patterns as strings, composed by the backend into `any:` / `all:` / `not:` / `has:` blocks. Concretely: relax `params` values from `string | number` to also permit `string[]` (or add a sibling `relationalParams`), and let backends assemble the relational `rule:` YAML from the string list.

- **IR type change:** minimal — widen `params` value type to `string | number | string[]` (or a `patterns?: string[]` param key), plus the schema `additionalProperties` to allow arrays. Node stays a flat-ish bag; no discriminated union.
- **Backend change (4 targets):** astgrep (`render-astgrep.ts:26` explicitly «does not yet specialise the emitted `rule:` shape» — this is where relational YAML assembly lands); ruff, cargo/clippy, npm/eslint each decide degrade-vs-refuse for relational params they can't express (ruff `render-ruff.ts:26` already notes «it cannot express a call-site arg pattern» → likely FF7001/FF7002 refuse; clippy/npm similar).
- **Backward-compat cost:** LOW — a scalar-only legacy node is a valid special case of the widened type; existing byte-locks unaffected if the array key is absent.
- **Type-safety:** LOWER — relational structure lives inside opaque strings the type system can't validate; a malformed relational string is caught only at render/fire time, not by ajv/TS.
- **Expressibility ceiling:** the full ast-grep relational surface (`any/all/not/has`) as strings — covers the census's 93.3% band. Ceiling = «whatever ast-grep string composition can express»; not portable to non-ast-grep backends without per-backend translation.

### Option B — structured relational rule-object (discriminated union / condition tree)

Give the node a typed relational shape: e.g. a `RelationalRule` discriminated union — `{ op: 'not' | 'has' | 'all' | 'any', kind, pattern, children?: RelationalRule[] }` — replacing or augmenting the flat `params` for relational nodes.

- **IR type change:** LARGER — new exported types (condition tree / discriminated union), `params` either gains a `relational?: RelationalRule` field or a new `selectorClass`-parallel discriminator; schema gains a recursive object definition.
- **Backend change (4 targets):** each backend gains a *translator* from the neutral relational tree to its native form (astgrep YAML `rule:`, ruff — mostly refuse, clippy — mostly refuse, npm/eslint — selector composition). More work per backend, but the translation is type-checked, not string-spliced.
- **Backward-compat cost:** HIGHER — the union adds a node variant every consumer's exhaustive `switch`/type-guard must handle; the 24 consumers each need audit for exhaustiveness (TS will surface most as compile errors — a feature, not a bug).
- **Type-safety:** HIGHER — a malformed relational rule is a TS/ajv error at author time; the render backends get an exhaustively-checked input.
- **Expressibility ceiling:** whatever the neutral tree models — deliberately backend-agnostic, so it degrades gracefully per backend (a backend that can't express a node's tree emits FF7001, same pattern as the existing `selectorClass` refusals). Higher ceiling for cross-stack portability; more design work to model the tree.

### The honest tension (both framed, neither chosen)

- **Considerations favoring Option A (principled, not merely pragmatic):** (1) **YAGNI / avoid speculative generality** — the census measured need is a *relational subset* (8 conventions reducible to `kind + not:/has:/all:/any:` — census §1:22/§2), NOT a deep nested-condition grammar; Option A adds exactly the expressibility the data shows is needed and no more, whereas Option B bakes in a richer condition-tree than any measured convention requires. (2) **Maintenance-budget invariant** ([build-first-reuse-default.md §2](../../../.claude/rules/build-first-reuse-default.md) — «Primary user = single maintainer … each BUILT-ourselves capability creates perpetual maintenance cost»): Option A is a mostly-additive field disturbing the 24 consumers minimally, while Option B's exhaustive discriminated-union forces a type-level change through every consumer's `switch`/exhaustiveness (§4) — lower standing surface is itself a *principled* maintainability argument, not just a smaller diff. (3) **Continuity with the existing type philosophy** — the IR already carries string-typed params (`params: Record<string, string | number>`, `types.ts:37`); Option A extends that same string-bag philosophy, whereas Option B introduces a *new structural kind* to the node. (Pragmatic corollaries: fastest path to the census's 93.3% for the python/astgrep stack, least byte-lock disturbance, 1:1 match to ast-grep's own string-relational surface.)
- **Considerations favoring Option B (principled):** the project's own discipline is «executable artifact, type-safe, fails at the earliest reachable channel» (README#why-this-exists) — a string-blob relational param pushes the failure channel from author-time (TS/ajv) to render/fire-time, which is *later*, cutting against **invariant (4)** (multi-channel enforcement — fail at the earliest reachable channel). Option B keeps relational errors caught at the earliest channel (author-time TS/ajv). It also generalizes to rust/npm without per-backend string dialects, and the guided-migration compiler errors (§4) are a *feature* — the type system becomes the migration checklist.

**The two invariants in tension (symmetric read for the owner):** Option A is anchored to the **maintenance-budget / YAGNI** invariant (BFR §2 — minimize standing surface for a single maintainer, build only measured need); Option B is anchored to the **earliest-channel type-safety** invariant (README invariant 4 — catch errors at author-time not render-time). Neither invariant dominates a priori; the owner weighs «smallest surface that meets measured need» against «strongest author-time guarantee + cross-stack portability». This is a genuine invariant-vs-invariant trade, not invariant-vs-convenience.

**OWNER DECIDES — this patch does not pick.** Option A vs Option B is an owner precondition to the `ir-unfreeze` umbrella; no dispatched stage may choose it (kickoff STOP line). This patch records the trade-offs so the owner decides on evidence, not vibes.

## §2 Blast-radius map (each surface verified live at `origin/staging` tip `8747d8453`)

**(a) The grammar gate — `ir/gates/grammar.ts`.** Validates each node via ajv against `convention-node.schema.json` (`grammar.ts:31-33`, `SCHEMA_PATH`), then semantic checks FF6001 (degenerate pair, `:109-111`), FF6002 (dup id, `:85-89`), FF6003 (dangling anchor, `:113-117`). What changes: the **schema** (`convention-node.schema.json:26-28` params scalar-only ceiling) must widen for either variant; `additionalProperties:false` (`:6`) blocks any new node field (Option B if it adds a field). The semantic checks (FF600x) don't gate `params` shape today — a relational unfreeze may want a new FF-code for malformed relational params (Option A's string-blob can't be ajv-validated deeply; Option B's tree can). Registry codes live at `diagnostics/registry.ts` (FF6001/6002/6003 `:277-298`; FF7001/7002/7003 `:300-318`).

**(b) The byte-lock / round-trip surfaces.** The producer врезка `synthesizer/to-node.ts` (`buildNode` `:84-88`, projects only `{selector, presence}` into params, `:89-91`) is guarded by a **byte-exact, order-sensitive** lock: `synthesizer/to-node.test.ts:129-137` — `expect(JSON.stringify(out)).toBe(JSON.stringify(DECLARATIVE_RULE))` (the T-3B-A lock, review BLOCKER-1). The npm reverse adapter `backends/npm/from-node.ts` (`:23` imports the node; `params.selector/presence` contract `:44-47`) round-trips against it. Any params-shape change must keep these round-trips byte-identical for *legacy scalar nodes* — the lock is order-sensitive, so key-order in a widened params bag matters. Also byte-locked: `synthesizer/canonical-rule-hash.test.ts` (content hash, `:16-24`, order-insensitive) — a lower bar than to-node's byte-exact lock.

**(c) The 4 render backends** (each reads `params` and would translate/degrade/refuse relational input):
- **astgrep** — `backends/astgrep/render-astgrep.ts`: `renderAstgrep(nodes)` `:101`; backend params `{kind, pattern}` `:39-40`; validity guard `:62-67`. Comment `:25-26` — renders «`pattern` verbatim for all three `kind`s … does not yet specialise the emitted `rule:` shape» → **this is the primary relational-YAML insertion point** for either variant.
- **ruff** — `backends/ruff/render-ruff.ts`: imports node `:51`; `:26` «ruff bans a qualified NAME, it cannot express a call-site arg pattern» → relational params → likely FF7001/FF7002 refuse (ruff has no relational surface). Degrade-vs-refuse decision needed.
- **cargo/clippy** — `backends/cargo/render-clippy.ts`: imports node `:22`; params `{kind, path}` `:44-46`; `renderCargoClippy` renders disallowed-methods `:73`. Relational params → refuse (clippy disallowed-methods is not relational).
- **npm/eslint** — `backends/npm/from-node.ts`: params `{selector, presence}` `:44-47`; syntax-declarative only. Relational → selector composition or FF7001 refuse.

**(d) Canonical-regen / snapshot / drift tests that would need regeneration:** `backends/python-templates-drift.test.ts` (byte-drift gate «committed == fresh render», `:25`; regen cmd in-file `:12` `npx tsx packages/core/python-starter/render-python-templates.ts`); `synthesizer/snapshot.test.ts`; `render/render-rules.test.ts`; `backends/ruff/render-ruff.test.ts`; `synthesizer/to-node.test.ts` (byte-lock, (b)); `principles/28-synth-wire-oracle.test.ts` (synth→wire oracle). Any render-shape change re-baselines the committed template bytes — the drift gate FAILS until regen.

## §3 Rust census — GAP (not performed this session)

The python census exists ([2026-07-13-lg-s1-expressibility-census.md](2026-07-13-lg-s1-expressibility-census.md), n=15, real fired ast-grep exit codes). **A rust census does NOT exist and was NOT performed this session.** The census's own backward-check states the same boundary (census §5): «this census measures python only … does NOT claim to cover rust's expressibility (a rust census is future work if the owner takes up the unfreeze)».

Producing a rigorous rust census requires the same methodology shape as the python one — 10-15 real clippy conventions, each with a candidate rule *actually fired* against a pinned toolchain in a temp dir (real exit codes, no prose-only verdict). Two facts make an honest rust census infeasible **in this R-phase, this session**: (1) rust live-fire is CI-gated by design (`backends/cargo/firing.test.ts:37-38` `cargoPresent && !isCI` per `live-generation/kickoff.md`), i.e. it needs a local pinned cargo/clippy toolchain to fire for real; (2) fabricating expressibility verdicts without fired evidence would be exactly the T3/T14 trap the python census avoided (a low-coverage or evidence-free census is «insufficient», not «clean»).

**Recorded as a follow-up:** the unfreeze decision is **python-data-only** until a rust census lands. The owner should treat the +53.3pt delta as a python measurement; whether rust's clippy-disallowed-methods surface has a comparable relational gap is UNMEASURED. Honesty over coverage (T14): this is a stated GAP, not a silent omission.

## §4 Backward-compat + migration path

**Legacy frozen-IR nodes keep rendering — both variants.** Every existing node has scalar-only `params` (the census's 40% flat band, the python starter nodes `python-starter/starter-nodes.ts`, the synthesizer врезка output `to-node.ts:89-91`). Under **Option A**, a scalar-only node is a valid instance of the widened `string | number | string[]` type — no migration, the array key is simply absent, byte-locks (§2b) hold because `JSON.stringify` of an absent key is unchanged. Under **Option B**, a scalar-only node has no `relational` field / stays the non-relational union variant — existing consumers' type-guards keep matching it; the byte-lock holds identically. In both, **relational is additive**: a node either carries relational params (new) or doesn't (all 24 consumers' current inputs).

**Migration story for the 24 consumers.** No forced migration — the unfreeze is opt-in per node. The disturbance is: (1) the **render backends** (§2c, 4 files) must decide, per backend, degrade-vs-refuse for relational params they can't express — reusing the existing `selectorClass`-refusal pattern (FF7001, `render-astgrep.ts:14-15`); (2) under Option B, TS exhaustiveness will surface every consumer that `switch`es on the node shape as a compile error (a *guided* migration — the compiler is the checklist); under Option A, no compile errors but also no author-time validation of relational strings (the trade in §1). (3) the byte-lock + drift tests (§2b/§2d) must be re-baselined once, deterministically, via the in-file regen commands — a mechanical step, not a semantic one.

## §5 §1.7 self-review

**Forward-check.** This patch complies with:
- [no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md) — it proposes NO CI gate and NO paid LLM; all evidence is `git show`/`git grep` over `origin/staging`, deterministic and free. The §3 rust-census GAP is explicitly *not* offloaded to any LLM-in-CI.
- [build-first-reuse-default.md](../../../.claude/rules/build-first-reuse-default.md) — this patch proposes **NO build** (it is research surfacing a fork). No capability commit, no dependency, no code module. The eventual unfreeze's build-vs-reuse call (relational IR is BUILD-thin over the existing ast-grep relational surface — an ADAPT of ast-grep's own `any/all/not/has` vocabulary) is the owner's umbrella decision, deferred with this patch as its recorded trigger.
- [doc-authority-hierarchy.md](../../../.claude/rules/doc-authority-hierarchy.md) — carries the scope annotation + folder-authority header (`research-patches/`), claims authority for nothing beyond the OWNER-FORK-1 data/blast-radius/alternatives; does not touch README/CLAUDE.md/EXECUTION-PLAN goal-bearing artifacts.
- [ai-laziness-traps.md](../../../.claude/rules/ai-laziness-traps.md) T3 (every file:line is a real `git show`/`git grep` output, no memory), T11 (§1 surfaces the design space rather than proposing a single custom mechanism), T14 (§3 rust census recorded as GAP = «insufficient», not spun as «clean»), T15 (this §5 self-applies the discipline), T21 (backward-check below sweeps siblings, does not restate §0-§4).

**Backward-check.** Class of this change = **additive OWNER-FORK-1 research-patch** (records data + blast-radius + parked alternatives; changes no source). Enumeration of sibling surfaces where the same change-class occurs, each verdicted:
- [2026-07-13-lg-s1-expressibility-census.md](2026-07-13-lg-s1-expressibility-census.md) — the census this patch consumes. SWEPT: this patch **supersedes it not at all** — it is the downstream blast-radius companion; the census stays the authoritative *data*, this patch the authoritative *blast-radius + alternatives*. Confirmed the census says «3 require-via-ban» (census §1:23, §2:25-27), not 5 — this patch quotes 3, not a fabricated 5.
- [2026-07-11-live-generation.md](2026-07-11-live-generation.md) §Qb/§Forks — the R-phase that PLANNED the census and named OWNER-FORK-1 as «a separate MT-plane umbrella». SWEPT-CLEAN: this patch is that umbrella's R-input; supersedes nothing, the live-gen R-patch's §Qb decider framing is untouched.
- [live-generation/kickoff.md](../../../.claude/orchestrator-prompts/live-generation/kickoff.md) §1/§4/STOP-lines (`:25`, `:58`, `:96` T-LG-D) — the scope boundary that hands OWNER-FORK-1 to a separate umbrella. SWEPT-CLEAN: this patch stays *inside* that boundary (surfaces, does not unfreeze); the new `ir-unfreeze/kickoff.md` (Deliverable B) inherits the T-LG-D STOP verbatim. No live-gen artifact is edited.
- The frozen IR itself (`ir/types.ts:3`, `convention-node.schema.json`) — the artifact OWNER-FORK-1 decides on. SWEPT-CLEAN: **untouched** — no `.ts`/schema byte changed this session (research-only constraint honored; `git status` shows only the two markdown deliverables).

Self-application (T15): this patch applied its own «measure/verify, do not assert» discipline to itself — no §0-§4 claim rests on memory where a `git show`/`git grep` was reachable; the one place evidence was NOT reachable (rust expressibility) is the explicit §3 GAP, not a papered-over assertion.

## §6 See also

- [2026-07-13-lg-s1-expressibility-census.md](2026-07-13-lg-s1-expressibility-census.md) — the DATA (python expressibility, 40/93, the +53.3pt relational delta, the 3 require-via-ban cases).
- [2026-07-11-live-generation.md](2026-07-11-live-generation.md) §Qb/§Forks — R-phase that named OWNER-FORK-1 + the §Qb decider framing.
- [.claude/orchestrator-prompts/ir-unfreeze/kickoff.md](../../../.claude/orchestrator-prompts/ir-unfreeze/kickoff.md) — the umbrella kickoff this patch feeds (Deliverable B; provisional stages, IR-shape is an owner precondition).
- [.claude/orchestrator-prompts/live-generation/kickoff.md](../../../.claude/orchestrator-prompts/live-generation/kickoff.md) §1/§4 (T-LG-D)/STOP — the scope boundary handing this fork over.
- `packages/core/ir/types.ts` (`:3` freeze, `:32-41` node) + `packages/core/ir/convention-node.schema.json` (`:6`/`:26-28` scalar ceiling) — the FROZEN artifact OWNER-FORK-1 decides whether to unfreeze.
