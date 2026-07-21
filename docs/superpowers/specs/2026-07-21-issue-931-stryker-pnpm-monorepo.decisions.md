# #931 stryker-pnpm-monorepo — night-mode decisions & findings log

Companion to [the design spec](2026-07-21-issue-931-stryker-pnpm-monorepo-design.md). Night-mode delta item 1: **technical** forks resolved autonomously with recorded rationale (below); **genuine owner** forks logged, NOT decided (§Owner-forks).

## Technical decisions (resolved autonomously)

### TD-0 — Fix form for defect #1 (plugin resolution): PENDING spike (Phase 0)
Resolved by the empirical matrix in spec §3 (`spike-pnpm-stryker` subagent, launched 2026-07-21). Verdict + decisive log lines land here when the spike returns. Decision rule: cheapest passing arm C (`.npmrc` hoist, ADOPT) > A (no change) > B (entry-file paths, BUILD).

## Structural findings (confirmed, shape PR-2)

### SF-1 — the multi-stack monorepo branch ships NO stryker.config.json at all — CONFIRMED
`setup.d/40-configs.sh`: the `if [ -n "$_ws_lines" ]` multi-stack branch (lines 197-281) places per-workspace eslint configs + a root `.dependency-cruiser.cjs`, but **never** copies `stryker.config.json` or calls `patch_stryker_package_manager`. Those happen ONLY in the flat/single-root `else` branch (lines 285-342: sites 291/303/316/337 + patch at 292/304/317/338). Verified: `awk 'NR>=197&&NR<=282 && /stryker/'` → empty; `_resolve_workspace_stacks` (lib.sh) returns non-empty for any pnpm/`workspaces` repo → the monorepo path is taken → no stryker.

**Implications:**
1. A pnpm monorepo consumer installing **today** gets no `stryker.config.json` → `test:mutation` fails "config not found", NOT the plugin error the issue reports.
2. Therefore the issue's consumer (timeliner, `63e2b38`) got its stryker config from the **flat branch** (pre-multi-stack-branch installer, when stryker was always copied) — strengthens the stale-install reading of defects #2/#3a in spec §1. (Hypothesis; confirm via `git log` of the multi-stack branch landing vs the install date if it matters — not load-bearing for the fix.)
3. **PR-2 is not "fix one existing config" — it is "make the monorepo branch emit per-package stryker wiring where today it emits none."** Cleaner: no collision with an existing single-config copy in that branch. The emit hooks into the existing per-workspace `while` loop (40-configs.sh:202-256), mirroring the per-workspace eslint placement.
4. PR-1's plugin fix still applies to the **flat-branch** stryker copy (the only stryker the installer shows today) + whatever PR-2 emits for monorepos.

## Owner-forks (LOGGED, not decided — surfaced in morning report)
- (none yet)

## BLOCKED increments
- (none yet)

## Degradation / deviations taken
- (none yet)
