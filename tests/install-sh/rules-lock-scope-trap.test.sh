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
  "packages/core/research/research-plan.schema.json"
  "packages/core/research/multi-tenant-hosts.json"
  "packages/core/synthesizer/fixtures/"
  "packages/core/detector/expected-self-detect.json"
)
# expected-self-research.json stays watched, but NOT blanket-trapped: its drift-sources array
# re-points whenever a payload migration moves the files it watches (agents-canonical 2026-10-05
# moved skills/getff/ under .agents/procedures/getff/ — commit 86b2057b8d7), and that edit is a
# legitimate fixture update, not the S1 lock-writer sweep. The S1 trap signature is a rewritten
# `"version": null` entry, so THIS file is flagged only when its diff touches a "version" line.
VERSION_TRAP_FILE="packages/core/research/expected-self-research.json"

# Get the branch diff against the merge-base with staging.
BASE=$(git merge-base HEAD origin/staging 2>/dev/null || echo "")
if [ -z "$BASE" ]; then
  echo "  · SKIP: origin/staging not available (local run without remote)"
  echo ""
  echo "── rules-lock-scope-trap: skipped (no staging base) ──"
  exit 0
fi

# A file the branch ADDS is authored, not swept: the trap guards the existing `"version": null`
# fixtures against a lock writer's sweep, which edits or deletes them. So additions are not counted
# (--diff-filter=a). A new fixture under these paths is then itself guarded by the trap on the next
# branch — moving it elsewhere would take it out of the trap's watch. (P6 run 2: the create-vite and
# react-next-complete-example research pairs.)
CHANGED=$(git diff --name-only --diff-filter=a "$BASE...HEAD")
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

# Version-trap file: watched for the S1 signature (a rewritten `"version"` entry), re-points of
# other keys (drift sources) allowed — see the comment at the pattern list.
if grep -qxF "$VERSION_TRAP_FILE" <<<"$CHANGED"; then
  if git diff "$BASE...HEAD" -- "$VERSION_TRAP_FILE" | grep -E '^[+-].*"version"' >/dev/null; then
    bad "S1 scope-trap signature in $VERSION_TRAP_FILE: diff touches a \"version\" line"
    echo "    Lock writers must not rewrite the fixture's \"version\": null entries (S1 §1)."
  else
    ok "$VERSION_TRAP_FILE touched — no \"version\" line changed (re-point, not a lock sweep)"
  fi
else
  ok "$VERSION_TRAP_FILE untouched"
fi

echo ""
echo "── rules-lock-scope-trap: $PASS passed, $FAIL failed ──"
[ "$FAIL" -eq 0 ]
