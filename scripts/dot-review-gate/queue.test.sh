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

  // a merged PR with a recorded review is not re-queued
  ledger.noteReviewedPr?.('PR_12');
  const plan2 = buildQueue({ ledger, openPrs: [], mergedPrs: MERGED, isQualifying: qualifying });
  if (plan2.some((i) => i.kind === 'merged' && i.pr.number === 12)) fail('reviewed merged PR re-queued');
  else log('ok reviewed-merged-not-requeued');

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
  const gatedOff = await gateHistorical({ item: { key: 'Q-H1' }, revalidateFinding: async () => false });
  if (gatedOff.launch !== false || gatedOff.disposition !== 'ALREADY_FIXED') fail(`gate off ${JSON.stringify(gatedOff)}`);
  else log('ok already-fixed-no-fix-launch');
  const gatedOn = await gateHistorical({ item: { key: 'Q-H1' }, revalidateFinding: async () => true });
  if (gatedOn.launch !== true) fail(`gate on ${JSON.stringify(gatedOn)}`);
  else log('ok still-present-finds-remediation');
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
  reviewed-merged-not-requeued reservation-no-double-hand \
  reservation-survives-restart lapsed-lease-recovers new-arrival-no-skip-no-duplicate \
  already-fixed-no-fix-launch still-present-finds-remediation || exit 1
echo "queue.test.sh: all green"
