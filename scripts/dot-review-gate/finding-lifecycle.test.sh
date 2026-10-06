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
#   - DR-R2: corrective ownership is atomic per repository/PR across findings and
#     occurrences — recurrence while a fixer is active rebinds the assignment to the
#     newest occurrence instead of letting a second owner in; a different finding of
#     the same PR is fenced too; another PR is not; the fence survives a restart;
#   - acknowledgement, fix responses and closures verify the fencing token;
#   - closure needs CURRENT, RELEVANT, INDEPENDENT evidence (DR-R1): the latest fix
#     binds the evidence set — a successful mechanical check ON the fix revision after
#     that fix, an independent change review (actor != fix owner, recorded after the
#     fix, on the fix revision), and an applicable Dot closure receipt; a second fix
#     invalidates prior evidence; ALREADY_FIXED/REJECTED_WITH_EVIDENCE carry evidence
#     too; the disposition must be from the allowlist;
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
const { createHash } = await import('node:crypto');

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

  // GREEN: a newer passing check + an INDEPENDENT change review + the Dot closure
  // receipt, all on the fix revision, resolve
  ledger.recordReceipt({ occurrenceId: claimB.occurrence_id, kind: 'check_receipt', revision: 'fix-1', digest: 'chk-2', payload: '{"conclusion":"success"}', nowMs: clock });
  ledger.recordReceipt({ occurrenceId: claimB.occurrence_id, kind: 'change_review', revision: 'fix-1', digest: 'cr-1', payload: '{"scope":"fix-1"}', actor: 'reviewer-z', nowMs: clock });
  ledger.recordReceipt({ occurrenceId: claimB.occurrence_id, kind: 'dot_closure', revision: 'fix-1', digest: 'dc-1', payload: '{"applies":true}', actor: 'dot', nowMs: clock });
  ledger.recordClosure({ findingKey: 'artyhoo/getff#F1', disposition: 'VERIFIED', verifier: 'dot', revision: 'fix-1', nowMs: clock });
  if (ledger.getOccurrence(claimB.occurrence_id)?.state !== 'RESOLVED') fail('closure state');
  else log('ok closure-with-receipts-resolves');

  // ── DR-R1: closure evidence must be current, relevant and independent ─────────
  const seedFix = (key, owner, fixRev) => {
    ledger.recordFindings('rep-fix', [FINDING({ key })]);
    const c = ledger.claimFinding({ findingKey: key, owner, leaseMinutes: 30, nowMs: clock });
    ledger.recordFixResponse({ assignmentId: c.assignment_id, fencingToken: c.fencing_token, fixRevision: fixRev, digest: `fd:${key}`, payload: '{}' });
    return c;
  };
  const tailOf = (key) => ledger.lineage(key).at(-1).id;

  // silence is not success: with review + Dot closure present but NO check receipt
  // after the fix, VERIFIED is refused
  seedFix('artyhoo/getff#DR1a', 'exec-a', 'fix-a');
  ledger.recordReceipt({ occurrenceId: tailOf('artyhoo/getff#DR1a'), kind: 'change_review', revision: 'fix-a', digest: 'cr:a1', payload: '{}', actor: 'reviewer-z', nowMs: clock });
  ledger.recordReceipt({ occurrenceId: tailOf('artyhoo/getff#DR1a'), kind: 'dot_closure', revision: 'fix-a', digest: 'dc:a1', payload: '{}', actor: 'dot', nowMs: clock });
  expectCode(() => ledger.recordClosure({ findingKey: 'artyhoo/getff#DR1a', disposition: 'VERIFIED', verifier: 'dot', revision: 'fix-a', nowMs: clock }), 'E_NOT_RESOLVABLE', 'verified-requires-successful-check');

  // the success check must run ON the fix revision — another revision's green is not
  // evidence (all other evidence present)
  seedFix('artyhoo/getff#DR1b', 'exec-a', 'fix-b');
  ledger.recordReceipt({ occurrenceId: tailOf('artyhoo/getff#DR1b'), kind: 'check_receipt', revision: 'unrelated-sha', digest: 'c:b1', payload: '{"conclusion":"success"}', nowMs: clock });
  ledger.recordReceipt({ occurrenceId: tailOf('artyhoo/getff#DR1b'), kind: 'change_review', revision: 'fix-b', digest: 'cr:b1', payload: '{}', actor: 'reviewer-z', nowMs: clock });
  ledger.recordReceipt({ occurrenceId: tailOf('artyhoo/getff#DR1b'), kind: 'dot_closure', revision: 'fix-b', digest: 'dc:b1', payload: '{}', actor: 'dot', nowMs: clock });
  expectCode(() => ledger.recordClosure({ findingKey: 'artyhoo/getff#DR1b', disposition: 'VERIFIED', verifier: 'dot', revision: 'fix-b', nowMs: clock }), 'E_NOT_RESOLVABLE', 'verified-requires-check-on-fix-revision');

  // the LATEST check is the current word: an older success under a newer
  // cancelled/pending run is not a passing state
  seedFix('artyhoo/getff#DR1c', 'exec-a', 'fix-c');
  ledger.recordReceipt({ occurrenceId: tailOf('artyhoo/getff#DR1c'), kind: 'check_receipt', revision: 'fix-c', digest: 'c:c1', payload: '{"conclusion":"success"}', nowMs: clock });
  ledger.recordReceipt({ occurrenceId: tailOf('artyhoo/getff#DR1c'), kind: 'check_receipt', revision: 'fix-c', digest: 'c:c2', payload: '{"conclusion":"cancelled"}', nowMs: clock });
  ledger.recordReceipt({ occurrenceId: tailOf('artyhoo/getff#DR1c'), kind: 'change_review', revision: 'fix-c', digest: 'cr:c1', payload: '{}', actor: 'reviewer-z', nowMs: clock });
  ledger.recordReceipt({ occurrenceId: tailOf('artyhoo/getff#DR1c'), kind: 'dot_closure', revision: 'fix-c', digest: 'dc:c1', payload: '{}', actor: 'dot', nowMs: clock });
  expectCode(() => ledger.recordClosure({ findingKey: 'artyhoo/getff#DR1c', disposition: 'VERIFIED', verifier: 'dot', revision: 'fix-c', nowMs: clock }), 'E_NOT_RESOLVABLE', 'verified-requires-current-success');

  // a change review recorded BEFORE the fix is stale evidence
  ledger.recordFindings('rep-fix', [FINDING({ key: 'artyhoo/getff#DR1d' })]);
  const clD = ledger.claimFinding({ findingKey: 'artyhoo/getff#DR1d', owner: 'exec-a', leaseMinutes: 30, nowMs: clock });
  ledger.recordReceipt({ occurrenceId: clD.occurrence_id, kind: 'change_review', revision: 'pre-fix', digest: 'cr:d0', payload: '{}', actor: 'reviewer-z', nowMs: clock });
  ledger.recordFixResponse({ assignmentId: clD.assignment_id, fencingToken: clD.fencing_token, fixRevision: 'fix-d', digest: 'fd:d', payload: '{}' });
  ledger.recordReceipt({ occurrenceId: clD.occurrence_id, kind: 'check_receipt', revision: 'fix-d', digest: 'c:d1', payload: '{"conclusion":"success"}', nowMs: clock });
  ledger.recordReceipt({ occurrenceId: clD.occurrence_id, kind: 'dot_closure', revision: 'fix-d', digest: 'dc:d', payload: '{}', actor: 'dot', nowMs: clock });
  expectCode(() => ledger.recordClosure({ findingKey: 'artyhoo/getff#DR1d', disposition: 'VERIFIED', verifier: 'dot', revision: 'fix-d', nowMs: clock }), 'E_NOT_RESOLVABLE', 'stale-review-before-fix-refused');

  // no self-verification: the reviewing actor must differ from the fix owner
  seedFix('artyhoo/getff#DR1e', 'exec-a', 'fix-e');
  ledger.recordReceipt({ occurrenceId: tailOf('artyhoo/getff#DR1e'), kind: 'check_receipt', revision: 'fix-e', digest: 'c:e1', payload: '{"conclusion":"success"}', nowMs: clock });
  ledger.recordReceipt({ occurrenceId: tailOf('artyhoo/getff#DR1e'), kind: 'change_review', revision: 'fix-e', digest: 'cr:e1', payload: '{}', actor: 'exec-a', nowMs: clock });
  ledger.recordReceipt({ occurrenceId: tailOf('artyhoo/getff#DR1e'), kind: 'dot_closure', revision: 'fix-e', digest: 'dc:e1', payload: '{}', actor: 'dot', nowMs: clock });
  expectCode(() => ledger.recordClosure({ findingKey: 'artyhoo/getff#DR1e', disposition: 'VERIFIED', verifier: 'exec-a', revision: 'fix-e', nowMs: clock }), 'E_NOT_RESOLVABLE', 'self-review-refused');

  // VERIFIED requires an applicable Dot closure receipt
  seedFix('artyhoo/getff#DR1f', 'exec-a', 'fix-f');
  ledger.recordReceipt({ occurrenceId: tailOf('artyhoo/getff#DR1f'), kind: 'check_receipt', revision: 'fix-f', digest: 'c:f1', payload: '{"conclusion":"success"}', nowMs: clock });
  ledger.recordReceipt({ occurrenceId: tailOf('artyhoo/getff#DR1f'), kind: 'change_review', revision: 'fix-f', digest: 'cr:f1', payload: '{}', actor: 'reviewer-z', nowMs: clock });
  expectCode(() => ledger.recordClosure({ findingKey: 'artyhoo/getff#DR1f', disposition: 'VERIFIED', verifier: 'dot', revision: 'fix-f', nowMs: clock }), 'E_NOT_RESOLVABLE', 'verified-requires-dot-closure');

  // a SECOND fix invalidates the evidence gathered for the first one
  const gClaim = seedFix('artyhoo/getff#DR1g', 'exec-a', 'fix-g1');
  ledger.recordReceipt({ occurrenceId: tailOf('artyhoo/getff#DR1g'), kind: 'check_receipt', revision: 'fix-g1', digest: 'c:g1', payload: '{"conclusion":"success"}', nowMs: clock });
  ledger.recordReceipt({ occurrenceId: tailOf('artyhoo/getff#DR1g'), kind: 'change_review', revision: 'fix-g1', digest: 'cr:g1', payload: '{}', actor: 'reviewer-z', nowMs: clock });
  ledger.recordReceipt({ occurrenceId: tailOf('artyhoo/getff#DR1g'), kind: 'dot_closure', revision: 'fix-g1', digest: 'dc:g1', payload: '{}', actor: 'dot', nowMs: clock });
  ledger.recordFixResponse({ assignmentId: gClaim.assignment_id, fencingToken: gClaim.fencing_token, fixRevision: 'fix-g2', digest: 'fd:g2', payload: '{}' });
  expectCode(() => ledger.recordClosure({ findingKey: 'artyhoo/getff#DR1g', disposition: 'VERIFIED', verifier: 'dot', revision: 'fix-g2', nowMs: clock }), 'E_NOT_RESOLVABLE', 'second-fix-invalidates-evidence');
  ledger.recordReceipt({ occurrenceId: tailOf('artyhoo/getff#DR1g'), kind: 'check_receipt', revision: 'fix-g2', digest: 'c:g2', payload: '{"conclusion":"success"}', nowMs: clock });
  ledger.recordReceipt({ occurrenceId: tailOf('artyhoo/getff#DR1g'), kind: 'change_review', revision: 'fix-g2', digest: 'cr:g2', payload: '{}', actor: 'reviewer-z', nowMs: clock });
  ledger.recordReceipt({ occurrenceId: tailOf('artyhoo/getff#DR1g'), kind: 'dot_closure', revision: 'fix-g2', digest: 'dc:g2', payload: '{}', actor: 'dot', nowMs: clock });
  ledger.recordClosure({ findingKey: 'artyhoo/getff#DR1g', disposition: 'VERIFIED', verifier: 'dot', revision: 'fix-g2', nowMs: clock });
  if (ledger.getOccurrence(tailOf('artyhoo/getff#DR1g'))?.state !== 'RESOLVED') fail('post-second-fix closure did not resolve');
  else log('ok evidence-after-second-fix-resolves');

  // RED: the disposition allowlist is enforced
  ledger.recordFindings('rep-2', [FINDING({ key: 'artyhoo/getff#F3' })]);
  expectCode(() => ledger.recordClosure({ findingKey: 'artyhoo/getff#F3', disposition: 'JUST_BECAUSE', verifier: 'dot', revision: 'fix-1', nowMs: clock }), 'E_DISPOSITION', 'disposition-allowlist');

  // DR-R1: the evidence dispositions need evidence too
  expectCode(() => ledger.recordClosure({ findingKey: 'artyhoo/getff#F3', disposition: 'ALREADY_FIXED', verifier: 'dot', revision: 'fix-1', nowMs: clock }), 'E_NOT_RESOLVABLE', 'already-fixed-requires-evidence');
  ledger.recordReceipt({ occurrenceId: tailOf('artyhoo/getff#F3'), kind: 'check_receipt', revision: 'fix-1', digest: 'c:f3', payload: '{"conclusion":"success"}', nowMs: clock });
  ledger.recordClosure({ findingKey: 'artyhoo/getff#F3', disposition: 'ALREADY_FIXED', verifier: 'dot', revision: 'fix-1', nowMs: clock });
  if (ledger.getOccurrence(tailOf('artyhoo/getff#F3'))?.state !== 'RESOLVED') fail('ALREADY_FIXED closure did not resolve');
  else log('ok already-fixed-with-evidence-resolves');

  ledger.recordFindings('rep-2', [FINDING({ key: 'artyhoo/getff#F4' })]);
  expectCode(() => ledger.recordClosure({ findingKey: 'artyhoo/getff#F4', disposition: 'REJECTED_WITH_EVIDENCE', verifier: 'dot', revision: 'fix-1', nowMs: clock }), 'E_NOT_RESOLVABLE', 'rejected-requires-evidence');
  ledger.recordReceipt({ occurrenceId: tailOf('artyhoo/getff#F4'), kind: 'change_review', revision: 'fix-1', digest: 'cr:f4', payload: '{"basis":"duplicate of F1"}', actor: 'reviewer-z', nowMs: clock });
  ledger.recordClosure({ findingKey: 'artyhoo/getff#F4', disposition: 'REJECTED_WITH_EVIDENCE', verifier: 'dot', revision: 'fix-1', nowMs: clock });
  if (ledger.getOccurrence(tailOf('artyhoo/getff#F4'))?.state !== 'RESOLVED') fail('REJECTED_WITH_EVIDENCE closure did not resolve');
  else log('ok rejected-with-evidence-resolves');

  // ── DR-R2: atomic repository/PR ownership across findings/occurrences ─────────
  // Real report chains (claim → submit → recordFindings) so occurrences carry the
  // PR scope the fence operates on.
  const TUPLE = (prNode, head) => ({
    repository_id: 77, pr_node_id: prNode,
    base_ref: 'staging', base_sha: 'b'.repeat(40), head_sha: head,
    merge_base_sha: 'a'.repeat(40), tested_merge_sha: 'd'.repeat(40),
    policy_sha256: 'p'.repeat(64), protocol_version: 'dot-staging-review/1.0',
  });
  const seedReport = (prNode, head, keys) => {
    const claimed = ledger.claimGeneration({ tuple: TUPLE(prNode, head), reviewerId: 7, maxAttemptsPerTuple: 5, leaseMinutes: 30, nowMs: clock });
    const payload = JSON.stringify({ verdict: 'REVISE', head, findings: keys.map((key) => ({ id: key })) });
    const rec = ledger.submitReport({
      claimId: claimed.claim.claim_id, reviewerId: 7,
      digest: createHash('sha256').update(payload).digest('hex'),
      payload, verdict: 'REVISE', kind: 'admission', leaseMinutes: 30, nowMs: clock,
    });
    ledger.recordFindings(rec.report_id, keys.map((key) => FINDING({ key })));
    return rec.report_id;
  };

  seedReport('PRK', 'h'.repeat(40), ['artyhoo/getff#F5']);
  const claimA = ledger.claimFinding({ findingKey: 'artyhoo/getff#F5', owner: 'exec-a', leaseMinutes: 30, nowMs: clock });

  // recurrence while A is active: B cannot claim the new occurrence
  seedReport('PRK', 'i'.repeat(40), ['artyhoo/getff#F5']);
  expectCode(() => ledger.claimFinding({ findingKey: 'artyhoo/getff#F5', owner: 'exec-b', leaseMinutes: 30, nowMs: clock }), 'E_ALREADY_CLAIMED', 'recurrence-claim-refused');
  // A's assignment followed the tail: a fix response lands on the NEWEST occurrence
  const tailF5 = ledger.lineage('artyhoo/getff#F5').at(-1).id;
  const fixRes = ledger.recordFixResponse({ assignmentId: claimA.assignment_id, fencingToken: claimA.fencing_token, fixRevision: 'fix-k1', digest: 'fd:k1', payload: '{}' });
  if (fixRes.occurrence_id !== tailF5) fail(`rebind: fix landed on ${fixRes.occurrence_id?.slice(0, 6)}, tail is ${tailF5?.slice(0, 6)}`);
  else log('ok claim-follows-recurrence-tail');

  // a different finding of the SAME PR is fenced by the same ownership
  seedReport('PRK', 'j'.repeat(40), ['artyhoo/getff#F6']);
  expectCode(() => ledger.claimFinding({ findingKey: 'artyhoo/getff#F6', owner: 'exec-b', leaseMinutes: 30, nowMs: clock }), 'E_ALREADY_CLAIMED', 'pr-scope-single-owner');

  // an expired claim holds replacement across the WHOLE scope until an explicit revoke
  tick(31);
  expectCode(() => ledger.claimFinding({ findingKey: 'artyhoo/getff#F6', owner: 'exec-b', leaseMinutes: 30, nowMs: clock }), 'E_CESSATION_UNKNOWN', 'cessation-scope-wide');
  ledger.revokeClaim({ assignmentId: claimA.assignment_id, reason: 'coordinator reconciled cessation: no push landed', nowMs: clock });
  const claimF6 = ledger.claimFinding({ findingKey: 'artyhoo/getff#F6', owner: 'exec-b', leaseMinutes: 30, nowMs: clock });
  if (!claimF6.assignment_id) fail('revoke did not free the scope');
  else log('ok revoke-frees-whole-scope');

  // a DIFFERENT PR is not fenced by PR_1's ownership
  seedReport('PRL', 'k'.repeat(40), ['artyhoo/getff#F7']);
  const claimF7 = ledger.claimFinding({ findingKey: 'artyhoo/getff#F7', owner: 'exec-b', leaseMinutes: 30, nowMs: clock });
  if (!claimF7.assignment_id) fail('cross-PR claim was fenced');
  else log('ok cross-pr-not-fenced');

  // the fence survives a restart: a second connection sees the committed claim
  const ledgerLive = openLedger(`${tmp}/findings.sqlite`);
  expectCode(() => ledgerLive.claimFinding({ findingKey: 'artyhoo/getff#F5', owner: 'exec-c', leaseMinutes: 30, nowMs: clock }), 'E_ALREADY_CLAIMED', 'fence-survives-reopen');
  ledgerLive.close?.();

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

  // ── increment 5: protocol record consumers (fix_response / closure_receipt) ───
  // A fix_response record binds by assignment + claimed owner: it arrives through
  // the coordinator's authenticated channel, not the reviewer intake, so the
  // owner match (not a live fencing token) is the binding — a REVOKED assignment
  // refuses exactly like a stale token.
  const ledger3 = openLedger(`${tmp}/findings.sqlite`);
  ledger3.recordFindings('rep-fixrec', [FINDING({ key: 'artyhoo/getff#F8' })]);
  const claimF8 = ledger3.claimFinding({ findingKey: 'artyhoo/getff#F8', owner: 'exec-a', leaseMinutes: 30, nowMs: clock });
  ledger3.applyFixResponseRecord({
    assignmentId: claimF8.assignment_id, claimedBy: 'exec-a', fixRevision: 'fix-8',
    findingKeys: ['artyhoo/getff#F8'],
    mechanicalReceipts: [{ context: 'dot-gate suites', reference: 'run 1/job/x', conclusion: 'success' }],
    digest: 'fixrec-8', payload: '{"finding_ids":["artyhoo/getff#F8"]}', nowMs: clock,
  });
  if (ledger3.getOccurrence(claimF8.occurrence_id)?.state !== 'VERIFYING') fail('fix record did not move VERIFYING');
  else log('ok fix-response-record-moves-verifying');
  // the mapped mechanical receipt IS closure evidence — full chain resolves
  ledger3.recordReceipt({ occurrenceId: claimF8.occurrence_id, kind: 'change_review', revision: 'fix-8', digest: 'cr-8', payload: '{}', actor: 'reviewer-z', nowMs: clock });
  ledger3.recordReceipt({ occurrenceId: claimF8.occurrence_id, kind: 'dot_closure', revision: 'fix-8', digest: 'dc-8', payload: '{}', actor: 'dot', nowMs: clock });
  ledger3.applyClosureReceipt({ findingKeys: ['artyhoo/getff#F8'], verifiedBy: 'dot/primary', disposition: 'RESOLVED', revision: 'fix-8', nowMs: clock });
  if (ledger3.getOccurrence(claimF8.occurrence_id)?.state !== 'RESOLVED') fail('closure record did not resolve');
  else log('ok closure-receipt-resolves');

  // refusals: revoked assignment, wrong owner, key mismatch, unproven closure
  ledger3.recordFindings('rep-fixrec', [FINDING({ key: 'artyhoo/getff#F9' })]);
  const claimF9 = ledger3.claimFinding({ findingKey: 'artyhoo/getff#F9', owner: 'exec-a', leaseMinutes: 30, nowMs: clock });
  ledger3.revokeClaim({ assignmentId: claimF9.assignment_id, reason: 'reassigned', nowMs: clock });
  expectCode(() => ledger3.applyFixResponseRecord({ assignmentId: claimF9.assignment_id, claimedBy: 'exec-a', fixRevision: 'x', findingKeys: ['artyhoo/getff#F9'], digest: 'd', payload: '{}' }), 'E_FENCING', 'fix-record-revoked-assignment-refused');
  ledger3.recordFindings('rep-fixrec', [FINDING({ key: 'artyhoo/getff#F10' })]);
  const claimF10 = ledger3.claimFinding({ findingKey: 'artyhoo/getff#F10', owner: 'exec-a', leaseMinutes: 30, nowMs: clock });
  expectCode(() => ledger3.applyFixResponseRecord({ assignmentId: claimF10.assignment_id, claimedBy: 'exec-b', fixRevision: 'x', findingKeys: ['artyhoo/getff#F10'], digest: 'd', payload: '{}' }), 'E_IDENTITY', 'fix-record-wrong-owner-refused');
  expectCode(() => ledger3.applyFixResponseRecord({ assignmentId: claimF10.assignment_id, claimedBy: 'exec-a', fixRevision: 'x', findingKeys: ['artyhoo/getff#OTHER'], digest: 'd', payload: '{}' }), 'E_LIMITS', 'fix-record-key-mismatch-refused');
  expectCode(() => ledger3.applyClosureReceipt({ findingKeys: ['artyhoo/getff#F10'], verifiedBy: 'dot/primary', disposition: 'RESOLVED', revision: 'x', nowMs: clock }), 'E_NOT_RESOLVABLE', 'closure-record-unproven-refused');
  ledger3.close?.();
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
  failing-check-keeps-open closure-with-receipts-resolves \
  verified-requires-successful-check verified-requires-check-on-fix-revision \
  verified-requires-current-success stale-review-before-fix-refused \
  self-review-refused verified-requires-dot-closure \
  second-fix-invalidates-evidence evidence-after-second-fix-resolves \
  disposition-allowlist already-fixed-requires-evidence \
  already-fixed-with-evidence-resolves rejected-requires-evidence \
  rejected-with-evidence-resolves \
  recurrence-claim-refused claim-follows-recurrence-tail \
  pr-scope-single-owner cessation-scope-wide revoke-frees-whole-scope \
  cross-pr-not-fenced fence-survives-reopen \
  recurrence-reopens-lineage retry-first retry-reservation-bounded \
  reservation-survives-reopen supersede-keeps-finding-history \
  fix-response-record-moves-verifying closure-receipt-resolves \
  fix-record-revoked-assignment-refused fix-record-wrong-owner-refused \
  fix-record-key-mismatch-refused closure-record-unproven-refused || exit 1
echo "finding-lifecycle.test.sh: all green"
