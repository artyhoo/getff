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
#   - DR-R3: a correctly issued report submitted after the tuple moved is preserved
#     as superseded history (admission false), its drain archives it without a check
#     write, replay after the movement returns the existing receipt, and forged
#     envelopes stay rejected;
#   - the happy path: claim → submit → drain publishes EXACTLY ONE success check on M,
#     and a crash-restart (fresh service on the same ledger) re-drains nothing.
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/dot-service-test.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

SCRIPT="$TMP/run-service-arms.mjs"
cat > "$SCRIPT" <<'NODE'
import { generateKeyPairSync, createHash } from 'node:crypto';
const [servicePath, fixPath, validatorPath, schemaPath, v2fixPath, tmp] = process.argv.slice(2);
const { makeAdmission, makePolicyFixture } = await import(fixPath);
const { makeV2Review, V2_SCHEMA_BYTES, V2_SCHEMA_SHA256 } = await import(v2fixPath);
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
  'ci/tests': '.github/workflows/audit-self.yml',
  'ci/lint': '.github/workflows/audit-self.yml',
  'dot-gate suites': '.github/workflows/audit-self.yml',
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
    if (/^\/repos\/artyhoo\/getff\/check-runs\/\d+$/.test(url)) {
      const id = Number(url.split('/').pop());
      const rec = t.checkRuns.find((c) => c.id === id);
      if (!rec) throw Object.assign(new Error('check-run vanished before read-back'), { status: 404 });
      return rec;
    }
    if (url === '/repos/artyhoo/getff/check-runs' && opts.method === 'POST') {
      const body = JSON.parse(opts.body);
      const rec = { id: 500 + t.checkRuns.length + 1, ...body, app: { id: 999999999 } };
      t.checkRuns.push(rec);
      return rec;
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
    // R4 arms: the canonical follow-up names PR 2056 — routed to a finding-less
    // node so publication eligibility never masks the receipt property under test
    if (url === '/repos/artyhoo/getff/git/ref/pull/2056/merge') return { object: { sha: M } };
    if (url === '/repos/artyhoo/getff/pulls/2056') {
      return { state: 'open', draft: false, mergeable_state: 'clean', node_id: 'PR_kwDOR2046Clean', head: { sha: H }, base: { ref: 'staging', sha: sha('b') } };
    }
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

// cold-review fix: every created service is tracked and closed in the outer
// finally — a mid-suite throw must FAIL the suite, not leak the intake server
// (the round-2/3 hang class) and leave the node child running forever
const live = [];
async function newService(over = {}) {
  const svc = await createGateService({
    ledgerPath: over.ledgerPath ?? `${tmp}/service-${Math.random().toString(36).slice(2)}.sqlite`,
    policyText: over.policyText ?? POLICY_TEXT,
    schemaBytes,
    schemaBytesV2: over.schemaBytesV2,
    oauth,
    webhookSecret: 'hook-secret',
    readState: over.readState ?? readState,
    resolveRunIdentity,
    publisherApp,
    now: over.now ?? (() => clock),
  });
  live.push(svc);
  const origClose = svc.close.bind(svc);
  let closed = false;
  svc.close = async () => { if (closed) return; closed = true; await origClose(); };
  return svc;
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

  // DR-R5: two CONCURRENT drains cannot double-process the same event — the batch
  // claim is a reservation, so the loser of the race sees an empty batch
  state = REPO_STATE();
  const svcC = await newService();
  const baseC = `http://127.0.0.1:${svcC.port}`;
  const cookieC = await login(baseC);
  const claimC = await call(baseC, cookieC, '/claim', {});
  if (claimC.status !== 200) fail(`concurrent claim ${claimC.status}`);
  await call(baseC, cookieC, '/submit', envelopeFor(claimC));
  const tCa = makePublisherTransport();
  const tCb = makePublisherTransport();
  await Promise.all([
    svcC.drainOutbox({ publisherTransport: tCa.fetchJson }),
    svcC.drainOutbox({ publisherTransport: tCb.fetchJson }),
  ]);
  const concurrentChecks = tCa.checkRuns.length + tCb.checkRuns.length;
  if (concurrentChecks !== 1) fail(`concurrent drains wrote ${concurrentChecks} checks (a=${tCa.checkRuns.length} b=${tCb.checkRuns.length})`);
  else log('ok concurrent-drains-single-check');
  await svcC.close();

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

  // DR-R3: replay AFTER the tuple moved returns the EXISTING receipt — rejection
  // from admission is not rejection from storage
  state = { ...REPO_STATE(), head_sha: sha('e') };
  const replayAfterMove = await call(baseR, cookieR, '/submit', envRevise);
  if (
    replayAfterMove.status !== 200 ||
    replayAfterMove.json?.report_id !== submittedRev.json?.report_id ||
    replayAfterMove.json?.replayed !== true
  ) fail(`replay after movement ${replayAfterMove.status} ${JSON.stringify(replayAfterMove.json).slice(0, 140)}`);
  else log('ok replay-after-movement-existing-receipt');

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

  // ── DR-R3: archival — a correctly issued report submitted after the tuple moved is
  // preserved as SUPERSEDED HISTORY (admission false), never lost; its drain archives
  // it without a check write; forged envelopes stay rejected after the movement.
  state = REPO_STATE();
  const svcH = await newService();
  const baseH = `http://127.0.0.1:${svcH.port}`;
  const cookieH = await login(baseH);
  const claimH = await call(baseH, cookieH, '/claim', {});
  if (claimH.status !== 200) fail(`h1 claim ${claimH.status} ${JSON.stringify(claimH.json).slice(0, 120)}`);
  const envH = envelopeFor(claimH, { verdict: 'REVISE', completion: 'INCOMPLETE', execution: { failure: true, failure_reason: 'review delayed by a push' } });
  // the tuple moves (H2 lands) BEFORE the H1 report is submitted
  state = { ...REPO_STATE(), head_sha: sha('e') };
  const h1Late = await call(baseH, cookieH, '/submit', envH);
  if (h1Late.status !== 200 || !h1Late.json?.report_id || h1Late.json?.superseded !== true || h1Late.json?.admitted !== false) {
    fail(`h1 late ${h1Late.status} ${JSON.stringify(h1Late.json).slice(0, 160)}`);
  } else log('ok late-report-persisted-as-history');

  // the archived record never publishes: the drain archives it without a check write
  const tH = makePublisherTransport();
  const dH = await svcH.drainOutbox({ publisherTransport: tH.fetchJson });
  if (tH.checkRuns.length !== 0 || !dH.some((r) => r.action === 'archived')) {
    fail(`h1 archive drain runs=${tH.checkRuns.length} ${JSON.stringify(dH)}`);
  } else log('ok archived-record-never-publishes');

  // forged (stitched) envelopes stay rejected after the movement
  const forgedH = JSON.parse(JSON.stringify(envH));
  forgedH.report.claim_id = '00000000-0000-0000-0000-000000000000';
  const forgedHRes = await call(baseH, cookieH, '/submit', forgedH);
  if (forgedHRes.status !== 422 || forgedHRes.json?.code !== 'E_ENVELOPE') fail(`h1 forged ${forgedHRes.status} ${JSON.stringify(forgedHRes.json).slice(0, 120)}`);
  else log('ok forged-still-rejected-after-movement');
  await svcH.close();

  // ── persistence guard (packet increment 4): in-memory storage is fixture-only —
  // a service without a persistent ledger path refuses to start; the fixture escape
  // is an explicit allowMemoryLedger flag, never an accident of omission.
  try {
    await createGateService({
      ledgerPath: ':memory:', policyText: POLICY_TEXT, schemaBytes, oauth,
      webhookSecret: 's', readState, publisherApp, now: () => clock,
    });
    fail('in-memory ledger started without the fixture flag');
  } catch (e) {
    if (e.code === 'E_NO_PERSISTENT_PATH') log('ok memory-ledger-refused');
    else fail(`memory guard ${e.code ?? e.message}`);
  }
  const svcMem = await createGateService({
    policyText: POLICY_TEXT, schemaBytes, oauth, webhookSecret: 's',
    readState, publisherApp, allowMemoryLedger: true, now: () => clock,
  });
  if (!svcMem || typeof svcMem.drainOutbox !== 'function') fail('fixture memory service');
  else log('ok memory-allowed-for-fixtures');
  await svcMem.close();

  // ── V2 records end-to-end (packet increment 3): DotPRReviewV2/2.0.0 documents flow
  // through claim → submit → drain on the SAME service; a REVISE/INSUFFICIENT V2
  // record routes to ONE named failure check (never success), a fully qualifying V2
  // GO authorizes exactly one success check on M, and a stitched V2 envelope is 422.
  const canonicalV2 = makeV2Review();
  // the V2 era has its OWN policy epoch — the record's policy pin must be the digest
  // of the policy this service actually runs, and the publisher re-derives its tuple
  // state from that same policy (protocol dot-pr-review/2.0.0)
  // SP-7: the V2-era policy's head-bound mechanical contexts are the trusted
  // required-check set the closure consumer evaluates — here exactly the context
  // the canonical fix-response record carries.
  const V2_POLICY = makePolicyFixture({
    protocol_version: 'dot-pr-review/2.0.0', schema_v2_sha256: V2_SCHEMA_SHA256,
    mechanical_contexts: [
      { context: 'dot-gate suites', expected_app_id: 15368, bound_to: 'head', workflow_path: '.github/workflows/audit-self.yml' },
    ],
    // the V2 arms claim the same live tuple repeatedly (report → revise → late → GO)
    limits: { max_active_claims: 1, max_attempts_per_tuple: 8, claim_lease_minutes: 120 },
  });
  const V2_POLICY_TEXT = JSON.stringify(V2_POLICY);
  const v2PolicyDigestOf = policyDigestOf(V2_POLICY);
  // DR-R4: a V2-era deployment without the pinned V2 bytes refuses to START —
  // absent bytes must never degrade into schema-less validation
  try {
    await createGateService({
      ledgerPath: `${tmp}/v2-nopin.sqlite`, policyText: V2_POLICY_TEXT, schemaBytes,
      oauth, webhookSecret: 's', readState, publisherApp, now: () => clock,
    });
    fail('V2-era service started without schemaBytesV2');
  } catch (e) {
    if (e.code === 'E_CONFIG') log('ok v2-era-startup-requires-pin');
    else fail(`v2 startup guard ${e.code ?? e.message}`);
  }
  // SP-3: PRESENCE is not a pin — the packet's probe started a service whose
  // operational V2 schema was permissive {"type":"object"} bytes. Startup must
  // verify the bytes digest to the policy's schema_v2_sha256 pin.
  try {
    await createGateService({
      ledgerPath: `${tmp}/v2-wrongbytes.sqlite`, policyText: V2_POLICY_TEXT, schemaBytes,
      schemaBytesV2: Buffer.from(JSON.stringify({ type: 'object' })),
      oauth, webhookSecret: 's', readState, publisherApp, now: () => clock,
    });
    fail('V2-era service started with unpinned (permissive) V2 bytes');
  } catch (e) {
    if (e.code === 'E_CONFIG') log('ok v2-era-startup-wrong-bytes-refused');
    else fail(`v2 wrong-bytes guard ${e.code ?? e.message}`);
  }
  const v2Live = (over = {}, assignmentId) => makeV2Review({
    review_identity: {
      ...canonicalV2.review_identity,
      assignment_id: assignmentId,
      repository: { id: 1231007068, full_name: 'artyhoo/getff' },
      pull_request: { number: 2042, node_id: 'PR_kwDOM9YQhs6AbCdEfGh' },
      mode: 'OPEN_PR',
      comparison_basis: 'HEAD_TO_MERGE_CANDIDATE',
      revisions: { head_sha: sha('c'), base_sha: sha('b'), merge_base_sha: sha('a'), tested_merge_sha: sha('d') },
      policy: { version: '2026-10-05.1', sha256: v2PolicyDigestOf, epoch: 1 },
    },
    scope: { changed_paths: [{ path: 'packages/core/principles/44-x.test.ts', treatment: 'SYSTEM_ANALYZED', rationale: 'gate change reviewed against the base' }], omissions: [] },
    ...over,
  });
  const v2State = () => ({ ...REPO_STATE(), protocol_version: 'dot-pr-review/2.0.0', policy_sha256: v2PolicyDigestOf });
  state = v2State();
  const svcV2 = await newService({ schemaBytesV2: V2_SCHEMA_BYTES, policyText: V2_POLICY_TEXT });
  const baseV2 = `http://127.0.0.1:${svcV2.port}`;
  const cookieV2 = await login(baseV2);
  const claimV2 = await call(baseV2, cookieV2, '/claim', {});
  if (claimV2.status !== 200) fail(`v2 claim ${claimV2.status} ${JSON.stringify(claimV2.json).slice(0, 120)}`);
  const v2Env = (report) => ({ claim_id: claimV2.json.claim_id, generation: claimV2.json.generation, report });
  const stitched = v2Env(v2Live({}, claimV2.json.claim_id));
  stitched.report.review_identity.assignment_id = '00000000-0000-0000-0000-000000000000';
  const stitchedRes = await call(baseV2, cookieV2, '/submit', stitched);
  if (stitchedRes.status !== 422 || stitchedRes.json?.code !== 'E_ENVELOPE') fail(`v2 stitched ${stitchedRes.status} ${JSON.stringify(stitchedRes.json).slice(0, 120)}`);
  else log('ok v2-stitched-envelope-rejected');
  // DR-R4 composed control: a V2 record missing a schema-required field is refused
  // THROUGH the intake with the pin in place (the packet's probe, end-to-end)
  const probe = v2Live({}, claimV2.json.claim_id);
  delete probe.change_review_receipt;
  const probeRes = await call(baseV2, cookieV2, '/submit', v2Env(probe));
  if (probeRes.status !== 422 || !JSON.stringify(probeRes.json?.errors ?? []).includes('E_SCHEMA')) fail(`v2 probe ${probeRes.status} ${JSON.stringify(probeRes.json).slice(0, 140)}`);
  else log('ok v2-schema-required-field-enforced');
  const v2ReviseRec = v2Live({
    verdict: { outcome: 'REVISE', rationale: 'prior review insufficient for the material delta', blockers: [] },
    assessments: { ...canonicalV2.assessments, prior_review_sufficiency: 'INSUFFICIENT' },
  }, claimV2.json.claim_id);
  const subV2Rev = await call(baseV2, cookieV2, '/submit', v2Env(v2ReviseRec));
  if (subV2Rev.status !== 200 || !subV2Rev.json?.report_id) fail(`v2 revise submit ${subV2Rev.status} ${JSON.stringify(subV2Rev.json).slice(0, 160)}`);
  else log('ok v2-revise-accepted-persisted');
  const tV2R = makePublisherTransport();
  const dV2R = await svcV2.drainOutbox({ publisherTransport: tV2R.fetchJson });
  const v2SuccessR = tV2R.checkRuns.filter((c) => c.conclusion === 'success').length;
  const v2FailOnM = tV2R.checkRuns.filter((c) => c.conclusion === 'failure' && c.head_sha === M).length;
  if (v2SuccessR !== 0 || v2FailOnM !== 1) fail(`v2 revise routing success=${v2SuccessR} failureOnM=${v2FailOnM} drain=${JSON.stringify(dV2R)}`);
  else log('ok v2-revise-publishes-named-failure');

  // the V2 GO record: same tuple, new claim after the first generation consumed
  state = v2State();
  const claimG = await call(baseV2, cookieV2, '/claim', {});
  if (claimG.status !== 200) fail(`v2 go claim ${claimG.status} ${JSON.stringify(claimG.json).slice(0, 120)}`);
  const subV2Go = await call(baseV2, cookieV2, '/submit', { claim_id: claimG.json.claim_id, generation: claimG.json.generation, report: v2Live({}, claimG.json.claim_id) });
  if (subV2Go.status !== 200 || !subV2Go.json?.report_id) fail(`v2 go submit ${subV2Go.status} ${JSON.stringify(subV2Go.json).slice(0, 160)}`);
  else log('ok v2-go-accepted');
  const tV2G = makePublisherTransport();
  await svcV2.drainOutbox({ publisherTransport: tV2G.fetchJson });
  const v2SuccessG = tV2G.checkRuns.filter((c) => c.conclusion === 'success' && c.head_sha === M).length;
  const v2FailG = tV2G.checkRuns.filter((c) => c.conclusion === 'failure').length;
  if (v2SuccessG !== 1 || v2FailG !== 0) fail(`v2 go routing successOnM=${v2SuccessG} failure=${v2FailG} checks=${JSON.stringify(tV2G.checkRuns.map((c) => c.conclusion))}`);
  else log('ok v2-go-authorizes-single-success');
  await svcV2.close();

  // ── increment 5: the drain is the REAL consumer of accepted V2 records ───────
  const v2Finding = (id, over = {}) => ({
    finding_id: id, occurrence_id: `O-${id}`, title: `defect ${id}`,
    requirement: 'the gate refuses unstaged paths', category: 'correctness', severity: 'critical',
    blocking: true, failure_scenario: 'an unstaged path bypasses the gate',
    locations: ['scripts/dot-review-gate/validate-report.mjs'], affected_consumers: ['core'],
    evidence: [{ level: 'SOURCE_TRACED', reference: 'validate-report.mjs:1', note: null }],
    expected_correction: 'refuse the path', verification_expectation: 'paired negative fails first',
    ...over,
  });
  const svcF = await newService({ schemaBytesV2: V2_SCHEMA_BYTES, policyText: V2_POLICY_TEXT });
  const baseF = `http://127.0.0.1:${svcF.port}`;
  const cookieF = await login(baseF);
  const claimF = await call(baseF, cookieF, '/claim', {});
  if (claimF.status !== 200) fail(`f claim ${claimF.status}`);
  const findingReport = v2Live({
    verdict: { outcome: 'REVISE', rationale: 'one blocking defect', blockers: [] },
    assessments: { ...canonicalV2.assessments, prior_review_sufficiency: 'INSUFFICIENT' },
    findings: [v2Finding('F-900')],
  }, claimF.json.claim_id);
  const subF = await call(baseF, cookieF, '/submit', { claim_id: claimF.json.claim_id, generation: claimF.json.generation, report: findingReport });
  if (subF.status !== 200) fail(`findings submit ${subF.status} ${JSON.stringify(subF.json).slice(0, 160)}`);
  const dF = await svcF.drainOutbox({ publisherTransport: makePublisherTransport().fetchJson });
  const openF = svcF.ledger.listOpenFindings().filter((o) => o.finding_key === 'F-900');
  if (openF.length !== 1 || openF[0].blocking !== 1) fail(`findings consumer open=${JSON.stringify(openF)} drain=${JSON.stringify(dF)}`);
  else log('ok v2-findings-enter-lifecycle');

  // superseded records still contribute their findings — the history the queue
  // revalidates before any remediation launch
  state = v2State();
  const claimF2 = await call(baseF, cookieF, '/claim', {});
  const lateReport = v2Live({
    verdict: { outcome: 'REVISE', rationale: 'late sighting', blockers: [] },
    assessments: { ...canonicalV2.assessments, prior_review_sufficiency: 'INSUFFICIENT' },
    findings: [v2Finding('F-901')],
  }, claimF2.json.claim_id);
  state = { ...v2State(), head_sha: sha('e') };
  const lateF = await call(baseF, cookieF, '/submit', { claim_id: claimF2.json.claim_id, generation: claimF2.json.generation, report: lateReport });
  if (lateF.status !== 200 || lateF.json?.superseded !== true) fail(`late v2 submit ${lateF.status} ${JSON.stringify(lateF.json).slice(0, 140)}`);
  await svcF.drainOutbox({ publisherTransport: makePublisherTransport().fetchJson });
  const lateOpen = svcF.ledger.listOpenFindings().filter((o) => o.finding_key === 'F-901');
  if (lateOpen.length !== 1) fail(`superseded findings lost: ${JSON.stringify(lateOpen)}`);
  else log('ok superseded-findings-recorded-as-history');

  // a stored V2 fix_response record is consumed into the lifecycle — no admission
  // check is written from it. SP-2: the record carries its OWN independent change
  // review; the CONSUMER records it as a real change_review receipt — nothing is
  // injected between the submit and the lifecycle state.
  const assignmentF900 = svcF.ledger.claimFinding({ findingKey: 'F-900', owner: 'cc-executor/mechanism-lane', leaseMinutes: 30, nowMs: clock + 600_000 }).assignment_id;
  const loadExampleJson = async (name) => { const m = await import(v2fixPath); return JSON.parse(m.loadExample(name)); };
  const changeReviewReceipt = (reviewer, revision) => ({
    artifact_reference: `diff/${revision}`, artifact_sha256: 'a'.repeat(64),
    reviewer, independence: 'second reviewer, not the fix owner',
    limits: ['offline fixture review of the bounded fix diff'], reviewed_revision: revision,
    comparison_basis: 'targeted fix delta', scenarios: ['fix independently checked'], equivalence: null,
    reviewed_scope: ['scripts/dot-review-gate/intake.mjs'],
    finding_ids: ['F-900'], resolutions: [],
  });
  const coordTuple = (headChar) => ({ repository_id: 1231007068, pr_node_id: 'PR_kwDOM9YQhs6AbCdEfGh', base_ref: 'staging', base_sha: sha('b'), head_sha: sha(headChar), merge_base_sha: sha('a'), tested_merge_sha: sha('d'), policy_sha256: v2PolicyDigestOf, protocol_version: 'dot-pr-review/2.0.0' });
  // R3-1: records are submitted under their ROLE principal — the executor records
  // under 666001 (registry label 'cc-executor/mechanism-lane'), the independent
  // verifier's closure records under 777001 ('dot/astra-primary'), reviewer
  // submissions under 555001. The consumer binds actors from the registry.
  const submitLifecycleRecord = async (record, tupleHead, reviewerId = 666001, claimOver = {}) => {
    const revision = record.fix_revision ?? record.verification_revision ?? record.change_review_receipt?.reviewed_revision;
    if (typeof revision === 'string' && /^[0-9a-f]{40}$/.test(revision)) tupleHead = revision[0];
    state = { ...v2State(), ...coordTuple(tupleHead) };
    state.checks = CHECKS().map(c => ({ ...c, sha: c.context === 'ci-success' ? state.tested_merge_sha : state.head_sha }));
    const gen = svcF.ledger.claimGeneration({ tuple: coordTuple(tupleHead), reviewerId, maxAttemptsPerTuple: 40, leaseMinutes: 30, changedFiles: ['packages/core/principles/44-x.test.ts'], ...claimOver });
    if (record.record_type === 'review_report') record = makeV2Review({ ...record, review_identity: { ...record.review_identity, assignment_id: gen.claim.claim_id, repository: { id: 1231007068, full_name: 'artyhoo/getff' }, pull_request: { number: 2042, node_id: state.pr_node_id }, revisions: { ...record.review_identity.revisions, head_sha: state.head_sha, base_sha: state.base_sha, merge_base_sha: state.merge_base_sha, tested_merge_sha: state.tested_merge_sha }, policy: { version: '2026-10-05.1', sha256: v2PolicyDigestOf, epoch: 1 } }, scope: { changed_paths: [{ path: 'packages/core/principles/44-x.test.ts', treatment: 'SYSTEM_ANALYZED', rationale: 'bounded fix verified' }], omissions: [] } });
    const payloadText = JSON.stringify(record);
    return svcF.ledger.submitReport({
      claimId: gen.claim.claim_id, reviewerId,
      digest: createHash('sha256').update(payloadText).digest('hex'),
      payload: payloadText, verdict: record.record_type, kind: record.record_type, leaseMinutes: 30,
      liveTupleDigest: gen.generation.tuple_digest,
    });
  };
  const makeFixRecord = async (revision) => {
    const fixRecord = JSON.parse(JSON.stringify(await loadExampleJson('fix-response.json')));
    fixRecord.assignment_id = assignmentF900;
    fixRecord.finding_ids = ['F-900'];
    fixRecord.fix_revision = revision;
    fixRecord.claimed_by = 'cc-executor/mechanism-lane';
    fixRecord.change_review_receipt = changeReviewReceipt('reviewer-z', revision);
    return fixRecord;
  };
  const fixRecord = await makeFixRecord('fix-900');
  await submitLifecycleRecord(fixRecord, 'f');
  const tFix = makePublisherTransport();
  const dFix = await svcF.drainOutbox({ publisherTransport: tFix.fetchJson });
  const fixEntry = dFix.find((r) => r.action === 'fix-recorded');
  const fixOcc = svcF.ledger.listOpenFindings().find((o) => o.finding_key === 'F-900');
  if (!fixEntry || fixOcc?.state !== 'VERIFYING' || tFix.checkRuns.length !== 0) {
    fail(`fix record consumption entry=${JSON.stringify(fixEntry)} occ=${fixOcc?.state} runs=${tFix.checkRuns.length}`);
  } else log('ok v2-fix-response-consumed');

  // SP-2 RED: the consumer must mint the independent change_review receipt FROM the
  // record (actor = the review's reviewer, on the fix revision) — today the field is
  // dropped and no such receipt exists.
  const occReceipts = () => svcF.ledger.receiptsFor(fixOcc.id);
  const crRow = occReceipts().filter((r) => r.kind === 'change_review').at(-1);
  if (!crRow || crRow.actor !== 'reviewer-z' || crRow.revision !== 'fix-900') fail(`independent review receipt actor=${crRow?.actor} rev=${crRow?.revision}`);
  else log('ok fix-record-carries-independent-review');

  // SP-2: a closure record is the Dot-side closure ITSELF — the consumer mints the
  // dot_closure receipt from the record (with evidence/comparison_basis/rationale)
  // and the SHARED closure gate decides. A closure naming a revision that is not the
  // latest fix stays pending with that reason.
  const makeClosureRecord = async (over = {}) => {
    const closureRecord = JSON.parse(JSON.stringify(await loadExampleJson('closure-receipt.json')));
    closureRecord.finding_ids = ['F-900'];
    closureRecord.disposition = 'RESOLVED';
    return { ...closureRecord, ...over };
  };
  const earlyClo = await makeClosureRecord({ verification_revision: 'fix-wrong', verified_by: 'dot/astra-primary' });
  await submitLifecycleRecord(earlyClo, '6', 777001);
  const tEarly = makePublisherTransport();
  const dEarly = await svcF.drainOutbox({ publisherTransport: tEarly.fetchJson });
  const earlyEntry = dEarly.find((r) => r.action === 'kept-pending');
  if (!earlyEntry || earlyEntry.code !== 'E_NOT_RESOLVABLE' || !/revision/.test(earlyEntry.reason ?? '')) fail(`unproven closure ${JSON.stringify(dEarly)}`);
  else log('ok unproven-closure-stays-pending');

  // the executor's own closure attempt cannot close the finding. R3-1: through
  // the REAL consumer path the refusal is the IDENTITY one — the executor
  // principal submitting a closure claims a verified_by the verifier registry
  // does not carry for them (the intake refuses the same shape with E_ROLE; the
  // gate's own independence check remains the defense-in-depth backstop)
  const selfClo = await makeClosureRecord({ verification_revision: 'fix-900', verified_by: 'dot/astra-primary' });
  await submitLifecycleRecord(selfClo, '7', 666001);
  const dSelf = await svcF.drainOutbox({ publisherTransport: makePublisherTransport().fetchJson });
  const selfEntry = dSelf.find((r) => r.action === 'kept-pending');
  if (!selfEntry || selfEntry.code !== 'E_IDENTITY' || !/cannot grant identity/.test(selfEntry.reason ?? '')) fail(`self closure ${JSON.stringify(dSelf)}`);
  else log('ok executor-self-closure-refused');

  // cold-review fix 1: a fix_response submitted after the tuple MOVED still reaches
  // the lifecycle — DR-R3 archival is not effect-dropping; the closure gate (not the
  // drain) is what refuses unproven evidence. The assigned occurrence is the one the
  // active claim (single corrective owner per scope) already holds.
  const claimedOccId = svcF.ledger.lineage('F-900')[0].id;
  const lateFixRecord = await makeFixRecord('9999999999999999999999999999999999999999');
  const movedDigest = 'f'.repeat(64);
  const lateFixGen = svcF.ledger.claimGeneration({ tuple: coordTuple('g'), reviewerId: 666001, maxAttemptsPerTuple: 40, leaseMinutes: 30 });
  const lateFixPayload = JSON.stringify(lateFixRecord);
  const lateFixSub = svcF.ledger.submitReport({
    claimId: lateFixGen.claim.claim_id, reviewerId: 666001,
    digest: createHash('sha256').update(lateFixPayload).digest('hex'),
    payload: lateFixPayload, verdict: 'fix_response', kind: 'fix_response', leaseMinutes: 30,
    liveTupleDigest: movedDigest,
  });
  if (lateFixSub.superseded !== true) fail(`late fix submit expected superseded: ${JSON.stringify(lateFixSub)}`);
  const tLateFix = makePublisherTransport();
  const dLateFix = await svcF.drainOutbox({ publisherTransport: tLateFix.fetchJson });
  const lateFixEntry = dLateFix.find((r) => r.action === 'fix-recorded');
  const claimedAfter = svcF.ledger.getOccurrence(claimedOccId);
  if (!lateFixEntry || claimedAfter?.state !== 'VERIFYING') {
    fail(`superseded fix record dropped: entry=${JSON.stringify(dLateFix.map((r) => [r.event, r.action]))} occ=${claimedAfter?.state}`);
  } else log('ok superseded-fix-record-still-consumed');

  // ── R3-2: the closure chain through the REAL trusted boundaries ───────────────
  // (1) TRUSTED mechanical evidence: the HMAC-verified check_run webhook event
  // (the intake verifies the signature before such an event is ever enqueued)
  // lands a source:'github-webhook' receipt on the fix revision.
  state = { ...v2State(), ...coordTuple('9') };
  state.checks = CHECKS().map(c => ({ ...c, sha: c.context === 'ci-success' ? state.tested_merge_sha : state.head_sha }));
  svcF.ledger.outboxEnqueue('github.event', {
    event: 'check_run',
    payload: { repository: { id: 1231007068 }, delivery_id: 'dl-f900', check_run: { app: { id: 15368 }, name: 'dot-gate suites', conclusion: 'success', head_sha: '9999999999999999999999999999999999999999', id: 9001, html_url: 'fixture/run/9001' } },
  }, 'delivery:check-f900');
  const tWebhook = makePublisherTransport();
  const dWebhook = await svcF.drainOutbox({ publisherTransport: tWebhook.fetchJson });
  const webhookRow = svcF.ledger.receiptsFor(claimedOccId).filter((r) => r.kind === 'check_receipt').at(-1);
  if (!dWebhook.some((r) => r.action === 'check-run-recorded') || webhookRow?.revision !== '9999999999999999999999999999999999999999' || !/github-webhook/.test(webhookRow?.payload ?? '')) {
    fail(`trusted check receipt ${JSON.stringify(dWebhook)} row=${JSON.stringify(webhookRow?.payload)}`);
  } else log('ok r32-webhook-check-receipt-trusted');

  // (2) the executor-supplied change_review (canonical shape, NO verdict) cannot
  // affirm — even with the trusted check green, closure holds on the missing
  // AUTHENTICATED outcome.
  const midClo = await makeClosureRecord({ verification_revision: '9999999999999999999999999999999999999999', verified_by: 'dot/astra-primary' });
  await submitLifecycleRecord(midClo, 'a', 777001);
  const tMid = makePublisherTransport();
  const dMid = await svcF.drainOutbox({ publisherTransport: tMid.fetchJson });
  const midEntry = dMid.find((r) => r.action === 'kept-pending');
  if (!midEntry || midEntry.code !== 'E_NOT_RESOLVABLE' || !/authenticated outcome/.test(midEntry.reason ?? '')) {
    fail(`executor review cannot affirm ${JSON.stringify(dMid)}`);
  } else log('ok r32-executor-review-cannot-affirm-closure');

  // (3) the AUTHENTICATED reviewer submission is the structured outcome: a
  // canonical FOLLOW_UP review_report (verdict.outcome GO, receipt naming F-900 on
  // the fix revision) — the consumer mints the verdict-bearing change_review
  // receipt bound to the artifact digest and the reviewed revision.
  const followUpGo = {
    ...JSON.parse(JSON.stringify(await loadExampleJson('follow-up.json'))),
    verdict: { outcome: 'GO', rationale: 'targeted follow-up confirms F-900 corrected at this revision', blockers: [] },
    findings: [],
    change_review_receipt: { ...changeReviewReceipt('reviewer-z', '9999999999999999999999999999999999999999'), finding_ids: ['F-900'] },
  };
  await submitLifecycleRecord(followUpGo, '9', 555001);
  const tFollow = makePublisherTransport();
  const dFollow = await svcF.drainOutbox({ publisherTransport: tFollow.fetchJson });
  const goReceipt = svcF.ledger.receiptsFor(claimedOccId).filter((r) => r.kind === 'change_review' && /authenticated-review-report/.test(r.payload)).at(-1);
  if (!dFollow.length || !goReceipt || JSON.parse(goReceipt.payload).verdict !== 'GO' || goReceipt.revision !== '9999999999999999999999999999999999999999') {
    fail(`authenticated outcome receipt ${JSON.stringify(dFollow.map((r) => r.action))} row=${JSON.stringify(goReceipt?.payload)}`);
  } else log('ok r32-authenticated-review-outcome-recorded');

  // SP-2 GREEN chain complete: fix → trusted webhook check → authenticated GO →
  // the closure record's OWN evidence mints the dot_closure receipt → RESOLVED.
  // No recordReceipt call happens anywhere between the submits and this resolution.
  const greenClo = await makeClosureRecord({ verification_revision: '9999999999999999999999999999999999999999', verified_by: 'dot/astra-primary', rationale: 'closure recorded after the authenticated follow-up GO (distinct bytes: a duplicate payload would replay, never re-consume)' });
  await submitLifecycleRecord(greenClo, '8', 777001);
  const tClo = makePublisherTransport();
  const dClo = await svcF.drainOutbox({ publisherTransport: tClo.fetchJson });
  const resolvedOcc = svcF.ledger.getOccurrence(claimedOccId);
  const receiptsAfter = svcF.ledger.receiptsFor(claimedOccId);
  const mintedClosure = receiptsAfter.filter((r) => r.kind === 'dot_closure').at(-1);
  const closureRows = receiptsAfter.filter((r) => r.kind === 'closure');
  if (!dClo.some((r) => r.action === 'closure-recorded') || resolvedOcc?.state !== 'RESOLVED' || tClo.checkRuns.length !== 0) {
    fail(`closure chain ${JSON.stringify(dClo)} occ=${resolvedOcc?.state} runs=${tClo.checkRuns.length}`);
  } else if (!mintedClosure || mintedClosure.actor !== 'dot/astra-primary' || mintedClosure.revision !== '9999999999999999999999999999999999999999') {
    fail(`minted dot_closure actor=${mintedClosure?.actor} rev=${mintedClosure?.revision}`);
  } else {
    const mintedPayload = JSON.parse(mintedClosure.payload);
    if (!Array.isArray(mintedPayload.evidence) || mintedPayload.evidence.length === 0 || !mintedPayload.comparison_basis || !mintedPayload.rationale) {
      fail(`minted closure dropped the record's own evidence: ${JSON.stringify(mintedPayload).slice(0, 160)}`);
    } else if (closureRows.at(-1)?.actor !== 'dot/astra-primary') {
      fail(`resolving closure verifier=${closureRows.at(-1)?.actor}`);
    } else log('ok v2-closure-record-resolves-lineage');
  }

  // unknown events stay pending — never consumed without their required action
  svcF.ledger.outboxEnqueue('github.event', { event: 'push' }, 'gh:test-1');
  svcF.ledger.outboxEnqueue('mystery.event', {}, 'mystery:1');
  const dUn = await svcF.drainOutbox({ publisherTransport: makePublisherTransport().fetchJson });
  if (dUn.filter((r) => r.action === 'unhandled').length < 2 || svcF.ledger.counts().outbox_pending < 2) {
    fail(`unhandled routing ${JSON.stringify(dUn)} pending=${svcF.ledger.counts().outbox_pending}`);
  } else log('ok unknown-events-stay-pending');

  // ── SP-7 / Dot D2065-S03 through the REAL consumer ────────────────────────────
  // A fix record's mechanical_receipts become check receipts ON the fix revision;
  // the closure consumer must evaluate the policy's head-bound context set PER
  // CHECK IDENTITY — a passing lint receipt recorded after a failing tests receipt
  // (both inside ONE record) must NOT resolve the finding. Records only, no
  // direct receipt injection.
  const V2_POLICY_2CTX = makePolicyFixture({
    protocol_version: 'dot-pr-review/2.0.0', schema_v2_sha256: V2_SCHEMA_SHA256,
    mechanical_contexts: [
      { context: 'ci/tests', expected_app_id: 15368, bound_to: 'head', workflow_path: '.github/workflows/audit-self.yml' },
      { context: 'ci/lint', expected_app_id: 15368, bound_to: 'head', workflow_path: '.github/workflows/audit-self.yml' },
    ],
  });
  const v2Policy2DigestOf = policyDigestOf(V2_POLICY_2CTX);
  const svcG = await newService({ schemaBytesV2: V2_SCHEMA_BYTES, policyText: JSON.stringify(V2_POLICY_2CTX) });
  const coordTupleG = (headChar) => ({ repository_id: 1231007068, pr_node_id: 'PR_kwDOM9YQhs6AbCdEfGh', base_ref: 'staging', base_sha: sha('b'), head_sha: sha(headChar), merge_base_sha: sha('a'), tested_merge_sha: sha('d'), policy_sha256: v2Policy2DigestOf, protocol_version: 'dot-pr-review/2.0.0' });
  const submitRecordG = async (record, headChar, reviewerId = 666001) => {
    const revision = record.fix_revision ?? record.verification_revision ?? record.change_review_receipt?.reviewed_revision;
    if (typeof revision === 'string' && /^[0-9a-f]{40}$/.test(revision)) headChar = revision[0];
    const priorChecks = state.head_sha === sha(headChar) ? state.checks : null;
    state = { ...v2State(), ...coordTupleG(headChar) };
    state.checks = priorChecks ?? V2_POLICY_2CTX.mechanical_contexts.map(c => ({ context: c.context, app_id: c.expected_app_id, workflow_path: c.workflow_path, workflow_sha: sha('f'), sha: state.head_sha, conclusion: 'success', run_id: 101, run_attempt: 1, run_started_at: '2026-10-05T11:00:00Z' }));
    const gen = svcG.ledger.claimGeneration({ tuple: coordTupleG(headChar), reviewerId, maxAttemptsPerTuple: 40, leaseMinutes: 30, changedFiles: ['packages/core/principles/44-x.test.ts'] });
    if (record.record_type === 'review_report') record = makeV2Review({ ...record, review_identity: { ...record.review_identity, assignment_id: gen.claim.claim_id, repository: { id: 1231007068, full_name: 'artyhoo/getff' }, pull_request: { number: 2042, node_id: state.pr_node_id }, revisions: { ...record.review_identity.revisions, head_sha: state.head_sha, base_sha: state.base_sha, merge_base_sha: state.merge_base_sha, tested_merge_sha: state.tested_merge_sha }, policy: { version: '2026-10-05.1', sha256: v2Policy2DigestOf, epoch: 1 } }, scope: { changed_paths: [{ path: 'packages/core/principles/44-x.test.ts', treatment: 'SYSTEM_ANALYZED', rationale: 'bounded fix verified' }], omissions: [] } });
    const payloadText = JSON.stringify(record);
    return svcG.ledger.submitReport({
      claimId: gen.claim.claim_id, reviewerId,
      digest: createHash('sha256').update(payloadText).digest('hex'),
      payload: payloadText, verdict: record.record_type, kind: record.record_type, leaseMinutes: 30,
      liveTupleDigest: gen.generation.tuple_digest,
    });
  };
  const fixRecordG = async (assignmentId, findingKey, revision, receipts) => {
    const fixRecord = JSON.parse(JSON.stringify(await loadExampleJson('fix-response.json')));
    fixRecord.assignment_id = assignmentId;
    fixRecord.finding_ids = [findingKey];
    fixRecord.fix_revision = revision;
    fixRecord.claimed_by = 'cc-executor/mechanism-lane';
    fixRecord.mechanical_receipts = receipts;
    fixRecord.change_review_receipt = { ...changeReviewReceipt('reviewer-z', revision), finding_ids: [findingKey] };
    return fixRecord;
  };
  const closureRecordG = async (findingKey, revision) => {
    const closureRecord = JSON.parse(JSON.stringify(await loadExampleJson('closure-receipt.json')));
    closureRecord.finding_ids = [findingKey];
    closureRecord.disposition = 'RESOLVED';
    closureRecord.verification_revision = revision;
    closureRecord.verified_by = 'dot/astra-primary';
    return closureRecord;
  };
  // R3-2/§11: TRUSTED check evidence arrives as a (post-HMAC) check_run event
  const trustedCheckG = (context, conclusion, headSha) => {
    state.checks = state.checks.map(c => c.context === context ? { ...c, conclusion, sha: headSha } : c);
    svcG.ledger.outboxEnqueue('github.event', {
      event: 'check_run',
      payload: { repository: { id: 1231007068 }, check_run: { app: { id: 15368 }, name: context, conclusion, head_sha: headSha, id: 1 } },
    }, `delivery:g-${context}-${conclusion}-${headSha}`);
  };
  // the SP-7 findings are seeded through REAL report chains so the occurrences
  // carry the PR scope the trusted webhook binding resolves against
  const seedScopedG = (key, tupleHead) => {
    const gen = svcG.ledger.claimGeneration({ tuple: coordTupleG(tupleHead), reviewerId: 555001, maxAttemptsPerTuple: 40, leaseMinutes: 30 });
    const payloadText = JSON.stringify({ probe: key });
    const rec = svcG.ledger.submitReport({
      claimId: gen.claim.claim_id, reviewerId: 555001,
      digest: createHash('sha256').update(payloadText).digest('hex'),
      payload: payloadText, verdict: 'REVISE', kind: 'admission', leaseMinutes: 30,
      liveTupleDigest: gen.generation.tuple_digest,
    });
    svcG.ledger.recordFindings(rec.report_id, [v2Finding(key, { key })]);
  };
  seedScopedG('F-S7A', 'p');
  const assignG = svcG.ledger.claimFinding({ findingKey: 'F-S7A', owner: 'cc-executor/mechanism-lane', leaseMinutes: 30, nowMs: clock + 900_000 }).assignment_id;

  // the counterexample: one record carries tests FAILURE then lint SUCCESS — the
  // consumer must hold the closure and name the failing required context. The
  // qualifying evidence is the TRUSTED webhook pair on the fix revision (the
  // record's own assertions stay visible but never qualify).
  await submitRecordG(await fixRecordG(assignG, 'F-S7A', '6666666666666666666666666666666666666666', [
    { context: 'ci/tests', conclusion: 'failure', reference: 'run 1/job/tests' },
    { context: 'ci/lint', conclusion: 'success', reference: 'run 1/job/lint' },
  ]), 'h');
  await svcG.drainOutbox({ publisherTransport: makePublisherTransport().fetchJson });
  trustedCheckG('ci/tests', 'failure', '6666666666666666666666666666666666666666');
  trustedCheckG('ci/lint', 'success', '6666666666666666666666666666666666666666');
  await svcG.drainOutbox({ publisherTransport: makePublisherTransport().fetchJson });
  await submitRecordG(await closureRecordG('F-S7A', '6666666666666666666666666666666666666666'), 'i', 777001);
  const dG1 = await svcG.drainOutbox({ publisherTransport: makePublisherTransport().fetchJson });
  const g1Entry = dG1.find((r) => r.action === 'kept-pending');
  if (dG1.some((r) => r.action === 'closure-recorded')) {
    fail(`sp7-consumer-mixed-contexts resolved on a passing unrelated check: ${JSON.stringify(dG1)}`);
  } else if (!(g1Entry && g1Entry.code === 'E_NOT_RESOLVABLE' && /ci\/tests/.test(g1Entry.reason ?? ''))) {
    fail(`sp7-consumer-mixed-contexts wrong refusal ${JSON.stringify(dG1)}`);
  } else log('ok sp7-consumer-mixed-contexts-refuses');

  // control: all required contexts green (TRUSTED receipts) + the AUTHENTICATED
  // follow-up GO resolve through the consumer. F-S7A's occurrence stays open (its
  // trusted tests receipt is RED) — the coordinator releases the PR scope by an
  // explicit revoke before the control block claims F-S7B.
  svcG.ledger.revokeClaim({ assignmentId: assignG, reason: 'SP-7 control block: coordinator reconciled F-S7A and releases the scope' });
  seedScopedG('F-S7B', 'q');
  const assignG2 = svcG.ledger.claimFinding({ findingKey: 'F-S7B', owner: 'cc-executor/mechanism-lane', leaseMinutes: 30, nowMs: clock + 900_000 }).assignment_id;
  await submitRecordG(await fixRecordG(assignG2, 'F-S7B', '7777777777777777777777777777777777777777', [
    { context: 'ci/tests', conclusion: 'success', reference: 'run 2/job/tests' },
    { context: 'ci/lint', conclusion: 'success', reference: 'run 2/job/lint' },
  ]), 'j');
  await svcG.drainOutbox({ publisherTransport: makePublisherTransport().fetchJson });
  trustedCheckG('ci/tests', 'success', '7777777777777777777777777777777777777777');
  trustedCheckG('ci/lint', 'success', '7777777777777777777777777777777777777777');
  await svcG.drainOutbox({ publisherTransport: makePublisherTransport().fetchJson });
  const followUpG2 = {
    ...JSON.parse(JSON.stringify(await loadExampleJson('follow-up.json'))),
    verdict: { outcome: 'GO', rationale: 'targeted follow-up confirms F-S7B corrected at this revision', blockers: [] },
    findings: [],
    change_review_receipt: { ...changeReviewReceipt('reviewer-z', '7777777777777777777777777777777777777777'), finding_ids: ['F-S7B'] },
  };
  await submitRecordG(followUpG2, 'n', 555001);
  await svcG.drainOutbox({ publisherTransport: makePublisherTransport().fetchJson });
  await submitRecordG(await closureRecordG('F-S7B', '7777777777777777777777777777777777777777'), 'k', 777001);
  await svcG.drainOutbox({ publisherTransport: makePublisherTransport().fetchJson });
  if (svcG.ledger.listOpenFindings().some((o) => o.finding_key === 'F-S7B')) fail('sp7-consumer-all-success: full evidence did not resolve');
  else log('ok sp7-consumer-all-required-success-resolves');

  // ── R3-1 at the consumer: the payload cannot grant identity ───────────────────
  // A fix record naming a claimed_by that is NOT the authenticated executor's
  // registry label stays pending with E_IDENTITY — even though the assignment
  // owner matches the claim verbatim.
  svcG.ledger.recordFindings('rep-r31', [v2Finding('F-ID1', { key: 'F-ID1' })]);
  const assignId1 = svcG.ledger.claimFinding({ findingKey: 'F-ID1', owner: 'cc-executor/mechanism-lane', leaseMinutes: 30, nowMs: clock + 900_000 }).assignment_id;
  const impersonatorFix = await fixRecordG(assignId1, 'F-ID1', 'fix-id1', []);
  impersonatorFix.claimed_by = 'cc-executor/impersonator';
  await submitRecordG(impersonatorFix, 'l');
  const dId1 = await svcG.drainOutbox({ publisherTransport: makePublisherTransport().fetchJson });
  const id1Entry = dId1.find((r) => r.action === 'kept-pending');
  if (!id1Entry || id1Entry.code !== 'E_IDENTITY' || !/impersonator/.test(id1Entry.reason ?? '')) {
    fail(`consumer executor identity ${JSON.stringify(dId1)}`);
  } else log('ok r31-consumer-payload-cannot-grant-executor');

  // a closure naming a verified_by the authenticated verifier principal does not
  // carry refuses the same way
  svcG.ledger.recordFindings('rep-r31', [v2Finding('F-ID2', { key: 'F-ID2' })]);
  const impersonatorClosure = await closureRecordG('F-ID2', 'fix-nowhere');
  impersonatorClosure.verified_by = 'dot/impersonator';
  await submitRecordG(impersonatorClosure, 'm', 777001);
  const dId2 = await svcG.drainOutbox({ publisherTransport: makePublisherTransport().fetchJson });
  const id2Entry = dId2.find((r) => r.action === 'kept-pending');
  if (!id2Entry || id2Entry.code !== 'E_IDENTITY' || !/impersonator/.test(id2Entry.reason ?? '')) {
    fail(`consumer verifier identity ${JSON.stringify(dId2)}`);
  } else log('ok r31-consumer-payload-cannot-grant-verifier');
  await svcG.close();

  // ── SP-4: a later GO does not erase the journal's open blocking findings ──────
  // svcF still holds F-901 OPEN (blocking) from the superseded report; an
  // authorizing GO on the same PR must NOT publish the success check over it —
  // the drain keeps the publication pending naming the finding.
  state = v2State();
  const claimSP4 = await call(baseF, cookieF, '/claim', {});
  if (claimSP4.status !== 200) fail(`sp4 claim ${claimSP4.status} ${JSON.stringify(claimSP4.json).slice(0, 120)}`);
  const goSP4 = await call(baseF, cookieF, '/submit', { claim_id: claimSP4.json.claim_id, generation: claimSP4.json.generation, report: v2Live({}, claimSP4.json.claim_id) });
  if (goSP4.status !== 200) fail(`sp4 go submit ${goSP4.status} ${JSON.stringify(goSP4.json).slice(0, 140)}`);
  const tSP4 = makePublisherTransport();
  const dSP4 = await svcF.drainOutbox({ publisherTransport: tSP4.fetchJson });
  const sp4Entry = dSP4.find((r) => r.action === 'kept-pending');
  if (tSP4.checkRuns.some((c) => c.conclusion === 'success')) {
    fail(`sp4 published success over open F-901: ${JSON.stringify(tSP4.checkRuns.map((c) => [c.conclusion, c.head_sha]))}`);
  } else if (!(sp4Entry && sp4Entry.code === 'E_OPEN_BLOCKING' && /F-901/.test(sp4Entry.reason ?? ''))) {
    fail(`sp4 wrong refusal ${JSON.stringify(dSP4)}`);
  } else log('ok sp4-open-blocking-lineage-holds-publication');

  // ── R4 (cold review): the authenticated outcome is the REVIEWER channel ──────
  // The intake refuses non-reviewer review reports at the boundary; this backstop
  // covers the DIRECT-LEDGER path — a report row whose reviewer_id is not an
  // enrolled reviewer mints NO verdict-bearing change_review receipt, whoever
  // claims its generation. F-901 (open) is the receipt target. Runs LAST: its
  // drains re-claim every pending event, and the released claim leases must not
  // reorder any earlier arm's expectations.
  const receiptsAuthCount = () => svcF.ledger.receiptsFor(svcF.ledger.lineage('F-901').at(-1).id).filter((r) => r.kind === 'change_review' && /authenticated-review-report/.test(r.payload)).length;
  const goNamingF901 = (rationale, shaHex) => v2Live({
    verdict: { outcome: 'GO', rationale, blockers: [] },
    findings: [],
    change_review_receipt: {
      artifact_reference: 'review-artifacts/pre-pr-2056.json',
      artifact_sha256: shaHex,
      reviewer: 'change-reviewer/cc-implementation-session',
      independence: 'Reviewer session has no merge authority and did not author the change.',
      limits: ['Session-local evidence; no installed-consumer run.'],
      reviewed_revision: sha('c'),
      comparison_basis: 'head-vs-merge-candidate follow-up receipt',
      reviewed_scope: ['scripts/dot-review-gate/intake.mjs'],
      finding_ids: ['F-901'],
      resolutions: [],
    },
  }, 'assign-r4');
  const rogueBefore = receiptsAuthCount();
  await submitLifecycleRecord(goNamingF901('self-affirmation attempt by the fix owner', 'a'.repeat(64)), 'j', 666001, { changedFiles: ['packages/core/principles/44-x.test.ts'] });
  const dRogue = await svcF.drainOutbox({ publisherTransport: makePublisherTransport().fetchJson, limit: 200 });
  if (receiptsAuthCount() !== rogueBefore) fail(`executor GO minted a verdict receipt: ${JSON.stringify(dRogue.map((r) => r.action))}`);
  else log('ok r32-review-outcome-reviewer-only');

  // a GO held from publication stays pending and REDELIVERS on the next drain
  // (at-least-once over the open-blocking hold) — the verdict receipt is minted
  // ONCE, never once per delivery
  // Explicitly end the prior worker before assigning the remaining scoped finding.
  svcF.ledger.revokeClaim({ assignmentId: assignmentF900, reason: 'fixture worker cessation recorded before F-901 correction' });
  const pendingFix = svcF.ledger.claimFinding({ findingKey: 'F-901', owner: 'cc-executor/mechanism-lane', leaseMinutes: 30, nowMs: clock + 900_000 });
  svcF.ledger.recordFixResponse({ assignmentId: pendingFix.assignment_id, fencingToken: pendingFix.fencing_token, fixRevision: sha('c'), digest: 'pending-f901', payload: '{}' });
  await submitLifecycleRecord(goNamingF901('legitimate reviewer follow-up, redelivery-bounded', 'b'.repeat(64)), 'k', 555001, { changedFiles: ['packages/core/principles/44-x.test.ts'] });
  const dHold = await svcF.drainOutbox({ publisherTransport: makePublisherTransport().fetchJson, limit: 200 });
  const heldAgain = (d) => d.filter((r) => r.action === 'kept-pending' && r.code === 'E_OPEN_BLOCKING' && /F-901/.test(r.reason ?? ''));
  if (heldAgain(dHold).length < 1) fail(`hold precondition: the GO did not stay pending ${JSON.stringify(dHold.map((r) => [r.action, r.code]))}`);
  else if (receiptsAuthCount() < 1) fail('reviewer GO minted no receipt at all — backstop over-refuses');
  else {
    const countHold = receiptsAuthCount();
    clock += 6 * 60 * 1000; // past the drain's 5-min claim lease — the held GOs redeliver
    const dAgain = await svcF.drainOutbox({ publisherTransport: makePublisherTransport().fetchJson, limit: 200 });
    if (heldAgain(dAgain).length < 2) fail(`redelivery did not re-deliver the held GOs ${JSON.stringify(dAgain.map((r) => [r.action, r.code, String(r.reason).slice(0, 120)]))}`);
    else if (receiptsAuthCount() !== countHold) fail(`redelivery duplicated receipts ${countHold} -> ${receiptsAuthCount()}`);
    else log('ok r32-review-outcome-redelivery-no-duplicate');
  }

  await svcF.close();

  await svc.close();
} catch (e) {
  fail(`unexpected: ${e.stack?.split('\n').slice(0, 2).join(' | ')}`);
} finally {
  for (const s of live) await s.close();
}
NODE

# shellcheck disable=SC1091
source "$DIR/suite-harness.sh"
out="$(node "$SCRIPT" \
  "$DIR/service.mjs" \
  "$(cd "$DIR/../.." && pwd)/tests/dot-review-gate/fixtures/make-admission.mjs" \
  "$DIR/validate-report.mjs" \
  "$(cd "$DIR/../.." && pwd)/docs/meta-factory/dot-review-result.schema.json" \
  "$(cd "$DIR/../.." && pwd)/tests/dot-review-gate/fixtures/v2/make-v2.mjs" \
  "$TMP" 2>&1)"; status=$?
assert_suite_arms "service.test.sh" "$status" "$out" \
  startup-unresolved-policy-refused e2e-publish-once re-drain-no-second-check \
  red-mechanics-stop-claims state-outage-stops-claims lease-frees-claim-slot \
  expiry-stops-claims expiry-stops-publication pause-stops-claims-and-publication \
  unpause-resumes restart-drains-single-publication concurrent-drains-single-check \
  accept-revise-persisted replay-idempotent forged-envelope-rejected \
  replay-after-movement-existing-receipt revise-publishes-named-failure \
  late-report-persisted-as-history archived-record-never-publishes \
  forged-still-rejected-after-movement \
  memory-ledger-refused memory-allowed-for-fixtures \
  v2-era-startup-requires-pin v2-era-startup-wrong-bytes-refused \
  v2-stitched-envelope-rejected v2-schema-required-field-enforced v2-revise-accepted-persisted \
  v2-revise-publishes-named-failure v2-go-accepted v2-go-authorizes-single-success \
  v2-findings-enter-lifecycle superseded-findings-recorded-as-history \
  v2-fix-response-consumed fix-record-carries-independent-review \
  unproven-closure-stays-pending executor-self-closure-refused \
  superseded-fix-record-still-consumed \
  r32-webhook-check-receipt-trusted r32-executor-review-cannot-affirm-closure \
  r32-authenticated-review-outcome-recorded r32-review-outcome-reviewer-only \
  r32-review-outcome-redelivery-no-duplicate v2-closure-record-resolves-lineage \
  unknown-events-stay-pending \
  sp7-consumer-mixed-contexts-refuses sp7-consumer-all-required-success-resolves \
  r31-consumer-payload-cannot-grant-executor r31-consumer-payload-cannot-grant-verifier \
  sp4-open-blocking-lineage-holds-publication || exit 1
echo "service.test.sh: all green"
