#!/usr/bin/env bash
# Connected lifecycle (ST-R3-3) — the one suite where EVERY component composes with
# the REAL neighbors: the bounded runtime's runner + the durable ledger + the CC
# coordination adapter + the HTTP intake (authentication, HMAC webhook boundary) +
# the service's outbox consumers, on one SQLite journal:
#   discovery → qualification → ONE review dispatch (complete packet) → ACK →
#   the Dot review enters through /claim + /submit (canonical V2 REVISE, findings) →
#   outbox consumer records findings WITH PR scope → coordinator routing issues ONE
#   assignment (trusted packet) → the executor's canonical fix_response via HTTP →
#   negative forms that reach the intake but CANNOT resolve (forged claimed_by →
#   E_IDENTITY kept-pending; executor closure → 403 E_ROLE; closure without trusted
#   evidence → held) → the HMAC-verified check_run webhook (trusted receipt) →
#   the authenticated FOLLOW_UP GO (verdict-bearing change_review) → the verifier's
#   canonical closure → RESOLVED → reconciled ownership (review DONE, zero new
#   coordination rows) → restart/replay leaves the resolution intact.
# Executor-supplied "success" is never authoritative: only the webhook receipt and
# the authenticated review outcome move the gate.
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/dot-connected-test.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

SCRIPT="$TMP/run-connected-arms.mjs"
cat > "$SCRIPT" <<'NODE'
import { generateKeyPairSync, createHash, createHmac } from 'node:crypto';
const [servicePath, runnerPath, ledgerPath, budgetsPath, adapterPath, fixPath, validatorPath, schemaPath, v2fixPath, tmp] = process.argv.slice(2);
const { makeV2Review, V2_SCHEMA_BYTES, V2_SCHEMA_SHA256, loadExample } = await import(v2fixPath);
const { makePolicyFixture, policyDigestOf } = await import(fixPath);
const { createGateService } = await import(servicePath);
const { runCycle } = await import(runnerPath);
const { createBudgets } = await import(budgetsPath);
const { createCcAdapter } = await import(adapterPath);
const { readFileSync } = await import('node:fs');
const schemaBytes = readFileSync(schemaPath);
const sha = (c) => String(c).repeat(40);
const example = (name) => JSON.parse(loadExample(name));

const NODE = 'PR_kwDOM9YQhs6AbCdEfGh';
const REPO = 1231007068;
const LABEL_EXEC = 'cc-executor/mechanism-lane';
const LABEL_VERIFIER = 'dot/astra-primary';
const LOGIN = { 555001: 'dot-reviewer', 666001: 'cc-executor', 777001: 'dot-verifier' };
const F = 'F-CL-1';
const HEAD_REVIEW = sha('c');
const HEAD_FIX = sha('9');
const MERGE = sha('d');

const LIMITS = { max_active_claims: 2, max_attempts_per_tuple: 40, claim_lease_minutes: 120, max_launches_per_window: 10, window_minutes: 60, max_fix_rounds_per_occurrence: 2, max_work_per_pr: 4, coalesce_minutes: 10, max_active_dot_reviews: 1 };
const V2_POLICY = makePolicyFixture({
  protocol_version: 'dot-pr-review/2.0.0', schema_v2_sha256: V2_SCHEMA_SHA256,
  mechanical_contexts: [
    { context: 'dot-gate suites', expected_app_id: 15368, bound_to: 'head', workflow_path: '.github/workflows/audit-self.yml' },
  ],
  limits: LIMITS,
});
const POLICY_TEXT = JSON.stringify(V2_POLICY);
const v2PolicyDigestOf = policyDigestOf(V2_POLICY);

const NOW0 = Date.parse('2026-10-05T12:00:00Z');
let clock = NOW0;
const state = (head) => ({
  repository_id: REPO,
  pr_number: 2042,
  pr_node_id: NODE,
  base_ref: 'staging',
  base_sha: sha('b'),
  head_sha: head,
  merge_base_sha: sha('a'),
  tested_merge_sha: head === HEAD_REVIEW ? MERGE : sha('8'),
  policy_sha256: v2PolicyDigestOf,
  protocol_version: 'dot-pr-review/2.0.0',
  changed_files: ['packages/core/principles/44-x.test.ts'],
  mergeability: 'clean',
  merge_ref_present: true,
  checks: [{ context: 'dot-gate suites', app_id: 15368, sha: head, conclusion: 'success', workflow_path: '.github/workflows/audit-self.yml', workflow_sha: sha('f'), run_id: 101, run_attempt: 1, run_started_at: '2026-10-05T11:00:00Z' }],
});
let world = state(HEAD_REVIEW);
const readState = async () => {
  if (world === null) throw Object.assign(new Error('github unreachable'), { status: 502 });
  return world;
};

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
let principal = 555001;
const oauth = {
  async exchangeCode() { return { access_token: 'tok-1', scope: '' }; },
  async fetchUser() { return { id: principal, login: LOGIN[principal] ?? `user-${principal}` }; },
};
const resolveRunIdentity = async () => ({ workflow_path: '.github/workflows/audit-self.yml', run_id: 101, run_attempt: 1, run_started_at: '2026-10-05T11:00:00Z', workflow_sha: sha('f') });
const publisherApp = { appId: 12345, installationId: 42, privateKeyPem: privateKey.export({ type: 'pkcs1', format: 'pem' }).toString() };

// publisher-side transport: the review publication's check-run writes and reads
function makeTransport() {
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
      const rec = { id: 500 + t.checkRuns.length + 1, ...JSON.parse(opts.body), app: { id: 999999999 } };
      t.checkRuns.push(rec);
      return rec;
    }
    if (url.startsWith('/repos/artyhoo/getff/commits/') && url.includes('/check-runs')) {
      if (opts.headers?.authorization) return { total_count: 0, check_runs: [] };
      // the head-bound context reads at the CURRENT head; nothing binds to the merge
      const src = url.startsWith(`/repos/artyhoo/getff/commits/${MERGE}/`)
        ? []
        : [{ name: 'dot-gate suites', head_sha: world?.head_sha ?? HEAD_REVIEW, conclusion: 'success', app: { id: 15368 } }];
      return { total_count: src.length, check_runs: src };
    }
    if (url === '/repos/artyhoo/getff/git/ref/pull/2042/merge') return { object: { sha: MERGE } };
    if (url === '/repos/artyhoo/getff/pulls/2042') {
      return { state: 'open', draft: false, mergeable_state: 'clean', node_id: NODE, head: { sha: world?.head_sha ?? HEAD_REVIEW }, base: { ref: 'staging', sha: sha('b') } };
    }
    throw new Error(`unexpected transport call ${url}`);
  };
  return t;
}

const live = [];
const LEDGER_PATH = `${tmp}/connected.sqlite`;
async function newService() {
  const svc = await createGateService({
    ledgerPath: LEDGER_PATH, policyText: POLICY_TEXT, schemaBytes,
    schemaBytesV2: V2_SCHEMA_BYTES, oauth, webhookSecret: 'hook-secret',
    readState, resolveRunIdentity, publisherApp, now: () => clock,
  });
  live.push(svc);
  const origClose = svc.close.bind(svc);
  let closed = false;
  svc.close = async () => { if (closed) return; closed = true; await origClose(); };
  return svc;
}

const login = async (base, asPrincipal) => {
  principal = asPrincipal;
  const start = await fetch(`${base}/oauth/start`, { redirect: 'manual' });
  const location = start.headers.get('location') ?? '';
  const startCookie = (start.headers.get('set-cookie') ?? '').split(';')[0];
  const s = new URL(location).searchParams.get('state') ?? '';
  const res = await fetch(`${base}/oauth/callback?code=c&state=${encodeURIComponent(s)}`, { headers: { cookie: startCookie } });
  return (res.headers.get('set-cookie') ?? '').split(';')[0];
};
const call = async (base, cookie, path, body) => {
  const res = await fetch(base + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  return { status: res.status, json };
};
// the REAL webhook boundary: HMAC over the raw body, GitHub delivery headers
const webhook = async (base, delivery, payload) => {
  const body = JSON.stringify(payload);
  const sig = `sha256=${createHmac('sha256', 'hook-secret').update(body).digest('hex')}`;
  const res = await fetch(`${base}/webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-hub-signature-256': sig, 'x-github-delivery': delivery, 'x-github-event': 'check_run' },
    body,
  });
  return { status: res.status, json: await res.json().catch(() => null) };
};
const J = (x) => JSON.stringify(x ?? null);
const submitV2 = async (base, cookie, record) => {
  const claim = await call(base, cookie, '/claim', {});
  if (claim.status !== 200) return { claim };
  // the envelope binding: the record's assignment identity IS the claim it answers
  if (record?.review_identity) record.review_identity.assignment_id = claim.json.claim_id;
  return { claim, res: await call(base, cookie, '/submit', { claim_id: claim.json.claim_id, generation: claim.json.generation, report: record }) };
};
const v2Review = (over = {}) => {
  const reviewIdentity = {
    ...example('follow-up.json').review_identity,
    repository: { id: REPO, full_name: 'artyhoo/getff' },
    pull_request: { number: 2042, node_id: NODE },
    mode: 'OPEN_PR',
    comparison_basis: 'HEAD_TO_MERGE_CANDIDATE',
    revisions: { head_sha: HEAD_REVIEW, base_sha: sha('b'), merge_base_sha: sha('a'), tested_merge_sha: MERGE, current_staging_sha: null },
    policy: { version: '2026-10-05.1', sha256: v2PolicyDigestOf, epoch: 1 },
    issued_at: new Date(clock).toISOString(),
  };
  delete reviewIdentity.supersedes_review_id;
  return makeV2Review({
    scope: { changed_paths: [{ path: 'packages/core/principles/44-x.test.ts', treatment: 'SYSTEM_ANALYZED', rationale: 'gate change reviewed against the base', affected_consumers: ['core'] }], omissions: [] },
    ...over,
    // the caller's review_identity fields win over the computed defaults — the
    // spread above must not shadow this key
    review_identity: { ...reviewIdentity, ...(over.review_identity ?? {}) },
  });
};
const log = (...a) => console.log(...a);
const fail = (m) => { console.log('FAIL ' + m); process.exitCode = 1; };

let svc;
try {
  svc = await newService();
  const base = `http://127.0.0.1:${svc.port}`;
  let ledger = svc.ledger;
  // the runner composes with the SAME journal and its own coordination channel
  const coordDir = `${tmp}/coord`;
  const { mkdirSync, writeFileSync } = await import('node:fs');
  mkdirSync(coordDir, { recursive: true });
  const adapter = createCcAdapter({ ledger, coordinationDir: coordDir, notify: async () => {} });
  const budgets = createBudgets({ ledger, limits: LIMITS });
  const TARGETS = {
    'review-request': { session: 'sess-dot-review' },
    'fix-assignment': { session: 'sess-executor', owner: LABEL_EXEC },
    'verify-request': { session: 'sess-verifier' },
  };
  const resolveTarget = async ({ kind }) => TARGETS[kind] ?? null;
  const pr2042 = { number: 2042, node_id: NODE, draft: false, repository_id: REPO, head_sha: HEAD_REVIEW, base_sha: sha('b'), ready_at: '2026-10-05T10:00:00Z' };
  const discover = async () => ({ openPrs: [pr2042], mergedPrs: [] });
  ledger.insertRegistration({ prNodeId: NODE, prNumber: 2042, coordinator: 'coordinator/test', reconciledAt: '2026-10-05T12:00:00Z' });
  ledger.updateRegistration(NODE, { mergeEnabled: true, operatorTransition: 'operator enrolled the PR for the bounded pilot' });
  const cycle = (over = {}) => runCycle({ ledger, policy: svc.policy, budgets, adapter, discover, resolveTarget, ...over });

  // 1. discovery → qualification → ONE review dispatch, complete packet
  const c1 = await cycle();
  const review = c1.dispatched.find((d) => d.kind === 'review-request');
  const reviewPacket = review ? JSON.parse(ledger.coordGet(review.actionId)?.payload_text ?? '{}') : {};
  if (!review || reviewPacket.mode !== 'OPEN_PR' || reviewPacket.revisions?.head_sha !== HEAD_REVIEW || !reviewPacket.work?.item_key) {
    fail(`review dispatch ${JSON.stringify(c1.dispatched)} ${JSON.stringify(c1.held)}`);
  } else log('ok review-dispatched-with-trusted-packet');

  // 2. ACK is its own transition
  writeFileSync(`${coordDir}/_dot-gate-ack-${review.actionId}.md`, `ACK ${review.actionId}\n`);
  const c2 = await cycle({ discover: async () => ({ openPrs: [], mergedPrs: [] }) });
  if (!c2.acked.includes(review.actionId)) fail(`ack ${JSON.stringify(c2.acked)}`);
  else log('ok ack-transitions-delivered-row');

  // 3. the Dot review enters through the REAL HTTP intake — canonical V2 REVISE
  const REVIEW_ID = '00000000-0000-4000-8000-00000000c002';
  const cookieReviewer = await login(base, 555001);
  const reviseRecord = v2Review({
    review_identity: { review_id: REVIEW_ID },
    verdict: { outcome: 'REVISE', rationale: 'one blocking defect', blockers: [] },
    findings: [{
      finding_id: F, occurrence_id: `O-${F}`, title: 'defect',
      requirement: 'the gate refuses unstaged paths', category: 'correctness', severity: 'critical',
      blocking: true, failure_scenario: 'an unstaged path bypasses the gate',
      locations: ['scripts/dot-review-gate/validate-report.mjs'], affected_consumers: ['core'],
      evidence: [{ level: 'SOURCE_TRACED', reference: 'validate-report.mjs:1', note: null }],
      expected_correction: 'refuse the path', verification_expectation: 'paired negative fails first',
    }],
  });
  const sub = await submitV2(base, cookieReviewer, reviseRecord);
  if (sub.res?.status !== 200 || !sub.res.json?.report_id) fail(`review submit ${sub.res?.status}/${sub.claim?.status} ${J(sub.res?.json ?? sub.claim?.json).slice(0, 600)}`);
  else log('ok dot-review-enters-through-http-intake');

  // 4. the outbox consumer records the findings WITH the PR scope
  const dRev = await svc.drainOutbox({ publisherTransport: makeTransport().fetchJson });
  const occ = ledger.listOpenFindings().find((o) => o.finding_key === F);
  if (!occ || occ.repository_id !== REPO || occ.pr_node_id !== NODE) fail(`findings scope ${JSON.stringify(occ)} ${JSON.stringify(dRev.map((r) => r.action))}`);
  else log('ok drain-records-findings-with-pr-scope');

  // 5. coordinator routing issues ONE assignment — the trusted packet
  const c3 = await cycle({ discover: async () => ({ openPrs: [], mergedPrs: [] }) });
  const fixDispatch = c3.dispatched.find((d) => d.kind === 'fix-assignment');
  const fixPacket = fixDispatch ? JSON.parse(ledger.coordGet(fixDispatch.actionId)?.payload_text ?? '{}') : {};
  if (!fixDispatch || !fixPacket.assignment_id || fixPacket.finding_key !== F || fixPacket.revisions?.head_sha !== HEAD_REVIEW) {
    fail(`routing ${JSON.stringify(c3.dispatched)} ${JSON.stringify(c3.held)}`);
  } else log('ok routing-issues-one-assignment');

  // 6. the executor's canonical fix_response through HTTP — consumed into the
  // lifecycle on the fix revision (the world moved: the fix landed, checks green)
  world = state(HEAD_FIX);
  const cookieExec = await login(base, 666001);
  const fixRecord = { ...example('fix-response.json'), assignment_id: fixPacket.assignment_id, finding_ids: [F], fix_revision: HEAD_FIX, claimed_by: LABEL_EXEC, unresolved_items: [] };
  const fixSub = await submitV2(base, cookieExec, fixRecord);
  if (fixSub.res?.status !== 200 || !fixSub.res.json?.report_id) fail(`fix submit ${fixSub.res?.status}/${fixSub.claim?.status} ${J(fixSub.res?.json ?? fixSub.claim?.json).slice(0, 600)}`);
  const dFix = await svc.drainOutbox({ publisherTransport: makeTransport().fetchJson });
  const afterFix = ledger.getOccurrence(occ.id);
  if (!dFix.some((r) => r.action === 'fix-recorded') || afterFix?.state !== 'VERIFYING') fail(`fix consume ${JSON.stringify(dFix.map((r) => [r.action, r.code]))} occ=${afterFix?.state}`);
  else log('ok fix-record-through-http-consumed');

  // 7. NEGATIVE: the executor's own closure attempt cannot even reach the ledger —
  // the HTTP boundary refuses the role (executor ≠ independent verifier)
  const execClo = { ...example('closure-receipt.json'), finding_ids: [F], verification_revision: HEAD_FIX, verified_by: LABEL_VERIFIER, disposition: 'RESOLVED' };
  const execCloRes = await submitV2(base, cookieExec, execClo);
  if (execCloRes.res?.status !== 403 || execCloRes.res?.json?.code !== 'E_ROLE') fail(`executor closure ${execCloRes.res?.status} ${J(execCloRes.res?.json).slice(0, 300)}`);
  else log('ok executor-closure-refused-at-http-boundary');
  // the refused closure leaves its challenge UNCONSUMED (role refusal — by design,
  // the boundary refuses before consuming); the claim LEASE is what frees the tuple
  // for the next claimant — advance past it, never reset anything
  clock += 121 * 60 * 1000;

  // 8. NEGATIVE: a forged claimed_by cannot even REACH the ledger — the intake
  // binds the record's claimed_by to the ISSUED assignment owner (R3-1 at the
  // boundary); the consumer-side E_IDENTITY backstop stays pinned in
  // service.test.sh for records that arrive through the direct-ledger path
  const forgedFix = { ...fixRecord, claimed_by: LABEL_VERIFIER };
  const forgedSub = await submitV2(base, cookieExec, forgedFix);
  if (forgedSub.res?.status !== 422 || forgedSub.res?.json?.code !== 'E_ENVELOPE' || !/does not match the assignment owner/.test(forgedSub.res?.json?.error ?? '')) {
    fail(`forged fix submit ${forgedSub.res?.status}/${forgedSub.claim?.status} ${J(forgedSub.res?.json ?? forgedSub.claim?.json).slice(0, 300)}`);
  } else if (ledger.receiptsFor(occ.id).some((r) => r.kind === 'fix_response' && /astra/.test(r.actor ?? ''))) {
    fail('forged claimed_by recorded a fix receipt');
  } else log('ok forged-claimed-by-refused-at-intake');
  // the refused forgery also leaves its challenge unconsumed — the lease frees the
  // tuple for the next claimant
  clock += 121 * 60 * 1000;

  // 9. NEGATIVE: closure WITHOUT trusted mechanical evidence reaches the intake,
  // the closure gate holds it — the occurrence is not resolved by an assertion
  const cookieVerifier = await login(base, 777001);
  const earlyClo = { ...example('closure-receipt.json'), finding_ids: [F], verification_revision: HEAD_FIX, verified_by: LABEL_VERIFIER, disposition: 'RESOLVED' };
  const earlySub = await submitV2(base, cookieVerifier, earlyClo);
  if (earlySub.res?.status !== 200) fail(`early closure submit ${earlySub.res?.status}/${earlySub.claim?.status} ${J(earlySub.res?.json ?? earlySub.claim?.json).slice(0, 300)}`);
  const dEarly = await svc.drainOutbox({ publisherTransport: makeTransport().fetchJson });
  const earlyEntry = dEarly.find((r) => r.action === 'kept-pending' && r.code === 'E_NOT_RESOLVABLE');
  if (!earlyEntry || ledger.getOccurrence(occ.id)?.state !== 'VERIFYING') fail(`unproven closure ${JSON.stringify(dEarly.map((r) => [r.action, r.code]))}`);
  else log('ok closure-without-trusted-check-held');

  // 10. TRUSTED mechanical evidence: the HMAC-verified check_run webhook on the
  // fix revision lands the source:'github-webhook' receipt
  const wh = await webhook(base, 'dl-connected-1', {
    repository: { id: REPO },
    check_run: { name: 'dot-gate suites', conclusion: 'success', head_sha: HEAD_FIX, id: 9101, html_url: 'fixture/run/9101' },
  });
  if (wh.status !== 200 || wh.json?.deduplicated === true) fail(`webhook ${wh.status} ${JSON.stringify(wh.json)}`);
  const dWh = await svc.drainOutbox({ publisherTransport: makeTransport().fetchJson });
  const trustedRow = ledger.receiptsFor(occ.id).filter((r) => r.kind === 'check_receipt' && /github-webhook/.test(r.payload ?? '')).at(-1);
  if (!dWh.some((r) => r.action === 'check-run-recorded') || trustedRow?.revision !== HEAD_FIX) fail(`trusted receipt ${JSON.stringify(dWh.map((r) => r.action))} ${JSON.stringify(trustedRow?.payload)}`);
  else log('ok hmac-webhook-lands-trusted-receipt');

  // 11. the AUTHENTICATED outcome: the reviewer's canonical FOLLOW_UP GO mints the
  // verdict-bearing change_review receipt on the finding at the fix revision
  const followUp = v2Review({
    review_identity: {
      ...example('follow-up.json').review_identity,
      review_id: '00000000-0000-4000-8000-00000000c003',
      assignment_id: '00000000-0000-4000-8000-00000000c1001',
      repository: { id: REPO, full_name: 'artyhoo/getff' },
      pull_request: { number: 2042, node_id: NODE },
      mode: 'FOLLOW_UP',
      comparison_basis: 'FOLLOW_UP_DELTA',
      revisions: { head_sha: HEAD_FIX, base_sha: sha('b'), merge_base_sha: sha('a'), tested_merge_sha: sha('8'), current_staging_sha: null },
      policy: { version: '2026-10-05.1', sha256: v2PolicyDigestOf, epoch: 1 },
      issued_at: new Date(clock).toISOString(),
      supersedes_review_id: REVIEW_ID,
    },
    verdict: { outcome: 'GO', rationale: 'correction verified on the fix revision', blockers: [] },
    change_review_receipt: {
      artifact_reference: `diff/${HEAD_FIX}`, artifact_sha256: 'a'.repeat(64),
      reviewer: 'dot-reviewer', independence: 'second reviewer, not the fix owner',
      limits: ['offline fixture review of the bounded fix diff'], reviewed_revision: HEAD_FIX,
      comparison_basis: `head ${HEAD_FIX.slice(0, 8)} vs base ${sha('b').slice(0, 8)}`,
      reviewed_scope: ['scripts/dot-review-gate/validate-report.mjs'],
      scenarios: ['correction verified on the fix revision'],
      finding_ids: [F], resolutions: [], equivalence: null,
    },
  });
  const fuSub = await submitV2(base, cookieReviewer, followUp);
  if (fuSub.res?.status !== 200 || !fuSub.res.json?.report_id) fail(`follow-up submit ${fuSub.res?.status}/${fuSub.claim?.status} ${J(fuSub.res?.json ?? fuSub.claim?.json).slice(0, 600)}`);
  const dFu = await svc.drainOutbox({ publisherTransport: makeTransport().fetchJson });
  const goReceipt = ledger.receiptsFor(occ.id).filter((r) => r.kind === 'change_review' && /authenticated-review-report/.test(r.payload ?? '')).at(-1);
  if (!goReceipt || goReceipt.revision !== HEAD_FIX || !/"verdict":"GO"/.test(goReceipt.payload ?? '')) fail(`authenticated outcome ${JSON.stringify(dFu.map((r) => r.action))} ${JSON.stringify(goReceipt?.payload)}`);
  else log('ok authenticated-follow-up-go-mints-verdict-receipt');

  // 12. the verifier's canonical closure NOW resolves — every gate input is real.
  // The held closure event of step 9 sits under the drain's claim lease; the next
  // drain redelivers it only AFTER the lease — advance past it (at-least-once)
  clock += 6 * 60 * 1000;
  const finalClo = { ...earlyClo };
  const cloSub = await submitV2(base, cookieVerifier, finalClo);
  if (cloSub.res?.status !== 200) fail(`closure submit ${cloSub.res?.status}`);
  const dClo = await svc.drainOutbox({ publisherTransport: makeTransport().fetchJson });
  const resolved = ledger.getOccurrence(occ.id);
  if (!dClo.some((r) => r.action === 'closure-recorded') || resolved?.state !== 'RESOLVED') fail(`closure ${JSON.stringify(dClo.map((r) => [r.action, r.code]))} occ=${resolved?.state}`);
  else log('ok canonical-closure-resolves');

  // 13. reconciled ownership: the cycle dispatches NOTHING — the accepted report
  // resolved the review (DONE), the RESOLVED finding routes to nobody
  const beforeRows = ledger.coordList('INTENT').length + ledger.coordList('DELIVERED').length + ledger.coordList('ACKED').length;
  const cFinal = await cycle({ discover: async () => ({ openPrs: [], mergedPrs: [] }) });
  const reviewState = ledger.coordGet(review.actionId)?.state;
  if (cFinal.dispatched.length !== 0 || reviewState !== 'DONE' || (ledger.coordList('INTENT').length + ledger.coordList('DELIVERED').length + ledger.coordList('ACKED').length) !== beforeRows) {
    fail(`reconcile ${JSON.stringify({ d: cFinal.dispatched, review: reviewState })}`);
  } else log('ok ownership-reconciled-zero-new-dispatches');

  // 14. restart on the SAME journal: nothing republishes, the replayed webhook
  // delivery is deduplicated at the boundary, and a NEW delivery on the RESOLVED
  // finding records nothing — resolved work stops absorbing evidence
  await svc.close();
  svc = await newService();
  // the journal reopens — rebind every consumer to the REOPENED handle
  ledger = svc.ledger;
  const adapter2 = createCcAdapter({ ledger, coordinationDir: coordDir, notify: async () => {} });
  const budgets2 = createBudgets({ ledger, limits: LIMITS });
  const cycle2 = (over = {}) => runCycle({ ledger, policy: svc.policy, budgets: budgets2, adapter: adapter2, discover: async () => ({ openPrs: [], mergedPrs: [] }), resolveTarget, ...over });
  const base2 = `http://127.0.0.1:${svc.port}`;
  const replay = await webhook(base2, 'dl-connected-1', {
    repository: { id: REPO },
    check_run: { name: 'dot-gate suites', conclusion: 'success', head_sha: HEAD_FIX, id: 9101, html_url: 'fixture/run/9101' },
  });
  const fresh = await webhook(base2, 'dl-connected-2', {
    repository: { id: REPO },
    check_run: { name: 'dot-gate suites', conclusion: 'success', head_sha: HEAD_FIX, id: 9102, html_url: 'fixture/run/9102' },
  });
  const dRestart = await svc.drainOutbox({ publisherTransport: makeTransport().fetchJson });
  const trustedCount = ledger.receiptsFor(occ.id).filter((r) => r.kind === 'check_receipt' && /github-webhook/.test(r.payload ?? '')).length;
  const stillResolved = ledger.getOccurrence(occ.id)?.state;
  const cRestart = await cycle2();
  if (replay.json?.deduplicated !== true || fresh.json?.deduplicated === true || trustedCount !== 1
    || stillResolved !== 'RESOLVED' || cRestart.dispatched.length !== 0) {
    fail(`restart/replay ${JSON.stringify({ replay: replay.json, fresh: fresh.json, trustedCount, stillResolved, d: cRestart.dispatched.length })}`);
  } else log('ok restart-replay-leaves-resolution-intact');
} catch (e) {
  fail(`unexpected: ${e.stack?.split('\n').slice(0, 3).join(' | ')}`);
} finally {
  if (svc) await svc.close().catch(() => {});
}
NODE

# shellcheck disable=SC1091
source "$DIR/suite-harness.sh"
out="$(node "$SCRIPT" \
  "$DIR/service.mjs" \
  "$DIR/runner.mjs" \
  "$DIR/ledger.mjs" \
  "$DIR/budgets.mjs" \
  "$DIR/cc-adapter.mjs" \
  "$(cd "$DIR/../.." && pwd)/tests/dot-review-gate/fixtures/make-admission.mjs" \
  "$DIR/validate-report.mjs" \
  "$(cd "$DIR/../.." && pwd)/docs/meta-factory/dot-review-result.schema.json" \
  "$(cd "$DIR/../.." && pwd)/tests/dot-review-gate/fixtures/v2/make-v2.mjs" \
  "$TMP" 2>&1)"; status=$?
assert_suite_arms "connected-lifecycle.test.sh" "$status" "$out" \
  review-dispatched-with-trusted-packet ack-transitions-delivered-row \
  dot-review-enters-through-http-intake drain-records-findings-with-pr-scope \
  routing-issues-one-assignment fix-record-through-http-consumed \
  executor-closure-refused-at-http-boundary forged-claimed-by-refused-at-intake \
  closure-without-trusted-check-held hmac-webhook-lands-trusted-receipt \
  authenticated-follow-up-go-mints-verdict-receipt canonical-closure-resolves \
  ownership-reconciled-zero-new-dispatches restart-replay-leaves-resolution-intact || exit 1
echo "connected-lifecycle.test.sh: all green"
