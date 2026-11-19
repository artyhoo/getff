#!/usr/bin/env node
// Read-only overview composition. Existing priority/frontier helpers own their facts;
// this module separates candidates, evidence, in-flight work and synthetic residue.
import {
  readFileSync,
  existsSync,
  readdirSync,
  realpathSync,
  statSync,
  opendirSync,
  openSync,
  closeSync,
  fstatSync,
  readSync,
  constants,
} from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { isMainEntry } from './lib/is-main-entry.mjs';

const clean = (value) =>
  String(value ?? '')
    .replace(/[|\n\r]/g, ' ')
    .trim();
const matches = (name, value) =>
  new RegExp(
    `(^|[^a-z0-9-])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^a-z0-9]|-(?:s\\d|[0-9a-f]{6}|stage))`,
    'i',
  ).test(value);
export function buildOverview({
  candidateOutput,
  kickoffs = {},
  frontiers = {},
  prs = null,
  branches = null,
  tasks = null,
  diagnostics = [],
  plan = '',
  stageInputs = {},
  mergedPrs = [],
  kickoffPaths = {},
  planPath = '',
  localEvidence = {},
  cachedEvidence = {},
}) {
  const trailer =
    /=== priority-score\.sh: END rc=(\d+) \(lines=\d+\) ===\s*$/.exec(
      candidateOutput,
    );
  if (!trailer)
    throw new Error('Candidate helper incomplete: END trailer missing');
  if (trailer[1] !== '0')
    throw new Error(`Candidate helper failed: rc=${trailer[1]}`);
  diagnostics = [
    ...diagnostics,
    ...candidateOutput
      .split('\n')
      .filter((line) => /^(PROBE-INCOMPLETE|RECONSTRUCT-STUB):/.test(line)),
  ];
  const rows = candidateOutput
    .split('\n')
    .filter(
      (line) =>
        / kickoff=(exists|synthetic)\b/.test(line) &&
        (!/ status=DONE\b/.test(line) || !/ basis=done-md\b/.test(line)),
    );
  const names = new Set(rows.map((line) => line.split(' ')[0]));
  const work = [],
    synthetic = [];
  for (const row of rows) {
    const name = row.split(' ')[0];
    if (/kickoff=synthetic/.test(row)) {
      synthetic.push(row);
      continue;
    }
    // Meta-launch is a dispatch wrapper for the incumbent umbrella, not a second job.
    if (name.endsWith('-meta-launch') && names.has(name.slice(0, -12)))
      continue;
    const source = kickoffs[name] ?? '';
    const title = /^# +(.+)$/m.exec(source)?.[1] ?? name;
    const summary =
      source
        .split('\n')
        .find((line) => /^[A-Za-z]/.test(line) && !/^https?:/.test(line)) ??
      'Read kickoff for scope';
    const frontier = frontiers[name] ?? 'DEGRADE: frontier unavailable';
    const stages = frontier.split('\n').filter((line) => /^STAGE /.test(line));
    const edges = [];
    for (const stage of stages) {
      const id = /^STAGE (\S+)/.exec(stage)?.[1];
      const deps = / deps=(\S+)/.exec(stage)?.[1];
      if (deps && !['-', '?'].includes(deps))
        for (const dep of deps.split(','))
          edges.push(`${name}/${dep} ↓ ${name}/${id}`);
    }
    const activity = [
      ...(prs ?? [])
        .filter((pr) => matches(name, `${pr.headRefName} ${pr.title}`))
        .map((pr) => `PR #${pr.number} ${pr.headRefName}`),
      ...(branches ?? [])
        .filter((branch) => matches(name, branch))
        .map((branch) => `unmerged branch ${branch}`),
      ...(tasks ?? [])
        .filter((task) =>
          matches(
            name,
            `${task.title ?? ''} ${task.branch ?? ''} ${task.branchName ?? ''}`,
          ),
        )
        .map((task) => `factory ${task.id} [${task.status}]`),
    ];
    const planEvidence = plan
      .split('\n')
      .filter((line) => line.includes('`' + name + '`'))
      .map(clean);
    work.push({
      name,
      kickoffPath: kickoffPaths[name] ?? '',
      planPath,
      title: clean(title),
      summary: clean(summary).slice(0, 220),
      availability:
        (prs ?? []).some((pr) =>
          matches(name, `${pr.headRefName} ${pr.title}`),
        ) ||
        (tasks ?? []).some(
          (task) =>
            !['done', 'verified', 'cancelled'].includes(task.status) &&
            matches(
              name,
              `${task.title ?? ''} ${task.branch ?? ''} ${task.branchName ?? ''}`,
            ),
        )
          ? 'IN-FLIGHT'
          : activity.length
            ? 'OWNERSHIP-CHECK'
            : 'UNVERIFIED',
      activity,
      edges,
      stages,
      frontier,
      planEvidence,
      mergedEvidence:
        mergedPrs === null
          ? null
          : mergedPrs.filter((pr) =>
              matches(name, `${pr.headRefName} ${pr.title}`),
            ),
      stageInputs: stageInputs[name] ?? [],
      priority: planEvidence.length
        ? 'Plan evidence; rank requires scoring'
        : 'Unranked; no explicit plan preference',
    });
  }
  // Cached-stage identities remain observations, not certified open or launchable work.
  const stagingOnly = diagnostics.flatMap((message) => {
    const match = /^STAGING-ONLY kickoff: .*\/([^/]+)\/kickoff[^/]*\.md;/.exec(
      message,
    );
    return match ? [match[1]] : [];
  });
  const unresolved = candidateOutput
    .split('\n')
    .filter((line) => /^[\w.-]+ kickoff=missing(?:\s|$)/.test(line));
  const observedIds = [
    ...new Set([
      ...work.map((item) => item.name),
      ...unresolved.map((line) => line.split(' ')[0]),
      ...stagingOnly,
    ]),
  ];
  return {
    workflow: 'observed-synthesis-v3',
    sourceReconciliationVersion: 1,
    work,
    synthetic,
    diagnostics,
    observedIds,
    unresolved,
    localEvidence,
    cachedEvidence,
    sourceBindings: sourcePathBindings(localEvidence, observedIds),
    cachedSourceBindings: sourcePathBindings(cachedEvidence, observedIds),
    acceptanceSourceClaims: acceptanceSourceClaims(
      sourceEvidenceRecords({ localEvidence, cachedEvidence, observedIds }),
      observedIds,
    ),
  };
}

// Local files and cached Git objects retain distinct origins/bindings. This
// union is only for source read accounting, never filesystem ownership claims.
export function sourceEvidenceRecords(evidence) {
  return Object.fromEntries(
    evidence.observedIds.map((id) => [
      id,
      ['localEvidence', 'cachedEvidence'].flatMap((channel) => {
        const rows =
          evidence[channel] && Object.hasOwn(evidence[channel], id)
            ? evidence[channel][id]
            : [];
        if (!Array.isArray(rows))
          throw new Error(
            `Invalid ${channel === 'localEvidence' ? 'local' : 'cached'} evidence rows for ${id}`,
          );
        return rows;
      }),
    ]),
  );
}

// These are retained historical source statements, never inferred current status.
// A task/PR table can associate a statement with a specific observed task; mere
// family membership cannot assign the same acceptance debt to every sibling.
export function acceptanceSourceClaims(localEvidence, observedIds) {
  const bodies = new Map();
  const remember = (body) => {
    const previous = bodies.get(body.path);
    if (
      previous &&
      (previous.owner !== body.owner ||
        previous.sha256 !== body.sha256 ||
        previous.text !== body.text)
    )
      throw new Error(`Conflicting acceptance source body: ${body.path}`);
    bodies.set(body.path, body);
  };
  for (const rows of Object.values(localEvidence)) {
    if (!Array.isArray(rows)) throw new Error('Invalid acceptance source rows');
    for (const row of rows) {
      if (typeof row.text === 'string') remember(row);
    }
  }
  for (const rows of Object.values(localEvidence))
    for (const row of rows) {
      if (row.kind !== 'body-reference') continue;
      const original =
        Object.hasOwn(localEvidence, row.bodyEvidenceId) &&
        localEvidence[row.bodyEvidenceId].find(
          (source) =>
            source.path === row.path &&
            source.owner === row.owner &&
            typeof source.text === 'string' &&
            source.sha256 === row.sha256,
        );
      if (!original)
        throw new Error(`Acceptance source reference unavailable: ${row.path}`);
      remember(original);
    }
  const claims = [];
  for (const body of bodies.values()) {
    if (!body.text.includes('HOST-DEFERRED')) continue;
    if (
      typeof body.path !== 'string' ||
      /[\r\n|]/.test(body.path) ||
      typeof body.owner !== 'string' ||
      !/^[\w.-]+$/.test(body.owner) ||
      createHash('sha256').update(body.text).digest('hex') !== body.sha256
    )
      throw new Error('Invalid acceptance source body identity');
    const lines = body.text.split(/\r?\n/);
    const tasksByPr = new Map();
    let taskColumn = -1,
      prColumn = -1,
      hasTaskTable = false;
    for (const line of lines) {
      if (!/^\|.*\|\s*$/.test(line)) {
        taskColumn = -1;
        prColumn = -1;
        continue;
      }
      const cells = line
        .trim()
        .slice(1, -1)
        .split(/(?<!\\)\|/)
        .map((value) => value.trim().replaceAll('\\|', '|'));
      const taskHeader = cells.findIndex((value) => /^task$/i.test(value));
      const prHeader = cells.findIndex((value) => /^PR$/i.test(value));
      if (taskHeader >= 0 && prHeader >= 0) {
        taskColumn = taskHeader;
        prColumn = prHeader;
        hasTaskTable = true;
        continue;
      }
      if (
        taskColumn < 0 ||
        prColumn < 0 ||
        !/^[\w.-]+$/.test(cells[taskColumn] ?? '')
      )
        continue;
      const task = cells[taskColumn];
      const id =
        task === body.owner || task.startsWith(body.owner + '-')
          ? task
          : body.owner + '-' + task;
      if (!observedIds.includes(id)) continue;
      for (const match of (cells[prColumn] ?? '').matchAll(/#(\d+)\b/g)) {
        const known = tasksByPr.get(match[1]) ?? new Set();
        known.add(id);
        tasksByPr.set(match[1], known);
      }
    }
    lines.forEach((text, index) => {
      if (!text.includes('HOST-DEFERRED')) return;
      const prNumbers = [
        ...new Set([...text.matchAll(/#(\d+)\b/g)].map((match) => match[1])),
      ];
      const taskIds = [
        ...new Set(prNumbers.flatMap((pr) => [...(tasksByPr.get(pr) ?? [])])),
      ];
      if (!hasTaskTable && observedIds.includes(body.owner))
        taskIds.push(body.owner);
      claims.push({
        id: createHash('sha256')
          .update(`${body.path}\0${body.sha256}\0${index + 1}`)
          .digest('hex')
          .slice(0, 16),
        sourcePath: body.path,
        sourceSha256: body.sha256,
        sourceLine: index + 1,
        owner: body.owner,
        marker: 'HOST-DEFERRED',
        prNumbers,
        taskIds,
        text,
        currentResolution: 'UNKNOWN',
      });
    });
  }
  return claims;
}

// Binds source navigation, not the meaning or truth of statements in a source.
// Empty bindings expose missing local evidence; cached/live evidence remains a
// separately attributed source rather than an invented local entry.
export function sourcePathBindings(localEvidence, observedIds) {
  const bindings = Object.create(null);
  for (const name of observedIds) {
    const supplied = Object.hasOwn(localEvidence, name)
      ? localEvidence[name]
      : [];
    if (!Array.isArray(supplied))
      throw new Error(`Invalid local evidence rows for ${name}`);
    const rows = supplied.filter(
      (row) =>
        typeof row.owner === 'string' &&
        typeof row.path === 'string' &&
        (row.owner === name || name.startsWith(row.owner + '-')),
    );
    const owner = rows
      .map((row) => row.owner)
      .sort((a, b) => b.length - a.length || a.localeCompare(b))[0];
    bindings[name] = [
      ...new Set(
        rows.filter((row) => row.owner === owner).map((row) => row.path),
      ),
    ];
  }
  return bindings;
}
export function renderOverview({
  work,
  synthetic,
  diagnostics,
  observedIds = work.map((item) => item.name),
  unresolved = [],
  localEvidence = {},
}) {
  const lines = [
    '# Pipeline overview',
    '',
    `Kickoff candidates (closure evidence may be incomplete): ${work.length}. Synthetic follow-ups: ${synthetic.length}.`,
    '',
    `Observed identity witness (local/cached evidence only, not global open coverage): ${JSON.stringify(observedIds)}`,
    '',
    'This evidence feed is not a dispatch authorization. Rank by the four planning axes after reading each kickoff. IN-FLIGHT is excluded from new dispatch; OWNERSHIP-CHECK includes old unmerged branches and finished tasks and needs reconciliation; UNVERIFIED needs full dispatcher probes.',
    '',
    '## Dependency graph',
    '',
    'Edges below come from stage Depends on cells. Done markers remain unverified until the live merge gate. Priority order creates no edge. Cross-umbrella prose and external prerequisites require reading the cited kickoff.',
    '',
  ];
  for (const item of work) {
    lines.push(
      `### Stage — ${item.name}`,
      `Scope: ${item.title}. ${item.summary}`,
      `Read-only navigation: ${[item.kickoffPath && `[Read kickoff](<${item.kickoffPath}>)`, item.planPath && `[Read plan](<${item.planPath}>)`].filter(Boolean).join('; ') || 'source path unavailable; inspect the owning project before dispatch'}`,
      `State: ${item.availability}; ${item.activity.join('; ') || 'no matched host evidence; factory/container/session ownership still requires verification'}.`,
      ...item.edges.map((edge) => `- ${edge}`),
      `Merged scope to reconcile: ${item.mergedEvidence === null ? 'UNKNOWN: merged PR query unavailable' : item.mergedEvidence.map((pr) => `#${pr.number} ${pr.title}`).join('; ') || 'no matching merged PR in bounded query'}`,
      `Stage input inventory: ${item.stageInputs.map((input) => `${input.path} (${input.title})`).join('; ') || 'none'}`,
      `Frontier evidence: ${
        clean(
          item.frontier
            .split('\n')
            .filter((line) =>
              /^(FRONTIER|BLOCKED|ATTN|DEGRADE|WARN|RESIDUE|UNRESOLVED|STAGE .*done=yes)/.test(
                line,
              ),
            )
            .join('; '),
        ) || 'unknown'
      }`,
      '',
    );
  }
  lines.push(
    '## Action queue',
    '',
    '| Work | Description | Priority evidence | Waiting on / status | Can parallel with | Paste into a supported host chat |',
    '|---|---|---|---|---|---|',
  );
  for (const item of work)
    lines.push(
      `| ${item.name} | ${item.title} | ${item.priority} | ${item.availability} | Parallel safety unknown; inspect mutual declarations and shared files | Codex: $pipeline ${item.name}; Claude Code: /pipeline ${item.name} |`,
    );
  lines.push(
    '',
    '## Unresolved observed inputs',
    '',
    ...unresolved.map(
      (row) =>
        `- ${clean(row)}; missing contract, readiness UNKNOWN; inspect the source before ranking or dispatch`,
    ),
    '',
    '## Local source evidence',
    '',
    'These are historical local claims or source inventories, not live closure, current merge or readiness proof. Read applicable entry and shared-family sources; retain explicit deferred acceptance separately from historical completion.',
    '',
    ...Object.entries(localEvidence).flatMap(([name, sources]) =>
      sources.map(
        (source) =>
          `- ${name}: ${source.scope} ${source.owner}; ${source.path}; ${source.kind}; ${source.sha256 ?? 'body not collected'}${
            source.text
              ? `\n${source.text
                  .split('\n')
                  .map((line, index) => `  ${index + 1}: ${line}`)
                  .join('\n')}`
              : source.bodyEvidenceId
                ? `; same source body retained under ${source.bodyEvidenceId}`
                : '; inspect this source before deciding scope is unknown'
          }`,
      ),
    ),
    '',
    '## Synthetic follow-ups',
    '',
    ...synthetic.map((row) => `- ${clean(row)}`),
    '',
    '## Probe limits',
    '',
    ...diagnostics.map((d) => `- ${clean(d)}`),
  );
  return lines.join('\n') + '\n';
}

// Bounded local artifact collection complements kickoff/frontier evidence. It never
// interprets a DONE or MERGED claim as live acceptance, and never changes the witness.
export function collectLocalEvidence(home, observedIds, diagnostics = []) {
  if (observedIds.length > 4096)
    throw new Error('Local evidence identity budget exceeded');
  if (
    observedIds.some(
      (name) =>
        typeof name !== 'string' ||
        !/^[\w.-]+$/.test(name) ||
        ['.', '..'].includes(name),
    )
  )
    throw new Error('Invalid local evidence identity');
  let remainingEntries = 8192;
  let remainingRows = 4096;
  let remaining = 2 * 1024 * 1024;
  const cache = new Map();
  const emittedBodies = new Map();
  function entries(directory) {
    const rows = [];
    let handle;
    try {
      handle = opendirSync(directory);
      while (remainingEntries > 0) {
        const entry = handle.readSync();
        if (entry === null)
          return rows.sort((a, b) => a.name.localeCompare(b.name));
        remainingEntries--;
        rows.push(entry);
      }
      diagnostics.push(
        `LOCAL-EVIDENCE-INCOMPLETE: ${directory}; directory scan budget exhausted; inspect source separately`,
      );
    } catch (error) {
      diagnostics.push(
        `LOCAL-EVIDENCE-INCOMPLETE: ${directory}; ${clean(error.message)}`,
      );
    } finally {
      if (handle) handle.closeSync();
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }
  const owners = entries(home)
    .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
    .map((entry) => entry.name)
    .filter((name) => /^[\w.-]+$/.test(name));
  function sources(owner) {
    if (cache.has(owner)) return cache.get(owner);
    const directory = join(home, owner);
    const rows = [];
    try {
      if (!statSync(directory).isDirectory()) return [];
      for (const entry of entries(directory).filter((entry) =>
        /\.md$/i.test(entry.name),
      )) {
        const path = join(directory, entry.name);
        const row = { path, owner, kind: 'inventory-only', text: null };
        rows.push(row);
        let descriptor;
        try {
          // Nonblocking open plus descriptor type check also protects against a
          // path becoming a named pipe between inspection and opening.
          if (!statSync(path).isFile()) throw new Error('not a regular file');
          if (
            !/^(?:done|state|status|readme|handoff|report|final[-_]report)(?:[-_].*)?\.md$/i.test(
              entry.name,
            )
          )
            continue;
          descriptor = openSync(
            path,
            constants.O_RDONLY | constants.O_NONBLOCK,
          );
          const stat = fstatSync(descriptor);
          if (!stat.isFile()) throw new Error('not a regular file');
          const limit = Math.min(128 * 1024, remaining);
          if (stat.size > limit)
            throw new Error(
              'body exceeds bounded collection budget; inspect source separately',
            );
          const buffer = Buffer.alloc(limit + 1);
          let length = 0;
          while (length < buffer.length) {
            const read = readSync(
              descriptor,
              buffer,
              length,
              buffer.length - length,
              null,
            );
            if (!read) break;
            length += read;
          }
          if (length > limit)
            throw new Error(
              'body changed beyond bounded collection budget; inspect source separately',
            );
          const bytes = buffer.subarray(0, length);
          remaining -= length;
          row.realPath = realpathSync(path);
          row.bytes = length;
          row.mode = (stat.mode & 0o777).toString(8);
          row.kind = 'local-source-claim';
          row.sha256 = createHash('sha256').update(bytes).digest('hex');
          row.text = bytes.toString('utf8');
        } catch (error) {
          row.error = clean(error.message);
          diagnostics.push(`LOCAL-EVIDENCE-INCOMPLETE: ${path}; ${row.error}`);
        } finally {
          if (descriptor !== undefined) closeSync(descriptor);
        }
      }
    } catch (error) {
      diagnostics.push(
        `LOCAL-EVIDENCE-INCOMPLETE: ${directory}; ${clean(error.message)}`,
      );
    }
    cache.set(owner, rows);
    return rows;
  }
  const result = Object.create(null);
  for (const name of observedIds) {
    result[name] = [];
    // Specific task sources precede broad family sources, including when a
    // meta-launch identity names an existing task directory by prefix. This is
    // navigation precedence only: shared-family claims retain their scope and
    // never become this identity's status merely by appearing first.
    const matchedOwners = owners
      .filter((owner) => owner === name || name.startsWith(owner + '-'))
      .sort((a, b) => b.length - a.length || a.localeCompare(b));
    for (const owner of matchedOwners) {
      const rows = sources(owner);
      if (rows.length > remainingRows)
        diagnostics.push(
          `LOCAL-EVIDENCE-INCOMPLETE: ${name}; output inventory budget exhausted; inspect ${join(home, owner)} separately`,
        );
      for (const row of rows.slice(0, remainingRows)) {
        const evidence = {
          ...row,
          scope: owner === name ? 'entry' : 'shared-family',
        };
        if (row.text !== null) {
          if (emittedBodies.has(row.path)) {
            evidence.text = null;
            evidence.kind = 'body-reference';
            evidence.bodyEvidenceId = emittedBodies.get(row.path);
          } else emittedBodies.set(row.path, name);
        }
        result[name].push(evidence);
        remainingRows--;
      }
    }
  }
  return result;
}

// Cached objects remain historical observations, never live merge/launch proof.
export function collectCachedSourceEvidence(
  root,
  observedIds,
  commitOid,
  diagnostics,
  { maxBodyBytes = 2 * 1024 * 1024, maxTotalBytes = 8 * 1024 * 1024 } = {},
) {
  const result = Object.fromEntries(observedIds.map((id) => [id, []]));
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(commitOid ?? '')) return result;
  const run = (args) => {
    const output = spawnSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      timeout: 5000,
      maxBuffer: maxBodyBytes + 4096,
    });
    if (output.status !== 0 || output.error) {
      const error = `git ${args.join(' ')} unavailable: ${clean(output.error?.message ?? output.stderr)}`;
      diagnostics.push(error);
      return { error };
    }
    return { text: output.stdout };
  };
  const projectPrefix = run(['rev-parse', '--show-prefix']);
  if (projectPrefix.error) return result;
  const prefix = projectPrefix.text.replace(/\r?\n$/, '');
  const tree = run([
    'ls-tree',
    '-r',
    '-z',
    '--full-tree',
    commitOid,
    '--',
    prefix + '.claude/orchestrator-prompts',
    prefix + '.ai-factory/orchestrator-prompts',
  ]);
  if (tree.error) return result;
  let remaining = maxTotalBytes;
  for (const record of tree.text.split('\0')) {
    const match = /^(100644|100755) blob ([a-f0-9]+)\t(.+)$/.exec(record);
    if (!match || !/\.md$/i.test(match[3])) continue;
    const [, mode, blobOid, repoPath] = match;
    const owner =
      /^(?:\.claude|\.ai-factory)\/orchestrator-prompts\/([\w.-]+)\/.+\.md$/i.exec(
        repoPath.slice(prefix.length),
      )?.[1];
    if (!owner) continue;
    const associated = observedIds.filter(
      (id) => id === owner || id.startsWith(owner + '-'),
    );
    if (!associated.length) continue;
    const path = `git:${commitOid}:${repoPath}`;
    const source = {
      path,
      owner,
      kind: 'git-source-claim',
      text: null,
      mode,
      origin: {
        kind: 'git-object',
        ref: 'origin/staging',
        commitOid,
        blobOid,
        repoPath,
        boundProjectPrefix: prefix,
      },
    };
    const size = run(['cat-file', '-s', blobOid]);
    const bytes = Number(size.text?.trim());
    if (size.error) source.error = size.error;
    else if (
      !Number.isSafeInteger(bytes) ||
      bytes < 0 ||
      bytes > maxBodyBytes ||
      bytes > remaining
    )
      source.error = `cached source body exceeds bounded read budget: ${path}`;
    else {
      const body = run(['cat-file', 'blob', blobOid]);
      if (body.error) source.error = body.error;
      else {
        const buffer = Buffer.from(body.text, 'utf8');
        const objectOid = createHash(blobOid.length === 64 ? 'sha256' : 'sha1')
          .update(Buffer.from(`blob ${buffer.length}\0`))
          .update(buffer)
          .digest('hex');
        if (buffer.length !== bytes || objectOid !== blobOid)
          source.error = `cached source bytes differ from recorded Git blob: ${path}`;
        else {
          source.text = body.text;
          source.bytes = bytes;
          source.sha256 = createHash('sha256').update(buffer).digest('hex');
          remaining -= bytes;
        }
      }
    }
    if (source.error) {
      source.kind = 'git-source-unavailable';
      diagnostics.push(source.error);
    }
    for (const id of associated)
      result[id].push({
        ...source,
        scope: id === owner ? 'entry' : 'shared-family',
      });
  }
  return result;
}

export function collect(
  root,
  candidatePath,
  { bridgeUrl = 'http://localhost:3009' } = {},
) {
  const helpers = dirname(fileURLToPath(import.meta.url));
  const diagnostics = [];
  function run(command, args) {
    const result = spawnSync(command, args, {
      cwd: root,
      encoding: 'utf8',
      timeout: 60000,
      maxBuffer: 64 * 1024 * 1024,
    });
    if (result.status !== 0) {
      diagnostics.push(
        `${command} ${args.join(' ')} unavailable: ${clean(result.error?.message ?? result.stderr).slice(0, 200)}`,
      );
      return null;
    }
    return result.stdout;
  }
  function json(command, args) {
    const out = run(command, args);
    if (out === null) return null;
    try {
      const parsed = JSON.parse(out);
      if (!Array.isArray(parsed)) throw new Error('expected array');
      return parsed;
    } catch {
      diagnostics.push(`${command}: invalid response; status unknown`);
      return null;
    }
  }
  const candidateOutput = readFileSync(
    candidatePath === '-' ? 0 : candidatePath,
    'utf8',
  );
  const home = run('bash', [join(helpers, 'print-orch-home.sh')])?.trim();
  if (!home) throw new Error('Orchestration home unavailable');
  const prs = json('gh', [
    'pr',
    'list',
    '--state',
    'open',
    '--json',
    'number,title,headRefName',
    '--limit',
    '500',
  ]);
  if (prs?.length === 500)
    diagnostics.push('PR query limit reached; population may be incomplete');
  const mergedPrs = json('gh', [
    'pr',
    'list',
    '--state',
    'merged',
    '--json',
    'number,title,headRefName,mergedAt',
    '--limit',
    '500',
  ]);
  if (mergedPrs?.length === 500)
    diagnostics.push(
      'Merged PR query limit reached; absence of a match is not proof of unfinished work',
    );
  const branchOutput = run('git', [
    'branch',
    '-a',
    '--no-merged',
    'origin/staging',
  ]);
  const branches =
    branchOutput
      ?.split('\n')
      .map((s) => s.replace(/^[* +]+/, '').trim())
      .filter((s) => s && !s.includes('->')) ?? null;
  // Reuse the installer's exact root binding. A preserved/custom project ID or
  // a container path does not independently identify this host checkout.
  const deadline = Date.now() + 8000;
  let remainingBytes = 2 * 1024 * 1024;
  const endpoint = bridgeUrl.replace(/\/+$/, '');
  function factoryJson(path) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('collection deadline reached');
    if (remainingBytes <= 0)
      throw new Error('collection byte budget exhausted');
    const result = spawnSync(
      'curl',
      [
        '--fail',
        '--silent',
        '--show-error',
        '--connect-timeout',
        '3',
        '--max-time',
        String(remaining / 1000),
        '--max-filesize',
        String(remainingBytes),
        endpoint + path,
      ],
      {
        cwd: root,
        encoding: 'utf8',
        timeout: remaining,
        maxBuffer: remainingBytes,
      },
    );
    remainingBytes -= Buffer.byteLength(result.stdout ?? '', 'utf8');
    if (result.status !== 0) throw new Error('bounded factory request failed');
    try {
      return JSON.parse(result.stdout);
    } catch {
      throw new Error('invalid factory response');
    }
  }
  let tasks = null;
  try {
    const projects = factoryJson('/projects');
    if (!Array.isArray(projects))
      throw new Error('project list is not an array');
    const roots = new Set([
      root.replace(/\/+$/, ''),
      realpathSync(root).replace(/\/+$/, ''),
    ]);
    const bound = projects.filter(
      (p) =>
        p &&
        typeof p.rootPath === 'string' &&
        roots.has(p.rootPath.replace(/\/+$/, '')),
    );
    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    // AIF shared TaskStatus contract (deployment/schema mismatches stay UNKNOWN).
    const statuses = new Set([
      'backlog',
      'planning',
      'improve',
      'plan_ready',
      'implementing',
      'review',
      'verify',
      'blocked_external',
      'done',
      'verified',
    ]);
    if (
      bound.length !== 1 ||
      typeof bound[0].id !== 'string' ||
      !uuid.test(bound[0].id)
    )
      throw new Error(
        'exact project binding missing, ambiguous or invalid; container mapping requires verification',
      );
    const projectId = bound[0].id;
    const list = factoryJson(
      '/tasks?projectId=' + encodeURIComponent(projectId),
    );
    if (!Array.isArray(list) || list.length > 20)
      throw new Error(
        'task population invalid or exceeds bounded detail budget',
      );
    const details = [];
    for (const item of list) {
      if (
        !item ||
        typeof item.id !== 'string' ||
        !uuid.test(item.id) ||
        item.projectId !== projectId ||
        !statuses.has(item.status)
      )
        throw new Error('task list contains invalid or foreign ownership');
      // Project-filtered TaskListItem omits branchName/worktreePath. Fetch full
      // rows within one shared deadline; never infer absence from light items.
      const detail = factoryJson('/tasks/' + encodeURIComponent(item.id));
      if (
        !detail ||
        detail.id !== item.id ||
        detail.projectId !== projectId ||
        typeof detail.title !== 'string' ||
        !statuses.has(detail.status) ||
        !Object.hasOwn(detail, 'branchName') ||
        !(detail.branchName === null || typeof detail.branchName === 'string')
      )
        throw new Error('task detail invalid, incomplete or foreign');
      details.push(detail);
    }
    tasks = details;
  } catch (error) {
    diagnostics.push('Factory ownership UNKNOWN: ' + error.message);
  }
  diagnostics.push(
    'Factory evidence requires exact host-root binding; container mappings, active chats and unharvested work still need dispatcher verification before dispatch.',
  );
  const kickoffNames = candidateOutput
    .split('\n')
    .filter(
      (line) =>
        / kickoff=exists\b/.test(line) &&
        (!/ status=DONE\b/.test(line) || !/ basis=done-md\b/.test(line)),
    )
    .map((line) => line.split(' ')[0]);
  const kickoffs = {},
    kickoffPaths = {},
    frontiers = {},
    stageInputs = {};
  for (const name of kickoffNames) {
    const path = join(home, name, 'kickoff.md');
    if (existsSync(path)) {
      kickoffs[name] = readFileSync(path, 'utf8');
      kickoffPaths[name] = path;
    } else diagnostics.push(`MISSING kickoff: ${path}`);
    stageInputs[name] = existsSync(dirname(path))
      ? readdirSync(dirname(path))
          .filter((file) => /^kickoff.+\.md$/.test(file))
          .map((file) => {
            const input = join(dirname(path), file);
            const text = readFileSync(input, 'utf8');
            return {
              path: input,
              title: /^# +(.+)$/m.exec(text)?.[1] ?? file,
              dependencies: text
                .split('\n')
                .map((line, index) => ({ line: index + 1, text: line }))
                .filter((row) =>
                  /Depends on|Prerequisite|actual staging merge|No parallel|Sequential frontier/i.test(
                    row.text,
                  ),
                ),
            };
          })
      : [];
    frontiers[name] =
      run('bash', [join(helpers, 'frontier.sh'), name]) ??
      'DEGRADE: frontier probe failed';
  }
  // Check tracked staging population independently of the local glob. Do not silently
  // inspect a stale checkout or write shared coordination files to make it look current.
  const cachedCommitOid = run('git', [
    'rev-parse',
    '--verify',
    'origin/staging^{commit}',
  ])?.trim();
  const tracked = run('git', [
    'ls-tree',
    '-r',
    '--name-only',
    cachedCommitOid || 'origin/staging',
    '.claude/orchestrator-prompts',
    '.ai-factory/orchestrator-prompts',
  ]);
  for (const path of tracked?.split('\n') ?? [])
    if (/\/kickoff[^/]*\.md$/.test(path) && !existsSync(join(root, path)))
      diagnostics.push(
        `STAGING-ONLY kickoff: ${path}; inspect git show origin/staging:${path} before completing overview`,
      );
  const expectedPlanPath = run('bash', [
    join(helpers, 'print-plan-path.sh'),
  ])?.trim();
  const planPath =
    expectedPlanPath && existsSync(expectedPlanPath) ? expectedPlanPath : '';
  if (expectedPlanPath && !planPath)
    diagnostics.push('MISSING plan: ' + expectedPlanPath);
  const plan = planPath ? readFileSync(planPath, 'utf8') : '';
  const observations = buildOverview({
    candidateOutput,
    diagnostics,
  }).observedIds;
  const localEvidence = collectLocalEvidence(home, observations, diagnostics);
  const cachedEvidence = collectCachedSourceEvidence(
    root,
    observations,
    cachedCommitOid,
    diagnostics,
  );
  return buildOverview({
    localEvidence,
    cachedEvidence,
    candidateOutput,
    kickoffs,
    frontiers,
    prs,
    branches,
    tasks,
    diagnostics,
    plan,
    stageInputs,
    mergedPrs,
    kickoffPaths,
    planPath,
  });
}
if (isMainEntry(import.meta.url)) {
  const argv = process.argv.slice(2);
  const [root, candidatePath] = argv;
  const bridgeAt = argv.indexOf('--bridge-url');
  if (!root || !candidatePath) {
    console.error(
      'Usage: overview.mjs <repository-root> <completed-candidate-output|-> [--json] [--bridge-url URL]',
    );
    process.exitCode = 2;
  } else {
    try {
      if (bridgeAt !== -1 && !argv[bridgeAt + 1])
        throw new Error('--bridge-url requires a URL');
      const result = collect(
        resolve(root),
        candidatePath === '-' ? '-' : resolve(candidatePath),
        { bridgeUrl: bridgeAt === -1 ? undefined : argv[bridgeAt + 1] },
      );
      console.log(
        argv.includes('--json')
          ? JSON.stringify(result, null, 2)
          : renderOverview(result),
      );
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
