#!/usr/bin/env bash
# Stage 9C acceptance — ZCode-arm multi-turn idle-suppression guard via rollout.
# spec: .ai-factory/plans/zcode-parity-s9c-multiturn-zcode-arm.md
#       docs/meta-factory/research-patches/2026-07-18-zcode-parity-s9-multiturn-anchor.md
#       docs/meta-factory/zcode-parity-mega.decisions.md §Fork 3 (ADOPT 9C)
#
# The CC-source `.claude/hooks/end-of-turn-reminder.sh` has NO ZCode branch
# (grep `_is_zcode` returns empty). The ZCode arm lives in the twin
# `plugin/hooks/end-of-turn-reminder` (which has _is_zcode() at L20). This test
# exercises the twin only; CC source is regression-covered by the existing
# packages/core/hooks/end-of-turn-reminder.test.ts vitest suite.
#
# Coverage matrix (paired-negative per principle 02):
#   (1) ZCode + rollout with recap + repeat-question → SUPPRESS (silent exit 0)
#   (2) ZCode + rollout with recap + NEW question       → FIRE (decision:block)
#   (3) ZCode + rollout with recap + AskUserQuestion    → FIRE (B2 boundary)
#   (4) ZCode + NO rollout dir                           → degrade to synthetic (no suppress)
#   (5) ZCode + rollout with only 1 assistant turn       → degrade (no suppress)
#   (6) ZCode + rollout file empty                       → degrade (no suppress)
#   (7) CC env (no ZCODE_PROJECT_DIR) + rollout present  → does NOT use rollout
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
HOOK="$REPO_ROOT/plugin/hooks/end-of-turn-reminder"
FIXTURE_ROLLOUT="$REPO_ROOT/tests/fixtures/zcode-rollout-multiturn.jsonl"
PASS=0; FAIL=0
ok(){ PASS=$((PASS+1)); echo "  ✓ $1"; }
bad(){ FAIL=$((FAIL+1)); echo "  ✗ $1"; }

command -v jq >/dev/null 2>&1 || { echo "jq required for this test"; exit 77; }

TMPD=$(mktemp -d "${TMPDIR:-/tmp}/s9c-zcode.XXXXXX")
trap 'rm -rf "$TMPD"' EXIT

# --- helpers -------------------------------------------------------------------

# Write a single-assistant-line synthetic ZCode transcript (the current turn).
# Synthetic producer (zcode.cjs:~1072550 $_n, per step-1) emits 1 line per turn.
mk_synthetic() {
  local text="$1" path="$2"
  printf '%s\n' "{\"message\":{\"content\":[{\"type\":\"text\",\"text\":${text}}],\"role\":\"assistant\"}}" >"$path"
}

# JSON-escape a string (no embedded quotes/newlines in our test corpus → simple sub).
esc() { python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$1" 2>/dev/null || node -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "$1"; }

# Run the hook with given stdin JSON, env overrides; echo stdout.
run_hook() {
  local stdin_json="$1"; shift
  env "$@" AIF_HOOK_LANG=en bash "$HOOK" <<<"$stdin_json" 2>/dev/null
}

REPEAT_Q="Should we proceed with step Y?"
NEW_Q="What about a completely different topic Z?"

# ==============================================================================
# (1) ZCode + rollout with recap + repeat-question → SUPPRESS (silent exit 0)
# ==============================================================================
SYN1="$TMPD/syn1.jsonl"; mk_synthetic "$(esc "$REPEAT_Q")" "$SYN1"
ROLLOUT_DIR1="$TMPD/rollout1"; mkdir -p "$ROLLOUT_DIR1"
cp "$FIXTURE_ROLLOUT" "$ROLLOUT_DIR1/model-io-test-session.jsonl"
OUT=$(run_hook "{\"transcript_path\":\"$SYN1\",\"stop_hook_active\":false,\"session_id\":\"test-session\"}" \
  ZCODE_PROJECT_DIR="$TMPD" ZCODE_ROLLOUT_DIR="$ROLLOUT_DIR1")
rc=$?
if [ "$rc" -eq 0 ] && [ -z "$OUT" ]; then
  ok "(1) ZCode rollout recap+repeat → idle-suppress (silent)"
else
  bad "(1) ZCode rollout recap+repeat: rc=$rc out=$(printf '%s' "$OUT" | head -c 80)"
fi

# ==============================================================================
# (2) ZCode + rollout with recap + NEW question → FIRE (decision:block)
# ==============================================================================
SYN2="$TMPD/syn2.jsonl"; mk_synthetic "$(esc "$NEW_Q")" "$SYN2"
OUT=$(run_hook "{\"transcript_path\":\"$SYN2\",\"stop_hook_active\":false,\"session_id\":\"test-session\"}" \
  ZCODE_PROJECT_DIR="$TMPD" ZCODE_ROLLOUT_DIR="$ROLLOUT_DIR1")
rc=$?
if [ "$rc" -eq 0 ] && [ -n "$OUT" ] \
  && printf '%s' "$OUT" | jq -e '.decision == "block"' >/dev/null 2>&1; then
  ok "(2) ZCode rollout recap+NEW question → fires decision:block"
else
  bad "(2) ZCode rollout new-q: rc=$rc out=$(printf '%s' "$OUT" | head -c 80)"
fi

# ==============================================================================
# (3) ZCode + rollout + AskUserQuestion tool_use → FIRE (B2 boundary)
# ==============================================================================
SYN3="$TMPD/syn3.jsonl"
printf '%s\n' "{\"message\":{\"content\":[{\"type\":\"tool_use\",\"name\":\"AskUserQuestion\",\"input\":{}}],\"role\":\"assistant\"}}" >"$SYN3"
OUT=$(run_hook "{\"transcript_path\":\"$SYN3\",\"stop_hook_active\":false,\"session_id\":\"test-session\"}" \
  ZCODE_PROJECT_DIR="$TMPD" ZCODE_ROLLOUT_DIR="$ROLLOUT_DIR1")
rc=$?
if [ "$rc" -eq 0 ] && [ -n "$OUT" ] \
  && printf '%s' "$OUT" | jq -e '.decision == "block"' >/dev/null 2>&1; then
  ok "(3) ZCode rollout + AskUserQuestion → fires (B2 never suppress)"
else
  bad "(3) ZCode rollout+AUQ: rc=$rc out=$(printf '%s' "$OUT" | head -c 80)"
fi

# ==============================================================================
# (4) ZCode + NO rollout dir → degrade to synthetic (1 line) → no suppress →
#     the synthetic has 1 assistant line so prev_line == last_line → no match.
#     A short question fires Branch B normally.
# ==============================================================================
SYN4="$TMPD/syn4.jsonl"; mk_synthetic "$(esc "$REPEAT_Q")" "$SYN4"
EMPTY_DIR="$TMPD/empty_rollout"; mkdir -p "$EMPTY_DIR"
OUT=$(run_hook "{\"transcript_path\":\"$SYN4\",\"stop_hook_active\":false,\"session_id\":\"test-session\"}" \
  ZCODE_PROJECT_DIR="$TMPD" ZCODE_ROLLOUT_DIR="$EMPTY_DIR")
rc=$?
# No rollout file present → fallback to synthetic (1 line) → no prev → no suppress
# → Branch B fires on the short question.
if [ "$rc" -eq 0 ] && [ -n "$OUT" ] \
  && printf '%s' "$OUT" | jq -e '.decision == "block"' >/dev/null 2>&1; then
  ok "(4) ZCode + empty rollout dir → degrades, Branch B fires"
else
  bad "(4) ZCode empty-rollout: rc=$rc out=$(printf '%s' "$OUT" | head -c 80)"
fi

# ==============================================================================
# (5) ZCode + rollout with only 1 assistant turn → degrade (no suppress)
# ==============================================================================
ROLLOUT_DIR5="$TMPD/rollout5"; mkdir -p "$ROLLOUT_DIR5"
printf '%s\n' '{"message":{"content":[{"type":"text","text":"## 🟢 In plain words\n\nSolo recap, no current turn"}],"role":"assistant"}}' \
  >"$ROLLOUT_DIR5/model-io-test-session.jsonl"
OUT=$(run_hook "{\"transcript_path\":\"$SYN1\",\"stop_hook_active\":false,\"session_id\":\"test-session\"}" \
  ZCODE_PROJECT_DIR="$TMPD" ZCODE_ROLLOUT_DIR="$ROLLOUT_DIR5")
rc=$?
if [ "$rc" -eq 0 ] && [ -n "$OUT" ] \
  && printf '%s' "$OUT" | jq -e '.decision == "block"' >/dev/null 2>&1; then
  ok "(5) ZCode + 1-line rollout → degrade (no suppress), Branch B fires"
else
  bad "(5) ZCode 1-line rollout: rc=$rc out=$(printf '%s' "$OUT" | head -c 80)"
fi

# ==============================================================================
# (6) ZCode + empty rollout file → degrade (no suppress)
# ==============================================================================
ROLLOUT_DIR6="$TMPD/rollout6"; mkdir -p "$ROLLOUT_DIR6"
: >"$ROLLOUT_DIR6/model-io-test-session.jsonl"
OUT=$(run_hook "{\"transcript_path\":\"$SYN1\",\"stop_hook_active\":false,\"session_id\":\"test-session\"}" \
  ZCODE_PROJECT_DIR="$TMPD" ZCODE_ROLLOUT_DIR="$ROLLOUT_DIR6")
rc=$?
if [ "$rc" -eq 0 ] && [ -n "$OUT" ] \
  && printf '%s' "$OUT" | jq -e '.decision == "block"' >/dev/null 2>&1; then
  ok "(6) ZCode + empty rollout file → degrade, Branch B fires"
else
  bad "(6) ZCode empty-rollout-file: rc=$rc out=$(printf '%s' "$OUT" | head -c 80)"
fi

# ==============================================================================
# (7) CC env (no ZCODE_PROJECT_DIR) + rollout present → must NOT use rollout.
#     The synthetic has only the current turn (1 line) → no prev in synthetic →
#     no suppress. Branch B fires on the short question. The rollout file is
#     untouched — confirm by checking the hook output doesn't reflect rollout
#     content (it would only matter if rollout were consulted; in CC it isn't).
# ==============================================================================
OUT=$(run_hook "{\"transcript_path\":\"$SYN1\",\"stop_hook_active\":false,\"session_id\":\"test-session\"}" \
  ZCODE_ROLLOUT_DIR="$ROLLOUT_DIR1")
rc=$?
# CC path (ZCODE_PROJECT_DIR unset): _is_zcode returns false → _prev_src = $transcript
# (synthetic, 1 line) → prev_line == last_line → no suppress → Branch B fires.
if [ "$rc" -eq 0 ] && [ -n "$OUT" ] \
  && printf '%s' "$OUT" | jq -e '.decision == "block"' >/dev/null 2>&1; then
  ok "(7) CC env ignores rollout dir → Branch B fires (CC byte-identical)"
else
  bad "(7) CC env: rc=$rc out=$(printf '%s' "$OUT" | head -c 80)"
fi

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
