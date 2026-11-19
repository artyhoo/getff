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

  // ── SP-5 / ST-1: recovery restores the ORIGINAL bounded payload ───────────────
  // The INTENT row stored only the payload digest: a crash before the file write
  // followed by recovery rendered {recovered:true} — none of the original
  // instructions survived the restart. Recovery must re-render the stored
  // original content, digest-verified, under the same action id.
  const sp5Broken = createCcAdapter({ ledger, coordinationDir: `${coordDir}/missing-sp5/nope`, notify: async () => {} });
  const sp5Payload = { instruction: 'fix artyhoo/getff#F-5 at rev abc', kind: 'fix-assignment' };
  await sp5Broken.dispatchAction({ kind: 'fix-assignment', targetSession: 'sess-sp5', payload: sp5Payload }).catch(() => {});
  const sp5Id = ledger.coordList('INTENT').at(-1).id;
  const sp5Recovered = adapter.recoverPending().recovered ?? [];
  if (!sp5Recovered.includes(sp5Id)) fail(`sp5 recovery missed the action ${sp5Id}`);
  const sp5Msg = readFileSync(`${coordDir}/_dot-gate-msg-${sp5Id}.md`, 'utf8');
  if (!sp5Msg.includes('fix artyhoo/getff#F-5 at rev abc')) fail(`sp5 recovery lost the original payload: ${sp5Msg.slice(0, 200)}`);
  else log('ok recovery-restores-original-payload');

  // bounded recovery: the retry budget is a persisted per-action reservation; an
  // exhausted budget HOLDS the row (named error) instead of retrying forever
  const sp5bBroken = createCcAdapter({ ledger, coordinationDir: `${coordDir}/missing-sp5b/nope`, notify: async () => {} });
  await sp5bBroken.dispatchAction({ kind: 'wake', targetSession: 'sess-sp5b', payload: { n: 1 } }).catch(() => {});
  const sp5bId = ledger.coordList('INTENT').at(-1).id;
  const sp5bRec = createCcAdapter({ ledger, coordinationDir: `${coordDir}/missing-sp5b/nope`, notify: async () => {}, maxRecoveryAttempts: 1 });
  sp5bRec.recoverPending();
  sp5bRec.recoverPending();
  const sp5bRow = ledger.coordGet(sp5bId);
  if (sp5bRow.state !== 'INTENT' || !/budget/.test(sp5bRow.last_error ?? '')) fail(`sp5 retry bound ${sp5bRow.state}/${sp5bRow.last_error}`);
  else log('ok recovery-retry-budget-holds');

  // cold-review fix: the digest HOLD needs its own executable arm — tamper the
  // stored original WITHOUT touching the digest; recovery must hold the row
  // (a corrupt stored payload is never delivered as instructions)
  const dgBroken = createCcAdapter({ ledger, coordinationDir: `${coordDir}/missing-digest/nope`, notify: async () => {} });
  await dgBroken.dispatchAction({ kind: 'fix-assignment', targetSession: 'sess-digest', payload: { instruction: 'the original words' } }).catch(() => {});
  const dgId = ledger.coordList('INTENT').filter((a) => a.target === 'sess-digest').at(-1).id;
  {
    const { DatabaseSync } = await import('node:sqlite');
    const raw = new DatabaseSync(`${tmp}/cc.sqlite`);
    raw.prepare("UPDATE coord_actions SET payload_text = '{\"instruction\":\"TAMPERED\"}' WHERE id = ?").run(dgId);
    raw.close();
  }
  adapter.recoverPending();
  const dgRow = ledger.coordGet(dgId);
  const dgDelivered = existsSync(`${coordDir}/_dot-gate-msg-${dgId}.md`);
  if (dgRow.state !== 'INTENT' || !/digest/.test(dgRow.last_error ?? '')) fail(`digest hold ${dgRow.state}/${dgRow.last_error}`);
  else if (dgDelivered) fail('corrupt payload was delivered as instructions');
  else log('ok recovery-digest-mismatch-holds');

  // a lost DELIVERED mark (crash after write, before mark) heals WITHOUT losing
  // the message content
  const sp5d = await adapter.dispatchAction({ kind: 'review-request', targetSession: 'sess-sp5d', payload: { instruction: 'payload survives a lost mark' } });
  ledger.coordMark(sp5d.actionId, 'INTENT', 'simulated crash before the DELIVERED mark');
  adapter.recoverPending();
  const sp5dMsg = readFileSync(`${coordDir}/_dot-gate-msg-${sp5d.actionId}.md`, 'utf8');
  if (!sp5dMsg.includes('payload survives a lost mark')) fail('sp5 mark-crash recovery lost content');
  else log('ok crash-after-write-preserves-content');

  // wrong ACK content is not an acknowledgement (control — the first line must
  // carry THIS action id)
  const sp5c = await adapter.dispatchAction({ kind: 'review-request', targetSession: 'sess-sp5c', payload: { p: 1 } });
  writeFileSync(`${coordDir}/_dot-gate-ack-${sp5c.actionId}.md`, 'ACK something-else\n');
  adapter.pollAcks();
  if (adapter.state(sp5c.actionId).state !== 'DELIVERED') fail('sp5 wrong ack acked');
  else log('ok wrong-ack-content-not-acked');

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
  revoked-predecessor-allows-replacement notify-failure-nonfatal \
  recovery-restores-original-payload recovery-retry-budget-holds recovery-digest-mismatch-holds \
  crash-after-write-preserves-content wrong-ack-content-not-acked || exit 1
echo "cc-adapter.test.sh: all green"
