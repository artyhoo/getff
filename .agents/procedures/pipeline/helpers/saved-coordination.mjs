/** Explicit immutable coordination snapshot accounting; never an umbrella collector.
 * Reuses the final-report bounded reader and common grammar/terminal gates.
 * Hash/read claims bind bytes, not semantic truth, trust or execution acceptance.
 */
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { existsSync, realpathSync } from 'node:fs';
export const SAVED_WORKFLOW = 'saved-coordination-v1';
const hash = (value) => createHash('sha256').update(value).digest('hex');
const required = [
  '.agents/skills/pipeline/SKILL.md',
  '.agents/procedures/pipeline/SKILL.md',
  ...[
    'invocation',
    'planning',
    'artifacts',
    'output-format',
    'output-overview',
    'output-examples',
    'dispatch',
    'claim-machinery',
    'failures',
  ].map((n) => '.agents/procedures/pipeline/references/' + n + '.md'),
];
const lines = (text) =>
  text.split(/\r?\n/).length - (text.endsWith('\n') ? 1 : 0);
export function captureSavedCoordination(
  {
    admissionPath,
    projectRoot,
    ownerPaths = [],
    supplementalResourcePaths = [],
  },
  readSource,
) {
  const capture = (path) => {
    const row = readSource(resolve(path));
    if (row.status !== 'read') throw new Error(row.diagnostic);
    return row;
  };
  const admission = capture(admissionPath),
    pins = JSON.parse(admission.text).inputs;
  if (!pins || Object.keys(pins).length !== 4)
    throw new Error('exact four admitted snapshot pins required');
  const sources = Object.entries(pins).map(([path, expected]) => {
    const row = capture(path);
    if (row.sha256 !== expected)
      throw new Error('admitted source hash changed: ' + path);
    return row;
  });
  const entry = capture(resolve(projectRoot, required[0]));
  const resourcePaths = [...required];
  // Contributor cards link external bindings; consumer cards embed them.
  if (entry.text.includes('docs/codex-contributor.md'))
    resourcePaths.splice(2, 0, 'docs/codex-contributor.md');
  return {
    workflow: SAVED_WORKFLOW,
    projectRoot: resolve(projectRoot),
    admission,
    sources,
    supplementalResourcePaths,
    resources: [
      ...resourcePaths.map((path) => resolve(projectRoot, path)),
      ...supplementalResourcePaths,
    ].map(capture),
    owners: ownerPaths.map(capture),
  };
}
export function savedGraph(evidence) {
  const source = evidence.sources.find((row) =>
    row.path.endsWith('/dependencies.json'),
  );
  return JSON.parse(source.text);
}
export function validateSavedContext(context, evidence, readSource) {
  const errors = [],
    fail = (message) => errors.push(message);
  if (
    evidence?.workflow !== SAVED_WORKFLOW ||
    context.workflow !== SAVED_WORKFLOW
  )
    return [
      'saved snapshot requires its explicit workflow; observed collectors cannot be relabelled',
    ];
  if (
    context.readOnly !== true ||
    context.coverage !== 'complete' ||
    context.population !== 'coordination-nodes'
  )
    fail(
      'saved scheme requires read-only complete coordination-node scope, not global completeness',
    );
  if (
    Object.hasOwn(context, 'observedIds') ||
    Object.hasOwn(context, 'sourceBindings')
  )
    fail(
      'saved milestones cannot manufacture observed umbrella identities/bindings',
    );
  if (context.admissionSHA256 !== evidence.admission?.sha256)
    fail('context must bind exact independently captured admission hash');
  try {
    let bound = resolve(process.cwd());
    while (
      !existsSync(resolve(bound, '.agents/procedures/pipeline/SKILL.md'))
    ) {
      const parent = dirname(bound);
      if (parent === bound)
        throw new Error('canonical installed project root unavailable');
      bound = parent;
    }
    if (realpathSync(evidence.projectRoot) !== realpathSync(bound))
      fail('captured resources belong to a different bound installed project');
    const expected = captureSavedCoordination(
      {
        admissionPath: evidence.admission.path,
        projectRoot: evidence.projectRoot,
        supplementalResourcePaths: evidence.supplementalResourcePaths,
        ownerPaths: (evidence.owners ?? []).map((row) => row.path),
      },
      readSource,
    );
    if (JSON.stringify(expected) !== JSON.stringify(evidence))
      fail(
        'snapshot/resources/owners differ from actual bounded source capture',
      );
    if (
      new Set(
        [
          evidence.admission,
          ...evidence.sources,
          ...evidence.resources,
          ...evidence.owners,
        ].map((row) => row.path),
      ).size !==
      1 +
        evidence.sources.length +
        evidence.resources.length +
        evidence.owners.length
    )
      fail('source inventory must have unique paths');
    const graph = savedGraph(evidence),
      ids = graph.nodes.map((row) => row.id);
    if (
      !ids.every((id) => typeof id === 'string' && /^[\w.-]+$/.test(id)) ||
      new Set(ids).size !== ids.length
    )
      fail('saved graph node identities must be unique');
    if (JSON.stringify(context.nodeIds) !== JSON.stringify(ids))
      fail('context nodeIds differ from actual saved graph');
    if (
      !Array.isArray(graph.edges) ||
      graph.edges.some(
        (edge) =>
          !ids.includes(edge.from) ||
          !ids.includes(edge.to) ||
          ![
            'requires_accepted',
            'conditional',
            'integration_contract',
            'resource_lock',
          ].includes(edge.type),
      )
    )
      fail('invalid saved typed edges');
    const accepted = JSON.parse(
      evidence.sources.find((row) =>
        row.path.endsWith('/SCHEME-ACCEPTANCE.json'),
      ).text,
    );
    if (
      accepted.verdict !== 'GO_CORRECTED_COORDINATION_SCHEME' ||
      accepted.counts.nodes !== ids.length ||
      accepted.counts.edges !== graph.edges.length
    )
      fail('scheme acceptance must bind actual node/edge counts');
    for (const row of evidence.sources.filter(
      (row) => !row.path.endsWith('/SCHEME-ACCEPTANCE.json'),
    ))
      if (accepted.accepted_artifacts?.[row.path] !== row.sha256)
        fail('accepted scheme hash differs: ' + row.path);
    const successors = new Map(
      ids.map((id) => [
        id,
        graph.edges
          .filter((e) => e.type === 'requires_accepted' && e.from === id)
          .map((e) => e.to),
      ]),
    );
    const visiting = new Set(),
      visited = new Set();
    const walk = (id) => {
      if (visiting.has(id)) throw new Error('hard predecessor cycle');
      if (visited.has(id)) return;
      visiting.add(id);
      for (const next of successors.get(id)) walk(next);
      visiting.delete(id);
      visited.add(id);
    };
    ids.forEach(walk);
  } catch (error) {
    fail(error.message);
  }
  return errors;
}
export function validateSavedReport(
  report,
  evidence,
  ledger,
  review,
  ledgerBytes,
) {
  const errors = [],
    fail = (message) => errors.push('saved scheme: ' + message),
    graph = savedGraph(evidence);
  const blocks = [...report.matchAll(/```mermaid\n([\s\S]*?)\n```/g)];
  const diagram = blocks[0]?.[1] ?? '';
  const nodeIds = [...diagram.matchAll(/^\s+([\w.-]+)\["/gm)].map((m) => m[1]);
  if (
    nodeIds.length !== graph.nodes.length ||
    new Set(nodeIds).size !== nodeIds.length ||
    graph.nodes.some((n) => !nodeIds.includes(n.id))
  )
    fail('Mermaid must declare every saved node exactly once');
  const edges = [
    ...diagram.matchAll(
      /^\s+([\w.-]+)\s+(-->|-\.->)\|"(e\d+)\s+([\w.-]+)"\|\s+([\w.-]+)$/gm,
    ),
  ];
  if (edges.length !== graph.edges.length)
    fail('Mermaid typed edge count differs');
  const visible = report.replace(/```[\s\S]*?```/g, '');
  graph.edges.forEach((edge, index) => {
    const id = 'e' + String(index + 1).padStart(3, '0'),
      matches = edges.filter((m) => m[3] === id);
    if (
      matches.length !== 1 ||
      matches[0][1] !== edge.from ||
      matches[0][5] !== edge.to ||
      matches[0][4] !== edge.type ||
      matches[0][2] !== (edge.type === 'requires_accepted' ? '-->' : '-.->')
    )
      fail(id + ': Mermaid typed relation differs');
    const rows = visible
      .split('\n')
      .filter((row) => row.startsWith('| ' + id + ' |'));
    if (
      rows.length !== 1 ||
      !rows[0].includes(edge.from + ' ↓ ' + edge.to) ||
      !rows[0].includes('| ' + edge.type + ' |')
    )
      fail(id + ': equivalent text relation missing/changed');
    if (
      edge.condition &&
      !rows[0]?.includes(edge.condition.replaceAll('|', '\\|'))
    )
      fail(id + ': operative edge condition missing');
  });
  const count =
    'Saved coordination nodes: ' +
    graph.nodes.length +
    '. Typed edges: ' +
    graph.edges.length +
    '. Global open-umbrella completeness UNKNOWN; STOP.';
  if (
    visible
      .split('\n')
      .filter((row) => row.startsWith('Saved coordination nodes:')).length !==
      1 ||
    !visible.includes(count)
  )
    fail(
      'exact saved population and global UNKNOWN/STOP qualification required',
    );
  const all = [
    evidence.admission,
    ...evidence.sources,
    ...evidence.resources,
    ...evidence.owners,
  ];
  if (
    ledger?.workflow !== SAVED_WORKFLOW ||
    ledger.reportSHA256 !== hash(report) ||
    !Array.isArray(ledger.sourceReads) ||
    !Array.isArray(ledger.rows)
  )
    return [
      ...errors,
      'saved scheme requires exact report-bound source-read ledger',
    ];
  if (
    ledger.sourceReads.length !== all.length ||
    new Set(ledger.sourceReads.map((row) => row.path)).size !== all.length
  )
    fail(
      'source accounting must cover every input/resource/owner exactly once',
    );
  for (const source of all) {
    const row = ledger.sourceReads.find((r) => r.path === source.path);
    if (
      !row ||
      row.sha256 !== source.sha256 ||
      row.startLine !== 1 ||
      row.endLine !== lines(source.text)
    )
      fail('complete actual source-read range/hash required: ' + source.path);
  }
  const section =
    visible
      .split('## Observed work synthesis')[1]
      ?.split('## Synthetic and retained follow-ups')[0] ?? '';
  if (
    ledger.rows.length !== graph.nodes.length ||
    new Set(ledger.rows.map((row) => row.id)).size !== graph.nodes.length
  )
    fail('ledger must cover exact node population');
  graph.nodes.forEach((node, index) => {
    const rows = section
        .split('\n')
        .filter((row) => row.startsWith('| ' + node.id + ' |')),
      entry = ledger.rows.find((row) => row.id === node.id);
    if (
      rows.length !== 1 ||
      !entry ||
      entry.graphPointer !== '/nodes/' + index ||
      entry.rowSHA256 !== hash(rows[0]) ||
      !rows[0].includes('/nodes/' + index)
    )
      fail(node.id + ': row/graph pointer accounting differs');
    if (
      !entry ||
      !Array.isArray(entry.sourcePaths) ||
      !entry.sourcePaths.includes(
        evidence.sources.find((row) => row.path.endsWith('/dependencies.json'))
          .path,
      ) ||
      entry.sourcePaths.some(
        (path) => !all.some((source) => source.path === path),
      )
    )
      fail(node.id + ': foreign/missing attributed source');
  });
  if (
    !review ||
    !['GO', 'REVISE', 'UNAVAILABLE'].includes(review.status) ||
    review.reportSHA256 !== hash(report) ||
    review.ledgerSHA256 !== hash(ledgerBytes) ||
    JSON.stringify(review.nodeIds) !==
      JSON.stringify(graph.nodes.map((row) => row.id))
  )
    fail('review receipt must bind exact report/ledger/full saved population');
  if (review?.status === 'GO') {
    if (
      !review.reviewer ||
      !review.implementer ||
      review.reviewer === review.implementer ||
      !review.capability ||
      !review.nativeEvidence ||
      !Array.isArray(review.findings) ||
      review.findings.some((f) => ['MAJOR', 'BLOCKER'].includes(f.severity))
    )
      fail(
        'GO requires actual distinct review identity/evidence and no unresolved major finding',
      );
  } else if (!review?.diagnostic || !visible.includes(review.diagnostic))
    fail('actual non-GO review diagnostic must remain visible');
  const fidelity =
    visible.split('## Source fidelity review')[1]?.split(/^## /m)[0] ?? '';
  const reviewRows = fidelity
    .split('\n')
    .filter((row) => row.startsWith('| ' + review?.status + ' |'));
  if (
    reviewRows.length !== 1 ||
    (review?.status !== 'GO' && !reviewRows[0].includes(review?.diagnostic))
  )
    fail(
      'source-fidelity review table must retain actual status and diagnostic',
    );
  return errors;
}
