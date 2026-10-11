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
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

import { openLedger } from './ledger.mjs';
import { digest, envelopeDigest, CHAT_IDS, reportKey } from './contract.mjs';
import {
  buildArgv, buildResumeArgv, runExecution, resumeExecution, monitorAdoptedChild, verifyPr,
  isOwnedChild, startActiveClock, parseAgentsCensus,
  validateFreshnessWindow, sampleOnceIndependent,
  proveProcessDeath, acquireSupervisorLock,
  GLM_WRAPPER, ALLOW_TOOLS, DISALLOWED_TOOLS,
} from './executor.mjs';
// R10: applyReviewAndVerify is imported dynamically inside the review-gate
// lifecycle test — a static named import of a not-yet-existing export is a
// module-link error that would fail the WHOLE file and mask every other
// test's own RED reason.

const sha256Of = (s) => createHash('sha256').update(s).digest('hex');
const sha256OfBytes = (b) => createHash('sha256').update(b).digest('hex');
const sha40 = (s) => sha256Of(s).slice(0, 40);

let nowMs = 5_000_000;
const now = () => nowMs;

const BASE_SHA = sha40('origin-staging-base');
const HEAD = sha40('pr-head');

// F07: the deployed review policy snapshot — the required checks the receipt
// was approved under, each bound to its expected workflow/app identity. This
// is what verifyPr compares the ACTUAL `gh pr checks --required` set against.
const POLICY = {
  version: 1,
  digest: sha256Of('review-policy-v1:artyhoo/getff:ci'),
  required: [{ name: 'ci', workflow: 'CI' }],
};

// F07: fake trusted Dot-importer adapter. The REAL adapter (verifying actual
// Dot evidence against the configured producer/Page and the exact published
// source bytes) is an unsupplied external contract — production supplies
// NONE. This fake models its decision shape only: it attributes the receipt
// to the configured producer identity and to the exact artifact bytes the
// worker report recorded, and never throws on a malformed receipt.
const dotProvenance = ({ reviewer = 'dot-relay-os-owner' } = {}) => ({
  verifyReceipt: ({ receipt, report }) => {
    if (!receipt || typeof receipt !== 'object' || typeof receipt.reviewer !== 'string'
      || !receipt.source || typeof receipt.source !== 'object') {
      return { ok: false, reason: 'not-a-v2-dot-receipt' };
    }
    if (receipt.reviewer !== reviewer) return { ok: false, reason: 'reviewer-not-the-configured-producer' };
    if (receipt.source.sha256 !== report.artifact_sha256) {
      return { ok: false, reason: 'source-bytes-not-the-published-artifact' };
    }
    return { ok: true, evidence: { importer: 'fake-dot-importer', reviewer: receipt.reviewer, source_sha256: receipt.source.sha256 } };
  },
});
const permissiveProvenance = () => ({ verifyReceipt: () => ({ ok: true, evidence: { importer: 'test' } }) });

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

// F05: manifest bound to exact published bytes (any producer serialization).
function manifestForBytes(e, destination, { sha, bytes }) {
  return {
    version: 1, status: 'READY', event_id: e.id, kind: e.kind, producer: e.producer,
    destination, sha256: sha, bytes,
    parents: e.parents, artifact: { page_id: `page-${e.id}`, reference: 'library-file:fixtures.json' }, delivery_id: null,
  };
}

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
function writePacketFiles(dir, executionId, solution, serialize = (e) => JSON.stringify(e)) {
  const kickoffText = String(solution.payload.kickoff);
  const framingText = `# dot relay worker framing (fixture)\nconstant contract text for ${executionId}\n`;
  writeFileSync(join(dir, 'worker', `${executionId}.kickoff.md`), kickoffText, { mode: 0o600 });
  writeFileSync(join(dir, 'worker', `${executionId}.framing.md`), framingText, { mode: 0o600 });
  const artifactBytes = Buffer.from(serialize(solution), 'utf8');
  return {
    artifact_sha256: sha256OfBytes(artifactBytes),
    artifact_bytes: artifactBytes.length,
    kickoff_sha256: sha256Of(kickoffText),
    framing_sha256: sha256Of(framingText),
  };
}

// F05 fixture options:
//  - serialize: how the producer serialized the ORIGINAL artifact file
//    (compact default; pretty/reordered/LF variants per test arm)
//  - envelopeOverride: publish a DIFFERENT envelope's bytes under this
//    solution's manifest (foreign-id / swapped-payload tamper arms)
//  - manifestOverride: register a drifted manifest (wrong bytes column arm)
function queuedSolution(ledger, dir, { serialize, envelopeOverride, manifestOverride } = {}) {
  const mk = (kind, id, producer, parents, payload) => {
    const e = { version: 1, kind, id, producer, parents, payload, sha256: null };
    // contract convention: the envelope digest EXCLUDES the sha256 field
    e.sha256 = envelopeDigest(e);
    return e;
  };
  const reports = [];
  for (let i = 0; i < 3; i++) {
    const body = `executor-fixture body ${i} ${'z'.repeat(20)}`;
    // unique comment id PER CALL: the report key is digest(repository,
    // comment_id, body_sha256, reviewed_sha) — fixed ids make a second
    // queuedSolution() in the same ledger a CONSUMED replay (no outbox row).
    reports.push({ repository: 'artyhoo/getff', pr: 2200, comment_id: `ex-${randomUUID().slice(0, 8)}-${i}`, body_sha256: sha256Of(body), reviewed_sha: sha40(`rv-${i}`), body });
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
    // F05: non-ASCII fixture text — every published original is multibyte at
    // the byte level, so the exact-byte verifier is exercised on real UTF-8.
    acceptance: ['green — зелёный прогон 東京 🚀'],
    kickoff_sha256: sha256Of(kickoff),
    commands_sha256: digest(commands),
  });
  ledger.ingest(solution);
  // R11: the solution's public manifest is the ONLY whole-artifact authority —
  // run/resume packet verification reads it, so the fixture registers it the
  // way production does (solver manifest of the solution event). F05: the
  // ORIGINAL serialized artifact file is published into the runtime object
  // store under its own whole-file hash — exact producer bytes in WHATEVER
  // serialization the producer used; the verifier must read these bytes, never
  // a canonical reconstruction.
  const ser = serialize ?? ((e) => JSON.stringify(e));
  const published = envelopeOverride ? envelopeOverride(solution) : solution;
  const fileBytes = Buffer.from(ser(published), 'utf8');
  let manifest = manifestForBytes(solution, 'coordinator', { sha: sha256OfBytes(fileBytes), bytes: fileBytes.length });
  if (manifestOverride) manifest = manifestOverride(manifest);
  if (dir) {
    writeFileSync(join(dir, 'objects', `${manifest.sha256}.json`), fileBytes, { mode: 0o600 });
  }
  ledger.manifestImport({ manifest, producerRole: 'solver', cursorToken: `tok-${solution.id}` });
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

// The OS-owner independent review receipt matching a captured report — F07
// v2 shape: bound to repository, PR number, the exact base SHA, the policy
// snapshot the approval was granted under, an explicit Dot GO, and the
// immutable published source of the review evidence.
const ownerReviewReceipt = (report, overrides = {}) => ({
  version: 2,
  execution_id: report.execution_id,
  session_id: report.session_id,
  solution_sha256: report.solution_sha256,
  artifact_sha256: report.artifact_sha256,
  source_tree_digest: report.source_tree_digest,
  head_sha: report.head_sha,
  repository: 'artyhoo/getff',
  pr_number: Number((report.pr_url.match(/pull\/(\d+)$/) ?? [null, 9001])[1]),
  base_sha: BASE_SHA,
  policy: { version: POLICY.version, digest: POLICY.digest },
  dot_go: true,
  source: { reference: `dot://reviews/${report.execution_id}`, sha256: report.artifact_sha256 },
  reviewer: 'dot-relay-os-owner',
  verdict: 'APPROVE',
  ...overrides,
});

// The pre-F07 v1 shape — kept to witness that the legacy world (arbitrary
// reviewer string, no context binding) can never import anymore.
const legacyV1Receipt = (report, overrides = {}) => ({
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

// F07: a captured execution awaiting review WITHOUT spawning a child — the
// ledger state a supervisor capture leaves behind, built directly.
function f07Fixture({ tag = 'a', prUrl = 'https://github.com/artyhoo/getff/pull/9301' } = {}) {
  const { dir, ledger } = env0();
  const sessionId = `f07-${tag}-sess-0001-aaaa`;
  const solution = queuedSolution(ledger, dir);
  const claim = ledger.claimExecution({ solutionId: solution.id, sessionId });
  const report = codeCompleteReport({
    executionId: claim.execution_id, sessionId, solution,
    artifactSha256: sha256Of(`f07-${tag}-art`), prUrl,
  });
  ledger.updateExecution(claim.execution_id, { state: 'REQUIRES_REVIEW', reason: 'fixture: captured' });
  ledger.persistWorkerReport({ executionId: claim.execution_id, report });
  return { dir, ledger, executionId: claim.execution_id, report, prUrl };
}

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
  mkdirSync(join(dir, 'objects'), { recursive: true });
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
  const solution = queuedSolution(ledger, dir);
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
  const solution = queuedSolution(ledger, dir);
  const spawnImpl = () => { throw Object.assign(new Error('spawn glm ENOENT'), { code: 'ENOENT' }); };
  const r = await runExecution({ ledger, solution, worktree: dir, dir, spawnImpl, clock: fakeClock(), gitImpl: gitOk(), pollIntervalMs: 5 });
  assert.equal(r.state, 'BLOCKED');
  assert.equal(r.blocker, 'BLOCKED_LAUNCH');
  assert.equal(ledger.status().execution, null); // BLOCKED is not an active state — slot freed
  rmSync(dir, { recursive: true, force: true });
});

test('permission refusal checkpoints BLOCKED_PERMISSION, never broadens allowlist', async () => {
  const { dir, ledger } = env0();
  const solution = queuedSolution(ledger, dir);
  const spawnImpl = () => { throw Object.assign(new Error('denied'), { code: 'EACCES' }); };
  const r = await runExecution({ ledger, solution, worktree: dir, dir, spawnImpl, clock: fakeClock(), gitImpl: gitOk(), pollIntervalMs: 5 });
  assert.equal(r.state, 'BLOCKED');
  assert.equal(r.blocker, 'BLOCKED_PERMISSION');
  rmSync(dir, { recursive: true, force: true });
});

test('uncertain spawn failure holds the slot as UNCERTAIN (crash before proven outcome)', async () => {
  const { dir, ledger } = env0();
  const solution = queuedSolution(ledger, dir);
  const spawnImpl = () => { throw Object.assign(new Error('EAGAIN'), { code: 'EAGAIN' }); };
  const r = await runExecution({ ledger, solution, worktree: dir, dir, spawnImpl, clock: fakeClock(), gitImpl: gitOk(), pollIntervalMs: 5 });
  assert.equal(r.state, 'UNCERTAIN');
  assert.equal(ledger.status().execution.state, 'UNCERTAIN'); // slot held, no TTL release
  rmSync(dir, { recursive: true, force: true });
});

test('stale base (origin/staging drift) never launches: BLOCKED_STALE_BASE', async () => {
  const { dir, ledger } = env0();
  const solution = queuedSolution(ledger, dir);
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
  const solution = queuedSolution(ledger, dir);
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
  const solution = queuedSolution(ledger, dir);
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
  const solution = queuedSolution(ledger, dir);
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
  const solution = queuedSolution(ledger, dir);
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
  const solution = queuedSolution(ledger, dir);
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
  const solution = queuedSolution(ledger, dir);
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
  const solution = queuedSolution(ledger, dir);
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
  const solution = queuedSolution(ledger, dir);
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
  const solution = queuedSolution(ledger, dir);
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
  return { headRefOid: HEAD, baseRefOid: BASE_SHA, baseRefName: 'staging', state: 'OPEN', isDraft: false, mergeStateStatus: 'CLEAN', autoMergeRequest: null, ...over };
}

function ghWith({ view = viewJson(), checks = [{ name: 'ci', state: 'SUCCESS', bucket: 'pass', workflow: 'CI', link: 'l' }] } = {}) {
  const calls = [];
  return {
    calls,
    view: (args) => { calls.push(['view', args]); return view; },
    checks: (args) => { calls.push(['checks', args]); return checks; },
  };
}

test('verifyPr: exact stable head + nonempty required all pass -> DONE', async () => {
  const gh = ghWith();
  const r = await verifyPr({ url: 'u', headSha: HEAD, baseSha: BASE_SHA, policy: POLICY, ghImpl: gh, clock: fakeClock(), pollIntervalMs: 5, deadlineMs: 1_000 });
  assert.equal(r.state, 'DONE');
  assert.ok(gh.calls.every(([, a]) => Array.isArray(a)));
});

test('verifyPr: empty required checks -> BLOCKED_CHECK_POLICY, not green', async () => {
  const gh = ghWith({ checks: [] });
  const r = await verifyPr({ url: 'u', headSha: HEAD, policy: POLICY, ghImpl: gh, clock: fakeClock(), pollIntervalMs: 5, deadlineMs: 200 });
  assert.equal(r.state, 'BLOCKED');
  assert.equal(r.blocker, 'BLOCKED_CHECK_POLICY');
});

test('verifyPr: failing required check -> BLOCKED_CI with names', async () => {
  const gh = ghWith({ checks: [{ name: 'ci', state: 'FAILURE', bucket: 'fail', workflow: 'CI', link: 'l' }] });
  const r = await verifyPr({ url: 'u', headSha: HEAD, policy: POLICY, ghImpl: gh, clock: fakeClock(), pollIntervalMs: 5, deadlineMs: 200 });
  assert.equal(r.state, 'BLOCKED');
  assert.equal(r.blocker, 'BLOCKED_CI');
  assert.deepEqual(r.failing, ['ci']);
});

test('verifyPr: stale head (moves between views) -> not DONE', async () => {
  let n = 0;
  const gh = {
    view: () => { n += 1; return viewJson({ headRefOid: n <= 1 ? HEAD : sha40('moved') }); },
    checks: () => [{ name: 'ci', state: 'SUCCESS', bucket: 'pass', workflow: 'CI', link: 'l' }],
  };
  const r = await verifyPr({ url: 'u', headSha: HEAD, policy: POLICY, ghImpl: gh, clock: fakeClock(), pollIntervalMs: 5, deadlineMs: 200 });
  assert.equal(r.state, 'BLOCKED');
  assert.equal(r.blocker, 'BLOCKED_HEAD_MOVED');
});

test('verifyPr: wrong head from the start -> BLOCKED_HEAD_MISMATCH', async () => {
  const gh = ghWith({ view: viewJson({ headRefOid: sha40('other') }) });
  const r = await verifyPr({ url: 'u', headSha: HEAD, policy: POLICY, ghImpl: gh, clock: fakeClock(), pollIntervalMs: 5, deadlineMs: 200 });
  assert.equal(r.blocker, 'BLOCKED_HEAD_MISMATCH');
});

test('verifyPr: pending then pass within the ACTIVE budget -> polls to DONE', async () => {
  let pending = true;
  const gh = {
    view: () => viewJson(),
    checks: () => (pending ? [{ name: 'ci', state: 'PENDING', bucket: 'pending', workflow: 'CI', link: 'l' }] : [{ name: 'ci', state: 'SUCCESS', bucket: 'pass', workflow: 'CI', link: 'l' }]),
  };
  setTimeout(() => { pending = false; }, 30);
  const r = await verifyPr({ url: 'u', headSha: HEAD, policy: POLICY, ghImpl: gh, clock: fakeClock(), pollIntervalMs: 10, deadlineMs: 2_000 });
  assert.equal(r.state, 'DONE');
});

test('verifyPr: pending past the ACTIVE budget -> BLOCKED_CI with pending names', async () => {
  const gh = ghWith({ checks: [{ name: 'ci', state: 'PENDING', bucket: 'pending', workflow: 'CI', link: 'l' }] });
  const r = await verifyPr({ url: 'u', headSha: HEAD, policy: POLICY, ghImpl: gh, clock: fakeClock({ advancePerReadMs: 10 }), pollIntervalMs: 5, deadlineMs: 60 });
  assert.equal(r.state, 'BLOCKED');
  assert.equal(r.blocker, 'BLOCKED_CI');
  assert.deepEqual(r.failing, ['ci']);
});

for (const [name, over] of [
  ['conflicting', { mergeStateStatus: 'CONFLICTING' }],
  ['unknown mergeability (F07)', { mergeStateStatus: 'UNKNOWN' }],
  ['draft', { isDraft: true }],
  ['automerge armed', { autoMergeRequest: { mergeMethod: 'SQUASH' } }],
  ['wrong base', { baseRefName: 'main' }],
  ['closed', { state: 'CLOSED' }],
]) {
  test(`verifyPr: ${name} PR can never reach DONE`, async () => {
    const gh = ghWith({ view: viewJson(over) });
    const r = await verifyPr({ url: 'u', headSha: HEAD, policy: POLICY, ghImpl: gh, clock: fakeClock(), pollIntervalMs: 5, deadlineMs: 200 });
    assert.equal(r.state, 'BLOCKED');
    assert.equal(r.blocker, 'BLOCKED_PR_STATE');
  });
}

test('verifyPr: no clock -> [INVALID] — wall time never bounds CI polling', async () => {
  await assert.rejects(
    () => verifyPr({ url: 'u', headSha: HEAD, policy: POLICY, ghImpl: ghWith(), pollIntervalMs: 5, deadlineMs: 200 }),
    /clock required/,
  );
});

test('verifyPr: clock breaking mid-poll -> CLOCK_UNPROVEN, not a wall deadline BLOCKED_CI', async () => {
  const clock = fakeClock(); // active time frozen: only death ends this
  const gh = ghWith({ checks: [{ name: 'ci', state: 'PENDING', bucket: 'pending', workflow: 'CI', link: 'l' }] });
  setTimeout(() => { clock.breakClock(); }, 30);
  const r = await verifyPr({ url: 'u', headSha: HEAD, policy: POLICY, ghImpl: gh, clock, pollIntervalMs: 5, deadlineMs: 200 });
  assert.equal(r.state, 'BLOCKED');
  assert.equal(r.blocker, 'CLOCK_UNPROVEN');
});

test('verifyPr: freshness failing mid-poll -> CLOCK_UNPROVEN (R08)', async () => {
  const clock = fakeClock({ advancePerReadMs: 1 }); // budget would exhaust at ~500 reads
  const gh = ghWith({ checks: [{ name: 'ci', state: 'PENDING', bucket: 'pending', workflow: 'CI', link: 'l' }] });
  setTimeout(() => { if (typeof clock.breakFreshness === 'function') clock.breakFreshness(); }, 30);
  const r = await verifyPr({ url: 'u', headSha: HEAD, policy: POLICY, ghImpl: gh, clock, pollIntervalMs: 2, deadlineMs: 500 });
  assert.equal(r.state, 'BLOCKED');
  assert.equal(r.blocker, 'CLOCK_UNPROVEN'); // never the wall-deadline BLOCKED_CI
});

// ------------------------------------------------------- F07: verification context
//
// The approval is bound to the FULL verification context: the exact base SHA,
// the deployed required-check policy (each context matched by name AND
// workflow/app identity, as an exact set), mergeability, and stability of
// ALL of it across the two verification reads. Every test below hands the
// OLD code an input it can observe (it ignores baseSha/policy params) and
// asserts the refusal the old code never made.

test('verifyPr F07: base moved between receipt and PR view -> BLOCKED_BASE_MISMATCH', async () => {
  const gh = ghWith({ view: viewJson({ baseRefOid: sha40('rebased-base') }) });
  const r = await verifyPr({ url: 'u', headSha: HEAD, baseSha: BASE_SHA, policy: POLICY, ghImpl: gh, clock: fakeClock(), pollIntervalMs: 5, deadlineMs: 200 });
  assert.equal(r.state, 'BLOCKED');
  assert.equal(r.blocker, 'BLOCKED_BASE_MISMATCH');
});

test('verifyPr F07: base ref moves between the two verification reads -> BLOCKED_CONTEXT_MOVED', async () => {
  let n = 0;
  const gh = {
    view: () => { n += 1; return viewJson({ baseRefOid: n <= 1 ? BASE_SHA : sha40('rebased-mid-verify') }); },
    checks: () => [{ name: 'ci', state: 'SUCCESS', bucket: 'pass', workflow: 'CI', link: 'l' }],
  };
  const r = await verifyPr({ url: 'u', headSha: HEAD, baseSha: BASE_SHA, policy: POLICY, ghImpl: gh, clock: fakeClock(), pollIntervalMs: 5, deadlineMs: 200 });
  assert.equal(r.state, 'BLOCKED');
  assert.equal(r.blocker, 'BLOCKED_CONTEXT_MOVED');
});

test('verifyPr F07: mergeability changes between the two reads -> BLOCKED_CONTEXT_MOVED', async () => {
  let n = 0;
  const gh = {
    view: () => { n += 1; return viewJson({ mergeStateStatus: n <= 1 ? 'CLEAN' : 'DIRTY' }); },
    checks: () => [{ name: 'ci', state: 'SUCCESS', bucket: 'pass', workflow: 'CI', link: 'l' }],
  };
  const r = await verifyPr({ url: 'u', headSha: HEAD, baseSha: BASE_SHA, policy: POLICY, ghImpl: gh, clock: fakeClock(), pollIntervalMs: 5, deadlineMs: 200 });
  assert.equal(r.state, 'BLOCKED');
  assert.equal(r.blocker, 'BLOCKED_CONTEXT_MOVED');
});

test('verifyPr F07: required-check set drifts on the second read -> BLOCKED_CONTEXT_MOVED', async () => {
  let n = 0;
  const gh = {
    view: () => viewJson(),
    checks: () => {
      n += 1;
      return n <= 1
        ? [{ name: 'ci', state: 'SUCCESS', bucket: 'pass', workflow: 'CI', link: 'l' }]
        : [{ name: 'ci', state: 'SUCCESS', bucket: 'pass', workflow: 'CI', link: 'l' }, { name: 'ci-2', state: 'SUCCESS', bucket: 'pass', workflow: 'CI', link: 'l' }];
    },
  };
  const r = await verifyPr({ url: 'u', headSha: HEAD, baseSha: BASE_SHA, policy: POLICY, ghImpl: gh, clock: fakeClock(), pollIntervalMs: 5, deadlineMs: 200 });
  assert.equal(r.state, 'BLOCKED');
  assert.equal(r.blocker, 'BLOCKED_CONTEXT_MOVED');
});

test('verifyPr F07: a green same-name check from the WRONG app identity -> BLOCKED_CHECK_POLICY', async () => {
  const gh = ghWith({ checks: [{ name: 'ci', state: 'SUCCESS', bucket: 'pass', workflow: 'Foreign-App', link: 'l' }] });
  const r = await verifyPr({ url: 'u', headSha: HEAD, baseSha: BASE_SHA, policy: POLICY, ghImpl: gh, clock: fakeClock(), pollIntervalMs: 5, deadlineMs: 200 });
  assert.equal(r.state, 'BLOCKED');
  assert.equal(r.blocker, 'BLOCKED_CHECK_POLICY');
});

test('verifyPr F07: a deployed required check MISSING from the policy set -> BLOCKED_CHECK_POLICY', async () => {
  const gh = ghWith({ checks: [
    { name: 'ci', state: 'SUCCESS', bucket: 'pass', workflow: 'CI', link: 'l' },
    { name: 'ci-extra', state: 'SUCCESS', bucket: 'pass', workflow: 'CI', link: 'l' },
  ] });
  const r = await verifyPr({ url: 'u', headSha: HEAD, baseSha: BASE_SHA, policy: POLICY, ghImpl: gh, clock: fakeClock(), pollIntervalMs: 5, deadlineMs: 200 });
  assert.equal(r.state, 'BLOCKED');
  assert.equal(r.blocker, 'BLOCKED_CHECK_POLICY');
});

test('verifyPr F07: no deployed policy at all -> BLOCKED_CHECK_POLICY (unknown policy never verifies)', async () => {
  const gh = ghWith();
  const r = await verifyPr({ url: 'u', headSha: HEAD, baseSha: BASE_SHA, ghImpl: gh, clock: fakeClock(), pollIntervalMs: 5, deadlineMs: 200 });
  assert.equal(r.state, 'BLOCKED');
  assert.equal(r.blocker, 'BLOCKED_CHECK_POLICY');
});

// ---------------------------------------------------------------- supervise mode
// tick (process A) reserves the execution; a detached supervise child (process B)
// drives it. The supervise path MUST reuse the tick-reserved row and its session id.

test('supervise mode reuses the tick-reserved execution row and its persisted session id', async () => {
  const { dir, ledger } = env0();
  const solution = queuedSolution(ledger, dir);
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
  const solution = queuedSolution(ledger, dir);
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
  const solution = queuedSolution(ledger, dir);
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
  const solution = queuedSolution(ledger, dir);
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
  const solution = queuedSolution(ledger, dir);
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
  const solution = queuedSolution(ledger, dir);
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
  const solution = queuedSolution(ledger, dir);
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
function interruptedExecution(ledger, { dir, sessionId = 'resume-sess-0001-aaaa', prUrl = null, cpSessionId = sessionId, serialize } = {}) {
  const solution = queuedSolution(ledger, dir, { serialize });
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
  const packet = writePacketFiles(dir, claim.execution_id, solution, serialize);
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
    checks: (args) => { calls.push(['checks', args]); return [{ name: 'ci', state: 'SUCCESS', bucket: 'pass', workflow: 'CI', link: 'l' }]; },
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
  })))));
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
  const solution = queuedSolution(ledger, dir);
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
  })))));
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
  const solution = queuedSolution(ledger, dir);
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
    const solution = queuedSolution(ledger, dir);
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
    const solution = queuedSolution(ledger, dir);
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
    const solution = queuedSolution(ledger, dir);
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

// ------------------------------------------- R10: strict CODE_COMPLETE capture + review gate
//
// repair-code-review.json R10: the outer --output-format json result is a
// STRING containing exactly one strict CODE_COMPLETE JSON object (<=16384
// UTF-8 bytes, exact key set, exact runtime identities). Object
// compatibility, prose, fences, substrings, identity mismatches and nonzero
// exits are BLOCKED_CAPTURE — never DONE. Every capture path (run/resume/
// adopt) persists the worker report + REQUIRES_REVIEW slot-owning state and
// NEVER verifies the PR; only an OS-owner imported independent review
// receipt (reviewer != worker session, matching source/head/digests)
// advances to VERIFYING/DONE.

const ghNever = () => ({
  view: () => { throw new Error('gh must not be consulted in the capture path'); },
  checks: () => { throw new Error('gh must not be consulted in the capture path'); },
});

const PR_R10 = 'https://github.com/artyhoo/getff/pull/9001';

async function runCaptureReject({ name, buildOuter, exitCode = 0 }) {
  const { dir, ledger } = env0();
  const solution = queuedSolution(ledger, dir);
  const manifest = ledger.getManifest(solution.id);
  const child = fakeChild();
  const jobBranch = `codex/dot-job-${solution.sha256.slice(0, 12)}`;
  const r = runExecution({
    ledger, solution, worktree: dir, dir,
    spawnImpl: captureSpawn(child), gitImpl: gitOk({ head: BASE_SHA, branch: jobBranch }), ghImpl: ghNever(),
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
  writeFileSync(child.opts.stdoutPath, JSON.stringify(buildOuter({
    sessionId: child.opts.env.DOT_RELAY_SESSION_ID,
    executionId: child.opts.env.DOT_RELAY_EXECUTION_ID,
    solution,
    artifactSha256: manifest.artifact_sha256,
  })));
  child.exit(exitCode);
  const out = await r;
  assert.equal(out.state, 'BLOCKED', name);
  assert.equal(out.blocker, 'BLOCKED_CAPTURE', name);
  assert.equal(ledger.getExecution(out.execution_id).state, 'BLOCKED', `${name}: slot terminal`);
  assert.ok(!ledger.getWorkerReport(out.execution_id), `${name}: no worker report persists for a rejected capture`);
  rmSync(dir, { recursive: true, force: true });
}

for (const [name, mutate] of [
  ['bare object result (legacy fake shape)', ({ outer, report }) => ({ ...outer, result: report })],
  ['prose result string', ({ outer }) => ({ ...outer, result: 'The work is complete and the PR is open.' })],
  ['fenced result string', ({ outer, report }) => ({ ...outer, result: `\`\`\`json\n${JSON.stringify(report)}\n\`\`\`` })],
  ['prose-wrapped JSON substring', ({ outer, report }) => ({ ...outer, result: `Done! ${JSON.stringify(report)} — trust me` })],
  ['oversize report >16384 UTF-8 bytes', ({ outer, report }) => ({ ...outer, result: JSON.stringify({ ...report, independent_review_ref: 'x'.repeat(17_000) }) })],
  ['wrong execution_id inside the report', ({ outer, report }) => ({ ...outer, result: JSON.stringify({ ...report, execution_id: 'DOT-EXEC-FORGED' }) })],
  ['wrong session_id inside the report', ({ outer, report }) => ({ ...outer, result: JSON.stringify({ ...report, session_id: 'not-the-session' }) })],
  ['wrong solution_sha256', ({ outer, report }) => ({ ...outer, result: JSON.stringify({ ...report, solution_sha256: '0'.repeat(64) }) })],
  ['wrong artifact_sha256', ({ outer, report }) => ({ ...outer, result: JSON.stringify({ ...report, artifact_sha256: '0'.repeat(64) }) })],
  ['non-hex64 source_tree_digest', ({ outer, report }) => ({ ...outer, result: JSON.stringify({ ...report, source_tree_digest: 'not-hex-at-all' }) })],
  ['wrong PR host', ({ outer, report }) => ({ ...outer, result: JSON.stringify({ ...report, pr_url: 'https://gitlab.com/artyhoo/getff/pull/1' }) })],
  ['39-hex head_sha', ({ outer, report }) => ({ ...outer, result: JSON.stringify({ ...report, head_sha: 'a'.repeat(39) }) })],
  ['missing head_sha key', ({ outer, report }) => {
    const { head_sha: _drop, ...rest } = report;
    return { ...outer, result: JSON.stringify(rest) };
  }],
  ['extra unknown key', ({ outer, report }) => ({ ...outer, result: JSON.stringify({ ...report, unexpected: 1 }) })],
  ['version 2', ({ outer, report }) => ({ ...outer, result: JSON.stringify({ ...report, version: 2 }) })],
  ['status DONE instead of CODE_COMPLETE', ({ outer, report }) => ({ ...outer, result: JSON.stringify({ ...report, status: 'DONE' }) })],
  ['outer is_error true', ({ outer }) => ({ ...outer, is_error: true })],
  ['outer model not the pinned glm-5.3', ({ outer, report }) => ({ session_id: outer.session_id, modelUsage: {}, is_error: false, result: JSON.stringify(report) })],
]) {
  test(`R10 reject: ${name} -> BLOCKED_CAPTURE, terminal slot, no worker report`, async () => {
    await runCaptureReject({
      name,
      buildOuter: (ctx) => mutate({
        outer: outerCapture(ctx.sessionId, JSON.stringify(codeCompleteReport({ ...ctx, prUrl: PR_R10 }))),
        report: codeCompleteReport({ ...ctx, prUrl: PR_R10 }),
      }),
    });
  });
}

test('R10 reject: nonzero child exit -> BLOCKED_CAPTURE even with an otherwise valid report', async () => {
  await runCaptureReject({
    name: 'child exit code 1',
    exitCode: 1,
    buildOuter: (ctx) => outerCapture(ctx.sessionId, JSON.stringify(codeCompleteReport({ ...ctx, prUrl: PR_R10 }))),
  });
});

test('R10 review gate: REQUIRES_REVIEW survives ledger restart, holds the slot; only a matching OS-owner receipt unlocks DONE', async () => {
  const { dir, ledger } = env0();
  const solution = queuedSolution(ledger, dir);
  const manifest = ledger.getManifest(solution.id);
  const child = fakeChild();
  const jobBranch = `codex/dot-job-${solution.sha256.slice(0, 12)}`;
  const PR = 'https://github.com/artyhoo/getff/pull/9101';
  const ghCalls = [];
  const r = runExecution({
    ledger, solution, worktree: dir, dir,
    spawnImpl: captureSpawn(child), gitImpl: gitOk({ head: BASE_SHA, branch: jobBranch }), ghImpl: ghDone(ghCalls),
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
  const sessionId = child.opts.env.DOT_RELAY_SESSION_ID;
  const executionId = child.opts.env.DOT_RELAY_EXECUTION_ID;
  const report = codeCompleteReport({ executionId, sessionId, solution, artifactSha256: manifest.artifact_sha256, prUrl: PR });
  writeFileSync(child.opts.stdoutPath, JSON.stringify(outerCapture(sessionId, JSON.stringify(report))));
  child.exit(0);
  const out = await r;
  assert.equal(out.state, 'REQUIRES_REVIEW');
  ledger.close();
  // restart: a SECOND DB connection must still see the slot occupied
  const ledger2 = openLedger(join(dir, 'ledger.sqlite'), { now });
  try {
    assert.equal(ledger2.status().execution.state, 'REQUIRES_REVIEW');
    // the held slot refuses admission of a NEW queued solution
    const solution2 = queuedSolution(ledger2, dir);
    const claim2 = ledger2.claimExecution({ solutionId: solution2.id, sessionId: 'gate-sess-0001-aaaa' });
    assert.equal(claim2.claimed, false, 'REQUIRES_REVIEW holds the global execution slot');
    const { applyReviewAndVerify } = await import('./executor.mjs');
    assert.equal(typeof applyReviewAndVerify, 'function', 'R10: applyReviewAndVerify is exported');
    const clock = fakeClock();
    // self-review: the receipt reviewer IS the worker session — the trusted
    // importer refuses attribution long before the ledger gate (the ledger's
    // own REVIEWER_NOT_INDEPENDENT check stays pinned in the ledger suite)
    const self = await applyReviewAndVerify({ ledger: ledger2, executionId, receipt: ownerReviewReceipt(report, { reviewer: sessionId }), provenance: dotProvenance(), policy: POLICY, ghImpl: ghDone(ghCalls), clock, pollIntervalMs: 5, deadlineMs: 1_000 });
    assert.equal(self.state, 'HELD');
    assert.equal(self.blocker, 'BLOCKED_DOT_APPROVAL_PROVENANCE');
    assert.equal(ledger2.getExecution(executionId).state, 'REQUIRES_REVIEW');
    // wrong tree: valid-hex64 but different source_tree_digest
    const wrongTree = await applyReviewAndVerify({ ledger: ledger2, executionId, receipt: ownerReviewReceipt(report, { source_tree_digest: sha256Of('a-different-source-tree') }), provenance: dotProvenance(), policy: POLICY, ghImpl: ghDone(ghCalls), clock, pollIntervalMs: 5, deadlineMs: 1_000 });
    assert.equal(wrongTree.state, 'HELD');
    assert.equal(wrongTree.blocker, 'RECEIPT_MISMATCH');
    assert.equal(ledger2.getExecution(executionId).state, 'REQUIRES_REVIEW');
    assert.ok(!ledger2.getReviewReceipt(executionId), 'a rejected receipt never persists');
    // legit OS-owner receipt: VERIFYING -> verifyPr -> DONE
    const done = await applyReviewAndVerify({ ledger: ledger2, executionId, receipt: ownerReviewReceipt(report), provenance: dotProvenance(), policy: POLICY, ghImpl: ghDone(ghCalls), clock, pollIntervalMs: 5, deadlineMs: 1_000 });
    assert.equal(done.state, 'DONE');
    assert.equal(done.pr_url, PR);
    assert.equal(done.verified_now, true);
    assert.equal(ledger2.getExecution(executionId).state, 'DONE');
    assert.equal(ledger2.getAttempt(executionId, 1).state, 'DONE');
    assert.ok(ledger2.getReviewReceipt(executionId), 'applied receipt is durable');
    // idempotent replay of the SAME receipt bytes: the HISTORICAL outcome is
    // returned, but it is never a fresh approval (verified_now false) and CI
    // is not re-polled (the view count does not move)
    const viewsBeforeReplay = ghCalls.filter((c) => c[0] === 'view').length;
    const replay = await applyReviewAndVerify({ ledger: ledger2, executionId, receipt: ownerReviewReceipt(report), provenance: dotProvenance(), policy: POLICY, ghImpl: ghDone(ghCalls), clock, pollIntervalMs: 5, deadlineMs: 1_000 });
    assert.equal(replay.state, 'DONE');
    assert.equal(replay.replay, true);
    assert.equal(replay.verified_now, false);
    assert.equal(ghCalls.filter((c) => c[0] === 'view').length, viewsBeforeReplay, 'a replay never re-verifies CI');
    // a DIFFERENT receipt after an applied one is immutable-held, state untouched
    const forged = await applyReviewAndVerify({ ledger: ledger2, executionId, receipt: ownerReviewReceipt(report, { source: { reference: 'dot://reviews/forged-attempt', sha256: report.artifact_sha256 } }), provenance: dotProvenance(), policy: POLICY, ghImpl: ghDone(ghCalls), clock, pollIntervalMs: 5, deadlineMs: 1_000 });
    assert.equal(forged.state, 'HELD');
    assert.equal(forged.blocker, 'RECEIPT_IMMUTABLE');
    assert.equal(ledger2.getExecution(executionId).state, 'DONE');
  } finally {
    ledger2.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('R10 review gate: a missing worker report holds (REVIEW_REPORT_MISSING), never invents approval', async () => {
  const { dir, ledger } = env0();
  const solution = queuedSolution(ledger, dir);
  const claim = ledger.claimExecution({ solutionId: solution.id, sessionId: 'gate-sess-0002-bbbb' });
  ledger.updateExecution(claim.execution_id, { state: 'REQUIRES_REVIEW', reason: 'fixture: report lost' });
  const { applyReviewAndVerify } = await import('./executor.mjs');
  const out = await applyReviewAndVerify({
    ledger, executionId: claim.execution_id,
    receipt: ownerReviewReceipt(codeCompleteReport({ executionId: claim.execution_id, sessionId: 'gate-sess-0002-bbbb', solution, artifactSha256: '0'.repeat(64), prUrl: PR_R10 })),
    provenance: dotProvenance(), policy: POLICY,
    ghImpl: ghNever(), clock: fakeClock(), pollIntervalMs: 5, deadlineMs: 200,
  });
  assert.equal(out.state, 'HELD');
  assert.equal(out.blocker, 'REVIEW_REPORT_MISSING');
  assert.equal(ledger.getExecution(claim.execution_id).state, 'REQUIRES_REVIEW');
  rmSync(dir, { recursive: true, force: true });
});

// --------------------------------------------------- F07: approval context + importer
//
// APPROVAL_CONTEXT_UNBOUND: the review gate must fail closed without a
// trusted Dot importer, bind the receipt to the full verification context,
// and separate historical completion from current eligibility. The v1-world
// tests below hand the OLD code inputs it fully accepts and assert the
// refusals it never made (its RED is the defect itself); the v2 tests carry
// the new binding fields (their old-code RED is the v1 ledger schema
// refusing what it cannot express — recorded as such in the status file).

test('F07: no trusted Dot importer -> BLOCKED_DOT_APPROVAL_PROVENANCE, execution untouched, no receipt row, no gh call', async () => {
  const { dir, ledger, executionId, report } = f07Fixture({ tag: 'np' });
  const { applyReviewAndVerify } = await import('./executor.mjs');
  const out = await applyReviewAndVerify({
    ledger, executionId, receipt: legacyV1Receipt(report),
    ghImpl: ghNever(), clock: fakeClock(), pollIntervalMs: 5, deadlineMs: 200,
  });
  assert.equal(out.state, 'HELD');
  assert.equal(out.blocker, 'BLOCKED_DOT_APPROVAL_PROVENANCE');
  assert.equal(ledger.getExecution(executionId).state, 'REQUIRES_REVIEW');
  assert.ok(!ledger.getReviewReceipt(executionId), 'nothing imports without the trusted importer');
  ledger.close();
  rmSync(dir, { recursive: true, force: true });
});

test('F07: an importer that refuses attribution holds BLOCKED_DOT_APPROVAL_PROVENANCE', async () => {
  const { dir, ledger, executionId, report } = f07Fixture({ tag: 'nr' });
  const { applyReviewAndVerify } = await import('./executor.mjs');
  const refusingImporter = { verifyReceipt: () => ({ ok: false, reason: 'evidence-not-found' }) };
  const out = await applyReviewAndVerify({
    ledger, executionId, receipt: legacyV1Receipt(report), provenance: refusingImporter, policy: POLICY,
    ghImpl: ghNever(), clock: fakeClock(), pollIntervalMs: 5, deadlineMs: 200,
  });
  assert.equal(out.state, 'HELD');
  assert.equal(out.blocker, 'BLOCKED_DOT_APPROVAL_PROVENANCE');
  assert.equal(ledger.getExecution(executionId).state, 'REQUIRES_REVIEW');
  assert.ok(!ledger.getReviewReceipt(executionId));
  ledger.close();
  rmSync(dir, { recursive: true, force: true });
});

test('F07: an importer that THROWS is a refusal, never a crash or a pass', async () => {
  const { dir, ledger, executionId, report } = f07Fixture({ tag: 'nt' });
  const { applyReviewAndVerify } = await import('./executor.mjs');
  const throwingImporter = { verifyReceipt: () => { throw new Error('importer backend down'); } };
  const out = await applyReviewAndVerify({
    ledger, executionId, receipt: ownerReviewReceipt(report), provenance: throwingImporter, policy: POLICY,
    ghImpl: ghNever(), clock: fakeClock(), pollIntervalMs: 5, deadlineMs: 200,
  });
  assert.equal(out.state, 'HELD');
  assert.equal(out.blocker, 'BLOCKED_DOT_APPROVAL_PROVENANCE');
  assert.equal(ledger.getExecution(executionId).state, 'REQUIRES_REVIEW');
  ledger.close();
  rmSync(dir, { recursive: true, force: true });
});

test('F07: no deployed review policy -> BLOCKED_CHECK_POLICY, nothing imported', async () => {
  const { dir, ledger, executionId, report } = f07Fixture({ tag: 'mp' });
  const { applyReviewAndVerify } = await import('./executor.mjs');
  const out = await applyReviewAndVerify({
    ledger, executionId, receipt: legacyV1Receipt(report), provenance: permissiveProvenance(),
    ghImpl: ghNever(), clock: fakeClock(), pollIntervalMs: 5, deadlineMs: 200,
  });
  assert.equal(out.state, 'HELD');
  assert.equal(out.blocker, 'BLOCKED_CHECK_POLICY');
  assert.equal(ledger.getExecution(executionId).state, 'REQUIRES_REVIEW');
  assert.ok(!ledger.getReviewReceipt(executionId));
  ledger.close();
  rmSync(dir, { recursive: true, force: true });
});

test('F07: the legacy v1 world (hostile verification context, full provenance/policy) can never reach DONE', async () => {
  const { dir, ledger, executionId, report } = f07Fixture({ tag: 'lw' });
  const { applyReviewAndVerify } = await import('./executor.mjs');
  // the old code verified THIS exact world as DONE: base rebased mid-verify
  // and a green same-name check from a foreign app
  let n = 0;
  const hostileGh = {
    view: () => { n += 1; return viewJson({ baseRefOid: n <= 1 ? BASE_SHA : sha40('rebased-under-review') }); },
    checks: () => [{ name: 'ci', state: 'SUCCESS', bucket: 'pass', workflow: 'Foreign-App', link: 'l' }],
  };
  const out = await applyReviewAndVerify({
    ledger, executionId, receipt: legacyV1Receipt(report), provenance: permissiveProvenance(), policy: POLICY,
    ghImpl: hostileGh, clock: fakeClock(), pollIntervalMs: 5, deadlineMs: 200,
  });
  assert.notEqual(out.state, 'DONE');
  assert.ok(out.state === 'HELD' || out.state === 'BLOCKED');
  assert.equal(ledger.getExecution(executionId).state === 'DONE', false, 'the v1 world never grants DONE anymore');
  ledger.close();
  rmSync(dir, { recursive: true, force: true });
});

test('F07: receipt base_sha disagrees with the PR base -> BLOCKED_BASE_MISMATCH (same head is not enough)', async () => {
  const { dir, ledger, executionId, report } = f07Fixture({ tag: 'bm' });
  const { applyReviewAndVerify } = await import('./executor.mjs');
  const out = await applyReviewAndVerify({
    ledger, executionId, receipt: ownerReviewReceipt(report, { base_sha: sha40('a-different-base') }),
    provenance: dotProvenance(), policy: POLICY,
    ghImpl: ghDone([]), clock: fakeClock(), pollIntervalMs: 5, deadlineMs: 200,
  });
  assert.equal(out.state, 'BLOCKED');
  assert.equal(out.blocker, 'BLOCKED_BASE_MISMATCH');
  assert.equal(ledger.getExecution(executionId).state, 'BLOCKED');
  ledger.close();
  rmSync(dir, { recursive: true, force: true });
});

test('F07: receipt policy snapshot differs from the deployed policy -> BLOCKED_POLICY_MISMATCH', async () => {
  const { dir, ledger, executionId, report } = f07Fixture({ tag: 'pm' });
  const { applyReviewAndVerify } = await import('./executor.mjs');
  const out = await applyReviewAndVerify({
    ledger, executionId, receipt: ownerReviewReceipt(report, { policy: { version: 2, digest: sha256Of('some-other-policy') } }),
    provenance: dotProvenance(), policy: POLICY,
    ghImpl: ghNever(), clock: fakeClock(), pollIntervalMs: 5, deadlineMs: 200,
  });
  assert.equal(out.state, 'HELD');
  assert.equal(out.blocker, 'BLOCKED_POLICY_MISMATCH');
  assert.equal(ledger.getExecution(executionId).state, 'REQUIRES_REVIEW');
  assert.ok(!ledger.getReviewReceipt(executionId));
  ledger.close();
  rmSync(dir, { recursive: true, force: true });
});

test('F07: receipt bound to a different repository -> BLOCKED_RECEIPT_CONTEXT', async () => {
  const { dir, ledger, executionId, report } = f07Fixture({ tag: 'wr' });
  const { applyReviewAndVerify } = await import('./executor.mjs');
  const out = await applyReviewAndVerify({
    ledger, executionId, receipt: ownerReviewReceipt(report, { repository: 'someone/else' }),
    provenance: dotProvenance(), policy: POLICY,
    ghImpl: ghNever(), clock: fakeClock(), pollIntervalMs: 5, deadlineMs: 200,
  });
  assert.equal(out.state, 'HELD');
  assert.equal(out.blocker, 'BLOCKED_RECEIPT_CONTEXT');
  assert.equal(ledger.getExecution(executionId).state, 'REQUIRES_REVIEW');
  ledger.close();
  rmSync(dir, { recursive: true, force: true });
});

test('F07: receipt bound to a different PR number -> BLOCKED_RECEIPT_CONTEXT', async () => {
  const { dir, ledger, executionId, report } = f07Fixture({ tag: 'wp' });
  const { applyReviewAndVerify } = await import('./executor.mjs');
  const out = await applyReviewAndVerify({
    ledger, executionId, receipt: ownerReviewReceipt(report, { pr_number: 999999 }),
    provenance: dotProvenance(), policy: POLICY,
    ghImpl: ghNever(), clock: fakeClock(), pollIntervalMs: 5, deadlineMs: 200,
  });
  assert.equal(out.state, 'HELD');
  assert.equal(out.blocker, 'BLOCKED_RECEIPT_CONTEXT');
  assert.equal(ledger.getExecution(executionId).state, 'REQUIRES_REVIEW');
  ledger.close();
  rmSync(dir, { recursive: true, force: true });
});

test('F07: a draft PR imports the receipt (no green-before-review deadlock) but final eligibility blocks non-draft -> BLOCKED_PR_STATE', async () => {
  const { dir, ledger, executionId, report } = f07Fixture({ tag: 'dp' });
  const { applyReviewAndVerify } = await import('./executor.mjs');
  const draftGh = {
    view: () => viewJson({ isDraft: true }),
    checks: () => [{ name: 'ci', state: 'SUCCESS', bucket: 'pass', workflow: 'CI', link: 'l' }],
  };
  const out = await applyReviewAndVerify({
    ledger, executionId, receipt: ownerReviewReceipt(report),
    provenance: dotProvenance(), policy: POLICY,
    ghImpl: draftGh, clock: fakeClock(), pollIntervalMs: 5, deadlineMs: 200,
  });
  assert.equal(out.state, 'BLOCKED');
  assert.equal(out.blocker, 'BLOCKED_PR_STATE');
  // the review itself WAS applied (VERIFYING transition happened) — the gate
  // runs before the draft check, so an operator-requested draft review is
  // never deadlocked behind a non-draft requirement
  assert.ok(ledger.getReviewReceipt(executionId), 'the receipt imported before eligibility ran');
  assert.equal(ledger.getExecution(executionId).state, 'BLOCKED');
  ledger.close();
  rmSync(dir, { recursive: true, force: true });
});

test('F07: genuine v2 receipt + trusted importer + matched context -> DONE verified_now, durable receipt, terminal states', async () => {
  const { dir, ledger, executionId, report, prUrl } = f07Fixture({ tag: 'ok' });
  const { applyReviewAndVerify } = await import('./executor.mjs');
  const ghCalls = [];
  const out = await applyReviewAndVerify({
    ledger, executionId, receipt: ownerReviewReceipt(report),
    provenance: dotProvenance(), policy: POLICY,
    ghImpl: ghDone(ghCalls), clock: fakeClock(), pollIntervalMs: 5, deadlineMs: 1_000,
  });
  assert.equal(out.state, 'DONE');
  assert.equal(out.pr_url, prUrl);
  assert.equal(out.verified_now, true);
  assert.equal(out.replay, undefined);
  assert.equal(ledger.getExecution(executionId).state, 'DONE');
  assert.equal(ledger.getAttempt(executionId, 1).state, 'DONE');
  const stored = ledger.getReviewReceipt(executionId);
  assert.ok(stored, 'applied receipt is durable');
  assert.equal(stored.version, 2);
  assert.equal(stored.policy.digest, POLICY.digest);
  assert.equal(stored.repository, 'artyhoo/getff');
  ledger.close();
  rmSync(dir, { recursive: true, force: true });
});

// --------------------------------------------------- F12: bounded gh adapter + finite durable budget
//
// GH_PENDING_AND_BUDGET_ADAPTER: (1) real `gh pr checks` pending/failing
// results arrive on NONZERO exit codes (8 pending / 1 failing) with the
// documented JSON on stdout — execFileSync THREW on them, so the old
// production adapter crashed before any polling could happen; (2) post-review
// polling had NO finite default budget (deadlineMs null = unlimited);
// (3) infrastructure failures must hold VERIFYING with the receipt preserved
// so reconciliation can resume, never a duplicate approval. makeGhAdapter is
// imported dynamically — a static named import of a not-yet-existing export
// is a module-link error that would fail the whole file (same reason
// applyReviewAndVerify is dynamic above).

test('F12 gh adapter: documented status8 pending then status0 success parses as DATA and polls to DONE', async () => {
  const { makeGhAdapter } = await import('./executor.mjs');
  const pendingJson = JSON.stringify([{ name: 'ci', state: 'PENDING', bucket: 'pending', workflow: 'CI', link: 'l' }]);
  const passJson = JSON.stringify([{ name: 'ci', state: 'SUCCESS', bucket: 'pass', workflow: 'CI', link: 'l' }]);
  let checksCalls = 0;
  const gh = makeGhAdapter((args) => {
    if (args[0] === 'pr' && args[1] === 'view') {
      return { error: null, status: 0, stdout: JSON.stringify(viewJson()), stderr: '' };
    }
    checksCalls += 1;
    // first checks read: the REAL pending shape — exit status 8, valid JSON
    return checksCalls === 1
      ? { error: null, status: 8, stdout: pendingJson, stderr: '' }
      : { error: null, status: 0, stdout: passJson, stderr: '' };
  });
  const r = await verifyPr({ url: 'u', headSha: HEAD, baseSha: BASE_SHA, policy: POLICY, ghImpl: gh, clock: fakeClock(), pollIntervalMs: 5, deadlineMs: 2_000 });
  assert.equal(r.state, 'DONE');
  // exactly 3: the status8 pending read, the pass read, and the F07 context
  // re-read (verifyPr reads the whole verification context twice before DONE)
  assert.equal(checksCalls, 3, 'status8 pending was polled through, not thrown on');
});

test('F12 gh adapter: failing(1)/auth(4)/tool-missing/transport/malformed produce distinct fixed blockers, and no raw payload leaks', async () => {
  const { makeGhAdapter } = await import('./executor.mjs');
  const failJson = JSON.stringify([{ name: 'ci', state: 'FAILURE', bucket: 'fail', workflow: 'CI', link: 'l' }]);
  // scenarios fire on the checks endpoint (the documented pending/failing
  // surface); view always answers a valid PR view
  const goodView = { error: null, status: 0, stdout: JSON.stringify(viewJson()), stderr: '' };
  const mk = (res) => makeGhAdapter((args) => (args[1] === 'view' ? goodView : res));
  // documented exit 1 with failing JSON is DATA on checks: BLOCKED_CI with names, not an error
  const r1 = await verifyPr({ url: 'u', headSha: HEAD, baseSha: BASE_SHA, policy: POLICY, ghImpl: mk({ error: null, status: 1, stdout: failJson, stderr: '' }), clock: fakeClock(), pollIntervalMs: 5, deadlineMs: 200 });
  assert.equal(r1.state, 'BLOCKED');
  assert.equal(r1.blocker, 'BLOCKED_CI');
  assert.deepEqual(r1.failing, ['ci']);
  // the same exit 1 is UNDOCUMENTED on the view endpoint — per-endpoint documented sets, never a blanket pass
  const rView1 = await verifyPr({ url: 'u', headSha: HEAD, baseSha: BASE_SHA, policy: POLICY, ghImpl: makeGhAdapter(() => ({ error: null, status: 1, stdout: failJson, stderr: '' })), clock: fakeClock(), pollIntervalMs: 5, deadlineMs: 200 });
  assert.equal(rView1.state, 'HELD');
  assert.equal(rView1.blocker, 'GH_TRANSPORT');
  // auth (gh exit 4) / auth via stderr text — held, distinct from transport
  for (const authRes of [
    { error: null, status: 4, stdout: '', stderr: 'gh: authentication required' },
    { error: null, status: 1, stdout: '', stderr: 'gh auth login required for this endpoint' },
  ]) {
    const ra = await verifyPr({ url: 'u', headSha: HEAD, policy: POLICY, ghImpl: mk(authRes), clock: fakeClock(), pollIntervalMs: 5, deadlineMs: 200 });
    assert.equal(ra.state, 'HELD');
    assert.equal(ra.blocker, 'GH_AUTH');
  }
  // tool missing (ENOENT) / spawn timeout / undocumented exit status — distinct fixed codes
  const rTool = await verifyPr({ url: 'u', headSha: HEAD, policy: POLICY, ghImpl: mk({ error: 'ENOENT', status: null, stdout: '', stderr: '' }), clock: fakeClock(), pollIntervalMs: 5, deadlineMs: 200 });
  assert.equal(rTool.state, 'HELD');
  assert.equal(rTool.blocker, 'GH_TOOL_MISSING');
  const rTimeout = await verifyPr({ url: 'u', headSha: HEAD, policy: POLICY, ghImpl: mk({ error: 'ETIMEDOUT', status: null, stdout: '', stderr: '' }), clock: fakeClock(), pollIntervalMs: 5, deadlineMs: 200 });
  assert.equal(rTimeout.state, 'HELD');
  assert.equal(rTimeout.blocker, 'GH_TRANSPORT');
  const rUndoc = await verifyPr({ url: 'u', headSha: HEAD, policy: POLICY, ghImpl: mk({ error: null, status: 2, stdout: '', stderr: 'internal' }), clock: fakeClock(), pollIntervalMs: 5, deadlineMs: 200 });
  assert.equal(rUndoc.state, 'HELD');
  assert.equal(rUndoc.blocker, 'GH_TRANSPORT');
  // documented exit but unparseable stdout — malformed, never data
  const rBad = await verifyPr({ url: 'u', headSha: HEAD, policy: POLICY, ghImpl: mk({ error: null, status: 0, stdout: 'SUPERSECRET-not-json', stderr: '' }), clock: fakeClock(), pollIntervalMs: 5, deadlineMs: 200 });
  assert.equal(rBad.state, 'HELD');
  assert.equal(rBad.blocker, 'GH_MALFORMED');
  // the adapter's own thrown errors carry only the fixed code — stdout/stderr text never leaks
  const leaky = mk({ error: null, status: 1, stdout: 'SUPERSECRET-payload', stderr: 'SUPERSECRET-stderr' });
  assert.throws(
    () => leaky.checks(['pr', 'checks', 'u', '--json']),
    (err) => err.ghBlocker === 'GH_MALFORMED' && !err.message.includes('SUPERSECRET'),
  );
});

test('F12 verifyPr: a typed gh adapter refusal HOLDS with the fixed blocker — verifyPr never crashes on infrastructure', async () => {
  const ghThrow = {
    view: () => { const e = new Error('gh view failed'); e.ghBlocker = 'GH_TRANSPORT'; throw e; },
    checks: () => { const e = new Error('gh checks failed'); e.ghBlocker = 'GH_TRANSPORT'; throw e; },
  };
  const r = await verifyPr({ url: 'u', headSha: HEAD, policy: POLICY, ghImpl: ghThrow, clock: fakeClock(), pollIntervalMs: 5, deadlineMs: 200 });
  assert.equal(r.state, 'HELD');
  assert.equal(r.blocker, 'GH_TRANSPORT');
});

test('F12 verifyPr: pending with NO finite budget holds BLOCKED_VERIFY_BUDGET — never unlimited polling', async () => {
  let polls = 0;
  const gh = {
    view: () => viewJson(),
    checks: () => {
      polls += 1;
      if (polls > 4) throw new Error('F12-RED: polling continued with no finite budget applied');
      return [{ name: 'ci', state: 'PENDING', bucket: 'pending', workflow: 'CI', link: 'l' }];
    },
  };
  const r = await verifyPr({ url: 'u', headSha: HEAD, policy: POLICY, ghImpl: gh, clock: fakeClock(), pollIntervalMs: 5 });
  assert.equal(r.state, 'BLOCKED');
  assert.equal(r.blocker, 'BLOCKED_VERIFY_BUDGET');
  assert.ok(polls <= 4, 'the pending branch must stop at the budget gate, not loop');
});

test('F12: perpetual pending consumes the finite DURABLE budget; replay never replenishes it or resets the receipt', async () => {
  const { applyReviewAndVerify } = await import('./executor.mjs');
  const { dir, ledger, executionId, report } = f07Fixture({ tag: 'f12b' });
  const calls = [];
  let polls = 0;
  const gh = {
    view: (a) => { calls.push(['view', a]); return viewJson(); },
    checks: (a) => {
      calls.push(['checks', a]);
      // RED-phase bound: on code with NO finite budget this loop is infinite —
      // the marker throw is the witnessed defect, not a test artifact. The
      // bound is far above the handful of iterations the finite budget needs.
      polls += 1;
      if (polls > 50) throw new Error('F12-RED: no finite durable budget applied — polling ran away');
      return [{ name: 'ci', state: 'PENDING', bucket: 'pending', workflow: 'CI', link: 'l' }];
    },
  };
  // 10 min of host-awake time per clock sample: the finite budget is crossed
  // within a few poll iterations, on a clock that is fully ok/fresh
  const out = await applyReviewAndVerify({
    ledger, executionId, receipt: ownerReviewReceipt(report),
    provenance: dotProvenance(), policy: POLICY,
    ghImpl: gh, clock: fakeClock({ advancePerReadMs: 10 * 60_000 }), pollIntervalMs: 5,
  });
  assert.equal(out.state, 'BLOCKED');
  assert.equal(out.blocker, 'BLOCKED_CI');
  assert.deepEqual(out.failing, ['ci']);
  const budget = ledger.reviewVerifyBudget({ executionId });
  assert.ok(budget, 'the durable budget row exists');
  assert.ok(Number.isSafeInteger(budget.budget_ms) && budget.budget_ms > 0, 'budget is finite and explicit');
  assert.equal(budget.spent_ms, budget.budget_ms, 'consumed budget is persisted, capped at the total');
  const checksCalls = calls.filter((c) => c[0] === 'checks').length;
  assert.ok(checksCalls > 0 && checksCalls < 10, 'polling was bounded by the budget, not by the fakes');
  // replay of the SAME receipt: budget already consumed — no replenish, no
  // reset, the receipt row stays byte-identical, and the verdict cannot
  // flip to DONE while CI is still pending
  const receiptBefore = ledger.getReviewReceipt(executionId);
  const out2 = await applyReviewAndVerify({
    ledger, executionId, receipt: ownerReviewReceipt(report),
    provenance: dotProvenance(), policy: POLICY,
    ghImpl: gh, clock: fakeClock({ advancePerReadMs: 10 * 60_000 }), pollIntervalMs: 5,
  });
  assert.equal(out2.state, 'BLOCKED');
  assert.equal(out2.blocker, 'BLOCKED_CI');
  const budget2 = ledger.reviewVerifyBudget({ executionId });
  assert.equal(budget2.spent_ms, budget2.budget_ms, 'replay never replenishes the consumed budget');
  assert.equal(budget2.budget_ms, budget.budget_ms, 'the total is never reset');
  const receiptAfter = ledger.getReviewReceipt(executionId);
  assert.equal(JSON.stringify(receiptAfter), JSON.stringify(receiptBefore), 'immutable approval receipt preserved');
  ledger.close();
  rmSync(dir, { recursive: true, force: true });
});

test('F12: infrastructure failure mid-verification holds VERIFYING with the receipt preserved — a re-run resumes without a duplicate approval', async () => {
  const { applyReviewAndVerify } = await import('./executor.mjs');
  const { dir, ledger, executionId, report } = f07Fixture({ tag: 'f12i' });
  const ghInfra = {
    view: () => viewJson(),
    checks: () => { const e = new Error('network gone'); e.ghBlocker = 'GH_TRANSPORT'; throw e; },
  };
  const out = await applyReviewAndVerify({
    ledger, executionId, receipt: ownerReviewReceipt(report),
    provenance: dotProvenance(), policy: POLICY,
    ghImpl: ghInfra, clock: fakeClock(), pollIntervalMs: 5,
  });
  assert.equal(out.state, 'HELD');
  assert.equal(out.blocker, 'GH_TRANSPORT');
  assert.equal(ledger.getExecution(executionId).state, 'VERIFYING', 'infra failure holds VERIFYING — never a terminal BLOCKED');
  const receiptRow = ledger.getReviewReceipt(executionId);
  assert.ok(receiptRow, 'the imported receipt survives the infrastructure failure');
  // reconciliation re-runs the SAME receipt on a healthy adapter: resume, no
  // second import (replay), and the verification completes
  const ghCalls = [];
  const out2 = await applyReviewAndVerify({
    ledger, executionId, receipt: ownerReviewReceipt(report),
    provenance: dotProvenance(), policy: POLICY,
    ghImpl: ghDone(ghCalls), clock: fakeClock(), pollIntervalMs: 5,
  });
  assert.equal(out2.state, 'DONE');
  assert.equal(out2.verified_now, true);
  assert.equal(ledger.getExecution(executionId).state, 'DONE');
  assert.equal(JSON.stringify(ledger.getReviewReceipt(executionId)), JSON.stringify(receiptRow), 'exactly one approval, byte-identical');
  ledger.close();
  rmSync(dir, { recursive: true, force: true });
});

test('R10 resume: an object-shaped result (legacy fake) is rejected -> BLOCKED_CAPTURE, no DONE', async () => {
  const { dir, ledger } = env0();
  const PR = 'https://github.com/artyhoo/getff/pull/9201';
  const { solution, claim, jobBranch } = interruptedExecution(ledger, { dir, prUrl: PR });
  const child = fakeChild();
  const r = resumeExecution({
    ledger, solution, executionId: claim.execution_id, dir,
    spawnImpl: captureSpawn(child),
    gitImpl: gitOk({ head: BASE_SHA, branch: jobBranch, toplevel: dir }),
    ghImpl: ghNever(),
    sessionProbe: () => [],
    clock: fakeClock({ bootId: 'BOOT-2' }),
    pollIntervalMs: 5, deadlineMs: 5_000,
  });
  await sleep(10);
  writeFileSync(child.opts.stdoutPath, JSON.stringify({
    session_id: 'resume-sess-0001-aaaa',
    modelUsage: { 'glm-5.3': 1 },
    is_error: false,
    result: { status: 'CODE_COMPLETE', pr_url: PR, head_sha: HEAD },
  }));
  child.exit(0);
  const out = await r;
  assert.equal(out.state, 'BLOCKED');
  assert.equal(out.blocker, 'BLOCKED_CAPTURE');
  assert.ok(!ledger.getWorkerReport(claim.execution_id));
  rmSync(dir, { recursive: true, force: true });
});

test('R10 resume: a strict report naming a DIFFERENT PR than the checkpoint -> BLOCKED_DUPLICATE_PR', async () => {
  const { dir, ledger } = env0();
  const PR = 'https://github.com/artyhoo/getff/pull/9301';
  const { solution, claim, jobBranch, packet } = interruptedExecution(ledger, { dir, prUrl: PR });
  const child = fakeChild();
  const r = resumeExecution({
    ledger, solution, executionId: claim.execution_id, dir,
    spawnImpl: captureSpawn(child),
    gitImpl: gitOk({ head: BASE_SHA, branch: jobBranch, toplevel: dir }),
    ghImpl: ghNever(),
    sessionProbe: () => [],
    clock: fakeClock({ bootId: 'BOOT-2' }),
    pollIntervalMs: 5, deadlineMs: 5_000,
  });
  await sleep(10);
  writeFileSync(child.opts.stdoutPath, JSON.stringify(outerCapture('resume-sess-0001-aaaa', JSON.stringify(codeCompleteReport({
    executionId: claim.execution_id,
    sessionId: 'resume-sess-0001-aaaa',
    solution,
    artifactSha256: packet.artifact_sha256,
    prUrl: 'https://github.com/artyhoo/getff/pull/9302',
  })))));
  child.exit(0);
  const out = await r;
  assert.equal(out.state, 'BLOCKED');
  assert.equal(out.blocker, 'BLOCKED_DUPLICATE_PR');
  assert.ok(!ledger.getWorkerReport(claim.execution_id));
  rmSync(dir, { recursive: true, force: true });
});

test('R10 adopt: an object-shaped result is rejected -> BLOCKED_CAPTURE, slot terminal', async () => {
  const { dir, ledger } = env0();
  const { claim } = adoptedExecution(ledger, { dir });
  let alive = true;
  const r = monitorAdoptedChild({
    ledger, executionId: claim.execution_id, dir,
    processProbe: (pid) => (String(pid) === '601' && alive ? { alive: true, start: CHILD_START } : { alive: false, start: null }),
    ghImpl: ghNever(),
    clock: fakeClock({ bootId: 'BOOT-1' }),
    pollIntervalMs: 5, deadlineMs: 5_000,
  });
  await sleep(20);
  alive = false;
  writeFileSync(join(dir, 'worker', `${claim.execution_id}.stdout`), JSON.stringify({
    session_id: 'adopt-sess-0001-aaaa',
    modelUsage: { 'glm-5.3': 1 },
    is_error: false,
    result: { status: 'CODE_COMPLETE', pr_url: 'https://github.com/artyhoo/getff/pull/9202', head_sha: HEAD },
  }));
  const out = await r;
  assert.equal(out.state, 'BLOCKED');
  assert.equal(out.blocker, 'BLOCKED_CAPTURE');
  assert.equal(ledger.getExecution(claim.execution_id).state, 'BLOCKED');
  assert.ok(!ledger.getWorkerReport(claim.execution_id));
  rmSync(dir, { recursive: true, force: true });
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
  const solution = queuedSolution(ledger, dir);
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
  const solution = queuedSolution(ledger, dir);
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
  const solution = queuedSolution(ledger, dir);
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
  const solution = queuedSolution(ledger, dir);
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
  const solution = queuedSolution(ledger, dir);
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

test('R07: run mode — previous-boot stale lock is taken over (evidence retained) and the capture holds at REQUIRES_REVIEW', async () => {
  const { dir, ledger } = env0();
  const solution = queuedSolution(ledger, dir);
  const manifest = ledger.getManifest(solution.id);
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
  writeFileSync(child.opts.stdoutPath, JSON.stringify(outerCapture(
    child.opts.env.DOT_RELAY_SESSION_ID,
    JSON.stringify(codeCompleteReport({
      executionId: child.opts.env.DOT_RELAY_EXECUTION_ID,
      sessionId: child.opts.env.DOT_RELAY_SESSION_ID,
      solution,
      artifactSha256: manifest.artifact_sha256,
      prUrl: 'https://github.com/artyhoo/getff/pull/7778',
    })),
  )));
  child.exit(0);
  const out = await r;
  assert.equal(out.state, 'REQUIRES_REVIEW');
  assert.equal(calls.length, 0, 'lock takeover changes nothing about the review gate');
  assert.ok(ledger.getWorkerReport(out.execution_id), 'worker report persisted after lock takeover');
  rmSync(dir, { recursive: true, force: true });
});

test('R07: run mode — same-boot DEAD holder is taken over (holder-dead) and the run proceeds', async () => {
  const { dir, ledger } = env0();
  const solution = queuedSolution(ledger, dir);
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
  const solution = queuedSolution(ledger, dir);
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
  const solution = queuedSolution(ledger, dir);
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
  const solution = queuedSolution(ledger, dir);
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
  const solution2 = queuedSolution(ledger2, dir2);
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
  const solution = queuedSolution(ledger, dir);
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
  const solution2 = queuedSolution(ledger2, dir2);
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

test('R07: resume mode — stale previous-boot lock reconciled BEFORE admission; resumed capture holds at REQUIRES_REVIEW reusing the checkpoint PR', async () => {
  const { dir, ledger } = env0();
  const PR = 'https://github.com/artyhoo/getff/pull/9999';
  const { solution, claim, jobBranch, packet } = interruptedExecution(ledger, { dir, prUrl: PR });
  const lockPath = preexistingLock(dir, { pid: 501, start: SUP_START, boot_id: 'BOOT-1', execution_id: claim.execution_id });
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
  assert.equal(child.argv[child.argv.indexOf('--resume') + 1], 'resume-sess-0001-aaaa');
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  assert.equal(lock.boot_id, 'BOOT-2');
  assert.equal(lock.takeover.reason, 'previous-boot');
  assert.equal(lock.takeover.previous.boot_id, 'BOOT-1');
  writeFileSync(child.opts.stdoutPath, JSON.stringify(outerCapture('resume-sess-0001-aaaa', JSON.stringify(codeCompleteReport({
    executionId: claim.execution_id,
    sessionId: 'resume-sess-0001-aaaa',
    solution,
    artifactSha256: packet.artifact_sha256,
    prUrl: PR,
  })))));
  child.exit(0);
  const out = await r;
  assert.equal(out.state, 'REQUIRES_REVIEW');
  assert.equal(out.pr_url, PR);
  assert.equal(calls.length, 0, 'resume capture never verifies the PR itself');
  assert.ok(ledger.getWorkerReport(claim.execution_id), 'worker report persisted from the resumed attempt');
  assert.equal(ledger.getExecution(claim.execution_id).attempts_admitted, 2);
  assert.equal(ledger.getExecution(claim.execution_id).state, 'REQUIRES_REVIEW');
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

// ------------------------------------------------- F02: OFF_RESUME_ADMISSION
// Durable OFF is the operator's stop intent: it must refuse attempt admission
// inside the admission transaction and win the launch race — never a spawn
// past OFF, never a counter reset for the retained reservation.

test('F02: OFF set after tick dispatch refuses resume admission — no spawn, no attempt, no charge', async () => {
  const { dir, ledger } = env0();
  const { solution, claim, jobBranch } = interruptedExecution(ledger, { dir });
  ledger.setOff({ reason: 'operator stop after tick dispatch' });
  let spawned = 0;
  const out = await resumeExecution({
    ledger, solution, executionId: claim.execution_id, dir,
    spawnImpl: () => { spawned += 1; return fakeChild(); },
    gitImpl: gitOk({ branch: jobBranch, toplevel: dir }),
    sessionProbe: () => [],
    clock: fakeClock({ bootId: 'BOOT-2', advancePerReadMs: 10_000 }),
    pollIntervalMs: 5,
    deadlineMs: 20, // pre-fix code would spawn: bounded so RED fails fast, never hangs
  });
  assert.equal(out.state, 'BLOCKED');
  assert.equal(out.blocker, 'OFF');
  assert.equal(spawned, 0);
  const row = ledger.getExecution(claim.execution_id);
  assert.equal(row.attempts_admitted, 1, 'no resume attempt admitted past OFF');
  assert.equal(row.charged_reservation_ms, 7_200_000, 'no reservation charged past OFF');
  assert.equal(row.consecutive_resume_failures, 0, 'OFF is not a concrete resume failure');
  rmSync(dir, { recursive: true, force: true });
});

test('F02: OFF landing between admission and spawn — no launch, attempt retained, no counter reset', async () => {
  const { dir, ledger } = env0();
  const { solution, claim, jobBranch } = interruptedExecution(ledger, { dir });
  const origAdmit = ledger.admitNextAttempt.bind(ledger);
  ledger.admitNextAttempt = (args) => {
    const r = origAdmit(args);
    // OFF lands exactly after the admission transaction committed — the
    // barrier race the operator can lose against a launching supervisor
    ledger.setOff({ reason: 'operator stop in the launch race window' });
    return r;
  };
  let spawned = 0;
  const out = await resumeExecution({
    ledger, solution, executionId: claim.execution_id, dir,
    spawnImpl: () => { spawned += 1; return fakeChild(); },
    gitImpl: gitOk({ branch: jobBranch, toplevel: dir }),
    sessionProbe: () => [],
    clock: fakeClock({ bootId: 'BOOT-2', advancePerReadMs: 10_000 }),
    pollIntervalMs: 5,
    deadlineMs: 20, // pre-fix code would spawn: bounded so RED fails fast, never hangs
  });
  assert.equal(out.state, 'BLOCKED');
  assert.equal(out.blocker, 'OFF');
  assert.equal(spawned, 0, 'OFF wins the race: no child launch');
  const row = ledger.getExecution(claim.execution_id);
  assert.equal(row.attempts_admitted, 2, 'the admitted reservation is retained, not rolled back');
  assert.equal(row.consecutive_resume_failures, 0, 'no failure charged for an operator stop');
  assert.equal(row.state, 'RESUMING_HOST', 'slot stays held for later reconciliation');
  rmSync(dir, { recursive: true, force: true });
});

test('F02: OFF landing after the tick claim refuses the supervise launch — reservation retained', async () => {
  const { dir, ledger } = env0();
  const solution = queuedSolution(ledger, dir);
  const claim = ledger.claimExecution({
    solutionId: solution.id, sessionId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    bootId: 'BOOT-EX', supervisor: { pid: process.pid, start: 'x' },
  });
  assert.equal(claim.claimed, true);
  const realGit = gitOk({});
  let offArmed = false;
  const git = (args, opts) => {
    if (!offArmed) {
      offArmed = true;
      // OFF lands after runExecution's entry check, before the spawn — the
      // window between the scheduler's claim and the owned child launch
      ledger.setOff({ reason: 'operator stop between claim and launch' });
    }
    return realGit(args, opts);
  };
  let spawned = 0;
  const out = await runExecution({
    ledger, solution, worktree: dir, dir, superviseExecutionId: claim.execution_id,
    spawnImpl: () => { spawned += 1; return fakeChild(); },
    gitImpl: git,
    clock: fakeClock({ advancePerReadMs: 10_000 }),
    pollIntervalMs: 5,
    startupTimeoutMs: 100,
    deadlineMs: 20, // pre-fix code would spawn: bounded so RED fails fast, never hangs
  });
  assert.equal(out.state, 'BLOCKED');
  assert.equal(out.blocker, 'OFF');
  assert.equal(spawned, 0, 'no owned child launched past durable OFF');
  const row = ledger.getExecution(claim.execution_id);
  assert.equal(row.state, 'RESERVED', 'tick reservation retained for reconciliation');
  assert.equal(row.attempts_admitted, 1);
  rmSync(dir, { recursive: true, force: true });
});

// ------------------------------------------------- F03: PROCESS_UNKNOWN_AS_DEAD
// One explicit three-way probe result: exact-live / documented absence /
// unknown. A thrown command, unexpected exit, malformed or empty response is
// UNKNOWN — never death. Same pid + different start is REUSED and never
// signalled. Production spawn errors arrive asynchronously and must produce a
// durable bounded outcome with no orphaned descriptors.

test('F03: proveProcessDeath — {} / live-without-start / throwing probes are unknown; documented absence and reuse stay exact', () => {
  const base = { pid: 601, processStart: CHILD_START, recordedBootId: 'BOOT-1', currentBootId: 'BOOT-1' };
  // malformed {} — the OLD code coerced it to {found:false} -> absent -> dead
  assert.equal(proveProcessDeath({ ...base, processProbe: () => ({}) }).verdict, 'unknown');
  assert.equal(proveProcessDeath({ ...base, processProbe: () => ({}) }).dead, false);
  // live-shaped probe missing the start text: identity unprovable
  assert.equal(proveProcessDeath({ ...base, processProbe: () => ({ alive: true }) }).verdict, 'unknown');
  // thrown probe (EACCES/EIO/tool failure): unknown, never absence
  assert.equal(proveProcessDeath({ ...base, processProbe: () => { throw Object.assign(new Error('ps EACCES'), { code: 'EACCES' }); } }).verdict, 'unknown');
  // documented no-such-process: positive absence stays
  const absent = proveProcessDeath({ ...base, processProbe: () => ({ alive: false, start: null }) });
  assert.deepEqual(absent, { dead: true, kind: 'absent', verdict: 'absent' });
  // previous boot: positive absence without any probe
  assert.equal(proveProcessDeath({ ...base, recordedBootId: 'BOOT-0', currentBootId: 'BOOT-1' }).kind, 'old-boot');
  // same pid, different start: REUSED — never dead, never signallable
  const reused = proveProcessDeath({ ...base, processProbe: () => ({ alive: true, start: 'Mon Oct  6 09:09:00 2026' }) });
  assert.equal(reused.dead, false);
  assert.equal(reused.verdict, 'reused');
});

test('F03: supervisor-lock takeover — malformed/throwing holder probe refuses UNPROVEN, bytes untouched', () => {
  const arms = [
    () => ({}),
    () => { throw Object.assign(new Error('ps EIO'), { code: 'EIO' }); },
  ];
  for (const badProbe of arms) {
    const dir = mkdtempSync(join(tmpdir(), 'dot-f03-lock-'));
    const workerDir = join(dir, 'worker');
    mkdirSync(workerDir, { recursive: true });
    const holderJson = JSON.stringify({ pid: 4242, start: SUP_START, boot_id: 'BOOT-EX', execution_id: 'DOT-EXEC-F03' });
    writeFileSync(join(workerDir, 'supervisor.lock'), holderJson);
    const gate = acquireSupervisorLock({ workerDir, bootId: 'BOOT-EX', processProbe: badProbe });
    assert.equal(gate.blocked, 'SUPERVISOR_LOCK_UNPROVEN');
    assert.equal(gate.fd, undefined, 'no lock fd handed out on unproven evidence');
    assert.equal(readFileSync(join(workerDir, 'supervisor.lock'), 'utf8'), holderJson, 'holder bytes untouched');
    rmSync(dir, { recursive: true, force: true });
  }
});

test('F03: adoption with an unprovable child probe holds UNCERTAIN_IDENTITY — no monitor loop, no fabricated outcome', async () => {
  const { dir, ledger } = env0();
  const { claim } = adoptedExecution(ledger, { dir });
  const out = await monitorAdoptedChild({
    ledger, executionId: claim.execution_id, dir,
    processProbe: () => ({}), // malformed: neither live nor documented-absent
    clock: fakeClock({ bootId: 'BOOT-1' }),
    pollIntervalMs: 5, deadlineMs: 5_000,
  });
  assert.equal(out.state, 'UNCERTAIN');
  assert.equal(out.blocker, 'UNCERTAIN_IDENTITY');
  // the RECOVERING_HOST row is held for a later tick (same pattern as the
  // forged-start hold) — never flipped, never fabricated into a stop
  assert.equal(ledger.getExecution(claim.execution_id).state, 'RECOVERING_HOST');
  rmSync(dir, { recursive: true, force: true });
});

test('F03: production adapter maps only the documented no-such-process result to absence', async () => {
  const { productionProcessProbe, psErrorOutcome, psSuccessOutcome } = await import('./executor.mjs');
  assert.equal(typeof productionProcessProbe, 'function');
  // pure error mapping: exit 1 with NO stdout = the documented BSD/macOS ps
  // no-such-process result; everything else is unknown
  assert.equal(psErrorOutcome({ status: 1, stdout: '' }), 'absent');
  assert.equal(psErrorOutcome({ status: 1, stdout: 'weird output\n' }), 'unknown');
  assert.equal(psErrorOutcome({ status: 2, stdout: '' }), 'unknown');
  assert.equal(psErrorOutcome({ code: 'EACCES' }), 'unknown');
  assert.equal(psErrorOutcome({ code: 'EIO' }), 'unknown');
  assert.equal(psErrorOutcome(null), 'unknown');
  // success mapping: a real lstart line is live; empty success output is ambiguous
  assert.equal(psSuccessOutcome('  Mon Oct  6 09:01:00 2026\n'), 'live');
  assert.equal(psSuccessOutcome('   '), 'unknown');
  assert.equal(psSuccessOutcome(''), 'unknown');
  // a malformed pid argument never becomes documented absence
  const badPid = productionProcessProbe('not-a-pid');
  assert.equal(badPid.alive, null);
  assert.equal(badPid.unknown, true);
  // a REALLY absent pid (ps exit 1, empty stdout) stays positive absence
  let absent = null;
  for (let p = 99997; p >= 99900; p -= 1) {
    const probe = productionProcessProbe(p);
    if (probe.alive === false) { absent = { pid: p, probe }; break; }
    if (probe.alive === true) continue; // some live process occupies this pid — keep scanning
    throw new Error(`unexpected unknown probe for pid ${p}: ${JSON.stringify(probe)}`);
  }
  assert.ok(absent, 'found a documented-absent pid in the scan range');
  assert.deepEqual(absent.probe, { alive: false, start: null });
  // a REALLY live pid probes live with a start text
  const live = productionProcessProbe(process.pid);
  assert.equal(live.alive, true);
  assert.ok(typeof live.start === 'string' && live.start.length > 0);
});

test('F03: productionSpawn — async spawn error (ENOENT) settles bounded, surfaces via exit channel, never a blind kill', async () => {
  const { productionSpawn } = await import('./executor.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'dot-f03-spawn-'));
  const stdoutPath = join(dir, 'child.stdout');
  const stderrPath = join(dir, 'child.stderr');
  const child = productionSpawn('/nonexistent/dot-relay-f03-bin', ['--probe'], {
    cwd: dir, stdoutPath, stderrPath, env: { PATH: '/usr/bin:/bin' },
  });
  assert.equal(typeof child.whenSpawnSettled, 'function');
  await child.whenSpawnSettled(); // the async error boundary — pre-fix this method does not exist (RED)
  const err = child.spawnError();
  assert.ok(err, 'the ENOENT surfaced through the wrapper');
  assert.equal(err.code, 'ENOENT');
  assert.equal(child.pid, undefined); // nothing launched
  let exitSeen = false;
  child.onExit(() => { exitSeen = true; });
  await sleep(100);
  assert.equal(exitSeen, true, 'a failed spawn produces a bounded outcome through the exit channel');
  assert.equal(child.kill('SIGTERM'), false, 'no pid to signal — never a blind kill');
  assert.ok(existsSync(stdoutPath) && existsSync(stderrPath), 'capture descriptors were created');
  rmSync(dir, { recursive: true, force: true });
});

test('F03: productionSpawn — post-boundary kill failures stay bounded (no supervisor crash), real exits replay to late subscribers', async () => {
  const { productionSpawn } = await import('./executor.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'dot-f03-spawn2-'));
  const child = productionSpawn('/bin/sleep', ['30'], {
    cwd: dir, stdoutPath: join(dir, 'o'), stderrPath: join(dir, 'e'), env: { PATH: '/usr/bin:/bin' },
  });
  await child.whenSpawnSettled();
  assert.equal(child.spawnError(), null); // launched fine: the pid metadata boundary passed
  assert.ok(Number.isInteger(child.pid));
  // an invalid signal throws ERR_UNKNOWN_SIGNAL SYNCHRONOUSLY inside
  // ChildProcess.kill — the wrapper must bound it, never crash the supervisor
  assert.equal(child.kill('SIGBOGUS'), false);
  let exitArg = null;
  child.onExit((code, signal) => { exitArg = { code, signal }; });
  child.kill('SIGTERM');
  const t0 = Date.now();
  while (exitArg === null && Date.now() - t0 < 3_000) await sleep(20);
  assert.ok(exitArg !== null, 'the real exit reached the exit channel');
  assert.equal(exitArg.signal, 'SIGTERM');
  assert.equal(exitArg.code, null);
  rmSync(dir, { recursive: true, force: true });
});

test('F03: runExecution with a real async spawn failure checkpoints BLOCKED_LAUNCH — no unhandled-error crash', async () => {
  const { productionSpawn } = await import('./executor.mjs');
  const { dir, ledger } = env0();
  const solution = queuedSolution(ledger, dir);
  const out = await runExecution({
    ledger, solution, worktree: dir, dir,
    spawnImpl: (executable, argv, opts) => productionSpawn('/nonexistent/dot-relay-f03-bin', argv, opts),
    gitImpl: gitOk(),
    clock: fakeClock(),
    pollIntervalMs: 5, startupTimeoutMs: 500, deadlineMs: 5_000,
  });
  assert.equal(out.state, 'BLOCKED');
  assert.equal(out.blocker, 'BLOCKED_LAUNCH');
  assert.equal(ledger.status().execution, null); // slot freed by the bounded outcome
  rmSync(dir, { recursive: true, force: true });
});

// ------------------------------------------------- F05: ARTIFACT_RESERIALIZATION
// The PUBLISHED object-store file is the only byte authority for a solution
// artifact: compact, pretty, reordered-key, trailing-LF and multibyte originals
// each verify against their OWN manifest, and a JSON-reconstruction match is
// never accepted as evidence. Any drift — one byte, absent file, symlink,
// wrong size, foreign envelope, swapped payload — fails closed BEFORE spawn,
// and resume holds the identical original-byte authority.

const F05_SERIAL_VARIANTS = [
  ['compact', (e) => JSON.stringify(e)],
  ['pretty 2-space', (e) => JSON.stringify(e, null, 2)],
  ['pretty 4-space', (e) => JSON.stringify(e, null, 4)],
  ['reordered keys', (e) => JSON.stringify({ sha256: e.sha256, payload: e.payload, parents: e.parents, producer: e.producer, id: e.id, kind: e.kind, version: e.version })],
  ['trailing LF', (e) => `${JSON.stringify(e)}\n`],
  ['pretty multibyte original', (e) => JSON.stringify(e, null, 2)],
];

const F05_PRETTY = (e) => JSON.stringify(e, null, 2);

test('F05: every producer serialization verifies against its OWN manifest — spawn proceeds, kickoff bytes exact', async () => {
  for (const [name, serialize] of F05_SERIAL_VARIANTS) {
    const { dir, ledger } = env0();
    const solution = queuedSolution(ledger, dir, { serialize });
    const manifest = ledger.getManifest(solution.id);
    const rawText = readFileSync(join(dir, 'objects', `${manifest.artifact_sha256}.json`), 'utf8');
    // the multibyte arm really is multibyte at the byte level (non-ASCII
    // acceptance text by construction)
    if (name === 'pretty multibyte original') {
      assert.ok(Buffer.byteLength(rawText, 'utf8') > rawText.length, 'non-ASCII bytes present in the original');
    }
    const child = fakeChild();
    const r = runExecution({
      ledger, solution, worktree: dir, dir,
      spawnImpl: captureSpawn(child), gitImpl: gitOk(),
      clock: fakeClock(),
      pollIntervalMs: 5, startupTimeoutMs: 200, deadlineMs: 5_000,
    });
    await sleep(10);
    await guardedMidRun(r, child, () => {
      assert.ok(Array.isArray(child.argv), `${name}: spawn proceeded — original bytes accepted`);
      // the private kickoff file carries the kickoff of the PARSED ORIGINAL
      assert.equal(
        readFileSync(join(dir, 'worker', `${child.opts.env.DOT_RELAY_EXECUTION_ID}.kickoff.md`), 'utf8'),
        String(solution.payload.kickoff),
        `${name}: kickoff bytes come from the original file`,
      );
    });
    child.kill('SIGKILL'); // test cleanup
    await r;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('F05: tampered or foreign object-store originals fail closed BEFORE spawn — BLOCKED_PACKET_UNTRUSTED, slot held', async () => {
  const arms = [
    {
      name: 'one byte appended to the pretty original',
      make: ({ dir, ledger }) => {
        const solution = queuedSolution(ledger, dir, { serialize: F05_PRETTY });
        const p = join(dir, 'objects', `${ledger.getManifest(solution.id).artifact_sha256}.json`);
        writeFileSync(p, `${readFileSync(p, 'utf8')} `);
        return solution;
      },
    },
    {
      name: 'object file absent',
      make: ({ dir, ledger }) => {
        const solution = queuedSolution(ledger, dir, { serialize: F05_PRETTY });
        rmSync(join(dir, 'objects', `${ledger.getManifest(solution.id).artifact_sha256}.json`));
        return solution;
      },
    },
    {
      name: 'object path is a symlink',
      make: ({ dir, ledger }) => {
        const solution = queuedSolution(ledger, dir, { serialize: F05_PRETTY });
        const p = join(dir, 'objects', `${ledger.getManifest(solution.id).artifact_sha256}.json`);
        const target = join(dir, 'f05-symlink-target.json');
        writeFileSync(target, F05_PRETTY(solution));
        rmSync(p);
        symlinkSync(target, p);
        return solution;
      },
    },
    {
      name: 'manifest bytes column disagrees with the real file',
      make: ({ dir, ledger }) => queuedSolution(ledger, dir, {
        serialize: F05_PRETTY,
        manifestOverride: (m) => ({ ...m, bytes: m.bytes + 1 }),
      }),
    },
    {
      name: 'foreign envelope (different id) at the registered digest',
      make: ({ dir, ledger }) => queuedSolution(ledger, dir, {
        envelopeOverride: (s) => {
          const forged = { ...s, id: 'DOT-EX-S-FORGED-0001' };
          forged.sha256 = envelopeDigest(forged);
          return forged;
        },
      }),
    },
    {
      name: 'swapped payload (changed kickoff) at a self-consistent digest',
      make: ({ dir, ledger }) => queuedSolution(ledger, dir, {
        envelopeOverride: (s) => {
          const swapped = { ...s, payload: { ...s.payload, kickoff: '# swapped kickoff\n', kickoff_sha256: sha256Of('# swapped kickoff\n') } };
          swapped.sha256 = envelopeDigest(swapped);
          return swapped;
        },
      }),
    },
  ];
  for (const arm of arms) {
    const { dir, ledger } = env0();
    const solution = arm.make({ dir, ledger });
    let spawned = 0;
    const out = await runExecution({
      ledger, solution, worktree: dir, dir,
      spawnImpl: () => { spawned += 1; throw new Error('must not spawn'); },
      gitImpl: gitOk(), clock: fakeClock(), pollIntervalMs: 5,
    });
    assert.equal(out.state, 'BLOCKED', arm.name);
    assert.equal(out.blocker, 'BLOCKED_PACKET_UNTRUSTED', arm.name);
    assert.equal(spawned, 0, `${arm.name}: no spawn`);
    assert.equal(ledger.status().execution, null, `${arm.name}: fresh mode never claimed an execution`);
    rmSync(dir, { recursive: true, force: true });
  }
});

test('F05: resume holds the identical original-byte authority — pretty original resumes, drifted bytes refuse', async () => {
  // GREEN arm: a pretty-serialized original (checkpoint bound to THAT manifest)
  // resumes through the exact --resume spawn.
  {
    const { dir, ledger } = env0();
    const { solution, claim, jobBranch } = interruptedExecution(ledger, { dir, serialize: F05_PRETTY });
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
    await guardedMidRun(r, child, () => {
      assert.equal(child.argv[child.argv.indexOf('--resume') + 1], 'resume-sess-0001-aaaa');
    });
    child.kill('SIGKILL'); // test cleanup
    await r;
    rmSync(dir, { recursive: true, force: true });
  }
  // RED arm: one drifted byte in the pretty original refuses the resume.
  {
    const { dir, ledger } = env0();
    const { solution, claim, jobBranch } = interruptedExecution(ledger, { dir, serialize: F05_PRETTY });
    const objPath = join(dir, 'objects', `${ledger.getManifest(solution.id).artifact_sha256}.json`);
    writeFileSync(objPath, `${readFileSync(objPath, 'utf8')} `);
    let spawned = 0;
    const out = await resumeExecution({
      ledger, solution, executionId: claim.execution_id, dir,
      spawnImpl: () => { spawned += 1; throw new Error('must not spawn'); },
      gitImpl: gitOk({ branch: jobBranch, toplevel: dir }), sessionProbe: () => [],
      clock: fakeClock({ bootId: 'BOOT-2' }), pollIntervalMs: 5,
    });
    assert.equal(out.state, 'BLOCKED');
    assert.equal(out.blocker, 'BLOCKED_PACKET_UNTRUSTED');
    assert.equal(spawned, 0);
    assert.equal(ledger.getExecution(claim.execution_id).state, 'BLOCKED');
    rmSync(dir, { recursive: true, force: true });
  }
});

// ------------------------------------------------- F06: ADOPT_ATTEMPT_CAPTURE
// Adoption must select the CURRENT admitted attempt's capture (persisted
// per-attempt before launch), reverify the packet/checkpoint/immutable files
// BEFORE monitoring, and take the same exclusive supervisor ownership — one
// owner, zero GLM spawns, unchanged attempt count.

// Models an execution on attempt N>=2 (a resumed child whose supervisor died
// same-boot): attempts_admitted=N with a live exact child on attempt N, a
// per-attempt capture manifest, and a STALE attempt-1 stdout holding a
// session-matching CODE_COMPLETE capture for a DIFFERENT PR.
const F06_CHILD_PID = 702;
const F06_CHILD_START = 'Mon Oct  6 11:02:00 2026';
function adoptedResumedExecution(ledger, { dir, attempt = 2 }) {
  const sessionId = `adopt-sess-${String(attempt).padStart(4, '0')}-bbbb`;
  const solution = queuedSolution(ledger, dir);
  const claim = ledger.claimExecution({
    solutionId: solution.id, sessionId,
    bootId: 'BOOT-1', supervisor: { pid: 501, start: SUP_START },
  });
  const jobBranch = `codex/dot-job-${solution.sha256.slice(0, 12)}`;
  const packet = writePacketFiles(dir, claim.execution_id, solution);
  writeCp(dir, claim.execution_id, {
    version: 1,
    execution_id: claim.execution_id,
    session_id: sessionId,
    boot_id: 'BOOT-1',
    phase: 'RUNNING',
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
  // per-attempt capture manifest — what the resume path persists pre-launch
  writeFileSync(join(dir, 'worker', `${claim.execution_id}.a${attempt}.capture.json`), JSON.stringify({
    version: 1, execution_id: claim.execution_id, attempt_number: attempt, session_id: sessionId,
    boot_id: 'BOOT-1',
    stdout: `${claim.execution_id}.a${attempt}.stdout`,
    stderr: `${claim.execution_id}.a${attempt}.stderr`,
    startup: null,
  }));
  // the attempt-N row + attempts_admitted, the post-crash disk shape a real
  // resume leaves behind (attempt 1 exists from claimExecution)
  const raw = new DatabaseSync(join(dir, 'ledger.sqlite'));
  raw.prepare(
    'INSERT INTO execution_attempts (execution_id, attempt_number, state, boot_id, active_start_ns, last_active_ns, child_pid, child_start, session_id) VALUES (?,?,?,?,?,?,?,?,?)',
  ).run(claim.execution_id, attempt, 'RUNNING', 'BOOT-1', '990000000', '995000000', F06_CHILD_PID, F06_CHILD_START, sessionId);
  raw.prepare('UPDATE executions SET attempts_admitted = ?, state = ?, pid = ?, process_start = ? WHERE id = ?').run(
    attempt, 'RECOVERING_HOST', F06_CHILD_PID, F06_CHILD_START, claim.execution_id,
  );
  raw.close();
  return { solution, claim, jobBranch, packet, sessionId };
}

// the DECEPTIVE stale attempt-1 capture: current session id, valid digests,
// but the attempt-1 PR — accepting it fabricates completion from attempt 1
function staleAttempt1Capture(executionId, solution, packet, sessionId, prUrl) {
  return JSON.stringify(outerCapture(sessionId, JSON.stringify(codeCompleteReport({
    executionId, sessionId, solution, artifactSha256: packet.artifact_sha256, prUrl,
  }))));
}

test('F06: adoption of attempts 2 and 3 reads only the exact matching capture — stale attempt-1 success is never accepted', async () => {
  for (const attempt of [2, 3]) {
    const { dir, ledger } = env0();
    const { claim, solution, packet, sessionId } = adoptedResumedExecution(ledger, { dir, attempt });
    writeFileSync(
      join(dir, 'worker', `${claim.execution_id}.stdout`),
      staleAttempt1Capture(claim.execution_id, solution, packet, sessionId, 'https://github.com/artyhoo/getff/pull/1111'),
    );
    let alive = true;
    const r = monitorAdoptedChild({
      ledger, executionId: claim.execution_id, dir,
      processProbe: (pid) => (pid === F06_CHILD_PID && alive ? { alive: true, start: F06_CHILD_START } : { alive: false, start: null }),
      clock: fakeClock({ bootId: 'BOOT-1' }),
      pollIntervalMs: 5, deadlineMs: 30_000,
    });
    await sleep(20);
    assert.equal(ledger.getExecution(claim.execution_id).state, 'RECOVERING_HOST', `attempt ${attempt}: still monitored`);
    alive = false;
    writeFileSync(
      join(dir, 'worker', `${claim.execution_id}.a${attempt}.stdout`),
      JSON.stringify(outerCapture(sessionId, JSON.stringify(codeCompleteReport({
        executionId: claim.execution_id, sessionId, solution,
        artifactSha256: packet.artifact_sha256,
        prUrl: `https://github.com/artyhoo/getff/pull/2${attempt}22`,
      })))),
    );
    const out = await r;
    assert.equal(out.state, 'REQUIRES_REVIEW', `attempt ${attempt}: the CURRENT attempt capture advances once`);
    assert.equal(out.pr_url, `https://github.com/artyhoo/getff/pull/2${attempt}22`, `attempt ${attempt}: never the stale attempt-1 PR`);
    assert.equal(ledger.getWorkerReport(claim.execution_id).pr_url, `https://github.com/artyhoo/getff/pull/2${attempt}22`);
    assert.equal(ledger.getExecution(claim.execution_id).attempts_admitted, attempt, 'adoption consumes NO reservation');
    assert.equal(ledger.getExecution(claim.execution_id).state, 'REQUIRES_REVIEW');
    rmSync(dir, { recursive: true, force: true });
  }
});

test('F06: adoption reverifies packet+checkpoint+immutable files — tampered or missing evidence holds with fixed blockers', async () => {
  // arm a: one drifted byte in the immutable kickoff file
  {
    const { dir, ledger } = env0();
    const { claim } = adoptedResumedExecution(ledger, { dir, attempt: 2 });
    const kickoffPath = join(dir, 'worker', `${claim.execution_id}.kickoff.md`);
    const tampered = `${readFileSync(kickoffPath, 'utf8')}X`;
    writeFileSync(kickoffPath, tampered);
    const out = await monitorAdoptedChild({
      ledger, executionId: claim.execution_id, dir,
      processProbe: () => ({ alive: false, start: null }),
      clock: fakeClock({ bootId: 'BOOT-1' }),
      pollIntervalMs: 5, deadlineMs: 5_000,
    });
    assert.equal(out.state, 'BLOCKED');
    assert.equal(out.blocker, 'BLOCKED_PACKET_UNTRUSTED');
    assert.equal(ledger.getExecution(claim.execution_id).state, 'BLOCKED');
    assert.equal(readFileSync(kickoffPath, 'utf8'), tampered, 'original bytes never rewritten');
    rmSync(dir, { recursive: true, force: true });
  }
  // arm b: checkpoint absent
  {
    const { dir, ledger } = env0();
    const { claim } = adoptedResumedExecution(ledger, { dir, attempt: 2 });
    rmSync(join(dir, 'worker', `${claim.execution_id}.checkpoint.json`));
    const out = await monitorAdoptedChild({
      ledger, executionId: claim.execution_id, dir,
      processProbe: () => ({ alive: false, start: null }),
      clock: fakeClock({ bootId: 'BOOT-1' }),
      pollIntervalMs: 5, deadlineMs: 5_000,
    });
    assert.equal(out.state, 'BLOCKED');
    assert.equal(out.blocker, 'BLOCKED_RESUME_METADATA');
    assert.equal(ledger.getExecution(claim.execution_id).state, 'BLOCKED');
    rmSync(dir, { recursive: true, force: true });
  }
  // arm c: drifted object-store original (the F05 authority)
  {
    const { dir, ledger } = env0();
    const { claim, solution } = adoptedResumedExecution(ledger, { dir, attempt: 2 });
    const objPath = join(dir, 'objects', `${ledger.getManifest(solution.id).artifact_sha256}.json`);
    writeFileSync(objPath, `${readFileSync(objPath, 'utf8')} `);
    const out = await monitorAdoptedChild({
      ledger, executionId: claim.execution_id, dir,
      processProbe: () => ({ alive: false, start: null }),
      clock: fakeClock({ bootId: 'BOOT-1' }),
      pollIntervalMs: 5, deadlineMs: 5_000,
    });
    assert.equal(out.state, 'BLOCKED');
    assert.equal(out.blocker, 'BLOCKED_PACKET_UNTRUSTED');
    rmSync(dir, { recursive: true, force: true });
  }
  // arm d (GREEN): exact valid packet + latest capture advances ONCE to
  // REQUIRES_REVIEW; a second adoption of the finished row refuses.
  {
    const { dir, ledger } = env0();
    const { claim, solution, packet, sessionId } = adoptedResumedExecution(ledger, { dir, attempt: 2 });
    writeFileSync(
      join(dir, 'worker', `${claim.execution_id}.stdout`),
      staleAttempt1Capture(claim.execution_id, solution, packet, sessionId, 'https://github.com/artyhoo/getff/pull/1111'),
    );
    writeFileSync(
      join(dir, 'worker', `${claim.execution_id}.a2.stdout`),
      JSON.stringify(outerCapture(sessionId, JSON.stringify(codeCompleteReport({
        executionId: claim.execution_id, sessionId, solution,
        artifactSha256: packet.artifact_sha256, prUrl: 'https://github.com/artyhoo/getff/pull/2222',
      })))),
    );
    const out = await monitorAdoptedChild({
      ledger, executionId: claim.execution_id, dir,
      processProbe: () => ({ alive: false, start: null }), // child already exited
      clock: fakeClock({ bootId: 'BOOT-1' }),
      pollIntervalMs: 5, deadlineMs: 30_000,
    });
    assert.equal(out.state, 'REQUIRES_REVIEW');
    assert.equal(out.pr_url, 'https://github.com/artyhoo/getff/pull/2222');
    const again = await monitorAdoptedChild({
      ledger, executionId: claim.execution_id, dir,
      processProbe: () => ({ alive: false, start: null }),
      clock: fakeClock({ bootId: 'BOOT-1' }),
      pollIntervalMs: 5, deadlineMs: 30_000,
    });
    assert.equal(again.state, 'BLOCKED');
    assert.equal(again.blocker, 'EXECUTION_STATE', 'a finished row is never re-monitored');
    assert.equal(ledger.getExecution(claim.execution_id).attempts_admitted, 2);
    rmSync(dir, { recursive: true, force: true });
  }
});

test('F06: two simultaneous adoption monitors — one owner (SUPERVISOR_LOCK), zero GLM spawns, unchanged attempt count', async () => {
  const { dir, ledger } = env0();
  const { claim, solution, packet, sessionId } = adoptedResumedExecution(ledger, { dir, attempt: 2 });
  const ownStart = execFileSync('/bin/ps', ['-o', 'lstart=', '-p', String(process.pid)], { encoding: 'utf8' }).trim();
  let alive = true;
  const kills = []; // fake pid: a real signal to it would hit an unrelated process
  const killImpl = (pid, sig) => { kills.push({ pid, sig }); };
  const probe = (pid) => {
    if (pid === F06_CHILD_PID) return alive ? { alive: true, start: F06_CHILD_START } : { alive: false, start: null };
    if (pid === process.pid) return { alive: true, start: ownStart }; // the FIRST monitor's lock holder: us
    return { alive: false, start: null };
  };
  const first = monitorAdoptedChild({
    ledger, executionId: claim.execution_id, dir,
    processProbe: probe, killImpl,
    clock: fakeClock({ bootId: 'BOOT-1' }),
    pollIntervalMs: 5, deadlineMs: 30_000,
  });
  await sleep(20); // the first monitor holds the supervisor slot
  // bounded second claim: exclusive ownership must answer IMMEDIATELY, never
  // after waiting on the (shared, still-live) child. Assertions over the
  // refusal run inside try/finally: on a RED failure the still-pending first
  // monitor is drained (child death + capture) so the runner can exit —
  // the guardedMidRun contract applied to a probe-driven monitor.
  const finishOwner = () => {
    alive = false;
    writeFileSync(
      join(dir, 'worker', `${claim.execution_id}.a2.stdout`),
      JSON.stringify(outerCapture(sessionId, JSON.stringify(codeCompleteReport({
        executionId: claim.execution_id, sessionId, solution,
        artifactSha256: packet.artifact_sha256, prUrl: 'https://github.com/artyhoo/getff/pull/2222',
      })))),
    );
  };
  let second = null;
  try {
    second = await monitorAdoptedChild({
      ledger, executionId: claim.execution_id, dir,
      processProbe: probe, killImpl,
      // advancing clock: a refused claim must still be BOUNDED — if ownership
      // were missing (old code), the shared-child wait ends at its own budget
      clock: fakeClock({ bootId: 'BOOT-1', advancePerReadMs: 50 }),
      pollIntervalMs: 5, deadlineMs: 100, termGraceMs: 5,
    });
    assert.equal(second.state, 'BLOCKED');
    assert.equal(second.blocker, 'SUPERVISOR_LOCK', 'a live exact owner refuses the second monitor');
    assert.equal(ledger.getExecution(claim.execution_id).attempts_admitted, 2, 'no attempt consumed');
    assert.equal(ledger.getExecution(claim.execution_id).state, 'RECOVERING_HOST');
    assert.equal(kills.length, 0, 'identity is read, never signalled, in a refusal');
  } finally {
    finishOwner();
    await first.catch(() => {});
  }
  // the single owner finishes from the CURRENT attempt capture
  const out = await first;
  assert.equal(out.state, 'REQUIRES_REVIEW');
  assert.equal(ledger.getExecution(claim.execution_id).attempts_admitted, 2, 'still unchanged after completion');
  // the owner released the slot — no stale lock file outlives the monitor
  assert.ok(!existsSync(join(dir, 'worker', 'supervisor.lock')), 'lock released on monitor exit');
  rmSync(dir, { recursive: true, force: true });
});
