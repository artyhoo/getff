#!/usr/bin/env bash
# @cc-only-rationale: drift check between the internal hook language packs — not shipped to consumer projects via install.sh
# @dual-pair: hook-lang-i18n
#
# Asserts en.sh and ru.sh expose the SAME set of aif_msg_* functions (+ the
# AIF_RECAP_MARKER variable). A new message added to one pack but not the other
# = drift; this is the deterministic, no-LLM guard against #two-prompts-drift
# at the leaf-string level. Run locally / at review; not a blocking pre-push gate
# (the packs feed internal, not-shipped hooks). Exit 0 = parity, 1 = drift.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

keys() {
  # Function names (aif_msg_*) + the marker var name, sorted.
  {
    grep -oE '^aif_msg_[a-z_]+\(\)' "$1" | sed 's/()$//'
    grep -qE '^AIF_RECAP_MARKER=' "$1" && echo 'AIF_RECAP_MARKER'
    grep -qE '^AIF_STORY_MARKER=' "$1" && echo 'AIF_STORY_MARKER'
    grep -oE '^AIF_EOT_[A-Z_]+=' "$1" | sed 's/=$//'
  } | sort -u
}

en="$(keys "$DIR/en.sh")"
ru="$(keys "$DIR/ru.sh")"

if [ "$en" = "$ru" ]; then
  echo "OK: en.sh and ru.sh expose identical keys ($(echo "$en" | wc -l | tr -d ' ') entries)."
  exit 0
fi

echo "DRIFT: en.sh and ru.sh key sets differ." >&2
echo "--- only in en.sh ---" >&2
comm -23 <(printf '%s\n' "$en") <(printf '%s\n' "$ru") >&2
echo "--- only in ru.sh ---" >&2
comm -13 <(printf '%s\n' "$en") <(printf '%s\n' "$ru") >&2
exit 1
