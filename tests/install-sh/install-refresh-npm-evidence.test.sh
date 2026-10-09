#!/usr/bin/env bash
# Sparse brownfield installs refresh honestly.
#   bundle-evidence shape: the placed pre-push bundle is still a preset passport
#   (placed answer wins) — refresh resolves ts-server and refreshes the npm payload.
#   barrel-only shape (W2, fix 4dcf118b5): the ESLint barrel is NOT a passport, so a
#   bare-{} project re-detects generic (fresh == refresh) and the refresh STATES the
#   npm skip — a package.json with no linter and no lint command drives no payload
#   (operator fork 1 = B), so there is nothing honest to refresh into.
set -uo pipefail
ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
INSTALL_ROOT=${INSTALL_ROOT:-$ROOT}; TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
PASS=0; FAIL=0
for evidence in packages/core/hooks/pre-push.bundle.mjs eslint-rules-local/index.mjs; do
 dir="$TMP/$(basename "$(dirname "$evidence")")"; mkdir -p "$dir/$(dirname "$evidence")"
 printf '{}\n' > "$dir/package.json"; touch "$dir/$evidence" "$dir/.getff-python-install.log"
 (cd "$dir" && bash "$INSTALL_ROOT/install.sh" --refresh --dry-run </dev/null) > "$TMP/out" 2>&1; rc=$?
 case "$evidence" in
  packages/core/hooks/pre-push.bundle.mjs)
   if [ "$rc" -eq 0 ] && grep -Eq 'stack: ts-server' "$TMP/out" \
    && grep -Eq '\[dry-run\] would refresh: .*pre-push.bundle.mjs' "$TMP/out"; then
    PASS=$((PASS+1)); else FAIL=$((FAIL+1)); echo "FAIL: sparse npm evidence $evidence"; fi ;;
  *)
   if [ "$rc" -eq 0 ] && grep -Eq 'stack: generic' "$TMP/out" \
    && grep -Eq 'pre-push bundle .+not refreshed' "$TMP/out" \
    && ! grep -Eq 'stack: ts-server' "$TMP/out"; then
    PASS=$((PASS+1)); else FAIL=$((FAIL+1)); echo "FAIL: sparse npm evidence $evidence"; fi ;;
 esac
done
echo "PASS=$PASS FAIL=$FAIL"; test "$FAIL" -eq 0
