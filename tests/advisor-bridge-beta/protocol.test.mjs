import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, symlinkSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = resolve(join(fileURLToPath(import.meta.url), '..', '..', '..'));
const CLI = join(REPO, 'scripts', 'advisor-bridge-beta', 'cli.mjs');

function freshMailbox() {
  return mkdtempSync(join(tmpdir(), 'ab-beta-'));
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

const ENROLL_ARGS = [
  'enroll',
  '--pilot-id', 'pilot-test-1',
  '--senior-session', '01a11094-b236-7553-841d-1c5c998e2393',
  '--executor-worktree', '/tmp/ab-fake-executor-wt',
  '--coordination-dir', '/tmp/ab-fake-coordination',
  '--repo-common-dir', '/tmp/ab-fake-repo/.git',
];

test('enroll creates pilot config bound to explicit inputs; second enroll is rejected', () => {
  const mb = freshMailbox();
  const r = JSON.parse(cli(mb, ENROLL_ARGS).out);
  assert.equal(r.schemaVersion, 1);
  assert.equal(r.pilotId, 'pilot-test-1');
  assert.equal(r.limits.maxCcPasses, 3);
  assert.equal(r.limits.maxAdvisorCalls, 2);
  assert.equal(r.limits.processDeadlineMs, 20 * 60 * 1000);
  assert.equal(r.limits.admissionWindowMs, 60 * 60 * 1000);
  assert.ok(existsSync(join(mb, 'pilot.json')));
  cli(mb, ENROLL_ARGS, { expectCode: 4 });
});

test('status reports enrolled pilot with zeroed counters and open admission', () => {
  const mb = freshMailbox();
  cli(mb, ENROLL_ARGS);
  const s = JSON.parse(cli(mb, ['status']).out);
  assert.equal(s.enrolled, true);
  assert.equal(s.off, false);
  assert.equal(s.counters.ccPasses, 0);
  assert.equal(s.counters.advisorCalls, 0);
  assert.equal(s.ownership, null);
});

test('request submit binds digest; identical replay returns same receipt; changed bytes under same ID are rejected', () => {
  const mb = freshMailbox();
  cli(mb, ENROLL_ARGS);
  const body = 'scope: capability card; checks: help evidence';
  const first = JSON.parse(cli(mb, ['request', '--work-key', 'cap-card', '--revision', '1', '--body', body]).out);
  assert.equal(first.requestRevision, 1);
  assert.match(first.requestDigest, /^[0-9a-f]{64}$/);
  const replay = JSON.parse(cli(mb, ['request', '--work-key', 'cap-card', '--revision', '1', '--body', body]).out);
  assert.equal(replay.requestDigest, first.requestDigest);
  assert.equal(replay.replay, true);
  const changed = cli(mb, ['request', '--work-key', 'cap-card', '--revision', '1', '--body', body + ' tampered'], { expectCode: 4 });
  assert.match(changed.err + changed.out, /digest conflict/);
  // next revision with changed bytes is fine and preserves workKey
  const rev2 = JSON.parse(cli(mb, ['request', '--work-key', 'cap-card', '--revision', '2', '--body', body + ' v2']).out);
  assert.equal(rev2.requestRevision, 2);
  assert.notEqual(rev2.requestDigest, first.requestDigest);
});

test('ownership: first acquire wins, same owner is idempotent, foreign workKey rejected, owner survives reads', () => {
  const mb = freshMailbox();
  cli(mb, ENROLL_ARGS);
  const own = JSON.parse(cli(mb, ['own', '--work-key', 'cap-card', '--owner-token', 'tok-cc-1']).out);
  assert.equal(own.workKey, 'cap-card');
  const again = JSON.parse(cli(mb, ['own', '--work-key', 'cap-card', '--owner-token', 'tok-cc-1']).out);
  assert.equal(again.ownerToken, own.ownerToken);
  assert.equal(again.replay, true);
  cli(mb, ['own', '--work-key', 'other-card', '--owner-token', 'tok-cc-2'], { expectCode: 4 });
  const s = JSON.parse(cli(mb, ['status']).out);
  assert.equal(s.ownership.workKey, 'cap-card');
});

test('abandoned operation lock yields HOLD and is never auto-deleted', () => {
  const mb = freshMailbox();
  cli(mb, ENROLL_ARGS);
  const lockPath = join(mb, 'state', 'op-lock.lock');
  mkdirSync(join(mb, 'state'), { recursive: true });
  writeFileSync(lockPath, JSON.stringify({ holder: 'dead-session' }));
  const s = JSON.parse(cli(mb, ['status']).out);
  assert.equal(s.hold, true);
  assert.match(s.holdReasons.join(' '), /operation lock/);
  assert.ok(existsSync(lockPath), 'lock must not be auto-deleted');
  // mutations via request are also serialized: they HOLD while the lock file exists
  const r = cli(mb, ['request', '--work-key', 'k', '--revision', '1', '--body', 'b'], { expectCode: 3 });
  assert.match(r.err + r.out, /operation lock/);
});

test('path validation: traversal, symlink escape and absolute foreign paths are rejected', () => {
  const mb = freshMailbox();
  cli(mb, ENROLL_ARGS);
  cli(mb, ['request', '--work-key', '../escape', '--revision', '1', '--body', 'x'], { expectCode: 4 });
  // symlink escape: artifact target path inside mailbox pointing outside via symlink
  const outside = mkdtempSync(join(tmpdir(), 'ab-outside-'));
  mkdirSync(join(mb, 'reports'), { recursive: true });
  symlinkSync(outside, join(mb, 'reports', 'link'));
  cli(mb, ['report-import', '--work-key', 'cap-card', '--revision', '1', '--report-id', 'r1', '--status', 'DONE', '--dest-rel', 'reports/link/evil.json', '--body', 'x'], { expectCode: 4 });
  rmSync(outside, { recursive: true, force: true });
});

test('OFF blocks admission but reads and status remain available', () => {
  const mb = freshMailbox();
  cli(mb, ENROLL_ARGS);
  cli(mb, ['off', '--actor', 'senior']);
  const s = JSON.parse(cli(mb, ['status']).out);
  assert.equal(s.off, true);
  // admission-refusing command exits HOLD and names OFF
  const r = cli(mb, ['request', '--work-key', 'k', '--revision', '1', '--body', 'b'], { expectCode: 3 });
  assert.match(r.err + r.out, /OFF/);
  // reads still fine
  const s2 = JSON.parse(cli(mb, ['status']).out);
  assert.equal(s2.enrolled, true);
});

test('journal replay: same eventId returns the existing receipt without appending', async () => {
  const mb = freshMailbox();
  cli(mb, ENROLL_ARGS);
  const ev = { eventId: 'ev-1', type: 'test', actor: 'test', payload: { a: 1 } };
  const store = await import(join(REPO, 'scripts', 'advisor-bridge-beta', 'store.mjs'));
  const r1 = store.journalAppend(mb, ev);
  const r2 = store.journalAppend(mb, ev);
  assert.equal(r2.replay, true);
  assert.equal(r2.seq, r1.seq);
  const eventsDir = join(mb, 'events');
  const ev1Files = readdirSync(eventsDir).filter((n) => n.endsWith('-ev-1.json'));
  assert.equal(ev1Files.length, 1);
});

// ---------- wave 2: launch lifecycle ----------

const FAKE_CHILD = `import { appendFileSync, writeFileSync } from 'node:fs';
const args = process.argv.slice(2);
appendFileSync(process.env.AB_CHILD_LOG, JSON.stringify(args) + '\\n');
const o = args.indexOf('-o');
if (o >= 0) {
  if (process.env.AB_FAKE_MODE === 'advisor-nooutput') { process.exit(0); }
  writeFileSync(args[o + 1], JSON.stringify({ answer: process.env.AB_FAKE_ANSWER ?? 'JUDGED: route OK' }));
  process.exit(0);
}
const mode = process.env.AB_FAKE_MODE ?? 'ok';
if (mode === 'sleep') {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Number(process.env.AB_FAKE_SLEEP_MS ?? '5000'));
  process.exit(9);
}
if (mode === 'no-json') { process.stdout.write('garbage not json\\n'); process.exit(0); }
if (mode === 'exit1') { process.exit(1); }
const sidIdx = args.indexOf('--session-id');
const resIdx = args.indexOf('--resume');
const sid = sidIdx >= 0 ? args[sidIdx + 1] : (resIdx >= 0 ? args[resIdx + 1] : 'unknown');
process.stdout.write(JSON.stringify({ session_id: sid, result: 'OK', is_error: false }) + '\\n');
process.exit(0);
`;

function enrollTestMode(mb, extra = []) {
  const childBin = join(mb, 'fake-child.mjs');
  writeFileSync(childBin, FAKE_CHILD);
  mkdirSync(join(mb, 'wt'), { recursive: true });
  mkdirSync(join(mb, 'coordination'), { recursive: true });
  const log = join(mb, 'child-log.ndjson');
  return {
    childBin,
    log,
    env: { ...process.env, AB_CHILD_LOG: log },
    args: [...ENROLL_ARGS, '--test-mode', '--child-bin', childBin,
      '--executor-worktree', join(mb, 'wt'),
      '--coordination-dir', join(mb, 'coordination'), ...extra],
  };
}

function readChildLog(log) {
  if (!existsSync(log)) return [];
  return readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

function latestAttemptFile(mb) {
  const dir = join(mb, 'attempts');
  const files = readdirSync(dir).filter((n) => n.endsWith('.json')).sort();
  assert.ok(files.length >= 1, 'expected at least one attempt file');
  return JSON.parse(readFileSync(join(dir, files[files.length - 1]), 'utf8'));
}

test('test-mode run launches exactly the card argv, captures identity, counts one pass', () => {
  const mb = freshMailbox();
  const t = enrollTestMode(mb);
  cli(mb, t.args);
  cli(mb, ['run', '--work-key', 'cap-card', '--owner-token', 'tok-cc-1',
    '--prompt', 'do the card task', '--deadline-ms', '15000'], { env: t.env });
  const attempt = latestAttemptFile(mb);
  assert.equal(attempt.status, 'completed');
  assert.match(attempt.sessionId, /^[0-9a-f-]{36}$/);
  const launched = readChildLog(t.log);
  assert.equal(launched.length, 1);
  assert.deepEqual(launched[0].slice(0, 8), ['--model', 'glm-5.3', '--permission-prompts', 'none',
    '--output-format', 'json', '--session-id', attempt.sessionId]);
  assert.deepEqual(launched[0].slice(-2), ['-p', 'do the card task']);
  const s = JSON.parse(cli(mb, ['status']).out);
  assert.equal(s.counters.ccPasses, 1);
  assert.equal(s.ownership.workKey, 'cap-card');
});

test('two concurrent claim/run callers cause exactly one child launch', async () => {
  const mb = freshMailbox();
  const t = enrollTestMode(mb);
  cli(mb, t.args);
  const runArgs = (tok) => ['run', '--work-key', 'cap-card', '--owner-token', tok,
    '--prompt', 'p', '--deadline-ms', '15000'];
  const [a, b] = await Promise.all([
    cliAsync(mb, runArgs('tok-cc-A'), t.env),
    cliAsync(mb, runArgs('tok-cc-B'), t.env),
  ]);
  const codes = [a.code, b.code].sort();
  assert.deepEqual(codes, [0, 3], `one caller wins, one HOLDs; got ${a.code}/${b.code}`);
  assert.equal(readChildLog(t.log).length, 1, 'exactly one child launch');
});

test('lost capture (exit 0, no JSON receipt) leaves UNKNOWN; rerun does not relaunch', () => {
  const mb = freshMailbox();
  const t = enrollTestMode(mb);
  t.env.AB_FAKE_MODE = 'no-json';
  cli(mb, t.args);
  const r1 = cli(mb, ['run', '--work-key', 'cap-card', '--owner-token', 'tok-cc-1',
    '--prompt', 'p', '--deadline-ms', '15000'], { expectCode: 3, env: t.env });
  assert.match(r1.err, /UNKNOWN|unproven/);
  const r2 = cli(mb, ['run', '--work-key', 'cap-card', '--owner-token', 'tok-cc-1',
    '--prompt', 'p', '--deadline-ms', '15000'], { expectCode: 3, env: t.env });
  assert.match(r2.err, /reconcile|unknown/);
  assert.equal(readChildLog(t.log).length, 1, 'no automatic relaunch after lost capture');
});

test('pre-existing reserved attempt (spawn crash) HOLDs all new launches until reconcile', () => {
  const mb = freshMailbox();
  const t = enrollTestMode(mb);
  cli(mb, t.args);
  mkdirSync(join(mb, 'attempts'), { recursive: true });
  writeFileSync(join(mb, 'attempts', 'pass01-crash.json'), JSON.stringify({
    schemaVersion: 1, attemptId: 'crash', passNumber: 1, status: 'reserved',
    workKey: 'cap-card', sessionId: '11111111-1111-1111-1111-111111111111',
  }));
  const r = cli(mb, ['run', '--work-key', 'cap-card', '--owner-token', 'tok-cc-1',
    '--prompt', 'p', '--deadline-ms', '15000'], { expectCode: 3, env: t.env });
  assert.match(r.err, /reserved|reconcile/);
  assert.equal(readChildLog(t.log).length, 0);
});

test('OFF before run causes zero new launches', () => {
  const mb = freshMailbox();
  const t = enrollTestMode(mb);
  cli(mb, t.args);
  cli(mb, ['off', '--actor', 'senior']);
  const r = cli(mb, ['run', '--work-key', 'cap-card', '--owner-token', 'tok-cc-1',
    '--prompt', 'p', '--deadline-ms', '15000'], { expectCode: 3, env: t.env });
  assert.match(r.err, /OFF/);
  assert.equal(readChildLog(t.log).length, 0);
  const s = JSON.parse(cli(mb, ['status']).out);
  assert.equal(s.counters.ccPasses, 0);
});

test('resume pass resumes the recorded exact session id after proven cessation', () => {
  const mb = freshMailbox();
  const t = enrollTestMode(mb);
  cli(mb, t.args);
  cli(mb, ['run', '--work-key', 'cap-card', '--owner-token', 'tok-cc-1',
    '--prompt', 'p1', '--deadline-ms', '15000'], { env: t.env });
  const first = latestAttemptFile(mb);
  cli(mb, ['run', '--work-key', 'cap-card', '--owner-token', 'tok-cc-1', '--resume',
    '--prompt', 'p2', '--deadline-ms', '15000'], { env: t.env });
  const second = JSON.parse(readFileSync(join(mb, 'attempts',
    readdirSync(join(mb, 'attempts')).filter((n) => n.endsWith('.json')).sort()[1]), 'utf8'));
  assert.equal(second.status, 'completed');
  assert.equal(second.resumeFrom, first.sessionId);
  assert.equal(second.sessionId, first.sessionId, 'exact-ID resume binds the same session');
  const launched = readChildLog(t.log);
  assert.equal(launched.length, 2);
  assert.deepEqual(launched[1].slice(6, 10), ['--resume', first.sessionId, '-p', 'p2']);
  const s = JSON.parse(cli(mb, ['status']).out);
  assert.equal(s.counters.ccPasses, 2);
});

test('deadline kill never releases an unproven owner; next run HOLDs', () => {
  const mb = freshMailbox();
  const t = enrollTestMode(mb);
  t.env.AB_FAKE_MODE = 'sleep';
  t.env.AB_FAKE_SLEEP_MS = '10000';
  cli(mb, t.args);
  cli(mb, ['run', '--work-key', 'cap-card', '--owner-token', 'tok-cc-1',
    '--prompt', 'p', '--deadline-ms', '400'], { expectCode: 3, env: t.env });
  const attempt = latestAttemptFile(mb);
  assert.equal(attempt.status, 'deadline-unknown');
  assert.ok(attempt.cessation.verifiedEnded, 'child must be proven dead after deadline kill');
  const own = JSON.parse(cli(mb, ['own', '--work-key', 'cap-card', '--owner-token', 'tok-cc-1']).out);
  assert.equal(own.workKey, 'cap-card', 'ownership survives the deadline');
  assert.equal(own.replay, true);
  const r = cli(mb, ['run', '--work-key', 'cap-card', '--owner-token', 'tok-cc-1',
    '--prompt', 'p', '--deadline-ms', '15000'], { expectCode: 3, env: t.env });
  assert.match(r.err, /deadline-unknown|reconcile/);
  assert.equal(readChildLog(t.log).length, 1, 'no relaunch while owner unproven');
});

// ---------- wave 3: consultation, reports, verdicts ----------

const SENIOR = '01a11094-b236-7553-841d-1c5c998e2393';

function enrollFull(mb, { answer = 'JUDGED: route OK' } = {}) {
  const t = enrollTestMode(mb);
  t.env.AB_FAKE_ANSWER = answer;
  cli(mb, t.args);
  cli(mb, ['request', '--work-key', 'cap-card', '--revision', '1', '--body', 'scope+criteria v1']);
  return t;
}

test('consult: one fork per ask; capture lands in reserved outbox; counter counts one advisor call', () => {
  const mb = freshMailbox();
  const t = enrollFull(mb);
  cli(mb, ['ask', '--ask-id', 'route-judgement', '--question', 'Judge the collected evidence for the chosen route.']);
  cli(mb, ['consult-run', '--ask-id', 'route-judgement'], { env: t.env });
  const candidatePath = join(mb, 'outbox', 'route-judgement.candidate.json');
  assert.ok(existsSync(candidatePath), 'advisor capture must land in the reserved outbox');
  const s = JSON.parse(cli(mb, ['status']).out);
  assert.equal(s.counters.advisorCalls, 1);
  // second fork for the same ask is refused even before import
  cli(mb, ['consult-run', '--ask-id', 'route-judgement'], { expectCode: 3, env: t.env });
  assert.equal(readChildLog(t.log).length, 1, 'still exactly one advisor child');
});

test('journal-only crash: import replays from the journal without a second advisor call', async () => {
  const mb = freshMailbox();
  const t = enrollFull(mb);
  cli(mb, ['ask', '--ask-id', 'route-judgement', '--question', 'Judge the evidence.']);
  cli(mb, ['consult-run', '--ask-id', 'route-judgement'], { env: t.env });
  // simulate crash after the journal step: write ONLY the journal event
  const store = await import(join(REPO, 'scripts', 'advisor-bridge-beta', 'store.mjs'));
  const answer = 'JUDGED: route OK';
  const eventId = store.deriveDecisionEventId('route-judgement', answer);
  store.journalAppend(mb, {
    eventId,
    type: 'decision-captured',
    actor: 'bridge',
    payload: { askId: 'route-judgement', answerDigest: store.sha256(answer) },
  });
  cli(mb, ['consult-import', '--ask-id', 'route-judgement'], { env: t.env });
  const askMd = readFileSync(join(mb, 'asks', 'route-judgement.md'), 'utf8');
  assert.match(askMd, /## Answer/);
  assert.match(askMd, /JUDGED: route OK/);
  const s = JSON.parse(cli(mb, ['status']).out);
  assert.equal(s.counters.advisorCalls, 1, 'import replay must not consume a second advisor call');
  assert.equal(readChildLog(t.log).length, 1);
  // re-import is a pure replay: same receipt, Answer not duplicated
  const again = JSON.parse(cli(mb, ['consult-import', '--ask-id', 'route-judgement'], { env: t.env }).out);
  assert.equal(again.replay, true);
  const askMd2 = readFileSync(join(mb, 'asks', 'route-judgement.md'), 'utf8');
  assert.equal((askMd2.match(/## Answer/g) ?? []).length, 1, 'Answer section not duplicated');
});

test('consult with missing capture keeps the ask OPEN and HOLDs the import', () => {
  const mb = freshMailbox();
  const t = enrollFull(mb);
  t.env.AB_FAKE_MODE = 'advisor-nooutput';
  cli(mb, ['ask', '--ask-id', 'route-judgement', '--question', 'Judge the evidence.']);
  const r = cli(mb, ['consult-run', '--ask-id', 'route-judgement'], { expectCode: 3, env: t.env });
  assert.match(r.err, /capture|missing/i);
  cli(mb, ['consult-import', '--ask-id', 'route-judgement'], { expectCode: 3, env: t.env });
  const s = JSON.parse(cli(mb, ['status']).out);
  assert.equal(s.counters.advisorCalls, 1, 'the failed fork still consumed its call');
});

test('zero exit with missing/invalid report does not pass; valid report then verdict advance the state', () => {
  const mb = freshMailbox();
  const t = enrollFull(mb);
  cli(mb, ['run', '--work-key', 'cap-card', '--owner-token', 'tok-cc-1',
    '--prompt', 'do the card task', '--deadline-ms', '15000'], { env: t.env });
  let s = JSON.parse(cli(mb, ['status']).out);
  assert.equal(s.taskState, 'awaiting-report', 'exit 0 without a report is not DONE');
  cli(mb, ['report-import', '--work-key', 'cap-card', '--revision', '1', '--report-id', 'rep-1',
    '--status', 'DONE', '--body', '   '], { expectCode: 4 });
  s = JSON.parse(cli(mb, ['status']).out);
  assert.equal(s.taskState, 'awaiting-report');
  cli(mb, ['report-import', '--work-key', 'cap-card', '--revision', '1', '--report-id', 'rep-1',
    '--status', 'DONE', '--body', 'REPORT DONE: criteria mapped to evidence']);
  s = JSON.parse(cli(mb, ['status']).out);
  assert.equal(s.taskState, 'reported');
});

test('stale revision: old report cannot be accepted after the request advanced', () => {
  const mb = freshMailbox();
  const t = enrollFull(mb);
  cli(mb, ['report-import', '--work-key', 'cap-card', '--revision', '1', '--report-id', 'rep-1',
    '--status', 'DONE', '--body', 'evidence for r1']);
  // senior revises the request (same workKey, owner preserved)
  cli(mb, ['request', '--work-key', 'cap-card', '--revision', '2', '--body', 'scope+criteria v2', '--actor', SENIOR]);
  // a late report for the old revision is rejected at import
  cli(mb, ['report-import', '--work-key', 'cap-card', '--revision', '1', '--report-id', 'rep-1b',
    '--status', 'DONE', '--body', 'late r1 evidence'], { expectCode: 4 });
  // and the old report cannot be accepted against the new revision
  const d = cli(mb, ['decide', '--report-id', 'rep-1', '--verdict', 'ACCEPTED',
    '--actor', SENIOR], { expectCode: 4 });
  assert.match(d.err, /stale|revision/i);
  // rework verdict on the CURRENT revision's report is recorded
  cli(mb, ['report-import', '--work-key', 'cap-card', '--revision', '2', '--report-id', 'rep-2',
    '--status', 'PARTIAL', '--body', 'fresh evidence r2']);
  cli(mb, ['decide', '--report-id', 'rep-2', '--verdict', 'REWORK', '--criteria', 'add a dated second verification', '--actor', SENIOR]);
  const s = JSON.parse(cli(mb, ['status']).out);
  assert.equal(s.taskState, 'reported');
  const decisions = readdirSync(join(mb, 'decisions')).filter((n) => n.startsWith('verdict-'));
  assert.equal(decisions.length, 1);
});

test('decide is the senior alone; a foreign actor is rejected', () => {
  const mb = freshMailbox();
  const t = enrollFull(mb);
  cli(mb, ['report-import', '--work-key', 'cap-card', '--revision', '1', '--report-id', 'rep-1',
    '--status', 'DONE', '--body', 'evidence']);
  cli(mb, ['decide', '--report-id', 'rep-1', '--verdict', 'ACCEPTED', '--actor', 'tok-cc-1'], { expectCode: 4 });
  const s = JSON.parse(cli(mb, ['status']).out);
  assert.equal(s.taskState, 'reported', 'no acceptance happened');
});

