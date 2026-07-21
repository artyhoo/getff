# Plan — #931 stryker on pnpm monorepo: emit per-package wiring (multi-stack branch ships none)

Executes [the design spec](../specs/2026-07-21-issue-931-stryker-pnpm-monorepo-design.md) + [decisions log](../specs/2026-07-21-issue-931-stryker-pnpm-monorepo.decisions.md). Base: `claude/issue-931-review-75dec3` @ `70e7000f4` (= origin/staging `59ac50515` + 4 spec/decisions commits).

## Context (where this fits)

`setup.d/40-configs.sh` has two branches: a **flat/single-root** branch (lines 285-342) that copies `stryker.config.json` + `patch_stryker_package_manager`, and a **multi-stack monorepo** branch (`if [ -n "$_ws_lines" ]`, lines 197-281) that places per-workspace ESLint configs but **ships no Stryker config at all**. Meanwhile `setup.d/70-deps.sh:60` wires `"test:mutation": "stryker run"` for every consumer. **Net bug (SF-1, confirmed): a pnpm-monorepo consumer gets the `test:mutation` script but no config → mutation is dead.** This plan makes the multi-stack branch emit working **per-package** Stryker wiring (the shape proven live on timeliner PR #15), targeting each workspace's **existing** vitest config + tsconfig.

**Spike-established facts (do not re-litigate):** bare-name plugins load fine on a real pnpm isolated store (Stryker 9.6.1 / pnpm 10.19.0 / Node 24.3.0) — entry-file paths are unnecessary + brittle and are FORBIDDEN here. `packageManager` does not affect plugin resolution. Defect #1 (plugin loading) is a stale-install artifact, NOT fixed by this plan (the current template already handles it via bare names).

## Global Constraints (binding — reviewers use these verbatim as the attention lens)

1. **Plugins MUST be bare names** exactly: `"@stryker-mutator/vitest-runner"`, `"@stryker-mutator/typescript-checker"`. Entry-file paths (`.../dist/src/index.js`) and package-directory paths are FORBIDDEN (spike: directory path → `ERR_UNSUPPORTED_DIR_IMPORT`; bare names load).
2. **Stryker invocation MUST be positional**: `stryker run <configFile>`. `-c` is `--concurrency` in Stryker 9 (spike-verified), NOT a config flag. Any `stryker run -c <cfg>` is a bug.
3. **Per-package config paths are project-root-relative**: for workspace dir `<ws>` (e.g. `packages/validation`), emit `vitest.dir: "<ws>"`, `vitest.configFile: "<ws>/<detected vitest config>"`, `tsconfigFile: "<ws>/tsconfig.json"`, `mutate: ["<ws>/src/**/*.{ts,tsx}", <standard exclusions>]`. Stryker runs from project root; paths resolve from there.
4. **Target EXISTING per-package structure — never create it.** Emit a Stryker config for a workspace ONLY if it has BOTH a vitest config (try `vitest.config.ts`, `vitest.config.mts`, `vitest.config.js` in that order) AND a `tsconfig.json`. A workspace missing either → **skip with a re-checkable stderr marker** (mirror the `unknown` stack marker at `40-configs.sh:242`), never `exit 1`. Do NOT place vitest configs or tsconfigs — that is the consumer's structure.
5. **Flat/single-root behavior UNCHANGED.** Only the `_ws_lines`-non-empty (multi-stack) path changes. The flat branch (285-342) and `patch_stryker_package_manager` are untouched.
6. **Per-package config file location:** `stryker/<ws-dir-with-slashes-as-dashes>.json` at project root (e.g. `packages/validation` → `stryker/packages-validation.json`). Central (wrapper globs `stryker/*.json`), collision-free across containers.
7. **Dual-pair discipline:** if any hook/artefact shipped as both `.claude/…` and `packages/core/…` twins is touched, edit both byte-identically (`git diff` the pair). (Likely N/A here — installer scripts are single-copy — but verify.)
8. **Install-sh baselines regenerate** via `SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh`; verify with `SNAPSHOT_MODE=compare`.
9. **Capability commit** → the PR carries a `Prior-art:` trailer citing a new `prior-art-evaluations.md` SSOT entry (no upstream installer emits per-package Stryker wiring for a foreign monorepo — BUILD verdict).
10. **English** for all artefacts. **No unpinned tool installs** added to any `*.sh` (ci-tool-pinning).

## Tasks

### Task 1 — Emit per-package Stryker configs in the multi-stack branch (TDD)
- **Test first (RED):** add `tests/install-sh/f17-stryker-monorepo-emit.test.sh` (name per existing f13/f16 convention). *(Shipped as `f20-…` — f17-19 were taken by the time of implementation; reconciled in the f20 header + `audit-self.yml`.)* Build a pnpm-monorepo fixture: `pnpm-workspace.yaml` + two workspace pkgs `packages/alpha` (has `vitest.config.ts` + `tsconfig.json` + `src/`) and `packages/beta` (missing tsconfig → skip case). Run the real install pipeline (mirror `f13-stryker-pm.test.sh` wiring). Assert: `stryker/packages-alpha.json` emitted with bare-name plugins, `vitest.dir: "packages/alpha"`, `vitest.configFile: "packages/alpha/vitest.config.ts"`, `tsconfigFile: "packages/alpha/tsconfig.json"`, `mutate` scoped to `packages/alpha/src/**`; and `packages/beta` SKIPPED (no config emitted, marker printed). Confirm RED before implementing.
- **Implement (GREEN):** in `40-configs.sh` multi-stack `while` loop (202-256), after the eslint placement, add per-workspace Stryker emit per Global Constraints 3/4/6. Introduce a template `templates/ts-server/stryker.package.json.tmpl` with placeholders (`__WS_DIR__`, `__VITEST_CONFIG__`) substituted per package (Node one-liner or sed, consistent with `patch_stryker_package_manager`'s Node string-substitution). Keep the emitted JSON prettier-clean (short arrays one line) so the consumer's `prettier --check` stays green.
- **Acceptance:** f17 GREEN; flat-path tests (f13) still GREEN; `mkdir_safe stryker/` created once.

### Task 2 — Emit the wrapper + wire `test:mutation` for monorepos (TDD)
- **Test first (RED):** extend f17 (or a sibling) to assert, on the same monorepo fixture: `scripts/run-mutation.sh` emitted, executable, loops `stryker run "stryker/$cfg"` (POSITIONAL — Global Constraint 2) over `stryker/*.json`, aggregates a non-zero exit if any package fails, and forwards `--incremental`; and that `package.json` `test:mutation` → `bash scripts/run-mutation.sh`, `test:mutation:incremental` → `bash scripts/run-mutation.sh --incremental` for the monorepo case while the FLAT case keeps `stryker run` (assert both).
- **Implement (GREEN):** emit `scripts/run-mutation.sh` from a template `templates/ts-server/run-mutation.sh.tmpl` in the multi-stack branch (after the loop, once). Make `70-deps.sh` (the `test:mutation` wiring, ~line 60) monorepo-aware: if `pnpm-workspace.yaml`/`workspaces` present → wrapper form; else current `stryker run`. Wrapper: `set -euo pipefail`, glob `stryker/*.json`, `rc=0; for c in stryker/*.json; do stryker run "$c" "$@" || rc=1; done; exit $rc`; skip gracefully if no configs (echo + exit 0). No unpinned installs.
- **Acceptance:** f17 GREEN for wrapper + wiring; flat wiring unchanged; `shellcheck` clean on the emitted wrapper template + edited `*.sh`.

### Task 3 — Baselines, SSOT prior-art entry, gate parity (mechanical)
- Regen install-sh baselines: `SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh`; verify `SNAPSHOT_MODE=compare` → all pass / 0 fail.
- Add a `docs/meta-factory/prior-art-evaluations.md` SSOT entry: capability = "per-package Stryker config emit for pnpm-monorepo consumers", Verdict BUILD (no upstream installer emits this for a foreign monorepo; DeepWiki/WebSearch negative-existence per §3 mechanism), Rationale, Trigger-to-revisit. Note the new entry ID for the PR `Prior-art:` trailer.
- Run full local gate parity (per `feedback_harvest_run_full_ci_gate_set_locally`): `npx vitest run` affected + `tests/install-sh` suite + `shellcheck --exclude=SC2034,SC2016,SC2317 setup.d/*.sh install.sh` + dual-pair byte-diff (if any twin touched). Record results.
- **Acceptance:** all gates green; SSOT entry present; baselines regenerated and committed.

## Out of scope (this PR)
- Root-tsconfig #739 (per-package tsconfigs are non-empty → the empty-root-tsconfig problem doesn't arise in the emitted per-package configs; a separate flat-branch guard is a follow-up, not this PR).
- Any template change for defect #1 (bare names already correct — spike TD-0).
- Non-pnpm monorepo managers beyond current detection.

## Verification (whole-branch, before PR)
- A real-pnpm end-to-end mutation run of an emitted config was already proven by the spike (decisions log TD-0); the CI-level tests here are structural (emitted-file assertions), which is the install-sh test grain (f13/f5). Do NOT add a network `pnpm install` to CI.
- Own adversarial cold-review (T19) of the whole diff before handoff.

## Amendments (post dual-review, 2026-07-21)

Dual review (spec=opus, quality=sonnet) surfaced a real defect in this plan's own condition design; both verdicts "Needs fixes". Corrections (authoritative over the Task text above):

- **A1 (supersedes Task 2 wiring condition + GC5):** the `test:mutation` wiring in `70-deps.sh` MUST gate on **artifact presence** `[ -f "$PROJECT_ROOT/scripts/run-mutation.sh" ]`, NOT on `pnpm-workspace.yaml`/`"workspaces"`. Reason: the emit gate (`_ws_lines` = `_workspace_pkg_dirs` conventional-dir enumeration, `lib.sh:451-463`) is a DIFFERENT signal from the manifest key. The two diverge both ways (SF-1 unfixed on `packages/*`-no-manifest; working→broken regression on `"workspaces":["client","server"]`). 40-configs runs before 70-deps → the wrapper's presence is the authoritative "configs emitted" signal → wire⟺emit by construction.
- **A2 (supersedes Task 1 emit placement):** the per-workspace Stryker emit MUST run **before the stack `case`**, unconditionally per workspace — NOT after the `unknown) … continue`, which silently skips emit for stack-`unknown` workspaces that nonetheless have vitest+tsconfig (GC4 conditions emit on vitest+tsconfig ONLY).
- **A3 (new, C1):** the emit write MUST honour copy_safe's consumer-protection semantics — skip an existing `stryker/<slug>.json` unless `--force` (mirror `rewrite_arch_sot_header`'s guard, `lib.sh:151-156`), never a raw unconditional `fs.writeFileSync`.
- **A4 (M2):** `packageManager` in the per-package config mirrors the flat branch — substitute `detect_pm` at emit, not a hardcoded `"npm"`.

Full consolidated fix list + file:line + tests: `scratchpad/sdd/task-A-fixes.md` (orchestrator-adjudicated, T3-verified).
