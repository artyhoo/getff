#!/usr/bin/env bash
# Paired-negative for scripts/dot-review-gate/cc-adapter.mjs (round-2 increment 6).
#
# The adapter wraps the coordination mechanisms that exist in this destination — the
# file channel (~/.claude-coordination/<project>/, `_handoff-<sessionId>.md` +
# `Read when:` convention, 161 live files at probe time) and osascript wakes (the
# merge-lock-watcher convention). Contract pinned here:
#   - INTENT lands in the ledger BEFORE any delivery write; a failed delivery stays
#     INTENT with its error and is re-delivered idempotently on recovery;
#   - ACK is a separate state, flipped only by the recipient's ack file — message
#     success never implies acknowledgement;
#   - the action UUID is the message filename: restart/duplicate recovery cannot
#     double-deliver;
#   - a dispatch replacing a finding assignment refuses on a revoked assignment
#     (E_FENCING) and HOLDS while cessation is not established (E_CESSATION_UNKNOWN);
#   - notify (wake) failure is recorded and never blocks delivery.
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/dot-cc-adapter-test.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

SCRIPT="$TMP/run-cc-arms.mjs"
cat > "$SCRIPT" <<'NODE'
const [adapterPath, ledgerPath, tmp] = process.argv.slice(2);
const { createCcAdapter } = await import(adapterPath);
const { openLedger } = await import(ledgerPath);
import { writeFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';

const log = (...a) => console.log(...a);
const fail = (m) => { console.log('FAIL ' + m); process.exitCode = 1; };
const expectCode = (fn, want, label) => {
  Promise.resolve().then(fn).then(
    () => fail(`${label}: expected ${want}, no error thrown`),
    (e) => { if (e.code === want) log(`ok ${label}`); else fail(`${label}: expected ${want}, got ${e.code ?? e.message}`); },
  );
};

const ledger = openLedger(`${tmp}/cc.sqlite`);
const coordDir = `${tmp}/coordination`;
import { mkdirSync } from 'node:fs';
mkdirSync(coordDir, { recursive: true });

try {
  // RED: the adapter module is what this suite pins — import failure IS the RED
  const adapter = createCcAdapter({ ledger, coordinationDir: coordDir, notify: async () => {} });

  // RED: intent precedes delivery — with a broken filesystem target the action row
  // exists in INTENT state with the error, and nothing was delivered
  let broken;
  try {
    broken = createCcAdapter({ ledger, coordinationDir: `${coordDir}/missing-subdir/nope`, notify: async () => {} });
  } catch (e) { fail(`broken adapter construct ${e.message}`); }
  await expectCode(() => broken.dispatchAction({ kind: 'fix-assignment', targetSession: 'sess-1', payload: { x: 1 } }), 'ENOENT', 'broken-delivery-surfaces');
  const intents = ledger.coordList('INTENT');
  if (intents.length !== 1 || intents[0].attempts < 1 || !intents[0].last_error) fail(`intent state ${JSON.stringify(intents)}`);
  else log('ok intent-precedes-delivery');

  // recovery re-delivers the INTENT idempotently — same action id, one file
  const rec = adapter.recoverPending();
  const first = rec.recovered[0];
  if (!first || !existsSync(`${coordDir}/_dot-gate-msg-${first}.md`)) fail(`recovery ${JSON.stringify(rec)}`);
  else log('ok recovery-redelivers-intent');
  adapter.recoverPending();
  const files = readdirSync(coordDir).filter((f) => f.startsWith('_dot-gate-msg-'));
  if (files.length !== 1) fail(`duplicate delivery: ${files.length} message files`);
  else log('ok restart-no-double-delivery');
  const msg = readFileSync(`${coordDir}/_dot-gate-msg-${first}.md`, 'utf8');
  if (!msg.startsWith('Read when:') || !msg.includes(`_dot-gate-ack-${first}.md`)) fail(`message convention missing: ${msg.slice(0, 80)}`);
  else log('ok message-follows-handoff-convention');

  // ACK is separate from delivery: delivered ≠ acked until the ack file exists
  const healthy = createCcAdapter({ ledger, coordinationDir: coordDir, notify: async () => {} });
  const sent = await healthy.dispatchAction({ kind: 'review-request', targetSession: 'sess-2', payload: { pr: 2056 } });
  if (sent.state !== 'DELIVERED') fail(`dispatch state ${sent.state}`);
  healthy.pollAcks();
  if (healthy.state(sent.actionId).state !== 'DELIVERED') fail('ack without ack file');
  else log('ok delivery-not-ack');
  writeFileSync(`${coordDir}/_dot-gate-ack-${sent.actionId}.md`, `ACK ${sent.actionId}\n`);
  healthy.pollAcks();
  if (healthy.state(sent.actionId).state !== 'ACKED') fail('ack file did not flip state');
  else log('ok ack-file-flips-state');

  // cessation/fencing: a replacement dispatch is held while the previous owner's
  // stop is unproven, and refused outright on a revoked assignment
  ledger.recordFindings('rep-cc', [{ key: 'artyhoo/getff#CC1', blocking: true }]);
  const claim = ledger.claimFinding({ findingKey: 'artyhoo/getff#CC1', owner: 'exec-a', leaseMinutes: 30, nowMs: Date.now() });
  await expectCode(() => healthy.dispatchAction({ kind: 'fix-assignment', targetSession: 'sess-3', payload: {}, replacesAssignment: claim.assignment_id, leaseMinutes: 30 }),
    'E_CESSATION_UNKNOWN', 'replacement-held-while-claim-live');
  const clock2 = Date.now() + 31 * 60 * 1000;
  await expectCode(() => createCcAdapter({ ledger, coordinationDir: coordDir, notify: async () => {}, now: () => clock2 })
    .dispatchAction({ kind: 'fix-assignment', targetSession: 'sess-3', payload: {}, replacesAssignment: claim.assignment_id, leaseMinutes: 30 }),
    'E_CESSATION_UNKNOWN', 'replacement-held-while-expired-unrevoked');
  await expectCode(() => healthy.dispatchAction({ kind: 'noop', targetSession: 's', payload: {}, replacesAssignment: '00000000-0000-0000-0000-000000000000', leaseMinutes: 30 }),
    'E_NOT_FOUND', 'cessation-unknown-assignment-refused');
  ledger.revokeClaim({ assignmentId: claim.assignment_id, reason: 'coordinator reconciled cessation', nowMs: clock2 });
  const replacement = await createCcAdapter({ ledger, coordinationDir: coordDir, notify: async () => {}, now: () => clock2 })
    .dispatchAction({ kind: 'fix-assignment', targetSession: 'sess-3', payload: {}, replacesAssignment: claim.assignment_id, leaseMinutes: 30 });
  if (!replacement.actionId) fail('revoked predecessor still held replacement');
  else log('ok revoked-predecessor-allows-replacement');

  // notify (wake) failure is recorded, never fatal
  const grumpy = createCcAdapter({ ledger, coordinationDir: coordDir, notify: async () => { throw new Error('osascript denied'); } });
  const sent2 = await grumpy.dispatchAction({ kind: 'wake', targetSession: 'sess-4', payload: {} });
  if (sent2.state !== 'DELIVERED' || !existsSync(`${coordDir}/_dot-gate-msg-${sent2.actionId}.md`)) fail('notify failure blocked delivery');
  else log('ok notify-failure-nonfatal');
  ledger.close?.();
} catch (e) {
  fail(`unexpected: ${e.stack?.split('\n').slice(0, 2).join(' | ')}`);
}
NODE

# shellcheck disable=SC1091
source "$DIR/suite-harness.sh"
out="$(node "$SCRIPT" "$DIR/cc-adapter.mjs" "$DIR/ledger.mjs" "$TMP" 2>&1)"; status=$?
assert_suite_arms "cc-adapter.test.sh" "$status" "$out" \
  broken-delivery-surfaces intent-precedes-delivery recovery-redelivers-intent \
  restart-no-double-delivery message-follows-handoff-convention delivery-not-ack \
  ack-file-flips-state replacement-held-while-claim-live \
  replacement-held-while-expired-unrevoked cessation-unknown-assignment-refused \
  revoked-predecessor-allows-replacement notify-failure-nonfatal || exit 1
echo "cc-adapter.test.sh: all green"
