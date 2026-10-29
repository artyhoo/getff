#!/usr/bin/env bash
# Verify the real AC8 wrapper propagates its child suite's failure.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Load only AC8, leaving the real heal suite's fixtures and mutations unstarted.
awk '/^test_ac8\(\) \{/ { keep=1 } keep { print } keep && /^\}/ { exit }' \
  "$SCRIPT_DIR/heal.test.sh" > "$WORK/ac8.sh"
[ -s "$WORK/ac8.sh" ]
. "$WORK/ac8.sh"
SCRIPT_DIR="$WORK"
record_pass() { PASS=$((PASS + 1)); }
record_fail() { FAIL=$((FAIL + 1)); }

printf '#!/bin/sh\necho deliberate-child-failure\nexit 17\n' > "$WORK/refresh-aif-base.test.sh"
PASS=0; FAIL=0
test_ac8
[ "$PASS" -eq 0 ] && [ "$FAIL" -eq 1 ]
echo 'PASS: nonzero child suite is a failure'

printf '#!/bin/sh\necho successful-child-suite\nexit 0\n' > "$WORK/refresh-aif-base.test.sh"
PASS=0; FAIL=0
test_ac8
[ "$PASS" -eq 1 ] && [ "$FAIL" -eq 0 ]
echo 'PASS: successful child suite remains a pass'
