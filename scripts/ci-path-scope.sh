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
# FAIL-CLOSED BY CONSTRUCTION. Outside the kickoff-publication lane described below, the decision
# is `install=false` only when EVERY path the PR changes matches a pattern in SKIP_PATTERNS —
# regions the gated jobs were measured NOT to read.
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
# A separate, narrower `runtime=false` decision admits kickoff publication PRs only. It keeps
# document checks + the principles corpus, skipping runtime/toolchain batteries. It requires
# a changed kickoff, regular document companions, and (optionally) additive stage-only ignore
# exceptions for that same umbrella. Unknown paths, deletions, symlinks, all non-PR events and
# failed probes keep runtime=true. This does not widen the measured install skip set: the
# kickoff lane has its own document/contract checks and retains the NEVER_SKIP fixture floor.
#
# Env: EVENT_NAME (github.event_name). Writes `install` and `runtime` booleans to $GITHUB_OUTPUT and a
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

# Reused by the framework pre-push hook. This mode only reports kickoff publication;
# it does not change the existing CI event/backstop policy or publish GITHUB_OUTPUT.
range_mode=false
[ "${1:-}" != --kickoff-range ] || range_mode=true

decide() {
  local value="$1" reason="$2" runtime="${3:-true}"
  if [ "$range_mode" = true ]; then
    if [ "$runtime" = false ]; then echo kickoff_only=true; else echo kickoff_only=false; fi
    printf '%s\n' "$reason" >&2
    exit 0
  fi
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    printf 'install=%s\nruntime=%s\n' "$value" "$runtime" >>"$GITHUB_OUTPUT"
  fi
  [ -n "${GITHUB_STEP_SUMMARY:-}" ] && printf '**path scope: install=%s, runtime=%s** — %s\n' "$value" "$runtime" "$reason" >>"$GITHUB_STEP_SUMMARY"
  echo "install=$value runtime=$runtime — $reason"
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

if [ "$range_mode" = true ]; then
  [ "$#" = 3 ] || decide true "explicit range requires base and head commit SHAs"
  range_base="$2"; range_head="$3"
  [[ "$range_base" =~ ^[a-f0-9]{40}$ && "$range_head" =~ ^[a-f0-9]{40}$ ]] || decide true "invalid explicit commit SHAs"
  if ! git cat-file -e "$range_base^{commit}" 2>/dev/null || ! git cat-file -e "$range_head^{commit}" 2>/dev/null; then
    decide true "explicit commits are unavailable"
  fi
else
  event="${EVENT_NAME:-}"
  [ "$event" = pull_request ] || decide true "event '${event:-unset}' is not pull_request; everything runs"
  parents=$(git rev-list --parents -n 1 HEAD 2>/dev/null | wc -w | tr -d ' ')
  [ "$parents" = 3 ] || decide true "HEAD is not a two-parent merge commit (got $parents SHAs); cannot compute the PR's change"
  range_base=HEAD^1; range_head=HEAD
fi

tmp=$(mktemp) || decide true "mktemp failed"
trap 'rm -f "$tmp"' EXIT
git diff --no-renames --name-only -z "$range_base" "$range_head" >"$tmp" 2>/dev/null || decide true "git diff of the selected range failed"
[ -s "$tmp" ] || decide true "the PR changes no file relative to its base"

# Only new ignore exceptions for an umbrella changed by this PR are document publication.
# Removing/replacing an ignore rule or changing a different umbrella runs all checks.
stage_ignore_only() {
  local stats added removed line slug found changed
  stats=$(git diff --no-ext-diff --numstat "$range_base" "$range_head" -- .gitignore) || return 1
  read -r added removed _ <<<"$stats"
  [[ "$added" =~ ^[1-9][0-9]*$ && "$removed" = 0 ]] || return 1
  local patch
  patch=$(git diff --no-ext-diff --unified=0 "$range_base" "$range_head" -- .gitignore) || return 1
  while IFS= read -r line; do
    [[ "$line" = +* && "$line" != +++* ]] || continue
    [[ "$line" =~ ^\+!\.claude/orchestrator-prompts/([a-zA-Z0-9_-]+)/kickoff-[a-z]\*\.md$ ]] || return 1
    slug="${BASH_REMATCH[1]}"
    found=false
    while IFS= read -r -d '' changed; do
      case "$changed" in ".claude/orchestrator-prompts/$slug/"kickoff*.md) found=true ;; esac
    done <"$tmp"
    [ "$found" = true ] || return 1
  done <<<"$patch"
}

kickoff_publication_only() {
  local path mode has_kickoff=false denied
  while IFS= read -r -d '' path; do
    for denied in "${NEVER_SKIP[@]}"; do [ "$path" != "$denied" ] || return 1; done
    # kickoff-population.ts excludes these hook-test scratch directories from corpus gates.
    case "$path" in .claude/orchestrator-prompts/c2-test-*/*) return 1 ;; esac
    # Deleted files, executable documents, symlinks and submodules are not this lane.
    mode=$(git ls-tree "$range_head" -- "$path") || return 1
    [[ "$mode" = '100644 blob '* ]] || return 1
    # Same stage grammar as kickoff-population.ts; a deeper path or a naming near-miss
    # cannot silently become a dispatch input that its corpus gates never enumerate.
    if [[ "$path" =~ ^\.claude/orchestrator-prompts/[^/]+/(kickoff|kickoff-[a-z][0-9][a-z0-9]*)\.md$ ]]; then
      has_kickoff=true
      continue
    fi
    if [[ "$path" =~ ^\.claude/orchestrator-prompts/[^/]+/(kickoff(-[a-z0-9]+)?\.[a-z0-9-]+|kickoff-amendments)\.md$ ]]; then
      continue
    fi
    case "$path" in
      docs/superpowers/specs/20[0-9][0-9]-*.md|docs/superpowers/specs/20[0-9][0-9]-*.json|docs/site/face-facts.json) ;;
      .gitignore) stage_ignore_only || return 1 ;;
      *) return 1 ;;
    esac
  done <"$tmp"
  [ "$has_kickoff" = true ]
}

if kickoff_publication_only; then
  decide false "kickoff publication only; document and dispatch-contract checks run, runtime/install batteries skip" false
fi

count=0
while IFS= read -r -d '' path; do
  count=$((count + 1))
  skippable "$path" || decide true "'$path' is outside the measured skip set; the install-area jobs run"
done <"$tmp"

decide false "all $count changed paths are in the measured skip set (scripts/ci-path-scope.sh SKIP_PATTERNS); the install-area jobs are skipped"
