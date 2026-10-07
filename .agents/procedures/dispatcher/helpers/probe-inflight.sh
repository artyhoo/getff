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
# Which repository is asked: the container checkout is NOT hardcoded. It resolves as
# (i) explicit AIF_REPO_PATH, else (ii) the aif project record — GET /projects, the
# record whose .id == RUNTIME_BRIDGE_AIF_PROJECT_ID, its rootPath
# (kickoff-l3.decisions.md#decision-1; the per-id route 404s, only the list endpoint
# exists). When no path is derivable the container is NOT asked: container_status
# reads unavailable with the named cause on the signal line — never status=ok from a
# different project's checkout (issue 1439).
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
#   PROBE_PROJECTS            JSON array of aif project objects (else: curl /projects)
#   PROBE_DOCKER_BIN          docker binary to probe/exec (default: docker)
#
# Signal 4 addresses the aif runtime by NAME and by docker endpoint, and both are machine
# state, not repo truth — a relocated stack silently makes the signal unaskable:
#   AIF_CONTAINER   agent container name. Unset => DISCOVERED (see below), the same
#                   `docker ps --filter name=agent | grep -i aif` resolution that
#                   refresh-aif-base.sh, bridge-health.sh and bridge-cleanup.sh use.
#   DOCKER_CONTEXT  read by docker itself. Unset (and no DOCKER_HOST) => the probe may
#                   switch to another docker context where the agent container runs.
# Discovery, when AIF_CONTAINER is unset, is `.claude/skills/aif-doctor/helpers/aif-agent-target.sh`
# (read its header for the rules): the current docker context first; other contexts only
# if the caller pinned neither DOCKER_CONTEXT nor DOCKER_HOST, each bounded by
# PROBE_CONTEXT_TIMEOUT_S (default 8). Only an UNAMBIGUOUS candidate is used; two or more
# => PROBE-INCOMPLETE with `ambiguous-agent:`. The choice and each context's outcome print
# as a `container-target:` detail line.
# Why: measured 2026-09-30 on the Mac, the stack runs on the PC (context `pc`, container
# `aif-agent-1`) while the Mac daemon is down. The fixed default made every bare run
# PROBE-INCOMPLETE until the caller hand-set both knobs — a manual step at every dispatch.
# An explicit AIF_CONTAINER or DOCKER_CONTEXT always wins; discovery never overrides them.
#   PROBE_CLAIM_TTL_MIN       minutes before a claim reads STALE (default 120)
#   PROBE_NOW_EPOCH           epoch seconds "now", for deterministic age fixtures
#   PROBE_CONTEXT_TIMEOUT_S   seconds per docker context during discovery (default 8)
#
# Tested by: packages/core/skills/dispatcher/probe-inflight.test.ts
# Consumed by: .claude/skills/dispatcher/SKILL.md §2.0

set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

AIF_CONTAINER="${AIF_CONTAINER:-}"
AIF_CONTAINER_DEFAULT="aif-handoff-agent-1"
CONTEXT_TIMEOUT_S="${PROBE_CONTEXT_TIMEOUT_S:-8}"
[[ "$CONTEXT_TIMEOUT_S" =~ ^[0-9]+$ && "$CONTEXT_TIMEOUT_S" -gt 0 ]] || CONTEXT_TIMEOUT_S=8
AIF_REPO_PATH="${AIF_REPO_PATH:-}"
AIF_HOST="${AIF_HOST:-localhost}"
AIF_PORT="${AIF_PORT:-3009}"
PROBE_DOCKER_BIN="${PROBE_DOCKER_BIN:-docker}"

# A claim older than this reads STALE rather than blocking forever (starvation mode TD-F5).
# 120min is a deliberate over-estimate of a Phase -1 cold review: the cost of calling a live
# claim stale is a double dispatch, the cost of calling a dead one live is one operator glance.
CLAIM_TTL_MIN="${PROBE_CLAIM_TTL_MIN:-120}"

# ══ --late: the reading taken immediately before an outward act ═══════════════
# The default mode answers «is anyone on this umbrella?» when work STARTS. That is a point
# reading, and the duplicates recorded after it was codified all happened inside the window it
# cannot see: a parallel session created and merged the same stage while this one was still
# building (PR 612 vs 613; PR 1354, an empty-diff twin of 1353, harvested 15 min after 1353
# merged). 1353/1354 also used DIFFERENT branch names for one stage (the aif task-id suffix), so
# a `--head <branch>` probe misses it by construction. `--late` is run right before `gh pr
# create`, harvest, merge, or offering a chip (CLAUDE.md «Pre-dispatch in-flight probe» (f)),
# and by .claude/hooks/late-inflight-probe.sh.
#
#   probe-inflight.sh --late          branch mode — this checkout is about to leave the machine
#   probe-inflight.sh --late --chip   chip mode   — only PR titles against PROBE_LATE_TERMS
#
# Signals (branch mode):
#   late-slug          SLUG, else derived from the current branch: its last path part, minus a
#                      trailing -<6 hex> aif task-id suffix (only when the suffix holds a digit —
#                      `facade` is a word). A Claude Code worktree branch (`claude/<adjective>-
#                      <name>-<hex>`, `worktree-*`) names no umbrella, so it yields none; <6 chars
#                      => none. Chip mode never derives one.
#   late-pr            STRONG — open PRs, and PRs merged within PROBE_LATE_MERGED_HOURS
#                      (default 72), whose title or head branch contains the slug as a WHOLE token
#                      (bounded by non-alphanumerics, case-insensitive): `…-s1` never matches the
#                      sibling stage `…-s1b` or `…-s10`.
#   late-staging       STRONG — commits on PROBE_BASE_REF (default origin/staging) that
#                      PROBE_LATE_FROM (default HEAD) lacks, whose subject contains the slug as a
#                      whole token (after `git fetch`). On a host harvest, HEAD is not the aif
#                      branch: pass PROBE_LATE_FROM=<the task's dispatch base SHA>.
#   late-term-pr       WEAK — open/recent-merged PRs whose title shares >= min(2, n) topic words
#                      with PROBE_LATE_TERMS (a PR or chip title): 4+ chars, plural `s` stripped,
#                      then stopwords and conventional-commit types (feat, docs, …) dropped.
#   late-file-overlap  WEAK — open PRs changing a file this checkout changes (vs merge-base).
# The session's own PR is never its own collision: PROBE_SELF_BRANCH (default: current branch)
# and PROBE_SELF_PR are excluded from every PR signal.
#
# Verdict precedence: LATE-COLLISION (a strong hit — found evidence outranks unasked signals)
# > PROBE-INCOMPLETE (a question that could not be asked) > LATE-OVERLAP (weak hit only)
# > LATE-PARTIAL (branch mode with no slug: the strong questions had no subject, the weak ones
# came back clean — never rendered as CLEAR) > LATE-CLEAR. Weak evidence never reads as a
# collision: shared files like CLAUDE.md and shared title words are context for a judgment, not
# proof of a duplicate.
#
# Fixture overrides (no gh / git / network): PROBE_LATE_OPEN_PRS (JSON array of
# {number,state,title,headRefName,files:[{path}]}), PROBE_LATE_MERGED_PRS (JSON array of
# {number,state,title,headRefName,mergedAt}), PROBE_LATE_STAGING_LOG ("<sha> <subject>" lines of
# FROM..base, unfiltered), PROBE_LATE_CHANGED_FILES (paths), PROBE_SELF_BRANCH, PROBE_NOW_EPOCH.
late_probe() {
  local chip="$1" now base from merged_hours self_branch self_pr slug slug_source slug_re
  now="${PROBE_NOW_EPOCH:-$(date +%s)}"
  base="${PROBE_BASE_REF:-origin/staging}"
  from="${PROBE_LATE_FROM:-HEAD}"
  merged_hours="${PROBE_LATE_MERGED_HOURS:-72}"
  [[ "$merged_hours" =~ ^[0-9]+$ ]] || merged_hours=72
  if [[ -n "${PROBE_SELF_BRANCH+x}" ]]; then
    self_branch="$PROBE_SELF_BRANCH"
  else
    self_branch=$(git branch --show-current 2>/dev/null || true)
  fi
  self_pr="${PROBE_SELF_PR:-}"

  if [[ "$chip" == "1" ]]; then
    slug="${SLUG:-}"
    slug_source="env"
    [[ -z "$slug" ]] && slug_source="chip"
  elif [[ -n "${SLUG:-}" ]]; then
    slug="$SLUG"
    slug_source="env"
  else
    slug_source="branch"
    case "$self_branch" in
      claude/* | worktree-*) slug="" ;;
      *)
        slug="${self_branch##*/}"
        if [[ "$slug" =~ -([0-9a-f]{6})$ ]] && [[ "${BASH_REMATCH[1]}" =~ [0-9] ]]; then
          slug="${slug%-*}"
        fi
        [[ ${#slug} -lt 6 ]] && slug=""
        ;;
    esac
  fi
  echo "SIGNAL late-slug ${slug:-none} source=${slug_source}"
  # Whole-token pattern, shared by jq (Oniguruma) and grep -E: every char outside [a-z0-9_-]
  # is escaped, so a `.` in a slug stays literal.
  slug_re=""
  if [[ -n "$slug" ]]; then
    slug_re="(^|[^a-z0-9])$(printf '%s' "$slug" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9_-]/\\&/g')(\$|[^a-z0-9])"
  fi

  # ── PR lists (open with files; merged, recent) ──
  local open_json merged_json open_status="ok" pr_status="ok"
  if [[ -n "${PROBE_LATE_OPEN_PRS+x}" ]]; then
    open_json="$PROBE_LATE_OPEN_PRS"
  elif command -v gh &>/dev/null; then
    open_json=$(gh pr list --state open --limit 100 --json number,state,title,headRefName,files 2>/dev/null || echo 'unavailable')
  else
    open_json='unavailable'
  fi
  if [[ -n "${PROBE_LATE_MERGED_PRS+x}" ]]; then
    merged_json="$PROBE_LATE_MERGED_PRS"
  elif command -v gh &>/dev/null; then
    merged_json=$(gh pr list --state merged --limit 60 --json number,state,title,headRefName,mergedAt 2>/dev/null || echo 'unavailable')
  else
    merged_json='unavailable'
  fi
  printf '%s' "$open_json" | jq -e 'type == "array"' &>/dev/null || { open_json='[]'; open_status="unavailable"; pr_status="unavailable"; }
  printf '%s' "$merged_json" | jq -e 'type == "array"' &>/dev/null || { merged_json='[]'; pr_status="unavailable"; }
  # An unparseable clock would filter every merged PR out silently — that is an unasked question.
  [[ "$now" =~ ^[0-9]+$ ]] || { now=0; pr_status="unavailable"; }

  # One candidate list: open PRs + merged PRs inside the window, minus this session's own PR.
  # A jq failure here is an unasked question too, never an empty answer.
  local candidates
  if ! candidates=$(printf '%s\n%s' "$open_json" "$merged_json" | jq -cs \
    --arg self "$self_branch" --arg selfpr "$self_pr" --arg now "$now" --arg hours "$merged_hours" '
    (.[0] // []) as $open | (.[1] // []) as $merged
    | ($now | tonumber) as $n | ($hours | tonumber) as $h
    | [ $open[], ($merged[] | select(
          (try ((.mergedAt // "") | sub("\\.[0-9]+Z$"; "Z") | fromdateiso8601) catch null) as $m
          | $m != null and ($n - $m) <= ($h * 3600))) ]
    | map(select((.headRefName // "") != $self or $self == ""))
    | map(select(($selfpr == "") or ((.number | tostring) != $selfpr)))' 2>/dev/null); then
    candidates='[]'
    pr_status="unavailable"
  fi

  # ── STRONG: slug in PR title/head ──
  local slug_hits="" slug_count=0 slug_open=0 slug_merged=0 slug_note=""
  if [[ -n "$slug_re" ]]; then
    if ! slug_hits=$(printf '%s' "$candidates" | jq -r --arg re "$slug_re" '
      .[] | select(((.title // "") | test($re; "i")) or ((.headRefName // "") | test($re; "i")))
      | "#\(.number) \(.state) \(.headRefName) \((.title // "") | gsub("[\r\n]+"; " "))"' 2>/dev/null); then
      slug_hits=""
      pr_status="unavailable"
    fi
    slug_count=$(printf '%s' "$slug_hits" | grep -c . || true)
    slug_open=$(printf '%s' "$slug_hits" | awk '$2 == "OPEN"' | grep -c . || true)
    slug_merged=$((slug_count - slug_open))
  else
    slug_note=" reason=no-slug"
  fi
  echo "SIGNAL late-pr ${slug_count} open=${slug_open} merged=${slug_merged} status=${pr_status}${slug_note}"
  [[ "$slug_count" -gt 0 ]] && { printf '%s\n' "$slug_hits" | grep . | sed 's/^/  late-pr: /' || true; }

  # ── STRONG: slug in staging commits FROM lacks ──
  local staging_status="ok" staging_reason="" staging_log="" staging_hits="" staging_count=0
  if [[ "$chip" == "1" ]]; then
    staging_status="skipped"; staging_reason="chip"
  elif [[ -z "$slug_re" ]]; then
    staging_status="skipped"; staging_reason="no-slug"
  elif [[ -n "${PROBE_LATE_STAGING_LOG+x}" ]]; then
    staging_log="$PROBE_LATE_STAGING_LOG"
  elif git fetch -q origin "${base#origin/}" 2>/dev/null \
    && staging_log=$(git log --format='%h %s' "${from}..${base}" 2>/dev/null); then
    :
  else
    staging_status="unavailable"; staging_reason="fetch-or-log-failed"
  fi
  if [[ "$staging_status" == "ok" ]]; then
    staging_hits=$(printf '%s\n' "$staging_log" | grep -iE -- "$slug_re" || true)
    staging_count=$(printf '%s' "$staging_hits" | grep -c . || true)
    staging_reason=""
  fi
  if [[ "$staging_status" == "ok" ]]; then
    echo "SIGNAL late-staging ${staging_count} status=ok from=${from}"
  else
    echo "SIGNAL late-staging ${staging_count} status=${staging_status} reason=${staging_reason}"
  fi
  [[ "$staging_count" -gt 0 ]] && { printf '%s\n' "$staging_hits" | grep . | sed 's/^/  late-staging: /' || true; }

  # ── WEAK: shared title words ──
  local term_hits="" term_count=0 term_status="ok"
  if [[ -z "${PROBE_LATE_TERMS:-}" ]]; then
    term_status="skipped"
  else
    if ! term_hits=$(printf '%s' "$candidates" | jq -r --arg terms "$PROBE_LATE_TERMS" '
      def words: ascii_downcase | [scan("[a-z0-9]+")] | map(select(length >= 4))
        | map(if length > 4 and endswith("s") then .[:-1] else . end)
        | map(select(. as $w | ["with","from","into","that","this","when","only","than","then",
            "them","they","what","which","make","made","does","done","stop","fixe","also","more",
            "before","after","every","each","same","over","under","feat","docs","chore","test",
            "perf","build","style","revert","refactor"] | index($w) | not))
        | unique;
      ($terms | words) as $t | ([($t | length), 2] | min) as $need
      | .[] | ((.title // "") | words) as $w
      | ([$t[] | select(. as $x | $w | index($x))] | length) as $hits
      | select($need > 0 and $hits >= $need)
      | "#\(.number) \(.state) hits=\($hits) \((.title // "") | gsub("[\r\n]+"; " "))"' 2>/dev/null); then
      term_hits=""
      term_status="unavailable"
    fi
    term_count=$(printf '%s' "$term_hits" | grep -c . || true)
    [[ "$pr_status" != "ok" ]] && term_status="unavailable"
  fi
  echo "SIGNAL late-term-pr ${term_count} status=${term_status}"
  [[ "$term_count" -gt 0 ]] && { printf '%s\n' "$term_hits" | grep . | sed 's/^/  late-term-pr: /' || true; }

  # ── WEAK: open PRs changing the same files (needs only the open list) ──
  local changed="" overlap_hits="" overlap_count=0 overlap_status="ok" overlap_reason=""
  if [[ "$chip" == "1" ]]; then
    overlap_status="skipped"; overlap_reason="chip"
  elif [[ -n "${PROBE_LATE_CHANGED_FILES+x}" ]]; then
    changed="$PROBE_LATE_CHANGED_FILES"
  else
    local mb
    if mb=$(git merge-base HEAD "$base" 2>/dev/null); then
      changed=$(git diff --name-only "$mb" 2>/dev/null || true)
    else
      overlap_status="unavailable"; overlap_reason="no-merge-base"
    fi
  fi
  if [[ "$overlap_status" == "ok" ]]; then
    [[ "$open_status" != "ok" ]] && { overlap_status="unavailable"; overlap_reason="open-pr-list"; }
    if ! overlap_hits=$(printf '%s' "$open_json" | jq -r --arg changed "$changed" --arg self "$self_branch" --arg selfpr "$self_pr" '
      ($changed | split("\n") | map(select(length > 0))) as $mine
      | .[] | select((.headRefName // "") != $self or $self == "")
      | select(($selfpr == "") or ((.number | tostring) != $selfpr))
      | ([(.files // [])[] | .path] | map(select(. as $p | $mine | index($p)))) as $shared
      | select(($shared | length) > 0)
      | "#\(.number) \(.headRefName) files=\($shared[0:5] | join(","))\(if ($shared | length) > 5 then ",+\(($shared | length) - 5)" else "" end)"' 2>/dev/null); then
      overlap_hits=""
      overlap_status="unavailable"; overlap_reason="jq"
    fi
    overlap_count=$(printf '%s' "$overlap_hits" | grep -c . || true)
  fi
  echo "SIGNAL late-file-overlap ${overlap_count} status=${overlap_status}${overlap_reason:+ reason=${overlap_reason}}"
  [[ "$overlap_count" -gt 0 ]] && { printf '%s\n' "$overlap_hits" | grep . | sed 's/^/  late-file-overlap: /' || true; }

  if [[ "$slug_count" -gt 0 || "$staging_count" -gt 0 ]]; then
    echo "VERDICT: LATE-COLLISION"
  elif [[ "$pr_status" != "ok" || "$staging_status" == "unavailable" || "$overlap_status" == "unavailable" || "$term_status" == "unavailable" ]]; then
    echo "VERDICT: PROBE-INCOMPLETE"
  elif [[ "$term_count" -gt 0 || "$overlap_count" -gt 0 ]]; then
    echo "VERDICT: LATE-OVERLAP"
  elif [[ "$chip" != "1" && -z "$slug" ]]; then
    echo "VERDICT: LATE-PARTIAL"
  else
    echo "VERDICT: LATE-CLEAR"
  fi
}

if [[ "${1:-}" == "--late" ]]; then
  late_chip=0
  [[ "${2:-}" == "--chip" ]] && late_chip=1
  late_probe "$late_chip"
  exit 0
fi

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

# ── Container checkout resolution (issue 1439, layer 1) ───────────────────────
# The repository Signal 4 asks is RESOLVED, never assumed: explicit AIF_REPO_PATH
# wins; otherwise the aif PROJECT record for THIS probe's project
# (RUNTIME_BRIDGE_AIF_PROJECT_ID → GET /projects → rootPath, per
# kickoff-l3.decisions.md#decision-1). Every non-derivable outcome keeps a NAMED
# reason and never falls back to some other project's checkout: a probe answering
# `ok` from the wrong repository is the defect this resolution exists to close.
#
# Precedence: when PROBE_CONTAINER_BRANCHES is set (the injected fixture path),
# container_status comes from PROBE_CONTAINER_STATUS exactly as before and the
# derived path is reported in `repo=` for visibility only — it never flips status.
# The network curl is skipped on that injected path; when PROBE_PROJECTS carries the
# fixture, the derivation still runs from it.
repo_path=""
repo_reason=""
if [[ -n "$AIF_REPO_PATH" ]]; then
  repo_path="$AIF_REPO_PATH"
elif [[ -z "${RUNTIME_BRIDGE_AIF_PROJECT_ID:-}" ]]; then
  repo_reason="no-project-id"
else
  if [[ -n "${PROBE_PROJECTS+x}" ]]; then
    projects_json="$PROBE_PROJECTS"
  elif [[ -n "${PROBE_CONTAINER_BRANCHES+x}" ]]; then
    projects_json="" # injected container status — the network call is skipped
  else
    projects_json=$(curl -s --max-time 10 "http://${AIF_HOST}:${AIF_PORT}/projects" 2>/dev/null || true)
  fi
  if [[ -n "$projects_json" ]] && printf '%s' "$projects_json" | jq -e 'type == "array"' &>/dev/null; then
    repo_path=$(printf '%s' "$projects_json" | jq -r --arg id "$RUNTIME_BRIDGE_AIF_PROJECT_ID" '
      [.[] | select(.id == $id)][0].rootPath // empty' 2>/dev/null || true)
    if [[ -z "$repo_path" ]]; then
      matching_count=$(printf '%s' "$projects_json" | jq --arg id "$RUNTIME_BRIDGE_AIF_PROJECT_ID" \
        '[.[] | select(.id == $id)] | length' 2>/dev/null || echo 0)
      if [[ "$matching_count" -gt 0 ]]; then
        repo_reason="no-rootpath" # the record exists but carries no rootPath
      else
        repo_reason="project-not-found"
      fi
    fi
  elif [[ -z "${PROBE_CONTAINER_BRANCHES+x}" ]]; then
    repo_reason="projects-api-unreachable" # live fetch failed or returned non-JSON
  fi
fi

# ── Agent container discovery (used by Signal 4 on the live path only) ─────────
# The lookup itself lives in the aif-doctor helper `aif-agent-target.sh` (shared with
# refresh-aif-base.sh, heal.sh, the runtime-bridge scripts and harvest). Its rules: a
# candidate is used only when it is the ONLY one — two or more => ambiguous, fail closed,
# nothing is asked; the guard never answers from a guessed stack. No candidate => the
# historical default name is asked so the exec's own stderr names the cause. dispatcher
# and aif-doctor ship in the same tier (setup.d/lib.sh GETFF_SKILLS_FACTORY); if the helper
# is absent anyway, the probe asks the default name, as it did before discovery existed.
AIF_AGENT_TARGET="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../../aif-doctor/helpers/aif-agent-target.sh"
container_target_note=""
discover_reason=""
discover_agent_container() {
  [[ -n "$AIF_CONTAINER" ]] && return 0
  if [[ ! -f "$AIF_AGENT_TARGET" ]]; then
    AIF_CONTAINER="$AIF_CONTAINER_DEFAULT"
    container_target_note="${AIF_CONTAINER_DEFAULT} (default; aif-doctor/helpers/aif-agent-target.sh not installed)"
    return 0
  fi
  # shellcheck disable=SC1090,SC1091  # resolved at runtime from this file's own directory
  . "$AIF_AGENT_TARGET"
  local rc=0
  AIF_AGENT_DOCKER="$PROBE_DOCKER_BIN" AIF_AGENT_TIMEOUT_S="$CONTEXT_TIMEOUT_S" aif_agent_resolve || rc=$?
  case "$rc" in
    0)
      AIF_CONTAINER="$AIF_AGENT_NAME"
      [[ -n "$AIF_AGENT_CONTEXT" ]] && export DOCKER_CONTEXT="$AIF_AGENT_CONTEXT"
      container_target_note="$AIF_AGENT_NOTE"
      ;;
    1)
      case "$AIF_AGENT_REASON" in
        *'across docker contexts') discover_reason="${AIF_AGENT_REASON} — set AIF_CONTAINER and DOCKER_CONTEXT" ;;
        *) discover_reason="${AIF_AGENT_REASON} — set AIF_CONTAINER" ;;
      esac
      return 1
      ;;
    *)
      AIF_CONTAINER="$AIF_CONTAINER_DEFAULT"
      container_target_note="${AIF_CONTAINER_DEFAULT} (default; ${AIF_AGENT_REASON})"
      ;;
  esac
}

# ── Signal 4: CONTAINER branches — the blind spot this helper exists to close ──
# A container-only branch is work that origin cannot see. Distinguishing "the
# container has nothing" from "we never asked the container" is the whole point:
# the second must not be reported as the first. Layer 2 (issue 1439): when the
# docker/git call itself fails, its stderr is CAPTURED, not discarded — the first
# stderr line names the cause on the signal line and in a `container-cause:` detail
# line. A failed question must carry its cause, never render as a clean answer.
container_status="ok"
container_reason=""
if [[ -n "${PROBE_CONTAINER_BRANCHES+x}" ]]; then
  container_branches="$PROBE_CONTAINER_BRANCHES"
  container_status="${PROBE_CONTAINER_STATUS:-ok}"
else
  if [[ -z "$repo_path" ]]; then
    # Live path with no derivable checkout: the question cannot be asked honestly.
    # Report unavailable with the named cause — never ask a different repository.
    container_branches=""
    container_status="unavailable"
    container_reason="${repo_reason:-no-rootpath}"
  else
    err_file=$(mktemp)
    if ! command -v "$PROBE_DOCKER_BIN" &>/dev/null; then
      container_branches=""
      container_status="unavailable"
      container_reason="docker-not-on-PATH"
    # `-c safe.directory=*` is REQUIRED, not defensive: `docker exec` lands as root by
    # default while the agent checkout is owned by the container's own user, so plain git
    # dies with "detected dubious ownership" and the signal degrades to PROBE-INCOMPLETE —
    # a question the probe COULD ask rendered as one it could not. Read-only and
    # user-agnostic, so it fixes the class without assuming which uid the exec lands as.
    # (Measured 2026-09-08 against the aif stack: every dispatch STOPped on this cause.
    # The pre-existing arm (b) of probe-inflight.test.ts already used this exact stderr
    # as its fixture — the shape was tested, the cause was never fixed.)
    elif ! discover_agent_container; then
      container_branches=""
      container_status="unavailable"
      container_reason="$discover_reason"
    elif ! container_branches=$("$PROBE_DOCKER_BIN" exec "$AIF_CONTAINER" git -c safe.directory='*' -C "$repo_path" branch -a 2>"$err_file"); then
      container_branches=""
      container_status="unavailable"
      container_reason=$(grep -m1 . "$err_file" 2>/dev/null || true)
      [[ -z "$container_reason" ]] && container_reason="git-call-failed"
    fi
    rm -f "$err_file"
  fi
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
    if ! grep -qF -- "$cb" <<<"$origin_branches"; then
      container_only="${container_only}${cb}"$'\n'
    fi
  done <<< "$container_branches"
fi
container_only_count=$(printf '%s' "$container_only" | grep -c . || true)
repo_field=""
[[ -n "$repo_path" ]] && repo_field=" repo=${repo_path}"
if [[ "$container_status" == "unavailable" && -n "$container_reason" ]]; then
  repo_field="${repo_field} reason=${container_reason}"
fi
echo "SIGNAL container-branch ${container_count} only=${container_only_count} status=${container_status}${repo_field}"
if [[ "$container_status" == "unavailable" && -n "$container_reason" ]]; then
  echo "  container-cause: ${container_reason}"
fi
if [[ -n "$container_target_note" ]]; then
  echo "  container-target: ${container_target_note}"
fi
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
