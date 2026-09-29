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

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
