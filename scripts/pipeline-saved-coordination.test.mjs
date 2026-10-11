import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync,
  mkdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { captureSavedCoordination } from '../.agents/procedures/pipeline/helpers/saved-coordination.mjs';
import { readReconciliationSource } from '../.agents/procedures/pipeline/helpers/check-final-report.mjs';
const hash = (b) => createHash('sha256').update(b).digest('hex');
const helper = resolve(
  '.agents/procedures/pipeline/helpers/check-final-report.mjs',
);
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'saved scheme paths with spaces '));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const ids = ['paired-csv-export', 'paired-import-check'];
  const graph = {
    nodes: ids.map((id) => ({
      id,
      label: id,
      owner_thread_id: 'fixture-owner',
      acceptance_rule: 'Exact predecessor proof required',
    })),
    edges: [
      {
        from: ids[0],
        to: ids[1],
        type: 'conditional',
        condition: 'Only when affected source changes',
      },
    ],
  };
  const pins = {};
  for (const [name, text] of [
    ['PLAN.md', 'Fixture plan; no live claims.\n'],
    ['DEPENDENCIES.md', 'Fixture conditional graph.\n'],
    ['dependencies.json', JSON.stringify(graph) + '\n'],
  ]) {
    const p = join(dir, name);
    writeFileSync(p, text);
    pins[p] = hash(text);
  }
  const acceptance = {
    verdict: 'GO_CORRECTED_COORDINATION_SCHEME',
    accepted_artifacts: { ...pins },
    counts: { nodes: 2, edges: 1 },
  };
  const acceptancePath = join(dir, 'SCHEME-ACCEPTANCE.json');
  writeFileSync(acceptancePath, JSON.stringify(acceptance) + '\n');
  pins[acceptancePath] = hash(readFileSync(acceptancePath));
  const admission = join(dir, 'admission.json');
  writeFileSync(admission, JSON.stringify({ inputs: pins }) + '\n');
  const evidence = captureSavedCoordination(
    { admissionPath: admission, projectRoot: process.cwd() },
    readReconciliationSource,
  );
  const context = {
    workflow: 'saved-coordination-v1',
    population: 'coordination-nodes',
    mode: 'overview0',
    invocation: '$pipeline',
    host: 'codex',
    date: '2026-10-10',
    readOnly: true,
    coverage: 'complete',
    expectedIds: ids,
    nodeIds: ids,
    admissionSHA256: evidence.admission.sha256,
  };
  let report = readFileSync(
    'tests/skills/pipeline-final-report/valid-overview.md',
    'utf8',
  )
    .replace('all open umbrellas', 'admitted saved coordination scheme')
    .replace(
      /Total open umbrellas:[^\n]*/,
      'Saved coordination nodes: 2. Typed edges: 1. Global open-umbrella completeness UNKNOWN; STOP.',
    );
  report = report.replace(
    /```mermaid[\s\S]*?```/,
    '```mermaid\nflowchart TB\n  paired-csv-export["Export"]\n  paired-import-check["Import"]\n  paired-csv-export -.->|"e001 conditional"| paired-import-check\n```\n\n| e001 | paired-csv-export ↓ paired-import-check | conditional | Only when affected source changes | fixture |',
  );
  // IDs may contain hyphens; snapshot validation must retain ordinary identity syntax.
  const leaders =
    '## Leading inspection priorities\n| Work identity | B | V | S | P | Chain | Next source gate |\n|---|---|---|---|---|---|---|\n' +
    ids
      .map(
        (id) =>
          '| ' +
          id +
          ' | UNKNOWN | Fixture | UNKNOWN | Plan | Conditional chain | Inspect exact predecessor proof |',
      )
      .join('\n') +
    '\n';
  const diagnostic =
    'Existing root inspection pending; no new reviewer admitted';
  const extras =
    leaders +
    '\n## Observed work synthesis\n| Work identity | Outcome | Four-axis rationale | Next source gate | Ownership / readiness | Source |\n|---|---|---|---|---|---|\n' +
    ids
      .map(
        (id, i) =>
          '| ' +
          id +
          ' | Saved milestone; completion UNKNOWN | B: UNKNOWN; V: Fixture; S: UNKNOWN; P: Plan | Exact source gate; Authorized alternatives: UNKNOWN; Concurrency conditions: UNKNOWN | fixture-owner; UNKNOWN | inputs/dependencies.json#/nodes/' +
          i +
          ' |',
      )
      .join('\n') +
    '\n\n## Synthetic and retained follow-ups\nNone invented.\n\n## Review lifecycle\n| Gate | Policy | Observed status | Source |\n|---|---|---|---|\n' +
    [
      'implementation',
      'task-review',
      'final-branch-review',
      'local-checks',
      'current-head-ci',
      'authorized-merge',
      'claim-policy',
      'stage-admission',
    ]
      .map(
        (g) =>
          '| ' +
          g +
          ' | ' +
          (g === 'task-review'
            ? 'Cap: 5; Implementer escalation: original 1–3 then more capable; Cap exit: stop and ledger'
            : g === 'claim-policy'
              ? 'GO releases; RED cancels; STOP halts'
              : 'Exact applicable gate; no execution') +
          ' | Not executed | Fixture policy |',
      )
      .join('\n') +
    '\n\n## Source fidelity review\n| Status | Capability | Reviewer | Scope | Remaining findings |\n|---|---|---|---|---|\n| UNAVAILABLE | Not invoked | Existing root | All saved nodes | ' +
    diagnostic +
    ' |\n';
  report = report.replace(
    '### Stage — overview only',
    extras + '\n### Stage — overview only',
  );
  return { dir, report, context, evidence, leaders, diagnostic, ids };
}
function invoke(f, change = {}) {
  const report = change.report ?? f.report,
    evidence = change.evidence ?? f.evidence,
    context = change.context ?? f.context;
  const all = [
    evidence.admission,
    ...evidence.sources,
    ...evidence.resources,
    ...evidence.owners,
  ];
  const ledger = {
    workflow: 'saved-coordination-v1',
    reportSHA256: hash(report),
    sourceReads: all.map((s) => ({
      path: s.path,
      sha256: s.sha256,
      startLine: 1,
      endLine: s.text.split(/\r?\n/).length - (s.text.endsWith('\n') ? 1 : 0),
    })),
    rows: f.ids.map((id, i) => ({
      id,
      graphPointer: '/nodes/' + i,
      rowSHA256: hash(
        report
          .split('## Observed work synthesis')[1]
          .split('## Synthetic and retained follow-ups')[0]
          .split('\n')
          .find((row) => row.startsWith('| ' + id + ' |')),
      ),
      sourcePaths: [
        evidence.sources.find((row) => row.path.endsWith('/dependencies.json'))
          .path,
      ],
    })),
  };
  change.ledger?.(ledger);
  const bytes = JSON.stringify(ledger);
  const review = {
    status: 'UNAVAILABLE',
    diagnostic: f.diagnostic,
    nodeIds: f.ids,
    reportSHA256: hash(report),
    ledgerSHA256: hash(bytes),
  };
  change.review?.(review);
  const values = {
    'evidence.json': JSON.stringify(evidence),
    'ledger.json': bytes,
    'review.json': JSON.stringify(review),
    'terminal.md': change.terminal ?? f.leaders,
  };
  for (const [name, body] of Object.entries(values))
    writeFileSync(join(f.dir, name), body);
  const args = [
    helper,
    '--context',
    JSON.stringify(context),
    ...['evidence', 'terminal', 'reconciliation', 'review'].flatMap((flag) =>
      flag === change.omit
        ? []
        : [
            '--' + flag,
            join(
              f.dir,
              flag === 'reconciliation'
                ? 'ledger.json'
                : flag === 'terminal'
                  ? 'terminal.md'
                  : flag + '.json',
            ),
          ],
    ),
  ];
  return spawnSync(process.execPath, args, {
    input: report,
    encoding: 'utf8',
    cwd: change.cwd ?? process.cwd(),
    env: { ...process.env, AIF_HOOK_LANG: 'en' },
  });
}
test('actual saved snapshot CLI returns exact qualified artifact, using paths with spaces', (t) => {
  const f = fixture(t),
    r = invoke(f);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, f.report);
});
test('saved workflow cannot borrow umbrella identities or bypass any source/review/terminal flags', (t) => {
  const f = fixture(t);
  for (const omit of ['evidence', 'terminal', 'reconciliation', 'review'])
    assert.equal(invoke(f, { omit }).status, 2);
  assert.equal(
    invoke(f, { context: { ...f.context, observedIds: f.ids } }).status,
    2,
  );
});
test('actual graph/source capture rejects changed bytes, forged bodies and mismatched admission', (t) => {
  const f = fixture(t);
  const e = structuredClone(f.evidence);
  e.sources[0].text += 'invented';
  assert.equal(invoke(f, { evidence: e }).status, 2);
  assert.equal(
    invoke(f, { context: { ...f.context, admissionSHA256: '0'.repeat(64) } })
      .status,
    2,
  );
  writeFileSync(f.evidence.sources[0].path, 'changed source');
  assert.equal(invoke(f).status, 2);
});
test('complete typed graph rejects missing nodes, reversed edges and lost operative conditions', (t) => {
  const f = fixture(t);
  for (const report of [
    f.report.replace('  paired-csv-export["Export"]\n', ''),
    f.report.replace(
      'paired-csv-export ↓ paired-import-check',
      'paired-import-check ↓ paired-csv-export',
    ),
    f.report.replace('| Only when affected source changes |', '| UNKNOWN |'),
  ])
    assert.equal(invoke(f, { report }).status, 1);
});
test('source read and exact row accounting, review binding and terminal gates remain enforced', (t) => {
  const f = fixture(t);
  for (const change of [
    { ledger: (l) => (l.sourceReads[0].endLine = 0) },
    { ledger: (l) => (l.rows[0].rowSHA256 = '0'.repeat(64)) },
    { review: (r) => (r.reportSHA256 = '0'.repeat(64)) },
    {
      terminal: f.leaders.replace(
        'Inspect exact predecessor proof',
        'Missing gate',
      ),
    },
    { report: f.report.replace('Cap: 5', 'Unlimited repair') },
    { report: f.report.replace('PROJECT OVERVIEW', 'EXECUTION PLAN') },
  ])
    assert.equal(invoke(f, change).status, 1);
});
test('a snapshot is not certified GO by relabelling unavailable reviewer or hiding diagnostic', (t) => {
  const f = fixture(t);
  assert.equal(invoke(f, { review: (r) => (r.status = 'GO') }).status, 1);
  assert.equal(
    invoke(f, { report: f.report.replaceAll(f.diagnostic, 'None') }).status,
    1,
  );
});

test('saved hard cycles and forged accepted counts reject at the context boundary', (t) => {
  for (const kind of ['cycle', 'count']) {
    const f = fixture(t),
      g = f.evidence.sources.find((r) => r.path.endsWith('/dependencies.json')),
      a = f.evidence.sources.find((r) =>
        r.path.endsWith('/SCHEME-ACCEPTANCE.json'),
      );
    const graph = JSON.parse(g.text),
      accepted = JSON.parse(a.text);
    if (kind === 'cycle')
      graph.edges = [
        { from: f.ids[0], to: f.ids[1], type: 'requires_accepted' },
        { from: f.ids[1], to: f.ids[0], type: 'requires_accepted' },
      ];
    writeFileSync(g.path, JSON.stringify(graph) + '\n');
    accepted.accepted_artifacts[g.path] = hash(readFileSync(g.path));
    accepted.counts.edges = graph.edges.length;
    if (kind === 'count') accepted.counts.nodes = 99;
    writeFileSync(a.path, JSON.stringify(accepted) + '\n');
    const admission = JSON.parse(f.evidence.admission.text);
    admission.inputs[g.path] = hash(readFileSync(g.path));
    admission.inputs[a.path] = hash(readFileSync(a.path));
    writeFileSync(f.evidence.admission.path, JSON.stringify(admission) + '\n');
    f.evidence = captureSavedCoordination(
      { admissionPath: f.evidence.admission.path, projectRoot: process.cwd() },
      readReconciliationSource,
    );
    f.context.admissionSHA256 = f.evidence.admission.sha256;
    const r = invoke(f);
    assert.equal(r.status, 2, r.stderr);
    assert.match(
      r.stderr,
      kind === 'cycle' ? /hard predecessor cycle/ : /counts/,
    );
  }
});

test('consumer embedded bindings need no contributor-only document, while linked bindings remain mandatory', (t) => {
  const f = fixture(t),
    root = join(f.dir, 'installed project with spaces');
  for (const source of f.evidence.resources.filter(
    (row) => !row.path.endsWith('/docs/codex-contributor.md'),
  )) {
    const name = source.path.slice(process.cwd().length + 1),
      target = join(root, name);
    mkdirSync(resolve(target, '..'), { recursive: true });
    writeFileSync(target, source.text);
  }
  const card = join(root, '.agents/skills/pipeline/SKILL.md');
  writeFileSync(
    card,
    'Native consumer binding is embedded. Read the complete canonical procedure.\n',
  );
  const evidence = captureSavedCoordination(
    { admissionPath: f.evidence.admission.path, projectRoot: root },
    readReconciliationSource,
  );
  assert.ok(
    !evidence.resources.some((row) =>
      row.path.endsWith('/docs/codex-contributor.md'),
    ),
  );
  const nested = join(root, 'nested cwd with spaces');
  mkdirSync(nested);
  const result = invoke(f, { evidence, cwd: nested });
  assert.equal(result.status, 0, result.stderr);
  writeFileSync(card, 'Read docs/codex-contributor.md before acting.\n');
  assert.throws(
    () =>
      captureSavedCoordination(
        { admissionPath: f.evidence.admission.path, projectRoot: root },
        readReconciliationSource,
      ),
    /ENOENT/,
  );
});
