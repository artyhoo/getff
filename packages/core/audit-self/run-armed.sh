#!/usr/bin/env bash
# run-armed.sh — runs the checks this project's record arms (getff installs it as scripts/run-armed.sh).
# The record is the <!-- aif:project-checks:begin/end --> block of .ai-factory/tool-decisions.md that
# the install writes (setup.d/99-finalize.sh): under `armed:` and `not-armed:`, one command per line as
# `- <command>`, a not-armed one keeping its reason after ` # `. Every channel reads it: `npm run
# validate`, the delivered CI steps, lint-staged and the pre-push probe.
#   run-armed.sh validate          every armed command; a failure does not stop the rest, exit 1 if any
#                                  failed. Then --probe.
#   run-armed.sh --probe           every not-armed command, never blocking; one that exits 0 moves to
#                                  armed, so a check arms itself once the code is clean.
#   run-armed.sh <command…>        one check: skipped (exit 0, reason printed) while it is not-armed;
#                                  otherwise run — a command left out of the record is never skipped.
#   run-armed.sh --if-armed '<command>' <cmd…>   run <cmd…> unless <command> is not-armed (lint-staged).
# A missing or unreadable record exits 2: an empty armed list is valid only when the record says so.
set -uo pipefail
# The record sits beside the script (scripts/run-armed.sh → ../.ai-factory): an install below the git
# toplevel reads its own. Elsewhere (a copy outside an install) the git toplevel, then the cwd.
ROOT=$(cd "$(dirname "$0")/.." 2>/dev/null && pwd)
[ -e "$ROOT/.ai-factory/tool-decisions.md" ] || ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
REC="$ROOT/.ai-factory/tool-decisions.md"
B='<!-- aif:project-checks:begin -->' E='<!-- aif:project-checks:end -->'
block() { awk -v b="$B" -v e="$E" '{sub(/\r$/,"")} $0==e{f=0} f; $0==b{f=1}' "$REC"; }  # CRLF read as LF
if [ ! -r "$REC" ] || [ "$(block | grep -cxE 'armed:|not-armed:')" != 2 ]; then
  echo "❌ run-armed: no readable project-checks record (the aif:project-checks block with armed: and not-armed: in $REC) — re-run the getff install to write it" >&2
  exit 2
fi
list() { block | awk -v h="$1:" '/^[a-z-]+:$/{f=($0==h);next} f && sub(/^- /,"")'; }
cmd() { sed 's/ # .*$//'; }
not_armed() { list not-armed | cmd | grep -qxF -- "$1"; }
reason() { list not-armed | C="$1" awk '{l=$0; sub(/ # .*$/,"",l)} l==ENVIRON["C"] {sub(/^.* # /,""); print}'; }

arm() {  # $1 = a not-armed command, moved under armed: (the rest of the file is left as it is); 1 = not written
  local tmp rc; tmp=$(mktemp) || return 1
  C="$1" awk -v b="$B" -v e="$E" '
    {r=$0; sub(/\r$/,"",r)} r==b{f=1} r==e{f=0}
    f && r ~ /^[a-z-]+:$/ {s=r; print; if (s=="armed:") print "- " ENVIRON["C"]; next}
    f && s=="not-armed:" && r ~ /^- / {l=r; sub(/^- /,"",l); sub(/ # .*$/,"",l); if (l==ENVIRON["C"]) next}
    {print}' "$REC" > "$tmp" && cat "$tmp" > "$REC" 2>/dev/null; rc=$?
  rm -f "$tmp"; return "$rc"
}

probe() {
  local c cmds; cmds=$(list not-armed | cmd)
  while IFS= read -r c; do
    [ -n "$c" ] || continue
    if ( cd "$ROOT" && bash -c "$c" ) </dev/null >/dev/null 2>&1; then
      if arm "$c"; then echo "✓ armed now — it exits 0: $c"; else echo "✗ exits 0 but $REC could not be written, still not armed: $c" >&2; fi
    else
      echo "· not armed: $c — $(reason "$c")"
    fi
  done <<< "$cmds"
}

validate() {
  local c cmds failed=()
  cmds=$(list armed | cmd)
  while IFS= read -r c; do
    [ -n "$c" ] || continue
    echo "▶ $c"
    ( cd "$ROOT" && bash -c "$c" ) </dev/null || failed+=("$c (exit $?)")
  done <<< "$cmds"
  probe
  if [ "${#failed[@]}" -gt 0 ]; then
    printf '✗ failed: %s\n' "${failed[@]}"; return 1
  fi
  echo "✓ every armed check passed"
}

case "${1:-}" in
  validate) validate ;;
  --probe) probe ;;
  --if-armed) c="${2:-}"; shift 2; not_armed "$c" && exit 0; exec "$@" ;;
  "") echo "usage: run-armed.sh validate | --probe | <command…> | --if-armed '<command>' <cmd…>" >&2; exit 2 ;;
  *) if not_armed "$*"; then echo "· not armed: $* — $(reason "$*")"; exit 0; fi
     exec bash -c "$*" ;;
esac
