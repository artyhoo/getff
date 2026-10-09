#!/usr/bin/env bash
# W2 (D2067-S02): a drivable generic consumer's --refresh must UPDATE the W2 proof/plugin
# payload it received at install (byte reachability, not destination presence), keep a
# consumer .override.md owner in place, and add NO payload to an undrivable generic.
# Falsifier shape: the test FAILS against the old preset-only refresh arm even though every
# destination path string is present on both branches — the sentinels planted into INSTALLED
# bytes must converge back to the upstream framework bytes, which only the generic payload
# arm delivers.
set -uo pipefail
ROOT=${TEST_REPO_ROOT:-$(git -C "$(dirname "$0")" rev-parse --show-toplevel)}
INSTALL_ROOT=${INSTALL_ROOT:-$ROOT}
TMP=$(mktemp -d); trap '[ -n "${KEEP_FIXTURES:-}" ] || rm -rf "$TMP"' EXIT
PASS=0; FAIL=0
check() { local name="$1"; shift; if "$@"; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); echo "FAIL: $name"; fi; }
check_not() { local name="$1"; shift; if "$@"; then FAIL=$((FAIL+1)); echo "FAIL: $name"; else PASS=$((PASS+1)); fi; }
fail() { echo "FAIL: seed/refresh rc — see $TMP"; exit 1; }

mkdir "$TMP/bin"
for pm in npm pnpm yarn; do printf '#!/bin/sh\nexit 0\n' > "$TMP/bin/$pm"; chmod +x "$TMP/bin/$pm"; done
export PATH="$TMP/bin:$PATH"

# One core rule basename to pin (first non-test .ts in packages/core/eslint-rules).
CORE_RULE_TS=$(ls "$ROOT"/packages/core/eslint-rules/*.ts | grep -vE '\.test\.ts|\.d\.ts$|/index\.ts$' | head -1)
[ -n "$CORE_RULE_TS" ] || { echo "FAIL: no core rule found"; exit 1; }
CORE_RULE_BN=$(basename "${CORE_RULE_TS%.ts}")

drivable() {
  local dir=$1
  mkdir -p "$dir/src"
  printf '{\n "name":"w2-generic", "version":"0.0.0",\n "scripts": {"lint": "eslint ."},\n "devDependencies": {"eslint": "^9.0.0"}\n}\n' > "$dir/package.json"
  git -C "$dir" init -q
  (cd "$dir" && bash "$INSTALL_ROOT/install.sh" generic --profile core </dev/null) > "$dir/seed.log" 2>&1 || fail
}

undrivable() {
  local dir=$1
  mkdir -p "$dir"
  printf '{\n "name":"w2-generic", "version":"0.0.0",\n "scripts": {"test": "echo hi"}\n}\n' > "$dir/package.json"
  git -C "$dir" init -q
  (cd "$dir" && bash "$INSTALL_ROOT/install.sh" generic --profile core </dev/null) > "$dir/seed.log" 2>&1 || fail
}

sentinel() { printf '# w2-refresh sentry %s\n' "$2" > "$1"; }

# ── Arm 1: drivable generic — stale installed payload converges to upstream on refresh ──
D="$TMP/drivable"; drivable "$D"
check "seed: proof script installed"            [ -f "$D/scripts/prove-rules.mjs" ]
check "seed: mutation runner installed"         [ -f "$D/scripts/run-generated-rule-mutation.sh" ]
check "seed: plugin barrel installed"           [ -f "$D/eslint-rules-local/index.mjs" ]
check "seed: core rule .ts installed"           [ -f "$D/eslint-rules-local/$CORE_RULE_BN.ts" ]
check "seed: core rule .mjs installed"          [ -f "$D/eslint-rules-local/$CORE_RULE_BN.mjs" ]
sentinel "$D/scripts/prove-rules.mjs" 1
sentinel "$D/scripts/run-generated-rule-mutation.sh" 2
sentinel "$D/eslint-rules-local/$CORE_RULE_BN.mjs" 3
sentinel "$D/eslint-rules-local/index.mjs" 4
sentinel "$D/scripts/audit-ai-docs.sh" 5        # control: stack-free arm must fix this one
(cd "$D" && bash "$INSTALL_ROOT/install.sh" --refresh </dev/null) > "$D/refresh.log" 2>&1 || fail
check "refresh: proof script converged to upstream"      cmp -s "$ROOT/packages/core/audit-self/prove-rules.mjs" "$D/scripts/prove-rules.mjs"
check "refresh: mutation runner converged to upstream"   cmp -s "$ROOT/packages/core/synthesizer/run-generated-rule-mutation.sh" "$D/scripts/run-generated-rule-mutation.sh"
check "refresh: core rule .mjs converged to upstream"    cmp -s "${CORE_RULE_TS%.ts}.mjs" "$D/eslint-rules-local/$CORE_RULE_BN.mjs"
check "refresh: control stack-free script converged"     cmp -s "$ROOT/packages/core/audit-self/audit-ai-docs.sh" "$D/scripts/audit-ai-docs.sh"
check_not "refresh: barrel regenerated (sentry gone)"    grep -q 'w2-refresh sentry 4' "$D/eslint-rules-local/index.mjs"
check "refresh: barrel registers the pinned core rule"   grep -q "$CORE_RULE_BN" "$D/eslint-rules-local/index.mjs"

# ── Arm 2: consumer override keeps Layer-3 ownership while siblings converge ──
# Override spelling per refresh_safe's grammar (setup.d/lib.sh): `${dst%.md}.override.md` —
# for a .ts destination the sibling is `<name>.ts.override.md` (the suffix is APPENDED to a
# non-.md destination, not extension-replaced).
O="$TMP/drivable-override"; drivable "$O"
sentinel "$O/eslint-rules-local/$CORE_RULE_BN.ts" 6
printf 'consumer override\n' > "$O/eslint-rules-local/$CORE_RULE_BN.ts.override.md"
sentinel "$O/eslint-rules-local/index.mjs" 7
(cd "$O" && bash "$INSTALL_ROOT/install.sh" --refresh </dev/null) > "$O/refresh.log" 2>&1 || fail
check "override: consumer-owned .ts survives refresh"    grep -q 'w2-refresh sentry 6' "$O/eslint-rules-local/$CORE_RULE_BN.ts"
check_not "override: barrel regenerated for the rest"    grep -q 'w2-refresh sentry 7' "$O/eslint-rules-local/index.mjs"

# ── Arm 3: undrivable generic gains NO payload on refresh ──
U="$TMP/undrivable"; undrivable "$U"
check "seed: undrivable generic has no plugin dir"       [ ! -e "$U/eslint-rules-local" ]
check "seed: undrivable generic has no proof script"     [ ! -e "$U/scripts/prove-rules.mjs" ]
(cd "$U" && bash "$INSTALL_ROOT/install.sh" --refresh </dev/null) > "$U/refresh.log" 2>&1 || fail
check "refresh: undrivable generic gains no plugin dir"  [ ! -e "$U/eslint-rules-local" ]
check "refresh: undrivable generic gains no proof script" [ ! -e "$U/scripts/prove-rules.mjs" ]
check "refresh: undrivable NOT-wired line names the skip" grep -q 'ESLint rules (eslint-rules-local/' "$U/refresh.log"
check_not "refresh: drivable arm does NOT fire its NOT-wired line" grep -q 'ESLint rules (eslint-rules-local/' "$D/refresh.log"

echo "PASS=$PASS FAIL=$FAIL"; test "$FAIL" -eq 0
