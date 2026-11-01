#!/usr/bin/env bash
# run-k3-control.sh — port wrapper for the amended-4 K3 arm (recovery-d011 lane K3).
#
# The packet runners (k3-arm.sh + k3-outer-control.sh) are byte-identical ports and
# expect an ISOLATED scratch repo in AM4_REPO. This wrapper fabricates exactly that
# from the current HEAD — a detached worktree with a node_modules link — points
# AM4_FIXTURES at the hash-pinned frozen companions (fixtures/q3), runs the UNCHANGED
# arm, and re-prints the full receipt on stdout so the recovery driver can assert the
# six frozen expected_lines. Exit code is the arm's own (0 healthy / 1 caught-weakening
# or drift); teardown always runs.
#
# Not a gate by itself: the recovery driver (driver.mjs laneK3) is the caller that
# turns this receipt into a verdict.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# HERE is recovery-d011/k3 — FOUR levels up to the repo root (three would land on scripts/).
REPO_ROOT="$(cd "$HERE/../../../.." && pwd)"

# Never inherit a foreign git context into the scratch worktree.
unset GIT_DIR GIT_COMMON_DIR GIT_WORK_TREE GIT_INDEX_FILE

WT="$(mktemp -d "${TMPDIR:-/tmp}/s1-k3-wt-XXXXXX")"
OUT="$(mktemp "${TMPDIR:-/tmp}/s1-k3-receipt-XXXXXX")"
cleanup() {
  local rc=$?
  if [ -L "$WT/node_modules" ]; then
    rm "$WT/node_modules"
  elif [ -e "$WT/node_modules" ]; then
    echo "WARN k3 wrapper: unexpected non-symlink node_modules in scratch — leaving worktree removal to git --force"
  fi
  git -C "$REPO_ROOT" worktree remove --force "$WT" >/dev/null 2>&1 || true
  exit "$rc"
}
trap cleanup EXIT

git -C "$REPO_ROOT" worktree add --detach "$WT" HEAD >/dev/null || { echo "K3-WRAPPER-FAIL worktree add failed"; exit 3; }
ln -s "$REPO_ROOT/node_modules" "$WT/node_modules"

AM4_REPO="$WT" \
AM4_FIXTURES="$REPO_ROOT/scripts/test-assurance/recovery-d011/fixtures/q3" \
AM4_OUT="$OUT" \
  bash "$HERE/k3-arm.sh"
rc=$?

echo "----- k3 full receipt ($OUT) -----"
cat "$OUT"
exit "$rc"
