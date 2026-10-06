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
import { generateKeyPairSync, createHash } from 'node:crypto';
const [publisherPath, ledgerPath, fixPath, validatorPath, schemaPath, v2fixPath, tmp] = process.argv.slice(2);
const { makeAdmission, makePolicyFixture, policyDigestOf } = await import(fixPath);
const { makeV2Review, V2_SCHEMA_BYTES, V2_SCHEMA_SHA256 } = await import(v2fixPath);
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
function makeTransport({ currentMerge = M, headChecks = [], mergeChecks = [], existingExternalIds = [], readBackOverride } = {}) {
  const calls = { tokenRequests: 0, checkRuns: [], readBacks: 0 };
  return {
    calls,
    async fetchJson(url, opts = {}) {
      if (url === '/app/installations/42/access_tokens') {
        calls.tokenRequests++;
        return { token: 'it-1', expires_at: '2026-10-05T13:00:00Z' };
      }
      if (/^\/repos\/artyhoo\/getff\/check-runs\/\d+$/.test(url)) {
        calls.readBacks++;
        const id = Number(url.split('/').pop());
        if (readBackOverride) return { ...readBackOverride, id };
        const rec = calls.checkRuns.find((c) => c.id === id);
        if (!rec) throw Object.assign(new Error('check-run vanished before read-back'), { status: 404 });
        return rec;
      }
      if (url === '/repos/artyhoo/getff/check-runs' && opts.method === 'POST') {
        const body = JSON.parse(opts.body);
        const rec = { id: 555 + calls.checkRuns.length + 1, ...body, app: { id: policy.dot_check.expected_app_id } };
        calls.checkRuns.push(rec);
        return rec;
      }
      if (url.startsWith(`/repos/artyhoo/getff/commits/`) && url.includes('/check-runs')) {
        // Bearer-authenticated call = the createCheck crash-recovery search; the
        // unauthenticated call = the readiness sweep over M/head evidence, served
        // per SHA (merge-bound evidence lives on M, head-bound on H).
        if (opts.headers?.authorization) {
          const found = existingExternalIds.length > 0 && calls.checkRuns.length === 0
            ? [{ id: 777, external_id: existingExternalIds[0], app: { id: policy.dot_check.expected_app_id }, conclusion: 'success' }]
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
    liveTupleDigest: tupleDigest(TUPLE), assertedGenerationSeq: claim.generation.seq,
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

  // SP-4: a later GO does not erase the journal's open blocking findings — success
  // is not published over an unresolved lineage (RED: today the green dot publishes
  // and the earlier defect vanishes from the eligibility surface).
  const sp4Ledger = openLedger(`${tmp}/pub-ledger-sp4.sqlite`);
  const sp4First = await storeReport(sp4Ledger, { changedFiles: CHANGED });
  sp4Ledger.recordFindings(sp4First.receipt.report_id, [
    { key: 'artyhoo/getff#F-PUB', requirement: 'the gate refuses unstaged paths', category: 'correctness', severity: 'critical', blocking: true },
  ]);
  const sp4Go = await storeReport(sp4Ledger, { changedFiles: CHANGED });
  const tSP4 = makeTransport({ mergeChecks: [mechanical()], headChecks: HEAD_NAMES.map((n) => headCheck(n)) });
  await publishAdmission({
    ledger: sp4Ledger, reportId: sp4Go.receipt.report_id, schemaBytes, policy, app,
    transport: tSP4.fetchJson, resolveRunIdentity: resolver, now: NOW,
  }).then(() => fail('later GO published over an open blocking finding'))
    .catch((e) => {
      if (e.code === 'E_OPEN_BLOCKING' && /F-PUB/.test(e.message) && tSP4.calls.checkRuns.length === 0) log('ok open-blocking-lineage-holds-publication');
      else fail(`open blocking lineage ${e.code} ${e.message.slice(0, 120)}`);
    });

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

  // ── DR-R4: publication fails closed without the pinned V2 bytes ──────────────
  const V2_POLICY = makePolicyFixture({ protocol_version: 'dot-pr-review/2.0.0', schema_v2_sha256: V2_SCHEMA_SHA256 });
  const v2Digest = policyDigestOf(V2_POLICY);
  const canonicalV2 = makeV2Review();
  const v2Tuple = { ...TUPLE, policy_sha256: v2Digest, protocol_version: 'dot-pr-review/2.0.0' };
  const v2Ledger = openLedger(`${tmp}/pub-v2.sqlite`);
  const v2Report = makeV2Review({
    review_identity: {
      ...canonicalV2.review_identity,
      repository: { id: 1231007068, full_name: 'artyhoo/getff' },
      pull_request: { number: 2042, node_id: 'PR_kwDOM9YQhs6AbCdEfGh' },
      mode: 'OPEN_PR',
      comparison_basis: 'HEAD_TO_MERGE_CANDIDATE',
      revisions: { head_sha: H, base_sha: sha('b'), merge_base_sha: sha('a'), tested_merge_sha: M },
      policy: { version: '2026-10-05.1', sha256: v2Digest, epoch: 1 },
    },
  });
  // the trusted inventory matches the record's own scope; the assignment id pins at claim
  const v2Claim = v2Ledger.claimGeneration({ tuple: v2Tuple, reviewerId: 555001, maxAttemptsPerTuple: 5, leaseMinutes: 120, changedFiles: v2Report.scope.changed_paths.map((c) => c.path), nowMs: Date.parse(NOW) });
  v2Report.review_identity.assignment_id = v2Claim.claim.claim_id;
  const v2Payload = JSON.stringify(v2Report);
  const v2Rec = v2Ledger.submitReport({
    claimId: v2Claim.claim.claim_id, reviewerId: 555001,
    digest: (await import('node:crypto')).createHash('sha256').update(v2Payload).digest('hex'),
    payload: v2Payload, verdict: JSON.stringify(v2Report.verdict), kind: v2Report.record_type,
    leaseMinutes: 120, nowMs: Date.parse(NOW),
    liveTupleDigest: tupleDigest(v2Tuple), assertedGenerationSeq: v2Claim.generation.seq,
  });
  const readyV2 = { mergeChecks: [mechanical()], headChecks: HEAD_NAMES.map((n) => headCheck(n)) };
  // RED: no V2 bytes → the publisher must refuse, never validate schema-less
  const tv2No = makeTransport({ ...readyV2 });
  try {
    await publishAdmission({ ledger: v2Ledger, reportId: v2Rec.report_id, schemaBytes, policy: V2_POLICY, app, transport: tv2No.fetchJson, resolveRunIdentity: resolver, now: NOW });
    fail('schema-less V2 publication accepted');
  } catch (e) {
    if (e.code === 'E_VALIDATION' && tv2No.calls.checkRuns.length === 0) log('ok v2-schema-less-publication-refused');
    else fail(`v2 schema-less ${e.code ?? e.message} runs=${tv2No.calls.checkRuns.length}`);
  }
  // GREEN control: the same record with the PIN publishes exactly one success on M
  const tv2Yes = makeTransport({ ...readyV2 });
  const pubV2 = await publishAdmission({ ledger: v2Ledger, reportId: v2Rec.report_id, schemaBytes, schemaBytesV2: V2_SCHEMA_BYTES, policy: V2_POLICY, app, transport: tv2Yes.fetchJson, resolveRunIdentity: resolver, now: NOW });
  if (!pubV2.check || pubV2.check.head_sha !== M || pubV2.check.conclusion !== 'success') fail(`v2 publish ${JSON.stringify(pubV2.check ?? pubV2).slice(0, 120)}`);
  else log('ok v2-publisher-publishes-with-pin');
  // SP-3: publication refuses V2 bytes that do NOT digest to the policy's pin —
  // permissive {"type":"object"} bytes would validate any document and publish it.
  const tv2Wrong = makeTransport({ ...readyV2 });
  try {
    await publishAdmission({ ledger: v2Ledger, reportId: v2Rec.report_id, schemaBytes, schemaBytesV2: Buffer.from(JSON.stringify({ type: 'object' })), policy: V2_POLICY, app, transport: tv2Wrong.fetchJson, resolveRunIdentity: resolver, now: NOW });
    fail('publication accepted unpinned (permissive) V2 bytes');
  } catch (e) {
    if (e.code === 'E_VALIDATION' && tv2Wrong.calls.checkRuns.length === 0) log('ok v2-publication-wrong-bytes-refused');
    else fail(`v2 wrong-bytes publication ${e.code ?? e.message} runs=${tv2Wrong.calls.checkRuns.length}`);
  }

  // ── DR-R5: publication identity binds the authenticated record AND the intent ──
  const extOf = (pub) => pub.check?.external_id;
  // a second V2 record on the SAME M flips the verdict to REVISE — its failure
  // publication must create its OWN check, never preserve the obsolete success
  const v2RevClaim = v2Ledger.claimGeneration({ tuple: v2Tuple, reviewerId: 555001, maxAttemptsPerTuple: 5, leaseMinutes: 120, changedFiles: v2Report.scope.changed_paths.map((c) => c.path), nowMs: Date.parse(NOW) });
  const v2RevReport = makeV2Review({
    review_identity: { ...v2Report.review_identity, assignment_id: v2RevClaim.claim.claim_id },
    verdict: { outcome: 'REVISE', rationale: 'correction demanded', blockers: [] },
    assessments: { ...canonicalV2.assessments, system_coverage: 'PARTIAL' },
  });
  const v2RevPayload = JSON.stringify(v2RevReport);
  const v2RevRec = v2Ledger.submitReport({
    claimId: v2RevClaim.claim.claim_id, reviewerId: 555001,
    digest: createHash('sha256').update(v2RevPayload).digest('hex'),
    payload: v2RevPayload, verdict: JSON.stringify(v2RevReport.verdict), kind: v2RevReport.record_type,
    leaseMinutes: 120, nowMs: Date.parse(NOW),
    liveTupleDigest: tupleDigest(v2Tuple), assertedGenerationSeq: v2RevClaim.generation.seq,
  });
  const tvRev = makeTransport({ ...readyV2 });
  const pubRev = await publishFailure({ ledger: v2Ledger, reportId: v2RevRec.report_id, schemaBytes, schemaBytesV2: V2_SCHEMA_BYTES, policy: V2_POLICY, app, transport: tvRev.fetchJson, resolveRunIdentity: resolver, now: NOW, reason: 'review verdict is not GO/COMPLETE' });
  if (pubRev.check?.conclusion !== 'failure' || tvRev.calls.checkRuns.length !== 1 || extOf(pubRev) === extOf(pubV2)) {
    fail(`failure publication preserved an obsolete success: conclusion=${pubRev.check?.conclusion} posts=${tvRev.calls.checkRuns.length} extCollide=${extOf(pubRev) === extOf(pubV2)}`);
  } else log('ok failure-never-reuses-success');

  // the mirror: a GO publication after a failure must not reuse the failure run
  const tvGo = makeTransport({ ...readyV2 });
  const pubGo = await publishAdmission({ ledger: v2Ledger, reportId: v2Rec.report_id, schemaBytes, schemaBytesV2: V2_SCHEMA_BYTES, policy: V2_POLICY, app, transport: tvGo.fetchJson, resolveRunIdentity: resolver, now: NOW });
  if (pubGo.check?.conclusion !== 'success' || tvGo.calls.checkRuns.length !== 1 || extOf(pubGo) === extOf(pubRev)) {
    fail(`success publication reused a failure run: conclusion=${pubGo.check?.conclusion} posts=${tvGo.calls.checkRuns.length} extCollide=${extOf(pubGo) === extOf(pubRev)}`);
  } else log('ok go-never-reuses-failure');

  // same-record crash retry: the identical intent-bound id reuses, never re-creates
  const tvRetry = makeTransport({ ...readyV2, existingExternalIds: [extOf(pubGo)] });
  const pubRetry = await publishAdmission({ ledger: v2Ledger, reportId: v2Rec.report_id, schemaBytes, schemaBytesV2: V2_SCHEMA_BYTES, policy: V2_POLICY, app, transport: tvRetry.fetchJson, resolveRunIdentity: resolver, now: NOW });
  if (pubRetry.reused !== true || pubRetry.check?.id !== 777 || tvRetry.calls.checkRuns.length !== 0) {
    fail(`crash retry re-created: reused=${pubRetry.reused} posts=${tvRetry.calls.checkRuns.length}`);
  } else log('ok v2-crash-retry-idempotent');

  // a failed discovery is NOT an empty discovery — the publication refuses instead
  // of blindly creating a duplicate check
  const tFail = makeTransport({ ...readyV2 });
  const brokenFetch = async (url, opts) => {
    if (opts?.headers?.authorization && String(url).includes('/commits/')) {
      throw Object.assign(new Error('discovery down'), { status: 502 });
    }
    return tFail.fetchJson(url, opts);
  };
  try {
    await publishAdmission({ ledger: v2Ledger, reportId: v2Rec.report_id, schemaBytes, schemaBytesV2: V2_SCHEMA_BYTES, policy: V2_POLICY, app, transport: brokenFetch, resolveRunIdentity: resolver, now: NOW });
    fail('a failed discovery published blindly');
  } catch (e) {
    if (tFail.calls.checkRuns.length === 0) log('ok discovery-failure-refuses');
    else fail(`discovery failure still wrote ${tFail.calls.checkRuns.length} checks`);
  }

  // ── increment 5: a write is not "published" until it reads back ───────────────
  const tRead = makeTransport({ ...readyV2 });
  const pubRead = await publishAdmission({ ledger: v2Ledger, reportId: v2Rec.report_id, schemaBytes, schemaBytesV2: V2_SCHEMA_BYTES, policy: V2_POLICY, app, transport: tRead.fetchJson, resolveRunIdentity: resolver, now: NOW });
  if (tRead.calls.readBacks !== 1 || pubRead.check?.conclusion !== 'success') fail(`read-back reads=${tRead.calls.readBacks} conclusion=${pubRead.check?.conclusion}`);
  else log('ok publication-read-back-verified');
  const tBad = makeTransport({ ...readyV2, readBackOverride: { conclusion: 'neutral', head_sha: 'z'.repeat(40), external_id: 'x' } });
  try {
    await publishAdmission({ ledger: v2Ledger, reportId: v2Rec.report_id, schemaBytes, schemaBytesV2: V2_SCHEMA_BYTES, policy: V2_POLICY, app, transport: tBad.fetchJson, resolveRunIdentity: resolver, now: NOW });
    fail('an unverified write was claimed as published');
  } catch (e) {
    if (e.code === 'E_PUBLISH_UNVERIFIED' && tBad.calls.checkRuns.length === 1) log('ok read-back-mismatch-refused');
    else fail(`read-back mismatch ${e.code ?? e.message} posts=${tBad.calls.checkRuns.length}`);
  }
  v2Ledger.close?.();
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
  "$(cd "$DIR/../.." && pwd)/tests/dot-review-gate/fixtures/v2/make-v2.mjs" \
  "$TMP" 2>&1)"; status=$?
assert_suite_arms "publisher.test.sh" "$status" "$out" \
  jwt-shape publish-on-current-M crashed-review-refused no-record-refused stale-M-refused \
  red-mechanics-refused spoofed-workflow-refused no-inventory-refused \
  revise-publishes-failure crash-recovery-idempotent \
  v2-schema-less-publication-refused v2-publisher-publishes-with-pin v2-publication-wrong-bytes-refused \
  failure-never-reuses-success go-never-reuses-failure v2-crash-retry-idempotent \
  discovery-failure-refuses publication-read-back-verified read-back-mismatch-refused \
  open-blocking-lineage-holds-publication || exit 1
echo "publisher.test.sh: all green"
