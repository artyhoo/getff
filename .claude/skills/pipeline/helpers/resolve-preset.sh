#!/usr/bin/env bash
# resolve-preset.sh — resolve a pipeline launch preset to shell-evaluable KEY=VALUE lines.
#
# > Class: C — prose-only; companion paired-negative test at
# >          packages/core/hooks/parse-preset.test.ts (AC-1, AC-3).
# > Authoritative for: reading ONE preset JSON file from references/presets/<name>.json
#                    and emitting its fields as PRESET_* env-var-shaped lines on stdout.
# > NOT authoritative for: parsing --preset from the umbrella string (that is
# >                        parse-override-flags.sh seam #1); the routing tree
# >                        (SKILL.md §2.5 Step 5 seam #2); the marker emission
# >                        (SKILL.md §0 preamble → kickoff header seam #3).
#
# Usage: resolve-preset.sh <preset-name>
#   stdout (exit 0): PRESET_MODE, PRESET_REVIEWER_TIER, PRESET_MARKER,
#                    PRESET_DESCRIPTION, PRESET_BUNDLE_OPT_IN,
#                    PRESET_REVIEW_REQUIRED, PRESET_PARALLEL_SAFE,
#                    PRESET_AIF_MAX_REVIEW_ITERATIONS (only if present in JSON)
#   exit 1: preset not found (stderr message + list of available presets)
#   exit 2: jq unavailable OR multiple files matched name (defensive)
#
# Bash 3.2 compatible (no associative arrays — same constraint as
# parse-override-flags.sh). Reads ONE preset file via jq one-key lookups.
#
# Schema (§8a Park-1, BINDING — flat + description):
#   {mode, reviewer_tier, marker, description,
#    predicates: {bundle_opt_in, review_required, parallel_safe},
#    aif_runtime_hints?: {maxReviewIterations?: int}}
#
# @dual-pair: meta-orchestrator-mode-overrides
# spec: .claude/skills/pipeline/references/mode-overrides.md §8

set -euo pipefail

if [ "$#" -ne 1 ] || [ -z "$1" ]; then
  echo "resolve-preset.sh: usage: $0 <preset-name>" >&2
  exit 2
fi

PRESET_NAME="$1"

# Resolve presets dir relative to this script (works under CC and when invoked directly).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRESETS_DIR="${SCRIPT_DIR}/../references/presets"

# Defensive: jq must be available (it is a hard helper dependency per update-delta.sh).
if ! command -v jq >/dev/null 2>&1; then
  echo "resolve-preset.sh: jq is required but not found on PATH" >&2
  exit 2
fi

PRESET_FILE="${PRESETS_DIR}/${PRESET_NAME}.json"

if [ ! -f "$PRESET_FILE" ]; then
  # List available presets to help the user/agent recover.
  available=""
  if [ -d "$PRESETS_DIR" ]; then
    for f in "$PRESETS_DIR"/*.json; do
      [ -f "$f" ] || continue
      name="$(basename "$f" .json)"
      available="${available:+$available }$name"
    done
  fi
  echo "resolve-preset.sh: preset '${PRESET_NAME}' not found. Available: ${available:-<none>}" >&2
  exit 1
fi

# Trace logging (suppressed unless MO_TRACE_PRESET=1).
trace() { [ "${MO_TRACE_PRESET:-0}" = "1" ] && printf '[resolve-preset] %s\n' "$*" >&2 || true; }

# Read each field via jq one-key lookups (§8a Park-1 rationale: each seam reads
# one path — .mode / .predicates.* / .marker).
PRESET_MODE="$(jq -r '.mode' "$PRESET_FILE")"
PRESET_REVIEWER_TIER="$(jq -r '.reviewer_tier' "$PRESET_FILE")"
# marker is null in JSON → emit empty string (not the literal "null").
PRESET_MARKER="$(jq -r '.marker // empty' "$PRESET_FILE")"
PRESET_DESCRIPTION="$(jq -r '.description' "$PRESET_FILE")"
PRESET_BUNDLE_OPT_IN="$(jq -r '.predicates.bundle_opt_in' "$PRESET_FILE")"
PRESET_REVIEW_REQUIRED="$(jq -r '.predicates.review_required' "$PRESET_FILE")"
PRESET_PARALLEL_SAFE="$(jq -r '.predicates.parallel_safe' "$PRESET_FILE")"

trace "preset=${PRESET_NAME} mode=${PRESET_MODE} marker=${PRESET_MARKER:-<none>}"

# Emit (exit 0).
printf 'PRESET_MODE=%s\n' "$PRESET_MODE"
printf 'PRESET_REVIEWER_TIER=%s\n' "$PRESET_REVIEWER_TIER"
# PRESET_MARKER omitted when empty (null marker = no line emitted;
# consumer treats absent line as 'no bridge-profile marker to emit').
if [ -n "$PRESET_MARKER" ]; then
  printf 'PRESET_MARKER=%s\n' "$PRESET_MARKER"
fi
printf 'PRESET_DESCRIPTION=%s\n' "$PRESET_DESCRIPTION"
printf 'PRESET_BUNDLE_OPT_IN=%s\n' "$PRESET_BUNDLE_OPT_IN"
printf 'PRESET_REVIEW_REQUIRED=%s\n' "$PRESET_REVIEW_REQUIRED"
printf 'PRESET_PARALLEL_SAFE=%s\n' "$PRESET_PARALLEL_SAFE"

# Optional: aif_runtime_hints.maxReviewIterations (only economy preset carries this).
HINT=$(jq -r '.aif_runtime_hints.maxReviewIterations // empty' "$PRESET_FILE")
if [ -n "$HINT" ]; then
  printf 'PRESET_AIF_MAX_REVIEW_ITERATIONS=%s\n' "$HINT"
  trace "aif_runtime_hints.maxReviewIterations=${HINT}"
fi

exit 0
