import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const helperHome = fileURLToPath(
  new URL('../../../.agents/procedures/intent/helpers/', import.meta.url),
);
const homes: string[] = [];
afterEach(() => {
  for (const home of homes.splice(0))
    rmSync(home, { recursive: true, force: true });
});

function fixture(
  prd = '# Idea\n\n## Essential promises\n\n| ID | Promise |\n| --- | --- |\n| P1 | Generate rules from docs |\n| P2 | Explain the correction |\n',
) {
  const home = mkdtempSync(join(tmpdir(), 'intent-spec-continuity-'));
  homes.push(home);
  mkdirSync(join(home, '.git'));
  const save = (name: string, bytes: string) => {
    writeFileSync(join(home, name), bytes);
    return {
      path: name,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
  };
  const prdRef = save('prd.md', prd);
  const specRef = save(
    'spec.md',
    '# Spec\nGenerate from docs and explain corrections.\n',
  );
  const approvalRef = save('approval.md', 'Approved for this fixture');
  const review = {
    kind: 'spec-review',
    version: 1,
    featureId: 'test',
    prdRef,
    specRef,
    approvalRef,
    reviewer: {
      independence: 'fresh seat',
      context: 'documents only',
      documents: [prdRef, specRef],
    },
    promises: ['P1', 'P2'].map((id) => ({
      id,
      comparison: 'supported',
      reason: 'Preserved by the specification',
      citations: [
        {
          source: 'spec',
          quote: 'Generate from docs and explain corrections.',
          location: 'spec.md:2',
        },
      ],
    })),
    outcome: 'matches',
  };
  let sequence = 0;
  const invoke = (script: string, args: string[]) => {
    const result = spawnSync('node', [join(helperHome, script), ...args], {
      encoding: 'utf8',
    });
    return {
      status: result.status,
      ...(JSON.parse(result.stdout) as {
        ok: boolean;
        code?: string;
        attemptId?: string;
      }),
    };
  };
  const json = (value: unknown) => {
    const name = `input-${sequence++}.json`;
    save(name, JSON.stringify(value));
    return join(home, name);
  };
  const flags = ['--orch-home', home, '--repo-root', home];
  const publish = (value: unknown) =>
    invoke('publish-spec-review.mjs', ['--attempt', json(value), ...flags]);
  const check = (spec = 'spec.md') =>
    invoke('current-decisions.mjs', [
      '--check-presentation',
      '--feature',
      'test',
      '--spec',
      spec,
      ...flags,
    ]);
  const agree = () =>
    invoke('current-decisions.mjs', [
      '--advance-spec',
      '--feature',
      'test',
      '--expect-revision',
      '1',
      '--receipt',
      json({
        featureId: 'test',
        decision: 'agreed',
        operatorEvidence: 'Agreed for fixture',
        specRef,
        agreementRecordRef: approvalRef,
        parentPrdSha256: prdRef.sha256,
      }),
      ...flags,
    ]);
  const prep = () =>
    invoke('current-decisions.mjs', [
      '--check-plan-prep',
      '--feature',
      'test',
      ...flags,
    ]);
  const validate = (value: unknown) =>
    invoke('check-result-review.mjs', [
      '--spec-review',
      json({ roots: [home], specReview: value }),
    ]);
  const approved = invoke('current-decisions.mjs', [
    '--advance-prd',
    '--feature',
    'test',
    '--expect-revision',
    '0',
    '--receipt',
    json({
      featureId: 'test',
      decision: 'approved',
      approvedSha256: prdRef.sha256,
      snapshotRef: prdRef,
      approvalRecordRef: approvalRef,
      approver: 'operator',
    }),
    ...flags,
  ]);
  expect(approved.ok).toBe(true);
  return { review, publish, check, validate, save, agree, prep };
}

describe('spec continuity through the real publisher and presentation gate', () => {
  it('rejects a positive review that omits a PRD essential, then accepts full coverage', () => {
    const f = fixture();
    expect(
      f.publish({ ...f.review, promises: f.review.promises.slice(1) }),
    ).toMatchObject({ status: 2, code: 'missing_essential_promise' });
    expect(f.check().ok).toBe(false);
    expect(f.publish(f.review).ok).toBe(true);
    expect(f.check().ok).toBe(true);
  });

  it('reads the Essential column and ignores optional promises', () => {
    const f = fixture(
      '| ID | Promise | Essential |\n| --- | --- | --- |\n| `P1` | Generate | **Yes** |\n| P2 | Explain | No |\n',
    );
    expect(
      f.validate({ ...f.review, promises: f.review.promises.slice(0, 1) }).ok,
    ).toBe(true);
    expect(
      f.validate({ ...f.review, promises: f.review.promises.slice(1) }),
    ).toMatchObject({ status: 2, code: 'missing_essential_promise' });
  });

  it.each([
    '## Essential promises\n| ID | Promise |\n| --- | --- |\n| P1 | Generate |\nP2 | Explain |\n',
    '| ID | Promise | Essential |\n| --- | --- | --- |\n| P1 | Generate | Yes |\nP2 | Explain | Yes\n',
    '## Essential promises\nID | Promise\n--- | ---\nP1 | Generate\nP2 | Explain\n',
  ])('retains essential rows with optional outer table delimiters', (prd) => {
    const f = fixture(prd);
    expect(
      f.publish({ ...f.review, promises: f.review.promises.slice(0, 1) }),
    ).toMatchObject({ status: 2, code: 'missing_essential_promise' });
    expect(f.publish(f.review).ok).toBe(true);
    expect(f.check().ok).toBe(true);
  });

  it('does not infer an essential inventory from an unstructured PRD or fenced example', () => {
    const f = fixture(
      '# Idea\nPromises are not enumerated.\n```md\n## Essential promises\n| ID | Promise |\n| --- | --- |\n| P1 | Example only |\n```\n',
    );
    expect(f.validate(f.review)).toMatchObject({
      status: 2,
      code: 'essential_promises_missing',
    });
  });

  it.each(['mismatch', 'needs-evidence', 'needs-operator'])(
    'holds conflicting %s until a new semantic review explicitly resolves it',
    (outcome) => {
      const f = fixture();
      expect(f.publish(f.review).ok).toBe(true);
      expect(f.check().ok).toBe(true);
      expect(f.agree().ok).toBe(true);
      expect(f.prep().ok).toBe(true);
      const comparison =
        outcome === 'mismatch'
          ? 'contradicted'
          : outcome === 'needs-evidence'
            ? 'unobserved'
            : 'needs-operator';
      const negative = f.publish({
        ...f.review,
        outcome,
        promises: [{ ...f.review.promises[0], comparison }],
      });
      expect(negative.ok).toBe(true);
      expect(f.check().ok).toBe(false);
      expect(f.prep().ok).toBe(false);
      expect(
        f.publish({
          ...f.review,
          reviewer: {
            ...f.review.reviewer,
            context: 'another positive opinion',
          },
        }).ok,
      ).toBe(true);
      expect(f.check().ok).toBe(false);
      const resolved = {
        ...f.review,
        resolutions: [
          {
            attemptId: negative.attemptId,
            reason:
              'The disputed promise is supported by the cited specification clause; the earlier reading was incorrect.',
          },
        ],
      };
      expect(f.publish(resolved).ok).toBe(true);
      expect(f.check().ok).toBe(true);
      expect(f.prep().ok).toBe(true);
      const later = f.publish({
        ...f.review,
        outcome,
        reviewer: { ...f.review.reviewer, context: 'new unresolved objection' },
        promises: [{ ...f.review.promises[0], comparison }],
      });
      expect(later.ok).toBe(true);
      expect(f.check().ok).toBe(false);
    },
  );

  it('a formatting rebind cannot hide an unresolved objection on its parent', () => {
    const f = fixture();
    const positive = f.publish(f.review);
    expect(positive.ok).toBe(true);
    expect(
      f.publish({
        ...f.review,
        outcome: 'mismatch',
        promises: [{ ...f.review.promises[0], comparison: 'contradicted' }],
      }).ok,
    ).toBe(true);
    const specRef = f.save(
      'formatted.md',
      '# Spec\n\nGenerate from docs and explain corrections.\n',
    );
    expect(
      f.publish({
        ...f.review,
        kind: 'formatting-equivalence',
        specRef,
        priorSpecRef: f.review.specRef,
        priorAttemptId: positive.attemptId,
        boundedDiff: { summary: 'One blank line' },
        promises: [],
      }).ok,
    ).toBe(true);
    expect(f.check('formatted.md').ok).toBe(false);
  });

  it('rejects unexplained and formatting-only resolutions', () => {
    const f = fixture();
    expect(
      f.validate({
        ...f.review,
        resolutions: [{ attemptId: 'a'.repeat(64), reason: '' }],
      }),
    ).toMatchObject({ code: 'spec_resolution_invalid' });
    expect(
      f.validate({
        ...f.review,
        kind: 'formatting-equivalence',
        resolutions: [{ attemptId: 'a'.repeat(64), reason: 'Resolved' }],
      }),
    ).toMatchObject({ code: 'spec_resolution_invalid' });
  });

  it('a resolution cannot borrow an objection from another feature', () => {
    const f = fixture();
    const foreign = f.publish({
      ...f.review,
      featureId: 'other',
      outcome: 'mismatch',
      promises: [{ ...f.review.promises[0], comparison: 'contradicted' }],
    });
    expect(foreign.ok).toBe(true);
    expect(
      f.publish({
        ...f.review,
        resolutions: [
          { attemptId: foreign.attemptId, reason: 'Resolved elsewhere' },
        ],
      }).ok,
    ).toBe(true);
    expect(f.check().ok).toBe(false);
    expect(f.publish(f.review).ok).toBe(true);
    expect(f.check().ok).toBe(true);
  });
});
