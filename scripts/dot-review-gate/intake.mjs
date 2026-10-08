import { resolveReviewTargets } from './ledger.mjs';
// Authenticated browser intake for the Dot review gate — spec §3.1/§5.
//
// Boundary rules implemented here (everything else trusts the ledger):
//   - OAuth via a DEDICATED app with EMPTY scopes; the granted-scope string must be
//     empty or the exchange is rejected (reused consent can carry old scopes).
//   - Identity is the server-derived numeric GitHub user id, compared against the
//     enrolled allowlist. The submitted JSON's author fields are assertions; the
//     authenticated session principal is authoritative.
//   - The submission envelope is strict-parsed from the RAW bytes (review R8):
//     JSON.parse-then-reserialize collapsed duplicate keys before the strict reader
//     could see them, so a raw "verdict":"STOP"/"verdict":"GO" body validated clean.
//   - Challenges are one-use, tuple-bound, lease-bounded and reviewer-bound through
//     ledger.submitReport (review R2) — the intake never widens those bindings.
//   - GitHub webhooks are HMAC-SHA256-verified over the RAW body and delivery-id
//     deduplicated through the ledger outbox.
//   - `claimGate`/`submitGate` are the service composition seams (review R11): the
//     composed gate service supplies readiness/expiry/pause checks; absent gates
//     allow (module-level tests exercise the mechanics, not the policy).
// Secrets (OAuth client secret, webhook secret) arrive via config — never in this file.

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import http from 'node:http';
import { parseStrictJson } from './strict-json.mjs';
import { tupleDigest } from './ledger.mjs';

const BODY_LIMIT = 1024 * 1024; // the spec's report bound applies to the whole body (envelope included)
const STATE_TTL_MS = 10 * 60 * 1000;

const STATUS_BY_CODE = {
  E_NOT_FOUND: 404,
  E_REVIEWER: 403,
  E_CONFLICT: 409,
  E_LEASE_EXPIRED: 410,
  E_GENERATION: 409,
  E_ALREADY_CLAIMED: 429,
  E_EXHAUSTED: 429,
};

export async function startIntake({ ledger, policy, oauth, webhookSecret, validator, authorizeUrl, claimGate, submitGate, now = () => Date.now() } = {}) {
  if (!ledger || !policy || !oauth || !webhookSecret || !validator) {
    throw new Error('startIntake requires ledger, policy, oauth, webhookSecret, validator');
  }
  const states = new Map(); // csrf state → issuedAt
  const sessions = new Map(); // session token → { principalId, createdAt }

  const server = http.createServer((req, res) => {
    readBody(req)
      .then((body) => route(req, res, body))
      .catch((e) => {
        if (e.code === 'E_TOO_LARGE') {
          res.writeHead(413, JSON_HEADERS).end(JSON.stringify({ error: 'payload too large' }));
        } else {
          // server-side visibility for otherwise-silent 400s (no secrets in payloads logged)
          console.error('[intake] request error:', e?.code ?? '', e?.message ?? e);
          res.writeHead(400, JSON_HEADERS).end(JSON.stringify({ error: 'malformed request' }));
        }
      });
  });

  async function route(req, res, body) {
    const url = new URL(req.url, 'http://internal');
    const path = url.pathname;

    if (req.method === 'GET' && path === '/oauth/start') {
      const state = randomBytes(24).toString('hex');
      // expired states issued but never consumed are swept here — the Map stays bounded
      for (const [k, ts] of states) if (Date.now() - ts > STATE_TTL_MS) states.delete(k);
      states.set(state, Date.now());
      const redirect = authorizeUrl ?? 'https://github.com/login/oauth/authorize';
      const target = new URL(redirect);
      target.searchParams.set('client_id', oauth.clientId ?? 'set-client-id');
      target.searchParams.set('redirect_uri', oauth.redirectUri ?? '');
      target.searchParams.set('scope', ''); // explicit empty scopes — identity only
      target.searchParams.set('state', state);
      res.writeHead(302, {
        location: target.toString(),
        'set-cookie': cookie('dot_oauth_state', state, { maxAge: 600 }),
      });
      res.end();
      return;
    }

    if (req.method === 'GET' && path === '/oauth/callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state') ?? '';
      const cookieState = cookies(req)['dot_oauth_state'];
      if (!code || !state || !cookieState || state !== cookieState || !states.has(state)) {
        res.writeHead(400, JSON_HEADERS).end(JSON.stringify({ error: 'bad oauth state' }));
        return;
      }
      const issued = states.get(state);
      if (issued && Date.now() - issued > STATE_TTL_MS) {
        states.delete(state);
        res.writeHead(400, JSON_HEADERS).end(JSON.stringify({ error: 'oauth state expired' }));
        return;
      }
      states.delete(state);
      const token = await oauth.exchangeCode(code); // transport must reject nonempty scopes
      if (token.scope !== undefined && token.scope !== '') {
        res.writeHead(403, JSON_HEADERS).end(JSON.stringify({ error: 'nonempty oauth scopes rejected' }));
        return;
      }
      const user = await oauth.fetchUser(token.access_token);
      // R3-1: the enrolled population is the POLICY registry — reviewers plus the
      // executor and independent-verifier principals (the same union requireSession
      // enforces per request; role checks happen per record kind at submission).
      const enrolledAtLogin = new Set([
        ...policy.reviewer_principal_ids,
        ...(policy.principals?.executors ?? []).map((x) => x.principal_id),
        ...(policy.principals?.verifiers ?? []).map((x) => x.principal_id),
      ]);
      if (!Number.isInteger(user?.id) || !enrolledAtLogin.has(user.id)) {
        res.writeHead(403, JSON_HEADERS).end(JSON.stringify({ error: 'principal not enrolled' }));
        return;
      }
      const session = randomBytes(32).toString('hex');
      sessions.set(session, { principalId: user.id, createdAt: Date.now() });
      res.writeHead(200, {
        ...JSON_HEADERS,
        'set-cookie': cookie('dot_session', session, { httpOnly: true, sameSite: 'Lax' }),
      });
      res.end(JSON.stringify({ login: user.login, principal: user.id }));
      return;
    }

    if (req.method === 'POST' && path === '/claim') {
      const auth = requireSession(req);
      if (!auth) return send(res, 401, { error: 'authentication required' });
      if (!strictJson(body)) return send(res, 400, { error: 'strict JSON body required' });
      let state;
      try {
        state = await oauth.currentState(); // authoritative tuple source
      } catch (e) {
        return send(res, 503, { error: 'repository state unavailable', code: 'E_STATE_UNAVAILABLE' });
      }
      if (state.repository_id !== policy.repository_id) {
        return send(res, 409, { error: 'repository mismatch' });
      }
      if (claimGate) {
        const gate = await claimGate(state);
        if (!gate.ok) return send(res, gate.status ?? 409, { error: gate.reason ?? 'claim refused', code: gate.code ?? 'E_GATE' });
      }
      const active = ledger.countActiveClaims(state.pr_node_id, {
        nowMs: now(),
        leaseMinutes: policy.limits.claim_lease_minutes,
      });
      if (active >= policy.limits.max_active_claims) {
        return send(res, 429, { error: 'active claim limit reached' });
      }
      let claimed;
      try {
        claimed = ledger.claimGeneration({
          tuple: state,
          reviewerId: auth.principalId,
          maxAttemptsPerTuple: policy.limits.max_attempts_per_tuple,
          leaseMinutes: policy.limits.claim_lease_minutes,
          nowMs: now(),
          changedFiles: state.changed_files,
        });
      } catch (e) {
        const status = STATUS_BY_CODE[e.code];
        if (status) return send(res, status, { error: e.message, code: e.code });
        throw e;
      }
      return send(res, 200, { claim_id: claimed.claim.claim_id, generation: claimed.generation.seq, tuple: state });
    }

    if (req.method === 'POST' && path === '/submit') {
      const auth = requireSession(req);
      if (!auth) return send(res, 401, { error: 'authentication required' });
      if (submitGate) {
        const gate = await submitGate();
        if (!gate.ok) return send(res, gate.status ?? 409, { error: gate.reason ?? 'submission refused', code: gate.code ?? 'E_GATE' });
      }
      // R8: the envelope is strict-parsed from the RAW bytes — a plain JSON.parse
      // collapsed duplicate keys (a raw STOP/GO verdict pair validated clean after
      // reserialization). parseStrictJson rejects them before any normalization.
      let envelope;
      try {
        envelope = parseStrictJson(body ?? '');
      } catch (e) {
        return send(res, 400, { error: 'strict JSON envelope required', code: e.code ?? 'E_PARSE' });
      }
      if (
        !envelope || typeof envelope !== 'object' ||
        typeof envelope.claim_id !== 'string' ||
        !Number.isInteger(envelope.generation) ||
        !envelope.report || typeof envelope.report !== 'object'
      ) {
        return send(res, 400, { error: 'claim_id (string), generation (integer) and report (object) required' });
      }
      // envelope ↔ record identity, per record kind: the inner record must assert the
      // lifeline it answers — a mismatch means the bytes were stitched (review R2).
      // V1 reports carry claim_id/generation at the top level. A V2 review_report
      // binds through review_identity.assignment_id (the protocol pins the spelling);
      // canonical correction/closure records have NO review_identity — a fix_response
      // binds the assignment it answers (its owner must match claimed_by; a revoked
      // assignment refuses) and a closure_receipt binds the findings it closes.
      // R3-1: the challenged generation is trusted scope state — fetched FIRST so
      // every record-specific binding resolves against it.
      const challengeRow = ledger.getChallenge(envelope.claim_id);
      const genRow = challengeRow ? ledger.getGeneration(challengeRow.generation_id) : undefined;
      // R4 (cold review): the review_report channel is REVIEWER-ONLY. The
      // independent-review leg of closure is affirmable only by an enrolled
      // reviewer — before this gate the fixer could submit a canonical GO
      // review_report through the same intake and the consumer would mint HIS
      // verdict as the independent change review. The role is re-derived from
      // the AUTHENTICATED principal at the boundary; the payload carries no role.
      const isV2Record = envelope.report.protocol_version === 'dot-pr-review/2.0.0';
      const looksLikeReview = (isV2Record && envelope.report.record_type === 'review_report')
        || (!isV2Record && envelope.report.claim_id === envelope.claim_id && envelope.report.generation === envelope.generation);
      if (looksLikeReview && !(policy.reviewer_principal_ids ?? []).includes(auth.principalId)) {
        return send(res, 403, { error: `review reports are the reviewer channel — principal ${auth.principalId} is not an enrolled reviewer`, code: 'E_ROLE' });
      }
      if (isV2Record) {
        const recordType = envelope.report.record_type;
        if (recordType === 'fix_response') {
          const r = envelope.report;
          if (typeof r.assignment_id !== 'string' || r.assignment_id === '') {
            return send(res, 422, { error: 'fix_response requires an assignment_id', code: 'E_ENVELOPE' });
          }
          const assignment = ledger.getAssignment(r.assignment_id);
          if (!assignment) {
            return send(res, 422, { error: `fix_response references unknown assignment ${r.assignment_id}`, code: 'E_ENVELOPE' });
          }
          if (assignment.state === 'REVOKED') {
            return send(res, 422, { error: `fix_response references revoked assignment ${r.assignment_id} — late fix evidence refused`, code: 'E_ENVELOPE' });
          }
          if (r.claimed_by !== assignment.owner) {
            return send(res, 422, { error: `fix_response claimed_by "${r.claimed_by}" does not match the assignment owner "${assignment.owner}"`, code: 'E_ENVELOPE' });
          }
          // R3-1: the payload cannot grant identity — the SUBMITTING principal must
          // be the executor enrolled in the trusted registry under this assignment's
          // owner label; an arbitrary claimed_by string that merely matches the
          // assignment is not enough.
          const executor = (policy.principals?.executors ?? []).find((x) => x.principal_id === auth.principalId);
          if (!executor || executor.label !== assignment.owner) {
            return send(res, 403, { error: `authenticated principal ${auth.principalId} is not the enrolled executor "${assignment.owner}" for assignment ${r.assignment_id}`, code: 'E_NOT_ENROLLED' });
          }
          // R3-1: record-specific scope — the assignment's occurrence must live in
          // the CHALLENGED PR scope; a current-PR challenge cannot admit another
          // PR's fix evidence. An already-resolved occurrence is an obsolete
          // assignment and refuses too.
          const occ = ledger.getOccurrence(assignment.occurrence_id);
          if (genRow && occ && (occ.repository_id !== genRow.repository_id || (occ.pr_node_id ?? null) !== (genRow.pr_node_id ?? null))) {
            return send(res, 422, { error: `assignment ${r.assignment_id} is outside the challenged PR scope`, code: 'E_SCOPE' });
          }
          if (occ && occ.state === 'RESOLVED') {
            return send(res, 422, { error: `assignment ${r.assignment_id} covers a resolved finding — obsolete assignment refuses`, code: 'E_ALREADY_RESOLVED' });
          }
        } else if (recordType === 'closure_receipt') {
          const ids = Array.isArray(envelope.report.finding_ids) ? envelope.report.finding_ids : [];
          if (ids.length === 0 || !ids.every((k) => typeof k === 'string' && k !== '')) {
            return send(res, 422, { error: 'closure_receipt requires non-empty string finding_ids', code: 'E_ENVELOPE' });
          }
          const unknown = ids.filter((key) => ledger.lineage(key).length === 0);
          if (unknown.length > 0) {
            return send(res, 422, { error: `closure_receipt references unknown findings: ${unknown.join(', ')}`, code: 'E_ENVELOPE' });
          }
          // R3-1: every named finding must live in the CHALLENGED PR scope — mixed
          // local/foreign IDs refuse the whole record (a foreign finding cannot be
          // closed by riding along a local one).
          const foreign = ids.filter((key) => {
            const tail = ledger.lineage(key).at(-1);
            return genRow && tail && (tail.repository_id !== genRow.repository_id || (tail.pr_node_id ?? null) !== (genRow.pr_node_id ?? null));
          });
          if (foreign.length > 0) {
            return send(res, 422, { error: `closure_receipt names findings outside the challenged PR scope: ${foreign.join(', ')}`, code: 'E_SCOPE' });
          }
          // R3-1: the payload cannot grant the verifier identity — verified_by must
          // be the label the trusted registry binds to the AUTHENTICATED principal,
          // and an executor principal cannot act as the independent closer (checked
          // FIRST: the role refusal is the load-bearing one for self-closure).
          if ((policy.principals?.executors ?? []).some((x) => x.principal_id === auth.principalId)) {
            return send(res, 403, { error: 'an executor principal cannot act as the independent closer — executor self-closure refused', code: 'E_ROLE' });
          }
          const verifier = (policy.principals?.verifiers ?? []).find((x) => x.principal_id === auth.principalId);
          if (!verifier || verifier.label !== envelope.report.verified_by) {
            return send(res, 403, { error: `authenticated principal ${auth.principalId} is not the enrolled independent verifier "${envelope.report.verified_by ?? '(absent)'}"`, code: 'E_NOT_ENROLLED' });
          }
        } else if (envelope.report.review_identity?.assignment_id !== envelope.claim_id) {
          return send(res, 422, { error: 'review_identity.assignment_id does not match the envelope claim', code: 'E_ENVELOPE' });
        }
        // R3-1: a correction record binds to its ISSUED generation — a challenge
        // whose generation was superseded (or reached a terminal state) is an
        // obsolete basis: REFUSED, not archived (unlike review evidence, stale fix
        // evidence has no historical value that outweighs the binding).
        if ((recordType === 'fix_response' || recordType === 'closure_receipt') && genRow) {
          const genState = genRow.state;
          if (genState === 'SUPERSEDED' || ['AUTHORIZED', 'MERGED', 'CLOSED', 'INCOMPLETE', 'BLOCKED'].includes(genState)) {
            return send(res, 409, { error: `the challenged generation is ${genState} — correction records refuse an obsolete basis`, code: 'E_GENERATION' });
          }
        }
      } else if (envelope.report.claim_id !== envelope.claim_id || envelope.report.generation !== envelope.generation) {
        return send(res, 422, { error: 'report claim/generation does not match the envelope', code: 'E_ENVELOPE' });
      }
      let state;
      try {
        state = await oauth.currentState();
      } catch (e) {
        return send(res, 503, { error: 'repository state unavailable', code: 'E_STATE_UNAVAILABLE' });
      }
      // R4: the trusted changed-file inventory is pinned to the generation at claim
      // time; validation compares the report against IT, not against the report's
      // own coverage claims. DR-R3: the report authenticates against its ISSUED
      // assignment — the generation's stored tuple — never the live tuple; a report
      // delayed past a tuple move is archived as history by the ledger, not
      // rejected here. An unknown claim carries no issued tuple and reaches the
      // ledger, which refuses it.
      let trustedInventory;
      if (genRow?.changed_files_json) {
        try { trustedInventory = { changed_files: JSON.parse(genRow.changed_files_json) }; } catch { trustedInventory = undefined; }
      }
      let issuedTuple;
      if (genRow?.tuple_json) {
        try { issuedTuple = JSON.parse(genRow.tuple_json); } catch { issuedTuple = undefined; }
      }
      const canonicalText = JSON.stringify(envelope.report);
      const createHash = (await import('node:crypto')).createHash;
      const digest = createHash('sha256').update(canonicalText).digest('hex');
      const prior = ledger.getReportByDigest(digest);
      const exactAcceptedReplay = prior?.claim_id === envelope.claim_id && prior?.reviewer_id === auth.principalId;
      if (!exactAcceptedReplay && isV2Record && envelope.report.record_type === 'review_report') {
        try { resolveReviewTargets(ledger, genRow, envelope.report); }
        catch (e) { return send(res, 422, { error: e.message, code: e.code ?? 'E_REVIEW_SCOPE' }); }
      }
      // the validator may be async (the composed service loads it lazily) — await
      const verdict = exactAcceptedReplay ? { ok: true } : await validator(canonicalText, { currentState: issuedTuple, trustedInventory });
      if (!verdict.ok) {
        return send(res, 422, { error: 'report rejected by validator', errors: verdict.errors.slice(0, 20) });
      }
      const isV2 = envelope.report.protocol_version === 'dot-pr-review/2.0.0';
      let receipt;
      try {
        receipt = ledger.submitReport({
          claimId: envelope.claim_id,
          reviewerId: auth.principalId, // authenticated envelope — never report authorship
          digest,
          payload: canonicalText,
          // the ledger stores TEXT columns: a V2 verdict is an object (serialize it)
          // and its record kind lives in record_type; correction/closure records
          // carry no verdict — their serialized verdict is JSON null
          verdict: isV2 ? JSON.stringify(envelope.report.verdict ?? null) : envelope.report.verdict,
          kind: isV2 ? envelope.report.record_type : envelope.report.kind,
          leaseMinutes: policy.limits.claim_lease_minutes,
          nowMs: now(),
          liveTupleDigest: tupleDigest(state),
          assertedGenerationSeq: envelope.generation,
          // authenticated provenance: the ORIGINAL bounded envelope bytes, their
          // digest and the channel, stored beside the canonical record
          envelopeBytes: body,
          envelopeDigest: createHash('sha256').update(body).digest('hex'),
          receivedVia: 'browser-intake',
        });
      } catch (e) {
        const status = STATUS_BY_CODE[e.code];
        if (status) return send(res, status, { error: e.message, code: e.code });
        throw e;
      }
      return send(res, 200, {
        report_id: receipt.report_id,
        digest,
        replayed: receipt.replayed,
        admitted: receipt.admitted !== false,
        superseded: receipt.superseded === true,
      });
    }

    if (req.method === 'POST' && path === '/webhook') {
      const sig = req.headers['x-hub-signature-256'];
      const delivery = req.headers['x-github-delivery'];
      if (typeof sig !== 'string' || typeof delivery !== 'string' || !verifyHmac(webhookSecret, sig, body)) {
        return send(res, 401, { error: 'signature verification failed' });
      }
      const row = ledger.outboxEnqueue('github.event', {
        event: req.headers['x-github-event'] ?? 'unknown',
        delivery_id: delivery,
        payload: json(body) ?? {},
      }, `delivery:${delivery}`);
      return send(res, 200, { deduplicated: row._dedup_hit === true });
    }

    if (req.method === 'GET' && path === '/health') {
      return send(res, 200, { ok: true, counts: ledger.counts() });
    }

    send(res, 404, { error: 'not found' });
  }

  function requireSession(req) {
    const token = cookies(req)['dot_session'];
    if (!token) return null;
    const s = sessions.get(token);
    if (!s) return null;
    // R3-1: the enrolled population is the POLICY registry — reviewers (the Dot /
    // change-review intake) plus the executor and independent-verifier principals.
    // Role checks happen per record kind at submission; the session only proves
    // enrollment.
    const enrolled = new Set([
      ...policy.reviewer_principal_ids,
      ...(policy.principals?.executors ?? []).map((x) => x.principal_id),
      ...(policy.principals?.verifiers ?? []).map((x) => x.principal_id),
    ]);
    if (!enrolled.has(s.principalId)) return null;
    return s;
  }

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  return {
    port,
    close: () => new Promise((resolve) => server.close(resolve)),
    // test/debug surface
    _sessions: sessions,
  };
}

function verifyHmac(secret, header, rawBody) {
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const given = header.startsWith('sha256=') ? header.slice(7) : '';
  if (given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > BODY_LIMIT) {
        const e = new Error('payload too large');
        e.code = 'E_TOO_LARGE';
        // stop consuming but do NOT destroy: the 413 must reach the client while the
        // socket is still open; the response end closes it.
        req.pause();
        req.removeAllListeners('data');
        req.removeAllListeners('end');
        reject(e);
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function json(body) {
  if (!body) return null;
  try { return JSON.parse(body); } catch { return null; }
}

function strictJson(body) {
  try { parseStrictJson(body ?? ''); return true; } catch { return false; }
}

function cookies(req) {
  const out = {};
  const header = req.headers.cookie;
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

function cookie(name, value, { httpOnly = true, sameSite = 'Lax', maxAge } = {}) {
  // spec §3.1: session cookies are Secure + HttpOnly + SameSite
  let c = `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=${sameSite}`;
  if (maxAge !== undefined) c += `; Max-Age=${maxAge}`;
  return c;
}

const JSON_HEADERS = { 'content-type': 'application/json' };

function send(res, status, obj) {
  res.writeHead(status, JSON_HEADERS);
  res.end(JSON.stringify(obj));
}
