#!/usr/bin/env bash
# delta-diff.sh — deterministic set-diff between prior untracked_seen (JSON) and current argv.
#
# > Class: B — companion paired-negative test at packages/core/hooks/delta-diff.test.ts.
# > Authoritative for: deterministic computation of NEW-SINCE-LAST / RESOLVED-SINCE-LAST
# >                    set differences between .untracked_seen[].id in a delta JSON file
# >                    and a current id set passed as positional args.
# > NOT authoritative for: JSON schema (single-SSOT in update-delta.sh write_initial_template);
# >                        body-owned write-back logic (single-SSOT in SKILL.md §10 item 5b);
# >                        reconciliation discipline (single-SSOT in
# >                        references/master-backlog-delta.md §2).
#
# Usage: delta-diff.sh <delta-json-path> [id1 id2 id3 ...]
#
# Behaviour:
#   1. Reads .untracked_seen[].id array from delta JSON (seen set).
#   2. Reads positional args (current set).
#   3. Emits "NEW-SINCE-LAST: <id>" for each id in current \ seen.
#   4. Emits "RESOLVED-SINCE-LAST: <id>" for each id in seen \ current.
#   5. Both sets empty / identical → no output, exit 0.
#
# Edge cases:
#   - Missing delta file → treat seen as empty (every current id is NEW).
#   - Corrupt JSON in delta file → exit 1 with stderr; do NOT silently degrade.
#   - Wrong arg count (zero args) → exit 2 with usage on stderr.
#
# @dual-pair: meta-orchestrator-delta-diff
# spec: SKILL.md §2.5 Step 8 (read side) ↔ this file (set-diff logic);
#       references/master-backlog-delta.md §1-§2 (discipline detail).
# @cc-only-rationale: consumer-facing CC-session helper invoked from the
#   /pipeline slash-command via the inline !shell block at SKILL.md §2.5
#   Step 8; no portable hook fires at the per-skill cross-invocation moment, so a
#   portable fallback would be a no-op outside CC. Pure-bash + jq, deterministic,
#   no paid LLM (no-paid-llm-in-ci.md §1 satisfied).
#
# Test seams (mirrors update-delta.sh + update-cache.sh convention):
#   MO_DELTA_FILE — override delta path argument (default: $1)

set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "delta-diff.sh: usage: $0 <delta-json-path> [id1 id2 ...]" >&2
  exit 2
fi

DELTA_FILE="${MO_DELTA_FILE:-$1}"
shift

# Read prior history through the existing resource file seam, not a large argv.
# A missing file/absent key retains the documented empty prior-set behavior.
DELTA_SOURCE=/dev/null
DELTA_PRESENT=false
if [ -f "$DELTA_FILE" ]; then DELTA_SOURCE="$DELTA_FILE"; DELTA_PRESENT=true; fi
if ! OUTPUT="$(jq -nr --slurpfile previous "$DELTA_SOURCE" --argjson present "$DELTA_PRESENT" --args '
  (if $present then
    ($previous | if length == 1 and (.[0] | type == "object")
      then .[0] else error("expected one delta object") end) |
    if has("untracked_seen") then
      .untracked_seen | if type == "array" and all(.[]; type == "object" and (.id | type == "string"))
        then map(.id) else error("invalid prior-set schema") end
    else [] end
  else [] end) as $seen |
  ($ARGS.positional | unique) as $current |
  (($current - $seen) | unique | .[] | "NEW-SINCE-LAST: " + .),
  (($seen - $current) | unique | .[] | "RESOLVED-SINCE-LAST: " + .)
' -- "$@" 2>/dev/null)"; then
  echo "delta-diff.sh: delta corrupt — invalid JSON or prior-set schema at $DELTA_FILE" >&2
  exit 1
fi
[ -z "$OUTPUT" ] || printf '%s\n' "$OUTPUT"
