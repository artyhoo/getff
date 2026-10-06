// CC coordination adapter — round-2 packet increment 6.
//
// The adapter wraps the coordination mechanisms that ACTUALLY exist in this
// destination (probed 2026-10-06):
//   - the file channel `~/.claude-coordination/<project>/` with the
//     `_handoff-<sessionId>.md` + `Read when:` first-line convention (161 live
//     handoff files) — the message surface;
//   - osascript notifications, the watcher's wake convention
//     (MERGE_LOCK_WATCHER_NOTIFY=osascript in ~/.claude/scripts/merge-lock-watcher.sh);
//   - coordination session UUIDs as the address space.
// No session bus is invented: the adapter writes plain files the same way every
// other coordination session here already does, and the deployment wires the real
// directory (tests use a tmp dir; the module never hardcodes operator paths).
//
// Contract:
//   - INTENT before delivery — the action row lands in the gate ledger (the same
//     authoritative journal) BEFORE any file write;
//   - ACK is separate from message success — a DELIVERED row flips to ACKED only
//     when the recipient's ack file appears (pollAcks), never from the write itself;
//   - stable action ids — the UUID IS the message filename, so duplicate/restart
//     recovery is idempotent by construction (recoverPending re-delivers INTENT
//     rows; a crash between write and mark heals through the file check);
//   - cessation/fencing — a dispatch that replaces a finding assignment refuses on
//     a revoked assignment (E_FENCING) and HOLDS while cessation is not
//     established (E_CESSATION_UNKNOWN: the claim is live, or expired without an
//     explicit revoke);
//   - wake failure is recorded, never fatal — delivery is the file write.

import { randomUUID, createHash } from 'node:crypto';
import { writeFileSync, renameSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function createCcAdapter({ ledger, coordinationDir, notify, maxRecoveryAttempts = 2, now = () => Date.now() } = {}) {
  if (!ledger || !coordinationDir) {
    throw Object.assign(new Error('createCcAdapter requires ledger and coordinationDir'), { code: 'E_CONFIG' });
  }
  const msgPath = (id) => join(coordinationDir, `_dot-gate-msg-${id}.md`);
  const ackPath = (id) => join(coordinationDir, `_dot-gate-ack-${id}.md`);

  const writeAtomic = (path, text) => {
    const tmp = `${path}.tmp-${randomUUID()}`;
    writeFileSync(tmp, text);
    renameSync(tmp, path);
  };

  const renderMessage = (action, payload) => [
    `Read when: dot-gate action ${action.id} (${action.kind}) — act on the JSON block, then write the ack file named below.`,
    '',
    '```json',
    JSON.stringify(payload ?? {}, null, 2),
    '```',
    '',
    'Acknowledge by writing the file:',
    '',
    '```',
    `_dot-gate-ack-${action.id}.md beside this message, first line: ACK ${action.id}`,
    '```',
    '',
  ].join('\n');

  return {
    // intent → (fencing/cessation gate) → deliver → DELIVERED; notify best-effort
    async dispatchAction({ kind, targetSession, payload, replacesAssignment, leaseMinutes } = {}) {
      if (!kind || !targetSession) {
        throw Object.assign(new Error('dispatchAction requires kind and targetSession'), { code: 'E_LIMITS' });
      }
      if (replacesAssignment !== undefined) {
        // held replacement: the previous owner's stop must be PROVEN before a
        // replacement message goes out
        ledger.assertCessation(replacesAssignment, { nowMs: now(), leaseMinutes });
      }
      const id = randomUUID();
      // SP-5/ST-1: the ORIGINAL bounded payload text is stored WITH the digest, so
      // a crash-before-write restart can re-render the real instructions
      const payloadText = JSON.stringify(payload ?? {});
      const action = ledger.coordIntent({
        id, kind, target: targetSession,
        payloadDigest: createHash('sha256').update(payloadText).digest('hex'),
        payloadText,
      });
      try {
        if (!existsSync(msgPath(id))) {
          writeAtomic(msgPath(id), renderMessage(action, payload));
        }
        ledger.coordMark(id, 'DELIVERED');
      } catch (e) {
        ledger.coordMark(id, 'INTENT', e.message);
        throw e;
      }
      if (notify) {
        try {
          await notify({ actionId: id, kind, targetSession });
        } catch (e) {
          ledger.coordMark(id, 'DELIVERED', `notify failed: ${e.message}`);
        }
      }
      return { actionId: id, state: 'DELIVERED' };
    },

    // crash/restart recovery: INTENT rows are re-delivered idempotently (the file
    // name is the action id; an existing file from a crash-after-write heals the
    // mark). SP-5/ST-1: the row's ORIGINAL payload text is re-rendered after a
    // digest verification — a stub is never delivered in place of the real
    // instructions — and each recovery attempt draws from a persisted per-action
    // retry budget; an exhausted budget HOLDS the row instead of retrying forever.
    recoverPending() {
      const recovered = [];
      for (const a of ledger.coordList('INTENT')) {
        try {
          ledger.reserveRetry(`coord-recover:${a.id}`, maxRecoveryAttempts);
          if (!existsSync(msgPath(a.id))) {
            let payload = { recovered: true };
            if (typeof a.payload_text === 'string' && a.payload_text.length > 0) {
              const digest = createHash('sha256').update(a.payload_text).digest('hex');
              if (digest !== a.payload_digest) {
                throw Object.assign(new Error('recovered payload fails its digest — the stored original is corrupt; holding'), { code: 'E_DIGEST' });
              }
              payload = JSON.parse(a.payload_text);
            }
            writeAtomic(msgPath(a.id), renderMessage(a, payload));
          }
          ledger.coordMark(a.id, 'DELIVERED');
          recovered.push(a.id);
        } catch (e) {
          const why = e.code === 'E_BUDGET'
            ? `recovery retry budget exhausted (${maxRecoveryAttempts}) — holding; a fresh reservation is an operator reset`
            : e.message;
          ledger.coordMark(a.id, 'INTENT', why);
        }
      }
      return { recovered };
    },

    // ACK is its own transition: only the recipient's ack file flips the state
    pollAcks() {
      const acked = [];
      for (const a of ledger.coordList('DELIVERED')) {
        if (existsSync(ackPath(a.id))) {
          let firstLine = '';
          try { firstLine = (readFileSync(ackPath(a.id), 'utf8').split('\n')[0] ?? '').trim(); } catch { /* unreadable ack — treat as absent */ }
          if (firstLine.startsWith(`ACK ${a.id}`)) {
            ledger.coordMark(a.id, 'ACKED');
            acked.push(a.id);
          }
        }
      }
      return { acked };
    },

    state: (actionId) => ledger.coordGet(actionId),
  };
}
