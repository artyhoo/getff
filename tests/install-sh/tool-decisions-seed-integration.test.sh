#!/usr/bin/env bash
# tool-decisions-seed-integration.test.sh — FQA-B F-B gap (Task 1, modular-install-fullpack S3).
#
# Integration test: 30-templates.sh (install layer) seeds .ai-factory/tool-decisions.md with the
# <pending> sentinel, and deps-hash-check.sh subsequently fires the "not yet baselined" WARN.
#
# The unit tests in deps-hash-check.test.ts fabricate the state file directly — this test
# validates the LIVE install→seed→detect chain that was dead-on-arrival per FQA-B P1.
#
# Must be run from any directory; REPO_ROOT is auto-detected.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

echo "▶ install→seed→detect integration (FQA-B F-B)"
echo ""

# ── 1. Seed phase: run 30-templates.sh and verify tool-decisions.md is created ────────────

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

seed_out=$(
  export PKG_ROOT="$REPO_ROOT"
  export PROJECT_ROOT="$TMP"
  export FORCE=""
  export DRY_RUN=""          # real write (not dry-run)
  export FULL=""
  export WIRE_CI=""
  export REFRESH=""
  export STACK="ts-server"
  export SHIPPED_DOCS=()
  export SKIPPED=()
  export _r2_verdict=""
  export DEPS_INSTALLED=""
  export DEVDEPS=()
  # shellcheck source=/dev/null
  source "$REPO_ROOT/setup.d/lib.sh"
  # shellcheck source=/dev/null
  source "$REPO_ROOT/setup.d/30-templates.sh"
  echo "LAYER_COMPLETE"
) 2>&1

if echo "$seed_out" | grep -q "LAYER_COMPLETE"; then
  ok "30-templates.sh sourced cleanly (LAYER_COMPLETE emitted)"
else
  bad "30-templates.sh failed to source cleanly: $seed_out"
fi

# Verify the file was created
DECISIONS="$TMP/.ai-factory/tool-decisions.md"
[ -f "$DECISIONS" ] \
  && ok "tool-decisions.md seeded at .ai-factory/tool-decisions.md" \
  || bad "tool-decisions.md NOT found at .ai-factory/tool-decisions.md"

# Verify the file contains the <pending> sentinel (FQA-B: the sentinel triggers the WARN path)
grep -q "^deps-hash:" "$DECISIONS" \
  && ok "tool-decisions.md has deps-hash: frontmatter line" \
  || bad "tool-decisions.md missing deps-hash: line"

STORED_HASH=$(grep -m1 "^deps-hash:" "$DECISIONS" | sed 's/^deps-hash:[[:space:]]*//')
case "$STORED_HASH" in
  sha256-*)
    bad "deps-hash is already a real sha256 hash — expected <pending> sentinel, got: $STORED_HASH"
    ;;
  "")
    bad "deps-hash: line is empty — expected <pending> sentinel"
    ;;
  *)
    ok "deps-hash: is the <pending> sentinel (not a stamped hash): $(printf '%s' "$STORED_HASH" | head -c 40)"
    ;;
esac

# ── 2. Detect phase: run deps-hash-check.sh from the seeded consumer root ─────────────────

# Seed a minimal package.json so the hook can compute a hash
printf '{"dependencies":{"vitest":"^2.0.0"},"devDependencies":{"typescript":"^5.0.0"}}' \
  > "$TMP/package.json"

HOOK="$REPO_ROOT/.claude/hooks/deps-hash-check.sh"

hook_out=$(cd "$TMP" && bash "$HOOK" 2>&1) || true
hook_status=$?

[ "$hook_status" -eq 0 ] \
  && ok "deps-hash-check.sh exits 0 (non-blocking, context-injection only)" \
  || bad "deps-hash-check.sh exited $hook_status (must always exit 0)"

# The "not yet baselined" path fires when stored hash is not sha256- (i.e. the <pending> sentinel)
if echo "$hook_out" | grep -qi "not yet baselined"; then
  ok "deps-hash-check.sh fires 'not yet baselined' WARN (seed→detect chain live)"
else
  bad "deps-hash-check.sh did NOT emit 'not yet baselined' WARN — chain broken"
  echo "    hook output was: $(printf '%s' "$hook_out" | head -3)"
fi

# Verify it does NOT emit the "deps changed" message (reserved for real drift, not pending state)
if echo "$hook_out" | grep -qi "deps changed"; then
  bad "deps-hash-check.sh emitted 'deps changed' for a <pending> state — wrong message path"
else
  ok "deps-hash-check.sh correctly uses 'not yet baselined' path (not 'deps changed') for pending state"
fi

# ── 3. python-seed variant (DH-S3 backward-sweep sibling of section 2) ─────────────────────
# The seed template carries deps-hash-python: <pending> (DH-S1), so a fresh PYTHON consumer
# (pyproject.toml, no package.json) must get the same onboarding nudge the JS consumer gets.
# Characterization: this already passes on the current template — it locks the python seed→detect
# chain against a future template regression that drops the python key.

PYDIR="$TMP/py-consumer"
mkdir -p "$PYDIR/.ai-factory"
cp "$DECISIONS" "$PYDIR/.ai-factory/tool-decisions.md"
printf '[tool.poetry.dependencies]\nflask = "^2.0"\n' > "$PYDIR/pyproject.toml"

py_out=$(cd "$PYDIR" && bash "$HOOK" 2>&1) || true
if echo "$py_out" | grep -qi "not yet baselined"; then
  ok "python-seed: pyproject-only consumer fires 'not yet baselined' (deps-hash-python: <pending> seeded)"
else
  bad "python-seed: pyproject-only consumer did NOT fire 'not yet baselined' — python seed→detect chain broken"
  echo "    hook output was: $(printf '%s' "$py_out" | head -3)"
fi

# ── 4. cargo-seed variant (DH-S3 backward-sweep finding — parity gap DH-S2 left) ──────────
# DH-S2 shipped Cargo.toml DETECTION + the deps-hash-cargo storage key (decision-format.md:21),
# but the seed template was NOT updated to carry deps-hash-cargo: <pending>. Result: a fresh
# RUST consumer gets ZERO onboarding nudge — breaking the umbrella mission ("staleness detector
# covers all three stacks") for the third stack. This assertion is RED until the template gains
# the deps-hash-cargo: <pending> line (commit C), at which point rust reaches python/JS parity.

CARGODIR="$TMP/cargo-consumer"
mkdir -p "$CARGODIR/.ai-factory"
cp "$DECISIONS" "$CARGODIR/.ai-factory/tool-decisions.md"
printf '[dependencies]\nserde = "1.0"\n' > "$CARGODIR/Cargo.toml"

cargo_out=$(cd "$CARGODIR" && bash "$HOOK" 2>&1) || true
if echo "$cargo_out" | grep -qi "not yet baselined"; then
  ok "cargo-seed: Cargo.toml-only consumer fires 'not yet baselined' (deps-hash-cargo: <pending> seeded)"
else
  bad "cargo-seed: Cargo.toml-only consumer did NOT fire 'not yet baselined' — deps-hash-cargo missing from seed template (fresh-install parity gap with python/JS)"
  echo "    hook output was: $(printf '%s' "$cargo_out" | head -3)"
fi

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
