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
//   gatectl recover --ledger L --coordination-dir D
//       Idempotent recovery: re-deliver pending coordination INTENTs, report
//       outbox/queue residue. No model launches, no network mutations.
//   gatectl start ...               REFUSES: E_VALIDATE_ONLY without --allow-live;
//       even with it, live start is an enrollment-time concern (E_LIVE_UNENROLLED) —
//       native transports against real GitHub are a live acceptance requirement.
//
// DOT_GATE_SPY_OUT=<file> makes the CLI append {transport_calls, model_calls} to
// that file — the test harness' proof that validation ran with zero side effects.

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadPolicy, policyDigest } from './load-policy.mjs';
import { openLedger } from './ledger.mjs';
import { buildQueue } from './queue.mjs';
import { createBudgets } from './budgets.mjs';
import { createCcAdapter } from './cc-adapter.mjs';

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

export async function runRecover({ ledgerPath, coordinationDir, spy }) {
  if (!coordinationDir) throw fail('E_CONFIG', 'recover requires --coordination-dir');
  const ledger = openLedger(ledgerPath);
  try {
    const adapter = createCcAdapter({ ledger, coordinationDir });
    const recovered = adapter.recoverPending();
    return {
      ok: true,
      command: 'recover',
      recovered_deliveries: recovered.length,
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
      const { readFileSync } = await import('node:fs');
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
      emit(await runRecover({ ledgerPath: need('ledger'), coordinationDir: need('coordination-dir'), spy }));
    } else if (command === 'start') {
      if (args['allow-live'] !== true) {
        throw fail('E_VALIDATE_ONLY', 'this build is validate-only — live start requires explicit --allow-live and completed enrollment');
      }
      throw fail('E_LIVE_UNENROLLED', 'live start is a live acceptance step: destination enrollment (monitor registration, native merge enforcement) is not part of the offline build');
    } else {
      throw fail('E_USAGE', 'usage: gatectl <validate|pause|read|recover|start> [options]');
    }
  } catch (e) {
    die(e);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
