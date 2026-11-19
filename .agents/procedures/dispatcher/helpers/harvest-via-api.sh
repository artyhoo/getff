#!/usr/bin/env bash
# harvest-via-api.sh — land a set of files onto a branch via the GitHub Git Data API,
# bypassing a blocked git transport (github.com:443/:22). Append-merge semantics:
# the new tree is based on the live base-branch tree, overriding ONLY the given paths —
# files that advanced on the base since the container forked are preserved (no clobbering).
#
# Why this exists: when the proxy drops github.com git-transport but api.github.com stays
# reachable (host-selective flap — see aif-doctor §3.3), `harvest.ts`'s `git push` fails.
# All operations here go over api.github.com via `gh api`, so a blocked git host is bypassed.
#
# Reuse note: REST Git Data API (blobs→tree→commit→ref) is the GitHub-native push-without-git
# path; no new dependency (gh + jq + base64 already present). Operator-directed build 2026-06-05.
#
# Usage:
#   harvest-via-api.sh --repo <owner/repo> --base <base-branch> --branch <new-branch> \
#       --message <commit-msg> --srcdir <dir-mirroring-repo-paths> <repo/path> [<repo/path> ...]
#
# Each <repo/path> is read from <srcdir>/<repo/path>. Content is sent base64 (any text/binary).
# The base branch's current tree is the base_tree → only the listed paths are added/updated.
#
# Exit: 0 on success (prints new commit sha + ref), non-zero on any API failure.
set -euo pipefail
# Homebrew PATH fix for stripped hook environments — only when gh/jq are not already
# resolvable, so a test harness can interpose a stubbed gh ahead of the real one.
if ! command -v gh >/dev/null 2>&1 || ! command -v jq >/dev/null 2>&1; then
  export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
fi

REPO="" BASE="" BRANCH="" MSG="" SRCDIR=""
PATHS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --repo)    REPO="$2"; shift 2 ;;
    --base)    BASE="$2"; shift 2 ;;
    --branch)  BRANCH="$2"; shift 2 ;;
    --message) MSG="$2"; shift 2 ;;
    --srcdir)  SRCDIR="$2"; shift 2 ;;
    --*) echo "unknown flag: $1" >&2; exit 2 ;;
    *) PATHS+=("$1"); shift ;;
  esac
done

[ -n "$REPO" ] && [ -n "$BASE" ] && [ -n "$BRANCH" ] && [ -n "$MSG" ] && [ -n "$SRCDIR" ] || {
  echo "missing required flag (--repo/--base/--branch/--message/--srcdir)" >&2; exit 2; }
[ "${#PATHS[@]}" -gt 0 ] || { echo "no paths given" >&2; exit 2; }

echo "[via-api] repo=$REPO base=$BASE branch=$BRANCH files=${#PATHS[@]}"

# 1. base branch HEAD commit + its tree
base_sha=$(gh api "/repos/$REPO/git/ref/heads/$BASE" --jq '.object.sha')
base_tree=$(gh api "/repos/$REPO/git/commits/$base_sha" --jq '.tree.sha')
echo "[via-api] base $BASE @ $base_sha (tree $base_tree)"

# Mode per file: git index → HEAD → filesystem bits. Hardcoding 100644 stripped
# the exec bit off shipped scripts twice (one-click-installer S4/S5, 2026-06-10).
resolve_mode() { # $1 = repo path, $2 = src file → echoes the git file mode
  local m
  m=$(git -C "$SRCDIR" ls-files --stage -- "$1" 2>/dev/null | awk 'NR==1{print $1}' || true)
  [ -n "$m" ] || m=$(git -C "$SRCDIR" ls-tree HEAD -- "$1" 2>/dev/null | awk 'NR==1{print $1}' || true)
  if [ -z "$m" ]; then
    if   [ -L "$2" ]; then m=120000
    elif [ -x "$2" ]; then m=100755
    else                   m=100644
    fi
  fi
  printf '%s\n' "$m"
}

# 2. one blob per file (base64 — safe for any content)
tree_items=()
for p in "${PATHS[@]}"; do
  src="$SRCDIR/$p"
  [ -f "$src" ] || [ -L "$src" ] || { echo "[via-api] MISSING src: $src" >&2; exit 1; }
  mode=$(resolve_mode "$p" "$src")
  case "$mode" in
    100644|100755)
      b64=$(base64 < "$src" | tr -d '\n') ;;
    120000)
      # symlink blob = the link target string, not the file behind the link
      if [ -L "$src" ]; then target=$(readlink "$src"); else target=$(cat "$src"); fi
      b64=$(printf '%s' "$target" | base64 | tr -d '\n') ;;
    *)
      echo "[via-api] UNSUPPORTED mode $mode for $p — only blob modes 100644/100755/120000 can be pushed (gitlink/tree entries cannot)" >&2
      exit 1 ;;
  esac
  blob_sha=$(jq -n --arg c "$b64" '{content:$c, encoding:"base64"}' \
    | gh api "/repos/$REPO/git/blobs" --input - --jq '.sha')
  echo "[via-api]   blob $p -> $blob_sha (mode $mode)"
  tree_items+=("$(jq -n --arg path "$p" --arg sha "$blob_sha" --arg mode "$mode" \
    '{path:$path, mode:$mode, type:"blob", sha:$sha}')")
done

# 3. new tree based on the live base tree (append-merge: only listed paths change)
new_tree=$(jq -n --arg bt "$base_tree" --argjson items "$(printf '%s\n' "${tree_items[@]}" | jq -s '.')" \
  '{base_tree:$bt, tree:$items}' \
  | gh api "/repos/$REPO/git/trees" --input - --jq '.sha')
echo "[via-api] new tree $new_tree"

# 4. commit on top of base HEAD
new_commit=$(jq -n --arg m "$MSG" --arg t "$new_tree" --arg p "$base_sha" \
  '{message:$m, tree:$t, parents:[$p]}' \
  | gh api "/repos/$REPO/git/commits" --input - --jq '.sha')
echo "[via-api] new commit $new_commit"

# 5. create (or fast-forward update) the branch ref
# Existence must key off the EXIT CODE: on 404 gh prints the error body to
# stdout even with --jq, so a non-empty-stdout check takes the wrong branch.
if branch_tip=$(gh api "/repos/$REPO/git/ref/heads/$BRANCH" --jq '.object.sha' 2>/dev/null); then
  if ! patch_err=$(jq -n --arg s "$new_commit" '{sha:$s, force:false}' \
      | gh api -X PATCH "/repos/$REPO/git/refs/heads/$BRANCH" --input - 2>&1 >/dev/null); then
    if grep -qi 'fast forward' <<<"$patch_err"; then
      {
        echo "[via-api] ERROR: ref update rejected — not a fast-forward (force:false)."
        echo "[via-api]   refs/heads/$BRANCH is at $branch_tip, but the new commit $new_commit is parented on $BASE@$base_sha."
        echo "[via-api]   The remote ref moved since this run read it (or the branch was created off a different base)."
        echo "[via-api]   Fix: re-run (rebuilds on the current tips), or push to a fresh --branch."
        echo "[via-api]   NOT auto-forcing: force:true would discard the commits already on $BRANCH."
      } >&2
    else
      echo "[via-api] ERROR: ref PATCH failed for refs/heads/$BRANCH: $patch_err" >&2
    fi
    exit 1
  fi
  echo "[via-api] updated ref refs/heads/$BRANCH -> $new_commit"
else
  jq -n --arg r "refs/heads/$BRANCH" --arg s "$new_commit" '{ref:$r, sha:$s}' \
    | gh api "/repos/$REPO/git/refs" --input - --jq '.object.sha' >/dev/null
  echo "[via-api] created ref refs/heads/$BRANCH -> $new_commit"
fi

echo "[via-api] DONE commit=$new_commit branch=$BRANCH"
