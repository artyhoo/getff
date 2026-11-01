#!/usr/bin/env bash
# cih-s1 F13 — install.sh patches the COPIED stryker.config.json "packageManager" to match
# the consumer's lockfile (the shipped template hardcodes "npm" and can't self-detect). Asserts
# via the REAL install pipeline (mirror c1-wiring.test.sh): pnpm consumer → "pnpm"; plain npm
# consumer → "npm" (the unchanged baseline). The pnpm arm is the load-bearing one — it fails if
# the patch stops mattering and the template's hardcoded "npm" leaks through to a pnpm consumer.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

# pnpm consumer — lockfile present BEFORE install → packageManager rewritten to pnpm
P=$(mktemp -d)
printf '{ "name": "f13p", "version": "0.0.0" }\n' > "$P/package.json"
touch "$P/pnpm-lock.yaml"
( cd "$P" && git init -q && bash "$REPO_ROOT/install.sh" ts-server --force ) >/dev/null 2>&1
RC_P50_067=$?
if [ "$RC_P50_067" -eq 0 ]; then ok "f13-stryker-pm: install rc=0 (p50-067)"; else bad "f13-stryker-pm: install rc=$RC_P50_067, expected 0 (p50-067)"; fi
grep -q '"packageManager": "pnpm"' "$P/stryker.config.json" 2>/dev/null \
  && ok "pnpm consumer → stryker packageManager pnpm" \
  || bad "pnpm consumer: packageManager not pnpm ($(grep packageManager "$P/stryker.config.json" 2>/dev/null))"

# plain npm consumer — no lockfile → baseline npm (template default preserved)
N=$(mktemp -d)
printf '{ "name": "f13n", "version": "0.0.0" }\n' > "$N/package.json"
( cd "$N" && git init -q && bash "$REPO_ROOT/install.sh" ts-server --force ) >/dev/null 2>&1
RC_P50_068=$?
if [ "$RC_P50_068" -eq 0 ]; then ok "f13-stryker-pm: install rc=0 (p50-068)"; else bad "f13-stryker-pm: install rc=$RC_P50_068, expected 0 (p50-068)"; fi
grep -q '"packageManager": "npm"' "$N/stryker.config.json" 2>/dev/null \
  && ok "npm consumer → stryker packageManager npm (baseline)" \
  || bad "npm consumer: packageManager not npm ($(grep packageManager "$N/stryker.config.json" 2>/dev/null))"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
