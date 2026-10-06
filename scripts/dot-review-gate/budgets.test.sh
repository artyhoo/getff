#!/usr/bin/env bash
# Paired-negative for scripts/dot-review-gate/budgets.mjs (round-2 increment 8).
#
# Finite dispatch budgets, per the protocol's operating bounds (§Autonomy line 108):
# finite per-window Dot launches with persisted reservations BEFORE model invocation;
# at most two automatic fix/review rounds per finding occurrence; per-PR churn bounds;
# burst coalescing; quota pause; missing limits DISABLE unattended dispatch. An empty
# cron turn still costs inference, so the turn guard refuses to launch with nothing
# pending. Counters live in the ledger's retry_reservations — a crash/restart does
# not reset them.
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/dot-budgets-test.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

SCRIPT="$TMP/run-budgets-arms.mjs"
cat > "$SCRIPT" <<'NODE'
const [budgetsPath, ledgerPath, tmp] = process.argv.slice(2);
const { createBudgets, shouldLaunchCronTurn } = await import(budgetsPath);
const { openLedger } = await import(ledgerPath);

const log = (...a) => console.log(...a);
const fail = (m) => { console.log('FAIL ' + m); process.exitCode = 1; };
const expectCode = (fn, want, label) => {
  try { fn(); fail(`${label}: expected ${want}, no error thrown`); }
  catch (e) { if (e.code === want) log(`ok ${label}`); else fail(`${label}: expected ${want}, got ${e.code ?? e.message}`); }
};

const NOW = Date.parse('2026-10-06T12:00:00Z');
const LIMITS = { max_launches_per_window: 2, window_minutes: 10, max_fix_rounds_per_occurrence: 2, max_work_per_pr: 3, coalesce_minutes: 5 };

try {
  // RED: the module is what this suite pins — import failure IS the RED.

  // missing limits disable unattended dispatch — before any launch could happen
  const disabled = createBudgets({ ledger: openLedger(`${tmp}/b0.sqlite`), limits: {}, now: () => NOW });
  if (disabled.unattendedAllowed() !== false) fail('missing limits still allowed unattended dispatch');
  else log('ok missing-limits-disable-unattended');
  expectCode(() => disabled.reserveLaunch({ occurrenceKey: 'O1', prKey: 'pr:1' }), 'E_LIMITS_MISSING', 'reserve-refused-without-limits');

  const ledger = openLedger(`${tmp}/b1.sqlite`);
  const budgets = createBudgets({ ledger, limits: LIMITS, now: () => NOW });
  if (budgets.unattendedAllowed() !== true) fail('complete limits refused dispatch');
  else log('ok complete-limits-allow-dispatch');

  // reservation happens BEFORE the model invocation: exhaust the window and the
  // launch function is never called — the bound applies pre-inference
  let launches = 0;
  const launchModel = () => { launches += 1; };
  const guardedLaunch = (args) => { budgets.reserveLaunch(args); launchModel(args); };
  guardedLaunch({ occurrenceKey: 'O-1', prKey: 'pr:9' });
  guardedLaunch({ occurrenceKey: 'O-2', prKey: 'pr:9' });
  expectCode(() => guardedLaunch({ occurrenceKey: 'O-3', prKey: 'pr:9' }), 'E_BUDGET', 'window-launch-budget-exhausted');
  if (launches === 2) log('ok reservation-precedes-invocation');
  else fail(`launches ran past the budget: ${launches}`);

  // per-occurrence churn: at most two fix rounds per finding occurrence
  // (the churn arms run at a raised window budget so the WINDOW bound never
  // fires before the bound under test)
  const CHURN_LIMITS = { ...LIMITS, max_launches_per_window: 10 };
  const l2 = openLedger(`${tmp}/b2.sqlite`);
  const b2 = createBudgets({ ledger: l2, limits: CHURN_LIMITS, now: () => NOW });
  b2.reserveLaunch({ occurrenceKey: 'O-x', prKey: 'pr:8' });
  b2.reserveLaunch({ occurrenceKey: 'O-x', prKey: 'pr:8' });
  expectCode(() => b2.reserveLaunch({ occurrenceKey: 'O-x', prKey: 'pr:8' }), 'E_BUDGET', 'per-occurrence-churn-bounded');

  // per-PR churn bound
  b2.reserveLaunch({ occurrenceKey: 'O-y', prKey: 'pr:8' });
  expectCode(() => b2.reserveLaunch({ occurrenceKey: 'O-z', prKey: 'pr:8' }), 'E_BUDGET', 'per-pr-churn-bounded');

  // the counters are PERSISTED: a crash/restart does not reset them
  l2.close?.();
  const l3 = openLedger(`${tmp}/b2.sqlite`);
  const b3 = createBudgets({ ledger: l3, limits: CHURN_LIMITS, now: () => NOW });
  expectCode(() => b3.reserveLaunch({ occurrenceKey: 'O-y2', prKey: 'pr:8' }), 'E_BUDGET', 'counters-survive-restart');

  // the window rolls: a fresh window gets a fresh launch budget
  const b4 = createBudgets({ ledger: l3, limits: CHURN_LIMITS, now: () => NOW + 11 * 60 * 1000 });
  b4.reserveLaunch({ occurrenceKey: 'O-w', prKey: 'pr:7' });
  log('ok window-rolls');

  // burst coalescing: identical events inside the window collapse to one
  const first = b4.coalesce({ eventKey: 'push:PR_9:sha-abc', nowMs: NOW });
  const second = b4.coalesce({ eventKey: 'push:PR_9:sha-abc', nowMs: NOW + 60_000 });
  if (first.skipped !== false || second.skipped !== true) fail(`coalesce ${JSON.stringify([first, second])}`);
  else log('ok coalesce-collapses-burst');
  const later = b4.coalesce({ eventKey: 'push:PR_9:sha-abc', nowMs: NOW + 6 * 60 * 1000 });
  if (later.skipped !== false) fail('coalesce window never expires');
  else log('ok coalesce-window-expires');

  // quota pause blocks new model work until explicitly resumed
  b4.pauseForQuota('launch budget exhausted upstream');
  if (b4.unattendedAllowed() !== false) fail('quota pause did not disable dispatch');
  expectCode(() => b4.reserveLaunch({ occurrenceKey: 'O-q', prKey: 'pr:6' }), 'E_QUOTA_PAUSED', 'quota-pause-blocks-dispatch');
  b4.resumeQuota();
  b4.reserveLaunch({ occurrenceKey: 'O-q', prKey: 'pr:6' });
  log('ok quota-pause-and-resume');

  // an empty cron turn launches no model work: the guard reads pending work first
  let cronLaunches = 0;
  const cronTurn = (budgetsInst, led) => {
    if (!shouldLaunchCronTurn({ ledger: led })) return 'idle';
    budgetsInst.reserveLaunch({ occurrenceKey: 'O-c', prKey: 'pr:5' });
    cronLaunches += 1;
    return 'launched';
  };
  const emptyLedger = openLedger(`${tmp}/b3.sqlite`);
  const b5 = createBudgets({ ledger: emptyLedger, limits: LIMITS, now: () => NOW });
  if (cronTurn(b5, emptyLedger) !== 'idle' || cronLaunches !== 0) fail('empty cron turn still launched');
  else log('ok empty-cron-turn-no-inference');
  emptyLedger.recordFindings('rep-b', [{ key: 'B-1', requirement: 'r', category: 'c', severity: 'major', blocking: true }]);
  if (cronTurn(b5, emptyLedger) !== 'launched' || cronLaunches !== 1) fail('pending work did not launch');
  else log('ok pending-work-launches');
  emptyLedger.close?.();
  l3.close?.();
} catch (e) {
  fail(`unexpected: ${e.stack?.split('\n').slice(0, 2).join(' | ')}`);
}
NODE

# shellcheck disable=SC1091
source "$DIR/suite-harness.sh"
out="$(node "$SCRIPT" "$DIR/budgets.mjs" "$DIR/ledger.mjs" "$TMP" 2>&1)"; status=$?
assert_suite_arms "budgets.test.sh" "$status" "$out" \
  missing-limits-disable-unattended reserve-refused-without-limits \
  complete-limits-allow-dispatch window-launch-budget-exhausted \
  reservation-precedes-invocation per-occurrence-churn-bounded \
  per-pr-churn-bounded counters-survive-restart window-rolls \
  coalesce-collapses-burst coalesce-window-expires \
  quota-pause-blocks-dispatch quota-pause-and-resume \
  empty-cron-turn-no-inference pending-work-launches || exit 1
echo "budgets.test.sh: all green"
