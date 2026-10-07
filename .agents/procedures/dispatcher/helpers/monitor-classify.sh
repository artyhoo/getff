#!/usr/bin/env bash
# monitor-classify.sh — classify a single GET /tasks/:id poll response.
# Input:  TASK_JSON env var (JSON task object from the aif API)
# Output: one of  RUNNING:<status>  DONE:<status>  PARKED:<status>  ERROR:<msg>
# Exit:   always 0 — caller branches on stdout, not exit code.
#
# Harness-safe: no foreground sleep, no compound ;-chains.
# Tested by: packages/core/skills/dispatcher/monitor.test.ts

set -euo pipefail

if [[ -z "${TASK_JSON:-}" ]]; then
  echo "ERROR:TASK_JSON not set"
  exit 0
fi

if ! command -v jq &>/dev/null; then
  echo "ERROR:jq required"
  exit 0
fi

status=$(printf '%s' "$TASK_JSON" | jq -r '.status // "unknown"')
is_parked=$(printf '%s' "$TASK_JSON" | jq -r '
  if (.isParked == true)
    or (.blockedReason != null and .blockedReason != "")
    or (.status == "blocked_external")
    or (.manualReviewRequired == true)
  then "true" else "false" end')

# Parked check takes priority over status branches (a task can be implementing AND parked).
if [[ "$is_parked" == "true" ]]; then
  echo "PARKED:${status}"
  exit 0
fi

# Running statuses mirror aifWsStatus.ts mapAifStatusToTaskStatus → 'running'
# (packages/runtime-bridge/src/aifWsStatus.ts): backlog, planning, plan_ready,
# implementing, review are all non-terminal — plan_ready/review auto-advance, they
# are NOT terminal or parked. blocked_external is caught by the is_parked check above.
case "$status" in
  implementing|planning|backlog|plan_ready|review) echo "RUNNING:${status}" ;;
  done|verified)                                   echo "DONE:${status}" ;;
  *)                                               echo "UNKNOWN:${status}" ;;
esac
