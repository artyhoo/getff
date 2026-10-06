#!/usr/bin/env bash
# Paired-negative for scripts/dot-review-gate/intake.mjs.
#
# The intake is the untrusted-input boundary: Dot's browser session authenticates via a
# dedicated OAuth App with EMPTY scopes; identity is the server-derived numeric GitHub
# user id; challenges are one-use, tuple-bound, lease-bounded and reviewer-bound (review
# R2); and the submission envelope is strict-parsed from the RAW bytes — the old
# JSON.parse+stringify path collapsed duplicate keys before the strict reader could see
# them (review R8). A live server on an ephemeral port, a real file-backed ledger, a
# stubbed GitHub transport — real HTTP, real crypto, no network beyond localhost.
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/dot-intake-test.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

SCRIPT="$TMP/run-intake-arms.mjs"
cat > "$SCRIPT" <<'NODE'
import { createHmac, createHash, randomUUID } from 'node:crypto';
const [intakePath, ledgerPath, fixPath, validatorPath, schemaPath, v2SchemaPath, fixExamplePath, closureExamplePath, goExamplePath, tmp] = process.argv.slice(2);
const { makeAdmission, makePolicyFixture, policyDigestOf } = await import(fixPath);
const { openLedger, tupleDigest } = await import(ledgerPath);
const { startIntake } = await import(intakePath);
const { validateReport } = await import(validatorPath);
const { readFileSync } = await import('node:fs');
const schemaBytes = readFileSync(schemaPath);

const sha = (c) => String(c).repeat(40);
const REPO_STATE = {
  repository_id: 1231007068,
  pr_number: 2042,
  pr_node_id: 'PR_kwDOM9YQhs6AbCdEfGh',
  base_ref: 'staging',
  base_sha: sha('b'),
  head_sha: sha('c'),
  merge_base_sha: sha('a'),
  tested_merge_sha: sha('d'),
  policy_sha256: policyDigestOf(makePolicyFixture()),
  protocol_version: 'dot-staging-review/1.0',
  changed_files: ['packages/core/principles/44-x.test.ts'],
  mergeability: 'clean',
  merge_ref_present: true,
  checks: [],
};
const NOW0 = Date.parse('2026-10-05T12:00:00Z');
let clock = NOW0;
const GH = {
  async exchangeCode(code) {
    if (code === 'good-code') return { access_token: 'tok-1', scope: '' };
    if (code === 'good-code-2') return { access_token: 'tok-2', scope: '' };
    if (code === 'good-code-exec') return { access_token: 'tok-exec', scope: '' };
    if (code === 'good-code-ver') return { access_token: 'tok-ver', scope: '' };
    throw new Error('bad_code');
  },
  async fetchUser(accessToken) {
    if (accessToken === 'tok-1') return { id: 555001, login: 'dot-reviewer' };
    if (accessToken === 'tok-2') return { id: 555002, login: 'dot-reviewer-2' };
    if (accessToken === 'tok-exec') return { id: 666001, login: 'cc-executor' };
    if (accessToken === 'tok-ver') return { id: 777001, login: 'dot-verifier' };
    throw new Error('bad_token');
  },
  currentState: async () => ({ ...REPO_STATE }),
};
const secret = 'webhook-hmac-secret';

const ledger = openLedger(`${tmp}/intake-ledger.sqlite`);
// SP-3: the intake's validator wires the V2 schema bytes, so the policy must pin
// THEM — an unpinned policy refuses every V2 document at the validator now.
const v2SchemaBytes = readFileSync(v2SchemaPath);
const policy = makePolicyFixture({
  reviewer_principal_ids: [555001, 555002],
  // R3-1 arms consume many same-tuple challenges and refused submissions leave
  // their challenges unconsumed (that is the point — they count as active claims)
  limits: { max_active_claims: 8, max_attempts_per_tuple: 40, claim_lease_minutes: 120 },
  schema_v2_sha256: createHash('sha256').update(v2SchemaBytes).digest('hex'),
});
const server = await startIntake({
  ledger,
  policy,
  oauth: GH,
  webhookSecret: secret,
  validator: (text, extra) => validateReport(text, { schemaBytes, schemaBytesV2: v2SchemaBytes, policy, now: new Date(clock).toISOString(), currentState: extra?.currentState, trustedInventory: extra?.trustedInventory }),
  now: () => clock,
});
const base = `http://127.0.0.1:${server.port}`;
const log = (...a) => console.log(...a);
const fail = (m) => { console.log('FAIL ' + m); process.exitCode = 1; };

let cookie = null;
const call = async (path, { method = 'GET', body, headers = {}, raw } = {}) => {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
    body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  return { status: res.status, json, text };
};
const login = async (code) => {
  const start = await fetch(base + '/oauth/start', { redirect: 'manual' });
  const location = start.headers.get('location') ?? '';
  const startCookie = (start.headers.get('set-cookie') ?? '').split(';')[0];
  const state = new URL(location).searchParams.get('state') ?? '';
  const saved = cookie;
  cookie = startCookie;
  await call(`/oauth/callback?code=${code}&state=${encodeURIComponent(state)}`);
  const session = cookie;
  cookie = saved;
  return session;
};
const envelopeFor = (claim, over = {}) => {
  // the report follows the CURRENT tuple by default — arms that need a stale report
  // build the envelope BEFORE mutating REPO_STATE (see the tuple-drift arm)
  const report = makeAdmission({
    claim_id: claim.claim_id,
    generation: over.reportGeneration ?? claim.generation,
    revision: { head_sha: REPO_STATE.head_sha, tested_merge_sha: REPO_STATE.tested_merge_sha },
    ...(over.report ?? {}),
  });
  if (over.execution) Object.assign(report.execution, over.execution);
  return { claim_id: claim.claim_id, generation: over.envelopeGeneration ?? claim.generation, report };
};

try {
  // GREEN: oauth start redirects with EMPTY scope and sets the CSRF state cookie
  const startRes = await fetch(base + '/oauth/start', { redirect: 'manual' });
  const location = startRes.headers.get('location') ?? '';
  const startCookie = (startRes.headers.get('set-cookie') ?? '').split(';')[0];
  if (startRes.status !== 302 || !location.includes('scope=') || /scope=[^&$]/.test(location)) {
    fail(`authorize redirect ${startRes.status} carries non-empty scope: ${location}`);
  } else if (!startCookie) {
    fail('oauth start set no state cookie');
  } else if (!/;\s*Secure/i.test(startRes.headers.get('set-cookie') ?? '')) {
    fail('oauth state cookie is not Secure');
  } else log('ok oauth-empty-scope');

  const sessionA = await login('good-code');
  const cb = await (async () => { cookie = sessionA; return call('/health'); })();
  cookie = sessionA;
  if (cb.status !== 200) fail(`session A broken: ${cb.status}`);
  else log('ok oauth-callback-session');

  // GREEN: claim issues a challenge bound to the live tuple
  const claim = await call('/claim', { method: 'POST', body: { pr_number: 2042 } });
  if (claim.status !== 200 || !claim.json?.claim_id) fail(`claim ${claim.status} ${claim.text.slice(0, 120)}`);
  else log('ok claim-issued');

  // RED: submit without session → 401
  const savedCookie = cookie;
  cookie = null;
  const anon = await call('/submit', { method: 'POST', body: {} });
  cookie = savedCookie;
  if (anon.status !== 401) fail(`anonymous submit ${anon.status}`);
  else log('ok submit-requires-session');

  // GREEN: forged author field accepted only as an assertion — the LEDGER row binds
  // the authenticated session principal (review R2: envelope ≠ report assertions).
  const report1 = envelopeFor(claim.json, { execution: { reviewer_id: 999999 } });
  const submit = await call('/submit', { method: 'POST', body: report1 });
  if (submit.status !== 200) { fail(`submit ${submit.status} ${submit.text.slice(0, 200)}`); }
  else {
    const row = ledger.getReport(submit.json.report_id);
    if (row.reviewer_id !== 555001) fail(`ledger bound wrong principal: ${row.reviewer_id}`);
    else log('ok envelope-principal-binds-ledger');
    // the ORIGINAL bounded envelope bytes + authenticated provenance are stored
    // alongside the canonical record (round-2 packet)
    const raw1 = JSON.stringify(report1);
    const envDigest = createHash('sha256').update(raw1).digest('hex');
    if (row.envelope_bytes !== raw1 || row.envelope_digest !== envDigest || row.received_via !== 'browser-intake') {
      fail(`provenance bytes=${row.envelope_bytes === raw1} digest=${row.envelope_digest === envDigest} via=${row.received_via}`);
    } else log('ok envelope-bytes-and-provenance-stored');
  }

  // GREEN: replay identical bytes → same receipt
  const replay = await call('/submit', { method: 'POST', body: report1 });
  if (replay.json?.report_id !== submit.json.report_id) fail(`replay receipt ${replay.json?.report_id} vs ${submit.json.report_id}`);
  else log('ok replay-same-receipt');

  // RED: second submission with DIFFERENT (still valid GO) bytes on the consumed
  // claim → 409 — a consumed challenge is payload-bound, verdict-valid or not.
  const evil = envelopeFor(claim.json, { report: { report: { summary: 'tampered after the fact' } } });
  const conflict = await call('/submit', { method: 'POST', body: evil });
  if (conflict.status !== 409) fail(`conflict submit ${conflict.status} ${conflict.text.slice(0, 120)}`);
  else log('ok conflict-rejected');

  // RED (R2): another enrolled principal replays/reaches the same claim → 403,
  // even on the replay path — receipts are not transferable across identities.
  const sessionB = await login('good-code-2');
  cookie = sessionB;
  const foreign = await call('/submit', { method: 'POST', body: report1 });
  cookie = savedCookie;
  if (foreign.status !== 403 || foreign.json?.code !== 'E_REVIEWER') fail(`foreign reviewer ${foreign.status} ${foreign.text.slice(0, 100)}`);
  else log('ok submit-wrong-reviewer-refused');

  // DR-R3: a report issued on gen2 (head 'e') submitted AFTER gen3 superseded the
  // generation → preserved as SUPERSEDED HISTORY (admission false), not refused.
  // The envelope is frozen on the ISSUED tuple, then the state moves on.
  REPO_STATE.head_sha = sha('e');
  const claim2 = await call('/claim', { method: 'POST', body: {} });
  if (claim2.status !== 200) fail(`claim2 ${claim2.status}`);
  const envIssued2 = envelopeFor(claim2.json);
  REPO_STATE.head_sha = sha('f');
  const claim3 = await call('/claim', { method: 'POST', body: {} });
  if (claim3.status !== 200) fail(`claim3 ${claim3.status}`);
  cookie = sessionA;
  const staleGen = await call('/submit', { method: 'POST', body: envIssued2 });
  if (staleGen.status !== 200 || staleGen.json?.superseded !== true || staleGen.json?.admitted !== false) fail(`superseded submit ${staleGen.status} ${staleGen.text.slice(0, 140)}`);
  else log('ok submit-superseded-archived-as-history');

  // RED (R2): envelope asserts a generation that is not the challenged one → 409
  const wrongGen = envelopeFor(claim3.json, { envelopeGeneration: 999999, reportGeneration: 999999 });
  const genMismatch = await call('/submit', { method: 'POST', body: wrongGen });
  if (genMismatch.status !== 409 || genMismatch.json?.code !== 'E_GENERATION') fail(`generation mismatch ${genMismatch.status} ${genMismatch.text.slice(0, 100)}`);
  else log('ok submit-generation-mismatch-refused');

  // RED (R2): expired lease → 410, and the freed slot admits a new claim (R11 lease)
  clock += 121 * 60 * 1000;
  const expired = await call('/submit', { method: 'POST', body: envelopeFor(claim3.json) });
  if (expired.status !== 410 || expired.json?.code !== 'E_LEASE_EXPIRED') fail(`lease ${expired.status} ${expired.text.slice(0, 100)}`);
  else log('ok submit-lease-expired-refused');
  const reclaimed = await call('/claim', { method: 'POST', body: {} });
  if (reclaimed.status !== 200) fail(`expired claim still holds the slot: ${reclaimed.status}`);
  else log('ok claim-lease-frees-slot');

  // DR-R3: live tuple drift without a new claim → the report authenticates against
  // its ISSUED tuple and the ledger archives it as superseded history — the finding
  // record survives the push that made it stale.
  const driftEnvelope = envelopeFor(reclaimed.json);
  REPO_STATE.tested_merge_sha = sha('9');
  const drifted = await call('/submit', { method: 'POST', body: driftEnvelope });
  if (drifted.status !== 200 || drifted.json?.superseded !== true || drifted.json?.admitted !== false) fail(`tuple drift ${drifted.status} ${drifted.text.slice(0, 140)}`);
  else log('ok submit-tuple-drift-archived-as-history');

  // RED (R2): report's inner claim_id disagrees with the envelope → 422
  REPO_STATE.tested_merge_sha = sha('d');
  const inner = envelopeFor(reclaimed.json, { report: { claim_id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301' } });
  const innerMismatch = await call('/submit', { method: 'POST', body: inner });
  if (innerMismatch.status !== 422 || innerMismatch.json?.code !== 'E_ENVELOPE') fail(`inner mismatch ${innerMismatch.status} ${innerMismatch.text.slice(0, 120)}`);
  else log('ok submit-inner-mismatch-refused');

  // RED (R8): duplicate verdict key in the RAW body → the strict envelope parse
  // rejects it; JSON.parse+stringify would have collapsed it to the last value.
  const dupRaw = `{"claim_id":"${reclaimed.json.claim_id}","generation":${reclaimed.json.generation},"report":${JSON.stringify(makeAdmission({ claim_id: reclaimed.json.claim_id, generation: reclaimed.json.generation })).replace('"verdict":"GO"', '"verdict":"STOP","verdict":"GO"')}}`;
  const dupRes = await call('/submit', { method: 'POST', raw: dupRaw, headers: { 'content-type': 'application/json' } });
  if (dupRes.status !== 400 || dupRes.json?.code !== 'DUP_KEY') fail(`dup verdict through intake ${dupRes.status} ${dupRes.text.slice(0, 120)}`);
  else log('ok submit-dup-verdict-raw-rejected');

  // RED: webhook with bad signature → 401
  const badHook = await call('/webhook', { method: 'POST', raw: '{"zen":"x"}', headers: { 'x-hub-signature-256': 'sha256=' + '0'.repeat(64), 'x-github-delivery': randomUUID(), 'x-github-event': 'push' } });
  if (badHook.status !== 401) fail(`bad-signature webhook ${badHook.status}`);
  else log('ok webhook-bad-signature');

  // GREEN + RED: valid webhook accepted once; same delivery id deduplicated
  const hookBody = JSON.stringify({ action: 'synchronize' });
  const sig = 'sha256=' + createHmac('sha256', secret).update(hookBody).digest('hex');
  const delivery = randomUUID();
  const hook1 = await call('/webhook', { method: 'POST', raw: hookBody, headers: { 'x-hub-signature-256': sig, 'x-github-delivery': delivery, 'x-github-event': 'pull_request' } });
  const hook2 = await call('/webhook', { method: 'POST', raw: hookBody, headers: { 'x-hub-signature-256': sig, 'x-github-delivery': delivery, 'x-github-event': 'pull_request' } });
  if (hook1.status !== 200) fail(`valid webhook ${hook1.status}`);
  else if (hook2.json?.deduplicated !== true) fail(`redelivery not deduplicated: ${hook2.status} ${hook2.text.slice(0, 100)}`);
  else log('ok webhook-hmac-and-dedup');

  // RED: oversized body → 413
  const big = 'x'.repeat(1024 * 1024 + 10);
  const bigRes = await call('/submit', { method: 'POST', raw: big, headers: { 'content-type': 'application/json' } });
  if (bigRes.status !== 413) fail(`oversized ${bigRes.status}`);
  else log('ok oversized-rejected');

  // ── SP-1: canonical V2 correction/closure traverse the REAL submission path ──
  // fix_response/closure_receipt are schema-valid WITHOUT review_identity; an intake
  // that required it from every V2 record refused every real record (HTTP 422). The
  // binding is the record's own lifeline: a fix_response binds the assignment it
  // answers (claimed_by must be that assignment's owner; a revoked assignment
  // refuses), a closure_receipt binds the findings it closes (unknown keys refuse);
  // review_report keeps the review_identity binding unchanged.
  const fixCanon = JSON.parse(readFileSync(fixExamplePath, 'utf8'));
  const closureCanon = JSON.parse(readFileSync(closureExamplePath, 'utf8'));
  const goCanon = JSON.parse(readFileSync(goExamplePath, 'utf8'));
  ledger.recordFindings(submit.json.report_id, [
    { key: 'F-001', requirement: 'SP-1 intake binding fixture', category: 'correctness', severity: 'major', blocking: true },
  ]);
  const sp1Owner = fixCanon.claimed_by;
  const assignA = ledger.claimFinding({ findingKey: 'F-001', owner: sp1Owner, leaseMinutes: 120 });
  // R3-1: sessions for the enrolled executor (666001) and independent verifier
  // (777001) principals — a challenge is bound to ITS claimer, so the correction
  // records are claimed AND submitted under the same role session.
  const sessionExec = await login('good-code-exec');
  const sessionVer = await login('good-code-ver');
  const savedAll = cookie;
  cookie = sessionExec;
  const claimFix = await call('/claim', { method: 'POST', body: {} });
  if (claimFix.status !== 200) fail(`claimFix ${claimFix.status} ${claimFix.text.slice(0, 120)}`);
  cookie = sessionVer;
  const claimClo = await call('/claim', { method: 'POST', body: {} });
  if (claimClo.status !== 200) fail(`claimClo ${claimClo.status} ${claimClo.text.slice(0, 120)}`);
  cookie = sessionExec;
  const v2Envelope = (claim, report) => ({ claim_id: claim.json.claim_id, generation: claim.json.generation, report });

  // RED: canonical fix_response was 422 E_ENVELOPE (no review_identity) — it must be
  // accepted through intake with its assignment binding intact, ledger row bound to
  // the AUTHENTICATED session principal (identity separation kept). R3-1: the
  // submitting session is the ENROLLED EXECUTOR principal (the registry binds
  // 666001 ↔ 'cc-executor/mechanism-lane').
  const fixOk = await call('/submit', { method: 'POST', body: v2Envelope(claimFix, { ...fixCanon, assignment_id: assignA.assignment_id }) });
  if (fixOk.status !== 200 || fixOk.json?.replayed) fail(`fix-response submit ${fixOk.status} ${fixOk.text.slice(0, 160)}`);
  else {
    const row = ledger.getReport(fixOk.json.report_id);
    if (row?.kind !== 'fix_response' || row.reviewer_id !== 666001) fail(`fix row kind=${row?.kind} reviewer=${row?.reviewer_id}`);
    else if (JSON.parse(row.payload).assignment_id !== assignA.assignment_id) fail('fix payload lost the assignment binding');
    else log('ok v2-fix-response-traverses-intake');
  }

  // replay of the identical fix bytes returns the same receipt
  const fixReplay = await call('/submit', { method: 'POST', body: v2Envelope(claimFix, { ...fixCanon, assignment_id: assignA.assignment_id }) });
  if (fixReplay.json?.report_id !== fixOk.json.report_id || fixReplay.json?.replayed !== true) fail(`fix replay ${fixReplay.status} ${fixReplay.text.slice(0, 140)}`);
  else log('ok v2-fix-response-replay-same-receipt');

  // R3-1: replay cannot acquire privileges — a DIFFERENT enrolled principal
  // replaying the very same accepted bytes is refused: the executor binding is
  // re-evaluated against the AUTHENTICATED session, never carried by the payload.
  cookie = sessionB;
  const replayForeignPrincipal = await call('/submit', { method: 'POST', body: v2Envelope(claimFix, { ...fixCanon, assignment_id: assignA.assignment_id }) });
  cookie = sessionExec;
  if (replayForeignPrincipal.status !== 403 || replayForeignPrincipal.json?.code !== 'E_NOT_ENROLLED') fail(`foreign-principal replay ${replayForeignPrincipal.status} ${replayForeignPrincipal.text.slice(0, 140)}`);
  else log('ok v2-fix-replay-cannot-acquire-privileges');

  // RED: schema-valid fix bytes from an actor that does not own the assignment refuse
  // at the boundary with the BINDING reason (not the old review_identity message).
  const wrongActor = await call('/submit', { method: 'POST', body: v2Envelope(claimFix, { ...fixCanon, assignment_id: assignA.assignment_id, claimed_by: 'cc-executor/not-the-owner' }) });
  if (wrongActor.status !== 422 || wrongActor.json?.code !== 'E_ENVELOPE' || !/owner/.test(wrongActor.json?.error ?? '')) fail(`wrong actor ${wrongActor.status} ${wrongActor.text.slice(0, 160)}`);
  else log('ok v2-fix-wrong-actor-refused');

  const unknownAssign = await call('/submit', { method: 'POST', body: v2Envelope(claimFix, { ...fixCanon, assignment_id: 'assign-unknown' }) });
  if (unknownAssign.status !== 422 || !/unknown assignment/.test(unknownAssign.json?.error ?? '')) fail(`unknown assignment ${unknownAssign.status} ${unknownAssign.text.slice(0, 160)}`);
  else log('ok v2-fix-unknown-assignment-refused');

  // the SAME assignment, explicitly revoked — the refusal follows the state change
  ledger.revokeClaim({ assignmentId: assignA.assignment_id, reason: 'SP-1 revoked-assignment negative' });
  const revokedAssign = await call('/submit', { method: 'POST', body: v2Envelope(claimFix, { ...fixCanon, assignment_id: assignA.assignment_id }) });
  if (revokedAssign.status !== 422 || !/revoked/.test(revokedAssign.json?.error ?? '')) fail(`revoked assignment ${revokedAssign.status} ${revokedAssign.text.slice(0, 160)}`);
  else log('ok v2-fix-revoked-assignment-refused');

  // RED: canonical closure_receipt was 422 E_ENVELOPE the same way. R3-1: the
  // submitting session is the ENROLLED INDEPENDENT VERIFIER (777001 ↔
  // 'dot/astra-primary') — the executor principal cannot close.
  cookie = sessionVer;
  const closureOk = await call('/submit', { method: 'POST', body: v2Envelope(claimClo, closureCanon) });
  if (closureOk.status !== 200 || closureOk.json?.replayed) fail(`closure submit ${closureOk.status} ${closureOk.text.slice(0, 160)}`);
  else {
    const row = ledger.getReport(closureOk.json.report_id);
    if (row?.kind !== 'closure_receipt' || row.reviewer_id !== 777001) fail(`closure row kind=${row?.kind} reviewer=${row?.reviewer_id}`);
    else log('ok v2-closure-receipt-traverses-intake');
  }

  // a closure naming a finding the ledger never saw refuses at the boundary
  const unknownFinding = await call('/submit', { method: 'POST', body: v2Envelope(claimClo, { ...closureCanon, finding_ids: ['F-UNKNOWN-1'] }) });
  if (unknownFinding.status !== 422 || !/unknown finding/.test(unknownFinding.json?.error ?? '')) fail(`unknown finding ${unknownFinding.status} ${unknownFinding.text.slice(0, 160)}`);
  else log('ok v2-closure-unknown-finding-refused');

  // the KEPT property: a review_report still binds through review_identity — a
  // stitched canonical GO whose assignment_id names another claim refuses unchanged.
  const stitchedGo = await call('/submit', { method: 'POST', body: v2Envelope(claimClo, { ...goCanon, review_identity: { ...goCanon.review_identity, assignment_id: 'stitched-foreign-claim' } }) });
  if (stitchedGo.status !== 422 || stitchedGo.json?.code !== 'E_ENVELOPE') fail(`stitched review_report ${stitchedGo.status} ${stitchedGo.text.slice(0, 160)}`);
  else log('ok v2-review-report-identity-kept');

  // ── R3-1: record-specific identity and PR scope at the REAL HTTP intake ──────
  // The acceptance-review counterexample: an authenticated principal holding a
  // current-PR challenge submitted a canonical fix for a FOREIGN-PR assignment and
  // a canonical closure for a foreign finding under an arbitrary verified_by —
  // both came back HTTP 200 admitted:true. Each shape below now refuses.
  const foreignTuple = {
    repository_id: 1231007068, pr_node_id: 'PR_FOREIGN_R31',
    base_ref: 'staging', base_sha: sha('b'), head_sha: sha('z'),
    merge_base_sha: sha('a'), tested_merge_sha: sha('d'),
    policy_sha256: policyDigestOf(makePolicyFixture()), protocol_version: 'dot-staging-review/1.0',
  };
  const foreignClaim = ledger.claimGeneration({ tuple: foreignTuple, reviewerId: 555001, maxAttemptsPerTuple: 40, leaseMinutes: 120 });
  const foreignPayload = JSON.stringify({ probe: 'foreign scope' });
  const foreignRec = ledger.submitReport({
    claimId: foreignClaim.claim.claim_id, reviewerId: 555001,
    digest: createHash('sha256').update(foreignPayload).digest('hex'),
    payload: foreignPayload, verdict: 'REVISE', kind: 'admission', leaseMinutes: 120,
  });
  ledger.recordFindings(foreignRec.report_id, [
    { key: 'F-FOREIGN-1', requirement: 'foreign PR fixture', category: 'correctness', severity: 'major', blocking: true },
  ]);
  const foreignAssign = ledger.claimFinding({ findingKey: 'F-FOREIGN-1', owner: 'cc-executor/mechanism-lane', leaseMinutes: 120 });

  // current-PR challenge + foreign-PR assignment → 422 E_SCOPE
  const claimFx2 = await call('/claim', { method: 'POST', body: {} });
  if (claimFx2.status !== 200) fail(`claimFx2 ${claimFx2.status}`);
  cookie = sessionExec;
  const foreignFix = await call('/submit', { method: 'POST', body: v2Envelope(claimFx2, { ...fixCanon, assignment_id: foreignAssign.assignment_id }) });
  if (foreignFix.status !== 422 || foreignFix.json?.code !== 'E_SCOPE') fail(`foreign assignment ${foreignFix.status} ${foreignFix.text.slice(0, 160)}`);
  else log('ok r31-foreign-assignment-scope-refused');

  // mixed local/foreign finding IDs → the WHOLE closure refuses
  const claimClo2 = await call('/claim', { method: 'POST', body: {} });
  cookie = sessionVer;
  const mixedClosure = await call('/submit', { method: 'POST', body: v2Envelope(claimClo2, { ...closureCanon, finding_ids: ['F-001', 'F-FOREIGN-1'] }) });
  if (mixedClosure.status !== 422 || mixedClosure.json?.code !== 'E_SCOPE') fail(`mixed ids ${mixedClosure.status} ${mixedClosure.text.slice(0, 160)}`);
  else log('ok r31-mixed-finding-ids-refused');

  // arbitrary verified_by under an enrolled verifier session → 403 E_NOT_ENROLLED
  const claimClo3 = await call('/claim', { method: 'POST', body: {} });
  const arbitraryVerifier = await call('/submit', { method: 'POST', body: v2Envelope(claimClo3, { ...closureCanon, verified_by: 'someone/else' }) });
  if (arbitraryVerifier.status !== 403 || arbitraryVerifier.json?.code !== 'E_NOT_ENROLLED') fail(`arbitrary verified_by ${arbitraryVerifier.status} ${arbitraryVerifier.text.slice(0, 160)}`);
  else log('ok r31-arbitrary-verified-by-refused');

  // the executor principal acting as the independent closer → 403 E_ROLE
  const claimClo4 = await call('/claim', { method: 'POST', body: {} });
  cookie = sessionExec;
  const executorCloses = await call('/submit', { method: 'POST', body: v2Envelope(claimClo4, closureCanon) });
  if (executorCloses.status !== 403 || executorCloses.json?.code !== 'E_ROLE') fail(`executor closes ${executorCloses.status} ${executorCloses.text.slice(0, 160)}`);
  else log('ok r31-executor-cannot-independent-close');

  // obsolete generation: a challenge whose generation was superseded refuses the
  // correction record (409 E_GENERATION) — stale fix evidence is not archived.
  const curTuple = { ...foreignTuple, pr_node_id: 'PR_kwDOM9YQhs6AbCdEfGh', head_sha: sha('f') };
  const curClaim = ledger.claimGeneration({ tuple: curTuple, reviewerId: 555001, maxAttemptsPerTuple: 40, leaseMinutes: 120 });
  const curPayload = JSON.stringify({ probe: 'current scope' });
  const curRec = ledger.submitReport({
    claimId: curClaim.claim.claim_id, reviewerId: 555001,
    digest: createHash('sha256').update(curPayload).digest('hex'),
    payload: curPayload, verdict: 'REVISE', kind: 'admission', leaseMinutes: 120,
  });
  ledger.recordFindings(curRec.report_id, [
    { key: 'F-002', requirement: 'obsolete-generation fixture', category: 'correctness', severity: 'major', blocking: true },
  ]);
  const assignObs = ledger.claimFinding({ findingKey: 'F-002', owner: 'cc-executor/mechanism-lane', leaseMinutes: 120 });
  const claimObs = await call('/claim', { method: 'POST', body: {} });
  if (claimObs.status !== 200) fail(`claimObs ${claimObs.status}`);
  REPO_STATE.head_sha = sha('7');
  const supersede = await call('/claim', { method: 'POST', body: {} });
  if (supersede.status !== 200) fail(`supersede claim ${supersede.status}`);
  REPO_STATE.head_sha = sha('c');
  cookie = sessionExec;
  const obsoleteFix = await call('/submit', { method: 'POST', body: v2Envelope(claimObs, { ...fixCanon, assignment_id: assignObs.assignment_id, finding_ids: ['F-002'] }) });
  if (obsoleteFix.status !== 409 || obsoleteFix.json?.code !== 'E_GENERATION') fail(`obsolete generation ${obsoleteFix.status} ${obsoleteFix.text.slice(0, 160)}`);
  else log('ok r31-obsolete-generation-refused');
  cookie = savedAll;
} catch (e) {
  fail(`unexpected: ${e.stack?.split('\n')[0]}`);
} finally {
  await server.close();
}
NODE

# shellcheck disable=SC1091
source "$DIR/suite-harness.sh"
out="$(node "$SCRIPT" \
  "$DIR/intake.mjs" \
  "$DIR/ledger.mjs" \
  "$(cd "$DIR/../.." && pwd)/tests/dot-review-gate/fixtures/make-admission.mjs" \
  "$DIR/validate-report.mjs" \
  "$(cd "$DIR/../.." && pwd)/docs/meta-factory/dot-review-result.schema.json" \
  "$(cd "$DIR/../.." && pwd)/tests/dot-review-gate/fixtures/v2/schema.json" \
  "$(cd "$DIR/../.." && pwd)/docs/meta-factory/dot-review-v2-examples/fix-response.json" \
  "$(cd "$DIR/../.." && pwd)/docs/meta-factory/dot-review-v2-examples/closure-receipt.json" \
  "$(cd "$DIR/../.." && pwd)/docs/meta-factory/dot-review-v2-examples/positive-go.json" \
  "$TMP" 2>&1)"; status=$?
assert_suite_arms "intake.test.sh" "$status" "$out" \
  oauth-empty-scope oauth-callback-session claim-issued submit-requires-session \
  envelope-principal-binds-ledger envelope-bytes-and-provenance-stored replay-same-receipt conflict-rejected \
  submit-wrong-reviewer-refused submit-superseded-archived-as-history submit-generation-mismatch-refused \
  submit-lease-expired-refused claim-lease-frees-slot submit-tuple-drift-archived-as-history \
  submit-inner-mismatch-refused submit-dup-verdict-raw-rejected \
  webhook-bad-signature webhook-hmac-and-dedup oversized-rejected \
  v2-fix-response-traverses-intake v2-fix-response-replay-same-receipt \
  v2-fix-replay-cannot-acquire-privileges \
  v2-fix-wrong-actor-refused v2-fix-unknown-assignment-refused v2-fix-revoked-assignment-refused \
  v2-closure-receipt-traverses-intake v2-closure-unknown-finding-refused \
  v2-review-report-identity-kept \
  r31-foreign-assignment-scope-refused r31-mixed-finding-ids-refused \
  r31-arbitrary-verified-by-refused r31-executor-cannot-independent-close \
  r31-obsolete-generation-refused || exit 1
echo "intake.test.sh: all green"
