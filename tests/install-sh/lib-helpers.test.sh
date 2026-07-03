#!/usr/bin/env bash
# tests/install-sh/lib-helpers.test.sh — unit test for setup.d/lib.sh.
#
# Sources setup.d/lib.sh with INSTALL_SH_LIB_ONLY=1 and asserts:
#   1. Every public helper function is declare -F visible (O1 regression check — previously
#      copy_safe/mkdir_safe/chmod_safe were NOT exposed because the guard fired before them).
#   2. transform_internal_refs rewrites repo-internal refs correctly.
#   3. detect_pm returns one of: npm | pnpm | yarn.
#
# CI: invoked from .github/workflows/audit-self.yml (Mechanical checks job).

set -uo pipefail

REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0

ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

# ── Source lib.sh in lib-only mode ───────────────────────────────────────────
LIB_SH="$REPO_ROOT/setup.d/lib.sh"
if [ ! -f "$LIB_SH" ]; then
  echo "ERROR: $LIB_SH not found — Task 3 must be complete before running this test" >&2
  exit 1
fi

# Provide required globals that lib.sh helpers reference
PROJECT_ROOT="$REPO_ROOT"  # used by detect_pm, ignore_shipped_configs, etc.
FORCE=""
DRY_RUN=""
SKIPPED=()

INSTALL_SH_LIB_ONLY=1
# shellcheck disable=SC1090
source "$LIB_SH"

# ── 1. Every helper must be declare -F visible ────────────────────────────────
EXPECTED_HELPERS=(
  transform_internal_refs
  copy_safe
  refresh_safe
  merge_prettierignore
  _prettierignore_in_skipped
  ignore_shipped_configs
  mkdir_safe
  chmod_safe
  detect_pm
  patch_stryker_package_manager
  copy_skill_with_transform
  refresh_skill_with_transform
  generate_eslint_barrel
)

for fn in "${EXPECTED_HELPERS[@]}"; do
  if declare -F "$fn" >/dev/null 2>&1; then
    ok "helper visible: $fn"
  else
    bad "helper NOT visible: $fn (O1 regression — guard fired too early?)"
  fi
done

# ── 2. transform_internal_refs behaviour ─────────────────────────────────────
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

UPSTREAM_BLOB_URL="https://example.test/blob/main"

FIXTURE="$TMPDIR/sample.md"
cat > "$FIXTURE" <<'EOF'
# Sample
- [docs link](../../../docs/meta-factory/foo.md)
- [deep docs](../../../../docs/meta-factory/bar.md)
- [pkg link](../../../packages/core/x.ts)
- [readme](../../../../README.md#anchor)
- [rule link](../../rules/no-paid-llm-in-ci.md)
EOF

transform_internal_refs "$FIXTURE"
OUT=$(cat "$FIXTURE")

echo "$OUT" | grep -qF "https://example.test/blob/main/docs/meta-factory/foo.md" \
  && ok "transform: 3-deep docs/ rewritten" \
  || bad "transform: 3-deep docs/ NOT rewritten; got: $(echo "$OUT" | grep 'foo.md')"

echo "$OUT" | grep -qF "https://example.test/blob/main/docs/meta-factory/bar.md" \
  && ok "transform: 4-deep docs/ rewritten" \
  || bad "transform: 4-deep docs/ NOT rewritten"

echo "$OUT" | grep -qF "https://example.test/blob/main/packages/core/x.ts" \
  && ok "transform: packages/ rewritten" \
  || bad "transform: packages/ NOT rewritten"

echo "$OUT" | grep -qF "https://example.test/blob/main/README.md#anchor" \
  && ok "transform: README.md#anchor preserved through rewrite" \
  || bad "transform: README.md#anchor NOT preserved"

echo "$OUT" | grep -qF "](../../rules/no-paid-llm-in-ci.md)" \
  && ok "transform: rules/ left intact (consumer-resolvable)" \
  || bad "transform: rules/ was modified (leak)"

# ── 3. detect_pm returns one of: npm | pnpm | yarn ───────────────────────────
PROJECT_ROOT="$TMPDIR"
cat > "$TMPDIR/package.json" <<'EOF'
{"name":"test","version":"0.0.0"}
EOF

pm=$(detect_pm)
case "$pm" in
  npm|pnpm|yarn) ok "detect_pm returns valid PM: $pm" ;;
  *) bad "detect_pm returned unexpected value: '$pm'" ;;
esac

# ── 4. ignore_shipped_configs no-op when no .prettierignore ──────────────────
# (just assert it doesn't crash)
PROJECT_ROOT="$TMPDIR"
DRY_RUN=""
ignore_shipped_configs 2>/dev/null && ok "ignore_shipped_configs: no-op without .prettierignore" \
  || bad "ignore_shipped_configs: crashed when .prettierignore absent"

echo ""
echo "Result: $PASS pass / $FAIL fail"
[ "$FAIL" -eq 0 ]
