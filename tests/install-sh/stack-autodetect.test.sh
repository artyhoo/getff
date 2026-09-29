#!/usr/bin/env bash
# stack-autodetect.test.sh — install.sh / ./setup must AUTO-DETECT the stack from the consumer's
# package.json when no positional stack is given, instead of failing loud (GH #780, multi-stack-
# monorepo I-1). The detector is _detect_stack_from_pkg (setup.d/lib.sh, node-free grep — SSOT
# shared with 15-companions-stack.sh).
#
# Two levels:
#   UNIT        — call _detect_stack_from_pkg directly (install.sh lib-only mode) to prove the
#                 signal logic + most-specific-first ordering, node-free.
#   INTEGRATION — drive the real install.sh stack-pick to prove it CONSUMES the detector:
#                 (a) no-arg + detectable repo → correct stack, no exit 1;
#                 (b) no-arg + undetectable repo + --full → precise fail-loud, never a silent
#                     wrong install;
#                 (c) an explicit positional stack still wins (back-compat).
#
# Paired-negative (principle-02 non-vacuity): an `unknown` repo MUST NOT emit an "Auto-detected"
# line nor install a default stack — proving the detect path does not paper over genuine ambiguity.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
INSTALL_SH="$REPO_ROOT/install.sh"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

echo "▶ UNIT: _detect_stack_from_pkg signal logic (node-free, lib-only)"

# detect_unit <package.json-contents> <expected-stack> <label>
# Sources install.sh in lib-only mode (returns before the pipeline) so only the helper is loaded;
# cd into the fixture so install.sh's PROJECT_ROOT="$(pwd)" points at the fixture.
detect_unit() {
  local pkg_json="$1" expected="$2" label="$3" T got
  T=$(mktemp -d)
  printf '%s\n' "$pkg_json" > "$T/package.json"
  got=$( cd "$T" && INSTALL_SH_LIB_ONLY=1 bash -c 'source "'"$INSTALL_SH"'"; _detect_stack_from_pkg' 2>/dev/null )
  [ "$got" = "$expected" ] \
    && ok "$label → '$expected'" \
    || bad "$label: expected '$expected', got '$got'"
  rm -rf "$T"
}

detect_unit '{ "dependencies": { "next": "15.0.0", "react": "19.0.0" } }'          react-next   "next+react (next wins over react)"
detect_unit '{ "dependencies": { "react": "19.0.0" }, "devDependencies": { "vite": "5.0.0" } }' react-spa "react, no next"
detect_unit '{ "dependencies": { "react-native": "0.76.0", "react": "19.0.0" } }'  react-native "react-native (most-specific, not react-spa)"
detect_unit '{ "dependencies": { "expo": "~52.0.0", "react-native": "0.76.0" } }'  react-native "expo+react-native"
detect_unit '{ "devDependencies": { "typescript": "5.6.0" } }'                      ts-server    "typescript only"
detect_unit '{ "dependencies": { "fastify": "5.0.0" }, "devDependencies": { "typescript": "5.6.0" } }' ts-server "server dep + typescript"
detect_unit '{}'                                                                    unknown      "empty deps"
detect_unit '{ "name": "react-native-flavoured-name", "dependencies": { "lodash": "4" } }' unknown "name containing react-native is NOT a dep signal"
detect_unit '{ "scripts": { "build": "next build" }, "devDependencies": { "typescript": "5.6.0" } }' ts-server "string VALUE 'next build' is not a key signal"
# by-design (node-free trade-off, documented in lib.sh): grep scans the WHOLE file, so a signal in
# peerDependencies/overrides also counts — not only dependencies+devDependencies. Pin it as an
# executable spec rather than leaving the behaviour implicit.
detect_unit '{ "peerDependencies": { "next": "15.0.0" } }'                          react-next   "peerDependencies signal counts (whole-file scan, by design)"

# no package.json at all → unknown
NP=$(mktemp -d)
got=$( cd "$NP" && INSTALL_SH_LIB_ONLY=1 bash -c 'source "'"$INSTALL_SH"'"; _detect_stack_from_pkg' 2>/dev/null )
[ "$got" = "unknown" ] && ok "no package.json → 'unknown'" || bad "no package.json: expected 'unknown', got '$got'"
rm -rf "$NP"

echo ""
echo "▶ INTEGRATION: install.sh stack-pick consumes the detector"

# ── (a) no-arg + detectable repo → correct stack, rc 0, no fail-loud ──────────
detect_integration() {
  local pkg_json="$1" expected="$2" label="$3" T out rc
  T=$(mktemp -d)
  printf '%s\n' "$pkg_json" > "$T/package.json"
  out=$( cd "$T" && git init -q && bash "$INSTALL_SH" --dry-run 2>&1 ); rc=$?
  if [ "$rc" -eq 0 ] && grep -qE "Auto-detected stack from package.json: $expected" <<<"$out"; then
    ok "$label: no-arg → auto-detected '$expected' (rc 0)"
  else
    bad "$label: expected auto-detect '$expected' (rc=$rc); detect line: '$(printf '%s' "$out" | grep -i 'auto-detected' | head -1)'"
  fi
  rm -rf "$T"
}

detect_integration '{ "dependencies": { "next": "15.0.0", "react": "19.0.0" } }' react-next "A next repo"
detect_integration '{ "dependencies": { "react-native": "0.76.0" } }'            react-native "B react-native repo"

# ── (b) undetectable repo + --full → precise fail-loud, NO silent install ─────
# --full makes the unknown path exit 1 BEFORE the interactive `read`, so no hang guard (timeout)
# is needed — and `timeout` is GNU-only (absent on macOS), so depending on it would break locally.
U=$(mktemp -d); printf '{}\n' > "$U/package.json"
u_out=$( cd "$U" && git init -q && bash "$INSTALL_SH" --full --dry-run 2>&1 ); u_rc=$?
[ "$u_rc" -ne 0 ] \
  && ok "C unknown + --full: exits non-zero (no silent wrong install)" \
  || bad "C unknown + --full: exited 0 (silent install on ambiguity)"
grep -qiE 'could not auto-detect|specify one explicitly' <<<"$u_out" \
  && ok "C unknown + --full: fail-loud message guides user to specify a stack" \
  || bad "C unknown + --full: missing precise fail-loud guidance"
# paired-negative — the unknown repo must NOT have emitted an auto-detect line
if grep -qi 'Auto-detected stack' <<<"$u_out"; then
  bad "C-neg: emitted 'Auto-detected' for an unknown repo (VACUOUS / false detect)"
else
  ok "C-neg: no 'Auto-detected' line for unknown repo → detect path is non-vacuous"
fi
rm -rf "$U"

# ── (c) explicit positional stack wins over a different detectable signal ─────
X=$(mktemp -d); printf '{ "dependencies": { "next": "15.0.0" } }\n' > "$X/package.json"
x_out=$( cd "$X" && git init -q && bash "$INSTALL_SH" ts-server --dry-run 2>&1 ); x_rc=$?
if [ "$x_rc" -eq 0 ] \
   && grep -qE 'stack: ts-server' <<<"$x_out" \
   && ! grep -qi 'Auto-detected' <<<"$x_out"; then
  ok "D back-compat: explicit 'ts-server' wins over detectable next signal"
else
  bad "D back-compat: explicit positional did not override detection (rc=$x_rc)"
fi
rm -rf "$X"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
