// Auto-merge armer — a narrowly routed trusted client around a PR-write credential.
// Spec §4: no GitHub "arm-only" scope exists, so the residual-risk control is the
// client. Review R5 corrected two fabrication-grade bugs in the first cut: the route
// grammar expected ONE path component after /repos/ (so the REAL owner/repo path was
// refused while /repos/x passed), and "PUT /repos/{owner}/{repo}/pulls/{n}/auto-merge"
// is not a documented endpoint at all — enabling auto-merge is the GraphQL mutation
// enablePullRequestAutoMerge, addressed by PR node id.
//
// Controls implemented here:
//   - the configured owner/repo is enforced CLIENT-side on every read; the only write
//     is POST /graphql whose body must equal the pinned mutation (query + pullRequestId
//     + mergeMethod) — any other body is refused before the credential moves;
//   - the admission is re-validated HERE from the bytes (schema + policy + current
//     tuple) — no caller-supplied validation flag exists;
//   - the live PR read is bound against the reviewed report (head/base SHAs, open
//     non-draft staging state) before anything is written;
//   - protections snapshot guards: strict, dot-review/v1 required from the expected
//     publisher App, native pause inactive;
//   - idempotent: an already-armed PR is left alone.

import { validateReport } from './validate-report.mjs';
import { policyDigest, PROTOCOL_VERSION } from './load-policy.mjs';

const MUTATION = 'mutation($input: EnablePullRequestAutoMergeInput!) { enablePullRequestAutoMerge(input: $input) { clientMutationId } }';
const MERGE_METHODS = { squash: 'SQUASH', merge: 'MERGE', rebase: 'REBASE' };

export function createArmerClient({ repo, transport }) {
  const repoErr = repoShapeError(repo);
  if (repoErr) throw repoErr;
  let pinned = null; // { body: {query, variables} } — the ONLY /graphql body allowed
  return {
    repo,
    _pinGraphql(query, variables) {
      pinned = { query, variables };
    },
    async request(url, opts = {}) {
      const method = (opts.method ?? 'GET').toUpperCase();
      const readOk = new RegExp(`^/repos/${repo}/pulls/\\d+$`).test(url) && method === 'GET';
      const graphqlOk = url === '/graphql' && method === 'POST'
        && pinned !== null
        && sameJson(parseMaybe(opts.body), { query: pinned.query, variables: pinned.variables });
      if (!readOk && !graphqlOk) {
        const e = new Error(`[armer] route outside allowlist: ${method} ${url}`);
        e.code = 'E_ALLOWLIST';
        throw e;
      }
      return transport(url, opts);
    },
  };
}

export async function armAutoMerge({ repo, prNumber, reportText, schemaBytes, policy, trustedInventory, protections, transport, mergeMethod = 'squash' } = {}) {
  const repoErr = repoShapeError(repo);
  if (repoErr) throw repoErr;
  const methodEnum = MERGE_METHODS[mergeMethod];
  if (!methodEnum) {
    const e = new Error(`[armer] merge method "${mergeMethod}" is not squasheable — use squash|merge|rebase`);
    e.code = 'E_METHOD';
    throw e;
  }
  // authorization: the armer validates the bytes ITSELF (R1/R5 — no caller flag).
  // trustedInventory is the generation's pinned diff — the same trusted object the
  // intake validated against, re-checked here so arming cannot widen the review.
  let validation;
  try {
    validation = validateReport(reportText ?? '', {
      schemaBytes, policy, now: new Date().toISOString(), trustedInventory,
      currentState: {
        repository_id: policy.repository_id,
        pr_number: prNumber,
        base_sha: undefined, head_sha: undefined, tested_merge_sha: undefined,
        policy_sha256: policyDigest(policy), protocol_version: PROTOCOL_VERSION,
      },
    });
  } catch {
    validation = { ok: false, errors: [{ code: 'E_PARSE' }], report: undefined };
  }
  const report = validation.report;
  if (
    !validation.ok ||
    report?.kind !== 'admission' ||
    report?.completion !== 'COMPLETE' ||
    report?.verdict !== 'GO' ||
    (report?.findings ?? []).some((f) => f.blocking)
  ) {
    const e = new Error('[armer] admission is not an authorizing GO');
    e.code = 'E_NOT_AUTHORIZED';
    throw e;
  }

  // protections snapshot must show the gate we think is live
  const p = protections ?? {};
  if (p.pause_required === true) {
    const e = new Error('[armer] native pause is active — no arming');
    e.code = 'E_PAUSED';
    throw e;
  }
  if (p.strict !== true || !Array.isArray(p.required_checks)) {
    const e = new Error('[armer] protections snapshot incomplete or non-strict');
    e.code = 'E_PROTECTIONS';
    throw e;
  }
  const dotCheck = p.required_checks.find((c) => c.context === 'dot-review/v1');
  if (!dotCheck || dotCheck.app_id !== p.expected_dot_app_id) {
    const e = new Error('[armer] dot-review/v1 is not required from the expected App');
    e.code = 'E_PROTECTIONS';
    throw e;
  }

  // live PR read, bound against the reviewed report
  const readTransport = (url, opts = {}) => {
    if (!new RegExp(`^/repos/${repo}/pulls/\\d+$`).test(url) || (opts.method ?? 'GET').toUpperCase() !== 'GET') {
      const e = new Error(`[armer] route outside allowlist: ${opts.method ?? 'GET'} ${url}`);
      e.code = 'E_ALLOWLIST';
      throw e;
    }
    return transport(url, opts);
  };
  const pr = await readTransport(`/repos/${repo}/pulls/${prNumber}`, { headers: { accept: 'application/vnd.github+json' } });
  if (pr.state !== 'open' || pr.draft === true || pr.base?.ref !== 'staging') {
    const e = new Error(`[armer] PR #${prNumber} state ${pr.state}/draft=${pr.draft}/base=${pr.base?.ref} is not armable`);
    e.code = 'E_PR_STATE';
    throw e;
  }
  if (pr.head?.sha !== report.revision?.head_sha || pr.base?.sha !== report.revision?.base_sha) {
    const e = new Error(`[armer] live head/base moved since the review (head ${pr.head?.sha?.slice(0, 7)} vs reviewed ${report.revision?.head_sha?.slice(0, 7)})`);
    e.code = 'E_MISMATCH';
    throw e;
  }
  if (pr.auto_merge) {
    return { armed: false, already: true };
  }
  if (!pr.node_id) {
    const e = new Error('[armer] PR read carries no node_id — GraphQL addressing impossible');
    e.code = 'E_MISMATCH';
    throw e;
  }

  const client = createArmerClient({ repo, transport });
  const variables = { input: { pullRequestId: pr.node_id, mergeMethod: methodEnum } };
  client._pinGraphql(MUTATION, variables);
  await client.request('/graphql', {
    method: 'POST',
    headers: { accept: 'application/vnd.github+json', 'content-type': 'application/json' },
    body: JSON.stringify({ query: MUTATION, variables }),
  });
  return { armed: true, already: false };
}

function repoShapeError(repo) {
  if (typeof repo !== 'string' || !/^[^/\s]+\/[^/\s]+$/.test(repo)) {
    const e = new Error(`[armer] repo "${repo}" must be owner/name`);
    e.code = 'E_REPO';
    return e;
  }
  return null;
}

function parseMaybe(text) {
  try { return JSON.parse(text); } catch { return text; }
}

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
