#!/usr/bin/env bash
# Read-only cache/pointer evidence. Bash owns glob handling on every host shell.
# @cc-only-rationale: invoked by the portable pipeline procedure through its shell tool
set -euo pipefail
home="$(bash "$(dirname "${BASH_SOURCE[0]}")/print-orch-home.sh")"
[ -n "$home" ] || { echo 'pipeline: orchestration home unavailable' >&2; exit 2; }
if [ -f "$home/_plan-cache.md" ]; then
  head -200 "$home/_plan-cache.md"
else
  echo '(no cache — live evidence must establish current state)'
fi
show_pointers() {
  local prefix="$1" label="$2" file candidate index count
  local newest=()
  # Select the newest three without word-splitting filenames or external sort/stat.
  for file in "$home"/"$prefix"-*.md; do
    [ -f "$file" ] || continue
    index=0
    while [ "$index" -lt "${#newest[@]}" ] && [ ! "$file" -nt "${newest[$index]}" ]; do
      index=$((index + 1))
    done
    count="${#newest[@]}"
    while [ "$count" -gt "$index" ]; do
      newest[$count]="${newest[$((count - 1))]}"
      count=$((count - 1))
    done
    newest[$index]="$file"
    [ "${#newest[@]}" -le 3 ] || unset 'newest[3]'
  done
  for file in ${newest[@]+"${newest[@]}"}; do
    printf '%s\n' "--- $label: POINTER only — re-verify before acting: $file"
    head -40 "$file"
  done
}
show_pointers _residue 'PreCompact residue (S2b/D8)'
show_pointers _handoff 'Model handoff (D15/D28)'
