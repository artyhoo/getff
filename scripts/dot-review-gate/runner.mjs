// Bounded runtime runner — the packet's "connect the actual bounded runtime".
//
// Until this module the gate's exports had no common operational consumer: queue,
// budgets, registration, the CC adapter and the ledger each worked alone. runCycle
// is the deterministic one-cycle consumer wiring the packet's chain:
//   discovery → check qualification → revision-keyed persistent queue →
//   outstanding-work reconcile → operational authorization gate → PERSISTED budget
//   reservation BEFORE any launch → coordination dispatch/ACK → receipt intake →
//   finding routing → recovery.
// Everything destination-specific is dependency-injected (discover, isQualifying,
// drain, resolveTarget); with no enrollment the cycle still runs read-only over
// the ledger and reports the holds — it never invents a destination. Dispatch here
// is a coordination message to a Claude Code session, NOT a model launch and never
// a merge: the word autonomous is not used for it, and the persisted budget
// reservation (budgets.reserveLaunch) happens BEFORE the adapter write.
//
// R3-5: CURRENT trusted operational authorization is evaluated at every
// consequential boundary — before the hand-out, AGAIN between reservation and
// delivery (a state change after reservation is an auditable non-launched
// outcome: the reservation stays, nothing dispatches), and before recovery (a
// persisted pending action does not grant permanent permission to deliver after
// pause, expiry or revocation).
//
// R3-6: work identity is revision-keyed (repository, PR, mode, revision, basis,
// protocol — see queue.mjs); at most one Dot review is active ACROSS cycles and
// restarts (durable coord actions, reconciled: superseded by a newer revision of
// the same PR, timed out on a lapsed work lease, or resolved by an accepted
// report); delivered packets carry the trusted revision/basis/assignment identity
// — resolveTarget returns the ACTUAL enrolled target, never a synthetic one.
//
// Counters are real: every reported number comes from a ledger read or an adapter
// return value in THIS cycle — the runner reports no counts it did not observe.

import { buildQueue, reserveNext, gateHistorical } from './queue.mjs';

function code(name, message) {
  const e = new Error(message);
  e.code = name;
  return e;
}

const OPEN_REVIEW_STATES = ['INTENT', 'DELIVERED', 'ACKED'];

// R3-5: the operational authorization gate — every consequential launch/delivery
// boundary composes THIS function, never a subset of it.
function operationalHold({ ledger, policy, budgets, registration, nowMs }) {
  if (ledger.isPaused()) {
    return { code: 'E_PAUSED', reason: 'operator pause is active — no launch, delivery or recovery' };
  }
  const expiry = Date.parse(policy.authorization_expiry ?? '');
  if (!Number.isFinite(expiry) || nowMs > expiry) {
    return { code: 'E_AUTH_EXPIRED', reason: `operational authorization is expired or absent (${policy.authorization_expiry ?? 'none'})` };
  }
  if (!budgets.unattendedAllowed()) {
    return { code: 'E_UNATTENDED_DISABLED', reason: 'missing limits or quota pause — unattended dispatch disabled' };
  }
  if (registration && registration.state !== 'ACTIVE') {
    return { code: 'E_UNREGISTERED', reason: `registration is ${registration.state}, not ACTIVE — an unknown future state holds too` };
  }
  return null;
}

// Packet for a review launch: the trusted revision/basis identity the recipient
// reviews against (R3-6: identifier-only packets were the finding).
function reviewPacket({ item, policy }) {
  const p = item.pr ?? {};
  const base = {
    mode: item.kind === 'merged' ? 'HISTORICAL' : 'OPEN_PR',
    repository_id: p.repository_id ?? policy.repository_id,
    pr: { number: p.number ?? null, node_id: p.node_id ?? null },
    comparison_basis: item.kind === 'merged' ? 'HISTORICAL_PINNED' : 'HEAD_TO_BASE',
    protocol_version: policy.protocol_version ?? null,
    policy_version: policy.policy_version ?? null,
    work: { item_key: `${item.kind}:${item.key}`, kind: item.kind },
  };
  if (item.kind === 'merged') {
    return { ...base, revisions: { merge_sha: p.merge_sha ?? null, base_sha: p.base_sha ?? null, current_staging_sha: p.current_staging_sha ?? null } };
  }
  return { ...base, revisions: { head_sha: p.head_sha ?? null, base_sha: p.base_sha ?? null } };
}

// Packet for a correction launch: the ISSUED assignment identity + the revision
// basis the fix lands on (R3-6: a correction without a trusted assignment
// identity is not dispatchable).
function fixPacket({ assignment, occurrence, generation, item }) {
  let tuple = {};
  try { tuple = generation?.tuple_json ? JSON.parse(generation.tuple_json) : {}; } catch { tuple = {}; }
  return {
    assignment_id: assignment.assignment_id,
    occurrence_id: occurrence.id,
    finding_key: occurrence.finding_key,
    repository_id: occurrence.repository_id ?? null,
    pr_node_id: occurrence.pr_node_id ?? null,
    requirement: occurrence.requirement ?? null,
    severity: occurrence.severity ?? null,
    revisions: {
      head_sha: tuple.head_sha ?? null,
      base_sha: tuple.base_sha ?? null,
      merge_base_sha: tuple.merge_base_sha ?? null,
    },
    policy_sha256: tuple.policy_sha256 ?? null,
    protocol_version: tuple.protocol_version ?? null,
    historical_basis: item?.kind === 'historical' ? 'HISTORICAL_REVALIDATED' : null,
    work: item ? { item_key: `${item.kind}:${item.key}`, kind: item.kind } : undefined,
  };
}

// R3-6: reconcile OUTSTANDING Dot review work before any new launch — one active
// review across cycles and restarts. An outstanding review is superseded when a
// newer revision of the same PR is queued, timed out when its work lease lapsed
// (a lapse is not cessation: the CANCELLED mark IS the recorded reconciliation),
// and resolved when a report for its PR was accepted. Returns the count still
// active after reconciliation.
function reconcileReviews({ ledger, currentItems, nowMs }) {
  const openActions = OPEN_REVIEW_STATES.flatMap((s) => ledger.coordList(s)).filter((a) => a.kind === 'review-request');
  for (const a of openActions) {
    let payload = {};
    try { payload = JSON.parse(a.payload_text ?? '{}'); } catch { payload = {}; }
    const itemKey = payload?.work?.item_key;
    const prNodeId = payload?.pr?.node_id ?? null;
    const supersededBy = currentItems.find((i) => i.pr && i.pr.node_id != null && i.pr.node_id === prNodeId
      && `${i.kind}:${i.key}` !== itemKey && ['review', 'merged'].includes(i.kind));
    if (supersededBy) {
      ledger.coordMark(a.id, 'CANCELLED', `superseded by a newer revision of the same PR (${supersededBy.key}) — any report stays history`);
      continue;
    }
    if (itemKey) {
      const claim = ledger.getWorkClaim(itemKey);
      if (claim && claim.state === 'RESERVED' && Date.parse(claim.lease_expires_at) <= nowMs) {
        ledger.coordMark(a.id, 'CANCELLED', `work lease lapsed at ${claim.lease_expires_at} — review timed out; replacement reconciled`);
        continue;
      }
    }
    if (prNodeId && ledger.prHasReview(prNodeId)) {
      ledger.coordMark(a.id, 'DONE', 'a report for this PR was accepted — the review resolved');
    }
  }
  return OPEN_REVIEW_STATES.reduce((n, s) => n + ledger.coordList(s).filter((x) => x.kind === 'review-request').length, 0);
}

export async function runCycle({
  ledger, policy, budgets, adapter,
  discover, isQualifying, drain, revalidateFinding, resolveTarget,
  maxHandout = 3, workLeaseMinutes = 30,
  now = () => Date.now(),
} = {}) {
  if (!ledger || !policy || !budgets || !adapter) {
    throw code('E_CONFIG', 'runCycle requires ledger, policy, budgets and adapter');
  }
  if (typeof discover !== 'function') {
    throw code('E_CONFIG', 'runCycle requires the discover adapter — with no destination enrollment the caller passes a stub that returns no PRs');
  }

  const report = {
    queued: [], dispatched: [], acked: [], held: [], recovered: 0, drained: 0, historical: [],
    routed: [], recoveryHeld: null, activeReviews: 0,
  };

  // 1-2. discovery → qualification → the revision-keyed persistent queue
  const { openPrs = [], mergedPrs = [] } = await discover();
  const items = buildQueue({ ledger, policy, openPrs, mergedPrs, isQualifying });
  report.queued = items.map((i) => ({ kind: i.kind, key: i.key, reason: i.reason ?? null }));

  // R3-6: one active Dot review across cycles/restarts — reconcile first
  report.activeReviews = reconcileReviews({ ledger, currentItems: items, nowMs: now() });
  const maxActiveReviews = Number.isInteger(policy.limits?.max_active_dot_reviews) && policy.limits.max_active_dot_reviews > 0
    ? policy.limits.max_active_dot_reviews : 1;

  // 3-5. hand-out is durable; per item: operational gate → registration →
  // persisted budget reservation BEFORE the dispatch write → RE-CHECK → dispatch
  const preGate = operationalHold({ ledger, policy, budgets, registration: undefined, nowMs: now() });
  if (preGate) {
    report.held.push({ key: '*', code: preGate.code, reason: preGate.reason });
  }
  const handable = reserveNext({ ledger, items, n: preGate ? 0 : maxHandout, leaseMinutes: workLeaseMinutes, nowMs: now() });
  for (const item of handable) {
    try {
      const isReview = item.kind === 'review' || item.kind === 'merged';
      // review-kind work honors the one-active-review bound (verify/correction
      // work does not — it is not a Dot review launch)
      if (isReview && report.activeReviews >= maxActiveReviews) {
        report.held.push({ key: item.key, code: 'E_REVIEW_ACTIVE', reason: `one active Dot review is the configured bound (${report.activeReviews} outstanding) — reconcile or resolve before replacement` });
        continue;
      }
      if (item.pr) {
        // SP-4 at the runtime boundary: an ABSENT or non-ACTIVE registration holds
        // (admission default-off) — the work stays queued and visible
        const registration = ledger.getRegistration(item.pr.node_id);
        if (!registration) {
          report.held.push({ key: item.key, code: 'E_UNREGISTERED', reason: 'no registration receipt — admission default-off' });
          continue;
        }
        const regHold = operationalHold({ ledger, policy, budgets, registration, nowMs: now() });
        if (regHold) {
          report.held.push({ key: item.key, code: regHold.code, reason: regHold.reason });
          continue;
        }
      }
      if (item.kind === 'historical' && typeof revalidateFinding === 'function') {
        const gate = await gateHistorical({ item, revalidateFinding });
        if (!gate.launch) {
          // ST-R3-1: the no-launch disposition is DURABLE evidence — an outbox
          // event naming the finding, not a report field nobody reads
          ledger.outboxEnqueue('finding.already_fixed', {
            finding_key: item.key, occurrence_id: item.occurrence_id ?? null,
            disposition: 'ALREADY_FIXED', reason: gate.reason,
          }, `already-fixed:${item.key}:${item.occurrence_id ?? 'x'}`);
          report.historical.push({ key: item.key, disposition: gate.disposition, reason: gate.reason });
          continue;
        }
      }
      // target resolution is a trusted enrollment fact — a synthetic session
      // string is a fixture, never a launch (R3-6)
      if (typeof resolveTarget !== 'function') {
        report.held.push({ key: item.key, code: 'E_NO_TARGET', reason: 'no resolveTarget adapter — the deployment has no enrolled destination; nothing synthetic is dispatched' });
        continue;
      }
      const dispatchKind = item.kind === 'verify' ? 'verify-request' : isReview ? 'review-request' : 'fix-assignment';
      const target = await resolveTarget({ kind: dispatchKind, item });
      if (!target?.session) {
        report.held.push({ key: item.key, code: 'E_NO_TARGET', reason: `no enrolled target for ${dispatchKind} — nothing synthetic is dispatched` });
        continue;
      }
      let payload;
      let assignment = null;
      if (dispatchKind === 'review-request') {
        payload = reviewPacket({ item, policy });
      } else if (dispatchKind === 'verify-request') {
        const occ = ledger.getOccurrence(item.occurrence_id);
        if (!occ) {
          report.held.push({ key: item.key, code: 'E_NOT_FOUND', reason: 'verification occurrence vanished' });
          continue;
        }
        payload = { occurrence_id: occ.id, finding_key: occ.finding_key, repository_id: occ.repository_id ?? null, pr_node_id: occ.pr_node_id ?? null, work: { item_key: `${item.kind}:${item.key}`, kind: item.kind } };
      } else {
        // correction work claims THROUGH the ledger first — the issued assignment
        // identity is part of the packet, and a second owner cannot slip in
        const occ = item.occurrence_id ? ledger.getOccurrence(item.occurrence_id) : undefined;
        if (!occ) {
          report.held.push({ key: item.key, code: 'E_NOT_FOUND', reason: 'occurrence vanished before routing' });
          continue;
        }
        assignment = ledger.claimFinding({ findingKey: occ.finding_key, owner: target.owner ?? target.session, leaseMinutes: workLeaseMinutes, nowMs: now() });
        const generation = ledger.generationForOccurrence(occ.id);
        payload = fixPacket({ assignment, occurrence: occ, generation, item });
      }
      const budget = budgets.reserveLaunch({
        occurrenceKey: assignment?.occurrence_id ?? item.occurrence_id ?? undefined,
        prKey: item.pr ? `pr:${item.pr.number}` : undefined,
      });
      // R3-5: RE-CHECK the operational state between reservation and delivery —
      // a change after reserving is an auditable non-launched outcome (the
      // reservation row stays, nothing dispatches, the hold names the reason)
      const postReservation = operationalHold({
        ledger, policy, budgets,
        registration: item.pr ? ledger.getRegistration(item.pr.node_id) : undefined,
        nowMs: now(),
      });
      if (postReservation) {
        report.held.push({ key: item.key, code: postReservation.code, reason: `${postReservation.reason} (reservation ${budget.windowId} stands, non-launched)` });
        continue;
      }
      const action = await adapter.dispatchAction({ kind: dispatchKind, targetSession: target.session, payload });
      report.dispatched.push({ key: item.key, kind: dispatchKind, actionId: action.actionId, windowId: budget.windowId, target: target.session });
      if (isReview) report.activeReviews += 1;
      if (dispatchKind === 'fix-assignment' && assignment) report.routed.push({ key: item.key, assignment_id: assignment.assignment_id });
    } catch (e) {
      report.held.push({ key: item.key, code: e.code ?? 'E_CYCLE', reason: e.message });
    }
  }

  // 6. ACK is its own transition — only the recipient's ack file flips it
  report.acked = adapter.pollAcks().acked;

  // 7. receipt intake: the worker's records reach the ledger through the SAME
  // outbox consumer the service drains — injected here so the cycle composes the
  // real consumer instead of re-implementing it
  if (typeof drain === 'function') {
    const results = await drain();
    report.drained = Array.isArray(results) ? results.length : 0;
  }

  // 7.5 coordinator routing: open, unclaimed, scope-bearing findings become ONE
  // authorized correction assignment each — same gate, same reservation, same
  // re-check as every other consequential launch (spec §3 step 5)
  if (typeof resolveTarget === 'function' && !preGate) {
    for (const o of ledger.listOpenFindings()) {
      if (!o.repository_id || ['ASSIGNED', 'ACKNOWLEDGED', 'VERIFYING'].includes(o.state)) continue;
      // a historical finding (its report landed on a superseded/terminal generation)
      // is remediated ONLY through the queue's revalidation arm — routing it here
      // would bypass the ALREADY_FIXED gate
      const gen = ledger.generationForOccurrence(o.id);
      if (gen && (gen.state === 'SUPERSEDED' || ['AUTHORIZED', 'MERGED', 'CLOSED', 'INCOMPLETE'].includes(gen.state))) continue;
      try {
        const registration = ledger.getRegistration(o.pr_node_id);
        const hold = operationalHold({ ledger, policy, budgets, registration, nowMs: now() });
        if (hold) {
          report.held.push({ key: o.finding_key, code: hold.code, reason: `finding routing held: ${hold.reason}` });
          continue;
        }
        const target = await resolveTarget({ kind: 'fix-assignment', item: { kind: 'finding', key: o.finding_key, occurrence_id: o.id } });
        if (!target?.session) {
          report.held.push({ key: o.finding_key, code: 'E_NO_TARGET', reason: 'no enrolled executor target — the finding stays visible and unassigned' });
          continue;
        }
        const assignment = ledger.claimFinding({ findingKey: o.finding_key, owner: target.owner ?? target.session, leaseMinutes: workLeaseMinutes, nowMs: now() });
        const budget = budgets.reserveLaunch({ occurrenceKey: assignment.occurrence_id, prKey: o.pr_node_id ? `pr:${o.pr_node_id}` : undefined });
        const postReservation = operationalHold({ ledger, policy, budgets, registration: ledger.getRegistration(o.pr_node_id), nowMs: now() });
        if (postReservation) {
          report.held.push({ key: o.finding_key, code: postReservation.code, reason: `${postReservation.reason} (reservation ${budget.windowId} stands, non-launched)` });
          continue;
        }
        const generation = ledger.generationForOccurrence(o.id);
        const action = await adapter.dispatchAction({ kind: 'fix-assignment', targetSession: target.session, payload: fixPacket({ assignment, occurrence: o, generation }) });
        report.dispatched.push({ key: o.finding_key, kind: 'fix-assignment', actionId: action.actionId, windowId: budget.windowId, target: target.session });
        report.routed.push({ key: o.finding_key, assignment_id: assignment.assignment_id });
      } catch (e) {
        report.held.push({ key: o.finding_key, code: e.code ?? 'E_ROUTE', reason: e.message });
      }
    }
  }

  // 8. recovery — idempotent re-delivery of INTENT rows, budget-bounded. R3-5:
  // a persisted pending action does NOT grant permanent permission — the same
  // operational gate runs before any re-delivery.
  const recoveryHold = operationalHold({ ledger, policy, budgets, registration: undefined, nowMs: now() });
  if (recoveryHold) {
    report.recoveryHeld = recoveryHold;
  } else {
    report.recovered = adapter.recoverPending().recovered.length;
  }

  return report;
}
