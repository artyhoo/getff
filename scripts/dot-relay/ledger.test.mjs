// Dot relay transactional ledger tests — DESIGN.md §Ledger + durable closure +
// multipart/index amendments. IMPLEMENTATION-EXACT Task 2 table.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';

import { openLedger } from './ledger.mjs';
import { CHAT_IDS, reportKey, canonical } from './contract.mjs';

const canonicalSha = (v) => sha256Of(canonical(v));

const sha256Of = (s) => createHash('sha256').update(s).digest('hex');
const sha40 = (s) => sha256Of(s).slice(0, 40);

let nowMs = 1_000_000;
const now = () => nowMs;

function freshLedger(opts = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'dot-ledger-'));
  const path = join(dir, 'ledger.sqlite');
  const ledger = openLedger(path, { now, ...opts });
  return { ledger, path, dir };
}

function makeReports(count, tag) {
  const reports = [];
  for (let i = 0; i < count; i++) {
    const body = `body ${tag} ${i} ${'y'.repeat(30)}`;
    reports.push({
      repository: 'artyhoo/getff',
      pr: 2100 + i,
      comment_id: `${tag}-${i}`,
      body_sha256: sha256Of(body),
      reviewed_sha: sha40(`${tag}-rv-${i}`),
      url: `https://github.com/artyhoo/getff/pull/2100#discussion_r${i}`,
      body,
    });
  }
  return reports;
}

function env(kind, id, producer, parents, payload) {
  // digest computed via ledger-agnostic canonical: reuse contract through ledger.ingest
  // is circular; build envelope and let a helper seal it with contract.digest.
  return { version: 1, kind, id, producer, parents, payload, sha256: null };
}

const { digest } = await import('./contract.mjs');
function seal(e) {
  const { sha256, ...rest } = e;
  e.sha256 = digest(rest);
  return e;
}

function batchEnv(id, tag, parents = []) {
  return seal(env('batch', id, CHAT_IDS.collector, parents, {
    batch_id: `BATCH-${tag}`,
    reports: makeReports(10, tag),
    complete: true,
  }));
}

function analysisEnv(id, batch, { candidates = [], excluded = [], consumed } = {}) {
  return seal(env('analysis', id, CHAT_IDS.analyst, [{ id: batch.id, sha256: batch.sha256 }], {
    consumed_report_keys: consumed ?? batch.payload.reports.map((r) => reportKey(r)),
    candidates,
    excluded,
  }));
}

function solutionEnv(id, analysis) {
  const kickoff = '# k\nexecute\n';
  const commands = [{ argv: ['node', '--test', 'x.test.mjs'], cwd: 'worktree', expected_exit: 0 }];
  return seal(env('solution', id, CHAT_IDS.solver, [{ id: analysis.id, sha256: analysis.sha256 }], {
    candidate_id: 'C1',
    finding_keys: ['F1'],
    reviewed_sha: sha40('rv'),
    base_sha: sha40('base'),
    ready: true,
    unresolved: [],
    prerequisites: [{ name: 'p', passed: true, evidence: 'e' }],
    scope_paths: ['scripts/dot-relay/ledger.mjs'],
    kickoff,
    commands,
    verify_commands: [{ argv: ['node', '--test', 'x.test.mjs'], cwd: 'worktree', expected_exit: 0 }],
    acceptance: ['green'],
    kickoff_sha256: sha256Of(kickoff),
    commands_sha256: digest(commands),
  }));
}

function ackPayload(deliveryId, event, artifactSha) {
  return {
    delivery_id: deliveryId,
    event_id: event.id,
    event_sha256: event.sha256,
    artifact_sha256: artifactSha,
    accepted: true,
    duplicate: false,
  };
}

const ROLE_DEST = { analyst: CHAT_IDS.analyst, solver: CHAT_IDS.solver };

function publicManifest(e, { destination = CHAT_IDS.analyst } = {}) {
  return {
    version: 1,
    status: 'READY',
    event_id: e.id,
    kind: e.kind,
    producer: e.producer,
    destination,
    sha256: sha256Of(JSON.stringify(e)),
    bytes: Buffer.byteLength(JSON.stringify(e)),
    parents: e.parents,
    artifact: { page_id: 'page_070fdd367758819192e503c9cee51251', reference: 'library-file:fixtures.json' },
    delivery_id: null,
  };
}

// --- baseline + ingest ---

test('fresh ledger seeds five BASELINE_HOLD batches and intake UNKNOWN, no outbox', () => {
  const { ledger } = freshLedger();
  const st = ledger.status();
  assert.equal(st.counts.baseline_hold, 5);
  assert.equal(st.counts.accepted_consumption_unknown, 1);
  assert.equal(st.counts.outbox_total, 0);
  for (let i = 1; i <= 5; i++) {
    const e = ledger.getEvent(`DOT-BATCH-000${i}`);
    assert.equal(e.state, 'BASELINE_HOLD');
    assert.equal(e.sha256, null); // placeholder: null digest, never invented
  }
  assert.equal(ledger.getEvent('DOT-INTAKE-20261008-01').state, 'ACCEPTED_CONSUMPTION_UNKNOWN');
});

test('baseline intake ingest is accepted UNKNOWN and never creates outbox or resend', () => {
  const { ledger } = freshLedger();
  const batch = batchEnv('DOT-BATCH-0001', 'seed1');
  const r = ledger.ingest(batch);
  assert.equal(r.state, 'BASELINE_HOLD'); // held until consumption receipt
  assert.equal(ledger.status().counts.outbox_total, 0);
  const intake = analysisEnv('DOT-INTAKE-20261008-01', batch);
  const r2 = ledger.ingest(intake);
  assert.equal(r2.state, 'ACCEPTED_CONSUMPTION_UNKNOWN');
  assert.equal(ledger.status().counts.outbox_total, 0);
});

test('ingest replay: same id+digest returns replay with no side effects; different digest conflicts', () => {
  const { ledger } = freshLedger();
  const batch = batchEnv('DOT-EVT-B1', 't1');
  const first = ledger.ingest(batch);
  assert.equal(first.state, 'READY');
  const second = ledger.ingest(batch);
  assert.equal(second.replay, true);
  assert.equal(ledger.status().counts.outbox_total, 1); // exactly one route

  const mutated = batchEnv('DOT-EVT-B1', 't1-mutated');
  const r3 = ledger.ingest(mutated);
  assert.equal(r3.state, 'CONFLICT');
  assert.equal(ledger.getEvent('DOT-EVT-B1').sha256, batch.sha256); // original bytes preserved
  assert.ok(ledger.status().blockers.some((b) => b.code === 'CONFLICT' && b.event_id === 'DOT-EVT-B1'));
});

test('batch READY makes exactly one collector->analyst outbox row (atomic event+outbox)', () => {
  const { ledger } = freshLedger();
  const batch = batchEnv('DOT-EVT-B2', 't2');
  ledger.ingest(batch);
  const deliveries = ledger.pendingDeliveries();
  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0].destination, CHAT_IDS.analyst);
  assert.equal(deliveries[0].event_id, batch.id);
});

test('crash between event insert and outbox insert rolls back atomically (faultAfter)', () => {
  const { ledger, path, dir } = freshLedger({ faultAfter: 'insert-outbox' });
  const batch = batchEnv('DOT-EVT-B3', 't3');
  assert.throws(() => ledger.ingest(batch));
  // Second independent connection verifies rollback: no event, no outbox.
  const other = new DatabaseSync(path);
  const events = other.prepare('SELECT COUNT(*) c FROM events').get().c;
  const outbox = other.prepare('SELECT COUNT(*) c FROM outbox').get().c;
  other.close();
  assert.equal(events, 6); // the 5 seeded batches + seeded intake
  assert.equal(outbox, 0);
  rmSync(dir, { recursive: true, force: true });
});

test('WAIT_PARENT becomes READY when the parent is imported later', () => {
  const { ledger } = freshLedger();
  const batch = batchEnv('DOT-EVT-B4', 't4');
  const analysis = analysisEnv('DOT-EVT-A4', batch);
  const r = ledger.ingest(analysis); // parent not imported yet
  assert.equal(r.state, 'WAIT_PARENT');
  assert.equal(ledger.status().counts.outbox_total, 0);
  ledger.ingest(batch); // parent arrives
  assert.equal(ledger.getEvent(analysis.id).state, 'COMPLETE_NO_ACTION'); // zero candidates
});

test('mismatched parent digest holds WAIT_PARENT, not discard', () => {
  const { ledger } = freshLedger();
  const batch = batchEnv('DOT-EVT-B5', 't5');
  const analysis = analysisEnv('DOT-EVT-A5', batch);
  analysis.parents[0].sha256 = '0'.repeat(64);
  analysis.sha256 = digest({ ...analysis, sha256: undefined });
  const r = ledger.ingest(analysis);
  assert.equal(r.state, 'WAIT_PARENT');
});

test('analysis with candidates makes exactly ONE analyst->solver outbox (all candidates together)', () => {
  const { ledger } = freshLedger();
  const batch = batchEnv('DOT-EVT-B6', 't6');
  withManifest(ledger, batch);
  ledger.ingest(batch);
  const analysis = analysisEnv('DOT-EVT-A6', batch, {
    candidates: [
      { candidate_id: 'C1', finding_keys: ['F'], report_keys: [reportKey(batch.payload.reports[0])], reviewed_sha: batch.payload.reports[0].reviewed_sha, summary: 's1' },
      { candidate_id: 'C2', finding_keys: ['F'], report_keys: [reportKey(batch.payload.reports[1])], reviewed_sha: batch.payload.reports[1].reviewed_sha, summary: 's2' },
    ],
  });
  // R04: holds WAIT_PARENT_ACK until the batch->analyst delivery is ACKED
  const r = ledger.ingest(analysis);
  assert.equal(r.state, 'WAIT_PARENT_ACK');
  assert.equal(ledger.pendingDeliveries().length, 1);
  const d = ledger.pendingDeliveries()[0];
  ledger.claimDelivery(d.delivery_id);
  ledger.ack(ackPayload(d.delivery_id, batch, publicManifest(batch).sha256), { trustedProducerRole: 'analyst' });
  // exactly ONE new analyst->solver delivery carries ALL candidates together
  // (the batch->analyst row is ACKED now, not pending)
  const solverDeliveries = ledger.pendingDeliveries().filter((x) => x.event_id === analysis.id);
  assert.equal(solverDeliveries.length, 1);
  assert.equal(solverDeliveries[0].destination, CHAT_IDS.solver);
  assert.equal(ledger.status().counts.outbox_total, 2);
});

test('solution READY waits in QUEUED for executor slot', () => {
  const { ledger } = freshLedger();
  const batch = batchEnv('DOT-EVT-B7', 't7');
  withManifest(ledger, batch);
  ledger.ingest(batch);
  const cand = { candidate_id: 'C1', finding_keys: ['F'], report_keys: [reportKey(batch.payload.reports[0])], reviewed_sha: batch.payload.reports[0].reviewed_sha, summary: 's' };
  const analysis = analysisEnv('DOT-EVT-A7', batch, { candidates: [cand] });
  ledger.ingest(analysis);
  const db = ledger.pendingDeliveries()[0];
  ledger.claimDelivery(db.delivery_id);
  ledger.ack(ackPayload(db.delivery_id, batch, publicManifest(batch).sha256), { trustedProducerRole: 'analyst' });
  withManifest(ledger, analysis, 'analyst');
  const solution = solutionEnv('DOT-EVT-S7', analysis);
  solution.payload.candidate_id = 'C1';
  solution.payload.finding_keys = ['F'];
  solution.payload.reviewed_sha = cand.reviewed_sha;
  seal(solution);
  const r = ledger.ingest(solution);
  assert.equal(r.state, 'WAIT_PARENT_ACK'); // R04: solver ACK pending
  const da = ledger.pendingDeliveries().find((x) => x.destination === CHAT_IDS.solver);
  ledger.claimDelivery(da.delivery_id);
  ledger.ack(ackPayload(da.delivery_id, analysis, publicManifest(analysis, { destination: CHAT_IDS.solver }).sha256), { trustedProducerRole: 'solver' });
  assert.equal(ledger.getEvent(solution.id).state, 'QUEUED');
  assert.equal(ledger.status().counts.outbox_total, 2);
});

test('report-version reconciliation: baseline receipt consumes keys; corrected version is new work', () => {
  const { ledger } = freshLedger();
  // Import old batch envelope first (held), then exact consumption receipt.
  const old1 = batchEnv('DOT-BATCH-0001', 'old1');
  ledger.ingest(old1);
  const keys = old1.payload.reports.map((r) => reportKey(r));
  const receipt = ledger.recordBaselineReceipt({
    intake_id: 'DOT-INTAKE-20261008-01',
    consumed_report_keys: keys,
    excluded: [],
  });
  assert.equal(receipt.ok, true);
  assert.equal(ledger.getEvent('DOT-BATCH-0001').state, 'CONSUMED');
  assert.equal(ledger.status().counts.outbox_total, 0); // never scheduled as fresh work

  // Replay of the same fully-consumed batch: no new work.
  const replay = ledger.ingest(batchEnv('DOT-EVT-B8-replay', 'old1')); // same keys, new envelope id
  assert.equal(replay.state, 'CONSUMED');

  // Corrected comment version = new report key -> READY + outbox.
  const corrected = JSON.parse(JSON.stringify(old1));
  corrected.id = 'DOT-EVT-B8-corrected';
  corrected.payload.batch_id = 'BATCH-old1-r2';
  const c = corrected.payload.reports[0];
  c.body = c.body + ' corrected';
  c.body_sha256 = sha256Of(c.body);
  seal(corrected);
  const r2 = ledger.ingest(corrected);
  assert.equal(r2.state, 'READY');
  assert.equal(ledger.status().counts.outbox_total, 1);
});

test('baseline receipt requires the exact running intake id and a full mapping', () => {
  const { ledger } = freshLedger();
  assert.throws(() => ledger.recordBaselineReceipt({ intake_id: 'WRONG-ID', consumed_report_keys: [], excluded: [] }));
  assert.throws(() => ledger.recordBaselineReceipt({ intake_id: 'DOT-INTAKE-20261008-01', consumed_report_keys: ['not-a-key'], excluded: [] }));
});

// --- deliveries: claim, receipt, ack, retries ---

function readyDelivery(ledger) {
  const batch = batchEnv(`DOT-EVT-BD-${Math.random().toString(36).slice(2, 8)}`, 'dl');
  withManifest(ledger, batch); // R04: ACK authority is the registered manifest
  ledger.ingest(batch);
  const d = ledger.pendingDeliveries()[0];
  return { batch, delivery: d };
}

test('delivery claim persists CLAIMED before tool invocation; ACK requires both digests', () => {
  const { ledger } = freshLedger();
  const { batch, delivery } = readyDelivery(ledger);
  const claimed = ledger.claimDelivery(delivery.delivery_id);
  assert.equal(claimed.state, 'CLAIMED');
  assert.equal(claimed.event_id, batch.id);

  // Wrong artifact digest must not ACK.
  const ack = ackPayload(delivery.delivery_id, batch, sha256Of('forged'));
  assert.throws(() => ledger.ack(ack));
  // Unknown delivery must not ACK.
  assert.throws(() => ledger.ack(ackPayload('DOT-DELIV-UNKNOWN', batch, sha256Of(JSON.stringify(batch)))));

  // Correct both digests -> SENT_ACCEPTED delivery becomes ACKED transactionally.
  ledger.receipt(delivery.delivery_id, { status: 'sent', receipt: { tool: 'send_message_to_thread', ok: true } });
  const okAck = ackPayload(delivery.delivery_id, batch, claimed.artifact_sha256);
  const r = ledger.ack(okAck);
  assert.equal(r.state, 'ACKED');
  assert.equal(ledger.getOutbox(delivery.delivery_id).state, 'ACKED');
  // duplicate ack is idempotent
  assert.equal(ledger.ack(okAck).state, 'ACKED');
});

test('claim returns the persisted original manifest ref across restart', () => {
  const { ledger, path } = freshLedger();
  const batch = batchEnv('DOT-EVT-BR1', 'ref');
  const manifest = publicManifest(batch);
  ledger.manifestImport({ manifest, producerRole: 'collector', cursorToken: 'tok-a' });
  ledger.ingest(batch);
  const d1 = ledger.pendingDeliveries()[0];
  const c1 = ledger.claimDelivery(d1.delivery_id);
  assert.equal(c1.source_page_id, manifest.artifact.page_id);
  assert.equal(c1.artifact_sha256, manifest.sha256);
  ledger.close();
  const reopened = openLedger(path, { now });
  // HOST-RESILIENCE §2: a plain open NEVER rewrites state — the un-receipted
  // claim stays CLAIMED until explicit reconcileHost proves the sender dead.
  const row = reopened.getOutbox(d1.delivery_id);
  assert.equal(row.state, 'CLAIMED');
  const stored = reopened.getManifest(batch.id);
  assert.equal(stored.artifact_sha256, manifest.sha256);
  assert.equal(stored.source_page_id, manifest.artifact.page_id);
  reopened.close();
});

test('uncertain send never retries; matching destination ACK clears it', () => {
  const { ledger } = freshLedger();
  const { delivery } = readyDelivery(ledger);
  const claim = ledger.claimDelivery(delivery.delivery_id);
  ledger.receipt(delivery.delivery_id, { status: 'uncertain', receipt: { tool: 'send', result: 'timeout' } });
  assert.equal(ledger.getOutbox(delivery.delivery_id).state, 'UNCERTAIN');
  nowMs += 24 * 3600 * 1000;
  assert.equal(ledger.pendingDeliveries().length, 0); // uncertain never auto-retries
  // ack with correct digests clears uncertainty transactionally:
  const ev = ledger.getEvent(delivery.event_id);
  const good = ackPayload(delivery.delivery_id, { id: ev.id, sha256: ev.sha256 }, claim.artifact_sha256);
  ledger.ack(good);
  assert.equal(ledger.getOutbox(delivery.delivery_id).state, 'ACKED');
});

function manifestSha(ledger, eventId) {
  const row = ledger.getManifest(eventId);
  return row?.artifact_sha256;
}

test('definitely-not-sent bounded retry: +4h, +8h, then BLOCKED_RETRIES', () => {
  const { ledger } = freshLedger();
  const { delivery } = readyDelivery(ledger);
  ledger.claimDelivery(delivery.delivery_id);
  ledger.receipt(delivery.delivery_id, { status: 'not-sent', receipt: { tool: 'send', error: 'pre-invocation refusal' } });
  let out = ledger.getOutbox(delivery.delivery_id);
  assert.equal(out.state, 'PENDING');
  assert.equal(out.next_ms, now() + 4 * 3600 * 1000);
  assert.equal(ledger.pendingDeliveries().length, 0); // not yet due
  nowMs += 4 * 3600 * 1000;
  assert.equal(ledger.pendingDeliveries().length, 1);
  ledger.claimDelivery(delivery.delivery_id);
  ledger.receipt(delivery.delivery_id, { status: 'not-sent', receipt: { error: 'refused again' } });
  out = ledger.getOutbox(delivery.delivery_id);
  assert.equal(out.next_ms, now() + 8 * 3600 * 1000);
  nowMs += 8 * 3600 * 1000;
  ledger.claimDelivery(delivery.delivery_id);
  ledger.receipt(delivery.delivery_id, { status: 'not-sent', receipt: { error: 'third refusal' } });
  assert.equal(ledger.getOutbox(delivery.delivery_id).state, 'BLOCKED');
  assert.equal(ledger.pendingDeliveries().length, 0);
});

test('openLedger is non-mutating: stale CLAIMED stays CLAIMED until reconcileHost proves the sender dead', () => {
  const { ledger, path } = freshLedger();
  const { delivery } = readyDelivery(ledger);
  ledger.claimDelivery(delivery.delivery_id, { sender: { boot_id: 'BOOT-1', pid: 111, start: 'Mon Oct  6 10:00:00 2026' } });
  ledger.close();
  const reopened = openLedger(path, { now });
  assert.equal(reopened.getOutbox(delivery.delivery_id).state, 'CLAIMED'); // plain open: read-only
  // same boot, sender still alive -> retained
  const alive = reopened.reconcileHost({
    bootId: 'BOOT-1',
    processProbe: () => ({ alive: true, start: 'Mon Oct  6 10:00:00 2026' }),
    controlActor: 'scheduler-tick',
  });
  assert.equal(alive.deliveries_uncertain, 0);
  assert.equal(reopened.getOutbox(delivery.delivery_id).state, 'CLAIMED');
  // same boot, sender proven dead -> UNCERTAIN (never back to PENDING)
  const dead = reopened.reconcileHost({
    bootId: 'BOOT-1',
    processProbe: () => ({ alive: false, start: null }),
    controlActor: 'scheduler-tick',
  });
  assert.equal(dead.deliveries_uncertain, 1);
  assert.equal(reopened.getOutbox(delivery.delivery_id).state, 'UNCERTAIN');
  reopened.close();
});

// --- executions ---

test('execution reservation is exclusive; crash holds UNCERTAIN slot with no TTL release', () => {
  const { ledger, path } = freshLedger();
  // R04-corrected chain: the solution is genuinely QUEUED (manifests + both
  // parent deliveries ACKED by their destination roles)
  const solution = solutionChain(ledger, 'E1');

  const r1 = ledger.claimExecution({ solutionId: solution.id, sessionId: '11111111-1111-4111-8111-111111111111' });
  assert.equal(r1.state, 'RESERVED');
  const r2 = ledger.claimExecution({ solutionId: solution.id, sessionId: '22222222-2222-4222-8222-222222222222' });
  assert.equal(r2.claimed, false);
  assert.equal(r2.held, true);

  // crash: plain reopen is read-only (HOST-RESILIENCE §2) — the slot stays
  // RESERVED far beyond any TTL until explicit reconcileHost with evidence.
  ledger.close();
  nowMs += 100 * 3600 * 1000;
  const reopened = openLedger(path, { now });
  assert.equal(reopened.getExecution(r1.execution_id).state, 'RESERVED');
  const r3 = reopened.claimExecution({ solutionId: solution.id, sessionId: '33333333-3333-4333-8333-333333333333' });
  assert.equal(r3.claimed, false);
  // coordinator reconciliation with a STRUCTURED death proof (R09: the shared
  // fresh ownership/death adapter's verdict — never ps-start/control prose)
  // frees the slot
  const rec = reopened.reconcileExecution({
    execution_id: r1.execution_id,
    evidence: {
      session_id: '11111111-1111-4111-8111-111111111111',
      control: 'operator-confirmed dead process 2026-10-08',
      death_proof: {
        kind: 'never-started', // the row never recorded a live child identity
        execution_id: r1.execution_id,
        pid: null,
        process_start: null,
      },
    },
    decision: 'CONFIRM_DEAD',
  });
  assert.equal(rec.state, 'ABORTED_UNCERTAIN');
  // solution_id is UNIQUE (one execution attempt per solution, ever): the
  // aborted solution itself can never be re-claimed — repair rounds arrive
  // as NEW solution envelopes.
  assert.throws(
    () => reopened.claimExecution({ solutionId: solution.id, sessionId: '44444444-4444-4444-8444-444444444444' }),
    (e) => e.code === 'EXECUTION_STATE',
  );
  // reconciliation freed the global slot: a DIFFERENT solution claims fine
  const solution2 = solutionChain(reopened, 'E1b');
  const r4 = reopened.claimExecution({ solutionId: solution2.id, sessionId: '44444444-4444-4444-8444-444444444444' });
  assert.equal(r4.state, 'RESERVED');
  reopened.close();
});

test('reconcileExecution refuses payload-supplied or evidence-free input', () => {
  const { ledger } = freshLedger();
  const { claim } = claimedExecution(ledger);
  assert.throws(() => ledger.reconcileExecution({ execution_id: claim.execution_id, evidence: { session_id: 'x' }, decision: 'CONFIRM_DEAD' }));
  assert.throws(() => ledger.reconcileExecution({ execution_id: claim.execution_id, evidence: null, decision: 'CONFIRM_DEAD' }));
});

// R09: CONFIRM_DEAD frees a slot ONLY on a structured death proof from the
// shared fresh ownership/death adapter — kind absent/old-boot/never-started,
// exact execution/session binding. Prose ("ps checked, looks gone"), foreign
// executions, and pid/start fields that disagree with the row all refuse.
test('R09: CONFIRM_DEAD requires a structured death_proof with exact execution binding', () => {
  const { ledger } = freshLedger();
  const sessionId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const { claim } = claimedExecution(ledger, { sessionId });
  // a RUNNING row that DID record a live child identity
  ledger.updateExecution(claim.execution_id, { state: 'RUNNING', pid: 601, process_start: CHILD_START });
  ledger.updateAttempt(claim.execution_id, 1, { state: 'RUNNING', boot_id: 'BOOT-1', child_pid: 601, child_start: CHILD_START });

  const call = (death_proof) => ledger.reconcileExecution({
    execution_id: claim.execution_id,
    evidence: { session_id: sessionId, control: 'operator-confirmed dead process 2026-10-08', death_proof },
    decision: 'CONFIRM_DEAD',
  });
  const deathProof = (over = {}) => ({ kind: 'absent', execution_id: claim.execution_id, pid: 601, process_start: CHILD_START, ...over });

  // no death proof at all: ps-start/control prose can never free the slot
  assert.throws(() => ledger.reconcileExecution({
    execution_id: claim.execution_id,
    evidence: { session_id: sessionId, control: 'operator-confirmed dead process 2026-10-08', pid: 601, process_start: CHILD_START },
    decision: 'CONFIRM_DEAD',
  }), (e) => e.code === 'RECONCILE_EVIDENCE');
  // prose kind / unsupported kind
  assert.throws(() => call(deathProof({ kind: 'ps-checked-prose-gone' })), (e) => e.code === 'RECONCILE_EVIDENCE');
  // proof bound to a DIFFERENT execution
  assert.throws(() => call(deathProof({ execution_id: 'DOT-EXEC-OTHER' })), (e) => e.code === 'RECONCILE_EVIDENCE');
  // pid/start disagreeing with the recorded row
  assert.throws(() => call(deathProof({ pid: 999 })), (e) => e.code === 'RECONCILE_EVIDENCE');
  assert.throws(() => call(deathProof({ process_start: 'Mon Jan  1 00:00:00 2001' })), (e) => e.code === 'RECONCILE_EVIDENCE');
  // slot still held after every refusal
  assert.equal(ledger.getExecution(claim.execution_id).state, 'RUNNING');

  // the adapter's verdict with exact binding frees the slot
  assert.equal(call(deathProof()).state, 'ABORTED_UNCERTAIN');
  assert.equal(ledger.getExecution(claim.execution_id).state, 'ABORTED_UNCERTAIN');
});

// --- OFF ---

test('OFF persists across reopen and blocks admissions', () => {
  const { ledger, path } = freshLedger();
  ledger.setOff({ reason: 'operator stop' });
  assert.equal(ledger.status().off, true);
  const batch = batchEnv('DOT-EVT-BO1', 'off');
  assert.throws(() => ledger.ingest(batch), (e) => e.code === 'OFF');
  assert.throws(() => ledger.claimExecution({ solutionId: 'x', sessionId: '66666666-6666-4666-8666-666666666666' }), (e) => e.code === 'OFF');
  ledger.close();
  const reopened = openLedger(path, { now });
  assert.equal(reopened.status().off, true);
  reopened.close();
});

// --- plan ---

test('plan writes bounded metadata-only bridge plan (paths/digests, no payload bytes)', () => {
  const { ledger, dir } = freshLedger();
  const { delivery } = readyDelivery(ledger);
  const plan = ledger.plan({ plansDir: join(dir, 'plans') });
  const text = readFileSync(join(dir, 'plans', 'bridge-plan.json'), 'utf8');
  const parsed = JSON.parse(text);
  assert.ok(Buffer.byteLength(text) <= 32 * 1024);
  assert.deepEqual(parsed.delivery_ids, plan.delivery_ids);
  assert.ok(text.includes(delivery.delivery_id));
  assert.ok(!text.includes('body ')); // no report bodies
  assert.ok(!JSON.stringify(plan).includes('synthetic report body'));
  assert.equal(parsed.deployment_mode, 'HYBRID');
});

// --- manifests / cursors / snapshots / index ---

function indexPage({ producer = CHAT_IDS.collector, generation = 'COLLECTOR-INDEX-0001', pageNumber = 0, items, next = null }) {
  return { version: 1, producer, generation, page_number: pageNumber, items, next };
}

test('manifest-import persists provenance; duplicate replays; changed digest conflicts', () => {
  const { ledger } = freshLedger();
  const batch = batchEnv('DOT-EVT-BM1', 'mf');
  const manifest = publicManifest(batch);
  const r1 = ledger.manifestImport({ manifest, producerRole: 'collector', cursorToken: 'b80b6957-cf4d-434a-9581-33008606603b:5' });
  assert.equal(r1.state, 'REGISTERED');
  const stored = ledger.getManifest(batch.id);
  assert.equal(stored.artifact_sha256, manifest.sha256);
  assert.equal(stored.source_page_id, manifest.artifact.page_id);
  // duplicate identical metadata replays
  const r2 = ledger.manifestImport({ manifest, producerRole: 'collector', cursorToken: 'b80b6957-cf4d-434a-9581-33008606603b:5' });
  assert.equal(r2.replay, true);
  // changed digest for same event id conflicts
  const mutated = { ...manifest, sha256: sha256Of('changed') };
  assert.throws(() => ledger.manifestImport({ manifest: mutated, producerRole: 'collector', cursorToken: 't' }), (e) => e.code === 'CONFLICT');
});

test('snapshot-import records final bundle ACKs + manifests atomically; replay cannot duplicate work', () => {
  const { ledger } = freshLedger();
  const batch = batchEnv('DOT-EVT-BS1', 'sn');
  // The bundle is the ANALYST's snapshot (R04: an ACK's trusted role must be
  // the delivery destination): its outgoing manifest for an analysis + its
  // incoming ACK of the earlier collector->analyst delivery.
  const earlier = batchEnv('DOT-EVT-BS0', 'sn0');
  withManifest(ledger, earlier);
  ledger.ingest(earlier);
  const d = ledger.pendingDeliveries()[0];
  ledger.claimDelivery(d.delivery_id);
  const analysis = analysisEnv('DOT-EVT-BS1-A', earlier, {
    candidates: [{ candidate_id: 'C1', finding_keys: ['F'], report_keys: [reportKey(earlier.payload.reports[0])], reviewed_sha: earlier.payload.reports[0].reviewed_sha, summary: 's' }],
  });
  const am = publicManifest(analysis, { destination: CHAT_IDS.solver });
  const ack = ackPayload(d.delivery_id, earlier, publicManifest(earlier).sha256);

  const bundle = {
    version: 1,
    status: 'READY',
    acks: [ack],
    manifests: [am],
  };
  const r = ledger.snapshotImport({ bundle, producerRole: 'analyst', cursorToken: 'tok-sn' });
  assert.equal(r.acks_imported, 1);
  assert.equal(r.manifests_registered, 1);
  assert.equal(ledger.getOutbox(d.delivery_id).state, 'ACKED'); // bundle retained the incoming ACK

  // replay of the complete bundle duplicates nothing
  const r2 = ledger.snapshotImport({ bundle, producerRole: 'analyst', cursorToken: 'tok-sn' });
  assert.equal(r2.replay, true);
  assert.equal(ledger.status().counts.outbox_total, 1);
  ledger.ingest(batch);
  assert.equal(ledger.status().counts.outbox_total, 2); // exactly one new route for the new batch
});

test('receipt-import recovers ACKs durably without history reads (idempotent)', () => {
  const { ledger } = freshLedger();
  const batch = batchEnv('DOT-EVT-BR2', 'ri');
  ledger.manifestImport({ manifest: publicManifest(batch), producerRole: 'collector', cursorToken: 'tok-ri' });
  ledger.ingest(batch);
  const d = ledger.pendingDeliveries()[0];
  ledger.claimDelivery(d.delivery_id);
  const ack = ackPayload(d.delivery_id, batch, publicManifest(batch).sha256);
  // R04: the destination (analyst) role owns the ACK for this delivery
  const r1 = ledger.receiptImport({ receipt: { version: 1, acks: [ack] }, producerRole: 'analyst' });
  assert.equal(r1.acks_imported, 1);
  const r2 = ledger.receiptImport({ receipt: { version: 1, acks: [ack] }, producerRole: 'analyst' });
  assert.equal(r2.replay, true);
  assert.equal(ledger.getOutbox(d.delivery_id).state, 'ACKED');
});

test('index-import: durable page identity — replay no-op after advance, digest conflict quarantines the generation', () => {
  const { ledger } = freshLedger();
  const batch = batchEnv('DOT-EVT-BI1', 'ix');
  const manifest = publicManifest(batch);
  const cursor = 'cur-tool-receipt-1';
  const page0 = indexPage({ items: [{ type: 'manifest', manifest }], next: { page_id: 'p1', reference: 'r1', sha256: sha256Of('p1'), bytes: 10 } });
  const r = ledger.indexImport({ index: page0, producerRole: 'collector', cursor, expectedIndexSha256: canonicalSha(page0) });
  assert.equal(r.pages_imported, 1);
  assert.equal(r.next_page_number, 1);
  assert.equal(r.complete, false);

  // R03: replaying an already-committed page with the SAME digest is a no-op
  // even though the continuation has advanced past it
  const replay = ledger.indexImport({ index: page0, producerRole: 'collector', cursor, expectedIndexSha256: canonicalSha(page0) });
  assert.equal(replay.replay, true);
  assert.equal(replay.pages_imported, 0);

  // wrong producer identity rejected
  const badProducer = indexPage({ producer: CHAT_IDS.analyst, items: [] });
  assert.throws(() => ledger.indexImport({ index: badProducer, producerRole: 'collector', cursor, expectedIndexSha256: sha256Of('x') }), (e) => e.code === 'INVALID');
  // out-of-order page rejected
  const page2 = indexPage({ pageNumber: 2, items: [] });
  assert.throws(() => ledger.indexImport({ index: page2, producerRole: 'collector', cursor, expectedIndexSha256: sha256Of('x') }), (e) => e.code === 'INVALID');
  // hash mismatch rejected
  assert.throws(() => ledger.indexImport({ index: page0, producerRole: 'collector', cursor, expectedIndexSha256: sha256Of('wrong') }), (e) => e.code === 'INVALID');

  // terminal page closes the chain; the trusted tool cursor commits atomically
  const page1 = indexPage({ pageNumber: 1, items: [], next: null });
  const r2 = ledger.indexImport({ index: page1, producerRole: 'collector', cursor, expectedIndexSha256: canonicalSha(page1) });
  assert.equal(r2.complete, true);
  assert.equal(ledger.plan().committed_cursors.collector, cursor);
  // cursor does not advance while the chain is still open (checked above: only after page1)
  // same identity, DIFFERENT digest -> quarantine, never overwrite
  const gen2conflict = indexPage({ generation: 'COLLECTOR-INDEX-0002', items: [{ type: 'manifest', manifest }], next: null });
  ledger.indexImport({ index: gen2conflict, producerRole: 'collector', cursor: 'cur-2', expectedIndexSha256: canonicalSha(gen2conflict) });
  const gen2mutated = indexPage({ generation: 'COLLECTOR-INDEX-0002', items: [], next: null });
  assert.throws(() => ledger.indexImport({ index: gen2mutated, producerRole: 'collector', cursor: 'cur-2', expectedIndexSha256: canonicalSha(gen2mutated) }), (e) => e.code === 'INDEX_CONFLICT');
  // quarantined generation keeps holding: further pages of it are refused and it never appears as a continuation
  const gen2page1 = indexPage({ generation: 'COLLECTOR-INDEX-0002', pageNumber: 1, items: [], next: null });
  assert.throws(() => ledger.indexImport({ index: gen2page1, producerRole: 'collector', cursor: 'cur-2', expectedIndexSha256: canonicalSha(gen2page1) }), (e) => e.code === 'INDEX_CONFLICT');
  assert.ok(ledger.plan().index_continuations.every((c) => c.generation !== 'COLLECTOR-INDEX-0002'));
});

test('index-import: in-progress continuations exposed by plan, oldest generation first; later generations preserved', () => {
  const { ledger } = freshLedger();
  const nextA = { page_id: 'pa1', reference: 'ra1', sha256: sha256Of('pa1'), bytes: 10 };
  const pageA0 = indexPage({ generation: 'COLLECTOR-INDEX-000A', items: [], next: nextA });
  ledger.indexImport({ index: pageA0, producerRole: 'collector', cursor: 'cur-A', expectedIndexSha256: canonicalSha(pageA0) });
  const nextB = { page_id: 'pb1', reference: 'rb1', sha256: sha256Of('pb1'), bytes: 11 };
  const pageB0 = indexPage({ generation: 'COLLECTOR-INDEX-000B', items: [], next: nextB });
  ledger.indexImport({ index: pageB0, producerRole: 'collector', cursor: 'cur-B', expectedIndexSha256: canonicalSha(pageB0) });
  const conts = ledger.plan().index_continuations;
  assert.deepEqual(conts.map((c) => c.generation), ['COLLECTOR-INDEX-000A', 'COLLECTOR-INDEX-000B']); // oldest first
  assert.deepEqual(conts[0].next_descriptor, nextA); // exact stored descriptor
  assert.equal(conts[0].snapshot_cursor, 'cur-A');
  // completing A leaves B in progress — unfinished generations are never replaced
  const pageA1 = indexPage({ generation: 'COLLECTOR-INDEX-000A', pageNumber: 1, items: [], next: null });
  ledger.indexImport({ index: pageA1, producerRole: 'collector', cursor: 'cur-A', expectedIndexSha256: canonicalSha(pageA1) });
  const conts2 = ledger.plan().index_continuations;
  assert.deepEqual(conts2.map((c) => c.generation), ['COLLECTOR-INDEX-000B']);
});

test('imported receipts: per-page DOT_RELAY_IMPORTED outbox with exact item identities; claim/outcome guarantees mirror deliveries', () => {
  const { ledger } = freshLedger();
  const batch = batchEnv('DOT-EVT-BR3', 'rc');
  const manifest = publicManifest(batch);
  const page0 = indexPage({ generation: 'COLLECTOR-INDEX-000R', items: [{ type: 'manifest', manifest }], next: null });
  const pageSha = canonicalSha(page0);
  ledger.indexImport({ index: page0, producerRole: 'collector', cursor: 'cur-R', expectedIndexSha256: pageSha });
  const pending = ledger.plan().pending_receipts;
  assert.equal(pending.length, 1);
  assert.equal(pending[0].destination, CHAT_IDS.collector);
  // replaying the identical page must not create a second receipt row
  ledger.indexImport({ index: page0, producerRole: 'collector', cursor: 'cur-R', expectedIndexSha256: pageSha });
  assert.equal(ledger.plan().pending_receipts.length, 1);

  const claim = ledger.claimReceipt(pending[0].receipt_id);
  assert.equal(claim.state, 'CLAIMED');
  assert.equal(claim.destination, CHAT_IDS.collector);
  assert.ok(claim.prompt.startsWith('DOT_RELAY_IMPORTED '));
  const payload = JSON.parse(claim.prompt.slice('DOT_RELAY_IMPORTED '.length));
  assert.equal(payload.version, 1);
  assert.equal(payload.producer, CHAT_IDS.coordinator);
  assert.equal(payload.generation, 'COLLECTOR-INDEX-000R');
  assert.equal(payload.page_number, 0);
  assert.equal(payload.source_sha256, pageSha);
  assert.deepEqual(payload.items, [{ type: 'manifest', event_id: batch.id, sha256: canonicalSha(manifest) }]); // original manifest whole-file digest

  // re-claim of a CLAIMED receipt is a state error (same token/owner rule as deliveries)
  assert.throws(() => ledger.claimReceipt(pending[0].receipt_id), (e) => e.code === 'RECEIPT_STATE');
  const out = ledger.receiptOutcome(pending[0].receipt_id, { status: 'sent' });
  assert.equal(out.state, 'SENT_ACCEPTED');
  assert.equal(ledger.plan().pending_receipts.length, 0);

  // UNCERTAIN outcome is never blindly resent
  const { ledger: l2 } = freshLedger();
  const pageU = indexPage({ generation: 'ANALYST-INDEX-000U', producer: CHAT_IDS.analyst, items: [], next: null });
  l2.indexImport({ index: pageU, producerRole: 'analyst', cursor: 'cur-U', expectedIndexSha256: canonicalSha(pageU) });
  const pu = l2.plan().pending_receipts[0];
  l2.claimReceipt(pu.receipt_id);
  const outU = l2.receiptOutcome(pu.receipt_id, { status: 'uncertain' });
  assert.equal(outU.state, 'UNCERTAIN');
  assert.equal(l2.plan().pending_receipts.length, 0); // not re-offered
  assert.throws(() => l2.claimReceipt(pu.receipt_id), (e) => e.code === 'RECEIPT_STATE');
});

test('plan lists unconsumed manifests; oversize single artifact plans BLOCKED_OVERSIZE', () => {
  const { ledger, dir } = freshLedger();
  const batch = batchEnv('DOT-EVT-BP1', 'pl');
  const manifest = publicManifest(batch);
  ledger.manifestImport({ manifest, producerRole: 'collector', cursorToken: 'tok-pl' });
  const plan = ledger.plan({ plansDir: join(dir, 'plans') });
  assert.deepEqual(plan.manifests_to_fetch, [batch.id]);
  ledger.ingest(batch);
  const plan2 = ledger.plan({ plansDir: join(dir, 'plans') });
  assert.deepEqual(plan2.manifests_to_fetch, []);

  const huge = batchEnv('DOT-EVT-BP2', 'pl2');
  const hugeManifest = { ...publicManifest(huge), bytes: 2 * 1024 * 1024, sha256: 'f'.repeat(64) };
  ledger.manifestImport({ manifest: hugeManifest, producerRole: 'collector', cursorToken: 'tok-pl2' });
  const plan3 = ledger.plan({ plansDir: join(dir, 'plans') });
  assert.ok(plan3.blockers.some((b) => b.code === 'BLOCKED_OVERSIZE'));
});

test('multipart manifest retains ordered parts provenance in manifest_json', () => {
  const { ledger } = freshLedger();
  const batch = batchEnv('DOT-EVT-BM9', 'mp');
  const m = publicManifest(batch);
  // Coherent large-artifact descriptor: parts sum to the whole, each 1..200000.
  const whole = sha256Of('multipart-whole');
  m.sha256 = whole;
  m.bytes = 300000;
  m.artifact = {
    sha256: whole,
    bytes: 300000,
    parts: [
      { ordinal: 0, page_id: 'pg0', reference: 'r0', sha256: sha256Of('p0'), bytes: 200000 },
      { ordinal: 1, page_id: 'pg1', reference: 'r1', sha256: sha256Of('p1'), bytes: 100000 },
    ],
  };
  ledger.manifestImport({ manifest: m, producerRole: 'collector', cursorToken: 'tok-mp' });
  const stored = JSON.parse(ledger.getManifest(batch.id).manifest_json);
  assert.deepEqual(stored.artifact.parts.map((p) => p.ordinal), [0, 1]);
});

// --- Task 4 support: tick claim -> supervise handoff ---

// R04-corrected chain: manifests registered, both parent deliveries ACKED by
// their destination roles — the returned solution is genuinely QUEUED.
function solutionChain(ledger, id) {
  const batch = batchEnv(`DOT-EVT-TCB-${id}`, `tcb-${id}`);
  withManifest(ledger, batch);
  ledger.ingest(batch);
  const cand = { candidate_id: 'C1', finding_keys: ['F'], report_keys: [reportKey(batch.payload.reports[0])], reviewed_sha: batch.payload.reports[0].reviewed_sha, summary: 's' };
  const analysis = analysisEnv(`DOT-EVT-TCA-${id}`, batch, { candidates: [cand] });
  ledger.ingest(analysis);
  const db = ledger.pendingDeliveries()[0];
  ledger.claimDelivery(db.delivery_id);
  ledger.ack(ackPayload(db.delivery_id, batch, publicManifest(batch).sha256), { trustedProducerRole: 'analyst' });
  withManifest(ledger, analysis, 'analyst');
  const solution = solutionEnv(`DOT-EVT-TCS-${id}`, analysis);
  solution.payload.candidate_id = 'C1';
  solution.payload.finding_keys = ['F'];
  solution.payload.reviewed_sha = cand.reviewed_sha;
  seal(solution);
  ledger.ingest(solution);
  const da = ledger.pendingDeliveries().find((x) => x.destination === CHAT_IDS.solver);
  ledger.claimDelivery(da.delivery_id);
  ledger.ack(ackPayload(da.delivery_id, analysis, publicManifest(analysis, { destination: CHAT_IDS.solver }).sha256), { trustedProducerRole: 'solver' });
  return solution;
}

test('nextClaimableSolution: first QUEUED never-attempted solution in creation order', () => {
  const { ledger } = freshLedger();
  assert.equal(ledger.nextClaimableSolution(), null);
  const s1 = solutionChain(ledger, '1');
  const s2 = solutionChain(ledger, '2');
  const next = ledger.nextClaimableSolution();
  assert.equal(next.id, s1.id);
  assert.equal(next.kind, 'solution');
  // once s1 has ANY execution row (one attempt per solution, ever), s2 is next
  ledger.claimExecution({ solutionId: s1.id, sessionId: '77777777-7777-4777-8777-777777777777' });
  assert.equal(ledger.nextClaimableSolution().id, s2.id);
});

test('openLedger never rewrites execution state: supervise/plain opens both keep the row untouched', () => {
  const { ledger, path } = freshLedger();
  const s1 = solutionChain(ledger, '3');
  const claim = ledger.claimExecution({ solutionId: s1.id, sessionId: '88888888-8888-4888-8888-888888888888' });
  ledger.close();
  // HOST-RESILIENCE §2 removed the blanket openLedger reconciliation: both the
  // supervise child's open and any other process's open are read-only.
  const sup = openLedger(path, { now });
  assert.equal(sup.getExecution(claim.execution_id).state, 'RESERVED');
  sup.close();
  const plain = openLedger(path, { now });
  assert.equal(plain.getExecution(claim.execution_id).state, 'RESERVED');
  plain.close();
});

test('durable OFF refuses manifest/snapshot/index imports (admissions blocked)', () => {
  const { ledger } = freshLedger();
  ledger.setOff({ reason: 'operator stop' });
  const batch = batchEnv('DOT-EVT-BO2', 'off2');
  const manifest = publicManifest(batch);
  assert.throws(
    () => ledger.manifestImport({ manifest, producerRole: 'collector', cursorToken: 'tok-bo' }),
    (e) => e.code === 'OFF',
  );
  assert.throws(
    () => ledger.snapshotImport({ bundle: { version: 1, status: 'READY', acks: [], manifests: [manifest] }, producerRole: 'collector', cursorToken: 'tok-bo' }),
    (e) => e.code === 'OFF',
  );
  assert.throws(
    () => ledger.indexImport({ index: indexPage({ items: [] }), producerRole: 'collector', cursorToken: 'tok-bo', expectedIndexSha256: sha256Of('x') }),
    (e) => e.code === 'OFF',
  );
});

// ---------------------------------------------------------------- busy retry

// A concurrent writer holding the ledger write lock longer than ONE
// busy_timeout must not crash the process (observed as a tick flake: uncaught
// "database is locked" at the open-path BEGIN IMMEDIATE, empty stdout, exit 1).
// Desired: BEGIN IMMEDIATE/COMMIT retry on busy up to a bounded TOTAL budget
// (default attempts x busy_timeout), surviving transient holders. The holder
// runs in a real worker thread — the main thread blocks synchronously inside
// the retry loop, so a same-thread timer could never release it.
import { Worker } from 'node:worker_threads';

function holdLockWorker(path, ms) {
  const w = new Worker(
    `const { workerData, parentPort } = require('node:worker_threads');
     const { DatabaseSync } = require('node:sqlite');
     const db = new DatabaseSync(workerData.path);
     db.exec('PRAGMA busy_timeout = 5000;');
     db.exec('BEGIN IMMEDIATE;');
     parentPort.postMessage('HELD');
     setTimeout(() => { db.exec('COMMIT;'); db.close(); process.exit(0); }, workerData.ms);`,
    { eval: true, workerData: { path, ms } },
  );
  const held = new Promise((res, rej) => {
    w.once('message', (m) => { if (m === 'HELD') res(); });
    w.once('error', rej);
  });
  const exited = new Promise((res) => w.on('exit', res));
  return { w, held, exited };
}

test('openLedger survives a write-lock holder outlasting one busy_timeout (bounded retry)', async () => {
  const { ledger, path, dir } = freshLedger();
  ledger.close();
  // 6.5s hold: longer than the 5s single busy_timeout, shorter than the
  // retry budget (default 6 attempts x 5s). Current single-attempt code
  // throws "database is locked" here — the observed tick flake.
  const holder = holdLockWorker(path, 6500);
  await holder.held; // contention must be REAL before the blocking call
  const l2 = openLedger(path, { now });
  try {
    assert.equal(l2.status().deployment_mode, 'HYBRID');
  } finally {
    l2.close();
    await holder.exited;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('api transactions retry on busy: a write succeeds after the contending holder commits', async () => {
  const { ledger, path, dir } = freshLedger();
  const holder = holdLockWorker(path, 6500);
  await holder.held;
  ledger.setOff({ reason: 'contended window requires bounded retry' });
  assert.equal(ledger.status().off, true);
  ledger.close();
  await holder.exited;
  rmSync(dir, { recursive: true, force: true });
});

// ------------------------------------------- HOST-RESILIENCE addendum (ledger)
//
// §2 explicit reconcileHost (no blanket openLedger reconciliation), §4 slot
// states, precharged attempt ledger (3 x 2h reserve-before-spawn), §1 calendar
// scheduler metadata with ONE bounded catch-up, plus the reviewer's baseline
// fall-through fix (old batch with partial coverage must never become READY).

const SUP_START = 'Mon Oct  6 09:00:00 2026';
const CHILD_START = 'Mon Oct  6 09:01:00 2026';

function claimedExecution(ledger, { bootId = 'BOOT-1', supervisor = { pid: 501, start: SUP_START }, sessionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } = {}) {
  const solution = solutionChain(ledger, Math.random().toString(36).slice(2, 8));
  const claim = ledger.claimExecution({ solutionId: solution.id, sessionId, bootId, supervisor });
  return { solution, claim };
}

function bootProbe(map) {
  // processProbe(pid) over a fixed census: {pid: {alive, start}}
  return (pid) => map.get(Number(pid)) ?? { alive: false, start: null };
}

test('claimExecution reserves the FIRST precharged attempt in the same transaction (reserve-before-spawn)', () => {
  const { ledger } = freshLedger();
  const { claim } = claimedExecution(ledger);
  const row = ledger.getExecution(claim.execution_id);
  assert.equal(row.attempts_admitted, 1);
  assert.equal(row.authorized_attempts, 3);
  assert.equal(row.charged_reservation_ms, 7_200_000);
  assert.equal(row.reserved_total_ms, 21_600_000);
  const attempt = ledger.getAttempt(claim.execution_id, 1);
  assert.equal(attempt.state, 'RESERVED');
  assert.equal(attempt.boot_id, 'BOOT-1');
  assert.equal(attempt.supervisor_pid, 501);
  assert.equal(attempt.supervisor_start, SUP_START);
  assert.equal(attempt.reserved_ms, 7_200_000);
  assert.equal(attempt.session_id, claim.session_id);
});

test('reconcileHost: same boot + live supervisor retains RUNNING exactly; second status/open never mutates', () => {
  const { ledger, path } = freshLedger();
  const { claim } = claimedExecution(ledger);
  ledger.updateExecution(claim.execution_id, {
    state: 'RUNNING', pid: 601, process_start: CHILD_START, worktree: '/tmp/wt-a',
  });
  ledger.updateAttempt(claim.execution_id, 1, { state: 'RUNNING', child_pid: 601, child_start: CHILD_START });
  // HOST-RESILIENCE §5.4: a second ledger/status while the supervisor is live
  // must leave state RUNNING and outbox CLAIMED unchanged.
  const before = JSON.stringify(ledger.status());
  const other = openLedger(path, { now });
  assert.equal(JSON.stringify(other.status()), before);
  const r = other.reconcileHost({
    bootId: 'BOOT-1',
    processProbe: bootProbe(new Map([[501, { alive: true, start: SUP_START }], [601, { alive: true, start: CHILD_START }]])),
    controlActor: 'scheduler-tick',
  });
  assert.deepEqual(r.executions.map((e) => e.decision), ['retain']);
  assert.equal(other.getExecution(claim.execution_id).state, 'RUNNING');
  other.close();
});

test('reconcileHost: same boot, supervisor dead, exact child alive -> adopt-monitor (no spawn, slot retained)', () => {
  const { ledger } = freshLedger();
  const { claim } = claimedExecution(ledger);
  ledger.updateExecution(claim.execution_id, { state: 'RUNNING', pid: 601, process_start: CHILD_START });
  ledger.updateAttempt(claim.execution_id, 1, { state: 'RUNNING', child_pid: 601, child_start: CHILD_START });
  const r = ledger.reconcileHost({
    bootId: 'BOOT-1',
    processProbe: bootProbe(new Map([[601, { alive: true, start: CHILD_START }]])), // supervisor 501 absent
    sessionProbe: () => [{ session_id: claim.session_id, pid: 601 }],
    controlActor: 'scheduler-tick',
  });
  assert.deepEqual(r.executions.map((e) => e.decision), ['adopt-monitor']);
  const row = ledger.getExecution(claim.execution_id);
  assert.equal(row.state, 'RECOVERING_HOST'); // in the active slot index
  assert.equal(row.session_id, claim.session_id); // SAME session, never a second GLM
});

test('reconcileHost: missing/inconsistent identity -> UNCERTAIN reason UNCERTAIN_IDENTITY, slot retained, no signal decision', () => {
  const { ledger } = freshLedger();
  const { claim } = claimedExecution(ledger);
  ledger.updateExecution(claim.execution_id, { state: 'RUNNING', pid: 601, process_start: null }); // start never recorded
  const r = ledger.reconcileHost({
    bootId: 'BOOT-1',
    processProbe: bootProbe(new Map([[601, { alive: true, start: 'forged' }]])), // PID alive but identity unproven
    controlActor: 'scheduler-tick',
  });
  assert.deepEqual(r.executions.map((e) => e.decision), ['uncertain-identity']);
  const row = ledger.getExecution(claim.execution_id);
  assert.equal(row.state, 'UNCERTAIN');
  assert.equal(row.reason, 'UNCERTAIN_IDENTITY');
});

test('reconcileHost: new boot marks INTERRUPTED_HOST preserving ids; reused PID/start text is never signaled', () => {
  const { ledger } = freshLedger();
  const { claim } = claimedExecution(ledger);
  ledger.updateExecution(claim.execution_id, { state: 'RUNNING', pid: 601, process_start: CHILD_START });
  ledger.updateAttempt(claim.execution_id, 1, { state: 'RUNNING', child_pid: 601, child_start: CHILD_START, last_active_ns: '45000000000' });
  // HOST-RESILIENCE §5.5: the new boot reuses the SAME pid AND the same-looking
  // start text — a previous-boot OS process cannot exist; identity is the boot.
  const r = ledger.reconcileHost({
    bootId: 'BOOT-2',
    processProbe: bootProbe(new Map([[601, { alive: true, start: CHILD_START }]])),
    sessionProbe: () => [],
    controlActor: 'scheduler-tick',
  });
  assert.deepEqual(r.executions.map((e) => e.decision), ['interrupted-host']);
  const row = ledger.getExecution(claim.execution_id);
  assert.equal(row.state, 'INTERRUPTED_HOST');
  assert.equal(row.session_id, claim.session_id); // ids preserved for SAME-session resume
  assert.equal(row.solution_id, claim.solution_id);
  const attempt = ledger.getAttempt(claim.execution_id, 1);
  assert.equal(attempt.state, 'INTERRUPTED_HOST');
  assert.equal(attempt.actual_elapsed_proven, 0); // unmeasured cutoff: UNKNOWN, never invented
  assert.equal(attempt.measured_active_used_ms, 45_000); // last proven lower bound
  assert.equal(row.charged_reservation_ms, 7_200_000); // full reservation stays charged
});

test('reconcileHost: CLAIMED send interrupted across reboot -> UNCERTAIN; older ACKED result never reexecutes', () => {
  const { ledger } = freshLedger();
  const { delivery } = readyDelivery(ledger);
  const claim = ledger.claimDelivery(delivery.delivery_id, { sender: { boot_id: 'BOOT-1', pid: 111, start: 'Mon Oct  6 08:00:00 2026' } });
  const r = ledger.reconcileHost({
    bootId: 'BOOT-9',
    processProbe: () => ({ alive: false, start: null }),
    controlActor: 'scheduler-tick',
  });
  assert.equal(r.deliveries_uncertain, 1);
  assert.equal(ledger.getOutbox(delivery.delivery_id).state, 'UNCERTAIN'); // never resent blindly
  nowMs += 48 * 3600 * 1000;
  assert.equal(ledger.pendingDeliveries().length, 0); // zero resend until a matching ACK
  // a matching destination ACK settles it
  const ev = ledger.getEvent(delivery.event_id);
  ledger.ack(ackPayload(delivery.delivery_id, { id: ev.id, sha256: ev.sha256 }, claim.artifact_sha256));
  assert.equal(ledger.getOutbox(delivery.delivery_id).state, 'ACKED');
});

test('reconcileHost: same boot, supervisor AND child dead -> UNCERTAIN reason UNCERTAIN_STOP (never READY, never signaled)', () => {
  const { ledger } = freshLedger();
  const { claim } = claimedExecution(ledger);
  ledger.updateExecution(claim.execution_id, { state: 'RUNNING', pid: 601, process_start: CHILD_START });
  ledger.updateAttempt(claim.execution_id, 1, { state: 'RUNNING', child_pid: 601, child_start: CHILD_START });
  const r = ledger.reconcileHost({
    bootId: 'BOOT-1',
    processProbe: () => ({ alive: false, start: null }),
    controlActor: 'scheduler-tick',
  });
  assert.deepEqual(r.executions.map((e) => e.decision), ['uncertain-stop']);
  const row = ledger.getExecution(claim.execution_id);
  assert.equal(row.state, 'UNCERTAIN');
  assert.equal(row.reason, 'UNCERTAIN_STOP');
});

test('INTERRUPTED_HOST / RECOVERING_HOST / RESUMING_HOST hold the active slot in every active-selection surface', () => {
  const { ledger } = freshLedger();
  const { claim } = claimedExecution(ledger);
  for (const state of ['INTERRUPTED_HOST', 'RECOVERING_HOST', 'RESUMING_HOST']) {
    ledger.updateExecution(claim.execution_id, { state, reason: null });
    const s2 = solutionChain(ledger, `slot-${state}`);
    const c2 = ledger.claimExecution({ solutionId: s2.id, sessionId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' });
    assert.equal(c2.claimed, false, state);
    assert.equal(ledger.status().execution.state, state); // status active-selection sees it
    assert.equal(ledger.plan().execution.state, state); // plan active-selection sees it
  }
});

// ------------------------------------------------ precharged attempt ledger

test('abrupt power loss: next boot admits attempt 2 automatically, resumes SAME execution/session once; attempt 4 is RECOVERY_ALLOWANCE_EXHAUSTED', () => {
  const { ledger } = freshLedger();
  const { claim } = claimedExecution(ledger);
  ledger.reconcileHost({ bootId: 'BOOT-2', processProbe: () => ({ alive: false, start: null }), controlActor: 'scheduler-tick' });

  const a2 = ledger.admitNextAttempt({
    executionId: claim.execution_id, bootId: 'BOOT-2',
    supervisor: { pid: 701, start: 'Tue Oct  7 09:00:00 2026' },
    sessionId: claim.session_id, purpose: 'resume',
  });
  assert.equal(a2.admitted, true);
  assert.equal(a2.attempt_number, 2);
  assert.equal(a2.reserved_ms, 7_200_000);
  const row = ledger.getExecution(claim.execution_id);
  assert.equal(row.attempts_admitted, 2);
  assert.equal(row.charged_reservation_ms, 14_400_000);
  assert.equal(row.resumptions, 1);
  assert.equal(row.last_resume_boot, 'BOOT-2');
  assert.equal(row.state, 'RESUMING_HOST');
  assert.equal(row.session_id, claim.session_id); // SAME ids — no second solution/execution

  // same boot again: max 1 automatic resume per execution per boot
  ledger.updateAttempt(claim.execution_id, 2, { state: 'INTERRUPTED_HOST' });
  ledger.updateExecution(claim.execution_id, { state: 'INTERRUPTED_HOST' });
  const again = ledger.admitNextAttempt({
    executionId: claim.execution_id, bootId: 'BOOT-2',
    supervisor: { pid: 702, start: 'x' }, sessionId: claim.session_id, purpose: 'resume',
  });
  assert.equal(again.admitted, false);
  assert.equal(again.code, 'RESUME_CAP_PER_BOOT');

  // third boot: attempt 3 admitted; a fourth is denied
  const a3 = ledger.admitNextAttempt({
    executionId: claim.execution_id, bootId: 'BOOT-3',
    supervisor: { pid: 801, start: 'y' }, sessionId: claim.session_id, purpose: 'resume',
  });
  assert.equal(a3.attempt_number, 3);
  ledger.updateAttempt(claim.execution_id, 3, { state: 'INTERRUPTED_HOST' });
  ledger.updateExecution(claim.execution_id, { state: 'INTERRUPTED_HOST' });
  const a4 = ledger.admitNextAttempt({
    executionId: claim.execution_id, bootId: 'BOOT-4',
    supervisor: { pid: 901, start: 'z' }, sessionId: claim.session_id, purpose: 'resume',
  });
  assert.equal(a4.admitted, false);
  assert.equal(a4.code, 'RECOVERY_ALLOWANCE_EXHAUSTED');
  assert.equal(ledger.getExecution(claim.execution_id).attempts_admitted, 3); // no clone evasion
});

test('two concurrent recovery admissions prove exactly one next attempt (no refund on crash)', async () => {
  const { ledger, path, dir } = freshLedger();
  const { claim } = claimedExecution(ledger);
  ledger.reconcileHost({ bootId: 'BOOT-2', processProbe: () => ({ alive: false, start: null }), controlActor: 'scheduler-tick' });
  ledger.close();
  const a = openLedger(path, { now });
  const b = openLedger(path, { now });
  const run = (l, pid) => l.admitNextAttempt({
    executionId: claim.execution_id, bootId: 'BOOT-2',
    supervisor: { pid, start: 's' }, sessionId: claim.session_id, purpose: 'resume',
  });
  const [r1, r2] = [run(a, 701), run(b, 702)];
  const admitted = [r1, r2].filter((r) => r.admitted);
  assert.equal(admitted.length, 1);
  const row = a.getExecution(claim.execution_id);
  assert.equal(row.attempts_admitted, 2); // BEGIN IMMEDIATE serializes: charged once
  assert.equal(row.charged_reservation_ms, 14_400_000);
  a.close();
  b.close();
  rmSync(dir, { recursive: true, force: true });
});

test('UNCERTAIN reasons (CLOCK_UNPROVEN etc.) hold the slot and block a second reservation across restart and connections', () => {
  const { ledger, path } = freshLedger();
  const { claim } = claimedExecution(ledger);
  for (const reason of ['CLOCK_UNPROVEN', 'BUDGET_UNPROVEN', 'UNCERTAIN_IDENTITY', 'UNCERTAIN_RESUME_IDENTITY', 'UNCERTAIN_STOP']) {
    ledger.updateExecution(claim.execution_id, { state: 'UNCERTAIN', reason });
    // a NEW solution cannot take the slot while UNCERTAIN holds it
    const s2 = solutionChain(ledger, `u-${reason}`);
    const c2 = ledger.claimExecution({ solutionId: s2.id, sessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' });
    assert.equal(c2.claimed, false, reason);
    // and no second reservation for the held execution itself
    const again = ledger.admitNextAttempt({
      executionId: claim.execution_id, bootId: 'BOOT-1',
      supervisor: { pid: 1, start: 's' }, sessionId: claim.session_id, purpose: 'resume',
    });
    assert.equal(again.admitted, false, reason);
    assert.equal(again.code, 'ATTEMPT_IN_PROGRESS');
  }
  ledger.close();
  const reopened = openLedger(path, { now });
  assert.equal(reopened.getExecution(claim.execution_id).state, 'UNCERTAIN'); // persists
  reopened.close();
});

test('consecutive concrete resume failures: 2 -> BLOCKED_RECOVERY (sleep is never a failure)', () => {
  const { ledger } = freshLedger();
  const { claim } = claimedExecution(ledger);
  ledger.reconcileHost({ bootId: 'BOOT-2', processProbe: () => ({ alive: false, start: null }), controlActor: 'scheduler-tick' });
  ledger.recordResumeFailure(claim.execution_id); // boot 2 resume attempt 2 failed concretely
  ledger.reconcileHost({ bootId: 'BOOT-3', processProbe: () => ({ alive: false, start: null }), controlActor: 'scheduler-tick' });
  const a3 = ledger.admitNextAttempt({
    executionId: claim.execution_id, bootId: 'BOOT-3',
    supervisor: { pid: 1, start: 's' }, sessionId: claim.session_id, purpose: 'resume',
  });
  assert.equal(a3.admitted, true);
  ledger.recordResumeFailure(claim.execution_id); // second consecutive concrete failure
  ledger.reconcileHost({ bootId: 'BOOT-4', processProbe: () => ({ alive: false, start: null }), controlActor: 'scheduler-tick' });
  const a4 = ledger.admitNextAttempt({
    executionId: claim.execution_id, bootId: 'BOOT-4',
    supervisor: { pid: 1, start: 's' }, sessionId: claim.session_id, purpose: 'resume',
  });
  assert.equal(a4.admitted, false);
  assert.equal(a4.code, 'BLOCKED_RECOVERY');
  assert.equal(ledger.getExecution(claim.execution_id).state, 'BLOCKED_RECOVERY');
});

test('recordResumeSuccess clears the consecutive-failure counter; later failures still block at 2', () => {
  const { ledger } = freshLedger();
  const { claim } = claimedExecution(ledger);
  ledger.reconcileHost({ bootId: 'BOOT-2', processProbe: () => ({ alive: false, start: null }), controlActor: 'scheduler-tick' });
  ledger.recordResumeFailure(claim.execution_id);
  assert.equal(ledger.getExecution(claim.execution_id).consecutive_resume_failures, 1);
  ledger.recordResumeSuccess(claim.execution_id); // VERIFIED progress clears the counter
  assert.equal(ledger.getExecution(claim.execution_id).consecutive_resume_failures, 0);
  ledger.reconcileHost({ bootId: 'BOOT-3', processProbe: () => ({ alive: false, start: null }), controlActor: 'scheduler-tick' });
  ledger.recordResumeFailure(claim.execution_id);
  ledger.recordResumeFailure(claim.execution_id);
  assert.equal(ledger.getExecution(claim.execution_id).state, 'BLOCKED_RECOVERY'); // two AFTER the success
});

// ------------------------------------------------ calendar scheduler metadata

test('scheduler tick bookkeeping: five missed 4h periods -> ONE bounded catch-up, next_due future, cursors untouched', () => {
  const { ledger } = freshLedger();
  const begin = ledger.beginSchedulerTick({ bootId: 'BOOT-1', token: 'slot-1000' });
  assert.equal(begin.due, true);
  ledger.completeSchedulerTick({ bootId: 'BOOT-1', token: 'slot-1000', plannedOk: true });
  let ctrl = ledger.schedulerControl();
  assert.equal(ctrl.catchup_pending, 0);
  assert.ok(ctrl.next_due_wall_ms > now());
  const due1 = ctrl.next_due_wall_ms;

  // duplicate delivery of the SAME logical tick (RunAtLoad + calendar coalesce)
  const dup = ledger.beginSchedulerTick({ bootId: 'BOOT-1', token: 'slot-1000' });
  assert.equal(dup.deduped, true);

  // five periods pass: only ONE bounded catch-up tick runs, not five
  nowMs = due1 + 5 * 4 * 3600 * 1000;
  const catchup = ledger.beginSchedulerTick({ bootId: 'BOOT-1', token: 'slot-late' });
  assert.equal(catchup.due, true);
  assert.equal(catchup.overdue_periods, 5); // observed, but still one bounded tick
  ledger.completeSchedulerTick({ bootId: 'BOOT-1', token: 'slot-late', plannedOk: true });
  ctrl = ledger.schedulerControl();
  assert.ok(ctrl.next_due_wall_ms > now());
  assert.equal(ctrl.catchup_pending, 0);

  // failed planning retains catchup_pending for the idempotent retry
  nowMs = ctrl.next_due_wall_ms + 1000;
  ledger.beginSchedulerTick({ bootId: 'BOOT-1', token: 'slot-fail' });
  ledger.completeSchedulerTick({ bootId: 'BOOT-1', token: 'slot-fail', plannedOk: false });
  assert.equal(ledger.schedulerControl().catchup_pending, 1);
  const retry = ledger.beginSchedulerTick({ bootId: 'BOOT-1', token: 'slot-retry' });
  assert.equal(retry.due, true);
  ledger.completeSchedulerTick({ bootId: 'BOOT-1', token: 'slot-retry', plannedOk: true });
  assert.equal(ledger.schedulerControl().catchup_pending, 0);

  // calendar elapsed NEVER advanced delivery/source cursors by itself
  // (only COMMITTED tokens appear; the seeded analyst cursor is still pending)
  assert.deepEqual(ledger.plan().committed_cursors, {});
});

test('durable OFF suppresses scheduler planning and survives reopen (login/reboot) until explicit resume', () => {
  const { ledger, path } = freshLedger();
  ledger.setOff({ reason: 'operator stop for maintenance' });
  const t = ledger.beginSchedulerTick({ bootId: 'BOOT-2', token: 'slot-after-reboot' });
  assert.equal(t.suppressed, 'off');
  ledger.completeSchedulerTick({ bootId: 'BOOT-2', token: 'slot-after-reboot', plannedOk: true });
  const ctrl = ledger.schedulerControl();
  assert.equal(ctrl.last_successful_tick_wall_ms, null); // no planning ran
  ledger.close();
  const reopened = openLedger(path, { now });
  assert.equal(reopened.status().off, true); // OFF persists across reopen
  reopened.clearOff({ actor: 'operator-explicit-resume' });
  assert.equal(reopened.status().off, false);
  reopened.close();
});

// ------------------------------------------------ v1 -> v2 -> v3 in-place migration

test('v1 ledger migrates through to v3 in place: precharged schema + review gate added, existing rows preserved, legacy rows never guessed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dot-ledger-v1-'));
  const path = join(dir, 'ledger.sqlite');
  // Build a genuine v1 database (pre HOST-RESILIENCE schema, user_version 1).
  const raw = new DatabaseSync(path);
  raw.exec(`
    CREATE TABLE events (id TEXT PRIMARY KEY, sha256 TEXT, kind TEXT NOT NULL, producer TEXT NOT NULL, parent_json TEXT NOT NULL, payload_json TEXT NOT NULL, state TEXT NOT NULL, reason TEXT, created_ms INTEGER NOT NULL);
    CREATE TABLE reports (report_key TEXT PRIMARY KEY, event_id TEXT NOT NULL, body_sha256 TEXT);
    CREATE TABLE outbox (delivery_id TEXT PRIMARY KEY, event_id TEXT NOT NULL, destination TEXT NOT NULL, state TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_ms INTEGER NOT NULL DEFAULT 0, receipt_json TEXT, created_ms INTEGER NOT NULL, UNIQUE(event_id, destination));
    CREATE TABLE executions (id TEXT PRIMARY KEY, solution_id TEXT NOT NULL UNIQUE, state TEXT NOT NULL, session_id TEXT UNIQUE, pid INTEGER, process_start TEXT, worktree TEXT, started_ms INTEGER, deadline_ms INTEGER, exit_code INTEGER, pr_url TEXT, head_sha TEXT, reason TEXT);
    CREATE UNIQUE INDEX idx_exec_active ON executions((1)) WHERE state IN ('RESERVED','RUNNING','UNCERTAIN','VERIFYING');
    CREATE TABLE control (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE audit (seq INTEGER PRIMARY KEY, event TEXT NOT NULL, ref TEXT, details_json TEXT, created_ms INTEGER NOT NULL);
    CREATE TABLE manifests (event_id TEXT PRIMARY KEY, producer_role TEXT NOT NULL, artifact_sha256 TEXT NOT NULL, artifact_bytes INTEGER NOT NULL, source_page_id TEXT, source_reference TEXT, manifest_json TEXT NOT NULL, fetched_ms INTEGER);
    CREATE TABLE cursors (producer_role TEXT PRIMARY KEY, committed_token TEXT, pending_token TEXT);
    CREATE TABLE snapshot_items (producer_role TEXT NOT NULL, token TEXT NOT NULL, item_id TEXT NOT NULL, state TEXT NOT NULL, PRIMARY KEY (producer_role, token, item_id));
    CREATE TABLE index_progress (producer_role TEXT NOT NULL, token TEXT NOT NULL, generation INTEGER NOT NULL, next_page_number INTEGER NOT NULL, next_descriptor_json TEXT, complete INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (producer_role, token));
    PRAGMA user_version = 1;
  `);
  raw.prepare("INSERT INTO executions (id, solution_id, state, session_id, started_ms, deadline_ms) VALUES ('DOT-EXEC-OLD','S-OLD','RESERVED','dddddddd-dddd-4ddd-8ddd-dddddddddddd',1,2)").run();
  raw.prepare("INSERT INTO outbox (delivery_id, event_id, destination, state, attempts, next_ms, created_ms) VALUES ('DOT-DELIV-OLD','E-OLD','dest','CLAIMED',0,0,1)").run();
  raw.close();

  const ledger = openLedger(path, { now });
  const check = new DatabaseSync(path);
  // R10: one open migrates v1 -> v2 (precharged attempts) -> v3 (review gate)
  assert.equal(check.prepare('PRAGMA user_version').get().user_version, 3);
  check.close();
  // Existing rows preserved, not rewritten by the migration itself.
  const row = ledger.getExecution('DOT-EXEC-OLD');
  assert.equal(row.state, 'RESERVED');
  assert.equal(row.authorized_attempts, 3); // additive defaults applied
  assert.equal(row.reserved_total_ms, 21_600_000);
  // The slot still holds: a new claim is refused.
  assert.equal(ledger.claimExecution({ solutionId: 'x', sessionId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' }).claimed, false);
  // Legacy row has NO attempt ledger -> no boot evidence -> reconcileHost
  // refuses to guess (uncertain-identity), the CLAIMED send stays claimable-
  // evidence: no sender identity recorded -> proven-dead path -> UNCERTAIN.
  const rec = ledger.reconcileHost({ bootId: 'BOOT-9', processProbe: () => ({ alive: false, start: null }), controlActor: 'scheduler-tick' });
  assert.deepEqual(rec.executions.map((e) => e.decision), ['uncertain-identity']);
  assert.equal(rec.deliveries_uncertain, 1);
  ledger.close();
  rmSync(dir, { recursive: true, force: true });
});

// ------------------------------------------------ R10: v2 -> v3 review-gate migration

test('v2 ledger migrates to v3 in place: REQUIRES_REVIEW joins the unique active index, worker_reports/review_receipts added, rows preserved', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dot-ledger-v2-'));
  const path = join(dir, 'ledger.sqlite');
  // Genuine v2 database: the v1 DDL plus the HOST-RESILIENCE v2 additions,
  // user_version 2 — exactly what a v2 checkout leaves behind.
  const raw = new DatabaseSync(path);
  raw.exec(`
    CREATE TABLE events (id TEXT PRIMARY KEY, sha256 TEXT, kind TEXT NOT NULL, producer TEXT NOT NULL, parent_json TEXT NOT NULL, payload_json TEXT NOT NULL, state TEXT NOT NULL, reason TEXT, created_ms INTEGER NOT NULL);
    CREATE TABLE reports (report_key TEXT PRIMARY KEY, event_id TEXT NOT NULL, body_sha256 TEXT);
    CREATE TABLE outbox (delivery_id TEXT PRIMARY KEY, event_id TEXT NOT NULL, destination TEXT NOT NULL, state TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_ms INTEGER NOT NULL DEFAULT 0, receipt_json TEXT, created_ms INTEGER NOT NULL, UNIQUE(event_id, destination));
    CREATE TABLE executions (id TEXT PRIMARY KEY, solution_id TEXT NOT NULL UNIQUE, state TEXT NOT NULL, session_id TEXT UNIQUE, pid INTEGER, process_start TEXT, worktree TEXT, started_ms INTEGER, deadline_ms INTEGER, exit_code INTEGER, pr_url TEXT, head_sha TEXT, reason TEXT);
    CREATE UNIQUE INDEX idx_exec_active ON executions((1)) WHERE state IN ('RESERVED','RUNNING','UNCERTAIN','VERIFYING');
    CREATE TABLE control (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE audit (seq INTEGER PRIMARY KEY, event TEXT NOT NULL, ref TEXT, details_json TEXT, created_ms INTEGER NOT NULL);
    CREATE TABLE manifests (event_id TEXT PRIMARY KEY, producer_role TEXT NOT NULL, artifact_sha256 TEXT NOT NULL, artifact_bytes INTEGER NOT NULL, source_page_id TEXT, source_reference TEXT, manifest_json TEXT NOT NULL, fetched_ms INTEGER);
    CREATE TABLE cursors (producer_role TEXT PRIMARY KEY, committed_token TEXT, pending_token TEXT);
    CREATE TABLE snapshot_items (producer_role TEXT NOT NULL, token TEXT NOT NULL, item_id TEXT NOT NULL, state TEXT NOT NULL, PRIMARY KEY (producer_role, token, item_id));
    CREATE TABLE index_progress (producer_role TEXT NOT NULL, token TEXT NOT NULL, generation INTEGER NOT NULL, next_page_number INTEGER NOT NULL, next_descriptor_json TEXT, complete INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (producer_role, token));
    ALTER TABLE outbox ADD COLUMN sender_boot_id TEXT;
    ALTER TABLE outbox ADD COLUMN sender_pid INTEGER;
    ALTER TABLE outbox ADD COLUMN sender_start TEXT;
    ALTER TABLE executions ADD COLUMN supervisor_boot_id TEXT;
    ALTER TABLE executions ADD COLUMN authorized_attempts INTEGER NOT NULL DEFAULT 3;
    ALTER TABLE executions ADD COLUMN reserved_total_ms INTEGER NOT NULL DEFAULT 21600000;
    ALTER TABLE executions ADD COLUMN attempts_admitted INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE executions ADD COLUMN charged_reservation_ms INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE executions ADD COLUMN resumptions INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE executions ADD COLUMN consecutive_resume_failures INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE executions ADD COLUMN last_resume_boot TEXT;
    CREATE TABLE execution_attempts (
      execution_id TEXT NOT NULL,
      attempt_number INTEGER NOT NULL,
      boot_id TEXT,
      state TEXT NOT NULL,
      reserved_ms INTEGER NOT NULL DEFAULT 7200000,
      active_start_ns TEXT,
      last_active_ns TEXT,
      measured_active_used_ms INTEGER,
      actual_elapsed_proven INTEGER NOT NULL DEFAULT 0,
      supervisor_pid INTEGER,
      supervisor_start TEXT,
      child_pid INTEGER,
      child_start TEXT,
      session_id TEXT,
      PRIMARY KEY (execution_id, attempt_number)
    );
    DROP INDEX IF EXISTS idx_exec_active;
    CREATE UNIQUE INDEX idx_exec_active
      ON executions((1)) WHERE state IN ('RESERVED','RUNNING','UNCERTAIN','VERIFYING','INTERRUPTED_HOST','RECOVERING_HOST','RESUMING_HOST');
    PRAGMA user_version = 2;
  `);
  // A REQUIRES_REVIEW row is legal under the v2 index (it does not know the
  // state) — a v2 capture checkpoint leaves exactly this shape behind.
  raw.prepare("INSERT INTO executions (id, solution_id, state, session_id, started_ms, deadline_ms) VALUES ('DOT-EXEC-RV','S-RV','REQUIRES_REVIEW','dddddddd-dddd-4ddd-8ddd-dddddddddddd',1,2)").run();
  raw.close();

  const ledger = openLedger(path, { now });
  const check = new DatabaseSync(path);
  assert.equal(check.prepare('PRAGMA user_version').get().user_version, 3);
  const tables = check.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('worker_reports','review_receipts')").all().map((r) => r.name).sort();
  assert.deepEqual(tables, ['review_receipts', 'worker_reports']);
  // The migrated index now counts REQUIRES_REVIEW as slot-owning: no second
  // active execution may exist alongside it, in ANY active state.
  assert.throws(() => check.prepare("INSERT INTO executions (id, solution_id, state, session_id, started_ms, deadline_ms) VALUES ('DOT-EXEC-TWO','S-TWO','RUNNING','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',3,4)").run(), /UNIQUE/);
  assert.throws(() => check.prepare("INSERT INTO executions (id, solution_id, state, session_id, started_ms, deadline_ms) VALUES ('DOT-EXEC-THR','S-THR','REQUIRES_REVIEW','ffffffff-ffff-4fff-8fff-ffffffffffff',5,6)").run(), /UNIQUE/);
  check.close();
  // Row preserved; the ledger sees the review-held slot everywhere.
  const row = ledger.getExecution('DOT-EXEC-RV');
  assert.equal(row.state, 'REQUIRES_REVIEW');
  assert.ok(ledger.status().execution, 'status must expose the review-held slot');
  assert.equal(ledger.status().execution.id, 'DOT-EXEC-RV');
  const s2 = solutionChain(ledger, 'r10mig');
  assert.equal(ledger.claimExecution({ solutionId: s2.id, sessionId: 'abababab-abab-4bab-8bab-abababababab' }).claimed, false);
  const adm = ledger.admitNextAttempt({ executionId: 'DOT-EXEC-RV', bootId: 'BOOT-3', sessionId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' });
  assert.equal(adm.admitted, false, 'resume admission never bypasses the review gate');
  ledger.close();
  rmSync(dir, { recursive: true, force: true });
});

// ------------------------------------------------ R10: slot-owning REQUIRES_REVIEW surface

test('R10 ledger: REQUIRES_REVIEW holds the slot against claim/admission/host-reconciliation — only review-import advances it', () => {
  const { ledger } = freshLedger();
  const solution = solutionChain(ledger, 'r10a');
  const claim = ledger.claimExecution({
    solutionId: solution.id, sessionId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    bootId: 'BOOT-1', supervisor: { pid: 901, start: 'Mon Oct  6 09:00:00 2026' },
  });
  ledger.updateExecution(claim.execution_id, { state: 'REQUIRES_REVIEW', pid: 601, process_start: 'Mon Oct  6 10:00:00 2026', pr_url: 'https://github.com/artyhoo/getff/pull/4001', head_sha: sha40('r10-head') });
  assert.ok(ledger.status().execution, 'status must expose the review-held slot');
  assert.equal(ledger.status().execution.state, 'REQUIRES_REVIEW');
  // a NEW queued solution cannot take the slot
  const s2 = solutionChain(ledger, 'r10b');
  assert.equal(ledger.claimExecution({ solutionId: s2.id, sessionId: 'abababab-abab-4bab-8bab-abababababab' }).claimed, false);
  // resume admission refuses: the review gate, not another GLM attempt, owns the row
  const adm = ledger.admitNextAttempt({ executionId: claim.execution_id, bootId: 'BOOT-9', sessionId: claim.session_id });
  assert.equal(adm.admitted, false);
  // host reconciliation NEVER flips a review-held row to INTERRUPTED_HOST (a
  // reboot must not open a resume around the review)
  const rec = ledger.reconcileHost({ bootId: 'BOOT-9', processProbe: () => ({ alive: false, start: null }), controlActor: 'r10-review-gate-test' });
  assert.deepEqual(rec.executions.map((e) => e.decision), ['requires-review']);
  assert.equal(ledger.getExecution(claim.execution_id).state, 'REQUIRES_REVIEW');
  // CONFIRM_DEAD reconciliation cannot abort the review either (explicit
  // refusal — load-bearing once REQUIRES_REVIEW joins ACTIVE_STATES)
  assert.throws(() => ledger.reconcileExecution({
    execution_id: claim.execution_id,
    evidence: { session_id: claim.session_id, control: 'operator test control input for the review-hold refusal arm' },
    decision: 'CONFIRM_DEAD',
  }), (e) => e.code === 'RECONCILE_STATE');
  assert.equal(ledger.getExecution(claim.execution_id).state, 'REQUIRES_REVIEW');
  ledger.close();
});

// ------------------------------------------------ R10: reviewImport / worker reports

// F07 v2 receipt shape for the ledger suite: the approval bound to
// repository, PR number, base SHA, policy snapshot, an explicit Dot GO, and
// the immutable published source of the review evidence.
const F07_POLICY = { version: 1, digest: sha256Of('ledger-review-policy-v1') };
const v2Receipt = (report, overrides = {}) => ({
  version: 2,
  execution_id: report.execution_id,
  session_id: report.session_id,
  solution_sha256: report.solution_sha256,
  artifact_sha256: report.artifact_sha256,
  source_tree_digest: report.source_tree_digest,
  head_sha: report.head_sha,
  repository: 'artyhoo/getff',
  pr_number: 4002,
  base_sha: sha40('r10-base'),
  policy: { version: F07_POLICY.version, digest: F07_POLICY.digest },
  dot_go: true,
  source: { reference: `dot://reviews/${report.execution_id}`, sha256: report.artifact_sha256 },
  reviewer: 'dot-relay-os-owner',
  verdict: 'APPROVE',
  ...overrides,
});

test('R10 ledger: reviewImport — schema/independence/mismatch refusals never persist; a matching receipt advances to VERIFYING; replay, immutability, source-change invalidation', () => {
  const { ledger } = freshLedger();
  assert.equal(typeof ledger.persistWorkerReport, 'function', 'R10: persistWorkerReport API exists');
  assert.equal(typeof ledger.getWorkerReport, 'function', 'R10: getWorkerReport API exists');
  assert.equal(typeof ledger.getReviewReceipt, 'function', 'R10: getReviewReceipt API exists');
  assert.equal(typeof ledger.reviewImport, 'function', 'R10: reviewImport API exists');
  const solution = solutionChain(ledger, 'r10c');
  const claim = ledger.claimExecution({ solutionId: solution.id, sessionId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' });
  const report = {
    version: 1, status: 'CODE_COMPLETE',
    execution_id: claim.execution_id, session_id: claim.session_id,
    solution_sha256: sha256Of('r10-sol'), artifact_sha256: sha256Of('r10-art'),
    source_tree_digest: sha256Of('r10-tree'),
    pr_url: 'https://github.com/artyhoo/getff/pull/4002', head_sha: sha40('r10-head'),
    independent_review_ref: null,
  };
  ledger.updateExecution(claim.execution_id, { state: 'REQUIRES_REVIEW', pr_url: report.pr_url, head_sha: report.head_sha });
  // no worker report captured -> hold, never invent approval
  const receipt = v2Receipt(report);
  assert.throws(() => ledger.reviewImport({ executionId: claim.execution_id, receipt }), (e) => e.code === 'REVIEW_REPORT_MISSING');
  ledger.persistWorkerReport({ executionId: claim.execution_id, report });
  assert.ok(ledger.getWorkerReport(claim.execution_id), 'worker report persisted and readable');
  assert.equal(ledger.getWorkerReport(claim.execution_id).source_tree_digest, report.source_tree_digest);
  // schema refusals
  assert.throws(() => ledger.reviewImport({ executionId: claim.execution_id, receipt: { ...receipt, verdict: 'LGTM' } }), (e) => e.code === 'RECEIPT_SCHEMA');
  assert.throws(() => ledger.reviewImport({ executionId: claim.execution_id, receipt: { ...receipt, extra_key: 1 } }), (e) => e.code === 'RECEIPT_SCHEMA');
  assert.throws(() => ledger.reviewImport({ executionId: claim.execution_id, receipt: { ...receipt, dot_go: false } }), (e) => e.code === 'RECEIPT_SCHEMA');
  assert.throws(() => ledger.reviewImport({ executionId: claim.execution_id, receipt: { ...receipt, reviewer: claim.session_id } }), (e) => e.code === 'REVIEWER_NOT_INDEPENDENT');
  // digest/head mismatches against the CURRENT report
  assert.throws(() => ledger.reviewImport({ executionId: claim.execution_id, receipt: { ...receipt, head_sha: sha40('other-head') } }), (e) => e.code === 'RECEIPT_MISMATCH');
  assert.throws(() => ledger.reviewImport({ executionId: claim.execution_id, receipt: { ...receipt, source_tree_digest: sha256Of('a-different-source-tree') } }), (e) => e.code === 'RECEIPT_MISMATCH');
  assert.ok(!ledger.getReviewReceipt(claim.execution_id), 'a rejected receipt never persists');
  assert.equal(ledger.getExecution(claim.execution_id).state, 'REQUIRES_REVIEW');
  // REVIEW_STATE: without a prior receipt, only a REQUIRES_REVIEW row accepts.
  // Own fresh ledger: the main ledger's execution still holds REQUIRES_REVIEW,
  // and the single-active-slot invariant (asserted in the executor suite)
  // would refuse a second claim outright.
  const { ledger: ledgerB } = freshLedger();
  const solutionB = solutionChain(ledgerB, 'r10d');
  const claimB = ledgerB.claimExecution({ solutionId: solutionB.id, sessionId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' });
  ledgerB.updateExecution(claimB.execution_id, { state: 'RUNNING' });
  ledgerB.persistWorkerReport({ executionId: claimB.execution_id, report: { ...report, execution_id: claimB.execution_id, session_id: claimB.session_id } });
  assert.throws(() => ledgerB.reviewImport({ executionId: claimB.execution_id, receipt: { ...receipt, execution_id: claimB.execution_id, session_id: claimB.session_id } }), (e) => e.code === 'REVIEW_STATE');
  ledgerB.close();
  // legit receipt: atomically applied, state advances to VERIFYING
  const applied = ledger.reviewImport({ executionId: claim.execution_id, receipt });
  assert.equal(applied.applied, true);
  assert.equal(ledger.getExecution(claim.execution_id).state, 'VERIFYING');
  const stored = ledger.getReviewReceipt(claim.execution_id);
  assert.ok(stored, 'applied receipt is durable');
  assert.equal(stored.reviewer, 'dot-relay-os-owner');
  // identical bytes replay as a no-op
  const replay = ledger.reviewImport({ executionId: claim.execution_id, receipt });
  assert.equal(replay.replay, true);
  // a DIFFERENT receipt after an applied one is immutable-held
  assert.throws(() => ledger.reviewImport({ executionId: claim.execution_id, receipt: { ...receipt, reviewer: 'other-owner-0002' } }), (e) => e.code === 'RECEIPT_IMMUTABLE');
  assert.equal(ledger.getExecution(claim.execution_id).state, 'VERIFYING');
  // a changed source tree invalidates the prior approval; a fresh matching
  // receipt may re-approve the new tree
  ledger.persistWorkerReport({ executionId: claim.execution_id, report: { ...report, source_tree_digest: sha256Of('r10-tree-v2') } });
  assert.ok(!ledger.getReviewReceipt(claim.execution_id), 'source change invalidates the applied receipt');
  const reapplied = ledger.reviewImport({ executionId: claim.execution_id, receipt: { ...receipt, source_tree_digest: sha256Of('r10-tree-v2') } });
  assert.equal(reapplied.applied, true);
  ledger.close();
});

// ------------------------------------------------ F07: v2 receipt binding

test('F07 ledger: the legacy v1 receipt shape no longer imports (RECEIPT_SCHEMA) — an arbitrary reviewer string authorizes nothing', () => {
  const { ledger } = freshLedger();
  const solution = solutionChain(ledger, 'f07a');
  const claim = ledger.claimExecution({ solutionId: solution.id, sessionId: 'f07a0000-0000-4000-8000-000000000001' });
  const report = {
    version: 1, status: 'CODE_COMPLETE',
    execution_id: claim.execution_id, session_id: claim.session_id,
    solution_sha256: sha256Of('f07-sol'), artifact_sha256: sha256Of('f07-art'),
    source_tree_digest: sha256Of('f07-tree'),
    pr_url: 'https://github.com/artyhoo/getff/pull/4003', head_sha: sha40('f07-head'),
    independent_review_ref: null,
  };
  ledger.updateExecution(claim.execution_id, { state: 'REQUIRES_REVIEW', pr_url: report.pr_url, head_sha: report.head_sha });
  ledger.persistWorkerReport({ executionId: claim.execution_id, report });
  const v1 = {
    version: 1, execution_id: claim.execution_id, session_id: claim.session_id,
    solution_sha256: report.solution_sha256, artifact_sha256: report.artifact_sha256,
    source_tree_digest: report.source_tree_digest, head_sha: report.head_sha,
    reviewer: 'totally-legit-reviewer', verdict: 'APPROVE',
  };
  assert.throws(() => ledger.reviewImport({ executionId: claim.execution_id, receipt: v1 }), (e) => e.code === 'RECEIPT_SCHEMA');
  assert.ok(!ledger.getReviewReceipt(claim.execution_id), 'the v1 shape never persists');
  assert.equal(ledger.getExecution(claim.execution_id).state, 'REQUIRES_REVIEW');
  ledger.close();
});

test('F07 ledger: v2 binding fields are shape-validated (repository/pr/base/policy/dot_go/source)', () => {
  const { ledger } = freshLedger();
  const solution = solutionChain(ledger, 'f07b');
  const claim = ledger.claimExecution({ solutionId: solution.id, sessionId: 'f07b0000-0000-4000-8000-000000000002' });
  const report = {
    version: 1, status: 'CODE_COMPLETE',
    execution_id: claim.execution_id, session_id: claim.session_id,
    solution_sha256: sha256Of('f07b-sol'), artifact_sha256: sha256Of('f07b-art'),
    source_tree_digest: sha256Of('f07b-tree'),
    pr_url: 'https://github.com/artyhoo/getff/pull/4004', head_sha: sha40('f07b-head'),
    independent_review_ref: null,
  };
  ledger.updateExecution(claim.execution_id, { state: 'REQUIRES_REVIEW', pr_url: report.pr_url, head_sha: report.head_sha });
  ledger.persistWorkerReport({ executionId: claim.execution_id, report });
  const good = v2Receipt(report);
  for (const [name, mutate] of [
    ['version 3', (r) => ({ ...r, version: 3 })],
    ['dot_go false', (r) => ({ ...r, dot_go: false })],
    ['repository without owner', (r) => ({ ...r, repository: 'not-a-slash-repo' })],
    ['pr_number zero', (r) => ({ ...r, pr_number: 0 })],
    ['pr_number string', (r) => ({ ...r, pr_number: '4004' })],
    ['39-hex base_sha', (r) => ({ ...r, base_sha: 'a'.repeat(39) })],
    ['policy without version', (r) => ({ ...r, policy: { digest: r.policy.digest } })],
    ['policy digest not hex64', (r) => ({ ...r, policy: { version: 1, digest: 'zz' } })],
    ['policy extra key', (r) => ({ ...r, policy: { version: 1, digest: r.policy.digest, extra: 1 } })],
    ['source without reference', (r) => ({ ...r, source: { sha256: r.source.sha256 } })],
    ['source empty reference', (r) => ({ ...r, source: { reference: '', sha256: r.source.sha256 } })],
    ['source sha256 not hex64', (r) => ({ ...r, source: { reference: 'dot://x', sha256: 'nope' } })],
  ]) {
    assert.throws(() => ledger.reviewImport({ executionId: claim.execution_id, receipt: mutate(good) }), (e) => e.code === 'RECEIPT_SCHEMA', name);
  }
  assert.ok(!ledger.getReviewReceipt(claim.execution_id));
  assert.equal(ledger.getExecution(claim.execution_id).state, 'REQUIRES_REVIEW');
  ledger.close();
});

test('F07 ledger: a pre-existing v1 row stays a readable historical record — same bytes replay, different bytes immutable, never a new grant', () => {
  const { dir, ledger } = freshLedger();
  const solution = solutionChain(ledger, 'f07c');
  const claim = ledger.claimExecution({ solutionId: solution.id, sessionId: 'f07c0000-0000-4000-8000-000000000003' });
  const report = {
    version: 1, status: 'CODE_COMPLETE',
    execution_id: claim.execution_id, session_id: claim.session_id,
    solution_sha256: sha256Of('f07c-sol'), artifact_sha256: sha256Of('f07c-art'),
    source_tree_digest: sha256Of('f07c-tree'),
    pr_url: 'https://github.com/artyhoo/getff/pull/4005', head_sha: sha40('f07c-head'),
    independent_review_ref: null,
  };
  ledger.updateExecution(claim.execution_id, { state: 'DONE', pr_url: report.pr_url, head_sha: report.head_sha });
  ledger.persistWorkerReport({ executionId: claim.execution_id, report });
  // a historical v1 approval, applied before the v2 contract existed
  const v1 = {
    version: 1, execution_id: claim.execution_id, session_id: claim.session_id,
    solution_sha256: report.solution_sha256, artifact_sha256: report.artifact_sha256,
    source_tree_digest: report.source_tree_digest, head_sha: report.head_sha,
    reviewer: 'dot-relay-os-owner', verdict: 'APPROVE',
  };
  const raw = new DatabaseSync(join(dir, 'ledger.sqlite'));
  raw.prepare('INSERT INTO review_receipts (execution_id, receipt_json, reviewer, verdict, imported_ms) VALUES (?,?,?,?,?)')
    .run(claim.execution_id, JSON.stringify(v1), v1.reviewer, v1.verdict, 1);
  raw.close();
  // the historical record is still readable
  const stored = ledger.getReviewReceipt(claim.execution_id);
  assert.ok(stored);
  assert.equal(stored.version, 1);
  assert.equal(stored.reviewer, 'dot-relay-os-owner');
  // replaying the SAME historical bytes is an idempotent no-op
  const replay = ledger.reviewImport({ executionId: claim.execution_id, receipt: v1 });
  assert.equal(replay.replay, true);
  // a DIFFERENT receipt over the historical row is immutable — the record
  // can never be upgraded or replaced, and it grants nothing new
  assert.throws(() => ledger.reviewImport({ executionId: claim.execution_id, receipt: v2Receipt(report) }), (e) => e.code === 'RECEIPT_IMMUTABLE');
  assert.equal(ledger.getExecution(claim.execution_id).state, 'DONE');
  ledger.close();
});

// ------------------------------------------------ baseline fall-through fix

test('old batch with PARTIAL baseline coverage never becomes READY (no outbox, no fall-through)', () => {
  const { ledger } = freshLedger();
  const old1 = batchEnv('DOT-BATCH-0002', 'pf1');
  ledger.ingest(old1);
  // receipt covers only 9 of the 10 keys -> partial coverage
  const keys = old1.payload.reports.map((r) => reportKey(r));
  ledger.recordBaselineReceipt({
    intake_id: 'DOT-INTAKE-20261008-01',
    consumed_report_keys: keys.slice(0, 9),
    excluded: [],
  });
  assert.equal(ledger.getEvent('DOT-BATCH-0002').state, 'BASELINE_HOLD'); // reviewer fix: never READY
  assert.equal(ledger.status().counts.outbox_total, 0); // no delivery for an old batch
  // re-ingest (replay path through _route) still never falls through to READY
  const r = ledger.ingest(old1);
  assert.equal(r.state, 'BASELINE_HOLD');
  assert.equal(ledger.status().counts.outbox_total, 0);
  // completing the mapping resolves it to CONSUMED
  ledger.recordBaselineReceipt({
    intake_id: 'DOT-INTAKE-20261008-01',
    consumed_report_keys: keys.slice(0, 9),
    excluded: [keys[9]],
  });
  assert.equal(ledger.getEvent('DOT-BATCH-0002').state, 'CONSUMED');
});

// ------------------------------------------------ R04/R05: ancestry, ACK authority, conflicts

// Registers the production provenance (public manifest) for an event so its
// deliveries and ACKs bind the ORIGINAL artifact whole-file digest — the
// synthetic payload-digest fallback is gone (R04).
function withManifest(ledger, event, role = 'collector') {
  const m = publicManifest(event, { destination: role === 'collector' ? CHAT_IDS.analyst : CHAT_IDS.solver });
  ledger.manifestImport({ manifest: m, producerRole: role, cursorToken: `tok-${event.id}` });
  return m;
}

test('R04: analysis holds WAIT_PARENT_ACK until the batch->analyst delivery is ACKED by the analyst role', () => {
  const { ledger } = freshLedger();
  const batch = batchEnv('DOT-EVT-R4A', 'r4a');
  withManifest(ledger, batch);
  ledger.ingest(batch);
  const analysis = analysisEnv('DOT-EVT-R4A-A', batch, {
    candidates: [{ candidate_id: 'C1', finding_keys: ['F'], report_keys: [reportKey(batch.payload.reports[0])], reviewed_sha: batch.payload.reports[0].reviewed_sha, summary: 's' }],
  });
  const r = ledger.ingest(analysis);
  assert.equal(r.state, 'WAIT_PARENT_ACK');
  assert.equal(ledger.status().counts.outbox_total, 1, 'no solver delivery before the parent ACK');
  assert.ok(!ledger.pendingDeliveries().some((d) => d.destination === CHAT_IDS.solver));

  const d = ledger.pendingDeliveries()[0];
  ledger.claimDelivery(d.delivery_id);
  const ack = ackPayload(d.delivery_id, batch, publicManifest(batch).sha256);
  // a WRONG-role ACK (the collector acking its own outgoing delivery) is a hold
  assert.throws(() => ledger.ack(ack, { trustedProducerRole: 'collector' }), (e) => e.code === 'ACK_ROLE_MISMATCH');
  assert.equal(ledger.getOutbox(d.delivery_id).state, 'CLAIMED');
  assert.equal(ledger.getEvent(analysis.id).state, 'WAIT_PARENT_ACK');

  // the legitimate destination-role ACK routes the held analysis
  ledger.ack(ack, { trustedProducerRole: 'analyst' });
  assert.equal(ledger.getOutbox(d.delivery_id).state, 'ACKED');
  assert.equal(ledger.getEvent(analysis.id).state, 'READY');
  assert.ok(ledger.pendingDeliveries().some((x) => x.destination === CHAT_IDS.solver));
  // replay ingest of the same analysis is an idempotent no-op
  assert.equal(ledger.ingest(analysis).state, 'READY');
});

test('R04: solution holds WAIT_PARENT_ACK until the analysis->solver delivery is ACKED by the solver role', () => {
  const { ledger } = freshLedger();
  const batch = batchEnv('DOT-EVT-R4B', 'r4b');
  withManifest(ledger, batch);
  ledger.ingest(batch);
  const cand = { candidate_id: 'C1', finding_keys: ['F1'], report_keys: [reportKey(batch.payload.reports[0])], reviewed_sha: batch.payload.reports[0].reviewed_sha, summary: 's' };
  const analysis = analysisEnv('DOT-EVT-R4B-A', batch, { candidates: [cand] });
  ledger.ingest(analysis);

  const batchDelivery = ledger.pendingDeliveries()[0];
  ledger.claimDelivery(batchDelivery.delivery_id);
  ledger.ack(ackPayload(batchDelivery.delivery_id, batch, publicManifest(batch).sha256), { trustedProducerRole: 'analyst' });

  const analysisDelivery = ledger.pendingDeliveries().find((x) => x.destination === CHAT_IDS.solver);
  assert.ok(analysisDelivery, 'analysis routed after parent ACK');
  withManifest(ledger, analysis, 'analyst');

  const solution = solutionEnv('DOT-EVT-R4B-S', analysis);
  // solutionEnv uses candidate C1/F1/sha40('rv') — align to the parent candidate
  solution.payload.candidate_id = 'C1';
  solution.payload.finding_keys = ['F1'];
  solution.payload.reviewed_sha = cand.reviewed_sha;
  seal(solution);
  const rs = ledger.ingest(solution);
  assert.equal(rs.state, 'WAIT_PARENT_ACK');
  assert.equal(ledger.nextClaimableSolution(), null, 'no executor admission before the parent ACK');

  ledger.claimDelivery(analysisDelivery.delivery_id);
  ledger.ack(ackPayload(analysisDelivery.delivery_id, analysis, publicManifest(analysis, { destination: CHAT_IDS.solver }).sha256), { trustedProducerRole: 'solver' });
  assert.equal(ledger.getEvent(solution.id).state, 'QUEUED');
  assert.ok(ledger.nextClaimableSolution());
});

test('R04: wrong-role ACK is refused from snapshot and receipt import entry points', () => {
  const { ledger } = freshLedger();
  const batch = batchEnv('DOT-EVT-R4C', 'r4c');
  withManifest(ledger, batch);
  ledger.ingest(batch);
  const d = ledger.pendingDeliveries()[0];
  ledger.claimDelivery(d.delivery_id);
  const ack = ackPayload(d.delivery_id, batch, publicManifest(batch).sha256);
  // collector-role snapshot carrying an ACK for a collector->analyst delivery
  assert.throws(() => ledger.snapshotImport({ bundle: { version: 1, status: 'READY', acks: [ack], manifests: [] }, producerRole: 'collector', cursorToken: 'tok-r4c' }), (e) => e.code === 'ACK_ROLE_MISMATCH');
  assert.throws(() => ledger.receiptImport({ receipt: { version: 1, acks: [ack] }, producerRole: 'collector' }), (e) => e.code === 'ACK_ROLE_MISMATCH');
  assert.equal(ledger.getOutbox(d.delivery_id).state, 'CLAIMED');
  // the analyst-role receipt import ACKs it
  const ok = ledger.receiptImport({ receipt: { version: 1, acks: [ack] }, producerRole: 'analyst' });
  assert.equal(ok.acks_imported, 1);
  assert.equal(ledger.getOutbox(d.delivery_id).state, 'ACKED');
});

test('R04: ACK without registered manifest provenance is refused (no synthetic digest fallback)', () => {
  const { ledger } = freshLedger();
  const batch = batchEnv('DOT-EVT-R4D', 'r4d');
  ledger.ingest(batch); // no manifestImport anywhere
  const d = ledger.pendingDeliveries()[0];
  ledger.claimDelivery(d.delivery_id);
  const ev = ledger.getEvent(batch.id);
  // the exact bytes the OLD synthetic fallback would have accepted: with the
  // fallback gone, even this digest must fail — no manifest, no ACK authority
  const synthetic = sha256Of(`${ev.parent_json}\u0000${ev.payload_json}`);
  assert.throws(() => ledger.ack(ackPayload(d.delivery_id, { id: ev.id, sha256: ev.sha256 }, synthetic), { trustedProducerRole: 'analyst' }), (e) => e.code === 'ACK_MISMATCH');
  assert.equal(ledger.getOutbox(d.delivery_id).state, 'CLAIMED');
});

test('R04: analysis coverage must be the EXACT parent batch key set (no missing/extra)', () => {
  const { ledger } = freshLedger();
  const batch = batchEnv('DOT-EVT-R4E', 'r4e');
  withManifest(ledger, batch);
  ledger.ingest(batch);
  const keys = batch.payload.reports.map((r) => reportKey(r));

  const missing = analysisEnv('DOT-EVT-R4E-A1', batch, { consumed: keys.slice(0, 9), candidates: [] });
  const r1 = ledger.ingest(missing);
  assert.equal(r1.state, 'BLOCKED');
  assert.ok(ledger.getEvent(missing.id).reason.includes('ANALYSIS_COVERAGE'));

  const extra = analysisEnv('DOT-EVT-R4E-A2', batch, { consumed: [...keys, sha256Of('foreign')] });
  const r2 = ledger.ingest(extra);
  assert.equal(r2.state, 'BLOCKED');
  assert.ok(ledger.getEvent(extra.id).reason.includes('ANALYSIS_COVERAGE'));

  // exact coverage (one key excluded with a reason) is admitted
  const good = analysisEnv('DOT-EVT-R4E-A3', batch, {
    consumed: keys.slice(0, 9),
    excluded: [{ report_key: keys[9], reason: 'out of scope' }],
    candidates: [{ candidate_id: 'C1', finding_keys: ['F'], report_keys: [keys[0]], reviewed_sha: batch.payload.reports[0].reviewed_sha, summary: 's' }],
  });
  assert.equal(ledger.ingest(good).state, 'WAIT_PARENT_ACK');
});

test('R04: candidate reviewed_sha must match its referenced parent reports', () => {
  const { ledger } = freshLedger();
  const batch = batchEnv('DOT-EVT-R4F', 'r4f');
  withManifest(ledger, batch);
  ledger.ingest(batch);
  const bad = analysisEnv('DOT-EVT-R4F-A', batch, {
    candidates: [{ candidate_id: 'C1', finding_keys: ['F'], report_keys: [reportKey(batch.payload.reports[0])], reviewed_sha: sha40('not-the-report-value'), summary: 's' }],
  });
  const r = ledger.ingest(bad);
  assert.equal(r.state, 'BLOCKED');
  assert.ok(ledger.getEvent(bad.id).reason.includes('CANDIDATE_REVIEWED_SHA'));
});

test('R04: solution must identify an EXACT parent candidate (id + finding_keys + reviewed_sha)', () => {
  const { ledger } = freshLedger();
  const batch = batchEnv('DOT-EVT-R4G', 'r4g');
  withManifest(ledger, batch);
  ledger.ingest(batch);
  const cand = { candidate_id: 'C9', finding_keys: ['FA', 'FB'], report_keys: [reportKey(batch.payload.reports[2])], reviewed_sha: batch.payload.reports[2].reviewed_sha, summary: 's' };
  const analysis = analysisEnv('DOT-EVT-R4G-A', batch, { candidates: [cand] });
  ledger.ingest(analysis);
  const db = ledger.claimDelivery(ledger.pendingDeliveries()[0].delivery_id);
  ledger.ack(ackPayload(db.delivery_id, batch, publicManifest(batch).sha256), { trustedProducerRole: 'analyst' });
  const da = ledger.pendingDeliveries().find((x) => x.destination === CHAT_IDS.solver);
  withManifest(ledger, analysis, 'analyst');
  ledger.claimDelivery(da.delivery_id);
  ledger.ack(ackPayload(da.delivery_id, analysis, publicManifest(analysis, { destination: CHAT_IDS.solver }).sha256), { trustedProducerRole: 'solver' });

  const mk = (mutate) => {
    const s = solutionEnv(`DOT-EVT-R4G-S-${Math.random().toString(36).slice(2, 6)}`, analysis);
    mutate(s.payload);
    seal(s);
    return s;
  };
  // reviewer reproduction: a digest-valid solution naming a FOREIGN candidate queues — must BLOCK
  const foreign = mk((p) => { p.candidate_id = 'C-NOT-IN-PARENT'; });
  assert.equal(ledger.ingest(foreign).state, 'BLOCKED');
  assert.ok(ledger.getEvent(foreign.id).reason.includes('CANDIDATE_MISSING'));
  const changedKeys = mk((p) => { p.candidate_id = 'C9'; p.finding_keys = ['FA', 'FC']; });
  assert.equal(ledger.ingest(changedKeys).state, 'BLOCKED');
  assert.ok(ledger.getEvent(changedKeys.id).reason.includes('CANDIDATE_FINDING_KEYS'));
  const changedSha = mk((p) => { p.candidate_id = 'C9'; p.finding_keys = ['FA', 'FB']; p.reviewed_sha = sha40('drifted'); });
  assert.equal(ledger.ingest(changedSha).state, 'BLOCKED');
  assert.ok(ledger.getEvent(changedSha.id).reason.includes('CANDIDATE_REVIEWED_SHA'));
  // the exact candidate queues
  const good = mk((p) => { p.candidate_id = 'C9'; p.finding_keys = ['FA', 'FB']; p.reviewed_sha = cand.reviewed_sha; });
  assert.equal(ledger.ingest(good).state, 'QUEUED');
});

test('R04: numeric and string comment IDs remain DISTINCT report keys through coverage', () => {
  const { ledger } = freshLedger();
  const batch = batchEnv('DOT-EVT-R4H', 'r4h');
  // numeric comment ids on the first two reports (NUMERIC-COMMENT-ID-ADDENDUM)
  batch.payload.reports[0].comment_id = 4242;
  batch.payload.reports[1].comment_id = 'r4h-1';
  seal(batch);
  withManifest(ledger, batch);
  ledger.ingest(batch);
  const keys = batch.payload.reports.map((r) => reportKey(r));
  assert.notEqual(keys[0], keys[1]);

  const swapped = analysisEnv('DOT-EVT-R4H-A', batch, {
    consumed: keys.map((k, i) => (i === 0 ? reportKey({ ...batch.payload.reports[0], comment_id: '4242' }) : k)),
  });
  const r = ledger.ingest(swapped);
  assert.equal(r.state, 'BLOCKED');
  assert.ok(ledger.getEvent(swapped.id).reason.includes('ANALYSIS_COVERAGE'));
});

test('R05: conflicting digest quarantines the identity across claim, admission and downstream readiness', () => {
  const { ledger } = freshLedger();
  const batch = batchEnv('DOT-EVT-R5A', 'r5a');
  withManifest(ledger, batch);
  ledger.ingest(batch);
  const analysis = analysisEnv('DOT-EVT-R5A-A', batch, {
    candidates: [{ candidate_id: 'C1', finding_keys: ['F'], report_keys: [reportKey(batch.payload.reports[0])], reviewed_sha: batch.payload.reports[0].reviewed_sha, summary: 's' }],
  });
  ledger.ingest(analysis);
  const db1 = ledger.pendingDeliveries()[0];
  ledger.claimDelivery(db1.delivery_id);
  ledger.ack(ackPayload(db1.delivery_id, batch, publicManifest(batch).sha256), { trustedProducerRole: 'analyst' });
  const da = ledger.pendingDeliveries().find((x) => x.destination === CHAT_IDS.solver);
  withManifest(ledger, analysis, 'analyst');
  ledger.claimDelivery(da.delivery_id);
  ledger.ack(ackPayload(da.delivery_id, analysis, publicManifest(analysis, { destination: CHAT_IDS.solver }).sha256), { trustedProducerRole: 'solver' });
  const solution = solutionEnv('DOT-EVT-R5A-S', analysis);
  solution.payload.candidate_id = 'C1';
  solution.payload.finding_keys = ['F'];
  solution.payload.reviewed_sha = batch.payload.reports[0].reviewed_sha;
  seal(solution);
  assert.equal(ledger.ingest(solution).state, 'QUEUED');

  // a second analysis routed BEFORE the conflict: once the conflict lands its
  // PENDING delivery is held out of the claimable set and claim-refused
  const analysis2 = analysisEnv('DOT-EVT-R5A-A3', batch, {
    candidates: [{ candidate_id: 'C2', finding_keys: ['F'], report_keys: [reportKey(batch.payload.reports[1])], reviewed_sha: batch.payload.reports[1].reviewed_sha, summary: 's2' }],
  });
  ledger.ingest(analysis2); // parent batch delivery already ACKED -> routes READY
  withManifest(ledger, analysis2, 'analyst');
  const da2 = ledger.pendingDeliveries().find((x) => x.event_id === analysis2.id);
  assert.ok(da2, 'analysis2 routed before the conflict lands');
  assert.ok(ledger.pendingDeliveries().some((d) => d.delivery_id === da2.delivery_id), 'claimable before the conflict');

  // same id, different bytes: CONFLICT, original preserved, identity held
  const conflicting = batchEnv('DOT-EVT-R5A', 'r5a-other');
  assert.equal(ledger.ingest(conflicting).state, 'CONFLICT');
  assert.equal(ledger.getEvent('DOT-EVT-R5A').sha256, batch.sha256, 'original immutable bytes preserved');

  // preexisting READY/outbox rows excluded from claim...
  assert.ok(!ledger.pendingDeliveries().some((d) => d.event_id === analysis.id), 'downstream readiness held');
  assert.ok(!ledger.pendingDeliveries().some((d) => d.delivery_id === da2.delivery_id), 'held out of the claimable set');
  assert.throws(() => ledger.claimDelivery(da2.delivery_id), (e) => e.code === 'CONFLICT_HELD');
  // ...and the QUEUED solution is excluded from executor admission
  assert.equal(ledger.nextClaimableSolution(), null);
  assert.throws(() => ledger.claimExecution({ solutionId: solution.id, sessionId: 'sess-r5' }), (e) => e.code === 'CONFLICT_HELD');

  // already-SENT/UNCERTAIN sends stay reconciliable (ACK still lands)
  assert.equal(ledger.getOutbox(da.delivery_id).state, 'ACKED');

  // a NEW child of the conflicted identity holds WAIT_PARENT
  const child = analysisEnv('DOT-EVT-R5A-A2', conflicting);
  assert.equal(ledger.ingest(child).state, 'WAIT_PARENT');
});

test('R05: explicit conflict resolution with both digests + disposition audit (no age-based clearing)', () => {
  const { ledger } = freshLedger();
  const batch = batchEnv('DOT-EVT-R5B', 'r5b');
  withManifest(ledger, batch);
  ledger.ingest(batch);
  const conflicting = batchEnv('DOT-EVT-R5B', 'r5b-x');
  assert.equal(ledger.ingest(conflicting).state, 'CONFLICT');

  // age never clears the hold
  nowMs += 90 * 24 * 3600 * 1000;
  assert.ok(!ledger.pendingDeliveries().some((d) => d.event_id === 'DOT-EVT-R5B'));

  // unknown disposition / missing actor refused
  assert.throws(() => ledger.conflictResolve({ eventId: 'DOT-EVT-R5B', disposition: 'maybe', actor: 'root-owner' }), (e) => e.code === 'CONFLICT_INPUT');
  assert.throws(() => ledger.conflictResolve({ eventId: 'DOT-EVT-R5B', disposition: 'original', actor: 'ab' }), (e) => e.code === 'CONFLICT_INPUT');
  assert.throws(() => ledger.conflictResolve({ eventId: 'DOT-EVT-NONE', disposition: 'original', actor: 'root-owner' }), (e) => e.code === 'NO_CONFLICT');

  // keeping the ORIGINAL clears the hold; the event returns to eligibility
  const r1 = ledger.conflictResolve({ eventId: 'DOT-EVT-R5B', disposition: 'original', actor: 'root-owner' });
  assert.equal(r1.disposition, 'original');
  assert.ok(ledger.pendingDeliveries().some((d) => d.event_id === 'DOT-EVT-R5B'));

  // disposition CONFLICTING supersedes: PENDING deliveries block, original bytes stay
  const conflicting2 = batchEnv('DOT-EVT-R5B', 'r5b-y');
  assert.equal(ledger.ingest(conflicting2).state, 'CONFLICT');
  const r2 = ledger.conflictResolve({ eventId: 'DOT-EVT-R5B', disposition: 'conflicting', actor: 'root-owner' });
  assert.equal(r2.state, 'SUPERSEDED_CONFLICT');
  assert.equal(ledger.getEvent('DOT-EVT-R5B').state, 'SUPERSEDED_CONFLICT');
  assert.equal(ledger.getEvent('DOT-EVT-R5B').sha256, batch.sha256, 'original immutable bytes still preserved');
  assert.ok(!ledger.pendingDeliveries().some((d) => d.event_id === 'DOT-EVT-R5B'));
});

// ------------------------------------------------ R06: exclusive scheduler ownership

const SCHED_PROBE = (map) => (pid) => map.get(Number(pid)) ?? { alive: false, start: null };

test('R06: scheduler ownership is exclusive — live owner refused, dead owner taken over, only the owned token completes', () => {
  const { ledger, path } = freshLedger();
  const start = 'Mon Oct  6 09:00:00 2026';
  const a = ledger.beginSchedulerTick({ bootId: 'BOOT-1', token: 'tok-a', owner: { pid: 501, start }, processProbe: SCHED_PROBE(new Map([[501, { alive: true, start }]])) });
  assert.equal(a.due, true);
  assert.equal(ledger.schedulerControl().owner.token, 'tok-a');

  // a second owner on the same boot while the exact owner is LIVE: refused, never overwritten
  const b = ledger.beginSchedulerTick({ bootId: 'BOOT-1', token: 'tok-b', owner: { pid: 502, start: 's2' }, processProbe: SCHED_PROBE(new Map([[501, { alive: true, start }]])) });
  assert.equal(b.refused, 'owner-live');
  assert.equal(ledger.schedulerControl().owner.token, 'tok-a');

  // same-token re-fire coalesces (RunAtLoad + calendar duplicate delivery)
  assert.equal(ledger.beginSchedulerTick({ bootId: 'BOOT-1', token: 'tok-a', processProbe: SCHED_PROBE(new Map([[501, { alive: true, start }]])) }).deduped, true);

  // the owner dies; a new tick takes over conservatively — audited, ownership replaced
  const c = ledger.beginSchedulerTick({ bootId: 'BOOT-1', token: 'tok-c', owner: { pid: 503, start: 's3' }, processProbe: SCHED_PROBE(new Map()) });
  assert.equal(c.due, true);
  assert.equal(ledger.schedulerControl().owner.token, 'tok-c');
  const raw = new DatabaseSync(path);
  const takeover = raw.prepare("SELECT details_json FROM audit WHERE event = 'SCHEDULER_TAKEOVER'").all();
  raw.close();
  assert.equal(takeover.length, 1);
  assert.equal(JSON.parse(takeover[0].details_json).previous.pid, 501);

  // only the OWNED token completes: the dead owner's stale token records nothing
  assert.equal(ledger.completeSchedulerTick({ bootId: 'BOOT-1', token: 'tok-a', owner: { pid: 501, start }, plannedOk: true }).recorded, false);
  // a different boot cannot complete an owned token either (full tuple, wrong boot)
  assert.equal(ledger.completeSchedulerTick({ bootId: 'BOOT-9', token: 'tok-c', owner: { pid: 503, start: 's3' }, plannedOk: true }).recorded, false);
  assert.equal(ledger.completeSchedulerTick({ bootId: 'BOOT-1', token: 'tok-c', owner: { pid: 503, start: 's3' }, plannedOk: true }).recorded, true);
  assert.ok(ledger.schedulerControl().next_due_wall_ms > now());
});

// R06 review partial: completion requires the ENTIRE stored owner tuple —
// token AND boot AND pid AND start. A completion carrying the right token but
// a wrong PID or start text (a second scheduler process recycling the token,
// or a stale completer after a takeover) records NOTHING and leaves the
// owner's record intact.
test('R06: scheduler completion requires the entire stored boot/PID/start/token tuple', () => {
  const { ledger, path } = freshLedger();
  const start = 'Mon Oct  6 09:00:00 2026';
  const a = ledger.beginSchedulerTick({ bootId: 'BOOT-1', token: 'tok-own', owner: { pid: 501, start }, processProbe: SCHED_PROBE(new Map([[501, { alive: true, start }]])) });
  assert.equal(a.due, true);

  const ctrlRaw = () => {
    const raw = new DatabaseSync(path);
    const v = raw.prepare("SELECT value FROM control WHERE key = 'tick_in_progress'").get();
    raw.close();
    return v?.value ?? null;
  };
  const heldBefore = ctrlRaw();

  // right token + boot, WRONG PID: rejected, owner record untouched
  assert.equal(ledger.completeSchedulerTick({ bootId: 'BOOT-1', token: 'tok-own', owner: { pid: 777, start }, plannedOk: true }).recorded, false);
  assert.equal(ctrlRaw(), heldBefore);
  // right token + boot, WRONG start text: rejected
  assert.equal(ledger.completeSchedulerTick({ bootId: 'BOOT-1', token: 'tok-own', owner: { pid: 501, start: 'Mon Oct  6 12:00:00 2026' }, plannedOk: true }).recorded, false);
  assert.equal(ctrlRaw(), heldBefore);
  // right token, no owner identity at all: the tuple cannot match a recorded owner
  assert.equal(ledger.completeSchedulerTick({ bootId: 'BOOT-1', token: 'tok-own', plannedOk: true }).recorded, false);
  assert.equal(ctrlRaw(), heldBefore);
  // the entire tuple completes and clears the in-progress record
  assert.equal(ledger.completeSchedulerTick({ bootId: 'BOOT-1', token: 'tok-own', owner: { pid: 501, start }, plannedOk: true }).recorded, true);
  assert.equal(ctrlRaw(), null);
});

test('R06: unprovable owner identity is refused, never overwritten (legacy raw tokens included)', () => {
  const { ledger, path } = freshLedger();
  // owner recorded without a start text: liveness of that pid can never be proven
  const a = ledger.beginSchedulerTick({ bootId: 'BOOT-1', token: 'tok-a', owner: { pid: 501, start: null }, processProbe: () => ({ alive: true, start: 'anything' }) });
  assert.equal(a.due, true);
  const b = ledger.beginSchedulerTick({ bootId: 'BOOT-1', token: 'tok-b', owner: { pid: 502, start: 's2' }, processProbe: () => ({ alive: true, start: 'x' }) });
  assert.equal(b.refused, 'owner-unproven');
  // no probe at all: same conservative refusal
  const c = ledger.beginSchedulerTick({ bootId: 'BOOT-1', token: 'tok-c', owner: { pid: 503, start: 's3' } });
  assert.equal(c.refused, 'owner-unproven');
  assert.equal(ledger.schedulerControl().owner.token, 'tok-a');

  // legacy pre-R06 in-progress value (bare token string): identity-free -> refused
  const raw = new DatabaseSync(path);
  raw.prepare("INSERT OR REPLACE INTO control (key, value) VALUES ('tick_in_progress', 'legacy-token')").run();
  raw.close();
  const legacy = ledger.beginSchedulerTick({ bootId: 'BOOT-1', token: 'tok-d', owner: { pid: 504, start: 's4' }, processProbe: () => ({ alive: false, start: null }) });
  assert.equal(legacy.refused, 'owner-unproven');
});

test('R06: next calendar due follows LOCAL launchd slots (0/4/8/12/16/20), never the raw epoch grid', () => {
  // delegation: the injected local-slot resolver is the single source of truth
  const { ledger } = freshLedger({ nextLocalSlotAfter: () => 7_777_777 });
  ledger.beginSchedulerTick({ bootId: 'BOOT-1', token: 't' });
  ledger.completeSchedulerTick({ bootId: 'BOOT-1', token: 't', plannedOk: true });
  assert.equal(ledger.schedulerControl().next_due_wall_ms, 7_777_777);

  // default resolver (any host timezone): strictly future, on the local grid, minute 0
  const saved = nowMs;
  nowMs = Date.now();
  const { ledger: l2 } = freshLedger();
  l2.beginSchedulerTick({ bootId: 'BOOT-1', token: 't2' });
  l2.completeSchedulerTick({ bootId: 'BOOT-1', token: 't2', plannedOk: true });
  const due = l2.schedulerControl().next_due_wall_ms;
  assert.ok(due > nowMs, 'next due is strictly in the future');
  assert.ok(due - nowMs <= 4 * 3600 * 1000 + 60_000, 'at most one slot ahead');
  assert.ok([0, 4, 8, 12, 16, 20].includes(new Date(due).getHours()), 'local hour is a launchd slot');
  assert.equal(new Date(due).getMinutes(), 0);
  nowMs = saved;
});

// ------------------------------------------------ R07: verified-dead same-boot recovery

test('R07: verified-dead same-boot crash (UNCERTAIN_STOP) is resume-eligible ONLY with fresh verified-dead evidence', () => {
  const { ledger } = freshLedger();
  const { claim } = claimedExecution(ledger);
  ledger.updateExecution(claim.execution_id, { state: 'RUNNING', pid: 601, process_start: CHILD_START });
  ledger.updateAttempt(claim.execution_id, 1, { state: 'RUNNING', child_pid: 601, child_start: CHILD_START });
  ledger.reconcileHost({ bootId: 'BOOT-1', processProbe: () => ({ alive: false, start: null }), controlActor: 'scheduler-tick' });
  assert.equal(ledger.getExecution(claim.execution_id).state, 'UNCERTAIN');
  assert.equal(ledger.getExecution(claim.execution_id).reason, 'UNCERTAIN_STOP');

  const ask = (verifiedDead) => ledger.admitNextAttempt({
    executionId: claim.execution_id, bootId: 'BOOT-1',
    supervisor: { pid: 701, start: 'Tue Oct  7 09:00:00 2026' },
    sessionId: claim.session_id, purpose: 'resume', verifiedDead,
  });
  // without the evidence flag the row stays terminal (never guessed)
  assert.equal(ask(false).admitted, false);
  assert.equal(ask().admitted, false);
  // with fresh verified-dead evidence: attempt 2 on the SAME boot and session
  const vd = ask(true);
  assert.equal(vd.admitted, true);
  assert.equal(vd.attempt_number, 2);
  const row = ledger.getExecution(claim.execution_id);
  assert.equal(row.state, 'RESUMING_HOST');
  assert.equal(row.session_id, claim.session_id);
  assert.equal(row.resumptions, 1);

  // other UNCERTAIN reasons stay terminal even WITH the flag
  const { ledger: l2 } = freshLedger();
  const { claim: c2 } = claimedExecution(l2);
  l2.updateExecution(c2.execution_id, { state: 'UNCERTAIN', reason: 'CLOCK_UNPROVEN' });
  assert.equal(l2.admitNextAttempt({
    executionId: c2.execution_id, bootId: 'BOOT-1',
    supervisor: { pid: 1, start: 's' }, sessionId: c2.session_id, purpose: 'resume', verifiedDead: true,
  }).admitted, false);
});

test('R07: reconcile decisions carry the session id (uncertain-stop dispatch censuses the exact session)', () => {
  const { ledger } = freshLedger();
  const { claim } = claimedExecution(ledger);
  ledger.updateExecution(claim.execution_id, { state: 'RUNNING', pid: 601, process_start: CHILD_START });
  ledger.updateAttempt(claim.execution_id, 1, { state: 'RUNNING', child_pid: 601, child_start: CHILD_START });
  const r = ledger.reconcileHost({ bootId: 'BOOT-1', processProbe: () => ({ alive: false, start: null }), controlActor: 'scheduler-tick' });
  const stop = r.executions.find((e) => e.decision === 'uncertain-stop');
  assert.equal(stop.execution_id, claim.execution_id);
  // the dispatch loop censuses THIS session before any --resume spawn
  assert.equal(stop.session_id, claim.session_id);
});

// ------------------------------------------------- F10: SCHEMA_VERSION_CRASH_WINDOW
// Schema/data commits and the user_version write must be ONE transaction, and
// an already-committed crash-window image (schema+data committed, version
// write lost) must converge conservatively — never re-run non-idempotent work,
// never reset identities, fail closed on anything not the exact expected image.

const V1_BATCH_IDS = ['DOT-BATCH-0001', 'DOT-BATCH-0002', 'DOT-BATCH-0003', 'DOT-BATCH-0004', 'DOT-BATCH-0005'];
const V1_INTAKE_ID = 'DOT-INTAKE-20261008-01';
const V1_CURSOR = 'b80b6957-cf4d-434a-9581-33008606603b:5';
const V1_SOURCE_SHA = '35738554faf029e9fe3b8b4c25bfdde242f65c66';

// The schema the v1->v2 migration was written against: base tables WITHOUT
// the HOST-RESILIENCE columns and WITHOUT the R10 review tables; the active
// slot index carries the v1 active-state set.
const V1_SCHEMA = `
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY, sha256 TEXT, kind TEXT NOT NULL, producer TEXT NOT NULL,
  parent_json TEXT NOT NULL, payload_json TEXT NOT NULL, state TEXT NOT NULL,
  reason TEXT, created_ms INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS reports (
  report_key TEXT PRIMARY KEY, event_id TEXT NOT NULL, body_sha256 TEXT
);
CREATE TABLE IF NOT EXISTS outbox (
  delivery_id TEXT PRIMARY KEY, event_id TEXT NOT NULL, destination TEXT NOT NULL,
  state TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_ms INTEGER NOT NULL DEFAULT 0,
  receipt_json TEXT, created_ms INTEGER NOT NULL,
  UNIQUE(event_id, destination)
);
CREATE TABLE IF NOT EXISTS executions (
  id TEXT PRIMARY KEY, solution_id TEXT NOT NULL UNIQUE, state TEXT NOT NULL,
  session_id TEXT UNIQUE, pid INTEGER, process_start TEXT, worktree TEXT,
  started_ms INTEGER, deadline_ms INTEGER, exit_code INTEGER, pr_url TEXT,
  head_sha TEXT, reason TEXT
);
CREATE TABLE IF NOT EXISTS control (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit (
  seq INTEGER PRIMARY KEY, event TEXT NOT NULL, ref TEXT, details_json TEXT, created_ms INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS manifests (
  event_id TEXT PRIMARY KEY, producer_role TEXT NOT NULL, artifact_sha256 TEXT NOT NULL,
  artifact_bytes INTEGER NOT NULL, source_page_id TEXT, source_reference TEXT,
  manifest_json TEXT NOT NULL, fetched_ms INTEGER
);
CREATE TABLE IF NOT EXISTS cursors (
  producer_role TEXT PRIMARY KEY, committed_token TEXT, pending_token TEXT
);
CREATE TABLE IF NOT EXISTS snapshot_items (
  producer_role TEXT NOT NULL, token TEXT NOT NULL, item_id TEXT NOT NULL, state TEXT NOT NULL,
  PRIMARY KEY (producer_role, token, item_id)
);
CREATE TABLE IF NOT EXISTS index_progress (
  producer_role TEXT NOT NULL, token TEXT NOT NULL, generation INTEGER NOT NULL,
  next_page_number INTEGER NOT NULL, next_descriptor_json TEXT,
  complete INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (producer_role, token)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_exec_active
  ON executions((1)) WHERE state IN ('RESERVED','RUNNING','UNCERTAIN','VERIFYING','INTERRUPTED_HOST','RECOVERING_HOST','RESUMING_HOST');
`;

// The exact ALTER block the pre-atomicity v1->v2 step ran (kept verbatim so a
// synthesized crash image matches what shipped code actually committed).
const V1_TO_V2_ALTERS = `
ALTER TABLE outbox ADD COLUMN sender_boot_id TEXT;
ALTER TABLE outbox ADD COLUMN sender_pid INTEGER;
ALTER TABLE outbox ADD COLUMN sender_start TEXT;
ALTER TABLE executions ADD COLUMN supervisor_boot_id TEXT;
ALTER TABLE executions ADD COLUMN authorized_attempts INTEGER NOT NULL DEFAULT 3;
ALTER TABLE executions ADD COLUMN reserved_total_ms INTEGER NOT NULL DEFAULT 21600000;
ALTER TABLE executions ADD COLUMN attempts_admitted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE executions ADD COLUMN charged_reservation_ms INTEGER NOT NULL DEFAULT 0;
ALTER TABLE executions ADD COLUMN resumptions INTEGER NOT NULL DEFAULT 0;
ALTER TABLE executions ADD COLUMN consecutive_resume_failures INTEGER NOT NULL DEFAULT 0;
ALTER TABLE executions ADD COLUMN last_resume_boot TEXT;
CREATE TABLE IF NOT EXISTS execution_attempts (
  execution_id TEXT NOT NULL, attempt_number INTEGER NOT NULL, boot_id TEXT,
  state TEXT NOT NULL, reserved_ms INTEGER NOT NULL DEFAULT 7200000,
  active_start_ns TEXT, last_active_ns TEXT, measured_active_used_ms INTEGER,
  actual_elapsed_proven INTEGER NOT NULL DEFAULT 0, supervisor_pid INTEGER,
  supervisor_start TEXT, child_pid INTEGER, child_start TEXT, session_id TEXT,
  PRIMARY KEY (execution_id, attempt_number)
);
DROP INDEX IF EXISTS idx_exec_active;
CREATE UNIQUE INDEX idx_exec_active
  ON executions((1)) WHERE state IN ('RESERVED','RUNNING','UNCERTAIN','VERIFYING','INTERRUPTED_HOST','RECOVERING_HOST','RESUMING_HOST');
`;

function buildV1Image(path, { extra = null } = {}) {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA busy_timeout = 5000;');
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec(V1_SCHEMA);
  const t = 500_000;
  const ins = db.prepare(
    'INSERT INTO events (id, sha256, kind, producer, parent_json, payload_json, state, reason, created_ms) VALUES (?,?,?,?,?,?,?,?,?)',
  );
  for (const id of V1_BATCH_IDS) {
    ins.run(id, null, 'batch', CHAT_IDS.collector, '[]', '{}', 'BASELINE_HOLD', 'baseline placeholder: null digest until exact envelope import', t);
  }
  ins.run(V1_INTAKE_ID, null, 'analysis', CHAT_IDS.analyst, '[]', '{}', 'ACCEPTED_CONSUMPTION_UNKNOWN', 'running intake: consumption receipt pending', t);
  db.prepare('INSERT INTO cursors (producer_role, committed_token, pending_token) VALUES (?,?,?)').run('analyst', null, V1_CURSOR);
  db.prepare('INSERT INTO control (key, value) VALUES (?,?)').run('source_sha', V1_SOURCE_SHA);
  db.prepare('INSERT INTO control (key, value) VALUES (?,?)').run('deployment_mode', 'HYBRID');
  // surviving pre-repair content: one SENT delivery with attempts=2 and one
  // held UNCERTAIN execution — both must survive every migration verbatim.
  db.prepare(
    'INSERT INTO outbox (delivery_id, event_id, destination, state, attempts, next_ms, receipt_json, created_ms) VALUES (?,?,?,?,?,?,?,?)',
  ).run('D-F10-1', 'DOT-BATCH-0001', CHAT_IDS.analyst, 'SENT', 2, 0, '{"tool":"fake"}', t + 1);
  db.prepare(
    "INSERT INTO executions (id, solution_id, state, reason) VALUES ('E-F10-1','S-F10-1','UNCERTAIN','host death unproven')",
  ).run();
  if (extra) extra(db);
  db.exec('PRAGMA user_version = 1;');
  db.close();
}

function userVersionOf(path) {
  const db = new DatabaseSync(path);
  try { return db.prepare('PRAGMA user_version').get().user_version; } finally { db.close(); }
}

function columnsOf(path, table) {
  const db = new DatabaseSync(path);
  try { return db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name); } finally { db.close(); }
}

function tableExists(path, table) {
  const db = new DatabaseSync(path);
  try {
    return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type IN ('table','index') AND name = ?").get(table);
  } finally { db.close(); }
}

function countRows(path, table) {
  const db = new DatabaseSync(path);
  try { return db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n; } finally { db.close(); }
}

test('F10 foundation: PRAGMA user_version writes are transactional (rollback discards them)', () => {
  const { ledger, path, dir } = freshLedger();
  ledger.close();
  const db = new DatabaseSync(path);
  db.exec('BEGIN IMMEDIATE;');
  db.exec('ALTER TABLE events ADD COLUMN f10_probe INTEGER;');
  db.exec('PRAGMA user_version = 7;');
  db.exec('ROLLBACK;');
  const v = db.prepare('PRAGMA user_version').get().user_version;
  const cols = db.prepare('PRAGMA table_info(events)').all().map((c) => c.name);
  db.close();
  rmSync(dir, { recursive: true, force: true });
  assert.equal(v, 3, 'a rolled-back transaction must discard the version write');
  assert.ok(!cols.includes('f10_probe'), 'a rolled-back transaction must discard the column');
});

test('F10: fresh initialization commits schema, seeds and user_version in ONE transaction', () => {
  const { ledger, path, dir } = freshLedger();
  ledger.close();
  assert.equal(userVersionOf(path), 3);
  assert.equal(countRows(path, 'events'), 6);
  rmSync(dir, { recursive: true, force: true });
});

test('F10: v0 crash image (schema+seeds committed, version write lost) converges on reopen', () => {
  const { ledger, path, dir } = freshLedger();
  ledger.close();
  // Exact pre-atomicity crash window: everything committed, only the
  // user_version write lost.
  const db = new DatabaseSync(path);
  db.exec('PRAGMA user_version = 0;');
  db.close();
  const reopened = openLedger(path, { now });
  try {
    assert.equal(userVersionOf(path), 3, 'crash image converges to v3 without reseeding');
    assert.equal(countRows(path, 'events'), 6, 'no duplicate seed rows');
    const batches = reopened.getEvent('DOT-BATCH-0001');
  assert.equal(batches.state, 'BASELINE_HOLD');
  } finally {
    reopened.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('F10: v1 crash image (v2 ALTERs committed, version write lost) converges on reopen', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dot-ledger-'));
  const path = join(dir, 'ledger.sqlite');
  buildV1Image(path);
  // Reproduce the exact v1->v2 crash window: ALTERs committed, version lost.
  const db = new DatabaseSync(path);
  db.exec('BEGIN IMMEDIATE;');
  db.exec(V1_TO_V2_ALTERS);
  db.exec('COMMIT;');
  db.close();
  const reopened = openLedger(path, { now });
  try {
    assert.equal(userVersionOf(path), 3, 'crash image converges without re-running ALTERs');
    const out = reopened.getOutbox('D-F10-1');
    assert.equal(out.state, 'SENT');
    assert.equal(out.attempts, 2, 'delivery counters survive convergence');
    assert.equal(out.sender_boot_id, null);
    const exec = reopened.getExecution('E-F10-1');
    assert.equal(exec.state, 'UNCERTAIN', 'execution state survives convergence');
    assert.equal(exec.authorized_attempts, 3, 'v2 default columns were applied exactly once');
  } finally {
    reopened.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('F10: v2 crash image (v3 tables committed, version write lost) converges on reopen', () => {
  const { ledger, path, dir } = freshLedger();
  ledger.close();
  const db = new DatabaseSync(path);
  db.exec('PRAGMA user_version = 2;');
  db.close();
  const reopened = openLedger(path, { now });
  try {
    assert.equal(userVersionOf(path), 3);
    assert.equal(countRows(path, 'events'), 6);
  } finally {
    reopened.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('F10: ambiguous v0 image fails closed with a fixed code and the database is preserved', () => {
  const { ledger, path, dir } = freshLedger();
  ledger.close();
  const db = new DatabaseSync(path);
  db.exec('PRAGMA user_version = 0;');
  db.exec("DELETE FROM events WHERE id = 'DOT-BATCH-0005';");
  db.close();
  let threw = null;
  try { openLedger(path, { now }); } catch (err) { threw = err; }
  rmSync(dir, { recursive: true, force: true });
  assert.ok(threw, 'ambiguous image must be refused');
  assert.equal(threw.code, 'SCHEMA_MIGRATION_BLOCKED', 'fixed migration blocker, not a raw SQLite error');
});

test('F10: ambiguous half-applied v1 image fails closed with a fixed code', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dot-ledger-'));
  const path = join(dir, 'ledger.sqlite');
  buildV1Image(path, { extra: (db) => {
    // half-applied ALTER set: outbox columns present, execution columns absent
    db.exec('BEGIN IMMEDIATE;');
    db.exec('ALTER TABLE outbox ADD COLUMN sender_boot_id TEXT;');
    db.exec('COMMIT;');
  } });
  let threw = null;
  try { openLedger(path, { now }); } catch (err) { threw = err; }
  rmSync(dir, { recursive: true, force: true });
  assert.ok(threw, 'half-applied image must be refused');
  assert.equal(threw.code, 'SCHEMA_MIGRATION_BLOCKED');
});

test('F10: genuine v1 database migrates atomically preserving identities and counters', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dot-ledger-'));
  const path = join(dir, 'ledger.sqlite');
  buildV1Image(path);
  const migrated = openLedger(path, { now });
  try {
    assert.equal(userVersionOf(path), 3);
    // baseline/ACK/protected identities survive
    for (const id of V1_BATCH_IDS) {
      const row = migrated.getEvent(id);
      assert.equal(row.state, 'BASELINE_HOLD');
      assert.equal(row.sha256, null);
    }
    assert.equal(migrated.getEvent(V1_INTAKE_ID).state, 'ACCEPTED_CONSUMPTION_UNKNOWN');
    const out = migrated.getOutbox('D-F10-1');
    assert.equal(out.state, 'SENT');
    assert.equal(out.attempts, 2, 'delivery attempt counter unchanged');
    const exec = migrated.getExecution('E-F10-1');
    assert.equal(exec.state, 'UNCERTAIN', 'uncertain execution is never reset by migration');
    assert.equal(exec.attempts_admitted, 0, 'attempt counters start at the column default, not reset');
    assert.ok(tableExists(path, 'worker_reports') && tableExists(path, 'review_receipts'), 'R10 tables exist');
    assert.ok(columnsOf(path, 'idx_exec_active').length >= 0);
  } finally {
    migrated.close();
  }
  // repeated reopen is a stable no-op
  for (let i = 0; i < 2; i++) {
    const again = openLedger(path, { now });
    again.close();
  }
  assert.equal(userVersionOf(path), 3);
  assert.equal(countRows(path, 'events'), 6);
  rmSync(dir, { recursive: true, force: true });
});

// ------------------------------------------------- F01: ANCESTRY_ACK_BYPASS
// Exactly one parent of the expected kind, or a fixed BLOCKED hold — an empty
// or wrong-kind ancestry must never fall vacuously through the coverage /
// candidate / ACK gates into READY, QUEUED, or COMPLETE_NO_ACTION.

function reseal(e) {
  const { sha256: _omit, ...rest } = e;
  e.sha256 = digest(rest);
  return e;
}

function outboxRowCount(path, eventId) {
  const db = new DatabaseSync(path);
  const n = db.prepare('SELECT COUNT(*) AS n FROM outbox WHERE event_id = ?').get(eventId).n;
  db.close();
  return n;
}

function insertAckedOutboxRow(path, eventId, destination) {
  const db = new DatabaseSync(path);
  db.prepare(
    "INSERT INTO outbox (delivery_id, event_id, destination, state, attempts, next_ms, created_ms) VALUES (?,?,?,'ACKED',0,0,?)",
  ).run(`DOT-RAW-${eventId.slice(0, 24)}`, eventId, destination, nowMs);
  db.close();
}

test('F01: analysis with empty parents is BLOCKED — no vacuous bypass, no outbox', () => {
  const { ledger, path } = freshLedger();
  const batch = batchEnv('DOT-F01-B1', 'f01b1');
  withManifest(ledger, batch);
  ledger.ingest(batch);
  const a = analysisEnv('DOT-F01-A1', batch, { candidates: [] });
  a.parents = [];
  reseal(a);
  const r = ledger.ingest(a);
  assert.equal(r.state, 'BLOCKED');
  assert.match(ledger.getEvent(a.id).reason, /PARENT_COUNT/);
  assert.equal(outboxRowCount(path, a.id), 0, 'ancestry-blocked analysis emits no delivery');
});

test('F01: solution with empty parents is BLOCKED, never QUEUED', () => {
  const { ledger } = freshLedger();
  const batch = batchEnv('DOT-F01-B2', 'f01b2');
  withManifest(ledger, batch);
  ledger.ingest(batch);
  const analysis = analysisEnv('DOT-F01-A2', batch, { candidates: [] });
  ledger.ingest(analysis);
  const s = solutionEnv('DOT-F01-S2', analysis);
  s.parents = [];
  reseal(s);
  const r = ledger.ingest(s);
  assert.equal(r.state, 'BLOCKED');
  assert.match(ledger.getEvent(s.id).reason, /PARENT_COUNT/);
});

test('F01: analysis naming another analysis as parent is BLOCKED even with a matching ACKED delivery', () => {
  const { ledger, path } = freshLedger();
  const batch = batchEnv('DOT-F01-B3', 'f01b3');
  withManifest(ledger, batch);
  ledger.ingest(batch);
  const parentAnalysis = analysisEnv('DOT-F01-A3', batch, { candidates: [] });
  ledger.ingest(parentAnalysis);
  // the exact foreign delivery record the guardless code mistook for
  // parent-batch coverage: parent analysis -> analyst destination, ACKED
  insertAckedOutboxRow(path, parentAnalysis.id, CHAT_IDS.analyst);
  const a = analysisEnv('DOT-F01-A3X', batch, { candidates: [] });
  a.parents = [{ id: parentAnalysis.id, sha256: parentAnalysis.sha256 }];
  reseal(a);
  const r = ledger.ingest(a);
  assert.equal(r.state, 'BLOCKED');
  assert.match(ledger.getEvent(a.id).reason, /PARENT_KIND/);
});

test('F01: solution naming a batch as parent is BLOCKED even with a matching ACKED delivery', () => {
  const { ledger, path } = freshLedger();
  const batch = batchEnv('DOT-F01-B4', 'f01b4');
  withManifest(ledger, batch);
  ledger.ingest(batch);
  insertAckedOutboxRow(path, batch.id, CHAT_IDS.solver);
  const analysis = analysisEnv('DOT-F01-A4', batch, { candidates: [
    { candidate_id: 'C1', finding_keys: ['F1'], report_keys: [reportKey(batch.payload.reports[0])], reviewed_sha: batch.payload.reports[0].reviewed_sha, summary: 's' },
  ] });
  ledger.ingest(analysis);
  const s = solutionEnv('DOT-F01-S4', analysis);
  s.payload.reviewed_sha = batch.payload.reports[0].reviewed_sha;
  s.parents = [{ id: batch.id, sha256: batch.sha256 }];
  reseal(s);
  const r = ledger.ingest(s);
  assert.equal(r.state, 'BLOCKED');
  assert.match(ledger.getEvent(s.id).reason, /PARENT_KIND/);
});

test('F01: valid exact ancestry plus actual ACK still flows; replay adds no second outbox or execution', () => {
  const { ledger, path } = freshLedger();
  const batch = batchEnv('DOT-F01-B5', 'f01b5');
  withManifest(ledger, batch);
  ledger.ingest(batch);
  const db0 = ledger.pendingDeliveries()[0];
  ledger.claimDelivery(db0.delivery_id);
  ledger.ack(ackPayload(db0.delivery_id, batch, publicManifest(batch).sha256), { trustedProducerRole: 'analyst' });
  const cand = { candidate_id: 'C1', finding_keys: ['F1'], report_keys: [reportKey(batch.payload.reports[0])], reviewed_sha: batch.payload.reports[0].reviewed_sha, summary: 's' };
  const analysis = analysisEnv('DOT-F01-A5', batch, { candidates: [cand] });
  const r1 = ledger.ingest(analysis);
  assert.equal(r1.state, 'READY', 'exact ancestry + actual ACK still reaches READY');
  assert.equal(outboxRowCount(path, analysis.id), 1);

  withManifest(ledger, analysis, 'analyst');
  const solution = solutionEnv('DOT-F01-S5', analysis);
  solution.payload.candidate_id = 'C1';
  solution.payload.finding_keys = ['F1'];
  solution.payload.reviewed_sha = cand.reviewed_sha;
  seal(solution);
  const rs1 = ledger.ingest(solution);
  assert.equal(rs1.state, 'WAIT_PARENT_ACK');
  const da = ledger.pendingDeliveries().find((x) => x.event_id === analysis.id && x.destination === CHAT_IDS.solver);
  ledger.claimDelivery(da.delivery_id);
  ledger.ack(ackPayload(da.delivery_id, analysis, publicManifest(analysis, { destination: CHAT_IDS.solver }).sha256), { trustedProducerRole: 'solver' });
  const rs2 = ledger.ingest(solution);
  assert.equal(rs2.state, 'QUEUED', 'solution queues after the parent ACK lands');

  // replay of identical bytes: replay marker, no second outbox, no execution row
  const replayA = ledger.ingest(analysis);
  assert.equal(replayA.replay, true);
  assert.equal(outboxRowCount(path, analysis.id), 1);
  const db = new DatabaseSync(path);
  const execCount = db.prepare('SELECT COUNT(*) AS n FROM executions').get().n;
  db.close();
  assert.equal(execCount, 0, 'ingest/replay never creates executions');
});

test('F01: analysis with two resolved parents is BLOCKED PARENT_COUNT (old code fell through to COMPLETE_NO_ACTION)', () => {
  const { ledger } = freshLedger();
  const b1 = batchEnv('DOT-F01-B6A', 'f01b6a');
  withManifest(ledger, b1);
  ledger.ingest(b1);
  const b2 = batchEnv('DOT-F01-B6B', 'f01b6b');
  withManifest(ledger, b2);
  ledger.ingest(b2);
  const a = analysisEnv('DOT-F01-A6', b1, { candidates: [] });
  a.parents = [
    { id: b1.id, sha256: b1.sha256 },
    { id: b2.id, sha256: b2.sha256 },
  ];
  reseal(a);
  const r = ledger.ingest(a);
  assert.equal(r.state, 'BLOCKED');
  assert.match(ledger.getEvent(a.id).reason, /PARENT_COUNT:expected=1,actual=2/);
});

test('F01: solution with duplicate parents is BLOCKED PARENT_COUNT', () => {
  const { ledger } = freshLedger();
  const batch = batchEnv('DOT-F01-B7', 'f01b7');
  withManifest(ledger, batch);
  ledger.ingest(batch);
  const analysis = analysisEnv('DOT-F01-A7', batch, { candidates: [] });
  ledger.ingest(analysis);
  const s = solutionEnv('DOT-F01-S7', analysis);
  s.parents = [
    { id: analysis.id, sha256: analysis.sha256 },
    { id: analysis.id, sha256: analysis.sha256 },
  ];
  reseal(s);
  const r = ledger.ingest(s);
  assert.equal(r.state, 'BLOCKED');
  assert.match(ledger.getEvent(s.id).reason, /PARENT_COUNT:expected=1,actual=2/);
});

test('F01: analysis with an unknown parent id holds WAIT_PARENT, never routes', () => {
  const { ledger, path } = freshLedger();
  const batch = batchEnv('DOT-F01-B8', 'f01b8');
  const a = analysisEnv('DOT-F01-A8', batch, { candidates: [] });
  a.parents = [{ id: 'DOT-F01-UNKNOWN-PARENT', sha256: '0'.repeat(64) }];
  reseal(a);
  const r = ledger.ingest(a);
  assert.equal(r.state, 'WAIT_PARENT');
  assert.equal(outboxRowCount(path, a.id), 0);
});

test('F01: analysis with a wrong-digest parent holds WAIT_PARENT, never routes', () => {
  const { ledger, path } = freshLedger();
  const batch = batchEnv('DOT-F01-B9', 'f01b9');
  withManifest(ledger, batch);
  ledger.ingest(batch);
  const a = analysisEnv('DOT-F01-A9', batch, { candidates: [] });
  a.parents = [{ id: batch.id, sha256: '1'.repeat(64) }];
  reseal(a);
  const r = ledger.ingest(a);
  assert.equal(r.state, 'WAIT_PARENT');
  assert.equal(outboxRowCount(path, a.id), 0);
});

test('F01: parent delivery merely SENT_ACCEPTED does not satisfy the ACK gate', () => {
  const { ledger, path } = freshLedger();
  const batch = batchEnv('DOT-F01-B10', 'f01b10');
  withManifest(ledger, batch);
  ledger.ingest(batch);
  const db = new DatabaseSync(path);
  db.prepare("UPDATE outbox SET state='SENT_ACCEPTED' WHERE event_id = ? AND destination = ?").run(batch.id, CHAT_IDS.analyst);
  db.close();
  const cand = { candidate_id: 'C1', finding_keys: ['F1'], report_keys: [reportKey(batch.payload.reports[0])], reviewed_sha: batch.payload.reports[0].reviewed_sha, summary: 's' };
  const analysis = analysisEnv('DOT-F01-A10', batch, { candidates: [cand] });
  const r = ledger.ingest(analysis);
  assert.equal(r.state, 'WAIT_PARENT_ACK', 'a send receipt is not an ACK');
});

test('F01: a WAIT_PARENT child re-routes through the same checks when the wrong-kind parent lands', () => {
  const { ledger } = freshLedger();
  const batch = batchEnv('DOT-F01-B11', 'f01b11');
  withManifest(ledger, batch);
  ledger.ingest(batch);
  const other = analysisEnv('DOT-F01-A11X', batch, { candidates: [] });
  // child arrives naming `other` by its exact eventual digest while `other`
  // is still unknown -> WAIT_PARENT hold
  const a = analysisEnv('DOT-F01-A11', batch, { candidates: [] });
  a.parents = [{ id: other.id, sha256: other.sha256 }];
  reseal(a);
  const r1 = ledger.ingest(a);
  assert.equal(r1.state, 'WAIT_PARENT');
  // the "parent" lands and resolves — as an ANALYSIS, not a batch:
  // re-evaluation must route the child through the same structural gate and
  // BLOCK, never fall through to coverage/ACK decisions
  ledger.ingest(other);
  assert.equal(ledger.getEvent(a.id).state, 'BLOCKED');
  assert.match(ledger.getEvent(a.id).reason, /PARENT_KIND/);
});

// ------------------------------------------------- F02: OFF_RESUME_ADMISSION
// Durable OFF must refuse attempt admission INSIDE the admission transaction:
// zero new attempts, zero reservation charge, zero state change. The OFF
// marker is the operator's stop intent — nothing may admit past it.

test('F02: durable OFF refuses admitNextAttempt — no attempt, no charge, no state change', () => {
  const { ledger } = freshLedger();
  const { claim } = claimedExecution(ledger);
  ledger.reconcileHost({ bootId: 'BOOT-2', processProbe: () => ({ alive: false, start: null }), controlActor: 'scheduler-tick' });
  ledger.setOff({ reason: 'operator stop' });
  const before = ledger.getExecution(claim.execution_id);
  const r = ledger.admitNextAttempt({
    executionId: claim.execution_id, bootId: 'BOOT-2',
    supervisor: { pid: 701, start: 'Tue Oct  7 09:00:00 2026' },
    sessionId: claim.session_id, purpose: 'resume',
  });
  assert.equal(r.admitted, false);
  assert.equal(r.code, 'OFF');
  const after = ledger.getExecution(claim.execution_id);
  assert.equal(after.attempts_admitted, before.attempts_admitted, 'no attempt admitted past OFF');
  assert.equal(after.charged_reservation_ms, before.charged_reservation_ms, 'no reservation charged past OFF');
  assert.equal(after.resumptions, before.resumptions);
  assert.equal(after.state, before.state, 'active row untouched by the refusal');
  assert.equal(ledger.getAttempt(claim.execution_id, before.attempts_admitted + 1), null, 'no attempt row inserted');
});

// ------------------------------------------------- F03: PROCESS_UNKNOWN_AS_DEAD
// The process probe is THREE-way: exact-live, documented absence, unknown.
// Only a documented no-such-process result is absence; a thrown, malformed or
// empty probe ({}) is UNKNOWN and every consumer holds — no slot free, no
// replacement admitted, no takeover on unproven evidence.

test('F03: reconcileHost holds on a malformed/throwing SUPERVISOR probe — never adopt or interrupt', () => {
  const arms = [
    () => ({}), // malformed: alive neither true nor false
    () => { throw Object.assign(new Error('ps EACCES'), { code: 'EACCES' }); },
  ];
  for (const badProbe of arms) {
    const { ledger } = freshLedger();
    const { claim } = claimedExecution(ledger);
    ledger.updateExecution(claim.execution_id, { state: 'RUNNING', pid: 601, process_start: CHILD_START });
    ledger.updateAttempt(claim.execution_id, 1, { state: 'RUNNING', child_pid: 601, child_start: CHILD_START });
    const r = ledger.reconcileHost({
      bootId: 'BOOT-1',
      // supervisor 501 probes malformed/throws; the child is exact-live with a
      // matching session — the OLD code concluded adopt-monitor off an unproven
      // supervisor death.
      processProbe: (pid) => (Number(pid) === 601 ? { alive: true, start: CHILD_START } : badProbe(pid)),
      sessionProbe: () => [{ session_id: claim.session_id, pid: 601 }],
      controlActor: 'scheduler-tick',
    });
    assert.deepEqual(r.executions.map((e) => e.decision), ['uncertain-identity']);
    const row = ledger.getExecution(claim.execution_id);
    assert.equal(row.state, 'UNCERTAIN');
    assert.equal(row.reason, 'UNCERTAIN_IDENTITY');
    assert.notEqual(row.state, 'RECOVERING_HOST'); // no monitor admitted on unknown
    ledger.close();
  }
});

test('F03: reconcileHost holds an unknown CHILD probe as uncertain-identity — never uncertain-stop', () => {
  const { ledger } = freshLedger();
  const { claim } = claimedExecution(ledger);
  ledger.updateExecution(claim.execution_id, { state: 'RUNNING', pid: 601, process_start: CHILD_START });
  ledger.updateAttempt(claim.execution_id, 1, { state: 'RUNNING', child_pid: 601, child_start: CHILD_START });
  const r = ledger.reconcileHost({
    bootId: 'BOOT-1',
    // supervisor documented-absent (real no-such-process), child probe malformed
    processProbe: (pid) => (Number(pid) === 501 ? { alive: false, start: null } : {}),
    controlActor: 'scheduler-tick',
  });
  assert.deepEqual(r.executions.map((e) => e.decision), ['uncertain-identity']);
  const row = ledger.getExecution(claim.execution_id);
  assert.equal(row.state, 'UNCERTAIN');
  assert.equal(row.reason, 'UNCERTAIN_IDENTITY'); // NOT UNCERTAIN_STOP: death never proven
  ledger.close();
});

test('F03: reconcileHost documented child absence stays uncertain-stop (positive path unchanged)', () => {
  const { ledger } = freshLedger();
  const { claim } = claimedExecution(ledger);
  ledger.updateExecution(claim.execution_id, { state: 'RUNNING', pid: 601, process_start: CHILD_START });
  ledger.updateAttempt(claim.execution_id, 1, { state: 'RUNNING', child_pid: 601, child_start: CHILD_START });
  const r = ledger.reconcileHost({
    bootId: 'BOOT-1',
    processProbe: () => ({ alive: false, start: null }), // documented no-such-process for both
    controlActor: 'scheduler-tick',
  });
  assert.deepEqual(r.executions.map((e) => e.decision), ['uncertain-stop']);
  const row = ledger.getExecution(claim.execution_id);
  assert.equal(row.state, 'UNCERTAIN');
  assert.equal(row.reason, 'UNCERTAIN_STOP');
  ledger.close();
});

test('F03: held tick with a malformed/throwing owner probe refuses owner-unproven — no dead-owner takeover', () => {
  const { ledger } = freshLedger();
  const t1 = ledger.beginSchedulerTick({ bootId: 'BOOT-1', token: 'tok-f03-hold', owner: { pid: 501, start: SUP_START } });
  assert.equal(t1.due, true);
  const t2 = ledger.beginSchedulerTick({
    bootId: 'BOOT-1', token: 'tok-f03-badobj',
    processProbe: () => ({}),
  });
  assert.equal(t2.refused, 'owner-unproven', 'malformed probe must refuse, never take over');
  assert.equal(t2.due, undefined);
  const t3 = ledger.beginSchedulerTick({
    bootId: 'BOOT-1', token: 'tok-f03-badthrow',
    processProbe: () => { throw Object.assign(new Error('ps EIO'), { code: 'EIO' }); },
  });
  assert.equal(t3.refused, 'owner-unproven', 'a throwing probe must refuse, never crash the tick');
  assert.equal(t3.due, undefined);
  // the original owner still completes — its lock was never stolen
  const done = ledger.completeSchedulerTick({ bootId: 'BOOT-1', token: 'tok-f03-hold', owner: { pid: 501, start: SUP_START }, plannedOk: true });
  assert.equal(done.recorded, true);
  ledger.close();
});

// ------------------------------------------------- F06: ADOPT_ATTEMPT_CAPTURE
// The adoption monitor's exclusive ownership is DURABLY recorded on the
// current attempt row (supervisor pid + process start), and adoption itself
// is bookkeeping-free: attempts_admitted is never mutated and no attempt row
// is ever created by monitoring.

test('F06: updateAttempt durably records the adopting supervisor identity on the current attempt', () => {
  const { ledger, path, dir } = freshLedger();
  const { claim } = claimedExecution(ledger, { sessionId: 'f06a0000-0000-4000-8000-000000000001' });
  const MON_START = 'Mon Oct  6 12:00:00 2026';
  ledger.updateExecution(claim.execution_id, { state: 'RECOVERING_HOST', pid: 702, process_start: 'Mon Oct  6 11:02:00 2026' });
  ledger.updateAttempt(claim.execution_id, 1, { state: 'RUNNING', boot_id: 'BOOT-1', child_pid: 702, child_start: 'Mon Oct  6 11:02:00 2026' });
  // the adopting monitor claims the supervisor slot and records its identity
  ledger.updateAttempt(claim.execution_id, 1, { supervisor_pid: 501, supervisor_start: MON_START });
  const attempt = ledger.getAttempt(claim.execution_id, 1);
  assert.equal(attempt.supervisor_pid, 501);
  assert.equal(attempt.supervisor_start, MON_START);
  assert.equal(attempt.child_pid, 702, 'child identity untouched by the ownership write');
  // durable: a FRESH connection reads the same recorded owner
  ledger.close();
  const reopened = openLedger(path);
  const reread = reopened.getAttempt(claim.execution_id, 1);
  assert.equal(reread.supervisor_pid, 501);
  assert.equal(reread.supervisor_start, MON_START);
  reopened.close();
  rmSync(dir, { recursive: true, force: true });
});

test('F06: adoption bookkeeping never mutates attempts_admitted and never creates attempt rows', () => {
  const { ledger, path, dir } = freshLedger();
  const { claim } = claimedExecution(ledger, { sessionId: 'f06b0000-0000-4000-8000-000000000002' });
  ledger.updateExecution(claim.execution_id, { state: 'RECOVERING_HOST', pid: 702, process_start: 'Mon Oct  6 11:02:00 2026' });
  ledger.updateAttempt(claim.execution_id, 1, { state: 'RUNNING', boot_id: 'BOOT-1', child_pid: 702, child_start: 'Mon Oct  6 11:02:00 2026' });
  // monitoring-only transitions (UNCERTAIN hold / REQUIRES_REVIEW finish)
  ledger.updateAttempt(claim.execution_id, 1, { state: 'REQUIRES_REVIEW', measured_active_used_ms: 5 });
  ledger.updateExecution(claim.execution_id, { state: 'REQUIRES_REVIEW', pr_url: 'https://github.com/artyhoo/getff/pull/2222' });
  const row = ledger.getExecution(claim.execution_id);
  assert.equal(row.attempts_admitted, 1, 'monitoring consumed no reservation');
  const db = new DatabaseSync(path);
  const n = db.prepare('SELECT COUNT(*) AS c FROM execution_attempts WHERE execution_id = ?').get(claim.execution_id).c;
  db.close();
  assert.equal(n, 1, 'no attempt row was ever created by monitoring');
  ledger.close();
  rmSync(dir, { recursive: true, force: true });
});
