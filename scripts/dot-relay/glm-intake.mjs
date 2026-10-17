// GLM instruction-packet intake. Prospective receiver for cloud-prepared
// instruction packets once their bodies are materialized and hash-bound: one
// source-bound task per packet, one immutable executor report per task, exact
// HEAD review requests on the shared native governance. The relay never
// interprets payloads, never dispatches and never merges; a GO is recorded
// for the coordinator/operator, never applied.
import { randomUUID } from 'node:crypto';
import { exactNativeKeys } from './native-source.mjs';
import { recordReview } from './native-source-store.mjs';
import { digest, envelopeDigest, REVIEW_VERIFY_BUDGET_MS } from './contract.mjs';
import { parseStrictJson } from '../dot-review-gate/strict-json.mjs';

const reject = (code) => { throw Object.assign(new Error(code), { code }); };
const hash64 = /^[0-9a-f]{64}$/;
const head40 = /^[0-9a-f]{40}$/;
const idRe = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/;
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SOLUTION_KEYS = ['version', 'kind', 'id', 'producer', 'parents', 'payload', 'sha256'];
const CORRECTION_FORMATS = ['dot-correction-instructions-v1', 'dot.executable-correction-instructions.v1'];
// The capture tuple mirrors native-source-store: the glm task id stands in for
// the legacy execution id, so a drifted report invalidates the old request
// under the same conflict fence.
const captureDigest = (task, report) => digest([task.task_id, report.session_id, report.solution_sha256,
  report.artifact_sha256, report.source_tree_digest, report.head_sha, report.pr_url]);

// Exact format discriminator over retained original bytes. Payloads stay
// opaque: the intake proves shape, self-digest and PR binding — it never
// interprets instruction content or converts a ready flag into authority.
export function validateInstructionPacket(text) {
  if (typeof text !== 'string' || text.length < 2) reject('DOT_SOURCE_UNTRUSTED');
  let v = null;
  try { v = parseStrictJson(text, { maxBytes: 1048576 }); } catch { v = null; }
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    if (v.kind === 'solution') {
      exactNativeKeys(v, SOLUTION_KEYS);
      if (v.version !== 1 || !idRe.test(v.id ?? '') || typeof v.producer !== 'string'
        || !(uuidRe.test(v.producer) || v.producer === 'DOT_GETFF_PRIMARY')
        || !Array.isArray(v.parents) || v.parents.length > 16 || !v.payload || typeof v.payload !== 'object' || Array.isArray(v.payload)
        || !hash64.test(v.sha256 ?? '') || envelopeDigest(v) !== v.sha256) reject('DOT_SOURCE_UNTRUSTED');
      for (const p of v.parents) {
        exactNativeKeys(p, ['id', 'sha256']);
        if (!idRe.test(p.id ?? '') || !hash64.test(p.sha256 ?? '')) reject('DOT_SOURCE_UNTRUSTED');
      }
      return { kind: 'dot_instruction_packet', instruction_kind: 'solution', generation: v.id };
    }
    if (CORRECTION_FORMATS.includes(v.format)) {
      const prUrl = `https://github.com/${v.repository}/pull/${v.pr}`;
      if (!idRe.test(v.id ?? '') || v.repository !== 'artyhoo/getff' || !Number.isSafeInteger(v.pr) || v.pr < 1
        || (v.pr_url !== undefined && v.pr_url !== prUrl) || typeof v.branch !== 'string' || !v.branch
        || typeof v.language !== 'string' || !v.language) reject('DOT_SOURCE_UNTRUSTED');
      return { kind: 'dot_instruction_packet', instruction_kind: 'correction', generation: v.id };
    }
    if (v.schema === 'DOT-INDEPENDENT-PR-REVIEW-v1') {
      if (v.repository !== 'artyhoo/getff' || !Number.isSafeInteger(v.pr) || v.pr < 1
        || typeof v.verdict !== 'string' || !Array.isArray(v.findings)) reject('DOT_SOURCE_UNTRUSTED');
      return { kind: 'dot_page_review_packet', generation: `DOT-PAGE-REVIEW-PR${v.pr}` };
    }
    reject('DOT_SOURCE_UNTRUSTED');
  }
  // Legacy markdown correction packet (closed header contract).
  if (/^# PR\d+ exact-head correction instructions, revision \d+\n/.test(text)) {
    const id = /^Packet ID: (\S+)$/m.exec(text)?.[1];
    const repo = /^- Repository: .+\(artyhoo\/getff\)$/m.test(text);
    const pr = /^- Existing PR: https:\/\/github\.com\/artyhoo\/getff\/pull\/\d+$/m.test(text);
    if (!idRe.test(id ?? '') || !repo || !pr) reject('DOT_SOURCE_UNTRUSTED');
    return { kind: 'dot_instruction_packet', instruction_kind: 'correction-markdown', generation: id };
  }
  reject('DOT_SOURCE_UNTRUSTED');
}

export function glmExecutorShape(executor) {
  exactNativeKeys(executor, ['launcher', 'model', 'permission_mode', 'supervisor', 'session_id']);
  if (!uuidRe.test(executor.supervisor ?? '') || !uuidRe.test(executor.session_id ?? '')
    || typeof executor.launcher !== 'string' || !executor.launcher.startsWith('/')
    || executor.launcher.includes('..') || typeof executor.model !== 'string' || !executor.model || executor.model.length > 64
    || typeof executor.permission_mode !== 'string' || !/^[a-z][a-z-]{1,31}$/.test(executor.permission_mode)) reject('GLM_INTAKE_UNPROVEN');
}

export function glmCheckoutShape(checkout) {
  exactNativeKeys(checkout, ['repository', 'branch', 'base_sha']);
  if (checkout.repository !== 'artyhoo/getff' || typeof checkout.branch !== 'string'
    || !/^[A-Za-z0-9][A-Za-z0-9_./-]{0,127}$/.test(checkout.branch) || checkout.branch.includes('..')
    || !head40.test(checkout.base_sha ?? '')) reject('GLM_INTAKE_UNPROVEN');
}

export function glmReportShape(report) {
  exactNativeKeys(report, ['version', 'status', 'session_id', 'solution_sha256', 'artifact_sha256', 'source_tree_digest', 'head_sha', 'pr_url', 'notes']);
  if (report.version !== 1 || !['CODE_COMPLETE', 'PARTIAL', 'BLOCKED'].includes(report.status)
    || !uuidRe.test(report.session_id ?? '') || !hash64.test(report.solution_sha256 ?? '') || !hash64.test(report.artifact_sha256 ?? '')
    || !hash64.test(report.source_tree_digest ?? '') || !head40.test(report.head_sha ?? '')
    || !/^https:\/\/github\.com\/artyhoo\/getff\/pull\/[1-9]\d*$/.test(report.pr_url ?? '')
    || (report.notes !== null && (typeof report.notes !== 'string' || report.notes.length > 65536))) reject('GLM_REPORT_UNPROVEN');
}

// Additive GLM task namespace: never touches the legacy event, delivery,
// execution or review-receipt tables. Mutations reuse the enclosing ledger tx.
export function glmIntakeStore(db, api) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS glm_tasks (
      task_id TEXT PRIMARY KEY,
      source_sha256 TEXT NOT NULL UNIQUE,
      instruction_kind TEXT NOT NULL,
      generation TEXT NOT NULL,
      intake_sha256 TEXT NOT NULL,
      admission_sha256 TEXT NOT NULL,
      executor_json TEXT NOT NULL,
      checkout_json TEXT NOT NULL,
      state TEXT NOT NULL,
      report_json TEXT,
      reported_ms INTEGER
    );
    CREATE TABLE IF NOT EXISTS glm_review_verify_budget (
      task_id TEXT PRIMARY KEY, budget_ms INTEGER NOT NULL, spent_ms INTEGER NOT NULL, allocated_ms INTEGER NOT NULL
    );
  `);
  const rowToTask = (r) => r ? { task_id: r.task_id, source_sha256: r.source_sha256, instruction_kind: r.instruction_kind,
    generation: r.generation, intake_sha256: r.intake_sha256, admission_sha256: r.admission_sha256,
    executor: JSON.parse(r.executor_json), checkout: JSON.parse(r.checkout_json), state: r.state,
    report: r.report_json ? JSON.parse(r.report_json) : null, reported_ms: r.reported_ms } : null;
  return {
    getTask(taskId) {
      const r = db.prepare('SELECT * FROM glm_tasks WHERE task_id=?').get(taskId);
      return rowToTask(r);
    },
    // One task per packet source: the binding is ingest-once, so a re-issued
    // or mutated packet under the same source digest can never fork a second
    // executor assignment.
    bind({ source, parsed, intakeSha256, admissionSha256, executor, checkout }) {
      glmExecutorShape(executor);
      glmCheckoutShape(checkout);
      return api._tx(() => {
        const prior = db.prepare('SELECT task_id FROM glm_tasks WHERE source_sha256=?').get(source.sha256);
        if (prior) reject('GLM_TASK_ALREADY_BOUND');
        const taskId = 'GLM-TASK-' + randomUUID();
        db.prepare('INSERT INTO glm_tasks VALUES (?,?,?,?,?,?,?,?,?,NULL,NULL)').run(taskId, source.sha256,
          parsed.instruction_kind, parsed.generation, intakeSha256, admissionSha256,
          JSON.stringify(executor), JSON.stringify(checkout), 'BOUND');
        api._audit('GLM_TASK_BOUND', taskId, { source_sha256: source.sha256, instruction_kind: parsed.instruction_kind });
        return { task_id: taskId, state: 'BOUND', source_sha256: source.sha256, instruction_kind: parsed.instruction_kind };
      });
    },
    report({ taskId, report }) {
      glmReportShape(report);
      return api._tx(() => {
        const r = db.prepare('SELECT * FROM glm_tasks WHERE task_id=?').get(taskId);
        const task = rowToTask(r);
        if (!task) reject('GLM_TASK_UNKNOWN');
        if (task.state !== 'BOUND') reject('GLM_TASK_IMMUTABLE');
        if (report.session_id !== task.executor.session_id) reject('GLM_EXECUTOR_MISMATCH');
        if (report.solution_sha256 !== task.source_sha256) reject('GLM_REPORT_MISMATCH');
        db.prepare('UPDATE glm_tasks SET state=?, report_json=?, reported_ms=? WHERE task_id=?')
          .run('REPORTED', JSON.stringify(report), Date.now(), taskId);
        api._audit('GLM_TASK_REPORTED', taskId, { head_sha: report.head_sha, status: report.status });
        return { task_id: taskId, state: 'REPORTED' };
      });
    },
    // F12 parity for GLM tasks: a finite, never-replenished verification
    // budget keyed by task instead of legacy execution.
    reviewBudget({ taskId }) {
      const task = db.prepare('SELECT task_id FROM glm_tasks WHERE task_id=?').get(taskId);
      if (!task) return { missing: 'task' };
      db.prepare('INSERT OR IGNORE INTO glm_review_verify_budget (task_id, budget_ms, spent_ms, allocated_ms) VALUES (?,?,0,?)')
        .run(taskId, REVIEW_VERIFY_BUDGET_MS, Date.now());
      const row = db.prepare('SELECT budget_ms, spent_ms FROM glm_review_verify_budget WHERE task_id=?').get(taskId);
      if (!row) return null;
      return { budget_ms: row.budget_ms, spent_ms: row.spent_ms };
    },
    chargeReviewBudget({ taskId, additionalMs }) {
      if (!Number.isSafeInteger(additionalMs) || additionalMs <= 0) return null;
      const res = db.prepare('UPDATE glm_review_verify_budget SET spent_ms = MIN(budget_ms, spent_ms + ?) WHERE task_id = ?')
        .run(additionalMs, taskId);
      if (res.changes === 0) return null;
      return db.prepare('SELECT budget_ms, spent_ms FROM glm_review_verify_budget WHERE task_id=?').get(taskId);
    },
    // Exact-HEAD review request persisted under the SAME governance table as
    // legacy requests: request ids are unique, (task, head, epoch) is the
    // conflict fence, and the capture tuple pins the executor report.
    requestReview({ task, request }) {
      exactNativeKeys(request, ['version', 'request_id', 'execution_id', 'repository', 'pr', 'head_sha', 'base_sha', 'epoch', 'source_binding_sha256', 'policy', 'required_evidence_sha256']);
      const binding = api.nativeSources.getBinding();
      const report = task.report;
      if (!binding || !report || task.state !== 'REPORTED') reject('GLM_TASK_NOT_REPORTED');
      if (report.status !== 'CODE_COMPLETE') reject('GLM_TASK_NOT_COMPLETE');
      if (request.version !== 1 || request.execution_id !== task.task_id || request.epoch !== binding.epoch
        || request.source_binding_sha256 !== binding.sha256 || request.repository !== 'artyhoo/getff'
        || !Number.isSafeInteger(request.pr) || request.pr < 1
        || report.pr_url !== `https://github.com/${request.repository}/pull/${request.pr}` || report.head_sha !== request.head_sha
        || !idRe.test(request.request_id ?? '') || !head40.test(request.head_sha ?? '') || !head40.test(request.base_sha ?? '')
        || !hash64.test(request.required_evidence_sha256 ?? '')) reject('DOT_REVIEW_REQUEST_UNPROVEN');
      exactNativeKeys(request.policy, ['version', 'digest']);
      if (!Number.isSafeInteger(request.policy.version) || request.policy.version < 1 || !hash64.test(request.policy.digest ?? '')) reject('DOT_REVIEW_REQUEST_UNPROVEN');
      return api._tx(() => {
        const old = db.prepare('SELECT request_json,capture_sha256 FROM native_review_requests WHERE execution_id=? AND head_sha=? AND epoch=?')
          .get(task.task_id, request.head_sha, request.epoch);
        if (old) {
          const previous = JSON.parse(old.request_json);
          if (previous.base_sha !== request.base_sha || digest(previous.policy) !== digest(request.policy)
            || old.capture_sha256 !== captureDigest(task, report)) reject('DOT_REVIEW_REQUEST_CONFLICT');
          return { replay: true, request: previous };
        }
        db.prepare('INSERT INTO native_review_requests VALUES (?,?,?,?,?,?)').run(request.request_id, request.execution_id,
          request.head_sha, request.epoch, JSON.stringify(request), captureDigest(task, report));
        api._audit('DOT_REVIEW_REQUEST_BOUND', request.request_id, { execution_id: request.execution_id, head_sha: request.head_sha });
        return { replay: false, request };
      });
    },
    // Records a verified v1 dot_head_review for a GLM task. Unlike the legacy
    // approval path this NEVER derives a v2 receipt and NEVER applies: a GO is
    // durable history for the coordinator/operator, and a verified NEEDS_FIX
    // blocks every conflicting same-request GO through the shared scan.
    approvalRecord({ task, request, review, sourceSha256 }) {
      if (!task || task.state !== 'REPORTED' || request.execution_id !== task.task_id) reject('DOT_APPROVAL_UNPROVEN');
      return api._tx(() => {
        const rec = recordReview(db, api, review, sourceSha256);
        return { replay: rec.replay, blocking: api.nativeSources.blockingReview(request.request_id) };
      });
    },
  };
}
