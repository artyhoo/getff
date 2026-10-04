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
    # shellcheck disable=SC2001  # sed substitutes on EVERY line of a multi-line string ('^' per line); ${var//} has no line anchor
    echo "$out" | sed 's/^/      /'
    FAILED=1
    return
  fi
  if [ -n "$needle" ] && ! grep -q -- "$needle" <<<"$out"; then
    echo "FAIL: $label — exit $want as expected, but output never mentions '$needle'"
    # shellcheck disable=SC2001  # sed substitutes on EVERY line of a multi-line string ('^' per line); ${var//} has no line anchor
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
grep -q 'ts-morph' <<<"$("$CHECK" "$TMP/c5" 2>&1)" && { echo 'FAIL: ts-morph must not be checked'; FAILED=1; }

# 6 — USAGE: a missing repo file is a usage error, never a silent pass.
mkdir -p "$TMP/c6"
expect 'missing lockfiles are exit 2' 2 "$TMP/c6" 'required file missing'

# 6b — NEGATIVE (every committed bundle, 2026-09-28): the synth bundle agrees, but a SECOND
#      committed bundle (the rule generator, scripts/build-runtime-bundles.mjs) inlines ajv, a
#      first-party source imports ajv directly, and the two locks plan different ajv versions.
#      A guard that reads only the synth bundle passes this tree — the phantom drift then lands
#      on the other bundle's --check instead.
fixture "$TMP/c6b" 7.8.5 7.8.5 7.8.5
printf '// node_modules/ajv/dist/ajv.js\nvar Ajv = 1;\n' \
  >"$TMP/c6b/packages/core/install/rule-bootstrap-cli.bundle.mjs"
printf "import Ajv from 'ajv';\n" >"$TMP/c6b/packages/core/research/validate.ts"
python3 - "$TMP/c6b" <<'PY'
import json, sys
d = sys.argv[1]
for rel, key, ver in (('package-lock.json', 'node_modules/ajv', '8.17.1'),
                      ('packages/core/package-lock.json', 'node_modules/ajv', '8.12.0')):
    p = f'{d}/{rel}'
    lock = json.load(open(p))
    lock['packages'][key] = {'version': ver}
    json.dump(lock, open(p, 'w'))
PY
expect 'a second bundle is checked too' 1 "$TMP/c6b" 'ajv'

# 6c — USAGE: a tree with lockfiles but no committed bundle at all is exit 2, never a silent pass.
fixture "$TMP/c6c" 7.8.5 7.8.5 7.8.5
rm -f "$TMP/c6c/packages/core/install/synth-and-wire.bundle.mjs"
expect 'no committed bundle is exit 2' 2 "$TMP/c6c" 'no committed'

# ajv_fixture <dir> <root-fast-uri> <core-fast-uri>
#   The 2026-09-30 shape: a first-party source imports ajv, the bundle inlines ajv AND its
#   transitive fast-uri, both locks hoist ajv 8.20.0, and each lock plans its own fast-uri.
#   The root lock also carries the two json-schema-traverse@0.4.1 copies it really has
#   (packages/core-nested and eslint-nested) next to the 1.0.0 that ajv resolves — neither is on
#   ajv's resolution path, so neither may be reported.
ajv_fixture() {
  local d="$1" root_uri="$2" core_uri="$3"
  mkdir -p "$d/packages/core/install" "$d/packages/core/render"
  printf '%s\n' '// node_modules/ajv/dist/ajv.js' 'var Ajv = 1;' \
    '// node_modules/fast-uri/index.js' 'var uri = 1;' \
    '// node_modules/json-schema-traverse/index.js' 'var t = 1;' \
    >"$d/packages/core/install/rule-bootstrap-cli.bundle.mjs"
  printf "import { Ajv } from 'ajv';\n" >"$d/packages/core/render/render-rules.ts"
  python3 - "$d" "$root_uri" "$core_uri" <<'PY'
import json, sys
d, root_uri, core_uri = sys.argv[1:]
ajv = {'version': '8.20.0',
       'dependencies': {'fast-uri': '^3.0.1', 'json-schema-traverse': '^1.0.0'}}
root = {'': {'name': 'w'}, 'node_modules/ajv': ajv,
        'node_modules/fast-uri': {'version': root_uri},
        'node_modules/json-schema-traverse': {'version': '1.0.0'},
        'packages/core/node_modules/json-schema-traverse': {'version': '0.4.1', 'dev': True},
        'node_modules/eslint/node_modules/json-schema-traverse': {'version': '0.4.1', 'dev': True}}
core = {'': {'name': 'c'}, 'node_modules/ajv': ajv,
        'node_modules/fast-uri': {'version': core_uri},
        'node_modules/json-schema-traverse': {'version': '1.0.0'}}
for rel, pkgs in (('package-lock.json', root), ('packages/core/package-lock.json', core)):
    json.dump({'lockfileVersion': 3, 'packages': pkgs}, open(f'{d}/{rel}', 'w'))
PY
}

# 6d — NEGATIVE (incident 2026-09-30): ajv agrees across the locks, but its TRANSITIVE fast-uri
#      does not — root plans 3.1.7, packages/core plans 3.1.8. After `npm ci --prefix
#      packages/core`, ajv resolves from packages/core/node_modules and so does its fast-uri, and
#      every committed bundle that inlines fast-uri reports a phantom drift.
ajv_fixture "$TMP/c6d" 3.1.7 3.1.8
expect 'a transitive split (fast-uri 3.1.7/3.1.8) fails' 1 "$TMP/c6d" 'fast-uri'
out_6d="$("$CHECK" "$TMP/c6d" 2>&1)"
{ grep -q '3\.1\.7' <<<"$out_6d" && grep -q '3\.1\.8' <<<"$out_6d"; } \
  || { echo 'FAIL: the transitive split report must name both versions'; FAILED=1; }

# 6e — POSITIVE: the same tree once the split is gone passes, and names the transitive package
#      it checked. The two off-path json-schema-traverse@0.4.1 copies stay out of the verdict.
ajv_fixture "$TMP/c6e" 3.1.8 3.1.8
expect 'an aligned transitive dependency passes' 0 "$TMP/c6e" 'fast-uri@3.1.8'
grep -q 'json-schema-traverse@1.0.0' <<<"$("$CHECK" "$TMP/c6e" 2>&1)" \
  || { echo 'FAIL: off-path json-schema-traverse copies must not disturb the 1.0.0 verdict'; FAILED=1; }

# 6f — NEGATIVE (tree): locks agree on fast-uri 3.1.8, but the installed tree puts ajv in the
#      packages/core layer and leaves a stale fast-uri 3.1.7 as the first copy ajv can reach.
ajv_fixture "$TMP/c6f" 3.1.8 3.1.8
mkdir -p "$TMP/c6f/packages/core/node_modules/ajv"
printf '{"name":"ajv","version":"8.20.0","dependencies":{"fast-uri":"^3.0.1"}}' \
  >"$TMP/c6f/packages/core/node_modules/ajv/package.json"
install_pkg "$TMP/c6f" fast-uri 3.1.7 packages/core
expect 'a stale transitive in the installed tree fails' 1 "$TMP/c6f" 'actually resolvable'

# nest_fast_uri <dir> <lock-rel> <version> — plan a fast-uri copy nested under ajv in one lock.
nest_fast_uri() {
  python3 - "$1/$2" "$3" <<'PY'
import json, sys
p, ver = sys.argv[1:]
lock = json.load(open(p))
lock['packages']['node_modules/ajv/node_modules/fast-uri'] = {'version': ver}
json.dump(lock, open(p, 'w'))
PY
}

# 6g — NEGATIVE (resolve from the PARENT): both locks hoist fast-uri 3.1.8, but the packages/core
#      lock nests 3.1.9 under ajv. ajv's own directory wins, so the core world inlines 3.1.9.
#      A check that resolved transitive packages from packages/core would see 3.1.8 twice.
ajv_fixture "$TMP/c6g" 3.1.8 3.1.8
nest_fast_uri "$TMP/c6g" packages/core/package-lock.json 3.1.9
expect 'a transitive nested under its parent is resolved from the parent' 1 "$TMP/c6g" '3.1.9'

# 6h — NEGATIVE (nested comment path): esbuild names a nested copy
#      `// node_modules/ajv/node_modules/fast-uri/…`; the inner package is inlined too.
ajv_fixture "$TMP/c6h" 3.1.8 3.1.8
nest_fast_uri "$TMP/c6h" package-lock.json 3.1.7
nest_fast_uri "$TMP/c6h" packages/core/package-lock.json 3.1.9
printf '%s\n' '// node_modules/ajv/dist/ajv.js' 'var Ajv = 1;' \
  '// node_modules/ajv/node_modules/fast-uri/index.js' 'var uri = 1;' \
  >"$TMP/c6h/packages/core/install/rule-bootstrap-cli.bundle.mjs"
expect 'a package named only in a nested comment path is checked' 1 "$TMP/c6h" 'fast-uri'

# 6i — NEGATIVE (unresolvable): the bundle inlines `ghost`, which neither lock plans. A world
#      that cannot resolve an inlined package is a disagreement in its own right — the bundle
#      could not be rebuilt from that lock at all — never a package quietly left out of the ✓.
ajv_fixture "$TMP/c6i" 3.1.8 3.1.8
printf '%s\n' '// node_modules/ghost/index.js' 'var g = 1;' \
  >>"$TMP/c6i/packages/core/install/rule-bootstrap-cli.bundle.mjs"
expect 'an inlined package no lock plans fails' 1 "$TMP/c6i" 'ghost'

# 6j — POSITIVE (tree, parent directory decides): ajv is installed at the ROOT with fast-uri
#      3.1.8 beside it; a stale 3.1.7 sits only in packages/core/node_modules, where ajv's walk
#      never looks. Resolving fast-uri from packages/core instead of from ajv would fail this.
ajv_fixture "$TMP/c6j" 3.1.8 3.1.8
mkdir -p "$TMP/c6j/node_modules/ajv"
printf '{"name":"ajv","version":"8.20.0","dependencies":{"fast-uri":"^3.0.1"}}' \
  >"$TMP/c6j/node_modules/ajv/package.json"
install_pkg "$TMP/c6j" fast-uri 3.1.8 .
install_pkg "$TMP/c6j" fast-uri 3.1.7 packages/core
expect 'the tree walk follows the parent, not packages/core' 0 "$TMP/c6j" 'fast-uri@3.1.8'

# 6k — NEGATIVE (tree, mirror of 6j): ajv is in packages/core/node_modules with a stale 3.1.7
#      nested under it; the root copy is 3.1.8. ajv's own directory wins, so 3.1.7 is inlined.
ajv_fixture "$TMP/c6k" 3.1.8 3.1.8
mkdir -p "$TMP/c6k/packages/core/node_modules/ajv"
printf '{"name":"ajv","version":"8.20.0","dependencies":{"fast-uri":"^3.0.1"}}' \
  >"$TMP/c6k/packages/core/node_modules/ajv/package.json"
install_pkg "$TMP/c6k" fast-uri 3.1.8 .
install_pkg "$TMP/c6k" fast-uri 3.1.7 packages/core/node_modules/ajv
expect 'a stale copy nested under the installed parent fails' 1 "$TMP/c6k" 'actually resolvable'

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
# shellcheck disable=SC2015  # B is a print-only helper that cannot fail; this reads as if-then-else by construction
( cd "$TMP" && "$CHECK" ./c1 >/dev/null 2>&1 ) \
  && echo 'ok: relative <repo-root> argument resolves against the caller'"'"'s cwd' \
  || { echo 'FAIL: relative <repo-root> argument did not resolve'; FAILED=1; }

[ "$FAILED" -eq 0 ] && echo 'PASS' && exit 0
echo 'FAILED'
exit 1
