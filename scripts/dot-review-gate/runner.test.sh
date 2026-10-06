#!/usr/bin/env bash
# Paired-negative for scripts/dot-review-gate/runner.mjs — the bounded runtime's
# one-cycle deterministic consumer.
#
# Contract pinned here:
#   - ONE cycle composes the packet's chain: discovery → check qualification →
#     revision-keyed persistent queue → registration/ownership → PERSISTED budget
#     reservation BEFORE dispatch → coordination dispatch/ACK → receipt intake
#     (the injected real outbox consumer) → recovery — with DI adapters only;
#   - an UNREGISTERED PR holds (E_UNREGISTERED) — admission default-off at the
#     runtime boundary, the work stays queued and visible;
#   - missing limits or quota pause disable the hand-out entirely and nothing
#     dispatches;
#   - the budget reservation is DURABLE and precedes the dispatch: an exhausted
#     per-window bound holds the next cycle's dispatch (E_BUDGET), never silently;
#   - a historical finding revalidates before any fix launch — an already-fixed
#     defect records ALREADY_FIXED and launches nothing;
#   - recovery composes through the cycle (an INTENT stranded by a crash is
#     re-delivered with its ORIGINAL payload by the same cycle);
#   - counters are observed, not fabricated: an empty destination reports zero
#     dispatched with no invented rows;
#   - the dispatch is a coordination message — the suite names it dispatch and
#     never "autonomous".
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/dot-runner-test.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

SCRIPT="$TMP/run-runner-arms.mjs"
cat > "$SCRIPT" <<'NODE'
const [runnerPath, ledgerPath, budgetsPath, queuePath, adapterPath, fixPath, tmp] = process.argv.slice(2);
const { runCycle } = await import(runnerPath);
const { openLedger } = await import(ledgerPath);
const { createBudgets } = await import(budgetsPath);
const { buildQueue } = await import(queuePath);
const { createCcAdapter } = await import(adapterPath);
const { makePolicyFixture } = await import(fixPath);
const { mkdirSync, writeFileSync, existsSync, readFileSync } = await import('node:fs');

const log = (...a) => console.log(...a);
const fail = (m) => { console.log('FAIL ' + m); process.exitCode = 1; };

const NODE = 'PR_kwDOM9YQhs6AbCdEfGh';
const LIMITS = { max_launches_per_window: 2, window_minutes: 60, max_fix_rounds_per_occurrence: 2, max_work_per_pr: 4, coalesce_minutes: 10, max_active_claims: 1, max_attempts_per_tuple: 5, claim_lease_minutes: 120 };
const policy = makePolicyFixture({ limits: LIMITS });
const ledger = openLedger(`${tmp}/runner.sqlite`);
const budgets = createBudgets({ ledger, limits: LIMITS });
const coordDir = `${tmp}/coord`;
mkdirSync(coordDir, { recursive: true });
const adapter = createCcAdapter({ ledger, coordinationDir: coordDir, notify: async () => {} });

const DISCOVER_EMPTY = async () => ({ openPrs: [], mergedPrs: [] });
const pr2042 = { number: 2042, node_id: NODE, draft: false, ready_at: '2026-10-06T10:00:00Z' };
const NODE2 = 'PR_kwDOM9YQhs6AbCdEfGh2';
const pr2050 = { number: 2050, node_id: NODE2, draft: false, ready_at: '2026-10-06T10:05:00Z' };
const DISCOVER_ONE = async () => ({ openPrs: [pr2042], mergedPrs: [] });
const NODE3 = 'PR_kwDOM9YQhs6AbCdEfGh3';
const pr2060 = { number: 2060, node_id: NODE3, draft: false, ready_at: '2026-10-06T10:07:00Z' };
const DISCOVER_TWO = async () => ({ openPrs: [pr2042, pr2050], mergedPrs: [] });
const DISCOVER_2060 = async () => ({ openPrs: [pr2060], mergedPrs: [] });

try {
  // RED: the runner module is what this suite pins — import failure IS the RED.

  // GREEN (observed counters): an empty destination reports zeros it observed —
  // no fabricated queue rows, no invented dispatches
  const r0 = await runCycle({ ledger, policy, budgets, adapter, discover: DISCOVER_EMPTY });
  if (r0.queued.length !== 0 || r0.dispatched.length !== 0 || r0.recovered !== 0) {
    fail(`empty destination fabricated work: ${JSON.stringify({ q: r0.queued.length, d: r0.dispatched.length, rec: r0.recovered })}`);
  } else log('ok cycle-empty-destination-observed-zeros');

  // an UNREGISTERED PR holds at the runtime boundary — queued and visible, no dispatch
  const r1 = await runCycle({ ledger, policy, budgets, adapter, discover: DISCOVER_ONE });
  const unreg = r1.held.find((h) => h.code === 'E_UNREGISTERED');
  if (!unreg || r1.dispatched.length !== 0) fail(`unregistered hold ${JSON.stringify(r1.held)} d=${r1.dispatched.length}`);
  else log('ok unregistered-pr-holds-at-runtime');

  // registered + healthy limits → the FIRST dispatch lands, and the persisted
  // per-window bound holds the SECOND PR of the same window (named E_BUDGET):
  // ONE cycle proves both the reservation and its durability
  ledger.insertRegistration({ prNodeId: NODE, prNumber: 2042, coordinator: 'coordinator/test', reconciledAt: '2026-10-06T12:00:00Z' });
  ledger.updateRegistration(NODE, { mergeEnabled: true, operatorTransition: 'operator enabled merge for the pilot' });
  ledger.insertRegistration({ prNodeId: NODE2, prNumber: 2050, coordinator: 'coordinator/test', reconciledAt: '2026-10-06T12:00:00Z' });
  ledger.updateRegistration(NODE2, { mergeEnabled: true, operatorTransition: 'operator enabled merge for the pilot' });
  const tight = createBudgets({ ledger, limits: { ...LIMITS, max_launches_per_window: 1 } });
  const r2 = await runCycle({ ledger, policy, budgets: tight, adapter, discover: DISCOVER_TWO });
  if (r2.dispatched.length !== 1 || !r2.dispatched[0].actionId || !r2.dispatched[0].windowId) {
    fail(`dispatch ${JSON.stringify(r2.dispatched)} held=${JSON.stringify(r2.held)}`);
  } else log('ok registered-pr-dispatches-with-reservation');
  // the bound is DURABLE: a fresh registered PR in the SAME window hits the
  // persisted per-launch counter and holds named (E_BUDGET)
  ledger.insertRegistration({ prNodeId: NODE3, prNumber: 2060, coordinator: 'coordinator/test', reconciledAt: '2026-10-06T12:00:00Z' });
  ledger.updateRegistration(NODE3, { mergeEnabled: true, operatorTransition: 'operator enabled merge for the pilot' });
  const r3 = await runCycle({ ledger, policy, budgets: tight, adapter, discover: DISCOVER_2060 });
  const bounded = r3.held.find((h) => h.code === 'E_BUDGET');
  if (!bounded || r3.dispatched.length !== 0) fail(`budget bound ${JSON.stringify(r3.held)} d=${r3.dispatched.length}`);
  else log('ok exhausted-window-bound-holds-second-pr');

  // ACK is its own transition — the next cycle observes the recipient's ack file
  writeFileSync(`${coordDir}/_dot-gate-ack-${r2.dispatched[0].actionId}.md`, `ACK ${r2.dispatched[0].actionId}\n`);
  const r4 = await runCycle({ ledger, policy, budgets, adapter, discover: DISCOVER_EMPTY });
  if (!r4.acked.includes(r2.dispatched[0].actionId)) fail(`ack ${JSON.stringify(r4.acked)}`);
  else log('ok ack-observed-by-next-cycle');

  // missing limits disable the hand-out entirely — nothing dispatches, the hold is named
  const noLimits = createBudgets({ ledger, limits: {} });
  const r5 = await runCycle({ ledger, policy, budgets: noLimits, adapter, discover: DISCOVER_ONE });
  const disabled = r5.held.find((h) => h.code === 'E_UNATTENDED_DISABLED');
  if (!disabled || r5.dispatched.length !== 0) fail(`unattended off ${JSON.stringify(r5.held)} d=${r5.dispatched.length}`);
  else log('ok missing-limits-disable-handout');

  // a HISTORICAL finding revalidates before any fix launch — already-fixed records
  // ALREADY_FIXED and launches nothing (the revalidation probe is injected)
  const gen = ledger.claimGeneration({ tuple: { repository_id: 1231007068, pr_node_id: NODE, base_ref: 'staging', base_sha: 'b'.repeat(40), head_sha: 'f'.repeat(40), merge_base_sha: 'a'.repeat(40), tested_merge_sha: 'd'.repeat(40), policy_sha256: 'p'.repeat(64), protocol_version: 'dot-staging-review/1.0' }, reviewerId: 555001, maxAttemptsPerTuple: 5, leaseMinutes: 30 });
  const payload = JSON.stringify({ probe: 'history' });
  const rec = ledger.submitReport({ claimId: gen.claim.claim_id, reviewerId: 555001, digest: (await import('node:crypto')).createHash('sha256').update(payload).digest('hex'), payload, verdict: 'REVISE', kind: 'admission', leaseMinutes: 30, liveTupleDigest: 'moved'.padEnd(64, '0') });
  ledger.recordFindings(rec.report_id, [{ key: 'artyhoo/getff#H1', requirement: 'r', category: 'correctness', severity: 'major', blocking: true }]);
  // supersede the generation: a NEWER tuple claims the same scope, making the
  // source report terminal and its findings HISTORICAL
  ledger.claimGeneration({ tuple: { repository_id: 1231007068, pr_node_id: NODE, base_ref: 'staging', base_sha: 'b'.repeat(40), head_sha: 'g'.repeat(40), merge_base_sha: 'a'.repeat(40), tested_merge_sha: 'd'.repeat(40), policy_sha256: 'p'.repeat(64), protocol_version: 'dot-staging-review/1.0' }, reviewerId: 555001, maxAttemptsPerTuple: 5, leaseMinutes: 30 });
  const r6 = await runCycle({
    ledger, policy, budgets, adapter,
    discover: DISCOVER_EMPTY,
    revalidateFinding: async () => false,
  });
  const gated = r6.historical.find((h) => h.disposition === 'ALREADY_FIXED');
  if (!gated) fail(`historical gate ${JSON.stringify(r6.historical)}`);
  else log('ok historical-already-fixed-launches-nothing');

  // recovery composes THROUGH the cycle: an INTENT stranded by a crashed write is
  // re-delivered by the cycle with its ORIGINAL payload (SP-5 at runtime)
  const broken = createCcAdapter({ ledger, coordinationDir: `${coordDir}/missing-run/nope`, notify: async () => {} });
  await broken.dispatchAction({ kind: 'fix-assignment', targetSession: 'sess-run', payload: { instruction: 'fix artyhoo/getff#F-77 at rev 7' } }).catch(() => {});
  const strandedId = ledger.coordList('INTENT').filter((a) => a.target === 'sess-run').at(-1)?.id;
  const r7 = await runCycle({ ledger, policy, budgets, adapter, discover: DISCOVER_EMPTY });
  if (r7.recovered < 1 || !strandedId) fail(`recovery ${r7.recovered} stranded=${strandedId}`);
  const recoveredMsg = readFileSync(`${coordDir}/_dot-gate-msg-${strandedId}.md`, 'utf8');
  if (!recoveredMsg.includes('fix artyhoo/getff#F-77 at rev 7')) fail(`recovered payload ${recoveredMsg.slice(0, 160)}`);
  else log('ok recovery-composes-through-cycle');
} catch (e) {
  fail(`unexpected: ${e.stack?.split('\n').slice(0, 2).join(' | ')}`);
}
NODE

# shellcheck disable=SC1091
source "$DIR/suite-harness.sh"
out="$(node "$SCRIPT" \
  "$DIR/runner.mjs" \
  "$DIR/ledger.mjs" \
  "$DIR/budgets.mjs" \
  "$DIR/queue.mjs" \
  "$DIR/cc-adapter.mjs" \
  "$(cd "$DIR/../.." && pwd)/tests/dot-review-gate/fixtures/make-admission.mjs" \
  "$TMP" 2>&1)"; status=$?
assert_suite_arms "runner.test.sh" "$status" "$out" \
  cycle-empty-destination-observed-zeros unregistered-pr-holds-at-runtime \
  registered-pr-dispatches-with-reservation exhausted-window-bound-holds-second-pr \
  ack-observed-by-next-cycle missing-limits-disable-handout \
  historical-already-fixed-launches-nothing recovery-composes-through-cycle || exit 1
echo "runner.test.sh: all green"
