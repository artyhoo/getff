#!/usr/bin/env bash
# bundle-curate.sh — B1 bundle-decision-rule helper for /pipeline planner.
#
# Usage: bundle-curate.sh <backlog-file>
#
# Reads a backlog file (one item per line); each non-blank, non-comment line is
# either a path to a kickoff file OR a literal description string. For each item,
# invokes L4 classify-work.sh + L5 assign-skill.sh, applies B1 eligibility filter
# (fix + I-phase-small only), rejects file-overlap pairs (>=2 candidates touching
# the same file), hard-caps bundle at 5 items (T-BA-A), and emits a markdown table
# to stdout.
#
# Output schema (markdown table):
#   | idx | item-source | classification | dispatch-mode | assigned-skill | file-scope | notes |
#
# Per merged R-phase patch docs/meta-factory/research-patches/
#   2026-05-26-bundle-autonomous-prior-art.md §5:
#   BUILD verdict — vocabulary ADAPTed from Renovate packageRules (eligibility filter
#   shape) + Dependabot groups: (grouping semantics) but mechanism is ours (no upstream
#   wraps classify-work.sh / assign-skill.sh for AI-orchestration backlog bundling).
#
# T15 self-application: if maintainer queues >=2 "improve bundle-curate.sh" fix-class
#   items, they all touch this file → file-overlap rejection fires → at most one goes
#   into the bundle. Expected + correct.
#
# @cc-only-rationale: meta-orchestrator skill helper — runs in-session via !shell
#   injection; planning-time precompute of bundling eligibility per B1 rule
#   (dual-implementation-discipline.md §3 internal-only default).
set -euo pipefail

BACKLOG_FILE="${1:-}"
if [[ -z "${BACKLOG_FILE}" ]]; then
  echo "usage: bundle-curate.sh <backlog-file>" >&2
  exit 2
fi
if [[ ! -f "${BACKLOG_FILE}" ]]; then
  echo "ERROR: backlog file not found: ${BACKLOG_FILE}" >&2
  exit 2
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLASSIFY="${SCRIPT_DIR}/classify-work.sh"
ASSIGN="${SCRIPT_DIR}/assign-skill.sh"

if [[ ! -x "${CLASSIFY}" ]]; then
  echo "ERROR: classify-work.sh not found or not executable at: ${CLASSIFY}" >&2
  exit 2
fi
if [[ ! -x "${ASSIGN}" ]]; then
  echo "ERROR: assign-skill.sh not found or not executable at: ${ASSIGN}" >&2
  exit 2
fi

STDERR_TMP="/tmp/bundle-curate-stderr-$$"
trap 'rm -f "${STDERR_TMP}"' EXIT

# ── PASS 1: classify + assign each item → temp file ──────────────────────────
# Row format in temp file (tab-separated, no newlines in fields):
#   idx TAB item TAB type TAB dispatch TAB assigned TAB file_scope TAB notes
PASS1_TMP="/tmp/bundle-curate-pass1-$$"
trap 'rm -f "${STDERR_TMP}" "${PASS1_TMP}"' EXIT

idx=0
while IFS= read -r line; do
  # Skip blank lines and comment lines
  [[ -z "${line}" || "${line}" =~ ^[[:space:]]*# ]] && continue

  idx=$((idx + 1))
  ITEM="${line}"

  # Invoke L4 classify; handle MISSING-FILE (exit 3) cleanly
  CLASSIFY_EXIT=0
  CLASSIFY_OUT="$("${CLASSIFY}" "${ITEM}" 2>"${STDERR_TMP}")" || CLASSIFY_EXIT=$?

  if [[ "${CLASSIFY_EXIT}" -eq 3 ]]; then
    SKIP_REASON="MISSING-FILE: $(head -1 "${STDERR_TMP}" 2>/dev/null)"
    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
      "${idx}" "${ITEM}" "skip" "skip" "—" "—" "${SKIP_REASON}" >> "${PASS1_TMP}"
    continue
  elif [[ "${CLASSIFY_EXIT}" -ne 0 ]]; then
    SKIP_REASON="classify-work.sh error (exit ${CLASSIFY_EXIT})"
    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
      "${idx}" "${ITEM}" "skip" "skip" "—" "—" "${SKIP_REASON}" >> "${PASS1_TMP}"
    continue
  fi

  ITEM_TYPE="$(echo "${CLASSIFY_OUT}" | awk '/^TYPE:/{print substr($0,7)}')"
  ITEM_DISPATCH="$(echo "${CLASSIFY_OUT}" | awk '/^DISPATCH:/{print substr($0,11)}')"
  ITEM_RATIONALE="$(echo "${CLASSIFY_OUT}" | awk '/^RATIONALE:/{print substr($0,12)}')"

  # B1 eligibility filter: only fix + I-phase-small pass
  if [[ "${ITEM_TYPE}" != "fix" && "${ITEM_TYPE}" != "I-phase-small" ]]; then
    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
      "${idx}" "${ITEM}" "${ITEM_TYPE}" "${ITEM_DISPATCH}" "—" "—" \
      "excluded: type=${ITEM_TYPE} not in {fix,I-phase-small}" >> "${PASS1_TMP}"
    continue
  fi

  # L5 assign-skill (advisory)
  ASSIGN_OUT="$("${ASSIGN}" "${ITEM_TYPE}" "${ITEM}" 2>/dev/null)" || true
  ASSIGNED="$(echo "${ASSIGN_OUT}" | awk '/^(recommended_skill|recommended_agent|recommended):/{
    if (/^recommended_skill:/) { print "skill:" substr($0, 20) }
    else if (/^recommended_agent:/) { print "agent:" substr($0, 20) }
    else { print "none" }
  }' | head -1)"
  [[ -z "${ASSIGNED}" ]] && ASSIGNED="none"

  # Extract file-scope: path-like tokens ending in known extensions from RATIONALE+ITEM
  FILE_SCOPE="$(printf '%s %s' "${ITEM_RATIONALE}" "${ITEM}" \
    | { grep -oE '[a-zA-Z0-9._/-]+\.(ts|tsx|js|sh|md|yml|yaml|json)' || true; } \
    | sort -u | tr '\n' ',' | sed 's/,$//')"
  [[ -z "${FILE_SCOPE}" ]] && FILE_SCOPE="—"

  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
    "${idx}" "${ITEM}" "${ITEM_TYPE}" "${ITEM_DISPATCH}" "${ASSIGNED}" \
    "${FILE_SCOPE}" "candidate" >> "${PASS1_TMP}"

done < "${BACKLOG_FILE}"

# Ensure temp files exist (handles empty or all-comment backlog gracefully)
touch "${PASS1_TMP}"

# ── PASS 2: file-overlap rejection ───────────────────────────────────────────
# Track which file-scope tokens we've seen (space-separated running list).
PASS2_TMP="/tmp/bundle-curate-pass2-$$"
trap 'rm -f "${STDERR_TMP}" "${PASS1_TMP}" "${PASS2_TMP}"' EXIT

SEEN_FILES=""

while IFS=$'\t' read -r F_IDX F_ITEM F_TYPE F_DISPATCH F_ASSIGNED F_SCOPE F_NOTES; do
  if [[ "${F_NOTES}" != "candidate" ]]; then
    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
      "${F_IDX}" "${F_ITEM}" "${F_TYPE}" "${F_DISPATCH}" "${F_ASSIGNED}" \
      "${F_SCOPE}" "${F_NOTES}" >> "${PASS2_TMP}"
    continue
  fi

  OVERLAP=0
  if [[ "${F_SCOPE}" != "—" ]]; then
    # Split comma-separated tokens
    OLD_IFS="${IFS}"
    IFS=','
    for tok in ${F_SCOPE}; do
      IFS="${OLD_IFS}"
      [[ -z "${tok}" ]] && continue
      # Check if token appears in SEEN_FILES (space-bounded match)
      if grep -qF " ${tok} " <<<" ${SEEN_FILES} "; then
        OVERLAP=1
        break
      fi
    done
    IFS="${OLD_IFS}"
  fi

  if [[ "${OVERLAP}" -eq 1 ]]; then
    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
      "${F_IDX}" "${F_ITEM}" "${F_TYPE}" "${F_DISPATCH}" "${F_ASSIGNED}" \
      "${F_SCOPE}" "excluded: file-overlap with prior candidate" >> "${PASS2_TMP}"
  else
    # Register file tokens into SEEN_FILES
    if [[ "${F_SCOPE}" != "—" ]]; then
      OLD_IFS="${IFS}"
      IFS=','
      for tok in ${F_SCOPE}; do
        IFS="${OLD_IFS}"
        [[ -n "${tok}" ]] && SEEN_FILES="${SEEN_FILES} ${tok}"
      done
      IFS="${OLD_IFS}"
    fi
    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
      "${F_IDX}" "${F_ITEM}" "${F_TYPE}" "${F_DISPATCH}" "${F_ASSIGNED}" \
      "${F_SCOPE}" "candidate" >> "${PASS2_TMP}"
  fi
done < "${PASS1_TMP}"

# Ensure pass2 temp file exists (handles all-filtered pass1)
touch "${PASS2_TMP}"

# ── PASS 3: max-5 cap + emit markdown table ──────────────────────────────────
echo "| idx | item-source | classification | dispatch-mode | assigned-skill | file-scope | notes |"
echo "|---|---|---|---|---|---|---|"

BUNDLE_COUNT=0
while IFS=$'\t' read -r F_IDX F_ITEM F_TYPE F_DISPATCH F_ASSIGNED F_SCOPE F_NOTES; do
  if [[ "${F_NOTES}" == "candidate" ]]; then
    if [[ "${BUNDLE_COUNT}" -lt 5 ]]; then
      BUNDLE_COUNT=$((BUNDLE_COUNT + 1))
      F_NOTES="in-bundle (${BUNDLE_COUNT}/5)"
    else
      F_NOTES="excluded: max-bundle-5 cap"
    fi
  fi
  echo "| ${F_IDX} | ${F_ITEM} | ${F_TYPE} | ${F_DISPATCH} | ${F_ASSIGNED} | ${F_SCOPE} | ${F_NOTES} |"
done < "${PASS2_TMP}"
