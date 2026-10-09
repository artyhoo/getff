// Dot relay private packet contract — DESIGN.md §Contract + binding amendments.
//
// The PRIVATE envelope schema: imported from file, never printed. All error
// paths emit fixed reason codes only — no payload bytes ever travel in an
// Error message (opaque-transport amendment: scripts may parse/hash bytes,
// humans/models never see them through diagnostics).
//
// Reuse (DESIGN reuse evidence): parseStrictJson from
// scripts/dot-review-gate/strict-json.mjs (size/depth/duplicate-key rejection)
// and sha256Hex from scripts/dot-review-gate/digest.mjs. Neither is copied.

import { parseStrictJson } from '../dot-review-gate/strict-json.mjs';
import { sha256Hex } from '../dot-review-gate/digest.mjs';

// Fixed chat identities (DESIGN §Fixed identities and locations). Not secrets:
// durable chat IDs used as producer authority, never credential material.
export const CHAT_IDS = {
  collector: '01a11aad-5df6-7663-ab3d-2e2055634093',
  analyst: '01a11aac-a354-776a-b766-eb4f3047f082',
  solver: '01a11adb-b74f-76f9-8f27-b231e7f31081',
  coordinator: '01a11ae1-13c1-7522-9104-fddb8cb38d9a',
};

export const ROLE_FOR_KIND = {
  batch: 'collector',
  analysis: 'analyst',
  solution: 'solver',
};

const ID_RE = /^[A-Za-z0-9_.:-]{1,160}$/;
const HASH64_RE = /^[0-9a-f]{64}$/;
const SHA40_RE = /^[0-9a-f]{40}$/;
const ENVELOPE_KEYS = ['version', 'kind', 'id', 'producer', 'parents', 'payload', 'sha256'];

export const MAX_ENVELOPE_BYTES = 1048576; // 1 MiB whole private envelope (multipart amendment)
export const MAX_PART_BYTES = 200000;
export const MAX_PARTS = 8;

function invalid(reason, detail) {
  const e = new Error(`[INVALID] ${reason}${detail ? `: ${detail}` : ''}`);
  e.code = 'INVALID';
  e.reason = reason;
  return e;
}

// --- canonical form ---

export function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
}

export function digest(value) {
  return sha256Hex(canonical(value));
}

export function envelopeDigest(env) {
  const { sha256: _omit, ...rest } = env ?? {};
  return digest(rest);
}

// --- report key ---

export function reportKey(report) {
  return digest([report.repository, report.comment_id, report.body_sha256, report.reviewed_sha]);
}

// --- strict payload shape helpers ---

function exactKeys(obj, keys, reason) {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw invalid(reason, 'not-an-object');
  const actual = Object.keys(obj).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((k, i) => k !== expected[i])) {
    // Key NAMES are schema, not payload — safe to name in errors.
    throw invalid(reason, `expected keys [${expected.join(',')}] got [${actual.join(',')}]`);
  }
}

function isPlainString(v) {
  return typeof v === 'string' && v.length > 0;
}

const LINK_ONLY_RE = /^https?:\/\/\S*$/;

// --- kind payload validators ---

function validateBatchPayload(payload) {
  exactKeys(payload, ['batch_id', 'reports', 'complete'], 'PAYLOAD_KEYS');
  if (!isPlainString(payload.batch_id) || !ID_RE.test(payload.batch_id)) throw invalid('BATCH_ID');
  if (payload.complete !== true) throw invalid('NOT_COMPLETE');
  if (!Array.isArray(payload.reports)) throw invalid('REPORTS_COUNT');
  if (payload.reports.length !== 10) throw invalid('REPORTS_COUNT', `count=${payload.reports.length}`);
  const seen = new Set();
  for (const r of payload.reports) {
    exactKeys(r, ['repository', 'pr', 'comment_id', 'body_sha256', 'reviewed_sha', 'url', 'body'], 'REPORT_SHAPE');
    if (r.repository !== 'artyhoo/getff') throw invalid('REPOSITORY');
    if (!Number.isInteger(r.pr) || r.pr <= 0) throw invalid('REPORT_SHAPE', 'pr');
    // NUMERIC-COMMENT-ID-ADDENDUM: GitHub comment IDs arrive as positive JSON
    // safe integers; legacy string IDs stay valid as-is. No coercion — numeric
    // 42 and string "42" hash to DISTINCT reportKey values via canonical().
    const validCommentId =
      (isPlainString(r.comment_id) && r.comment_id.length > 0 && ID_RE.test(r.comment_id)) ||
      (typeof r.comment_id === 'number' && Number.isSafeInteger(r.comment_id) && r.comment_id > 0);
    if (!validCommentId) throw invalid('REPORT_SHAPE', 'comment_id');
    if (!HASH64_RE.test(r.body_sha256)) throw invalid('REPORT_SHAPE', 'body_sha256');
    if (!SHA40_RE.test(r.reviewed_sha)) throw invalid('REPORT_SHAPE', 'reviewed_sha');
    if (!isPlainString(r.url) || !/^https:\/\//.test(r.url)) throw invalid('REPORT_SHAPE', 'url');
    if (!isPlainString(r.body)) throw invalid('REPORT_SHAPE', 'body');
    if (sha256Hex(r.body) !== r.body_sha256) throw invalid('BODY_HASH');
    if (LINK_ONLY_RE.test(r.body.trim())) throw invalid('LINK_ONLY');
    const key = reportKey(r);
    if (seen.has(key)) throw invalid('REPORT_DUP');
    seen.add(key);
  }
}

function validateAnalysisPayload(payload) {
  exactKeys(payload, ['consumed_report_keys', 'candidates', 'excluded'], 'PAYLOAD_KEYS');
  if (!Array.isArray(payload.consumed_report_keys) || !Array.isArray(payload.candidates) || !Array.isArray(payload.excluded)) {
    throw invalid('ANALYSIS_SHAPE');
  }
  const counts = new Map();
  const bump = (key, where) => {
    if (!HASH64_RE.test(key)) throw invalid('ANALYSIS_SHAPE', where);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };
  for (const k of payload.consumed_report_keys) bump(k, 'consumed');
  for (const e of payload.excluded) {
    exactKeys(e, ['report_key', 'reason'], 'ANALYSIS_SHAPE');
    if (!isPlainString(e.reason)) throw invalid('ANALYSIS_SHAPE', 'reason');
    bump(e.report_key, 'excluded');
  }
  for (const [key, n] of counts) if (n > 1) throw invalid('ANALYSIS_DUP');
  const consumed = new Set(payload.consumed_report_keys);
  for (const c of payload.candidates) {
    exactKeys(c, ['candidate_id', 'finding_keys', 'report_keys', 'reviewed_sha', 'summary'], 'CANDIDATE_SHAPE');
    if (!isPlainString(c.candidate_id) || !ID_RE.test(c.candidate_id)) throw invalid('CANDIDATE_SHAPE', 'candidate_id');
    if (!Array.isArray(c.finding_keys) || c.finding_keys.some((f) => !isPlainString(f))) throw invalid('CANDIDATE_SHAPE', 'finding_keys');
    if (!Array.isArray(c.report_keys) || c.report_keys.length === 0) throw invalid('CANDIDATE_SHAPE', 'report_keys');
    if (!SHA40_RE.test(c.reviewed_sha)) throw invalid('CANDIDATE_SHAPE', 'reviewed_sha');
    if (!isPlainString(c.summary)) throw invalid('CANDIDATE_SHAPE', 'summary');
    for (const k of c.report_keys) {
      if (!HASH64_RE.test(k)) throw invalid('CANDIDATE_SHAPE', 'report_key');
      if (!consumed.has(k)) throw invalid('CANDIDATE_REF');
    }
  }
}

function validateAckPayload(payload) {
  exactKeys(payload, ['delivery_id', 'event_id', 'event_sha256', 'artifact_sha256', 'accepted', 'duplicate'], 'ACK_SHAPE');
  if (!ID_RE.test(payload.delivery_id) || !ID_RE.test(payload.event_id)) throw invalid('ACK_SHAPE', 'ids');
  if (!HASH64_RE.test(payload.event_sha256) || !HASH64_RE.test(payload.artifact_sha256)) throw invalid('ACK_SHAPE', 'digests');
  if (payload.accepted !== true) throw invalid('ACK_SHAPE', 'accepted');
  if (typeof payload.duplicate !== 'boolean') throw invalid('ACK_SHAPE', 'duplicate');
}

// --- solution validation: returns blockers[] (empty = valid) ---

const SCOPE_BAD_RE = /(^|\/)(\.env|id_rsa|credentials?|secrets?)(\/|$)/i;

function badScopePath(p) {
  if (typeof p !== 'string' || p.length === 0) return true;
  if (p.startsWith('/') || p.includes('\\') || p.includes('~')) return true;
  const segs = p.split('/');
  if (segs.includes('..') || segs.includes('')) return true;
  if (SCOPE_BAD_RE.test(p)) return true;
  return false;
}

function commandBlockers(list, field, blockers) {
  if (!Array.isArray(list) || list.length === 0) {
    blockers.push(field === 'commands' ? 'NO_COMMANDS' : 'NO_VERIFY_COMMANDS');
    return;
  }
  for (const c of list) {
    if (typeof c !== 'object' || c === null) blockers.push(`BAD_${field.toUpperCase()}_SHAPE`);
    else {
      if (!Array.isArray(c.argv) || c.argv.length === 0 || c.argv.some((a) => typeof a !== 'string')) blockers.push(`BAD_${field.toUpperCase()}_SHAPE`);
      if (c.cwd !== 'worktree') blockers.push(`BAD_${field.toUpperCase()}_CWD`);
      if (c.expected_exit !== 0) blockers.push(`BAD_${field.toUpperCase()}_EXIT`);
    }
  }
}

export function validateSolution(solution) {
  const blockers = [];
  const need = (cond, code) => {
    if (!cond) blockers.push(code);
  };
  need(typeof solution === 'object' && solution !== null, 'NOT_AN_OBJECT');
  if (typeof solution !== 'object' || solution === null) return blockers;

  need(solution.ready === true, 'NOT_READY');
  need(Array.isArray(solution.unresolved) && solution.unresolved.length === 0, 'UNRESOLVED_NOT_EMPTY');
  need(isPlainString(solution.candidate_id) && ID_RE.test(solution.candidate_id), 'BAD_CANDIDATE_ID');
  need(Array.isArray(solution.finding_keys) && solution.finding_keys.every(isPlainString), 'BAD_FINDING_KEYS');
  need(typeof solution.reviewed_sha === 'string' && SHA40_RE.test(solution.reviewed_sha), 'BAD_REVIEWED_SHA');
  need(typeof solution.base_sha === 'string' && SHA40_RE.test(solution.base_sha), 'BAD_BASE_SHA');

  need(Array.isArray(solution.prerequisites) && solution.prerequisites.length > 0, 'NO_PREREQUISITE');
  if (Array.isArray(solution.prerequisites)) {
    need(solution.prerequisites.every((p) => p && typeof p === 'object' && isPlainString(p.name) && isPlainString(p.evidence) && p.passed === true), 'PREREQUISITE_FAILED');
  }

  need(Array.isArray(solution.scope_paths) && solution.scope_paths.length > 0, 'NO_SCOPE_PATHS');
  if (Array.isArray(solution.scope_paths) && solution.scope_paths.some(badScopePath)) blockers.push('BAD_SCOPE_PATH');

  need(isPlainString(solution.kickoff), 'NO_KICKOFF');
  commandBlockers(solution.commands, 'commands', blockers);
  commandBlockers(solution.verify_commands, 'verify_commands', blockers);
  need(Array.isArray(solution.acceptance) && solution.acceptance.length > 0 && solution.acceptance.every(isPlainString), 'NO_ACCEPTANCE');

  need(typeof solution.kickoff === 'string' && sha256Hex(solution.kickoff) === solution.kickoff_sha256, 'KICKOFF_HASH_MISMATCH');
  need(Array.isArray(solution.commands) && digest(solution.commands) === solution.commands_sha256, 'COMMANDS_HASH_MISMATCH');

  return blockers;
}

// --- envelope validation ---

export function validateEnvelope(raw, trustedRole, { chatIds = CHAT_IDS } = {}) {
  let obj;
  try {
    obj = parseStrictJson(raw, { maxBytes: MAX_ENVELOPE_BYTES });
  } catch (err) {
    throw invalid(err.code ?? 'PARSE', err.code ?? 'parse');
  }
  exactKeys(obj, ENVELOPE_KEYS, 'ENVELOPE_KEYS');
  if (obj.version !== 1) throw invalid('VERSION');
  if (!(obj.kind in ROLE_FOR_KIND) && obj.kind !== 'ack') throw invalid('KIND');

  if (!ID_RE.test(obj.id)) throw invalid('ID');
  if (!Array.isArray(obj.parents)) throw invalid('PARENTS');
  for (const p of obj.parents) {
    if (typeof p !== 'object' || p === null || Array.isArray(p)) throw invalid('PARENTS');
    exactKeys(p, ['id', 'sha256'], 'PARENTS');
    if (!ID_RE.test(p.id) || !HASH64_RE.test(p.sha256)) throw invalid('PARENTS');
  }
  // F01: ancestry count is part of the envelope contract — analysis names
  // exactly one batch, solution names exactly one analysis. The zero-parent
  // batch and ACK shapes stay explicitly valid. A zero- or multi-parent
  // analysis/solution is rejected here, before the ledger's routing gates
  // can run at all.
  if ((obj.kind === 'analysis' || obj.kind === 'solution') && obj.parents.length !== 1) {
    throw invalid('PARENT_COUNT', `expected=1,actual=${obj.parents.length}`);
  }

  // Identity: trustedRole is the adapter-supplied role, never payload data.
  const expectedRole = obj.kind === 'ack' ? trustedRole : ROLE_FOR_KIND[obj.kind];
  if (typeof trustedRole !== 'string' || trustedRole !== expectedRole) throw invalid('PRODUCER_ROLE', 'role-kind');
  if (!(trustedRole in chatIds)) throw invalid('PRODUCER_ROLE', 'unknown-role');
  if (obj.producer !== chatIds[trustedRole]) throw invalid('PRODUCER_ROLE');

  if (!HASH64_RE.test(obj.sha256)) throw invalid('HASH_MISMATCH');
  if (envelopeDigest(obj) !== obj.sha256) throw invalid('HASH_MISMATCH');

  if (obj.kind === 'batch') validateBatchPayload(obj.payload);
  else if (obj.kind === 'analysis') validateAnalysisPayload(obj.payload);
  else if (obj.kind === 'solution') {
    const blockers = validateSolution(obj.payload);
    if (blockers.length > 0) throw invalid('SOLUTION_BLOCKED', blockers.join(','));
  } else if (obj.kind === 'ack') validateAckPayload(obj.payload);

  return obj;
}

// --- multipart: codepoint-safe split + ordered part-sequence validation ---

// Splits exact UTF-8 text into <=maxPartBytes parts without cutting a
// codepoint (a surrogate pair or multibyte char never straddles a boundary;
// no inserted newline or normalization — concatenation reproduces the bytes).
export function splitCodepointParts(text, maxPartBytes = MAX_PART_BYTES) {
  if (typeof text !== 'string') throw invalid('PART_SPLIT', 'not-a-string');
  const points = Array.from(text);
  const parts = [];
  let buf = '';
  let bufBytes = 0;
  const flush = () => {
    if (bufBytes === 0) return;
    parts.push({ ordinal: parts.length, text: buf, sha256: sha256Hex(buf), bytes: bufBytes });
    buf = '';
    bufBytes = 0;
  };
  for (const ch of points) {
    const b = Buffer.byteLength(ch, 'utf8');
    if (b > maxPartBytes) throw invalid('PART_SPLIT', 'char-too-large');
    if (bufBytes + b > maxPartBytes) flush();
    buf += ch;
    bufBytes += b;
  }
  flush();
  if (parts.length === 0) parts.push({ ordinal: 0, text: '', sha256: sha256Hex(''), bytes: 0 });
  if (parts.length > MAX_PARTS) throw invalid('PART_COUNT', `parts=${parts.length}`);
  return parts;
}

// Validates ordered parts against a public artifact descriptor
// {sha256, bytes, parts:[{ordinal,sha256,bytes}]} and returns the reassembled
// whole. The envelope is parsed by the CALLER only after the whole hash passes.
export function validatePartSequence(parts, descriptor) {
  if (typeof descriptor !== 'object' || descriptor === null) throw invalid('PART_DESCRIPTOR');
  if (!Array.isArray(descriptor.parts) || descriptor.parts.length < 1 || descriptor.parts.length > MAX_PARTS) throw invalid('PART_COUNT', `descriptor-parts=${descriptor.parts?.length}`);
  if (!Array.isArray(parts) || parts.length !== descriptor.parts.length) throw invalid('PART_COUNT', `parts=${parts?.length}`);
  const wholeLimit = MAX_ENVELOPE_BYTES;
  if (!Number.isInteger(descriptor.bytes) || descriptor.bytes < 1 || descriptor.bytes > wholeLimit) throw invalid('PART_DESCRIPTOR', 'bytes');
  if (!HASH64_RE.test(descriptor.sha256)) throw invalid('PART_DESCRIPTOR', 'sha256');

  let text = '';
  let bytes = 0;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const d = descriptor.parts[i];
    if (p.ordinal !== i || d.ordinal !== i) throw invalid('PART_ORDER');
    if (typeof p.text !== 'string') throw invalid('PART_SHAPE');
    const pBytes = Buffer.byteLength(p.text, 'utf8');
    if (pBytes !== d.bytes || pBytes < 1 || pBytes > MAX_PART_BYTES) throw invalid('PART_BYTES');
    if (sha256Hex(p.text) !== d.sha256 || p.sha256 !== d.sha256) throw invalid('PART_HASH');
    text += p.text;
    bytes += pBytes;
  }
  if (bytes !== descriptor.bytes) throw invalid('PART_BYTES', 'sum');
  if (sha256Hex(text) !== descriptor.sha256) throw invalid('PART_WHOLE_HASH');
  return { text, sha256: descriptor.sha256, bytes };
}
