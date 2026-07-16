#!/usr/bin/env bash
# PostToolUse gate — delivery-channel marker on touched hooks (Wave N8 C4).
# @cc-only-rationale: PostToolUse edit-time gate — fires at the moment a hook file
#   is written; no portable hook fires then. Edit-time IS the "at next touch"
#   semantics dual-implementation-discipline §9 wants (legacy hooks are only
#   flagged when actually edited, never retroactively).
# spec: .claude/rules/dual-implementation-discipline.md §6
#
# On Edit|Write|MultiEdit of a `.claude/hooks/*.sh`, require a delivery-channel
# marker — `# @dual-pair: <anchor>` (has a portable counterpart) OR
# `# @cc-only-rationale: <reason>` (CC-only, with a reason). Missing → exit 1.
# Why: prevents silent CC vendor-lock-in — every hook must state its channel
# intent, so "CC-only" is a deliberate, recorded choice (§1b), not an accident.
# Marker presence only; the §5 drift-check (anchor has a real counterpart) is a
# separate, heavier item — out of scope here. CI-side companion:
# tests/agnosticism/probes/channel-coverage.sh (Surface 8, run by principle 21) is the
# population-wide, off-CC counterpart — it checks the whole hook set at once AND resolves
# @dual-pair anchors (§5). This edit-time gate stays the earliest reachable channel.
#
# Exit 1 on violation (repo PostToolUse-gate convention: check-doc-authority.sh).
# Graceful no-op (exit 0) without jq, off-path, or for a deleted file.
set -uo pipefail

# Harness-portable output (inline — this hook is copied standalone to test sandboxes, so no
# lib/ sibling to source). CC: exit 1 + stderr is advisory feedback. ZCode: JSON
# additionalContext (plain exit 1 is swallowed); exit 0 (non-blocking, = CC advisory).
_is_zcode() { [ -n "${ZCODE_PROJECT_DIR:-}" ]; }
_emit_ctx() { if _is_zcode && command -v jq >/dev/null 2>&1; then
    jq -n --arg e "$1" --arg c "$2" '{hookEventName:$e, additionalContext:$c}'
  else printf '%s\n' "$2"; fi; }
_adv_violation() { if _is_zcode; then _emit_ctx "PostToolUse" "$1"; else printf '%s\n' "$1" >&2; exit 1; fi; }

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
command -v jq >/dev/null 2>&1 || exit 0   # graceful no-op without jq

INPUT="$(cat)"
TOOL="$(printf '%s' "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null || true)"
ABS_PATH="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null || true)"

case "$TOOL" in Edit | Write | MultiEdit) ;; *) exit 0 ;; esac
[[ -z "$ABS_PATH" ]] && exit 0

REL_PATH="${ABS_PATH#"$REPO_ROOT/"}"
# Narrow: only hook scripts directly under .claude/hooks/.
case "$REL_PATH" in
  .claude/hooks/*.sh) ;;
  *) exit 0 ;;
esac

[[ -f "$ABS_PATH" ]] || exit 0

# Marker MUST be on its own comment line (anchored ^# ) so prose documenting the
# syntax (e.g. inside a heredoc or a backtick) is not mis-counted.
if grep -qE '^# @(dual-pair|cc-only-rationale):' "$ABS_PATH"; then
  exit 0
fi

_adv_violation "❌ hook-marker: $REL_PATH has no delivery-channel marker.
   Add ONE of (own comment line, near the top):
     # @cc-only-rationale: <why CC-only — no portable counterpart>
     # @dual-pair: <anchor shared with the portable agent/skill>
   Per dual-implementation-discipline.md §6 (prevents silent CC vendor-lock-in)."
exit 0
