#!/usr/bin/env bash
# Batch E replay — ESLint-rule delivery family, edge 3: the fences-fire fixture supply.
#
# Delivery chain: rule source → barrel export → fences-fire triple (bad/good fixture +
# manifest) → `plugin-dual-engine` suite (real Linter + real oxlint engines). The triple is
# what makes a shipped rule's enforcement OBSERVABLE; a committed triple deleted (a rename,
# a bad glob, an overzealous cleanup) must fail verification LOUDLY. This replay deletes
# `no-vacuous-assertion.good.txt` in a DETACHED SCRATCH WORKTREE and proves the suite
# crashes RED with the intended `<name>: no good fixture` throw
# (packages/core/eslint-rules/plugin-dual-engine.test.ts:47).
#
# Applied to a detached scratch worktree (pattern: packages/core/audit-self/pre-merge-local.sh:240);
# the main checkout is never mutated.
#
# Exit: 0 demonstration reproduced · 1 demonstration failed · 3 infrastructure.

set -uo pipefail
# shellcheck source=../counterfactuals/counterfactual-lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../counterfactuals/counterfactual-lib.sh"

FIXTURE_REL="packages/core/audit-self/fixtures/fences-fire/no-vacuous-assertion.good.txt"
FIXTURE_ABS="$CF_REPO_ROOT/$FIXTURE_REL"
SUITE_FILTER="eslint-rules/plugin-dual-engine.test.ts"
[ -f "$FIXTURE_ABS" ] || infra "fences-fire fixture missing: $FIXTURE_ABS"

HEAD_BLOB_SHA="$(git -C "$CF_REPO_ROOT" show "HEAD:$FIXTURE_REL" | hash_stdin)"
[ -n "$HEAD_BLOB_SHA" ] || infra "could not hash HEAD blob of $FIXTURE_REL"

WT="$(mktemp -d "${TMPDIR:-/tmp}/s1-batch-e-fences-XXXXXX")"
cleanup() {
  git -C "$CF_REPO_ROOT" worktree remove --force "$WT" >/dev/null 2>&1 || \
    echo "WARN: worktree cleanup failed — run: git worktree remove --force $WT" >&2
}
trap cleanup EXIT

echo "== phase: scratch worktree at HEAD ($HEAD_BLOB_SHA) =="
git -C "$CF_REPO_ROOT" worktree add --detach "$WT" HEAD >/dev/null || infra "git worktree add failed"
ln -s "$CF_REPO_ROOT/node_modules" "$WT/node_modules"
# Package-level provisioning: this handoff worktree carries targeted package deps
# (e.g. oxlint → /tmp installs) under packages/core/node_modules — the scratch worktree
# needs the same reachability or the dual-engine suite cannot resolve its engines.
ln -s "$CF_REPO_ROOT/packages/core/node_modules" "$WT/packages/core/node_modules"
WT_FIXTURE="$WT/$FIXTURE_REL"

# Pre-image pinning: the worktree copy must be byte-identical to the HEAD blob.
[ "$(hash_file "$WT_FIXTURE")" = "$HEAD_BLOB_SHA" ] || die "worktree pre-image differs from HEAD blob"

echo "== phase: baseline suite (pristine worktree) =="
run_scratch_vitest "$WT/packages/core" baseline "$SUITE_FILTER"
expect_file_status "$WT/packages/core/report-baseline.json" plugin-dual-engine.test.ts pass

echo "== phase: delivery break — delete the committed fences-fire good fixture =="
GOOD_SHA_BEFORE="$(hash_file "$WT_FIXTURE")"
rm "$WT_FIXTURE" || infra "rm failed"
[ ! -f "$WT_FIXTURE" ] || infra "fixture still present after rm"
echo "DELETED $FIXTURE_REL (pre-delete sha256=$GOOD_SHA_BEFORE, HEAD blob sha256=$HEAD_BLOB_SHA)"

echo "== phase: counterfactual suite — verification must fail with the intended throw =="
run_scratch_vitest "$WT/packages/core" counterfactual "$SUITE_FILTER"
CF_REPORT="$WT/packages/core/report-counterfactual.json"
expect_file_status "$CF_REPORT" plugin-dual-engine.test.ts fail
# the readTriple throw names the deleted triple (the import-time crash IS the detection)
expect_intended "$CF_REPORT" plugin-dual-engine.test.ts "no-vacuous-assertion: no good fixture"
grep -q 'no good fixture' "$WT/packages/core/stdout-counterfactual.log" \
  || die "suite went RED but the fences-fire throw text is absent from its output"
echo "OK killed-by: 'no-vacuous-assertion: no good fixture' appears in the counterfactual output"

echo "== phase: restoration (git checkout + hash equality with the HEAD blob) =="
git -C "$WT" checkout -- "$FIXTURE_REL" || infra "git checkout restore failed"
[ "$(hash_file "$WT_FIXTURE")" = "$HEAD_BLOB_SHA" ] || die "restored fixture differs from the HEAD blob"
echo "RESTORED $FIXTURE_REL sha256=$HEAD_BLOB_SHA"
run_scratch_vitest "$WT/packages/core" restored "$SUITE_FILTER"
expect_file_status "$WT/packages/core/report-restored.json" plugin-dual-engine.test.ts pass

echo "== phase: final passing baseline in the MAIN checkout (post-experiment) =="
[ -z "$(git -C "$CF_REPO_ROOT" status --porcelain "$FIXTURE_REL")" ] \
  || die "main checkout fixture is dirty — scratch discipline violated"
run_scratch_vitest "$CF_REPO_ROOT/packages/core" final "$SUITE_FILTER"
expect_file_status "$CF_REPO_ROOT/packages/core/report-final.json" plugin-dual-engine.test.ts pass
rm -f "$CF_REPO_ROOT/packages/core/report-final.json" "$CF_REPO_ROOT/packages/core/stdout-final.log"

echo "FENCES-FIRE-DELETION VERDICT: pass (deleted committed triple reached the real suite; verification failed with the intended throw; restored + final baseline green)"
exit 0
