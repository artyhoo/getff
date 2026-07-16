#!/usr/bin/env bash
# PostToolUse gate — M6 edit-time channel for `#worker-dispatch-via-subagent`.
# On Edit|Write|MultiEdit of a `.claude/orchestrator-prompts/<umbrella>/kickoff.md`,
# delegates to the SINGLE shared matcher (29-worker-dispatch-channel.bin.ts → .ts)
# and exit 1 on a hit. Both this hook and principle 29's CI test call that one
# matcher — never two divergent copies (anti-pattern `#two-prompts-drift`).
#
# @dual-pair: channel-discipline-worker-dispatch
# @cc-only-rationale: edit-time PostToolUse enforcement is the earliest reachable
#   channel for the kickoff author; it fires only for the session editing the file
#   in Claude Code. The harness-agnostic backstop is the paired CI principle test
#   (packages/core/principles/29-worker-dispatch-channel.test.ts), which catches any
#   kickoff authored outside CC or pasted in pre-wired — together they cover both
#   the earliest-channel and the portability goals (spec §3, dual-implementation §6).
# spec: docs/meta-factory/research-patches/2026-06-27-meta-orch-channel-discipline-mechanism.md
#
# MAINTAINER WIRING (agent-uncommittable — add to ~/.claude/settings.json by hand):
#   Append this object to .hooks.PostToolUse (alongside the existing Edit|Write|MultiEdit
#   entries, e.g. check-kickoff-traps.sh / check-doc-authority.sh):
#     {
#       "matcher": "Edit|Write|MultiEdit",
#       "hooks": [
#         { "type": "command",
#           "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/check-worker-dispatch-channel.sh" }
#       ]
#     }
#   Until wired, the CI principle test is the active backstop (no enforcement gap —
#   it gates every PR; the hook only moves the gate earlier, to edit-time).
#
# Graceful no-op (exit 0) without jq/tsx, off-path, or when the bin shim is absent —
# repo PostToolUse-gate convention (cf. check-doc-authority.sh).
set -uo pipefail

# Harness-portable output (inline — standalone in test sandboxes). ZCode swallows plain
# exit 1; JSON additionalContext reaches the model. CC preserves stderr + exit 1 byte-for-byte.
_is_zcode() { [ -n "${ZCODE_PROJECT_DIR:-}" ]; }
_emit_ctx() { if _is_zcode && command -v jq >/dev/null 2>&1; then
    jq -n --arg e "$1" --arg c "$2" '{hookEventName:$e, additionalContext:$c}'
  else printf '%s\n' "$2"; fi; }

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BIN="$REPO_ROOT/packages/core/principles/29-worker-dispatch-channel.bin.ts"
TSX="$REPO_ROOT/node_modules/.bin/tsx"

command -v jq >/dev/null 2>&1 || exit 0   # graceful no-op without jq

INPUT="$(cat)"
TOOL="$(printf '%s' "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null || true)"
ABS_PATH="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null || true)"

case "$TOOL" in Edit | Write | MultiEdit) ;; *) exit 0 ;; esac
[[ -z "$ABS_PATH" ]] && exit 0

REL_PATH="${ABS_PATH#"$REPO_ROOT/"}"
[[ "$REL_PATH" = "$ABS_PATH" ]] && exit 0   # outside repo — skip

# Narrow: only kickoff.md under orchestrator-prompts (one path segment for <umbrella>).
case "$REL_PATH" in
  .claude/orchestrator-prompts/*/kickoff.md) ;;
  *) exit 0 ;;
esac

[[ ! -f "$BIN" ]] && exit 0               # bin shim absent — graceful no-op
[[ ! -x "$TSX" ]] && exit 0               # tsx unavailable — graceful no-op

# Delegate to the single shared matcher; its exit code IS this hook's exit code (under CC).
# Under ZCode a plain non-zero exit is swallowed — capture output and emit JSON additionalContext
# so the model sees the violation (merged into the tool result). CC behaviour is byte-identical.
BIN_ERR="$("$TSX" "$BIN" "$REL_PATH" 2>&1 1>/dev/null)"
STATUS=$?
if [[ $STATUS -ne 0 ]] && _is_zcode; then
  _emit_ctx "PostToolUse" "❌ check-worker-dispatch-channel: #worker-dispatch-via-subagent violation in $REL_PATH.
$BIN_ERR"
  exit 0
fi
printf '%s\n' "$BIN_ERR" >&2
exit $STATUS
