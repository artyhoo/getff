#!/usr/bin/env bash
# @cc-only-rationale: CC-specific PreToolUse:AskUserQuestion hook — it can only fire inside a
#   Claude Code session (the deny/permissionDecision contract is CC-native), so there is no
#   portable counterpart by nature (the @dual-pair below is the internal en/ru i18n split, not a
#   portability pair). NOW SHIPPED to consumer CC projects (GH #934): a generic pre-question
#   fork-challenge nudge — session UX, not framework-bound. Consumer-safe: no framework-internal
#   artefact dependency, reuses the already-shipped lang pack (aif_msg_question_challenge), and
#   degrades to exit 0 when jq is absent.
#
# Companion to .claude/hooks/end-of-turn-reminder.sh (Stop hook). Division of labour:
#   • end-of-turn-reminder.sh (Stop)      → END-OF-TURN recap + goal-drift verdict.
#   • this hook (PreToolUse:AskUserQuestion) → PRE-QUESTION fork-challenge, fired the
#     moment the model is about to ask the user.
# Why a separate hook: a Stop event does NOT reliably fire when a turn ends in
# AskUserQuestion (the CC harness treats AUQ as an interaction-pending tool, so the
# Stop-hook recap never reached the model). The Stop+AUQ interaction is undocumented;
# the PreToolUse path IS documented. Verified dual-channel 2026-05-21
# (claude-code-guide built-in + DeepWiki anthropics/claude-code): PreToolUse blocks via
# hookSpecificOutput.permissionDecision="deny" + permissionDecisionReason; exit 0 → JSON parsed.
#
# Loop-safety: PreToolUse has NO stop_hook_active equivalent. A blanket deny on every
# AskUserQuestion would loop (deny → regenerate → ask → deny …). Guard = a session-scoped
# recency flag: challenge once, then let the immediate retry (and any AUQ within the
# window) through. A genuinely-new question moment (>window since the last reminder) is
# challenged afresh. Worst case if any assumption is wrong: malformed JSON → CC falls back
# to normal flow → the question proceeds (benign, no block).
set -euo pipefail

# Consumer-skip guard (GH #934): the hook parses stdin + emits its decision via jq. Absent jq →
# no work possible → exit 0 silently (never error-spam a consumer's every AskUserQuestion). The
# framework session always has jq; a minimal consumer may not.
command -v jq >/dev/null 2>&1 || exit 0

# Language pack (payload prose). Default en (canonical, public repo); operator sets
# AIF_HOOK_LANG=ru in ~/.claude/settings.json env. Missing pack → en fallback.
# @dual-pair: hook-lang-i18n (spec: docs/superpowers/specs/2026-06-01-hook-lang-i18n-design.md)
_lang_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lang"
_lang_file="${_lang_dir}/${AIF_HOOK_LANG:-en}.sh"
[ -f "$_lang_file" ] || _lang_file="${_lang_dir}/en.sh"
# shellcheck source=/dev/null
. "$_lang_file"

input=$(cat)

tool_name=$(echo "$input" | jq -r '.tool_name // empty' 2>/dev/null || echo "")
# Defensive: the settings.json matcher already restricts to AskUserQuestion, but never
# act on anything else if the matcher is ever broadened.
if [ "$tool_name" != "AskUserQuestion" ]; then
  exit 0
fi

session_id=$(echo "$input" | jq -r '.session_id // "nosession"' 2>/dev/null || echo "nosession")
flag="${TMPDIR:-/tmp}/aif-ask-reminded-${session_id}"
window=45

# Recency guard: if we reminded within the window, this AUQ is the retry (or a
# closely-following question) — let it through to avoid the deny→retry loop.
if [ -f "$flag" ]; then
  now=$(date +%s)
  # GNU-first, BSD-fallback (see end-of-turn-reminder.sh): GNU `stat -f %m` exits 0 with a
  # garbage value on Linux, so BSD-first silently breaks the freshness check there.
  mtime=$(stat -c %Y "$flag" 2>/dev/null || stat -f %m "$flag" 2>/dev/null || echo 0)
  if [ "$(( now - mtime ))" -lt "$window" ]; then
    exit 0
  fi
fi

# Fresh challenge: record the moment, then deny once so the model reconsiders before asking.
touch "$flag"

reminder=$(aif_msg_question_challenge)

jq -n --arg r "$reminder" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: $r
  }
}'
exit 0
