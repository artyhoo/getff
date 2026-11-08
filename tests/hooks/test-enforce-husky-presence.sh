#!/usr/bin/env bash
# Fixed controls of the production structural gate. Never replace checkout hooks.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
CHECKER="$ROOT/scripts/check-husky-presence.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

check() { # name, expected status, diagnostic, hook directory
  local actual=0
  bash "$CHECKER" "$4" >"$TMP/output" 2>&1 || actual=$?
  if [ "$actual" -ne "$2" ] || ! grep -qF "$3" "$TMP/output"; then
    echo "FAIL: $1 expected status $2 and diagnostic: $3 (got $actual)"
    cat "$TMP/output"
    exit 1
  fi
  echo "PASS: $1"
}
valid() {
  mkdir -p "$1"
  for hook in pre-commit pre-push; do
    printf '#!/usr/bin/env bash\nbash -n "$0"\n' >"$1/$hook"
    chmod +x "$1/$hook"
  done
}

# Each hook position is exercised; a valid first hook must not mask a bad second.
for hook in pre-commit pre-push; do
  dir="$TMP/missing-$hook"; valid "$dir"; rm "$dir/$hook"
  check "missing $hook" 1 "missing $dir/$hook" "$dir"
  dir="$TMP/nonexec-$hook"; valid "$dir"; chmod -x "$dir/$hook"
  check "non-executable $hook" 1 "$dir/$hook not executable" "$dir"
  dir="$TMP/stub-$hook"; valid "$dir"
  printf '#!/usr/bin/env bash\nexit 0\n' >"$dir/$hook"
  check "stub $hook" 1 "$dir/$hook lacks expected probes" "$dir"
done
valid "$TMP/owned"
check 'owned valid probes' 0 'hooks present, executable, non-trivial' "$TMP/owned"
valid "$TMP/dispatcher"
printf '#!/usr/bin/env bash\nexec node packages/core/hooks/pre-push.ts\n' >"$TMP/dispatcher/pre-push"
check 'dispatcher reference' 0 'hooks present, executable, non-trivial' "$TMP/dispatcher"
mkdir "$TMP/checkout"
cp -p "$ROOT/.husky/pre-commit" "$ROOT/.husky/pre-push" "$TMP/checkout/"
check 'actual checkout dispatcher shapes (copied, never executed)' 0 'hooks present, executable, non-trivial' "$TMP/checkout"
echo 'PASS: husky checker fixed controls'
