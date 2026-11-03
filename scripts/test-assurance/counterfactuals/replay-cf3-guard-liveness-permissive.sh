#!/usr/bin/env bash
# CF3 — fresh kernel-subject fault (batch-D novelty beyond seeds A03/A06):
# permissive `matchesViolation` fallthrough mutant in guard-liveness.ts.
#
# Fault (reached, non-equivalent): the violation matcher's fallthrough `return false;`
# becomes `return true;`. REACHABILITY IS INPUT-SHAPE-DEPENDENT (found by static
# reading of runRuleLiveness before the run, iteration 2): the roundtrip config enables
# exactly one rule, so the only messages possible are (a) violations OF that rule —
# which line 93 matches unconditionally — and (b) fatal parse errors, whose ruleId is
# null and are therefore the ONLY message class that reaches the fallthrough. A clean
# zero-message input never invokes the matcher at all (`messages.some(...)` over an
# empty array). The probe input is therefore a fatal parse error.
#
# Applied to a DETACHED SCRATCH WORKTREE (pattern:
# packages/core/audit-self/pre-merge-local.sh:240); the main checkout is never mutated.
#
# Independent reachability observation: a tsx probe calls runRuleLiveness directly with
# the parse-error input — status flips fail (pristine) → pass (mutant), no test file
# involved. The SUITE outcome is OBSERVED, not presumed: the recorded suite fixture
# (GLV-1) uses a clean zero-message input, which this reading predicts CANNOT reach the
# fallthrough — if the suite survives, the script emits CF3-SUITE-OUTCOME survived and
# the record classifies reached-not-killed (honest detection gap → dispositions queue);
# if it goes RED, CF3-SUITE-OUTCOME killed + the [GLV-1] name must appear. Either way
# exit 0 = demonstration (fault pinned, reachability proven, suite verdict observed).
#
# Exit: 0 demonstration reproduced · 1 demonstration failed · 3 infrastructure.
# Spec §6 record: docs/test-assurance-kernel/s1/counterfactuals/cf3-guard-liveness-permissive.json

set -uo pipefail
# shellcheck source=counterfactual-lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/counterfactual-lib.sh"

KERNEL_FILE="packages/core/hooks/checks/guard-liveness.ts"
KERNEL_ABS="$CF_REPO_ROOT/$KERNEL_FILE"
SUITE_FILTER="hooks/checks/guard-liveness.test.ts"
[ -f "$KERNEL_ABS" ] || infra "kernel subject missing: $KERNEL_ABS"

HEAD_BLOB_SHA="$(git -C "$CF_REPO_ROOT" show "HEAD:$KERNEL_FILE" | hash_stdin)"
[ -n "$HEAD_BLOB_SHA" ] || infra "could not hash HEAD blob of $KERNEL_FILE"

WT="$(mktemp -d "${TMPDIR:-/tmp}/s1-cf3-XXXXXX")"
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

// Fatal parse error input: the ONLY message class whose ruleId differs from the
// configured rule, hence the only input that reaches the matchesViolation fallthrough
// (clean inputs yield zero messages and `.some()` never calls the matcher). A healthy
// matcher reports the miss (status fail); a permissive fallthrough passes it.
const rule: ManifestRule = {
  check: { type: 'eslint', rule: 'rules-as-tests/no-server-imports-in-client' },
  examples: {
    bad: "'use client';\nimport fs from 'fs';\nexport const x = 1;",
    good: "'use client';\nimport { useState } from 'react';\nexport function C() { return null; }",
  },
  'negative-test': {
    input: ['const totally = ;'],
    'expect-violation': 'rules-as-tests/no-server-imports-in-client',
  },
};
const res = runRuleLiveness('S1-CF3-PROBE', rule);
console.log(`PROBE status=${res.status}`);
if (res.failures) console.log(`PROBE failures=${JSON.stringify(res.failures)}`);
EOF

echo "== phase: baseline suite (pristine worktree) =="
run_scratch_vitest "$WT/packages/core" baseline "$SUITE_FILTER"
expect_file_status "$WT/packages/core/report-baseline.json" guard-liveness.test.ts pass

echo "== phase: healthy probe (fault absent → the miss IS reported) =="
expect_tsx_probe "$WT/probe-kernel-subject.mts" 'PROBE status=fail'

echo "== phase: fault — permissive matchesViolation (fallthrough false -> true), scratch worktree only =="
apply_patch_once "$WT_KERNEL" \
  $'  if (message.ruleId === ruleName) return true;\n  return false;' \
  $'  if (message.ruleId === ruleName) return true;\n  return true;' \
  'cf3: guard-liveness matchesViolation permissive (return false -> return true)'

echo "== phase: reachability under the fault (the miss is no longer reported) =="
expect_tsx_probe "$WT/probe-kernel-subject.mts" 'PROBE status=pass'

echo "== phase: counterfactual suite — does the gate's own suite kill this? (observed, not presumed) =="
run_scratch_vitest "$WT/packages/core" counterfactual "$SUITE_FILTER"
CF_REPORT="$WT/packages/core/report-counterfactual.json"
SUITE_OUTCOME="$(node -e '
  const fs = require("node:fs");
  const r = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const tr = (r.testResults ?? []).find((t) => (t.name ?? "").split("/").pop() === "guard-liveness.test.ts");
  if (!tr) { console.error("report carries NO result for guard-liveness.test.ts [T-TAK-A]"); process.exit(3); }
  console.log(tr.status === "failed" ? "killed" : "survived");
' "$CF_REPORT")" || exit 3
echo "CF3-SUITE-OUTCOME $SUITE_OUTCOME"
if [ "$SUITE_OUTCOME" = "killed" ]; then
  grep -q 'GLV-1' "$WT/packages/core/stdout-counterfactual.log" \
    || die "guard-liveness suite went RED but no [GLV-1] test name appears in its output"
  echo "OK killed-test named: [GLV-1] appears in the counterfactual suite output"
else
  echo "OBSERVED-GAP: kernel suite SURVIVED the fallthrough-permissive mutant — recorded honestly as reached-not-killed (detection gap -> dispositions queue); cf4 pins the permissive fault the suite DOES kill"
fi

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

echo "CF3 VERDICT: pass (fallthrough mutant reached via parse-error probe; suite outcome observed: $SUITE_OUTCOME; restored + final baseline green)"
exit 0
