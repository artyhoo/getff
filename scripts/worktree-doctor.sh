#!/usr/bin/env bash
# worktree-doctor.sh — report (and optionally fix) node_modules provisioning across every
# registered git worktree of this repository.
#
# Usage: bash scripts/worktree-doctor.sh [--fix] [<primary-dir>]
#
#   (no flag)  report only; exit 1 if any worktree is unprovisioned.
#   --fix      provision every fixable worktree; exit 1 only if something could not be fixed.
#
# This script once carried a second arm — a local-shadow `claudeMdExcludes` sweep (arch-v2
# S-E P2b). It was removed with the rest of P2b: the client merges array settings across
# settings files (union + dedupe; `fallbackModel` is the sole replace exception), so a local
# list can only ADD excludes and the sweep's subset finding was unreachable by construction.
#
# This is the operator-facing sweep. The per-worktree logic lives in worktree-node-modules.sh
# (single source of truth) — this script only enumerates and reports, so the doctor and the
# create-time hooks can never drift apart in what "provisioned" means.
#
# WHY A SWEEP IS NEEDED AT ALL:
# .claude/hooks/worktree-setup.sh provisions at CREATE time, but it only reaches worktrees
# born through `claude -w <name>` with the WorktreeCreate hook registered. Worktrees created
# any other way — the desktop app, an agent container, `git worktree add` by hand — never run
# it. A live census on 2026-07-23 found 63 of 125 registered worktrees unprovisioned.
#
# @dual-pair: worktree-create-setup

set -uo pipefail

FIX=0
if [ "${1:-}" = "--fix" ]; then FIX=1; shift; fi

PRIMARY_DIR="${1:-$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)}"
PRIMARY_DIR="${PRIMARY_DIR%/.git}"
if [ -z "$PRIMARY_DIR" ] || [ ! -d "$PRIMARY_DIR" ]; then
  printf '⚠ worktree-doctor: cannot resolve the primary checkout (run inside the repo)\n' >&2
  exit 2
fi

# Resolve the helper from THIS script's own directory, not from $PRIMARY_DIR: the two ship as
# one pair, and a checkout running the doctor must run its OWN helper. (Resolving via
# $PRIMARY_DIR would make a worktree silently execute the primary's older copy — the same
# self-resolution rule the orchestration skills' helpers follow,
# .claude/rules/dual-implementation-discipline.md §3.)
HELPER="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/worktree-node-modules.sh"
if [ ! -f "$HELPER" ]; then
  printf '⚠ worktree-doctor: %s not found\n' "$HELPER" >&2
  exit 2
fi

total=0; ok=0; fixed=0; broken=0

while IFS= read -r wt; do
  [ -n "$wt" ] || continue
  [ -d "$wt" ] || continue
  total=$((total + 1))

  if bash "$HELPER" --check "$wt" "$PRIMARY_DIR" >/dev/null 2>&1; then
    ok=$((ok + 1))
    continue
  fi

  if [ "$FIX" -eq 1 ]; then
    if bash "$HELPER" --apply "$wt" "$PRIMARY_DIR" >/dev/null 2>&1; then
      fixed=$((fixed + 1))
      printf 'FIXED    %s\n' "$wt"
    else
      broken=$((broken + 1))
      printf 'UNFIXED  %s\n' "$wt"
    fi
  else
    broken=$((broken + 1))
    printf 'MISSING  %s\n' "$wt"
  fi
done <<EOF
$(git -C "$PRIMARY_DIR" worktree list --porcelain 2>/dev/null | awk '/^worktree /{print substr($0, 10)}')
EOF

printf '\n%d worktrees: %d provisioned, %d fixed, %d outstanding\n' "$total" "$ok" "$fixed" "$broken"

if [ "$broken" -gt 0 ]; then
  [ "$FIX" -eq 1 ] || printf 'Run `bash scripts/worktree-doctor.sh --fix` to provision them.\n'
  exit 1
fi
exit 0
