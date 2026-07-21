# #931 stryker-pnpm-monorepo — night-mode decisions & findings log

Companion to [the design spec](2026-07-21-issue-931-stryker-pnpm-monorepo-design.md). Night-mode delta item 1: **technical** forks resolved autonomously with recorded rationale (below); **genuine owner** forks logged, NOT decided (§Owner-forks).

## Technical decisions (resolved autonomously)

### TD-0 — Fix form for defect #1 (plugin resolution): RESOLVED — no fix needed (defect is a stale-install artifact)
Spike (`spike-pnpm-stryker`, 2026-07-21) on a real pnpm isolated store (pnpm 10.19.0 / Stryker 9.6.1 / Node 24.3.0), plugins as root devDeps:

| Arm | plugins form | result | decisive line |
|---|---|---|---|
| A | bare names (= current template / #549) | **PASS** | `Creating 1 checker process(es) and 1 test runner process(es).` → `Initial test run succeeded. Ran 6 tests` (rc 0) |
| B | entry-file `dist/src/index.js` (= #931 fix) | PASS | same (rc 0) — works but brittle |
| C | bare + `.npmrc public-hoist-pattern` | PASS | same (rc 0) — adds nothing |
| D | bare + `packageManager:npm` | PASS | same (rc 0) — packageManager irrelevant to resolution |
| **B2** | package-**directory** path (no `/dist/src/index.js`) | **FAIL** | `Directory import … is not supported` → `no Checker plugins were loaded` + `Unknown config option "vitest"` (rc 1) |

**Verdict: bare names (Arm A, current template) WORK on real pnpm isolated store.** The `C > A > B` rule presupposed A fails — empirically A passes and is cheapest → **no template/installer change for #1**. Entry-file paths (B) are unnecessary and worse (hardcode internal dist path). The `no Checker plugins` cascade is produced ONLY by the directory-path form (B2) or by NO `plugins` array (auto-discovery).

**Empirical grounding of #931's failure (T3, not inferred):** timeliner installed `63e2b38` on **2026-06-11**; #549/PR#598 (adds bare-name `plugins`) merged **2026-06-17** (6 days later). timeliner's root `stryker.config.json` has **no `plugins` array** (verified via `gh api …/contents/stryker.config.json`); its `@stryker-mutator/*` are root devDeps. → pre-#549 stale install → auto-discovery glob fails under pnpm → the reported cascade. Already fixed in-template by #549. **`packageManager` does NOT affect resolution** (Stryker config docs: "package manager Stryker can use to install missing dependencies") — earlier confound hypothesis rejected; the directory-vs-entry-file distinction is the real resolution axis.

**Public record corrected:** the prior triage comment (`#issuecomment-5037360511`) claimed "#549 refuted / entry-file paths required / f16 false-green hides a real break" — empirically wrong. Correction posted `#issuecomment-5037688652`.

**Honest caveat (untested boundary):** plugins declared ONLY in a nested workspace package (not root devDeps) could still fail bare-name resolution — spike used root devDeps per timeliner's actual layout. Not timeliner's cause; noted for the per-package emit design.

### TD-1 — Build-vs-reuse verdict for the per-package emit: BUILD (no native mode exists to ADOPT)
Per build-first-reuse-default §3 mechanism (2026-07-21):
- **DeepWiki `stryker-mutator/stryker-js`** (source-grounded): "StrykerJS does not natively support a single `stryker run` invocation to mutation-test multiple workspace packages… `vitest.dir` and `tsconfigFile` are single [per run]… to mutation-test multiple packages in a monorepo, you would typically use an external loop or script to invoke `stryker run` for each package, each with its own Stryker configuration file." → **no native monorepo mode to ADOPT.**
- **WebSearch ≥3 phrasings**: surfaced only the Stryker VSCode-extension monorepo *usage* (not a config generator) + generic pnpm plugin guidance — **no installer/tool that emits per-package Stryker wiring for a foreign consumer's monorepo.** Negative-existence holds.
- **Verdict: BUILD** the per-package emit + wrapper (the only working shape; proven live on timeliner PR #15). **Extends SSOT #39** (StrykerJS ADOPT — the runner is adopted; the installer-side per-package emit orchestration is BUILT). **T16:** upstream class = manual per-package config authoring; ours = installer auto-generates on `pnpm-workspace.yaml` detection → build the orchestration, adopt the runner.
- **Trigger to revisit:** Stryker ships a native monorepo/workspace mode (single-invocation multi-package) → flip emit to ADOPT + retire the wrapper. **SSOT entry** (new ID = current max+1; grep `prior-art-evaluations.md` at Task 3) records this; the PR `Prior-art:` trailer cites it.

## Structural findings (confirmed, shape PR-2)

### SF-1 — the multi-stack monorepo branch ships NO stryker.config.json at all — CONFIRMED
`setup.d/40-configs.sh`: the `if [ -n "$_ws_lines" ]` multi-stack branch (lines 197-281) places per-workspace eslint configs + a root `.dependency-cruiser.cjs`, but **never** copies `stryker.config.json` or calls `patch_stryker_package_manager`. Those happen ONLY in the flat/single-root `else` branch (lines 285-342: sites 291/303/316/337 + patch at 292/304/317/338). Verified: `awk 'NR>=197&&NR<=282 && /stryker/'` → empty; `_resolve_workspace_stacks` (lib.sh) returns non-empty for any pnpm/`workspaces` repo → the monorepo path is taken → no stryker.

**Implications:**
1. A pnpm monorepo consumer installing **today** gets no `stryker.config.json` → `test:mutation` fails "config not found", NOT the plugin error the issue reports.
2. Therefore the issue's consumer (timeliner, `63e2b38`) got its stryker config from the **flat branch** (pre-multi-stack-branch installer, when stryker was always copied) — strengthens the stale-install reading of defects #2/#3a in spec §1. (Hypothesis; confirm via `git log` of the multi-stack branch landing vs the install date if it matters — not load-bearing for the fix.)
3. **PR-2 is not "fix one existing config" — it is "make the monorepo branch emit per-package stryker wiring where today it emits none."** Cleaner: no collision with an existing single-config copy in that branch. The emit hooks into the existing per-workspace `while` loop (40-configs.sh:202-256), mirroring the per-workspace eslint placement.
4. PR-1's plugin fix still applies to the **flat-branch** stryker copy (the only stryker the installer shows today) + whatever PR-2 emits for monorepos.

**Corroboration (2026-07-21):** `grep copy_safe.*stryker setup.d/` → only the flat-branch sites; `setup.d/70-deps.sh:60` still wires `"test:mutation": "stryker run"` for ALL consumers. So a pnpm-monorepo consumer gets the `test:mutation` script but no config → `stryker run` fails "config not found" before any plugin question. This is the real, current, load-bearing bug — worse than a mis-shaped config. `lib.sh:299` `stryker.config.json` is only a `.prettierignore` candidate-basename list (not a copy site).

## Revised scope (post-spike) — the plan changed materially; SURFACE in morning report

The spike **removed the headline defect** (#1 plugin resolution is a non-bug on current main). The approved plan's "PR-1 = fatal plugin fix" is moot. Revised deliverables:

- **INC-1 — real-pnpm regression test (small, high-value):** stand up a real pnpm isolated store; assert bare-name plugins LOAD (locks the spike finding + closes the `f16` flat-npm-only coverage gap), with a paired-negative on the directory-path form (B2 = the RED). This is the "attention-is-not-a-mechanism / test-reproduces-the-real-layout" fix.
- **INC-2 — monorepo stryker emit + per-package wiring (CAPABILITY; the real #931 fix):** on `pnpm-workspace.yaml` detection, the multi-stack branch emits per-package `stryker/<pkg>.json` (bare-name plugins + `vitest.dir` + `vitest.configFile` + per-package `tsconfigFile`) + a `run-mutation.sh` loop, hooking the existing per-workspace `while` loop (`40-configs.sh:202-256`). Prior-art gate + `Prior-art:` trailer required.
- **INC-3 — root-tsconfig-empty guard (#739):** don't point `tsconfigFile` at an empty root tsconfig. May fold into INC-2's per-package tsconfig (each package's own tsconfig is non-empty), making a separate guard unnecessary — decide during INC-2.
- **NO template change for #1** (bare names already correct).

## Owner-forks (LOGGED, not decided — surfaced in morning report)
- **OF-1 (surfaced, proceeding with default):** the spike flipped the diagnosis — #931's headline "plugin bug" is a stale-install non-bug; the real gap is the monorepo-emit capability (INC-2). Autonomous default taken: correct the public record + build INC-1/INC-2/INC-3 (all squarely "installer broken on pnpm monorepo" = the issue's actual title). This is a technical finding, not a taste fork, so night-mode says resolve autonomously — but the scope shift from "small bug-fix" to "new installer capability" is material enough that the operator should confirm the appetite in the morning. If the operator prefers minimal (correct record + INC-1 test + tell consumer), INC-2 can be dropped — logged here so the choice is visible, not silently made.

## Owner-forks (LOGGED, not decided — surfaced in morning report)
- (none yet)

## BLOCKED increments
- (none yet)

## Degradation / deviations taken
- (none yet)
