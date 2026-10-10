#!/usr/bin/env bash
# list-presets.sh — data-driven enumeration of pipeline launch presets.
#
# > Class: C — prose-only; companion test at packages/core/hooks/list-presets.test.ts (AC-2).
# > Authoritative for: scanning references/presets/*.json and emitting a one-line-per-preset
# >                    summary from description + mode + marker.
# > NOT authoritative for: preset data schema (that is mode-overrides.md §8);
# >                        preset resolution (that is resolve-preset.sh).
#
# Usage: list-presets.sh
#   stdout: one row per preset file, sorted alphabetically by name.
#   exit 0: always (even if zero presets found — prints "no presets available").
#
# AC-2: adding a 5th preset file makes it appear with ZERO code change.
#
# @dual-pair: meta-orchestrator-mode-overrides

set -euo pipefail

# Resolve presets dir relative to this script. MO_PRESETS_DIR overrides for
# test fixtures (AC-2 extensibility test points it at a synthetic dir).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRESETS_DIR="${MO_PRESETS_DIR:-${SCRIPT_DIR}/../references/presets}"

if ! command -v jq >/dev/null 2>&1; then
  echo "list-presets.sh: jq is required but not found on PATH" >&2
  exit 0  # non-fatal: print nothing, exit 0 (status render should not crash)
fi

if [ ! -d "$PRESETS_DIR" ] || [ -z "$(ls -A "$PRESETS_DIR"/*.json 2>/dev/null)" ]; then
  echo "no presets available (create JSON files under references/presets/)"
  exit 0
fi

# Trace logging (suppressed unless MO_TRACE_PRESET=1).
trace() { [ "${MO_TRACE_PRESET:-0}" = "1" ] && printf '[list-presets] %s\n' "$*" >&2 || true; }

count=0
# Sort alphabetically by filename for deterministic output.
for f in $(ls "$PRESETS_DIR"/*.json 2>/dev/null | sort); do
  [ -f "$f" ] || continue
  name="$(basename "$f" .json)"
  description="$(jq -r '.description // "<no description>"' "$f")"
  mode="$(jq -r '.mode // "<unknown>"' "$f")"
  marker="$(jq -r '.marker // empty' "$f")"
  if [ -n "$marker" ]; then
    printf '%s — %s (mode=%s, marker=%s)\n' "$name" "$description" "$mode" "$marker"
  else
    printf '%s — %s (mode=%s)\n' "$name" "$description" "$mode"
  fi
  count=$((count + 1))
  trace "rendered preset: $name"
done

trace "total presets: $count"
exit 0
