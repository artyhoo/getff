#!/usr/bin/env bash
# prune-worktrees.sh — idempotent, preserve-then-prune sweep of accumulated CC worktrees.
#
# Reclaims worktrees whose work already landed in origin/staging (ff-merged OR
# squash-merged PR OR closed PR). Preserves gitignored orchestrator-prompts content
# into $CANON first (T17 preserve-before-destroy) via scripts/link-coordination.sh.
#
# SAFE BY DEFAULT: dry-run unless --apply is passed.
# NEVER removes: unmerged-with-open/no-PR worktrees, locked worktrees, the primary
# checkout, or the worktree you are running from.
#
# Usage:
#   bash scripts/prune-worktrees.sh            # dry-run: classify + print plan
#   bash scripts/prune-worktrees.sh --apply    # actually preserve + remove removable
#   bash scripts/prune-worktrees.sh --apply --force-dirty   # also remove merged-but-dirty (uses --force)
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

PRIMARY="/Users/art/code/rules-as-tests-aif"
APPLY=0; FORCE_DIRTY=0
for a in "$@"; do
  case "$a" in
    --apply) APPLY=1 ;;
    --force-dirty) FORCE_DIRTY=1 ;;
    *) echo "unknown arg: $a" >&2; exit 2 ;;
  esac
done

cd "$PRIMARY"
echo ">> fetching origin/staging + PR states…"
git fetch origin staging -q
# PR-state map. Retry once on flake; ABORT if empty (empty would misclassify every
# squash-merged branch as active and silently under-prune). set +o pipefail locally so
# a broken pipe doesn't nuke the file via the guard below.
: > /tmp/pw_pr.tsv
for attempt in 1 2 3; do
  ( set +o pipefail
    gh pr list --state all --limit 2000 --json headRefName,state 2>/dev/null \
      | jq -r '.[] | [.headRefName,.state] | @tsv' > /tmp/pw_pr.tsv ) || :
  [ -s /tmp/pw_pr.tsv ] && break
  echo "   gh pr list empty (attempt $attempt), retrying…"; sleep 2
done
# Sanity floor: this repo has ~1000 PRs. A partial gh result (TLS flake) would
# misclassify squash-merged branches as active and under-prune. Require a plausible count.
PR_FLOOR=100
prcount=$(wc -l < /tmp/pw_pr.tsv | tr -d ' ')
if [ "$prcount" -lt "$PR_FLOOR" ]; then
  echo "!! PR map only $prcount records (< $PR_FLOOR floor) — gh flake, refusing to misclassify. Aborting." >&2
  exit 3
fi
echo "   PR states: $prcount"

# Where is THIS process running from — never remove your own worktree.
RUNNING_FROM="$(git rev-parse --show-toplevel 2>/dev/null || echo "")"

: > /tmp/pw_removable.txt; : > /tmp/pw_keep.txt

# Parse porcelain into path/branch/detached/locked records.
git worktree list --porcelain | awk '
  /^worktree /{wt=substr($0,10)}
  /^branch /{br=substr($0,8)}
  /^detached/{det=1}
  /^locked/{lk=1}
  /^$/{print wt"\t"br"\t"(det?"D":"")"\t"(lk?"L":""); wt="";br="";det=0;lk=0}
  END{if(wt)print wt"\t"br"\t"(det?"D":"")"\t"(lk?"L":"")}' | \
while IFS=$'\t' read -r wt br det lk; do
  [ -z "$wt" ] && continue
  [ "$wt" = "$PRIMARY" ] && continue
  [ "$wt" = "$RUNNING_FROM" ] && { echo "KEEP  self         $wt" >> /tmp/pw_keep.txt; continue; }
  case "$wt" in /Users/art/.superset/*) echo "KEEP  superset     $wt" >> /tmp/pw_keep.txt; continue;; esac
  [ -n "$lk" ]  && { echo "KEEP  locked       $wt" >> /tmp/pw_keep.txt; continue; }
  [ ! -d "$wt" ] && { echo "PRUNE stale-entry  $wt" >> /tmp/pw_removable.txt; continue; }
  [ -n "$det" ] && { echo "KEEP  detached     $wt" >> /tmp/pw_keep.txt; continue; }
  [ -z "$br" ]  && { echo "KEEP  no-branch    $wt" >> /tmp/pw_keep.txt; continue; }

  bshort="${br#refs/heads/}"
  reason=""
  if git merge-base --is-ancestor "$br" origin/staging 2>/dev/null; then
    reason="ff-merged"
  else
    st="$(awk -F'\t' -v b="$bshort" '$1==b{print $2; exit}' /tmp/pw_pr.tsv)"
    case "$st" in
      MERGED) reason="squash-merged-pr" ;;
      CLOSED) reason="closed-pr" ;;
      *) echo "KEEP  active(${st:-no-pr}) $bshort	$wt" >> /tmp/pw_keep.txt; continue ;;
    esac
  fi

  # Removable. Dirty check → need --force.
  if [ -n "$(git -C "$wt" status --porcelain 2>/dev/null)" ]; then
    echo "PRUNE $reason(dirty) $bshort	$wt" >> /tmp/pw_removable.txt
  else
    echo "PRUNE $reason $bshort	$wt" >> /tmp/pw_removable.txt
  fi
done

echo; echo "=== REMOVABLE ($(grep -c . /tmp/pw_removable.txt)) ==="; cat /tmp/pw_removable.txt
echo; echo "=== KEEP ($(grep -c . /tmp/pw_keep.txt)) ==="; cat /tmp/pw_keep.txt

if [ "$APPLY" -eq 0 ]; then
  echo; echo ">> DRY-RUN. Re-run with --apply to preserve+remove the REMOVABLE set."
  exit 0
fi

echo; echo ">> APPLY: preserving gitignored content then removing…"
while read -r line; do
  wt="$(printf '%s' "$line" | awk -F'\t' '{print $NF}')"
  [ -z "$wt" ] && continue
  dirty=0; printf '%s' "$line" | grep -q 'dirty' && dirty=1
  if [ ! -d "$wt" ]; then continue; fi
  # T17: preserve first (best-effort; conflict → skip, leave intact).
  if ! bash "$PRIMARY/scripts/link-coordination.sh" "$wt" "$PRIMARY" >/dev/null 2>&1; then
    echo "!! preserve CONFLICT, leaving intact: $wt"; continue
  fi
  if [ "$dirty" -eq 1 ] && [ "$FORCE_DIRTY" -eq 0 ]; then
    echo "-- skip dirty (no --force-dirty): $wt"; continue
  fi
  if [ "$dirty" -eq 1 ]; then
    git worktree remove --force "$wt" 2>/dev/null && echo "removed(force) $wt" || echo "!! failed $wt"
  else
    git worktree remove "$wt" 2>/dev/null && echo "removed $wt" || echo "!! failed $wt"
  fi
done < <(grep '^PRUNE' /tmp/pw_removable.txt)

echo ">> pruning stale admin entries + merged local branches…"
git worktree prune
git branch --merged origin/staging | grep -vE '^\*|staging|main' | awk '{print $1}' | \
  while read -r b; do git branch -d "$b" 2>/dev/null && echo "branch -d $b" || :; done
echo ">> done. Remaining worktrees: $(git worktree list | wc -l | tr -d ' ')"
