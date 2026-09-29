#!/usr/bin/env bash
# ci-path-scope.sh — decide whether audit-self.yml's install-area jobs must run for this event.
#
# Purpose: the install-area jobs (install-sh battery shards A/B/C, the fresh-install validate
# matrix + its multi-stack sibling, the Windows consumer-matrix cell) are ~60% of one audit-self
# run's runner-minutes. A pull_request whose change cannot reach any file those jobs read gains
# nothing from re-running them, and the account's 20-concurrent-job ceiling makes every such run
# a queue cost for every other PR. This script is the body of the `path-scope` job; the jobs are
# `if:`-gated on its `install` output.
#
# FAIL-CLOSED BY CONSTRUCTION. The decision is `install=false` only when EVERY path the PR changes
# matches a pattern in SKIP_PATTERNS below — regions the gated jobs were measured NOT to read.
# Everything else, including every path that does not exist yet, forces `install=true`. So a new
# file under setup.d/ (or anywhere new) runs the battery without anyone updating this list; the
# list can only make the skip NARROWER when it drifts, never wider. Also `install=true`:
#   - any event other than pull_request (push to staging/main/chore/**, merge_group) — the
#     post-merge push to staging is the backstop that still runs everything;
#   - HEAD is not a two-parent merge commit (the pull_request merge ref actions/checkout makes);
#   - git cannot produce the diff, or the diff is empty.
# The `ci-success` aggregate then re-checks the decision against the gated jobs' results
# (scripts/ci-success-gate.sh `PATH_SCOPE_INSTALL`): a missing decision, or a gated job skipped
# while the decision said `true`, fails the required context.
#
# The diff is merge-commit parent 1 (the base tip GitHub merged into) → the merge commit, i.e.
# exactly the files whose content in the TESTED tree differs from the base. `--no-renames` so a
# file moved out of setup.d/ into docs/ shows its deleted setup.d/ path too, not just the new one.
#
# WHERE SKIP_PATTERNS COMES FROM — measured, not guessed. Every step of the gated jobs was run
# under `strace -f -e trace=%file,execve` at b1fbe4eaaaa (2026-09-29) and the set of repo paths
# any process opened, stat'ed or executed was collected; a pattern is here only if NO traced path
# falls under it, including directory opens (a `find docs/` would have counted as reading all of
# docs/). Method + numbers: docs/meta-factory/research-patches/2026-09-29-ci-path-scope-read-set.md.
# Re-measure before WIDENING this list; narrowing it needs no measurement.
#
# Env: EVENT_NAME (github.event_name). Writes `install=true|false` to $GITHUB_OUTPUT and a
# one-paragraph reason to $GITHUB_STEP_SUMMARY when set; always prints the reason on stdout.
# Test seam: none — scripts/ci-path-scope.test.sh builds real merge commits in a tmp repo.
# Tested by scripts/ci-path-scope.test.sh (paired-negative).
set -uo pipefail

# Shell `case` globs: `*` also matches `/`, so `docs/meta-factory/*` covers the whole subtree.
SKIP_PATTERNS=(
  'docs/meta-factory/*'
  'docs/superpowers/*'
  '.claude/orchestrator-prompts/*'
  # Derived from the two docs regions above by scripts/render-face-facts.mjs; its only gated
  # reader (the generator arms test) runs in the ungated manifest-render-check job.
  'docs/site/face-facts.json'
)

# Files INSIDE a skip region that a gated job was traced reading anyway. Checked first: a PR
# touching one of these runs the install-area jobs. Each entry names its reader.
NEVER_SKIP=(
  # packages/core/hooks/pre-push.ts detects "am I the framework repo" by this file's
  # existence (access F_OK, traced under scripts/check-ask-files.test.sh in install-sh-a).
  'docs/meta-factory/prior-art-evaluations.md'
  # scripts/host-verify-coverage.test.sh (install-sh-a) replays the real motivating kickoff.
  '.claude/orchestrator-prompts/getff-freshness-widening-s1/kickoff.md'
)

if [ "${1:-}" = "--list" ]; then
  printf '%s\n' "${SKIP_PATTERNS[@]}"
  exit 0
fi
if [ "${1:-}" = "--list-never" ]; then
  printf '%s\n' "${NEVER_SKIP[@]}"
  exit 0
fi

decide() {
  local value="$1" reason="$2"
  [ -n "${GITHUB_OUTPUT:-}" ] && echo "install=$value" >>"$GITHUB_OUTPUT"
  [ -n "${GITHUB_STEP_SUMMARY:-}" ] && printf '**path scope: install=%s** — %s\n' "$value" "$reason" >>"$GITHUB_STEP_SUMMARY"
  echo "install=$value — $reason"
  exit 0
}

skippable() {
  local p="$1" pat
  for pat in "${NEVER_SKIP[@]}"; do
    [ "$p" = "$pat" ] && return 1
  done
  for pat in "${SKIP_PATTERNS[@]}"; do
    # shellcheck disable=SC2254  # the pattern IS the glob
    case "$p" in $pat) return 0 ;; esac
  done
  return 1
}

event="${EVENT_NAME:-}"
[ "$event" = pull_request ] || decide true "event '${event:-unset}' is not pull_request; everything runs"

parents=$(git rev-list --parents -n 1 HEAD 2>/dev/null | wc -w | tr -d ' ')
[ "$parents" = 3 ] || decide true "HEAD is not a two-parent merge commit (got $parents SHAs); cannot compute the PR's change"

tmp=$(mktemp) || decide true "mktemp failed"
trap 'rm -f "$tmp"' EXIT
git diff --no-renames --name-only -z HEAD^1 HEAD >"$tmp" 2>/dev/null || decide true "git diff HEAD^1 HEAD failed"
[ -s "$tmp" ] || decide true "the PR changes no file relative to its base"

count=0
while IFS= read -r -d '' path; do
  count=$((count + 1))
  skippable "$path" || decide true "'$path' is outside the measured skip set; the install-area jobs run"
done <"$tmp"

decide false "all $count changed paths are in the measured skip set (scripts/ci-path-scope.sh SKIP_PATTERNS); the install-area jobs are skipped"
