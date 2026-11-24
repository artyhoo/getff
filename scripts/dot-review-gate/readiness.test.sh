#!/usr/bin/env bash
# Paired-negative for scripts/dot-review-gate/readiness.mjs.
#
# Mechanical readiness decides whether semantic review may START (protocol §3). Every
# substitution direction must fail: a context missing, its latest attempt red/skipped
# after an earlier green, a wrong App publishing it, evidence pinned to a stale head, a
# merge-bound check published on the head instead of M, unknown mergeability, a SPOOFED
# workflow identity, or a run whose identity/version the policy does not trust (review
# R9). "Latest attempt" is resolved per RUN (identity, start time, rerun attempt) — a
# bare attempt counter across unrelated runs let an older green mask a newer red.
# Dot's own contexts must never be mechanical evidence (circular waiting).
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
MOD="$DIR/readiness.mjs"
FIX="$(cd "$DIR/../.." && pwd)/tests/dot-review-gate/fixtures/make-admission.mjs"

fails=0
# run_case NAME EXPECT(READY|WAIT) REASON-SUBSTR POLICY-EXPR JS-EXPR (expr: (base)=>actual)
run_case() {
  local name="$1" want="$2" reason="$3" policy_expr="${4:-makePolicyFixture()}" expr="$5"
  local out
  out=$(node --input-type=module -e "
import { makePolicyFixture } from '$FIX';
import { evaluateReadiness } from '$MOD';
const policy = ($policy_expr);
const SHA = (c) => String(c).repeat(40);
const PATHS = {
  'ci-success': '.github/workflows/audit-self.yml',
  'fidelity-verdict-in-pr-body': '.github/workflows/discipline-self-check.yml',
  'stale-revert-in-pr-diff': '.github/workflows/audit-self.yml',
  'Template render probes — P1/P4/P6 (deterministic)': '.github/workflows/audit-self.yml',
  'capability PR carries Prior-art line in PR body (squash-survival)': '.github/workflows/audit-self.yml',
  '§1.7 forward+backward sections present in PR description': '.github/workflows/discipline-self-check.yml',
};
const mk = (ctx, over = {}) => ({
  context: ctx, app_id: 15368, sha: PATHS ? (ctx === 'ci-success' ? SHA('d') : SHA('c')) : '',
  conclusion: 'success', workflow_path: PATHS[ctx], run_id: 101, run_attempt: 1,
  run_started_at: '2026-10-05T11:00:00Z', workflow_sha: SHA('f'), ...over,
});
const base = {head_sha:SHA('c'), tested_merge_sha:SHA('d'), mergeability:'clean', merge_ref_present:true, checks:Object.keys(PATHS).map((c) => mk(c))};
const actual = ($expr)(base);
const r = evaluateReadiness(policy, actual);
console.log((r.ready ? 'READY' : 'WAIT') + '|' + r.blocking.map((b) => b.code).join(';').slice(0, 200));
" 2>&1 | tail -1)
  if [[ "$want" == READY && "$out" != READY* ]]; then echo "FAIL[$name] expected ready, got: $out"; fails=$((fails+1)); return; fi
  if [[ "$want" == WAIT ]]; then
    if [[ "$out" != WAIT* ]]; then echo "FAIL[$name] expected wait, got: $out"; fails=$((fails+1)); return; fi
    if [[ -n "$reason" && "$out" != *"$reason"* ]]; then echo "FAIL[$name] wrong reason, wanted '$reason' got: $out"; fails=$((fails+1)); return; fi
  fi
  echo "ok[$name]"
}

run_case all-current              READY ''                                     'makePolicyFixture()' '(b) => b'
run_case dot-context-ignored      READY ''                                     'makePolicyFixture()' '(b) => ({...b, checks:[...b.checks, {context:"dot-review/v1", app_id:999999999, sha:"d".repeat(40), conclusion:"success", attempt:1}]})'
run_case context-missing          WAIT 'MISSING'                               'makePolicyFixture()' '(b) => ({...b, checks: b.checks.filter((c) => c.context !== "stale-revert-in-pr-diff")})'
run_case latest-red-after-green   WAIT 'LATEST_ATTEMPT'                        'makePolicyFixture()' '(b) => ({...b, checks: [...b.checks, {...b.checks.find((c) => c.context === "ci-success"), conclusion:"failure", run_attempt:2}]})'
run_case latest-skipped           WAIT 'LATEST_ATTEMPT'                        'makePolicyFixture()' '(b) => ({...b, checks: [...b.checks, {...b.checks.find((c) => c.context === "ci-success"), conclusion:"skipped", run_attempt:2}]})'
run_case neutral-not-success      WAIT 'LATEST_ATTEMPT'                        'makePolicyFixture()' '(b) => ({...b, checks: b.checks.map((c) => c.context === "ci-success" ? {...c, conclusion:"neutral"} : c)})'
run_case wrong-app-published      WAIT 'APP'                                   'makePolicyFixture()' '(b) => ({...b, checks: b.checks.map((c) => c.context.startsWith("§1.7") ? {...c, app_id:999} : c)})'
run_case stale-head-evidence      WAIT 'BOUND_SHA'                             'makePolicyFixture()' '(b) => ({...b, checks: b.checks.map((c) => c.context === "fidelity-verdict-in-pr-body" ? {...c, sha:"9".repeat(40)} : c)})'
run_case merge-bound-on-head      WAIT 'BOUND_SHA'                             'makePolicyFixture()' '(b) => ({...b, checks: b.checks.map((c) => c.context === "ci-success" ? {...c, sha:"c".repeat(40)} : c)})'
run_case mergeability-conflict    WAIT 'MERGEABILITY'                          'makePolicyFixture()' '(b) => ({...b, mergeability:"conflict"})'
run_case mergeability-unknown     WAIT 'MERGEABILITY'                          'makePolicyFixture()' '(b) => ({...b, mergeability:"unknown"})'
run_case merge-ref-absent         WAIT 'MERGE_REF'                             'makePolicyFixture()' '(b) => ({...b, merge_ref_present:false})'

# ── R9: workflow identity belongs to the trusted policy, not the caller ──────
run_case spoofed-workflow-path    WAIT 'WORKFLOW'                              'makePolicyFixture()' '(b) => ({...b, checks: b.checks.map((c) => c.context === "ci-success" ? {...c, workflow_path:".github/workflows/untrusted.yml"} : c)})'
run_case missing-run-identity     WAIT 'WORKFLOW'                              'makePolicyFixture()' '(b) => ({...b, checks: b.checks.map((c) => c.context === "ci-success" ? {context:c.context, app_id:c.app_id, sha:c.sha, conclusion:c.conclusion} : c)})'
run_case stale-workflow-version   WAIT 'WORKFLOW'                              'makePolicyFixture({mechanical_contexts: makePolicyFixture().mechanical_contexts.map((c) => c.context === "ci-success" ? {...c, workflow_sha:"1".repeat(40)} : c)})' '(b) => b'
run_case workflow-version-pinned  READY ''                                     'makePolicyFixture({mechanical_contexts: makePolicyFixture().mechanical_contexts.map((c) => c.context === "ci-success" ? {...c, workflow_sha:"f".repeat(40)} : c)})' '(b) => b'

# ── R9: the current execution is per-RUN, not a bare attempt counter ─────────
run_case older-green-newer-red    WAIT 'LATEST_ATTEMPT'                        'makePolicyFixture()' '(b) => ({...b, checks: [...b.checks, {...b.checks.find((c) => c.context === "ci-success"), run_id:102, run_started_at:"2026-10-05T11:30:00Z", run_attempt:1, conclusion:"failure"}]})'
run_case rerun-green-same-run     READY ''                                     'makePolicyFixture()' '(b) => ({...b, checks: [...b.checks, {...b.checks.find((c) => c.context === "ci-success"), run_id:102, run_started_at:"2026-10-05T11:30:00Z", run_attempt:1, conclusion:"failure"}, {...b.checks.find((c) => c.context === "ci-success"), run_id:102, run_started_at:"2026-10-05T11:30:00Z", run_attempt:2, conclusion:"success"}]})'
run_case run-id-tiebreak          READY ''                                     'makePolicyFixture()' '(b) => ({...b, checks: [...b.checks, {...b.checks.find((c) => c.context === "ci-success"), run_id:99, run_started_at:"2026-10-05T11:00:00Z", run_attempt:1, conclusion:"failure"}]})'
run_case new-run-red-blocks-old-green WAIT 'LATEST_ATTEMPT'                    'makePolicyFixture()' '(b) => ({...b, checks: [...b.checks, {...b.checks.find((c) => c.context === "ci-success"), run_id:103, run_started_at:"2026-10-05T12:30:00Z", run_attempt:3, conclusion:"failure"}]})'

echo "----"
if [[ $fails -gt 0 ]]; then echo "FAILURES: $fails"; exit 1; fi
echo "readiness.test.sh: all green"
