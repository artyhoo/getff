#!/usr/bin/env bash
# ci-success-gate.sh — aggregate pass/fail gate for the `ci-success` job.
#
# Purpose: GitHub branch protection can only require named status-check
# *contexts*, and `needs:` aggregation works only WITHIN one workflow file. This
# script is the body of the `ci-success` job in audit-self.yml; the job passes
# its `${{ join(needs.*.result, ' ') }}` here. It exits 0 iff every job result is
# `success` or `skipped`, else 1.
#
# SCOPE — this script judges the RESULTS it is handed, never the WIRING that
# decides which results it sees. A job absent from `ci-success.needs` is invisible
# here and to branch protection alike: it can go RED while this gate reports green.
# This header previously claimed audit-self.yml "`needs:` every audit-self PR job";
# that was an unverified assertion, and it was false — `shipped-prettier` and
# `framework-fresh-install-validate-multistack` were never wired in from the day
# they shipped (#540, #815) until 2026-08-10. The claim is now a mechanism instead
# of a comment: packages/core/principles/36-ci-needs-completeness.test.ts asserts
# every job defined in audit-self.yml appears in `ci-success.needs` (allowlist:
# `ci-success` itself), and runs at pre-push plus the `principles-meta-tests` job.
# So: a single required context (`ci-success`) gates all of audit-self.yml at once,
# because principle 36 — not this script — keeps that true.
# (actionlint + zizmor were moved into audit-self.yml so they too are `needs:`-ed
# here — a path-filtered required check in another file deadlocks non-workflow
# PRs; see docs/meta-factory/automerge-staging-plan.md §5.)
#
# `skipped` counts as OK: an `if:`-gated job (e.g. pr-commit-trailers on a push
# event) is legitimately skipped, not failed. `failure` and `cancelled` fail the
# gate. Zero args is a misconfiguration (no needs wired) → fail loudly.
#
# PATH SCOPE — `skipped` is OK only when the skip was DECIDED. The install-area jobs
# are `if:`-gated on the `path-scope` job's output (scripts/ci-path-scope.sh), so for
# them a `skipped` result is legitimate only when that output said `false`. When the
# caller sets PATH_SCOPE_INSTALL (the `path-scope` output) and PATH_SCOPED_RESULTS (the
# results of the jobs gated on it), this script also fails when:
#   - PATH_SCOPE_INSTALL is anything but `true` / `false` (the decision is missing — the
#     path-scope job failed, was cancelled, or its output wiring broke), or
#   - PATH_SCOPE_INSTALL is `true` and a gated job was nonetheless `skipped` (an `if:`
#     that no longer reads the decision it claims to), or PATH_SCOPED_RESULTS is empty.
# With PATH_SCOPE_INSTALL unset the check is off (the pre-path-scope contract).
#
# Args: one job-result token per needed job (success | failure | cancelled | skipped).
# Tested by scripts/ci-success-gate.test.sh (paired-negative).
set -uo pipefail

if [ "$#" -eq 0 ]; then
  echo "::error::ci-success-gate: no job results passed — needs: wiring is empty or join() expanded to nothing"
  exit 1
fi

fail=0
for result in "$@"; do
  case "$result" in
    success | skipped) ;;
    *)
      echo "::error::ci-success-gate: a required job concluded '$result' (need success or skipped)"
      fail=1
      ;;
  esac
done

if [ -n "${PATH_SCOPE_INSTALL+x}" ]; then
  case "$PATH_SCOPE_INSTALL" in
    true)
      if [ -z "${PATH_SCOPED_RESULTS:-}" ]; then
        echo "::error::ci-success-gate: PATH_SCOPED_RESULTS is empty — the path-scoped jobs are not wired into this check"
        fail=1
      fi
      for result in ${PATH_SCOPED_RESULTS:-}; do
        if [ "$result" = skipped ]; then
          echo "::error::ci-success-gate: path scope said the install-area jobs must run, but one was skipped"
          fail=1
        fi
      done
      ;;
    false) echo "path scope: install-area jobs skipped by decision (scripts/ci-path-scope.sh)" ;;
    *)
      echo "::error::ci-success-gate: path scope produced no decision ('$PATH_SCOPE_INSTALL') — the path-scope job did not succeed"
      fail=1
      ;;
  esac
fi

if [ "$fail" -eq 0 ]; then
  echo "✅ ci-success: all $# required jobs passed (or were legitimately skipped)"
fi
exit "$fail"
