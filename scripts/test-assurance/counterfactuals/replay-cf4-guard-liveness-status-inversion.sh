#!/usr/bin/env bash
# CF4 — fresh kernel-subject fault, second arm (the boundary pair to CF3):
# maximally-permissive fail-status inversion in guard-liveness.ts.
#
# Fault (reached, non-equivalent to CF3 by construction): the terminal verdict
# `if (failures.length > 0) return { status: 'fail', failures };` becomes
# `return { status: 'pass', failures };` — the gate can then NEVER report fail,
# regardless of input class. Unlike the CF3 fallthrough (reachable only through
# fatal-parse-error messages), this fault flips EVERY failing invocation, including
# the zero-message shape the recorded GLV-1 fixture uses — so the guard-liveness
# suite's own paired-negative must kill it on the intended assertion
# (`expected 'pass' to be 'fail'`).
#
# Applied to a DETACHED SCRATCH WORKTREE (pattern:
# packages/core/audit-self/pre-merge-local.sh:240); the main checkout is never mutated.
#
# Independent reachability observation: a tsx probe calls runRuleLiveness directly with
# a clean zero-message negative-test input (the BROKEN_LIVENESS_RULE shape) — status
# flips fail (pristine) → pass (mutant), no test file involved.
#
# Exit: 0 demonstration reproduced · 1 demonstration failed · 3 infrastructure.
# Spec §6 record: docs/test-assurance-kernel/s1/counterfactuals/cf4-guard-liveness-status-inversion.json

set -uo pipefail
# shellcheck source=counterfactual-lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/counterfactual-lib.sh"

KERNEL_FILE="packages/core/hooks/checks/guard-liveness.ts"
KERNEL_ABS="$CF_REPO_ROOT/$KERNEL_FILE"
SUITE_FILTER="hooks/checks/guard-liveness.test.ts"
[ -f "$KERNEL_ABS" ] || infra "kernel subject missing: $KERNEL_ABS"

HEAD_BLOB_SHA="$(git -C "$CF_REPO_ROOT" show "HEAD:$KERNEL_FILE" | hash_stdin)"
[ -n "$HEAD_BLOB_SHA" ] || infra "could not hash HEAD blob of $KERNEL_FILE"

WT="$(mktemp -d "${TMPDIR:-/tmp}/s1-cf4-XXXXXX")"
cleanup() {
  git -C "$CF_REPO_ROOT" worktree remove --force "$WT" >/dev/null 2>&1 || \
    echo "WARN: worktree cleanup failed — run: git worktree remove --force $WT" >&2
  # C3 (Batch I cold review, F-H7 parity): the final baseline writes these into the MAIN
  # checkout; a die in the final phase must not litter them into the tree the next gate runs in.
  rm -f "$CF_REPO_ROOT/packages/core/report-final.json" "$CF_REPO_ROOT/packages/core/stdout-final.log"
}
trap cleanup EXIT

echo "== phase: scratch worktree at HEAD ($HEAD_BLOB_SHA) =="
git -C "$CF_REPO_ROOT" worktree add --detach "$WT" HEAD >/dev/null || infra "git worktree add failed"
ln -s "$CF_REPO_ROOT/node_modules" "$WT/node_modules"
WT_KERNEL="$WT/$KERNEL_FILE"

# Pre-image pinning: the worktree copy must be byte-identical to the HEAD blob.
[ "$(hash_file "$WT_KERNEL")" = "$HEAD_BLOB_SHA" ] || die "worktree pre-image differs from HEAD blob"

# Reachability probe — direct runRuleLiveness call, independent of any test file.
cat >"$WT/probe-kernel-subject.mts" <<'EOF'
import { runRuleLiveness, type ManifestRule } from './packages/core/hooks/checks/guard-liveness.ts';

// Clean zero-message negative-test input (the GLV-1 BROKEN_LIVENESS_RULE shape): the
// input produces no violations, a healthy matcher reports the miss (status fail); the
// inverted terminal verdict can never report fail.
const rule: ManifestRule = {
  check: { type: 'eslint', rule: 'rules-as-tests/no-server-imports-in-client' },
  examples: {
    bad: "'use client';\nimport fs from 'fs';\nexport const x = 1;",
    good: "'use client';\nimport { useState } from 'react';\nexport function C() { return null; }",
  },
  'negative-test': {
    input: ["'use client';\nimport { useState } from 'react';\nexport function C() { return null; }"],
    'expect-violation': 'rules-as-tests/no-server-imports-in-client',
  },
};
const res = runRuleLiveness('S1-CF4-PROBE', rule);
console.log(`PROBE status=${res.status}`);
if (res.failures) console.log(`PROBE failures=${JSON.stringify(res.failures)}`);
EOF

echo "== phase: baseline suite (pristine worktree) =="
run_scratch_vitest "$WT/packages/core" baseline "$SUITE_FILTER"
expect_file_status "$WT/packages/core/report-baseline.json" guard-liveness.test.ts pass

echo "== phase: healthy probe (fault absent → the miss IS reported) =="
expect_tsx_probe "$WT/probe-kernel-subject.mts" 'PROBE status=fail'

echo "== phase: fault — fail-status inversion, scratch worktree only =="
apply_patch_once "$WT_KERNEL" \
  "if (failures.length > 0) return { status: 'fail', failures };" \
  "if (failures.length > 0) return { status: 'pass', failures };" \
  'cf4: guard-liveness terminal verdict fail -> pass'

echo "== phase: reachability under the fault (the miss is no longer reported) =="
expect_tsx_probe "$WT/probe-kernel-subject.mts" 'PROBE status=pass'

echo "== phase: counterfactual suite — the gate's own suite must catch this =="
run_scratch_vitest "$WT/packages/core" counterfactual "$SUITE_FILTER"
CF_REPORT="$WT/packages/core/report-counterfactual.json"
expect_file_status "$CF_REPORT" guard-liveness.test.ts fail
expect_intended "$CF_REPORT" guard-liveness.test.ts "expected 'pass' to be 'fail'"
grep -q 'GLV-1' "$WT/packages/core/stdout-counterfactual.log" \
  || die "guard-liveness suite went RED but no [GLV-1] test name appears in its output"
echo "OK killed-test named: [GLV-1] appears in the counterfactual suite output"

echo "== phase: restoration (git checkout + hash equality with the HEAD blob) =="
git -C "$WT" checkout -- "$KERNEL_FILE" || infra "git checkout restore failed"
[ "$(hash_file "$WT_KERNEL")" = "$HEAD_BLOB_SHA" ] || die "restored file differs from the HEAD blob"
echo "RESTORED $KERNEL_FILE sha256=$HEAD_BLOB_SHA"
expect_tsx_probe "$WT/probe-kernel-subject.mts" 'PROBE status=fail'
run_scratch_vitest "$WT/packages/core" restored "$SUITE_FILTER"
expect_file_status "$WT/packages/core/report-restored.json" guard-liveness.test.ts pass

echo "== phase: final passing baseline in the MAIN checkout (post-experiment) =="
[ -z "$(git -C "$CF_REPO_ROOT" status --porcelain "$KERNEL_FILE")" ] \
  || die "main checkout kernel file is dirty — scratch discipline violated"
run_scratch_vitest "$CF_REPO_ROOT/packages/core" final "$SUITE_FILTER"
expect_file_status "$CF_REPO_ROOT/packages/core/report-final.json" guard-liveness.test.ts pass
rm -f "$CF_REPO_ROOT/packages/core/report-final.json" "$CF_REPO_ROOT/packages/core/stdout-final.log"

echo "CF4 VERDICT: pass (inverted verdict reached via zero-message probe; killed by [GLV-1] on the intended assertion; restored + final baseline green)"
exit 0
