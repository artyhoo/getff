import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync, symlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openLedger } from './ledger.mjs';
import { DatabaseSync } from 'node:sqlite';

const CLI = fileURLToPath(new URL('./cli.mjs', import.meta.url));
const owner = '01a12f24-188e-7933-84a9-0fb5a4a76269';
const sha = text => createHash('sha256').update(text).digest('hex');
const page = 'page_c7f1e26ac5b88191a9851a9f21c259d4';
const epoch = 'DOT_PRIMARY_EPOCH_1';
const write = (path, value) => { writeFileSync(path, JSON.stringify(value), { mode: 0o600 }); return path; };
function nativeAdmission(root, effectFiles) {
  const evidence = write(join(root, 'evidence.json'), { version: 1, fixture: 'independent effect review' });
  const ref = { path: evidence, sha256: sha(readFileSync(evidence)) };
  const admission = write(join(root, 'native-source-admission.json'), { version: 1, owner,
    effects: Object.fromEntries(Object.entries(effectFiles).map(([effect, file]) => [effect, sha(readFileSync(file))])) });
  const here = fileURLToPath(new URL('.', import.meta.url));
  write(join(root, 'native-binding.json'), { version: 1, mode: 'NATIVE_EXISTING_OWNER', owner, cli: CLI, source_commit: 'a'.repeat(40),
    source_files: ['cli.mjs', 'contract.mjs', 'executor.mjs', 'ledger.mjs', 'bridge-runner.body.js', 'native-source.mjs', 'native-source-store.mjs', 'glm-intake.mjs'].map(name => ({ name, sha256: sha(readFileSync(join(here, name))) })),
    authority: ref, source_acceptance: ref, installation: ref, receiver_contract: ref,
    native_source_admission: { path: admission, sha256: sha(readFileSync(admission)) } });
}
function admitSourceRead(root, descriptor) {
  mkdirSync(join(root, 'native-source', 'access'), { recursive: true, mode: 0o700 });
  const file = write(join(root, 'native-source', 'access', descriptor.sha256 + '.json'), { version: 1, owner,
    tool: 'mcp__codex_apps__chatgpt_space_read_page_reference', source: descriptor, kind: 'text', text_representation: 'source' });
  const admissionPath = join(root, 'native-source-admission.json');
  const a = JSON.parse(readFileSync(admissionPath, 'utf8'));
  a.effects['SOURCE_ACCESS:' + descriptor.sha256] = sha(readFileSync(file));
  write(admissionPath, a);
  const bindingPath = join(root, 'native-binding.json');
  const b = JSON.parse(readFileSync(bindingPath, 'utf8'));
  b.native_source_admission.sha256 = sha(readFileSync(admissionPath));
  write(bindingPath, b);
}
function registrationFixture(root) {
  mkdirSync(join(root, 'native-source', 'verified'), { recursive: true, mode: 0o700 });
  const text = JSON.stringify({ format: 'getff-dot-consolidation-index/1', control_id: 'DOT-CONSOLIDATION-20261008-01',
    generation: 'DOT-CONSOLIDATION-INDEX-0003', status: 'PREPARED_HANDOVER_NOT_ACTIVATED', reserved_producer_label: 'DOT_GETFF_PRIMARY',
    producer_label_activated: false, page: { id: page, url: 'https://chatgpt.com/space/' + page },
    policy: { executor_admission: false, glm_dispatch: false }, migration: { semantic_ownership_taken: false },
    source_acquisition: [], retained_solver_items: [], retained_analyst_items: [], retained_solution_status: [] });
  const source = join(root, 'native-source', 'verified', 'challenge.json');
  writeFileSync(source, text, { mode: 0o600 });
  const descriptor = { page_id: page, reference: 'library-file:synthetic-native-challenge', sha256: sha(text), bytes: Buffer.byteLength(text) };
  const access = { kind: 'text', text_representation: 'source', ...descriptor };
  const registration = write(join(root, 'native-source', 'registration.json'), { version: 1, owner, ...{ producer: 'DOT_GETFF_PRIMARY', epoch, page_id: page },
    challenge: descriptor, access, local_source_path: source });
  const mode = write(join(root, 'native-source', 'mode.json'), { version: 1, owner, mode: 'SOURCE_ONLY' });
  nativeAdmission(root, { SOURCE_ONLY: mode, REGISTER_NATIVE_DOT: registration });
  admitSourceRead(root, descriptor);
  return { registration, mode, descriptor, access, source, text };
}
function capturedExecution(root, tag = '') {
  const raw = new DatabaseSync(join(root, 'ledger.sqlite'));
  raw.prepare("INSERT INTO events (id,sha256,kind,producer,parent_json,payload_json,state,created_ms) VALUES (?,'hash','solution','solver','[]','{}','QUEUED',1)").run('fixture-sol' + tag);
  raw.close();
  const l = openLedger(join(root, 'ledger.sqlite'));
  const claimed = l.claimExecution({ solutionId: 'fixture-sol' + tag,
    sessionId: tag ? 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' : 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' });
  const report = { version: 1, status: 'CODE_COMPLETE', execution_id: claimed.execution_id, session_id: claimed.session_id,
    solution_sha256: '1'.repeat(64), artifact_sha256: '2'.repeat(64), source_tree_digest: '3'.repeat(64),
    pr_url: 'https://github.com/artyhoo/getff/pull/7', head_sha: 'a'.repeat(40), independent_review_ref: null };
  l.updateExecution(claimed.execution_id, { state: 'REQUIRES_REVIEW', pr_url: report.pr_url, head_sha: report.head_sha });
  l.persistWorkerReport({ executionId: claimed.execution_id, report });
  l.close();
  return report;
}
function run(root, args, env = {}) {
  const r = spawnSync(process.execPath, [CLI, ...args, '--root', root], { encoding: 'utf8', env: { ...process.env, NODE_NO_WARNINGS: '1', ...env } });
  return { status: r.status, value: r.stdout ? JSON.parse(r.stdout) : null, error: r.stderr };
}
function rootFixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'dot-native-source-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  assert.equal(run(root, ['init']).status, 0);
  return root;
}

// Without an independently admitted control receipt, source-only mode cannot
// be used to change the live trust/admission boundary.
test('native source mode refuses a self-authored control before ledger mutation', t => {
  const root = rootFixture(t);
  const file = join(root, 'control.json');
  writeFileSync(file, JSON.stringify({ version: 1, owner, mode: 'SOURCE_ONLY' }), { mode: 0o600 });
  const before = run(root, ['status']).value;
  const r = run(root, ['native-source-mode', '--file', file]);
  assert.equal(r.status, 1);
  assert.equal(r.value.code, 'DOT_SOURCE_CONTROL_UNTRUSTED');
  assert.deepEqual(run(root, ['status']).value.counts, before.counts);
});

test('source-only control survives restart and denies every legacy delivery/execution claim', t => {
  const root = rootFixture(t);
  let l = openLedger(join(root, 'ledger.sqlite'));
  // This method is the controlled, transaction-bound owner seam; the CLI
  // requires actual authority/effect-admission receipts before invoking it.
  l.enterSourceOnly({ owner, admissionSha256: 'a'.repeat(64) });
  l.close();
  l = openLedger(join(root, 'ledger.sqlite'));
  t.after(() => l.close());
  assert.equal(l.status().source_mode, 'SOURCE_ONLY');
  assert.equal(l.status().cloud_semantic_owner, 'LEGACY');
  assert.equal(l.status().local_executor_admission, 'OFF');
  assert.throws(() => l.claimExecution({ solutionId: 'absent', sessionId: owner }), e => e.code === 'LOCAL_EXECUTOR_OFF');
  assert.throws(() => l.claimDelivery('absent'), e => e.code === 'SOURCE_ONLY');
});

test('CLI source-only mode requires independently pinned effect bytes and remains executor OFF', t => {
  const root = rootFixture(t);
  mkdirSync(join(root, 'native-source'), { mode: 0o700 });
  const file = write(join(root, 'native-source', 'mode.json'), { version: 1, owner, mode: 'SOURCE_ONLY' });
  nativeAdmission(root, { SOURCE_ONLY: file });
  const r = run(root, ['native-source-mode', '--file', file]);
  assert.equal(r.status, 0, r.error);
  assert.equal(run(root, ['status']).value.local_executor_admission, 'OFF');
  write(file, { version: 1, owner, mode: 'ACTIVE' });
  assert.equal(run(root, ['native-source-mode', '--file', file]).value.code, 'DOT_SOURCE_CONTROL_UNTRUSTED');
});

test('exact native review rejects wrong epoch, stale HEAD and fabricated GO with findings', async () => {
  const { validateNativeReview } = await import('./native-source.mjs');
  const binding = { producer: 'DOT_GETFF_PRIMARY', epoch, page_id: page };
  const request = { request_id: 'request-1', repository: 'artyhoo/getff', pr: 7, head_sha: 'a'.repeat(40) };
  const review = { version: 1, kind: 'dot_head_review', producer: binding.producer, epoch, review_id: 'review-1', request_id: request.request_id,
    repository: request.repository, pr: request.pr, head_sha: request.head_sha, decision: 'GO', decided_at: '2026-10-14T09:00:00.000Z', finding_count: 0, findings_artifact: null };
  assert.equal(validateNativeReview(JSON.stringify(review), { binding, request, currentHead: request.head_sha }).decision, 'GO');
  for (const patch of [{ epoch: 'OTHER' }, { finding_count: 1 }, { decision: 'APPROVE' }, { request_id: 'other' }, { review_id: 7 }, { review_id: null }, { extra: true }]) {
    assert.throws(() => validateNativeReview(JSON.stringify({ ...review, ...patch }), { binding, request, currentHead: request.head_sha }));
  }
  assert.throws(() => validateNativeReview(JSON.stringify(review), { binding, request, currentHead: 'b'.repeat(40) }), e => e.code === 'DOT_APPROVAL_STALE');
  assert.throws(() => validateNativeReview(JSON.stringify(review).replace('"decision":"GO"', '"decision":"GO","decision":"GO"'), { binding, request, currentHead: request.head_sha }));
});

test('source-only actual body returns before cloud reads, tick and sends even after baseline receipt', async t => {
  const root = rootFixture(t);
  const l = openLedger(join(root, 'ledger.sqlite'));
  l.enterSourceOnly({ owner, admissionSha256: 'a'.repeat(64) });
  l.recordBaselineReceipt({ intake_id: 'DOT-INTAKE-20261008-01', consumed_report_keys: ['b'.repeat(64)], excluded: [] });
  l.close();
  const calls = [];
  const config = { root, cli: CLI, node: process.execPath, operation_fence_required: true, timers: { setTimeout, clearTimeout }, operation_exec: async args => {
    calls.push(args[0]);
    return run(root, args).value;
  } };
  const emitted = [];
  const body = readFileSync(new URL('./bridge-runner.body.js', import.meta.url), 'utf8');
  const AsyncFunction = (async function() {}).constructor;
  const result = await new AsyncFunction('tools', 'config', 'emit', body)({}, config, r => emitted.push(r));
  assert.equal(result.state, 'SOURCE_ONLY');
  assert.deepEqual(result.counts, { sources: 0, deliveries: 0, acks: 0, executions: 0 });
  assert.deepEqual(calls, ['status']);
  assert.equal(emitted.length, 1);
  assert.equal(run(root, ['tick']).value.source_mode, 'SOURCE_ONLY');
});

test('native registry registration and import preserve original bytes without standard events or sends', t => {
  const root = rootFixture(t);
  const f = registrationFixture(root);
  assert.equal(run(root, ['native-source-mode', '--file', f.mode]).status, 0);
  assert.equal(run(root, ['native-source-register', '--file', f.registration]).status, 0);
  const input = write(join(root, 'native-source', 'import.json'), { version: 1, source: f.descriptor, access: f.access, local_source_path: f.source });
  const r = run(root, ['native-source-import', '--file', input]);
  assert.equal(r.status, 0, r.error);
  assert.equal(r.value.source_sha256, f.descriptor.sha256);
  assert.equal(run(root, ['native-source-import', '--file', input]).value.replay, true);
  const l = openLedger(join(root, 'ledger.sqlite'));
  t.after(() => l.close());
  assert.equal(l.nativeSources.getSource(f.descriptor.sha256).original_bytes.toString(), f.text);
  assert.equal(l.status().counts.outbox_total, 0);
  assert.equal(l.status().local_executor_admission, 'OFF');
  assert.equal(l.status().cloud_semantic_owner, 'LEGACY');
  assert.equal(l.getExecution('any'), null);
  const binding = l.nativeSources.getBinding();
  assert.throws(() => l.nativeSources.retain({ binding, descriptor: { ...f.descriptor, sha256: 'f'.repeat(64) }, access: { ...f.access, sha256: 'f'.repeat(64) }, bytes: Buffer.from(f.text), kind: 'native_registry', generation: 'forged-source' }), e => e.code === 'DOT_SOURCE_UNTRUSTED');
  const nativePath = join(root, 'native-binding.json');
  const native = JSON.parse(readFileSync(nativePath, 'utf8'));
  delete native.native_source_admission;
  write(nativePath, native);
  assert.equal(run(root, ['native-source-import', '--file', input]).value.code, 'DOT_SOURCE_UNREGISTERED', 'retained history cannot reactivate a revoked OS-owned registration');
});

test('wrong Page, forged access, symlink and changed source refuse enrollment', t => {
  const root = rootFixture(t);
  const f = registrationFixture(root);
  run(root, ['native-source-mode', '--file', f.mode]);
  assert.equal(run(root, ['native-source-register', '--file', f.registration]).status, 0);
  for (const patch of [{ source: { ...f.descriptor, page_id: 'page_wrong' } }, { access: { ...f.access, kind: 'extracted' } }]) {
    const input = write(join(root, 'native-source', 'import.json'), { version: 1, source: f.descriptor, access: f.access, local_source_path: f.source, ...patch });
    assert.equal(run(root, ['native-source-import', '--file', input]).status, 1);
  }
  const link = join(root, 'native-source', 'verified', 'link.json');
  symlinkSync(f.source, link);
  const input = write(join(root, 'native-source', 'import.json'), { version: 1, source: f.descriptor, access: f.access, local_source_path: link });
  assert.equal(run(root, ['native-source-import', '--file', input]).status, 1);
  writeFileSync(f.source, f.text + ' ');
  write(input, { version: 1, source: f.descriptor, access: f.access, local_source_path: f.source });
  assert.equal(run(root, ['native-source-import', '--file', input]).status, 1);
});

test('native review is source-bound to one persisted request, execution and current HEAD', async t => {
  const root = rootFixture(t);
  const report = capturedExecution(root);
  const f = registrationFixture(root);
  run(root, ['native-source-mode', '--file', f.mode]);
  run(root, ['native-source-register', '--file', f.registration]);
  const l = openLedger(join(root, 'ledger.sqlite'));
  t.after(() => l.close());
  const binding = l.nativeSources.getBinding();
  const request = { version: 1, request_id: 'request-1', execution_id: report.execution_id, repository: 'artyhoo/getff', pr: 7,
    head_sha: report.head_sha, base_sha: 'b'.repeat(40), epoch, source_binding_sha256: binding.sha256,
    policy: { version: 1, digest: '4'.repeat(64) }, required_evidence_sha256: '5'.repeat(64) };
  l.nativeSources.request({ request });
  const review = { version: 1, kind: 'dot_head_review', producer: binding.producer, epoch, review_id: 'review-1', request_id: request.request_id,
    repository: request.repository, pr: request.pr, head_sha: request.head_sha, decision: 'GO', decided_at: '2026-10-14T09:00:00.000Z', finding_count: 0, findings_artifact: null };
  const bytes = Buffer.from(JSON.stringify(review));
  const descriptor = { page_id: page, reference: 'library-file:synthetic-review', sha256: sha(bytes), bytes: bytes.length };
  l.nativeSources.retain({ binding, descriptor, access: { kind: 'text', text_representation: 'source', ...descriptor }, bytes, kind: 'dot_head_review', generation: review.review_id, sourceReadSha256: 'a'.repeat(64) });
  const receipt = { version: 1, execution_id: report.execution_id, request_id: request.request_id, source_binding_sha256: binding.sha256, source: descriptor };
  const result = l.nativeSources.approval({ receipt, currentHead: report.head_sha });
  assert.equal(result.review.decision, 'GO');
  assert.equal(result.receipt.head_sha, report.head_sha);
  assert.equal(result.receipt.dot_go, true);
  assert.equal(result.receipt.session_id, report.session_id);
  assert.equal(l.nativeSources.approval({ receipt, currentHead: report.head_sha }).replay, true);
  assert.throws(() => l.nativeSources.approval({ receipt, currentHead: 'f'.repeat(40) }), e => e.code === 'DOT_APPROVAL_STALE');
  assert.throws(() => l.nativeSources.approval({ receipt: { ...receipt, execution_id: 'other' }, currentHead: report.head_sha }));
  assert.equal(l.getExecution(report.execution_id).state, 'REQUIRES_REVIEW', 'source import alone cannot complete execution or CI');
  assert.equal(l.getReviewReceipt(report.execution_id), null, 'only existing F07 verification seam may apply the derived approval');
  l.persistWorkerReport({ executionId: report.execution_id, report: { ...report, source_tree_digest: 'f'.repeat(64) } });
  assert.throws(() => l.nativeSources.approval({ receipt, currentHead: report.head_sha }), e => e.code === 'DOT_APPROVAL_UNPROVEN', 'a changed worker capture under the same HEAD must invalidate the old request');
});

function conflictingReviews(t) {
  const root = rootFixture(t);
  const otherReport = capturedExecution(root, '-other');
  const prior = openLedger(join(root, 'ledger.sqlite'));
  prior.updateExecution(otherReport.execution_id, { state: 'BLOCKED' });
  prior.close();
  const report = capturedExecution(root);
  const f = registrationFixture(root);
  assert.equal(run(root, ['native-source-mode', '--file', f.mode]).status, 0);
  assert.equal(run(root, ['native-source-register', '--file', f.registration]).status, 0);
  const l = openLedger(join(root, 'ledger.sqlite'));
  t.after(() => l.close());
  const binding = l.nativeSources.getBinding();
  const policy = { version: 1, digest: '4'.repeat(64), required: [{ name: 'ci', workflow: 'CI', app: 'github-actions' }] };
  for (const [id, capture] of [['request-1', report], ['request-2', otherReport]]) {
    l.nativeSources.request({ request: { version: 1, request_id: id, execution_id: capture.execution_id, repository: 'artyhoo/getff', pr: 7,
      head_sha: capture.head_sha, base_sha: 'b'.repeat(40), epoch, source_binding_sha256: binding.sha256,
      policy: { version: policy.version, digest: policy.digest }, required_evidence_sha256: '5'.repeat(64) } });
  }
  function original(id, decision, requestId = 'request-1', decidedAt = '2026-10-14T10:00:00Z') {
    const review = { version: 1, kind: 'dot_head_review', producer: binding.producer, epoch, review_id: id, request_id: requestId,
      repository: 'artyhoo/getff', pr: 7, head_sha: report.head_sha, decision, decided_at: decidedAt,
      finding_count: decision === 'GO' ? 0 : 1,
      findings_artifact: decision === 'GO' ? null : { page_id: page, reference: 'library-file:synthetic-findings', sha256: 'f'.repeat(64), bytes: 1 } };
    const bytes = Buffer.from(JSON.stringify(review));
    const descriptor = { page_id: page, reference: 'library-file:synthetic-' + id, sha256: sha(bytes), bytes: bytes.length };
    const capture = requestId === 'request-1' ? report : otherReport;
    return { bytes, review, descriptor, receipt: { version: 1, execution_id: capture.execution_id, request_id: requestId,
      source_binding_sha256: binding.sha256, source: descriptor } };
  }
  const a = original('go-a', 'GO', 'request-1', '2026-10-14T09:00:00Z');
  const b = original('fix-b', 'NEEDS_FIX');
  const c = original('go-c', 'GO', 'request-2');
  const retain = item => l.nativeSources.retain({ binding, descriptor: item.descriptor,
    access: { kind: 'text', text_representation: 'source', ...item.descriptor }, bytes: item.bytes,
    kind: 'dot_head_review', generation: item.review.review_id, sourceReadSha256: 'a'.repeat(64) });
  const approve = item => l.nativeSources.approval({ receipt: item.receipt, currentHead: report.head_sha });
  return { root, l, report, otherReport, policy, a, b, c, retain, approve, original };
}

for (const order of ['needs-fix-first', 'go-first', 'go-replay', 'retained-only']) {
  test('same-request NEEDS_FIX blocks obsolete GO: ' + order, t => {
    const { l, report, a, b, c, retain, approve, original } = conflictingReviews(t);
    if (order === 'needs-fix-first') { retain(b); approve(b); retain(a); }
    else {
      retain(a);
      if (order === 'go-replay') assert.equal(approve(a).receipt.dot_go, true);
      retain(b);
      if (order !== 'retained-only') approve(b);
    }
    assert.equal(approve(a).receipt, null, 'the obsolete GO cannot create current approval');
    assert.equal(approve(a).review.decision, 'NEEDS_FIX');
    // Conflicting same-request GO stays blocked regardless of decision time.
    const laterGo = original('go-later', 'GO', 'request-1', '2026-10-14T11:00:00Z');
    retain(laterGo);
    assert.equal(approve(laterGo).receipt, null);
    retain(c);
    assert.equal(approve(c).receipt.dot_go, true, 'another persisted request remains independent');
    assert.equal(approve(c).replay, true, 'unchanged valid GO remains idempotent');
    for (const item of [a, b]) assert.deepEqual(l.nativeSources.getSource(item.descriptor.sha256).original_bytes, item.bytes);
    assert.equal(l.getExecution(report.execution_id).state, 'REQUIRES_REVIEW');
    assert.equal(l.getExecution(report.execution_id).attempts_admitted, 1);
    assert.equal(l.status().local_executor_admission, 'OFF');
  });
}

test('an applied GO held by infrastructure cannot resume after same-request NEEDS_FIX', async t => {
  const { applyReviewAndVerify } = await import('./executor.mjs');
  const { l, report, policy, a, b, retain, approve } = conflictingReviews(t);
  retain(a);
  const receipt = approve(a).receipt;
  let ns = 1_000_000_000n;
  const clock = { ok: () => true, fresh: () => true, activeNs: () => (ns += 10_000_000n) };
  const provenance = { verifyReceipt: ({ receipt: r }) => ({ ok: JSON.stringify(r) === JSON.stringify(receipt) }) };
  const first = await applyReviewAndVerify({ ledger: l, executionId: report.execution_id, receipt, policy, clock, provenance,
    ghImpl: { view: () => { throw Object.assign(new Error('offline'), { ghBlocker: 'GH_TRANSPORT' }); } } });
  assert.equal(first.blocker, 'GH_TRANSPORT');
  assert.equal(l.getExecution(report.execution_id).state, 'VERIFYING');
  const before = { receipt: l.getReviewReceipt(report.execution_id), budget: l.reviewVerifyBudget({ executionId: report.execution_id }),
    attempt: l.getAttempt(report.execution_id, 1) };
  retain(b); approve(b);
  let calls = 0;
  const retry = await applyReviewAndVerify({ ledger: l, executionId: report.execution_id, receipt, policy, clock, provenance,
    ghImpl: { view: () => { calls++; throw Object.assign(new Error('probe'), { ghBlocker: 'GH_TRANSPORT' }); } } });
  assert.equal(retry.blocker, 'DOT_NEEDS_FIX');
  assert.equal(calls, 0, 'revoked approval cannot start another CI verification');
  assert.equal(l.getExecution(report.execution_id).state, 'VERIFYING');
  assert.deepEqual(l.getReviewReceipt(report.execution_id), before.receipt, 'old approval remains immutable history');
  assert.deepEqual(l.reviewVerifyBudget({ executionId: report.execution_id }), before.budget);
  assert.deepEqual(l.getAttempt(report.execution_id, 1), before.attempt);
});

for (const when of ['during-ci', 'after-done']) {
  test('native findings remain governing ' + when, async t => {
    const { applyReviewAndVerify } = await import('./executor.mjs');
    const { l, report, policy, a, b, retain, approve } = conflictingReviews(t);
    retain(a);
    const receipt = approve(a).receipt;
    let ns = 1_000_000_000n;
    const clock = { ok: () => true, fresh: () => true, activeNs: () => (ns += 10_000_000n) };
    const provenance = { verifyReceipt: () => ({ ok: true }) };
    let read = 0;
    const link = 'https://github.com/artyhoo/getff/actions/runs/123/job/456';
    const ghImpl = {
      view: () => ({ headRefOid: report.head_sha, baseRefOid: 'b'.repeat(40), baseRefName: 'staging', state: 'OPEN',
        isDraft: false, mergeStateStatus: 'CLEAN', autoMergeRequest: null }),
      checks: () => {
        if (++read === 2 && when === 'during-ci') { retain(b); approve(b); }
        return [{ name: 'ci', workflow: 'CI', state: 'SUCCESS', bucket: 'pass', link }];
      },
      checkRuns: () => ({ total_count: 1, check_runs: [{ id: 456, head_sha: report.head_sha, name: 'ci', status: 'completed',
        conclusion: 'success', details_url: link, app: { id: 15368, slug: 'github-actions' } }] }),
    };
    const out = await applyReviewAndVerify({ ledger: l, executionId: report.execution_id, receipt, policy, clock, provenance, ghImpl });
    if (when === 'during-ci') {
      assert.equal(out.blocker, 'DOT_NEEDS_FIX');
      assert.equal(l.getExecution(report.execution_id).state, 'VERIFYING');
      assert.notEqual(l.getAttempt(report.execution_id, 1).state, 'DONE', 'attempt and execution completion are atomic');
      assert.throws(() => l.updateExecution(report.execution_id, { state: 'DONE' }), e => e.code === 'DOT_NEEDS_FIX');
    } else {
      assert.equal(out.state, 'DONE');
      const before = l.getExecution(report.execution_id);
      const oldReceipt = l.getReviewReceipt(report.execution_id);
      retain(b); approve(b);
      const replay = await applyReviewAndVerify({ ledger: l, executionId: report.execution_id, receipt, policy, clock, provenance, ghImpl });
      assert.equal(replay.blocker, 'DOT_NEEDS_FIX', 'historical completion cannot project current approval');
      assert.deepEqual(l.getExecution(report.execution_id), before, 'historical outcome remains immutable');
      assert.deepEqual(l.getReviewReceipt(report.execution_id), oldReceipt);
    }
  });
}

for (const scenario of ['complete', 'needs-fix-after-hold']) {
test('actual CLI native review on Darwin: ' + scenario, t => {
  const root = rootFixture(t);
  const report = capturedExecution(root);
  const f = registrationFixture(root);
  const policy = write(join(root, 'native-source', 'policy.json'), { version: 1, digest: '4'.repeat(64), required: [{ name: 'ci-success', workflow: 'CI', app: 'github-actions' }] });
  nativeAdmission(root, { SOURCE_ONLY: f.mode, REGISTER_NATIVE_DOT: f.registration, CHECK_POLICY: policy });
  admitSourceRead(root, f.descriptor);
  assert.equal(run(root, ['native-source-mode', '--file', f.mode]).status, 0);
  assert.equal(run(root, ['native-source-register', '--file', f.registration]).status, 0);
  const bin = join(root, 'bin'); mkdirSync(bin);
  const link = 'https://github.com/artyhoo/getff/actions/runs/123/job/456';
  const ghData = join(root, 'gh-data.json');
  write(ghData, { view: { headRefOid: report.head_sha, baseRefOid: 'b'.repeat(40), baseRefName: 'staging', state: 'OPEN', isDraft: false, mergeStateStatus: 'CLEAN', autoMergeRequest: null },
    checks: [{ name: 'ci-success', workflow: 'CI', state: 'SUCCESS', bucket: 'pass', link }],
    runs: { total_count: 1, check_runs: [{ id: 456, head_sha: report.head_sha, name: 'ci-success', status: 'completed', conclusion: 'success', details_url: link, app: { slug: 'github-actions', id: 15368 } }] } });
  writeFileSync(join(bin, 'gh'), '#!' + process.execPath + '\nimport{readFileSync}from"node:fs";const s=JSON.parse(readFileSync(' + JSON.stringify(ghData) + ',"utf8"));const a=process.argv.slice(2);if(s.offline&&a[1]==="checks")process.exit(2);process.stdout.write(JSON.stringify(a[0]==="api"?s.runs:a[1]==="checks"?s.checks:s.view));\n', { mode: 0o700 });
  const env = { PATH: bin + ':' + process.env.PATH };
  const r = run(root, ['dot-review-request', '--execution-id', report.execution_id], env);
  assert.equal(r.status, 0, JSON.stringify(r));
  if (process.platform !== 'darwin') {
    assert.equal(r.value.state, 'HELD', JSON.stringify(r.value));
    assert.equal(r.value.blocker, 'CLOCK_UNPROVEN');
    const l = openLedger(join(root, 'ledger.sqlite'));
    assert.equal(l.getExecution(report.execution_id).state, 'REQUIRES_REVIEW');
    assert.equal(l.getReviewReceipt(report.execution_id), null);
    l.close();
    const db = new DatabaseSync(join(root, 'ledger.sqlite'));
    assert.equal(db.prepare('SELECT count(*) AS n FROM native_review_requests').get().n, 0);
    assert.equal(db.prepare('SELECT count(*) AS n FROM native_reviews').get().n, 0);
    assert.equal(db.prepare('SELECT count(*) AS n FROM execution_attempts').get().n, 1);
    db.close();
    return;
  }
  assert.ok(r.value.request, JSON.stringify(r.value));
  const request = r.value.request;
  const l = openLedger(join(root, 'ledger.sqlite')); const binding = l.nativeSources.getBinding(); l.close();
  const review = { version: 1, kind: 'dot_head_review', producer: binding.producer, epoch, review_id: 'actual-cli-review', request_id: request.request_id,
    repository: request.repository, pr: request.pr, head_sha: request.head_sha, decision: 'GO', decided_at: '2026-10-14T09:00:00.000Z', finding_count: 0, findings_artifact: null };
  const text = JSON.stringify(review), source = join(root, 'native-source', 'verified', 'review.json');
  writeFileSync(source, text, { mode: 0o600 });
  const descriptor = { page_id: page, reference: 'library-file:synthetic-original-review', sha256: sha(text), bytes: Buffer.byteLength(text) };
  const original = write(join(root, 'native-source', 'review-source.json'), { version: 1, source: descriptor, access: { kind: 'text', text_representation: 'source', ...descriptor }, local_source_path: source });
  assert.equal(run(root, ['native-source-import', '--file', original]).value.code, 'DOT_SOURCE_ACCESS_UNPROVEN', 'an otherwise exact same-head GO with claimed access is not native evidence');
  admitSourceRead(root, descriptor);
  assert.equal(run(root, ['native-source-import', '--file', original]).status, 0);
  const input = write(join(root, 'native-source', 'approval.json'), { version: 1, execution_id: report.execution_id, request_id: request.request_id, source_binding_sha256: binding.sha256, source: descriptor, local_source_path: source });
  if (scenario === 'needs-fix-after-hold') write(ghData, { ...JSON.parse(readFileSync(ghData)), offline: true });
  const applied = run(root, ['dot-approval-import', '--file', input], env);
  assert.equal(applied.status, 0, JSON.stringify(applied));
  if (scenario === 'complete') assert.equal(applied.value.state, 'DONE');
  else {
    assert.equal(applied.value.state, 'HELD');
    assert.equal(applied.value.blocker, 'GH_TRANSPORT');
    const held = openLedger(join(root, 'ledger.sqlite'));
    const before = { receipt: held.getReviewReceipt(report.execution_id), budget: held.reviewVerifyBudget({ executionId: report.execution_id }),
      attempt: held.getAttempt(report.execution_id, 1) };
    held.close();
    const fix = { ...review, review_id: 'actual-cli-needs-fix', decision: 'NEEDS_FIX', decided_at: '2026-10-14T10:00:00Z', finding_count: 1,
      findings_artifact: { page_id: page, reference: 'library-file:synthetic-findings', sha256: 'f'.repeat(64), bytes: 1 } };
    const fixText = JSON.stringify(fix), fixSource = join(root, 'native-source', 'verified', 'fix.json');
    writeFileSync(fixSource, fixText, { mode: 0o600 });
    const fixDescriptor = { page_id: page, reference: 'library-file:synthetic-fix', sha256: sha(fixText), bytes: Buffer.byteLength(fixText) };
    admitSourceRead(root, fixDescriptor);
    const fixImport = write(join(root, 'native-source', 'fix-import.json'), { version: 1, source: fixDescriptor,
      access: { kind: 'text', text_representation: 'source', ...fixDescriptor }, local_source_path: fixSource });
    assert.equal(run(root, ['native-source-import', '--file', fixImport]).status, 0);
    const fixApproval = write(join(root, 'native-source', 'fix-approval.json'), { version: 1, execution_id: report.execution_id,
      request_id: request.request_id, source_binding_sha256: binding.sha256, source: fixDescriptor, local_source_path: fixSource });
    assert.equal(run(root, ['dot-approval-import', '--file', fixApproval], env).value.blocker, 'DOT_NEEDS_FIX');
    write(ghData, { ...JSON.parse(readFileSync(ghData)), offline: false });
    const replay = run(root, ['dot-approval-import', '--file', input], env);
    assert.equal(replay.status, 0, JSON.stringify(replay));
    assert.equal(replay.value.state, 'HELD');
    assert.equal(replay.value.blocker, 'DOT_NEEDS_FIX', 'green checks cannot resurrect the obsolete GO');
    const after = openLedger(join(root, 'ledger.sqlite'));
    assert.equal(after.getExecution(report.execution_id).state, 'VERIFYING');
    assert.deepEqual(after.getReviewReceipt(report.execution_id), before.receipt);
    assert.deepEqual(after.reviewVerifyBudget({ executionId: report.execution_id }), before.budget);
    assert.deepEqual(after.getAttempt(report.execution_id, 1), before.attempt);
    after.close();
  }
  const after = run(root, ['status']).value;
  assert.equal(after.local_executor_admission, 'OFF');
  assert.equal(after.counts.outbox_total, 0);
  const db = new DatabaseSync(join(root, 'ledger.sqlite'));
  assert.equal(db.prepare('SELECT count(*) AS n FROM executions').get().n, 1);
  assert.equal(db.prepare('SELECT count(*) AS n FROM execution_attempts').get().n, 1, 'original task attempt only, no review-created worker');
  db.close();
});
}

test('native admission refuses an adapter missing from the pinned source inventory', t => {
  const root = rootFixture(t);
  const f = registrationFixture(root);
  const path = join(root, 'native-binding.json');
  const b = JSON.parse(readFileSync(path, 'utf8'));
  b.source_files = b.source_files.filter(r => r.name !== 'native-source.mjs');
  write(path, b);
  const r = run(root, ['native-source-mode', '--file', f.mode]);
  assert.equal(r.status, 1);
  assert.equal(r.value.code, 'NATIVE_BINDING_UNTRUSTED');
});

test('source-only preserves semantic control and denies bypass ingest and further attempt debits', t => {
  const root = rootFixture(t);
  const report = capturedExecution(root);
  const l = openLedger(join(root, 'ledger.sqlite'));
  t.after(() => l.close());
  l._ctrlSet('cloud_semantic_owner', 'DOT_PENDING');
  l.enterSourceOnly({ owner, admissionSha256: 'a'.repeat(64) });
  assert.equal(l.status().cloud_semantic_owner, 'DOT_PENDING');
  assert.throws(() => l.ingest({}), e => e.code === 'SOURCE_ONLY');
  assert.equal(l.admitNextAttempt({ executionId: report.execution_id, bootId: 'boot', sessionId: report.session_id, purpose: 'resume' }).code, 'LOCAL_EXECUTOR_OFF');
  assert.throws(() => l.claimReceipt('anything'), e => e.code === 'SOURCE_ONLY');
  const row = l.getExecution(report.execution_id);
  assert.equal(row.attempts_admitted, 1);
  assert.equal(row.state, 'REQUIRES_REVIEW');
});

test('observed native consolidation extensions stay opaque, never become head review authority', async () => {
  const { validateNativeRegistry, validateNativeReview, NATIVE_DOT } = await import('./native-source.mjs');
  const s = { format: 'getff-dot-consolidation-index/1', control_id: 'DOT-CONSOLIDATION-20261008-01', generation: 'DOT-CONSOLIDATION-INDEX-0026',
    status: 'CLOUD_ACTIVE_LOCAL_EXECUTOR_OFF', reserved_producer_label: NATIVE_DOT.producer, producer_label_activated: false,
    page: { id: page, url: 'https://chatgpt.com/space/' + page }, policy: { executor_admission: false }, migration: {}, source_acquisition: [],
    retained_solver_items: [], retained_analyst_items: [], retained_solution_status: [], handover_receipt: { status: 'historical' },
    approved_head_receipts: [{ verdict: 'GO_SCOPED' }], approval_artifacts: [], completed_review_receipts: [], semantic_progress: {},
    prepared_solution_packets: [{ ready: false }], packet_transport_policy: {}, infrastructure_recovery: {}, instruction_review_control: {}, historical_projection_snapshots: [] };
  assert.equal(validateNativeRegistry(JSON.stringify(s), NATIVE_DOT).kind, 'native_registry');
  assert.throws(() => validateNativeReview(JSON.stringify(s), { binding: NATIVE_DOT, request: {}, currentHead: 'a'.repeat(40) }));
  assert.throws(() => validateNativeRegistry(JSON.stringify({ ...s, unrecognized_extension: true }), NATIVE_DOT));
});

test('a privately self-authored source cannot acquire native origin through claimed access metadata', t => {
  const root = rootFixture(t);
  const f = registrationFixture(root);
  run(root, ['native-source-mode', '--file', f.mode]);
  assert.equal(run(root, ['native-source-register', '--file', f.registration]).status, 0);
  const text = JSON.stringify({ ...JSON.parse(f.text), generation: 'SELF-AUTHORED-NATIVE' });
  const source = join(root, 'native-source', 'verified', 'self-authored.json');
  writeFileSync(source, text, { mode: 0o600 });
  const descriptor = { ...f.descriptor, reference: 'library-file:invented-by-caller', sha256: sha(text), bytes: Buffer.byteLength(text) };
  const file = write(join(root, 'native-source', 'self-import.json'), { version: 1, source: descriptor,
    access: { kind: 'text', text_representation: 'source', ...descriptor }, local_source_path: source });
  const r = run(root, ['native-source-import', '--file', file]);
  assert.equal(r.status, 1);
  assert.equal(r.value.code, 'DOT_SOURCE_ACCESS_UNPROVEN');
  // Even a same-UID fabricated receipt cannot replace independent admission.
  mkdirSync(join(root, 'native-source', 'access'), { recursive: true });
  write(join(root, 'native-source', 'access', descriptor.sha256 + '.json'), { version: 1, owner,
    tool: 'mcp__codex_apps__chatgpt_space_read_page_reference', source: descriptor, kind: 'text', text_representation: 'source' });
  assert.equal(run(root, ['native-source-import', '--file', file]).value.code, 'DOT_SOURCE_ACCESS_UNPROVEN');
});

test('same-heartbeat source-only activation rollover needs independent intent and retains prior bytes', t => {
  const root = rootFixture(t);
  const f = registrationFixture(root);
  run(root, ['native-source-mode', '--file', f.mode]);
  const activationPath = join(root, 'bridge-activation.json');
  write(activationPath, { automation_id: 'dot-native-source', native_binding_sha256: '0'.repeat(64), owner, historical: true });
  const prior = readFileSync(activationPath);
  const intent = write(join(root, 'native-source', 'renewal.json'), { version: 1, owner, automation_id: 'dot-native-source',
    prior_activation_sha256: sha(prior), source_commit: 'a'.repeat(40) });
  const admissionPath = join(root, 'native-source-admission.json');
  const a = JSON.parse(readFileSync(admissionPath, 'utf8')); a.effects.RENEW_ACTIVATION = sha(readFileSync(intent)); write(admissionPath, a);
  const bindingPath = join(root, 'native-binding.json'); const b = JSON.parse(readFileSync(bindingPath, 'utf8'));
  b.native_source_admission.sha256 = sha(readFileSync(admissionPath)); write(bindingPath, b);
  const bodySha = sha(readFileSync(new URL('./bridge-runner.body.js', import.meta.url)));
  write(join(root, 'bridge-runner-pin.json'), { version: 1, sha256: bodySha, source_commit: b.source_commit });
  const bootstrap = run(root, ['bridge-bootstrap', '--expected-sha256', bodySha, '--binding-sha256', sha(readFileSync(bindingPath))]).value;
  writeFileSync(join(root, 'native-bootstrap.js'), bootstrap.source, { mode: 0o700 });
  const toml = join(root, 'automation.toml');
  writeFileSync(toml, 'id = "dot-native-source"\nkind = "heartbeat"\nstatus = "ACTIVE"\nrrule = "FREQ=HOURLY;INTERVAL=4"\ntarget_thread_id = "' + owner + '"\nprompt = "Run ' + bootstrap.source_sha256 + '"\n', { mode: 0o600 });
  const receipt = write(join(root, 'native-source', 'activation.json'), { version: 1, automation_id: 'dot-native-source', status: 'ACTIVE', kind: 'heartbeat', owner,
    interval_seconds: 14400, native_binding_sha256: sha(readFileSync(bindingPath)), bootstrap_sha256: bootstrap.source_sha256,
    automation_source: { path: toml, sha256: sha(readFileSync(toml)) } });
  const args = ['bridge-activated', '--automation-id', 'dot-native-source', '--receipt-file', receipt];
  assert.equal(run(root, args).value.code, 'AUTOMATION_CONFLICT');
  const invalidIntent = write(join(root, 'native-source', 'invented-renewal.json'), { version: 1 });
  assert.equal(run(root, [...args, '--renewal-file', invalidIntent]).value?.code, 'DOT_SOURCE_CONTROL_UNTRUSTED');
  const r = run(root, [...args, '--renewal-file', intent]);
  assert.equal(r.status, 0, JSON.stringify(r));
  assert.equal(r.value.renewed, true);
  assert.deepEqual(readFileSync(join(root, 'native-source', 'activation-history', sha(prior) + '.json')), prior);
  assert.equal(run(root, ['status']).value.bridge.active, true);
  assert.equal(run(root, ['status']).value.local_executor_admission, 'OFF');
});
