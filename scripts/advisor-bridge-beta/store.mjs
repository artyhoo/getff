// Advisor bridge beta — local pilot state store.
// Deterministic, dependency-free, synchronous. See
// docs/superpowers/specs/2026-10-06-advisor-reverse-bridge-tracer-design.md (behavior contract).

import {
  closeSync, existsSync, lstatSync, linkSync, mkdirSync, openSync,
  readFileSync, readdirSync, realpathSync, renameSync, unlinkSync, writeFileSync,
} from 'node:fs';

import { createHash, randomUUID } from 'node:crypto';
import { basename, join, join as pathJoin, resolve, sep } from 'node:path';

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

export function readPilot(root) {
  const p = mailboxPath(root, 'pilot.json');
  if (!existsSync(p)) return null;
  return readJson(p);
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
export function reconcileOpLock(root, { actor, rationale }) {
  if (typeof rationale !== 'string' || rationale.length < 20) {
    throw new RejectError('reconcile requires a rationale of at least 20 characters');
  }
  const lockPath = mailboxPath(root, LOCK);
  if (!existsSync(lockPath)) return { removed: false };
  const stale = readFileSync(lockPath, 'utf8');
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

export function journalAppend(root, { eventId, type, actor, payload, causationId = null }) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(eventId)) {
    throw new RejectError('invalid eventId', { eventId });
  }
  const dir = mailboxPath(root, 'events');
  mkdirSync(dir, { recursive: true });
  for (const name of readdirSync(dir)) {
    const existing = readJson(join(dir, name));
    if (existing.eventId === eventId) {
      return { seq: existing.seq, eventId, replay: true };
    }
    if (existing.eventId !== eventId && existing.digestCollisionGuard && existing.digestCollisionGuard === payload?.digestCollisionGuard) {
      throw new RejectError('event ID conflict', { eventId });
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

// ---------- enrollment / admission ----------

export function enroll(root, cfg) {
  const required = ['pilotId', 'seniorSessionId', 'executorWorktree', 'coordinationDir', 'repoCommonDir'];
  for (const key of required) {
    if (typeof cfg[key] !== 'string' || cfg[key].length === 0) {
      throw new RejectError(`enroll requires ${key}`);
    }
  }
  ensureDirs(root);
  const pilot = {
    schemaVersion: 1,
    pilotId: cfg.pilotId,
    seniorSessionId: cfg.seniorSessionId,
    executorWorktree: resolve(cfg.executorWorktree),
    coordinationDir: resolve(cfg.coordinationDir),
    repoCommonDir: resolve(cfg.repoCommonDir),
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
// kind: 'mutation' | 'cc-pass' | 'advisor-call'
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
  if ((kind === 'cc-pass' || kind === 'cc-resume') && counters.ccPasses >= pilot.limits.maxCcPasses) {
    throw new HoldError('CC pass limit reached', { used: counters.ccPasses, max: pilot.limits.maxCcPasses });
  }
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

const UNRECONCILED = new Set(['reserved', 'unknown', 'deadline-unknown']);

export function readAttempt(root, attemptId) {
  return listAttempts(root).find((a) => a.attemptId === attemptId) ?? null;
}

export function latestCompletedAttempt(root) {
  const done = listAttempts(root).filter((a) => a.status === 'completed');
  return done.length > 0 ? done[done.length - 1] : null;
}

export function reserveCcPass(root, { workKey, passNumber, sessionId, resumeFrom = null, deadlineMs, argv }) {
  const attemptId = randomUUID().slice(0, 8);
  const attempt = {
    schemaVersion: 1,
    kind: 'cc-attempt',
    attemptId,
    passNumber,
    workKey,
    status: 'reserved',
    sessionId,
    resumeFrom,
    deadlineMs,
    argv,
    stdoutPath: mailboxPath(root, 'attempts-stdout', `${attemptId}.json`),
    pid: null,
    reservedAt: new Date().toISOString(),
  };
  writeAttempt(root, attempt);
  journalAppend(root, {
    eventId: `ccpass-reserved-${attemptId}`,
    type: 'cc-pass-reserved',
    actor: 'cc-owner',
    payload: { workKey, passNumber, sessionId, resumeFrom, deadlineMs, argv },
  });
  return attempt;
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

export function reconcileAttempt(root, { attemptId, mark, rationale, actor }) {
  if (typeof rationale !== 'string' || rationale.length < 20) {
    throw new RejectError('reconcile requires a rationale of at least 20 characters');
  }
  if (!['completed', 'unknown'].includes(mark)) {
    throw new RejectError('mark must be "completed" or "unknown"', { mark });
  }
  const attempt = readAttempt(root, attemptId);
  if (!attempt) throw new RejectError('attempt not found', { attemptId });
  if (!UNRECONCILED.has(attempt.status)) {
    return { ...attempt, replay: true };
  }
  const merged = {
    ...attempt,
    status: mark,
    reconciledAt: new Date().toISOString(),
    reconcileRationale: rationale,
  };
  writeAttempt(root, merged);
  journalAppend(root, {
    eventId: `ccpass-reconciled-${attemptId}`,
    type: 'cc-pass-reconciled',
    actor,
    payload: { attemptId, mark, rationale },
    causationId: `ccpass-reserved-${attemptId}`,
  });
  return merged;
}

// ---------- reports ----------

export function importReport(root, { workKey, revision, reportId, reportStatus, body, actor, destRel = null }) {
  checkWorkKey(workKey);
  if (!Number.isInteger(revision) || revision < 1) throw new RejectError('invalid revision');
  if (!['DONE', 'PARTIAL', 'BLOCKED'].includes(reportStatus)) {
    throw new RejectError('invalid report status', { reportStatus });
  }
  if (typeof body !== 'string' || body.trim().length === 0) throw new RejectError('empty report body');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(reportId)) throw new RejectError('invalid reportId', { reportId });
  const dest = destRel
    ? safeArtifactPath(root, destRel)
    : safeArtifactPath(root, `reports/${workKey}.r${revision}.${reportId}.json`);
  const current = currentRequest(root, workKey);
  if (current && current.requestRevision !== revision) {
    throw new RejectError('stale revision: reports bind the current request revision only', {
      workKey, revision, currentRevision: current.requestRevision,
    });
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
    actor: actor ?? 'cc-owner',
    importedAt: new Date().toISOString(),
  };
  const { replay } = createImmutable(dest, canonicalJson(artifact));
  journalAppend(root, {
    eventId: `report-${workKey}-r${revision}-${reportId}`,
    type: 'report-imported',
    actor: artifact.actor,
    payload: { workKey, requestRevision: revision, reportId, reportStatus, replay },
    causationId: `req-${workKey}-r${revision}`,
  });
  return { ...artifact, dest, replay };
}

// ---------- asks, forks, decisions ----------

function checkAskId(askId) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(askId)) throw new RejectError('invalid askId', { askId });
  return askId;
}

export function submitAsk(root, { askId, question, actor }) {
  checkAskId(askId);
  if (typeof question !== 'string' || question.trim().length === 0) throw new RejectError('empty ask question');
  const questionDigest = sha256(question);
  const meta = {
    schemaVersion: 1,
    kind: 'ask',
    pilotId: readPilot(root)?.pilotId ?? null,
    askId,
    question,
    questionDigest,
    status: 'open',
    actor: actor ?? 'cc-owner',
    createdAt: new Date().toISOString(),
  };
  const { replay } = createImmutable(mailboxPath(root, 'asks', `${askId}.json`), canonicalJson(meta));
  if (replay) return { ...readJson(mailboxPath(root, 'asks', `${askId}.json`)), replay: true };
  createImmutable(mailboxPath(root, 'asks', `${askId}.md`), `# Ask: ${askId}\n\n${question}\n`);
  journalAppend(root, {
    eventId: `ask-${askId}`,
    type: 'ask-published',
    actor: meta.actor,
    payload: { askId, questionDigest },
  });
  return { ...meta, replay: false };
}

export function readAsk(root, askId) {
  const p = mailboxPath(root, 'asks', `${askId}.json`);
  return existsSync(p) ? readJson(p) : null;
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

// Journal-before-Answer: the decision event lands first; the Answer section and
// the receipt follow. A crash between steps replays idempotently — never a
// second fork.
export function importDecision(root, { askId, actor = 'bridge' }) {
  checkAskId(askId);
  const ask = readAsk(root, askId);
  if (!ask) throw new RejectError('ask not found', { askId });
  if (ask.status === 'answered') {
    return { decisionId: ask.decisionId, answerDigest: ask.answerDigest, replay: true };
  }
  const candidatePath = mailboxPath(root, 'outbox', `${askId}.candidate.json`);
  if (!existsSync(candidatePath)) {
    throw new HoldError('advisor capture missing; ask stays OPEN', { askId, candidatePath });
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(candidatePath, 'utf8'));
  } catch {
    throw new HoldError('advisor capture is not valid JSON; ask stays OPEN', { askId });
  }
  const answer = typeof parsed === 'object' && parsed !== null ? parsed.answer : undefined;
  if (typeof answer !== 'string' || answer.trim().length === 0) {
    throw new HoldError('advisor capture has no answer; ask stays OPEN', { askId });
  }
  const answerDigest = sha256(answer);
  const eventId = deriveDecisionEventId(askId, answer);
  // 1. durable journal event FIRST
  const existing = journalFind(root, eventId);
  if (!existing) {
    journalAppend(root, {
      eventId,
      type: 'decision-captured',
      actor,
      payload: { askId, answerDigest },
      causationId: readForkRecord(root, askId)?.forkId ? `fork-${readForkRecord(root, askId).forkId}` : null,
    });
  }
  // 2. decisions record (crash window: created here if absent)
  const decPath = mailboxPath(root, 'decisions', `${eventId}.json`);
  if (!existsSync(decPath)) {
    createImmutable(decPath, canonicalJson({
      schemaVersion: 1,
      kind: 'decision',
      decisionId: eventId,
      askId,
      answerDigest,
      answer,
    }));
  }
  // 3. Answer into the ask file (idempotent)
  const mdPath = mailboxPath(root, 'asks', `${askId}.md`);
  const md = readFileSync(mdPath, 'utf8');
  if (!md.includes('\n## Answer\n')) {
    publishAtomic(mdPath, `${md}\n## Answer\n\n${answer}\n`);
  }
  // 4. ask state flips to answered
  publishAtomic(mailboxPath(root, 'asks', `${askId}.json`), canonicalJson({
    ...ask,
    status: 'answered',
    answerDigest,
    decisionId: eventId,
    answeredAt: new Date().toISOString(),
  }));
  return { decisionId: eventId, answerDigest, replay: Boolean(existing) };
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
    criteria,
    workKey: report.workKey,
    requestRevision: report.requestRevision,
    decidedAt: new Date().toISOString(),
  };
  createImmutable(mailboxPath(root, 'decisions', `verdict-${reportId}.json`), canonicalJson(record));
  journalAppend(root, {
    eventId: `verdict-${reportId}-${verdict}`,
    type: 'senior-verdict',
    actor,
    payload: { reportId, reportDigest: record.reportDigest, verdict, requestRevision: record.requestRevision },
    causationId: `report-${report.workKey}-r${record.requestRevision}-${reportId}`,
  });
  return record;
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
    if (accepted) taskState = 'accepted';
    else if (reports.length > 0) taskState = 'reported';
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
