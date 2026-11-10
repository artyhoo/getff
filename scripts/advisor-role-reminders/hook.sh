#!/usr/bin/env bash
# @dual-pair: advisor-role-reminders — reminders.py explicit preparation/read counterpart.
# Project-local only; no installer/plugin delivery. Shared emitter owns JSON escaping.
# Phase/operation come from controller enrollment, never hook prompt/tool_input.
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
REMINDER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REMINDER_ROOT="$(cd "$REMINDER_DIR/../.." && pwd)"
source "$REMINDER_ROOT/.claude/hooks/lib/hook-emit.sh"
REMINDER_BINDING="$REMINDER_ROOT/.advisor-role-reminders/enrollment.json"
REMINDER_STATE="$REMINDER_ROOT/.advisor-role-reminders/ledger.json"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --binding) REMINDER_BINDING="$2"; shift 2 ;;
    --state) REMINDER_STATE="$2"; shift 2 ;;
    *) exit 0 ;;
  esac
done
command -v python3 >/dev/null 2>&1 || exit 0
command -v jq >/dev/null 2>&1 || exit 0
REMINDER_RESULT="$(python3 "$REMINDER_DIR/reminders.py" --hook --binding "$REMINDER_BINDING" --state "$REMINDER_STATE")" || exit 0
[[ -n "$REMINDER_RESULT" ]] || exit 0
REMINDER_EVENT="$(printf '%s' "$REMINDER_RESULT" | jq -r .event)"
REMINDER_TEXT="$(printf '%s' "$REMINDER_RESULT" | jq -r .context)"
printf '{"hookSpecificOutput":{"hookEventName":"%s","additionalContext":"%s"}}\n' \
  "$REMINDER_EVENT" "$(_json_escape "$REMINDER_TEXT")"
