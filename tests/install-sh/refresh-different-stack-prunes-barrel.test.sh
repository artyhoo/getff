#!/usr/bin/env bash
# refresh-different-stack-prunes-barrel.test.sh — #882: install.sh <stack> --force/--refresh
# with a DIFFERENT --stack than a prior install must prune the prior stack's stray preset-rule
# files from eslint-rules-local/, not just re-derive the barrel from whatever's on disk.
#
# Root cause: do_refresh() / the full-install copy path only ADD/OVERWRITE the CURRENT stack's
# rule files (setup.d/40-configs.sh conditional copy, install.sh's do_refresh refresh loop) —
# neither ever removes a DIFFERENT stack's leftover preset-rule file. generate_eslint_barrel()
# (setup.d/lib.sh) then regenerates the barrel from an unconditional glob of
# eslint-rules-local/*.ts, so a stranded rule from a PRIOR stack gets re-registered.
#
# Paired-negative shape: arm 2 proves the defect via --force; arm 3 proves it via --refresh
# (both call sites share generate_eslint_barrel, so one fix covers both).
#
# Deterministic, no network: real install.sh runs into mktemp fixtures, mirroring
# tests/install-sh/refresh-regenerates-barrel.test.sh's pattern. Graceful skip (rc=0) if
# install.sh cannot complete in this env.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INSTALL="$REPO_ROOT/install.sh"

PASS=0; FAIL=0; SKIP=0
ok()   { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
skip() { SKIP=$((SKIP+1)); echo "  · $1"; }

[ -f "$INSTALL" ] || { echo "FATAL: $INSTALL not found"; exit 1; }

# barrel_keys <dir> — sorted, unique rule-keys registered in a barrel index.mjs.
barrel_keys() {
  grep -oE "^    '[a-z0-9-]+':" "$1/eslint-rules-local/index.mjs" 2>/dev/null | sed -E "s/^    '//; s/'://" | sort -u
}

BASELINE=$(mktemp -d)
FIXTURE_A=$(mktemp -d)
FIXTURE_B=$(mktemp -d)
trap 'rm -rf "$BASELINE" "$FIXTURE_A" "$FIXTURE_B"' EXIT

# ── Arm 1 (setup): fresh baseline — what a CLEAN ts-server --force install's barrel looks like ──
printf '{"name":"baseline-ts-server","version":"0.0.0"}\n' > "$BASELINE/package.json"
( cd "$BASELINE" && git init -q && git config user.email "test@test.com" && git config user.name "Test" ) >/dev/null 2>&1
( cd "$BASELINE" && bash "$INSTALL" ts-server --force < /dev/null ) > "$BASELINE/.install.log" 2>&1
BASELINE_RC=$?

if [ "$BASELINE_RC" -ne 0 ] || [ ! -f "$BASELINE/eslint-rules-local/index.mjs" ]; then
  skip "(all arms) baseline ts-server install could not complete in this env (rc=$BASELINE_RC, log tail: $(tail -5 "$BASELINE/.install.log" 2>/dev/null | tr '\n' '|'))"
  echo ""
  echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
  exit 0
fi
BASELINE_KEYS=$(barrel_keys "$BASELINE")
ok "(setup) clean ts-server --force barrel key-set: [$(echo "$BASELINE_KEYS" | tr '\n' ',')]"

# ── Arm 2 (stack switch via --force): react-next --force, then ts-server --force, same dir ──
printf '{"name":"switch-via-force","version":"0.0.0"}\n' > "$FIXTURE_A/package.json"
( cd "$FIXTURE_A" && git init -q && git config user.email "test@test.com" && git config user.name "Test" ) >/dev/null 2>&1
( cd "$FIXTURE_A" && bash "$INSTALL" react-next --force < /dev/null ) > "$FIXTURE_A/.i1.log" 2>&1
A1_RC=$?

if [ "$A1_RC" -ne 0 ] || [ ! -f "$FIXTURE_A/eslint-rules-local/no-server-imports-in-client.ts" ]; then
  bad "(arm 2, setup) react-next --force did not produce no-server-imports-in-client.ts — fixture assumption broke (rc=$A1_RC)"
else
  ok "(arm 2, setup) react-next --force produced no-server-imports-in-client.ts"

  ( cd "$FIXTURE_A" && bash "$INSTALL" ts-server --force < /dev/null ) > "$FIXTURE_A/.i2.log" 2>&1
  A2_RC=$?
  if [ "$A2_RC" -ne 0 ]; then
    bad "(arm 2) install.sh ts-server --force exited non-zero (rc=$A2_RC, log tail: $(tail -8 "$FIXTURE_A/.i2.log" | tr '\n' '|'))"
  else
    ok "(arm 2) install.sh ts-server --force (stack switch) completed rc=0"
  fi

  STRAY_COUNT_A=$(find "$FIXTURE_A/eslint-rules-local" -maxdepth 1 -name 'no-server-imports-in-client.*' 2>/dev/null | wc -l | tr -d ' ')
  if [ "$STRAY_COUNT_A" -eq 0 ]; then
    ok "(arm 2, pos) no-server-imports-in-client.* pruned from disk after stack switch via --force"
  else
    bad "(arm 2, pos) no-server-imports-in-client.* still on disk after --force stack switch ($STRAY_COUNT_A file(s)) — the #882 bug"
  fi

  A_KEYS=$(barrel_keys "$FIXTURE_A")
  if [ "$A_KEYS" = "$BASELINE_KEYS" ]; then
    ok "(arm 2, pos) barrel key-set after --force stack switch matches a clean ts-server install exactly"
  else
    bad "(arm 2, pos) barrel key-set diverges from clean ts-server baseline — got:[$(echo "$A_KEYS" | tr '\n' ',')] want:[$(echo "$BASELINE_KEYS" | tr '\n' ',')]"
  fi
fi

# ── Arm 3 (stack switch via --refresh): react-next --force, then ts-server --refresh, same dir ──
printf '{"name":"switch-via-refresh","version":"0.0.0"}\n' > "$FIXTURE_B/package.json"
( cd "$FIXTURE_B" && git init -q && git config user.email "test@test.com" && git config user.name "Test" ) >/dev/null 2>&1
( cd "$FIXTURE_B" && bash "$INSTALL" react-next --force < /dev/null ) > "$FIXTURE_B/.i1.log" 2>&1
B1_RC=$?

if [ "$B1_RC" -ne 0 ] || [ ! -f "$FIXTURE_B/eslint-rules-local/no-server-imports-in-client.ts" ]; then
  bad "(arm 3, setup) react-next --force did not produce no-server-imports-in-client.ts — fixture assumption broke (rc=$B1_RC)"
else
  ok "(arm 3, setup) react-next --force produced no-server-imports-in-client.ts"

  ( cd "$FIXTURE_B" && bash "$INSTALL" ts-server --refresh < /dev/null ) > "$FIXTURE_B/.i2.log" 2>&1
  B2_RC=$?
  if [ "$B2_RC" -ne 0 ]; then
    bad "(arm 3) install.sh ts-server --refresh exited non-zero (rc=$B2_RC, log tail: $(tail -8 "$FIXTURE_B/.i2.log" | tr '\n' '|'))"
  else
    ok "(arm 3) install.sh ts-server --refresh (stack switch) completed rc=0"
  fi

  STRAY_COUNT_B=$(find "$FIXTURE_B/eslint-rules-local" -maxdepth 1 -name 'no-server-imports-in-client.*' 2>/dev/null | wc -l | tr -d ' ')
  if [ "$STRAY_COUNT_B" -eq 0 ]; then
    ok "(arm 3, pos) no-server-imports-in-client.* pruned from disk after stack switch via --refresh"
  else
    bad "(arm 3, pos) no-server-imports-in-client.* still on disk after --refresh stack switch ($STRAY_COUNT_B file(s)) — the #882 bug"
  fi

  B_KEYS=$(barrel_keys "$FIXTURE_B")
  if [ "$B_KEYS" = "$BASELINE_KEYS" ]; then
    ok "(arm 3, pos) barrel key-set after --refresh stack switch matches a clean ts-server install exactly"
  else
    bad "(arm 3, pos) barrel key-set diverges from clean ts-server baseline — got:[$(echo "$B_KEYS" | tr '\n' ',')] want:[$(echo "$BASELINE_KEYS" | tr '\n' ',')]"
  fi
fi

echo ""
echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
[ "$FAIL" -eq 0 ]
