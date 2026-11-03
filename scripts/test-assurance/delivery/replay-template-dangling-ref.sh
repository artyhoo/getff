#!/usr/bin/env bash
# Batch E replay — template delivery family: a dangling `rules-as-tests/<id>` in a shipped
# consumer template.
#
# Delivery chain: shipped `templates/ts-server/eslint.config.mjs` → consumer's ESLint loads
# it → every referenced rule must resolve to a barrel export, or the consumer's lint run
# crashes with "Definition for rule ... was not found". Principle 25 is the gate (its (a)
# real-tree arm walks every shipped template against the real barrels). This replay seeds a
# uniquely-named dangling ref INTO the template inside a DETACHED SCRATCH WORKTREE and proves
# principle 25 goes RED naming it — the exact regression class that shipped once
# (require-otel-span, documented in the principle's header).
#
# Applied to a detached scratch worktree (pattern: packages/core/audit-self/pre-merge-local.sh:240);
# the main checkout is never mutated.
#
# Exit: 0 demonstration reproduced · 1 demonstration failed · 3 infrastructure.

set -uo pipefail
# shellcheck source=../counterfactuals/counterfactual-lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../counterfactuals/counterfactual-lib.sh"

TEMPLATE_REL="templates/ts-server/eslint.config.mjs"
TEMPLATE_ABS="$CF_REPO_ROOT/$TEMPLATE_REL"
PRINCIPLE_FILTER="principles/25-template-rule-ref-resolution.test.ts"
DANGLING_ID="s1-replay-dangling-ref"
[ -f "$TEMPLATE_ABS" ] || infra "shipped template missing: $TEMPLATE_ABS"

HEAD_BLOB_SHA="$(git -C "$CF_REPO_ROOT" show "HEAD:$TEMPLATE_REL" | hash_stdin)"
[ -n "$HEAD_BLOB_SHA" ] || infra "could not hash HEAD blob of $TEMPLATE_REL"

WT="$(mktemp -d "${TMPDIR:-/tmp}/s1-batch-e-tmpl-XXXXXX")"
cleanup() {
  git -C "$CF_REPO_ROOT" worktree remove --force "$WT" >/dev/null 2>&1 || \
    echo "WARN: worktree cleanup failed — run: git worktree remove --force $WT" >&2
}
trap cleanup EXIT

echo "== phase: scratch worktree at HEAD ($HEAD_BLOB_SHA) =="
git -C "$CF_REPO_ROOT" worktree add --detach "$WT" HEAD >/dev/null || infra "git worktree add failed"
ln -s "$CF_REPO_ROOT/node_modules" "$WT/node_modules"
# Package-level provisioning parity (see replay-fences-fire-deletion.sh note).
ln -s "$CF_REPO_ROOT/packages/core/node_modules" "$WT/packages/core/node_modules"
WT_TEMPLATE="$WT/$TEMPLATE_REL"

# Pre-image pinning: the worktree copy must be byte-identical to the HEAD blob.
[ "$(hash_file "$WT_TEMPLATE")" = "$HEAD_BLOB_SHA" ] || die "worktree pre-image differs from HEAD blob"

echo "== phase: baseline principle run (pristine worktree) =="
run_scratch_vitest "$WT/packages/core" baseline "$PRINCIPLE_FILTER"
expect_file_status "$WT/packages/core/report-baseline.json" 25-template-rule-ref-resolution.test.ts pass

echo "== phase: delivery break — seed the dangling ref into the shipped template =="
apply_patch_once "$WT_TEMPLATE" \
  "      'rules-as-tests/no-vacuous-assertion': 'error'," \
  "      'rules-as-tests/no-vacuous-assertion': 'error',
      'rules-as-tests/${DANGLING_ID}': 'error'," \
  "batch-e: template family — seed dangling rules-as-tests/${DANGLING_ID} ref"

echo "== phase: counterfactual — principle 25 must go RED naming the dangling id =="
run_scratch_vitest "$WT/packages/core" counterfactual "$PRINCIPLE_FILTER"
CF_REPORT="$WT/packages/core/report-counterfactual.json"
expect_file_status "$CF_REPORT" 25-template-rule-ref-resolution.test.ts fail
expect_intended "$CF_REPORT" 25-template-rule-ref-resolution.test.ts "${DANGLING_ID}"
grep -q "rules-as-tests/${DANGLING_ID}" "$WT/packages/core/stdout-counterfactual.log" \
  || die "principle 25 went RED but the dangling ref id is absent from its output"
echo "OK killed-by: 'rules-as-tests/${DANGLING_ID}' named in the principle-25 failure"

echo "== phase: restoration (git checkout + hash equality with the HEAD blob) =="
git -C "$WT" checkout -- "$TEMPLATE_REL" || infra "git checkout restore failed"
[ "$(hash_file "$WT_TEMPLATE")" = "$HEAD_BLOB_SHA" ] || die "restored template differs from the HEAD blob"
echo "RESTORED $TEMPLATE_REL sha256=$HEAD_BLOB_SHA"
run_scratch_vitest "$WT/packages/core" restored "$PRINCIPLE_FILTER"
expect_file_status "$WT/packages/core/report-restored.json" 25-template-rule-ref-resolution.test.ts pass

echo "== phase: final passing baseline in the MAIN checkout (post-experiment) =="
[ -z "$(git -C "$CF_REPO_ROOT" status --porcelain "$TEMPLATE_REL")" ] \
  || die "main checkout template is dirty — scratch discipline violated"
run_scratch_vitest "$CF_REPO_ROOT/packages/core" final "$PRINCIPLE_FILTER"
expect_file_status "$CF_REPO_ROOT/packages/core/report-final.json" 25-template-rule-ref-resolution.test.ts pass
rm -f "$CF_REPO_ROOT/packages/core/report-final.json" "$CF_REPO_ROOT/packages/core/stdout-final.log"

echo "TEMPLATE-DANGLING-REF VERDICT: pass (dangling ref reached the real gate; principle 25 failed naming it; restored + final baseline green)"
exit 0
