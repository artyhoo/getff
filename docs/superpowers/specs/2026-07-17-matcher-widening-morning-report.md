# matcher-widening — morning report (2026-07-21)

## Landed

- **PR [#1054](https://github.com/artyhoo/getff/pull/1054)** — `feat/matcher-widening-multiedit` → `staging`. **CI GREEN** (36 pass). Awaiting operator merge (not auto-merged — kickoff Task F reserves the merge for the operator).
- 12 commits: STEP-1 matcher widening (6 hooks, all channels), Layer-1 `@file-content-gate` + `@matcher-parity` edit-time gate, Layer-2 CC-config population backstop, plugin-channel propagation, baseline re-capture, cold-review MINOR fix, tsc fix, spec/decisions docs.

## What shipped (the preventer)

- **Layer 1** (`.claude/hooks/check-hook-marker.sh`): `@file-content-gate` (3 path-only gates → matcher ⊇ {Edit,Write,MultiEdit}) + `@matcher-parity` (3 case-TOOL gates → matcher ⊇ their `case "$TOOL"` arm). Self-calibrating (A5 Write-only stays green). Comment-immune extraction.
- **Layer 2** (`packages/core/hooks/check-hook-marker.test.ts`): population sweep of the real gate over every hook against the live settings.json — catches SSOT/settings-only matcher narrowing. In the **CC-config bucket, not the agnosticism probe** (operator-flagged: MultiEdit is CC-only, must not contaminate the PORTABLE verdict).

## Decision resolutions

- **D1/D5** — rebased twice (base moved 28 then +4 commits); final base = staging trunk-restore `62d90304d`.
- **D2** — plugin `hooks.json` widened surgically (sed), NOT `render --write` (would clobber hand-maintained ZCode twins).
- **D3** (operator fork) — Layer 2 → CC-config bucket, not `tests/agnosticism/`.
- **D4** — added the `@matcher-parity` rule (restores design.md:65 two-rule intent the kickoff had deferred).
- All resolved autonomously per the fork policy; full rationale in [`2026-07-17-matcher-widening-decisions.md`](./2026-07-17-matcher-widening-decisions.md).

## Findings surfaced (out of scope — NOT fixed here)

- **F1** — staging's `render-harness-config.mjs --check` twin/SSOT drift was pre-existing + ungated. **Now moot**: staging `62d90304d` fixed it; `render --check` green on the rebased branch.
- **F2** — staging's byte-identical baselines were stale for 3 zcode-parity `inject-*` hooks. The full re-capture corrected them (forced by the all-or-nothing snapshot); staging `62d90304d` also fixed them → converged, no conflict.
- **8 inherited red tests** during the work were entirely staging's broken trunk (verified on a pristine `origin/staging` worktree); cleared by the staging trunk-restore. This PR added zero red.

## Degradation / skips

- None. No layer skipped, no test marked skip. Cold-review (T19) run; one MINOR (comment-line pollution in the parity extraction) found and fixed before push.

## No owner-forks left open

The one genuine owner fork (D3, agnosticism bucket) was raised by the operator and resolved in-session. Nothing pending in the decisions log.
