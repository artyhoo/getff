#!/usr/bin/env node
/** Overview artifact grammar, not factual certification or trusted Stop enforcement.
 * Reuses SSOT #304's dependency-free scoped Markdown approach and #269 entry identity.
 * Invocation/language/ambiguity repairs: docs_form_closure integration lane.
 */
import {
  readFileSync,
  openSync,
  closeSync,
  fstatSync,
  readSync,
  constants,
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  SAVED_WORKFLOW,
  validateSavedContext,
  validateSavedReport,
} from './saved-coordination.mjs';
import { isMainEntry } from './lib/is-main-entry.mjs';
import {
  sourcePathBindings,
  acceptanceSourceClaims,
  sourceEvidenceRecords,
} from './overview.mjs';

// Reusable actual read capture for inventory-only sources and their failures.
export function readReconciliationSource(path) {
  let descriptor;
  try {
    descriptor = openSync(path, constants.O_RDONLY | constants.O_NONBLOCK);
    const before = fstatSync(descriptor);
    if (!before.isFile() || before.size > 2 * 1024 * 1024)
      throw Object.assign(
        new Error('source is not a bounded regular file: ' + path),
        { code: 'SOURCE_READ_CONTRACT' },
      );
    const buffer = Buffer.alloc(before.size + 1);
    let length = 0,
      count;
    while (
      length < buffer.length &&
      (count = readSync(
        descriptor,
        buffer,
        length,
        buffer.length - length,
        null,
      ))
    )
      length += count;
    const after = fstatSync(descriptor),
      bytes = buffer.subarray(0, length);
    if (
      length !== before.size ||
      before.mtimeMs !== after.mtimeMs ||
      before.ctimeMs !== after.ctimeMs
    )
      throw Object.assign(new Error('source changed during read: ' + path), {
        code: 'SOURCE_READ_CHANGED',
      });
    const text = new TextDecoder('utf-8', {
      fatal: true,
      ignoreBOM: true,
    }).decode(bytes);
    return {
      path,
      status: 'read',
      text,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
  } catch (error) {
    return {
      path,
      status: 'unavailable',
      errorCode: error.code || 'SOURCE_READ_ERROR',
      diagnostic: error.message,
    };
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

// This binds source reads and authored row statements, not their semantic truth.
// The independent review receipt remains evidence to inspect in the native trace.
export function validateSourceReconciliation(
  ledger,
  evidence,
  report,
  review,
  ledgerBytes = JSON.stringify(ledger),
  verifiedReadFailures = new Map(),
) {
  const errors = [];
  const hash = (value) => createHash('sha256').update(value).digest('hex');
  const normalized = (value) =>
    typeof value === 'string'
      ? value.replaceAll('\\|', '|').replace(/\s+/g, ' ').trim()
      : '';
  const fail = (id, message) => errors.push(`${id}: ${message}`);
  if (
    ledger?.version !== 1 ||
    !Array.isArray(ledger.rows) ||
    !Array.isArray(ledger.sourceReads)
  )
    return [
      'source reconciliation version 1 requires rows and actual sourceReads',
    ];
  const ids = evidence?.observedIds;
  if (
    !evidence?.localEvidence ||
    Object.values(evidence.localEvidence).some(
      (sources) => !Array.isArray(sources),
    )
  )
    return ['actual source inventory arrays required'];
  if (
    !Array.isArray(ids) ||
    ledger.rows.length !== ids.length ||
    new Set(ledger.rows.map((row) => row?.id)).size !== ids.length ||
    ledger.rows.some((row) => !ids.includes(row?.id))
  )
    return [
      'source reconciliation differs from independently observed identities',
    ];
  const records = sourceEvidenceRecords(evidence);
  const captured = new Map();
  for (const sources of Object.values(records))
    for (const source of sources)
      if (typeof source.text === 'string') captured.set(source.path, source);
  const reads = new Map();
  const inventory = new Set(
    Object.values(records)
      .flat()
      .map((source) => source.path),
  );
  for (const read of ledger.sourceReads) {
    if (!read || !inventory.has(read.path) || reads.has(read.path)) {
      fail('sourceReads', 'foreign or duplicate source path');
      continue;
    }
    reads.set(read.path, read);
    if (read.status === 'unavailable') {
      const recorded = Object.values(records)
        .flat()
        .find(
          (source) =>
            source.path === read.path && source.error === read.diagnostic,
        );
      const failure = verifiedReadFailures.get(read.path);
      if (
        (!recorded &&
          (!failure ||
            failure.diagnostic !== read.diagnostic ||
            failure.errorCode !== read.errorCode)) ||
        !normalized(read.diagnostic)
      )
        fail(
          read.path,
          'unavailable read requires its actual captured diagnostic',
        );
      continue;
    }
    if (
      read.status !== 'read' ||
      typeof read.text !== 'string' ||
      hash(read.text) !== read.sha256
    ) {
      fail(read.path, 'read body and SHA-256 required');
      continue;
    }
    // A bounded collector may inventory a real Git blob without reading its body.
    // Its immutable object identity still binds any later supplied full read.
    const origin = Object.values(records)
      .flat()
      .find((item) => item.path === read.path)?.origin;
    if (origin?.kind === 'git-object') {
      const bytes = Buffer.from(read.text, 'utf8');
      const oid =
        typeof origin.blobOid === 'string' &&
        /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(origin.blobOid)
          ? createHash(origin.blobOid.length === 64 ? 'sha256' : 'sha1')
              .update(Buffer.from(`blob ${bytes.length}\0`))
              .update(bytes)
              .digest('hex')
          : null;
      if (oid === null || oid !== origin.blobOid)
        fail(
          read.path,
          'cached read body differs from independently recorded Git blob',
        );
    }
    const source = captured.get(read.path);
    if (source && (source.text !== read.text || source.sha256 !== read.sha256))
      fail(read.path, 'read differs from independently captured source body');
  }
  const lines = outsideFences(report).lines;
  const observed = witnessedTable(
    lines,
    '## Observed work synthesis',
    [
      'Work identity',
      'Outcome',
      'Four-axis rationale',
      'Next source gate',
      'Ownership / readiness',
      'Source',
    ],
    errors,
  );
  const output = new Map(observed.map((row) => [row[0], row]));
  for (const entry of ledger.rows) {
    const sources = records[entry.id] ?? [];
    const paths = [...new Set(sources.map((source) => source.path))];
    if (
      entry.relatedSources !== undefined &&
      !Array.isArray(entry.relatedSources)
    )
      fail(entry.id, 'relatedSources must be an array');
    for (const related of Array.isArray(entry.relatedSources)
      ? entry.relatedSources
      : []) {
      if (
        !related ||
        !ids.includes(related.workIdentity) ||
        !normalized(related.reason) ||
        !(records[related.workIdentity] ?? []).some(
          (source) => source.path === related.path,
        )
      )
        fail(
          entry.id,
          'related chronology source requires its specific observed identity and relationship',
        );
      else if (!paths.includes(related.path)) paths.push(related.path);
    }
    if (
      !Array.isArray(entry.readPaths) ||
      entry.readPaths.length !== paths.length ||
      new Set(entry.readPaths).size !== paths.length ||
      paths.some((path) => !entry.readPaths.includes(path)) ||
      paths.some((path) => !reads.has(path))
    )
      fail(
        entry.id,
        'account for every collected source inventory path before synthesis',
      );
    const row = output.get(entry.id);
    if (!row) {
      fail(entry.id, 'actual output row missing');
      continue;
    }
    for (const [field, cell] of [
      ['outcome', 1],
      ['gate', 3],
      ['alternatives', 3],
      ['concurrency', 3],
      ['chronology', null],
    ]) {
      const claim = entry[field];
      const statement = normalized(claim?.statement);
      if (!statement || !Array.isArray(claim?.support)) {
        fail(entry.id, `${field} requires an authored statement and support`);
        continue;
      }
      if (
        !(
          cell === null
            ? normalized(row[1] + ' ' + row[3])
            : normalized(row[cell])
        ).includes(statement)
      )
        fail(entry.id, `${field} statement not carried into the actual output`);
      if (!claim.support.length) {
        if (
          claim.status !== 'unavailable' ||
          !normalized(claim.reason) ||
          !normalized(row[1] + ' ' + row[3]).includes(normalized(claim.reason))
        )
          fail(
            entry.id,
            `${field} unsupported claim requires an explicit output-visible limitation`,
          );
        continue;
      }
      for (const citation of claim.support) {
        const read = reads.get(citation?.path);
        const sourceLines = read?.text?.split(/\r?\n/);
        if (
          !citation ||
          !sourceLines ||
          !paths.includes(citation.path) ||
          read?.status !== 'read' ||
          citation.sha256 !== read.sha256 ||
          !Number.isSafeInteger(citation.startLine) ||
          !Number.isSafeInteger(citation.endLine) ||
          citation.startLine < 1 ||
          citation.endLine < citation.startLine ||
          citation.endLine > sourceLines?.length ||
          sourceLines
            .slice(citation.startLine - 1, citation.endLine)
            .join('\n') !== citation.text
        ) {
          fail(
            entry.id,
            `${field} source excerpt identity/line/bytes mismatch`,
          );
          continue;
        }
        if (
          !citation.text
            .split(/\r?\n/)
            .some(
              (line) =>
                line.trim() && !/^\s*(?:#{1,6}\s|[-=_]{3,}\s*$)/.test(line),
            )
        )
          fail(
            entry.id,
            `${field} heading-only excerpt cannot supply substantive evidence`,
          );
      }
    }
  }
  const reviewRows = witnessedTable(
    lines,
    '## Source fidelity review',
    ['Status', 'Capability', 'Reviewer', 'Scope', 'Remaining findings'],
    errors,
  );
  if (
    !review ||
    !['GO', 'REVISE', 'UNAVAILABLE'].includes(review.status) ||
    review.reportSHA256 !== hash(report) ||
    review.ledgerSHA256 !== hash(ledgerBytes) ||
    !Array.isArray(review.observedIds) ||
    review.observedIds.join('\0') !== ids.join('\0') ||
    !Number.isSafeInteger(review.repairPasses) ||
    review.repairPasses < 0 ||
    review.repairPasses > 2
  )
    errors.push(
      'source fidelity review requires exact report/ledger/population and a finite repair count',
    );
  if (
    reviewRows.length !== 1 ||
    reviewRows[0][0] !== review?.status ||
    reviewRows[0][1] !== review?.capability ||
    reviewRows[0][2] !== review?.reviewer ||
    reviewRows[0][3] !== 'all observed identities'
  )
    errors.push(
      'actual report must retain the actual full-scope source fidelity review status',
    );
  const findingText = Array.isArray(review?.findings)
    ? review.findings.map(
        (item) => `${item?.severity}: ${item?.workIdentity}: ${item?.text}`,
      )
    : [];
  if (
    (review?.status === 'REVISE' || review?.findings !== undefined) &&
    (!Array.isArray(review?.findings) ||
      review.findings.some(
        (item) =>
          !item ||
          !['BLOCKER', 'MAJOR', 'MINOR'].includes(item.severity) ||
          (!ids.includes(item.workIdentity) &&
            item.workIdentity !== 'REPORT') ||
          !normalized(item.text),
      ))
  )
    errors.push(
      'review findings require severity, observed work identity or REPORT, and actual finding text',
    );
  const remaining =
    [review?.diagnostic, ...findingText].filter(Boolean).join('; ') ||
    (review?.status === 'GO' ? 'None' : '');
  if (
    reviewRows.length === 1 &&
    normalized(reviewRows[0][4]) !== normalized(remaining)
  )
    errors.push(
      'remaining findings table cell must retain the exact actual receipt diagnostic/findings',
    );
  if (
    review?.status === 'GO' &&
    (!normalized(review.capability) ||
      !normalized(review.reviewer) ||
      !normalized(review.implementer) ||
      review.reviewer === review.implementer ||
      !normalized(review.nativeEvidence) ||
      !Array.isArray(review.findings) ||
      review.findings.some(
        (item) => !item || ['BLOCKER', 'MAJOR'].includes(item.severity),
      ))
  )
    errors.push(
      'GO requires distinct actual reviewer/capability/native evidence and no unresolved MAJOR/BLOCKER',
    );
  if (
    review?.status !== 'GO' &&
    (!normalized(review?.diagnostic) ||
      !normalized(report).includes(normalized(review.diagnostic)))
  )
    errors.push(
      'unavailable/revise review must retain its actual diagnostic in the output',
    );
  return errors;
}

export function validateEvidenceContext(context, evidence) {
  if (context.workflow === SAVED_WORKFLOW)
    return validateSavedContext(context, evidence, readReconciliationSource);
  if (
    !['observed-synthesis-v2', 'observed-synthesis-v3'].includes(
      context.workflow,
    )
  )
    return [
      'collector evidence requires a source-bound workflow; legacy downgrade is not accepted',
    ];
  if (
    evidence?.workflow === 'observed-synthesis-v3' &&
    context.workflow !== evidence.workflow
  )
    return [
      'current collector workflow cannot be borrowed for a legacy downgrade',
    ];
  if (
    context.workflow === 'observed-synthesis-v3' &&
    evidence?.workflow !== context.workflow
  )
    return ['current workflow requires the actual current collector version'];
  if (
    evidence?.sourceReconciliationVersion === 1 &&
    context.sourceReconciliationVersion !== 1
  )
    return ['current collector source reconciliation cannot be downgraded'];
  if (
    evidence?.sourceReconciliationVersion === 1 &&
    JSON.stringify(context.cachedSourceBindings) !==
      JSON.stringify(
        sourcePathBindings(evidence.cachedEvidence ?? {}, evidence.observedIds),
      )
  )
    return [
      'cachedSourceBindings differ from independently captured Git-object sources',
    ];
  if (
    !evidence ||
    !Array.isArray(evidence.observedIds) ||
    !evidence.localEvidence ||
    typeof evidence.localEvidence !== 'object' ||
    Array.isArray(evidence.localEvidence)
  )
    return [
      'collector evidence requires independent observedIds and localEvidence',
    ];
  if (
    JSON.stringify(context.observedIds) !== JSON.stringify(evidence.observedIds)
  )
    return ['context identities differ from independent collector evidence'];
  const expected = sourcePathBindings(
    evidence.localEvidence,
    evidence.observedIds,
  );
  if (
    !context.sourceBindings ||
    Object.keys(context.sourceBindings).length !==
      evidence.observedIds.length ||
    evidence.observedIds.some(
      (id) =>
        !Object.hasOwn(context.sourceBindings, id) ||
        JSON.stringify(context.sourceBindings[id]) !==
          JSON.stringify(expected[id]),
    )
  )
    return [
      'context sourceBindings differ from independent collector evidence',
    ];
  const sources = sourceEvidenceRecords(evidence);
  const claims = acceptanceSourceClaims(sources, evidence.observedIds);
  if (
    (claims.length ||
      context.workflow === 'observed-synthesis-v3' ||
      context.acceptanceSourceClaims !== undefined) &&
    JSON.stringify(context.acceptanceSourceClaims) !== JSON.stringify(claims)
  )
    return [
      'context acceptanceSourceClaims differ from independent collector evidence',
    ];
  const resolutions = context.acceptanceResolutions ?? {};
  if (
    !resolutions ||
    typeof resolutions !== 'object' ||
    Array.isArray(resolutions)
  )
    return ['acceptance resolutions must be separately source-bound records'];
  for (const [id, resolution] of Object.entries(resolutions)) {
    const claim = claims.find((row) => row.id === id);
    if (
      !claim ||
      !resolution ||
      !['resolved', 'superseded'].includes(resolution.status) ||
      JSON.stringify(resolution.taskIds) !== JSON.stringify(claim.taskIds) ||
      !claim.taskIds.length
    )
      return [
        'acceptance resolution must match the specifically associated task and claim identity',
      ];
    const source = Object.values(sources)
      .flat()
      .find(
        (row) =>
          row.path === resolution.sourcePath &&
          typeof row.text === 'string' &&
          row.sha256 === resolution.sourceSha256,
      );
    if (
      !source ||
      ![claim.owner, ...claim.taskIds].includes(source.owner) ||
      createHash('sha256').update(source.text).digest('hex') !==
        resolution.sourceSha256 ||
      !Number.isSafeInteger(resolution.sourceLine) ||
      resolution.sourceLine < 1 ||
      source.text.split(/\r?\n/)[resolution.sourceLine - 1]?.trim() !==
        resolution.text ||
      resolution.text === claim.text.trim()
    )
      return [
        'acceptance resolution requires a distinct actual source statement and exact source identity/line',
      ];
    const labels = [...claim.text.matchAll(/\b[A-Z]\d+\b/g)].map(
      (match) => match[0],
    );
    const targets = [
      ...claim.text.matchAll(/`([^`]+\.(?:md|sh|mjs|ts|py))`/g),
    ].map((match) => match[1]);
    if (
      !claim.prNumbers.length ||
      !(labels.length || targets.length) ||
      claim.prNumbers.some(
        (pr) => !new RegExp(`#${pr}\\b`).test(resolution.text),
      ) ||
      [...labels, ...targets].some((value) => !resolution.text.includes(value))
    )
      return [
        'acceptance resolution must retain the same task PR, acceptance identity and verification target; historical merge or unrelated proof is insufficient',
      ];
  }
  return [];
}

export function validateContext(context) {
  const errors = [];
  if (!context || context.mode !== 'overview0')
    errors.push('resolved mode must be overview0');
  if (!['claude', 'codex'].includes(context?.host))
    errors.push('active host required');
  const invocation =
    context?.host === 'codex' ? /^\$pipeline(?: 0)?$/ : /^\/pipeline(?: 0)?$/;
  if (
    typeof context?.invocation !== 'string' ||
    !invocation.test(context.invocation)
  )
    errors.push(
      'explicit current operator invocation must match host and overview mode',
    );
  const date = context?.date;
  if (
    typeof date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date
  )
    errors.push('valid capture date required');
  if (!['complete', 'partial'].includes(context?.coverage))
    errors.push('external coverage state required');
  if (
    context?.coverage === 'complete' &&
    (!Array.isArray(context.expectedIds) ||
      context.expectedIds.some(
        (id) => typeof id !== 'string' || !/^[\w.-]+$/.test(id),
      ) ||
      new Set(context.expectedIds).size !== context.expectedIds.length)
  )
    errors.push('complete coverage requires unique reconciled expectedIds');
  if (
    context?.workflow === SAVED_WORKFLOW &&
    (!Array.isArray(context.nodeIds) ||
      context.nodeIds.some(
        (id) => typeof id !== 'string' || !/^[\w.-]+$/.test(id),
      ) ||
      new Set(context.nodeIds).size !== context.nodeIds.length ||
      context.readOnly !== true)
  )
    errors.push(
      'saved scheme requires unique actual nodeIds and read-only scope',
    );
  if (
    context?.workflow !== undefined &&
    ![
      'observed-synthesis-v1',
      'observed-synthesis-v2',
      'observed-synthesis-v3',
      SAVED_WORKFLOW,
    ].includes(context.workflow)
  )
    errors.push('unsupported overview workflow version');
  if (
    [
      'observed-synthesis-v1',
      'observed-synthesis-v2',
      'observed-synthesis-v3',
    ].includes(context?.workflow) &&
    !Object.hasOwn(context, 'observedIds')
  )
    errors.push(
      'current observed-synthesis workflow requires independent observedIds',
    );
  if (
    context &&
    Object.hasOwn(context, 'observedIds') &&
    (!Array.isArray(context.observedIds) ||
      context.observedIds.some(
        (id) => typeof id !== 'string' || !/^[\w.-]+$/.test(id),
      ) ||
      new Set(context.observedIds).size !== context.observedIds.length)
  )
    errors.push(
      'observedIds must be unique identities from independent local evidence',
    );
  if (
    ['observed-synthesis-v2', 'observed-synthesis-v3'].includes(
      context?.workflow,
    )
  ) {
    const bindings = context.sourceBindings;
    if (
      !bindings ||
      typeof bindings !== 'object' ||
      Array.isArray(bindings) ||
      !Array.isArray(context.observedIds) ||
      Object.keys(bindings).length !== context.observedIds.length ||
      context.observedIds.some(
        (id) =>
          !Object.hasOwn(bindings, id) ||
          !Array.isArray(bindings[id]) ||
          bindings[id].some(
            (path) =>
              typeof path !== 'string' || !path.trim() || /[\n\r|]/.test(path),
          ) ||
          new Set(bindings[id]).size !== bindings[id].length,
      )
    )
      errors.push(
        'sourceBindings must cover the independent observed identities with unique source paths',
      );
  }
  if (typeof context?.readOnly !== 'boolean')
    errors.push('scope readOnly must be explicit');
  if (
    !context?.tokens ||
    ['paste', 'when', 'waiting', 'parallel'].some(
      (key) => typeof context.tokens[key] !== 'string' || !context.tokens[key],
    )
  )
    errors.push('selected language tokens required');
  return errors;
}

function outsideFences(raw) {
  let fence;
  const lines = [];
  for (const line of raw.split(/\r?\n/)) {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (
        marker[1][0] === fence[0] &&
        marker[1].length >= fence.length &&
        /^ {0,3}(`+|~+)\s*$/.test(line)
      )
        fence = undefined;
      continue;
    }
    if (!fence) lines.push(line);
  }
  return { lines, unclosed: Boolean(fence) };
}
function cells(line) {
  if (!/^ {0,3}\|.*\|[ \t]*$/.test(line)) return null;
  return line
    .trim()
    .slice(1, -1)
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replaceAll('\\|', '|'));
}

function outsideInlineCode(line) {
  // Only single-line code spans are needed by the existing report vocabulary.
  // Match equal-length backtick runs; an escaped/unmatched opener hides nothing.
  const runs = [...line.matchAll(/`+/g)];
  let result = '',
    start = 0;
  for (let i = 0; i < runs.length; i++) {
    const open = runs[i];
    const backslashes =
      line.slice(0, open.index).match(/\\+$/)?.[0].length || 0;
    if (backslashes % 2) continue;
    const closeIndex = runs.findIndex(
      (run, index) => index > i && run[0].length === open[0].length,
    );
    if (closeIndex < 0) continue;
    const close = runs[closeIndex];
    result +=
      line.slice(start, open.index) +
      ' '.repeat(close.index + close[0].length - open.index);
    start = close.index + close[0].length;
    i = closeIndex;
  }
  return result + line.slice(start);
}

function outsideAngledLinkDestinations(line) {
  // Scoped single-line Markdown links: mask only their destination for HTML
  // detection, retaining labels and surrounding raw markup. Not a full parser.
  const links =
    /(\[(?:\\[^\n]|[^\[\]\\\n])*\]\(\s*)(<[^<>\n]*>)(\s*(?:"[^"\n]*"|'[^'\n]*')?\s*\))/g;
  return line.replace(links, (link, prefix, destination, suffix, offset) => {
    const backslashes = line.slice(0, offset).match(/\\+$/)?.[0].length || 0;
    if (backslashes % 2) return link;
    return prefix + ' '.repeat(destination.length) + suffix;
  });
}

// Versioned optional witness preserves historical unwitnessed partial grammar.
// It accounts for local observations; it cannot prove open scope or factual quality.
function witnessedTable(lines, heading, columns, errors) {
  const start = lines.indexOf(heading);
  if (start < 0) {
    errors.push(`${heading}: required witnessed table missing`);
    return [];
  }
  const end = lines.findIndex(
    (line, index) => index > start && /^#{1,6} /.test(line),
  );
  const body = lines.slice(start + 1, end < 0 ? undefined : end);
  const header = body.findIndex(
    (line) => JSON.stringify(cells(line)) === JSON.stringify(columns),
  );
  const separator = cells(body[header + 1] || '');
  if (
    header < 0 ||
    separator?.length !== columns.length ||
    !separator.every((cell) => /^:?-{3,}:?$/.test(cell))
  ) {
    errors.push(`${heading}: witnessed columns or separator missing`);
    return [];
  }
  const rows = [];
  let ended = false;
  for (const line of body.slice(header + 2)) {
    const row = cells(line);
    if (!row) {
      ended = true;
      continue;
    }
    if (ended) {
      errors.push(`${heading}: detached table row`);
      continue;
    }
    if (row.length !== columns.length || row.some((cell) => !cell)) {
      errors.push(`${heading}: nonempty cells required`);
      continue;
    }
    rows.push(row);
  }
  return rows;
}

export function validateFinalReport(raw, context) {
  const saved = context.workflow === SAVED_WORKFLOW;
  const synthesisIds = saved ? context.nodeIds : context.observedIds;
  const contextErrors = validateContext(context);
  if (contextErrors.length) return { contextErrors, errors: [] };
  const errors = [];
  if (typeof raw !== 'string')
    return { contextErrors, errors: ['report must be UTF-8 Markdown'] };
  const parsed = outsideFences(raw),
    lines = parsed.lines,
    text = lines.join('\n');
  if (parsed.unclosed) errors.push('unclosed fence');
  // This scoped Markdown grammar supports no raw HTML outside code fences.
  // Reject concealment instead of treating invisible comment/block anchors as content.
  const htmlVisible = lines
    .map(outsideInlineCode)
    .map(outsideAngledLinkDestinations)
    .join('\n');
  if (
    /<!--|-->|<\?|<!(?:[A-Za-z]|\[)|<\/?[A-Za-z][A-Za-z0-9-]*(?:\s|\/?>)/.test(
      htmlVisible,
    )
  )
    errors.push('unsupported raw HTML/comment outside fences');
  const title = lines.findIndex(
    (line) =>
      line ===
      `PROJECT OVERVIEW — ${saved ? 'admitted saved coordination scheme' : 'all open umbrellas'} (${context.date})`,
  );
  if (title < 0)
    errors.push('dated header missing or differs from capture date');
  if (
    title < 1 ||
    !/^═{3,}\s*$/.test(lines[title - 1]) ||
    !/^═{3,}\s*$/.test(lines[title + 1] || '')
  )
    errors.push(
      'opening separators required immediately before and after dated header',
    );
  const graph = lines.findIndex((line) =>
    /^## Dependency graph\s*$/.test(line),
  );
  const queue = lines.findIndex((line) =>
    /^## Action queue(?:\s+—.*)?$/.test(line),
  );
  const stage = lines.findIndex((line) =>
    /^### Stage — overview only\s*$/.test(line),
  );
  if (
    graph < 0 ||
    queue <= graph ||
    !lines.slice(graph + 1, queue).some((line) => line.trim())
  )
    errors.push('dependency graph requires a real text fallback');
  if (stage <= queue || stage < 0)
    errors.push('overview-only stage missing or misplaced');
  if (
    stage < 0 ||
    !lines.slice(stage + 1).some((line) => /^═{3,}\s*$/.test(line)) ||
    !/^═{3,}\s*$/.test(lines.filter((line) => line.trim()).at(-1) || '')
  )
    errors.push('closing separator missing after overview-only stage');
  const end = lines.findIndex(
    (line, index) => index > queue && /^#{1,6} /.test(line),
  );
  const queueLines =
    queue < 0 ? [] : lines.slice(queue + 1, end < 0 ? undefined : end);
  const expected = [
    '#',
    context.tokens.paste,
    context.tokens.when,
    context.tokens.waiting,
    context.tokens.parallel,
  ];
  const header = queueLines.findIndex(
    (line) => JSON.stringify(cells(line)) === JSON.stringify(expected),
  );
  const rows = [];
  if (
    header < 0 ||
    !cells(queueLines[header + 1] || '')?.every((cell) =>
      /^:?-{3,}:?$/.test(cell),
    ) ||
    cells(queueLines[header + 1] || '')?.length !== 5
  )
    errors.push(
      'queue columns or separator missing for selected host/language',
    );
  else {
    let terminated = false;
    for (const line of queueLines.slice(header + 2)) {
      const row = cells(line);
      if (!row) {
        terminated = true;
        continue;
      } // A blank/paragraph ends the table.
      if (terminated) {
        if (/^\d+\s+—\s+[\w.-]+$/.test(row[0]))
          errors.push(
            'detached identity-bearing queue row after table termination',
          );
        continue;
      }
      if (row.length !== 5 || row.some((cell) => !cell)) {
        errors.push('queue row requires five nonempty cells');
        continue;
      }
      const id = row[0].match(/^\d+\s+—\s+([\w.-]+)$/)?.[1];
      if (!id) {
        errors.push('queue row requires rank — work identity');
        continue;
      }
      if (rows.includes(id)) errors.push(`duplicate work identity: ${id}`);
      rows.push(id);
      if (context.readOnly && !/^(?:Unavailable:|Недоступно:)/.test(row[1]))
        errors.push(`${id}: read-only paste must explicitly be unavailable`);
      const invocations = [...row[1].matchAll(/([$/])pipeline\s+([\w.-]+)/g)];
      if (
        invocations.some(
          (match) =>
            match[1] !== (context.host === 'codex' ? '$' : '/') ||
            match[2] !== id,
        )
      )
        errors.push(`${id}: wrong native invocation`);
      if (context.readOnly && /^(?:NOW|Now|СЕЙЧАС)$/.test(row[2]))
        errors.push(`${id}: read-only scope cannot claim launch NOW`);
      if (
        context.nonlaunchableIds?.includes(id) &&
        /^(?:NOW|Now|СЕЙЧАС)$/.test(row[2])
      )
        errors.push(
          `${id}: supplied nonlaunchable observation contradicts NOW`,
        );
    }
  }
  if (synthesisIds !== undefined) {
    const observed = witnessedTable(
      lines,
      '## Observed work synthesis',
      [
        'Work identity',
        'Outcome',
        'Four-axis rationale',
        'Next source gate',
        'Ownership / readiness',
        'Source',
      ],
      errors,
    );
    const identities = observed.map((row) => row[0]);
    if (
      new Set(identities).size !== identities.length ||
      identities.length !== synthesisIds.length ||
      identities.some((id) => !synthesisIds.includes(id))
    )
      errors.push('observed inventory differs from independent witness');
    if (rows.some((id) => !synthesisIds.includes(id)))
      errors.push('queue identity absent from observed inventory');
    for (const row of observed) {
      if (
        !['B', 'V', 'S', 'P'].every((axis) =>
          new RegExp(`(?:^|;\\s*)${axis}:\\s*[^;\\s][^;]*`).test(row[2]),
        )
      )
        errors.push(
          `${row[0]}: four-axis rationale requires B/V/S/P evidence or explicit UNKNOWN`,
        );
      if (
        ['observed-synthesis-v2', 'observed-synthesis-v3'].includes(
          context.workflow,
        )
      ) {
        const localPaths = context.sourceBindings[row[0]] ?? [];
        const paths = localPaths.length
          ? localPaths
          : (context.cachedSourceBindings?.[row[0]] ?? []);
        if (
          paths.length &&
          !paths.some((path) => {
            const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return new RegExp(
              '(?:^|[<(\\s`])' + escaped + '(?=[:>)\\s`]|$)',
            ).test(row[5]);
          })
        )
          errors.push(
            `${row[0]}: source binding requires the most specific collected owner's source; ancestor-only citation is insufficient`,
          );
      }
      if (
        (context.workflow === 'observed-synthesis-v3' || saved) &&
        !['Authorized alternatives', 'Concurrency conditions'].every((label) =>
          new RegExp(label + ':\\s*[^;\\s][^;]*').test(row[3]),
        )
      )
        errors.push(
          `${row[0]}: source gate requires explicit authorized alternatives and concurrency conditions, including UNKNOWN when unverified`,
        );
    }
    const lifecycle = witnessedTable(
      lines,
      '## Review lifecycle',
      ['Gate', 'Policy', 'Observed status', 'Source'],
      errors,
    );
    const gates = [
      'implementation',
      'task-review',
      'final-branch-review',
      'local-checks',
      'current-head-ci',
      'authorized-merge',
      'claim-policy',
      'stage-admission',
    ];
    const actual = lifecycle.map((row) => row[0]);
    if (
      new Set(actual).size !== actual.length ||
      actual.length !== gates.length ||
      actual.some((gate) => !gates.includes(gate))
    )
      errors.push(
        'review lifecycle requires each applicable policy gate and observed status',
      );
    const claimPolicy =
      lifecycle.find((row) => row[0] === 'claim-policy')?.[1] ?? '';
    if (
      !['GO', 'RED', 'STOP'].every((outcome) =>
        new RegExp(`\\b${outcome}\\b`).test(claimPolicy),
      )
    )
      errors.push('claim-policy must explain GO, RED and STOP outcomes');
    if (context.workflow === 'observed-synthesis-v3' || saved) {
      const policy =
        lifecycle.find((row) => row[0] === 'task-review')?.[1] ?? '';
      if (
        !/\bCap:\s*(?:[1-9]\d*|UNKNOWN)\b/.test(policy) ||
        !/Implementer escalation:\s*[^;\s][^;]*/.test(policy) ||
        !/Cap exit:\s*[^;\s][^;]*/.test(policy)
      )
        errors.push(
          'task-review requires actual finite cap, implementer escalation and cap exit/ruling policy, separately from final-branch review',
        );
      const leaders = witnessedTable(
        lines,
        '## Leading inspection priorities',
        ['Work identity', 'B', 'V', 'S', 'P', 'Chain', 'Next source gate'],
        errors,
      );
      if (
        (rows.length && !leaders.length) ||
        new Set(leaders.map((row) => row[0])).size !== leaders.length ||
        leaders.some((row) => !rows.includes(row[0]))
      )
        errors.push(
          'leading priorities must identify the actual selected inspection leaders with explicit B/V/S/P and source-backed chain/gate',
        );
    }
    if (context.acceptanceSourceClaims?.length) {
      const claims = context.acceptanceSourceClaims;
      const reconciled = witnessedTable(
        lines,
        '## Acceptance-source reconciliation',
        [
          'Claim',
          'Task identities',
          'Historical source statement',
          'Current resolution',
          'Resolution source',
          'Source',
        ],
        errors,
      );
      if (
        reconciled.length !== claims.length ||
        new Set(reconciled.map((row) => row[0])).size !== claims.length ||
        reconciled.some((row) => !claims.some((claim) => claim.id === row[0]))
      )
        errors.push(
          'acceptance reconciliation differs from independent historical source claims',
        );
      const verification = witnessedTable(
        lines,
        '## Acceptance verification queue',
        [
          'Claim',
          'Work identity',
          'Next verification',
          'Current resolution',
          'Source',
        ],
        errors,
      );
      const required = claims.flatMap((claim) =>
        claim.taskIds.map((id) => [claim, id]),
      );
      if (
        verification.length !== required.length ||
        required.some(
          ([claim, id]) =>
            verification.filter((row) => row[0] === claim.id && row[1] === id)
              .length !== 1,
        )
      )
        errors.push(
          'acceptance verification queue must preserve each specifically associated task; it is not an implementation restart',
        );
      const normalized = (value) =>
        value.replaceAll('\\|', '|').replace(/\s+/g, ' ').trim();
      const sourceCitation = (claim, value) => {
        const escaped = claim.sourcePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(
          '(?:^|[<(\\s`])' +
            escaped +
            ':' +
            claim.sourceLine +
            '(?=[>)\\s`,;]|$)',
        ).test(value);
      };
      for (const claim of claims) {
        const resolution = context.acceptanceResolutions?.[claim.id];
        const status = resolution?.status.toUpperCase() ?? 'UNKNOWN';
        const statement = resolution?.text ?? claim.text;
        const account = reconciled.find((row) => row[0] === claim.id);
        if (
          !account ||
          account[1] !== (claim.taskIds.join(', ') || 'UNASSIGNED') ||
          !normalized(account[2]).includes(normalized(claim.text)) ||
          account[3] !== status ||
          !sourceCitation(claim, account[5])
        )
          errors.push(
            'acceptance reconciliation requires the complete historical statement, exact task association, source line and separately source-bound current resolution',
          );
        if (
          account &&
          (resolution
            ? !sourceCitation(resolution, account[4]) ||
              !normalized(account[4]).includes(normalized(resolution.text))
            : account[4] !== 'UNKNOWN')
        )
          errors.push(
            'acceptance reconciliation resolution source must match its actual statement or remain UNKNOWN',
          );
        for (const id of claim.taskIds) {
          const item = observed.find((row) => row[0] === id);
          if (
            !item ||
            !item[3].includes(claim.id) ||
            !normalized(item[3]).includes(normalized(statement))
          )
            errors.push(
              `${id}: acceptance source gate must carry the specifically associated verification statement, not a marker-only appendix`,
            );
          const action = verification.find(
            (row) => row[0] === claim.id && row[1] === id,
          );
          if (
            !action ||
            !normalized(action[2]).includes(normalized(statement)) ||
            action[3] !== status ||
            !sourceCitation(resolution ?? claim, action[4])
          )
            errors.push(
              `${id}: acceptance verification requires actual host/steps/behavior evidence and separately source-bound current resolution`,
            );
        }
      }
    }
  }
  if (!saved) {
    const countPrefix = context.coverage === 'complete' ? 'Total' : 'Observed';
    const count = text.match(
      new RegExp(
        `^${countPrefix} open umbrellas: (\\d+) \\([^\\n]+\\)\\.?$`,
        'm',
      ),
    );
    if (
      lines.filter((line) =>
        /^(?:Total|Observed) open umbrellas:/.test(line.trimStart()),
      ).length !== 1
    )
      errors.push('exactly one unambiguous count statement required');
    if (!count || Number(count[1]) !== rows.length)
      errors.push('count missing or differs from queue');
    if (context.coverage === 'complete') {
      if (
        rows.length !== context.expectedIds.length ||
        rows.some((id) => !context.expectedIds.includes(id))
      )
        errors.push('queue differs from externally reconciled inventory');
    } else if (!count?.[0].includes('completeness UNKNOWN; STOP'))
      errors.push('partial count requires completeness UNKNOWN; STOP');
  } else if (
    rows.length !== context.expectedIds.length ||
    rows.some((id) => !context.expectedIds.includes(id))
  )
    errors.push(
      'saved inspection queue differs from explicitly selected identities',
    );
  const nextActions = [
    ...text.matchAll(
      /(?:First permitted action:|Permitted next action:|Read existing kickoff|Первое разрешённое действие:|Разрешённое следующее действие:|Прочитать существующий kickoff)([^\n]+)/g,
    ),
  ];
  if (
    !nextActions.some(
      (match) =>
        /[\p{L}\p{N}]/u.test(match[1]) &&
        !/^(?:UNKNOWN|STOP|N\/A|unavailable|неизвестно|недоступно)[.!\s]*$/i.test(
          match[1].trim(),
        ),
    )
  )
    errors.push('concrete permitted next action required');
  return { contextErrors, errors };
}

export function validateTerminal(raw, context, report) {
  const errors = [];
  const parsed = outsideFences(raw);
  const htmlVisible = parsed.lines
    .map(outsideInlineCode)
    .map(outsideAngledLinkDestinations)
    .join('\n');
  if (
    /<!--|-->|<\?|<!(?:[A-Za-z]|\[)|<\/?[A-Za-z][A-Za-z0-9-]*(?:\s|\/?>)/.test(
      htmlVisible,
    )
  )
    errors.push('unsupported raw HTML/comment outside fences');
  const expected = witnessedTable(
    outsideFences(report).lines,
    '## Leading inspection priorities',
    ['Work identity', 'B', 'V', 'S', 'P', 'Chain', 'Next source gate'],
    errors,
  );
  const actual = witnessedTable(
    parsed.lines,
    '## Leading inspection priorities',
    ['Work identity', 'B', 'V', 'S', 'P', 'Chain', 'Next source gate'],
    errors,
  );
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    errors.push(
      'terminal must retain every selected leading identity, explicit B/V/S/P and the same operative chain/source gate',
    );
  if (parsed.unclosed) errors.push('terminal has an unclosed fence');
  return errors.map((error) => 'terminal: ' + error);
}

if (isMainEntry(import.meta.url)) {
  try {
    const args = process.argv.slice(2),
      options = new Map();
    const allowed = [
      '--context',
      '--evidence',
      '--terminal',
      '--reconciliation',
      '--review',
    ];
    if (args.length % 2 || args[0] !== '--context')
      throw new Error(
        'Usage: --context <JSON> [--evidence <file>] [--terminal <file>] [--reconciliation <file> --review <file>] < final.md',
      );
    for (let index = 0; index < args.length; index += 2) {
      if (!allowed.includes(args[index]) || options.has(args[index]))
        throw new Error('Unknown or duplicate final-report option');
      options.set(args[index], args[index + 1]);
    }
    const context = JSON.parse(options.get('--context'));
    if (
      [
        'observed-synthesis-v2',
        'observed-synthesis-v3',
        SAVED_WORKFLOW,
      ].includes(context.workflow) &&
      !options.has('--evidence')
    )
      throw new Error(
        'current source-bound workflow requires independent --evidence collector file',
      );
    if (
      ['observed-synthesis-v3', SAVED_WORKFLOW].includes(context.workflow) &&
      !options.has('--terminal')
    )
      throw new Error(
        'current workflow requires the exact planned --terminal artifact',
      );
    const terminal = options.has('--terminal')
      ? readFileSync(options.get('--terminal'), 'utf8')
      : null;
    let evidence, ledger, ledgerBytes, review;
    const verifiedReadFailures = new Map();
    if (options.has('--evidence')) {
      evidence = JSON.parse(readFileSync(options.get('--evidence'), 'utf8'));
      const errors = validateEvidenceContext(context, evidence);
      if (errors.length) throw new Error(errors.join('\n'));
    }
    if (context.workflow === 'observed-synthesis-v3') {
      if (
        context.sourceReconciliationVersion !== 1 ||
        evidence?.sourceReconciliationVersion !== 1
      )
        throw new Error(
          'current source-bound CLI requires source reconciliation version 1; historical grammar is API-only',
        );
      if (!options.has('--reconciliation') || !options.has('--review'))
        throw new Error(
          'current reconciliation requires actual --reconciliation and --review artifacts',
        );
      ledgerBytes = readFileSync(options.get('--reconciliation'));
      ledger = JSON.parse(ledgerBytes.toString('utf8'));
      review = JSON.parse(readFileSync(options.get('--review'), 'utf8'));
      const records = sourceEvidenceRecords(evidence);
      const captured = new Set(
        Object.values(records)
          .flat()
          .filter((source) => typeof source.text === 'string')
          .map((source) => source.path),
      );
      const inventory = new Set(
        Object.values(records)
          .flat()
          .map((source) => source.path),
      );
      // Inventory-only bodies were not captured by the collector. Bind their
      // supplied full read to an actual bounded, nonblocking regular-file read.
      for (const read of ledger.sourceReads ?? []) {
        if (!inventory.has(read.path))
          throw new Error('foreign supplemental source path');
        if (captured.has(read.path)) {
          if (read.status === 'unavailable')
            throw new Error(
              'captured source body is available; retain its historical facts',
            );
          continue;
        }
        const source = Object.values(records)
          .flat()
          .find((item) => item.path === read.path);
        if (source?.origin?.kind === 'git-object') continue;
        const actual = readReconciliationSource(read.path);
        if (read.status === 'unavailable') {
          if (
            actual.status !== 'unavailable' ||
            actual.errorCode !== read.errorCode ||
            actual.diagnostic !== read.diagnostic
          )
            throw new Error(
              'unavailable supplemental read differs from the actual current failure',
            );
          verifiedReadFailures.set(read.path, actual);
        } else if (
          actual.status !== 'read' ||
          actual.sha256 !== read.sha256 ||
          actual.text !== read.text
        ) {
          throw new Error(
            'supplemental source changed or differs from actual read',
          );
        }
      }
    } else if (context.workflow === SAVED_WORKFLOW) {
      if (!options.has('--reconciliation') || !options.has('--review'))
        throw new Error(
          'saved scheme requires actual source-read --reconciliation and --review artifacts',
        );
      ledgerBytes = readFileSync(options.get('--reconciliation'));
      ledger = JSON.parse(ledgerBytes.toString('utf8'));
      review = JSON.parse(readFileSync(options.get('--review'), 'utf8'));
    } else if (options.has('--reconciliation') || options.has('--review')) {
      throw new Error(
        'reconciliation artifacts require the current version binding',
      );
    }
    const selected = spawnSync(
      'bash',
      [fileURLToPath(new URL('./emit-output-strings.sh', import.meta.url))],
      { encoding: 'utf8' },
    );
    if (selected.status !== 0)
      throw new Error(`selected language unavailable: ${selected.stderr}`);
    const tokens = Object.fromEntries(
      selected.stdout
        .trim()
        .split('\n')
        .map((line) => {
          const i = line.indexOf('=');
          return [line.slice(0, i), line.slice(i + 1)];
        }),
    );
    context.tokens = {
      paste: tokens.AIF_PIPELINE_COL_PASTE?.replace(
        'CC tab',
        context.host === 'codex' ? 'Codex chat' : 'CC tab',
      ),
      when: tokens.AIF_PIPELINE_COL_WHEN,
      waiting: tokens.AIF_PIPELINE_COL_WAITING,
      parallel: tokens.AIF_PIPELINE_COL_PARALLEL,
    };
    const rawBytes = readFileSync(0);
    let raw;
    try {
      raw = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
        rawBytes,
      );
    } catch {
      process.stderr.write(
        'pipeline-final-report: REJECT\nreport must be valid UTF-8\n',
      );
      process.exitCode = 1;
    }
    if (raw !== undefined) {
      const result = validateFinalReport(raw, context);
      if (terminal !== null)
        result.errors.push(...validateTerminal(terminal, context, raw));
      if (context.workflow === SAVED_WORKFLOW)
        result.errors.push(
          ...validateSavedReport(raw, evidence, ledger, review, ledgerBytes),
        );
      else if (ledger)
        result.errors.push(
          ...validateSourceReconciliation(
            ledger,
            evidence,
            raw,
            review,
            ledgerBytes,
            verifiedReadFailures,
          ),
        );
      if (result.contextErrors.length)
        throw new Error(result.contextErrors.join('\n'));
      if (result.errors.length) {
        process.stderr.write(
          `pipeline-final-report: REJECT\n${result.errors.join('\n')}\n`,
        );
        process.exitCode = 1;
      } else process.stdout.write(rawBytes);
    }
  } catch (error) {
    process.stderr.write(
      `pipeline-final-report: CONTEXT UNAVAILABLE\n${error.message}\n`,
    );
    process.exitCode = 2;
  }
}
