// Canonical valid Dot review report fixtures — single source for every negative test.
//
// The admission shape must stay schema-valid AND semantically consistent (counts match
// arrays, times ordered, inventories cover the trusted policy fixture), because half the
// paired negatives work by mutating exactly one field and expecting the validator to
// reject the result. Two builders: admission (GO on the current tuple) and baseline
// (no PR, no merge revision). historical derives from admission by the documented
// kind nulls (schema §allOf: historical keeps pull_request, nulls tested_merge_sha).
//
// policy_sha256 in the report = policyDigestOf(makePolicyFixture()): the report must
// carry the digest of the ACTUAL trusted manifest, and tests that build a live state
// must use the same helper so tuple checks align (review R1).

import { createHash } from 'node:crypto';

export function policyDigestOf(policy = makePolicyFixture()) {
  return createHash('sha256').update(JSON.stringify(policy)).digest('hex');
}

export const SHA = {
  base: 'b'.repeat(40),
  head: 'c'.repeat(40),
  mergeBase: 'a'.repeat(40),
  merge: 'd'.repeat(40),
  blob: 'e'.repeat(40),
  workflow: 'f'.repeat(40),
  report: '1'.repeat(64),
  policy: '2'.repeat(64),
  principleInventory: '3'.repeat(64),
  specInventory: '4'.repeat(64),
};

export const POLICY_VERSION = '2026-10-05.1';

export const PRINCIPLE_INVENTORY = ['00-enforcement-not-attention', '08-prior-art-cited'];

export function makeEvidence(overrides = {}) {
  return {
    repository_id: 1231007068,
    commit_sha: SHA.head,
    path: 'packages/core/principles/44-x.test.ts',
    blob_sha: SHA.blob,
    line_start: 1,
    line_end: 2,
    explanation: 'cited lines carry the assessed requirement',
    trusted_run_or_report_id: null,
    ...overrides,
  };
}

export function makeAssessment(id, overrides = {}) {
  return {
    id,
    applicability: 'APPLICABLE',
    rationale: 'requirement assessed against the changed surface',
    result: 'PASS',
    evidence: [makeEvidence()],
    ...overrides,
  };
}

export function makeDimensions(overrides = {}) {
  const ids = [
    'goals', 'principles', 'standards', 'specification', 'correctness',
    'architecture', 'security', 'tests', 'self_application', 'build_vs_reuse',
    'documentation',
  ];
  return ids.map((id) => ({
    id,
    result: 'PASS',
    evidence: [makeEvidence()],
    rationale: 'dimension assessed over the full population',
    ...overrides[id],
  }));
}

export function makeAdmission(overrides = {}) {
  const report = {
    protocol_version: 'dot-staging-review/1.0',
    kind: 'admission',
    claim_id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    generation: 1,
    review_id: 'b3f2504e-4f89-41d3-9a0c-0305e82c3302',
    repository: { id: 1231007068, full_name: 'artyhoo/getff' },
    pull_request: { number: 2042, node_id: 'PR_kwDOM9YQhs6AbCdEfGh' },
    revision: {
      base_ref: 'staging',
      base_sha: SHA.base,
      head_sha: SHA.head,
      merge_base_sha: SHA.mergeBase,
      tested_merge_sha: SHA.merge,
    },
    policy: {
      version: POLICY_VERSION,
      sha256: policyDigestOf(),
      principle_inventory_sha256: SHA.principleInventory,
      spec_inventory_sha256: SHA.specInventory,
    },
    execution: {
      reviewer_id: 555001,
      route: 'dot-own-cloud',
      started_at: '2026-10-05T10:00:00Z',
      finished_at: '2026-10-05T10:42:11Z',
      activity_reference: 'dot-activity-0001',
      failure: false,
      failure_reason: null,
    },
    completion: 'COMPLETE',
    verdict: 'GO',
    report: {
      reference: 'rep-0001',
      sha256: SHA.report,
      summary: 'reviewed the changed principle test and its gate',
      limitations: [],
    },
    mechanical_evidence: [
      {
        context: 'ci-success',
        app_id: 15368,
        run_id: 101,
        job_id: 202,
        check_id: 303,
        head_sha: SHA.head,
        tested_sha: SHA.merge,
        workflow_id: 404,
        workflow_path: '.github/workflows/audit-self.yml',
        workflow_version: SHA.workflow,
        attempt: 1,
        conclusion: 'success',
      },
    ],
    goal_evidence: [makeAssessment('goal-1')],
    principle_evidence: PRINCIPLE_INVENTORY.map((id) => makeAssessment(id)),
    specification_evidence: [
      {
        requirement_id: 'S1-gate-schema',
        commit_sha: SHA.head,
        path: 'docs/superpowers/specs/2026-10-05-dot-staging-review-gate-design.md',
        blob_sha: SHA.blob,
        result: 'PASS',
        evidence: [makeEvidence()],
      },
    ],
    coverage: {
      changed_files: ['packages/core/principles/44-x.test.ts'],
      reviewed_files: [
        {
          path: 'packages/core/principles/44-x.test.ts',
          disposition: 'REVIEWED',
          rationale: 'read in full against the base',
          evidence: [makeEvidence()],
        },
      ],
      dimensions: makeDimensions(),
      omissions: [],
      truncated: false,
      changed_count: 1,
      reviewed_count: 1,
    },
    findings: [],
    self_review: {
      questions: [
        'What forged, stale or partial object could still appear clean?',
        'What mandatory population or execution evidence did I skip?',
      ],
      gaps: [],
      resolutions: [],
      validation_limitations: ['self-review is not independent calibration'],
    },
  };
  return deepMerge(report, overrides);
}

export function makeBaseline(overrides = {}) {
  const admission = makeAdmission();
  const baseline = {
    ...admission,
    kind: 'baseline',
    pull_request: null,
    revision: { ...admission.revision, tested_merge_sha: null },
    mechanical_evidence: [],
  };
  return deepMerge(baseline, overrides);
}

export function makeHistorical(overrides = {}) {
  const admission = makeAdmission();
  const historical = {
    ...admission,
    kind: 'historical',
    revision: { ...admission.revision, tested_merge_sha: null },
    mechanical_evidence: [],
  };
  return deepMerge(historical, overrides);
}

export function makePolicyFixture(overrides = {}) {
  return {
    policy_version: POLICY_VERSION,
    protocol_version: 'dot-staging-review/1.0',
    repository_id: 1231007068,
    repository_full_name: 'artyhoo/getff',
    schema_sha256: '0'.repeat(64),
    reviewer_principal_ids: [555001],
    mechanical_contexts: [
      { context: 'ci-success', expected_app_id: 15368, bound_to: 'merge', workflow_path: '.github/workflows/audit-self.yml' },
      { context: 'fidelity-verdict-in-pr-body', expected_app_id: 15368, bound_to: 'head', workflow_path: '.github/workflows/discipline-self-check.yml' },
      { context: 'stale-revert-in-pr-diff', expected_app_id: 15368, bound_to: 'head', workflow_path: '.github/workflows/audit-self.yml' },
      { context: 'Template render probes — P1/P4/P6 (deterministic)', expected_app_id: 15368, bound_to: 'head', workflow_path: '.github/workflows/audit-self.yml' },
      { context: 'capability PR carries Prior-art line in PR body (squash-survival)', expected_app_id: 15368, bound_to: 'head', workflow_path: '.github/workflows/audit-self.yml' },
      { context: '§1.7 forward+backward sections present in PR description', expected_app_id: 15368, bound_to: 'head', workflow_path: '.github/workflows/discipline-self-check.yml' },
    ],
    dot_check: { context: 'dot-review/v1', expected_app_id: 999999999 },
    principle_inventory: PRINCIPLE_INVENTORY,
    specification_inventory: ['S1-gate-schema'],
    // R3-1: the trusted principal registry — the schema types claimed_by/verified_by
    // as "enrolled-principal identifiers issued by the trusted registry"; the
    // registry is WHERE that issuance lives. Labels match the canonical V2 examples.
    principals: {
      executors: [{ principal_id: 666001, label: 'cc-executor/mechanism-lane' }],
      verifiers: [{ principal_id: 777001, label: 'dot/astra-primary' }],
    },
    limits: { max_active_claims: 1, max_attempts_per_tuple: 2, claim_lease_minutes: 120 },
    authorization_expiry: '2026-12-31T23:59:59Z',
    ...overrides,
  };
}

function deepMerge(base, over) {
  if (over === undefined) return base;
  // explicit null IS a meaningful override (nulling tested_merge_sha, pull_request…)
  if (over === null || Array.isArray(base) || Array.isArray(over) || typeof base !== 'object' || typeof over !== 'object') {
    return over;
  }
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) {
    out[k] = k in base ? deepMerge(base[k], v) : v;
  }
  return out;
}
