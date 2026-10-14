// Additive native source namespace. Originals never enter the legacy event,
// delivery or execution tables. Mutations reuse the enclosing ledger's tx.
import { exactNativeKeys, validateNativeReview, verifyNativeOriginal } from './native-source.mjs';
import { digest } from './contract.mjs';
const reject = code => { throw Object.assign(new Error(code), { code }); };
const captureDigest = report => digest(['execution_id', 'session_id', 'solution_sha256', 'artifact_sha256', 'source_tree_digest', 'head_sha', 'pr_url'].map(k => report[k]));
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
        const prior = db.prepare('SELECT * FROM native_reviews WHERE review_id=?').get(review.review_id);
        if (prior) {
          if (prior.request_id !== request.request_id || prior.source_sha256 !== receipt.source.sha256) reject('DOT_REVIEW_IMMUTABLE');
          return { replay: true };
        }
        db.prepare('INSERT INTO native_reviews VALUES (?,?,?,?,?)').run(review.review_id, request.request_id, receipt.source.sha256, review.decision, JSON.stringify(review));
        api._audit('DOT_REVIEW_SOURCE_VERIFIED', review.review_id, { execution_id: receipt.execution_id, head_sha: review.head_sha, decision: review.decision });
        return { replay: false };
      });
      // This internal v2 normalization is reachable only after the exact v1
      // native GO source was verified. The legacy CLI still cannot import v2.
      const derived = review.decision === 'GO' ? { version: 2, execution_id: report.execution_id, reviewer: binding.producer,
        verdict: 'APPROVE', dot_go: true, session_id: report.session_id, head_sha: report.head_sha,
        solution_sha256: report.solution_sha256, artifact_sha256: report.artifact_sha256, source_tree_digest: report.source_tree_digest,
        repository: request.repository, pr_number: request.pr, base_sha: request.base_sha, policy: request.policy,
        source: { reference: receipt.source.reference, sha256: receipt.source.sha256 } } : null;
      return { ...result, review, receipt: derived };
    },
    retain({ binding, descriptor, access, bytes, kind, generation, sourceReadSha256 }) {
      verifyNativeOriginal(bytes, descriptor, access, binding);
      if (!/^[0-9a-f]{64}$/.test(sourceReadSha256 ?? '')) reject('DOT_SOURCE_ACCESS_UNPROVEN');
      return api._tx(() => {
        if (api._ctrl('source_mode') !== 'SOURCE_ONLY') reject('SOURCE_ONLY_REQUIRED');
        const current = this.getBinding();
        if (!current || current.sha256 !== binding.sha256) reject('DOT_SOURCE_UNTRUSTED');
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
