#!/usr/bin/env bash
# cih-s1 F11 — the shipped CI workflow reads the Node version from .nvmrc
# (`node-version-file: '.nvmrc'`) instead of a hardcoded `node-version: NN`, so the
# AGENTS.md claim "Node pinned in .nvmrc — CI depends on it" is actually true and CI
# can never drift from .nvmrc. F11's fix landed upstream (FQA W6 rewrote the CI
# templates); this test LOCKS it on a real landed consumer so a future hardcode
# regresses loudly. Asserts via the REAL install pipeline (mirror f13-stryker-pm.test.sh)
# for BOTH stacks — ts-server (Hono/flat) and react-next.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

# Substring note: `node-version:` (colon immediately after "version") matches ONLY the
# bare hardcoded form — `node-version-file:` has "-file" before its colon, so it is NOT
# a match. That makes the negative arm a clean regression guard.
assert_stack() {
  local stack="$1"
  local T; T=$(mktemp -d)
  printf '{"name":"f11-%s","version":"0.0.0"}\n' "$stack" > "$T/package.json"
  ( cd "$T" && git init -q && bash "$REPO_ROOT/install.sh" "$stack" --force ) >/dev/null 2>&1
  RC_P50_064=$?
  [ "$RC_P50_064" = 0 ] || bad "f11-ci-node-version: helper install rc=$RC_P50_064, expected 0 (p50-064)"
  local CI="$T/.github/workflows/ci.yml"

  grep -q "node-version-file: '.nvmrc'" "$CI" 2>/dev/null \
    && ok "$stack: shipped ci.yml reads node-version-file: '.nvmrc'" \
    || bad "$stack: ci.yml does NOT use node-version-file ($(grep -n node-version "$CI" 2>/dev/null | head -1))"

  # neg (load-bearing): no bare `node-version: NN` hardcode survives in the shipped CI.
  if grep -q "node-version:" "$CI" 2>/dev/null; then
    bad "$stack-neg: a hardcoded 'node-version:' leaked into shipped ci.yml (F11 regressed)"
  else
    ok "$stack-neg: no hardcoded 'node-version:' — CI can only resolve via .nvmrc"
  fi

  # consistency: .nvmrc must ship non-empty, else node-version-file has nothing to read.
  [ -s "$T/.nvmrc" ] \
    && ok "$stack: .nvmrc shipped non-empty ($(tr -d '\n' < "$T/.nvmrc")) — CI + .nvmrc cannot drift" \
    || bad "$stack: .nvmrc absent/empty — node-version-file would fail"
}

assert_stack ts-server
assert_stack react-next

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
