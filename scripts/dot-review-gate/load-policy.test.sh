#!/usr/bin/env bash
# Paired-negative for scripts/dot-review-gate/load-policy.mjs.
#
# The trusted policy manifest is what makes a mechanical context MANDATORY and binds it
# to an expected publisher App. A placeholder ("UNRESOLVED") or a dot context that
# slipped into the mechanical set must fail the load — fail-closed, because a partially
# resolved manifest would otherwise silently narrow the gate.
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
MOD="$DIR/load-policy.mjs"
FIX="$(cd "$DIR/../.." && pwd)/tests/dot-review-gate/fixtures/make-admission.mjs"

fails=0
run_case() { # NAME EXPECT(EXPECT|REJECT) CODE POLICY-EXPR
  local name="$1" want="$2" code="$3" expr="$4"
  local out
  out=$(node --input-type=module -e "
import { makePolicyFixture } from '$FIX';
import { loadPolicy, isDotContext, mandatoryMechanical, policyDigest } from '$MOD';
try {
  const p = loadPolicy(JSON.stringify($expr));
  console.log('LOADED|' + mandatoryMechanical(p).length + '|' + isDotContext('dot-review/v1') + '|' + (policyDigest(p).length === 64));
} catch (e) {
  console.log('REJECTED|' + (e.code || '?') + '|' + e.message.slice(0, 60));
}
" 2>&1 | tail -1)
  if [[ "$want" == EXPECT ]]; then
    if [[ "$out" != LOADED* ]]; then echo "FAIL[$name] expected load, got: $out"; fails=$((fails+1)); return; fi
  else
    if [[ "$out" != REJECTED* ]]; then echo "FAIL[$name] expected reject, got: $out"; fails=$((fails+1)); return; fi
    if [[ -n "$code" && "$out" != *"$code"* ]]; then echo "FAIL[$name] wrong code, wanted '$code' got: $out"; fails=$((fails+1)); return; fi
  fi
  echo "ok[$name]"
}

run_case valid-instantiated      EXPECT ''                 'makePolicyFixture()'
run_case unresolved-schema-digest REJECT 'E_PLACEHOLDER'   'makePolicyFixture({schema_sha256:"UNRESOLVED"})'
run_case unresolved-dot-app      REJECT 'E_PLACEHOLDER'   'makePolicyFixture({dot_check:{context:"dot-review/v1", expected_app_id:"UNRESOLVED"}})'
run_case unresolved-expiry       REJECT 'E_PLACEHOLDER'   'makePolicyFixture({authorization_expiry:"UNRESOLVED"})'
run_case wrong-repo-id           REJECT 'E_REPOSITORY'    'makePolicyFixture({repository_id:42})'
run_case no-mechanical-contexts  REJECT 'E_MECHANICAL'    'makePolicyFixture({mechanical_contexts:[]})'
run_case dot-as-mechanical       REJECT 'E_MECHANICAL'    'makePolicyFixture({mechanical_contexts:[{context:"dot-review/v1", expected_app_id:1, bound_to:"head"}]})'
run_case bad-bound-to            REJECT 'E_MECHANICAL'    'makePolicyFixture({mechanical_contexts:[{context:"ci-success", expected_app_id:15368, bound_to:"branch", workflow_path:".github/workflows/audit-self.yml"}]})'
run_case missing-workflow-path   REJECT 'E_MECHANICAL'    'makePolicyFixture({mechanical_contexts:[makePolicyFixture().mechanical_contexts[0]].map((c) => ({...c, workflow_path: undefined}))})'
run_case untrusted-workflow-path REJECT 'E_MECHANICAL'    'makePolicyFixture({mechanical_contexts:[{context:"ci-success", expected_app_id:15368, bound_to:"merge", workflow_path:"scripts/evil.sh"}]})'
run_case zero-lease              REJECT 'E_LIMITS'        'makePolicyFixture({limits:{max_active_claims:1, max_attempts_per_tuple:2, claim_lease_minutes:0}})'
run_case past-expiry             REJECT 'E_EXPIRY'        'makePolicyFixture({authorization_expiry:"2020-01-01T00:00:00Z"})'
run_case reviewer-list-empty     REJECT 'E_PRINCIPAL'     'makePolicyFixture({reviewer_principal_ids:[]})'

# helper semantics
helper_out=$(node --input-type=module -e "
import { makePolicyFixture } from '$FIX';
import { loadPolicy, isDotContext, mandatoryMechanical } from '$MOD';
const p = loadPolicy(JSON.stringify(makePolicyFixture()));
const ctxs = mandatoryMechanical(p).map((c) => c.context);
console.log('dot:' + isDotContext('dot-review/observe-v1') + ',' + isDotContext('dot-review/pause') + ',' + isDotContext('ci-success'));
console.log('mech:' + ctxs.includes('ci-success') + ',' + ctxs.some((c) => c.startsWith('dot-review/')));
" 2>&1 | tail -2)
if [[ "$helper_out" != *"dot:true,true,false"* ]]; then echo "FAIL[isDotContext] got: $helper_out"; fails=$((fails+1)); else echo "ok[isDotContext]"; fi
if [[ "$helper_out" != *"mech:true,false"* ]]; then echo "FAIL[mechanical-excl-dot] got: $helper_out"; fails=$((fails+1)); else echo "ok[mechanical-excl-dot]"; fi

echo "----"
if [[ $fails -gt 0 ]]; then echo "FAILURES: $fails"; exit 1; fi
echo "load-policy.test.sh: all green"
