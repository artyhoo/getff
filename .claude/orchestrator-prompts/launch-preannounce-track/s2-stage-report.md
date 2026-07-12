# S2 — Consumer-matrix acceptance gate — stage report

> **Umbrella:** launch-preannounce-track · **Stage:** S2 (the core stage) · **Base:** staging
> **Delivered by:** night-mode autonomous run, 2026-07-12.

## §0 Premise re-verification (S.0 rule)

Re-verified against `origin/staging` `030be4791` (S1 #979, S3 #992, S4 #977, S5 #978, S6 #970 all merged):

- No consumer-matrix CI job existed (`grep -rn "consumer-matrix" .github/workflows` → empty before this stage). CONFIRMED still-true.
- The shipped `install.sh ts-server --full` into a pnpm workspace monorepo places PER-WORKSPACE eslint configs and NO root config (verified live — `tests/consumer-matrix` dev loop). CONFIRMED.
- The S1 calibration report §4 cell-recommendation was consumed as the fixture-shaping spec.

## §1 What landed

A single fail-closed **start cell** mechanizing the umbrella §1 acceptance, plus its wiring:

- [`tests/consumer-matrix/pnpm-monorepo-cell.sh`](../../../tests/consumer-matrix/pnpm-monorepo-cell.sh) — the start cell (pnpm workspace monorepo · Node 22). Runs the REAL `install.sh ts-server --full` into a fresh mktemp fixture that installs its OWN deps (T-LPT-A: no framework-substrate symlink; own `pnpm-lock.yaml`).
- CI job `consumer-matrix-start-cell` in [`.github/workflows/audit-self.yml`](../../../.github/workflows/audit-self.yml), added to `ci-success` `needs:` → **merge-blocking** (fail-closed).
- `make consumer-matrix` target in [`Makefile`](../../../Makefile) — local/nightly run (macOS OS-axis; ubuntu on PR).

## §2 Asserts — RED→GREEN evidence

All asserts run through the REAL shipped channels (never the ESLint Linter API — T-LPT-A). Local full run: `cell rc=0`, all hard asserts green, XFAIL #973 reproduces (`scratchpad/cell-final.log`).

| Assert | Channel | GREEN evidence | RED arm observed |
|---|---|---|---|
| (a) banner honesty | `install.sh` self-verify verdict line | `✓ self-verify: 3/3 checks passed` grep'd; rc=0 asserted | earlier fixture shapes surfaced rc=0-over-incomplete-install (S1 D5) → assert keys on the verdict LINE, not rc |
| (b) toolchain + config load | `command -v` + `import()` of placed configs | `2 per-workspace config(s) load cleanly`; eslint/tsx/tsc executable | D5/#976: a placed config can be non-loadable while `command -v eslint` passes → the load probe is the catch |
| (c) green-on-clean | the deterministic per-workspace gates | typecheck·format:check·arch:check·check:globs·check:enforced·check:arch-boundaries·check:lintstaged·check:fences-fire·check:shields-up all ✓ | dev loop hit REAL RED: check:globs inert-R2-in-lib, typecheck TS1287 (no `type:module`), format:check (unnormalized) — each fixed by shaping the fixture to a valid consumer, not by weakening the assert |
| (d) planted violation blocked | scoped eslint + lint-staged pre-commit + check:fences-fire | (d-1) scoped `eslint` rc=1 with `no-unsafe-zod-parse`; (d-2) pre-commit shield blocked via R2; (d-3) check:fences-fire confirms R2 fires | the clean tree passes all three; the planted `OrderSchema.parse(req.body)` flips each to RED |
| (e) false-positive arm | scoped workspace eslint | 0 `rules-as-tests` errors on static-literal `ConfigSchema.parse` | a cries-wolf rule would fail here |
| (i) push channel | real `git push` to a bare remote | clean-tree push allowed (encodes the S3 thin contract) | see §3 — an un-pinned workflow action RED-flags the push where zizmor is present |
| XFAIL #973 | root `eslint .` | reproduces: rc=2 (per-workspace monorepo has no root flat-config) | flips loud (hard fail) if the defect is ever fixed |

## §3 Push-channel contract encode + a surfaced S3 gap (NOT a drive-by fix)

Assert (i) encodes the S3 thin push-channel contract by making the fixture workflow **zizmor-CLEAN** (SHA-pinned `actions/checkout`, `persist-credentials: false`, least-privilege `permissions`, no un-pinned bare tool install) — exactly what S1 §4 required ("SHA-pin the fixture workflow or (i) fails on F-push").

**Surfaced finding (observation, per CLAUDE.md PR strategy — not fixed here):** the S3 owner-split `SECTIONS` registry ([`packages/core/hooks/pre-push.ts`](../../../packages/core/hooks/pre-push.ts) ~line 1143) is **data-only — `main()` does not compose from it**. `main()` calls the zizmor section directly ([pre-push.ts:677](../../../packages/core/hooks/pre-push.ts)) gated only on `workflows.length > 0` + the tool-absence degrade, NOT on `owner`. Consequence: F-push is resolved ONLY when zizmor is ABSENT (CI ubuntu → `warn-skip` degrade → push allowed); a consumer WITH zizmor installed + pre-existing un-pinned workflows is STILL blocked on first push. `grep -n "SECTIONS" pre-push.ts` shows the registry is defined but never consumed. This is an **S3 follow-up** (wire the registry into `main()` with an owner filter, or delete the dead registry), filed as #993. The start cell therefore asserts the clean-consumer push path and does not encode the (still-unfixed) un-pinned-workflow contract.

## §4 Deferred cells (enumerated, NOT silently dropped)

Per the "start with a SINGLE cell, grow incrementally" kickoff directive, these S1-calibrated cells are follow-ups:

- **(f)** `--refresh` from an N-1 install delivers a fix and the planted violation starts being blocked.
- **(g)** `format:check` green under a divergent consumer `.prettierrc` (printWidth 100 + organize-imports; historical #531). The start cell proves `format:check` green under the shipped config; the divergent-config arm is separate.
- **(h)** stryker: config placed on this topology + `stryker run` with a score threshold in one cell; add the mutation job to `ci-success needs:`. References #931 (single-app stryker.config on monorepos) — do NOT re-file.
- **D3/#974** trustPolicy cell: `pnpm-workspace.yaml` carrying `trustPolicy: no-downgrade`, asserting the dep-install fails RED-not-rc0-green.
- **D4/#975** consumer `prepare: simple-git-hooks` clobbers the framework hooks: NOT mechanized because reproducing it needs `pnpm install` to run the injected `prepare` lifecycle non-deterministically — a flaky assert would be worse than none. Tracked by S1's #975.
- **OS axis:** ubuntu on PR (merge-blocking); macOS via `make consumer-matrix` nightly/local. BSD-awk/husky-v9/symlink-tmp classes are NOT PR-covered (kickoff S2 degrade). Note: a dev machine with zizmor globally installed exercises the §3 path locally; CI ubuntu does not.

## §5 Deferred wiring (surfaced, not done here — deadlock risk without green-verification)

The kickoff S2 also asks to wire the pre-existing `framework-fresh-install-validate-multistack` (audit-self.yml) and `shipped-prettier` jobs into `ci-success needs:` "after verifying each is GREEN on current staging first". Wiring a red job into `needs:` deadlocks all merges; confirming their green status per-run was not reliably scriptable in this autonomous run, so this is surfaced as a fast follow-up rather than risked. The new `consumer-matrix-start-cell` job IS wired into `needs:` (fail-closed, as the core stage requires).

## §6 AI-traps honored

- **T-LPT-A** (validate through real channels): the fixture installs its own deps; every rule-firing assert goes through `npx eslint` / real git hooks / shipped check scripts — never the Linter API.
- **T-LPT-C** (green-by-construction): the fixture was shaped AGAINST the S1 findings; the dev loop hit real RED on check:globs / typecheck / format:check / eslint-project-service / push before each was resolved by making the fixture a VALID consumer (not by weakening asserts). Evidence: `scratchpad/cell-full*.log` progression.
- **T15**: every assert has an observed RED arm (table §2).
- **T3**: claims carry command output / file:line.
