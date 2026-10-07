#!/usr/bin/env bash
# @cc-only-rationale: internal shared helper invoked by CC and ZCode hook adapters; no standalone portable invocation channel
# Shared strict report section grammar for CC and ZCode consumers.
# report-sections.sh — shared REPORT cue and required-section grammar
_required_sections_check() {
  local text="$1"
  local REPORT_CUE_RE='^(#{1,3} *VERIFY|VERIFY:|Confidence:|ATTN:|Commit:)'
  if ! printf '%s' "$text" | grep -qE "$REPORT_CUE_RE"; then
    return 2   # noise guard: not a REPORT
  fi
  local -a missing=()
  if ! printf '%s' "$text" | grep -qE '^(#{1,3} *VERIFY|VERIFY:)'; then
    missing+=("VERIFY")
  fi
  if ! printf '%s' "$text" | grep -qE '^Confidence:'; then
    missing+=("Confidence")
  fi
  if ! printf '%s' "$text" | grep -qE '^(#{1,3} *ATTN|ATTN:)'; then
    missing+=("ATTN")
  fi
  if [ "${#missing[@]}" -gt 0 ]; then
    MISSING_LIST="$(IFS=', '; echo "${missing[*]}")"
    return 1
  fi
  return 0
}

