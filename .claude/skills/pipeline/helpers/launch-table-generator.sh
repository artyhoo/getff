#!/usr/bin/env bash
# launch-table-generator.sh — §7.4 deterministic data feed for SKILL.md §3 Launch-table.
#
# Usage: launch-table-generator.sh <umbrella-name>
#
# Outputs a markdown table skeleton with detected sub-wave rows (placeholders for
# judgment-requiring columns). SKILL.md body fills Mode, SDD?, Parallel-sibling — and reads the
# `Stage` column off helpers/frontier.sh (D-H13: the stage-dependency edges are derived from the
# kickoff `Depends on` column, not eyeballed here).
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
# Recognised first-column shapes (with surrounding spaces) — the id grammar (#1518):
#   <id> ::= [A-Za-z][A-Za-z0-9-]* | [0-9]+
# i.e. a letter-first token (case-insensitive, hyphens allowed) or a plain digit run.
# Deliberately NOT packages/core/principles/kickoff-population.ts STAGE_KICKOFF_RE — that is
# a FILENAME grammar (kickoff-<letter><digit>…) rejecting KD / today-hero / plain A-D.
# Legacy shapes keep parsing: | A |, | **A** |, | 1 |, | **1** |.
# Real-world shapes that motivated the widening: | K0 |, | KD |, | KA |, | today-hero |.
# Filters (both paths):
#   - divider rows (cells of `-`/`:`)
#   - the HEADER row — structural, not content-based: a row immediately followed by a
#     `|---|` separator row is that table's header, and is dropped. The widening made
#     ANY letter-first header cell shape-legal, so the earlier content exclusion (first
#     cell == 'Sub-wave', case-insensitive) alone let `| Stage | Sub-waves | … |`,
#     `| Type | … |`, `| Description | … |` headers through as ids (measured over the
#     337-kickoff corpus: consumer-install-hardening printed `sub-wave: Stage` + a
#     garbage skeleton row, silently). One-line content exclusion kept as defense for
#     a `Sub-wave` row NOT followed by a separator.
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
    # Only pipe-delimited rows matching the shape regex are emitted; divider rows and
    # HEADER rows are filtered; no keyword filter needed (section scope is the
    # discriminator).
    # Header drop is a one-row LOOK-AHEAD: a candidate row is buffered in `pending`
    # and printed only once the NEXT line proves it is not a header (i.e. that line
    # is not a `|---|` separator). The same rule drives the fallback's
    # strip_table_headers below — one structural definition, both paths.
    awk '
      function flush_pending() { if (pending != "") { print pending; pending = "" } }
      /^## §[0-9]+ [Ss]ub-wave/  { flush_pending(); in_section = 1; next }
      in_section && /^## /       { flush_pending(); in_section = 0; next }
      {
        if (pending != "") {
          if ($0 !~ /^\|[[:space:]:|-]*\|[[:space:]:|-]*$/) print pending
          pending = ""
        }
        if (in_section && $0 ~ /^\| *(\*\*)?([A-Za-z][A-Za-z0-9-]*|[0-9]+)(\*\*)? *\|/ &&
            $0 !~ /^\|[[:space:]:|-]*\|[[:space:]:|-]*$/) {
          # Strip leading "| " and capture first cell (sub-wave id candidate)
          line = $0
          gsub(/^\| */, "", line)
          gsub(/ *\|.*/, "", line)
          gsub(/[* ]/, "", line)
          if (line != "" && toupper(line) != "SUB-WAVE" && line != "#") pending = line
        }
      }
      END { flush_pending() }
    ' "${KICKOFF}"
  else
    # FALLBACK PATH: original keyword-filter behavior (F.3 Option A).
    # Handles kickoffs that don't have a recognizable Sub-wave section heading,
    # including template-generated kickoffs where column content names orchestration modes.
    # strip_table_headers (the SAME look-ahead rule the primary awk applies inline) runs
    # FIRST: the widened grammar makes any letter-first header cell shape-legal, so the
    # header must be dropped structurally here too — `| Stage | Sub-waves | … |` used to
    # pass this chain (the header itself carries the `sub-wave` keyword) and print
    # `sub-wave: Stage` + a garbage skeleton row.
    strip_table_headers <"${KICKOFF}" \
      | grep -E '^\| *(\*\*)?([A-Za-z][A-Za-z0-9-]*|[0-9]+)(\*\*)? *\|' \
      | grep -vE '^\|[[:space:]:|-]*\|[[:space:]:|-]*$' \
      | grep -E 'R-phase|execution|wiring|Mode [AB]|Direct Edit|SDD|Queue mode|I-phase|implementer|reviewer|sub-wave|Sub-wave' \
      | while IFS='|' read -r _ sw_raw _; do
          sw="$(echo "${sw_raw}" | tr -d ' *')"
          [[ -z "${sw}" || "${sw}" == "#" ]] && continue
          # Content exclusion kept as defense for a `Sub-wave` row that is NOT followed
          # by a separator (malformed table) — the structural drop above covers the
          # well-formed shape on both paths.
          sw_lc="$(printf '%s' "${sw}" | tr '[:upper:]' '[:lower:]')"
          [[ "${sw_lc}" == "sub-wave" ]] && continue
          echo "${sw}"
        done
  fi
}

# Shared look-ahead filter (used by the fallback path; the primary awk inlines the same
# rule): reads pipe-row lines on stdin, drops any row whose NEXT line is a `|---|`
# separator row — in markdown that row is by construction the table's header. The
# separator must stay in the stream until the look-ahead has consumed it, which is why
# this is one buffering pass, not a `grep -v` of the separator.
strip_table_headers() {
  awk '
    {
      if (pending != "") {
        if ($0 !~ /^\|[[:space:]:|-]*\|[[:space:]:|-]*$/) print pending
        pending = ""
      }
      if ($0 ~ /^\|/ && $0 !~ /^\|[[:space:]:|-]*\|[[:space:]:|-]*$/) pending = $0
    }
    END { if (pending != "") print pending }
  '
}

echo "--- sub-wave candidates (auto-detected) ---"
# Capture the rows ONCE (#1518): `detect_subwaves | sed` under set -euo pipefail was the
# silent kill site — a zero-match grep in the fallback ended the script with no output and
# no explanation, while the PRIMARY path exited 0 with an EMPTY skeleton (real instance:
# adapter-jig-meta-launch). Zero parsed rows in EITHER path is now a loud degrade:
# a DEGRADE: line on stdout (same protocol prefix frontier.sh uses) + non-zero exit, which
# the SKILL.md §3 blocking rule halts on. `|| true` absorbs the function's zero-match
# failure so the empty case reaches THIS check instead of dying inside the pipeline.
_sw_rows="$(detect_subwaves || true)"
if [[ -z "${_sw_rows}" ]]; then
  echo "DEGRADE: launch-table-generator parsed 0 sub-wave rows from $(resolve_orch_home_rel)/${UMBRELLA}/kickoff.md — neither a '## §N Sub-wave' section with parseable id rows nor a keyword-filter table matched (id grammar: | <id> | where id is [A-Za-z][A-Za-z0-9-]* or [0-9]+; keyword fallback needs an orchestration-mode keyword in the row). Fill the launch table manually from the kickoff, or fix the table shape."
  exit 1
fi
printf '%s\n' "${_sw_rows}" | sed 's/^/  sub-wave: /'

echo ""
echo "--- kickoff type header ---"
grep -m3 '^\*\*Type:\*\*\|^> \*\*Type:\*\*\|^## §0\|^## §1 Spec' "${KICKOFF}" 2>/dev/null \
  || echo "(no type header found — check kickoff manually)"

echo ""
echo "--- table skeleton (fill judgment columns in SKILL.md body) ---"
echo "| Sub-wave | Type | Mode | SDD? | Stage | Parallel sibling | Volume |"
echo "|---|---|---|---|---|---|---|"

# Emit one skeleton row per detected sub-wave (SKILL.md body fills actual values).
# Reuses the captured _sw_rows — a second detect_subwaves call here was a redundant re-scan
# that could emit rows the candidates section above had already (identically) listed.
while read -r sw; do
  echo "| ${sw} | ? | ? | ? | ? | ? | ? |"
done <<< "${_sw_rows}"
