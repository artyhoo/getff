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
# Usage: classify-each-candidate.sh
#
# Reads stdin OR (default) invokes priority-score.sh internally. Per-candidate
# stdout: "--- candidate: <name> ---" + classify-work.sh output. Per-candidate
# failure (classify-work.sh exit 3 MISSING-FILE) is recorded inline; iteration
# continues. Final exit code = 0 if at least one candidate classified; non-zero
# only if priority-score.sh itself fails.
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

# Source: stdin (if piped) OR a fixture file (MO_PRIORITY_INPUT) OR run priority-score.sh fresh.
if [[ -n "${MO_PRIORITY_INPUT:-}" && -f "${MO_PRIORITY_INPUT}" ]]; then
  SRC="cat ${MO_PRIORITY_INPUT}"
elif [[ ! -t 0 ]]; then
  SRC="cat"
else
  SRC="bash ${PRIORITY} 2>/dev/null"
fi

eval "${SRC}" \
  | awk 'NF>=2 && /kickoff=/ && !/^=== /' \
  | while IFS= read -r line; do
      name="${line%% *}"
      printf '\n--- candidate: %s ---\n' "${name}"
      if grep -q 'kickoff=exists' <<<"${line}"; then
        bash "${CLASSIFY}" "$(resolve_orch_home)/${name}/kickoff.md" 2>&1 || true
      elif grep -q 'kickoff=synthetic' <<<"${line}"; then
        bash "${CLASSIFY}" "${line}" 2>&1 || true
      else
        echo "SKIP: ${line}"
      fi
    done
