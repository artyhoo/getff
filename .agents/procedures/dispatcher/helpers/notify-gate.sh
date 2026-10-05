#!/usr/bin/env bash
# notify-gate.sh — heartbeat cadence gate for an autonomous /dispatcher run (notification discipline).
#
# 3-tier model: Tier-1 (human-decision / unrecoverable blocker) pings immediately; routine progress is
# SILENT (journal only); a Tier-2 heartbeat fires at most once per HEARTBEAT_SECS so the operator knows
# the loop is alive without per-tick spam.
#
# Answers ONE question per tick: "emit a heartbeat now?"
#   exit 0 + prints "HEARTBEAT" → yes (≥HEARTBEAT_SECS elapsed; stamp updated) → caller emits ONE digest.
#   exit 1 (silent)            → no, stay quiet (caller produces no operator-facing prose).
# Tier-1 bypasses this gate — always surfaced immediately by the caller.
#
# Usage: notify-gate.sh [stamp-file]   (default stamp: $DISPATCHER_STAMP or /tmp/dispatcher-heartbeat)
# Env: HEARTBEAT_SECS (default 1800 = 30min).
set -uo pipefail
STAMP="${1:-${DISPATCHER_STAMP:-/tmp/dispatcher-heartbeat}}"
HEARTBEAT_SECS="${HEARTBEAT_SECS:-1800}"
now=$(date +%s)
last=$(cat "$STAMP" 2>/dev/null || echo 0)
if [ $(( now - last )) -ge "$HEARTBEAT_SECS" ]; then
  echo "$now" > "$STAMP"
  echo "HEARTBEAT"
  exit 0
fi
exit 1
