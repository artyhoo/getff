# Design — #931: installer ships single-app `stryker.config.json`, dead on pnpm monorepo consumers

> **Status:** approved (operator, 2026-07-21). Execution = night-mode / SDD, spike-first, two-stage.
> **Issue:** [artyhoo/getff#931](https://github.com/artyhoo/getff/issues/931) (OPEN). Triage comment: `#issuecomment-5037360511`.
> **Base:** `origin/staging` @ `59ac50515`. Branch: `claude/issue-931-review-75dec3`.

## 1. Problem

The shipped `templates/ts-server/stryker.config.json` (+ installer patching in `setup.d/`) does not produce a working Stryker setup on a **pnpm-workspace monorepo** consumer (evidence: timeliner install `63e2b38`; proven live-fix in timeliner PR #15 / commit `06808d4`). Three defect classes were reported; two are already mitigated on current `staging`, two remain genuinely open:

| Defect | Current `staging` state | Verdict |
|---|---|---|
| **#1** plugins don't load under pnpm isolated layout (`no Checker plugins were loaded` → cascade `Unknown config option "vitest"`) | Template declares `plugins` as **bare names** (`templates/ts-server/stryker.config.json:4-7`), added by #549/PR#598 — the last commit to touch the template | **OPEN** — this issue refutes #549 (see §2) |
| **#2** `mutate` rooted at single-app `src/` (0 files → dry-run without modifying) | Template already carries `apps/*/src/**` + `packages/*/src/**` (`stryker.config.json:20-21`, from #486) | **mitigated** — the `src/**`/`lib/**` leftovers only emit a cosmetic empty-glob WARN; the reported "0 files" symptom is the pre-#486 install |
| **#3a** `packageManager: "npm"` on a pnpm repo | Installer **patches** → `pnpm` when `pnpm-lock.yaml`/`pnpm-workspace.yaml` present (`setup.d/lib.sh` `patch_stryker_package_manager` + `detect_pm`; test `tests/install-sh/f13-stryker-pm.test.sh`) | **mitigated** at install time |
| **#3b** root `tsconfigFile` empty (#739 / TS18003) · `vitest` without `dir` (→ `No tests were executed`) · no per-package wiring | Installer copies **one** `stryker.config.json` for all stacks + patches only `packageManager` (`setup.d/40-configs.sh:291,303,316,337`); no `stryker.<pkg>.json`, no wrapper loop | **OPEN** |

## 2. Key finding — the fix form cannot be read off the docs

Two authoritative Stryker sources **contradict** on defect #1, and the issue's own proven fix is **confounded** (it changed `packageManager`, plugin paths, and `mutate`/`vitest` simultaneously):

- Stryker **troubleshooting** (WebFetch, 2026-07-21): under pnpm, declaring `plugins` as **bare package names** is the sanctioned fix — exactly what the template already ships.
- Stryker **configuration** (WebFetch): `packageManager` = *"The package manager Stryker can use to install missing dependencies"* — it does **NOT** affect plugin resolution (so `packageManager: pnpm` alone cannot fix #1 — earlier confound hypothesis **rejected**). `plugins` are loaded via `import`, *"resolved relative to your project's node_modules"* and *"should be installed right next to stryker"* — which under pnpm's isolated layout they are **not** (core lives in `.pnpm/@stryker-mutator+core@…/`; sibling plugins are only in the root `node_modules`).
- Issue #931 (empirical): bare names still fail; a package-**directory** path fails with `ERR_UNSUPPORTED_DIR_IMPORT`; only **entry-file paths** (`./node_modules/@stryker-mutator/*/dist/src/index.js`) work.

**False-green root cause:** the tests that gate #549 (`tests/install-sh/f16-stryker-live-mutants.test.sh:26-31`, `f13-stryker-pm.test.sh`) run Stryker from the repo's **flat npm** `node_modules` (`packages/core/node_modules/.bin/stryker`), **never** from a real pnpm `.pnpm` isolated store. Bare-name resolution works in a flat layout → test green while the real pnpm case breaks. This is `attention-is-not-a-mechanism` / a test that does not reproduce the real failure mode.

**Therefore the fix form for #1 is an empirical question**, resolved by a spike (§3), not by reading the docs.

## 3. Phase 0 — SPIKE (mandatory first; resolves the PR-1 form autonomously)

Reproduce a **real pnpm-workspace isolated store** on the reported toolchain (pnpm 10.19.0 + Node 24.3.0, both present on this machine) and run a plugin-resolution matrix. This is a night-mode **technical fork** → resolved autonomously, rationale recorded in `<plan>.decisions.md`.

**Fixture:** a scratchpad pnpm workspace: root `pnpm-workspace.yaml` + `package.json` (devDeps `@stryker-mutator/core`, `@stryker-mutator/vitest-runner`, `@stryker-mutator/typescript-checker`, `vitest`, `typescript`), one `packages/foo/` with a mutatable `src/*.ts`, a passing vitest test, `vitest.config.ts`, `tsconfig.json`.

**Matrix arms** (each: does Stryker load BOTH plugins and reach a dry-run, vs `no Checker plugins were loaded` / `Unknown config option "vitest"`):

| Arm | `plugins` | extra | maps to |
|---|---|---|---|
| A | bare names (`@stryker-mutator/vitest-runner`, `…/typescript-checker`) | `packageManager: pnpm` | current template = the #549 fix |
| B | entry-file paths (`./node_modules/…/dist/src/index.js`) | — | the issue's proven fix (BUILD) |
| C | bare names | `.npmrc` `public-hoist-pattern[]=@stryker-mutator/*` + reinstall | reuse pnpm hoist (ADOPT candidate) |
| D (control) | bare names | `packageManager: npm` | confirm packageManager irrelevant to resolution |

**Decision rule (build-first-reuse-default):** prefer the cheapest arm that PASSES, in order **C (ADOPT, reuse pnpm) → A (no change needed) → B (BUILD, brittle: couples to internal `dist/src/index.js`)**. Record the decisive log line per arm as evidence (T3 — no PASS/FAIL without the line).

**Spike also reproduces the f16 false-green** (run the current shipped bare-name config against the `.pnpm` store; expect FAIL) so PR-1's new test has a non-vacuous paired-negative (RED-before-GREEN, T15).

## 4. Phase 1 — PR-1 (fatal fix; bug-fix class, not a capability commit)

Conditional on the spike verdict:

- **If Arm C passes** → ship an `.npmrc` `public-hoist-pattern[]=@stryker-mutator/*` seam for pnpm consumers (installer emits/append-merges it on `pnpm-workspace.yaml` detection); template untouched. **Verdict: ADOPT** (reuse pnpm's own hoisting).
- **If only Arm B passes** → installer emits **pnpm-conditional entry-file paths** into the copied `stryker.config.json` (a new patch alongside `patch_stryker_package_manager`); npm consumers keep bare names. **Verdict: BUILD** (documented rationale: docs-recommended form empirically fails on pnpm isolated layout; couples to `dist/src/index.js` — add a version-guard note).
- **If Arm A passes** (bare names already work on real pnpm) → #931's #1 is a **stale-install artifact** (`63e2b38` predates #549/F13); no template/installer change for #1 — only the real-pnpm test below + a consumer "re-run install.sh" note.

**Plus, regardless of arm:**
1. **Real-pnpm-isolated-store test** replacing/augmenting the f16 false-green — asserts the shipped config loads checkers under a `.pnpm` store (the paired-negative from §3). This is the load-bearing anti-regression.
2. **Root-tsconfig-empty guard (#739):** stop pointing `tsconfigFile` at an empty root tsconfig (either detect-and-skip, or a clear diagnostic).

Dual-pair discipline: if the fix touches a hook/config shipped in both `.claude/` and `packages/core/` copies, edit both byte-identically. Install-sh baselines regenerate via `SNAPSHOT_MODE=capture`.

## 5. Phase 2 — PR-2 (per-package harness; NEW CAPABILITY → prior-art gate)

On `pnpm-workspace.yaml` detection, the installer emits per-package Stryker wiring so the whole monorepo's mutation-DoD is reachable by the standard button — matching the proven timeliner PR #15 shape: per-package `stryker/<pkg>.json` (`vitest.configFile` + `vitest.dir` + per-package `tsconfigFile`) + a `scripts/run-mutation.sh` loop wired into `test:mutation[:incremental]`.

**This is a capability commit** (new files ≥ thresholds / new installer capability) → **build-vs-reuse SSOT consult + `Prior-art:` trailer required** (CLAUDE.md gate; principle 11 F1 at pre-push). The installer already has the per-workspace walk (`setup.d/40-configs.sh:202`, `_workspace_pkg_dirs`) — reuse that emit seam. Guard against packages lacking a vitest config / tsconfig (skip with a re-checkable marker, per the existing "unknown stack" pattern at `40-configs.sh:242`).

## 6. Test / verification strategy

- New install-sh test that stands up a **real pnpm isolated store** (not flat npm) and asserts plugin loading — the gap that let #549 ship false-green.
- Paired-negative: shipped-config-on-pnpm RED observed before the fixed-config GREEN.
- Full local gate parity before push (per `feedback_harvest_run_full_ci_gate_set_locally`): `SNAPSHOT_MODE=compare` install-sh suite, `npx vitest run` affected, dual-pair byte-diff, `pnpm`/`npm` shellcheck on touched `setup.d/*.sh`.
- Own adversarial cold-review (T19) of each PR diff before handoff.

## 7. Build-vs-reuse verdicts (SSOT consult pending in-loop)

- **Explicit-`plugins` declaration for pnpm** — **ADOPT** Stryker's documented pnpm guidance (troubleshooting page). Already shipped (#549); the open question is only the *form* (§3).
- **Plugin-resolution mechanism** — **ADOPT (Arm C) or BUILD (Arm B)**, decided by spike.
- **Per-package harness generator** — **BUILD** (no upstream installer emits per-package Stryker wiring for a foreign consumer's monorepo), with prior-art trailer + SSOT entry per CLAUDE.md.

## 8. Risks / falsifiers

- **Falsifier for the whole #1 fix:** spike Arm A passes → bare names work on real pnpm 10.19/Stryker 9.6.1 → #931 #1 is a stale-install artifact; scope shrinks to test + consumer re-install note.
- **Arm B brittleness:** entry-file paths couple to `dist/src/index.js`; a Stryker major could move it. Mitigation: prefer C; if B, add a guard/version note + the real-pnpm test catches breakage.
- **Scope creep:** PR-2 is a genuine capability; keep it in its own PR with its own prior-art gate (atomic-umbrella discipline, CLAUDE.md PR strategy).

## 9. Out of scope

- `.npmrc node-linker=hoisted` (consumer-wide flattening — too invasive to impose).
- Non-pnpm package managers beyond current behavior (npm consumers already work; yarn detected by `detect_pm` but unverified for mutation — not this issue).
- Rewriting the confounded mutate/vitest sections beyond what per-package wiring (PR-2) requires.
