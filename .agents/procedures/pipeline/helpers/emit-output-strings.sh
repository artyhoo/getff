#!/usr/bin/env bash
# @cc-only-rationale: NONE — shipped with the /pipeline skill (install.sh). Emits the active-language session-report tokens for SKILL.md §10 !shell injection.
# @dual-pair: pipeline-lang-i18n
#
# Sources the language pack selected by AIF_HOOK_LANG (default en; hard EN
# fallback if the requested pack file is missing), then echoes every emitted
# token as KEY=value lines for the skill to read in §10.
# See docs/superpowers/specs/2026-06-03-pipeline-skill-i18n-design.md.
set -euo pipefail

_lang_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../lang" && pwd)"
_lang_file="${_lang_dir}/${AIF_HOOK_LANG:-en}.sh"
[ -f "$_lang_file" ] || _lang_file="${_lang_dir}/en.sh"
# shellcheck source=/dev/null
. "$_lang_file"

for k in AIF_PIPELINE_COL_PASTE AIF_PIPELINE_COL_WHEN AIF_PIPELINE_COL_WAITING \
         AIF_PIPELINE_COL_PARALLEL AIF_PIPELINE_LBL_WHATDOES AIF_PIPELINE_LBL_WHYNOW \
         AIF_PIPELINE_STATUS_CURRENT AIF_PIPELINE_WAVE_NOW AIF_PIPELINE_ACTION_QUEUE_SUB \
         AIF_RECAP_MARKER; do
  printf '%s=%s\n' "$k" "${!k}"
done

# Active human-facing language (basename of the actually-sourced pack — reflects the EN
# fallback when the requested pack is missing). The SKILL reads this to write report PROSE,
# not only the localized table tokens above.
printf 'AIF_OUTPUT_LANG=%s\n' "$(basename "$_lang_file" .sh)"
