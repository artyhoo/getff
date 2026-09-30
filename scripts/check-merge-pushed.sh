#!/usr/bin/env bash
# check-merge-pushed.sh — refuse a merge that brings in commits never pushed to origin.
#
# WHY: `.husky/pre-push` is where this repo's commit-level gates run (ci-tool-pinning Rule A,
# the Docs-card arm, Prior-art C2, …). A branch merged into another branch WITHOUT having been
# pushed first never passed them; its defects surface only when the merge target is pushed,
# hours later and far from their author. Incident 2026-09-30, join/one-button-union: five
# local-only part branches merged into a join; three gates went red only on the join, each
# costing a ~60-minute landing re-check (9157819d1a8, 00cee9dd6b0, 0b42579a4a1).
#
# RULE: every commit a merge introduces (reachable from a merge head, not already in HEAD)
# must be reachable from some refs/remotes/origin/* ref — i.e. it was pushed and its pre-push
# ran. Merging origin/<anything> always passes. A repo with no `origin` remote is out of scope.
#
# CHANNELS (the earliest point: merge time), one script, two callers:
#   pre-merge-commit  .husky/pre-merge-commit — a CLEAN `git merge`. git (2.53, measured
#                     2026-09-30) has NOT written MERGE_HEAD yet at this point, so the heads
#                     are read from the invoking `git merge` argv (/proc/<ppid>/cmdline, else
#                     `ps`) plus GIT_REFLOG_ACTION. When no head can be resolved the merge is
#                     refused, never waved through: after a refused pre-merge-commit git writes
#                     MERGE_HEAD, so `git commit` completes it through the exact check below.
#   pre-commit        the MERGE_HEAD arm at the top of .husky/pre-commit — a CONFLICTED merge
#                     (and `merge --no-commit`) is committed by `git commit`; heads = MERGE_HEAD.
#
# ESCAPE: MERGE_UNPUSHED_OVERRIDE="<reason, ≥20 chars>" (precedent: ci-tool-pinning.md §3,
#   MERGE_LOCK_OVERRIDE). Every accepted use appends one line to
#   <git-common-dir>/merge-unpushed-override.log; if that write fails the merge is refused.
#
# DECLARED LIMITS (no git hook fires, so no merge-time channel exists; pre-push still runs):
#   · a FAST-FORWARD merge creates no commit and runs no hook;
#   · `git merge --squash` leaves no MERGE_HEAD; `--no-verify` skips both hooks.
#
# Test: tests/hooks/merge-unpushed-refusal.test.sh. Bash 3.2 compatible.
set -uo pipefail

MODE=${1:-}
case "$MODE" in pre-merge-commit|pre-commit) ;; *) echo "usage: $0 pre-merge-commit|pre-commit" >&2; exit 2 ;; esac

git remote get-url origin >/dev/null 2>&1 || exit 0

HEADS=()    # resolved commit ids
LABELS=()   # what the operator typed / the branch name, parallel to HEADS

add_head() { # <commit-ish> <label>
  local sha
  sha=$(git rev-parse -q --verify "$1^{commit}" 2>/dev/null) || return 0
  local i=0
  while [ "$i" -lt "${#HEADS[@]}" ]; do [ "${HEADS[$i]}" = "$sha" ] && return 0; i=$((i + 1)); done
  HEADS+=("$sha"); LABELS+=("$2")
}

branch_label() { # <sha> → a local branch pointing at it, else name-rev, else short sha
  local b
  b=$(git for-each-ref --count=1 --points-at "$1" --format='%(refname:short)' refs/heads 2>/dev/null)
  [ -n "$b" ] || b=$(git name-rev --name-only --refs='refs/heads/*' "$1" 2>/dev/null)
  case "$b" in ''|undefined) b=$(git rev-parse --short "$1") ;; esac
  printf '%s' "$b"
}

# heads_from_words <word>... — the words after `merge`, options and their values skipped.
heads_from_words() {
  local seen_merge=0 skip=0 any=0 w
  for w in "$@"; do
    if [ "$seen_merge" -eq 0 ]; then
      case "$w" in merge|*/git-merge|git-merge) seen_merge=1 ;; esac
      continue
    fi
    if [ "$skip" -eq 1 ]; then skip=0; continue; fi
    case "$w" in
      -m|-F|-s|-X|--message|--file|--strategy|--strategy-option|--into-name) skip=1 ;;
      -) any=1; add_head '@{-1}' "$(git rev-parse --abbrev-ref '@{-1}' 2>/dev/null || echo '@{-1}')" ;;
      -*) ;;
      *) any=1; add_head "$w" "$w" ;;
    esac
  done
  # `git merge` with no commit argument merges the upstream.
  if [ "$seen_merge" -eq 1 ] && [ "$any" -eq 0 ]; then add_head '@{upstream}' "$(git rev-parse --abbrev-ref '@{upstream}' 2>/dev/null)"; fi
}

if [ "$MODE" = pre-commit ]; then
  MH=$(git rev-parse --git-path MERGE_HEAD)
  [ -f "$MH" ] || exit 0
  while IFS= read -r sha; do
    [ -n "$sha" ] && add_head "$sha" "$(branch_label "$sha")"
  done < "$MH"
else
  if [ -r "/proc/$PPID/cmdline" ]; then
    WORDS=()
    while IFS= read -r -d '' w; do WORDS+=("$w"); done < "/proc/$PPID/cmdline"
    [ "${#WORDS[@]}" -gt 0 ] && heads_from_words "${WORDS[@]}"
  else
    set -f
    # shellcheck disable=SC2046 # word-splitting the argv line is the point; ps has lost the quoting
    heads_from_words $(ps -ww -o args= -p "$PPID" 2>/dev/null)
    set +f
  fi
  # shellcheck disable=SC2086
  case "${GIT_REFLOG_ACTION:-}" in "merge "*) set -f; heads_from_words $GIT_REFLOG_ACTION; set +f ;; esac
  # A sha typed by `git pull` (its child `git merge <sha>`) reads better as its branch name.
  i=0
  while [ "$i" -lt "${#HEADS[@]}" ]; do
    case "${LABELS[$i]}" in *[!0-9a-f]*|'') ;; *) LABELS[i]=$(branch_label "${HEADS[$i]}") ;; esac
    i=$((i + 1))
  done
fi

TARGET=$(git symbolic-ref -q --short HEAD 2>/dev/null || git rev-parse --short HEAD)

if [ "${#HEADS[@]}" -eq 0 ]; then
  echo "❌ merge refused: could not determine which commits this merge brings in, so the"
  echo "   unpushed-merge check (scripts/check-merge-pushed.sh) cannot vouch for it."
  echo "   git now holds the merge state: run \`git commit\` to complete it — the pre-commit"
  echo "   hook re-checks the exact MERGE_HEAD — or \`git merge --abort\` to drop it."
  exit 1
fi

BAD=()
i=0
while [ "$i" -lt "${#HEADS[@]}" ]; do
  n=$(git rev-list --count "${HEADS[$i]}" --not HEAD --remotes=origin 2>/dev/null || echo 0)
  [ "$n" -gt 0 ] && BAD+=("${LABELS[$i]}|$(git rev-parse --short "${HEADS[$i]}")|$n")
  i=$((i + 1))
done
[ "${#BAD[@]}" -eq 0 ] && exit 0

REASON=${MERGE_UNPUSHED_OVERRIDE-}
REASON=$(printf '%s' "$REASON" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
if [ "${#REASON}" -ge 20 ]; then
  LOG="$(git rev-parse --path-format=absolute --git-common-dir)/merge-unpushed-override.log"
  NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  for b in "${BAD[@]}"; do
    IFS='|' read -r lbl sha n <<<"$b"
    if ! printf '%s OVERRIDE %s: merged %s (%s, %s unpushed) into %s: «%s»\n' \
        "$NOW" "$MODE" "$lbl" "$sha" "$n" "$TARGET" "$REASON" >>"$LOG" 2>/dev/null; then
      echo "❌ MERGE_UNPUSHED_OVERRIDE accepted, but $LOG could not be written — no override without a log line."
      exit 1
    fi
  done
  echo "⚠ unpushed-merge check overridden (MERGE_UNPUSHED_OVERRIDE, logged to $LOG)"
  exit 0
fi

echo "❌ merge refused: this merge into '$TARGET' brings in commits that were never pushed to origin,"
echo "   so .husky/pre-push never ran on them:"
for b in "${BAD[@]}"; do
  IFS='|' read -r lbl sha n <<<"$b"
  echo "     $lbl ($sha): $n commit(s) not reachable from any origin/* ref"
done
echo "   Push each branch first, so its own pre-push gates run on it, then merge again:"
for b in "${BAD[@]}"; do
  IFS='|' read -r lbl _ _ <<<"$b"
  echo "     git push -u origin $lbl"
done
[ "$MODE" = pre-commit ] && echo "   (the merge is still in progress: \`git merge --abort\` drops it)"
[ "$MODE" = pre-merge-commit ] && echo "   (git keeps the merge state after this refusal: \`git merge --abort\` drops it)"
if [ -n "$REASON" ]; then
  echo "   MERGE_UNPUSHED_OVERRIDE is set but its reason is ${#REASON} chars; it needs ≥20 — say WHY"
  echo "   this merge cannot wait for a push."
else
  echo "   Deliberate exception: MERGE_UNPUSHED_OVERRIDE=\"<why, ≥20 chars>\" git … (logged)."
fi
exit 1
