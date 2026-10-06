// Work queue — round-2 packet increment 7.
//
// Implements the protocol's priority order (docs/meta-factory/dot-review-protocol.md §3):
//   1. pending correction verification (fix responses awaiting checks/review/follow-up)
//      — oldest first;
//   2. qualifying open non-draft staging PRs — oldest ready timestamp first, then PR
//      number;
//   3. unreviewed merged staging PRs — newest merged first;
//   4. historical findings revalidated against current staging before any remediation
//      launch (an already-fixed defect launches no fix — gateHistorical).
// PRs waiting on CI, conflicts or decisions stay VISIBLE with their blockers (kind
// 'blocked') — never silently dropped. The plan is a STABLE full-set sort: new
// arrivals and restarts re-plan without skipping or duplicating; hand-out is guarded
// by durable per-item reservations in the ledger (a reserved item is not handed
// twice, a lapsed lease returns it to the pool).

// buildQueue({ ledger, openPrs, mergedPrs, isQualifying }) → ordered work items.
// openPrs entries: { number, node_id, draft, ready_at, ...blocker fields }.
// mergedPrs entries: { number, node_id, merged_at }.
// isQualifying(pr) → boolean: the deployment wires policy readiness here; a PR that
// fails it stays in the plan as kind 'blocked' (visible with its blocker reason).
export function buildQueue({ ledger, openPrs = [], mergedPrs = [], isQualifying } = {}) {
  if (!ledger) throw Object.assign(new Error('buildQueue requires the ledger'), { code: 'E_LIMITS' });
  const items = [];

  // 1. pending verification — oldest first (created_at, then insertion order)
  const verifying = ledger.listOpenFindings()
    .filter((o) => o.state === 'VERIFYING')
    .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.rowid - b.rowid));
  for (const o of verifying) {
    items.push({ kind: 'verify', key: o.finding_key, occurrence_id: o.id, reason: 'fix awaiting verification' });
  }

  // 2. qualifying open non-draft staging PRs — ready timestamp asc, then number
  const open = [...openPrs].sort((a, b) => {
    const ra = String(a.ready_at ?? '');
    const rb = String(b.ready_at ?? '');
    if (ra !== rb) return ra < rb ? -1 : 1;
    return (a.number ?? 0) - (b.number ?? 0);
  });
  for (const p of open) {
    const ok = isQualifying ? isQualifying(p) : true;
    if (p.draft === true) {
      items.push({ kind: 'blocked', key: `pr:${p.number}`, pr: p, reason: 'draft' });
    } else if (ok) {
      items.push({ kind: 'review', key: `pr:${p.number}`, pr: p, reason: 'open staging PR pending review' });
    } else {
      items.push({ kind: 'blocked', key: `pr:${p.number}`, pr: p, reason: 'not qualifying (mechanics/decisions)' });
    }
  }

  // 3. unreviewed merged staging PRs — newest merged first
  const merged = [...mergedPrs]
    .filter((p) => !ledger.prHasReview(p.node_id))
    .sort((a, b) => {
      const ma = String(a.merged_at ?? '');
      const mb = String(b.merged_at ?? '');
      if (ma !== mb) return ma > mb ? -1 : 1;
      return (b.number ?? 0) - (a.number ?? 0);
    });
  for (const p of merged) {
    items.push({ kind: 'merged', key: `merged:${p.number}`, pr: p, reason: 'merged without a review record' });
  }

  // 4. historical findings awaiting revalidation — oldest first
  for (const o of ledger.listHistoricalFindings()) {
    items.push({ kind: 'historical', key: o.finding_key, occurrence_id: o.id, reason: 'historical finding to revalidate against current staging' });
  }
  return items;
}

// Hand out up to n unreserved items; the durable reservation is taken per item, so
// a concurrent or restarted caller cannot double-hand the same work.
export function reserveNext({ ledger, items, n, leaseMinutes, nowMs = Date.now() } = {}) {
  if (!ledger || !Array.isArray(items) || !Number.isInteger(leaseMinutes)) {
    throw Object.assign(new Error('reserveNext requires ledger, items and leaseMinutes'), { code: 'E_LIMITS' });
  }
  const out = [];
  for (const item of items) {
    if (out.length >= n) break;
    if (item.kind === 'blocked') continue; // visible, never handed out
    try {
      ledger.reserveWork({ itemKey: `${item.kind}:${item.key}`, kind: item.kind, leaseMinutes, nowMs });
      out.push(item);
    } catch (e) {
      if (e.code !== 'E_ALREADY_CLAIMED') throw e;
    }
  }
  return out;
}

// Historical revalidation gate: an already-fixed defect must not launch a fix. The
// revalidation probe is injected by the deployment (Dot checks current staging);
// offline tests inject stubs.
export async function gateHistorical({ item, revalidateFinding } = {}) {
  if (typeof revalidateFinding !== 'function') {
    throw Object.assign(new Error('gateHistorical requires revalidateFinding'), { code: 'E_LIMITS' });
  }
  const stillPresent = await revalidateFinding(item);
  if (!stillPresent) {
    return { launch: false, disposition: 'ALREADY_FIXED', reason: `finding ${item?.key} no longer reproduces at current staging — record an ALREADY_FIXED closure (with its evidence), never a fix launch` };
  }
  return { launch: true };
}
