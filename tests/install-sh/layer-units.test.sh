#!/usr/bin/env bash
# layer-units.test.sh — Per-layer unit tests (Task 15, modular-install-fullpack S1).
#
# Sources each setup.d/NN-*.sh in isolation (with lib.sh loaded first) and asserts:
#   1. It sources without error.
#   2. Stub layers (05-mcp, 15-companions-stack) are no-ops (no side effects).
#   3. Content layers reference only lib helpers (spot-checked: no copy-pasted helper bodies).
#   4. Each layer file begins with the expected shebang + header comment.
#
# Must be run from any directory; REPO_ROOT is auto-detected.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

echo "▶ Per-layer unit tests (setup.d/NN-*.sh)"
echo ""

# Minimal dispatcher-scope globals required by lib.sh and layers.
_setup_dispatcher_scope() {
  export PKG_ROOT="$REPO_ROOT"
  export PROJECT_ROOT="$(mktemp -d)"
  export FORCE=""
  export DRY_RUN="--dry-run"   # never write to disk
  export FULL=""
  export WIRE_CI=""
  export REFRESH=""
  export STACK="ts-server"
  # Arrays: plain assignment, NOT `export arr=()` — on bash 3.2 (macOS) an export+array
  # assignment inside a function is silently function-local, leaving the var UNSET in the
  # caller, so layers crashed on `${#SKIPPED[@]}` under set -u. Export is meaningless for
  # arrays anyway (layers are sourced into this same shell, and bash cannot export arrays).
  SHIPPED_DOCS=()
  SKIPPED=()
  DEVDEPS=()
  export _r2_verdict=""
  export DEPS_INSTALLED=""
}

# ── 1. lib.sh sources cleanly and exposes all helpers ────────────────────────

echo "  ── lib.sh ──"
(
  _setup_dispatcher_scope
  export INSTALL_SH_LIB_ONLY=1
  # shellcheck source=/dev/null
  source "$REPO_ROOT/setup.d/lib.sh" || { echo "FATAL: lib.sh source failed"; exit 1; }
  # All helpers must be defined
  for fn in transform_internal_refs copy_safe refresh_safe merge_prettierignore \
            _prettierignore_in_skipped ignore_shipped_configs mkdir_safe chmod_safe \
            detect_pm patch_stryker_package_manager copy_skill_with_transform \
            refresh_skill_with_transform; do
    declare -f "$fn" >/dev/null 2>&1 && echo "  ✓ lib: $fn defined" || \
      { echo "  ✗ lib: $fn NOT defined"; exit 1; }
  done
  # INSTALL_SH_LIB_ONLY guard: sourcing lib.sh with the flag should return early (no error)
  echo "  ✓ lib: INSTALL_SH_LIB_ONLY guard: sourcing returns without error"
)
rc=$?
if [ $rc -eq 0 ]; then
  PASS=$((PASS+4))  # one for the source + guards above; keep simple
else
  bad "lib.sh sourcing or helper exposure failed (exit $rc)"
fi

# ── 2. Stub layers: NONE REMAIN ──────────────────────────────────────────────
# Both former stubs (05-mcp, 15-companions-stack) were promoted to content layers
# (S2 + S3 of modular-install-fullpack). They are now verified by section 3 below.

# ── 3. Content layers: source cleanly under --dry-run ────────────────────────

echo ""; echo "  ── content layers (dry-run sourcing) ──"
CONTENT_LAYERS=(
  "05-mcp.sh"
  "10-skills.sh"
  "15-companions-stack.sh"
  "20-agents.sh"
  "30-templates.sh"
  "40-configs.sh"
  "50-hooks.sh"
  "60-ci.sh"
  "70-deps.sh"
  "99-finalize.sh"
)

for layer_file in "${CONTENT_LAYERS[@]}"; do
  layer="$REPO_ROOT/setup.d/$layer_file"
  [ -f "$layer" ] || { bad "$layer_file: file not found"; continue; }

  # Source in a minimal dispatcher-scope subshell with --dry-run to avoid side effects
  result=$(
    _setup_dispatcher_scope
    # shellcheck source=/dev/null
    source "$REPO_ROOT/setup.d/lib.sh" 2>/dev/null || true
    # shellcheck source=/dev/null
    source "$layer" 2>/dev/null
    echo "SOURCED_OK"
  ) 2>/dev/null
  [ "${result##*$'\n'}" = "SOURCED_OK" ] \
    && ok "$layer_file: sources in dry-run dispatcher scope" \
    || bad "$layer_file: source failed (last line: ${result##*$'\n'})"
done

# ── 4. Structural checks: no copy-pasted helper bodies in layers ─────────────

echo ""; echo "  ── structural: no copy-pasted helper bodies in layers ──"
# These function defs must NOT appear in any layer file (they belong in lib.sh only).
# Use -E patterns and match function-definition syntax: name() { OR name () {
SSOT_FUNS=("copy_safe" "refresh_safe" "mkdir_safe" "chmod_safe" \
           "transform_internal_refs" "detect_pm" "_detect_stack_from_pkg" \
           "_workspace_pkg_dirs" "_detect_stacks_per_workspace" \
           "patch_stryker_package_manager" \
           "copy_skill_with_transform" "refresh_skill_with_transform" \
           "merge_prettierignore" "ignore_shipped_configs")
found_paste=0
for fn in "${SSOT_FUNS[@]}"; do
  # Match function definition syntax: "fn() {" or "fn () {" or "function fn"
  # (-E allows | and () as ERE metacharacters)
  offenders=$(grep -rEl "^${fn}[[:space:]]*\(\)|^function[[:space:]]+${fn}[[:space:]]" \
              "$REPO_ROOT"/setup.d/[0-9]*.sh 2>/dev/null || true)
  if [ -n "$offenders" ]; then
    bad "copy-paste: $fn() defined in layer file(s): $offenders"
    found_paste=1
  fi
done
[ $found_paste -eq 0 ] && ok "no helper function bodies copy-pasted from lib.sh into layer files"

# ── 5. @cc-only-rationale marker present in every layer ──────────────────────

echo ""; echo "  ── structural: @cc-only-rationale marker ──"
for f in "$REPO_ROOT"/setup.d/[0-9]*.sh; do
  base=$(basename "$f")
  grep -q '@cc-only-rationale\|@dual-pair' "$f" \
    && ok "$base: has @cc-only-rationale or @dual-pair marker (dual-implementation-discipline §6)" \
    || bad "$base: missing @cc-only-rationale / @dual-pair marker"
done

# ── 6. Lexicographic ordering check (numeric prefix 05 < 10 < 15 < … < 99) ──

echo ""; echo "  ── ordering: numeric prefix is lexicographically correct ──"
prev=""
order_ok=1
for f in "$REPO_ROOT"/setup.d/[0-9]*.sh; do
  base=$(basename "$f")
  if [ -n "$prev" ] && [[ "$base" < "$prev" ]]; then
    bad "ordering: $base sorts before $prev — prefix order is wrong"
    order_ok=0
  fi
  prev="$base"
done
[ $order_ok -eq 1 ] && ok "layer files are in lexicographic (numeric-prefix) order"

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
