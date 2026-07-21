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
    jq -n --arg c "$2" '{additionalContext:$c}'
  else printf '%s\n' "$2"; fi; }
_adv_violation() { if _is_zcode; then _emit_ctx "PostToolUse" "$1"; else printf '%s\n' "$1" >&2; exit 1; fi; }

# Framework-self PostToolUse matcher registered for a hook (empty = not registered, i.e. a
# shipped-only hook wired solely via setup.d/install.sh — tolerated: no framework-side matcher
# to read). Anchors on the closing `"` after `<name>.sh` so `check-doc-authority` does not
# spuriously match `check-doc-authority-header`'s command string.
_reg_matcher() {
  local hook="$1" settings="$REPO_ROOT/.claude/settings.json"
  [ -f "$settings" ] || { printf ''; return; }
  jq -r --arg hook "$hook" '
    (.hooks.PostToolUse // []) | map(select(any(.hooks[].command; test($hook + "\"")))) | .[0].matcher // ""
  ' "$settings" 2>/dev/null || true
}

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
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
grep -qE '^# @(dual-pair|cc-only-rationale):' "$ABS_PATH" \
  || _adv_violation "❌ hook-marker: $REL_PATH has no delivery-channel marker.
   Add ONE of (own comment line, near the top):
     # @cc-only-rationale: <why CC-only — no portable counterpart>
     # @dual-pair: <anchor shared with the portable agent/skill>
   Per dual-implementation-discipline.md §6 (prevents silent CC vendor-lock-in)."

# @file-content-gate invariant: a hook that validates a file's content (path-only, no
# internal tool_name filter) MUST be registered with matcher Edit|Write|MultiEdit — else a
# MultiEdit that violates the rule slips past silently (the matcher is its only tool-filter).
# Catches the body↔registration drift class (3 of 6 hooks were registered Edit|Write while
# their bodies already accepted MultiEdit). CI-backstop is a CC-config check (matcher/case-arm
# consistency is CC-specific — MultiEdit is inert on other harnesses — so it lives with the
# CC-config drift tests, NOT the harness-agnostic channel-coverage probe).
#
# Scope: checks the FRAMEWORK-self registration in .claude/settings.json (rendered from
# harness-model.json). A shipped-only hook (e.g. check-doc-authority-header — registered
# solely via setup.d/install.sh for consumers, absent from the framework's own settings.json)
# is SKIPPED here: its matcher is enforced by the install-sh firing tests (gh-934-ship-*) and
# the CC-config backstop, not by this edit-time gate (which has no framework-side matcher to
# read for it).
if grep -qE '^# @file-content-gate:' "$ABS_PATH"; then
  REG_MATCHER="$(_reg_matcher "$(basename "$REL_PATH")")"
  if [ -n "$REG_MATCHER" ]; then
    case "$REG_MATCHER" in
      *Edit*Write*MultiEdit*) ;;  # Edit|Write|MultiEdit or Write|Edit|MultiEdit — both fine
      *) _adv_violation "❌ hook-marker: $REL_PATH declares @file-content-gate but its PostToolUse
   matcher is '$REG_MATCHER' (must include Edit, Write, AND MultiEdit — a path-only gate's
   matcher is its ONLY tool-filter; without MultiEdit a MultiEdit edit bypasses it silently).
   Fix the matcher in .ai-factory/harness-model.json + run 'node scripts/render-harness-config.mjs --write'." ;;
    esac
  fi
fi

# @matcher-parity invariant: a hook with an internal `case "$TOOL" in <tools>)` filter
# self-declares the tools it handles. Its framework-self registration matcher MUST be a
# superset of that case-arm set — else the hook declares it handles a tool the matcher never
# delivers (the same silent-bypass class as @file-content-gate, but self-declared by the
# case-arm rather than a marker). Covers the case-TOOL gates that carry no @file-content-gate
# marker (check-kickoff-traps, check-worker-dispatch-channel, and check-hook-marker itself).
# Self-calibrating: a Write-only hook (`case "$TOOL" in Write)`, matcher Write) stays GREEN
# (inject-memory-codification A5) — no hardcoded MultiEdit requirement. CI-backstop: the same
# CC-config check as @file-content-gate above.
# Comment lines are stripped FIRST (^# / leading-whitespace-#) so a `case "$TOOL" in …` written
# inside prose/documentation (this very hook has such comments above) is never mis-extracted as
# the real code arm — mirrors the ^#-anchored marker check above.
CASE_ARM="$(grep -vE '^[[:space:]]*#' "$ABS_PATH" | grep -oE 'case[[:space:]]+"\$TOOL"[[:space:]]+in[^)]*' | head -1 || true)"
if [ -n "$CASE_ARM" ]; then
  PARITY_MATCHER="$(_reg_matcher "$(basename "$REL_PATH")")"
  if [ -n "$PARITY_MATCHER" ]; then
    # Tool tokens the case-arm handles: capitalised words only (the `case`/`in` keywords and
    # the `*)` wildcard arm are lower-case / punctuation → excluded). Membership is tested
    # against the |-delimited matcher token set exactly, so "Edit" does not spuriously satisfy
    # "MultiEdit".
    missing=""
    for tool in $(printf '%s' "$CASE_ARM" | tr '|' ' ' | tr -s ' ' '\n' | grep -xE '[A-Z][A-Za-z]+' || true); do
      case "|$PARITY_MATCHER|" in
        *"|$tool|"*) ;;
        *) missing="${missing:+$missing, }$tool" ;;
      esac
    done
    if [ -n "$missing" ]; then
      _adv_violation "❌ hook-marker: $REL_PATH has an internal \`case \"\$TOOL\" in …\` handling [$missing] but its PostToolUse matcher '$PARITY_MATCHER' does not deliver those tool(s).
   A narrowed matcher means the hook never fires on a tool its own body handles (silent bypass — the matcher-widening bug class).
   Widen the matcher in .ai-factory/harness-model.json to cover the case-arm + run 'node scripts/render-harness-config.mjs --write', or narrow the case-arm to match."
    fi
  fi
fi

exit 0
