// Dot relay contract tests — spec: DESIGN.md §Contract + binding multipart amendment.
// Table tests per IMPLEMENTATION-EXACT Task 1. Fixtures are built programmatically
// (digests correct by construction); committed fixtures/*.json are additionally
// loaded and must validate as fully valid examples.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  canonical,
  digest,
  envelopeDigest,
  CHAT_IDS,
  validateEnvelope,
  validateSolution,
  reportKey,
  splitCodepointParts,
  validatePartSequence,
} from './contract.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, 'fixtures');

const sha40 = (seed) => sha256Of(seed).slice(0, 40);
import { createHash } from 'node:crypto';
function sha256Of(s) {
  return createHash('sha256').update(s).digest('hex');
}

// --- fixture builders (programmatic; digests correct by construction) ---

function makeReports(count, { bodyPad = 24, commentBase = 'c' } = {}) {
  const reports = [];
  for (let i = 0; i < count; i++) {
    const body = `synthetic report body ${i} ${'x'.repeat(bodyPad)}`;
    reports.push({
      repository: 'artyhoo/getff',
      pr: 2000 + i,
      comment_id: `${commentBase}-${i}`,
      body_sha256: sha256Of(body),
      reviewed_sha: sha40(`reviewed-${commentBase}-${i}`),
      url: `https://example.invalid/pr/2000+${i}#issuecomment-${i}`,
      body,
    });
  }
  return reports;
}

function buildEnvelope(kind, id, producer, parents, payload) {
  const env = { version: 1, kind, id, producer, parents, payload, sha256: '' };
  env.sha256 = envelopeDigest(env);
  return env;
}

function makeBatchEnvelope({
  id = 'DOT-EVT-BATCH-SYNTH-001',
  producer = CHAT_IDS.collector,
  parents = [],
  reports = makeReports(10),
  extraPayloadKey = null,
} = {}) {
  const payload = { batch_id: 'DOT-BATCH-SYNTH-001', reports, complete: true };
  if (extraPayloadKey) payload[extraPayloadKey] = 1;
  return buildEnvelope('batch', id, producer, parents, payload);
}

function makeAnalysisEnvelope({
  id = 'DOT-EVT-ANALYSIS-SYNTH-001',
  producer = CHAT_IDS.analyst,
  batchEnv = makeBatchEnvelope(),
  consumed,
  candidates = [],
  excluded = [],
} = {}) {
  const keys = consumed ?? batchEnv.payload.reports.map((r) => reportKey(r));
  const payload = {
    consumed_report_keys: keys,
    candidates,
    excluded,
  };
  return buildEnvelope('analysis', id, producer, [{ id: batchEnv.id, sha256: batchEnv.sha256 }], payload);
}

function makeSolutionEnvelope({
  id = 'DOT-EVT-SOLUTION-SYNTH-001',
  producer = CHAT_IDS.solver,
  analysisEnv,
} = {}) {
  const parent = analysisEnv ?? makeAnalysisEnvelope();
  const kickoff = '# Synthetic kickoff\nExecute the fixed plan.\n';
  const commands = [
    { argv: ['node', '--test', 'scripts/dot-relay/contract.test.mjs'], cwd: 'worktree', expected_exit: 0 },
  ];
  const payload = {
    candidate_id: 'DOT-CAND-SYNTH-001',
    finding_keys: ['DOT-FIND-SYNTH-001'],
    reviewed_sha: sha40('candidate-reviewed'),
    base_sha: sha40('origin-staging-base'),
    ready: true,
    unresolved: [],
    prerequisites: [{ name: 'base-fetched', passed: true, evidence: 'git fetch origin staging' }],
    scope_paths: ['scripts/dot-relay/contract.mjs'],
    kickoff,
    commands,
    verify_commands: [{ argv: ['node', '--test', 'scripts/dot-relay/contract.test.mjs'], cwd: 'worktree', expected_exit: 0 }],
    acceptance: ['contract tests green'],
    kickoff_sha256: sha256Of(kickoff),
    commands_sha256: digest(commands),
  };
  return buildEnvelope('solution', id, producer, [{ id: parent.id, sha256: parent.sha256 }], payload);
}

function makeAckEnvelope({ producer = CHAT_IDS.analyst, deliveryId = 'DOT-DELIV-SYNTH-001', eventEnv } = {}) {
  const env = eventEnv ?? makeBatchEnvelope();
  const payload = {
    delivery_id: deliveryId,
    event_id: env.id,
    event_sha256: env.sha256,
    artifact_sha256: sha256Of(JSON.stringify(env)),
    accepted: true,
    duplicate: false,
  };
  return buildEnvelope('ack', 'DOT-EVT-ACK-SYNTH-001', producer, [], payload);
}

// --- tests ---

test('canonical sorts object keys recursively, preserves array order', () => {
  assert.equal(canonical({ b: 1, a: { d: 2, c: 3 } }), canonical({ a: { c: 3, d: 2 }, b: 1 }));
  assert.equal(canonical({ b: 1, a: 2 }), '{"a":2,"b":1}');
  assert.notEqual(canonical([2, 1]), canonical([1, 2]));
});

test('envelope digest excludes the sha256 field itself', () => {
  const env = makeBatchEnvelope();
  const stripped = { ...env, sha256: undefined };
  delete stripped.sha256;
  assert.equal(env.sha256, digest(stripped));
});

test('batch with exactly 10 distinct report versions validates', () => {
  const env = makeBatchEnvelope();
  const out = validateEnvelope(JSON.stringify(env), 'collector');
  assert.equal(out.kind, 'batch');
  assert.equal(out.payload.reports.length, 10);
  assert.equal(new Set(out.payload.reports.map(reportKey)).size, 10);
});

test('batch with 9 reports rejects INVALID', () => {
  const env = makeBatchEnvelope({ reports: makeReports(9) });
  assert.throws(() => validateEnvelope(JSON.stringify(env), 'collector'), invalid('REPORTS_COUNT'));
});

test('batch with 11 reports rejects INVALID', () => {
  const env = makeBatchEnvelope({ reports: makeReports(11) });
  assert.throws(() => validateEnvelope(JSON.stringify(env), 'collector'), invalid('REPORTS_COUNT'));
});

test('duplicate report version (same report key) rejects INVALID', () => {
  const reports = makeReports(10);
  reports[9] = { ...reports[8] }; // identical report -> duplicate key
  const env = makeBatchEnvelope({ reports });
  assert.throws(() => validateEnvelope(JSON.stringify(env), 'collector'), invalid('REPORT_DUP'));
});

test('corrected comment version is a new report key and stays valid', () => {
  const reports = makeReports(10);
  const corrected = { ...reports[0], body: reports[0].body + ' corrected', body_sha256: sha256Of(reports[0].body + ' corrected') };
  assert.notEqual(reportKey(corrected), reportKey(reports[0]));
  reports.push(corrected);
  reports.shift(); // keep 10 entries, containing original comment-0's correction? no: keep corrected + 9 others
  const env = makeBatchEnvelope({ reports });
  validateEnvelope(JSON.stringify(env), 'collector'); // must not throw
});

test('invalid identity (wrong producer for role) rejects INVALID', () => {
  const env = makeBatchEnvelope({ producer: CHAT_IDS.analyst });
  assert.throws(() => validateEnvelope(JSON.stringify(env), 'collector'), invalid('PRODUCER_ROLE'));
});

test('trustedRole taken from adapter, mismatching kind role rejects', () => {
  const env = makeBatchEnvelope();
  assert.throws(() => validateEnvelope(JSON.stringify(env), 'analyst'), invalid('PRODUCER_ROLE'));
});

test('malformed parents entry rejects INVALID', () => {
  const env = makeBatchEnvelope({ parents: [{ id: 'X' }] });
  assert.throws(() => validateEnvelope(JSON.stringify(env), 'collector'), invalid('PARENTS'));
});

test('wrong envelope hash rejects INVALID', () => {
  const env = makeBatchEnvelope();
  env.sha256 = '0'.repeat(64);
  assert.throws(() => validateEnvelope(JSON.stringify(env), 'collector'), invalid('HASH_MISMATCH'));
});

test('extra envelope key rejects INVALID', () => {
  const raw = JSON.stringify({ ...makeBatchEnvelope(), extra: 1 });
  assert.throws(() => validateEnvelope(raw, 'collector'), invalid('ENVELOPE_KEYS'));
});

test('version != 1 rejects INVALID', () => {
  const env = makeBatchEnvelope();
  env.version = 2;
  env.sha256 = envelopeDigest(env);
  assert.throws(() => validateEnvelope(JSON.stringify(env), 'collector'), invalid('VERSION'));
});

test('raw duplicate keys reject INVALID without payload leakage', () => {
  const env = makeBatchEnvelope();
  const raw = JSON.stringify(env).replace('{"version":1', '{"version":1,"version":1');
  assert.throws(() => validateEnvelope(raw, 'collector'), invalid('DUP_KEY'));
});

test('depth > 64 rejects INVALID', () => {
  let deep = '1';
  for (let i = 0; i < 70; i++) deep = `{"a":${deep}}`;
  assert.throws(() => validateEnvelope(deep, 'collector'), invalid('DEPTH'));
});

test('raw payload > 1 MiB rejects INVALID', () => {
  const env = makeBatchEnvelope({ reports: makeReports(10, { bodyPad: 110000 }) });
  const raw = JSON.stringify(env);
  assert.ok(Buffer.byteLength(raw) > 1024 * 1024);
  assert.throws(() => validateEnvelope(raw, 'collector'), invalid('SIZE'));
});

test('body hash mismatch (body_sha256 not hash of body) rejects INVALID', () => {
  const reports = makeReports(10);
  reports[3].body_sha256 = sha256Of('forged');
  const env = makeBatchEnvelope({ reports });
  assert.throws(() => validateEnvelope(JSON.stringify(env), 'collector'), invalid('BODY_HASH'));
});

test('non-getff repository rejects INVALID', () => {
  const reports = makeReports(10);
  reports[2].repository = 'evil/org';
  const env = makeBatchEnvelope({ reports });
  assert.throws(() => validateEnvelope(JSON.stringify(env), 'collector'), invalid('REPOSITORY'));
});

test('link-only body rejects INVALID (bytes must travel, not a link)', () => {
  const reports = makeReports(10);
  reports[5].body = 'https://example.invalid/report-body';
  reports[5].body_sha256 = sha256Of(reports[5].body);
  const env = makeBatchEnvelope({ reports });
  assert.throws(() => validateEnvelope(JSON.stringify(env), 'collector'), invalid('LINK_ONLY'));
});

test('analysis validates with full consumed mapping and zero candidates', () => {
  const env = makeAnalysisEnvelope({ candidates: [], excluded: [] });
  const out = validateEnvelope(JSON.stringify(env), 'analyst');
  assert.equal(out.payload.candidates.length, 0);
});

test('analysis rejects a key both consumed and excluded', () => {
  const batch = makeBatchEnvelope();
  const keys = batch.payload.reports.map((r) => reportKey(r));
  const env = makeAnalysisEnvelope({
    consumed: keys,
    excluded: [{ report_key: keys[0], reason: 'superseded' }],
  });
  assert.throws(() => validateEnvelope(JSON.stringify(env), 'analyst'), invalid('ANALYSIS_DUP'));
});

test('analysis rejects candidate referencing non-consumed key', () => {
  const batch = makeBatchEnvelope();
  const keys = batch.payload.reports.map((r) => reportKey(r));
  const env = makeAnalysisEnvelope({
    consumed: keys.slice(0, 9),
    excluded: [{ report_key: keys[9], reason: 'irrelevant' }],
    candidates: [{ candidate_id: 'C1', finding_keys: ['F1'], report_keys: [keys[9]], reviewed_sha: sha40('rv'), summary: 's' }],
  });
  assert.throws(() => validateEnvelope(JSON.stringify(env), 'analyst'), invalid('CANDIDATE_REF'));
});

test('ack requires both event_sha256 and artifact_sha256', () => {
  const good = makeAckEnvelope();
  validateEnvelope(JSON.stringify(good), 'analyst');
  const payload = { ...good.payload };
  delete payload.artifact_sha256;
  const env = buildEnvelope('ack', good.id, good.producer, [], payload);
  assert.throws(() => validateEnvelope(JSON.stringify(env), 'analyst'), invalid('ACK_SHAPE'));
});

test('valid solution passes validateSolution with zero blockers', () => {
  const env = makeSolutionEnvelope();
  assert.deepEqual(validateSolution(env.payload), []);
});

test('solution missing prerequisite / scope / command / hash yields blockers', () => {
  const base = makeSolutionEnvelope().payload;
  const noPrereq = { ...base, prerequisites: [] };
  assert.ok(validateSolution(noPrereq).includes('NO_PREREQUISITE'));
  const failedPrereq = { ...base, prerequisites: [{ name: 'n', passed: false, evidence: 'e' }] };
  assert.ok(validateSolution(failedPrereq).includes('PREREQUISITE_FAILED'));
  const noScope = { ...base, scope_paths: [] };
  assert.ok(validateSolution(noScope).includes('NO_SCOPE_PATHS'));
  const noCommands = { ...base, commands: [], commands_sha256: digest([]) };
  assert.ok(validateSolution(noCommands).includes('NO_COMMANDS'));
  const noVerify = { ...base, verify_commands: [] };
  assert.ok(validateSolution(noVerify).includes('NO_VERIFY_COMMANDS'));
  const noAccept = { ...base, acceptance: [] };
  assert.ok(validateSolution(noAccept).includes('NO_ACCEPTANCE'));
  const badKickHash = { ...base, kickoff_sha256: '0'.repeat(64) };
  assert.ok(validateSolution(badKickHash).includes('KICKOFF_HASH_MISMATCH'));
  const badCmdHash = { ...base, commands_sha256: '0'.repeat(64) };
  assert.ok(validateSolution(badCmdHash).includes('COMMANDS_HASH_MISMATCH'));
  const unresolved = { ...base, unresolved: ['choice A or B'] };
  assert.ok(validateSolution(unresolved).includes('UNRESOLVED_NOT_EMPTY'));
  const notReady = { ...base, ready: false };
  assert.ok(validateSolution(notReady).includes('NOT_READY'));
});

test('solution rejects traversal / absolute / credential scope paths', () => {
  const base = makeSolutionEnvelope().payload;
  for (const bad of ['../outside', '/etc/passwd', 'scripts/x/../../y', '.env', 'secrets/token']) {
    const blockers = validateSolution({ ...base, scope_paths: [bad] });
    assert.ok(blockers.includes('BAD_SCOPE_PATH'), `path ${bad} must be rejected`);
  }
});

test('opaque payload marker never appears in validation errors', () => {
  const marker = 'OPAQUE_PAYLOAD_MARKER_xyzzy';
  const reports = makeReports(10);
  reports[0].body = `body with ${marker} inside`;
  reports[0].body_sha256 = sha256Of(reports[0].body);
  const env = makeBatchEnvelope({ reports });
  env.sha256 = '0'.repeat(64); // force a validation failure
  try {
    validateEnvelope(JSON.stringify(env), 'collector');
    assert.fail('expected INVALID');
  } catch (err) {
    assert.equal(err.code, 'INVALID');
    assert.ok(!err.message.includes(marker), 'error message must not carry payload bytes');
    assert.ok(!String(err.reason || '').includes(marker));
  }
  const solution = makeSolutionEnvelope().payload;
  const badKick = { ...solution, kickoff: `${marker}\n`, kickoff_sha256: '0'.repeat(64) };
  for (const b of validateSolution(badKick)) assert.ok(!b.includes(marker));
});

test('committed fixtures are fully valid examples (batch has 10 report entries)', () => {
  const batch = validateEnvelope(readFileSync(join(FIXTURES, 'batch.json'), 'utf8'), 'collector');
  assert.equal(batch.payload.reports.length, 10);
  const analysis = validateEnvelope(readFileSync(join(FIXTURES, 'analysis.json'), 'utf8'), 'analyst');
  assert.ok(analysis.payload.parents_names === undefined); // shape guard
  assert.equal(analysis.parents[0].id, batch.id);
  assert.equal(analysis.parents[0].sha256, batch.sha256);
  const solution = validateEnvelope(readFileSync(join(FIXTURES, 'solution.json'), 'utf8'), 'solver');
  assert.equal(solution.parents[0].id, analysis.id);
  assert.deepEqual(validateSolution(solution.payload), []);
  const ack = validateEnvelope(readFileSync(join(FIXTURES, 'ack.json'), 'utf8'), 'analyst');
  assert.equal(ack.payload.event_id, batch.id);
  assert.equal(ack.payload.event_sha256, batch.sha256);
});

// --- binding multipart amendment tests (351KiB envelope, 200000+remainder) ---

function bigBatchEnvelope() {
  // ~36KB body per report x10 -> whole envelope >= 351KiB (359424 bytes)
  const reports = makeReports(10, { bodyPad: 36000 });
  // sprinkle multibyte codepoints to exercise codepoint-safe splitting
  reports[9].body = 'åβ中文🚀end ' + reports[9].body;
  reports[9].body_sha256 = sha256Of(reports[9].body);
  return makeBatchEnvelope({ id: 'DOT-EVT-BATCH-BIG-001', reports });
}

test('351KiB envelope splits codepoint-safe into 2 parts (200000 + remainder)', () => {
  const env = bigBatchEnvelope();
  const raw = JSON.stringify(env);
  const wholeBytes = Buffer.byteLength(raw, 'utf8');
  assert.ok(wholeBytes >= 359424 && wholeBytes <= 1048576, `whole ${wholeBytes}`);
  const parts = splitCodepointParts(raw, 200000);
  assert.equal(parts.length, 2);
  assert.equal(parts[0].bytes, 200000);
  assert.equal(parts[1].bytes, wholeBytes - 200000);
  for (const p of parts) {
    assert.ok(p.bytes >= 1 && p.bytes <= 200000);
    assert.equal(p.sha256, sha256Of(p.text));
  }
  const descriptor = {
    sha256: sha256Of(raw),
    bytes: wholeBytes,
    parts: parts.map(({ ordinal, sha256, bytes }) => ({ ordinal, sha256, bytes })),
  };
  const out = validatePartSequence(parts, descriptor);
  assert.equal(out.sha256, descriptor.sha256);
  assert.equal(out.bytes, wholeBytes);
  // reassembly preserves exact bytes incl. multibyte
  assert.equal(Buffer.byteLength(out.text, 'utf8'), wholeBytes);
  const reparsed = validateEnvelope(out.text, 'collector');
  assert.equal(reparsed.payload.reports.length, 10);
});

test('altered part rejects INVALID', () => {
  const env = bigBatchEnvelope();
  const raw = JSON.stringify(env);
  const parts = splitCodepointParts(raw, 200000);
  const descriptor = {
    sha256: sha256Of(raw),
    bytes: Buffer.byteLength(raw),
    parts: parts.map(({ ordinal, sha256, bytes }) => ({ ordinal, sha256, bytes })),
  };
  const tampered = parts.map((p, i) => (i === 1 ? { ...p, text: p.text.slice(0, -1) + 'Z' } : p));
  assert.throws(() => validatePartSequence(tampered, descriptor), invalid('PART_HASH'));
});

test('reordered parts reject INVALID', () => {
  const env = bigBatchEnvelope();
  const raw = JSON.stringify(env);
  const parts = splitCodepointParts(raw, 200000);
  const descriptor = {
    sha256: sha256Of(raw),
    bytes: Buffer.byteLength(raw),
    parts: parts.map(({ ordinal, sha256, bytes }) => ({ ordinal, sha256, bytes })),
  };
  assert.throws(() => validatePartSequence([parts[1], parts[0]], descriptor), invalid('PART_ORDER'));
});

test('missing part rejects INVALID', () => {
  const env = bigBatchEnvelope();
  const raw = JSON.stringify(env);
  const parts = splitCodepointParts(raw, 200000);
  const descriptor = {
    sha256: sha256Of(raw),
    bytes: Buffer.byteLength(raw),
    parts: parts.map(({ ordinal, sha256, bytes }) => ({ ordinal, sha256, bytes })),
  };
  assert.throws(() => validatePartSequence([parts[0]], descriptor), invalid('PART_COUNT'));
});

test('part sequence replay is idempotent (restart midpart reuses same parts)', () => {
  const env = bigBatchEnvelope();
  const raw = JSON.stringify(env);
  const parts = splitCodepointParts(raw, 200000);
  const descriptor = {
    sha256: sha256Of(raw),
    bytes: Buffer.byteLength(raw),
    parts: parts.map(({ ordinal, sha256, bytes }) => ({ ordinal, sha256, bytes })),
  };
  const first = validatePartSequence(parts, descriptor);
  const second = validatePartSequence(parts, descriptor);
  assert.deepEqual(first, second);
});

test('multipart bound: >8 parts or >1MiB whole rejects INVALID', () => {
  const raw = 'x'.repeat(9); // 9 single-byte "parts" in descriptor
  const descriptor = {
    sha256: sha256Of(raw),
    bytes: 9,
    parts: Array.from({ length: 9 }, (_, i) => ({ ordinal: i, sha256: sha256Of('x'), bytes: 1 })),
  };
  const parts = Array.from({ length: 9 }, (_, i) => ({ ordinal: i, text: 'x', sha256: sha256Of('x'), bytes: 1 }));
  assert.throws(() => validatePartSequence(parts, descriptor), invalid('PART_COUNT'));
});

// --- binding numeric-comment-id addendum (NUMERIC-COMMENT-ID-ADDENDUM.md) ---
// Real GitHub comment IDs are positive JSON safe integers. The validator must
// accept them alongside the original ID_RE strings, never coerce types, and
// keep numeric 42 and string "42" as DISTINCT report keys. No digest/schema
// refactor: the fix is scoped to the comment_id field check only.

function numericReports(count) {
  const reports = [];
  for (let i = 0; i < count; i++) {
    const body = `numeric-id report body ${i} ${'n'.repeat(20)}`;
    reports.push({
      repository: 'artyhoo/getff',
      pr: 3000 + i,
      comment_id: 1234567890 + i * 7,
      body_sha256: sha256Of(body),
      reviewed_sha: sha40(`num-reviewed-${i}`),
      url: `https://example.invalid/pr/300${i}#issuecomment-${1234567890 + i * 7}`,
      body,
    });
  }
  return reports;
}

test('numeric comment ids: 10-report batch validates, JSON types unchanged after validation', () => {
  const env = makeBatchEnvelope({ id: 'DOT-EVT-BATCH-NUM-001', reports: numericReports(10) });
  const out = validateEnvelope(JSON.stringify(env), 'collector');
  assert.equal(out.payload.reports.length, 10);
  for (const r of out.payload.reports) {
    assert.equal(typeof r.comment_id, 'number');
    assert.ok(Number.isSafeInteger(r.comment_id) && r.comment_id > 0);
  }
  assert.equal(new Set(out.payload.reports.map(reportKey)).size, 10);
  // round-trip preservation: parsed canonical digest matches the sealed one
  assert.equal(envelopeDigest(out), env.sha256);
});

test('numeric 42 and string "42" are distinct report keys; both id forms coexist in one batch', () => {
  const a = { repository: 'artyhoo/getff', comment_id: 42, body_sha256: sha256Of('b'), reviewed_sha: sha40('r') };
  const b = { repository: 'artyhoo/getff', comment_id: '42', body_sha256: sha256Of('b'), reviewed_sha: sha40('r') };
  assert.notEqual(reportKey(a), reportKey(b));
  const reports = numericReports(9);
  reports.push({ ...reports[0], comment_id: '1234567890' }); // digit-only STRING id, distinct key from numeric twin
  const env = makeBatchEnvelope({ id: 'DOT-EVT-BATCH-NUM-MIX', reports });
  validateEnvelope(JSON.stringify(env), 'collector'); // must not throw
});

test('numeric comment id: repeated same version rejects REPORT_DUP; corrected body gets a new key', () => {
  const reports = numericReports(10);
  const corrected = { ...reports[0], body: reports[0].body + ' v2', body_sha256: sha256Of(reports[0].body + ' v2') };
  assert.notEqual(reportKey(corrected), reportKey(reports[0]));
  const dup = reports.map((r, i) => (i === 1 ? { ...reports[0] } : r));
  const env = makeBatchEnvelope({ id: 'DOT-EVT-BATCH-NUM-DUP', reports: dup });
  assert.throws(() => validateEnvelope(JSON.stringify(env), 'collector'), invalid('REPORT_DUP'));
});

test('numeric comment id bounds: MAX_SAFE_INTEGER accepted; unsafe and non-positive numbers rejected', () => {
  const maxSafe = numericReports(10);
  maxSafe[0].comment_id = Number.MAX_SAFE_INTEGER;
  const maxEnv = makeBatchEnvelope({ id: 'DOT-EVT-BATCH-NUM-MAX', reports: maxSafe });
  validateEnvelope(JSON.stringify(maxEnv), 'collector'); // must not throw

  // JSON.stringify maps NaN/Infinity to null before the parser ever sees them;
  // the validator-side contract is the same reject path.
  for (const bad of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity]) {
    const reports = numericReports(10);
    reports[3].comment_id = bad;
    const env = makeBatchEnvelope({ id: 'DOT-EVT-BATCH-NUM-BAD', reports });
    env.sha256 = envelopeDigest(env);
    assert.throws(() => validateEnvelope(JSON.stringify(env), 'collector'), invalid('REPORT_SHAPE'), `comment_id=${bad}`);
  }
});

test('non-number/non-string comment ids and bad strings reject REPORT_SHAPE', () => {
  for (const bad of [null, true, false, {}, [], '', '   ', 'has space', 'bad!id']) {
    const reports = numericReports(10);
    reports[6].comment_id = bad;
    const env = makeBatchEnvelope({ id: 'DOT-EVT-BATCH-NUM-TYPE', reports });
    env.sha256 = envelopeDigest(env);
    assert.throws(() => validateEnvelope(JSON.stringify(env), 'collector'), invalid('REPORT_SHAPE'), `comment_id=${JSON.stringify(bad)}`);
  }
});

// helper
function invalid(reason) {
  return (err) => {
    assert.ok(err && err.code === 'INVALID', `expected INVALID, got ${err && err.code} (${err && err.message})`);
    if (reason) assert.equal(err.reason, reason, `expected reason ${reason}, got ${err.reason}: ${err.message}`);
    return true;
  };
}

// ------------------------------------------------- F01: ANCESTRY_ACK_BYPASS
// analysis and solution carry EXACTLY ONE parent (analysis->batch,
// solution->analysis); zero-parent stays valid only for batch and ack.

test('F01: analysis/solution with zero, two or duplicate parents reject PARENT_COUNT', () => {
  const batch = makeBatchEnvelope();
  const batch2 = makeBatchEnvelope({ id: 'DOT-EVT-BATCH-SYNTH-002' });
  const analysis = makeAnalysisEnvelope({ batchEnv: batch });

  // analysis: zero parents
  const a0 = makeAnalysisEnvelope({ batchEnv: batch });
  a0.parents = [];
  a0.sha256 = envelopeDigest(a0);
  assert.throws(() => validateEnvelope(JSON.stringify(a0), 'analyst'), invalid('PARENT_COUNT'));

  // analysis: two parents
  const a2 = makeAnalysisEnvelope({ batchEnv: batch });
  a2.parents = [{ id: batch.id, sha256: batch.sha256 }, { id: batch2.id, sha256: batch2.sha256 }];
  a2.sha256 = envelopeDigest(a2);
  assert.throws(() => validateEnvelope(JSON.stringify(a2), 'analyst'), invalid('PARENT_COUNT'));

  // analysis: duplicate parents
  const ad = makeAnalysisEnvelope({ batchEnv: batch });
  ad.parents = [{ id: batch.id, sha256: batch.sha256 }, { id: batch.id, sha256: batch.sha256 }];
  ad.sha256 = envelopeDigest(ad);
  assert.throws(() => validateEnvelope(JSON.stringify(ad), 'analyst'), invalid('PARENT_COUNT'));

  // solution: zero parents
  const s0 = makeSolutionEnvelope({ analysisEnv: analysis });
  s0.parents = [];
  s0.sha256 = envelopeDigest(s0);
  assert.throws(() => validateEnvelope(JSON.stringify(s0), 'solver'), invalid('PARENT_COUNT'));

  // solution: two parents
  const analysis2 = makeAnalysisEnvelope({ id: 'DOT-EVT-ANALYSIS-SYNTH-002', batchEnv: batch });
  const s2 = makeSolutionEnvelope({ analysisEnv: analysis });
  s2.parents = [{ id: analysis.id, sha256: analysis.sha256 }, { id: analysis2.id, sha256: analysis2.sha256 }];
  s2.sha256 = envelopeDigest(s2);
  assert.throws(() => validateEnvelope(JSON.stringify(s2), 'solver'), invalid('PARENT_COUNT'));
});

test('F01: batch and ack zero-parent shapes stay valid', () => {
  const batch = makeBatchEnvelope({ parents: [] });
  assert.ok(validateEnvelope(JSON.stringify(batch), 'collector'));
  const ack = makeAckEnvelope({ eventEnv: batch });
  assert.equal(ack.parents.length, 0);
  assert.ok(validateEnvelope(JSON.stringify(ack), 'analyst'));
});
