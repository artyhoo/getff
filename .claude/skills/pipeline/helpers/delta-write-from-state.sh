#!/usr/bin/env bash
# delta-write-from-state.sh — /pipeline master-backlog-delta arrays writer
# (per-machine, gitignored sibling of update-delta.sh).
#
# > Class: C — prose-only; companion paired-negative test at
# >          packages/core/hooks/delta-write-from-state.test.ts. No principle test
# >          gates compliance — the test gates the helper's own contract.
# > Authoritative for: deterministic in-place jq rewrite of `untracked_seen` +
# >                    `closed_since_last` arrays in
# >                    <resolved-orch-home>/_master-backlog-delta.json.
# > NOT authoritative for: the two metadata fields `last_check_ts` +
# >                        `last_check_git_head` — those are owned by
# >                        update-delta.sh (sibling helper, paired-negative test
# >                        contract preserved per DN-2 B verdict 2026-05-27).
#
# Usage: delta-write-from-state.sh <umbrella-or-no-arg> <current_ids_json_array> <resolved_ids_json_array>
#
# Behaviour:
#   1. Delta file missing → exit 1 with diagnostic. Caller is expected to invoke
#      update-delta.sh first (which bootstraps the schema). This preserves clear
#      scope boundaries between the two sibling helpers: update-delta.sh owns
#      metadata + fresh-template bootstrap; this helper owns arrays-only rewrite.
#   2. Delta file exists + jq parses + JSON arg arrays parse → in-place jq rewrite
#      of ONLY the two array fields; metadata preserved verbatim.
#   3. Delta file exists + jq parse fails → rename to .broken.<timestamp>.json;
#      exit 1 (mirrors update-delta.sh malformed branch).
#   4. JSON arg arrays fail to parse via jq → exit 1 with diagnostic.
#   5. Wrong arg count → exit 2 with usage on stderr.
#
# F.3 architecture: this helper replaces the §10 step 5b inline `!shell` `jq`
# block (DN-2 B verdict 2026-05-27). Sibling-helper pattern preserves the
# update-delta.sh paired-negative test contract (existing test untouched).
#
# @dual-pair: meta-orchestrator-master-backlog-delta
# spec: SKILL.md §10 step 5b (caller) ↔ update-delta.sh (metadata sibling) ↔ this file
#       (arrays sibling); all three agree on JSON key names (last_check_ts /
#       last_check_git_head / untracked_seen / closed_since_last).
# @cc-only-rationale: consumer-facing CC-session helper invoked from the /pipeline
#   slash-command via Bash tool at SKILL.md §10 step 5b; no portable hook fires at
#   the per-skill cross-invocation moment, so a portable fallback would be a no-op
#   outside CC. Pure-bash + jq, deterministic, no paid LLM (no-paid-llm-in-ci.md §1
#   satisfied).
#
# Seams for testing (mirrors update-delta.sh convention):
#   MO_DELTA_FILE — override delta path (default: <resolved-orch-home>/_master-backlog-delta.json)
#   REPO_ROOT     — override repo root (default: git rev-parse --show-toplevel)
#   MO_TIMESTAMP  — override the ISO 8601 UTC timestamp (default: date -u +%Y-%m-%dT%H:%M:%SZ)

set -euo pipefail

if [ "$#" -ne 3 ]; then
  echo "delta-write-from-state.sh: usage: $0 <umbrella-or-no-arg> <current_ids_json_array> <resolved_ids_json_array>" >&2
  exit 2
fi

UMBRELLA="$1"
CURRENT_JSON="$2"
RESOLVED_JSON="$3"

# REPO_ROOT + resolve_target() sourced from lib/common.sh (Stage 4 dedup, BASH_SOURCE-relative).
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"
DELTA_FILE="${MO_DELTA_FILE:-$(resolve_orch_home)/_master-backlog-delta.json}"
TIMESTAMP="${MO_TIMESTAMP:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"

# Missing delta file → exit 1 (sibling scope: update-delta.sh bootstraps fresh).
if [ ! -f "${DELTA_FILE}" ]; then
  echo "delta-write-from-state.sh: delta file missing at ${DELTA_FILE}" >&2
  echo "delta-write-from-state.sh: run update-delta.sh first to bootstrap schema." >&2
  exit 1
fi

# Corrupt delta JSON → rename + exit 1 (mirrors update-delta.sh malformed branch).
if ! jq empty "${DELTA_FILE}" 2>/dev/null; then
  BROKEN_TS="${TIMESTAMP//[:.T]/-}"
  BROKEN="${DELTA_FILE%.json}.broken.${BROKEN_TS}.json"
  mv "${DELTA_FILE}" "${BROKEN}"
  echo "delta-write-from-state.sh: delta corrupt — invalid JSON at ${DELTA_FILE}" >&2
  echo "delta-write-from-state.sh: renamed to ${BROKEN} — re-run update-delta.sh to recreate." >&2
  exit 1
fi

# Validate input JSON arrays parse (fail-fast before mutating the delta file).
if ! echo "${CURRENT_JSON}" | jq -e 'type == "array"' >/dev/null 2>&1; then
  echo "delta-write-from-state.sh: <current_ids_json_array> is not a valid JSON array" >&2
  exit 1
fi
if ! echo "${RESOLVED_JSON}" | jq -e 'type == "array"' >/dev/null 2>&1; then
  echo "delta-write-from-state.sh: <resolved_ids_json_array> is not a valid JSON array" >&2
  exit 1
fi

# Idempotent in-place rewrite of ONLY the two array fields.
# Shape mirrors §10 step 5b prose: untracked_seen = current_ids wrapped as {id, first_seen},
# closed_since_last = resolved_ids wrapped as {id, closed_at}.
# `first_seen` semantics = «most recent sighting» (overwrite-shape, NOT preserve-shape) —
# matches §2.5 Step 9 prose; trades historical-first-seen for shape simplicity.

TARGET="$(resolve_target "${DELTA_FILE}")"

# ── Atomic mkdir-lock (M5) — serialize this read-modify-write against concurrent
#    writers (sibling update-delta.sh or a parallel-worktree session) sharing the same
#    CANON target via symlink. `flock` is unavailable on macOS, so `mkdir` (atomic
#    create-or-fail) is the portable lock primitive. Best-effort: after ~6s of
#    contention we proceed anyway (atomic temp-then-mv still bounds damage).
_LOCK_DIR="${TARGET}.lock"
for _i in $(seq 1 30); do mkdir "${_LOCK_DIR}" 2>/dev/null && break || sleep 0.2; done
trap "rmdir '${_LOCK_DIR}' 2>/dev/null" EXIT

TMP="$(mktemp "$(dirname "${TARGET}")/.delta.tmpXXXXXX")"
jq --arg now "${TIMESTAMP}" \
   --argjson current "${CURRENT_JSON}" \
   --argjson resolved "${RESOLVED_JSON}" \
   '.untracked_seen   = ($current  | map({id: ., first_seen: $now})) |
    .closed_since_last = ($resolved | map({id: ., closed_at: $now}))' \
  "${TARGET}" > "${TMP}"
mv "${TMP}" "${TARGET}"
rmdir "${_LOCK_DIR}" 2>/dev/null || true; trap - EXIT

CURRENT_COUNT="$(echo "${CURRENT_JSON}" | jq 'length')"
RESOLVED_COUNT="$(echo "${RESOLVED_JSON}" | jq 'length')"
echo "delta-write-from-state.sh: arrays updated (umbrella=${UMBRELLA}, current=${CURRENT_COUNT}, resolved=${RESOLVED_COUNT})"
