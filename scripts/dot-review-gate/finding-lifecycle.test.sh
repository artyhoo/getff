#!/usr/bin/env bash
# Paired-negative for the finding lifecycle in scripts/dot-review-gate/ledger.mjs.
#
# Follow-up packet (2026-10-06) increment 4: finding lineage/occurrences, a single
# active corrective owner with assignment + fencing token + lease, acknowledgement,
# fix revision, verification/closure receipts and bounded retry reservations — all
# durable, transactional and attributed. Contract pinned here:
#   - occurrences are idempotent per source report; a replay cannot duplicate one;
#   - recurrence (same finding key on a LATER report) opens a NEW occurrence — a
#     RESOLVED history does not absorb it;
#   - one active claim per finding; an expired lease does NOT free the slot by itself:
#     replacement requires an explicit revoke (cessation is not proven by the clock);
#   - acknowledgement, fix responses and closures verify the fencing token;
#   - closure needs the fix receipt AND receipts that are not contradicted by a newer
#     failing check, and the disposition must be from the allowlist;
#   - retry reservations are persisted counters; exceeding the bound refuses;
#   - a superseded generation invalidates admission, never finding history.
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/dot-findings-test.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

SCRIPT="$TMP/run-finding-arms.mjs"
cat > "$SCRIPT" <<'NODE'
const [ledgerPath, tmp] = process.argv.slice(2);
const { openLedger } = await import(ledgerPath);

const log = (...a) => console.log(...a);
const fail = (m) => { console.log('FAIL ' + m); process.exitCode = 1; };
const expectCode = (fn, want, label) => {
  try { fn(); fail(`${label}: expected ${want}, no error thrown`); }
  catch (e) { if (e.code === want) log(`ok ${label}`); else fail(`${label}: expected ${want}, got ${e.code ?? e.message}`); }
};

let clock = Date.parse('2026-10-06T12:00:00Z');
const tick = (min) => { clock += min * 60 * 1000; return new Date(clock).toISOString(); };

const ledger = openLedger(`${tmp}/findings.sqlite`);
const FINDING = (over = {}) => ({
  key: 'artyhoo/getff#F1',
  requirement: 'the gate refuses unstaged paths',
  category: 'correctness',
  severity: 'critical',
  blocking: true,
  ...over,
});

try {
  // GREEN: occurrences from one accepted report are recorded; a replay of the SAME
  // report records nothing new
  ledger.recordFindings('rep-1', [FINDING(), FINDING({ key: 'artyhoo/getff#F2', severity: 'major', blocking: false })]);
  ledger.recordFindings('rep-1', [FINDING()]);
  const occ = ledger.listOpenFindings();
  if (occ.length !== 2 || !occ.every((o) => o.state === 'OPEN')) fail(`record idempotent: ${JSON.stringify(occ.map((o) => [o.finding_key, o.state]))}`);
  else log('ok findings-recorded-idempotent');

  // RED: a claim is exclusive — the second owner is refused
  const claim = ledger.claimFinding({ findingKey: 'artyhoo/getff#F1', owner: 'exec-a', leaseMinutes: 30, nowMs: clock });
  if (!claim.assignment_id || !claim.fencing_token) fail(`claim shape ${JSON.stringify(claim)}`);
  expectCode(() => ledger.claimFinding({ findingKey: 'artyhoo/getff#F1', owner: 'exec-b', leaseMinutes: 30, nowMs: clock }), 'E_ALREADY_CLAIMED', 'single-active-claim');

  // RED: fencing — the wrong token cannot acknowledge or submit work
  expectCode(() => ledger.acknowledgeFinding({ assignmentId: claim.assignment_id, fencingToken: 'wrong', workLocation: 'w1', nowMs: clock }), 'E_FENCING', 'fencing-wrong-token');
  expectCode(() => ledger.recordFixResponse({ assignmentId: claim.assignment_id, fencingToken: 'wrong', fixRevision: 'abc', digest: 'd1', payload: '{}' }), 'E_FENCING', 'fencing-fix-response');

  // GREEN: the right token acknowledges; the state moves
  ledger.acknowledgeFinding({ assignmentId: claim.assignment_id, fencingToken: claim.fencing_token, workLocation: 'worktree-x', nowMs: clock });
  if (ledger.getOccurrence(claim.occurrence_id)?.state !== 'ACKNOWLEDGED') fail('ack state');
  else log('ok acknowledge-binds-assignment');

  // RED: lease expiry does NOT prove cessation — replacement is held until revoke
  tick(31);
  expectCode(() => ledger.claimFinding({ findingKey: 'artyhoo/getff#F1', owner: 'exec-b', leaseMinutes: 30, nowMs: clock }), 'E_CESSATION_UNKNOWN', 'expired-claim-holds-until-revoked');
  ledger.revokeClaim({ assignmentId: claim.assignment_id, reason: 'lease expired, coordinator reconciled: no push landed', nowMs: clock });
  const claimB = ledger.claimFinding({ findingKey: 'artyhoo/getff#F1', owner: 'exec-b', leaseMinutes: 30, nowMs: clock });
  if (!claimB.fencing_token || claimB.fencing_token === claim.fencing_token) fail(`reclaim tokens ${claimB.fencing_token}`);
  else log('ok revoke-then-reclaim-new-token');

  // GREEN: a fix response with the CURRENT fencing token moves VERIFYING + receipt
  ledger.recordFixResponse({ assignmentId: claimB.assignment_id, fencingToken: claimB.fencing_token, fixRevision: 'fix-1', digest: 'fixdigest-1', payload: '{"findings":["artyhoo/getff#F1"]}' });
  if (ledger.getOccurrence(claimB.occurrence_id)?.state !== 'VERIFYING') fail('fix state');
  else log('ok fix-response-moves-verifying');

  // RED: closure without any verification receipt is refused
  expectCode(() => ledger.recordClosure({ findingKey: 'artyhoo/getff#F1', disposition: 'VERIFIED', verifier: 'dot', revision: 'fix-1', nowMs: clock }), 'E_NOT_RESOLVABLE', 'closure-requires-receipts');

  // RED: a check receipt FAILING after the fix keeps the finding open
  ledger.recordReceipt({ occurrenceId: claimB.occurrence_id, kind: 'check_receipt', revision: 'fix-1', digest: 'chk-1', payload: '{"conclusion":"failure"}', nowMs: clock });
  expectCode(() => ledger.recordClosure({ findingKey: 'artyhoo/getff#F1', disposition: 'VERIFIED', verifier: 'dot', revision: 'fix-1', nowMs: clock }), 'E_NOT_RESOLVABLE', 'failing-check-keeps-open');

  // GREEN: a newer passing check + the named closure receipt resolve
  ledger.recordReceipt({ occurrenceId: claimB.occurrence_id, kind: 'check_receipt', revision: 'fix-1', digest: 'chk-2', payload: '{"conclusion":"success"}', nowMs: clock });
  ledger.recordReceipt({ occurrenceId: claimB.occurrence_id, kind: 'change_review', revision: 'fix-1', digest: 'cr-1', payload: '{"scope":"fix-1"}', nowMs: clock });
  ledger.recordClosure({ findingKey: 'artyhoo/getff#F1', disposition: 'VERIFIED', verifier: 'dot', revision: 'fix-1', nowMs: clock });
  if (ledger.getOccurrence(claimB.occurrence_id)?.state !== 'RESOLVED') fail('closure state');
  else log('ok closure-with-receipts-resolves');

  // RED: the disposition allowlist is enforced
  ledger.recordFindings('rep-2', [FINDING({ key: 'artyhoo/getff#F3' })]);
  expectCode(() => ledger.recordClosure({ findingKey: 'artyhoo/getff#F3', disposition: 'JUST_BECAUSE', verifier: 'dot', revision: 'fix-1', nowMs: clock }), 'E_DISPOSITION', 'disposition-allowlist');
  ledger.recordClosure({ findingKey: 'artyhoo/getff#F3', disposition: 'ALREADY_FIXED', verifier: 'dot', revision: 'fix-1', nowMs: clock });
  if (ledger.getOccurrence(ledger.lineage('artyhoo/getff#F3').at(-1).id)?.state !== 'RESOLVED') fail('ALREADY_FIXED closure did not resolve');

  // RED: recurrence — the same key on a LATER report opens a NEW occurrence and the
  // lineage keeps both (a RESOLVED past never absorbs a new sighting)
  ledger.recordFindings('rep-3', [FINDING({ key: 'artyhoo/getff#F1' })]);
  const lineage = ledger.lineage('artyhoo/getff#F1');
  if (lineage.length !== 2 || lineage.at(-1).state !== 'OPEN' || lineage[0].state !== 'RESOLVED') {
    fail(`recurrence ${JSON.stringify(lineage.map((o) => [o.id.slice(0, 6), o.state]))}`);
  } else log('ok recurrence-reopens-lineage');

  // RED: retry reservations are bounded and persisted across reopen (crash-safety)
  ledger.reserveRetry('assign:artyhoo/getff#F1', 2, clock);
  log('ok retry-first');
  ledger.reserveRetry('assign:artyhoo/getff#F1', 2, clock);
  expectCode(() => ledger.reserveRetry('assign:artyhoo/getff#F1', 2, clock), 'E_BUDGET', 'retry-reservation-bounded');
  ledger.close?.();

  // reopen the same file: the reservation counter survived (durable, not in-memory)
  const ledger2 = openLedger(`${tmp}/findings.sqlite`);
  expectCode(() => ledger2.reserveRetry('assign:artyhoo/getff#F1', 2, clock), 'E_BUDGET', 'reservation-survives-reopen');

  // RED: a superseded generation invalidates admission, never finding history
  const tupleA = { repository_id: 1, pr_node_id: 'PR_1', base_ref: 'staging', base_sha: 'b'.repeat(40), head_sha: 'c'.repeat(40), merge_base_sha: 'a'.repeat(40), tested_merge_sha: 'd'.repeat(40), policy_sha256: 'p'.repeat(64), protocol_version: 'dot-staging-review/1.0' };
  const tupleB = { ...tupleA, head_sha: 'e'.repeat(40) };
  ledger2.beginGeneration(tupleA);
  ledger2.beginGeneration(tupleB); // supersedes tupleA's in-flight generation
  if (ledger2.lineage('artyhoo/getff#F1').length !== 2) fail('supersede lost findings');
  else log('ok supersede-keeps-finding-history');
  ledger2.close?.();
} catch (e) {
  fail(`unexpected: ${e.stack?.split('\n').slice(0, 2).join(' | ')}`);
}
NODE

# shellcheck disable=SC1091
source "$DIR/suite-harness.sh"
out="$(node "$SCRIPT" "$DIR/ledger.mjs" "$TMP" 2>&1)"; status=$?
assert_suite_arms "finding-lifecycle.test.sh" "$status" "$out" \
  findings-recorded-idempotent single-active-claim fencing-wrong-token \
  fencing-fix-response acknowledge-binds-assignment expired-claim-holds-until-revoked \
  revoke-then-reclaim-new-token fix-response-moves-verifying closure-requires-receipts \
  failing-check-keeps-open closure-with-receipts-resolves disposition-allowlist \
  recurrence-reopens-lineage retry-first retry-reservation-bounded \
  reservation-survives-reopen supersede-keeps-finding-history || exit 1
echo "finding-lifecycle.test.sh: all green"
