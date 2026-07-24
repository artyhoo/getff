#!/usr/bin/env bash
# heal.sh — aif-doctor non-interactive heal preflight (PORTABLE, shipped to consumers).
#
# "The dispatcher calls the doctor; the doctor heals." The runtime-bridge dispatcher runs THIS
# via RUNTIME_BRIDGE_PREFLIGHT before a dispatch (env-gated, ship-safe NO-OP when unset, runs
# after dedup / before backend-resolve — packages/runtime-bridge/src/cli/dispatch.ts runPreflight).
# The dispatcher only knows "call the doctor"; the doctor owns WHAT healing means. Today that is
# the Tier-1 reversible base-refresh (aif-doctor SKILL §3.4), applied only when no task is
# in-flight. Grow this entrypoint as new Tier-1 auto-heals are codified.
#
# NON-BLOCKING by contract: always exits 0 — a failed heal warns; the dispatcher proceeds.
#
# Opt-in wiring (consumer, never mandatory — making a companion mandatory is a goal change):
#   export RUNTIME_BRIDGE_PREFLIGHT='bash .claude/skills/aif-doctor/helpers/heal.sh'
#
# Usage: bash heal.sh [branch]                         (branch defaults to staging)
# Env:   RUNTIME_BRIDGE_AIF_URL (default http://localhost:3009)
#        AIF_REFRESH_HELPER     (default: sibling refresh-aif-base.sh)
#
# In-flight interlock (honest source = GET /tasks).
#
# The earlier interlock read `activeTaskCount` from `/agent/status`, which is known to
# under-report (live measurement 2026-07-24: activeTaskCount=0 while 4 tasks were
# genuinely in flight — see docs/meta-factory/research-patches/2026-07-24-autonomous-
# loop-diagnostics.md finding F1, merged in #1129). The lie treated a busy runtime as
# "idle" and yanked the base out from under running workers. We now scan /tasks directly
# and treat any fetch/parse error as BUSY (fail-closed): skipping the heal is NOT the
# same as failing the dispatch (runPreflight warns-and-proceeds regardless —
# packages/runtime-bridge/src/cli/dispatch.ts:74-89).
#
# A task is in-flight when:
#   status ∈ {planning, implementing, review}                              — always
#   status = plan_ready AND paused != true                                 — fail-safe
# All other statuses (backlog, done, verified, cancelled, paused-plan_ready)
# are NOT in-flight.
set -uo pipefail            # deliberately NOT -e: never abort the dispatcher
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
BRANCH="${1:-staging}"
AIF_URL="${RUNTIME_BRIDGE_AIF_URL:-http://localhost:3009}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || echo .)"

# ── Fetch /tasks. Any curl error OR empty body → fail-closed (BUSY). ───────────────
TASKS_JSON="$(curl -s -m5 "$AIF_URL/tasks" 2>/dev/null)" || {
  echo "[aif-doctor heal] /tasks curl exit non-zero — skip base-refresh (fail-closed)"
  exit 0
}
if [ -z "$TASKS_JSON" ]; then
  echo "[aif-doctor heal] /tasks returned empty body — skip base-refresh (fail-closed)"
  exit 0
fi

# ── Parse. Validate body is a JSON array, then count in-flight tasks. ──────────────
# TASKS_COMPACT is reused by the no-jq branch (whitespace-stripped for simple grep).
TASKS_COMPACT="$(printf '%s' "$TASKS_JSON" | tr -d '[:space:]')"
case "$TASKS_COMPACT" in
  '[]') # Empty array — genuinely idle.
    INFLIGHT_COUNT=0
    ;;
  '['*) # Non-empty array — parse with jq when available, else conservative grep.
    if command -v jq >/dev/null 2>&1; then
      RAW_COUNT="$(printf '%s' "$TASKS_JSON" | jq -r '
        [.[] | select(
          .status == "planning" or
          .status == "implementing" or
          .status == "review" or
          (.status == "plan_ready" and ((.paused // false) | not))
        )] | length' 2>/dev/null)" || RAW_COUNT=""
      # Integer-validate. Non-numeric / null / empty → fail-closed (T-HEAL-B).
      case "$RAW_COUNT" in
        ''|*[!0-9]*)
          echo "[aif-doctor heal] /tasks returned JSON but jq produced non-integer count ('$RAW_COUNT') — skip base-refresh (fail-closed)"
          exit 0
          ;;
      esac
      INFLIGHT_COUNT=$RAW_COUNT
    else
      # No-jq fallback: conservative grep-based count. Whitespace stripped above so
      # JSON keys/values are tightly packed (whitespace is not significant inside
      # string values for these keys).
      CERTAIN_INFLIGHT=0
      for s in planning implementing review; do
        n="$(printf '%s' "$TASKS_COMPACT" | grep -oE "\"status\":\"$s\"" | wc -l)"
        CERTAIN_INFLIGHT=$((CERTAIN_INFLIGHT + n))
      done
      PLAN_READY_TOTAL="$(printf '%s' "$TASKS_COMPACT" | grep -oE '"status":"plan_ready"' | wc -l)"
      # plan_ready is in-flight UNLESS its containing {...} object also carries
      # paused:true. Both field orders covered. A non-match (nested braces,
      # unusual formatting) leaves PLAN_READY_PAUSED=0, treating ALL plan_ready
      # as in-flight — the fail-safe direction per kickoff §2.
      PLAN_READY_PAUSED="$(printf '%s' "$TASKS_COMPACT" \
        | grep -oE '\{[^{}]*"status":"plan_ready"[^{}]*"paused":true[^{}]*\}|\{[^{}]*"paused":true[^{}]*"status":"plan_ready"[^{}]*\}' \
        | wc -l)"
      INFLIGHT_COUNT=$((CERTAIN_INFLIGHT + PLAN_READY_TOTAL - PLAN_READY_PAUSED))
    fi
    ;;
  *) # Body is non-empty but does not begin with `[` — malformed.
    echo "[aif-doctor heal] /tasks returned non-array body (length=${#TASKS_JSON}, first-byte='$(printf '%s' "$TASKS_COMPACT" | cut -c1)') — skip base-refresh (fail-closed)"
    exit 0
    ;;
esac

# ── Decision. ──────────────────────────────────────────────────────────────────────
if [ "$INFLIGHT_COUNT" -gt 0 ]; then
  echo "[aif-doctor heal] $INFLIGHT_COUNT task(s) in-flight — skip base-refresh"
  exit 0
fi

REFRESH="${AIF_REFRESH_HELPER:-$SCRIPT_DIR/refresh-aif-base.sh}"
if [ -f "$REFRESH" ]; then
  bash "$REFRESH" "$BRANCH" || echo "[aif-doctor heal] base-refresh non-fatal failure — dispatch proceeds"
else
  echo "[aif-doctor heal] refresh helper missing ($REFRESH) — skip"
fi
exit 0
