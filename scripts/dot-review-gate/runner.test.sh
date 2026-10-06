#!/usr/bin/env bash
# Paired-negative for scripts/dot-review-gate/runner.mjs — the bounded runtime's
# one-cycle deterministic consumer.
#
# Contract pinned here:
#   - ONE cycle composes the packet's chain: discovery → check qualification →
#     revision-keyed persistent queue → outstanding-work reconcile → operational
#     authorization gate → PERSISTED budget reservation BEFORE dispatch →
#     coordination dispatch/ACK → receipt intake (the injected real outbox
#     consumer) → finding routing → recovery — with DI adapters only;
#   - R3-5: the operational gate (pause, authorization expiry, limits/quota,
#     ACTIVE registration) is evaluated at EVERY consequential boundary: before
#     the hand-out, AGAIN between reservation and delivery (a state change after
#     reserving is an auditable non-launched outcome), and before recovery — a
#     persisted pending action does not grant permanent permission;
#   - R3-6: work identity is revision-keyed; at most one Dot review is active
#     ACROSS cycles and restarts (reconciled: superseded by a newer revision of
#     the same PR, timed out on a lapsed lease, resolved by an accepted report);
#     delivered packets carry the trusted revision/basis/assignment identity;
#     an unenrolled destination dispatches NOTHING synthetic;
#   - ST-R3-1: the ALREADY_FIXED gate proves cessation of work — zero dispatch,
#     zero launch actions, zero budget consumption, durable evidence, and a
#     still-present control that DOES dispatch;
#   - ST-R3-2: concurrency/priority requirements are tested with budget HEADROOM
#     (the one-slot aggregate budget masked them at the reviewed head);
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
const { createHash } = await import('node:crypto');

const log = (...a) => console.log(...a);
const fail = (m) => { console.log('FAIL ' + m); process.exitCode = 1; };

const REPO = 1231007068;
// ST-R3-2: budget HEADROOM — the one-slot aggregate budget masked concurrency and
// priority defects; every bound under test here is enforced by its own rule, not
// by an exhausted window.
const LIMITS = { max_launches_per_window: 10, window_minutes: 60, max_fix_rounds_per_occurrence: 2, max_work_per_pr: 4, coalesce_minutes: 10, max_active_claims: 1, max_attempts_per_tuple: 8, claim_lease_minutes: 120 };
const policy = makePolicyFixture({ limits: LIMITS });
const ledger = openLedger(`${tmp}/runner.sqlite`);
const budgets = createBudgets({ ledger, limits: LIMITS });
const coordDir = `${tmp}/coord`;
mkdirSync(coordDir, { recursive: true });

// dispatch spy: the observed adapter calls, never inferred counters
let dispatchCalls = 0;
const baseAdapter = createCcAdapter({ ledger, coordinationDir: coordDir, notify: async () => {} });
const adapter = {
  dispatchAction: async (args) => { dispatchCalls += 1; return baseAdapter.dispatchAction(args); },
  pollAcks: (...a) => baseAdapter.pollAcks(...a),
  recoverPending: (...a) => baseAdapter.recoverPending(...a),
  state: (...a) => baseAdapter.state(...a),
};

// R3-6: enrolled targets are RESOLVED — fixtures only, never synthetic defaults
const TARGETS = {
  'review-request': { session: 'sess-dot-review' },
  'fix-assignment': { session: 'sess-executor', owner: 'cc-executor/mechanism-lane' },
  'verify-request': { session: 'sess-verifier' },
};
const resolveTarget = async ({ kind }) => TARGETS[kind] ?? null;

const DISCOVER_EMPTY = async () => ({ openPrs: [], mergedPrs: [] });
// each re-dispatch arm carries a FRESH revision: the durable work reservation is
// per revision-keyed item, so a new head is a new work item (R3-6) — the suite
// leans on that instead of defeating the reservation
const prAt = (headChar) => ({
  number: 2042, node_id: 'PR_kwDOM9YQhs6AbCdEfGh', draft: false, repository_id: REPO,
  head_sha: headChar.repeat(40), base_sha: 'b'.repeat(40), ready_at: '2026-10-06T10:00:00Z',
});
const DISCOVER_2042 = (h) => async () => ({ openPrs: [prAt(h)], mergedPrs: [] });
const pr2050 = { number: 2050, node_id: 'PR_kwDOM9YQhs6AbCdEfGh2', draft: false, repository_id: REPO, head_sha: 'c'.repeat(40), base_sha: 'b'.repeat(40), ready_at: '2026-10-06T10:05:00Z' };
const pr2060 = { number: 2060, node_id: 'PR_kwDOM9YQhs6AbCdEfGh3', draft: false, repository_id: REPO, head_sha: 'c'.repeat(40), base_sha: 'b'.repeat(40), ready_at: '2026-10-06T10:07:00Z' };
const register = (l, node, number) => {
  l.insertRegistration({ prNodeId: node, prNumber: number, coordinator: 'coordinator/test', reconciledAt: '2026-10-06T12:00:00Z' });
  l.updateRegistration(node, { mergeEnabled: true, operatorTransition: 'operator enabled merge for the pilot' });
};
// total coordination rows across EVERY state — a state transition never changes the
// total, so a delta means a NEW row was written (what the cessation arms forbid)
const coordCount = (l) => ['INTENT', 'DELIVERED', 'ACKED', 'CANCELLED', 'DONE'].reduce((n, s) => n + l.coordList(s).length, 0);

// an isolated group: fresh ledger/budgets/adapter (the review bound and work
// reservations are durable ledger state — priority/restart arms must not see
// earlier reviews)
function group(name) {
  const l = openLedger(`${tmp}/runner-${name}.sqlite`);
  const dir = `${tmp}/coord-${name}`;
  mkdirSync(dir, { recursive: true });
  const a = createCcAdapter({ ledger: l, coordinationDir: dir, notify: async () => {} });
  return { l, b: createBudgets({ ledger: l, limits: LIMITS }), a, dir };
}

function seedScoped(l, key, node = 'PR_verify', head = 'f') {
  const tuple = { repository_id: REPO, pr_node_id: node, base_ref: 'staging', base_sha: 'b'.repeat(40), head_sha: head.repeat(40), merge_base_sha: 'a'.repeat(40), tested_merge_sha: 'd'.repeat(40), policy_sha256: 'p'.repeat(64), protocol_version: 'dot-staging-review/1.0' };
  const g = l.claimGeneration({ tuple, reviewerId: 555001, maxAttemptsPerTuple: 8, leaseMinutes: 30 });
  const payload = JSON.stringify({ probe: key });
  const r = l.submitReport({ claimId: g.claim.claim_id, reviewerId: 555001, digest: createHash('sha256').update(payload).digest('hex'), payload, verdict: 'REVISE', kind: 'admission', leaseMinutes: 30, liveTupleDigest: g.generation.tuple_digest });
  l.recordFindings(r.report_id, [{ key, requirement: 'r', category: 'correctness', severity: 'major', blocking: true }]);
}

try {
  // RED: the runner module is what this suite pins — import failure IS the RED.

  // GREEN (observed counters): an empty destination reports zeros it observed —
  // no fabricated queue rows, no invented dispatches
  const r0 = await runCycle({ ledger, policy, budgets, adapter, discover: DISCOVER_EMPTY, resolveTarget });
  if (r0.queued.length !== 0 || r0.dispatched.length !== 0 || r0.recovered !== 0) {
    fail(`empty destination fabricated work: ${JSON.stringify({ q: r0.queued.length, d: r0.dispatched.length, rec: r0.recovered })}`);
  } else log('ok cycle-empty-destination-observed-zeros');

  // an UNREGISTERED PR holds at the runtime boundary — the work stays QUEUED and
  // visible (not dropped), and nothing dispatches
  const r1 = await runCycle({ ledger, policy, budgets, adapter, discover: DISCOVER_2042('1'), resolveTarget });
  const unreg = r1.held.find((h) => h.code === 'E_UNREGISTERED');
  if (!unreg || r1.dispatched.length !== 0 || r1.queued.length < 1) fail(`unregistered hold ${JSON.stringify(r1.held)} d=${r1.dispatched.length} q=${r1.queued.length}`);
  else log('ok unregistered-pr-holds-at-runtime');

  // registered + healthy limits → the review dispatch lands as a COMPLETE packet:
  // mode, the trusted head/base revisions, PR identity and the work key (R3-6 —
  // identifier-only payloads were the finding)
  register(ledger, 'PR_kwDOM9YQhs6AbCdEfGh', 2042);
  register(ledger, pr2050.node_id, 2050);
  const r2 = await runCycle({ ledger, policy, budgets, adapter, discover: async () => ({ openPrs: [prAt('c'), pr2050], mergedPrs: [] }), resolveTarget });
  const disp = r2.dispatched[0];
  if (r2.dispatched.length !== 1 || !disp?.actionId || !disp?.windowId) {
    fail(`dispatch ${JSON.stringify(r2.dispatched)} held=${JSON.stringify(r2.held)}`);
  } else {
    const row = ledger.coordGet(disp.actionId);
    const packet = JSON.parse(row.payload_text);
    if (row.kind !== 'review-request' || packet.mode !== 'OPEN_PR' || packet.revisions?.head_sha !== 'c'.repeat(40)
      || packet.revisions?.base_sha !== 'b'.repeat(40) || packet.pr?.node_id !== 'PR_kwDOM9YQhs6AbCdEfGh' || !packet.work?.item_key) {
      fail(`packet incomplete ${JSON.stringify(packet)}`);
    } else if (disp.target !== 'sess-dot-review') {
      fail(`dispatch went to a non-enrolled target ${disp.target}`);
    } else log('ok registered-pr-dispatches-complete-packet');
  }

  // ACK is its own transition — the next cycle observes the recipient's ack file
  writeFileSync(`${coordDir}/_dot-gate-ack-${disp.actionId}.md`, `ACK ${disp.actionId}\n`);
  const r4 = await runCycle({ ledger, policy, budgets, adapter, discover: DISCOVER_EMPTY, resolveTarget });
  if (!r4.acked.includes(disp.actionId)) fail(`ack ${JSON.stringify(r4.acked)}`);
  else log('ok ack-observed-by-next-cycle');

  // cold-review arm: the receipt-intake step composes THROUGH the cycle — the
  // injected drain's results are counted, not swallowed
  const rDrain = await runCycle({ ledger, policy, budgets, adapter, discover: DISCOVER_EMPTY, drain: async () => [{}, {}], resolveTarget });
  if (rDrain.drained !== 2) fail(`drain step ${rDrain.drained}`);
  else log('ok drain-step-observed');

  // missing limits disable the hand-out entirely — nothing dispatches, the hold is named
  const noLimits = createBudgets({ ledger, limits: {} });
  const r5 = await runCycle({ ledger, policy, budgets: noLimits, adapter, discover: DISCOVER_2042('c'), resolveTarget });
  const disabled = r5.held.find((h) => h.code === 'E_UNATTENDED_DISABLED');
  if (!disabled || r5.dispatched.length !== 0) fail(`unattended off ${JSON.stringify(r5.held)} d=${r5.dispatched.length}`);
  else log('ok missing-limits-disable-handout');

  // the review bound frees only through its journal signals — D2065-S06: an
  // ACCEPTED review report on the EXACT reviewed identity (head c…/base b…, this
  // repository, this protocol) resolves it; PR-node memory alone never does.
  // Resolves r2's review here so the budget arm below isolates the BUDGET rule
  // from the review-count rule
  { // seed: the reviewer's accepted report for the exact OPEN_PR identity r2 dispatched
    const g = ledger.claimGeneration({ tuple: { repository_id: REPO, pr_node_id: 'PR_kwDOM9YQhs6AbCdEfGh', base_ref: 'staging', base_sha: 'b'.repeat(40), head_sha: 'c'.repeat(40), merge_base_sha: 'a'.repeat(40), tested_merge_sha: 'd'.repeat(40), policy_sha256: 'p'.repeat(64), protocol_version: 'dot-staging-review/1.0' }, reviewerId: 555001, maxAttemptsPerTuple: 8, leaseMinutes: 30 });
    const payload = JSON.stringify({ probe: 'r2 review accepted' });
    ledger.submitReport({ claimId: g.claim.claim_id, reviewerId: 555001, digest: createHash('sha256').update(payload).digest('hex'), payload, verdict: 'GO', kind: 'review_report', leaseMinutes: 30, liveTupleDigest: g.generation.tuple_digest });
  }

  // ── R3-5: operational stops at every consequential boundary ──────────────────
  // a stranded INTENT exists (crashed write) — recovery must NOT re-deliver it
  // while paused; the row stays pending, the hold is named
  const broken = createCcAdapter({ ledger, coordinationDir: `${coordDir}/missing-run/nope`, notify: async () => {} });
  await broken.dispatchAction({ kind: 'fix-assignment', targetSession: 'sess-run', payload: { repository_id: REPO, pr_node_id: 'PR_kwDOM9YQhs6AbCdEfGh', instruction: 'fix artyhoo/getff#F-77 at rev 7' } }).catch(() => {});
  const strandedId = ledger.coordList('INTENT').filter((a) => a.target === 'sess-run').at(-1)?.id;
  ledger.setPaused(true);
  const beforePaused = coordCount(ledger);
  const rPaused = await runCycle({ ledger, policy, budgets, adapter, discover: DISCOVER_2042('c'), resolveTarget });
  if (rPaused.held.find((h) => h.code === 'E_PAUSED')?.key !== '*' || rPaused.dispatched.length !== 0
    || rPaused.recoveryHeld?.code !== 'E_PAUSED' || ledger.coordGet(strandedId)?.state !== 'INTENT'
    || coordCount(ledger) !== beforePaused) {
    fail(`paused cycle ${JSON.stringify({ held: rPaused.held, rec: rPaused.recoveryHeld, stranded: ledger.coordGet(strandedId)?.state })}`);
  } else log('ok r35-paused-holds-launch-delivery-and-recovery');

  // resumption follows an explicit valid state transition — the SAME stranded
  // intent is re-delivered with its ORIGINAL payload only after unpause
  ledger.setPaused(false);
  const rResumed = await runCycle({ ledger, policy, budgets, adapter, discover: DISCOVER_EMPTY, resolveTarget });
  const recoveredMsg = existsSync(`${coordDir}/_dot-gate-msg-${strandedId}.md`) ? readFileSync(`${coordDir}/_dot-gate-msg-${strandedId}.md`, 'utf8') : '';
  if (rResumed.recoveryHeld || rResumed.recovered < 1 || !recoveredMsg.includes('fix artyhoo/getff#F-77 at rev 7')) {
    fail(`resume recovery ${JSON.stringify({ rec: rResumed.recovered, hold: rResumed.recoveryHeld, msg: recoveredMsg.slice(0, 80) })}`);
  } else log('ok r35-recovery-composes-after-explicit-resume');

  // a RELEASED registration holds the arm — the state check is an ALLOWLIST
  // (fresh revision: a new work item, the durable reservation must not mask the gate)
  ledger.updateRegistration('PR_kwDOM9YQhs6AbCdEfGh', { state: 'RELEASED', operatorTransition: 'operator released the PR from management' });
  const rReleased = await runCycle({ ledger, policy, budgets, adapter, discover: DISCOVER_2042('e'), resolveTarget });
  const releasedHold = rReleased.held.find((h) => h.code === 'E_UNREGISTERED' && /RELEASED/.test(h.reason));
  if (!releasedHold || rReleased.dispatched.length !== 0) fail(`released ${JSON.stringify(rReleased.held)} d=${rReleased.dispatched.length}`);
  else log('ok r35-released-registration-holds');
  ledger.updateRegistration('PR_kwDOM9YQhs6AbCdEfGh', { state: 'ACTIVE', operatorTransition: 'operator re-registered the PR' });

  // expired authorization holds before any launch
  const expiredPolicy = makePolicyFixture({ limits: LIMITS, authorization_expiry: '2000-01-01T00:00:00Z' });
  const rExpired = await runCycle({ ledger, policy: expiredPolicy, budgets, adapter, discover: DISCOVER_2042('c'), resolveTarget });
  if (!rExpired.held.find((h) => h.code === 'E_AUTH_EXPIRED') || rExpired.dispatched.length !== 0) fail(`expired ${JSON.stringify(rExpired.held)}`);
  else log('ok r35-expired-authorization-holds');

  // a state change BETWEEN reservation and delivery is an auditable non-launched
  // outcome: the reservation stands, nothing dispatches, the hold names it
  const saboteur = {
    ...budgets,
    reserveLaunch: (args) => {
      const out = budgets.reserveLaunch(args);
      ledger.setPaused(true); // the world changes right after the reservation
      return out;
    },
  };
  const callsBeforeFlip = dispatchCalls;
  const rFlip = await runCycle({ ledger, policy, budgets: saboteur, adapter, discover: DISCOVER_2042('f'), resolveTarget });
  const flipHold = rFlip.held.find((h) => h.code === 'E_PAUSED' && /non-launched/.test(h.reason));
  if (!flipHold || dispatchCalls !== callsBeforeFlip) fail(`mid-cycle flip ${JSON.stringify(rFlip.held)} calls=${dispatchCalls - callsBeforeFlip}`);
  else log('ok r35-state-change-after-reservation-is-non-launched');
  ledger.setPaused(false);

  // recovery composes THROUGH the cycle (the stranded intent from the paused arm
  // was already recovered — strand another one to keep the composition arm)
  const broken2 = createCcAdapter({ ledger, coordinationDir: `${coordDir}/missing-run2/nope`, notify: async () => {} });
  await broken2.dispatchAction({ kind: 'fix-assignment', targetSession: 'sess-run2', payload: { repository_id: REPO, pr_node_id: 'PR_kwDOM9YQhs6AbCdEfGh', instruction: 'recover me again at rev 9' } }).catch(() => {});
  const stranded2 = ledger.coordList('INTENT').filter((a) => a.target === 'sess-run2').at(-1)?.id;
  const r7 = await runCycle({ ledger, policy, budgets, adapter, discover: DISCOVER_EMPTY, resolveTarget });
  const msg2 = existsSync(`${coordDir}/_dot-gate-msg-${stranded2}.md`) ? readFileSync(`${coordDir}/_dot-gate-msg-${stranded2}.md`, 'utf8') : '';
  if (r7.recovered < 1 || !msg2.includes('recover me again at rev 9')) fail(`recovery ${r7.recovered} ${msg2.slice(0, 80)}`);
  else log('ok recovery-composes-through-cycle');

  // an enrolled destination is REQUIRED — without resolveTarget nothing synthetic
  // is dispatched (the reviewed head launched 'dot-gate:<kind>' placeholders)
  const callsBeforeNoTarget = dispatchCalls;
  const rNoTarget = await runCycle({ ledger, policy, budgets, adapter, discover: DISCOVER_2042('9') });
  if (!rNoTarget.held.find((h) => h.code === 'E_NO_TARGET') || dispatchCalls !== callsBeforeNoTarget) fail(`no target ${JSON.stringify(rNoTarget.held)}`);
  else log('ok r36-unenrolled-target-dispatches-nothing');

  // the per-window budget bound is DURABLE: a pre-exhausted launch window holds the
  // PR with the named E_BUDGET (the reservation is the ledger's counter row). LAST
  // main-ledger arm — the exhausted counter row is shared ledger state and must not
  // poison the earlier dispatch arms
  register(ledger, pr2060.node_id, 2060);
  const tightWindow = Math.floor(Date.now() / (LIMITS.window_minutes * 60_000));
  ledger.reserveRetry(`launch:${tightWindow}`, 1);
  const tight = createBudgets({ ledger, limits: { ...LIMITS, max_launches_per_window: 1 } });
  const r3 = await runCycle({ ledger, policy, budgets: tight, adapter, discover: async () => ({ openPrs: [pr2060], mergedPrs: [] }), resolveTarget });
  const bounded = r3.held.find((h) => h.code === 'E_BUDGET');
  if (!bounded || r3.dispatched.length !== 0) fail(`budget bound ${JSON.stringify(r3.held)} d=${r3.dispatched.length}`);
  else log('ok exhausted-window-bound-holds-pr');

  // ── R3-6 / ST-R3-2: concurrency, priority, supersession (isolated group L2) ──
  const L2 = group('l2');
  const prA = { number: 3001, node_id: 'PR_kwDOM9YQhs6AbCdEfGhA', draft: false, repository_id: REPO, head_sha: 'c'.repeat(40), base_sha: 'b'.repeat(40), ready_at: '2026-10-06T10:00:00Z' };
  const prB = { number: 3002, node_id: 'PR_kwDOM9YQhs6AbCdEfGhB', draft: false, repository_id: REPO, head_sha: 'c'.repeat(40), base_sha: 'b'.repeat(40), ready_at: '2026-10-06T10:01:00Z' };
  const prC = { number: 3003, node_id: 'PR_kwDOM9YQhs6AbCdEfGhC', draft: false, repository_id: REPO, head_sha: 'c'.repeat(40), base_sha: 'b'.repeat(40), ready_at: '2026-10-06T10:02:00Z' };
  register(L2.l, prA.node_id, 3001);
  register(L2.l, prB.node_id, 3002);
  register(L2.l, prC.node_id, 3003);
  // aggregate budget ABOVE one: TWO review candidates, but only ONE active review
  const rOne = await runCycle({ ledger: L2.l, policy, budgets: L2.b, adapter: L2.a, discover: async () => ({ openPrs: [prA, prB], mergedPrs: [] }), resolveTarget });
  const reviewHolds = rOne.held.filter((h) => h.code === 'E_REVIEW_ACTIVE');
  if (rOne.dispatched.filter((d) => d.kind === 'review-request').length !== 1 || reviewHolds.length !== 1
    || L2.l.coordList('DELIVERED').filter((a) => a.kind === 'review-request').length !== 1) {
    fail(`one-active-review ${JSON.stringify({ d: rOne.dispatched, h: rOne.held })}`);
  } else log('ok r36-one-active-review-despite-budget-headroom');

  // the active review from a PREVIOUS cycle blocks a new launch (restart-safe:
  // fresh budgets/adapter instances, same ledger)
  const freshB = createBudgets({ ledger: L2.l, limits: LIMITS });
  const freshA = createCcAdapter({ ledger: L2.l, coordinationDir: L2.dir, notify: async () => {} });
  const rNext = await runCycle({ ledger: L2.l, policy, budgets: freshB, adapter: freshA, discover: async () => ({ openPrs: [prC], mergedPrs: [] }), resolveTarget });
  if (!rNext.held.find((h) => h.code === 'E_REVIEW_ACTIVE') || rNext.dispatched.length !== 0) fail(`previous-cycle block ${JSON.stringify(rNext.held)}`);
  else log('ok r36-active-review-from-previous-cycle-blocks');

  // a newer head of the SAME PR supersedes the outstanding review and requeues:
  // the H1 action is CANCELLED (recorded reconciliation), H2 dispatches fresh
  const prA_H2 = { ...prA, head_sha: 'd'.repeat(40) };
  const rH2 = await runCycle({ ledger: L2.l, policy, budgets: L2.b, adapter: L2.a, discover: async () => ({ openPrs: [prA_H2], mergedPrs: [] }), resolveTarget });
  const h1Action = L2.l.coordList('DELIVERED').concat(L2.l.coordList('CANCELLED')).find((a) => a.kind === 'review-request' && /3001@c/.test(a.payload_text ?? ''));
  const h2Dispatched = rH2.dispatched.find((d) => d.kind === 'review-request');
  const h1State = h1Action ? L2.l.coordGet(h1Action.id)?.state : undefined;
  if (h1State !== 'CANCELLED' || !h2Dispatched || !/3001@d/.test(L2.l.coordGet(h2Dispatched.actionId)?.payload_text ?? '')) {
    fail(`H1→H2 ${JSON.stringify({ h1: h1State, d: rH2.dispatched, held: rH2.held })}`);
  } else log('ok r36-head-movement-supersedes-and-requeues');

  // an accepted report RESOLVES the active review — the bound frees for the next
  // candidate (the resolution signal is the journal, not a timer)
  const seedTuple = { repository_id: REPO, pr_node_id: prA.node_id, base_ref: 'staging', base_sha: 'b'.repeat(40), head_sha: 'd'.repeat(40), merge_base_sha: 'a'.repeat(40), tested_merge_sha: 'e'.repeat(40), policy_sha256: 'p'.repeat(64), protocol_version: 'dot-staging-review/1.0' };
  const gen = L2.l.claimGeneration({ tuple: seedTuple, reviewerId: 555001, maxAttemptsPerTuple: 8, leaseMinutes: 30 });
  const seedPayload = JSON.stringify({ probe: 'review landed' });
  L2.l.submitReport({ claimId: gen.claim.claim_id, reviewerId: 555001, digest: createHash('sha256').update(seedPayload).digest('hex'), payload: seedPayload, verdict: 'GO', kind: 'admission', leaseMinutes: 30, liveTupleDigest: gen.generation.tuple_digest });
  const prC2 = { ...prC, head_sha: 'e'.repeat(40) };
  const rResolved = await runCycle({ ledger: L2.l, policy, budgets: L2.b, adapter: L2.a, discover: async () => ({ openPrs: [prC2], mergedPrs: [] }), resolveTarget });
  if (rResolved.dispatched.filter((d) => d.kind === 'review-request').length !== 1) fail(`resolution ${JSON.stringify({ d: rResolved.dispatched, h: rResolved.held })}`);
  else log('ok r36-accepted-report-resolves-active-review');

  // open-vs-historical priority: a qualifying open PR and an unreviewed merged PR
  // together — the OPEN review launches; the historical one is HELD (spec §7)
  const L3 = group('l3');
  const prOpen = { number: 3101, node_id: 'PR_kwDOM9YQhs6AbCdEfGhP', draft: false, repository_id: REPO, head_sha: 'c'.repeat(40), base_sha: 'b'.repeat(40), ready_at: '2026-10-06T10:00:00Z' };
  const mergedPr = { number: 3099, node_id: 'PR_kwDOM9YQhs6AbCdEfGhM', repository_id: REPO, merged_at: '2026-10-06T09:00:00Z', merge_sha: 'e'.repeat(40), base_sha: 'b'.repeat(40) };
  register(L3.l, prOpen.node_id, 3101);
  const rPrio = await runCycle({ ledger: L3.l, policy, budgets: L3.b, adapter: L3.a, discover: async () => ({ openPrs: [prOpen], mergedPrs: [mergedPr] }), resolveTarget });
  const prioPacket = JSON.parse(L3.l.coordGet(rPrio.dispatched[0]?.actionId)?.payload_text ?? '{}');
  if (rPrio.dispatched.length !== 1 || prioPacket.mode !== 'OPEN_PR' || !rPrio.held.find((h) => h.code === 'E_REVIEW_ACTIVE')) {
    fail(`open-vs-merged ${JSON.stringify({ d: rPrio.dispatched, h: rPrio.held, packet: prioPacket })}`);
  } else log('ok r36-open-review-precedes-merged-history');

  // no qualifying open → the NEWEST unreviewed merged candidate is selected, as a
  // HISTORICAL review (a review task — never mapped to a fix launch)
  const L4 = group('l4');
  const mergedOld = { number: 3088, node_id: 'PR_kwDOM9YQhs6AbCdEfGhN', repository_id: REPO, merged_at: '2026-10-05T09:00:00Z', merge_sha: '1'.repeat(40), base_sha: 'b'.repeat(40) };
  const mergedNew = { number: 3090, node_id: 'PR_kwDOM9YQhs6AbCdEfGhO', repository_id: REPO, merged_at: '2026-10-06T09:00:00Z', merge_sha: '2'.repeat(40), base_sha: 'b'.repeat(40) };
  register(L4.l, mergedOld.node_id, 3088);
  register(L4.l, mergedNew.node_id, 3090);
  const rHist = await runCycle({ ledger: L4.l, policy, budgets: L4.b, adapter: L4.a, discover: async () => ({ openPrs: [], mergedPrs: [mergedOld, mergedNew] }), resolveTarget });
  const histPacket = JSON.parse(L4.l.coordGet(rHist.dispatched[0]?.actionId)?.payload_text ?? '{}');
  if (rHist.dispatched.length !== 1 || histPacket.mode !== 'HISTORICAL' || histPacket.pr?.number !== 3090 || histPacket.revisions?.merge_sha !== '2'.repeat(40)) {
    fail(`historical selection ${JSON.stringify({ d: rHist.dispatched, packet: histPacket })}`);
  } else log('ok r36-newest-merged-selected-as-historical-review');

  // pending verification has priority and is NOT a Dot review — it dispatches
  // while the one-review bound is consumed elsewhere
  const L5 = group('l5');
  seedScoped(L5.l, 'artyhoo/getff#V1');
  register(L5.l, 'PR_verify', 3901);
  const vClaim = L5.l.claimFinding({ findingKey: 'artyhoo/getff#V1', owner: 'cc-executor/mechanism-lane', leaseMinutes: 30 });
  L5.l.recordFixResponse({ assignmentId: vClaim.assignment_id, fencingToken: vClaim.fencing_token, fixRevision: 'fix-v1', digest: 'fd:v1', payload: '{}' });
  const active = await L5.a.dispatchAction({ kind: 'review-request', targetSession: 'reviewer', payload: { pr: { node_id: 'PR_outstanding' } } });
  if (L5.l.coordGet(active.actionId)?.state !== 'DELIVERED') fail('missing outstanding review precondition');
  const rVerify = await runCycle({ ledger: L5.l, policy, budgets: L5.b, adapter: L5.a, discover: async () => ({ openPrs: [prAt('c')], mergedPrs: [] }), resolveTarget });
  const verifyDispatch = rVerify.dispatched.find((d) => d.kind === 'verify-request');
  if (!verifyDispatch) fail(`verify priority ${JSON.stringify({ d: rVerify.dispatched, h: rVerify.held })}`);
  else log('ok r36-verify-priority-dispatches-under-review-bound');

  const LR = group('released-recovery');
  const releasedPr = { number: 3900, repository_id: REPO, draft: false, head_sha: 'c'.repeat(40), base_sha: 'b'.repeat(40), node_id: 'PR_released_recovery' };
  register(LR.l, releasedPr.node_id, 3900);
  const releasedBroken = createCcAdapter({ ledger: LR.l, coordinationDir: `${tmp}/absent-directory` });
  await runCycle({ ledger: LR.l, policy, budgets: LR.b, adapter: releasedBroken, discover: async () => ({ openPrs: [releasedPr] }), resolveTarget });
  const intent = LR.l.coordList('INTENT')[0];
  if (!intent) fail('recovery precondition: runner created no INTENT');
  LR.l.updateRegistration(releasedPr.node_id, { state: 'RELEASED', operatorTransition: 'operator releases review' });
  const recovered = await runCycle({ ledger: LR.l, policy, budgets: LR.b, adapter: LR.a, discover: async () => ({ openPrs: [] }), resolveTarget });
  if (!intent || LR.l.coordGet(intent.id)?.state !== 'INTENT' || recovered.recovered !== 0 || existsSync(`${LR.dir}/_dot-gate-msg-${intent.id}.md`)) fail('released PR recovered a delivery');
  else log('ok released-runner-intent-never-redelivered');
  LR.l.updateRegistration(releasedPr.node_id, { state: 'ACTIVE', operatorTransition: 'operator enrolls again' });
  const activeRecovery = await runCycle({ ledger: LR.l, policy, budgets: LR.b, adapter: LR.a, discover: async () => ({ openPrs: [] }), resolveTarget });
  if (activeRecovery.recovered !== 1 || !existsSync(`${LR.dir}/_dot-gate-msg-${intent.id}.md`)) fail('ACTIVE recovery control did not deliver');
  else log('ok active-scoped-intent-recovers');
  const LU = group('unregistered-routing');
  seedScoped(LU.l, 'F-no-registration', 'PR_unregistered');
  const unregistered = await runCycle({ ledger: LU.l, policy, budgets: LU.b, adapter: LU.a, discover: async () => ({ openPrs: [] }), resolveTarget });
  if (unregistered.dispatched.length || LU.l.lineage('F-no-registration').at(-1)?.state !== 'OPEN' || !unregistered.held.some(h => h.code === 'E_UNREGISTERED')) fail('unregistered finding assigned or dispatched');
  else log('ok unregistered-finding-never-assigned');


  // ── ST-R3-1: ALREADY_FIXED proves cessation of work ───────────────────────────
  const L6 = group('l6');
  const HIST_TUPLE = (headChar) => ({ repository_id: REPO, pr_node_id: 'PR_kwDOM9YQhs6AbCdEfGhS', base_ref: 'staging', base_sha: 'b'.repeat(40), head_sha: headChar.repeat(40), merge_base_sha: 'a'.repeat(40), tested_merge_sha: 'd'.repeat(40), policy_sha256: 'p'.repeat(64), protocol_version: 'dot-staging-review/1.0' });
  const seedHistorical = (l, key) => {
    const g = l.claimGeneration({ tuple: HIST_TUPLE('f'), reviewerId: 555001, maxAttemptsPerTuple: 8, leaseMinutes: 30 });
    const payload = JSON.stringify({ probe: key });
    const rec = l.submitReport({ claimId: g.claim.claim_id, reviewerId: 555001, digest: createHash('sha256').update(payload).digest('hex'), payload, verdict: 'REVISE', kind: 'admission', leaseMinutes: 30, liveTupleDigest: 'moved'.padEnd(64, '0') });
    l.recordFindings(rec.report_id, [{ key, requirement: 'r', category: 'correctness', severity: 'major', blocking: true }]);
    // a newer generation of the same PR supersedes the finding's generation → the
    // finding becomes HISTORICAL (the queue's revalidate-before-remediation pool)
    l.claimGeneration({ tuple: HIST_TUPLE('g'), reviewerId: 555001, maxAttemptsPerTuple: 8, leaseMinutes: 30 });
  };
  register(L6.l, 'PR_kwDOM9YQhs6AbCdEfGhS', 3910);
  seedHistorical(L6.l, 'artyhoo/getff#H1');
  const pendingBefore = L6.l.counts().outbox_pending;
  const actionsBefore = coordCount(L6.l);
  // D2065-S05: revalidation evidence is BOUND to the cycle's current staging —
  // present:false without a bound staging reference is NOT already-fixed proof
  const STAGING = '5'.repeat(40);
  const CHECKED = { staging_sha: STAGING, checked_at: '2026-10-06T12:00:00Z' };
  const rFixed = await runCycle({
    ledger: L6.l, policy, budgets: L6.b, adapter: L6.a,
    discover: DISCOVER_EMPTY,
    revalidateFinding: async (item) => ({ present: item.key === 'artyhoo/getff#H1' ? false : true, checked: CHECKED }),
    currentStagingSha: STAGING,
    resolveTarget,
  });
  const durableFixed = L6.l.counts().outbox_pending - pendingBefore;
  const fixedEntry = rFixed.historical.find((h) => h.disposition === 'ALREADY_FIXED');
  if (fixedEntry && fixedEntry.evidence?.staging_sha === STAGING && rFixed.dispatched.length === 0
    && coordCount(L6.l) === actionsBefore && durableFixed === 1) {
    log('ok r31-already-fixed-zero-launch-durable-evidence');
  } else {
    fail(`already-fixed ${JSON.stringify({ hist: rFixed.historical, d: rFixed.dispatched.length, actions: coordCount(L6.l) - actionsBefore, durable: durableFixed })}`);
  }

  // the still-present CONTROL historical finding DOES dispatch ONE correction
  // assignment, and the packet carries the issued assignment identity + the
  // revalidation evidence it launched on (D2065-S05)
  seedHistorical(L6.l, 'artyhoo/getff#H2');
  const rPresent = await runCycle({
    ledger: L6.l, policy, budgets: L6.b, adapter: L6.a,
    discover: DISCOVER_EMPTY,
    revalidateFinding: async (item) => ({ present: item.key === 'artyhoo/getff#H2', checked: CHECKED }),
    currentStagingSha: STAGING,
    resolveTarget,
  });
  const presentDispatch = rPresent.dispatched.find((d) => d.kind === 'fix-assignment');
  const presentPacket = presentDispatch ? JSON.parse(L6.l.coordGet(presentDispatch.actionId)?.payload_text ?? '{}') : {};
  if (!presentDispatch || !presentPacket.assignment_id || presentPacket.finding_key !== 'artyhoo/getff#H2'
    || presentPacket.historical_basis !== 'HISTORICAL_REVALIDATED'
    || presentPacket.revalidation?.checked_staging_sha !== STAGING || !presentPacket.revalidation?.checked_at) {
    fail(`still-present control ${JSON.stringify({ d: rPresent.dispatched, packet: presentPacket })}`);
  } else log('ok r31-still-present-historical-dispatches-one-assignment');

  // ── D2065-S05 negative matrix: every UNTRUSTED revalidation shape holds — ────
  // zero assignment, zero routing, zero coordination writes, occurrence stays
  // OPEN; the historical arm can no longer be skipped by omitting the adapter
  const holdArm = async (name, opts, expectCode) => {
    const L = group(`l6b-${name}`);
    register(L.l, 'PR_kwDOM9YQhs6AbCdEfGhS', 3910);
    seedHistorical(L.l, `artyhoo/getff#${name}`);
    const before = coordCount(L.l);
    const r = await runCycle({ ledger: L.l, policy, budgets: L.b, adapter: L.a, discover: DISCOVER_EMPTY, resolveTarget, currentStagingSha: STAGING, ...opts });
    const occ = L.l.lineage(`artyhoo/getff#${name}`).at(-1);
    if (!r.held.find((h) => h.code === expectCode && h.key === `artyhoo/getff#${name}`) || r.dispatched.length !== 0
      || r.routed.length !== 0 || coordCount(L.l) !== before || occ?.state === 'ASSIGNED') {
      fail(`${name} hold ${expectCode}: ${JSON.stringify({ held: r.held, d: r.dispatched.length, routed: r.routed.length, delta: coordCount(L.l) - before, state: occ?.state })}`);
    } else log(`ok r31-${name}-holds`);
  };
  await holdArm('unverified-adapter', {}, 'E_HISTORICAL_UNVERIFIED'); // adapter ABSENT: hold, never skip
  await holdArm('throwing-adapter', { revalidateFinding: async () => { throw new Error('revalidation backend unreachable'); } }, 'E_HISTORICAL_HOLD');
  await holdArm('raw-boolean-adapter', { revalidateFinding: async () => true }, 'E_HISTORICAL_UNBOUND');
  await holdArm('null-result-adapter', { revalidateFinding: async () => null }, 'E_HISTORICAL_UNBOUND');
  await holdArm('stale-evidence-adapter', { revalidateFinding: async () => ({ present: true, checked: { staging_sha: '9'.repeat(40), checked_at: CHECKED.checked_at } }) }, 'E_HISTORICAL_STALE');
  await holdArm('no-staging-input', { revalidateFinding: async () => ({ present: true, checked: CHECKED }) , currentStagingSha: undefined }, 'E_HISTORICAL_STAGING');
  // replay: a second identical cycle creates NO duplicate assignment — the durable
  // reservation + issued claim hold the line
  { const L = group('l6c');
    register(L.l, 'PR_kwDOM9YQhs6AbCdEfGhS', 3910);
    seedHistorical(L.l, 'artyhoo/getff#H-REPLAY');
    const one = await runCycle({ ledger: L.l, policy, budgets: L.b, adapter: L.a, discover: DISCOVER_EMPTY, resolveTarget, currentStagingSha: STAGING, revalidateFinding: async () => ({ present: true, checked: CHECKED }) });
    const two = await runCycle({ ledger: L.l, policy, budgets: L.b, adapter: L.a, discover: DISCOVER_EMPTY, resolveTarget, currentStagingSha: STAGING, revalidateFinding: async () => ({ present: true, checked: CHECKED }) });
    if (one.dispatched.filter((d) => d.kind === 'fix-assignment').length !== 1
      || two.dispatched.filter((d) => d.kind === 'fix-assignment').length !== 0) {
      fail(`replay ${JSON.stringify({ a: one.dispatched.length, b: two.dispatched.length })}`);
    } else log('ok r31-replay-bounded-no-duplicate-assignment');
  }

  // ── coordinator routing: open unclaimed findings become ONE assignment ───────
  const L7 = group('l7');
  register(L7.l, 'PR_kwDOM9YQhs6AbCdEfGhR', 3200);
  const routeGen = L7.l.claimGeneration({ tuple: { repository_id: REPO, pr_node_id: 'PR_kwDOM9YQhs6AbCdEfGhR', base_ref: 'staging', base_sha: 'b'.repeat(40), head_sha: 'h'.repeat(40), merge_base_sha: 'a'.repeat(40), tested_merge_sha: 'd'.repeat(40), policy_sha256: 'p'.repeat(64), protocol_version: 'dot-staging-review/1.0' }, reviewerId: 555001, maxAttemptsPerTuple: 8, leaseMinutes: 30 });
  const routePayload = JSON.stringify({ probe: 'route' });
  const routeRec = L7.l.submitReport({ claimId: routeGen.claim.claim_id, reviewerId: 555001, digest: createHash('sha256').update(routePayload).digest('hex'), payload: routePayload, verdict: 'REVISE', kind: 'admission', leaseMinutes: 30, liveTupleDigest: routeGen.generation.tuple_digest });
  L7.l.recordFindings(routeRec.report_id, [{ key: 'artyhoo/getff#R-1', requirement: 'routed fix', category: 'correctness', severity: 'critical', blocking: true }]);
  const rRoute = await runCycle({ ledger: L7.l, policy, budgets: L7.b, adapter: L7.a, discover: DISCOVER_EMPTY, resolveTarget });
  const routeDispatch = rRoute.dispatched.find((d) => d.kind === 'fix-assignment');
  const routePacket = routeDispatch ? JSON.parse(L7.l.coordGet(routeDispatch.actionId)?.payload_text ?? '{}') : {};
  if (!routeDispatch || !routePacket.assignment_id || routePacket.finding_key !== 'artyhoo/getff#R-1'
    || routePacket.revisions?.head_sha !== 'h'.repeat(40) || routePacket.pr_node_id !== 'PR_kwDOM9YQhs6AbCdEfGhR') {
    fail(`routing ${JSON.stringify({ d: rRoute.dispatched, packet: routePacket })}`);
  } else log('ok r36-open-finding-routes-one-trusted-assignment');
  // a SECOND cycle creates no duplicate owner: the assignment holds the finding
  const actionsAfterRoute = coordCount(L7.l);
  await runCycle({ ledger: L7.l, policy, budgets: L7.b, adapter: L7.a, discover: DISCOVER_EMPTY, resolveTarget });
  const routeOcc = L7.l.lineage('artyhoo/getff#R-1').at(-1);
  if (routeOcc?.state !== 'ASSIGNED' || coordCount(L7.l) !== actionsAfterRoute) fail(`re-route ${JSON.stringify({ state: routeOcc?.state, delta: coordCount(L7.l) - actionsAfterRoute })}`);
  else log('ok r36-routing-replay-creates-no-duplicate-owner');
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
  registered-pr-dispatches-complete-packet ack-observed-by-next-cycle \
  drain-step-observed missing-limits-disable-handout \
  r35-paused-holds-launch-delivery-and-recovery \
  r35-recovery-composes-after-explicit-resume \
  exhausted-window-bound-holds-pr r35-released-registration-holds \
  r35-expired-authorization-holds \
  r35-state-change-after-reservation-is-non-launched \
  recovery-composes-through-cycle r36-unenrolled-target-dispatches-nothing \
  r36-one-active-review-despite-budget-headroom \
  r36-active-review-from-previous-cycle-blocks \
  r36-head-movement-supersedes-and-requeues \
  r36-accepted-report-resolves-active-review \
  r36-open-review-precedes-merged-history \
  r36-newest-merged-selected-as-historical-review \
  r36-verify-priority-dispatches-under-review-bound released-runner-intent-never-redelivered active-scoped-intent-recovers unregistered-finding-never-assigned \
  r31-already-fixed-zero-launch-durable-evidence \
  r31-still-present-historical-dispatches-one-assignment \
  r31-unverified-adapter-holds r31-throwing-adapter-holds \
  r31-raw-boolean-adapter-holds r31-null-result-adapter-holds \
  r31-stale-evidence-adapter-holds r31-no-staging-input-holds \
  r31-replay-bounded-no-duplicate-assignment \
  r36-open-finding-routes-one-trusted-assignment \
  r36-routing-replay-creates-no-duplicate-owner || exit 1
echo "runner.test.sh: all green"
