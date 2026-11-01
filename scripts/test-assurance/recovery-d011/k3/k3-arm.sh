#!/usr/bin/env bash
# K3 arm (amended-4 A4-K3) — prove the UNCHANGED outer control is green for the
# genuine judge and RED for the reviewer's exact permissive weakening.
#
# Sequence (one receipt):
#   1. PRISTINE  — run runners/k3-outer-control.sh as-is                  -> expect rc 0
#   2. MUTANT    — weaken expect_intended's rejection predicate exactly as the
#                  independent review's counterexample did:
#                    FROM: if (!msgs.some((m) => re.test(m))) {
#                    TO:   if (false) {
#                  (label identical -> PATCH-SHA256 == the review's
#                   f71e2cc816dabfcc59e9ea85cab57d462088109fa0d15f02fd4f5be9c179fbf5)
#                  then run the SAME driver bytes                              -> expect rc 1
#   3. RESTORED  — restore the lib from the committed blob (byte-proof) and
#                  re-run the driver                                          -> expect rc 0
#
# The judge mutation touches ONLY the isolated scratch repo's lib copy; the
# primary checkout and the amended-3 scratch are never written.
#
# Env: AM4_REPO, AM4_FIXTURES, AM4_OUT (receipt log).
set -uo pipefail

AM4_REPO="${AM4_REPO:?AM4_REPO required}"
AM4_FIXTURES="${AM4_FIXTURES:?AM4_FIXTURES required}"
OUT="${AM4_OUT:?AM4_OUT required}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB="$AM4_REPO/scripts/test-assurance/counterfactuals/counterfactual-lib.sh"
DRIVER="$HERE/k3-outer-control.sh"

LABEL='review-A4: intended-diagnostic judging disabled (permissive actual cf2a/cf2b channel)'
FROM='if (!msgs.some((m) => re.test(m))) {'
TO='if (false) {'
REVIEW_PATCH_SHA='f71e2cc816dabfcc59e9ea85cab57d462088109fa0d15f02fd4f5be9c179fbf5'

hash_file() { shasum -a 256 "$1" | cut -d' ' -f1; }

run_driver() {  # $1 = phase tag
  local phase="$1"
  echo "== k3 arm $phase: driver run ==" | tee -a "$OUT"
  AM4_REPO="$AM4_REPO" AM4_FIXTURES="$AM4_FIXTURES" AM4_OUT="$OUT" bash "$DRIVER" >>"$OUT" 2>&1
  local rc=$?
  echo "K3-ARM-RC $phase $rc" | tee -a "$OUT"
  return "$rc"
}

BEFORE="$(hash_file "$LIB")"
COMMITTED="$(git -C "$AM4_REPO" show "HEAD:scripts/test-assurance/counterfactuals/counterfactual-lib.sh" | shasum -a 256 | cut -d' ' -f1)"
echo "PATCH-LABEL $LABEL" | tee -a "$OUT"
echo "PATCH-SHA256 $(printf '%s\n%s\n%s' "$LABEL" "$FROM" "$TO" | shasum -a 256 | cut -d' ' -f1) (review counterexample: $REVIEW_PATCH_SHA)" | tee -a "$OUT"
echo "PATCH-BEFORE-SHA256 $BEFORE (committed blob: $COMMITTED)" | tee -a "$OUT"
[ "$BEFORE" = "$COMMITTED" ] || { echo "ARM-FAIL scratch lib is not the committed blob" | tee -a "$OUT"; exit 1; }

arm_fail=0

# 1. pristine
run_driver pristine; rc_pristine=$?
[ "$rc_pristine" -eq 0 ] || arm_fail=1

# 2. mutant — the reviewer's exact weakening, exactly-once guarded
node -e '
  const fs = require("node:fs");
  const [file, from, to, label] = process.argv.slice(1);
  const before = fs.readFileSync(file, "utf8");
  const occurrences = before.split(from).length - 1;
  if (occurrences !== 1) {
    console.error(`ARM-FAIL: weakening does not apply exactly once (occurrences=${occurrences})`);
    process.exit(1);
  }
  fs.writeFileSync(file, before.replace(from, to));
' "$LIB" "$FROM" "$TO" "$LABEL" || { echo "ARM-FAIL weakening refused" | tee -a "$OUT"; exit 1; }
AFTER="$(hash_file "$LIB")"
echo "K3-ARM PATCH-AFTER-SHA256 $AFTER" | tee -a "$OUT"
echo "PATCH-OCCURRENCES 1" | tee -a "$OUT"

run_driver mutant; rc_mutant=$?
[ "$rc_mutant" -eq 1 ] || arm_fail=1
grep -q "K3-CONTROL-FAIL cf2a: judge ACCEPTED wrong-diagnostic kill credit" "$OUT" || { echo "ARM-FAIL mutant run lacks the cf2a permissive-accept line" | tee -a "$OUT"; arm_fail=1; }
grep -q "K3-CONTROL-FAIL cf2b: judge ACCEPTED wrong-diagnostic kill credit" "$OUT" || { echo "ARM-FAIL mutant run lacks the cf2b permissive-accept line" | tee -a "$OUT"; arm_fail=1; }

# 3. restored — committed blob back over the scratch lib, byte-proof
git -C "$AM4_REPO" show "HEAD:scripts/test-assurance/counterfactuals/counterfactual-lib.sh" >"$LIB"
RESTORED="$(hash_file "$LIB")"
echo "RESTORED counterfactual-lib.sh sha256=$RESTORED" | tee -a "$OUT"
[ "$RESTORED" = "$BEFORE" ] || { echo "ARM-FAIL restoration mismatch" | tee -a "$OUT"; exit 1; }

run_driver restored; rc_restored=$?
[ "$rc_restored" -eq 0 ] || arm_fail=1

# scratch repo back to clean (only the lib was touched)
[ -z "$(git -C "$AM4_REPO" status --porcelain)" ] || { echo "ARM-FAIL scratch repo dirty after restore" | tee -a "$OUT"; arm_fail=1; }

echo "MUTANT-DETECTED pristine=0($rc_pristine) mutant=1($rc_mutant) restored=0($rc_restored)" | tee -a "$OUT"
if [ "$arm_fail" -eq 0 ] && [ "$rc_pristine" -eq 0 ] && [ "$rc_mutant" -eq 1 ] && [ "$rc_restored" -eq 0 ]; then
  echo "K3-ARM-OK permissive judge caught by the UNCHANGED outer control (reviewer weakening f71e2cc8…; restoration byte-proven)" | tee -a "$OUT"
  exit 0
fi
echo "K3-ARM-FAIL" | tee -a "$OUT"
exit 1
