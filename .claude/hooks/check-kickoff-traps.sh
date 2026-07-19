#!/usr/bin/env bash
# PostToolUse gate — kickoff T-enumeration floor (Wave N8 C2, ai-laziness-traps §3).
# @cc-only-rationale: PostToolUse edit-time gate — kickoffs are authored and
#   dispatched before any pre-push/CI channel runs on their content; edit-time is the earliest (and only) gate.
# spec: .claude/rules/ai-laziness-traps.md §3 (kickoff-author obligation #2)
#
# On Edit|Write|MultiEdit of a `.claude/orchestrator-prompts/<wave>/kickoff.md` that
# ENGAGES the rule (mentions `ai-laziness-traps`), assert the mechanical floor of §3
# obligation #2: ≥3 DISTINCT canonical T-numbers (T<n>) enumerated. Fewer = the
# #trap-catalogue-blanket-reference anti-pattern (cites the rule as decoration, names
# no traps). Principle 12 checks citation PRESENCE; this adds the COUNT floor it
# misses — and reaches edit-time, where principle 12 (CI-skipped, gitignored) cannot.
# Whether the named traps are the RIGHT ones stays judgment → review-time, not gated.
#
# Exit 1 on violation (repo PostToolUse-gate convention: check-doc-authority.sh /
# 09-doc-authority-hierarchy.bin.ts). Graceful no-op (exit 0) without jq, off-path,
# or on a kickoff that has not yet engaged the rule.
set -uo pipefail

# Harness-portable output (inline — standalone in test sandboxes). CC: exit 1 + stderr is
# advisory feedback. ZCode: JSON additionalContext (plain exit 1 swallowed); exit 0.
_is_zcode() { [ -n "${ZCODE_PROJECT_DIR:-}" ]; }
_emit_ctx() { if _is_zcode && command -v jq >/dev/null 2>&1; then
    jq -n --arg c "$2" '{additionalContext:$c}'
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
# Narrow: only kickoff.md under orchestrator-prompts (one path segment for <wave>).
case "$REL_PATH" in
  .claude/orchestrator-prompts/*/kickoff.md) ;;
  *) exit 0 ;;
esac

[[ -f "$ABS_PATH" ]] || exit 0
CONTENT="$(cat "$ABS_PATH" 2>/dev/null || true)"

# Engagement guard: only enforce the floor once the author engages the rule. A
# kickoff that never mentions ai-laziness-traps is principle-12 / review territory.
printf '%s' "$CONTENT" | grep -q 'ai-laziness-traps' || exit 0

# Count DISTINCT canonical T-numbers (T1, T12, …). Domain labels (T-Wave9-A) are a
# separate §3 #3 obligation and excluded from this count.
DISTINCT="$(printf '%s' "$CONTENT" | grep -oE '\bT[0-9]+\b' | sort -u | grep -c .)"

if [[ "$DISTINCT" -lt 3 ]]; then
  _adv_violation "❌ kickoff-traps: $REL_PATH engages ai-laziness-traps but enumerates only $DISTINCT distinct T-number(s) (floor: 3).
   §3 obligation #2: list the active traps, e.g. \"Active traps for this R-phase: T1, T3, T7\".
   Citing the rule without naming ≥3 traps = #trap-catalogue-blanket-reference."
  exit 0
fi
exit 0
