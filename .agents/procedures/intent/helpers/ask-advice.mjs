#!/usr/bin/env node
/**
 * ask-advice.mjs — adopted-work ask routing + return-edge validation for the intent-
 * continuity feature family (agreed design §5; kickoff
 * `.claude/orchestrator-prompts/intent-continuity/kickoff-b1.md` §2 items 2-4; canonical
 * home `.agents/procedures/intent/helpers/`, beside the A1 selector it reuses).
 *
 * An ADOPTED ask (frontmatter `continuity: <feature-id>`; the incumbent validator
 * scripts/check-ask-files.sh validates SHAPE, this helper the SEMANTIC half) binds its
 * document-bound responsibility directly — the current `asker-role` names the sender and
 * is never repurposed as the recipient:
 *
 *   target: task | architecture | intent       recipient responsibility
 *   primary-doc / primary-doc-sha256           the target's exact primary document
 *   decision-ids, return-to, proposed-effect   recorded decisions, owner-led return,
 *                                              what applying the advice would change
 *
 * Verbs (exit 0 ok / 2 hold-or-reject; one JSON line on stdout):
 *   --route --ask <askfile>
 *       Validates the binding against CURRENT authority: intent -> the selector's
 *       currentPrd snapshot; architecture -> the selector's currentSpec; task -> the
 *       ask-bound kickoff/plan cross-checked against a freshly fetched task-state JSON.
 *       Direct, per-class:
 *       one ask, one authority, any order — no relay, no registry, no scheduler. Missing,
 *       stale or foreign authority HOLDS (exit 2, one hold code): a superseded-but-
 *       internally-consistent PRD can never route as current.
 *   --validate-return --ask <askfile>
 *       The return edge. The answered adopted ask's advice may be APPLIED only after:
 *       the addressed target still routes, the Answer echoes the target, an unresolved
 *       remainder is named (value may be 'none'), the decisions-entry exists under the
 *       owner roots with an exact anchored entry binding the ask, feature, decision IDs,
 *       verdict and return address (legacy asks keep the shape-only rule). Return-to must
 *       name the asker's role AND this ask file — another task cannot receive the answer.
 *       The output carries the decision
 *       basis digest; GRANTING EFFECT stays with the owning transition (an answer is
 *       advice until the owning path validates its use — design §5). It never returns a
 *       plan/execution verdict.
 *   --restore --target <t> --feature <id> --ask <file> --scope <file> [--decisions <path>]
 *       [--doc <path> --doc-sha256 <hex>]      (doc flags required for target=task)
 *       Cold recovery (AC4): reconstructs the responsibility's inputs from the primary
 *       artifact + recorded decisions + THE unresolved ask, no session handle. The ask is
 *       REQUIRED and must match the selected feature/target/authority/owner (an absent or
 *       mismatched ask never restores); the scope statement must name one permitted AND one
 *       forbidden interpretation, each bound to the resolved primary document; the recorded
 *       decision basis (--decisions) is required when the ask declares decision IDs; an
 *       initial `decision-ids: none` ask has no prior decision to invent. Each declared
 *       ID must resolve to a current, same-feature `## <ID>` decision entry. Missing declared
 *       evidence stays UNRESOLVED, never a reconstructed agreement. The permitted-
 *       vs-forbidden SEMANTICS belong to the restored advisor; the output says so.
 *
 * Reuse (build-vs-reuse, SSOT #201/#253/#64): the selector read and live-validation
 * halves are imported from current-decisions.mjs (additive exports, no CLI change); the
 * content-ref resolver + canonical JSON come from check-result-review.mjs. No new
 * registry, scheduler, advisor store or transport — the incumbent ask file + mailbox stay
 * the transport; scripts/advisor-bridge-beta/ stays a pilot.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveContentRef } from './check-result-review.mjs';
import {
  repoIdentityOf,
  requireSelectorFeature,
  liveValidateCurrentPrd,
  liveValidateCurrentSpec,
} from './current-decisions.mjs';

const TARGETS = ['task', 'architecture', 'intent'];
const SHA256_RE = /^[0-9a-f]{64}$/;

const ok = (value) => ({ ok: true, ...value });
const reject = (code, reason) => ({ ok: false, code, reason });
const sha256Of = (bytes) => createHash('sha256').update(bytes).digest('hex');

function isHex64(v) {
  return typeof v === 'string' && SHA256_RE.test(v);
}

// ---------------------------------------------------------------------------
// Ask-file parsing: flat frontmatter + exact-line H2 sections (the same shape the bash
// gate judges; the schema reference lives there, not here).
// ---------------------------------------------------------------------------
function parseAsk(text) {
  const lines = text.split('\n');
  if ((lines[0] ?? '').trim() !== '---') {
    return reject(
      'ask_unreadable',
      'the ask file does not open with a `---` frontmatter line',
    );
  }
  const fm = {};
  let i = 1;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '---') {
      i += 1;
      break;
    }
    const pos = line.indexOf(':');
    if (pos > 0) fm[line.slice(0, pos).trim()] = line.slice(pos + 1).trim();
    i += 1;
  }
  const sections = {};
  let current = null;
  while (i < lines.length) {
    const line = lines[i];
    if (/^## /.test(line)) {
      current = line;
      sections[current] = [];
    } else if (current !== null) {
      sections[current].push(line);
    }
    i += 1;
  }
  return ok({ fm, sections });
}

/** Leading token of a body key line (the pointer half; trailing prose is the advisor's). */
function bodyKeyToken(bodyLines, key) {
  const re = new RegExp('^' + key + ':\\s*(\\S.*)$');
  const line = bodyLines.find((l) => re.test(l));
  if (!line) return null;
  return line.match(re)[1].trim();
}

/** Leading path token of a pointer-style value: first whitespace token, anchor stripped. */
function pointerToken(value) {
  return value.split(/\s+/)[0].split('#')[0];
}

function decisionIds(value) {
  return String(value ?? '')
    .split(/[\s,]+/)
    .filter((id) => id && id !== 'none');
}

function returnAddress(fm, askPath) {
  return `${fm['asker-role']}:${basename(askPath)}`;
}

function journalEntry(text, anchor) {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line.trim() === `## ${anchor}`);
  if (start < 0) return null;
  const end = lines.findIndex(
    (line, index) => index > start && /^## /.test(line),
  );
  return lines
    .slice(start + 1, end < 0 ? undefined : end)
    .map((line) => line.trim())
    .filter(Boolean);
}

function entryField(lines, key) {
  return (
    lines.find((line) => line.startsWith(`${key}: `))?.slice(key.length + 2) ??
    null
  );
}

function currentDecisionEntry(text, id, featureId) {
  const entry = journalEntry(text, id);
  return (
    entry !== null &&
    entryField(entry, 'feature') === featureId &&
    entryField(entry, 'status') === 'current' &&
    Boolean(entryField(entry, 'decision'))
  );
}

// ---------------------------------------------------------------------------
// Existence + digest of a repo-relative path under the owner roots (realpath-contained,
// same containment rules as the shared resolver).
// ---------------------------------------------------------------------------
function resolveWithinRoots(relPath, roots) {
  for (const root of Array.isArray(roots) ? roots : []) {
    let realRoot;
    try {
      realRoot = realpathSync(root);
    } catch {
      continue;
    }
    const abs = isAbsolute(relPath) ? relPath : resolve(root, relPath);
    let intended;
    try {
      intended = join(realpathSync(dirname(abs)), basename(abs));
    } catch {
      continue;
    }
    if (intended !== realRoot && !intended.startsWith(realRoot + '/')) continue;
    if (!existsSync(intended) || !statSync(intended).isFile()) continue;
    const real = realpathSync(intended);
    if (real !== realRoot && !real.startsWith(realRoot + '/')) continue;
    const bytes = readFileSync(real);
    return { ok: true, bytes, sha256: sha256Of(bytes) };
  }
  return {
    ok: false,
    reason:
      relPath + ' does not resolve to a file under the configured owner roots',
  };
}

// ---------------------------------------------------------------------------
// Authority resolution per target (design §4): each responsibility answers from its own
// primary document; the selector is the only authority for intent/architecture. Task
// document bytes must also match independently fetched task state at the application edge.
// ---------------------------------------------------------------------------
function resolveAuthorityDoc(
  target,
  entry,
  roots,
  docPath,
  docSha,
  taskId,
  taskStatePath,
) {
  if (target === 'task') {
    if (!taskId || !taskStatePath)
      return reject(
        'task_context_missing',
        'task advice needs task-id and a freshly fetched --task-state JSON from GET /tasks/:id',
      );
    let state;
    try {
      state = JSON.parse(readFileSync(taskStatePath, 'utf8'));
    } catch (err) {
      return reject(
        'task_context_invalid',
        'cannot read task state: ' + err.message,
      );
    }
    if (state.id !== taskId)
      return reject(
        'task_context_mismatch',
        'the fetched task ID does not match the ask task-id',
      );
    if (typeof state.description !== 'string' && typeof state.plan !== 'string')
      return reject(
        'task_context_invalid',
        'task state carries neither a description nor a plan',
      );
    if (
      sha256Of(
        typeof state.description === 'string' ? state.description : '',
      ) !== docSha &&
      sha256Of(typeof state.plan === 'string' ? state.plan : '') !== docSha
    )
      return reject(
        'task_context_mismatch',
        'the bound kickoff/plan bytes are not the fetched task description or plan',
      );
    const binding = { path: docPath, sha256: docSha };
    const res = resolveContentRef(binding, roots);
    if (!res.ok) {
      if (res.code === 'ref_digest_mismatch') {
        return reject(
          'primary_doc_stale',
          'the task-bound primary document ' +
            docPath +
            ' no longer digests to the bound value — stale or changed bytes never route as current',
        );
      }
      return reject(
        'primary_doc_unresolvable',
        'the task-bound primary document does not resolve under the owner roots: ' +
          res.reason,
      );
    }
    return ok({ primaryDoc: binding, authority: 'task-state', taskId });
  }
  const prd = liveValidateCurrentPrd(entry, roots);
  if (!prd.ok) {
    if (prd.code === 'prd_approval_missing') return prd;
    return reject('current_prd_invalid', prd.reason);
  }
  if (target === 'intent') {
    return ok({
      primaryDoc: { ...prd.currentPrd.snapshotRef },
      authority: 'selector',
    });
  }
  const spec = liveValidateCurrentSpec(entry, roots, prd.currentPrd);
  if (!spec.ok) return spec;
  return ok({
    primaryDoc: { ...spec.currentSpec.specRef },
    authority: 'selector',
  });
}

// ---------------------------------------------------------------------------
// Binding comparison: the ask's bound document vs the target's authority document.
// ---------------------------------------------------------------------------
function compareBinding(target, boundPath, boundSha, primaryDoc) {
  if (boundPath === primaryDoc.path) {
    if (boundSha === primaryDoc.sha256) return ok({});
    return reject(
      'primary_doc_stale',
      'the bound primary document ' +
        boundPath +
        ' now digests to ' +
        primaryDoc.sha256.slice(0, 12) +
        '... (bound ' +
        String(boundSha).slice(0, 12) +
        '...) - stale or changed bytes never route as current',
    );
  }
  return reject(
    'primary_doc_not_authority',
    'target ' +
      target +
      ' answers from ' +
      primaryDoc.path +
      ', not the bound ' +
      boundPath +
      ' - wrong responsibility, a foreign document, or a superseded authority',
  );
}

// ---------------------------------------------------------------------------
// Shared adopted-binding route checks (used by --route and --validate-return).
// ---------------------------------------------------------------------------
function routeChecks(
  ask,
  askPath,
  featureHome,
  identity,
  roots,
  taskStatePath,
) {
  const fm = ask.fm;
  if (!fm.continuity) return ok({ adopted: false });
  const target = fm.target;
  if (target === undefined || target === '') {
    return reject(
      'target_missing',
      "an adopted ask needs a 'target:' frontmatter key (task | architecture | intent)",
    );
  }
  if (!TARGETS.includes(target)) {
    return reject(
      'target_invalid',
      "target '" + target + "' is not one of: " + TARGETS.join(', '),
    );
  }
  if (!fm['primary-doc']) {
    return reject(
      'binding_missing',
      "an adopted ask needs 'primary-doc:' (repo-relative path)",
    );
  }
  if (!isHex64(fm['primary-doc-sha256'])) {
    return reject(
      'binding_missing',
      "an adopted ask needs 'primary-doc-sha256:' (64 hex chars)",
    );
  }
  if (fm['return-to'] !== returnAddress(fm, askPath)) {
    return reject(
      'return_owner_mismatch',
      'an adopted ask must return to its original role and exact ask file',
    );
  }
  const req = requireSelectorFeature(featureHome, identity, fm.continuity);
  if (!req.ok) return req;
  const authority = resolveAuthorityDoc(
    target,
    req.entry,
    roots,
    fm['primary-doc'],
    fm['primary-doc-sha256'],
    fm['task-id'],
    taskStatePath,
  );
  if (!authority.ok) return authority;
  const compare = compareBinding(
    target,
    fm['primary-doc'],
    fm['primary-doc-sha256'],
    authority.primaryDoc,
  );
  if (!compare.ok) return compare;
  return ok({
    adopted: true,
    target,
    featureId: fm.continuity,
    revision: req.entry.revision,
    primaryDoc: authority.primaryDoc,
    authority: authority.authority,
    askFile: basename(askPath),
    ...(target === 'task' ? { taskId: fm['task-id'] } : {}),
  });
}

// ---------------------------------------------------------------------------
// --validate-return checks over the Answer block. The journal binding is exact: the
// decisions-entry must carry an anchor, the anchored entry must exist, must name THIS ask
// and THIS feature, and must quote the answer's verdict — another task's or an unrelated
// journal entry is not this answer's decision basis.
// ---------------------------------------------------------------------------
function returnChecks(ask, roots, askPath, featureId) {
  const fm = ask.fm;
  const answerLines = ask.sections['## Answer'] ?? [];
  if (fm.status !== 'answered') {
    return reject(
      'answer_missing',
      'the ask is not answered; there is no advice to return',
    );
  }
  const answerTarget = bodyKeyToken(answerLines, 'target');
  if (answerTarget === null) {
    return reject(
      'return_target_missing',
      "the Answer block names no 'target:' - the addressed responsibility is unaddressed",
    );
  }
  if (answerTarget !== fm.target) {
    return reject(
      'return_target_mismatch',
      "the Answer echoes target '" +
        answerTarget +
        "', the ask bound '" +
        fm.target +
        "'",
    );
  }
  const remainder = bodyKeyToken(answerLines, 'unresolved-remainder');
  if (remainder === null) {
    return reject(
      'remainder_unnamed',
      "the Answer block names no 'unresolved-remainder:' (value may be 'none')",
    );
  }
  const entryValue = bodyKeyToken(answerLines, 'decisions-entry');
  if (entryValue === null) {
    return reject(
      'decisions_entry_missing',
      'the Answer names no decisions-entry',
    );
  }
  const hashPos = entryValue.indexOf('#');
  if (hashPos < 0 || hashPos === entryValue.length - 1) {
    return reject(
      'decisions_entry_anchor_missing',
      'the decisions-entry must carry an #anchor naming the recorded entry (got ' +
        entryValue +
        ')',
    );
  }
  const anchor = entryValue.slice(hashPos + 1).split(/\s+/)[0];
  const entryPath = entryValue.slice(0, hashPos);
  const entryRes = resolveWithinRoots(entryPath, roots);
  if (!entryRes.ok) {
    return reject(
      'decisions_entry_missing',
      'the decisions-entry ' +
        entryPath +
        ' does not resolve under the owner roots: ' +
        entryRes.reason,
    );
  }
  const entry = journalEntry(entryRes.bytes.toString('utf8'), anchor);
  if (entry === null) {
    return reject(
      'decisions_entry_anchor_missing',
      'the decisions-entry ' +
        entryPath +
        " carries no '" +
        anchor +
        "' entry — the anchor must name the recorded decision",
    );
  }
  const askName = basename(askPath);
  if (entryField(entry, 'ask') !== askName) {
    return reject(
      'decisions_entry_unrelated',
      'the journalled entry does not name this ask (' +
        askName +
        ") — another task's journal entry is not this answer's decision basis",
    );
  }
  if (featureId !== null && entryField(entry, 'feature') !== featureId) {
    return reject(
      'decisions_entry_unrelated',
      "the journalled entry does not name feature '" +
        featureId +
        "' — an unrelated journal entry cannot carry this verdict",
    );
  }
  if (fm.target === 'task' && entryField(entry, 'task-id') !== fm['task-id']) {
    return reject(
      'decisions_entry_unrelated',
      'the journalled entry does not bind this task ID',
    );
  }
  const expectedIds = decisionIds(fm['decision-ids']);
  const recordedIds = decisionIds(entryField(entry, 'decision-ids'));
  if (expectedIds.some((id) => !recordedIds.includes(id))) {
    return reject(
      'decision_ids_unrelated',
      "the journalled entry does not record the ask's decision IDs",
    );
  }
  const verdict = bodyKeyToken(answerLines, 'verdict');
  if (verdict === null || entryField(entry, 'verdict') !== verdict) {
    return reject(
      'verdict_not_journalled',
      "the entry does not quote the answer verdict ('" +
        verdict +
        "') — journal-before-answer means the recorded decision carries the same verdict",
    );
  }
  const returnTo = fm['return-to'];
  const expectedReturn = returnAddress(fm, askPath);
  if (
    returnTo !== expectedReturn ||
    entryField(entry, 'return-to') !== expectedReturn
  ) {
    return reject(
      'return_owner_mismatch',
      `return-to and journal must both name ${expectedReturn}; another ask or task cannot receive this answer`,
    );
  }
  return ok({
    decisionsEntry: { path: entryPath, sha256: entryRes.sha256, anchor },
    unresolvedRemainder: remainder,
    returnTo,
  });
}

// ---------------------------------------------------------------------------
// --restore: cold recovery of a responsibility from documents only. The unresolved ask is
// REQUIRED and must match the selected feature/target/authority/owner; the scope statement
// must interpret the resolved primary document (not an arbitrary echo); a recorded
// decision basis is required — missing decision evidence stays UNRESOLVED, never a
// reconstructed agreement. Interpretation SEMANTICS belong to the restored advisor; the
// output says so explicitly (identity/freshness floors only).
// ---------------------------------------------------------------------------
function restoreVerb(opts) {
  const target = opts.target;
  if (target === undefined || !TARGETS.includes(target)) {
    return reject(
      'target_invalid',
      '--restore needs --target one of: ' +
        TARGETS.join(', ') +
        ' (got ' +
        String(target) +
        ')',
    );
  }
  if (opts.feature === undefined)
    return reject('invalid_request', '--restore needs --feature <id>');
  if (opts.ask === undefined)
    return reject(
      'restore_ask_missing',
      '--restore needs the unresolved ask (--ask <askfile>) — a responsibility restored without its open question is not grounded',
    );
  const req = requireSelectorFeature(
    opts.featureHome,
    opts.identity,
    opts.feature,
  );
  if (!req.ok) return req;
  let ask;
  try {
    ask = parseAsk(readFileSync(opts.ask, 'utf8'));
  } catch (err) {
    return reject('ask_unreadable', 'cannot read the ask: ' + err.message);
  }
  if (!ask.ok) return ask;
  if (
    target === 'task' &&
    (opts.doc === undefined || opts['doc-sha256'] === undefined)
  ) {
    return reject(
      'binding_missing',
      '--restore for target=task needs --doc <path> and --doc-sha256 <hex>',
    );
  }
  const authority = resolveAuthorityDoc(
    target,
    req.entry,
    opts.roots,
    opts.doc,
    opts['doc-sha256'],
    ask.fm['task-id'],
    opts['task-state'],
  );
  if (!authority.ok) return authority;

  // The unresolved ask must BE this restoration's ask: adopted, open, same feature,
  // same target, owner-consistent, and bound to the resolved primary document.
  const fm = ask.fm;
  if (!fm.continuity)
    return reject(
      'restore_ask_mismatch',
      'the ask carries no continuity binding — an adopted responsibility is restored from an adopted ask',
    );
  if (fm.continuity !== opts.feature)
    return reject(
      'restore_ask_mismatch',
      "the ask binds feature '" +
        fm.continuity +
        "', the restore targets '" +
        opts.feature +
        "'",
    );
  if (fm.target !== target)
    return reject(
      'restore_ask_mismatch',
      "the ask targets '" +
        fm.target +
        "', the restore restores '" +
        target +
        "'",
    );
  if (fm.status !== 'open')
    return reject(
      'restore_ask_mismatch',
      "the ask status is '" +
        fm.status +
        "' — an answered ask goes through --validate-return, not restore",
    );
  if (fm['return-to'] !== returnAddress(fm, opts.ask)) {
    return reject(
      'restore_ask_mismatch',
      'the ask return-to does not name its original role and exact ask file',
    );
  }
  const askBinding = {
    path: fm['primary-doc'],
    sha256: fm['primary-doc-sha256'],
  };
  if (
    canonicalJsonSafe(askBinding) !== canonicalJsonSafe(authority.primaryDoc)
  ) {
    return reject(
      'restore_ask_mismatch',
      'the ask binds ' +
        fm['primary-doc'] +
        ' (' +
        String(fm['primary-doc-sha256']).slice(0, 12) +
        '...) but the restored responsibility answers from ' +
        authority.primaryDoc.path +
        ' (' +
        authority.primaryDoc.sha256.slice(0, 12) +
        '...) — stale or foreign bindings do not restore',
    );
  }
  const qLines = ask.sections['## Question'] ?? [];
  const qLine = qLines.map((l) => l.trim()).find((l) => l.length > 0);
  const unresolvedAsk = {
    file: basename(opts.ask),
    status: fm.status,
    target: fm.target,
    question: qLine ?? null,
  };

  // Scope statement: required, two-sided, and BOUND to the resolved primary document —
  // a permitted/forbidden pair that never names the artifact is an arbitrary echo.
  if (opts.scope === undefined) {
    return reject(
      'scope_statement_missing',
      '--restore needs the scope statement (--scope <file>) naming one permitted and one forbidden interpretation',
    );
  }
  let scopeLines;
  try {
    scopeLines = readFileSync(opts.scope, 'utf8').split('\n');
  } catch (err) {
    return reject(
      'scope_unreadable',
      'cannot read the scope statement: ' + err.message,
    );
  }
  const permittedLine = scopeLines
    .map((l) => l.trim())
    .find((l) => l.startsWith('permitted:'));
  const forbiddenLine = scopeLines
    .map((l) => l.trim())
    .find((l) => l.startsWith('forbidden:'));
  if (permittedLine === undefined || forbiddenLine === undefined) {
    return reject(
      'scope_statement_incomplete',
      'a scope statement must name one permitted AND one forbidden interpretation',
    );
  }
  const permitted = permittedLine.slice('permitted:'.length).trim();
  const forbidden = forbiddenLine.slice('forbidden:'.length).trim();
  if (
    !permitted.includes(authority.primaryDoc.path) ||
    !forbidden.includes(authority.primaryDoc.path)
  ) {
    return reject(
      'scope_not_bound_to_document',
      'the scope statement must interpret the resolved primary document (' +
        authority.primaryDoc.path +
        ') — interpretations bound to no artifact are an arbitrary echo',
    );
  }

  // Resolve every decision ID the ask actually declares. An initial ask may declare
  // `none`; inventing a prior decision for that case would be a false agreement.
  const ids = decisionIds(fm['decision-ids']);
  if (ids.length === 0) {
    return ok({
      adopted: true,
      check: 'restore',
      target,
      featureId: opts.feature,
      revision: req.entry.revision,
      primaryDoc: authority.primaryDoc,
      authority: authority.authority,
      unresolvedAsk,
      scope: { permitted, forbidden },
      decisionBasis: {
        ids: [],
        note: 'no prior decision IDs were declared in the ask',
      },
      note: 'scope semantics require advisor judgment from the primary document',
    });
  }
  if (opts.decisions === undefined) {
    return reject(
      'decision_basis_missing',
      "--restore needs --decisions <path> for the ask's recorded decision IDs",
    );
  }
  const decisionsRes = resolveWithinRoots(opts.decisions, opts.roots);
  if (!decisionsRes.ok) {
    return reject(
      'decision_basis_missing',
      'the decision basis ' +
        opts.decisions +
        ' does not resolve under the owner roots: ' +
        decisionsRes.reason,
    );
  }
  const decisionsText = decisionsRes.bytes.toString('utf8');
  const absent = ids.filter(
    (id) => !currentDecisionEntry(decisionsText, id, opts.feature),
  );
  if (absent.length > 0) {
    return reject(
      'decision_basis_missing',
      'the decision basis does not record: ' +
        absent.join(', ') +
        ' — missing decision evidence stays unresolved',
    );
  }

  return ok({
    adopted: true,
    check: 'restore',
    target,
    featureId: opts.feature,
    revision: req.entry.revision,
    primaryDoc: authority.primaryDoc,
    authority: authority.authority,
    unresolvedAsk,
    scope: { permitted, forbidden },
    decisionBasis: { path: opts.decisions, sha256: decisionsRes.sha256, ids },
    note: 'identity/freshness floors only — the permitted-vs-forbidden SEMANTICS belong to the restored advisor, judged from the primary document and this decision basis',
  });
}

function canonicalJsonSafe(value) {
  return JSON.stringify(value);
}

// ---------------------------------------------------------------------------
// CLI.
// ---------------------------------------------------------------------------
function resolveRepoRoot(flagged) {
  if (flagged !== undefined) return resolve(flagged);
  if (process.env.AIF_INTENT_REPO_ROOT)
    return resolve(process.env.AIF_INTENT_REPO_ROOT);
  return resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
}

const USAGE =
  'usage: ask-advice.mjs --route --ask <askfile> | --validate-return --ask <askfile> | ' +
  '--restore --target <task|architecture|intent> --feature <id> --ask <file> --scope <file> [--decisions <path>] [--doc <path> --doc-sha256 <hex>] [--task-state <fresh-GET-task-json>] ' +
  '[--orch-home <dir>] [--repo-root <dir>] [--repo-identity <dir>] [--roots <r1,r2...>]';

const VERBS = ['--route', '--validate-return', '--restore'];

function main() {
  const args = process.argv.slice(2);
  const emit = (result, code) => {
    process.stdout.write(JSON.stringify(result) + '\n');
    process.exit(code);
  };
  const opts = {};
  let verb = null;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (VERBS.includes(arg)) {
      if (verb !== null)
        emit(
          reject('invalid_request', 'two verbs given: ' + verb + ' and ' + arg),
          2,
        );
      verb = arg;
    } else if (arg.startsWith('--')) {
      const value = args[i + 1];
      if (value === undefined)
        emit(
          reject('invalid_request', 'flag ' + arg + ' needs a value\n' + USAGE),
          2,
        );
      opts[arg.slice(2)] = value;
      i += 1;
    } else {
      emit(
        reject('invalid_request', 'unexpected argument ' + arg + '\n' + USAGE),
        2,
      );
    }
  }
  if (verb === null) emit(reject('invalid_request', USAGE), 2);

  const repoRoot = resolveRepoRoot(opts['repo-root']);
  const orchHome = resolve(
    opts['orch-home'] ??
      process.env.AIF_INTENT_ORCH_HOME ??
      join(repoRoot, '.claude', 'orchestrator-prompts'),
  );
  const featureHome = join(orchHome, 'intent-continuity');
  const roots = (
    opts.roots !== undefined ? opts.roots.split(',') : [repoRoot]
  ).map((r) => resolve(repoRoot, r));
  let identity;
  if (
    opts['repo-identity'] !== undefined ||
    process.env.AIF_INTENT_REPO_IDENTITY
  ) {
    identity = realpathSync(
      resolve(opts['repo-identity'] ?? process.env.AIF_INTENT_REPO_IDENTITY),
    );
  } else {
    const identityRes = repoIdentityOf(repoRoot);
    if (!identityRes.ok) emit(identityRes, 2);
    identity = identityRes.identity;
  }

  try {
    if (verb === '--route' || verb === '--validate-return') {
      if (opts.ask === undefined)
        emit(reject('invalid_request', verb + ' needs --ask <askfile>'), 2);
      let ask;
      try {
        ask = parseAsk(readFileSync(opts.ask, 'utf8'));
      } catch (err) {
        emit(
          reject('ask_unreadable', 'cannot read the ask: ' + err.message),
          2,
        );
        return;
      }
      if (!ask.ok) {
        emit(ask, 2);
        return;
      }
      const route = routeChecks(
        ask,
        opts.ask,
        featureHome,
        identity,
        roots,
        opts['task-state'],
      );
      if (!route.ok) {
        emit(route, 2);
        return;
      }
      if (verb === '--route') {
        emit(route, 0);
        return;
      }
      if (!route.adopted) {
        // Legacy v1 ask: the adopted return contract is not its contract — passthrough.
        emit(
          ok({
            adopted: false,
            check: 'validate-return',
            target: null,
            featureId: null,
          }),
          0,
        );
        return;
      }
      const ret = returnChecks(ask, roots, opts.ask, route.featureId ?? null);
      if (!ret.ok) {
        emit(ret, 2);
        return;
      }
      emit(
        ok({
          adopted: route.adopted,
          check: 'validate-return',
          target: route.target ?? null,
          featureId: route.featureId ?? null,
          primaryDoc: route.primaryDoc ?? null,
          authority: route.authority ?? null,
          decisionsEntry: ret.decisionsEntry,
          unresolvedRemainder: ret.unresolvedRemainder,
          returnTo: ret.returnTo,
        }),
        0,
      );
      return;
    }
    if (verb === '--restore') {
      const result = restoreVerb({ ...opts, featureHome, identity, roots });
      emit(result, result.ok ? 0 : 2);
      return;
    }
  } catch (err) {
    emit(reject('internal_error', verb + ' failed: ' + err.message), 2);
  }
}

// Am-I-entry-point lock — realpath BOTH sides (SSOT #269 / principle 47), same rationale
// and inline shape as check-result-review.mjs: this helper also ships behind a symlink twin
// in the copied skill tree, where a bare resolve() compare is false.
const isMainEntryLock =
  process.argv[1] !== undefined &&
  (() => {
    try {
      return (
        realpathSync(process.argv[1]) ===
        realpathSync(fileURLToPath(import.meta.url))
      );
    } catch {
      return false;
    }
  })();

if (isMainEntryLock) {
  main();
}
