#!/usr/bin/env bash
#
# pre-merge-local.sh — opt-in local pre-merge carrier (B1: npm/ts-server lane).
#
# Reproduces what GitHub Actions actually tests on a PR — refs/pull/N/merge, the
# BASE MERGED INTO THE HEAD — in a throwaway worktree, then runs the consumer's
# own wired validate there. The verified sha is the MERGE RESULT, never the head
# alone (defect class getff#1466). CI remains the unbypassable backstop: this is
# an inner-loop gate, opt-in by running it.
#
# Usage:
#   scripts/pre-merge-local.sh [base-ref]     # base defaults to origin/main
#
# Exit codes (verdict contract, design spec §a.3):
#   0   PASS         — every derived gate reported and passed, on the merge result
#   1   FAIL         — a gate went red on the merge result
#   2   MERGE CONFLICT — distinct outcome (not a gate failure). In this state
#                       GitHub runs no pull_request workflow AT ALL — a waiter
#                       sees bogus green.
#   3   CANNOT-RUN   — a required tool/pin is absent on this host (named in output)
#   90  VACUITY      — the aggregate exited 0/failed but a declared gate never
#                       reported in the log (silent skip = no evidence)
# Outside the verdict contract (no verdict block, no ledger line):
#   64  usage / unresolvable ref (head or base could not be resolved)
#   75  lock contention (another carrier run is in progress for this clone)
#
# Every terminal verdict (0/1/2/3/90) prints the three-sha block — head, base,
# merge — the NOT COVERED list, and appends one NDJSON line to
#   $(git rev-parse --git-path getff/pre-merge-runs.ndjson)
# (per-clone, never committed, worktree-safe via --git-path). On FAIL,
# failed_gates names the gates that STARTED (npm-run-all2 --parallel stops the
# set on first failure, so the failing gate is among the started set).
#
# B1 lane scope: the npm/ts-server lane — the gate set is DERIVED at run time
# from the consumer's own wired surface (package.json "scripts.validate",
# wired by the installer's setup.d/70-deps.sh), never restated here. python /
# go / cargo / UI-preset lane runners land in B2; a merge tree without a wired
# npm validate is CANNOT-RUN (named), never a silent subset.
#
# Preflight: `git fetch origin` for base freshness (WARN + proceed when offline
# or no origin — an inner-loop gate must not hard-require the network).
#
# Caveat (npm ci side effect): `npm ci` runs the package's `prepare` script; on
# consumers wired with husky that sets core.hooksPath to the value the consumer
# already has — idempotent in practice, noted here for transparency.
#
# Reference mechanism adapted (not vendored): artyhoo/timeliner PR 229,
# prior-art-evaluations.md #263 (ADAPT). F2 semantics ratified 2026-08-18:
# head already contains base -> proceed, report merge = head.

set -euo pipefail

PROG=${0##*/}

die_usage() {
  echo "usage: $PROG [base-ref]    (base defaults to origin/main)" >&2
  exit 64
}

# ── preflight: resolve refs or die (exit 64 — before any verdict exists) ──

BASE_REF=${1:-origin/main}

if ! command -v git >/dev/null 2>&1; then
  echo "CANNOT-RUN: git is required and was not found on this host" >&2
  exit 3
fi

HEAD_SHA=$(git rev-parse --verify HEAD 2>/dev/null) || die_usage
if ! BASE_SHA=$(git rev-parse --verify "${BASE_REF}^{commit}" 2>/dev/null); then
  echo "error: base ref '$BASE_REF' does not resolve to a commit in this repository" >&2
  die_usage
fi

# All git-dir paths are absolutized once here: later stages cd into the
# throwaway worktree, where a relative ".git/..." no longer resolves (in a
# linked worktree .git is a FILE pointing at the real git dir).
TOPLEVEL=$(git rev-parse --show-toplevel)
cd "$TOPLEVEL"
GIT_DIR_REL=$(git rev-parse --git-path getff)
case "$GIT_DIR_REL" in
  /*) GIT_DIR_PATH=$GIT_DIR_REL ;;
  *) GIT_DIR_PATH="$(pwd)/$GIT_DIR_REL" ;;
esac

REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "none")

# Base freshness: fetch when an origin exists; offline/no-origin degrades to a
# named warning, never a hard network dependency (shipped-axis agnosticism).
if [ "$REMOTE_URL" != "none" ]; then
  if ! git fetch origin >/dev/null 2>&1; then
    echo "WARN: git fetch origin failed (offline?) — base freshness not verified; using local '$BASE_REF' at $BASE_SHA"
  fi
else
  echo "WARN: no 'origin' remote — base freshness not verifiable; using local '$BASE_REF' at $BASE_SHA"
fi

START_SECS=$SECONDS

# ── atomic mkdir lock via git rev-parse --git-path (never hand-built .git/) ──

mkdir -p "$GIT_DIR_PATH"   # parent creation is idempotent; the LOCK mkdir below is the atomic step
LOCK_DIR="$GIT_DIR_PATH/pre-merge-carrier.lock"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "CANNOT-RUN: another pre-merge carrier run appears to be in progress" >&2
  echo "(stale lock? remove: $LOCK_DIR)" >&2
  exit 75
fi

LOGS_DIR="$GIT_DIR_PATH/pre-merge-logs"
mkdir -p "$LOGS_DIR"

WORKTREE_DIR=
# shellcheck disable=SC2329  # invoked indirectly: `trap cleanup EXIT` below
cleanup() {
  # Run from the main toplevel (cwd may be inside the worktree we remove).
  cd "$TOPLEVEL" 2>/dev/null || true
  if [ -n "$WORKTREE_DIR" ] && [ -d "$WORKTREE_DIR" ]; then
    git worktree remove --force "$WORKTREE_DIR" >/dev/null 2>&1 || rm -rf "$WORKTREE_DIR"
  fi
  git worktree prune >/dev/null 2>&1 || true
  rmdir "$LOCK_DIR" 2>/dev/null || true
}
trap cleanup EXIT

# ledger_append <verdict> <merge-display> <failed_gates_json>
ledger_append() {
  _verdict=$1
  _merge_disp=$2
  _failed=$3
  _dur=$((SECONDS - START_SECS))
  _ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  # shellcheck disable=SC1003  # literal set for tr -d: strips double quotes and backslashes from the URL; no quote-escaping intended
  _remote_clean=$(printf '%s' "$REMOTE_URL" | tr -d '"\\')
  printf '{"ts":"%s","remote":"%s","head":"%s","base":"%s","merge":"%s","verdict":"%s","failed_gates":%s,"duration_s":%d}\n' \
    "$_ts" "$_remote_clean" "$HEAD_SHA" "$BASE_SHA" "$_merge_disp" "$_verdict" "$_failed" "$_dur" \
    >> "$GIT_DIR_PATH/pre-merge-runs.ndjson"
}

# verdict_block <verdict-line> <merge-display>
# Prints the contract block: three shas (W-1/T-PMC-B) + NOT COVERED list (§e.2).
verdict_block() {
  _line=$1
  _merge_disp=$2
  echo ""
  echo "=== $PROG: $_line ==="
  echo "head:   $HEAD_SHA"
  echo "base:   $BASE_SHA  ($BASE_REF)"
  echo "merge:  $_merge_disp"
  echo "NOT COVERED (CI legs not reproduced locally):"
  echo "  - security job: npm audit + gitleaks"
  echo "  - codecov upload (reporting service)"
  echo "  - mutation (PR-only job; not in ci-success.needs)"
}

# pr_body_block <verdict-word>  — §e.4 copy-paste citation, labelled local run
pr_body_block() {
  _v=$1
  _hm=$(printf '%.11s' "$HEAD_SHA")
  _bm=$(printf '%.11s' "$BASE_SHA")
  _mm=$(printf '%.11s' "$MERGE_DISPLAY")
  echo "--- copy-paste into the PR body ---"
  echo "Local pre-merge run: $_v (merge ${_mm}; base ${_bm} -> head ${_hm})"
  echo "Verified the merge result, not the head. LOCAL run — weaker evidence than CI."
  echo "----------------------------------"
}

# ── merge-result construction: throwaway worktree + real merge (§a.1) ──

WORKTREE_PARENT="$GIT_DIR_PATH/pre-merge-worktrees"
mkdir -p "$WORKTREE_PARENT"
WORKTREE_DIR="$WORKTREE_PARENT/run-$$-$RANDOM"
if ! git worktree add --detach "$WORKTREE_DIR" "$HEAD_SHA" >/dev/null 2>&1; then
  echo "CANNOT-RUN: git worktree add failed (detached worktree at $WORKTREE_DIR)" >&2
  verdict_block "CANNOT-RUN — git worktree add failed" "unavailable (no merge constructed)" >&2
  ledger_append "CANNOT-RUN" "unavailable" '["git-worktree-add"]'
  exit 3
fi

if git merge-base --is-ancestor "$BASE_SHA" "$HEAD_SHA" 2>/dev/null; then
  # F2 (ratified): head already contains base -> the merge result equals the
  # head tree by construction. Proceed; gate the real thing; keep three shas.
  MERGE_SHA=$HEAD_SHA
  MERGE_DISPLAY="$MERGE_SHA (base already contained)"
  echo "merge = head (base already contained) — gating the head tree; merge result is identical by construction"
else
  set +e
  git -C "$WORKTREE_DIR" merge --no-ff --no-edit "$BASE_SHA" >"$WORKTREE_DIR/.getff-merge.out" 2>&1
  MERGE_RC=$?
  set -e
  if [ "$MERGE_RC" -ne 0 ]; then
    UNMERGED=$(git -C "$WORKTREE_DIR" diff --name-only --diff-filter=U 2>/dev/null | wc -l | tr -d ' ')
    if [ "${UNMERGED:-0}" -gt 0 ]; then
      git -C "$WORKTREE_DIR" diff --name-only --diff-filter=U 2>/dev/null | sed 's/^/  conflicted: /' >&2
      verdict_block "MERGE CONFLICT — exit 2" "CONFLICT" >&2
      echo "GitHub runs no pull_request workflow at all in this state — a CI waiter sees bogus green." >&2
      ledger_append "CONFLICT" "CONFLICT" '[]'
      exit 2
    fi
    echo "CANNOT-RUN: git merge failed without unmerged paths (rc=$MERGE_RC):" >&2
    if [ -n "${PMC_VERBOSE:-}" ]; then tail -n 20 "$WORKTREE_DIR/.getff-merge.out" >&2 || true; fi
    verdict_block "CANNOT-RUN — git merge failed (no conflict)" "unavailable" >&2
    ledger_append "CANNOT-RUN" "unavailable" '["git-merge"]'
    exit 3
  fi
  MERGE_SHA=$(git -C "$WORKTREE_DIR" rev-parse HEAD)
  MERGE_DISPLAY="$MERGE_SHA"
fi

# From here on the merge result exists — every remaining outcome (3/90/1/0)
# can and does print the three-sha block and append its ledger line (§a.2).
LOG_FILE="$LOGS_DIR/$MERGE_SHA.log"

# ── lane derivation from the merge tree's own wired surfaces (§a.4) ──

PKG_JSON="$WORKTREE_DIR/package.json"
if [ ! -f "$PKG_JSON" ]; then
  echo "CANNOT-RUN: no package.json in the merge tree — B1 carries the npm/ts-server lane only; python/go/cargo/UI lanes land in B2" >&2
  verdict_block "CANNOT-RUN — no wired npm surface (B1: ts lane)" "$MERGE_DISPLAY" >&2
  ledger_append "CANNOT-RUN" "$MERGE_SHA" '["lane"]'
  exit 3
fi
VALIDATE_SCRIPT=$(sed -n 's/.*"validate"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$PKG_JSON" | head -n 1)
if [ -z "$VALIDATE_SCRIPT" ]; then
  echo "CANNOT-RUN: package.json has no \"validate\" script — nothing wired for the carrier to run" >&2
  verdict_block "CANNOT-RUN — no validate script wired" "$MERGE_DISPLAY" >&2
  ledger_append "CANNOT-RUN" "$MERGE_SHA" '["lane"]'
  exit 3
fi

# Declared gates = the script names named in the wired validate after the
# npm-run-all2 token (flags skipped). If the consumer rewired validate away
# from npm-run-all2, the vacuity control falls back to the aggregate itself.
AGG_TOKEN=$(printf '%s\n' "$VALIDATE_SCRIPT" | awk '{for(i=1;i<=NF;i++) if($i ~ /npm-run-all/) {print $i; exit}}')
DECLARED_GATES=()
if [ -n "$AGG_TOKEN" ]; then
  while IFS= read -r _tok; do
    [ -n "$_tok" ] && DECLARED_GATES+=("$_tok")
  done <<EOF
$(printf '%s\n' "$VALIDATE_SCRIPT" | tr ' ' '\n' | grep -v '^--' | grep -v '^npm-run-all' || true)
EOF
fi

# ── pin checks: node major vs .nvmrc when the consumer pins (mismatch -> 3) ──

if [ -f "$WORKTREE_DIR/.nvmrc" ]; then
  NVMRC_RAW=$(tr -d '[:space:]' < "$WORKTREE_DIR/.nvmrc")
  PIN_MAJOR=$(printf '%s' "$NVMRC_RAW" | tr -d 'vV' | cut -d. -f1)
  if ! HOST_NODE_MAJOR=$(node --version 2>/dev/null | tr -d 'v' | cut -d. -f1); then
    echo "CANNOT-RUN: node is required (merge tree pins .nvmrc = $NVMRC_RAW) and node was not found on this host" >&2
    verdict_block "CANNOT-RUN — node absent, .nvmrc pins a version" "$MERGE_DISPLAY" >&2
    ledger_append "CANNOT-RUN" "$MERGE_SHA" '["node"]'
    exit 3
  fi
  if [ -n "$PIN_MAJOR" ] && [ "$PIN_MAJOR" != "$HOST_NODE_MAJOR" ]; then
    echo "CANNOT-RUN: node major mismatch — .nvmrc pins $NVMRC_RAW (major $PIN_MAJOR), host has $(node --version) (major $HOST_NODE_MAJOR)" >&2
    echo "A run under a different major would not be the same validate (spec §b: pin mismatch is never a silent run)." >&2
    verdict_block "CANNOT-RUN — node major mismatch vs .nvmrc" "$MERGE_DISPLAY" >&2
    ledger_append "CANNOT-RUN" "$MERGE_SHA" '["node-pin"]'
    exit 3
  fi
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "CANNOT-RUN: npm is required for the ts-server lane and was not found on this host" >&2
  verdict_block "CANNOT-RUN — npm absent" "$MERGE_DISPLAY" >&2
  ledger_append "CANNOT-RUN" "$MERGE_SHA" '["npm"]'
  exit 3
fi

# ── the run: fresh npm ci in the throwaway worktree, then npm run validate ──
# No pipe around the gate command (§b.2 trap 5): explicit redirect + captured RC.

cd "$WORKTREE_DIR"
set +e
npm ci --prefer-offline >"$LOG_FILE" 2>&1
NPM_CI_RC=$?
set -e
if [ "$NPM_CI_RC" -ne 0 ]; then
  echo "FAIL: npm ci failed on the merge result (rc=$NPM_CI_RC) — log: $LOG_FILE (set PMC_VERBOSE=1 for the tail)" >&2
  if [ -n "${PMC_VERBOSE:-}" ]; then tail -n 20 "$LOG_FILE" >&2; fi
  verdict_block "FAIL — npm ci failed on the merge result" "$MERGE_DISPLAY" >&2
  ledger_append "FAIL" "$MERGE_SHA" '["npm ci"]'
  exit 1
fi

set +e
npm run validate >>"$LOG_FILE" 2>&1
VALIDATE_RC=$?
set -e

# ── vacuity control (§a.4/§b.2 trap 1): declared gates must have reported ──
# npm prints "> <pkg>@<version> <script>" for every script it runs, so each
# declared gate leaves a header in the log. On PASS every gate must be there;
# on failure at least one declared gate must have started (npm-run-all2
# --parallel stops the set on first failure — not-yet-started siblings are
# legitimate, a log where NOTHING declared ever started is not).

reported_gate() {
  # Match ONLY the npm script header "> <pkg>@<version> <script>", not npm's
  # command-echo line ("> npm-run-all2 --parallel typecheck lint" also ends
  # with a gate name and would otherwise fake a report — caught live by the
  # arm-4 fixture, 2026-08-18).
  grep -q "^> [^[:space:]]*@[^[:space:]]*[[:space:]]$1\$" "$LOG_FILE"
}

GATES_FOR_CHECK=("${DECLARED_GATES[@]+"${DECLARED_GATES[@]}"}")
if [ "${#GATES_FOR_CHECK[@]}" -eq 0 ]; then
  GATES_FOR_CHECK=("validate")
fi

MISSING_GATES=()
REPORTED_GATES=()
for _g in "${GATES_FOR_CHECK[@]}"; do
  if reported_gate "$_g"; then
    REPORTED_GATES+=("$_g")
  else
    MISSING_GATES+=("$_g")
  fi
done

if [ "$VALIDATE_RC" -eq 0 ] && [ "${#MISSING_GATES[@]}" -gt 0 ]; then
  echo "VACUITY: aggregate exited 0 but declared gate(s) never reported in the log:" >&2
  for _g in ${MISSING_GATES[@]+"${MISSING_GATES[@]}"}; do echo "  never reported: $_g" >&2; done
  echo "Exit code said pass; evidence says a gate silently never ran (defect class getff#1466 item 1)." >&2
  verdict_block "VACUITY — declared gate(s) never reported" "$MERGE_DISPLAY" >&2
  ledger_append "VACUITY" "$MERGE_SHA" '[]'
  exit 90
fi
if [ "$VALIDATE_RC" -ne 0 ] && [ "${#REPORTED_GATES[@]}" -eq 0 ]; then
  echo "VACUITY: validate failed but no declared gate ever reported in the log — the failure is unattributed, the run proves nothing" >&2
  verdict_block "VACUITY — no declared gate ever reported" "$MERGE_DISPLAY" >&2
  ledger_append "VACUITY" "$MERGE_SHA" '[]'
  exit 90
fi

# ── verdicts ──

if [ "$VALIDATE_RC" -ne 0 ]; then
  FAILED_JSON="["
  _sep=
  for _g in ${REPORTED_GATES[@]+"${REPORTED_GATES[@]}"}; do
    FAILED_JSON="${FAILED_JSON}${_sep}\"$_g\""
    _sep=", "
  done
  FAILED_JSON="$FAILED_JSON]"
  echo "FAIL: npm run validate exited $VALIDATE_RC on the merge result — log: $LOG_FILE (set PMC_VERBOSE=1 for the tail)" >&2
  if [ -n "${PMC_VERBOSE:-}" ]; then tail -n 20 "$LOG_FILE" >&2; fi
  verdict_block "FAIL — gate(s) red on the merge result" "$MERGE_DISPLAY" >&2
  ledger_append "FAIL" "$MERGE_SHA" "$FAILED_JSON"
  exit 1
fi

# Opportunistic NOT-COVERED leg (F3 report-only): gitleaks when the binary
# exists. Its result is advisory colour on the verdict, never a gate.
GITLEAKS_NOTE="gitleaks not found on host (leg stays NOT COVERED)"
if command -v gitleaks >/dev/null 2>&1; then
  set +e
  gitleaks detect --source . --no-banner --redact >>"$LOG_FILE" 2>&1
  GL_RC=$?
  set -e
  if [ "$GL_RC" -eq 0 ]; then
    GITLEAKS_NOTE="gitleaks ran opportunistically: clean"
  else
    GITLEAKS_NOTE="gitleaks ran opportunistically: FINDINGS (rc=$GL_RC) — see $LOG_FILE"
  fi
fi

verdict_block "LOCAL PRE-MERGE PASS" "$MERGE_DISPLAY"
echo "This is a local pre-merge run — weaker evidence than CI (bypassable; dirty host). Never cite it as \"CI green\"."
echo "Opportunistic leg: $GITLEAKS_NOTE"
echo "Full log retained outside the throwaway worktree: $LOG_FILE"
pr_body_block "PASS"
ledger_append "PASS" "$MERGE_SHA" '[]'
exit 0
