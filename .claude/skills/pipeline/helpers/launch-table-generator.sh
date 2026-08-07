#!/usr/bin/env bash
# launch-table-generator.sh — §7.4 deterministic data feed for SKILL.md §3 Launch-table.
#
# Usage: launch-table-generator.sh <umbrella-name>
#
# Outputs a markdown table skeleton with detected sub-wave rows (placeholders for
# judgment-requiring columns). SKILL.md body fills Mode, SDD?, Stage, Parallel-sibling.
#
# @cc-only-rationale: meta-orchestrator skill helper — runs in-session via !shell injection;
#   no portable equivalent fires at the same moment (PostToolUse timing is CC-specific).
set -euo pipefail

UMBRELLA="${1:-}"
# REPO_ROOT (+ shared resolve_target / tokeniser primitives) sourced from lib/common.sh
# (Stage 4 dedup, BASH_SOURCE-relative so it survives the REPO_ROOT test-seam).
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"

if [[ -z "${UMBRELLA}" ]]; then
  # Called without arg — legitimate when skill is loaded but §2 hasn't selected
  # an umbrella yet. Quiet skip (exit 0) so CC doesn't flag the §3 !shell block
  # as failed. Direct CLI invocation can still discover usage via this echo.
  echo "(launch-table-generator: no umbrella — §3 launch-table runs after §2 selects winner)"
  exit 0
fi

KICKOFF="$(resolve_orch_home)/${UMBRELLA}/kickoff.md"

if [[ ! -f "${KICKOFF}" ]]; then
  # Report the resolved home, not a hardcoded `.claude/…` — see resolve_orch_home_rel().
  echo "MISSING kickoff: $(resolve_orch_home_rel)/${UMBRELLA}/kickoff.md"
  exit 0
fi

echo "=== launch-table-generator: umbrella=${UMBRELLA} ==="
echo "kickoff: ${KICKOFF} ($(wc -l < "${KICKOFF}") lines)"
echo ""

# Extract sub-wave rows from kickoff §2/§3 sub-wave tables.
# Recognised first-column shapes (with surrounding spaces):
#   | A |           plain letter A-D
#   | **A** |       bold-wrapped letter (Markdown emphasis)
#   | 1 |           plain digit
#   | **1** |       bold-wrapped digit
# Filters:
#   - the header row (first cell == 'Sub-wave' literal) and divider rows (cells of `-`/`:`)
#
# Gap-1 fix history:
#   F.3 (2026-05-24): shipped Option A — keyword filter kept only rows whose value column
#     names a kickoff phase/mode (R-phase|execution|wiring|Mode [AB]|Direct Edit|…). This
#     fixed spurious matches from §1 hook tables and §2 dispatch tables. But it false-negatives
#     on kickoffs whose sub-wave content column describes SKILL.md sections rather than
#     orchestration-mode keywords (e.g. meta-orchestrator-iphase: columns contain "SKILL.md §3",
#     "helpers/launch-table-generator.sh", etc. — not matched by any keyword).
#   F.3 follow-up (2026-05-25): replaced with Option B5 — hybrid section-scoped + keyword fallback.
#     Smoke-test gap closed: now tests meta-orchestrator-iphase (4 sub-waves, was false-negative)
#     + meta-orchestrator-followup-audit (8 sub-waves, regression check)
#     + mutation-discipline-umbrella (0 sub-waves, false-positive check — uses ### Stage N, not rows)
#     + meta-orchestrator-linear-autonomous (0 sub-waves, dogfood T15).
#
# Option B5 — hybrid section-scoped + keyword fallback:
#   PRIMARY PATH: detect a "## §N <Sub-wave|sub-wave>*" section heading via awk state machine.
#     Within that section ALL row-shaped lines are treated as sub-waves (the section heading IS
#     the scope marker — no keyword filter needed). Section ends at the next "## " heading or EOF.
#     Example heading matches: "## §3 Sub-wave decomposition (Mode B × N worktrees if parallel)"
#                               "## §2 Sub-wave order + dispatch mode"
#   FALLBACK PATH: if no Sub-wave section heading found, fall back to original keyword-filter
#     behavior. Preserves backward compatibility for kickoffs without such headings (e.g.
#     template-generated kickoffs where launch-table vocabulary names orchestration modes directly).
detect_subwaves() {
  # Check whether a "Sub-wave" section heading exists in this kickoff.
  if grep -qE '^## §[0-9]+ [Ss]ub-wave' "${KICKOFF}" 2>/dev/null; then
    # PRIMARY PATH: section-scoped extraction via awk state machine.
    # in_section=1 from "## §N Sub-wave*" heading until next "## " heading.
    # Only pipe-delimited rows matching the shape regex are emitted; header/divider rows
    # are filtered; no keyword filter needed (section scope is the discriminator).
    awk '
      /^## §[0-9]+ [Ss]ub-wave/ { in_section=1; next }
      in_section && /^## /        { in_section=0 }
      in_section && /^\| *(\*\*)?([A-D]|[0-9]+)(\*\*)? *\|/ &&
                    !/^\|[[:space:]:|-]*\|[[:space:]:|-]*$/ {
        # Strip leading "| " and capture first cell (sub-wave id)
        line=$0
        gsub(/^\| */, "", line)
        gsub(/ *\|.*/, "", line)
        gsub(/[* ]/, "", line)
        if (line != "" && line != "Sub-wave" && line != "#") print line
      }
    ' "${KICKOFF}"
  else
    # FALLBACK PATH: original keyword-filter behavior (F.3 Option A).
    # Handles kickoffs that don't have a recognizable Sub-wave section heading,
    # including template-generated kickoffs where column content names orchestration modes.
    grep -E '^\| *(\*\*)?([A-D]|[0-9]+)(\*\*)? *\|' "${KICKOFF}" 2>/dev/null \
      | grep -vE '^\|[[:space:]:|-]*\|[[:space:]:|-]*$' \
      | grep -E 'R-phase|execution|wiring|Mode [AB]|Direct Edit|SDD|Queue mode|I-phase|implementer|reviewer|sub-wave|Sub-wave' \
      | while IFS='|' read -r _ sw_raw _; do
          sw="$(echo "${sw_raw}" | tr -d ' *')"
          [[ -n "${sw}" ]] && echo "${sw}"
        done
  fi
}

echo "--- sub-wave candidates (auto-detected) ---"
detect_subwaves | sed 's/^/  sub-wave: /'

echo ""
echo "--- kickoff type header ---"
grep -m3 '^\*\*Type:\*\*\|^> \*\*Type:\*\*\|^## §0\|^## §1 Spec' "${KICKOFF}" 2>/dev/null \
  || echo "(no type header found — check kickoff manually)"

echo ""
echo "--- table skeleton (fill judgment columns in SKILL.md body) ---"
echo "| Sub-wave | Type | Mode | SDD? | Stage | Parallel sibling | Volume |"
echo "|---|---|---|---|---|---|---|"

# Emit one skeleton row per detected sub-wave (SKILL.md body fills actual values).
detect_subwaves | while read -r sw; do
  echo "| ${sw} | ? | ? | ? | ? | ? | ? |"
done
