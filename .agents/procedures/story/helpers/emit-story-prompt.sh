#!/usr/bin/env bash
# Portable /story helper — bridges the canonical procedure to its shipped language packs.
# @dual-pair: session-story-recap
#
# Sources the active-language hook lang pack (AIF_HOOK_LANG, default en, EN
# fallback) and echoes the full story-instruction prose (aif_msg_eot_branch_story).
# The /story procedure invokes this via Bash, then
# renders the session-scale recap the instruction prescribes. Single SSOT: the prose
# lives only in .agents/hooks/lang/{en,ru}.sh.
set -euo pipefail

_repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
_lang="${AIF_HOOK_LANG:-en}"
# Language is a pack name, never a path to another executable shell file.
case "$_lang" in *[!a-zA-Z0-9_-]*) _lang=en ;; esac
_lang_file="${_repo}/.agents/hooks/lang/${_lang}.sh"
[ -f "$_lang_file" ] || _lang_file="${_repo}/.agents/hooks/lang/en.sh"
# shellcheck source=/dev/null
. "$_lang_file"

anchor="${anchor:-}"   # /story has no transcript anchor; the skill names the goal from context
# Buffer the complete instruction: partial output must never look like a usable spec.
if _instruction="$(aif_msg_eot_branch_story)"; then
  if [ -z "${_instruction//[[:space:]]/}" ]; then
    printf 'story helper: empty story instruction\n' >&2
    exit 1
  fi
  printf '%s\n' "$_instruction"
else
  _status=$?
  exit "$_status"
fi
