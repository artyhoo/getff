#!/usr/bin/env bash
# ci-capture.sh — capture a value only the CI runner produces, without editing a workflow.
#
# usage: scripts/ci-capture.sh <test-file> <label> <snippet|-> [--base staging]
#          [--workflow audit-self.yml] [--job <name substring>] [--timeout 3600]
#
# The convention (docs/meta-factory/operational-conventions.md §5): audit-self.yml runs on
# `push` to `chore/**`, so a throwaway chore branch with a marker-wrapped print inside a test
# file some job ALREADY runs reaches the exact runner state (the pinned tool on PATH, the env,
# the paths) with no workflow edit and therefore no scope waiver. Precedent: adapter-jig J3,
# capture run 31132752600 → PR #1240. Pick the test file by grepping the workflow for the job
# that runs it, and check the tool's install step precedes it in the SAME job (PATH does not
# cross jobs).
#
# What it does:
#   1. `git fetch origin <base>`; refuse if <test-file> is absent there.
#   2. Temp worktree on a new branch chore/ci-capture-<label>-<pid> from origin/<base> — the
#      caller's checkout is never touched.
#   3. Inject the snippet between `===XCAP <label>===` and `===/XCAP <label>===`:
#        *.ts/*.tsx/*.js/*.mjs/*.cjs/*.mts/*.cts → appended, inside try/catch (a throw prints
#          `XCAP-THREW:` instead of killing the suite before the close marker);
#        *.sh/*.bash → inserted after the shebang, run in a subshell with 2>&1 and followed by
#          `XCAP-RC=<status>` — which stream carries the payload is often the unknown.
#   4. Commit + push (the repo's own hooks run on this push — nothing is bypassed).
#   5. Find the push run of <workflow> for that SHA and poll its jobs. Each completed job
#      (filtered by --job) has its log read through the REST job-logs endpoint, which answers
#      as soon as that JOB is done — `gh run view --job <id> --log` refuses every log until the
#      whole RUN is done («run N is still in progress», gh 2.83.2). A failed read is retried on
#      the next poll. The first log carrying both markers wins.
#   6. Print the lines between the markers on stdout, then cancel every still-running run on
#      the branch and delete the remote branch, the local branch and the temp worktree — on
#      every exit path.
#
# Log parsing: a line may carry the `gh run view --log` prefix `<job>\t<step>\t`, then an
# ISO timestamp; both are stripped, as are CR and ANSI colour. Inside the block
# vitest's console headers (`stdout | <file>`, `stderr | <file>`) and blank lines are dropped —
# vitest writes them around every console chunk, so they are noise, not payload.
#
# Exit: 0 captured · 1 run(s) finished without the markers · 2 usage/setup error ·
#       3 timeout · 4 the remote branch could not be deleted (the payload, if any, was printed).
# Env: CI_CAPTURE_INTERVAL (poll seconds, default 20); CI_CAPTURE_REPO (owner/repo; default:
#      parsed from the `origin` URL — every gh call is pinned to it with -R).
# Tested by scripts/ci-capture.test.sh (real git in mktemp + stubbed gh over real jq).
set -uo pipefail

die() { echo "ci-capture: $*" >&2; exit 2; }
note() { echo "ci-capture: $*" >&2; }

BASE=staging WORKFLOW=audit-self.yml JOB_FILTER="" TIMEOUT=3600
INTERVAL="${CI_CAPTURE_INTERVAL:-20}"
POS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --base|--workflow|--job|--timeout)
      [ $# -ge 2 ] || die "$1 needs a value"
      case "$1" in
        --base) BASE="$2" ;; --workflow) WORKFLOW="$2" ;;
        --job) JOB_FILTER="$2" ;; --timeout) TIMEOUT="$2" ;;
      esac
      shift 2 ;;
    -h|--help) sed -n '2,5p' "$0"; exit 0 ;;
    *) POS+=("$1"); shift ;;
  esac
done
[ "${#POS[@]}" -eq 3 ] || die "usage: ci-capture.sh <test-file> <label> <snippet|-> [--base B] [--workflow W] [--job J] [--timeout S]"
TEST_FILE="${POS[0]}" LABEL="${POS[1]}" SNIPPET="${POS[2]}"
case "$LABEL" in ''|*[!A-Za-z0-9._-]*) die "label must match [A-Za-z0-9._-]+ (it goes into the markers and the branch name)";; esac
case "$TIMEOUT" in ''|*[!0-9]*) die "--timeout must be whole seconds";; esac
case "$INTERVAL" in ''|*[!0-9]*) die "CI_CAPTURE_INTERVAL must be whole seconds";; esac
[ "$SNIPPET" = "-" ] && SNIPPET=$(cat)
[ -n "$SNIPPET" ] || die "empty snippet"
case "$TEST_FILE" in
  *.ts|*.tsx|*.js|*.mjs|*.cjs|*.mts|*.cts) LANG_KIND="js" ;;
  *.sh|*.bash) LANG_KIND="sh" ;;
  *) die "unsupported test file type: $TEST_FILE (js/ts or sh/bash)" ;;
esac

# Own checkout, not the caller's cwd (a script run from another repo must not push there).
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT" || die "cannot enter $ROOT"
# gh must look at the repo `git push origin` reaches — never a guess from other remotes/GH_REPO.
SLUG="${CI_CAPTURE_REPO:-}"
if [ -z "$SLUG" ]; then
  SLUG=$(git remote get-url origin 2>/dev/null | sed -nE 's#^.*github\.com[:/]([^/]+/[^/]+)$#\1#p')
  SLUG="${SLUG%.git}"
fi
case "$SLUG" in */*) ;; *) die "cannot derive owner/repo from origin; set CI_CAPTURE_REPO" ;; esac
git fetch -q origin "$BASE" || die "git fetch origin $BASE failed"
git cat-file -e "origin/$BASE:$TEST_FILE" 2>/dev/null || die "$TEST_FILE does not exist on origin/$BASE"

OPEN="===XCAP $LABEL===" CLOSE="===/XCAP $LABEL==="
BR="chore/ci-capture-$LABEL-$$"
TMPD=$(mktemp -d "${TMPDIR:-/tmp}/ci-capture.XXXXXX") || die "mktemp failed"
WT="$TMPD/wt" LOG="$TMPD/log"
PUSHED=0 SHA=""

cleanup() {
  local rc=$? ids="" id=""
  if [ "$PUSHED" -eq 1 ]; then
    if [ -n "$SHA" ]; then
      ids=$(gh run list -R "$SLUG" --branch "$BR" --commit "$SHA" --json databaseId,status \
              -q '.[] | select(.status != "completed") | .databaseId' 2>/dev/null)
      for id in $ids; do gh run cancel -R "$SLUG" "$id" >/dev/null 2>&1 && note "cancelled run $id"; done
    fi
    # --no-verify: a delete push carries no commits, and pre-push would resolve its range to
    # the zero SHA (packages/core/hooks/pre-push.ts resolveBase) — there is nothing to verify,
    # and a hook failure here would strand the throwaway branch on origin.
    git push -q --no-verify origin --delete "$BR" >/dev/null 2>&1
    if git ls-remote --exit-code origin "refs/heads/$BR" >/dev/null 2>&1; then
      note "remote branch $BR is STILL on origin — delete it: git push --no-verify origin --delete $BR"
      rc=4
    fi
  fi
  git worktree remove --force "$WT" >/dev/null 2>&1
  git branch -D "$BR" >/dev/null 2>&1
  rm -rf "$TMPD"
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

git worktree add -q -b "$BR" "$WT" "origin/$BASE" || die "git worktree add failed"
F="$WT/$TEST_FILE"
BLOCK="$TMPD/block"
if [ "$LANG_KIND" = js ]; then
  { printf '\n// ci-capture %s — throwaway, lives only on a chore/ branch\n' "$LABEL"
    printf 'console.log("%s");\n' "$OPEN"
    printf 'try {\n%s\n} catch (e) { console.log("XCAP-THREW:", e); }\n' "$SNIPPET"
    printf 'console.log("%s");\n' "$CLOSE"; } > "$BLOCK"
  cat "$BLOCK" >> "$F"
else
  { printf '# ci-capture %s — throwaway, lives only on a chore/ branch\n' "$LABEL"
    printf 'echo "%s"\n' "$OPEN"
    printf '(\n%s\n) 2>&1; echo "XCAP-RC=$?"\n' "$SNIPPET"
    printf 'echo "%s"\n' "$CLOSE"; } > "$BLOCK"
  if head -n 1 "$F" | grep '^#!' >/dev/null; then
    { head -n 1 "$F"; cat "$BLOCK"; tail -n +2 "$F"; } > "$TMPD/new"
  else
    { cat "$BLOCK"; cat "$F"; } > "$TMPD/new"
  fi
  cat "$TMPD/new" > "$F"   # cat-over keeps the file mode
fi
git -C "$WT" add -- "$TEST_FILE" || die "git add failed"
git -C "$WT" commit -q -m "chore(ci-capture): $LABEL — throwaway, deleted after capture" || die "git commit failed"
SHA=$(git -C "$WT" rev-parse HEAD)
PUSHED=1   # before the push: an interrupt mid-push may already have created the remote ref
git -C "$WT" push -q origin "$BR" || die "git push origin $BR failed"
note "pushed $BR @ ${SHA:0:12}; waiting for $WORKFLOW on $SLUG"

# extract <log-file> — payload lines between the markers; rc 0 only when both were seen.
extract() {
  awk -v mo="$OPEN" -v mc="$CLOSE" -v esc="$(printf '\033')" '
    { line = $0
      n = index(line, "\t"); if (n) { rest = substr(line, n + 1); m = index(rest, "\t")
        if (m) line = substr(rest, m + 1) }
      sub(/^[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9:.]+Z ?/, "", line)
      sub(/\r$/, "", line); gsub(esc "\\[[0-9;]*m", "", line)
      t = line; gsub(/^[ \t]+|[ \t]+$/, "", t)
      if (!inb && t == mo) { inb = 1; seen = 1; next }
      if (inb && t == mc) { done = 1; exit }
      if (inb && t != "" && t !~ /^(stdout|stderr) \| /) print line }
    END { exit (seen && done) ? 0 : 1 }' "$1"
}

START=$(date +%s) RUN="" SEEN=" "
while :; do
  if [ -z "$RUN" ]; then
    RUN=$(gh run list -R "$SLUG" --branch "$BR" --commit "$SHA" --workflow "$WORKFLOW" --json databaseId -q '.[0].databaseId' 2>/dev/null)
    [ -n "$RUN" ] && note "run $RUN registered"
  fi
  if [ -n "$RUN" ]; then
    STATUS=$(gh run view -R "$SLUG" "$RUN" --json status -q .status 2>/dev/null)
    JOBS=$(gh run view -R "$SLUG" "$RUN" --json jobs -q '.jobs[] | [.databaseId, .status, .name] | @tsv' 2>/dev/null)
    UNREAD=0
    while IFS=$'\t' read -r jid jstatus jname; do
      [ -n "$jid" ] && [ "$jstatus" = completed ] || continue
      case "$SEEN" in *" $jid "*) continue ;; esac
      if [ -n "$JOB_FILTER" ]; then case "$jname" in *"$JOB_FILTER"*) ;; *) continue ;; esac; fi
      if ! gh api "repos/$SLUG/actions/jobs/$jid/logs" > "$LOG" 2>/dev/null || [ ! -s "$LOG" ]; then
        UNREAD=1; continue   # not SEEN: read it again on the next poll
      fi
      SEEN="$SEEN$jid "
      if extract "$LOG" > "$LOG.out"; then
        note "captured from job '$jname' ($jid)"
        cat "$LOG.out"
        exit 0
      fi
    done <<EOF
$JOBS
EOF
    if [ "$STATUS" = completed ] && [ "$UNREAD" -eq 0 ]; then
      note "run $RUN completed; no job${JOB_FILTER:+ matching \"$JOB_FILTER\"} printed $OPEN"
      exit 1
    fi
  fi
  if [ $(( $(date +%s) - START )) -ge "$TIMEOUT" ]; then
    if [ -n "$RUN" ]; then note "timeout after ${TIMEOUT}s; run $RUN has no readable job log with $OPEN yet"
    else note "timeout after ${TIMEOUT}s; no $WORKFLOW run registered for ${SHA:0:12}"; fi
    exit 3
  fi
  sleep "$INTERVAL"
done
