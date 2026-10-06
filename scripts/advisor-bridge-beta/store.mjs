// Advisor bridge beta — local pilot state store.
// Deterministic, dependency-free, synchronous. See
// docs/superpowers/specs/2026-10-06-advisor-reverse-bridge-tracer-design.md (behavior contract).

import {
  closeSync, existsSync, lstatSync, linkSync, mkdirSync, openSync,
  readFileSync, readdirSync, realpathSync, renameSync, unlinkSync, writeFileSync,
} from 'node:fs';

import { createHash, randomUUID } from 'node:crypto';
import { join, join as pathJoin, resolve, sep } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

export class HoldError extends Error {
  constructor(reason, details = {}) {
    super(`HOLD: ${reason}`);
    this.name = 'HoldError';
    this.reason = reason;
    this.details = details;
  }
}

export class RejectError extends Error {
  constructor(reason, details = {}) {
    super(`REJECT: ${reason}`);
    this.name = 'RejectError';
    this.reason = reason;
    this.details = details;
  }
}

export const LIMITS = {
  maxCcPasses: 3,
  maxAdvisorCalls: 2,
  processDeadlineMs: 20 * 60 * 1000,
  admissionWindowMs: 60 * 60 * 1000,
};

const STATE = 'state';
const LOCK = join(STATE, 'op-lock.lock');

export function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function canonicalJson(data) {
  return `${JSON.stringify(data, null, 2)}\n`;
}

export function mailboxPath(root, ...parts) {
  return join(resolve(root), ...parts);
}

function ensureDirs(root) {
  for (const dir of [STATE, 'requests', 'attempts', 'asks', 'outbox', 'reports', 'decisions', 'events']) {
    mkdirSync(mailboxPath(root, dir), { recursive: true });
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

// Atomic same-filesystem publication: write a temp sibling, then rename over the target.
function publishAtomic(target, text) {
  mkdirSync(dirnameSafe(target), { recursive: true });
  const tmp = `${target}.tmp-${process.pid}-${randomUUID().slice(0, 8)}`;
  writeFileSync(tmp, text);
  renameSync(tmp, target);
}

function dirnameSafe(p) {
  const i = p.lastIndexOf(sep);
  return i <= 0 ? '.' : p.slice(0, i);
}

// Immutable artifact creation via link(2): EEXIST means someone already bound it.
// Returns {replay} — replay=true when the stored bytes are identical.
function createImmutable(target, text) {
  mkdirSync(dirnameSafe(target), { recursive: true });
  const tmp = `${target}.tmp-${process.pid}-${randomUUID().slice(0, 8)}`;
  writeFileSync(tmp, text);
  try {
    linkSync(tmp, target);
    return { replay: false };
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    const existing = readFileSync(target, 'utf8');
    if (existing !== text) {
      throw new RejectError('immutable artifact conflict', { target });
    }
    return { replay: true };
  } finally {
    try { unlinkSync(tmp); } catch { /* tmp already gone */ }
  }
}

// Content identity ignoring volatile timestamp fields: a legitimate retry
// reconstructs `importedAt`/`createdAt`/`decidedAt` and must still be recognized
// as the same artifact (identical replay returns the existing receipt).
function sameExceptVolatile(storedText, incomingText, volatileKeys) {
  try {
    const a = JSON.parse(storedText);
    const b = JSON.parse(incomingText);
    for (const k of volatileKeys) {
      delete a[k];
      delete b[k];
    }
    return isDeepStrictEqual(a, b);
  } catch {
    return false;
  }
}

export function readPilot(root) {
  const p = mailboxPath(root, 'pilot.json');
  if (!existsSync(p)) return null;
  return readJson(p);
}

// ---------- observed physical git identity ----------

function hasGitObjects(dir) {
  return existsSync(join(dir, 'objects')) && existsSync(join(dir, 'refs'));
}

function commonDirVerified(dir) {
  return existsSync(dir) && hasGitObjects(dir) ? realpathSync(dir) : null;
}

// git writes a `commondir` file inside a linked worktree's gitdir; a main
// `.git` directory carries objects/refs directly.
function commonDirFromGitdir(gitdir) {
  const commondirPath = join(gitdir, 'commondir');
  if (existsSync(commondirPath)) {
    let raw = '';
    try {
      raw = readFileSync(commondirPath, 'utf8').trim();
    } catch {
      return null;
    }
    if (raw.length === 0) return null;
    return commonDirVerified(resolve(gitdir, raw));
  }
  return commonDirVerified(gitdir);
}

// Derive the physical git common directory for a working directory by
// observing its `.git` (directory, or file with a `gitdir:` pointer).
function gitCommonDirOf(workingDir) {
  const dotGit = join(workingDir, '.git');
  let st;
  try {
    st = lstatSync(dotGit);
  } catch {
    return null;
  }
  if (st.isDirectory()) return commonDirVerified(dotGit);
  if (st.isFile()) {
    const m = readFileSync(dotGit, 'utf8').match(/^gitdir:\s*(.+)$/m);
    if (!m) return null;
    return commonDirFromGitdir(resolve(workingDir, m[1].trim()));
  }
  return null;
}

// Walk up from the mailbox anchor until an observed git repository is found.
function anchorCommonDir(mailboxRoot) {
  let dir = resolve(mailboxRoot);
  for (;;) {
    const found = gitCommonDirOf(dir);
    if (found) return found;
    const parent = resolve(dir, '..');
    if (parent === dir) return null;
    dir = parent;
  }
}

// ---------- path safety ----------

export function safeArtifactPath(root, rel) {
  if (typeof rel !== 'string' || rel.length === 0) throw new RejectError('empty artifact path');
  if (rel.includes('\0')) throw new RejectError('NUL byte in artifact path');
  const rootAbs = resolve(root);
  const abs = resolve(rootAbs, rel);
  if (abs !== rootAbs && !abs.startsWith(rootAbs + sep)) {
    throw new RejectError('artifact path escapes mailbox', { rel });
  }
  let cur = rootAbs;
  const rest = abs.slice(rootAbs.length + 1);
  if (rest.length === 0) return abs;
  for (const seg of rest.split(sep)) {
    cur = pathJoin(cur, seg);
    let st;
    try {
      st = lstatSync(cur);
    } catch {
      continue;
    }
    if (st.isSymbolicLink()) {
      const rp = realpathSync(cur);
      if (rp !== rootAbs && !rp.startsWith(rootAbs + sep)) {
        throw new RejectError('symlink escape in artifact path', { rel, segment: seg });
      }
    }
  }
  return abs;
}

export function checkWorkKey(workKey) {
  if (typeof workKey !== 'string' || !/^[a-z0-9][a-z0-9.-]{0,63}$/.test(workKey)) {
    throw new RejectError('invalid workKey', { workKey });
  }
  return workKey;
}

// ---------- operation lock ----------

export function opLockPresent(root) {
  return existsSync(mailboxPath(root, LOCK));
}

export async function withOpLock(root, fn) {
  const lockPath = mailboxPath(root, LOCK);
  mkdirSync(mailboxPath(root, STATE), { recursive: true });
  let fd;
  try {
    fd = openSync(lockPath, 'wx');
  } catch (e) {
    if (e.code === 'EEXIST') {
      throw new HoldError('operation lock present; reconcile to clear', { lockPath });
    }
    throw e;
  }
  writeFileSync(fd, canonicalJson({ holder: `pid-${process.pid}`, acquiredAt: new Date().toISOString() }));
  try {
    return await fn();
  } finally {
    try { closeSync(fd); } catch { /* already closed */ }
    try { unlinkSync(lockPath); } catch { /* lock already removed */ }
  }
}

// Reconciliation is explicit: an operator/senior action, never automatic.
// A lock whose holder process is still alive is NEVER removed by this path.
export function reconcileOpLock(root, { actor, rationale }) {
  if (typeof rationale !== 'string' || rationale.length < 20) {
    throw new RejectError('reconcile requires a rationale of at least 20 characters');
  }
  const lockPath = mailboxPath(root, LOCK);
  if (!existsSync(lockPath)) return { removed: false };
  const stale = readFileSync(lockPath, 'utf8');
  let holderPid = NaN;
  try {
    holderPid = Number(String(JSON.parse(stale).holder).match(/^pid-(\d+)$/)?.[1] ?? NaN);
  } catch {
    holderPid = NaN;
  }
  if (Number.isInteger(holderPid) && holderPid > 0) {
    let alive = false;
    try {
      process.kill(holderPid, 0);
      alive = true;
    } catch {
      alive = false;
    }
    if (alive) {
      throw new HoldError('operation lock holder process is alive; refusing to reconcile a live holder', { holderPid });
    }
  }
  unlinkSync(lockPath);
  journalAppend(root, {
    eventId: `lock-reconcile-${sha256(stale + rationale).slice(0, 16)}`,
    type: 'op-lock-reconciled',
    actor,
    payload: { stale, rationale },
  });
  return { removed: true };
}

// ---------- journal ----------

function nextSeq(root) {
  const dir = mailboxPath(root, 'events');
  return readdirSync(dir).length + 1;
}

// An identical semantic replay (same type, actor, payload, causation) returns
// the existing receipt. ANY changed content under the same event ID is a
// conflict and is rejected — silent success under changed bytes is forbidden.
export function journalAppend(root, { eventId, type, actor, payload, causationId = null }) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(eventId)) {
    throw new RejectError('invalid eventId', { eventId });
  }
  const dir = mailboxPath(root, 'events');
  mkdirSync(dir, { recursive: true });
  for (const name of readdirSync(dir)) {
    const existing = readJson(join(dir, name));
    if (existing.eventId === eventId) {
      const same = existing.type === type
        && existing.actor === actor
        && isDeepStrictEqual(existing.payload ?? null, payload ?? null)
        && isDeepStrictEqual(existing.causationId ?? null, causationId ?? null);
      if (!same) {
        throw new RejectError('event ID conflict: changed content under an existing event ID', {
          eventId, existingSeq: existing.seq,
        });
      }
      return { seq: existing.seq, eventId, replay: true };
    }
  }
  const seq = nextSeq(root);
  const record = {
    schemaVersion: 1,
    seq,
    eventId,
    type,
    actor,
    causationId,
    payload: payload ?? null,
    appendedAt: new Date().toISOString(),
  };
  createImmutable(join(dir, `${String(seq).padStart(4, '0')}-${eventId}.json`), canonicalJson(record));
  return { seq, eventId, replay: false };
}

export function journalFind(root, eventId) {
  const dir = mailboxPath(root, 'events');
  if (!existsSync(dir)) return null;
  for (const name of readdirSync(dir)) {
    const rec = readJson(join(dir, name));
    if (rec.eventId === eventId) return rec;
  }
  return null;
}

function findDecisionJournal(root, askId) {
  const dir = mailboxPath(root, 'events');
  if (!existsSync(dir)) return null;
  for (const name of readdirSync(dir).sort()) {
    const rec = readJson(join(dir, name));
    if (rec.type === 'decision-captured' && rec.payload?.askId === askId) return rec;
  }
  return null;
}

// ---------- enrollment / admission ----------

export function enroll(root, cfg) {
  const required = ['pilotId', 'seniorSessionId', 'executorWorktree', 'coordinationDir', 'repoCommonDir'];
  for (const key of required) {
    if (typeof cfg[key] !== 'string' || cfg[key].length === 0) {
      throw new RejectError(`enroll requires ${key}`);
    }
  }
  const coordinationAbs = resolve(cfg.coordinationDir);
  let coordinationOk = false;
  try {
    coordinationOk = lstatSync(coordinationAbs).isDirectory();
  } catch {
    coordinationOk = false;
  }
  if (!coordinationOk) {
    throw new RejectError('coordination dir does not exist or is not a directory', { coordinationDir: coordinationAbs });
  }
  // Repository binding is OBSERVED, never asserted: derive the physical git
  // common directory for both the mailbox anchor and the executor worktree and
  // compare with the declared binding.
  const anchorObserved = anchorCommonDir(root);
  if (!anchorObserved) {
    throw new RejectError('mailbox anchor is not inside an observed git repository', { mailbox: resolve(root) });
  }
  const executorAbs = resolve(cfg.executorWorktree);
  const executorObserved = gitCommonDirOf(executorAbs);
  if (!executorObserved) {
    throw new RejectError('executor worktree has no observable git repository', { executorWorktree: executorAbs });
  }
  let declared;
  try {
    declared = realpathSync(resolve(cfg.repoCommonDir));
  } catch {
    throw new RejectError('declared repo common dir does not exist', { repoCommonDir: cfg.repoCommonDir });
  }
  if (declared !== anchorObserved || declared !== executorObserved) {
    throw new RejectError('foreign repository binding: declared common dir does not match the observed anchor/executor', {
      declared, anchorObserved, executorObserved,
    });
  }
  ensureDirs(root);
  const pilot = {
    schemaVersion: 1,
    pilotId: cfg.pilotId,
    seniorSessionId: cfg.seniorSessionId,
    executorWorktree: executorAbs,
    coordinationDir: coordinationAbs,
    repoCommonDir: declared,
    observedBinding: { anchor: anchorObserved, executor: executorObserved },
    advisorSeedSource: 'live ADVISOR.md at runtime; never stored here',
    testMode: cfg.testMode === true,
    childBin: cfg.testMode === true ? resolve(cfg.childBin ?? '') : null,
    limits: { ...LIMITS },
    enrolledAt: new Date().toISOString(),
  };
  if (pilot.testMode && (!cfg.childBin || cfg.childBin.length === 0)) {
    throw new RejectError('testMode enroll requires an explicit childBin');
  }
  const { replay } = createImmutable(mailboxPath(root, 'pilot.json'), canonicalJson(pilot));
  if (replay) throw new RejectError('pilot already enrolled', { pilotId: cfg.pilotId });
  return pilot;
}

export function readCounters(root) {
  const p = mailboxPath(root, STATE, 'counters.json');
  return existsSync(p) ? readJson(p) : { ccPasses: 0, advisorCalls: 0 };
}

function bumpCounter(root, key, delta = 1) {
  const p = mailboxPath(root, STATE, 'counters.json');
  const counters = readCounters(root);
  counters[key] = (counters[key] ?? 0) + delta;
  publishAtomic(p, canonicalJson(counters));
  return counters;
}

export function offPilot(root, { actor }) {
  const artifact = {
    schemaVersion: 1,
    offAt: new Date().toISOString(),
    actor,
  };
  const { replay } = createImmutable(mailboxPath(root, STATE, 'off.json'), canonicalJson(artifact));
  return { ...artifact, replay };
}

export function readOff(root) {
  const p = mailboxPath(root, STATE, 'off.json');
  return existsSync(p) ? readJson(p) : null;
}

// Admission check. MUST run inside the operation lock (serialized with OFF).
// kind: 'mutation' | 'cc-pass' | 'cc-resume' | 'advisor-call'
export function checkAdmission(root, kind = 'mutation') {
  const pilot = readPilot(root);
  if (!pilot) throw new HoldError('pilot not enrolled');
  const off = readOff(root);
  if (off) {
    throw new HoldError('OFF committed; no new launches, resumes or dependent transitions', { offAt: off.offAt });
  }
  const now = Date.now();
  const until = Date.parse(pilot.enrolledAt) + pilot.limits.admissionWindowMs;
  if (now > until) {
    throw new HoldError('pilot admission window expired', { windowOpenUntil: new Date(until).toISOString() });
  }
  const counters = readCounters(root);
  // The CC pass cap gates RESERVATION, not admission queries: a proven
  // identical retry must be able to replay its receipt (R10) before any
  // counter limit is consulted. The cap therefore lives in reserveCcPass.
  if (kind === 'advisor-call' && counters.advisorCalls >= pilot.limits.maxAdvisorCalls) {
    throw new HoldError('advisor call limit reached', { used: counters.advisorCalls, max: pilot.limits.maxAdvisorCalls });
  }
  if (kind === 'cc-pass' || kind === 'cc-resume') {
    for (const a of listAttempts(root)) {
      if (UNRECONCILED.has(a.status)) {
        throw new HoldError(`attempt pass${a.passNumber} (${a.attemptId}) is ${a.status}; reconcile before any new launch`, {
          attemptId: a.attemptId, status: a.status,
        });
      }
    }
  }
  return { pilot, counters, windowOpenUntil: new Date(until).toISOString() };
}

// ---------- requests ----------

export function currentRequest(root, workKey) {
  const dir = mailboxPath(root, 'requests');
  if (!existsSync(dir)) return null;
  const prefix = `${workKey}.r`;
  const revs = readdirSync(dir)
    .filter((n) => n.startsWith(prefix) && n.endsWith('.json'))
    .map((n) => Number(n.slice(prefix.length, -'.json'.length)))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => b - a);
  if (revs.length === 0) return null;
  return readJson(join(dir, `${workKey}.r${revs[0]}.json`));
}

export function readRequest(root, workKey, revision) {
  const p = mailboxPath(root, 'requests', `${workKey}.r${revision}.json`);
  return existsSync(p) ? readJson(p) : null;
}

export function submitRequest(root, { workKey, revision, body, actor }) {
  checkWorkKey(workKey);
  if (!Number.isInteger(revision) || revision < 1) throw new RejectError('invalid revision');
  if (typeof body !== 'string' || body.trim().length === 0) throw new RejectError('empty request body');
  const digest = sha256(body);
  const target = mailboxPath(root, 'requests', `${workKey}.r${revision}.json`);
  if (existsSync(target)) {
    const stored = readJson(target);
    if (stored.requestDigest === digest) {
      return { ...stored, replay: true };
    }
    throw new RejectError('digest conflict under the same workKey and revision', {
      workKey, revision, storedDigest: stored.requestDigest, incomingDigest: digest,
    });
  }
  const artifact = {
    schemaVersion: 1,
    kind: 'request',
    pilotId: readPilot(root)?.pilotId ?? null,
    workKey,
    requestRevision: revision,
    requestDigest: digest,
    body,
    actor,
    submittedAt: new Date().toISOString(),
  };
  createImmutable(target, canonicalJson(artifact));
  journalAppend(root, {
    eventId: `req-${workKey}-r${revision}-${digest.slice(0, 12)}`,
    type: 'request-submitted',
    actor,
    payload: { workKey, requestRevision: revision, requestDigest: digest },
  });
  return { ...artifact, replay: false };
}

// ---------- ownership ----------

const OWNERSHIP = join(STATE, 'ownership.json');

export function readOwnership(root) {
  const p = mailboxPath(root, OWNERSHIP);
  return existsSync(p) ? readJson(p) : null;
}

export function acquireOwnership(root, { workKey, ownerToken }) {
  checkWorkKey(workKey);
  if (typeof ownerToken !== 'string' || ownerToken.length < 8) {
    throw new RejectError('owner token required (at least 8 characters)');
  }
  const p = mailboxPath(root, OWNERSHIP);
  if (existsSync(p)) {
    const stored = readJson(p);
    if (stored.workKey !== workKey) {
      throw new RejectError('one owner per pilot; foreign work item', {
        owned: stored.workKey, incoming: workKey,
      });
    }
    if (stored.ownerToken !== ownerToken) {
      throw new HoldError('work item owned by a different token; duplicate caller observes the owner', {
        workKey, ownerMasked: `${stored.ownerToken.slice(0, 4)}…`,
      });
    }
    return { ...stored, replay: true };
  }
  const artifact = {
    schemaVersion: 1,
    kind: 'ownership',
    workKey,
    ownerToken,
    acquiredAt: new Date().toISOString(),
  };
  const { replay } = createImmutable(p, canonicalJson(artifact));
  if (replay) return acquireOwnership(root, { workKey, ownerToken });
  return { ...artifact, replay: false };
}

// ---------- attempts ----------

export function listAttempts(root) {
  const dir = mailboxPath(root, 'attempts');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => n.endsWith('.json'))
    .map((n) => readJson(join(dir, n)))
    .sort((a, b) => a.passNumber - b.passNumber || a.createdAt.localeCompare(b.createdAt));
}

export function writeAttempt(root, attempt) {
  const name = `pass${String(attempt.passNumber).padStart(2, '0')}-${attempt.attemptId}.json`;
  publishAtomic(mailboxPath(root, 'attempts', name), canonicalJson(attempt));
  return attempt;
}

const UNRECONCILED = new Set(['reserved', 'unknown', 'deadline-unknown', 'interrupted']);

export function readAttempt(root, attemptId) {
  return listAttempts(root).find((a) => a.attemptId === attemptId) ?? null;
}

export function latestCompletedAttempt(root) {
  const done = listAttempts(root).filter((a) => a.status === 'completed');
  return done.length > 0 ? done[done.length - 1] : null;
}

export function reserveCcPass(root, { workKey, passNumber, sessionId, resumeFrom = null, deadlineMs, argv, prompt, pilotId = null, requestRevision = null }) {
  // The pass cap gates actual reservations only. Receipt replay resolves
  // earlier (in the admission gate) and never reaches this allocation point,
  // so a lost receipt stays recoverable at the cap (R10) while every new
  // launch — initial, rework, or fourth pass — remains bounded.
  const pilot = readPilot(root);
  const counters = readCounters(root);
  if (counters.ccPasses >= pilot.limits.maxCcPasses) {
    throw new HoldError('CC pass limit reached', { used: counters.ccPasses, max: pilot.limits.maxCcPasses });
  }
  const attemptId = randomUUID().slice(0, 8);
  const attempt = {
    schemaVersion: 1,
    kind: 'cc-attempt',
    attemptId,
    passNumber,
    workKey,
    pilotId,
    requestRevision,
    status: 'reserved',
    sessionId,
    resumeFrom,
    deadlineMs,
    argv,
    prompt,
    stdoutPath: mailboxPath(root, 'attempts-stdout', `${attemptId}.json`),
    pid: null,
    reservedAt: new Date().toISOString(),
  };
  writeAttempt(root, attempt);
  journalAppend(root, {
    eventId: `ccpass-reserved-${attemptId}`,
    type: 'cc-pass-reserved',
    actor: 'cc-owner',
    payload: { workKey, requestRevision, passNumber, sessionId, resumeFrom, deadlineMs, prompt },
  });
  return attempt;
}

// Persist the live process identity while the child is running (not only at
// completion) — OFF termination and reconciliation bind to this recorded pid.
export function recordAttemptPid(root, attemptId, pid) {
  const attempt = readAttempt(root, attemptId);
  if (!attempt) throw new RejectError('attempt not found', { attemptId });
  return writeAttempt(root, { ...attempt, pid });
}

export function completeCcPass(root, { attemptId, patch, outcome }) {
  const attempt = readAttempt(root, attemptId);
  if (!attempt) throw new RejectError('attempt not found', { attemptId });
  const merged = { ...attempt, ...patch, status: outcome, endedAt: new Date().toISOString() };
  writeAttempt(root, merged);
  journalAppend(root, {
    eventId: `ccpass-${outcome}-${attemptId}`,
    type: `cc-pass-${outcome}`,
    actor: 'cc-owner',
    payload: {
      workKey: merged.workKey,
      passNumber: merged.passNumber,
      sessionId: merged.sessionId,
      pid: merged.pid,
      exitCode: merged.exitCode ?? null,
      timedOut: merged.timedOut === true,
      verifiedEnded: merged.verifiedEnded === true,
      captureReason: merged.captureReason ?? null,
    },
    causationId: `ccpass-reserved-${attemptId}`,
  });
  return merged;
}

export function recordCcPassLaunched(root) {
  const p = mailboxPath(root, STATE, 'counters.json');
  const counters = readCounters(root);
  counters.ccPasses = (counters.ccPasses ?? 0) + 1;
  publishAtomic(p, canonicalJson(counters));
  return counters;
}

// Reconciliation is evidence-gated: a rationale records the decision, but
// recorded identity, cessation and capture evidence govern what may be marked.
// `completed` additionally requires trusted captured stdout with the expected
// session identity and model evidence. An unproven/running attempt can never
// be marked safe to advance on a rationale string alone.
export function reconcileAttempt(root, { attemptId, mark, rationale, actor, evidence }) {
  if (typeof rationale !== 'string' || rationale.length < 20) {
    throw new RejectError('reconcile requires a rationale of at least 20 characters');
  }
  if (!['abandoned', 'completed'].includes(mark)) {
    throw new RejectError('mark must be "abandoned" or "completed"', { mark });
  }
  const attempt = readAttempt(root, attemptId);
  if (!attempt) throw new RejectError('attempt not found', { attemptId });
  if (!UNRECONCILED.has(attempt.status)) {
    return { ...attempt, replay: true };
  }
  const ev = (evidence && typeof evidence === 'object') ? evidence : {};
  const cessationProven = ev.cessationProven === true;
  // Absence of a recorded pid is NOT evidence that no process started: only an
  // affirmative serialized record (spawn failure, or OFF before the serialized
  // spawn) may resolve a pid-less reservation.
  const neverStartedRecorded = ev.neverStartedRecorded === true;
  if (!cessationProven && !neverStartedRecorded) {
    throw new RejectError('reconcile requires affirmative evidence: proven cessation of a recorded pid, or a recorded never-started outcome (missing pid alone is not proof)', {
      attemptId, pid: attempt.pid ?? null, spawnOutcome: attempt.spawnOutcome ?? null,
    });
  }
  if (mark === 'completed') {
    const captureProven = ev.stdoutCaptured === true && ev.captureTrusted === true && ev.modelMatched === true;
    if (!captureProven) {
      throw new RejectError('cannot mark completed: recorded identity/capture/model evidence is insufficient', {
        attemptId, evidence: ev,
      });
    }
  }
  const merged = {
    ...attempt,
    status: mark,
    reconciledAt: new Date().toISOString(),
    reconcileRationale: rationale,
    reconcileEvidence: ev,
  };
  writeAttempt(root, merged);
  journalAppend(root, {
    eventId: `ccpass-reconciled-${attemptId}`,
    type: 'cc-pass-reconciled',
    actor,
    payload: { attemptId, mark, rationale, evidence: ev },
    causationId: `ccpass-reserved-${attemptId}`,
  });
  return merged;
}

// ---------- run admission gate (task progression) ----------

function listVerdictRecords(root, workKey) {
  const dir = mailboxPath(root, 'decisions');
  if (!existsSync(dir)) return [];
  const out = [];
  for (const n of readdirSync(dir)) {
    if (!n.startsWith('verdict-')) continue;
    const v = readJson(join(dir, n));
    if (v.kind === 'verdict' && (!workKey || v.workKey === workKey)) out.push(v);
  }
  return out;
}

function listRequestRevisions(root, workKey) {
  const dir = mailboxPath(root, 'requests');
  if (!existsSync(dir)) return [];
  const prefix = `${workKey}.r`;
  return readdirSync(dir)
    .filter((n) => n.startsWith(prefix) && n.endsWith('.json'))
    .map((n) => Number(n.slice(prefix.length, -'.json'.length)))
    .filter((n) => Number.isInteger(n) && n >= 1)
    .sort((a, b) => a - b);
}

// The launch boundary preserves ONE executor across the WHOLE work item:
// initial admission requires the current prepared request and a matching
// bounded prompt, and happens exactly once per work item — publishing a
// newer request revision alone never mints a replacement session (R8); an
// identical completed launch replays its receipt; a senior REWORK verdict
// authorizes exactly ONE successor instruction revision (the first revision
// published after the verdict), resumed on the same proven-ended session —
// it never blanket-authorizes later revisions (R9); a pending consult is an
// explicit checkpoint; acceptance is terminal for the enrolled work item
// across all revisions.
export function gateRunAdmission(root, { workKey, prompt, resume }) {
  const current = currentRequest(root, workKey);
  if (!current) {
    throw new RejectError('run requires a current prepared request; none was submitted', { workKey });
  }
  const revision = current.requestRevision;
  const openAsk = listAsks(root).find((a) => a.status === 'open'
    && a.workKey === workKey && a.requestDigest === current.requestDigest);
  if (openAsk) {
    throw new HoldError('consult checkpoint pending: the open ask must be resolved before any new pass', {
      askId: openAsk.askId,
    });
  }
  const accepted = listVerdictRecords(root, workKey).find((v) => v.verdict === 'ACCEPTED');
  if (accepted) {
    throw new HoldError('work item accepted; the accepted work item is terminal and admits no further passes on any revision', {
      workKey, acceptedRevision: accepted.requestRevision ?? null,
    });
  }
  const reportsR = listReports(root, workKey, revision);
  const reworks = listVerdictRecords(root, workKey).filter((v) => v.verdict === 'REWORK')
    .sort((a, b) => (b.requestRevision - a.requestRevision)
      || String(b.decidedAt ?? '').localeCompare(String(a.decidedAt ?? '')));
  const latestRework = reworks[0] ?? null;
  const attemptsAll = listAttempts(root).filter((a) => a.workKey === workKey);
  const completedAny = attemptsAll.filter((a) => a.status === 'completed');
  const completedR = completedAny.filter((a) => a.requestRevision === revision);
  const promptText = String(prompt).trim();
  const bodyText = String(current.body).trim();
  if (resume) {
    if (!latestRework) {
      throw new HoldError('rework pass requires a senior REWORK instruction recorded for this work item', { workKey });
    }
    const successor = listRequestRevisions(root, workKey).find((r) => r > latestRework.requestRevision);
    if (successor === undefined) {
      throw new HoldError('rework requires the next instruction revision: publish a request revision newer than the REWORK verdict', {
        workKey, verdictRevision: latestRework.requestRevision, currentRevision: revision,
      });
    }
    if (revision !== successor) {
      throw new HoldError(`the REWORK verdict on r${latestRework.requestRevision} authorizes only its successor instruction revision r${successor}, not r${revision}`, {
        workKey, verdictRevision: latestRework.requestRevision, authorizedRevision: successor, currentRevision: revision,
      });
    }
    if (promptText !== bodyText) {
      throw new RejectError('rework prompt must match the new instruction revision body', {
        workKey, requestRevision: revision,
      });
    }
    const done = completedR.filter((a) => a.resumeFrom != null && String(a.prompt ?? '').trim() === promptText);
    if (done.length > 0) return { replay: done[done.length - 1] };
    return {};
  }
  const unactionedRework = latestRework
    && listRequestRevisions(root, workKey).find((r) => r > latestRework.requestRevision) === revision
    && completedR.length === 0 && reportsR.length === 0;
  if (unactionedRework) {
    throw new HoldError('rework instructed: resume the same proven-ended session with --resume', {
      workKey, requestRevision: revision,
    });
  }
  if (reportsR.length > 0) {
    throw new HoldError('report awaits the senior decision; no new job is admitted', { workKey });
  }
  // Initial execution is a work-item lifecycle decision, not a per-revision
  // one: after any completed pass, a published revision alone admits nothing
  // and no replacement session is minted (R8).
  if (completedAny.length > 0) {
    const initial = completedAny.find((a) => a.resumeFrom == null);
    if (initial && String(initial.prompt ?? '').trim() === promptText) {
      return { replay: initial };
    }
    throw new HoldError('the work item already has a completed pass; no new job is admitted — a new request revision alone replaces nothing, continuation requires the senior report/REWORK progression and --resume', { workKey });
  }
  if (promptText !== bodyText) {
    throw new RejectError('initial pass prompt must match the prepared request body', {
      workKey, requestRevision: revision,
    });
  }
  return {};
}

// ---------- advisor capture validation ----------

// The captured advisor candidate must satisfy the identity contract supplied
// in the fork argv: advisor role, the exact ask id, and the exact bound input
// digest. Anything else keeps the ask OPEN.
export function validateAdvisorCandidate(candidateText, { askId, inputDigest }) {
  let parsed;
  try {
    parsed = JSON.parse(candidateText);
  } catch {
    return { trusted: false, reason: 'candidate-not-json' };
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return { trusted: false, reason: 'candidate-not-object' };
  }
  if (parsed.role !== 'advisor') {
    return { trusted: false, reason: 'candidate-role-mismatch', observed: parsed.role ?? null };
  }
  if (parsed.askId !== askId) {
    return { trusted: false, reason: 'candidate-ask-binding-mismatch', observed: parsed.askId ?? null };
  }
  if (parsed.inputDigest !== inputDigest) {
    return { trusted: false, reason: 'candidate-input-digest-mismatch', observed: parsed.inputDigest ?? null };
  }
  if (typeof parsed.answer !== 'string' || parsed.answer.trim().length === 0) {
    return { trusted: false, reason: 'candidate-has-no-answer' };
  }
  return { trusted: true, answer: parsed.answer };
}

// ---------- reports: structured delivery envelope ----------

function validateConsultAck(root, { consultDecisionId, applicationAck }, current) {
  if (applicationAck !== true) {
    throw new RejectError('report requires an explicit consultation application ACK', { consultDecisionId: consultDecisionId ?? null });
  }
  if (typeof consultDecisionId !== 'string' || consultDecisionId.length === 0) {
    throw new RejectError('report requires the consulted decision id');
  }
  const decPath = mailboxPath(root, 'decisions', `${consultDecisionId}.json`);
  if (!existsSync(decPath)) {
    throw new RejectError('consulted decision not found', { consultDecisionId });
  }
  const dec = readJson(decPath);
  if (dec.kind !== 'decision') {
    throw new RejectError('consulted decision id does not name a decision record', { consultDecisionId });
  }
  // Exact binding: work item, instruction revision NUMBER and content digest.
  // Repeated request content (identical digest, different revision) does not
  // make an earlier consultation current.
  if (dec.workKey !== current.workKey) {
    throw new RejectError('consulted decision belongs to a different work item', {
      consultDecisionId, decisionWorkKey: dec.workKey ?? null, currentWorkKey: current.workKey,
    });
  }
  if (dec.requestRevision !== current.requestRevision) {
    throw new RejectError('consulted decision is bound to a different instruction revision', {
      consultDecisionId, decisionRevision: dec.requestRevision ?? null, currentRevision: current.requestRevision,
    });
  }
  if (dec.requestDigest !== current.requestDigest) {
    throw new RejectError('consulted decision digest does not match the current request content', {
      consultDecisionId, currentRevision: current.requestRevision,
    });
  }
}

export function importReport(root, fields) {
  const { workKey, revision, reportId, reportStatus, body } = fields;
  checkWorkKey(workKey);
  if (!Number.isInteger(revision) || revision < 1) throw new RejectError('invalid revision');
  if (!['DONE', 'PARTIAL', 'BLOCKED'].includes(reportStatus)) {
    throw new RejectError('invalid report status', { reportStatus });
  }
  if (typeof body !== 'string' || body.trim().length === 0) throw new RejectError('empty report body');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(reportId)) throw new RejectError('invalid reportId', { reportId });
  const dest = fields.destRel
    ? safeArtifactPath(root, fields.destRel)
    : safeArtifactPath(root, `reports/${workKey}.r${revision}.${reportId}.json`);
  const ownership = readOwnership(root);
  if (!ownership || ownership.workKey !== workKey) {
    throw new RejectError('report requires an owned work item', { workKey, owned: ownership?.workKey ?? null });
  }
  if (fields.actor !== ownership.ownerToken) {
    throw new RejectError('report actor is not the work owner', { actor: fields.actor ?? null });
  }
  const current = currentRequest(root, workKey);
  if (!current || current.requestRevision !== revision) {
    throw new RejectError('stale revision: reports bind the current request revision only', {
      workKey, revision, currentRevision: current?.requestRevision ?? null,
    });
  }
  if (fields.requestDigest !== current.requestDigest) {
    throw new RejectError('report request digest mismatch: the report must bind the exact request content', {
      workKey, revision,
    });
  }
  if (fields.ownerAck !== true) {
    throw new RejectError('report requires the explicit owner acknowledgement (ownerAck)');
  }
  const validArtifacts = Array.isArray(fields.artifacts) && fields.artifacts.length > 0
    && fields.artifacts.every((a) => a && typeof a.path === 'string' && typeof a.sha256 === 'string' && /^[0-9a-f]{64}$/.test(a.sha256));
  const validEvidence = Array.isArray(fields.evidence) && fields.evidence.length > 0
    && fields.evidence.every((ev) => ev && typeof ev.command === 'string' && Number.isFinite(ev.exit));
  if (reportStatus === 'DONE') {
    // A DONE report certifies execution; a legitimate prelaunch BLOCKED report
    // may describe an absent pass, but DONE cannot exist without an owned pass,
    // and the bound pass must be THIS work item's execution of the CURRENT
    // instruction revision (an older revision's pass never certifies a newer
    // instruction, even when the request bodies — and digests — repeat).
    const pilot = readPilot(root);
    const passAttempt = fields.passId ? readAttempt(root, fields.passId) : null;
    if (!passAttempt || passAttempt.status !== 'completed') {
      throw new RejectError('DONE must bind a completed owned pass', { passId: fields.passId ?? null });
    }
    if (passAttempt.workKey !== workKey
      || (passAttempt.pilotId != null && passAttempt.pilotId !== pilot?.pilotId)
      || passAttempt.requestRevision !== revision) {
      throw new RejectError('bound pass is not the current instruction revision execution', {
        passId: fields.passId, passRevision: passAttempt.requestRevision ?? null, currentRevision: revision,
      });
    }
    if (!validArtifacts) throw new RejectError('DONE requires artifacts with sha256 digests');
    if (!validEvidence) throw new RejectError('DONE requires evidence entries (command + exit)');
    validateConsultAck(root, { consultDecisionId: fields.consultDecisionId, applicationAck: fields.applicationAck }, current);
  } else if (reportStatus === 'PARTIAL') {
    if (!validArtifacts) throw new RejectError('PARTIAL requires artifacts with sha256 digests');
    if (!validEvidence) throw new RejectError('PARTIAL requires evidence entries (command + exit)');
  } else if (reportStatus === 'BLOCKED') {
    if (typeof fields.blocker !== 'string' || fields.blocker.trim().length === 0) {
      throw new RejectError('BLOCKED requires a blocker description');
    }
  }
  const artifact = {
    schemaVersion: 1,
    kind: 'report',
    pilotId: readPilot(root)?.pilotId ?? null,
    workKey,
    requestRevision: revision,
    reportId,
    reportStatus,
    body,
    bodyDigest: sha256(body),
    envelope: {
      requestDigest: fields.requestDigest,
      ownerAck: true,
      artifacts: reportStatus === 'BLOCKED' ? (fields.artifacts ?? []) : fields.artifacts,
      evidence: reportStatus === 'BLOCKED' ? (fields.evidence ?? []) : fields.evidence,
      consultDecisionId: fields.consultDecisionId ?? null,
      applicationAck: fields.applicationAck === true,
      passId: fields.passId ?? null,
      blocker: fields.blocker ?? null,
    },
    actor: fields.actor,
    importedAt: new Date().toISOString(),
  };
  // Identical retry (timestamps reconstructed) returns the existing receipt.
  if (existsSync(dest)) {
    const storedText = readFileSync(dest, 'utf8');
    if (sameExceptVolatile(storedText, canonicalJson(artifact), ['importedAt'])) {
      return { ...JSON.parse(storedText), dest, replay: true };
    }
    throw new RejectError('immutable artifact conflict', { target: dest });
  }
  createImmutable(dest, canonicalJson(artifact));
  journalAppend(root, {
    eventId: `report-${workKey}-r${revision}-${reportId}`,
    type: 'report-imported',
    actor: artifact.actor,
    payload: { workKey, requestRevision: revision, reportId, reportStatus, replay: false },
    causationId: `req-${workKey}-r${revision}`,
  });
  return { ...artifact, dest, replay: false };
}

// ---------- asks, forks, decisions ----------

function checkAskId(askId) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(askId)) throw new RejectError('invalid askId', { askId });
  return askId;
}

// An ask is immutably bound to the current prepared request (workKey +
// revision + request digest) and to the exact question digest. Changing the
// request invalidates prior decisions: a stale ask can never advance.
export function submitAsk(root, { askId, question, actor, workKey }) {
  checkAskId(askId);
  if (typeof question !== 'string' || question.trim().length === 0) throw new RejectError('empty ask question');
  checkWorkKey(workKey);
  const current = currentRequest(root, workKey);
  if (!current) {
    throw new RejectError('ask requires a current prepared request to bind to', { workKey });
  }
  const questionDigest = sha256(question);
  const meta = {
    schemaVersion: 1,
    kind: 'ask',
    pilotId: readPilot(root)?.pilotId ?? null,
    askId,
    question,
    questionDigest,
    workKey,
    requestRevision: current.requestRevision,
    requestDigest: current.requestDigest,
    inputDigest: questionDigest,
    status: 'open',
    actor: actor ?? 'cc-owner',
    createdAt: new Date().toISOString(),
  };
  const p = mailboxPath(root, 'asks', `${askId}.json`);
  if (existsSync(p)) {
    const stored = readJson(p);
    if (stored.questionDigest === questionDigest && stored.workKey === workKey
      && stored.requestDigest === current.requestDigest) {
      return { ...stored, replay: true };
    }
    throw new RejectError('ask conflict under the same askId', { askId });
  }
  createImmutable(p, canonicalJson(meta));
  createImmutable(mailboxPath(root, 'asks', `${askId}.md`), `# Ask: ${askId}\n\n${question}\n`);
  journalAppend(root, {
    eventId: `ask-${askId}`,
    type: 'ask-published',
    actor: meta.actor,
    payload: {
      askId, questionDigest, workKey,
      requestRevision: current.requestRevision, requestDigest: current.requestDigest,
    },
  });
  return { ...meta, replay: false };
}

export function readAsk(root, askId) {
  const p = mailboxPath(root, 'asks', `${askId}.json`);
  return existsSync(p) ? readJson(p) : null;
}

function listAsks(root) {
  const dir = mailboxPath(root, 'asks');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => n.endsWith('.json'))
    .map((n) => readJson(join(dir, n)));
}

export function deriveDecisionEventId(askId, answer) {
  return `dec-${askId}-${sha256(answer).slice(0, 12)}`;
}

export function readForkRecord(root, askId) {
  const p = mailboxPath(root, 'outbox', `${askId}.fork.json`);
  return existsSync(p) ? readJson(p) : null;
}

export function reserveAdvisorFork(root, { askId, argvRedacted, candidatePath, deadlineMs }) {
  const existing = readForkRecord(root, askId);
  if (existing) {
    throw new HoldError('one fork per ask; a fork is already reserved', { askId, forkId: existing.forkId });
  }
  const fork = {
    schemaVersion: 1,
    kind: 'advisor-fork',
    forkId: randomUUID().slice(0, 8),
    askId,
    argvRedacted,
    candidatePath,
    deadlineMs,
    status: 'reserved',
    pid: null,
    reservedAt: new Date().toISOString(),
  };
  createImmutable(mailboxPath(root, 'outbox', `${askId}.fork.json`), canonicalJson(fork));
  journalAppend(root, {
    eventId: `fork-${fork.forkId}`,
    type: 'advisor-fork-reserved',
    actor: 'cc-owner',
    payload: { askId, forkId: fork.forkId, argvRedacted, candidatePath },
  });
  return fork;
}

export function recordForkCapture(root, askId, patch) {
  const fork = readForkRecord(root, askId);
  if (!fork) throw new RejectError('fork record not found', { askId });
  const merged = { ...fork, ...patch, endedAt: new Date().toISOString() };
  publishAtomic(mailboxPath(root, 'outbox', `${askId}.fork.json`), canonicalJson(merged));
  journalAppend(root, {
    eventId: `fork-${merged.status}-${fork.forkId}`,
    type: `advisor-fork-${merged.status}`,
    actor: 'cc-owner',
    payload: { askId, forkId: fork.forkId, captureReason: merged.captureReason ?? null },
    causationId: `fork-${fork.forkId}`,
  });
  return merged;
}

// Persist the live advisor-fork process identity while the fork runs, so OFF
// termination binds to the exact process (the advisor route is a controlled
// owned child too).
export function recordForkPid(root, askId, pid) {
  const fork = readForkRecord(root, askId);
  if (!fork) throw new RejectError('fork record not found', { askId });
  const merged = { ...fork, pid };
  publishAtomic(mailboxPath(root, 'outbox', `${askId}.fork.json`), canonicalJson(merged));
  return merged;
}

export function listForkRecords(root) {
  const dir = mailboxPath(root, 'outbox');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => n.endsWith('.fork.json'))
    .map((n) => readJson(join(dir, n)));
}

function extractAnswer(md) {
  const marker = '\n## Answer\n\n';
  const i = md.indexOf(marker);
  if (i < 0) return null;
  return md.slice(i + marker.length).replace(/\n+$/, '');
}

// Journal-before-Answer: the decision event (carrying the FULL bound answer)
// lands first; the decision record, the Answer section and the receipt follow.
// Recovery replays the JOURNALED answer — the mutable outbox candidate is only
// read when no journal event exists, and only after the reserved fork receipt
// with a TRUSTED capture status and the candidate's identity contract are
// validated. Before any state commit or receipt, existing decision-record and
// Answer bytes are verified against the resolved decision: conflicting partial
// progress rejects/HOLDs with evidence preserved, never overwritten. A stale
// ask (bound to a superseded request revision) can never advance.
export function importDecision(root, { askId, actor = 'bridge' }) {
  checkAskId(askId);
  const ask = readAsk(root, askId);
  if (!ask) throw new RejectError('ask not found', { askId });
  if (ask.status === 'answered') {
    const decPath = mailboxPath(root, 'decisions', `${ask.decisionId}.json`);
    if (!existsSync(decPath)) {
      throw new RejectError('committed decision record missing', { askId });
    }
    const dec = readJson(decPath);
    if (dec.answerDigest !== ask.answerDigest) {
      throw new RejectError('committed decision is inconsistent with the ask record', { askId });
    }
    const md = readFileSync(mailboxPath(root, 'asks', `${askId}.md`), 'utf8');
    const answerText = extractAnswer(md);
    if (answerText === null || sha256(answerText) !== ask.answerDigest) {
      throw new RejectError('committed Answer section does not match the committed decision', { askId });
    }
    return { decisionId: ask.decisionId, answerDigest: ask.answerDigest, replay: true };
  }
  const current = ask.workKey ? currentRequest(root, ask.workKey) : null;
  if (ask.workKey && (!current || current.requestDigest !== ask.requestDigest)) {
    throw new HoldError('ask is bound to a superseded request revision; the prior decision is invalidated — consult again on the current revision', {
      askId,
      boundRevision: ask.requestRevision ?? null,
      currentRevision: current?.requestRevision ?? null,
    });
  }
  const existingJournal = findDecisionJournal(root, askId);
  let answer;
  let answerDigest;
  let causationId = null;
  let forkId = null;
  if (existingJournal) {
    answer = existingJournal.payload?.answer;
    answerDigest = existingJournal.payload?.answerDigest;
    if (typeof answer !== 'string' || sha256(answer) !== answerDigest) {
      throw new RejectError('journaled answer digest mismatch', { askId });
    }
    causationId = existingJournal.causationId ?? null;
    forkId = existingJournal.payload?.forkId ?? null;
  } else {
    const fork = readForkRecord(root, askId);
    if (!fork) {
      throw new HoldError('no reserved advisor fork for this ask; an unreserved capture is refused', { askId });
    }
    // The recorded lifecycle receipt governs: a failed, timed-out, interrupted
    // or not-yet-completed capture stays OPEN/HOLD until evidence-gated
    // reconciliation. Candidate bytes alone never override it.
    if (fork.status !== 'captured') {
      throw new HoldError(`advisor fork receipt is '${fork.status}'${fork.captureReason ? ` (${fork.captureReason})` : ''}; an invalid or uncertain capture cannot become a decision through import`, {
        askId, forkStatus: fork.status, forkId: fork.forkId,
      });
    }
    const candidatePath = mailboxPath(root, 'outbox', `${askId}.candidate.json`);
    if (!existsSync(candidatePath)) {
      throw new HoldError('advisor capture missing; ask stays OPEN', { askId, candidatePath });
    }
    let candidateText;
    try {
      candidateText = readFileSync(candidatePath, 'utf8');
    } catch {
      throw new HoldError('advisor capture is unreadable; ask stays OPEN', { askId });
    }
    const parsed = validateAdvisorCandidate(candidateText, { askId, inputDigest: ask.inputDigest });
    if (!parsed.trusted) {
      throw new HoldError(`advisor capture rejected (${parsed.reason}); ask stays OPEN`, { askId, reason: parsed.reason });
    }
    answer = parsed.answer;
    answerDigest = sha256(answer);
    forkId = fork.forkId;
    causationId = `fork-${fork.forkId}`;
  }
  const eventId = deriveDecisionEventId(askId, answer);
  // Pre-commit consistency: any existing decision record and any existing
  // Answer bytes must match the resolved decision BEFORE the ask state moves
  // or a receipt is issued. Conflicting partial progress is preserved.
  const decPath = mailboxPath(root, 'decisions', `${eventId}.json`);
  if (existsSync(decPath)) {
    const existingDec = readJson(decPath);
    if (existingDec.answerDigest !== answerDigest) {
      throw new RejectError('existing decision record conflicts with the resolved answer', { askId, decisionId: eventId });
    }
  }
  const mdPath = mailboxPath(root, 'asks', `${askId}.md`);
  const md = readFileSync(mdPath, 'utf8');
  const existingAnswer = extractAnswer(md);
  if (existingAnswer !== null && sha256(existingAnswer) !== answerDigest) {
    throw new HoldError('conflicting Answer bytes already present; evidence preserved — resolve manually before import', {
      askId, existingAnswerDigest: sha256(existingAnswer), resolvedAnswerDigest: answerDigest,
    });
  }
  if (!existingJournal) {
    journalAppend(root, {
      eventId,
      type: 'decision-captured',
      actor,
      payload: { askId, answerDigest, answer, requestDigest: ask.requestDigest, forkId },
      causationId,
    });
  }
  // decision record (deterministic content — crash-safe to recreate)
  if (!existsSync(decPath)) {
    createImmutable(decPath, canonicalJson({
      schemaVersion: 1,
      kind: 'decision',
      decisionId: eventId,
      askId,
      answerDigest,
      answer,
      workKey: ask.workKey,
      requestRevision: ask.requestRevision,
      requestDigest: ask.requestDigest,
      forkId,
    }));
  }
  // Answer into the ask file (idempotent)
  if (!md.includes('\n## Answer\n')) {
    publishAtomic(mdPath, `${md}\n## Answer\n\n${answer}\n`);
  }
  // ask state flips to answered
  publishAtomic(mailboxPath(root, 'asks', `${askId}.json`), canonicalJson({
    ...ask,
    status: 'answered',
    answerDigest,
    decisionId: eventId,
    answeredAt: new Date().toISOString(),
  }));
  return { decisionId: eventId, answerDigest, replay: Boolean(existingJournal) };
}

// ---------- verdicts ----------

export function listReports(root, workKey, revision) {
  const dir = mailboxPath(root, 'reports');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => n.startsWith(`${workKey}.r${revision}.`) && n.endsWith('.json'))
    .map((n) => readJson(join(dir, n)));
}

export function findReport(root, reportId) {
  const dir = mailboxPath(root, 'reports');
  if (!existsSync(dir)) return null;
  for (const n of readdirSync(dir)) {
    if (n.endsWith(`.${reportId}.json`)) return readJson(join(dir, n));
  }
  return null;
}

export function currentWorkKey(root) {
  const dir = mailboxPath(root, 'requests');
  if (!existsSync(dir)) return null;
  const keys = new Set(readdirSync(dir)
    .map((n) => (n.match(/^(.+)\.r\d+\.json$/) ?? [])[1]))
    .keys();
  return keys.next().value ?? null;
}

export function recordVerdict(root, { reportId, verdict, criteria = null, actor }) {
  const pilot = readPilot(root);
  if (!pilot) throw new HoldError('pilot not enrolled');
  const off = readOff(root);
  if (off) {
    throw new HoldError('OFF committed; acceptance and dependent transitions are blocked', { offAt: off.offAt });
  }
  if (actor !== pilot.seniorSessionId) {
    throw new RejectError('decide is the senior acceptance session alone', { actor });
  }
  if (!['ACCEPTED', 'REWORK', 'OPERATOR_REQUIRED'].includes(verdict)) {
    throw new RejectError('invalid verdict', { verdict });
  }
  const report = findReport(root, reportId);
  if (!report) throw new RejectError('report not found', { reportId });
  const current = currentRequest(root, report.workKey);
  if (!current || current.requestRevision !== report.requestRevision) {
    throw new RejectError('stale revision: this report cannot close the current revision', {
      reportId,
      reportRevision: report.requestRevision,
      currentRevision: current?.requestRevision ?? null,
    });
  }
  const record = {
    schemaVersion: 1,
    kind: 'verdict',
    reportId,
    reportDigest: report.bodyDigest,
    verdict,
    criteria: criteria ?? null,
    workKey: report.workKey,
    requestRevision: report.requestRevision,
    decidedAt: new Date().toISOString(),
  };
  const vPath = mailboxPath(root, 'decisions', `verdict-${reportId}.json`);
  if (existsSync(vPath)) {
    const stored = readJson(vPath);
    if (stored.reportDigest === record.reportDigest && stored.verdict === verdict
      && isDeepStrictEqual(stored.criteria ?? null, criteria ?? null)) {
      return { ...stored, replay: true };
    }
    throw new RejectError('verdict conflict under the same report', { reportId });
  }
  createImmutable(vPath, canonicalJson(record));
  journalAppend(root, {
    eventId: `verdict-${reportId}-${verdict}`,
    type: 'senior-verdict',
    actor,
    payload: { reportId, reportDigest: record.reportDigest, verdict, requestRevision: record.requestRevision },
    causationId: `report-${report.workKey}-r${record.requestRevision}-${reportId}`,
  });
  return { ...record, replay: false };
}

export function readVerdict(root, reportId) {
  const p = mailboxPath(root, 'decisions', `verdict-${reportId}.json`);
  return existsSync(p) ? readJson(p) : null;
}

export function recordAdvisorCallLaunched(root) {
  const p = mailboxPath(root, STATE, 'counters.json');
  const counters = readCounters(root);
  counters.advisorCalls = (counters.advisorCalls ?? 0) + 1;
  publishAtomic(p, canonicalJson(counters));
  return counters;
}

// ---------- status ----------

export function status(root) {
  const pilot = readPilot(root);
  if (!pilot) {
    return { enrolled: false, schemaVersion: 1 };
  }
  const holdReasons = [];
  if (opLockPresent(root)) holdReasons.push('operation lock present; reconcile to clear');
  const attempts = listAttempts(root);
  for (const a of attempts) {
    if (UNRECONCILED.has(a.status)) {
      holdReasons.push(`attempt pass${a.passNumber} (${a.attemptId}) is ${a.status}; reconcile before any new launch`);
    }
  }
  const counters = readCounters(root);
  const off = readOff(root);
  const now = Date.now();
  const windowOpenUntil = Date.parse(pilot.enrolledAt) + pilot.limits.admissionWindowMs;
  const workKey = currentWorkKey(root);
  let taskState = 'none';
  if (workKey) {
    const current = currentRequest(root, workKey);
    const reports = current ? listReports(root, workKey, current.requestRevision) : [];
    const accepted = reports.some((r) => readVerdict(root, r.reportId)?.verdict === 'ACCEPTED');
    const consultPending = Boolean(current) && listAsks(root).some((a) => a.status === 'open'
      && a.workKey === workKey && a.requestDigest === current.requestDigest);
    if (accepted) taskState = 'accepted';
    else if (reports.length > 0) taskState = 'reported';
    else if (consultPending) taskState = 'consult-pending';
    else if (attempts.some((a) => a.status === 'completed')) taskState = 'awaiting-report';
    else taskState = 'prepared';
  }
  return {
    schemaVersion: 1,
    enrolled: true,
    pilotId: pilot.pilotId,
    testMode: pilot.testMode,
    off: Boolean(off),
    offAt: off?.offAt ?? null,
    hold: holdReasons.length > 0,
    holdReasons,
    ownership: readOwnership(root),
    counters,
    limits: pilot.limits,
    taskState,
    admission: {
      windowOpenUntil: new Date(windowOpenUntil).toISOString(),
      expired: now > windowOpenUntil,
    },
    attempts,
  };
}
