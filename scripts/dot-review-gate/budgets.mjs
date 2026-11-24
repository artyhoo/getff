// Dispatch budgets — round-2 packet increment 8.
//
// The protocol's operating bounds (docs/meta-factory/dot-review-protocol.md, autonomy):
// finite per-window Dot launches with persisted reservations BEFORE dispatch, at most
// two automatic fix/review rounds per finding occurrence, per-PR churn bounds, burst
// coalescing, quota pause — and missing limits DISABLE unattended dispatch entirely
// (design-document numbers are not account allowances).
//
// Pre-inference proof: reserveLaunch() runs INSIDE the caller's guarded launch path
// before the model function; an exhausted budget throws before any invocation can be
// scheduled (see budgets.test.sh reservation-precedes-invocation — the launch spy
// never fires past the bound). Counters are the ledger's retry_reservations rows:
// they persist across crash/restart and are never reset by replay. An empty cron
// turn still costs inference, so shouldLaunchCronTurn reads pending work first and
// an idle turn launches nothing.

const REQUIRED_LIMITS = ['max_launches_per_window', 'window_minutes', 'max_fix_rounds_per_occurrence', 'max_work_per_pr', 'coalesce_minutes'];

function code(name, message) {
  const e = new Error(message);
  e.code = name;
  return e;
}

export function createBudgets({ ledger, limits, now = () => Date.now() } = {}) {
  if (!ledger) throw code('E_LIMITS', 'createBudgets requires the ledger');
  const missing = REQUIRED_LIMITS.filter((k) => !Number.isInteger(limits?.[k]) || limits[k] <= 0);

  return {
    // unattended dispatch is allowed only with EVERY bound declared and no quota pause
    unattendedAllowed() {
      return missing.length === 0 && !ledger.isQuotaPaused();
    },

    // Persisted reservation BEFORE model invocation. Counter keys:
    //   launch:<windowId>          — finite per-window launches
    //   fix:<occurrenceKey>        — ≤ max_fix_rounds_per_occurrence (protocol: 2)
    //   prchurn:<prKey>            — per-PR churn bound
    reserveLaunch({ occurrenceKey, prKey } = {}) {
      if (missing.length > 0) {
        throw code('E_LIMITS_MISSING', `unattended dispatch is disabled — missing limits: ${missing.join(', ')}`);
      }
      if (ledger.isQuotaPaused()) {
        throw code('E_QUOTA_PAUSED', `quota pause is active (${ledger.quotaReason() ?? 'reason unstated'}) — resume explicitly`);
      }
      const nowMs = now();
      const windowId = Math.floor(nowMs / (limits.window_minutes * 60_000));
      ledger.reserveRetry(`launch:${windowId}`, limits.max_launches_per_window, nowMs);
      if (occurrenceKey) ledger.reserveRetry(`fix:${occurrenceKey}`, limits.max_fix_rounds_per_occurrence, nowMs);
      if (prKey) ledger.reserveRetry(`prchurn:${prKey}`, limits.max_work_per_pr, nowMs);
      return { windowId, reservedAt: new Date(nowMs).toISOString() };
    },

    // Burst coalescing: an event key seen inside the window is skipped (its earlier
    // reservation stands); outside the window it proceeds again.
    coalesce({ eventKey, nowMs = now() } = {}) {
      if (!eventKey) throw code('E_LIMITS', 'coalesce requires eventKey');
      const seen = ledger.coalesceMark(eventKey, nowMs, limits.coalesce_minutes * 60_000);
      return { skipped: seen === true };
    },

    pauseForQuota(reason) {
      ledger.setQuotaPaused(true, reason);
    },

    resumeQuota() {
      ledger.setQuotaPaused(false, null);
    },
  };
}

// The cron-turn guard: pending work exists (unpublished outbox events or open
// findings) — an idle turn launches no model call. It deliberately reads only
// these two signals: an idle guard UNDER-launches (a missed turn is retried by
// the next cron tick) and never over-launches.
export function shouldLaunchCronTurn({ ledger } = {}) {
  if (!ledger) throw code('E_LIMITS', 'shouldLaunchCronTurn requires the ledger');
  const counts = ledger.counts();
  if (counts.outbox_pending > 0) return true;
  if (ledger.listOpenFindings().length > 0) return true;
  return false;
}
