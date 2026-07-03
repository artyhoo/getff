#!/usr/bin/env bash
# b4-worktree-workspace-resolve.test.sh — #827 B4 paired-negative.
#
# Proves ensure_workspace_pkg_links() (setup.d/lib.sh) self-heals @rules-as-tests/* resolution
# for a framework PKG_ROOT whose node_modules lacks the workspace package links — the exact
# state of a git worktree whose node_modules was borrowed from a primary checkout on a divergent
# branch (the #827 B4 crash: gate-rule-tester.ts → ERR_MODULE_NOT_FOUND @rules-as-tests/preset-*).
#
# Arms (each able to fail; T1/T14 non-vacuity):
#   NEG (pre-heal)  — a synthetic PKG_ROOT with packages/preset-react-spa present but a REAL,
#                     EMPTY node_modules ⇒ require.resolve(@rules-as-tests/preset-react-spa/
#                     eslint-rules) FAILS. Establishes the crash precondition.
#   POS (post-heal) — after ensure_workspace_pkg_links, the same resolve SUCCEEDS and the
#                     worktree-local symlink points at the PKG_ROOT's OWN package.
#   GUARD           — when node_modules is a BORROWED symlink, the helper does NOT write through
#                     it (no foreign pollution) and emits the self-contain guidance instead.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
skip() { echo "  · $1"; }

if ! command -v node >/dev/null 2>&1; then
  skip "node not available — B4 self-heal test skipped (degrade-on-absent)"
  echo ""; echo "PASS=$PASS FAIL=$FAIL"; exit 0
fi

echo "▶ #827 B4 — ensure_workspace_pkg_links self-heals @rules-as-tests/* from a worktree PKG_ROOT"
echo ""

# Load the helper in isolation (lib-only guard exposes it without running the dispatcher).
# shellcheck source=/dev/null
INSTALL_SH_LIB_ONLY=1 source "$REPO_ROOT/setup.d/lib.sh"
if ! declare -f ensure_workspace_pkg_links >/dev/null 2>&1; then
  bad "ensure_workspace_pkg_links not defined by setup.d/lib.sh"
  echo ""; echo "PASS=$PASS FAIL=$FAIL"; exit 1
fi

# Build a synthetic PKG_ROOT: a minimal @rules-as-tests/preset-react-spa package with an
# eslint-rules export, plus a REAL (empty) node_modules — the worktree-with-no-links state.
WT=$(mktemp -d)
mkdir -p "$WT/packages/preset-react-spa/eslint-rules" "$WT/node_modules"
cat > "$WT/packages/preset-react-spa/package.json" <<'JSON'
{
  "name": "@rules-as-tests/preset-react-spa",
  "version": "0.0.0",
  "type": "module",
  "exports": { "./eslint-rules": "./eslint-rules/index.mjs" }
}
JSON
printf 'export default { rules: {} };\n' > "$WT/packages/preset-react-spa/eslint-rules/index.mjs"

_resolves() { ( cd "$WT" && node -e 'require.resolve("@rules-as-tests/preset-react-spa/eslint-rules")' ) >/dev/null 2>&1; }

# ── NEG (pre-heal): resolution FAILS ─────────────────────────────────────────
if _resolves; then
  bad "NEG: @rules-as-tests/preset-react-spa resolved BEFORE heal — precondition not established (test vacuous)"
else
  ok "NEG: @rules-as-tests/preset-react-spa does NOT resolve before heal (crash precondition established)"
fi

# ── POS (post-heal): helper links the workspace package, resolution SUCCEEDS ──
ensure_workspace_pkg_links "$WT" >/dev/null 2>&1
if _resolves; then
  ok "POS: ensure_workspace_pkg_links healed resolution — factory imports now resolve from the worktree"
else
  bad "POS: resolution STILL fails after ensure_workspace_pkg_links (B4 unfixed)"
fi
# The created link must point at the worktree's OWN package (not a foreign checkout).
_link="$WT/node_modules/@rules-as-tests/preset-react-spa"
if [ -L "$_link" ] && [ "$(cd "$(dirname "$_link")" && cd "$(readlink "$_link")" && pwd)" = "$WT/packages/preset-react-spa" ]; then
  ok "POS: worktree-local link points at the PKG_ROOT's OWN packages/preset-react-spa"
else
  bad "POS: link missing or points elsewhere ($_link → $(readlink "$_link" 2>/dev/null || echo none))"
fi

# ── GUARD: borrowed (symlinked) node_modules is NOT written through ──────────
WT2=$(mktemp -d); FOREIGN=$(mktemp -d)
mkdir -p "$WT2/packages/preset-react-spa/eslint-rules" "$FOREIGN"
cp "$WT/packages/preset-react-spa/package.json" "$WT2/packages/preset-react-spa/package.json"
printf 'export default { rules: {} };\n' > "$WT2/packages/preset-react-spa/eslint-rules/index.mjs"
ln -s "$FOREIGN" "$WT2/node_modules"   # borrowed node_modules (symlink to a foreign checkout)
guard_out=$(ensure_workspace_pkg_links "$WT2" 2>&1)
if [ -e "$FOREIGN/@rules-as-tests" ]; then
  bad "GUARD: helper wrote @rules-as-tests INTO the borrowed (foreign) node_modules — pollution"
elif echo "$guard_out" | grep -q "borrowed symlink"; then
  ok "GUARD: borrowed-symlink node_modules left untouched; self-contain guidance emitted"
else
  bad "GUARD: unexpected behaviour on borrowed symlink — $(echo "$guard_out" | tr '\n' '|' | head -c 160)"
fi

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
