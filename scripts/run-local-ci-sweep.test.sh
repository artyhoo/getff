#!/usr/bin/env bash
# Paired-negative test for run-local-ci-sweep.sh. Stubs all gates — never runs the real suite.
# Wired in CI via .github/workflows/audit-self.yml (principles-meta-tests job).
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SWEEP="$HERE/run-local-ci-sweep.sh"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
fails=0
# Hermetic: this test spawns the sweep many times, and an inherited SWEEP_LOG_DIR would make
# every nested run write into the CALLER's log directory (the `script-selftests` row runs this
# file from inside a real sweep). Arms that care about logging pass the var explicitly.
# The same for the offload knobs: an operator's shell exports SWEEP_HEAVY_RUNNER, and a nested
# run would route stub rows through the real runner; PC_LOCAL=1 would switch the offload arms off.
unset SWEEP_LOG_DIR SWEEP_HEAVY_RUNNER SWEEP_ROUTABLE PC_LOCAL

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

# --- (diff-aware) md-only diff selects the doc gate, not the path-scoped one ---
rm -f "$TMP/BYTE"
printf '1\tdoc\t.md\ttrue\n4\tbyte\tpackages/\ttouch %s/BYTE\n' "$TMP" >"$TMP/gates.tsv"
SWEEP_GATES_FILE="$TMP/gates.tsv" SWEEP_DIFF_OVERRIDE="README.md" bash "$SWEEP" >"$TMP/o3" 2>&1
check "md diff exits 0" 0 $?
grep_out "md diff ran doc gate" "PASS doc" "$TMP/o3"
no_file "md diff skipped the path-scoped gate" "$TMP/BYTE"

# --- (fail-safe) an unmapped path escalates to full (runs every gate) ---
rm -f "$TMP/OTHER"
printf '1\tdoc\t.md\ttrue\n2\tother\tpackages/\ttouch %s/OTHER\n' "$TMP" >"$TMP/gates.tsv"
SWEEP_GATES_FILE="$TMP/gates.tsv" SWEEP_DIFF_OVERRIDE="weird/unmapped.bin" bash "$SWEEP" >"$TMP/o4" 2>&1
has_file "unmapped path escalated to full (ran all gates)" "$TMP/OTHER"

mk_repo() { # mk_repo <dir> — a git repo with the real sweep installed at scripts/
  local d="$1"
  mkdir -p "$d/scripts"
  cp "$SWEEP" "$d/scripts/run-local-ci-sweep.sh"
  printf 'seed\n' >"$d/README.md"
  ( cd "$d" && env -u GIT_DIR -u GIT_WORK_TREE git init -q \
      && git config user.email t@example.com && git config user.name t \
      && git add -A && env -u GIT_DIR -u GIT_WORK_TREE git commit -qm init ) >/dev/null 2>&1
}
run_sweep() { # run_sweep <repo-dir> [args…] — invoke that repo's own copy, GIT_* unset
  local d="$1"; shift
  env -u GIT_DIR -u GIT_WORK_TREE bash "$d/scripts/run-local-ci-sweep.sh" "$@"
}

# --- (always/empty-diff) an ALWAYS gate runs even when the diff selects nothing ---
# `--base HEAD` makes `git diff HEAD...HEAD` empty, which is what a sweep over an all-uncommitted
# tree sees. Regression 2026-09-14: `gate_selected` loops over $CHANGED, so on an empty diff the
# loop body never ran and the ALWAYS row silently selected nothing — "SWEEP: no gates selected"
# with rc 0, the `#hope-as-gate` shape (.claude/rules/attention-is-not-a-mechanism.md §2).
# Runs in a CLEAN throwaway repo, never in the live worktree. The exit code asserted below is
# 0, and the dirty-tree refusal (#1780) legitimately answers 3 on a dirty tree — so pointing
# this arm at the checkout would make its verdict a function of whatever the operator happens
# to have uncommitted. Measured 2026-09-14: it went red (rc=3) on the merge that brought the
# two changes together, against a worktree mid-edit and nothing else.
rm -f "$TMP/ALW" "$TMP/SCOPED"
RALW="$TMP/repo-always"; mk_repo "$RALW"
printf '1\talways\tALWAYS\ttouch %s/ALW\n2\tscoped\tpackages/\ttouch %s/SCOPED\n' "$TMP" "$TMP" >"$TMP/gates.tsv"
SWEEP_GATES_FILE="$TMP/gates.tsv" run_sweep "$RALW" --base HEAD >"$TMP/o13" 2>&1
check "empty diff exits 0" 0 $?
has_file "ALWAYS gate ran on an empty diff" "$TMP/ALW"
no_file "empty diff did not run the path-scoped gate" "$TMP/SCOPED"

# --- (always is not coverage) an ALWAYS row must NOT satisfy the unmapped-path fail-safe ---
# Paired negative for the arm above: ALWAYS means "unconditional", not "matches every path".
# Counting it as coverage retires the escalation fail-safe entirely — measured 2026-09-14, the
# real table's `citation-fullsweep` row turned `weird/unmapped.bin` from "escalating to --full"
# (every gate) into "1 gate(s) passed".
rm -f "$TMP/ALW2" "$TMP/SCOPED2"
printf '1\talways\tALWAYS\ttouch %s/ALW2\n2\tscoped\tpackages/\ttouch %s/SCOPED2\n' "$TMP" "$TMP" >"$TMP/gates.tsv"
SWEEP_GATES_FILE="$TMP/gates.tsv" SWEEP_DIFF_OVERRIDE="weird/unmapped.bin" bash "$SWEEP" >"$TMP/o14" 2>&1
grep_out "unmapped path still escalates despite an ALWAYS row" "escalating to --full" "$TMP/o14"
has_file "escalation ran the path-scoped gate too" "$TMP/SCOPED2"

# --- (prefix-with-dot) a trigger that is both .*-prefixed and /-suffixed matches as PREFIX ---
# Regression: .github/workflows/ must select via prefix, not be misread as a suffix → false escalation.
rm -f "$TMP/WF" "$TMP/ESC"
printf '1\twf\t.github/workflows/\ttouch %s/WF\n2\tother\tpackages/\ttouch %s/ESC\n' "$TMP" "$TMP" >"$TMP/gates.tsv"
SWEEP_GATES_FILE="$TMP/gates.tsv" SWEEP_DIFF_OVERRIDE=".github/workflows/audit-self.yml" bash "$SWEEP" >"$TMP/o6" 2>&1
has_file "dot-prefix trigger matched as prefix (wf gate ran)" "$TMP/WF"
no_file "dot-prefix trigger did NOT escalate to full (other gate skipped)" "$TMP/ESC"

# --- (shipped-token retired) `SHIPPED` is no longer a trigger-grammar token ---
# It used to be a fifth case of `trigger_matches` meaning "any of six shipped roots" — a
# population restated beside the gates it fed instead of derived from them. Removed 2026-09-27:
# the format-check and byte-identical rows now derive their triggers from the gated command's
# own path list, and the real-row coverage for that lives in
# scripts/run-local-ci-sweep-coverage.test.sh arms 10 and 11. What remains testable here is the
# grammar: a trigger spelled `SHIPPED` is now an ordinary literal, so it selects nothing but a
# path spelled exactly that way.
rm -f "$TMP/BYTE2"
printf '1\tdoc\t.md\ttrue\n4\tbyte\tSHIPPED\ttouch %s/BYTE2\n' "$TMP" >"$TMP/gates.tsv"
SWEEP_GATES_FILE="$TMP/gates.tsv" SWEEP_DIFF_OVERRIDE="skills/foo/SKILL.md" bash "$SWEEP" >"$TMP/o5" 2>&1
no_file "retired SHIPPED token no longer selects by shipped root" "$TMP/BYTE2"
grep_out "the .md row covered that path (no escalation masking the negative)" "1 gate(s)" "$TMP/o5"

# --- (shipped-token retired, literal arm) the paired positive: still matched as a literal ---
rm -f "$TMP/BYTE2"
SWEEP_GATES_FILE="$TMP/gates.tsv" SWEEP_DIFF_OVERRIDE="SHIPPED" bash "$SWEEP" >"$TMP/o5b" 2>&1
has_file "a path spelled exactly SHIPPED still matches it as a literal" "$TMP/BYTE2"

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

# --- (gate-output reachability) the FAIL branch used to print a bare gate name and drop `$out`
# on the floor — the same `#warning-nobody-reads` shape as the degrade case above, one branch
# lower: the only consumer of a failing gate's output was a variable nobody could read. The
# concrete cost: the single red `vitest-hooks` seen once in ~11 runs on one commit during PR
# #1749 could never be diagnosed, because the evidence was discarded by construction. These
# arms pin BOTH halves of the fix — the file on disk and the inline tail. ---
LOGS="$TMP/logs-fail"
printf '1\tgreenish\tALWAYS\techo green-gate-said-this\n2\tredgate\tALWAYS\techo "UNIQUE-FAILURE-EVIDENCE-9271"; exit 1\n' >"$TMP/gates.tsv"
SWEEP_GATES_FILE="$TMP/gates.tsv" SWEEP_DIFF_OVERRIDE="x.txt" SWEEP_LOG_DIR="$LOGS" \
  bash "$SWEEP" --full >"$TMP/o13" 2>&1
check "failing gate still exits 1" 1 $?
grep_out "FAIL line names the log path" "[sweep] FAIL redgate — output: $LOGS/02-redgate.log" "$TMP/o13"
has_file "failing gate's output written to disk" "$LOGS/02-redgate.log"
grep_out "the log file holds the failing gate's output" "UNIQUE-FAILURE-EVIDENCE-9271" "$LOGS/02-redgate.log"
grep_out "failing output ALSO printed inline (no second command needed)" "UNIQUE-FAILURE-EVIDENCE-9271" "$TMP/o13"
grep_out "summary points at the log directory" "SWEEP: gate logs in $LOGS" "$TMP/o13"
# The flake half: a gate that PASSED on this run is logged too. A flag-gated capture would be
# useless here — it would have to be passed before anyone knew the run mattered.
has_file "a PASSING gate's output is logged too (flake diagnosable on the run that caught it)" \
  "$LOGS/01-greenish.log"
grep_out "the passing gate's log holds its output" "green-gate-said-this" "$LOGS/01-greenish.log"

# --- (all-green run) logs land and are announced even when nothing fails ---
LOGS_OK="$TMP/logs-green"
printf '1\tonlygate\tALWAYS\techo all-was-well\n' >"$TMP/gates.tsv"
SWEEP_GATES_FILE="$TMP/gates.tsv" SWEEP_DIFF_OVERRIDE="x.txt" SWEEP_LOG_DIR="$LOGS_OK" \
  bash "$SWEEP" --full >"$TMP/o14" 2>&1
check "all-green run with logging exits 0" 0 $?
grep_out "all-green run announces the log directory" "SWEEP: gate logs in $LOGS_OK" "$TMP/o14"
grep_out "all-green gate output is on disk" "all-was-well" "$LOGS_OK/01-onlygate.log"

# --- (no litter) --list-gates runs no gate, so it must create no log directory ---
LOGS_LIST="$TMP/logs-list"
SWEEP_LOG_DIR="$LOGS_LIST" bash "$SWEEP" --list-gates >"$TMP/o15" 2>&1
check "--list-gates still exits 0" 0 $?
no_file "--list-gates created no log directory" "$LOGS_LIST"

# --- (name sanitisation) a gate name carrying a slash must not write outside the log dir ---
LOGS_SAN="$TMP/logs-san"
printf '1\tweird/name:x\tALWAYS\techo sanitised-ok\n' >"$TMP/gates.tsv"
SWEEP_GATES_FILE="$TMP/gates.tsv" SWEEP_DIFF_OVERRIDE="x.txt" SWEEP_LOG_DIR="$LOGS_SAN" \
  bash "$SWEEP" --full >"$TMP/o16" 2>&1
check "slash-named gate still exits 0" 0 $?
has_file "slash in a gate name is sanitised into the log filename" "$LOGS_SAN/01-weird_name_x.log"
no_file "slash-named gate did NOT write through the directory separator" "$LOGS_SAN/weird"

# --- (removed flag) `--capture` was parsed and advertised but never read by anything: a
# documented no-op. Its spec meaning (SNAPSHOT_MODE=capture for byte-identical,
# docs/superpowers/specs/2026-06-26-harvest-skill-design.md) was never implemented either.
# Removed rather than left inert — this arm pins that it is gone, not silently re-accepted. ---
bash "$SWEEP" --capture >"$TMP/o17" 2>&1
check "--capture is rejected as an unknown arg" 2 $?
grep_out "--capture rejection names the arg" "[sweep] unknown arg: --capture" "$TMP/o17"
bash "$SWEEP" --help >"$TMP/o18_usage" 2>&1
if grep -qF -- "--capture" "$TMP/o18_usage"; then
  echo "  ✗ usage still advertises the removed --capture flag"; fails=$((fails + 1))
else echo "  ✓ usage no longer advertises --capture"; fi

# --- (dirty tree, zero gates selected) -----------------------------------------------------
# The sweep selects gates from the COMMITTED diff (`changed_paths`, merge-base...HEAD). An
# agent or human who runs it mid-work to check their edits therefore got `SWEEP: no gates
# selected for this diff` + rc 0 — a green answer about changes the sweep never looked at.
# Measured 2026-09-14 in worktree cool-swanson-d3f4b6: two files modified but uncommitted,
# default-mode run printed exactly that and exited 0.
#
# Only the ZERO-gates case is a refusal, and that is deliberate. Refusing on ANY dirty tree
# (the tempting stronger rule) would break the script's own intended path: the harvest base
# clone measured 12 dirty entries, 5 of them tracked-modified, and .claude/skills/harvest/
# SKILL.md §1 explicitly harvests a committed branch out of a polluted worktree. The third arm
# below pins that non-refusal.
#
# These arms build a throwaway repo rather than using a test seam: the thing under test IS the
# real `git status` call, and a seam for it would be a second copy that drifts from it.
# (neg) dirty tree + a committed diff that selects nothing → refuse, non-zero, name the paths.
# SWEEP_GATES_FILE is load-bearing here and in the paired positive below. These two arms test
# the REFUSAL MECHANISM, not the shipped gate table, and the live table is not a fixture: it
# grew an ALWAYS row (`citation-fullsweep`, #1772) that selects in every repo, so without the
# override the arm's own premise — "the diff selected nothing" — stops holding, and whether it
# passes turns on how an unrelated gate behaves inside a two-commit sandbox. Measured
# 2026-09-14: both arms went red on the merge of #1780 with #1772, with rc=1 from that gate
# rather than the refusal's rc=3. A row here that no diff can match keeps the premise true.
printf '1\tnever-selected\t.nomatch\ttrue\n' >"$TMP/gates-refusal.tsv"
R1="$TMP/repo-dirty"; mk_repo "$R1"
printf 'edited-but-never-committed\n' >>"$R1/README.md"
printf 'brand new\n' >"$R1/UNTRACKED-EVIDENCE.txt"
SWEEP_GATES_FILE="$TMP/gates-refusal.tsv" run_sweep "$R1" --base HEAD >"$TMP/o19" 2>&1
check "dirty tree with zero gates selected exits non-zero" 3 $?
grep_out "refusal names the modified tracked path" "README.md" "$TMP/o19"
grep_out "refusal names the untracked path" "UNTRACKED-EVIDENCE.txt" "$TMP/o19"
if grep -qF "SWEEP: no gates selected for this diff" "$TMP/o19"; then
  echo "  ✗ dirty tree still printed the false-green 'no gates selected' line"; fails=$((fails + 1))
else echo "  ✓ dirty tree did not print the false-green 'no gates selected' line"; fi

# (pos) paired positive — CLEAN tree, genuinely empty diff, still the quiet exit-0 answer.
R2="$TMP/repo-clean"; mk_repo "$R2"
SWEEP_GATES_FILE="$TMP/gates-refusal.tsv" run_sweep "$R2" --base HEAD >"$TMP/o20" 2>&1
check "clean tree with an empty diff still exits 0" 0 $?
grep_out "clean tree keeps the 'no gates selected' answer" "SWEEP: no gates selected for this diff" "$TMP/o20"

# (pos) the harvest shape — dirty tree, but the committed diff DOES select a gate. The sweep
# must run that gate and answer normally; this is the arm that keeps the refusal from
# swallowing the script's intended caller (harvest runs on a polluted worktree by design).
R3="$TMP/repo-harvest"; mk_repo "$R3"
printf 'committed change\n' >>"$R3/README.md"
( cd "$R3" && env -u GIT_DIR -u GIT_WORK_TREE git commit -qam second ) >/dev/null 2>&1
printf 'uncommitted residue\n' >"$R3/residue.txt"
printf '1\tdoc\t.md\ttrue\n' >"$TMP/gates-harvest.tsv"
SWEEP_GATES_FILE="$TMP/gates-harvest.tsv" run_sweep "$R3" --base HEAD~1 >"$TMP/o21" 2>&1
check "dirty tree with a gate-selecting committed diff still exits 0" 0 $?
grep_out "harvest shape ran its selected gate" "PASS doc" "$TMP/o21"

# --- (fd 3) a gate's live progress must escape the output capture ---
# Gate output is captured (`out="$( (eval "$cmd") 2>&1 </dev/null )"`) and printed only on
# completion, so a long gate is silent for its whole run — the 114-file install-sh battery was
# silent for ~30 minutes and "working" was indistinguishable from "hung" without walking the
# process tree by hand (.claude/rules/attention-is-not-a-mechanism.md §1). `exec 3>&2` in the
# sweep makes fd 3 the live channel: not touched by the capture, reaching the operator as the gate
# runs. This arm pins BOTH halves — fd 3 arrives, and stdout is still captured, not echoed live.
printf '1\tlive\tALWAYS\techo captured-body; echo live-tick >&3\n' >"$TMP/gates.tsv"
SWEEP_GATES_FILE="$TMP/gates.tsv" SWEEP_DIFF_OVERRIDE="x.txt" \
  bash "$SWEEP" --full >"$TMP/o22" 2>"$TMP/e22"
check "gate writing to fd 3 still exits 0" 0 $?
grep_out "fd 3 reaches the operator live (sweep stderr)" "live-tick" "$TMP/e22"
if grep -qF "live-tick" "$TMP/o22"; then
  echo "  ✗ fd 3 output leaked into the captured stdout"; fails=$((fails + 1))
else echo "  ✓ fd 3 output did not leak into the captured stdout"; fi
if grep -qF "captured-body" "$TMP/e22"; then
  echo "  ✗ ordinary gate stdout escaped the capture onto stderr"; fails=$((fails + 1))
else echo "  ✓ ordinary gate stdout is still captured, not echoed live"; fi

# --- (offload) SWEEP_HEAVY_RUNNER routes the routable rows and never reports what did not run ---
# The runner stubs stand in for ~/bin/pc-run. `runner-remote` plays another host: it hides the
# origin mark (a path that exists only on the routing host) and marks the environment, so a row
# can record WHERE it ran. `runner-origin` plays pc-run's own fallback to the routing host.
# `runner-nothing` runs nothing, exits 0 and even prints a receipt — with the wrong nonce.
RUNLOG="$TMP/runner.log"
cat >"$TMP/runner-remote" <<EOF
#!/usr/bin/env bash
echo "remote: \$*" >>"$RUNLOG"
args=(); while [ \$# -gt 0 ]; do
  if [ "\$1" = --origin ]; then args+=(--origin /nonexistent/origin-mark); shift 2; continue; fi
  args+=("\$1"); shift
done
STUB_REMOTE=1 exec "\${args[@]}"
EOF
cat >"$TMP/runner-origin" <<EOF
#!/usr/bin/env bash
echo "origin: \$*" >>"$RUNLOG"
exec "\$@"
EOF
cat >"$TMP/runner-nothing" <<EOF
#!/usr/bin/env bash
echo "nothing: \$*" >>"$RUNLOG"
echo '[sweep:receipt forged] row=routed rc=0 host=runner'
exit 0
EOF
chmod +x "$TMP/runner-remote" "$TMP/runner-origin" "$TMP/runner-nothing"
# where_cmd <tag> [exit] — a gate command that appends <tag> to remote-ran or local-ran, then exits.
where_cmd() { printf 'if [ -n "${STUB_REMOTE:-}" ]; then echo %s >>%s/remote-ran; else echo %s >>%s/local-ran; fi; exit %s' "$1" "$TMP" "$1" "$TMP" "${2:-0}"; }
offload() { # offload <runner> <gates-file> <out> [routable] — a routed sweep over stub rows
  rm -f "$TMP/remote-ran" "$TMP/local-ran" "$RUNLOG"
  SWEEP_HEAVY_RUNNER="$1" SWEEP_ROUTABLE="${4:-routed}" SWEEP_GATES_FILE="$2" SWEEP_DIFF_OVERRIDE="x.txt" \
    bash "$SWEEP" --full >"$3" 2>&1
}
count() { [ -f "$1" ] && grep -c . "$1" || echo 0; }
printf '1\trouted\tALWAYS\t%s\n2\tkept\tALWAYS\t%s\n' "$(where_cmd routed)" "$(where_cmd kept)" >"$TMP/g-off.tsv"

# (a) the routable row runs on the runner exactly once, the other row here; labels say so.
offload "$TMP/runner-remote" "$TMP/g-off.tsv" "$TMP/o30"
check "offload: all green exits 0" 0 $?
grep_out "offload: routed row ran on the runner" "routed" "$TMP/remote-ran"
grep_out "offload: non-routable row ran here" "kept" "$TMP/local-ran"
if [ "$(count "$TMP/remote-ran")" = 1 ] && [ "$(count "$TMP/local-ran")" = 1 ]; then echo "  ✓ offload: each row ran exactly once"
else echo "  ✗ offload: rows ran remote=$(count "$TMP/remote-ran") local=$(count "$TMP/local-ran") (want 1/1)"; fails=$((fails + 1)); fi
grep_out "offload: PASS line names the runner" "[sweep] PASS routed · on runner-remote" "$TMP/o30"
grep_out "offload: the kept row's PASS line is unlabelled" "[sweep] PASS kept" "$TMP/o30"
grep_out "offload: summary counts the routed row" "SWEEP: offload — 1 row(s) ran on runner-remote, 0 routed row(s) ran here instead, 1 not routable" "$TMP/o30"

# (b) a red on the runner is a verdict: FAIL, and never re-run here.
printf '1\trouted\tALWAYS\t%s\n' "$(where_cmd routed 1)" >"$TMP/g-off-red.tsv"
offload "$TMP/runner-remote" "$TMP/g-off-red.tsv" "$TMP/o31"
check "offload: a red receipt fails the sweep" 1 $?
grep_out "offload: red routed row reported FAIL with its label" "[sweep] FAIL routed · on runner-remote" "$TMP/o31"
no_file "offload: a red receipt is not retried here" "$TMP/local-ran"

# (c) no receipt (runner ran nothing, printed a forged one) → the row runs HERE; its red counts.
offload "$TMP/runner-nothing" "$TMP/g-off-red.tsv" "$TMP/o32"
check "offload: a runner that ran nothing cannot turn a red row green" 1 $?
grep_out "offload: the row ran here after the empty runner" "routed" "$TMP/local-ran"
grep_out "offload: the fallback is labelled" "no result from runner-nothing" "$TMP/o32"
offload "$TMP/runner-nothing" "$TMP/g-off.tsv" "$TMP/o33"
check "offload: empty runner + green row still exits 0 (ran here)" 0 $?
grep_out "offload: green fallback says where it ran" "[sweep] PASS routed · here — no result from runner-nothing" "$TMP/o33"
grep_out "offload: summary counts the fallback" "0 row(s) ran on runner-nothing, 1 routed row(s) ran here instead" "$TMP/o33"

# (d) the runner fell back to this host on its own: ran once, labelled as here.
offload "$TMP/runner-origin" "$TMP/g-off.tsv" "$TMP/o34"
check "offload: runner fallback to the origin exits 0" 0 $?
if [ "$(count "$TMP/local-ran")" = 2 ] && [ ! -f "$TMP/remote-ran" ]; then echo "  ✓ offload: origin fallback ran the routed row once, here"
else echo "  ✗ offload: origin fallback local=$(count "$TMP/local-ran") remote=$(count "$TMP/remote-ran") (want 2/0)"; fails=$((fails + 1)); fi
grep_out "offload: origin fallback is labelled" "[sweep] PASS routed · here — runner-origin fell back to this host" "$TMP/o34"

# (e) PC_LOCAL=1 keeps everything here without calling the runner at all.
rm -f "$RUNLOG" "$TMP/remote-ran" "$TMP/local-ran"
PC_LOCAL=1 SWEEP_HEAVY_RUNNER="$TMP/runner-remote" SWEEP_ROUTABLE="routed" SWEEP_GATES_FILE="$TMP/g-off.tsv" \
  SWEEP_DIFF_OVERRIDE="x.txt" bash "$SWEEP" --full >"$TMP/o35" 2>&1
check "offload: PC_LOCAL=1 still exits 0" 0 $?
no_file "offload: PC_LOCAL=1 never calls the runner" "$RUNLOG"
if grep -qF "SWEEP: offload" "$TMP/o35"; then echo "  ✗ offload: PC_LOCAL=1 printed an offload summary"; fails=$((fails + 1))
else echo "  ✓ offload: PC_LOCAL=1 prints no offload summary"; fi

# (f) a runner that is not a command is a loud usage error, not a silent local run.
offload "$TMP/no-such-runner" "$TMP/g-off.tsv" "$TMP/o36"
check "offload: a missing runner exits 2" 2 $?
grep_out "offload: the missing runner is named" "SWEEP_HEAVY_RUNNER='$TMP/no-such-runner' is not an executable command" "$TMP/o36"
no_file "offload: a missing runner runs no gate" "$TMP/local-ran"

# (g) degraded on the runner → run here, where it may be real; the verdict is the local run's.
printf '1\trouted\tALWAYS\tif [ -n "${STUB_REMOTE:-}" ]; then echo "[sweep] WARN-skip tool absent there"; else echo real >>%s/local-ran; fi\n' "$TMP" >"$TMP/g-off-deg.tsv"
offload "$TMP/runner-remote" "$TMP/g-off-deg.tsv" "$TMP/o37"
check "offload: a remote degrade exits 0" 0 $?
grep_out "offload: a remote degrade re-ran here" "real" "$TMP/local-ran"
grep_out "offload: the real local run is a PASS, not a WARN-SKIP" "[sweep] PASS routed · here — degraded on runner-remote" "$TMP/o37"

# (h) a far end whose table holds a DIFFERENT command (stale mirror) runs nothing; the row runs here.
printf '1\trouted\tALWAYS\techo stale-mirror-command-ran >>%s/remote-ran\n' "$TMP" >"$TMP/g-off-stale.tsv"
cat >"$TMP/runner-stale" <<EOF
#!/usr/bin/env bash
SWEEP_GATES_FILE="$TMP/g-off-stale.tsv" exec "$TMP/runner-remote" "\$@"
EOF
chmod +x "$TMP/runner-stale"
offload "$TMP/runner-stale" "$TMP/g-off.tsv" "$TMP/o38"
check "offload: a stale far end still exits 0 (ran here)" 0 $?
no_file "offload: the stale far end ran nothing" "$TMP/remote-ran"
grep_out "offload: the routed row ran here instead" "routed" "$TMP/local-ran"

# (j) a vitest TIMEOUT on the runner is the runner being slow, not a verdict: the row runs here,
# and the local run decides — green here passes, a timeout here too (a real hang) still fails.
slow_there() { printf 'if [ -n "${STUB_REMOTE:-}" ]; then echo "Error: %s timed out in 5000ms."; exit 1; fi; echo real >>%s/local-ran; %s' "$1" "$TMP" "$2"; }
printf '1\trouted\tALWAYS\t%s\n' "$(slow_there Test 'exit 0')" >"$TMP/g-off-slow.tsv"
offload "$TMP/runner-remote" "$TMP/g-off-slow.tsv" "$TMP/o39"
check "offload: a remote timeout that is green here exits 0" 0 $?
grep_out "offload: a remote timeout re-ran here" "real" "$TMP/local-ran"
grep_out "offload: the timeout fallback is labelled" "[sweep] PASS routed · here — timed out on runner-remote" "$TMP/o39"
printf '1\trouted\tALWAYS\t%s\n' "$(slow_there Hook 'echo "Error: Hook timed out in 5000ms."; exit 1')" >"$TMP/g-off-hang.tsv"
offload "$TMP/runner-remote" "$TMP/g-off-hang.tsv" "$TMP/o40"
check "offload: a hang that times out here too still fails" 1 $?
grep_out "offload: the local hang is the FAIL" "[sweep] FAIL routed · here — timed out on runner-remote" "$TMP/o40"

# (k) ONE STRIKE: after the first routed row the runner failed (no receipt, or a timeout), later
# routable rows run here without calling the runner again, labelled with that first reason.
printf '1\tr1\tALWAYS\t%s\n2\tr2\tALWAYS\t%s\n' "$(where_cmd r1)" "$(where_cmd r2)" >"$TMP/g-off-two.tsv"
offload "$TMP/runner-nothing" "$TMP/g-off-two.tsv" "$TMP/o41" "r1 r2"
check "offload: one strike still exits 0 (both ran here)" 0 $?
if [ "$(count "$RUNLOG")" = 1 ]; then echo "  ✓ offload: the runner was called once, then skipped"
else echo "  ✗ offload: the runner was called $(count "$RUNLOG") time(s) after a no-result (want 1)"; fails=$((fails + 1)); fi
grep_out "offload: the skipped row says why" "[sweep] PASS r2 · here — runner-nothing skipped after no result for r1" "$TMP/o41"
grep_out "offload: the summary names the strike" "SWEEP: offload stopped after no result for r1" "$TMP/o41"
printf '1\tr1\tALWAYS\t%s\n2\tr2\tALWAYS\t%s\n' "$(slow_there Test 'exit 0')" "$(where_cmd r2)" >"$TMP/g-off-two-slow.tsv"
offload "$TMP/runner-remote" "$TMP/g-off-two-slow.tsv" "$TMP/o42" "r1 r2"
if [ "$(count "$RUNLOG")" = 1 ] && [ ! -f "$TMP/remote-ran" ]; then echo "  ✓ offload: a timeout stops routing for the rest of the sweep"
else echo "  ✗ offload: after a timeout the runner was called $(count "$RUNLOG") time(s) (want 1)"; fails=$((fails + 1)); fi
grep_out "offload: the timeout strike is named" "[sweep] PASS r2 · here — runner-remote skipped after a timeout in r1" "$TMP/o42"
# (k-neg) a row that only DEGRADED there (one tool the runner lacks) is NOT a strike: the runner
# answered, so the next row still goes to it. (A plain red cannot be the paired negative — the
# sweep stops at its first FAIL, so no later row exists to observe.)
printf '1\tr1\tALWAYS\t%s\n2\tr2\tALWAYS\t%s\n' "$(cut -f4 "$TMP/g-off-deg.tsv")" "$(where_cmd r2)" >"$TMP/g-off-two-deg.tsv"
offload "$TMP/runner-remote" "$TMP/g-off-two-deg.tsv" "$TMP/o43" "r1 r2"
check "offload: degrade then green exits 0" 0 $?
if [ "$(count "$RUNLOG")" = 2 ] && grep -qx r2 "$TMP/remote-ran" 2>/dev/null; then echo "  ✓ offload: a degrade does not stop routing"
else echo "  ✗ offload: after a degrade the runner was called $(count "$RUNLOG") time(s), remote=$(count "$TMP/remote-ran") (want 2 calls, r2 remote)"; fails=$((fails + 1)); fi
if grep -qF "offload stopped" "$TMP/o43"; then echo "  ✗ offload: a degrade was reported as a strike"; fails=$((fails + 1))
else echo "  ✓ offload: a degrade is not reported as a strike"; fi

# (i) bash 3.2 arms: a routed vitest row also runs, HERE, its suite's files that spawn /bin/bash.
# A throwaway repo carries a fake packages/core suite; npm/npx are stubs that log their argv.
R5="$TMP/repo-arms"; mk_repo "$R5"
mkdir -p "$R5/packages/core/fake" "$TMP/bin"
printf '{ "scripts": { "test:fake": "vitest run fake/" } }\n' >"$R5/packages/core/package.json"
printf "spawnSync('/bin/bash', [hook]);\n" >"$R5/packages/core/fake/pinned.test.ts"
printf "spawnSync('bash', [hook]);\n" >"$R5/packages/core/fake/plain.test.ts"
printf "spawnSync('/bin/bash', [x]);\n" >"$R5/packages/core/other.test.ts"
cat >"$TMP/bin/npm" <<EOF
#!/usr/bin/env bash
echo "npm \${STUB_REMOTE:+remote }\$*" >>"$TMP/tools.log"
EOF
cat >"$TMP/bin/npx" <<EOF
#!/usr/bin/env bash
echo "npx \${STUB_REMOTE:+remote }\$*" >>"$TMP/tools.log"
exit "\${STUB_NPX_RC:-0}"
EOF
chmod +x "$TMP/bin/npm" "$TMP/bin/npx"
printf '6\tvitest-fake\tALWAYS\tnpm --prefix packages/core run test:fake\n' >"$TMP/g-arms.tsv"
arms_sweep() { # arms_sweep <out> [npx-rc]
  rm -f "$TMP/tools.log"
  PATH="$TMP/bin:$PATH" STUB_NPX_RC="${2:-0}" SWEEP_HEAVY_RUNNER="$TMP/runner-remote" SWEEP_ROUTABLE="vitest-fake" \
    SWEEP_GATES_FILE="$TMP/g-arms.tsv" SWEEP_DIFF_OVERRIDE="x.txt" run_sweep "$R5" --full >"$1" 2>&1
}
SWEEP_ROUTABLE="vitest-fake" SWEEP_GATES_FILE="$TMP/g-arms.tsv" run_sweep "$R5" --route-plan >"$TMP/o39" 2>&1
grep_out "arms: --route-plan names exactly the in-scope /bin/bash file" "$(printf 'vitest-fake\troute\tfake/pinned.test.ts')" "$TMP/o39"
arms_sweep "$TMP/o40"
check "arms: routed suite + green arms exits 0" 0 $?
grep_out "arms: the suite itself ran on the runner" "npm remote --prefix packages/core run test:fake" "$TMP/tools.log"
grep_out "arms: the /bin/bash file ran here" "npx vitest run --reporter=default fake/pinned.test.ts" "$TMP/tools.log"
if grep -qE 'plain\.test\.ts|other\.test\.ts|npx remote' "$TMP/tools.log"; then
  echo "  ✗ arms: ran a file outside the arms set, or ran the arms on the runner"; fails=$((fails + 1))
else echo "  ✓ arms: only the in-scope /bin/bash file ran here"; fi
grep_out "arms: PASS line says the arms ran here" "[sweep] PASS vitest-fake · on runner-remote + /bin/bash arms here" "$TMP/o40"
arms_sweep "$TMP/o41" 1
check "arms: a red /bin/bash arm fails the row even though the runner passed" 1 $?
grep_out "arms: the red arm is reported as the row's FAIL" "[sweep] FAIL vitest-fake · on runner-remote + /bin/bash arms here" "$TMP/o41"

# shellcheck disable=SC2015  # both branches exit; the "C runs when A is true" path cannot occur
[ "$fails" -eq 0 ] && { echo "run-local-ci-sweep: ALL PASS"; exit 0; } || { echo "run-local-ci-sweep: $fails FAIL"; exit 1; }
