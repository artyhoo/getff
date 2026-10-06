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
const codes = r.errors.concat(r.nonAuthorizing ?? []).map((e) => e.code).join(',');
const auth = r.authorizing ? 'AUTH' : 'NONAUTH';
console.log(ok + '|' + codes + '|' + auth);
" 2>&1 | tail -1)
  if [[ "$want_ok" == PASS && "$out" != PASS* ]]; then
    echo "FAIL[$name] expected accept, got: $out"; fails=$((fails+1)); return
  fi
  if [[ "$want_ok" == PASS && -n "$want_code" && "$out" != *"$want_code"* ]]; then
    echo "FAIL[$name] expected to carry $want_code, got: $out"; fails=$((fails+1)); return
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
run_case admission-valid          PASS 'AUTH' 'makeAdmission()' "$P"
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
const codes = r.errors.concat(r.nonAuthorizing ?? []).map((e) => e.code).join(',');
const auth = r.authorizing ? 'AUTH' : 'NONAUTH';
console.log(ok + '|' + codes + '|' + auth);
" 2>&1 | tail -1)
  if [[ "$want_ok" == PASS && "$out" != PASS* ]]; then
    echo "FAIL[$name] expected accept, got: $out"; fails=$((fails+1)); return
  fi
  if [[ "$want_ok" == PASS && -n "$want_code" && "$out" != *"$want_code"* ]]; then
    echo "FAIL[$name] expected to carry $want_code, got: $out"; fails=$((fails+1)); return
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
# Acceptance ≠ admission: a valid REVISE on the CURRENT tuple is an acceptable
# document (persisted by the intake) that carries the named E_NOT_AUTHORIZING marker
# and can never authorize. The historical-GO recast marker stays named the same way.
run_inv_case tuple-revise-not-gate PASS 'E_NOT_AUTHORIZING' 'makeAdmission({verdict:"REVISE"})' "$STATE_ARG"
run_case kind-recast-historical   PASS 'E_KIND_RECAST' 'makeHistorical()' "$P"

# ── V2 (DotPRReviewV2/2.0.0 — follow-up packet increment 3) ──────────────────
# The V2 bytes are PINNED copies of the docs lane's CONTRACT_READY receipt
# (tests/dot-review-gate/fixtures/v2/), never re-designed field spelling. The 13
# published records + expectations run through THIS validator — an independent
# re-execution of the packet's table, not a restatement of it.
V2FIX="$(cd "$DIR/../.." && pwd)/tests/dot-review-gate/fixtures/v2/make-v2.mjs"

run_v2_arm() { # NAME EXPECT VALID/INVALID JS-EXPR [nostate]
  local name="$1" want_valid="$2" expr="$3" mode="${4:-state}"
  local out
  out=$(node --input-type=module -e "
import { makeV2Review, v2StateFrom, loadExample, V2_SCHEMA_BYTES } from '$V2FIX';
import { validateReport } from '$MOD';
// trusted inputs are computed from the CANONICAL example, never from the mutated expr
const canonical = makeV2Review();
const trusted = { changed_files: canonical.scope.changed_paths.map((c) => c.path) };
const live = $([[ "$mode" == nostate ]] && echo false || echo true);
const r = validateReport($expr, { schemaBytesV2: V2_SCHEMA_BYTES, now: '$NOW', ...(live ? { currentState: v2StateFrom(canonical), trustedInventory: trusted } : {}) });
const codes = r.errors.concat(r.nonAuthorizing ?? []).map((e) => e.code).join(',');
console.log((r.ok ? 'PASS' : 'FAIL') + '|' + codes + '|' + (r.authorizing ? 'AUTH' : 'NONAUTH'));
" 2>&1 | tail -1)
  if [[ "$want_valid" == valid && "$out" != PASS* ]]; then
    echo "FAIL[$name] expected valid, got: $out"; fails=$((fails+1)); return
  fi
  if [[ "$want_valid" == invalid && "$out" != FAIL* ]]; then
    echo "FAIL[$name] expected invalid, got: $out"; fails=$((fails+1)); return
  fi
  echo "ok[$name]"
}

# pin integrity: the fixture copy IS the receipt bytes; if the canonical file is
# present in-tree (after the docs PR merges) both copies must be byte-identical
pin_out=$(node --input-type=module -e "
import { V2_SCHEMA_SHA256, RECEIPT_SCHEMA_SHA256 } from '$V2FIX';
import { readFileSync, existsSync } from 'node:fs';
if (V2_SCHEMA_SHA256 !== RECEIPT_SCHEMA_SHA256) { console.log('MISMATCH pin vs receipt'); process.exit(0); }
const canon = '$(cd "$DIR/../.." && pwd)/docs/meta-factory/dot-review-result-v2.schema.json';
if (existsSync(canon)) {
  const h = (await import('node:crypto')).createHash('sha256').update(readFileSync(canon)).digest('hex');
  if (h !== RECEIPT_SCHEMA_SHA256) { console.log('MISMATCH canonical vs receipt'); process.exit(0); }
}
console.log('PIN-OK');
" 2>&1 | tail -1)
if [[ "$pin_out" != "PIN-OK" ]]; then echo "FAIL[v2-schema-pin-integrity] got: $pin_out"; fails=$((fails+1)); else echo "ok[v2-schema-pin-integrity]"; fi

# all 13 published records vs their own expectation table
exp_out=$(node --input-type=module -e "
import { v2Expectations, loadExample, V2_SCHEMA_BYTES } from '$V2FIX';
import { validateReport } from '$MOD';
const exp = v2Expectations();
const bad = [];
for (const [file, want] of Object.entries(exp)) {
  const r = validateReport(loadExample(file), { schemaBytesV2: V2_SCHEMA_BYTES, now: '$NOW' });
  const got = r.ok ? 'valid' : 'invalid';
  if (got !== want) bad.push(file + ':' + got + '(' + r.errors.map((e) => e.code).join(',') + ')');
}
console.log(bad.length === 0 ? 'ALL-13-MATCH' : 'DRIFT ' + bad.join(' '));
" 2>&1 | tail -1)
if [[ "$exp_out" != "ALL-13-MATCH" ]]; then echo "FAIL[v2-expectations-13] got: $exp_out"; fails=$((fails+1)); else echo "ok[v2-expectations-13]"; fi

# the schema cannot see a MISSING dimension id: COMPLETE coverage with one of the
# seven role dimensions absent must be invalid (the published invalid-missing-dimension
# record pins exactly this), and an UNVERIFIED dimension cannot sit under COMPLETE
run_v2_arm v2-missing-dimension-invalid invalid "JSON.stringify(loadExample('invalid-missing-dimension.json'))"
run_v2_arm v2-unverified-forces-partial invalid "JSON.stringify(makeV2Review({ assessments: { system_coverage: 'COMPLETE' }, dimensions: makeV2Review().dimensions.map((d) => d.dimension === 'CONTEXT_ECONOMY' ? { ...d, status: 'UNVERIFIED' } : d) }))"
run_v2_arm v2-unverified-partial-is-valid valid "JSON.stringify(makeV2Review({ assessments: { system_coverage: 'PARTIAL' }, verdict: { outcome: 'REVISE', rationale: 'one dimension unverified', blockers: [] }, dimensions: makeV2Review().dimensions.map((d) => d.dimension === 'CONTEXT_ECONOMY' ? { ...d, status: 'UNVERIFIED' } : d) }))"

# the authorizing predicate: GO ∧ COMPLETE ∧ SUFFICIENT ∧ no blocking findings —
# INSUFFICIENT/UNKNOWN prior review and blocking findings never authorize
# (the material-delta/historical records pin a DIFFERENT revision — validated as
# documents, without a live context, exactly like the V1 non-authorizing arms)
run_v2_arm v2-positive-go-authorizing valid "JSON.stringify(makeV2Review())"
run_v2_arm v2-insufficient-prior-not-authorizing valid "JSON.stringify(loadExample('material-delta.json'))" nostate
run_v2_arm v2-historical-not-authorizing valid "JSON.stringify(loadExample('historical.json'))" nostate
run_v2_arm v2-blocking-not-authorizing valid "JSON.stringify(makeV2Review({ findings: [...JSON.parse(loadExample('historical.json')).findings.map((f) => ({ ...f, finding_id: 'F-x', occurrence_id: 'O-x' }))] }))"

# a HISTORICAL-mode record that would otherwise qualify (GO ∧ COMPLETE ∧ SUFFICIENT ∧
# no blocking) is NOT authorizing: a merged source never becomes merge-eligible
v2hist_out=$(node --input-type=module -e "
import { makeV2Review, V2_SCHEMA_BYTES } from '$V2FIX';
import { validateReport } from '$MOD';
const base = makeV2Review();
const r = validateReport(JSON.stringify(makeV2Review({
  review_identity: { ...base.review_identity, mode: 'HISTORICAL', comparison_basis: 'HISTORICAL_PINNED', revisions: { ...base.review_identity.revisions, current_staging_sha: 'a'.repeat(40) } },
})), { schemaBytesV2: V2_SCHEMA_BYTES, now: '$NOW' });
const codes = r.errors.concat(r.nonAuthorizing ?? []).map((e) => e.code + ':' + (e.message ?? '')).join('|');
console.log((r.ok ? 'PASS' : 'FAIL') + '|' + (r.authorizing ? 'AUTH' : 'NONAUTH') + '|' + codes);
" 2>&1 | tail -1)
if [[ "$v2hist_out" != "PASS|NONAUTH"*HISTORICAL* ]]; then
  echo "FAIL[v2-historical-qualifying-not-authorizing] got: $v2hist_out"; fails=$((fails+1))
else echo "ok[v2-historical-qualifying-not-authorizing]"; fi

# trusted comparisons: live-tuple drift and inventory both directions (V2 identity
# fields under review_identity — the report is never its own witness)
run_v2_arm v2-tuple-drift invalid "JSON.stringify(makeV2Review({ review_identity: { ...makeV2Review().review_identity, revisions: { ...makeV2Review().review_identity.revisions, head_sha: 'f'.repeat(40) } } }))"
run_v2_arm v2-inventory-missing invalid "JSON.stringify(makeV2Review({ scope: { changed_paths: makeV2Review().scope.changed_paths.slice(1), omissions: [] } }))"
run_v2_arm v2-inventory-unknown invalid "JSON.stringify(makeV2Review({ scope: { changed_paths: [...makeV2Review().scope.changed_paths, { path: 'ghost/invented.ts', treatment: 'SYSTEM_ANALYZED', rationale: 'invented' }], omissions: [] } }))"
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

# ── DR-R4: fail closed on missing schema bytes ────────────────────────────────
# a V2 document with NO pinned V2 bytes is refused — the old validator skipped AJV
# when schemaBytesV2 was absent and accepted schema-less documents as valid
v2noschema_out=$(node --input-type=module -e "
import { makeV2Review } from '$V2FIX';
import { validateReport } from '$MOD';
const r = validateReport(JSON.stringify(makeV2Review()), { now: '$NOW' });
console.log((r.ok ? 'PASS' : 'FAIL') + '|' + r.errors.map((e) => e.code).join(','));
" 2>&1 | tail -1)
if [[ "$v2noschema_out" != "FAIL|E_SCHEMA"* ]]; then echo "FAIL[v2-missing-schema-bytes-refused] got: $v2noschema_out"; fails=$((fails+1)); else echo "ok[v2-missing-schema-bytes-refused]"; fi

# the CLI fails closed on a V2 document without --schema-v2, and accepts it with it
V2SCHEMA="$(cd "$DIR/../.." && pwd)/docs/meta-factory/dot-review-result-v2.schema.json"
V2EXAMPLE="$(cd "$DIR/../.." && pwd)/tests/dot-review-gate/fixtures/v2/examples/positive-go.json"
cli_no=$(node "$MOD" "$V2EXAMPLE" --schema "$SCHEMA" --now "$NOW" 2>&1); cli_no_status=$?
if [[ $cli_no_status -eq 0 || "$cli_no" != *E_SCHEMA* ]]; then
  echo "FAIL[v2-cli-without-schema-refused] exit=$cli_no_status out=$(echo "$cli_no" | tail -1)"; fails=$((fails+1))
else echo "ok[v2-cli-without-schema-refused]"; fi
cli_yes=$(node "$MOD" "$V2EXAMPLE" --schema "$SCHEMA" --schema-v2 "$V2SCHEMA" --now "$NOW" 2>&1); cli_yes_status=$?
if [[ $cli_yes_status -ne 0 || "$cli_yes" != *'"ok":true'* ]]; then
  echo "FAIL[v2-cli-with-schema-accepts] exit=$cli_yes_status out=$(echo "$cli_yes" | tail -1)"; fails=$((fails+1))
else echo "ok[v2-cli-with-schema-accepts]"; fi

echo "----"
if [[ $fails -gt 0 ]]; then echo "FAILURES: $fails"; exit 1; fi
echo "validate-report.test.sh: all green"
