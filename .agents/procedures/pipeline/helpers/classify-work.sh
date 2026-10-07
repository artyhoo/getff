#!/usr/bin/env bash
# classify-work.sh — L4 deterministic decomposition heuristics for meta-orchestrator planner.
#
# Usage: classify-work.sh <kickoff-path-or-description>
#
# Reads a kickoff file (path) or source description (literal string); emits
# work-item classification (fix / R-phase / I-phase-small / I-phase-large) +
# recommended dispatch mode for the meta-orchestrator. Deterministic; no LLM.
#
# Vocabulary ADAPTed from TaskMaster complexity tiers (SSOT #73; LLM impl rejected,
# vocab adopted) + Superpowers SDD 3-tier model selection (SSOT #74; small/medium/
# large maps cleanly to fix/I-phase-small/I-phase-large).
#
# @cc-only-rationale: meta-orchestrator skill helper — runs in-session via !shell
#   injection; no portable equivalent fires at the same moment (PostToolUse timing
#   is CC-specific) per dual-implementation-discipline.md §3.
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: classify-work.sh <kickoff-path-or-description>" >&2
  exit 2
fi

INPUT="$1"

# ── PATH-SHAPE STRICT CHECK (J1 fix, 2026-05-26) ─────────────────────────────
# Stage 5 dogfood §5 J1: a non-existent path-shape input would silently fall
# through to string-mode, classifying as TYPE=fix (LOC=1 SURFACES=1) — poisoning
# the routing cascade for any synthetic candidate whose kickoff is absent.
# Counter: detect path-shape (contains '/' AND ends in code/doc extension);
# if path-shape AND file absent → emit MISSING-FILE on stderr + exit 3.
# Reserve string-mode fallback for inputs that don't look like file paths.
if [[ "${INPUT}" == */* ]] \
  && [[ "${INPUT}" =~ \.(md|ts|tsx|js|sh|yml|yaml|json|toml|py)$ ]] \
  && [[ ! -f "${INPUT}" ]]; then
  echo "MISSING-FILE: ${INPUT}" >&2
  exit 3
fi

# ── BODY ACQUISITION ─────────────────────────────────────────────────────────
# File-vs-string detection: if INPUT is an existing file, read it; else treat
# the INPUT value as a literal description string.
if [[ -f "${INPUT}" ]]; then
  BODY="$(cat "${INPUT}")"
  # LOC = actual line count; empty file → LOC=0 → falls into fix tier (documented)
  LOC="$(wc -l < "${INPUT}" 2>/dev/null || echo 0)"
  LOC="${LOC// /}"   # trim whitespace from wc -l output
  INPUT_MODE="file"
else
  BODY="${INPUT}"
  # Estimate LOC from word count / 6 (TaskMaster vocabulary heuristic); min 1
  WORD_COUNT="$(echo "${BODY}" | wc -w | tr -d ' ')"
  LOC=$(( WORD_COUNT / 6 ))
  [[ "${LOC}" -lt 1 ]] && LOC=1
  INPUT_MODE="string"
fi

# ── HEURISTIC 1: R-phase keyword detection (highest priority) ─────────────────
# Matches "R-phase", "research patch", "prior art", "prior-art", "survey" (case-insensitive).
# Fires before LOC/SURFACES sizing — research items are always R-phase regardless of size.
if grep -qiE 'R-phase|research[- ]patch|prior[- ]art|survey' <<<"${BODY}"; then
  TYPE="R-phase"
  DISPATCH="R-phase-session"
  RATIONALE="R-phase keyword matched: research/prior-art/survey trigger"
  echo "TYPE: ${TYPE}"
  echo "DISPATCH: ${DISPATCH}"
  echo "LOC: ${LOC}"
  echo "SURFACES: 0"
  echo "RATIONALE: ${RATIONALE}"
  exit 0
fi

# ── HEURISTIC 2: SURFACES count ───────────────────────────────────────────────
# Count unique file-path mentions in body matching common code/doc extensions.
# Regex matches path-like tokens ending in .ts|tsx|js|sh|md|yml|yaml|json.
# Paths with spaces are NOT matched (documented decision; spaces are uncommon
# in source paths and the regex keeps it simple/deterministic).
# '|| true' guards against grep exit-1 when no matches (set -e would abort otherwise).
SURFACES="$(echo "${BODY}" \
  | { grep -oE '[a-zA-Z0-9._/-]+\.(ts|tsx|js|sh|md|yml|yaml|json)' || true; } \
  | sort -u \
  | wc -l \
  | tr -d ' ')"

# ── HEURISTIC 3: SIZE-TIER CLASSIFICATION (SDD 3-tier vocabulary) ─────────────
# Tier boundaries (SSOT #74 Superpowers SDD):
#   fix (small/mechanical):   LOC ≤5  AND SURFACES ≤1  → direct-Edit
#   I-phase-small (medium):   LOC ≤80 AND SURFACES ≤1  → Mode-A
#   I-phase-large (large):    LOC >80  OR SURFACES ≥2   → Mode-B
if [[ "${LOC}" -le 5 && "${SURFACES}" -le 1 ]]; then
  TYPE="fix"
  DISPATCH="direct-Edit"
  RATIONALE="LOC=${LOC}≤5, SURFACES=${SURFACES}≤1 → small/mechanical tier (SDD fix)"
elif [[ "${LOC}" -le 80 && "${SURFACES}" -le 1 ]]; then
  TYPE="I-phase-small"
  DISPATCH="Mode-A"
  RATIONALE="LOC=${LOC}≤80, SURFACES=${SURFACES}≤1 → medium/integration tier (SDD Mode-A)"
else
  TYPE="I-phase-large"
  DISPATCH="Mode-B"
  if [[ "${SURFACES}" -ge 2 ]]; then
    RATIONALE="SURFACES=${SURFACES}≥2 → large/judgment tier (SDD umbrella Mode-B)"
  else
    RATIONALE="LOC=${LOC}>80 → large/judgment tier (SDD umbrella Mode-B)"
  fi
fi

echo "TYPE: ${TYPE}"
echo "DISPATCH: ${DISPATCH}"
echo "LOC: ${LOC}"
echo "SURFACES: ${SURFACES}"
echo "RATIONALE: ${RATIONALE}"
