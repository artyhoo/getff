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

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
