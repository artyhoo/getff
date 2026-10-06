#!/usr/bin/env bash
# Paired-negative for scripts/dot-review-gate/queue.mjs (round-2 increment 7).
#
# The work queue implements the protocol's priority order (dot-review-protocol.md §3):
#   1. pending correction verification — oldest first;
#   2. qualifying open non-draft staging PRs — oldest ready timestamp, then number;
#   3. unreviewed merged staging PRs — newest merged first;
#   with blockers VISIBLE (a non-qualifying PR appears as a blocked entry, never
#   silently dropped) and historical findings gated on revalidation against current
#   staging (an already-fixed defect launches no fix).
# Reservations are durable: restart does not double-hand work; a lapsed lease
# returns the item to the pool; pagination/re-planning is a stable full-set sort.
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/dot-queue-test.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

SCRIPT="$TMP/run-queue-arms.mjs"
cat > "$SCRIPT" <<'NODE'
const [queuePath, ledgerPath, tmp] = process.argv.slice(2);
const { buildQueue, reserveNext, gateHistorical } = await import(queuePath);
const { openLedger } = await import(ledgerPath);
const { createHash } = await import('node:crypto');

const log = (...a) => console.log(...a);
const fail = (m) => { console.log('FAIL ' + m); process.exitCode = 1; };

const ledger = openLedger(`${tmp}/queue.sqlite`);
const NOW = Date.parse('2026-10-06T12:00:00Z');
// R3-6: every PR carries its revision identity (repository_id + head/base/merge
// shas) — the work key is revision-keyed, an item without one is blocked, not
// dispatched
const pr = (number, over = {}) => ({ number, node_id: `PR_${number}`, draft: false, repository_id: 1231007068, head_sha: 'c'.repeat(40), base_sha: 'b'.repeat(40), merge_sha: 'd'.repeat(40), ready_at: `2026-10-0${number}T00:00:00Z`, merged_at: `2026-10-0${number}T00:00:00Z`, ...over });
const qualifying = (p) => p.draft !== true && !p.red;
const OPEN = [pr(3, { ready_at: '2026-10-03T00:00:00Z' }), pr(1, { ready_at: '2026-10-05T00:00:00Z' }), pr(2, { ready_at: '2026-10-05T00:00:00Z' }), pr(4, { red: true }), pr(5, { draft: true })];
const MERGED = [pr(11), pr(13), pr(12)];

try {
  // RED: the module is what this suite pins — import failure IS the RED.

  // verification first, oldest first; then qualifying opens (ready asc, number);
  // blocked PRs stay visible; merged unreviewed newest first
  const seedVerify = (report, key) => {
    ledger.recordFindings(report, [{ key, requirement: 'r', category: 'c', severity: 'major', blocking: true }]);
    const c = ledger.claimFinding({ findingKey: key, owner: 'exec-a', leaseMinutes: 30, nowMs: NOW });
    ledger.recordFixResponse({ assignmentId: c.assignment_id, fencingToken: c.fencing_token, fixRevision: `fix-${key}`, digest: `d-${key}`, payload: '{}' });
  };
  seedVerify('rep-q1', 'Q-V1');
  seedVerify('rep-q2', 'Q-V2');
  const plan = buildQueue({ ledger, openPrs: OPEN, mergedPrs: MERGED, isQualifying: qualifying });
  const kinds = plan.map((i) => i.kind);
  if (plan[0]?.kind !== 'verify' || plan[0]?.key !== 'Q-V1') fail(`verify-first ${JSON.stringify(plan.slice(0, 3))}`);
  else log('ok verification-oldest-first');
  const reviewItems = plan.filter((i) => i.kind === 'review').map((i) => i.pr.number);
  if (JSON.stringify(reviewItems) !== '[3,1,2]') fail(`open order ${JSON.stringify(reviewItems)}`);
  else log('ok open-qualifying-ready-then-number');
  const blocked = plan.filter((i) => i.kind === 'blocked');
  if (!blocked.some((b) => b.pr.number === 4) || !blocked.some((b) => b.pr.number === 5)) fail(`blockers invisible: ${JSON.stringify(blocked)}`);
  else log('ok blocked-stay-visible');
  const mergedItems = plan.filter((i) => i.kind === 'merged').map((i) => i.pr.number);
  if (JSON.stringify(mergedItems) !== '[13,12,11]') fail(`merged order ${JSON.stringify(mergedItems)}`);
  else log('ok merged-newest-first');

  // R3-6: the work key is REVISION-keyed — a new head of the same PR is a NEW work
  // item, never a silent reuse of the old reservation or identity
  const headA = buildQueue({ ledger, openPrs: [pr(20, { head_sha: 'c'.repeat(40) })], mergedPrs: [], isQualifying: qualifying }).find((i) => i.kind === 'review');
  const headB = buildQueue({ ledger, openPrs: [pr(20, { head_sha: '9'.repeat(40) })], mergedPrs: [], isQualifying: qualifying }).find((i) => i.kind === 'review');
  if (!headA || !headB || headA.key === headB.key) fail(`revision key ${JSON.stringify([headA?.key, headB?.key])}`);
  else log('ok revision-keyed-work-identity');

  // R3-6: an item WITHOUT revision identity is blocked (visible, not dispatchable):
  // an unkeyed launch cannot be superseded or bounded
  const noRev = buildQueue({ ledger, openPrs: [pr(21, { head_sha: undefined })], mergedPrs: [pr(22, { merge_sha: undefined })], isQualifying: qualifying });
  const noRevOpen = noRev.find((i) => i.pr?.number === 21);
  const noRevMerged = noRev.find((i) => i.pr?.number === 22);
  if (noRevOpen?.kind !== 'blocked' || !/revision identity unavailable/.test(noRevOpen.reason ?? '')
    || noRevMerged?.kind !== 'blocked' || !/merge identity unavailable/.test(noRevMerged.reason ?? '')) {
    fail(`unkeyed blocked ${JSON.stringify(noRev)}`);
  } else log('ok missing-revision-blocks-visible');

  // R4 (cold review): a PRESENT-but-too-short sha is the same unkeyed launch —
  // a key truncated to 'norev' cannot be superseded or bounded, so the item
  // blocks visibly instead of queueing on a degenerate identity
  const shortRev = buildQueue({ ledger, openPrs: [pr(23, { head_sha: 'abc123def89' })], mergedPrs: [pr(24, { base_sha: 'fed321cba45' })], isQualifying: qualifying });
  const shortOpen = shortRev.find((i) => i.pr?.number === 23);
  const shortMerged = shortRev.find((i) => i.pr?.number === 24);
  if (shortOpen?.kind !== 'blocked' || !/revision identity unavailable/.test(shortOpen.reason ?? '')
    || shortMerged?.kind !== 'blocked' || !/merge identity unavailable/.test(shortMerged.reason ?? '')) {
    fail(`short-sha blocked ${JSON.stringify(shortRev)}`);
  } else log('ok short-revision-blocks-visible');

  // ── D2065-S06: completion is EXACT review identity, never PR-node memory ────
  const QPOLICY = { protocol_version: 'dot-staging-review/1.0', repository_id: 1231007068 };
  const acceptReview = (l, over = {}) => {
    const tuple = { repository_id: 1231007068, pr_node_id: 'PR_12', base_ref: 'staging', base_sha: 'b'.repeat(40), head_sha: 'h'.repeat(40), merge_base_sha: 'a'.repeat(40), tested_merge_sha: 'd'.repeat(40), policy_sha256: 'p'.repeat(64), protocol_version: 'dot-staging-review/1.0', ...over };
    const g = l.claimGeneration({ tuple, reviewerId: 555001, maxAttemptsPerTuple: 8, leaseMinutes: 30 });
    const payload = JSON.stringify({ probe: `review-${JSON.stringify(over)}` });
    return l.submitReport({ claimId: g.claim.claim_id, reviewerId: 555001, digest: createHash('sha256').update(payload).digest('hex'), payload, verdict: 'GO', kind: 'review_report', leaseMinutes: 30, liveTupleDigest: g.generation.tuple_digest });
  };
  // the EXACT accepted review of PR 12's merge (d…/b…) completes only PR 12
  acceptReview(ledger);
  const plan2 = buildQueue({ ledger, policy: QPOLICY, openPrs: [], mergedPrs: MERGED, isQualifying: qualifying });
  if (plan2.some((i) => i.kind === 'merged' && i.pr.number === 12)) fail('exact-reviewed merged PR re-queued');
  else if (!plan2.some((i) => i.kind === 'merged' && i.pr.number === 13)) fail('exact match dropped an unreviewed sibling');
  else log('ok exact-reviewed-identity-not-requeued');
  // an H1 acceptance (merge e…) does NOT cover the H2 merge (d…) of PR 14
  acceptReview(ledger, { pr_node_id: 'PR_14', tested_merge_sha: 'e'.repeat(40) });
  if (!buildQueue({ ledger, policy: QPOLICY, openPrs: [], mergedPrs: [pr(14)], isQualifying: qualifying }).some((i) => i.kind === 'merged' && i.pr.number === 14)) fail('H1 acceptance silently covered H2');
  else log('ok h1-accept-does-not-cover-h2');
  // changed basis / protocol / repository are DISTINCT identities
  acceptReview(ledger, { pr_node_id: 'PR_15', base_sha: 'x'.repeat(40) });
  if (!buildQueue({ ledger, policy: QPOLICY, openPrs: [], mergedPrs: [pr(15)], isQualifying: qualifying }).some((i) => i.kind === 'merged' && i.pr.number === 15)) fail('changed base covered the work');
  else log('ok changed-basis-stays-distinct');
  acceptReview(ledger, { pr_node_id: 'PR_16', protocol_version: 'dot-staging-review/9.9' });
  if (!buildQueue({ ledger, policy: QPOLICY, openPrs: [], mergedPrs: [pr(16)], isQualifying: qualifying }).some((i) => i.kind === 'merged' && i.pr.number === 16)) fail('changed protocol covered the work');
  else log('ok changed-protocol-stays-distinct');
  acceptReview(ledger, { pr_node_id: 'PR_17', repository_id: 999 });
  if (!buildQueue({ ledger, policy: QPOLICY, openPrs: [], mergedPrs: [pr(17)], isQualifying: qualifying }).some((i) => i.kind === 'merged' && i.pr.number === 17)) fail('foreign repository covered the work');
  else log('ok foreign-repository-stays-distinct');
  // a fix_response record alone NEVER satisfies review completion (the exact
  // tuple exists and carries a record — but a fix receipt, not a review)
  { // same tuple, but the stored record is a fix receipt, not a review
    const g2 = ledger.claimGeneration({ tuple: { repository_id: 1231007068, pr_node_id: 'PR_18', base_ref: 'staging', base_sha: 'b'.repeat(40), head_sha: 'h'.repeat(40), merge_base_sha: 'a'.repeat(40), tested_merge_sha: 'd'.repeat(40), policy_sha256: 'p'.repeat(64), protocol_version: 'dot-staging-review/1.0' }, reviewerId: 555001, maxAttemptsPerTuple: 8, leaseMinutes: 30 });
    const fp = JSON.stringify({ probe: 'fix-only' });
    ledger.submitReport({ claimId: g2.claim.claim_id, reviewerId: 555001, digest: createHash('sha256').update(fp).digest('hex'), payload: fp, verdict: 'GO', kind: 'fix_response', leaseMinutes: 30, liveTupleDigest: g2.generation.tuple_digest });
  }
  if (!buildQueue({ ledger, policy: QPOLICY, openPrs: [], mergedPrs: [pr(18)], isQualifying: qualifying }).some((i) => i.kind === 'merged' && i.pr.number === 18)) fail('fix_response satisfied completion');
  else log('ok fix-record-never-satisfies-completion');
  // the LEGACY reviewed-pr marker has no exact evidence: the merged PR stays
  // queued (explicit UNKNOWN, never a silent cover)
  ledger.noteReviewedPr?.('PR_13');
  if (!buildQueue({ ledger, policy: QPOLICY, openPrs: [], mergedPrs: [pr(13)], isQualifying: qualifying }).some((i) => i.kind === 'merged' && i.pr.number === 13)) fail('legacy marker silently covered a merged PR');
  else log('ok legacy-marker-alone-stays-queued');

  // durable reservations: no double-hand (batches are disjoint), restart-persistent,
  // lapsed lease recovers
  const items = plan.filter((i) => ['verify', 'review', 'merged'].includes(i.kind));
  const first = reserveNext({ ledger, items, n: 3, leaseMinutes: 30, nowMs: NOW });
  if (first.length !== 3) fail(`reserve ${first.length}`);
  const keyOf = (i) => `${i.kind}:${i.key}`;
  const second = reserveNext({ ledger, items, n: 3, leaseMinutes: 30, nowMs: NOW });
  const firstKeys = new Set(first.map(keyOf));
  if (second.some((i) => firstKeys.has(keyOf(i)))) fail(`double-hand: ${JSON.stringify(second.map(keyOf))}`);
  else log('ok reservation-no-double-hand');
  const reservedSoFar = new Set([...first, ...second].map(keyOf));
  ledger.close?.();
  const ledger2 = openLedger(`${tmp}/queue.sqlite`);
  const third = reserveNext({ ledger: ledger2, items, n: 3, leaseMinutes: 30, nowMs: NOW + 60_000 });
  if (third.some((i) => reservedSoFar.has(keyOf(i)))) fail(`reservation lost across restart: ${JSON.stringify(third.map(keyOf))}`);
  else log('ok reservation-survives-restart');
  const fourth = reserveNext({ ledger: ledger2, items, n: 3, leaseMinutes: 30, nowMs: NOW + 31 * 60 * 1000 });
  if (fourth.length !== 3) fail(`lapsed lease did not recover: ${fourth.length}`);
  else log('ok lapsed-lease-recovers');

  // a new arrival does not skip or duplicate: the reserved item keeps its slot
  ledger2.noteReviewedPr?.('PR_11');
  const plan3 = buildQueue({ ledger: ledger2, openPrs: [...OPEN, pr(6, { ready_at: '2026-10-01T00:00:00Z' })], mergedPrs: MERGED, isQualifying: qualifying });
  const fifth = reserveNext({ ledger: ledger2, items: plan3.filter((i) => ['verify', 'review', 'merged'].includes(i.kind)), n: 10, leaseMinutes: 30, nowMs: NOW + 31 * 60 * 1000 });
  const unique = new Set(fifth.map((i) => `${i.kind}:${i.key}`));
  if (unique.size !== fifth.length || !fifth.some((i) => i.pr?.number === 6)) fail(`new arrival handling ${JSON.stringify(fifth.map((i) => `${i.kind}:${i.key}`))}`);
  else log('ok new-arrival-no-skip-no-duplicate');

  // historical findings: gated on revalidation — already-fixed launches no fix
  ledger2.recordFindings('rep-hist', [{ key: 'Q-H1', requirement: 'r', category: 'c', severity: 'major', blocking: true }]);
  const hist = ledger2.listHistoricalFindings();
  if (!Array.isArray(hist)) fail(`listHistoricalFindings ${typeof hist}`);
  // ── D2065-S05: revalidation evidence is BOUND or the item holds ─────────────
  const STAGING = '5'.repeat(40);
  const CHECKED = { staging_sha: STAGING, checked_at: '2026-10-06T12:00:00Z' };
  const gatedOff = await gateHistorical({ item: { key: 'Q-H1' }, revalidateFinding: async () => ({ present: false, checked: CHECKED }), currentStagingSha: STAGING });
  if (gatedOff.launch !== false || gatedOff.disposition !== 'ALREADY_FIXED' || gatedOff.evidence?.staging_sha !== STAGING) fail(`gate off ${JSON.stringify(gatedOff)}`);
  else log('ok verified-absent-already-fixed-durable');
  const gatedOn = await gateHistorical({ item: { key: 'Q-H1' }, revalidateFinding: async () => ({ present: true, checked: CHECKED }), currentStagingSha: STAGING });
  if (gatedOn.launch !== true || gatedOn.evidence?.staging_sha !== STAGING) fail(`gate on ${JSON.stringify(gatedOn)}`);
  else log('ok bound-present-launches-with-evidence');
  const rawBool = await gateHistorical({ item: { key: 'Q-H1' }, revalidateFinding: async () => true, currentStagingSha: STAGING });
  if (rawBool.launch !== false || !rawBool.hold || rawBool.code !== 'E_HISTORICAL_UNBOUND') fail(`raw boolean ${JSON.stringify(rawBool)}`);
  else log('ok raw-boolean-is-not-evidence-holds');
  const staleGate = await gateHistorical({ item: { key: 'Q-H1' }, revalidateFinding: async () => ({ present: true, checked: { staging_sha: '9'.repeat(40), checked_at: CHECKED.checked_at } }), currentStagingSha: STAGING });
  if (staleGate.launch !== false || staleGate.code !== 'E_HISTORICAL_STALE') fail(`stale ${JSON.stringify(staleGate)}`);
  else log('ok stale-staging-evidence-holds');
  const unboundGate = await gateHistorical({ item: { key: 'Q-H1' }, revalidateFinding: async () => ({ present: true }), currentStagingSha: STAGING });
  if (unboundGate.launch !== false || unboundGate.code !== 'E_HISTORICAL_UNBOUND') fail(`unbound ${JSON.stringify(unboundGate)}`);
  else log('ok unbound-evidence-holds');
  ledger2.close?.();
} catch (e) {
  fail(`unexpected: ${e.stack?.split('\n').slice(0, 2).join(' | ')}`);
}
NODE

# shellcheck disable=SC1091
source "$DIR/suite-harness.sh"
out="$(node "$SCRIPT" "$DIR/queue.mjs" "$DIR/ledger.mjs" "$TMP" 2>&1)"; status=$?
assert_suite_arms "queue.test.sh" "$status" "$out" \
  verification-oldest-first open-qualifying-ready-then-number blocked-stay-visible \
  merged-newest-first revision-keyed-work-identity missing-revision-blocks-visible \
  short-revision-blocks-visible \
  exact-reviewed-identity-not-requeued h1-accept-does-not-cover-h2 \
  changed-basis-stays-distinct changed-protocol-stays-distinct \
  foreign-repository-stays-distinct fix-record-never-satisfies-completion \
  legacy-marker-alone-stays-queued reservation-no-double-hand \
  reservation-survives-restart lapsed-lease-recovers new-arrival-no-skip-no-duplicate \
  verified-absent-already-fixed-durable bound-present-launches-with-evidence \
  raw-boolean-is-not-evidence-holds stale-staging-evidence-holds \
  unbound-evidence-holds || exit 1
echo "queue.test.sh: all green"
