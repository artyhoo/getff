# KICKOFF — ledger-1597-fixes / F11 — the two refresh-sweep blind spots left by #1647: a vanished source dir (L-4d) and `.getff/rules-research/` (L-4e)

> **Umbrella:** [kickoff.md](kickoff.md) — read §2 scope lock and §3 constraints first; this is a **§1b tail stage**.
> **Rigor label (effort-worthiness L0):** `build-and-verify`.
> **Findings:** campaign addenda L-4d, L-4e (from PR #1647's report — the TAIL-2 session that made the refresh sweep NAME every file it keeps inside a directory payload). Line numbers at `3633456a24`.
> **Ordering:** dispatched only AFTER stage F9 (A1-9d, `copy_safe` in `setup.d/lib.sh`) is merged; never concurrently with F8 (which refactors the same file).

## Task

Make the two remaining refresh-sweep blind spots visible: a directory payload the framework STOPPED shipping is never walked, so its consumer residue is never named (L-4d); `.getff/rules-research/` is seen by neither `report_getff_orphans` nor `_report_dir_residue`, so a stale file there is never named either (L-4e). Report-only in both cases — nothing is deleted. One PR to `staging`.

## Context (data — the two addenda)

### L-4d — `refresh_safe` early-exits when the SOURCE is gone, so a retired payload is never walked
- **Where:** `setup.d/lib.sh:710` (`refresh_safe`: `[ -e "$src" ] || return 0  # source gone — leave consumer copy alone`), installer.
- **Defect:** #1647 taught the sweep to name every kept file inside a directory payload (`_report_dir_residue`, `setup.d/lib.sh:787`), but that walk hangs off `_refresh_dir_payload`, which `refresh_safe` reaches only when `$src` exists. When the framework stops shipping a whole directory (the retired payload no longer exists under `$PKG_ROOT`), the consumer's copy is neither refreshed nor walked nor named — the exact «ghost from a previous version» class L-4b/L-4c closed for files inside a still-shipped payload, but for the whole payload.
- **Failure-scenario:** a consumer installed at version N with `scripts/fences-fire-fixtures/`; version N+1 stops shipping it; `--refresh` prints nothing about the directory, the consumer's `check-fences-fire.sh` keeps running against fixtures the framework abandoned, and the consumer has no signal that the payload is now theirs alone.
- **Verifier:** RED-first on a mktemp consumer: deliver a directory payload, delete the SOURCE under a copied `$PKG_ROOT`, run `--refresh`; pre-fix the output contains no line naming the directory. GREEN: the sweep names the directory once as a retired payload the consumer now owns (report-only; reuse the `⚠ ORPHAN:` / `⊝` vocabulary already in lib.sh so the existing `lane-orphan-residue` arms keep their grep anchors), identical under `--dry-run`, nothing deleted. Keep the «leave consumer copy alone» behaviour — the change is naming, not touching.

### L-4e — `.getff/rules-research/` is unseen by both guards
- **Where:** `setup.d/lib.sh:1050` (`report_getff_orphans`: `find "$PROJECT_ROOT/.getff" -maxdepth 1 -type f`) and `setup.d/lib.sh:787` (`_report_dir_residue`, which walks only directories that pass through `refresh_safe`). `.getff/rules-research/` is the consumer-owned durable home for researched rules (`setup.d/45-python.sh:256-266` — it is re-joined into `.getff/astgrep-rules/` on every pass and is never delivered by the framework).
- **Defect:** because the directory is never a `refresh_safe` destination and the orphan scan does not descend into `.getff/`, nothing the framework prints during `--refresh` ever mentions it: a stale `*.yml` there (a rule the consumer retired, or one an older rule-bootstrap CLI wrote in a shape the join no longer accepts) keeps being joined silently, and a framework-shaped file mistakenly placed there is invisible to every sweep.
- **Failure-scenario:** an older rule-bootstrap CLI wrote `.getff/rules-research/<id>.yml` with a rule id the barrel prune no longer recognises; every `--refresh` re-joins it into the scan dir and the consumer's ast-grep gate keeps enforcing a rule nobody can find in any report.
- **Verifier:** decide and document ONE of: (a) the sweep names `.getff/rules-research/` explicitly as a consumer-owned skip (one `⊝` line, like the `.override.md` Layer-3 line), so a reader of the refresh output knows the directory exists and is theirs; or (b) prove by enumeration (quote the `grep -rn 'rules-research' setup.d/ install.sh` output) that no framework code path can ever write a file there, and record that as the reason the sweep stays silent. RED-first for (a): a planted stale `*.yml` in `.getff/rules-research/` produces no line pre-fix; GREEN: the `⊝` line names the directory. Do NOT invent a heuristic that classifies individual researched rules as stale — the join in 45-python.sh owns that judgment.

## Constraints

- Owned files: `setup.d/lib.sh` (`refresh_safe` early-exit at :710 and the `_report_dir_residue` / `report_getff_orphans` bodies ONLY — not `copy_safe`, not `_copy_tree_with_transform`, not `_refresh_dir_payload`'s wipe/copy semantics), `tests/install-sh/lane-orphan-residue.test.sh` (new arms only — no new test file; a NEW test file ≥80 LOC trips the prior-art capability detector), `packages/getff/MANIFEST.sha256`.
- `setup.d/45-python.sh`, `install.sh`, `setup.d/50-hooks.sh` are NOT yours (other tail stages). If naming a retired payload needs a registry the framework does not keep (e.g. «which directories did version N ship?»), PARK with the exact gap rather than inventing a second path registry — #1647 rejected that design for the same reason (`setup.d/lib.sh:764`).
- Every `setup.d/` edit ⇒ `bash scripts/build-getff-dist.sh` in the SAME commit, then `--check`. `shellcheck --exclude=SC2034,SC2016,SC2317 setup.d/*.sh install.sh` at default severity. BSD sed/awk portability (ERE grep, no `\|`, no multi-line awk `-v`).
- Anti-drift arm from #1629: exactly ONE `find … -name '*.md' … -print0` walk across install.sh + setup.d/*.sh — do not add a second.
- Iteration cap: 5 tool-loop rounds per finding; then report PARTIAL.

## Tools

Bash, Read, Edit, Grep, git.

## Output

A REPORT with a literal `Status: DONE|BLOCKED|PARTIAL` line, `Deliverable:`, `Evidence:` (RED and GREEN quoted per finding, plus the `--dry-run` twin of each), `BLOCKER:`/`MINOR:` per [agents/orchestrator-worker-discipline.md](../../../agents/orchestrator-worker-discipline.md). Name the active traps from the umbrella §4.

## AI-traps (per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

**T3**, **T5**, **T14**, **T18** (naming is reversible, deletion is not — never delete), **T19**, **T20** (umbrella §4).

## Verify

1. L-4d: RED (no line for the retired directory) / GREEN (one line naming it, report-only) quoted, both with and without `--dry-run`.
2. L-4e: option (a) or (b) stated with its evidence; for (a) RED/GREEN quoted.
3. `bash tests/install-sh/lane-orphan-residue.test.sh` all arms green (the 25 existing arms untouched); `refresh-dir-payload-ownership.test.sh` green; `bash scripts/build-getff-dist.sh --check` in sync; shellcheck clean.

```bash host-verify
bash tests/install-sh/lane-orphan-residue.test.sh
bash tests/install-sh/refresh-dir-payload-ownership.test.sh
bash scripts/build-getff-dist.sh --check
bash scripts/run-local-ci-sweep.sh
```
