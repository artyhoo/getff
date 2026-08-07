#!/usr/bin/env bash
# check-bundle-dep-parity.test.sh — paired-negative suite for the phantom-drift guard.
#
# The guard only earns its place if it goes RED on the exact shape that produced the incidents.
# Case 2 replays 2026-08-06 verbatim (root lock plans semver@7.8.5 for packages/core, the
# standalone lock pins 7.8.1, `npm ci --prefix packages/core` installs the latter); case 3
# replays the 2026-07-02 variant (locks agree, the installed tree does not); case 4 pins the
# scoping decision that keeps `--external` / string-literal packages out of the check.
set -uo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
CHECK="$DIR/check-bundle-dep-parity.sh"
FAILED=0

# fixture <dir> <root-nested-semver|-> <root-hoisted-semver|-> <core-lock-semver|->
#   Writes a minimal but structurally faithful tree: a bundle whose esbuild file comments name
#   the inlined packages, a first-party source that imports semver directly, and the two
#   committed lockfiles. `-` omits that layer.
fixture() {
  local d="$1" nested="$2" hoisted="$3" core="$4"
  mkdir -p "$d/packages/core/install" "$d/packages/core/research"
  cat >"$d/packages/core/install/synth-and-wire.bundle.mjs" <<'EOF'
// node_modules/semver/internal/constants.js
var MAX_LENGTH = 256;
// node_modules/ts-morph-lookalike/index.js is NOT a comment esbuild would emit for an external
var probe = existsSync("node_modules/ts-morph/package.json");
EOF
  printf "import semver from 'semver';\nimport { Project } from 'ts-morph';\n" \
    >"$d/packages/core/research/load.ts"

  {
    printf '{"lockfileVersion":3,"packages":{'
    printf '"":{"name":"w"}'
    [ "$hoisted" != '-' ] && printf ',"node_modules/semver":{"version":"%s"}' "$hoisted"
    [ "$nested" != '-' ] && printf ',"packages/core/node_modules/semver":{"version":"%s"}' "$nested"
    printf ',"node_modules/ts-morph":{"version":"24.0.0"}'
    printf '}}'
  } >"$d/package-lock.json"

  {
    printf '{"lockfileVersion":3,"packages":{"":{"name":"c"}'
    [ "$core" != '-' ] && printf ',"node_modules/semver":{"version":"%s"}' "$core"
    printf ',"node_modules/ts-morph":{"version":"9.9.9"}'
    printf '}}'
  } >"$d/packages/core/package-lock.json"
}

# install <dir> <pkg> <version> <layer-relative-dir>
install_pkg() {
  local d="$1" pkg="$2" ver="$3" layer="$4"
  mkdir -p "$d/$layer/node_modules/$pkg"
  printf '{"name":"%s","version":"%s"}' "$pkg" "$ver" >"$d/$layer/node_modules/$pkg/package.json"
}

expect() {
  local label="$1" want="$2" dir="$3" needle="${4:-}"
  local out rc
  out="$("$CHECK" "$dir" 2>&1)"; rc=$?
  if [ "$rc" -ne "$want" ]; then
    echo "FAIL: $label — expected exit $want, got $rc"
    echo "$out" | sed 's/^/      /'
    FAILED=1
    return
  fi
  if [ -n "$needle" ] && ! printf '%s' "$out" | grep -q -- "$needle"; then
    echo "FAIL: $label — exit $want as expected, but output never mentions '$needle'"
    echo "$out" | sed 's/^/      /'
    FAILED=1
    return
  fi
  echo "ok: $label"
}

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# 1 — POSITIVE: every layer plans the same version, no tree installed.
fixture "$TMP/c1" 7.8.5 7.8.5 7.8.5
expect 'converged lockfiles pass' 0 "$TMP/c1" 'semver@7.8.5'

# 2 — NEGATIVE (incident 2026-08-06): standalone lock diverges from the root lock's nested plan.
fixture "$TMP/c2" 7.8.5 7.7.4 7.8.1
expect 'diverging lockfiles fail' 1 "$TMP/c2" '7.8.1'

# 3 — NEGATIVE (incident 2026-07-02): locks agree, the installed tree carries something else.
fixture "$TMP/c3" - 7.8.5 7.8.5
install_pkg "$TMP/c3" semver 7.7.4 .
expect 'stale installed tree fails' 1 "$TMP/c3" 'actually resolvable'

# 4 — POSITIVE: the nearest installed layer matches, even though an outer layer does not.
fixture "$TMP/c4" - 7.8.5 7.8.5
install_pkg "$TMP/c4" semver 7.7.4 .
install_pkg "$TMP/c4" semver 7.8.5 packages/core
expect 'nearest layer wins' 0 "$TMP/c4" 'semver@7.8.5'

# 5 — POSITIVE (scoping): ts-morph is imported by a source and diverges across the locks, but it
#     is `--external` (no esbuild file comment), so it cannot change a bundled byte → ignored.
fixture "$TMP/c5" 7.8.5 7.8.5 7.8.5
expect 'external package is out of scope' 0 "$TMP/c5" 'semver@7.8.5'
"$CHECK" "$TMP/c5" 2>&1 | grep -q 'ts-morph' && { echo 'FAIL: ts-morph must not be checked'; FAILED=1; }

# 6 — USAGE: a missing repo file is a usage error, never a silent pass.
mkdir -p "$TMP/c6"
expect 'missing lockfiles are exit 2' 2 "$TMP/c6" 'required file missing'

# 7 — CWD-INDEPENDENCE: with no argument the target is the repo the script lives in, derived
#     from its own path. A cwd-derived root would answer about the caller's checkout instead —
#     and outside any repo it had nothing to answer with at all. Run from a non-repo directory.
FOREIGN="$(mktemp -d)"
if git -C "$FOREIGN" rev-parse --show-toplevel >/dev/null 2>&1; then
  echo "FAIL: fixture dir $FOREIGN is inside a git repo — this case needs a non-repo cwd"
  FAILED=1
else
  here="$("$CHECK" 2>&1)"; rc_here=$?
  there="$(cd "$FOREIGN" && "$CHECK" 2>&1)"; rc_there=$?
  if [ "$rc_here" -ne "$rc_there" ] || [ "$here" != "$there" ]; then
    echo "FAIL: no-argument result depends on cwd — exit $rc_here here vs $rc_there from $FOREIGN"
    diff <(printf '%s\n' "$here") <(printf '%s\n' "$there") | sed 's/^/      /'
    FAILED=1
  else
    echo 'ok: no-argument run is identical from the repo and from a non-repo cwd'
  fi
fi
rm -rf "$FOREIGN"

# 8 — CWD-INDEPENDENCE for an explicit RELATIVE argument: it must keep meaning the directory the
#     caller named, so the script resolves it before use rather than re-interpreting it later.
( cd "$TMP" && "$CHECK" ./c1 >/dev/null 2>&1 ) \
  && echo 'ok: relative <repo-root> argument resolves against the caller'"'"'s cwd' \
  || { echo 'FAIL: relative <repo-root> argument did not resolve'; FAILED=1; }

[ "$FAILED" -eq 0 ] && echo 'PASS' && exit 0
echo 'FAILED'
exit 1
