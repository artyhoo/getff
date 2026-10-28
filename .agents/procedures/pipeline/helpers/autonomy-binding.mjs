/**
 * autonomy-binding.mjs — one-shot CLI over the stage-A autonomy binding engine.
 *
 * Verbs: init | reconcile | status | pause | cancel | resume, plus the RESERVED
 * worker | review verbs that stage B owns. `resume` is unconditionally held in A1
 * (productionResumeHold, engine.mjs:104) — no CLI argument, grant file or record
 * state can clear that hold; the scoped/revision/replay grant logic lives in record.mjs
 * as fixture-tested pure logic and is deliberately unreferenced from this file. worker|review are
 * stage-B live operations and always return unsupported_pending_prerequisite
 * (reservedVerbHold, engine.mjs:114) — never a simulated live success.
 *
 * Output contract: one JSON envelope on stdout, exit code 0 (ok) / 2 (structured
 * hold, reject or unsupported) / 1 (internal error) — the helper-CLI convention of
 * current-decisions.mjs:883-885 (`emit(result, code)` → stdout write + process.exit).
 * Deviation from the sibling entry-guard convention (overview.mjs:1023): usage and
 * internal errors ALSO go through the JSON envelope (exit 1/2 + structured code/reason),
 * never plain-text stderr — a machine-consumed helper keeps one output channel.
 *
 * Engine entry points: initBinding engine.mjs:148, reconcile engine.mjs:385,
 * status engine.mjs:995 (lock-free durable-state read).
 *
 * Test seams (test-only; never exercised by production callers):
 *   --test-crash-after prewrite|intent|commit  — real self-SIGKILL at the named
 *       durable-write window (the killSelf sites: engine.mjs:613, 616 in
 *       rejectAfterPersist and engine.mjs:974, 977 in the main persist; the seam
 *       itself engine.mjs:138).
 *   --test-hold-before-bind <waitfile>         — poll until <waitfile> exists BEFORE
 *       acquiring the bind lock, so a test can stage a competing acquirer inside the
 *       contention window.
 *   --test-hold-lock-ms <n>                    — hold the acquired lock for n ms
 *       before releasing (engine.mjs:410).
 */
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { isMainEntry } from './lib/is-main-entry.mjs';
import {
  initBinding,
  reconcile,
  status,
  productionResumeHold,
  reservedVerbHold,
} from './autonomy-binding/engine.mjs';
import { LOCK_RETRY_MAX_MS } from './autonomy-binding/lock.mjs';

const VERBS = new Set(['init', 'reconcile', 'status', 'pause', 'cancel', 'resume', 'worker', 'review']);

const VALUE_FLAGS = new Set([
  'record', 'repo-root', 'feature', 'stage', 'stage-artifact-root', 'feature-home', 'owner-root',
  'actions', 'destination', 'destination-ref', 'task-id', 'claim-ref', 'actor', 'now', 'roots',
  'routine-host', 'routine-id', 'candidate-revision', 'candidate-sha256', 'candidate-ref',
  'worker-session', 'worker-pid', 'worker-host', 'observation', 'request-action',
  'resolve-intent', 'resolution', 'evidence', 'transfer-custody', 'control-reason',
  'delivery-receipt', 'grant', 'test-crash-after', 'test-hold-before-bind', 'test-hold-lock-ms',
  'lock-retry-budget-ms', 'lock-retry-delay-ms',
  // Fidelity-r1 F-1 evidence flags: content references (path + sha256) that the engine
  // verifies with the intent helper's resolveContentRef. Paths resolve against the
  // stage artifact root / repository root, so they are forwarded VERBATIM (never
  // resolve()d against this process' CWD).
  'evidence-ref', 'evidence-sha256', 'delivery-evidence-ref', 'delivery-evidence-sha256',
  // Fidelity-r1 F-2 (ack door): the verified cessation-evidence reference that
  // establishes a referenced external work's stop (a bare acknowledgement is a caller
  // assertion; the hold recovery names these flags). The --ack-cessation control kind
  // itself is a boolean flag (handled beside --mark-complete), not a value flag.
  'cessation-evidence-ref', 'cessation-evidence-sha256',
]);

const USAGE = `usage: autonomy-binding.mjs <verb> [flags]
verbs: init | reconcile | status | pause | cancel | resume | worker (reserved) | review (reserved)
common: --record <path> --repo-root <dir> --feature <id> --stage <id> --stage-artifact-root <dir>
init:   --feature-home <dir> --actions observe,work,review,hold,complete --destination pr:staging
        [--task-id] [--worker-session/--worker-pid/--worker-host] [--candidate-revision/--candidate-sha256]
reconcile: [--observation <json>] [--request-action <action>] [--resolve-intent <id> --resolution applied|not-applied|abandoned --evidence <text>]
        [--evidence-ref <path> --evidence-sha256 <hex>]
        [--transfer-custody <session>] [--candidate-revision <n>] [--candidate-sha256 <hex>]
        [--delivery-receipt <ref> [--delivery-evidence-ref <path> --delivery-evidence-sha256 <hex>]] [--mark-complete] [--control-reason <text>] [--actor <id>]
evidence: --evidence-ref/--delivery-evidence-ref take a path relative to the stage artifact root or the repository root plus the
        sha256 of the artifact's bytes; the engine verifies them with the intent helper's resolveContentRef. Prose (--evidence) and
        bare receipts are recorded as caller claims only — uncertainty release and both completion doors require verified evidence.
        (fidelity-r1 F-2) reconcile --ack-cessation [--control-reason <text>] [--cessation-evidence-ref <path> --cessation-evidence-sha256 <hex>]:
        a bare ack settles only the local worker's cessation; a bound AIF task / native attempts / an unresolved effect need verified
        evidence (--cessation-evidence-ref, same root rules), else the pending state is retained with a cessation_unconfirmed hold.
pause|cancel: [--control-reason <text>]
resume: always unsupported_pending_prerequisite in stage A (a --grant path does not clear it)
test seams: --test-crash-after prewrite|intent|commit | --test-hold-before-bind <waitfile> | --test-hold-lock-ms <ms>`;

/**
 * Parse one observation JSON document (await.ts ActionableResult-shaped DATA —
 * packages/runtime-bridge/src/cli/await.ts:77). Kept in the CLI (not the engine) so the
 * engine's input surface stays plain objects a library caller composes directly.
 */
function parseObservation(raw, featureId, taskId) {
  let doc;
  try {
    doc = JSON.parse(raw);
  } catch (err) {
    return { ok: false, code: 'invalid_request', reason: `--observation must be JSON: ${err && err.message ? err.message : err}` };
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    return { ok: false, code: 'invalid_request', reason: '--observation must be a JSON object' };
  }
  return {
    ok: true,
    observation: {
      taskId: doc.taskId ?? taskId,
      observationId: doc.observationId ?? doc.attemptId ?? null,
      kind: doc.kind,
      status: doc.status ?? null,
      reason: doc.reason ?? null,
      resultRef: doc.resultRef ?? null,
      candidateRevision: doc.candidateRevision ?? null,
      custodyGeneration: doc.custodyGeneration ?? null,
    },
  };
}

/**
 * Bounded non-negative integer parse for the timing flags (A1-CODE-06): a malformed
 * budget (`nope`, `Infinity`, negative, oversized) must reject as structured
 * invalid_request at the CLI boundary — BEFORE any record interaction — because a
 * NaN/Infinity deadline would make lock contention wait forever. The bound is the
 * library's own LOCK_RETRY_MAX_MS, so the CLI and the engine cannot drift apart.
 */
function parseTimingMs(raw, flag) {
  if (!/^\d{1,9}$/.test(raw)) {
    return { ok: false, code: 'invalid_request', reason: `${flag} must be a finite non-negative integer of at most ${LOCK_RETRY_MAX_MS}ms (got ${JSON.stringify(raw)})` };
  }
  const value = Number(raw);
  if (value > LOCK_RETRY_MAX_MS) {
    return { ok: false, code: 'invalid_request', reason: `${flag} must be a finite non-negative integer of at most ${LOCK_RETRY_MAX_MS}ms (got ${value})` };
  }
  return { ok: true, value };
}

/** Parse one of the timing flags when present; returns {ok, input} mutated or a failure. */
function applyTimingFlag(input, opts, key, field) {
  if (opts[key] === undefined) return { ok: true };
  const parsed = parseTimingMs(opts[key], `--${key}`);
  if (!parsed.ok) return parsed;
  input[field] = parsed.value;
  return { ok: true };
}

/**
 * Reconcile-input assembly shared by the reconcile/pause/cancel verbs. Returns
 * {ok, input} or a structured invalid_request — the CLI validates ONLY arg syntax and
 * JSON shapes; every semantic gate lives in the engine.
 */
function buildReconcileInput(opts, verb) {
  const input = {
    recordPath: resolve(opts.record),
    repoRoot: opts['repo-root'] !== undefined ? resolve(opts['repo-root']) : undefined,
    now: opts.now ?? new Date().toISOString(),
    actor: opts.actor ?? `cli:${process.ppid}`,
  };
  if (opts.observation !== undefined) {
    const obs = parseObservation(opts.observation, opts.feature, opts['task-id']);
    if (!obs.ok) return obs;
    input.observation = obs.observation;
  }
  if (opts['request-action'] !== undefined) input.requestAction = opts['request-action'];
  // Documented override/recovery input, forwarded like the library callers' `featureHome`
  // (A1 review, CLI boundary): accepted-but-ignored silently diverged the CLI surface from
  // the engine contract. The engine's identity gate (A1-CODE-05) is what keeps an override
  // home from authorizing transitions for a foreign repository.
  if (opts['feature-home'] !== undefined) input.featureHome = resolve(opts['feature-home']);
  if (opts['resolve-intent'] !== undefined) {
    if (opts.resolution === undefined || opts.evidence === undefined) {
      return { ok: false, code: 'invalid_request', reason: '--resolve-intent requires --resolution applied|not-applied|abandoned and --evidence <text>' };
    }
    // Fidelity-r1 F-1: the narrative (--evidence) is a caller claim; the engine releases
    // the uncertainty only on a verified content reference. One half of the ref pair is
    // a typo-shaped invocation — reject it here rather than let the engine guess.
    if ((opts['evidence-ref'] === undefined) !== (opts['evidence-sha256'] === undefined)) {
      return { ok: false, code: 'invalid_request', reason: '--evidence-ref and --evidence-sha256 must be given together (a content reference is path + digest)' };
    }
    input.resolveIntent = {
      actionId: opts['resolve-intent'],
      resolution: opts.resolution,
      evidence: opts.evidence,
      evidenceRef: opts['evidence-ref'] !== undefined ? { path: opts['evidence-ref'], sha256: opts['evidence-sha256'] } : undefined,
    };
  }
  if (opts['transfer-custody'] !== undefined) input.transferCustody = { toSession: opts['transfer-custody'], reason: opts['control-reason'] ?? null };
  if (opts['candidate-revision'] !== undefined || opts['candidate-sha256'] !== undefined) {
    input.candidate = {
      revision: opts['candidate-revision'] !== undefined ? Number(opts['candidate-revision']) : undefined,
      sha256: opts['candidate-sha256'] ?? undefined,
    };
  }
  if (opts['delivery-receipt'] !== undefined) input.deliveryReceipt = opts['delivery-receipt'];
  // Fidelity-r1 F-1: the delivery's evidence reference rides WITH the receipt; the engine
  // records the receipt verified when the reference verifies, unverified (doors closed)
  // otherwise. One half of the pair is a typo-shaped invocation — reject it here.
  if ((opts['delivery-evidence-ref'] === undefined) !== (opts['delivery-evidence-sha256'] === undefined)) {
    return { ok: false, code: 'invalid_request', reason: '--delivery-evidence-ref and --delivery-evidence-sha256 must be given together (a content reference is path + digest)' };
  }
  if (opts['delivery-evidence-ref'] !== undefined) input.deliveryEvidence = { path: opts['delivery-evidence-ref'], sha256: opts['delivery-evidence-sha256'] };
  // Fidelity-r1 F-2 (ack door): `reconcile --ack-cessation` reaches the establishment
  // boundary — a bare ack settles the worker arm only; referenced external work needs
  // the evidence pair. A half-pair is a typo-shaped invocation, rejected here; evidence
  // on a non-ack control kind is rejected so it can never be silently ignored.
  if ((opts['cessation-evidence-ref'] === undefined) !== (opts['cessation-evidence-sha256'] === undefined)) {
    return { ok: false, code: 'invalid_request', reason: '--cessation-evidence-ref and --cessation-evidence-sha256 must be given together (a content reference is path + digest)' };
  }
  if (opts['mark-complete'] !== undefined) input.markComplete = true;
  if (verb === 'pause') input.control = { kind: 'pause', reason: opts['control-reason'] ?? 'pause requested via CLI' };
  if (verb === 'cancel') input.control = { kind: 'cancel', reason: opts['control-reason'] ?? 'cancel requested via CLI' };
  if (opts['ack-cessation'] !== undefined) {
    if (input.control !== undefined) {
      return { ok: false, code: 'invalid_request', reason: '--ack-cessation cannot combine with the pause/cancel verbs — it is its own control kind (reconcile --ack-cessation)' };
    }
    input.control = { kind: 'ack-cessation', reason: opts['control-reason'] ?? 'cessation acknowledged via CLI' };
  }
  if (opts['cessation-evidence-ref'] !== undefined) {
    if (input.control === undefined || input.control.kind !== 'ack-cessation') {
      return { ok: false, code: 'invalid_request', reason: '--cessation-evidence-ref/--cessation-evidence-sha256 are only consumed by the ack-cessation control (reconcile --ack-cessation) — on any other control they would be silently ignored' };
    }
    input.control.cessationEvidence = { path: opts['cessation-evidence-ref'], sha256: opts['cessation-evidence-sha256'] };
  }
  if (opts['test-crash-after'] !== undefined) input.testCrashAfter = opts['test-crash-after'];
  for (const [key, field] of [['test-hold-lock-ms', 'testHoldLockMs'], ['lock-retry-budget-ms', 'retryBudgetMs'], ['lock-retry-delay-ms', 'retryDelayMs']]) {
    const timed = applyTimingFlag(input, opts, key, field);
    if (!timed.ok) return timed;
  }
  return { ok: true, input };
}

/**
 * The poll-before-bind test seam: block until <waitfile> appears, so the test controls
 * exactly when this process reaches the bind-lock acquisition. No timeout here ON
 * PURPOSE — a hung waiter is a hung test, which node --test reports; a silent timeout
 * would turn a staging bug into a flaky pass.
 */
function waitForFile(path) {
  while (!existsSync(path)) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
  }
}

async function main() {
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
      if (verb !== undefined) emit({ ok: false, code: 'invalid_request', reason: `two verbs given: ${verb} and ${arg}` }, 2);
      verb = arg;
    } else if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (key === 'mark-complete') {
        opts[key] = true;
        continue;
      }
      // Boolean flag like --mark-complete: the ack kind itself carries no value (its
      // reason rides --control-reason, its proof rides --cessation-evidence-*).
      if (key === 'ack-cessation') {
        opts[key] = true;
        continue;
      }
      // Unknown flags are rejected structurally, never silently stored: a typo'd flag
      // (`--recod`) that fell through would change nothing and report success.
      if (!VALUE_FLAGS.has(key)) emit({ ok: false, code: 'invalid_request', reason: `unknown flag ${arg}\n${USAGE}` }, 2);
      const value = args[i + 1];
      // A value is missing when it is absent, empty, or itself another flag — the old
      // `VALUE_FLAGS.has(value)` check only caught unprefixed verb/flag names, so
      // `--record --now` silently bound `--now` as the record path.
      if (value === undefined || value === '' || value.startsWith('--')) {
        emit({ ok: false, code: 'invalid_request', reason: `flag ${arg} needs a value\n${USAGE}` }, 2);
      }
      opts[key] = value;
      i += 1;
    } else {
      emit({ ok: false, code: 'invalid_request', reason: `unexpected argument ${arg}\n${USAGE}` }, 2);
    }
  }
  if (verb === undefined) emit({ ok: false, code: 'invalid_request', reason: USAGE }, 2);

  // Stage-B live operations are reserved BEFORE any record interaction: they never read,
  // create or mutate a binding record (the hold names the owning stage instead).
  if (verb === 'worker' || verb === 'review') emit(reservedVerbHold(verb), 2);
  // Production resume is unconditionally held in stage A — before any record interaction,
  // and regardless of --grant (the flag is accepted syntactically and named in the hold
  // reason; it can never clear the hold).
  if (verb === 'resume') {
    const hold = productionResumeHold();
    if (opts.grant !== undefined) {
      hold.reason = `${hold.reason} A --grant document was supplied (${opts.grant}) and does not clear this hold.`;
    }
    emit(hold, 2);
  }

  if (opts.record === undefined) emit({ ok: false, code: 'invalid_request', reason: `--record <path> is required for ${verb}\n${USAGE}` }, 2);
  if (opts['test-hold-before-bind'] !== undefined) waitForFile(opts['test-hold-before-bind']);

  try {
    if (verb === 'init') {
      // R3 advisory: --feature-home is required by the engine (initBinding's field loop)
      // and by the usage text — name it here too, so the CLI boundary rejects with the
      // complete flag list instead of deferring to the engine's per-field message.
      if (opts['repo-root'] === undefined || opts.feature === undefined || opts.stage === undefined || opts['stage-artifact-root'] === undefined || opts['feature-home'] === undefined) {
        emit({ ok: false, code: 'invalid_request', reason: `init requires --repo-root, --feature, --stage, --stage-artifact-root, --feature-home\n${USAGE}` }, 2);
      }
      const initInput = {
        repoRoot: resolve(opts['repo-root']),
        featureId: opts.feature,
        stage: opts.stage,
        stageArtifactRoot: resolve(opts['stage-artifact-root']),
        recordPath: resolve(opts.record),
        featureHome: opts['feature-home'] !== undefined ? resolve(opts['feature-home']) : undefined,
        ownerRoot: opts['owner-root'] !== undefined ? resolve(opts['owner-root']) : undefined,
        actions: opts.actions !== undefined ? opts.actions.split(',') : undefined,
        destination: opts.destination,
        destinationRef: opts['destination-ref'] ?? null,
        taskId: opts['task-id'] ?? null,
        claimRef: opts['claim-ref'] ?? null,
        routineHost: opts['routine-host'] ?? null,
        routineId: opts['routine-id'] ?? null,
        candidateRevision: opts['candidate-revision'] !== undefined ? Number(opts['candidate-revision']) : undefined,
        candidateSha256: opts['candidate-sha256'] ?? null,
        candidateRef: opts['candidate-ref'] ?? null,
        worker:
          opts['worker-session'] !== undefined
            ? {
                sessionId: opts['worker-session'],
                pid: opts['worker-pid'] !== undefined ? Number(opts['worker-pid']) : null,
                startedAt: opts.now ?? new Date().toISOString(),
                host: opts['worker-host'] ?? null,
                cessationAckedAt: null,
              }
            : null,
        now: opts.now ?? new Date().toISOString(),
        actor: opts.actor ?? 'operator:cli',
      };
      // Same bounded-timing gate as reconcile (A1-CODE-06) — malformed budgets reject at
      // the CLI boundary, before any record interaction.
      for (const [key, field] of [['lock-retry-budget-ms', 'retryBudgetMs'], ['lock-retry-delay-ms', 'retryDelayMs']]) {
        const timed = applyTimingFlag(initInput, opts, key, field);
        if (!timed.ok) emit(timed, 2);
      }
      const result = await initBinding(initInput);
      emit(result, result.ok ? 0 : 2);
      return;
    }

    if (verb === 'status') {
      const result = status(resolve(opts.record));
      emit(result, result.ok ? 0 : 2);
      return;
    }

    // reconcile | pause | cancel share one in-lock engine path (pause/cancel are control
    // kinds on the same reconcile input, so a pause arriving with an observation in the
    // same invocation is serialized as ONE composed transition).
    const built = buildReconcileInput(opts, verb);
    if (!built.ok) emit(built, 2);
    const result = await reconcile(built.input);
    emit(result, result.ok ? 0 : 2);
  } catch (err) {
    // Internal error: never a fabricated envelope — print the failure verbatim and exit 1.
    emit({ ok: false, code: 'internal_error', reason: err && err.message ? err.message : String(err) }, 1);
  }
}

// Principle 47: the symlink-safe entry check — never a bare import.meta.url/argv compare.
if (isMainEntry(import.meta.url)) {
  await main();
}
