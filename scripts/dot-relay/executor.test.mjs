// Dot relay executor supervisor tests — DESIGN.md §Executor + §Worker startup
// + IMPLEMENTATION-EXACT Task 3 table. Fake child spawn and fake gh
// argument-array runner only; no model is ever invoked.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync, readdirSync, existsSync, statSync, lstatSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawn as childSpawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { openLedger } from './ledger.mjs';
import { digest, CHAT_IDS, reportKey } from './contract.mjs';
import {
  buildArgv, buildResumeArgv, runExecution, resumeExecution, monitorAdoptedChild, verifyPr, applyReviewAndVerify,
  isOwnedChild, startActiveClock, parseAgentsCensus,
  validateFreshnessWindow, sampleOnceIndependent,
  GLM_WRAPPER, ALLOW_TOOLS, DISALLOWED_TOOLS,
} from './executor.mjs';

const sha256Of = (s) => createHash('sha256').update(s).digest('hex');
const sha40 = (s) => sha256Of(s).slice(0, 40);

let nowMs = 5_000_000;
const now = () => nowMs;

const BASE_SHA = sha40('origin-staging-base');
const HEAD = sha40('pr-head');

// ---------------------------------------------------------------- fakes

function fakeChild({ pid = 4242, start = '2026-10-08T10:00:00.000Z', ignoreKills = false, probeImpl = null } = {}) {
  const exitCbs = [];
  const c = {
    pid,
    start,
    kills: [],
    alive: true,
    onExit(cb) { exitCbs.push(cb); },
    kill(sig) {
      c.kills.push(sig);
      if (ignoreKills) return true; // R09: a child that shrugs off signals
      if (!c.alive) return false;
      c.alive = false;
      for (const cb of exitCbs) cb(null, sig);
      return true;
    },
    exit(code) {
      if (!c.alive) return;
      c.alive = false;
      c.exitCode = code;
      for (const cb of exitCbs) cb(code, null);
    },
    // R09 pre-signal identity source: found=false models ps "no such process".
    // Reads the LIVE c.pid/c.start so a test mutating them (PID-reuse models)
    // is visible to the supervisor's probe — the closure captures are stale.
    probe() {
      if (typeof probeImpl === 'function') return probeImpl();
      return { pid: c.pid, start: c.alive ? c.start : null, found: c.alive };
    },
  };
  return c;
}

function captureSpawn(child) {
  return (executable, argv, opts) => {
    child.executable = executable;
    child.argv = argv;
    child.opts = opts;
    return child;
  };
}

// HOST-RESILIENCE §3: injectable ActiveClock — the ONLY budget source.
// advancePerReadMs simulates host-awake time burned per sample read;
// rewindMs produces a BACKWARDS sample; breakClock simulates helper death
// (broken pipe / EOF / unprovable mach clock); breakFreshness simulates the
// R08 independent-freshness verdict failing while the stream still flows —
// all fail closed.
function fakeClock({ bootId = 'BOOT-EX', activeNs = 1_000_000_000n, advancePerReadMs = 0 } = {}) {
  let ns = activeNs;
  let broken = false;
  let freshOk = true;
  return {
    ok: () => !broken,
    bootId: () => bootId,
    activeNs: () => {
      ns += BigInt(advancePerReadMs) * 1_000_000n;
      return broken ? null : ns;
    },
    fresh: () => freshOk,
    advanceMs: (ms) => { ns += BigInt(ms) * 1_000_000n; },
    rewindMs: (ms) => { ns -= BigInt(ms) * 1_000_000n; },
    breakClock: () => { broken = true; },
    breakFreshness: () => { freshOk = false; },
    restoreFreshness: () => { freshOk = true; },
  };
}

// Sync gitImpl stub answering the supervisor's base/startup probes.
function gitOk({ head = BASE_SHA, branch = null, status = '', toplevel = null } = {}) {
  const calls = [];
  const impl = (args, { cwd } = {}) => {
    calls.push({ args, cwd });
    const j = args.join(' ');
    if (j === 'fetch origin staging') return { code: 0, stdout: '' };
    if (j === 'rev-parse origin/staging') return { code: 0, stdout: `${BASE_SHA}\n` };
    if (j === 'rev-parse --show-toplevel') return { code: 0, stdout: `${toplevel ?? cwd}\n` };
    if (j === 'rev-parse HEAD') return { code: 0, stdout: `${head}\n` };
    if (j === 'branch --show-current') return { code: 0, stdout: `${branch ?? 'codex/dot-job-x'}\n` };
    if (j === 'status --porcelain') return { code: 0, stdout: status };
    if (args[1] === '--verify') return { code: 128, stdout: '' }; // branch does not exist
    return { code: 0, stdout: '' };
  };
  impl.calls = calls;
  return impl;
}

// ---------------------------------------------------------------- ledger fixture

// R04-corrected fixture plumbing: production provenance (public manifests) +
// destination-role ACKs. Without these the solution stays WAIT_PARENT_ACK and
// no execution can ever be claimed.
const manifestFor = (e, destination) => ({
  version: 1, status: 'READY', event_id: e.id, kind: e.kind, producer: e.producer,
  destination, sha256: sha256Of(JSON.stringify(e)), bytes: Buffer.byteLength(JSON.stringify(e)),
  parents: e.parents, artifact: { page_id: `page-${e.id}`, reference: 'library-file:fixtures.json' }, delivery_id: null,
});

function ackedDelivery(ledger, event, { role, destinationRole }) {
  const manifest = manifestFor(event, destinationRole);
  ledger.manifestImport({ manifest, producerRole: role, cursorToken: `tok-${event.id}` });
  const d = ledger.pendingDeliveries().find((x) => x.event_id === event.id);
  ledger.claimDelivery(d.delivery_id);
  ledger.ack(
    { delivery_id: d.delivery_id, event_id: event.id, event_sha256: event.sha256, artifact_sha256: manifest.sha256, accepted: true, duplicate: false },
    { trustedProducerRole: destinationRole },
  );
}

// R11: the durable private packet a prior attempt leaves behind — the two
// immutable worker files (exact kickoff bytes + a constant framing contract)
// plus the digest set the checkpoint pins. Production framing content is the
// executor's own; resume verification binds whatever bytes were written, so the
// fixture's framing text only needs to be stable within the test.
function writePacketFiles(dir, executionId, solution) {
  const kickoffText = String(solution.payload.kickoff);
  const framingText = `# dot relay worker framing (fixture)\nconstant contract text for ${executionId}\n`;
  writeFileSync(join(dir, 'worker', `${executionId}.kickoff.md`), kickoffText, { mode: 0o600 });
  writeFileSync(join(dir, 'worker', `${executionId}.framing.md`), framingText, { mode: 0o600 });
  return {
    artifact_sha256: sha256Of(JSON.stringify(solution)),
    artifact_bytes: Buffer.byteLength(JSON.stringify(solution)),
    kickoff_sha256: sha256Of(kickoffText),
    framing_sha256: sha256Of(framingText),
  };
}

function queuedSolution(ledger) {
  const mk = (kind, id, producer, parents, payload) => {
    const e = { version: 1, kind, id, producer, parents, payload, sha256: null };
    e.sha256 = digest(e);
    return e;
  };
  const reports = [];
  for (let i = 0; i < 3; i++) {
    const body = `executor-fixture body ${i} ${'z'.repeat(20)}`;
    reports.push({ repository: 'artyhoo/getff', pr: 2200, comment_id: `ex-${i}`, body_sha256: sha256Of(body), reviewed_sha: sha40(`rv-${i}`), body });
  }
  const batch = mk('batch', `DOT-EX-B-${randomUUID().slice(0, 8)}`, CHAT_IDS.collector, [], { batch_id: 'B-ex', reports, complete: true });
  ledger.ingest(batch);
  ackedDelivery(ledger, batch, { role: 'collector', destinationRole: 'analyst' });
  const analysis = mk('analysis', `DOT-EX-A-${randomUUID().slice(0, 8)}`, CHAT_IDS.analyst, [{ id: batch.id, sha256: batch.sha256 }], {
    consumed_report_keys: reports.map((r) => reportKey(r)),
    candidates: [{ candidate_id: 'C1', finding_keys: ['F1'], report_keys: [reportKey(reports[0])], reviewed_sha: reports[0].reviewed_sha, summary: 's' }],
    excluded: [],
  });
  ledger.ingest(analysis);
  ackedDelivery(ledger, analysis, { role: 'analyst', destinationRole: 'solver' });
  const kickoff = '# executor fixture kickoff\nrun the plan\n';
  const commands = [{ argv: ['node', '--test', 'x.test.mjs'], cwd: 'worktree', expected_exit: 0 }];
  const solution = mk('solution', `DOT-EX-S-${randomUUID().slice(0, 8)}`, CHAT_IDS.solver, [{ id: analysis.id, sha256: analysis.sha256 }], {
    candidate_id: 'C1',
    finding_keys: ['F1'],
    reviewed_sha: sha40('rv-0'), // must equal the referenced analysis candidate's digest (R04)
    base_sha: BASE_SHA,
    ready: true,
    unresolved: [],
    prerequisites: [{ name: 'fetch', passed: true, evidence: 'fetched' }],
    scope_paths: ['scripts/dot-relay/executor.mjs'],
    kickoff,
    commands,
    verify_commands: commands,
    acceptance: ['green'],
    kickoff_sha256: sha256Of(kickoff),
    commands_sha256: digest(commands),
  });
  ledger.ingest(solution);
  // R11: the solution's public manifest is the ONLY whole-artifact authority —
  // run/resume packet verification reads it, so the fixture registers it the
  // way production does (solver manifest of the solution event).
  ledger.manifestImport({ manifest: manifestFor(solution, 'coordinator'), producerRole: 'solver', cursorToken: `tok-${solution.id}` });
  return solution;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// R10: the production outer capture shape. The harness `--output-format json`
// result field is a STRING — exactly one strict JSON object (the CODE_COMPLETE
// worker report) whole-string parsed, <=16384 UTF-8 bytes, no fences/prose.
const codeCompleteReport = ({
  executionId, sessionId, solution, artifactSha256, prUrl,
  headSha = HEAD, sourceTreeDigest = null, reviewRef = null,
}) => ({
  version: 1,
  status: 'CODE_COMPLETE',
  execution_id: executionId,
  session_id: sessionId,
  solution_sha256: solution.sha256,
  artifact_sha256: artifactSha256,
  source_tree_digest: sourceTreeDigest ?? sha256Of(`source-tree:${solution.sha256}`),
  pr_url: prUrl,
  head_sha: headSha,
  independent_review_ref: reviewRef,
});

// The OUTER object keeps the runtime session id (parseChildResult's trusted
// identity checks); the report string inside may deliberately disagree.
const outerCapture = (sessionId, result, { isError = false } = {}) => ({
  session_id: sessionId,
  modelUsage: { 'glm-5.3': 1 },
  is_error: isError,
  result,
});

// The OS-owner independent review receipt matching a captured report.
const ownerReviewReceipt = (report, overrides = {}) => ({
  version: 1,
  execution_id: report.execution_id,
  session_id: report.session_id,
  solution_sha256: report.solution_sha256,
  artifact_sha256: report.artifact_sha256,
  source_tree_digest: report.source_tree_digest,
  head_sha: report.head_sha,
  reviewer: 'dot-relay-os-owner',
  verdict: 'APPROVE',
  ...overrides,
});

// RED-phase boundedness guard: assertions taken WHILE a supervisor promise is
// in flight can throw (that is the point of a RED test) and leave the
// un-awaited supervisor polling forever on a frozen fake clock — hanging the
// runner after the verdict line. Any mid-run assertion block runs through
// this: on failure the fake child is killed, the supervisor promise is
// drained to a verdict, and only then is the assertion error rethrown.
async function guardedMidRun(r, child, fn) {
  try {
    return await fn();
  } catch (e) {
    try { child.kill('SIGKILL'); } catch { /* already dead */ }
    try { await r; } catch { /* the supervisor verdict is not under test here */ }
    throw e;
  }
}

function env0() {
  const dir = mkdtempSync(join(tmpdir(), 'dot-exec-'));
  mkdirSync(join(dir, 'worker'), { recursive: true });
  const ledger = openLedger(join(dir, 'ledger.sqlite'), { now });
  return { dir, ledger };
}

// ---------------------------------------------------------------- buildArgv

test('buildArgv is the exact argument array: model pin, native worktree, allowlist, no shell', () => {
  const argv = buildArgv({ sessionId: '11111111-1111-4111-8111-111111111111', prompt: 'do the work', worktreeName: 'dot-relay-abc123def456' });
  assert.ok(Array.isArray(argv));
  assert.deepEqual(argv, [
    '--model', 'glm-5.3',
    '--permission-mode', 'acceptEdits',
    '--permission-prompts', 'none',
    '--output-format', 'json',
    '--session-id', '11111111-1111-4111-8111-111111111111',
    '--worktree', 'dot-relay-abc123def456',
    '--allowedTools', ALLOW_TOOLS,
    '--disallowedTools', DISALLOWED_TOOLS,
    '-p', 'do the work',
  ]);
  // DESIGN.md:62 — worktreeName is REQUIRED: never launch on the shared checkout
  assert.throws(() => buildArgv({ sessionId: '11111111-1111-4111-8111-111111111111', prompt: 'p' }), /worktreeName/);
  assert.ok(ALLOW_TOOLS.includes('Bash(git switch -c codex/dot-scripted-relay*)'));
  assert.ok(ALLOW_TOOLS.includes('Bash(git switch -c codex/dot-job-*)'));
  assert.ok(ALLOW_TOOLS.includes('Bash(gh pr view*)'));
  assert.equal(DISALLOWED_TOOLS, 'Bash(gh pr merge*) Bash(git push *--force*) Bash(git rebase*)');
  assert.equal(GLM_WRAPPER, '/Users/art/.local/bin/glm');
});

test('buildResumeArgv resumes the EXACT session: --resume, never --session-id/--worktree/--continue', () => {
  const argv = buildResumeArgv({ sessionId: '22222222-2222-4222-8222-222222222222', prompt: 'continue the accepted work' });
  assert.deepEqual(argv, [
    '--model', 'glm-5.3',
    '--permission-mode', 'acceptEdits',
    '--permission-prompts', 'none',
    '--output-format', 'json',
    '--resume', '22222222-2222-4222-8222-222222222222',
    '--allowedTools', ALLOW_TOOLS,
    '--disallowedTools', DISALLOWED_TOOLS,
    '-p', 'continue the accepted work',
  ]);
  // identical permission settings, but NO new session, NO new worktree, no --continue
  assert.ok(!argv.includes('--session-id'));
  assert.ok(!argv.includes('--worktree'));
  assert.ok(!argv.includes('--continue'));
});

// ---------------------------------------------------------------- reservation / launch

test('concurrent second reservation is refused while the first holds the slot', async () => {
  const { dir, ledger } = env0();
  const solution = queuedSolution(ledger);
  const child = fakeChild();
  const git = gitOk();
  const first = runExecution({
    ledger, solution, worktree: dir, dir,
    spawnImpl: captureSpawn(child), gitImpl: git,
    clock: fakeClock(),
    pollIntervalMs: 5, startupTimeoutMs: 10_000, deadlineMs: 10_000,
  });
  await sleep(20); // first is RUNNING now
  const second = await runExecution({
    ledger, solution, worktree: dir, dir,
    spawnImpl: captureSpawn(fakeChild({ pid: 9999 })), gitImpl: git,
    clock: fakeClock(),
    pollIntervalMs: 5, startupTimeoutMs: 50, deadlineMs: 50,
  });
  // R07: the worker slot is acquired BEFORE the claim, so the second launch is
  // refused at the live-owner lock gate (or, in the pre-lock race window, at
  // the execution claim) — either way exactly one supervisor runs.
  assert.ok(
    second.state === 'HELD' || (second.state === 'BLOCKED' && second.blocker === 'SUPERVISOR_LOCK'),
    `second launch refused (got ${JSON.stringify(second)})`,
  );
  child.kill('SIGKILL'); // cleanup
  const r = await first;
  assert.ok(['UNCERTAIN', 'BLOCKED'].includes(r.state));
  rmSync(dir, { recursive: true, force: true });
});

test('missing wrapper (proven pid absent) checkpoints BLOCKED_LAUNCH and frees the slot', async () => {
  const { dir, ledger } = env0();
  const solution = queuedSolution(ledger);
  const spawnImpl = () => { throw Object.assign(new Error('spawn glm ENOENT'), { code: 'ENOENT' }); };
  const r = await runExecution({ ledger, solution, worktree: dir, dir, spawnImpl, clock: fakeClock(), gitImpl: gitOk(), pollIntervalMs: 5 });
  assert.equal(r.state, 'BLOCKED');
  assert.equal(r.blocker, 'BLOCKED_LAUNCH');
  assert.equal(ledger.status().execution, null); // BLOCKED is not an active state — slot freed
  rmSync(dir, { recursive: true, force: true });
});

test('permission refusal checkpoints BLOCKED_PERMISSION, never broadens allowlist', async () => {
  const { dir, ledger } = env0();
  const solution = queuedSolution(ledger);
  const spawnImpl = () => { throw Object.assign(new Error('denied'), { code: 'EACCES' }); };
  const r = await runExecution({ ledger, solution, worktree: dir, dir, spawnImpl, clock: fakeClock(), gitImpl: gitOk(), pollIntervalMs: 5 });
  assert.equal(r.state, 'BLOCKED');
  assert.equal(r.blocker, 'BLOCKED_PERMISSION');
  rmSync(dir, { recursive: true, force: true });
});

test('uncertain spawn failure holds the slot as UNCERTAIN (crash before proven outcome)', async () => {
  const { dir, ledger } = env0();
  const solution = queuedSolution(ledger);
  const spawnImpl = () => { throw Object.assign(new Error('EAGAIN'), { code: 'EAGAIN' }); };
  const r = await runExecution({ ledger, solution, worktree: dir, dir, spawnImpl, clock: fakeClock(), gitImpl: gitOk(), pollIntervalMs: 5 });
  assert.equal(r.state, 'UNCERTAIN');
  assert.equal(ledger.status().execution.state, 'UNCERTAIN'); // slot held, no TTL release
  rmSync(dir, { recursive: true, force: true });
});

test('stale base (origin/staging drift) never launches: BLOCKED_STALE_BASE', async () => {
  const { dir, ledger } = env0();
  const solution = queuedSolution(ledger);
  const git = gitOk();
  const impl = (args, o) => {
    if (args.join(' ') === 'rev-parse origin/staging') return { code: 0, stdout: `${'1'.repeat(40)}\n` };
    return git(args, o);
  };
  let spawned = 0;
  const r = await runExecution({
    ledger, solution, worktree: dir, dir,
    spawnImpl: () => { spawned += 1; return fakeChild(); },
    clock: fakeClock(),
    gitImpl: impl, pollIntervalMs: 5,
  });
  assert.equal(r.state, 'BLOCKED');
  assert.equal(r.blocker, 'BLOCKED_STALE_BASE');
  assert.equal(spawned, 0); // never launched on stale base
  rmSync(dir, { recursive: true, force: true });
});

test('existing job branch is BLOCKED_BRANCH_EXISTS, no reset/reuse', async () => {
  const { dir, ledger } = env0();
  const solution = queuedSolution(ledger);
  const git = gitOk();
  const impl = (args, o) => {
    if (args[0] === 'rev-parse' && args[1] === '--verify') return { code: 0, stdout: 'refs/heads/codex/dot-job-x\n' };
    return git(args, o);
  };
  let spawned = 0;
  const r = await runExecution({
    ledger, solution, worktree: dir, dir,
    spawnImpl: () => { spawned += 1; return fakeChild(); },
    clock: fakeClock(),
    gitImpl: impl, pollIntervalMs: 5,
  });
  assert.equal(r.blocker, 'BLOCKED_BRANCH_EXISTS');
  assert.equal(spawned, 0);
  rmSync(dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------- capture

test('session/model mismatch in child output cannot complete: BLOCKED_CAPTURE', async () => {
  const { dir, ledger } = env0();
  const solution = queuedSolution(ledger);
  const child = fakeChild();
  const jobBranch = `codex/dot-job-${solution.sha256.slice(0, 12)}`;
  const r = runExecution({
    ledger, solution, worktree: dir, dir,
    spawnImpl: captureSpawn(child), gitImpl: gitOk({ head: BASE_SHA, branch: jobBranch }),
    clock: fakeClock(),
    pollIntervalMs: 5, startupTimeoutMs: 200, deadlineMs: 5_000,
  });
  await sleep(10);
  writeFileSync(child.opts.env.DOT_RELAY_STARTUP_RECEIPT, JSON.stringify({
    session_id: child.opts.env.DOT_RELAY_SESSION_ID,
    execution_id: child.opts.env.DOT_RELAY_EXECUTION_ID,
    worktree: dir,
  }));
  await sleep(30);
  // wrong session id in stdout capture
  writeFileSync(child.opts.stdoutPath, JSON.stringify({ session_id: 'not-the-session', modelUsage: { 'glm-5.3': 1 }, result: null, is_error: false }));
  child.exit(0);
  const out = await r;
  assert.equal(out.state, 'BLOCKED');
  assert.equal(out.blocker, 'BLOCKED_CAPTURE');
  rmSync(dir, { recursive: true, force: true });
});

test('secret/payload marker in child stdout stays in the private file only', async () => {
  const { dir, ledger } = env0();
  const solution = queuedSolution(ledger);
  const child = fakeChild();
  const jobBranch = `codex/dot-job-${solution.sha256.slice(0, 12)}`;
  const r = runExecution({
    ledger, solution, worktree: dir, dir,
    spawnImpl: captureSpawn(child), gitImpl: gitOk({ head: BASE_SHA, branch: jobBranch }),
    clock: fakeClock(),
    pollIntervalMs: 5, startupTimeoutMs: 200, deadlineMs: 5_000,
  });
  await sleep(10);
  writeFileSync(child.opts.env.DOT_RELAY_STARTUP_RECEIPT, JSON.stringify({
    session_id: child.opts.env.DOT_RELAY_SESSION_ID,
    execution_id: child.opts.env.DOT_RELAY_EXECUTION_ID,
    worktree: dir,
  }));
  await sleep(30);
  writeFileSync(child.opts.stdoutPath, JSON.stringify({ session_id: 'wrong', modelUsage: {}, result: 'SECRET-MARKER-9f2 do not leak', is_error: false }));
  child.exit(0);
  const out = await r;
  const serialized = JSON.stringify(out) + JSON.stringify(ledger.status());
  assert.ok(!serialized.includes('SECRET-MARKER-9f2'));
  assert.ok(readFileSync(child.opts.stdoutPath, 'utf8').includes('SECRET-MARKER-9f2')); // private file retains it
  rmSync(dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------- startup receipt

test('no startup receipt within the window: TERM owned child, UNCERTAIN + BLOCKED_STARTUP', async () => {
  const { dir, ledger } = env0();
  const solution = queuedSolution(ledger);
  const child = fakeChild();
  const r = await runExecution({
    ledger, solution, worktree: dir, dir,
    spawnImpl: captureSpawn(child), gitImpl: gitOk(),
    clock: fakeClock({ advancePerReadMs: 10 }),
    pollIntervalMs: 5, startupTimeoutMs: 40, deadlineMs: 60_000,
  });
  const out = await r;
  assert.equal(out.state, 'UNCERTAIN');
  assert.equal(out.blocker, 'BLOCKED_STARTUP');
  assert.deepEqual(child.kills, ['SIGTERM']); // exact owned child was TERMed
  assert.equal(ledger.status().execution.state, 'UNCERTAIN'); // slot preserved
  rmSync(dir, { recursive: true, force: true });
});

test('receipt with mismatched session is not accepted; worker assertions alone are insufficient', async () => {
  const { dir, ledger } = env0();
  const solution = queuedSolution(ledger);
  const child = fakeChild();
  const r = await runExecution({
    ledger, solution, worktree: dir, dir,
    spawnImpl: captureSpawn(child), gitImpl: gitOk(),
    clock: fakeClock({ advancePerReadMs: 10 }),
    pollIntervalMs: 5, startupTimeoutMs: 50, deadlineMs: 60_000,
  });
  await sleep(10);
  writeFileSync(child.opts.env.DOT_RELAY_STARTUP_RECEIPT, JSON.stringify({
    session_id: 'forged-session',
    execution_id: child.opts.env.DOT_RELAY_EXECUTION_ID,
    worktree: dir,
  }));
  const out = await r;
  assert.equal(out.blocker, 'BLOCKED_STARTUP'); // forged receipt never admitted startup
  assert.deepEqual(child.kills, ['SIGTERM']);
  rmSync(dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------- deadline ownership
//
// HOST-RESILIENCE §3: deadlineMs is a HOST-AWAKE ACTIVE budget measured by the
// injected ActiveClock — wall time never times anything out.

test('active-budget exhaustion TERMs the exact verified-live child once: TIMED_OUT_ACTIVE', async () => {
  const { dir, ledger } = env0();
  const solution = queuedSolution(ledger);
  const child = fakeChild();
  const jobBranch = `codex/dot-job-${solution.sha256.slice(0, 12)}`;
  const git = gitOk({ head: BASE_SHA, branch: jobBranch });
  const r = runExecution({
    ledger, solution, worktree: dir, dir,
    spawnImpl: captureSpawn(child), gitImpl: git,
    clock: fakeClock({ advancePerReadMs: 10 }),
    pollIntervalMs: 5, startupTimeoutMs: 500, deadlineMs: 80,
  });
  await sleep(10);
  writeFileSync(child.opts.env.DOT_RELAY_STARTUP_RECEIPT, JSON.stringify({
    session_id: child.opts.env.DOT_RELAY_SESSION_ID,
    execution_id: child.opts.env.DOT_RELAY_EXECUTION_ID,
    worktree: dir,
  }));
  const out = await r;
  assert.equal(out.state, 'TIMED_OUT_ACTIVE');
  assert.deepEqual(child.kills, ['SIGTERM']); // owned + identity re-verified live: TERM delivered exactly once
  assert.equal(ledger.getExecution(out.execution_id).state, 'TIMED_OUT_ACTIVE');
  const attempt = ledger.getAttempt(out.execution_id, 1);
  assert.ok(attempt.measured_active_used_ms >= 80); // active spend recorded, never wall
  assert.ok(attempt.last_active_ns); // durable last proven sample
  rmSync(dir, { recursive: true, force: true });
});

test('PID reuse at budget stop: ambiguous ownership means no signal, UNCERTAIN_IDENTITY', async () => {
  const { dir, ledger } = env0();
  const solution = queuedSolution(ledger);
  const child = fakeChild();
  const jobBranch = `codex/dot-job-${solution.sha256.slice(0, 12)}`;
  const git = gitOk({ head: BASE_SHA, branch: jobBranch });
  const clock = fakeClock(); // frozen: the test alone decides when budget crosses
  const r = runExecution({
    ledger, solution, worktree: dir, dir,
    spawnImpl: captureSpawn(child), gitImpl: git,
    clock,
    pollIntervalMs: 5, startupTimeoutMs: 500, deadlineMs: 60_000,
  });
  await sleep(10);
  writeFileSync(child.opts.env.DOT_RELAY_STARTUP_RECEIPT, JSON.stringify({
    session_id: child.opts.env.DOT_RELAY_SESSION_ID,
    execution_id: child.opts.env.DOT_RELAY_EXECUTION_ID,
    worktree: dir,
  }));
  await sleep(30); // main loop is RUNNING on the frozen clock
  child.pid = 4243; // PID reuse happens FIRST...
  clock.advanceMs(60_000); // ...THEN the budget crosses — with ambiguous identity
  const out = await r;
  assert.equal(out.state, 'UNCERTAIN');
  assert.equal(out.blocker, 'UNCERTAIN_IDENTITY');
  assert.deepEqual(child.kills, []); // ambiguous ownership -> no signal at all
  assert.equal(ledger.getExecution(out.execution_id).reason, 'UNCERTAIN_IDENTITY');
  rmSync(dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------- OFF

test('OFF blocks admission before spawn and never signals anything', async () => {
  const { dir, ledger } = env0();
  const solution = queuedSolution(ledger);
  ledger.setOff({ reason: 'operator stop' });
  let spawned = 0;
  const r = await runExecution({
    ledger, solution, worktree: dir, dir,
    spawnImpl: () => { spawned += 1; return fakeChild(); },
    clock: fakeClock(),
    gitImpl: gitOk(), pollIntervalMs: 5,
  });
  assert.equal(r.state, 'BLOCKED');
  assert.equal(r.blocker, 'OFF');
  assert.equal(spawned, 0);
  rmSync(dir, { recursive: true, force: true });
});

test('isOwnedChild requires pid+start+session identity', () => {
  const rec = { pid: 100, process_start: 'st', session_id: 'sess-1' };
  assert.equal(isOwnedChild(rec, { pid: 100, start: 'st' }, 'sess-1'), true);
  assert.equal(isOwnedChild(rec, { pid: 101, start: 'st' }, 'sess-1'), false);
  assert.equal(isOwnedChild(rec, { pid: 100, start: 'other' }, 'sess-1'), false);
  assert.equal(isOwnedChild(rec, { pid: 100, start: 'st' }, 'sess-2'), false);
  // HOST-RESILIENCE §5: a missing start text on EITHER side fails closed —
  // pid equality alone is never ownership (PID reuse).
  assert.equal(isOwnedChild({ pid: 100, process_start: null, session_id: 'sess-1' }, { pid: 100, start: 'st' }, 'sess-1'), false);
  assert.equal(isOwnedChild(rec, { pid: 100, start: null }, 'sess-1'), false);
});

// ---------------------------------------------------------------- happy path

test('verified startup + strict CODE_COMPLETE string capture -> REQUIRES_REVIEW (never direct verification)', async () => {
  const { dir, ledger } = env0();
  const solution = queuedSolution(ledger);
  const manifest = ledger.getManifest(solution.id);
  const child = fakeChild();
  const jobBranch = `codex/dot-job-${solution.sha256.slice(0, 12)}`;
  const git = gitOk({ head: BASE_SHA, branch: jobBranch });
  const PR = 'https://github.com/artyhoo/getff/pull/9999';
  let ghCalls = 0;
  const gh = {
    view: () => { ghCalls += 1; return { headRefOid: HEAD, baseRefName: 'staging', state: 'OPEN', isDraft: false, mergeStateStatus: 'CLEAN', autoMergeRequest: null }; },
    checks: () => { ghCalls += 1; return [{ name: 'ci', state: 'SUCCESS', bucket: 'pass', link: 'l' }]; },
  };
  const r = runExecution({
    ledger, solution, worktree: dir, dir,
    spawnImpl: captureSpawn(child), gitImpl: git, ghImpl: gh,
    clock: fakeClock(),
    pollIntervalMs: 5, startupTimeoutMs: 500, deadlineMs: 5_000,
  });
  await sleep(10);
  // worker writes the startup receipt the supervisor demanded
  writeFileSync(child.opts.env.DOT_RELAY_STARTUP_RECEIPT, JSON.stringify({
    session_id: child.opts.env.DOT_RELAY_SESSION_ID,
    execution_id: child.opts.env.DOT_RELAY_EXECUTION_ID,
    worktree: dir,
  }));
  await sleep(30);
  const sessionId = child.opts.env.DOT_RELAY_SESSION_ID;
  const executionId = child.opts.env.DOT_RELAY_EXECUTION_ID;
  const report = codeCompleteReport({ executionId, sessionId, solution, artifactSha256: manifest.artifact_sha256, prUrl: PR });
  writeFileSync(child.opts.stdoutPath, JSON.stringify(outerCapture(sessionId, JSON.stringify(report))));
  child.exit(0);
  const out = await r;
  assert.equal(out.state, 'REQUIRES_REVIEW');
  assert.equal(out.pr_url, PR);
  assert.equal(out.head_sha, HEAD);
  // R10: no PR verification happens inside the capture path — the review gate
  // owns the transition to VERIFYING, so gh is never consulted here.
  assert.equal(ghCalls, 0);
  const exec = ledger.getExecution(out.execution_id);
  assert.equal(exec.state, 'REQUIRES_REVIEW');
  assert.equal(exec.pr_url, PR);
  assert.equal(exec.head_sha, HEAD);
  assert.equal(exec.pid, 4242);
  assert.equal(exec.worktree, dir);
  const wr = ledger.getWorkerReport(out.execution_id);
  assert.ok(wr, 'strict worker report persisted');
  assert.equal(wr.source_tree_digest, report.source_tree_digest);
  assert.equal(wr.head_sha, HEAD);
  assert.equal(wr.pr_url, PR);
  // DESIGN.md:62 — the child runs in its OWN native worktree, never the shared checkout
  assert.equal(child.argv[child.argv.indexOf('--worktree') + 1], `dot-relay-${solution.sha256.slice(0, 12)}`);
  const attempt = ledger.getAttempt(out.execution_id, 1);
  assert.equal(attempt.state, 'REQUIRES_REVIEW');
  assert.ok(attempt.active_start_ns); // attempt active-time anchor persisted
  rmSync(dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------- verifyPr table

function viewJson(over = {}) {
  return { headRefOid: HEAD, baseRefName: 'staging', state: 'OPEN', isDraft: false, mergeStateStatus: 'CLEAN', autoMergeRequest: null, ...over };
}

function ghWith({ view = viewJson(), checks = [{ name: 'ci', state: 'SUCCESS', bucket: 'pass', link: 'l' }] } = {}) {
  const calls = [];
  return {
    calls,
    view: (args) => { calls.push(['view', args]); return view; },
    checks: (args) => { calls.push(['checks', args]); return checks; },
  };
}

test('verifyPr: exact stable head + nonempty required all pass -> DONE', async () => {
  const gh = ghWith();
  const r = await verifyPr({ url: 'u', headSha: HEAD, ghImpl: gh, clock: fakeClock(), pollIntervalMs: 5, deadlineMs: 1_000 });
  assert.equal(r.state, 'DONE');
  assert.ok(gh.calls.every(([, a]) => Array.isArray(a)));
});

test('verifyPr: empty required checks -> BLOCKED_CHECK_POLICY, not green', async () => {
  const gh = ghWith({ checks: [] });
  const r = await verifyPr({ url: 'u', headSha: HEAD, ghImpl: gh, clock: fakeClock(), pollIntervalMs: 5, deadlineMs: 200 });
  assert.equal(r.state, 'BLOCKED');
  assert.equal(r.blocker, 'BLOCKED_CHECK_POLICY');
});

test('verifyPr: failing required check -> BLOCKED_CI with names', async () => {
  const gh = ghWith({ checks: [{ name: 'typecheck', state: 'FAILURE', bucket: 'fail', link: 'l' }] });
  const r = await verifyPr({ url: 'u', headSha: HEAD, ghImpl: gh, clock: fakeClock(), pollIntervalMs: 5, deadlineMs: 200 });
  assert.equal(r.state, 'BLOCKED');
  assert.equal(r.blocker, 'BLOCKED_CI');
  assert.deepEqual(r.failing, ['typecheck']);
});

test('verifyPr: stale head (moves between views) -> not DONE', async () => {
  let n = 0;
  const gh = {
    view: () => { n += 1; return viewJson({ headRefOid: n <= 1 ? HEAD : sha40('moved') }); },
    checks: () => [{ name: 'ci', state: 'SUCCESS', bucket: 'pass', link: 'l' }],
  };
  const r = await verifyPr({ url: 'u', headSha: HEAD, ghImpl: gh, clock: fakeClock(), pollIntervalMs: 5, deadlineMs: 200 });
  assert.equal(r.state, 'BLOCKED');
  assert.equal(r.blocker, 'BLOCKED_HEAD_MOVED');
});

test('verifyPr: wrong head from the start -> BLOCKED_HEAD_MISMATCH', async () => {
  const gh = ghWith({ view: viewJson({ headRefOid: sha40('other') }) });
  const r = await verifyPr({ url: 'u', headSha: HEAD, ghImpl: gh, clock: fakeClock(), pollIntervalMs: 5, deadlineMs: 200 });
  assert.equal(r.blocker, 'BLOCKED_HEAD_MISMATCH');
});

test('verifyPr: pending then pass within the ACTIVE budget -> polls to DONE', async () => {
  let pending = true;
  const gh = {
    view: () => viewJson(),
    checks: () => (pending ? [{ name: 'ci', state: 'PENDING', bucket: 'pending', link: 'l' }] : [{ name: 'ci', state: 'SUCCESS', bucket: 'pass', link: 'l' }]),
  };
  setTimeout(() => { pending = false; }, 30);
  const r = await verifyPr({ url: 'u', headSha: HEAD, ghImpl: gh, clock: fakeClock(), pollIntervalMs: 10, deadlineMs: 2_000 });
  assert.equal(r.state, 'DONE');
});

test('verifyPr: pending past the ACTIVE budget -> BLOCKED_CI with pending names', async () => {
  const gh = ghWith({ checks: [{ name: 'ci', state: 'PENDING', bucket: 'pending', link: 'l' }] });
  const r = await verifyPr({ url: 'u', headSha: HEAD, ghImpl: gh, clock: fakeClock({ advancePerReadMs: 10 }), pollIntervalMs: 5, deadlineMs: 60 });
  assert.equal(r.state, 'BLOCKED');
  assert.equal(r.blocker, 'BLOCKED_CI');
  assert.deepEqual(r.failing, ['ci']);
});

for (const [name, over] of [
  ['conflicting', { mergeStateStatus: 'CONFLICTING' }],
  ['draft', { isDraft: true }],
  ['automerge armed', { autoMergeRequest: { mergeMethod: 'SQUASH' } }],
  ['wrong base', { baseRefName: 'main' }],
  ['closed', { state: 'CLOSED' }],
]) {
  test(`verifyPr: ${name} PR can never reach DONE`, async () => {
    const gh = ghWith({ view: viewJson(over) });
    const r = await verifyPr({ url: 'u', headSha: HEAD, ghImpl: gh, clock: fakeClock(), pollIntervalMs: 5, deadlineMs: 200 });
    assert.equal(r.state, 'BLOCKED');
    assert.equal(r.blocker, 'BLOCKED_PR_STATE');
  });
}

test('verifyPr: no clock -> [INVALID] — wall time never bounds CI polling', async () => {
  await assert.rejects(
    () => verifyPr({ url: 'u', headSha: HEAD, ghImpl: ghWith(), pollIntervalMs: 5, deadlineMs: 200 }),
    /clock required/,
  );
});

test('verifyPr: clock breaking mid-poll -> CLOCK_UNPROVEN, not a wall deadline BLOCKED_CI', async () => {
  const clock = fakeClock(); // active time frozen: only death ends this
  const gh = ghWith({ checks: [{ name: 'ci', state: 'PENDING', bucket: 'pending', link: 'l' }] });
  setTimeout(() => { clock.breakClock(); }, 30);
  const r = await verifyPr({ url: 'u', headSha: HEAD, ghImpl: gh, clock, pollIntervalMs: 5, deadlineMs: 200 });
  assert.equal(r.state, 'BLOCKED');
  assert.equal(r.blocker, 'CLOCK_UNPROVEN');
});

test('verifyPr: freshness failing mid-poll -> CLOCK_UNPROVEN (R08)', async () => {
  const clock = fakeClock({ advancePerReadMs: 1 }); // budget would exhaust at ~500 reads
  const gh = ghWith({ checks: [{ name: 'ci', state: 'PENDING', bucket: 'pending', link: 'l' }] });
  setTimeout(() => { if (typeof clock.breakFreshness === 'function') clock.breakFreshness(); }, 30);
  const r = await verifyPr({ url: 'u', headSha: HEAD, ghImpl: gh, clock, pollIntervalMs: 2, deadlineMs: 500 });
  assert.equal(r.state, 'BLOCKED');
  assert.equal(r.blocker, 'CLOCK_UNPROVEN'); // never the wall-deadline BLOCKED_CI
});

// ---------------------------------------------------------------- supervise mode
// tick (process A) reserves the execution; a detached supervise child (process B)
// drives it. The supervise path MUST reuse the tick-reserved row and its session id.

test('supervise mode reuses the tick-reserved execution row and its persisted session id', async () => {
  const { dir, ledger } = env0();
  const solution = queuedSolution(ledger);
  const claim = ledger.claimExecution({ solutionId: solution.id, sessionId: 'tick-session-0001' });
  assert.equal(claim.claimed, true);
  const child = fakeChild();
  const jobBranch = `codex/dot-job-${solution.sha256.slice(0, 12)}`;
  const git = gitOk({ head: BASE_SHA, branch: jobBranch });
  const gh = {
    view: () => viewJson(),
    checks: () => [{ name: 'ci', state: 'SUCCESS', bucket: 'pass', link: 'l' }],
  };
  const r = runExecution({
    ledger, solution, worktree: dir, dir, superviseExecutionId: claim.execution_id,
    spawnImpl: captureSpawn(child), gitImpl: git, ghImpl: gh,
    clock: fakeClock(),
    pollIntervalMs: 5, startupTimeoutMs: 500, deadlineMs: 5_000,
  });
  await sleep(10);
  writeFileSync(child.opts.env.DOT_RELAY_STARTUP_RECEIPT, JSON.stringify({
    session_id: child.opts.env.DOT_RELAY_SESSION_ID,
    execution_id: child.opts.env.DOT_RELAY_EXECUTION_ID,
    worktree: dir,
  }));
  await sleep(30);
  const manifest = ledger.getManifest(solution.id);
  const report = codeCompleteReport({
    executionId: claim.execution_id,
    sessionId: child.opts.env.DOT_RELAY_SESSION_ID,
    solution,
    artifactSha256: manifest.artifact_sha256,
    prUrl: 'https://github.com/artyhoo/getff/pull/8888',
  });
  writeFileSync(child.opts.stdoutPath, JSON.stringify(outerCapture(child.opts.env.DOT_RELAY_SESSION_ID, JSON.stringify(report))));
  child.exit(0);
  const out = await r;
  assert.equal(out.state, 'REQUIRES_REVIEW');
  assert.equal(out.execution_id, claim.execution_id);
  // the spawned argv carries the TICK's session id — no second claim happened
  const sessionArg = child.argv[child.argv.indexOf('--session-id') + 1];
  assert.equal(sessionArg, 'tick-session-0001');
  assert.equal(ledger.getExecution(claim.execution_id).state, 'REQUIRES_REVIEW');
  assert.ok(ledger.getWorkerReport(claim.execution_id), 'worker report persisted in supervise mode too');
  rmSync(dir, { recursive: true, force: true });
});

test('supervise mode refuses a row that is not RESERVED (coordinator reconciliation changed it)', async () => {
  const { dir, ledger } = env0();
  const solution = queuedSolution(ledger);
  const claim = ledger.claimExecution({ solutionId: solution.id, sessionId: 'tick-session-0002' });
  ledger.close();
  const ledger2 = openLedger(join(dir, 'ledger.sqlite'), { now });
  // HOST-RESILIENCE §2: open is read-only — a non-RESERVED state now comes only
  // from an explicit decision (reconcileHost/operator), never from the open.
  ledger2.updateExecution(claim.execution_id, { state: 'UNCERTAIN', reason: 'coordinator reconciliation' });
  const r = await runExecution({
    ledger: ledger2, solution, worktree: dir, dir, superviseExecutionId: claim.execution_id,
    spawnImpl: () => { throw new Error('must not spawn'); }, clock: fakeClock(), gitImpl: gitOk(), pollIntervalMs: 5,
  });
  assert.equal(r.state, 'BLOCKED');
  assert.equal(r.blocker, 'EXECUTION_STATE');
  ledger2.close();
  rmSync(dir, { recursive: true, force: true });
});

// ------------------------------------------- HOST-RESILIENCE §3/§5 (executor)
//
// The active clock is the ONLY budget source: wall +8h with active +10ms is
// NOT a timeout; the budget boundary fires exactly once; a broken/backwards
// clock fails closed (CLOCK_UNPROVEN) with the §5 cessation ladder.

test('wall +8h while active +10ms: no timeout, the SAME live execution keeps running', async () => {
  const { dir, ledger } = env0();
  const solution = queuedSolution(ledger);
  const child = fakeChild();
  const jobBranch = `codex/dot-job-${solution.sha256.slice(0, 12)}`;
  const clock = fakeClock(); // active time essentially frozen
  const r = runExecution({
    ledger, solution, worktree: dir, dir,
    spawnImpl: captureSpawn(child), gitImpl: gitOk({ head: BASE_SHA, branch: jobBranch }),
    clock,
    pollIntervalMs: 5, startupTimeoutMs: 500, deadlineMs: 80, // 80ms of ACTIVE budget
  });
  await sleep(10);
  writeFileSync(child.opts.env.DOT_RELAY_STARTUP_RECEIPT, JSON.stringify({
    session_id: child.opts.env.DOT_RELAY_SESSION_ID,
    execution_id: child.opts.env.DOT_RELAY_EXECUTION_ID,
    worktree: dir,
  }));
  clock.advanceMs(10); // all the host-awake time this run ever burns
  await sleep(200); // a wall-clock deadline (80ms) would long since have fired
  assert.equal(ledger.status().execution.state, 'RUNNING'); // same live execution
  assert.deepEqual(child.kills, []); // nothing was signaled
  child.kill('SIGKILL'); // test cleanup
  const out = await r;
  assert.ok(['UNCERTAIN', 'BLOCKED'].includes(out.state));
  rmSync(dir, { recursive: true, force: true });
});

test('budget boundary 7199999->7200000ms active: TIMED_OUT_ACTIVE fires exactly once', async () => {
  const { dir, ledger } = env0();
  const solution = queuedSolution(ledger);
  const child = fakeChild();
  const jobBranch = `codex/dot-job-${solution.sha256.slice(0, 12)}`;
  const clock = fakeClock();
  const r = runExecution({
    ledger, solution, worktree: dir, dir,
    spawnImpl: captureSpawn(child), gitImpl: gitOk({ head: BASE_SHA, branch: jobBranch }),
    clock,
    pollIntervalMs: 5, startupTimeoutMs: 500, deadlineMs: 7_200_000,
  });
  await sleep(10);
  writeFileSync(child.opts.env.DOT_RELAY_STARTUP_RECEIPT, JSON.stringify({
    session_id: child.opts.env.DOT_RELAY_SESSION_ID,
    execution_id: child.opts.env.DOT_RELAY_EXECUTION_ID,
    worktree: dir,
  }));
  clock.advanceMs(7_199_999); // exactly one millisecond below the boundary
  await sleep(50);
  assert.equal(ledger.status().execution.state, 'RUNNING'); // boundary NOT crossed yet
  assert.deepEqual(child.kills, []);
  clock.advanceMs(1); // cross it
  const out = await r;
  assert.equal(out.state, 'TIMED_OUT_ACTIVE');
  assert.deepEqual(child.kills, ['SIGTERM']); // single TERM against the freshly verified child
  const attempt = ledger.getAttempt(out.execution_id, 1);
  assert.ok(attempt.measured_active_used_ms >= 7_200_000);
  rmSync(dir, { recursive: true, force: true });
});

test('backwards active sample: CLOCK_UNPROVEN fail-closed — exact child TERMed after identity re-probe', async () => {
  const { dir, ledger } = env0();
  const solution = queuedSolution(ledger);
  const child = fakeChild();
  const jobBranch = `codex/dot-job-${solution.sha256.slice(0, 12)}`;
  const clock = fakeClock();
  const r = runExecution({
    ledger, solution, worktree: dir, dir,
    spawnImpl: captureSpawn(child), gitImpl: gitOk({ head: BASE_SHA, branch: jobBranch }),
    clock,
    pollIntervalMs: 5, startupTimeoutMs: 500, deadlineMs: 60_000,
  });
  await sleep(10);
  writeFileSync(child.opts.env.DOT_RELAY_STARTUP_RECEIPT, JSON.stringify({
    session_id: child.opts.env.DOT_RELAY_SESSION_ID,
    execution_id: child.opts.env.DOT_RELAY_EXECUTION_ID,
    worktree: dir,
  }));
  await sleep(20);
  clock.rewindMs(5_000); // helper regression: the next sample goes BACKWARDS
  const out = await r;
  assert.equal(out.state, 'UNCERTAIN');
  assert.equal(out.blocker, 'CLOCK_UNPROVEN');
  assert.equal(ledger.getExecution(out.execution_id).reason, 'CLOCK_UNPROVEN');
  assert.deepEqual(child.kills, ['SIGTERM']); // cessation delivered to the proven-live exact child
  rmSync(dir, { recursive: true, force: true });
});

test('broken clock (helper EOF) + missing child identity: UNCERTAIN_IDENTITY, zero signals', async () => {
  const { dir, ledger } = env0();
  const solution = queuedSolution(ledger);
  const child = fakeChild();
  const jobBranch = `codex/dot-job-${solution.sha256.slice(0, 12)}`;
  const clock = fakeClock();
  const r = runExecution({
    ledger, solution, worktree: dir, dir,
    spawnImpl: captureSpawn(child), gitImpl: gitOk({ head: BASE_SHA, branch: jobBranch }),
    clock,
    pollIntervalMs: 5, startupTimeoutMs: 500, deadlineMs: 60_000,
  });
  await sleep(10);
  writeFileSync(child.opts.env.DOT_RELAY_STARTUP_RECEIPT, JSON.stringify({
    session_id: child.opts.env.DOT_RELAY_SESSION_ID,
    execution_id: child.opts.env.DOT_RELAY_EXECUTION_ID,
    worktree: dir,
  }));
  await sleep(20);
  child.pid = 4243; // identity cannot be proven
  clock.breakClock(); // and the clock died
  const out = await r;
  assert.equal(out.state, 'UNCERTAIN');
  assert.equal(out.blocker, 'UNCERTAIN_IDENTITY');
  assert.deepEqual(child.kills, []); // no signal without identity
  assert.equal(ledger.getExecution(out.execution_id).reason, 'UNCERTAIN_IDENTITY');
  rmSync(dir, { recursive: true, force: true });
});

test('supervisor lock carries boot identity; checkpoint walks STARTUP_VERIFIED -> DONE with active spend', async () => {
  const { dir, ledger } = env0();
  const solution = queuedSolution(ledger);
  const child = fakeChild();
  const jobBranch = `codex/dot-job-${solution.sha256.slice(0, 12)}`;
  const gh = {
    view: () => viewJson(),
    checks: () => [{ name: 'ci', state: 'SUCCESS', bucket: 'pass', link: 'l' }],
  };
  const r = runExecution({
    ledger, solution, worktree: dir, dir,
    spawnImpl: captureSpawn(child), gitImpl: gitOk({ head: BASE_SHA, branch: jobBranch }), ghImpl: gh,
    clock: fakeClock(),
    pollIntervalMs: 5, startupTimeoutMs: 500, deadlineMs: 5_000,
  });
  await sleep(10);
  writeFileSync(child.opts.env.DOT_RELAY_STARTUP_RECEIPT, JSON.stringify({
    session_id: child.opts.env.DOT_RELAY_SESSION_ID,
    execution_id: child.opts.env.DOT_RELAY_EXECUTION_ID,
    worktree: dir,
  }));
  await sleep(30);
  // mid-run: the lock names THIS supervisor's boot, not just its pid
  const lock = JSON.parse(readFileSync(join(dir, 'worker', 'supervisor.lock'), 'utf8'));
  assert.equal(lock.boot_id, 'BOOT-EX');
  assert.equal(typeof lock.pid, 'number');
  // phase transition recorded right after startup verification
  const midCp = JSON.parse(readFileSync(join(dir, 'worker', `${lock.execution_id}.checkpoint.json`), 'utf8'));
  assert.equal(midCp.phase, 'STARTUP_VERIFIED');
  assert.equal(midCp.boot_id, 'BOOT-EX');
  writeFileSync(child.opts.stdoutPath, JSON.stringify(outerCapture(
    child.opts.env.DOT_RELAY_SESSION_ID,
    JSON.stringify(codeCompleteReport({
      executionId: lock.execution_id,
      sessionId: child.opts.env.DOT_RELAY_SESSION_ID,
      solution,
      artifactSha256: ledger.getManifest(solution.id).artifact_sha256,
      prUrl: 'https://github.com/artyhoo/getff/pull/7777',
    })),
  )));
  child.exit(0);
  const out = await r;
  assert.equal(out.state, 'REQUIRES_REVIEW');
  const cp = JSON.parse(readFileSync(join(dir, 'worker', `${out.execution_id}.checkpoint.json`), 'utf8'));
  assert.equal(cp.version, 1);
  assert.equal(cp.execution_id, out.execution_id);
  assert.equal(cp.session_id, child.opts.env.DOT_RELAY_SESSION_ID);
  assert.equal(cp.boot_id, 'BOOT-EX');
  assert.equal(cp.phase, 'REQUIRES_REVIEW');
  assert.equal(cp.branch, jobBranch);
  assert.equal(cp.worktree, dir);
  assert.equal(cp.head_sha, HEAD);
  assert.equal(cp.solution_sha256, solution.sha256);
  // R11: artifact_sha256 is the manifest WHOLE-file hash (never the kickoff
  // digest), with bytes + separate kickoff/framing digests bound alongside.
  const manifest = ledger.getManifest(solution.id);
  assert.equal(cp.artifact_sha256, manifest.artifact_sha256);
  assert.notEqual(cp.artifact_sha256, solution.payload.kickoff_sha256);
  assert.equal(cp.artifact_bytes, manifest.artifact_bytes);
  assert.equal(cp.kickoff_sha256, solution.payload.kickoff_sha256);
  assert.match(cp.framing_sha256 ?? '', /^[0-9a-f]{64}$/);
  assert.equal(cp.pr_url, 'https://github.com/artyhoo/getff/pull/7777');
  assert.equal(typeof cp.active_used_ms, 'number');
  rmSync(dir, { recursive: true, force: true });
});

// ------------------------------------------- HOST-RESILIENCE §4 (resume / adopt)
//
// After reboot (INTERRUPTED_HOST) recovery resumes the SAME session in the
// SAME worktree; same-boot dead-supervisor/live-child adopts a monitor and
// never spawns a second GLM. Copied session ids and missing metadata block.

const SUP_START = 'Mon Oct  6 09:00:00 2026';
const CHILD_START = 'Mon Oct  6 10:00:00 2026';

function writeCp(dir, executionId, fields) {
  writeFileSync(join(dir, 'worker', `${executionId}.checkpoint.json`), JSON.stringify(fields));
}

// Boot-1 ran (RUNNING attempt 1), the host rebooted, reconcileHost marked
// INTERRUPTED_HOST; the checkpoint is the prior attempt's durable artifact.
// R11: the checkpoint pins the full trusted packet (whole-artifact hash/bytes
// from the manifest + separate kickoff/framing digests) and the two immutable
// worker files exist with exactly the bound bytes.
function interruptedExecution(ledger, { dir, sessionId = 'resume-sess-0001-aaaa', prUrl = null, cpSessionId = sessionId } = {}) {
  const solution = queuedSolution(ledger);
  const claim = ledger.claimExecution({
    solutionId: solution.id, sessionId,
    bootId: 'BOOT-1', supervisor: { pid: 501, start: SUP_START },
  });
  const jobBranch = `codex/dot-job-${solution.sha256.slice(0, 12)}`;
  ledger.updateExecution(claim.execution_id, { state: 'RUNNING', pid: 601, process_start: CHILD_START, worktree: dir });
  ledger.updateAttempt(claim.execution_id, 1, {
    state: 'RUNNING', child_pid: 601, child_start: CHILD_START, last_active_ns: '45000000000',
  });
  const r = ledger.reconcileHost({
    bootId: 'BOOT-2',
    processProbe: () => ({ alive: false, start: null }),
    controlActor: 'executor-resume-test',
  });
  assert.deepEqual(r.executions.map((e) => e.decision), ['interrupted-host']);
  const packet = writePacketFiles(dir, claim.execution_id, solution);
  writeCp(dir, claim.execution_id, {
    version: 1,
    execution_id: claim.execution_id,
    session_id: cpSessionId,
    boot_id: 'BOOT-1',
    phase: 'CAPTURED',
    branch: jobBranch,
    worktree: dir,
    head_sha: BASE_SHA,
    solution_sha256: solution.sha256,
    artifact_sha256: packet.artifact_sha256,
    artifact_bytes: packet.artifact_bytes,
    kickoff_sha256: packet.kickoff_sha256,
    framing_sha256: packet.framing_sha256,
    pr_url: prUrl,
    active_used_ms: 1234,
  });
  return { solution, claim, jobBranch, packet };
}

function ghDone(calls) {
  return {
    view: (args) => { calls.push(['view', args]); return viewJson(); },
    checks: (args) => { calls.push(['checks', args]); return [{ name: 'ci', state: 'SUCCESS', bucket: 'pass', link: 'l' }]; },
  };
}

test('resume: missing checkpoint metadata -> BLOCKED_RESUME_METADATA, no spawn, no attempt admission', async () => {
  const { dir, ledger } = env0();
  const { solution, claim } = interruptedExecution(ledger, { dir });
  rmSync(join(dir, 'worker', `${claim.execution_id}.checkpoint.json`), { force: true });
  let spawned = 0;
  const out = await resumeExecution({
    ledger, solution, executionId: claim.execution_id, dir,
    spawnImpl: () => { spawned += 1; return fakeChild(); },
    gitImpl: gitOk(), sessionProbe: () => [],
    clock: fakeClock({ bootId: 'BOOT-2' }), pollIntervalMs: 5,
  });
  assert.equal(out.state, 'BLOCKED');
  assert.equal(out.blocker, 'BLOCKED_RESUME_METADATA');
  assert.equal(spawned, 0);
  assert.equal(ledger.getExecution(claim.execution_id).attempts_admitted, 1); // no second reservation
  rmSync(dir, { recursive: true, force: true });
});

test('resume: corrupt checkpoint (wrong solution digest) -> BLOCKED_RESUME_METADATA', async () => {
  const { dir, ledger } = env0();
  const { solution, claim } = interruptedExecution(ledger, { dir });
  writeCp(dir, claim.execution_id, { version: 1, execution_id: claim.execution_id, session_id: 'resume-sess-0001-aaaa', worktree: dir, branch: 'b', solution_sha256: '0'.repeat(64), artifact_sha256: null, pr_url: null, active_used_ms: 0 });
  const out = await resumeExecution({
    ledger, solution, executionId: claim.execution_id, dir,
    spawnImpl: () => { throw new Error('must not spawn'); },
    gitImpl: gitOk(), sessionProbe: () => [],
    clock: fakeClock({ bootId: 'BOOT-2' }), pollIntervalMs: 5,
  });
  assert.equal(out.blocker, 'BLOCKED_RESUME_METADATA');
  rmSync(dir, { recursive: true, force: true });
});

test('resume: live session with the same id -> HELD, never --resume while live', async () => {
  const { dir, ledger } = env0();
  const { solution, claim } = interruptedExecution(ledger, { dir });
  let spawned = 0;
  const out = await resumeExecution({
    ledger, solution, executionId: claim.execution_id, dir,
    spawnImpl: () => { spawned += 1; return fakeChild(); },
    gitImpl: gitOk(), sessionProbe: () => [{ session_id: 'resume-sess-0001-aaaa', pid: 601 }],
    clock: fakeClock({ bootId: 'BOOT-2' }), pollIntervalMs: 5,
  });
  assert.equal(out.state, 'HELD');
  assert.equal(out.held, true);
  assert.equal(spawned, 0);
  assert.equal(ledger.getExecution(claim.execution_id).state, 'INTERRUPTED_HOST'); // slot retained
  rmSync(dir, { recursive: true, force: true });
});

test('resume: session census IDENTITY_UNPROVEN (CLI lacks fields) -> UNCERTAIN, never --resume on invented absence', async () => {
  const { dir, ledger } = env0();
  const { solution, claim } = interruptedExecution(ledger, { dir });
  let spawned = 0;
  const out = await resumeExecution({
    ledger, solution, executionId: claim.execution_id, dir,
    spawnImpl: () => { spawned += 1; return fakeChild(); },
    gitImpl: gitOk(), sessionProbe: () => ({ identityUnproven: true }),
    clock: fakeClock({ bootId: 'BOOT-2' }), pollIntervalMs: 5,
  });
  assert.equal(out.state, 'UNCERTAIN');
  assert.equal(out.blocker, 'IDENTITY_UNPROVEN');
  assert.equal(spawned, 0); // no --resume without proven session absence
  assert.equal(ledger.getExecution(claim.execution_id).state, 'INTERRUPTED_HOST'); // slot retained, retryable
  assert.equal(ledger.getExecution(claim.execution_id).attempts_admitted, 1); // no admission consumed
  assert.equal(ledger.getExecution(claim.execution_id).consecutive_resume_failures, 0); // not a concrete failure
  rmSync(dir, { recursive: true, force: true });
});

test('resume: checkpoint session differs from the ledger row -> UNCERTAIN_RESUME_IDENTITY + concrete failure', async () => {
  const { dir, ledger } = env0();
  const { solution, claim } = interruptedExecution(ledger, { dir, cpSessionId: 'forged-session-0001' });
  const out = await resumeExecution({
    ledger, solution, executionId: claim.execution_id, dir,
    spawnImpl: () => { throw new Error('must not spawn'); },
    gitImpl: gitOk(), sessionProbe: () => [],
    clock: fakeClock({ bootId: 'BOOT-2' }), pollIntervalMs: 5,
  });
  assert.equal(out.state, 'UNCERTAIN');
  assert.equal(out.blocker, 'UNCERTAIN_RESUME_IDENTITY');
  assert.equal(ledger.getExecution(claim.execution_id).consecutive_resume_failures, 1);
  rmSync(dir, { recursive: true, force: true });
});

test('resume: SAME session --resume in the verified worktree; capture holds at REQUIRES_REVIEW reusing the checkpoint PR; attempt 2 admitted (scenario 5/10)', async () => {
  const { dir, ledger } = env0();
  const PR = 'https://github.com/artyhoo/getff/pull/9999';
  const { solution, claim, jobBranch, packet } = interruptedExecution(ledger, { dir, prUrl: PR });
  const child = fakeChild();
  const calls = [];
  const r = resumeExecution({
    ledger, solution, executionId: claim.execution_id, dir,
    spawnImpl: captureSpawn(child),
    gitImpl: gitOk({ head: BASE_SHA, branch: jobBranch, toplevel: dir }),
    ghImpl: ghDone(calls),
    sessionProbe: () => [],
    clock: fakeClock({ bootId: 'BOOT-2' }),
    pollIntervalMs: 5, deadlineMs: 5_000,
  });
  await sleep(10);
  await guardedMidRun(r, child, () => {
    // argv: --resume EXACT session id; never a new session/worktree/branch
    assert.equal(child.argv[child.argv.indexOf('--resume') + 1], 'resume-sess-0001-aaaa');
    assert.ok(!child.argv.includes('--session-id'));
    assert.ok(!child.argv.includes('--worktree'));
    assert.ok(!child.argv.includes('--continue'));
    assert.equal(child.opts.cwd, dir); // the verified EXISTING native worktree
    // R11: the resume -p is constant/paths/digests ONLY — no raw kickoff bytes,
    // and it names the framing + kickoff files and their digests.
    const resumePrompt = child.argv[child.argv.indexOf('-p') + 1];
    assert.ok(!resumePrompt.includes('run the plan'), 'no raw kickoff bytes in the resume argv');
    assert.ok(!resumePrompt.includes('# executor fixture kickoff'), 'no kickoff heading in the resume argv');
    assert.ok(resumePrompt.includes(join(dir, 'worker', `${claim.execution_id}.kickoff.md`)), 'resume argv references the kickoff file by path');
    assert.ok(resumePrompt.includes(join(dir, 'worker', `${claim.execution_id}.framing.md`)), 'resume argv references the framing file by path');
    assert.ok(resumePrompt.includes(packet.kickoff_sha256), 'kickoff digest rides the resume argv');
    assert.ok(resumePrompt.includes(packet.framing_sha256), 'framing digest rides the resume argv');
  });
  writeFileSync(child.opts.stdoutPath, JSON.stringify(outerCapture('resume-sess-0001-aaaa', JSON.stringify(codeCompleteReport({
    executionId: claim.execution_id,
    sessionId: 'resume-sess-0001-aaaa',
    solution,
    artifactSha256: packet.artifact_sha256,
    prUrl: PR,
  }))));
  child.exit(0);
  const out = await r;
  assert.equal(out.state, 'REQUIRES_REVIEW');
  assert.equal(out.pr_url, PR);
  assert.equal(ledger.getExecution(claim.execution_id).state, 'REQUIRES_REVIEW');
  // R10: the resumed capture stops at the review gate — the EXISTING PR is
  // never verified from inside the capture path.
  assert.equal(calls.length, 0);
  assert.ok(ledger.getWorkerReport(claim.execution_id), 'worker report persisted from the resumed attempt');
  const attempt2 = ledger.getAttempt(claim.execution_id, 2);
  assert.equal(attempt2.state, 'REQUIRES_REVIEW'); // second precharged attempt, measured
  assert.equal(attempt2.boot_id, 'BOOT-2');
  assert.ok(attempt2.measured_active_used_ms >= 0);
  assert.equal(ledger.getExecution(claim.execution_id).attempts_admitted, 2); // no second execution id — same row
  rmSync(dir, { recursive: true, force: true });
});

test('resume: harness returns a COPIED session id -> UNCERTAIN_RESUME_IDENTITY, no DONE', async () => {
  const { dir, ledger } = env0();
  const { solution, claim, jobBranch } = interruptedExecution(ledger, { dir });
  const child = fakeChild();
  const r = resumeExecution({
    ledger, solution, executionId: claim.execution_id, dir,
    spawnImpl: captureSpawn(child),
    gitImpl: gitOk({ head: BASE_SHA, branch: jobBranch, toplevel: dir }),
    sessionProbe: () => [],
    clock: fakeClock({ bootId: 'BOOT-2' }),
    pollIntervalMs: 5, deadlineMs: 5_000,
  });
  await sleep(10);
  writeFileSync(child.opts.stdoutPath, JSON.stringify({
    session_id: 'copied-session-0002',
    modelUsage: { 'glm-5.3': 1 },
    is_error: false,
    result: { status: 'DONE', pr_url: 'https://github.com/artyhoo/getff/pull/1234', head_sha: HEAD },
  }));
  child.exit(0);
  const out = await r;
  assert.equal(out.state, 'UNCERTAIN');
  assert.equal(out.blocker, 'UNCERTAIN_RESUME_IDENTITY');
  assert.equal(ledger.getExecution(claim.execution_id).consecutive_resume_failures, 1);
  rmSync(dir, { recursive: true, force: true });
});

test('resume: budget exhaustion on the resumed attempt -> TIMED_OUT_ACTIVE (shared 2h covers resume)', async () => {
  const { dir, ledger } = env0();
  const { solution, claim, jobBranch } = interruptedExecution(ledger, { dir });
  const child = fakeChild();
  const clock = fakeClock({ bootId: 'BOOT-2', advancePerReadMs: 10 });
  const r = resumeExecution({
    ledger, solution, executionId: claim.execution_id, dir,
    spawnImpl: captureSpawn(child),
    gitImpl: gitOk({ head: BASE_SHA, branch: jobBranch, toplevel: dir }),
    sessionProbe: () => [],
    clock,
    pollIntervalMs: 5, deadlineMs: 60,
  });
  await sleep(10);
  clock.advanceMs(100); // resume attempt budget crossed
  const out = await r;
  assert.equal(out.state, 'TIMED_OUT_ACTIVE');
  assert.deepEqual(child.kills, ['SIGTERM']);
  const attempt2 = ledger.getAttempt(claim.execution_id, 2);
  assert.equal(attempt2.state, 'TIMED_OUT_ACTIVE');
  rmSync(dir, { recursive: true, force: true });
});

// ------------------------------------------- adopt-monitor (scenario 6)

// Same-boot: supervisor died, exact child alive. Attempt 1 stays the ONLY
// reservation — the monitor consumes the SAME attempt budget from the
// persisted anchor, and a dead child completes via its private capture.
function adoptedExecution(ledger, { dir }) {
  const solution = queuedSolution(ledger);
  const claim = ledger.claimExecution({
    solutionId: solution.id, sessionId: 'adopt-sess-0001-aaaa',
    bootId: 'BOOT-1', supervisor: { pid: 501, start: SUP_START },
  });
  const jobBranch = `codex/dot-job-${solution.sha256.slice(0, 12)}`;
  ledger.updateExecution(claim.execution_id, { state: 'RECOVERING_HOST', pid: 601, process_start: CHILD_START, worktree: dir });
  ledger.updateAttempt(claim.execution_id, 1, {
    state: 'RUNNING', child_pid: 601, child_start: CHILD_START,
    active_start_ns: '990000000', last_active_ns: '995000000',
  });
  const packet = writePacketFiles(dir, claim.execution_id, solution);
  writeCp(dir, claim.execution_id, {
    version: 1,
    execution_id: claim.execution_id,
    session_id: 'adopt-sess-0001-aaaa',
    boot_id: 'BOOT-1',
    phase: 'STARTUP_VERIFIED',
    branch: jobBranch,
    worktree: dir,
    head_sha: BASE_SHA,
    solution_sha256: solution.sha256,
    artifact_sha256: packet.artifact_sha256,
    artifact_bytes: packet.artifact_bytes,
    kickoff_sha256: packet.kickoff_sha256,
    framing_sha256: packet.framing_sha256,
    pr_url: null,
    active_used_ms: 5,
  });
  return { solution, claim, jobBranch, packet };
}

test('adopt-monitor: same-boot live adopted child is monitored with ZERO GLM spawns; capture holds at REQUIRES_REVIEW (scenario 6)', async () => {
  const { dir, ledger } = env0();
  const { claim, solution, packet } = adoptedExecution(ledger, { dir });
  let alive = true;
  const calls = [];
  const r = monitorAdoptedChild({
    ledger, executionId: claim.execution_id, dir,
    processProbe: (pid) => (String(pid) === '601' && alive ? { alive: true, start: CHILD_START } : { alive: false, start: null }),
    ghImpl: ghDone(calls),
    clock: fakeClock({ bootId: 'BOOT-1' }),
    pollIntervalMs: 5, deadlineMs: 5_000,
  });
  await sleep(20);
  assert.equal(ledger.getExecution(claim.execution_id).state, 'RECOVERING_HOST'); // still adopted, still attempt 1
  assert.equal(ledger.getExecution(claim.execution_id).attempts_admitted, 1); // no new reservation while child live
  alive = false; // the adopted child exits on its own
  writeFileSync(join(dir, 'worker', `${claim.execution_id}.stdout`), JSON.stringify(outerCapture('adopt-sess-0001-aaaa', JSON.stringify(codeCompleteReport({
    executionId: claim.execution_id,
    sessionId: 'adopt-sess-0001-aaaa',
    solution,
    artifactSha256: packet.artifact_sha256,
    prUrl: 'https://github.com/artyhoo/getff/pull/7777',
  }))));
  const out = await r;
  assert.equal(out.state, 'REQUIRES_REVIEW');
  assert.equal(out.pr_url, 'https://github.com/artyhoo/getff/pull/7777');
  assert.equal(ledger.getExecution(claim.execution_id).state, 'REQUIRES_REVIEW');
  assert.equal(ledger.getExecution(claim.execution_id).attempts_admitted, 1); // monitor consumed NO reservation
  assert.ok(ledger.getWorkerReport(claim.execution_id), 'worker report persisted from the adopted capture');
  assert.equal(ledger.getAttempt(claim.execution_id, 1).state, 'REQUIRES_REVIEW');
  assert.equal(calls.length, 0); // no PR verification before the review gate
  rmSync(dir, { recursive: true, force: true });
});

test('adopt-monitor: unprovable child identity -> hold, no signal, no spawn', async () => {
  const { dir, ledger } = env0();
  const { claim } = adoptedExecution(ledger, { dir });
  const out = await monitorAdoptedChild({
    ledger, executionId: claim.execution_id, dir,
    processProbe: () => ({ alive: true, start: 'forged start text' }),
    clock: fakeClock({ bootId: 'BOOT-1' }),
    pollIntervalMs: 5, deadlineMs: 5_000,
  });
  assert.equal(out.state, 'UNCERTAIN');
  assert.equal(out.blocker, 'UNCERTAIN_IDENTITY');
  assert.equal(ledger.getExecution(claim.execution_id).state, 'RECOVERING_HOST'); // slot retained, nothing signaled
  rmSync(dir, { recursive: true, force: true });
});

// ------------------------------------------- R11: private packet binding
//
// repair-code-review.json R11: initial argv concatenated raw payload.kickoff
// and checkpoints carried a weak nullable artifact_sha256. Frozen §6: private
// 0600 fsynced immutable framing+kickoff files (symlink rejected, identical
// replay only), -p constant/path/digest ONLY, artifact_sha256 = the manifest
// WHOLE-file hash with separate envelope/kickoff/framing digests, and every
// packet element verified before attempt reserve/spawn.

test('R11 run: -p is constant/paths/digests only; framing+kickoff files are private exact bytes; checkpoint binds the whole-artifact packet', async () => {
  const { dir, ledger } = env0();
  const solution = queuedSolution(ledger);
  const manifest = ledger.getManifest(solution.id);
  assert.ok(manifest, 'fixture registers the solution manifest (trusted artifact authority)');
  const child = fakeChild();
  const jobBranch = `codex/dot-job-${solution.sha256.slice(0, 12)}`;
  const gh = {
    view: () => viewJson(),
    checks: () => [{ name: 'ci', state: 'SUCCESS', bucket: 'pass', link: 'l' }],
  };
  const r = runExecution({
    ledger, solution, worktree: dir, dir,
    spawnImpl: captureSpawn(child), gitImpl: gitOk({ head: BASE_SHA, branch: jobBranch }), ghImpl: gh,
    clock: fakeClock(), pollIntervalMs: 5, startupTimeoutMs: 500, deadlineMs: 5_000,
  });
  await sleep(10);
  const execId = child.opts.env.DOT_RELAY_EXECUTION_ID;
  let kickoffPath;
  let framingPath;
  await guardedMidRun(r, child, () => {
    // the -p NEVER carries kickoff bytes — only the constant instruction, the
    // two private file paths and their digests
    const prompt = child.argv[child.argv.indexOf('-p') + 1];
    assert.ok(!prompt.includes('run the plan'), 'no raw kickoff bytes in the initial argv');
    assert.ok(!prompt.includes('# executor fixture kickoff'), 'no kickoff heading in the initial argv');
    kickoffPath = join(dir, 'worker', `${execId}.kickoff.md`);
    framingPath = join(dir, 'worker', `${execId}.framing.md`);
    assert.ok(prompt.includes(kickoffPath), 'initial argv references the kickoff file by path');
    assert.ok(prompt.includes(framingPath), 'initial argv references the framing file by path');
    assert.ok(prompt.includes(sha256Of(String(solution.payload.kickoff))), 'kickoff digest rides the initial argv');
    // private immutable files: regular files (never symlinks), mode 0600, exact bytes
    assert.ok(existsSync(framingPath), 'framing file published before spawn');
    assert.ok(existsSync(kickoffPath), 'kickoff file published before spawn');
    assert.equal(lstatSync(kickoffPath).isSymbolicLink(), false);
    assert.equal(lstatSync(framingPath).isSymbolicLink(), false);
    assert.equal(statSync(kickoffPath).mode & 0o777, 0o600);
    assert.equal(statSync(framingPath).mode & 0o777, 0o600);
    assert.equal(readFileSync(kickoffPath, 'utf8'), String(solution.payload.kickoff), 'exact original kickoff bytes');
  });

  writeFileSync(child.opts.env.DOT_RELAY_STARTUP_RECEIPT, JSON.stringify({
    session_id: child.opts.env.DOT_RELAY_SESSION_ID,
    execution_id: execId,
    worktree: dir,
  }));
  await sleep(30);
  writeFileSync(child.opts.stdoutPath, JSON.stringify(outerCapture(
    child.opts.env.DOT_RELAY_SESSION_ID,
    JSON.stringify(codeCompleteReport({
      executionId: execId,
      sessionId: child.opts.env.DOT_RELAY_SESSION_ID,
      solution,
      artifactSha256: manifest.artifact_sha256,
      prUrl: 'https://github.com/artyhoo/getff/pull/7001',
    })),
  )));
  child.exit(0);
  const out = await r;
  assert.equal(out.state, 'REQUIRES_REVIEW');
  // R10: the framing contract itself demands the strict CODE_COMPLETE report
  assert.ok(readFileSync(framingPath, 'utf8').includes('CODE_COMPLETE'), 'framing file requires the CODE_COMPLETE final report');
  const cp = JSON.parse(readFileSync(join(dir, 'worker', `${out.execution_id}.checkpoint.json`), 'utf8'));
  // artifact_sha256 is the manifest WHOLE-file hash — never the kickoff digest,
  // never null, never an arbitrary string
  assert.equal(cp.artifact_sha256, manifest.artifact_sha256);
  assert.notEqual(cp.artifact_sha256, solution.payload.kickoff_sha256);
  assert.equal(cp.artifact_bytes, manifest.artifact_bytes);
  assert.equal(cp.kickoff_sha256, solution.payload.kickoff_sha256);
  assert.equal(cp.framing_sha256, sha256Of(readFileSync(framingPath, 'utf8')));
  assert.equal(cp.solution_sha256, solution.sha256); // canonical envelope digest, separately bound
  rmSync(dir, { recursive: true, force: true });
});

test('R11 run: symlinked framing/kickoff paths are refused — fixed code, zero spawns, slot held', async () => {
  for (const which of ['kickoff', 'framing']) {
    const { dir, ledger } = env0();
    const solution = queuedSolution(ledger);
    const claim = ledger.claimExecution({ solutionId: solution.id, sessionId: 'r11-sess-0001-aaaa' });
    assert.equal(claim.claimed, true);
    const evil = join(dir, 'evil-target.md');
    writeFileSync(evil, '# evil payload\n');
    symlinkSync(evil, join(dir, 'worker', `${claim.execution_id}.${which}.md`));
    let spawned = 0;
    const out = await runExecution({
      ledger, solution, worktree: dir, dir, superviseExecutionId: claim.execution_id,
      spawnImpl: () => { spawned += 1; throw new Error('must not spawn'); },
      gitImpl: gitOk(), clock: fakeClock(), pollIntervalMs: 5,
    });
    assert.equal(out.state, 'BLOCKED');
    assert.equal(out.blocker, 'BLOCKED_PACKET_UNTRUSTED');
    assert.equal(spawned, 0, `${which}: no spawn through a symlinked packet path`);
    assert.equal(ledger.getExecution(claim.execution_id).state, 'BLOCKED'); // slot held, no retry
    assert.equal(readFileSync(evil, 'utf8'), '# evil payload\n', 'symlink target untouched');
    rmSync(dir, { recursive: true, force: true });
  }
});

test('R11 run: identical pre-existing kickoff file replays as a no-op; drifted bytes are refused (immutable)', async () => {
  // replay-identical: the exact original bytes already on disk — spawn proceeds
  {
    const { dir, ledger } = env0();
    const solution = queuedSolution(ledger);
    const claim = ledger.claimExecution({ solutionId: solution.id, sessionId: 'r11-sess-0002-bbbb' });
    writeFileSync(join(dir, 'worker', `${claim.execution_id}.kickoff.md`), String(solution.payload.kickoff), { mode: 0o600 });
    const child = fakeChild();
    const jobBranch = `codex/dot-job-${solution.sha256.slice(0, 12)}`;
    const r = runExecution({
      ledger, solution, worktree: dir, dir, superviseExecutionId: claim.execution_id,
      spawnImpl: captureSpawn(child), gitImpl: gitOk({ head: BASE_SHA, branch: jobBranch }),
      clock: fakeClock(), pollIntervalMs: 5, startupTimeoutMs: 300, deadlineMs: 5_000,
    });
    await sleep(10);
    await guardedMidRun(r, child, () => {
      assert.ok(Array.isArray(child.argv), 'identical replay does not block the spawn');
    });
    child.kill('SIGKILL'); // test cleanup
    await r;
    rmSync(dir, { recursive: true, force: true });
  }
  // byte drift: different bytes at the immutable path — refuse, never overwrite
  {
    const { dir, ledger } = env0();
    const solution = queuedSolution(ledger);
    const claim = ledger.claimExecution({ solutionId: solution.id, sessionId: 'r11-sess-0003-cccc' });
    writeFileSync(join(dir, 'worker', `${claim.execution_id}.kickoff.md`), '# drifted bytes\n', { mode: 0o600 });
    let spawned = 0;
    const out = await runExecution({
      ledger, solution, worktree: dir, dir, superviseExecutionId: claim.execution_id,
      spawnImpl: () => { spawned += 1; throw new Error('must not spawn'); },
      gitImpl: gitOk(), clock: fakeClock(), pollIntervalMs: 5,
    });
    assert.equal(out.state, 'BLOCKED');
    assert.equal(out.blocker, 'BLOCKED_PACKET_UNTRUSTED');
    assert.equal(spawned, 0);
    assert.equal(readFileSync(join(dir, 'worker', `${claim.execution_id}.kickoff.md`), 'utf8'), '# drifted bytes\n', 'drifted bytes never overwritten');
    rmSync(dir, { recursive: true, force: true });
  }
});

test('R11 resume: every packet tamper holds the slot — weak/null/any-string digests rejected, no admission, no spawn', async () => {
  const otherHex = sha256Of('a-different-valid-digest');
  const arms = [
    {
      name: 'kickoff file bytes swapped',
      expected: 'BLOCKED_PACKET_UNTRUSTED',
      tamper: ({ dir, ex }) => writeFileSync(join(dir, 'worker', `${ex}.kickoff.md`), '# tampered kickoff\n', { mode: 0o600 }),
    },
    {
      name: 'framing file bytes swapped',
      expected: 'BLOCKED_PACKET_UNTRUSTED',
      tamper: ({ dir, ex }) => writeFileSync(join(dir, 'worker', `${ex}.framing.md`), '# tampered framing\n', { mode: 0o600 }),
    },
    {
      name: 'kickoff file removed',
      expected: 'BLOCKED_PACKET_UNTRUSTED',
      tamper: ({ dir, ex }) => rmSync(join(dir, 'worker', `${ex}.kickoff.md`)),
    },
    {
      name: 'checkpoint artifact_sha256 null (weak legacy shape)',
      expected: 'BLOCKED_RESUME_METADATA',
      tamper: ({ dir, ex, cp }) => writeCp(dir, ex, { ...cp, artifact_sha256: null }),
    },
    {
      name: 'checkpoint artifact_sha256 any-string',
      expected: 'BLOCKED_RESUME_METADATA',
      tamper: ({ dir, ex, cp }) => writeCp(dir, ex, { ...cp, artifact_sha256: 'banana' }),
    },
    {
      name: 'checkpoint artifact_sha256 = kickoff digest (wrong binding)',
      expected: 'BLOCKED_RESUME_METADATA',
      tamper: ({ dir, ex, cp, packet }) => writeCp(dir, ex, { ...cp, artifact_sha256: packet.kickoff_sha256 }),
    },
    {
      name: 'checkpoint artifact_sha256 = a different valid 64-hex (manifest mismatch)',
      expected: 'BLOCKED_RESUME_METADATA',
      tamper: ({ dir, ex, cp }) => writeCp(dir, ex, { ...cp, artifact_sha256: otherHex }),
    },
    {
      name: 'checkpoint missing framing_sha256 entirely',
      expected: 'BLOCKED_RESUME_METADATA',
      tamper: ({ dir, ex, cp }) => {
        const { framing_sha256: _omit, ...rest } = cp;
        writeCp(dir, ex, rest);
      },
    },
  ];
  for (const arm of arms) {
    const { dir, ledger } = env0();
    const { solution, claim, jobBranch, packet } = interruptedExecution(ledger, { dir });
    const cp = JSON.parse(readFileSync(join(dir, 'worker', `${claim.execution_id}.checkpoint.json`), 'utf8'));
    arm.tamper({ dir, ex: claim.execution_id, cp, packet });
    let spawned = 0;
    const out = await resumeExecution({
      ledger, solution, executionId: claim.execution_id, dir,
      spawnImpl: () => { spawned += 1; throw new Error('must not spawn'); },
      gitImpl: gitOk({ head: BASE_SHA, branch: jobBranch, toplevel: dir }), sessionProbe: () => [],
      clock: fakeClock({ bootId: 'BOOT-2' }), pollIntervalMs: 5,
    });
    assert.equal(out.state, 'BLOCKED', arm.name);
    assert.equal(out.blocker, arm.expected, arm.name);
    assert.equal(spawned, 0, `${arm.name}: no spawn`);
    // terminal BLOCKED — never back to a retryable recovery state
    assert.equal(ledger.getExecution(claim.execution_id).state, 'BLOCKED', `${arm.name}: slot held terminally`);
    assert.equal(ledger.getExecution(claim.execution_id).attempts_admitted, 1, `${arm.name}: no admission consumed`);
    rmSync(dir, { recursive: true, force: true });
  }
});

// ------------------------------------------- active-clock.py (HOST-RESILIENCE §3)
//
// The helper is the ONLY producer of budget evidence. Inventory ruling: its
// tests live in executor.test.mjs because the authorized inventory adds only
// active-clock.py as a new file (a separate *.test.mjs would expand inventory).

const CLOCK_SCRIPT = fileURLToPath(new URL('./active-clock.py', import.meta.url));

function spawnClock(extraEnv = {}) {
  return childSpawn('python3', [CLOCK_SCRIPT], {
    stdio: ['pipe', 'pipe', 'inherit'],
    env: { ...process.env, DOT_RELAY_CLOCK_GRACE_S: '1', ...extraEnv },
  });
}

function nextJsonLine(proc, { timeoutMs = 5_000 } = {}) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('no clock line within timeout')), timeoutMs);
    let buf = proc.__clockBuf ?? '';
    const onData = (d) => {
      buf += d.toString('utf8');
      const i = buf.indexOf('\n');
      if (i >= 0) {
        clearTimeout(t);
        proc.stdout.off('data', onData);
        proc.__clockBuf = buf.slice(i + 1);
        res(buf.slice(0, i));
      }
    };
    proc.stdout.on('data', onData);
    proc.once('error', (e) => { clearTimeout(t); rej(e); });
  });
}

const exitedCode = (proc) => new Promise((res) => proc.on('exit', (c, s) => res({ code: c, signal: s })));

test('active-clock.py: first line within 5s = boot_id + decimal active_ns, monotonic', { skip: process.platform !== 'darwin' }, async () => {
  const p = spawnClock();
  const l1 = JSON.parse(await nextJsonLine(p));
  assert.equal(typeof l1.boot_id, 'string');
  assert.ok(l1.boot_id.length >= 8);
  assert.ok(/^\d+$/.test(String(l1.active_ns))); // decimal nanoseconds
  const sysctl = execFileSync('/usr/sbin/sysctl', ['-n', 'kern.bootsessionuuid'], { encoding: 'utf8' }).trim();
  assert.equal(l1.boot_id, sysctl); // identity is the OS boot session, never a guess
  const l2 = JSON.parse(await nextJsonLine(p));
  assert.ok(BigInt(l2.active_ns) >= BigInt(l1.active_ns)); // never backwards
  p.stdin.end();
  const x = await exitedCode(p);
  assert.equal(x.code, 0); // clean stop on EOF with no registered child
});

test('active-clock.py: stdin EOF TERMs the registered exact child (parent-IPC death)', { skip: process.platform !== 'darwin' }, async () => {
  const sleeper = childSpawn('/bin/sleep', ['30']);
  const start = execFileSync('ps', ['-o', 'lstart=', '-p', String(sleeper.pid)], { encoding: 'utf8' }).trim();
  const p = spawnClock();
  await nextJsonLine(p); // helper alive and sampling
  p.stdin.write(`${JSON.stringify({ child_pid: sleeper.pid, child_start: start })}\n`);
  await sleep(300); // registration consumed
  p.stdin.end(); // supervisor death
  const [pyX, sleepX] = await Promise.all([exitedCode(p), exitedCode(sleeper)]);
  assert.equal(pyX.code, 0);
  assert.ok(sleepX.signal === 'SIGTERM' || sleepX.code !== 0); // 30s sleeper died early
});

test('active-clock.py: reused pid with wrong start text is never signaled', { skip: process.platform !== 'darwin' }, async () => {
  const sleeper = childSpawn('/bin/sleep', ['30']);
  const p = spawnClock();
  await nextJsonLine(p);
  p.stdin.write(`${JSON.stringify({ child_pid: sleeper.pid, child_start: 'Mon Jan  1 00:00:00 2001' })}\n`);
  await sleep(300);
  p.stdin.end();
  const pyX = await exitedCode(p);
  assert.equal(pyX.code, 0);
  await sleep(300);
  assert.equal(sleeper.exitCode, null); // still alive: identity mismatch -> no signal
  assert.equal(sleeper.signalCode, null);
  sleeper.kill('SIGKILL');
  await exitedCode(sleeper);
});

test('startActiveClock.registerChild: supervisor stop (stdin EOF) TERMs the registered exact child', { skip: process.platform !== 'darwin' }, async () => {
  const sleeper = childSpawn('/bin/sleep', ['30']);
  const start = execFileSync('ps', ['-o', 'lstart=', '-p', String(sleeper.pid)], { encoding: 'utf8' }).trim();
  const clock = startActiveClock({ graceS: 1 });
  assert.equal(await clock.ready(5_000), true);
  clock.registerChild(sleeper.pid, start); // supervisor-side registration wiring
  await sleep(300);
  clock.stop(); // supervisor death: stdin EOF -> helper cessation ladder
  const sx = await Promise.race([exitedCode(sleeper), sleep(5_000).then(() => null)]);
  assert.ok(sx, 'registered child died after supervisor stop');
  assert.ok(sx.signal === 'SIGTERM' || sx.code !== null);
});

test('active-clock.py --sample-once: exactly ONE {boot_id,active_ns} line then exit 0 (R08)', { skip: process.platform !== 'darwin' }, async () => {
  const p = childSpawn('python3', [CLOCK_SCRIPT, '--sample-once'], { stdio: ['ignore', 'pipe', 'inherit'] });
  let out = '';
  p.stdout.on('data', (d) => { out += d.toString('utf8'); });
  const x = await Promise.race([exitedCode(p), sleep(5_000).then(() => null)]);
  assert.ok(x, 'sample-once must exit on its own without stdin/EOF help');
  assert.equal(x.code, 0);
  const lines = out.trim().split('\n').filter((l) => l.length > 0);
  assert.equal(lines.length, 1); // ONLY the sample — never the continuous stream
  const j = JSON.parse(lines[0]);
  assert.equal(typeof j.boot_id, 'string');
  assert.ok(j.boot_id.length >= 8);
  assert.ok(/^\d+$/.test(String(j.active_ns))); // decimal nanoseconds
});

// ------------------------------------------- R08: independent clock freshness
//
// The continuous helper alone cannot prove the budget: a STALLED main helper
// would freeze active_ns and the attempt would run forever. An independent
// --sample-once probe (same helper script, one-shot mode) must validate, at
// every budget/identity decision: same boot, monotonic, and bounded active-ms
// skew against the continuous stream. Query timeout / error / boot mismatch /
// backward sample make the clock unproven (sticky); a window violation is a
// freshness verdict (recoverable by the next good probe).

test('validateFreshnessWindow: healthy / sleep zero-gap / stalled helper / stale probe / boot mismatch (R08)', () => {
  const ns = (ms) => BigInt(ms) * 1_000_000n;
  const boot = 'BOOT-EX';
  // healthy: independent read taken moments after the helper's stream line
  assert.equal(validateFreshnessWindow({ helperBoot: boot, helperNs: ns(1_000), sample: { boot, ns: ns(1_400) } }).ok, true);
  // longsleep: BOTH clocks exclude host sleep — identical samples across a sleep stay fresh
  assert.equal(validateFreshnessWindow({ helperBoot: boot, helperNs: ns(1_000), sample: { boot, ns: ns(1_000) } }).ok, true);
  // stalled main helper: the independent clock ran >5000 active ms ahead
  assert.equal(validateFreshnessWindow({ helperBoot: boot, helperNs: ns(1_000), sample: { boot, ns: ns(7_000) } }).ok, false);
  // dead refresher: the helper stream ran >5000 active ms past the last validated probe
  assert.equal(validateFreshnessWindow({ helperBoot: boot, helperNs: ns(9_000), sample: { boot, ns: ns(1_000) } }).ok, false);
  // reboot between the helper anchor and the independent probe
  assert.equal(validateFreshnessWindow({ helperBoot: boot, helperNs: ns(1_000), sample: { boot: 'BOOT-NEW', ns: ns(1_200) } }).ok, false);
});

test('sampleOnceIndependent: real --sample-once resolves boot+ns inside the wall watchdog (R08)', { skip: process.platform !== 'darwin' }, async () => {
  const r = await sampleOnceIndependent({ timeoutMs: 10_000 });
  assert.equal(r.ok, true);
  const sysctl = execFileSync('/usr/sbin/sysctl', ['-n', 'kern.bootsessionuuid'], { encoding: 'utf8' }).trim();
  assert.equal(r.boot, sysctl); // identity is the OS boot session, never a guess
  assert.ok(/^\d+$/.test(r.activeNs));
});

test('sampleOnceIndependent: a hung probe is killed by the wall watchdog, never unbounded (R08)', async () => {
  const hangDir = mkdtempSync(join(tmpdir(), 'dot-relay-hang-'));
  const hangScript = join(hangDir, 'hang.mjs'); // a real process that never exits on its own
  writeFileSync(hangScript, 'setInterval(() => {}, 1e9);\n');
  try {
    const t0 = Date.now();
    const r = await sampleOnceIndependent({ python: process.execPath, script: hangScript, timeoutMs: 250 });
    assert.ok(Date.now() - t0 < 3_000, 'watchdog bounds the independent query');
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'watchdog-timeout');
  } finally {
    rmSync(hangDir, { recursive: true, force: true });
  }
});

test('startActiveClock freshness: bounded skew stays fresh, >window skew unproves the budget, recovery restores (R08)', { skip: process.platform !== 'darwin' }, async () => {
  const skew = { ms: 0 };
  const clock = startActiveClock({
    graceS: 1, refreshMs: 100, watchdogMs: 2_000,
    sampler: () => new Promise((res) => {
      const tryNow = () => {
        const boot = clock.bootId();
        const base = clock.activeNs();
        if (boot && base !== null) {
          res({ ok: true, boot, activeNs: String(base + BigInt(skew.ms) * 1_000_000n) });
        } else setTimeout(tryNow, 50); // helper first line pending
      };
      tryNow();
    }),
  });
  try {
    assert.equal(await clock.ready(5_000), true);
    await sleep(400); // refresher lands validated independent samples
    assert.equal(clock.fresh(), true);
    skew.ms = 6_000; // simulate a STALLED main helper: independent runs 6s ahead
    await sleep(400);
    assert.equal(clock.fresh(), false, 'window violation unproves freshness');
    assert.equal(clock.ok(), true, 'helper itself still streams — only freshness is unproven');
    skew.ms = 0; // the next good probe restores the verdict (non-sticky window)
    await sleep(400);
    assert.equal(clock.fresh(), true);
  } finally {
    clock.stop();
  }
});

test('startActiveClock: query watchdog / boot mismatch / backward sample make the clock unproven — sticky (R08)', { skip: process.platform !== 'darwin' }, async () => {
  // 1) a probe that never resolves is bounded by the wall cleanup watchdog
  const hung = startActiveClock({ graceS: 1, refreshMs: 50, watchdogMs: 150, sampler: () => new Promise(() => {}) });
  try {
    assert.equal(await hung.ready(5_000), true);
    await sleep(500);
    assert.equal(hung.ok(), false, 'query timeout -> clock unproven');
    assert.equal(hung.fresh(), false);
  } finally { hung.stop(); }
  // 2) independent sample from a DIFFERENT boot (reboot raced the helper)
  const foreign = { };
  foreign.clock = startActiveClock({
    graceS: 1, refreshMs: 100, watchdogMs: 2_000,
    sampler: () => new Promise((res) => {
      const t = () => {
        const base = foreign.clock.activeNs();
        if (foreign.clock.bootId() && base !== null) res({ ok: true, boot: 'BOOT-OTHER', activeNs: String(base) });
        else setTimeout(t, 50);
      };
      t();
    }),
  });
  try {
    assert.equal(await foreign.clock.ready(5_000), true);
    await sleep(400);
    assert.equal(foreign.clock.ok(), false, 'boot mismatch -> clock unproven (sticky)');
  } finally { foreign.clock.stop(); }
  // 3) backward independent sample: within the helper's window at first, then
  //    >window BELOW the validated baseline (mach time cannot go backwards)
  const back = { phase: 0 };
  back.clock = startActiveClock({
    graceS: 1, refreshMs: 100, watchdogMs: 2_000,
    sampler: () => new Promise((res) => {
      const t = () => {
        const boot = back.clock.bootId();
        const base = back.clock.activeNs();
        if (boot && base !== null) {
          back.phase += 1;
          const skewMs = back.phase === 1 ? 4_000 : -2_000; // +4s (stored), then 6s below it
          res({ ok: true, boot, activeNs: String(base + BigInt(skewMs) * 1_000_000n) });
        } else setTimeout(t, 50);
      };
      t();
    }),
  });
  try {
    assert.equal(await back.clock.ready(5_000), true);
    await sleep(500);
    assert.equal(back.clock.ok(), false, 'backward sample -> clock unproven (sticky)');
  } finally { back.clock.stop(); }
});

test('R08: a fresh()-false clock unproves the budget — CLOCK_UNPROVEN, never TIMED_OUT_ACTIVE', async () => {
  const { dir, ledger } = env0();
  const solution = queuedSolution(ledger);
  const child = fakeChild();
  const jobBranch = `codex/dot-job-${solution.sha256.slice(0, 12)}`;
  const clock = fakeClock({ advancePerReadMs: 60_000 }); // budget burns instantly IF freshness were ignored
  if (typeof clock.breakFreshness === 'function') clock.breakFreshness();
  const out = await runExecution({
    ledger, solution, worktree: dir, dir,
    spawnImpl: captureSpawn(child), gitImpl: gitOk({ head: BASE_SHA, branch: jobBranch }),
    clock, pollIntervalMs: 5, startupTimeoutMs: 500, deadlineMs: 3_000,
  });
  assert.equal(out.state, 'UNCERTAIN');
  assert.equal(out.blocker, 'CLOCK_UNPROVEN');
  assert.deepEqual(child.kills, ['SIGTERM']); // real cessation ran against the owned child
  rmSync(dir, { recursive: true, force: true });
});

// ------------------------------------------- R09: evidence-based cessation
//
// DEAD is returned ONLY on observed child exit or authoritative fresh process
// absence — never on a successful signal call. Fresh boot/PID/start/session
// match happens BEFORE EACH TERM and KILL; identity mismatch/unknown means
// UNCERTAIN and never a signal to a reused PID. TERM -> <=10s wall -> re-probe
// -> KILL exact owner if still live -> <=1s wall -> final re-probe. The
// adopted-child path uses the identical finite ladder and never loops on a
// frozen active clock.

const REUSED_START = 'Mon Oct  6 12:34:56 2026';

test('R09: signaled-but-unproven death is UNCERTAIN_STOP — never TIMED_OUT_ACTIVE on a signal call', async () => {
  const { dir, ledger } = env0();
  const solution = queuedSolution(ledger);
  const child = fakeChild({ ignoreKills: true }); // signals recorded, child never dies
  const jobBranch = `codex/dot-job-${solution.sha256.slice(0, 12)}`;
  const clock = fakeClock(); // frozen: the test alone decides when the budget crosses
  const r = runExecution({
    ledger, solution, worktree: dir, dir,
    spawnImpl: captureSpawn(child), gitImpl: gitOk({ head: BASE_SHA, branch: jobBranch }),
    clock,
    pollIntervalMs: 5, startupTimeoutMs: 500, deadlineMs: 60_000, termGraceMs: 40,
  });
  await sleep(10);
  writeFileSync(child.opts.env.DOT_RELAY_STARTUP_RECEIPT, JSON.stringify({
    session_id: child.opts.env.DOT_RELAY_SESSION_ID,
    execution_id: child.opts.env.DOT_RELAY_EXECUTION_ID,
    worktree: dir,
  }));
  await sleep(30); // RUNNING loop on the frozen clock
  clock.advanceMs(60_000); // budget exhausts with the child still exact-live
  const out = await r;
  assert.equal(out.state, 'UNCERTAIN');
  assert.equal(out.blocker, 'UNCERTAIN_STOP');
  assert.deepEqual(child.kills, ['SIGTERM', 'SIGKILL']); // the full finite ladder ran
  assert.equal(ledger.getExecution(child.opts.env.DOT_RELAY_EXECUTION_ID).state, 'UNCERTAIN'); // slot retained
  rmSync(dir, { recursive: true, force: true });
});

test('R09: pid reused between TERM and KILL — the KILL never fires; verdict stays uncertain', async () => {
  const { dir, ledger } = env0();
  const solution = queuedSolution(ledger);
  let probeCalls = 0;
  const child = fakeChild({
    ignoreKills: true,
    probeImpl: () => {
      probeCalls += 1;
      // pre-TERM probe: exact owner; every later probe: SAME pid, DIFFERENT start
      return probeCalls <= 1
        ? { pid: 4242, start: '2026-10-08T10:00:00.000Z', found: true }
        : { pid: 4242, start: REUSED_START, found: true };
    },
  });
  const jobBranch = `codex/dot-job-${solution.sha256.slice(0, 12)}`;
  const clock = fakeClock();
  const r = runExecution({
    ledger, solution, worktree: dir, dir,
    spawnImpl: captureSpawn(child), gitImpl: gitOk({ head: BASE_SHA, branch: jobBranch }),
    clock,
    pollIntervalMs: 5, startupTimeoutMs: 500, deadlineMs: 60_000, termGraceMs: 40,
  });
  await sleep(10);
  writeFileSync(child.opts.env.DOT_RELAY_STARTUP_RECEIPT, JSON.stringify({
    session_id: child.opts.env.DOT_RELAY_SESSION_ID,
    execution_id: child.opts.env.DOT_RELAY_EXECUTION_ID,
    worktree: dir,
  }));
  await sleep(30);
  clock.advanceMs(60_000);
  const out = await r;
  assert.deepEqual(child.kills, ['SIGTERM'], 'KILL must never fire on a reused pid');
  assert.equal(out.state, 'UNCERTAIN');
  assert.equal(out.blocker, 'UNCERTAIN_STOP'); // signaled, outcome unproven
  rmSync(dir, { recursive: true, force: true });
});

test('R09: pre-signal identity mismatch (reused/unknown) — ZERO signals, UNCERTAIN_IDENTITY', async () => {
  const { dir, ledger } = env0();
  const solution = queuedSolution(ledger);
  const reusedFromStart = fakeChild({
    ignoreKills: true,
    probeImpl: () => ({ pid: 4242, start: REUSED_START, found: true }),
  });
  const jobBranch = `codex/dot-job-${solution.sha256.slice(0, 12)}`;
  const clock = fakeClock();
  const r = runExecution({
    ledger, solution, worktree: dir, dir,
    spawnImpl: captureSpawn(reusedFromStart), gitImpl: gitOk({ head: BASE_SHA, branch: jobBranch }),
    clock,
    pollIntervalMs: 5, startupTimeoutMs: 500, deadlineMs: 60_000, termGraceMs: 40,
  });
  await sleep(10);
  writeFileSync(reusedFromStart.opts.env.DOT_RELAY_STARTUP_RECEIPT, JSON.stringify({
    session_id: reusedFromStart.opts.env.DOT_RELAY_SESSION_ID,
    execution_id: reusedFromStart.opts.env.DOT_RELAY_EXECUTION_ID,
    worktree: dir,
  }));
  await sleep(30);
  clock.advanceMs(60_000);
  const out = await r;
  assert.deepEqual(reusedFromStart.kills, [], 'no signal to a pid that is not the recorded owner');
  assert.equal(out.state, 'UNCERTAIN');
  assert.equal(out.blocker, 'UNCERTAIN_IDENTITY');
  rmSync(dir, { recursive: true, force: true });
});

test('R09: authoritative absence after KILL is DEAD (TIMED_OUT_ACTIVE), not UNCERTAIN_STOP', async () => {
  const { dir, ledger } = env0();
  const solution = queuedSolution(ledger);
  let probeCalls = 0;
  const child = fakeChild({
    ignoreKills: true, // signals do nothing; only the process table decides
    probeImpl: () => {
      probeCalls += 1;
      // exact-live for the pre-TERM and pre-KILL probes; GONE at the final re-probe
      return { pid: 4242, start: '2026-10-08T10:00:00.000Z', found: probeCalls <= 2 };
    },
  });
  const jobBranch = `codex/dot-job-${solution.sha256.slice(0, 12)}`;
  const clock = fakeClock();
  const r = runExecution({
    ledger, solution, worktree: dir, dir,
    spawnImpl: captureSpawn(child), gitImpl: gitOk({ head: BASE_SHA, branch: jobBranch }),
    clock,
    pollIntervalMs: 5, startupTimeoutMs: 500, deadlineMs: 60_000, termGraceMs: 40,
  });
  await sleep(10);
  writeFileSync(child.opts.env.DOT_RELAY_STARTUP_RECEIPT, JSON.stringify({
    session_id: child.opts.env.DOT_RELAY_SESSION_ID,
    execution_id: child.opts.env.DOT_RELAY_EXECUTION_ID,
    worktree: dir,
  }));
  await sleep(30);
  clock.advanceMs(60_000);
  const out = await r;
  assert.deepEqual(child.kills, ['SIGTERM', 'SIGKILL']);
  assert.equal(out.state, 'TIMED_OUT_ACTIVE'); // fresh process absence proves death
  rmSync(dir, { recursive: true, force: true });
});

test('R09: adopted-child cessation is wall-bounded — a dead clock still gives full TERM grace before KILL', async () => {
  const { dir, ledger } = env0();
  const { claim } = adoptedExecution(ledger, { dir });
  const clock = fakeClock({ bootId: 'BOOT-1' });
  clock.breakClock(); // frozen/dead active clock — cleanup must still be finite
  const kills = [];
  let probing = true; // RED-phase safety: lets a runaway grace loop drain after the race
  const out = await Promise.race([
    monitorAdoptedChild({
      ledger, executionId: claim.execution_id, dir,
      processProbe: () => (probing ? { alive: true, start: CHILD_START } : { alive: false, start: null }),
      killImpl: (pid, sig) => { kills.push({ sig, at: Date.now() }); },
      clock,
      pollIntervalMs: 5, deadlineMs: 5_000, termGraceMs: 300,
    }),
    sleep(4_000).then(() => null),
  ]);
  if (!out) { probing = false; await sleep(100); } // drain any stuck loop before failing
  assert.ok(out, 'cessation completes — the frozen-clock grace loop must be wall-bounded, never infinite');
  assert.equal(out.state, 'UNCERTAIN');
  assert.equal(out.blocker, 'UNCERTAIN_STOP'); // death unproven dominates the cause reason
  assert.deepEqual(kills.map((k) => k.sig), ['SIGTERM', 'SIGKILL']);
  assert.ok(kills.length === 2 && kills[1].at - kills[0].at >= 250, 'TERM gets its full wall grace even with a dead clock');
  rmSync(dir, { recursive: true, force: true });
});

test('R09: adopted unkillable child -> UNCERTAIN_STOP, never TIMED_OUT_ACTIVE on signal calls', async () => {
  const { dir, ledger } = env0();
  const { claim } = adoptedExecution(ledger, { dir });
  const kills = [];
  let probing = true; // RED-phase safety: drains a grace loop keyed on a frozen clock
  const out = await Promise.race([
    monitorAdoptedChild({
      ledger, executionId: claim.execution_id, dir,
      processProbe: () => (probing ? { alive: true, start: CHILD_START } : { alive: false, start: null }),
      killImpl: (pid, sig) => { kills.push(sig); },
      clock: fakeClock({ bootId: 'BOOT-1' }), // anchor 990000000 -> used=10ms >= deadline
      pollIntervalMs: 5, deadlineMs: 5, termGraceMs: 40,
    }),
    sleep(8_000).then(() => null),
  ]);
  if (!out) { probing = false; await sleep(100); }
  assert.ok(out, 'ladder is finite even when signals accomplish nothing');
  assert.deepEqual(kills, ['SIGTERM', 'SIGKILL']);
  assert.equal(out.state, 'UNCERTAIN');
  assert.equal(out.blocker, 'UNCERTAIN_STOP');
  assert.equal(ledger.getExecution(claim.execution_id).state, 'UNCERTAIN'); // slot retained
  rmSync(dir, { recursive: true, force: true });
});

// ------------------------------------------- R07: supervisor lock reconciliation
//
// A stale lock must never block ordinary boot recovery: the holder's recorded
// boot/process identity decides — previous boot or proven-dead holder is taken
// over (evidence retained), a live or unprovable holder is preserved.

function lockProbe(map) {
  return (pid) => map.get(Number(pid)) ?? { alive: false, start: null };
}

function preexistingLock(dir, holder) {
  const workerDir = join(dir, 'worker');
  writeFileSync(join(workerDir, 'supervisor.lock'), JSON.stringify(holder));
  return join(workerDir, 'supervisor.lock');
}

test('R07: run mode — previous-boot stale lock is taken over (evidence retained) and the run completes DONE', async () => {
  const { dir, ledger } = env0();
  const solution = queuedSolution(ledger);
  const child = fakeChild();
  const jobBranch = `codex/dot-job-${solution.sha256.slice(0, 12)}`;
  const lockPath = preexistingLock(dir, { pid: 4242, start: SUP_START, boot_id: 'BOOT-OLD', execution_id: 'DOT-EXEC-OLD' });
  const calls = [];
  const r = runExecution({
    ledger, solution, worktree: dir, dir,
    spawnImpl: captureSpawn(child), gitImpl: gitOk({ head: BASE_SHA, branch: jobBranch }), ghImpl: ghDone(calls),
    clock: fakeClock(),
    pollIntervalMs: 5, startupTimeoutMs: 500, deadlineMs: 5_000,
  });
  await sleep(10);
  // mid-run: THIS supervisor's boot owns the lock; the takeover is audited in place
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  assert.equal(lock.boot_id, 'BOOT-EX');
  assert.equal(lock.takeover.reason, 'previous-boot');
  assert.equal(lock.takeover.previous.boot_id, 'BOOT-OLD');
  assert.equal(lock.takeover.previous.pid, 4242);
  // the displaced holder's bytes are retained as evidence, never deleted
  assert.ok(readdirSync(join(dir, 'worker')).some((f) => f.startsWith('supervisor.lock.stale-')), 'stale lock retained');
  writeFileSync(child.opts.env.DOT_RELAY_STARTUP_RECEIPT, JSON.stringify({
    session_id: child.opts.env.DOT_RELAY_SESSION_ID,
    execution_id: child.opts.env.DOT_RELAY_EXECUTION_ID,
    worktree: dir,
  }));
  await sleep(20);
  writeFileSync(child.opts.stdoutPath, JSON.stringify({
    session_id: child.opts.env.DOT_RELAY_SESSION_ID,
    modelUsage: { 'glm-5.3': 1 },
    is_error: false,
    result: { status: 'DONE', pr_url: 'https://github.com/artyhoo/getff/pull/7778', head_sha: HEAD },
  }));
  child.exit(0);
  const out = await r;
  assert.equal(out.state, 'DONE');
  rmSync(dir, { recursive: true, force: true });
});

test('R07: run mode — same-boot DEAD holder is taken over (holder-dead) and the run proceeds', async () => {
  const { dir, ledger } = env0();
  const solution = queuedSolution(ledger);
  const child = fakeChild();
  const jobBranch = `codex/dot-job-${solution.sha256.slice(0, 12)}`;
  const lockPath = preexistingLock(dir, { pid: 4242, start: SUP_START, boot_id: 'BOOT-EX', execution_id: 'DOT-EXEC-D' });
  let spawned = 0;
  const r = runExecution({
    ledger, solution, worktree: dir, dir,
    spawnImpl: (executable, argv, opts) => { spawned += 1; return captureSpawn(child)(executable, argv, opts); },
    gitImpl: gitOk({ head: BASE_SHA, branch: jobBranch }),
    processProbe: lockProbe(new Map()), // holder pid 4242 is dead on this boot
    clock: fakeClock(),
    pollIntervalMs: 5, startupTimeoutMs: 500, deadlineMs: 5_000,
  });
  await sleep(10);
  assert.equal(spawned, 1, 'dead holder never blocks the run');
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  assert.equal(lock.takeover.reason, 'holder-dead');
  assert.equal(lock.takeover.previous.pid, 4242);
  // finish the run through the capture path (wrong session -> BLOCKED_CAPTURE)
  writeFileSync(child.opts.env.DOT_RELAY_STARTUP_RECEIPT, JSON.stringify({
    session_id: child.opts.env.DOT_RELAY_SESSION_ID,
    execution_id: child.opts.env.DOT_RELAY_EXECUTION_ID,
    worktree: dir,
  }));
  await sleep(20);
  writeFileSync(child.opts.stdoutPath, JSON.stringify({ session_id: 'not-the-session', modelUsage: {}, result: null, is_error: false }));
  child.exit(0);
  const out = await r;
  assert.equal(out.state, 'BLOCKED');
  assert.equal(out.blocker, 'BLOCKED_CAPTURE');
  rmSync(dir, { recursive: true, force: true });
});

test('R07: run mode — reused pid (alive, different start text) is taken over as pid-reused', async () => {
  const { dir, ledger } = env0();
  const solution = queuedSolution(ledger);
  const child = fakeChild();
  const jobBranch = `codex/dot-job-${solution.sha256.slice(0, 12)}`;
  const lockPath = preexistingLock(dir, { pid: 4242, start: SUP_START, boot_id: 'BOOT-EX', execution_id: 'DOT-EXEC-R' });
  const r = runExecution({
    ledger, solution, worktree: dir, dir,
    spawnImpl: captureSpawn(child), gitImpl: gitOk({ head: BASE_SHA, branch: jobBranch }),
    processProbe: lockProbe(new Map([[4242, { alive: true, start: 'Mon Oct  6 12:00:00 2026' }]])), // pid alive but NOT the holder
    clock: fakeClock(),
    pollIntervalMs: 5, startupTimeoutMs: 500, deadlineMs: 5_000,
  });
  await sleep(10);
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  assert.equal(lock.takeover.reason, 'pid-reused');
  writeFileSync(child.opts.env.DOT_RELAY_STARTUP_RECEIPT, JSON.stringify({
    session_id: child.opts.env.DOT_RELAY_SESSION_ID,
    execution_id: child.opts.env.DOT_RELAY_EXECUTION_ID,
    worktree: dir,
  }));
  await sleep(20);
  writeFileSync(child.opts.stdoutPath, JSON.stringify({ session_id: 'not-the-session', modelUsage: {}, result: null, is_error: false }));
  child.exit(0);
  assert.equal((await r).blocker, 'BLOCKED_CAPTURE');
  rmSync(dir, { recursive: true, force: true });
});

test('R07: run mode — LIVE same-boot holder is preserved: BLOCKED, zero spawns, lock bytes untouched', async () => {
  const { dir, ledger } = env0();
  const solution = queuedSolution(ledger);
  const holderStart = 'Mon Oct  6 11:00:00 2026';
  const holderJson = JSON.stringify({ pid: 4242, start: holderStart, boot_id: 'BOOT-EX', execution_id: 'DOT-EXEC-LIVE' });
  const lockPath = preexistingLock(dir, JSON.parse(holderJson));
  let spawned = 0;
  const out = await runExecution({
    ledger, solution, worktree: dir, dir,
    spawnImpl: () => { spawned += 1; return fakeChild(); },
    gitImpl: gitOk(),
    processProbe: lockProbe(new Map([[4242, { alive: true, start: holderStart }]])),
    clock: fakeClock(),
    pollIntervalMs: 5,
  });
  assert.equal(out.state, 'BLOCKED');
  assert.equal(out.blocker, 'SUPERVISOR_LOCK');
  assert.equal(spawned, 0);
  assert.equal(readFileSync(lockPath, 'utf8'), holderJson, 'live owner lock is never rewritten');
  rmSync(dir, { recursive: true, force: true });
});

test('R07: run exit removes the lock ONLY when it is still its OWN — a replacement lock survives', async () => {
  // Arm 1: mid-run, the lock file is REPLACED by another owner (takeover after
  // our supposed death). Our exit must NOT delete the successor's lock.
  const { dir, ledger } = env0();
  const solution = queuedSolution(ledger);
  const child = fakeChild();
  const jobBranch = `codex/dot-job-${solution.sha256.slice(0, 12)}`;
  const lockPath = join(dir, 'worker', 'supervisor.lock');
  const r = runExecution({
    ledger, solution, worktree: dir, dir,
    spawnImpl: captureSpawn(child), gitImpl: gitOk({ head: BASE_SHA, branch: jobBranch }),
    clock: fakeClock(),
    pollIntervalMs: 5, startupTimeoutMs: 500, deadlineMs: 5_000,
  });
  await sleep(10);
  writeFileSync(child.opts.env.DOT_RELAY_STARTUP_RECEIPT, JSON.stringify({
    session_id: child.opts.env.DOT_RELAY_SESSION_ID,
    execution_id: child.opts.env.DOT_RELAY_EXECUTION_ID,
    worktree: dir,
  }));
  await sleep(20);
  const replacement = JSON.stringify({
    pid: 4343, start: 'Mon Oct  6 13:00:00 2026', boot_id: 'BOOT-EX', execution_id: 'DOT-EXEC-REPLACEMENT',
  });
  writeFileSync(lockPath, replacement); // a successor took the slot while we run
  await sleep(10);
  writeFileSync(child.opts.stdoutPath, JSON.stringify({ session_id: 'not-the-session', modelUsage: {}, result: null, is_error: false }));
  child.exit(0);
  const out = await r;
  assert.equal(out.blocker, 'BLOCKED_CAPTURE');
  assert.equal(readFileSync(lockPath, 'utf8'), replacement, 'a replacement lock is never deleted by the displaced supervisor');

  // Arm 2: the SAME run shape without replacement — our OWN lock is removed on exit.
  const { dir: dir2, ledger: ledger2 } = env0();
  const solution2 = queuedSolution(ledger2);
  const child2 = fakeChild();
  const jobBranch2 = `codex/dot-job-${solution2.sha256.slice(0, 12)}`;
  const r2 = runExecution({
    ledger: ledger2, solution: solution2, worktree: dir2, dir: dir2,
    spawnImpl: captureSpawn(child2), gitImpl: gitOk({ head: BASE_SHA, branch: jobBranch2 }),
    clock: fakeClock(),
    pollIntervalMs: 5, startupTimeoutMs: 500, deadlineMs: 5_000,
  });
  await sleep(10);
  writeFileSync(child2.opts.env.DOT_RELAY_STARTUP_RECEIPT, JSON.stringify({
    session_id: child2.opts.env.DOT_RELAY_SESSION_ID,
    execution_id: child2.opts.env.DOT_RELAY_EXECUTION_ID,
    worktree: dir2,
  }));
  await sleep(20);
  writeFileSync(child2.opts.stdoutPath, JSON.stringify({ session_id: 'not-the-session', modelUsage: {}, result: null, is_error: false }));
  child2.exit(0);
  await r2;
  assert.ok(!existsSync(join(dir2, 'worker', 'supervisor.lock')), 'own lock is removed on exit');
  rmSync(dir, { recursive: true, force: true });
  rmSync(dir2, { recursive: true, force: true });
});

test('R07: run mode — unprovable holder (malformed bytes / missing identity) blocks as SUPERVISOR_LOCK_UNPROVEN, untouched', async () => {
  const { dir, ledger } = env0();
  const solution = queuedSolution(ledger);
  const lockPath = preexistingLock(dir, { pid: 4242, start: null, boot_id: 'BOOT-EX', execution_id: 'DOT-EXEC-U' });
  let spawned = 0;
  const out = await runExecution({
    ledger, solution, worktree: dir, dir,
    spawnImpl: () => { spawned += 1; return fakeChild(); },
    gitImpl: gitOk(),
    processProbe: lockProbe(new Map([[4242, { alive: true, start: 'anything' }]])), // alive, but the holder's identity was never recorded
    clock: fakeClock(),
    pollIntervalMs: 5,
  });
  assert.equal(out.state, 'BLOCKED');
  assert.equal(out.blocker, 'SUPERVISOR_LOCK_UNPROVEN');
  assert.equal(spawned, 0);
  assert.ok(readFileSync(lockPath, 'utf8').includes('"execution_id":"DOT-EXEC-U"'), 'file untouched');

  // raw non-JSON bytes: same conservative refusal
  const { dir: dir2, ledger: ledger2 } = env0();
  const solution2 = queuedSolution(ledger2);
  const lockPath2 = join(dir2, 'worker', 'supervisor.lock');
  writeFileSync(lockPath2, 'not-json');
  const out2 = await runExecution({
    ledger: ledger2, solution: solution2, worktree: dir2, dir: dir2,
    spawnImpl: () => { spawned += 1; return fakeChild(); },
    gitImpl: gitOk(),
    clock: fakeClock(),
    pollIntervalMs: 5,
  });
  assert.equal(out2.blocker, 'SUPERVISOR_LOCK_UNPROVEN');
  assert.equal(readFileSync(lockPath2, 'utf8'), 'not-json');
  assert.equal(spawned, 0);
  rmSync(dir, { recursive: true, force: true });
  rmSync(dir2, { recursive: true, force: true });
});

test('R07: resume mode — stale previous-boot lock reconciled BEFORE admission; resume completes DONE on the checkpoint PR', async () => {
  const { dir, ledger } = env0();
  const PR = 'https://github.com/artyhoo/getff/pull/9999';
  const { solution, claim, jobBranch } = interruptedExecution(ledger, { dir, prUrl: PR });
  const lockPath = preexistingLock(dir, { pid: 501, start: SUP_START, boot_id: 'BOOT-1', execution_id: claim.execution_id });
  const child = fakeChild();
  const r = resumeExecution({
    ledger, solution, executionId: claim.execution_id, dir,
    spawnImpl: captureSpawn(child),
    gitImpl: gitOk({ head: BASE_SHA, branch: jobBranch, toplevel: dir }),
    ghImpl: ghDone([]),
    sessionProbe: () => [],
    clock: fakeClock({ bootId: 'BOOT-2' }),
    pollIntervalMs: 5, deadlineMs: 5_000,
  });
  await sleep(10);
  assert.equal(child.argv[child.argv.indexOf('--resume') + 1], 'resume-sess-0001-aaaa');
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  assert.equal(lock.boot_id, 'BOOT-2');
  assert.equal(lock.takeover.reason, 'previous-boot');
  assert.equal(lock.takeover.previous.boot_id, 'BOOT-1');
  writeFileSync(child.opts.stdoutPath, JSON.stringify({
    session_id: 'resume-sess-0001-aaaa',
    modelUsage: { 'glm-5.3': 1 },
    is_error: false,
    result: { status: 'DONE', pr_url: PR, head_sha: HEAD },
  }));
  child.exit(0);
  const out = await r;
  assert.equal(out.state, 'DONE');
  assert.equal(out.pr_url, PR);
  assert.equal(ledger.getExecution(claim.execution_id).attempts_admitted, 2);
  assert.equal(ledger.getExecution(claim.execution_id).state, 'DONE');
  rmSync(dir, { recursive: true, force: true });
});

test('R07: resume mode — LIVE same-boot holder blocks BEFORE admission (no recovery attempt consumed)', async () => {
  const { dir, ledger } = env0();
  const { solution, claim, jobBranch } = interruptedExecution(ledger, { dir });
  const holderStart = 'Mon Oct  6 11:00:00 2026';
  preexistingLock(dir, { pid: 4242, start: holderStart, boot_id: 'BOOT-2', execution_id: claim.execution_id });
  let spawned = 0;
  const out = await resumeExecution({
    ledger, solution, executionId: claim.execution_id, dir,
    spawnImpl: () => { spawned += 1; return fakeChild(); },
    gitImpl: gitOk({ branch: jobBranch, toplevel: dir }),
    sessionProbe: () => [],
    processProbe: lockProbe(new Map([[4242, { alive: true, start: holderStart }]])),
    clock: fakeClock({ bootId: 'BOOT-2' }),
    pollIntervalMs: 5,
  });
  assert.equal(out.state, 'BLOCKED');
  assert.equal(out.blocker, 'SUPERVISOR_LOCK');
  assert.equal(spawned, 0);
  assert.equal(ledger.getExecution(claim.execution_id).attempts_admitted, 1, 'no attempt reservation burned on a live holder');
  assert.equal(ledger.getExecution(claim.execution_id).state, 'INTERRUPTED_HOST', 'slot retained');
  rmSync(dir, { recursive: true, force: true });
});

test('R07: parseAgentsCensus — supported spellings project, completed sessions are not live, unprovable input fails closed', () => {
  // non-array CLI output is never treated as proven absence
  assert.equal(parseAgentsCensus('garbage').identityUnproven, true);
  assert.equal(parseAgentsCensus(null).identityUnproven, true);

  const entries = [
    { sessionId: 'sess-1', PID: 111, cwd: '/repo', status: 'Running' }, // camelCase sessionId + PID
    { sessionID: 'sess-2', pid: '222', cwd: '/other' }, // sessionID + string pid, no status -> live
    { session_id: 'sess-3', pid: 333, status: 'completed' }, // completed metadata
    { pid: 555 }, // live-shaped entry with NO session id spelling — cannot prove it is not the target
  ];
  // one unprojectable LIVE entry poisons the census: identity unproven
  assert.equal(parseAgentsCensus(entries).identityUnproven, true);

  const clean = entries.slice(0, 3);
  const all = parseAgentsCensus(clean);
  assert.ok(Array.isArray(all));
  assert.deepEqual(all.map((x) => x.session_id), ['sess-1', 'sess-2'], 'completed session excluded from the live set');
  assert.equal(all[0].pid, 111);
  assert.equal(all[1].pid, 222); // numeric coercion
  assert.equal(all[1].cwd, '/other');
  assert.equal(all[1].status, null);

  // scoping by session id
  assert.deepEqual(parseAgentsCensus(clean, { sessionId: 'sess-1' }).map((x) => x.session_id), ['sess-1']);
  // cwd scoping applies when the entry carries a cwd
  assert.deepEqual(parseAgentsCensus(clean, { sessionId: 'sess-1', cwd: '/other' }), []);
  // a completed entry without any pid is still valid metadata: skipped, not unproven
  assert.deepEqual(parseAgentsCensus([{ session_id: 'sess-9', status: 'finished' }], { sessionId: 'sess-9' }), []);
});
