# KICKOFF — ledger-1597-fixes / F6 — three installer latents: A2-9, A2-11, A2-12

> **Umbrella:** [kickoff.md](kickoff.md) — read §2 scope lock and §3 constraints first; this is a **§1b tail stage**.
> **Rigor label (effort-worthiness L0):** `build-and-verify`.
> **Findings:** campaign addenda A2-9, A2-11, A2-12 (text below — these are addenda recorded during the fix campaign, not ledger entries). Line numbers relocated at `e55e4bf2f6`.
> **Ordering:** dispatched only AFTER stage F1 (A2-3 + R-3, the 46/47 hash ladders) is harvested — A2-9 edits the same `_write_rules_lock` bodies.

## Task

Close three latents of one class (lane-machinery neighbours of fixed findings): the cargo/go rules-lock fingerprints that may be blind to the provenance input #1617 added to the python lane (A2-9); the refresh-parity test population that cannot see `$PKG_ROOT`-sourced deliveries (A2-11); the unbounded recursive `find` inside the python rules-lock hash input (A2-12). One PR to `staging`.

## Context (data — the three addenda)

### A2-9 — cargo/go rules-lock fingerprint blind to the provenance input python now hashes
- **Where:** `setup.d/46-cargo.sh:197-282` `_cargo_write_rules_lock`, `setup.d/47-go.sh:171-257` `_go_write_rules_lock` (installer).
- **Defect:** PR #1617 (`git show eb9f896af8 -- setup.d/45-python.sh`) fixed ledger A2-7: the python rules-lock fingerprint ignored a provenance input, so a changed input left the fingerprint unchanged. The cargo and go lanes carry the same fingerprint shape («mirrors 45-python.sh») and were NOT updated. Read the #1617 diff to see exactly which input was added; check whether each of cargo/go has an analogous input that its `sourceFingerprint` (46:193-235, 47:167-210) does not cover.
- **Failure-scenario:** the un-hashed input changes on a consumer (e.g. a getff-owned config the lane delivers alongside the fingerprinted one); `--refresh` compares fingerprints, sees no change, and keeps a stale rules-lock.
- **Verifier:** RED-first — on a mktemp consumer, change the un-hashed input and show the fingerprint unchanged pre-fix. If the analog does NOT exist for a lane (its fingerprint already covers everything it delivers), say so with the list of delivered files vs hashed files — that is a valid outcome.

### A2-11 — refresh-parity test population cannot see `$PKG_ROOT`-sourced deliveries
- **Where:** `tests/install-sh/refresh-covers-full-delivery.test.sh:331/:334` (installer test).
- **Defect:** the delivery population is extracted by grepping literal `$tpl/…` tokens from setup.d/*.sh (the comment at :304-313 defines the population). Files delivered from `$PKG_ROOT/packages/core/templates/...` (the refresh-aware python agent surface from PR #1623, and any other PKG_ROOT-sourced copy_safe/refresh_safe) are outside that population, so the parity assertion cannot see them.
- **Failure-scenario:** a PKG_ROOT-sourced artefact that `--refresh` misses passes the parity test green.
- **Verifier:** widen the extraction to the second source form; prove RED-first by planting a PKG_ROOT-sourced artefact the refresh path misses, OR by quoting the population count before/after widening and naming the files that were invisible.

### A2-12 — recursive `find` inside the python rules-lock hash input
- **Where:** `setup.d/45-python.sh:745` `_hash_input=$( { find "$rules_dir" -name '*.yml' … ; true; } )` (installer).
- **Defect:** the walk is recursive; a nested directory under the rules dir silently changes the hash. The trigger that made this misfire is gone since #1617, but the shape is latent. The trailing `true` (trap: optional dir under `set -e`) is present at :745 — keep it and say why it is load-bearing.
- **Verifier:** bound the walk (`-maxdepth 1`, or the documented intended population — state which and why) and add a paired-negative arm to `tests/install-sh/python-rules-lock.test.sh` (a nested `*.yml` must NOT change the fingerprint after the fix; it MUST before).

## Constraints

- Owned files: `setup.d/45-python.sh` (`_hash_input` at :745 ONLY), `setup.d/46-cargo.sh` + `setup.d/47-go.sh` (`_write_rules_lock` bodies ONLY, on top of the harvested F1), `tests/install-sh/refresh-covers-full-delivery.test.sh`, `tests/install-sh/python-rules-lock.test.sh`, `tests/install-sh/cargo-entry-lane.test.sh` + `go-entry-lane.test.sh` (new arms only), `packages/getff/MANIFEST.sha256`.
- `setup.d/lib.sh`, `install.sh`, `setup.d/50-hooks.sh` are NOT yours (other tail stages). Extend existing test files; a NEW test file ≥80 LOC trips the prior-art capability detector.
- Every setup.d/ edit ⇒ `bash scripts/build-getff-dist.sh` in the SAME commit, then `--check`. `shellcheck --exclude=SC2034,SC2016,SC2317 setup.d/*.sh install.sh` at default severity. BSD sed/awk portability. `cargo`/`go` are absent in this runtime: stub them on PATH where a test needs them (F1's shim precedent).
- Iteration cap: 6 tool-loop rounds per finding; then report PARTIAL.

## Tools

Bash, Read, Edit, Grep, git.

## Output

A REPORT with a literal `Status: DONE|BLOCKED|PARTIAL` line, `Deliverable:`, `Evidence:` (RED and GREEN quoted per finding), `BLOCKER:`/`MINOR:` per [agents/orchestrator-worker-discipline.md](../../../agents/orchestrator-worker-discipline.md). Name the active traps from the umbrella §4.

## AI-traps (per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

**T3**, **T5**, **T14**, **T19**, **T20** (umbrella §4).

## Verify

1. Per finding: RED before / GREEN after quoted (A2-9 may legitimately end as «no analog» with the delivered-vs-hashed list).
2. `bash tests/install-sh/python-rules-lock.test.sh`, `refresh-covers-full-delivery.test.sh`, `cargo-entry-lane.test.sh`, `go-entry-lane.test.sh` all green; say which lanes executed (T14).
3. `bash scripts/build-getff-dist.sh --check` in sync.

```bash host-verify
bash tests/install-sh/python-rules-lock.test.sh
bash tests/install-sh/refresh-covers-full-delivery.test.sh
bash scripts/build-getff-dist.sh --check
bash scripts/run-local-ci-sweep.sh
```
