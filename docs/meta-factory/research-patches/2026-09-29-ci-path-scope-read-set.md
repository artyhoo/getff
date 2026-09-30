<!-- scope:ci-path-scope-read-set -->
# What the install-area CI jobs actually read — the measured skip set behind `ci-path-scope.sh`

> Scope: the evidence behind `SKIP_PATTERNS` / `NEVER_SKIP` in `scripts/ci-path-scope.sh`, which lets a
> pull_request skip audit-self's install-area jobs. Measured at `b1fbe4eaaaa` (origin/staging, 2026-09-29).

## Problem

Every push to a PR ran all 44 audit-self jobs, about 72 runner-minutes (baseline run 36485273186).
46.8 of those minutes are the install-area jobs: install-sh shards A/B/C, the 8 fresh-install cells,
multistack and the Windows consumer-matrix cell. The account allows 20 concurrent jobs, so a PR that
edits only a research patch still queued behind, and delayed, every install-area PR. A path filter
fixes this only if its skip list is right. A list guessed from job names would skip a job that
reads a file nobody thought of, and the PR would go green without that job running.

## Method

Every step of every gated job ran under `strace -f -e trace=%file,execve` in a clone at `b1fbe4eaaaa`
(WSL, Ubuntu, Node 22): install-sh-a 53 steps, install-sh-b 55, install-sh-c 47, 8 fresh-install cells,
multistack, and the consumer-matrix step body. Every repo-relative path that any process opened, stat'ed,
listed or executed was collected per step and per executable. A region can go in the skip set only if
no traced process read it as a repo file. Directory listings count as reads.

Two classes of hits were ruled out as copy artefacts, not dependencies:
- `tar` pids and git preload-index threads. These are pids with no execve of their own, so they stat
  every tracked file while a fixture repo is being copied.
- Paths under `/tmp` fixture repos that happen to reuse repo-shaped names.

Expected-failure steps were kept in the trace: the Windows-only step on Linux, and `pip install ruff`
without pip.

## Findings — readers inside candidate regions

| Region | Reader (job / step) | What | Disposition |
|---|---|---|---|
| `docs/meta-factory/**`, `docs/superpowers/**`, `docs/site/face-facts.json` | install-sh-a `scripts/render-face-facts.test.sh` | Opens 413 + 131 files. Research-patch/spec counts and DOI scan feed face-facts.json | Step moved to the ungated `manifest-render-check`, next to its `--check` |
| `docs/meta-factory/prior-art-evaluations.md` | install-sh-a `scripts/check-ask-files.test.sh` → `pre-push.ts`; 4 own-configs fresh-install cells | `access`/`stat`: the "am I the framework repo" existence probe | `NEVER_SKIP` |
| `.claude/orchestrator-prompts/getff-freshness-widening-s1/kickoff.md` | install-sh-a `scripts/host-verify-coverage.test.sh` | Replays the real kickoff through `awk` | `NEVER_SKIP` |
| `docs/meta-factory/EXECUTION-PLAN.md` | install-sh-c `audit-consumer-mode.test.sh` | `stat` in the consumer cwd, ENOENT | benign |
| `.claude/orchestrator-prompts`, `docs/meta-factory/{open-questions.md,research-patches}` | install-sh-c `consumer-pipeline.test.sh` | Operates on a `/tmp` copy | benign |
| `docs/meta-factory/retros/outside.md`, `.claude/orchestrator-prompts/k/gen.mjs` | install-sh-a `line-citations` test | `/tmp/line-citations-test.*` fixture corpus | benign |

No other traced process touched the skip regions.

Historical yield over 80 recently merged PRs, counting PRs whose whole diff falls in the skip set:
- `docs/meta-factory` + `docs/superpowers` alone: 0/80.
- Adding `.claude/orchestrator-prompts`: 8/80.
- Adding `docs/site/face-facts.json`: 10/80. A research-patch PR also regenerates that file.

## Root Cause

The install-area jobs had no path scope because nobody had measured what they read. A job name says
"install". The job body is a battery of about 150 scripts, and some of them read framework docs (the
face-facts arms test reads all of `docs/meta-factory`). A path filter written from job names would
have been wrong.

## Solution

- `scripts/ci-path-scope.sh` is fail-closed. `install=false` only when EVERY changed path matches
  `SKIP_PATTERNS` and none is in `NEVER_SKIP`. Every other case gives `install=true`: non-PR events,
  a non-merge HEAD, a failed or empty diff, and any path nobody listed. `--no-renames` keeps a
  move out of `setup.d/` from hiding the deleted path.
- The gated jobs use a job-level `if:`, so a skipped required job reports as skipped and does not
  stay pending (SSOT #247). The Windows matrix cell uses the per-cell `RUN_CELL`.
- `ci-success` passes `PATH_SCOPE_INSTALL` + `PATH_SCOPED_RESULTS` to `scripts/ci-success-gate.sh`.
  A missing decision, or a gated job skipped under `install=true`, fails the required context.
- The face-facts arms test moves out of the gated battery, because it is the one broad reader.
- PR-scoped `concurrency` with `cancel-in-progress` on pull_request only. `ci-success` stays
  `if: always()`, so a cancelled run is red, never green.

## Prevention

- Fail-closed means drift can only narrow the skip, never widen it. A new reader outside the skip
  regions changes nothing. A new reader INSIDE them is the one gap. The backstop is the push-to-staging
  run, which always runs everything, so the miss is caught on the next staging push. It is not caught
  on the PR.
- Re-measure (this method) before widening `SKIP_PATTERNS`. Narrowing it needs no measurement.
- `scripts/ci-path-scope.test.sh` covers these cases with real merge commits:
  - `NEVER_SKIP` wins
  - fail-closed on unknown paths
  - rename via `--no-renames`
  - non-merge HEAD, empty diff, no repo
  - non-PR events

  It also fails a `NEVER_SKIP` entry that sits in no skip region, which catches a stale entry.

A second, non-strace pass covers the class strace cannot see: a question put to git's index or
object store (`git ls-files`, `git log --`, `git show HEAD:`) reads `.git/`, not the skip-region
path. A grep of the gated jobs' scripts, one call level deep, for `git … ls-files|ls-tree|log|show|cat-file|grep --cached`
found five readers:
- `scripts/host-verify-coverage.sh:104`: its fixtures resolve two tracked docs paths, and the cold
  review traced that deleting either one leaves the asserted candidate counts unchanged.
- `scripts/build-getff-dist.sh:65` and `scripts/format-shipped.sh:78`: their pathspecs name no
  skip region.
- `tests/consumer-matrix/own-config-cell.sh:189`: copies the tree; its readers are traced.
- `scripts/lib/claude-md-excludes.test.sh:118`: whole-repo `git ls-files`, but it runs in the
  ungated `alwayson-budget` job.

Limits: strace sees only the paths this commit's code reads on the traced branch paths. A reader added
later, or a branch not taken at `b1fbe4eaaaa` (e.g. one keyed on changed files), is not in the trace.
Coverage: 100% of gated steps traced. Calibration: first run of this method.

## Tags

`#ci-cost` `#path-filter-fail-closed` `#measured-not-guessed`

## §1.7 self-review

- **Forward-check:**
  - [no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md): the path-scope job is git + bash. No LLM, no network.
  - [ci-tool-pinning.md](../../../.claude/rules/ci-tool-pinning.md): no new tool install.
  - [build-first-reuse-default.md](../../../.claude/rules/build-first-reuse-default.md): dorny/paths-filter (SSOT #241) was considered and not adopted. It puts a third-party action in the required-check path, and a PR with an empty change list gets no match, so a skip decision built on it fails open.
- **Backward-check:** [git-conflict-merge-forward.md](../../../.claude/rules/git-conflict-merge-forward.md) §10 now says when merging staging into a PR branch is warranted. Every merge-forward re-runs the install-area jobs, and on an install-area PR that is the costly part.
