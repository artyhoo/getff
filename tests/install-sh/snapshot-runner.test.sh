#!/usr/bin/env bash
# Runner contract tests use the actual dispatch with a fixture installer. Product/toolchain
# acceptance remains the unchanged real15-cell compare, never this fixture child.
set -uo pipefail
ROOT=$(CDPATH='' cd -- "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)
SNAPSHOT="$ROOT/tests/install-sh/snapshot.sh"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
fails=0
ok() { printf '  ✓ %s\n' "$1"; }
bad() { printf '  ✗ %s\n' "$1"; fails=$((fails + 1)); }
mkdir -p "$T/root" "$T/baselines" "$T/foreign"
export SNAPSHOT_TEST_CALLS="$T/calls"
cat > "$T/root/install.sh" <<'SH'
#!/bin/bash
printf '%s\n' "$1" >> "$SNAPSHOT_TEST_CALLS"
printf 'stable payload\n' > payload.txt
ln -s payload.txt payload-link
printf 'installer diagnostic for %s\n' "$1" >&2
if [ "${SNAPSHOT_TEST_FAIL:-}" = "$1" ]; then exit 42; fi
SH

# This must fail safely on the preimage, before any attempt to call its unselected CLI.
if env -u SNAPSHOT_MODE bash -c '
  cd "$2" || exit
  before_options=$-; before_path=$PATH; trap ":" EXIT; before_trap=$(trap -p EXIT)
  source "$1"
  [ "$before_options" = "$-" ] && [ "$before_path" = "$PATH" ] &&
    [ "$before_trap" = "$(trap -p EXIT)" ] && declare -F snapshot_main >/dev/null
' -- "$SNAPSHOT" "$T/foreign" > "$T/import.log" 2>&1; then
  ok 'source from foreign cwd defines API without options/PATH/trap changes'
else
  bad 'source-only API must not dispatch or require SNAPSHOT_MODE'
  cat "$T/import.log"
  echo "FAIL=$fails"; exit 1
fi
[ ! -e "$T/calls" ] && ok 'import creates no installer child' || bad 'import dispatched installer'

run() {
  SNAPSHOT_MODE="$1" BASELINE_DIR="$T/baselines" bash "$SNAPSHOT" --root "$T/root" "${@:2}" > "$T/run.log" 2>&1
}
must_fail() {
  if run "$@"; then bad "must fail: $*"; else ok "fails: $*"; fi
}

run capture --cell react-native/brownfield && ok 'selected capture succeeds' || bad 'selected capture failed'
[ "$(wc -l < "$T/calls" | tr -d ' ')" = 1 ] && [ "$(cat "$T/calls")" = react-native ] &&
  ok 'selected cell creates exactly one child' || bad 'selected dispatch count/stack wrong'
run compare --cell react-native/brownfield && ok 'selected compare restores green' || bad 'selected compare failed'

for selector in '' unknown/greenfield react-native/no-such-mode; do
  : > "$T/calls"
  must_fail capture --cell "$selector"
  [ ! -s "$T/calls" ] && ok 'invalid selector rejected before child' || bad 'invalid selector dispatched'
done
: > "$T/calls"
must_fail capture --cell ts-server/greenfield --cell ts-server/greenfield
[ ! -s "$T/calls" ] && ok 'duplicate selector rejected before child' || bad 'duplicate dispatched'
must_fail typo --cell ts-server/greenfield
must_fail capture --root "$T/missing" --cell ts-server/greenfield
must_fail compare --cell go/brownfield-golangci

: > "$T/calls"
run capture && ok 'default capture succeeds' || bad 'default capture failed'
cat > "$T/expected-cells" <<'CELLS'
cargo/brownfield-clippy
cargo/greenfield
go/brownfield-golangci
go/greenfield
python/brownfield-ruff
python/brownfield-sgconfig
python/greenfield
react-native/brownfield
react-native/greenfield
react-next/brownfield
react-next/greenfield
react-spa/brownfield
react-spa/greenfield
ts-server/brownfield
ts-server/greenfield
CELLS
find "$T/baselines" -name '*.fingerprint' | sed "s|$T/baselines/||;s|.fingerprint\$||" | sort > "$T/actual-cells"
cmp -s "$T/expected-cells" "$T/actual-cells" && [ "$(wc -l < "$T/calls" | tr -d ' ')" = 15 ] &&
  ok 'default dispatch is the independent exact15 population once each' || bad 'default population/count differs'
cp "$T/baselines/ts-server/greenfield.fingerprint" "$T/old-baseline"
export SNAPSHOT_TEST_FAIL=ts-server
must_fail compare --cell ts-server/greenfield
grep -q 'installer diagnostic' "$T/run.log" && grep -q '42' "$T/run.log" &&
  ok 'failed matching-tree install retains stderr and raw exit42' || bad 'installer failure diagnostics lost'
must_fail capture --cell ts-server/greenfield
cmp -s "$T/old-baseline" "$T/baselines/ts-server/greenfield.fingerprint" &&
  ok 'failed capture preserves prior baseline' || bad 'failed capture replaced baseline'
: > "$T/calls"
must_fail compare --cell ts-server/greenfield --cell react-next/greenfield
[ "$(wc -l < "$T/calls" | tr -d ' ')" = 2 ] && ok 'aggregate retains failed cell and executes other required cell' || bad 'aggregate lost required child'
unset SNAPSHOT_TEST_FAIL
run compare --cell ts-server/greenfield && ok 'restored installer restores actual aggregate green' || bad 'restored aggregate failed'

if SNAPSHOT_MODE=compare BASELINE_DIR="$T/baselines" bash -c '
  cd "$1" || exit
  source tests/install-sh/snapshot.sh
  cd "$2" || exit
  snapshot_main --root "$3" --cell ts-server/greenfield
' -- "$ROOT" "$T/foreign" "$T/root" > "$T/relative.log" 2>&1; then
  ok 'relative import then cwd change respects explicit declared root'
else
  bad 'explicit root depends on relative import cwd'
fi

mkdir -p "$T/invalid-baselines/ts-server/greenfield.fingerprint"
if SNAPSHOT_MODE=capture BASELINE_DIR="$T/invalid-baselines" bash "$SNAPSHOT" --root "$T/root" --cell ts-server/greenfield > "$T/invalid.log" 2>&1; then
  bad 'capture accepted directory as baseline destination'
else
  ok 'capture rejects directory destination through aggregate'
fi
[ -z "$(find "$T/invalid-baselines" -type f)" ] &&
  ok 'invalid destination retains no temporary capture artifact' || bad 'temporary capture artifact left in directory destination'

# Inject failures at actual fingerprint dependencies, including a conditional function call
# where Bash disables errexit throughout nested functions. Never mutate the tracked source.
mkdir "$T/fault-bin"
for tool in sha256sum readlink; do
  printf '#!/bin/bash\necho "%s fault" >&2\nexit 43\n' "$tool" > "$T/fault-bin/$tool"
  chmod +x "$T/fault-bin/$tool"
  for mode in capture compare; do
    if PATH="$T/fault-bin:$PATH" SNAPSHOT_MODE="$mode" BASELINE_DIR="$T/baselines" bash -c '
      source "$1"
      if snapshot_main --root "$2" --cell ts-server/greenfield; then exit 0; else exit 1; fi
    ' -- "$SNAPSHOT" "$T/root" > "$T/fault.log" 2>&1; then
      bad "$tool failure hidden in conditional $mode"
    else
      ok "$tool failure rejects conditional $mode"
    fi
    cmp -s "$T/old-baseline" "$T/baselines/ts-server/greenfield.fingerprint" || bad "$tool failure changed baseline"
  done
  rm "$T/fault-bin/$tool"
done
printf '#!/bin/bash\necho diff-fault >&2\nexit 2\n' > "$T/fault-bin/diff"; chmod +x "$T/fault-bin/diff"
PATH="$T/fault-bin:$PATH" must_fail compare --cell ts-server/greenfield
rm "$T/fault-bin/diff"

# Missing comparison prerequisite is rejected before even one expensive installation.
mkdir "$T/min-bin"
for tool in bash git mktemp find sort awk dirname mkdir rm ln sed wc tr cmp cat sha256sum shasum; do
  p=$(command -v "$tool" 2>/dev/null || true)
  [ -z "$p" ] || ln -s "$p" "$T/min-bin/$tool"
done
: > "$T/calls"
PATH="$T/min-bin" must_fail compare --cell ts-server/greenfield
[ ! -s "$T/calls" ] && ok 'missing diff prerequisite fails before installation' || bad 'missing prerequisite incurred installation'
run compare --cell ts-server/greenfield && ok 'restored prerequisites restore green' || bad 'restored prerequisites failed'

# Git's repository-local environment outranks cwd; a fixture must never reconfigure
# an unrelated parent repository, even when its delivered fingerprint happens to match.
git init -q "$T/foreign"
git -C "$T/foreign" config user.name 'Unrelated owner'
cp "$T/foreign/.git/config" "$T/foreign-config"
GIT_DIR="$T/foreign/.git" run compare --cell ts-server/greenfield &&
  ok 'dirty Git parent agrees with the clean scenario' || bad 'dirty Git parent changed outcome'
cmp -s "$T/foreign-config" "$T/foreign/.git/config" &&
  ok 'declared fixture root preserves foreign Git configuration' || bad 'foreign Git configuration was modified'

echo "FAIL=$fails"; [ "$fails" -eq 0 ]
