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
const [intakePath, ledgerPath, fixPath, validatorPath, schemaPath, tmp] = process.argv.slice(2);
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
    throw new Error('bad_code');
  },
  async fetchUser(accessToken) {
    if (accessToken === 'tok-1') return { id: 555001, login: 'dot-reviewer' };
    if (accessToken === 'tok-2') return { id: 555002, login: 'dot-reviewer-2' };
    throw new Error('bad_token');
  },
  currentState: async () => ({ ...REPO_STATE }),
};
const secret = 'webhook-hmac-secret';

const ledger = openLedger(`${tmp}/intake-ledger.sqlite`);
const policy = makePolicyFixture({
  reviewer_principal_ids: [555001, 555002],
  limits: { max_active_claims: 2, max_attempts_per_tuple: 5, claim_lease_minutes: 120 },
});
const server = await startIntake({
  ledger,
  policy,
  oauth: GH,
  webhookSecret: secret,
  validator: (text, extra) => validateReport(text, { schemaBytes, policy, now: new Date(clock).toISOString(), currentState: extra?.currentState, trustedInventory: extra?.trustedInventory }),
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
  "$TMP" 2>&1)"; status=$?
assert_suite_arms "intake.test.sh" "$status" "$out" \
  oauth-empty-scope oauth-callback-session claim-issued submit-requires-session \
  envelope-principal-binds-ledger envelope-bytes-and-provenance-stored replay-same-receipt conflict-rejected \
  submit-wrong-reviewer-refused submit-superseded-archived-as-history submit-generation-mismatch-refused \
  submit-lease-expired-refused claim-lease-frees-slot submit-tuple-drift-archived-as-history \
  submit-inner-mismatch-refused submit-dup-verdict-raw-rejected \
  webhook-bad-signature webhook-hmac-and-dedup oversized-rejected || exit 1
echo "intake.test.sh: all green"
