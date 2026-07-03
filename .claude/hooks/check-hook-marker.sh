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

printf '❌ hook-marker: %s has no delivery-channel marker.\n' "$REL_PATH" >&2
printf '   Add ONE of (own comment line, near the top):\n' >&2
printf '     # @cc-only-rationale: <why CC-only — no portable counterpart>\n' >&2
printf '     # @dual-pair: <anchor shared with the portable agent/skill>\n' >&2
printf '   Per dual-implementation-discipline.md §6 (prevents silent CC vendor-lock-in).\n' >&2
exit 1
