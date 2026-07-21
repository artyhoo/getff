# deps-hash-multistack — DONE
- Final PR: #1070
- Closed: 2026-07-21
- Summary: staleness detector now covers all three live-generation stacks (JS/python/rust), node-free, one hook.

## What was delivered
- **DH-S1** (#1024 + round-3.5 follow-up #1029) — JS hash surface widened to 7 fields; python `pyproject.toml` Tier-1 table-boundary hash + Tier-2 `tomllib` with the no-tomllib sentinel; per-stack baselines (`deps-hash-npm`/`-python`) with legacy-key backward-compat; storage-model SSOT (`decision-format.md`) + response-side SKILL.md alignment.
- **DH-S2** (#1058) — rust `Cargo.toml` Tier-1 table-boundary hash (dependencies/dev/build + dotted sub-tables + `target.*` + `workspace.*`) + Tier-2 `cargo metadata --no-deps --offline` enrichment; `deps-hash-cargo` baseline. Detect-only (NO `setup.d/NN-rust.sh`).
- **DH-S3** (#1070, this PR) — tomli shim (py3.7-3.10 back-port fallback, byte-identical to tomllib); polyglot cross-stack single-emit tests (3 stacks → one WARN / one JSON object); cargo-seed fresh-install parity (`deps-hash-cargo: <pending>` in the seed template — a backward-sweep finding, DH-S2 shipped detection but never the rust onboarding nudge); documented blind-spots consolidated into the hook header.

## Forks resolved
- **Fork-5 (Option A vs B — one hook vs per-stack split):** resolved to **Option A** (one hook with stack detection) by operator directive 2026-07-21. The ~180-line size gate was a single-stack-era threshold; multistack grew as one uniform block per stack (homogeneous, maintainable). Recorded, not a silent number swap. The hook lands ~212 lines, structurally homogeneous.

## Blind spots accepted (documented, not closed)
- Lockfiles not hashed (in-range `npm/poetry/cargo update` is an accepted false-negative for a staleness nudge).
- pnpm v11 relocated `overrides` to `pnpm-workspace.yaml` (out of the hashed package.json surface).
- git-deps without a pinned rev, and path-deps, drift silently (manifest text is stable while upstream moves).
- Rust **delivery** lane (`setup.d/NN-rust.sh`) is out of scope — this umbrella detects `Cargo.toml`, it does not build the rust install lane.

## PRs
#1016 (kickoff + R-phase) · #1020/#1022/#1026 (kickoff audits) · #1017 (LG-S4 scope desync) · #1024 + #1029 (DH-S1) · #1058 (DH-S2) · #1049 (S2→S3 night-prompt) · #1070 (DH-S3 closure).
