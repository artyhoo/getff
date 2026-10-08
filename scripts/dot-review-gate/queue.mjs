// Work queue — round-2 packet increment 7, re-keyed in round 4 (R3-6).
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
//
// R3-6: work identity is REVISION-KEYED — repository, PR, mode, revision and
// comparison basis participate in the item key, so a new head of a queued or
// dispatched PR is a NEW work item (the stale one is reconciled by the runner),
// never a silent reuse of the old reservation. An item without revision identity
// is 'blocked' (visible, not dispatchable): an unkeyed launch cannot be
// superseded or bounded.

// buildQueue({ ledger, policy, openPrs, mergedPrs, isQualifying }) → ordered work items.
// openPrs entries: { number, node_id, draft, ready_at, repository_id, head_sha, base_sha }.
// mergedPrs entries: { number, node_id, merged_at, repository_id, merge_sha, base_sha }.
// isQualifying(pr) → boolean: the deployment wires policy readiness here; a PR that
// fails it stays in the plan as kind 'blocked' (visible with its blocker reason).
//
// Completion matches an accepted canonical review, including its actual mode and
// comparison basis. A policy is pinned by BOTH version and computed manifest
// digest (the trusted manifest need not carry a self-referential digest field).
// Moving staging changes finding applicability, not review of pinned history.
import { policyDigest } from './load-policy.mjs';

export function reviewIdentity({ repository_id: repositoryId, pr_node_id: prNodeId, mode = 'OPEN_PR', comparison_basis: basis, head_sha: headSha, merge_sha: mergeSha, base_sha: baseSha, protocol_version: protocolVersion, policy_version: policyVersion, policy_sha256: policySha256 } = {}) {
  return {
    repository_id: repositoryId ?? null,
    pr_node_id: prNodeId ?? null,
    mode,
    comparison_basis: basis ?? (mode === 'HISTORICAL' ? 'HISTORICAL_PINNED' : 'HEAD_TO_BASE'),
    head_sha: mode === 'HISTORICAL' ? null : (headSha ?? null),
    merge_sha: mode === 'HISTORICAL' ? (mergeSha ?? null) : null,
    base_sha: baseSha ?? null,
    protocol_version: protocolVersion ?? null,
    policy_version: policyVersion ?? null,
    policy_sha256: policySha256 ?? null,
  };
}
export function buildQueue({ ledger, policy, openPrs = [], mergedPrs = [], isQualifying } = {}) {
  if (!ledger) throw Object.assign(new Error('buildQueue requires the ledger'), { code: 'E_LIMITS' });
  const protocol = policy?.protocol_version ?? 'unknown';
  const repoOf = (p) => p.repository_id ?? policy?.repository_id ?? 'unknown';
  // R4 (cold review): a work identity shorter than 12 chars per sha degrades to
  // 'norev' — an unkeyed launch cannot be superseded or bounded, so the item must
  // block visibly instead of queueing on a degenerate key
  const shaOk = (s) => typeof s === 'string' && s.length >= 12;
  // the revision part of a work key: first 12 hex of each sha is collision-safe
  // for a work identity (the full shas ride in the packet and the generation)
  const revKey = (...shas) => shas.map((s) => (shaOk(s) ? s.slice(0, 12) : 'norev')).join(':');
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
    } else if (!shaOk(p.head_sha) || !shaOk(p.base_sha)) {
      items.push({ kind: 'blocked', key: `pr:${p.number}`, pr: p, reason: 'revision identity unavailable (head/base sha missing) — an unkeyed launch cannot be bounded or superseded' });
    } else if (ok) {
      items.push({
        kind: 'review',
        key: `pr:${repoOf(p)}:${p.number}@${revKey(p.head_sha, p.base_sha)}:${protocol}`,
        pr: p,
        reason: 'open staging PR pending review',
      });
    } else {
      items.push({ kind: 'blocked', key: `pr:${p.number}`, pr: p, reason: 'not qualifying (mechanics/decisions)' });
    }
  }

  // 3. unreviewed merged staging PRs — newest merged first; the work identity is
  // the MERGE basis (a merged source is never reopened or re-reviewd on a new key).
  // D2065-S06: "reviewed" means an accepted review of THIS EXACT identity (repo,
  // PR node, the reviewed merge/base, protocol) — never PR-node memory, so a
  // re-merge (H2) after an earlier acceptance (H1) is still work, and a changed
  // basis/protocol/repository never silently covers it
  const merged = [...mergedPrs]
    .filter((p) => !ledger.prHasReview(reviewIdentity({
      repository_id: repoOf(p),
      pr_node_id: p.node_id,
      mode: 'HISTORICAL',
      merge_sha: p.merge_sha,
      base_sha: p.base_sha,
      protocol_version: protocol,
      policy_version: policy?.policy_version ?? null,
      policy_sha256: policy ? policyDigest(policy) : null,
    })))
    .sort((a, b) => {
      const ma = String(a.merged_at ?? '');
      const mb = String(b.merged_at ?? '');
      if (ma !== mb) return ma > mb ? -1 : 1;
      return (b.number ?? 0) - (a.number ?? 0);
    });
  for (const p of merged) {
    if (!shaOk(p.merge_sha) || !shaOk(p.base_sha)) {
      items.push({ kind: 'blocked', key: `merged:${p.number}`, pr: p, reason: 'merge identity unavailable (merge sha missing) — an unkeyed launch cannot be bounded or superseded' });
      continue;
    }
    items.push({
      kind: 'merged',
      key: `merged:${repoOf(p)}:${p.number}@${revKey(p.merge_sha, p.base_sha)}:${protocol}`,
      pr: p,
      reason: 'merged without a review record',
    });
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
//
// D2065-S05: evidence is BOUND or the item HOLDS — every shape below that is not a
// verifiable bound positive/negative returns {launch:false, hold:true, code, reason}
// instead of fail-opening:
//   - {present:boolean, checked:{staging_sha, checked_at}} — the only accepted
//     shapes; checked.staging_sha MUST equal the cycle's currentStagingSha (a
//     probe pinned to a DIFFERENT staging is stale evidence, not proof);
//   - a raw boolean / null / malformed object — unbound, never proof of anything;
//   - present:false WITH a bound staging reference is the ONLY durable
//     ALREADY_FIXED disposition;
//   - a missing currentStagingSha on the cycle side holds too (E_HISTORICAL_STAGING)
//     — without it, binding cannot be verified.
export async function gateHistorical({ item, revalidateFinding, currentStagingSha } = {}) {
  if (typeof revalidateFinding !== 'function') {
    return {
      launch: false, hold: true, code: 'E_HISTORICAL_UNVERIFIED',
      reason: `finding ${item?.key}: no revalidateFinding adapter — historical remediation holds before claim/budget/delivery`,
    };
  }
  let evidence;
  try {
    evidence = await revalidateFinding(item);
  } catch (e) {
    return {
      launch: false, hold: true, code: 'E_HISTORICAL_HOLD',
      reason: `finding ${item?.key}: revalidation probe failed (${e.message ?? e}) — uncertainty holds, never launches`,
    };
  }
  if (evidence === null || evidence === undefined || typeof evidence === 'boolean') {
    return {
      launch: false, hold: true, code: 'E_HISTORICAL_UNBOUND',
      reason: `finding ${item?.key}: raw boolean/null revalidation result carries no staging binding — not evidence of present OR absent`,
    };
  }
  const checked = evidence && typeof evidence === 'object' ? evidence.checked : null;
  const shaOk = (s) => typeof s === 'string' && /^[0-9a-f]{40,64}$/.test(s);
  const timeOk = typeof checked?.checked_at === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(checked.checked_at)
    && Number.isFinite(Date.parse(checked.checked_at))
    && new Date(checked.checked_at).toISOString() === checked.checked_at.replace(/(?:\.(\d{1,3}))?Z$/, (_, fraction) => `.${(fraction ?? '').padEnd(3, '0')}Z`);
  if (typeof evidence.present !== 'boolean' || !checked || !shaOk(checked.staging_sha) || !timeOk) {
    return {
      launch: false, hold: true, code: 'E_HISTORICAL_UNBOUND',
      reason: `finding ${item?.key}: malformed revalidation evidence (${JSON.stringify(evidence).slice(0, 120)}) — no valid {present, checked:{staging_sha,checked_at}} binding`,
    };
  }
  if (!shaOk(currentStagingSha)) {
    return {
      launch: false, hold: true, code: 'E_HISTORICAL_STAGING',
      reason: `finding ${item?.key}: the cycle carries no current staging revision — revalidation evidence cannot be bound`,
    };
  }
  if (checked.staging_sha !== currentStagingSha) {
    return {
      launch: false, hold: true, code: 'E_HISTORICAL_STALE',
      reason: `finding ${item?.key}: evidence was checked against staging ${checked.staging_sha.slice(0, 12)} but the cycle's staging is ${currentStagingSha.slice(0, 12)} — stale/mismatched staging holds`,
    };
  }
  if (!evidence.present) {
    return {
      launch: false, disposition: 'ALREADY_FIXED', evidence: checked,
      reason: `finding ${item?.key} no longer reproduces at the cycle's current staging (${currentStagingSha.slice(0, 12)}, verified ${checked.checked_at ?? 'unrecorded'}) — record an ALREADY_FIXED closure (with its evidence), never a fix launch`,
    };
  }
  return { launch: true, evidence: checked };
}
