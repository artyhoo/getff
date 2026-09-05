#!/usr/bin/env bash
#
# pre-merge-local.sh — opt-in local pre-merge carrier (B2: all seven shipped lanes —
# npm/ts-server + react-next/react-spa/react-native UI presets, python, go, cargo).
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
# merge — the lane-aware NOT COVERED list, and appends one NDJSON line to
#   $(git rev-parse --git-path getff/pre-merge-runs.ndjson)
# (per-clone, never committed, worktree-safe via --git-path). On FAIL,
# failed_gates names the lane-qualified gates that STARTED (npm-run-all2
# --parallel stops the set on first failure, so the failing gate is among the
# started set; stack-lane gates are "lane:<command>").
#
# B2 lane scope — SEVEN lanes, all DERIVED at run time from the merge tree's
# own wired surfaces (§a.4 — derived, never restated here):
#   npm/ts-server      package.json "scripts.validate" (setup.d/70-deps.sh)
#   react-next/spa/RN  npm lane + extensions derived from .github/workflows/ci.yml
#                      ci-success.needs: `build` -> `npm run build` gate;
#                      test-storybook/test-e2e -> F3 report-only NOT COVERED legs
#   python             .github/workflows/getff-python.yml (ast-grep + ruff, pinned)
#   go                 .github/workflows/getff-go.yml (golangci-lint, pinned)
#   cargo              .github/workflows/getff-cargo.yml (clippy, unpinned by design)
# A tree may carry SEVERAL lanes (monorepo) — every detected lane runs, and the
# aggregate is never a silent subset: any detected-but-unrunnable required lane
# (tool/pin absent or mismatched) => overall exit 3; per-lane vacuity => 90;
# any gate red => 1; all reported and green => 0 (severity order 3 > 90 > 1 > 0).
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

# ── verdict globals (B2 lane framework) ──
# Declared HERE, before any verdict_block call site: the early verdict paths
# (worktree-add failure, merge conflict) run before lane detection, and
# verdict_block reads these under `set -u` — an unset array length is fatal
# there (observed live: arm 3 conflict path exited 1 instead of 2).
DETECTED_LANES=()
CANNOT_RUN=()       # "<lane>:<tool>" — required tool/pin absent or mismatched
VACUOUS_GATES=()    # lane-qualified gates declared but never reported
FAILED_GATES_Q=()   # lane-qualified gates that ran and went red
NOT_COVERED=()      # §e.2 entries, lane-aware
E2E_OWED=0

WORKTREE_DIR=
# shellcheck disable=SC2329  # invoked indirectly: `trap cleanup EXIT` below
cleanup() {
  # Run from the main toplevel (cwd may be inside the worktree we remove).
  cd "$TOPLEVEL" 2>/dev/null || true
  if [ -n "$WORKTREE_DIR" ] && [ -d "$WORKTREE_DIR" ]; then
    git worktree remove --force "$WORKTREE_DIR" >/dev/null 2>&1 || rm -rf "$WORKTREE_DIR"
  fi
  git worktree prune >/dev/null 2>&1 || true
  # go-lane cache isolation dir (§b.1 go row) — throwaway by contract.
  if [ -n "${GO_CACHE_DIR:-}" ] && [ -d "$GO_CACHE_DIR" ]; then
    rm -rf "$GO_CACHE_DIR"
  fi
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
# Prints the contract block: three shas (W-1/T-PMC-B) + detected lanes +
# lane-aware NOT COVERED list (§e.2). NOT_COVERED / DETECTED_LANES are
# populated by the lane runners before any verdict call.
verdict_block() {
  _line=$1
  _merge_disp=$2
  echo ""
  echo "=== $PROG: $_line ==="
  echo "head:   $HEAD_SHA"
  echo "base:   $BASE_SHA  ($BASE_REF)"
  echo "merge:  $_merge_disp"
  echo "lanes:  ${DETECTED_LANES[*]:-none}"
  echo "NOT COVERED (CI legs not reproduced locally):"
  if [ "${#NOT_COVERED[@]}" -eq 0 ]; then
    echo "  - (none — every gate of the detected lane workflows ran locally)"
  else
    for _n in ${NOT_COVERED[@]+"${NOT_COVERED[@]}"}; do
      echo "  - $_n"
    done
  fi
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

# ── lane framework (B2): detection from the merge tree's own wired surfaces (§a.4) ──
# A tree may carry SEVERAL lanes (monorepo: npm + python + go) — every detected
# lane runs. Aggregate is never a silent subset (Fork #1, binding reading of
# §a.4 + §a.3): any detected-but-unrunnable required lane (tool/pin absent or
# mismatched) => overall exit 3; declared-but-unreported gate on an otherwise
# green lane => 90; any gate red => 1; all reported and green => 0.
# (Verdict globals DETECTED_LANES/CANNOT_RUN/VACUOUS_GATES/FAILED_GATES_Q/
# NOT_COVERED/E2E_OWED are declared near the lock setup, above.)

WF_PYTHON="$WORKTREE_DIR/.github/workflows/getff-python.yml"
WF_GO="$WORKTREE_DIR/.github/workflows/getff-go.yml"
WF_CARGO="$WORKTREE_DIR/.github/workflows/getff-cargo.yml"

LANE_NPM=0; LANE_PY=0; LANE_GO=0; LANE_CARGO=0
if [ -f "$WORKTREE_DIR/package.json" ]; then LANE_NPM=1; DETECTED_LANES+=("npm"); fi
if [ -f "$WF_PYTHON" ]; then LANE_PY=1; DETECTED_LANES+=("python"); fi
if [ -f "$WF_GO" ]; then LANE_GO=1; DETECTED_LANES+=("go"); fi
if [ -f "$WF_CARGO" ]; then LANE_CARGO=1; DETECTED_LANES+=("cargo"); fi

if [ "${#DETECTED_LANES[@]}" -eq 0 ]; then
  echo "CANNOT-RUN: no wired lane surface in the merge tree — expected one of: package.json (npm lanes: ts-server + UI presets), .github/workflows/getff-python.yml, getff-go.yml, getff-cargo.yml" >&2
  verdict_block "CANNOT-RUN — no wired lane surface" "$MERGE_DISPLAY" >&2
  ledger_append "CANNOT-RUN" "$MERGE_SHA" '["lane"]'
  exit 3
fi

json_quote_list() { # prints ["a", "b"] from args (none -> [])
  _jl_out="["
  _jl_sep=
  for _jl_v in "$@"; do
    _jl_out="$_jl_out$_jl_sep\"$_jl_v\""
    _jl_sep=", "
  done
  printf '%s]' "$_jl_out"
}

# reported_gate <gate> — npm prints "> <pkg>@<version> <script>" for every
# script it runs, so each declared npm-lane gate leaves a header in the log.
# Match ONLY that header, not npm's command-echo line ("> npm-run-all2
# --parallel typecheck lint" also ends with a gate name and would otherwise
# fake a report — caught live by the arm-4 fixture, 2026-08-18).
reported_gate() {
  grep -q "^> [^[:space:]]*@[^[:space:]]*[[:space:]]$1\$" "$LOG_FILE"
}

# ── npm lane (ts-server + UI presets): B1 path + the B2 UI extension ──

run_npm_lane() {
  [ "$LANE_NPM" -eq 1 ] || return 0
  local _pkg="$WORKTREE_DIR/package.json"
  local _validate _agg _pin_raw _pin_major _host_major _vrc _rc _g _tok _x _build_owed=0
  local -a _declared=() _gates_for_check=() _missing=() _reported=() _needs=()

  NOT_COVERED+=("security job: npm audit + gitleaks")
  NOT_COVERED+=("codecov upload (reporting service)")
  NOT_COVERED+=("mutation (PR-only job; not in ci-success.needs)")

  _validate=$(sed -n 's/.*"validate"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$_pkg" | head -n 1)
  if [ -z "$_validate" ]; then
    CANNOT_RUN+=("npm:no-validate-script")
    echo "CANNOT-RUN: package.json has no \"validate\" script — nothing wired for the carrier to run" >&2
    return 0
  fi

  # Declared gates = the script names named in the wired validate after the
  # npm-run-all2 token (flags skipped). If the consumer rewired validate away
  # from npm-run-all2, the vacuity control falls back to the aggregate itself.
  _agg=$(printf '%s\n' "$_validate" | awk '{for(i=1;i<=NF;i++) if($i ~ /npm-run-all/) {print $i; exit}}')
  if [ -n "$_agg" ]; then
    while IFS= read -r _tok; do
      [ -n "$_tok" ] && _declared+=("$_tok")
    done <<EOF
$(printf '%s\n' "$_validate" | tr ' ' '\n' | grep -v '^--' | grep -v '^npm-run-all' || true)
EOF
  fi

  # pin checks: node major vs .nvmrc when the consumer pins (mismatch -> 3)
  if [ -f "$WORKTREE_DIR/.nvmrc" ]; then
    _pin_raw=$(tr -d '[:space:]' < "$WORKTREE_DIR/.nvmrc")
    _pin_major=$(printf '%s' "$_pin_raw" | tr -d 'vV' | cut -d. -f1)
    if ! _host_major=$(node --version 2>/dev/null | tr -d 'v' | cut -d. -f1); then
      CANNOT_RUN+=("npm:node")
      echo "CANNOT-RUN: node is required (merge tree pins .nvmrc = $_pin_raw) and node was not found on this host" >&2
      return 0
    fi
    if [ -n "$_pin_major" ] && [ "$_pin_major" != "$_host_major" ]; then
      CANNOT_RUN+=("npm:node-pin")
      echo "CANNOT-RUN: node major mismatch — .nvmrc pins $_pin_raw (major $_pin_major), host has $(node --version) (major $_host_major)" >&2
      echo "A run under a different major would not be the same validate (spec §b: pin mismatch is never a silent run)." >&2
      return 0
    fi
  fi

  # ── which package manager? The LOCKFILE decides (ledger A4-2) ───────────────
  # The lane is detected from package.json alone (:261), and this used to hard-run
  # `npm ci` on whatever it found. On a pnpm or yarn consumer there is no
  # package-lock.json, so npm ci exits non-zero and the carrier recorded verdict
  # FAIL / exit 1 — «a gate went red on the merge result» — for a repository whose
  # gates never ran at all. That inverts this script's own verdict contract (:21:
  # exit 3 CANNOT-RUN is for «a required tool/pin is absent on this host») and
  # writes a false failed_gates:['npm:npm ci'] row into the ledger.
  #
  # Frozen installs only, in every lane: a carrier that re-resolves dependencies is
  # not validating the merge result the CI runner will see.
  local _pm _pm_install _lock
  if [ -f "$WORKTREE_DIR/package-lock.json" ]; then
    _pm="npm"; _lock="package-lock.json"; _pm_install="npm ci --prefer-offline"
  elif [ -f "$WORKTREE_DIR/pnpm-lock.yaml" ]; then
    _pm="pnpm"; _lock="pnpm-lock.yaml"; _pm_install="pnpm install --frozen-lockfile --prefer-offline"
  elif [ -f "$WORKTREE_DIR/yarn.lock" ]; then
    _pm="yarn"; _lock="yarn.lock"
    # Yarn 1 spells it --frozen-lockfile; Berry (2+) renamed it --immutable and
    # rejects the old flag outright, so the wrong one is a hard error, not a warning.
    if command -v yarn >/dev/null 2>&1 && [ "$(yarn --version 2>/dev/null | cut -d. -f1)" = "1" ]; then
      _pm_install="yarn install --frozen-lockfile"
    else
      _pm_install="yarn install --immutable"
    fi
  else
    CANNOT_RUN+=("npm:no-lockfile")
    echo "CANNOT-RUN: package.json is present but no lockfile is — expected one of package-lock.json, pnpm-lock.yaml, yarn.lock. A frozen install is impossible, so the carrier cannot reproduce the CI tree (this is NOT a failing gate)" >&2
    return 0
  fi

  if ! command -v "$_pm" >/dev/null 2>&1; then
    CANNOT_RUN+=("npm:$_pm")
    echo "CANNOT-RUN: $_lock in the merge tree selects $_pm, and $_pm was not found on this host" >&2
    return 0
  fi

  # the run: frozen install in the throwaway worktree, then `<pm> run validate`.
  # No pipe around the gate command (§b.2 trap 5): explicit redirect + captured RC.
  cd "$WORKTREE_DIR"
  set +e
  # CI=true: pnpm aborts a non-interactive run that wants to remove node_modules
  # (ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY) — the carrier has no TTY. Harmless
  # for npm and yarn, which already treat CI as a non-interactive hint.
  CI=true $_pm_install >"$LOG_FILE" 2>&1
  _rc=$?
  set -e
  if [ "$_rc" -ne 0 ]; then
    FAILED_GATES_Q+=("npm:$_pm_install")
    echo "FAIL: '$_pm_install' failed on the merge result (rc=$_rc) — log: $LOG_FILE (set PMC_VERBOSE=1 for the tail)" >&2
    if [ -n "${PMC_VERBOSE:-}" ]; then tail -n 20 "$LOG_FILE" >&2; fi
    return 0
  fi

  set +e
  "$_pm" run validate >>"$LOG_FILE" 2>&1
  _vrc=$?
  set -e
  _rc=$_vrc

  # ── UI-preset extension (react-next / react-spa / react-native): per-preset
  # additions DERIVED from the merge tree's .github/workflows/ci.yml
  # ci-success.needs — never hardcoded. ts-server's ci-success.needs carries no
  # `build` (templates/ts-server/github-actions-ci.yml:221), so ts trees never
  # widen; react-native's carries no build/browser legs -> validate only.
  if [ -f "$WORKTREE_DIR/.github/workflows/ci.yml" ]; then
    while IFS= read -r _x; do
      [ -n "$_x" ] && _needs+=("$_x")
    done <<EOF
$(awk '
  /^  ci-success:/ { injob=1; next }
  injob && /^[^[:space:]]/ { injob=0 }
  injob && /needs:/ {
    inn=1; l=$0; sub(/.*needs:/, "", l); gsub(/[\[\],]/, " ", l)
    gsub(/^[[:space:]]+|[[:space:]]+$/, "", l)
    n=split(l, a, /[[:space:]]+/)
    for (i=1; i<=n; i++) if (a[i] != "") print a[i]
    next
  }
  inn && /^[[:space:]]*- / { l=$0; sub(/^[[:space:]]*-[[:space:]]*/, "", l); gsub(/[[:space:]]+$/, "", l); print l; next }
  inn { inn=0 }
' "$WORKTREE_DIR/.github/workflows/ci.yml")
EOF
    echo "[npm] UI extension: ci.yml ci-success.needs = ${_needs[*]-}" >>"$LOG_FILE"
    for _x in ${_needs[@]+"${_needs[@]}"}; do
      case "$_x" in
        build)
          _build_owed=1
          ;;
        test-storybook)
          NOT_COVERED+=("test-storybook (browser-dependent: built Storybook served on port 6006) — named by ci.yml ci-success.needs")
          for _g in build-storybook test-storybook; do
            if ! grep -q "\"$_g\"" "$_pkg"; then
              echo "WARN (npm/ui): ci.yml declares test-storybook but package.json lacks a \"$_g\" script — CI fails this leg (setup.d/70-deps.sh wires it for react-next)" >&2
            fi
          done
          ;;
        test-e2e)
          NOT_COVERED+=("test-e2e (playwright; browser-dependent) — named by ci.yml ci-success.needs")
          E2E_OWED=1
          ;;
        *)
          # default arm (rework round 1, MINOR 3c): an unmapped job name must
          # never be silently treated as covered — name it, loudly.
          echo "WARN (npm/ui): ci-success.needs names unmapped job '$_x' — not one of the mapped legs (build/test-storybook/test-e2e); covered only insofar as 'npm run validate' includes it — verify in CI" >&2
          ;;
      esac
    done
    if [ "$_build_owed" -eq 1 ] && [ "$_vrc" -eq 0 ]; then
      set +e
      "$_pm" run build >>"$LOG_FILE" 2>&1
      _rc=$?
      set -e
      if [ "$_rc" -ne 0 ]; then
        FAILED_GATES_Q+=("npm:build")
        echo "FAIL: npm run build exited $_rc on the merge result — log: $LOG_FILE (set PMC_VERBOSE=1 for the tail)" >&2
      fi
    fi
  fi

  # vacuity control (§a.4/§b.2 trap 1): declared gates must have reported. On
  # PASS every gate must be there; on failure at least one declared gate must
  # have started (npm-run-all2 --parallel stops the set on first failure —
  # not-yet-started siblings are legitimate, a log where NOTHING declared ever
  # started is not).
  _gates_for_check=(${_declared[@]+"${_declared[@]}"})
  if [ "$_build_owed" -eq 1 ]; then _gates_for_check+=("build"); fi
  if [ "${#_gates_for_check[@]}" -eq 0 ]; then
    _gates_for_check=("validate")
  fi

  _missing=()
  _reported=()
  for _g in "${_gates_for_check[@]}"; do
    if reported_gate "$_g"; then
      _reported+=("$_g")
    else
      _missing+=("$_g")
    fi
  done

  if [ "$_rc" -eq 0 ] && [ "${#_missing[@]}" -gt 0 ]; then
    echo "VACUITY: aggregate exited 0 but declared gate(s) never reported in the log:" >&2
    for _g in ${_missing[@]+"${_missing[@]}"}; do
      echo "  never reported: $_g" >&2
      VACUOUS_GATES+=("npm:$_g")
    done
    echo "Exit code said pass; evidence says a gate silently never ran (defect class getff#1466 item 1)." >&2
    return 0
  fi
  if [ "$_vrc" -ne 0 ] && [ "${#_reported[@]}" -eq 0 ]; then
    echo "VACUITY: validate failed but no declared gate ever reported in the log — the failure is unattributed, the run proves nothing" >&2
    VACUOUS_GATES+=("npm:validate-unattributed")
    return 0
  fi

  if [ "$_vrc" -ne 0 ]; then
    for _g in ${_reported[@]+"${_reported[@]}"}; do
      FAILED_GATES_Q+=("npm:$_g")
    done
    echo "FAIL: npm run validate exited $_vrc on the merge result — log: $LOG_FILE (set PMC_VERBOSE=1 for the tail)" >&2
    if [ -n "${PMC_VERBOSE:-}" ]; then tail -n 20 "$LOG_FILE" >&2; fi
  fi
}

# ── python lane: ast-grep + ruff gates from getff-python.yml, pinned ──

run_python_lane() {
  [ "$LANE_PY" -eq 1 ] || return 0
  local _cr0 _ag_pin _ruff_pin _host _cmd _cfg _rc _g _failed=0
  local -a _cmds=() _missed=()
  _cr0=${#CANNOT_RUN[@]}

  # Pins are parsed from the workflow's INSTALL (run:) lines only, never from
  # header comments: the live template's header comment names the pins inside
  # prose ("... fires (@ast-grep/cli@0.44.1, ruff==0.15.21) so ...") and an
  # unanchored grep picks that up first, yielding pins with trailing ',' / ')'
  # (measured 2026-08-19, rework round 1 — permanent false exit 3).
  _ag_pin=$(grep -E '^[[:space:]]*(-[[:space:]]+)?run:.*@ast-grep/cli@' "$WF_PYTHON" | head -n 1 \
    | grep -oE '@ast-grep/cli@[^[:space:]]+' | sed 's/^.*@//' || true)
  _ruff_pin=$(grep -E '^[[:space:]]*(-[[:space:]]+)?run:.*ruff==' "$WF_PYTHON" | head -n 1 \
    | grep -oE 'ruff==[^[:space:]]+' | sed 's/^ruff==//' || true)
  echo "[python] pins parsed from getff-python.yml: ast-grep=${_ag_pin:-unparsed} ruff=${_ruff_pin:-unparsed}" >>"$LOG_FILE"

  if ! command -v ast-grep >/dev/null 2>&1; then
    CANNOT_RUN+=("python:ast-grep")
    echo "CANNOT-RUN: ast-grep is required by getff-python.yml and was not found on this host (workflow pins @ast-grep/cli@${_ag_pin:-unparsed})" >&2
  elif [ -n "$_ag_pin" ]; then
    _host=$(ast-grep --version 2>/dev/null | grep -oE '[0-9]+(\.[0-9]+)+' | head -n 1 || true)
    if [ "$_host" != "$_ag_pin" ]; then
      CANNOT_RUN+=("python:ast-grep-pin")
      echo "CANNOT-RUN: ast-grep version mismatch — getff-python.yml pins @ast-grep/cli@$_ag_pin, host has ${_host:-unparseable} — never a silent run under a different version" >&2
    fi
  else
    CANNOT_RUN+=("python:ast-grep-pin-unparsed")
    echo "CANNOT-RUN: getff-python.yml installs ast-grep but its pin could not be parsed (tolerated shape: '@ast-grep/cli@<version>' on a run: line) — never a silent unpinned run" >&2
  fi
  if ! command -v ruff >/dev/null 2>&1; then
    CANNOT_RUN+=("python:ruff")
    echo "CANNOT-RUN: ruff is required by getff-python.yml and was not found on this host (workflow pins ruff==${_ruff_pin:-unparsed})" >&2
  elif [ -n "$_ruff_pin" ]; then
    _host=$(ruff --version 2>/dev/null | grep -oE '[0-9]+(\.[0-9]+)+' | head -n 1 || true)
    if [ "$_host" != "$_ruff_pin" ]; then
      CANNOT_RUN+=("python:ruff-pin")
      echo "CANNOT-RUN: ruff version mismatch — getff-python.yml pins ruff==$_ruff_pin, host has ${_host:-unparseable} — never a silent run under a different version" >&2
    fi
  else
    CANNOT_RUN+=("python:ruff-pin-unparsed")
    echo "CANNOT-RUN: getff-python.yml installs ruff but its pin could not be parsed (tolerated shape: 'ruff==<version>' on a run: line) — never a silent unpinned run" >&2
  fi
  if [ "${#CANNOT_RUN[@]}" -gt "$_cr0" ]; then
    return 0
  fi

  # gate set derived from the consumer's own workflow: every run: line that
  # invokes ast-grep / ruff. ruff invocations gain --no-cache (§b.1 python row:
  # cache isolation on BOTH ruff gates).
  while IFS= read -r _cmd; do
    [ -n "$_cmd" ] || continue
    case "$_cmd" in
      ruff\ *)
        case "$_cmd" in
          *--no-cache*) _cmds+=("$_cmd") ;;
          *) _cmds+=("$_cmd --no-cache") ;;
        esac
        ;;
      *)
        _cmds+=("$_cmd")
        ;;
    esac
  done <<EOF
$(grep -E '^[[:space:]]*(-[[:space:]]+)?run:[[:space:]]*(ast-grep|ruff)[[:space:]]' "$WF_PYTHON" \
  | sed -e 's/^[[:space:]]*//' -e 's/^-[[:space:]]*//' -e 's/^run:[[:space:]]*//' -e 's/[[:space:]]*#.*$//' || true)
EOF

  # zero-gate vacuity guard (rework round 1, MAJOR 2): a DETECTED lane whose
  # workflow parses to ZERO gate lines must never contribute a silent nothing
  # while the aggregate prints PASS — that is the exact silent-subset defect
  # this carrier exists to eliminate (header contract above, :45-48).
  if [ "${#_cmds[@]}" -eq 0 ]; then
    CANNOT_RUN+=("python:zero-gates-parsed")
    echo "CANNOT-RUN: python lane detected but ZERO ast-grep/ruff gate lines parsed from .github/workflows/getff-python.yml — the workflow drifted off every tolerated run: shape; refusing to report a silent subset as PASS" >&2
    return 0
  fi

  cd "$WORKTREE_DIR"
  for _cmd in ${_cmds[@]+"${_cmds[@]}"}; do
    # a gate whose declared --config input is missing in the merge tree cannot
    # run here — CI WILL run it (and go red): a declared-but-unreported gate,
    # never a silent subset. Named below + counted as vacuity if the lane is
    # otherwise green.
    _cfg=$(printf '%s\n' "$_cmd" | sed -n 's/.*--config[[:space:]][[:space:]]*\([^[:space:]]*\).*/\1/p')
    if [ -n "$_cfg" ] && [ ! -f "$_cfg" ]; then
      _missed+=("$_cmd")
      echo "VACUITY-risk (python lane): gate '$_cmd' needs --config $_cfg which is MISSING in the merge tree — not run; CI runs this gate red (commit the config)" >&2
      continue
    fi
    echo "[python] gate start: $_cmd" >>"$LOG_FILE"
    set +e
    # shellcheck disable=SC2086  # gate argv word-split deliberately: parsed from the consumer's workflow
    $_cmd >>"$LOG_FILE" 2>&1
    _rc=$?
    set -e
    echo "[python] gate rc=$_rc: $_cmd" >>"$LOG_FILE"
    if [ "$_rc" -ne 0 ]; then
      _failed=1
      FAILED_GATES_Q+=("python:$_cmd")
    fi
  done
  if [ "${#_missed[@]}" -gt 0 ] && [ "$_failed" -eq 0 ]; then
    echo "VACUITY: python lane gates declared in getff-python.yml never ran (missing inputs, named above)" >&2
    for _g in ${_missed[@]+"${_missed[@]}"}; do
      echo "  never reported: python:$_g" >&2
      VACUOUS_GATES+=("python:$_g")
    done
  fi
}

# ── go lane: golangci-lint forbidigo bans from getff-go.yml, pinned ──

run_go_lane() {
  [ "$LANE_GO" -eq 1 ] || return 0
  local _cr0 _go_pin _gl_pin _gl_pin_clean _host _cfg _args _rc
  _cr0=${#CANNOT_RUN[@]}

  # Pin parses are anchored to the workflow's own input/run lines, never to
  # comments: the live template's header comment carries the literal fragment
  # "'go-version:' input" — an unanchored 'go-version:.*' grep matches that
  # comment FIRST and extracts no digits, silently killing the go pin check
  # (measured 2026-08-19, rework round 1).
  _go_pin=$(grep -E '^[[:space:]]+go-version:' "$WF_GO" | head -n 1 | grep -oE '[0-9][0-9.]*' | head -n 1 || true)
  _gl_pin=$(grep -E '^[[:space:]]*(-[[:space:]]+)?run:.*golangci-lint@' "$WF_GO" | head -n 1 \
    | grep -oE 'golangci-lint@[^[:space:]]+' | sed 's/^golangci-lint@//' || true)
  _gl_pin_clean=$(printf '%s' "$_gl_pin" | sed 's/^v//')
  echo "[go] pins parsed from getff-go.yml: go=${_go_pin:-unparsed} golangci-lint=${_gl_pin:-unparsed}" >>"$LOG_FILE"

  if ! command -v go >/dev/null 2>&1; then
    CANNOT_RUN+=("go:go")
    echo "CANNOT-RUN: go is required by getff-go.yml (pins go-version ${_go_pin:-unparsed}) and was not found on this host" >&2
  elif [ -n "$_go_pin" ]; then
    _host=$(go version 2>/dev/null | grep -oE 'go[0-9]+(\.[0-9]+)+' | head -n 1 | sed 's/^go//' || true)
    if [ "$_host" != "$_go_pin" ]; then
      CANNOT_RUN+=("go:go-pin")
      echo "CANNOT-RUN: go version mismatch — getff-go.yml pins go-version $_go_pin, host has ${_host:-unparseable}" >&2
    fi
  else
    CANNOT_RUN+=("go:go-pin-unparsed")
    echo "CANNOT-RUN: getff-go.yml sets up go but its go-version pin could not be parsed (tolerated shape: an indented 'go-version: <version>' input line) — never a silent unpinned run" >&2
  fi
  if ! command -v golangci-lint >/dev/null 2>&1; then
    CANNOT_RUN+=("go:golangci-lint")
    echo "CANNOT-RUN: golangci-lint is required by getff-go.yml and was not found on this host (workflow pins golangci-lint@${_gl_pin:-unparsed})" >&2
  elif [ -n "$_gl_pin" ]; then
    _host=$(golangci-lint --version 2>/dev/null | grep -oE 'v?[0-9]+\.[0-9]+\.[0-9]+' | head -n 1 | sed 's/^v//' || true)
    if [ "$_host" != "$_gl_pin_clean" ]; then
      CANNOT_RUN+=("go:golangci-lint-pin")
      echo "CANNOT-RUN: golangci-lint version mismatch — getff-go.yml pins golangci-lint@$_gl_pin, host has ${_host:-unparseable} — never a silent run under a different version" >&2
    fi
  else
    CANNOT_RUN+=("go:golangci-lint-pin-unparsed")
    echo "CANNOT-RUN: getff-go.yml installs golangci-lint but its pin could not be parsed (tolerated shape: 'golangci-lint@<version>' on a run: line) — never a silent unpinned run" >&2
  fi
  if [ "${#CANNOT_RUN[@]}" -gt "$_cr0" ]; then
    return 0
  fi

  # config resolution mirrors the consumer's own getff-go.yml branch order:
  # .golangci.yml (fresh cell) -> getff-golangci.yml (REFUSE cell) -> skip
  # (the workflow's own else-branch exits 0 there — mirrored, loudly).
  _cfg=
  if [ -f "$WORKTREE_DIR/.golangci.yml" ]; then
    _cfg=.golangci.yml
  elif [ -f "$WORKTREE_DIR/getff-golangci.yml" ]; then
    _cfg=getff-golangci.yml
  else
    echo "[go] golangci-lint gate skipped — no getff go config found in the merge tree (mirrors getff-go.yml's own skip branch: 'run install.sh go to deliver')" >>"$LOG_FILE"
    echo "WARN (go lane): no .golangci.yml / getff-golangci.yml in the merge tree — the workflow's own skip branch applies; gate not run" >&2
    return 0
  fi

  # invocation args derived from the workflow's own golangci-lint COMMAND line
  # (live template, block-run shape: "golangci-lint run --enable forbidigo
  # --config .golangci.yml ./..."); its --config token is replaced by the
  # resolved config above. Anchored to command lines only (inline '- run:
  # golangci-lint run ...' or a block-scalar command line): the live template's
  # step NAME line "- name: golangci-lint run (getff bans)" also contains the
  # literal 'golangci-lint run ' and an unanchored grep derives the garbage
  # args '(getff bans)' from it (measured 2026-08-19, rework round 1).
  _args=$(grep -oE '^[[:space:]]*(-[[:space:]]+)?run:[[:space:]]*golangci-lint run [^#]*|^[[:space:]]+golangci-lint run [^#]*' "$WF_GO" | head -n 1 \
    | sed -e 's/^[[:space:]]*//' -e 's/^-[[:space:]]*//' -e 's/^run:[[:space:]]*//' \
      -e 's/^golangci-lint run //' -e 's/--config[[:space:]][[:space:]]*[^[:space:]][^[:space:]]*[[:space:]]*//' -e 's/[[:space:]]*$//' || true)
  # args-unparsed guard (rework round 1, MAJOR 2): never silently degrade to
  # 'golangci-lint run --config <cfg>' — that drops the workflow's own flags
  # (--enable forbidigo ./...) and reports a narrowed run as if it were whole.
  if [ -z "$_args" ]; then
    CANNOT_RUN+=("go:args-unparsed")
    echo "CANNOT-RUN: go lane — the golangci-lint invocation could not be parsed from .github/workflows/getff-go.yml (tolerated shapes: a 'golangci-lint run ...' command line, block-scalar or inline run:); refusing the degraded 'golangci-lint run --config <cfg>' invocation that would drop the workflow's own flags" >&2
    return 0
  fi
  cd "$WORKTREE_DIR"
  # cache isolation (§b.1 go row): GOLANGCI_LINT_CACHE points at a throwaway
  # dir under the git dir — every carrier run starts cold (conservative
  # prescription, ships regardless of the cache-staleness experiment outcome).
  # Cache-staleness experiment (spec §b.1 go row, 2026-08-19): INCONCLUSIVE —
  # no golangci-lint/go binary reachable in the build container to probe with.
  GO_CACHE_DIR="$GIT_DIR_PATH/pre-merge-golangci-cache-$$-$RANDOM"
  mkdir -p "$GO_CACHE_DIR"
  echo "[go] gate start: golangci-lint run $_args --config $_cfg (GOLANGCI_LINT_CACHE isolated: $GO_CACHE_DIR)" >>"$LOG_FILE"
  set +e
  # shellcheck disable=SC2086  # gate argv word-split deliberately: parsed from the consumer's workflow
  GOLANGCI_LINT_CACHE="$GO_CACHE_DIR" golangci-lint run $_args --config "$_cfg" >>"$LOG_FILE" 2>&1
  _rc=$?
  set -e
  echo "[go] gate rc=$_rc: golangci-lint run" >>"$LOG_FILE"
  if [ "$_rc" -ne 0 ]; then
    FAILED_GATES_Q+=("go:golangci-lint run")
    echo "FAIL (go lane): golangci-lint exited $_rc on the merge result — log: $LOG_FILE" >&2
  fi
}

# ── cargo lane: clippy disallowed-* bans from getff-cargo.yml, unpinned by design ──

run_cargo_lane() {
  [ "$LANE_CARGO" -eq 1 ] || return 0
  local _flags _rc _had_ctd=0 _had_rw=0 _ctd_val='' _rw_val=''

  # deliberately UNPINNED toolchain (getff-cargo.yml header: clippy ships with
  # the consumer's own rustc — companion-install-principle.md, never
  # version-manage the consumer's own stack). Presence check only.
  echo "[cargo] toolchain unpinned by design (getff-cargo.yml header) — presence check only, no version check" >>"$LOG_FILE"
  if ! command -v cargo >/dev/null 2>&1; then
    CANNOT_RUN+=("cargo:cargo")
    echo "CANNOT-RUN: cargo is required by getff-cargo.yml (clippy component of your own toolchain) and was not found on this host" >&2
    return 0
  fi
  if ! cargo clippy --version >>"$LOG_FILE" 2>&1; then
    CANNOT_RUN+=("cargo:clippy")
    echo "CANNOT-RUN: 'cargo clippy --version' failed — the clippy component is required (rustup component add clippy)" >&2
    return 0
  fi

  # denial flags parsed from the consumer's own workflow gate line (§a.4). The
  # live template writes it as a named step (dash on the - name: line, bare
  # run: on its own); both YAML shapes are tolerated.
  _flags=$(grep -E '^[[:space:]]*(-[[:space:]]+)?run:[[:space:]]*cargo clippy' "$WF_CARGO" | head -n 1 \
    | sed -e 's/^[[:space:]]*//' -e 's/^-[[:space:]]*//' -e 's/^run:[[:space:]]*cargo clippy[[:space:]]*//' -e 's/[[:space:]]*#.*$//' || true)
  # flags-unparsed guard (rework round 1, MAJOR 2): a bare 'cargo clippy' run
  # drops the -D clippy::disallowed_* bans and a green result would be a
  # silent-subset PASS — refuse with a named verdict instead of degrading.
  if [ -z "$_flags" ]; then
    CANNOT_RUN+=("cargo:flags-unparsed")
    echo "CANNOT-RUN: cargo lane — the clippy denial flags could not be parsed from .github/workflows/getff-cargo.yml (tolerated shape: a run: line starting 'cargo clippy ...'); refusing a bare 'cargo clippy' run that would drop the -D clippy::disallowed_* bans" >&2
    return 0
  fi
  cd "$WORKTREE_DIR"
  # cache/sccache isolation (§b.1 cargo row): CARGO_TARGET_DIR and RUSTC_WRAPPER
  # are unset for the carrier's run only, then restored.
  if [ "${CARGO_TARGET_DIR+set}" = "set" ]; then _had_ctd=1; _ctd_val=$CARGO_TARGET_DIR; fi
  if [ "${RUSTC_WRAPPER+set}" = "set" ]; then _had_rw=1; _rw_val=$RUSTC_WRAPPER; fi
  unset CARGO_TARGET_DIR RUSTC_WRAPPER
  echo "[cargo] gate start: cargo clippy $_flags" >>"$LOG_FILE"
  echo "[cargo] env isolation: CARGO_TARGET_DIR / RUSTC_WRAPPER unset for this run only" >>"$LOG_FILE"
  set +e
  # shellcheck disable=SC2086  # gate argv word-split deliberately: parsed from the consumer's workflow
  cargo clippy $_flags >>"$LOG_FILE" 2>&1
  _rc=$?
  set -e
  echo "[cargo] gate rc=$_rc: cargo clippy" >>"$LOG_FILE"
  if [ "$_had_ctd" -eq 1 ]; then CARGO_TARGET_DIR=$_ctd_val; fi
  if [ "$_had_rw" -eq 1 ]; then RUSTC_WRAPPER=$_rw_val; fi
  if [ "$_rc" -ne 0 ]; then
    FAILED_GATES_Q+=("cargo:cargo clippy")
    echo "FAIL (cargo lane): cargo clippy exited $_rc on the merge result — log: $LOG_FILE" >&2
  fi
}

# ── run every detected lane, then aggregate ──

run_npm_lane
run_python_lane
run_go_lane
run_cargo_lane

# ── aggregate verdicts (Fork #1 binding order: cannot-run 3 > vacuity 90 > fail 1 > pass 0) ──

if [ "${#CANNOT_RUN[@]}" -gt 0 ]; then
  for _c in "${CANNOT_RUN[@]}"; do
    echo "  cannot-run lane/tool: $_c" >&2
  done
  verdict_block "CANNOT-RUN — required tool/pin absent or mismatched (named above)" "$MERGE_DISPLAY" >&2
  ledger_append "CANNOT-RUN" "$MERGE_SHA" "$(json_quote_list ${CANNOT_RUN[@]+"${CANNOT_RUN[@]}"})"
  exit 3
fi
if [ "${#VACUOUS_GATES[@]}" -gt 0 ]; then
  verdict_block "VACUITY — declared gate(s) never reported" "$MERGE_DISPLAY" >&2
  ledger_append "VACUITY" "$MERGE_SHA" "$(json_quote_list ${VACUOUS_GATES[@]+"${VACUOUS_GATES[@]}"})"
  exit 90
fi
if [ "${#FAILED_GATES_Q[@]}" -gt 0 ]; then
  echo "FAIL: gate(s) red on the merge result — log: $LOG_FILE (set PMC_VERBOSE=1 for the tail)" >&2
  if [ -n "${PMC_VERBOSE:-}" ]; then tail -n 20 "$LOG_FILE" >&2; fi
  verdict_block "FAIL — gate(s) red on the merge result" "$MERGE_DISPLAY" >&2
  ledger_append "FAIL" "$MERGE_SHA" "$(json_quote_list ${FAILED_GATES_Q[@]+"${FAILED_GATES_Q[@]}"})"
  exit 1
fi

# Opportunistic NOT-COVERED legs (F3 report-only): gitleaks (npm-lane security
# job) and playwright e2e (UI preset leg — only when the merge tree carries a
# playwright config AND the host has the binary). Advisory colour, never gates.
cd "$WORKTREE_DIR"
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
E2E_NOTE=
if [ "$E2E_OWED" -eq 1 ] && command -v playwright >/dev/null 2>&1 \
   && ls "$WORKTREE_DIR"/playwright.config.* >/dev/null 2>&1; then
  set +e
  playwright test >>"$LOG_FILE" 2>&1
  PW_RC=$?
  set -e
  if [ "$PW_RC" -eq 0 ]; then
    E2E_NOTE="; playwright e2e ran opportunistically: clean"
  else
    E2E_NOTE="; playwright e2e ran opportunistically: FINDINGS (rc=$PW_RC) — see $LOG_FILE"
  fi
fi

verdict_block "LOCAL PRE-MERGE PASS" "$MERGE_DISPLAY"
echo "This is a local pre-merge run — weaker evidence than CI (bypassable; dirty host). Never cite it as \"CI green\"."
echo "Opportunistic leg: $GITLEAKS_NOTE$E2E_NOTE"
echo "Full log retained outside the throwaway worktree: $LOG_FILE"
pr_body_block "PASS"
ledger_append "PASS" "$MERGE_SHA" '[]'
exit 0
