# Multi-stack monorepo (§13.5) — I-2 Layer 2 kickoff (re-scoped: per-workspace scoping primitive)

> Scope: I-phase implementation kickoff for the `multi-stack-monorepo` umbrella, **Layer 2 (enforcement scoping)**. NOT authoritative for project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Research basis: [docs/meta-factory/multi-stack-monorepo-research.md](../../../docs/meta-factory/multi-stack-monorepo-research.md). **Re-scoped 2026-06-28** after Step-0 verification (basis in §1–§2); supersedes the original L2 "synth per-workspace emission" framing.

> **Staging-placement reminder** ([kickoff-staging-placement.md §1](../../rules/kickoff-staging-placement.md)): this kickoff is a tracked dispatch-input read from `staging`. Merge it to `staging` **before** `/pipeline multi-stack-monorepo` or any aif dispatch — a kickoff only on a feature branch is invisible to the dispatch consumer.

## §0 Status

- **I-1** (#780 core — fresh `-y` single-root stack auto-detect): **MERGED #790**.
- **I-2 Layer 1** (per-workspace stack DETECTION): **MERGED #793** — `_detect_stacks_per_workspace` / `_workspace_pkg_dirs` (`setup.d/lib.sh:~323,~344`) echo `dir<TAB>stack`, node-optional, tested.
- **I-2 Layer 2 (THIS kickoff): per-workspace enforcement SCOPING.** Re-scoped 2026-06-28 from "make synth emit per-workspace rules" → **"build the per-workspace scoping primitive + deliver each workspace's recipe-synced preset"** — because synth emits zero for timeliner's stacks and the live delivery mechanism is presets (see §2).
- **L2 base = `staging`** (L1 already merged).
- **Sibling umbrella opened in parallel:** `.claude/orchestrator-prompts/generation-live-delivery/` — the generation-thesis-realization (make the synthesizer the LIVE delivery; per-stack generation coverage). L2 here builds the first brick (the scoping primitive) that umbrella consumes. The deep-generation work is **OUT OF SCOPE here** (§3b).

## §1 Step-0 verification (the re-scope basis — all CONFIRMED 2026-06-28)

Each claim independently re-derived with evidence (subagents + git); worker re-verifies exact lines (T3 — lines drift).

| Claim | Verdict | Evidence |
|---|---|---|
| **C1** synth path is react-next-ONLY | CONFIRMED | `STACK_PATTERNS` single key `react-next` (`packages/core/install/synth-and-wire.ts:36-46`); non-react-next stacks early-exit before `synthesize()` (`:91-95`) → zero rules emitted |
| **C2** timeliner = ts-server + react-native, no react-next | CONFIRMED | `multi-stack-monorepo-research.md:19,:144`; Hono `apps/api`→ts-server, Expo `apps/mobile`→react-native, pnpm monorepo |
| **C3** per-workspace preset placement ABSENT today | CONFIRMED | installer picks ONE repo-wide `$STACK` (`install.sh:~179`), places ONE root config (`setup.d/40-configs.sh:~193-249`); `_detect_stacks_per_workspace` has ZERO consumers (dead-end) |
| **C4** synth-wire ⟂ R2-wire are separable | CONFIRMED | `wireNRules`/`buildRuleConfigElement` (synth) vs `wireConfigSource`/`r2Element`/`resolveAndWire` (R2); zero call-graph overlap; R2 excluded at `synth-and-wire.ts:33-34` |
| **C5** SSOT max id | CONFIRMED | max = **#181** on origin/staging; next free = **#182**; the old "#869" never existed |
| **C6** L1 merged | CONFIRMED | staging tip `670365094` (#793); detection fns + `workspace-stack-detect.test.sh` on origin/staging |

> **Stale-path note (T3):** `_detect_stack_from_pkg` relocated to `setup.d/lib.sh:~300` in I-1 (#790). The research doc's pre-I-1 paths (`15-companions-stack.sh:24-59`; research §1 lines ~113/166) are **stale** — re-verify against `lib.sh` when consulting research per T3.

## §2 Architectural ground truth (read BEFORE building — this is the whole reason for the re-scope)

- **Two disjoint pipelines.** **Pipeline A (shipped consumer install):** recipe-synced **preset placement** (`setup.d/40-configs.sh:~193-249`) → `synth-and-wire` drift-overlay → R2 per-package wirer (`wire-eslint-r2.ts`). Artifact = `eslint.config.mjs`. **Pipeline B** (`packages/core/installer/`, `rules-lock.json`) = **NOT wired into install** (zero callers) → OUT OF SCOPE (see `generation-live-delivery` umbrella).
- **Presets are recipe-synced delivery, NOT stale-static.** `synth-and-wire.ts:6-8` + principle 26 (`26-template-selector-sync.test.ts`) keep each preset's selectors byte-synced to the recipe SSOT. The synthesizer is currently a **drift-correcting no-op overlay**; the **preset carries delivery**. Placing a preset per workspace = delivering recipe-synced rules (test-protected from staleness), **not** placing stale config.
- **THE gap (the primitive to build).** Both rule emitters — `buildRuleConfigElement` (synth/N-rule path, `wire-eslint-r2.ts:~222-238`, signature `(ruleName, value)` — no scope param) and `r2Element` (R2 path, `wire-eslint-r2.ts:~41`) — emit **GLOBAL** rule blocks; there is **no `files:` emission seam anywhere**. The `applies-to: string[]` field is declared (`packages/core/synthesizer/types.ts:~58`, `packages/core/render/render-rules.ts:~20`) but is a **DEAD field — zero readers** (verify: `grep -rn "applies-to" --include="*.ts" packages/core | grep -v test` → declarations only; quote `"*.ts"` so it survives zsh). Do **NOT** confuse it with `appliesTo` (camelCase) — that is the recipe→framework filter (`synthesize.ts`), fully wired, a different semantic. The per-workspace scope is supplied by the **install-time `dir→stack` map** (`_detect_stacks_per_workspace`), **NOT** plumbed from the recipe. Field-present ≠ pipeline-emits-it (T-MS-A).
- **Generated-rule coverage for timeliner is sparse.** All 10 synthesizer recipes target `next` (`appliesTo:["next"]`). Core custom rules R2/R7/R8 are universal (`packages/core/eslint-rules/`). ts-server and react-native have **no** stack-specific custom rules. ⇒ for timeliner, the only generated rule scopable to a workspace is **R2** (→ `apps/api`); react-native enforcement is its preset (upstream plugins). This is expected — enriching generation coverage is the sibling umbrella, not this one.

## §3 Deliverable (Path A scope)

1. **Per-workspace scoping primitive — the genuine generation advancement.** Add a `files:` emission seam to **BOTH** rule emitters: `buildRuleConfigElement`/`wireNRules` (synth/N-rule path) **and** `r2Element`/`wireConfigSource` (R2 path) — both emit global today (`wire-eslint-r2.ts:~222-238`, `~41`). When a workspace scope is supplied, emit `{ files: ['<dir>/**'], rules: {…} }`. **REFERENCE native ESLint flat-config `files:`** (SSOT #182, §7) — build the **emission**, never a scoping engine. **Scope source = the install-time `dir→stack` map** from `_detect_stacks_per_workspace` (`setup.d/lib.sh`) — **wire the dead-end** (currently zero consumers). The declared `applies-to` field is **NOT** the carrier (dead, zero readers — §2); do **not** plumb scope from the recipe `appliesTo` (T-MS-A countermeasure embedded **here at the task**, not only in §5).
2. **R2 scoped per ts-server workspace.** Scope R2 to `apps/api/**` instead of global, driven by the detection map. **Surface to touch (re-verify lines first):** `r2Element` (`~:41`) returns a **hardcoded global** block; the scope param must thread `resolveAndWire` (`~:481`) → `wireConfigSource` (`~:106`, its `TransformOpts`) → `r2Element`. **Probe-invariant interaction (load-bearing):** the R2 probe (`~:421-426`, `~:494-510`) assumes a **global** element ("verdict depends only on whether the plugin is registered anywhere") — re-validate the probe still resolves the plugin when the element is `files:`-scoped, or the probe escalation logic breaks. R2 is the one generated rule that applies to timeliner's ts-server workspace.
3. **Per-workspace recipe-synced preset delivery.** `setup.d/40-configs.sh:~193-249` is today a flat single-`$STACK` `if/elif` chain (**NOT a loop**) placing ONE root config — **convert it to a per-workspace loop** over `_detect_stacks_per_workspace`: each workspace dir gets its stack's recipe-synced preset `eslint.config.mjs` + `eslint-rules-local`. **ORDERING CONTRACT (load-bearing):** `99-finalize.sh:~65-83` already runs a per-package `find … eslint.config.mjs` loop (the R2 wirer) — 40-configs MUST place the per-workspace configs **before** 99-finalize runs, else the R2 find-loop finds nothing to wire. **REAL WORK-ITEM (from C3):** presets' internal globs/imports resolve relative to the config's own dir, so place `eslint-rules-local/` per workspace **OR** compute a relative import specifier up to a shared root — **REUSE the `customRulesImportSpecifier` pattern** (`wire-eslint-r2.ts:~52-57`). Verify per-workspace `tsconfigRootDir: import.meta.dirname` resolves to the workspace (type-aware correctness — the property this topology preserves).
4. **Shared-lock traceability (optional, separable from tasks 1-3).** Record the per-workspace stack→rules assignment for traceability. The declared `applies-to` field (currently **dead** — §2) is its natural home, but populating it is **independent** of the `files:` emission (which sources scope from the detection map, not this field — see task 1). Preserves the §13.5 hypothesis goal "lock общий, в нём «правило R applies-to <dir>/**»". If `applies-to` is wired as the lock marker, it becomes a live field — update its declaration-site usage accordingly.

## §3b OUT OF SCOPE — deferred to the `generation-live-delivery` umbrella (DO NOT build here)

- Wiring **Pipeline B** (generation engine / `rules-lock.json`) into consumer install.
- Authoring **recipes / STACK_PATTERNS** (generation coverage) for ts-server / react-native / react-spa.
- Making the synthesizer the **LIVE delivery** (retiring preset-as-delivery).

These are the generation-thesis-realization → `.claude/orchestrator-prompts/generation-live-delivery/kickoff.md`. Building them here = build-ahead-of-need ([build-first-reuse-default.md §4](../../rules/build-first-reuse-default.md) `#integration-overhead-overestimate`) — **timeliner does not require them** (§2). This kickoff builds the scoping brick they will consume.

## §4 Acceptance

- **Fixture:** pnpm monorepo, ts-server `apps/api` + react-native `apps/mobile`, NO react-next.
- Each workspace's `eslint --print-config <file-in-dir>` shows its stack-appropriate rules (`apps/api` → ts-server rules + R2; `apps/mobile` → react-native rules). The secondary stack is **NOT silently dropped** (#780 nuance).
- **R2 appears scoped to `apps/api/**`** (not global) — proven by `--print-config`, **not** by field presence (T-MS-A).
- Type-aware rules resolve against **each workspace's own** `tsconfig` (per-workspace `tsconfigRootDir`).
- **Scoping-primitive proof independent of timeliner's thin exercise:** a unit/fixture test where a generated rule emits `files: ['<dir>/**']` (e.g. an `apps/web` react-next workspace gets R12 scoped to `apps/web/**`) — proves the primitive generally, since timeliner only exercises it via R2.
- Single-stack repos unaffected (no regression vs I-1 / the #646 multi-preset baseline).
- A workspace whose `package.json` is genuinely `unknown` under `-y` → re-checkable marker, **NOT** `exit 1` (research §6 Fork-4 / Option B default).

## §5 AI-laziness traps (per [ai-laziness-traps.md §3](../../rules/ai-laziness-traps.md) — cite + enumerate + domain trap)

Active: **T3, T7, T11, T12, T15, T16, T-MS-A**, plus domain traps below.

- **T-MS-A (primitive-present ≠ pipeline-uses-it) — THE central trap.** `applies-to` exists in the type + render schema but is never emitted as `files:`. Prove `files:` is **actually emitted** (`eslint --print-config`), not that the field type exists.
- **T16 (pattern-matching-on-name), twofold.** (a) "preset" is NOT anti-generation — it is recipe-synced delivery (§2); don't reject preset placement as "stale static". (b) Don't author ts-server/RN recipes "because generation is the project thesis" — verify a consumer needs them (none does → §3b).
- **T-MSM-A (domain).** Tempted to read the monorepo **root** `package.json` as the stack signal — in a pnpm monorepo root often has neither stack's deps. Walk **per-workspace** `package.json` via `_detect_stacks_per_workspace`, never root-only.
- **T-MSM-C (domain, NEW).** Tempted to build generation coverage for ts-server/react-native "because generation is the thesis" → that is the `generation-live-delivery` umbrella, and build-ahead-of-need for §13.5. Counter: §3b is explicit; timeliner is served without it.
- **T11/T12 (don't build a scoping engine).** ESLint flat-config `files:` is native (REFERENCE, SSOT #182). Re-run a search only for a NEW capability slice not in research §1.
- **T3** (no recalled citations — re-read file:line), **T7** (adversarial "what did I miss" at design close), **T15** (if a per-workspace-scoping rule is codified, it self-applies the §1.7 + header it mandates — §8).

## §6 Coordination = Option C (independent) — settled

`chore/install-ast-wiring-kickoff` is **dormant** (branch exists, no PR — re-probe before dispatch). Boundary under per-workspace config **creation**: this umbrella **CREATES** per-workspace configs from recipe-synced presets; install-ast-wiring **EDITS** consumer-authored per-package configs — different files, no parallel-build (`#parallel-evolution-creep`). Note at integration; do not fold.

## §7 SSOT (prior-art register)

Max id on origin/staging = **#181** (verified C5). **Next free = #182.** Cite landed L1 entries **#180** (Nx REFERENCE) + **#181** (pnpm/turbo REFERENCE). The L2 capability commit appends **#182** = ESLint flat-config native per-directory `files:` scoping + nearest-config resolution (REFERENCE — the scoping primitive's prior-art; T16 line: upstream = native rule-scoping inside a flat-config array, ours = pipeline EMITS per-workspace `files:` from the detection map; we build no scoping engine). **Do NOT reuse research §1's draft #111–#113** — those numbers are taken (`/dispatcher`, `/aif-doctor`, `writing-skills`); stale.

## §8 Per-commit + new-artefact obligations

- **Capability-commit (load-bearing).** The `files:`-emission work (new emission seam / likely a new ≥50–80 LOC module) is a **capability commit** — it MUST carry a `Prior-art: …#182` trailer **and** land the **#182 SSOT row in the SAME commit** (per [CLAUDE.md](../../../CLAUDE.md) build-vs-reuse gate; the SSOT is append-only). A separate-commit SSOT row or a missing trailer trips the `.husky/pre-push` gate.
- **New-artefact (if a rule/principle is added).** A per-workspace-scoping discipline (if codified) MUST carry: **§1.7** forward/backward note ([phase-research-coverage.md §1.7](../../rules/phase-research-coverage.md) — use the `self-reflection` skill); **doc-authority header** ([doc-authority-hierarchy.md §3](../../rules/doc-authority-hierarchy.md)) + registration in `packages/core/principles/09-doc-authority-hierarchy.test.ts` `REQUIRED_HEADER_DOCS`.

## §9 See also

- [docs/meta-factory/multi-stack-monorepo-research.md](../../../docs/meta-factory/multi-stack-monorepo-research.md) — R-phase research (REUSE-map, fork resolution; §3 Fork-3a "emit per-workspace `applies-to`" = this kickoff's §3 task 1).
- [docs/meta-factory/open-questions.md §13.5](../../../docs/meta-factory/open-questions.md) — the open question (status `open, armed`).
- `.claude/orchestrator-prompts/generation-live-delivery/kickoff.md` — sibling thesis-realization umbrella (§3b deferred work).
- [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md), [build-first-reuse-default.md](../../rules/build-first-reuse-default.md), [doc-authority-hierarchy.md](../../rules/doc-authority-hierarchy.md).

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
