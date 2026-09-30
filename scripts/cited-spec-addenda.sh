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
# usage: bash scripts/cited-spec-addenda.sh <path>[:<line>] [--since <date|revision>]
#
# Baseline — the moment the cited intent was written:
#   <path>:<line>   the commit `git blame` attributes that line to
#   <path>          the commit that added the file (the spec date)
#   --since X       a revision (X..HEAD) or anything `git log --since` accepts
# Reports every later commit to <path> (LATER:) plus every heading in today's file that reads as an
# amendment (MARKER:). Markers read the working tree, not history, so they still fire when the cited
# line was reworded after the addendum and the blame baseline therefore post-dates it.
#
# Exit: 0 CLEAN (nothing later, no marker) · 2 AMENDED (read every LATER/MARKER before stamping
# BY-DESIGN) · 3 INCONCLUSIVE (untracked, line out of range, shallow history — absence unprovable)
# · 1 usage. Deterministic: git only, no network.
set -euo pipefail

usage() {
  echo "usage: bash scripts/cited-spec-addenda.sh <path>[:<line>] [--since <date|revision>]" >&2
  exit 1
}

inconclusive() {
  echo "REASON: $1"
  echo "VERDICT: INCONCLUSIVE"
  exit 3
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

path="${cite%%:*}"
line=""
if [ "$path" != "$cite" ]; then
  rest="${cite#*:}"
  # `path:12-30` and `path:12 §x` cite from line 12; a non-numeric suffix is a whole-file citation.
  line="${rest%%[!0-9]*}"
fi

echo "CITED: $cite"

git ls-files --error-unmatch -- "$path" >/dev/null 2>&1 || inconclusive "$path is not tracked by git"
if [ "$(git rev-parse --is-shallow-repository)" = "true" ]; then
  inconclusive "shallow clone — commits before the graft are invisible, so «nothing later» is unprovable"
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
  total="$(git show "HEAD:$path" | wc -l | tr -d ' ')"
  if [ "$line" -lt 1 ] || [ "$line" -gt "$total" ]; then
    inconclusive "line $line is outside $path at HEAD (1..$total)"
  fi
  blame="$(git blame --porcelain -L "$line,$line" HEAD -- "$path")"
  base="${blame%% *}"
  range="$base..HEAD"
  echo "BASELINE: $(git log -1 --format='%h %cs' "$base") (blame of line $line)"
else
  births="$(git log --diff-filter=A --format=%H -- "$path")"
  base="${births##*$'\n'}"
  [ -n "$base" ] || inconclusive "no commit adds $path"
  range="$base..HEAD"
  echo "BASELINE: $(git log -1 --format='%h %cs' "$base") (file birth)"
fi

if [ -n "$since_date" ]; then
  later="$(git log --since="$since_date" --format='%h %cs %s' -- "$path")"
else
  later="$(git log --format='%h %cs %s' "$range" -- "$path")"
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
# auditor skims past, so body prose is deliberately not scanned.
markers="$(grep -niE '^#{1,6}[[:space:]].*(addend|supersed|withdr|lapse|revok|premise chang)' "$path" || true)"
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
