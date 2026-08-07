#!/usr/bin/env bash
# update-delta.sh — /pipeline master-backlog-delta writer (per-machine, gitignored).
#
# > Class: C — prose-only; companion paired-negative test at
# >          packages/core/hooks/update-delta.test.ts. No principle test
# >          gates compliance — the test gates the helper's own contract.
# > Authoritative for: deterministic write of `last_check_ts` + `last_check_git_head`
# >                    fields in <resolved-orch-home>/_master-backlog-delta.json.
# > NOT authoritative for: the two arrays `untracked_seen` + `closed_since_last` —
# >                        those are populated by SKILL.md §2.5 logic in Stage 2C
# >                        (round-3 scope reduction mirrors update-cache.sh §3 of
# >                        plan-cache.md). See SKILL.md §2.5 for read-side / delta
# >                        reconciliation discipline.
#
# Usage: update-delta.sh <umbrella-or-no-arg> <outcome-one-liner>
#
# Behaviour:
#   1. If delta file is missing → write initial template (all 4 schema keys present,
#      metadata filled, arrays empty) via heredoc.
#   2. If delta file exists + jq parses → in-place idempotent update of ONLY
#      last_check_ts + last_check_git_head via jq filter; arrays preserved verbatim.
#   3. If delta file exists + jq parse fails → rename to
#      _master-backlog-delta.broken.<timestamp>.json; exit 1 with stderr diagnostic.
#   4. Wrong arg count → exit 2 with usage on stderr.
#
# @dual-pair: meta-orchestrator-master-backlog-delta
# spec: SKILL.md §2.5 (read side, ships Stage 2C) ↔ this file (write side);
#       both must agree on JSON key names (last_check_ts / last_check_git_head /
#       untracked_seen / closed_since_last).
# @cc-only-rationale: consumer-facing CC-session helper invoked from the /pipeline
#   slash-command via Bash tool at SKILL.md §2.5 (Stage 2C); no portable hook fires at
#   the per-skill cross-invocation moment, so a portable fallback would be a no-op outside
#   CC. Pure-bash + jq, deterministic, no paid LLM (no-paid-llm-in-ci.md §1 satisfied).
#
# Seams for testing (mirrors update-cache.sh convention):
#   MO_DELTA_FILE — override delta path (default: <resolved-orch-home>/_master-backlog-delta.json)
#   REPO_ROOT     — override repo root (default: git rev-parse --show-toplevel)
#   MO_GIT_HEAD   — override the git short-SHA captured into last_check_git_head (default: git rev-parse --short HEAD)
#   MO_TIMESTAMP  — override the ISO 8601 UTC timestamp (default: date -u +%Y-%m-%dT%H:%M:%SZ)

set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "update-delta.sh: usage: $0 <umbrella-or-no-arg> <outcome-one-liner>" >&2
  exit 2
fi

UMBRELLA="$1"
OUTCOME="$2"

# REPO_ROOT + resolve_target() sourced from lib/common.sh (Stage 4 dedup, BASH_SOURCE-relative).
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"
DELTA_FILE="${MO_DELTA_FILE:-$(resolve_orch_home)/_master-backlog-delta.json}"
TIMESTAMP="${MO_TIMESTAMP:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"
GIT_HEAD="${MO_GIT_HEAD:-$(git -C "${REPO_ROOT}" rev-parse --short HEAD 2>/dev/null || echo "unknown")}"

# Ensure parent directory exists.
mkdir -p "$(dirname "${DELTA_FILE}")"

write_initial_template() {
  # Single-SSOT for the delta JSON schema (design §7.1). Arrays start empty;
  # SKILL.md §2.5 (Stage 2C) populates them on each invocation.
  cat > "${DELTA_FILE}" <<TEMPLATE
{
  "last_check_ts": "${TIMESTAMP}",
  "last_check_git_head": "${GIT_HEAD}",
  "untracked_seen": [],
  "closed_since_last": []
}
TEMPLATE
}


update_existing() {
  # Idempotent in-place update of ONLY the two metadata fields.
  # Arrays (untracked_seen / closed_since_last) are preserved verbatim — this
  # is the load-bearing scope contract (mirrors update-cache.sh round-3 scope
  # reduction; avoids #cache-writer-feature-creep per plan-cache.md §4).
  # Writes THROUGH a symlink target (resolve_target) so a shared symlink is preserved.
  local tmp target
  target="$(resolve_target "${DELTA_FILE}")"
  tmp="$(mktemp "$(dirname "${target}")/.delta.tmpXXXXXX")"
  jq --arg ts "${TIMESTAMP}" --arg sha "${GIT_HEAD}" \
    '.last_check_ts = $ts | .last_check_git_head = $sha' \
    "${target}" > "${tmp}"
  mv "${tmp}" "${target}"
}

# ── Atomic mkdir-lock (M5) — serialize concurrent read-modify-write across parallel
#    worktrees that share the CANON target via symlink. `flock` is unavailable on macOS,
#    so `mkdir` (atomic create-or-fail) is the portable lock primitive. Best-effort:
#    after ~6s of contention we proceed anyway (atomic temp-then-mv still bounds damage).
_LOCK_TARGET="$(resolve_target "${DELTA_FILE}")"
_LOCK_DIR="${_LOCK_TARGET}.lock"
for _i in $(seq 1 30); do mkdir "${_LOCK_DIR}" 2>/dev/null && break || sleep 0.2; done
trap "rmdir '${_LOCK_DIR}' 2>/dev/null" EXIT

# Decision tree.
if [ ! -f "${DELTA_FILE}" ]; then
  write_initial_template
  echo "update-delta.sh: fresh delta written at ${DELTA_FILE}"
  exit 0
fi

if ! jq empty "${DELTA_FILE}" 2>/dev/null; then
  BROKEN_TS="${TIMESTAMP//[:.T]/-}"
  BROKEN="${DELTA_FILE%.json}.broken.${BROKEN_TS}.json"
  mv "${DELTA_FILE}" "${BROKEN}"
  echo "update-delta.sh: delta corrupt — invalid JSON at ${DELTA_FILE}" >&2
  echo "update-delta.sh: renamed to ${BROKEN} — re-run to recreate fresh." >&2
  exit 1
fi

update_existing
rmdir "${_LOCK_DIR}" 2>/dev/null || true; trap - EXIT
echo "update-delta.sh: updated ${DELTA_FILE} (umbrella=${UMBRELLA}, head=${GIT_HEAD})"
