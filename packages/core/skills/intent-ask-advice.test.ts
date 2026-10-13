// intent-continuity B1 — document-bound advice routing suite (kickoff-b1 §2 items 2–4;
// design §§4–5, AC3/AC4).
//
// The helper `.agents/procedures/intent/helpers/ask-advice.mjs` routes an ADOPTED ask
// (frontmatter `continuity:` present, schema extension in scripts/check-ask-files.sh) to
// its target responsibility's PRIMARY DOCUMENT and validates the return edge:
//   route            — intent → the selector's currentPrd snapshot; architecture → the
//                      selector's currentSpec; task → the ask-bound kickoff/plan itself.
//                      Direct, per-class, no relay: one ask, one authority, any order.
//   validate-return  — an answered adopted ask may be applied only after its addressed
//                      target, document digest, decisions-entry (journalled BEFORE the
//                      answer), unresolved remainder and return-to OWNER all check out.
//   restore          — cold recovery: the responsibility's inputs reconstructed from the
//                      primary artifact + recorded decisions + unresolved ask, with no
//                      session handle. Missing references HOLD — never a reconstructed
//                      agreement. A scope statement must name one permitted AND one
//                      forbidden interpretation.
// The plan seam is pinned too: a validated advice answer never flips `--check-plan-prep`
// — the existing gate stays the only executable-plan authority.
//
// Every arm drives the real helper CLI (spawnSync, exit 0 ok / 2 hold, one JSON line) and
// the real bash validator, over disposable fixtures. Legacy v1 asks (no `continuity:`)
// pass both untouched.
//
// T22 (sibling-channel false GREEN): every rejecting `it` names its single flipping
// predicate in the title. Fixture lifecycle order is load-bearing: bootstrap → route →
// supersede/re-agree (spec revisions are DISTINCT files — the selector's history-inclusive
// replay guard refuses re-agreeing identical bytes) → validate-return → restore → plan seam.
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  appendFileSync,
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HELPER = resolve(
  REPO_ROOT,
  '.agents/procedures/intent/helpers/ask-advice.mjs',
);
const SELECTOR = resolve(
  REPO_ROOT,
  '.agents/procedures/intent/helpers/current-decisions.mjs',
);
const PUBLISH = resolve(
  REPO_ROOT,
  '.agents/procedures/intent/helpers/publish-spec-review.mjs',
);
const ASK_GATE = resolve(REPO_ROOT, 'scripts/check-ask-files.sh');

const sha256 = (bytes: string | Buffer): string =>
  createHash('sha256').update(bytes).digest('hex');

// ---------------------------------------------------------------------------
// Fixture: disposable repository + orch home (same shape as the A1 selector suite).
// ---------------------------------------------------------------------------
const ROOT = mkdtempSync(resolve(tmpdir(), 'intent-ask-advice-'));
const ORCH = mkdtempSync(resolve(tmpdir(), 'intent-ask-advice-orch-'));
const ASKS = mkdtempSync(resolve(tmpdir(), 'intent-ask-advice-mail-'));
mkdirSync(join(ROOT, '.git'), { recursive: true });
mkdirSync(join(ROOT, 'docs/advice'), { recursive: true });
mkdirSync(join(ROOT, 'plans'), { recursive: true });
const FEATURE = 'advice-path';

const writeRel = (rel: string, bytes: string): string => {
  writeFileSync(join(ROOT, rel), bytes, 'utf8');
  return sha256(bytes);
};
const E = (rel: string): { path: string; sha256: string } => ({
  path: rel,
  sha256: sha256(readFileSync(join(ROOT, rel))),
});

const prdBytes =
  '# PRD v1\n\nRules are generated from live documentation, never from a ready-made template library.\n';
const prd2Bytes = `${prdBytes}Passkeys are in scope.\n`;
const prd3Bytes = `${prd2Bytes}A third promise line.\n`;
const spec1Bytes =
  '# Spec v1\n\nRule generation reads the stack documentation directly.\n';
const spec2Bytes =
  '# Spec v2\n\nRule generation reads the stack documentation directly, scoped to lint rules.\n';
const spec3Bytes =
  '# Spec v3\n\nRule generation reads the stack documentation directly, scoped to lint rules and hooks.\n';
const kickoffBytes =
  '# Kickoff advice-path\n\nPrepare the rule-generation stage per the agreed spec.\n';
const prdSha = writeRel('docs/advice/prd.md', prdBytes);
const prd2Sha = writeRel('docs/advice/prd-v2.md', prd2Bytes);
const prd3Sha = writeRel('docs/advice/prd-v3.md', prd3Bytes);
const specSha = writeRel('docs/advice/spec.md', spec1Bytes);
const spec2Sha = writeRel('docs/advice/spec-v2.md', spec2Bytes);
const spec3Sha = writeRel('docs/advice/spec-v3.md', spec3Bytes);
const kickoffSha = writeRel('docs/advice/kickoff.md', kickoffBytes);
const taskStatePath = join(ROOT, 'plans/task-state.json');
writeFileSync(
  taskStatePath,
  JSON.stringify({ id: 'task-1', description: kickoffBytes, plan: null }),
  'utf8',
);
const approvalSha = writeRel(
  'docs/advice/approval.md',
  '# Approval\n\nOperator approved the advice-path brief by exact content.\n',
);
writeRel(
  'plans/advice.decisions.md',
  '# Decisions\n\n## IC-D4\nfeature: advice-path\nstatus: current\ndecision: approved documentation-driven generation.\n',
);

const prdReceipt = {
  featureId: FEATURE,
  decision: 'approved',
  approvedSha256: prdSha,
  snapshotRef: E('docs/advice/prd.md'),
  approvalRecordRef: E('docs/advice/approval.md'),
  approver: 'operator',
};
const prd2Receipt = {
  ...prdReceipt,
  approvedSha256: prd2Sha,
  snapshotRef: E('docs/advice/prd-v2.md'),
};
const prd3Receipt = {
  ...prdReceipt,
  approvedSha256: prd3Sha,
  snapshotRef: E('docs/advice/prd-v3.md'),
};
const specReceipt = {
  featureId: FEATURE,
  decision: 'agreed',
  operatorEvidence: "operator: 'го кикоф и отдай глм на реализацию'",
  specRef: E('docs/advice/spec.md'),
  agreementRecordRef: E('docs/advice/approval.md'),
  parentPrdSha256: prdSha,
};
const writeJson = (name: string, obj: unknown): string => {
  const abs = join(ROOT, 'plans', name);
  writeFileSync(abs, JSON.stringify(obj, null, 2), 'utf8');
  return abs;
};
const prdReceiptPath = writeJson('prd-receipt.json', prdReceipt);
const prd2ReceiptPath = writeJson('prd2-receipt.json', prd2Receipt);
const prd3ReceiptPath = writeJson('prd3-receipt.json', prd3Receipt);
const specReceiptPath = writeJson('spec-receipt.json', specReceipt);

const attempt = {
  kind: 'spec-review',
  version: 1,
  featureId: FEATURE,
  prdRef: E('docs/advice/prd.md'),
  specRef: E('docs/advice/spec.md'),
  approvalRef: E('docs/advice/approval.md'),
  reviewer: {
    independence: 'fresh artifact-only seat',
    context: 'judged from the approved PRD and the unlabeled candidate spec',
    documents: [E('docs/advice/prd.md'), E('docs/advice/spec.md')],
  },
  promises: [
    {
      id: 'P1',
      comparison: 'supported',
      reason:
        'the spec binds documentation-driven generation exactly as the PRD requires',
      citations: [
        {
          source: 'prd',
          quote: 'generated from live documentation',
          location: 'docs/advice/prd.md:3',
        },
        {
          source: 'spec',
          quote: 'reads the stack documentation directly',
          location: 'docs/advice/spec.md:3',
        },
      ],
    },
  ],
  outcome: 'matches',
};
const attemptPath = writeJson('attempt.json', attempt);

const runSelector = (args: string[]) =>
  spawnSync(
    'node',
    [SELECTOR, ...args, '--orch-home', ORCH, '--repo-root', ROOT],
    { encoding: 'utf8', timeout: 30_000 },
  );
const advance = (args: string[]) => {
  const featureId = args[args.indexOf('--feature') + 1];
  const prior = runSelector(['--read', '--feature', featureId]);
  const revision =
    prior.status === 0
      ? (JSON.parse(prior.stdout) as { revision: number }).revision
      : 0;
  return runSelector([...args, '--expect-revision', String(revision)]);
};
const runPublish = (args: string[]) =>
  spawnSync(
    'node',
    [PUBLISH, ...args, '--orch-home', ORCH, '--repo-root', ROOT],
    { encoding: 'utf8', timeout: 30_000 },
  );
const runHelper = (args: string[]) =>
  spawnSync(
    'node',
    [
      HELPER,
      ...args,
      ...(args.includes('--ask') &&
      /^target: task$/m.test(
        readFileSync(args[args.indexOf('--ask') + 1], 'utf8'),
      ) &&
      !args.includes('--task-state')
        ? ['--task-state', taskStatePath]
        : []),
      '--orch-home',
      ORCH,
      '--repo-root',
      ROOT,
    ],
    { encoding: 'utf8', timeout: 30_000 },
  );

type Out = {
  ok: boolean;
  code?: string;
  reason?: string;
  adopted?: boolean;
  [k: string]: unknown;
};
const expectHold = (
  r: { status: number | null; stdout: string; stderr: string },
  code: string,
): Out => {
  expect(r.status, r.stderr || r.stdout).toBe(2);
  const parsed = JSON.parse(r.stdout) as Out;
  expect(parsed.ok, JSON.stringify(parsed)).toBe(false);
  expect(parsed.code, JSON.stringify(parsed)).toBe(code);
  return parsed;
};
const expectOk = (r: {
  status: number | null;
  stdout: string;
  stderr: string;
}): Out => {
  expect(r.status, r.stderr || r.stdout).toBe(0);
  return JSON.parse(r.stdout) as Out;
};

// The CURRENT approved PRD binding — makeAsk defaults follow it as the fixture lifecycle
// supersedes PRD revisions, so every non-staleness arm binds live authority by default.
let currentPrdRel = 'docs/advice/prd.md';
let currentPrdSha = prdSha;

// ---------------------------------------------------------------------------
// Ask fixtures.
// ---------------------------------------------------------------------------
let askCounter = 0;
function makeAsk(opts: {
  target?: string;
  doc?: string;
  docSha?: string;
  feature?: string;
  status?: 'open' | 'answered';
  askerRole?: string;
  returnTo?: string;
  answerTarget?: string;
  remainder?: string;
  decisionsEntry?: string;
}): string {
  askCounter += 1;
  const target = opts.target ?? 'intent';
  const askerRole = opts.askerRole ?? 'dispatcher';
  const name = `2026-10-13-${askerRole}-ask-${askCounter}.md`;
  const returnTo = opts.returnTo ?? `${askerRole}:${name}`;
  const anchor = `ask-${askCounter}`;
  const lines = [
    '---',
    `asker-role: ${askerRole}`,
    `asker-cwd: ${ROOT}`,
    'class: consult',
    `status: ${opts.status ?? 'open'}`,
    `continuity: ${opts.feature ?? FEATURE}`,
    `target: ${target}`,
    ...(target === 'task' ? ['task-id: task-1'] : []),
    `primary-doc: ${opts.doc ?? currentPrdRel}`,
    `primary-doc-sha256: ${opts.docSha ?? currentPrdSha}`,
    'decision-ids: IC-D4',
    `return-to: ${returnTo}`,
    'proposed-effect: resolve the generation route for this stage',
    '---',
    '',
    '## Question',
    '',
    'Which generation route does the promise actually bind?',
    '',
    '## Options considered',
    '',
    '- templates -> faster, not the promise',
    '- docs-driven -> the promise',
    '',
    '## Evidence',
    '',
    '- docs/advice/prd.md:3 — the promise text.',
  ];
  if (opts.status === 'answered') {
    lines.push(
      '',
      '## Answer',
      '',
      'verdict: docs-driven generation is the bound route',
      'rationale: the PRD names it as the distinguishing promise',
      'decided-by: intent',
      'timestamp: 2026-10-13T10:00:00+03:00',
      `decisions-entry: ${opts.decisionsEntry ?? `plans/advice.decisions.md#${anchor}`}`,
      `target: ${opts.answerTarget ?? target}`,
      `unresolved-remainder: ${opts.remainder ?? 'none'}`,
    );
  }
  const abs = join(ASKS, name);
  writeFileSync(abs, `${lines.join('\n')}\n`, 'utf8');
  if (opts.status === 'answered') {
    appendFileSync(
      join(ROOT, 'plans/advice.decisions.md'),
      `\n## ${anchor}\nask: ${name}\nfeature: ${opts.feature ?? FEATURE}\n${target === 'task' ? 'task-id: task-1\n' : ''}decision-ids: IC-D4\nverdict: docs-driven generation is the bound route\nreturn-to: ${askerRole}:${name}\n`,
    );
  }
  return abs;
}

const runAskGate = (mailbox: string) =>
  spawnSync('bash', [ASK_GATE], {
    encoding: 'utf8',
    timeout: 30_000,
    env: { ...process.env, CLAUDE_COORDINATION_DIR: mailbox },
  });

// ---------------------------------------------------------------------------
// Bootstrap — one accepted feature lifecycle (selector + matches corpus), before any arm.
// ---------------------------------------------------------------------------
describe('ask-advice — fixture bootstrap', () => {
  it('PRD approval, matches attempt and spec agreement advance', () => {
    expect(
      advance([
        '--advance-prd',
        '--feature',
        FEATURE,
        '--receipt',
        prdReceiptPath,
      ]).status,
    ).toBe(0);
    const pub = runPublish(['--attempt', attemptPath]);
    expect(pub.status, pub.stderr).toBe(0);
    expect(
      advance([
        '--advance-spec',
        '--feature',
        FEATURE,
        '--receipt',
        specReceiptPath,
      ]).status,
    ).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AC3 — direct class routing, each target to its own primary document, no relay.
// ---------------------------------------------------------------------------
describe('ask-advice route — direct, document-bound, no relay', () => {
  it('a task ask binds its own kickoff and routes with authority ask-bound (flip: the helper starts deriving task docs from the selector)', () => {
    const ask = makeAsk({
      target: 'task',
      doc: 'docs/advice/kickoff.md',
      docSha: kickoffSha,
    });
    const out = expectOk(runHelper(['--route', '--ask', ask]));
    expect(out).toMatchObject({
      adopted: true,
      target: 'task',
      featureId: FEATURE,
      authority: 'task-state',
    });
    expect(out.primaryDoc).toEqual({
      path: 'docs/advice/kickoff.md',
      sha256: kickoffSha,
    });
  });

  it('a task ask for an old task ID holds against the freshly fetched current task even when kickoff bytes match', () => {
    const ask = makeAsk({
      target: 'task',
      doc: 'docs/advice/kickoff.md',
      docSha: kickoffSha,
    });
    const otherState = join(ROOT, 'plans/current-task-state.json');
    writeFileSync(
      otherState,
      JSON.stringify({ id: 'task-2', description: kickoffBytes }),
    );
    expectHold(
      runHelper(['--route', '--ask', ask, '--task-state', otherState]),
      'task_context_mismatch',
    );
  });

  it('a task ask for the right ID holds when that task now carries another kickoff/plan', () => {
    const ask = makeAsk({
      target: 'task',
      doc: 'docs/advice/kickoff.md',
      docSha: kickoffSha,
    });
    const changedState = join(ROOT, 'plans/changed-task-state.json');
    writeFileSync(
      changedState,
      JSON.stringify({
        id: 'task-1',
        description: 'different kickoff',
        plan: 'different plan',
      }),
    );
    expectHold(
      runHelper(['--route', '--ask', ask, '--task-state', changedState]),
      'task_context_mismatch',
    );
  });

  it('an architecture ask routes straight to the selector currentSpec, not the kickoff or PRD (flip: routing walks a task→arch→intent chain)', () => {
    const ask = makeAsk({
      target: 'architecture',
      doc: 'docs/advice/spec.md',
      docSha: specSha,
    });
    const out = expectOk(runHelper(['--route', '--ask', ask]));
    expect(out).toMatchObject({
      adopted: true,
      target: 'architecture',
      authority: 'selector',
    });
    expect(out.primaryDoc).toEqual({
      path: 'docs/advice/spec.md',
      sha256: specSha,
    });
  });

  it('an intent ask routes straight to the currentPrd snapshot even though a spec agreement exists (flip: intent forks the architecture conversation)', () => {
    const ask = makeAsk({ target: 'intent' });
    const out = expectOk(runHelper(['--route', '--ask', ask]));
    expect(out).toMatchObject({
      adopted: true,
      target: 'intent',
      authority: 'selector',
    });
    expect(out.primaryDoc).toEqual({
      path: 'docs/advice/prd.md',
      sha256: prdSha,
    });
  });

  it('routing order never matters: each class routes alone from a bare selector read (flip: an ordering-dependent relay)', () => {
    for (const [target, doc] of [
      ['architecture', 'docs/advice/spec.md'],
      ['intent', 'docs/advice/prd.md'],
      ['task', 'docs/advice/kickoff.md'],
    ] as const) {
      const ask = makeAsk({ target, doc, docSha: E(doc).sha256 });
      expect(expectOk(runHelper(['--route', '--ask', ask])).target).toBe(
        target,
      );
    }
  });

  it("RED (bypass before the fix, probed live): the SHAPE gate passes an adopted ask whose target is architecture but whose document is the PRD — the hold is the helper's", () => {
    // The bash schema gate is shape-only by charter; this arm pins that the SEMANTIC hold
    // lives here, in one place, rather than assuming the shape gate caught it.
    const ask = makeAsk({ target: 'architecture' }); // PRD bytes bound, wrong responsibility
    expectHold(
      runHelper(['--route', '--ask', ask]),
      'primary_doc_not_authority',
    );
    const mailbox = mkdtempSync(resolve(tmpdir(), 'intent-ask-advice-mail-'));
    mkdirSync(join(mailbox, 'session-bus/asks'), { recursive: true });
    const copy = join(
      mailbox,
      'session-bus/asks/2026-10-13-dispatcher-probe.md',
    );
    writeFileSync(copy, readFileSync(ask));
    expect(runAskGate(mailbox).status).toBe(0); // shape passes — semantics are the helper's
  });

  it('a missing target → target_missing (flip: the helper defaults the target to task)', () => {
    const ask = makeAsk({
      target: 'task',
      doc: 'docs/advice/kickoff.md',
      docSha: kickoffSha,
    });
    const text = readFileSync(ask, 'utf8').replace(/^target: task$/m, '');
    const missing = ask.replace(/\.md$/, '-no-target.md');
    writeFileSync(missing, text);
    expectHold(runHelper(['--route', '--ask', missing]), 'target_missing');
  });

  it('an ask naming a feature with no selector entry → feature_missing (flip: the helper accepts any feature string)', () => {
    const ask = makeAsk({ feature: 'no-such-feature' });
    expectHold(runHelper(['--route', '--ask', ask]), 'feature_missing');
  });

  it('a placeholder digest (the emitted template) → primary_doc_stale, never a plausible pass (flip: the helper treats shape-valid digests as authority)', () => {
    const ask = makeAsk({ docSha: '0'.repeat(64) });
    expectHold(runHelper(['--route', '--ask', ask]), 'primary_doc_stale');
  });

  it('changed task-bound primary-document bytes after filing → primary_doc_stale (flip: routing trusts the path without re-digesting)', () => {
    const ask = makeAsk({
      target: 'task',
      doc: 'docs/advice/kickoff.md',
      docSha: kickoffSha,
    });
    writeFileSync(
      join(ROOT, 'docs/advice/kickoff.md'),
      `${kickoffBytes}<!-- drifted -->`,
      'utf8',
    );
    expectHold(runHelper(['--route', '--ask', ask]), 'primary_doc_stale');
    writeFileSync(join(ROOT, 'docs/advice/kickoff.md'), kickoffBytes, 'utf8'); // restore
  });

  it('changed spec bytes under an architecture ask → the selector live-validation holds (spec_agreement_invalid:ref_digest_mismatch)', () => {
    const ask = makeAsk({
      target: 'architecture',
      doc: 'docs/advice/spec.md',
      docSha: specSha,
    });
    writeFileSync(
      join(ROOT, 'docs/advice/spec.md'),
      `${spec1Bytes}<!-- drifted -->`,
      'utf8',
    );
    expectHold(
      runHelper(['--route', '--ask', ask]),
      'spec_agreement_invalid:ref_digest_mismatch',
    );
    writeFileSync(join(ROOT, 'docs/advice/spec.md'), spec1Bytes, 'utf8'); // restore
  });
});

// ---------------------------------------------------------------------------
// Staleness — an ask naming a superseded PRD is a domain-specific false green.
// ---------------------------------------------------------------------------
describe('ask-advice route — superseded authority holds', () => {
  it('an intent ask bound to the superseded PRD digest → primary_doc_not_authority after the A→B advance (flip: the helper accepts the internally-consistent old PRD)', () => {
    expect(
      advance([
        '--advance-prd',
        '--feature',
        FEATURE,
        '--receipt',
        prd2ReceiptPath,
      ]).status,
    ).toBe(0);
    currentPrdRel = 'docs/advice/prd-v2.md';
    currentPrdSha = prd2Sha;
    const ask = makeAsk({
      target: 'intent',
      doc: 'docs/advice/prd.md',
      docSha: prdSha,
    });
    expectHold(
      runHelper(['--route', '--ask', ask]),
      'primary_doc_not_authority',
    );
    // ...and the CURRENT PRD still routes.
    const fresh = makeAsk({ target: 'intent' });
    expect(expectOk(runHelper(['--route', '--ask', fresh])).primaryDoc).toEqual(
      {
        path: 'docs/advice/prd-v2.md',
        sha256: prd2Sha,
      },
    );
  });

  it('architecture routing after the PRD supersession → spec_agreement_missing (the advance invalidated it); re-agreeing revives it', () => {
    const ask = makeAsk({ target: 'architecture' });
    expectHold(runHelper(['--route', '--ask', ask]), 'spec_agreement_missing');
    // Re-establish agreement over NEW spec bytes (the selector's history-inclusive replay
    // guard refuses re-agreeing identical bytes — a renewed agreement is a new decision).
    const attempt2Path = writeJson('attempt-prd2.json', {
      ...attempt,
      prdRef: E('docs/advice/prd-v2.md'),
      specRef: E('docs/advice/spec-v2.md'),
      reviewer: {
        ...attempt.reviewer,
        documents: [E('docs/advice/prd-v2.md'), E('docs/advice/spec-v2.md')],
      },
    });
    expect(runPublish(['--attempt', attempt2Path]).status).toBe(0);
    const spec2ReceiptPath = writeJson('spec2-receipt.json', {
      ...specReceipt,
      specRef: E('docs/advice/spec-v2.md'),
      parentPrdSha256: prd2Sha,
    });
    expect(
      advance([
        '--advance-spec',
        '--feature',
        FEATURE,
        '--receipt',
        spec2ReceiptPath,
      ]).status,
    ).toBe(0);
    const bound = makeAsk({
      target: 'architecture',
      doc: 'docs/advice/spec-v2.md',
      docSha: spec2Sha,
    });
    expect(expectOk(runHelper(['--route', '--ask', bound])).primaryDoc).toEqual(
      {
        path: 'docs/advice/spec-v2.md',
        sha256: spec2Sha,
      },
    );
  });
});

// ---------------------------------------------------------------------------
// Return edge — the journaled answer is applied only after return validation.
// ---------------------------------------------------------------------------
describe('ask-advice validate-return — the answered ask is held until it checks out', () => {
  it('GREEN end-to-end: a valid answered ask with a journalled entry passes every return check (the one valid ask→answer→return case)', () => {
    const ask = makeAsk({ target: 'intent', status: 'answered' });
    const out = expectOk(runHelper(['--validate-return', '--ask', ask]));
    expect(out).toMatchObject({
      adopted: true,
      check: 'validate-return',
      target: 'intent',
      unresolvedRemainder: 'none',
    });
    expect(out.decisionsEntry).toMatchObject({
      path: 'plans/advice.decisions.md',
    });
    expect((out.decisionsEntry as { sha256: string }).sha256).toBe(
      sha256(readFileSync(join(ROOT, 'plans/advice.decisions.md'))),
    );
    expect(out.primaryDoc).toEqual({
      path: 'docs/advice/prd-v2.md',
      sha256: prd2Sha,
    });
  });

  it('an open ask at validate-return → answer_missing (flip: the helper validates advice that was never returned)', () => {
    const ask = makeAsk({ target: 'intent' });
    expectHold(
      runHelper(['--validate-return', '--ask', ask]),
      'answer_missing',
    );
  });

  it('an answer whose decisions entry does not exist → decisions_entry_missing (advice without a journal entry, flip: existence stays unchecked for ADOPTED asks)', () => {
    const ask = makeAsk({
      target: 'intent',
      status: 'answered',
      decisionsEntry: 'plans/no-such-decisions.md#ask-1',
    });
    expectHold(
      runHelper(['--validate-return', '--ask', ask]),
      'decisions_entry_missing',
    );
  });

  it('a wrong return owner → return_owner_mismatch (flip: the helper accepts any owner-led return-to)', () => {
    const ask = makeAsk({
      target: 'intent',
      status: 'answered',
      askerRole: 'dispatcher',
      returnTo: 'architect',
    });
    expectHold(
      runHelper(['--validate-return', '--ask', ask]),
      'return_owner_mismatch',
    );
  });

  it('a correct role pointing at another ask cannot receive this answer', () => {
    const ask = makeAsk({
      target: 'intent',
      status: 'answered',
      returnTo: 'dispatcher:another-task.md',
    });
    expectHold(
      runHelper(['--validate-return', '--ask', ask]),
      'return_owner_mismatch',
    );
  });

  it('an answer echoing a different target → return_target_mismatch (flip: the helper skips the echo comparison)', () => {
    const ask = makeAsk({
      target: 'intent',
      status: 'answered',
      answerTarget: 'architecture',
    });
    expectHold(
      runHelper(['--validate-return', '--ask', ask]),
      'return_target_mismatch',
    );
  });

  it('an answer without an unresolved-remainder key → remainder_unnamed (flip: the helper invents remainder "none")', () => {
    const ask = makeAsk({ target: 'intent', status: 'answered' });
    const text = readFileSync(ask, 'utf8')
      .split('\n')
      .filter((l) => !l.startsWith('unresolved-remainder:'))
      .join('\n');
    writeFileSync(ask, text);
    expectHold(
      runHelper(['--validate-return', '--ask', ask]),
      'remainder_unnamed',
    );
  });

  it('a journal section naming another ask cannot validate this answer', () => {
    const ask = makeAsk({ target: 'intent', status: 'answered' });
    const journal = join(ROOT, 'plans/advice.decisions.md');
    const before = readFileSync(journal, 'utf8');
    writeFileSync(
      journal,
      before.replace(`ask: ${ask.split('/').at(-1)}`, 'ask: another-task.md'),
    );
    try {
      expectHold(
        runHelper(['--validate-return', '--ask', ask]),
        'decisions_entry_unrelated',
      );
    } finally {
      writeFileSync(journal, before);
    }
  });

  it('a journal section with a different verdict cannot validate this answer', () => {
    const ask = makeAsk({ target: 'intent', status: 'answered' });
    const journal = join(ROOT, 'plans/advice.decisions.md');
    const before = readFileSync(journal, 'utf8');
    const anchor = `ask-${askCounter}`;
    writeFileSync(
      journal,
      before.replace(
        `## ${anchor}\nask:`,
        `## ${anchor}\nverdict: unrelated choice\nask:`,
      ),
    );
    try {
      expectHold(
        runHelper(['--validate-return', '--ask', ask]),
        'verdict_not_journalled',
      );
    } finally {
      writeFileSync(journal, before);
    }
  });
});

// ---------------------------------------------------------------------------
// AC4 — cold recovery from documents only.
// ---------------------------------------------------------------------------
describe('ask-advice restore — fresh artifact-only responsibility', () => {
  it('an intent responsibility restores from the current PRD + decisions + unresolved ask with no session handle (flip: restore demands a session id)', () => {
    const ask = makeAsk({ target: 'intent' }); // open = the unresolved ask
    const scope = join(ASKS, 'scope-intent.md');
    writeFileSync(
      scope,
      'permitted: treating documentation-driven generation as binding for the generation route (docs/advice/prd-v2.md).\nforbidden: docs/advice/prd-v2.md rejects substituting a ready-made template library because it is easier.\n',
      'utf8',
    );
    const out = expectOk(
      runHelper([
        '--restore',
        '--target',
        'intent',
        '--feature',
        FEATURE,
        '--ask',
        ask,
        '--scope',
        scope,
        '--decisions',
        'plans/advice.decisions.md',
      ]),
    );
    expect(out).toMatchObject({
      adopted: true,
      check: 'restore',
      target: 'intent',
    });
    expect(out.primaryDoc).toEqual({
      path: 'docs/advice/prd-v2.md',
      sha256: prd2Sha,
    });
    expect(out.unresolvedAsk).toMatchObject({ status: 'open' });
    expect(out.scope).toMatchObject({
      permitted: expect.stringContaining('documentation-driven'),
      forbidden: expect.stringContaining('template'),
    });
  });

  it('restore does not accept a decision ID mentioned only in prose or a superseded entry', () => {
    const ask = makeAsk({ target: 'intent' });
    const scope = join(ASKS, 'scope-decision-basis.md');
    writeFileSync(
      scope,
      'permitted: docs/advice/prd-v2.md keeps documentation-driven generation.\nforbidden: docs/advice/prd-v2.md disallows templates replacing it.\n',
    );
    const bad = 'plans/invalid-decisions.md';
    writeRel(
      bad,
      '# Decisions\n\nIC-D4 is absent.\n\n## IC-D4\nfeature: advice-path\nstatus: superseded\ndecision: old route\n',
    );
    expectHold(
      runHelper([
        '--restore',
        '--target',
        'intent',
        '--feature',
        FEATURE,
        '--ask',
        ask,
        '--scope',
        scope,
        '--decisions',
        bad,
      ]),
      'decision_basis_missing',
    );
    writeRel(
      bad,
      '# Decisions\n\n## IC-D4\nfeature: another-feature\nstatus: current\ndecision: unrelated route\n',
    );
    expectHold(
      runHelper([
        '--restore',
        '--target',
        'intent',
        '--feature',
        FEATURE,
        '--ask',
        ask,
        '--scope',
        scope,
        '--decisions',
        bad,
      ]),
      'decision_basis_missing',
    );
  });

  it('restore with missing spec agreement → spec_agreement_missing HOLD, never a reconstructed agreement (flip: restore fabricates a default authority)', () => {
    // Supersede the PRD once more: the spec agreement is invalidated again.
    expect(
      advance([
        '--advance-prd',
        '--feature',
        FEATURE,
        '--receipt',
        prd3ReceiptPath,
      ]).status,
    ).toBe(0);
    currentPrdRel = 'docs/advice/prd-v3.md';
    currentPrdSha = prd3Sha;
    expectHold(
      runHelper([
        '--restore',
        '--target',
        'architecture',
        '--feature',
        FEATURE,
        '--ask',
        makeAsk({
          target: 'architecture',
          doc: 'docs/advice/spec-v3.md',
          docSha: spec3Sha,
        }),
      ]),
      'spec_agreement_missing',
    );
    // Intent restore keeps working against the current v3 PRD.
    const scope = join(ASKS, 'scope-intent-3.md');
    writeFileSync(
      scope,
      'permitted: docs/advice/prd-v3.md keeps the v3 promises.\nforbidden: docs/advice/prd-v3.md cannot drop a promise for convenience.\n',
      'utf8',
    );
    const ask = makeAsk({ target: 'intent' });
    expect(
      expectOk(
        runHelper([
          '--restore',
          '--target',
          'intent',
          '--feature',
          FEATURE,
          '--ask',
          ask,
          '--scope',
          scope,
          '--decisions',
          'plans/advice.decisions.md',
        ]),
      ).primaryDoc,
    ).toEqual({
      path: 'docs/advice/prd-v3.md',
      sha256: prd3Sha,
    });
  });

  it('a scope statement without a forbidden interpretation → scope_statement_incomplete (flip: one-sided scope passes)', () => {
    const scope = join(ASKS, 'scope-one-sided.md');
    writeFileSync(scope, 'permitted: everything the PRD allows.\n', 'utf8');
    expectHold(
      runHelper([
        '--restore',
        '--target',
        'intent',
        '--feature',
        FEATURE,
        '--ask',
        makeAsk({ target: 'intent' }),
        '--scope',
        scope,
        '--decisions',
        'plans/advice.decisions.md',
      ]),
      'scope_statement_incomplete',
    );
  });

  it('a task responsibility restores from the ask-bound kickoff bytes (flip: task restore consults the selector)', () => {
    const ask = makeAsk({
      target: 'task',
      doc: 'docs/advice/kickoff.md',
      docSha: kickoffSha,
    });
    const scope = join(ASKS, 'scope-task.md');
    writeFileSync(
      scope,
      'permitted: docs/advice/kickoff.md authorizes the scoped task.\nforbidden: docs/advice/kickoff.md cannot change product intent.\n',
      'utf8',
    );
    const out = expectOk(
      runHelper([
        '--restore',
        '--target',
        'task',
        '--feature',
        FEATURE,
        '--ask',
        ask,
        '--scope',
        scope,
        '--decisions',
        'plans/advice.decisions.md',
        '--doc',
        'docs/advice/kickoff.md',
        '--doc-sha256',
        kickoffSha,
      ]),
    );
    expect(out.primaryDoc).toEqual({
      path: 'docs/advice/kickoff.md',
      sha256: kickoffSha,
    });
  });

  it('a lost session cannot restore an intent role from an architecture ask', () => {
    const ask = makeAsk({
      target: 'architecture',
      doc: 'docs/advice/spec-v3.md',
      docSha: spec3Sha,
    });
    expectHold(
      runHelper([
        '--restore',
        '--target',
        'intent',
        '--feature',
        FEATURE,
        '--ask',
        ask,
      ]),
      'restore_ask_mismatch',
    );
  });
});

// ---------------------------------------------------------------------------
// Plan seam — advice never becomes plan authority.
// ---------------------------------------------------------------------------
describe('ask-advice — the plan seam stays with --check-plan-prep', () => {
  it('a fully validated advice answer does not flip --check-plan-prep over an unagreed spec (flip: validated advice is mistaken for plan authority)', () => {
    // Current state: PRD v3 approved, spec agreement invalidated by the advance.
    const advice = makeAsk({ target: 'intent', status: 'answered' });
    expect(expectOk(runHelper(['--validate-return', '--ask', advice])).ok).toBe(
      true,
    );
    const gate = runSelector(['--check-plan-prep', '--feature', FEATURE]);
    expect(gate.status).toBe(2);
    expect(JSON.parse(gate.stdout).code).toBe('spec_agreement_missing');
  });

  it('with the gate GREEN the validated advice is still only advice: the helper never returns an executable-plan verdict', () => {
    // Re-agree NEW spec bytes under PRD v3 so the gate passes, then pin that
    // validate-return's output grants no plan authority — the only plan verdict remains
    // the selector's.
    const attempt3Path = writeJson('attempt-prd3.json', {
      ...attempt,
      prdRef: E('docs/advice/prd-v3.md'),
      specRef: E('docs/advice/spec-v3.md'),
      reviewer: {
        ...attempt.reviewer,
        documents: [E('docs/advice/prd-v3.md'), E('docs/advice/spec-v3.md')],
      },
    });
    expect(runPublish(['--attempt', attempt3Path]).status).toBe(0);
    const spec3ReceiptPath = writeJson('spec3-receipt.json', {
      ...specReceipt,
      specRef: E('docs/advice/spec-v3.md'),
      parentPrdSha256: prd3Sha,
    });
    expect(
      advance([
        '--advance-spec',
        '--feature',
        FEATURE,
        '--receipt',
        spec3ReceiptPath,
      ]).status,
    ).toBe(0);
    expect(
      runSelector(['--check-plan-prep', '--feature', FEATURE]).status,
    ).toBe(0);
    const out = expectOk(
      runHelper([
        '--validate-return',
        '--ask',
        makeAsk({ target: 'intent', status: 'answered' }),
      ]),
    );
    expect(Object.keys(out)).not.toContain('planReady');
    expect(out.check).toBe('validate-return');
  });
});

// ---------------------------------------------------------------------------
// Legacy compatibility — v1 asks pass both gates untouched.
// ---------------------------------------------------------------------------
describe('ask-advice — legacy v1 asks keep their contract', () => {
  it('a legacy ask (no continuity key) routes as adopted:false passthrough — no adopted validation applied (flip: the helper imposes adopted fields on legacy asks)', () => {
    const legacy = join(ASKS, '2026-10-13-dispatcher-legacy.md');
    writeFileSync(
      legacy,
      [
        '---',
        'asker-role: dispatcher',
        `asker-cwd: ${ROOT}`,
        'class: consult',
        'status: open',
        '---',
        '',
        '## Question',
        '',
        'Does stage S2 need its own probe?',
        '',
        '## Options considered',
        '',
        '- probe first',
        '- build then verify',
        '',
        '## Evidence',
        '',
        '- .agents/checks/check-ask-files.sh:1 — the gate.',
      ].join('\n') + '\n',
      'utf8',
    );
    expect(expectOk(runHelper(['--route', '--ask', legacy]))).toMatchObject({
      ok: true,
      adopted: false,
    });
    expect(
      expectOk(runHelper(['--validate-return', '--ask', legacy])),
    ).toMatchObject({ ok: true, adopted: false, check: 'validate-return' });
  });

  it('a legacy answered ask without adopted keys still passes the bash gate (flip: the schema tightens legacy asks)', () => {
    const mailbox = mkdtempSync(resolve(tmpdir(), 'intent-ask-advice-mail-'));
    mkdirSync(join(mailbox, 'session-bus/asks'), { recursive: true });
    writeFileSync(
      join(
        mailbox,
        'session-bus/asks/2026-10-13-dispatcher-legacy-answered.md',
      ),
      [
        '---',
        'asker-role: dispatcher',
        `asker-cwd: ${ROOT}`,
        'class: consult',
        'status: answered',
        '---',
        '',
        '## Question',
        '',
        'Does stage S2 need its own probe?',
        '',
        '## Options considered',
        '',
        '- probe first',
        '- build then verify',
        '',
        '## Evidence',
        '',
        '- .agents/checks/check-ask-files.sh:1 — the gate.',
        '',
        '## Answer',
        '',
        'verdict: build first',
        'rationale: reversible surface',
        'decided-by: arch',
        'timestamp: 2026-08-17T10:00:00+03:00',
        'decisions-entry: plans/legacy.decisions.md#ask-1',
      ].join('\n') + '\n',
      'utf8',
    );
    expect(runAskGate(mailbox).status).toBe(0);
  });
});

describe('incumbent ask gate — adopted delivery and return adapter', () => {
  function throughMailbox(
    ask: string,
    phase: '--prepare-adopted' | '--accept-adopted',
    state?: string,
  ) {
    const mailbox = mkdtempSync(resolve(tmpdir(), 'intent-adopted-delivery-'));
    const asksDir = join(mailbox, 'session-bus/asks');
    mkdirSync(asksDir, { recursive: true });
    const bin = join(mailbox, 'bin');
    mkdirSync(bin);
    const fakeCurl = join(bin, 'curl');
    writeFileSync(
      fakeCurl,
      '#!/usr/bin/env bash\n[ "${@: -1}" = "${RUNTIME_BRIDGE_AIF_URL:-http://localhost:3009}/tasks/task-1" ] || exit 22\n[ -n "${FAKE_TASK_STATE:-}" ] || exit 22\ncat "$FAKE_TASK_STATE"\n',
    );
    chmodSync(fakeCurl, 0o755);
    const file = join(asksDir, ask.split('/').at(-1)!);
    copyFileSync(ask, file);
    return spawnSync('bash', [ASK_GATE, phase, file], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      timeout: 30_000,
      env: {
        ...process.env,
        CLAUDE_COORDINATION_DIR: mailbox,
        AIF_INTENT_REPO_ROOT: ROOT,
        AIF_INTENT_ORCH_HOME: ORCH,
        FAKE_TASK_STATE: state ?? '',
        PATH: `${bin}:${process.env.PATH}`,
      },
    });
  }

  it('the existing ask gate releases the doorbell only after current document and return owner validate', () => {
    const ask = makeAsk({ target: 'intent' });
    const result = throughMailbox(ask, '--prepare-adopted');
    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(JSON.parse(result.stdout.split('\n')[0])).toMatchObject({
      ok: true,
      target: 'intent',
    });
    expect(result.stdout).toContain('AIF-BUS v1 ASK role=dispatcher ref=');
  });

  it('the existing ask gate holds a wrong-document route before the doorbell', () => {
    const ask = makeAsk({ target: 'architecture' });
    const result = throughMailbox(ask, '--prepare-adopted');
    expect(result.status).toBe(2);
    expect(result.stdout).not.toContain('AIF-BUS v1 ASK');
    expect(result.stdout).toContain('primary_doc_not_authority');
  });

  it('the existing ask gate validates the journaled return before releasing advice', () => {
    const ask = makeAsk({ target: 'intent', status: 'answered' });
    const result = throughMailbox(ask, '--accept-adopted');
    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: true,
      check: 'validate-return',
    });
  });

  it('task delivery requires independently fetched matching task state at the incumbent gate', () => {
    const ask = makeAsk({
      target: 'task',
      doc: 'docs/advice/kickoff.md',
      docSha: kickoffSha,
    });
    expect(throughMailbox(ask, '--prepare-adopted').status).toBe(2);
    const pass = throughMailbox(ask, '--prepare-adopted', taskStatePath);
    expect(pass.status, pass.stderr || pass.stdout).toBe(0);
    expect(pass.stdout).toContain('AIF-BUS v1 ASK');
  });
});
