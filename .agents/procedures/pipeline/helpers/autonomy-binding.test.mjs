/**
 * autonomy-binding.test.mjs — adversarial matrix for the Stage-A1 autonomy binding
 * (portable-verified-autonomy plan Task 5, kickoff §3.6 rows 1-19).
 *
 * Shape: `node --test` over this file. Fixtures are per-test mkdtemp trees (a fake repo
 * with a `.git` dir, a current-decisions selector with live-resolvable ContentRefs, and a
 * stage-artifact root INSIDE the repo). Every subprocess is the REAL one-shot CLI
 * (autonomy-binding.mjs) driven through spawnSync/spawn — no in-process shortcuts on the
 * production paths — except the rows that are explicitly library-level unit arms (rows 8
 * custody, 14 store revision checks, 15, 16 alias residual, 18, 19 pure battery), which
 * call the modules a library consumer would call and are labelled as such inline.
 *
 * Kickoff code names vs enforced codes (pinned here so the mapping is auditable):
 *   observation_deadline_not_worker_failure (row 5) → route hold `worker_report_timeout`
 *     + custody/control/cessation provably untouched.
 *   duplicate_action (row 6) → observation disposition `duplicate` + single stored entry.
 *   stale_candidate / stale_custody_generation (row 8) → `candidate_regression` /
 *     disposition `historical-stale-custody`.
 *   control_gate (row 9) → `action_not_granted` + `admission_blocked` + the observation
 *     field whitelist (worker output carries no control authority).
 *
 * Prohibited effects (row 13): every spawn carries env pointing the known outbound seams
 * at a local recorder server; the `aftermath` test at the END of this file asserts zero
 * accepted TCP connections AND zero HTTP requests across the whole run (A1 review: a
 * request-only assertion would miss a connection that never completes a request), and
 * static arms assert the six modules never import or call an outbound client at all.
 *
 * Host platform contract (A1 HOST-01): the suite is EXPLICITLY platform-aware. The
 * Linux-functional arms (real abstract-bind-lock CLI/engine paths: concurrency, crash,
 * alias, contention) run on Linux and are SKIPPED elsewhere with a reason that says the
 * behavior was NOT passed on this host. The reverse arms (real non-Linux CLI/engine
 * fail-closed hold with unchanged state) run ONLY on a real non-Linux host. The gate
 * MECHANICS are verified everywhere through the engine's `_testPlatform` seam (which
 * drives the real platform gate — it can only make the gate fail, never fake a success)
 * and the row-18 unit matrix. No arm spoofs a platform to claim a Linux behavior passed.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, spawn } from 'node:child_process';
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync,
  rmSync, realpathSync, symlinkSync,
} from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, 'autonomy-binding.mjs');
const MODULE_FILES = [
  'autonomy-binding.mjs',
  'autonomy-binding/engine.mjs',
  'autonomy-binding/record.mjs',
  'autonomy-binding/lock.mjs',
  'autonomy-binding/store.mjs',
  'autonomy-binding/authority.mjs',
];
const src = (rel) => readFileSync(join(HERE, rel), 'utf8');

import { productionResumeHold, reservedVerbHold, reconcile, initBinding } from './autonomy-binding/engine.mjs';
import {
  initialRecord, applyControlTransition, validateRecord, proposeResumeTransition,
  recordDigest, grantDigestOf, addHold, sha256Hex, ADMITTING_STATES, TERMINAL_STATES,
  DELIVERY_HISTORY_MAX,
} from './autonomy-binding/record.mjs';
import {
  readRecord, writeRecordAtomic, ensureStageOwnership, resolveRecordTarget,
  canonicalRecordPath,
} from './autonomy-binding/store.mjs';
import {
  platformSupportsAbstractBindLock, acquireBindLock, lockNameForRecord,
  validateRetryTiming, LOCK_RETRY_DEFAULT_BUDGET_MS, LOCK_RETRY_MAX_MS,
} from './autonomy-binding/lock.mjs';
import { authoritySignature } from './autonomy-binding/authority.mjs';

const FID = 'matrix-fixture';
const STAGE = 'stage-a1';
const NOW_BASE = Date.parse('2026-10-27T10:00:00.000Z');
let nowSeq = 0;
/** Deterministic, monotonically increasing ISO timestamps (schema-validated shape). */
function iso() {
  nowSeq += 1;
  return new Date(NOW_BASE + nowSeq).toISOString();
}
const sleep = (ms) => new Promise((settle) => setTimeout(settle, ms));
const fileSha = (path) => sha256Hex(readFileSync(path));

// ---------------------------------------------------------------------------
// Host platform contract (HOST-01). `ltest` = Linux-functional arm: RUNS on Linux,
// SKIPPED elsewhere with an explicit «NOT passed» reason (never reported as green).
// `ntest` = real non-Linux arm: RUNS only on a real non-Linux host, skipped on Linux.
// Gate mechanics that can run everywhere go through the engine's `_testPlatform` seam
// (regular `test`) — the seam drives the real gate and can only make it fail.
// ---------------------------------------------------------------------------
const HOST_PLATFORM = process.platform;
const ON_LINUX = HOST_PLATFORM === 'linux';
const LINUX_ONLY_SKIP = `Skipped — NOT passed on this host (${HOST_PLATFORM}): Linux-functional arm exercising the real abstract-bind-lock CLI/engine paths. The platform gate mechanics are verified separately by the _testPlatform engine arms and the row-18 unit matrix, which DO run here.`;
const NON_LINUX_SKIP = `Skipped — NOT passed on this host (${HOST_PLATFORM}): this arm verifies the REAL non-Linux fail-closed hold through the real CLI/engine, which a Linux host cannot exercise. On Linux the same fixtures are proven valid by the Linux-functional arms, so a non-Linux hold is attributable to the platform gate alone.`;
const ltest = ON_LINUX
  ? test
  : (name, fn, opts = {}) => test(name, { ...opts, skip: opts.skip ?? LINUX_ONLY_SKIP }, fn);
const ntest = ON_LINUX
  ? (name, fn, opts = {}) => test(name, { ...opts, skip: opts.skip ?? NON_LINUX_SKIP }, fn)
  : test;

// ---------------------------------------------------------------------------
// Prohibited-effects recorder (row 13): every subprocess gets env pointing the
// known outbound seams at this listener; the `aftermath` test at the END of this
// file asserts it never accepted a single TCP connection and never served a
// single HTTP request (A1 review: the HTTP-request counter alone would miss a
// connection attempt that never completes a request). The listener itself is
// inert — it only counts. (It is closed by the LAST test declaration in this file,
// not a top-level after(): an earlier full-suite run once ended with the recorder
// still listening and hung the runner — cause never isolated. An isolated probe on
// this exact runtime later showed a top-level after() DOES fire, so the hang was
// never attributed to after() skipping; the ordered last test is simply the closure
// channel this suite itself proves executes on every run.)
// ---------------------------------------------------------------------------
let recorderHits = 0;
let recorderConnections = 0;
const recorder = createServer(() => { recorderHits += 1; });
recorder.on('connection', () => { recorderConnections += 1; });
const RECORDER_ENV = await new Promise((settle) => {
  recorder.listen(0, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${recorder.address().port}`;
    settle({
      AIF_BASE_URL: url,
      AIF_RUNTIME_BRIDGE_URL: url,
      AIF_DISPATCH_URL: url,
      GITHUB_API_URL: url,
      GITHUB_API: url,
      AUTONOMY_BINDING_CALLBACK_URL: url,
      AUTONOMY_RESUME_GRANT: url,
      RESUME_GRANT: url,
      AIF_AUTHORIZED: 'true',
    });
  });
});
// The row-13 recorder is closed by the `aftermath` test at the END of this file.
// CORRECTION (R3, 2026-10-27): an earlier version of this comment claimed a top-level
// after() is «silently NEVER run by node --test on this Node version» — that blanket
// claim is WRONG: an isolated describe+after file on this exact runtime fired the
// hook. What stands: the original full-suite hang was never attributed to a cause
// (the probe does not establish one), and this file keeps the ordered-last-test
// closure anyway — it is ordering-enforced by the suite layout and proven to execute
// by every run; no rework of the recorder/cleanup mechanism is needed or made.

// ---------------------------------------------------------------------------
// Fixture factory + real-CLI runners.
// ---------------------------------------------------------------------------
function makeFixture(t) {
  const base = mkdtempSync(join(tmpdir(), 'a1-matrix-'));
  if (t) t.after(() => rmSync(base, { recursive: true, force: true }));
  const repo = join(base, 'repo');
  mkdirSync(join(repo, '.git'), { recursive: true });
  const home = join(base, 'feature-home');
  mkdirSync(home, { recursive: true });
  const stageRoot = join(repo, 'artifacts', STAGE); // INSIDE the repo — the stage-ownership gate requires it
  mkdirSync(stageRoot, { recursive: true });
  const prd = '# PRD\nmatrix fixture\n';
  const prdApproval = JSON.stringify({ approved: true, feature: FID }, null, 2);
  const spec = '# SPEC\nmatrix fixture\n';
  const specAgreement = JSON.stringify({ agreed: true, note: 'operator agreement fixture' }, null, 2);
  writeFileSync(join(repo, 'prd.md'), prd);
  writeFileSync(join(repo, 'prd-approval.json'), prdApproval);
  writeFileSync(join(repo, 'spec.md'), spec);
  writeFileSync(join(repo, 'spec-agreement.json'), specAgreement);
  const ref = (path, bytes) => ({ path, sha256: sha256Hex(bytes) });
  const selector = {
    version: 1,
    repoIdentity: realpathSync(join(repo, '.git')),
    features: {
      [FID]: {
        revision: 1,
        history: [],
        currentPrd: { approvedSha256: sha256Hex(prd), snapshotRef: ref('prd.md', prd), approvalRecordRef: ref('prd-approval.json', prdApproval) },
        currentSpec: { parentPrdSha256: sha256Hex(prd), specRef: ref('spec.md', spec), agreementRecordRef: ref('spec-agreement.json', specAgreement) },
      },
    },
  };
  const selectorPath = join(home, 'current-decisions.json');
  writeFileSync(selectorPath, JSON.stringify(selector, null, 2));
  return {
    base, repo, home, stageRoot, selectorPath,
    recordPath: join(stageRoot, 'binding.json'),
    prdBytes: prd,
    bumpSelector(to) {
      const doc = JSON.parse(readFileSync(selectorPath, 'utf8'));
      doc.features[FID].revision = to;
      writeFileSync(selectorPath, JSON.stringify(doc, null, 2));
    },
  };
}

function runCli(args, extraEnv = {}) {
  const res = spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...RECORDER_ENV, ...extraEnv },
  });
  let json = null;
  try { json = JSON.parse(res.stdout); } catch { /* callers assert on shape */ }
  return { status: res.status, signal: res.signal, json, stdout: res.stdout, stderr: res.stderr };
}

/** Async spawn for SIGKILL / interleaving rows — returns the child plus a done() promise. */
function spawnCli(args, extraEnv = {}) {
  const child = spawn(process.execPath, [CLI, ...args], {
    env: { ...process.env, ...RECORDER_ENV, ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  return {
    child,
    done: (async () => {
      const [code, sig] = await once(child, 'exit');
      let json = null;
      try { json = JSON.parse(stdout); } catch { /* killed children emit nothing */ }
      return { code, signal: sig, json, stdout, stderr };
    })(),
  };
}

function initArgs(fx, extra = [], recordPath = fx.recordPath) {
  return [
    'init',
    '--record', recordPath,
    '--repo-root', fx.repo,
    '--feature', FID,
    '--stage', STAGE,
    '--stage-artifact-root', fx.stageRoot,
    '--feature-home', fx.home,
    '--actions', 'observe,work,review,hold,complete',
    '--destination', 'pr:staging',
    '--now', iso(),
    ...extra,
  ];
}

function recArgs(fx, extra = []) {
  return [
    'reconcile',
    '--record', fx.recordPath,
    '--repo-root', fx.repo,
    '--feature-home', fx.home,
    '--now', iso(),
    ...extra,
  ];
}

const tmpFiles = (dir) => readdirSync(dir).filter((name) => name.includes('.tmp-'));
const obs = (observationId, kind, extra = {}) => JSON.stringify({ taskId: 't-1', kind, observationId, ...extra });
const EVIDENCE = 'verified externally: the tracker shows the effect landed (matrix fixture evidence)';
// Fidelity-r1 F-1 fixture material: a genuinely SOURCED evidence artifact — real bytes
// written under the stage artifact root (the first evidence root the engine resolves
// against) and hashed from those bytes. The engine verifies the digest at the boundary;
// the fixture never asserts an outcome it did not materialize. (The narrative constant
// EVIDENCE stays as the caller's account, which the engine requires alongside the ref.)
const evidenceArtifact = (fx, name, body) => {
  const bytes = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
  writeFileSync(join(fx.stageRoot, name), bytes);
  return { path: name, sha256: sha256Hex(bytes) };
};
// Fidelity-r2 fixture: the 'complete' control state is UNREACHABLE through any stage-A
// production path — both completion doors refuse every delivery (fidelity-r2 F-1), so
// no CLI/library sequence terminates a record any more. The terminal-identity arms
// (R4-01) therefore seed a completed record through the PURE record layer
// (initialRecord-driven real init + applyControlTransition + writeRecordAtomic — the
// same already-trusted-seed pattern the HOST-01 host-independent arms use), keeping the
// candidate_terminal_conflict gate covered WITHOUT claiming any stage-A input reached
// the state. The delivery is hand-shaped and unverified — exactly the claim data a
// stage-A record can durably carry while the stage-B live-read capability is pending.
const seedCompletedRecord = (fx, { receipt = 'receipt-c1', candidateRevision = 1 } = {}) => {
  const run = runCli(initArgs(fx, ['--task-id', 't-1',
    '--candidate-revision', String(candidateRevision), '--candidate-sha256', sha256Hex(`c${candidateRevision}`)]));
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const record = JSON.parse(readFileSync(fx.recordPath, 'utf8'));
  record.delivery = {
    receipt,
    destination: 'pr:staging',
    at: iso(),
    actionId: null,
    candidateRevision,
    verified: false,
    evidence: null,
  };
  const completed = applyControlTransition(record, { kind: 'complete', actor: 'matrix:fixture', now: iso() });
  assert.ok(completed.ok, JSON.stringify(completed));
  assert.equal(completed.value.controlState, 'complete');
  const lockedTarget = resolveRecordTarget(canonicalRecordPath(fx.recordPath));
  assert.ok(lockedTarget !== null, 'the seeded record path has a resolvable canonical lock target');
  const written = writeRecordAtomic(fx.recordPath, completed.value, { lockedTarget, expectedRevision: record.recordRevision });
  assert.ok(written.ok, JSON.stringify(written));
  return completed.value;
};

// ===========================================================================
// Row 1 — init + valid reconcile, unchanged authority; revisions monotonic.
// ===========================================================================
describe('row 1 — init + valid reconcile', () => {
  ltest('init binds with live-verifiable authority; envelope reports the work route', async () => {
    const t = makeFixture(null);
    const res = runCli(initArgs(t, ['--task-id', 't-1']));
    assert.equal(res.status, 0, res.stdout + res.stderr);
    assert.equal(res.json.ok, true);
    assert.equal(res.json.controlState, 'active');
    assert.equal(res.json.recordRevision, 1);
    assert.equal(res.json.controlRevision, 1);
    assert.equal(res.json.custodyGeneration, 1);
    assert.equal(res.json.route, 'work');
    assert.deepEqual(res.json.holds, []);
    const st = runCli(['status', '--record', t.recordPath]);
    assert.equal(st.status, 0);
    assert.equal(st.json.record.authority.selectorRevision, 1);
    assert.equal(st.json.record.authority.prdSha256, sha256Hex(t.prdBytes));
    assert.equal(st.json.record.aif.taskId, 't-1');
    rmSync(t.base, { recursive: true, force: true });
  });

  ltest('valid reconcile with unchanged authority: no mutation, no holds, route from durable state', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t, ['--task-id', 't-1']));
    const res = runCli(recArgs(t));
    assert.equal(res.status, 0, res.stdout + res.stderr);
    assert.equal(res.json.mutated, false);
    assert.equal(res.json.recordRevision, 1, 'a no-op reconcile must not burn a revision');
    assert.equal(res.json.route, 'observe'); // task bound; awaiting first observation
    assert.deepEqual(res.json.holds, []);
    rmSync(t.base, { recursive: true, force: true });
  });

  ltest('re-init on a bound record fails closed (revision must-not-exist arm)', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t));
    const res = runCli(initArgs(t));
    assert.equal(res.status, 2);
    assert.equal(res.json.code, 'record_already_bound');
    rmSync(t.base, { recursive: true, force: true });
  });

  ltest('revisions are strictly monotonic across a mutating sequence', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t, ['--task-id', 't-1']));
    const seen = [1];
    const track = (res, label) => {
      assert.equal(res.status, 0, `${label}: ${res.stdout} ${res.stderr}`);
      assert.ok(res.json.recordRevision > seen[seen.length - 1], `${label}: revision must advance (got ${res.json.recordRevision})`);
      seen.push(res.json.recordRevision);
    };
    track(runCli(recArgs(t, ['--observation', obs('o-1', 'done')])), 'observation');
    track(runCli(recArgs(t, ['--candidate-revision', '3', '--candidate-sha256', sha256Hex('c3')])), 'candidate');
    track(runCli(['pause', '--record', t.recordPath, '--now', iso()]), 'pause');
    track(runCli(recArgs(t, ['--delivery-receipt', 'receipt-r1'])), 'receipt');
    const noop = runCli(recArgs(t));
    assert.equal(noop.status, 0);
    assert.equal(noop.json.recordRevision, seen[seen.length - 1], 'no-op reconcile must not advance the revision');
    rmSync(t.base, { recursive: true, force: true });
  });
});

// ===========================================================================
// Row 2 — authority change: hold authority_changed; stale evidence never current.
// ===========================================================================
describe('row 2 — authority change holds admission', () => {
  ltest('selector revision advance → authority_changed hold; record authority refreshed to live', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t));
    t.bumpSelector(2);
    const res = runCli(recArgs(t));
    assert.equal(res.status, 0, res.stdout + res.stderr);
    assert.equal(res.json.route, 'hold');
    assert.equal(res.json.routeReason, 'authority_changed_requires_confirmation');
    const open = res.json.holds.filter((h) => h.clearedAt === null);
    assert.ok(open.some((h) => h.code === 'authority_changed'), JSON.stringify(res.json.holds));
    const st = runCli(['status', '--record', t.recordPath]);
    assert.equal(st.json.record.authority.selectorRevision, 2, 'the cached authority is refreshed to the live read, never kept stale');
    rmSync(t.base, { recursive: true, force: true });
  });

  ltest('stale evidence is never treated as current: an open authority hold blocks new action admission', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t));
    t.bumpSelector(2);
    runCli(recArgs(t)); // opens the authority_changed hold
    const res = runCli(recArgs(t, ['--request-action', 'work']));
    assert.equal(res.status, 2);
    assert.equal(res.json.code, 'authority_hold_open', JSON.stringify(res.json));
    const st = runCli(['status', '--record', t.recordPath]);
    assert.equal(st.json.record.pendingIntent, null, 'no intent may be persisted against unconfirmed authority');
    rmSync(t.base, { recursive: true, force: true });
  });

  ltest('hold clears on the next stable read; admission resumes only after it clears', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t));
    t.bumpSelector(2);
    runCli(recArgs(t));
    const stable = runCli(recArgs(t));
    assert.equal(stable.status, 0);
    assert.ok(stable.json.effects.includes('authority-stable'), JSON.stringify(stable.json.effects));
    assert.deepEqual(stable.json.holds, []);
    const admitted = runCli(recArgs(t, ['--request-action', 'work']));
    assert.equal(admitted.status, 0, admitted.stdout);
    assert.ok(admitted.json.pendingIntent && admitted.json.pendingIntent.state === 'intent_persisted');
    rmSync(t.base, { recursive: true, force: true });
  });

  ltest('unresolvable authority → authority_unavailable hold; admission blocked; recovery action names the fix', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t));
    rmSync(t.selectorPath); // the live selector disappears
    const res = runCli(recArgs(t));
    assert.equal(res.status, 0, res.stdout + res.stderr); // the hold is recorded, not thrown
    const open = res.json.holds.filter((h) => h.clearedAt === null);
    assert.ok(open.some((h) => h.code === 'authority_unavailable'), JSON.stringify(res.json.holds));
    assert.ok(open.every((h) => h.recoveryAction && h.recoveryAction.length > 20), 'every hold carries a concrete recovery action');
    const blocked = runCli(recArgs(t, ['--request-action', 'work']));
    assert.equal(blocked.status, 2);
    assert.equal(blocked.json.code, 'authority_hold_open');
    rmSync(t.base, { recursive: true, force: true });
  });

  ltest('authority_unavailable recovers: the stable read clears the hold; admission resumes on the NEXT reconcile', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t));
    const selectorBytes = readFileSync(t.selectorPath, 'utf8');
    rmSync(t.selectorPath); // the live selector disappears → authority_unavailable
    const failed = runCli(recArgs(t));
    assert.equal(failed.status, 0, failed.stdout + failed.stderr);
    assert.ok(failed.json.holds.some((h) => h.code === 'authority_unavailable' && h.clearedAt === null));
    // Recovery: restore the selector — a stable read CLEARS the hold (its recoveryAction
    // promised exactly this), but the clearing pass must not also admit work.
    writeFileSync(t.selectorPath, selectorBytes);
    const recovered = runCli(recArgs(t));
    assert.equal(recovered.status, 0, recovered.stdout + recovered.stderr);
    assert.ok(recovered.json.effects.includes('authority-stable'), JSON.stringify(recovered.json.effects));
    assert.deepEqual(recovered.json.holds.filter((h) => h.clearedAt === null), [], JSON.stringify(recovered.json.holds));
    const admitted = runCli(recArgs(t, ['--request-action', 'work']));
    assert.equal(admitted.status, 0, admitted.stdout + admitted.stderr);
    assert.ok(admitted.json.pendingIntent && admitted.json.pendingIntent.state === 'intent_persisted');
    rmSync(t.base, { recursive: true, force: true });
  });
});

// ===========================================================================
// Row 3 — concurrent transitions: two real processes; no lost update.
// ===========================================================================
describe('row 3 — concurrent transitions across real processes', () => {
  ltest('two overlapping reconciles serialize on the bind lock; both effects land, revisions advance twice', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t, ['--task-id', 't-1']));
    const holdMs = '400';
    const a = spawnCli(recArgs(t, ['--observation', obs('race-a', 'done'), '--test-hold-lock-ms', holdMs]));
    const b = spawnCli(recArgs(t, ['--observation', obs('race-b', 'parked'), '--test-hold-lock-ms', holdMs]));
    const [ra, rb] = await Promise.all([a.done, b.done]);
    assert.equal(ra.code, 0, ra.stdout + ra.stderr);
    assert.equal(rb.code, 0, rb.stdout + rb.stderr);
    const st = runCli(['status', '--record', t.recordPath]);
    const ids = st.json.record.observations.map((o) => o.observationId).sort();
    assert.deepEqual(ids, ['race-a', 'race-b'], 'no lost update: both serialized writes are present');
    assert.equal(st.json.record.recordRevision, 3, 'init 1 → two serialized durable writes: revision 3');
    rmSync(t.base, { recursive: true, force: true });
  });

  ltest('a short-budget acquirer loses with lock_contended and writes nothing (never a takeover)', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t, ['--task-id', 't-1']));
    const holder = spawnCli(recArgs(t, ['--observation', obs('hold-a', 'done'), '--test-hold-lock-ms', '900']));
    await sleep(350); // holder is inside its critical section
    const loser = spawnCli(recArgs(t, ['--observation', obs('hold-b', 'parked'), '--lock-retry-budget-ms', '150']));
    const [rh, rl] = await Promise.all([holder.done, loser.done]);
    assert.equal(rh.code, 0, rh.stdout + rh.stderr);
    assert.equal(rl.code, 2);
    assert.equal(rl.json.code, 'lock_contended', JSON.stringify(rl.json));
    assert.match(rl.json.reason, /never a takeover/);
    const st = runCli(['status', '--record', t.recordPath]);
    const ids = st.json.record.observations.map((o) => o.observationId);
    assert.deepEqual(ids, ['hold-a']);
    assert.equal(st.json.record.recordRevision, 2);
    rmSync(t.base, { recursive: true, force: true });
  });

  ltest('revision-check backstop (library arm): two writers against one revision → record_revision_conflict', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t));
    const read = readRecord(canonicalRecordPath(t.recordPath));
    assert.ok(read.ok);
    const canonical = canonicalRecordPath(t.recordPath);
    const staleCopy = structuredClone(read.record);
    staleCopy.recordRevision += 1;
    staleCopy.updatedAt = iso();
    const first = writeRecordAtomic(canonical, staleCopy, { lockedTarget: canonical, expectedRevision: read.record.recordRevision });
    assert.ok(first.ok, JSON.stringify(first));
    const second = writeRecordAtomic(canonical, staleCopy, { lockedTarget: canonical, expectedRevision: read.record.recordRevision });
    assert.equal(second.ok, false);
    assert.equal(second.code, 'record_revision_conflict');
    rmSync(t.base, { recursive: true, force: true });
  });
});

// ===========================================================================
// Row 4 — crash windows (prewrite / intent / commit) + row 10 recovery action.
// ===========================================================================
describe('row 4 — crash windows across the durable-write boundary', () => {
  ltest('prewrite SIGKILL: no partial record, no pending intent, no tmp residue', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t));
    const before = fileSha(t.recordPath);
    const crasher = spawnCli(recArgs(t, ['--request-action', 'work', '--test-crash-after', 'prewrite']));
    const r = await crasher.done;
    assert.equal(r.signal, 'SIGKILL');
    assert.equal(fileSha(t.recordPath), before, 'a crash before the durable write must leave the record byte-identical');
    const st = runCli(['status', '--record', t.recordPath]);
    assert.equal(st.json.record.pendingIntent, null);
    assert.equal(st.json.record.recordRevision, 1);
    assert.deepEqual(tmpFiles(t.stageRoot), []);
    rmSync(t.base, { recursive: true, force: true });
  });

  ltest('intent-persisted SIGKILL: intent IS durable; restart classifies uncertain_owner with a concrete recovery action (rows 4+10)', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t));
    const crasher = spawnCli(recArgs(t, ['--request-action', 'work', '--test-crash-after', 'intent']));
    const r = await crasher.done;
    assert.equal(r.signal, 'SIGKILL');
    const st = runCli(['status', '--record', t.recordPath]);
    const intent = st.json.record.pendingIntent;
    assert.ok(intent && intent.state === 'intent_persisted', 'the intent must survive the crash — that is the whole protocol');
    assert.equal(st.json.record.recordRevision, 2);

    // Restart classification: uncertain_owner hold, concrete recovery action, no new intent.
    const restart = runCli(recArgs(t));
    assert.equal(restart.status, 0, restart.stdout + restart.stderr);
    assert.equal(restart.json.route, 'hold');
    assert.equal(restart.json.routeReason, 'intent_outcome_uncertain');
    const open = restart.json.holds.filter((h) => h.clearedAt === null);
    assert.ok(open.some((h) => h.code === 'uncertain_owner'), JSON.stringify(restart.json.holds));
    const hold = open.find((h) => h.code === 'uncertain_owner');
    // Fidelity-r2 F-1: the recovery action names the actual independent read the outcome
    // needs (a stage-B live-read capability), not a caller-side citation incantation.
    assert.match(hold.recoveryAction, new RegExp(`action ${intent.actionId}`));
    assert.match(hold.recoveryAction, /independent read/);
    assert.equal(restart.json.pendingIntent.actionId, intent.actionId, 'no duplicate action-identity re-issue');

    // A second request while unresolved is refused — the SAME identity stays open.
    const reRequest = runCli(recArgs(t, ['--request-action', 'work']));
    assert.equal(reRequest.status, 2);
    assert.equal(reRequest.json.code, 'intent_outstanding');
    const again = runCli(['status', '--record', t.recordPath]);
    assert.equal(again.json.record.pendingIntent.actionId, intent.actionId);

    // INVALIDATED POSITIVE (fidelity-r2 F-1): the r1 arm asserted that a narrative plus a
    // digest-verifying content reference (the repo's real approval record, resolved
    // through the repository root) RESOLVES the intent and clears the hold. The fidelity-r2
    // audit showed that reference authenticates caller-chosen bytes only — the repo's
    // approval record is not a fact about THIS action's outcome in the referenced
    // subsystem — so the resolved-intent state was fabricated. The repair refuses every
    // stage-A resolution attempt; the hold stays open as the explicit prerequisite.
    const approvalBytes = readFileSync(join(t.repo, 'prd-approval.json'));
    const resolved = runCli(recArgs(t, ['--resolve-intent', intent.actionId, '--resolution', 'applied', '--evidence', EVIDENCE,
      '--evidence-ref', 'prd-approval.json', '--evidence-sha256', sha256Hex(approvalBytes)]));
    assert.equal(resolved.status, 2);
    assert.equal(resolved.json.code, 'intent_resolution_unverified');
    assert.match(resolved.json.reason, /authenticates as bytes/);
    const afterResolve = runCli(['status', '--record', t.recordPath]);
    assert.equal(afterResolve.json.record.pendingIntent.state, 'intent_persisted', 'the intent stays unresolved — no stage-A input releases it');
    const stillOpen = afterResolve.json.record.holds.filter((h) => h.code === 'uncertain_owner' && h.clearedAt === null);
    assert.ok(stillOpen.length >= 1, 'the uncertain_owner hold is the honest prerequisite and stays open');
    rmSync(t.base, { recursive: true, force: true });
  });

  ltest('commit SIGKILL: the effect is durable and re-reconciling is idempotent (no duplicate observation, no duplicate delivery)', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t, ['--task-id', 't-1']));
    const crasher = spawnCli(recArgs(t, ['--observation', obs('c-1', 'done'), '--delivery-receipt', 'receipt-c1', '--test-crash-after', 'commit']));
    const r = await crasher.done;
    assert.equal(r.signal, 'SIGKILL');
    const st = runCli(['status', '--record', t.recordPath]);
    assert.equal(st.json.record.observations.length, 1, 'the committed write is durable');
    assert.equal(st.json.record.delivery.receipt, 'receipt-c1');
    const afterRev = st.json.record.recordRevision;

    const idempotent = runCli(recArgs(t));
    assert.equal(idempotent.status, 0);
    assert.equal(idempotent.json.mutated, false);
    assert.equal(idempotent.json.recordRevision, afterRev, 'idempotent reconcile burns no revision');

    const dup = runCli(recArgs(t, ['--delivery-receipt', 'receipt-c1']));
    assert.equal(dup.status, 0, dup.stdout + dup.stderr);
    assert.ok(dup.json.effects.includes('delivery-duplicate-ack'), JSON.stringify(dup.json.effects));
    assert.equal(dup.json.mutated, false, 'identical receipt is an idempotent re-ack, not a second delivery');
    const st2 = runCli(['status', '--record', t.recordPath]);
    assert.equal(st2.json.record.observations.length, 1);
    assert.equal(st2.json.record.recordRevision, afterRev);
    rmSync(t.base, { recursive: true, force: true });
  });

  ltest('a second, DIFFERENT receipt while one is recorded is a rejected duplicate delivery', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t, ['--task-id', 't-1']));
    runCli(recArgs(t, ['--delivery-receipt', 'receipt-first']));
    const res = runCli(recArgs(t, ['--delivery-receipt', 'receipt-second']));
    assert.equal(res.status, 2);
    assert.equal(res.json.code, 'delivery_conflict');
    assert.match(res.json.reason, /duplicate delivery/);
    const st = runCli(['status', '--record', t.recordPath]);
    assert.equal(st.json.record.delivery.receipt, 'receipt-first', 'the recorded delivery wins');
    rmSync(t.base, { recursive: true, force: true });
  });
});

// ===========================================================================
// Row 5 — disconnected worker: wait ≠ cessation (T-AUT-B).
// ===========================================================================
describe('row 5 — disconnected worker reports are data, not failure verdicts', () => {
  for (const kind of ['timeout', 'unknown', 'error']) {
    ltest(`observation kind ${kind}: routed to hold, custody/control/cessation untouched`, async () => {
      const t = makeFixture(null);
      runCli(initArgs(t, ['--task-id', 't-1', '--worker-session', 'w-1', '--worker-pid', '999999']));
      const res = runCli(recArgs(t, ['--observation', obs(`o-${kind}`, kind)]));
      assert.equal(res.status, 0, res.stdout + res.stderr);
      assert.equal(res.json.route, 'hold');
      assert.equal(res.json.routeReason, `worker_report_${kind}`);
      assert.equal(res.json.controlState, 'active');
      assert.equal(res.json.custodyGeneration, 1, 'an observation never mutates custody');
      const st = runCli(['status', '--record', t.recordPath]);
      assert.equal(st.json.record.worker.cessationAckedAt, null, 'wait is NOT cessation (T-AUT-B): nothing acked a death');
      assert.equal(st.json.record.controlState, 'active');
      assert.deepEqual(st.json.record.holds.filter((h) => h.clearedAt === null), [], 'no worker-failure hold may exist');
      rmSync(t.base, { recursive: true, force: true });
    });
  }
});

// ===========================================================================
// Row 6 — duplicate report: idempotent ack by exact identity.
// ===========================================================================
describe('row 6 — duplicate report', () => {
  ltest('the same observationId re-reported is disposition duplicate; one stored entry; no revision burned', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t, ['--task-id', 't-1']));
    const first = runCli(recArgs(t, ['--observation', obs('dup-1', 'done', { resultRef: 'r/1' })]));
    assert.equal(first.status, 0);
    assert.equal(first.json.observationDisposition, 'consumed');
    assert.equal(first.json.recordRevision, 2);
    const second = runCli(recArgs(t, ['--observation', obs('dup-1', 'done', { resultRef: 'r/1' })]));
    assert.equal(second.status, 0);
    assert.equal(second.json.observationDisposition, 'duplicate');
    assert.equal(second.json.mutated, false);
    assert.equal(second.json.recordRevision, 2, 'duplicate re-report burns no revision');
    const st = runCli(['status', '--record', t.recordPath]);
    assert.equal(st.json.record.observations.length, 1, 'exactly one stored entry for the fact');
    rmSync(t.base, { recursive: true, force: true });
  });
});

// ===========================================================================
// Row 7 — late report after pause and after cancel.
// ===========================================================================
describe('row 7 — late results never clear an explicit pause/cancel', () => {
  ltest('late report while pause-pending: recorded historical; control stays pending; admission blocked', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t, ['--task-id', 't-1', '--worker-session', 'w-1']));
    const pause = runCli(['pause', '--record', t.recordPath, '--control-reason', 'operator pause (matrix)', '--now', iso()]);
    assert.equal(pause.status, 0);
    assert.equal(pause.json.controlState, 'pause-pending', 'a live worker must acknowledge cessation first');
    const late = runCli(recArgs(t, ['--observation', obs('late-1', 'done')]));
    assert.equal(late.status, 0);
    assert.equal(late.json.observationDisposition, 'historical-after-pause');
    assert.equal(late.json.controlState, 'pause-pending', 'a late done must NOT clear the pause');
    assert.equal(late.json.routeReason, 'control_state_pause-pending');
    const denied = runCli(recArgs(t, ['--request-action', 'work']));
    assert.equal(denied.status, 2);
    assert.equal(denied.json.code, 'admission_blocked');
    rmSync(t.base, { recursive: true, force: true });
  });

  ltest('late report while paused: recorded historical; control stays paused', async () => {
    const t = makeFixture(null);
    // Fidelity-r1 F-2 control: NO bound AIF task and no live worker — the truly-empty
    // binding where a pause lands `paused` directly. A record with a BOUND task defers
    // the pause to cessation acknowledgement (pause-pending); that case is the fidelity
    // block's F-2 arm, not this one.
    runCli(initArgs(t));
    runCli(['pause', '--record', t.recordPath, '--control-reason', 'operator pause, no worker bound', '--now', iso()]);
    const late = runCli(recArgs(t, ['--observation', obs('late-2', 'done')]));
    assert.equal(late.json.observationDisposition, 'historical-after-pause');
    const st = runCli(['status', '--record', t.recordPath]);
    assert.equal(st.json.record.controlState, 'paused');
    assert.equal(st.json.record.disposition, 'paused');
    rmSync(t.base, { recursive: true, force: true });
  });

  ltest('late report after cancel: recorded historical; terminal state holds; nothing reopens it', async () => {
    const t = makeFixture(null);
    // Fidelity-r1 F-2 control: truly-empty binding (no bound task, no worker) — the
    // cancel lands `cancelled` directly; the task-bound variant defers to the ack door
    // and is the fidelity block's F-2 arm.
    runCli(initArgs(t));
    const cancel = runCli(['cancel', '--record', t.recordPath, '--control-reason', 'operator cancel (matrix)', '--now', iso()]);
    assert.equal(cancel.status, 0);
    assert.equal(cancel.json.controlState, 'cancelled');
    const late = runCli(recArgs(t, ['--observation', obs('late-3', 'done')]));
    assert.equal(late.status, 0);
    assert.equal(late.json.observationDisposition, 'historical-after-cancel');
    assert.equal(late.json.controlState, 'cancelled');
    const denied = runCli(recArgs(t, ['--request-action', 'work']));
    assert.equal(denied.status, 2);
    assert.equal(denied.json.code, 'admission_blocked');
    const rePause = runCli(['pause', '--record', t.recordPath, '--now', iso()]);
    assert.equal(rePause.status, 2);
    assert.equal(rePause.json.code, 'control_state_terminal');
    rmSync(t.base, { recursive: true, force: true });
  });
});

// ===========================================================================
// Row 8 — stale candidate / stale custody generation.
// ===========================================================================
describe('row 8 — stale candidate and custody are rejected, never merged', () => {
  ltest('candidate regression rejected; record keeps the newer candidate', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t, ['--candidate-revision', '1', '--candidate-sha256', sha256Hex('c1')]));
    const fwd = runCli(recArgs(t, ['--candidate-revision', '3', '--candidate-sha256', sha256Hex('c3')]));
    assert.equal(fwd.status, 0);
    assert.ok(fwd.json.effects.includes('candidate-updated:3'), JSON.stringify(fwd.json.effects));
    const back = runCli(recArgs(t, ['--candidate-revision', '2', '--candidate-sha256', sha256Hex('c2')]));
    assert.equal(back.status, 2);
    assert.equal(back.json.code, 'candidate_regression');
    const st = runCli(['status', '--record', t.recordPath]);
    assert.equal(st.json.record.candidate.revision, 3);
    assert.equal(st.json.record.candidate.sha256, sha256Hex('c3'));
    rmSync(t.base, { recursive: true, force: true });
  });

  ltest('same-revision candidate with different bytes updates nothing', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t, ['--candidate-revision', '1', '--candidate-sha256', sha256Hex('c1')]));
    const res = runCli(recArgs(t, ['--candidate-revision', '1', '--candidate-sha256', sha256Hex('other')]));
    assert.equal(res.status, 0);
    assert.equal(res.json.mutated, false);
    const st = runCli(['status', '--record', t.recordPath]);
    assert.equal(st.json.record.candidate.sha256, sha256Hex('c1'));
    rmSync(t.base, { recursive: true, force: true });
  });

  ltest('stale custody generation (library arm): superseded worker reporting late is historical-stale-custody', async () => {
    const t = makeFixture(null);
    const bound = await initBinding(initBindingInput(t));
    assert.ok(bound.ok, JSON.stringify(bound));
    assert.equal(bound.custodyGeneration, 1);
    // Explicit valid transfer past a live worker (acknowledgeCessation) — generation 1 → 2.
    const transferred = await reconcile({ ...reconcileInput(t), transferCustody: { toSession: 'w-2', acknowledgeCessation: true, reason: 'explicit valid transfer past the live worker' } });
    assert.ok(transferred.ok, JSON.stringify(transferred));
    assert.equal(transferred.custodyGeneration, 2);
    // The superseded worker now reports with its OLD custody generation.
    const stale = await reconcile({ ...reconcileInput(t), observation: { taskId: 't-1', kind: 'done', observationId: 'old-w1', custodyGeneration: 1 } });
    assert.ok(stale.ok, JSON.stringify(stale));
    assert.equal(stale.observationDisposition, 'historical-stale-custody');
    assert.equal(stale.custodyGeneration, 2, 'no merge: custody stays at the current generation');
    // And a transfer WITHOUT the explicit ack against a live worker is refused.
    const t2 = makeFixture(null);
    await initBinding(initBindingInput(t2));
    const blocked = await reconcile({ ...reconcileInput(t2), transferCustody: { toSession: 'w-9', reason: 'no ack supplied' } });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.code, 'custody_transfer_blocked');
    assert.match(blocked.reason, /cannot prove external-worker cessation/);
    rmSync(t.base, { recursive: true, force: true });
    rmSync(t2.base, { recursive: true, force: true });
  });
});

// ===========================================================================
// Row 9 — control lifecycle + worker output cannot override a denied action.
// ===========================================================================
describe('row 9 — control gate: worker output carries no control authority', () => {
  ltest('observation payload fields beyond the known schema are dropped, not ingested', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t, ['--task-id', 't-1']));
    const sneaky = JSON.stringify({ taskId: 't-1', kind: 'done', observationId: 'sneaky-1', command: 'resume', control: 'cancelled', actions: ['work'], grant: { action: 'resume' } });
    const res = runCli(recArgs(t, ['--observation', sneaky]));
    assert.equal(res.status, 0);
    const st = runCli(['status', '--record', t.recordPath]);
    const stored = st.json.record.observations.find((o) => o.observationId === 'sneaky-1');
    assert.ok(stored);
    assert.deepEqual(Object.keys(stored).sort(), ['applicableCandidate', 'applicableCustody', 'candidateRevision', 'custodyGeneration', 'disposition', 'kind', 'observationId', 'reason', 'receivedAt', 'resultRef', 'status', 'taskId'], 'only whitelisted fields are stored — injected control/grant fields vanish (applicableCustody/applicableCandidate are the engine-stamped R2-01 ingestion-time applicability)');
    assert.equal(stored.command, undefined);
    assert.equal(stored.grant, undefined);
    assert.equal(st.json.record.controlState, 'active', 'the payload changed no control state');
    rmSync(t.base, { recursive: true, force: true });
  });

  ltest('an action outside the fixed init grant list is refused — no flag extends the grant', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t, ['--actions', 'observe,hold']));
    const res = runCli(recArgs(t, ['--request-action', 'work']));
    assert.equal(res.status, 2);
    assert.equal(res.json.code, 'action_not_granted');
    assert.match(res.json.reason, /fixed at init/);
    rmSync(t.base, { recursive: true, force: true });
  });

  ltest('completion requires a recorded delivery receipt (a routing answer is not a completed effect)', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t, ['--task-id', 't-1']));
    const res = runCli(recArgs(t, ['--mark-complete']));
    assert.equal(res.status, 2);
    assert.equal(res.json.code, 'complete_requires_delivery_receipt');
    // INVALIDATED POSITIVE (fidelity-r2 F-1): the r1 positive leg completed on a SOURCED
    // receipt (a digest-verifying content reference). The r2 audit showed that reference
    // authenticates caller-chosen bytes only — the fixture's own «delivered: true» JSON
    // is not a fact that the candidate reached the destination — so the completion was
    // fabricated. The repair records the delivery UNVERIFIED (effect
    // delivery-recorded-unverified, persisted delivery_evidence_unverified hold) and both
    // completion doors stay closed; there is no 'complete' state to reach in stage A.
    const delivery = evidenceArtifact(t, 'delivery-ok.json', { delivered: true, receipt: 'receipt-ok' });
    const ok = runCli(recArgs(t, ['--delivery-receipt', 'receipt-ok',
      '--delivery-evidence-ref', delivery.path, '--delivery-evidence-sha256', delivery.sha256,
      '--mark-complete']));
    assert.equal(ok.status, 2);
    assert.equal(ok.json.code, 'delivery_evidence_unverified');
    assert.match(ok.json.reason, /NOT established as a fact/);
    const st = runCli(['status', '--record', t.recordPath]);
    assert.equal(st.json.record.controlState, 'active', 'the refused completion leaves the binding active');
    assert.equal(st.json.record.delivery.verified, false, 'the sourced delivery is recorded UNVERIFIED');
    assert.notEqual(st.json.route, 'complete', 'no stage-A state routes complete (fidelity-r2 F-1)');
    rmSync(t.base, { recursive: true, force: true });
  });

  ltest('state-machine lifecycle (library arms): ack-cessation and custody legality', async () => {
    const t = makeFixture(null);
    const bound = await initBinding(initBindingInput(t));
    assert.ok(bound.ok);
    // ack-cessation from active is illegal — there is nothing whose cessation to acknowledge yet
    const early = await reconcile({ ...reconcileInput(t), control: { kind: 'ack-cessation', actor: 'worker:w-1' } });
    assert.equal(early.ok, false);
    assert.equal(early.code, 'illegal_control_transition');
    const paused = await reconcile({ ...reconcileInput(t), control: { kind: 'pause', actor: 'operator:matrix' } });
    assert.ok(paused.ok, JSON.stringify(paused));
    assert.equal(paused.controlState, 'pause-pending', 'a live worker defers the pause to cessation acknowledgement');
    // Fidelity-r1 F-2: task t-1 is referenced external work — a bare caller ack cannot
    // settle it.
    const bare = await reconcile({ ...reconcileInput(t), control: { kind: 'ack-cessation', actor: 'worker:w-1', reason: 'worker confirms suspension' } });
    assert.equal(bare.ok, false, JSON.stringify(bare));
    assert.equal(bare.code, 'cessation_unconfirmed');
    // INVALIDATED POSITIVE (fidelity-r2 F-2): the r1 arm asserted that a digest-verifying
    // cessation-evidence artifact settles the referenced task's stop. The r2 audit showed
    // the artifact is caller-chosen bytes — file integrity, not the referenced
    // subsystem's actual state — so the settled transition was fabricated. The repair
    // authenticates the citation, then refuses the ack anyway; pause-pending is retained
    // with the persisted prerequisite hold, and only stage B's live read may settle it.
    const acked = await reconcile({ ...reconcileInput(t), control: { kind: 'ack-cessation', actor: 'worker:w-1', reason: 'worker confirms suspension', cessationEvidence: evidenceArtifact(t, 'cessation-t1.json', { task: 't-1', terminal: 'suspended', source: 'aif-runtime' }) } });
    assert.equal(acked.ok, false, JSON.stringify(acked));
    assert.equal(acked.code, 'cessation_unconfirmed');
    const st = runCli(['status', '--record', t.recordPath]);
    assert.equal(st.json.record.controlState, 'pause-pending', 'the pending state is retained');
    assert.equal(st.json.record.worker.cessationAckedAt, null, 'the referenced task\'s stop is not stamped onto the worker');
    assert.equal(st.json.record.aif.cessationConfirmedAt, null, 'no cessation stamp is written — the r2 repair removed the stamp path');
    rmSync(t.base, { recursive: true, force: true });

    // The genuine positive survives: with NO referenced external work (no bound task,
    // no native attempts, no unresolved intent) the worker's OWN acknowledgement settles
    // — the ack is the worker-side input, the one independent mechanism in stage A.
    const t2 = makeFixture(null);
    const bound2 = await initBinding({ ...initBindingInput(t2), taskId: null });
    assert.ok(bound2.ok);
    const paused2 = await reconcile({ ...reconcileInput(t2), control: { kind: 'pause', actor: 'operator:matrix' } });
    assert.equal(paused2.controlState, 'pause-pending');
    const settled = await reconcile({ ...reconcileInput(t2), control: { kind: 'ack-cessation', actor: 'worker:w-1', reason: 'worker confirms its own suspension' } });
    assert.ok(settled.ok, JSON.stringify(settled));
    assert.equal(settled.controlState, 'paused');
    const st2 = runCli(['status', '--record', t2.recordPath]);
    assert.ok(st2.json.record.worker.cessationAckedAt !== null, 'the worker arm still stamps its own ack');
    rmSync(t2.base, { recursive: true, force: true });
  });
});

// ===========================================================================
// Row 11 — real SIGKILL lock release (abstract-socket lock).
// ===========================================================================
describe('row 11 — kernel-held lock: SIGKILL releases immediately, live holders contend', () => {
  ltest('live holder blocks a short-budget acquirer; SIGKILL frees the name for an immediate rebind', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t));
    // 1. A holder is inside its critical section for 8s (will be killed long before).
    const holder = spawnCli(recArgs(t, ['--observation', obs('kill-target', 'parked'), '--test-hold-lock-ms', '8000']));
    await sleep(500);
    // 2. While it lives, a second acquirer gets EADDRINUSE → bounded retry → lock_contended.
    const contender = spawnCli(recArgs(t, ['--observation', obs('while-held', 'parked'), '--lock-retry-budget-ms', '200']));
    const rc = await contender.done;
    assert.equal(rc.code, 2);
    assert.equal(rc.json.code, 'lock_contended', JSON.stringify(rc.json));
    // 3. SIGKILL the holder — no cleanup handlers run; the kernel must free the name.
    holder.child.kill('SIGKILL');
    const rh = await holder.done;
    assert.equal(rh.signal, 'SIGKILL');
    // 4. Rebind IMMEDIATELY — no time-based wait, no probe, no unlink.
    const next = runCli(recArgs(t, ['--observation', obs('after-kill', 'parked')]));
    assert.equal(next.status, 0, next.stdout + next.stderr);
    const st = runCli(['status', '--record', t.recordPath]);
    const ids = st.json.record.observations.map((o) => o.observationId).sort();
    assert.deepEqual(ids, ['after-kill'], 'the killed holder never wrote; the post-kill acquirer did');
    assert.deepEqual(tmpFiles(t.stageRoot), []);
    // 5. The lock is abstract: no filesystem artifact for it, ever.
    assert.deepEqual(readdirSync(t.stageRoot).filter((name) => name.includes('lock')), []);
    rmSync(t.base, { recursive: true, force: true });
  });

  test('static pin: the protocol has no unlink anywhere (the r1 takeover hazard is structurally absent)', () => {
    for (const rel of ['autonomy-binding/lock.mjs', 'autonomy-binding/store.mjs', 'autonomy-binding/engine.mjs']) {
      const body = src(rel);
      assert.ok(!/\bunlink(Sync)?\s*\(/.test(body), `${rel} must not call unlink — recovery-by-deletion is the refuted protocol class (A1-ARCH-01)`);
    }
  });
});

// ===========================================================================
// Row 12 — reserved worker/review verbs: explicit unsupported, never simulated.
// ===========================================================================
describe('row 12 — reserved stage-B verbs', () => {
  for (const verb of ['worker', 'review']) {
    test(`${verb} → unsupported_pending_prerequisite naming stage B; zero record interaction`, async () => {
      const t = makeFixture(null);
      const missingPath = join(t.base, 'never', 'created', 'binding.json');
      const res = runCli([verb, '--record', missingPath, '--now', iso()]);
      assert.equal(res.status, 2);
      assert.equal(res.json.ok, false);
      assert.equal(res.json.code, 'unsupported_pending_prerequisite');
      assert.match(res.json.reason, /stage-B/);
      assert.equal(res.json.route, undefined, 'no simulated-success shape: no route, no revisions');
      assert.equal(res.json.recordRevision, undefined);
      assert.equal(existsSync(missingPath), false, 'the reserved verb must not create or touch a record');
      rmSync(t.base, { recursive: true, force: true });
    });
  }
});

// ===========================================================================
// Row 13 — prohibited effects (dynamic arms; the zero-connection assertion is the
// `aftermath` test at the END of this file — this block runs a full sequence so
// the assertion has teeth).
// ===========================================================================
describe('row 13 — prohibited effects: no model/PR/delivery calls', () => {
  ltest('a full operational sequence runs with every outbound seam pointed at the recorder', async () => {
    const t = makeFixture(null);
    assert.equal(runCli(initArgs(t, ['--task-id', 't-1'])).status, 0);
    assert.equal(runCli(recArgs(t, ['--observation', obs('p-1', 'done')])).status, 0);
    const act = runCli(recArgs(t, ['--request-action', 'work']));
    assert.equal(act.status, 0, act.stdout);
    // INVALIDATED POSITIVE (fidelity-r2 F-1): the r1 sequence resolved the intent with a
    // sourced tracker export (even a not-applied resolution released the uncertainty).
    // The r2 audit withdrew that release — the tracker export is caller-chosen bytes, not
    // a read of the referenced subsystem — so the resolution is refused and the intent
    // stays open; the rest of the sequence exercises the same outbound seams.
    const tracker = evidenceArtifact(t, 'tracker-export.json', { source: 'tracker', effect: 'work', landed: false });
    const resolved = runCli(recArgs(t, ['--resolve-intent', act.json.pendingIntent.actionId, '--resolution', 'not-applied', '--evidence', EVIDENCE,
      '--evidence-ref', tracker.path, '--evidence-sha256', tracker.sha256]));
    assert.equal(resolved.status, 2);
    assert.equal(resolved.json.code, 'intent_resolution_unverified');
    assert.equal(runCli(recArgs(t, ['--candidate-revision', '2', '--candidate-sha256', sha256Hex('p2')])).status, 0);
    assert.equal(runCli(recArgs(t, ['--delivery-receipt', 'receipt-p'])).status, 0);
    assert.equal(runCli(['pause', '--record', t.recordPath, '--now', iso()]).status, 0);
    assert.equal(runCli(['status', '--record', t.recordPath]).status, 0);
    rmSync(t.base, { recursive: true, force: true });
  });

  test('static pin: the six modules import no outbound client and call no connect/fetch', () => {
    for (const rel of MODULE_FILES) {
      const body = src(rel);
      assert.ok(!/from\s+'node:(child_process|http|https|fetch|dns|tls)'/.test(body), `${rel} must not import an outbound client module`);
      assert.ok(!/\bfetch\s*\(/.test(body), `${rel} must not call fetch`);
      assert.ok(!/https?\s*\.\s*request\s*\(/.test(body), `${rel} must not call http(s).request`);
      assert.ok(!/[^.\w]connect\s*\(/.test(body), `${rel} must not open connections — node:net is used listener-only (bind)`);
      assert.ok(!/\b(axios|undici|node-fetch)\b/.test(body), `${rel} must not reference an HTTP client library`);
    }
    const lockBody = src('autonomy-binding/lock.mjs');
    assert.ok(lockBody.includes('createServer'), 'the only node:net use is the bind listener');
  });
});

// ===========================================================================
// Row 14 — store atomicity: record parses after every mutation; no tmp residue.
// ===========================================================================
describe('row 14 — store atomicity under concurrency', () => {
  ltest('six parallel writers serialize; a concurrent reader never sees partial JSON; no tmp residue', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t, ['--task-id', 't-1']));
    const readers = { runs: 0, bad: 0 };
    let reading = true;
    const reader = (async () => {
      while (reading) {
        readers.runs += 1;
        try {
          const raw = readFileSync(t.recordPath, 'utf8');
          const parsed = JSON.parse(raw);
          if (parsed.schemaVersion !== 1) readers.bad += 1; // parses but nonsense → a torn write
        } catch (err) {
          if (err.code !== 'ENOENT') readers.bad += 1; // a complete file that fails to parse = torn write
        }
        await sleep(1);
      }
    })();
    const writers = ['c-1', 'c-2', 'c-3', 'c-4', 'c-5', 'c-6'].map((id) =>
      spawnCli(recArgs(t, ['--observation', obs(id, 'parked')])));
    const results = await Promise.all(writers.map((w) => w.done));
    reading = false;
    await reader;
    for (const r of results) assert.equal(r.code, 0, r.stdout + r.stderr);
    assert.ok(readers.runs > 10, `reader actually ran (runs=${readers.runs})`);
    assert.equal(readers.bad, 0, `a concurrent reader observed ${readers.bad} torn/partial record(s)`);
    const st = runCli(['status', '--record', t.recordPath]);
    assert.equal(st.json.record.observations.length, 6);
    assert.equal(st.json.record.recordRevision, 7, 'six serialized durable writes on top of init');
    assert.deepEqual(tmpFiles(t.stageRoot), []);
    rmSync(t.base, { recursive: true, force: true });
  });
});

// ===========================================================================
// Row 15 — validation unit arms (pure record/store/lock logic).
// ===========================================================================
describe('row 15 — validation unit arms', () => {
  ltest('monotonic revisions: control transitions bump record+control; holds bump record only', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t));
    const st = runCli(['status', '--record', t.recordPath]);
    const record = st.json.record;
    const paused = applyControlTransition(record, { kind: 'pause', actor: 'op', now: iso() });
    assert.ok(paused.ok, JSON.stringify(paused));
    assert.equal(paused.value.recordRevision, record.recordRevision + 1);
    assert.equal(paused.value.controlRevision, record.controlRevision + 1);
    const held = addHold(paused.value, { code: 'x', reason: 'r', recoveryAction: 'do the thing', now: iso() });
    assert.ok(held.ok);
    assert.equal(held.value.recordRevision, paused.value.recordRevision + 1);
    assert.equal(held.value.controlRevision, paused.value.controlRevision, 'holds are not control transitions');
    // recordDigest is stable for identical content (the identity a grant binds).
    assert.equal(recordDigest(record), recordDigest(record));
    assert.notEqual(recordDigest(record), recordDigest(paused.value));
    rmSync(t.base, { recursive: true, force: true });
  });

  test('illegal control transitions reject with exact codes; terminal states never reopen', async () => {
    const good = initialRecord(initRecordFields(), { now: iso() });
    assert.ok(good.ok, JSON.stringify(good));
    // paused-origin record: pause from paused is illegal; resume is not a generic kind;
    // paused has no cancel outbound in the A1 table (the deliberate dead-end).
    const pausedBase = { ...structuredClone(good.value), controlState: 'paused' };
    assert.equal(applyControlTransition(pausedBase, { kind: 'pause', actor: 'op', now: iso() }).code, 'illegal_control_transition');
    assert.equal(applyControlTransition(pausedBase, { kind: 'resume', actor: 'op', now: iso() }).code, 'invalid_transition_kind', 'resume is not reachable through the generic transition');
    assert.equal(applyControlTransition(pausedBase, { kind: 'cancel', actor: 'op', now: iso() }).code, 'illegal_control_transition');
    const terminal = { ...structuredClone(good.value), controlState: 'cancelled', controlRevision: 2 };
    assert.equal(applyControlTransition(terminal, { kind: 'cancel', actor: 'op', now: iso() }).code, 'control_state_terminal');
    assert.deepEqual(TERMINAL_STATES, ['cancelled', 'complete']);
    assert.deepEqual(ADMITTING_STATES, ['active']);
  });

  test('validateRecord gates the read side: fake terminals and bare flags are unreadable', () => {
    const good = initialRecord(initRecordFields(), { now: iso() });
    assert.ok(good.ok, JSON.stringify(good));
    const fakeTerminal = { ...structuredClone(good.value), controlState: 'cancelled' };
    assert.equal(validateRecord(fakeTerminal).code, 'record_invalid', 'a hand-written terminal without a transition is rejected');
    const bareHold = structuredClone(good.value);
    bareHold.holds.push({ code: 'x', reason: 'r', recordedAt: iso(), clearedAt: null }); // no recoveryAction
    assert.equal(validateRecord(bareHold).code, 'record_invalid');
    assert.match(validateRecord(bareHold).reason, /bare flag is not a hold/);
    const badVersion = { ...structuredClone(good.value), schemaVersion: 99 };
    assert.equal(validateRecord(badVersion).code, 'record_version_unsupported');
  });

  ltest('store arms: unreadable/invalid records fail closed; TOCTOU retarget and revision-check mismatches reject', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t));
    writeFileSync(join(t.stageRoot, 'garbage.json'), 'not json at all');
    const garbage = readRecord(join(t.stageRoot, 'garbage.json'));
    assert.equal(garbage.ok, false);
    assert.equal(garbage.code, 'record_unreadable');
    writeFileSync(join(t.stageRoot, 'invalid.json'), JSON.stringify({ schemaVersion: 1 }));
    const invalid = readRecord(join(t.stageRoot, 'invalid.json'));
    assert.equal(invalid.ok, false);
    assert.equal(invalid.code, 'record_invalid', 'a well-formed JSON that fails validateRecord is unreadable, never a fresh bind');

    // TOCTOU: the write target is retargeted to a symlink AFTER the pre-lock resolution.
    const elsewhere = join(t.base, 'elsewhere.json');
    writeFileSync(elsewhere, 'x');
    symlinkSync(elsewhere, join(t.stageRoot, 'retarget.json'));
    const preTarget = resolveRecordTarget(join(t.stageRoot, 'retarget.json'));
    assert.ok(preTarget);
    rmSync(join(t.stageRoot, 'retarget.json'));
    symlinkSync(t.recordPath, join(t.stageRoot, 'retarget.json'));
    const record = readRecord(canonicalRecordPath(t.recordPath));
    const retargeted = writeRecordAtomic(join(t.stageRoot, 'retarget.json'), record.record, { lockedTarget: preTarget, expectedRevision: record.record.recordRevision });
    assert.equal(retargeted.ok, false);
    assert.equal(retargeted.code, 'record_path_retargeted');

    // Revision-check mismatch on the canonical path.
    const stale = writeRecordAtomic(canonicalRecordPath(t.recordPath), record.record, { lockedTarget: canonicalRecordPath(t.recordPath), expectedRevision: record.record.recordRevision + 5 });
    assert.equal(stale.ok, false);
    assert.equal(stale.code, 'record_revision_conflict');

    // Stage ownership: a record outside the stage root is refused.
    const outside = ensureStageOwnership({ recordPath: join(t.base, 'binding.json'), stageArtifactRoot: t.stageRoot, ownerRoot: t.repo });
    assert.equal(outside.ok, false);
    assert.equal(outside.code, 'record_outside_stage_root');
    rmSync(t.base, { recursive: true, force: true });
  });
});

// ===========================================================================
// Row 16 — adversarial recovery race (A1-ARCH-01 interleaving, mapped to the bind lock).
// ===========================================================================
describe('row 16 — adversarial recovery race with staged bind attempts', () => {
  ltest('SIGKILLed holder; A resumes first and wins; B paused-before-bind contends against a live A; no lost revision', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t, ['--task-id', 't-1']));
    const controlBefore = runCli(['status', '--record', t.recordPath]).json.record.controlRevision;

    // Holder takes the lock and is SIGKILLed inside its critical section.
    const holder = spawnCli(recArgs(t, ['--observation', obs('h-1', 'parked'), '--test-hold-lock-ms', '2500']));
    await sleep(400);
    const probe = spawnCli(recArgs(t, ['--lock-retry-budget-ms', '150']));
    const rp = await probe.done;
    assert.equal(rp.json && rp.json.code, 'lock_contended', 'precondition: the holder is provably holding before the kill');
    holder.child.kill('SIGKILL');
    const rHeld = await holder.done;
    assert.equal(rHeld.signal, 'SIGKILL');

    // A and B are both staged BEFORE their bind attempts and released in order. The
    // waitfiles have NO timeout on purpose (a hung waiter is a hung test), so every exit
    // path — assertion failure included — must release them in a finally.
    const waitA = join(t.base, 'wait-a');
    const waitB = join(t.base, 'wait-b');
    const a = spawnCli(recArgs(t, ['--observation', obs('a-1', 'parked'), '--test-hold-before-bind', waitA, '--test-hold-lock-ms', '1500', '--lock-retry-budget-ms', '5000']));
    const b = spawnCli(recArgs(t, ['--observation', obs('b-1', 'parked'), '--test-hold-before-bind', waitB, '--lock-retry-budget-ms', '400']));
    let released = false;
    try {
      await sleep(300); // both are parked in waitForFile, before any bind
      writeFileSync(waitA, 'go');
      await sleep(350); // A has bound (the name was free) and is deliberately held inside its section
      writeFileSync(waitB, 'go'); // B now binds → EADDRINUSE against live A → retries 400ms → contended
      released = true;
    } finally {
      if (!released) { // an assertion fired mid-staging: free both waiters so the run can end
        writeFileSync(waitA, 'go');
        writeFileSync(waitB, 'go');
      }
      await Promise.all([a.done, b.done]).catch(() => {});
    }
    const [ra, rb] = await Promise.all([a.done, b.done]);
    assert.equal(ra.code, 0, ra.stdout + ra.stderr);
    assert.equal(rb.code, 2);
    assert.equal(rb.json.code, 'lock_contended', JSON.stringify(rb.json));

    // No overlapping critical sections / no lost revision: exactly ONE write landed on the
    // post-kill revision; B wrote nothing; the record parses and is revision-consistent.
    const st = runCli(['status', '--record', t.recordPath]);
    const ids = st.json.record.observations.map((o) => o.observationId).sort();
    assert.deepEqual(ids, ['a-1'], 'only the winner’s observation is durable');
    assert.equal(st.json.record.recordRevision, 2, 'init 1 → exactly one durable write');
    assert.equal(st.json.record.controlRevision, controlBefore, 'no lost control revision');
    assert.deepEqual(tmpFiles(t.stageRoot), []);
    rmSync(t.base, { recursive: true, force: true });
  });

  ltest('lexical aliases contend on ONE lock: canonical resolution precedes lock-key derivation', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t));
    const aliasPath = join(t.stageRoot, 'sub', '..', 'binding.json'); // resolve() → same canonical path
    assert.equal(resolve(aliasPath), resolve(t.recordPath));
    const holder = spawnCli(['reconcile', '--record', aliasPath, '--repo-root', t.repo, '--feature-home', t.home, '--now', iso(), '--observation', obs('alias-1', 'parked'), '--test-hold-lock-ms', '700']);
    await sleep(300);
    const contender = spawnCli(recArgs(t, ['--observation', obs('alias-2', 'parked'), '--lock-retry-budget-ms', '150']));
    const [rh, rc] = await Promise.all([holder.done, contender.done]);
    assert.equal(rh.code, 0, rh.stdout + rh.stderr);
    assert.equal(rc.code, 2);
    assert.equal(rc.json.code, 'lock_contended', 'a lexically-different spelling of the same record shares one lock');
    rmSync(t.base, { recursive: true, force: true });
  });

  ltest('alias safety (A1-CODE-01): a directory-symlink alias canonicalizes to ONE lock name and contends on it', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t));
    symlinkSync(t.stageRoot, join(t.base, 'alias-root'));
    const alias = join(t.base, 'alias-root', 'binding.json');
    // The lock key is derived from the CANONICAL record path (realpath of the longest
    // existing ancestor + leaf chain) — the alias and the direct spelling hash to the
    // same abstract name, so two aliases can never acquire independent locks.
    assert.equal(lockNameForRecord(alias), lockNameForRecord(t.recordPath), 'a symlinked-directory alias shares ONE lock key with the direct spelling');
    // Real overlapping contention THROUGH the alias spelling: while the direct-path
    // holder is inside its critical section, the alias acquirer must hit the SAME
    // abstract name and fail bounded (EADDRINUSE against a live holder) — not acquire
    // an independent lock.
    const holder = spawnCli(recArgs(t, ['--observation', obs('direct-1', 'parked'), '--test-hold-lock-ms', '700']));
    await sleep(300);
    const contender = spawnCli(['reconcile', '--record', alias, '--repo-root', t.repo, '--feature-home', t.home, '--now', iso(), '--observation', obs('alias-1', 'parked'), '--lock-retry-budget-ms', '150']);
    const [rh, rc] = await Promise.all([holder.done, contender.done]);
    assert.equal(rh.code, 0, rh.stdout + rh.stderr);
    assert.equal(rc.code, 2);
    assert.equal(rc.json.code, 'lock_contended', 'an alias of the same record contends on the holder’s lock instead of acquiring an independent one');
    // Sequential use through both spellings stays correct: monotonic revisions, one record.
    const second = runCli(['reconcile', '--record', alias, '--repo-root', t.repo, '--feature-home', t.home, '--now', iso(), '--observation', obs('alias-2', 'parked')]);
    assert.equal(second.status, 0, second.stdout + second.stderr);
    assert.equal(second.json.recordRevision, rh.json.recordRevision + 1, 'revisions stay monotonic across spellings');
    const ids = runCli(['status', '--record', alias]).json.record.observations.map((o) => o.observationId).sort();
    assert.deepEqual(ids, ['alias-2', 'direct-1'], 'both spellings read and write the SAME record');
    rmSync(t.base, { recursive: true, force: true });
  });

  ltest('alias safety (A1-CODE-01): a LEAF-symlink alias also canonicalizes to ONE lock name and one write target', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t));
    const leafAlias = join(t.stageRoot, 'binding-alias.json');
    symlinkSync(t.recordPath, leafAlias);
    assert.equal(lockNameForRecord(leafAlias), lockNameForRecord(t.recordPath), 'a leaf alias resolves through the leaf chain to the same lock key');
    const holder = spawnCli(recArgs(t, ['--observation', obs('leaf-1', 'parked'), '--test-hold-lock-ms', '700']));
    await sleep(300);
    const contender = spawnCli(['reconcile', '--record', leafAlias, '--repo-root', t.repo, '--feature-home', t.home, '--now', iso(), '--observation', obs('leaf-2', 'parked'), '--lock-retry-budget-ms', '150']);
    const [rh, rc] = await Promise.all([holder.done, contender.done]);
    assert.equal(rh.code, 0, rh.stdout + rh.stderr);
    assert.equal(rc.code, 2);
    assert.equal(rc.json.code, 'lock_contended', 'a leaf alias contends on the SAME lock as its target path');
    rmSync(t.base, { recursive: true, force: true });
  });

  ltest('alias safety (A1-CODE-01): an escaping ANCESTOR symlink is rejected by containment BEFORE any write', async () => {
    const t = makeFixture(null);
    const outside = join(t.base, 'outside');
    mkdirSync(outside, { recursive: true });
    // /stage/escape -> outside the stage root: the record path through the escape is
    // lexically inside the stage but canonically resolves OUTSIDE it.
    symlinkSync(outside, join(t.stageRoot, 'escape'));
    const throughEscape = join(t.stageRoot, 'escape', 'binding.json');
    const res = runCli(initArgs(t, [], throughEscape));
    assert.equal(res.status, 2, res.stdout + res.stderr);
    assert.equal(res.json.code, 'record_outside_stage_root', JSON.stringify(res.json));
    // No write happened anywhere: neither through the escape nor at the direct path.
    assert.equal(existsSync(throughEscape), false, 'no record was written through the escaping ancestor');
    assert.equal(existsSync(join(outside, 'binding.json')), false, 'the canonical (escaped) location is untouched');
    assert.equal(existsSync(t.recordPath), false, 'the direct location is untouched');
    // A leaf symlink pointing OUTSIDE is equally rejected (previously only containment
    // on the leaf target guarded this; now the canonical path does, before the lock).
    const outsideLeaf = join(t.stageRoot, 'binding-out.json');
    symlinkSync(join(outside, 'binding.json'), outsideLeaf);
    const resLeaf = runCli(initArgs(t, [], outsideLeaf));
    assert.equal(resLeaf.status, 2);
    assert.equal(resLeaf.json.code, 'record_outside_stage_root', JSON.stringify(resLeaf.json));
    assert.equal(existsSync(join(outside, 'binding.json')), false);
    rmSync(t.base, { recursive: true, force: true });
  });

  ltest('alias safety (A1-CODE-01): concurrent reconciles through two aliases of one record serialize on one lock (no lost update)', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t, ['--task-id', 't-1']));
    symlinkSync(t.stageRoot, join(t.base, 'alias-root'));
    const alias = join(t.base, 'alias-root', 'binding.json');
    // Both spellings write CONCURRENTLY (no staged ordering): the shared lock must
    // serialize them so both observations land and revisions stay monotonic.
    const [ra, rb] = await Promise.all([
      spawnCli(recArgs(t, ['--observation', obs('conc-a', 'parked'), '--lock-retry-budget-ms', '5000'])).done,
      spawnCli(['reconcile', '--record', alias, '--repo-root', t.repo, '--feature-home', t.home, '--now', iso(), '--observation', obs('conc-b', 'parked'), '--lock-retry-budget-ms', '5000']).done,
    ]);
    assert.equal(ra.code, 0, ra.stdout + ra.stderr);
    assert.equal(rb.code, 0, rb.stdout + rb.stderr);
    const revs = [ra.json.recordRevision, rb.json.recordRevision].sort((a, b) => a - b);
    assert.deepEqual(revs, [2, 3], 'the two writes serialized on the shared lock (init 1 → 2 → 3)');
    const st = runCli(['status', '--record', alias]).json.record;
    const ids = st.observations.map((o) => o.observationId).sort();
    assert.deepEqual(ids, ['conc-a', 'conc-b'], 'both alias-path writes are durable — no lost update');
    assert.deepEqual(tmpFiles(t.stageRoot), []);
    rmSync(t.base, { recursive: true, force: true });
  });
});

// ===========================================================================
// Row 17 — release/reacquire interleaving + SIGKILL mid-critical-section.
// ===========================================================================
describe('row 17 — release/reacquire interleaving', () => {
  ltest('three acquirers of one record serialize cleanly; revisions monotonic; record parses each time', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t, ['--task-id', 't-1']));
    for (const [index, id] of ['i-1', 'i-2', 'i-3'].entries()) {
      const res = runCli(recArgs(t, ['--observation', obs(id, 'parked'), '--test-hold-lock-ms', String(60 + index * 40)]));
      assert.equal(res.status, 0, res.stdout + res.stderr);
      assert.equal(res.json.recordRevision, 2 + index, `acquirer ${index + 1} advanced the revision exactly once`);
      const st = runCli(['status', '--record', t.recordPath]);
      assert.ok(st.json.record, 'record parses after every mutation');
    }
    assert.deepEqual(tmpFiles(t.stageRoot), []);
    rmSync(t.base, { recursive: true, force: true });
  });

  ltest('SIGKILL mid-critical-section: the next acquirer binds immediately and the record is intact', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t, ['--task-id', 't-1']));
    const before = fileSha(t.recordPath);
    const victim = spawnCli(recArgs(t, ['--observation', obs('k-1', 'parked'), '--test-hold-lock-ms', '6000']));
    await sleep(400);
    victim.child.kill('SIGKILL');
    assert.equal((await victim.done).signal, 'SIGKILL');
    assert.equal(fileSha(t.recordPath), before, 'killed before its write → byte-identical record');
    const next = runCli(recArgs(t, ['--observation', obs('k-2', 'parked')]));
    assert.equal(next.status, 0, next.stdout + next.stderr);
    const st = runCli(['status', '--record', t.recordPath]);
    assert.deepEqual(st.json.record.observations.map((o) => o.observationId), ['k-2']);
    assert.equal(st.json.record.recordRevision, 2);
    assert.deepEqual(tmpFiles(t.stageRoot), []);
    rmSync(t.base, { recursive: true, force: true });
  });
});

// ===========================================================================
// Row 18 — platform fail-closed + non-EADDRINUSE bind failure at the strategy layer.
// The platform-gate arm runs on EVERY host (it asserts the real gate refuses). The two
// injected-strategy arms are Linux-classified (R2-06): they drive the Linux abstract-bind
// retry/surfacing STRATEGY through the `_bindAttempt` seam, and on a non-Linux host the
// real platform gate refuses before the seam is ever reached — so running them there
// would report Linux strategy coverage that did not happen. They are ltest-declared:
// skipped (never passed) off Linux, fully live on Linux. The non-Linux unsupported
// behavior itself is covered host-honestly by the arm above plus the HOST-01 real-CLI
// arms, which run on the actual host.
// ===========================================================================
describe('row 18 — fail-closed platform and bind-strategy arms (unit, no CLI seam)', () => {
  test('non-Linux platform → unsupported_pending_prerequisite before any attempt', async () => {
    for (const platform of ['darwin', 'win32', 'freebsd']) {
      const gate = platformSupportsAbstractBindLock(platform);
      assert.equal(gate.ok, false);
      assert.equal(gate.code, 'unsupported_pending_prerequisite');
      assert.match(gate.reason, new RegExp(platform));
      assert.match(gate.reason, /holding rather than approximating/);
      const acquired = await acquireBindLock({ recordPath: '/tmp/whatever/binding.json', platform });
      assert.equal(acquired.ok, false);
      assert.equal(acquired.code, 'unsupported_pending_prerequisite', 'no simulated lock, no pathname fallback');
    }
    assert.equal(platformSupportsAbstractBindLock('linux').ok, true);
  });

  ltest('injected non-EADDRINUSE bind failure surfaces verbatim, single attempt, fail-closed', async () => {
    let attempts = 0;
    const result = await acquireBindLock({
      recordPath: '/tmp/whatever/binding.json',
      retryBudgetMs: 500,
      _bindAttempt: async () => {
        attempts += 1;
        return { ok: false, code: 'lock_unavailable', reason: 'bind on the abstract lock name failed (EACCES: injected non-EADDRINUSE for the matrix) — failing closed, no unlink, no takeover' };
      },
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'lock_unavailable');
    assert.match(result.reason, /EACCES: injected/);
    assert.match(result.reason, /no unlink, no takeover/);
    assert.equal(attempts, 1, 'non-EADDRINUSE failures are surfaced, never retried through destruction');
  });

  ltest('injected contention exhausts the bounded budget and reports lock_contended (retry arithmetic)', async () => {
    let attempts = 0;
    const budgetMs = 120;
    const delayMs = 40;
    const result = await acquireBindLock({
      recordPath: '/tmp/whatever/binding.json',
      retryBudgetMs: budgetMs,
      retryDelayMs: delayMs,
      _bindAttempt: async () => {
        attempts += 1;
        return { ok: false, code: 'lock_contended', reason: 'abstract lock name is already bound by a live holder' };
      },
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'lock_contended');
    assert.ok(attempts >= 2 && attempts <= Math.ceil(budgetMs / delayMs) + 2, `bounded retries, got ${attempts}`);
    void LOCK_RETRY_DEFAULT_BUDGET_MS;
  });
});

// ===========================================================================
// Row 19 — resume authority battery (A1-ARCH-02).
// ===========================================================================
describe('row 19 — resume authority battery', () => {
  /** A grant document bound to the CURRENT state of `record` (fresh digest per base). */
  let grantSeq = 0;
  function grantFor(t, record, over = {}) {
    const grant = {
      action: 'resume',
      featureId: record.featureId,
      stage: record.stage,
      taskId: record.aif.taskId ?? undefined,
      recordPath: record.recordPath,
      controlRevision: record.controlRevision,
      recordDigest: recordDigest(record),
      rationale: 'fixture-only trusted-authority grant authored by the matrix itself — never production admission',
      ...over,
    };
    if (over.taskId === undefined) delete grant.taskId; // JSON-safe optional field
    const path = join(t.base, `grant-${grantSeq += 1}.json`);
    writeFileSync(path, JSON.stringify(grant, null, 2));
    return path;
  }

  function pausedFixture(t) {
    const fx = makeFixture(t);
    // Fidelity-r1 F-2 control: no bound AIF task and no worker — the pause lands
    // `paused` directly. A task-bound record defers the pause to cessation
    // acknowledgement (pause-pending) and is the fidelity block's F-2 arm.
    runCli(initArgs(fx));
    const pause = runCli(['pause', '--record', fx.recordPath, '--control-reason', 'operator pause for the resume battery', '--now', iso()]);
    assert.equal(pause.status, 0);
    const st = runCli(['status', '--record', fx.recordPath]);
    assert.equal(st.json.record.controlState, 'paused');
    return { fx, record: st.json.record };
  }

  ltest('production CLI negatives: every resume shape stays held with unchanged record bytes', async () => {
    const { fx, record } = pausedFixture(null);
    const t = fx; // grant documents land beside the fixture, never inside the stage root
    const beforeSha = fileSha(fx.recordPath);
    const cases = [];
    cases.push(['absent grant', ['resume', '--record', fx.recordPath, '--now', iso()], {}]);
    cases.push(['fresh correctly scoped self-authored grant', ['resume', '--record', fx.recordPath, '--grant', grantFor(t, record), '--now', iso()], {}]);
    cases.push(['stale-revision grant', ['resume', '--record', fx.recordPath, '--grant', grantFor(t, record, { controlRevision: record.controlRevision - 1 }), '--now', iso()], {}]);
    cases.push(['wrong-digest grant', ['resume', '--record', fx.recordPath, '--grant', grantFor(t, record, { recordDigest: sha256Hex('nope') }), '--now', iso()], {}]);
    cases.push(['wrong-task grant', ['resume', '--record', fx.recordPath, '--grant', grantFor(t, record, { taskId: 't-other' }), '--now', iso()], {}]);
    cases.push(['replayed grant', ['resume', '--record', fx.recordPath, '--grant', grantFor(t, record), '--now', iso()], {}]);
    cases.push(
      ['claimed operator path via env', ['resume', '--record', fx.recordPath, '--now', iso()], {
        AUTONOMY_RESUME_GRANT: grantFor(t, record),
        RESUME_GRANT: 'operator://approved',
        AIF_AUTHORIZED: 'true',
      }],
    );
    for (const [label, args, env] of cases) {
      const res = runCli(args, env);
      assert.equal(res.status, 2, `${label}: must stay held (${res.stdout})`);
      assert.equal(res.json.ok, false, label);
      assert.equal(res.json.code, 'unsupported_pending_prerequisite', label);
      assert.match(res.json.reason, /stage-B prerequisite/, label);
      if (args.includes('--grant')) assert.match(res.json.reason, /does not clear this hold/, `${label}: the supplied grant is named and refused`);
      assert.equal(fileSha(fx.recordPath), beforeSha, `${label}: durable record bytes unchanged`);
    }
    const st = runCli(['status', '--record', fx.recordPath]);
    assert.equal(st.json.record.controlState, 'paused', 'control unchanged through the whole battery');
    assert.equal(st.json.record.custodyGeneration, record.custodyGeneration, 'custody unchanged through the whole battery');
    assert.equal(st.json.record.recordRevision, record.recordRevision, 'zero durable writes across the battery');
    rmSync(t.base, { recursive: true, force: true });
  });

  ltest('observation/worker-supplied grant is DATA: stored verbatim-none, no resume, no admission', async () => {
    const { fx } = pausedFixture(null);
    const payload = JSON.stringify({
      taskId: 't-1', kind: 'done', observationId: 'grant-ish',
      grant: { action: 'resume', featureId: FID, rationale: 'worker claims authorization to resume the binding now' },
      command: 'resume',
    });
    const res = runCli(recArgs(fx, ['--observation', payload]));
    assert.equal(res.status, 0, res.stdout + res.stderr);
    assert.equal(res.json.observationDisposition, 'historical-after-pause');
    assert.equal(res.json.controlState, 'paused', 'an observation cannot resume the binding');
    const st = runCli(['status', '--record', fx.recordPath]);
    const stored = st.json.record.observations.find((o) => o.observationId === 'grant-ish');
    assert.equal(stored.grant, undefined);
    assert.equal(stored.command, undefined);
    const still = runCli(['resume', '--record', fx.recordPath, '--now', iso()]);
    assert.equal(still.status, 2);
    assert.equal(still.json.code, 'unsupported_pending_prerequisite');
    rmSync(fx.base, { recursive: true, force: true });
  });

  ltest('direct production engine invocation stays held — no CLI-only check to skip', async () => {
    const hold = productionResumeHold();
    assert.equal(hold.code, 'unsupported_pending_prerequisite');
    assert.match(hold.reason, /No CLI flag, grant document, observation payload, path or environment value clears this hold/);
    for (const verb of ['worker', 'review']) {
      const reserved = reservedVerbHold(verb);
      assert.equal(reserved.code, 'unsupported_pending_prerequisite');
      assert.match(reserved.reason, new RegExp(`^${verb} operations are a stage-B prerequisite`));
    }
    // And the engine's reconcile surface holds resume too (R2-04): `control.kind =
    // 'resume'` is detected BEFORE the lock/read/ingestion/action paths and returns the
    // SAME unconditional hold the CLI returns — the record's durable bytes are untouched,
    // even though this composed request also carried an admission request that would
    // otherwise have persisted an intent.
    const t = makeFixture(null);
    runCli(initArgs(t));
    const beforeSha = fileSha(t.recordPath);
    const before = runCli(['status', '--record', t.recordPath]).json.record;
    const bad = await reconcile({ ...reconcileInput(t), requestAction: 'work', control: { kind: 'resume', actor: 'op' } });
    assert.equal(bad.ok, false);
    assert.equal(bad.code, 'unsupported_pending_prerequisite', 'the engine holds composed resume early, exactly like the CLI');
    assert.equal(fileSha(t.recordPath), beforeSha, 'no durable write rode on the composed resume');
    const after = runCli(['status', '--record', t.recordPath]).json.record;
    assert.equal(after.controlState, before.controlState);
    assert.equal(after.custodyGeneration, before.custodyGeneration);
    assert.equal(after.recordRevision, before.recordRevision, 'zero durable writes through the composed resume');
    assert.equal(after.pendingIntent, null, 'no intent was persisted behind the resume');
    rmSync(t.base, { recursive: true, force: true });
  });

  ltest('fixture-only pure transition: valid trusted input proposes consumption; negatives reject; nothing persists', async () => {
    const { fx, record } = pausedFixture(null);
    const t = fx;
    const beforeSha = fileSha(fx.recordPath);
    const grant = JSON.parse(readFileSync(grantFor(t, record), 'utf8'));

    // Positive: an ALREADY-TRUSTED grant proposes the transition — purely.
    const proposed = proposeResumeTransition(record, grant, { now: iso() });
    assert.ok(proposed.ok, JSON.stringify(proposed));
    assert.equal(proposed.value.proposed.controlState, 'active');
    assert.equal(proposed.value.proposed.controlRevision, record.controlRevision + 1);
    assert.equal(proposed.value.proposed.recordRevision, record.recordRevision + 1);
    assert.equal(proposed.value.proposed.consumedGrants.length, 1);
    assert.equal(proposed.value.proposed.consumedGrants[0].grantDigest, grantDigestOf(grant));
    assert.equal(fileSha(fx.recordPath), beforeSha, 'the pure proposal never touches disk');

    // Replay against the PROPOSED state is refused (single-use, explicit even before the
    // digest check would also catch it).
    const replay = proposeResumeTransition(proposed.value.proposed, grant, { now: iso() });
    assert.equal(replay.ok, false);
    assert.equal(replay.code, 'grant_replayed');

    // Negatives: scope, revision, digest, grant shape — each checked against a grant
    // RE-BOUND to the base record under test, so the digest gate passes and the named
    // gate is what actually fires (a stale-digest grant against a foreign base would
    // short-circuit at grant_digest_stale and prove nothing about the intended gate).
    const negative = (over, code, baseRecord = record) => {
      const rebound = JSON.parse(readFileSync(grantFor(t, baseRecord), 'utf8'));
      const res = proposeResumeTransition(baseRecord, { ...rebound, ...over }, { now: iso() });
      assert.equal(res.ok, false, JSON.stringify(over));
      assert.equal(res.code, code, `${JSON.stringify(over)} → ${code}, got ${res.code}: ${res.reason}`);
    };
    negative({ featureId: 'other-feature' }, 'grant_scope_mismatch');
    negative({ stage: 'other-stage' }, 'grant_scope_mismatch');
    negative({ taskId: 't-other' }, 'grant_scope_mismatch');
    negative({ recordPath: '/somewhere/else.json' }, 'grant_scope_mismatch');
    negative({ controlRevision: record.controlRevision - 1 }, 'grant_revision_stale');
    negative({ recordDigest: sha256Hex('stale') }, 'grant_digest_stale');
    negative({ rationale: 'short' }, 'grant_invalid');
    negative({ action: 'work' }, 'grant_invalid');

    // Non-paused origins reject at the transition table — grants re-bound to THOSE
    // records' current digests so the digest gate passes and the state gate is what fires.
    const activeFx = makeFixture(null);
    runCli(initArgs(activeFx));
    const activeRecord = runCli(['status', '--record', activeFx.recordPath]).json.record;
    negative({}, 'illegal_control_transition', activeRecord); // resume only from paused
    const pendingRecord = { ...structuredClone(activeRecord), controlState: 'pause-pending', worker: { sessionId: 'w', pid: 1, startedAt: iso(), host: null, cessationAckedAt: null } };
    negative({}, 'illegal_control_transition', pendingRecord); // must ack cessation first
    assert.equal(fileSha(fx.recordPath), beforeSha, 'the whole battery persisted nothing');
    assert.deepEqual(readdirSync(fx.stageRoot), ['binding.json'], 'no grant documents leak into the stage root');
    rmSync(t.base, { recursive: true, force: true });
    rmSync(activeFx.base, { recursive: true, force: true });
  });

  test('static pin: no production path wires the fixture-only transition to persistence', () => {
    const engineBody = src('autonomy-binding/engine.mjs');
    assert.ok(!/import\s*{[^}]*proposeResumeTransition/.test(engineBody), 'the engine must not import the fixture-only transition');
    assert.ok(!engineBody.includes('proposeResumeTransition('), 'the engine must not call the fixture-only transition');
    const cliBody = src('autonomy-binding.mjs');
    assert.ok(!cliBody.includes('proposeResumeTransition'), 'the CLI must not reach the fixture-only transition');
    assert.ok(cliBody.includes('productionResumeHold()'), 'the CLI resume branch is the unconditional hold');
  });
});

// ===========================================================================
// Cold-review regression arms (r4 fixes) — every MAJOR/MINOR finding from the
// 2026-10-27 cold diff review is pinned here so it cannot silently regress.
// ===========================================================================
describe('cold-review regression arms (r4 fixes)', () => {
  ltest('MAJOR 1: re-deriving an already-open uncertain_owner hold is a no-op — no revision burn, mutated false', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t, ['--task-id', 't-1']));
    const plan = runCli(recArgs(t, ['--request-action', 'work']));
    assert.equal(plan.status, 0, plan.stdout + plan.stderr);
    const revisionAfterPlan = plan.json.recordRevision;
    const first = runCli(recArgs(t));
    assert.equal(first.status, 0, first.stdout + first.stderr);
    assert.equal(first.json.mutated, true, 'the FIRST pass over the unresolved intent opens the hold');
    assert.equal(first.json.recordRevision, revisionAfterPlan + 1);
    const second = runCli(recArgs(t));
    assert.equal(second.status, 0, second.stdout + second.stderr);
    assert.equal(second.json.ok, true, 'a re-derived hold is not a rejection');
    assert.equal(second.json.mutated, false, 'the SECOND pass over the same open hold must be a no-op');
    assert.equal(second.json.recordRevision, revisionAfterPlan + 1, 'no revision burned on re-derivation');
    assert.equal(second.json.holds.length, 1, 'exactly one open hold instance (envelope carries open holds, top level)');
    rmSync(t.base, { recursive: true, force: true });
  });

  ltest('MAJOR 2: a composed observation + rejected request-action persists the ingested fact', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t, ['--task-id', 't-1']));
    runCli(['pause', '--record', t.recordPath, '--control-reason', 'operator pause (composed-rejection arm)', '--now', iso()]);
    const beforeSha = fileSha(t.recordPath);
    const denied = runCli(recArgs(t, ['--observation', obs('composed-1', 'done'), '--request-action', 'work']));
    assert.equal(denied.status, 2);
    assert.equal(denied.json.code, 'admission_blocked', 'the request-action is still rejected, never queued');
    assert.notEqual(fileSha(t.recordPath), beforeSha, 'the ingested observation IS durable before the rejection returns');
    const st = runCli(['status', '--record', t.recordPath]);
    assert.equal(st.json.record.observations.length, 1, 'the worker report was not dropped');
    assert.equal(st.json.record.observations[0].disposition, 'historical-after-pause');
    assert.equal(st.json.record.pendingIntent, null, 'no intent was persisted — only the fact');
    assert.equal(st.json.record.recordRevision, 3, 'init 1 + pause 1 → exactly one fact write from the composed reconcile');
    rmSync(t.base, { recursive: true, force: true });
  });

  ltest('MAJOR 4: request-action without --repo-root (or against an unreadable authority) fails closed', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t, ['--task-id', 't-1']));
    const beforeSha = fileSha(t.recordPath);
    const noRepo = runCli(['reconcile', '--record', t.recordPath, '--now', iso(), '--request-action', 'work']);
    assert.equal(noRepo.status, 2);
    assert.equal(noRepo.json.code, 'invalid_request');
    assert.ok(noRepo.json.reason.includes('--repo-root'), noRepo.json.reason);
    assert.equal(fileSha(t.recordPath), beforeSha, 'no intent was persisted against an unverifiable authority');
    // An UNRESOLVABLE feature home is the other fail-closed direction: the record's bound
    // home is the legitimate fallback when the CLI omits --feature-home (the path is where
    // to look, the authority CONTENT is still re-read live), but when that path can no
    // longer serve a live read, admission must be gated by the authority hold, not planned
    // against the init snapshot.
    rmSync(t.home, { recursive: true, force: true });
    const beforeDeadHome = fileSha(t.recordPath);
    const deadHome = runCli(recArgs(t, ['--request-action', 'work']));
    assert.equal(deadHome.status, 2, deadHome.stdout + deadHome.stderr);
    assert.equal(deadHome.json.code, 'authority_hold_open', JSON.stringify(deadHome.json));
    assert.notEqual(fileSha(t.recordPath), beforeDeadHome, 'the authority_unavailable hold IS durable (rejectAfterPersist)');
    const st = runCli(['status', '--record', t.recordPath]);
    assert.equal(st.json.record.pendingIntent, null, 'no intent was persisted against an unreadable authority');
    assert.equal(st.json.record.controlState, 'active', 'the hold gates admission without seizing control');
    assert.ok(st.json.record.holds.some((h) => h.code === 'authority_unavailable' && h.clearedAt === null), JSON.stringify(st.json.record.holds));
    assert.equal(st.json.route, 'hold');
    assert.equal(st.json.routeReason, 'authority_unavailable');
    rmSync(t.base, { recursive: true, force: true });
  });

  ltest('MINOR 5: custody transfer onto a terminal record is rejected', async () => {
    const t = makeFixture(null);
    // Fidelity-r1 F-2 control: truly-empty binding, so the cancel reaches terminal
    // `cancelled` directly — a task-bound record defers the cancellation to the
    // cessation-ack door (cancel-pending; the R4-02 arms cover that path).
    runCli(initArgs(t));
    runCli(['cancel', '--record', t.recordPath, '--control-reason', 'operator cancel (custody arm)', '--now', iso()]);
    const beforeSha = fileSha(t.recordPath);
    const transfer = runCli(recArgs(t, ['--transfer-custody', 'w-9']));
    assert.equal(transfer.status, 2);
    assert.equal(transfer.json.code, 'custody_transfer_terminal');
    assert.equal(fileSha(t.recordPath), beforeSha, 'no custody generation burned on a closed binding');
    rmSync(t.base, { recursive: true, force: true });
  });

  ltest('MINOR 9: a non-ISO --now is rejected up front, not late as record_invalid', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t, ['--task-id', 't-1']));
    const res = runCli(['reconcile', '--record', t.recordPath, '--repo-root', t.repo, '--feature-home', t.home, '--now', 'not-a-timestamp', '--observation', obs('iso-1', 'parked')]);
    assert.equal(res.status, 2);
    assert.equal(res.json.code, 'invalid_request');
    assert.ok(res.json.reason.includes('ISO'), res.json.reason);
    rmSync(t.base, { recursive: true, force: true });
  });

  ltest('MINOR 10: the library control door requires a delivery receipt for complete, same as markComplete (library arm)', async () => {
    const t = makeFixture(null);
    await initBinding(initBindingInput(t));
    const denied = await reconcile({ ...reconcileInput(t), control: { kind: 'complete', actor: 'matrix:library-arm' } });
    assert.equal(denied.ok, false);
    assert.equal(denied.code, 'complete_requires_delivery_receipt');
    const st = runCli(['status', '--record', t.recordPath]);
    assert.equal(st.json.record.controlState, 'active', 'the rejected completion mutated nothing');
    rmSync(t.base, { recursive: true, force: true });
  });

  ltest('MINOR 6: status route mirrors reconcile route for an active task-bound record', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t, ['--task-id', 't-1']));
    const fresh = runCli(['status', '--record', t.recordPath]);
    assert.equal(fresh.json.route, 'observe');
    assert.equal(fresh.json.routeReason, 'task bound; awaiting first observation');
    runCli(recArgs(t, ['--observation', obs('route-1', 'parked')]));
    const parked = runCli(['status', '--record', t.recordPath]);
    assert.equal(parked.json.route, 'hold');
    assert.equal(parked.json.routeReason, 'worker_report_parked');
    runCli(recArgs(t, ['--observation', obs('route-2', 'done')]));
    const done = runCli(['status', '--record', t.recordPath]);
    assert.equal(done.json.route, 'review');
    assert.equal(done.json.routeReason, 'worker reported done; review before completion (completion awaits the stage-B establishment capability — no stage-A input establishes the delivery fact)');
    rmSync(t.base, { recursive: true, force: true });
  });
});

// ===========================================================================
// Cold-review regression arms — round 5 (r5). The r4 round converted only the
// admission-gate rejections to persist-before-reject; this round closes the
// CLASS: every rejection site after observation ingestion persists the facts
// ingested earlier in the same composed pass, and the persist-before-reject
// durable write is reachable by the crash-window seams like any other write.
// ===========================================================================
describe('cold-review regression arms (r5 fixes)', () => {
  ltest('r5 MAJOR: a composed observation survives EVERY post-ingestion rejection class', async () => {
    // One scenario per rejection-site class that sits AFTER observation ingestion
    // (engine steps 4-10): the sibling input is refused with its exact code, while
    // the observation — independently valid DATA the moment it was classified —
    // is durable before the rejection returns. The follow-up reconcile proves the
    // write was real: the same observation re-classifies as duplicate and burns
    // no revision (idempotent durable fact, row-6 semantics).
    const scenarios = [
      { name: 'input gate: request-action not in ROUTES', setup: null, armArgs: ['--request-action', 'teleport'], code: 'invalid_request' },
      { name: 'input gate: request-action without --repo-root', setup: null, dropRepoRoot: true, armArgs: ['--request-action', 'work'], code: 'invalid_request' },
      {
        name: 'semantic: intent_id_mismatch',
        setup: (t) => runCli(recArgs(t, ['--request-action', 'work'])),
        armArgs: ['--resolve-intent', 'act-does-not-exist', '--resolution', 'applied', '--evidence', 'verified the effect landed in the external system'],
        code: 'intent_id_mismatch',
      },
      {
        name: 'semantic: delivery_conflict',
        setup: (t) => runCli(recArgs(t, ['--delivery-receipt', 'pr:staging#1'])),
        armArgs: ['--delivery-receipt', 'pr:staging#other'],
        code: 'delivery_conflict',
      },
      {
        name: 'semantic: custody_transfer_blocked',
        initArgs: ['--task-id', 't-1', '--worker-session', 'w-1', '--worker-pid', '12345'],
        setup: null,
        armArgs: ['--transfer-custody', 'session-b'],
        code: 'custody_transfer_blocked',
      },
      {
        name: 'semantic: candidate_regression',
        initArgs: ['--task-id', 't-1', '--candidate-revision', '1'],
        setup: null,
        armArgs: ['--candidate-revision', '0'],
        code: 'candidate_regression',
      },
      { name: 'semantic: complete_requires_delivery_receipt', setup: null, armArgs: ['--mark-complete'], code: 'complete_requires_delivery_receipt' },
    ];
    for (const [index, s] of scenarios.entries()) {
      const t = makeFixture(null);
      runCli(initArgs(t, s.initArgs ?? ['--task-id', 't-1']));
      if (s.setup) s.setup(t);
      const obsId = `r5-${index}`;
      const armRaw = ['--observation', obs(obsId, 'parked'), ...s.armArgs];
      const arm = s.dropRepoRoot
        ? runCli(['reconcile', '--record', t.recordPath, '--feature-home', t.home, '--now', iso(), ...armRaw])
        : runCli(recArgs(t, armRaw));
      assert.equal(arm.status, 2, `${s.name}: expected rejection, got ${arm.stdout} ${arm.stderr}`);
      assert.equal(arm.json.code, s.code, s.name);
      const st = runCli(['status', '--record', t.recordPath]);
      assert.ok(st.json && st.json.record, `R5DBG ${s.name}: status envelope: ${st.stdout} ${st.stderr} (arm was: ${arm.stdout})`);
      assert.equal(st.json.record.observations.length, 1, `${s.name}: the composed observation IS durable before the rejection returns`);
      assert.ok(st.json.record.recordRevision >= 2, `${s.name}: the durable fact write advanced the revision`);
      const dup = runCli(recArgs(t, ['--observation', obs(obsId, 'parked')]));
      assert.equal(dup.status, 0, `${s.name}: follow-up reconcile: ${dup.stdout} ${dup.stderr}`);
      assert.equal(dup.json.mutated, false, `${s.name}: the retry is a no-op — the fact was already durable`);
      const after = runCli(['status', '--record', t.recordPath]);
      assert.equal(after.json.record.observations.length, 1, `${s.name}: no second instance stored`);
      assert.equal(after.json.record.recordRevision, st.json.record.recordRevision, `${s.name}: the durable fact is idempotent — retry classifies duplicate, no revision burn`);
      rmSync(t.base, { recursive: true, force: true });
    }
  });

  ltest('r5: the persist-before-reject durable write is reachable by the crash-window seams', async () => {
    // commit seam on the persist-before-reject write: killed AFTER the write landed —
    // the ingested fact survives the SIGKILL and the retry is an idempotent duplicate.
    const t = makeFixture(null);
    runCli(initArgs(t, ['--task-id', 't-1']));
    runCli(recArgs(t, ['--delivery-receipt', 'pr:staging#1']));
    const crasher = spawnCli(recArgs(t, ['--observation', obs('crash-commit', 'parked'), '--delivery-receipt', 'pr:staging#other', '--test-crash-after', 'commit']));
    const r = await crasher.done;
    assert.equal(r.signal, 'SIGKILL', 'the persist-before-reject write fires the commit seam');
    const st = runCli(['status', '--record', t.recordPath]);
    assert.equal(st.json.record.observations.length, 1, 'the ingested fact survived the SIGKILL');
    assert.equal(st.json.record.controlState, 'active', 'the kill committed the FACT, not any control or delivery change');
    assert.equal(st.json.record.delivery.receipt, 'pr:staging#1', 'the conflicting receipt was never recorded');
    const dup = runCli(recArgs(t, ['--observation', obs('crash-commit', 'parked')]));
    assert.equal(dup.status, 0, dup.stdout + dup.stderr);
    assert.equal(dup.json.mutated, false, 'the retry is a no-op — the fact was already durable');
    assert.equal(dup.json.recordRevision, st.json.record.recordRevision, 'retry is idempotent: duplicate disposition, no revision burn');
    const after = runCli(['status', '--record', t.recordPath]);
    assert.equal(after.json.record.observations.length, 1, 'no second observation instance stored');
    rmSync(t.base, { recursive: true, force: true });
  });

  ltest('r5: prewrite seam on the persist-before-reject write leaves no residue', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t, ['--task-id', 't-1']));
    runCli(recArgs(t, ['--delivery-receipt', 'pr:staging#1']));
    const before = fileSha(t.recordPath);
    const crasher = spawnCli(recArgs(t, ['--observation', obs('crash-pre', 'parked'), '--delivery-receipt', 'pr:staging#other', '--test-crash-after', 'prewrite']));
    const r = await crasher.done;
    assert.equal(r.signal, 'SIGKILL');
    assert.equal(fileSha(t.recordPath), before, 'a crash before the persist-before-reject write leaves the record byte-identical');
    assert.deepEqual(tmpFiles(t.stageRoot), []);
    rmSync(t.base, { recursive: true, force: true });
  });
});

// ===========================================================================
// Cold-review regression arms (r6 fixes): the completion doors carry the same
// live-authority premise admission has (r6 MAJOR), the ack-cessation failure path
// persists before rejecting (r6 m1, defense-in-depth — unreachable by construction,
// covered by the r5 persist-before-reject battery's semantics), and the hold log is
// bounded with open holds never pruned (r6 m3).
// ===========================================================================
describe('cold-review regression arms (r6 fixes)', () => {
  ltest('r6 MAJOR: an open authority hold blocks completion like admission; completion proceeds only after the hold settles', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t, ['--task-id', 't-1']));
    t.bumpSelector(2);
    runCli(recArgs(t)); // opens the authority_changed hold as its own durable write
    t.bumpSelector(3); // the authority moves AGAIN before the completion attempt, so the
    // completion pass re-opens a hold against the newer signature — an OPEN hold is what
    // the completion gate must see (a stable-read pass would have cleared it first, which
    // is the separate settle-boundary arm below).
    // Fidelity-r1 F-1: the receipt carries a verified content reference so the gate this
    // arm exercises is the AUTHORITY hold, not evidence absence.
    const holdEvidence = evidenceArtifact(t, 'delivery-hold.json', { delivered: true, receipt: 'receipt-hold' });
    const refused = runCli(recArgs(t, ['--delivery-receipt', 'receipt-hold',
      '--delivery-evidence-ref', holdEvidence.path, '--delivery-evidence-sha256', holdEvidence.sha256,
      '--mark-complete']));
    assert.equal(refused.status, 2);
    assert.equal(refused.json.code, 'authority_hold_open', JSON.stringify(refused.json));
    const st = runCli(['status', '--record', t.recordPath]);
    assert.equal(st.json.record.controlState, 'active', 'an unsettled authority hold must not close the binding');
    assert.equal(st.json.record.delivery.receipt, 'receipt-hold', 'the receipt is a FACT from earlier in the refused pass and stays durable (persist-before-reject)');
    const settled = runCli(recArgs(t)); // stable read clears the open hold — its own pass
    assert.ok(settled.json.effects.includes('authority-stable'), JSON.stringify(settled.json.effects));
    // INVALIDATED POSITIVE (fidelity-r2 F-1): the r1 tail completed on the sourced
    // receipt after the hold settled. The repair keeps the settle boundary exactly as it
    // was (the authority gate above is still the FIRST refusal this arm exercises) but
    // the settled record now fails closed one gate later — the delivery itself is never
    // established by a caller-supplied artifact, so completion stays closed in stage A.
    const ok = runCli(recArgs(t, ['--delivery-receipt', 'receipt-hold',
      '--delivery-evidence-ref', holdEvidence.path, '--delivery-evidence-sha256', holdEvidence.sha256,
      '--mark-complete']));
    assert.equal(ok.status, 2);
    assert.equal(ok.json.code, 'delivery_evidence_unverified', ok.stdout + ok.stderr);
    assert.equal(ok.json.controlState, 'active', 'completion is closed, not the binding');
    rmSync(t.base, { recursive: true, force: true });
  });

  ltest('r6 MAJOR: the pass that clears an authority hold cannot also complete on it (settle boundary holds for completion too)', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t, ['--task-id', 't-1']));
    t.bumpSelector(2);
    runCli(recArgs(t)); // opens the authority_changed hold
    // This pass CLEARS the hold (stable read) and attempts completion in the same
    // composition — the clearing pass must settle first, exactly like admission (r4).
    // Fidelity-r1 F-1: the receipt is sourced (verified content reference) so the settle
    // boundary is the gate under test, not evidence absence.
    const flipEvidence = evidenceArtifact(t, 'delivery-flip.json', { delivered: true, receipt: 'receipt-flip' });
    const res = runCli(recArgs(t, ['--delivery-receipt', 'receipt-flip',
      '--delivery-evidence-ref', flipEvidence.path, '--delivery-evidence-sha256', flipEvidence.sha256,
      '--mark-complete']));
    assert.equal(res.status, 2);
    assert.equal(res.json.code, 'authority_hold_open', JSON.stringify(res.json));
    assert.match(res.json.reason, /same pass/);
    const st = runCli(['status', '--record', t.recordPath]);
    assert.equal(st.json.record.controlState, 'active');
    // The hold is already settled by the refused pass's durable write. INVALIDATED
    // POSITIVE (fidelity-r2 F-1): the r1 tail completed on the next reconcile — the
    // settle boundary was the gate under test and still is (asserted above) — but the
    // settled record now fails closed on the delivery gate itself: a sourced content
    // reference establishes no delivery fact, so completion stays closed in stage A.
    const ok = runCli(recArgs(t, ['--delivery-receipt', 'receipt-flip',
      '--delivery-evidence-ref', flipEvidence.path, '--delivery-evidence-sha256', flipEvidence.sha256,
      '--mark-complete']));
    assert.equal(ok.status, 2);
    assert.equal(ok.json.code, 'delivery_evidence_unverified', ok.stdout + ok.stderr);
    assert.equal(ok.json.controlState, 'active');
    rmSync(t.base, { recursive: true, force: true });
  });

  ltest('r6 MAJOR: completion without a live-authority source fails closed naming --repo-root', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t, ['--task-id', 't-1']));
    const res = runCli(['reconcile', '--record', t.recordPath, '--now', iso(), '--delivery-receipt', 'receipt-noroot', '--mark-complete']);
    assert.equal(res.status, 2);
    assert.equal(res.json.code, 'invalid_request', JSON.stringify(res.json));
    assert.match(res.json.reason, /--repo-root/);
    const st = runCli(['status', '--record', t.recordPath]);
    assert.equal(st.json.record.controlState, 'active', 'no completion against the init-time authority snapshot');
    assert.equal(st.json.record.delivery.receipt, 'receipt-noroot', 'the receipt stays durable even though completion was refused');
    rmSync(t.base, { recursive: true, force: true });
  });

  ltest('r6 MAJOR: the library control door carries the same live-authority completion premise', async () => {
    const t = makeFixture(null);
    await initBinding(initBindingInput(t));
    const denied = await reconcile(reconcileInput(t, {
      repoRoot: undefined,
      featureHome: undefined,
      deliveryReceipt: 'receipt-lib-noroot',
      control: { kind: 'complete', actor: 'matrix:library-arm' },
    }));
    assert.equal(denied.ok, false);
    assert.equal(denied.code, 'invalid_request');
    assert.match(denied.reason, /--repo-root/);
    const st = runCli(['status', '--record', t.recordPath]);
    assert.equal(st.json.record.controlState, 'active');
    rmSync(t.base, { recursive: true, force: true });
  });

  ltest('r6 m3: authority flapping cannot grow the hold log unboundedly — cleared holds prune oldest-first', async () => {
    const t = makeFixture(null);
    await initBinding(initBindingInput(t));
    // 210 flaps, each an (open on the changed read + clear on the stable read) pair:
    // one hold entry per flap, so the 201st append crosses the 200-entry cap and the
    // prune must engage without dropping anything still open.
    for (let i = 2; i <= 211; i += 1) {
      t.bumpSelector(i);
      const opened = await reconcile(reconcileInput(t, { now: iso() }));
      assert.equal(opened.ok, true, JSON.stringify(opened));
      const cleared = await reconcile(reconcileInput(t, { now: iso() }));
      assert.equal(cleared.ok, true, JSON.stringify(cleared));
    }
    const st = runCli(['status', '--record', t.recordPath]);
    const holds = st.json.record.holds;
    assert.equal(holds.length, 200, 'the hold log is capped (pruning engaged mid-battery)');
    assert.ok(holds.every((h) => h.clearedAt !== null), 'after the final stable read every retained hold is cleared');
    const times = holds.map((h) => h.recordedAt);
    assert.deepEqual(times, [...times].sort(), 'pruning keeps the retained log oldest-first');
    rmSync(t.base, { recursive: true, force: true });
  });

  test('r6 m3: addHold prunes only already-cleared holds — an open hold is never silently dropped', () => {
    const good = initialRecord(initRecordFields(), { now: iso() });
    assert.ok(good.ok, JSON.stringify(good));
    let record = good.value;
    for (let i = 0; i < 199; i += 1) {
      const held = addHold(record, { code: 'authority_changed', reason: `flap-${i}`, recoveryAction: 'confirm the authority, then reconcile once stable', now: iso() });
      assert.ok(held.ok, JSON.stringify(held));
      record = held.value;
      record.holds[record.holds.length - 1].clearedAt = iso(); // this flap was settled
    }
    // One OPEN hold amid 199 cleared ones: dropping it would silently lift a live gate.
    const opened = addHold(record, { code: 'authority_changed', reason: 'the-one-open-hold', recoveryAction: 'confirm the authority, then reconcile once stable', now: iso() });
    assert.ok(opened.ok, JSON.stringify(opened));
    record = opened.value;
    const overflow = addHold(record, { code: 'authority_changed', reason: 'flap-overflow', recoveryAction: 'confirm the authority, then reconcile once stable', now: iso() });
    assert.ok(overflow.ok, JSON.stringify(overflow));
    record = overflow.value;
    assert.ok(record.holds.length <= 200, `cap holds: ${record.holds.length}`);
    assert.ok(record.holds.some((h) => h.reason === 'the-one-open-hold' && h.clearedAt === null), 'the open hold survived the prune');
    assert.ok(!record.holds.some((h) => h.reason === 'flap-0'), 'the OLDEST cleared hold is what the prune dropped');
    assert.ok(record.holds.some((h) => h.reason === 'flap-1'), 'cleared holds prune oldest-first, newest cleared retained');
  });
});

// ===========================================================================
// A1 acceptance rework — regression arms for the six material findings (CODE-01..06),
// the CLI boundary tightening, and the HOST-01 platform contract. CODE-01's alias arms
// live in row 16 (they belong with the other lock-contention arms); everything else in
// the rework scope is collected here, labelled by finding ID. (The run-aftermath test
// that closes the recorder lives AFTER this describe and the batch-2 and batch-3
// describes below — it must stay the LAST top-level test declaration so the endpoint
// is live for the whole claimed run.)
// ===========================================================================
describe('A1 rework regression arms (CODE-02..06 + HOST-01)', () => {
  ltest('A1-CODE-02: a stale-custody done never advances routing for the current worker (reconcile AND status)', async (t) => {
    const fx = makeFixture(t);
    // No live worker is bound, so the CLI transfer door needs no cessation ack — the
    // point of this arm is the ROUTING consequence of a custody advance, not the ack.
    assert.equal(runCli(initArgs(fx, ['--task-id', 't-1'])).status, 0);
    const moved = runCli(recArgs(fx, ['--transfer-custody', 'w-2', '--control-reason', 'custody moves to w-2']));
    assert.equal(moved.status, 0, moved.stdout + moved.stderr);
    assert.equal(moved.json.custodyGeneration, 2);
    const late = runCli(recArgs(fx, ['--observation', obs('late-superseded', 'done', { custodyGeneration: 1 })]));
    assert.equal(late.status, 0);
    assert.equal(late.json.observationDisposition, 'historical-stale-custody');
    assert.equal(late.json.route, 'observe', 'a superseded worker\'s done must not route review for the CURRENT worker');
    assert.match(late.json.routeReason, /stale against current custody/);
    const st = runCli(['status', '--record', fx.recordPath]);
    assert.equal(st.json.route, 'observe', 'status derives from the SAME eligibility rule — no second opinion');
    assert.match(st.json.routeReason, /stale against current custody/);
    const still = runCli(recArgs(fx, ['--request-action', 'work']));
    assert.equal(still.status, 0, 'the current worker is not punished for a stale report');
    assert.equal(still.json.route, 'hold');
    assert.equal(still.json.routeReason, 'intent_outcome_uncertain');
    rmSync(fx.base, { recursive: true, force: true });
  });

  ltest('A1-CODE-02: a superseded candidate\'s consumed done stops routing review after a candidate advance', async (t) => {
    const fx = makeFixture(t);
    assert.equal(runCli(initArgs(fx, ['--task-id', 't-1', '--candidate-revision', '1', '--candidate-sha256', sha256Hex('c1')])).status, 0);
    assert.equal(runCli(recArgs(fx, ['--observation', obs('done-c1', 'done', { candidateRevision: 1 })])).status, 0);
    // INVALIDATED POSITIVE (fidelity-r2 F-1): the r1 sanity leg needed the `complete`
    // route, reachable then via a sourced (digest-verifying) receipt. Since the repair,
    // no delivery routes complete — the sourced receipt routes `review` like any other —
    // so this arm pins the INVARIANT underneath: the advance retires the done as routing
    // evidence for the CURRENT worker (the door/route consistency A1-CODE-02 pins).
    const c1Evidence = evidenceArtifact(fx, 'delivery-c1.json', { delivered: true, receipt: 'receipt-c1', candidate: 1 });
    assert.equal(runCli(recArgs(fx, ['--delivery-receipt', 'receipt-c1',
      '--delivery-evidence-ref', c1Evidence.path, '--delivery-evidence-sha256', c1Evidence.sha256])).status, 0);
    const before = runCli(['status', '--record', fx.recordPath]);
    assert.equal(before.json.route, 'review', 'done + current receipt routes review — stage A never routes complete');
    const advanced = runCli(recArgs(fx, ['--candidate-revision', '2', '--candidate-sha256', sha256Hex('c2')]));
    assert.equal(advanced.status, 0);
    assert.ok(advanced.json.effects.includes('candidate-updated:2'));
    const after = runCli(recArgs(fx, []));
    assert.equal(after.json.route, 'observe', 'the candidate advance must retire the old done as routing evidence');
    assert.match(after.json.routeReason, /stale against current custody\/candidate/);
    const stAfter = runCli(['status', '--record', fx.recordPath]);
    assert.equal(stAfter.json.route, 'observe');
    assert.equal(stAfter.json.record.controlState, 'active', 'an advance supersedes routing, it does not complete the binding');
    rmSync(fx.base, { recursive: true, force: true });
  });

  ltest('A1-CODE-02/R2-01: absent provenance is FROZEN at ingestion — current until an advance retires it (reconcile AND status)', async (t) => {
    const fx = makeFixture(t);
    assert.equal(runCli(initArgs(fx, ['--task-id', 't-1'])).status, 0);
    assert.equal(runCli(recArgs(fx, ['--observation', obs('no-provenance', 'done')])).status, 0);
    const st = runCli(['status', '--record', fx.recordPath]);
    assert.equal(st.json.route, 'review', 'a no-provenance report is stamped with the ingestion-time custody/candidate and is current while nothing advances');
    const stored = st.json.record.observations[0];
    assert.equal(stored.applicableCustody, 1, 'the ingestion-time custody generation was frozen onto the entry');
    assert.equal(stored.applicableCandidate, 0, 'the ingestion-time candidate revision was frozen onto the entry');
    assert.equal(stored.custodyGeneration, null, 'the REPORTED provenance stays null — dedup compares what the worker said');
    // INVALIDATED POSITIVE (fidelity-r2 F-1): the r1 sanity leg asserted the sourced
    // receipt routes `complete` before any advance; routing complete no longer exists,
    // so the sanity pin is the honest `review` route the same state now yields.
    const npEvidence = evidenceArtifact(fx, 'delivery-np.json', { delivered: true, receipt: 'receipt-np' });
    const receipted = runCli(recArgs(fx, ['--delivery-receipt', 'receipt-np',
      '--delivery-evidence-ref', npEvidence.path, '--delivery-evidence-sha256', npEvidence.sha256]));
    assert.equal(receipted.json.route, 'review', 'sanity: the current done report routes review — never complete in stage A');
    // Custody advance retires the frozen report — for BOTH doors.
    const moved = runCli(recArgs(fx, ['--transfer-custody', 'w-2', '--control-reason', 'custody advances past the frozen report']));
    assert.equal(moved.status, 0, moved.stdout + moved.stderr);
    const afterCustody = runCli(recArgs(fx, []));
    assert.equal(afterCustody.json.route, 'observe', 'the custody advance retired the frozen done as routing evidence');
    assert.match(afterCustody.json.routeReason, /stale against current custody/);
    const stAfter = runCli(['status', '--record', fx.recordPath]);
    assert.equal(stAfter.json.route, 'observe', 'status derives from the SAME frozen applicability — no second opinion');
    assert.match(stAfter.json.routeReason, /stale against current custody/);
    rmSync(fx.base, { recursive: true, force: true });
  });

  ltest('A1-CODE-03: cancel-pending + transfer/ack persists the prerequisite hold (no cessation fact — fidelity-r2 F-2) and registers NO successor worker', async (t) => {
    const t2 = makeFixture(t);
    const bound = await initBinding(initBindingInput(t2));
    assert.ok(bound.ok, JSON.stringify(bound));
    const cancel = await reconcile({ ...reconcileInput(t2), control: { kind: 'cancel', actor: 'operator:matrix' } });
    assert.ok(cancel.ok);
    assert.equal(cancel.controlState, 'cancel-pending');
    // Fidelity-r1 F-2: with task t-1 still bound, the composed bare ack cannot settle the
    // cancellation — the refusal persists the cessation_unconfirmed hold and the record
    // stays cancel-pending (no synthetic stopped disposition, no successor).
    const attempted = await reconcile({ ...reconcileInput(t2), transferCustody: { toSession: 'w-2', acknowledgeCessation: true, reason: 'composed cancel-ack + transfer' } });
    assert.equal(attempted.ok, false);
    assert.equal(attempted.code, 'cessation_unconfirmed');
    const pendingRecord = JSON.parse(readFileSync(t2.recordPath, 'utf8'));
    assert.equal(pendingRecord.controlState, 'cancel-pending', 'the cancellation is NOT completed on a bare ack');
    assert.ok(pendingRecord.holds.some((h) => h.code === 'cessation_unconfirmed' && h.clearedAt === null), 'the prerequisite hold is persisted');
    assert.equal(pendingRecord.custodyGeneration, 1, 'custody never advanced onto the pending binding');
    assert.ok(!JSON.stringify(pendingRecord).includes('"w-2"'), 'no successor session id anywhere in the durable record');
    // INVALIDATED POSITIVE (fidelity-r2 F-2): the r1 arm settled the cancellation with a
    // digest-verifying evidence file for the bound task. The artifact authenticates as
    // bytes but never establishes the referenced subsystem's stop — a sourced ack is
    // refused exactly like a bare one and the pending state is retained.
    const settled = await reconcile({ ...reconcileInput(t2), control: { kind: 'ack-cessation', actor: 'operator:matrix', reason: 'verified terminal record for the bound task', cessationEvidence: evidenceArtifact(t2, 'cessation-code03.json', { task: 't-1', terminal: 'cancelled', source: 'aif-runtime' }) } });
    assert.equal(settled.ok, false, JSON.stringify(settled));
    assert.equal(settled.code, 'cessation_unconfirmed');
    const afterRefusal = JSON.parse(readFileSync(t2.recordPath, 'utf8'));
    assert.equal(afterRefusal.controlState, 'cancel-pending', 'sourced evidence did not complete the cancellation');
    assert.equal(afterRefusal.worker.cessationAckedAt, null, 'no caller-supplied settlement stamped the worker');
    rmSync(t2.base, { recursive: true, force: true });
    // The terminal gate this arm pins — a terminal binding registers NO successor worker
    // (custody_transfer_terminal, original worker preserved) — is exercised on the
    // REACHABLE terminal path: a taskless sibling binding whose LOCAL worker
    // acknowledges its own cessation (the one independent stage-A mechanism).
    const t3 = makeFixture(t);
    const sibling = await initBinding({ ...initBindingInput(t3), taskId: null });
    assert.ok(sibling.ok, JSON.stringify(sibling));
    const sibCancel = await reconcile({ ...reconcileInput(t3), control: { kind: 'cancel', actor: 'operator:matrix' } });
    assert.ok(sibCancel.ok, JSON.stringify(sibCancel));
    assert.equal(sibCancel.controlState, 'cancel-pending', 'the live local worker defers the cancellation to its own acknowledgement');
    const sibAck = await reconcile({ ...reconcileInput(t3), control: { kind: 'ack-cessation', actor: 'worker:w-1', reason: 'worker confirms its own cancellation' } });
    assert.ok(sibAck.ok, JSON.stringify(sibAck));
    assert.equal(sibAck.controlState, 'cancelled');
    const afterSettled = await reconcile({ ...reconcileInput(t3), transferCustody: { toSession: 'w-2', acknowledgeCessation: true, reason: 'post-settlement transfer attempt' } });
    assert.equal(afterSettled.ok, false);
    assert.equal(afterSettled.code, 'custody_transfer_terminal');
    assert.match(afterSettled.reason, /terminal/);
    const st = runCli(['status', '--record', t3.recordPath]);
    assert.equal(st.json.record.controlState, 'cancelled', 'the worker\'s own ack completed the cancellation');
    assert.equal(st.json.record.worker.sessionId, 'w-1', 'the ORIGINAL worker stays recorded — no fresh live worker');
    assert.ok(st.json.record.worker.cessationAckedAt !== null, 'the cessation acknowledgement is persisted');
    assert.equal(st.json.record.custodyGeneration, 1, 'custody never advanced onto the terminal binding');
    const workers = JSON.stringify(st.json.record);
    assert.ok(!workers.includes('"w-2"'), 'no successor session id anywhere in the durable record');
    rmSync(t3.base, { recursive: true, force: true });
  });

  ltest('A1-CODE-03/R2-02: pause-pending + transfer/ack persists the prerequisite hold (no cessation fact — fidelity-r2 F-2) but registers NO successor (pause blocks admission)', async (t) => {
    const t2 = makeFixture(t);
    assert.ok((await initBinding(initBindingInput(t2))).ok);
    const pause = await reconcile({ ...reconcileInput(t2), control: { kind: 'pause', actor: 'operator:matrix' } });
    assert.equal(pause.controlState, 'pause-pending');
    const before = JSON.parse(readFileSync(t2.recordPath, 'utf8'));
    // Fidelity-r1 F-2: task t-1 is still bound — the composed bare ack cannot settle the
    // pause. The refusal persists the prerequisite hold (this pass's durable fact) and
    // the record stays pause-pending with admission blocked.
    const refused = await reconcile({ ...reconcileInput(t2), transferCustody: { toSession: 'w-2', acknowledgeCessation: true, reason: 'pause-pending ack must not install a successor' } });
    assert.equal(refused.ok, false, JSON.stringify(refused));
    assert.equal(refused.code, 'cessation_unconfirmed');
    const pendingRecord = JSON.parse(readFileSync(t2.recordPath, 'utf8'));
    assert.equal(pendingRecord.controlState, 'pause-pending', 'no synthetic stopped disposition — the pause stays pending');
    assert.ok(pendingRecord.holds.some((h) => h.code === 'cessation_unconfirmed' && h.clearedAt === null), 'the prerequisite hold is persisted');
    assert.equal(pendingRecord.recordRevision, before.recordRevision + 1, 'exactly the hold moved the record');
    assert.ok(!JSON.stringify(pendingRecord).includes('"w-2"'), 'no successor session id anywhere in the durable record');
    // INVALIDATED POSITIVE (fidelity-r2 F-2): the r1 arm completed the pause with a
    // digest-verifying evidence file for the bound task — withdrawn with F-1 (see the
    // A1-CODE-03 arm). A sourced ack is refused like a bare one; the pause stays pending.
    const settled = await reconcile({ ...reconcileInput(t2), control: { kind: 'ack-cessation', actor: 'operator:matrix', reason: 'verified terminal record for the bound task', cessationEvidence: evidenceArtifact(t2, 'cessation-r202.json', { task: 't-1', terminal: 'suspended', source: 'aif-runtime' }) } });
    assert.equal(settled.ok, false, JSON.stringify(settled));
    assert.equal(settled.code, 'cessation_unconfirmed');
    assert.equal(JSON.parse(readFileSync(t2.recordPath, 'utf8')).controlState, 'pause-pending', 'sourced evidence did not complete the pause');
    rmSync(t2.base, { recursive: true, force: true });
    // The paused-state properties this arm pins — original worker preserved, route hold
    // `control_state_paused`, no successor admission ever — are exercised on the
    // REACHABLE paused path: a taskless sibling binding whose LOCAL worker acknowledges
    // its own suspension (the one independent stage-A mechanism).
    const t3 = makeFixture(t);
    const sibling = await initBinding({ ...initBindingInput(t3), taskId: null });
    assert.ok(sibling.ok, JSON.stringify(sibling));
    const sibPause = await reconcile({ ...reconcileInput(t3), control: { kind: 'pause', actor: 'operator:matrix' } });
    assert.equal(sibPause.controlState, 'pause-pending');
    const sibAck = await reconcile({ ...reconcileInput(t3), control: { kind: 'ack-cessation', actor: 'worker:w-1', reason: 'worker confirms its own suspension' } });
    assert.ok(sibAck.ok, JSON.stringify(sibAck));
    assert.equal(sibAck.controlState, 'paused');
    const after = JSON.parse(readFileSync(t3.recordPath, 'utf8'));
    assert.equal(after.controlState, 'paused', 'the worker\'s own ack completed the pause');
    assert.equal(after.worker.sessionId, 'w-1', 'the ORIGINAL worker stays recorded');
    assert.ok(after.worker.cessationAckedAt !== null, 'the cessation acknowledgement is persisted');
    assert.equal(after.custodyGeneration, 1, 'custody never advanced onto a paused binding');
    const st = runCli(['status', '--record', t3.recordPath]);
    assert.equal(st.json.route, 'hold');
    assert.equal(st.json.routeReason, 'control_state_paused', 'a paused binding routes hold — no successor admission, no stale-report routing');
    // A later reconciliation still cannot install a worker on the paused record.
    const again = await reconcile({ ...reconcileInput(t3), transferCustody: { toSession: 'w-3' } });
    assert.equal(again.ok, false);
    assert.equal(again.code, 'custody_transfer_blocked');
    const final = JSON.parse(readFileSync(t3.recordPath, 'utf8'));
    assert.equal(final.custodyGeneration, 1, 'still no custody advance');
    assert.ok(!JSON.stringify(final).includes('"w-3"'), 'no successor was installed on the second attempt either');
    rmSync(t3.base, { recursive: true, force: true });
  });

  ltest('R2-02: an already-paused record without a live worker admits no successor and stays byte-identical', async (t) => {
    const t2 = makeFixture(t);
    assert.ok((await initBinding(initBindingInput(t2))).ok);
    const pause = await reconcile({ ...reconcileInput(t2), control: { kind: 'pause', actor: 'operator:matrix' } });
    assert.equal(pause.controlState, 'pause-pending', 'the live w-1 worker makes the pause cessation-pending');
    // INVALIDATED POSITIVE (fidelity-r2 F-2): the r1 arm reached 'paused' with a
    // digest-verifying evidence file for the bound task. Both a bare and a sourced ack
    // are refused on the bound task (see the state-machine arm for the full note) —
    // the pending state is retained here.
    const bare = await reconcile({ ...reconcileInput(t2), control: { kind: 'ack-cessation', actor: 'worker:w-1' } });
    assert.equal(bare.ok, false);
    assert.equal(bare.code, 'cessation_unconfirmed');
    const acked = await reconcile({ ...reconcileInput(t2), control: { kind: 'ack-cessation', actor: 'worker:w-1', cessationEvidence: evidenceArtifact(t2, 'cessation-r202b.json', { task: 't-1', terminal: 'suspended', source: 'aif-runtime' }) } });
    assert.equal(acked.ok, false, JSON.stringify(acked));
    assert.equal(acked.code, 'cessation_unconfirmed');
    assert.equal(JSON.parse(readFileSync(t2.recordPath, 'utf8')).controlState, 'pause-pending', 'sourced evidence did not settle the bound task');
    rmSync(t2.base, { recursive: true, force: true });
    // The paused-record properties this arm pins — successor admission refused with a
    // byte-identical record — are exercised on the REACHABLE paused path (taskless
    // sibling, local worker's own acknowledgement).
    const t3 = makeFixture(t);
    const sibling = await initBinding({ ...initBindingInput(t3), taskId: null });
    assert.ok(sibling.ok, JSON.stringify(sibling));
    await reconcile({ ...reconcileInput(t3), control: { kind: 'pause', actor: 'operator:matrix' } });
    const sibAck = await reconcile({ ...reconcileInput(t3), control: { kind: 'ack-cessation', actor: 'worker:w-1', reason: 'worker confirms its own suspension' } });
    assert.equal(sibAck.controlState, 'paused');
    const beforeSha = fileSha(t3.recordPath);
    const refused = await reconcile({ ...reconcileInput(t3), transferCustody: { toSession: 'w-2', acknowledgeCessation: true } });
    assert.equal(refused.ok, false);
    assert.equal(refused.code, 'custody_transfer_blocked');
    assert.match(refused.reason, /does not admit a successor worker/);
    // T-A1-R2-D: nothing moved — no ack arm ran, so the refusal must not touch bytes.
    assert.equal(fileSha(t3.recordPath), beforeSha, 'a clean refusal on a paused record leaves the durable bytes identical');
    rmSync(t3.base, { recursive: true, force: true });
  });

  ltest('R2-02: a valid ACTIVE transfer with cessation acknowledgement stays a positive (custody advances, successor installed)', async (t) => {
    const t2 = makeFixture(t);
    assert.ok((await initBinding(initBindingInput(t2))).ok);
    const moved = await reconcile({ ...reconcileInput(t2), transferCustody: { toSession: 'w-2', acknowledgeCessation: true, reason: 'active transfer with explicit ack' } });
    assert.ok(moved.ok, JSON.stringify(moved));
    assert.equal(moved.controlState, 'active');
    assert.equal(moved.custodyGeneration, 2);
    assert.equal(moved.effects.includes('custody-transferred:2'), true);
    const st = runCli(['status', '--record', t2.recordPath]);
    assert.equal(st.json.record.worker.sessionId, 'w-2', 'the successor is registered on the admitting record');
    assert.equal(st.json.record.worker.cessationAckedAt, null, 'the successor starts live');
    assert.equal(st.json.record.controlState, 'active');
    rmSync(t2.base, { recursive: true, force: true });
  });

  ltest('A1-CODE-04: ungranted completion records the receipt as a FACT and never reaches terminal (library arm)', async (t) => {
    const t2 = makeFixture(t);
    const bound = await initBinding({ ...initBindingInput(t2), actions: ['observe', 'hold'] });
    assert.ok(bound.ok);
    const denied = await reconcile({ ...reconcileInput(t2), deliveryReceipt: 'receipt-never-authorizes', markComplete: true });
    assert.equal(denied.ok, false);
    assert.equal(denied.code, 'action_not_granted');
    assert.match(denied.reason, /does not authorize completion/);
    const st = runCli(['status', '--record', t2.recordPath]);
    assert.equal(st.json.record.controlState, 'active', 'an ungranted completion never closes the binding');
    assert.ok(st.json.record.delivery !== null, 'the receipt stays a recorded fact, separable from the rejected transition');
    rmSync(t2.base, { recursive: true, force: true });
  });

  ltest('A1-CODE-04: completion with an unresolved effect is refused — the intent must be resolved first', async (t) => {
    const t2 = makeFixture(t);
    assert.ok((await initBinding(initBindingInput(t2))).ok);
    const planned = runCli(recArgs(t2, ['--request-action', 'work']));
    assert.equal(planned.status, 0);
    const denied = await reconcile({ ...reconcileInput(t2), deliveryReceipt: 'receipt-over-uncertainty', markComplete: true });
    assert.equal(denied.ok, false);
    assert.equal(denied.code, 'intent_outstanding');
    assert.match(denied.reason, /unverified external effect/);
    const st = runCli(['status', '--record', t2.recordPath]);
    assert.equal(st.json.record.controlState, 'active');
    assert.equal(st.json.record.pendingIntent.state, 'intent_persisted', 'the unresolved intent survives the rejected completion');
    rmSync(t2.base, { recursive: true, force: true });
  });

  ltest('A1-CODE-04: the CLI completion door carries the same grant admission (composed reconcile + --mark-complete)', async (t) => {
    const fx = makeFixture(t);
    const init = runCli([...initArgs(fx, ['--task-id', 't-1']), '--actions', 'observe,hold']);
    assert.equal(init.status, 0);
    const denied = runCli(recArgs(fx, ['--delivery-receipt', 'receipt-cli-ungranted', '--mark-complete']));
    assert.equal(denied.status, 2);
    assert.equal(denied.json.code, 'action_not_granted');
    const st = runCli(['status', '--record', fx.recordPath]);
    assert.equal(st.json.record.controlState, 'active');
    assert.ok(st.json.record.delivery !== null, 'CLI receipt still persisted as a fact');
    rmSync(fx.base, { recursive: true, force: true });
  });

  ltest('A1-CODE-05: a selector naming a FOREIGN repository cannot authorize transitions (two-real-repository negative)', async (t) => {
    const fx = makeFixture(t); // repository A — the binding's home
    assert.ok((await initBinding(initBindingInput(fx))).ok);
    const foreign = makeFixture(t); // repository B — identical CONTENT bytes, different identity
    foreign.bumpSelector(7); // make B's selector differ, so an authority refresh would be observable
    // The foreign-identity selector is served AT THE BOUND HOME so the R2-03 home pin
    // stays silent and the IDENTITY gate is demonstrably what fires (the selector
    // lookup itself keys on the repoRoot-derived identity, so a foreign repoRoot with
    // the bound home's own selector never even reaches this gate — that shape is the
    // R2-03 arms' subject). A foreign-IDENTITY selector at the selected path must not
    // authorize this record either.
    const fxSelectorBytes = readFileSync(fx.selectorPath);
    writeFileSync(fx.selectorPath, readFileSync(foreign.selectorPath));
    const foreignRead = await reconcile({ ...reconcileInput(fx), repoRoot: foreign.repo, featureHome: fx.home });
    assert.equal(foreignRead.ok, true, 'a foreign read is a recorded HOLD, not a crash');
    assert.ok(foreignRead.effects.includes('authority-identity-mismatch'), JSON.stringify(foreignRead.effects));
    const blocked = await reconcile({ ...reconcileInput(fx), repoRoot: foreign.repo, featureHome: fx.home, requestAction: 'work' });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.code, 'authority_hold_open', 'the same pass cannot both open the identity hold and admit work');
    const st = runCli(['status', '--record', fx.recordPath]);
    assert.equal(st.json.route, 'hold');
    assert.equal(st.json.routeReason, 'authority_identity_mismatch');
    assert.equal(st.json.record.authority.selectorRevision, 1, 'the foreign selector NEVER refreshed the durable authority');
    assert.ok(st.json.record.holds.some((h) => h.code === 'authority_identity_mismatch' && h.clearedAt === null));
    // Recovery: the binding's OWN selector restored at the selected home → stable read.
    writeFileSync(fx.selectorPath, fxSelectorBytes);
    const settled = await reconcile(reconcileInput(fx)); // same-repository stable read
    assert.ok(settled.effects.includes('authority-stable'), 'the identity hold clears on a same-repository stable read');
    const admitted = await reconcile({ ...reconcileInput(fx), requestAction: 'work' });
    assert.equal(admitted.ok, true, 'recovery: admission resumes against the binding\'s OWN repository');
    assert.equal(admitted.route, 'hold');
    assert.equal(admitted.routeReason, 'intent_outcome_uncertain');
    rmSync(fx.base, { recursive: true, force: true });
    rmSync(foreign.base, { recursive: true, force: true });
  });

  ltest('A1-CODE-05: a sibling worktree of the SAME repository shares one identity (positive)', async (t) => {
    const fx = makeFixture(t);
    const wt = join(fx.base, 'wt');
    mkdirSync(wt, { recursive: true });
    // A real linked-worktree shape: `.git` is a FILE pointing at <common>/worktrees/<name>.
    mkdirSync(join(fx.repo, '.git', 'worktrees', 'wt'), { recursive: true });
    writeFileSync(join(wt, '.git'), `gitdir: ${join(fx.repo, '.git', 'worktrees', 'wt')}\n`);
    // A worktree shares the repository CONTENT: the PRD/spec bytes (and their hashes)
    // must resolve against the worktree root exactly as against the main checkout.
    for (const name of ['prd.md', 'prd-approval.json', 'spec.md', 'spec-agreement.json']) {
      writeFileSync(join(wt, name), readFileSync(join(fx.repo, name)));
    }
    const wtStage = join(wt, 'artifacts', STAGE);
    mkdirSync(wtStage, { recursive: true });
    const wtRecord = join(wtStage, 'binding.json');
    const bound = runCli([
      'init', '--record', wtRecord, '--repo-root', wt, '--feature', FID, '--stage', STAGE,
      '--stage-artifact-root', wtStage, '--feature-home', fx.home,
      '--actions', 'observe,work,review,hold,complete', '--destination', 'pr:staging', '--task-id', 't-1', '--now', iso(),
    ]);
    assert.equal(bound.status, 0, bound.stdout + bound.stderr);
    const fromMain = runCli(['reconcile', '--record', wtRecord, '--repo-root', fx.repo, '--feature-home', fx.home, '--now', iso()]);
    assert.equal(fromMain.status, 0, fromMain.stdout + fromMain.stderr);
    assert.equal(fromMain.json.effects.includes('authority-identity-mismatch'), false, 'the main checkout is the SAME repository through the common git dir');
    assert.equal(fromMain.json.holds.length, 0, JSON.stringify(fromMain.json.holds));
    assert.equal(fromMain.json.route, 'observe');
    rmSync(fx.base, { recursive: true, force: true });
  });

  ltest('A1-CODE-05/CLI boundary: --feature-home is FORWARDED and a selector naming a foreign repository trips the identity gate through the CLI (bound home passed, so the identity gate — not the R2-03 home pin — fires)', async (t) => {
    const fx = makeFixture(t);
    assert.equal(runCli(initArgs(fx, ['--task-id', 't-1'])).status, 0);
    const foreign = makeFixture(t);
    writeFileSync(fx.selectorPath, readFileSync(foreign.selectorPath)); // foreign-IDENTITY selector at the selected path
    const res = runCli(['reconcile', '--record', fx.recordPath, '--repo-root', foreign.repo, '--feature-home', fx.home, '--now', iso()]);
    assert.equal(res.status, 0);
    assert.ok(res.json.effects.includes('authority-identity-mismatch'), 'the CLI forwards the override to the engine — the gate sees what the caller passed');
    assert.equal(res.json.holds.some((h) => h.code === 'authority_identity_mismatch'), true);
    rmSync(fx.base, { recursive: true, force: true });
    rmSync(foreign.base, { recursive: true, force: true });
  });

  ltest('R2-03: an ordinary --feature-home override to a DIFFERENT directory holds — a copied selector cannot replace the selected current source (recovery via the bound home)', async (t) => {
    const fx = makeFixture(t);
    assert.equal(runCli(initArgs(fx, ['--task-id', 't-1'])).status, 0);
    // A same-repository copy of the selector in another directory, advanced ahead of the
    // bound source — exactly the shape that used to refresh authority and admit work.
    const home2 = join(fx.base, 'feature-home-2');
    mkdirSync(home2, { recursive: true });
    const doc = JSON.parse(readFileSync(fx.selectorPath, 'utf8'));
    doc.features[FID].revision = 2;
    writeFileSync(join(home2, 'current-decisions.json'), JSON.stringify(doc, null, 2));
    const res = runCli(['reconcile', '--record', fx.recordPath, '--repo-root', fx.repo, '--feature-home', home2, '--now', iso()]);
    assert.equal(res.status, 0);
    assert.ok(res.json.effects.includes('authority-home-mismatch'), 'the override home was NOT read — the pin fired before any live read');
    assert.equal(res.json.holds.some((h) => h.code === 'authority_home_mismatch'), true);
    assert.equal(res.json.route, 'hold');
    assert.equal(res.json.routeReason, 'authority_home_mismatch');
    assert.equal(JSON.parse(readFileSync(fx.recordPath, 'utf8')).authority.selectorRevision, 1, 'the copied selector NEVER refreshed the durable authority');
    assert.equal(res.json.pendingIntent, null, 'no action intent was planned off a rejected home');
    // The same pass cannot both open the home hold and admit work.
    const blocked = runCli(['reconcile', '--record', fx.recordPath, '--repo-root', fx.repo, '--feature-home', home2, '--request-action', 'work', '--now', iso()]);
    assert.equal(JSON.parse(blocked.stdout).code, 'authority_hold_open');
    // Recovery: a reconcile against the BOUND home is a stable read — the home hold
    // clears (and the selector at the bound home is unchanged, so no refresh fires).
    const settled = runCli(['reconcile', '--record', fx.recordPath, '--repo-root', fx.repo, '--feature-home', fx.home, '--now', iso()]);
    assert.equal(settled.status, 0);
    assert.ok(JSON.parse(settled.stdout).effects.includes('authority-stable'), 'the home hold clears on a bound-home stable read');
    const st = runCli(['status', '--record', fx.recordPath]);
    assert.equal(st.json.route, 'observe', JSON.stringify(st.json));
    assert.ok(st.json.record.holds.every((h) => h.clearedAt !== null), 'no authority hold survives the bound-home read');
    rmSync(fx.base, { recursive: true, force: true });
  });

  test('A1-CODE-06: validateRetryTiming unit matrix — every accepted config has a finite bounded wait', () => {
    assert.equal(validateRetryTiming({ retryBudgetMs: 0, retryDelayMs: 0 }).ok, true, 'zero is a valid immediate-give-up configuration');
    assert.equal(validateRetryTiming({ retryBudgetMs: 1, retryDelayMs: LOCK_RETRY_MAX_MS }).ok, true);
    assert.equal(validateRetryTiming({}).ok, true, 'absent timing falls back to the bounded defaults');
    for (const [name, value] of [['NaN', Number.NaN], ['Infinity', Number.POSITIVE_INFINITY], ['negative', -1], ['fractional', 1.5], ['string', '500'], ['oversized', LOCK_RETRY_MAX_MS + 1]]) {
      const res = validateRetryTiming({ retryBudgetMs: value });
      assert.equal(res.ok, false, `${name} must reject`);
      assert.equal(res.code, 'invalid_request');
      assert.match(res.reason, /finite non-negative integer/);
    }
    const delayOnly = validateRetryTiming({ retryDelayMs: -5 });
    assert.equal(delayOnly.ok, false);
    assert.match(delayOnly.reason, /retryDelayMs/);
  });

  test('A1-CODE-06/CLI boundary: malformed timing flags, unknown flags and missing values reject structurally BEFORE any record interaction', () => {
    const fx = makeFixture(null);
    const missing = runCli(['reconcile', '--record', fx.recordPath, '--lock-retry-budget-ms', 'nope', '--now', iso()]);
    assert.equal(missing.status, 2);
    assert.equal(missing.json.code, 'invalid_request');
    assert.match(missing.json.reason, /lock-retry-budget-ms/);
    assert.equal(existsSync(fx.recordPath), false, 'no record was created by a rejected invocation');
    const inf = runCli(['reconcile', '--record', fx.recordPath, '--lock-retry-delay-ms', 'Infinity']);
    assert.equal(inf.status, 2);
    assert.equal(inf.json.code, 'invalid_request');
    assert.equal(existsSync(fx.recordPath), false);
    const oversized = runCli([...initArgs(fx), '--lock-retry-budget-ms', String(LOCK_RETRY_MAX_MS + 1)]);
    assert.equal(oversized.status, 2);
    assert.equal(oversized.json.code, 'invalid_request');
    assert.equal(existsSync(fx.recordPath), false, 'init rejects a malformed budget before binding');
    const unknownFlag = runCli(['reconcile', '--recod', fx.recordPath]);
    assert.equal(unknownFlag.status, 2);
    assert.equal(unknownFlag.json.code, 'invalid_request');
    assert.match(unknownFlag.json.reason, /unknown flag --recod/);
    const missingValue = runCli(['status', '--record']);
    assert.equal(missingValue.status, 2);
    assert.equal(missingValue.json.code, 'invalid_request');
    assert.match(missingValue.json.reason, /needs a value/);
    const flagAsValue = runCli(['status', '--record', '--now']);
    assert.equal(flagAsValue.status, 2);
    assert.equal(flagAsValue.json.code, 'invalid_request');
    assert.match(flagAsValue.json.reason, /needs a value/, 'a following flag is not a value');
    assert.equal(existsSync(fx.recordPath), false);
    rmSync(fx.base, { recursive: true, force: true });
  });

  ltest('A1-CODE-06: a valid bounded budget still contends (the accepted configuration has a finite wait, proven against a live holder)', async (t) => {
    const fx = makeFixture(t);
    assert.equal(runCli(initArgs(fx, ['--task-id', 't-1'])).status, 0);
    const holder = spawnCli(recArgs(fx, ['--test-hold-lock-ms', '1200']));
    await sleep(250); // let the holder take the lock
    const loser = runCli(recArgs(fx, ['--lock-retry-budget-ms', '300', '--lock-retry-delay-ms', '50']));
    assert.equal(loser.status, 2);
    assert.equal(loser.json.code, 'lock_contended');
    await holder.done;
    rmSync(fx.base, { recursive: true, force: true });
  });

  ltest('A1 coverage: observationId reuse with CONFLICTING facts is duplicate-conflict — stored as audit data, never routed', async (t) => {
    const fx = makeFixture(t);
    assert.equal(runCli(initArgs(fx, ['--task-id', 't-1'])).status, 0);
    assert.equal(runCli(recArgs(fx, ['--observation', obs('same-id', 'done')])).status, 0);
    const conflict = runCli(recArgs(fx, ['--observation', obs('same-id', 'parked')]));
    assert.equal(conflict.status, 0);
    assert.equal(conflict.json.observationDisposition, 'duplicate-conflict');
    const st = runCli(['status', '--record', fx.recordPath]);
    assert.equal(st.json.record.observations.length, 2, 'the conflicting reuse is retained as audit data');
    assert.equal(st.json.route, 'review', 'routing still follows the original consumed done — the conflict never routes');
    const again = runCli(recArgs(fx, ['--observation', obs('same-id', 'done')]));
    assert.equal(again.json.observationDisposition, 'duplicate', 'the identical fact remains idempotent');
    assert.equal(runCli(['status', '--record', fx.recordPath]).json.record.observations.length, 2, 'a duplicate burns no entry');
    rmSync(fx.base, { recursive: true, force: true });
  });

  ltest('A1 coverage: the observation window is bounded and eviction re-admits an evicted id (library arm)', async (t) => {
    const t2 = makeFixture(t);
    assert.ok((await initBinding(initBindingInput(t2))).ok);
    for (let i = 1; i <= 101; i += 1) {
      const res = await reconcile({ ...reconcileInput(t2), observation: { taskId: 't-1', kind: 'parked', observationId: `o-${String(i).padStart(3, '0')}` } });
      assert.ok(res.ok, JSON.stringify(res));
    }
    const full = runCli(['status', '--record', t2.recordPath]);
    assert.equal(full.json.record.observations.length, 100, 'the window is bounded at 100');
    assert.equal(full.json.record.observations[0].observationId, 'o-002', 'o-001 was evicted oldest-first');
    const readmit = await reconcile({ ...reconcileInput(t2), observation: { taskId: 't-1', kind: 'parked', observationId: 'o-001' } });
    assert.equal(readmit.ok, true);
    assert.equal(readmit.observationDisposition, 'consumed', 'o-001 was evicted — the id is legitimately re-admitted, not a duplicate');
    const st = runCli(['status', '--record', t2.recordPath]);
    assert.equal(st.json.record.observations.length, 100, 'the window stays bounded after re-admission');
    assert.equal(st.json.record.observations[99].observationId, 'o-001');
    rmSync(t2.base, { recursive: true, force: true });
  });

  test('HOST-01 mechanics: the engine platform gate rejects a non-Linux init with NO record written (_testPlatform seam — drives the real gate)', async () => {
    const fx = makeFixture(null);
    const res = await initBinding({ ...initBindingInput(fx), _testPlatform: 'darwin' });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'unsupported_pending_prerequisite');
    assert.match(res.reason, /linux/i);
    assert.equal(existsSync(fx.recordPath), false, 'a fail-closed platform gate must not create a record');
    rmSync(fx.base, { recursive: true, force: true });
  });

  test('HOST-01 mechanics: a non-Linux reconcile leaves the durable record byte-identical and non-terminal (_testPlatform seam)', async () => {
    const fx = makeFixture(null);
    mkdirSync(fx.stageRoot, { recursive: true });
    // Host-independent record construction: the seed never goes through the bind lock,
    // so this arm can run on ANY host — the gate being tested is the one in the engine.
    const seeded = initialRecord({ ...initRecordFields(), recordPath: fx.recordPath, stageArtifactRoot: fx.stageRoot }, { now: iso() });
    assert.ok(seeded.ok, JSON.stringify(seeded));
    // The locked target must be the record's CANONICAL path (R2-06: on macOS the
    // mkdtemp leaf under /var/folders canonicalizes to /private/var/folders — a lexical
    // lockedTarget fails the kernel lock bind on the real host, which is exactly what
    // broke this arm's fixture preparation there. The engine itself always locks the
    // canonical target, so the host-independent seed mirrors that here).
    const lockedTarget = resolveRecordTarget(canonicalRecordPath(fx.recordPath));
    assert.ok(lockedTarget !== null, 'the seeded record path has a resolvable canonical lock target');
    const written = writeRecordAtomic(fx.recordPath, seeded.value, { lockedTarget, expectedRevision: 0 });
    assert.ok(written.ok, JSON.stringify(written));
    const before = fileSha(fx.recordPath);
    const res = await reconcile({ ...reconcileInput(fx), _testPlatform: 'win32' });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'unsupported_pending_prerequisite');
    assert.equal(fileSha(fx.recordPath), before, 'an unsupported platform holds with UNCHANGED durable state');
    const st = runCli(['status', '--record', fx.recordPath]);
    assert.equal(st.status, 0, 'status is a lock-free durable read — it works on any host');
    assert.equal(st.json.record.controlState, 'active');
    rmSync(fx.base, { recursive: true, force: true });
  });

  ntest('HOST-01 real: on a real non-Linux host the CLI init exits 2 unsupported_pending_prerequisite with no record', async (t) => {
    const fx = makeFixture(t);
    const res = runCli(initArgs(fx));
    assert.equal(res.status, 2);
    assert.equal(res.json.code, 'unsupported_pending_prerequisite');
    assert.equal(existsSync(fx.recordPath), false);
  });

  ltest('HOST-01 negative control: the SAME fixtures bind successfully on Linux (attributability of the non-Linux hold)', async (t) => {
    const fx = makeFixture(t);
    const res = runCli(initArgs(fx));
    assert.equal(res.status, 0, res.stdout + res.stderr);
    assert.equal(res.json.ok, true);
    rmSync(fx.base, { recursive: true, force: true });
  });
});

// ===========================================================================
// A1 acceptance rework batch 2 — durable regression battery for the six R2 findings.
// Each arm names the invariant the owner's V2 blackbox harness pins, at suite depth
// (more assertions than the harness floor — the harness is a floor, not a ceiling).
// The run-aftermath test AFTER this describe stays the LAST top-level test so the
// recorder endpoint is live for every case claimed above.
// ===========================================================================
describe('A1 rework batch 2 (R2-01..R2-05 durable battery)', () => {
  // --- R2-01: observations are not evergreen -------------------------------
  ltest('R2-01: a candidate advance retires an unprovenanced done at BOTH doors — the historical report routes nothing for the successor', async (t) => {
    const fx = makeFixture(t);
    assert.equal(runCli(initArgs(fx, ['--task-id', 't-1', '--candidate-revision', '1', '--candidate-sha256', sha256Hex('c1')])).status, 0);
    const done = runCli(recArgs(fx, ['--observation', obs('u-done', 'done')]));
    assert.equal(done.status, 0, done.stdout + done.stderr);
    assert.equal(done.json.observationDisposition, 'consumed');
    assert.equal(done.json.route, 'review', 'the CURRENT candidate\'s done routes review');
    const stored = JSON.parse(readFileSync(fx.recordPath, 'utf8')).observations.at(-1);
    assert.equal(stored.observationId, 'u-done');
    assert.equal(stored.custodyGeneration, null, 'the REPORTED provenance stays null — dedup still compares what was reported');
    assert.equal(stored.applicableCandidate, 1, 'the INGESTION-TIME candidate is frozen on the entry');
    assert.equal(stored.disposition, 'consumed');
    assert.equal(runCli(recArgs(fx, ['--candidate-revision', '2', '--candidate-sha256', sha256Hex('c2')])).status, 0);
    const after = runCli(recArgs(fx, []));
    assert.equal(after.json.route, 'observe', 'the frozen entry no longer routes review for candidate 2');
    assert.match(after.json.routeReason, /stale against current custody\/candidate; awaiting a current report/);
    const st = runCli(['status', '--record', fx.recordPath]);
    assert.equal(st.json.route, 'observe', 'status agrees with reconcile — one routing rule, two doors');
    assert.match(st.json.routeReason, /stale against current custody\/candidate; awaiting a current report/);
    // Re-reporting the same id is still a duplicate (dedup compares REPORTED fields) —
    // and the duplicate ack cannot resurrect routing: the retained entry keeps the
    // frozen stamps the re-report does not touch.
    const again = runCli(recArgs(fx, ['--observation', obs('u-done', 'done')]));
    assert.equal(again.json.observationDisposition, 'duplicate');
    assert.equal(again.json.route, 'observe');
    assert.match(again.json.routeReason, /stale against current custody\/candidate/);
    rmSync(fx.base, { recursive: true, force: true });
  });

  ltest('R2-01: a FUTURE custody claim (999) is quarantined — retained as audit data, never routed, never completed on', async (t) => {
    const fx = makeFixture(t);
    assert.equal(runCli(initArgs(fx, ['--task-id', 't-1'])).status, 0);
    const future = runCli(recArgs(fx, ['--observation', obs('future-custody', 'done', { custodyGeneration: 999 })]));
    assert.equal(future.status, 0, future.stdout + future.stderr);
    assert.equal(future.json.observationDisposition, 'provenance-unestablished');
    assert.equal(future.json.route, 'observe', 'a quarantined report routes nothing');
    assert.match(future.json.routeReason, /awaiting a current report/);
    const st = runCli(['status', '--record', fx.recordPath]);
    assert.equal(['review', 'complete'].includes(st.json.route), false, JSON.stringify(st.json));
    const stored = JSON.parse(readFileSync(fx.recordPath, 'utf8')).observations.at(-1);
    assert.equal(stored.disposition, 'provenance-unestablished', 'the quarantine is the durable fact, not just the response');
    assert.equal(stored.custodyGeneration, 999, 'the claimed value is retained verbatim as audit data');
    assert.equal(stored.applicableCustody, 999, 'the frozen stamp equals the claimed provenance — eligibility can never resurrect it');
    rmSync(fx.base, { recursive: true, force: true });
  });

  ltest('R2-01: a FUTURE candidateRevision and a MALFORMED provenance value are quarantined — exact applicability is required, not clamped', async (t) => {
    const t2 = makeFixture(t);
    assert.ok((await initBinding(initBindingInput(t2))).ok);
    const futureCandidate = await reconcile({ ...reconcileInput(t2), observation: { taskId: 't-1', kind: 'done', observationId: 'f-cand', candidateRevision: 999 } });
    assert.equal(futureCandidate.ok, true, JSON.stringify(futureCandidate));
    assert.equal(futureCandidate.observationDisposition, 'provenance-unestablished');
    const malformed = await reconcile({ ...reconcileInput(t2), observation: { taskId: 't-1', kind: 'done', observationId: 'bad-cand', candidateRevision: -1 } });
    assert.equal(malformed.ok, true, JSON.stringify(malformed));
    assert.equal(malformed.observationDisposition, 'provenance-unestablished', 'a negative revision is malformed provenance, not «past» ');
    const malformedCustody = await reconcile({ ...reconcileInput(t2), observation: { taskId: 't-1', kind: 'done', observationId: 'bad-custody', custodyGeneration: 1.5 } });
    assert.equal(malformedCustody.ok, true, JSON.stringify(malformedCustody));
    assert.equal(malformedCustody.observationDisposition, 'provenance-unestablished');
    const st = runCli(['status', '--record', t2.recordPath]);
    assert.equal(['review', 'complete'].includes(st.json.route), false, JSON.stringify(st.json));
    rmSync(t2.base, { recursive: true, force: true });
  });

  ltest('R2-01 positive: EXACT current provenance routes normally — freezing applicability does not punish an honest report', async (t) => {
    const t2 = makeFixture(t);
    assert.ok((await initBinding(initBindingInput(t2))).ok);
    const exact = await reconcile({ ...reconcileInput(t2), observation: { taskId: 't-1', kind: 'done', observationId: 'exact', custodyGeneration: 1, candidateRevision: 0 } });
    assert.equal(exact.ok, true, JSON.stringify(exact));
    assert.equal(exact.observationDisposition, 'consumed');
    assert.equal(exact.route, 'review');
    rmSync(t2.base, { recursive: true, force: true });
  });

  // --- R2-03: the selected authority home is pinned -------------------------
  ltest('R2-03: a copied selector cannot replace the MISSING selected source — the binding holds, admits nothing, plans no intent (harness equivalence)', async (t) => {
    const fx = makeFixture(t);
    assert.equal(runCli(initArgs(fx, ['--task-id', 't-1'])).status, 0);
    const other = join(fx.base, 'other-home');
    mkdirSync(other, { recursive: true });
    writeFileSync(join(other, 'current-decisions.json'), readFileSync(fx.selectorPath));
    rmSync(fx.selectorPath); // the SELECTED source is gone — the copy is the only one left
    const res = runCli(recArgs(fx, ['--feature-home', other, '--request-action', 'work']));
    assert.equal(JSON.parse(res.stdout).code, 'authority_hold_open', 'the same pass cannot open the home hold and admit work');
    const record = JSON.parse(readFileSync(fx.recordPath, 'utf8'));
    assert.equal(record.pendingIntent, null, 'no intent was planned off the copied selector');
    assert.ok(record.holds.some((h) => h.code === 'authority_home_mismatch' && h.clearedAt === null), JSON.stringify(record.holds));
    assert.equal(record.authority.featureHome, fx.home, 'the durable selected home is unchanged');
    const st = runCli(['status', '--record', fx.recordPath]);
    assert.equal(st.json.route, 'hold');
    assert.equal(st.json.routeReason, 'authority_home_mismatch');
    // Recovery is the authorized flow: restore the selected home (byte-copy back) — the
    // hold clears on the next stable read and admission resumes.
    writeFileSync(fx.selectorPath, readFileSync(join(other, 'current-decisions.json')));
    const settled = runCli(recArgs(fx, ['--feature-home', fx.home]));
    assert.ok(JSON.parse(settled.stdout).effects.includes('authority-stable'), JSON.stringify(settled.stdout));
    const st2 = runCli(['status', '--record', fx.recordPath]);
    assert.ok(st2.json.record.holds.every((h) => h.clearedAt !== null), JSON.stringify(st2.json.record.holds));
    rmSync(fx.base, { recursive: true, force: true });
  });

  ltest('R2-03: a copied STALE selector cannot mask an ADVANCED bound source — pin first, then the bound-home read refreshes into authority_changed and completion stays gated', async (t) => {
    const fx = makeFixture(t);
    assert.equal(runCli(initArgs(fx, ['--task-id', 't-1'])).status, 0);
    // Facts recorded BEFORE any authority disturbance, so the completion-gating
    // assertion below fails on the AUTHORITY hold first (the delivery's claim-data
    // hold — fidelity-r2 F-1 — only fires once the authority gate is satisfied).
    assert.equal(runCli(recArgs(fx, ['--observation', obs('adv-done', 'done')])).status, 0);
    const advEvidence = evidenceArtifact(fx, 'delivery-adv.json', { delivered: true, receipt: 'receipt-adv' });
    assert.equal(runCli(recArgs(fx, ['--delivery-receipt', 'receipt-adv',
      '--delivery-evidence-ref', advEvidence.path, '--delivery-evidence-sha256', advEvidence.sha256])).status, 0);
    const staleCopy = join(fx.base, 'stale-home');
    mkdirSync(staleCopy, { recursive: true });
    writeFileSync(join(staleCopy, 'current-decisions.json'), readFileSync(fx.selectorPath)); // revision 1 copy
    fx.bumpSelector(2); // the BOUND source advances — the copy is now behind
    const pinned = runCli(recArgs(fx, ['--feature-home', staleCopy]));
    assert.equal(pinned.status, 0);
    assert.ok(JSON.parse(pinned.stdout).effects.includes('authority-home-mismatch'), JSON.stringify(pinned.stdout));
    assert.equal(JSON.parse(readFileSync(fx.recordPath, 'utf8')).authority.selectorRevision, 1, 'the stale copy refreshed nothing');
    // The honest path still works: the bound home read is an override to the SAME
    // physical home, so the pin is silent and the ADVANCE is what the gate sees.
    // (This pass does NOT settle the open home hold — a signature change refreshes
    // instead of clearing; the holds stay open until a stable read.)
    const honest = runCli(recArgs(fx, ['--feature-home', fx.home]));
    assert.ok(JSON.parse(honest.stdout).effects.includes('authority-refreshed'), JSON.stringify(honest.stdout));
    assert.ok(JSON.parse(honest.stdout).holds.some((h) => h.code === 'authority_changed'), 'the advance opened the changed-authority hold');
    // While authority holds are open, completion stays gated (settlement first) —
    // even with the delivery receipt current. The gate is deliberately ONE-PASS: this
    // first stable read settles the open holds (a durable write — the rejection is
    // rejectAfterPersist) and rejects the completion in that same pass, so admission
    // waits for the NEXT reconcile on the settled record (engine.mjs:644-656). The
    // authority-stable effect therefore fires on THIS pass, not on any later one.
    const early = runCli(recArgs(fx, ['--mark-complete']));
    assert.equal(JSON.parse(early.stdout).code, 'authority_hold_open', 'completion waits for authority settlement');
    const settledRecord = JSON.parse(readFileSync(fx.recordPath, 'utf8'));
    // Post-repair scoping: the settlement clears the AUTHORITY holds; the delivery's
    // evidence hold (added at admission, fidelity-r2 F-1) stays open by design.
    assert.ok(settledRecord.holds.filter((h) => h.code.startsWith('authority')).every((h) => h.clearedAt !== null), JSON.stringify(settledRecord.holds));
    assert.ok(settledRecord.holds.some((h) => h.code === 'delivery_evidence_unverified' && h.clearedAt === null), 'the delivery claim-data hold stays open');
    assert.equal(settledRecord.controlState, 'active', 'settlement did not complete the record');
    // INVALIDATED POSITIVE (fidelity-r2 F-1): the r1 arm asserted the NEXT reconcile
    // ADMITS («the completion door now admits», controlState 'complete') once the
    // authority holds settled. Authority settlement clears the authority gate only —
    // the delivery remains authenticated claim data, so the door refuses on the
    // delivery prerequisite and the record stays active (fidelity-r2 F-1).
    const complete = runCli(recArgs(fx, ['--mark-complete']));
    assert.equal(complete.status, 2, complete.stdout + complete.stderr);
    assert.equal(complete.json.code, 'delivery_evidence_unverified', complete.stdout);
    assert.equal(JSON.parse(readFileSync(fx.recordPath, 'utf8')).controlState, 'active', 'authority settlement alone never completes');
    rmSync(fx.base, { recursive: true, force: true });
  });

  ltest('R2-03 positive: a canonical SYMLINK alias of the selected home resolves to the SAME physical home — no hold, admission unaffected', async (t) => {
    const fx = makeFixture(t);
    assert.equal(runCli(initArgs(fx, ['--task-id', 't-1'])).status, 0);
    const alias = join(fx.base, 'home-alias');
    symlinkSync(fx.home, alias, 'dir');
    const res = runCli(recArgs(fx, ['--feature-home', alias]));
    assert.equal(res.status, 0, res.stdout + res.stderr);
    const body = JSON.parse(res.stdout);
    assert.equal(body.effects.includes('authority-home-mismatch'), false, 'the alias passes the pin — same canonical home');
    assert.equal(body.holds.length, 0, JSON.stringify(body.holds));
    assert.equal(body.route, 'observe', 'routing unaffected by the alias');
    rmSync(fx.base, { recursive: true, force: true });
  });

  // --- R2-04: generic production resume is unconditionally held -------------
  ltest('R2-04: a composed resume on an ACTIVE record is held BEFORE any mutation — byte-identical durable record despite otherwise-valid observation, receipt and transfer', async (t) => {
    const t2 = makeFixture(t);
    assert.ok((await initBinding(initBindingInput(t2))).ok);
    const before = readFileSync(t2.recordPath, 'utf8');
    const held = await reconcile({
      ...reconcileInput(t2),
      observation: { taskId: 't-1', kind: 'done', observationId: 'resumed-done' },
      deliveryReceipt: 'receipt-resume',
      transferCustody: { toSession: 'w-2' },
      requestAction: 'work',
      control: { kind: 'resume', actor: 'operator:composed' },
    });
    assert.equal(held.ok, false);
    assert.equal(held.code, 'unsupported_pending_prerequisite');
    assert.match(held.reason, /resume/i);
    assert.equal(readFileSync(t2.recordPath, 'utf8'), before, 'T-A1-R2-D: the held composite wrote NOTHING — not even the valid facts');
    const after = JSON.parse(before);
    assert.equal(after.pendingIntent, null, 'no action intent survived the hold');
    assert.equal(after.delivery, null, 'no receipt survived the hold');
    assert.equal(after.custodyGeneration, 1, 'no custody advance survived the hold');
    assert.equal(after.recordRevision, 1, 'recordRevision unchanged — the hold is pre-lock, pre-read');
    rmSync(t2.base, { recursive: true, force: true });
  });

  ltest('R2-04: a composed resume on a cessation-PENDING record is held identically — no resume admission, byte-identical durable record', async (t) => {
    const t2 = makeFixture(t);
    assert.ok((await initBinding(initBindingInput(t2))).ok);
    assert.equal((await reconcile({ ...reconcileInput(t2), control: { kind: 'pause', actor: 'operator:matrix' } })).controlState, 'pause-pending');
    // Fidelity-r2 F-2 (INVALIDATED POSITIVE): the r1 arm reached 'paused' first via a
    // digest-verifying evidence file for the bound task. The bound task keeps the pause
    // pending — bare AND sourced acks are both refused — and the resume hold fires on
    // the pending state exactly as it did on the paused one (production resume is not
    // authorized in A1 in either state; the reachable paused positive lives on the
    // taskless sibling in the state-machine arm).
    assert.equal((await reconcile({ ...reconcileInput(t2), control: { kind: 'ack-cessation', actor: 'worker:w-1' } })).ok, false, 'a bare ack cannot settle a task-bound pause');
    assert.equal((await reconcile({ ...reconcileInput(t2), control: { kind: 'ack-cessation', actor: 'worker:w-1', cessationEvidence: evidenceArtifact(t2, 'cessation-r204.json', { task: 't-1', terminal: 'suspended', source: 'aif-runtime' }) } })).ok, false, 'sourced claim data cannot settle it either');
    const before = readFileSync(t2.recordPath, 'utf8');
    const held = await reconcile({
      ...reconcileInput(t2),
      observation: { taskId: 't-1', kind: 'done', observationId: 'paused-done' },
      control: { kind: 'resume', actor: 'operator:composed' },
    });
    assert.equal(held.ok, false);
    assert.equal(held.code, 'unsupported_pending_prerequisite', 'production resume is not authorized in A1 — pending or paused');
    assert.equal(readFileSync(t2.recordPath, 'utf8'), before, 'T-A1-R2-D: byte-identical after the held composite');
    assert.equal(JSON.parse(readFileSync(t2.recordPath, 'utf8')).controlState, 'pause-pending', 'the record did not resume');
    rmSync(t2.base, { recursive: true, force: true });
  });

  // --- R2-05: delivery applicability is bound to the exact candidate --------
  ltest('R2-05: a candidate-1 receipt cannot complete candidate 2 at EITHER door — the current-candidate receipt admits, completion stays closed (fidelity-r2 F-1)', async (t) => {
    const fx = makeFixture(t);
    assert.equal(runCli(initArgs(fx, ['--task-id', 't-1', '--candidate-revision', '1', '--candidate-sha256', sha256Hex('c1')])).status, 0);
    // Fidelity-r1 F-1: the candidate-1 receipt is SOURCED so the door refusals below
    // fire on the CANDIDATE mismatch alone, never on evidence absence.
    const c1Evidence = evidenceArtifact(fx, 'delivery-c1.json', { delivered: true, receipt: 'receipt-c1', candidate: 1 });
    assert.equal(runCli(recArgs(fx, ['--delivery-receipt', 'receipt-c1',
      '--delivery-evidence-ref', c1Evidence.path, '--delivery-evidence-sha256', c1Evidence.sha256])).status, 0);
    assert.equal(JSON.parse(readFileSync(fx.recordPath, 'utf8')).delivery.candidateRevision, 1, 'the receipt is bound to candidate 1 at record time');
    assert.equal(runCli(recArgs(fx, ['--candidate-revision', '2', '--candidate-sha256', sha256Hex('c2')])).status, 0);
    const st = runCli(['status', '--record', fx.recordPath]);
    assert.equal(st.json.route, 'observe', 'a superseded receipt is not completion evidence — routing never claims complete', JSON.stringify(st.json));
    // Door 1 — the CLI markComplete surface.
    const door1 = runCli(recArgs(fx, ['--mark-complete']));
    assert.equal(JSON.parse(door1.stdout).code, 'complete_requires_delivery_receipt');
    assert.match(JSON.parse(door1.stdout).reason, /bound to candidate 1, but the current candidate is 2/);
    // Door 2 — the engine control-complete surface.
    const door2 = await reconcile({ ...reconcileInput(fx), control: { kind: 'complete', actor: 'operator:matrix' } });
    assert.equal(door2.ok, false);
    assert.equal(door2.code, 'complete_requires_delivery_receipt', 'both doors enforce the SAME current-delivery precondition');
    const record = JSON.parse(readFileSync(fx.recordPath, 'utf8'));
    assert.equal(record.controlState, 'active', 'neither door terminally closed candidate 2 off the old receipt');
    assert.equal(record.delivery.receipt, 'receipt-c1', 'the superseded fact is retained, not dropped');
    assert.equal(record.deliveryHistory.length, 0, 'it is still the CURRENT delivery field until a new receipt arrives');
    // The current candidate's own receipt ADMITS as claim data. INVALIDATED POSITIVE
    // (fidelity-r2 F-1): the r1 arm completed on it — withdrawn, because even the
    // current candidate's correctly-digested evidence is authentication, not the
    // referenced subsystem's fact. The candidate-identity contract below the door is
    // untouched; the door itself stays closed pending the stage-B read.
    const c2Evidence = evidenceArtifact(fx, 'delivery-c2.json', { delivered: true, receipt: 'receipt-c2', candidate: 2 });
    assert.equal(runCli(recArgs(fx, ['--delivery-receipt', 'receipt-c2',
      '--delivery-evidence-ref', c2Evidence.path, '--delivery-evidence-sha256', c2Evidence.sha256])).status, 0);
    const okDoor = runCli(recArgs(fx, ['--mark-complete']));
    assert.equal(okDoor.status, 2, okDoor.stdout + okDoor.stderr);
    assert.equal(okDoor.json.code, 'delivery_evidence_unverified', okDoor.stdout);
    const finalRecord = JSON.parse(readFileSync(fx.recordPath, 'utf8'));
    assert.equal(finalRecord.controlState, 'active', 'the current-candidate receipt did not terminally complete either');
    assert.equal(finalRecord.delivery.receipt, 'receipt-c2', 'the current delivery is retained as claim data');
    assert.equal(finalRecord.delivery.candidateRevision, 2, 'it is bound to the CURRENT candidate');
    assert.equal(finalRecord.deliveryHistory.length, 1, 'the candidate-1 receipt archived as history');
    rmSync(fx.base, { recursive: true, force: true });
  });

  ltest('R2-05: a second DIFFERENT receipt for the SAME candidate is a conflict; an identical re-ack is a no-op', async (t) => {
    const fx = makeFixture(t);
    assert.equal(runCli(initArgs(fx, ['--task-id', 't-1'])).status, 0);
    assert.equal(runCli(recArgs(fx, ['--delivery-receipt', 'receipt-a'])).status, 0);
    const dup = runCli(recArgs(fx, ['--delivery-receipt', 'receipt-a']));
    assert.equal(dup.status, 0, dup.stdout + dup.stderr);
    assert.ok(JSON.parse(dup.stdout).effects.includes('delivery-duplicate-ack'), JSON.stringify(dup.stdout));
    assert.equal(JSON.parse(readFileSync(fx.recordPath, 'utf8')).deliveryHistory.length, 0);
    const conflict = runCli(recArgs(fx, ['--delivery-receipt', 'receipt-b']));
    assert.equal(JSON.parse(conflict.stdout).code, 'delivery_conflict', 'two deliveries for one candidate is the double-delivery the contract forbids');
    assert.equal(JSON.parse(readFileSync(fx.recordPath, 'utf8')).delivery.receipt, 'receipt-a', 'the conflict left the recorded receipt intact');
    rmSync(fx.base, { recursive: true, force: true });
  });

  ltest('R2-05: re-acking the superseded receipt is a no-op (never re-bound); a different receipt after the advance archives the old one as HISTORY', async (t) => {
    const fx = makeFixture(t);
    assert.equal(runCli(initArgs(fx, ['--task-id', 't-1', '--candidate-revision', '1', '--candidate-sha256', sha256Hex('c1')])).status, 0);
    assert.equal(runCli(recArgs(fx, ['--delivery-receipt', 'receipt-old'])).status, 0);
    assert.equal(runCli(recArgs(fx, ['--candidate-revision', '2', '--candidate-sha256', sha256Hex('c2')])).status, 0);
    const reack = runCli(recArgs(fx, ['--delivery-receipt', 'receipt-old']));
    assert.equal(reack.status, 0, reack.stdout + reack.stderr);
    assert.ok(JSON.parse(reack.stdout).effects.includes('delivery-superseded-ack'), JSON.stringify(reack.stdout));
    let record = JSON.parse(readFileSync(fx.recordPath, 'utf8'));
    assert.equal(record.delivery.receipt, 'receipt-old', 'the retained fact was NOT re-bound to candidate 2');
    assert.equal(record.delivery.candidateRevision, 1);
    assert.equal(record.deliveryHistory.length, 0, 'the no-op ack archived nothing');
    assert.equal(record.candidate.revision, 2, 'the candidate DID advance — only the delivery stayed put');
    // Fidelity-r2 F-1: the new receipt is SOURCED, but sourced bytes are only
    // AUTHENTICATED — the admission effect is `delivery-recorded-unverified`
    // (a caller-supplied file is claim data; it never became establishment).
    const newEvidence = evidenceArtifact(fx, 'delivery-new.json', { delivered: true, receipt: 'receipt-new', candidate: 2 });
    const fresh = runCli(recArgs(fx, ['--delivery-receipt', 'receipt-new',
      '--delivery-evidence-ref', newEvidence.path, '--delivery-evidence-sha256', newEvidence.sha256]));
    assert.equal(fresh.status, 0, fresh.stdout + fresh.stderr);
    const body = JSON.parse(fresh.stdout);
    assert.ok(body.effects.includes('delivery-superseded:1'), JSON.stringify(body.effects));
    assert.ok(body.effects.includes('delivery-recorded-unverified'), JSON.stringify(body.effects));
    record = JSON.parse(readFileSync(fx.recordPath, 'utf8'));
    assert.equal(record.delivery.receipt, 'receipt-new');
    assert.equal(record.delivery.candidateRevision, 2, 'the new receipt binds the CURRENT candidate');
    assert.equal(record.deliveryHistory.length, 1, 'the superseded receipt moved to bounded history');
    assert.equal(record.deliveryHistory[0].receipt, 'receipt-old');
    assert.equal(record.deliveryHistory[0].candidateRevision, 1);
    rmSync(fx.base, { recursive: true, force: true });
  });
});

// ===========================================================================
// A1 rework batch 3 (R3-01..R3-03) — durable class battery for the root QA repairs.
// Every flip named below was MEASURED this session by removing exactly one production
// change at a time and running this whole file against the result (T22, not assumed):
// — R3-01: the load-bearing layer is the store writer-boundary check (`verifyWriteLocation`).
//   Removing it alone turns the direct-store arm RED while the CLI copy arms stay green
//   behind the engine layer; removing the engine's incumbent self-identification check
//   alone turns NOTHING red (measured: the full suite passes with it gone) — every public
//   surface is still blocked at the write boundary. The engine check is kept as an earlier
//   reject (it refuses a copy before the copy's lock is taken or the file is read into a
//   transition), not as an independently observable gate.
// — R3-02: removing the delivery dedup's `deliveryHistory` sweep turns the replay-quarantine
//   arm RED (the old receipt re-binds to the current candidate and mutates the record).
// — R3-03: removing the custody settled-authority gate turns the four hold-driven arms RED
//   while the missing-argument arm (separate arg check), the stop-work-while-unreadable arm
//   (pause is never gated) and the valid-transfer positive stay green.
// Batch RED against the pre-fix modules (HEAD ae7e0c2a) was proven with the frozen root
// harnesses run unchanged in an isolated archive of the pre-image bytes (2 / 2 / 3 intended
// REDs + cleanup, exit 1 each) and GREEN on the fixed bytes (exit 0 each).
// ===========================================================================
describe('A1 rework batch 3 (R3-01..R3-03 durable battery)', () => {
  ltest('R3-01: a byte-identical copy at another path INSIDE the stage root is refused (record_path_mismatch) — no intent/custody fork, both files byte-unchanged, the bound path stays live', async (t) => {
    const fx = makeFixture(t);
    assert.equal(runCli(initArgs(fx, ['--task-id', 't-1'])).status, 0);
    const original = readFileSync(fx.recordPath, 'utf8');
    const copyPath = join(fx.stageRoot, 'binding-copy.json');
    writeFileSync(copyPath, original);
    const attempted = runCli(recArgs({ ...fx, recordPath: copyPath }, ['--request-action', 'work']));
    assert.equal(attempted.status, 2, attempted.stdout + attempted.stderr);
    assert.equal(attempted.json.code, 'record_path_mismatch');
    assert.equal(readFileSync(fx.recordPath, 'utf8'), original, 'the bound record must remain byte-unchanged');
    assert.equal(readFileSync(copyPath, 'utf8'), original, 'the copy must remain byte-unchanged — no intent, control or custody state anywhere');
    const before = JSON.parse(original);
    for (const path of [fx.recordPath, copyPath]) {
      const record = JSON.parse(readFileSync(path, 'utf8'));
      assert.equal(record.pendingIntent, null, `${path} gained no intent`);
      assert.equal(record.custodyGeneration, before.custodyGeneration, `${path} gained no custody advance`);
    }
    // The bound path itself stays a live binding: the same work intent succeeds there.
    const bound = runCli(recArgs(fx, ['--request-action', 'work']));
    assert.equal(bound.status, 0, bound.stdout + bound.stderr);
    assert.ok(JSON.parse(readFileSync(fx.recordPath, 'utf8')).pendingIntent !== null, 'the BOUND record accepted the work intent');
    rmSync(fx.base, { recursive: true, force: true });
  });

  ltest('R3-01: the same refusal applies OUTSIDE the owned stage root (a copy beyond the declared root never becomes a binding)', async (t) => {
    const fx = makeFixture(t);
    assert.equal(runCli(initArgs(fx, ['--task-id', 't-1'])).status, 0);
    const original = readFileSync(fx.recordPath, 'utf8');
    const copyPath = join(fx.base, 'binding-copy.json'); // outside repo/stage entirely
    writeFileSync(copyPath, original);
    const attempted = runCli(recArgs({ ...fx, recordPath: copyPath }, ['--request-action', 'work']));
    assert.equal(attempted.status, 2, attempted.stdout + attempted.stderr);
    assert.equal(attempted.json.code, 'record_path_mismatch');
    assert.equal(readFileSync(fx.recordPath, 'utf8'), original);
    assert.equal(readFileSync(copyPath, 'utf8'), original);
    rmSync(fx.base, { recursive: true, force: true });
  });

  ltest('R3-01: the invariant binds at the STORE writer boundary — a direct writeRecordAtomic of the bound record to another path is rejected, and a payload naming another path cannot ride through the bound target (no engine bypass)', async (t) => {
    const fx = makeFixture(t);
    const init = await initBinding(initBindingInput(fx));
    assert.equal(init.ok, true, JSON.stringify(init));
    const boundBytes = readFileSync(fx.recordPath, 'utf8');
    const bound = JSON.parse(boundBytes);
    const copyPath = join(fx.stageRoot, 'binding-direct.json');
    // Direct-store bypass attempt A: write the bound record's payload to the copy's own
    // canonical target (as if a lock were held for the copy). Flips RED if the store
    // stops verifying payload recordPath === write target.
    const attemptA = writeRecordAtomic(copyPath, bound, { lockedTarget: canonicalRecordPath(copyPath), expectedRevision: bound.recordRevision });
    assert.equal(attemptA.ok, false, JSON.stringify(attemptA));
    assert.equal(attemptA.code, 'record_path_mismatch');
    assert.equal(existsSync(copyPath), false, 'the rejected write created nothing');
    assert.equal(readFileSync(fx.recordPath, 'utf8'), boundBytes, 'the bound record is untouched');
    // Direct-store bypass attempt B: write through the BOUND target a payload whose
    // recordPath names the copy. Flips RED if the store stops comparing the payload's
    // declared location with the location actually written.
    const attemptB = writeRecordAtomic(canonicalRecordPath(fx.recordPath), { ...bound, recordPath: copyPath }, { lockedTarget: canonicalRecordPath(fx.recordPath), expectedRevision: bound.recordRevision });
    assert.equal(attemptB.ok, false, JSON.stringify(attemptB));
    assert.equal(attemptB.code, 'record_path_mismatch');
    assert.equal(readFileSync(fx.recordPath, 'utf8'), boundBytes);
    rmSync(fx.base, { recursive: true, force: true });
  });

  ltest('R3-01: legitimate aliases of the SAME target still reconcile and mutate (leaf-symlink spelling survives the new invariant)', async (t) => {
    const fx = makeFixture(t);
    assert.equal(runCli(initArgs(fx, ['--task-id', 't-1'])).status, 0);
    const aliasPath = join(fx.stageRoot, 'binding-link.json');
    symlinkSync(fx.recordPath, aliasPath);
    const viaAlias = runCli(recArgs({ ...fx, recordPath: aliasPath }, ['--request-action', 'work']));
    assert.equal(viaAlias.status, 0, viaAlias.stdout + viaAlias.stderr);
    const record = JSON.parse(readFileSync(fx.recordPath, 'utf8'));
    assert.equal(record.recordRevision, 2, 'the alias mutated the ONE physical record');
    assert.ok(record.pendingIntent !== null);
    rmSync(fx.base, { recursive: true, force: true });
  });

  ltest('R3-02: a receipt already in bounded history is quarantined on replay (delivery-historical-replay-ack, byte-unchanged) — neither completion door accepts it; the current candidate’s fresh receipt still ADMITS (completion itself stays closed — fidelity-r2 F-1)', async (t) => {
    const fx = makeFixture(t);
    assert.equal(runCli(initArgs(fx, ['--task-id', 't-1', '--candidate-revision', '1', '--candidate-sha256', sha256Hex('c1')])).status, 0);
    assert.equal(runCli(recArgs(fx, ['--delivery-receipt', 'receipt-r1'])).status, 0);
    assert.equal(runCli(recArgs(fx, ['--candidate-revision', '2', '--candidate-sha256', sha256Hex('c2')])).status, 0);
    assert.equal(runCli(recArgs(fx, ['--delivery-receipt', 'receipt-r2'])).status, 0); // archives r1 into history
    assert.equal(runCli(recArgs(fx, ['--candidate-revision', '3', '--candidate-sha256', sha256Hex('c3')])).status, 0);
    // The replay: r1 is RETAINED HISTORY (bound to candidate 1), never c3's fresh delivery.
    const bytesBefore = readFileSync(fx.recordPath, 'utf8');
    const replay = runCli(recArgs(fx, ['--delivery-receipt', 'receipt-r1']));
    assert.equal(replay.status, 0, replay.stdout + replay.stderr);
    assert.ok(JSON.parse(replay.stdout).effects.includes('delivery-historical-replay-ack:candidate 1'), replay.stdout);
    assert.equal(JSON.parse(replay.stdout).mutated, false, 'the replay quarantine is a no-op');
    assert.equal(readFileSync(fx.recordPath, 'utf8'), bytesBefore, 'the replay changed no durable byte');
    let record = JSON.parse(bytesBefore);
    assert.equal(record.delivery.receipt, 'receipt-r2', 'current delivery unchanged — r1 was not re-bound to c3');
    assert.equal(record.delivery.candidateRevision, 2);
    assert.equal(record.deliveryHistory.length, 1, 'history unchanged — original association preserved');
    assert.equal(record.deliveryHistory[0].receipt, 'receipt-r1');
    assert.equal(record.deliveryHistory[0].candidateRevision, 1);
    // Both completion doors stay closed for c3 (no current delivery): door 1 = markComplete.
    const door1 = runCli(recArgs(fx, ['--mark-complete']));
    assert.equal(door1.status, 2, door1.stdout + door1.stderr);
    assert.equal(door1.json.code, 'complete_requires_delivery_receipt');
    // Door 2 = control complete (library surface — the CLI exposes pause/cancel verbs only).
    const door2 = await reconcile(reconcileInput(fx, { control: { kind: 'complete', actor: 'matrix:library-door' } }));
    assert.equal(door2.ok, false, JSON.stringify(door2));
    assert.equal(door2.code, 'complete_requires_delivery_receipt');
    // The current candidate's genuine distinct receipt stays valid: it admits.
    // INVALIDATED POSITIVE (fidelity-r2 F-1): the r1 arm asserted the sourced delivery
    // then COMPLETED (status 0, controlState 'complete'). Sourced bytes are
    // authenticated claim data, never a fact about the referenced subsystem —
    // admission persists the delivery as claim data and completion stays refused.
    const r3Evidence = evidenceArtifact(fx, 'delivery-r3.json', { delivered: true, receipt: 'receipt-r3', candidate: 3 });
    const admitted = runCli(recArgs(fx, ['--delivery-receipt', 'receipt-r3',
      '--delivery-evidence-ref', r3Evidence.path, '--delivery-evidence-sha256', r3Evidence.sha256]));
    assert.equal(admitted.status, 0, admitted.stdout + admitted.stderr); // archives r2
    assert.ok(JSON.parse(admitted.stdout).effects.includes('delivery-recorded-unverified'), admitted.stdout);
    const done = runCli(recArgs(fx, ['--mark-complete']));
    assert.equal(done.status, 2, done.stdout + done.stderr);
    assert.equal(done.json.code, 'delivery_evidence_unverified', 'completion awaits the stage-B establishment capability');
    record = JSON.parse(readFileSync(fx.recordPath, 'utf8'));
    assert.equal(record.delivery.receipt, 'receipt-r3');
    assert.equal(record.delivery.candidateRevision, 3, 'the fresh receipt bound the CURRENT candidate');
    assert.equal(record.delivery.verified, false, 'sourced claim data never became a verified fact');
    assert.equal(record.controlState, 'active', 'the quarantine invariant left the record non-terminal');
    rmSync(fx.base, { recursive: true, force: true });
  });

  ltest('R3-03: custody transfer without --repo-root refuses invalid_request naming the flag — no successor installed, bytes unchanged', async (t) => {
    const fx = makeFixture(t);
    assert.equal(runCli(initArgs(fx, ['--task-id', 't-1'])).status, 0);
    const bytesBefore = readFileSync(fx.recordPath, 'utf8');
    const attempted = runCli(['reconcile', '--record', fx.recordPath, '--feature-home', fx.home, '--now', iso(), '--transfer-custody', 'w-2']);
    assert.equal(attempted.status, 2, attempted.stdout + attempted.stderr);
    assert.equal(attempted.json.code, 'invalid_request');
    assert.match(attempted.json.reason, /--repo-root/);
    assert.equal(readFileSync(fx.recordPath, 'utf8'), bytesBefore, 'an unread authority never installed a worker');
    const record = JSON.parse(bytesBefore);
    assert.equal(record.custodyGeneration, 1);
    assert.equal(record.worker, null);
    rmSync(fx.base, { recursive: true, force: true });
  });

  ltest('R3-03: transfer while the authority source is missing refuses authority_hold_open (hold persisted, custody unchanged) — recovery, settlement, then the valid transfer advances custody', async (t) => {
    const fx = makeFixture(t);
    assert.equal(runCli(initArgs(fx, ['--task-id', 't-1'])).status, 0);
    const selectorBytes = readFileSync(fx.selectorPath, 'utf8');
    rmSync(fx.selectorPath);
    const attempted = runCli(recArgs(fx, ['--transfer-custody', 'w-2']));
    assert.equal(attempted.status, 2, attempted.stdout + attempted.stderr);
    assert.equal(attempted.json.code, 'authority_hold_open');
    let record = JSON.parse(readFileSync(fx.recordPath, 'utf8'));
    assert.equal(record.custodyGeneration, 1, 'custody did not advance');
    assert.equal(record.worker, null, 'no successor worker installed');
    assert.ok(record.holds.some((h) => h.code === 'authority_unavailable' && h.clearedAt === null), 'the authority hold itself is persisted');
    // Recovery + settlement: restore the selector, settle the hold on a stable read.
    writeFileSync(fx.selectorPath, selectorBytes);
    assert.equal(runCli(recArgs(fx, [])).status, 0);
    record = JSON.parse(readFileSync(fx.recordPath, 'utf8'));
    assert.ok(!record.holds.some((h) => h.code === 'authority_unavailable' && h.clearedAt === null), 'the hold cleared on the stable read');
    // The later valid transfer succeeds against the settled record.
    const transferred = runCli(recArgs(fx, ['--transfer-custody', 'w-2']));
    assert.equal(transferred.status, 0, transferred.stdout + transferred.stderr);
    record = JSON.parse(readFileSync(fx.recordPath, 'utf8'));
    assert.equal(record.custodyGeneration, 2);
    assert.equal(record.worker.sessionId, 'w-2');
    rmSync(fx.base, { recursive: true, force: true });
  });

  ltest('R3-03: a changed selector (same-pass hold refresh) refuses succession once — the settled pass transfers', async (t) => {
    const fx = makeFixture(t);
    assert.equal(runCli(initArgs(fx, ['--task-id', 't-1'])).status, 0);
    fx.bumpSelector(2);
    const attempted = runCli(recArgs(fx, ['--transfer-custody', 'w-2']));
    assert.equal(attempted.status, 2, attempted.stdout + attempted.stderr);
    assert.equal(attempted.json.code, 'authority_hold_open');
    assert.equal(JSON.parse(readFileSync(fx.recordPath, 'utf8')).custodyGeneration, 1);
    assert.equal(runCli(recArgs(fx, [])).status, 0); // settle the hold on the stable read
    const transferred = runCli(recArgs(fx, ['--transfer-custody', 'w-2']));
    assert.equal(transferred.status, 0, transferred.stdout + transferred.stderr);
    assert.equal(JSON.parse(readFileSync(fx.recordPath, 'utf8')).custodyGeneration, 2);
    rmSync(fx.base, { recursive: true, force: true });
  });

  ltest('R3-03: a copied-home override that opens the R2-03 hold cannot install a successor — settle on the bound home, then transfer', async (t) => {
    const fx = makeFixture(t);
    assert.equal(runCli(initArgs(fx, ['--task-id', 't-1'])).status, 0);
    const homeCopy = join(fx.base, 'home-copy');
    mkdirSync(homeCopy, { recursive: true });
    writeFileSync(join(homeCopy, 'current-decisions.json'), readFileSync(fx.selectorPath, 'utf8'));
    const attempted = runCli(recArgs(fx, ['--feature-home', homeCopy, '--transfer-custody', 'w-2']));
    assert.equal(attempted.status, 2, attempted.stdout + attempted.stderr);
    assert.equal(attempted.json.code, 'authority_hold_open');
    assert.match(attempted.json.reason, /authority_home_mismatch/, 'the copied-home hold is what refused the succession');
    assert.equal(JSON.parse(readFileSync(fx.recordPath, 'utf8')).custodyGeneration, 1);
    assert.equal(runCli(recArgs(fx, [])).status, 0); // settle on the bound home
    const transferred = runCli(recArgs(fx, ['--transfer-custody', 'w-2']));
    assert.equal(transferred.status, 0, transferred.stdout + transferred.stderr);
    assert.equal(JSON.parse(readFileSync(fx.recordPath, 'utf8')).custodyGeneration, 2);
    rmSync(fx.base, { recursive: true, force: true });
  });

  ltest('R3-03 (INVALIDATED POSITIVE, fidelity-r2 F-2): a succession refused for an unreadable authority persists the authority hold and NO cessation fact — the later valid transfer carries its own explicit acknowledge-cessation', async (t) => {
    const fx = makeFixture(t);
    const init = await initBinding(initBindingInput(fx));
    assert.equal(init.ok, true, JSON.stringify(init));
    const selectorBytes = readFileSync(fx.selectorPath, 'utf8');
    rmSync(fx.selectorPath);
    const refused = await reconcile(reconcileInput(fx, { transferCustody: { toSession: 'w-2', reason: 'r3-03 succession', acknowledgeCessation: true } }));
    assert.equal(refused.ok, false, JSON.stringify(refused));
    assert.equal(refused.code, 'authority_hold_open');
    const record = JSON.parse(readFileSync(fx.recordPath, 'utf8'));
    assert.equal(record.worker.sessionId, 'w-1', 'the old worker identity is unchanged');
    // INVALIDATED POSITIVE (fidelity-r2 F-2): the r1 arm asserted the ack survived the
    // refusal as a durable cessation FACT (stamped persist-before-reject), with the
    // later transfer «not re-demanded». Post-repair the caller's word is not a fact: a
    // refused succession persists the refusal and the authority hold — never
    // cessationAckedAt — so the old worker stays LIVE until a real succession replaces it.
    assert.equal(record.worker.cessationAckedAt, null, 'no cessation FACT was created from the caller\'s word');
    assert.equal(record.custodyGeneration, 1, 'custody did not advance');
    assert.ok(record.holds.some((h) => h.code === 'authority_unavailable' && h.clearedAt === null));
    assert.equal(record.controlState, 'active', 'fact-only cessation did not become a control transition');
    // Recovery, settlement, then a valid transfer. The refused pass persisted no ack to
    // reuse — the old worker is still live-unacked — so the succession carries its own
    // explicit acknowledgeCessation (the custody gate's demand is unchanged; a no-ack
    // transfer would refuse custody_transfer_blocked, pinned by its sibling arm).
    writeFileSync(fx.selectorPath, selectorBytes);
    assert.ok((await reconcile(reconcileInput(fx, {}))).ok, 'the settle reconcile succeeds');
    const transferred = await reconcile(reconcileInput(fx, { transferCustody: { toSession: 'w-2', reason: 'r3-03 valid succession', acknowledgeCessation: true } }));
    assert.equal(transferred.ok, true, JSON.stringify(transferred));
    assert.equal(transferred.custodyGeneration, 2);
    rmSync(fx.base, { recursive: true, force: true });
  });

  ltest('R3-03: stopping work is never gated — pause lands while the authority is unreadable', async (t) => {
    const fx = makeFixture(t);
    // Fidelity-r1 F-2 control: truly-empty binding (no bound task, no worker) so the
    // pause lands `paused` directly. A bound AIF task or live worker defers the pause
    // to cessation acknowledgement (pause-pending) — equally ungated; that variant is
    // the fidelity block's F-2 arm, this arm pins the empty case.
    assert.equal(runCli(initArgs(fx)).status, 0);
    rmSync(fx.selectorPath);
    const paused = runCli(['pause', '--record', fx.recordPath, '--repo-root', fx.repo, '--feature-home', fx.home, '--now', iso(), '--control-reason', 'r3: stopping work while authority is unreadable']);
    assert.equal(paused.status, 0, paused.stdout + paused.stderr);
    const record = JSON.parse(readFileSync(fx.recordPath, 'utf8'));
    // No live worker and no bound task on this CLI init, so the pause lands `paused`
    // directly — the transition LANDED: the unreadable authority gated nothing about
    // stopping work.
    assert.equal(record.controlState, 'paused', 'the control transition was not gated on the unreadable authority');
    assert.equal(record.custodyGeneration, 1);
    rmSync(fx.base, { recursive: true, force: true });
  });

  ltest('R3-03 positive: a stable active binding with valid cessation conditions admits the successor (custody advance unchanged)', async (t) => {
    const fx = makeFixture(t);
    const init = await initBinding(initBindingInput(fx));
    assert.equal(init.ok, true, JSON.stringify(init));
    const transferred = await reconcile(reconcileInput(fx, { transferCustody: { toSession: 'w-2', reason: 'valid succession on settled authority', acknowledgeCessation: true } }));
    assert.equal(transferred.ok, true, JSON.stringify(transferred));
    assert.equal(transferred.custodyGeneration, 2);
    assert.ok(transferred.effects.includes('custody-transferred:2'), JSON.stringify(transferred.effects));
    const record = JSON.parse(readFileSync(fx.recordPath, 'utf8'));
    assert.equal(record.worker.sessionId, 'w-2');
    assert.equal(record.worker.cessationAckedAt, null, 'the successor starts unacked');
    rmSync(fx.base, { recursive: true, force: true });
  });
});
// ===========================================================================
// A1 rework batch 4 (R4-01 terminal-candidate identity + R4-02 cessation-ack
// durability). RED-first proven against the pre-image production bytes
// (HEAD f71121ae) with the new arms run unchanged in an isolated archive:
// the arms labelled FLIP fail there and pass on the fixed bytes; arms labelled
// CONTROL pass on BOTH bytes — they pin neighbouring behaviour the fix must not
// disturb. Per-arm flip attribution (T22):
// — R4-01: adding the TERMINAL_STATES gate inside the candidate-advance branch
//   (engine step 8, before mutation) flips arms 1-3; arm 4 (same-candidate
//   idempotence) is skipped by the `revision !==` guard and stays green on both.
// — R4-02: adding `mutated = true` in the active-worker cessation-ack
//   else-branch (engine step 7) flips arm 5 ONLY; arms 6-8 are CONTROLS — the
//   changed-authority hold (arm 6) and the pending pause/cancel ack transitions
//   (arms 7-8) already set mutated on the pre-image through their own route, so
//   their both-sides green proves the fix adds no behaviour on those routes
//   (measured: the batch-4 RED run failed exactly arms 1, 2, 3, 5 of 8; exit 1).
// ===========================================================================
describe('A1 rework batch 4 (R4-01 terminal-candidate identity + R4-02 cessation-ack durability)', () => {
  ltest('R4-01 FLIP (CLI): a candidate update after completion refuses candidate_terminal_conflict — the completed candidate keeps its receipt association, bytes unchanged', async (t) => {
    const fx = makeFixture(t);
    // Fidelity-r2: 'complete' is unreachable through stage A, so the completed record
    // is seeded at the record layer (the gate under test is the terminal check below).
    const completed = seedCompletedRecord(fx);
    assert.equal(completed.candidate.revision, 1);
    assert.equal(completed.delivery.receipt, 'receipt-c1', 'the delivery belongs to c1');
    const completedBytes = readFileSync(fx.recordPath, 'utf8');
    assert.equal(JSON.parse(completedBytes).controlState, 'complete');
    // The ordinary candidate-2 update must not advance the primary current
    // candidate over the finished run — neither on the public CLI surface…
    const attempted = runCli(recArgs(fx, ['--candidate-revision', '2', '--candidate-sha256', sha256Hex('c2')]));
    assert.equal(attempted.status, 2, attempted.stdout + attempted.stderr);
    assert.equal(attempted.json.code, 'candidate_terminal_conflict');
    assert.match(attempted.json.reason, /complete/);
    assert.equal(readFileSync(fx.recordPath, 'utf8'), completedBytes, 'no legitimate fact changed — zero durable bytes moved');
    const record = JSON.parse(readFileSync(fx.recordPath, 'utf8'));
    assert.equal(record.candidate.revision, 1, 'the completed candidate identity is preserved');
    assert.equal(record.delivery.receipt, 'receipt-c1', 'receipt association preserved');
    assert.equal(record.delivery.candidateRevision, 1);
    assert.equal(record.controlState, 'complete', 'terminal control is not reopened');
    assert.equal(record.disposition, 'complete');
    rmSync(fx.base, { recursive: true, force: true });
  });

  ltest('R4-01 FLIP (generic entry): the same refusal fires through the library reconcile on a completed record', async (t) => {
    const fx = makeFixture(t);
    // Fidelity-r2: the completed record is seeded at the record layer ('complete' is
    // unreachable through stage A) — the gate under test is the library terminal check.
    seedCompletedRecord(fx);
    const completedBytes = readFileSync(fx.recordPath, 'utf8');
    const refused = await reconcile(reconcileInput(fx, { candidate: { revision: 2, sha256: sha256Hex('c2'), ref: null } }));
    assert.equal(refused.ok, false, JSON.stringify(refused));
    assert.equal(refused.code, 'candidate_terminal_conflict');
    assert.equal(readFileSync(fx.recordPath, 'utf8'), completedBytes, 'the generic entry preserves the completed bytes too');
    rmSync(fx.base, { recursive: true, force: true });
  });

  ltest('R4-01 FLIP (composed): a historical observation riding with a candidate update persists the observation but still cannot smuggle the candidate advance past the terminal gate', async (t) => {
    const fx = makeFixture(t);
    // Fidelity-r2: the completed record is seeded at the record layer ('complete' is
    // unreachable through stage A) — the gate under test is the terminal check below.
    seedCompletedRecord(fx);
    const completedBytes = readFileSync(fx.recordPath, 'utf8');
    const composed = runCli(recArgs(fx, ['--observation', obs('late-after-complete', 'done'), '--candidate-revision', '2', '--candidate-sha256', sha256Hex('c2')]));
    assert.equal(composed.status, 2, composed.stdout + composed.stderr);
    assert.equal(composed.json.code, 'candidate_terminal_conflict');
    const record = JSON.parse(readFileSync(fx.recordPath, 'utf8'));
    assert.notEqual(readFileSync(fx.recordPath, 'utf8'), completedBytes, 'the legitimately-ingested observation IS persisted with the rejection');
    assert.equal(record.observations.length, 1, 'the observation entered the record as data');
    assert.ok(record.observations[0].disposition.startsWith('historical-after-complete'), record.observations[0].disposition);
    assert.equal(record.candidate.revision, 1, 'the composed candidate update was still refused');
    assert.equal(record.delivery.receipt, 'receipt-c1');
    assert.equal(record.controlState, 'complete');
    rmSync(fx.base, { recursive: true, force: true });
  });

  ltest('R4-01 CONTROL (no flip): a same-candidate resubmit on a completed binding stays an idempotent no-op — bytes unchanged', async (t) => {
    const fx = makeFixture(t);
    // Fidelity-r2: the completed record is seeded at the record layer ('complete' is
    // unreachable through stage A) — the gate under test is same-candidate idempotence.
    seedCompletedRecord(fx);
    const completedBytes = readFileSync(fx.recordPath, 'utf8');
    const same = runCli(recArgs(fx, ['--candidate-revision', '1', '--candidate-sha256', sha256Hex('c1')]));
    assert.equal(same.status, 0, same.stdout + same.stderr);
    assert.equal(same.json.mutated, false, 'same-candidate idempotence is untouched by the terminal gate');
    assert.equal(readFileSync(fx.recordPath, 'utf8'), completedBytes);
    rmSync(fx.base, { recursive: true, force: true });
  });

  ltest('R4-02 FLIP: an active live-worker transfer+ack refused for a missing --repo-root persists NO cessation fact (a caller assertion is not a fact — fidelity-r2 F-2); old worker identity and custody stay, no successor — and a later valid transfer still proceeds', async (t) => {
    const fx = makeFixture(t);
    const init = await initBinding(initBindingInput(fx));
    assert.equal(init.ok, true, JSON.stringify(init));
    const before = JSON.parse(readFileSync(fx.recordPath, 'utf8'));
    assert.equal(before.worker.sessionId, 'w-1');
    assert.equal(before.worker.cessationAckedAt, null);
    // No repoRoot, no other input: the pass carries only the caller-asserted cessation.
    // INVALIDATED POSITIVE (fidelity-r2 F-2): the r1 arm asserted the ack survived the
    // refusal as a durable FACT (cessationAckedAt stamped persist-before-reject) and the
    // later transfer «reused the retained ack». Post-repair no stage-A input establishes
    // the referenced subsystem's stop — the caller's word establishes nothing, nothing is
    // stamped, and succession simply never depended on that assertion.
    const refused = await reconcile({ ...reconcileInput(fx, { transferCustody: { toSession: 'w-2', reason: 'r4-02 succession', acknowledgeCessation: true } }), repoRoot: undefined });
    assert.equal(refused.ok, false, JSON.stringify(refused));
    assert.equal(refused.code, 'invalid_request');
    assert.match(refused.reason, /--repo-root/);
    const record = JSON.parse(readFileSync(fx.recordPath, 'utf8'));
    assert.equal(record.worker.cessationAckedAt, null, 'no cessation FACT was created from the caller\'s word');
    assert.ok(!record.holds.some((h) => h.code === 'cessation_unconfirmed' && h.clearedAt === null), 'the structural refusal persisted no prerequisite hold either (the ack door was never reached)');
    assert.equal(record.worker.sessionId, 'w-1', 'the old worker identity is retained');
    assert.equal(record.custodyGeneration, 1, 'custody did not advance');
    assert.ok(record.worker.toSession === undefined, 'no successor was registered');
    assert.equal(record.controlState, 'active', 'the refusal did not transition control');
    assert.equal(record.candidate.revision, before.candidate.revision, 'nothing else in the record moved');
    // A later valid transfer still proceeds — succession never needed the assertion,
    // but the old worker stayed LIVE-unacked through the refusal, so the succession
    // carries its own explicit acknowledgeCessation (the custody gate is unchanged).
    const transferred = await reconcile(reconcileInput(fx, { transferCustody: { toSession: 'w-2', reason: 'r4-02 settled succession', acknowledgeCessation: true } }));
    assert.equal(transferred.ok, true, JSON.stringify(transferred));
    assert.equal(transferred.custodyGeneration, 2);
    const after = JSON.parse(readFileSync(fx.recordPath, 'utf8'));
    assert.equal(after.worker.sessionId, 'w-2');
    assert.equal(after.worker.cessationAckedAt, null, 'the successor starts unacked');
    rmSync(fx.base, { recursive: true, force: true });
  });

  ltest('R4-02 CONTROL (no flip): a transfer+ack refused by the CHANGED-authority home pin persists the authority hold — and NO cessation fact (fidelity-r2 F-2: the caller-asserted stop is not a fact; the r1 arm\'s durable-ack assertion is withdrawn)', async (t) => {
    const fx = makeFixture(t);
    const init = await initBinding(initBindingInput(fx));
    assert.equal(init.ok, true, JSON.stringify(init));
    const homeCopy = join(fx.base, 'home-copy');
    mkdirSync(homeCopy, { recursive: true });
    writeFileSync(join(homeCopy, 'current-decisions.json'), readFileSync(fx.selectorPath, 'utf8'));
    const refused = await reconcile(reconcileInput(fx, { featureHome: homeCopy, transferCustody: { toSession: 'w-2', reason: 'r4-02 changed authority', acknowledgeCessation: true } }));
    assert.equal(refused.ok, false, JSON.stringify(refused));
    assert.equal(refused.code, 'authority_hold_open');
    assert.match(refused.reason, /authority_home_mismatch/);
    const record = JSON.parse(readFileSync(fx.recordPath, 'utf8'));
    assert.equal(record.worker.cessationAckedAt, null, 'no cessation FACT was created from the caller\'s word');
    assert.equal(record.worker.sessionId, 'w-1');
    assert.equal(record.custodyGeneration, 1);
    rmSync(fx.base, { recursive: true, force: true });
  });

  ltest('R4-02 CONTROL (no flip): a transfer+ack on a pause-pending live-worker binding persists the prerequisite hold through the refusal (cessation_unconfirmed, pause-pending retained, no successor)', async (t) => {
    const fx = makeFixture(t);
    const init = await initBinding(initBindingInput(fx));
    assert.equal(init.ok, true, JSON.stringify(init));
    const paused = await reconcile(reconcileInput(fx, { control: { kind: 'pause', actor: 'operator:matrix' } }));
    assert.equal(paused.ok, true, JSON.stringify(paused));
    assert.equal(paused.controlState, 'pause-pending');
    // Fidelity-r1 F-2: with task t-1 bound, the composed bare ack cannot complete the
    // pause — persist-before-reject still persists the pass's durable fact (the
    // prerequisite hold), the same fact-survives-refusal property R4-02 pins.
    const refused = await reconcile({ ...reconcileInput(fx, { transferCustody: { toSession: 'w-2', reason: 'r4-02 while pausing', acknowledgeCessation: true } }), repoRoot: undefined });
    assert.equal(refused.ok, false, JSON.stringify(refused));
    assert.equal(refused.code, 'cessation_unconfirmed');
    const record = JSON.parse(readFileSync(fx.recordPath, 'utf8'));
    assert.equal(record.controlState, 'pause-pending', 'no synthetic stopped disposition');
    assert.ok(record.holds.some((h) => h.code === 'cessation_unconfirmed' && h.clearedAt === null), 'the prerequisite hold survived the refusal durably');
    assert.ok(record.worker.cessationAckedAt === null, 'no cessation was acknowledged on the caller\'s word');
    assert.equal(record.custodyGeneration, 1);
    // INVALIDATED POSITIVE (fidelity-r2 F-2): the r1 arm completed the pause with a
    // digest-verifying evidence file for the bound task. Sourced bytes authenticate but
    // never establish the referenced subsystem's actual stop — a sourced ack is refused
    // exactly like a bare one, and the pause stays pending (the reachable 'paused'
    // positive lives on the taskless sibling binding in the state-machine arm, where the
    // local worker's own acknowledgement is the one independent mechanism).
    const settled = await reconcile(reconcileInput(fx, { control: { kind: 'ack-cessation', actor: 'operator:matrix', reason: 'verified terminal record for the bound task', cessationEvidence: evidenceArtifact(fx, 'cessation-r402p.json', { task: 't-1', terminal: 'suspended', source: 'aif-runtime' }) } }));
    assert.equal(settled.ok, false, JSON.stringify(settled));
    assert.equal(settled.code, 'cessation_unconfirmed');
    assert.equal(JSON.parse(readFileSync(fx.recordPath, 'utf8')).controlState, 'pause-pending');
    rmSync(fx.base, { recursive: true, force: true });
  });

  ltest('R4-02 CONTROL (no flip): a transfer+ack on a cancel-pending live-worker binding persists the prerequisite hold through the refusal (cessation_unconfirmed, cancel-pending retained, no successor)', async (t) => {
    const fx = makeFixture(t);
    const init = await initBinding(initBindingInput(fx));
    assert.equal(init.ok, true, JSON.stringify(init));
    const cancelling = await reconcile(reconcileInput(fx, { control: { kind: 'cancel', actor: 'operator:matrix' } }));
    assert.equal(cancelling.ok, true, JSON.stringify(cancelling));
    assert.equal(cancelling.controlState, 'cancel-pending');
    const refused = await reconcile({ ...reconcileInput(fx, { transferCustody: { toSession: 'w-2', reason: 'r4-02 while cancelling', acknowledgeCessation: true } }), repoRoot: undefined });
    assert.equal(refused.ok, false, JSON.stringify(refused));
    assert.equal(refused.code, 'cessation_unconfirmed');
    const record = JSON.parse(readFileSync(fx.recordPath, 'utf8'));
    assert.equal(record.controlState, 'cancel-pending', 'the cancellation is NOT completed on a bare ack');
    assert.ok(record.holds.some((h) => h.code === 'cessation_unconfirmed' && h.clearedAt === null), 'the prerequisite hold survived the refusal durably');
    assert.ok(record.worker.cessationAckedAt === null, 'no cessation was acknowledged on the caller\'s word');
    assert.equal(record.custodyGeneration, 1);
    // INVALIDATED POSITIVE (fidelity-r2 F-2): the r1 arm completed the cancellation with
    // a digest-verifying evidence file for the bound task; a sourced ack is refused
    // exactly like a bare one (see the pause-pending sibling arm for the full note).
    const settled = await reconcile(reconcileInput(fx, { control: { kind: 'ack-cessation', actor: 'operator:matrix', reason: 'verified terminal record for the bound task', cessationEvidence: evidenceArtifact(fx, 'cessation-r402c.json', { task: 't-1', terminal: 'cancelled', source: 'aif-runtime' }) } }));
    assert.equal(settled.ok, false, JSON.stringify(settled));
    assert.equal(settled.code, 'cessation_unconfirmed');
    assert.equal(JSON.parse(readFileSync(fx.recordPath, 'utf8')).controlState, 'cancel-pending');
    rmSync(fx.base, { recursive: true, force: true });
  });
});
// ===========================================================================
// Fidelity-round-1 repairs (F-1 / F-2 / F-3) — each arm names the single production
// change that flips it (T22): F-1 -> the engine's intent-resolution and delivery/
// completion gates (evidence is a verified content reference via the intent helper's
// own resolveContentRef, never prose or a bare receipt string); F-2 -> record.mjs
// controlDestination's pending predicate (any bound-but-unconfirmed external work,
// not just a live local worker); F-3 -> the bounded seen-identity accumulator the
// engine consults before admitting a "fresh" receipt.
// ===========================================================================
describe('fidelity-r1 — facts at release and both doors; truthful cessation; evicted identity never fresh', () => {
  ltest('F-1: 20-character prose never resolves an unknown intent — refusal is structured, uncertainty stays, admission stays blocked', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t, ['--task-id', 't-1']));
    const act = runCli(recArgs(t, ['--request-action', 'work']));
    assert.equal(act.status, 0, act.stdout + act.stderr);
    const prose = runCli(recArgs(t, ['--resolve-intent', act.json.pendingIntent.actionId, '--resolution', 'applied', '--evidence', EVIDENCE]));
    assert.equal(prose.status, 2, prose.stdout + prose.stderr);
    assert.equal(prose.json.code, 'intent_resolution_unverified', prose.stdout);
    const st = runCli(['status', '--record', t.recordPath]);
    assert.equal(st.json.record.pendingIntent.state, 'intent_persisted', 'prose must not release the uncertainty');
    assert.ok(st.json.record.holds.some((h) => h.code === 'uncertain_owner' && h.clearedAt === null), 'the uncertainty hold stays open');
    const stillBlocked = runCli(recArgs(t, ['--request-action', 'work']));
    assert.equal(stillBlocked.status, 2);
    assert.equal(stillBlocked.json.code, 'intent_outstanding');
    rmSync(t.base, { recursive: true, force: true });
  });

  ltest('F-1: even a digest-verifying evidence reference never resolves the intent — caller-chosen bytes are not a fact about the referenced subsystem', async () => {
    // INVALIDATED POSITIVE (fidelity-r2 F-1): the r1 arm resolved the intent with
    // prd-approval.json + its correct digest («supported proof path») and cleared the
    // uncertainty hold. That is exactly the withdrawn semantics — the cited file
    // authenticates as bytes but says nothing about the referenced subsystem's current
    // outcome for this action. The refusal is the repaired behavior; the intent stays
    // persisted and the hold stays open until a stage-B live read exists.
    const t = makeFixture(null);
    runCli(initArgs(t, ['--task-id', 't-1']));
    const act = runCli(recArgs(t, ['--request-action', 'work']));
    assert.equal(act.status, 0, act.stdout + act.stderr);
    const approvalBytes = readFileSync(join(t.repo, 'prd-approval.json'));
    const resolved = runCli(recArgs(t, [
      '--resolve-intent', act.json.pendingIntent.actionId, '--resolution', 'applied', '--evidence', EVIDENCE,
      '--evidence-ref', 'prd-approval.json', '--evidence-sha256', sha256Hex(approvalBytes),
    ]));
    assert.equal(resolved.status, 2, resolved.stdout + resolved.stderr);
    assert.equal(resolved.json.code, 'intent_resolution_unverified', resolved.stdout);
    assert.match(resolved.json.reason, /authenticates as bytes/);
    const st = runCli(['status', '--record', t.recordPath]);
    assert.equal(st.json.record.pendingIntent.state, 'intent_persisted', 'authenticated claim data must not release the uncertainty');
    assert.ok(st.json.record.holds.some((h) => h.code === 'uncertain_owner' && h.clearedAt === null), 'the uncertainty hold stays open');
    const stillBlocked = runCli(recArgs(t, ['--request-action', 'work']));
    assert.equal(stillBlocked.status, 2);
    assert.equal(stillBlocked.json.code, 'intent_outstanding', 'admission stays blocked');
    rmSync(t.base, { recursive: true, force: true });
  });

  ltest('F-1: an evidence reference that fails digest verification does not resolve the intent', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t, ['--task-id', 't-1']));
    const act = runCli(recArgs(t, ['--request-action', 'work']));
    assert.equal(act.status, 0, act.stdout + act.stderr);
    const bad = runCli(recArgs(t, [
      '--resolve-intent', act.json.pendingIntent.actionId, '--resolution', 'applied', '--evidence', EVIDENCE,
      '--evidence-ref', 'prd-approval.json', '--evidence-sha256', sha256Hex('not the approval bytes'),
    ]));
    assert.equal(bad.status, 2, bad.stdout + bad.stderr);
    assert.equal(bad.json.code, 'evidence_unresolved', bad.stdout);
    const st = runCli(['status', '--record', t.recordPath]);
    assert.equal(st.json.record.pendingIntent.state, 'intent_persisted', 'failed verification never resolves');
    rmSync(t.base, { recursive: true, force: true });
  });

  ltest('F-1: an arbitrary receipt is recorded unverified and can NEVER complete door 1 (mark-complete)', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t, ['--task-id', 't-1']));
    const rec = runCli(recArgs(t, ['--delivery-receipt', 'receipt-ok']));
    assert.equal(rec.status, 0, rec.stdout + rec.stderr);
    let st = runCli(['status', '--record', t.recordPath]);
    assert.equal(st.json.record.delivery.receipt, 'receipt-ok');
    assert.equal(st.json.record.delivery.verified, false, 'a bare receipt string is recorded UNVERIFIED');
    assert.ok(st.json.record.holds.some((h) => h.code === 'delivery_evidence_unverified' && h.clearedAt === null), 'the unverified-delivery hold is persisted');
    const door1 = runCli(recArgs(t, ['--mark-complete']));
    assert.equal(door1.status, 2, door1.stdout + door1.stderr);
    assert.equal(door1.json.code, 'delivery_evidence_unverified', door1.stdout);
    st = runCli(['status', '--record', t.recordPath]);
    assert.equal(st.json.record.controlState, 'active', 'the arbitrary receipt did not terminally complete');
    rmSync(t.base, { recursive: true, force: true });
  });

  ltest('F-1: an arbitrary receipt can never complete door 2 (control complete) either', async () => {
    const t = makeFixture(null);
    const bound = await initBinding(initBindingInput(t));
    assert.ok(bound.ok, JSON.stringify(bound));
    const door2 = await reconcile(reconcileInput(t, { deliveryReceipt: 'receipt-bare', control: { kind: 'complete', actor: 'matrix:library-door' } }));
    assert.equal(door2.ok, false, JSON.stringify(door2));
    assert.equal(door2.code, 'delivery_evidence_unverified', JSON.stringify(door2));
    const st = runCli(['status', '--record', t.recordPath]);
    assert.equal(st.json.record.controlState, 'active');
    rmSync(t.base, { recursive: true, force: true });
  });

  ltest('F-1: a sourced delivery authenticates but NEVER verifies or completes — even correct caller bytes are claim data, not a subsystem fact', async () => {
    // INVALIDATED POSITIVE (fidelity-r2 F-1): the r1 arm recorded a content-addressed
    // delivery artifact and asserted `verified: true` + a 'complete' termination («the
    // genuine positive fixture»). That fixture manufactured establishment from
    // caller-chosen bytes — precisely F-1. Post-repair the delivery is recorded as
    // authenticated claim data (verified stays false), the evidence hold stays open,
    // and both completion doors stay closed pending the stage-B live-read capability.
    const t = makeFixture(null);
    runCli(initArgs(t, ['--task-id', 't-1']));
    const artifact = JSON.stringify({ delivered: true, receipt: 'receipt-sourced', destination: 'pr:staging' }, null, 2);
    writeFileSync(join(t.stageRoot, 'delivery-evidence.json'), artifact);
    const rec = runCli(recArgs(t, [
      '--delivery-receipt', 'receipt-sourced',
      '--delivery-evidence-ref', 'delivery-evidence.json', '--delivery-evidence-sha256', sha256Hex(artifact),
    ]));
    assert.equal(rec.status, 0, rec.stdout + rec.stderr);
    let st = runCli(['status', '--record', t.recordPath]);
    assert.equal(st.json.record.delivery.verified, false, 'authentication is not establishment — the delivery stays unverified claim data');
    assert.ok(st.json.record.holds.some((h) => h.code === 'delivery_evidence_unverified' && h.clearedAt === null), 'the evidence hold stays open even with authentic bytes');
    const done = runCli(recArgs(t, ['--mark-complete']));
    assert.equal(done.status, 2, done.stdout + done.stderr);
    assert.equal(done.json.code, 'delivery_evidence_unverified');
    st = runCli(['status', '--record', t.recordPath]);
    assert.equal(st.json.record.controlState, 'active', 'the sourced delivery did not terminally complete');
    rmSync(t.base, { recursive: true, force: true });
  });

  ltest('F-1: an evidence artifact removed after recording never resurrects completion — the door stays closed with or without the artifact present', async () => {
    // Fidelity-r2 note: the door no longer re-verifies at completion (that r1 mechanism
    // was part of the withdrawn semantics — the artifact's presence never established
    // the delivery fact in the first place). The refusal code is unchanged; the arm
    // keeps pinning that a vanished artifact cannot become the missing establishment.
    const t = makeFixture(null);
    runCli(initArgs(t, ['--task-id', 't-1']));
    const artifact = JSON.stringify({ delivered: true, receipt: 'receipt-vanishing' }, null, 2);
    const evidencePath = join(t.stageRoot, 'delivery-evidence.json');
    writeFileSync(evidencePath, artifact);
    const rec = runCli(recArgs(t, [
      '--delivery-receipt', 'receipt-vanishing',
      '--delivery-evidence-ref', 'delivery-evidence.json', '--delivery-evidence-sha256', sha256Hex(artifact),
    ]));
    assert.equal(rec.status, 0, rec.stdout + rec.stderr);
    rmSync(evidencePath);
    const door1 = runCli(recArgs(t, ['--mark-complete']));
    assert.equal(door1.status, 2, door1.stdout + door1.stderr);
    assert.equal(door1.json.code, 'delivery_evidence_unverified', door1.stdout);
    const st = runCli(['status', '--record', t.recordPath]);
    assert.equal(st.json.record.controlState, 'active', 'completion stayed closed when the evidence no longer resolves');
    rmSync(t.base, { recursive: true, force: true });
  });

  ltest('F-2: a bound AIF task with no local worker keeps pause and cancel PENDING — neither a bare ack nor digest-verifying evidence settles it (fidelity-r2 F-2: no stage-A establishment)', async () => {
    // Flip site: record.mjs controlDestination — the pending predicate must count bound
    // external work (aif.taskId / nativeAttempts / unresolved effect), not just a live
    // local worker (design: «direct host routine disable … does not by itself cancel an
    // existing AIF task»; worker=null, expired lock or timeout proves nothing). Second
    // flip site (the ack door): the settlement of that pending state requires verified
    // cessation evidence — a bare acknowledgement is a caller assertion, refused with
    // the persisted cessation_unconfirmed hold, never a synthetic stopped disposition.
    const t = makeFixture(null);
    runCli(initArgs(t, ['--task-id', 't-1']));
    const pause = runCli(['pause', '--record', t.recordPath, '--control-reason', 'operator pause, task still bound', '--now', iso()]);
    assert.equal(pause.status, 0, pause.stdout + pause.stderr);
    assert.equal(pause.json.controlState, 'pause-pending', 'a bound AIF task keeps the pause cessation-pending');
    const denied = runCli(recArgs(t, ['--request-action', 'work']));
    assert.equal(denied.status, 2);
    assert.equal(denied.json.code, 'admission_blocked', 'a pending pause blocks new admission');
    const bare = await reconcile(reconcileInput(t, { control: { kind: 'ack-cessation', actor: 'operator:matrix', reason: 'the bound subsystem confirms no work remains' } }));
    assert.equal(bare.ok, false, JSON.stringify(bare));
    assert.equal(bare.code, 'cessation_unconfirmed', 'a bare acknowledgement — reason prose included — cannot settle referenced external work');
    const pendingAfter = JSON.parse(readFileSync(t.recordPath, 'utf8'));
    assert.equal(pendingAfter.controlState, 'pause-pending', 'the pending state is retained — no fake stopped disposition');
    assert.ok(pendingAfter.holds.some((h) => h.code === 'cessation_unconfirmed' && h.clearedAt === null), 'the persisted prerequisite hold names the recovery');
    const deniedAfterRefusal = runCli(recArgs(t, ['--request-action', 'work']));
    assert.equal(deniedAfterRefusal.status, 2);
    assert.equal(deniedAfterRefusal.json.code, 'admission_blocked', 'admission stays blocked while cessation is unconfirmed');
    // INVALIDATED POSITIVE (fidelity-r2 F-2): the r1 arm settled the pause with a
    // digest-verifying evidence file naming the bound task. Authentication of
    // caller-chosen bytes is not establishment of the referenced subsystem's stop —
    // a sourced ack is refused exactly like a bare one, and the pending state (plus
    // the hold) is retained until stage B's live readers exist. The genuinely
    // reachable positive — a taskless sibling binding whose LOCAL worker acknowledges
    // its own cessation — is pinned in the state-machine arm.
    const ack = await reconcile(reconcileInput(t, { control: { kind: 'ack-cessation', actor: 'operator:matrix', reason: 'verified terminal record for the bound task', cessationEvidence: evidenceArtifact(t, 'cessation-f2-pause.json', { task: 't-1', terminal: 'cancelled', source: 'aif-runtime' }) } }));
    assert.equal(ack.ok, false, JSON.stringify(ack));
    assert.equal(ack.code, 'cessation_unconfirmed');
    const settledBytes = JSON.parse(readFileSync(t.recordPath, 'utf8'));
    assert.equal(settledBytes.controlState, 'pause-pending', 'sourced evidence did not complete the pause either');
    assert.ok(settledBytes.holds.some((h) => h.code === 'cessation_unconfirmed' && h.clearedAt === null), 'the prerequisite hold persists after the sourced refusal');
    assert.equal(settledBytes.aif.cessationConfirmedAt, null, 'no establishment stamp was written');
    rmSync(t.base, { recursive: true, force: true });

    const t2 = makeFixture(null);
    runCli(initArgs(t2, ['--task-id', 't-1']));
    const cancel = runCli(['cancel', '--record', t2.recordPath, '--control-reason', 'operator cancel, task still bound', '--now', iso()]);
    assert.equal(cancel.status, 0, cancel.stdout + cancel.stderr);
    assert.equal(cancel.json.controlState, 'cancel-pending', 'a bound AIF task keeps the cancel cessation-pending');
    const late = runCli(recArgs(t2, ['--observation', obs('late-f2', 'done')]));
    assert.equal(late.json.observationDisposition, 'historical-after-cancel', 'late results stay historical');
    assert.equal(late.json.controlState, 'cancel-pending', 'a late result never completes the cancellation');
    const bare2 = await reconcile(reconcileInput(t2, { control: { kind: 'ack-cessation', actor: 'operator:matrix', reason: 'the bound subsystem confirms cancellation took effect' } }));
    assert.equal(bare2.ok, false);
    assert.equal(bare2.code, 'cessation_unconfirmed');
    assert.equal(JSON.parse(readFileSync(t2.recordPath, 'utf8')).controlState, 'cancel-pending', 'the cancellation stays pending on a bare ack');
    // INVALIDATED POSITIVE (fidelity-r2 F-2): see the pause half — sourced evidence is
    // refused with the same code; the cancellation stays pending.
    const ack2 = await reconcile(reconcileInput(t2, { control: { kind: 'ack-cessation', actor: 'operator:matrix', reason: 'verified terminal record for the bound task', cessationEvidence: evidenceArtifact(t2, 'cessation-f2-cancel.json', { task: 't-1', terminal: 'cancelled', source: 'aif-runtime' }) } }));
    assert.equal(ack2.ok, false, JSON.stringify(ack2));
    assert.equal(ack2.code, 'cessation_unconfirmed');
    assert.equal(JSON.parse(readFileSync(t2.recordPath, 'utf8')).controlState, 'cancel-pending', 'sourced evidence did not complete the cancellation either');
    rmSync(t2.base, { recursive: true, force: true });
  });

  ltest('F-2 (CLI): the ack door is reachable through the shipped surface — bare AND digest-verifying --ack-cessation both refuse with the prerequisite hold (fidelity-r2 F-2: no stage-A establishment)', async () => {
    // T22 flip-site note: the persisted hold's recoveryAction names these exact CLI
    // flags — if the CLI did not carry them the recovery would be a dead end no caller
    // could reach. This arm drives the REAL CLI subprocess end to end.
    const t = makeFixture(null);
    runCli(initArgs(t, ['--task-id', 't-1']));
    const pause = runCli(['pause', '--record', t.recordPath, '--control-reason', 'operator pause, task still bound', '--now', iso()]);
    assert.equal(pause.status, 0, pause.stdout + pause.stderr);
    assert.equal(pause.json.controlState, 'pause-pending');
    const bare = runCli(recArgs(t, ['--ack-cessation', '--control-reason', 'caller asserts the subsystem stopped']));
    assert.equal(bare.status, 2, bare.stdout + bare.stderr);
    assert.equal(bare.json.code, 'cessation_unconfirmed', bare.stdout);
    assert.equal(JSON.parse(readFileSync(t.recordPath, 'utf8')).controlState, 'pause-pending', 'no synthetic stopped disposition through the CLI either');
    // A digest that does not match the cited bytes never establishes cessation.
    const evidence = evidenceArtifact(t, 'cessation-cli.json', { task: 't-1', terminal: 'cancelled', source: 'aif-runtime' });
    const badDigest = runCli(recArgs(t, ['--ack-cessation', '--control-reason', 'wrong digest', '--cessation-evidence-ref', evidence.path, '--cessation-evidence-sha256', sha256Hex('not the artifact bytes')]));
    assert.equal(badDigest.status, 2, badDigest.stdout + badDigest.stderr);
    assert.equal(badDigest.json.code, 'cessation_unconfirmed', badDigest.stdout);
    assert.equal(JSON.parse(readFileSync(t.recordPath, 'utf8')).controlState, 'pause-pending', 'a failed verification leaves the pause pending');
    // INVALIDATED POSITIVE (fidelity-r2 F-2): the r1 arm settled the pause through this
    // exact CLI pair with the CORRECT digest and asserted the establishment stamps.
    // Post-repair the correctly-digested artifact authenticates but establishes nothing
    // about the bound subsystem — the refusal is identical, no stamp is ever written,
    // and the prerequisite hold stays open (the pause resolves only on the taskless
    // sibling path, where the local worker's own ack is the independent mechanism).
    const settled = runCli(recArgs(t, ['--ack-cessation', '--control-reason', 'verified terminal record for the bound task', '--cessation-evidence-ref', evidence.path, '--cessation-evidence-sha256', evidence.sha256]));
    assert.equal(settled.status, 2, settled.stdout + settled.stderr);
    assert.equal(settled.json.code, 'cessation_unconfirmed', settled.stdout);
    assert.match(settled.json.reason, /authenticates as bytes/, 'the refusal names the cited artifact as authentication, not establishment');
    const st = runCli(['status', '--record', t.recordPath]);
    assert.equal(st.json.record.aif.cessationEvidence, null, 'no establishment fact was recorded from caller bytes');
    assert.equal(st.json.record.aif.cessationConfirmedAt, null, 'cessationConfirmedAt is never stamped in stage A');
    const openHold = st.json.record.holds.find((h) => h.code === 'cessation_unconfirmed' && h.clearedAt === null);
    assert.ok(openHold, 'the prerequisite hold is durable');
    assert.match(openHold.recoveryAction, /independent read/, 'the hold names the stage-B live read as the recovery');
    rmSync(t.base, { recursive: true, force: true });
  });

  ltest('F-2: a truly empty binding (no worker, no task, no native attempts, no intent) pauses and cancels directly — positive control', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t));
    const pause = runCli(['pause', '--record', t.recordPath, '--control-reason', 'pause with nothing external bound', '--now', iso()]);
    assert.equal(pause.status, 0, pause.stdout + pause.stderr);
    assert.equal(pause.json.controlState, 'paused', 'with NO external work bound there is nothing whose cessation to await');
    const st = runCli(['status', '--record', t.recordPath]);
    assert.equal(st.json.record.disposition, 'paused');
    rmSync(t.base, { recursive: true, force: true });
    const t2 = makeFixture(null);
    runCli(initArgs(t2));
    const cancel = runCli(['cancel', '--record', t2.recordPath, '--control-reason', 'cancel with nothing external bound', '--now', iso()]);
    assert.equal(cancel.status, 0, cancel.stdout + cancel.stderr);
    assert.equal(cancel.json.controlState, 'cancelled');
    rmSync(t2.base, { recursive: true, force: true });
  });

  ltest('F-2 (pure): an unresolved pendingIntent — an unestablished effect — keeps pause and cancel pending', async () => {
    const base = initialRecord({ ...initRecordFields(), taskId: null }, { now: iso() });
    assert.ok(base.ok, JSON.stringify(base));
    const withIntent = {
      ...base.value,
      pendingIntent: { actionId: 'act-pure-f2', action: 'work', recordedAt: iso(), state: 'intent_persisted', bound: {} },
    };
    const paused = applyControlTransition(withIntent, { kind: 'pause', actor: 'operator:matrix', now: iso() });
    assert.ok(paused.ok, JSON.stringify(paused));
    assert.equal(paused.value.controlState, 'pause-pending', 'the unknown effect keeps the pause pending');
    const cancelled = applyControlTransition(withIntent, { kind: 'cancel', actor: 'operator:matrix', now: iso() });
    assert.ok(cancelled.ok, JSON.stringify(cancelled));
    assert.equal(cancelled.value.controlState, 'cancel-pending', 'the unknown effect keeps the cancel pending');
  });

  ltest('F-2 (pure): recorded native attempts keep pause and cancel pending', async () => {
    const base = initialRecord({ ...initRecordFields(), taskId: null }, { now: iso() });
    assert.ok(base.ok, JSON.stringify(base));
    const withAttempts = { ...base.value, nativeAttempts: [{ attemptId: 'n-1', at: iso() }] };
    const paused = applyControlTransition(withAttempts, { kind: 'pause', actor: 'operator:matrix', now: iso() });
    assert.ok(paused.ok, JSON.stringify(paused));
    assert.equal(paused.value.controlState, 'pause-pending', 'a recorded native attempt keeps the pause pending');
    const cancelled = applyControlTransition(withAttempts, { kind: 'cancel', actor: 'operator:matrix', now: iso() });
    assert.ok(cancelled.ok, JSON.stringify(cancelled));
    assert.equal(cancelled.value.controlState, 'cancel-pending', 'a recorded native attempt keeps the cancel pending');
  });

  ltest('F-3: a receipt evicted from the bounded history is never eligible as a newer candidate’s fresh delivery — hold, both doors closed; a genuinely distinct sourced receipt still ADMITS (completion stays closed — fidelity-r2 F-1)', async () => {
    // Flip site: engine recordDelivery — the seen-identity accumulator consulted before
    // any "fresh" admission. The prior code re-bound the evicted identity as the current
    // candidate's delivery. Invalidated fixture precondition, reported per the rework
    // contract: this arm SUPERSEDES the former «R3-02 documented limit» end-to-end arm,
    // which asserted exactly that re-bind (status 0, receipt bound to candidate
    // DELIVERY_HISTORY_MAX+3) — the pre-repair eviction behavior the audit named F-3.
    // Its negative-safety residue (window bounded at DELIVERY_HISTORY_MAX; the evicted
    // identity never retained in history) is asserted below, alongside the upgrades the
    // repair adds: fail-closed hold, both completion doors closed, and a genuinely
    // SOURCED distinct receipt that still admits and completes.
    const fx = makeFixture(null);
    assert.equal(runCli(initArgs(fx, ['--task-id', 't-1', '--candidate-revision', '1', '--candidate-sha256', sha256Hex('c1')])).status, 0);
    assert.equal(runCli(recArgs(fx, ['--delivery-receipt', 'receipt-evicted-replay'])).status, 0);
    for (let revision = 2; revision <= DELIVERY_HISTORY_MAX + 2; revision += 1) {
      assert.equal(runCli(recArgs(fx, ['--candidate-revision', String(revision), '--candidate-sha256', sha256Hex(`c${revision}`)])).status, 0, `advance ${revision}`);
      assert.equal(runCli(recArgs(fx, ['--delivery-receipt', `receipt-churn-${revision}`])).status, 0, `deliver ${revision}`);
    }
    assert.equal(runCli(recArgs(fx, ['--candidate-revision', String(DELIVERY_HISTORY_MAX + 3), '--candidate-sha256', sha256Hex('c-final')])).status, 0);
    // The delayed replay of the EVICTED first receipt: identity cannot be established —
    // it is HELD, never bound to the new candidate.
    const replay = runCli(recArgs(fx, ['--delivery-receipt', 'receipt-evicted-replay']));
    assert.equal(replay.status, 2, replay.stdout + replay.stderr);
    assert.equal(replay.json.code, 'delivery_identity_unestablishable', replay.stdout);
    let record = JSON.parse(readFileSync(fx.recordPath, 'utf8'));
    assert.equal(record.delivery.receipt, `receipt-churn-${DELIVERY_HISTORY_MAX + 2}`, 'the evicted identity did not become the new candidate’s delivery');
    assert.equal(record.delivery.candidateRevision, DELIVERY_HISTORY_MAX + 2);
    assert.ok(record.holds.some((h) => h.code === 'delivery_identity_unestablishable' && h.clearedAt === null), 'the identity hold is persisted with its recovery action');
    assert.equal(record.deliveryHistory.length, DELIVERY_HISTORY_MAX, 'the window stays bounded');
    // Bounded hold log (T22 flip site: the clearHolds inside admitDelivery): every bare
    // churn delivery names its receipt in the hold reason, so without the stale-subject
    // clear each candidate advance would APPEND an open hold and grow the record per
    // advance. Exactly ONE open unverified-evidence hold survives — the CURRENT
    // delivery's — and the superseded subjects stay in the log as cleared audit rows.
    const unverifiedOpen = record.holds.filter((h) => h.code === 'delivery_evidence_unverified' && h.clearedAt === null);
    assert.equal(unverifiedOpen.length, 1, 'exactly one OPEN unverified-evidence hold — the current delivery\'s (no per-advance pile-up)');
    assert.match(unverifiedOpen[0].reason, /receipt-churn-22/, 'the open hold names the current delivery');
    const unverifiedCleared = record.holds.filter((h) => h.code === 'delivery_evidence_unverified' && h.clearedAt !== null);
    assert.equal(unverifiedCleared.length, DELIVERY_HISTORY_MAX + 1, 'every superseded subject stays in the bounded log as a cleared audit row (the first receipt + churn-2..churn-21)');
    assert.match(unverifiedCleared[0].reason, /receipt-evicted-replay/, 'the cleared rows keep their receipt-named reasons (audit trail, not deletion — the first cleared row is the first receipt\'s)');
    assert.match(unverifiedCleared[unverifiedCleared.length - 1].reason, /receipt-churn-21/, 'the last cleared row names the delivery before the current one');
    // Both completion doors stay closed for the new candidate.
    const door1 = runCli(recArgs(fx, ['--mark-complete']));
    assert.equal(door1.status, 2, door1.stdout + door1.stderr);
    const door2 = await reconcile(reconcileInput(fx, { control: { kind: 'complete', actor: 'matrix:library-door' } }));
    assert.equal(door2.ok, false, JSON.stringify(door2));
    // A genuinely distinct, sourced receipt for the current candidate still admits.
    // INVALIDATED POSITIVE (fidelity-r2 F-1): the r1 arm completed on it (mark-complete
    // → 'complete'). Sourced bytes are authenticated claim data — the F-3 identity
    // contract is untouched, and completion stays refused pending the stage-B read.
    const artifact = JSON.stringify({ delivered: true, receipt: 'receipt-final', candidate: DELIVERY_HISTORY_MAX + 3 }, null, 2);
    writeFileSync(join(fx.stageRoot, 'final-delivery.json'), artifact);
    const fresh = runCli(recArgs(fx, [
      '--delivery-receipt', 'receipt-final',
      '--delivery-evidence-ref', 'final-delivery.json', '--delivery-evidence-sha256', sha256Hex(artifact),
    ]));
    assert.equal(fresh.status, 0, fresh.stdout + fresh.stderr);
    const done = runCli(recArgs(fx, ['--mark-complete']));
    assert.equal(done.status, 2, done.stdout + done.stderr);
    assert.equal(done.json.code, 'delivery_evidence_unverified');
    record = JSON.parse(readFileSync(fx.recordPath, 'utf8'));
    assert.equal(record.delivery.receipt, 'receipt-final');
    assert.equal(record.delivery.candidateRevision, DELIVERY_HISTORY_MAX + 3, 'the fresh receipt bound the CURRENT candidate');
    assert.equal(record.controlState, 'active', 'the F-3 contract left the record non-terminal');
    rmSync(fx.base, { recursive: true, force: true });
  });

  ltest('F-3 (pure): the seen-identity accumulator is bounded, deterministic, and never forgets an admitted receipt', async () => {
    // Link-safe dynamic import: at the RED step these exports do not exist yet, and a
    // static missing named export would fail the whole file at link time.
    const mod = await import('./autonomy-binding/record.mjs');
    assert.equal(typeof mod.seenMaskEmptyHex, 'function', 'seenMaskEmptyHex export missing');
    assert.equal(typeof mod.seenMaskAddHex, 'function', 'seenMaskAddHex export missing');
    assert.equal(typeof mod.seenMaskMayHaveSeenHex, 'function', 'seenMaskMayHaveSeenHex export missing');
    const empty = mod.seenMaskEmptyHex();
    assert.equal(empty, /^[0-9a-f]+$/.test(empty) ? empty : '', 'the empty mask is hex');
    assert.equal(mod.seenMaskMayHaveSeenHex(empty, 'receipt-a'), false, 'an unseen receipt is provably fresh');
    const once = mod.seenMaskAddHex(empty, 'receipt-a');
    assert.equal(once, mod.seenMaskAddHex(empty, 'receipt-a'), 'the mask update is deterministic (no clock, no randomness)');
    assert.equal(mod.seenMaskMayHaveSeenHex(once, 'receipt-a'), true, 'an admitted receipt is never forgotten — no false freshness');
    assert.equal(mod.seenMaskMayHaveSeenHex(once, 'receipt-b'), false, 'a distinct receipt stays fresh (chosen fixtures do not collide)');
    const twice = mod.seenMaskAddHex(once, 'receipt-b');
    assert.equal(twice.length, once.length, 'the mask size is FIXED — bounded storage by construction');
    assert.equal(once.length, empty.length, 'admitting receipts never grows the record');
    assert.equal(mod.seenMaskMayHaveSeenHex(twice, 'receipt-a'), true, 'the second admission did not erase the first');
  });

  ltest('F-3 (pure): a single-bit collision never fails a genuinely fresh receipt closed — the BOTH-bits freshness contract', async () => {
    // Flip site: record.mjs seenMaskMayHaveSeenHex. Admission sets BOTH of a receipt's
    // bits, so exactly-one-shared-bit with an admitted receipt can only be that
    // receipt's collision — the probe must stay provably fresh (any bit still 0 ⇒ never
    // admitted, the module's no-false-negative argument). The ANY-bit probe this arm
    // pins against returned true there, failing fresh receipts closed (a false
    // «may have seen» contradicting the module contract).
    const mod = await import('./autonomy-binding/record.mjs');
    const bitsOf = (r) => {
      const d = mod.sha256Hex(`delivery-seen:${r}`);
      return [Number(BigInt(parseInt(d.slice(0, 8), 16)) % BigInt(mod.SEEN_MASK_BITS)), Number(BigInt(parseInt(d.slice(8, 16), 16)) % BigInt(mod.SEEN_MASK_BITS))];
    };
    const freshProbe = 'collision-probe-419';
    const a = bitsOf('receipt-a');
    const p = bitsOf(freshProbe);
    const shared = p.filter((b) => b === a[0] || b === a[1]);
    assert.equal(shared.length, 1, `fixture precondition: exactly one shared bit (receipt-a=${a.join('/')}, probe=${p.join('/')}) — re-derive the fixture if the bit derivation changes; pin reason: a one-bit-overlap receipt is the ONLY input that discriminates BOTH-bit from ANY-bit semantics`);
    const empty = mod.seenMaskEmptyHex();
    const withA = mod.seenMaskAddHex(empty, 'receipt-a');
    assert.equal(mod.seenMaskMayHaveSeenHex(withA, freshProbe), false, 'a one-bit collision is NOT a replay — the receipt is provably fresh');
    assert.equal(mod.seenMaskMayHaveSeenHex(mod.seenMaskAddHex(withA, freshProbe), freshProbe), true, 'once actually admitted, it is never forgotten');
    assert.equal(mod.seenMaskMayHaveSeenHex(withA, 'receipt-a'), true, 'the genuinely-admitted identity is still caught through its own bits');
  });
});

// ===========================================================================
// Row 13 aftermath — MUST be the LAST top-level test declaration: it asserts zero
// outbound TCP connections and zero HTTP requests across the ENTIRE claimed run
// (every arm above), and only then closes the recorder. (Correction R3, 2026-10-27:
// this comment previously said a top-level after() is «silently never run» by
// node --test on this Node version — an isolated exact-runtime probe has since
// fired the hook, so that claim is retracted; the ordered last test stays as the
// closure channel because the suite itself proves it executes, not because
// after() cannot.)
// ===========================================================================
test('row 13 aftermath: zero accepted connections and zero requests across the whole run, then the recorder closes', async () => {
  assert.equal(recorderConnections, 0, `no TCP connection may reach the recorder (${recorderConnections} did)`);
  assert.equal(recorderHits, 0, `no HTTP request may reach the recorder (${recorderHits} did)`);
  await new Promise((settle) => recorder.close(settle));
});



// ===========================================================================
// Shared input builders for the library-level arms (kept LAST so the CLI blocks above
// read first; these construct the same shapes the CLI would).
// ===========================================================================
function initRecordFields() {
  return {
    featureId: FID,
    stage: STAGE,
    repoIdentity: '/tmp/unused-identity',
    repoRoot: '/tmp/unused',
    stageArtifactRoot: '/tmp/unused/artifacts',
    recordPath: '/tmp/unused/artifacts/binding.json',
    actions: ['observe', 'work'],
    destination: 'pr:staging',
    selectorRevision: 1,
  };
}

function initBindingInput(fx) {
  return {
    repoRoot: fx.repo,
    featureId: FID,
    stage: STAGE,
    stageArtifactRoot: fx.stageRoot,
    recordPath: fx.recordPath,
    featureHome: fx.home,
    actions: ['observe', 'work', 'review', 'hold', 'complete'],
    destination: 'pr:staging',
    taskId: 't-1',
    worker: { sessionId: 'w-1', pid: 999999, startedAt: iso(), host: null, cessationAckedAt: null },
    now: iso(),
    actor: 'matrix:library-arm',
  };
}

function reconcileInput(fx, extra = {}) {
  return {
    recordPath: fx.recordPath,
    repoRoot: fx.repo,
    featureHome: fx.home,
    now: iso(),
    actor: 'matrix:library-arm',
    ...extra,
  };
}
