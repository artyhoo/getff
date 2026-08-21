<!-- bridge: auto -->

# Zero-dep synthesizer bundle for install — kickoff (#755)

> Path-3 follow-up to the `generator-install-wiring` umbrella (#728). Closes the gap that variant-2 (#746) leaves: the synthesizer does NOT run in a lite (non-`--full`) install at all. This kickoff makes it run **everywhere** with zero consumer dev-deps.

## 0. Why this exists (read first)

#746 made the deterministic synthesizer (`synthesize.ts`, NOT live-LLM `generate.ts`) the **source** of the consumer's `rules-as-tests` config slice, with the hand-written preset retained as the **oracle** (principles 26 + 28). But #746 shipped **variant 2**: `setup.d/99-finalize.sh` runs the synthesizer only when its runtime (`tsx`/`ajv`/`semver`) already resolves (i.e. under `--full`) and **skips gracefully** otherwise. Variant 1 (unconditionally install those 3 dev-deps into the consumer) was **rejected** — it invoked the package manager without consent, violating the mechanically-tested `consumer-install-completeness` S3 «B neg» rule ("PM not invoked without consent" for a lite install).

Net: in a lite install the generator never runs; lite consumers get the rules only via the p26-verified preset hand-copy. Path 3 (this kickoff) precompiles the synthesizer into a **single self-contained `.mjs`** with `ajv`+`semver` bundled in, so `99-finalize.sh` runs `node …bundle.mjs` — plain Node, **no `tsx`, no consumer dev-deps, on every install**. This is the honest end-state of the umbrella's stated goal.

## 1. Goal (one sentence)

Ship `synth-and-wire` as a precompiled, zero-runtime-dependency `.mjs` bundle so install drives the deterministic synthesizer on **any** consumer (lite or `--full`) using only plain `node`, and remove the variant-2 runtime-presence skip.

## 2. Ground truth (verified on `origin/staging` 618bd9ccb — re-verify before trusting)

- **Entry point:** `packages/core/install/synth-and-wire.ts:48` (`main()`). CLI: `--stack <name> --path <file> [--dry-run]` (`:64-73`). The `process.argv[1].endsWith('synth-and-wire.ts')` self-run guard is at `:152` — a `.mjs` bundle changes this filename, so the guard must be updated.
- **Import chain to inline:** `synth-and-wire.ts:27-29` imports `loadEntries` (`../research/load.ts`), `synthesize` (`../synthesizer/synthesize.ts`), `wireNRules` (`./wire-eslint-r2.ts`). Transitively: `synthesize.ts:9` `import { Ajv } from 'ajv'`; `synthesize.ts:15-16` `synthesizer/compile-declarative-md.ts` + `synthesizer/merge-eslint-config.ts` (both under `synthesizer/`, NOT `install/`); `research/load.ts:13` `import semver from 'semver'`; `research/load.ts:14-15` `research/allowlist.ts` + `research/internal-validators.ts`. **External deps to bundle in: `ajv`, `semver`** — note `ajv` IS declared (`packages/core/package.json:58`) but **`semver` is NOT declared in any package.json** (transitive-only — see §3 step 1 / risk §7.5).
- **Keep external (do NOT inline): `ts-morph`.** `wire-eslint-r2.ts:122` resolves it via `requireFromCwd.resolve('ts-morph')` from the consumer cwd (NOT a static `import`), and `:103-104` documents the dynamic-import degrade path. The idempotent path (`:idempotent string short-circuit`) never reaches it. The bundle must load and run the idempotent path with ts-morph absent.
- **Recipes + schemas are `fs`-read, NOT `import`ed** — `research/load.ts:33` `JSON.parse(readFileSync(...))`, etc. **BUT** all of these resolve their root relative to their module via `import.meta.url`, and esbuild collapses every inlined module into **one file with a single `import.meta.url`** (the bundle's own path in `install/`). So **EVERY** `resolve(dirname(fileURLToPath(import.meta.url)), …)` anchor in the inlined chain breaks under bundling. There are **FOUR**, not one — re-verified this session:
  - `research/load.ts:18-19` → `STORE_ROOT = resolve(HERE,'store')` → would become `install/store` (real: `research/store/`). Break = silent `{}` no-op (`loadEntries` returns `[]`).
  - `synthesizer/synthesize.ts:19` → `RECIPES_ROOT = resolve(HERE,'recipes')` → `install/recipes` (real: `synthesizer/recipes/`, 10 files). Break = `loadRecipe()` returns null for every pattern → `synthesize()` emits `{}` → **silent green-lie** (the exact T-755-A failure).
  - `synthesizer/synthesize.ts:20-21` → `SCHEMA_PATH` + `RECIPE_SCHEMA_PATH` (`synthesis-plan.schema.json`, `recipe.schema.json`). Break = schema read fails.
  - `research/internal-validators.ts:12,16` → `SCHEMA_PATH = resolve(HERE,'research-plan.schema.json')` + a **top-level** `readFileSync` at module-eval time. Break = **hard ENOENT crash on import**, before `main()` even runs.
  **The fix (§3 step 4) MUST cover all four anchors, not just store-root.** This is a systemic "bundle loses its file anchors" problem, not a single-parameter tweak.
- **No unknown-flag rejection in the CLI.** `synth-and-wire.ts:64-73` parses `--stack`/`--path`/`--dry-run` via `argv.indexOf` and **silently ignores any unrecognized flag** — there is no "unknown flag → error" branch. A `--store-root` passed before step 4 wires it through would be swallowed, leaving the broken default → green-lie. See §3 step 4 + the ordering hard-gate.
- **99-finalize variant-2 block:** `setup.d/99-finalize.sh` runs `node -e "require.resolve('tsx');require.resolve('ajv');require.resolve('semver')"` as a presence gate, then `npx --no-install tsx "$_synth_wirer" --stack … --path … [--dry-run]` from `$PROJECT_ROOT`, with `$_synth_wirer="$PKG_ROOT/packages/core/install/synth-and-wire.ts"`. rc=0 on every branch; honours `--dry-run`. **This whole presence-gate + tsx invocation is what step 5 replaces.**
- **In-repo precedent for precompile + drift-gate:** `scripts/build-shipped-eslint-rules.sh` compiles `.ts→.mjs` via `tsc` and has a `--check` drift mode (regenerate-to-temp + compare; fails on mismatch). `scripts/format-shipped.sh --check` and `pre-push.ts` `--check` are the same family. **Reuse this `--check` pattern; do NOT invent a new one.** Note: that script uses `tsc` and does NOT bundle external deps (ESLint rules are self-contained) — it is a structural precedent, not a drop-in (this task needs a real bundler).
- **Provenance machinery exists:** `packages/core/synthesizer/canonical-rule-hash.ts` + `verify-provenance.ts` (SSOT #172). The bundle is itself a generated artifact and must carry a provenance header + be guarded against hand-edit (the `--check` drift-gate is that guard).
- **PKG_ROOT semantics:** `install.sh:37` `PKG_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"` — the synthesizer runs from the unpacked framework payload, NOT copied into the consumer. The bundle ships at `$PKG_ROOT/packages/core/install/synth-and-wire.bundle.mjs`; the recipe store ships at `$PKG_ROOT/packages/core/research/store/`. Both are already in the payload.

## 3. Steps

> **Ordering hard-gate (read before starting):** step 4 (fix the four file anchors) is a **prerequisite** for step 5 (switch `99-finalize.sh` to the bundle). Do NOT land/merge step 5 until step 4 is complete AND `loadEntries`/`synthesize`/`internal-validators` actually accept + use the new root. Because the CLI silently swallows unknown flags (§2), a step-5-before-step-4 state passes as a successful empty no-op (green-lie). As part of step 4, also add an **unknown-flag guard** to `synth-and-wire.ts` argv parsing (an unrecognized `--flag` → `console.error` + `process.exit(0)` with a clear message, OR at minimum a warning) so a mis-wired flag is loud, not silent.

1. **Add esbuild as a devDependency in the ROOT `package.json`** (framework build tooling; the build script invokes it from `$ROOT/node_modules/.bin/esbuild`, same path-resolution as `build-shipped-eslint-rules.sh:21` calls `$ROOT/node_modules/.bin/tsc` — declaring esbuild at root keeps the build-tooling layer separate from `packages/core` runtime deps) — never a consumer dep. Pin the version (per `ci-tool-pinning.md` — a pinned esbuild keeps the rebuild byte-stable so the drift-gate is deterministic). **Also declare `semver` as a direct dependency of `packages/core`** (it is currently transitive-only — `--packages=bundle` would otherwise inline whatever version hoisting happens to surface, breaking byte-determinism of the drift-gate; `ajv` is already declared at `packages/core/package.json:58`).
2. **Add a build step** `scripts/build-synth-bundle.sh` (mirroring `build-shipped-eslint-rules.sh`'s build + `--check` two-mode shape). It runs:
   ```bash
   esbuild packages/core/install/synth-and-wire.ts \
     --bundle --platform=node --format=esm --target=node20 \
     --packages=bundle --external:ts-morph \
     --banner:js="import{createRequire as ___cr}from'node:module';const require=___cr(import.meta.url);" \
     --outfile=packages/core/install/synth-and-wire.bundle.mjs
   ```
   - `--packages=bundle` is explicit (esbuild's node default flipped 0.22↔0.23; do not rely on it).
   - `--banner:js` defines a real `require` so `ajv` (CommonJS) bundled into ESM output does not crash with `Dynamic require of "X" is not supported` (esbuild#1921/#1944). **This banner is load-bearing — see §7.1.** Also confirm esbuild **elides type-only imports** (`import type {…}` in the chain) rather than emitting a runtime `require` for them — default behaviour, but verify no `tsconfig`/`verbatimModuleSyntax` setting forces otherwise (would resurface the same `Dynamic require` symptom).
   - `--external:ts-morph` leaves any ts-morph import/require verbatim in the output.
3. **Update the self-run guard** `synth-and-wire.ts:152` so it fires when run as the `.bundle.mjs` (e.g. `endsWith('synth-and-wire.bundle.mjs') || endsWith('synth-and-wire.ts')`), so the bundled entry actually executes `main()`.
4. **Fix ALL FOUR `import.meta.url`-relative resource anchors** (per §2) so the bundle finds its data files — NOT just store-root. The four: `load.ts` `STORE_ROOT`, `synthesize.ts` `RECIPES_ROOT` + `SCHEMA_PATH` + `RECIPE_SCHEMA_PATH`, `internal-validators.ts` `SCHEMA_PATH`. Two defensible mechanisms (this is the §9 parked fork):
   - **(a) explicit root override** — thread a single base-dir (e.g. `--package-root <dir>` CLI flag or `AIF_SYNTH_PKG_ROOT` env) down to each anchor (`loadEntries(…, root?)`, parameters on the synthesize/validator module init), `99-finalize.sh` passes `$PKG_ROOT/packages/core`. Keep the `import.meta.url`-relative default for the un-bundled `.ts` path (back-compat: principle 28 oracle calls `loadEntries` with 3 args — an optional trailing param is safe, verified).
   - **(b) inline the static data** — use esbuild's `json` loader / `--loader` to embed the recipes + schemas (static, ship-time-fixed) directly into the bundle, eliminating the `fs` reads entirely. Cleaner for schemas; heavier for the recipe store.
   **Park this choice (§9) — do NOT silently pick.** Whichever is chosen, ALL FOUR anchors must be covered. Do NOT hardcode an absolute path. Add the unknown-flag guard here (ordering hard-gate above).
5. **Switch `99-finalize.sh`** from the variant-2 presence-gate + `npx --no-install tsx <.ts>` to `node "$PKG_ROOT/packages/core/install/synth-and-wire.bundle.mjs" --stack … --path … <root-override per step 4> [--dry-run]`. **Remove** the `require.resolve('tsx'/'ajv'/'semver')` skip block (its job is now done by the bundle). Keep: rc=0 on every branch, `--dry-run` honoured, runs regardless of `_r2_verdict`. **Gated on step 4 (ordering hard-gate).**
6. **Add a CI + pre-push drift-gate**: `scripts/build-synth-bundle.sh --check` rebuilds to a temp file and `git diff --exit-code` (or sha256 compare) vs the committed `synth-and-wire.bundle.mjs`; fail on mismatch. Wire into `package.json` scripts + the same CI surface that runs `build-shipped-eslint-rules.sh --check`. For provenance: **prefer asserting the generated `createRequire` banner suffices as the sole-writer marker** — if you add an explicit provenance header, it MUST contain **no non-deterministic fields** (no timestamp, no random, no build-host) or the `--check` rebuild will always diff (false drift). `build-shipped-eslint-rules.sh` injects no timestamp — match that.
7. **Confirm recipe + schema data shipping**: recipes (`synthesizer/recipes/`, `research/store/`) and schemas are `fs`-read JSON in the payload; verify nothing in the inlined chain `import`s a recipe/schema as a module (it does not, per §2). If step 4 chose mechanism (b), this is satisfied by inlining instead. Just confirm.

## 4. Build-vs-reuse mandate (capability commit — `Prior-art:` trailer REQUIRED)

- **Verdict: ADOPT esbuild** (devDependency + build artifact). Research done this session (SSOT consult + DeepWiki `evanw/esbuild` + WebSearch ×6 across 2 question sets):
  - esbuild is the lowest-overhead tool doing all four required things — ESM+TS input, dep inlining (`--bundle`), per-dep externalization (`--external:ts-morph`), zero added paid/LLM surface — with the strongest maintenance signal.
  - Alternatives rejected: `tsup` (just wraps esbuild — extra layer, no gain), `@vercel/ncc` (viable #2 fallback), `rollup` (more plugin config), `bun build --compile` (produces a binary not a `.mjs`, drags in Bun).
- **SSOT: no existing `prior-art-evaluations.md` entry covers a JS bundler.** Closest analogs: #58 (remark, ADOPT — different domain), #172 (generated-bundle integrity, ADAPT). **A NEW SSOT entry for esbuild is REQUIRED in the same commit as the build-step capability**, with Verdict=ADOPT, the rationale above, and Trigger-to-revisit (e.g. "esbuild abandons `--packages=bundle`/`--external` semantics, or a lighter zero-config single-file ESM bundler proves cheaper").
- Every capability commit carries a `Prior-art:` trailer referencing the new SSOT entry. Confirm esbuild pulls no paid-LLM / no network at build time (`no-paid-llm-in-ci.md`).

## 5. Constraints / invariants (hard)

- **No paid LLM, no network in install/CI.** Deterministic synthesizer only (`synthesize.ts`/`compile-declarative-md.ts`); never `generate.ts` (principle 17). esbuild is a local, offline build step.
- **Zero consumer deps from the synth path.** A lite consumer's `node_modules` must gain **no** `tsx`/`ajv`/`semver` from this path. This is the whole point — and it keeps `consumer-install-completeness` S3 «B neg» green (no PM invoked without consent).
- **Sole-writer + provenance preserved.** The bundle is a generated artifact: regenerated only by `build-synth-bundle.sh`, never hand-edited; the `--check` gate enforces it. Do not weaken the synthesizer's existing provenance/S5 anti-hand-edit discipline.
- **Idempotent + non-destructive** on the consumer config (unchanged behaviour from #746's wirer).
- **Agnostic core.** No Claude-Code dependency in the bundle or wiring — keep principle 21 green.
- **Pin esbuild** (`ci-tool-pinning.md`) so the committed bundle is byte-reproducible and the drift-gate is meaningful.
- **Stay in scope** (CLAUDE.md «PR strategy»): if you spot an adjacent systemic issue, surface it in the final report — do NOT expand this PR or open a drive-by PR.

## 6. Acceptance gates (done when…)

- `bash install.sh react-next --force` on a **fresh isolated consumer with NO dev-deps** runs the synthesizer to completion (t6 path-A: `synth-wire … confirmed/idempotent` line present) using **only plain `node`** — zero `tsx`, zero `npm i` into the consumer. **Verify in a `mktemp` isolated consumer, NOT the dev container** (the aif container masks this 3 ways — warm `npx` cache, parent `node_modules`, parent `npm i` "up to date"; only an isolated runner reproduces).
- A lite consumer's `node_modules` gains **no** `tsx`/`ajv`/`semver` from the synth path (grep/`ls node_modules` proof).
- The variant-2 `require.resolve('tsx'/'ajv'/'semver')` skip block in `99-finalize.sh` is **removed**.
- `tests/install-sh/t6-synth-wire-planted-violation.test.sh` is green in CI **without** any dev-dep install.
- `scripts/build-synth-bundle.sh --check` is green (committed bundle == fresh rebuild) and wired into CI + pre-push.
- **#1 acceptance gate (falsifies the whole approach):** run the built `.mjs` on a machine with no `tsx`/`ajv`/`semver` and drive a **real react-next synthesize** through the actual recipes + schemas (not a hand-picked minimal schema). It must (a) load recipes from the real anchors (no `{}` no-op), (b) not crash on schema reads (validators import), (c) validate through `ajv` without `Dynamic require`/`Cannot find module`. If ajv throws → banner/bundling/string-require issue (§7.1); if synth emits `{}` → a broken file-anchor (§7.2).
- Principles 17, 21, 25, 26, 27, 28 stay green; `make self-audit` green.
- Re-running install is a no-op; `--dry-run` writes nothing.

## 7. Risk note / falsifiers (in priority order)

1. **ajv under the bundler (THE #1 falsifier — TWO distinct failure modes).** ajv uses runtime code generation (`new Function`). (a) The widely-cited "ajv breaks under bundlers" failure is a **CSP `unsafe-eval` / Cloudflare-Workers** problem — does NOT apply to plain Node 20/22/24 (no CSP). (b) ajv is CommonJS → bundling into ESM triggers esbuild's `__require` shim → `Dynamic require of "X" is not supported`; the `createRequire` banner (§3 step 2) fixes this. **(c) NEWLY FLAGGED — string-embedded runtime requires:** ajv@8 emits **string** `require("ajv/dist/runtime/equal")` / `uri` / `ucs2length` / `re2` / `parseJson` inside the *generated* validator code, resolved at `ajv.compile()` time and activated by specific keywords (`format`, `uniqueItems`, `$data`, unicode patterns). Under `--packages=bundle` ajv is inlined but those `ajv/dist/runtime/*` modules are NOT on disk beside the bundle → the createRequire banner defines `require` but the **target is absent** → `Cannot find module`. **The current three schemas use only `pattern` (no `format`/`uniqueItems`/`$data` — verify with grep), so this does NOT fire today** — but that is a **documented bet, not a fact**: trigger-to-revisit = *any schema gains `format`/`uniqueItems`/`$data`/unicode → switch ajv to standalone/precompiled-validators mode*. **Falsifier / acceptance:** §6 gate must validate through ajv on the REAL recipes+schemas (not a hand-picked minimal one); if a future schema adds a runtime-helper keyword and the gate stays green only because the bundle test used a `pattern`-only schema, that is a sampling artifact (T1/T14). Do NOT add ajv-standalone preemptively, but DO record the bet + trigger.
2. **The four file-anchor breaks (BLOCKER-class — see §2 + §3 step 4).** All four `import.meta.url`-relative loads break under bundling: store-root + recipes-root → silent `{}` green-lie; the two schema paths + the validator's **top-level** `readFileSync` → hard ENOENT crash on import. §3 step 4 must fix ALL four. **Falsifier:** the t6 react-next planted-violation run (in an isolated consumer) must show the synthesized rule actually present AND applied (a planted violation failing) — not an empty no-op, not an import crash.
3. **ts-morph accidentally inlined.** Keep it strictly behind the cwd-anchored `requireFromCwd.resolve` / lazy `await import`; `--external:ts-morph`. **Falsifier:** the bundle must load + run the idempotent path with ts-morph absent (no eager resolution at module top level).
4. **Bundle staleness / non-determinism.** Pin esbuild; the `--check` drift-gate catches drift. **Falsifier:** `--check` red on a clean rebuild = non-deterministic output → pin/normalize (and ensure no timestamp in any provenance header, §3 step 6).
5. **Undeclared `semver` (byte-determinism risk).** `semver` is transitive-only (no package.json declares it); `--packages=bundle` would inline whatever version hoisting surfaces, so a transitive bump silently changes the bundle and the drift-gate. **Fix:** declare `semver` as a direct `packages/core` dep (§3 step 1). **Falsifier:** `--check` flaps across `npm install` runs → undeclared transitive drift.
6. **Type-only import mis-emit.** esbuild should elide `import type {…}`; a stray `verbatimModuleSyntax`/tsconfig could turn one into a runtime `require` → same `Dynamic require` symptom. **Falsifier:** grep the built bundle for unexpected `require("./types")`-style calls.

## 8. AI-laziness traps (per `.claude/rules/ai-laziness-traps.md` §3)

Active traps: **T2** (designing ≠ running — actually build the bundle and RUN it zero-dep; no "would bundle"), **T3** (every finding = command + output or file:line), **T5** (implementation only — don't bundle unrelated fixes into this PR), **T11/T16** (prior-art done — esbuild ADOPT; still verify the reused `build-shipped-eslint-rules.sh --check` problem-class matches a *bundled* artifact, NOT just tsc-compiled — they differ on external-dep inlining), **T14** (clean run + low coverage ≠ "works" — prove ajv actually validates and the synthesized rule is APPLIED, per §6 #1 gate + §7.2), **T15** (self-application: `make self-audit` green after), **T19** (own cold-QA before handoff — CI green ≠ design review).

Domain-specific trap — **T-755-A: "green lie via empty synth"** — the synthesizer emitting `{}` (any broken file-anchor: store-root OR recipes-root, §7.2) produces a SUCCESSFUL-looking idempotent no-op while wiring nothing; and a broken schema-anchor produces a hard ENOENT that only fires if the test actually reaches module load. Counter: never accept a bare "synth-wire ✓ idempotent" line as proof; the t6 acceptance MUST show the synthesized rule present in the resolved config AND a planted violation failing — presence + application, not just a clean exit. The fix MUST cover all four `import.meta.url` anchors (§2), not just the one named "store".

## 9. aif autonomous dispatch — park-don't-guess contract (SKILL §4c, mandatory under autonomous bridge dispatch)

**aif agent — fork discipline (non-negotiable):** On ANY genuine fork or ambiguity (two defensible implementations, an undecided design choice, a missing spec detail that changes behaviour) — **do NOT pick.** Park it as a question (set the task to `manualReviewRequired` / `blocked_external` with the fork stated as «Option A → consequence X / Option B → consequence Y») and **stop that task.** Proceed only on the unambiguous parts. Guessing a fork to "keep moving" is the failure this loop exists to prevent.

**Pre-identified fork — park it, do not decide:** §3 step 4's mechanism for fixing the four file-anchors has two defensible shapes — «(a) explicit root-override threaded to all four anchors (CLI flag / env), un-bundled `import.meta.url` default kept» vs «(b) inline the static recipes+schemas into the bundle via esbuild's `json` loader, removing the `fs` reads». (a) is one uniform parameter but touches several module init sites; (b) is cleaner for schemas but heavier for the recipe store and changes how data ships. Note: fork (a) does NOT break principle 28 — its oracle calls `loadEntries` with 3 positional args, so an optional trailing root param is back-compatible (verified). **Park the (a)/(b) choice** with both consequences stated rather than silently picking. Everything else in §3 is unambiguous — implement it (covering ALL FOUR anchors regardless of which mechanism).

**Conservative config (set on bridge env before dispatch):** `AGENT_MAX_REVIEW_ITERATIONS=1` (not converged in 1 pass → hand to human, don't keep guessing), `AGENT_AUTO_REVIEW_STRATEGY=closure_first`, `AGENT_SKIP_REVIEW=false`.

**Egress (mandatory after `status=done`):** aif does NOT push or open PRs by design — run `npx tsx packages/runtime-bridge/src/cli/harvest.ts <taskId> --base staging` to push the branch from the container + open the PR.

## Related

- Issue: #755. Umbrella: #728 (`generator-install-wiring`). Interim fix (variant 2): PR #746.
- SSOT: #120 (install auto-wires by reading the repo), #172 (generated-bundle integrity, ADAPT), #58 (remark, ADOPT — analog). **New esbuild SSOT entry required (§4).**
- Rules: `build-first-reuse-default.md`, `no-paid-llm-in-ci.md`, `ci-tool-pinning.md`, `consumer-install-completeness` S3; principles 17/21/25/26/27/28.

```bash host-verify
# Retro-marked 2026-08-21: step 6, the drift gate itself (build-synth-bundle.sh --check: rebuild to temp, diff vs the committed bundle)
bash scripts/build-synth-bundle.sh --check
```
