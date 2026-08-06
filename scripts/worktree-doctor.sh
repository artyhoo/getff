#!/usr/bin/env bash
# worktree-doctor.sh — report (and optionally fix) node_modules provisioning across every
# registered git worktree of this repository.
#
# Usage: bash scripts/worktree-doctor.sh [--fix] [<primary-dir>]
#
#   (no flag)  report only; exit 1 if any worktree is unprovisioned.
#   --fix      provision every fixable worktree; exit 1 only if something could not be fixed.
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

# ── arm 2: local-shadow claudeMdExcludes sweep (arch-v2 S-E P2b) ───────────────
# The pre-push section `local-claudemd-shadow` only ever sees the ONE worktree you
# push from. A worktree whose gitignored .claude/settings.local.json defines a
# claudeMdExcludes list that is a strict SUBSET of the project list silently drops
# excludes for every session opened there — and, because the file is gitignored and
# per-worktree, nothing else in the repo can see it. This arm is the sweep.
#
# It does NOT reimplement the check (that would be `#sync-by-copy-paste`,
# .claude/rules/dual-implementation-discipline.md §8): it invokes the section
# through its existing PREPUSH_ONLY seam. pre-push.ts derives REPO_ROOT from its
# OWN location, so each worktree must run ITS OWN copy — the same self-resolution
# rule this script already follows for $HELPER.
#
# A worktree that cannot run the check is announced LOUDLY as DID NOT RUN, never
# counted as clean (the silent-inert-hook class, aif-doctor SKILL §3.6).
shadow_checked=0; shadow_bad=0; shadow_skipped=0

while IFS= read -r wt; do
  [ -n "$wt" ] || continue
  [ -d "$wt" ] || continue
  # No local overlay → nothing to shadow. Not a skip: there is genuinely no risk.
  [ -f "$wt/.claude/settings.local.json" ] || continue

  hook="$wt/packages/core/hooks/pre-push.ts"
  if [ ! -f "$hook" ] || [ ! -d "$wt/node_modules" ]; then
    shadow_skipped=$((shadow_skipped + 1))
    printf 'SHADOW?  %s — DID NOT RUN (no %s)\n' \
      "$wt" "$([ -f "$hook" ] || echo 'pre-push.ts'; [ -d "$wt/node_modules" ] || echo 'node_modules')"
    continue
  fi

  shadow_checked=$((shadow_checked + 1))
  if out="$(cd "$wt" && PREPUSH_ONLY=local-claudemd-shadow npx tsx "$hook" 2>&1)"; then
    :
  else
    shadow_bad=$((shadow_bad + 1))
    printf 'SHADOW   %s\n%s\n' "$wt" "$out"
  fi
done <<EOF
$(git -C "$PRIMARY_DIR" worktree list --porcelain 2>/dev/null | awk '/^worktree /{print substr($0, 10)}')
EOF

if [ "$shadow_checked" -gt 0 ] || [ "$shadow_skipped" -gt 0 ]; then
  printf 'local-shadow sweep: %d checked, %d shadowing, %d could not run\n' \
    "$shadow_checked" "$shadow_bad" "$shadow_skipped"
fi

if [ "$broken" -gt 0 ]; then
  [ "$FIX" -eq 1 ] || printf 'Run `bash scripts/worktree-doctor.sh --fix` to provision them.\n'
  exit 1
fi
[ "$shadow_bad" -eq 0 ] || exit 1
exit 0
