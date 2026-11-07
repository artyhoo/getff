#!/usr/bin/env bash
# @cc-only-rationale: NONE — shipped with the /pipeline skill. Drift guard between en.sh and ru.sh.
# @dual-pair: pipeline-lang-i18n
#
# Asserts en.sh and ru.sh expose the SAME set of AIF_PIPELINE_* / AIF_RECAP_MARKER
# variable keys. Deterministic, no LLM. Exit 0 = parity, 1 = drift.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

keys() { grep -oE '^(AIF_PIPELINE_[A-Z_]+|AIF_RECAP_MARKER)=' "$1" | sed 's/=$//' | sort -u; }

en="$(keys "$DIR/en.sh")"; ru="$(keys "$DIR/ru.sh")"
if [ "$en" = "$ru" ]; then
  echo "OK: en.sh and ru.sh expose identical keys ($(echo "$en" | wc -l | tr -d ' ') entries)."
  exit 0
fi
echo "DRIFT: en.sh and ru.sh key sets differ." >&2
echo "--- only in en ---" >&2; comm -23 <(printf '%s\n' "$en") <(printf '%s\n' "$ru") >&2
echo "--- only in ru ---" >&2; comm -13 <(printf '%s\n' "$en") <(printf '%s\n' "$ru") >&2
exit 1
