// Native Dot source boundary. Reuses the strict JSON reader and byte digest;
// it never interprets retained plans, performs transport or grants ownership.
import { constants, openSync, closeSync, fstatSync, readFileSync, lstatSync } from 'node:fs';
import { resolve, isAbsolute, dirname } from 'node:path';
import { parseStrictJson } from '../dot-review-gate/strict-json.mjs';
import { sha256Hex } from '../dot-review-gate/digest.mjs';

export const NATIVE_DOT = Object.freeze({ producer: 'DOT_GETFF_PRIMARY', epoch: 'DOT_PRIMARY_EPOCH_1', page_id: 'page_c7f1e26ac5b88191a9851a9f21c259d4' });
const hash = /^[0-9a-f]{64}$/;
const id = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/;
const head = /^[0-9a-f]{40}$/;
const reject = (code = 'DOT_SOURCE_UNTRUSTED') => { throw Object.assign(new Error(code), { code }); };
export function exactNativeKeys(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join(',') !== [...keys].sort().join(',')) reject();
}
export function nativeDescriptor(value) {
  exactNativeKeys(value, ['page_id', 'reference', 'sha256', 'bytes']);
  if (typeof value.page_id !== 'string' || !value.page_id.startsWith('page_') || typeof value.reference !== 'string'
    || !/^(library-file|project-file):.+$/.test(value.reference) || value.reference.length > 2048
    || !hash.test(value.sha256 ?? '') || !Number.isSafeInteger(value.bytes) || value.bytes < 1 || value.bytes > 1048576) reject();
  return value;
}
export function privateNativeBytes(path, { root = null, maxBytes = 1048576 } = {}) {
  if (typeof path !== 'string' || !isAbsolute(path) || path.split('/').includes('..') || path !== resolve(path)) reject();
  if (root && !path.startsWith(resolve(root) + '/')) reject();
  const anchor = root ? resolve(root) : dirname(path);
  for (let p = dirname(path);; p = dirname(p)) {
    if (lstatSync(p).isSymbolicLink()) reject();
    if (p === anchor) break;
  }
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const st = fstatSync(fd);
    if (!st.isFile() || st.uid !== process.geteuid() || (st.mode & 0o022) || st.size < 1 || st.size > maxBytes) reject();
    return readFileSync(fd);
  } finally { closeSync(fd); }
}
export function admittedNativeInput(root, file, binding, effect) {
  try {
    const bytes = privateNativeBytes(file, { root: resolve(root, 'native-source'), maxBytes: 32768 });
    const evidence = binding.native_source_admission;
    exactNativeKeys(evidence, ['path', 'sha256']);
    const admissionBytes = privateNativeBytes(evidence.path, { maxBytes: 32768 });
    if (sha256Hex(admissionBytes) !== evidence.sha256) reject();
    const a = parseStrictJson(admissionBytes.toString('utf8'), { maxBytes: 32768 });
    exactNativeKeys(a, ['version', 'owner', 'effects']);
    if (a.version !== 1 || a.owner !== binding.owner || !a.effects || a.effects[effect] !== sha256Hex(bytes)) reject();
    return { input: parseStrictJson(bytes.toString('utf8'), { maxBytes: 32768 }), admissionSha256: evidence.sha256, inputSha256: sha256Hex(bytes) };
  } catch { reject('DOT_SOURCE_CONTROL_UNTRUSTED'); }
}
export function verifyNativeOriginal(bytes, descriptor, access, binding) {
  nativeDescriptor(descriptor);
  exactNativeKeys(access, ['kind', 'text_representation', 'page_id', 'reference', 'sha256', 'bytes']);
  if (descriptor.page_id !== binding.page_id || access.kind !== 'text' || access.text_representation !== 'source'
    || ['page_id', 'reference', 'sha256', 'bytes'].some(k => access[k] !== descriptor[k])
    || bytes.length !== descriptor.bytes || sha256Hex(bytes) !== descriptor.sha256) reject();
  // Replacement characters from an extracted or malformed byte stream must
  // never become a new original. Decode only after verifying whole bytes.
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
export function validateNativeReview(text, { binding, request, currentHead }) {
  const s = parseStrictJson(text, { maxBytes: 16384 });
  exactNativeKeys(s, ['version', 'kind', 'producer', 'epoch', 'review_id', 'request_id', 'repository', 'pr', 'head_sha', 'decision', 'decided_at', 'finding_count', 'findings_artifact']);
  if (s.version !== 1 || s.kind !== 'dot_head_review' || s.producer !== binding.producer || s.epoch !== binding.epoch
    || !id.test(s.review_id ?? '') || s.request_id !== request.request_id || s.repository !== request.repository
    || s.pr !== request.pr || !Number.isSafeInteger(s.pr) || s.pr < 1 || !head.test(s.head_sha ?? '')
    || !Number.isSafeInteger(s.finding_count) || s.finding_count < 0
    || typeof s.decided_at !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(s.decided_at) || !Number.isFinite(Date.parse(s.decided_at))) reject('DOT_APPROVAL_UNPROVEN');
  if (s.head_sha !== request.head_sha || s.head_sha !== currentHead) reject('DOT_APPROVAL_STALE');
  if (s.decision === 'GO') {
    if (s.finding_count !== 0 || s.findings_artifact !== null) reject('DOT_APPROVAL_UNPROVEN');
  } else if (s.decision === 'NEEDS_FIX') {
    if (s.finding_count < 1) reject('DOT_APPROVAL_UNPROVEN');
    nativeDescriptor(s.findings_artifact);
    if (s.findings_artifact.page_id !== binding.page_id) reject('DOT_APPROVAL_UNPROVEN');
  } else reject('DOT_APPROVAL_UNPROVEN');
  return s;
}

// Exact format discriminator and allowlisted metadata shape. Retained source
// acquisitions/items remain opaque; no count, READY or producer flag becomes
// consumption, semantic ownership, approval or execution authority.
export function validateNativeRegistry(text, binding) {
  const s = parseStrictJson(text, { maxBytes: 1048576 });
  const required = ['format', 'control_id', 'generation', 'status', 'reserved_producer_label', 'producer_label_activated', 'page', 'policy', 'migration', 'source_acquisition', 'retained_solver_items', 'retained_analyst_items', 'retained_solution_status'];
  // Closed union observed in original native generations 0003 through 0026.
  // These historical fields are retained only, not normalized as authority.
  const optional = ['created_at', 'journal', 'schedule_receipt', 'counts', 'retained_solver_items_notice', 'baseline_policy', 'ack_semantics', 'next_action', 'previous', 'completed_atomic_step', 'fresh_selection', 'freeze_acquisition', 'wake_receipt',
    'handover_receipt', 'runtime_blockers', 'execution_blockers', 'active_review_checkpoint', 'previous_prepublication_snapshot', 'reconnect_control', 'required_policy_snapshot', 'merge_policy', 'approved_head_receipts', 'approval_artifacts',
    'completed_review_receipts', 'semantic_progress', 'prepared_solution_packets', 'packet_transport_policy', 'superseded_unpublished_snapshot', 'metadata_correction', 'observed_external_merges', 'packet_packaging_control', 'packet_packaging_validation',
    'plan_decisions', 'metadata_recovery', 'plan_missing_inputs', 'paused_semantic_checkpoint', 'infrastructure_recovery', 'latest_completed_plan', 'new_metadata_blockers', 'instruction_review_control', 'instruction_review_scope_notice', 'historical_projection_snapshots'];
  if (!s || required.some(k => !Object.hasOwn(s, k)) || Object.keys(s).some(k => ![...required, ...optional].includes(k))) reject('DOT_NATIVE_SCHEMA');
  if (s.format !== 'getff-dot-consolidation-index/1' || s.control_id !== 'DOT-CONSOLIDATION-20261008-01'
    || !id.test(s.generation ?? '') || typeof s.status !== 'string' || s.status.length > 160
    || s.reserved_producer_label !== binding.producer || typeof s.producer_label_activated !== 'boolean'
    || s.page?.id !== binding.page_id || s.page?.url !== 'https://chatgpt.com/space/' + binding.page_id
    || !s.policy || typeof s.policy !== 'object' || Array.isArray(s.policy)
    || !s.migration || typeof s.migration !== 'object' || Array.isArray(s.migration)) reject('DOT_NATIVE_SCHEMA');
  exactNativeKeys(s.page, ['id', 'url']);
  for (const k of ['source_acquisition', 'retained_solver_items', 'retained_analyst_items', 'retained_solution_status']) {
    if (!Array.isArray(s[k]) || s[k].length > 5000 || s[k].some(v => !v || typeof v !== 'object' || Array.isArray(v))) reject('DOT_NATIVE_SCHEMA');
  }
  for (const r of s.retained_solution_status) {
    exactNativeKeys(r, ['id', 'ready', 'blocker_codes']);
    if (!id.test(r.id ?? '') || typeof r.ready !== 'boolean' || !Array.isArray(r.blocker_codes)
      || r.blocker_codes.some(c => typeof c !== 'string' || c.length > 160)) reject('DOT_NATIVE_SCHEMA');
  }
  return { kind: 'native_registry', generation: s.generation };
}
