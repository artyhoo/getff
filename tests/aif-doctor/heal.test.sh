#!/usr/bin/env bash
# heal.test.sh — fixture test for heal.sh
#
# Exercises the 8 acceptance criteria (kickoff §3) against heal.sh using a `curl`
# stub that serves canned JSON. The T-HEAL-A trap (kickoff §5) is explicit: the
# bug manifests only when the runtime is genuinely busy, which cannot be arranged
# from inside a task worktree. Drive the decision logic through STUBBED responses
# so every state is exercised deterministically, and never treat a live
# observation as a substitute for criterion 2.
#
# HERMETIC ON BOTH HALVES (parallel to refresh-aif-base.test.sh):
#   - curl is an EXPORTED BASH FUNCTION that delegates to stubs/curl. The
#     helper's `export PATH=...` cannot unset the function, so a real curl on
#     PATH (host machine /opt/homebrew/bin/curl) is never reached.
#   - DECOY_BIN prepends `curl` (exit 99) to PATH so environment-independence
#     is LOAD-BEARING — green with decoy present proves the override wins,
#     not absence of real curl on PATH (the original-test hidden assumption).
#   - AIF_REFRESH_HELPER points at a sentinel that records its invocation, so
#     AC1/AC3 can assert refresh-invoked / not-invoked without running a real
#     refresh.
#
# SELF-APPLICATION (T15 — kickoff §5): this suite exercises a safety interlock
# that mutates shared state (the container's shared base checkout). The
# fixtures MUST NOT mutate real shared state:
#   - AIF_URL (RUNTIME_BRIDGE_AIF_URL) is http://stub.invalid — the exported
#     curl function intercepts the call regardless of URL; never localhost:3009.
#   - AIF_REFRESH_HELPER points at a sentinel that only echoes, never the real
#     refresh-aif-base.sh.
#   - DECOY_BIN catches any stub-function-override regression loudly (exit 99).
#   - All fixtures live under mktemp -d, cleaned by trap.
#
# Run: bash tests/aif-doctor/heal.test.sh
set -uo pipefail

STUBS_DIR="$(cd "$(dirname "$0")/stubs" && pwd)"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HELPER="$SCRIPT_DIR/../../.claude/skills/aif-doctor/helpers/heal.sh"

PASS=0; FAIL=0; SETUP_ERRORS=0
record_pass() { PASS=$((PASS + 1)); echo "  [PASS] $*"; }
record_fail() { FAIL=$((FAIL + 1)); echo "  [FAIL] $*"; }
record_setup_error() {
  SETUP_ERRORS=$((SETUP_ERRORS + 1))
  echo "  [SETUP ERROR] $*"
  echo "    (harness environment defect — NOT a heal.sh logic failure)"
}

DECOY_BIN=""
SENTINEL_DIR=""
OUT_FILE=""
cleanup() {
  [ -n "$DECOY_BIN"   ] && rm -rf "$DECOY_BIN"   2>/dev/null || true
  [ -n "$SENTINEL_DIR" ] && rm -rf "$SENTINEL_DIR" 2>/dev/null || true
  [ -n "$OUT_FILE"    ] && rm -f  "$OUT_FILE"    2>/dev/null || true
}
trap cleanup EXIT

# ── Stub FUNCTION: override curl in child bash. Exported BEFORE any helper
# invocation. bash resolves functions BEFORE PATH lookups, so real curl on
# PATH is never reached. The decoy bin below makes this load-bearing.
export STUBS_DIR
curl() { "$STUBS_DIR/curl" "$@"; }
export -f curl

# ── Decoy bin — load-bearing proof of environment-independence ──────────────────────
DECOY_BIN="$(mktemp -d)"
cat > "$DECOY_BIN/curl" <<'EOF'
#!/usr/bin/env bash
echo "DECOY curl HIT — exported-function override failed; suite is NOT environment-independent" >&2
exit 99
EOF
chmod +x "$DECOY_BIN/curl"
export PATH="$DECOY_BIN:$PATH"

# ── Sentinel refresh helper — records invocation, never runs a real refresh ─────────
SENTINEL_DIR="$(mktemp -d)"
SENTINEL="$SENTINEL_DIR/refresh-sentinel.sh"
cat > "$SENTINEL" <<'EOF'
#!/usr/bin/env bash
echo "REFRESH-INVOKED pid=$$"
exit 0
EOF
chmod +x "$SENTINEL"

OUT_FILE="$(mktemp)"

# Absolute bash path — used by AC7a/AC7b which strip /usr/bin (jq's home) from
# PATH to exercise the no-jq fallback. Without this, the `bash "$HELPER"`
# invocation in those tests fails to find bash itself.
BASH_BIN="$(command -v bash)"

# ── Runner ─────────────────────────────────────────────────────────────────────────
# run_heal <mode> <extra-env-prefix>
# Captures helper stdout into $OUT_FILE; sets RUN_HEAL_EXIT.
run_heal() {
  local mode="$1"
  local extra="${2:-}"
  : > "$OUT_FILE"
  STUB_MODE="$mode" \
  RUNTIME_BRIDGE_AIF_URL="http://stub.invalid" \
  AIF_REFRESH_HELPER="$SENTINEL" \
  $extra \
  bash "$HELPER" >"$OUT_FILE" 2>&1 || true
  RUN_HEAL_EXIT=$?
}

# make_nojq_path → builds a shadow PATH dir containing every tool the helper
# AND the curl stub need (cat, tr, grep, wc, cut, dirname, bash) EXCEPT jq.
# On success, echoes the dir path and returns 0. On failure (a needed tool
# cannot be resolved), echoes nothing to stdout, emits a setup error to stderr,
# and returns 1.
#
# PORTABILITY (kickoff §5 T-HEAL-A, rework 2026-07-24): the previous version
# symlinked every file from jq's own directory, silently assuming every tool
# the stubs need lives in that same directory. On Linux containers `/bin` is
# a symlink to `usr/bin`, so `/usr/bin/*` covered everything and the suite
# passed. On macOS `/bin` is a separate real directory (`cat` is `/bin/cat`,
# NOT `/usr/bin/cat`), so under the shadow PATH the curl stub died at its
# first `cat <<EOF` and the helper's resulting fail-closed exit was
# mis-read as an AC failure on the host (PR #1130 review).
#
# Approach chosen — ENUMERATE each needed tool and resolve via `command -v`
# individually. Rejected alternative (shadow ONLY jq, leave PATH intact):
# bash's `command -v jq` skips non-executable files and CONTINUES down PATH
# until it finds a real executable jq (verified empirically 2026-07-24:
# non-exec /tmp/.../shadow/jq + /usr/bin/jq later on PATH → `command -v jq`
# returns /usr/bin/jq, exit 0). On any host with real jq installed, the
# naive "non-executable shadow jq" would NOT exercise the no-jq branch at
# all. Enumeration is the only approach that triggers the no-jq path
# deterministically on every host (Linux container, macOS, BSD).
#
# The enumeration list is the surface actually used by heal.sh + stubs/curl
# today. The assert_nojq_harness self-check below catches any future
# addition we miss — failing LOUDLY with SETUP ERROR rather than letting a
# dead stub read as a helper decision (T-HEAL-A mirror image).
make_nojq_path() {
  local shadow; shadow="$(mktemp -d -t nojq-XXXX)"
  # cat: used by stubs/curl (heredoc output). tr/grep/wc/cut/dirname: used by heal.sh.
  # bash: used by the helper's `bash "$REFRESH"` invocation at line 110.
  local needed=(cat tr grep wc cut dirname bash)
  local t bin
  for t in "${needed[@]}"; do
    bin="$(command -v "$t" 2>/dev/null || true)"
    if [ -z "$bin" ]; then
      echo "[setup] cannot resolve required tool '$t' on PATH — host environment is broken; fix before re-running" >&2
      rm -rf "$shadow" 2>/dev/null || true
      NOJQ_SHADOW_DIR=""
      return 1
    fi
    [ -e "$shadow/$t" ] || ln -s "$bin" "$shadow/$t" 2>/dev/null || true
  done
  NOJQ_SHADOW_DIR="$shadow"
  printf '%s' "$shadow"
}

# assert_nojq_harness <shadow_dir> <stub_mode> <ac_name>
# End-to-end probe of the curl stub under the no-jq shadow PATH. If the stub
# cannot produce a JSON-looking body, records a SETUP ERROR (not an AC
# failure) and returns 1. This catches ANY missing tool the helper/stub
# chain depends on (cat on macOS, future additions) — extending the existing
# jq/tr sanity checks to walk the full stub → cat → heredoc path so a dead
# stub can never be mis-read as a helper decision. Parallel to the same
# fail-loud pattern already used for `jq` and `tr` checks in AC7a.
assert_nojq_harness() {
  local shadow="$1" mode="$2" ac="$3"
  local path="$shadow:$DECOY_BIN"
  local probe err
  err="$(mktemp)"
  probe="$(PATH="$path" STUB_MODE="$mode" "$STUBS_DIR/curl" -s -m5 http://stub.invalid/tasks 2>"$err")" || true
  if ! printf '%s' "$probe" | grep -qE '^[[:space:]]*(\[|\{)'; then
    record_setup_error "$ac: curl stub did not produce a JSON-looking body under the no-jq shadow PATH.
    Probe stdout: ${probe:-(empty)}
    Probe stderr: $(head -1 "$err" 2>/dev/null || echo '(empty)')
    Likely cause: a tool the stub calls (cat, tr, ...) is missing from the shadow dir.
    Inspect make_nojq_path's enumeration list vs the stub's actual tool usage."
    rm -f "$err" 2>/dev/null || true
    return 1
  fi
  rm -f "$err" 2>/dev/null || true
  return 0
}

refresh_was_invoked() { grep -qi 'REFRESH-INVOKED' "$OUT_FILE"; }
inflight_message()   { grep -qi 'in-flight'      "$OUT_FILE"; }
failclosed_message() { grep -qiE 'fail-closed|non-array|non-integer|empty body|curl exit' "$OUT_FILE"; }

# ── AC1: in-flight blocks the heal ──────────────────────────────────────────────────
test_ac1() {
  echo ""
  echo "=== AC1: in-flight blocks the heal (status:implementing) ==="
  run_heal tasks_implementing
  sed 's/^/    /' "$OUT_FILE"
  if refresh_was_invoked; then
    record_fail "AC1: refresh WAS invoked despite in-flight task"
  elif ! inflight_message; then
    record_fail "AC1: 'in-flight' not in output"
  else
    record_pass "AC1: in-flight task blocked the refresh"
  fi
}

# ── AC2: lying activeTaskCount does not fool it ─────────────────────────────────────
test_ac2() {
  echo ""
  echo "=== AC2: lying activeTaskCount does not fool it (/agent/status=0, /tasks=implementing) ==="
  run_heal tasks_implementing_with_lie
  sed 's/^/    /' "$OUT_FILE"
  # Pre-fix code read /agent/status (the lie) → refresh IS invoked → AC2 fails.
  # Post-fix code reads /tasks only → in-flight detected → refresh NOT invoked.
  if refresh_was_invoked; then
    record_fail "AC2: refresh WAS invoked — the /agent/status lie fooled the interlock (REGRESSION)"
  elif ! inflight_message; then
    record_fail "AC2: 'in-flight' not in output"
  else
    record_pass "AC2: lying activeTaskCount did NOT fool the new interlock"
  fi
}

# ── AC3: idle allows the heal ───────────────────────────────────────────────────────
test_ac3() {
  echo ""
  echo "=== AC3: idle allows the heal (only done/verified/paused-plan_ready) ==="
  run_heal tasks_idle
  sed 's/^/    /' "$OUT_FILE"
  if ! refresh_was_invoked; then
    record_fail "AC3: refresh NOT invoked despite idle runtime"
  else
    record_pass "AC3: idle runtime allowed the refresh"
  fi
}

# ── AC4: un-paused plan_ready counts as in-flight ───────────────────────────────────
test_ac4() {
  echo ""
  echo "=== AC4: un-paused plan_ready counts as in-flight ==="
  run_heal tasks_plan_ready_unpaused
  sed 's/^/    /' "$OUT_FILE"
  if refresh_was_invoked; then
    record_fail "AC4: refresh WAS invoked despite un-paused plan_ready"
  elif ! inflight_message; then
    record_fail "AC4: 'in-flight' not in output"
  else
    record_pass "AC4: un-paused plan_ready correctly counted as in-flight"
  fi
}

# ── AC5: unreachable /tasks fails closed ────────────────────────────────────────────
test_ac5() {
  echo ""
  echo "=== AC5: unreachable /tasks fails closed ==="
  run_heal tasks_unreachable
  sed 's/^/    /' "$OUT_FILE"
  if refresh_was_invoked; then
    record_fail "AC5: refresh WAS invoked despite unreachable /tasks (FAIL-OPEN REGRESSION)"
  elif ! failclosed_message; then
    record_fail "AC5: no fail-closed message in output"
  else
    record_pass "AC5: unreachable /tasks correctly failed closed"
  fi
}

# ── AC6: malformed response fails closed ────────────────────────────────────────────
test_ac6() {
  echo ""
  echo "=== AC6: malformed response fails closed ==="
  run_heal tasks_malformed
  sed 's/^/    /' "$OUT_FILE"
  if refresh_was_invoked; then
    record_fail "AC6: refresh WAS invoked despite malformed /tasks body (FAIL-OPEN REGRESSION)"
  elif ! failclosed_message; then
    record_fail "AC6: no fail-closed message in output"
  else
    record_pass "AC6: malformed /tasks body correctly failed closed"
  fi
}

# ── AC7a: no-jq path — AC1 still blocks ─────────────────────────────────────────────
test_ac7a() {
  echo ""
  echo "=== AC7a: no-jq path — AC1 still blocks (PATH hides jq) ==="
  local nojq_dir; nojq_dir="$(make_nojq_path)" || {
    record_setup_error "AC7a: make_nojq_path failed — see stderr above"
    return
  }
  local new_path="$nojq_dir:$DECOY_BIN"
  # Sanity: confirm jq is actually hidden in the subshell we're about to spawn,
  # AND that the other tools the helper needs are still reachable.
  local jq_check tr_check
  jq_check="$(PATH="$new_path" command -v jq 2>/dev/null || true)"
  tr_check="$(PATH="$new_path" command -v tr   2>/dev/null || true)"
  if [ -n "$jq_check" ]; then
    record_setup_error "AC7a: jq still resolvable at '$jq_check' after make_nojq_path"
    rm -rf "$nojq_dir" 2>/dev/null || true
    return
  fi
  if [ -z "$tr_check" ]; then
    record_setup_error "AC7a: tr missing from shadow dir (helper would break for the wrong reason)"
    rm -rf "$nojq_dir" 2>/dev/null || true
    return
  fi
  echo "    jq hidden, tr reachable ($tr_check): no-jq path is real"
  # End-to-end stub probe — catches ANY missing tool (cat on macOS, future
  # additions) rather than relying on per-tool enumeration staying in sync.
  # Mirrors the existing jq/tr sanity but walks the full stub → cat → heredoc
  # chain so a dead stub can never be mis-read as a helper decision.
  if ! assert_nojq_harness "$nojq_dir" tasks_implementing "AC7a"; then
    rm -rf "$nojq_dir" 2>/dev/null || true
    return
  fi
  echo "    stub probe OK: curl stub produced JSON-looking body under shadow PATH"
  : > "$OUT_FILE"
  STUB_MODE=tasks_implementing \
  RUNTIME_BRIDGE_AIF_URL="http://stub.invalid" \
  AIF_REFRESH_HELPER="$SENTINEL" \
  PATH="$new_path" \
  "$BASH_BIN" "$HELPER" >"$OUT_FILE" 2>&1 || true
  RUN_HEAL_EXIT=$?
  rm -rf "$nojq_dir" 2>/dev/null || true
  sed 's/^/    /' "$OUT_FILE"
  if refresh_was_invoked; then
    record_fail "AC7a: refresh WAS invoked on no-jq path despite in-flight task"
  elif ! inflight_message; then
    record_fail "AC7a: 'in-flight' not in output (no-jq path)"
  else
    record_pass "AC7a: no-jq path correctly blocked in-flight task"
  fi
}

# ── AC7b: no-jq path — AC3 still allows ─────────────────────────────────────────────
test_ac7b() {
  echo ""
  echo "=== AC7b: no-jq path — AC3 still allows (PATH hides jq) ==="
  local nojq_dir; nojq_dir="$(make_nojq_path)" || {
    record_setup_error "AC7b: make_nojq_path failed — see stderr above"
    return
  }
  local new_path="$nojq_dir:$DECOY_BIN"
  # End-to-end stub probe (same rationale as AC7a): catches a missing tool
  # loudly, never lets a dead stub read as "the helper decided X".
  if ! assert_nojq_harness "$nojq_dir" tasks_idle "AC7b"; then
    rm -rf "$nojq_dir" 2>/dev/null || true
    return
  fi
  echo "    stub probe OK: curl stub produced JSON-looking body under shadow PATH"
  : > "$OUT_FILE"
  STUB_MODE=tasks_idle \
  RUNTIME_BRIDGE_AIF_URL="http://stub.invalid" \
  AIF_REFRESH_HELPER="$SENTINEL" \
  PATH="$new_path" \
  "$BASH_BIN" "$HELPER" >"$OUT_FILE" 2>&1 || true
  RUN_HEAL_EXIT=$?
  rm -rf "$nojq_dir" 2>/dev/null || true
  sed 's/^/    /' "$OUT_FILE"
  if ! refresh_was_invoked; then
    record_fail "AC7b: refresh NOT invoked on no-jq path despite idle runtime"
  else
    record_pass "AC7b: no-jq path correctly allowed idle refresh"
  fi
}

# ── AC8: existing refresh-aif-base.test.sh still green ──────────────────────────────
test_ac8() {
  echo ""
  echo "=== AC8: existing refresh-aif-base.test.sh still green ==="
  local out
  out="$(bash "$SCRIPT_DIR/refresh-aif-base.test.sh" 2>&1 || true)"
  local exit=$?
  printf '%s\n' "$out" | tail -3 | sed 's/^/    /'
  if [ "$exit" -ne 0 ]; then
    record_fail "AC8: refresh-aif-base.test.sh exited $exit (regression)"
  else
    record_pass "AC8: refresh-aif-base.test.sh still green (exit 0)"
  fi
}

# ── Main ────────────────────────────────────────────────────────────────────────────
echo "heal.sh fixture test"
echo "Helper:    $HELPER"
echo "Stubs:     $STUBS_DIR (curl served via exported bash function)"
echo "Decoy bin: $DECOY_BIN (curl fail-loud probe on PATH)"
echo "Sentinel:  $SENTINEL (records invocation, never runs real refresh)"
echo "Date:      $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""
echo "Hermeticity seams (parallel to refresh-aif-base.test.sh):"
echo "  - curl is an exported FUNCTION overriding PATH lookups"
echo "  - decoy curl on PATH (exit 99) makes the override load-bearing"
echo "  - AIF_REFRESH_HELPER = sentinel (no real refresh)"
echo "  - AIF_URL = http://stub.invalid (never localhost:3009)"

test_ac1
test_ac2
test_ac3
test_ac4
test_ac5
test_ac6
test_ac7a
test_ac7b
test_ac8

echo ""
echo "================================================================"
echo "Results: $PASS passed, $FAIL failed, $SETUP_ERRORS setup errors (of $((PASS + FAIL + SETUP_ERRORS)))"
echo "================================================================"
[ "$FAIL" -eq 0 ] && [ "$SETUP_ERRORS" -eq 0 ] || exit 1
