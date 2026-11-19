#!/usr/bin/env bash
# r2-na-marker.sh — shared C3-marker reader for the R2 inertness gates (GH #547 Point 2).
#
# SOURCED by check-rule-globs.sh AND check-rule-enforced.sh so the two gates can NEVER diverge on
# whether/how they honor a recorded `R2 N/A` decision (spec §9 risk 2 — "two gates, one marker").
# Defines two functions; sourcing has no side effects.
#
#   r2_na_marker_present  → rc 0 if .ai-factory/tool-decisions.md carries the aif:r2-na block.
#   r2_na_until_boundary  → rc 0 if that block is the no-boundary-yet one («N/A until an HTTP boundary
#                           appears», P2 K2). It waives nothing once its precondition breaks: the
#                           gates then judge R2 as if no block were there — no human step.
#   r2_na_recheck         → re-runs the C1 boundary probe and echoes exactly one of:
#                              holds  — still no-boundary-confident or no-boundary-yet (N/A holds)
#                              broke  — a boundary is now present (the N/A no longer holds → red)
#                              doubt  — ambiguous now: zod declared, no declarative framework, so the
#                                       probe can no longer rule a boundary out (→ red too)
#
# The detector is a SIBLING of this helper (both ship to scripts/ in a consumer and both live in
# packages/core/audit-self/ in the framework repo) → ONE path resolves in both homes.

_R2NA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
R2_DECISIONS_FILE="${AIF_TOOL_DECISIONS:-.ai-factory/tool-decisions.md}"
R2_DETECT_SCRIPT="${R2_DETECT_SCRIPT:-$_R2NA_DIR/detect-r2-boundary.sh}"

r2_na_marker_present() {
  [ -f "$R2_DECISIONS_FILE" ] && grep -qF '<!-- aif:r2-na:begin -->' "$R2_DECISIONS_FILE"
}

r2_na_until_boundary() {
  awk '/<!-- aif:r2-na:begin -->/{f=1} f && /N\/A until an HTTP boundary appears/{hit=1} /<!-- aif:r2-na:end -->/{f=0} END{exit !hit}' "$R2_DECISIONS_FILE" 2>/dev/null
}

r2_na_recheck() {
  local v
  v="$(bash "$R2_DETECT_SCRIPT" 2>/dev/null | head -1)"
  case "$v" in
    no-boundary-confident|no-boundary-yet) echo holds ;;
    ambiguous) echo doubt ;;
    *) echo broke ;;
  esac
}
