// Trusted policy manifest loader — fail-closed.
//
// The manifest makes mechanical contexts MANDATORY and binds each to an expected
// publisher App (spec §4: trusted manifest of mechanical contexts, workflow identities
// and load-bearing code versions). A manifest containing an UNRESOLVED placeholder must
// fail the load: a partially resolved manifest silently narrows the gate. Structural
// rules enforced here (they are policy, not schema):
//   - repository identity must be the observed repo (id + full_name);
//   - mechanical_contexts non-empty; NONE may be a dot-review/* context (circular
//     waiting prevention); every entry carries bound_to: 'head' | 'merge';
//   - dot_check names the production admission context dot-review/v1;
//   - limits positive; authorization_expiry a valid future UTC instant;
//   - at least one enrolled reviewer principal (numeric IDs only).

import { createHash } from 'node:crypto';
import { parseStrictJson } from './strict-json.mjs';

export const DOT_CHECK_CONTEXT = 'dot-review/v1';
export const OBSERVE_CHECK_CONTEXT = 'dot-review/observe-v1';
export const PAUSE_CHECK_CONTEXT = 'dot-review/pause';
export const PROTOCOL_VERSION = 'dot-staging-review/1.0';
// The gate spans both contract eras: V1 (DotStagingReviewV1) and V2 (DotPRReviewV2,
// follow-up packet §5). A deployment's policy declares WHICH era it runs; the
// validators dispatch per record.
export const SUPPORTED_PROTOCOLS = ['dot-staging-review/1.0', 'dot-pr-review/2.0.0'];

const PLACEHOLDER = /^\s*(UNRESOLVED|TBD|PLACEHOLDER)\s*$/i;

export function loadPolicy(text) {
  const p = parseStrictJson(text ?? '');
  const fails = [];
  const reject = (code, message) => fails.push({ code, message });

  const noPlaceholder = (v, what) => {
    if (v === undefined || v === null || (typeof v === 'string' && (PLACEHOLDER.test(v) || v.length === 0))) {
      reject('E_PLACEHOLDER', `${what} is unresolved`);
      return false;
    }
    return true;
  };

  noPlaceholder(p.policy_version, 'policy_version');
  if (!SUPPORTED_PROTOCOLS.includes(p.protocol_version)) {
    reject('E_PROTOCOL', `protocol_version must be one of ${SUPPORTED_PROTOCOLS.join(' | ')}`);
  }

  if (p.repository_id !== 1231007068 || p.repository_full_name !== 'artyhoo/getff') {
    reject('E_REPOSITORY', 'repository identity must be artyhoo/getff (1231007068)');
  }
  noPlaceholder(p.schema_sha256, 'schema_sha256');

  if (!Array.isArray(p.mechanical_contexts) || p.mechanical_contexts.length === 0) {
    reject('E_MECHANICAL', 'mechanical_contexts must be a non-empty list');
  } else {
    for (const c of p.mechanical_contexts) {
      if (!c || typeof c.context !== 'string') { reject('E_MECHANICAL', 'mechanical context entry malformed'); continue; }
      if (c.context.startsWith('dot-review/')) reject('E_MECHANICAL', `"${c.context}" cannot be a mechanical context`);
      if (!['head', 'merge'].includes(c.bound_to)) reject('E_MECHANICAL', `"${c.context}" bound_to must be head|merge`);
      if (!Number.isInteger(c.expected_app_id) || c.expected_app_id <= 0) reject('E_MECHANICAL', `"${c.context}" expected_app_id must be a positive integer`);
      // R9: the trusted workflow identity is a POLICY fact — readiness verifies the
      // run's workflow against this path, so an Actions App alone is not trust.
      if (typeof c.workflow_path !== 'string' || !c.workflow_path.startsWith('.github/workflows/')) {
        reject('E_MECHANICAL', `"${c.context}" workflow_path must name a .github/workflows/ file`);
      }
      if (c.workflow_sha !== undefined && (typeof c.workflow_sha !== 'string' || !/^[0-9a-f]{40}$/.test(c.workflow_sha))) {
        reject('E_MECHANICAL', `"${c.context}" workflow_sha, when pinned, must be a 40-hex blob sha`);
      }
    }
  }

  if (!p.dot_check || p.dot_check.context !== DOT_CHECK_CONTEXT) {
    reject('E_DOT_CHECK', `dot_check.context must be ${DOT_CHECK_CONTEXT}`);
  } else if (!Number.isInteger(p.dot_check.expected_app_id) || p.dot_check.expected_app_id <= 0) {
    reject('E_PLACEHOLDER', 'dot_check.expected_app_id is unresolved');
  }

  if (!Array.isArray(p.reviewer_principal_ids) || p.reviewer_principal_ids.length === 0 ||
      !p.reviewer_principal_ids.every((id) => Number.isInteger(id) && id > 0)) {
    reject('E_PRINCIPAL', 'reviewer_principal_ids must be non-empty numeric IDs');
  }

  const lim = p.limits ?? {};
  if (!(Number.isInteger(lim.max_active_claims) && lim.max_active_claims >= 1) ||
      !(Number.isInteger(lim.max_attempts_per_tuple) && lim.max_attempts_per_tuple >= 1) ||
      !(Number.isInteger(lim.claim_lease_minutes) && lim.claim_lease_minutes >= 1)) {
    reject('E_LIMITS', 'limits.max_active_claims / max_attempts_per_tuple / claim_lease_minutes must be positive integers');
  }

  if (typeof p.authorization_expiry === 'string' && !PLACEHOLDER.test(p.authorization_expiry)) {
    const t = Date.parse(p.authorization_expiry);
    if (!Number.isFinite(t)) reject('E_EXPIRY', 'authorization_expiry is not a valid timestamp');
    else if (t <= Date.now()) reject('E_EXPIRY', 'authorization_expiry is in the past');
  } else {
    reject('E_PLACEHOLDER', 'authorization_expiry is unresolved');
  }

  if (fails.length > 0) {
    const e = new Error(`policy manifest rejected: ${fails.map((f) => f.message).join('; ')}`);
    e.code = fails[0].code;
    e.fails = fails;
    throw e;
  }
  return p;
}

export function isDotContext(name) {
  return typeof name === 'string' && name.startsWith('dot-review/');
}

export function mandatoryMechanical(policy) {
  return policy.mechanical_contexts ?? [];
}

export function policyDigest(policy) {
  return createHash('sha256').update(JSON.stringify(policy)).digest('hex');
}
