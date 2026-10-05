#!/usr/bin/env bash
# setup.d/15-companions-stack.sh — Stack-specific companion selection layer (S3).
#
# Reads companions.manifest, detects the current stack from package.json signals,
# and reports which companions are relevant for the detected stack.
# This layer provides the static stack-aware selection; the actual installs are
# performed by the setup wrapper's companion loop (engine.sh).
#
# Stack signals (package.json):
#   react-next   → next package present
#   react-spa    → react present, no next
#   react-native → react-native present
#   ts-server    → typescript present, no react/next (default for TS projects)
#
# Sources: lib.sh (already in dispatcher scope)
# S0 rows: NEW-layers table, O7
# Depends on: lib.sh (already in dispatcher scope), companions.manifest
# @cc-only-rationale: sourced by install.sh dispatcher, not standalone
# R1 hard gate: no AIF-engine mapping, no live registry call — static table only (umbrella §9).

MANIFEST="$PKG_ROOT/setup.d/companions.manifest"

# Stack detection lives in lib.sh (_detect_stack_name / _detect_stack_from_pkg) — SSOT shared
# with the install.sh stack-pick (GH #780 fresh-install auto-detect). lib.sh is sourced before
# this layer (install.sh sources lib.sh at the top, then the numbered layers), so the functions
# are in scope here. The detector is node-free (grep/stat-based) per the install-time
# node-optional repo-read model. W2: this report line shows the detected NAME (astro /
# svelte-kit / …), not its preset projection — a named framework matches only the stacks=*
# rows (no row lists it), which is exactly the generic-like selection §3.2 of the W2 plan
# prescribes for preset-bound layers; `unknown` keeps the historic include-all fallback.

# _stack_matches <stacks_field> <detected_stack>
# Returns 0 (true) if the stacks field covers the detected stack.
_stack_matches() {
  local stacks_field="$1" detected="$2"
  [ "$stacks_field" = "*" ] && return 0
  [ "$detected" = "unknown" ] && return 0  # unknown stack: include all companions
  # Check comma-separated list
  local IFS_ORIG="$IFS"
  IFS=,
  for s in $stacks_field; do
    IFS="$IFS_ORIG"
    [ "$s" = "$detected" ] && return 0
  done
  IFS="$IFS_ORIG"
  return 1
}

if [ ! -f "$MANIFEST" ]; then
  echo "  ⊝ companions.manifest not found — stack-selection skipped"
  return 0 2>/dev/null || true
fi

DETECTED_STACK=$(_detect_stack_name)

echo "  ▶ Stack-aware companion selection (detected: $DETECTED_STACK)"

selected_count=0
while IFS=$'\t' read -r name detect install kind stacks; do
  case "$name" in ''|\#*) continue ;; esac
  if _stack_matches "$stacks" "$DETECTED_STACK"; then
    echo "    ✓ $name [stacks=$stacks] — relevant for $DETECTED_STACK"
    selected_count=$((selected_count + 1))
  else
    echo "    ⊝ $name [stacks=$stacks] — not selected for $DETECTED_STACK (skipped)"
  fi
done < "$MANIFEST"

echo "  $selected_count companion(s) selected for stack '$DETECTED_STACK'"
