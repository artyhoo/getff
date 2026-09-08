#!/usr/bin/env bash
# @cc-only-rationale: CC-specific SessionStart hook (the D20 injection pipe) — a compaction
#   orphans the model-authored handoff exactly when the fresh window needs it most, and
#   SessionStart(source=compact) is the one event that fires at that instant. ZCode has no
#   compaction-lifecycle event of any kind (the zcode-parity-doctrine.md §2 row 21 rationale
#   covers this whole event class), so no portable counterpart exists by nature.
#   OPERATOR-AXIS ONLY (parent F6): consumers receive no residue writer, so no handoff file
#   ever exists for them to inject. NOT in plugin/hooks/ either — the plugin SessionStart
#   slot is occupied by the session-start bootstrap (PLUGIN_INCOMPATIBLE in
#   scripts/render-harness-config.mjs records the skip loudly at render time).
# spec: docs/superpowers/specs/2026-09-08-handoff-currency-gate-design.md (D20)
#
# WHAT IT DOES — reads `_handoff-<session_key>.md` (session id from the stdin payload, the
# SAME key sanitisation the writer and the gate use — changing it on one side silently
# unlinks the channel) and re-emits it as SessionStart additionalContext. NON-BLOCKING BY
# SHAPE: every path ends `exit 0`; a missing handoff, a non-compact source and malformed
# stdin are all silent exits, never errors (a SessionStart failure must never break a
# session start — same posture as the PreCompact writer it siblings).
#
# `head -n <cap>` (D32): the handoff is a current-state file capped at
# AIF_HANDOFF_MAX_LINES; the injector reads at most that. Injecting a file that outgrew
# the cap would open the fresh window already loaded — the thrash the cap exists to prevent.
set -uo pipefail

# Dependency guard — the payload is JSON and every extraction below is jq. No jq → no
# work possible → exit silently (same shape as the writer and the Stop hook).
command -v jq >/dev/null 2>&1 || exit 0

input=$(cat)

# Only the `compact` source follows a compaction. startup/resume/clear/fork (and any
# unknown future source) → silent exit 0: no compaction, no orphaned handoff.
source_kind=$(printf '%s' "$input" | jq -r '.source // empty' 2>/dev/null || true)
[ "$source_kind" = "compact" ] || exit 0

session_id=$(printf '%s' "$input" | jq -r '.session_id // empty' 2>/dev/null || true)
[ -n "$session_id" ] || exit 0
# The writer's own sanitisation (precompact-residue.sh:122, Stop hook :307).
session_key=$(printf '%s' "$session_id" | tr -c 'A-Za-z0-9._-' '_' | cut -c1-96)

# Repo root: CLAUDE_PROJECT_DIR is set by CC in the hook subprocess; the payload's `cwd`
# is the documented fallback; `pwd` is the last resort (the writer's own cascade).
root="${CLAUDE_PROJECT_DIR:-}"
[ -n "$root" ] || root="$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null || true)"
[ -n "$root" ] || root="$(pwd)"

# Residue directory — the SAME guarded-source contract as the writer and the gate (D29):
# lib absent or unreadable → the inline fallback below, identical logic, never an abort.
_residue_lib="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/residue-dir.sh"
if ! [ -f "$_residue_lib" ] || ! . "$_residue_lib" 2>/dev/null; then
  _residue_dir() {
    if [ -n "${AIF_RESIDUE_DIR:-}" ]; then printf '%s\n' "$AIF_RESIDUE_DIR"; return; fi
    local _rd_root="${root:-$(pwd)}"
    local _rd_helper="$_rd_root/.claude/skills/pipeline/helpers/print-orch-home.sh" _rd_out=""
    if [ -f "$_rd_helper" ]; then
      _rd_out=$(REPO_ROOT="$_rd_root" bash "$_rd_helper" 2>/dev/null || true)
      if [ -n "$_rd_out" ]; then printf '%s\n' "$_rd_out"; return; fi
    fi
    if [ -d "$_rd_root/.claude/orchestrator-prompts" ]; then
      printf '%s\n' "$_rd_root/.claude/orchestrator-prompts"
    else
      printf '%s\n' "$_rd_root/.ai-factory/orchestrator-prompts"
    fi
  }
fi

residue_dir="$(_residue_dir)"
handoff_file="${residue_dir}/_handoff-${session_key}.md"
# Missing file → silent exit 0 (D20): the gate is what enforces the handoff EXISTS in the
# band; the injector's contract is only to not lose one that does.
[ -f "$handoff_file" ] || exit 0

cap="${AIF_HANDOFF_MAX_LINES:-200}"
case "$cap" in '' | *[!0-9]* | 0) cap=200 ;; esac
handoff_body=$(head -n "$cap" "$handoff_file" 2>/dev/null || true)
[ -n "$handoff_body" ] || exit 0

# One-line pointer to the writer's machine excerpt (D15/D28): the handoff is the model's
# CURRENT STATE, the residue is the transcript excerpt; a continuation may need both.
residue_file="${residue_dir}/_residue-${session_key}.md"
pointer=""
[ -f "$residue_file" ] && pointer="Session residue (machine excerpt written at the compaction): ${residue_file}"

jq -n --arg ctx "[handoff injected — source=compact] The pre-compaction session's model-authored handoff (current state, capped at ${cap} lines):
${handoff_body}${pointer:+
${pointer}}" '{
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: $ctx
  }
}'
exit 0
