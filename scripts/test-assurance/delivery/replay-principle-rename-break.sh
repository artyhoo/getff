#!/usr/bin/env bash
# Batch E replay — principle delivery family: a principle test renamed OUTSIDE the vitest
# include grammar.
#
# Delivery chain: `packages/core/principles/<n>-<slug>.test.ts` → the real
# `packages/core/vitest.config.ts` include grammar selects it → the principle's enforcement
# is live. A rename that leaves the grammar (e.g. `<file>.renamed.mts`) is the SILENT
# un-delivery: the runner runs one file fewer, nothing else in the tree references the test,
# and every suite stays green. Two independent demonstrations in one replay:
#
#   1. THE SILENT DROP (raw): after the rename, the runner can no longer even TARGET the
#      file it ran moments ago — `vitest run <old-path>` exits 1 "No test files found".
#      That is the gap: an empty selection, not a detection.
#   2. THE RATCHET CATCH: principle 53's pairing ratchet (every numbered principle module
#      must keep a grammar-selected `<n>-*.test.ts` sibling — grammar-INDEPENDENT
#      population, so the rename is reachable) goes RED naming the orphaned module.
#
# Batch G finding F-G1 corrected the fixture restoration: when this replay was authored the
# worktree HEAD predated the Batch-E commit, so the 53 module/test and the edited 52 module
# were copied in as UNTRACKED scratch fixture and simply `rm`'d afterwards. Since their
# landing commits those same paths are TRACKED at HEAD, and `rm` of a tracked path leaves the
# worktree dirty (the exact drift the Batch-G acceptance replay caught). The copies are kept
# — a defensive re-sync keeping the in-worktree module/test pair self-consistent if the
# working tree drifts from HEAD again — but restoration is now TRACKED-AWARE: a copied path
# that exists at HEAD is restored via `git checkout --` (hash-proven), an untracked one via
# `rm`. The rename TARGET is the committed paired test (52's test), whose module (52) the
# ratchet then reports as orphaned.
#
# Applied to a detached scratch worktree (pattern: packages/core/audit-self/pre-merge-local.sh:240);
# the main checkout is never mutated.
#
# Exit: 0 demonstration reproduced · 1 demonstration failed · 3 infrastructure.

set -uo pipefail
# shellcheck source=../counterfactuals/counterfactual-lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../counterfactuals/counterfactual-lib.sh"

P52_MODULE="packages/core/principles/52-subprocess-status-conformance.ts"
P53_MODULE="packages/core/principles/53-delivery-discovery-conformance.ts"
P53_TEST="packages/core/principles/53-delivery-discovery-conformance.test.ts"
RENAME_TARGET="packages/core/principles/52-subprocess-status-conformance.test.ts"
RENAMED_NAME="52-subprocess-status-conformance.renamed.mts"
for f in "$P52_MODULE" "$P53_MODULE" "$P53_TEST" "$RENAME_TARGET"; do
  [ -f "$CF_REPO_ROOT/$f" ] || infra "required file missing: $f"
done

TARGET_HEAD_SHA="$(git -C "$CF_REPO_ROOT" show "HEAD:$RENAME_TARGET" | hash_stdin)"
[ -n "$TARGET_HEAD_SHA" ] || infra "could not hash HEAD blob of $RENAME_TARGET"

WT="$(mktemp -d "${TMPDIR:-/tmp}/s1-batch-e-rename-XXXXXX")"
cleanup() {
  git -C "$CF_REPO_ROOT" worktree remove --force "$WT" >/dev/null 2>&1 || \
    echo "WARN: worktree cleanup failed — run: git worktree remove --force $WT" >&2
  # F-H7: the final baseline writes these into the MAIN checkout; a die in the final phase
  # must not litter them into the tree the next gate runs in.
  rm -f "$CF_REPO_ROOT/packages/core/report-final.json" "$CF_REPO_ROOT/packages/core/stdout-final.log"
}
trap cleanup EXIT

echo "== phase: scratch worktree at HEAD ($TARGET_HEAD_SHA) + Batch-E files copied in as fixture =="
git -C "$CF_REPO_ROOT" worktree add --detach "$WT" HEAD >/dev/null || infra "git worktree add failed"
ln -s "$CF_REPO_ROOT/node_modules" "$WT/node_modules"
# Package-level provisioning parity (see replay-fences-fire-deletion.sh note).
ln -s "$CF_REPO_ROOT/packages/core/node_modules" "$WT/packages/core/node_modules"
# The 53 test reconciles its intended assertion through 52's INTENDED_ASSERTIONS — the
# copies keep the in-worktree module/test pair self-consistent (byte-identical no-ops when
# the working tree matches HEAD). Each copied path is classified against HEAD so restoration
# can be tracked-aware (F-G1).
FIXTURES_TRACKED=()
FIXTURES_UNTRACKED=()
for f in "$P52_MODULE" "$P53_MODULE" "$P53_TEST"; do
  cp "$CF_REPO_ROOT/$f" "$WT/$f" || infra "copy fixture failed: $f"
  if git -C "$WT" cat-file -e "HEAD:$f" 2>/dev/null; then
    FIXTURES_TRACKED+=("$f")
    # F-H6: pin the copied bytes to the HEAD blob — drifted main-checkout bytes must not
    # silently define the demonstration pre-image (same discipline as the rename target).
    [ "$(hash_file "$WT/$f")" = "$(git -C "$WT" show "HEAD:$f" | hash_stdin)" ] \
      || die "fixture copy differs from the HEAD blob: $f (commit or restore the main checkout first)"
  else
    FIXTURES_UNTRACKED+=("$f")
  fi
done
WT_TARGET="$WT/$RENAME_TARGET"
[ "$(hash_file "$WT_TARGET")" = "$TARGET_HEAD_SHA" ] || die "worktree pre-image of rename target differs from HEAD blob"

echo "== phase: baseline — the 53 ratchet is green and the runner SELECTS the 52 test =="
run_scratch_vitest "$WT/packages/core" baseline "principles/53-delivery-discovery-conformance.test.ts"
expect_file_status "$WT/packages/core/report-baseline.json" 53-delivery-discovery-conformance.test.ts pass
# the runner CAN target the 52 test today (its discovery is live)
( cd "$WT/packages/core" && "$CF_VITEST" run "principles/52-subprocess-status-conformance.test.ts" --reporter=default >/dev/null 2>&1 )
rc=$?
[ "$rc" = "0" ] || die "baseline targeting of the 52 test failed (rc=$rc) — the delivery was not live pre-break"
echo "OK baseline: 52 test selectable and green (rc=0)"

echo "== phase: delivery break — rename the committed principle test outside the grammar =="
git -C "$WT" mv "$RENAME_TARGET" "packages/core/principles/$RENAMED_NAME" >/dev/null || infra "git mv failed"
[ -f "$WT/packages/core/principles/$RENAMED_NAME" ] || infra "renamed file missing"
[ ! -f "$WT_TARGET" ] || infra "old path still present after rename"

echo "== phase: THE SILENT DROP — the runner can no longer target the file it just ran =="
( cd "$WT/packages/core" && "$CF_VITEST" run "principles/52-subprocess-status-conformance.test.ts" --reporter=default >"$WT/packages/core/drop-proof.log" 2>&1 )
rc=$?
DROP_TEXT="$(grep -c 'No test files found' "$WT/packages/core/drop-proof.log" || true)"
echo "VITEST-TARGET-RC after rename: $rc (was 0); 'No test files found' lines: ${DROP_TEXT:-0}"
[ "$rc" != "0" ] || die "the runner still targets the renamed file — the silent drop did not materialize"
echo "OK silent drop demonstrated: no test, no gate, no reference — an empty selection, not a detection [T-TAK-A]"

echo "== phase: THE RATCHET CATCH — principle 53 goes RED naming the orphaned module 52 =="
run_scratch_vitest "$WT/packages/core" counterfactual "principles/53-delivery-discovery-conformance.test.ts"
CF_REPORT="$WT/packages/core/report-counterfactual.json"
expect_file_status "$CF_REPORT" 53-delivery-discovery-conformance.test.ts fail
expect_intended "$CF_REPORT" 53-delivery-discovery-conformance.test.ts "52-subprocess-status-conformance"
grep -q "principles/52-subprocess-status-conformance.ts" "$WT/packages/core/stdout-counterfactual.log" \
  || die "ratchet went RED but the orphaned module path is absent from its output"
echo "OK killed-by: pairing ratchet names the orphaned module 'principles/52-subprocess-status-conformance.ts'"

echo "== phase: restoration (git mv back + hash equality with the HEAD blob; drop the fixture copies) =="
git -C "$WT" mv "packages/core/principles/$RENAMED_NAME" "$RENAME_TARGET" >/dev/null || infra "git mv restore failed"
[ "$(hash_file "$WT_TARGET")" = "$TARGET_HEAD_SHA" ] || die "restored test differs from the HEAD blob"
# The copied-in fixtures, tracked-aware (F-G1): copies that OVERWROTE tracked paths are
# restored from the index (back to the HEAD blob); untracked copies just get removed.
if [ "${#FIXTURES_TRACKED[@]}" -gt 0 ]; then
  git -C "$WT" checkout -- "${FIXTURES_TRACKED[@]}" || infra "git checkout restore of tracked fixtures failed"
  for f in "${FIXTURES_TRACKED[@]}"; do
    [ "$(hash_file "$WT/$f")" = "$(git -C "$WT" show "HEAD:$f" | hash_stdin)" ] \
      || die "restored tracked fixture differs from the HEAD blob: $f"
  done
fi
if [ "${#FIXTURES_UNTRACKED[@]}" -gt 0 ]; then
  for f in "${FIXTURES_UNTRACKED[@]}"; do rm -f "$WT/$f"; done
fi
[ -z "$(git -C "$WT" status --porcelain packages/core/principles)" ] \
  || die "worktree principles/ still dirty after restoration"
echo "RESTORED $RENAME_TARGET sha256=$TARGET_HEAD_SHA (worktree principles/ clean)"

echo "== phase: final passing baseline in the MAIN checkout (post-experiment) =="
[ -z "$(git -C "$CF_REPO_ROOT" status --porcelain "$RENAME_TARGET")" ] \
  || die "main checkout rename target is dirty — scratch discipline violated"
run_scratch_vitest "$CF_REPO_ROOT/packages/core" final "principles/53-delivery-discovery-conformance.test.ts" "principles/52-subprocess-status-conformance.test.ts"
expect_file_status "$CF_REPO_ROOT/packages/core/report-final.json" 53-delivery-discovery-conformance.test.ts pass
expect_file_status "$CF_REPO_ROOT/packages/core/report-final.json" 52-subprocess-status-conformance.test.ts pass
rm -f "$CF_REPO_ROOT/packages/core/report-final.json" "$CF_REPO_ROOT/packages/core/stdout-final.log"

echo "PRINCIPLE-RENAME-BREAK VERDICT: pass (rename silently dropped the test from the runner; the 53 pairing ratchet caught it naming the orphan; restored + final baseline green)"
exit 0
