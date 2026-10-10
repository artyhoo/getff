#!/usr/bin/env node
/**
 * check-result-review.mjs — read-only structural validator for intent-first-result
 * scoped-contract records (kickoff §3, canonical home `.agents/procedures/intent/helpers/`).
 *
 * ALL structural validation of the intent-contract ecosystem lives here: ContentRef
 * resolution inside configured owner roots (realpath containment + digest of exact bytes),
 * IntentContract / ResultReview / PlanReview shape + identity, and mode semantics
 * (produce needs no prior passing review; repair names the failed attempt and does NOT
 * require it to match; expand requires the exact selected matching attempt; a child scope
 * cannot weaken parent essentials). The helper checks structure and identities ONLY —
 * it never infers the product verdict, never writes, never runs probes, never contacts
 * a model. The fresh advisor owns comparison/explanation semantics.
 *
 * Import:  `import { validateResultReview, validatePlanReview, canonicalJson } from <this file>`
 * CLI:     node check-result-review.mjs --request <request-json-path | ->        (exit 0 valid / 2 reject-or-io)
 *          node check-result-review.mjs --plan-review <request-json-path | ->   (PlanReview binding check;
 *                                                                                same tagged result + exit codes)
 *          node check-result-review.mjs --pre-image <task-json-path | ->        (prints the reviewed
 *                                                                                task pre-image digest)
 * Request shape (validateResultReview):
 *   { roots: string[], contract?: IntentContract, contractRef?: ContentRef,
 *     reviewPath?: string, priorReviewPath?: string, observedRevision?: string,
 *     parentContract?: ContentRef }
 * Request shape (validatePlanReview):
 *   { roots?: string[], contractRef: ContentRef, taskId: string,
 *     taskPlanSha256: string, taskPreImageSha256: string, payloadSha256?: string,
 *     planReview: PlanReview }
 *
 * Check order is load-bearing (each rejecting test pins ONE code):
 *   contract side:  contract_missing → shape/unsupported_version → duplicate_ids →
 *                   ref resolution (path_escapes_roots → ref_missing → ref_digest_mismatch) →
 *                   parent-weakening (weakens_parent_scope BEFORE inline↔ref parity, because a
 *                   declared child scope legitimately differs from its registered parent) →
 *                   declared_scope_mismatch (inline vs registered parity).
 *   review side:    review_missing → shape/unsupported_version → identity
 *                   (contract_review_cycle BEFORE producer_mismatch) → stale_review →
 *                   outcome semantics (contradicted_essential BEFORE missing_essential_evidence).
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const CONTRACT_VERSION = 1;
const MODES = ['produce', 'repair', 'expand'];
const OUTCOMES = ['matches', 'mismatch', 'needs-evidence', 'needs-operator'];
const COMPARISONS = ['supported', 'contradicted', 'unobserved', 'needs-operator'];
const CLASSIFICATIONS = ['within-contract', 'contract-revision', 'product-decision'];
const SHA256_RE = /^[0-9a-f]{64}$/;
/** Fixed ownership-relevant field list for the reviewed task pre-image digest. */
const PRE_IMAGE_FIELDS = ['autoMode', 'executionOwner', 'id', 'ownershipRevision', 'paused', 'plan', 'status', 'title'];

const ok = () => ({ ok: true });
const reject = (code, reason) => ({ ok: false, code, reason });
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Deterministic serialization: object keys sorted recursively, arrays in order. */
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

const isHex64 = (v) => typeof v === 'string' && SHA256_RE.test(v);
const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;

function isContentRef(v) {
  return (
    v !== null &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    isNonEmptyString(v.path) &&
    isHex64(v.sha256)
  );
}

function contained(candidate, root) {
  return candidate === root || candidate.startsWith(root + sep);
}

/**
 * Resolve a ContentRef against the configured owner roots. Containment is checked on the
 * realpath BEFORE existence, so an escaping path rejects as path_escapes_roots even when
 * the target file exists outside the roots. Returns { bytes } or a reject result.
 */
export function resolveContentRef(ref, roots) {
  if (!Array.isArray(roots) || roots.length === 0) return reject('ref_missing', 'no owner roots configured');
  if (!isContentRef(ref)) return reject('invalid_ref', 'ContentRef must be {path: string, sha256: 64-hex}');
  for (const root of roots) {
    let realRoot;
    try {
      realRoot = realpathSync(root);
    } catch {
      continue;
    }
    const abs = isAbsolute(ref.path) ? ref.path : resolve(root, ref.path);
    let intended;
    try {
      // Intended leaf location even when the leaf itself is absent (parent dir must exist).
      intended = join(realpathSync(dirname(abs)), basename(abs));
    } catch {
      continue;
    }
    if (!contained(intended, realRoot)) continue;
    if (!existsSync(intended) || !statSync(intended).isFile()) return reject('ref_missing', `no file at ${ref.path} under the configured roots`);
    const real = realpathSync(intended);
    if (!contained(real, realRoot)) continue; // symlink dodging out of the root — try other roots
    const bytes = readFileSync(real);
    if (sha256(bytes) !== ref.sha256) {
      return reject('ref_digest_mismatch', `bytes at ${ref.path} do not match the bound digest`);
    }
    return { ok: true, bytes };
  }
  return reject('path_escapes_roots', `${ref.path} resolves outside every configured owner root`);
}

function loadJsonRef(ref, roots, label) {
  const res = resolveContentRef(ref, roots);
  if (!res.ok) return res;
  try {
    return { ok: true, value: JSON.parse(res.bytes.toString('utf8')) };
  } catch (err) {
    return reject('invalid_json', `${label} is not valid JSON: ${err.message}`);
  }
}

/**
 * Read a review path (a relative path WITHOUT a bound digest — the digest identity of a
 * review is established by its content bindings, not by a ref naming itself).
 */
function readRelative(relPath, roots) {
  for (const root of Array.isArray(roots) ? roots : []) {
    let realRoot;
    try {
      realRoot = realpathSync(root);
    } catch {
      continue;
    }
    const abs = resolve(root, relPath);
    let intended;
    try {
      intended = join(realpathSync(dirname(abs)), basename(abs));
    } catch {
      continue;
    }
    if (!contained(intended, realRoot)) continue;
    if (!existsSync(intended) || !statSync(intended).isFile()) return reject('review_missing', `no file at ${relPath} under the configured roots`);
    const real = realpathSync(intended);
    if (!contained(real, realRoot)) continue;
    return { ok: true, bytes: readFileSync(real) };
  }
  return reject('path_escapes_roots', `${relPath} resolves outside every configured owner root`);
}

// ---------------------------------------------------------------------------
// Contract side
// ---------------------------------------------------------------------------
function validateContractShape(contract) {
  if (contract === null || typeof contract !== 'object' || Array.isArray(contract)) {
    return reject('invalid_contract', 'contract must be a JSON object');
  }
  if (contract.version !== CONTRACT_VERSION) return reject('unsupported_version', `contract.version must be ${CONTRACT_VERSION}`);
  if (!isNonEmptyString(contract.featureId)) return reject('invalid_contract', 'featureId must be a non-empty string');
  if (!isNonEmptyString(contract.resultId)) return reject('invalid_contract', 'resultId must be a non-empty string');
  if (!MODES.includes(contract.mode)) return reject('invalid_contract', `mode must be one of ${MODES.join(' | ')}`);
  if (!isContentRef(contract.brief)) return reject('invalid_contract', 'brief must be a ContentRef');
  if (!Array.isArray(contract.shared) || !contract.shared.every(isContentRef)) {
    return reject('invalid_contract', 'shared must be an array of ContentRefs');
  }
  if (
    !Array.isArray(contract.essentialPromiseIds) ||
    contract.essentialPromiseIds.length === 0 ||
    !contract.essentialPromiseIds.every(isNonEmptyString)
  ) {
    return reject('invalid_contract', 'essentialPromiseIds must be a non-empty array of strings');
  }
  if (new Set(contract.essentialPromiseIds).size !== contract.essentialPromiseIds.length) {
    return reject('duplicate_ids', 'essentialPromiseIds contains conflicting duplicate IDs');
  }
  if (contract.mode !== 'produce') {
    if (!isNonEmptyString(contract.producesOrRepairs)) {
      return reject('invalid_contract', `${contract.mode} contracts must name producesOrRepairs`);
    }
  }
  if (contract.mode === 'expand' && !isContentRef(contract.parentContract)) {
    return reject('invalid_contract', 'expand contracts must bind parentContract');
  }
  if (contract.requiresReview !== undefined && !isContentRef(contract.requiresReview)) {
    return reject('invalid_contract', 'requiresReview must be a ContentRef');
  }
  return ok();
}

function resolveContractRefs(contract, roots) {
  const refs = [contract.brief, ...contract.shared];
  for (const ref of refs) {
    const res = resolveContentRef(ref, roots);
    if (!res.ok) return res;
  }
  return ok();
}

function checkParentScope(enforcing, parent, roots) {
  if (!Array.isArray(parent.essentialPromiseIds)) return reject('invalid_contract', 'parent contract has no essentialPromiseIds');
  // A child cannot WEAKEN its parent: every parent essential must survive in the child scope.
  const dropped = parent.essentialPromiseIds.filter((id) => !enforcing.essentialPromiseIds.includes(id));
  if (dropped.length > 0) {
    return reject('weakens_parent_scope', `child scope drops parent essentials: ${dropped.join(', ')}`);
  }
  return ok();
}

// ---------------------------------------------------------------------------
// Review side
// ---------------------------------------------------------------------------
function validateReviewShape(review) {
  if (review === null || typeof review !== 'object' || Array.isArray(review)) {
    return reject('invalid_review', 'result review must be a JSON object');
  }
  if (review.version !== CONTRACT_VERSION) return reject('unsupported_version', `review.version must be ${CONTRACT_VERSION}`);
  if (!isNonEmptyString(review.attemptId)) return reject('invalid_review', 'attemptId must be a non-empty string');
  if (!isNonEmptyString(review.featureId)) return reject('invalid_review', 'featureId must be a non-empty string');
  if (!isNonEmptyString(review.resultId)) return reject('invalid_review', 'resultId must be a non-empty string');
  if (!isContentRef(review.brief)) return reject('invalid_review', 'brief must be a ContentRef');
  if (!isContentRef(review.producerContract)) return reject('invalid_review', 'producerContract must be a ContentRef');
  if (!isNonEmptyString(review.observedRevision)) return reject('invalid_review', 'observedRevision must be a non-empty string');
  if (!Array.isArray(review.sourceInputs) || !review.sourceInputs.every(isContentRef)) {
    return reject('invalid_review', 'sourceInputs must be an array of ContentRefs');
  }
  if (!isContentRef(review.environment)) return reject('invalid_review', 'environment must be a ContentRef');
  if (!Array.isArray(review.evidence) || !review.evidence.every(isContentRef)) {
    return reject('invalid_review', 'evidence must be an array of ContentRefs');
  }
  if (!Array.isArray(review.promises) || review.promises.length === 0) {
    return reject('invalid_review', 'promises must be a non-empty array');
  }
  const seen = new Set();
  for (const p of review.promises) {
    if (p === null || typeof p !== 'object' || Array.isArray(p)) return reject('invalid_review', 'each promise must be an object');
    if (!isNonEmptyString(p.id)) return reject('invalid_review', 'promise.id must be a non-empty string');
    if (!COMPARISONS.includes(p.comparison)) return reject('invalid_comparison', `comparison must be one of ${COMPARISONS.join(' | ')}`);
    if (!Array.isArray(p.evidence) || !p.evidence.every(isContentRef)) {
      return reject('invalid_review', `promise ${p.id} evidence must be an array of ContentRefs`);
    }
    if (!isNonEmptyString(p.explanation)) return reject('invalid_review', `promise ${p.id} explanation must be a non-empty string`);
    if (seen.has(p.id)) return reject('duplicate_ids', `conflicting duplicate promise ID ${p.id}`);
    seen.add(p.id);
  }
  if (!OUTCOMES.includes(review.outcome)) return reject('invalid_outcome', `outcome must be one of ${OUTCOMES.join(' | ')}`);
  if (!Array.isArray(review.limits)) return reject('invalid_review', 'limits must be an array of strings');
  if (!review.limits.every(isNonEmptyString)) return reject('invalid_review', 'limits entries must be non-empty strings');
  if (review.operatorCheckpoint !== undefined && !isContentRef(review.operatorCheckpoint)) {
    return reject('invalid_review', 'operatorCheckpoint must be a ContentRef');
  }
  return ok();
}

function resolveReviewRefs(review, roots) {
  // brief + producerContract are IDENTITY fields — they are compared against the enforcing
  // contract (brief_mismatch / producer_mismatch); digest-verifying them here first would
  // mask the identity finding behind ref_digest_mismatch. Evidence-class refs are resolved.
  const refs = [review.environment, ...review.sourceInputs, ...review.evidence];
  for (const p of review.promises) refs.push(...p.evidence);
  if (review.operatorCheckpoint !== undefined) refs.push(review.operatorCheckpoint);
  for (const ref of refs) {
    const res = resolveContentRef(ref, roots);
    if (!res.ok) return res;
  }
  return ok();
}

function checkReviewOutcomeSemantics(review, enforcing) {
  if (review.outcome !== 'matches') return ok(); // mismatch/needs-* reviews are structurally valid;
  // continuation authorization is decided per-mode below and by the adapter policy.
  for (const p of review.promises) {
    if (!enforcing.essentialPromiseIds.includes(p.id)) continue;
    if (p.comparison === 'contradicted') {
      return reject('contradicted_essential', `essential ${p.id} is contradicted by its recorded evidence`);
    }
  }
  for (const id of enforcing.essentialPromiseIds) {
    const p = review.promises.find((x) => x.id === id);
    if (!p || p.comparison !== 'supported' || p.evidence.length === 0) {
      return reject('missing_essential_evidence', `essential ${id} is not supported by recorded observations`);
    }
  }
  if (review.operatorCheckpoint !== undefined) {
    return reject('outstanding_checkpoint', 'an operator checkpoint is recorded and unresolved');
  }
  return ok();
}

// ---------------------------------------------------------------------------
// validateResultReview
// ---------------------------------------------------------------------------
export function validateResultReview(request) {
  if (request === null || typeof request !== 'object' || Array.isArray(request)) {
    return reject('invalid_request', 'request must be a JSON object');
  }
  const roots = request.roots;

  // 1. Establish the enforcing contract (inline declared scope, registered ref, or both).
  let enforcing;
  if (request.contract !== undefined && request.contract !== null) {
    const shape = validateContractShape(request.contract);
    if (!shape.ok) return shape;
    enforcing = request.contract;
  } else if (request.contractRef !== undefined && request.contractRef !== null) {
    const loaded = loadJsonRef(request.contractRef, roots, 'contract');
    if (!loaded.ok) return loaded;
    const shape = validateContractShape(loaded.value);
    if (!shape.ok) return shape;
    enforcing = loaded.value;
  } else {
    return reject('contract_missing', 'request supplies neither contract nor contractRef');
  }

  // 2. Ref resolution for the enforcing scope (paths may not escape; bytes must match).
  const refs = resolveContractRefs(enforcing, roots);
  if (!refs.ok) return refs;

  // 3. Parent scope (from the request or the contract itself): a child cannot weaken parent
  //    essentials. Runs BEFORE inline↔ref parity — a declared child legitimately differs
  //    from its registered parent, and the weakening is the finding that matters.
  const parentRef = request.parentContract ?? enforcing.parentContract;
  if (parentRef !== undefined && parentRef !== null) {
    const loadedParent = loadJsonRef(parentRef, roots, 'parent contract');
    if (!loadedParent.ok) return loadedParent;
    const parentShape = validateContractShape(loadedParent.value);
    if (!parentShape.ok) return parentShape;
    const parentRes = checkParentScope(enforcing, loadedParent.value, roots);
    if (!parentRes.ok) return parentRes;
  }

  // 4. Inline↔registered parity: a declared inline scope that names a registered contract
  //    must equal it canonically.
  if (request.contract !== undefined && request.contract !== null && request.contractRef !== undefined && request.contractRef !== null) {
    const loaded = loadJsonRef(request.contractRef, roots, 'contract');
    if (!loaded.ok) return loaded;
    if (canonicalJson(loaded.value) !== canonicalJson(request.contract)) {
      return reject('declared_scope_mismatch', 'declared inline scope diverges from the registered contract');
    }
  }

  // 5. Current review (the attempt whose result the continuation depends on).
  if (request.reviewPath !== undefined && request.reviewPath !== null) {
    const read = readRelative(request.reviewPath, roots);
    if (!read.ok) return read;
    let review;
    try {
      review = JSON.parse(read.bytes.toString('utf8'));
    } catch (err) {
      return reject('invalid_review', `review is not valid JSON: ${err.message}`);
    }
    const shape = validateReviewShape(review);
    if (!shape.ok) return shape;
    const refsRes = resolveReviewRefs(review, roots);
    if (!refsRes.ok) return refsRes;

    if (review.featureId !== enforcing.featureId) {
      return reject('feature_mismatch', `review feature ${review.featureId} != contract feature ${enforcing.featureId}`);
    }
    if (review.resultId !== enforcing.resultId) {
      return reject('result_mismatch', `review result ${review.resultId} != contract result ${enforcing.resultId}`);
    }
    if (canonicalJson(review.brief) !== canonicalJson(enforcing.brief)) {
      return reject('brief_mismatch', 'review is bound to different brief bytes than the contract');
    }
    // Cycle before producer match: a review produced under the enforcing expansion contract
    // itself is a contract→review→same-contract digest cycle.
    const selfRef = request.contractRef;
    if (
      selfRef !== undefined &&
      selfRef !== null &&
      enforcing.parentContract !== undefined &&
      canonicalJson(review.producerContract) === canonicalJson(selfRef)
    ) {
      return reject('contract_review_cycle', 'review was produced under the enforcing contract itself');
    }
    const baseRef = enforcing.parentContract ?? request.contractRef;
    if (baseRef !== undefined && baseRef !== null && canonicalJson(review.producerContract) !== canonicalJson(baseRef)) {
      return reject('producer_mismatch', 'review producer contract is not the enforcing base contract');
    }
    if (request.observedRevision !== undefined && request.observedRevision !== null) {
      if (review.observedRevision !== request.observedRevision) {
        return reject('stale_review', `review observedRevision ${review.observedRevision} is behind the current binding ${request.observedRevision}`);
      }
    }
    if (enforcing.mode === 'expand' && review.attemptId !== enforcing.producesOrRepairs) {
      return reject('matching_attempt_mismatch', `expansion is bound to ${enforcing.producesOrRepairs}, review records ${review.attemptId}`);
    }
    if (review.outcome !== 'matches') {
      if (enforcing.mode === 'expand') {
        return reject('expansion_requires_match', 'expansion requires the exact selected matching attempt');
      }
      return reject('review_not_matching', `review outcome ${review.outcome} does not authorize continuation`);
    }
    const semantics = checkReviewOutcomeSemantics(review, enforcing);
    if (!semantics.ok) return semantics;
  }

  // 6. Prior review (repair semantics): names the failed attempt being repaired.
  if (request.priorReviewPath !== undefined && request.priorReviewPath !== null) {
    const read = readRelative(request.priorReviewPath, roots);
    if (!read.ok) return read;
    let prior;
    try {
      prior = JSON.parse(read.bytes.toString('utf8'));
    } catch (err) {
      return reject('invalid_review', `prior review is not valid JSON: ${err.message}`);
    }
    const shape = validateReviewShape(prior);
    if (!shape.ok) return shape;
    if (enforcing.producesOrRepairs !== undefined && prior.attemptId !== enforcing.producesOrRepairs) {
      return reject('prior_attempt_mismatch', `repair names ${enforcing.producesOrRepairs}, prior review records ${prior.attemptId}`);
    }
    if (prior.outcome === 'matches') {
      return reject('repair_target_already_matches', 'the named prior attempt already matches — nothing to repair');
    }
  }

  return ok();
}

// ---------------------------------------------------------------------------
// validatePlanReview — structural validation only; a digest never grants authority.
// ---------------------------------------------------------------------------
export function validatePlanReview(request) {
  if (request === null || typeof request !== 'object' || Array.isArray(request)) {
    return reject('invalid_request', 'request must be a JSON object');
  }
  const review = request.planReview;
  if (review === null || typeof review !== 'object' || Array.isArray(review)) {
    return reject('plan_review_invalid', 'planReview must be a JSON object');
  }
  if (!isNonEmptyString(review.taskId)) return reject('plan_review_invalid', 'taskId must be a non-empty string');
  if (!isContentRef(review.contractRef)) return reject('plan_review_invalid', 'contractRef must be a ContentRef');
  if (!isHex64(review.effectivePlanSha256)) return reject('plan_review_invalid', 'effectivePlanSha256 must be 64 hex chars');
  if (!isHex64(review.taskPreImageSha256)) return reject('plan_review_invalid', 'taskPreImageSha256 must be 64 hex chars');
  if (review.payloadSha256 !== undefined && !isHex64(review.payloadSha256)) {
    return reject('plan_review_invalid', 'payloadSha256 must be 64 hex chars');
  }
  if (!CLASSIFICATIONS.includes(review.classification)) {
    return reject('invalid_classification', `classification must be one of ${CLASSIFICATIONS.join(' | ')}`);
  }
  if (!isNonEmptyString(review.ownerReference)) return reject('owner_reference_missing', 'a digest alone grants no authority — owner reference required');

  if (!isNonEmptyString(request.taskId)) return reject('invalid_request', 'taskId must be a non-empty string');
  if (!isContentRef(request.contractRef)) return reject('invalid_request', 'contractRef must be a ContentRef');
  if (!isHex64(request.taskPlanSha256)) return reject('invalid_request', 'taskPlanSha256 must be 64 hex chars');
  if (!isHex64(request.taskPreImageSha256)) return reject('invalid_request', 'taskPreImageSha256 must be 64 hex chars');
  if (request.payloadSha256 !== undefined && !isHex64(request.payloadSha256)) {
    return reject('invalid_request', 'payloadSha256 must be 64 hex chars');
  }

  if (review.taskId !== request.taskId) {
    return reject('plan_review_task_mismatch', `review names task ${review.taskId}, continuation targets ${request.taskId}`);
  }
  if (canonicalJson(review.contractRef) !== canonicalJson(request.contractRef)) {
    return reject('contract_ref_mismatch', 'plan review names a different contract than the declared scope');
  }
  if (review.effectivePlanSha256 !== request.taskPlanSha256) {
    return reject('plan_digest_mismatch', 'plan bytes changed since the review');
  }
  if (review.taskPreImageSha256 !== request.taskPreImageSha256) {
    return reject('pre_image_digest_mismatch', 'reviewed task pre-image does not match the current task row');
  }
  const reviewedPayload = review.payloadSha256;
  const proposedPayload = request.payloadSha256;
  if (proposedPayload !== undefined && reviewedPayload !== proposedPayload) {
    return reject('payload_digest_mismatch', 'proposed payload bytes differ from the reviewed payload');
  }
  if (proposedPayload === undefined && reviewedPayload !== undefined) {
    return reject('payload_digest_mismatch', 'review binds a payload but no payload is proposed');
  }
  return { ok: true, classification: review.classification };
}

/** Digest of the fixed ownership-relevant projection of a task row (single source of the definition). */
export function taskPreImageDigestOf(task) {
  const picked = {};
  for (const field of PRE_IMAGE_FIELDS) {
    if (task !== null && typeof task === 'object' && task[field] !== undefined) picked[field] = task[field];
  }
  return sha256(canonicalJson(picked));
}

// ---------------------------------------------------------------------------
// CLI — read-only; never writes; parse/IO failures exit 2.
// ---------------------------------------------------------------------------
function readInput(path) {
  if (path === '-') return { bytes: readFileSync(0) };
  return { bytes: readFileSync(path) };
}

function main() {
  const args = process.argv.slice(2);
  const emit = (result, code) => {
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exit(code);
  };
  const fail = (code, reason) => emit(reject(code, reason), 2);

  const flag = args[0];
  const value = args[1];
  if ((flag !== '--request' && flag !== '--pre-image' && flag !== '--plan-review') || value === undefined || args.length !== 2) {
    fail('invalid_request', 'usage: check-result-review.mjs --request <path|-> | --plan-review <path|-> | --pre-image <path|->');
    return;
  }
  let parsed;
  try {
    parsed = JSON.parse(readInput(value).bytes.toString('utf8'));
  } catch (err) {
    fail('invalid_request', `cannot read/parse input: ${err.message}`);
    return;
  }
  if (flag === '--request') {
    const result = validateResultReview(parsed);
    emit(result, result.ok ? 0 : 2);
    return;
  }
  if (flag === '--plan-review') {
    const result = validatePlanReview(parsed);
    emit(result, result.ok ? 0 : 2);
    return;
  }
  try {
    emit({ ok: true, preImageSha256: taskPreImageDigestOf(parsed) }, 0);
  } catch (err) {
    fail('invalid_request', `cannot digest pre-image: ${err.message}`);
  }
}

// Am-I-entry-point lock — realpath BOTH sides (SSOT #269 / principle 47). Node resolves
// import.meta.url through symlinks while process.argv[1] is the path as typed, so a bare
// resolve() compare is false through the `.claude/skills/intent/` symlink twin and the CLI
// dies silently (exit 0, no output). Inlined because this helper ships inside the copied
// skill tree and cannot import scripts/lib/is-main-entry.mjs — the same constraint that
// module's header documents for its packages/core twin.
const isMainEntryLock =
  process.argv[1] !== undefined &&
  (() => {
    try {
      return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
    } catch {
      return resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
    }
  })();

if (isMainEntryLock) {
  main();
}
