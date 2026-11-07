import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { openLedger } from './ledger.mjs';
import { envelopeDigest } from './contract.mjs';

// GLM instruction-packet intake: a source-bound task namespace for admitted
// instruction packets. One task per packet source, one report per task, exact
// HEAD review requests on the shared native governance — the executor never
// merges and a GO is recorded, never applied.
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
  const registration = write(join(root, 'native-source', 'registration.json'), { version: 1, owner, producer: 'DOT_GETFF_PRIMARY', epoch, page_id: page,
    challenge: descriptor, access, local_source_path: source });
  const mode = write(join(root, 'native-source', 'mode.json'), { version: 1, owner, mode: 'SOURCE_ONLY' });
  nativeAdmission(root, { SOURCE_ONLY: mode, REGISTER_NATIVE_DOT: registration });
  admitSourceRead(root, descriptor);
  return { registration, mode, descriptor, access, source, text };
}
const executor = { launcher: '/Users/art/.local/bin/glm', model: 'glm-5.3', permission_mode: 'auto',
  supervisor: owner, session_id: 'c9cf625a-2ff5-4f52-bd67-a1878e0c5f79' };
const checkout = { repository: 'artyhoo/getff', branch: 'codex/dot-glm-corrections', base_sha: '9'.repeat(40) };
function instructionFixture(root, kind) {
  mkdirSync(join(root, 'native-source', 'verified'), { recursive: true, mode: 0o700 });
  let text;
  if (kind === 'solution') {
    const env = { version: 1, kind: 'solution', id: 'DOT-SOLUTION-TEST-' + kind + ':r1', producer: 'DOT_GETFF_PRIMARY',
      parents: [{ id: 'DOT-CLOUD-ANALYSIS-0001', sha256: '3'.repeat(64) }],
      payload: { candidate_id: 'DOT-CANDIDATE-TEST', finding_keys: ['dot/TEST'], steps: [] }, sha256: '' };
    env.sha256 = envelopeDigest(env);
    text = JSON.stringify(env);
  } else if (kind === 'correction') {
    text = JSON.stringify({ format: 'dot.executable-correction-instructions.v1', id: 'DOT-CORRECTION-TEST-' + kind + ':r1', language: 'en',
      repository: 'artyhoo/getff', pr: 2106, pr_url: 'https://github.com/artyhoo/getff/pull/2106', branch: 'codex/dot-glm-corrections', ready: true, steps: [] });
  } else {
    text = JSON.stringify({ schema: 'DOT-INDEPENDENT-PR-REVIEW-v1', repository: 'artyhoo/getff', pr: 2106,
      verdict: 'CHANGES_REQUIRED', findings: [{ id: 'TEST-F1', severity: 'MAJOR' }] });
  }
  const source = join(root, 'native-source', 'verified', kind + '.json');
  writeFileSync(source, text, { mode: 0o600 });
  const descriptor = { page_id: page, reference: 'library-file:synthetic-' + kind, sha256: sha(text), bytes: Buffer.byteLength(text) };
  admitSourceRead(root, descriptor);
  const file = write(join(root, 'native-source', 'import-' + kind + '.json'), { version: 1, source: descriptor,
    access: { kind: 'text', text_representation: 'source', ...descriptor }, local_source_path: source });
  return { file, descriptor, source, text };
}
// patch is applied BEFORE the GLM_TASK_INTAKE admission effect is computed, so
// the effect always covers the exact bytes under test.
function intakeFixture(root, packet, patch = {}) {
  const source = patch.source ?? packet.descriptor;
  const value = { version: 1, owner, source, access: patch.access ?? { kind: 'text', text_representation: 'source', ...source },
    local_source_path: patch.local_source_path ?? packet.source,
    executor: { ...executor, ...(patch.executor ?? {}) }, checkout: { ...checkout, ...(patch.checkout ?? {}) } };
  const file = write(join(root, 'native-source', 'glm-intake.json'), value);
  const admissionPath = join(root, 'native-source-admission.json');
  const a = JSON.parse(readFileSync(admissionPath, 'utf8'));
  a.effects.GLM_TASK_INTAKE = sha(readFileSync(file));
  write(admissionPath, a);
  const bindingPath = join(root, 'native-binding.json');
  const b = JSON.parse(readFileSync(bindingPath, 'utf8'));
  b.native_source_admission.sha256 = sha(readFileSync(admissionPath));
  write(bindingPath, b);
  return file;
}
function glmFixture(t, kind = 'solution') {
  const root = rootFixture(t);
  const f = registrationFixture(root);
  const policy = write(join(root, 'native-source', 'policy.json'), { version: 1, digest: '4'.repeat(64),
    required: [{ name: 'ci-success', workflow: 'CI', app: 'github-actions' }] });
  nativeAdmission(root, { SOURCE_ONLY: f.mode, REGISTER_NATIVE_DOT: f.registration, CHECK_POLICY: policy });
  admitSourceRead(root, f.descriptor);
  assert.equal(run(root, ['native-source-mode', '--file', f.mode]).status, 0);
  assert.equal(run(root, ['native-source-register', '--file', f.registration]).status, 0);
  const packet = instructionFixture(root, kind);
  assert.equal(run(root, ['native-source-import', '--file', packet.file]).status, 0, 'packet import must succeed first');
  return { root, f, policy, packet };
}
function glmReport(root, packet, patch = {}) {
  return { version: 1, status: 'CODE_COMPLETE', session_id: executor.session_id, solution_sha256: packet.descriptor.sha256,
    artifact_sha256: '2'.repeat(64), source_tree_digest: '3'.repeat(64), head_sha: 'a'.repeat(40),
    pr_url: 'https://github.com/artyhoo/getff/pull/2106', notes: null, ...patch };
}
function reportFile(root, report) {
  mkdirSync(join(root, 'glm-reports'), { recursive: true, mode: 0o700 });
  return write(join(root, 'glm-reports', 'report.json'), report);
}
function ghShim(root, report) {
  const bin = join(root, 'bin'); mkdirSync(bin);
  const link = 'https://github.com/artyhoo/getff/actions/runs/123/job/456';
  const ghData = join(root, 'gh-data.json');
  write(ghData, { view: { headRefOid: report.head_sha, baseRefOid: 'b'.repeat(40), baseRefName: 'staging', state: 'OPEN',
    isDraft: false, mergeStateStatus: 'CLEAN', autoMergeRequest: null },
    checks: [{ name: 'ci-success', workflow: 'CI', state: 'SUCCESS', bucket: 'pass', link }],
    runs: { total_count: 1, check_runs: [{ id: 456, head_sha: report.head_sha, name: 'ci-success', status: 'completed',
      conclusion: 'success', details_url: link, app: { slug: 'github-actions', id: 15368 } }] } });
  writeFileSync(join(bin, 'gh'), '#!' + process.execPath + '\nimport{readFileSync}from"node:fs";const s=JSON.parse(readFileSync(' + JSON.stringify(ghData) + ',"utf8"));const a=process.argv.slice(2);if(s.offline&&a[1]==="checks")process.exit(2);process.stdout.write(JSON.stringify(a[0]==="api"?s.runs:a[1]==="checks"?s.checks:s.view));\n', { mode: 0o700 });
  return { PATH: bin + ':' + process.env.PATH, ghData };
}
function run(root, args, env = {}) {
  const r = spawnSync(process.execPath, [CLI, ...args, '--root', root], { encoding: 'utf8', env: { ...process.env, NODE_NO_WARNINGS: '1', ...env } });
  return { status: r.status, value: r.stdout ? JSON.parse(r.stdout) : null, error: r.stderr };
}
function rootFixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'dot-glm-intake-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  assert.equal(run(root, ['init']).status, 0);
  return root;
}

test('native-source-import retains solution and correction packets as dot_instruction_packet originals', t => {
  const root = rootFixture(t);
  const f = registrationFixture(root);
  assert.equal(run(root, ['native-source-mode', '--file', f.mode]).status, 0);
  assert.equal(run(root, ['native-source-register', '--file', f.registration]).status, 0);
  for (const kind of ['solution', 'correction']) {
    const packet = instructionFixture(root, kind);
    const r = run(root, ['native-source-import', '--file', packet.file]);
    assert.equal(r.status, 0, JSON.stringify(r));
    assert.equal(r.value.kind, 'dot_instruction_packet');
    assert.equal(run(root, ['native-source-import', '--file', packet.file]).value.replay, true);
  }
  const l = openLedger(join(root, 'ledger.sqlite'));
  t.after(() => l.close());
  for (const kind of ['solution', 'correction']) {
    const packet = instructionFixture(root, kind);
    const stored = l.nativeSources.getSource(packet.descriptor.sha256);
    assert.equal(stored.kind, 'dot_instruction_packet');
    assert.equal(stored.original_bytes.toString(), packet.text);
  }
  assert.equal(l.status().local_executor_admission, 'OFF', 'intake never flips executor admission');
  assert.equal(l.status().counts.outbox_total, 0, 'intake emits nothing');
});

test('retained page review packets never become approval authority', t => {
  const root = rootFixture(t);
  const f = registrationFixture(root);
  run(root, ['native-source-mode', '--file', f.mode]);
  assert.equal(run(root, ['native-source-register', '--file', f.registration]).status, 0);
  const packet = instructionFixture(root, 'review');
  const r = run(root, ['native-source-import', '--file', packet.file]);
  assert.equal(r.status, 0, JSON.stringify(r));
  assert.equal(r.value.kind, 'dot_page_review_packet');
  const l = openLedger(join(root, 'ledger.sqlite'));
  t.after(() => l.close());
  const binding = l.nativeSources.getBinding();
  assert.throws(() => l.nativeSources.approval({ receipt: { version: 1, execution_id: 'GLM-TASK-x', request_id: 'r',
    source_binding_sha256: binding.sha256, source: packet.descriptor }, currentHead: 'a'.repeat(40) }), e => e.code === 'DOT_APPROVAL_UNPROVEN');
});

test('glm-task-bind admits one task per packet with pinned executor and checkout', t => {
  const { root, packet } = glmFixture(t);
  const intake = intakeFixture(root, packet);
  const r = run(root, ['glm-task-bind', '--file', intake]);
  assert.equal(r.status, 0, JSON.stringify(r));
  assert.match(r.value.task_id, /^GLM-TASK-/);
  assert.equal(r.value.state, 'BOUND');
  assert.equal(run(root, ['glm-task-bind', '--file', intake]).value.code, 'GLM_TASK_ALREADY_BOUND');
  const l = openLedger(join(root, 'ledger.sqlite'));
  t.after(() => l.close());
  const task = l.glmTasks.getTask(r.value.task_id);
  assert.equal(task.source_sha256, packet.descriptor.sha256);
  assert.equal(task.executor.session_id, executor.session_id);
  assert.equal(task.checkout.branch, checkout.branch);
});

test('glm-task-bind refuses review packets, unproven admission and unknown sources', t => {
  const good = glmFixture(t);
  const reviewPacket = instructionFixture(good.root, 'review');
  assert.equal(run(good.root, ['native-source-import', '--file', reviewPacket.file]).status, 0);
  assert.equal(run(good.root, ['glm-task-bind', '--file', intakeFixture(good.root, reviewPacket)]).value.code, 'GLM_PACKET_NOT_INSTRUCTION');

  const { root, packet } = glmFixture(t);
  const unknown = 'e'.repeat(64);
  assert.equal(run(root, ['glm-task-bind', '--file', intakeFixture(root, packet,
    { source: { ...packet.descriptor, sha256: unknown }, access: { kind: 'text', text_representation: 'source', ...packet.descriptor, sha256: unknown } })]).value.code, 'GLM_SOURCE_UNKNOWN');
  const drifted = intakeFixture(root, packet);
  const d = JSON.parse(readFileSync(drifted, 'utf8'));
  d.checkout = { ...checkout, branch: 'codex/other-branch' };
  write(drifted, d);
  assert.equal(run(root, ['glm-task-bind', '--file', drifted]).value.code, 'DOT_SOURCE_CONTROL_UNTRUSTED');
});

test('glm-task-report accepts only the bound executor session and is immutable', t => {
  const { root, packet } = glmFixture(t);
  const task = run(root, ['glm-task-bind', '--file', intakeFixture(root, packet)]).value;
  const wrong = reportFile(root, glmReport(root, packet, { session_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' }));
  assert.equal(run(root, ['glm-task-report', '--task-id', task.task_id, '--file', wrong]).value.code, 'GLM_EXECUTOR_MISMATCH');
  const file = reportFile(root, glmReport(root, packet));
  const r = run(root, ['glm-task-report', '--task-id', task.task_id, '--file', file]);
  assert.equal(r.status, 0, JSON.stringify(r));
  assert.equal(r.value.state, 'REPORTED');
  assert.equal(run(root, ['glm-task-report', '--task-id', task.task_id, '--file', file]).value.code, 'GLM_TASK_IMMUTABLE');
  const { root: root2, packet: packet2 } = glmFixture(t);
  const task2 = run(root2, ['glm-task-bind', '--file', intakeFixture(root2, packet2)]).value;
  assert.equal(run(root2, ['glm-task-report', '--task-id', task2.task_id, '--file',
    reportFile(root2, glmReport(root2, packet2, { solution_sha256: '5'.repeat(64) }))]).value.code, 'GLM_REPORT_MISMATCH');
});

test('glm-review-request holds an unreported or incomplete task', t => {
  const { root, packet } = glmFixture(t);
  const task = run(root, ['glm-task-bind', '--file', intakeFixture(root, packet)]).value;
  const env = ghShim(root, glmReport(root, packet));
  assert.equal(run(root, ['glm-review-request', '--task-id', task.task_id], env).value.code, 'GLM_TASK_NOT_REPORTED');
  const { root: root2, packet: packet2 } = glmFixture(t);
  const task2 = run(root2, ['glm-task-bind', '--file', intakeFixture(root2, packet2)]).value;
  run(root2, ['glm-task-report', '--task-id', task2.task_id, '--file', reportFile(root2, glmReport(root2, packet2, { status: 'BLOCKED' }))]);
  assert.equal(run(root2, ['glm-review-request', '--task-id', task2.task_id], ghShim(root2, glmReport(root2, packet2))).value.code, 'GLM_TASK_NOT_COMPLETE');
});

test('glm-review-request binds an exact-head request under the shared native governance', t => {
  const { root, packet } = glmFixture(t);
  const task = run(root, ['glm-task-bind', '--file', intakeFixture(root, packet)]).value;
  const report = glmReport(root, packet);
  run(root, ['glm-task-report', '--task-id', task.task_id, '--file', reportFile(root, report)]);
  const env = ghShim(root, report);
  const r = run(root, ['glm-review-request', '--task-id', task.task_id], env);
  assert.equal(r.status, 0, JSON.stringify(r));
  assert.ok(r.value.request, JSON.stringify(r));
  assert.equal(r.value.transport, 'NOT_SENT');
  const request = r.value.request;
  assert.equal(request.execution_id, task.task_id);
  assert.equal(run(root, ['glm-review-request', '--task-id', task.task_id], env).value.replay, true);
  const l = openLedger(join(root, 'ledger.sqlite'));
  t.after(() => l.close());
  assert.deepEqual(l.nativeSources.getRequest(request.request_id), request);
  // Live head drift refuses a fresh authorization for the same PR.
  const data = JSON.parse(readFileSync(join(root, 'gh-data.json')));
  data.view.headRefOid = 'f'.repeat(40);
  write(join(root, 'gh-data.json'), data);
  assert.equal(run(root, ['glm-review-request', '--task-id', task.task_id], env).value.code, 'DOT_APPROVAL_STALE');
});

function headReviewOriginal(root, request, id, decision) {
  const review = { version: 1, kind: 'dot_head_review', producer: 'DOT_GETFF_PRIMARY', epoch, review_id: id,
    request_id: request.request_id, repository: request.repository, pr: request.pr, head_sha: request.head_sha,
    decision, decided_at: '2026-10-15T02:00:00Z', finding_count: decision === 'GO' ? 0 : 1,
    findings_artifact: decision === 'GO' ? null : { page_id: page, reference: 'library-file:synthetic-findings', sha256: 'f'.repeat(64), bytes: 1 } };
  const text = JSON.stringify(review);
  const source = join(root, 'native-source', 'verified', id + '.json');
  writeFileSync(source, text, { mode: 0o600 });
  const descriptor = { page_id: page, reference: 'library-file:synthetic-' + id, sha256: sha(text), bytes: Buffer.byteLength(text) };
  admitSourceRead(root, descriptor);
  const file = write(join(root, 'native-source', 'import-' + id + '.json'), { version: 1, source: descriptor,
    access: { kind: 'text', text_representation: 'source', ...descriptor }, local_source_path: source });
  return { file, descriptor, source };
}

test('glm-approval-import records NEEDS_FIX durably and blocks the same-request GO', t => {
  const { root, packet } = glmFixture(t);
  const task = run(root, ['glm-task-bind', '--file', intakeFixture(root, packet)]).value;
  const report = glmReport(root, packet);
  run(root, ['glm-task-report', '--task-id', task.task_id, '--file', reportFile(root, report)]);
  const env = ghShim(root, report);
  const request = run(root, ['glm-review-request', '--task-id', task.task_id], env).value.request;
  const l = openLedger(join(root, 'ledger.sqlite'));
  const binding = l.nativeSources.getBinding();
  l.close();
  const approvalInput = item => write(join(root, 'native-source', 'glm-approval.json'), { version: 1, task_id: task.task_id,
    request_id: request.request_id, source_binding_sha256: binding.sha256, source: item.descriptor, local_source_path: item.source });
  const fix = headReviewOriginal(root, request, 'glm-fix-1', 'NEEDS_FIX');
  assert.equal(run(root, ['native-source-import', '--file', fix.file]).status, 0);
  const held = run(root, ['glm-approval-import', '--file', approvalInput(fix)], env);
  assert.equal(held.status, 0, JSON.stringify(held));
  assert.equal(held.value.state, 'HELD');
  assert.equal(held.value.blocker, 'DOT_NEEDS_FIX');
  const go = headReviewOriginal(root, request, 'glm-go-1', 'GO');
  assert.equal(run(root, ['native-source-import', '--file', go.file]).status, 0);
  const blocked = run(root, ['glm-approval-import', '--file', approvalInput(go)], env);
  assert.equal(blocked.value.state, 'HELD');
  assert.equal(blocked.value.blocker, 'DOT_NEEDS_FIX', 'same-request GO stays blocked by the verified finding');
});

test('glm-approval-import records GO without applying any execution or merge', t => {
  const { root, packet } = glmFixture(t);
  const task = run(root, ['glm-task-bind', '--file', intakeFixture(root, packet)]).value;
  const report = glmReport(root, packet);
  run(root, ['glm-task-report', '--task-id', task.task_id, '--file', reportFile(root, report)]);
  const env = ghShim(root, report);
  const request = run(root, ['glm-review-request', '--task-id', task.task_id], env).value.request;
  const l = openLedger(join(root, 'ledger.sqlite'));
  const binding = l.nativeSources.getBinding();
  l.close();
  const go = headReviewOriginal(root, request, 'glm-go-clean', 'GO');
  assert.equal(run(root, ['native-source-import', '--file', go.file]).status, 0);
  const input = write(join(root, 'native-source', 'glm-approval.json'), { version: 1, task_id: task.task_id,
    request_id: request.request_id, source_binding_sha256: binding.sha256, source: go.descriptor, local_source_path: go.source });
  const r = run(root, ['glm-approval-import', '--file', input], env);
  assert.equal(r.status, 0, JSON.stringify(r));
  assert.equal(r.value.state, 'RECORDED_GO');
  assert.equal(r.value.applied, false, 'a GLM task GO is recorded for the coordinator/operator, never applied');
  const after = openLedger(join(root, 'ledger.sqlite'));
  t.after(() => after.close());
  assert.equal(after.glmTasks.getTask(task.task_id).state, 'REPORTED', 'approval import does not mutate the task');
  const db = new DatabaseSync(join(root, 'ledger.sqlite'));
  assert.equal(db.prepare('SELECT count(*) AS n FROM executions').get().n, 0, 'no legacy execution is created');
  assert.equal(db.prepare('SELECT count(*) AS n FROM review_receipts').get().n, 0, 'no applied review receipt');
  db.close();
  assert.equal(run(root, ['glm-approval-import', '--file', input], env).value.replay, true);
});
