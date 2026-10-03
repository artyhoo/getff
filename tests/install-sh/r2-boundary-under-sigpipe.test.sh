#!/usr/bin/env bash
# r2-boundary-under-sigpipe.test.sh — _r2_boundary_under (setup.d/eslint-wire.sh) must not read a
# boundary-present verdict as «no boundary» because a pipe into `grep -q` lost a SIGPIPE race.
#
# The defect (measured 2026-09-29). The function used to test the detector's output with
# `printf '%s\n' "$out" | grep -q '^glob:'` under install.sh's `set -euo pipefail`. `grep -q` exits
# on its first match; printf writes a multi-line value once per line, so a write still pending
# after that exit gets EPIPE, printf dies of SIGPIPE (141), and pipefail makes 141 the status of
# the whole test. On a real 6-line, 170-byte probe output this returned 141 in 1/400 runs under
# 2x CPU oversubscription — the flaky «U1 (with ts-morph)» arm of r2-not-wired-summary.test.sh —
# and every such loss skipped R2 for a consumer config that has boundary code.
#
# This test makes the race deterministic instead of waiting for load: the stub detector prints
# the verdict, the glob line, and then far more than a pipe buffer (64 KiB) of further `glob:`
# lines, so the producer is guaranteed to still be writing when `grep -q` exits. Against the old
# line arm A fails either way: 141 where SIGPIPE has its default action, 1 where the parent left
# SIGPIPE ignored (printf then gets EPIPE, prints «write error: Broken pipe», and returns 1) —
# both measured 2026-09-29 on macOS bash 5.
#
# Arms:
#   A  boundary-present + glob lines, large output   → _r2_boundary_under returns 0 (the RED arm);
#   B  boundary-present + glob lines, 6-line output  → returns 0 (the shape seen in the field);
#   C  paired negative: boundary-present, NO glob line → returns 1;
#   D  paired negative: ambiguous verdict with glob lines → returns 1;
#   E  paired negative: the detector fails to run → returns 1.
#
# The same race in the verdict read (measured 2026-09-29, post-merge CI of staging 2599f343c4c,
# install-sh battery shard B, r2-auto-wire.test.sh arm B). eslint_wire_r2_root took the first line
# of the detector's output with `_r2_verdict="$(printf '%s\n' "$_r2_out" | head -1)"`; `head -1`
# exits after one line, printf's next write got EPIPE («printf: write error: Broken pipe»), and under
# `set -e` the assignment's non-zero status aborted the whole install (rc=1).
#   F  the shipped `_r2_verdict=` line, large output → no abort, verdict = the first line (RED arm);
#   G  the shipped line, the 6-line field shape → the first line;
#   H  the shipped line, a one-line output with no newline → that line.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT

# The function under test, lifted verbatim from the shipped file (same harness as
# synth-wire-consumer-config.test.sh's _own_eslint_ignores arm).
fn=$(sed -n '/^_r2_boundary_under() {/,/^}/p' "$REPO_ROOT/setup.d/eslint-wire.sh")
[ -n "$fn" ] || { echo "FATAL: _r2_boundary_under not found in setup.d/eslint-wire.sh"; exit 1; }
eval "$fn"

# PKG_ROOT points at a fake package whose detector prints what $STUB_OUT holds.
PKG_ROOT="$WORK/pkg"
mkdir -p "$PKG_ROOT/packages/core/audit-self"
cat > "$PKG_ROOT/packages/core/audit-self/detect-r2-boundary.sh" <<'EOF'
#!/usr/bin/env bash
[ -n "${STUB_FAIL:-}" ] && exit 3
cat "$STUB_OUT"
EOF

run_arm() { # <label> <want-rc> — runs _r2_boundary_under under the installer's shell options
  local label="$1" want="$2" rc
  rc=$(set -euo pipefail; _r2_boundary_under "$WORK" && echo 0 || echo "$?"; true)
  [ "$rc" = "$want" ] && ok "$label (rc $rc)" || bad "$label — want rc $want, got $rc"
}

export STUB_OUT="$WORK/out"
{ echo boundary-present; for i in $(seq 1 20000); do echo "glob:src/routes/r$i/**/*.ts"; done; } > "$STUB_OUT"
run_arm "A large boundary-present output with glob lines → boundary found" 0

printf '%s\n' boundary-present 'glob:src/routes/**/*.ts' 'glob:src/handlers/**/*.ts' \
  'signal:folder src/routes' 'signal:parse src/routes/a.ts' 'signal:parse src/routes/b.ts' > "$STUB_OUT"
run_arm "B six-line boundary-present output (the field shape) → boundary found" 0

{ echo boundary-present; for i in $(seq 1 20000); do echo "signal:parse src/f$i.ts"; done; } > "$STUB_OUT"
run_arm "C neg: boundary-present without any glob line → no boundary" 1

{ echo ambiguous; for i in $(seq 1 20000); do echo "glob:src/routes/r$i/**/*.ts"; done; } > "$STUB_OUT"
run_arm "D neg: an ambiguous verdict, even with glob lines → no boundary" 1

STUB_FAIL=1 run_arm "E neg: the detector exits non-zero → no boundary" 1

# F-H: the verdict read, lifted verbatim from the shipped file and run under the installer's options.
vline=$(grep -E '^[[:space:]]*_r2_verdict=' "$REPO_ROOT/setup.d/eslint-wire.sh" | head -1)
[ -n "$vline" ] || { echo "FATAL: the _r2_verdict= line not found in setup.d/eslint-wire.sh"; exit 1; }
verdict_arm() { # <label> <want-verdict> — $_r2_out holds the detector output
  # A separate bash, not a subshell: a `||` after `$( … )` would switch errexit off inside it too.
  local label="$1" want="$2" got
  # The output goes through a file: 600 KiB in the environment is over Linux's per-string limit.
  printf '%s' "$_r2_out" > "$WORK/r2-out"
  got=$(bash -c 'set -euo pipefail; _r2_out=$(cat "$2"); eval "$1"; printf "rc0:%s" "$_r2_verdict"' _ "$vline" "$WORK/r2-out" 2>&1) \
    || got="aborted rc=$?: $got"
  [ "$got" = "rc0:$want" ] && ok "$label" || bad "$label — want rc0:$want, got $(head -c 200 <<<"$got")"
}
_r2_out="boundary-present"$'\n'"$(for i in $(seq 1 20000); do echo "glob:src/routes/r$i/**/*.ts"; done)"
verdict_arm "F large detector output → no abort, verdict is the first line" boundary-present
_r2_out=$(printf '%s\n' boundary-present 'glob:src/routes/**/*.ts' 'glob:src/handlers/**/*.ts' \
  'signal:folder src/routes' 'signal:parse src/routes/a.ts' 'signal:parse src/routes/b.ts')
verdict_arm "G six-line output (the field shape) → the first line" boundary-present
_r2_out="ambiguous"
verdict_arm "H one line, no newline → that line" ambiguous

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
