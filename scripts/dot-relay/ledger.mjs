// Dot relay transactional ledger — DESIGN.md §Ledger + durable manifest/cursor
// closure + multipart/index amendments.
//
// SQLite (node:sqlite), synchronous, every mutating method wrapped in
// BEGIN IMMEDIATE with rollback on error. Crash-safety rests on transactions:
// accepted event transitions and outbox inserts land in ONE transaction.
// Pattern reuse from scripts/dot-review-gate/ledger.mjs (transactional outbox);
// the domain schema here is separate — Dot's live DB is never opened.
//
// Privacy: audit and status emit fixed codes and ids only — never report
// bodies, analysis prose, kickoff text or secrets (opaque amendment).

import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { sha256Hex } from '../dot-review-gate/digest.mjs';
import { canonical, digest as canonicalDigest, CHAT_IDS, validateSolution } from './contract.mjs';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  sha256 TEXT,
  kind TEXT NOT NULL,
  producer TEXT NOT NULL,
  parent_json TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  state TEXT NOT NULL,
  reason TEXT,
  created_ms INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS reports (
  report_key TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  body_sha256 TEXT
);
CREATE TABLE IF NOT EXISTS outbox (
  delivery_id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  destination TEXT NOT NULL,
  state TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_ms INTEGER NOT NULL DEFAULT 0,
  receipt_json TEXT,
  created_ms INTEGER NOT NULL,
  sender_boot_id TEXT,
  sender_pid INTEGER,
  sender_start TEXT,
  UNIQUE(event_id, destination)
);
CREATE TABLE IF NOT EXISTS executions (
  id TEXT PRIMARY KEY,
  solution_id TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL,
  session_id TEXT UNIQUE,
  pid INTEGER,
  process_start TEXT,
  worktree TEXT,
  started_ms INTEGER,
  deadline_ms INTEGER,
  exit_code INTEGER,
  pr_url TEXT,
  head_sha TEXT,
  reason TEXT,
  supervisor_boot_id TEXT,
  authorized_attempts INTEGER NOT NULL DEFAULT 3,
  reserved_total_ms INTEGER NOT NULL DEFAULT 21600000,
  attempts_admitted INTEGER NOT NULL DEFAULT 0,
  charged_reservation_ms INTEGER NOT NULL DEFAULT 0,
  resumptions INTEGER NOT NULL DEFAULT 0,
  consecutive_resume_failures INTEGER NOT NULL DEFAULT 0,
  last_resume_boot TEXT
);
CREATE TABLE IF NOT EXISTS execution_attempts (
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_exec_active
  ON executions((1)) WHERE state IN ('RESERVED','RUNNING','UNCERTAIN','VERIFYING','INTERRUPTED_HOST','RECOVERING_HOST','RESUMING_HOST');
CREATE TABLE IF NOT EXISTS control (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit (
  seq INTEGER PRIMARY KEY,
  event TEXT NOT NULL,
  ref TEXT,
  details_json TEXT,
  created_ms INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS manifests (
  event_id TEXT PRIMARY KEY,
  producer_role TEXT NOT NULL,
  artifact_sha256 TEXT NOT NULL,
  artifact_bytes INTEGER NOT NULL,
  source_page_id TEXT,
  source_reference TEXT,
  manifest_json TEXT NOT NULL,
  fetched_ms INTEGER
);
CREATE TABLE IF NOT EXISTS cursors (
  producer_role TEXT PRIMARY KEY,
  committed_token TEXT,
  pending_token TEXT
);
CREATE TABLE IF NOT EXISTS snapshot_items (
  producer_role TEXT NOT NULL,
  token TEXT NOT NULL,
  item_id TEXT NOT NULL,
  state TEXT NOT NULL,
  PRIMARY KEY (producer_role, token, item_id)
);
CREATE TABLE IF NOT EXISTS index_progress (
  producer_role TEXT NOT NULL,
  token TEXT NOT NULL,
  generation INTEGER NOT NULL,
  next_page_number INTEGER NOT NULL,
  next_descriptor_json TEXT,
  complete INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (producer_role, token)
);
-- R03: durable index page identity + in-progress generations + imported-receipt
-- outbox. Page identity (producer_role, generation, page_number) with its
-- committed source digest: same digest -> replay no-op, different digest ->
-- the whole generation is quarantined (hold, never overwrite). The trusted
-- snapshot cursor (tool receipt) is bound to the generation at first import
-- and commits ONLY when the reachable chain completes.
CREATE TABLE IF NOT EXISTS index_generations (
  producer_role TEXT NOT NULL,
  generation TEXT NOT NULL,
  first_seen_ms INTEGER NOT NULL,
  snapshot_cursor TEXT,
  next_page_number INTEGER NOT NULL,
  next_descriptor_json TEXT,
  complete INTEGER NOT NULL DEFAULT 0,
  quarantined INTEGER NOT NULL DEFAULT 0,
  quarantined_reason TEXT,
  PRIMARY KEY (producer_role, generation)
);
CREATE TABLE IF NOT EXISTS index_pages (
  producer_role TEXT NOT NULL,
  generation TEXT NOT NULL,
  page_number INTEGER NOT NULL,
  source_sha256 TEXT NOT NULL,
  source_bytes INTEGER NOT NULL,
  imported_ms INTEGER NOT NULL,
  PRIMARY KEY (producer_role, generation, page_number)
);
CREATE TABLE IF NOT EXISTS receipt_outbox (
  receipt_id TEXT PRIMARY KEY,
  producer_role TEXT NOT NULL,
  generation TEXT NOT NULL,
  page_number INTEGER NOT NULL,
  source_sha256 TEXT NOT NULL,
  prompt TEXT NOT NULL,
  destination TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'PENDING',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_ms INTEGER NOT NULL DEFAULT 0,
  receipt_json TEXT,
  created_ms INTEGER NOT NULL,
  sender_boot_id TEXT,
  sender_pid INTEGER,
  sender_start TEXT,
  UNIQUE (producer_role, generation, page_number, source_sha256)
);
`;

const KNOWN_BATCHES = ['DOT-BATCH-0001', 'DOT-BATCH-0002', 'DOT-BATCH-0003', 'DOT-BATCH-0004', 'DOT-BATCH-0005'];
const INTAKE_ID = 'DOT-INTAKE-20261008-01';
const INITIAL_ANALYST_CURSOR = 'b80b6957-cf4d-434a-9581-33008606603b:5';
const SOURCE_SHA = '35738554faf029e9fe3b8b4c25bfdde242f65c66';
const PLAN_LIMIT = 32 * 1024;
const TICK_PAGE_BUDGET = 10;

// HOST-RESILIENCE §4: slot-holding states. INTERRUPTED_HOST / RECOVERING_HOST /
// RESUMING_HOST keep the single-execution slot occupied (no second claim, no
// second GLM) — an interrupted row is resume-ELIGIBLE, never slot-free.
const ACTIVE_STATES = ['RESERVED', 'RUNNING', 'UNCERTAIN', 'VERIFYING', 'INTERRUPTED_HOST', 'RECOVERING_HOST', 'RESUMING_HOST'];
const ACTIVE_IN = `('${ACTIVE_STATES.join("','")}')`;
// admitNextAttempt refuses while one of these holds the slot in progress;
// INTERRUPTED_HOST is the ONE resume-eligible state. UNCERTAIN is handled in
// JS (R07): terminal unless the caller supplies FRESH verified-dead evidence
// for a same-boot crash (reason UNCERTAIN_STOP) — never guessed.
const RESUME_BLOCKED_STATES = new Set(['RESERVED', 'RUNNING', 'VERIFYING', 'RESUMING_HOST', 'RECOVERING_HOST']);
// Precharged recovery allowance: 3 attempts x 2h host-awake per NEW execution,
// reserved BEFORE spawn, nonrefundable (HOST-RESILIENCE §4 precharged ledger).
const ATTEMPT_RESERVED_MS = 7_200_000;
const AUTHORIZED_ATTEMPTS = 3;
const RESERVED_TOTAL_MS = AUTHORIZED_ATTEMPTS * ATTEMPT_RESERVED_MS;
// Calendar scheduler: 4h slot grid (launchd StartCalendarInterval 0/4/8/12/16/20).
const TICK_PERIOD_MS = 4 * 3600 * 1000;
// R06: the due grid is LOCAL launchd slots — a host at UTC+3 fires at local
// midnight/04:00/..., never on the raw UTC epoch grid. DST transitions
// resolve through local calendar setters.
const TICK_SLOT_HOURS = [0, 4, 8, 12, 16, 20];

export function defaultNextLocalSlotAfter(ms) {
  const d = new Date(ms);
  d.setSeconds(0, 0);
  d.setMinutes(0);
  for (let guard = 0; guard < 8; guard++) {
    for (const h of TICK_SLOT_HOURS) {
      const c = new Date(d);
      c.setHours(h, 0, 0, 0);
      if (c.getTime() > ms) return c.getTime(); // strictly AFTER, so an exact boundary rolls to the next slot
    }
    d.setHours(0, 0, 0, 0);
    d.setTime(d.getTime() + 24 * 3600 * 1000);
  }
  return ms + TICK_PERIOD_MS; // unreachable for any finite input
}

// R06: parse a tick_in_progress value into an owner record. Legacy pre-R06
// values are bare token strings — identity-free, flagged legacy so the
// classifier refuses to guess on them.
function parseTickOwner(raw) {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw);
      if (o && typeof o === 'object' && typeof o.token === 'string') return o;
    } catch { /* legacy bare token */ }
    return { token: raw, boot_id: null, pid: null, start: null, legacy: true };
  }
  return null;
}

// R06 exclusive-ownership classifier for a held in-progress tick:
// 'live' (refuse — a proven-live owner), 'unproven' (refuse — identity cannot
// be proven), or a takeover reason ('previous-boot' / 'pid-reused' /
// 'dead-owner'). Identity IS the boot: a holder from a previous boot can never
// exist on this one regardless of pid text.
function tickOwnerTakeover(held, bootId, processProbe) {
  if (held.legacy || held.boot_id == null || held.pid == null) return 'unproven';
  if (held.boot_id !== bootId) return 'previous-boot';
  if (typeof processProbe !== 'function') return 'unproven';
  const probe = processProbe(held.pid);
  if (!probe || typeof probe !== 'object') return 'unproven';
  if (probe.alive) {
    if (held.start == null || probe.start == null) return 'unproven';
    return probe.start === held.start ? 'live' : 'pid-reused';
  }
  return 'dead-owner';
}

function ledgerError(code, message) {
  const e = new Error(`[${code}] ${message}`);
  e.code = code;
  return e;
}

const HASH64_RE = /^[0-9a-f]{64}$/;
const GEN_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/;

// Concurrent writers (e.g. overlapping ticks) can hold the write lock longer
// than one busy_timeout under load — a single-attempt BEGIN IMMEDIATE then
// throws "database is locked" and crashes the CLI process with empty stdout
// (observed flake 2026-10-08). BEGIN/COMMIT retry on busy up to a bounded
// TOTAL budget (attempts x busy_timeout); the transaction body itself is
// never re-run — if BEGIN succeeds, fn executes exactly once.
const BUSY_ATTEMPTS = 6;

function isBusyError(err) {
  return /database is locked|SQLITE_BUSY/i.test(`${err?.errstr ?? ''} ${err?.message ?? ''}`);
}

function beginImmediate(db, attempts = BUSY_ATTEMPTS) {
  for (let i = 0; ; i++) {
    try {
      db.exec('BEGIN IMMEDIATE;');
      return;
    } catch (err) {
      if (!isBusyError(err) || i + 1 >= attempts) throw err;
    }
  }
}

function commitTx(db, attempts = BUSY_ATTEMPTS) {
  for (let i = 0; ; i++) {
    try {
      db.exec('COMMIT;');
      return;
    } catch (err) {
      if (!isBusyError(err) || i + 1 >= attempts) throw err;
    }
  }
}

function rollbackQuiet(db) {
  try {
    db.exec('ROLLBACK;');
  } catch {
    /* nothing to roll back (BEGIN itself failed) */
  }
}

function execWithBusyRetry(db, sql, attempts = BUSY_ATTEMPTS) {
  for (let i = 0; ; i++) {
    try {
      return db.exec(sql);
    } catch (err) {
      if (!isBusyError(err) || i + 1 >= attempts) throw err;
    }
  }
}

export function openLedger(path, {
  now = () => Date.now(), faultAfter = null, resumeReserved = null,
  nextLocalSlotAfter = defaultNextLocalSlotAfter, // R06: injectable local-slot resolver
} = {}) {
  const db = new DatabaseSync(path);
  // busy_timeout FIRST: the WAL-mode pragma below can contend on concurrent
  // first opens (SHM creation/recovery) — every lock wait must be bounded and
  // retried, or the CLI process crashes with empty stdout (observed flake).
  db.exec('PRAGMA busy_timeout = 5000;');
  execWithBusyRetry(db, 'PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  const version = db.prepare('PRAGMA user_version').get().user_version;
  if (version === 0) {
    beginImmediate(db);
    try {
      db.exec(SCHEMA);
      const t = now();
      const seedEvent = db.prepare(
        'INSERT INTO events (id, sha256, kind, producer, parent_json, payload_json, state, reason, created_ms) VALUES (?,?,?,?,?,?,?,?,?)',
      );
      for (const id of KNOWN_BATCHES) {
        seedEvent.run(id, null, 'batch', CHAT_IDS.collector, '[]', '{}', 'BASELINE_HOLD', 'baseline placeholder: null digest until exact envelope import', t);
      }
      seedEvent.run(INTAKE_ID, null, 'analysis', CHAT_IDS.analyst, '[]', '{}', 'ACCEPTED_CONSUMPTION_UNKNOWN', 'running intake: consumption receipt pending', t);
      db.prepare('INSERT INTO cursors (producer_role, committed_token, pending_token) VALUES (?,?,?)').run('analyst', null, INITIAL_ANALYST_CURSOR);
      db.prepare('INSERT OR REPLACE INTO control (key, value) VALUES (?,?)').run('source_sha', SOURCE_SHA);
      db.prepare('INSERT OR REPLACE INTO control (key, value) VALUES (?,?)').run('deployment_mode', 'HYBRID');
      commitTx(db);
    } catch (err) {
      rollbackQuiet(db);
      db.close();
      throw err;
    }
    db.exec('PRAGMA user_version = 2;');
  } else if (version === 1) {
    // v1 -> v2 (HOST-RESILIENCE): precharged attempts table, execution
    // reservation columns, outbox sender identity, extended active-slot index.
    // Additive only — no existing row is rewritten.
    beginImmediate(db);
    try {
      db.exec(`
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
      `);
      commitTx(db);
    } catch (err) {
      rollbackQuiet(db);
      db.close();
      throw err;
    }
    db.exec('PRAGMA user_version = 2;');
  } else if (version !== 2) {
    db.close();
    throw ledgerError('SCHEMA_VERSION', `unsupported user_version ${version}; refusing to start (no auto-migration)`);
  }

  // R05: event-conflict quarantine register. Additive table, created
  // idempotently on every open (fresh AND existing v2 databases) — no column
  // of an existing table changes, so no user_version bump is warranted.
  execWithBusyRetry(db, `
    CREATE TABLE IF NOT EXISTS event_conflicts (
      event_id TEXT NOT NULL,
      original_sha256 TEXT NOT NULL,
      conflicting_sha256 TEXT NOT NULL,
      first_seen_ms INTEGER NOT NULL,
      occurrences INTEGER NOT NULL DEFAULT 1,
      resolved_ms INTEGER,
      resolved_by TEXT,
      disposition TEXT,
      PRIMARY KEY (event_id, conflicting_sha256)
    );
  `);

  // HOST-RESILIENCE §2: openLedger is READ-ONLY about peer state. The blanket
  // restart reconciliation is gone — a CLAIMED delivery or an in-flight
  // execution is never rewritten on open; only an explicit reconcileHost()
  // with boot/process/session evidence decides. `resumeReserved` stays in the
  // signature for CLI compatibility and is deliberately unused.

  const api = {
    now,
    faultAfter,
    close: () => db.close(),

    _fault(name) {
      if (faultAfter === name) throw ledgerError('FAULT', name);
    },

    _tx(fn) {
      beginImmediate(db);
      try {
        const out = fn();
        commitTx(db);
        return out;
      } catch (err) {
        rollbackQuiet(db);
        throw err;
      }
    },

    _audit(event, ref, details) {
      db.prepare('INSERT INTO audit (event, ref, details_json, created_ms) VALUES (?,?,?,?)').run(event, ref ?? null, JSON.stringify(details ?? {}), now());
    },

    getEvent(id) {
      return db.prepare('SELECT * FROM events WHERE id = ?').get(id) ?? null;
    },

    getOutbox(deliveryId) {
      return db.prepare('SELECT * FROM outbox WHERE delivery_id = ?').get(deliveryId) ?? null;
    },

    getExecution(id) {
      return db.prepare('SELECT * FROM executions WHERE id = ?').get(id) ?? null;
    },

    getManifest(eventId) {
      return db.prepare('SELECT * FROM manifests WHERE event_id = ?').get(eventId) ?? null;
    },

    // First claimable solution in creation order: QUEUED and never attempted
    // (executions.solution_id is UNIQUE — one attempt per solution, ever).
    // R05: a solution whose identity chain crosses a quarantined conflict is
    // never admitted — executor work on a conflicted ancestry is held.
    // This is what tick may reserve + hand to a detached supervise child.
    nextClaimableSolution() {
      const rows = db.prepare(
        `SELECT e.* FROM events e
         WHERE e.kind = 'solution' AND e.state = 'QUEUED'
           AND NOT EXISTS (SELECT 1 FROM executions x WHERE x.solution_id = e.id)
         ORDER BY e.created_ms LIMIT 50`,
      ).all();
      return rows.find((r) => !api._conflictBlocked(r.id)) ?? null;
    },

    // R05: is this event identity (or any ancestor within a bounded depth)
    // held by an UNRESOLVED digest conflict? Quarantine never clears by age —
    // only an explicit conflictResolve disposition lifts it.
    _conflictBlocked(eventId, depth = 0) {
      if (typeof eventId !== 'string') return false;
      if (depth > 8) return true; // unbounded ancestry: conservative hold
      const held = db.prepare(
        'SELECT 1 FROM event_conflicts WHERE event_id = ? AND resolved_ms IS NULL LIMIT 1',
      ).get(eventId);
      if (held) return true;
      const ev = db.prepare('SELECT parent_json FROM events WHERE id = ?').get(eventId);
      if (!ev) return false;
      let parents;
      try { parents = JSON.parse(ev.parent_json || '[]'); } catch { parents = []; }
      for (const p of parents ?? []) {
        if (p && typeof p.id === 'string' && api._conflictBlocked(p.id, depth + 1)) return true;
      }
      return false;
    },

    _isOff() {
      return db.prepare("SELECT value FROM control WHERE key = 'off'").get()?.value === '1';
    },

    setOff({ reason }) {
      return api._tx(() => {
        db.prepare("INSERT OR REPLACE INTO control (key, value) VALUES ('off','1')").run();
        api._audit('OFF', null, { reason });
        return { off: true };
      });
    },

    // ------------------------------------------------------------- deliveries

    pendingDeliveries() {
      return db
        .prepare("SELECT * FROM outbox WHERE state = 'PENDING' AND next_ms <= ? ORDER BY created_ms LIMIT 10")
        .all(now())
        .filter((row) => !api._conflictBlocked(row.event_id))
        .map((row) => ({ ...row, artifact_sha256: api._artifactFor(row.event_id) }));
    },

    // R04: the ACK artifact authority is the REGISTERED public manifest only.
    // No manifest -> null -> every ACK on that event is a mismatch: there is
    // no synthetic payload-digest fallback to lean on.
    _artifactFor(eventId) {
      const m = db.prepare('SELECT artifact_sha256 FROM manifests WHERE event_id = ?').get(eventId);
      return m ? m.artifact_sha256 : null;
    },

    // sender: {boot_id, pid, start} — durable send-process identity so a later
    // reconcileHost can PROVE the claiming process dead before UNCERTAIN.
    claimDelivery(deliveryId, { sender = null } = {}) {
      return api._tx(() => {
        if (api._isOff()) throw ledgerError('OFF', 'admissions blocked by durable OFF');
        const row = db.prepare('SELECT * FROM outbox WHERE delivery_id = ?').get(deliveryId);
        if (!row) throw ledgerError('UNKNOWN_DELIVERY', deliveryId);
        if (api._conflictBlocked(row.event_id)) throw ledgerError('CONFLICT_HELD', `${row.event_id} quarantined by digest conflict`);
        if (row.state !== 'PENDING') throw ledgerError('DELIVERY_STATE', `${deliveryId} in ${row.state}`);
        if (row.next_ms > now()) throw ledgerError('DELIVERY_NOT_DUE', `${deliveryId} next_ms ${row.next_ms}`);
        // Persist CLAIMED (with sender identity) BEFORE any tool invocation
        // side effect.
        db.prepare("UPDATE outbox SET state='CLAIMED', sender_boot_id=?, sender_pid=?, sender_start=? WHERE delivery_id = ?").run(
          sender?.boot_id ?? null, sender?.pid ?? null, sender?.start ?? null, deliveryId,
        );
        const manifest = db.prepare('SELECT * FROM manifests WHERE event_id = ?').get(row.event_id);
        let parts = null;
        if (manifest) {
          const mj = JSON.parse(manifest.manifest_json);
          if (mj.artifact && Array.isArray(mj.artifact.parts)) parts = mj.artifact.parts;
        }
        return {
          delivery_id: deliveryId,
          event_id: row.event_id,
          destination: row.destination,
          state: 'CLAIMED',
          artifact_sha256: api._artifactFor(row.event_id),
          artifact_path: join('objects', `${api._artifactFor(row.event_id)}.json`),
          source_page_id: manifest?.source_page_id ?? null,
          source_reference: manifest?.source_reference ?? null,
          parts,
        };
      });
    },

    // status: 'sent' | 'not-sent' | 'uncertain' (adapter-recorded tool receipt)
    receipt(deliveryId, { status, receipt }) {
      return api._tx(() => {
        const row = db.prepare('SELECT * FROM outbox WHERE delivery_id = ?').get(deliveryId);
        if (!row) throw ledgerError('UNKNOWN_DELIVERY', deliveryId);
        if (row.state !== 'CLAIMED') throw ledgerError('DELIVERY_STATE', `${deliveryId} in ${row.state}`);
        const receiptJson = JSON.stringify({ status, receipt, at: now() });
        if (status === 'sent') {
          db.prepare("UPDATE outbox SET state='SENT_ACCEPTED', receipt_json=? WHERE delivery_id=?").run(receiptJson, deliveryId);
          return { state: 'SENT_ACCEPTED' };
        }
        if (status === 'uncertain') {
          // Ambiguous result: NEVER auto-retry; only a matching destination ACK clears it.
          db.prepare("UPDATE outbox SET state='UNCERTAIN', receipt_json=? WHERE delivery_id=?").run(receiptJson, deliveryId);
          return { state: 'UNCERTAIN' };
        }
        if (status === 'not-sent') {
          // Explicit pre-send failure: bounded retry +4h, +8h, then BLOCKED.
          const attempts = row.attempts + 1;
          if (attempts >= 3) {
            db.prepare("UPDATE outbox SET state='BLOCKED', attempts=?, receipt_json=? WHERE delivery_id=?").run(attempts, receiptJson, deliveryId);
            api._audit('DELIVERY_BLOCKED', deliveryId, { attempts });
            return { state: 'BLOCKED' };
          }
          const backoffMs = attempts === 1 ? 4 * 3600 * 1000 : 8 * 3600 * 1000;
          db.prepare("UPDATE outbox SET state='PENDING', attempts=?, next_ms=?, receipt_json=? WHERE delivery_id=?").run(attempts, now() + backoffMs, receiptJson, deliveryId);
          return { state: 'PENDING', next_ms: now() + backoffMs };
        }
        throw ledgerError('RECEIPT_STATUS', String(status));
      });
    },

    // ACK from the destination: actual byte/hash acknowledgment, never a link.
    // R04: the trusted producer role rides along when the caller identity is
    // configured — a wrong-role ACK must hold, never ACKED.
    ack(payload, { trustedProducerRole } = {}) {
      return api._tx(() => api._ackInTx(payload, { trustedProducerRole }));
    },

    // R04: every ACK entry point receives the TRUSTED producerRole from the
    // configured caller identity and it must equal the persisted outbox
    // destination — a wrong-role ACK is a hold, never ACKED.
    _ackInTx(payload, { trustedProducerRole } = {}) {
      {
        if (typeof payload !== 'object' || payload === null) throw ledgerError('ACK_SHAPE', 'not an object');
        const { delivery_id, event_id, event_sha256, artifact_sha256, accepted, destination } = payload;
        if (!HASH64_RE.test(String(event_sha256 ?? '')) || !HASH64_RE.test(String(artifact_sha256 ?? ''))) {
          throw ledgerError('ACK_SHAPE', 'digests');
        }
        if (accepted !== true) throw ledgerError('ACK_SHAPE', 'accepted');
        const row = db.prepare('SELECT * FROM outbox WHERE delivery_id = ?').get(delivery_id);
        if (!row) throw ledgerError('UNKNOWN_DELIVERY', String(delivery_id));
        if (row.event_id !== event_id) throw ledgerError('ACK_MISMATCH', 'event_id');
        if (destination !== undefined && destination !== row.destination) throw ledgerError('ACK_MISMATCH', 'destination');
        if (trustedProducerRole !== undefined && CHAT_IDS[trustedProducerRole] !== row.destination) {
          throw ledgerError('ACK_ROLE_MISMATCH', `trusted ${trustedProducerRole} != outbox destination`);
        }
        const ev = db.prepare('SELECT sha256 FROM events WHERE id = ?').get(event_id);
        if (!ev || ev.sha256 !== event_sha256) throw ledgerError('ACK_MISMATCH', 'event_sha256');
        if (artifact_sha256 !== api._artifactFor(event_id)) throw ledgerError('ACK_MISMATCH', 'artifact_sha256');
        const already = row.state === 'ACKED';
        db.prepare("UPDATE outbox SET state='ACKED' WHERE delivery_id = ?").run(delivery_id);
        db.prepare("UPDATE events SET state='ACKED' WHERE id = ? AND state IN ('READY','SENT_ACCEPTED','QUEUED')").run(event_id);
        if (!already) api._audit('ACK', delivery_id, { event_id });
        // R04: the destination ACK is the release signal for children held in
        // WAIT_PARENT_ACK on this event — re-evaluate them in the same tx.
        api._reevaluateChildren(event_id);
        return { state: 'ACKED', replay: already };
      }
    },

    // R05: explicit OS-owner conflict resolution. The quarantine NEVER clears
    // by age — only this recorded disposition lifts it. 'original' keeps the
    // stored bytes and re-admits the identity; 'conflicting' supersedes: the
    // event row keeps its original immutable bytes but goes
    // SUPERSEDED_CONFLICT and its PENDING deliveries BLOCK.
    conflictResolve({ eventId, disposition, actor }) {
      if (disposition !== 'original' && disposition !== 'conflicting') {
        throw ledgerError('CONFLICT_INPUT', `disposition must be original|conflicting, got ${String(disposition)}`);
      }
      if (typeof actor !== 'string' || actor.length < 4) {
        throw ledgerError('CONFLICT_INPUT', 'actor identity (>=4 chars) required');
      }
      return api._tx(() => {
        const rows = db.prepare(
          'SELECT * FROM event_conflicts WHERE event_id = ? AND resolved_ms IS NULL',
        ).all(eventId);
        if (rows.length === 0) throw ledgerError('NO_CONFLICT', `no unresolved conflict for ${eventId}`);
        for (const r of rows) {
          db.prepare(
            'UPDATE event_conflicts SET resolved_ms = ?, resolved_by = ?, disposition = ? WHERE event_id = ? AND conflicting_sha256 = ?',
          ).run(now(), actor, disposition, r.event_id, r.conflicting_sha256);
          api._audit('CONFLICT_RESOLVE', r.event_id, {
            original: r.original_sha256, conflicting: r.conflicting_sha256, disposition, actor,
          });
        }
        if (disposition === 'original') {
          return { state: 'HELD_CLEARED', disposition };
        }
        db.prepare("UPDATE events SET state='SUPERSEDED_CONFLICT', reason='conflicting digest elected by explicit resolution' WHERE id = ?").run(eventId);
        db.prepare("UPDATE outbox SET state='BLOCKED' WHERE event_id = ? AND state = 'PENDING'").run(eventId);
        return { state: 'SUPERSEDED_CONFLICT', disposition };
      });
    },

    // ------------------------------------------------------ host reconciliation
    //
    // HOST-RESILIENCE §2: the ONE place peer state is decided. Explicit,
    // transactional, evidence-carrying — replaces the old blanket openLedger
    // reconciliation (open is read-only now). Decisions, never guesses:
    //  - retain            same boot, supervisor proven alive
    //  - adopt-monitor     same boot, supervisor dead, exact child alive — the
    //                      child is adopted as the monitored process; NO spawn
    //  - interrupted-host  different boot — a previous-boot OS process cannot
    //                      exist; ids are preserved for SAME-session resume
    //  - uncertain-identity  pid/start evidence missing or inconsistent
    //  - uncertain-stop    same boot, supervisor and child both dead, no
    //                      completion receipt
    // Deliveries: CLAIMED rows whose sender is PROVEN dead (different boot, or
    // probed dead on this boot) flip to UNCERTAIN — never back to PENDING.

    _probeExact(processProbe, pid, start) {
      if (pid == null) return false;
      const p = processProbe(pid);
      return !!(p && p.alive === true && (start == null || p.start === start));
    },

    reconcileHost({ bootId, processProbe, sessionProbe = null, controlActor }) {
      if (typeof bootId !== 'string' || bootId.length === 0) throw ledgerError('RECONCILE_INPUT', 'bootId required');
      if (typeof processProbe !== 'function') throw ledgerError('RECONCILE_INPUT', 'processProbe required');
      if (typeof controlActor !== 'string' || controlActor.length < 4) throw ledgerError('RECONCILE_INPUT', 'controlActor required');
      return api._tx(() => {
        let deliveriesUncertain = 0;
        for (const row of db.prepare("SELECT * FROM outbox WHERE state = 'CLAIMED'").all()) {
          const sameBoot = row.sender_boot_id !== null && row.sender_boot_id === bootId;
          const alive = sameBoot && api._probeExact(processProbe, row.sender_pid, row.sender_start);
          if (!alive) {
            db.prepare("UPDATE outbox SET state='UNCERTAIN' WHERE delivery_id = ?").run(row.delivery_id);
            deliveriesUncertain += 1;
            api._audit('DELIVERY_UNCERTAIN', row.delivery_id, { boot_id: bootId, actor: controlActor });
          }
        }
        const executions = [];
        for (const row of db.prepare(`SELECT * FROM executions WHERE state IN ${ACTIVE_IN}`).all()) {
          const attempt = db
            .prepare('SELECT * FROM execution_attempts WHERE execution_id = ? ORDER BY attempt_number DESC LIMIT 1')
            .get(row.id);
          const markUncertain = (reason, decision) => {
            db.prepare("UPDATE executions SET state='UNCERTAIN', reason=? WHERE id = ?").run(reason, row.id);
            api._audit('EXECUTION_UNCERTAIN', row.id, { reason, actor: controlActor });
            // R07: decisions identify the session too — the dispatch loop
            // censuses exactly it before any uncertain-stop --resume.
            executions.push({ execution_id: row.id, decision, session_id: row.session_id ?? null });
          };
          if (attempt && attempt.boot_id !== null && attempt.boot_id !== bootId) {
            // Different boot: identity is the boot — a reused pid/start text on
            // this boot is a DIFFERENT process and is never signaled. The
            // unmeasured cutoff is UNKNOWN (actual_elapsed_proven=0), the last
            // proven active lower bound is kept, the full reservation stays
            // charged (nonrefundable).
            const lastNs = Number(attempt.last_active_ns ?? NaN);
            const measured = Number.isFinite(lastNs) ? Math.floor(lastNs / 1e6) : (attempt.measured_active_used_ms ?? 0);
            db.prepare(
              "UPDATE execution_attempts SET state='INTERRUPTED_HOST', actual_elapsed_proven=0, measured_active_used_ms=? WHERE execution_id = ? AND attempt_number = ?",
            ).run(measured, row.id, attempt.attempt_number);
            db.prepare("UPDATE executions SET state='INTERRUPTED_HOST', reason='host reboot during attempt' WHERE id = ?").run(row.id);
            api._audit('EXECUTION_INTERRUPTED', row.id, { from_boot: attempt.boot_id, boot_id: bootId, actor: controlActor });
            executions.push({ execution_id: row.id, decision: 'interrupted-host', session_id: row.session_id ?? null });
            continue;
          }
          if (!attempt || attempt.boot_id === null) {
            // No boot identity recorded: evidence-free — never a signal decision.
            markUncertain('UNCERTAIN_IDENTITY', 'uncertain-identity');
            continue;
          }
          if (api._probeExact(processProbe, attempt.supervisor_pid, attempt.supervisor_start)) {
            executions.push({ execution_id: row.id, decision: 'retain', session_id: row.session_id ?? null });
            continue;
          }
          // Supervisor dead on this boot: child identity decides.
          const childPid = row.pid ?? attempt.child_pid ?? null;
          const childStart = row.process_start ?? attempt.child_start ?? null;
          if (childPid == null || typeof childStart !== 'string') {
            markUncertain('UNCERTAIN_IDENTITY', 'uncertain-identity');
            continue;
          }
          const childProbe = processProbe(childPid);
          if (childProbe && childProbe.alive === true && childProbe.start !== childStart) {
            // pid alive but start text differs: identity unproven.
            markUncertain('UNCERTAIN_IDENTITY', 'uncertain-identity');
            continue;
          }
          if (!(childProbe && childProbe.alive === true)) {
            markUncertain('UNCERTAIN_STOP', 'uncertain-stop');
            continue;
          }
          let sessionOk = row.session_id != null;
          if (sessionOk && typeof sessionProbe === 'function') {
            const sessions = sessionProbe() ?? [];
            sessionOk = sessions.some((s) => s && s.session_id === row.session_id && Number(s.pid) === Number(childPid));
          }
          if (!sessionOk) {
            markUncertain('UNCERTAIN_IDENTITY', 'uncertain-identity');
            continue;
          }
          db.prepare("UPDATE executions SET state='RECOVERING_HOST', reason='supervisor dead, exact child alive: adopted monitor' WHERE id = ?").run(row.id);
          api._audit('EXECUTION_ADOPT_MONITOR', row.id, { child_pid: childPid, actor: controlActor });
          executions.push({ execution_id: row.id, decision: 'adopt-monitor', session_id: row.session_id ?? null });
        }
        return { boot_id: bootId, executions, deliveries_uncertain: deliveriesUncertain };
      });
    },

    // --------------------------------------------------------------- ingest

    ingest(env, { trustedProducerRole } = {}) {
      return api._tx(() => {
        if (api._isOff()) throw ledgerError('OFF', 'admissions blocked by durable OFF');
        if (typeof env !== 'object' || env === null) throw ledgerError('INVALID', 'envelope');
        const row = db.prepare('SELECT * FROM events WHERE id = ?').get(env.id);
        if (row && row.sha256 === env.sha256) {
          return { state: row.state, replay: true };
        }
        if (row && row.sha256 !== null && row.sha256 !== env.sha256) {
          // R05: different digest, same id — record the quarantine durably
          // (repeat occurrences bump), audit BOTH digests, keep original bytes.
          db.prepare(
            `INSERT INTO event_conflicts (event_id, original_sha256, conflicting_sha256, first_seen_ms, occurrences)
             VALUES (?,?,?,?,1)
             ON CONFLICT(event_id, conflicting_sha256) DO UPDATE SET occurrences = occurrences + 1`,
          ).run(env.id, row.sha256, env.sha256, now());
          api._audit('CONFLICT', env.id, { original: row.sha256, conflicting: env.sha256 });
          return { state: 'CONFLICT', replay: false };
        }

        const parentsOk = api._parentsResolved(env.parents);
        const isNew = !row;
        if (isNew) {
          api._fault('insert-event');
          db.prepare(
            'INSERT INTO events (id, sha256, kind, producer, parent_json, payload_json, state, reason, created_ms) VALUES (?,?,?,?,?,?,?,?,?)',
          ).run(env.id, env.sha256, env.kind, env.producer, JSON.stringify(env.parents), JSON.stringify(env.payload), 'PENDING', null, now());
        } else {
          // Placeholder resolution: store the exact digest, never an invented one.
          db.prepare('UPDATE events SET sha256=?, parent_json=?, payload_json=?, producer=? WHERE id = ?').run(
            env.sha256, JSON.stringify(env.parents), JSON.stringify(env.payload), env.producer, env.id,
          );
        }

        const result = api._route(env.id, parentsOk, { trustedProducerRole });
        if (isNew) api._reevaluateChildren(env.id);
        return result;
      });
    },

    _parentsResolved(parents) {
      for (const p of parents ?? []) {
        const row = db.prepare('SELECT sha256 FROM events WHERE id = ?').get(p.id);
        if (!row || row.sha256 === null || row.sha256 !== p.sha256) return false;
        // R05: a quarantined parent is NOT resolved lineage — new children of
        // a conflicted identity hold WAIT_PARENT until explicit resolution.
        if (api._conflictBlocked(p.id)) return false;
      }
      return true;
    },

    // R04: has the parent->destination delivery been ACKED by the destination
    // role? An analysis holds until collector->analyst is ACKED; a solution
    // holds until analyst->solver is ACKED. The destination is always this
    // event's own producer identity.
    _parentDeliveryAcked(parents, destination) {
      for (const p of parents ?? []) {
        const row = db.prepare(
          "SELECT 1 FROM outbox WHERE event_id = ? AND destination = ? AND state = 'ACKED'",
        ).get(p.id, destination);
        if (!row) return false;
      }
      return true;
    },

    _route(eventId, parentsOk, opts = {}) {
      const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
      const payload = JSON.parse(ev.payload_json || '{}');
      const setState = (state, reason) => db.prepare('UPDATE events SET state=?, reason=? WHERE id=?').run(state, reason, eventId);

      if (!parentsOk) {
        setState('WAIT_PARENT', 'unknown or mismatched parent');
        return { state: 'WAIT_PARENT' };
      }

      if (ev.kind === 'batch') {
        const keys = (payload.reports ?? []).map((r) => canonicalDigest([r.repository, r.comment_id, r.body_sha256, r.reviewed_sha]));
        const known = keys.filter((k) => db.prepare('SELECT 1 FROM reports WHERE report_key = ?').get(k));
        const baselinePending = db.prepare("SELECT value FROM control WHERE key='baseline_receipt'").get()?.value !== '1';
        if (ev.state === 'BASELINE_HOLD' || KNOWN_BATCHES.includes(eventId)) {
          // Old batches: never scheduled as fresh work; the intake receipt is
          // the ONLY consumption authority — their keys enter `reports` via
          // the receipt, never via this ingest, so a PARTIAL mapping can
          // neither run (READY fall-through) nor silently complete (CONSUMED).
          if (baselinePending) {
            setState('BASELINE_HOLD', 'awaiting exact baseline consumption receipt');
            return { state: 'BASELINE_HOLD' };
          }
          if (keys.length > 0 && known.length === keys.length) {
            setState('CONSUMED', 'fully consumed per baseline receipt');
            return { state: 'CONSUMED' };
          }
          setState('BASELINE_HOLD', 'baseline receipt present but coverage incomplete');
          return { state: 'BASELINE_HOLD' };
        }
        api._fault('insert-report');
        for (const k of keys) db.prepare('INSERT OR IGNORE INTO reports (report_key, event_id, body_sha256) VALUES (?,?,?)').run(k, eventId, null);
        if (known.length === keys.length && keys.length > 0) {
          setState('CONSUMED', 'replay of fully consumed reports');
          return { state: 'CONSUMED' };
        }
        setState('READY', null);
        return api._emitOutbox(eventId, CHAT_IDS.analyst, 'batch->analyst');
      }

      if (ev.kind === 'analysis') {
        if (eventId === INTAKE_ID) {
          const done = db.prepare("SELECT value FROM control WHERE key='baseline_receipt'").get()?.value === '1';
          setState(done ? 'CONSUMED_VERIFIED' : 'ACCEPTED_CONSUMPTION_UNKNOWN', done ? 'baseline receipt imported' : 'consumption receipt pending');
          return { state: done ? 'CONSUMED_VERIFIED' : 'ACCEPTED_CONSUMPTION_UNKNOWN' };
        }
        const candidates = payload.candidates ?? [];
        const parents = JSON.parse(ev.parent_json || '[]');
        // R04: exact ancestry — consumed ∪ excluded must equal the parent
        // batch's report-key set (no missing, no extra). Numeric vs string
        // comment ids hash to DISTINCT keys (canonical never coerces).
        const parentBatch = parents.length === 1
          ? db.prepare('SELECT * FROM events WHERE id = ?').get(parents[0].id) : null;
        if (parentBatch && parentBatch.kind === 'batch' && parentBatch.sha256 !== null) {
          const parentPayload = JSON.parse(parentBatch.payload_json || '{}');
          const parentKeys = (parentPayload.reports ?? []).map((r) => canonicalDigest([r.repository, r.comment_id, r.body_sha256, r.reviewed_sha]));
          const parentSet = new Set(parentKeys);
          const coveredSet = new Set([
            ...(payload.consumed_report_keys ?? []),
            ...(payload.excluded ?? []).map((e) => (e && typeof e === 'object' ? e.report_key : e)),
          ]);
          const missing = parentKeys.filter((k) => !coveredSet.has(k)).length;
          const extra = [...coveredSet].filter((k) => !parentSet.has(k)).length;
          if (missing > 0 || extra > 0) {
            setState('BLOCKED', `ANALYSIS_COVERAGE:missing=${missing},extra=${extra}`);
            return { state: 'BLOCKED' };
          }
          // R04: each candidate's reviewed_sha must equal the reviewed_sha of
          // every parent report it references.
          const reviewedByKey = new Map(parentKeys.map((k, i) => [k, parentPayload.reports[i].reviewed_sha]));
          for (const c of candidates) {
            for (const rk of c.report_keys ?? []) {
              if (reviewedByKey.get(rk) !== c.reviewed_sha) {
                setState('BLOCKED', `CANDIDATE_REVIEWED_SHA:${c.candidate_id}`);
                return { state: 'BLOCKED' };
              }
            }
          }
        }
        if (candidates.length === 0) {
          setState('COMPLETE_NO_ACTION', 'zero candidates: no solver task');
          return { state: 'COMPLETE_NO_ACTION' };
        }
        // R04: hold until the parent batch->analyst delivery is ACKED by the
        // analyst role — no solver task before the parent artifact is proven
        // delivered and accepted.
        if (!api._parentDeliveryAcked(parents, ev.producer)) {
          setState('WAIT_PARENT_ACK', 'parent delivery not yet ACKED by destination role');
          return { state: 'WAIT_PARENT_ACK' };
        }
        setState('READY', null);
        // All candidates travel together: exactly one route per destination.
        return api._emitOutbox(eventId, CHAT_IDS.solver, 'analysis->solver');
      }

      if (ev.kind === 'solution') {
        const blockers = validateSolution(payload);
        if (blockers.length > 0) {
          setState('BLOCKED', `SOLUTION_BLOCKED:${blockers.join(',')}`);
          return { state: 'BLOCKED', blockers };
        }
        const parents = JSON.parse(ev.parent_json || '[]');
        // R04: the solution must name an EXACT parent candidate — id, exact
        // finding_keys array, reviewed_sha. A digest-valid solution naming a
        // foreign or drifted candidate BLOCKS, never queues.
        const parentAnalysis = parents.length === 1
          ? db.prepare('SELECT * FROM events WHERE id = ?').get(parents[0].id) : null;
        if (parentAnalysis && parentAnalysis.kind === 'analysis' && parentAnalysis.sha256 !== null) {
          const pc = (JSON.parse(parentAnalysis.payload_json || '{}').candidates ?? [])
            .find((c) => c.candidate_id === payload.candidate_id);
          if (!pc) {
            setState('BLOCKED', 'CANDIDATE_MISSING');
            return { state: 'BLOCKED' };
          }
          if (JSON.stringify(pc.finding_keys ?? []) !== JSON.stringify(payload.finding_keys ?? [])) {
            setState('BLOCKED', 'CANDIDATE_FINDING_KEYS');
            return { state: 'BLOCKED' };
          }
          if (pc.reviewed_sha !== payload.reviewed_sha) {
            setState('BLOCKED', 'CANDIDATE_REVIEWED_SHA');
            return { state: 'BLOCKED' };
          }
        }
        // R04: hold until the parent analysis->solver delivery is ACKED by the
        // solver role — no executor admission before the analysis artifact is
        // proven delivered and accepted.
        if (!api._parentDeliveryAcked(parents, ev.producer)) {
          setState('WAIT_PARENT_ACK', 'parent delivery not yet ACKED by destination role');
          return { state: 'WAIT_PARENT_ACK' };
        }
        setState('QUEUED', 'awaiting executor slot');
        return { state: 'QUEUED' };
      }

      if (ev.kind === 'ack') {
        return api._ackInTx(payload, { trustedProducerRole: opts.trustedProducerRole });
      }

      throw ledgerError('INVALID', `kind ${ev.kind}`);
    },

    _emitOutbox(eventId, destination, why) {
      api._fault('insert-outbox');
      const existing = db.prepare('SELECT delivery_id FROM outbox WHERE event_id = ? AND destination = ?').get(eventId, destination);
      if (existing) return { state: 'READY', delivery_id: existing.delivery_id };
      const deliveryId = `DOT-DELIV-${randomUUID()}`;
      db.prepare(
        "INSERT INTO outbox (delivery_id, event_id, destination, state, attempts, next_ms, created_ms) VALUES (?,?,?,'PENDING',0,0,?)",
      ).run(deliveryId, eventId, destination, now());
      api._audit('ROUTE', deliveryId, { event_id: eventId, why });
      return { state: 'READY', delivery_id: deliveryId };
    },

    _reevaluateChildren(eventId) {
      // R04: both hold states re-evaluate — WAIT_PARENT (lineage) and
      // WAIT_PARENT_ACK (destination ACK of the parent delivery).
      const rows = db.prepare(
        "SELECT id FROM events WHERE state IN ('WAIT_PARENT','WAIT_PARENT_ACK') AND parent_json LIKE ?",
      ).all(`%"${eventId}"%`);
      for (const r of rows) {
        const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(r.id);
        const parents = JSON.parse(ev.parent_json || '[]');
        if (!parents.some((p) => p.id === eventId)) continue;
        const payload = JSON.parse(ev.payload_json || '{}');
        if (payload && typeof payload === 'object' && payload.event_id && payload.delivery_id && payload.accepted === true) {
          // child of an ack-shaped envelope: nothing to do
        }
        if (api._parentsResolved(parents)) api._route(r.id, true);
      }
    },

    // --------------------------------------------------------- baseline

    recordBaselineReceipt({ intake_id, consumed_report_keys, excluded }) {
      return api._tx(() => {
        if (intake_id !== INTAKE_ID) throw ledgerError('BASELINE_INTAKE', 'exact running intake id required');
        const intake = db.prepare('SELECT * FROM events WHERE id = ?').get(intake_id);
        if (!intake) throw ledgerError('BASELINE_INTAKE', 'intake event missing');
        const keys = [...(consumed_report_keys ?? []), ...(excluded ?? []).map((e) => e.report_key ?? e)];
        if (keys.length === 0 || keys.some((k) => !HASH64_RE.test(String(k ?? '')))) {
          throw ledgerError('BASELINE_MAPPING', 'full report-key mapping required');
        }
        const counts = new Map();
        for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
        for (const [, n] of counts) if (n > 1) throw ledgerError('BASELINE_MAPPING', 'each report key exactly once');
        for (const k of keys) db.prepare('INSERT OR IGNORE INTO reports (report_key, event_id, body_sha256) VALUES (?,?,NULL)').run(k, intake_id);
        db.prepare("UPDATE events SET state='CONSUMED_VERIFIED', reason='baseline receipt imported' WHERE id = ?").run(intake_id);
        db.prepare("INSERT OR REPLACE INTO control (key, value) VALUES ('baseline_receipt','1')").run();
        // Resolve imported old batches whose every key is now accounted for.
        for (const id of KNOWN_BATCHES) {
          const b = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
          if (!b || b.sha256 === null || b.state !== 'BASELINE_HOLD') continue;
          const payload = JSON.parse(b.payload_json || '{}');
          const bkeys = (payload.reports ?? []).map((r) => canonicalDigest([r.repository, r.comment_id, r.body_sha256, r.reviewed_sha]));
          const known = bkeys.filter((k) => db.prepare('SELECT 1 FROM reports WHERE report_key = ?').get(k));
          if (bkeys.length > 0 && known.length === bkeys.length) {
            db.prepare("UPDATE events SET state='CONSUMED', reason='baseline consumption reconciled' WHERE id = ?").run(id);
          }
        }
        api._audit('BASELINE_CONSUMED', intake_id, { keys: keys.length });
        return { ok: true, keys: keys.length };
      });
    },

    // --------------------------------------------------------- executions

    // HOST-RESILIENCE §4 precharged ledger: claiming RESERVES the first attempt
    // (3 x 2h host-awake allowance, reserve-before-spawn, nonrefundable) in the
    // SAME transaction as the execution insert — a crash after this point can
    // never over-spend the allowance.
    claimExecution({ solutionId, sessionId, bootId = null, supervisor = null }) {
      return api._tx(() => {
        if (api._isOff()) throw ledgerError('OFF', 'admissions blocked by durable OFF');
        const active = db.prepare(`SELECT id FROM executions WHERE state IN ${ACTIVE_IN}`).get();
        if (active) {
          // Existing conflicting execution is held, never silently mutated.
          return { claimed: false, held: true, execution_id: active.id };
        }
        const solution = db.prepare('SELECT * FROM events WHERE id = ?').get(solutionId);
        if (!solution || solution.kind !== 'solution' || solution.state !== 'QUEUED') {
          throw ledgerError('EXECUTION_STATE', `solution ${solutionId} not QUEUED`);
        }
        // R05: executor admission is refused for a quarantined identity chain.
        if (api._conflictBlocked(solutionId)) {
          throw ledgerError('CONFLICT_HELD', `solution ${solutionId} quarantined by digest conflict`);
        }
        // executions.solution_id is UNIQUE: one execution attempt per solution,
        // ever. Repair rounds arrive as NEW solution envelopes, never re-runs.
        if (db.prepare('SELECT 1 FROM executions WHERE solution_id = ?').get(solutionId)) {
          throw ledgerError('EXECUTION_STATE', `solution ${solutionId} already has an execution`);
        }
        const id = `DOT-EXEC-${randomUUID()}`;
        api._fault('insert-execution');
        db.prepare(
          `INSERT INTO executions (id, solution_id, state, session_id, started_ms, deadline_ms, supervisor_boot_id, authorized_attempts, reserved_total_ms, attempts_admitted, charged_reservation_ms)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        ).run(id, solutionId, 'RESERVED', sessionId, now(), now() + ATTEMPT_RESERVED_MS, bootId, AUTHORIZED_ATTEMPTS, RESERVED_TOTAL_MS, 1, ATTEMPT_RESERVED_MS);
        db.prepare(
          `INSERT INTO execution_attempts (execution_id, attempt_number, boot_id, state, reserved_ms, supervisor_pid, supervisor_start, session_id)
           VALUES (?,?,?,?,?,?,?,?)`,
        ).run(id, 1, bootId, 'RESERVED', ATTEMPT_RESERVED_MS, supervisor?.pid ?? null, supervisor?.start ?? null, sessionId);
        db.prepare("UPDATE events SET state='QUEUED' WHERE id = ?").run(solutionId);
        return {
          claimed: true,
          state: 'RESERVED',
          execution_id: id,
          solution_id: solutionId,
          session_id: sessionId,
          deadline_ms: now() + ATTEMPT_RESERVED_MS,
          attempt_number: 1,
          reserved_ms: ATTEMPT_RESERVED_MS,
        };
      });
    },

    updateExecution(id, patch) {
      return api._tx(() => {
        const row = db.prepare('SELECT * FROM executions WHERE id = ?').get(id);
        if (!row) throw ledgerError('UNKNOWN_EXECUTION', id);
        const fields = ['state', 'pid', 'process_start', 'worktree', 'exit_code', 'pr_url', 'head_sha', 'reason'];
        const sets = [];
        const vals = [];
        for (const f of fields) {
          if (f in patch) {
            sets.push(`${f} = ?`);
            vals.push(patch[f]);
          }
        }
        if (sets.length === 0) return { ok: true };
        vals.push(id);
        db.prepare(`UPDATE executions SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
        return { ok: true };
      });
    },

    getAttempt(executionId, attemptNumber) {
      return db.prepare('SELECT * FROM execution_attempts WHERE execution_id = ? AND attempt_number = ?').get(executionId, attemptNumber) ?? null;
    },

    updateAttempt(executionId, attemptNumber, patch) {
      return api._tx(() => {
        const row = db.prepare('SELECT 1 FROM execution_attempts WHERE execution_id = ? AND attempt_number = ?').get(executionId, attemptNumber);
        if (!row) throw ledgerError('UNKNOWN_ATTEMPT', `${executionId}#${attemptNumber}`);
        const fields = [
          'state', 'boot_id', 'reserved_ms', 'active_start_ns', 'last_active_ns',
          'measured_active_used_ms', 'actual_elapsed_proven',
          'supervisor_pid', 'supervisor_start', 'child_pid', 'child_start', 'session_id',
        ];
        const sets = [];
        const vals = [];
        for (const f of fields) {
          if (f in patch) {
            sets.push(`${f} = ?`);
            vals.push(patch[f]);
          }
        }
        if (sets.length === 0) return { ok: true };
        vals.push(executionId, attemptNumber);
        db.prepare(`UPDATE execution_attempts SET ${sets.join(', ')} WHERE execution_id = ? AND attempt_number = ?`).run(...vals);
        return { ok: true };
      });
    },

    // HOST-RESILIENCE §4: automatic SAME-session resume admission for an
    // INTERRUPTED_HOST execution on a later boot. ONE resume per execution per
    // boot; total admissions bounded by the precharged allowance; consecutive
    // CONCRETE failures (2) block recovery — sleep/reboot are never failures.
    admitNextAttempt({ executionId, bootId, supervisor, sessionId, purpose, verifiedDead = false }) {
      if (typeof executionId !== 'string' || typeof bootId !== 'string' || bootId.length === 0) {
        throw ledgerError('RECONCILE_INPUT', 'executionId and bootId required');
      }
      return api._tx(() => {
        const row = db.prepare('SELECT * FROM executions WHERE id = ?').get(executionId);
        if (!row) throw ledgerError('UNKNOWN_EXECUTION', String(executionId));
        // R07: an UNCERTAIN row stays terminal UNLESS the caller supplies FRESH
        // verified-dead evidence (processes + session probed dead right now) for
        // the same-boot crash shape. Any other UNCERTAIN reason is a hard hold.
        if (row.state === 'UNCERTAIN') {
          const eligible = row.reason === 'UNCERTAIN_STOP' && verifiedDead === true;
          if (!eligible) return { admitted: false, code: 'ATTEMPT_IN_PROGRESS', state: row.state };
        } else if (RESUME_BLOCKED_STATES.has(row.state)) {
          return { admitted: false, code: 'ATTEMPT_IN_PROGRESS', state: row.state };
        }
        if (row.state === 'BLOCKED_RECOVERY' || row.consecutive_resume_failures >= 2) {
          return { admitted: false, code: 'BLOCKED_RECOVERY', consecutive_resume_failures: row.consecutive_resume_failures };
        }
        if (row.attempts_admitted >= row.authorized_attempts) {
          return { admitted: false, code: 'RECOVERY_ALLOWANCE_EXHAUSTED', attempts_admitted: row.attempts_admitted };
        }
        if (row.last_resume_boot === bootId) {
          return { admitted: false, code: 'RESUME_CAP_PER_BOOT' };
        }
        if (sessionId !== row.session_id) {
          // Same-session resume only: a different session id is unproven
          // identity, never a silent second execution.
          return { admitted: false, code: 'UNCERTAIN_RESUME_IDENTITY' };
        }
        const n = row.attempts_admitted + 1;
        db.prepare(
          `INSERT INTO execution_attempts (execution_id, attempt_number, boot_id, state, reserved_ms, supervisor_pid, supervisor_start, session_id)
           VALUES (?,?,?,?,?,?,?,?)`,
        ).run(executionId, n, bootId, 'RESERVED', ATTEMPT_RESERVED_MS, supervisor?.pid ?? null, supervisor?.start ?? null, sessionId);
        db.prepare(
          `UPDATE executions SET state='RESUMING_HOST', reason=NULL, supervisor_boot_id=?, attempts_admitted=?, charged_reservation_ms=?, resumptions=?, last_resume_boot=? WHERE id = ?`,
        ).run(bootId, n, row.charged_reservation_ms + ATTEMPT_RESERVED_MS, row.resumptions + 1, bootId, executionId);
        api._audit('ATTEMPT_ADMITTED', executionId, { attempt_number: n, boot_id: bootId, purpose: purpose ?? 'resume' });
        return { admitted: true, attempt_number: n, reserved_ms: ATTEMPT_RESERVED_MS, execution_id: executionId, session_id: sessionId };
      });
    },

    // A CONCRETE resume failure (worker exit without evidence, launch refusal)
    // — not sleep, not reboot. Two consecutive -> BLOCKED_RECOVERY.
    recordResumeFailure(executionId) {
      return api._tx(() => {
        const row = db.prepare('SELECT * FROM executions WHERE id = ?').get(executionId);
        if (!row) throw ledgerError('UNKNOWN_EXECUTION', String(executionId));
        const n = row.consecutive_resume_failures + 1;
        if (n >= 2) {
          db.prepare("UPDATE executions SET consecutive_resume_failures=?, state='BLOCKED_RECOVERY', reason='two consecutive concrete resume failures' WHERE id = ?").run(n, executionId);
        } else {
          db.prepare('UPDATE executions SET consecutive_resume_failures=? WHERE id = ?').run(n, executionId);
        }
        api._audit('RESUME_FAILURE', executionId, { consecutive_resume_failures: n });
        return { ok: true, consecutive_resume_failures: n };
      });
    },

    // HOST-RESILIENCE §4: successful VERIFIED progress clears the consecutive
    // concrete-failure counter (sleep/reboot never touched it).
    recordResumeSuccess(executionId) {
      return api._tx(() => {
        const row = db.prepare('SELECT * FROM executions WHERE id = ?').get(executionId);
        if (!row) throw ledgerError('UNKNOWN_EXECUTION', String(executionId));
        db.prepare('UPDATE executions SET consecutive_resume_failures=0 WHERE id = ?').run(executionId);
        api._audit('RESUME_SUCCESS', executionId, {});
        return { ok: true };
      });
    },

    // Coordinator/operator reconciliation of an UNCERTAIN execution. Evidence
    // carries exact process/session identity plus explicit control input —
    // it can never be supplied by a report payload.
    reconcileExecution({ execution_id, evidence, decision }) {
      return api._tx(() => {
        const row = db.prepare('SELECT * FROM executions WHERE id = ?').get(execution_id);
        if (!row) throw ledgerError('UNKNOWN_EXECUTION', String(execution_id));
        if (!evidence || typeof evidence !== 'object') throw ledgerError('RECONCILE_EVIDENCE', 'evidence required');
        if (typeof evidence.session_id !== 'string' || evidence.session_id !== row.session_id) {
          throw ledgerError('RECONCILE_EVIDENCE', 'session identity mismatch');
        }
        if (typeof evidence.control !== 'string' || evidence.control.length < 20) {
          throw ledgerError('RECONCILE_EVIDENCE', 'explicit operator/coordinator control input required');
        }
        // HOST-RESILIENCE §2: openLedger no longer flips crashed rows to
        // UNCERTAIN, so an evidence-carrying reconciliation may target any
        // still-held slot state.
        if (!ACTIVE_STATES.includes(row.state)) throw ledgerError('RECONCILE_STATE', `${row.state}`);
        if (decision === 'CONFIRM_DEAD') {
          // R09: a STRUCTURED death proof from the shared fresh ownership/death
          // adapter (kind absent / old-boot / never-started), exactly bound to
          // this execution and agreeing with the recorded pid/start. ps-start
          // text plus control prose can never free a slot.
          const proof = evidence.death_proof;
          if (!proof || typeof proof !== 'object' || Array.isArray(proof)) {
            throw ledgerError('RECONCILE_EVIDENCE', 'death_proof required: kind absent/old-boot/never-started');
          }
          if (!['absent', 'old-boot', 'never-started'].includes(proof.kind)) {
            throw ledgerError('RECONCILE_EVIDENCE', `unsupported death_proof.kind: ${proof.kind}`);
          }
          if (proof.execution_id !== execution_id) {
            throw ledgerError('RECONCILE_EVIDENCE', 'death_proof bound to a different execution');
          }
          if ((proof.pid ?? null) !== (row.pid ?? null) || (proof.process_start ?? null) !== (row.process_start ?? null)) {
            throw ledgerError('RECONCILE_EVIDENCE', 'death_proof pid/process_start disagree with the recorded row');
          }
          db.prepare("UPDATE executions SET state='ABORTED_UNCERTAIN', reason=? WHERE id = ?").run(`reconciled dead (${proof.kind}): ${evidence.control.slice(0, 80)}`, execution_id);
          api._audit('EXECUTION_RECONCILED', execution_id, { decision, death_proof_kind: proof.kind });
          return { state: 'ABORTED_UNCERTAIN' };
        }
        throw ledgerError('RECONCILE_DECISION', String(decision));
      });
    },

    // ------------------------------------------------- manifests/cursors/snapshots

    _validatePublicManifest(manifest, producerRole) {
      if (typeof manifest !== 'object' || manifest === null) throw ledgerError('INVALID', 'manifest');
      const keys = Object.keys(manifest).sort().join(',');
      const expected = ['artifact', 'bytes', 'delivery_id', 'destination', 'event_id', 'kind', 'parents', 'producer', 'sha256', 'status', 'version'].sort().join(',');
      if (keys !== expected) throw ledgerError('INVALID', 'manifest keys');
      if (manifest.version !== 1) throw ledgerError('INVALID', 'version');
      if (!['READY', 'WAIT', 'BLOCKED'].includes(manifest.status)) throw ledgerError('INVALID', 'status');
      if (manifest.producer !== CHAT_IDS[producerRole]) throw ledgerError('INVALID', 'producer identity');
      if (!HASH64_RE.test(manifest.sha256)) throw ledgerError('INVALID', 'sha256');
      if (!Number.isInteger(manifest.bytes) || manifest.bytes < 1) throw ledgerError('INVALID', 'bytes');
      if (!Array.isArray(manifest.parents)) throw ledgerError('INVALID', 'parents');
      if (Buffer.byteLength(canonical(manifest)) > 4096) throw ledgerError('INVALID', 'manifest >4KiB');
      const a = manifest.artifact;
      if (typeof a !== 'object' || a === null) throw ledgerError('INVALID', 'artifact');
      const aKeys = Object.keys(a).sort().join(',');
      if (aKeys === 'page_id,reference') {
        if (typeof a.page_id !== 'string' || typeof a.reference !== 'string') throw ledgerError('INVALID', 'artifact ref');
      } else if (aKeys === 'bytes,parts,sha256') {
        if (!Array.isArray(a.parts) || a.parts.length < 1 || a.parts.length > 8) throw ledgerError('INVALID', 'parts');
        if (a.sha256 !== manifest.sha256) throw ledgerError('INVALID', 'whole digest binding');
        let sum = 0;
        a.parts.forEach((p, i) => {
          if (p.ordinal !== i || !HASH64_RE.test(p.sha256)) throw ledgerError('INVALID', 'part ordinal/digest');
          if (!Number.isInteger(p.bytes) || p.bytes < 1 || p.bytes > 200000) throw ledgerError('INVALID', 'part bytes');
          sum += p.bytes;
        });
        if (sum !== a.bytes || a.bytes !== manifest.bytes || a.bytes > 1048576) throw ledgerError('INVALID', 'part sum');
      } else {
        throw ledgerError('INVALID', 'artifact descriptor');
      }
    },

    manifestImport({ manifest, producerRole, cursorToken }) {
      return api._tx(() => {
        if (api._isOff()) throw ledgerError('OFF', 'imports blocked by durable OFF');
        return api._manifestImportInTx({ manifest, producerRole, cursorToken });
      });
    },

    _manifestImportInTx({ manifest, producerRole, cursorToken }) {
      {
        api._validatePublicManifest(manifest, producerRole);
        const row = db.prepare('SELECT * FROM manifests WHERE event_id = ?').get(manifest.event_id);
        if (row) {
          if (row.artifact_sha256 === manifest.sha256) {
            db.prepare('INSERT OR IGNORE INTO snapshot_items (producer_role, token, item_id, state) VALUES (?,?,?,?)').run(producerRole, cursorToken, manifest.event_id, 'metadata');
            return { state: 'REGISTERED', replay: true };
          }
          api._audit('CONFLICT', manifest.event_id, { where: 'manifest' });
          throw ledgerError('CONFLICT', `manifest digest changed for ${manifest.event_id}`);
        }
        const a = manifest.artifact;
        const multipart = Array.isArray(a.parts);
        db.prepare(
          'INSERT INTO manifests (event_id, producer_role, artifact_sha256, artifact_bytes, source_page_id, source_reference, manifest_json, fetched_ms) VALUES (?,?,?,?,?,?,?,?)',
        ).run(
          manifest.event_id, producerRole, manifest.sha256, manifest.bytes,
          multipart ? null : a.page_id, multipart ? null : a.reference,
          JSON.stringify(manifest), now(),
        );
        db.prepare('INSERT OR IGNORE INTO snapshot_items (producer_role, token, item_id, state) VALUES (?,?,?,?)').run(producerRole, cursorToken, manifest.event_id, 'metadata');
        db.prepare('INSERT INTO cursors (producer_role, committed_token, pending_token) VALUES (?,?,?) ON CONFLICT(producer_role) DO UPDATE SET pending_token = excluded.pending_token').run(producerRole, null, cursorToken);
        api._audit('MANIFEST_REGISTERED', manifest.event_id, { role: producerRole, bytes: manifest.bytes });
        return { state: 'REGISTERED', replay: false };
      }
    },

    _markItemImported(eventId) {
      db.prepare("UPDATE snapshot_items SET state='imported' WHERE item_id = ?").run(eventId);
    },

    _validateBundle(bundle) {
      if (typeof bundle !== 'object' || bundle === null) throw ledgerError('INVALID', 'bundle');
      const keys = Object.keys(bundle).sort().join(',');
      if (keys !== 'acks,manifests,status,version') throw ledgerError('INVALID', 'bundle keys');
      if (bundle.version !== 1 || !['READY', 'WAIT', 'BLOCKED'].includes(bundle.status)) throw ledgerError('INVALID', 'bundle version/status');
      if (!Array.isArray(bundle.acks) || bundle.acks.length > 10) throw ledgerError('INVALID', 'acks bound');
      if (!Array.isArray(bundle.manifests) || bundle.manifests.length > 10) throw ledgerError('INVALID', 'manifests bound');
      if (Buffer.byteLength(canonical(bundle)) > 32768) throw ledgerError('INVALID', 'bundle >32KiB');
    },

    snapshotImport({ bundle, producerRole, cursorToken }) {
      return api._tx(() => {
        if (api._isOff()) throw ledgerError('OFF', 'imports blocked by durable OFF');
        api._validateBundle(bundle);
        const dedupeKey = `snapshot:${producerRole}:${cursorToken}:${sha256Hex(canonical(bundle))}`;
        if (db.prepare('SELECT 1 FROM control WHERE key = ?').get(dedupeKey)) {
          return { replay: true, acks_imported: 0, manifests_registered: 0 };
        }
        let acks = 0;
        let manifests = 0;
        for (const m of bundle.manifests) {
          const r = api._manifestImportInTx({ manifest: m, producerRole, cursorToken });
          if (!r.replay) manifests += 1;
        }
        for (const a of bundle.acks) {
          api._ackInTx(a, { trustedProducerRole: producerRole });
          acks += 1;
        }
        db.prepare('INSERT OR REPLACE INTO control (key, value) VALUES (?,?)').run(dedupeKey, String(now()));
        api._audit('SNAPSHOT_IMPORT', cursorToken, { role: producerRole, acks, manifests });
        return { acks_imported: acks, manifests_registered: manifests, replay: false };
      });
    },

    receiptImport({ receipt, producerRole }) {
      return api._tx(() => {
        if (typeof receipt !== 'object' || receipt === null || receipt.version !== 1 || !Array.isArray(receipt.acks)) {
          throw ledgerError('INVALID', 'receipt');
        }
        const dedupeKey = `receipt:${producerRole}:${sha256Hex(canonical(receipt))}`;
        if (db.prepare('SELECT 1 FROM control WHERE key = ?').get(dedupeKey)) return { replay: true, acks_imported: 0 };
        for (const a of receipt.acks) api._ackInTx(a, { trustedProducerRole: producerRole });
        db.prepare('INSERT OR REPLACE INTO control (key, value) VALUES (?,?)').run(dedupeKey, String(now()));
        api._audit('RECEIPT_IMPORT', producerRole, { acks: receipt.acks.length });
        return { acks_imported: receipt.acks.length, replay: false };
      });
    },

    _validateIndexPage(index, producerRole) {
      if (typeof index !== 'object' || index === null) throw ledgerError('INVALID', 'index');
      const keys = Object.keys(index).sort().join(',');
      if (keys !== 'generation,items,next,page_number,producer,version') throw ledgerError('INVALID', 'index keys');
      if (index.version !== 1) throw ledgerError('INVALID', 'version');
      if (index.producer !== CHAT_IDS[producerRole]) throw ledgerError('INVALID', 'producer identity');
      // PRODUCER-CONTRACT v1: generation is the producer's string index ID
      // (same ID the locator carried), not an integer.
      if (typeof index.generation !== 'string' || !GEN_ID_RE.test(index.generation)) throw ledgerError('INVALID', 'generation');
      if (!Number.isInteger(index.page_number) || index.page_number < 0) throw ledgerError('INVALID', 'page_number');
      if (!Array.isArray(index.items) || index.items.length > 100) throw ledgerError('INVALID', 'items bound');
      if (Buffer.byteLength(canonical(index)) > 200000) throw ledgerError('INVALID', 'index >200000 bytes');
      for (const item of index.items) {
        if (typeof item !== 'object' || !['manifest', 'ack'].includes(item.type)) throw ledgerError('INVALID', 'item type');
        if (item.type === 'manifest' && !item.manifest) throw ledgerError('INVALID', 'item manifest');
        if (item.type === 'ack' && !item.ack) throw ledgerError('INVALID', 'item ack');
      }
      if (index.next !== null) {
        const n = index.next;
        if (typeof n !== 'object' || !n.page_id || !n.reference || !HASH64_RE.test(n.sha256 ?? '') || !Number.isInteger(n.bytes)) {
          throw ledgerError('INVALID', 'next descriptor');
        }
      }
    },

    // R03: durable page-identity import. `cursor` is the TRUSTED tool receipt
    // cursor from wait_threads (never a producer JSON field); it is stored with
    // the generation and commits only when the reachable chain completes.
    // A same-identity/different-digest page QUARANTINES the generation in its
    // own committed transaction BEFORE the import throws — the hold itself
    // must survive the failure it reports.
    indexImport({ index, producerRole, cursor, expectedIndexSha256, rawText }) {
      if (api._isOff()) throw ledgerError('OFF', 'imports blocked by durable OFF');
      api._validateIndexPage(index, producerRole);
      const actual = sha256Hex(rawText ?? canonical(index));
      if (actual !== expectedIndexSha256) throw ledgerError('INVALID', 'index hash');
      const pre = api._tx(() => {
        const genRow0 = db.prepare('SELECT * FROM index_generations WHERE producer_role = ? AND generation = ?').get(producerRole, index.generation);
        if (genRow0 && genRow0.quarantined === 1) return 'QUARANTINED';
        const pageRow0 = db.prepare('SELECT * FROM index_pages WHERE producer_role = ? AND generation = ? AND page_number = ?').get(producerRole, index.generation, index.page_number);
        if (pageRow0 && pageRow0.source_sha256 !== actual) {
          db.prepare('UPDATE index_generations SET quarantined = 1, quarantined_reason = ? WHERE producer_role = ? AND generation = ?').run(
            `page ${index.page_number} digest ${actual.slice(0, 16)} != committed ${pageRow0.source_sha256.slice(0, 16)}`, producerRole, index.generation,
          );
          api._audit('INDEX_CONFLICT', index.generation, { role: producerRole, page: index.page_number });
          return 'CONFLICT';
        }
        return null;
      });
      if (pre === 'QUARANTINED') throw ledgerError('INDEX_CONFLICT', `generation ${index.generation} quarantined`);
      if (pre === 'CONFLICT') throw ledgerError('INDEX_CONFLICT', `page ${index.page_number} digest changed`);
      return api._tx(() => {
        const genRow = db.prepare('SELECT * FROM index_generations WHERE producer_role = ? AND generation = ?').get(producerRole, index.generation);
        const pageRow = db.prepare('SELECT * FROM index_pages WHERE producer_role = ? AND generation = ? AND page_number = ?').get(producerRole, index.generation, index.page_number);
        if (pageRow) {
          // R03: an already-committed page with the same digest is a no-op
          // replay even if the continuation has advanced past it.
          return { pages_imported: 0, next_page_number: genRow.next_page_number, complete: genRow.complete === 1, replay: true };
        }
        if (genRow) {
          if (genRow.complete === 1) throw ledgerError('INVALID', `generation ${index.generation} already complete`);
          if (genRow.next_page_number !== index.page_number) {
            throw ledgerError('INVALID', `expected page ${genRow.next_page_number}, got ${index.page_number}`);
          }
        } else if (index.page_number !== 0) {
          throw ledgerError('INVALID', `expected page 0, got ${index.page_number}`);
        }
        let manifests = 0;
        let acks = 0;
        for (const item of index.items) {
          if (item.type === 'manifest') {
            const r = api._manifestImportInTx({ manifest: item.manifest, producerRole, cursorToken: `index:${index.generation}` });
            if (!r.replay) manifests += 1;
          } else {
            api._ackInTx(item.ack, { trustedProducerRole: producerRole });
            acks += 1;
          }
        }
        db.prepare('INSERT INTO index_pages (producer_role, generation, page_number, source_sha256, source_bytes, imported_ms) VALUES (?,?,?,?,?,?)').run(
          producerRole, index.generation, index.page_number, actual, Buffer.byteLength(rawText ?? canonical(index), 'utf8'), now(),
        );
        const complete = index.next === null ? 1 : 0;
        if (genRow) {
          db.prepare('UPDATE index_generations SET next_page_number = ?, next_descriptor_json = ?, complete = ?, snapshot_cursor = COALESCE(snapshot_cursor, ?) WHERE producer_role = ? AND generation = ?').run(
            index.page_number + 1, index.next ? JSON.stringify(index.next) : null, complete, cursor ?? null, producerRole, index.generation,
          );
        } else {
          db.prepare('INSERT INTO index_generations (producer_role, generation, first_seen_ms, snapshot_cursor, next_page_number, next_descriptor_json, complete) VALUES (?,?,?,?,?,?,?)').run(
            producerRole, index.generation, now(), cursor ?? null, index.page_number + 1, index.next ? JSON.stringify(index.next) : null, complete,
          );
        }
        // Snapshot cursor advances ONLY after all reachable pages imported.
        if (complete === 1) {
          const gen = db.prepare('SELECT snapshot_cursor FROM index_generations WHERE producer_role = ? AND generation = ?').get(producerRole, index.generation);
          if (gen && gen.snapshot_cursor) {
            db.prepare('INSERT INTO cursors (producer_role, committed_token, pending_token) VALUES (?,?,NULL) ON CONFLICT(producer_role) DO UPDATE SET committed_token = excluded.committed_token').run(producerRole, gen.snapshot_cursor);
          }
        }
        // Imported-receipt outbox: DOT_RELAY_IMPORTED with ALL item identities
        // of this completed page, idempotent per (role, generation, page, sha).
        const receiptItems = index.items.map((item) => (item.type === 'manifest'
          ? { type: 'manifest', event_id: item.manifest.event_id, sha256: sha256Hex(canonical(item.manifest)) }
          : { type: 'ack', delivery_id: item.ack.delivery_id, event_id: item.ack.event_id, event_sha256: item.ack.event_sha256, artifact_sha256: item.ack.artifact_sha256 }));
        const prompt = `DOT_RELAY_IMPORTED ${JSON.stringify({ version: 1, producer: CHAT_IDS.coordinator, generation: index.generation, page_number: index.page_number, source_sha256: actual, items: receiptItems })}`;
        const receiptId = `DOT-RCPT-${sha256Hex(`${producerRole}:${index.generation}:${index.page_number}:${actual}`).slice(0, 24)}`;
        db.prepare('INSERT OR IGNORE INTO receipt_outbox (receipt_id, producer_role, generation, page_number, source_sha256, prompt, destination, state, created_ms) VALUES (?,?,?,?,?,?,?,\'PENDING\',?)').run(
          receiptId, producerRole, index.generation, index.page_number, actual, prompt, CHAT_IDS[producerRole], now(),
        );
        api._audit('INDEX_IMPORT', index.generation, { role: producerRole, page: index.page_number, items: index.items.length });
        return { pages_imported: 1, next_page_number: index.page_number + 1, complete: complete === 1, manifests, acks };
      });
    },

    // R03: imported-receipt outbox — claim/commit mirrors the delivery outbox
    // (claim-first, SENT_ACCEPTED/UNCERTAIN terminal, uncertain never resent).
    claimReceipt(receiptId, { sender = null } = {}) {
      return api._tx(() => {
        if (api._isOff()) throw ledgerError('OFF', 'admissions blocked by durable OFF');
        const row = db.prepare('SELECT * FROM receipt_outbox WHERE receipt_id = ?').get(receiptId);
        if (!row) throw ledgerError('UNKNOWN_RECEIPT', receiptId);
        if (row.state !== 'PENDING') throw ledgerError('RECEIPT_STATE', `${receiptId} in ${row.state}`);
        if (row.next_ms > now()) throw ledgerError('RECEIPT_NOT_DUE', `${receiptId} next_ms ${row.next_ms}`);
        db.prepare("UPDATE receipt_outbox SET state='CLAIMED', sender_boot_id=?, sender_pid=?, sender_start=? WHERE receipt_id = ?").run(
          sender?.boot_id ?? null, sender?.pid ?? null, sender?.start ?? null, receiptId,
        );
        return { receipt_id: receiptId, destination: row.destination, prompt: row.prompt, state: 'CLAIMED' };
      });
    },

    receiptOutcome(receiptId, { status, receipt }) {
      return api._tx(() => {
        const row = db.prepare('SELECT * FROM receipt_outbox WHERE receipt_id = ?').get(receiptId);
        if (!row) throw ledgerError('UNKNOWN_RECEIPT', receiptId);
        if (row.state !== 'CLAIMED') throw ledgerError('RECEIPT_STATE', `${receiptId} in ${row.state}`);
        const receiptJson = JSON.stringify({ status, receipt, at: now() });
        if (status === 'sent') {
          db.prepare("UPDATE receipt_outbox SET state='SENT_ACCEPTED', receipt_json=? WHERE receipt_id=?").run(receiptJson, receiptId);
          return { state: 'SENT_ACCEPTED' };
        }
        if (status === 'uncertain') {
          // Ambiguous result: never auto-retry; reconciled by explicit action only.
          db.prepare("UPDATE receipt_outbox SET state='UNCERTAIN', receipt_json=? WHERE receipt_id=?").run(receiptJson, receiptId);
          return { state: 'UNCERTAIN' };
        }
        if (status === 'not-sent') {
          const attempts = row.attempts + 1;
          if (attempts >= 3) {
            db.prepare("UPDATE receipt_outbox SET state='BLOCKED', attempts=?, receipt_json=? WHERE receipt_id=?").run(attempts, receiptJson, receiptId);
            api._audit('RECEIPT_BLOCKED', receiptId, { attempts });
            return { state: 'BLOCKED' };
          }
          const backoffMs = attempts === 1 ? 4 * 3600 * 1000 : 8 * 3600 * 1000;
          db.prepare("UPDATE receipt_outbox SET state='PENDING', attempts=?, next_ms=?, receipt_json=? WHERE receipt_id=?").run(attempts, now() + backoffMs, receiptJson, receiptId);
          return { state: 'PENDING', next_ms: now() + backoffMs };
        }
        throw ledgerError('RECEIPT_STATUS', String(status));
      });
    },

    // ------------------------------------------- calendar scheduler bookkeeping
    //
    // HOST-RESILIENCE §1: launchd StartCalendarInterval (0/4/8/12/16/20) +
    // RunAtLoad coalesce — the SAME logical slot can fire twice, and a sleeping
    // host skips slots. Exactly ONE bounded catch-up per wake; a failed
    // planning pass retains catchup_pending for an idempotent retry; durable
    // OFF suppresses planning entirely (and survives reboot).

    _ctrl(key) {
      const r = db.prepare('SELECT value FROM control WHERE key = ?').get(key);
      return r ? r.value : null;
    },

    _ctrlSet(key, value) {
      db.prepare('INSERT OR REPLACE INTO control (key, value) VALUES (?,?)').run(key, String(value));
    },

    // PAGE-LOCATOR-RECOVERY-ADDENDUM: durable record of a VERIFIED Page
    // fallback resolution, persisted before import. Key = producer role +
    // generation + source digest: a changed generation or source digest is a
    // NEW bounded resolution; the same identity may only replay identically.
    recordLocatorResolution({ producerRole, generation, locatorSha256, pageId, reference, sourceSha256, bytes }) {
      return api._tx(() => {
        const key = `locator_resolution:${producerRole}:${generation}:${sourceSha256}`;
        const cur = api._ctrl(key);
        if (cur !== null) {
          let v = null;
          try { v = JSON.parse(cur); } catch { v = null; }
          if (!v || v.locator_sha256 !== locatorSha256 || v.page_id !== pageId
            || v.reference !== reference || v.source_sha256 !== sourceSha256 || v.bytes !== bytes) {
            api._audit('LOCATOR_RESOLUTION_CONFLICT', generation, { role: producerRole, key });
            throw ledgerError('LOCATOR_RESOLUTION_CONFLICT', `resolution for ${key} already recorded`);
          }
          return { stored: true, replay: true, key };
        }
        api._ctrlSet(key, JSON.stringify({
          locator_sha256: locatorSha256, page_id: pageId, reference,
          source_sha256: sourceSha256, bytes, recorded_ms: now(),
        }));
        api._audit('LOCATOR_RESOLUTION_RECORDED', generation, { role: producerRole, key });
        return { stored: true, replay: false, key };
      });
    },

    locatorResolutions() {
      // GLOB, not LIKE: node:sqlite strips backslashes from LIKE patterns, so
      // an ESCAPE-quoted `\_` silently loses its escaping (measured: the
      // escaped pattern matched NOTHING while a plain prefix LIKE matched) —
      // and in GLOB the underscore is literal, which is exactly the intent.
      return db.prepare("SELECT key, value FROM control WHERE key GLOB 'locator_resolution:*'").all().map((r) => {
        let v = null;
        try { v = JSON.parse(r.value); } catch { v = null; }
        const parts = r.key.split(':'); // locator_resolution:<role>:<generation>:<sourcehash>
        return v ? {
          key: r.key, producer_role: parts[1], generation: parts[2],
          locator_sha256: v.locator_sha256, page_id: v.page_id, reference: v.reference,
          source_sha256: v.source_sha256, bytes: v.bytes,
        } : null;
      }).filter(Boolean);
    },

    _nextSlotAfter(ms) {
      return nextLocalSlotAfter(ms);
    },

    beginSchedulerTick({ bootId, token, owner = null, processProbe = null }) {
      if (typeof token !== 'string' || token.length === 0) throw ledgerError('TICK_INPUT', 'token required');
      return api._tx(() => {
        if (api._isOff()) return { suppressed: 'off' };
        if (db.prepare('SELECT 1 FROM control WHERE key = ?').get(`tick_done:${token}`)) {
          return { deduped: true };
        }
        const nextDue = Number(api._ctrl('tick_next_due_wall_ms') ?? 0); // absent -> 0 -> due (cold start / RunAtLoad)
        const catchupPending = api._ctrl('tick_catchup_pending') === '1';
        if (!catchupPending && now() < nextDue) return { due: false, next_due_wall_ms: nextDue };
        // R06 exclusive ownership: an in-progress tick is a LIVE owner until
        // proven otherwise — refused, never silently overwritten.
        const heldRaw = api._ctrl('tick_in_progress');
        if (heldRaw != null) {
          const held = parseTickOwner(heldRaw);
          if (!held) return { refused: 'owner-unproven' };
          if (held.token === token) return { deduped: true }; // RunAtLoad + calendar duplicate coalesce
          const verdict = tickOwnerTakeover(held, bootId ?? null, processProbe);
          if (verdict === 'live') {
            return { refused: 'owner-live', held_by: { pid: held.pid, boot_id: held.boot_id } };
          }
          if (verdict === 'unproven') return { refused: 'owner-unproven' };
          api._audit('SCHEDULER_TAKEOVER', token, {
            reason: verdict,
            previous: { pid: held.pid, start: held.start, boot_id: held.boot_id, token: held.token },
          });
        }
        const overdue = Math.max(1, Math.ceil((now() - nextDue) / TICK_PERIOD_MS));
        api._ctrlSet('tick_in_progress', JSON.stringify({
          token,
          boot_id: bootId ?? null,
          pid: owner && Number.isInteger(owner.pid) ? owner.pid : null,
          start: owner && typeof owner.start === 'string' && owner.start ? owner.start : null,
        }));
        api._ctrlSet('tick_last_boot_id', bootId ?? '');
        api._audit('TICK_BEGIN', token, { boot_id: bootId ?? null, overdue_periods: overdue });
        return { due: true, overdue_periods: overdue };
      });
    },

    completeSchedulerTick({ bootId, token, owner = null, plannedOk }) {
      return api._tx(() => {
        const heldRaw = api._ctrl('tick_in_progress');
        if (heldRaw == null) {
          // suppressed / deduped / unknown tick: no bookkeeping side effect.
          return { recorded: false };
        }
        const held = parseTickOwner(heldRaw);
        if (!held) return { recorded: false };
        // R06: only the OWNED token completes. A legacy bare-token value keeps
        // plain string-equality semantics (no boot identity to match).
        if (held.legacy ? heldRaw !== token : held.token !== token) {
          return { recorded: false };
        }
        if (!held.legacy) {
          // R06 review partial: completion requires the ENTIRE stored owner
          // tuple — boot AND pid AND start, not an optional boot+token. A
          // completer without its own recorded identity (or with a wrong
          // pid/start) records nothing and never touches the owner's record.
          const completer = owner && Number.isInteger(owner.pid) ? owner : { pid: null, start: null };
          const completerStart = typeof completer.start === 'string' && completer.start ? completer.start : null;
          if (held.boot_id !== (bootId ?? null)) return { recorded: false };
          if (held.pid !== completer.pid) return { recorded: false };
          if (held.start !== completerStart) return { recorded: false };
        }
        db.prepare("DELETE FROM control WHERE key = 'tick_in_progress'").run();
        api._ctrlSet(`tick_done:${token}`, String(now()));
        if (plannedOk) {
          api._ctrlSet('tick_last_successful_wall_ms', String(now()));
          api._ctrlSet('tick_catchup_pending', '0');
          api._ctrlSet('tick_next_due_wall_ms', String(api._nextSlotAfter(now())));
        } else {
          api._ctrlSet('tick_catchup_pending', '1');
        }
        api._audit('TICK_COMPLETE', token, { planned_ok: plannedOk === true });
        return { recorded: true, planned_ok: plannedOk === true };
      });
    },

    schedulerControl() {
      const num = (v) => {
        const n = Number(v);
        return Number.isFinite(n) && n !== 0 ? n : null;
      };
      const owner = parseTickOwner(api._ctrl('tick_in_progress'));
      return {
        last_successful_tick_wall_ms: num(api._ctrl('tick_last_successful_wall_ms')),
        last_tick_boot_id: api._ctrl('tick_last_boot_id') || null,
        next_due_wall_ms: num(api._ctrl('tick_next_due_wall_ms')),
        catchup_pending: api._ctrl('tick_catchup_pending') === '1' ? 1 : 0,
        owner, // R06: the live tick owner record (or null) — exclusive-ownership evidence
      };
    },

    clearOff({ actor }) {
      return api._tx(() => {
        db.prepare("DELETE FROM control WHERE key = 'off'").run();
        api._audit('OFF_CLEARED', null, { actor: actor ?? null });
        return { off: false };
      });
    },

    // --------------------------------------------------------------- plan/status

    plan({ plansDir } = {}) {
      const toFetch = db.prepare(
        `SELECT m.event_id, m.artifact_bytes FROM manifests m
         LEFT JOIN events e ON e.id = m.event_id AND e.sha256 IS NOT NULL
         WHERE e.id IS NULL ORDER BY m.fetched_ms LIMIT 10`,
      ).all();
      const blockers = [];
      const oversize = toFetch.filter((m) => m.artifact_bytes > 1048576);
      if (oversize.length > 0) {
        // same busy-retry discipline as every other write (a bare autocommit
        // UPDATE would crash the process under contention)
        api._tx(() => {
          const mark = db.prepare("UPDATE snapshot_items SET state='BLOCKED_OVERSIZE' WHERE item_id = ?");
          for (const m of oversize) mark.run(m.event_id);
        });
        for (const m of oversize) blockers.push({ code: 'BLOCKED_OVERSIZE', event_id: m.event_id });
      }
      const manifestsToFetch = toFetch.filter((m) => m.artifact_bytes <= 1048576).map((m) => m.event_id);
      const due = api.pendingDeliveries().map((d) => d.delivery_id);
      const cursors = Object.fromEntries(db.prepare('SELECT producer_role, committed_token FROM cursors WHERE committed_token IS NOT NULL').all().map((r) => [r.producer_role, r.committed_token]));
      // R03: durable index continuations (oldest in-progress generation first)
      // and pending DOT_RELAY_IMPORTED receipts — metadata only.
      const continuations = db.prepare('SELECT * FROM index_generations WHERE complete = 0 AND quarantined = 0 ORDER BY first_seen_ms ASC, generation ASC').all().map((g) => ({
        producer_role: g.producer_role,
        generation: g.generation,
        next_page_number: g.next_page_number,
        next_descriptor: g.next_descriptor_json ? JSON.parse(g.next_descriptor_json) : null,
        snapshot_cursor: g.snapshot_cursor,
      }));
      const pendingReceipts = db.prepare("SELECT receipt_id, destination FROM receipt_outbox WHERE state = 'PENDING' ORDER BY created_ms ASC, receipt_id ASC").all();
      const activeExec = db.prepare(`SELECT * FROM executions WHERE state IN ${ACTIVE_IN}`).get() ?? null;
      const planObj = {
        deployment_mode: 'HYBRID',
        manifests_to_fetch: manifestsToFetch,
        delivery_ids: due,
        committed_cursors: cursors,
        index_continuations: continuations,
        locator_resolutions: api.locatorResolutions(),
        pending_receipts: pendingReceipts,
        blockers,
        execution: activeExec ? { id: activeExec.id, state: activeExec.state, solution_id: activeExec.solution_id } : null,
      };
      const text = JSON.stringify(planObj);
      if (Buffer.byteLength(text) > PLAN_LIMIT) throw ledgerError('PLAN_OVERSIZE', 'bridge plan exceeds 32KiB');
      if (plansDir) {
        const target = join(plansDir, 'bridge-plan.json');
        mkdirSync(plansDir, { recursive: true });
        const tmp = join(plansDir, `.bridge-plan.${process.pid}.tmp`);
        writeFileSync(tmp, text, { encoding: 'utf8', mode: 0o600 });
        renameSync(tmp, target);
      }
      return planObj;
    },

    status() {
      const eventStates = {};
      for (const row of db.prepare('SELECT state, COUNT(*) c FROM events GROUP BY state').all()) {
        eventStates[row.state.toLowerCase()] = row.c;
      }
      const outboxTotal = db.prepare('SELECT COUNT(*) c FROM outbox').get().c;
      const outboxPending = db.prepare("SELECT COUNT(*) c FROM outbox WHERE state = 'PENDING'").get().c;
      const activeExec = db.prepare(`SELECT * FROM executions WHERE state IN ${ACTIVE_IN}`).get() ?? null;
      const blockers = [];
      for (const c of db.prepare("SELECT ref FROM audit WHERE event = 'CONFLICT' GROUP BY ref").all()) {
        if (c.ref) blockers.push({ code: 'CONFLICT', event_id: c.ref });
      }
      for (const b of db.prepare("SELECT delivery_id FROM outbox WHERE state = 'BLOCKED'").all()) {
        blockers.push({ code: 'BLOCKED_RETRIES', event_id: b.delivery_id });
      }
      for (const x of db.prepare("SELECT id, state FROM executions WHERE state LIKE 'BLOCKED%' OR state = 'UNCERTAIN'").all()) {
        blockers.push({ code: x.state, event_id: x.id });
      }
      for (const m of db.prepare('SELECT event_id, artifact_bytes FROM manifests WHERE artifact_bytes > 1048576').all()) {
        blockers.push({ code: 'BLOCKED_OVERSIZE', event_id: m.event_id });
      }
      return {
        source_sha: db.prepare("SELECT value FROM control WHERE key='source_sha'").get()?.value ?? SOURCE_SHA,
        deployment_mode: 'HYBRID',
        off: api._isOff(),
        counts: {
          ...eventStates,
          outbox_total: outboxTotal,
          outbox_pending: outboxPending,
        },
        blockers,
        execution: activeExec ? { id: activeExec.id, state: activeExec.state, session_id: activeExec.session_id, head_sha: activeExec.head_sha, pr_url: activeExec.pr_url } : null,
        coordinator_idle_inference: true,
        timer: null,
        next_tick: null,
      };
    },
  };

  // Wire the internal helper that marks snapshot items imported when envelope
  // bytes land (called from ingest via the routing closure).
  const origRoute = api._route.bind(api);
  api._route = (eventId, parentsOk, opts) => {
    const result = origRoute(eventId, parentsOk, opts);
    if (!['WAIT_PARENT', 'WAIT_PARENT_ACK', 'BASELINE_HOLD', 'BLOCKED'].includes(result.state)) {
      try {
        api._markItemImported(eventId);
      } catch {
        /* marking is best-effort inside the caller's transaction */
      }
    }
    return result;
  };

  return api;
}
