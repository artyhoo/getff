// Durable ledger for the Dot review gate — SQLite (node:sqlite), transactional.
//
// Spec §5 (state machine) and §8 (durable ledger): generations keyed by the FULL
// revision tuple, one-use challenges, immutable report records keyed by payload
// digest, transactional outbox with dedup keys, and backup/restore via VACUUM INTO.
//
// Review-driven invariants (2026-10-05 review R2/R3/R10):
//   - R3: the generation digest covers EVERY load-bearing tuple field (repository,
//     PR node, base ref/sha, head, merge-base, tested merge M, policy sha256,
//     protocol version). A retarget, merge-base move or policy promotion therefore
//     opens a NEW generation; a terminal tuple reopens with a new epoch instead of
//     resurrecting spent history. Challenge issuance verifies the passed tuple
//     against the generation's stored tuple.
//   - R2: submitReport enforces, inside the transaction: the challenge belongs to
//     the AUTHENTICATED reviewer (before any replay path), the generation is not
//     superseded/terminal, the lease has not expired, the expected tuple and the
//     asserted generation match the challenge. Identity comes from the caller's
//     authenticated envelope, never from report assertions.
//   - R10: submission writes the report, the state transition and the report.submitted
//     outbox event in ONE transaction; claimGeneration writes generation, challenge
//     and event in one transaction. `openLedger(path, {faultAfter})` injects a throw
//     after a named statement for durability tests; production callers never set it.
//
// Crash-safety rests on SQLite transactions: every mutating entry point is wrapped.
// Receipts are returned, never inferred — a caller re-queries by ids after any crash.

import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { copyFileSync } from 'node:fs';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS generations (
  id TEXT PRIMARY KEY,
  seq INTEGER UNIQUE,
  repository_id INTEGER NOT NULL,
  pr_node_id TEXT,
  tuple_digest TEXT NOT NULL,
  tuple_json TEXT,
  changed_files_json TEXT,
  epoch INTEGER NOT NULL DEFAULT 1,
  state TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_generations_tuple ON generations(tuple_digest);
CREATE TABLE IF NOT EXISTS challenges (
  claim_id TEXT PRIMARY KEY,
  generation_id TEXT NOT NULL REFERENCES generations(id),
  tuple_digest TEXT NOT NULL,
  reviewer_id INTEGER NOT NULL,
  issued_at TEXT NOT NULL,
  consumed_at TEXT,
  payload_digest TEXT
);
CREATE INDEX IF NOT EXISTS idx_challenges_tuple ON challenges(tuple_digest);
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL,
  payload_digest TEXT NOT NULL,
  payload TEXT NOT NULL,
  reviewer_id INTEGER NOT NULL,
  verdict TEXT NOT NULL,
  kind TEXT NOT NULL,
  received_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_digest ON reports(payload_digest);
CREATE TABLE IF NOT EXISTS outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  dedup_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  published_at TEXT
);
CREATE TABLE IF NOT EXISTS side_effects (
  outbox_id INTEGER NOT NULL REFERENCES outbox(id),
  kind TEXT NOT NULL,
  external_id TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  PRIMARY KEY (outbox_id, kind)
);
CREATE TABLE IF NOT EXISTS control (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

const IN_FLIGHT_STATES = ['DISCOVERED', 'WAITING_MECHANICAL', 'ELIGIBLE', 'CLAIMED', 'REVIEWING', 'SUBMITTED', 'VALIDATING'];
const TERMINAL_STATES = ['AUTHORIZED', 'BLOCKED', 'MERGED', 'CLOSED', 'INCOMPLETE', 'SUPERSEDED'];

// spec §5 state machine — the only legal transitions
const TRANSITIONS = {
  DISCOVERED: ['WAITING_MECHANICAL', 'ELIGIBLE', 'CLAIMED', 'CLOSED', 'SUPERSEDED'],
  WAITING_MECHANICAL: ['ELIGIBLE', 'CLOSED', 'SUPERSEDED'],
  ELIGIBLE: ['CLAIMED', 'CLOSED', 'SUPERSEDED'],
  CLAIMED: ['REVIEWING', 'CLOSED', 'SUPERSEDED'],
  REVIEWING: ['SUBMITTED', 'CLOSED', 'SUPERSEDED'],
  SUBMITTED: ['VALIDATING', 'CLOSED', 'SUPERSEDED'],
  VALIDATING: ['AUTHORIZED', 'BLOCKED', 'CLOSED', 'SUPERSEDED'],
  AUTHORIZED: ['MERGED'],
  BLOCKED: [],
  MERGED: [],
  CLOSED: [],
  INCOMPLETE: [],
  SUPERSEDED: [],
};

export function payloadDigest(text) {
  return createHash('sha256').update(text).digest('hex');
}

// R3: the whole tuple is load-bearing — every field participates in the digest.
// Explicit nulls keep JSON canonicalization stable for absent optional fields.
export function tupleDigest(t) {
  const canon = JSON.stringify({
    repository_id: t.repository_id,
    pr_node_id: t.pr_node_id ?? null,
    base_ref: t.base_ref ?? null,
    base_sha: t.base_sha ?? null,
    head_sha: t.head_sha ?? null,
    merge_base_sha: t.merge_base_sha ?? null,
    tested_merge_sha: t.tested_merge_sha ?? null,
    policy_sha256: t.policy_sha256 ?? null,
    protocol_version: t.protocol_version ?? null,
  });
  return payloadDigest(canon);
}

function isTerminal(state) {
  return TERMINAL_STATES.includes(state);
}

function code(name, message) {
  const e = new Error(message);
  e.code = name;
  return e;
}

export function openLedger(dbPath, { faultAfter } = {}) {
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  const now = () => new Date().toISOString();

  // node:sqlite has no better-sqlite3-style .transaction() helper — run the explicit
  // BEGIN IMMEDIATE / COMMIT / ROLLBACK sequence. Single-writer + WAL keeps the same
  // durability guarantees for this service's one-writer topology (spec §8).
  const tx = (fn) => {
    db.exec('BEGIN IMMEDIATE');
    try {
      const out = fn();
      db.exec('COMMIT');
      return out;
    } catch (e) {
      try { db.exec('ROLLBACK'); } catch { /* connection-level failure: nothing to roll back */ }
      throw e;
    }
  };

  // R10 fault injection: throw after a named statement INSIDE the tx so tests can
  // prove the surrounding transaction rolls back completely. Production never sets it.
  const mark = (name) => {
    if (faultAfter === name) throw new Error(`fault-after:${name}`);
  };

  // shared generation open: supersede stale in-flight generations of the same PR,
  // reuse an in-flight generation of THIS tuple, or open a fresh epoch (R3).
  const openGeneration = (tuple) => {
    const digest = tupleDigest(tuple);
    for (const old of db.prepare(
      `SELECT id FROM generations
       WHERE tuple_digest != ? AND pr_node_id IS ?
         AND state IN ('DISCOVERED','WAITING_MECHANICAL','ELIGIBLE','CLAIMED','REVIEWING','SUBMITTED','VALIDATING')`,
    ).all(digest, tuple.pr_node_id ?? null)) {
      db.prepare('UPDATE generations SET state = ?, updated_at = ? WHERE id = ?')
        .run('SUPERSEDED', now(), old.id);
    }
    const existing = db.prepare(
      `SELECT * FROM generations WHERE tuple_digest = ? AND state IN ('DISCOVERED','WAITING_MECHANICAL','ELIGIBLE','CLAIMED','REVIEWING','SUBMITTED','VALIDATING')
       ORDER BY epoch DESC LIMIT 1`,
    ).get(digest);
    if (existing) return existing;
    const epoch = (db.prepare('SELECT MAX(epoch) AS e FROM generations WHERE tuple_digest = ?').get(digest).e ?? 0) + 1;
    const seq = (db.prepare('SELECT MAX(seq) AS s FROM generations').get().s ?? 0) + 1;
    const id = randomUUID();
    const ts = now();
    db.prepare(
      'INSERT INTO generations (id, seq, repository_id, pr_node_id, tuple_digest, tuple_json, changed_files_json, epoch, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(id, seq, tuple.repository_id, tuple.pr_node_id ?? null, digest, JSON.stringify(tuple), null, epoch, 'DISCOVERED', ts, ts);
    return db.prepare('SELECT * FROM generations WHERE id = ?').get(id);
  };

  const issueChallengeTx = (generationId, tuple, reviewerId, { max_attempts_per_tuple, lease_minutes, nowMs = Date.now() }) => {
    const digest = tupleDigest(tuple);
    const gen = db.prepare('SELECT * FROM generations WHERE id = ?').get(generationId);
    if (!gen) throw code('E_NOT_FOUND', `generation ${generationId} does not exist`);
    // tuple verification BEFORE state checks: a caller handing the wrong tuple is a
    // binding bug regardless of lifecycle position (review R3).
    if (gen.tuple_digest !== digest) {
      throw code('E_TUPLE_MISMATCH', `tuple does not match the generation's stored tuple`);
    }
    if (gen.state === 'SUPERSEDED' || isTerminal(gen.state)) {
      throw code('E_NOT_CLAIMABLE', `generation ${generationId} is ${gen.state}, not claimable`);
    }
    const attempts = db.prepare(
      'SELECT COUNT(*) AS n FROM challenges WHERE tuple_digest = ?',
    ).get(digest).n;
    if (attempts >= max_attempts_per_tuple) {
      throw code('E_EXHAUSTED', `attempt ${attempts + 1} exceeds max_attempts_per_tuple=${max_attempts_per_tuple}`);
    }
    // an EXPIRED claim no longer blocks a re-claim — that is what the lease means
    const active = db.prepare(
      'SELECT issued_at FROM challenges WHERE generation_id = ? AND consumed_at IS NULL',
    ).get(generationId);
    const activeLive = active && (() => {
      const issued = Date.parse(active.issued_at);
      return !(Number.isFinite(issued) && nowMs > issued + lease_minutes * 60 * 1000);
    })();
    if (activeLive) throw code('E_ALREADY_CLAIMED', `generation ${generationId} holds an active claim`);
    const claimId = randomUUID();
    const issuedAt = new Date(nowMs).toISOString();
    db.prepare(
      'INSERT INTO challenges (claim_id, generation_id, tuple_digest, reviewer_id, issued_at) VALUES (?, ?, ?, ?, ?)',
    ).run(claimId, generationId, digest, reviewerId, issuedAt);
    db.prepare('UPDATE generations SET state = ?, updated_at = ? WHERE id = ?')
      .run('CLAIMED', now(), generationId);
    return { claim_id: claimId, generation_id: generationId, issued_at: issuedAt };
  };

  // outbox insert without its own transaction wrapper — for composition inside a
  // caller's transaction (claimGeneration, submitReport). Public outboxEnqueue wraps it.
  const outboxEnqueueTx = (eventType, payload, dedupKey) => {
    const existing = db.prepare('SELECT * FROM outbox WHERE dedup_key = ?').get(dedupKey);
    if (existing) {
      existing._dedup_hit = true;
      return existing;
    }
    const info = db.prepare(
      'INSERT INTO outbox (event_type, payload, dedup_key, created_at) VALUES (?, ?, ?, ?)',
    ).run(eventType, JSON.stringify(payload ?? {}), dedupKey, now());
    return db.prepare('SELECT * FROM outbox WHERE id = ?').get(info.lastInsertRowid);
  };

  const ledger = {
    dbPath,

    // Discovery/reopen only — does not claim. claimGeneration is the claiming path.
    beginGeneration(tuple) {
      return tx(() => openGeneration(tuple));
    },

    // Issue a challenge against an EXISTING generation (service recovery paths).
    issueChallenge(generationId, tuple, reviewerId, opts = {}) {
      return tx(() => issueChallengeTx(generationId, tuple, reviewerId, {
        max_attempts_per_tuple: opts.max_attempts_per_tuple ?? opts.maxAttemptsPerTuple,
        lease_minutes: opts.lease_minutes ?? opts.leaseMinutes,
        nowMs: opts.nowMs,
      }));
    },

    // One transaction: open/reuse the generation, issue the challenge, enqueue the
    // claimed event (R10). changedFiles pins the trusted diff inventory the report
    // will be validated against (review R4).
    claimGeneration({ tuple, reviewerId, maxAttemptsPerTuple, leaseMinutes, nowMs = Date.now(), changedFiles, outboxDedupKey } = {}) {
      if (!Number.isInteger(reviewerId)) throw code('E_LIMITS', 'claimGeneration requires the authenticated reviewerId');
      if (!Number.isInteger(maxAttemptsPerTuple) || !Number.isInteger(leaseMinutes)) {
        throw code('E_LIMITS', 'claimGeneration requires maxAttemptsPerTuple and leaseMinutes');
      }
      return tx(() => {
        const generation = openGeneration(tuple);
        const challenge = issueChallengeTx(generation.id, tuple, reviewerId, { max_attempts_per_tuple: maxAttemptsPerTuple, lease_minutes: leaseMinutes, nowMs });
        if (changedFiles !== undefined) {
          db.prepare('UPDATE generations SET changed_files_json = ? WHERE id = ?')
            .run(JSON.stringify(changedFiles), generation.id);
        }
        outboxEnqueueTx('generation.claimed', { generation: generation.id, claim: challenge.claim_id }, outboxDedupKey ?? `gen-claim:${generation.id}:${challenge.claim_id}`);
        // re-read: issueChallengeTx advanced the state after openGeneration's snapshot
        const fresh = db.prepare('SELECT * FROM generations WHERE id = ?').get(generation.id);
        return { generation: fresh, claim: challenge };
      });
    },

    // Spec §5 transition — guarded; invalid transitions refuse.
    transitionGeneration(id, to) {
      return tx(() => {
        const gen = db.prepare('SELECT state FROM generations WHERE id = ?').get(id);
        if (!gen) throw code('E_NOT_FOUND', `generation ${id} does not exist`);
        const allowed = TRANSITIONS[gen.state] ?? [];
        if (!allowed.includes(to)) {
          throw code('E_INVALID_TRANSITION', `${gen.state} → ${to} is not a legal transition`);
        }
        db.prepare('UPDATE generations SET state = ?, updated_at = ? WHERE id = ?').run(to, now(), id);
        return db.prepare('SELECT * FROM generations WHERE id = ?').get(id);
      });
    },

    getGeneration(id) {
      return db.prepare('SELECT * FROM generations WHERE id = ?').get(id);
    },

    // R2+R10: consume the one-use challenge and store the report — with every
    // binding check inside the transaction, and the outbox event in the same tx.
    // assertedGenerationSeq is the INTEGER generation handle the envelope carries
    // (the report schema types generation as a number); it must match the challenge.
    submitReport({
      claimId, reviewerId, digest, payload, verdict, kind,
      leaseMinutes, nowMs = Date.now(),
      expectedTupleDigest, assertedGenerationSeq, outboxDedupKey,
    } = {}) {
      if (!Number.isInteger(leaseMinutes)) {
        throw code('E_LIMITS', 'submitReport requires leaseMinutes');
      }
      return tx(() => {
        const ch = db.prepare('SELECT * FROM challenges WHERE claim_id = ?').get(claimId);
        if (!ch) throw code('E_NOT_FOUND', `unknown claim ${claimId}`);
        // the AUTHENTICATED reviewer binds before anything else — including replay
        if (ch.reviewer_id !== reviewerId) {
          throw code('E_REVIEWER', `claim ${claimId} belongs to reviewer ${ch.reviewer_id}, not ${reviewerId}`);
        }
        if (ch.consumed_at) {
          if (ch.payload_digest === digest) {
            const existing = db.prepare('SELECT id FROM reports WHERE payload_digest = ?').get(digest);
            return { report_id: existing.id, replayed: true };
          }
          throw code('E_CONFLICT', 'challenge already consumed with a different payload');
        }
        const gen = db.prepare('SELECT * FROM generations WHERE id = ?').get(ch.generation_id);
        if (gen.state === 'SUPERSEDED') {
          throw code('E_SUPERSEDED', 'generation was superseded — the tuple moved during review');
        }
        if (isTerminal(gen.state)) {
          throw code('E_GENERATION_GONE', `generation is ${gen.state} — no new submissions`);
        }
        const issuedMs = Date.parse(ch.issued_at);
        if (Number.isFinite(issuedMs) && nowMs > issuedMs + leaseMinutes * 60 * 1000) {
          throw code('E_LEASE_EXPIRED', `claim lease of ${leaseMinutes}min expired`);
        }
        if (expectedTupleDigest !== undefined && expectedTupleDigest !== ch.tuple_digest) {
          throw code('E_TUPLE_MISMATCH', 'current tuple does not match the challenged tuple');
        }
        if (assertedGenerationSeq !== undefined) {
          const asserted = db.prepare('SELECT id FROM generations WHERE seq = ?').get(assertedGenerationSeq);
          if (!asserted || asserted.id !== ch.generation_id) {
            throw code('E_GENERATION', 'asserted generation does not match the challenged generation');
          }
        }
        const byDigest = db.prepare('SELECT id FROM reports WHERE payload_digest = ?').get(digest);
        if (byDigest) return { report_id: byDigest.id, replayed: true };
        const id = randomUUID();
        db.prepare(
          'INSERT INTO reports (id, claim_id, payload_digest, payload, reviewer_id, verdict, kind, received_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        ).run(id, claimId, digest, payload, reviewerId, verdict, kind, now());
        mark('report-insert');
        db.prepare('UPDATE challenges SET consumed_at = ?, payload_digest = ? WHERE claim_id = ?')
          .run(now(), digest, claimId);
        if (gen.state === 'CLAIMED' || gen.state === 'REVIEWING') {
          db.prepare('UPDATE generations SET state = ?, updated_at = ? WHERE id = ?').run('SUBMITTED', now(), gen.id);
        }
        outboxEnqueueTx('report.submitted', { report_id: id, digest }, outboxDedupKey ?? `report:${digest}`);
        mark('outbox-enqueue');
        return { report_id: id, replayed: false };
      });
    },

    getReport(id) {
      return db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
    },

    getChallenge(claimId) {
      return db.prepare('SELECT * FROM challenges WHERE claim_id = ?').get(claimId);
    },

    outboxEnqueue(eventType, payload, dedupKey) {
      return tx(() => outboxEnqueueTx(eventType, payload, dedupKey));
    },

    outboxClaimBatch(limit) {
      return db.prepare(
        'SELECT * FROM outbox WHERE published_at IS NULL ORDER BY id LIMIT ?',
      ).all(limit);
    },

    outboxMarkPublished(id) {
      db.prepare('UPDATE outbox SET published_at = ? WHERE id = ?').run(now(), id);
    },

    recordSideEffect(outboxId, kind, externalId) {
      db.prepare(
        'INSERT OR REPLACE INTO side_effects (outbox_id, kind, external_id, recorded_at) VALUES (?, ?, ?, ?)',
      ).run(outboxId, kind, externalId, now());
    },

    // Live claims: unconsumed AND unexpired challenges on this PR (review R11 —
    // lease expiry must free the claim slot). Lease parameters are required: an
    // unbounded lease is the bug this method exists to prevent.
    countActiveClaims(prNodeId, { nowMs = Date.now(), leaseMinutes } = {}) {
      if (!Number.isInteger(leaseMinutes)) {
        throw code('E_LIMITS', 'countActiveClaims requires leaseMinutes');
      }
      const rows = db.prepare(
        `SELECT c.issued_at
         FROM generations g
         JOIN challenges c ON c.generation_id = g.id AND c.consumed_at IS NULL
         WHERE g.pr_node_id IS ? AND g.state = 'CLAIMED'`,
      ).all(prNodeId ?? null);
      return rows.filter((r) => {
        const issued = Date.parse(r.issued_at);
        return !(Number.isFinite(issued) && nowMs > issued + leaseMinutes * 60 * 1000);
      }).length;
    },

    // VACUUM INTO writes a consistent snapshot without engine-specific backup APIs.
    backup(destPath) {
      db.prepare("VACUUM INTO ?").run(destPath);
    },

    // Operator pause (review R11): a durable service-level flag. It stops NEW claims
    // and publications; native pause (the ruleset) remains the boundary that also
    // stops already-armed PRs — this flag never substitutes it.
    setPaused(paused) {
      db.prepare(
        'INSERT INTO control (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
      ).run('paused', paused ? 'true' : 'false', now());
    },

    isPaused() {
      const row = db.prepare('SELECT value FROM control WHERE key = ?').get('paused');
      return row?.value === 'true';
    },

    counts() {
      const one = (sql) => db.prepare(sql).get().n;
      return {
        generations: one('SELECT COUNT(*) AS n FROM generations'),
        challenges: one('SELECT COUNT(*) AS n FROM challenges'),
        reports: one('SELECT COUNT(*) AS n FROM reports'),
        outbox_pending: one('SELECT COUNT(*) AS n FROM outbox WHERE published_at IS NULL'),
      };
    },
  };
  return ledger;
}

export function restoreLedger(backupPath, destPath) {
  copyFileSync(backupPath, destPath);
  return openLedger(destPath);
}
