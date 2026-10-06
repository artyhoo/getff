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
CREATE TABLE IF NOT EXISTS finding_occurrences (
  id TEXT PRIMARY KEY,
  finding_key TEXT NOT NULL,
  source_report_id TEXT NOT NULL,
  requirement TEXT,
  category TEXT,
  severity TEXT,
  blocking INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_occurrences_key ON finding_occurrences(finding_key);
CREATE TABLE IF NOT EXISTS finding_claims (
  assignment_id TEXT PRIMARY KEY,
  occurrence_id TEXT NOT NULL REFERENCES finding_occurrences(id),
  owner TEXT NOT NULL,
  fencing_token TEXT NOT NULL,
  claimed_at TEXT NOT NULL,
  lease_expires_at TEXT NOT NULL,
  state TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_claims_occurrence ON finding_claims(occurrence_id);
CREATE TABLE IF NOT EXISTS finding_receipts (
  id TEXT PRIMARY KEY,
  occurrence_id TEXT NOT NULL REFERENCES finding_occurrences(id),
  kind TEXT NOT NULL,
  revision TEXT,
  payload_digest TEXT NOT NULL,
  payload TEXT NOT NULL,
  recorded_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_receipts_occurrence ON finding_receipts(occurrence_id);
CREATE TABLE IF NOT EXISTS retry_reservations (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  max INTEGER NOT NULL,
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

// Finding lifecycle (follow-up packet increment 4 / §6). Occurrence states are the
// packet's table; closure dispositions are the packet's allowlist. Claims are the
// single-active-corrective-owner rule: an expired lease does NOT free the slot by
// itself (lease expiry is not cessation) — replacement requires an explicit revoke.
const FINDING_OPEN_STATES = ['OPEN', 'ASSIGNED', 'ACKNOWLEDGED', 'VERIFYING', 'DECISION_REQUIRED'];
const RECEIPT_KINDS = ['fix_response', 'check_receipt', 'change_review', 'dot_closure', 'closure', 'revoke'];
const CLOSURE_DISPOSITIONS = ['VERIFIED', 'ALREADY_FIXED', 'NOT_APPLICABLE', 'REJECTED_WITH_EVIDENCE'];

function code(name, message) {
  const e = new Error(message);
  e.code = name;
  return e;
}

export function openLedger(dbPath, { faultAfter } = {}) {
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  // additive migrations for ledgers created by earlier revisions of this module
  // (fresh databases already carry every column via SCHEMA)
  const ensureColumn = (table, column, ddl) => {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
    if (!cols.includes(column)) db.exec(ddl);
  };
  ensureColumn('finding_receipts', 'actor', 'ALTER TABLE finding_receipts ADD COLUMN actor TEXT');
  ensureColumn('finding_occurrences', 'repository_id', 'ALTER TABLE finding_occurrences ADD COLUMN repository_id INTEGER');
  ensureColumn('finding_occurrences', 'pr_node_id', 'ALTER TABLE finding_occurrences ADD COLUMN pr_node_id TEXT');
  ensureColumn('reports', 'superseded_at', 'ALTER TABLE reports ADD COLUMN superseded_at TEXT');
  ensureColumn('reports', 'envelope_digest', 'ALTER TABLE reports ADD COLUMN envelope_digest TEXT');
  ensureColumn('reports', 'envelope_bytes', 'ALTER TABLE reports ADD COLUMN envelope_bytes TEXT');
  ensureColumn('reports', 'received_via', 'ALTER TABLE reports ADD COLUMN received_via TEXT');
  ensureColumn('outbox', 'claimed_at', 'ALTER TABLE outbox ADD COLUMN claimed_at TEXT');
  ensureColumn('outbox', 'attempts', 'ALTER TABLE outbox ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0');
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
    //
    // DR-R3: a correctly issued report submitted after the tuple moved (a newer head
    // landed, the generation was superseded, or the source reached a terminal state)
    // is preserved as SUPERSEDED HISTORY — superseded_at set, admission false —
    // instead of being refused. Rejection from admission is not rejection from
    // storage. The lease refusal still guards claims on a CURRENT tuple (a fresh
    // review is cheap there); a moved tuple's findings are worth keeping, so the
    // lease does not destroy them. `liveTupleDigest` is the digest of the CURRENT
    // repository tuple at submit time; replay always returns the existing receipt.
    submitReport({
      claimId, reviewerId, digest, payload, verdict, kind,
      leaseMinutes, nowMs = Date.now(),
      liveTupleDigest, assertedGenerationSeq, outboxDedupKey,
      envelopeBytes, envelopeDigest, receivedVia,
    } = {}) {
      if (!Number.isInteger(leaseMinutes)) {
        throw code('E_LIMITS', 'submitReport requires leaseMinutes');
      }
      // the stored provenance bytes are BOUNDED — the same 1 MiB the intake enforces
      // on the request body; a caller handing more is refused at the persistence
      // boundary, not silently truncated
      if (envelopeBytes !== undefined && envelopeBytes.length > 1024 * 1024) {
        throw code('E_LIMITS', `envelope bytes exceed the 1 MiB store bound (${envelopeBytes.length})`);
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
            const existing = db.prepare('SELECT id, superseded_at FROM reports WHERE payload_digest = ?').get(digest);
            return { report_id: existing.id, replayed: true, superseded: existing.superseded_at != null, admitted: existing.superseded_at == null };
          }
          throw code('E_CONFLICT', 'challenge already consumed with a different payload');
        }
        const gen = db.prepare('SELECT * FROM generations WHERE id = ?').get(ch.generation_id);
        const tupleMoved =
          gen.state === 'SUPERSEDED' || isTerminal(gen.state) ||
          (liveTupleDigest !== undefined && liveTupleDigest !== ch.tuple_digest);
        const issuedMs = Date.parse(ch.issued_at);
        if (!tupleMoved && Number.isFinite(issuedMs) && nowMs > issuedMs + leaseMinutes * 60 * 1000) {
          throw code('E_LEASE_EXPIRED', `claim lease of ${leaseMinutes}min expired`);
        }
        if (assertedGenerationSeq !== undefined) {
          const asserted = db.prepare('SELECT id FROM generations WHERE seq = ?').get(assertedGenerationSeq);
          if (!asserted || asserted.id !== ch.generation_id) {
            throw code('E_GENERATION', 'asserted generation does not match the challenged generation');
          }
        }
        const byDigest = db.prepare('SELECT id, superseded_at FROM reports WHERE payload_digest = ?').get(digest);
        if (byDigest) return { report_id: byDigest.id, replayed: true, superseded: byDigest.superseded_at != null, admitted: byDigest.superseded_at == null };
        const superseded = tupleMoved;
        const id = randomUUID();
        db.prepare(
          'INSERT INTO reports (id, claim_id, payload_digest, payload, reviewer_id, verdict, kind, superseded_at, envelope_digest, envelope_bytes, received_via, received_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ).run(id, claimId, digest, payload, reviewerId, verdict, kind, superseded ? now() : null, envelopeDigest ?? null, envelopeBytes ?? null, receivedVia ?? null, now());
        mark('report-insert');
        db.prepare('UPDATE challenges SET consumed_at = ?, payload_digest = ? WHERE claim_id = ?')
          .run(now(), digest, claimId);
        if (!superseded && (gen.state === 'CLAIMED' || gen.state === 'REVIEWING')) {
          db.prepare('UPDATE generations SET state = ?, updated_at = ? WHERE id = ?').run('SUBMITTED', now(), gen.id);
        }
        outboxEnqueueTx('report.submitted', { report_id: id, digest, superseded }, outboxDedupKey ?? `report:${digest}`);
        mark('outbox-enqueue');
        return { report_id: id, replayed: false, superseded, admitted: !superseded };
      });
    },

    getReport(id) {
      return db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
    },

    getChallenge(claimId) {
      return db.prepare('SELECT * FROM challenges WHERE claim_id = ?').get(claimId);
    },

    // ── finding lifecycle (packet §6 / increment 4) ─────────────────────────────
    // Occurrences are recorded per accepted report; a replay of the SAME report
    // records nothing new (dedup on finding_key + source_report_id). A later report
    // sighting the same key opens a NEW occurrence — lineage is append-only.
    // Occurrences recorded through a real report chain carry the report's PR scope
    // (repository_id + pr_node_id from the issuing generation); scopeless rows keep
    // the legacy per-key behavior. When an active claim exists on an OLDER occurrence
    // of the key, the assignment rebinds to the NEWEST one (DR-R2): recurrence while
    // a fixer is active must not admit a second owner nor orphan the active one.
    recordFindings(reportId, findings) {
      return tx(() => {
        let inserted = 0;
        const rep = db.prepare('SELECT claim_id FROM reports WHERE id = ?').get(reportId);
        const ch = rep ? db.prepare('SELECT generation_id FROM challenges WHERE claim_id = ?').get(rep.claim_id) : undefined;
        const gen = ch ? db.prepare('SELECT repository_id, pr_node_id FROM generations WHERE id = ?').get(ch.generation_id) : undefined;
        const scope = gen ? { repository_id: gen.repository_id, pr_node_id: gen.pr_node_id ?? null } : { repository_id: null, pr_node_id: null };
        for (const f of findings ?? []) {
          if (!f?.key) throw code('E_LIMITS', 'recordFindings requires finding.key');
          const dup = db.prepare(
            'SELECT id FROM finding_occurrences WHERE finding_key = ? AND source_report_id = ?',
          ).get(f.key, reportId);
          if (dup) continue;
          const ts = now();
          const id = randomUUID();
          db.prepare(
            'INSERT INTO finding_occurrences (id, finding_key, source_report_id, requirement, category, severity, blocking, repository_id, pr_node_id, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          ).run(id, f.key, reportId, f.requirement ?? null, f.category ?? null, f.severity ?? null, f.blocking ? 1 : 0, scope.repository_id, scope.pr_node_id, 'OPEN', ts, ts);
          inserted += 1;
          if (scope.repository_id !== null) {
            const activeClaim = db.prepare(
              `SELECT c.* FROM finding_claims c
               JOIN finding_occurrences o ON o.id = c.occurrence_id
               WHERE o.finding_key = ? AND c.state IN ('ASSIGNED','ACKNOWLEDGED')
               ORDER BY c.claimed_at DESC LIMIT 1`,
            ).get(f.key);
            if (activeClaim && activeClaim.occurrence_id !== id) {
              db.prepare('UPDATE finding_claims SET occurrence_id = ? WHERE assignment_id = ?').run(id, activeClaim.assignment_id);
              db.prepare('UPDATE finding_occurrences SET state = ?, updated_at = ? WHERE id = ?').run(activeClaim.state, ts, id);
            }
          }
        }
        return { inserted };
      });
    },

    listOpenFindings() {
      return db.prepare(
        `SELECT * FROM finding_occurrences WHERE state IN (${FINDING_OPEN_STATES.map(() => '?').join(',')}) ORDER BY rowid`,
      ).all(...FINDING_OPEN_STATES);
    },

    lineage(findingKey) {
      return db.prepare(
        'SELECT * FROM finding_occurrences WHERE finding_key = ? ORDER BY rowid',
      ).all(findingKey);
    },

    getOccurrence(id) {
      return db.prepare('SELECT * FROM finding_occurrences WHERE id = ?').get(id);
    },

    // One active corrective owner per repository/PR (DR-R2): for scoped occurrences
    // the fence spans EVERY finding and occurrence of the same PR — a claim on any
    // of them refuses a second owner, and an EXPIRED one still holds the whole scope
    // until an explicit revoke (lease expiry alone does not prove the old worker
    // stopped, E_CESSATION_UNKNOWN). Recurrence of an actively-claimed key rebinds
    // the existing assignment to the newest occurrence (recordFindings), so the
    // owner continues without a second claim. Scopeless (fixture) rows keep the
    // legacy per-occurrence fence.
    claimFinding({ findingKey, owner, leaseMinutes, nowMs = Date.now() } = {}) {
      if (!owner || !Number.isInteger(leaseMinutes) || leaseMinutes <= 0) {
        throw code('E_LIMITS', 'claimFinding requires owner and a positive leaseMinutes');
      }
      return tx(() => {
        const tail = db.prepare(
          'SELECT * FROM finding_occurrences WHERE finding_key = ? ORDER BY rowid DESC LIMIT 1',
        ).get(findingKey);
        if (!tail) throw code('E_NOT_FOUND', `no occurrence of finding "${findingKey}"`);
        if (tail.state === 'RESOLVED') throw code('E_ALREADY_RESOLVED', `finding "${findingKey}" is resolved at its latest occurrence`);
        const scoped = tail.repository_id !== null && tail.repository_id !== undefined;
        const active = scoped
          ? db.prepare(
              `SELECT c.*, o.finding_key AS claimed_key FROM finding_claims c
               JOIN finding_occurrences o ON o.id = c.occurrence_id
               WHERE c.state IN ('ASSIGNED','ACKNOWLEDGED')
                 AND o.repository_id IS ? AND o.pr_node_id IS ?
               ORDER BY c.claimed_at DESC LIMIT 1`,
            ).get(tail.repository_id, tail.pr_node_id)
          : db.prepare(
              `SELECT c.* FROM finding_claims c
               WHERE c.occurrence_id = ? AND c.state IN ('ASSIGNED','ACKNOWLEDGED')
               ORDER BY c.claimed_at DESC LIMIT 1`,
            ).get(tail.id);
        if (active) {
          if (Date.parse(active.lease_expires_at) > nowMs) {
            throw code('E_ALREADY_CLAIMED', `${scoped ? `PR is` : `finding "${findingKey}" is`} claimed by ${active.owner} (finding "${active.claimed_key ?? findingKey}") until ${active.lease_expires_at}`);
          }
          throw code('E_CESSATION_UNKNOWN', `the expired claim of ${active.owner} was not revoked — cessation is not established, replacement held`);
        }
        const assignmentId = randomUUID();
        const token = randomUUID();
        const claimedAt = new Date(nowMs).toISOString();
        const expiresAt = new Date(nowMs + leaseMinutes * 60 * 1000).toISOString();
        db.prepare(
          'INSERT INTO finding_claims (assignment_id, occurrence_id, owner, fencing_token, claimed_at, lease_expires_at, state) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ).run(assignmentId, tail.id, owner, token, claimedAt, expiresAt, 'ASSIGNED');
        db.prepare('UPDATE finding_occurrences SET state = ?, updated_at = ? WHERE id = ?').run('ASSIGNED', now(), tail.id);
        return { assignment_id: assignmentId, fencing_token: token, occurrence_id: tail.id, lease_expires_at: expiresAt };
      });
    },

    // Every consumer of an assignment must present the CURRENT fencing token; a
    // revoked (or unknown) assignment refuses the same way — a stale worker cannot
    // push work into the lifecycle after it was replaced.
    requireClaim(assignmentId, fencingToken) {
      const c = db.prepare('SELECT * FROM finding_claims WHERE assignment_id = ?').get(assignmentId);
      if (!c || c.fencing_token !== fencingToken || c.state === 'REVOKED') {
        throw code('E_FENCING', `assignment ${assignmentId} does not accept this token`);
      }
      return c;
    },

    acknowledgeFinding({ assignmentId, fencingToken, workLocation, nowMs = Date.now() } = {}) {
      return tx(() => {
        const c = this.requireClaim(assignmentId, fencingToken);
        const occ = db.prepare('SELECT state FROM finding_occurrences WHERE id = ?').get(c.occurrence_id);
        if (!occ || occ.state !== 'ASSIGNED') throw code('E_STATE', `occurrence is ${occ?.state}, not ASSIGNED`);
        db.prepare('UPDATE finding_claims SET state = ? WHERE assignment_id = ?').run('ACKNOWLEDGED', assignmentId);
        db.prepare('UPDATE finding_occurrences SET state = ?, updated_at = ? WHERE id = ?').run('ACKNOWLEDGED', now(), c.occurrence_id);
        if (workLocation !== undefined) {
          db.prepare('INSERT INTO finding_receipts (id, occurrence_id, kind, revision, payload_digest, payload, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .run(randomUUID(), c.occurrence_id, 'ack', workLocation, payloadDigest(String(workLocation)), JSON.stringify({ work_location: workLocation }), now());
        }
        return { assignment_id: assignmentId, state: 'ACKNOWLEDGED' };
      });
    },

    recordFixResponse({ assignmentId, fencingToken, fixRevision, digest, payload, nowMs = Date.now() } = {}) {
      return tx(() => {
        const c = this.requireClaim(assignmentId, fencingToken);
        if (!digest) throw code('E_LIMITS', 'recordFixResponse requires a payload digest');
        db.prepare('INSERT INTO finding_receipts (id, occurrence_id, kind, revision, payload_digest, payload, actor, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .run(randomUUID(), c.occurrence_id, 'fix_response', fixRevision ?? null, digest, payload ?? '{}', c.owner, now());
        db.prepare('UPDATE finding_occurrences SET state = ?, updated_at = ? WHERE id = ?').run('VERIFYING', now(), c.occurrence_id);
        return { occurrence_id: c.occurrence_id, state: 'VERIFYING' };
      });
    },

    revokeClaim({ assignmentId, reason, nowMs = Date.now() } = {}) {
      return tx(() => {
        const c = db.prepare('SELECT * FROM finding_claims WHERE assignment_id = ?').get(assignmentId);
        if (!c) throw code('E_NOT_FOUND', `unknown assignment ${assignmentId}`);
        db.prepare('UPDATE finding_claims SET state = ? WHERE assignment_id = ?').run('REVOKED', assignmentId);
        const occ = db.prepare('SELECT state FROM finding_occurrences WHERE id = ?').get(c.occurrence_id);
        if (occ && ['ASSIGNED', 'ACKNOWLEDGED'].includes(occ.state)) {
          db.prepare('UPDATE finding_occurrences SET state = ?, updated_at = ? WHERE id = ?').run('OPEN', now(), c.occurrence_id);
        }
        db.prepare('INSERT INTO finding_receipts (id, occurrence_id, kind, revision, payload_digest, payload, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(randomUUID(), c.occurrence_id, 'revoke', null, payloadDigest(String(reason ?? '')), JSON.stringify({ reason: reason ?? '', owner: c.owner }), now());
        return { assignment_id: assignmentId, revoked: true };
      });
    },

    recordReceipt({ occurrenceId, kind, revision, digest, payload, actor, nowMs = Date.now() } = {}) {
      return tx(() => {
        if (!RECEIPT_KINDS.includes(kind)) throw code('E_DISPOSITION', `receipt kind "${kind}" is not in the allowlist`);
        const occ = db.prepare('SELECT id FROM finding_occurrences WHERE id = ?').get(occurrenceId);
        if (!occ) throw code('E_NOT_FOUND', `unknown occurrence ${occurrenceId}`);
        const id = randomUUID();
        db.prepare('INSERT INTO finding_receipts (id, occurrence_id, kind, revision, payload_digest, payload, actor, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .run(id, occurrenceId, kind, revision ?? null, digest ?? payloadDigest(String(payload ?? '')), payload ?? '{}', actor ?? null, now());
        return { receipt_id: id };
      });
    },

    // Closure is mechanical, not asserted (DR-R1): the LATEST fix_response binds the
    // evidence set — everything must be recorded AFTER it and ON its revision. VERIFIED
    // requires: a SUCCESSFUL mechanical check receipt after the fix (absent/pending/
    // cancelled are not success; the latest check is the current word), an INDEPENDENT
    // change review (actor present, actor != fix owner, after the fix, on the fix
    // revision — self-reviews and pre-fix reviews do not count), and an applicable Dot
    // closure receipt after the fix. ALREADY_FIXED requires a successful check receipt;
    // NOT_APPLICABLE / REJECTED_WITH_EVIDENCE require at least one evidence receipt.
    recordClosure({ findingKey, disposition, verifier, revision, nowMs = Date.now() } = {}) {
      return tx(() => {
        if (!CLOSURE_DISPOSITIONS.includes(disposition)) {
          throw code('E_DISPOSITION', `closure disposition "${disposition}" is not in the allowlist`);
        }
        const tail = db.prepare(
          'SELECT * FROM finding_occurrences WHERE finding_key = ? ORDER BY rowid DESC LIMIT 1',
        ).get(findingKey);
        if (!tail) throw code('E_NOT_FOUND', `no occurrence of finding "${findingKey}"`);
        if (tail.state === 'RESOLVED') throw code('E_ALREADY_RESOLVED', 'latest occurrence is already resolved');
        const receipts = db.prepare(
          'SELECT * FROM finding_receipts WHERE occurrence_id = ? ORDER BY rowid',
        ).all(tail.id);
        const fixIdx = receipts.findLastIndex((r) => r.kind === 'fix_response');
        const lastFix = fixIdx >= 0 ? receipts[fixIdx] : undefined;
        const afterFix = fixIdx >= 0 ? receipts.slice(fixIdx + 1) : [];
        const checkConclusion = (r) => {
          try { return JSON.parse(r.payload)?.conclusion; } catch { return undefined; }
        };
        if (disposition === 'VERIFIED') {
          if (!lastFix) throw code('E_NOT_RESOLVABLE', 'VERIFIED closure requires a recorded fix response');
          const fixOwner = lastFix.actor ?? null;
          const fixRev = lastFix.revision ?? null;
          if (!fixRev) throw code('E_NOT_RESOLVABLE', 'the latest fix response lacks a revision — evidence cannot be bound to it');
          if (revision !== undefined && revision !== null && revision !== fixRev) {
            throw code('E_NOT_RESOLVABLE', `closure revision "${revision}" does not match the latest fix revision "${fixRev}"`);
          }
          if (verifier && fixOwner && verifier === fixOwner) {
            throw code('E_NOT_RESOLVABLE', 'the fix owner cannot verify their own closure');
          }
          const latestCheck = afterFix.filter((r) => r.kind === 'check_receipt').at(-1);
          if (!latestCheck) {
            throw code('E_NOT_RESOLVABLE', 'VERIFIED requires a mechanical check receipt recorded after the latest fix — silence is not success');
          }
          if (latestCheck.revision !== fixRev) {
            throw code('E_NOT_RESOLVABLE', `the latest check ran on "${latestCheck.revision}", not the fix revision "${fixRev}"`);
          }
          const conclusion = checkConclusion(latestCheck);
          if (conclusion !== 'success') {
            throw code('E_NOT_RESOLVABLE', `the latest check after the fix is "${conclusion ?? 'opaque'}" — VERIFIED requires success`);
          }
          const independent = afterFix.some((r) =>
            r.kind === 'change_review' && r.actor && r.actor !== fixOwner && r.revision === fixRev);
          if (!independent) {
            throw code('E_NOT_RESOLVABLE', 'VERIFIED requires an independent change review of the fix revision recorded after the fix (self-reviews and pre-fix reviews do not count)');
          }
          const dotClosed = afterFix.some((r) => r.kind === 'dot_closure' && r.revision === fixRev);
          if (!dotClosed) {
            throw code('E_NOT_RESOLVABLE', 'VERIFIED requires an applicable dot_closure receipt on the fix revision recorded after the fix');
          }
        } else if (disposition === 'ALREADY_FIXED') {
          const shown = receipts.some((r) => r.kind === 'check_receipt' && checkConclusion(r) === 'success');
          if (!shown) throw code('E_NOT_RESOLVABLE', 'ALREADY_FIXED requires a successful mechanical check receipt');
        } else {
          // NOT_APPLICABLE / REJECTED_WITH_EVIDENCE — reviewer-evidence assertions
          const evidenced = receipts.some((r) =>
            ['change_review', 'dot_closure', 'check_receipt', 'fix_response'].includes(r.kind));
          if (!evidenced) throw code('E_NOT_RESOLVABLE', `${disposition} requires at least one evidence receipt on the occurrence`);
        }
        const id = randomUUID();
        db.prepare('INSERT INTO finding_receipts (id, occurrence_id, kind, revision, payload_digest, payload, actor, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .run(id, tail.id, 'closure', revision ?? null, payloadDigest(`${disposition}:${verifier ?? ''}`), JSON.stringify({ disposition, verifier: verifier ?? null }), verifier ?? null, now());
        db.prepare('UPDATE finding_occurrences SET state = ?, updated_at = ? WHERE id = ?').run('RESOLVED', now(), tail.id);
        return { occurrence_id: tail.id, state: 'RESOLVED', disposition };
      });
    },

    // Bounded retry reservations (packet §9): a persisted per-key counter; exceeding
    // the bound refuses (E_BUDGET) and the count survives crashes and restarts.
    reserveRetry(key, max, nowMs = Date.now()) {
      return tx(() => {
        const row = db.prepare('SELECT * FROM retry_reservations WHERE key = ?').get(key);
        if (!row) {
          db.prepare('INSERT INTO retry_reservations (key, count, max, updated_at) VALUES (?, ?, ?, ?)').run(key, 1, max, now());
          return { count: 1 };
        }
        if (row.count >= row.max) {
          throw code('E_BUDGET', `reservation "${key}" exhausted (${row.count}/${row.max})`);
        }
        db.prepare('UPDATE retry_reservations SET count = count + 1, max = ?, updated_at = ? WHERE key = ?').run(max, now(), key);
        return { count: row.count + 1 };
      });
    },

    close() {
      db.close();
    },

    outboxEnqueue(eventType, payload, dedupKey) {
      return tx(() => outboxEnqueueTx(eventType, payload, dedupKey));
    },

    // DR-R5: claiming a batch is a RESERVATION — rows come back marked with a claim
    // lease so a concurrent drain sees an empty batch instead of double-processing.
    // A lease that lapsed (a dead drain) is recoverable after claimLeaseMs.
    outboxClaimBatch(limit, { nowMs = Date.now(), claimLeaseMs = 5 * 60 * 1000 } = {}) {
      return tx(() => {
        const cutoff = new Date(nowMs - claimLeaseMs).toISOString();
        const rows = db.prepare(
          `SELECT * FROM outbox WHERE published_at IS NULL AND (claimed_at IS NULL OR claimed_at < ?) ORDER BY id LIMIT ?`,
        ).all(cutoff, limit);
        const stamp = new Date(nowMs).toISOString();
        for (const r of rows) {
          db.prepare('UPDATE outbox SET claimed_at = ?, attempts = attempts + 1 WHERE id = ?').run(stamp, r.id);
        }
        return rows;
      });
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
