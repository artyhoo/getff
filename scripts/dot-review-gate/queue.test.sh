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
const pr = (number, over = {}) => ({ number, node_id: `PR_${number}`, draft: false, ready_at: `2026-10-0${number}T00:00:00Z`, merged_at: `2026-10-0${number}T00:00:00Z`, ...over });
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
  merged-newest-first reviewed-merged-not-requeued reservation-no-double-hand \
  reservation-survives-restart lapsed-lease-recovers new-arrival-no-skip-no-duplicate \
  already-fixed-no-fix-launch still-present-finds-remediation || exit 1
echo "queue.test.sh: all green"
