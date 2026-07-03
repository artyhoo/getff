#!/usr/bin/env bash
# check-fences-fire-full-barrel.test.sh — #838: prove the shipped check-fences-fire gate
# works against the install-generated FULL barrel, in framework CI, for every fence class —
# including stack-specific R12 no-server-imports-in-client, which the paired-negative
# test's (pos) arm deliberately excludes (R12 is a preset rule absent from the source
# core plugin; see check-fences-fire-paired-negative.test.sh).
#
# Also covers the #838 sibling defect: fixtures used to ship unconditionally while
# stack-specific rules land per-stack, so on non-next stacks the gate probed a rule the
# barrel does not export → linter.verify THROWS ("Could not find <rule> in plugin") →
# check:fences-fire false-REDs on every ts-server / react-spa / react-native install.
# 40-configs.sh now filters shipped fixtures by the generated barrel; arm (partial)
# asserts that end-to-end.
#
# ARMS:
#   (full)    install react-next into a mktemp fixture (real install.sh run), symlink a
#             node_modules tree, run the INSTALLED scripts/check-fences-fire.sh via its
#             consumer self-resolution path → MUST exit 0 with PASS=3 FAIL=0 and R12 ACTIVE.
#   (teeth)   neuter the R12 rule inside the installed barrel (same named export, create()
#             that never reports) → gate MUST exit non-zero with FENCE SILENT for R12.
#             Proves arm (full) is non-vacuous: a dead R12 cannot slip through as PASS.
#   (partial) install ts-server → R12 fixture must be ABSENT from the installed tree
#             (barrel-filtered by 40-configs.sh) and the gate MUST exit 0 with PASS=2 —
#             a partial-barrel stack is not false-RED.
#
# SKIP condition: tsx or eslint not resolvable (same graceful-degrade as the gate itself).
# rc=0 on SKIP, rc=1 on any arm FAIL.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

PASS=0; FAIL=0; SKIP=0
ok()   { PASS=$((PASS+1)); echo "✓ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "✗ $1"; }
skip() { SKIP=$((SKIP+1)); echo "· $1"; }

# ─── Tool resolution (same search order as the gate + paired-negative test) ───
TSX_BIN=""
for _t in \
  "$REPO_ROOT/node_modules/.bin/tsx" \
  "$REPO_ROOT/packages/core/node_modules/.bin/tsx" \
  "/app/node_modules/.bin/tsx"; do
  [ -x "$_t" ] && TSX_BIN="$_t" && break
done

ESLINT_BIN=""
for _e in \
  "$REPO_ROOT/node_modules/.bin/eslint" \
  "$REPO_ROOT/packages/core/node_modules/.bin/eslint" \
  "/app/node_modules/.bin/eslint"; do
  [ -x "$_e" ] && ESLINT_BIN="$_e" && break
done

if [ -z "$TSX_BIN" ] || [ -z "$ESLINT_BIN" ]; then
  skip "(full) tsx or eslint not found — all arms SKIP (graceful degrade, same condition as the gate)"
  skip "(teeth) same reason"
  skip "(partial) same reason"
  echo ""
  echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
  exit 0
fi

NM_SRC="$(dirname "$(dirname "$ESLINT_BIN")")"

# Single EXIT trap for every fixture this test creates (a second `trap … EXIT`
# would REPLACE the first and leak the earlier dir — see paired-negative test).
FIXTURE_NEXT=""; FIXTURE_TS=""
trap '[ -n "$FIXTURE_NEXT" ] && rm -rf "$FIXTURE_NEXT"; [ -n "$FIXTURE_TS" ] && rm -rf "$FIXTURE_TS"' EXIT

# install_consumer <fixture_dir> <stack> — real install.sh run, snapshot.sh pattern.
install_consumer() {
  local fixture="$1" stack="$2"
  printf '{"name":"full-barrel-test","version":"0.0.0"}\n' > "$fixture/package.json"
  ( cd "$fixture" && git init -q && git config user.email "test@test.com" && git config user.name "Test" ) >/dev/null 2>&1
  ( cd "$fixture" && bash "$REPO_ROOT/install.sh" "$stack" --force < /dev/null ) > "$fixture/.install.log" 2>&1
}

# ─── Arm (full): react-next FULL barrel — every fence ACTIVE, including R12 ───
FIXTURE_NEXT=$(mktemp -d)
install_consumer "$FIXTURE_NEXT" react-next
if [ ! -f "$FIXTURE_NEXT/scripts/check-fences-fire.sh" ] || [ ! -f "$FIXTURE_NEXT/eslint-rules-local/index.mjs" ]; then
  bad "(full) install did not ship gate script + barrel (install log tail: $(tail -3 "$FIXTURE_NEXT/.install.log" | tr '\n' '|'))"
else
  ln -sf "$NM_SRC" "$FIXTURE_NEXT/node_modules"
  FULL_OUT=$( cd "$FIXTURE_NEXT" && bash scripts/check-fences-fire.sh 2>&1 )
  FULL_RC=$?
  if [ "$FULL_RC" -eq 0 ] \
     && echo "$FULL_OUT" | grep -q 'PASS=3 FAIL=0' \
     && echo "$FULL_OUT" | grep -q '\[no-server-imports-in-client\].*ACTIVE'; then
    ok "(full) react-next FULL barrel: gate exits 0, PASS=3 FAIL=0, R12 no-server-imports-in-client ACTIVE"
  else
    bad "(full) react-next FULL barrel: expected rc=0 + PASS=3 + R12 ACTIVE, got rc=$FULL_RC"
    echo "    gate output: $(echo "$FULL_OUT" | tail -8 | tr '\n' '|')"
  fi

  # ─── Arm (teeth): neuter R12 in the installed barrel → gate must go RED ───
  # Same named export the generated barrel imports; create() never reports, so the rule
  # is registered but silent — exactly the liveness failure the gate exists to catch.
  cat > "$FIXTURE_NEXT/eslint-rules-local/no-server-imports-in-client.mjs" << 'EOF'
// TEST-NEUTERED rule: registered under the same export, never reports.
export const noServerImportsInClient = { meta: { type: 'problem', schema: [] }, create: () => ({}) };
EOF
  TEETH_OUT=$( cd "$FIXTURE_NEXT" && bash scripts/check-fences-fire.sh 2>&1 )
  TEETH_RC=$?
  if [ "$TEETH_RC" -ne 0 ] && echo "$TEETH_OUT" | grep -q 'FENCE SILENT.*no-server-imports-in-client'; then
    ok "(teeth) neutered R12 in installed barrel → gate exits non-zero with FENCE SILENT — arm (full) is non-vacuous"
  else
    bad "(teeth) neutered R12: expected rc!=0 + FENCE SILENT for no-server-imports-in-client, got rc=$TEETH_RC"
    echo "    gate output: $(echo "$TEETH_OUT" | tail -8 | tr '\n' '|')"
  fi
fi

# ─── Arm (partial): ts-server — R12 fixture filtered out, gate green on partial barrel ───
FIXTURE_TS=$(mktemp -d)
install_consumer "$FIXTURE_TS" ts-server
if [ ! -f "$FIXTURE_TS/scripts/check-fences-fire.sh" ] || [ ! -f "$FIXTURE_TS/eslint-rules-local/index.mjs" ]; then
  bad "(partial) install did not ship gate script + barrel (install log tail: $(tail -3 "$FIXTURE_TS/.install.log" | tr '\n' '|'))"
else
  if ls "$FIXTURE_TS/scripts/fences-fire-fixtures/no-server-imports-in-client".* >/dev/null 2>&1; then
    bad "(partial) ts-server shipped the R12 fixture despite the rule being absent from its barrel — 40-configs filter broken"
  else
    ok "(partial) ts-server: R12 fixture correctly filtered out of the installed tree (rule not in barrel)"
  fi
  ln -sf "$NM_SRC" "$FIXTURE_TS/node_modules"
  PART_OUT=$( cd "$FIXTURE_TS" && bash scripts/check-fences-fire.sh 2>&1 )
  PART_RC=$?
  if [ "$PART_RC" -eq 0 ] && echo "$PART_OUT" | grep -q 'PASS=2 FAIL=0'; then
    ok "(partial) ts-server partial barrel: gate exits 0 with PASS=2 FAIL=0 — no false-RED on a stack without R12"
  else
    bad "(partial) ts-server partial barrel: expected rc=0 + PASS=2 FAIL=0, got rc=$PART_RC"
    echo "    gate output: $(echo "$PART_OUT" | tail -8 | tr '\n' '|')"
  fi
fi

# ─── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
[ "$FAIL" -eq 0 ]
