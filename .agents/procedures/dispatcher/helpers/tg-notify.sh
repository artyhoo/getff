#!/usr/bin/env bash
# tg-notify.sh — filtered Telegram sender for an autonomous /dispatcher run (Option B notification model).
#
# Why: aif-handoff's own notifier (packages/agent/src/notifier.ts) fires a TG message on EVERY task
# status-change (planning/implementing/review/…) and has no verbosity knob. To get "notify ONLY when a
# task is done / stalled / has a question", silence aif's raw channel (unset TELEGRAM_BOT_TOKEN in the
# container, applied on a restart between runs) and let the dispatcher send exactly these events here.
# The operator does NOT go dark — they still get the important notifications, just filtered + deduped.
#
# Sends ONLY for the allowed event classes; anything else is dropped (the filter).
# Usage: tg-notify.sh <event> <message>
#   <event> ∈ { done | stalled | question | blocker }   (others → dropped, exit 0 silently)
# Env: TELEGRAM_BOT_TOKEN, TELEGRAM_USER_ID (same creds aif uses). Returns silently if unset.
set -uo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
EVENT="${1:-}"; MSG="${2:-}"
TOKEN="${TELEGRAM_BOT_TOKEN:-}"; CHAT="${TELEGRAM_USER_ID:-}"
[ -z "$TOKEN" ] || [ -z "$CHAT" ] && { echo "tg-notify: no TELEGRAM creds — skip"; exit 0; }

case "$EVENT" in
  done|stalled|question|blocker) : ;;                 # allowed — send
  *) echo "tg-notify: event '$EVENT' filtered out (not done/stalled/question/blocker)"; exit 0 ;;
esac

icon=""
case "$EVENT" in
  done) icon="✅" ;; stalled) icon="⚠️" ;; question) icon="❓" ;; blocker) icon="🛑" ;;
esac

curl -s -m10 "https://api.telegram.org/bot${TOKEN}/sendMessage" \
  --data-urlencode "chat_id=${CHAT}" \
  --data-urlencode "text=${icon} ${MSG}" \
  -o /dev/null -w "tg-notify: %{http_code}\n" 2>&1 || echo "tg-notify: send failed (best-effort)"
