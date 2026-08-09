#!/usr/bin/env bash
# probe-inflight.sh — the §2.0 pre-dispatch guard, executed rather than narrated.
#
# Input:  SLUG env var (umbrella slug, e.g. "beta-delivery-ux")
# Output: one `SIGNAL <name> <value...>` line per probe, then one `VERDICT: <v>` line.
# Exit:   always 0 — the caller branches on the VERDICT line, never on the exit code
#         (same contract as monitor-classify.sh; a guard that aborts is a guard that
#         gets skipped).
#
# Why this exists: the guard's three original signals — `git branch -a`, `gh pr list`,
# `done.md` — are ALL origin/host-scoped. A branch that exists only inside the aif
# container is invisible to every one of them, so a finished-but-unharvested run reads
# as "nothing here" and the umbrella gets dispatched a second time. That is not
# hypothetical: `feature/beta-delivery-ux-995e9c` (2026-08-08T21:22Z) was fired by a
# session whose probe checked origin + `gh pr list` only, ~1h after run 3 had finished
# in the container. One wasted run.
#
# The fix is not "a fourth command in the prose" — prose is read by attention, and
# attention is not a detection layer (.claude/rules/attention-is-not-a-mechanism.md §1).
# The fix is that the container probe RUNS here, and that a container probe which could
# not run yields PROBE-INCOMPLETE rather than silence. An unasked question must never
# render as a clean answer.
#
# Testability: every collector honours an env override so the script can be driven from
# fixtures with no docker, no gh and no network (the TASK_JSON pattern established by
# monitor-classify.sh). Overrides are for tests and for degraded hosts; unset means
# "go and look".
#   PROBE_ORIGIN_BRANCHES     newline-separated branch names   (else: git branch -a --list)
#   PROBE_PRS                 JSON array of {number,state,headRefName} (else: gh pr list)
#   PROBE_DONE_MD             yes|no                           (else: test -f done.md)
#   PROBE_CONTAINER_BRANCHES  newline-separated branch names   (else: docker exec … git branch)
#   PROBE_CONTAINER_STATUS    ok|unavailable                   (else: derived from docker exit)
#   PROBE_TASKS               JSON array of aif task objects   (else: curl /tasks)
#
# Tested by: packages/core/skills/dispatcher/probe-inflight.test.ts
# Consumed by: .claude/skills/dispatcher/SKILL.md §2.0

set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

AIF_CONTAINER="${AIF_CONTAINER:-aif-handoff-agent-1}"
AIF_REPO_PATH="${AIF_REPO_PATH:-/home/www/rules-as-tests-aif}"
AIF_HOST="${AIF_HOST:-localhost}"
AIF_PORT="${AIF_PORT:-3009}"

if [[ -z "${SLUG:-}" ]]; then
  echo "SIGNAL error SLUG-not-set"
  echo "VERDICT: PROBE-INCOMPLETE"
  exit 0
fi

# ── Signal 1: origin/host branches ────────────────────────────────────────────
if [[ -n "${PROBE_ORIGIN_BRANCHES+x}" ]]; then
  origin_branches="$PROBE_ORIGIN_BRANCHES"
else
  origin_branches=$(git branch -a --list "*${SLUG}*" 2>/dev/null | sed 's/^[* ]*//' || true)
fi
origin_count=$(printf '%s' "$origin_branches" | grep -c . || true)
echo "SIGNAL origin-branch ${origin_count}"

# ── Signal 2: pull requests (any state) ───────────────────────────────────────
if [[ -n "${PROBE_PRS+x}" ]]; then
  prs_json="$PROBE_PRS"
elif command -v gh &>/dev/null; then
  prs_json=$(gh pr list --state all --search "$SLUG" --json number,state,headRefName --limit 100 2>/dev/null || echo '[]')
else
  prs_json='[]'
fi
[[ -z "$prs_json" ]] && prs_json='[]'
pr_count=$(printf '%s' "$prs_json" | jq 'length' 2>/dev/null || echo 0)
pr_open_count=$(printf '%s' "$prs_json" | jq '[.[] | select(.state == "OPEN")] | length' 2>/dev/null || echo 0)
echo "SIGNAL pr ${pr_count} open=${pr_open_count}"

# ── Signal 3: done.md closure marker ──────────────────────────────────────────
if [[ -n "${PROBE_DONE_MD+x}" ]]; then
  done_md="$PROBE_DONE_MD"
elif [[ -f ".claude/orchestrator-prompts/${SLUG}/done.md" ]]; then
  done_md="yes"
else
  done_md="no"
fi
echo "SIGNAL done-md ${done_md}"

# ── Signal 4: CONTAINER branches — the blind spot this helper exists to close ──
# A container-only branch is work that origin cannot see. Distinguishing "the
# container has nothing" from "we never asked the container" is the whole point:
# the second must not be reported as the first.
container_status="ok"
if [[ -n "${PROBE_CONTAINER_BRANCHES+x}" ]]; then
  container_branches="$PROBE_CONTAINER_BRANCHES"
  container_status="${PROBE_CONTAINER_STATUS:-ok}"
elif ! command -v docker &>/dev/null; then
  container_branches=""
  container_status="unavailable"
elif ! container_branches=$(docker exec "$AIF_CONTAINER" git -C "$AIF_REPO_PATH" branch -a 2>/dev/null); then
  container_branches=""
  container_status="unavailable"
fi
container_branches=$(printf '%s' "$container_branches" | sed 's/^[+* ]*//' | grep -- "$SLUG" || true)
container_count=$(printf '%s' "$container_branches" | grep -c . || true)

# Container-ONLY = present in the container, absent from origin. Those are the
# branches every origin-scoped signal structurally cannot report.
#
# Detail lines below are emitted with `grep . | sed`, never a `while read` loop:
# under `set -e` the loop's exit status is its final body's, so a trailing blank line
# makes `[[ -n "" ]]` return 1 and kills the script mid-probe — a guard that dies
# partway reports fewer signals than it checked. (Both shapes were hit live while
# building this: '%s' silently dropped the last entry, '%s\n' + loop aborted at
# signal 4. The pipeline form has neither failure mode.)
container_only=""
if [[ "$container_status" == "ok" && "$container_count" -gt 0 ]]; then
  while IFS= read -r cb; do
    [[ -z "$cb" ]] && continue
    if ! printf '%s\n' "$origin_branches" | grep -qF -- "$cb"; then
      container_only="${container_only}${cb}"$'\n'
    fi
  done <<< "$container_branches"
fi
container_only_count=$(printf '%s' "$container_only" | grep -c . || true)
echo "SIGNAL container-branch ${container_count} only=${container_only_count} status=${container_status}"
if [[ "$container_only_count" -gt 0 ]]; then
  printf '%s\n' "$container_only" | grep . | sed 's/^/  container-only: /' || true
fi

# ── Signal 5: aif tasks finished but never harvested ──────────────────────────
# The actionable shape behind the incident: status=done/verified, a branch name, and
# no PR carrying that branch. Work that is complete and invisible.
if [[ -n "${PROBE_TASKS+x}" ]]; then
  tasks_json="$PROBE_TASKS"
else
  tasks_json=$(curl -s --max-time 10 "http://${AIF_HOST}:${AIF_PORT}/tasks" 2>/dev/null || echo '[]')
fi
[[ -z "$tasks_json" ]] && tasks_json='[]'
if ! printf '%s' "$tasks_json" | jq -e 'type == "array"' &>/dev/null; then
  tasks_json='[]'
  task_status="unavailable"
else
  task_status="ok"
fi

unharvested=$(printf '%s\n%s' "$tasks_json" "$prs_json" | jq -rs '
  (.[0] // []) as $tasks | (.[1] // []) as $prs
  | [$prs[] | .headRefName] as $heads
  | [ $tasks[]
      | select((.status == "done") or (.status == "verified"))
      | select((.branchName // "") != "")
      | select((.branchName | contains($SLUG)))
      | select((.branchName as $b | $heads | index($b)) == null)
      | "\(.id[0:8]) \(.branchName)" ]
  | .[]' --arg SLUG "$SLUG" 2>/dev/null || true)
unharvested_count=$(printf '%s' "$unharvested" | grep -c . || true)
echo "SIGNAL task-done-unharvested ${unharvested_count} status=${task_status}"
if [[ "$unharvested_count" -gt 0 ]]; then
  printf '%s\n' "$unharvested" | grep . | sed 's/^/  unharvested: /' || true
fi

# ── Verdict ───────────────────────────────────────────────────────────────────
# Precedence, highest first. PROBE-INCOMPLETE outranks everything because a guard
# that reports a clean state from an unrun probe is worse than no guard: it converts
# ignorance into permission. DONE-UNHARVESTED outranks ALREADY-DONE because an
# unharvested finished task is a live loose end even under a closed umbrella.
origin_signals=0
[[ "$origin_count" -gt 0 ]] && origin_signals=$((origin_signals + 1))
[[ "$pr_count" -gt 0 ]] && origin_signals=$((origin_signals + 1))
[[ "$done_md" == "yes" ]] && origin_signals=$((origin_signals + 1))

if [[ "$container_status" != "ok" || "$task_status" != "ok" ]]; then
  echo "VERDICT: PROBE-INCOMPLETE"
elif [[ "$unharvested_count" -gt 0 ]]; then
  echo "VERDICT: DONE-UNHARVESTED"
elif [[ "$done_md" == "yes" && "$origin_signals" -ge 2 ]]; then
  echo "VERDICT: ALREADY-DONE"
elif [[ "$pr_open_count" -gt 0 || "$container_only_count" -gt 0 || "$origin_count" -gt 0 ]]; then
  echo "VERDICT: IN-FLIGHT"
else
  echo "VERDICT: FRESH"
fi
