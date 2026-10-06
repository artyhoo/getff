#!/usr/bin/env bash
# Paired-negative for scripts/dot-review-gate/armer.mjs.
#
# The armer enables native auto-merge for an authorized staging PR — nothing else.
# Review R5: enable-auto-merge has NO REST endpoint — the operation is the GraphQL
# mutation enablePullRequestAutoMerge, addressed by PR NODE ID; and the route allowlist
# must speak real owner/repo paths (the old grammar expected one path component, so the
# REAL repo was refused while /repos/x passed). Under test: the endpoint allowlist with
# the configured owner/repo enforced client-side, the pinned GraphQL operation (wrong
# mutation or wrong pull request id never reaches the transport), the authorization
# guards (validated GO/COMPLETE admission — re-validated HERE from the bytes, not a
# caller-supplied flag — pause inactive, strict protections with the Dot check bound to
# the expected publisher App), live head/base binding against the reviewed report, and
# idempotent arming.
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/dot-armer-test.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

SCRIPT="$TMP/run-armer-arms.mjs"
cat > "$SCRIPT" <<'NODE'
const [armerPath, fixPath, validatorPath, schemaPath, ledgerPath, tmpDir] = process.argv.slice(2);
const { makeAdmission, makePolicyFixture, policyDigestOf } = await import(fixPath);
const { createArmerClient, armAutoMerge } = await import(armerPath);
const { readFileSync } = await import('node:fs');
const { createHash } = await import('node:crypto');
const { openLedger } = await import(ledgerPath);
const schemaBytes = readFileSync(schemaPath);
const policy = makePolicyFixture();
const REPO = 'artyhoo/getff';
const H = 'c'.repeat(40);
const B = 'b'.repeat(40);
const NODE_ID = 'PR_kwDOM9YQhs6AbCdEfGh';

const log = (...a) => console.log(...a);
const fail = (m) => { console.log('FAIL ' + m); process.exitCode = 1; };

function makeTransport({ autoMerge = null, headSha = H, baseSha = B, nodeId = NODE_ID } = {}) {
  const t = { calls: [], graphqlBodies: [] };
  t.fetchJson = async (url, opts = {}) => {
    t.calls.push({ url, method: opts.method ?? 'GET' });
    if (url === `/repos/${REPO}/pulls/2042`) {
      return { state: 'open', draft: false, node_id: nodeId, head: { sha: headSha }, base: { ref: 'staging', sha: baseSha }, auto_merge: autoMerge };
    }
    if (url === '/graphql' && opts.method === 'POST') {
      const body = JSON.parse(opts.body);
      t.graphqlBodies.push(body);
      return { data: { enablePullRequestAutoMerge: { clientMutationId: 'm1' } } };
    }
    throw Object.assign(new Error('unexpected ' + url), { status: 404 });
  };
  return t;
}

const MUTATION = 'mutation($input: EnablePullRequestAutoMergeInput!) { enablePullRequestAutoMerge(input: $input) { clientMutationId } }';

const protections = (over = {}) => ({
  strict: true,
  expected_dot_app_id: policy.dot_check.expected_app_id,
  required_checks: [{ context: 'dot-review/v1', app_id: policy.dot_check.expected_app_id }, { context: 'ci-success', app_id: 15368 }],
  pause_required: false,
  allow_force_pushes: false,
  allow_deletions: false,
  ...over,
});

const admission = (over = {}) => JSON.stringify(makeAdmission(over));
const INVENTORY = { changed_files: ['packages/core/principles/44-x.test.ts'] };
const arm = (over = {}) => armAutoMerge({ repo: REPO, prNumber: 2042, schemaBytes, policy, trustedInventory: INVENTORY, protections: protections(), ...over });

try {
  // SP-4 fixture: the green-path ledger — an ACTIVE registration with the recorded
  // operator enablement and a clean journal. Every arming below composes against it.
  const sp4Green = openLedger(`${tmpDir}/armer-green.sqlite`);
  sp4Green.insertRegistration({ prNodeId: NODE_ID, prNumber: 2042, coordinator: 'coordinator/test', reconciledAt: '2026-10-06T12:00:00Z' });
  sp4Green.updateRegistration(NODE_ID, { mergeEnabled: true, operatorTransition: 'operator enabled merge for the pilot' });

  // GREEN: valid admission + healthy protections → ONE pinned GraphQL arm, SQUASH
  const t1 = makeTransport();
  const r1 = await arm({ reportText: admission(), transport: t1.fetchJson, ledger: sp4Green });
  if (!r1.armed) fail('arming failed');
  if (t1.calls.filter((c) => c.method === 'POST' && c.url === '/graphql').length !== 1) fail(`arm calls: ${JSON.stringify(t1.calls)}`);
  const body1 = t1.graphqlBodies[0];
  if (!body1 || body1.query !== MUTATION || body1.variables?.input?.pullRequestId !== NODE_ID || body1.variables?.input?.mergeMethod !== 'SQUASH') {
    fail(`graphql body not pinned: ${JSON.stringify(body1).slice(0, 200)}`);
  } else log('ok armed-once-pinned-mutation');

  // GREEN: replay (already armed) → no call at all
  const t2 = makeTransport({ autoMerge: { merge_method: 'squash' } });
  const r2 = await arm({ reportText: admission(), transport: t2.fetchJson, ledger: sp4Green });
  if (r2.armed !== false || t2.graphqlBodies.length !== 0) fail('re-arm on an armed PR');
  else log('ok rearm-idempotent');

  // RED: live head moved since the review → mismatch refused BEFORE any write
  const t3 = makeTransport({ headSha: '9'.repeat(40) });
  await arm({ reportText: admission(), transport: t3.fetchJson })
    .then(() => fail('armed a drifted head'))
    .catch((e) => { if (e.code === 'E_MISMATCH' && t3.graphqlBodies.length === 0) log('ok head-drift-refused'); else fail(`head drift ${e.code}`); });

  // RED: REVISE admission → refused
  const t4 = makeTransport();
  await arm({ reportText: admission({ verdict: 'REVISE' }), transport: t4.fetchJson })
    .then(() => fail('REVISE armed'))
    .catch((e) => { if (e.code !== 'E_NOT_AUTHORIZED') fail(`wrong code ${e.code}`); else if (t4.graphqlBodies.length !== 0) fail('mutation after refusal'); else log('ok revise-refused'); });

  // RED: garbage bytes → the armer validates ITSELF, no caller-supplied flag exists
  const t5 = makeTransport();
  await arm({ reportText: '{"kind":"admission"}', transport: t5.fetchJson })
    .then(() => fail('invalid armed'))
    .catch((e) => { if (e.code === 'E_NOT_AUTHORIZED') log('ok invalid-refused'); else fail(`wrong code ${e.code}`); });

  // RED: native pause active → refused
  const t6 = makeTransport();
  await arm({ reportText: admission(), protections: protections({ pause_required: true }), transport: t6.fetchJson })
    .then(() => fail('armed under pause'))
    .catch((e) => { if (e.code === 'E_PAUSED') log('ok pause-refused'); else fail(`wrong code ${e.code}`); });

  // RED: strict false → refused
  const t7 = makeTransport();
  await arm({ reportText: admission(), protections: protections({ strict: false }), transport: t7.fetchJson })
    .then(() => fail('armed without strict'))
    .catch((e) => { if (e.code === 'E_PROTECTIONS') log('ok nonstrict-refused'); else fail(`wrong code ${e.code}`); });

  // RED: dot check bound to the WRONG app → refused
  const t8 = makeTransport();
  const wrongApp = protections();
  wrongApp.required_checks = [{ context: 'dot-review/v1', app_id: policy.dot_check.expected_app_id + 1 }];
  await arm({ reportText: admission(), protections: wrongApp, transport: t8.fetchJson })
    .then(() => fail('armed with wrong source'))
    .catch((e) => { if (e.code === 'E_PROTECTIONS') log('ok wrong-source-refused'); else fail(`wrong code ${e.code}`); });

  // RED: draft PR → refused
  const t9 = makeTransport();
  await arm({ reportText: admission(), transport: async (url, opts = {}) => {
    if (url === `/repos/${REPO}/pulls/2042`) return { state: 'open', draft: true, node_id: NODE_ID, head: { sha: H }, base: { ref: 'staging', sha: B }, auto_merge: null };
    return t9.fetchJson(url, opts);
  } })
    .then(() => fail('draft armed'))
    .catch((e) => { if (e.code === 'E_PR_STATE') log('ok draft-refused'); else fail(`wrong code ${e.code}`); });

  // RED (R5): the client enforces the CONFIGURED owner/repo — a one-component or
  // foreign-repo path never reaches the transport
  const t10 = makeTransport();
  const client = createArmerClient({ repo: REPO, transport: t10.fetchJson });
  let leaks = 0;
  for (const path of ['/repos/x/pulls/2042', `/repos/artyhoo/pulls/2042`, `/repos/${REPO}/pulls/2042/auto-merge`]) {
    try { await client.request(path, { method: 'GET' }); leaks++; }
    catch (e) { if (e.code !== 'E_ALLOWLIST') { fail(`wrong allowlist code for ${path}: ${e.code}`); leaks++; } }
  }
  if (t10.calls.length !== 0 && leaks === 0) fail('disallowed call reached transport');
  else if (leaks === 0) log('ok client-allowlist-owner-repo');

  // RED (R5): a /graphql call whose body is not the pinned mutation is refused
  const t11 = makeTransport();
  const client11 = createArmerClient({ repo: REPO, transport: t11.fetchJson });
  client11._pinGraphql(MUTATION, { input: { pullRequestId: NODE_ID, mergeMethod: 'SQUASH' } });
  try {
    await client11.request('/graphql', { method: 'POST', body: JSON.stringify({ query: 'mutation { foo }', variables: {} }) });
    fail('unpinned graphql leaked');
  } catch (e) {
    if (e.code !== 'E_ALLOWLIST' || t11.graphqlBodies.length !== 0) fail(`unpinned graphql ${e.code}`);
    else log('ok graphql-body-pinned');
  }

  // RED: repo without owner/name → refused before any call
  const t12 = makeTransport();
  await armAutoMerge({ repo: 'just-a-name', prNumber: 2042, reportText: admission(), schemaBytes, policy, protections: protections(), transport: t12.fetchJson })
    .then(() => fail('single-component repo armed'))
    .catch((e) => { if (e.code === 'E_REPO' && t12.calls.length === 0) log('ok repo-format-validated'); else fail(`repo format ${e.code}`); });

  // ── SP-4: eligibility composes at the ARMING boundary ────────────────────────
  // The reviewed bytes are not the whole eligibility: the durable journal (open
  // blocking lineage) and the operator's registration receipt (merge is
  // DEFAULT-OFF) are witnesses at the merge boundary. RED: today the armer writes
  // the mutation in every one of these states.
  const mkTuple = () => ({
    repository_id: 1231007068, pr_node_id: NODE_ID, base_ref: 'staging',
    base_sha: B, head_sha: H, merge_base_sha: 'a'.repeat(40),
    tested_merge_sha: 'd'.repeat(40), policy_sha256: policyDigestOf(policy),
    protocol_version: 'dot-staging-review/1.0',
  });
  const freshLedger = (name) => openLedger(`${tmpDir}/armer-${name}.sqlite`);
  const seedBlockingFinding = (ledgerInstance) => {
    const gen = ledgerInstance.claimGeneration({ tuple: mkTuple(), reviewerId: 555001, maxAttemptsPerTuple: 5, leaseMinutes: 120 });
    const payload = JSON.stringify({ probe: 'sp4' });
    const rep = ledgerInstance.submitReport({
      claimId: gen.claim.claim_id, reviewerId: 555001,
      digest: createHash('sha256').update(payload).digest('hex'),
      payload, verdict: 'GO', kind: 'admission', leaseMinutes: 120,
      liveTupleDigest: gen.generation.tuple_digest,
    });
    ledgerInstance.recordFindings(rep.report_id, [{ key: 'artyhoo/getff#F-ARM', requirement: 'r', category: 'correctness', severity: 'critical', blocking: true }]);
    return rep;
  };

  // no journal at all = unknown state = hold
  const tS4a = makeTransport();
  await arm({ reportText: admission(), transport: tS4a.fetchJson })
    .then(() => fail('armed without the durable journal'))
    .catch((e) => { if (e.code === 'E_CONFIG' && tS4a.graphqlBodies.length === 0) log('ok arming-without-journal-refused'); else fail(`no-journal ${e.code}`); });

  // an open blocking finding on this PR holds the arm — arming cannot erase it
  const sp4Blocking = freshLedger('blocking');
  seedBlockingFinding(sp4Blocking);
  sp4Blocking.insertRegistration({ prNodeId: NODE_ID, prNumber: 2042, coordinator: 'coordinator/test', reconciledAt: '2026-10-06T12:00:00Z' });
  sp4Blocking.updateRegistration(NODE_ID, { mergeEnabled: true, operatorTransition: 'operator enabled merge for the pilot' });
  const tS4b = makeTransport();
  await arm({ reportText: admission(), transport: tS4b.fetchJson, ledger: sp4Blocking })
    .then(() => fail('armed over an open blocking finding'))
    .catch((e) => { if (e.code === 'E_OPEN_BLOCKING' && /F-ARM/.test(e.message) && tS4b.graphqlBodies.length === 0) log('ok open-blocking-lineage-holds-arm'); else fail(`open blocking ${e.code} ${e.message.slice(0, 100)}`); });

  // no registration receipt → merge is default-off
  const sp4Unreg = freshLedger('unreg');
  const tS4c = makeTransport();
  await arm({ reportText: admission(), transport: tS4c.fetchJson, ledger: sp4Unreg })
    .then(() => fail('armed without a registration receipt'))
    .catch((e) => { if (e.code === 'E_UNREGISTERED' && tS4c.graphqlBodies.length === 0) log('ok unknown-registration-holds-arm'); else fail(`unregistered ${e.code}`); });

  // registered but the operator transition never enabled merge
  const sp4Disabled = freshLedger('disabled');
  sp4Disabled.insertRegistration({ prNodeId: NODE_ID, prNumber: 2042, coordinator: 'coordinator/test', reconciledAt: '2026-10-06T12:00:00Z' });
  const tS4d = makeTransport();
  await arm({ reportText: admission(), transport: tS4d.fetchJson, ledger: sp4Disabled })
    .then(() => fail('armed with merge_enabled=false'))
    .catch((e) => { if (e.code === 'E_MERGE_DISABLED' && tS4d.graphqlBodies.length === 0) log('ok merge-disabled-holds-arm'); else fail(`merge disabled ${e.code}`); });

  // a released registration is no longer an authorization
  const sp4Released = freshLedger('released');
  sp4Released.insertRegistration({ prNodeId: NODE_ID, prNumber: 2042, coordinator: 'coordinator/test', reconciledAt: '2026-10-06T12:00:00Z' });
  sp4Released.updateRegistration(NODE_ID, { state: 'RELEASED', operatorTransition: 'operator released the PR' });
  const tS4e = makeTransport();
  await arm({ reportText: admission(), transport: tS4e.fetchJson, ledger: sp4Released })
    .then(() => fail('armed on a released registration'))
    .catch((e) => { if (e.code === 'E_UNREGISTERED' && tS4e.graphqlBodies.length === 0) log('ok released-registration-holds-arm'); else fail(`released ${e.code}`); });
} catch (e) {
  fail(`unexpected: ${e.stack?.split('\n').slice(0, 2).join(' | ')}`);
}
NODE

# shellcheck disable=SC1091
source "$DIR/suite-harness.sh"
out="$(node "$SCRIPT" \
  "$DIR/armer.mjs" \
  "$(cd "$DIR/../.." && pwd)/tests/dot-review-gate/fixtures/make-admission.mjs" \
  "$DIR/validate-report.mjs" \
  "$(cd "$DIR/../.." && pwd)/docs/meta-factory/dot-review-result.schema.json" \
  "$DIR/ledger.mjs" \
  "$TMP" 2>&1)"; status=$?
assert_suite_arms "armer.test.sh" "$status" "$out" \
  armed-once-pinned-mutation rearm-idempotent head-drift-refused revise-refused \
  invalid-refused pause-refused nonstrict-refused wrong-source-refused draft-refused \
  client-allowlist-owner-repo graphql-body-pinned repo-format-validated \
  arming-without-journal-refused open-blocking-lineage-holds-arm \
  unknown-registration-holds-arm merge-disabled-holds-arm \
  released-registration-holds-arm || exit 1
echo "armer.test.sh: all green"
