#!/usr/bin/env bash
# measure.test.sh — the vendored measurement scripts must produce the hand-counted numbers on a
# fixture whose contents are known. Without it a vendored script is a black box whose only
# validation is "it printed something" (#hope-as-gate, .claude/rules/attention-is-not-a-mechanism.md §2).
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
FIX="$DIR/fixtures/projects"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
command -v python3 >/dev/null 2>&1 || { echo "  · SKIP — python3 unavailable"; echo "PASS=0 FAIL=0"; exit 0; }

row()    { printf '%s\n' "$1" | awk -v k="$2:" '$1==k {print $2}'; }
rowval() { printf '%s\n' "$1" | sed -n "s/^$2: //p"; }
expect() { if [ "$2" = "$3" ]; then ok "$1 = $2"; else bad "$1: expected $2, got $3"; fi; }

echo "▶ measure-recap-len.py"
OUT=$(python3 "$DIR/measure-recap-len.py" --root "$FIX" --glob '-Users-art-code-rules-as-tests-aif*' 2>&1)
expect "transcripts_scanned"  2 "$(row "$OUT" transcripts_scanned)"
expect "sessions_with_block"  1 "$(row "$OUT" sessions_with_block)"
expect "blocks"               2 "$(row "$OUT" blocks)"
expect "block_lines_max"      3 "$(row "$OUT" block_lines_max)"
expect "message_lines_max"    5 "$(row "$OUT" message_lines_max)"
expect "blocks_with_question" 1 "$(row "$OUT" blocks_with_question)"
expect "blocks_over_15"       0 "$(row "$OUT" blocks_over_15)"
WINDOW=$(rowval "$OUT" window)
if [ -n "$WINDOW" ]; then ok "window non-empty ($WINDOW)"; else bad "window: expected non-empty, got ''"; fi

echo "▶ measure-interaction-shape.py"
OUT=$(python3 "$DIR/measure-interaction-shape.py" --root "$FIX" --glob '-Users-art-code-rules-as-tests-aif*' --days 100000 --min-size 0 2>&1)
expect "transcripts_scanned"    2 "$(row "$OUT" transcripts_scanned)"
expect "user_messages"          5 "$(row "$OUT" user_messages)"
expect "reexplain_asks"         1 "$(row "$OUT" reexplain_asks)"
expect "handoff_asks"           1 "$(row "$OUT" handoff_asks)"
expect "bare_confirmations"     1 "$(row "$OUT" bare_confirmations)"
expect "autonomy_complaints"    1 "$(row "$OUT" autonomy_complaints)"
expect "recaps"                 2 "$(row "$OUT" recaps)"
expect "after_recap_bare_go"    1 "$(row "$OUT" after_recap_bare_go)"
expect "after_recap_substantive" 1 "$(row "$OUT" after_recap_substantive)"
WINDOW=$(rowval "$OUT" window)
if printf '%s' "$WINDOW" | grep -Eq '^from [0-9]{4}-[0-9]{2}-[0-9]{2} to [0-9]{4}-[0-9]{2}-[0-9]{2}$'; then
  ok "window dated ($WINDOW)"
else
  bad "window: expected dated 'from YYYY-MM-DD to YYYY-MM-DD', got '$WINDOW'"
fi

echo "▶ measure-permission-denials.py"
# Isolated fixture dir (not the shared -Users-art-code-rules-as-tests-aif* one): a fixture file
# dropped into the shared dir moves `transcripts_scanned` for the two sibling scripts above —
# the sibling-channel false-GREEN class this repo already paid for (#1644 -> #1651).
OUT=$(python3 "$DIR/measure-permission-denials.py" --root "$FIX" --glob '-Users-art-code-perm-denials*' --days 100000 --min-size 0 2>&1)
expect "denied_tool_calls" 5 "$(row "$OUT" denied_tool_calls)"
expect "classifier_denied" 1 "$(row "$OUT" classifier_denied)"
expect "prefix_1_count"    2 "$(row "$OUT" prefix_1_count)"
expect "prefix_1_key"      "Bash head -5; grep" "$(rowval "$OUT" prefix_1_key)"
expect "prefix_2_count"    1 "$(row "$OUT" prefix_2_count)"
expect "prefix_2_key"      "Bash docker compose up" "$(rowval "$OUT" prefix_2_key)"
expect "prefix_3_count"    1 "$(row "$OUT" prefix_3_count)"
expect "prefix_3_key"      "Bash npm run build" "$(rowval "$OUT" prefix_3_key)"
expect "prefix_4_count"    1 "$(row "$OUT" prefix_4_count)"
WINDOW=$(rowval "$OUT" window)
if printf '%s' "$WINDOW" | grep -Eq '^from [0-9]{4}-[0-9]{2}-[0-9]{2} to [0-9]{4}-[0-9]{2}-[0-9]{2}$'; then
  ok "window dated ($WINDOW)"
else
  bad "window: expected dated 'from YYYY-MM-DD to YYYY-MM-DD', got '$WINDOW'"
fi

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
