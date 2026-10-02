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
#   pre-merge-commit  .husky/pre-merge-commit — a CLEAN `git merge`. git has NOT written
#                     MERGE_HEAD yet at this point (measured 2026-09-30 on git 2.39, 2.53 and
#                     Apple git 2.54), so the heads come from what git DOES expose:
#                       · `git merge <heads>`: GIT_REFLOG_ACTION is exactly "merge <heads as
#                         typed>" — options and the -m message are already stripped;
#                       · `git pull`: GIT_REFLOG_ACTION is "pull …" and git runs a child
#                         `git merge … FETCH_HEAD`; every FETCH_HEAD line not marked
#                         not-for-merge is a head (an octopus pull has several).
#                     The parent argv (/proc/<ppid>/cmdline, else `ps`) is read ONLY to confirm
#                     that child merges FETCH_HEAD — never split into heads, since `ps` loses the
#                     quoting and a -m message would leak words. When no head can be resolved the
#                     merge is refused, never waved through: after a refused pre-merge-commit git
#                     writes MERGE_HEAD, so `git commit` completes it through the exact check.
#   pre-commit        the MERGE_HEAD arm at the END of .husky/pre-commit — a CONFLICTED merge
#                     (and `merge --no-commit`) is committed by `git commit`; heads = MERGE_HEAD.
#
# ESCAPE: MERGE_UNPUSHED_OVERRIDE="<reason, ≥20 chars>" (precedent: ci-tool-pinning.md §3,
#   MERGE_LOCK_OVERRIDE). Every accepted use appends one line to
#   <git-common-dir>/merge-unpushed-override.log; if that write fails the merge is refused.
#
# DECLARED LIMITS (no git hook fires, so no merge-time channel exists; pre-push still runs):
#   · a FAST-FORWARD merge creates no commit and runs no hook;
#   · `git merge --squash` leaves no MERGE_HEAD; `--no-verify` skips both hooks.
# NOT CHECKED BY DESIGN: a rebase (GIT_REFLOG_ACTION "rebase…", or a rebase in progress)
#   replays merges that already exist in the branch being rebased; it introduces nothing.
#
# Test: tests/hooks/merge-unpushed-refusal.test.sh. Bash 3.2 compatible.
set -uo pipefail

MODE=${1:-}
case "$MODE" in pre-merge-commit|pre-commit) ;; *) echo "usage: $0 pre-merge-commit|pre-commit" >&2; exit 2 ;; esac

git remote get-url origin >/dev/null 2>&1 || exit 0
case "${GIT_REFLOG_ACTION:-}" in rebase*) exit 0 ;; esac
[ -d "$(git rev-parse --git-path rebase-merge)" ] || [ -d "$(git rev-parse --git-path rebase-apply)" ] && exit 0

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

# heads_from_fetch_head — every FETCH_HEAD line that is not not-for-merge, labelled by branch.
heads_from_fetch_head() {
  local fh sha tag desc lbl
  fh=$(git rev-parse --git-path FETCH_HEAD)
  [ -f "$fh" ] || return 0
  while IFS="$(printf '\t')" read -r sha tag desc; do
    if [ -z "$sha" ] || [ "$tag" = not-for-merge ]; then continue; fi
    lbl=$(printf '%s' "$desc" | sed -n "s/^branch '\(.*\)' of .*/\1/p")
    add_head "$sha" "${lbl:-$(branch_label "$sha")}"
  done < "$fh"
}

# parent_merges_fetch_head — true when the parent process is `git merge … FETCH_HEAD`.
parent_merges_fetch_head() {
  local argv
  if [ -r "/proc/$PPID/cmdline" ]; then
    argv=$(tr '\0' ' ' < "/proc/$PPID/cmdline")
  else
    argv=$(ps -ww -o args= -p "$PPID" 2>/dev/null)
  fi
  case " $argv " in *" merge "*" FETCH_HEAD "*) return 0 ;; esac
  return 1
}

if [ "$MODE" = pre-commit ]; then
  MH=$(git rev-parse --git-path MERGE_HEAD)
  [ -f "$MH" ] || exit 0
  while IFS= read -r sha; do
    [ -n "$sha" ] && add_head "$sha" "$(branch_label "$sha")"
  done < "$MH"
else
  case "${GIT_REFLOG_ACTION:-}" in
    merge|"merge "*)
      set -f
      # shellcheck disable=SC2086 # the reflog action is "merge <head> <head> …", space-separated
      set -- $GIT_REFLOG_ACTION
      set +f
      shift
      if [ "$#" -eq 0 ]; then add_head '@{upstream}' "$(git rev-parse --abbrev-ref '@{upstream}' 2>/dev/null)"; fi
      for w in "$@"; do
        case "$w" in
          -) add_head '@{-1}' "$(git rev-parse --abbrev-ref '@{-1}' 2>/dev/null || echo '@{-1}')" ;;
          FETCH_HEAD) heads_from_fetch_head ;;
          *) add_head "$w" "$w" ;;
        esac
      done
      ;;
    *) parent_merges_fetch_head && heads_from_fetch_head ;;
  esac
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
  if ! n=$(git rev-list --count "${HEADS[$i]}" --not HEAD --remotes=origin 2>/dev/null); then
    echo "❌ merge refused: \`git rev-list\` failed on ${LABELS[$i]} — the unpushed-merge check"
    echo "   (scripts/check-merge-pushed.sh) cannot vouch for it. \`git merge --abort\` drops the merge."
    exit 1
  fi
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
  IFS='|' read -r lbl sha _ <<<"$b"
  if git show-ref -q --verify "refs/heads/$lbl"; then
    echo "     git push -u origin $lbl"
  else
    echo "     push the branch that contains $sha"
  fi
done
echo "   (Already pushed from elsewhere? \`git fetch origin\` first — only origin/* refs count.)"
[ "$MODE" = pre-commit ] && echo "   (the merge is still in progress: \`git merge --abort\` drops it)"
[ "$MODE" = pre-merge-commit ] && echo "   (git keeps the merge state after this refusal: \`git merge --abort\` drops it)"
if [ -n "$REASON" ]; then
  echo "   MERGE_UNPUSHED_OVERRIDE is set but its reason is ${#REASON} chars; it needs ≥20 — say WHY"
  echo "   this merge cannot wait for a push."
else
  echo "   Deliberate exception: MERGE_UNPUSHED_OVERRIDE=\"<why, ≥20 chars>\" git … (logged)."
fi
exit 1
