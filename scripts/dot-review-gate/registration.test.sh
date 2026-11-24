#!/usr/bin/env bash
# Paired-negative for scripts/dot-review-gate/registration.mjs (round-2 increment 9).
#
# The managed-PR exception (CLAUDE.md «Agent PR merge policy», DotPRReviewV2): once a
# PR carries a durable coordinator registration receipt, merge and auto-merge
# authority for THAT PR transfers to the coordinator — the executor submits fixes and
# evidence but never merges or arms it. Contract pinned here:
#   - registration reconciles armed auto-merge BEFORE issuing: an armed PR is
#     disarmed first; UNKNOWN armed state holds registration (and admission);
#   - the registration is durable (restart-persistent) and unique per PR;
#   - merge is DEFAULT OFF — enabling requires an explicit recorded operator
#     transition; the executor's merge/arm actions refuse outright (E_SELF_MERGE);
#   - release from management requires an explicit recorded operator transition.
# Native enforcement / armed-state reconciliation against the real GitHub is a LIVE
# acceptance requirement — these arms prove the offline gate mechanics only.
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/dot-registration-test.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

SCRIPT="$TMP/run-registration-arms.mjs"
cat > "$SCRIPT" <<'NODE'
const [registrationPath, ledgerPath, tmp] = process.argv.slice(2);
const { registerManagedPr, executorGuard, releaseManagedPr } = await import(registrationPath);
const { openLedger } = await import(ledgerPath);

const log = (...a) => console.log(...a);
const fail = (m) => { console.log('FAIL ' + m); process.exitCode = 1; };
const expectCode = (fn, want, label) => Promise.resolve().then(fn).then(
  () => fail(`${label}: expected ${want}, no error thrown`),
  (e) => { if (e.code === want) log(`ok ${label}`); else fail(`${label}: expected ${want}, got ${e.code ?? e.message}`); },
);

const NOW = Date.parse('2026-10-06T12:00:00Z');
const PR = { prNodeId: 'PR_kwDOTEST', prNumber: 2056 };

try {
  // RED: the module is what this suite pins — import failure IS the RED.

  // armed auto-merge is reconciled BEFORE registration issues
  const ledger = openLedger(`${tmp}/reg.sqlite`);
  const calls = { probed: 0, disarmed: 0 };
  const reg = await registerManagedPr({
    ledger, ...PR, coordinator: 'cc-coordinator/session-a', nowMs: NOW,
    checkAutoMergeState: async () => { calls.probed += 1; return { armed: true, method: 'enablePullRequestAutoMerge' }; },
    disarmAutoMerge: async () => { calls.disarmed += 1; return { disarmed: true }; },
  });
  if (calls.probed !== 1 || calls.disarmed !== 1) fail(`reconciliation ${JSON.stringify(calls)}`);
  else if (reg.state !== 'ACTIVE' || reg.merge_enabled !== false) fail(`registration ${JSON.stringify(reg)}`);
  else log('ok armed-state-reconciled-before-registration');

  // merge is default OFF; enabling needs the operator transition
  await expectCode(() => import(registrationPath).then((m) => m.setMergeEnabled({
    ledger, prNodeId: PR.prNodeId, enabled: true, operatorTransition: null,
  })), 'E_OPERATOR_REQUIRED', 'merge-enable-requires-operator-transition');
  const { setMergeEnabled } = await import(registrationPath);
  const enabled = await setMergeEnabled({ ledger, prNodeId: PR.prNodeId, enabled: true, operatorTransition: 'operator-2026-10-06: release to coordinator auto-merge' });
  if (enabled.merge_enabled !== true) fail(`enable ${JSON.stringify(enabled)}`);
  else log('ok operator-transition-enables-merge');

  // the executor never merges or arms a managed PR
  await expectCode(() => Promise.resolve(executorGuard({ registration: reg, principal: 'exec-a', action: 'merge' })), 'E_SELF_MERGE', 'executor-merge-refused');
  await expectCode(() => Promise.resolve(executorGuard({ registration: reg, principal: 'exec-a', action: 'arm' })), 'E_SELF_MERGE', 'executor-arm-refused');

  // cold-review fix 2: merge default OFF is a GATE, not a stored bit — while the
  // operator transition is absent, NOBODY merges or arms, the coordinator included
  await expectCode(() => Promise.resolve(executorGuard({ registration: reg, principal: 'cc-coordinator/session-a', action: 'merge' })), 'E_MERGE_DISABLED', 'coordinator-merge-refused-while-disabled');
  await expectCode(() => Promise.resolve(executorGuard({ registration: reg, principal: 'cc-coordinator/session-a', action: 'arm' })), 'E_MERGE_DISABLED', 'coordinator-arm-refused-while-disabled');

  // after the operator transition the merge path is the coordinator's alone
  // (reads the CURRENT durable row — the earlier `reg` snapshot predates the transition)
  const enabledRow = ledger.getRegistration(PR.prNodeId);
  executorGuard({ registration: enabledRow, principal: 'cc-coordinator/session-a', action: 'merge' });
  log('ok coordinator-may-merge-after-transition');
  executorGuard({ registration: enabledRow, principal: 'cc-coordinator/session-a', action: 'arm' });
  log('ok coordinator-may-arm');

  // registration is unique per PR and durable across restart
  await expectCode(() => registerManagedPr({
    ledger, ...PR, coordinator: 'cc-coordinator/session-b', nowMs: NOW + 1000,
    checkAutoMergeState: async () => ({ armed: false }), disarmAutoMerge: async () => ({}),
  }), 'E_ALREADY_REGISTERED', 'one-registration-per-pr');
  ledger.close?.();
  const ledger2 = openLedger(`${tmp}/reg.sqlite`);
  const again = ledger2.getRegistration(PR.prNodeId);
  if (again?.state !== 'ACTIVE' || again?.merge_enabled !== true) fail(`durable registration ${JSON.stringify(again)}`);
  else log('ok registration-durable-across-restart');

  // unknown armed state HOLDS registration (and admission) — no row, named error
  await expectCode(() => registerManagedPr({
    ledger: ledger2, prNodeId: 'PR_OTHER', prNumber: 42, coordinator: 'cc-coordinator/session-a', nowMs: NOW,
    checkAutoMergeState: async () => { throw Object.assign(new Error('probe down'), { status: 502 }); },
    disarmAutoMerge: async () => ({}),
  }), 'E_ARMED_UNKNOWN', 'unknown-armed-state-holds-registration');
  if (ledger2.getRegistration('PR_OTHER') !== undefined) fail('registration row written despite unknown armed state');
  else log('ok hold-writes-no-row');

  // release requires the explicit operator transition
  await expectCode(() => releaseManagedPr({ ledger: ledger2, prNodeId: PR.prNodeId, operatorTransition: null }), 'E_OPERATOR_REQUIRED', 'release-requires-operator-transition');
  const released = await releaseManagedPr({ ledger: ledger2, prNodeId: PR.prNodeId, operatorTransition: 'operator-2026-10-06: PR merged, management released' });
  if (released.state !== 'RELEASED') fail(`release ${JSON.stringify(released)}`);
  else log('ok release-with-transition');
  ledger2.close?.();
} catch (e) {
  fail(`unexpected: ${e.stack?.split('\n').slice(0, 2).join(' | ')}`);
}
NODE

# shellcheck disable=SC1091
source "$DIR/suite-harness.sh"
out="$(node "$SCRIPT" "$DIR/registration.mjs" "$DIR/ledger.mjs" "$TMP" 2>&1)"; status=$?
assert_suite_arms "registration.test.sh" "$status" "$out" \
  armed-state-reconciled-before-registration merge-enable-requires-operator-transition \
  operator-transition-enables-merge executor-merge-refused executor-arm-refused \
  coordinator-merge-refused-while-disabled coordinator-arm-refused-while-disabled \
  coordinator-may-merge-after-transition coordinator-may-arm \
  one-registration-per-pr registration-durable-across-restart \
  unknown-armed-state-holds-registration hold-writes-no-row \
  release-requires-operator-transition release-with-transition || exit 1
echo "registration.test.sh: all green"
