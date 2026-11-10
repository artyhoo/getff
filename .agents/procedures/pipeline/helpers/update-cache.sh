#!/usr/bin/env bash
# update-cache.sh — /pipeline plan-cache writer (per-machine, gitignored).
#
# > Class: C — prose-only; companion paired-negative test at
# >          packages/core/hooks/update-cache.test.ts. No principle test
# >          gates compliance — the test gates the helper's own contract.
# > Authoritative for: deterministic write of the `## Last invocation` section
# >                    of <resolved-orch-home>/_plan-cache.md.
# > NOT authoritative for: other cache sections — those are populated by direct
# >                        Edit of the cache file before invoking this helper
# >                        (round-3 scope reduction per umbrella §1.3 item 4).
# >                        See SKILL.md §1 Step 2 item 6 for read-side / cache
# >                        reconciliation discipline.
#
# Usage: update-cache.sh <umbrella-or-no-arg> <outcome-one-liner>
#
# Behaviour:
#   1. If cache file is missing → write initial template skeleton (all sections present,
#      placeholders for non-«Last invocation» sections) with «Last invocation» filled.
#   2. If cache file exists with intact «Last invocation» header → in-place sed-update
#      ONLY the 4 «Last invocation» fields (Timestamp / Umbrella / Git HEAD / Session
#      outcome). All other content preserved verbatim (idempotency property).
#   3. If cache file is malformed (missing «## Last invocation» header) → exit 1 with
#      stderr diagnostic; rename file to _plan-cache.broken.<timestamp>.md.
#
# @dual-pair: meta-orchestrator-plan-cache
# spec: SKILL.md §10 item 5 (read side) ↔ this file (write side); both must agree on
#       section header names («## Last invocation» literal, 4 named fields).
# @cc-only-rationale: consumer-facing CC-session helper invoked from the /pipeline
#   slash-command via Bash tool at §10 item 5; no portable hook fires at the per-skill
#   cross-invocation moment, so a portable fallback would be a no-op outside CC.
#   Pure-bash, deterministic, no paid LLM (no-paid-llm-in-ci.md §1 satisfied).
#
# Seams for testing (matches plan-currency-check.sh convention):
#   MO_CACHE_FILE — override cache path (default: <resolved-orch-home>/_plan-cache.md,
#                   resolve_orch_home() — .claude/orchestrator-prompts | .ai-factory/orchestrator-prompts)
#   REPO_ROOT     — override repo root (default: git rev-parse --show-toplevel)
#   MO_GIT_HEAD   — override the git short-SHA captured into «Git HEAD» field (default: git rev-parse --short HEAD)
#   MO_TIMESTAMP  — override the ISO 8601 UTC timestamp (default: date -u +%Y-%m-%dT%H:%M:%SZ)

set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "update-cache.sh: usage: $0 <umbrella-or-no-arg> <outcome-one-liner>" >&2
  exit 2
fi

UMBRELLA="$1"
OUTCOME="$2"

# REPO_ROOT + resolve_target() sourced from lib/common.sh (Stage 4 dedup, BASH_SOURCE-relative).
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"
CACHE_FILE="${MO_CACHE_FILE:-$(resolve_orch_home)/_plan-cache.md}"
TIMESTAMP="${MO_TIMESTAMP:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"
GIT_HEAD="${MO_GIT_HEAD:-$(git -C "${REPO_ROOT}" rev-parse --short HEAD 2>/dev/null || echo "unknown")}"

# Ensure parent directory exists (it always should — the orchestration home is in repo).
mkdir -p "$(dirname "${CACHE_FILE}")"

write_initial_template() {
  # Single-SSOT for the cache format. Mirrored locally as a dogfood artefact by the
  # umbrella's Deliverable A; the helper is authoritative for the actual on-disk shape.
  cat > "${CACHE_FILE}" <<TEMPLATE
# /pipeline — plan cache (per-machine, gitignored)

> Updated by \`.claude/skills/pipeline/helpers/update-cache.sh\` at end of each invocation (\`## Last invocation\` section only — round-3 scope).
> Read by SKILL.md §1 \`!shell\` injection at start of next invocation.
> **NOT load-bearing.** Mechanical state (\`gh pr list\`, \`git log\`, \`wave-sequencing-plan.md\`) always wins per \`feedback_no_human_verification_ai_self_verifies\` + SKILL.md §1 Step 2 item 5.

<!-- @dual-pair: meta-orchestrator-plan-cache -->
<!-- spec: .claude/orchestrator-prompts/meta-orchestrator-skill-memory/kickoff.md §1.1 -->

## Last invocation
- Timestamp (UTC): ${TIMESTAMP}
- Umbrella: ${UMBRELLA}
- Git HEAD: ${GIT_HEAD}
- Session outcome: ${OUTCOME}

## Last priority ranking (no-arg invocations only)
<table from §2 step 3 output, or «n/a» if umbrella-arg invocation — populated by direct Edit before helper invocation>

## DRIFT items surfaced last time
<numbered list from §1 verdict, with resolution status: RESOLVED / OPEN / STALE — populated by direct Edit>

## DECISION-NEEDED pending maintainer
<list of fork-surface items from §2 step 4 or §7 reviewer dispatch, with one-line «awaiting answer on:» — populated by direct Edit>

## Deferred follow-ups
<list of items the session explicitly deferred — e.g. «sub-wave D queued for fresh-quota session» — populated by direct Edit>

## Stale-cache marker
- If \`git rev-parse HEAD\` ≠ this file's «Git HEAD» AND the diff touches \`wave-sequencing-plan.md\` → cache is STALE; meta-orchestrator MUST emit «cache stale — last sync at <SHA>, now at <SHA>; re-deriving from mechanical state».
TEMPLATE
}


update_existing() {
  # Idempotent in-place update of the 4 «Last invocation» fields. Uses awk for a single
  # pass with state machine: enter-block on the literal heading, exit-block on the next
  # `## ` heading, replace only the 4 known field lines, pass everything else verbatim.
  # Writes THROUGH a symlink target (resolve_target) so a shared symlink is preserved.
  local tmp target
  target="$(resolve_target "${CACHE_FILE}")"
  tmp="$(mktemp "$(dirname "${target}")/.plan-cache.tmpXXXXXX")"
  awk -v ts="${TIMESTAMP}" -v umb="${UMBRELLA}" -v sha="${GIT_HEAD}" -v out="${OUTCOME}" '
    BEGIN { in_block = 0 }
    /^## Last invocation$/ { in_block = 1; print; next }
    in_block && /^## / { in_block = 0; print; next }
    in_block && /^- Timestamp \(UTC\): / { print "- Timestamp (UTC): " ts; next }
    in_block && /^- Umbrella: /          { print "- Umbrella: " umb; next }
    in_block && /^- Git HEAD: /          { print "- Git HEAD: " sha; next }
    in_block && /^- Session outcome: /   { print "- Session outcome: " out; next }
    { print }
  ' "${target}" > "${tmp}"
  mv "${tmp}" "${target}"
}

# ── Atomic mkdir-lock (M5) — serialize concurrent read-modify-write across parallel
#    worktrees that share the CANON target via symlink. `flock` is unavailable on macOS,
#    so `mkdir` (atomic create-or-fail) is the portable lock primitive. Best-effort:
#    after ~6s of contention we proceed anyway (atomic temp-then-mv still bounds damage).
_LOCK_TARGET="$(resolve_target "${CACHE_FILE}")"
_LOCK_DIR="${_LOCK_TARGET}.lock"
for _i in $(seq 1 30); do mkdir "${_LOCK_DIR}" 2>/dev/null && break || sleep 0.2; done
trap "rmdir '${_LOCK_DIR}' 2>/dev/null" EXIT

# Decision tree.
if [ ! -f "${CACHE_FILE}" ]; then
  write_initial_template
  echo "update-cache.sh: fresh cache written at ${CACHE_FILE}"
  exit 0
fi

if ! grep -q '^## Last invocation$' "${CACHE_FILE}"; then
  BROKEN="${CACHE_FILE%.md}.broken.${TIMESTAMP//[:.]/-}.md"
  mv "${CACHE_FILE}" "${BROKEN}"
  echo "update-cache.sh: cache corrupt — missing '## Last invocation' header." >&2
  echo "update-cache.sh: renamed to ${BROKEN} — re-run to recreate fresh." >&2
  exit 1
fi

update_existing
rmdir "${_LOCK_DIR}" 2>/dev/null || true; trap - EXIT
echo "update-cache.sh: updated ${CACHE_FILE} (umbrella=${UMBRELLA}, head=${GIT_HEAD})"
