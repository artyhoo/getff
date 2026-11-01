#!/usr/bin/env bash
# cih-s2 F8b — "RuleCreator doc-URL honesty" (same defect class as F13, react-next stack).
# Several shipped/source artefacts pointed their policy doc-URLs at `factory/RULES*.md` —
# a path that does NOT exist in this repo (the real homes are
# `packages/preset-next-15-canonical/RULES.md` and `…/RULES.react-next.md`). A consumer
# clicking the link, or any drift check resolving it, lands on a 404 → "documents lie out
# of the box". F13 (S1) fixed the 3 CORE eslint rules; F8b finishes the residue:
#   • 3 preset (react-next) eslint RuleCreator URLs  → …/RULES.react-next.md  (SHIPPED to consumers)
#   • rules-manifest.json R2 + R11 `policy` refs      → …/RULES.md            (repo-internal SSOT)
#   • .github/workflows/workflow-integrity.yml comment→ …/RULES.md            (framework-internal)
# (The kickoff named only the R11 manifest ref; R2 at line 40 is the identical defect in the
#  same file — fixing one and leaving the other would be a vacuous half-fix, so both are asserted.)
#
# The invariant: NO in-scope artefact references the non-existent `factory/RULES` path.
#
# PAIRED-NEGATIVE (umbrella discipline): each pos arm has a neg arm that re-introduces the
# exact dead `factory/RULES` path and re-runs the SAME grep — it MUST flip to a hit. A neg
# that does not bite means the pos check was vacuous → reported as bad.
#
# Runs the REAL pipeline for the shipped arm: installs react-next from THIS worktree's
# install.sh into a temp consumer, then greps the SHIPPED eslint-rules-local copies.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

DEAD='factory/RULES'   # the dead path prefix — matches both RULES.md and RULES.react-next.md

# ── SOURCE ARM: the canonical files in this repo must not reference the dead path ──
SRC=(
  # R14 (require-form-safe-parse) + R20 (require-use-server-directive) migrated to the
  # declarative tier and were deleted; only no-server-imports-in-client remains as a preset
  # RuleCreator source. The wrapper rules-as-tests/restricted-syntax-audit-exempt uses a
  # github blob URL (no factory/RULES path), so it needs no doc-URL repoint check here.
  "$REPO_ROOT/packages/preset-next-15-canonical/eslint-rules/no-server-imports-in-client.ts"
  "$REPO_ROOT/packages/core/manifest/rules-manifest.json"
  "$REPO_ROOT/.github/workflows/workflow-integrity.yml"
)
for f in "${SRC[@]}"; do [ -f "$f" ] || bad "source file missing: ${f#"$REPO_ROOT"/}"; done

# pos-source: no dead `factory/RULES` ref in any in-scope source file
out=$(grep -rnE "$DEAD" "${SRC[@]}" 2>/dev/null)
[ -z "$out" ] \
  && ok "source pos: no 'factory/RULES' ref in the in-scope source surfaces" \
  || bad "source pos: dead 'factory/RULES' ref still present:"$'\n'"$out"

# pos-source-B: the surviving preset eslint rule (only no-server-imports-in-client; R14/R20
# migrated to the declarative tier and were deleted) was RE-POINTED to the real path.
GOOD_REACT='packages/preset-next-15-canonical/RULES.react-next.md'
miss=""
for f in "${SRC[0]}"; do
  grep -qF "$GOOD_REACT" "$f" || miss="$miss ${f#"$REPO_ROOT"/}"
done
[ -z "$miss" ] \
  && ok "source pos-B: preset eslint rule repoints to the real RULES.react-next.md path" \
  || bad "source pos-B: preset eslint rule(s) lack the corrected path (deleted, not repointed?):$miss"

# neg-source (LOAD-BEARING): re-inject the dead path into a temp COPY → grep MUST bite
scopy=$(mktemp)
cp "${SRC[0]}" "$scopy"
printf '\n// blob/main/factory/RULES.react-next.md#r20-server-actions\n' >> "$scopy"
out=$(grep -nE "$DEAD" "$scopy" 2>/dev/null)
[ -n "$out" ] \
  && ok "source neg: re-injected 'factory/RULES' → grep bites (non-vacuous)" \
  || bad "source neg: re-injected dead path but grep stayed empty → VACUOUS check"
rm -f "$scopy"

# ── SHIPPED ARM: a fresh react-next consumer must not carry the dead path either ──
# (T13: green in source ≠ live in consumer — assert on the actually-installed tree.)
T=$(mktemp -d)
printf '{ "name":"t","version":"0.0.0" }\n' > "$T/package.json"
( cd "$T" && git init -q && bash "$REPO_ROOT/install.sh" react-next --force ) >/dev/null 2>&1
RC_P50_095=$?
if [ "$RC_P50_095" -eq 0 ]; then ok "f8b-rulecreator-doc-urls: install rc=0 (p50-095)"; else bad "f8b-rulecreator-doc-urls: install rc=$RC_P50_095, expected 0 (p50-095)"; fi

if [ -d "$T/eslint-rules-local" ]; then
  out=$(grep -rnE "$DEAD" "$T/eslint-rules-local"/*.ts 2>/dev/null)
  [ -z "$out" ] \
    && ok "shipped pos: react-next eslint-rules-local has no 'factory/RULES' ref" \
    || bad "shipped pos: installed eslint rule(s) still reference dead path:"$'\n'"$out"

  grep -rqF "$GOOD_REACT" "$T/eslint-rules-local"/*.ts 2>/dev/null \
    && ok "shipped pos-B: installed eslint rules carry the corrected RULES.react-next.md path" \
    || bad "shipped pos-B: installed eslint rules lack the corrected path"

  # neg-shipped (LOAD-BEARING): re-inject the dead path into a shipped copy → grep MUST bite
  negf=$(ls "$T/eslint-rules-local"/*.ts 2>/dev/null | head -1)
  cp "$negf" "$negf.bak"
  printf '\n// blob/main/factory/RULES.react-next.md#r12-server-vs-client\n' >> "$negf"
  out=$(grep -rnE "$DEAD" "$T/eslint-rules-local"/*.ts 2>/dev/null)
  [ -n "$out" ] \
    && ok "shipped neg: re-injected 'factory/RULES' into a shipped rule → grep bites (non-vacuous)" \
    || bad "shipped neg: re-injected dead path but grep stayed empty → VACUOUS check"
  mv "$negf.bak" "$negf"
else
  bad "shipped: react-next install produced no eslint-rules-local/ — cannot verify shipped copies"
fi

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
