# KICKOFF — ledger-1597-fixes / F9 — A1-9d: copy_safe's ✓ and baseline stage must follow the copy, not the ambient set -e

> **Umbrella:** [kickoff.md](kickoff.md) — read §2 scope lock and §3 constraints first; this is a **§1b tail stage**.
> **Rigor label (effort-worthiness L0):** `build-and-verify`.
> **Findings:** campaign addendum A1-9d (from PR #1645's report; same family as A1-9 #1643 and A1-9b/c #1645). Line numbers at `fbd14c2f69`.
> **Ordering:** independent of F5–F7; must land BEFORE F8 (which refactors `setup.d/lib.sh` around it), or after F8 on the relocated helper — never concurrently with F8.

## Task

In `setup.d/lib.sh` `copy_safe`, print `✓ $dst` and call `refresh_baseline_stage "$dst"` only when the copy actually landed; on a failed copy print `⚠` naming the file to stderr, leave no partial destination, and return rc=0 (fail-open, same contract as #1643/#1645). One PR to `staging`.

## Context (data — the addendum)

### A1-9d — copy_safe prints ✓ and stages the baseline as statements after `cp -r`
- **Where:** `setup.d/lib.sh` `copy_safe` (around :474-510 at `fbd14c2f69`; relocate with `grep -n '^copy_safe()' setup.d/lib.sh`).
- **Defect:** `✓ $dst` and `refresh_baseline_stage "$dst"` run unconditionally after `cp -r`. Today `set -e` in `install.sh` masks it (a failing cp aborts the install with cp's own stderr, rc=1 — measured by TAIL-16), so the honesty of the ✓ depends entirely on an ambient flag set in a different file. One `|| true` at any call site, or a caller inside a condition context (`if copy_safe …`, `copy_safe … && …`), and the ✓ prints — and the baseline is staged — for a file that was never written.
- **Failure-scenario:** a future lane calls `copy_safe "$src" "$dst" || true` (the pattern already used for optional artefacts elsewhere in setup.d); cp fails (read-only dst, missing parent); the consumer sees ✓, `.ai-factory/refresh-baseline.json` records a hash for a file that does not exist, and the next `--refresh` reports the phantom as «kept».
- **Verifier:** RED-first on the pre-fix lib.sh in a set -e-EXEMPT harness (the same technique as arms D/E of `tests/install-sh/stale-tmp-unconditional-success.test.sh`: source the function, shadow `cp` to fail, call it in an `if`/`||` context): ✓ printed + baseline staged with no file on disk. GREEN after: ⚠ to stderr, no ✓, nothing staged, rc=0, `install.sh` itself still completes (the ambient set -e path must not regress: prove with a normal install on a mktemp consumer).

## Constraints

- Owned files: `setup.d/lib.sh` (`copy_safe` body only — keep the #1617 `--force` replace-not-nest semantics and the skip-if-exists branch byte-for-byte), `tests/install-sh/stale-tmp-unconditional-success.test.sh` (new arm in the existing harness; no new test file), `tests/install-sh/copy-safe*.test.sh` if one exists (`ls tests/install-sh | grep -i copy`), `packages/getff/MANIFEST.sha256`.
- Do NOT change `refresh_safe`, `_copy_tree_with_transform`, `register_cc_hook` (#1645 owns its shape), or any call site. If a call site turns out to already rely on the unconditional ✓, PARK with the file:line.
- `bash scripts/build-getff-dist.sh` in the SAME commit as the lib.sh edit, then `--check`; `shellcheck --exclude=SC2034,SC2016,SC2317 setup.d/*.sh install.sh` at default severity; BSD sed/awk portability (no sed/awk expected).
- Iteration cap: 4 tool-loop rounds; then report PARTIAL.

## Tools

Bash, Read, Edit, Grep, git.

## Output

A REPORT with a literal `Status: DONE|BLOCKED|PARTIAL` line, `Deliverable:`, `Evidence:` (RED and GREEN quoted, plus the normal-install control), `BLOCKER:`/`MINOR:` per [agents/orchestrator-worker-discipline.md](../../../agents/orchestrator-worker-discipline.md). Name the active traps from the umbrella §4.

## AI-traps (per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

**T3**, **T5**, **T14**, **T19**, **T20** (umbrella §4).

## Verify

1. RED (set -e-exempt harness, cp shadowed): ✓ printed and baseline staged with no destination file — quoted.
2. GREEN: ⚠ on stderr, no ✓, nothing staged, rc=0; normal `install.sh ts-server` on a mktemp consumer still prints its completion line.
3. `bash tests/install-sh/stale-tmp-unconditional-success.test.sh` all arms green; `lib-helpers` + `copy-safe` neighbours green; `build-getff-dist.sh --check` in sync.

```bash host-verify
bash tests/install-sh/stale-tmp-unconditional-success.test.sh
bash scripts/build-getff-dist.sh --check
bash scripts/run-local-ci-sweep.sh
```
