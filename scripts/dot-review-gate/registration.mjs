// Managed-PR registration — round-2 packet increment 9.
//
// The managed-PR exception (CLAUDE.md «Agent PR merge policy», DotPRReviewV2): once
// a PR carries a durable coordinator registration receipt, merge and auto-merge
// authority for THAT PR transfers to the Claude Code coordinator — the executor
// submits fixes and evidence but never merges or arms it independently. Contract
// enforced here:
//   - dependency-aware ordering: armed-state reconciliation completes BEFORE the
//     registration issues — an armed PR is disarmed first; an UNKNOWN armed state
//     (probe failure) holds registration and writes no row. Admission into managed
//     processing reads the same ledger: `getRegistration() === undefined` is the hold.
//   - the receipt is durable (ledger-persisted, restart-persistent) and unique per PR.
//   - merge is DEFAULT OFF; enabling (or disabling) requires an explicit recorded
//     operator transition. Release from management likewise.
//   - the executor's merge/arm actions refuse outright (E_SELF_MERGE); the
//     registered coordinator may arm.
// Native enforcement against the real GitHub (probe/disarm transport, merge API)
// is a LIVE acceptance requirement, not a prompt guarantee — offline this module
// gates the mechanics over injected transport functions.

function code(name, message) {
  const e = new Error(message);
  e.code = name;
  return e;
}

const normalize = (row) => (row ? { ...row, merge_enabled: row.merge_enabled === 1 } : undefined);

export async function registerManagedPr({
  ledger, prNodeId, prNumber, coordinator, nowMs = Date.now(),
  checkAutoMergeState, disarmAutoMerge,
} = {}) {
  if (!ledger) throw code('E_LIMITS', 'registerManagedPr requires the ledger');
  if (!prNodeId || !coordinator) throw code('E_LIMITS', 'registerManagedPr requires prNodeId and coordinator');
  if (typeof checkAutoMergeState !== 'function' || typeof disarmAutoMerge !== 'function') {
    throw code('E_ARMED_UNKNOWN', 'armed-state reconciliation requires the probe and disarm transports — unknown armed state holds registration');
  }
  let state;
  try {
    state = await checkAutoMergeState();
  } catch (e) {
    throw code('E_ARMED_UNKNOWN', `auto-merge state could not be read (${e.message}) — registration and admission held until reconciliation`);
  }
  if (state?.armed) {
    try {
      await disarmAutoMerge();
    } catch (e) {
      throw code('E_ARMED_UNKNOWN', `auto-merge is armed and disarm failed (${e.message}) — registration held`);
    }
  }
  const reconciledAt = new Date(nowMs).toISOString();
  ledger.insertRegistration({ prNodeId, prNumber, coordinator, reconciledAt });
  return normalize(ledger.getRegistration(prNodeId));
}

export function setMergeEnabled({ ledger, prNodeId, enabled, operatorTransition } = {}) {
  if (typeof operatorTransition !== 'string' || operatorTransition.trim().length === 0) {
    throw code('E_OPERATOR_REQUIRED', 'changing the merge switch requires an explicit recorded operator transition');
  }
  return normalize(ledger.updateRegistration(prNodeId, { state: 'ACTIVE', mergeEnabled: enabled, operatorTransition }));
}

// The managed executor never merges or arms a registered PR — merge and auto-merge
// authority belongs to the registered coordinator alone.
export function executorGuard({ registration, principal, action } = {}) {
  if (!registration || registration.state !== 'ACTIVE') {
    throw code('E_NOT_MANAGED', 'no ACTIVE registration receipt for this PR');
  }
  if ((action === 'merge' || action === 'arm') && principal !== registration.coordinator) {
    throw code('E_SELF_MERGE', `${principal} may not ${action} a managed PR — authority belongs to ${registration.coordinator}`);
  }
  return { allowed: true, principal, action };
}

export function releaseManagedPr({ ledger, prNodeId, operatorTransition } = {}) {
  if (typeof operatorTransition !== 'string' || operatorTransition.trim().length === 0) {
    throw code('E_OPERATOR_REQUIRED', 'release from management requires an explicit recorded operator transition');
  }
  return normalize(ledger.updateRegistration(prNodeId, { state: 'RELEASED', operatorTransition }));
}
