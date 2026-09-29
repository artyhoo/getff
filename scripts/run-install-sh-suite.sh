#!/usr/bin/env bash
# run-install-sh-suite.sh — run the tests/install-sh battery with bounded parallelism.
#
# WHY THIS FILE EXISTS
# CI runs this battery split across three jobs on three SEPARATE runners
# (`install-sh-a/b/c`, .github/workflows/audit-self.yml) — 113 individual `run:` steps plus the
# meta-gate. `scripts/run-local-ci-sweep.sh` mirrored that battery as a strictly serial
# `for t in tests/install-sh/*.test.sh; do ... done`, so the local mirror never inherited any of
# the parallelism: 114 files x ~15s = ~30 minutes on ONE core of a 12-core machine. Two
# implementations of one gate that drifted — `#sync-by-copy-paste`
# (.claude/rules/dual-implementation-discipline.md §8).
#
# The consequence is not cosmetic. The sweep is what the operator must run before every push, and
# a 30-minute gate is a gate people start skipping — which degrades it into `#hope-as-gate`
# (.claude/rules/attention-is-not-a-mechanism.md §2).
#
# WHY NOT MIRROR CI'S THREE-SHARD SPLIT INSTEAD
# CI's parallelism is across MACHINES: each shard gets its own runner, its own checkout, its own
# filesystem, and runs its own tests serially. Reproducing that shape locally would cap the local
# run at 3x on a 12-core box AND would still put the shards on ONE shared filesystem — which is
# precisely the condition CI's isolation makes safe and a local run does not. The divergence
# between CI's shape and this one is therefore deliberate, not a defect to reconcile.
#
# THE QUARANTINE (the reason this is not a bare `xargs -P` over the glob)
# Exactly one test in the battery mutates TRACKED repository files in place — see
# QUARANTINE_SERIAL below. Everything else installs into its own `mktemp -d` fixture. That one
# test must never run concurrently with anything, so it runs alone, first, before the pool opens.
#
# USAGE
#   bash scripts/run-install-sh-suite.sh [tests/install-sh/]
#   INSTALL_SH_JOBS=4 bash scripts/run-install-sh-suite.sh    # override the concurrency bound
#   INSTALL_SH_HEAVY_RUNNER=<cmd> bash scripts/run-install-sh-suite.sh   # offload — see OFFLOAD below
#
# PROGRESS OUTPUT — see progress() below for why it goes to fd 3.
set -uo pipefail

REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
SELF="$REPO_ROOT/scripts/run-install-sh-suite.sh"
SUITE_DIR="${INSTALL_SH_SUITE_DIR:-$REPO_ROOT/tests/install-sh}"

# ── Quarantine: tests that may not run concurrently with anything ──────────────────────────────
# `gh-531-shipped-prettier.test.sh` Arm 12 plants drift into TWO tracked files and restores them:
#   - packages/runtime-bridge/src/idempotency.ts        (perl -pi at :459 and :468, restored :464/:477)
#   - packages/runtime-bridge/vendor/hooks/runtime-bridge-dispatch.sh (printf >> at :486, restored :496)
# That is load-bearing for those arms — they prove the vendor-parity check is non-vacuous against
# the REAL tracked tree — so the fix is quarantine, not rewriting the test onto a clone (a clone
# would change what the arms assert).
#
# The blast radius is real, not theoretical: `setup.d/55-runtime-bridge-vendor.sh:73-76` copies
# `packages/runtime-bridge/vendor/` — including that dispatch hook — into every installed project.
# 158 lines across this battery run a real `install.sh`. Any of them overlapping the mutation
# window would install the DRIFTED hook; `byte-identical.test.sh` fingerprints the whole installed
# tree against saved baselines, so it would go RED at random. `delivered-prettier-conformance.sh`
# runs `format-shipped.sh --check` over the repo and would see the planted drift directly.
#
# To add an entry: append the basename, with the file:line of the shared state it touches.
#
# INSTALL_SH_QUARANTINE is a TEST SEAM (mirrors run-local-ci-sweep.sh's own SWEEP_GATES_FILE
# convention, never set in a real run): scripts/run-install-sh-suite.test.sh empties it to prove
# the quarantine arm is non-vacuous — with the list empty the same fixtures must go RED.
QUARANTINE_SERIAL="${INSTALL_SH_QUARANTINE-gh-531-shipped-prettier.test.sh}"

# ── Concurrency bound ──────────────────────────────────────────────────────────────────────────
# Default = core count, capped at 12. The battery is dominated by `install.sh` laying a 1078-file
# manifest into a fresh `git init` directory — I/O-bound with node (eslint/prettier/stryker)
# spikes on ~19 files that shell out to npm/npx. An unbounded fan-out of 114 concurrent full
# installs would thrash both the page cache and the shared `~/.npm` cache for no throughput gain,
# so the pool is bounded rather than one-process-per-file.
detect_jobs() {
  if [ -n "${INSTALL_SH_JOBS:-}" ]; then echo "$INSTALL_SH_JOBS"; return; fi
  n=$( { sysctl -n hw.ncpu || nproc || getconf _NPROCESSORS_ONLN; } 2>/dev/null | head -1 )
  case "$n" in ''|*[!0-9]*) n=4 ;; esac
  [ "$n" -gt 12 ] && n=12
  [ "$n" -lt 1 ] && n=1
  echo "$n"
}

# ── Progress channel ───────────────────────────────────────────────────────────────────────────
# `run-local-ci-sweep.sh` runs each gate as `out="$( (eval "$cmd") 2>&1 </dev/null )"` — stdout AND
# stderr are captured into a shell variable and printed only when the gate COMPLETES. So for half
# an hour the sweep emitted nothing and a working battery was indistinguishable from a hung one;
# proving liveness meant walking the process tree with `pgrep -P` by hand. A mechanism whose state
# is recovered by human attention is the shape .claude/rules/attention-is-not-a-mechanism.md §1
# forbids, so progress needs a channel the capture does not swallow.
#
# The sweep now opens fd 3 onto its own stderr and documents it as the live progress channel. Here
# we use fd 3 when it is open and fall back to stderr when it is not (a direct
# `bash scripts/run-install-sh-suite.sh` from a shell or a CI step, where nothing is capturing).
if { true >&3; } 2>/dev/null; then PROGRESS_FD=3; else PROGRESS_FD=2; fi
# No error suppression here, deliberately. `2>/dev/null` on this line competes for stderr when
# $PROGRESS_FD is 2 (shellcheck SC2261); wrapping the printf in a brace group to satisfy that
# instead redirects the group's OWN fd 2 first, so the stderr fallback wrote to /dev/null and the
# counter vanished in exactly the case it exists for — caught by the fd3-closed arm in
# scripts/run-install-sh-suite.test.sh. Suppression is not needed: PROGRESS_FD is either 3, which
# was probed open above, or 2, which always is.
progress() { printf '%s\n' "$*" >&"$PROGRESS_FD"; }

# ── OFFLOAD (opt-in, machine-local) ────────────────────────────────────────────────────────────
# The battery is the heaviest thing the operator's Mac runs: ~20 parallel sessions each fanning out
# 12 full installs put 62 `*.test.sh` processes and 34 eslint children on it at once (load 49-61,
# measured 2026-09-28). INSTALL_SH_HEAVY_RUNNER names an executable that takes a command line and
# runs it elsewhere against a mirror of this repo, exiting with the command's real code — the same
# contract as PREPUSH_HEAVY_RUNNER in packages/core/hooks/pre-push.ts (PR #1886). Unset or empty →
# nothing changes, so CI and every other checkout never see a difference.
#
# Set → the battery splits in two:
#   - tests carrying a `# stays-local: <reason>` line run HERE, in the pool below. The header marks
#     the macOS signal a Linux host cannot give: CI runs this battery on ubuntu only, so the Mac is
#     the one place install.sh meets bash 3.2 and BSD userland, and a test that exists to catch a
#     bash-3.2 or BSD-awk defect (or needs a Mac-only tool such as brew) is worthless on the PC.
#     Same idea as Bazel's per-target `no-remote-exec` tag (prior-art-evaluations.md#290).
#   - everything else goes through ONE runner call, `bash scripts/run-install-sh-suite.sh --routed
#     <suite>`, started in the background once the quarantine has finished, so both halves overlap.
#     argv is relative to the repo root: a runner that re-roots the cwd onto a mirror cannot
#     translate an absolute path.
#
# The routed half only counts when its own output says it ran exactly the tests routed from
# here — a runner that exits 0 without running anything, or ran a different set, is a failure,
# never a green (see collect_routed below).
#
# PC_LOCAL=1 is the escape the only runner in use (the operator's ~/bin/pc-run) already defines.
# The runner honours it by running the routed half locally, which would open a SECOND local pool
# next to this one; honouring it here as well keeps an escaped run identical to an unrouted one.
# Since 2026-09-29 the runner honours it only together with PC_LOCAL_WHY of 20+ characters (a bare
# flag is logged there and ignored: one day of sessions forced 912 runs onto the Mac by habit), so
# pc_local_escape applies the same predicate — a bare flag here would skip the runner and its log.
# A runner can also fall back to running here on its own (host unreachable, lock timeout). The
# far end detects that through `--origin <path>`: a file in this run's work directory, which exists
# only on this host. Found → it runs nothing and says so, and this pool takes the routed tests
# after its own — never two full pools on one machine.
RUNNER="${INSTALL_SH_HEAVY_RUNNER:-}"
# The marker is read from the header only (it sits on line 2), so a test that merely mentions it
# stays routable. ~/bin/pc-run-bash on the operator's Mac reads it with this same awk.
stays_local() { awk 'NR > 5 { exit } /^# stays-local:/ { f = 1; exit } END { exit !f }' "$1"; }
# The quarantined test is kept here whatever its header says: it must finish before the routed
# half starts (see the quarantine below), and a runner's host must never run it next to others.
quarantined() { case " $QUARANTINE_SERIAL " in *" $(basename "$1") "*) return 0 ;; esac; return 1; }
# The runner's escape predicate (see PC_LOCAL above): the flag plus a reason of 20+ characters once
# whitespace is squeezed and trimmed — the same normalisation ~/bin/pc-run applies before it counts.
pc_local_escape() {
  [ -n "${PC_LOCAL:-}" ] || return 1
  local why
  why=$(printf '%s' "${PC_LOCAL_WHY:-}" | tr -s '[:space:]' ' ' | sed 's/^ //; s/ $//')
  [ "${#why}" -ge 20 ]
}

# ── Worker mode ────────────────────────────────────────────────────────────────────────────────
# Re-entrant: `xargs -P` invokes this script with `--one` per test file. Each worker writes its
# whole output to its OWN file and never to stdout, so concurrent tests cannot interleave into
# unreadable mush — the parent replays the files sequentially at the end, in sorted order.
#
# The `.rc` file is the completion receipt. The parent treats a MISSING receipt as a failure: a
# worker killed by the OOM killer or a `kill` would otherwise contribute nothing to the tally and
# the suite would report a green it never earned. `xargs`'s own exit status is not trusted for
# this (BSD and GNU xargs disagree on the code, and neither says WHICH child failed).
if [ "${1:-}" = "--one" ]; then
  _t="$2"; _work="$3"; _total="$4"; _label="${5:-install-sh}"
  _safe=$(basename "$_t")
  /bin/bash "$_t" > "$_work/out/$_safe" 2>&1 </dev/null
  _rc=$?
  printf '%s\n' "$_rc" > "$_work/rc/$_safe"
  # Claim a COMPLETION ordinal. `mkdir` is atomic and fails if the name exists, so the first
  # directory a worker can create is an ordinal no other worker holds — a race-free counter with
  # no lock file. `wc -l` over an append-log was tried first and printed duplicate numbers
  # ("4/5" twice, then "5/5" three times): two workers that appended before either read back both
  # saw the same total. A progress counter that visibly skips and repeats is worse than none —
  # its whole job is to answer "is this hung?", and a reader who has learned not to trust it is
  # back to walking the process tree by hand.
  _n=1
  while ! mkdir "$_work/seq/$_n" 2>/dev/null; do _n=$((_n + 1)); done
  if [ "$_rc" -eq 0 ]; then _mark="ok"; else _mark="FAIL"; fi
  progress "[${_label}] ${_n}/${_total} done · ${_safe} (${_mark})"
  exit 0   # the receipt carries the verdict; a non-zero here would only abort the pool early
fi

# ── Main ───────────────────────────────────────────────────────────────────────────────────────
# `--routed` is the far end of OFFLOAD: run only the tests WITHOUT a `# stays-local:` line, and
# never route again (a runner that simply execs its argv inherits INSTALL_SH_HEAVY_RUNNER).
ROUTED_MODE=0
ORIGIN=""
if [ "${1:-}" = "--routed" ]; then ROUTED_MODE=1; shift; fi
if [ "$ROUTED_MODE" -eq 1 ] && [ "${1:-}" = "--origin" ]; then ORIGIN="${2:-}"; shift 2; fi
LABEL="install-sh"
[ "$ROUTED_MODE" -eq 1 ] && LABEL="install-sh:routed"
if [ -n "$ORIGIN" ] && [ -e "$ORIGIN" ]; then
  # The runner ran us on the host that routed us (its own local fallback). Running the list here
  # would put a second full pool next to the origin's; the origin runs it in its own pool instead.
  echo "[install-sh:routed] ON-ORIGIN: the runner ran the routed half on the routing host; nothing run"
  exit 97
fi

# The optional positional argument is the suite directory. It exists so the sweep's gate-table row
# can name `tests/install-sh/` literally: scripts/run-local-ci-sweep-coverage.test.sh requires the
# covering row for the `tests/install-sh/*.test.sh` battery family to contain that substring
# (battery_families(), scripts/run-local-ci-sweep-coverage.test.sh:90).
case "${1:-}" in
  "") : ;;
  /*) SUITE_DIR="$1" ;;
  *)  SUITE_DIR="$REPO_ROOT/$1" ;;
esac
SUITE_DIR="${SUITE_DIR%/}"

# `find`, not `ls` (shellcheck SC2012) — and -maxdepth 1 so a fixture directory such as
# tests/install-sh/baselines/ can never pull extra files into the battery.
ALL=$(find "$SUITE_DIR" -maxdepth 1 -type f -name '*.test.sh' 2>/dev/null | sort)
if [ -z "$ALL" ]; then
  echo "run-install-sh-suite: no *.test.sh under $SUITE_DIR — the glob broke, refusing to report a green" >&2
  exit 1
fi
TOTAL=$(printf '%s\n' "$ALL" | wc -l | tr -d ' ')

# ── Split for OFFLOAD ──────────────────────────────────────────────────────────────────────────
# LOCAL = what runs in this process's pool; ROUTE_LIST = what the runner gets. Unrouted, LOCAL is ALL.
LOCAL="$ALL"
ROUTE_LIST=""
ROUTE_N=0
SUITE_REL=""
if [ "$ROUTED_MODE" -eq 1 ] || { [ -n "$RUNNER" ] && ! pc_local_escape; }; then
  KEEP=""
  while IFS= read -r t; do
    [ -z "$t" ] && continue
    if stays_local "$t" || quarantined "$t"; then KEEP="$KEEP$t
"; else ROUTE_LIST="$ROUTE_LIST$t
"; fi
  done <<EOF2
$ALL
EOF2
  if [ "$ROUTED_MODE" -eq 1 ]; then
    LOCAL="$ROUTE_LIST"; ROUTE_LIST=""
    if [ -z "$LOCAL" ]; then
      echo "run-install-sh-suite --routed: every test under $SUITE_DIR stays local — nothing to run, refusing to report a green" >&2
      exit 1
    fi
    TOTAL=$(printf '%s' "$LOCAL" | grep -c .)
  else
    case "$SUITE_DIR/" in "$REPO_ROOT"/*) SUITE_REL="${SUITE_DIR#"$REPO_ROOT"/}" ;; esac
    if ! command -v "$RUNNER" >/dev/null 2>&1; then
      echo "run-install-sh-suite: INSTALL_SH_HEAVY_RUNNER='$RUNNER' is not an executable command." >&2
      echo "   Fix the path, or unset INSTALL_SH_HEAVY_RUNNER to run the whole battery here." >&2
      exit 1
    elif [ -z "$SUITE_REL" ]; then
      # The runner re-roots the repo, so it can only reach a suite inside it.
      progress "[install-sh] suite $SUITE_DIR is outside $REPO_ROOT — not routed, running it all here"
      ROUTE_LIST=""
    elif [ -n "$ROUTE_LIST" ]; then
      LOCAL="$KEEP"
      ROUTE_N=$(printf '%s' "$ROUTE_LIST" | grep -c .)
    fi
  fi
fi
LOCAL_N=$(printf '%s' "$LOCAL" | grep -c .)
JOBS=$(detect_jobs)

WORK=$(mktemp -d "${TMPDIR:-/tmp}/install-sh-suite.XXXXXX") || {
  echo "run-install-sh-suite: cannot create a work directory" >&2; exit 1; }
mkdir -p "$WORK/out" "$WORK/rc" "$WORK/seq"
ROUTED_PID=""
trap '[ -n "$ROUTED_PID" ] && kill "$ROUTED_PID" 2>/dev/null; rm -rf "$WORK"' EXIT INT TERM

START=$(date +%s)

# Quarantine first, alone. First (not last) so that if it leaves the tree dirty after a crash, the
# pool's repo reads fail loudly in the same run rather than in the next one. It also runs before
# the routed half starts: a runner that pushes the working tree to a mirror must not copy it
# while the quarantined test has drift planted in it.
SERIAL_LIST=""
POOL_LIST=""
while IFS= read -r t; do
  [ -z "$t" ] && continue
  if quarantined "$t"; then SERIAL_LIST="$SERIAL_LIST$t
"; else POOL_LIST="$POOL_LIST$t
"; fi
done <<EOF2
$LOCAL
EOF2

SERIAL_N=$(printf '%s' "$SERIAL_LIST" | grep -c . | tr -d ' ')
if [ "$ROUTE_N" -gt 0 ]; then
  progress "[install-sh] ${TOTAL} test files · ${LOCAL_N} here (${JOBS} parallel · ${SERIAL_N} quarantined-serial) · ${ROUTE_N} routed via ${RUNNER}"
else
  progress "[${LABEL}] ${TOTAL} test files · ${JOBS} parallel · ${SERIAL_N} quarantined-serial"
fi

while IFS= read -r t; do
  [ -z "$t" ] && continue
  bash "$SELF" --one "$t" "$WORK" "$LOCAL_N" "$LABEL"
done <<EOF2
$SERIAL_LIST
EOF2

if [ "$ROUTE_N" -gt 0 ]; then
  # Its progress (and the runner's own status lines) go to the progress channel and to a file
  # replayed if the half fails — a runner's «why nothing ran» must reach the report even when the
  # progress channel is a capture nobody reads. Its stdout — the per-test blocks and the summary
  # collect_routed reads — goes to a file replayed at collection. The one absolute path in argv is
  # the origin mark, which exists to NOT resolve on the runner's host.
  : >"$WORK/origin"
  ( cd "$REPO_ROOT" && exec "$RUNNER" bash scripts/run-install-sh-suite.sh --routed --origin "$WORK/origin" "$SUITE_REL" ) \
    >"$WORK/routed.out" 2> >(tee "$WORK/routed.err" >&"$PROGRESS_FD") </dev/null &
  ROUTED_PID=$!
fi

printf '%s' "$POOL_LIST" | grep -v '^$' | xargs -P "$JOBS" -I{} bash "$SELF" --one {} "$WORK" "$LOCAL_N" "$LABEL"

ROUTED_RC=0
if [ -n "$ROUTED_PID" ]; then
  wait "$ROUTED_PID"; ROUTED_RC=$?
  ROUTED_PID=""
fi

# The runner fell back to this host: take the routed tests into this pool, after its own tests.
if [ "$ROUTE_N" -gt 0 ] && grep -q '^\[install-sh:routed\] ON-ORIGIN:' "$WORK/routed.out"; then
  progress "[install-sh] ${RUNNER} ran the routed half on this host (its own fallback) — running those ${ROUTE_N} tests in this pool instead"
  printf '%s' "$ROUTE_LIST" | grep -v '^$' | xargs -P "$JOBS" -I{} bash "$SELF" --one {} "$WORK" "$TOTAL" "$LABEL"
  LOCAL="$LOCAL$ROUTE_LIST"
  LOCAL_N=$((LOCAL_N + ROUTE_N))
  ROUTE_N=0
fi

END=$(date +%s)

# ── Collection ─────────────────────────────────────────────────────────────────────────────────
# Replayed sequentially from the parent, in sorted order: one writer, so no interleaving is
# possible by construction (rather than by hoping each test's output fits in one atomic write).
FAILED=""
MISSING=""
PASSED=0
while IFS= read -r t; do
  [ -z "$t" ] && continue
  b=$(basename "$t")
  echo "───── $b ─────"
  if [ -f "$WORK/out/$b" ]; then cat "$WORK/out/$b"; fi
  if [ -f "$WORK/rc/$b" ]; then
    rc=$(cat "$WORK/rc/$b")
    if [ "$rc" -eq 0 ]; then
      PASSED=$((PASSED + 1))
    else
      FAILED="$FAILED $b(rc=$rc)"
      echo "───── $b: FAILED with rc=$rc ─────"
    fi
  else
    # No receipt: the worker never finished writing one. Never silently a pass.
    MISSING="$MISSING $b"
    echo "───── $b: NO RESULT RECORDED (worker died before writing its receipt) ─────"
  fi
done <<EOF2
$LOCAL
EOF2

# collect_routed — fold the routed half into the tally. Its summary line is the only evidence that
# the tests ran; the runner's exit code alone is not (a runner that runs nothing can exit 0).
collect_routed() {
  local summary rp rt line named=""
  echo "───── routed half: ${ROUTE_N} tests via ${RUNNER} (exit ${ROUTED_RC}) ─────"
  cat "$WORK/routed.out"
  summary=$(grep -E '^\[install-sh:routed\] [0-9]+/[0-9]+ passed in ' "$WORK/routed.out" | tail -1)
  rp=""; rt=""
  if [ -n "$summary" ]; then
    rp=${summary#\[install-sh:routed\] }; rp=${rp%%/*}
    rt=${summary#*/}; rt=${rt%% *}
  fi
  if [ -z "$summary" ] || [ "$rt" != "$ROUTE_N" ]; then
    MISSING="$MISSING routed-half(${ROUTE_N}-tests,runner-exit=${ROUTED_RC},reported=${rt:-none})"
    echo "───── routed half: NO VALID RESULT — expected a summary for ${ROUTE_N} tests, got ${rt:-none} ─────"
    replay_routed_err
    return
  fi
  # The right count is not enough: the per-test headers must name exactly the tests routed from here.
  printf '%s' "$ROUTE_LIST" | grep -v '^$' | sed 's|.*/||' | LC_ALL=C sort >"$WORK/routed.want"
  LC_ALL=C sed -n 's/^───── \([^ ]*\.test\.sh\) ─────$/\1/p' "$WORK/routed.out" | LC_ALL=C sort >"$WORK/routed.got"
  if ! cmp -s "$WORK/routed.want" "$WORK/routed.got"; then
    MISSING="$MISSING routed-half(ran-a-different-set)"
    echo "───── routed half: NO VALID RESULT — its ${rt} tests are not the ${ROUTE_N} routed from here ─────"
    LC_ALL=C comm -23 "$WORK/routed.want" "$WORK/routed.got" | sed 's/^/  routed but not reported: /'
    LC_ALL=C comm -13 "$WORK/routed.want" "$WORK/routed.got" | sed 's/^/  reported but not routed: /'
    return
  fi
  PASSED=$((PASSED + rp))
  line=$(grep -E '^\[install-sh:routed\] FAILED:' "$WORK/routed.out" | tail -1)
  [ -n "$line" ] && { FAILED="$FAILED ${line#\[install-sh:routed\] FAILED: }"; named=1; }
  line=$(grep -E '^\[install-sh:routed\] NO RESULT:' "$WORK/routed.out" | tail -1)
  [ -n "$line" ] && { MISSING="$MISSING ${line#\[install-sh:routed\] NO RESULT: }"; named=1; }
  # A short tally or a non-zero exit with no named culprit is still a failure.
  if { [ "$rp" != "$rt" ] || [ "$ROUTED_RC" -ne 0 ]; } && [ -z "$named" ]; then
    FAILED="$FAILED routed-half(runner-exit=${ROUTED_RC},passed=${rp}/${rt})"
    replay_routed_err
  fi
}
# replay_routed_err — the runner's own lines (why it could not run, where it fell back), minus the
# far end's per-test progress, which the per-test blocks above already carry.
replay_routed_err() {
  [ -s "$WORK/routed.err" ] || return 0
  echo "───── routed half: the runner's own output ─────"
  grep -vE '^\[install-sh:routed\] [0-9]+/[0-9]+ done · ' "$WORK/routed.err" | tail -n 20
}
[ "$ROUTE_N" -gt 0 ] && collect_routed

echo ""
if [ "$ROUTE_N" -gt 0 ]; then
  echo "[${LABEL}] ${PASSED}/${TOTAL} passed in $((END - START))s (${LOCAL_N} here: ${JOBS} parallel, ${SERIAL_N} quarantined-serial; ${ROUTE_N} routed)"
else
  echo "[${LABEL}] ${PASSED}/${TOTAL} passed in $((END - START))s (${JOBS} parallel, ${SERIAL_N} quarantined-serial)"
fi
if [ -n "$MISSING" ]; then
  echo "[${LABEL}] NO RESULT:$MISSING"
fi
if [ -n "$FAILED" ]; then
  echo "[${LABEL}] FAILED:$FAILED"
fi
if [ -n "$FAILED" ] || [ -n "$MISSING" ]; then
  progress "[${LABEL}] FAILED —$FAILED$MISSING"
  exit 1
fi
progress "[${LABEL}] all ${TOTAL} passed in $((END - START))s"
exit 0
