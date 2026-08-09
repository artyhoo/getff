#!/usr/bin/env bash
# tests/install-sh/rules-lock-scope-trap.test.sh — S1 criterion 9: scope trap held.
#
# §1 scope trap: `grep -rn '"version": null'` also hits research-plan / detector
# fixtures (a different artefact class). This test asserts the branch diff contains
# NONE of those scope-trap paths — proving S1 stayed in its permitted scope (§2).
#
# The scope-trap paths (from §1): research plans, synthesizer fixtures, detector
# fixtures. These are NOT lock writers; sweeping them would be an artefact-class error.
set -uo pipefail
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

echo "▶ Rules-lock scope trap (S1 criterion 9) — no research/detector fixtures in branch diff"
echo ""

# The scope-trap paths from §1 — these artefact classes are NOT the target of S1.
# §2 EXPLICITLY permits packages/core/research/types.ts (the additive Tier field).
# The scope trap is about FIXTURE/DATA files (JSON with "version": null), not .ts source.
SCOPE_TRAP_PATTERNS=(
  "packages/core/research/fixtures/"
  "packages/core/research/expected-self-research.json"
  "packages/core/research/research-plan.schema.json"
  "packages/core/research/multi-tenant-hosts.json"
  "packages/core/synthesizer/fixtures/"
  "packages/core/detector/expected-self-detect.json"
)

# Get the branch diff against the merge-base with staging.
BASE=$(git merge-base HEAD origin/staging 2>/dev/null || echo "")
if [ -z "$BASE" ]; then
  echo "  · SKIP: origin/staging not available (local run without remote)"
  echo ""
  echo "── rules-lock-scope-trap: skipped (no staging base) ──"
  exit 0
fi

CHANGED=$(git diff --name-only "$BASE...HEAD")
N_CHANGED=$(printf '%s\n' "$CHANGED" | grep -c . || true)

echo "  ── Checking $N_CHANGED changed file(s) against scope-trap paths ──"
echo ""

for pattern in "${SCOPE_TRAP_PATTERNS[@]}"; do
  hits=$(printf '%s\n' "$CHANGED" | grep "^$pattern" || true)
  if [ -z "$hits" ]; then
    ok "no files under '$pattern' in branch diff"
  else
    bad "scope-trap path(s) touched: $(printf '%s\n' "$hits" | tr '\n' ' ')"
    echo "    S1 §1 scope trap: these are research/detector fixtures, NOT lock writers."
    echo "    If intentional, justify in the commit message and update this test."
  fi
done

echo ""
echo "── rules-lock-scope-trap: $PASS passed, $FAIL failed ──"
[ "$FAIL" -eq 0 ]
