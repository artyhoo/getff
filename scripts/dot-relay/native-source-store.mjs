// Additive native source namespace. Originals never enter the legacy event,
// delivery or execution tables. Mutations reuse the enclosing ledger's tx.
import { exactNativeKeys, validateNativeReview, verifyNativeOriginal } from './native-source.mjs';
import { digest } from './contract.mjs';
const reject = code => { throw Object.assign(new Error(code), { code }); };
const captureDigest = report => digest(['execution_id', 'session_id', 'solution_sha256', 'artifact_sha256', 'source_tree_digest', 'head_sha', 'pr_url'].map(k => report[k]));
// Review IDs and originals remain immutable history. A verified finding
// binds the whole request; another GO cannot resolve it by arrival order
// or by a later timestamp. A fix needs a separately qualified request.
// Shared by the native store and the GLM intake store — one implementation,
// never duplicated, so the two review namespaces cannot drift.
export function recordReview(db, api, review, sourceSha256) {
  const prior = db.prepare('SELECT * FROM native_reviews WHERE review_id=?').get(review.review_id);
  if (prior) {
    if (prior.request_id !== review.request_id || prior.source_sha256 !== sourceSha256) reject('DOT_REVIEW_IMMUTABLE');
    return { replay: true };
  }
  db.prepare('INSERT INTO native_reviews VALUES (?,?,?,?,?)').run(review.review_id, review.request_id, sourceSha256, review.decision, JSON.stringify(review));
  api._audit('DOT_REVIEW_SOURCE_VERIFIED', review.review_id, { head_sha: review.head_sha, decision: review.decision });
  return { replay: false };
}
export function nativeSourceStore(db, api) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS native_source_binding (
      singleton INTEGER PRIMARY KEY CHECK(singleton=1), binding_json TEXT NOT NULL,
      registration_sha256 TEXT NOT NULL, admission_sha256 TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS native_sources (
      source_sha256 TEXT PRIMARY KEY, binding_sha256 TEXT NOT NULL,
      descriptor_json TEXT NOT NULL, access_json TEXT NOT NULL,
      kind TEXT NOT NULL, generation TEXT NOT NULL, original_bytes BLOB NOT NULL, source_read_sha256 TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS native_review_requests (
      request_id TEXT PRIMARY KEY, execution_id TEXT NOT NULL,
      head_sha TEXT NOT NULL, epoch TEXT NOT NULL, request_json TEXT NOT NULL, capture_sha256 TEXT NOT NULL,
      UNIQUE(execution_id, head_sha, epoch)
    );
    CREATE TABLE IF NOT EXISTS native_reviews (
      review_id TEXT PRIMARY KEY, request_id TEXT NOT NULL,
      source_sha256 TEXT NOT NULL, decision TEXT NOT NULL, review_json TEXT NOT NULL
    );
  `);
  return {
    getBinding() {
      const r = db.prepare('SELECT * FROM native_source_binding WHERE singleton=1').get();
      return r ? { ...JSON.parse(r.binding_json), sha256: r.registration_sha256 } : null;
    },
    register({ binding, registrationSha256, admissionSha256 }) {
      return api._tx(() => {
        if (api._ctrl('source_mode') !== 'SOURCE_ONLY') reject('SOURCE_ONLY_REQUIRED');
        const existing = db.prepare('SELECT * FROM native_source_binding WHERE singleton=1').get();
        if (existing) {
          if (existing.registration_sha256 === registrationSha256) return { replay: true };
          reject('DOT_SOURCE_BINDING_IMMUTABLE');
        }
        db.prepare('INSERT INTO native_source_binding VALUES (1,?,?,?)').run(JSON.stringify(binding), registrationSha256, admissionSha256);
        api._audit('NATIVE_SOURCE_REGISTERED', binding.producer, { registration_sha256: registrationSha256, admission_sha256: admissionSha256 });
        return { replay: false };
      });
    },
    getSource(sha256) {
      const r = db.prepare('SELECT * FROM native_sources WHERE source_sha256=?').get(sha256);
      return r ? { ...r, original_bytes: Buffer.from(r.original_bytes) } : null;
    },
    getRequest(requestId) {
      const r = db.prepare('SELECT request_json FROM native_review_requests WHERE request_id=?').get(requestId);
      return r ? JSON.parse(r.request_json) : null;
    },
    blockingReview(requestId) {
      const binding = this.getBinding();
      const request = this.getRequest(requestId);
      if (!binding || !request || request.source_binding_sha256 !== binding.sha256) reject('DOT_APPROVAL_UNPROVEN');
      // Include originals retained before this guard shipped, even if no
      // approval-import has yet projected them into native_reviews.
      const sources = db.prepare("SELECT original_bytes FROM native_sources WHERE kind='dot_head_review' AND binding_sha256=? ORDER BY source_sha256").all(binding.sha256);
      for (const source of sources) {
        const text = Buffer.from(source.original_bytes).toString('utf8');
        if (JSON.parse(text).request_id !== requestId) continue;
        const review = validateNativeReview(text, { binding, request, currentHead: request.head_sha });
        if (review.decision === 'NEEDS_FIX') return review;
      }
      return null;
    },
    assertApprovalCurrent(receipt) {
      if (typeof receipt?.source?.sha256 !== 'string') return; // Existing legacy schema/replay checks own this shape.
      const stored = this.getSource(receipt?.source?.sha256);
      if (!stored || stored.kind !== 'dot_head_review') return; // Legacy receipts keep their existing gates.
      const binding = this.getBinding();
      const requestId = JSON.parse(stored.original_bytes.toString('utf8')).request_id;
      const request = this.getRequest(requestId);
      if (!binding || !request || request.execution_id !== receipt.execution_id || stored.binding_sha256 !== binding.sha256
        || request.source_binding_sha256 !== binding.sha256 || receipt.source.reference !== JSON.parse(stored.descriptor_json).reference) reject('DOT_APPROVAL_UNPROVEN');
      const review = validateNativeReview(stored.original_bytes.toString('utf8'), { binding, request, currentHead: receipt.head_sha });
      if (review.decision !== 'GO') reject('DOT_NEEDS_FIX');
      if (this.blockingReview(requestId)) reject('DOT_NEEDS_FIX');
    },
    request({ request }) {
      exactNativeKeys(request, ['version', 'request_id', 'execution_id', 'repository', 'pr', 'head_sha', 'base_sha', 'epoch', 'source_binding_sha256', 'policy', 'required_evidence_sha256']);
      const b = this.getBinding();
      const report = api.getWorkerReport(request.execution_id);
      if (!b || !report || request.version !== 1 || request.epoch !== b.epoch || request.source_binding_sha256 !== b.sha256
        || request.repository !== 'artyhoo/getff' || !Number.isSafeInteger(request.pr) || request.pr < 1
        || report.pr_url !== `https://github.com/${request.repository}/pull/${request.pr}` || report.head_sha !== request.head_sha
        || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/.test(request.request_id ?? '')
        || !/^[0-9a-f]{40}$/.test(request.head_sha ?? '') || !/^[0-9a-f]{40}$/.test(request.base_sha ?? '')
        || !/^[0-9a-f]{64}$/.test(request.required_evidence_sha256 ?? '')) reject('DOT_REVIEW_REQUEST_UNPROVEN');
      exactNativeKeys(request.policy, ['version', 'digest']);
      if (!Number.isSafeInteger(request.policy.version) || request.policy.version < 1 || !/^[0-9a-f]{64}$/.test(request.policy.digest ?? '')) reject('DOT_REVIEW_REQUEST_UNPROVEN');
      return api._tx(() => {
        const old = db.prepare('SELECT request_json,capture_sha256 FROM native_review_requests WHERE execution_id=? AND head_sha=? AND epoch=?').get(request.execution_id, request.head_sha, request.epoch);
        if (old) {
          const previous = JSON.parse(old.request_json);
          // The persisted identity is reused; a moved base/policy may never
          // reinterpret a previous same-head request as a new authorization.
          if (previous.base_sha !== request.base_sha || digest(previous.policy) !== digest(request.policy) || old.capture_sha256 !== captureDigest(report)) reject('DOT_REVIEW_REQUEST_CONFLICT');
          return { replay: true, request: previous };
        }
        db.prepare('INSERT INTO native_review_requests VALUES (?,?,?,?,?,?)').run(request.request_id, request.execution_id, request.head_sha, request.epoch, JSON.stringify(request), captureDigest(report));
        api._audit('DOT_REVIEW_REQUEST_BOUND', request.request_id, { execution_id: request.execution_id, head_sha: request.head_sha });
        return { replay: false, request };
      });
    },
    approval({ receipt, currentHead }) {
      exactNativeKeys(receipt, ['version', 'execution_id', 'request_id', 'source_binding_sha256', 'source']);
      const binding = this.getBinding();
      const request = this.getRequest(receipt.request_id);
      const stored = this.getSource(receipt.source?.sha256);
      const report = api.getWorkerReport(receipt.execution_id);
      const requestRow = db.prepare('SELECT capture_sha256 FROM native_review_requests WHERE request_id=?').get(receipt.request_id);
      if (!binding || !request || !stored || !report || receipt.version !== 1 || stored.kind !== 'dot_head_review'
        || request.execution_id !== receipt.execution_id || request.source_binding_sha256 !== binding.sha256
        || receipt.source_binding_sha256 !== binding.sha256 || stored.binding_sha256 !== binding.sha256
        || digest(JSON.parse(stored.descriptor_json)) !== digest(receipt.source) || requestRow?.capture_sha256 !== captureDigest(report)
        || report.head_sha !== request.head_sha || report.pr_url !== `https://github.com/${request.repository}/pull/${request.pr}`) reject('DOT_APPROVAL_UNPROVEN');
      const review = validateNativeReview(stored.original_bytes.toString('utf8'), { binding, request, currentHead });
      const result = api._tx(() => {
        return { ...recordReview(db, api, review, receipt.source.sha256), blocking: this.blockingReview(request.request_id) };
      });
      // This internal v2 normalization is reachable only after the exact v1
      // native GO source was verified. The legacy CLI still cannot import v2.
      const derived = !result.blocking && review.decision === 'GO' ? { version: 2, execution_id: report.execution_id, reviewer: binding.producer,
        verdict: 'APPROVE', dot_go: true, session_id: report.session_id, head_sha: report.head_sha,
        solution_sha256: report.solution_sha256, artifact_sha256: report.artifact_sha256, source_tree_digest: report.source_tree_digest,
        repository: request.repository, pr_number: request.pr, base_sha: request.base_sha, policy: request.policy,
        source: { reference: receipt.source.reference, sha256: receipt.source.sha256 } } : null;
      return { replay: result.replay, review: result.blocking ?? review, receipt: derived };
    },
    retain({ binding, descriptor, access, bytes, kind, generation, sourceReadSha256 }) {
      verifyNativeOriginal(bytes, descriptor, access, binding);
      if (!/^[0-9a-f]{64}$/.test(sourceReadSha256 ?? '')) reject('DOT_SOURCE_ACCESS_UNPROVEN');
      return api._tx(() => {
        if (api._ctrl('source_mode') !== 'SOURCE_ONLY') reject('SOURCE_ONLY_REQUIRED');
        const current = this.getBinding();
        if (!current || current.sha256 !== binding.sha256) reject('DOT_SOURCE_UNTRUSTED');
        if (kind === 'dot_head_review') {
          const requestId = JSON.parse(bytes.toString('utf8')).request_id;
          const request = this.getRequest(requestId);
          if (!request) reject('DOT_REVIEW_REQUEST_UNPROVEN');
          const review = validateNativeReview(bytes.toString('utf8'), { binding, request, currentHead: request.head_sha });
          if (generation !== review.review_id) reject('DOT_REVIEW_IMMUTABLE');
          recordReview(db, api, review, descriptor.sha256);
        }
        const old = this.getSource(descriptor.sha256);
        if (old) {
          if (old.binding_sha256 !== binding.sha256 || old.source_read_sha256 !== sourceReadSha256 || !old.original_bytes.equals(bytes)) reject('DOT_SOURCE_CONFLICT');
          return { replay: true, source_sha256: descriptor.sha256 };
        }
        db.prepare('INSERT INTO native_sources VALUES (?,?,?,?,?,?,?,?)').run(descriptor.sha256, binding.sha256,
          JSON.stringify(descriptor), JSON.stringify(access), kind, generation, bytes, sourceReadSha256);
        api._audit('NATIVE_SOURCE_RETAINED', generation, { source_sha256: descriptor.sha256, bytes: descriptor.bytes, kind });
        return { replay: false, source_sha256: descriptor.sha256 };
      });
    },
  };
}
