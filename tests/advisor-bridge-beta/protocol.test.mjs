import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, symlinkSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const REPO = resolve(join(fileURLToPath(import.meta.url), '..', '..', '..'));
const CLI = join(REPO, 'scripts', 'advisor-bridge-beta', 'cli.mjs');

const SENIOR = '01a11094-b236-7553-841d-1c5c998e2393';
const WORK_KEY = 'cap-card';
const OWNER = 'tok-cc-1';
const REQUEST_BODY = 'scope: capability card; checks: help evidence';

const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

// A physical git-shaped environment: repo common dir, an executor worktree of
// the SAME repo (gitdir pointer + commondir file, like real git writes), a
// coordination dir, and the mailbox nested under the repo (the anchor).
function mkEnv() {
  const root = mkdtempSync(join(tmpdir(), 'ab-beta-'));
  const repo = join(root, 'repo');
  const cb = join(repo, '.git');
  mkdirSync(join(cb, 'objects'), { recursive: true });
  mkdirSync(join(cb, 'refs'), { recursive: true });
  writeFileSync(join(cb, 'HEAD'), 'ref: refs/heads/main\n');
  const coord = join(root, 'coordination');
  mkdirSync(coord, { recursive: true });
  const mailbox = join(repo, '.claude', 'advisor-bridge-beta', 'p1');
  mkdirSync(mailbox, { recursive: true });
  const wt = join(root, 'wt');
  mkdirSync(wt, { recursive: true });
  const gd = join(cb, 'worktrees', 'w1');
  mkdirSync(gd, { recursive: true });
  writeFileSync(join(wt, '.git'), `gitdir: ${gd}\n`);
  writeFileSync(join(gd, 'commondir'), `${cb}\n`);
  return { root, repo, cb, coord, mailbox, wt };
}

function cli(mailbox, args, { expectCode = 0, env } = {}) {
  let out, err, code = 0;
  try {
    out = execFileSync(process.execPath, [CLI, '--mailbox', mailbox, ...args], {
      encoding: 'utf8',
      timeout: 30000,
      env: env ?? { ...process.env },
    });
  } catch (e) {
    code = e.status ?? 1;
    out = e.stdout ?? '';
    err = e.stderr ?? '';
  }
  if (expectCode !== null) assert.equal(code, expectCode, `cli ${args.join(' ')} exit ${code}\nstdout:${out}\nstderr:${err}`);
  return { code, out, err };
}

function cliAsync(mailbox, args, env) {
  return new Promise((resolveP) => {
    const child = spawn(process.execPath, [CLI, '--mailbox', mailbox, ...args], { env });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('close', (code) => resolveP({ code, out, err }));
  });
}

async function waitFor(fn, ms = 5000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (fn()) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
}

function enrollArgs(env, extra = []) {
  return ['enroll', '--pilot-id', 'pilot-test-1', '--senior-session', SENIOR,
    '--executor-worktree', env.wt, '--coordination-dir', env.coord,
    '--repo-common-dir', env.cb, ...extra];
}

const FAKE_CHILD = `import { appendFileSync, writeFileSync } from 'node:fs';
const args = process.argv.slice(2);
const mode = process.env.AB_FAKE_MODE ?? 'ok';
appendFileSync(process.env.AB_CHILD_LOG, JSON.stringify(args) + '\\n');
const o = args.indexOf('-o');
if (o >= 0) {
  if (mode === 'advisor-nooutput') { process.exit(0); }
  if (mode === 'advisor-sleep') {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Number(process.env.AB_FAKE_SLEEP_MS ?? '8000'));
    writeFileSync(args[o + 1], JSON.stringify({ role: 'advisor', askId: process.env.AB_FAKE_ASK_ID ?? 'unknown', inputDigest: process.env.AB_FAKE_INPUT_DIGEST ?? 'unknown', answer: process.env.AB_FAKE_ANSWER ?? 'JUDGED: late' }));
    process.exit(0);
  }
  if (mode === 'advisor-wrongdigest') {
    writeFileSync(args[o + 1], JSON.stringify({ role: 'advisor', askId: process.env.AB_FAKE_ASK_ID, inputDigest: '0'.repeat(64), answer: 'wrong binding' }));
    process.exit(0);
  }
  if (mode === 'advisor-wrongrole') {
    writeFileSync(args[o + 1], JSON.stringify({ role: 'worker', askId: process.env.AB_FAKE_ASK_ID, inputDigest: process.env.AB_FAKE_INPUT_DIGEST, answer: 'worker speaking' }));
    process.exit(0);
  }
  writeFileSync(args[o + 1], JSON.stringify({
    role: 'advisor',
    askId: process.env.AB_FAKE_ASK_ID ?? 'unknown',
    inputDigest: process.env.AB_FAKE_INPUT_DIGEST ?? 'unknown',
    answer: process.env.AB_FAKE_ANSWER ?? 'JUDGED: route OK',
  }));
  process.exit(0);
}
if (mode === 'sleep') {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Number(process.env.AB_FAKE_SLEEP_MS ?? '5000'));
  process.exit(9);
}
if (mode === 'no-json') { process.stdout.write('garbage not json\\n'); process.exit(0); }
if (mode === 'exit1') { process.exit(1); }
const sidIdx = args.indexOf('--session-id');
const resIdx = args.indexOf('--resume');
const sid = sidIdx >= 0 ? args[sidIdx + 1] : (resIdx >= 0 ? args[resIdx + 1] : 'unknown');
const model = process.env.AB_FAKE_MODEL ?? 'glm-5.3';
process.stdout.write(JSON.stringify({ session_id: sid, result: 'OK', is_error: false, modelUsage: { [model]: {} } }) + '\\n');
process.exit(0);
`;

function enrollTestMode(env, extra = []) {
  const childBin = join(env.root, 'fake-child.mjs');
  writeFileSync(childBin, FAKE_CHILD);
  const log = join(env.root, 'child-log.ndjson');
  return {
    childBin,
    log,
    env: { ...process.env, AB_CHILD_LOG: log },
    args: enrollArgs(env, ['--test-mode', '--child-bin', childBin, ...extra]),
  };
}

function readChildLog(log) {
  if (!existsSync(log)) return [];
  return readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

function attemptFiles(mb) {
  const dir = join(mb, 'attempts');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((n) => n.endsWith('.json')).sort()
    .map((n) => JSON.parse(readFileSync(join(dir, n), 'utf8')));
}

function latestAttemptFile(mb) {
  const files = attemptFiles(mb);
  assert.ok(files.length >= 1, 'expected at least one attempt file');
  return files[files.length - 1];
}

// test-mode enroll + prepared request r1 + ownership
function setup({ body = REQUEST_BODY } = {}) {
  const e = mkEnv();
  const t = enrollTestMode(e);
  cli(e.mailbox, t.args);
  let request = null;
  if (body !== null) {
    request = JSON.parse(cli(e.mailbox, ['request', '--work-key', WORK_KEY, '--revision', '1', '--body', body]).out);
    cli(e.mailbox, ['own', '--work-key', WORK_KEY, '--owner-token', OWNER]);
  }
  return { e, t, request };
}

const runArgs = (prompt = REQUEST_BODY, extra = [], deadlineMs = '15000') => ['run', '--work-key', WORK_KEY,
  '--owner-token', OWNER, '--prompt', prompt, ...extra, '--deadline-ms', deadlineMs];

const askArgs = (askId = 'route-judgement', question = 'Judge the collected evidence for the chosen route.') =>
  ['ask', '--ask-id', askId, '--question', question, '--work-key', WORK_KEY];

function reportArgs({ reportId = 'rep-1', revision = '1', status, body = 'REPORT body', digest, actor = OWNER, extra = [] }) {
  return ['report-import', '--work-key', WORK_KEY, '--revision', revision, '--report-id', reportId,
    '--status', status, '--body', body, '--request-digest', digest, '--actor', actor, ...extra];
}

const PARTIAL_EXTRA = ['--artifact', `capability-card.md=${sha('capability card body')}`,
  '--evidence', 'node --test=>0', '--owner-ack'];
const DONE_EXTRA = (attemptId, decisionId) => ['--artifact', `capability-card.md=${sha('capability card body')}`,
  '--evidence', 'node --test=>0', '--pass-id', attemptId,
  '--consult-decision', decisionId, '--application-ack', '--owner-ack'];

// ---------- enrollment and binding ----------

test('enroll creates pilot config bound to observed repo identity; second enroll is rejected', () => {
  const e = mkEnv();
  const r = JSON.parse(cli(e.mailbox, enrollArgs(e)).out);
  assert.equal(r.schemaVersion, 1);
  assert.equal(r.pilotId, 'pilot-test-1');
  assert.equal(r.limits.maxCcPasses, 3);
  assert.equal(r.limits.maxAdvisorCalls, 2);
  assert.equal(r.limits.processDeadlineMs, 20 * 60 * 1000);
  assert.equal(r.limits.admissionWindowMs, 60 * 60 * 1000);
  assert.ok(existsSync(join(e.mailbox, 'pilot.json')));
  cli(e.mailbox, enrollArgs(e), { expectCode: 4 });
});

test('S6: enrollment observes physical git identity — foreign/nonexistent/anchorless bindings are rejected', () => {
  // declared repo common dir does not exist
  const e1 = mkEnv();
  const r1 = cli(e1.mailbox, ['enroll', '--pilot-id', 'p1', '--senior-session', SENIOR,
    '--executor-worktree', e1.wt, '--coordination-dir', e1.coord,
    '--repo-common-dir', '/tmp/not-observed-git-xyz'], { expectCode: 4 });
  assert.match(r1.err, /does not exist|foreign|observed/i);
  // declared common dir belongs to a DIFFERENT repo than the executor worktree
  const e2 = mkEnv();
  const foreign = mkEnv();
  const r2 = cli(e2.mailbox, enrollArgs(e2, []).slice(0, -2)
    .concat(['--repo-common-dir', foreign.cb]), { expectCode: 4 });
  assert.match(r2.err, /foreign|mismatch|observed/i);
  // executor worktree without an observable .git
  const e3 = mkEnv();
  rmSync(join(e3.wt, '.git'));
  const r3 = cli(e3.mailbox, enrollArgs(e3), { expectCode: 4 });
  assert.match(r3.err, /git|observable/i);
  // coordination dir missing
  const e4 = mkEnv();
  rmSync(e4.coord, { recursive: true });
  const r4 = cli(e4.mailbox, enrollArgs(e4), { expectCode: 4 });
  assert.match(r4.err, /coordination/i);
  // mailbox anchor is not inside any git repository
  const bare = mkdtempSync(join(tmpdir(), 'ab-norepo-'));
  const r5 = cli(bare, ['enroll', '--pilot-id', 'p1', '--senior-session', SENIOR,
    '--executor-worktree', bare, '--coordination-dir', bare,
    '--repo-common-dir', bare], { expectCode: 4 });
  assert.match(r5.err, /anchor|git|observed/i);
});

test('status reports enrolled pilot with zeroed counters, open admission and taskState none', () => {
  const e = mkEnv();
  cli(e.mailbox, enrollArgs(e));
  const s = JSON.parse(cli(e.mailbox, ['status']).out);
  assert.equal(s.enrolled, true);
  assert.equal(s.off, false);
  assert.equal(s.counters.ccPasses, 0);
  assert.equal(s.counters.advisorCalls, 0);
  assert.equal(s.ownership, null);
  assert.equal(s.taskState, 'none');
});

// ---------- requests / ownership / locks / paths ----------

test('request submit binds digest; identical replay returns same receipt; changed bytes under same ID are rejected', () => {
  const e = mkEnv();
  cli(e.mailbox, enrollArgs(e));
  const body = REQUEST_BODY;
  const first = JSON.parse(cli(e.mailbox, ['request', '--work-key', WORK_KEY, '--revision', '1', '--body', body]).out);
  assert.equal(first.requestRevision, 1);
  assert.match(first.requestDigest, /^[0-9a-f]{64}$/);
  const replay = JSON.parse(cli(e.mailbox, ['request', '--work-key', WORK_KEY, '--revision', '1', '--body', body]).out);
  assert.equal(replay.requestDigest, first.requestDigest);
  assert.equal(replay.replay, true);
  const changed = cli(e.mailbox, ['request', '--work-key', WORK_KEY, '--revision', '1', '--body', body + ' tampered'], { expectCode: 4 });
  assert.match(changed.err + changed.out, /digest conflict/);
  const rev2 = JSON.parse(cli(e.mailbox, ['request', '--work-key', WORK_KEY, '--revision', '2', '--body', body + ' v2']).out);
  assert.equal(rev2.requestRevision, 2);
  assert.notEqual(rev2.requestDigest, first.requestDigest);
});

test('ownership: first acquire wins, same owner is idempotent, foreign workKey rejected, owner survives reads', () => {
  const e = mkEnv();
  cli(e.mailbox, enrollArgs(e));
  const own = JSON.parse(cli(e.mailbox, ['own', '--work-key', WORK_KEY, '--owner-token', OWNER]).out);
  assert.equal(own.workKey, WORK_KEY);
  const again = JSON.parse(cli(e.mailbox, ['own', '--work-key', WORK_KEY, '--owner-token', OWNER]).out);
  assert.equal(again.ownerToken, own.ownerToken);
  assert.equal(again.replay, true);
  cli(e.mailbox, ['own', '--work-key', 'other-card', '--owner-token', 'tok-cc-2'], { expectCode: 4 });
  const s = JSON.parse(cli(e.mailbox, ['status']).out);
  assert.equal(s.ownership.workKey, WORK_KEY);
});

test('abandoned operation lock yields HOLD, is never auto-deleted, and is cleared only by explicit reconcile', () => {
  const e = mkEnv();
  cli(e.mailbox, enrollArgs(e));
  const lockPath = join(e.mailbox, 'state', 'op-lock.lock');
  mkdirSync(join(e.mailbox, 'state'), { recursive: true });
  writeFileSync(lockPath, JSON.stringify({ holder: 'dead-session' }));
  const s = JSON.parse(cli(e.mailbox, ['status']).out);
  assert.equal(s.hold, true);
  assert.match(s.holdReasons.join(' '), /operation lock/);
  assert.ok(existsSync(lockPath), 'lock must not be auto-deleted');
  const r = cli(e.mailbox, ['request', '--work-key', 'k', '--revision', '1', '--body', 'b'], { expectCode: 3 });
  assert.match(r.err + r.out, /operation lock/);
  // C3: a dead holder can be reconciled explicitly
  const rec = JSON.parse(cli(e.mailbox, ['reconcile-lock', '--actor', 'operator',
    '--rationale', 'holder session is gone; lock abandoned mid-command']).out);
  assert.equal(rec.removed, true);
  assert.ok(!existsSync(lockPath));
});

test('C3: reconcile-lock refuses a lock whose holder process is still alive', () => {
  const e = mkEnv();
  cli(e.mailbox, enrollArgs(e));
  const lockPath = join(e.mailbox, 'state', 'op-lock.lock');
  mkdirSync(join(e.mailbox, 'state'), { recursive: true });
  writeFileSync(lockPath, JSON.stringify({ holder: `pid-${process.pid}` }));
  const r = cli(e.mailbox, ['reconcile-lock', '--actor', 'operator',
    '--rationale', 'attempting to clear a lock held by a live process'], { expectCode: 3 });
  assert.match(r.err, /alive|holder/i);
  assert.ok(existsSync(lockPath), 'live holder lock must survive');
});

test('path validation: traversal, symlink escape and absolute foreign paths are rejected', () => {
  const e = mkEnv();
  cli(e.mailbox, enrollArgs(e));
  cli(e.mailbox, ['request', '--work-key', '../escape', '--revision', '1', '--body', 'x'], { expectCode: 4 });
  const outside = mkdtempSync(join(tmpdir(), 'ab-outside-'));
  mkdirSync(join(e.mailbox, 'reports'), { recursive: true });
  symlinkSync(outside, join(e.mailbox, 'reports', 'link'));
  cli(e.mailbox, ['report-import', '--work-key', WORK_KEY, '--revision', '1', '--report-id', 'r1',
    '--status', 'DONE', '--dest-rel', 'reports/link/evil.json', '--body', 'x',
    '--request-digest', sha('x'), '--actor', OWNER, '--owner-ack'], { expectCode: 4 });
  rmSync(outside, { recursive: true, force: true });
});

test('OFF blocks admission but reads and status remain available', () => {
  const e = mkEnv();
  cli(e.mailbox, enrollArgs(e));
  cli(e.mailbox, ['off', '--actor', 'senior']);
  const s = JSON.parse(cli(e.mailbox, ['status']).out);
  assert.equal(s.off, true);
  const r = cli(e.mailbox, ['request', '--work-key', 'k', '--revision', '1', '--body', 'b'], { expectCode: 3 });
  assert.match(r.err + r.out, /OFF/);
  const s2 = JSON.parse(cli(e.mailbox, ['status']).out);
  assert.equal(s2.enrolled, true);
});

// ---------- journal semantics ----------

test('S7: identical event replay returns the receipt; changed content under the same event ID is rejected', async () => {
  const e = mkEnv();
  cli(e.mailbox, enrollArgs(e));
  const store = await import(join(REPO, 'scripts', 'advisor-bridge-beta', 'store.mjs'));
  const ev = { eventId: 'ev-1', type: 'test', actor: 'test', payload: { a: 1 } };
  const r1 = store.journalAppend(e.mailbox, ev);
  const r2 = store.journalAppend(e.mailbox, ev);
  assert.equal(r2.replay, true);
  assert.equal(r2.seq, r1.seq);
  const eventsDir = join(e.mailbox, 'events');
  const ev1Files = readdirSync(eventsDir).filter((n) => n.endsWith('-ev-1.json'));
  assert.equal(ev1Files.length, 1);
  // changed type / actor / payload under the same event ID must reject
  assert.throws(() => store.journalAppend(e.mailbox, { ...ev, type: 'other' }), /event ID conflict/);
  assert.throws(() => store.journalAppend(e.mailbox, { ...ev, actor: 'someone-else' }), /event ID conflict/);
  assert.throws(() => store.journalAppend(e.mailbox, { ...ev, payload: { a: 2 } }), /event ID conflict/);
  const ev1After = readdirSync(eventsDir).filter((n) => n.endsWith('-ev-1.json'));
  assert.equal(ev1After.length, 1, 'no new event file for a rejected replay');
});

// ---------- launch lifecycle ----------

test('test-mode run launches exactly the card argv, captures identity, counts one pass', () => {
  const { e, t } = setup();
  cli(e.mailbox, runArgs(), { env: t.env });
  const attempt = latestAttemptFile(e.mailbox);
  assert.equal(attempt.status, 'completed');
  assert.match(attempt.sessionId, /^[0-9a-f-]{36}$/);
  const launched = readChildLog(t.log);
  assert.equal(launched.length, 1);
  assert.deepEqual(launched[0].slice(0, 8), ['--model', 'glm-5.3', '--permission-prompts', 'none',
    '--output-format', 'json', '--session-id', attempt.sessionId]);
  assert.deepEqual(launched[0].slice(-2), ['-p', REQUEST_BODY]);
  const s = JSON.parse(cli(e.mailbox, ['status']).out);
  assert.equal(s.counters.ccPasses, 1);
  assert.equal(s.ownership.workKey, WORK_KEY);
});

test('S5: a mismatched client-reported model blocks advancement even with matching session id and exit 0', () => {
  const { e, t } = setup();
  t.env.AB_FAKE_MODEL = 'wrong-model';
  const r1 = cli(e.mailbox, runArgs(), { expectCode: 3, env: t.env });
  assert.match(r1.err, /model|unproven/i);
  const attempt = latestAttemptFile(e.mailbox);
  assert.equal(attempt.status, 'unknown');
  assert.match(attempt.captureReason, /model/);
  assert.equal(readChildLog(t.log).length, 1);
  // rerun does not relaunch while the attempt is unreconciled
  cli(e.mailbox, runArgs(), { expectCode: 3, env: t.env });
  assert.equal(readChildLog(t.log).length, 1);
  // evidence-gated reconcile cannot mark it completed: capture is untrusted (model mismatch)
  const rReconcile = cli(e.mailbox, ['reconcile-attempt', '--attempt-id', attempt.attemptId,
    '--mark', 'completed', '--rationale', 'the child exit code was zero so nothing is wrong',
    '--actor', 'operator'], { expectCode: 4 });
  assert.match(rReconcile.err, /evidence|capture|model/i);
  // abandonment requires proven cessation; the fake child is dead by now
  const rec = JSON.parse(cli(e.mailbox, ['reconcile-attempt', '--attempt-id', attempt.attemptId,
    '--mark', 'abandoned', '--rationale', 'pass lost to a model mismatch; session abandoned',
    '--actor', 'operator']).out);
  assert.equal(rec.status, 'abandoned');
  // a fresh identical initial pass is admitted after reconciliation
  cli(e.mailbox, runArgs(), { env: { ...process.env, AB_CHILD_LOG: t.log } });
  assert.equal(readChildLog(t.log).length, 2);
});

test('S4: run without a prepared request is rejected — no unbounded job admission', () => {
  const { e, t } = setup({ body: null });
  const r = cli(e.mailbox, runArgs(), { expectCode: 4, env: t.env });
  assert.match(r.err, /request/i);
  assert.equal(readChildLog(t.log).length, 0);
});

test('S4: an identical completed launch replay returns its receipt without a new session or launch', () => {
  const { e, t } = setup();
  cli(e.mailbox, runArgs(), { env: t.env });
  const first = latestAttemptFile(e.mailbox);
  const replayOut = cli(e.mailbox, runArgs(), { env: t.env });
  const receipt = JSON.parse(replayOut.out);
  assert.equal(receipt.replay, true, 'identical completed launch must replay its receipt');
  assert.equal(receipt.attemptId, first.attemptId);
  assert.equal(attemptFiles(e.mailbox).length, 1, 'no second attempt record');
  assert.equal(readChildLog(t.log).length, 1, 'no second child launch');
  // a DIFFERENT prompt while awaiting the report is not admitted
  const r2 = cli(e.mailbox, runArgs('a different unbounded job'), { expectCode: 3, env: t.env });
  assert.match(r2.err, /awaiting report|no new job/i);
  assert.equal(readChildLog(t.log).length, 1);
});

test('R3: REWORK advances to the next instruction revision; resume executes it on the same session', () => {
  const { e, t, request } = setup();
  cli(e.mailbox, runArgs(), { env: t.env });
  const first = latestAttemptFile(e.mailbox);
  assert.equal(first.requestRevision, 1, 'the attempt binds its instruction revision');
  cli(e.mailbox, reportArgs({ status: 'PARTIAL', digest: request.requestDigest, extra: PARTIAL_EXTRA }));
  cli(e.mailbox, ['decide', '--report-id', 'rep-1', '--verdict', 'REWORK', '--criteria', 'add a dated second verification', '--actor', SENIOR]);
  // resume before the next instruction revision is published is refused
  const rEarly = cli(e.mailbox, runArgs(REQUEST_BODY, ['--resume']), { expectCode: 3, env: t.env });
  assert.match(rEarly.err, /instruction revision/i);
  assert.equal(readChildLog(t.log).length, 1);
  const r2Body = 'rework instruction r2: add the dated second verification and compare evidence';
  const r2 = JSON.parse(cli(e.mailbox, ['request', '--work-key', WORK_KEY, '--revision', '2', '--body', r2Body, '--actor', SENIOR]).out);
  // resume with the OLD criteria text is not the new instruction: rejected
  cli(e.mailbox, runArgs('add a dated second verification', ['--resume']), { expectCode: 4, env: t.env });
  assert.equal(readChildLog(t.log).length, 1);
  // resume with the NEW instruction body executes it on the same session
  cli(e.mailbox, runArgs(r2Body, ['--resume']), { env: t.env });
  const second = latestAttemptFile(e.mailbox);
  assert.equal(second.status, 'completed');
  assert.equal(second.resumeFrom, first.sessionId);
  assert.equal(second.sessionId, first.sessionId, 'exact-ID resume binds the same session');
  assert.equal(second.requestRevision, 2, 'the rework attempt binds the new instruction revision');
  const launched = readChildLog(t.log);
  assert.equal(launched.length, 2);
  assert.deepEqual(launched[1].slice(6, 10), ['--resume', first.sessionId, '-p', r2Body]);
  // the old r1 report cannot be accepted after r2
  cli(e.mailbox, ['decide', '--report-id', 'rep-1', '--verdict', 'ACCEPTED', '--actor', SENIOR], { expectCode: 4 });
  // the r2 report binds r2
  cli(e.mailbox, reportArgs({ reportId: 'rep-2', revision: '2', status: 'PARTIAL', digest: r2.requestDigest, extra: PARTIAL_EXTRA }));
  const s = JSON.parse(cli(e.mailbox, ['status']).out);
  assert.equal(s.taskState, 'reported');
});

test('R4: an instruction admits only its owned attempt; rework duplicates replay or HOLD', async () => {
  const { e, t, request } = setup();
  cli(e.mailbox, runArgs(), { env: t.env });
  cli(e.mailbox, reportArgs({ status: 'PARTIAL', digest: request.requestDigest, extra: PARTIAL_EXTRA }));
  cli(e.mailbox, ['decide', '--report-id', 'rep-1', '--verdict', 'REWORK', '--criteria', 'fix it', '--actor', SENIOR]);
  const r2Body = 'rework instruction r2: fix it with evidence';
  cli(e.mailbox, ['request', '--work-key', WORK_KEY, '--revision', '2', '--body', r2Body, '--actor', SENIOR]);
  cli(e.mailbox, runArgs(r2Body, ['--resume']), { env: t.env });
  const reworkAttempt = latestAttemptFile(e.mailbox);
  assert.equal(readChildLog(t.log).length, 2);
  // sequential identical duplicate returns the existing receipt without a launch
  const dup = JSON.parse(cli(e.mailbox, runArgs(r2Body, ['--resume']), { env: t.env }).out);
  assert.equal(dup.replay, true, 'an identical rework retry must replay its receipt');
  assert.equal(dup.attemptId, reworkAttempt.attemptId);
  assert.equal(attemptFiles(e.mailbox).length, 2, 'no second attempt record');
  assert.equal(readChildLog(t.log).length, 2, 'no second child launch');
  const s = JSON.parse(cli(e.mailbox, ['status']).out);
  assert.equal(s.counters.ccPasses, 2, 'replay does not increment counters');
  // concurrent duplicates cause at most one launch
  const [a, b] = await Promise.all([
    cliAsync(e.mailbox, runArgs(r2Body, ['--resume']), t.env),
    cliAsync(e.mailbox, runArgs(r2Body, ['--resume']), { ...process.env, AB_CHILD_LOG: t.log }),
  ]);
  const codes = [a.code, b.code].sort();
  assert.ok(codes[0] === 0 && (codes[1] === 0 || codes[1] === 3), `got ${a.code}/${b.code}`);
  assert.equal(readChildLog(t.log).length, 2, 'no additional child launch');
});

// ---------- R8/R9/R10: one work-item lifecycle across revisions ----------

// Drive the legitimate two-rework chain to the three-pass cap. Every pass
// follows the authorized progression: completed pass → report → senior
// verdict → next instruction revision → same-session resume.
function driveToCap(e, t, request) {
  cli(e.mailbox, runArgs(), { env: t.env });
  const first = latestAttemptFile(e.mailbox);
  cli(e.mailbox, reportArgs({ status: 'PARTIAL', digest: request.requestDigest, extra: PARTIAL_EXTRA }));
  cli(e.mailbox, ['decide', '--report-id', 'rep-1', '--verdict', 'REWORK', '--criteria', 'add evidence', '--actor', SENIOR]);
  const r2Body = 'rework instruction r2: add evidence with a dated check';
  const r2 = JSON.parse(cli(e.mailbox, ['request', '--work-key', WORK_KEY, '--revision', '2', '--body', r2Body, '--actor', SENIOR]).out);
  cli(e.mailbox, runArgs(r2Body, ['--resume']), { env: t.env });
  const second = latestAttemptFile(e.mailbox);
  cli(e.mailbox, reportArgs({ reportId: 'rep-2', revision: '2', status: 'PARTIAL', digest: r2.requestDigest, extra: PARTIAL_EXTRA }));
  cli(e.mailbox, ['decide', '--report-id', 'rep-2', '--verdict', 'REWORK', '--criteria', 'third pass', '--actor', SENIOR]);
  const r3Body = 'rework instruction r3: third verification pass';
  const r3 = JSON.parse(cli(e.mailbox, ['request', '--work-key', WORK_KEY, '--revision', '3', '--body', r3Body, '--actor', SENIOR]).out);
  cli(e.mailbox, runArgs(r3Body, ['--resume']), { env: t.env });
  const third = latestAttemptFile(e.mailbox);
  return { first, second, third, r2, r3, r2Body, r3Body };
}

test('R8: revision publication alone never admits a replacement executor', () => {
  const { e, t, request } = setup();
  cli(e.mailbox, runArgs(), { env: t.env });
  assert.equal(readChildLog(t.log).length, 1);
  // r2 published with NO report and NO senior verdict on r1
  const r2Body = 'rework instruction r2: second verification with evidence';
  const r2 = JSON.parse(cli(e.mailbox, ['request', '--work-key', WORK_KEY, '--revision', '2', '--body', r2Body, '--actor', SENIOR]).out);
  assert.notEqual(r2.requestDigest, request.requestDigest);
  // an ordinary (non-resume) run on r2 must not mint a replacement session
  const r = cli(e.mailbox, runArgs(r2Body), { expectCode: 3, env: t.env });
  assert.match(r.err, /completed pass|no new job/i);
  assert.equal(attemptFiles(e.mailbox).length, 1, 'no second attempt record');
  assert.equal(readChildLog(t.log).length, 1, 'one child total; no replacement session');
  // and the resume route is equally closed without a REWORK verdict
  cli(e.mailbox, runArgs(r2Body, ['--resume']), { expectCode: 3, env: t.env });
  assert.equal(readChildLog(t.log).length, 1);
});

test('R8: a report awaiting the senior decision blocks every route on a newer revision', () => {
  const { e, t, request } = setup();
  cli(e.mailbox, runArgs(), { env: t.env });
  cli(e.mailbox, reportArgs({ status: 'PARTIAL', digest: request.requestDigest, extra: PARTIAL_EXTRA }));
  const r2Body = 'rework instruction r2: second verification with evidence';
  cli(e.mailbox, ['request', '--work-key', WORK_KEY, '--revision', '2', '--body', r2Body, '--actor', SENIOR]);
  cli(e.mailbox, runArgs(r2Body), { expectCode: 3, env: t.env });
  cli(e.mailbox, runArgs(r2Body, ['--resume']), { expectCode: 3, env: t.env });
  assert.equal(attemptFiles(e.mailbox).length, 1);
  assert.equal(readChildLog(t.log).length, 1, 'no additional child while the report awaits its decision');
});

test('R9: complete r2 then request r3 without a fresh REWORK admits no third child', () => {
  const { e, t, request } = setup();
  cli(e.mailbox, runArgs(), { env: t.env });
  cli(e.mailbox, reportArgs({ status: 'PARTIAL', digest: request.requestDigest, extra: PARTIAL_EXTRA }));
  cli(e.mailbox, ['decide', '--report-id', 'rep-1', '--verdict', 'REWORK', '--criteria', 'add evidence', '--actor', SENIOR]);
  const r2Body = 'rework instruction r2: add evidence with a dated check';
  cli(e.mailbox, ['request', '--work-key', WORK_KEY, '--revision', '2', '--body', r2Body, '--actor', SENIOR]);
  cli(e.mailbox, runArgs(r2Body, ['--resume']), { env: t.env });
  assert.equal(readChildLog(t.log).length, 2);
  // r3 published with NO report and NO fresh verdict on r2: REWORK(r1) is spent
  const r3Body = 'rework instruction r3: third verification pass';
  cli(e.mailbox, ['request', '--work-key', WORK_KEY, '--revision', '3', '--body', r3Body, '--actor', SENIOR]);
  const rA = cli(e.mailbox, runArgs(r3Body, ['--resume']), { expectCode: 3, env: t.env });
  assert.match(rA.err, /successor|authorizes/i);
  cli(e.mailbox, runArgs(r3Body), { expectCode: 3, env: t.env });
  assert.equal(attemptFiles(e.mailbox).length, 2);
  assert.equal(readChildLog(t.log).length, 2, 'the historical REWORK never authorizes a later revision');
});

test('R9: a pending r2 report plus r3 cannot spend the historical REWORK', () => {
  const { e, t, request } = setup();
  cli(e.mailbox, runArgs(), { env: t.env });
  cli(e.mailbox, reportArgs({ status: 'PARTIAL', digest: request.requestDigest, extra: PARTIAL_EXTRA }));
  cli(e.mailbox, ['decide', '--report-id', 'rep-1', '--verdict', 'REWORK', '--criteria', 'add evidence', '--actor', SENIOR]);
  const r2Body = 'rework instruction r2: add evidence with a dated check';
  const r2 = JSON.parse(cli(e.mailbox, ['request', '--work-key', WORK_KEY, '--revision', '2', '--body', r2Body, '--actor', SENIOR]).out);
  cli(e.mailbox, runArgs(r2Body, ['--resume']), { env: t.env });
  assert.equal(readChildLog(t.log).length, 2);
  // r2 report pending; r3 published; REWORK(r1) is spent either way
  cli(e.mailbox, reportArgs({ reportId: 'rep-2', revision: '2', status: 'PARTIAL', digest: r2.requestDigest, extra: PARTIAL_EXTRA }));
  const r3Body = 'rework instruction r3: third verification pass';
  cli(e.mailbox, ['request', '--work-key', WORK_KEY, '--revision', '3', '--body', r3Body, '--actor', SENIOR]);
  const rA = cli(e.mailbox, runArgs(r3Body, ['--resume']), { expectCode: 3, env: t.env });
  assert.match(rA.err, /successor|authorizes/i);
  cli(e.mailbox, runArgs(r3Body), { expectCode: 3, env: t.env });
  assert.equal(attemptFiles(e.mailbox).length, 2);
  assert.equal(readChildLog(t.log).length, 2, 'no third child from the historical REWORK');
});

test('R9: ACCEPTED is terminal across revisions; no revival, no new launch', () => {
  const { e, t, request } = setup();
  cli(e.mailbox, runArgs(), { env: t.env });
  cli(e.mailbox, reportArgs({ status: 'PARTIAL', digest: request.requestDigest, extra: PARTIAL_EXTRA }));
  cli(e.mailbox, ['decide', '--report-id', 'rep-1', '--verdict', 'REWORK', '--criteria', 'add evidence', '--actor', SENIOR]);
  const r2Body = 'rework instruction r2: add evidence with a dated check';
  const r2 = JSON.parse(cli(e.mailbox, ['request', '--work-key', WORK_KEY, '--revision', '2', '--body', r2Body, '--actor', SENIOR]).out);
  cli(e.mailbox, runArgs(r2Body, ['--resume']), { env: t.env });
  assert.equal(readChildLog(t.log).length, 2);
  cli(e.mailbox, reportArgs({ reportId: 'rep-2', revision: '2', status: 'PARTIAL', digest: r2.requestDigest, extra: PARTIAL_EXTRA }));
  cli(e.mailbox, ['decide', '--report-id', 'rep-2', '--verdict', 'ACCEPTED', '--actor', SENIOR]);
  const r3Body = 'rework instruction r3: third verification pass';
  cli(e.mailbox, ['request', '--work-key', WORK_KEY, '--revision', '3', '--body', r3Body, '--actor', SENIOR]);
  cli(e.mailbox, runArgs(r3Body, ['--resume']), { expectCode: 3, env: t.env });
  cli(e.mailbox, runArgs(r3Body), { expectCode: 3, env: t.env });
  assert.equal(attemptFiles(e.mailbox).length, 2);
  assert.equal(readChildLog(t.log).length, 2, 'accepted work remains terminal across later revisions');
});

test('R9: OPERATOR_REQUIRED authorizes nothing; an earlier REWORK stays spent', () => {
  const { e, t, request } = setup();
  cli(e.mailbox, runArgs(), { env: t.env });
  cli(e.mailbox, reportArgs({ status: 'PARTIAL', digest: request.requestDigest, extra: PARTIAL_EXTRA }));
  cli(e.mailbox, ['decide', '--report-id', 'rep-1', '--verdict', 'REWORK', '--criteria', 'add evidence', '--actor', SENIOR]);
  const r2Body = 'rework instruction r2: add evidence with a dated check';
  const r2 = JSON.parse(cli(e.mailbox, ['request', '--work-key', WORK_KEY, '--revision', '2', '--body', r2Body, '--actor', SENIOR]).out);
  cli(e.mailbox, runArgs(r2Body, ['--resume']), { env: t.env });
  assert.equal(readChildLog(t.log).length, 2);
  cli(e.mailbox, reportArgs({ reportId: 'rep-2', revision: '2', status: 'PARTIAL', digest: r2.requestDigest, extra: PARTIAL_EXTRA }));
  cli(e.mailbox, ['decide', '--report-id', 'rep-2', '--verdict', 'OPERATOR_REQUIRED', '--criteria', 'operator decides the fork', '--actor', SENIOR]);
  const r3Body = 'rework instruction r3: third verification pass';
  cli(e.mailbox, ['request', '--work-key', WORK_KEY, '--revision', '3', '--body', r3Body, '--actor', SENIOR]);
  const rA = cli(e.mailbox, runArgs(r3Body, ['--resume']), { expectCode: 3, env: t.env });
  assert.match(rA.err, /successor|authorizes/i);
  cli(e.mailbox, runArgs(r3Body), { expectCode: 3, env: t.env });
  assert.equal(attemptFiles(e.mailbox).length, 2);
  assert.equal(readChildLog(t.log).length, 2, 'no execution justified by an earlier REWORK');
});

test('R9: a fresh REWORK r2 authorizes exactly r3 — the legitimate second rework reaches the cap', () => {
  const { e, t, request } = setup();
  const { first, second, third } = driveToCap(e, t, request);
  assert.equal(second.resumeFrom, first.sessionId, 'same proven-ended session');
  assert.equal(second.requestRevision, 2);
  assert.equal(third.resumeFrom, second.sessionId, 'the second rework resumes the same session');
  assert.equal(third.sessionId, first.sessionId, 'one executor through all three passes');
  assert.equal(third.requestRevision, 3, 'each rework attempt binds its own instruction revision');
  assert.equal(third.status, 'completed');
  assert.equal(readChildLog(t.log).length, 3);
  const s = JSON.parse(cli(e.mailbox, ['status']).out);
  assert.equal(s.counters.ccPasses, 3, 'the cap is reached by the legitimate progression');
});

test('R10: an identical retry at the pass cap replays its original receipt', () => {
  const { e, t, request } = setup();
  const { third, r3, r3Body } = driveToCap(e, t, request);
  const before = JSON.parse(cli(e.mailbox, ['status']).out);
  assert.equal(before.counters.ccPasses, 3);
  // the lost receipt of the FINAL permitted pass is recoverable
  const retry = JSON.parse(cli(e.mailbox, runArgs(r3Body, ['--resume']), { env: t.env }).out);
  assert.equal(retry.replay, true, 'identical retry at the cap must replay, not reject');
  assert.equal(retry.attemptId, third.attemptId);
  assert.equal(attemptFiles(e.mailbox).length, 3, 'no new attempt record');
  assert.equal(readChildLog(t.log).length, 3, 'no fourth launch');
  const after = JSON.parse(cli(e.mailbox, ['status']).out);
  assert.equal(after.counters.ccPasses, 3, 'replay does not change counters');
  // a DISTINCT instruction at the cap is still refused — the cap is intact
  cli(e.mailbox, reportArgs({ reportId: 'rep-3', revision: '3', status: 'PARTIAL', digest: r3.requestDigest, extra: PARTIAL_EXTRA }));
  cli(e.mailbox, ['decide', '--report-id', 'rep-3', '--verdict', 'REWORK', '--criteria', 'yet another pass', '--actor', SENIOR]);
  const r4Body = 'rework instruction r4: fourth verification pass';
  cli(e.mailbox, ['request', '--work-key', WORK_KEY, '--revision', '4', '--body', r4Body, '--actor', SENIOR]);
  const rCap = cli(e.mailbox, runArgs(r4Body, ['--resume']), { expectCode: 3, env: t.env });
  assert.match(rCap.err, /pass limit/i);
  assert.equal(readChildLog(t.log).length, 3, 'the cap still forbids a fourth launch');
  // OFF still forbids execution: receipt recovery is not permission to resume
  cli(e.mailbox, ['off', '--actor', 'senior']);
  cli(e.mailbox, runArgs(r3Body, ['--resume']), { expectCode: 3, env: t.env });
  assert.equal(readChildLog(t.log).length, 3, 'OFF still gates after the cap');
});

test('R5: DONE binds the pass and the decision to the exact current instruction revision', () => {
  const { e, t, request } = setup();
  cli(e.mailbox, runArgs(), { env: t.env });
  const attempt1 = latestAttemptFile(e.mailbox);
  cli(e.mailbox, askArgs('same-body-ask', 'Judge.'));
  cli(e.mailbox, ['consult-run', '--ask-id', 'same-body-ask'], { env: t.env });
  const dec1 = JSON.parse(cli(e.mailbox, ['consult-import', '--ask-id', 'same-body-ask'], { env: t.env }).out);
  cli(e.mailbox, reportArgs({ status: 'PARTIAL', digest: request.requestDigest, extra: PARTIAL_EXTRA }));
  cli(e.mailbox, ['decide', '--report-id', 'rep-1', '--verdict', 'REWORK', '--criteria', 'verify once more', '--actor', SENIOR]);
  // r2 with an IDENTICAL body: identical digest, different revision. The only
  // authorized fresh pass on r2 is the rework resume — revision publication
  // alone mints nothing (R8), and the pending rework instruction directs the
  // initial route to --resume instead of minting or replaying a pass.
  const r2 = JSON.parse(cli(e.mailbox, ['request', '--work-key', WORK_KEY, '--revision', '2', '--body', REQUEST_BODY, '--actor', SENIOR]).out);
  assert.equal(r2.requestDigest, request.requestDigest, 'precondition: identical body and digest');
  const staleRun = cli(e.mailbox, runArgs(REQUEST_BODY), { expectCode: 3, env: t.env });
  assert.match(staleRun.err, /rework instructed|no new job/i, 'revision publication alone mints nothing');
  const r = cli(e.mailbox, reportArgs({ reportId: 'rep-stale', revision: '2', status: 'DONE', digest: r2.requestDigest,
    extra: DONE_EXTRA(attempt1.attemptId, dec1.decisionId) }), { expectCode: 4 });
  assert.match(r.err, /revision/i);
  // the authorized rework pass and a fresh consult on r2 do back a DONE on r2
  cli(e.mailbox, runArgs(REQUEST_BODY, ['--resume']), { env: t.env });
  const attempt2 = latestAttemptFile(e.mailbox);
  assert.equal(attempt2.requestRevision, 2);
  assert.equal(attempt2.resumeFrom, attempt1.sessionId, 'same proven-ended session');
  cli(e.mailbox, askArgs('fresh-ask', 'Judge again.'));
  cli(e.mailbox, ['consult-run', '--ask-id', 'fresh-ask'], { env: t.env });
  const dec2 = JSON.parse(cli(e.mailbox, ['consult-import', '--ask-id', 'fresh-ask'], { env: t.env }).out);
  cli(e.mailbox, reportArgs({ reportId: 'rep-fresh', revision: '2', status: 'DONE', digest: r2.requestDigest,
    extra: DONE_EXTRA(attempt2.attemptId, dec2.decisionId) }));
  const s = JSON.parse(cli(e.mailbox, ['status']).out);
  assert.equal(s.taskState, 'reported');
});

test('R1: OFF reports uncertain reservations and terminates a live advisor fork', async () => {
  const { e, t } = setup();
  // an uncertain reservation: reserved attempt with no recorded pid
  mkdirSync(join(e.mailbox, 'attempts'), { recursive: true });
  writeFileSync(join(e.mailbox, 'attempts', 'pass01-ghost.json'), JSON.stringify({
    schemaVersion: 1, attemptId: 'ghost', passNumber: 1, status: 'reserved',
    workKey: WORK_KEY, sessionId: '33333333-3333-3333-3333-333333333333', requestRevision: 1, pid: null,
  }));
  // a live advisor fork
  t.env.AB_FAKE_MODE = 'advisor-sleep';
  t.env.AB_FAKE_SLEEP_MS = '15000';
  cli(e.mailbox, askArgs('off-ask', 'Judge.'));
  const pending = cliAsync(e.mailbox, ['consult-run', '--ask-id', 'off-ask'], t.env);
  const forkGotPid = await waitFor(() => {
    const p = join(e.mailbox, 'outbox', 'off-ask.fork.json');
    if (!existsSync(p)) return false;
    return JSON.parse(readFileSync(p, 'utf8')).pid != null;
  }, 8000);
  assert.ok(forkGotPid, 'advisor fork must record its live pid while running');
  const off = JSON.parse(cli(e.mailbox, ['off', '--actor', 'senior']).out);
  assert.equal(off.terminated.length, 1, 'OFF terminates the exactly identified advisor fork');
  assert.equal(off.terminated[0].kind, 'advisor-fork');
  assert.equal(off.uncertain.length, 1, 'OFF reports the uncertain reservation');
  assert.equal(off.uncertain[0].id, 'ghost');
  const done = await pending;
  assert.equal(done.code, 3, 'the interrupted fork HOLDs, it does not complete');
  const fork = JSON.parse(readFileSync(join(e.mailbox, 'outbox', 'off-ask.fork.json'), 'utf8'));
  assert.equal(fork.status, 'interrupted');
  assert.equal(readChildLog(t.log).length, 1, 'no second advisor child');
  // the interrupted fork cannot become a decision through import
  cli(e.mailbox, ['consult-import', '--ask-id', 'off-ask'], { expectCode: 3, env: t.env });
  // and the ghost reservation cannot be abandoned without affirmative evidence
  cli(e.mailbox, ['reconcile-attempt', '--attempt-id', 'ghost', '--mark', 'abandoned',
    '--rationale', 'the ghost attempt was probably never started anyway', '--actor', 'operator'], { expectCode: 4 });
});

test('R2: a pid-less reservation is never proof of no spawn; affirmative records resolve it', () => {
  const { e, t } = setup();
  mkdirSync(join(e.mailbox, 'attempts'), { recursive: true });
  const ghost = () => JSON.stringify({
    schemaVersion: 1, attemptId: 'nopid', passNumber: 1, status: 'reserved',
    workKey: WORK_KEY, sessionId: '44444444-4444-4444-4444-444444444444', requestRevision: 1, pid: null,
  });
  writeFileSync(join(e.mailbox, 'attempts', 'pass01-nopid.json'), ghost());
  // launcher died before the PID callback: no affirmative evidence → no abandonment
  const r1 = cli(e.mailbox, ['reconcile-attempt', '--attempt-id', 'nopid', '--mark', 'abandoned',
    '--rationale', 'the launcher died so nothing can be running', '--actor', 'operator'], { expectCode: 4 });
  assert.match(r1.err, /affirmative|evidence|pid/i);
  // and no silent fresh executor while the boundary is unresolved
  cli(e.mailbox, runArgs(), { expectCode: 3, env: t.env });
  assert.equal(readChildLog(t.log).length, 0);
  // an affirmative serialized record (spawn never happened) does resolve it
  writeFileSync(join(e.mailbox, 'attempts', 'pass01-nopid.json'), `${ghost().slice(0, -1)}, "spawnOutcome": "spawn-failed"}`);
  const rec = JSON.parse(cli(e.mailbox, ['reconcile-attempt', '--attempt-id', 'nopid', '--mark', 'abandoned',
    '--rationale', 'recorded spawn failure proves the process never started', '--actor', 'operator']).out);
  assert.equal(rec.status, 'abandoned');
  cli(e.mailbox, runArgs(), { env: t.env });
  assert.equal(readChildLog(t.log).length, 1);
});

test('R6: conflicting partial Answer bytes reject before any receipt; evidence is preserved', async () => {
  const { e, t } = setup();
  cli(e.mailbox, askArgs('partial-ask', 'judge'));
  const store = await import(join(REPO, 'scripts', 'advisor-bridge-beta', 'store.mjs'));
  const answerA = 'decision A';
  store.journalAppend(e.mailbox, {
    eventId: store.deriveDecisionEventId('partial-ask', answerA),
    type: 'decision-captured',
    actor: 'bridge',
    payload: { askId: 'partial-ask', answerDigest: store.sha256(answerA), answer: answerA, requestDigest: sha(REQUEST_BODY) },
  });
  // partial state: an Answer section already present with DIFFERENT bytes
  const mdPath = join(e.mailbox, 'asks', 'partial-ask.md');
  const md = readFileSync(mdPath, 'utf8');
  writeFileSync(mdPath, `${md}\n## Answer\n\nconflicting B\n`);
  const r = cli(e.mailbox, ['consult-import', '--ask-id', 'partial-ask'], { expectCode: 3, env: t.env });
  assert.match(r.err, /conflict/i);
  const ask = JSON.parse(readFileSync(join(e.mailbox, 'asks', 'partial-ask.json'), 'utf8'));
  assert.equal(ask.status, 'open', 'no receipt, ask not advanced');
  assert.match(readFileSync(mdPath, 'utf8'), /conflicting B/, 'evidence preserved, not overwritten');
  // consistent partial progress recovers idempotently once the conflict is cleared
  writeFileSync(mdPath, md);
  cli(e.mailbox, ['consult-import', '--ask-id', 'partial-ask'], { env: t.env });
  assert.match(readFileSync(mdPath, 'utf8'), /decision A/);
});

test('R7: import respects a recorded invalid fork capture', () => {
  const { e, t } = setup();
  t.env.AB_FAKE_MODE = 'advisor-nooutput';
  cli(e.mailbox, askArgs('bad-capture-ask', 'judge'));
  cli(e.mailbox, ['consult-run', '--ask-id', 'bad-capture-ask'], { expectCode: 3, env: t.env });
  const fork = JSON.parse(readFileSync(join(e.mailbox, 'outbox', 'bad-capture-ask.fork.json'), 'utf8'));
  assert.equal(fork.status, 'capture-invalid');
  // a syntactically valid bound candidate appears afterwards
  writeFileSync(join(e.mailbox, 'outbox', 'bad-capture-ask.candidate.json'),
    JSON.stringify({ role: 'advisor', askId: 'bad-capture-ask', inputDigest: sha('judge'), answer: 'late candidate' }));
  const r = cli(e.mailbox, ['consult-import', '--ask-id', 'bad-capture-ask'], { expectCode: 3, env: t.env });
  assert.match(r.err, /capture|invalid/i);
  const ask = JSON.parse(readFileSync(join(e.mailbox, 'asks', 'bad-capture-ask.json'), 'utf8'));
  assert.equal(ask.status, 'open');
});

test('S4: an open ask is an explicit consult-pending checkpoint; no unbound new job while it waits', () => {
  const { e, t } = setup();
  cli(e.mailbox, runArgs(), { env: t.env });
  cli(e.mailbox, askArgs());
  const s = JSON.parse(cli(e.mailbox, ['status']).out);
  assert.equal(s.taskState, 'consult-pending');
  const r = cli(e.mailbox, runArgs(), { expectCode: 3, env: t.env });
  assert.match(r.err, /consult/i);
  assert.equal(readChildLog(t.log).length, 1);
});

test('two concurrent claim/run callers cause at most one child launch', async () => {
  const { e, t } = setup();
  const args = runArgs();
  const [a, b] = await Promise.all([
    cliAsync(e.mailbox, args, t.env),
    cliAsync(e.mailbox, args, { ...process.env, AB_CHILD_LOG: t.log }),
  ]);
  const codes = [a.code, b.code].sort();
  assert.equal(codes[0], 0, `one caller must succeed; got ${a.code}/${b.code}`);
  assert.ok(codes[1] === 0 || codes[1] === 3, `loser exits 0 (replay) or 3 (HOLD); got ${a.code}/${b.code}`);
  assert.equal(readChildLog(t.log).length, 1, 'exactly one child launch');
});

test('lost capture (exit 0, no JSON receipt) leaves UNKNOWN; rerun does not relaunch', () => {
  const { e, t } = setup();
  t.env.AB_FAKE_MODE = 'no-json';
  const r1 = cli(e.mailbox, runArgs(), { expectCode: 3, env: t.env });
  assert.match(r1.err, /UNKNOWN|unproven/);
  const r2 = cli(e.mailbox, runArgs(), { expectCode: 3, env: t.env });
  assert.match(r2.err, /reconcile|unknown/);
  assert.equal(readChildLog(t.log).length, 1, 'no automatic relaunch after lost capture');
});

test('pre-existing reserved attempt (spawn crash) HOLDs all new launches until reconcile', () => {
  const { e, t } = setup();
  mkdirSync(join(e.mailbox, 'attempts'), { recursive: true });
  writeFileSync(join(e.mailbox, 'attempts', 'pass01-crash.json'), JSON.stringify({
    schemaVersion: 1, attemptId: 'crash', passNumber: 1, status: 'reserved',
    workKey: WORK_KEY, sessionId: '11111111-1111-1111-1111-111111111111',
  }));
  const r = cli(e.mailbox, runArgs(), { expectCode: 3, env: t.env });
  assert.match(r.err, /reserved|reconcile/);
  assert.equal(readChildLog(t.log).length, 0);
});

test('OFF before run causes zero new launches', () => {
  const { e, t } = setup();
  cli(e.mailbox, ['off', '--actor', 'senior']);
  const r = cli(e.mailbox, runArgs(), { expectCode: 3, env: t.env });
  assert.match(r.err, /OFF/);
  assert.equal(readChildLog(t.log).length, 0);
  const s = JSON.parse(cli(e.mailbox, ['status']).out);
  assert.equal(s.counters.ccPasses, 0);
});

test('S1: OFF during an owned pass terminates the exact recorded pid, records interruption, keeps late ingestion, blocks acceptance', async () => {
  const { e, t } = setup();
  t.env.AB_FAKE_MODE = 'sleep';
  t.env.AB_FAKE_SLEEP_MS = '15000';
  const pending = cliAsync(e.mailbox, runArgs(), t.env);
  // the running process identity must be persisted while it runs, not only after it ends
  const sawPid = await waitFor(() => {
    const files = attemptFiles(e.mailbox);
    if (files.length === 0) return false;
    const a = files[files.length - 1];
    return a.status === 'reserved' && typeof a.pid === 'number' && a.pid > 0;
  }, 8000);
  assert.ok(sawPid, 'attempt must record the pid while the child is alive');
  const attempt = latestAttemptFile(e.mailbox);
  const off = JSON.parse(cli(e.mailbox, ['off', '--actor', 'senior']).out);
  assert.equal(off.terminated.length, 1, 'OFF must terminate the exactly identified owned process');
  assert.equal(off.terminated[0].kind, 'cc-attempt');
  assert.equal(off.terminated[0].id, attempt.attemptId);
  assert.equal(off.unproven.length, 0);
  assert.equal(off.uncertain.length, 0);
  const done = await pending;
  assert.equal(done.code, 3, 'the interrupted pass must HOLD, not complete');
  const interrupted = latestAttemptFile(e.mailbox);
  assert.equal(interrupted.status, 'interrupted', 'no ordinary completed advancement after OFF');
  assert.equal(readChildLog(t.log).length, 1, 'no relaunch');
  // late evidence/report ingestion stays available under OFF
  cli(e.mailbox, reportArgs({ reportId: 'rep-late', status: 'PARTIAL', digest: sha(REQUEST_BODY), extra: PARTIAL_EXTRA }));
  // dependent acceptance is blocked
  cli(e.mailbox, ['decide', '--report-id', 'rep-late', '--verdict', 'ACCEPTED', '--actor', SENIOR], { expectCode: 3 });
  // and no new pass is admitted
  cli(e.mailbox, runArgs(), { expectCode: 3, env: t.env });
  // explicit reconcile of the interrupted attempt is the recovery path
  const rec = JSON.parse(cli(e.mailbox, ['reconcile-attempt', '--attempt-id', attempt.attemptId,
    '--mark', 'abandoned', '--rationale', 'pass interrupted by OFF; cessation proven at termination',
    '--actor', 'operator']).out);
  assert.equal(rec.status, 'abandoned');
});

test('deadline kill never releases an unproven owner; next run HOLDs', () => {
  const { e, t } = setup();
  t.env.AB_FAKE_MODE = 'sleep';
  t.env.AB_FAKE_SLEEP_MS = '10000';
  cli(e.mailbox, runArgs(REQUEST_BODY, [], '400'), { expectCode: 3, env: t.env });
  const attempt = latestAttemptFile(e.mailbox);
  assert.equal(attempt.status, 'deadline-unknown');
  assert.ok(attempt.cessation.verifiedEnded, 'child must be proven dead after deadline kill');
  const own = JSON.parse(cli(e.mailbox, ['own', '--work-key', WORK_KEY, '--owner-token', OWNER]).out);
  assert.equal(own.workKey, WORK_KEY, 'ownership survives the deadline');
  assert.equal(own.replay, true);
  const r = cli(e.mailbox, runArgs(), { expectCode: 3, env: t.env });
  assert.match(r.err, /deadline-unknown|reconcile/);
  assert.equal(readChildLog(t.log).length, 1, 'no relaunch while owner unproven');
});

test('C3: an attempt cannot be marked completed or abandoned on rationale alone', () => {
  const { e, t } = setup();
  const sleeper = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], { stdio: 'ignore' });
  try {
    mkdirSync(join(e.mailbox, 'attempts'), { recursive: true });
    writeFileSync(join(e.mailbox, 'attempts', 'pass01-live.json'), JSON.stringify({
      schemaVersion: 1, attemptId: 'live', passNumber: 1, status: 'reserved',
      workKey: WORK_KEY, sessionId: '22222222-2222-2222-2222-222222222222', pid: sleeper.pid,
    }));
    // running process: neither completed nor abandoned may be recorded
    cli(e.mailbox, ['reconcile-attempt', '--attempt-id', 'live', '--mark', 'completed',
      '--rationale', 'the operator believes the pass finished fine', '--actor', 'operator'], { expectCode: 4 });
    cli(e.mailbox, ['reconcile-attempt', '--attempt-id', 'live', '--mark', 'abandoned',
      '--rationale', 'the operator no longer cares about this attempt', '--actor', 'operator'], { expectCode: 4 });
    assert.equal(latestAttemptFile(e.mailbox).status, 'reserved', 'unproven attempt is untouched');
  } finally {
    try { sleeper.kill('SIGKILL'); } catch { /* already gone */ }
  }
});

// ---------- consultation ----------

test('consult: one fork per ask; capture lands in reserved outbox; counter counts one advisor call', () => {
  const { e, t } = setup();
  cli(e.mailbox, askArgs());
  cli(e.mailbox, ['consult-run', '--ask-id', 'route-judgement'], { env: t.env });
  const candidatePath = join(e.mailbox, 'outbox', 'route-judgement.candidate.json');
  assert.ok(existsSync(candidatePath), 'advisor capture must land in the reserved outbox');
  const candidate = JSON.parse(readFileSync(candidatePath, 'utf8'));
  assert.equal(candidate.role, 'advisor');
  assert.equal(candidate.askId, 'route-judgement');
  assert.equal(candidate.inputDigest, sha('Judge the collected evidence for the chosen route.'));
  const s = JSON.parse(cli(e.mailbox, ['status']).out);
  assert.equal(s.counters.advisorCalls, 1);
  cli(e.mailbox, ['consult-run', '--ask-id', 'route-judgement'], { expectCode: 3, env: t.env });
  assert.equal(readChildLog(t.log).length, 1, 'still exactly one advisor child');
});

test('S2: a capture with a wrong input digest or foreign role is not trusted; the ask stays OPEN', () => {
  const { e, t } = setup();
  t.env.AB_FAKE_MODE = 'advisor-wrongdigest';
  cli(e.mailbox, askArgs());
  const r = cli(e.mailbox, ['consult-run', '--ask-id', 'route-judgement'], { expectCode: 3, env: t.env });
  assert.match(r.err, /digest|binding/i);
  const ask = JSON.parse(readFileSync(join(e.mailbox, 'asks', 'route-judgement.json'), 'utf8'));
  assert.equal(ask.status, 'open');
  t.env.AB_FAKE_MODE = 'advisor-wrongrole';
  cli(e.mailbox, ['consult-run', '--ask-id', 'route-judgement'], { expectCode: 3, env: t.env });
  assert.equal(JSON.parse(readFileSync(join(e.mailbox, 'asks', 'route-judgement.json'), 'utf8')).status, 'open');
});

test('S2: import refuses an unreserved capture and a stale ask bound to a superseded revision', () => {
  const { e, t } = setup();
  // unreserved capture: candidate file exists but no fork was ever reserved
  cli(e.mailbox, askArgs());
  writeFileSync(join(e.mailbox, 'outbox', 'route-judgement.candidate.json'),
    JSON.stringify({ role: 'advisor', askId: 'route-judgement', inputDigest: sha('Judge the collected evidence for the chosen route.'), answer: 'forged' }));
  const r1 = cli(e.mailbox, ['consult-import', '--ask-id', 'route-judgement'], { expectCode: 3, env: t.env });
  assert.match(r1.err, /reserved|fork/i);
  // stale ask: bound to revision 1, request advances to revision 2
  t.env.AB_FAKE_ANSWER = 'JUDGED: route OK';
  cli(e.mailbox, ['consult-run', '--ask-id', 'route-judgement'], { env: t.env });
  cli(e.mailbox, ['request', '--work-key', WORK_KEY, '--revision', '2', '--body', 'scope+criteria v2', '--actor', SENIOR]);
  const r2 = cli(e.mailbox, ['consult-import', '--ask-id', 'route-judgement'], { expectCode: 3, env: t.env });
  assert.match(r2.err, /superseded|stale|invalidat/i);
  const ask = JSON.parse(readFileSync(join(e.mailbox, 'asks', 'route-judgement.json'), 'utf8'));
  assert.equal(ask.status, 'open', 'stale decision must not advance the ask');
});

test('journal-only crash: import recovers the journaled decision without any advisor child', async () => {
  const { e, t, request } = setup();
  cli(e.mailbox, askArgs('route-judgement', 'Judge the evidence.'));
  const store = await import(join(REPO, 'scripts', 'advisor-bridge-beta', 'store.mjs'));
  const answer = 'JUDGED: route OK';
  const eventId = store.deriveDecisionEventId('route-judgement', answer);
  // simulate the crash window: the decision journal event is durable, nothing else is
  store.journalAppend(e.mailbox, {
    eventId,
    type: 'decision-captured',
    actor: 'bridge',
    payload: {
      askId: 'route-judgement',
      answerDigest: store.sha256(answer),
      answer,
      requestDigest: request.requestDigest,
    },
  });
  cli(e.mailbox, ['consult-import', '--ask-id', 'route-judgement'], { env: t.env });
  const askMd = readFileSync(join(e.mailbox, 'asks', 'route-judgement.md'), 'utf8');
  assert.match(askMd, /## Answer/);
  assert.match(askMd, /JUDGED: route OK/);
  assert.equal(readChildLog(t.log).length, 0, 'recovery must not fork the advisor');
  const s = JSON.parse(cli(e.mailbox, ['status']).out);
  assert.equal(s.counters.advisorCalls, 0);
  // re-import is a pure replay
  const again = JSON.parse(cli(e.mailbox, ['consult-import', '--ask-id', 'route-judgement'], { env: t.env }).out);
  assert.equal(again.replay, true);
  const askMd2 = readFileSync(join(e.mailbox, 'asks', 'route-judgement.md'), 'utf8');
  assert.equal((askMd2.match(/## Answer/g) ?? []).length, 1, 'Answer section not duplicated');
});

test('C2: the journaled answer survives outbox tampering; a completed import replays consistently', async () => {
  const { e, t } = setup();
  cli(e.mailbox, askArgs('crash-ask', 'judge'));
  t.env.AB_FAKE_ANSWER = 'answer A';
  cli(e.mailbox, ['consult-run', '--ask-id', 'crash-ask'], { env: t.env });
  const store = await import(join(REPO, 'scripts', 'advisor-bridge-beta', 'store.mjs'));
  const answer = 'answer A';
  const eventId = store.deriveDecisionEventId('crash-ask', answer);
  // crash after journal, before Answer: then the outbox candidate is replaced
  store.journalAppend(e.mailbox, {
    eventId,
    type: 'decision-captured',
    actor: 'bridge',
    payload: { askId: 'crash-ask', answerDigest: store.sha256(answer), answer, requestDigest: sha(REQUEST_BODY) },
  });
  writeFileSync(join(e.mailbox, 'outbox', 'crash-ask.candidate.json'),
    JSON.stringify({ role: 'advisor', askId: 'crash-ask', inputDigest: sha('judge'), answer: 'changed after journal' }));
  cli(e.mailbox, ['consult-import', '--ask-id', 'crash-ask'], { env: t.env });
  const askMd = readFileSync(join(e.mailbox, 'asks', 'crash-ask.md'), 'utf8');
  assert.match(askMd, /answer A/, 'recovery must import the JOURNALED answer');
  assert.ok(!askMd.includes('changed after journal'), 'mutable outbox bytes must not replace the committed decision');
  // the same decision event is not duplicated
  const decisionFiles = readdirSync(join(e.mailbox, 'decisions')).filter((n) => n.startsWith('dec-'));
  assert.equal(decisionFiles.length, 1);
  // crash after Answer: a later import with different outbox bytes stays a consistent replay
  writeFileSync(join(e.mailbox, 'outbox', 'crash-ask.candidate.json'),
    JSON.stringify({ role: 'advisor', askId: 'crash-ask', inputDigest: sha('judge'), answer: 'yet another answer' }));
  const again = JSON.parse(cli(e.mailbox, ['consult-import', '--ask-id', 'crash-ask'], { env: t.env }).out);
  assert.equal(again.replay, true);
  const askMd2 = readFileSync(join(e.mailbox, 'asks', 'crash-ask.md'), 'utf8');
  assert.equal(askMd2, askMd, 'Answer is not rewritten by a replay');
  const decisionFiles2 = readdirSync(join(e.mailbox, 'decisions')).filter((n) => n.startsWith('dec-'));
  assert.equal(decisionFiles2.length, 1);
});

test('consult with missing capture keeps the ask OPEN and HOLDs the import', () => {
  const { e, t } = setup();
  t.env.AB_FAKE_MODE = 'advisor-nooutput';
  cli(e.mailbox, askArgs('route-judgement', 'Judge the evidence.'));
  const r = cli(e.mailbox, ['consult-run', '--ask-id', 'route-judgement'], { expectCode: 3, env: t.env });
  assert.match(r.err, /capture|missing/i);
  cli(e.mailbox, ['consult-import', '--ask-id', 'route-judgement'], { expectCode: 3, env: t.env });
  const s = JSON.parse(cli(e.mailbox, ['status']).out);
  assert.equal(s.counters.advisorCalls, 1, 'the failed fork still consumed its call');
});

// ---------- reports: delivery envelope ----------

test('S3: the report envelope binds owner, request digest and ACKs; a foreign or unbound report cannot advance', () => {
  const { e, t, request } = setup();
  // foreign actor
  cli(e.mailbox, reportArgs({ status: 'PARTIAL', digest: request.requestDigest, actor: 'foreign-owner', extra: PARTIAL_EXTRA }), { expectCode: 4 });
  // wrong request digest
  cli(e.mailbox, reportArgs({ status: 'PARTIAL', digest: sha('some other request'), extra: PARTIAL_EXTRA }), { expectCode: 4 });
  // missing owner acknowledgement
  cli(e.mailbox, reportArgs({ status: 'PARTIAL', digest: request.requestDigest, extra: PARTIAL_EXTRA.slice(0, -1) }), { expectCode: 4 });
  // PARTIAL without artifacts/evidence
  cli(e.mailbox, reportArgs({ status: 'PARTIAL', digest: request.requestDigest, extra: ['--owner-ack'] }), { expectCode: 4 });
  const s0 = JSON.parse(cli(e.mailbox, ['status']).out);
  assert.equal(s0.taskState, 'prepared', 'no invalid report advanced the task');
  // valid prelaunch BLOCKED report (no owned pass yet) is accepted
  cli(e.mailbox, reportArgs({ reportId: 'rep-blocked', status: 'BLOCKED', digest: request.requestDigest,
    extra: ['--owner-ack', '--blocker', 'permission denial during the first launch attempt'] }));
  // DONE without an owned completed pass cannot certify execution
  cli(e.mailbox, reportArgs({ reportId: 'rep-done-early', status: 'DONE', digest: request.requestDigest,
    extra: DONE_EXTRA('no-such-pass', 'dec-nothing') }), { expectCode: 4 });
  const s1 = JSON.parse(cli(e.mailbox, ['status']).out);
  assert.equal(s1.taskState, 'reported');
});

test('S3+C1: a full DONE envelope with owned pass and consult ACK reaches accepted; identical retry replays', () => {
  const { e, t, request } = setup();
  cli(e.mailbox, runArgs(), { env: t.env });
  const attempt = latestAttemptFile(e.mailbox);
  cli(e.mailbox, askArgs());
  cli(e.mailbox, ['consult-run', '--ask-id', 'route-judgement'], { env: t.env });
  const imported = JSON.parse(cli(e.mailbox, ['consult-import', '--ask-id', 'route-judgement'], { env: t.env }).out);
  cli(e.mailbox, reportArgs({ status: 'DONE', digest: request.requestDigest,
    extra: DONE_EXTRA(attempt.attemptId, imported.decisionId) }));
  let s = JSON.parse(cli(e.mailbox, ['status']).out);
  assert.equal(s.taskState, 'reported');
  cli(e.mailbox, ['decide', '--report-id', 'rep-1', '--verdict', 'ACCEPTED', '--actor', SENIOR]);
  s = JSON.parse(cli(e.mailbox, ['status']).out);
  assert.equal(s.taskState, 'accepted');
  // identical retry of the same report bytes returns the existing receipt
  const retry = JSON.parse(cli(e.mailbox, reportArgs({ status: 'DONE', digest: request.requestDigest,
    extra: DONE_EXTRA(attempt.attemptId, imported.decisionId) }), { expectCode: 0 }).out);
  assert.equal(retry.replay, true, 'identical report retry must return the existing receipt');
});

test('zero exit with missing/invalid report does not pass; a valid envelope report then advances the state', () => {
  const { e, t, request } = setup();
  cli(e.mailbox, runArgs(), { env: t.env });
  let s = JSON.parse(cli(e.mailbox, ['status']).out);
  assert.equal(s.taskState, 'awaiting-report', 'exit 0 without a report is not DONE');
  // invalid envelope (no owner ack) does not pass
  cli(e.mailbox, reportArgs({ status: 'PARTIAL', digest: request.requestDigest, extra: PARTIAL_EXTRA.slice(0, -1) }), { expectCode: 4 });
  s = JSON.parse(cli(e.mailbox, ['status']).out);
  assert.equal(s.taskState, 'awaiting-report');
  cli(e.mailbox, reportArgs({ status: 'PARTIAL', digest: request.requestDigest, extra: PARTIAL_EXTRA }));
  s = JSON.parse(cli(e.mailbox, ['status']).out);
  assert.equal(s.taskState, 'reported');
});

test('C1: identical report, ask and verdict retries return the existing receipt after a delay', async () => {
  const { e, request } = setup();
  const delay = () => new Promise((r) => setTimeout(r, 15));
  cli(e.mailbox, askArgs('retry-ask', 'question'));
  const ask1 = JSON.parse(readFileSync(join(e.mailbox, 'asks', 'retry-ask.json'), 'utf8'));
  await delay();
  const ask2raw = cli(e.mailbox, askArgs('retry-ask', 'question'), { expectCode: 0 });
  const ask2 = JSON.parse(ask2raw.out);
  assert.equal(ask2.replay, true, 'identical ask retry must replay');
  assert.equal(ask2.createdAt, ask1.createdAt, 'timestamps are not reconstructed on replay');
  const first = JSON.parse(cli(e.mailbox, reportArgs({ status: 'PARTIAL', digest: request.requestDigest, extra: PARTIAL_EXTRA })).out);
  await delay();
  const retry = JSON.parse(cli(e.mailbox, reportArgs({ status: 'PARTIAL', digest: request.requestDigest, extra: PARTIAL_EXTRA }), { expectCode: 0 }).out);
  assert.equal(retry.replay, true);
  assert.equal(retry.importedAt, first.importedAt, 'report timestamps are not reconstructed on replay');
  await delay();
  cli(e.mailbox, ['decide', '--report-id', 'rep-1', '--verdict', 'REWORK', '--criteria', 'second dated verification required', '--actor', SENIOR]);
  const v1 = JSON.parse(readFileSync(join(e.mailbox, 'decisions', 'verdict-rep-1.json'), 'utf8'));
  await delay();
  const vRetry = JSON.parse(cli(e.mailbox, ['decide', '--report-id', 'rep-1', '--verdict', 'REWORK',
    '--criteria', 'second dated verification required', '--actor', SENIOR], { expectCode: 0 }).out);
  assert.equal(vRetry.replay, true);
  assert.equal(vRetry.decidedAt, v1.decidedAt, 'verdict timestamps are not reconstructed on replay');
  // a conflicting verdict under the same report is rejected
  cli(e.mailbox, ['decide', '--report-id', 'rep-1', '--verdict', 'ACCEPTED', '--actor', SENIOR], { expectCode: 4 });
});

test('stale revision: old report cannot be accepted after the request advanced; stale consultation does not close it either', () => {
  const { e, t, request } = setup();
  cli(e.mailbox, runArgs(), { env: t.env });
  const attempt = latestAttemptFile(e.mailbox);
  cli(e.mailbox, reportArgs({ status: 'PARTIAL', digest: request.requestDigest, extra: PARTIAL_EXTRA }));
  // r1 consultation completes while r1 is current
  const answeredAsk = 'stale-consult-ask';
  cli(e.mailbox, askArgs(answeredAsk, 'r1 judgement'));
  t.env.AB_FAKE_ANSWER = 'r1 judged';
  cli(e.mailbox, ['consult-run', '--ask-id', answeredAsk], { env: t.env });
  const staleAsk = JSON.parse(readFileSync(join(e.mailbox, 'asks', `${answeredAsk}.json`), 'utf8'));
  assert.equal(staleAsk.requestRevision, 1);
  cli(e.mailbox, ['consult-import', '--ask-id', answeredAsk], { env: t.env });
  const imported = JSON.parse(cli(e.mailbox, ['consult-import', '--ask-id', answeredAsk], { env: t.env }).out);
  // the senior revises the request (same workKey, owner preserved)
  cli(e.mailbox, ['request', '--work-key', WORK_KEY, '--revision', '2', '--body', 'scope+criteria v2', '--actor', SENIOR]);
  const r2 = JSON.parse(cli(e.mailbox, ['request', '--work-key', WORK_KEY, '--revision', '2', '--body', 'scope+criteria v2', '--actor', SENIOR]).out);
  assert.equal(r2.replay, true);
  // a late report for the old revision is rejected at import
  cli(e.mailbox, reportArgs({ reportId: 'rep-1b', status: 'PARTIAL', digest: request.requestDigest, extra: PARTIAL_EXTRA }), { expectCode: 4 });
  // the old report cannot be accepted against the new revision
  const d = cli(e.mailbox, ['decide', '--report-id', 'rep-1', '--verdict', 'ACCEPTED', '--actor', SENIOR], { expectCode: 4 });
  assert.match(d.err, /stale|revision/i);
  // a decision from revision 1 cannot back a DONE report on revision 2
  cli(e.mailbox, reportArgs({ reportId: 'rep-2-done', revision: '2', status: 'DONE', digest: r2.requestDigest,
    extra: DONE_EXTRA(attempt.attemptId, imported.decisionId) }), { expectCode: 4 });
  // a fresh r2 PARTIAL report and a rework verdict on it are recorded
  cli(e.mailbox, reportArgs({ reportId: 'rep-2', revision: '2', status: 'PARTIAL', digest: r2.requestDigest, extra: PARTIAL_EXTRA }));
  cli(e.mailbox, ['decide', '--report-id', 'rep-2', '--verdict', 'REWORK', '--criteria', 'add a dated second verification', '--actor', SENIOR]);
  const s = JSON.parse(cli(e.mailbox, ['status']).out);
  assert.equal(s.taskState, 'reported');
  const decisions = readdirSync(join(e.mailbox, 'decisions')).filter((n) => n.startsWith('verdict-'));
  assert.equal(decisions.length, 1);
});

test('decide is the senior alone; a foreign actor is rejected', () => {
  const { e, request } = setup();
  cli(e.mailbox, reportArgs({ status: 'PARTIAL', digest: request.requestDigest, extra: PARTIAL_EXTRA }));
  cli(e.mailbox, ['decide', '--report-id', 'rep-1', '--verdict', 'ACCEPTED', '--actor', OWNER], { expectCode: 4 });
  const s = JSON.parse(cli(e.mailbox, ['status']).out);
  assert.equal(s.taskState, 'reported', 'no acceptance happened');
});
