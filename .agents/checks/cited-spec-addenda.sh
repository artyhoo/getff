#!/usr/bin/env bash
# cited-spec-addenda.sh — has the artefact cited as BY-DESIGN been amended since the cited intent?
#
# A BY-DESIGN verdict rests on a citation to «the artefact that declares the intent». When a premise
# changes, the supersession clause (.claude/rules/doc-authority-hierarchy.md §4.1) amends THAT
# artefact — typically by appending an addendum that withdraws a decision. An auditor who reads only
# the cited line never sees the addendum and blesses a real gap as deliberate (incident 2026-09-08,
# PR #1675: consumer-truth-audit would have stamped an undelivered writer BY-DESIGN off a withdrawn
# D18/D20). This helper makes «was the cited artefact amended later?» a command with an exit code
# instead of an act of attention (.claude/rules/attention-is-not-a-mechanism.md §1).
#
# usage: bash scripts/cited-spec-addenda.sh <path>[:<line>] [--since <YYYY-MM-DD|revision>]
#
# <path> is repo-relative (the form citations use), wherever the helper runs from.
#
# Baseline — the moment the cited intent was written:
#   <path>:<line>   the commit `git blame` attributes that line to
#   <path>          the commit that added the file, followed across renames (the spec date)
#   --since X       a revision (X..HEAD) or a strict YYYY-MM-DD date; anything else is a usage
#                   error, because git's date parser accepts junk and a junk date reads as CLEAN
# Reports every later commit to <path> (LATER:) plus every heading in today's file that reads as an
# amendment (MARKER:). Markers read the working tree, not history, so they still fire when the cited
# line was reworded after the addendum and the blame baseline therefore post-dates it.
#
# Exit: 0 CLEAN (nothing later, no marker) · 2 AMENDED (read every LATER/MARKER before stamping
# BY-DESIGN) · 3 INCONCLUSIVE (untracked or never committed, line out of range, shallow history,
# any unexpected git failure — absence unprovable) · 1 usage. Every exit but 1 prints a VERDICT:
# line. Deterministic: git + awk only, no network.
set -euo pipefail

usage() {
  echo "usage: bash scripts/cited-spec-addenda.sh <path>[:<line>] [--since <YYYY-MM-DD|revision>]" >&2
  exit 1
}

inconclusive() {
  echo "REASON: $1"
  echo "VERDICT: INCONCLUSIVE"
  exit 3
}

# A strict calendar date, checked here because `git log --since` silently accepts
# `2026-09-31`, `garbage words` and a mistyped SHA — each would report a false CLEAN.
valid_date() {
  local y m d dim
  [[ "$1" =~ ^([0-9]{4})-([0-9]{2})-([0-9]{2})$ ]] || return 1
  y=$((10#${BASH_REMATCH[1]})) m=$((10#${BASH_REMATCH[2]})) d=$((10#${BASH_REMATCH[3]}))
  [ "$m" -ge 1 ] && [ "$m" -le 12 ] || return 1
  case "$m" in
    4 | 6 | 9 | 11) dim=30 ;;
    2) if [ $((y % 4)) -eq 0 ] && { [ $((y % 100)) -ne 0 ] || [ $((y % 400)) -eq 0 ]; }; then dim=29; else dim=28; fi ;;
    *) dim=31 ;;
  esac
  [ "$d" -ge 1 ] && [ "$d" -le "$dim" ]
}

[ $# -ge 1 ] || usage
cite="$1"
shift
since=""
while [ $# -gt 0 ]; do
  case "$1" in
    --since)
      [ $# -ge 2 ] || usage
      since="$2"
      shift 2
      ;;
    *) usage ;;
  esac
done
case "$cite" in -*) usage ;; esac

# Split on the LAST colon followed by a line number, so a path may itself contain `:`.
# `path:12-30` and `path:12 §x` cite from line 12; `path:§x` is a whole-file citation.
line=""
if [[ "$cite" =~ ^(.+):([0-9]+)([^:0-9][^:]*)?$ ]]; then
  path="${BASH_REMATCH[1]}"
  line="${BASH_REMATCH[2]}"
elif [ -e "$cite" ] || [[ "$cite" != *:* ]]; then
  path="$cite"
else
  path="${cite%:*}"
fi

root="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "CITED: $cite"
  inconclusive "not inside a git work tree"
}
cd "$root"
trap 'echo "REASON: unexpected git failure (line $LINENO)"; echo "VERDICT: INCONCLUSIVE"; exit 3' ERR

echo "CITED: $cite"

if [ -n "$since" ] && ! git rev-parse --verify -q "$since^{commit}" >/dev/null && ! valid_date "$since"; then
  echo "--since '$since' is neither a revision nor a YYYY-MM-DD date" >&2
  usage
fi

git ls-files --error-unmatch -- "$path" >/dev/null 2>&1 || inconclusive "$path is not tracked by git"
git cat-file -e "HEAD:./$path" 2>/dev/null || inconclusive "$path has never been committed"
if [ "$(git rev-parse --is-shallow-repository)" = "true" ]; then
  inconclusive "shallow clone — commits before the graft are invisible, so «nothing later» is unprovable"
fi

if [ -n "$line" ]; then
  # awk NR, not `wc -l`: an unterminated last line is still a line.
  total="$(git show "HEAD:./$path" | awk 'END { print NR }')"
  if [ "$line" -lt 1 ] || [ "$line" -gt "$total" ]; then
    inconclusive "line $line is outside $path at HEAD (1..$total)"
  fi
fi

range=""
since_date=""
if [ -n "$since" ]; then
  if base="$(git rev-parse --verify -q "$since^{commit}")"; then
    range="$base..HEAD"
    echo "BASELINE: $(git log -1 --format='%h %cs' "$base") (--since $since)"
  else
    since_date="$since"
    echo "BASELINE: $since (--since $since)"
  fi
elif [ -n "$line" ]; then
  blame="$(git blame --porcelain -L "$line,$line" HEAD -- "$path")"
  base="${blame%% *}"
  range="$base..HEAD"
  echo "BASELINE: $(git log -1 --format='%h %cs' "$base") (blame of line $line)"
else
  # --follow: after `git mv`, the rename is not the birth — the original add is.
  births="$(git log --follow --diff-filter=A --format=%H -- "$path")"
  base="${births##*$'\n'}"
  [ -n "$base" ] || inconclusive "no commit adds $path"
  range="$base..HEAD"
  echo "BASELINE: $(git log -1 --format='%h %cs' "$base") (file birth)"
fi

if [ -n "$since_date" ]; then
  later="$(git log --follow --since="$since_date" --format='%h %cs %s' -- "$path")"
else
  later="$(git log --follow --format='%h %cs %s' "$range" -- "$path")"
fi

later_n=0
if [ -n "$later" ]; then
  while IFS= read -r l; do
    echo "LATER: $l"
    later_n=$((later_n + 1))
  done <<<"$later"
fi

# Amendment-shaped headings in today's file. The vocabulary is the one this repo's own amendments
# use (`Consumer-axis addendum`, «withdraw», «supersedes», «lapsed»); a heading is the unit an
# auditor skims past, so body prose is deliberately not scanned, and neither are fenced code
# blocks (a `# revoke the token` shell comment is not a heading). awk without `{n}` intervals and
# with tolower(), so BSD awk and mawk agree.
markers="$(awk '
  /^[ \t]*(```|~~~)/ { fenced = !fenced; next }
  fenced { next }
  {
    l = tolower($0)
    if (l ~ /^#+[ \t]/ && l ~ /(addend|supersed|withdr|lapse|revok|premise chang)/) print NR ":" $0
  }
' "$path")"
marker_n=0
if [ -n "$markers" ]; then
  while IFS= read -r m; do
    echo "MARKER: $path:$m"
    marker_n=$((marker_n + 1))
  done <<<"$markers"
fi

if [ "$later_n" -eq 0 ] && [ "$marker_n" -eq 0 ]; then
  echo "VERDICT: CLEAN"
  exit 0
fi
echo "VERDICT: AMENDED later=$later_n markers=$marker_n"
exit 2
