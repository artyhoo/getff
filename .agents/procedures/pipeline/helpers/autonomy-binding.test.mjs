/**
 * autonomy-binding.test.mjs — adversarial matrix for the Stage-A1 autonomy binding
 * (portable-verified-autonomy plan Task 5, kickoff §3.6 rows 1-19).
 *
 * Shape: `node --test` over this file. Fixtures are per-test mkdtemp trees (a fake repo
 * with a `.git` dir, a current-decisions selector with live-resolvable ContentRefs, and a
 * stage-artifact root INSIDE the repo). Every subprocess is the REAL one-shot CLI
 * (autonomy-binding.mjs) driven through spawnSync/spawn — no in-process shortcuts on the
 * production paths — except the rows that are explicitly library-level unit arms (rows 8
 * custody, 14 CAS, 15, 16 alias residual, 18, 19 pure battery), which call the modules a
 * library consumer would call and are labelled as such inline.
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
 * connections across the whole run, and static arms assert the six modules never import
 * or call an outbound client at all.
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
} from './autonomy-binding/record.mjs';
import {
  readRecord, writeRecordAtomic, ensureStageOwnership, resolveRecordTarget,
  canonicalRecordPath,
} from './autonomy-binding/store.mjs';
import {
  platformSupportsAbstractBindLock, acquireBindLock, lockNameForRecord,
  LOCK_RETRY_DEFAULT_BUDGET_MS,
} from './autonomy-binding/lock.mjs';

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
// Prohibited-effects recorder (row 13): every subprocess gets env pointing the
// known outbound seams at this listener; the `aftermath` test at the END of this
// file asserts it never accepted a single connection. The listener itself is
// inert — it only counts. (It is closed there too: a top-level after() would
// leave it listening forever on this Node version and hang the runner.)
// ---------------------------------------------------------------------------
let recorderHits = 0;
const recorder = createServer(() => { recorderHits += 1; });
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
// The row-13 recorder is closed by the `aftermath` test at the END of this file — a
// top-level after() is silently NEVER run by `node --test` on this Node version
// (verified empirically: a minimal describe+after file exits 0 with the hook skipped),
// so an after()-held cleanup would leave the recorder listening and hang the runner.

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

function initArgs(fx, extra = []) {
  return [
    'init',
    '--record', fx.recordPath,
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

// ===========================================================================
// Row 1 — init + valid reconcile, unchanged authority; revisions monotonic.
// ===========================================================================
describe('row 1 — init + valid reconcile', () => {
  test('init binds with live-verifiable authority; envelope reports the work route', async () => {
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

  test('valid reconcile with unchanged authority: no mutation, no holds, route from durable state', async () => {
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

  test('re-init on a bound record fails closed (CAS must-not-exist arm)', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t));
    const res = runCli(initArgs(t));
    assert.equal(res.status, 2);
    assert.equal(res.json.code, 'record_already_bound');
    rmSync(t.base, { recursive: true, force: true });
  });

  test('revisions are strictly monotonic across a mutating sequence', async () => {
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
  test('selector revision advance → authority_changed hold; record authority refreshed to live', async () => {
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

  test('stale evidence is never treated as current: an open authority hold blocks new action admission', async () => {
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

  test('hold clears on the next stable read; admission resumes only after it clears', async () => {
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

  test('unresolvable authority → authority_unavailable hold; admission blocked; recovery action names the fix', async () => {
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

  test('authority_unavailable recovers: the stable read clears the hold; admission resumes on the NEXT reconcile', async () => {
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
  test('two overlapping reconciles serialize on the bind lock; both effects land, revisions advance twice', async () => {
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

  test('a short-budget acquirer loses with lock_contended and writes nothing (never a takeover)', async () => {
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

  test('CAS backstop (library arm): two writers against one revision → record_revision_conflict', async () => {
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
  test('prewrite SIGKILL: no partial record, no pending intent, no tmp residue', async () => {
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

  test('intent-persisted SIGKILL: intent IS durable; restart classifies uncertain_owner with a concrete recovery action (rows 4+10)', async () => {
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
    assert.match(hold.recoveryAction, new RegExp(`--resolve-intent ${intent.actionId}`));
    assert.match(hold.recoveryAction, /--resolution/);
    assert.equal(restart.json.pendingIntent.actionId, intent.actionId, 'no duplicate action-identity re-issue');

    // A second request while unresolved is refused — the SAME identity stays open.
    const reRequest = runCli(recArgs(t, ['--request-action', 'work']));
    assert.equal(reRequest.status, 2);
    assert.equal(reRequest.json.code, 'intent_outstanding');
    const again = runCli(['status', '--record', t.recordPath]);
    assert.equal(again.json.record.pendingIntent.actionId, intent.actionId);

    // Resolve → hold cleared, intent resolved, admission possible again.
    const resolved = runCli(recArgs(t, ['--resolve-intent', intent.actionId, '--resolution', 'applied', '--evidence', EVIDENCE]));
    assert.equal(resolved.status, 0, resolved.stdout + resolved.stderr);
    assert.ok(resolved.json.effects.includes('intent-resolved:applied'), JSON.stringify(resolved.json.effects));
    assert.deepEqual(resolved.json.holds, []);
    rmSync(t.base, { recursive: true, force: true });
  });

  test('commit SIGKILL: the effect is durable and re-reconciling is idempotent (no duplicate observation, no duplicate delivery)', async () => {
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

  test('a second, DIFFERENT receipt while one is recorded is a rejected duplicate delivery', async () => {
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
    test(`observation kind ${kind}: routed to hold, custody/control/cessation untouched`, async () => {
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
  test('the same observationId re-reported is disposition duplicate; one stored entry; no revision burned', async () => {
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
  test('late report while pause-pending: recorded historical; control stays pending; admission blocked', async () => {
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

  test('late report while paused: recorded historical; control stays paused', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t, ['--task-id', 't-1']));
    runCli(['pause', '--record', t.recordPath, '--control-reason', 'operator pause, no worker bound', '--now', iso()]);
    const late = runCli(recArgs(t, ['--observation', obs('late-2', 'done')]));
    assert.equal(late.json.observationDisposition, 'historical-after-pause');
    const st = runCli(['status', '--record', t.recordPath]);
    assert.equal(st.json.record.controlState, 'paused');
    assert.equal(st.json.record.disposition, 'paused');
    rmSync(t.base, { recursive: true, force: true });
  });

  test('late report after cancel: recorded historical; terminal state holds; nothing reopens it', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t, ['--task-id', 't-1']));
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
  test('candidate regression rejected; record keeps the newer candidate', async () => {
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

  test('same-revision candidate with different bytes updates nothing', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t, ['--candidate-revision', '1', '--candidate-sha256', sha256Hex('c1')]));
    const res = runCli(recArgs(t, ['--candidate-revision', '1', '--candidate-sha256', sha256Hex('other')]));
    assert.equal(res.status, 0);
    assert.equal(res.json.mutated, false);
    const st = runCli(['status', '--record', t.recordPath]);
    assert.equal(st.json.record.candidate.sha256, sha256Hex('c1'));
    rmSync(t.base, { recursive: true, force: true });
  });

  test('stale custody generation (library arm): superseded worker reporting late is historical-stale-custody', async () => {
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
  test('observation payload fields beyond the known schema are dropped, not ingested', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t, ['--task-id', 't-1']));
    const sneaky = JSON.stringify({ taskId: 't-1', kind: 'done', observationId: 'sneaky-1', command: 'resume', control: 'cancelled', actions: ['work'], grant: { action: 'resume' } });
    const res = runCli(recArgs(t, ['--observation', sneaky]));
    assert.equal(res.status, 0);
    const st = runCli(['status', '--record', t.recordPath]);
    const stored = st.json.record.observations.find((o) => o.observationId === 'sneaky-1');
    assert.ok(stored);
    assert.deepEqual(Object.keys(stored).sort(), ['candidateRevision', 'custodyGeneration', 'disposition', 'kind', 'observationId', 'reason', 'receivedAt', 'resultRef', 'status', 'taskId'], 'only whitelisted fields are stored — injected control/grant fields vanish');
    assert.equal(stored.command, undefined);
    assert.equal(stored.grant, undefined);
    assert.equal(st.json.record.controlState, 'active', 'the payload changed no control state');
    rmSync(t.base, { recursive: true, force: true });
  });

  test('an action outside the fixed init grant list is refused — no flag extends the grant', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t, ['--actions', 'observe,hold']));
    const res = runCli(recArgs(t, ['--request-action', 'work']));
    assert.equal(res.status, 2);
    assert.equal(res.json.code, 'action_not_granted');
    assert.match(res.json.reason, /fixed at init/);
    rmSync(t.base, { recursive: true, force: true });
  });

  test('completion requires a recorded delivery receipt (a routing answer is not a completed effect)', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t, ['--task-id', 't-1']));
    const res = runCli(recArgs(t, ['--mark-complete']));
    assert.equal(res.status, 2);
    assert.equal(res.json.code, 'complete_requires_delivery_receipt');
    const ok = runCli(recArgs(t, ['--delivery-receipt', 'receipt-ok', '--mark-complete']));
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    assert.equal(ok.json.controlState, 'complete');
    const late = runCli(recArgs(t, ['--observation', obs('late-complete', 'done')]));
    assert.equal(late.json.observationDisposition, 'historical-after-complete');
    rmSync(t.base, { recursive: true, force: true });
  });

  test('state-machine lifecycle (library arms): ack-cessation and custody legality', async () => {
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
    const acked = await reconcile({ ...reconcileInput(t), control: { kind: 'ack-cessation', actor: 'worker:w-1', reason: 'worker confirms suspension' } });
    assert.ok(acked.ok, JSON.stringify(acked));
    assert.equal(acked.controlState, 'paused');
    const st = runCli(['status', '--record', t.recordPath]);
    assert.ok(st.json.record.worker.cessationAckedAt !== null, 'the ack is stamped on the worker identity');
    rmSync(t.base, { recursive: true, force: true });
  });
});

// ===========================================================================
// Row 11 — real SIGKILL lock release (abstract-socket lock).
// ===========================================================================
describe('row 11 — kernel-held lock: SIGKILL releases immediately, live holders contend', () => {
  test('live holder blocks a short-budget acquirer; SIGKILL frees the name for an immediate rebind', async () => {
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
  test('a full operational sequence runs with every outbound seam pointed at the recorder', async () => {
    const t = makeFixture(null);
    assert.equal(runCli(initArgs(t, ['--task-id', 't-1'])).status, 0);
    assert.equal(runCli(recArgs(t, ['--observation', obs('p-1', 'done')])).status, 0);
    const act = runCli(recArgs(t, ['--request-action', 'work']));
    assert.equal(act.status, 0, act.stdout);
    const resolved = runCli(recArgs(t, ['--resolve-intent', act.json.pendingIntent.actionId, '--resolution', 'not-applied', '--evidence', EVIDENCE]));
    assert.equal(resolved.status, 0);
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
  test('six parallel writers serialize; a concurrent reader never sees partial JSON; no tmp residue', async () => {
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
  test('monotonic revisions: control transitions bump record+control; holds bump record only', async () => {
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

  test('store arms: unreadable/invalid records fail closed; TOCTOU retarget and CAS mismatches reject', async () => {
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

    // CAS mismatch on the canonical path.
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
  test('SIGKILLed holder; A resumes first and wins; B paused-before-bind contends against a live A; no lost revision', async () => {
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

  test('lexical aliases contend on ONE lock: canonical resolution precedes lock-key derivation', async () => {
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

  test('symlink-alias residual (documented): a symlinked directory yields a distinct lock key; safety falls to the CAS net', async () => {
    const t = makeFixture(null);
    runCli(initArgs(t));
    symlinkSync(t.stageRoot, join(t.base, 'alias-root'));
    const alias = join(t.base, 'alias-root', 'binding.json');
    // Sequential use through both spellings is correct: monotonic revisions, no corruption.
    const first = runCli(['reconcile', '--record', alias, '--repo-root', t.repo, '--feature-home', t.home, '--now', iso(), '--observation', obs('sym-1', 'parked')]);
    assert.equal(first.status, 0, first.stdout + first.stderr);
    const second = runCli(recArgs(t, ['--observation', obs('sym-2', 'parked')]));
    assert.equal(second.status, 0, second.stdout + second.stderr);
    assert.equal(second.json.recordRevision, first.json.recordRevision + 1, 'revisions stay monotonic across spellings');
    // And if two spellings DO race, the CAS net — not a silent lost update — absorbs it
    // (proven at library level in the row-3 CAS arm). This test pins the documented
    // residual: lockNameForRecord canonicalizes lexically, not through directory symlinks.
    assert.notEqual(lockNameForRecord(alias), lockNameForRecord(t.recordPath));
    rmSync(t.base, { recursive: true, force: true });
  });
});

// ===========================================================================
// Row 17 — release/reacquire interleaving + SIGKILL mid-critical-section.
// ===========================================================================
describe('row 17 — release/reacquire interleaving', () => {
  test('three acquirers of one record serialize cleanly; revisions monotonic; record parses each time', async () => {
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

  test('SIGKILL mid-critical-section: the next acquirer binds immediately and the record is intact', async () => {
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

  test('injected non-EADDRINUSE bind failure surfaces verbatim, single attempt, fail-closed', async () => {
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

  test('injected contention exhausts the bounded budget and reports lock_contended (retry arithmetic)', async () => {
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
    runCli(initArgs(fx, ['--task-id', 't-1']));
    const pause = runCli(['pause', '--record', fx.recordPath, '--control-reason', 'operator pause for the resume battery', '--now', iso()]);
    assert.equal(pause.status, 0);
    const st = runCli(['status', '--record', fx.recordPath]);
    assert.equal(st.json.record.controlState, 'paused');
    return { fx, record: st.json.record };
  }

  test('production CLI negatives: every resume shape stays held with unchanged record bytes', async () => {
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

  test('observation/worker-supplied grant is DATA: stored verbatim-none, no resume, no admission', async () => {
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

  test('direct production engine invocation stays held — no CLI-only check to skip', async () => {
    const hold = productionResumeHold();
    assert.equal(hold.code, 'unsupported_pending_prerequisite');
    assert.match(hold.reason, /No CLI flag, grant document, observation payload, path or environment value clears this hold/);
    for (const verb of ['worker', 'review']) {
      const reserved = reservedVerbHold(verb);
      assert.equal(reserved.code, 'unsupported_pending_prerequisite');
      assert.match(reserved.reason, new RegExp(`^${verb} operations are a stage-B prerequisite`));
    }
    // And the engine's reconcile surface has no resume kind: a bound record given a
    // `resume` control kind rejects it at the transition table, not at the CLI.
    const t = makeFixture(null);
    runCli(initArgs(t));
    const bad = await reconcile({ ...reconcileInput(t), control: { kind: 'resume', actor: 'op' } });
    assert.equal(bad.ok, false);
    assert.equal(bad.code, 'invalid_transition_kind');
    rmSync(t.base, { recursive: true, force: true });
  });

  test('fixture-only pure transition: valid trusted input proposes consumption; negatives reject; nothing persists', async () => {
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
// Run aftermath — MUST stay the LAST top-level declaration in this file: root
// children execute in declaration order, so this runs after every row above.
// A top-level after() cannot carry this cleanup (see the note near the recorder:
// node --test silently skips it on this Node version) — a test always runs.
// ===========================================================================
test('aftermath — recorder closed, zero outbound connections across the whole run', async () => {
  recorder.close();
  await once(recorder, 'close');
  assert.equal(recorderHits, 0, `prohibited-effect violation: ${recorderHits} outbound connection(s) reached the recorder — A1 never calls model/PR/delivery endpoints`);
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
