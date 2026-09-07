# KICKOFF — ledger-1597-fixes / F1 — cargo self-check under set -e + shared hash ladder

> **Umbrella:** [kickoff.md](kickoff.md) — read §2 scope lock and §3 constraints first.
> **Rigor label (effort-worthiness L0):** `build-and-verify`.
> **Findings:** A2-3, R-3 (verbatim below). Line numbers are at `992377dbdb`; relocate on the current base.

## Task

Make the cargo lane's self-check survive a non-zero `cargo` exit under `set -euo pipefail` (A2-3), and replace the two inlined sha256/shasum/md5 ladders in the cargo and go lanes with the `_hash256` helper `setup.d/lib.sh` already exports (R-3). Two atomic commits, one PR to `staging`.

## Context (data — the two findings, verbatim from the ledger)

### A2-3 — cargo self-check aborts install under set -e when clippy missing `[CONFIRMED]`
- **Where:** `setup.d/46-cargo.sh:308` (installer)
- **Defect:** `_out=$( cd "$_t" && cargo clippy ... )` is a plain assignment under install.sh's set -euo pipefail, so any non-zero exit from cargo (clippy component missing, minimal rustup profile, compile error) aborts the whole install mid-self-check — no summary, no refresh_baseline_flush — despite the function's 'rc=0 on every branch' contract; the go lane guards the identical call with `|| _rc=$?`.
- **Failure-scenario:** Consumer on rustup `--profile minimal` (official rust:* Docker images) runs `./install.sh cargo`. Delivery succeeds, self-check enters `command -v cargo` branch, cargo clippy exits 1 ('cargo-clippy is not installed') → assignment at :308 returns 1 → set -e terminates install.sh; verdict lines, refresh_baseline_flush (install.sh:313) and the completion line never print; stderr discarded (2>/dev/null). Harness repro: `bash -c 'set -euo pipefail; f(){ local _out; _out=$( cd /tmp && false ); echo reached; }; f; echo continued'` prints nothing, exit 1. Same at :321.
- **Verifier:** Plain assignments at :308/:321 under install.sh set -euo pipefail, caller unguarded at install.sh:308; harness repro rc=1 nothing printed vs go twin form OK. Trigger: any non-zero cargo exit (clippy absent → 101). Not executed live (no rustup) but deterministic.

### R-3 — 46/47 lanes re-implement lib.sh _hash256 ladder `[CONFIRMED]`
- **Where:** `setup.d/46-cargo.sh:218` (installer)
- **Defect:** 46-cargo.sh and 47-go.sh each inline a 10-line sha256sum/shasum/md5/md5sum hash ladder for the rules-lock sourceFingerprint although setup.d/lib.sh already exports _hash256 <file> (in scope for both lanes).
- **Failure-scenario:** 10 lines × 2 lanes (46:218-228, 47:193-203) duplicating lib.sh:243-252; copies diverge: lib.sh returns 1 with no sha tool, the lane copies fall through to `md5:` and write a fingerprint under a different scheme prefix — sha256: vs md5: mismatch between rules-lock and refresh-baseline hashing of the same file on a host without sha tools.
- **Verifier:** lib.sh:243-252 _hash256 sourced before both lanes (install.sh:61 vs :306/:1289); 46:218-228 ≡ 47:193-203; copies add md5 fallbacks lib.sh lacks → divergent degradation policy on a no-sha host (lanes write md5: fingerprint, refresh-baseline degrades with a warning).

## Constraints

- Owned files: `setup.d/46-cargo.sh`, `setup.d/47-go.sh` (the hash ladder ONLY — nothing else in the go lane), `tests/install-sh/cargo-entry-lane.test.sh`, `tests/install-sh/go-entry-lane.test.sh`. `setup.d/lib.sh` is NOT yours: if `_hash256`'s contract must change, PARK with the exact divergence.
- R-3 decision: the lanes adopt `_hash256`'s degradation policy (return 1 with no sha tool → the lane logs and skips the fingerprint), not the other way round. Say in the commit body what a no-sha host now gets.
- A2-3 fix shape: mirror the go twin's `|| _rc=$?` form; the self-check must return rc=0 on every branch and print its verdict lines.
- Iteration cap: 6 tool-loop rounds per commit; then report PARTIAL with what is left.

## Tools

Bash (the test suites are bash: `bash tests/install-sh/cargo-entry-lane.test.sh`), Read, Edit, Grep, git. `cargo`/`rustup` are absent in this runtime — the A2-3 test must stub `cargo` on PATH (a shell shim that exits 101) and assert the installer reaches its completion line.

## Output

A REPORT with a literal `Status: DONE|BLOCKED|PARTIAL` line, then `Deliverable:` (branch + commits), `Evidence:` (the RED and GREEN test outputs quoted), `BLOCKER:`/`MINOR:` per [agents/orchestrator-worker-discipline.md](../../../agents/orchestrator-worker-discipline.md). Name the active traps from the umbrella §4.

## AI-traps (per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active traps for this stage: **T3** (command output or `file:line` behind every claim), **T5** (the owned-file row is the whole scope), **T14** (a SKIPped lane proves nothing — say which lanes executed), **T19** (cold-review your own diff before the report), **T20** (quote the output behind each verdict).

## Verify

1. RED before: the new cargo-entry-lane case fails on the current base with the `cargo` shim (quote the failing line).
2. GREEN after: same case passes; the full `bash tests/install-sh/cargo-entry-lane.test.sh` and `go-entry-lane.test.sh` pass (quote the tail, including any SKIP lines — T14).
3. `grep -n 'sha256sum\|shasum\|md5sum' setup.d/46-cargo.sh setup.d/47-go.sh` returns nothing outside comments after R-3.
4. `git diff origin/staging --stat` lists only the four owned files.

```bash host-verify
bash tests/install-sh/cargo-entry-lane.test.sh
bash tests/install-sh/go-entry-lane.test.sh
bash scripts/run-local-ci-sweep.sh
```
