#!/usr/bin/env node
/**
 * current-decisions.mjs — independent current-authority selector for the intent-continuity
 * feature family (agreed design §4; kickoff `.claude/orchestrator-prompts/intent-continuity/
 * kickoff-a1.md` §2 item 2; canonical home `.agents/procedures/intent/helpers/`).
 *
 * A per-feature pointer beside the existing orchestration/decision artifacts — NOT a second
 * advisor registry, scheduler or product format. The selector file lives at
 * `<orch-home>/intent-continuity/current-decisions.json`, where `<orch-home>` is resolved by
 * `.agents/procedures/pipeline/helpers/print-orch-home.sh` (pass its output via --orch-home;
 * default `<repo-root>/.claude/orchestrator-prompts` covers the framework repo).
 *
 * Contract (single writer per advance, holds rather than guesses):
 *   - keyed by stable feature ID + repository identity derived from the canonical Git common
 *     directory, parsed WITHOUT spawning git: sibling worktrees share one identity (a
 *     worktree's `.git` file points at `<main>/.git/worktrees/<name>`, whose common dir is
 *     `<main>/.git`), while another clone cannot borrow the decision;
 *   - only `/intent`'s approval recorder advances the PRD pointer (after exact-content
 *     approval), only `/arch`'s agreement recorder advances the spec pointer (after an actual
 *     operator decision) — enforced socially by the procedures, structurally by receipt shape;
 *   - advances run under an exclusive mkdir lock anchored beside the RESOLVED canon write
 *     target (sibling worktrees sharing one canon selector contend on ONE lock), validate
 *     the immutable receipt live (content refs re-resolved + digest-verified through the
 *     shared resolver), write a same-directory temp file, fsync, then atomically rename
 *     the whole selector; a write target whose symlink chain exceeds the resolution bound
 *     fails closed (write_target_unresolvable) rather than forking the chain; the resolved
 *     target is BOUND at lock time and re-verified at write time — a selector symlink
 *     retargeted inside the transaction fails closed (write_target_retargeted) instead of
 *     writing a file this lock does not guard;
 *   - under the lock the advance compares the prior state: mechanism-recorded decisions
 *     require --expect-revision captured before decision preparation; the token must equal
 *     the freshly-read revision (expected_revision_mismatch on drift),
 *     and a receipt whose content is the current pointer OR appears in the feature's
 *     recorded history is a stale replay (superseded_receipt_replay) — the pointer never
 *     regresses to superseded content; only pre-mechanism seeding permits no token;
 *   - an approved PRD change invalidates the prior spec agreement's applicability (its
 *     parentPrdSha256 no longer matches) — the advance moves it to history explicitly;
 *   - missing/conflicting/unreadable/stale/foreign state HOLDS (exit 2, one hold code) —
 *     a candidate, kickoff or `matches` verdict can never select or advance authority.
 *
 * Selector schema v1:
 *   { version: 1, repoIdentity: string,
 *     features: { [featureId]: { revision: number, currentPrd: PrdEntry | null,
 *       currentSpec: SpecEntry | null, history: [{revision, at, kind, reason, entry}] } } }
 *   PrdEntry  = { recorder: 'intent-approval', decision: 'approved', approvedSha256,
 *                 snapshotRef, approvalRecordRef, approver, recordedAt, provenance? }
 *   SpecEntry = { recorder: 'arch-agreement', decision: 'agreed', operatorEvidence, specRef,
 *                 agreementRecordRef, parentPrdSha256, recordedAt, provenance? }
 *
 * CLI verbs (exit 0 ok / 2 hold-or-reject; one JSON line on stdout):
 *   --read --feature <id>
 *   --advance-prd  --feature <id> --receipt <path|-> --expect-revision <n> [--pre-mechanism]
 *   --advance-spec --feature <id> --receipt <path|-> --expect-revision <n> [--pre-mechanism]
 *   --check-presentation --feature <id> --spec <path>  (before offering a spec for agreement)
 *   --check-plan-prep    --feature <id> [--spec <path>] (before preparing an executable plan)
 *   --freeze-legacy                                (write-once admission freeze, design §4)
 *   --classify-artifact --path <abs>               (frozen-legacy | unknown discriminator)
 * Shared flags: --orch-home <dir> | env AIF_INTENT_ORCH_HOME; --repo-root <dir> |
 * env AIF_INTENT_REPO_ROOT; --repo-identity <dir> | env AIF_INTENT_REPO_IDENTITY (tests);
 * --roots <root[,root2...]> (owner roots for content-ref resolution; default repo root).
 *
 * `--pre-mechanism` is the honest bootstrap for decisions that predate this mechanism: it
 * stamps `provenance: 'pre-mechanism-seed'` and, for a spec agreement only, skips the
 * published-`matches` precondition — nothing else. It is refused once the pointer of that
 * kind has been recorded by the mechanism itself (pre_mechanism_not_applicable).
 */
import { createHash } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeSync,
} from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalJson, resolveContentRef, validateSpecReview } from './check-result-review.mjs';
import { readPublishedSpecReviews, specReviewAttemptId } from './publish-spec-review.mjs';

const FEATURE_ID_RE = /^[a-z0-9][a-z0-9-]*$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
const LOCK_RETRIES = 3;
const LOCK_RETRY_MS = 100;
const FORMAT_CHAIN_MAX_DEPTH = 4;

const ok = (value) => ({ ok: true, ...value });
const reject = (code, reason) => ({ ok: false, code, reason });
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const isHex64 = (v) => typeof v === 'string' && SHA256_RE.test(v);
const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;
const nowIso = () => new Date().toISOString();

function isContentRef(v) {
  return (
    v !== null &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    isNonEmptyString(v.path) &&
    isHex64(v.sha256)
  );
}

// ---------------------------------------------------------------------------
// Repository identity — canonical Git common directory, parsed without spawning git.
// ---------------------------------------------------------------------------
// Exported for the B1 ask-advice validator (ask-advice.mjs) — the adopted-work routing and
// return-edge checks reuse the SAME selector read and live-validation halves instead of
// re-deriving them. Additive only; the CLI contract above is unchanged.
export function repoIdentityOf(repoRoot) {
  const dotGit = join(repoRoot, '.git');
  let commonDir;
  try {
    const st = statSync(dotGit);
    if (st.isDirectory()) {
      commonDir = dotGit; // plain clone / the main checkout
    } else if (st.isFile()) {
      const text = readFileSync(dotGit, 'utf8').trim();
      if (!text.startsWith('gitdir:')) throw new Error('.git file carries no gitdir pointer');
      let gitdir = resolve(repoRoot, text.slice('gitdir:'.length).trim());
      // A linked worktree's gitdir is <common>/worktrees/<name> — strip the suffix so
      // sibling worktrees resolve to ONE shared repository identity.
      if (basename(dirname(gitdir)) === 'worktrees') gitdir = dirname(dirname(gitdir));
      commonDir = gitdir;
    } else {
      throw new Error('.git is neither a directory nor a gitdir pointer file');
    }
  } catch (err) {
    return reject('repo_identity_unresolvable', `cannot resolve the git common dir: ${err.message}`);
  }
  try {
    return { ok: true, identity: realpathSync(commonDir) };
  } catch (err) {
    return reject('repo_identity_unresolvable', `git common dir unreachable: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Selector I/O — read/validate, lock, atomic write.
// ---------------------------------------------------------------------------
function selectorPath(featureHome) {
  return join(featureHome, 'current-decisions.json');
}

function validateSelectorShape(doc) {
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
    return reject('selector_conflicting', 'selector must be a JSON object');
  }
  if (doc.version !== 1) return reject('selector_conflicting', 'selector.version must be 1');
  if (!isNonEmptyString(doc.repoIdentity)) return reject('selector_conflicting', 'selector.repoIdentity must be a non-empty string');
  if (doc.features === null || typeof doc.features !== 'object' || Array.isArray(doc.features)) {
    return reject('selector_conflicting', 'selector.features must be an object keyed by feature ID');
  }
  for (const [id, entry] of Object.entries(doc.features)) {
    if (!FEATURE_ID_RE.test(id)) return reject('selector_conflicting', `feature ID ${id} is not a stable kebab ID`);
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      return reject('selector_conflicting', `feature ${id} entry must be an object`);
    }
    if (!Number.isInteger(entry.revision) || entry.revision < 1) {
      return reject('selector_conflicting', `feature ${id} revision must be a positive integer`);
    }
    if (entry.currentPrd !== null && (entry.currentPrd === undefined || typeof entry.currentPrd !== 'object')) {
      return reject('selector_conflicting', `feature ${id} currentPrd must be an object or null`);
    }
    if (entry.currentSpec !== null && (entry.currentSpec === undefined || typeof entry.currentSpec !== 'object')) {
      return reject('selector_conflicting', `feature ${id} currentSpec must be an object or null`);
    }
    if (!Array.isArray(entry.history)) return reject('selector_conflicting', `feature ${id} history must be an array`);
  }
  return ok({ doc });
}

/** Read + shape-validate + identity-check the selector. `missing` is a distinguishable hold. */
function readSelector(featureHome, expectedIdentity) {
  const path = selectorPath(featureHome);
  let bytes;
  try {
    bytes = readFileSync(path);
  } catch (err) {
    if (err.code === 'ENOENT') return { missing: true };
    return reject('selector_unreadable', `cannot read the selector: ${err.message}`);
  }
  let doc;
  try {
    doc = JSON.parse(bytes.toString('utf8'));
  } catch (err) {
    return reject('selector_conflicting', `selector is not valid JSON: ${err.message}`);
  }
  const shaped = validateSelectorShape(doc);
  if (!shaped.ok) return shaped;
  if (doc.repoIdentity !== expectedIdentity) {
    return reject(
      'foreign_repository',
      `selector belongs to repository ${doc.repoIdentity}, this checkout resolves to ${expectedIdentity}`
    );
  }
  return ok({ doc });
}

/** Resolve final-component symlink chains of a write target so an atomic rename lands on
 *  the canon file itself. Writing on top of the link path instead (plain renameSync)
 *  replaces the symlink with local bytes — forking one repository's selector into two
 *  divergent, both-identity-valid copies (sibling worktrees resolve the same repoIdentity,
 *  so foreign_repository cannot separate them). At most 8 hops are followed; if the chain
 *  is still a symlink at the bound (or a link is unreadable) the resolution FAILS CLOSED —
 *  returns null, never a still-symlink path the caller would rename onto, breaking the
 *  chain partway down. A dangling chain end creates the canon file through the resolved
 *  path. */
function resolveWriteTarget(p) {
  let cur = p;
  for (let hop = 0; ; hop += 1) {
    let st;
    try {
      st = lstatSync(cur);
    } catch {
      return cur; // chain end does not exist — create at this resolved path
    }
    if (!st.isSymbolicLink()) return cur;
    if (hop >= 8) return null; // deeper than the bound — fail closed, never write beside it
    let link;
    try {
      link = readlinkSync(cur);
    } catch {
      return null; // unreadable symlink — fail closed
    }
    cur = resolve(dirname(cur), link);
  }
}

/** Same-directory temp write + fsync + atomic rename of the whole selector. The write is
 *  BOUND to the target resolved when the lock was acquired (`lockedTarget`): the chain is
 *  re-resolved HERE and an unexpected retarget mid-transaction fails closed — writing the
 *  freshly-resolved location instead would let lock X guard write Y (TOCTOU). */
function writeSelectorAtomic(featureHome, doc, lockedTarget) {
  const target = resolveWriteTarget(selectorPath(featureHome));
  if (target === null) {
    return reject(
      'write_target_unresolvable',
      'the selector write target resolves through a symlink chain deeper than the bound — refusing to write a possibly-forked location'
    );
  }
  if (target !== lockedTarget) {
    return reject(
      'write_target_retargeted',
      `the selector resolved to ${target} but the transaction holds the lock for ${lockedTarget} — the symlink chain moved during the transaction; refusing to write a target this lock does not guard`
    );
  }
  const temp = join(dirname(target), `.current-decisions.json.tmp-${process.pid}-${Math.random().toString(36).slice(2, 10)}`);
  const payload = `${JSON.stringify(doc, null, 2)}\n`;
  const fd = openSync(temp, 'wx');
  try {
    writeSync(fd, payload);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  try {
    renameSync(temp, target); // lands on the canon file — a symlink at the target survives
  } catch (err) {
    rmSync(temp, { force: true });
    throw err;
  }
  return ok({});
}

/** Exclusive writer lock via mkdir (atomic on POSIX); retries briefly, then holds.
 *  The lock guards the RESOLVED canon write target, not this checkout's local spelling
 *  of it: sibling worktrees of one repository whose selectors symlink to a shared canon
 *  file must contend on ONE lock — a per-checkout lock lets their read-modify-write
 *  cycles interleave on the canon (lost update, kickoff §2(2) exclusive-writer +
 *  shared-repository decision). The freeze/style writer takes this same lock, so its
 *  domain follows the selector's canon too. The resolved target is RETURNED and every
 *  write inside the transaction must be bound to it (writeSelectorAtomic /
 *  writeSelectorStyleAtomic re-resolve and fail closed on a mid-transaction retarget). */
function acquireLock(featureHome) {
  const target = resolveWriteTarget(selectorPath(featureHome));
  if (target === null) {
    return reject(
      'write_target_unresolvable',
      'the selector write target resolves through a symlink chain deeper than the bound — refusing to lock or write a possibly-forked location'
    );
  }
  const lockDir = join(dirname(target), '.selector.lock');
  for (let attempt = 0; attempt < LOCK_RETRIES; attempt += 1) {
    try {
      mkdirSync(dirname(target), { recursive: true });
      mkdirSync(lockDir);
      return { ok: true, target, release: () => rmSync(lockDir, { recursive: true, force: true }) };
    } catch (err) {
      if (err.code !== 'EEXIST') return reject('lock_contended', `cannot acquire the selector lock: ${err.message}`);
      if (attempt < LOCK_RETRIES - 1) {
        const until = Date.now() + LOCK_RETRY_MS;
        while (Date.now() < until) {} // brief bounded wait between retries
      }
    }
  }
  return reject('lock_contended', 'another writer holds the selector lock');
}

// ---------------------------------------------------------------------------
// Receipt validation — live re-resolution through the shared content-ref resolver.
// ---------------------------------------------------------------------------
function validatePrdReceipt(receipt, roots, featureId) {
  if (receipt === null || typeof receipt !== 'object' || Array.isArray(receipt)) {
    return reject('receipt_invalid:shape', 'PRD receipt must be a JSON object');
  }
  if (receipt.featureId !== featureId) {
    return reject('receipt_invalid:cross_feature', `receipt names feature ${receipt.featureId}, advance targets ${featureId}`);
  }
  if (receipt.decision !== 'approved') {
    return reject('receipt_invalid:not_approved', `PRD receipt decision must be 'approved', got '${receipt.decision}'`);
  }
  if (!isHex64(receipt.approvedSha256)) return reject('receipt_invalid:shape', 'approvedSha256 must be 64 hex chars');
  if (!isContentRef(receipt.snapshotRef)) return reject('receipt_invalid:shape', 'snapshotRef must be a ContentRef');
  if (!isContentRef(receipt.approvalRecordRef)) return reject('receipt_invalid:shape', 'approvalRecordRef must be a ContentRef');
  if (!isNonEmptyString(receipt.approver)) return reject('receipt_invalid:shape', 'approver must be a non-empty string');
  if (receipt.snapshotRef.sha256 !== receipt.approvedSha256) {
    return reject('receipt_invalid:digest_mismatch', 'approvedSha256 must be the digest of the preserved snapshot bytes');
  }
  for (const ref of [receipt.snapshotRef, receipt.approvalRecordRef]) {
    const res = resolveContentRef(ref, roots);
    if (!res.ok) return reject(`prd_receipt_invalid:${res.code}`, `current PRD receipt no longer resolves: ${res.reason}`);
  }
  const entry = {
    recorder: 'intent-approval',
    decision: 'approved',
    approvedSha256: receipt.approvedSha256,
    snapshotRef: receipt.snapshotRef,
    approvalRecordRef: receipt.approvalRecordRef,
    approver: receipt.approver,
    recordedAt: nowIso(),
  };
  if (receipt.provenance === 'pre-mechanism-seed') entry.provenance = receipt.provenance;
  return ok({ entry });
}

function validateSpecReceipt(receipt, roots, featureId) {
  if (receipt === null || typeof receipt !== 'object' || Array.isArray(receipt)) {
    return reject('receipt_invalid:shape', 'spec agreement receipt must be a JSON object');
  }
  if (receipt.featureId !== featureId) {
    return reject('receipt_invalid:cross_feature', `receipt names feature ${receipt.featureId}, advance targets ${featureId}`);
  }
  if (receipt.decision !== 'agreed') {
    return reject('receipt_invalid:not_agreed', `spec receipt decision must be 'agreed', got '${receipt.decision}'`);
  }
  if (!isNonEmptyString(receipt.operatorEvidence)) {
    return reject('receipt_invalid:shape', 'operatorEvidence must be a non-empty string quoting the operator decision');
  }
  if (!isContentRef(receipt.specRef)) return reject('receipt_invalid:shape', 'specRef must be a ContentRef');
  if (!isContentRef(receipt.agreementRecordRef)) return reject('receipt_invalid:shape', 'agreementRecordRef must be a ContentRef');
  if (!isHex64(receipt.parentPrdSha256)) return reject('receipt_invalid:shape', 'parentPrdSha256 must be 64 hex chars');
  for (const ref of [receipt.specRef, receipt.agreementRecordRef]) {
    const res = resolveContentRef(ref, roots);
    if (!res.ok) return reject(`receipt_invalid:${res.code}`, `spec agreement receipt no longer resolves: ${res.reason}`);
  }
  const entry = {
    recorder: 'arch-agreement',
    decision: 'agreed',
    operatorEvidence: receipt.operatorEvidence,
    specRef: receipt.specRef,
    agreementRecordRef: receipt.agreementRecordRef,
    parentPrdSha256: receipt.parentPrdSha256,
    recordedAt: nowIso(),
  };
  if (receipt.provenance === 'pre-mechanism-seed') entry.provenance = receipt.provenance;
  return ok({ entry });
}

// ---------------------------------------------------------------------------
// Published spec-review corpus — integrity + current-match selection (design §6).
// ---------------------------------------------------------------------------
function loadCorpus(featureHome) {
  try {
    return ok({ corpus: readPublishedSpecReviews(featureHome) });
  } catch (err) {
    return reject('spec_review_invalid:corpus', `cannot read the published spec-review corpus: ${err.message}`);
  }
}

/**
 * Integrity floor over the whole corpus: a published attempt dir must carry bytes whose
 * canonical projection digests to the dir name (content-addressed immutability). A broken
 * entry holds every transition — never silently skipped.
 */
function corpusIntegrity(corpus) {
  for (const { attemptId, specReview } of corpus) {
    if (specReviewAttemptId(specReview) !== attemptId) {
      return reject(`spec_review_invalid:${attemptId}`, 'published bytes do not digest to the attempt dir name (immutability breach)');
    }
  }
  return ok({ corpus });
}

/**
 * Resolve the CURRENT `matches` attempt for (prdSha, specSha): a semantic spec-review with
 * outcome `matches`, or a formatting-equivalence chain whose prior links are all present,
 * binding, and `matches` (depth-capped so a cycle cannot loop forever).
 */
function chainResolves(corpus, roots, featureId, prdSha, specSha, attemptId, depth, seen) {
  if (depth > FORMAT_CHAIN_MAX_DEPTH) return false;
  const found = corpus.find((a) => a.attemptId === attemptId);
  if (!found || seen.has(attemptId)) return false;
  seen.add(attemptId);
  const { specReview } = found;
  if (specReview.featureId !== featureId) return false;
  if (specReview.prdRef.sha256 !== prdSha) return false;
  if (specReview.kind === 'spec-review') {
    if (specReview.outcome !== 'matches' || specReview.specRef.sha256 !== specSha) return false;
    // A candidate attempt must still pass the shared mode-specific validator against the
    // LIVE roots — stale-but-self-consistent bytes resolve nowhere and cannot be current.
    return validateSpecLive(specReview, roots);
  }
  if (specReview.kind === 'formatting-equivalence') {
    if (specReview.outcome !== 'matches' || specReview.specRef.sha256 !== specSha) return false;
    if (!validateSpecLive(specReview, roots)) return false;
    return chainResolves(corpus, roots, featureId, prdSha, specReview.priorSpecRef.sha256, specReview.priorAttemptId, depth + 1, seen);
  }
  return false;
}

function validateSpecLive(specReview, roots) {
  return validateSpecReview({ roots, specReview }).ok;
}

function findMatchesAttempt(featureHome, roots, featureId, prdSha, specSha) {
  const loaded = loadCorpus(featureHome);
  if (!loaded.ok) return loaded;
  const checked = corpusIntegrity(loaded.corpus);
  if (!checked.ok) return checked;
  for (const { attemptId } of checked.corpus) {
    if (chainResolves(checked.corpus, roots, featureId, prdSha, specSha, attemptId, 0, new Set())) {
      return ok({ attemptId, prdSha256: prdSha, specSha256: specSha });
    }
  }
  return reject('matches_attempt_missing', `no current published matches attempt binds PRD ${prdSha.slice(0, 12)}… to spec ${specSha.slice(0, 12)}…`);
}

// ---------------------------------------------------------------------------
// Transition checks (design §6): presentation before agreement, prep before plans.
// ---------------------------------------------------------------------------
export function requireSelectorFeature(featureHome, identity, featureId) {
  const read = readSelector(featureHome, identity);
  if (read.missing) return reject('selector_missing', 'the current-decision selector does not exist; no current authority can be selected');
  if (!read.ok) return read;
  const entry = read.doc.features[featureId];
  if (entry === undefined) {
    return reject('feature_missing', `feature ${featureId} has no entry in the selector; its PRD approval must be recorded first`);
  }
  return ok({ doc: read.doc, entry });
}

export function liveValidateCurrentPrd(entry, roots) {
  if (entry.currentPrd === null || entry.currentPrd === undefined) {
    return reject('prd_approval_missing', 'no current PRD approval is recorded for this feature');
  }
  for (const ref of [entry.currentPrd.snapshotRef, entry.currentPrd.approvalRecordRef]) {
    const res = resolveContentRef(ref, roots);
    if (!res.ok) return reject(`prd_receipt_invalid:${res.code}`, `recorded current PRD receipt no longer resolves: ${res.reason}`);
  }
  return ok({ currentPrd: entry.currentPrd });
}

export function liveValidateCurrentSpec(entry, roots, currentPrd) {
  if (entry.currentSpec === null || entry.currentSpec === undefined) {
    return reject('spec_agreement_missing', 'no current operator-agreed spec is recorded for this feature');
  }
  const spec = entry.currentSpec;
  if (spec.parentPrdSha256 !== currentPrd.approvedSha256) {
    return reject(
      'spec_agreement_inapplicable',
      `the recorded spec agreement binds parent PRD ${spec.parentPrdSha256.slice(0, 12)}… but the current approved PRD is ${currentPrd.approvedSha256.slice(0, 12)}… — renewed agreement is required`
    );
  }
  for (const ref of [spec.specRef, spec.agreementRecordRef]) {
    const res = resolveContentRef(ref, roots);
    if (!res.ok) return reject(`spec_agreement_invalid:${res.code}`, `recorded spec agreement no longer resolves: ${res.reason}`);
  }
  return ok({ currentSpec: spec });
}

function digestFileWithinRoots(path, roots, repoRoot) {
  const abs = resolve(repoRoot, path);
  // Resolve the FULL chain, leaf included: containing only the dirname lets a leaf symlink
  // point outside every root while its parent stays inside (anti-dodge recheck, same shape
  // as the shared resolver's realpath containment in check-result-review.mjs).
  let real;
  try {
    real = realpathSync(abs);
  } catch (err) {
    return reject('spec_outside_roots', `candidate spec ${path} is unreachable: ${err.message}`);
  }
  const containedByRoots = roots.some((root) => {
    try {
      const realRoot = realpathSync(root);
      return real === realRoot || real.startsWith(realRoot + '/');
    } catch {
      return false;
    }
  });
  if (!containedByRoots) return reject('spec_outside_roots', `candidate spec ${path} resolves outside every configured owner root`);
  let bytes;
  try {
    bytes = readFileSync(real);
  } catch (err) {
    return reject('spec_outside_roots', `candidate spec ${path} cannot be read: ${err.message}`);
  }
  return ok({ specSha256: sha256(bytes) });
}

// ---------------------------------------------------------------------------
// Verbs.
// ---------------------------------------------------------------------------
function readVerb(featureHome, identity, featureId) {
  const req = requireSelectorFeature(featureHome, identity, featureId);
  if (!req.ok) return req;
  const { entry } = req;
  return ok({
    featureId,
    revision: entry.revision,
    currentPrd: entry.currentPrd,
    currentSpec: entry.currentSpec,
    historyLength: entry.history.length,
  });
}

function preMechanismApplicable(existingEntry, kind) {
  const current = existingEntry ? existingEntry[kind] : null;
  if (current === null || current === undefined) return true;
  return current.provenance === 'pre-mechanism-seed';
}

function advanceVerb(kind, featureHome, identity, featureId, receiptBytes, preMechanism, roots, expectRevision) {
  let receipt;
  try {
    receipt = JSON.parse(receiptBytes.toString('utf8'));
  } catch (err) {
    return reject('receipt_invalid:json', `cannot parse the receipt: ${err.message}`);
  }
  if (preMechanism) receipt.provenance = 'pre-mechanism-seed';
  const lock = acquireLock(featureHome);
  if (!lock.ok) return lock;
  try {
    const read = readSelector(featureHome, identity);
    if (!read.ok) {
      if (!read.missing) return read;
      if (kind === 'currentSpec') {
        return reject('selector_missing', 'the selector does not exist; record the PRD approval before any spec agreement');
      }
      // Bootstrap of the incumbent decision home: the first PRD advance creates it.
      const doc = { version: 1, repoIdentity: identity, features: {} };
      const written = advanceUnderLock(doc, featureId, kind, receipt, preMechanism, roots, featureHome, identity, lock.target, expectRevision);
      return written;
    }
    return advanceUnderLock(read.doc, featureId, kind, receipt, preMechanism, roots, featureHome, identity, lock.target, expectRevision);
  } finally {
    lock.release();
  }
}

function advanceUnderLock(doc, featureId, kind, receipt, preMechanism, roots, featureHome, identity, lockedTarget, expectRevision) {
  const entry = doc.features[featureId] ?? { revision: 0, currentPrd: null, currentSpec: null, history: [] };
  doc.features[featureId] = entry;

  // Kickoff §2(2) prior-revision compare, UNDER the lock against the freshly-read state.
  // No token → plain bootstrap/legacy flow (the initial flow stays token-free).
  if (expectRevision !== undefined && entry.revision !== expectRevision) {
    return reject(
      'expected_revision_mismatch',
      `the advance expected prior revision ${expectRevision} but the selector holds ${entry.revision} — rebuild the transaction against current state`
    );
  }

  if (preMechanism && !preMechanismApplicable(entry, kind)) {
    return reject(
      'pre_mechanism_not_applicable',
      `--pre-mechanism only bootstraps a pointer the mechanism has not recorded; ${kind} is already mechanism-recorded`
    );
  }

  if (kind === 'currentPrd') {
    const validated = validatePrdReceipt(receipt, roots, featureId);
    if (!validated.ok) return validated;
    // Stale replay guard, history-inclusive: after A→B, replaying the older valid A
    // receipt would otherwise revert the pointer to superseded content.
    const prdSeen = (sha) =>
      Boolean(entry.currentPrd && entry.currentPrd.approvedSha256 === sha) ||
      entry.history.some((h) => h.kind === 'currentPrd' && h.entry && h.entry.approvedSha256 === sha);
    if (prdSeen(validated.entry.approvedSha256)) {
      return reject('superseded_receipt_replay', 'this PRD approval is the current pointer or appears in the feature history; replays and regressions advance nothing');
    }
    if (entry.currentPrd) {
      entry.history.push({ revision: entry.revision, at: nowIso(), kind: 'currentPrd', reason: `superseded by approval ${validated.entry.approvedSha256.slice(0, 12)}…`, entry: entry.currentPrd });
    }
    if (entry.currentSpec) {
      // Design §4: an updated PRD makes the old spec agreement inapplicable through its
      // bound parent PRD reference even if the spec file is unchanged — invalidate now,
      // visibly, not lazily at read time.
      entry.history.push({ revision: entry.revision, at: nowIso(), kind: 'currentSpec', reason: `invalidated by PRD advance to ${validated.entry.approvedSha256.slice(0, 12)}…`, entry: entry.currentSpec });
      entry.currentSpec = null;
    }
    entry.currentPrd = validated.entry;
  } else {
    const prdOk = liveValidateCurrentPrd(entry, roots);
    if (!prdOk.ok) {
      if (prdOk.code === 'prd_approval_missing') return prdOk;
      return reject('current_prd_invalid', prdOk.reason);
    }
    const validated = validateSpecReceipt(receipt, roots, featureId);
    if (!validated.ok) return validated;
    if (validated.entry.parentPrdSha256 !== entry.currentPrd.approvedSha256) {
      return reject(
        'spec_agreement_inapplicable',
        `the agreement binds parent PRD ${validated.entry.parentPrdSha256.slice(0, 12)}… but the current approved PRD is ${entry.currentPrd.approvedSha256.slice(0, 12)}…`
      );
    }
    if (!preMechanism) {
      const match = findMatchesAttempt(featureHome, roots, featureId, entry.currentPrd.approvedSha256, validated.entry.specRef.sha256);
      if (!match.ok) return match;
    }
    // Stale replay guard, history-inclusive — same shape as the PRD side: after S1→S2,
    // replaying the older valid S1 agreement would otherwise regress the pointer.
    const specSeen = (sha) =>
      Boolean(entry.currentSpec && entry.currentSpec.specRef.sha256 === sha) ||
      entry.history.some((h) => h.kind === 'currentSpec' && h.entry && h.entry.specRef && h.entry.specRef.sha256 === sha);
    if (specSeen(validated.entry.specRef.sha256)) {
      return reject('superseded_receipt_replay', 'this spec agreement is the current pointer or appears in the feature history; replays and regressions advance nothing');
    }
    if (entry.currentSpec) {
      entry.history.push({ revision: entry.revision, at: nowIso(), kind: 'currentSpec', reason: `superseded by agreement ${validated.entry.specRef.sha256.slice(0, 12)}…`, entry: entry.currentSpec });
    }
    entry.currentSpec = validated.entry;
  }

  entry.revision += 1;
  let written;
  try {
    written = writeSelectorAtomic(featureHome, doc, lockedTarget);
  } catch (err) {
    return reject('selector_unwritable', `cannot write the selector atomically: ${err.message}`);
  }
  if (!written.ok) return written; // unresolvable/retargeted target — fail closed
  const back = readSelector(featureHome, identity);
  if (!back.ok) return reject('selector_changed_during_write', `post-write verification failed: ${back.code} ${back.reason}`);
  const backEntry = back.doc.features[featureId];
  if (!backEntry || backEntry.revision !== entry.revision) {
    return reject('selector_changed_during_write', `post-write revision mismatch: expected ${entry.revision}`);
  }
  return ok({ featureId, revision: entry.revision, advanced: kind });
}

function checkPresentationVerb(featureHome, identity, featureId, specPath, roots, repoRoot) {
  const req = requireSelectorFeature(featureHome, identity, featureId);
  if (!req.ok) return req;
  const prdOk = liveValidateCurrentPrd(req.entry, roots);
  if (!prdOk.ok) return prdOk;
  const specOk = digestFileWithinRoots(specPath, roots, repoRoot);
  if (!specOk.ok) return specOk;
  const match = findMatchesAttempt(featureHome, roots, featureId, prdOk.currentPrd.approvedSha256, specOk.specSha256);
  if (!match.ok) return match;
  return ok({
    check: 'presentation',
    featureId,
    revision: req.entry.revision,
    attemptId: match.attemptId,
    prdSha256: prdOk.currentPrd.approvedSha256,
    specSha256: specOk.specSha256,
  });
}

function checkPlanPrepVerb(featureHome, identity, featureId, specPath, roots, repoRoot) {
  const req = requireSelectorFeature(featureHome, identity, featureId);
  if (!req.ok) return req;
  const prdOk = liveValidateCurrentPrd(req.entry, roots);
  if (!prdOk.ok) return prdOk;
  const specOk = liveValidateCurrentSpec(req.entry, roots, prdOk.currentPrd);
  if (!specOk.ok) return specOk;
  const match = findMatchesAttempt(featureHome, roots, featureId, prdOk.currentPrd.approvedSha256, specOk.currentSpec.specRef.sha256);
  if (!match.ok) return match;
  if (specPath !== undefined) {
    const bytes = digestFileWithinRoots(specPath, roots, repoRoot);
    if (!bytes.ok) return bytes;
    if (bytes.specSha256 !== specOk.currentSpec.specRef.sha256) {
      return reject(
        'spec_bytes_mismatch',
        `candidate spec ${specPath} digests to ${bytes.specSha256.slice(0, 12)}… but the current agreed spec is ${specOk.currentSpec.specRef.sha256.slice(0, 12)}…`
      );
    }
  }
  return ok({
    check: 'plan-prep',
    featureId,
    attemptId: match.attemptId,
    prdSha256: prdOk.currentPrd.approvedSha256,
    specSha256: specOk.currentSpec.specRef.sha256,
  });
}

// ---------------------------------------------------------------------------
// Admission freeze + discriminator (design §4 — prevent adoption-by-omission).
// ---------------------------------------------------------------------------
function walkKickoffFiles(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (ent.name.startsWith('.')) continue;
    const full = join(dir, ent.name);
    if (ent.isDirectory()) walkKickoffFiles(full, out);
    else if (ent.isFile() && /^kickoff[^/]*\.md$/i.test(ent.name)) out.push(full);
  }
}

function freezeLegacyVerb(featureHome, identity, repoRoot, orchHome) {
  const freezePath = join(featureHome, 'legacy-freeze.json');
  // Under the same exclusive lock as pointer advances, with the write-once check INSIDE the
  // lock: two concurrent freezes can no longer both pass the existsSync gate and race the
  // rename (one write wins, the loser exits 0 on stale information otherwise).
  const lock = acquireLock(featureHome);
  if (!lock.ok) return lock;
  try {
    if (existsSync(freezePath)) {
      return reject('freeze_exists', 'the legacy admission freeze already exists — a later edit cannot refresh the frozen allowlist');
    }
    const files = [];
    walkKickoffFiles(orchHome, files);
    files.sort();
    const artifacts = files.map((full) => {
      const relPath = relative(repoRoot, full);
      return { path: relPath, sha256: sha256(readFileSync(full)) };
    });
    const doc = {
      version: 1,
      repoIdentity: identity,
      frozenAt: nowIso(),
      artifacts,
      taskIds: [],
      limitation:
        'active-task enumeration is not implemented in stage A1 — kickoff path+digest pairs only; task-ID freeze belongs to the held dispatch/start/resume effect stages (B/C/D)',
    };
    let written;
    try {
      mkdirSync(featureHome, { recursive: true });
      written = writeSelectorStyleAtomic(featureHome, 'legacy-freeze.json', `${JSON.stringify(doc, null, 2)}\n`, lock.target);
    } catch (err) {
      return reject('freeze_unwritable', `cannot write the legacy freeze: ${err.message}`);
    }
    if (!written.ok) return written; // unresolvable/retargeted target — fail closed
    return ok({ frozen: artifacts.length, path: freezePath });
  } finally {
    lock.release();
  }
}

/** Write-once publication for the legacy freeze. The resolved target must be the canonical
 *  freeze filename in the selector's locked directory. A hard link from a synced temp file
 *  publishes atomically without replacing an existing destination, even if another actor
 *  retargets a symlink or creates that destination after the earlier existsSync check. */
function writeSelectorStyleAtomic(featureHome, name, payload, lockedSelectorTarget) {
  const target = resolveWriteTarget(join(featureHome, name));
  if (target === null) {
    return reject(
      'write_target_unresolvable',
      'the freeze write target resolves through a symlink chain deeper than the bound — refusing to write a possibly-forked location'
    );
  }
  const expectedTarget = join(dirname(lockedSelectorTarget), name);
  if (target !== expectedTarget) {
    return reject(
      'write_target_retargeted',
      `the freeze target resolves to ${target} but this transaction requires ${expectedTarget} — refusing to publish at a different file`
    );
  }
  const temp = join(dirname(target), `.${basename(target)}.tmp-${process.pid}-${Math.random().toString(36).slice(2, 10)}`);
  const fd = openSync(temp, 'wx');
  try {
    writeSync(fd, payload);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  try {
    linkSync(temp, target);
  } catch (err) {
    if (err.code === 'EEXIST') return reject('freeze_exists', 'the legacy admission freeze already exists — write-once publication cannot replace it');
    throw err;
  } finally {
    rmSync(temp, { force: true });
  }
  return ok({});
}

function classifyArtifactVerb(featureHome, identity, pathArg, repoRoot) {
  const freezePath = join(featureHome, 'legacy-freeze.json');
  if (!existsSync(freezePath)) {
    return reject('freeze_missing', 'the legacy admission freeze does not exist; run --freeze-legacy before classifying artifacts');
  }
  let doc;
  try {
    doc = JSON.parse(readFileSync(freezePath, 'utf8'));
  } catch (err) {
    return reject('freeze_unreadable', `cannot read the legacy freeze: ${err.message}`);
  }
  // The freeze binds this repository's identity (same rule as the selector): a freeze copied
  // from another clone must not classify this clone's artifacts — its path+digest pairs
  // describe a different tree.
  if (doc.repoIdentity !== identity) {
    return reject(
      'freeze_foreign_repository',
      `the legacy freeze belongs to repository ${doc.repoIdentity}, this checkout resolves to ${identity}`
    );
  }
  const abs = resolve(repoRoot, pathArg);
  let bytes;
  try {
    bytes = readFileSync(abs);
  } catch (err) {
    return reject('artifact_unreadable', `cannot read ${pathArg}: ${err.message}`);
  }
  const relPath = relative(repoRoot, realpathSync(dirname(abs))) === '' ? basename(abs) : relative(repoRoot, abs);
  const digest = sha256(bytes);
  const frozen = (doc.artifacts ?? []).some((a) => a.path === relPath && a.sha256 === digest);
  return ok({ classification: frozen ? 'frozen-legacy' : 'unknown', path: relPath, sha256: digest });
}

// ---------------------------------------------------------------------------
// CLI.
// ---------------------------------------------------------------------------
function resolveRepoRoot(flagged) {
  if (flagged !== undefined) return resolve(flagged);
  if (process.env.AIF_INTENT_REPO_ROOT) return resolve(process.env.AIF_INTENT_REPO_ROOT);
  return resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
}

function readInput(path) {
  if (path === '-') return readFileSync(0);
  return readFileSync(path);
}

const USAGE =
  'usage: current-decisions.mjs --read --feature <id> | --advance-prd --feature <id> --receipt <path|-> --expect-revision <n> [--pre-mechanism] | ' +
  '--advance-spec --feature <id> --receipt <path|-> --expect-revision <n> [--pre-mechanism] | --check-presentation --feature <id> --spec <path> | ' +
  '--check-plan-prep --feature <id> [--spec <path>] | --freeze-legacy | --classify-artifact --path <abs> ' +
  '[--orch-home <dir>] [--repo-root <dir>] [--repo-identity <dir>] [--roots <r1,r2...>]';

const VERBS = new Set([
  '--read',
  '--advance-prd',
  '--advance-spec',
  '--check-presentation',
  '--check-plan-prep',
  '--freeze-legacy',
  '--classify-artifact',
]);

function main() {
  const args = process.argv.slice(2);
  const emit = (result, code) => {
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exit(code);
  };
  const opts = {};
  let verb;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (VERBS.has(arg)) {
      if (verb !== undefined) emit(reject('invalid_request', `two verbs given: ${verb} and ${arg}`), 2);
      verb = arg;
    } else if (arg === '--pre-mechanism') {
      opts['pre-mechanism'] = true;
    } else if (arg.startsWith('--')) {
      const value = args[i + 1];
      if (value === undefined) emit(reject('invalid_request', `flag ${arg} needs a value\n${USAGE}`), 2);
      opts[arg.slice(2)] = value;
      i += 1;
    } else {
      emit(reject('invalid_request', `unexpected argument ${arg}\n${USAGE}`), 2);
    }
  }
  if (verb === undefined) emit(reject('invalid_request', USAGE), 2);

  const repoRoot = resolveRepoRoot(opts['repo-root']);
  const orchHome = resolve(
    opts['orch-home'] ?? process.env.AIF_INTENT_ORCH_HOME ?? join(repoRoot, '.claude', 'orchestrator-prompts')
  );
  const featureHome = join(orchHome, 'intent-continuity');
  const roots = (opts.roots !== undefined ? opts.roots.split(',') : [repoRoot]).map((r) => resolve(repoRoot, r));
  const identityRes =
    opts['repo-identity'] !== undefined || process.env.AIF_INTENT_REPO_IDENTITY
      ? { ok: true, identity: realpathSync(resolve(opts['repo-identity'] ?? process.env.AIF_INTENT_REPO_IDENTITY)) }
      : repoIdentityOf(repoRoot);
  if (!identityRes.ok) emit(identityRes, 2);
  const identity = identityRes.identity;

  const featureId = opts.feature;
  if (['--read', '--advance-prd', '--advance-spec', '--check-presentation', '--check-plan-prep'].includes(verb)) {
    if (featureId === undefined || !FEATURE_ID_RE.test(featureId)) {
      emit(reject('invalid_request', `--feature must be a stable kebab-case feature ID\n${USAGE}`), 2);
    }
  }

  try {
    switch (verb) {
      case '--read': {
        const result = readVerb(featureHome, identity, featureId);
        emit(result, result.ok ? 0 : 2);
        return;
      }
      case '--advance-prd':
      case '--advance-spec': {
        if (opts.receipt === undefined) emit(reject('invalid_request', `--receipt <path|-> is required for ${verb}`), 2);
        if (!opts['pre-mechanism'] && opts['expect-revision'] === undefined) {
          emit(reject('expected_revision_required', '--expect-revision must be captured before preparing the decision and supplied for a mechanism-recorded advance'), 2);
        }
        let expectRevision;
        if (opts['expect-revision'] !== undefined) {
          expectRevision = Number(opts['expect-revision']);
          if (!Number.isInteger(expectRevision) || expectRevision < 0) {
            emit(reject('invalid_request', '--expect-revision must be a non-negative integer'), 2);
          }
        }
        let receiptBytes;
        try {
          receiptBytes = readInput(opts.receipt);
        } catch (err) {
          emit(reject('receipt_invalid:io', `cannot read the receipt: ${err.message}`), 2);
        }
        const kind = verb === '--advance-prd' ? 'currentPrd' : 'currentSpec';
        const result = advanceVerb(kind, featureHome, identity, featureId, receiptBytes, Boolean(opts['pre-mechanism']), roots, expectRevision);
        emit(result, result.ok ? 0 : 2);
        return;
      }
      case '--check-presentation': {
        if (opts.spec === undefined) emit(reject('invalid_request', '--spec <path> is required for --check-presentation'), 2);
        const result = checkPresentationVerb(featureHome, identity, featureId, opts.spec, roots, repoRoot);
        emit(result, result.ok ? 0 : 2);
        return;
      }
      case '--check-plan-prep': {
        const result = checkPlanPrepVerb(featureHome, identity, featureId, opts.spec, roots, repoRoot);
        emit(result, result.ok ? 0 : 2);
        return;
      }
      case '--freeze-legacy': {
        const result = freezeLegacyVerb(featureHome, identity, repoRoot, orchHome);
        emit(result, result.ok ? 0 : 2);
        return;
      }
      case '--classify-artifact': {
        if (opts.path === undefined) emit(reject('invalid_request', '--path <abs> is required for --classify-artifact'), 2);
        const result = classifyArtifactVerb(featureHome, identity, opts.path, repoRoot);
        emit(result, result.ok ? 0 : 2);
        return;
      }
      default:
        emit(reject('invalid_request', USAGE), 2);
    }
  } catch (err) {
    emit(reject('internal_error', `${verb} failed: ${err.message}`), 2);
  }
}

// Am-I-entry-point lock — realpath BOTH sides (SSOT #269 / principle 47), same rationale
// and inline shape as check-result-review.mjs: this helper also ships behind a symlink twin
// in the copied skill tree, where a bare resolve() compare is false.
const isMainEntryLock =
  process.argv[1] !== undefined &&
  (() => {
    try {
      return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
    } catch {
      return resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
    }
  })();

if (isMainEntryLock) {
  main();
}
