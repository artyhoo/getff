#!/usr/bin/env bash
# rule-load-adherence.sh — the adherence half of the trigger build slice-2 proof: does a session
# still follow getff's heaviest rules once their full text stops loading on read (the
# `claudeMdExcludes` switch) and only the rule loader's summary arrives on edit?
#
# `run` sends every `<name>.task.md` in the tasks directory through scripts/rule-load-replay.sh
# twice — "before" (the clone as it is) and "after" (`--exclude local --patch <rules patch>`) —
# and builds a BLINDED packet for a cold judge: per task, the task and its rubric plus two
# variants X and Y (which state each is stays in key.txt, outside the packet). Each variant
# holds the session's final reply, its tool calls, and its own diff (the replay commits the
# prepared state first, so the diff never shows the patch or the settings).
# `score` maps the judge's verdict lines back through key.txt and totals them.
# The judge protocol is scripts/rule-load-replay/judge.md.
#
# HOST-ONLY and NOT for CI: each run is a live `claude -p` session on the operator's own
# subscription (no-paid-llm-in-ci.md). Plumbing is tested with a stub replay in
# scripts/rule-load-adherence.test.sh.
#
# Usage:
#   rule-load-adherence.sh run --patch <rules.patch> [--tasks-dir <dir>] [--out <dir>]
#   rule-load-adherence.sh score <out-dir> <verdicts-file>
#   --tasks-dir defaults to scripts/rule-load-replay/adherence; every <name>.task.md needs a
#   <name>.rubric.md beside it.
# Verdict line (one per task and variant, other lines ignored):
#   VERDICT task=<name> variant=<X|Y> grade=<PASS|PARTIAL|FAIL> evidence="<quote>"
# Output of score (grep-stable):
#   ADHERENCE task=<name> before=<grade> after=<grade>
#   ADHERENCE-TOTAL before=<points> after=<points> max=<points>   (PASS 2, PARTIAL 1, FAIL 0)
#   NATIVE-CHARS before=<n> after=<n>   (session-population native rule-load characters, summed)
# Env overrides: REPLAY (default: scripts/rule-load-replay.sh); ADHERENCE_KEY=XY|YX fixes the
#   assignment (XY = before is X) instead of a random one per task — for tests.
# Exit: 0 done; 2 bad arguments; 5 a verdict is missing or malformed; a failing replay exits
#   with its own status.
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPLAY="${REPLAY:-$HERE/rule-load-replay.sh}"
TOOLS="Read,Edit,Write,Grep,Glob"
die() { echo "rule-load-adherence: $*" >&2; exit 2; }
command -v jq >/dev/null 2>&1 || die "missing dependency: jq"

# One variant directory: final reply, tool calls in order, and the session's own diff.
variant() {
  local run="$1" dest="$2"
  mkdir -p "$dest"
  jq -r '.result // ""' "$run/result.json" > "$dest/result.txt"
  find "$run/transcript" -name '*.jsonl' -print0 | xargs -0 cat \
    | jq -r 'select(.type == "assistant") | .message.content[]? | select(.type == "tool_use")
             | "\(.name) \(.input.file_path // .input.pattern // .input.path // "")"' > "$dest/tools.txt"
  git -C "$run/clone" add -A -N
  git -C "$run/clone" diff HEAD > "$dest/diff.patch"
}

cmd_run() {
  local patch="" tasks="$HERE/rule-load-replay/adherence" out=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --patch) patch="${2:-}"; shift 2 ;;
      --tasks-dir) tasks="${2:-}"; shift 2 ;;
      --out) out="${2:-}"; shift 2 ;;
      *) die "unknown argument: $1" ;;
    esac
  done
  [ -f "$patch" ] || die "--patch not found: ${patch:-<unset>}"
  [ -d "$tasks" ] || die "--tasks-dir not found: $tasks"
  local names=() f n
  for f in "$tasks"/*.task.md; do
    [ -f "$f" ] || continue
    n="$(basename "$f" .task.md)"
    [ -f "$tasks/$n.rubric.md" ] || die "no rubric for task $n"
    names+=("$n")
  done
  [ "${#names[@]}" -gt 0 ] || die "no *.task.md in $tasks"
  [ -n "$out" ] || out="$(mktemp -d "${TMPDIR:-/tmp}/getff-adherence-XXXXXX")"
  mkdir -p "$out/runs" "$out/packet"
  : > "$out/key.txt"
  local key x y
  for n in "${names[@]}"; do
    bash "$REPLAY" --label "$n-before" --prompt-file "$tasks/$n.task.md" \
      --allowed-tools "$TOOLS" --out "$out/runs/$n-before"
    bash "$REPLAY" --label "$n-after" --prompt-file "$tasks/$n.task.md" \
      --allowed-tools "$TOOLS" --exclude local --patch "$patch" --out "$out/runs/$n-after"
    key="${ADHERENCE_KEY:-$([ $((RANDOM % 2)) -eq 0 ] && echo XY || echo YX)}"
    if [ "$key" = XY ]; then x=before y=after; else x=after y=before; fi
    mkdir -p "$out/packet/$n"
    cp "$tasks/$n.task.md" "$out/packet/$n/task.md"
    cp "$tasks/$n.rubric.md" "$out/packet/$n/rubric.md"
    variant "$out/runs/$n-$x" "$out/packet/$n/X"
    variant "$out/runs/$n-$y" "$out/packet/$n/Y"
    echo "task=$n X=$x Y=$y" >> "$out/key.txt"
  done
  echo "rule-load-adherence: packet $out/packet (key in $out/key.txt — do not hand it to the judge)"
}

points() { case "$1" in PASS) echo 2 ;; PARTIAL) echo 1 ;; FAIL) echo 0 ;; *) echo x ;; esac; }

cmd_score() {
  local out="${1:-}" verdicts="${2:-}"
  [ -f "$out/key.txt" ] || die "no key.txt in ${out:-<unset>}"
  [ -f "$verdicts" ] || die "verdicts file not found: ${verdicts:-<unset>}"
  local task x y gx gy gb ga pb=0 pa=0 max=0 nb=0 na=0 c
  while read -r line; do
    task="${line#task=}"; task="${task%% *}"
    x="$(sed -E 's/.* X=([a-z]+).*/\1/' <<<"$line")"; y="$(sed -E 's/.* Y=([a-z]+).*/\1/' <<<"$line")"
    gx="$(grep -E "^VERDICT task=$task variant=X grade=" "$verdicts" | head -1 | sed -E 's/.* grade=([A-Z]+).*/\1/')" || true
    gy="$(grep -E "^VERDICT task=$task variant=Y grade=" "$verdicts" | head -1 | sed -E 's/.* grade=([A-Z]+).*/\1/')" || true
    if [ "$(points "${gx:-}")" = x ] || [ "$(points "${gy:-}")" = x ]; then
      echo "rule-load-adherence: missing or malformed verdict for task $task" >&2; exit 5; fi
    if [ "$x" = before ]; then gb="$gx" ga="$gy"; else gb="$gy" ga="$gx"; fi
    echo "ADHERENCE task=$task before=$gb after=$ga"
    pb=$((pb + $(points "$gb"))); pa=$((pa + $(points "$ga"))); max=$((max + 2))
    c="$(sed -nE 's/^NATIVE-RULE-LOADS pop=session .*chars=([0-9]+).*/\1/p' "$out/runs/$task-before/summary.txt" 2>/dev/null | head -1)"
    nb=$((nb + ${c:-0}))
    c="$(sed -nE 's/^NATIVE-RULE-LOADS pop=session .*chars=([0-9]+).*/\1/p' "$out/runs/$task-after/summary.txt" 2>/dev/null | head -1)"
    na=$((na + ${c:-0}))
  done < "$out/key.txt"
  echo "ADHERENCE-TOTAL before=$pb after=$pa max=$max"
  echo "NATIVE-CHARS before=$nb after=$na"
}

mode="${1:-}"; [ $# -gt 0 ] && shift
case "$mode" in
  run) cmd_run "$@" ;;
  score) cmd_score "$@" ;;
  *) die "usage: rule-load-adherence.sh run --patch <file> [--tasks-dir <dir>] [--out <dir>] | score <out-dir> <verdicts>" ;;
esac
