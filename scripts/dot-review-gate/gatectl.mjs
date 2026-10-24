#!/usr/bin/env node
// gatectl — validate-only control surface for the Dot staging review gate (round-2
// packet: "validate-only startup plus exact start/pause/read/recovery commands,
// without model launches or GitHub mutations during validation").
//
// Commands:
//   gatectl validate --policy P --schema S [--schema-v2 V] --ledger L
//       Loads the trusted policy fail-closed, parses the schema bytes and verifies
//       the policy's schema_sha256 pin against the ACTUAL bytes (E_SCHEMA_PIN on
//       mismatch), opens and migrates the ledger, builds the work queue, and prints
//       one JSON summary — digests, counts, pauses, dispatch-budget status. ZERO
//       GitHub transport calls, ZERO model launches (counters in the summary).
//   gatectl pause --ledger L        durable operator pause (offline)
//   gatectl read --ledger L         read-only state dump (offline)
//   gatectl recover --ledger L --coordination-dir D [--policy P]
//       Idempotent recovery of pending coordination INTENTs — HONORING CURRENT
//       operational authority (D2065-S07): without --policy there is no trusted
//       authority to check against, so recovery is INSPECT-ONLY (mode:"inspect",
//       pending list with digest status, recoveryHeld E_NO_TRUSTED_CONFIG, ZERO
//       writes, nothing marked DELIVERED). With --policy the runner's own gate
//       runs: pause/authorization-expiry/quota up front, then PER-ACTION current
//       ACTIVE registration + repository scope before any re-delivery — a
//       persisted pending action grants no permanent permission. Output reports
//       the real LOCAL delivery effects (mode, recovered_deliveries, per-action
//       held codes, local_message_writes), never inferred from network/model
//       spies. No model launches, no network mutations.
//   gatectl start ...               REFUSES: E_VALIDATE_ONLY without --allow-live;
//       even with it, live start is an enrollment-time concern (E_LIVE_UNENROLLED) —
//       native transports against real GitHub are a live acceptance requirement.
//
// DOT_GATE_SPY_OUT=<file> makes the CLI append {transport_calls, model_calls} to
// that file — the test harness' proof that validation ran with zero side effects.

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { loadPolicy, policyDigest } from './load-policy.mjs';
import { openLedger } from './ledger.mjs';
import { buildQueue } from './queue.mjs';
import { createBudgets } from './budgets.mjs';
import { createCcAdapter } from './cc-adapter.mjs';
import { operationalHold } from './runner.mjs';
import { isMainEntry } from '../lib/is-main-entry.mjs';

function fail(codeName, message) {
  const e = new Error(message);
  e.code = codeName;
  return e;
}

export async function runValidate({ policyText, schemaBytes, schemaV2Bytes, ledgerPath, spy }) {
  let policy;
  try {
    policy = loadPolicy(policyText ?? '');
  } catch (e) {
    throw fail('E_POLICY_PARSE', `trusted policy is not strict JSON: ${e.message}`);
  }
  if (policy.fails?.length > 0 || (Array.isArray(policy) && policy.length > 0)) {
    const first = (policy.fails ?? policy)[0];
    throw fail(first.code ?? 'E_POLICY', `trusted policy invalid: ${first.message ?? JSON.stringify(first)}`);
  }
  if (policy.__invalid) throw fail('E_POLICY', `trusted policy invalid: ${policy.__invalid}`);

  let schemaDoc;
  try {
    schemaDoc = JSON.parse(schemaBytes.toString('utf8'));
  } catch (e) {
    throw fail('E_SCHEMA_PARSE', `schema file is not JSON: ${e.message}`);
  }
  if (!schemaDoc || typeof schemaDoc !== 'object') throw fail('E_SCHEMA_PARSE', 'schema file is not a JSON object');
  const schemaSha = createHash('sha256').update(schemaBytes).digest('hex');
  if (policy.schema_sha256 !== schemaSha) {
    throw fail('E_SCHEMA_PIN', `policy pins schema_sha256 ${policy.schema_sha256} but the provided schema bytes digest to ${schemaSha}`);
  }
  let schemaV2Sha = null;
  if (schemaV2Bytes != null) {
    try {
      JSON.parse(schemaV2Bytes.toString('utf8'));
    } catch (e) {
      throw fail('E_SCHEMA_PARSE', `V2 schema file is not JSON: ${e.message}`);
    }
    schemaV2Sha = createHash('sha256').update(schemaV2Bytes).digest('hex');
  }
  // SP-3: --schema-v2 is PINNED, not just parsed. Wiring V2 bytes without a policy
  // pin — or a V2-era policy without the bytes — lets a permissive schema carry the
  // whole V2 admission path.
  if (schemaV2Sha != null && policy.schema_v2_sha256 !== schemaV2Sha) {
    throw fail('E_SCHEMA_PIN', policy.schema_v2_sha256 === undefined
      ? `V2 schema bytes were provided but the policy does not pin schema_v2_sha256 (provided bytes digest to ${schemaV2Sha})`
      : `policy pins schema_v2_sha256 ${policy.schema_v2_sha256} but the provided V2 schema bytes digest to ${schemaV2Sha}`);
  }
  if (policy.protocol_version === 'dot-pr-review/2.0.0' && schemaV2Sha == null) {
    throw fail('E_SCHEMA_PIN', 'the policy is in the dot-pr-review/2.0.0 era — the pinned V2 schema bytes (--schema-v2) are required');
  }

  const ledger = openLedger(ledgerPath);
  try {
    const counts = ledger.counts();
    const queue = buildQueue({ ledger });
    const budgets = createBudgets({ ledger, limits: policy.limits ?? {} });
    const allowed = budgets.unattendedAllowed();
    const missing = allowed ? [] : ['max_launches_per_window', 'window_minutes', 'max_fix_rounds_per_occurrence', 'max_work_per_pr', 'coalesce_minutes']
      .filter((k) => !Number.isInteger(policy.limits?.[k]) || policy.limits[k] <= 0);
    return {
      ok: true,
      command: 'validate',
      policy_sha256: policyDigest(policy),
      schema_sha256: schemaSha,
      schema_v2_sha256: schemaV2Sha,
      counts,
      queue_size: queue.length,
      paused: ledger.isPaused(),
      quota_paused: ledger.isQuotaPaused(),
      unattended_dispatch: { allowed, missing_limits: missing },
      transport_calls: spy.transportCalls,
      model_calls: spy.modelCalls,
    };
  } finally {
    ledger.close();
  }
}

export async function runRecover({ ledgerPath, coordinationDir, policyText, spy }) {
  if (!coordinationDir) throw fail('E_CONFIG', 'recover requires --coordination-dir');
  const ledger = openLedger(ledgerPath);
  try {
    const adapter = createCcAdapter({ ledger, coordinationDir });
    // the REAL local delivery effects of THIS invocation, counted directly — never
    // inferred from transport/model spies (D2065-S07: the reproduction gap)
    const msgFiles = () => {
      try { return readdirSync(coordinationDir).filter((f) => f.startsWith('_dot-gate-msg-')).length; } catch { return 0; }
    };
    // inspect-only view of pending INTENTs: id/kind/target + whether the durable
    // payload still passes its digest — read-only, no state transition
    const inspectPending = () => ledger.coordList('INTENT').map((a) => ({
      id: a.id,
      kind: a.kind,
      target: a.target,
      payload_digest_ok: typeof a.payload_text === 'string'
        && createHash('sha256').update(a.payload_text).digest('hex') === a.payload_digest,
    }));

    // No trusted policy ⇒ no authority to check against ⇒ INSPECT-ONLY: zero
    // writes, zero DELIVERED, pending visible. (D2065-S07: the pre-fix CLI
    // delivered unconditionally here.)
    if (policyText == null) {
      return {
        ok: true,
        command: 'recover',
        mode: 'inspect',
        recoveryHeld: {
          code: 'E_NO_TRUSTED_CONFIG',
          reason: 'no trusted policy — recovery is inspect-only; no message is written, nothing is marked DELIVERED',
        },
        pending: inspectPending(),
        recovered_deliveries: 0,
        held: [],
        local_message_writes: 0,
        counts: ledger.counts(),
        transport_calls: spy.transportCalls,
        model_calls: spy.modelCalls,
      };
    }

    // Gated recovery: the SAME loader, budgets and operationalHold the runner
    // composes — load failure (including expired authorization) refuses here
    let policy;
    try {
      policy = loadPolicy(policyText);
    } catch (e) {
      throw fail(e.code ?? 'E_POLICY_PARSE', `trusted policy is not loadable: ${e.message}`);
    }
    if (policy.fails?.length > 0 || (Array.isArray(policy) && policy.length > 0)) {
      const first = (policy.fails ?? policy)[0];
      throw fail(first.code ?? 'E_POLICY', `trusted policy invalid: ${first.message ?? JSON.stringify(first)}`);
    }
    if (policy.__invalid) throw fail('E_POLICY', `trusted policy invalid: ${policy.__invalid}`);
    const budgets = createBudgets({ ledger, limits: policy.limits ?? {} });
    const preHold = operationalHold({ ledger, policy, budgets, registration: undefined, nowMs: Date.now() });
    if (preHold) {
      return {
        ok: true,
        command: 'recover',
        mode: 'gated',
        recoveryHeld: preHold,
        pending: inspectPending(),
        recovered_deliveries: 0,
        held: [],
        local_message_writes: 0,
        counts: ledger.counts(),
        transport_calls: spy.transportCalls,
        model_calls: spy.modelCalls,
      };
    }
    // PER-ACTION gate, mirroring the runner's authorizeAction: CURRENT pause/
    // expiry/quota + CURRENT ACTIVE registration for the action's PR node +
    // repository scope — a mid-recovery state change structurally holds the NEXT
    // action (the adapter's per-action try/catch lands it in held)
    const authorize = (action, payload) => {
      const node = payload?.pr?.node_id ?? payload?.pr_node_id;
      const repository = payload?.repository_id;
      const actionHold = operationalHold({
        ledger, policy, budgets,
        registration: node ? ledger.getRegistration(node) : undefined,
        requireRegistration: true,
        nowMs: Date.now(),
      });
      if (actionHold) throw fail(actionHold.code, actionHold.reason);
      if (!node || repository !== policy.repository_id) throw fail('E_UNREGISTERED', 'unknown or foreign action scope holds delivery');
      void action;
    };
    const before = msgFiles();
    const recovered = adapter.recoverPending({ authorize });
    const held = recovered.held ?? [];
    return {
      ok: true,
      command: 'recover',
      mode: 'gated',
      // SP-5: recoverPending returns the {recovered:[ids]} wrapper — reading .length
      // on the wrapper reported undefined, not the true count
      recovered_deliveries: recovered.recovered.length,
      held,
      local_message_writes: msgFiles() - before,
      recoveryHeld: held.length ? { code: held[0].code, reason: `${held.length} action(s) held (per-action codes in held)`, actions: held } : null,
      pending: [],
      counts: ledger.counts(),
      transport_calls: spy.transportCalls,
      model_calls: spy.modelCalls,
    };
  } finally {
    ledger.close();
  }
}

function readState({ ledgerPath }) {
  const ledger = openLedger(ledgerPath);
  try {
    const queue = buildQueue({ ledger });
    return {
      ok: true,
      command: 'read',
      counts: ledger.counts(),
      queue: queue.map((q) => ({ key: q.key, kind: q.kind, reason: q.reason ?? null })),
      paused: ledger.isPaused(),
      quota_paused: ledger.isQuotaPaused(),
    };
  } finally {
    ledger.close();
  }
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) args[a.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    else args._.push(a);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];
  const spy = { transportCalls: 0, modelCalls: 0 };
  const spyOut = () => {
    if (typeof process.env.DOT_GATE_SPY_OUT === 'string' && process.env.DOT_GATE_SPY_OUT.length > 0) {
      mkdirSync(isAbsolute(process.env.DOT_GATE_SPY_OUT) ? join(process.env.DOT_GATE_SPY_OUT, '..') : '.', { recursive: true });
      writeFileSync(process.env.DOT_GATE_SPY_OUT, JSON.stringify({ transport_calls: spy.transportCalls, model_calls: spy.modelCalls }));
    }
  };
  const emit = (payload) => {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    spyOut();
  };
  const die = (e) => {
    process.stdout.write(`${JSON.stringify({ ok: false, error: { code: e.code ?? 'E_UNEXPECTED', message: e.message } }, null, 2)}\n`);
    process.exitCode = 1;
    spyOut();
  };
  const need = (name) => {
    if (typeof args[name] !== 'string' || args[name].length === 0) throw fail('E_USAGE', `missing --${name}`);
    return args[name];
  };

  try {
    if (command === 'validate') {
      emit(await runValidate({
        policyText: readFileSync(need('policy'), 'utf8'),
        schemaBytes: readFileSync(need('schema')),
        schemaV2Bytes: args['schema-v2'] ? readFileSync(args['schema-v2']) : null,
        ledgerPath: need('ledger'),
        spy,
      }));
    } else if (command === 'pause') {
      const ledger = openLedger(need('ledger'));
      try {
        ledger.setPaused(true);
        emit({ ok: true, command: 'pause', paused: ledger.isPaused() });
      } finally {
        ledger.close();
      }
    } else if (command === 'read') {
      emit(readState({ ledgerPath: need('ledger') }));
    } else if (command === 'recover') {
      emit(await runRecover({
        ledgerPath: need('ledger'),
        coordinationDir: need('coordination-dir'),
        // --policy opts into GATED recovery; without it recovery stays inspect-only
        policyText: typeof args.policy === 'string' && args.policy.length > 0 ? readFileSync(args.policy, 'utf8') : null,
        spy,
      }));
    } else if (command === 'start') {
      if (args['allow-live'] !== true) {
        throw fail('E_VALIDATE_ONLY', 'this build is validate-only — live start requires explicit --allow-live and completed enrollment');
      }
      // the packet: distinguish MISSING ENROLLMENT from a RUNNER THAT DOES NOT
      // EXIST — a named runner path absent on disk is a different refusal than an
      // unenrolled destination
      if (typeof args.runner === 'string' && args.runner.length > 0) {
        const { existsSync } = await import('node:fs');
        if (!existsSync(args.runner)) {
          throw fail('E_NO_RUNNER', `the named runner does not exist on disk: ${args.runner}`);
        }
      }
      throw fail('E_LIVE_UNENROLLED', 'live start is a live acceptance step: destination enrollment (monitor registration, native merge enforcement) is not part of the offline build');
    } else {
      throw fail('E_USAGE', 'usage: gatectl <validate|pause|read|recover|start> [options]');
    }
  } catch (e) {
    die(e);
  }
}

if (isMainEntry(import.meta.url)) {
  await main();
}
