#!/usr/bin/env bash
#
# ci-available-probe.sh — classify GitHub CI state for a sha/PR, with the
# Actions-quota third state (#1465 part 1).
#
# A CI waiter that only reads red/green misreads a DEAD CI as red: when a
# GitHub Free account exhausts its private-repo Actions minutes pool (2 000
# minutes/month per ACCOUNT, not per repo), every first-party check-run dies
# in ~2 s reporting `failure` with ZERO executed steps, while third-party app
# checks stay green. Environment is not a verdict: this probe classifies that
# state as CI UNAVAILABLE (exit 4), never RED, and fetches the check-run
# annotation to name the true cause.
#
# Usage:
#   scripts/ci-available-probe.sh [sha | PR-number]    # default: HEAD sha
#
# Exit codes:
#   0  GREEN            — every check-run concluded success
#   1  RED              — at least one check-run concluded failure (real)
#   2  PENDING          — checks running/queued, or no check-runs yet (which
#                         is ALSO what a merge-conflict sha looks like —
#                         GitHub runs no pull_request workflow there)
#   3  CANNOT-RUN       — `gh` absent or its API call failed (named in output)
#   4  CI UNAVAILABLE   — the Actions quota/billing signature (see above)
#
# No jq dependency: all JSON extraction goes through `gh api --jq` (gh's
# embedded jq). Degrades explicitly when `gh` is absent — never a hard
# dependency (shipped-axis agnosticism).

set -euo pipefail

PROG=${0##*/}

TARGET=${1:-HEAD}

if ! command -v gh >/dev/null 2>&1; then
  echo "CANNOT-RUN: gh (GitHub CLI) is required by $PROG and was not found on this host" >&2
  echo "install: https://cli.github.com/ (or your package manager)" >&2
  exit 3
fi
if ! command -v git >/dev/null 2>&1; then
  echo "CANNOT-RUN: git is required by $PROG and was not found on this host" >&2
  exit 3
fi

# ── owner/repo from the origin remote (no gh call — P2 shim only does `api`) ──

REMOTE_URL=$(git remote get-url origin 2>/dev/null || true)
if [ -z "$REMOTE_URL" ]; then
  echo "CANNOT-RUN: no 'origin' remote — cannot determine owner/repo" >&2
  exit 3
fi
OWNER_REPO=$(printf '%s\n' "$REMOTE_URL" \
  | sed -e 's#^git@github.com:##' -e 's#^ssh://git@github.com/##' -e 's#^https://github.com/##' -e 's#^http://github.com/##' -e 's#\.git$##')
case "$OWNER_REPO" in
  */*) : ;;
  *)
    echo "CANNOT-RUN: cannot parse owner/repo from origin URL: $REMOTE_URL" >&2
    exit 3
    ;;
esac

# ── resolve target -> sha (PR number -> head sha via one api call) ──

case "$TARGET" in
  ''|HEAD)
    if ! SHA=$(git rev-parse --verify HEAD 2>/dev/null); then
      echo "CANNOT-RUN: HEAD does not resolve in this repository" >&2
      exit 3
    fi
    ;;
  *[!0-9]*)
    # a sha-ish ref
    if ! SHA=$(git rev-parse --verify "$TARGET" 2>/dev/null); then
      echo "CANNOT-RUN: ref '$TARGET' does not resolve locally (a full sha works without local refs)" >&2
      exit 3
    fi
    ;;
  *)
    # a PR number: head sha from the PR
    if ! SHA=$(gh api "repos/$OWNER_REPO/pulls/$TARGET" --jq '.head.sha' 2>/dev/null); then
      echo "CANNOT-RUN: gh api failed for repos/$OWNER_REPO/pulls/$TARGET (auth? network?)" >&2
      exit 3
    fi
    ;;
esac

# ── fetch check-runs (TSV: id, name, status, conclusion, app-id) ──
# app.id 15368 == GitHub Actions (first-party); anything else is a third-party
# app check whose green does not speak for Actions.

# --paginate is LOAD-BEARING, not tidiness (ledger A8-1 sweep, 2026-09-05). The
# check-runs endpoint returns only the FIRST 30 runs without it — measured on this repo,
# 30 of total_count 47 — so a probe that omits it can report GREEN while a FAILURE sits
# on page 2. That is the exact false-GREEN class this whole verdict script exists to
# prevent, in the script itself.
if ! CHECKS_TSV=$(gh api "repos/$OWNER_REPO/commits/$SHA/check-runs" --paginate \
    --jq '.check_runs[] | [.id, .name, .status, (.conclusion // "none"), (.app.id // 0)] | @tsv' 2>/dev/null); then
  echo "CANNOT-RUN: gh api failed for check-runs of $SHA (auth? network? rate limit?)" >&2
  exit 3
fi

# Reconcile what we READ against what GitHub SAYS exists. --paginate alone is a promise;
# this is the check that the promise held. A pagination that stops early (rate limit
# mid-walk, a transport hiccup) otherwise degrades silently into the very defect above —
# fewer runs seen, all of them green, verdict GREEN. Fail-closed: an unverifiable read is
# CANNOT-RUN, never a verdict. total_count comes from an UNPAGINATED call on purpose: the
# first page carries the true total, and --paginate would print one total per page.
CHECKS_TOTAL=$(gh api "repos/$OWNER_REPO/commits/$SHA/check-runs" --jq '.total_count' 2>/dev/null || true)
CHECKS_SEEN=$(printf '%s' "$CHECKS_TSV" | grep -c . || true)
CHECKS_SEEN=${CHECKS_SEEN:-0}
case "$CHECKS_TOTAL" in
  ''|*[!0-9]*)
    echo "CANNOT-RUN: could not read total_count for check-runs of $SHA — cannot prove the read was complete" >&2
    exit 3
    ;;
esac
if [ "$CHECKS_SEEN" -lt "$CHECKS_TOTAL" ]; then
  echo "CANNOT-RUN: truncated check-runs read for $SHA — saw $CHECKS_SEEN of total_count $CHECKS_TOTAL" >&2
  echo "A verdict on a partial list can report GREEN while a failure sits on an unread page." >&2
  exit 3
fi

if [ -z "$CHECKS_TSV" ]; then
  echo "PENDING: no check-runs found for $SHA"
  echo "Either CI has not started yet, or this sha is in a state GitHub runs no workflow for"
  echo "(a MERGE CONFLICT looks exactly like this — the pre-merge carrier exits 2 there)."
  exit 2
fi

FIRSTPARTY_TOTAL=0
FIRSTPARTY_FAILED=0
FIRSTPARTY_SUCCESS=0
ANY_PENDING=0
THIRDPARTY_TOTAL=0
THIRDPARTY_NONGREEN=0
FAILED_IDS=
# shellcheck disable=SC2086  # word-split over the id list is intentional
while IFS=$'\t' read -r cid cname cstatus cconc capp; do
  [ -n "${cid:-}" ] || continue
  if [ "$cstatus" != "completed" ]; then
    ANY_PENDING=1
    continue
  fi
  if [ "$capp" = "15368" ]; then
    FIRSTPARTY_TOTAL=$((FIRSTPARTY_TOTAL + 1))
    case "$cconc" in
      failure) FIRSTPARTY_FAILED=$((FIRSTPARTY_FAILED + 1)); FAILED_IDS="$FAILED_IDS $cid" ;;
      success) FIRSTPARTY_SUCCESS=$((FIRSTPARTY_SUCCESS + 1)) ;;
      *) : ;; # skipped/cancelled/neutral: neither green nor red
    esac
  else
    THIRDPARTY_TOTAL=$((THIRDPARTY_TOTAL + 1))
    [ "$cconc" = "success" ] || THIRDPARTY_NONGREEN=$((THIRDPARTY_NONGREEN + 1))
  fi
done <<EOF
$CHECKS_TSV
EOF

if [ "$ANY_PENDING" -eq 1 ]; then
  echo "PENDING: check-runs still running or queued for $SHA"
  exit 2
fi

# ── the CI-UNAVAILABLE signature (#1465): every first-party check failed with
# zero executed steps and sub-5s duration, third-party checks green ──

if [ "$FIRSTPARTY_TOTAL" -gt 0 ] && [ "$FIRSTPARTY_FAILED" -eq "$FIRSTPARTY_TOTAL" ] \
   && [ "$THIRDPARTY_NONGREEN" -eq 0 ]; then
  SIGNATURE_OK=1
  for cid in $FAILED_IDS; do
    DETAIL=$(gh api "repos/$OWNER_REPO/check-runs/$cid" \
      --jq '[(.steps // [] | length), ((.completed_at|fromdate) - (.started_at|fromdate))]' 2>/dev/null || echo "x")
    STEPS_N=$(printf '%s' "$DETAIL" | cut -d, -f1 | tr -d '[]" ')
    DUR_S=$(printf '%s' "$DETAIL" | cut -d, -f2 | tr -d '[]" ')
    if [ "$STEPS_N" != "0" ] || [ "${DUR_S:-99}" -ge 5 ]; then
      SIGNATURE_OK=0
      break
    fi
  done
  if [ "$SIGNATURE_OK" = "1" ]; then
    echo "CI UNAVAILABLE (Actions quota/billing): every first-party check-run for $SHA concluded failure"
    echo "with ZERO executed steps in under 5s, while third-party checks stay green — this is not a gate red."
    FIRST_CID=$(printf '%s' "$FAILED_IDS" | awk '{print $1}')
    ANNOTATION=$(gh api "repos/$OWNER_REPO/check-runs/${FIRST_CID}/annotations" --jq '.[0].message' 2>/dev/null || true)
    if [ -n "$ANNOTATION" ]; then
      echo "true cause (check-run annotation): $ANNOTATION"
    else
      echo "true cause: the runner never started a job — on GitHub Free private repos this is the"
      echo "2 000 Actions minutes/month pool shared per ACCOUNT being exhausted (public repos are unlimited)."
    fi
    exit 4
  fi
fi

# ── plain verdicts ──

if [ "$FIRSTPARTY_FAILED" -gt 0 ]; then
  echo "RED: $FIRSTPARTY_FAILED of $FIRSTPARTY_TOTAL first-party check-run(s) concluded failure for $SHA"
  exit 1
fi
if [ "$THIRDPARTY_NONGREEN" -gt 0 ] && [ "$FIRSTPARTY_TOTAL" -eq 0 ]; then
  echo "RED: third-party check(s) non-green and no first-party runs for $SHA"
  exit 1
fi
echo "GREEN: all check-runs concluded success for $SHA ($FIRSTPARTY_SUCCESS first-party, $THIRDPARTY_TOTAL third-party)"
exit 0
