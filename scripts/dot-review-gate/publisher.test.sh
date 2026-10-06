#!/usr/bin/env bash
# Paired-negative for scripts/dot-review-gate/publisher.mjs.
#
# The publisher is the only writer of dot-review/v1. Its refusals ARE the gate:
#   - publication consumes an AUTHENTICATED LEDGER RECORD, never caller-supplied
#     bytes-plus-boolean: the stored payload is re-digested, re-validated against the
#     LIVE tuple and the TRUSTED inventory, and a red/spoofed mechanical state blocks
#     (review R1 — the old signature trusted a detached {ok:true});
#   - success only on the CURRENT tested merge revision M (reread immediately before
#     the write);
#   - a non-GO/COMPLETE valid report publishes conclusion "failure" (never neutral);
#   - publication is idempotent by external_id;
#   - App identity comes from the installation token flow.
# All GitHub traffic is a stub transport — real JWT signing, real refusals, no network.
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/dot-publisher-test.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

SCRIPT="$TMP/run-publisher-arms.mjs"
cat > "$SCRIPT" <<'NODE'
import { generateKeyPairSync } from 'node:crypto';
const [publisherPath, ledgerPath, fixPath, validatorPath, schemaPath, tmp] = process.argv.slice(2);
const { makeAdmission, makePolicyFixture, policyDigestOf } = await import(fixPath);
const { openLedger, tupleDigest } = await import(ledgerPath);
const { createPublisherJwt, installationAccessToken, publishAdmission, publishFailure } = await import(publisherPath);
const { validateReport } = await import(validatorPath);
const { readFileSync } = await import('node:fs');
const schemaBytes = readFileSync(schemaPath);
const sha = (c) => String(c).repeat(40);

const policy = makePolicyFixture();
const M = sha('d');
const H = sha('c');
const CHANGED = ['packages/core/principles/44-x.test.ts'];
const HEAD_NAMES = ['fidelity-verdict-in-pr-body', 'stale-revert-in-pr-diff',
  'Template render probes — P1/P4/P6 (deterministic)',
  'capability PR carries Prior-art line in PR body (squash-survival)',
  '§1.7 forward+backward sections present in PR description'];
const TUPLE = {
  repository_id: 1231007068, pr_node_id: 'PR_kwDOM9YQhs6AbCdEfGh', base_ref: 'staging',
  base_sha: sha('b'), head_sha: H, merge_base_sha: sha('a'), tested_merge_sha: M,
  policy_sha256: policyDigestOf(makePolicyFixture()), protocol_version: 'dot-staging-review/1.0',
};
const NOW = '2026-10-05T12:00:00Z';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const keyPem = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
const app = { appId: 12345, installationId: 42, privateKeyPem: keyPem, apiBase: '', repo: 'artyhoo/getff', prNumber: 2042 };

// stub transport: installation tokens, check-run writes, live PR/merge-ref reads
function makeTransport({ currentMerge = M, headChecks = [], mergeChecks = [], existingExternalIds = [] } = {}) {
  const calls = { tokenRequests: 0, checkRuns: [] };
  return {
    calls,
    async fetchJson(url, opts = {}) {
      if (url === '/app/installations/42/access_tokens') {
        calls.tokenRequests++;
        return { token: 'it-1', expires_at: '2026-10-05T13:00:00Z' };
      }
      if (url === '/repos/artyhoo/getff/check-runs' && opts.method === 'POST') {
        const body = JSON.parse(opts.body);
        calls.checkRuns.push(body);
        return { id: 555 + calls.checkRuns.length, ...body, app: { id: policy.dot_check.expected_app_id } };
      }
      if (url.startsWith(`/repos/artyhoo/getff/commits/`) && url.includes('/check-runs')) {
        // Bearer-authenticated call = the createCheck crash-recovery search; the
        // unauthenticated call = the readiness sweep over M/head evidence, served
        // per SHA (merge-bound evidence lives on M, head-bound on H).
        if (opts.headers?.authorization) {
          const found = existingExternalIds.length > 0 && calls.checkRuns.length === 0
            ? [{ id: 777, external_id: existingExternalIds[0], app: { id: policy.dot_check.expected_app_id } }]
            : [];
          return { total_count: found.length, check_runs: found };
        }
        if (url.startsWith(`/repos/artyhoo/getff/commits/${M}/`)) {
          return { total_count: mergeChecks.length, check_runs: mergeChecks };
        }
        if (url.startsWith(`/repos/artyhoo/getff/commits/${H}/`)) {
          return { total_count: headChecks.length, check_runs: headChecks };
        }
        return { total_count: 0, check_runs: [] };
      }
      if (url === `/repos/artyhoo/getff/commits/${H}/check-runs?per_page=100`) {
        return { total_count: headChecks.length, check_runs: headChecks };
      }
      if (url === '/repos/artyhoo/getff/git/ref/pull/2042/merge') {
        if (currentMerge === null) throw Object.assign(new Error('no merge ref'), { status: 404 });
        return { object: { sha: currentMerge } };
      }
      if (url === '/repos/artyhoo/getff/pulls/2042') {
        return {
          state: 'open', draft: false, mergeable_state: 'clean',
          node_id: 'PR_kwDOM9YQhs6AbCdEfGh',
          head: { sha: H }, base: { ref: 'staging', sha: sha('b') },
        };
      }
      throw new Error(`unexpected transport call ${url}`);
    },
  };
}
// R9: the run-identity resolver is the only Actions-aware component; the stub serves
// the trusted fixture identities.
const WORKFLOW_OF = {
  'ci-success': '.github/workflows/audit-self.yml',
  'stale-revert-in-pr-diff': '.github/workflows/audit-self.yml',
  'Template render probes — P1/P4/P6 (deterministic)': '.github/workflows/audit-self.yml',
  'capability PR carries Prior-art line in PR body (squash-survival)': '.github/workflows/audit-self.yml',
  'fidelity-verdict-in-pr-body': '.github/workflows/discipline-self-check.yml',
  '§1.7 forward+backward sections present in PR description': '.github/workflows/discipline-self-check.yml',
};
const resolver = async (check) => ({
  workflow_path: WORKFLOW_OF[check.name] ?? '.github/workflows/untrusted.yml',
  run_id: 101,
  run_attempt: 1,
  run_started_at: '2026-10-05T11:00:00Z',
  workflow_sha: sha('f'),
});
// check-run API shape (name/app/head_sha/conclusion) — what the transport actually serves
const mechanical = (over = {}) => ({
  name: 'ci-success', app: { id: 15368 }, head_sha: M, conclusion: 'success', ...over,
});
const headCheck = (name, over = {}) => ({
  name, app: { id: 15368 }, head_sha: H, conclusion: 'success', ...over,
});

// store a report the way the intake would (authenticated envelope, canonical bytes)
async function storeReport(ledger, { reportOverrides = {}, changedFiles } = {}) {
  const claim = ledger.claimGeneration({
    tuple: TUPLE, reviewerId: 555001, maxAttemptsPerTuple: 5, leaseMinutes: 120,
    changedFiles, nowMs: Date.parse(NOW),
  });
  const report = makeAdmission({ claim_id: claim.claim.claim_id, generation: claim.generation.seq, ...reportOverrides });
  const payload = JSON.stringify(report);
  const receipt = ledger.submitReport({
    claimId: claim.claim.claim_id, reviewerId: 555001,
    digest: (await import('node:crypto')).createHash('sha256').update(payload).digest('hex'),
    payload, verdict: report.verdict, kind: report.kind,
    leaseMinutes: 120, nowMs: Date.parse(NOW),
    expectedTupleDigest: tupleDigest(TUPLE), assertedGenerationSeq: claim.generation.seq,
  });
  return { receipt, report, payload };
}

const log = (...a) => console.log(...a);
const fail = (m) => { console.log('FAIL ' + m); process.exitCode = 1; };
const codes = (e) => JSON.stringify(e.errors ?? []).includes;

try {
  // GREEN: JWT shape (RS256, short-lived)
  const jwt = createPublisherJwt(12345, keyPem);
  const header = JSON.parse(Buffer.from(jwt.split('.')[0], 'base64url').toString());
  const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());
  if (header.alg !== 'RS256' || payload.iss !== 12345 || payload.exp - payload.iat > 600) {
    fail(`jwt shape alg=${header.alg} iss=${payload.iss} ttl=${payload.exp - payload.iat}`);
  } else log('ok jwt-shape');

  // GREEN: ledger-backed valid GO on current M publishes success on M
  const ledger = openLedger(`${tmp}/pub-ledger.sqlite`);
  const t1 = makeTransport({
    mergeChecks: [mechanical()],
    headChecks: HEAD_NAMES.map((n) => headCheck(n)),
  });
  const tok = await installationAccessToken(app, t1.fetchJson);
  if (tok !== 'it-1') fail('installation token flow broken');
  const good = await storeReport(ledger, { changedFiles: CHANGED });
  const pub = await publishAdmission({
    ledger, reportId: good.receipt.report_id, schemaBytes, policy, app,
    transport: t1.fetchJson, resolveRunIdentity: resolver, now: NOW,
  });
  if (!pub.check || pub.check.head_sha !== M) fail(`publish target ${pub.check?.head_sha}, want M`);
  else log('ok publish-on-current-M');

  // RED (R1): the stored record says the review FAILED with no CI evidence — even a
  // freshly computed validation object for tampered bytes must not authorize, because
  // publication re-validates the STORED bytes, not a caller's claim about them.
  const crashed = await storeReport(ledger, {
    changedFiles: CHANGED,
    reportOverrides: { execution: { failure: true, failure_reason: 'review crashed' }, mechanical_evidence: [], verdict: 'GO', completion: 'COMPLETE' },
  });
  const t2 = makeTransport({ mergeChecks: [mechanical()] });
  await publishAdmission({
    ledger, reportId: crashed.receipt.report_id, schemaBytes, policy, app,
    transport: t2.fetchJson, resolveRunIdentity: resolver, now: NOW,
  }).then(() => fail('crashed-review record published success'))
    .catch((e) => { if (e.code === 'E_VALIDATION' && t2.calls.checkRuns.length === 0) log('ok crashed-review-refused'); else fail(`crashed record ${e.code} checks=${t2.calls.checkRuns.length}`); });

  // RED (R1): unknown report id → nothing published
  const t3 = makeTransport({ mergeChecks: [mechanical()] });
  await publishAdmission({
    ledger, reportId: 'no-such-report', schemaBytes, policy, app,
    transport: t3.fetchJson, resolveRunIdentity: resolver, now: NOW,
  }).then(() => fail('unknown record published'))
    .catch((e) => { if (e.code === 'E_NO_RECORD' && t3.calls.checkRuns.length === 0) log('ok no-record-refused'); else fail(`unknown record ${e.code}`); });

  // RED: live M moved away from the report's tuple → refusal before any write
  const t4 = makeTransport({ currentMerge: sha('9'), mergeChecks: [mechanical({ sha: sha('9') })] });
  await publishAdmission({
    ledger, reportId: good.receipt.report_id, schemaBytes, policy, app,
    transport: t4.fetchJson, resolveRunIdentity: resolver, now: NOW,
  }).then(() => fail('stale M published'))
    .catch((e) => { if (e.code === 'E_VALIDATION' && t4.calls.checkRuns.length === 0) log('ok stale-M-refused'); else fail(`stale M ${e.code}`); });

  // RED (R1): mechanical state RED at publish time → refused (the report's own
  // embedded mechanical evidence does not substitute the live recheck)
  const t5 = makeTransport({ mergeChecks: [mechanical({ conclusion: 'failure' })] });
  await publishAdmission({
    ledger, reportId: good.receipt.report_id, schemaBytes, policy, app,
    transport: t5.fetchJson, resolveRunIdentity: resolver, now: NOW,
  }).then(() => fail('published over red mechanics'))
    .catch((e) => { if (e.code === 'E_NOT_READY' && t5.calls.checkRuns.length === 0) log('ok red-mechanics-refused'); else fail(`red mechanics ${e.code}`); });

  // RED (R1/R9): the passing check ran from an UNTRUSTED workflow → refused
  const t6 = makeTransport({ mergeChecks: [mechanical()] });
  const rogueResolver = async (check) => ({ ...(await resolver(check)), workflow_path: '.github/workflows/untrusted.yml' });
  await publishAdmission({
    ledger, reportId: good.receipt.report_id, schemaBytes, policy, app,
    transport: t6.fetchJson, resolveRunIdentity: rogueResolver, now: NOW,
  }).then(() => fail('spoofed workflow published'))
    .catch((e) => { if (e.code === 'E_NOT_READY' && t6.calls.checkRuns.length === 0) log('ok spoofed-workflow-refused'); else fail(`spoofed workflow ${e.code}`); });

  // RED (R1): the generation carries NO trusted inventory → fail closed. A fresh
  // ledger keeps the generation clean (same-tuple reuse would inherit an inventory).
  const noInvLedger = openLedger(`${tmp}/pub-ledger-3.sqlite`);
  const noInv = await storeReport(noInvLedger, {});
  const t7 = makeTransport({ mergeChecks: [mechanical()], headChecks: HEAD_NAMES.map((n) => headCheck(n)) });
  await publishAdmission({
    ledger: noInvLedger, reportId: noInv.receipt.report_id, schemaBytes, policy, app,
    transport: t7.fetchJson, resolveRunIdentity: resolver, now: NOW,
  }).then(() => fail('published without inventory'))
    .catch((e) => { if (e.code === 'E_VALIDATION' && t7.calls.checkRuns.length === 0) log('ok no-inventory-refused'); else fail(`no inventory ${e.code}`); });

  // GREEN/RED: valid non-authorizing (REVISE) report → failure check on M, never neutral
  const reviseLedger = openLedger(`${tmp}/pub-ledger-2.sqlite`);
  const revise = await storeReport(reviseLedger, { changedFiles: CHANGED, reportOverrides: { verdict: 'REVISE', completion: 'INCOMPLETE', execution: { failure: true, failure_reason: 'lease expired mid-review' } } });
  const t8 = makeTransport({ mergeChecks: [mechanical()], headChecks: HEAD_NAMES.map((n) => headCheck(n)) });
  const fpub = await publishFailure({
    ledger: reviseLedger, reportId: revise.receipt.report_id, schemaBytes, policy, app,
    transport: t8.fetchJson, resolveRunIdentity: resolver, now: NOW, reason: 'REVISE verdict',
  });
  if (fpub.check.conclusion !== 'failure' || fpub.check.head_sha !== M) fail(`failure publish ${fpub.check.conclusion}@${fpub.check.head_sha}`);
  else log('ok revise-publishes-failure');

  // GREEN: crash recovery — external_id already on GitHub → no second check
  const externalId = 'dot-review:gen-1:rev-1';
  const t9 = makeTransport({ mergeChecks: [mechanical()], headChecks: HEAD_NAMES.map((n) => headCheck(n)), existingExternalIds: [externalId] });
  const r9 = await publishAdmission({
    ledger, reportId: good.receipt.report_id, schemaBytes, policy, app,
    transport: t9.fetchJson, resolveRunIdentity: resolver, now: NOW, externalId,
  });
  if (r9.check.id !== 777 || t9.calls.checkRuns.length !== 0) fail(`recovery created a second check: ${JSON.stringify(r9).slice(0, 100)}`);
  else log('ok crash-recovery-idempotent');
} catch (e) {
  fail(`unexpected: ${e.stack?.split('\n').slice(0, 2).join(' | ')}`);
}
NODE

# shellcheck disable=SC1091
source "$DIR/suite-harness.sh"
out="$(node "$SCRIPT" \
  "$DIR/publisher.mjs" \
  "$DIR/ledger.mjs" \
  "$(cd "$DIR/../.." && pwd)/tests/dot-review-gate/fixtures/make-admission.mjs" \
  "$DIR/validate-report.mjs" \
  "$(cd "$DIR/../.." && pwd)/docs/meta-factory/dot-review-result.schema.json" \
  "$TMP" 2>&1)"; status=$?
assert_suite_arms "publisher.test.sh" "$status" "$out" \
  jwt-shape publish-on-current-M crashed-review-refused no-record-refused stale-M-refused \
  red-mechanics-refused spoofed-workflow-refused no-inventory-refused \
  revise-publishes-failure crash-recovery-idempotent || exit 1
echo "publisher.test.sh: all green"
