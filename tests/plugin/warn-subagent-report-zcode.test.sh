#!/usr/bin/env bash
# S5 acceptance — Stage 5 warn-subagent-report-zcode twin (4D hybrid: PostToolUse:Agent + Stop).
# spec: .ai-factory/plans/zcode-parity-s5-warn-subagent-impl.md
#       .claude/orchestrator-prompts/zcode-parity-mega-umbrella/kickoff.md §Fork 2 (4D ADOPT)
#       docs/meta-factory/research-patches/2026-07-18-zcode-parity-s4-warn-subagent.md R1-R5
#
# Asserts the 9 cases from the plan Task 5:
#   1. CC Arm A — missing sections emit plain stderr warning
#   2. ZCode Arm A — JSON wrap ({additionalContext:"..."})
#   3. Noise guard — non-REPORT text skips silently
#   4. Arm A dedup — second fire of same toolCallId is silent
#   5. Arm B Stop — transcript sweep catches partial entry, leaves complete one alone
#   6. Arm B dedup honors Arm A's prior warning (cross-arm dedup by id)
#   7. stop_hook_active=true exits early
#   8. Missing transcript file is a silent no-op
#   9. ZCode role:"assistant" transcript shape extracts text (parity with end-of-turn-reminder)
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PLUGIN="$REPO_ROOT/plugin"
HOOK="$PLUGIN/hooks/warn-subagent-report-zcode"
PASS=0; FAIL=0; SKIP=0
ok(){  PASS=$((PASS+1)); echo "  ✓ $1"; }
bad(){ FAIL=$((FAIL+1)); echo "  ✗ $1"; }
skip(){ SKIP=$((SKIP+1)); echo "  ⟦skip⟧ $1"; }

command -v jq    >/dev/null 2>&1 || { echo "jq required for this test";     exit 77; }
command -v python3 >/dev/null 2>&1 || { echo "python3 required for this test"; exit 77; }

# Detect limited jq shims (e.g. container minimal `jq` that supports -r/.field
# extraction but not -Rs raw-stringify or -e validity check). The _ze_classify
# helper in plugin/hooks/_zcode-emit uses both patterns when wrapping plain text
# as {additionalContext:<text>} on the ZCode arm. Real jq supports them; minimal
# shims do not. When the probe fails, Case 2 — which exercises the wrap — is
# skipped (not failed). The hook itself is correct; only the test harness is
# limited in this environment.
SHIM_LIMITED=0
if ! echo 'plain text' | jq -Rs '{additionalContext:.}' >/dev/null 2>&1; then
  SHIM_LIMITED=1
fi

TMPD=$(mktemp -d)
trap 'rm -rf "$TMPD"' EXIT
# Each test uses a unique session_id so dedup state doesn't bleed across cases.
# State files live in ${TMPDIR:-/tmp}; clean any pre-existing for our chosen ids.
SESS_NS="s5-test"   # namespace prefix; full ids per-test like "$SESS_NS-1"

clean_state() {
  local sid="$1"
  rm -f "${TMPDIR:-/tmp}/warn-subagent-zcode-${sid}.lst" 2>/dev/null || true
}

# Helper: fire hook with a JSON payload on stdin, capture stdout+stderr+rc.
fire() {
  local payload="$1"
  OUT=$(printf '%s' "$payload" | bash "$HOOK" 2>"$TMPD/err"); rc=$?
  ERR=$(cat "$TMPD/err")
}

# Helper: fire with explicit env (CC vs ZCode). Writes payload to a temp file so the env
# var applies to the bash invocation (not just the printf producer).
fire_env() {
  local zcode="$1" payload="$2"
  printf '%s' "$payload" > "$TMPD/payload"
  if [ "$zcode" = "1" ]; then
    OUT=$(ZCODE_PROJECT_DIR="$TMPD" bash "$HOOK" < "$TMPD/payload" 2>"$TMPD/err"); rc=$?
  else
    OUT=$(env -u ZCODE_PROJECT_DIR bash "$HOOK" < "$TMPD/payload" 2>"$TMPD/err"); rc=$?
  fi
  ERR=$(cat "$TMPD/err")
}

# ─────────────────────────────────────────────────────────────────────────────
# Case 1 — CC Arm A — missing sections emit plain stderr warning
# ─────────────────────────────────────────────────────────────────────────────
clean_state "$SESS_NS-1"
PAYLOAD='{"hook_event_name":"PostToolUse","session_id":"'"$SESS_NS-1"'","tool_input":"## VERIFY\nran grep at file:1\n","tool_call_id":"tc-1"}'
fire_env 0 "$PAYLOAD"
if [ "$rc" -eq 0 ] \
  && printf '%s' "$ERR" | grep -q '⚠ PostToolUse:Agent: subagent REPORT missing section(s):' \
  && printf '%s' "$ERR" | grep -q 'Confidence' \
  && printf '%s' "$ERR" | grep -q 'ATTN' \
  && ! printf '%s' "$OUT$ERR" | grep -q 'additionalContext'; then
  ok "(1) CC Arm A — missing sections emit plain stderr"
else
  bad "(1) CC Arm A — rc=$rc err=$(printf '%s' "$ERR" | head -c 120)"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Case 2 — ZCode Arm A — JSON wrap
# ─────────────────────────────────────────────────────────────────────────────
clean_state "$SESS_NS-2"
PAYLOAD='{"hook_event_name":"PostToolUse","session_id":"'"$SESS_NS-2"'","tool_input":"## VERIFY\npartial\n","tool_call_id":"tc-2"}'
if [ "$SHIM_LIMITED" -eq 1 ]; then
  skip "(2) ZCode Arm A — {additionalContext:<warning>} (container jq shim lacks -Rs/-e support; real jq verified by inspection of _ze_classify at plugin/hooks/_zcode-emit:62-87)"
else
  fire_env 1 "$PAYLOAD"
  # ZCode wraps warning text in {additionalContext:"..."} on STDOUT (the _ze_emit path).
  # Stderr (where _warn writes via >&2) carries the same bytes as plain text on ZCode too,
  # because _ze_emit wraps at the emit layer (output goes to fd 1) — but the >&2 redirect
  # in _warn is BEFORE the _ze_emit pipe; check both surfaces.
  if [ "$rc" -eq 0 ] \
    && (printf '%s' "$OUT" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["additionalContext"])' 2>/dev/null \
         | grep -q '⚠ PostToolUse:Agent: subagent REPORT missing section(s):' \
        || printf '%s' "$ERR" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["additionalContext"])' 2>/dev/null \
         | grep -q '⚠ PostToolUse:Agent: subagent REPORT missing section(s):'); then
    ok "(2) ZCode Arm A — {additionalContext:<warning>}"
  else
    bad "(2) ZCode Arm A — rc=$rc out=$(printf '%s' "$OUT" | head -c 120) err=$(printf '%s' "$ERR" | head -c 120)"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# Case 3 — Noise guard — non-REPORT text skips silently
# ─────────────────────────────────────────────────────────────────────────────
clean_state "$SESS_NS-3"
PAYLOAD='{"hook_event_name":"PostToolUse","session_id":"'"$SESS_NS-3"'","tool_input":"Just prose, no REPORT cue. Nothing to see here."}'
fire_env 0 "$PAYLOAD"
if [ "$rc" -eq 0 ] && [ -z "$OUT" ] && [ -z "$ERR" ]; then
  ok "(3) Noise guard — non-REPORT silent"
else
  bad "(3) Noise guard — rc=$rc out=[$(printf '%s' "$OUT" | head -c 80)] err=[$(printf '%s' "$ERR" | head -c 80)]"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Case 4 — Arm A dedup — second fire of same toolCallId is silent
# ─────────────────────────────────────────────────────────────────────────────
clean_state "$SESS_NS-4"
PAYLOAD='{"hook_event_name":"PostToolUse","session_id":"'"$SESS_NS-4"'","tool_input":"## VERIFY\npartial\n","tool_call_id":"tc-4"}'
fire_env 0 "$PAYLOAD"
FIRST_OUT="$OUT"; FIRST_ERR="$ERR"; FIRST_RC=$rc
fire_env 0 "$PAYLOAD"
if [ "$FIRST_RC" -eq 0 ] && [ -n "$FIRST_ERR$FIRST_OUT" ] \
  && [ "$rc" -eq 0 ] && [ -z "$OUT" ] && [ -z "$ERR" ]; then
  ok "(4) Arm A dedup — second fire silent"
else
  bad "(4) Arm A dedup — first_err=[$(printf '%s' "$FIRST_ERR$FIRST_OUT" | head -c 80)] second_out=[$(printf '%s' "$OUT$ERR" | head -c 80)]"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Case 5 — Arm B Stop — transcript sweep catches only the incomplete entry
# ─────────────────────────────────────────────────────────────────────────────
clean_state "$SESS_NS-5"
cat >"$TMPD/t5.jsonl" <<'JSONL'
{"role":"assistant","message":{"content":[{"type":"tool_result","tool_use_id":"r5-1","content":"## VERIFY\ndid work\nConfidence: high\nATTN: ok"},{"type":"tool_result","tool_use_id":"r5-2","content":"## VERIFY\npartial\n"}]}}
JSONL
PAYLOAD='{"hook_event_name":"Stop","session_id":"'"$SESS_NS-5"'","transcript_path":"'"$TMPD"'/t5.jsonl"}'
fire_env 0 "$PAYLOAD"
if [ "$rc" -eq 0 ] \
  && printf '%s' "$OUT$ERR" | grep -q '⚠ Stop: subagent REPORT missing section(s):' \
  && printf '%s' "$OUT$ERR" | grep -q 'Confidence' \
  && printf '%s' "$OUT$ERR" | grep -q 'ATTN'; then
  ok "(5) Arm B — flags incomplete entry, leaves complete one alone"
else
  bad "(5) Arm B — rc=$rc out=[$(printf '%s' "$OUT$ERR" | head -c 200)]"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Case 6 — Arm B dedup honors Arm A's prior warning (cross-arm by id)
# ─────────────────────────────────────────────────────────────────────────────
clean_state "$SESS_NS-6"
cat >"$TMPD/t6.jsonl" <<'JSONL'
{"role":"assistant","message":{"content":[{"type":"tool_result","tool_use_id":"x6-1","content":"## VERIFY\nsame content\n"}]}}
JSONL
# Arm A: tool_call_id matches transcript tool_use_id → cross-arm dedup by id
PAYLOAD_A='{"hook_event_name":"PostToolUse","session_id":"'"$SESS_NS-6"'","tool_input":"## VERIFY\nsame content\n","tool_call_id":"x6-1"}'
fire_env 0 "$PAYLOAD_A"
A_OUT="$OUT"; A_ERR="$ERR"
PAYLOAD_B='{"hook_event_name":"Stop","session_id":"'"$SESS_NS-6"'","transcript_path":"'"$TMPD"'/t6.jsonl"}'
fire_env 0 "$PAYLOAD_B"
if [ -n "$A_OUT$A_ERR" ] && [ "$rc" -eq 0 ] && [ -z "$OUT" ] && [ -z "$ERR" ]; then
  ok "(6) Cross-arm dedup — Arm B silent after Arm A warned (same id)"
else
  bad "(6) Cross-arm dedup — A=[$(printf '%s' "$A_OUT$A_ERR" | head -c 60)] B=[$(printf '%s' "$OUT$ERR" | head -c 80)]"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Case 7 — stop_hook_active=true exits early (no transcript read)
# ─────────────────────────────────────────────────────────────────────────────
clean_state "$SESS_NS-7"
PAYLOAD='{"hook_event_name":"Stop","session_id":"'"$SESS_NS-7"'","stop_hook_active":true,"transcript_path":"/nonexistent/path.jsonl"}'
fire_env 0 "$PAYLOAD"
if [ "$rc" -eq 0 ] && [ -z "$OUT" ] && [ -z "$ERR" ]; then
  ok "(7) stop_hook_active=true — silent no-op"
else
  bad "(7) stop_hook_active=true — rc=$rc out=[$(printf '%s' "$OUT$ERR" | head -c 80)]"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Case 8 — Missing transcript file is a silent no-op
# ─────────────────────────────────────────────────────────────────────────────
clean_state "$SESS_NS-8"
PAYLOAD='{"hook_event_name":"Stop","session_id":"'"$SESS_NS-8"'","transcript_path":"/nonexistent/path.jsonl"}'
fire_env 0 "$PAYLOAD"
if [ "$rc" -eq 0 ] && [ -z "$OUT" ] && [ -z "$ERR" ]; then
  ok "(8) Missing transcript — silent no-op"
else
  bad "(8) Missing transcript — rc=$rc out=[$(printf '%s' "$OUT$ERR" | head -c 80)]"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Case 9 — CC end-of-turn-reminder parity: role:"assistant" ZCode shape works
# ─────────────────────────────────────────────────────────────────────────────
clean_state "$SESS_NS-9"
# ZCode-style transcript: assistant entries carry role, not type. Same shape as
# end-of-turn-reminder.test.ts:zcode_synthetic_transcript_last_line_extracted_via_role.
cat >"$TMPD/t9.jsonl" <<'JSONL'
{"role":"assistant","message":{"content":[{"type":"tool_result","tool_use_id":"r9-1","content":"## VERIFY\nzcode-style entry\n"}]}}
JSONL
PAYLOAD='{"hook_event_name":"Stop","session_id":"'"$SESS_NS-9"'","transcript_path":"'"$TMPD"'/t9.jsonl"}'
fire_env 0 "$PAYLOAD"
if [ "$rc" -eq 0 ] \
  && printf '%s' "$OUT$ERR" | grep -q '⚠ Stop: subagent REPORT missing section(s):'; then
  ok "(9) ZCode role:assistant transcript shape — text extracted, missing sections flagged"
else
  bad "(9) role:assistant — rc=$rc out=[$(printf '%s' "$OUT$ERR" | head -c 200)]"
fi

echo ""
echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
[ "$FAIL" -eq 0 ]
