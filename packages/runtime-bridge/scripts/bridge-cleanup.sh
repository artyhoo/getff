#!/usr/bin/env bash
# bridge-cleanup.sh — nuke the test/probe junk the bridge accrues each session.
#
# WHY (qloop-ux-probe 2026-06-01): probe/smoke runs leave orphan aif tasks,
# /tmp ManualBackend kickoffs, and dedup-store cruft behind every session. This
# is the one-command sweep so it stops piling up. It deletes ONLY clearly-test
# artefacts (title matches the test allowlist); real work is never touched.
#
# Targets (all opt-out via flags):
#   - aif tasks whose title matches the TEST allowlist (UXPROBE / smoke / probe)
#   - /tmp/runtime-bridge-*.md  (ManualBackend kickoffs) older than KEEP_DAYS
#   - /tmp/runtime-bridge-dedup.jsonl.bak-*  (manual backups)
#   - container git junk ALREADY MERGED into origin/staging: retained per-task
#     worktrees + their feature/* branches (§4). Enabling per-task worktrees
#     (parallel_enabled, research-patch 2026-06-01-aif-task-isolation.md §2.1)
#     makes aif RETAIN worktrees post-terminal — this section is the standing
#     sweep so they self-clean, completing the #359 "no manual/AI sweep" principle.
#
# It does NOT touch: the live dedup store, UNMERGED container git state (unmerged
# branches/worktrees are PRESERVED — real in-flight work; a container stash is
# REPORTED, never dropped — that is the operator's git), real tasks. §4 removes
# ONLY branches/worktrees merged into origin/staging (their work is in the trunk),
# double-guarded by `git branch --merged` filtering + `git branch -d` (which itself
# refuses to delete an unmerged branch). This is operator/co-located tooling
# (docker exec); a portable fix is upstream auto-removal of retained worktrees.
#
# Usage: bash bridge-cleanup.sh [--dry-run]
set -uo pipefail

AIF_URL="${RUNTIME_BRIDGE_AIF_URL:-http://localhost:3009}"
# Title regex for DELETABLE test tasks. Extend via env for new probe prefixes.
TEST_TASK_RE="${RUNTIME_BRIDGE_TEST_TASK_RE:-^UXPROBE:|^qloop-ux-probe$|runtime-bridge-smoke|^PROBE:}"
KEEP_DAYS="${RUNTIME_BRIDGE_KEEP_DAYS:-1}"
DRY=0; [[ "${1:-}" == "--dry-run" ]] && DRY=1

note() { printf '  %s\n' "$*"; }
act()  { if [[ "$DRY" -eq 1 ]]; then printf '  [dry-run] would %s\n' "$*"; else printf '  %s\n' "$*"; fi; }

printf '=== bridge-cleanup%s ===\n' "$([[ $DRY -eq 1 ]] && echo ' (dry-run)')"

# ── 1. Delete test/probe aif tasks ───────────────────────────────────────────
printf '\n-- aif test tasks (title ~ /%s/) --\n' "$TEST_TASK_RE"
ids=$(curl -s -m6 "$AIF_URL/tasks" 2>/dev/null \
  | TEST_RE="$TEST_TASK_RE" python3 -c 'import sys,json,os,re
rx=re.compile(os.environ["TEST_RE"])
try: ts=json.load(sys.stdin)
except Exception: ts=[]
[print(t["id"]) for t in ts if rx.search(t.get("title","") or "")]' 2>/dev/null)
if [[ -z "$ids" ]]; then
  note "none"
else
  for id in $ids; do
    if [[ "$DRY" -eq 1 ]]; then act "DELETE task $id"; else
      code=$(curl -s -m6 -o /dev/null -w '%{http_code}' -X DELETE "$AIF_URL/tasks/$id")
      printf '  deleted %s → HTTP %s\n' "$id" "$code"
    fi
  done
fi

# ── 2. Old /tmp ManualBackend kickoffs + dedup backups ───────────────────────
printf '\n-- /tmp bridge files (older than %s day(s)) --\n' "$KEEP_DAYS"
found=0
while IFS= read -r f; do
  found=1; act "rm $f"; [[ "$DRY" -eq 0 ]] && rm -f "$f"
done < <(find /tmp -maxdepth 1 -name 'runtime-bridge-*.md' -mtime "+$KEEP_DAYS" 2>/dev/null)
while IFS= read -r f; do
  found=1; act "rm $f"; [[ "$DRY" -eq 0 ]] && rm -f "$f"
done < <(find /tmp -maxdepth 1 -name 'runtime-bridge-dedup.jsonl.bak-*' 2>/dev/null)
[[ "$found" -eq 0 ]] && note "none"

# ── 3. Report container stash (NOT dropped — operator's git) ─────────────────
printf '\n-- container stash (reported, never auto-dropped) --\n'
agent=""
# Which container, on which docker context: the shared resolver used by the aif-doctor helpers and
# the dispatcher's in-flight probe (.claude/skills/aif-doctor/helpers/aif-agent-target.sh). Only an
# UNAMBIGUOUS candidate is used; a candidate on another docker context is reached via DOCKER_CONTEXT.
_aif_agent_target="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." 2>/dev/null && pwd)/.claude/skills/aif-doctor/helpers/aif-agent-target.sh"
if [[ -f "$_aif_agent_target" ]]; then
  # shellcheck disable=SC1090  # path resolved at runtime from this script's location
  . "$_aif_agent_target"
  if aif_agent_resolve; then
    agent="$AIF_AGENT_NAME"
    [[ -n "$AIF_AGENT_CONTEXT" ]] && export DOCKER_CONTEXT="$AIF_AGENT_CONTEXT"
  else
    note "$AIF_AGENT_REASON"
  fi
else
  agent="$(docker ps --filter 'name=agent' --format '{{.Names}}' 2>/dev/null | grep -i aif | head -1)"
fi
if [[ -n "$agent" ]]; then
  st="$(docker exec "$agent" sh -c 'cd /home/www/rules-as-tests-aif && git stash list' 2>/dev/null)"
  if [[ -n "$st" ]]; then
    printf '%s\n' "$st" | sed 's/^/    /'
    note "→ drop yourself if superseded: docker exec $agent sh -c 'cd /home/www/rules-as-tests-aif && git stash drop'"
  else note "none"; fi
else note "no agent container"; fi

# ── 4. Prune MERGED container git junk (retained worktrees + feature branches) ─
# SAFE BY CONSTRUCTION: only branches/worktrees merged into origin/staging are
# removed (their work is in the trunk). Unmerged is NEVER touched — `git branch
# --merged` filters to merged only, and `git branch -d` itself refuses to delete
# an unmerged branch (belt + braces). Enabling per-task worktrees makes aif retain
# them post-terminal (research-patch 2026-06-01-aif-task-isolation.md §2.1); this
# is the standing sweep that keeps them from piling up.
printf '\n-- container git: prune MERGED worktrees + feature branches (unmerged preserved) --\n'
# Live-task guard (2026-06-02, won't-break-parallel-sessions): §4 runs git fetch / worktree
# prune / branch -d in the SHARED .git, which a running task's ref-updating git ops also touch
# (shared ref + packed-refs locks; amplified by parallel_enabled keeping multiple tasks active).
# A collision yields "cannot lock ref" and can fail a live task's git step. So skip §4 entirely
# while any non-terminal task exists. Deterministic, no AI. Fail-open (count unknown → 0 → proceed):
# §4 is already safe-by-construction (merged-only), so this guard is defence-in-depth, not the
# primary safety — worst case of a false 0 is a transient lock retry, never corruption or data loss.
live=$(curl -s -m6 "$AIF_URL/tasks" 2>/dev/null | python3 -c 'import sys,json
try: ts=json.load(sys.stdin)
except Exception: ts=[]
TERM={"done","verified","cancelled"}
print(sum(1 for t in ts if (t.get("status") or "") not in TERM))' 2>/dev/null)
[[ "$live" =~ ^[0-9]+$ ]] || live=0
if [[ "$live" -gt 0 ]]; then
  note "skipped — $live live (non-terminal) aif task(s) running; not touching shared git mid-run (avoids ref-lock contention with parallel sessions). Re-run when the queue is idle."
elif [[ -n "$agent" ]]; then
  # -i forwards the heredoc on stdin to `sh -s` (without it docker exec discards stdin).
  docker exec -i -e DRY="$DRY" "$agent" sh -s <<'CONTAINER_SWEEP'
set -u
cd /home/www/rules-as-tests-aif 2>/dev/null || { echo "  (checkout not found)"; exit 0; }
git fetch origin staging -q 2>/dev/null || true
git worktree prune
cur=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
main_wt=$(git rev-parse --show-toplevel 2>/dev/null)
# 1) retained non-main worktrees whose branch is merged → remove (unmerged kept)
git worktree list --porcelain 2>/dev/null \
  | awk '/^worktree /{p=$2} /^branch /{print p"\t"$2}' \
  | while IFS="$(printf '\t')" read -r wpath wref; do
      [ "$wpath" = "$main_wt" ] && continue
      br=${wref#refs/heads/}
      if [ -n "$(git branch --merged origin/staging --list "$br" 2>/dev/null)" ]; then
        if [ "$DRY" = 1 ]; then echo "  [dry-run] would remove worktree $wpath ($br merged)"
        else git worktree remove "$wpath" 2>/dev/null && echo "  removed worktree $wpath ($br)"; fi
      else echo "  keep worktree $wpath ($br — unmerged)"; fi
    done
# 2) merged feature/* branches → delete (-d refuses unmerged; skip the checked-out one)
git branch --merged origin/staging --format='%(refname:short)' 2>/dev/null \
  | grep '^feature/' \
  | while read -r b; do
      [ "$b" = "$cur" ] && { echo "  skip current $b"; continue; }
      if [ "$DRY" = 1 ]; then echo "  [dry-run] would delete merged branch $b"
      else git branch -d "$b" >/dev/null 2>&1 && echo "  deleted merged branch $b"; fi
    done
CONTAINER_SWEEP
else note "no agent container"; fi

printf '\n=== done ===\n'
