#!/usr/bin/env bash
# Wave 7 sub-wave 7.2.b — PostToolUse hook: validate batch-spec on orchestrator-prompts.
# Fires on Edit|Write tool calls. Input: hook JSON via stdin (tool_input.file_path).
# Exits 0 silently on pass or unmatched path; non-zero + diagnostic on red.
# Gracefully skips if jq or tsx unavailable (never block tool calls for missing tooling).
# @cc-only-rationale: edit-time PostToolUse delivery; the validator itself is portable
#   (packages/core/spec-validation/validate-batch-spec.ts) — the hook is only its CC
#   fire-point. No portable hook fires at edit-time.

set -uo pipefail

# Harness-portable output (inline — standalone in test sandboxes). ZCode swallows plain
# exit 1; JSON additionalContext reaches the model. CC preserves stderr + exit 1 byte-for-byte.
_is_zcode() { [ -n "${ZCODE_PROJECT_DIR:-}" ]; }
_emit_ctx() { if _is_zcode && command -v jq >/dev/null 2>&1; then
    jq -n --arg c "$2" '{additionalContext:$c}'
  else printf '%s\n' "$2"; fi; }

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TSX="$REPO_ROOT/node_modules/.bin/tsx"
VALIDATOR="$REPO_ROOT/packages/core/spec-validation/validate-batch-spec.ts"

# Graceful skip if jq unavailable
if ! command -v jq >/dev/null 2>&1; then
  printf '⚠ validate-prompt: jq unavailable — skipping\n' >&2; exit 0
fi

FILE_PATH="$(cat | jq -r '.tool_input.file_path // ""' 2>/dev/null || true)"

# Only process files under .claude/orchestrator-prompts/**/*.md
if [[ -z "$FILE_PATH" ]] || [[ "$FILE_PATH" != *".claude/orchestrator-prompts/"*".md" ]]; then
  exit 0
fi

# Graceful skip if tsx unavailable
if [[ ! -x "$TSX" ]]; then
  printf '⚠ validate-prompt: tsx not found at %s — skipping spec-validation\n' "$TSX" >&2; exit 0
fi

# exit 2 = gh CLI unavailable (soft-skip by validate-batch-spec.ts); treat as 0 here.
# Capture output so that under ZCode a violation reaches the model (plain exit 1 + stderr is
# swallowed by ZCode; JSON additionalContext is merged into the tool result). Under CC the
# validator's stderr + non-zero exit is preserved byte-for-byte.
VALIDATOR_OUT="$("$TSX" "$VALIDATOR" "$FILE_PATH" 2>&1 1>/dev/null)"
STATUS=$?
[[ $STATUS -eq 2 ]] && exit 0
if [[ $STATUS -ne 0 ]] && _is_zcode; then
  _emit_ctx "PostToolUse" "❌ validate-prompt: batch-spec validation failed for ${FILE_PATH#${REPO_ROOT}/}
$VALIDATOR_OUT"
  exit 0
fi
# CC path: re-emit captured stderr so the model sees it, then propagate the exit code.
# Guard: emit only when non-empty (otherwise success-path would emit a stray \n, falsifying
# the "byte-for-byte unchanged" contract — old hooks emitted nothing on success).
[[ -n "$VALIDATOR_OUT" ]] && printf '%s\n' "$VALIDATOR_OUT" >&2
exit $STATUS
