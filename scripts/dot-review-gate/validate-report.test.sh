#!/usr/bin/env bash
# Paired-negative for scripts/dot-review-gate/validate-report.mjs.
#
# The publisher authorizes a staging admission ONLY from a report that is byte-strict
# parsed, schema-valid, semantically self-consistent, and matched against the current
# tuple. Each RED arm mutates exactly ONE input of the canonical valid fixture (fixed
# siblings, tests/fixtures/make-admission.mjs) and expects a named rejection code;
# each GREEN arm proves the unchanged fixture and its legitimate variants pass, so a
# side-effecting sibling cannot produce a false GREEN.
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
MOD="$DIR/validate-report.mjs"
FIX="$(cd "$DIR/../.." && pwd)/tests/dot-review-gate/fixtures/make-admission.mjs"
SCHEMA="$(cd "$DIR/../.." && pwd)/docs/meta-factory/dot-review-result.schema.json"
NOW="2026-10-05T12:00:00Z"

fails=0
# run_case NAME EXPECT_OK EXPECT_CODE-STRING REPORT-OBJ-EXPR POLICY-FLAG STATE-OBJ-EXPR
run_case() {
  local name="$1" want_ok="$2" want_code="$3" expr="$4" with_policy="${5:-}" state_expr="${6:-undefined}"
  local out
  out=$(node --input-type=module -e "
import { makeAdmission, makeBaseline, makeHistorical, makePolicyFixture } from '$FIX';
import { validateReport } from '$MOD';
import { readFileSync } from 'node:fs';
const schemaBytes = readFileSync('$SCHEMA');
const policy = $with_policy ? makePolicyFixture() : undefined;
const state = $state_expr;
const report = $expr;
const r = validateReport(JSON.stringify(report), { schemaBytes, policy, now: '$NOW', currentState: state });
const ok = r.ok ? 'PASS' : 'FAIL';
const codes = r.errors.map((e) => e.code).join(',');
console.log(ok + '|' + codes);
" 2>&1 | tail -1)
  if [[ "$want_ok" == PASS && "$out" != PASS* ]]; then
    echo "FAIL[$name] expected accept, got: $out"; fails=$((fails+1)); return
  fi
  if [[ "$want_ok" == REJECT ]]; then
    if [[ "$out" != FAIL* ]]; then echo "FAIL[$name] expected reject, got: $out"; fails=$((fails+1)); return; fi
    if [[ -n "$want_code" && "$out" != *"$want_code"* ]]; then
      echo "FAIL[$name] wrong code, wanted '$want_code' got: $out"; fails=$((fails+1)); return
    fi
  fi
  echo "ok[$name]"
}

P='true'   # policy attached (inventory cross-checks on)
NOP='false'

# ── GREEN: canonical fixtures pass ────────────────────────────────────────────
run_case admission-valid          PASS '' 'makeAdmission()' "$P"
run_case admission-no-policy      PASS '' 'makeAdmission()' "$NOP"
run_case baseline-valid           PASS '' 'makeBaseline()'  "$P"
run_case historical-valid         PASS '' 'makeHistorical()' "$P"
run_case revise-report-ok         PASS '' 'makeAdmission({completion:"INCOMPLETE", verdict:"REVISE", execution:{failure:true, failure_reason:"lease expired mid-review"}})' "$P"

# ── RED: parser layer (bytes, not objects) ───────────────────────────────────
# (dup-key is exercised against raw text in its own arm below — object builders cannot carry it)

# ── RED: schema layer ─────────────────────────────────────────────────────────
run_case unknown-field            REJECT 'E_SCHEMA'    'makeAdmission({extra_field:1})' "$P"
run_case wrong-repo-id            REJECT 'E_SCHEMA'    'makeAdmission({repository:{id:999, full_name:"artyhoo/getff"}})' "$P"
run_case admission-null-M         REJECT 'E_SCHEMA'    'makeAdmission({revision:{tested_merge_sha:null}})' "$P"
run_case admission-base-not-stg   REJECT 'E_SCHEMA'    'makeAdmission({revision:{base_ref:"main"}})' "$P"
run_case wrong-protocol           REJECT 'E_SCHEMA'    'makeAdmission({protocol_version:"dot-staging-review/2.0"})' "$P"
run_case bad-sha-uppercase        REJECT 'E_SCHEMA'    'makeAdmission({revision:{head_sha:"C".repeat(40)}})' "$P"
run_case path-traversal           REJECT 'E_SCHEMA'    'makeAdmission({coverage:{changed_files:["../escape.ts"]}})' "$P"
run_case go-with-incomplete       REJECT 'E_SCHEMA'    'makeAdmission({completion:"INCOMPLETE"})' "$P"
run_case critical-not-blocking    REJECT 'E_SCHEMA'    'makeAdmission({findings:[{id:"F1",blocking:false,severity:"critical",category:"x",title:"t",description:"d",evidence:[{repository_id:1231007068,commit_sha:"c".repeat(40),path:"a.ts",blob_sha:"e".repeat(40),line_start:1,line_end:1,explanation:"x",trusted_run_or_report_id:null}],fix_expectation:"f",location:null,staging_verification:null}]})' "$P"
run_case admission-no-mechanical  REJECT 'E_SCHEMA'    'makeAdmission({mechanical_evidence:[]})' "$P"
run_case baseline-with-M          REJECT 'E_SCHEMA'    'makeBaseline({revision:{tested_merge_sha:"d".repeat(40)}})' "$P"

# ── RED: semantic layer (schema cannot see these) ────────────────────────────
run_case line-range-inverted      REJECT 'E_LINE_RANGE'  'makeAdmission({goal_evidence:[{id:"g",applicability:"APPLICABLE",rationale:"r",result:"PASS",evidence:[{repository_id:1231007068,commit_sha:"c".repeat(40),path:"a.ts",blob_sha:"e".repeat(40),line_start:5,line_end:2,explanation:"x",trusted_run_or_report_id:null}]}]})' "$P"
run_case time-order-inverted      REJECT 'E_TIME_ORDER'  'makeAdmission({execution:{finished_at:"2026-10-05T09:00:00Z"}})' "$P"
run_case time-future              REJECT 'E_TIME_FUTURE' 'makeAdmission({execution:{finished_at:"2026-10-05T23:59:00Z"}})' "$P"
run_case count-mismatch           REJECT 'E_COUNT'       'makeAdmission({coverage:{changed_count:2}})' "$P"
run_case reviewed-not-subset      REJECT 'E_REVIEWED_SUBSET' 'makeAdmission({coverage:{reviewed_files:[{path:"other/not-in-diff.ts",disposition:"REVIEWED",rationale:"r",evidence:[{repository_id:1231007068,commit_sha:"c".repeat(40),path:"other/not-in-diff.ts",blob_sha:"e".repeat(40),line_start:1,line_end:1,explanation:"x",trusted_run_or_report_id:null}]}]}})' "$P"
run_case dup-principle-id         REJECT 'E_DUP_ID'      'makeAdmission({principle_evidence:[...makeAdmission().principle_evidence, ...makeAdmission().principle_evidence]})' "$P"
run_case dup-dimension-id         REJECT 'E_DUP_ID'      'makeAdmission({coverage:{dimensions:[...makeAdmission().coverage.dimensions.slice(0,10), makeAdmission().coverage.dimensions[0]]}})' "$P"
run_case failure-reason-missing   REJECT 'E_FAILURE'     'makeAdmission({completion:"INCOMPLETE", verdict:"REVISE", execution:{failure:true, failure_reason:null}})' "$P"
run_case dot-context-mechanical   REJECT 'E_DOT_MECHANICAL' 'makeAdmission({mechanical_evidence:[{context:"dot-review/v1",app_id:999999999,run_id:1,job_id:1,check_id:1,head_sha:"c".repeat(40),tested_sha:"d".repeat(40),workflow_id:1,workflow_path:".github/workflows/x.yml",workflow_version:"f".repeat(40),attempt:1,conclusion:"success"}]})' "$P"
run_case inventory-gap            REJECT 'E_INVENTORY'   'makeAdmission({principle_evidence:[makeAdmission().principle_evidence[0]]})' "$P"
run_case inventory-id-unknown     REJECT 'E_INVENTORY'   'makeAdmission({principle_evidence:[...makeAdmission().principle_evidence, {id:"ghost-principle",applicability:"APPLICABLE",rationale:"r",result:"PASS",evidence:[{repository_id:1231007068,commit_sha:"c".repeat(40),path:"a.ts",blob_sha:"e".repeat(40),line_start:1,line_end:1,explanation:"x",trusted_run_or_report_id:null}]}]})' "$P"

# ── RED: trusted-inventory coverage (review R4) ──────────────────────────────
# run_case has no inventory parameter; these arms use the dedicated runner below.
run_inv_case() { # NAME EXPECT_OK CODE REPORT-EXPR TRUSTED-EXPR EXTRA-STATE-FLAGS
  local name="$1" want_ok="$2" want_code="$3" expr="$4" trusted="$5" attach_state="${6:-yes}"
  local state_js='undefined'
  if [[ "$attach_state" == "yes" ]]; then
    state_js="{ base_sha:'b'.repeat(40), head_sha:'c'.repeat(40), tested_merge_sha:'d'.repeat(40), policy_sha256: policyDigestOf(makePolicyFixture()), protocol_version:'dot-staging-review/1.0', repository_id:1231007068, pr_number:2042, pr_node_id:'PR_kwDOM9YQhs6AbCdEfGh' }"
  fi
  local out
  out=$(node --input-type=module -e "
import { makeAdmission, makePolicyFixture, policyDigestOf } from '$FIX';
import { validateReport } from '$MOD';
import { readFileSync } from 'node:fs';
const schemaBytes = readFileSync('$SCHEMA');
const policy = makePolicyFixture();
const state = $state_js;
const r = validateReport(JSON.stringify($expr), { schemaBytes, policy, now: '$NOW', currentState: state, trustedInventory: $trusted });
const ok = r.ok ? 'PASS' : 'FAIL';
console.log(ok + '|' + r.errors.map((e) => e.code).join(','));
" 2>&1 | tail -1)
  if [[ "$want_ok" == PASS && "$out" != PASS* ]]; then
    echo "FAIL[$name] expected accept, got: $out"; fails=$((fails+1)); return
  fi
  if [[ "$want_ok" == REJECT ]]; then
    if [[ "$out" != FAIL* ]]; then echo "FAIL[$name] expected reject, got: $out"; fails=$((fails+1)); return; fi
    if [[ -n "$want_code" && "$out" != *"$want_code"* ]]; then
      echo "FAIL[$name] wrong code, wanted '$want_code' got: $out"; fails=$((fails+1)); return
    fi
  fi
  echo "ok[$name]"
}

STATE_ARG='{changed_files:["packages/core/principles/44-x.test.ts"]}'
# GREEN: exact match against the trusted inventory
run_inv_case inventory-exact          PASS ''                   'makeAdmission()' "$STATE_ARG"
# RED: the reviewer's repro — GO with ZERO reviewed files, counts internally consistent
run_inv_case zero-reviewed-rejected   REJECT 'E_REVIEWED_MISSING' 'makeAdmission({coverage:{reviewed_files:[],reviewed_count:0}})' "$STATE_ARG"
# RED: report omits a real trusted changed path (counts stay consistent)
run_inv_case changed-missing-trusted  REJECT 'E_CHANGED_MISSING' 'makeAdmission({coverage:{changed_files:[],changed_count:0,reviewed_files:[],reviewed_count:0}})' "$STATE_ARG"
# RED: report inventories a file the trusted diff does not carry
run_inv_case changed-extra-unknown    REJECT 'E_CHANGED_UNKNOWN'  'makeAdmission({coverage:{changed_files:["packages/core/principles/44-x.test.ts","ghost/extra.ts"],changed_count:2}})' "$STATE_ARG"
# RED: duplicate changed path
run_inv_case changed-duplicate-path   REJECT 'E_DUP_CHANGED'      'makeAdmission({coverage:{changed_files:["packages/core/principles/44-x.test.ts","packages/core/principles/44-x.test.ts"],changed_count:2}})' "$STATE_ARG"
# RED: admission context without a trusted inventory → fail closed
run_inv_case no-inventory-fails-closed REJECT 'E_NO_INVENTORY'    'makeAdmission()' 'undefined'
# RED: specification inventory gap / unknown id (policy-declared requirements)
run_inv_case spec-inventory-gap       REJECT 'E_INVENTORY'        'makeAdmission({specification_evidence:[]})' "$STATE_ARG"
run_inv_case spec-id-unknown          REJECT 'E_INVENTORY'        'makeAdmission({specification_evidence:[...(makeAdmission().specification_evidence ?? []), {requirement_id:"GHOST-REQ", commit_sha:"c".repeat(40), path:"a.md", blob_sha:"e".repeat(40), result:"PASS", evidence:[{repository_id:1231007068,commit_sha:"c".repeat(40),path:"a.md",blob_sha:"e".repeat(40),line_start:1,line_end:1,explanation:"x",trusted_run_or_report_id:null}]}]})' "$STATE_ARG"

# ── RED: current-tuple (publisher) layer ─────────────────────────────────────
run_case tuple-head-drift         REJECT 'E_TUPLE'       'makeAdmission()' "$P" '{base_sha:"b".repeat(40), head_sha:"NEW".padEnd(40,"0"), tested_merge_sha:"d".repeat(40), policy_sha256:"2".repeat(64), protocol_version:"dot-staging-review/1.0", repository_id:1231007068, pr_number:2042, pr_node_id:"PR_kwDOM9YQhs6AbCdEfGh"}'
run_case tuple-policy-drift       REJECT 'E_TUPLE'       'makeAdmission()' "$P" '{base_sha:"b".repeat(40), head_sha:"c".repeat(40), tested_merge_sha:"d".repeat(40), policy_sha256:"9".repeat(64), protocol_version:"dot-staging-review/1.0", repository_id:1231007068, pr_number:2042, pr_node_id:"PR_kwDOM9YQhs6AbCdEfGh"}'
run_case tuple-M-drift            REJECT 'E_TUPLE'       'makeAdmission()' "$P" '{base_sha:"b".repeat(40), head_sha:"c".repeat(40), tested_merge_sha:"8".repeat(40), policy_sha256:"2".repeat(64), protocol_version:"dot-staging-review/1.0", repository_id:1231007068, pr_number:2042, pr_node_id:"PR_kwDOM9YQhs6AbCdEfGh"}'
run_case tuple-revise-not-gate    REJECT 'E_NOT_AUTHORIZING' 'makeAdmission({verdict:"REVISE"})' "$P" '{base_sha:"b".repeat(40), head_sha:"c".repeat(40), tested_merge_sha:"d".repeat(40), policy_sha256:"2".repeat(64), protocol_version:"dot-staging-review/1.0", repository_id:1231007068, pr_number:2042, pr_node_id:"PR_kwDOM9YQhs6AbCdEfGh"}'
run_case kind-recast-historical   REJECT 'E_KIND_RECAST' 'makeHistorical()' "$P" '{base_sha:"b".repeat(40), head_sha:"c".repeat(40), tested_merge_sha:"d".repeat(40), policy_sha256:"2".repeat(64), protocol_version:"dot-staging-review/1.0", repository_id:1231007068, pr_number:2042, pr_node_id:"PR_kwDOM9YQhs6AbCdEfGh"}'

# dup-key raw-text arm (cannot be expressed through object builders)
dup_out=$(node --input-type=module -e "
import { validateReport } from '$MOD';
import { readFileSync } from 'node:fs';
const schemaBytes = readFileSync('$SCHEMA');
const raw = '{\"protocol_version\":\"dot-staging-review/1.0\",\"verdict\":\"GO\",\"verdict\":\"STOP\"}';
const r = validateReport(raw, { schemaBytes, now: '$NOW' });
console.log(r.ok ? 'PASS' : r.errors.map((e) => e.code).join(','));
" 2>&1 | tail -1)
if [[ "$dup_out" != *DUP_KEY* ]]; then echo "FAIL[dup-key-raw] got: $dup_out"; fails=$((fails+1)); else echo "ok[dup-key-raw]"; fi

# proto-key raw-text arm (review R7): a whole report nested under one __proto__ key
# used to pass validation with ZERO errors — the fields sat on Object.prototype where
# property access still saw them. The strict parser refuses the key outright.
proto_out=$(node --input-type=module -e "
import { validateReport } from '$MOD';
import { readFileSync } from 'node:fs';
const schemaBytes = readFileSync('$SCHEMA');
const raw = '{\"__proto__\":{\"protocol_version\":\"dot-staging-review/1.0\",\"kind\":\"admission\",\"completion\":\"COMPLETE\",\"verdict\":\"GO\"}}';
const r = validateReport(raw, { schemaBytes, now: '$NOW' });
console.log(r.ok ? 'PASS' : r.errors.map((e) => e.code).join(','));
" 2>&1 | tail -1)
if [[ "$proto_out" != *PROTO_KEY* ]]; then echo "FAIL[proto-key-raw] got: $proto_out"; fails=$((fails+1)); else echo "ok[proto-key-raw]"; fi

echo "----"
if [[ $fails -gt 0 ]]; then echo "FAILURES: $fails"; exit 1; fi
echo "validate-report.test.sh: all green"
