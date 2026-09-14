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
  _t="$2"; _work="$3"; _total="$4"
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
  progress "[install-sh] ${_n}/${_total} done · ${_safe} (${_mark})"
  exit 0   # the receipt carries the verdict; a non-zero here would only abort the pool early
fi

# ── Main ───────────────────────────────────────────────────────────────────────────────────────
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
JOBS=$(detect_jobs)

WORK=$(mktemp -d "${TMPDIR:-/tmp}/install-sh-suite.XXXXXX") || {
  echo "run-install-sh-suite: cannot create a work directory" >&2; exit 1; }
mkdir -p "$WORK/out" "$WORK/rc" "$WORK/seq"
trap 'rm -rf "$WORK"' EXIT INT TERM

START=$(date +%s)

# Quarantine first, alone. First (not last) so that if it leaves the tree dirty after a crash, the
# pool's repo reads fail loudly in the same run rather than in the next one.
SERIAL_LIST=""
POOL_LIST=""
while IFS= read -r t; do
  [ -z "$t" ] && continue
  case " $QUARANTINE_SERIAL " in
    *" $(basename "$t") "*) SERIAL_LIST="$SERIAL_LIST$t
" ;;
    *) POOL_LIST="$POOL_LIST$t
" ;;
  esac
done <<EOF
$ALL
EOF

SERIAL_N=$(printf '%s' "$SERIAL_LIST" | grep -c . | tr -d ' ')
progress "[install-sh] ${TOTAL} test files · ${JOBS} parallel · ${SERIAL_N} quarantined-serial"

while IFS= read -r t; do
  [ -z "$t" ] && continue
  bash "$SELF" --one "$t" "$WORK" "$TOTAL"
done <<EOF
$SERIAL_LIST
EOF

printf '%s' "$POOL_LIST" | grep -v '^$' | xargs -P "$JOBS" -I{} bash "$SELF" --one {} "$WORK" "$TOTAL"

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
done <<EOF
$ALL
EOF

echo ""
echo "[install-sh] ${PASSED}/${TOTAL} passed in $((END - START))s (${JOBS} parallel, ${SERIAL_N} quarantined-serial)"
if [ -n "$MISSING" ]; then
  echo "[install-sh] NO RESULT:$MISSING"
fi
if [ -n "$FAILED" ]; then
  echo "[install-sh] FAILED:$FAILED"
fi
if [ -n "$FAILED" ] || [ -n "$MISSING" ]; then
  progress "[install-sh] FAILED —$FAILED$MISSING"
  exit 1
fi
progress "[install-sh] all ${TOTAL} passed in $((END - START))s"
exit 0
