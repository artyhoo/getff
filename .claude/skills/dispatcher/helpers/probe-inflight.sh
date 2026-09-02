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
#   PROBE_CLAIM_TTL_MIN       minutes before a claim reads STALE (default 120)
#   PROBE_NOW_EPOCH           epoch seconds "now", for deterministic age fixtures
#
# Tested by: packages/core/skills/dispatcher/probe-inflight.test.ts
# Consumed by: .claude/skills/dispatcher/SKILL.md §2.0

set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

AIF_CONTAINER="${AIF_CONTAINER:-aif-handoff-agent-1}"
AIF_REPO_PATH="${AIF_REPO_PATH:-/home/www/rules-as-tests-aif}"
AIF_HOST="${AIF_HOST:-localhost}"
AIF_PORT="${AIF_PORT:-3009}"

# A claim older than this reads STALE rather than blocking forever (starvation mode TD-F5).
# 120min is a deliberate over-estimate of a Phase -1 cold review: the cost of calling a live
# claim stale is a double dispatch, the cost of calling a dead one live is one operator glance.
CLAIM_TTL_MIN="${PROBE_CLAIM_TTL_MIN:-120}"

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
# The orch home resolves by LAYOUT, not by hardcoding the framework path: a consumer
# install receives kickoffs under .ai-factory/orchestrator-prompts/ (setup.d/30-templates.sh:17)
# and never has .claude/orchestrator-prompts, so the old single -f test read "no" for every
# closed consumer umbrella (issue 1414, measured on artyhoo/timeliner 2026-08-17). The 4-line
# shape is forked inline from resolve_orch_home() (.claude/skills/pipeline/helpers/lib/common.sh)
# rather than sourced — pipeline ships at env+, dispatcher at factory, so a cross-skill
# dependency dangles where the sibling is absent (LH-2; same precedent: print-orch-home.sh, PR 1411).
if [[ -n "${PROBE_DONE_MD+x}" ]]; then
  done_md="$PROBE_DONE_MD"
else
  if [[ -d ".claude/orchestrator-prompts" ]]; then
    orch_home=".claude/orchestrator-prompts"
  else
    orch_home=".ai-factory/orchestrator-prompts"
  fi
  if [[ -f "${orch_home}/${SLUG}/done.md" ]]; then
    done_md="yes"
  else
    done_md="no"
  fi
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

# ── Signal 6: CLAIMS — a lane taken before the Phase -1 window ─────────────────
# Signals 1-5 can all be clean while another session is three minutes into a cold
# review of the same stage: an origin branch does not exist yet, no PR, no done.md,
# no container branch, and signal 5 selects only FINISHED tasks that carry a branch
# name. A claim has neither status nor branch — it is a task created `paused:true`
# and parked at `backlog` (AifHandoffBackend.claim()). That is the whole blind spot
# this signal closes: every historical double-dispatch materialised inside exactly
# that window.
#
# Matching is deliberately by slug in title+description rather than by a claim
# marker field. The task's `title` IS the umbrella/stage slug, and inventing a
# marker would be the second status vocabulary premise P-5 forbids. Consequence,
# stated rather than hidden: ANY paused unfinished task under this slug blocks the
# stage, whether claim.ts created it or not. A guard should over-report.
#
# Age split (orphan expiry): a session can die between claim-create and the Phase -1
# verdict, and its claim would otherwise block the stage forever. Past the TTL the
# claim is reported STALE — surfaced for a human decision, never auto-cancelled here
# (an automatic sweep would race the very sessions it protects). An unparseable
# createdAt counts as LIVE: the guard fails toward blocking.
now_epoch="${PROBE_NOW_EPOCH:-$(date +%s)}"
claims=$(printf '%s' "$tasks_json" | jq -r '
  def age_min($iso):
    ($iso // "") as $c
    | if $c == "" then -1
      else (try (($c | sub("\\.[0-9]+Z$"; "Z")) | fromdateiso8601) catch null) as $e
        | if $e == null then -1 else (($NOW | tonumber) - $e) / 60 | floor end
      end;
  [ .[]
    | select(.paused == true)
    | select((.status // "") != "done" and (.status // "") != "verified")
    | select((((.title // "") + " " + (.description // "")) | contains($SLUG)))
    | age_min(.createdAt) as $age
    # Title is squashed to one line and printed LAST: the count below reads fixed
    # fields 1-3, so no title text can ever be mistaken for probe output. A raw
    # multi-line title would otherwise emit a second line and inflate the count.
    | ((.title // "(untitled)") | gsub("[\r\n]+"; " ")) as $title
    | "\(.id[0:8]) age=\($age)m \(if $age >= 0 and $age > ($TTL | tonumber) then "stale" else "live" end) \($title)" ]
  | .[]' --arg SLUG "$SLUG" --arg TTL "$CLAIM_TTL_MIN" --arg NOW "$now_epoch" 2>/dev/null || true)
# Field-3 match, never a substring grep: a task titled "demo fix stale refs" made
# `grep -c ' stale '` count a one-minute-old claim as expired — the verdict then told
# the operator to cancel a lane somebody was actively holding (found in self-review,
# before merge). Positional fields 1-3 are ours; everything after is untrusted title.
claim_count=$(printf '%s' "$claims" | grep -c . || true)
stale_claim_count=$(printf '%s' "$claims" | awk '$3 == "stale"' | grep -c . || true)
live_claim_count=$((claim_count - stale_claim_count))
echo "SIGNAL claim ${claim_count} live=${live_claim_count} stale=${stale_claim_count} ttl=${CLAIM_TTL_MIN}min status=${task_status}"
if [[ "$claim_count" -gt 0 ]]; then
  printf '%s\n' "$claims" | grep . | sed 's/^/  claim: /' || true
fi

# ── Verdict ───────────────────────────────────────────────────────────────────
# Precedence, highest first. PROBE-INCOMPLETE outranks everything because a guard
# that reports a clean state from an unrun probe is worse than no guard: it converts
# ignorance into permission. DONE-UNHARVESTED outranks ALREADY-DONE because an
# unharvested finished task is a live loose end even under a closed umbrella.
#
# The two claim verdicts sit above ALREADY-DONE and IN-FLIGHT for the same reason: a
# claim names a session that is acting on this stage RIGHT NOW (CLAIMED) or an orphan
# that must be resolved before anyone can (STALE-CLAIM), and both are more actionable
# than a merged branch or a closure marker. STALE-CLAIM outranks CLAIMED so a mixed
# set reports the item that needs a decision, not the one that needs patience.
origin_signals=0
[[ "$origin_count" -gt 0 ]] && origin_signals=$((origin_signals + 1))
[[ "$pr_count" -gt 0 ]] && origin_signals=$((origin_signals + 1))
[[ "$done_md" == "yes" ]] && origin_signals=$((origin_signals + 1))

if [[ "$container_status" != "ok" || "$task_status" != "ok" ]]; then
  echo "VERDICT: PROBE-INCOMPLETE"
elif [[ "$unharvested_count" -gt 0 ]]; then
  echo "VERDICT: DONE-UNHARVESTED"
elif [[ "$stale_claim_count" -gt 0 ]]; then
  echo "VERDICT: STALE-CLAIM"
elif [[ "$live_claim_count" -gt 0 ]]; then
  echo "VERDICT: CLAIMED"
elif [[ "$done_md" == "yes" && "$origin_signals" -ge 2 ]]; then
  echo "VERDICT: ALREADY-DONE"
elif [[ "$pr_open_count" -gt 0 || "$container_only_count" -gt 0 || "$origin_count" -gt 0 ]]; then
  echo "VERDICT: IN-FLIGHT"
else
  echo "VERDICT: FRESH"
fi
