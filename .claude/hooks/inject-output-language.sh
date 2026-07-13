#!/usr/bin/env bash
# @cc-only-rationale: CC-specific UserPromptSubmit hook — its stdout is auto-injected into the
#   Claude Code prompt context by the harness, a CC-native fire-point with no portable counterpart.
#   SHIPPED to consumer CC projects (GH #934, per-hook audit batch B): the consumer-generic slice
#   EXTRACTED from the maintainer-only inject-session-bootstrap.sh — it emits ONLY the language
#   signal (never the framework-self-referential goal/invariants digest, which stays INTERNAL).
#   Consumer-safe: pure bash (no jq, no framework-internal artefact), zero-setup default (en → no-op).
#
# Purpose: when the operator pins a non-English human-facing language via AIF_HOOK_LANG, tell the
# model — every turn, all skills — so chat/recaps/narration follow that language while ALL repo
# artefacts + machinery stay English. Precisely scoped: this injects an instruction to the model,
# not a translation of anything. See .claude/rules/language-discipline.md §2 (category 2, human-facing).
#
# Consumer setup: export AIF_HOOK_LANG in your shell, or add an `env` block to .claude/settings.json:
#   { "env": { "AIF_HOOK_LANG": "ru" } }
# Unset / "en" → nothing is injected (English is the zero-setup default).
set -uo pipefail

case "${AIF_HOOK_LANG:-en}" in
  en|'') : ;;  # English default — nothing to inject
  ru)
    cat <<'LANGRU'
[output-language] Address the operator in Russian — chat explanations, recaps, narration, questions. Keep ALL repo artifacts and machinery in English: code, comments, commit/PR/issue bodies, kickoffs, specs, tool arguments, file contents. (AIF_HOOK_LANG=ru)
LANGRU
    ;;
  *)
    printf '[output-language] Address the operator in language "%s"; keep repo artifacts and machinery in English. (AIF_HOOK_LANG=%s)\n' "$AIF_HOOK_LANG" "$AIF_HOOK_LANG"
    ;;
esac
