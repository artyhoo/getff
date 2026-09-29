#!/usr/bin/env bash
# run-armed.sh — runs the checks this project's record arms (getff installs it as scripts/run-armed.sh).
# The record: the aif:project-checks block of .ai-factory/tool-decisions.md (setup.d/99-finalize.sh),
# `- <command>` lines under `armed:` / `not-armed:`, a not-armed one keeping its reason after ` # `.
# A check the probe finds green goes to a per-clone sidecar in the git dir (no dirty tree); `--fold`
# (the shipped pre-commit) moves it into the record and stages it, so the flip rides the next commit.
#   validate   every armed command, all run, exit 1 if any failed; then --probe
#   --probe    each not-armed command, never blocking, GETFF_PROBE_TIMEOUT_S (120) s each; exit 0 arms
#              it. A reason starting «not wired:» is structural: never run.
#   --fold     the sidecar into the record, in the working tree and the index
#   <command…> one check: skipped while not-armed, else run;  --if-armed '<command>' <cmd…>: lint-staged
# A missing or unreadable record exits 2: an empty armed list is valid only when the record says so.
set -uo pipefail
# The record sits beside the script (scripts/ → ../.ai-factory); a copy elsewhere: git toplevel, cwd.
ROOT=$(cd "$(dirname "$0")/.." 2>/dev/null && pwd)
[ -e "$ROOT/.ai-factory/tool-decisions.md" ] || ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
REC="$ROOT/.ai-factory/tool-decisions.md" RREL=.ai-factory/tool-decisions.md
B='<!-- aif:project-checks:begin -->' E='<!-- aif:project-checks:end -->'
G=$(git -C "$ROOT" rev-parse --absolute-git-dir 2>/dev/null) && SIDE="$G/getff-armed.local" || SIDE="$ROOT/.ai-factory/project-checks.local"
block() { awk -v b="$B" -v e="$E" '{sub(/\r$/,"")} $0==e{f=0} f; $0==b{f=1}' "$REC"; }  # CRLF read as LF
if [ ! -r "$REC" ] || [ "$(block | grep -cxE 'armed:|not-armed:')" != 2 ]; then
  echo "❌ run-armed: no readable project-checks record (the aif:project-checks block with armed: and not-armed: in $REC) — re-run the getff install to write it" >&2
  exit 2
fi
list() { block | awk -v h="$1:" '/^[a-z-]+:$/{f=($0==h);next} f && sub(/^- /,"")' | sed 's/ # .*$//'; }
flipped() { cat "$SIDE" 2>/dev/null | grep -xF -f <(list not-armed); }  # sidecar ∩ not-armed
armed() { { list armed; flipped; } | awk 'NF && !s[$0]++'; }
na() { list not-armed | grep -vxF -f <(flipped); }
reason() { block | C="$1" awk '/^[a-z-]+:$/{f=($0=="not-armed:");next} f && sub(/^- /,"") {l=$0; sub(/ # .*$/,"",l); if (l==ENVIRON["C"]) {sub(/^.* # /,""); print}}'; }
move() {  # stdin record → stdout with the commands in $1 (one per line) moved under armed:
  L="$1" awk -v b="$B" -v e="$E" 'BEGIN{n=split(ENVIRON["L"],a,"\n"); for(i=1;i<=n;i++) if(a[i]!="") m[a[i]]=1}
    {r=$0; sub(/\r$/,"",r)} r==b{f=1} r==e{f=0}
    f && r ~ /^[a-z-]+:$/ {print; if (r=="armed:") for (k in m) print "- " k; next}
    f && r ~ /^- / {l=r; sub(/^- /,"",l); sub(/ # .*$/,"",l); if (l in m) next} {print}'
}
fold() {
  local L t F; L=$(flipped); [ -n "$L" ] || { rm -f "$SIDE"; return 0; }; t=$(mktemp) || return 1
  { move "$L" < "$REC" > "$t" && cat "$t" > "$REC"; } || { rm -f "$t"; return 1; }
  if F=$(git -C "$ROOT" ls-files --full-name --error-unmatch "$RREL" 2>/dev/null) && git -C "$ROOT" show ":./$RREL" | move "$L" > "$t"; then
    git -C "$ROOT" update-index --cacheinfo "100644,$(git -C "$ROOT" hash-object -w "$t"),$F" || { rm -f "$t"; return 1; }
  fi
  rm -f "$t" "$SIDE"; echo "✓ armed in the record and staged with this commit: $(paste -sd, - <<< "$L")"
}
bounded() {  # $1 s, $2 command → its exit code; 124 = over the bound (its process group is killed)
  local p w rc; set -m
  ( cd "$ROOT" && exec bash -c "$2" ) </dev/null >/dev/null 2>&1 & p=$!
  ( sleep "$1"; kill -TERM -- -"$p" ) >/dev/null 2>&1 & w=$!
  wait "$p"; rc=$?; set +m; kill -- -"$w" 2>/dev/null || return 124; return "$rc"
}
probe() {
  local c r t="${GETFF_PROBE_TIMEOUT_S:-120}"
  while IFS= read -r c; do
    [ -n "$c" ] || continue; r=$(reason "$c")
    case "$r" in "not wired:"*) echo "· not armed: $c — $r"; continue ;; esac
    bounded "$t" "$c"; case $? in
      0) if echo "$c" >> "$SIDE"; then echo "✓ armed now — it exits 0: $c"; else echo "✗ exits 0 but $SIDE could not be written, still not armed: $c" >&2; fi ;;
      124) echo "· probe skipped: over $t s — $c (stays not armed)" ;;
      *) echo "· not armed: $c — $r" ;;
    esac
  done <<< "$(na)"
}
validate() {
  local c failed=()
  while IFS= read -r c; do
    [ -n "$c" ] || continue; echo "▶ $c"; ( cd "$ROOT" && bash -c "$c" ) </dev/null || failed+=("$c (exit $?)")
  done <<< "$(armed)"
  probe
  [ "${#failed[@]}" -eq 0 ] || { printf '✗ failed: %s\n' "${failed[@]}"; return 1; }
  echo "✓ every armed check passed"
}
case "${1:-}" in
  validate) validate ;; --probe) probe ;; --fold) fold ;;
  --if-armed) c="${2:-}"; shift 2; na | grep -qxF -- "$c" && exit 0; exec "$@" ;;
  "") echo "usage: run-armed.sh validate | --probe | --fold | <command…> | --if-armed '<command>' <cmd…>" >&2; exit 2 ;;
  *) if na | grep -qxF -- "$*"; then echo "· not armed: $* — $(reason "$*")"; exit 0; fi
     exec bash -c "$*" ;;
esac
