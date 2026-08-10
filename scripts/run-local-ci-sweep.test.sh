#!/usr/bin/env bash
# Paired-negative test for run-local-ci-sweep.sh. Stubs all gates — never runs the real suite.
# Wired in CI via .github/workflows/audit-self.yml (principles-meta-tests job).
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SWEEP="$HERE/run-local-ci-sweep.sh"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
fails=0

check() { # check <desc> <expected-rc> <actual-rc>
  if [ "$2" = "$3" ]; then echo "  ✓ $1"; else echo "  ✗ $1 (want rc=$2 got rc=$3)"; fails=$((fails + 1)); fi
}
grep_out() { # grep_out <desc> <pattern> <file>
  if grep -qF "$2" "$3"; then echo "  ✓ $1"; else echo "  ✗ $1 (missing: $2)"; fails=$((fails + 1)); fi
}
no_file() { # no_file <desc> <path>
  if [ -e "$2" ]; then echo "  ✗ $1 (exists: $2)"; fails=$((fails + 1)); else echo "  ✓ $1"; fi
}
has_file() { # has_file <desc> <path>
  if [ -e "$2" ]; then echo "  ✓ $1"; else echo "  ✗ $1 (missing: $2)"; fails=$((fails + 1)); fi
}

# --- (pos) all stubbed gates green → rc 0, all PASS ---
printf '1\tcheap\tALWAYS\ttrue\n2\tmid\tALWAYS\ttrue\n' >"$TMP/gates.tsv"
SWEEP_GATES_FILE="$TMP/gates.tsv" SWEEP_DIFF_OVERRIDE="x.txt" bash "$SWEEP" --full >"$TMP/o1" 2>&1
check "all-green exits 0" 0 $?
grep_out "all-green reports PASS" "PASS" "$TMP/o1"

# --- (neg) a gate fails → rc 1, fail-fast (later gate never runs) ---
rm -f "$TMP/RAN"
printf '1\tcheapfail\tALWAYS\tfalse\n2\texpensive\tALWAYS\ttouch %s/RAN\n' "$TMP" >"$TMP/gates.tsv"
SWEEP_GATES_FILE="$TMP/gates.tsv" SWEEP_DIFF_OVERRIDE="x.txt" bash "$SWEEP" --full >"$TMP/o2" 2>&1
check "one-fail exits 1" 1 $?
grep_out "failing gate reported FAIL" "FAIL" "$TMP/o2"
no_file "fail-fast: later gate skipped" "$TMP/RAN"

# --- (diff-aware) md-only diff selects the doc gate, not the shipped gate ---
rm -f "$TMP/BYTE"
printf '1\tdoc\t.md\ttrue\n4\tbyte\tSHIPPED\ttouch %s/BYTE\n' "$TMP" >"$TMP/gates.tsv"
SWEEP_GATES_FILE="$TMP/gates.tsv" SWEEP_DIFF_OVERRIDE="README.md" bash "$SWEEP" >"$TMP/o3" 2>&1
check "md diff exits 0" 0 $?
grep_out "md diff ran doc gate" "PASS doc" "$TMP/o3"
no_file "md diff skipped shipped gate" "$TMP/BYTE"

# --- (fail-safe) an unmapped path escalates to full (runs every gate) ---
rm -f "$TMP/OTHER"
printf '1\tdoc\t.md\ttrue\n2\tother\tpackages/\ttouch %s/OTHER\n' "$TMP" >"$TMP/gates.tsv"
SWEEP_GATES_FILE="$TMP/gates.tsv" SWEEP_DIFF_OVERRIDE="weird/unmapped.bin" bash "$SWEEP" >"$TMP/o4" 2>&1
has_file "unmapped path escalated to full (ran all gates)" "$TMP/OTHER"

# --- (prefix-with-dot) a trigger that is both .*-prefixed and /-suffixed matches as PREFIX ---
# Regression: .github/workflows/ must select via prefix, not be misread as a suffix → false escalation.
rm -f "$TMP/WF" "$TMP/ESC"
printf '1\twf\t.github/workflows/\ttouch %s/WF\n2\tother\tpackages/\ttouch %s/ESC\n' "$TMP" "$TMP" >"$TMP/gates.tsv"
SWEEP_GATES_FILE="$TMP/gates.tsv" SWEEP_DIFF_OVERRIDE=".github/workflows/audit-self.yml" bash "$SWEEP" >"$TMP/o6" 2>&1
has_file "dot-prefix trigger matched as prefix (wf gate ran)" "$TMP/WF"
no_file "dot-prefix trigger did NOT escalate to full (other gate skipped)" "$TMP/ESC"

# --- (shipped) a shipped-source path selects the SHIPPED gate ---
rm -f "$TMP/BYTE2"
printf '1\tdoc\t.md\ttrue\n4\tbyte\tSHIPPED\ttouch %s/BYTE2\n' "$TMP" >"$TMP/gates.tsv"
SWEEP_GATES_FILE="$TMP/gates.tsv" SWEEP_DIFF_OVERRIDE="skills/foo/SKILL.md" bash "$SWEEP" >"$TMP/o5" 2>&1
has_file "shipped path selected SHIPPED gate" "$TMP/BYTE2"

# --- (self-truncation) a gate command carrying its own `exit 1` (the real
# install-sh-suite row shape: `for t in …; do bash "$t" || exit 1; done`) must fail
# THAT gate with the FAIL + stopped-at lines — not kill the sweep mid-loop.
# Regression: handoff item 3, 2026-07-25 — sweep rc=1 with 8 PASS lines and nothing
# else; the eval ran the gate's `exit 1` in the sweep's own shell. ---
rm -f "$TMP/LATER"
printf '1\tsuite\tALWAYS\tfor t in a b; do false || exit 1; done\n2\tlater\tALWAYS\ttouch %s/LATER\n' "$TMP" >"$TMP/gates.tsv"
SWEEP_GATES_FILE="$TMP/gates.tsv" SWEEP_DIFF_OVERRIDE="x.txt" bash "$SWEEP" --full >"$TMP/o9" 2>&1
check "exit-in-gate-cmd exits 1" 1 $?
grep_out "exit-in-gate-cmd reports FAIL (no self-truncation)" "[sweep] FAIL suite" "$TMP/o9"
grep_out "exit-in-gate-cmd reports stopped-at" "SWEEP: stopped at suite" "$TMP/o9"
no_file "exit-in-gate-cmd keeps fail-fast (later gate skipped)" "$TMP/LATER"

# --- (comma-trigger) a gate with a comma-joined trigger list matches ANY listed path ---
rm -f "$TMP/MULTI_A" "$TMP/MULTI_B"
printf '1\tmulti\ttests/install-sh/,.github/workflows/\ttouch %s/MULTI_A\n' "$TMP" >"$TMP/gates.tsv"
SWEEP_GATES_FILE="$TMP/gates.tsv" SWEEP_DIFF_OVERRIDE=".github/workflows/x.yml" bash "$SWEEP" >"$TMP/o7" 2>&1
has_file "comma-trigger matched via second entry (workflows)" "$TMP/MULTI_A"
printf '1\tmulti\ttests/install-sh/,.github/workflows/\ttouch %s/MULTI_B\n' "$TMP" >"$TMP/gates.tsv"
SWEEP_GATES_FILE="$TMP/gates.tsv" SWEEP_DIFF_OVERRIDE="tests/install-sh/foo.test.sh" bash "$SWEEP" >"$TMP/o8" 2>&1
has_file "comma-trigger matched via first entry (install-sh)" "$TMP/MULTI_B"

# --- (stdin-eating gate) a gate whose command READS STDIN must not consume the heredoc
# that drives the gate loop. Without `</dev/null` on the eval, `cat` swallows every
# remaining gate line and the sweep prints a plausible all-PASS tail and exits 0 having
# silently skipped the rest. Regression: 2026-08-09 — adding the tests/hooks/*.test.sh
# battery (the pre-push stdin-detection tests feed the hook on stdin) truncated `--full`
# at 16 gates; install-sh-suite and all eleven rank-6 gates never ran, rc=0. ---
rm -f "$TMP/AFTER_STDIN"
printf '1\tstdineater\tALWAYS\tcat >/dev/null\n2\tafter\tALWAYS\ttouch %s/AFTER_STDIN\n' "$TMP" >"$TMP/gates.tsv"
SWEEP_GATES_FILE="$TMP/gates.tsv" SWEEP_DIFF_OVERRIDE="x.txt" bash "$SWEEP" --full >"$TMP/o10" 2>&1
check "stdin-eating gate exits 0" 0 $?
has_file "stdin-eating gate did NOT truncate the loop (later gate ran)" "$TMP/AFTER_STDIN"
grep_out "stdin-eating gate: both gates accounted for" "SWEEP: 2 gate(s) passed" "$TMP/o10"

# --- (degrade visibility) a gate that succeeds by DEGRADING (actionlint absent, host toolchain
# != CI pins) must not report a bare PASS: its stdout went to /dev/null, so a WARN-skip was
# indistinguishable from a real run — `#warning-nobody-reads`
# (.claude/rules/attention-is-not-a-mechanism.md §2). Only the `[sweep] WARN` prefix counts;
# a gate printing bare "WARN" during a genuine run stays PASS. ---
printf '1\tdegraded\tALWAYS\techo "[sweep] WARN-skip thing absent"\n' >"$TMP/gates.tsv"
SWEEP_GATES_FILE="$TMP/gates.tsv" SWEEP_DIFF_OVERRIDE="x.txt" bash "$SWEEP" --full >"$TMP/o11" 2>&1
check "degraded gate still exits 0" 0 $?
grep_out "degraded gate reported WARN-SKIP, not PASS" "[sweep] WARN-SKIP degraded" "$TMP/o11"
if grep -qF "[sweep] PASS degraded" "$TMP/o11"; then
  echo "  ✗ degraded gate ALSO printed a bare PASS"; fails=$((fails + 1))
else echo "  ✓ degraded gate did not print a bare PASS"; fi

printf '1\trealrun\tALWAYS\techo "WARN: drift detected but test passed"\n' >"$TMP/gates.tsv"
SWEEP_GATES_FILE="$TMP/gates.tsv" SWEEP_DIFF_OVERRIDE="x.txt" bash "$SWEEP" --full >"$TMP/o12" 2>&1
grep_out "bare-WARN output is a genuine PASS, not a degrade" "[sweep] PASS realrun" "$TMP/o12"

[ "$fails" -eq 0 ] && { echo "run-local-ci-sweep: ALL PASS"; exit 0; } || { echo "run-local-ci-sweep: $fails FAIL"; exit 1; }
