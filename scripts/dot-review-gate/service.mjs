// Gate service composition — review R11.
//
// Until this module existed, every gate component was exported but never composed:
// /claim issued challenges without evaluating readiness, claim leases were never
// enforced, authorization_expiry was checked once at policy load, and there was no
// durable outbox consumer. This module is the credential-free composition the review
// required: intake HTTP (authentication, strict envelope) + fail-closed gates (expiry,
// pause, readiness, state availability) + a transactional-outbox drain that publishes
// through the ledger-backed publisher. All GitHub access is injected — local runs use
// stub adapters and generated keys, no real credentials.
//
// Fail-closed contract: the service refuses to START on an unresolved policy or missing
// schema; it refuses CLAIMS and PUBLICATIONS under red mechanics, expired
// authorization, pause, or an unavailable repository-state source. Pause here stops
// new claims and publications — the native dot-review/pause ruleset remains the
// boundary that also stops already-armed PRs.

import { loadPolicy } from './load-policy.mjs';
import { evaluateReadiness } from './readiness.mjs';
import { startIntake } from './intake.mjs';
import { publishAdmission, publishFailure } from './publisher.mjs';
import { openLedger } from './ledger.mjs';

export async function createGateService({
  ledgerPath,
  policyText,
  schemaBytes,
  oauth,
  webhookSecret,
  readState,
  resolveRunIdentity,
  publisherApp,
  allowMemoryLedger = false,
  now = () => Date.now(),
} = {}) {
  // startup fail-closed: an unresolved manifest or missing schema is a refusal, never
  // a partially-configured service
  const policy = loadPolicy(policyText ?? '');
  if (!schemaBytes || schemaBytes.length === 0) {
    const e = new Error('[service] schemaBytes are required');
    e.code = 'E_CONFIG';
    throw e;
  }
  if (!oauth || !webhookSecret || typeof readState !== 'function') {
    const e = new Error('[service] oauth, webhookSecret and readState adapters are required');
    e.code = 'E_CONFIG';
    throw e;
  }
  // persistence guard (packet increment 4): production journal must be durable —
  // in-memory storage is fixture-only and requires the explicit flag, never an
  // accident of an omitted path.
  let ledger;
  if (ledgerPath && ledgerPath !== ':memory:') {
    ledger = openLedger(ledgerPath);
  } else if (allowMemoryLedger === true) {
    ledger = openLedger(':memory:');
  } else {
    const e = new Error('[service] a persistent ledger path is required (in-memory storage is fixture-only — pass allowMemoryLedger to opt in)');
    e.code = 'E_NO_PERSISTENT_PATH';
    throw e;
  }

  const expired = () => Date.parse(policy.authorization_expiry) <= now();
  const gate = (kind) => {
    if (expired()) {
      return { ok: false, status: 403, code: 'E_EXPIRED', reason: `authorization expired ${policy.authorization_expiry}` };
    }
    if (ledger.isPaused()) {
      return { ok: false, status: 503, code: 'E_PAUSED', reason: 'service pause is active' };
    }
    void kind;
    return { ok: true };
  };

  const claimGate = async (state) => {
    const base = gate('claim');
    if (!base.ok) return base;
    const readiness = evaluateReadiness(policy, state);
    if (!readiness.ready) {
      return {
        ok: false,
        status: 409,
        code: 'E_NOT_READY',
        reason: `mechanical state not eligible (${readiness.blocking.map((b) => b.code).join(', ')})`,
      };
    }
    return { ok: true };
  };

  const validator = (text, extra) => import('./validate-report.mjs').then((m) => m.validateReport(text, {
    schemaBytes,
    policy,
    now: new Date(now()).toISOString(),
    currentState: extra?.currentState,
    trustedInventory: extra?.trustedInventory,
  }));

  // The authoritative tuple for /claim and /submit flows through oauth.currentState()
  // inside the intake — bind the read adapter there so ONE fail-closed source feeds
  // everything. A throwing readState surfaces as the intake's 503 E_STATE_UNAVAILABLE.
  const oauthAdapter = { ...oauth, currentState: readState };

  const intake = await startIntake({
    ledger,
    policy,
    oauth: oauthAdapter,
    webhookSecret,
    validator: (text, extra) => validator(text, extra),
    claimGate,
    submitGate: () => gate('submit'),
    now,
  });

  // durable outbox consumer: at-least-once delivery, exactly-once effects by
  // external_id + outbox dedup. Red mechanics / expiry / pause SKIP publication and
  // keep the event pending — nothing is dropped, nothing is published unreviewed.
  async function drainOutbox({ publisherTransport, limit = 10 } = {}) {
    if (typeof publisherTransport !== 'function') {
      const e = new Error('[service] drainOutbox requires the publisher transport');
      e.code = 'E_NO_PUBLISHER';
      throw e;
    }
    const results = [];
    for (const event of ledger.outboxClaimBatch(limit)) {
      if (event.event_type !== 'report.submitted') {
        // generation.claimed / github.event rows have no publication side effect yet;
        // mark them drained so the queue only ever holds pending work
        ledger.outboxMarkPublished(event.id);
        results.push({ event: event.event_type, action: 'drained' });
        continue;
      }
      if (expired()) {
        results.push({ event: event.event_type, action: 'skipped-expired' });
        continue;
      }
      if (ledger.isPaused()) {
        results.push({ event: event.event_type, action: 'skipped-paused' });
        continue;
      }
      const payload = JSON.parse(event.payload);
      let outcome;
      try {
        outcome = await publishChecked({ publisherTransport, reportId: payload.report_id });
      } catch (e) {
        results.push({ event: event.event_type, action: 'kept-pending', code: e.code ?? 'E_TRANSPORT' });
        continue; // at-least-once: stay pending, redeliver on the next drain
      }
      if (outcome.published) {
        ledger.outboxMarkPublished(event.id);
        ledger.recordSideEffect(event.id, outcome.kind, outcome.externalId);
        results.push({ event: event.event_type, action: 'published', conclusion: outcome.kind });
      } else {
        results.push({ event: event.event_type, action: 'kept-pending', code: outcome.code });
      }
    }
    return results;
  }

  async function publishChecked({ publisherTransport, reportId }) {
    const run = {
      ledger, reportId, schemaBytes, policy,
      app: { ...publisherApp, apiBase: publisherApp.apiBase ?? '', repo: policy.repository_full_name, prNumber: undefined },
      transport: publisherTransport,
      resolveRunIdentity,
      now: new Date(now()).toISOString(),
    };
    // the report's PR number comes from its own record — resolve it once
    const row = ledger.getReport(reportId);
    const report = JSON.parse(row.payload);
    run.app.prNumber = report.pull_request?.number;
    try {
      const res = await publishAdmission(run);
      return { published: true, kind: 'success', externalId: res.check?.external_id ?? res.check?.id };
    } catch (e) {
      if (e.code === 'E_NOT_AUTHORIZING') {
        // valid but non-authorizing record → publish the named failure check
        const res = await publishFailure({ ...run, reason: 'review verdict is not GO/COMPLETE' });
        return { published: true, kind: 'failure', externalId: res.check?.external_id ?? res.check?.id };
      }
      return { published: false, code: e.code ?? 'E_TRANSPORT' };
    }
  }

  return {
    policy,
    ledger,
    intake,
    port: intake.port,
    drainOutbox,
    isPaused: () => ledger.isPaused(),
    setPaused: (v) => ledger.setPaused(v),
    close: async () => {
      await intake.close();
      ledger.close(); // checkpoint + release the journal (WAL) on shutdown
    },
  };
}
