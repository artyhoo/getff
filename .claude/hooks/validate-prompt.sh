#!/usr/bin/env bash
# Wave 7 sub-wave 7.2.b — PostToolUse hook: validate batch-spec on orchestrator-prompts.
# Fires on Edit|Write|MultiEdit tool calls. Input: hook JSON via stdin (tool_input.file_path).
# Exits 0 silently on pass or unmatched path; non-zero + diagnostic on red.
# Gracefully skips if jq or tsx unavailable (never block tool calls for missing tooling).
# @cc-only-rationale: edit-time PostToolUse delivery; the validator itself is portable
#   (packages/core/spec-validation/validate-batch-spec.ts) — the hook is only its CC
#   fire-point. No portable hook fires at edit-time.
# @file-content-gate: this hook validates a file's content (path-only — no internal
#   tool_name filter), so its registration matcher MUST be Edit|Write|MultiEdit (else a
#   MultiEdit that violates the spec slips past silently). Enforced by check-hook-marker.sh.

set -uo pipefail

# @plugin-transform: manual — plugin twin adds T-PLUG-A $VALIDATOR guard (consumer plugins lack packages/core/); source-side guard is a no-op (framework repo always has packages/core)
# Harness-portable output (inline — standalone in test sandboxes). ZCode swallows plain
# exit 1; JSON additionalContext reaches the model. CC preserves stderr + exit 1 byte-for-byte
# on the VIOLATION path.
#
# Graceful-SKIP paths differ: they exit 0, and on an exit-0 PostToolUse the model receives
# ONLY JSON hookSpecificOutput — plain stdout/stderr reaches nobody (inject-matching-rule.sh
# :17 + :89-90). A dependency-missing skip on stderr is therefore indistinguishable from a
# pass. Sibling of the check-doc-authority.sh fix; same defect class, swept 2026-07-24
# (docs/meta-factory/research-patches/2026-07-23-aif-parity-s4-synthesis.md §3 item 1).
_is_zcode() { [ -n "${ZCODE_PROJECT_DIR:-}" ]; }
# JSON-escape WITHOUT jq — jq is precisely the dependency that may be missing here.
_json_escape() { printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | tr '\n' ' '; }
# Announce a skip on the channel the model actually receives on an exit-0 path, and keep
# the human/log channel too.
_emit_skip() {
  if _is_zcode; then
    printf '{"additionalContext":"%s"}\n' "$(_json_escape "$1")"
  else
    printf '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"%s"}}\n' \
      "$(_json_escape "$1")"
  fi
  printf '%s\n' "$1" >&2
}
_emit_ctx() { if _is_zcode && command -v jq >/dev/null 2>&1; then
    jq -n --arg c "$2" '{additionalContext:$c}'
  else printf '%s\n' "$2"; fi; }

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
TSX="$REPO_ROOT/node_modules/.bin/tsx"
VALIDATOR="$REPO_ROOT/packages/core/spec-validation/validate-batch-spec.ts"

# Graceful skip if jq unavailable
if ! command -v jq >/dev/null 2>&1; then
  _emit_skip '⚠ validate-prompt: jq unavailable — batch-spec validation DID NOT RUN for this edit. This is a SKIP, not a pass; install jq to restore enforcement.'
  exit 0
fi

FILE_PATH="$(cat | jq -r '.tool_input.file_path // ""' 2>/dev/null || true)"

# Only process files under .claude/orchestrator-prompts/**/*.md
if [[ -z "$FILE_PATH" ]] || [[ "$FILE_PATH" != *".claude/orchestrator-prompts/"*".md" ]]; then
  exit 0
fi

# Graceful skip if tsx unavailable
if [[ ! -x "$TSX" ]]; then
  _emit_skip "⚠ validate-prompt: tsx not found at $TSX — batch-spec validation DID NOT RUN for this edit. This is a SKIP, not a pass."
  exit 0
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
