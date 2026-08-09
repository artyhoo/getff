#!/usr/bin/env bash
# render-status.sh — read-only, sectioned pipeline status (A5).
#
# > Class: C — prose-only; companion test at packages/core/hooks/render-status.test.ts (AC-4).
# > Authoritative for: composing 3 live-brick sections + suggested-next tail.
# > NOT authoritative for: the bricks themselves (bridge REST, questions.ts, gh pr list).
#
# Usage: render-status.sh
#   stdout: three sections + suggested-next tail. One-shot read + print.
#   exit 0: always (even when bricks are unreachable — graceful degradation).
#
# NOT a dashboard. No persistent state, no TUI, no refresh-loop.
#
# @dual-pair: meta-orchestrator-mode-overrides

set -euo pipefail

BRIDGE_URL="${RUNTIME_BRIDGE_AIF_URL:-http://localhost:3009}"

# Trace logging (suppressed unless MO_TRACE_STATUS=1).
trace() { [ "${MO_TRACE_STATUS:-0}" = "1" ] && printf '[render-status] %s\n' "$*" >&2 || true; }

# ─── Section 1: In-factory (bridge REST) ─────────────────────────────────────
bridge_ok=false
task_count=0
health_line=""
tasks_json="[]"

if command -v curl >/dev/null 2>&1; then
  health_line="$(curl -s --connect-timeout 3 "$BRIDGE_URL/health" 2>/dev/null || true)"
  if [ -n "$health_line" ]; then
    bridge_ok=true
    tasks_json="$(curl -s --connect-timeout 3 "$BRIDGE_URL/tasks" 2>/dev/null || echo '[]')"
    if command -v jq >/dev/null 2>&1; then
      task_count="$(printf '%s' "$tasks_json" | jq 'length' 2>/dev/null || echo 0)"
    fi
  fi
fi

trace "bridge=$bridge_ok tasks=$task_count"

echo "## Pipeline status"
echo ""

if $bridge_ok; then
  echo "### In-factory"
  if [ "$task_count" -gt 0 ] 2>/dev/null; then
    echo "$tasks_json" | jq -r '.[] | "  - \(.title // .id) [\(.status)]"' 2>/dev/null \
      || echo "  ($task_count tasks — bridge reachable, JSON parse failed)"
    echo ""
  else
    echo "  (no running aif tasks)"
    echo ""
  fi
else
  echo "### In-factory"
  echo "  (bridge unreachable at $BRIDGE_URL)"
  echo ""
fi

# ─── Section 2: Parked questions ─────────────────────────────────────────────
parked_count=0
parked_output=""

# Try questions.ts first (richest source); fall back to direct /tasks query.
if [ -f "packages/runtime-bridge/src/cli/questions.ts" ] && command -v npx >/dev/null 2>&1; then
  parked_output="$(npx tsx packages/runtime-bridge/src/cli/questions.ts --json 2>/dev/null || true)"
  if [ -n "$parked_output" ] && command -v jq >/dev/null 2>&1; then
    parked_count="$(printf '%s' "$parked_output" | jq 'length' 2>/dev/null || echo 0)"
  fi
elif $bridge_ok && command -v jq >/dev/null 2>&1; then
  # Fallback: filter /tasks for parked ones (manualReviewRequired or blocked_external).
  parked_output="$(printf '%s' "$tasks_json" | jq '[.[] | select(.manualReviewRequired == true or .status == "blocked_external" or (.blockedReason // "" != ""))]' 2>/dev/null || echo '[]')"
  parked_count="$(printf '%s' "$parked_output" | jq 'length' 2>/dev/null || echo 0)"
fi

trace "parked=$parked_count"

echo "### Parked questions"
if [ "$parked_count" -gt 0 ] 2>/dev/null; then
  printf '%s' "$parked_output" | jq -r '.[] | "  - \(.title // .id): \(.blockedReason // .reviewComments // "manual review required")"' 2>/dev/null \
    || echo "  ($parked_count parked — see questions.ts for details)"
  echo ""
else
  echo "  (no parked questions)"
  echo ""
fi

# ─── Section 3: Ready-to-harvest + PR state ──────────────────────────────────
pr_count=0
prs_json=""

if command -v gh >/dev/null 2>&1; then
  prs_json="$(gh pr list --json number,title,headRefName,baseRefName,mergeable,state --limit 20 2>/dev/null || echo '[]')"
  if command -v jq >/dev/null 2>&1; then
    pr_count="$(printf '%s' "$prs_json" | jq 'length' 2>/dev/null || echo 0)"
  fi
fi

trace "prs=$pr_count"

echo "### Ready-to-harvest + PR state"
if [ "$pr_count" -gt 0 ] 2>/dev/null; then
  # The `→` and the `mergeable=` label are LITERAL text and must sit outside the \(…)
  # interpolations. An earlier revision had them inside, which is a jq syntax error
  # (`jq: error: syntax error, unexpected INVALID_CHARACTER`, exit 3) — and the
  # `2>/dev/null || echo` fallback below swallowed it, so this whole section silently
  # rendered the fallback line instead of the PR list on every run.
  printf '%s' "$prs_json" | jq -r '.[] | "  - #\(.number) \(.title) [\(.headRefName) → \(.baseRefName), mergeable=\(.mergeable // "unknown")]"' 2>/dev/null \
    || echo "  ($pr_count open PRs — gh pr list for details)"
  echo ""
else
  echo "  (no open PRs)"
  echo ""
fi

# ─── Suggested-next tail (git-status shape; clig.dev «suggest what to run next») ─
# 1–3 lines based on what is available. Paste-able shell strings.
echo "### Suggested next"
suggestions=0

# Priority 1: a mergeable PR ready to harvest.
if [ "$pr_count" -gt 0 ] 2>/dev/null && [ -n "$prs_json" ] && command -v jq >/dev/null 2>&1; then
  ready_pr="$(printf '%s' "$prs_json" | jq -r '[.[] | select(.mergeable == "MERGEABLE")][0].number // empty' 2>/dev/null || true)"
  if [ -n "$ready_pr" ]; then
    echo "→ next: gh pr merge --squash $ready_pr  (a PR is mergeable)"
    suggestions=$((suggestions + 1))
  fi
fi

# Priority 2: a parked question needing an answer.
if [ "$parked_count" -gt 0 ] 2>/dev/null; then
  first_parked="$(printf '%s' "$parked_output" | jq -r '.[0].id // empty' 2>/dev/null || true)"
  if [ -n "$first_parked" ]; then
    echo "→ next: answer parked question on task $first_parked"
    suggestions=$((suggestions + 1))
  fi
fi

# Priority 3: factory idle → dispatch.
if ! $bridge_ok || [ "$task_count" -eq 0 ] 2>/dev/null; then
  if [ "$suggestions" -lt 2 ]; then
    echo "→ next: /pipeline  (in-factory empty — review priorities and dispatch)"
    suggestions=$((suggestions + 1))
  fi
fi

if [ "$suggestions" -eq 0 ]; then
  echo "→ next: /pipeline  (all bricks green — continue current work)"
fi

echo ""
exit 0
