#!/usr/bin/env bash
# memory-sweep.sh — list agent-memory entries that mention a kickoff's feature keywords.
#
# Orchestrator Phase -1 pre-flight step 0 (.claude/skills/orchestrator/references/phase-minus-1.md).
# A Phase -1 cold reviewer is spawned without the orchestrator's agent memory, so a constraint
# that lives only in memory (a maintainer correction from a parallel session) is invisible to
# it. The orchestrator runs this sweep BEFORE dispatching the reviewer, reads every hit, and
# folds the binding constraints into the kickoff or the reviewer prompt.
#
# Session-run only: the memory store is user-scope and lives outside the repo and outside CI
# by construction (.claude/rules/memory-codification.md §1).
#
# Usage: bash .claude/skills/orchestrator/helpers/memory-sweep.sh <keyword> [<keyword>...]
#   Keywords are OR-ed, case-insensitive, fixed strings (a path like harvest.ts is literal).
# Env:
#   MEMORY_DIR         read this directory instead of the derived store
#   CLAUDE_CONFIG_DIR  Claude Code config root (default ~/.claude)
# Store derivation: <config>/projects/<slug>/memory, where <slug> is the PRIMARY checkout path
# with every '/' and '.' replaced by '-' — memory is filed under the project a session was
# opened in, and a linked worktree shares its primary's store.
# Output (stdout): one block per matching entry — «<file> — <description>» plus the first hit
# line — then the summary line «MEMORY-SWEEP: N match(es) for: <keywords> in <dir>».
# MEMORY.md and index_*.md are index files, not memories, and are skipped.
# Exit: 0 the sweep ran (any N) · 2 MEMORY-SWEEP-INCOMPLETE (store missing — an unasked
# question is never a clean answer) · 64 usage.
set -uo pipefail

if [ "$#" -eq 0 ]; then
  echo "usage: bash .claude/skills/orchestrator/helpers/memory-sweep.sh <keyword> [<keyword>...]" >&2
  exit 64
fi

if [ -n "${MEMORY_DIR:-}" ]; then
  store="$MEMORY_DIR"
else
  common="$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)"
  if [ -z "$common" ]; then
    echo "MEMORY-SWEEP-INCOMPLETE: not inside a git checkout and MEMORY_DIR is unset" >&2
    exit 2
  fi
  primary="$(cd "${common%/.git}" 2>/dev/null && pwd -P)"
  slug="$(printf '%s' "$primary" | sed 's#[/.]#-#g')"
  store="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/projects/$slug/memory"
fi

if [ ! -d "$store" ]; then
  echo "MEMORY-SWEEP-INCOMPLETE: no memory store at $store" >&2
  exit 2
fi

patterns=()
for kw in "$@"; do patterns+=(-e "$kw"); done

count=0
for f in "$store"/*.md; do
  [ -f "$f" ] || continue
  base="$(basename "$f")"
  case "$base" in MEMORY.md | index_*.md) continue ;; esac
  hit="$(grep -i -F -m1 "${patterns[@]}" "$f" 2>/dev/null || true)"
  [ -n "$hit" ] || continue
  desc="$(sed -n 's/^description:[[:space:]]*//p' "$f" | head -1)"
  printf '%s — %s\n  hit: %s\n' "$base" "${desc:-(no description)}" "$(printf '%s' "$hit" | cut -c1-160)"
  count=$((count + 1))
done

joined="$(IFS='|'; printf '%s' "$*")"
if [ "$count" -eq 1 ]; then noun=match; else noun=matches; fi
echo "MEMORY-SWEEP: $count $noun for: $joined in $store"
exit 0
