// Publisher — the only writer of the dot-review/v1 required check. Spec §4/§6.
//
// Refusals implemented here are the gate:
//   - publication consumes an AUTHENTICATED LEDGER RECORD (review R1): the stored
//     payload is re-digested against the record's digest, re-validated against the
//     LIVE tuple read through the transport and the TRUSTED changed-file inventory
//     pinned to the generation, and the live mechanical state is rechecked through
//     evaluateReadiness with run identities resolved by the caller's Actions-aware
//     resolver. A caller-supplied `{ok:true}` authorizes nothing — there is no
//     caller-supplied validation parameter at all.
//   - success NEVER lands on the head: the check is written to the current tested
//     merge revision M, reread through the transport immediately before the write;
//   - non-GO/COMPLETE verdicts publish conclusion "failure" (a named, failed gate);
//     a report that fails validation publishes NOTHING (absence blocks natively);
//   - publication is idempotent by external_id (crash-after-accept recovery);
//   - App identity is the installation-token flow (RS256 JWT → installation token);
//     the check-run's App is whoever authenticated — it cannot be asserted.

import { createSign, createHash } from 'node:crypto';
import { validateReport } from './validate-report.mjs';
import { evaluateReadiness } from './readiness.mjs';
import { policyDigest, PROTOCOL_VERSION } from './load-policy.mjs';

const JWT_TTL_SECONDS = 600; // GitHub caps App JWTs at 10 minutes

export function createPublisherJwt(appId, privateKeyPem, nowMs = Date.now()) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const iat = Math.floor(nowMs / 1000) - 60; // small clock-drift allowance
  const payload = { iss: appId, iat, exp: iat + JWT_TTL_SECONDS };
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64(header)}.${b64(payload)}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  const sig = signer.sign(privateKeyPem).toString('base64url');
  return `${unsigned}.${sig}`;
}

// transport: (url, opts) => response body object; apiBase-relative URLs keep the
// transport stub-able in tests and injectable in deployment. Errors surface as
// thrown Error with .status.
export async function installationAccessToken(app, transport) {
  const jwt = createPublisherJwt(app.appId, app.privateKeyPem);
  const token = await transport(`${app.apiBase}/app/installations/${app.installationId}/access_tokens`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${jwt}`,
      accept: 'application/vnd.github+json',
    },
  });
  if (!token?.token) {
    const e = new Error('installation token request returned no token');
    e.code = 'E_APP_AUTH';
    throw e;
  }
  return token.token;
}

// Shared evidence assembly for both publications: the ledger record, its re-digest,
// re-validation against the live tuple + trusted inventory, and the mechanical
// recheck. `allowVerdicts` widens the accepted verdict set for failure publication.
async function loadAuthenticatedResult({ ledger, reportId, schemaBytes, schemaBytesV2, policy, app, transport, resolveRunIdentity, now }) {
  const row = ledger.getReport(reportId);
  if (!row) return refuse('E_NO_RECORD', `report ${reportId} is not in the ledger`);
  const digest = createHash('sha256').update(row.payload).digest('hex');
  if (digest !== row.payload_digest) {
    return refuse('E_DIGEST', 'stored payload no longer matches its recorded digest');
  }
  const challenge = ledger.getChallenge(row.claim_id);
  const generation = challenge ? ledger.getGeneration(challenge.generation_id) : undefined;
  let trustedInventory;
  if (generation?.changed_files_json) {
    try { trustedInventory = { changed_files: JSON.parse(generation.changed_files_json) }; } catch { trustedInventory = undefined; }
  }

  // live tuple through the transport — the report is never its own witness
  const pr = await transport(`${app.apiBase}/repos/${app.repo}/pulls/${app.prNumber}`, {
    headers: { accept: 'application/vnd.github+json' },
  });
  const mergeRef = await transport(`${app.apiBase}/repos/${app.repo}/git/ref/pull/${app.prNumber}/merge`, {
    headers: { accept: 'application/vnd.github+json' },
  }).catch((e) => {
    if (e.status === 404) return null; // merge ref vanished — nothing to publish on
    throw e;
  });
  const currentM = mergeRef?.object?.sha;
  if (!currentM) return refuse('E_MERGE_MOVED', 'tested merge revision refs/pull/N/merge is absent');
  const currentState = {
    repository_id: policy.repository_id,
    pr_number: app.prNumber,
    pr_node_id: pr.node_id,
    base_ref: pr.base?.ref,
    base_sha: pr.base?.sha,
    head_sha: pr.head?.sha,
    tested_merge_sha: currentM,
    policy_sha256: policyDigest(policy),
    protocol_version: policy.protocol_version ?? PROTOCOL_VERSION,
  };

  const validation = validateReport(row.payload, { schemaBytes, schemaBytesV2, policy, now, currentState, trustedInventory });
  // validation.ok is now the pure acceptable-document predicate (follow-up packet
  // increment 2): non-authorizing status rides in validation.nonAuthorizing, so every
  // error here is fatal for publication.
  if (!validation.ok) {
    const e = new Error(`[publisher] E_VALIDATION: stored record fails validation (${validation.errors.map((x) => x.code).join(', ')})`);
    e.code = 'E_VALIDATION';
    e.errors = validation.errors;
    throw e;
  }
  const report = validation.report;

  // live mechanical recheck — the report's embedded evidence does not substitute it
  const [mergeRuns, headRuns] = await Promise.all([
    listCheckRuns({ app, transport, sha: currentM }),
    listCheckRuns({ app, transport, sha: pr.head?.sha }),
  ]);
  const checks = [];
  for (const run of [...mergeRuns, ...headRuns]) {
    const identity = resolveRunIdentity ? await resolveRunIdentity(run) : {};
    checks.push({
      context: run.name,
      app_id: run.app?.id,
      sha: run.head_sha,
      conclusion: run.conclusion,
      workflow_path: identity.workflow_path,
      workflow_sha: identity.workflow_sha,
      run_id: identity.run_id,
      run_attempt: identity.run_attempt,
      run_started_at: identity.run_started_at,
    });
  }
  const readiness = evaluateReadiness(policy, {
    head_sha: pr.head?.sha,
    tested_merge_sha: currentM,
    mergeability: pr.mergeable_state,
    merge_ref_present: true,
    checks,
  });
  if (!readiness.ready) {
    const e = new Error(`[publisher] E_NOT_READY: mechanical state is not eligible (${readiness.blocking.map((b) => `${b.code}:${b.context ?? '-'}`).join(', ')})`);
    e.code = 'E_NOT_READY';
    e.blocking = readiness.blocking;
    throw e;
  }
  return { row, report, generation, authorizing: validation.authorizing === true, nonAuthorizing: validation.nonAuthorizing, currentM, pr };
}

// Publish the admission success check for the CURRENT M.
export async function publishAdmission({ ledger, reportId, schemaBytes, schemaBytesV2, policy, app, transport, resolveRunIdentity, now, externalId } = {}) {
  const result = await loadAuthenticatedResult({ ledger, reportId, schemaBytes, schemaBytesV2, policy, app, transport, resolveRunIdentity, now });
  const { row, report, generation, authorizing, nonAuthorizing, currentM } = result;
  if (!authorizing) {
    // the validator's marker message is protocol-shaped (V2 verdicts are objects —
    // never template them here)
    return refuse('E_NOT_AUTHORIZING', nonAuthorizing?.[0]?.message ?? `${report.kind}/${report.completion}/${report.verdict} is not an authorizing admission`);
  }
  return createCheck({
    app, policy, transport, sha: currentM, conclusion: 'success', externalId, report,
    identity: { payloadDigest: row.payload_digest, generation: generation?.seq, policySha: policyDigest(policy), mergeSha: currentM, conclusion: 'success' },
  });
}

// A named failure check on M for a valid non-authorizing report (REVISE/STOP/INCOMPLETE,
// execution failure). Invalid reports publish NOTHING — absence, not neutrality, blocks.
export async function publishFailure({ ledger, reportId, schemaBytes, schemaBytesV2, policy, app, transport, resolveRunIdentity, now, reason, externalId } = {}) {
  const result = await loadAuthenticatedResult({ ledger, reportId, schemaBytes, schemaBytesV2, policy, app, transport, resolveRunIdentity, now });
  const { row, report, generation, currentM } = result;
  return createCheck({
    app, policy, transport, sha: currentM, conclusion: 'failure', externalId, report,
    identity: { payloadDigest: row.payload_digest, generation: generation?.seq, policySha: policyDigest(policy), mergeSha: currentM, conclusion: 'failure' },
    summaryOverride: reason ?? `verdict ${report.verdict}/${report.completion}`,
  });
}

async function listCheckRuns({ app, transport, sha }) {
  const res = await transport(`${app.apiBase}/repos/${app.repo}/commits/${sha}/check-runs?per_page=100`, {
    headers: { accept: 'application/vnd.github+json' },
  }).catch((e) => {
    if (e.status === 404) return { check_runs: [] }; // the ref is gone — no evidence exists there
    throw e; // DR-R5: a failed discovery is NOT an empty discovery
  });
  return res.check_runs ?? [];
}

async function createCheck({ app, policy, transport, sha, conclusion, externalId, report, summaryOverride, identity }) {
  const token = await installationAccessToken(app, transport);
  const ext = externalId ?? stableExternalId(identity);
  // crash recovery: an accepted check with this id already exists → reuse it — but
  // only the SAME conclusion: an obsolete success must never stand in for a fresh
  // failure result, nor the reverse (DR-R5)
  const search = await transport(
    `${app.apiBase}/repos/${app.repo}/commits/${sha}/check-runs?per_page=100`,
    { headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' } },
  );
  for (const run of search.check_runs ?? []) {
    if (run.external_id === ext && run.app?.id === policy.dot_check.expected_app_id && run.conclusion === conclusion) {
      return { check: run, reused: true };
    }
  }
  const body = JSON.stringify({
    name: policy.dot_check.context,
    head_sha: sha, // never the PR head: M-only success is the freshness contract
    status: 'completed',
    conclusion,
    external_id: ext,
    output: {
      title: `${policy.dot_check.context} ${conclusion}`,
      summary: summaryOverride ?? `protocol ${report.protocol_version} · generation ${report.generation} · review ${report.review_id}`,
    },
  });
  const created = await transport(`${app.apiBase}/repos/${app.repo}/check-runs`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
    },
    body,
  });
  return { check: created, reused: false };
}

// DR-R5: publication identity derives from the AUTHENTICATED stored record and its
// publication context — the re-digested payload, the ledger generation, the policy
// era, the tested merge, and the publication INTENT. The old hash over V1 top-level
// fields left every V2 record with the same id (all four fields undefined), and the
// id said nothing about which conclusion the publication was writing.
function stableExternalId({ payloadDigest, generation, policySha, mergeSha, conclusion }) {
  const h = createHash('sha256')
    .update(`${payloadDigest}:${generation ?? ''}:${policySha ?? ''}:${mergeSha}:${conclusion}`)
    .digest('hex');
  return `dot-review:${h.slice(0, 32)}`;
}

function refuse(code, message) {
  const e = new Error(`[publisher] ${code}: ${message}`);
  e.code = code;
  throw e;
}
