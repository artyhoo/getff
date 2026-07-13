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

## §3 Push-channel contract encode — F-push proven resolved (an earlier "S3 gap" note, RETRACTED)

Assert (i) uses a fixture workflow with an **UN-PINNED** action (`actions/checkout@v6`) — deliberately the F-push trigger — and proves the consumer's first push is **allowed** anyway. The S3 owner-split works exactly as designed: `main()` composes only the sections this layout owns via `activeSections(isFrameworkRepo)` → [`composeSections(SECTIONS, …)`](../../../packages/core/hooks/pre-push.ts) (`wanted = isFrameworkRepo ? 'maintainer' : 'consumer'`; keeps `owner === 'both' || owner === wanted`). For a consumer (`isFrameworkRepo=false`, since the install does not ship the SSOT register `docs/meta-factory/prior-art-evaluations.md`), the zizmor section (`owner: 'maintainer'`) is **excluded** — so a pre-existing un-pinned workflow never DoS's the push.

> **RETRACTION (#993, closed not-reproducible):** an earlier draft of this section claimed the `SECTIONS` registry was "data-only — `main()` does not compose from it, F-push resolved only when zizmor is ABSENT". **That was wrong on both legs.** (1) Structural: `main()` DOES compose from the registry — the earlier `grep "SECTIONS"` missed the `activeSections()` wrapper it is consumed through. (2) Empirical: the "consumer push still blocked by zizmor" observation was a **stale install** during the S2 dev loop; it does not reproduce from current staging. Decisive repro (current-staging framework clone → fresh consumer install with the exact `@v6` workflow → real `git push`): `zizmor` never runs, `* [new branch] main -> main`, rc=0. Assert (i) now encodes this positive contract directly, replacing the retracted SHA-pin caveat (so S1 §4's "SHA-pin or (i) fails on F-push" no longer applies — the owner-split closes F-push at the composition layer).

## §3b Real shipped bug the gate caught + FIXED (dash pre-push DoS)

The first ubuntu CI run of `consumer-matrix-start-cell` RED-flagged assert (i) with
`.husky/pre-push: 16: set: Illegal option -o pipefail` → `husky - pre-push script failed (code 2)`.
Root cause: the shipped dispatcher [`packages/core/templates/shared/husky-pre-push.sh`](../../../packages/core/templates/shared/husky-pre-push.sh)
carried `set -euo pipefail`, but husky v9 invokes the hook via `sh` on Debian/Ubuntu (`/bin/sh` = dash),
which ignores the bash shebang — the bashism `set -o pipefail` aborts the hook and **hard-blocks EVERY
consumer push on the most common consumer/CI OS**. It passed locally only because macOS `/bin/sh` is
bash-in-posix-mode. This is a real MAJOR consumer bug the gate caught on its first real-OS run — exactly
its purpose. **FIXED in this PR** (`set -euo pipefail` → POSIX `set -eu`; the only pipe, `node_major`,
already carries `|| echo 0`); verified `sh -n` + `dash -n` clean; byte-identical install baselines regen'd.
**Surfaced for the maintainer (NOT edited — `.husky/` is agent-deny-listed, owner=maintainers):** the
framework's OWN `.husky/pre-push:13` carries the same `set -euo pipefail` and needs the identical one-line
fix.

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
