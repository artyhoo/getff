#!/usr/bin/env bash
# Paired-negative for scripts/dot-review-gate/service.mjs — review R11.
#
# Until the composition existed, the gate was exported components: /claim never
# evaluated readiness, leases never freed slots, authorization_expiry was a load-time
# check only, and no durable consumer drained the outbox. This suite pins the composed
# contract, credential-free (stub adapters, generated keys, real SQLite on disk):
#   - startup refuses an unresolved policy / missing schema;
#   - red mechanics stop CLAIMS (409), expired authorization stops claims AND
#     publications, pause stops both and keeps events pending, a state outage stops
#     claims (503);
#   - a lease past its deadline frees the claim slot;
#   - the happy path: claim → submit → drain publishes EXACTLY ONE success check on M,
#     and a crash-restart (fresh service on the same ledger) re-drains nothing.
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/dot-service-test.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

SCRIPT="$TMP/run-service-arms.mjs"
cat > "$SCRIPT" <<'NODE'
import { generateKeyPairSync } from 'node:crypto';
const [servicePath, fixPath, validatorPath, schemaPath, tmp] = process.argv.slice(2);
const { makeAdmission, makePolicyFixture } = await import(fixPath);
const { createGateService } = await import(servicePath);
const { readFileSync } = await import('node:fs');
const schemaBytes = readFileSync(schemaPath);
const sha = (c) => String(c).repeat(40);

const NOW0 = Date.parse('2026-10-05T12:00:00Z');
let clock = NOW0;
const REPO_STATE = () => ({
  repository_id: 1231007068,
  pr_number: 2042,
  pr_node_id: 'PR_kwDOM9YQhs6AbCdEfGh',
  base_ref: 'staging',
  base_sha: sha('b'),
  head_sha: sha('c'),
  merge_base_sha: sha('a'),
  tested_merge_sha: sha('d'),
  policy_sha256: policyDigestOfFix(),
  protocol_version: 'dot-staging-review/1.0',
  changed_files: ['packages/core/principles/44-x.test.ts'],
  mergeability: 'clean',
  merge_ref_present: true,
  checks: CHECKS(),
});
const WF = {
  'ci-success': '.github/workflows/audit-self.yml',
  'fidelity-verdict-in-pr-body': '.github/workflows/discipline-self-check.yml',
  'stale-revert-in-pr-diff': '.github/workflows/audit-self.yml',
  'Template render probes — P1/P4/P6 (deterministic)': '.github/workflows/audit-self.yml',
  'capability PR carries Prior-art line in PR body (squash-survival)': '.github/workflows/audit-self.yml',
  '§1.7 forward+backward sections present in PR description': '.github/workflows/discipline-self-check.yml',
};
function CHECKS() {
  return Object.entries(WF).map(([context, workflow_path], i) => ({
    context, app_id: 15368,
    sha: context === 'ci-success' ? sha('d') : sha('c'),
    conclusion: 'success',
    workflow_path, workflow_sha: sha('f'),
    run_id: 100 + i, run_attempt: 1, run_started_at: '2026-10-05T11:00:00Z',
  }));
}
// fixture-policy digest without importing validate internals — reuse the fixture helper
const { policyDigestOf } = await import(fixPath);
const policyDigestOfFix = () => policyDigestOf(makePolicyFixture());
const POLICY_TEXT = JSON.stringify(makePolicyFixture());

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const keyPem = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
const M = sha('d');
const H = sha('c');

// publisher-side transport: install token, check-run writes, readiness sweep, PR/M reads
function makePublisherTransport({ existingExternalIds = [] } = {}) {
  const t = { checkRuns: [] };
  t.fetchJson = async (url, opts = {}) => {
    if (url === '/app/installations/42/access_tokens') return { token: 'it-1' };
    if (url === '/repos/artyhoo/getff/check-runs' && opts.method === 'POST') {
      const body = JSON.parse(opts.body);
      t.checkRuns.push(body);
      return { id: 500 + t.checkRuns.length, ...body, app: { id: 999999999 } };
    }
    if (url.startsWith('/repos/artyhoo/getff/commits/') && url.includes('/check-runs')) {
      if (opts.headers?.authorization) {
        const found = existingExternalIds.length > 0 && t.checkRuns.length === 0
          ? [{ id: 777, external_id: existingExternalIds[0], app: { id: 999999999 } }]
          : [];
        return { total_count: found.length, check_runs: found };
      }
      const onMerge = url.startsWith(`/repos/artyhoo/getff/commits/${M}/`);
      const src = onMerge ? CHECKS().filter((c) => c.context === 'ci-success') : CHECKS().filter((c) => c.context !== 'ci-success');
      return {
        total_count: src.length,
        check_runs: src.map((c) => ({ name: c.context, app: { id: c.app_id }, head_sha: c.sha, conclusion: c.conclusion })),
      };
    }
    if (url === '/repos/artyhoo/getff/git/ref/pull/2042/merge') return { object: { sha: M } };
    if (url === '/repos/artyhoo/getff/pulls/2042') {
      return { state: 'open', draft: false, mergeable_state: 'clean', node_id: 'PR_kwDOM9YQhs6AbCdEfGh', head: { sha: H }, base: { ref: 'staging', sha: sha('b') } };
    }
    throw new Error(`unexpected transport call ${url}`);
  };
  return t;
}

const oauth = {
  async exchangeCode(code) { return { access_token: 'tok-1', scope: '' }; },
  async fetchUser() { return { id: 555001, login: 'dot-reviewer' }; },
};
const resolveRunIdentity = async (check) => ({
  workflow_path: WF[check.name] ?? '.github/workflows/untrusted.yml',
  run_id: 101, run_attempt: 1, run_started_at: '2026-10-05T11:00:00Z', workflow_sha: sha('f'),
});
const publisherApp = { appId: 12345, installationId: 42, privateKeyPem: keyPem };

let state = REPO_STATE();
const readState = async () => {
  if (state === null) throw Object.assign(new Error('github unreachable'), { status: 502 });
  return state;
};

async function newService(over = {}) {
  return createGateService({
    ledgerPath: over.ledgerPath ?? `${tmp}/service-${Math.random().toString(36).slice(2)}.sqlite`,
    policyText: over.policyText ?? POLICY_TEXT,
    schemaBytes,
    oauth,
    webhookSecret: 'hook-secret',
    readState: over.readState ?? readState,
    resolveRunIdentity,
    publisherApp,
    now: over.now ?? (() => clock),
  });
}

const login = async (base) => {
  const start = await fetch(`${base}/oauth/start`, { redirect: 'manual' });
  const location = start.headers.get('location') ?? '';
  const startCookie = (start.headers.get('set-cookie') ?? '').split(';')[0];
  const s = new URL(location).searchParams.get('state') ?? '';
  const res = await fetch(`${base}/oauth/callback?code=c&state=${encodeURIComponent(s)}`, { headers: { cookie: startCookie } });
  return (res.headers.get('set-cookie') ?? '').split(';')[0];
};
const call = async (base, cookie, path, body, raw) => {
  const res = await fetch(base + path, {
    method: 'POST',
    headers: { ...(raw ? { 'content-type': 'application/json' } : body !== undefined ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
    body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  return { status: res.status, json };
};
const envelopeFor = (claim, reportOverrides = {}) => {
  const report = makeAdmission({
    claim_id: claim.json.claim_id,
    generation: claim.json.generation,
    revision: { base_ref: 'staging', base_sha: sha('b'), head_sha: sha('c'), merge_base_sha: sha('a'), tested_merge_sha: sha('d') },
    ...reportOverrides,
  });
  return { claim_id: claim.json.claim_id, generation: claim.json.generation, report };
};

const log = (...a) => console.log(...a);
const fail = (m) => { console.log('FAIL ' + m); process.exitCode = 1; };

try {
  // RED: unresolved policy → the service refuses to start (fail-closed config)
  try {
    await createGateService({
      ledgerPath: `${tmp}/x.sqlite`, policyText: JSON.stringify(makePolicyFixture({ schema_sha256: 'UNRESOLVED' })),
      schemaBytes, oauth, webhookSecret: 's', readState, publisherApp, now: () => clock,
    });
    fail('unresolved policy started a service');
  } catch (e) {
    if (String(e.message).includes('rejected')) log('ok startup-unresolved-policy-refused');
    else fail(`startup refusal ${e.message}`);
  }

  // GREEN: end-to-end — claim (green mechanics) → submit → drain → ONE success check
  state = REPO_STATE();
  const svc = await newService();
  const base = `http://127.0.0.1:${svc.port}`;
  const cookie = await login(base);
  const claim = await call(base, cookie, '/claim', {});
  if (claim.status !== 200) fail(`claim ${claim.status} ${JSON.stringify(claim.json).slice(0, 120)}`);
  const submitted = await call(base, cookie, '/submit', envelopeFor(claim));
  if (submitted.status !== 200) fail(`submit ${submitted.status} ${JSON.stringify(submitted.json).slice(0, 160)}`);
  const pubTransport = makePublisherTransport();
  const drained = await svc.drainOutbox({ publisherTransport: pubTransport.fetchJson });
  if (pubTransport.checkRuns.filter((c) => c.conclusion === 'success').length !== 1) fail(`drain published ${pubTransport.checkRuns.length}`);
  else if (!drained.some((r) => r.action === 'published')) fail(`drain result ${JSON.stringify(drained)}`);
  else log('ok e2e-publish-once');

  // RED: drain again → the outbox row is published, no second check ever
  await svc.drainOutbox({ publisherTransport: pubTransport.fetchJson });
  if (pubTransport.checkRuns.length !== 1) fail(`re-drain created checks: ${pubTransport.checkRuns.length}`);
  else log('ok re-drain-no-second-check');

  // RED: red mechanics stop CLAIMS — no challenge is issued on an ineligible tuple
  state = { ...REPO_STATE(), checks: CHECKS().map((c) => c.context === 'ci-success' ? { ...c, conclusion: 'failure' } : c) };
  const redClaim = await call(base, cookie, '/claim', {});
  if (redClaim.status !== 409 || redClaim.json?.code !== 'E_NOT_READY') fail(`red claim ${redClaim.status} ${JSON.stringify(redClaim.json).slice(0, 100)}`);
  else log('ok red-mechanics-stop-claims');

  // RED: state outage stops CLAIMS
  const svcOutage = await newService({ readState: async () => { throw Object.assign(new Error('down'), { status: 502 }); } });
  const cookieOutage = await login(`http://127.0.0.1:${svcOutage.port}`);
  const outageClaim = await call(`http://127.0.0.1:${svcOutage.port}`, cookieOutage, '/claim', {});
  if (outageClaim.status !== 503) fail(`outage claim ${outageClaim.status}`);
  else log('ok state-outage-stops-claims');
  await svcOutage.close();

  // RED: lease expiry frees the claim slot (the same tuple re-claims after the lease)
  clock += 121 * 60 * 1000;
  state = REPO_STATE();
  const reclaim = await call(base, cookie, '/claim', {});
  if (reclaim.status !== 200) fail(`expired lease still holds the slot: ${reclaim.status}`);
  else log('ok lease-frees-claim-slot');

  // RED: expired authorization stops claims AND publications (events stay pending)
  state = REPO_STATE();
  const svcExpired = await newService({ now: () => Date.parse('2027-01-02T00:00:00Z') });
  const baseE = `http://127.0.0.1:${svcExpired.port}`;
  const cookieE = await login(baseE);
  const expiredClaim = await call(baseE, cookieE, '/claim', {});
  if (expiredClaim.status !== 403 || expiredClaim.json?.code !== 'E_EXPIRED') fail(`expired claim ${expiredClaim.status}`);
  else log('ok expiry-stops-claims');
  const eTransport = makePublisherTransport();
  const eDrained = await svcExpired.drainOutbox({ publisherTransport: eTransport.fetchJson });
  if (eTransport.checkRuns.length !== 0 || !eDrained.every((r) => r.action === 'drained' || r.action === 'skipped-expired')) {
    fail(`expired drain ${JSON.stringify(eDrained)}`);
  } else log('ok expiry-stops-publication');
  await svcExpired.close();

  // RED: service pause stops claims AND publications; unpause resumes
  const svcPaused = await newService();
  const baseP = `http://127.0.0.1:${svcPaused.port}`;
  const cookieP = await login(baseP);
  const claimP = await call(baseP, cookieP, '/claim', {});
  if (claimP.status !== 200) fail(`pre-pause claim ${claimP.status}`);
  const submitP = await call(baseP, cookieP, '/submit', envelopeFor(claimP));
  if (submitP.status !== 200) fail(`pre-pause submit ${submitP.status}`);
  svcPaused.setPaused(true);
  const pausedClaim = await call(baseP, cookieP, '/claim', {});
  const pTransport = makePublisherTransport();
  const pDrained = await svcPaused.drainOutbox({ publisherTransport: pTransport.fetchJson });
  if (pausedClaim.status !== 503 || pausedClaim.json?.code !== 'E_PAUSED') fail(`paused claim ${pausedClaim.status}`);
  else if (pTransport.checkRuns.length !== 0) fail('published while paused');
  else if (!pDrained.some((r) => r.action === 'skipped-paused')) fail(`paused drain ${JSON.stringify(pDrained)}`);
  else log('ok pause-stops-claims-and-publication');
  svcPaused.setPaused(false);
  const resumed = await call(baseP, cookieP, '/claim', {});
  if (resumed.status !== 200) fail(`unpaused claim ${resumed.status}`);
  else log('ok unpause-resumes');
  await svcPaused.close();

  // GREEN: crash-restart — a fresh service on the SAME ledger drains nothing twice
  const restartPath = `${tmp}/restart.sqlite`;
  const svcA = await newService({ ledgerPath: restartPath });
  const baseA = `http://127.0.0.1:${svcA.port}`;
  const cookieA = await login(baseA);
  state = REPO_STATE();
  const claimA = await call(baseA, cookieA, '/claim', {});
  await call(baseA, cookieA, '/submit', envelopeFor(claimA));
  await svcA.close();
  const svcB = await newService({ ledgerPath: restartPath });
  const rTransport = makePublisherTransport();
  await svcB.drainOutbox({ publisherTransport: rTransport.fetchJson });
  const afterOne = rTransport.checkRuns.length;
  await svcB.drainOutbox({ publisherTransport: rTransport.fetchJson });
  if (afterOne !== 1 || rTransport.checkRuns.length !== 1) fail(`restart drain ${afterOne}/${rTransport.checkRuns.length}`);
  else log('ok restart-drains-single-publication');
  await svcB.close();

  // ── acceptance vs admission (follow-up packet, increment 2): a VALID non-authorizing
  // review (REVISE/INCOMPLETE) is ACCEPTED into the ledger with a receipt and routes to
  // ONE named failure check on M — never a 422, never a success check, never a merge.
  state = REPO_STATE();
  const svcR = await newService();
  const baseR = `http://127.0.0.1:${svcR.port}`;
  const cookieR = await login(baseR);
  const claimR = await call(baseR, cookieR, '/claim', {});
  if (claimR.status !== 200) fail(`revise claim ${claimR.status} ${JSON.stringify(claimR.json).slice(0, 120)}`);
  const envRevise = envelopeFor(claimR, { verdict: 'REVISE', completion: 'INCOMPLETE', execution: { failure: true, failure_reason: 'lease expired mid-review' } });
  const submittedRev = await call(baseR, cookieR, '/submit', envRevise);
  if (submittedRev.status !== 200 || !submittedRev.json?.report_id) {
    fail(`revise submit ${submittedRev.status} ${JSON.stringify(submittedRev.json).slice(0, 140)}`);
  } else log('ok accept-revise-persisted');

  // RED: identical bytes again → the SAME receipt, replayed:true, no second record
  const replayedRev = await call(baseR, cookieR, '/submit', envRevise);
  if (
    replayedRev.status !== 200 ||
    replayedRev.json?.report_id !== submittedRev.json?.report_id ||
    replayedRev.json?.replayed !== true
  ) fail(`revise replay ${replayedRev.status} ${JSON.stringify(replayedRev.json).slice(0, 140)}`);
  else log('ok replay-idempotent');

  // RED: stitched envelope (inner claim_id disagrees) → 422 E_ENVELOPE, nothing persisted
  const forged = JSON.parse(JSON.stringify(envRevise));
  forged.report.claim_id = '00000000-0000-0000-0000-000000000000';
  const forgedRes = await call(baseR, cookieR, '/submit', forged);
  if (forgedRes.status !== 422 || forgedRes.json?.code !== 'E_ENVELOPE') fail(`forged ${forgedRes.status} ${JSON.stringify(forgedRes.json).slice(0, 120)}`);
  else log('ok forged-envelope-rejected');

  // RED: head moves after the claim → the old report no longer matches the live tuple
  // → 422 E_TUPLE; an issued review delayed by a push can never authorize the new head
  state = { ...REPO_STATE(), head_sha: sha('e') };
  const staleRes = await call(baseR, cookieR, '/submit', envRevise);
  if (staleRes.status !== 422 || !JSON.stringify(staleRes.json?.errors ?? '').includes('E_TUPLE')) fail(`stale tuple ${staleRes.status} ${JSON.stringify(staleRes.json).slice(0, 120)}`);
  else log('ok stale-tuple-submit-refused');

  // RED: the drain routes the accepted REVISE record to ONE failure check on M —
  // zero success checks anywhere (a REVISE can never merge)
  const tRev = makePublisherTransport();
  const dRev = await svcR.drainOutbox({ publisherTransport: tRev.fetchJson });
  const successCount = tRev.checkRuns.filter((c) => c.conclusion === 'success').length;
  const failureOnM = tRev.checkRuns.filter((c) => c.conclusion === 'failure' && c.head_sha === M).length;
  if (successCount !== 0 || failureOnM !== 1) {
    fail(`revise routing success=${successCount} failureOnM=${failureOnM} drain=${JSON.stringify(dRev)} checks=${JSON.stringify(tRev.checkRuns.map((c) => [c.conclusion, c.head_sha]))}`);
  } else log('ok revise-publishes-named-failure');
  await svcR.close();

  await svc.close();
} catch (e) {
  fail(`unexpected: ${e.stack?.split('\n').slice(0, 2).join(' | ')}`);
}
NODE

# shellcheck disable=SC1091
source "$DIR/suite-harness.sh"
out="$(node "$SCRIPT" \
  "$DIR/service.mjs" \
  "$(cd "$DIR/../.." && pwd)/tests/dot-review-gate/fixtures/make-admission.mjs" \
  "$DIR/validate-report.mjs" \
  "$(cd "$DIR/../.." && pwd)/docs/meta-factory/dot-review-result.schema.json" \
  "$TMP" 2>&1)"; status=$?
assert_suite_arms "service.test.sh" "$status" "$out" \
  startup-unresolved-policy-refused e2e-publish-once re-drain-no-second-check \
  red-mechanics-stop-claims state-outage-stops-claims lease-frees-claim-slot \
  expiry-stops-claims expiry-stops-publication pause-stops-claims-and-publication \
  unpause-resumes restart-drains-single-publication \
  accept-revise-persisted replay-idempotent forged-envelope-rejected \
  stale-tuple-submit-refused revise-publishes-named-failure || exit 1
echo "service.test.sh: all green"
