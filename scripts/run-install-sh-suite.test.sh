#!/usr/bin/env bash
# Paired-negative test for run-install-sh-suite.sh. Uses synthetic fixture suites via the
# positional suite-dir argument — never runs the real tests/install-sh battery.
# Wired in CI via .github/workflows/audit-self.yml; reached locally through the sweep's
# `script-selftests` row, which derives its file list from that workflow.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNNER="$HERE/run-install-sh-suite.sh"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
fails=0

check() { # check <desc> <expected-rc> <actual-rc>
  if [ "$2" = "$3" ]; then echo "  ✓ $1"; else echo "  ✗ $1 (want rc=$2 got rc=$3)"; fails=$((fails + 1)); fi
}
grep_out() { # grep_out <desc> <pattern> <file>
  if grep -qF "$2" "$3"; then echo "  ✓ $1"; else echo "  ✗ $1 (missing: $2)"; fails=$((fails + 1)); fi
}
no_grep_out() { # no_grep_out <desc> <pattern> <file>
  if grep -qF "$2" "$3"; then echo "  ✗ $1 (unexpectedly present: $2)"; fails=$((fails + 1)); else echo "  ✓ $1"; fi
}
mk_suite() { # mk_suite <dir>  — fresh empty fixture suite
  rm -rf "$1"; mkdir -p "$1"; echo "$1"
}

# --- (pos) every fixture green → rc 0, and every fixture's output is replayed ---
S="$TMP/s-pos"; mk_suite "$S" >/dev/null
for i in 1 2 3 4 5; do printf '#!/bin/bash\necho "marker-%s"\n' "$i" >"$S/t$i.test.sh"; done
bash "$RUNNER" "$S" >"$TMP/o1" 2>"$TMP/e1"
check "all-green exits 0" 0 $?
grep_out "all-green reports the tally" "5/5 passed" "$TMP/o1"
for i in 1 2 3 4 5; do grep_out "output of t$i replayed" "marker-$i" "$TMP/o1"; done

# --- (neg, THE load-bearing arm) a failing fixture fails the gate with a non-zero exit ---
# This is the property the serial `for t in ...; do bash "$t" || exit 1; done` provided and that a
# fan-out must not lose. `xargs`'s own status is NOT what produces this — the parent tallies the
# per-test receipts — so this arm also pins that the receipt tally is wired up.
S="$TMP/s-neg"; mk_suite "$S" >/dev/null
printf '#!/bin/bash\necho fine\n'            >"$S/a.test.sh"
printf '#!/bin/bash\necho boom\nexit 7\n'    >"$S/b.test.sh"
printf '#!/bin/bash\necho fine\n'            >"$S/c.test.sh"
bash "$RUNNER" "$S" >"$TMP/o2" 2>&1
check "one failing fixture exits 1" 1 $?
grep_out "the failing fixture is named with its rc" "b.test.sh(rc=7)" "$TMP/o2"
# Fail-COMPLETE, not fail-fast: with a pool already in flight, "stop at the first failure" is not
# a reachable semantic, and reporting every failure in one run beats N sequential re-runs.
grep_out "a fixture ordered after the failure still ran" "c.test.sh" "$TMP/o2"

# --- (neg, false-green guard) a worker killed before writing its receipt must NOT count as a pass ---
# `kill -9 $PPID` takes out the worker (`bash run-install-sh-suite.sh --one …`) mid-test, exactly
# as an OOM kill would. Without the missing-receipt check the suite would tally 1/2 passed, see no
# recorded failure, and exit 0 — a green it never earned.
S="$TMP/s-kill"; mk_suite "$S" >/dev/null
printf '#!/bin/bash\necho fine\n'        >"$S/a.test.sh"
printf '#!/bin/bash\nkill -9 $PPID\n'    >"$S/b.test.sh"
bash "$RUNNER" "$S" >"$TMP/o3" 2>&1
check "a worker that died without a receipt exits 1" 1 $?
grep_out "the receipt-less fixture is reported, not silently dropped" "NO RESULT" "$TMP/o3"

# --- (neg, glob guard) an empty suite directory must refuse to report a green ---
S="$TMP/s-empty"; mk_suite "$S" >/dev/null
bash "$RUNNER" "$S" >"$TMP/o4" 2>&1
check "empty suite dir exits 1" 1 $?
grep_out "empty suite dir says the glob broke" "the glob broke" "$TMP/o4"

# --- (interleaving) concurrent fixtures must not interleave into the replayed output ---
# Each fixture emits 60 tagged lines, PACED. The pacing is load-bearing: an unpaced fixture that
# dumps its lines in one burst finishes before the scheduler reaches the next process, so the
# output stays contiguous even when every worker writes to a shared stdout — measured, and it made
# this arm pass against a deliberately broken runner (`| tee` straight to stdout), i.e. vacuous.
# With a sleep between lines the four workers are guaranteed to be emitting at the same time, so a
# runner that does not buffer per test WILL interleave and this arm WILL catch it.
S="$TMP/s-weave"; mk_suite "$S" >/dev/null
for tag in aaa bbb ccc ddd; do
  printf '#!/bin/bash\nfor i in $(seq 1 60); do echo "%s-$i"; sleep 0.02; done\n' "$tag" >"$S/$tag.test.sh"
done
INSTALL_SH_JOBS=4 bash "$RUNNER" "$S" >"$TMP/o5" 2>&1
check "interleave fixture exits 0" 0 $?
weave_bad=0
for tag in aaa bbb ccc ddd; do
  first=$(grep -n "^$tag-1$" "$TMP/o5" | head -1 | cut -d: -f1)
  last=$(grep -n "^$tag-60$" "$TMP/o5" | head -1 | cut -d: -f1)
  if [ -z "$first" ] || [ -z "$last" ]; then weave_bad=1; continue; fi
  # every line strictly inside the block must belong to this fixture
  if sed -n "${first},${last}p" "$TMP/o5" | grep -qvE "^$tag-[0-9]+$"; then weave_bad=1; fi
done
if [ "$weave_bad" -eq 0 ]; then echo "  ✓ concurrent output blocks are contiguous (no interleave)"
else echo "  ✗ concurrent output interleaved"; fails=$((fails + 1)); fi

# --- (quarantine, WITH its own non-vacuity leg) the quarantined fixture runs alone ---
# The quarantined fixture holds a lock directory for its whole run; every pooled fixture fails if
# it can see that lock. Green proves the quarantined fixture never overlapped the pool.
# It is named `aa-` so that it sorts FIRST: with the quarantine emptied it must enter the pool in
# the very first batch, or the non-vacuity leg below passes for the wrong reason — measured, a
# `zz-` name started only after a slot freed, by which time every pooled fixture had already
# looked at the lock and the RED direction could not be demonstrated at all.
S="$TMP/s-quar"; mk_suite "$S" >/dev/null
printf '#!/bin/bash\nmkdir "%s/qlock"\nsleep 1\nrmdir "%s/qlock"\n' "$TMP" "$TMP" >"$S/aa-mutator.test.sh"
for i in 1 2 3 4 5 6; do
  printf '#!/bin/bash\nsleep 0.2\n[ -d "%s/qlock" ] && { echo "overlapped the mutator"; exit 9; }\nexit 0\n' "$TMP" >"$S/p$i.test.sh"
done
rmdir "$TMP/qlock" 2>/dev/null
INSTALL_SH_JOBS=6 INSTALL_SH_QUARANTINE='aa-mutator.test.sh' bash "$RUNNER" "$S" >"$TMP/o6" 2>&1
check "quarantined fixture runs alone → exits 0" 0 $?
no_grep_out "no pooled fixture saw the mutator's lock" "overlapped the mutator" "$TMP/o6"
# Non-vacuity: empty the quarantine list and the SAME fixtures must go RED. Without this leg the
# arm above is satisfied by a run in which nothing was concurrent at all.
rmdir "$TMP/qlock" 2>/dev/null
INSTALL_SH_JOBS=6 INSTALL_SH_QUARANTINE='' bash "$RUNNER" "$S" >"$TMP/o7" 2>&1
check "un-quarantined, the same fixtures exit 1 (arm is non-vacuous)" 1 $?
grep_out "un-quarantined run shows the overlap it was built to detect" "overlapped the mutator" "$TMP/o7"

# --- (progress) the counter escapes a caller that captures stdout+stderr ---
# The sweep runs each gate as `out="$( (eval "$cmd") 2>&1 </dev/null )"`. Progress on stdout or
# stderr is swallowed by that capture; fd 3 is not touched by it. This arm reproduces the capture
# exactly and asserts the counter still lands on fd 3's destination.
S="$TMP/s-prog"; mk_suite "$S" >/dev/null
for i in 1 2 3; do printf '#!/bin/bash\necho body-%s\n' "$i" >"$S/t$i.test.sh"; done
captured="$( ( bash "$RUNNER" "$S" ) 2>&1 </dev/null 3>"$TMP/fd3" )"
check "progress arm exits 0" 0 $?
grep_out "the counter reached fd 3" "3/3 done" "$TMP/fd3"
printf '%s\n' "$captured" >"$TMP/o8"
no_grep_out "the counter did NOT leak into the captured gate output" "3/3 done" "$TMP/o8"
grep_out "the gate output itself is still captured" "body-2" "$TMP/o8"
# Fallback: with fd 3 closed (a direct CI invocation) the counter must still appear, on stderr.
# `3>&-` is load-bearing and must stay: when this file runs as a sweep gate the sweep has already
# done `exec 3>&2`, so fd 3 is OPEN and inherited here — without the explicit close the arm would
# assert the fallback while the fast path was actually taken, and pass for the wrong reason.
# (Measured 2026-09-14: standalone GREEN, RED under `bash scripts/run-local-ci-sweep.sh`.)
bash "$RUNNER" "$S" >"$TMP/o9" 2>"$TMP/e9" 3>&-
check "fd3-closed arm exits 0" 0 $?
grep_out "with fd 3 closed the counter falls back to stderr" "3/3 done" "$TMP/e9"

# shellcheck disable=SC2015  # both branches exit; the "C runs when A is true" path cannot occur
[ "$fails" -eq 0 ] && { echo "run-install-sh-suite: ALL PASS"; exit 0; } || { echo "run-install-sh-suite: $fails FAIL"; exit 1; }
