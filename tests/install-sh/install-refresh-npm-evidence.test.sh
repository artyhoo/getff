#!/usr/bin/env bash
# Sparse brownfield installs still refresh npm when either enforcement payload survives.
set -uo pipefail
ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
INSTALL_ROOT=${INSTALL_ROOT:-$ROOT}; TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
PASS=0; FAIL=0
for evidence in packages/core/hooks/pre-push.bundle.mjs eslint-rules-local/index.mjs; do
 dir="$TMP/$(basename "$(dirname "$evidence")")"; mkdir -p "$dir/$(dirname "$evidence")"
 printf '{}\n' > "$dir/package.json"; touch "$dir/$evidence" "$dir/.getff-python-install.log"
 (cd "$dir" && bash "$INSTALL_ROOT/install.sh" --refresh --dry-run </dev/null) > "$TMP/out" 2>&1; rc=$?
 if [ "$rc" -eq 0 ] && grep -Eq 'stack: ts-server' "$TMP/out" \
  && grep -Eq '\[dry-run\] would refresh: .*pre-push.bundle.mjs' "$TMP/out"; then
  PASS=$((PASS+1)); else FAIL=$((FAIL+1)); echo "FAIL: sparse npm evidence $evidence"; fi
done
echo "PASS=$PASS FAIL=$FAIL"; test "$FAIL" -eq 0
