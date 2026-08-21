#!/usr/bin/env bash
# kickoff-hv-inventory.sh — classify the orchestrator-prompts population for the
# host-verify retrofit (park #2 of PR #1491): every kickoff must end up with a real
# contract, an explicit opt-out, or a visible legacy-closed marker — never silence.
#
# Lanes (fail-safe by direction of error: a doubtful file lands in an ATTENTION lane,
# never in the blanket lane — an open umbrella treated as closed requires BOTH a done.md
# AND post-closure activity that no bulk wave explains):
#   contracted        scripts/host-verify.sh --list exits 0 (contract OR opt-out; the
#                     runner is the SSOT for recognition — this script never re-implements it)
#   legacy-closed     done.md present AND last non-wave activity older than $MIN_DAYS
#                     → eligible for the mechanical blanket opt-out
#   attention/closed  done.md present but recent non-wave activity (or no non-wave
#                     commits at all) → human eyes before any blanket marker
#   attention/open    no done.md, no contract → needs a real contract
#
# Bulk-wave filter: a commit touching more than $WAVE_DIRS distinct umbrella dirs is a
# mechanical wave (back-catalog migration #523, done.md backfill, spelling sweeps), not
# evidence of life. Wave commits do not refresh a directory's activity date.
#
# Usage: bash scripts/kickoff-hv-inventory.sh [--min-days N] [--wave-dirs N]
# Exit 0 always (warn-phase tool); the retrofit's principle test consumes the lanes.

set -euo pipefail
MIN_DAYS=30
WAVE_DIRS=10
while [ $# -gt 0 ]; do
  case "$1" in
    --min-days) MIN_DAYS="$2"; shift 2 ;;
    --wave-dirs) WAVE_DIRS="$2"; shift 2 ;;
    *) echo "usage: $0 [--min-days N] [--wave-dirs N]" >&2; exit 2 ;;
  esac
done
REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$REPO_ROOT"

PROMPTS=".claude/orchestrator-prompts"
CUTOFF=$(date -v-"${MIN_DAYS}"d +%Y-%m-%d 2>/dev/null || date -d "-${MIN_DAYS} days" +%Y-%m-%d)

# ── Pass 1: one git log pass → per-commit distinct umbrella-dir counts → wave set ──
WAVE_COMMITS=$(mktemp)
git log --name-only --format='@@%h' -- "$PROMPTS" | awk -v w="$WAVE_DIRS" '
  /^@@/ { if (h != "" && n > w) print h; h = substr($0, 3); n = 0; delete seen; next }
  NF {
    split($0, p, "/");
    if (p[1] == ".claude" && p[2] == "orchestrator-prompts" && p[3] != "" && !seen[p[3]]) { seen[p[3]] = 1; n++ }
  }
  END { if (h != "" && n > w) print h }
' > "$WAVE_COMMITS"

# ── Pass 2: per-kickoff classification (lanes to a temp file — counters must
# survive, so the loop must NOT pipe through sort) ──
LANES=$(mktemp)
trap 'rm -f "$WAVE_COMMITS" "$WAVE_COMMITS.log" "$LANES"' EXIT
n_contract=0; n_legacy=0; n_attn_closed=0; n_attn_open=0
for d in "$PROMPTS"/*/; do
  k="${d}kickoff.md"
  [ -f "$k" ] || continue
  u=$(basename "$d")

  # SSOT recognition: the runner, not a grep (dual-implementation-discipline §8)
  if bash scripts/host-verify.sh --list "$k" >/dev/null 2>&1; then
    n_contract=$((n_contract + 1)); continue
  fi

  closed=no; [ -f "${d}done.md" ] && closed=yes

  # Last NON-wave commit touching the umbrella dir (wave commits from pass 1 don't count).
  # Via a temp file, not a pipe: an early break would SIGPIPE git-log under pipefail.
  git log --format='%h %cs' -- "$d" > "$WAVE_COMMITS.log"
  last=""
  while IFS=' ' read -r h c; do
    [ -n "$h" ] || continue
    if ! grep -qx "$h" "$WAVE_COMMITS"; then last="$c"; break; fi
  done < "$WAVE_COMMITS.log"

  if [ "$closed" = "yes" ]; then
    if [ -n "$last" ] && [ "$last" \< "$CUTOFF" ]; then
      n_legacy=$((n_legacy + 1)); echo "legacy-closed	$u	last=$last" >> "$LANES"
    else
      n_attn_closed=$((n_attn_closed + 1)); echo "attention/closed	$u	last=${last:-none-non-wave}" >> "$LANES"
    fi
  else
    n_attn_open=$((n_attn_open + 1)); echo "attention/open	$u	last=${last:-none-non-wave}" >> "$LANES"
  fi
done
sort "$LANES"

echo "── summary (min-days=$MIN_DAYS, wave-dirs>$WAVE_DIRS, cutoff=$CUTOFF) ──" >&2
echo "contracted: $n_contract  legacy-closed: $n_legacy  attention/closed: $n_attn_closed  attention/open: $n_attn_open" >&2
