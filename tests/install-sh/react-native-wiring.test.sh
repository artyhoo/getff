#!/usr/bin/env bash
# react-native-wiring.test.sh — install.sh must wire the react-native preset. RN diverges from
# react-next/react-spa (T13/T16, do NOT blind-mirror): it ships NO custom eslint-rules (no
# rules-as-tests refs, no preset barrel), TWO baseline eslint configs (Expo vs bare-RN) + a shared
# eslint.config.rn-common.mjs both import, and omits playwright (native, web-less). The wiring must
# match THAT shape:
#   - `install.sh react-native` is an accepted stack (not "Unknown stack").
#   - it lands ONE baseline by detecting the consumer's deps: Expo dep present → Expo baseline
#     (eslint-config-expo); else → bare-RN baseline (FlatCompat / @react-native/eslint-config).
#   - it ALWAYS lands eslint.config.rn-common.mjs (both baselines `import './eslint.config.rn-common.mjs'`
#     — if it doesn't land, the consumer's ESLint crashes on a missing module).
#   - it ships RULES.react-native.md + ARCHITECTURE.react-native.md, and does NOT ship playwright.
#
# Paired-negative (principle-02 non-vacuity): the relative-import resolution check, run with a
# fabricated './eslint.config.zzz-missing.mjs' import added, MUST flag it unresolved — proving the
# resolution loop is real, not a vacuous pass over an empty import set.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

# ── Case 1: bare-RN (no Expo dep) ────────────────────────────────────────────
T=$(mktemp -d)
printf '{ "name": "rnbare", "version": "0.0.0", "dependencies": { "react-native": "0.76.0" } }\n' > "$T/package.json"
( cd "$T" && git init -q && bash "$REPO_ROOT/install.sh" react-native --force ) >/dev/null 2>&1
rc=$?

[ "$rc" -eq 0 ] && ok "A0: install.sh react-native exited 0 (no Unknown stack / crash)" \
                || bad "A0: install.sh react-native exited $rc (Unknown stack or crash)"

[ -f "$T/eslint.config.mjs" ] && ok "A1: eslint.config.mjs landed (react-native is a wired stack)" \
                              || bad "A1: no eslint.config.mjs — install.sh react-native did not run"

# A2 — non-Expo project → bare-RN baseline. Discriminator is the import (FlatCompat from
# @eslint/eslintrc), which only the bare-RN config carries; the Expo config uses eslint-config-expo.
if grep -q 'FlatCompat' "$T/eslint.config.mjs" 2>/dev/null \
   && ! grep -q 'eslint-config-expo' "$T/eslint.config.mjs" 2>/dev/null; then
  ok "A2: non-Expo project → bare-RN baseline (FlatCompat / @react-native/eslint-config)"
else
  bad "A2: expected bare-RN baseline for a non-Expo project"
fi

# A3 — the shared base BOTH baselines import MUST land, or the import dangles at ESLint load.
[ -f "$T/eslint.config.rn-common.mjs" ] && ok "A3: eslint.config.rn-common.mjs landed (shared base both baselines import)" \
                                        || bad "A3: eslint.config.rn-common.mjs missing — config import would dangle"

# A4 — RN is native/web-less → playwright must NOT be shipped (it is for the web stacks only).
[ ! -f "$T/playwright.config.ts" ] && ok "A4: no playwright.config.ts shipped (RN omits web E2E)" \
                                   || bad "A4: playwright.config.ts shipped to RN (should be omitted)"

# A5 — RN docs land
if [ -f "$T/.ai-factory/RULES.react-native.md" ] && [ -f "$T/.ai-factory/ARCHITECTURE.react-native.md" ]; then
  ok "A5: RULES.react-native.md + ARCHITECTURE.react-native.md landed"
else
  bad "A5: RN docs missing from .ai-factory/"
fi

# A6 (CORE) — every relative import in the landed eslint.config.mjs resolves to a landed sibling.
imports=$(grep -oE "from '\./[^']+'" "$T/eslint.config.mjs" 2>/dev/null | sed "s/from '\.\///; s/'\$//")
unresolved=""
for imp in $imports; do
  [ -f "$T/$imp" ] || unresolved="$unresolved $imp"
done
if [ -n "$imports" ] && [ -z "$unresolved" ]; then
  ok "A6: every relative import in eslint.config.mjs resolves ($(echo $imports | tr '\n' ' '))"
else
  bad "A6: unresolved relative imports →$unresolved (imports: $(echo $imports | tr '\n' ' '))"
fi

# A6-NEG (non-vacuity) — push a fabricated relative import through the SAME resolver: MUST be flagged.
neg_unresolved=""
for imp in $imports "eslint.config.zzz-missing.mjs"; do
  [ -f "$T/$imp" ] || neg_unresolved="$neg_unresolved $imp"
done
case "$neg_unresolved" in
  *zzz-missing*) ok "A6-neg: fabricated import flagged unresolved → resolver non-vacuous" ;;
  *)            bad "A6-neg: resolver did NOT flag the fabricated import → VACUOUS" ;;
esac

# ── Case 2: Expo detection ───────────────────────────────────────────────────
E=$(mktemp -d)
printf '{ "name": "rnexpo", "version": "0.0.0", "dependencies": { "expo": "~52.0.0", "react-native": "0.76.0" } }\n' > "$E/package.json"
( cd "$E" && git init -q && bash "$REPO_ROOT/install.sh" react-native --force ) >/dev/null 2>&1
RC_P50_236=$?
if [ "$RC_P50_236" -eq 0 ]; then ok "react-native-wiring: install rc=0 (p50-236)"; else bad "react-native-wiring: install rc=$RC_P50_236, expected 0 (p50-236)"; fi
if grep -q 'eslint-config-expo' "$E/eslint.config.mjs" 2>/dev/null; then
  ok "A7: Expo project (expo dep) → Expo baseline (eslint-config-expo)"
else
  bad "A7: expected Expo baseline for a project carrying the expo dependency"
fi

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
