#!/usr/bin/env bash
# react-spa-wiring.test.sh — install.sh must wire the react-spa preset the SAME way it wires
# react-next: `install.sh react-spa` is an accepted stack, the SPA eslint.config template lands as
# eslint.config.mjs, the preset's custom rule (require-error-boundary) lands in eslint-rules-local/,
# the generated barrel exports it, and EVERY `rules-as-tests/<id>` the shipped SPA eslint.config
# references resolves to a backing barrel export in the GENERATED consumer.
#
# The gap this closes (pre-existing, surfaced in the PR #708 cold-review): install.sh accepted only
# ts-server/react-next, so `install.sh react-spa` aborted with "Unknown stack" and NEVER copied
# packages/preset-react-spa/eslint-rules/require-error-boundary.ts or its eslint.config template —
# the SPA template's `rules-as-tests/require-error-boundary` ref would dangle at install time
# ("Definition for rule 'rules-as-tests/require-error-boundary' was not found"). Principle 25 guards
# ref-resolution STATICALLY in the source tree; this test proves the runtime COPY actually lands the
# backing rules in a generated consumer — the channel principle 25 cannot reach.
#
# Paired-negative (principle-02 non-vacuity): a fabricated `rules-as-tests/zzz-…` id run through the
# SAME resolver MUST be flagged unresolved — proving the resolution check is not vacuously green.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

T=$(mktemp -d)
printf '{ "name": "rspa", "version": "0.0.0", "scripts": { "test": "echo keep" } }\n' > "$T/package.json"
( cd "$T" && git init -q && bash "$REPO_ROOT/install.sh" react-spa --force ) >/dev/null 2>&1
rc=$?

# A0 — install must exit 0. A mid-install crash (set -u abort, missing file) would otherwise
# false-green a later assertion. Before the wiring this is rc=1 ("Unknown stack: react-spa").
[ "$rc" -eq 0 ] && ok "A0: install.sh react-spa exited 0 (no mid-install crash / Unknown stack)" \
                || bad "A0: install.sh react-spa exited $rc (Unknown stack or crash)"

# A1 — react-spa is an accepted stack: the SPA eslint.config template landed as eslint.config.mjs
[ -f "$T/eslint.config.mjs" ] && ok "A1: install.sh react-spa landed eslint.config.mjs (react-spa is a wired stack)" \
                              || bad "A1: no eslint.config.mjs — install.sh react-spa did not run"

# A2 — the landed config is the de-Next-ified SPA template (references custom rules, NO @next plugin)
if grep -q 'rules-as-tests/require-error-boundary' "$T/eslint.config.mjs" 2>/dev/null \
   && ! grep -q '@next/eslint-plugin-next' "$T/eslint.config.mjs" 2>/dev/null; then
  ok "A2: SPA eslint.config references require-error-boundary, de-Next-ified (no @next plugin)"
else
  bad "A2: eslint.config.mjs is not the de-Next-ified SPA template"
fi

# A3 — the preset's custom rule file landed in eslint-rules-local/
[ -f "$T/eslint-rules-local/require-error-boundary.ts" ] && ok "A3: require-error-boundary.ts landed in eslint-rules-local/" \
                                                          || bad "A3: require-error-boundary.ts missing from eslint-rules-local/"

# A4 — generated JS barrel exports the preset rule under its rule key
BARREL="$T/eslint-rules-local/index.mjs"
if [ -f "$BARREL" ] && grep -q "'require-error-boundary':" "$BARREL"; then
  ok "A4: generated barrel exports 'require-error-boundary'"
else
  bad "A4: barrel missing 'require-error-boundary' export"
fi

# A5 (CORE) — every rules-as-tests/<id> in the shipped SPA eslint.config resolves to a barrel key.
# Barrel keys are `'<id>': identifier,` (quoted key → identifier value, excludes unquoted meta keys).
# Refs are `rules-as-tests/<id>`. Mirrors principle 25's barrelKeys/unresolvedRefs, at install time.
keys=$(grep -oE "^[[:space:]]*'[a-z0-9-]+':[[:space:]]*[A-Za-z]" "$BARREL" 2>/dev/null | grep -oE "'[a-z0-9-]+'" | tr -d "'" | sort -u)
refs=$(grep -oE "rules-as-tests/[a-z0-9-]+" "$T/eslint.config.mjs" 2>/dev/null | sed 's#rules-as-tests/##' | sort -u)
unresolved=""
for r in $refs; do
  grep -qx "$r" <<<"$keys" || unresolved="$unresolved $r"
done
if [ -n "$refs" ] && [ -z "$unresolved" ]; then
  ok "A5: every SPA template ref resolves to a barrel export ($(echo $refs | tr '\n' ' '))"
else
  bad "A5: unresolved SPA template refs →$unresolved (refs found: $(echo $refs | tr '\n' ' '))"
fi

# A5-NEG (non-vacuity) — push a fabricated id through the SAME resolver: it MUST be flagged
# unresolved. Proves A5's green is real resolution, not a vacuous loop over an empty ref set.
neg_unresolved=""
for r in $refs "zzz-nonexistent-rule"; do
  grep -qx "$r" <<<"$keys" || neg_unresolved="$neg_unresolved $r"
done
case "$neg_unresolved" in
  *zzz-nonexistent-rule*) ok "A5-neg: injected fabricated ref flagged unresolved → resolver non-vacuous" ;;
  *)                      bad "A5-neg: resolver did NOT flag the fabricated ref → VACUOUS" ;;
esac

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
