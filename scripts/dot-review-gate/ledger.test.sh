#!/usr/bin/env bash
# Paired-negative for scripts/dot-review-gate/ledger.mjs.
#
# The ledger is the durable state machine (spec §5/§8): generations keyed by the FULL
# revision tuple (review R3 — a digest over only part of the tuple let retargets and
# policy promotions reuse a spent generation), one-use challenges bound to the
# authenticated reviewer, generation and lease (review R2), immutable reports, and a
# transactional outbox written in the SAME transaction as the state it describes
# (review R10 — separate transactions could leave a consumed report with no delivery
# event). Every RED arm exercises a way unattended execution actually fails. Crash
# safety rests on SQLite transactions; tests run the real engine (node:sqlite).
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
MOD="$DIR/ledger.mjs"
FIX="$(cd "$DIR/../.." && pwd)/tests/dot-review-gate/fixtures/make-admission.mjs"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/dot-ledger-test.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

SCRIPT="$TMP/run-ledger-arms.mjs"
cat > "$SCRIPT" <<'NODE'
const [modPath, fixPath, tmp] = process.argv.slice(2);
const { makeAdmission } = await import(fixPath);
const L = await import(modPath);
const dbPath = `${tmp}/ledger-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`;
const log = (...a) => console.log(...a);
const fail = (m) => { console.log('FAIL ' + m); process.exitCode = 1; };
const sha = (c) => String(c).repeat(40);
const FULL = {
  repository_id: 1231007068,
  pr_node_id: 'PR_1',
  base_ref: 'staging',
  base_sha: sha('b'),
  head_sha: sha('c'),
  merge_base_sha: sha('a'),
  tested_merge_sha: sha('d'),
  policy_sha256: sha('2'),
  protocol_version: 'dot-staging-review/1.0',
};
const attempt = { maxAttemptsPerTuple: 2, leaseMinutes: 120, nowMs: Date.parse('2026-10-05T12:00:00Z') };

try {
  await (async () => {
    const ledger = L.openLedger(dbPath);

    const submit = (ledger2, claimId, over = {}) => ledger2.submitReport({
      claimId,
      reviewerId: 555001,
      digest: L.payloadDigest(JSON.stringify(makeAdmission())),
      payload: JSON.stringify(makeAdmission()),
      verdict: 'GO',
      kind: 'admission',
      leaseMinutes: attempt.leaseMinutes,
      nowMs: attempt.nowMs,
      ...over,
    });
    const refused = async (arm, claimId, over, code) => {
      try { await submit(ledger, claimId, over); fail(`${arm} accepted`); }
      catch (e) { if (e.code !== code) fail(`${arm} wrong code ${e.code}, wanted ${code}`); else log(`ok ${arm}`); }
    };

    // ── generation lifecycle: claim binds challenge + outbox in one tx ─────────
    const g1 = ledger.claimGeneration({ tuple: FULL, reviewerId: 555001, ...attempt });
    if (g1.generation.state !== 'CLAIMED') fail(`claimGeneration state ${g1.generation.state}`);
    else log('ok generation-claimed');

    // ── R2: consumption binds reviewer, generation, lease, tuple ───────────────
    await refused('wrong-reviewer-refused', g1.claim.claim_id, { reviewerId: 999999 }, 'E_REVIEWER');
    await refused('generation-binding-refused', g1.claim.claim_id, { assertedGenerationSeq: 999999 }, 'E_GENERATION');
    await refused('lease-expired-refused', g1.claim.claim_id, { nowMs: attempt.nowMs + 121 * 60 * 1000 }, 'E_LEASE_EXPIRED');

    const stored = submit(ledger, g1.claim.claim_id);
    const replay = submit(ledger, g1.claim.claim_id);
    if (stored.report_id !== replay.report_id || !replay.replayed) fail('replay broke');
    else log('ok replay-same-receipt');
    try { submit(ledger, g1.claim.claim_id, { digest: 'deadbeef', payload: '{}', verdict: 'STOP' }); fail('conflicting payload accepted'); }
    catch (e) { if (e.code !== 'E_CONFLICT') fail(`conflict wrong code ${e.code}`); else log('ok conflict-rejected'); }
    await refused('replay-by-other-reviewer-refused', g1.claim.claim_id, { reviewerId: 999999 }, 'E_REVIEWER');

    // ── DR-R3: tuple drift at consume time ARCHIVES the report as history ──────
    // (separate PR so the g1 generation stays untouched for the terminal arms)
    const g2 = ledger.claimGeneration({ tuple: { ...FULL, pr_node_id: 'PR_OTHER' }, reviewerId: 555001, ...attempt });
    const driftPayload = JSON.stringify({ ...makeAdmission(), summary: 'issued on PR_OTHER, arrived late' });
    const drifted = submit(ledger, g2.claim.claim_id, { digest: L.payloadDigest(driftPayload), payload: driftPayload, liveTupleDigest: L.tupleDigest(FULL) + 'x' });
    if (drifted.replayed || drifted.superseded !== true || drifted.admitted !== false) fail(`drift submit ${JSON.stringify(drifted)}`);
    else log('ok tuple-drift-archives-as-history');
    const driftedRow = ledger.getReport(drifted.report_id);
    if (!driftedRow.superseded_at) fail('drift record carries no superseded_at');
    else log('ok drift-record-marked-superseded');

    // ── terminal generation: no new consumption, no fresh challenge ────────────
    ledger.transitionGeneration(g1.generation.id, 'VALIDATING');
    ledger.transitionGeneration(g1.generation.id, 'AUTHORIZED');
    try { submit(ledger, g1.claim.claim_id, { digest: 'other-digest', payload: '{"x":1}', verdict: 'STOP' }); fail('terminal generation accepted new payload'); }
    catch (e) { if (e.code !== 'E_CONFLICT') fail(`terminal consume wrong code ${e.code}`); else log('ok terminal-consume-refused'); }
    try { ledger.issueChallenge(g1.generation.id, FULL, 555001, attempt); fail('challenge issued on terminal generation'); }
    catch (e) { if (e.code !== 'E_NOT_CLAIMABLE') fail(`terminal challenge wrong code ${e.code}`); else log('ok challenge-rejected-on-terminal'); }

    // ── R3: reopen a terminal tuple → NEW epoch generation, history preserved ──
    const reopened = ledger.beginGeneration(FULL);
    if (reopened.id === g1.generation.id || reopened.epoch !== 2) fail(`reopen epoch ${reopened.epoch} / reused id`);
    else log('ok terminal-reopen-new-epoch');

    // ── R3: every load-bearing tuple field changes the generation identity ─────
    for (const [arm, patch] of [
      ['base-ref', { base_ref: 'main' }],
      ['merge-base', { merge_base_sha: sha('7') }],
      ['M', { tested_merge_sha: sha('8') }],
      ['policy', { policy_sha256: sha('9') }],
      ['protocol', { protocol_version: 'dot-staging-review/2.0' }],
    ]) {
      const g = ledger.beginGeneration({ ...FULL, ...patch });
      if (g.id === reopened.id || g.tuple_digest === reopened.tuple_digest) fail(`tuple ${arm} change reused generation`);
      else log(`ok tuple-${arm}-changes-generation`);
    }

    // ── supersede on tuple change flips only IN-FLIGHT generations ─────────────
    const genOld = ledger.beginGeneration({ ...FULL, head_sha: sha('1') });
    const genNew = ledger.beginGeneration({ ...FULL, head_sha: sha('2') });
    if (ledger.getGeneration(genOld.id).state !== 'SUPERSEDED') fail(`old generation state ${ledger.getGeneration(genOld.id).state}`);
    else log('ok supersede-on-tuple-change');
    void genNew;

    // issuing a challenge against a generation whose STORED tuple differs
    try { ledger.issueChallenge(genOld.id, { ...FULL, head_sha: sha('2') }, 555001, attempt); fail('tuple mismatch at issue accepted'); }
    catch (e) { if (e.code !== 'E_TUPLE_MISMATCH') fail(`issue tuple check wrong code ${e.code}`); else log('ok challenge-verifies-stored-tuple'); }

    // ── attempts exhausted on the same tuple (consumed attempts count) ─────────
    try {
      const a1 = ledger.claimGeneration({ tuple: { ...FULL, base_ref: 'attempt-branch' }, reviewerId: 555001, ...attempt });
      ledger.submitReport({ claimId: a1.claim.claim_id, reviewerId: 555001, digest: 'p1', payload: 'p1', verdict: 'GO', kind: 'admission', leaseMinutes: attempt.leaseMinutes, nowMs: attempt.nowMs });
      const a2 = ledger.claimGeneration({ tuple: { ...FULL, base_ref: 'attempt-branch' }, reviewerId: 555001, ...attempt, nowMs: attempt.nowMs + 1 });
      ledger.submitReport({ claimId: a2.claim.claim_id, reviewerId: 555001, digest: 'p2', payload: 'p2', verdict: 'GO', kind: 'admission', leaseMinutes: attempt.leaseMinutes, nowMs: attempt.nowMs + 1 });
      ledger.claimGeneration({ tuple: { ...FULL, base_ref: 'attempt-branch' }, reviewerId: 555001, ...attempt, nowMs: attempt.nowMs + 2 });
      fail('attempt 3 accepted');
    } catch (e) { if (e.code !== 'E_EXHAUSTED') fail(`exhausted wrong code ${e.code}`); else log('ok attempts-exhausted'); }

    // unknown claim
    try { submit(ledger, '00000000-0000-4000-8000-000000000000'); fail('unknown claim accepted'); }
    catch (e) { if (e.code !== 'E_NOT_FOUND') fail(`unknown claim wrong code ${e.code}`); else log('ok unknown-claim'); }

    // expired claims no longer count as active (lease-aware active counting)
    const expGen = ledger.claimGeneration({ tuple: { ...FULL, base_ref: 'lease-branch' }, reviewerId: 555001, ...attempt });
    const activeFresh = ledger.countActiveClaims(FULL.pr_node_id, { nowMs: attempt.nowMs + 1000, leaseMinutes: attempt.leaseMinutes });
    const activeStale = ledger.countActiveClaims(FULL.pr_node_id, { nowMs: attempt.nowMs + 121 * 60 * 1000, leaseMinutes: attempt.leaseMinutes });
    if (activeFresh < 1 || activeStale !== 0) fail(`active claims fresh=${activeFresh} stale=${activeStale}`);
    else log('ok lease-aware-active-claims');
    void expGen;

    // ── R10: submission + outbox in ONE transaction ────────────────────────────
    const faulted = L.openLedger(`${tmp}/fault.sqlite`, { faultAfter: 'report-insert' });
    const fGen = faulted.claimGeneration({ tuple: { ...FULL, base_ref: 'fault-branch' }, reviewerId: 555001, ...attempt });
    try {
      faulted.submitReport({
        claimId: fGen.claim.claim_id, reviewerId: 555001,
        digest: L.payloadDigest('payload-a'), payload: 'payload-a', verdict: 'GO', kind: 'admission',
        leaseMinutes: attempt.leaseMinutes, nowMs: attempt.nowMs,
      });
      fail('fault injection did not fire');
    } catch (e) {
      if (e.message !== 'fault-after:report-insert') fail(`unexpected fault error ${e.message}`);
      const after = L.openLedger(`${tmp}/fault.sqlite`);
      const counts = after.counts();
      const submittedEvents = after.outboxClaimBatch(100).filter((r) => r.event_type === 'report.submitted');
      if (counts.reports !== 0 || submittedEvents.length !== 0) fail(`rollback left state: ${JSON.stringify(counts)} submitted-events=${submittedEvents.length}`);
      else if (after.getGeneration(fGen.generation.id).state === 'SUBMITTED') fail('state advanced despite rollback');
      else log('ok submission-outbox-atomic-on-fault');
    }

    // crash-restart recovery: the enqueued event drains exactly once after reopen
    const recPath = `${tmp}/recover.sqlite`;
    const rec1 = L.openLedger(recPath);
    const rGen = rec1.claimGeneration({ tuple: { ...FULL, base_ref: 'recover-branch' }, reviewerId: 555001, ...attempt });
    const rec = rec1.submitReport({
      claimId: rGen.claim.claim_id, reviewerId: 555001,
      digest: L.payloadDigest('payload-b'), payload: 'payload-b', verdict: 'GO', kind: 'admission',
      leaseMinutes: attempt.leaseMinutes, nowMs: attempt.nowMs,
    });
    const rec2 = L.openLedger(recPath); // fresh process view of the same file
    let batch = rec2.outboxClaimBatch(10);
    const submittedEvents = batch.filter((r) => r.event_type === 'report.submitted');
    if (submittedEvents.length !== 1) fail(`outbox after restart: ${JSON.stringify(batch.map((b) => b.event_type))}`);
    else {
      for (const row of batch) rec2.outboxMarkPublished(row.id);
      log('ok restart-drains-single-publication');
    }
    const rec3 = L.openLedger(recPath);
    if (rec3.outboxClaimBatch(10).length !== 0) fail('published event re-claimed after restart');
    void rec; void rec3;

    // ── outbox dedup + backup/restore (original contract) ──────────────────────
    const o1 = ledger.outboxEnqueue('report.submitted', { id: 1 }, 'dedup-1');
    const o1b = ledger.outboxEnqueue('report.submitted', { id: 1 }, 'dedup-1');
    if (o1.id !== o1b.id) fail('outbox dedup created second row');
    const batch1 = ledger.outboxClaimBatch(100).filter((r) => r.dedup_key === 'dedup-1');
    if (batch1.length !== 1) fail(`outbox dedup-1 rows ${batch1.length}, want 1`);
    ledger.outboxMarkPublished(o1.id);
    if (ledger.outboxClaimBatch(100).some((r) => r.dedup_key === 'dedup-1')) fail('published row re-claimed');
    log('ok outbox-dedup-and-claim');

    // ── DR-R5: a claimed batch is RESERVED against concurrent drains ───────────
    const resLedger = L.openLedger(`${tmp}/reserve.sqlite`);
    const RES_NOW = Date.parse('2026-10-06T12:00:00Z');
    resLedger.outboxEnqueue('report.submitted', { report_id: 'r1' }, 'res:1');
    resLedger.outboxEnqueue('report.submitted', { report_id: 'r2' }, 'res:2');
    const resFirst = resLedger.outboxClaimBatch(10, { nowMs: RES_NOW, claimLeaseMs: 60_000 });
    if (resFirst.length !== 2) fail(`reservation first claim ${resFirst.length}`);
    else log('ok reservation-first-claim');
    const resSecond = resLedger.outboxClaimBatch(10, { nowMs: RES_NOW + 30_000, claimLeaseMs: 60_000 });
    if (resSecond.length !== 0) fail(`a concurrent drain re-claimed ${resSecond.length} reserved rows`);
    else log('ok concurrent-drain-reserved');
    const resThird = resLedger.outboxClaimBatch(10, { nowMs: RES_NOW + 120_000, claimLeaseMs: 60_000 });
    if (resThird.length !== 2) fail(`a lapsed claim lease was not recoverable: ${resThird.length}`);
    else log('ok stale-lease-recovered');
    resLedger.close?.();

    const backupPath = `${tmp}/backup-${Date.now()}.sqlite`;
    ledger.backup(backupPath);
    ledger.outboxEnqueue('post.backup', {}, 'dedup-2'); // mutate after backup
    const restored = L.restoreLedger(backupPath, `${tmp}/restored-${Date.now()}.sqlite`);
    if (restored.getGeneration(g1.generation.id).state !== 'AUTHORIZED') fail('restore lost generation state');
    if (restored.outboxClaimBatch(10).some((r) => r.dedup_key === 'dedup-2')) fail('restore picked up post-backup row');
    log('ok backup-restore-roundtrip');

    try { L.restoreLedger(`${tmp}/missing-${Date.now()}.sqlite`, `${tmp}/x.sqlite`); fail('missing backup restored'); }
    catch { log('ok missing-backup-rejected'); }
  })();
} catch (e) {
  fail(`unexpected: ${e.stack?.split('\n').slice(0, 2).join(' | ')}`);
}
NODE

# shellcheck disable=SC1091
source "$DIR/suite-harness.sh"
out="$(node "$SCRIPT" "$MOD" "$FIX" "$TMP" 2>&1)"; status=$?
assert_suite_arms "ledger.test.sh" "$status" "$out" \
  generation-claimed \
  wrong-reviewer-refused generation-binding-refused \
  lease-expired-refused replay-same-receipt conflict-rejected replay-by-other-reviewer-refused \
  tuple-drift-archives-as-history drift-record-marked-superseded \
  terminal-consume-refused challenge-rejected-on-terminal terminal-reopen-new-epoch \
  tuple-base-ref-changes-generation tuple-merge-base-changes-generation \
  tuple-M-changes-generation tuple-policy-changes-generation tuple-protocol-changes-generation \
  supersede-on-tuple-change challenge-verifies-stored-tuple attempts-exhausted unknown-claim \
  lease-aware-active-claims submission-outbox-atomic-on-fault restart-drains-single-publication \
  outbox-dedup-and-claim reservation-first-claim concurrent-drain-reserved \
  stale-lease-recovered backup-restore-roundtrip missing-backup-rejected || exit 1
echo "ledger.test.sh: all green"
