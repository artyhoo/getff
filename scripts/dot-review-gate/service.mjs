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

import { createHash } from 'node:crypto';
import { loadPolicy, mandatoryMechanical } from './load-policy.mjs';
import { evaluateReadiness } from './readiness.mjs';
import { startIntake } from './intake.mjs';
import { publishAdmission, publishFailure } from './publisher.mjs';
import { openLedger } from './ledger.mjs';

export async function createGateService({
  ledgerPath,
  policyText,
  schemaBytes,
  schemaBytesV2,
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
  // DR-R4: a V2-era deployment runs on the pinned V2 bytes — absent bytes must
  // refuse startup, never degrade DotPRReviewV2 documents into schema-less checks
  if (policy.protocol_version === 'dot-pr-review/2.0.0') {
    if (!schemaBytesV2 || schemaBytesV2.length === 0) {
      const e = new Error('[service] schemaBytesV2 (the pinned dot-pr-review/2.0.0 schema) is required for a V2-era policy');
      e.code = 'E_CONFIG';
      throw e;
    }
    // SP-3: presence is not a pin — the packet's probe started a service whose
    // operational V2 schema was permissive {"type":"object"} bytes. Startup must
    // verify the bytes digest to the policy's schema_v2_sha256.
    const v2Sha = createHash('sha256').update(schemaBytesV2).digest('hex');
    if (policy.schema_v2_sha256 !== v2Sha) {
      const e = new Error(`[service] schemaBytesV2 digest ${v2Sha} does not match the policy pin schema_v2_sha256 ${policy.schema_v2_sha256 ?? '(absent)'}`);
      e.code = 'E_CONFIG';
      throw e;
    }
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
    schemaBytesV2,
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

  // durable outbox consumer: at-least-once delivery with claim-lease reservations
  // (DR-R5) so concurrent drains cannot double-process a batch; effects deduplicate
  // by intent-bound external_id — a best-effort boundary, not a proved exactly-once
  // guarantee. Red mechanics / expiry / pause SKIP publication and keep the event
  // pending — nothing is dropped, nothing is published unreviewed.
  // R3-1: the registry resolves what an AUTHENTICATED principal may be called in
  // the journal — enrolled roles carry their label, everyone else the opaque
  // principal form. The payload's own actor strings never grant identity.
  const registryLabel = (role, principalId) => {
    if (!Number.isInteger(principalId)) return null;
    if (role) {
      const entry = (policy.principals?.[role] ?? []).find((x) => x.principal_id === principalId);
      if (entry) return entry.label;
    }
    return `principal:${principalId}`;
  };

  // Lifecycle consumption of coordinator-side records (increment 5, cold-review fix
  // 1): one consumer used by BOTH the live path and the superseded-archival path —
  // a refusal keeps the event pending with its reason, never consumed unactioned.
  // R3-1: the record's actor is the REGISTRY label of the AUTHENTICATED submitter
  // (reports.reviewer_id) — a claimed_by/verified_by that disagrees refuses.
  function consumeLifecycleRecord(recordType, record, payload, reportRow) {
    try {
      if (recordType === 'fix_response') {
        const owner = registryLabel('executors', reportRow?.reviewer_id);
        if (record.claimed_by !== owner) {
          return { action: 'kept-pending', code: 'E_IDENTITY', reason: `fix record claims "${record.claimed_by}" but the authenticated principal resolves to "${owner ?? 'unknown'}" — the payload cannot grant identity` };
        }
        ledger.applyFixResponseRecord({
          assignmentId: record.assignment_id,
          claimedBy: owner,
          fixRevision: record.fix_revision,
          findingKeys: record.finding_ids,
          mechanicalReceipts: record.mechanical_receipts,
          // SP-2: the record's own independent change review becomes a real receipt
          changeReviewReceipt: record.change_review_receipt ?? undefined,
          digest: payload.digest,
          // unresolved scope survives consumption inside the receipt payload
          payloadRef: JSON.stringify({ record_digest: payload.digest, changed_scope: record.changed_scope ?? [], unresolved_items: record.unresolved_items ?? [] }),
        });
        return { action: 'fix-recorded' };
      }
      const verifier = registryLabel('verifiers', reportRow?.reviewer_id);
      if (record.verified_by !== verifier) {
        return { action: 'kept-pending', code: 'E_IDENTITY', reason: `closure record claims "${record.verified_by}" but the authenticated principal resolves to "${verifier ?? 'unknown'}" — the payload cannot grant identity` };
      }
      ledger.applyClosureReceipt({
        findingKeys: record.finding_ids,
        verifiedBy: verifier,
        disposition: record.disposition,
        revision: record.verification_revision,
        // SP-2: the record's own evidence mints the dot_closure receipt
        evidence: record.evidence,
        comparisonBasis: record.comparison_basis,
        rationale: record.rationale,
        // SP-7: the policy's head-bound mechanical contexts are the trusted
        // required-check set the closure gate evaluates per check identity
        requiredContexts: mandatoryMechanical(policy).filter((c) => c.bound_to === 'head').map((c) => c.context),
      });
      return { action: 'closure-recorded' };
    } catch (e) {
      return { action: 'kept-pending', code: e.code ?? 'E_LIFECYCLE', reason: e.message };
    }
  }

  // R3-2: an AUTHENTICATED review submission is the structured outcome an
  // independent closure evaluates. The change_review receipt is minted FROM the
  // accepted review_report: its own verdict.outcome (a canonical schema field —
  // no invented field is read), bound to the receipt artifact digest, the
  // reviewed revision and the named findings. The canonical change_review receipt
  // inside an EXECUTOR fix record carries no outcome and never will — this path
  // is the only writer of verdict-bearing review evidence.
  function recordReviewOutcome(reportRow, record) {
    const cr = record?.change_review_receipt;
    if (!cr || typeof cr !== 'object' || !Array.isArray(cr.finding_ids) || cr.finding_ids.length === 0) return 0;
    const actor = registryLabel(null, reportRow?.reviewer_id);
    const outcome = {
      verdict: record?.verdict?.outcome ?? null,
      artifact_reference: cr.artifact_reference ?? null,
      artifact_sha256: cr.artifact_sha256 ?? null,
      resolutions: cr.resolutions ?? [],
      source: 'authenticated-review-report',
    };
    const revision = cr.reviewed_revision ?? record?.review_identity?.revisions?.head_sha ?? null;
    let recorded = 0;
    for (const key of cr.finding_ids) {
      const tail = ledger.lineage(key).at(-1);
      if (!tail) continue;
      ledger.recordReceipt({ occurrenceId: tail.id, kind: 'change_review', revision, payload: JSON.stringify(outcome), actor });
      recorded += 1;
    }
    return recorded;
  }

  // R3-2/§11: TRUSTED mechanical evidence arrives through the HMAC-verified GitHub
  // webhook boundary (the intake verifies the signature before this event is ever
  // enqueued). A check_run binds to the occurrences whose LATEST fix response is on
  // exactly that head sha — context identity + revision, never an executor
  // assertion. The receipt payload carries source 'github-webhook': the closure
  // gate qualifies required contexts from TRUSTED receipts only.
  function recordTrustedCheckReceipt(environment) {
    const checkRun = environment?.payload?.check_run;
    const repositoryId = environment?.payload?.repository?.id;
    const context = checkRun?.name;
    const headSha = checkRun?.head_sha;
    const conclusion = checkRun?.conclusion;
    if (!Number.isInteger(repositoryId) || typeof context !== 'string' || context.length === 0 || typeof headSha !== 'string' || conclusion == null) return 0;
    const targets = ledger.occurrencesAtFixRevision(repositoryId, headSha);
    let recorded = 0;
    for (const t of targets) {
      ledger.recordReceipt({
        occurrenceId: t.occurrence_id,
        kind: 'check_receipt',
        revision: headSha,
        payload: JSON.stringify({
          context, conclusion,
          reference: checkRun.html_url ?? checkRun.details_url ?? String(checkRun.id ?? 'check-run'),
          head_sha: headSha,
          delivery_id: environment?.delivery_id ?? null,
          source: 'github-webhook',
        }),
        actor: 'github/webhook',
      });
      recorded += 1;
    }
    return recorded;
  }

  async function drainOutbox({ publisherTransport, limit = 10 } = {}) {
    if (typeof publisherTransport !== 'function') {
      const e = new Error('[service] drainOutbox requires the publisher transport');
      e.code = 'E_NO_PUBLISHER';
      throw e;
    }
    const results = [];
    const mapFindings = (report) => (Array.isArray(report?.findings) ? report.findings : []).map((f) => ({
      key: f?.finding_id,
      requirement: f?.requirement ?? null,
      category: f?.category ?? null,
      severity: f?.severity ?? null,
      blocking: f?.blocking === true,
    })).filter((f) => typeof f.key === 'string');
    for (const event of ledger.outboxClaimBatch(limit, { nowMs: now() })) {
      if (event.event_type === 'github.event') {
        // R3-2/§11: HMAC-verified check_run events are the TRUSTED mechanical
        // evidence boundary — consumed into check receipts bound to the fix
        // revision. Every other GitHub event keeps its pending, unhandled row.
        let envelope;
        try { envelope = JSON.parse(event.payload); } catch { envelope = undefined; }
        if (envelope?.event === 'check_run') {
          const recorded = recordTrustedCheckReceipt(envelope);
          ledger.outboxMarkPublished(event.id);
          results.push({ event: event.event_type, action: 'check-run-recorded', receipts: recorded });
          continue;
        }
        results.push({ event: event.event_type, action: 'unhandled', reason: 'no consumer registered for this event type' });
        continue;
      }
      if (event.event_type !== 'report.submitted') {
        if (event.event_type === 'generation.claimed') {
          // bookkeeping whose action happened inside the claiming transaction
          ledger.outboxMarkPublished(event.id);
          results.push({ event: event.event_type, action: 'drained' });
        } else {
          // increment 5: unknown events stay pending — never consumed without their
          // required action (a future consumer claims them by type)
          results.push({ event: event.event_type, action: 'unhandled', reason: 'no consumer registered for this event type' });
        }
        continue;
      }
      const payload = JSON.parse(event.payload);
      const row = ledger.getReport(payload.report_id);
      let record;
      try { record = row ? JSON.parse(row.payload) : undefined; } catch { record = undefined; }
      const recordType = record?.record_type ?? record?.kind;
      if (payload.superseded === true) {
        // DR-R3 + increment 5 + cold-review fix 1: archived history is not
        // publishable work, but archival is NOT effect-dropping — a superseded
        // review's findings still enter the lifecycle, and superseded
        // fix/closure records still reach their consumers (the closure gate,
        // not the drain, is what refuses unproven evidence)
        if (recordType === 'review_report') {
          try { ledger.recordFindings(payload.report_id, mapFindings(record)); } catch { /* lineage already recorded from a replay */ }
          ledger.outboxMarkPublished(event.id);
          results.push({ event: event.event_type, action: 'archived' });
          continue;
        }
        if (recordType === 'fix_response' || recordType === 'closure_receipt') {
          const consumed = consumeLifecycleRecord(recordType, record, payload, row);
          results.push({ event: event.event_type, ...consumed });
          if (consumed.action !== 'kept-pending') ledger.outboxMarkPublished(event.id);
          continue;
        }
        ledger.outboxMarkPublished(event.id);
        results.push({ event: event.event_type, action: 'archived' });
        continue;
      }
      if (recordType === 'fix_response' || recordType === 'closure_receipt') {
        // lifecycle consumption of coordinator-side records — never an admission
        // check, never gated on publication pause (the ledger is authoritative)
        const consumed = consumeLifecycleRecord(recordType, record, payload, row);
        results.push({ event: event.event_type, ...consumed });
        if (consumed.action !== 'kept-pending') ledger.outboxMarkPublished(event.id);
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
      if (record?.protocol_version === 'dot-pr-review/2.0.0' && recordType === 'review_report') {
        // increment 5: the drain is the real consumer of an accepted review's findings
        try { ledger.recordFindings(payload.report_id, mapFindings(record)); } catch { /* lineage already recorded from a replay */ }
        // R3-2: an accepted review is the AUTHENTICATED outcome path — its verdict
        // becomes verdict-bearing change_review evidence on the findings its own
        // receipt names (a superseded review never mints current outcomes)
        recordReviewOutcome(row, record);
      }
      let outcome;
      try {
        outcome = await publishChecked({ publisherTransport, reportId: payload.report_id });
      } catch (e) {
        results.push({ event: event.event_type, action: 'kept-pending', code: e.code ?? 'E_TRANSPORT', reason: e.message });
        continue; // at-least-once: stay pending, redeliver on the next drain
      }
      if (outcome.published) {
        ledger.outboxMarkPublished(event.id);
        ledger.recordSideEffect(event.id, outcome.kind, outcome.externalId);
        results.push({ event: event.event_type, action: 'published', conclusion: outcome.kind });
      } else {
        results.push({ event: event.event_type, action: 'kept-pending', code: outcome.code, reason: outcome.reason });
      }
    }
    return results;
  }

  async function publishChecked({ publisherTransport, reportId }) {
    const run = {
      ledger, reportId, schemaBytes, schemaBytesV2, policy,
      app: { ...publisherApp, apiBase: publisherApp.apiBase ?? '', repo: policy.repository_full_name, prNumber: undefined },
      transport: publisherTransport,
      resolveRunIdentity,
      now: new Date(now()).toISOString(),
    };
    // the report's PR number comes from its own record — resolve it once
    // (V1 carries pull_request at the top level; V2 nests it in review_identity)
    const row = ledger.getReport(reportId);
    const report = JSON.parse(row.payload);
    run.app.prNumber = report.pull_request?.number ?? report.review_identity?.pull_request?.number;
    try {
      const res = await publishAdmission(run);
      return { published: true, kind: 'success', externalId: res.check?.external_id ?? res.check?.id };
    } catch (e) {
      if (e.code === 'E_NOT_AUTHORIZING') {
        // valid but non-authorizing record → publish the named failure check
        const res = await publishFailure({ ...run, reason: 'review verdict is not GO/COMPLETE' });
        return { published: true, kind: 'failure', externalId: res.check?.external_id ?? res.check?.id };
      }
      return { published: false, code: e.code ?? 'E_TRANSPORT', reason: e.message };
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
