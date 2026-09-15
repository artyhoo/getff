#!/usr/bin/env bash
# getff:no-card — operator-run clone-hygiene helper; no wiring surface invokes it
# aif-clone-hygiene.sh <clone-path> [base-branch]
#
# Pre-dispatch hygiene for aif-handoff's per-project clone, so its branch-isolation
# guard does not reject a dispatch with "dirty_worktree". aif's strict_base_update
# PULLS the base but does NOT clean untracked residue left by a prior/failed task;
# this guard does. Safe: stashes (never deletes) any dirt — recoverable via stash.
# Deterministic bash, no new dependency (BFR: project-specific glue).
#
# Origin: 2026-06-01 live-found dirty_worktree block (design §8.3.1).
set -euo pipefail

CLONE="${1:?usage: aif-clone-hygiene.sh <clone-path> [base-branch]}"
BASE="${2:-staging}"

[ -d "$CLONE/.git" ] || { echo "aif-clone-hygiene: not a git clone: $CLONE" >&2; exit 2; }

git -C "$CLONE" fetch --quiet origin "$BASE" || { echo "aif-clone-hygiene: fetch origin $BASE failed" >&2; exit 3; }

if [ -n "$(git -C "$CLONE" status --porcelain)" ]; then
  sha="$(git -C "$CLONE" rev-parse --short HEAD)"
  git -C "$CLONE" stash push -u -m "aif-clone-hygiene auto-stash @${sha}" >/dev/null
  echo "aif-clone-hygiene: stashed dirty worktree (recover: git -C '$CLONE' stash list)"
fi

git -C "$CLONE" checkout --quiet "$BASE"
git -C "$CLONE" pull --ff-only --quiet origin "$BASE"
echo "aif-clone-hygiene: clean — $CLONE on $BASE @ $(git -C "$CLONE" rev-parse --short HEAD)"
