#!/usr/bin/env bash
# critical-review S5-9 (interim, operator decision 2026-09-23) — setup.d/80-rule-bootstrap.sh ran
# the generator as `( … ) || true`: when it could not run at all (the published getff package
# ships none of the generator's dependencies — tsx, ajv) the consumer's research produced no rule
# and the install said nothing. The step must now say the generation FAILED and list it under the
# final «NOT wired» summary; it still never aborts the install.
#
# ARMS:
#   (A) generator exits non-zero → loud FAILED line + one NOT_WIRED entry, layer returns 0
#   (B) paired negative: generator exits 0 → no FAILED line, NOT_WIRED stays empty
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

run_layer() {  # $1 = exit code of the stub generator; prints layer output, then NOT_WIRED count
  local rc="$1" W
  W=$(mktemp -d)
  mkdir -p "$W/pkg/packages/core/install" "$W/proj/.ai-factory/rules-research" "$W/bin"
  : > "$W/pkg/packages/core/install/rule-bootstrap-cli.ts"
  echo '{}' > "$W/proj/.ai-factory/rules-research/ts-server.research.json"
  echo '{}' > "$W/proj/.ai-factory/rules-research/ts-server.selection.json"
  printf '#!/bin/sh\necho "stub generator"\nexit %s\n' "$rc" > "$W/bin/npx"; chmod +x "$W/bin/npx"
  (
    PATH="$W/bin:$PATH"; FULL=--full; DRY_RUN=""; STACK=ts-server
    PKG_ROOT="$W/pkg"; PROJECT_ROOT="$W/proj"; NOT_WIRED=()
    # shellcheck disable=SC1090
    INSTALL_SH_LIB_ONLY=1 source "$REPO_ROOT/setup.d/lib.sh"
    ensure_workspace_pkg_links() { :; }
    # shellcheck disable=SC1090
    source "$REPO_ROOT/setup.d/80-rule-bootstrap.sh"; echo "LAYER_RC=$?"
    echo "NOT_WIRED_COUNT=${#NOT_WIRED[@]}"
    [ "${#NOT_WIRED[@]}" -gt 0 ] && printf 'NOT_WIRED: %s\n' "${NOT_WIRED[@]}"
  ) 2>&1
  rm -rf "$W"
}

_out=$(run_layer 1)
echo "$_out" | grep -q 'LAYER_RC=0' && ok "(A) the layer still returns 0 (never aborts the install)" || bad "(A) the layer did not return 0 (got: $_out)"
echo "$_out" | grep -q 'FAILED' && ok "(A) a loud FAILED line names the failed generation" || bad "(A) no FAILED line (got: $_out)"
echo "$_out" | grep -q 'NOT_WIRED_COUNT=1' && ok "(A) the failure is listed under NOT wired" || bad "(A) NOT_WIRED not recorded (got: $_out)"
echo "$_out" | grep -q 'NOT_WIRED: .*rules-research' && ok "(A) the NOT wired line names the research the rules came from" || bad "(A) NOT wired line lacks the research path"

_out=$(run_layer 0)
echo "$_out" | grep -q 'FAILED' && bad "(B) FAILED printed for a successful generation" || ok "(B) a successful generation prints no FAILED line"
echo "$_out" | grep -q 'NOT_WIRED_COUNT=0' && ok "(B) a successful generation records nothing as not wired" || bad "(B) NOT_WIRED recorded on success (got: $_out)"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
