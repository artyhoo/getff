# KICKOFF — ledger-1597-fixes / F8 — S-2 + S-3: one lane body, per-lane tables

> **Umbrella:** [kickoff.md](kickoff.md) — read §2 scope lock and §3 constraints first; this is a **§1b tail stage** and the LAST one.
> **Rigor label (effort-worthiness L0):** `build-and-verify` — but the proof bar is byte-identical delivered output on every lane before/after.
> **Findings:** S-2, S-3 (verbatim below). Line numbers relocated at `e55e4bf2f6`.
> **Ordering:** dispatched only AFTER F1, F5, F6 and the desktop installer chain (A1-9 #1643, L-4b, A2-10, A1-9b) are on `staging` — every one of them edits the files this stage refactors.

## Task

Deduplicate the cargo/go/python lane machinery into shared helpers in `setup.d/lib.sh` (S-2) and drive the three `do_<lane>_lane()` + detection blocks in `install.sh` from a per-lane table with EXPLICIT, documented precedence (S-3). If the S-2 diff alone exceeds ~600 lines, STOP after S-2 and report PARTIAL; S-3 then becomes a second stage only on the coordinator's word. One PR to `staging`.

## Context (data — the two findings, verbatim from the ledger)

### S-2 — 47-go.sh duplicates 46-cargo.sh lane machinery (~200 lines x3) `[CONFIRMED]`
- **Where:** `setup.d/47-go.sh:171` `_go_write_rules_lock` (installer)
- **Defect:** The go lane is a rename-copy of the cargo lane: _go_write_rules_lock (171-257) mirrors _cargo_write_rules_lock (46-cargo.sh:197-282) line for line, and _go_log/_go_copy_or_refresh/_go_deliver_ci are byte-near copies of their _cargo_*/_py_* twins, so ~200 lines exist three times across 45/46/47.
- **Failure-scenario:** Every cross-lane fix is a three-file edit: the D2 'md5 fallback + loud warn' ladder had to be applied to 45:608-623, 46:216-231 and 47:191-206; the S1 schemaVersion=2 bump and the version manifest read likewise. A fourth lane costs ~250 copied lines. The A2-3 defect (cargo self-check lacks `|| _rc=$?` the go twin has) is a live divergence of exactly this kind.
- **Verifier:** Normalised diff of _cargo_write_rules_lock vs _go_write_rules_lock: all non-comment lines match except helper/lane names; 113/373 non-blank lines of 47-go.sh byte-identical to 46-cargo.sh.

### S-3 — Three copy-pasted lane detection blocks + three do_*_lane `[CONFIRMED]`
- **Where:** `install.sh` `do_python_lane` :260, `do_cargo_lane` :307, `do_go_lane` :337; detection blocks at :376/:409/:436 (installer)
- **Defect:** Toolchain-lane routing is copy-pasted three times: three do_<lane>_lane() functions and three detection blocks differing only in marker log, owned file, manifest and prompt, with inter-lane precedence encoded by block order plus an asymmetric guard on the go block.
- **Failure-scenario:** Each review fix re-applied per block: the EOF-safe `|| _py_ans=""` read repeated three times; STACK_EXPLICIT guard three times. Precedence implicit; a fourth lane must re-derive the exclusion set by hand.
- **Verifier (ledger correction):** with Cargo.toml+go.mod cargo is prompted, not silent; the real asymmetry is that go is never offered even if cargo is declined (the Cargo.toml exclusion on the go block).

## Constraints

- Owned files: `setup.d/lib.sh` (new shared lane helpers next to the existing `GETFF_LANES` / `getff_lane_expected` / `getff_lane_installed` at :921-960 — build on that SSOT, never a parallel one; `_copy_tree_with_transform` from #1629 is the precedent for «one body, per-lane callers»), `setup.d/45-python.sh`, `setup.d/46-cargo.sh`, `setup.d/47-go.sh`, `install.sh` (the three `do_*_lane` + three detection blocks only), `packages/getff/MANIFEST.sha256`, existing `tests/install-sh/*.test.sh` arms as needed.
- Behaviour: NO change except the ONE documented asymmetry (go never offered after a declined cargo) — state the current implicit precedence first, then fix that one behaviour and prove it with a polyglot consumer (Cargo.toml + go.mod, cargo declined → go prompted).
- The «✓ only after the mv» + `if`-not-`&&` shape from #1643 and the new locals `_r2_strip_ok`/`_r2_glob_failed` (60-ci.sh — not yours) are the current house style; do not regress the A1-9 sites while moving them.
- Proof bar: for each lane (python, cargo, go) and for a polyglot consumer, run `install.sh <lane>` and `--refresh` on a mktemp consumer against `origin/staging` (a detached worktree) AND your branch, then `diff -r` the delivered trees + rules-lock (allowing only the fingerprint of lib.sh itself if embedded) — expected: empty; quote the diffs. `SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh` green. `npx tsx scripts/render-install-roster.mjs --check` if any 10-skills.sh verb moves (it should not).
- `bash scripts/build-getff-dist.sh` in the SAME commit as every setup.d/install.sh edit; `shellcheck --exclude=SC2034,SC2016,SC2317 setup.d/*.sh install.sh` at default severity; BSD sed/awk portability (no `\|` BRE alternation, no multi-line `awk -v`).
- Iteration cap: 8 tool-loop rounds for S-2, 6 for S-3; then report PARTIAL.

## Tools

Bash, Read, Edit, Grep, git. `cargo`/`go`/`ruff`/`ast-grep` are absent in this runtime: the delivery diff does not need them; the self-check paths run against PATH shims (F1 precedent).

## Output

A REPORT with a literal `Status: DONE|BLOCKED|PARTIAL` line, `Deliverable:`, `Evidence:` (the per-lane `diff -r` outputs quoted, the polyglot precedence proof, the test tails with SKIP lines named — T14), `BLOCKER:`/`MINOR:` per [agents/orchestrator-worker-discipline.md](../../../agents/orchestrator-worker-discipline.md). Name the active traps from the umbrella §4.

## AI-traps (per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

**T3**, **T5**, **T14**, **T19**, **T20** (umbrella §4), plus **T18** (keep, do not delete, any lane-specific residue you cannot prove redundant).

## Verify

1. Per-lane and polyglot `diff -r` before/after: empty (quoted).
2. The one precedence change proven RED (go never offered) → GREEN (go offered after declined cargo).
3. All `tests/install-sh/*.test.sh` green; `build-getff-dist.sh --check` in sync; shellcheck clean; `git diff origin/staging --stat` lists only owned files.

```bash host-verify
SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh
bash scripts/build-getff-dist.sh --check
shellcheck --exclude=SC2034,SC2016,SC2317 setup.d/*.sh install.sh
bash scripts/run-local-ci-sweep.sh
```
