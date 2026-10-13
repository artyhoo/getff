// intent-first-result S1 Task 5 — helper RED suite (kickoff §3/§4 Task 2, spec §4).
//
// The helper `.agents/procedures/intent/helpers/check-result-review.mjs` owns ALL structural
// validation of the scoped-contract records: ContentRef resolution inside configured roots
// (path + sha256 of exact bytes), IntentContract / ResultReview shape + identity, mode
// semantics (produce needs no prior passing review; repair names the failed attempt and does
// NOT require it to match; expand requires the exact selected matching attempt), the
// producer-vs-expansion distinctness (no contract→review→same-contract digest cycle), and
// PlanReview structure. The helper is READ-ONLY: it never writes, probes, or contacts a model.
// The advisor owns comparison semantics; these tests pin only what is mechanically checkable.
//
// T22 (sibling-channel false GREEN): every rejecting case below names its single flipping
// production change in the `it` title — the check that returns `{ok:false, code}` for that
// predicate. The case→flip map is mirrored in .claude/orchestrator-prompts/intent-first-result/s1-report.md.
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HELPER = resolve(
  REPO_ROOT,
  '.agents/procedures/intent/helpers/check-result-review.mjs',
);
const PUBLISHER = resolve(
  REPO_ROOT,
  '.agents/procedures/intent/helpers/publish-result-review.mjs',
);

const sha256 = (bytes: string | Buffer): string =>
  createHash('sha256').update(bytes).digest('hex');

// The helper does not exist yet — module-not-found IS the RED state for this suite.
const helper = (await import(pathToFileURL(HELPER).href)) as {
  validateCurrentResult: (
    request: unknown,
  ) => { ok: true } | { ok: false; code: string; reason: string };
  validateResultReview: (
    request: unknown,
  ) => { ok: true } | { ok: false; code: string; reason: string };
  validatePlanReview: (
    request: unknown,
  ) =>
    | { ok: true; classification: string }
    | { ok: false; code: string; reason: string };
  validateSpecReview: (
    request: unknown,
  ) => { ok: true } | { ok: false; code: string; reason: string };
};

describe('intent continuity — current result evidence', () => {
  it('an exact matching attempt is current only against the independently supplied brief and observed revision', () => {
    const base = request({
      contractRef: ref('contracts/expand.json', expandDigest),
      currentBriefRef: E('brief.md'),
    });
    expect(helper.validateCurrentResult(base)).toEqual({ ok: true });
    expect(
      helper.validateCurrentResult({ ...base, observedRevision: 'rev-2' }),
    ).toMatchObject({ ok: false, code: 'stale_review' });
    expect(
      helper.validateCurrentResult({
        ...base,
        currentBriefRef: E('inputs/spec.md'),
      }),
    ).toMatchObject({ ok: false, code: 'current_brief_mismatch' });
  });

  it('no observed revision or current brief cannot turn an old attempt into expansion authority', () => {
    const base = request({
      contractRef: ref('contracts/expand.json', expandDigest),
      currentBriefRef: E('brief.md'),
    });
    expect(
      helper.validateCurrentResult({ ...base, observedRevision: undefined }),
    ).toMatchObject({ ok: false, code: 'current_revision_missing' });
    expect(
      helper.validateCurrentResult({ ...base, currentBriefRef: undefined }),
    ).toMatchObject({ ok: false, code: 'current_brief_missing' });
  });
});

// ---------------------------------------------------------------------------
// Fixture tree — one disposable root configured as the owner root for every arm.
// ---------------------------------------------------------------------------
const ROOT = mkdtempSync(resolve(tmpdir(), 'intent-review-fixture-'));
for (const dir of [
  'shared',
  'inputs',
  'env',
  'evidence',
  'contracts',
  'reviews',
  'specs',
  'approvals',
]) {
  mkdirSync(resolve(ROOT, dir), { recursive: true });
}
const write = (rel: string, bytes: string): string => {
  writeFileSync(resolve(ROOT, rel), bytes, 'utf8');
  return sha256(bytes);
};
const D = {
  brief: write(
    'brief.md',
    '# Pilot brief\n\nFeature: intent-first-result-pilot.\n',
  ),
  decisionLog: write(
    'shared/decision-log.md',
    '# Decisions\n\n- reuse the existing npm backend.\n',
  ),
  spec: write(
    'inputs/spec.md',
    '# Spec\n\nThe first result is the developer interaction.\n',
  ),
  toolchain: write('env/toolchain.md', '# Toolchain\n\nnode 22, eslint 9.\n'),
  p1: write(
    'evidence/p1.log',
    'forbidden read at src/db.ts:12 — use config.get()\n',
  ),
  p2: write(
    'evidence/p2.log',
    'diagnostic names src/db.ts:12 and the config accessor\n',
  ),
  p3: write(
    'evidence/p3.log',
    'corrected file passes the identical local check\n',
  ),
  prd: write(
    'specs/prd.md',
    '# PRD\n\nRules and tests are generated per stack from documentation, never shipped as fixed templates.\n',
  ),
  candidate: write(
    'specs/candidate.md',
    '# Candidate spec\n\nDoc-driven generation of rules/tests per stack.\n',
  ),
  reformatted: write(
    'specs/candidate-fmt.md',
    '# Candidate spec\n\nDoc-driven generation of rules/tests per stack.  \n',
  ),
  approval: write(
    'approvals/approval.md',
    '# Approval\n\nOperator approved the PRD snapshot by digest.\n',
  ),
};
write('evidence/run.log', `${D.p1}\n${D.p2}\n${D.p3}\n`);

const E = (rel: string) => ({
  path: rel,
  sha256: sha256(readFileSync(resolve(ROOT, rel))),
});
const ref = (rel: string, digest: string) => ({ path: rel, sha256: digest });

interface Contract {
  version: number;
  featureId: string;
  resultId: string;
  mode: string;
  brief: { path: string; sha256: string };
  shared: Array<{ path: string; sha256: string }>;
  essentialPromiseIds: string[];
  producesOrRepairs?: string;
  parentContract?: { path: string; sha256: string };
}

const produceContract: Contract = {
  version: 1,
  featureId: 'intent-first-result-pilot',
  resultId: 's1-first-result',
  mode: 'produce',
  brief: E('brief.md'),
  shared: [E('shared/decision-log.md')],
  essentialPromiseIds: ['S1-P1', 'S1-P2', 'S1-P3'],
};
const writeJson = (rel: string, obj: unknown): string =>
  write(rel, `${JSON.stringify(obj, null, 2)}\n`);
const produceDigest = writeJson('contracts/produce.json', produceContract);

const featureBContract: Contract = {
  ...produceContract,
  featureId: 'some-other-feature',
  resultId: 'b-result',
  brief: E('brief.md'),
};
const featureBDigest = writeJson('contracts/other.json', featureBContract);

interface Review {
  version: number;
  attemptId: string;
  featureId: string;
  resultId: string;
  brief: { path: string; sha256: string };
  producerContract: { path: string; sha256: string };
  observedRevision: string;
  sourceInputs: Array<{ path: string; sha256: string }>;
  environment: { path: string; sha256: string };
  evidence: Array<{ path: string; sha256: string }>;
  promises: Array<{
    id: string;
    comparison: string;
    evidence: Array<{ path: string; sha256: string }>;
    explanation: string;
  }>;
  outcome: string;
  limits: string[];
  operatorCheckpoint?: { path: string; sha256: string };
}

const matchingReview: Review = {
  version: 1,
  attemptId: 'attempt-1',
  featureId: 'intent-first-result-pilot',
  resultId: 's1-first-result',
  brief: E('brief.md'),
  producerContract: ref('contracts/produce.json', produceDigest),
  observedRevision: 'rev-1',
  sourceInputs: [E('inputs/spec.md')],
  environment: E('env/toolchain.md'),
  evidence: [E('evidence/run.log')],
  promises: [
    {
      id: 'S1-P1',
      comparison: 'supported',
      evidence: [E('evidence/p1.log')],
      explanation: 'the real installed check failed naming the read',
    },
    {
      id: 'S1-P2',
      comparison: 'supported',
      evidence: [E('evidence/p2.log')],
      explanation: 'diagnostic names the line and the config accessor',
    },
    {
      id: 'S1-P3',
      comparison: 'supported',
      evidence: [E('evidence/p3.log')],
      explanation: 'corrected file passes the identical command',
    },
  ],
  outcome: 'matches',
  limits: ['editor breadth deferred per brief'],
};

describe('intent continuity — immutable result attempt publication', () => {
  it('publishes validated observations once and retains the original after a changed attempt', async () => {
    const { publishResultReview } = await import(pathToFileURL(PUBLISHER).href);
    const artifactRoot = mkdtempSync(resolve(ROOT, 'intent-result-journal-'));
    const first = publishResultReview({
      attempt: matchingReview,
      stageArtifactRoot: artifactRoot,
      roots: [ROOT],
    });
    expect(first, JSON.stringify(first)).toMatchObject({
      ok: true,
      attemptId: 'attempt-1',
    });
    const firstBytes = readFileSync(first.path, 'utf8');
    expect(
      publishResultReview({
        attempt: matchingReview,
        stageArtifactRoot: artifactRoot,
        roots: [ROOT],
      }),
    ).toMatchObject({ ok: false, code: 'attempt_collision' });
    const changed = {
      ...matchingReview,
      attemptId: 'attempt-2',
      observedRevision: 'rev-2',
    };
    expect(
      publishResultReview({
        attempt: changed,
        stageArtifactRoot: artifactRoot,
        roots: [ROOT],
      }),
    ).toMatchObject({ ok: true, attemptId: 'attempt-2' });
    expect(readFileSync(first.path, 'utf8')).toBe(firstBytes);
    const failed = {
      ...matchingReview,
      attemptId: 'attempt-mismatch',
      outcome: 'mismatch',
      promises: matchingReview.promises.map((p, index) =>
        index === 0
          ? {
              ...p,
              comparison: 'contradicted',
              explanation: 'observed forbidden behavior',
            }
          : p,
      ),
    };
    const publishedFailure = publishResultReview({
      attempt: failed,
      stageArtifactRoot: artifactRoot,
      roots: [ROOT],
    });
    expect(publishedFailure, JSON.stringify(publishedFailure)).toMatchObject({
      ok: true,
      attemptId: 'attempt-mismatch',
    });
    expect(
      helper.validateResultReview({
        roots: [ROOT],
        contractRef: ref('contracts/produce.json', produceDigest),
        reviewPath: relative(ROOT, publishedFailure.path),
        publication: true,
      }),
    ).toMatchObject({ ok: false, code: 'review_not_matching' });
    for (const outcome of ['needs-evidence', 'needs-operator'] as const) {
      const attempt = { ...failed, attemptId: `attempt-${outcome}`, outcome };
      expect(
        publishResultReview({
          attempt,
          stageArtifactRoot: artifactRoot,
          roots: [ROOT],
        }),
      ).toMatchObject({ ok: true, attemptId: `attempt-${outcome}` });
    }
    expect(
      helper.validateResultReview({
        roots: [ROOT],
        contract: {
          ...produceContract,
          mode: 'repair',
          producesOrRepairs: 'attempt-mismatch',
        },
        priorReviewPath: relative(ROOT, publishedFailure.path),
      }),
    ).toEqual({ ok: true });
  });
});
const writeReview = (
  name: string,
  patch: Partial<Review> = {},
): { path: string; sha256: string } =>
  ref(
    `reviews/${name}`,
    writeJson(`reviews/${name}`, { ...matchingReview, ...patch }),
  );

const attempt1 = writeReview('attempt-1.json');
const attempt1Mismatch = writeReview('attempt-1-mismatch.json', {
  outcome: 'mismatch',
  promises: [
    {
      id: 'S1-P1',
      comparison: 'supported',
      evidence: [E('evidence/p1.log')],
      explanation: 'detection fired',
    },
    {
      id: 'S1-P2',
      comparison: 'contradicted',
      evidence: [E('evidence/p2.log')],
      explanation: 'opaque code only — unusable diagnostic',
    },
    {
      id: 'S1-P3',
      comparison: 'unobserved',
      evidence: [],
      explanation: 'not attempted yet',
    },
  ],
});

const expandContract: Contract = {
  ...produceContract,
  mode: 'expand',
  producesOrRepairs: 'attempt-1',
  parentContract: ref('contracts/produce.json', produceDigest),
};
const expandDigest = writeJson('contracts/expand.json', expandContract);

describe('intent continuity — publishing an expanded result', () => {
  it('records a new attempt produced under an expansion contract', async () => {
    const { publishResultReview } = await import(pathToFileURL(PUBLISHER).href);
    const artifactRoot = resolve(ROOT, 'expanded-publication');
    const attempt = {
      ...matchingReview,
      attemptId: 'expanded-result',
      producerContract: ref('contracts/expand.json', expandDigest),
    };
    expect(
      publishResultReview({
        attempt,
        stageArtifactRoot: artifactRoot,
        roots: [ROOT],
      }),
    ).toMatchObject({ ok: true, attemptId: 'expanded-result' });
  });
});

const repairContract: Contract = {
  ...produceContract,
  mode: 'repair',
  producesOrRepairs: 'attempt-1',
};
const repairDigest = writeJson('contracts/repair.json', repairContract);

const request = (overrides: Record<string, unknown> = {}) => ({
  roots: [ROOT],
  contractRef: ref('contracts/produce.json', produceDigest),
  reviewPath: 'reviews/attempt-1.json',
  observedRevision: 'rev-1',
  ...overrides,
});

const expectReject = (req: unknown, code: string) => {
  const res = helper.validateResultReview(req);
  expect(res.ok, `expected ok:false ${code}, got ${JSON.stringify(res)}`).toBe(
    false,
  );
  expect((res as { code: string }).code).toBe(code);
};

// ---------------------------------------------------------------------------
// Passing shapes — a matching attempt, each mode's own contract, independent work.
// ---------------------------------------------------------------------------
describe('check-result-review — passing shapes', () => {
  it('a matching produce attempt passes its own contract', () => {
    expect(helper.validateResultReview(request())).toEqual({ ok: true });
  });

  it('an inline declared contract passes (parity with the ref-loaded form)', () => {
    expect(
      helper.validateResultReview(request({ contract: produceContract })),
    ).toEqual({ ok: true });
  });

  it('produce does NOT require a prior passing review (reviewPath absent)', () => {
    const { reviewPath, ...rest } = request();
    expect(helper.validateResultReview(rest)).toEqual({ ok: true });
  });

  it('the exact selected matching attempt passes an expansion contract', () => {
    expect(
      helper.validateResultReview(
        request({
          contractRef: ref('contracts/expand.json', expandDigest),
          reviewPath: 'reviews/attempt-1.json',
        }),
      ),
    ).toEqual({ ok: true });
  });

  it('authorized repair passes its own contract — the failed attempt need not match', () => {
    expect(
      helper.validateResultReview(
        request({
          contractRef: ref('contracts/repair.json', repairDigest),
          reviewPath: undefined,
          priorReviewPath: 'reviews/attempt-1-mismatch.json',
        }),
      ),
    ).toEqual({ ok: true });
  });

  it('ordinary independent work passes its own contract (feature B is not feature A)', () => {
    const res = helper.validateResultReview(
      request({
        contractRef: ref('contracts/other.json', featureBDigest),
        reviewPath: writeReview('feature-b.json', {
          featureId: 'some-other-feature',
          resultId: 'b-result',
          // Fixture completeness correction (2026-10-10, before GREEN): the review binds the
          // contract it was produced under — feature B's review names feature B's contract,
          // not a lazily-inherited produce.json ref. Symmetric with the wrong-producer arm.
          producerContract: ref('contracts/other.json', featureBDigest),
        }).path,
      }),
    );
    expect(res).toEqual({ ok: true });
  });
});

// ---------------------------------------------------------------------------
// Rejecting shapes — each `it` names the single predicate whose check flips it.
// ---------------------------------------------------------------------------
describe('check-result-review — contract-side rejects', () => {
  it('missing contract and contractRef → contract_missing', () => {
    const { contractRef, ...rest } = request();
    expectReject(rest, 'contract_missing');
  });

  it('unsupported contract version → unsupported_version', () => {
    expectReject(
      request({ contract: { ...produceContract, version: 2 } }),
      'unsupported_version',
    );
  });

  it('unknown mode → invalid_contract', () => {
    expectReject(
      request({ contract: { ...produceContract, mode: 'refactor' } }),
      'invalid_contract',
    );
  });

  it('conflicting duplicate essential IDs → duplicate_ids', () => {
    expectReject(
      request({
        contract: {
          ...produceContract,
          essentialPromiseIds: ['S1-P1', 'S1-P1'],
        },
      }),
      'duplicate_ids',
    );
  });

  it('brief file missing → ref_missing', () => {
    expectReject(
      request({
        contract: { ...produceContract, brief: ref('brief-gone.md', D.brief) },
      }),
      'ref_missing',
    );
  });

  it('brief bytes changed since approval → ref_digest_mismatch (stale binding)', () => {
    expectReject(
      request({
        contract: {
          ...produceContract,
          brief: ref('brief.md', '0'.repeat(64)),
        },
      }),
      'ref_digest_mismatch',
    );
  });

  it('ref path escaping the configured roots → path_escapes_roots', () => {
    expectReject(
      request({
        contract: {
          ...produceContract,
          shared: [{ path: '../../etc/hostname', sha256: D.decisionLog }],
        },
      }),
      'path_escapes_roots',
    );
  });

  it('declared inline scope diverging from the registered contract → declared_scope_mismatch', () => {
    expectReject(
      request({
        contract: { ...produceContract, resultId: 'a-different-result' },
      }),
      'declared_scope_mismatch',
    );
  });

  it('child scope dropping a parent essential → weakens_parent_scope', () => {
    expectReject(
      request({
        contract: {
          ...produceContract,
          essentialPromiseIds: ['S1-P1', 'S1-P2'],
        },
        parentContract: ref('contracts/produce.json', produceDigest),
      }),
      'weakens_parent_scope',
    );
  });

  it('child keeping every parent essential passes the parent check', () => {
    expect(
      helper.validateResultReview(
        request({
          parentContract: ref('contracts/produce.json', produceDigest),
        }),
      ),
    ).toEqual({ ok: true });
  });
});

describe('check-result-review — review-side rejects', () => {
  it('review file missing → review_missing', () => {
    expectReject(
      request({ reviewPath: 'reviews/absent.json' }),
      'review_missing',
    );
  });

  it('unsupported review version → unsupported_version', () => {
    expectReject(
      request({ reviewPath: writeReview('v9.json', { version: 9 }).path }),
      'unsupported_version',
    );
  });

  it('outcome outside the four → invalid_outcome', () => {
    expectReject(
      request({
        reviewPath: writeReview('bad-outcome.json', { outcome: 'approved' })
          .path,
      }),
      'invalid_outcome',
    );
  });

  it('comparison outside the four → invalid_comparison', () => {
    expectReject(
      request({
        reviewPath: writeReview('bad-comparison.json', {
          promises: [{ ...matchingReview.promises[0], comparison: 'verified' }],
        }).path,
      }),
      'invalid_comparison',
    );
  });

  it('conflicting duplicate promise IDs → duplicate_ids', () => {
    expectReject(
      request({
        reviewPath: writeReview('dup-promises.json', {
          promises: [
            matchingReview.promises[0],
            { ...matchingReview.promises[0], comparison: 'contradicted' },
          ],
        }).path,
      }),
      'duplicate_ids',
    );
  });

  it('wrong feature → feature_mismatch', () => {
    expectReject(
      request({
        reviewPath: writeReview('wrong-feature.json', { featureId: 'other' })
          .path,
      }),
      'feature_mismatch',
    );
  });

  it('wrong result → result_mismatch', () => {
    expectReject(
      request({
        reviewPath: writeReview('wrong-result.json', { resultId: 'other' })
          .path,
      }),
      'result_mismatch',
    );
  });

  it('review bound to different brief bytes → brief_mismatch', () => {
    expectReject(
      request({
        reviewPath: writeReview('wrong-brief.json', {
          brief: ref('brief.md', '1'.repeat(64)),
        }).path,
      }),
      'brief_mismatch',
    );
  });

  it('producer contract other than the enforcing one → producer_mismatch', () => {
    expectReject(
      request({
        reviewPath: writeReview('wrong-producer.json', {
          producerContract: ref('contracts/other.json', featureBDigest),
        }).path,
      }),
      'producer_mismatch',
    );
  });

  it('review observedRevision behind the current binding → stale_review', () => {
    expectReject(
      request({ reviewPath: attempt1.path, observedRevision: 'rev-2' }),
      'stale_review',
    );
  });

  it('matches without an essential supported by observations → missing_essential_evidence', () => {
    const p2unobserved = matchingReview.promises.map((p) =>
      p.id === 'S1-P2' ? { ...p, comparison: 'unobserved', evidence: [] } : p,
    );
    expectReject(
      request({
        reviewPath: writeReview('p2-unobserved.json', {
          promises: p2unobserved,
        }).path,
      }),
      'missing_essential_evidence',
    );
    const p2absent = matchingReview.promises.filter((p) => p.id !== 'S1-P2');
    expectReject(
      request({
        reviewPath: writeReview('p2-absent.json', { promises: p2absent }).path,
      }),
      'missing_essential_evidence',
    );
  });

  it('matches with a contradicted promise → contradicted_essential', () => {
    expectReject(
      request({
        reviewPath: writeReview('contradicted.json', {
          promises: [
            ...matchingReview.promises.slice(0, 2),
            { ...matchingReview.promises[2], comparison: 'contradicted' },
          ],
        }).path,
      }),
      'contradicted_essential',
    );
  });

  it('matches with an unresolved operator checkpoint → outstanding_checkpoint', () => {
    expectReject(
      request({
        reviewPath: writeReview('checkpoint.json', {
          operatorCheckpoint: E('shared/decision-log.md'),
        }).path,
      }),
      'outstanding_checkpoint',
    );
  });
});

describe('check-result-review — mode semantics (expand / repair)', () => {
  it('expansion bound to a different attempt → matching_attempt_mismatch', () => {
    expectReject(
      request({
        contractRef: ref('contracts/expand.json', expandDigest),
        reviewPath: writeReview('attempt-2.json', { attemptId: 'attempt-2' })
          .path,
      }),
      'matching_attempt_mismatch',
    );
  });

  it('expansion whose selected attempt did not match → expansion_requires_match', () => {
    expectReject(
      request({
        contractRef: ref('contracts/expand.json', expandDigest),
        reviewPath: attempt1Mismatch.path,
      }),
      'expansion_requires_match',
    );
  });

  it('expansion review produced under the expansion contract itself → contract_review_cycle', () => {
    expectReject(
      request({
        contractRef: ref('contracts/expand.json', expandDigest),
        reviewPath: writeReview('cycle.json', {
          producerContract: ref('contracts/expand.json', expandDigest),
        }).path,
      }),
      'contract_review_cycle',
    );
  });

  it('repair bound to the wrong prior attempt → prior_attempt_mismatch', () => {
    expectReject(
      request({
        contractRef: ref('contracts/repair.json', repairDigest),
        reviewPath: undefined,
        priorReviewPath: writeReview('attempt-9-mismatch.json', {
          attemptId: 'attempt-9',
          outcome: 'mismatch',
        }).path,
      }),
      'prior_attempt_mismatch',
    );
  });

  it('repair cannot adopt another feature’s failed attempt with the same attempt ID', () => {
    expectReject(
      request({
        contractRef: ref('contracts/repair.json', repairDigest),
        reviewPath: undefined,
        priorReviewPath: writeReview('other-feature-failure.json', {
          featureId: 'another-feature',
          outcome: 'mismatch',
        }).path,
      }),
      'prior_feature_mismatch',
    );
  });

  it('repair of an attempt that already matched → repair_target_already_matches', () => {
    expectReject(
      request({
        contractRef: ref('contracts/repair.json', repairDigest),
        reviewPath: undefined,
        priorReviewPath: attempt1.path,
      }),
      'repair_target_already_matches',
    );
  });
});

// ---------------------------------------------------------------------------
// Specification-review mode (intent-continuity A1, design §6) — a DISTINCT attempt kind
// comparing a candidate SPEC against the approved PRD. Rejecting arms name the single
// predicate whose check flips them (T22 discipline, same as above).
// ---------------------------------------------------------------------------
describe('check-result-review — specification-review mode', () => {
  interface SpecPromise {
    id: string;
    comparison: string;
    reason: string;
    citations: Array<{ source: string; quote: string; location: string }>;
  }
  interface SpecReview {
    version: number;
    kind: string;
    featureId: string;
    prdRef: { path: string; sha256: string };
    specRef: { path: string; sha256: string };
    approvalRef: { path: string; sha256: string };
    reviewer: {
      independence: string;
      context: string;
      documents: Array<{ path: string; sha256: string }>;
    };
    promises: SpecPromise[];
    outcome: string;
    priorAttemptId?: string;
    priorSpecRef?: { path: string; sha256: string };
    boundedDiff?: { summary: string };
  }

  const prdRef = E('specs/prd.md');
  const approvalRef = E('approvals/approval.md');
  const supportedPromise = (id: string): SpecPromise => ({
    id,
    comparison: 'supported',
    reason: 'the design preserves the promise',
    citations: [
      {
        source: 'prd',
        quote: 'generated per stack from documentation',
        location: 'specs/prd.md:3',
      },
      {
        source: 'spec',
        quote: 'Doc-driven generation of rules/tests per stack',
        location: 'specs/candidate.md:3',
      },
    ],
  });

  const specReview = (patch: Partial<SpecReview> = {}): SpecReview => ({
    version: 1,
    kind: 'spec-review',
    featureId: 'intent-continuity',
    prdRef,
    specRef: E('specs/candidate.md'),
    approvalRef,
    reviewer: {
      independence:
        'fresh artifact-only seat; no architecture-author conversation',
      context:
        'judged from the approved PRD snapshot and the unlabeled candidate spec',
      documents: [prdRef, E('specs/candidate.md'), approvalRef],
    },
    promises: [supportedPromise('IC-P1'), supportedPromise('IC-P2')],
    outcome: 'matches',
    ...patch,
  });
  const expectSpecReject = (review: unknown, code: string) => {
    const res = helper.validateSpecReview({
      roots: [ROOT],
      specReview: review,
    });
    expect(
      res.ok,
      `expected ok:false ${code}, got ${JSON.stringify(res)}`,
    ).toBe(false);
    expect((res as { code: string }).code).toBe(code);
  };

  it('a semantic matches with every promise supported passes', () => {
    expect(
      helper.validateSpecReview({ roots: [ROOT], specReview: specReview() }),
    ).toEqual({ ok: true });
  });

  it('a mismatch naming a contradicted promise passes (the honest wrong-spec verdict)', () => {
    expect(
      helper.validateSpecReview({
        roots: [ROOT],
        specReview: specReview({
          outcome: 'mismatch',
          promises: [
            {
              ...supportedPromise('IC-P1'),
              comparison: 'contradicted',
              reason: 'spec ships fixed stack templates instead',
            },
            supportedPromise('IC-P2'),
          ],
        }),
      }),
    ).toEqual({ ok: true });
  });

  it('needs-evidence with an unobserved promise passes', () => {
    expect(
      helper.validateSpecReview({
        roots: [ROOT],
        specReview: specReview({
          outcome: 'needs-evidence',
          promises: [
            {
              ...supportedPromise('IC-P1'),
              comparison: 'unobserved',
              reason: 'spec silent on this promise',
            },
          ],
        }),
      }),
    ).toEqual({ ok: true });
  });

  it('needs-operator with a needs-operator promise passes', () => {
    expect(
      helper.validateSpecReview({
        roots: [ROOT],
        specReview: specReview({
          outcome: 'needs-operator',
          promises: [
            {
              ...supportedPromise('IC-P1'),
              comparison: 'needs-operator',
              reason: 'promise ambiguous without an operator call',
            },
          ],
        }),
      }),
    ).toEqual({ ok: true });
  });

  it('a formatting-equivalence rebinding passes (prior attempt named, bounded diff attested)', () => {
    expect(
      helper.validateSpecReview({
        roots: [ROOT],
        specReview: specReview({
          kind: 'formatting-equivalence',
          specRef: E('specs/candidate-fmt.md'),
          promises: [],
          priorAttemptId: 'a'.repeat(64),
          priorSpecRef: E('specs/candidate.md'),
          boundedDiff: {
            summary: 'trailing-whitespace reflow only; no token changed',
          },
        }),
      }),
    ).toEqual({ ok: true });
  });

  it('unknown kind → spec_review_invalid', () => {
    expectSpecReject(
      specReview({ kind: 'result-review' }),
      'spec_review_invalid',
    );
  });

  it('version other than 1 → unsupported_version', () => {
    expectSpecReject(specReview({ version: 9 }), 'unsupported_version');
  });

  it('semantic review with zero promises → spec_review_invalid', () => {
    expectSpecReject(specReview({ promises: [] }), 'spec_review_invalid');
  });

  it('reviewer documents omitting the exact PRD → prd_not_primary (advisor saw only the spec)', () => {
    expectSpecReject(
      specReview({
        reviewer: {
          independence: 'x',
          context: 'y',
          documents: [E('specs/candidate.md')],
        },
      }),
      'prd_not_primary',
    );
  });

  it('citation source outside prd|spec → spec_review_invalid', () => {
    expectSpecReject(
      specReview({
        promises: [
          {
            ...supportedPromise('IC-P1'),
            citations: [{ source: 'chat', quote: 'q', location: 'l' }],
          },
        ],
      }),
      'spec_review_invalid',
    );
  });

  it('promise without citations → spec_review_invalid (a verdict needs its evidence tags)', () => {
    expectSpecReject(
      specReview({
        promises: [{ ...supportedPromise('IC-P1'), citations: [] }],
      }),
      'spec_review_invalid',
    );
  });

  it('matches standing on a contradicted promise → outcome_incoherent', () => {
    expectSpecReject(
      specReview({
        promises: [
          { ...supportedPromise('IC-P1'), comparison: 'contradicted' },
        ],
      }),
      'outcome_incoherent',
    );
  });

  it('mismatch without any contradicted promise → outcome_incoherent', () => {
    expectSpecReject(specReview({ outcome: 'mismatch' }), 'outcome_incoherent');
  });

  it('needs-evidence over a contradicted promise → outcome_incoherent (a contradiction is a mismatch)', () => {
    expectSpecReject(
      specReview({
        outcome: 'needs-evidence',
        promises: [
          { ...supportedPromise('IC-P1'), comparison: 'contradicted' },
          { ...supportedPromise('IC-P2'), comparison: 'unobserved' },
        ],
      }),
      'outcome_incoherent',
    );
  });

  it('needs-operator without a needs-operator promise → outcome_incoherent', () => {
    expectSpecReject(
      specReview({ outcome: 'needs-operator' }),
      'outcome_incoherent',
    );
  });

  it('formatting-equivalence attesting mismatch → spec_review_invalid (semantic findings need the semantic path)', () => {
    expectSpecReject(
      specReview({
        kind: 'formatting-equivalence',
        outcome: 'mismatch',
        promises: [
          { ...supportedPromise('IC-P1'), comparison: 'contradicted' },
        ],
        priorAttemptId: 'a'.repeat(64),
        priorSpecRef: E('specs/candidate.md'),
        boundedDiff: { summary: 'not equivalent' },
      }),
      'spec_review_invalid',
    );
  });

  it('formatting-equivalence without priorAttemptId → spec_review_invalid', () => {
    expectSpecReject(
      specReview({
        kind: 'formatting-equivalence',
        specRef: E('specs/candidate-fmt.md'),
        promises: [],
        priorSpecRef: E('specs/candidate.md'),
        boundedDiff: { summary: 'reflow only' },
      }),
      'spec_review_invalid',
    );
  });

  it('formatting-equivalence binding the SAME spec ref → spec_review_invalid (nothing was rebound)', () => {
    expectSpecReject(
      specReview({
        kind: 'formatting-equivalence',
        promises: [],
        priorAttemptId: 'a'.repeat(64),
        priorSpecRef: E('specs/candidate.md'),
        boundedDiff: { summary: 'reflow only' },
      }),
      'spec_review_invalid',
    );
  });

  it('formatting-equivalence without boundedDiff.summary → spec_review_invalid', () => {
    expectSpecReject(
      specReview({
        kind: 'formatting-equivalence',
        specRef: E('specs/candidate-fmt.md'),
        promises: [],
        priorAttemptId: 'a'.repeat(64),
        priorSpecRef: E('specs/candidate.md'),
        boundedDiff: {},
      }),
      'spec_review_invalid',
    );
  });

  it('prdRef whose bytes drifted → ref_digest_mismatch (stale binding, shared resolver)', () => {
    const drifted = ref('specs/prd.md', '0'.repeat(64));
    expectSpecReject(
      specReview({
        prdRef: drifted,
        reviewer: {
          independence: 'x',
          context: 'y',
          documents: [drifted, E('specs/candidate.md'), approvalRef],
        },
      }),
      'ref_digest_mismatch',
    );
  });

  it('approvalRef outside the configured roots → path_escapes_roots', () => {
    expectSpecReject(
      specReview({ approvalRef: ref('../../etc/hostname', D.approval) }),
      'path_escapes_roots',
    );
  });
});

describe('check-result-review — PlanReview structure', () => {
  const planReview = (overrides: Record<string, unknown> = {}) => ({
    taskId: 'task-5',
    contractRef: ref('contracts/produce.json', produceDigest),
    effectivePlanSha256: sha256('# plan v1\n'),
    taskPreImageSha256: sha256('task-row-bytes'),
    classification: 'within-contract',
    ownerReference:
      'operator statement 2026-10-10, approved content bound by digest',
    ...overrides,
  });
  const planReq = (overrides: Record<string, unknown> = {}) => ({
    roots: [ROOT],
    contractRef: ref('contracts/produce.json', produceDigest),
    taskId: 'task-5',
    taskPlanSha256: sha256('# plan v1\n'),
    taskPreImageSha256: sha256('task-row-bytes'),
    planReview: planReview(),
    ...overrides,
  });

  it('a well-formed within-contract review passes and reports its classification', () => {
    expect(helper.validatePlanReview(planReq())).toEqual({
      ok: true,
      classification: 'within-contract',
    });
  });

  it('product-decision and contract-revision are STRUCTURALLY valid — the hold is the adapter call', () => {
    for (const classification of ['contract-revision', 'product-decision']) {
      const res = helper.validatePlanReview(
        planReq({ planReview: planReview({ classification }) }),
      );
      expect(res).toEqual({ ok: true, classification });
    }
  });

  it('review naming another task → plan_review_task_mismatch', () => {
    expect(helper.validatePlanReview(planReq({ taskId: 'task-6' })).ok).toBe(
      false,
    );
    expect(
      (
        helper.validatePlanReview(planReq({ taskId: 'task-6' })) as {
          code: string;
        }
      ).code,
    ).toBe('plan_review_task_mismatch');
  });

  it('plan bytes changed since review → plan_digest_mismatch', () => {
    const res = helper.validatePlanReview(
      planReq({ taskPlanSha256: sha256('# plan v2\n') }),
    );
    expect((res as { code: string }).code).toBe('plan_digest_mismatch');
  });

  it('classification outside the three → invalid_classification', () => {
    const res = helper.validatePlanReview(
      planReq({ planReview: planReview({ classification: 'go' }) }),
    );
    expect((res as { code: string }).code).toBe('invalid_classification');
  });

  it('missing owner reference → owner_reference_missing (a digest alone grants nothing)', () => {
    const res = helper.validatePlanReview(
      planReq({ planReview: planReview({ ownerReference: '' }) }),
    );
    expect((res as { code: string }).code).toBe('owner_reference_missing');
  });

  it('contract ref diverging from the declared scope → contract_ref_mismatch', () => {
    const res = helper.validatePlanReview(
      planReq({ contractRef: ref('contracts/other.json', featureBDigest) }),
    );
    expect((res as { code: string }).code).toBe('contract_ref_mismatch');
  });

  it('proposed payload digest diverging → payload_digest_mismatch', () => {
    const res = helper.validatePlanReview(
      planReq({
        payloadSha256: sha256('the answer text'),
        planReview: planReview({ payloadSha256: sha256('a different text') }),
      }),
    );
    expect((res as { code: string }).code).toBe('payload_digest_mismatch');
  });
});

// ---------------------------------------------------------------------------
// CLI parity — node <helper> --request <path>; exit 0/2; read-only.
// ---------------------------------------------------------------------------
describe('check-result-review CLI', () => {
  const run = (args: string[]) =>
    spawnSync('node', [HELPER, ...args], { encoding: 'utf8', timeout: 30_000 });

  it('a valid request exits 0 and prints {ok:true}', () => {
    const reqPath = resolve(ROOT, 'request-valid.json');
    writeFileSync(reqPath, JSON.stringify(request()), 'utf8');
    const r = run(['--request', reqPath]);
    expect(r.status, r.stderr).toBe(0);
    expect(JSON.parse(r.stdout)).toEqual({ ok: true });
  });

  it('a rejecting request exits 2 and prints the code', () => {
    const reqPath = resolve(ROOT, 'request-stale.json');
    writeFileSync(
      reqPath,
      JSON.stringify(request({ observedRevision: 'rev-2' })),
      'utf8',
    );
    const r = run(['--request', reqPath]);
    expect(r.status).toBe(2);
    const out = JSON.parse(r.stdout) as { ok: boolean; code: string };
    expect(out.ok).toBe(false);
    expect(out.code).toBe('stale_review');
  });

  it('missing input and parse failures exit 2 (never 0, never a crash)', () => {
    expect(run([]).status).toBe(2);
    expect(run(['--request', resolve(ROOT, 'absent.json')]).status).toBe(2);
    const bad = resolve(ROOT, 'request-bad.json');
    writeFileSync(bad, '{not json', 'utf8');
    expect(run(['--request', bad]).status).toBe(2);
  });

  it('--spec-review parity: a passing attempt exits 0, an incoherent one exits 2 with the code', () => {
    const okPath = resolve(ROOT, 'spec-review-ok.json');
    const prdE = E('specs/prd.md');
    const appE = E('approvals/approval.md');
    writeFileSync(
      okPath,
      JSON.stringify({
        roots: [ROOT],
        specReview: {
          version: 1,
          kind: 'spec-review',
          featureId: 'intent-continuity',
          prdRef: prdE,
          specRef: E('specs/candidate.md'),
          approvalRef: appE,
          reviewer: {
            independence: 'fresh seat',
            context: 'documents only',
            documents: [prdE, E('specs/candidate.md'), appE],
          },
          promises: [
            {
              id: 'IC-P1',
              comparison: 'supported',
              reason: 'preserved',
              citations: [
                {
                  source: 'prd',
                  quote: 'generated per stack',
                  location: 'specs/prd.md:3',
                },
              ],
            },
          ],
          outcome: 'matches',
        },
      }),
      'utf8',
    );
    const okRun = run(['--spec-review', okPath]);
    expect(okRun.status, okRun.stderr).toBe(0);
    expect(JSON.parse(okRun.stdout)).toEqual({ ok: true });

    const badPath = resolve(ROOT, 'spec-review-bad.json');
    writeFileSync(
      badPath,
      JSON.stringify({
        roots: [ROOT],
        specReview: {
          version: 1,
          kind: 'spec-review',
          outcome: 'mismatch',
          promises: [],
        },
      }),
      'utf8',
    );
    const badRun = run(['--spec-review', badPath]);
    expect(badRun.status).toBe(2);
    const out = JSON.parse(badRun.stdout) as { ok: boolean; code: string };
    expect(out.ok).toBe(false);
    expect(out.code).toBe('spec_review_invalid');
  });

  it('the helper is read-only: validation writes nothing into the fixture tree', () => {
    const reqPath = resolve(ROOT, 'request-readonly.json');
    writeFileSync(reqPath, JSON.stringify(request()), 'utf8');
    // Fixture-order correction (2026-10-10, before GREEN): `before` must be captured AFTER the
    // test's own write — the original pre-write capture measured the test's request file, not
    // the helper. Recursive listing: a nested write is part of "writes nothing into the tree".
    const before = readdirSync(ROOT, { recursive: true });
    expect(run(['--request', reqPath]).status).toBe(0);
    expect(readdirSync(ROOT, { recursive: true }).sort()).toEqual(
      [...before].sort(),
    );
  });
});
