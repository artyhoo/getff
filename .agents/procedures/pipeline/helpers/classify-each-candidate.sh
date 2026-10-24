#!/usr/bin/env bash
# classify-each-candidate.sh — iterate over priority-score.sh output and run
# classify-work.sh per surviving candidate (Step 3 of SKILL.md §2.5).
#
# > Class: B — companion paired-negative test at
# >          packages/core/skills/classify-each-candidate.test.ts.
# > Authoritative for: the iteration shape between §2.5 Step 2 (dup-detect
# >                    candidate set from priority-score.sh) and Step 4
# >                    (per-candidate assign-skill.sh). Handles both real-kickoff
# >                    (kickoff=exists, file-mode) and synthetic (kickoff=synthetic,
# >                    string-mode) candidates per classify-work.sh:41-56.
# > NOT authoritative for: classification logic (single-SSOT in classify-work.sh
# >                        per DN-3 — UNCHANGED here, this helper only routes
# >                        the input shape).
#
# Usage: classify-each-candidate.sh [--stdin]
#
# Reads explicit --stdin OR (default) invokes priority-score.sh internally. Per-candidate
# stdout: "--- candidate: <name> ---" + classify-work.sh output. Per-candidate
# failure (classify-work.sh exit 3 MISSING-FILE) is recorded inline; iteration
# continues. Final exit code is non-zero if acquisition or any classification fails.
# Empty candidate sets are explicit EMPTY; missing candidates remain SKIP.
#
# Seam:
#   MO_PRIORITY_INPUT — file path with pre-captured priority-score output
#                       (for tests; default = invoke priority-score.sh fresh)
#
# @dual-pair: meta-orchestrator-classify-each-candidate
# spec: SKILL.md §2.5 Step 3 (caller) ↔ this file (iteration logic);
#       classify-work.sh:41-56 (file/string mode dispatch — UNCHANGED per DN-3).
# @cc-only-rationale: meta-orchestrator skill helper — runs in-session via
#   !shell injection at SKILL.md §2.5 Step 3; no portable hook fires at the
#   per-skill cross-invocation moment. Pure-bash + awk + grep, deterministic,
#   no paid LLM (no-paid-llm-in-ci.md §1 satisfied).

set -euo pipefail

# REPO_ROOT + resolve_orch_home() sourced from lib/common.sh (BASH_SOURCE-relative so it
# survives the REPO_ROOT test-seam; consumer-usable /pipeline 2026-06-16).
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRIORITY="${HERE}/priority-score.sh"
CLASSIFY="${HERE}/classify-work.sh"

# Default always acquires live candidates, even with closed/non-TTY stdin.
# Explicit seams: MO_PRIORITY_INPUT=<file>, or --stdin for a captured stream.
if [[ $# -gt 1 || ( $# -eq 1 && "$1" != "--stdin" ) ]]; then
  echo "usage: classify-each-candidate.sh [--stdin]" >&2; exit 2
fi
if [[ -n "${MO_PRIORITY_INPUT:-}" ]]; then
  if ! INPUT="$(cat "${MO_PRIORITY_INPUT}")"; then
    echo "UNKNOWN: priority input unavailable" >&2; exit 1
  fi
elif [[ "${1:-}" == "--stdin" ]]; then
  INPUT="$(cat)"
else
  if ! INPUT="$(bash "${PRIORITY}")"; then
    echo "UNKNOWN: priority acquisition failed" >&2; exit 1
  fi
fi
# Accept only explicit key=value candidate records. Known priority protocol
# diagnostics/header lines are not candidates; unknown nonempty captures reject.
if ! ROWS="$(printf '%s\n' "${INPUT}" | awk '
  /^[[:space:]]*$/ || /^=== .* ===$/ { next }
  /^PROBE-INCOMPLETE: / || /^RECONSTRUCT-STUB: / { next }
  /^\(no .* directory\)$/ { next }
  {
    valid = ($1 ~ /^[[:alnum:]_][[:alnum:]_.:\/§-]*$/ && NF >= 2)
    kickoff = ""; count = 0
    for (i = 2; i <= NF; i++) {
      if ($i !~ /^[[:alpha:]_][[:alnum:]_]*=.+$/) valid = 0
      if ($i ~ /^kickoff=/) { kickoff = $i; count++ }
    }
    if (count != 1 || kickoff !~ /^kickoff=(exists|missing|synthetic)$/) valid = 0
    if (!valid) { bad = 1; next }
    print $0
  }
  END { if (bad) exit 1 }
')"; then
  echo "UNKNOWN: malformed priority candidate capture" >&2
  exit 1
fi
if [[ -z "${ROWS}" ]]; then
  echo "EMPTY: no candidate rows"
  exit 0
fi
failed=0
printf '%s\n' "${ROWS}" | {
  while IFS= read -r line; do
    name="${line%% *}"
    printf '\n--- candidate: %s ---\n' "${name}"
    case " ${line} " in
      *" kickoff=exists "*) input="$(resolve_orch_home)/${name}/kickoff.md" ;;
      *" kickoff=synthetic "*) input="${line}" ;;
      *" kickoff=missing "*) echo "SKIP: ${line}"; continue ;;
    esac
    if ! bash "${CLASSIFY}" "${input}"; then
      echo "UNKNOWN: classification unavailable for ${name}" >&2
      failed=1
    fi
  done
  exit "${failed}"
}
