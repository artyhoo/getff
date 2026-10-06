// Bounded runtime runner — the packet's "connect the actual bounded runtime".
//
// Until this module the gate's exports had no common operational consumer: queue,
// budgets, registration, the CC adapter and the ledger each worked alone. runCycle
// is the deterministic one-cycle consumer wiring the packet's chain:
//   discovery → check qualification → revision-keyed persistent queue →
//   registration/ownership → PERSISTED budget reservation BEFORE any launch →
//   dispatch/ACK over the coordination channel → receipt intake → recovery.
// Everything destination-specific is dependency-injected (discover, isQualifying,
// drain, adapter targets); with no enrollment the cycle still runs read-only over
// the ledger and reports the holds — it never invents a destination. Dispatch
// here is a coordination message to a Claude Code session, NOT a model launch and
// never a merge: the word autonomous is not used for it, and the persisted budget
// reservation (budgets.reserveLaunch) happens BEFORE the adapter writes.
//
// Counters are real: every reported number comes from a ledger read or an adapter
// return value in THIS cycle — the runner reports no counts it did not observe.

import { buildQueue, reserveNext, gateHistorical } from './queue.mjs';

function code(name, message) {
  const e = new Error(message);
  e.code = name;
  return e;
}

export async function runCycle({
  ledger, policy, budgets, adapter,
  discover, isQualifying, drain, revalidateFinding,
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
  };

  // 1-2. discovery → qualification → the revision-keyed persistent queue
  const { openPrs = [], mergedPrs = [] } = await discover();
  const items = buildQueue({ ledger, openPrs, mergedPrs, isQualifying });
  report.queued = items.map((i) => ({ kind: i.kind, key: i.key, reason: i.reason ?? null }));

  // 3-5. hand-out is durable; per item: registration/ownership → persisted budget
  // reservation BEFORE the dispatch write → coordination dispatch
  const unattended = budgets.unattendedAllowed();
  if (!unattended) {
    report.held.push({ key: '*', code: 'E_UNATTENDED_DISABLED', reason: 'missing limits or quota pause — unattended dispatch disabled' });
  }
  const handable = reserveNext({ ledger, items, n: unattended ? maxHandout : 0, leaseMinutes: workLeaseMinutes, nowMs: now() });
  for (const item of handable) {
    try {
      if (item.pr) {
        // SP-4 at the runtime boundary: an unregistered PR holds (admission
        // default-off) — the work stays queued and visible, nothing dispatches
        const registration = ledger.getRegistration(item.pr.node_id);
        if (!registration) {
          report.held.push({ key: item.key, code: 'E_UNREGISTERED', reason: 'no registration receipt — admission default-off' });
          continue;
        }
      }
      if (item.kind === 'historical' && typeof revalidateFinding === 'function') {
        const gate = await gateHistorical({ item, revalidateFinding });
        if (!gate.launch) {
          report.historical.push({ key: item.key, disposition: gate.disposition, reason: gate.reason });
          continue;
        }
      }
      const budget = budgets.reserveLaunch({
        occurrenceKey: item.occurrence_id ?? undefined,
        prKey: item.pr ? `pr:${item.pr.number}` : undefined,
      });
      const kind = item.kind === 'verify' ? 'verify-request' : item.kind === 'review' ? 'review-request' : 'fix-assignment';
      const action = await adapter.dispatchAction({
        kind,
        targetSession: `dot-gate:${item.kind}`,
        payload: { item: { kind: item.kind, key: item.key, occurrence_id: item.occurrence_id ?? null, pr: item.pr?.number ?? null }, budgetWindow: budget.windowId },
      });
      report.dispatched.push({ key: item.key, actionId: action.actionId, windowId: budget.windowId });
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

  // 8. recovery — idempotent re-delivery of INTENT rows, budget-bounded
  report.recovered = adapter.recoverPending().recovered.length;

  return report;
}
