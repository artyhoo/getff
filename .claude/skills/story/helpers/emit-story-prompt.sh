#!/usr/bin/env bash
# @cc-only-rationale: internal /story skill helper — bridges the markdown skill to the shared hook lang pack; not shipped to consumer projects via install.sh
# @dual-pair: session-story-recap
#
# Sources the active-language hook lang pack (AIF_HOOK_LANG, default en, EN
# fallback) and echoes the full story-instruction prose (aif_msg_eot_branch_story).
# The /story SKILL.md invokes this via `!bash` (markdown cannot `source`), then
# renders the session-scale recap the instruction prescribes. Single SSOT: the prose
# lives only in .claude/hooks/lang/{en,ru}.sh.
set -euo pipefail

_repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
_lang_file="${_repo}/.claude/hooks/lang/${AIF_HOOK_LANG:-en}.sh"
[ -f "$_lang_file" ] || _lang_file="${_repo}/.claude/hooks/lang/en.sh"
# shellcheck source=/dev/null
. "$_lang_file"

anchor="${anchor:-}"   # /story has no transcript anchor; the skill names the goal from context
aif_msg_eot_branch_story
