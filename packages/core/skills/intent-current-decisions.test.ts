// intent-continuity A1 — current-decisions selector suite (kickoff §2 item 2; design §4).
//
// The helper `.agents/procedures/intent/helpers/current-decisions.mjs` owns the per-feature
// current-authority pointer: PRD/spec pointer advancement under an exclusive lock with live
// receipt re-resolution, atomic whole-selector writes, IC-B supersession (a newer approved PRD
// visibly invalidates the recorded spec agreement), the presentation/plan-prep gates over the
// published spec-review corpus, the write-once legacy admission freeze, and the artifact
// discriminator. The helper exposes NO exports — every arm drives the real CLI (spawnSync,
// exit 0 ok / 2 hold, one JSON line on stdout), so the suite is also the CLI contract.
//
// T22 (sibling-channel false GREEN): every rejecting `it` names its single flipping predicate
// in the title — the check that returns {ok:false, code} for that case. Arms build one feature
// lifecycle in order (bootstrap → publish → agree → supersede), so describe order is load-bearing;
// corpus-corrupting arms run LAST.
import { describe, it, expect } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HELPER = resolve(REPO_ROOT, '.agents/procedures/intent/helpers/current-decisions.mjs');
const PUBLISH = resolve(REPO_ROOT, '.agents/procedures/intent/helpers/publish-spec-review.mjs');

const sha256 = (bytes: string | Buffer): string => createHash('sha256').update(bytes).digest('hex');

// ---------------------------------------------------------------------------
// Fixture: a disposable "repository" (fake .git dir → stable repo identity) with feature
// documents + receipts, and a separate orch-home carrying selector + spec-review corpus.
// ---------------------------------------------------------------------------
const ROOT = mkdtempSync(resolve(tmpdir(), 'intent-current-decisions-'));
const ORCH = mkdtempSync(resolve(tmpdir(), 'intent-current-decisions-orch-'));
mkdirSync(join(ROOT, '.git'), { recursive: true });
mkdirSync(join(ROOT, 'docs/features'), { recursive: true });
mkdirSync(join(ROOT, 'receipts'), { recursive: true });
const FEATURE_HOME = join(ORCH, 'intent-continuity');

const write = (abs: string, bytes: string): string => {
  writeFileSync(abs, bytes, 'utf8');
  return sha256(bytes);
};
const writeRel = (rel: string, bytes: string): string => write(join(ROOT, rel), bytes);

const prdBytes = '# PRD v1\n\nUsers shall log in with SSO; the login form never asks for a password.\n';
const prd2Bytes = '# PRD v2\n\nUsers shall log in with SSO; the login form never asks for a password. Passkeys are in scope.\n';
const specBytes = '# Spec\n\nThe login screen uses SSO only.\n';
const wrongSpecBytes = '# Wrong spec\n\nThe login screen uses email and password.\n';
const approvalBytes = '# Approval record\n\nOperator approved PRD v1 by digest.\n';
const prdSha = writeRel('docs/features/prd.md', prdBytes);
const prd2Sha = writeRel('docs/features/prd-v2.md', prd2Bytes);
const specSha = writeRel('docs/features/spec.md', specBytes);
writeRel('docs/features/spec-wrong.md', wrongSpecBytes);
const approvalSha = writeRel('docs/features/approval.md', approvalBytes);
const E = (rel: string) => ({ path: rel, sha256: sha256(readFileSync(join(ROOT, rel))) });

const prdReceipt = {
  featureId: 'sso-login',
  decision: 'approved',
  approvedSha256: prdSha,
  snapshotRef: { path: 'docs/features/prd.md', sha256: prdSha },
  approvalRecordRef: { path: 'docs/features/approval.md', sha256: approvalSha },
  approver: 'operator',
};
const prd2Receipt = {
  featureId: 'sso-login',
  decision: 'approved',
  approvedSha256: prd2Sha,
  snapshotRef: { path: 'docs/features/prd-v2.md', sha256: prd2Sha },
  approvalRecordRef: { path: 'docs/features/approval.md', sha256: approvalSha },
  approver: 'operator',
};
const specReceipt = {
  featureId: 'sso-login',
  decision: 'agreed',
  operatorEvidence: "operator: 'го кикоф и отдай глм на реализацию'",
  specRef: { path: 'docs/features/spec.md', sha256: specSha },
  agreementRecordRef: { path: 'docs/features/approval.md', sha256: approvalSha },
  parentPrdSha256: prdSha,
};
const writeJson = (name: string, obj: unknown): string => {
  const abs = join(ROOT, 'receipts', name);
  writeFileSync(abs, JSON.stringify(obj, null, 2), 'utf8');
  return abs;
};
const prdReceiptPath = writeJson('prd.json', prdReceipt);
const prd2ReceiptPath = writeJson('prd2.json', prd2Receipt);
const specReceiptPath = writeJson('spec.json', specReceipt);

const attempt = {
  kind: 'spec-review',
  version: 1,
  featureId: 'sso-login',
  prdRef: { path: 'docs/features/prd.md', sha256: prdSha },
  specRef: { path: 'docs/features/spec.md', sha256: specSha },
  approvalRef: { path: 'docs/features/approval.md', sha256: approvalSha },
  reviewer: {
    independence: 'fresh artifact-only seat',
    context: 'judged from the approved PRD and the unlabeled candidate spec',
    documents: [
      { path: 'docs/features/prd.md', sha256: prdSha },
      { path: 'docs/features/spec.md', sha256: specSha },
    ],
  },
  promises: [
    {
      id: 'P1',
      comparison: 'supported',
      reason: 'the spec binds SSO-only login exactly as the PRD requires',
      citations: [
        { source: 'prd', quote: 'shall log in with SSO', location: 'docs/features/prd.md:3' },
        { source: 'spec', quote: 'uses SSO only', location: 'docs/features/spec.md:3' },
      ],
    },
  ],
  outcome: 'matches',
};
const attemptPath = writeJson('attempt.json', attempt);

const run = (args: string[], orchHome: string = ORCH) =>
  spawnSync('node', [HELPER, ...args, '--orch-home', orchHome, '--repo-root', ROOT], {
    encoding: 'utf8',
    timeout: 30_000,
  });
// Fixture convenience: each ordinary advance starts from the current revision. Tests for
// missing and stale prepared revisions call the raw CLI above so they cannot auto-refresh.
const advance = (args: string[], orchHome: string = ORCH) => {
  if (args.includes('--pre-mechanism') || args.includes('--expect-revision') || !args.includes('--receipt')) {
    return run(args, orchHome);
  }
  const featureId = args[args.indexOf('--feature') + 1];
  const prior = run(['--read', '--feature', featureId], orchHome);
  const revision = prior.status === 0 ? (JSON.parse(prior.stdout) as { revision: number }).revision : 0;
  return run([...args, '--expect-revision', String(revision)], orchHome);
};
const runPublish = (args: string[]) =>
  spawnSync('node', [PUBLISH, ...args, '--orch-home', ORCH, '--repo-root', ROOT], {
    encoding: 'utf8',
    timeout: 30_000,
  });
type Out = { ok: boolean; code?: string; reason?: string; [k: string]: unknown };
const out = (r: { status: number | null; stdout: string; stderr: string }): Out => {
  expect(r.status, r.stderr || r.stdout).not.toBeNull();
  return JSON.parse(r.stdout) as Out;
};
const expectHold = (r: { status: number | null; stdout: string; stderr: string }, code: string): Out => {
  expect(r.status, r.stderr || r.stdout).toBe(2);
  const parsed = JSON.parse(r.stdout) as Out;
  expect(parsed.ok).toBe(false);
  expect(parsed.code, JSON.stringify(parsed)).toBe(code);
  return parsed;
};

// ---------------------------------------------------------------------------
// Bootstrap — the first PRD advance creates the selector; failures leave no partial state.
// ---------------------------------------------------------------------------
describe('current-decisions — bootstrap and PRD advancement', () => {
  it('any verb before the selector exists → selector_missing (no current authority to select)', () => {
    expectHold(run(['--read', '--feature', 'sso-login']), 'selector_missing');
    expectHold(run(['--check-presentation', '--feature', 'sso-login', '--spec', 'docs/features/spec.md']), 'selector_missing');
    expectHold(
      advance(['--advance-spec', '--feature', 'sso-login', '--receipt', specReceiptPath]),
      'selector_missing',
    );
  });

  it('a receipt whose decision is not approved → receipt_invalid:not_approved, and it creates NO selector', () => {
    const bad = writeJson('prd-not-approved.json', { ...prdReceipt, decision: 'draft' });
    expectHold(advance(['--advance-prd', '--feature', 'sso-login', '--receipt', bad]), 'receipt_invalid:not_approved');
    expect(existsSync(join(FEATURE_HOME, 'current-decisions.json'))).toBe(false);
  });

  it('snapshotRef digest diverging from approvedSha256 → receipt_invalid:digest_mismatch (binding must be exact-content)', () => {
    const bad = writeJson('prd-drift.json', { ...prdReceipt, snapshotRef: { path: 'docs/features/prd.md', sha256: '0'.repeat(64) } });
    expectHold(advance(['--advance-prd', '--feature', 'sso-login', '--receipt', bad]), 'receipt_invalid:digest_mismatch');
  });

  it('a receipt naming another feature → receipt_invalid:cross_feature', () => {
    const bad = writeJson('prd-cross.json', { ...prdReceipt, featureId: 'billing' });
    expectHold(advance(['--advance-prd', '--feature', 'sso-login', '--receipt', bad]), 'receipt_invalid:cross_feature');
  });

  it('the first valid PRD advance bootstraps the selector at revision 1 and --read returns it', () => {
    const r = advance(['--advance-prd', '--feature', 'sso-login', '--receipt', prdReceiptPath]);
    expect(r.status, r.stderr).toBe(0);
    expect(out(r)).toMatchObject({ ok: true, featureId: 'sso-login', revision: 1, advanced: 'currentPrd' });
    const read = out(run(['--read', '--feature', 'sso-login']));
    expect(read.ok).toBe(true);
    expect(read).toMatchObject({ revision: 1, currentSpec: null, historyLength: 0 });
    expect((read.currentPrd as { approvedSha256: string }).approvedSha256).toBe(prdSha);
  });

  it('replaying the exact current approval → superseded_receipt_replay (replays advance nothing)', () => {
    expectHold(advance(['--advance-prd', '--feature', 'sso-login', '--receipt', prdReceiptPath]), 'superseded_receipt_replay');
    expect(out(run(['--read', '--feature', 'sso-login'])).revision).toBe(1);
  });

  it('snapshot bytes drifting AFTER the advance → prd_receipt_invalid:ref_digest_mismatch on the next live check', () => {
    write(join(ROOT, 'docs/features/prd.md'), `${prdBytes}<!-- drifted -->`);
    expectHold(
      run(['--check-presentation', '--feature', 'sso-login', '--spec', 'docs/features/spec.md']),
      'prd_receipt_invalid:ref_digest_mismatch',
    );
    write(join(ROOT, 'docs/features/prd.md'), prdBytes); // restore — later arms bind the original bytes
  });

  it('malformed CLI usage exits 2 with invalid_request (never a crash)', () => {
    expectHold(run([]), 'invalid_request');
    expectHold(advance(['--advance-prd', '--feature', 'sso-login']), 'invalid_request'); // --receipt required
  });
});

// ---------------------------------------------------------------------------
// Publication + presentation gate.
// ---------------------------------------------------------------------------
describe('current-decisions — spec-review publication and the presentation gate', () => {
  let attemptId = '';

  it('publishing a passing attempt exits 0 with its content-addressed attemptId', () => {
    const r = runPublish(['--attempt', attemptPath]);
    expect(r.status, r.stderr).toBe(0);
    const parsed = out(r);
    expect(parsed.ok).toBe(true);
    attemptId = parsed.attemptId as string;
    expect(attemptId).toMatch(/^[0-9a-f]{64}$/);
    expect(existsSync(join(FEATURE_HOME, 'spec-reviews', attemptId, 'spec-review.json'))).toBe(true);
  });

  it('republishing identical content → attempt_collision (immutable publication is write-once)', () => {
    expectHold(runPublish(['--attempt', attemptPath]) as never, 'attempt_collision');
  });

  it('publishing an incoherent attempt → outcome_incoherent, and it writes no corpus dir', () => {
    const before = readdirSync(join(FEATURE_HOME, 'spec-reviews'));
    const bad = writeJson('attempt-incoherent.json', { ...attempt, outcome: 'mismatch' }); // no contradicted promise
    expectHold(runPublish(['--attempt', bad]) as never, 'outcome_incoherent');
    expect(readdirSync(join(FEATURE_HOME, 'spec-reviews')).sort()).toEqual([...before].sort());
  });

  it('--check-presentation over the reviewed candidate exits 0 naming the same attemptId', () => {
    const r = run(['--check-presentation', '--feature', 'sso-login', '--spec', 'docs/features/spec.md']);
    expect(r.status, r.stderr).toBe(0);
    expect(out(r)).toMatchObject({ check: 'presentation', featureId: 'sso-login', revision: 1, attemptId, specSha256: specSha });
  });

  it('a DIFFERENT candidate spec → matches_attempt_missing (the attempt binds these exact bytes, not a topic)', () => {
    expectHold(
      run(['--check-presentation', '--feature', 'sso-login', '--spec', 'docs/features/spec-wrong.md']),
      'matches_attempt_missing',
    );
  });

  it('a missing candidate spec file → spec_outside_roots (unreachable is a hold, not a pass)', () => {
    expectHold(
      run(['--check-presentation', '--feature', 'sso-login', '--spec', 'docs/features/absent.md']),
      'spec_outside_roots',
    );
  });

  it('a candidate spec that is a leaf SYMLINK escaping the roots → spec_outside_roots (full-chain containment)', () => {
    // Pin: only the symlinked leaf escapes; its parent dir is inside ROOT. Containment over
    // the dirname alone would read the outside target through the link — the flipping
    // predicate is the full-path realpath containment in digestFileWithinRoots.
    const outside = join(tmpdir(), 'intent-current-decisions-outside-target.md');
    writeFileSync(outside, '# Escaped spec\n\nBytes living outside every root.\n', 'utf8');
    symlinkSync(outside, join(ROOT, 'docs/features/escape-link.md'));
    expectHold(
      run(['--check-presentation', '--feature', 'sso-login', '--spec', 'docs/features/escape-link.md']),
      'spec_outside_roots',
    );
  });
});

// ---------------------------------------------------------------------------
// Spec agreement + plan-prep gate + read-only/atomicity invariants.
// ---------------------------------------------------------------------------
describe('current-decisions — spec agreement and the plan-prep gate', () => {
  it('an agreement whose parentPrdSha256 is not the current approval → spec_agreement_inapplicable', () => {
    const bad = writeJson('spec-wrong-parent.json', { ...specReceipt, parentPrdSha256: '0'.repeat(64) });
    expectHold(advance(['--advance-spec', '--feature', 'sso-login', '--receipt', bad]), 'spec_agreement_inapplicable');
  });

  it('the valid agreement advances to revision 2 and the selector records it', () => {
    const r = advance(['--advance-spec', '--feature', 'sso-login', '--receipt', specReceiptPath]);
    expect(r.status, r.stderr).toBe(0);
    expect(out(r)).toMatchObject({ ok: true, revision: 2, advanced: 'currentSpec' });
  });

  it('--check-plan-prep exits 0 over the recorded chain, and pins exact bytes via --spec', () => {
    expect(out(run(['--check-plan-prep', '--feature', 'sso-login'])).ok).toBe(true);
    const pinned = out(run(['--check-plan-prep', '--feature', 'sso-login', '--spec', 'docs/features/spec.md']));
    expect(pinned).toMatchObject({ check: 'plan-prep', specSha256: specSha });
  });

  it('handing off bytes that are not the agreed spec → spec_bytes_mismatch', () => {
    expectHold(
      run(['--check-plan-prep', '--feature', 'sso-login', '--spec', 'docs/features/spec-wrong.md']),
      'spec_bytes_mismatch',
    );
  });

  it('an unrecorded feature → feature_missing (its PRD approval must be recorded first)', () => {
    expectHold(run(['--read', '--feature', 'not-recorded']), 'feature_missing');
  });

  it('read-only verbs take no lock and leave no temp residue (atomic whole-file writes)', () => {
    const before = readdirSync(FEATURE_HOME).sort();
    run(['--read', '--feature', 'sso-login']);
    run(['--check-plan-prep', '--feature', 'sso-login']);
    run(['--check-presentation', '--feature', 'sso-login', '--spec', 'docs/features/spec.md']);
    expect(readdirSync(FEATURE_HOME).sort()).toEqual(before);
    expect(readdirSync(FEATURE_HOME).some((f) => /\.tmp-|\.selector\.lock/.test(f))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// IC-B — A→B supersession with unchanged A material must still hold the transition.
// ---------------------------------------------------------------------------
describe('current-decisions — IC-B supersession', () => {
  it('a newer approved PRD visibly invalidates the spec agreement and bumps to revision 3', () => {
    const r = advance(['--advance-prd', '--feature', 'sso-login', '--receipt', prd2ReceiptPath]);
    expect(r.status, r.stderr).toBe(0);
    expect(out(r)).toMatchObject({ ok: true, revision: 3, advanced: 'currentPrd' });
    const read = out(run(['--read', '--feature', 'sso-login']));
    expect(read).toMatchObject({ revision: 3, currentSpec: null, historyLength: 2 });
    expect((read.currentPrd as { approvedSha256: string }).approvedSha256).toBe(prd2Sha);
    // --read reports historyLength only; the visible invalidation is an on-disk property of the selector.
    const selector = JSON.parse(readFileSync(join(FEATURE_HOME, 'current-decisions.json'), 'utf8')) as {
      features: Record<string, { history: Array<{ kind: string; reason: string }> }>;
    };
    const history = selector.features['sso-login'].history;
    expect(history.some((h) => h.kind === 'currentSpec' && /invalidated by PRD advance/.test(h.reason))).toBe(true);
    expect(history.some((h) => h.kind === 'currentPrd' && /superseded by approval/.test(h.reason))).toBe(true);
  });

  it('plan-prep now HOLDS with spec_agreement_missing — renewed agreement is required', () => {
    expectHold(run(['--check-plan-prep', '--feature', 'sso-login']), 'spec_agreement_missing');
  });

  it('the OLD matches attempt no longer gates presentation — its prdRef binds the superseded PRD', () => {
    expectHold(
      run(['--check-presentation', '--feature', 'sso-login', '--spec', 'docs/features/spec.md']),
      'matches_attempt_missing',
    );
  });

  it('--pre-mechanism after a mechanism-recorded pointer → pre_mechanism_not_applicable', () => {
    const v3 = writeRel('docs/features/prd-v3.md', '# PRD v3\n\nThird approval.\n');
    const receipt = writeJson(
      'prd3.json',
      {
        featureId: 'sso-login',
        decision: 'approved',
        approvedSha256: v3,
        snapshotRef: { path: 'docs/features/prd-v3.md', sha256: v3 },
        approvalRecordRef: { path: 'docs/features/approval.md', sha256: approvalSha },
        approver: 'operator',
      },
    );
    expectHold(
      advance(['--advance-prd', '--feature', 'sso-login', '--receipt', receipt, '--pre-mechanism']),
      'pre_mechanism_not_applicable',
    );
  });
});

// ---------------------------------------------------------------------------
// Pre-mechanism bootstrap on a second feature (decisions predating the mechanism).
// ---------------------------------------------------------------------------
describe('current-decisions — pre-mechanism bootstrap', () => {
  const billingPrd = writeRel('docs/features/billing-prd.md', '# Billing PRD\n\nInvoices list line items.\n');
  const billingPrd2 = writeRel('docs/features/billing-prd-v2.md', '# Billing PRD v2\n\nInvoices list line items and taxes.\n');
  const billingSpec = writeRel('docs/features/billing-spec.md', '# Billing spec\n\nInvoice view lists line items.\n');

  it('seeds a PRD pointer with provenance pre-mechanism-seed, then allows a newer pre-mechanism supersession', () => {
    const r1 = writeJson('billing-prd.json', {
      featureId: 'billing',
      decision: 'approved',
      approvedSha256: billingPrd,
      snapshotRef: { path: 'docs/features/billing-prd.md', sha256: billingPrd },
      approvalRecordRef: { path: 'docs/features/billing-prd.md', sha256: billingPrd },
      approver: 'operator',
    });
    const first = advance(['--advance-prd', '--feature', 'billing', '--receipt', r1, '--pre-mechanism']);
    expect(first.status, first.stderr).toBe(0);
    const read1 = out(run(['--read', '--feature', 'billing']));
    expect((read1.currentPrd as { provenance?: string }).provenance).toBe('pre-mechanism-seed');

    const r2 = writeJson('billing-prd2.json', {
      featureId: 'billing',
      decision: 'approved',
      approvedSha256: billingPrd2,
      snapshotRef: { path: 'docs/features/billing-prd-v2.md', sha256: billingPrd2 },
      approvalRecordRef: { path: 'docs/features/billing-prd.md', sha256: billingPrd },
      approver: 'operator',
    });
    const second = advance(['--advance-prd', '--feature', 'billing', '--receipt', r2, '--pre-mechanism']);
    expect(second.status, second.stderr).toBe(0);
  });

  it('seeds a spec agreement WITHOUT a published matches attempt (the honest bootstrap carve-out)', () => {
    const receipt = writeJson('billing-spec.json', {
      featureId: 'billing',
      decision: 'agreed',
      operatorEvidence: "operator: 'agreed pre-mechanism'",
      specRef: { path: 'docs/features/billing-spec.md', sha256: billingSpec },
      agreementRecordRef: { path: 'docs/features/billing-prd.md', sha256: billingPrd },
      parentPrdSha256: billingPrd2,
    });
    const r = advance(['--advance-spec', '--feature', 'billing', '--receipt', receipt, '--pre-mechanism']);
    expect(r.status, r.stderr).toBe(0);
    const read = out(run(['--read', '--feature', 'billing']));
    expect((read.currentSpec as { provenance?: string }).provenance).toBe('pre-mechanism-seed');
  });

  it('the carve-out is refused once the spec pointer is MECHANISM-recorded (a seeded pointer only re-seeds)', () => {
    // Re-seeding the seeded pointer with NEWER spec bytes stays allowed (bootstrap semantics);
    // the refusal needs a mechanism-recorded pointer — publish a matches attempt, advance normally.
    const billingSpec2 = writeRel('docs/features/billing-spec-v2.md', '# Billing spec v2\n\nInvoice view lists line items and taxes.\n');
    const attemptPath2 = writeJson('billing-attempt.json', {
      kind: 'spec-review',
      version: 1,
      featureId: 'billing',
      prdRef: { path: 'docs/features/billing-prd-v2.md', sha256: billingPrd2 },
      specRef: { path: 'docs/features/billing-spec-v2.md', sha256: billingSpec2 },
      approvalRef: { path: 'docs/features/billing-prd-v2.md', sha256: billingPrd2 },
      reviewer: {
        independence: 'fresh artifact-only seat',
        context: 'judged from the approved PRD and the unlabeled candidate spec',
        documents: [
          { path: 'docs/features/billing-prd-v2.md', sha256: billingPrd2 },
          { path: 'docs/features/billing-spec-v2.md', sha256: billingSpec2 },
        ],
      },
      promises: [
        {
          id: 'B1',
          comparison: 'supported',
          reason: 'the spec covers the invoiced line items the PRD requires',
          citations: [
            { source: 'prd', quote: 'Invoices list line items', location: 'docs/features/billing-prd-v2.md:3' },
            { source: 'spec', quote: 'lists line items', location: 'docs/features/billing-spec-v2.md:3' },
          ],
        },
      ],
      outcome: 'matches',
    });
    const published = runPublish(['--attempt', attemptPath2]);
    expect(published.status, published.stderr).toBe(0);
    const mechanismReceipt = writeJson('billing-spec-mech.json', {
      featureId: 'billing',
      decision: 'agreed',
      operatorEvidence: "operator: 'agreed v2 spec'",
      specRef: { path: 'docs/features/billing-spec-v2.md', sha256: billingSpec2 },
      agreementRecordRef: { path: 'docs/features/billing-prd.md', sha256: billingPrd },
      parentPrdSha256: billingPrd2,
    });
    const advanced = advance(['--advance-spec', '--feature', 'billing', '--receipt', mechanismReceipt]);
    expect(advanced.status, advanced.stderr).toBe(0);

    const thirdSpec = writeRel('docs/features/billing-spec-v3.md', '# Billing spec v3\n\nThird.\n');
    const receipt = writeJson('billing-spec3.json', {
      featureId: 'billing',
      decision: 'agreed',
      operatorEvidence: "operator: 'third agreement'",
      specRef: { path: 'docs/features/billing-spec-v3.md', sha256: thirdSpec },
      agreementRecordRef: { path: 'docs/features/billing-prd.md', sha256: billingPrd },
      parentPrdSha256: billingPrd2,
    });
    expectHold(
      advance(['--advance-spec', '--feature', 'billing', '--receipt', receipt, '--pre-mechanism']),
      'pre_mechanism_not_applicable',
    );
  });
});

// ---------------------------------------------------------------------------
// Selector-level rejects (crafted selectors in a separate orch-home).
// ---------------------------------------------------------------------------
describe('current-decisions — selector-level rejects', () => {
  const ORCH_ALT = mkdtempSync(resolve(tmpdir(), 'intent-current-decisions-alt-'));
  const ALT_HOME = join(ORCH_ALT, 'intent-continuity');
  const identity = realpathSync(join(ROOT, '.git'));

  it('a selector bound to another repository identity → foreign_repository (decisions do not travel across clones)', () => {
    mkdirSync(ALT_HOME, { recursive: true });
    writeFileSync(
      join(ALT_HOME, 'current-decisions.json'),
      JSON.stringify({ version: 1, repoIdentity: '/definitely/another/clone', features: { 'sso-login': { revision: 1, currentPrd: null, currentSpec: null, history: [] } } }),
      'utf8',
    );
    expectHold(run(['--read', '--feature', 'sso-login'], ORCH_ALT), 'foreign_repository');
  });

  it('a selector of an unsupported schema version → selector_conflicting', () => {
    writeFileSync(
      join(ALT_HOME, 'current-decisions.json'),
      JSON.stringify({ version: 9, repoIdentity: identity, features: {} }),
      'utf8',
    );
    expectHold(run(['--read', '--feature', 'sso-login'], ORCH_ALT), 'selector_conflicting');
  });

  it('a selector that is not valid JSON → selector_conflicting (unreadable state holds)', () => {
    writeFileSync(join(ALT_HOME, 'current-decisions.json'), '{not json', 'utf8');
    expectHold(run(['--read', '--feature', 'sso-login'], ORCH_ALT), 'selector_conflicting');
  });

  it('orch-home resolves through the AIF_INTENT_ORCH_HOME env fallback when the flag is absent', () => {
    // Pin: the default-resolution chain (flag → env → default). Only the env branch is
    // hermetically testable — the bare default writes into the real repo's orch-home.
    writeFileSync(
      join(ALT_HOME, 'current-decisions.json'),
      JSON.stringify({ version: 1, repoIdentity: '/definitely/another/clone', features: {} }),
      'utf8',
    );
    const envRun = spawnSync(
      'node',
      [HELPER, '--read', '--feature', 'sso-login', '--repo-root', ROOT],
      { encoding: 'utf8', timeout: 30_000, env: { ...process.env, AIF_INTENT_ORCH_HOME: ORCH_ALT } },
    );
    expect(envRun.status, envRun.stderr || envRun.stdout).toBe(2);
    expect((JSON.parse(envRun.stdout) as Out).code).toBe('foreign_repository');
  });
});

// ---------------------------------------------------------------------------
// Lock contention — the exclusive writer lock holds rather than interleaving.
// ---------------------------------------------------------------------------
describe('current-decisions — writer lock', () => {
  it('a held .selector.lock → lock_contended, and releasing it unblocks the advance', () => {
    mkdirSync(join(FEATURE_HOME, '.selector.lock'), { recursive: true });
    expectHold(advance(['--advance-prd', '--feature', 'sso-login', '--receipt', prd2ReceiptPath]), 'lock_contended');
    rmSync(join(FEATURE_HOME, '.selector.lock'), { recursive: true, force: true });
    // prd2 is already current (revision 3) → replay hold proves the selector is intact after contention.
    expectHold(advance(['--advance-prd', '--feature', 'sso-login', '--receipt', prd2ReceiptPath]), 'superseded_receipt_replay');
  });
});

// ---------------------------------------------------------------------------
// Canon-symlink sharing — an atomic advance writes THROUGH a final-component
// symlink (the coordination-canon pattern), never on top of it. Sibling
// worktrees of one repository resolve the SAME repoIdentity (gitdir worktrees/
// suffix is stripped), so replacing the link with local bytes would fork the
// selector into two divergent, both-valid copies — the MINOR 8 bypass.
// ---------------------------------------------------------------------------
describe('current-decisions — canon-symlink sharing', () => {
  it('an advance over a canon-symlinked selector preserves the link and advances the SHARED file', () => {
    // Pin (T22): the single flipping predicate is resolveWriteTarget following the
    // final-component symlink chain — the scenario is otherwise a plain two-advance
    // lifecycle (same feature, receipts, orch-home; RED was proven against the
    // pre-fix helper bytes: link REPLACED, canon left at revision 1).
    const ORCH_LINK = mkdtempSync(resolve(tmpdir(), 'intent-current-decisions-link-'));
    const SHARED = mkdtempSync(resolve(tmpdir(), 'intent-current-decisions-canon-'));
    const prdA = writeRel('docs/features/canon-prd.md', '# Canon PRD v1\n\nShared selector across worktrees.\n');
    const prdB = writeRel('docs/features/canon-prd-v2.md', '# Canon PRD v2\n\nSecond approval.\n');
    const r1 = writeJson('canon-prd1.json', {
      featureId: 'canon',
      decision: 'approved',
      approvedSha256: prdA,
      snapshotRef: { path: 'docs/features/canon-prd.md', sha256: prdA },
      approvalRecordRef: { path: 'docs/features/approval.md', sha256: approvalSha },
      approver: 'operator',
    });
    const r2 = writeJson('canon-prd2.json', {
      featureId: 'canon',
      decision: 'approved',
      approvedSha256: prdB,
      snapshotRef: { path: 'docs/features/canon-prd-v2.md', sha256: prdB },
      approvalRecordRef: { path: 'docs/features/approval.md', sha256: approvalSha },
      approver: 'operator',
    });

    const first = advance(['--advance-prd', '--feature', 'canon', '--receipt', r1], ORCH_LINK);
    expect(first.status, first.stderr).toBe(0);

    const selectorAbs = join(ORCH_LINK, 'intent-continuity', 'current-decisions.json');
    const sharedFile = join(SHARED, 'current-decisions.json');
    renameSync(selectorAbs, sharedFile); // move the seeded selector to the shared canon
    symlinkSync(sharedFile, selectorAbs); // link this checkout's orch-home to the canon

    const second = advance(['--advance-prd', '--feature', 'canon', '--receipt', r2], ORCH_LINK);
    expect(second.status, second.stderr).toBe(0);
    expect(out(second)).toMatchObject({ ok: true, revision: 2, advanced: 'currentPrd' });

    expect(lstatSync(selectorAbs).isSymbolicLink()).toBe(true); // the link SURVIVED the write
    const shared = JSON.parse(readFileSync(sharedFile, 'utf8')) as {
      features: Record<string, { revision: number }>;
    };
    expect(shared.features.canon.revision).toBe(2); // the CANON advanced, not a local fork
    expect(readdirSync(join(ORCH_LINK, 'intent-continuity')).some((f) => f.includes('.tmp-'))).toBe(false); // no temp residue
    expect(readdirSync(SHARED).some((f) => f.includes('.tmp-'))).toBe(false); // rename consumed the shared-dir temp
    expect(out(run(['--read', '--feature', 'canon'], ORCH_LINK)).revision).toBe(2); // reads see shared state
  });
});

// ---------------------------------------------------------------------------
// Canon lock domain — the exclusive writer lock must guard the RESOLVED shared
// target, not this checkout's local spelling of it. Two sibling worktrees of one
// repository whose selectors symlink to ONE canon file resolve distinct local
// `.selector.lock` dirs under a local-domain lock: both "hold the lock" while
// their read-modify-write cycles interleave on the canon selector (lost update —
// kickoff §2(2) exclusive writer + shared repository decision). The freeze writer
// takes the same lock, so its domain follows the selector's canon too.
// ---------------------------------------------------------------------------
describe('current-decisions — canon lock domain', () => {
  it('a lock held at the CANON target → lock_contended from a sibling worktree; release unblocks and advances the canon', () => {
    // Pin (T22): the single flipping predicate is acquireLock resolving the lock
    // directory from the selector's RESOLVED write target — the scenario is otherwise a
    // plain bootstrap-then-link-then-advance lifecycle. RED against the pre-fix bytes:
    // worktree B locked its own local .selector.lock and advanced the shared canon anyway.
    const CANON = mkdtempSync(resolve(tmpdir(), 'intent-current-decisions-lock-canon-'));
    const WT_A = mkdtempSync(resolve(tmpdir(), 'intent-current-decisions-lock-wt-a-'));
    const WT_B = mkdtempSync(resolve(tmpdir(), 'intent-current-decisions-lock-wt-b-'));
    const prdA = writeRel('docs/features/clock-prd.md', '# Lock PRD v1\n\nShared selector across sibling worktrees.\n');
    const prdB = writeRel('docs/features/clock-prd-v2.md', '# Lock PRD v2\n\nSecond approval.\n');
    const r1 = writeJson('clock-prd1.json', {
      featureId: 'canon-lock',
      decision: 'approved',
      approvedSha256: prdA,
      snapshotRef: { path: 'docs/features/clock-prd.md', sha256: prdA },
      approvalRecordRef: { path: 'docs/features/approval.md', sha256: approvalSha },
      approver: 'operator',
    });
    const r2 = writeJson('clock-prd2.json', {
      featureId: 'canon-lock',
      decision: 'approved',
      approvedSha256: prdB,
      snapshotRef: { path: 'docs/features/clock-prd-v2.md', sha256: prdB },
      approvalRecordRef: { path: 'docs/features/approval.md', sha256: approvalSha },
      approver: 'operator',
    });

    const first = advance(['--advance-prd', '--feature', 'canon-lock', '--receipt', r1], WT_A);
    expect(first.status, first.stderr).toBe(0);

    const canonFile = join(CANON, 'current-decisions.json');
    const selectorA = join(WT_A, 'intent-continuity', 'current-decisions.json');
    const selectorB = join(WT_B, 'intent-continuity', 'current-decisions.json');
    renameSync(selectorA, canonFile); // the seeded selector becomes the shared canon
    symlinkSync(canonFile, selectorA); // both sibling checkouts of ONE repo link to it
    mkdirSync(dirname(selectorB), { recursive: true });
    symlinkSync(canonFile, selectorB);

    mkdirSync(join(CANON, '.selector.lock')); // a writer already holds the CANON lock
    expectHold(advance(['--advance-prd', '--feature', 'canon-lock', '--receipt', r2], WT_B), 'lock_contended');
    expect(JSON.parse(readFileSync(canonFile, 'utf8')).features['canon-lock'].revision).toBe(1); // held means untouched
    rmSync(join(CANON, '.selector.lock'), { recursive: true, force: true });

    const second = advance(['--advance-prd', '--feature', 'canon-lock', '--receipt', r2], WT_B);
    expect(second.status, second.stderr).toBe(0);
    expect(out(second)).toMatchObject({ ok: true, revision: 2, advanced: 'currentPrd' });
    const shared = JSON.parse(readFileSync(canonFile, 'utf8')) as { features: Record<string, { revision: number }> };
    expect(shared.features['canon-lock'].revision).toBe(2); // the CANON advanced
    expect(existsSync(join(WT_B, 'intent-continuity', '.selector.lock'))).toBe(false); // B never locks locally
  });

  it('the freeze writer contends on the SAME canon lock (one writer authority for the feature home)', () => {
    // Pin (T22): the flipping predicate is the shared acquireLock — the freeze verb's
    // lock domain follows the selector's resolved canon target too. RED against the
    // pre-fix bytes: the freeze locked its local featureHome and wrote through anyway.
    const CANON = mkdtempSync(resolve(tmpdir(), 'intent-current-decisions-freeze-canon-'));
    const WT = mkdtempSync(resolve(tmpdir(), 'intent-current-decisions-freeze-wt-'));
    const selectorLink = join(WT, 'intent-continuity', 'current-decisions.json');
    const freezeLink = join(WT, 'intent-continuity', 'legacy-freeze.json');
    mkdirSync(dirname(selectorLink), { recursive: true });
    symlinkSync(join(CANON, 'current-decisions.json'), selectorLink); // may dangle — the lock domain resolves through the link
    symlinkSync(join(CANON, 'legacy-freeze.json'), freezeLink);

    mkdirSync(join(CANON, '.selector.lock')); // a writer already holds the CANON lock
    expectHold(run(['--freeze-legacy'], WT), 'lock_contended');
    rmSync(join(CANON, '.selector.lock'), { recursive: true, force: true });

    const frozen = run(['--freeze-legacy'], WT);
    expect(frozen.status, frozen.stderr).toBe(0);
    expect(out(frozen)).toMatchObject({ ok: true, frozen: 0 });
    expect(lstatSync(freezeLink).isSymbolicLink()).toBe(true); // the local link SURVIVED the write
    expect(existsSync(join(CANON, 'legacy-freeze.json'))).toBe(true); // the freeze landed on the canon
    expect(readdirSync(CANON).some((f) => f.includes('.tmp-'))).toBe(false);
  });

  it('a selector symlink chain deeper than the resolution bound → write_target_unresolvable (fail closed, the chain is never replaced)', () => {
    // Pin (T22): the flipping predicate is resolveWriteTarget rejecting after the depth
    // bound instead of returning a still-symlink path. RED against the pre-fix bytes:
    // the advance SUCCEEDED and renamed the temp onto a mid-chain symlink (deep-hop-2),
    // replacing it with a regular file — the chain forks partway down.
    const ORCH_DEEP = mkdtempSync(resolve(tmpdir(), 'intent-current-decisions-deep-'));
    const homeDeep = join(ORCH_DEEP, 'intent-continuity');
    const prdA = writeRel('docs/features/deep-prd.md', '# Deep PRD v1\n\nSelector behind a long symlink chain.\n');
    const prdB = writeRel('docs/features/deep-prd-v2.md', '# Deep PRD v2\n\nSecond approval.\n');
    const r1 = writeJson('deep-prd1.json', {
      featureId: 'deep-chain',
      decision: 'approved',
      approvedSha256: prdA,
      snapshotRef: { path: 'docs/features/deep-prd.md', sha256: prdA },
      approvalRecordRef: { path: 'docs/features/approval.md', sha256: approvalSha },
      approver: 'operator',
    });
    const r2 = writeJson('deep-prd2.json', {
      featureId: 'deep-chain',
      decision: 'approved',
      approvedSha256: prdB,
      snapshotRef: { path: 'docs/features/deep-prd-v2.md', sha256: prdB },
      approvalRecordRef: { path: 'docs/features/approval.md', sha256: approvalSha },
      approver: 'operator',
    });

    const seed = advance(['--advance-prd', '--feature', 'deep-chain', '--receipt', r1], ORCH_DEEP);
    expect(seed.status, seed.stderr).toBe(0);

    const realFile = join(homeDeep, 'current-decisions.real.json');
    renameSync(join(homeDeep, 'current-decisions.json'), realFile);
    let hop = realFile;
    for (let i = 0; i < 10; i += 1) {
      const link = join(homeDeep, `deep-hop-${i}.json`);
      symlinkSync(hop, link);
      hop = link;
    }
    symlinkSync(hop, join(homeDeep, 'current-decisions.json')); // 11 links deep > the 8-follow bound

    expectHold(advance(['--advance-prd', '--feature', 'deep-chain', '--receipt', r2], ORCH_DEEP), 'write_target_unresolvable');
    expect(lstatSync(join(homeDeep, 'current-decisions.json')).isSymbolicLink()).toBe(true); // top link intact
    expect(lstatSync(join(homeDeep, 'deep-hop-2.json')).isSymbolicLink()).toBe(true); // pre-fix renamed onto THIS link
    const real = JSON.parse(readFileSync(realFile, 'utf8')) as { features: Record<string, { revision: number }> };
    expect(real.features['deep-chain'].revision).toBe(1); // the real target is untouched
    expect(readdirSync(homeDeep).some((f) => f.includes('.tmp-'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Cold-review REVISE blockers (2026-10-13): (1) lock→write TOCTOU — the resolved
// write target must be BOUND at lock time and re-verified at write time, so a
// selector symlink retargeted between the two resolutions fails closed instead
// of writing a file this lock does not guard; (2) stale historical replay —
// after A→B, replaying the older valid A receipt must be rejected under the
// lock (history twin), and the kickoff §2(2) prior-revision compare is surfaced
// as an explicit --expect-revision token compared UNDER the lock.
// ---------------------------------------------------------------------------
describe('current-decisions — REVISE: retarget binding, stale replay, expected prior revision', () => {
  it('a mechanism advance without a prepared prior revision → expected_revision_required', () => {
    // A documented token-free recorder call must not silently choose a newly-current
    // revision. This is the narrow negative case absent from the prior CAS arm.
    const prd = writeRel('docs/features/untokened-prd.md', '# Untokened PRD\n\nNew decision.\n');
    const receipt = writeJson('untokened-prd.json', {
      featureId: 'untokened', decision: 'approved', approvedSha256: prd,
      snapshotRef: { path: 'docs/features/untokened-prd.md', sha256: prd },
      approvalRecordRef: { path: 'docs/features/approval.md', sha256: approvalSha }, approver: 'operator',
    });
    expectHold(run(['--advance-prd', '--feature', 'untokened', '--receipt', receipt]), 'expected_revision_required');
    const read = out(run(['--read', '--feature', 'untokened']));
    expect(read.ok).toBe(false);
    expect(['selector_missing', 'feature_missing']).toContain(read.code);
  });
  it('replaying the SUPERSEDED prd A after A→B → superseded_receipt_replay (history twin; the pointer never regresses)', () => {
    // Pin (T22): the single flipping predicate is the history scan added to the PRD branch
    // of advanceUnderLock — the current-equality check alone lets the older valid receipt
    // through. RED against the pre-REVISE bytes: the replay SUCCEEDED, reverting the
    // pointer to A at revision 3.
    const prdA = writeRel('docs/features/replay-prd.md', '# Replay PRD v1\n\nFirst approval.\n');
    const prdB = writeRel('docs/features/replay-prd-v2.md', '# Replay PRD v2\n\nSecond approval.\n');
    const r1 = writeJson('replay-prd1.json', {
      featureId: 'replay',
      decision: 'approved',
      approvedSha256: prdA,
      snapshotRef: { path: 'docs/features/replay-prd.md', sha256: prdA },
      approvalRecordRef: { path: 'docs/features/approval.md', sha256: approvalSha },
      approver: 'operator',
    });
    const r2 = writeJson('replay-prd2.json', {
      featureId: 'replay',
      decision: 'approved',
      approvedSha256: prdB,
      snapshotRef: { path: 'docs/features/replay-prd-v2.md', sha256: prdB },
      approvalRecordRef: { path: 'docs/features/approval.md', sha256: approvalSha },
      approver: 'operator',
    });
    const first = advance(['--advance-prd', '--feature', 'replay', '--receipt', r1]);
    expect(first.status, first.stderr).toBe(0);
    const second = advance(['--advance-prd', '--feature', 'replay', '--receipt', r2]);
    expect(second.status, second.stderr).toBe(0);
    expectHold(advance(['--advance-prd', '--feature', 'replay', '--receipt', r1]), 'superseded_receipt_replay');
    const read = out(run(['--read', '--feature', 'replay']));
    expect(read.revision).toBe(2);
    expect((read.currentPrd as { approvedSha256: string }).approvedSha256).toBe(prdB); // never regressed to A
  });

  it('replaying the superseded spec S1 after S1→S2 → superseded_receipt_replay (history twin on the spec side)', () => {
    // Pin (T22): the flipping predicate is the history scan added to the SPEC branch —
    // parentPrdSha256 and current-equality checks alone let the stale agreement through.
    // RED against the pre-REVISE bytes: the replay regressed the pointer to S1 at
    // revision 4. All three agreements are --pre-mechanism so the published-matches
    // precondition cannot mask the history predicate.
    const prdA = writeRel('docs/features/spec-replay-prd.md', '# Spec-replay PRD\n\nOne approval throughout.\n');
    const s1 = writeRel('docs/features/spec-replay-s1.md', '# Spec v1\n\nFirst agreement.\n');
    const s2 = writeRel('docs/features/spec-replay-s2.md', '# Spec v2\n\nSecond agreement.\n');
    const prd = writeJson('spec-replay-prd.json', {
      featureId: 'spec-replay',
      decision: 'approved',
      approvedSha256: prdA,
      snapshotRef: { path: 'docs/features/spec-replay-prd.md', sha256: prdA },
      approvalRecordRef: { path: 'docs/features/approval.md', sha256: approvalSha },
      approver: 'operator',
    });
    const spec = (name: string, sha: string, path: string) =>
      writeJson(name, {
        featureId: 'spec-replay',
        decision: 'agreed',
        operatorEvidence: "operator: 'agreed by digest'",
        specRef: { path, sha256: sha },
        agreementRecordRef: { path: 'docs/features/approval.md', sha256: approvalSha },
        parentPrdSha256: prdA,
      });
    const sp1 = spec('spec-replay-s1.json', s1, 'docs/features/spec-replay-s1.md');
    const sp2 = spec('spec-replay-s2.json', s2, 'docs/features/spec-replay-s2.md');
    const seedPrd = advance(['--advance-prd', '--feature', 'spec-replay', '--receipt', prd]);
    expect(seedPrd.status, seedPrd.stderr).toBe(0);
    const a1 = advance(['--advance-spec', '--feature', 'spec-replay', '--receipt', sp1, '--pre-mechanism']);
    expect(a1.status, a1.stderr).toBe(0);
    const a2 = advance(['--advance-spec', '--feature', 'spec-replay', '--receipt', sp2, '--pre-mechanism']);
    expect(a2.status, a2.stderr).toBe(0);
    expectHold(advance(['--advance-spec', '--feature', 'spec-replay', '--receipt', sp1, '--pre-mechanism']), 'superseded_receipt_replay');
    const read = out(run(['--read', '--feature', 'spec-replay']));
    expect(read.revision).toBe(3);
    expect(((read.currentSpec as { specRef: { sha256: string } }).specRef).sha256).toBe(s2); // never regressed to S1
  });

  it('--expect-revision compares the prior revision UNDER the lock: match advances, mismatch holds expected_revision_mismatch', () => {
    // Pin (T22): the flipping predicate is the entry.revision compare against the parsed
    // --expect-revision token inside advanceUnderLock. RED against the pre-REVISE bytes:
    // the flag was absorbed as an unknown option and the stale advance SUCCEEDED.
    const prdA = writeRel('docs/features/cas-prd.md', '# CAS PRD v1\n\nFirst approval.\n');
    const prdB = writeRel('docs/features/cas-prd-v2.md', '# CAS PRD v2\n\nSecond approval.\n');
    const prdC = writeRel('docs/features/cas-prd-v3.md', '# CAS PRD v3\n\nThird approval.\n');
    const receipt = (name: string, sha: string, path: string) =>
      writeJson(name, {
        featureId: 'cas',
        decision: 'approved',
        approvedSha256: sha,
        snapshotRef: { path, sha256: sha },
        approvalRecordRef: { path: 'docs/features/approval.md', sha256: approvalSha },
        approver: 'operator',
      });
    const rA = receipt('cas-prd1.json', prdA, 'docs/features/cas-prd.md');
    const rB = receipt('cas-prd2.json', prdB, 'docs/features/cas-prd-v2.md');
    const rC = receipt('cas-prd3.json', prdC, 'docs/features/cas-prd-v3.md');
    const first = advance(['--advance-prd', '--feature', 'cas', '--receipt', rA]);
    expect(first.status, first.stderr).toBe(0);

    const second = advance(['--advance-prd', '--feature', 'cas', '--receipt', rB, '--expect-revision', '1']);
    expect(second.status, second.stderr).toBe(0); // correct prior revision → advances
    expect(out(second)).toMatchObject({ ok: true, revision: 2, advanced: 'currentPrd' });

    expectHold(advance(['--advance-prd', '--feature', 'cas', '--receipt', rC, '--expect-revision', '1']), 'expected_revision_mismatch');
    const held = out(run(['--read', '--feature', 'cas']));
    expect(held.revision).toBe(2);
    expect((held.currentPrd as { approvedSha256: string }).approvedSha256).toBe(prdB); // the stale compare held the write

    const third = advance(['--advance-prd', '--feature', 'cas', '--receipt', rC, '--expect-revision', '2']);
    expect(third.status, third.stderr).toBe(0);
    expect(out(third)).toMatchObject({ ok: true, revision: 3, advanced: 'currentPrd' });

    // Bootstrap preservation: a brand-new feature entry starts at revision 0.
    const bootReceipt = writeJson('cas-boot.json', {
      featureId: 'cas-bootstrap',
      decision: 'approved',
      approvedSha256: prdA,
      snapshotRef: { path: 'docs/features/cas-prd.md', sha256: prdA },
      approvalRecordRef: { path: 'docs/features/approval.md', sha256: approvalSha },
      approver: 'operator',
    });
    const boot = advance(['--advance-prd', '--feature', 'cas-bootstrap', '--receipt', bootReceipt, '--expect-revision', '0']);
    expect(boot.status, boot.stderr).toBe(0);
    expect(out(boot)).toMatchObject({ ok: true, featureId: 'cas-bootstrap', revision: 1 });
  });

  it('a selector retarget between lock and write → write_target_retargeted (the write is bound to the locked target)', async () => {
    // Pin (T22): the flipping predicate is writeSelectorAtomic re-resolving the target and
    // comparing it to the one bound at acquireLock time. The lock→write interval is forced
    // open by a padded (~15 MB) selector: the writer spends hundreds of milliseconds
    // reading+parsing it between mkdir of the lock and the write, while this test polls for
    // the lock dir and retargets the selector symlink mid-transaction. RED against the
    // pre-REVISE bytes: the writer re-resolved to the NEW target and advanced it (exit 0,
    // revision 2) although the transaction had locked the OLD canon directory.
    const ORCH_RT = mkdtempSync(resolve(tmpdir(), 'intent-current-decisions-retarget-'));
    const CANON1 = mkdtempSync(resolve(tmpdir(), 'intent-current-decisions-rt-c1-'));
    const CANON2 = mkdtempSync(resolve(tmpdir(), 'intent-current-decisions-rt-c2-'));
    const home = join(ORCH_RT, 'intent-continuity');
    const prdA = writeRel('docs/features/rt-prd.md', '# RT PRD v1\n\nFirst approval.\n');
    const prdB = writeRel('docs/features/rt-prd-v2.md', '# RT PRD v2\n\nSecond approval.\n');
    const rB = writeJson('rt-prd2.json', {
      featureId: 'retarget',
      decision: 'approved',
      approvedSha256: prdB,
      snapshotRef: { path: 'docs/features/rt-prd-v2.md', sha256: prdB },
      approvalRecordRef: { path: 'docs/features/approval.md', sha256: approvalSha },
      approver: 'operator',
    });
    const identity = realpathSync(join(ROOT, '.git'));
    const prdEntry = {
      recorder: 'intent-approval',
      decision: 'approved',
      approvedSha256: prdA,
      snapshotRef: { path: 'docs/features/rt-prd.md', sha256: prdA },
      approvalRecordRef: { path: 'docs/features/approval.md', sha256: approvalSha },
      approver: 'operator',
      recordedAt: '2026-10-13T00:00:00.000Z',
    };
    const pad = Array.from({ length: 200_000 }, (_, i) => ({
      revision: 0,
      at: '2026-10-13T00:00:00.000Z',
      kind: 'currentPrd',
      reason: `selector padding ${i}`,
      entry: null,
    }));
    const base = { version: 1, repoIdentity: identity, features: { retarget: { revision: 1, currentPrd: prdEntry, currentSpec: null } } };
    writeFileSync(join(CANON1, 'current-decisions.json'), JSON.stringify({ ...base, features: { retarget: { ...base.features.retarget, history: pad } } }));
    writeFileSync(join(CANON2, 'current-decisions.json'), JSON.stringify({ ...base, features: { retarget: { ...base.features.retarget, history: [] } } }));
    mkdirSync(home, { recursive: true });
    const selector = join(home, 'current-decisions.json');
    symlinkSync(join(CANON1, 'current-decisions.json'), selector);
    const lockAtCanon1 = join(CANON1, '.selector.lock');

    const proc = spawn('node', [HELPER, '--advance-prd', '--feature', 'retarget', '--receipt', rB, '--expect-revision', '1', '--orch-home', ORCH_RT, '--repo-root', ROOT], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    proc.stdout.on('data', (d: Buffer) => {
      stdout += d.toString('utf8');
    });
    let lockSeen = false;
    for (let i = 0; i < 5_000 && !lockSeen; i += 1) {
      if (existsSync(lockAtCanon1)) lockSeen = true;
      else await new Promise((r) => setTimeout(r, 2));
    }
    expect(lockSeen, 'the writer must create the CANON1 lock before its write').toBe(true);
    // Retarget MID-TRANSACTION: the lock stays at CANON1, the selector now resolves CANON2.
    rmSync(selector);
    symlinkSync(join(CANON2, 'current-decisions.json'), selector);
    const exit = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((res) => {
      proc.on('exit', (code, signal) => res({ code, signal }));
    });
    expect(exit.signal).toBeNull();
    expect(exit.code, stdout).toBe(2);
    const parsed = JSON.parse(stdout) as Out;
    expect(parsed.code).toBe('write_target_retargeted');
    // Neither canon advanced; no temp residue; the link survived; the lock was released.
    expect(JSON.parse(readFileSync(join(CANON2, 'current-decisions.json'), 'utf8')).features.retarget.revision).toBe(1);
    expect(JSON.parse(readFileSync(join(CANON1, 'current-decisions.json'), 'utf8')).features.retarget.revision).toBe(1);
    expect(lstatSync(selector).isSymbolicLink()).toBe(true);
    expect(existsSync(lockAtCanon1)).toBe(false);
    expect(readdirSync(CANON1).some((f) => f.includes('.tmp-'))).toBe(false);
    expect(readdirSync(CANON2).some((f) => f.includes('.tmp-'))).toBe(false);
    expect(readdirSync(home).some((f) => f.includes('.tmp-'))).toBe(false);
  }, 30_000);
});

// ---------------------------------------------------------------------------
// Admission freeze + discriminator (design §4 — prevent adoption-by-omission).
// ---------------------------------------------------------------------------
describe('current-decisions — legacy freeze and artifact classification', () => {
  // A separate orch-home INSIDE the repo root so frozen paths are repo-relative.
  const ORCH_FREEZE = join(ROOT, 'orch-freeze');
  const FREEZE_HOME = join(ORCH_FREEZE, 'intent-continuity');
  const legacyKickoff = join(ORCH_FREEZE, 'legacy-thing', 'kickoff.md');
  mkdirSync(dirname(legacyKickoff), { recursive: true });
  const legacyBytes = '# Legacy kickoff\n\nPre-mechanism stage instructions.\n';
  const legacySha = write(legacyKickoff, legacyBytes);

  it('a same-directory freeze link to a different file holds before creating that file', () => {
    const orch = mkdtempSync(resolve(tmpdir(), 'intent-freeze-wrong-target-'));
    const home = join(orch, 'intent-continuity');
    const canon = mkdtempSync(resolve(tmpdir(), 'intent-freeze-canon-'));
    mkdirSync(home, { recursive: true });
    symlinkSync(join(canon, 'current-decisions.json'), join(home, 'current-decisions.json'));
    symlinkSync(join(canon, 'unrelated.json'), join(home, 'legacy-freeze.json'));
    expectHold(run(['--freeze-legacy'], orch), 'write_target_retargeted');
    expect(existsSync(join(canon, 'unrelated.json'))).toBe(false);
    expect(existsSync(join(canon, 'legacy-freeze.json'))).toBe(false);
  });

  it('--freeze-legacy records path+digest pairs write-once; a second call → freeze_exists', () => {
    const r = run(['--freeze-legacy'], ORCH_FREEZE);
    expect(r.status, r.stderr).toBe(0);
    const parsed = out(r);
    expect(parsed.ok).toBe(true);
    expect(parsed.frozen).toBe(1);
    expect(JSON.parse(readFileSync(join(FREEZE_HOME, 'legacy-freeze.json'), 'utf8')).artifacts).toEqual([
      { path: 'orch-freeze/legacy-thing/kickoff.md', sha256: legacySha },
    ]);
    expectHold(run(['--freeze-legacy'], ORCH_FREEZE), 'freeze_exists');
  });

  it('classifies the frozen kickoff as frozen-legacy by BOTH path and digest', () => {
    const r = run(['--classify-artifact', '--path', legacyKickoff], ORCH_FREEZE);
    expect(r.status, r.stderr).toBe(0);
    expect(out(r)).toMatchObject({ classification: 'frozen-legacy', sha256: legacySha });
  });

  it('an edited kickoff (same path, drifted digest) → unknown (the freeze binds exact bytes)', () => {
    write(legacyKickoff, `${legacyBytes}<!-- edited later -->`);
    const r = run(['--classify-artifact', '--path', legacyKickoff], ORCH_FREEZE);
    expect(r.status, r.stderr).toBe(0);
    expect(out(r)).toMatchObject({ classification: 'unknown' });
    write(legacyKickoff, legacyBytes); // restore
  });

  it('an unfrozen artifact → unknown; and without a freeze at all → freeze_missing', () => {
    const r = run(['--classify-artifact', '--path', join(ROOT, 'docs/features/spec.md')], ORCH_FREEZE);
    expect(r.status, r.stderr).toBe(0);
    expect(out(r)).toMatchObject({ classification: 'unknown' });
    const ORCH_EMPTY = join(ROOT, 'orch-empty');
    expectHold(run(['--classify-artifact', '--path', join(ROOT, 'docs/features/spec.md')], ORCH_EMPTY), 'freeze_missing');
  });

  it('a freeze copied from ANOTHER repository identity → freeze_foreign_repository (a copied freeze classifies nothing here)', () => {
    // Pin: the freeze's repoIdentity must match this checkout's resolved identity, same rule
    // as the selector — the flipping predicate is the identity compare in classifyArtifactVerb.
    const ORCH_FOREIGN = mkdtempSync(resolve(tmpdir(), 'intent-current-decisions-foreign-'));
    mkdirSync(join(ORCH_FOREIGN, 'intent-continuity'), { recursive: true });
    writeFileSync(
      join(ORCH_FOREIGN, 'intent-continuity', 'legacy-freeze.json'),
      JSON.stringify({
        version: 1,
        repoIdentity: '/definitely/another/clone',
        frozenAt: '2026-10-12T00:00:00.000Z',
        artifacts: [{ path: 'docs/features/spec.md', sha256: specSha }],
        taskIds: [],
      }),
      'utf8',
    );
    expectHold(
      run(['--classify-artifact', '--path', join(ROOT, 'docs/features/spec.md')], ORCH_FOREIGN),
      'freeze_foreign_repository',
    );
  });
});

// ---------------------------------------------------------------------------
// Corpus immutability — LAST (corrupts the shared corpus for every later verb).
// ---------------------------------------------------------------------------
describe('current-decisions — corpus immutability', () => {
  it('tampered published attempt bytes → spec_review_invalid:<attemptId> holds every gated transition', () => {
    const corpusDir = join(FEATURE_HOME, 'spec-reviews');
    const [dirName] = readdirSync(corpusDir);
    const published = join(corpusDir, dirName, 'spec-review.json');
    const original = readFileSync(published, 'utf8');
    writeFileSync(published, JSON.stringify({ ...JSON.parse(original), outcome: 'needs-evidence' }), 'utf8');
    const held = expectHold(
      run(['--check-presentation', '--feature', 'sso-login', '--spec', 'docs/features/spec.md']),
      `spec_review_invalid:${dirName}`,
    );
    expect(String(held.reason)).toContain('immutability breach');
  });

  it('a non-dot corpus directory without spec-review.json → spec_review_invalid:corpus (never silently skipped)', () => {
    // Pin: the corpus reader THROWS on a junk entry instead of skipping it — the flipping
    // predicate is the missing-file throw in readPublishedSpecReviews. Runs after the tamper
    // arm (both corrupt the corpus; this describe is last by design).
    mkdirSync(join(FEATURE_HOME, 'spec-reviews', 'junk-entry'));
    expectHold(
      run(['--check-presentation', '--feature', 'sso-login', '--spec', 'docs/features/spec.md']),
      'spec_review_invalid:corpus',
    );
  });
});
