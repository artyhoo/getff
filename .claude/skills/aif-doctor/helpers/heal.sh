#!/usr/bin/env bash
# heal.sh — aif-doctor non-interactive heal preflight (PORTABLE, shipped to consumers).
#
# "The dispatcher calls the doctor; the doctor heals." The runtime-bridge dispatcher runs THIS
# via RUNTIME_BRIDGE_PREFLIGHT before a dispatch (env-gated, ship-safe NO-OP when unset, runs
# after dedup / before backend-resolve — packages/runtime-bridge/src/cli/dispatch.ts runPreflight).
# The dispatcher only knows "call the doctor"; the doctor owns WHAT healing means. Today that is:
#   1. hook-drift sync (Tier-1, runs EVEN with tasks in flight — see §3.8 of the SKILL catalogue);
#   2. the Tier-1 reversible base-refresh (aif-doctor SKILL §3.4), only when no task is in-flight.
# Grow this entrypoint as new Tier-1 auto-heals are codified.
#
# NON-BLOCKING by contract: always exits 0 — a failed heal warns; the dispatcher proceeds.
#
# Opt-in wiring (consumer, never mandatory — making a companion mandatory is a goal change):
#   export RUNTIME_BRIDGE_PREFLIGHT='bash .claude/skills/aif-doctor/helpers/heal.sh'
#
# Usage: bash heal.sh [branch]                         (branch defaults to staging)
# Env:   RUNTIME_BRIDGE_AIF_URL (default http://localhost:3009)
#        AIF_REFRESH_HELPER     (default: sibling refresh-aif-base.sh)
#        AIF_DOCKER_CMD         (default: docker — full command prefix, e.g. "ssh pc-lan docker"
#                                when the aif containers live behind ssh; word-split on purpose)
#        AIF_AGENT_CONTAINER    (default: local `docker ps` discovery, mirrors refresh-aif-base.sh)
#        AIF_HEAL_HOOK_SYNC     (default: 1 — set 0 to skip the hook-drift sync step)
#
# In-flight interlock (honest source = GET /tasks).
#
# The earlier interlock read `activeTaskCount` from `/agent/status`, which is known to
# under-report (live measurement 2026-07-24: activeTaskCount=0 while 4 tasks were
# genuinely in flight — see docs/meta-factory/research-patches/2026-07-24-autonomous-
# loop-diagnostics.md finding F1, merged in #1129). The lie treated a busy runtime as
# "idle" and yanked the base out from under running workers. We now scan /tasks directly
# and treat any fetch/parse error as BUSY (fail-closed): skipping the heal is NOT the
# same as failing the dispatch (runPreflight warns-and-proceeds regardless —
# packages/runtime-bridge/src/cli/dispatch.ts:74-89).
#
# A task is in-flight when:
#   status ∈ {planning, implementing, review}                              — always
#   status = plan_ready AND paused != true                                 — fail-safe
# All other statuses (backlog, done, verified, cancelled, paused-plan_ready)
# are NOT in-flight.
set -uo pipefail            # deliberately NOT -e: never abort the dispatcher
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
BRANCH="${1:-staging}"
AIF_URL="${RUNTIME_BRIDGE_AIF_URL:-http://localhost:3009}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || echo .)"

# ── Docker reachability. $DC is intentionally unquoted at call sites: AIF_DOCKER_CMD
# may carry a full command prefix ("ssh pc-lan docker") whose words must split.
# Discovery avoids `--format '{{.Names}}'`: the local shell strips the quotes before ssh,
# and a bare {{...}} is a metacharacter meal for a PowerShell ssh host — name comes from
# the last column of the default table, parsed LOCALLY (only plain words cross the wire).
DC="${AIF_DOCKER_CMD:-docker}"
C="${AIF_AGENT_CONTAINER:-$($DC ps --filter name=agent 2>/dev/null | tail -n +2 | awk '{print $NF}' | grep -i aif | head -1)}"

# ── Tier-1 heal #1: hook-drift sync, base clones → live task worktrees. ───────────
# Why this exists (2026-09-09 incident, SKILL §3.8): worktrees copy `.claude/` ONCE at
# creation (copyProjectContextToWorktree), so a hook fixed in the base clone never reaches
# already-created worktrees — 9 live worktrees kept demanding the recap that was breaking
# every SDK sidecar, and the only exit was a manual per-worktree patch. This step makes
# that patch mechanical: for every base clone, push its .claude/hooks REGULAR FILES into
# each sibling `<base>-feature-*` worktree when they drifted.
#   Safe while tasks run: a session in flight already loaded its hook; the next session
#   in that worktree picks up the synced file (write is copy+mv, atomic per file).
#   Reversible: every overwritten file is backed up under /tmp/doctor-hooksync/<ts>/ in
#   the container (container-local — gone on rebuild, same trade-off as §3.4).
#   Deliberately NOT the full .claude/ overlay: no symlinks, no deletions, no directories
#   — the §3.5 EEXIST history is exactly what a full-overlay sync would re-trigger.
heal_hook_drift() {
  [ "${AIF_HEAL_HOOK_SYNC:-1}" = "1" ] || { echo "[aif-doctor heal] hook-sync skipped (AIF_HEAL_HOOK_SYNC=0)"; return 0; }
  [ -n "$C" ] || { echo "[aif-doctor heal] hook-sync skipped — no aif agent container reachable via: $DC"; return 0; }
  # POSIX sh inside the container; script piped via stdin so no nested quoting is needed.
  # -e passes the optional root override through (empty when unset → container default).
  if ! $DC exec -i -e AIF_CONTAINER_REPO_ROOT="${AIF_CONTAINER_REPO_ROOT:-}" "$C" sh -s <<'HOOKSYNC'
set -u
ROOT="${AIF_CONTAINER_REPO_ROOT:-/home/www}"
TS="$(date +%Y%m%d-%H%M%S)"
BKROOT="/tmp/doctor-hooksync/$TS"
synced=0; backed_up=0; bases=0
for hooks_dir in "$ROOT"/*/.claude/hooks; do
  [ -d "$hooks_dir" ] || continue
  base="$(dirname "$(dirname "$hooks_dir")")"
  case "${base##*/}" in *-feature-*) continue ;; esac   # worktrees are not sources
  bases=$((bases + 1))
  for wt in "$ROOT/${base##*/}"-feature-*; do
    [ -d "$wt" ] || continue
    mkdir -p "$wt/.claude/hooks"
    # Regular files only (find -type f, maxdepth 1): never symlinks (§3.5), never dirs.
    for f in $(find "$hooks_dir" -maxdepth 1 -type f 2>/dev/null); do
      name="${f##*/}"
      dst="$wt/.claude/hooks/$name"
      if [ -f "$dst" ] && cmp -s "$f" "$dst"; then continue; fi
      if [ -f "$dst" ]; then
        mkdir -p "$BKROOT/${wt##*/}"
        cp "$dst" "$BKROOT/${wt##*/}/$name.bak" && backed_up=$((backed_up + 1))
      fi
      cp "$f" "$dst.hooksync-new" && mv "$dst.hooksync-new" "$dst" && synced=$((synced + 1)) \
        || echo "[aif-doctor heal] hook-sync: failed to write $dst — skipped"
    done
  done
done
echo "[aif-doctor heal] hook-sync: $bases base(s), $synced file(s) synced, $backed_up backed up to $BKROOT"
HOOKSYNC
  then
    echo "[aif-doctor heal] hook-sync failed (container unreachable?) — dispatch proceeds"
  fi
}
heal_hook_drift

# ── Fetch /tasks. Any curl error OR empty body → fail-closed (BUSY). ───────────────
TASKS_JSON="$(curl -s -m5 "$AIF_URL/tasks" 2>/dev/null)" || {
  echo "[aif-doctor heal] /tasks curl exit non-zero — skip base-refresh (fail-closed)"
  exit 0
}
if [ -z "$TASKS_JSON" ]; then
  echo "[aif-doctor heal] /tasks returned empty body — skip base-refresh (fail-closed)"
  exit 0
fi

# ── Parse. Validate body is a JSON array, then count in-flight tasks. ──────────────
# TASKS_COMPACT is reused by the no-jq branch (whitespace-stripped for simple grep).
TASKS_COMPACT="$(printf '%s' "$TASKS_JSON" | tr -d '[:space:]')"
case "$TASKS_COMPACT" in
  '[]') # Empty array — genuinely idle.
    INFLIGHT_COUNT=0
    ;;
  '['*) # Non-empty array — parse with jq when available, else conservative grep.
    if command -v jq >/dev/null 2>&1; then
      RAW_COUNT="$(printf '%s' "$TASKS_JSON" | jq -r '
        [.[] | select(
          .status == "planning" or
          .status == "implementing" or
          .status == "review" or
          (.status == "plan_ready" and ((.paused // false) | not))
        )] | length' 2>/dev/null)" || RAW_COUNT=""
      # Integer-validate. Non-numeric / null / empty → fail-closed (T-HEAL-B).
      case "$RAW_COUNT" in
        ''|*[!0-9]*)
          echo "[aif-doctor heal] /tasks returned JSON but jq produced non-integer count ('$RAW_COUNT') — skip base-refresh (fail-closed)"
          exit 0
          ;;
      esac
      INFLIGHT_COUNT=$RAW_COUNT
    else
      # No-jq fallback: conservative grep-based count. Whitespace stripped above so
      # JSON keys/values are tightly packed (whitespace is not significant inside
      # string values for these keys).
      CERTAIN_INFLIGHT=0
      for s in planning implementing review; do
        n="$(printf '%s' "$TASKS_COMPACT" | grep -oE "\"status\":\"$s\"" | wc -l)"
        CERTAIN_INFLIGHT=$((CERTAIN_INFLIGHT + n))
      done
      PLAN_READY_TOTAL="$(printf '%s' "$TASKS_COMPACT" | grep -oE '"status":"plan_ready"' | wc -l)"
      # plan_ready is in-flight UNLESS its containing {...} object also carries
      # paused:true. Both field orders covered. A non-match (nested braces,
      # unusual formatting) leaves PLAN_READY_PAUSED=0, treating ALL plan_ready
      # as in-flight — the fail-safe direction per kickoff §2.
      PLAN_READY_PAUSED="$(printf '%s' "$TASKS_COMPACT" \
        | grep -oE '\{[^{}]*"status":"plan_ready"[^{}]*"paused":true[^{}]*\}|\{[^{}]*"paused":true[^{}]*"status":"plan_ready"[^{}]*\}' \
        | wc -l)"
      INFLIGHT_COUNT=$((CERTAIN_INFLIGHT + PLAN_READY_TOTAL - PLAN_READY_PAUSED))
    fi
    ;;
  *) # Body is non-empty but does not begin with `[` — malformed.
    echo "[aif-doctor heal] /tasks returned non-array body (length=${#TASKS_JSON}, first-byte='$(printf '%s' "$TASKS_COMPACT" | cut -c1)') — skip base-refresh (fail-closed)"
    exit 0
    ;;
esac

# ── Decision. ──────────────────────────────────────────────────────────────────────
if [ "$INFLIGHT_COUNT" -gt 0 ]; then
  echo "[aif-doctor heal] $INFLIGHT_COUNT task(s) in-flight — skip base-refresh"
  exit 0
fi

REFRESH="${AIF_REFRESH_HELPER:-$SCRIPT_DIR/refresh-aif-base.sh}"
if [ -f "$REFRESH" ]; then
  bash "$REFRESH" "$BRANCH" || echo "[aif-doctor heal] base-refresh non-fatal failure — dispatch proceeds"
else
  echo "[aif-doctor heal] refresh helper missing ($REFRESH) — skip"
fi
exit 0
