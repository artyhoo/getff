#!/usr/bin/env bash
# Self-test for the shared suite harness (suite-harness.sh) — review R6.
#
# The old per-suite pattern (`out=$(node ... | grep ...)` then "no FAIL token and at
# least one ok line") showed ALL GREEN for a child that printed `ok first-arm` and
# exited 1: the pipeline discarded the child's exit status and a late assertion crash
# hid behind an earlier successful arm. This suite pins the corrected contract:
#   - nonzero child exit (after partial success, or by signal) is never green;
#   - empty output is never green;
#   - a FAIL token is never green;
#   - the observed arm set must EQUAL the expected set (missing and unexpected arms
#     both fail — an arm that silently stopped running is a false GREEN).
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$DIR/suite-harness.sh"

fails=0
# check NAME EXPECTED(0=green|1=fail) — followed by an invocation of assert_suite_arms
check() {
  local name="$1" expect="$2"
  if assert_suite_arms "selftest/$name" "${__status:-0}" "${__out:-}" ${__arms:+$__arms} >/dev/null 2>&1; then
    got=0
  else
    got=1
  fi
  if [[ "$got" != "$expect" ]]; then
    echo "FAIL[$name] expected $([[ $expect == 0 ]] && echo green || echo fail), got $([[ $got == 0 ]] && echo green || echo fail)"
    fails=$((fails+1))
    return
  fi
  echo "ok[$name]"
}

# ── green path: exit 0, output present, exact arm set ─────────────────────────
__status=0; __out=$'ok arm-a\nok arm-b'; __arms="arm-a arm-b"
check full-set-green 0

# ── RED directions: every way the old pattern lied ────────────────────────────
__status=1; __out=$'ok first-arm\nError: late assertion exploded'; __arms="first-arm second-arm"
check nonzero-after-partial-success 1

__status=0; __out=''; __arms="arm-a"
check empty-output 1

__status=0; __out=$'ok arm-a\nFAIL[arm-b] assertion'; __arms="arm-a arm-b"
check fail-token 1

__status=0; __out='ok arm-a'; __arms="arm-a arm-b"
check missing-arm 1

__status=0; __out=$'ok arm-a\nok arm-b\nok arm-ghost'; __arms="arm-a arm-b"
check unexpected-extra-arm 1

# signal-killed child (128+9) — not a clean exit even with ok lines printed
__status=137; __out=$'ok arm-a'; __arms="arm-a"
check signal-killed-child 1

# ── the real capture pattern the suites use, against a real crashing child ────
crash_out="$(node -e 'console.log("ok first-arm"); process.exit(1)' 2>&1)"; crash_status=$?
if assert_suite_arms "selftest/real-child-exit" "$crash_status" "$crash_out" first-arm second-arm >/dev/null 2>&1; then
  echo "FAIL[real-child-exit] old-style green for a crashing child"; fails=$((fails+1))
else
  echo "ok[real-child-exit]"
fi

kill_out="$(node -e 'console.log("ok first-arm"); process.kill(process.pid, "SIGKILL")' 2>&1)"; kill_status=$?
if assert_suite_arms "selftest/real-child-signal" "$kill_status" "$kill_out" first-arm >/dev/null 2>&1; then
  echo "FAIL[real-child-signal] old-style green for a killed child"; fails=$((fails+1))
else
  echo "ok[real-child-signal]"
fi

# ── output survives: the full listing is printed on green ─────────────────────
__status=0; __out=$'ok arm-a\nok arm-b'; __arms="arm-a arm-b"
listing="$(assert_suite_arms "selftest/listing" "$__status" "$__out" $__arms)"
if [[ "$listing" != *"ok arm-a"* || "$listing" != *"ok arm-b"* ]]; then
  echo "FAIL[green-listing] expected arm listing, got: $listing"; fails=$((fails+1))
else
  echo "ok[green-listing]"
fi

echo "----"
if [[ $fails -gt 0 ]]; then echo "FAILURES: $fails"; exit 1; fi
echo "harness.test.sh: all green"
