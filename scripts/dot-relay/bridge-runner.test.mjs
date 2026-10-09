// Bridge runner acceptance tests — REPAIR-KICKOFF R01/R02/R03 wiring + §8
// bounded Page fallback.
//
// The deployed body is compiled from the EXACT bytes of
// bridge-runner.body.js inside a BARE vm context (R01: the runtime executes
// bodies with only injected tools/config — TextEncoder, crypto, Buffer and
// process are genuinely absent there, so the old byte-length/SHA code that
// leaned on host globals must fail this suite). Every durable effect goes
// through fake public tools whose SHAPES follow PUBLIC-TOOL-SHAPES.json:
// wait/send return {content:[{type:'text',text:JSON}],isError:false} with no
// structuredContent; page reads return structuredContent source objects.
// exec_command runs the REAL cli.mjs over temp roots (integration harness).
// No network, no model, no live cloud.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import {
  mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync,
  existsSync, symlinkSync, lstatSync, renameSync, statSync, readdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { digest, CHAT_IDS, splitCodepointParts } from './contract.mjs';

const CLI = fileURLToPath(new URL('./cli.mjs', import.meta.url));
const BODY_PATH = fileURLToPath(new URL('./bridge-runner.body.js', import.meta.url));
const sha256Of = (s) => createHash('sha256').update(s).digest('hex');
const sha40 = (s) => sha256Of(s).slice(0, 40);
const MARKER = 'BRIDGE-BODY-MARKER-7c31';

// PAGE-LOCATOR-RECOVERY-ADDENDUM §registry — solver stays disabled (absent).
// F04 item 3: the analyst registry ID is the exact 32-hex authorized Page.
const PAGE_REG = {
  collector: 'page_070fdd367758819192e503c9cee51251',
  analyst: 'page_955c5f291f78819199e9ba5da85bee76',
};

// ---------------------------------------------------------------- harness

// R01 execution substrate: an AsyncFunction whose global scope is a bare vm
// context — nothing host-side is reachable except the injected parameters.
const bareCtx = vm.createContext({});
const RestrictedAsyncFunction = vm.runInContext('(async function(){}).constructor', bareCtx);

// Reverse of the body's sq() quoting: every token single-quoted, embedded
// quotes escaped as '\'' (close, escaped quote, open).
function splitSq(line) {
  const argv = [];
  let cur = '';
  let inQ = false;
  let has = false;
  let i = 0;
  while (i < line.length) {
    const c = line[i];
    if (!inQ) {
      if (c === "'") { inQ = true; has = true; i += 1; continue; }
      if (c === ' ' || c === '\t') {
        if (has) { argv.push(cur); cur = ''; has = false; }
        i += 1; continue;
      }
      cur += c; has = true; i += 1; continue;
    }
    if (c === "'" && line[i + 1] === '\\' && line[i + 2] === "'" && line[i + 3] === "'") {
      cur += "'"; i += 4; continue;
    }
    if (c === "'") { inQ = false; i += 1; continue; }
    cur += c; i += 1;
  }
  if (has) argv.push(cur);
  return argv;
}

function cli(args, { expectFail = false } = {}) {
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
  if (!expectFail && r.status !== 0) {
    throw new Error(`cli ${args.join(' ')} exited ${r.status}: ${r.stdout} ${r.stderr}`);
  }
  return r;
}

function cliJson(args, opts = {}) {
  return JSON.parse(cli(args, opts).stdout);
}

let rootSeq = 0;
function freshRoot() {
  const root = join(tmpdir(), `dot-br-${process.pid}-${rootSeq++}-${randomUUID().slice(0, 6)}`);
  cli(['init', '--root', root]);
  return root;
}

// PUBLIC-TOOL-SHAPES-faithful fakes. polls: wait_threads poll objects;
// pages: reference -> text for read_page_reference; pageSearch: fallback
// read_page responder (its return value is wrapped as structuredContent);
// pageSearchRaw: F04 — a raw read_page response returned VERBATIM (models an
// explicit denial envelope with isError and no structuredContent);
// sendBehavior: 'ok' | 'throw' | 'is-error' | 'wrong-thread'; raceClaim: a
// competing winner claims the same PENDING delivery just before the runner's
// own claim.
function makeTools(opts = {}) {
  const {
    polls = [],
    pages = {},
    refShapes = null,
    pageSearch = null,
    pageSearchRaw = null,
    sendBehavior = 'ok',
    sendThrowMessage = 'secret-ish network dropped mid-send',
    raceClaim = false,
  } = opts;
  const calls = { exec: [], wait: [], sends: [], reads: [], readPage: [], raced: false };
  const tools = {
    exec_command: async (arg) => {
      const cmd = String(arg?.cmd ?? '');
      calls.exec.push(cmd);
      const argv = splitSq(cmd);
      if (argv[0] !== 'env' || !String(argv[1]).startsWith('NODE_NO_WARNINGS')) {
        throw new Error(`unexpected cmd form: ${cmd.slice(0, 120)}`);
      }
      if (raceClaim && cmd.includes("'delivery-claim'") && !calls.raced) {
        calls.raced = true;
        spawnSync(argv[2], argv.slice(3), { encoding: 'utf8' });
      }
      const r = spawnSync(argv[2], argv.slice(3), { encoding: 'utf8' });
      return { exit_code: r.status ?? 1, output: r.stdout };
    },
    'mcp__codex_app__wait_threads': async (arg) => {
      calls.wait.push(arg);
      return {
        content: [{ type: 'text', text: JSON.stringify({ timedOut: false, wake: {}, polls }) }],
        isError: false,
      };
    },
    'mcp__codex_app__send_message_to_thread': async (arg) => {
      const { threadId, prompt } = arg ?? {};
      calls.sends.push({ threadId, prompt });
      if (sendBehavior === 'throw') throw new Error(sendThrowMessage);
      if (sendBehavior === 'is-error') {
        return { content: [{ type: 'text', text: 'refused by transport' }], isError: true };
      }
      if (sendBehavior === 'wrong-thread') {
        return {
          content: [{ type: 'text', text: JSON.stringify({ threadId: 'not-the-destination' }) }],
          isError: false,
        };
      }
      return {
        content: [{ type: 'text', text: JSON.stringify({ threadId }) }],
        isError: false,
      };
    },
    'mcp__codex_apps__chatgpt_space_read_page_reference': async ({ page_id, reference }) => {
      calls.reads.push({ page_id, reference });
      // R02: a raw crafted response (malformed-shape arms) bypasses the
      // well-formed default entirely
      if (refShapes && Object.prototype.hasOwnProperty.call(refShapes, reference)) {
        const shaped = refShapes[reference];
        if (shaped && typeof shaped.__throw === 'string') throw new Error(shaped.__throw);
        return shaped;
      }
      const text = pages[reference];
      if (typeof text !== 'string') throw new Error('secret-ish page fetch failure');
      return {
        structuredContent: {
          kind: 'text',
          text_representation: 'source',
          text,
          byte_size: Buffer.byteLength(text),
          sha256: sha256Of(text),
          page_id,
          reference,
        },
      };
    },
    'mcp__codex_apps__chatgpt_space_read_page': async (arg) => {
      // a real MCP boundary JSON-serializes args; record that form (the body's
      // vm-realm objects would otherwise differ by prototype only)
      calls.readPage.push(JSON.parse(JSON.stringify(arg)));
      if (pageSearchRaw) return pageSearchRaw(arg);
      const r = pageSearch ? pageSearch(arg) : null;
      if (!r) throw new Error('secret-ish read_page failure');
      return { structuredContent: r };
    },
  };
  return { tools, calls };
}

async function runBody(root, tools, configOverrides = {}) {
  const source = readFileSync(BODY_PATH, 'utf8');
  const fn = new RestrictedAsyncFunction('tools', 'config', 'emit', source);
  const emitted = [];
  const config = {
    root,
    cli: CLI,
    node: process.execPath,
    expected_source_sha256: '0'.repeat(64),
    source_commit: '0'.repeat(40),
    ids: { ...CHAT_IDS },
    coordinator_id: CHAT_IDS.coordinator,
    page_registry: { ...PAGE_REG },
    cycle_wall_budget_ms: 45000,
    event_limit: 10,
    index_page_limit: 10,
    // BOUNDED-CYCLE: the restricted realm has NO setTimeout (probed above) —
    // the host injects the timer pair the tool-race bound needs
    timers: { setTimeout, clearTimeout },
    ...configOverrides,
  };
  const raw = await fn(tools, config, (x) => emitted.push(x));
  // the runtime host serializes the body's return over a boundary before any
  // consumer sees it — model that here (also normalizes the vm realm's
  // prototypes so value equality is what the assertions check)
  const result = JSON.parse(JSON.stringify(raw));
  return { result, emitted };
}

function assertResultShape(r) {
  assert.ok(r && typeof r === 'object', 'result must be an object');
  assert.deepEqual(Object.keys(r).sort(), ['blockers', 'continuation', 'counts', 'mode', 'state', 'version']);
  assert.equal(r.version, 1);
  assert.equal(r.mode, 'HYBRID');
  assert.ok(['IDLE', 'PROGRESSED', 'WAIT', 'BLOCKED', 'OFF', 'RECOVERY_IMPORT_PENDING'].includes(r.state), `bad state ${r.state}`);
  assert.deepEqual(Object.keys(r.counts).sort(), ['acks', 'deliveries', 'executions', 'sources']);
  for (const v of Object.values(r.counts)) {
    assert.ok(Number.isSafeInteger(v) && v >= 0 && v < 1e9, `bad count ${v}`);
  }
  assert.ok(Array.isArray(r.blockers) && r.blockers.length <= 10);
  for (const b of r.blockers) {
    assert.deepEqual(Object.keys(b).sort(), ['code', 'event_id']);
    assert.match(b.code, /^[A-Z][A-Z0-9_]{2,39}$/);
    assert.ok(b.event_id === null || typeof b.event_id === 'string');
  }
  assert.equal(typeof r.continuation, 'boolean');
  const text = JSON.stringify(r);
  assert.ok(text.length <= 4096, `output ${text.length}B over bound`);
  assert.ok(/^[\x20-\x7e]+$/.test(text), 'output must be printable ASCII');
  assert.ok(!text.includes(MARKER), 'source marker leaked into output');
  assert.ok(!text.includes('secret-ish'), 'raw tool error text leaked into output');
}

// ---------------------------------------------------------------- fixtures

function batchEnvelopeText(tag, bodyPad = 30) {
  const reports = [];
  for (let i = 0; i < 10; i++) {
    const body = `bridge fixture body ${tag} ${i} ${'q'.repeat(bodyPad)}`;
    reports.push({
      repository: 'artyhoo/getff', pr: 2300, comment_id: `${tag}-${i}`,
      body_sha256: sha256Of(body), reviewed_sha: sha40(`rv-${tag}-${i}`),
      url: `https://github.com/artyhoo/getff/pull/2300#discussion_r${i}`, body,
    });
  }
  const env = {
    version: 1, kind: 'batch', id: `DOT-BR-${tag}`, producer: CHAT_IDS.collector,
    parents: [], payload: { batch_id: `B-${tag}`, reports, complete: true }, sha256: null,
  };
  const { sha256: _omit, ...rest } = env;
  env.sha256 = digest(rest);
  return JSON.stringify(env);
}

// Single-ref manifest + a TERMINAL single-page index chain (string generation,
// locator schema WITHOUT cursor_token — the trusted cursor rides the wait
// receipt, never the locator).
function smallCase(tag, gen = `COLLECTOR-INDEX-${tag}`) {
  const text = batchEnvelopeText(tag);
  const manifest = {
    version: 1, status: 'READY', event_id: `DOT-BR-${tag}`, kind: 'batch',
    producer: CHAT_IDS.collector, destination: CHAT_IDS.analyst,
    sha256: sha256Of(text), bytes: Buffer.byteLength(text), parents: [],
    artifact: { page_id: `sm-${tag}`, reference: `ref-sm-${tag}` }, delivery_id: null,
  };
  const page0 = {
    version: 1, producer: CHAT_IDS.collector, generation: gen, page_number: 0,
    items: [{ type: 'manifest', manifest }], next: null,
  };
  const page0Text = JSON.stringify(page0);
  return {
    text, manifest, page0, page0Text, generation: gen,
    locatorIndex: { page_id: `ix-${tag}`, reference: `library-file:/ix/${tag}.json`, sha256: sha256Of(page0Text), bytes: Buffer.byteLength(page0Text) },
    pages: { [`ref-sm-${tag}`]: text, [`library-file:/ix/${tag}.json`]: page0Text },
  };
}

function locatorLine({ role = 'collector', generation, index, status = 'READY' }) {
  const loc = {
    version: 1, producer: CHAT_IDS[role], status,
    index: { page_id: index.page_id, reference: index.reference, sha256: index.sha256, bytes: index.bytes },
    generation,
  };
  return `DOT_RELAY_INDEX ${JSON.stringify(loc)}`;
}

function pollFor(role, cursor, finalText, { phase = 'final_answer', turnStatus = 'completed', threadId = null } = {}) {
  return {
    schemaVersion: 1, cursor, revision: 10, changed: true,
    thread: { id: threadId ?? CHAT_IDS[role], hostId: 'durable', status: { type: 'idle' } },
    latestTurn: { id: 'turn-1', status: turnStatus, error: null },
    latestAssistantMessage: finalText === null ? null : { id: 'm1', turnId: 'turn-1', phase, text: finalText },
  };
}

// ~351KiB artifact (with multibyte bodies — exercises the PURE byte-length
// chunk math against Node's own counting) split into 2 parts + a 2-page
// immutable index chain.
function bigCase() {
  const reports = [];
  for (let i = 0; i < 10; i++) {
    const body = `bridge big fixture ${i} 🚦 signalling ${'b'.repeat(35100)}`;
    reports.push({
      repository: 'artyhoo/getff', pr: 2300, comment_id: `BIG-${i}`,
      body_sha256: sha256Of(body), reviewed_sha: sha40(`rv-BIG-${i}`),
      url: `https://github.com/artyhoo/getff/pull/2300#discussion_r${i}`, body,
    });
  }
  const env = {
    version: 1, kind: 'batch', id: 'DOT-BR-BIG', producer: CHAT_IDS.collector,
    parents: [], payload: { batch_id: 'B-BIG', reports, complete: true }, sha256: null,
  };
  const { sha256: _omit, ...rest } = env;
  env.sha256 = digest(rest);
  const text = JSON.stringify(env);
  if (Buffer.byteLength(text) < 350000) throw new Error('big fixture too small');
  const descriptors = splitCodepointParts(text, 176000);
  const parts = descriptors.map((d) => d.text);
  const manifest = {
    version: 1, status: 'READY', event_id: 'DOT-BR-BIG', kind: 'batch',
    producer: CHAT_IDS.collector, destination: CHAT_IDS.analyst,
    sha256: sha256Of(text), bytes: Buffer.byteLength(text), parents: [],
    artifact: {
      sha256: sha256Of(text), bytes: Buffer.byteLength(text),
      parts: descriptors.map((d, i) => ({
        ordinal: i, page_id: `big-part-${i}`, reference: `ref-big-${i}`,
        sha256: d.sha256, bytes: d.bytes,
      })),
    },
    delivery_id: null,
  };
  const page1 = { version: 1, producer: CHAT_IDS.collector, generation: 'COLLECTOR-INDEX-BIG', page_number: 1, items: [], next: null };
  const page1Text = JSON.stringify(page1);
  const page0 = {
    version: 1, producer: CHAT_IDS.collector, generation: 'COLLECTOR-INDEX-BIG', page_number: 0,
    items: [{ type: 'manifest', manifest }],
    next: { page_id: 'big-p1', reference: 'library-file:/ix/BIG-page-1.json', sha256: sha256Of(page1Text), bytes: Buffer.byteLength(page1Text) },
  };
  const page0Text = JSON.stringify(page0);
  const pages = {
    'library-file:/ix/BIG-page-0.json': page0Text,
    'library-file:/ix/BIG-page-1.json': page1Text,
    ...Object.fromEntries(parts.map((p, i) => [`ref-big-${i}`, p])),
  };
  return {
    text, manifest, parts, pages, wholeSha: sha256Of(text), generation: 'COLLECTOR-INDEX-BIG',
    locatorIndex: { page_id: 'big-p0', reference: 'library-file:/ix/BIG-page-0.json', sha256: sha256Of(page0Text), bytes: Buffer.byteLength(page0Text) },
  };
}

// ---------------------------------------------------------------- static body

test('body source: restricted-vm compile, no host surface, no error-text matching, cursor via --cursor', () => {
  const source = readFileSync(BODY_PATH, 'utf8');
  assert.ok(source.includes(MARKER), 'deployed marker comment present');
  assert.ok(!/\bimport\s/.test(source), 'no import statements');
  assert.ok(!/\brequire\s*\(/.test(source), 'no require calls');
  assert.ok(!/\bprocess\b/.test(source), 'no host process surface');
  assert.ok(!/\bBuffer\b/.test(source), 'no Buffer surface');
  assert.ok(!/\bTextEncoder\b/.test(source), 'no TextEncoder (R01: pure byte math)');
  assert.ok(!/\bcrypto\b/.test(source), 'no crypto/subtle (R01: verification via CLI)');
  assert.ok(!/\bconsole\b/.test(source), 'no console surface');
  assert.ok(!/\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b/.test(source), 'no network surface');
  assert.ok(!/\bDeno\b|\bnode:/.test(source), 'no runtime-specific globals');
  assert.ok(!source.includes('ACCESS_DENIED'), 'no error-text access-denied matching (R02)');
  assert.ok(!source.includes('cursor-commit'), 'obsolete cursor-commit path removed (R03)');
  assert.ok(source.includes('cycle_wall_budget_ms'), 'cycle wall budget consumed (BOUNDED-CYCLE)');
  assert.ok(source.includes('CYCLE_TOOL_TIMEOUT') && source.includes('CYCLE_CLI_TIMEOUT'), 'bounded tool/CLI timeout codes (BOUNDED-CYCLE)');
  assert.ok(source.includes("'--cursor'"), 'index-import carries the trusted --cursor');
  assert.ok(source.includes('DOT_RELAY_INDEX '), 'strict locator prefix present');
  // imported-receipt prompts are BUILT by the ledger (claimReceipt) and only
  // forwarded verbatim by the body — the body never authors protocol text
  assert.ok(source.includes("'receipt-claim'"), 'imported receipts flow through receipt-claim');
  // deterministic tail: the wrapper contract is a single awaited entry call
  assert.equal(source.trimEnd().endsWith('return await runBridge({tools,config,emit});'), true);
  new RestrictedAsyncFunction('tools', 'config', 'emit', source); // must compile
});

test('restricted vm context: TextEncoder/crypto/Buffer/process are undefined where the body runs', async () => {
  const ctx = vm.createContext({});
  const AF = vm.runInContext('(async function(){}).constructor', ctx);
  const probe = new AF('return [typeof TextEncoder, typeof crypto, typeof Buffer, typeof process].join(",")');
  assert.equal(await probe(), 'undefined,undefined,undefined,undefined');
  // BOUNDED-CYCLE substrate facts: Date IS an ECMAScript builtin (the wall
  // clock's default adapter), setTimeout is NOT (host timers must ride
  // config.timers), Promise IS (the race itself).
  const probe2 = new AF('return [typeof Date, typeof setTimeout, typeof Promise].join(",")');
  assert.equal(await probe2(), 'function,undefined,function');
});

// ---------------------------------------------------------------- bridge-source CLI

test('bridge-source: dual-pin agreement returns exact source + trusted config (incl. page_registry); single stdout JSON', () => {
  const root = freshRoot();
  const realSha = createHash('sha256').update(readFileSync(BODY_PATH)).digest('hex');
  writeFileSync(join(root, 'bridge-runner-pin.json'), `${JSON.stringify({
    version: 1, sha256: realSha, source_commit: 'a'.repeat(40), reviewed_at: '2026-10-08T00:00:00.000Z',
  })}\n`);
  const out = cliJson(['bridge-source', '--expected-sha256', realSha, '--root', root]);
  assert.equal(out.ok, true);
  assert.equal(out.version, 1);
  assert.equal(out.sha256, realSha);
  assert.equal(out.source, readFileSync(BODY_PATH, 'utf8'));
  assert.deepEqual(Object.keys(out).sort(), ['config', 'ok', 'sha256', 'source', 'version']);
  assert.deepEqual(out.config, {
    root,
    cli: CLI,
    node: process.execPath,
    expected_source_sha256: realSha,
    source_commit: 'a'.repeat(40),
    ids: { collector: CHAT_IDS.collector, analyst: CHAT_IDS.analyst, solver: CHAT_IDS.solver },
    coordinator_id: CHAT_IDS.coordinator,
    page_registry: PAGE_REG,
    // F08: the config NAMES the injection contract — the bootstrap must
    // inject the validated timer pair before the body runs
    timer_adapter_required: true,
    cycle_wall_budget_ms: 45000,
    event_limit: 10,
    index_page_limit: 10,
  });
  // caller pin AND deployed pin must agree — each disagreement is refused
  const wrongCaller = cli(['bridge-source', '--expected-sha256', 'f'.repeat(64), '--root', root], { expectFail: true });
  assert.ok(wrongCaller.stdout.includes('BRIDGE_SOURCE_UNTRUSTED'));
  const tampered = JSON.parse(readFileSync(join(root, 'bridge-runner-pin.json'), 'utf8'));
  tampered.sha256 = 'e'.repeat(64);
  writeFileSync(join(root, 'bridge-runner-pin.json'), `${JSON.stringify(tampered)}\n`);
  const badPin = cli(['bridge-source', '--expected-sha256', realSha, '--root', root], { expectFail: true });
  assert.ok(badPin.stdout.includes('BRIDGE_SOURCE_UNTRUSTED'));
  rmSync(join(root, 'bridge-runner-pin.json'));
  const noPin = cli(['bridge-source', '--expected-sha256', realSha, '--root', root], { expectFail: true });
  assert.ok(noPin.stdout.includes('BRIDGE_SOURCE_UNTRUSTED'));
  rmSync(root, { recursive: true, force: true });
});

test('bridge-source: missing flag exits 2; symlinked body refused before any compile', () => {
  const root = freshRoot();
  const noFlag = cli(['bridge-source', '--root', root], { expectFail: true });
  assert.equal(noFlag.status, 2);
  const realSha = createHash('sha256').update(readFileSync(BODY_PATH)).digest('hex');
  writeFileSync(join(root, 'bridge-runner-pin.json'), `${JSON.stringify({
    version: 1, sha256: realSha, source_commit: 'b'.repeat(40), reviewed_at: '2026-10-08T00:00:00.000Z',
  })}\n`);
  // swap the deployed body for a symlink pointing outside the CLI dir
  const backup = `${BODY_PATH}.testbackup`;
  const evil = join(tmpdir(), `dot-br-evil-${randomUUID().slice(0, 6)}.js`);
  writeFileSync(evil, '// evil twin\nreturn await 1;\n');
  let restored = false;
  try {
    renameSync(BODY_PATH, backup);
    symlinkSync(evil, BODY_PATH);
    const sym = cli(['bridge-source', '--expected-sha256', realSha, '--root', root], { expectFail: true });
    assert.ok(sym.stdout.includes('BRIDGE_SOURCE_UNTRUSTED'));
    assert.ok(!sym.stdout.includes('evil twin'));
  } finally {
    try { rmSync(BODY_PATH, { force: true }); } catch { /* already gone */ }
    renameSync(backup, BODY_PATH);
    restored = true;
  }
  assert.ok(restored, 'body restored');
  assert.equal(lstatSync(BODY_PATH).isSymbolicLink(), false);
  rmSync(evil, { force: true });
  rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------- cycles

test('idle cycle: status+tick+plan, ONE wait_threads with role targets, zero sends, IDLE, emit once', async () => {
  const root = freshRoot();
  const { tools, calls } = makeTools({ polls: [] });
  const { result, emitted } = await runBody(root, tools);
  assertResultShape(result);
  assert.equal(result.state, 'IDLE');
  assert.deepEqual(result.counts, { sources: 0, deliveries: 0, acks: 0, executions: 0 });
  assert.equal(result.continuation, false);
  assert.equal(calls.wait.length, 1, 'exactly one wait_threads call');
  const arg = calls.wait[0];
  assert.ok(arg && typeof arg === 'object');
  assert.equal(arg.timeoutMs, 0);
  assert.ok(Array.isArray(arg.targets));
  const byThread = Object.fromEntries(arg.targets.map((t) => [t.threadId, t]));
  assert.deepEqual(Object.keys(byThread).sort(), [CHAT_IDS.analyst, CHAT_IDS.collector, CHAT_IDS.solver].sort());
  for (const t of Object.values(byThread)) assert.equal('afterCursor' in t, false, 'no committed cursor yet');
  assert.equal(calls.sends.length, 0);
  assert.equal(emitted.length, 1);
  rmSync(root, { recursive: true, force: true });
});

test('durable OFF: status short-circuits to OFF before any wait/send', async () => {
  const root = freshRoot();
  cliJson(['off', '--root', root, '--reason', 'operator maintenance window stop']);
  const { tools, calls } = makeTools({});
  const { result } = await runBody(root, tools);
  assertResultShape(result);
  assert.equal(result.state, 'OFF');
  assert.equal(calls.wait.length, 0);
  assert.equal(calls.sends.length, 0);
  rmSync(root, { recursive: true, force: true });
});

test('RECOVERY-ADOPTION: recovery_import_pending short-circuits the cycle before any tick/wait/send', async () => {
  const root = join(tmpdir(), `dot-br-rec-${randomUUID().slice(0, 6)}`);
  cli(['init', '--root', root, '--recovery-pending']);
  const { tools, calls } = makeTools({});
  const { result } = await runBody(root, tools);
  assertResultShape(result);
  assert.equal(result.state, 'RECOVERY_IMPORT_PENDING');
  assert.deepEqual(result.blockers, [{ code: 'RECOVERY_IMPORT_PENDING', event_id: null }]);
  assert.equal(calls.exec.length, 1, 'status only — no tick, no plan');
  assert.ok(calls.exec[0].includes("'status'"));
  assert.equal(calls.wait.length, 0);
  assert.equal(calls.sends.length, 0);
  rmSync(root, { recursive: true, force: true });
});

test('full small cycle: locator via content-wrapped wait -> source-put + index-import --cursor -> artifact spool -> send -> receipt; afterCursor on cycle 2', async () => {
  const root = freshRoot();
  const c = smallCase('SC1');
  const polls = [pollFor('collector', 'cur-sc1-9', locatorLine({ generation: c.generation, index: c.locatorIndex }))];
  const { tools, calls } = makeTools({ polls, pages: c.pages });
  const { result } = await runBody(root, tools);
  assertResultShape(result);
  assert.equal(result.state, 'PROGRESSED');
  assert.deepEqual(result.counts, { sources: 1, deliveries: 1, acks: 0, executions: 0 });
  assert.equal(result.continuation, false);

  // index page materialized under the fixed source spool, exact bytes
  const src = join(root, 'sources', `${c.locatorIndex.sha256}.json`);
  assert.ok(existsSync(src), 'source published');
  assert.equal(readFileSync(src, 'utf8'), c.page0Text);
  // trusted cursor committed only on chain completion (terminal page here)
  assert.equal(cliJson(['plan', '--root', root]).committed_cursors.collector, 'cur-sc1-9');
  // artifact object published with exact whole bytes
  const obj = join(root, 'objects', `${c.manifest.sha256}.json`);
  assert.equal(readFileSync(obj, 'utf8'), c.text);
  // reads: index page then artifact reference; NO read_page fallback on a full reference
  assert.deepEqual(calls.reads.map((r) => r.reference), [`library-file:/ix/SC1.json`, `ref-sm-SC1`]);
  assert.equal(calls.readPage.length, 0);

  // delivery send: destination thread, prompt carries the exact manifest
  const deliverySend = calls.sends.find((s) => s.prompt && !s.prompt.startsWith('DOT_RELAY_IMPORTED '));
  assert.ok(deliverySend, 'one artifact delivery send');
  assert.equal(deliverySend.threadId, CHAT_IDS.analyst);
  assert.deepEqual(JSON.parse(deliverySend.prompt), c.manifest);
  // receipt send: DOT_RELAY_IMPORTED to the collector thread
  const receiptSend = calls.sends.find((s) => s.prompt && s.prompt.startsWith('DOT_RELAY_IMPORTED '));
  assert.ok(receiptSend, 'one imported-receipt send');
  assert.equal(receiptSend.threadId, CHAT_IDS.collector);
  const rp = JSON.parse(receiptSend.prompt.slice('DOT_RELAY_IMPORTED '.length));
  assert.equal(rp.generation, c.generation);
  assert.equal(rp.page_number, 0);
  assert.equal(rp.source_sha256, c.locatorIndex.sha256);
  assert.deepEqual(rp.items, [{ type: 'manifest', event_id: c.manifest.event_id, sha256: digest(c.manifest) }]);

  // outbox state: delivery SENT_ACCEPTED, receipt drained
  const st = cliJson(['status', '--root', root]);
  assert.equal(st.counts.outbox_pending, 0);

  // cycle 2: the committed cursor rides the next wait as afterCursor
  const second = makeTools({ polls: [], pages: c.pages });
  const r2 = await runBody(root, second.tools);
  assertResultShape(r2.result);
  assert.equal(r2.result.state, 'IDLE');
  const t2 = Object.fromEntries(second.calls.wait[0].targets.map((t) => [t.threadId, t]));
  assert.equal(t2[CHAT_IDS.collector].afterCursor, 'cur-sc1-9');
  assert.equal('afterCursor' in t2[CHAT_IDS.analyst], false);
  // no re-fetch of anything already materialized
  assert.equal(second.calls.reads.length, 0);
  assert.equal(second.calls.sends.length, 0);
  rmSync(root, { recursive: true, force: true });
});

test('big cycle: 2-page chain + 351KiB multipart artifact (multibyte chunks) via real CLI; resume needs no re-fetch', async () => {
  const root = freshRoot();
  const c = bigCase();
  const polls = [pollFor('collector', 'cur-big-4', locatorLine({ generation: c.generation, index: c.locatorIndex }))];
  const { tools, calls } = makeTools({ polls, pages: c.pages });
  const { result } = await runBody(root, tools);
  assertResultShape(result);
  assert.equal(result.state, 'PROGRESSED');
  assert.deepEqual(result.counts, { sources: 2, deliveries: 1, acks: 0, executions: 0 });
  assert.equal(cliJson(['plan', '--root', root]).committed_cursors.collector, 'cur-big-4');
  const obj = join(root, 'objects', `${c.wholeSha}.json`);
  assert.equal(statSync(obj).size, Buffer.byteLength(c.text));
  assert.equal(readFileSync(obj, 'utf8'), c.text);
  assert.deepEqual(calls.reads.map((r) => r.reference), ['library-file:/ix/BIG-page-0.json', 'library-file:/ix/BIG-page-1.json', ...c.parts.map((_, i) => `ref-big-${i}`)]);
  // a second cycle with no new polls re-fetches nothing and sends nothing
  const second = makeTools({ polls: [], pages: c.pages });
  const r2 = await runBody(root, second.tools);
  assert.equal(r2.result.state, 'IDLE');
  assert.equal(second.calls.reads.length, 0);
  assert.equal(second.calls.sends.length, 0);
  rmSync(root, { recursive: true, force: true });
});

test('WAIT_PROTOCOL: completed final_answer without the strict prefix is a fixed blocker, nothing imported', async () => {
  const root = freshRoot();
  const polls = [pollFor('collector', 'cur-wp-1', 'All looks fine, nothing to relay this window.')];
  const { tools, calls } = makeTools({ polls });
  const { result } = await runBody(root, tools);
  assertResultShape(result);
  assert.equal(result.state, 'WAIT');
  assert.ok(result.blockers.some((b) => b.code === 'WAIT_PROTOCOL'));
  assert.equal(calls.reads.length, 0);
  assert.equal(cliJson(['plan', '--root', root]).committed_cursors.collector, undefined);
  rmSync(root, { recursive: true, force: true });
});

test('locator schema violations: legacy cursor_token field and wrong producer are rejected (no import)', async () => {
  const root = freshRoot();
  const c = smallCase('SCX');
  // OLD locator shape carrying cursor_token — the trusted cursor must NEVER
  // come from the payload (R03): strict schema rejects the extra field.
  const legacy = `DOT_RELAY_INDEX ${JSON.stringify({
    version: 1, producer: CHAT_IDS.collector, status: 'READY',
    index: c.locatorIndex, generation: c.generation, cursor_token: 'forged-by-payload',
  })}`;
  const polls = [pollFor('collector', 'cur-x-1', legacy)];
  const { tools, calls } = makeTools({ polls, pages: c.pages });
  const { result } = await runBody(root, tools);
  assertResultShape(result);
  assert.ok(result.blockers.some((b) => b.code === 'WAIT_PROTOCOL'));
  assert.equal(calls.reads.length, 0, 'no fetch for a schema-violating locator');
  // producer mismatch (analyst id under the collector thread) — refused
  const forged = locatorLine({ role: 'analyst', generation: c.generation, index: c.locatorIndex });
  const p2 = [pollFor('collector', 'cur-x-2', forged)];
  const t2 = makeTools({ polls: p2, pages: c.pages });
  const r2 = await runBody(root, t2.tools);
  assertResultShape(r2.result);
  assert.ok(r2.result.blockers.some((b) => b.code === 'WAIT_PROTOCOL'));
  assert.equal(t2.calls.reads.length, 0);
  rmSync(root, { recursive: true, force: true });
});

test('chatter ignored: non-final phases and uncompleted turns never become locators', async () => {
  const root = freshRoot();
  const c = smallCase('SCC');
  const line = locatorLine({ generation: c.generation, index: c.locatorIndex });
  const polls = [
    pollFor('collector', 'cur-cc-1', line, { phase: 'progress' }),
    pollFor('analyst', 'cur-cc-2', line, { turnStatus: 'running' }),
    pollFor('solver', 'cur-cc-3', null),
  ];
  const { tools, calls } = makeTools({ polls, pages: c.pages });
  const { result } = await runBody(root, tools);
  assertResultShape(result);
  assert.equal(result.state, 'IDLE');
  assert.deepEqual(result.blockers, []);
  assert.equal(calls.reads.length, 0);
  assert.equal(cliJson(['plan', '--root', root]).committed_cursors.collector, undefined);
  rmSync(root, { recursive: true, force: true });
});

test('malformed wait wrapper: isError or extra content blocks -> fixed blocker, no crash, no leak', async () => {
  const root = freshRoot();
  const c = smallCase('SCW');
  const line = locatorLine({ generation: c.generation, index: c.locatorIndex });
  for (const variant of ['is-error', 'two-blocks', 'not-json']) {
    const tools = {
      exec_command: makeTools({ polls: [] }).tools.exec_command,
      'mcp__codex_app__wait_threads': async () => {
        if (variant === 'is-error') return { content: [{ type: 'text', text: 'transport refused' }], isError: true };
        if (variant === 'two-blocks') {
          return {
            content: [
              { type: 'text', text: JSON.stringify({ timedOut: false, wake: {}, polls: [pollFor('collector', 'cur-w-1', line)] }) },
              { type: 'text', text: 'second block' },
            ],
            isError: false,
          };
        }
        return { content: [{ type: 'text', text: 'not json at all' }], isError: false };
      },
      'mcp__codex_app__send_message_to_thread': makeTools({ polls: [] }).tools['mcp__codex_app__send_message_to_thread'],
      'mcp__codex_apps__chatgpt_space_read_page_reference': makeTools({ polls: [], pages: c.pages }).tools['mcp__codex_apps__chatgpt_space_read_page_reference'],
      'mcp__codex_apps__chatgpt_space_read_page': makeTools({ polls: [] }).tools['mcp__codex_apps__chatgpt_space_read_page'],
    };
    const { result } = await runBody(root, tools);
    assertResultShape(result);
    assert.ok(result.blockers.some((b) => b.code === 'WAIT_TOOL_FAILED'), `${variant} flagged`);
    assert.equal(cliJson(['plan', '--root', root]).committed_cursors.collector, undefined);
  }
  rmSync(root, { recursive: true, force: true });
});

test('SEND_UNCERTAIN: unknown send error -> uncertain receipt, never retried, no error-text matching, no inline packet', async () => {
  const root = freshRoot();
  const c = smallCase('SCU');
  const polls = [pollFor('collector', 'cur-su-2', locatorLine({ generation: c.generation, index: c.locatorIndex }))];
  const first = makeTools({ polls, pages: c.pages, sendBehavior: 'throw', sendThrowMessage: 'ACCESS_DENIED: secret-ish recipient blocks external references' });
  const r1 = await runBody(root, first.tools);
  assertResultShape(r1.result);
  assert.equal(r1.result.counts.deliveries, 0, 'no successful delivery');
  assert.ok(r1.result.blockers.some((b) => b.code === 'SEND_UNCERTAIN'));
  assert.ok(!JSON.stringify(r1.result).includes('ACCESS_DENIED'), 'error text not echoed');
  // no inline packet was invented from an untyped error (R02)
  assert.ok(!first.calls.sends.some((s) => String(s.prompt).includes('"inline"')), 'no inline fallback');
  // the artifact object IS published (spool finished before the send)
  assert.ok(existsSync(join(root, 'objects', `${c.manifest.sha256}.json`)));
  // next cycle: the uncertain delivery is never resent
  const second = makeTools({ polls: [], pages: c.pages });
  const r2 = await runBody(root, second.tools);
  assert.equal(r2.result.state, 'IDLE');
  assert.equal(second.calls.sends.length, 0);
  rmSync(root, { recursive: true, force: true });
});

test('send result threadId mismatch -> SEND_UNCERTAIN (decoded destination is authoritative)', async () => {
  const root = freshRoot();
  const c = smallCase('SCM');
  const polls = [pollFor('collector', 'cur-sm-3', locatorLine({ generation: c.generation, index: c.locatorIndex }))];
  const { tools } = makeTools({ polls, pages: c.pages, sendBehavior: 'wrong-thread' });
  const { result } = await runBody(root, tools);
  assertResultShape(result);
  assert.ok(result.blockers.some((b) => b.code === 'SEND_UNCERTAIN'));
  rmSync(root, { recursive: true, force: true });
});

test('budget continuation: index_page_limit stops mid-chain; next cycle resumes from plan.index_continuations without re-reading page 0', async () => {
  const root = freshRoot();
  const c = bigCase();
  const polls = [pollFor('collector', 'cur-bc-7', locatorLine({ generation: c.generation, index: c.locatorIndex }))];
  const first = makeTools({ polls, pages: c.pages });
  const r1 = await runBody(root, first.tools, { index_page_limit: 1 });
  assertResultShape(r1.result);
  assert.equal(r1.result.counts.sources, 1, 'only page 0 imported');
  assert.equal(r1.result.continuation, true);
  assert.equal(cliJson(['plan', '--root', root]).committed_cursors.collector, undefined, 'cursor held while chain open');
  const cont = cliJson(['plan', '--root', root]).index_continuations;
  assert.equal(cont.length, 1);
  assert.equal(cont[0].generation, c.generation);
  assert.equal(cont[0].snapshot_cursor, 'cur-bc-7');
  assert.deepEqual(cont[0].next_descriptor, { page_id: 'big-p1', reference: 'library-file:/ix/BIG-page-1.json', sha256: sha256Of(JSON.stringify({ version: 1, producer: CHAT_IDS.collector, generation: c.generation, page_number: 1, items: [], next: null })), bytes: Buffer.byteLength(JSON.stringify({ version: 1, producer: CHAT_IDS.collector, generation: c.generation, page_number: 1, items: [], next: null })) });

  // second cycle: NO new poll — the continuation alone drives page 1 + the artifact
  const second = makeTools({ polls: [], pages: c.pages });
  const r2 = await runBody(root, second.tools, { index_page_limit: 1 });
  assertResultShape(r2.result);
  assert.equal(r2.result.counts.sources, 1, 'page 1 imported');
  assert.equal(r2.result.state, 'PROGRESSED');
  assert.equal(cliJson(['plan', '--root', root]).committed_cursors.collector, 'cur-bc-7');
  // page 0 was read exactly once across BOTH cycles
  const page0Reads = [...first.calls.reads, ...second.calls.reads].filter((r) => r.reference === 'library-file:/ix/BIG-page-0.json');
  assert.equal(page0Reads.length, 1);
  assert.ok(existsSync(join(root, 'objects', `${c.wholeSha}.json`)));
  rmSync(root, { recursive: true, force: true });
});

test('foreign delivery claim wins the race -> DELIVERY_STATE handled, no duplicate send', async () => {
  const root = freshRoot();
  const c = smallCase('SCR');
  const polls = [pollFor('collector', 'cur-rc-5', locatorLine({ generation: c.generation, index: c.locatorIndex }))];
  const { tools, calls } = makeTools({ polls, pages: c.pages, raceClaim: true });
  const { result } = await runBody(root, tools);
  assertResultShape(result);
  assert.ok(!result.blockers.some((b) => b.code === 'BRIDGE_EXCEPTION'));
  // the artifact delivery was claimed by the competitor: exactly zero
  // artifact sends from this runner (the receipt send may still fire)
  const artifactSends = calls.sends.filter((s) => !String(s.prompt ?? '').startsWith('DOT_RELAY_IMPORTED '));
  assert.equal(artifactSends.length, 0);
  rmSync(root, { recursive: true, force: true });
});

test('crash-restart: partial multipart spool resumed by a later cycle with exact part/whole hashes', async () => {
  const root = freshRoot();
  const c = bigCase();
  // simulate a crashed uploader: manifest imported, spool begun, part 0 done
  mkdirSync(join(root, 'in'), { recursive: true });
  writeFileSync(join(root, 'in', 'big.manifest.json'), `${JSON.stringify(c.manifest)}\n`);
  cliJson(['manifest-import', '--root', root, '--file', join(root, 'in', 'big.manifest.json'), '--producer-role', 'collector', '--cursor-token', 'tok-br-big']);
  const begin = cliJson(['spool-begin', '--root', root, '--id', c.manifest.event_id, '--artifact-sha256', c.manifest.sha256, '--bytes', String(c.manifest.bytes)]);
  const up = begin.upload_id;
  const p0 = c.manifest.artifact.parts[0];
  cliJson(['spool-part-begin', '--root', root, '--upload-id', up, '--ordinal', '0', '--sha256', p0.sha256, '--bytes', String(p0.bytes)]);
  for (let i = 0; i < c.parts[0].length; i += 12000) {
    cli(['spool-append', '--root', root, '--upload-id', up, '--chunk-json', JSON.stringify(c.parts[0].slice(i, i + 12000))]);
  }
  cliJson(['spool-part-finish', '--root', root, '--upload-id', up, '--ordinal', '0']);

  // a later idle cycle (no new polls) sees the pending upload and finishes it
  const { tools, calls } = makeTools({ polls: [], pages: c.pages });
  const { result } = await runBody(root, tools);
  assertResultShape(result);
  assert.ok(existsSync(join(root, 'objects', `${c.wholeSha}.json`)), 'whole object published by resume');
  assert.equal(readFileSync(join(root, 'objects', `${c.wholeSha}.json`), 'utf8'), c.text);
  assert.deepEqual(calls.reads.map((r) => r.reference), c.parts.slice(1).map((_, i) => `ref-big-${i + 1}`), 'only the missing parts refetched');
  const artifactSends = calls.sends.filter((s) => !String(s.prompt ?? '').startsWith('DOT_RELAY_IMPORTED '));
  assert.equal(artifactSends.length, 1, 'delivery send fired after resume');
  rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------- F09 implicit resume
//
// DOT-2087-F09: an interrupted single-reference (implicit-part) upload must
// COMPLETE from its durable checkpoint — suffix-only append from the VERIFIED
// byte offset, publication windows dispatched straight to idempotent
// spool-finish, ONE upload identity per manifest, and torn/foreign offsets
// failing closed with the original state retained.

// A single-ref manifest whose artifact spans MULTIPLE 12000-byte upload
// chunks (ASCII and multibyte variants) — the implicit resume substrate.
function implicitCase(tag, { multibyte = false } = {}) {
  const reports = [];
  for (let i = 0; i < 10; i++) { // validateBatchPayload pins reports.length === 10
    const body = `bridge f09 fixture ${tag} ${i} ${multibyte ? '🚦 сигнальный ' : ''}${'q'.repeat(2600)}`;
    reports.push({
      repository: 'artyhoo/getff', pr: 2300, comment_id: `F09-${tag}-${i}`,
      body_sha256: sha256Of(body), reviewed_sha: sha40(`rv-${tag}-${i}`),
      url: `https://github.com/artyhoo/getff/pull/2300#discussion_r${i}`, body,
    });
  }
  const env = {
    version: 1, kind: 'batch', id: `DOT-BR-${tag}`, producer: CHAT_IDS.collector,
    parents: [], payload: { batch_id: `B-${tag}`, reports, complete: true }, sha256: null,
  };
  const { sha256: _omit, ...rest } = env;
  env.sha256 = digest(rest);
  const text = JSON.stringify(env);
  if (Buffer.byteLength(text) < 26000) throw new Error('f09 fixture too small');
  const manifest = {
    version: 1, status: 'READY', event_id: `DOT-BR-${tag}`, kind: 'batch',
    producer: CHAT_IDS.collector, destination: CHAT_IDS.analyst,
    sha256: sha256Of(text), bytes: Buffer.byteLength(text), parents: [],
    artifact: { page_id: `f09-${tag}`, reference: `ref-f09-${tag}` }, delivery_id: null,
  };
  return { text, manifest, pages: { [`ref-f09-${tag}`]: text } };
}

// Mirrors the body's greedy codepoint-safe 12000-byte chunk packing.
function f09Chunks(text) {
  const chunks = [];
  let cur = '';
  let curBytes = 0;
  for (const ch of text) {
    const b = Buffer.byteLength(ch);
    if (curBytes > 0 && curBytes + b > 12000) {
      chunks.push(cur);
      cur = '';
      curBytes = 0;
    }
    cur += ch;
    curBytes += b;
  }
  if (curBytes > 0) chunks.push(cur);
  return chunks;
}

// The codepoint-safe prefix of at most maxBytes UTF-8 bytes of text.
function f09BytePrefix(text, maxBytes) {
  let cur = '';
  let n = 0;
  for (const ch of text) {
    const b = Buffer.byteLength(ch);
    if (n + b > maxBytes) break;
    cur += ch;
    n += b;
  }
  return cur;
}

// Simulated crashed uploader: manifest imported, spool begun, exactly
// prefixText bytes appended to the in-flight implicit part.
function f09BeginPartial(root, c, prefixText) {
  mkdirSync(join(root, 'in'), { recursive: true });
  writeFileSync(join(root, 'in', 'f09.manifest.json'), `${JSON.stringify(c.manifest)}\n`);
  cliJson(['manifest-import', '--root', root, '--file', join(root, 'in', 'f09.manifest.json'), '--producer-role', 'collector', '--cursor-token', 'tok-f09']);
  const begin = cliJson(['spool-begin', '--root', root, '--id', c.manifest.event_id, '--artifact-sha256', c.manifest.sha256, '--bytes', String(c.manifest.bytes)]);
  const appendedBytes = Buffer.byteLength(prefixText);
  if (appendedBytes > 0) {
    for (const chunk of f09Chunks(prefixText)) {
      cli(['spool-append', '--root', root, '--upload-id', begin.upload_id, '--chunk-json', JSON.stringify(chunk)]);
    }
  }
  return { uploadId: begin.upload_id, appendedBytes };
}

// Bytes actually appended by THIS cycle's spool-append invocations, parsed
// back out of the recorded exec command lines.
function f09CycleAppendBytes(calls) {
  let total = 0;
  for (const cmd of calls.exec) {
    if (!cmd.includes("'spool-append'")) continue;
    const argv = splitSq(cmd);
    const i = argv.indexOf('--chunk-json');
    total += Buffer.byteLength(JSON.parse(argv[i + 1]));
  }
  return total;
}

function f09StatePath(root, uploadId) {
  return join(root, 'spool', `${uploadId}.state.json`);
}

test('F09 crash-restart: partial implicit ASCII upload resumes from the verified offset — suffix only, exactly once, one identity', async () => {
  const root = freshRoot();
  const c = implicitCase('F09A');
  const chunks = f09Chunks(c.text);
  assert.ok(chunks.length >= 3, 'fixture spans multiple upload chunks');
  const { uploadId, appendedBytes } = f09BeginPartial(root, c, chunks[0]);

  const { tools, calls } = makeTools({ polls: [], pages: c.pages });
  const { result } = await runBody(root, tools);
  assertResultShape(result);
  // the SAME upload completed: exact whole bytes, no leaked spool state
  const obj = join(root, 'objects', `${c.manifest.sha256}.json`);
  assert.ok(existsSync(obj), 'object published by resume');
  assert.equal(readFileSync(obj, 'utf8'), c.text);
  assert.equal(readdirSync(join(root, 'spool')).length, 0, 'no leaked spool state after completion');
  // the source was refetched exactly ONCE for the verified suffix
  assert.deepEqual(calls.reads.map((r) => r.reference), ['ref-f09-F09A']);
  // ONLY the suffix was appended — never the whole object again
  assert.equal(f09CycleAppendBytes(calls), Buffer.byteLength(c.text) - appendedBytes);
  assert.ok(!calls.exec.some((cmd) => cmd.includes("'spool-begin'")), 'no second upload identity');
  // the ingested artifact produced exactly one delivery send this cycle
  const artifactSends = calls.sends.filter((s) => !String(s.prompt ?? '').startsWith('DOT_RELAY_IMPORTED '));
  assert.equal(artifactSends.length, 1);

  // second cycle over the finished state: nothing re-fetched, re-appended or resent
  const second = makeTools({ polls: [], pages: c.pages });
  const r2 = await runBody(root, second.tools);
  assertResultShape(r2.result);
  assert.equal(r2.result.state, 'IDLE');
  assert.equal(second.calls.reads.length, 0);
  assert.equal(f09CycleAppendBytes(second.calls), 0);
  assert.ok(!second.calls.exec.some((cmd) => cmd.includes("'spool-begin'")));
  assert.equal(readFileSync(obj, 'utf8'), c.text);
  rmSync(root, { recursive: true, force: true });
});

test('F09 crash-restart: partial implicit MULTIBYTE upload resumes codepoint-safely from a non-chunk-boundary offset', async () => {
  const root = freshRoot();
  const c = implicitCase('F09B', { multibyte: true });
  // an offset that is neither a chunk edge nor char-index aligned — the
  // suffix math must walk UTF-8 bytes, not chars or chunks
  const partial = f09BytePrefix(c.text, 16321);
  const appendedBytes = Buffer.byteLength(partial);
  assert.ok(appendedBytes > 12000 && appendedBytes < Buffer.byteLength(c.text));
  f09BeginPartial(root, c, partial);

  const { tools, calls } = makeTools({ polls: [], pages: c.pages });
  const { result } = await runBody(root, tools);
  assertResultShape(result);
  const obj = join(root, 'objects', `${c.manifest.sha256}.json`);
  assert.ok(existsSync(obj), 'object published by resume');
  assert.equal(readFileSync(obj, 'utf8'), c.text, 'exact multibyte whole bytes');
  assert.deepEqual(calls.reads.map((r) => r.reference), ['ref-f09-F09B']);
  assert.equal(f09CycleAppendBytes(calls), Buffer.byteLength(c.text) - appendedBytes, 'suffix only');
  assert.ok(!calls.exec.some((cmd) => cmd.includes("'spool-begin'")), 'no second upload identity');
  assert.equal(readdirSync(join(root, 'spool')).length, 0, 'no leaked spool state');
  rmSync(root, { recursive: true, force: true });
});

// Crash windows around the implicit part commit and publication: after part
// commit (UPLOADING, completed shape), after the PUBLISHING intent save, and
// after the object rename (PUBLISHED, ingest missing). Every window must
// finish through idempotent spool-finish — ZERO source refetch, ZERO new
// append, never a second upload. The INGESTED-before-reap window (durable
// ingest proof present) must be offered to NOTHING.
test('F09 crash windows: part-commit / PUBLISHING / PUBLISHED finish without source reappend; INGESTED-before-reap is not re-offered', async () => {
  for (const window of ['part-commit', 'PUBLISHING', 'PUBLISHED', 'INGESTED']) {
    const root = freshRoot();
    const c = implicitCase('F09W');
    const { uploadId: up } = f09BeginPartial(root, c, c.text);
    const statePath = f09StatePath(root, up);
    const wholeTmp = join(root, 'spool', `${up}.whole.tmp`);
    const partTmp = join(root, 'spool', `${up}.part0.tmp`);
    const target = join(root, 'objects', `${c.manifest.sha256}.json`);
    const committedState = {
      phase: 'UPLOADING', current_part: null, next_ordinal: 1,
      committed_offset: Buffer.byteLength(c.text),
      retained_part: { ordinal: 0, sha256: c.manifest.sha256, bytes: c.manifest.bytes },
    };

    if (window === 'INGESTED') {
      // run the real finish (publish + ingest), then recreate the state file
      // the crash left between the INGESTED save and the state reap
      const st = JSON.parse(readFileSync(statePath, 'utf8'));
      cliJson(['spool-finish', '--root', root, '--upload-id', up, '--producer-role', 'collector']);
      writeFileSync(statePath, JSON.stringify({ ...st, ...committedState, phase: 'INGESTED' }));
    } else {
      // hand-craft the exact post-crash disk shape one step past the append
      writeFileSync(wholeTmp, c.text);
      if (window !== 'part-commit') {
        Object.assign(committedState, { phase: window });
        if (window === 'PUBLISHED') {
          mkdirSync(dirname(target), { recursive: true });
          renameSync(wholeTmp, target);
        }
      }
      writeFileSync(statePath, JSON.stringify({ ...JSON.parse(readFileSync(statePath, 'utf8')), ...committedState }));
      rmSync(partTmp, { force: true }); // commitPart unlinks it before the intent save
    }

    const { tools, calls } = makeTools({ polls: [], pages: c.pages });
    const { result } = await runBody(root, tools);
    assertResultShape(result);
    assert.ok(existsSync(target), `${window}: object published`);
    assert.equal(readFileSync(target, 'utf8'), c.text, `${window}: exact whole bytes`);
    assert.equal(calls.reads.length, 0, `${window}: zero source refetch`);
    assert.equal(f09CycleAppendBytes(calls), 0, `${window}: zero reappend`);
    assert.ok(!calls.exec.some((cmd) => cmd.includes("'spool-begin'")), `${window}: no second upload identity`);
    assert.ok(!result.blockers.some((b) => b.code === 'SPOOL_UPLOAD_STATE' || b.code === 'SPOOL_HASH_MISMATCH'), `${window}: no wrong-action blocker`);
    if (window === 'INGESTED') {
      // durable ingest proof: the state file is not offered for recovery at all
      assert.ok(existsSync(statePath), 'INGESTED window: crash-image state untouched');
      assert.ok(!calls.exec.some((cmd) => cmd.includes(up)), 'INGESTED window: upload never touched');
    } else {
      assert.equal(readdirSync(join(root, 'spool')).filter((n) => n.endsWith('.state.json')).length, 0, `${window}: state reaped`);
    }
    rmSync(root, { recursive: true, force: true });
  }
});

// Fail-closed arm: a torn byte offset, a drifted source, and a contradictory
// commit image each hold with the ORIGINAL state retained — and the manifest
// is never re-begun behind the held upload (one upload identity).
test('F09 holds: torn offset / drifted source / contradictory commit fail closed with the state retained, never a second upload', async () => {
  // arm 1 — torn multibyte write at the appended offset
  {
    const root = freshRoot();
    const c = implicitCase('F09H1', { multibyte: true });
    const { uploadId: up } = f09BeginPartial(root, c, f09Chunks(c.text)[0]);
    // overwrite the part temp with a prefix that CUTS a multibyte character
    const buf = Buffer.from(c.text, 'utf8');
    let walk = 0;
    let torn = -1;
    for (const ch of c.text) {
      const b = Buffer.byteLength(ch);
      if (b > 1) { torn = walk + 1; break; }
      walk += b;
    }
    assert.ok(torn > 0, 'fixture has a multibyte character');
    const partTmp = join(root, 'spool', `${up}.part0.tmp`);
    const tornPrefix = buf.subarray(0, torn);
    writeFileSync(partTmp, tornPrefix);

    const { tools, calls } = makeTools({ polls: [], pages: c.pages });
    const { result } = await runBody(root, tools);
    assertResultShape(result);
    assert.ok(result.blockers.some((b) => b.code === 'SPOOL_RESUME_UNSUPPORTED'), 'torn offset holds');
    assert.ok(!existsSync(join(root, 'objects', `${c.manifest.sha256}.json`)), 'nothing published');
    assert.equal(f09CycleAppendBytes(calls), 0, 'no append on a torn offset');
    assert.ok(!calls.exec.some((cmd) => cmd.includes("'spool-begin'")), 'no second upload identity');
    assert.ok(existsSync(f09StatePath(root, up)), 'original state retained');
    assert.deepEqual(readFileSync(partTmp), tornPrefix, 'torn temp bytes untouched');
    rmSync(root, { recursive: true, force: true });
  }

  // arm 2 — the reference now returns DIFFERENT bytes than the descriptor
  {
    const root = freshRoot();
    const c = implicitCase('F09H2');
    f09BeginPartial(root, c, f09Chunks(c.text)[0]);
    const drifted = c.text.replace('bridge f09 fixture', 'drifted f09 fixture');
    assert.notEqual(sha256Of(drifted), c.manifest.sha256);

    const { tools, calls } = makeTools({ polls: [], pages: { 'ref-f09-F09H2': drifted } });
    const { result } = await runBody(root, tools);
    assertResultShape(result);
    assert.ok(result.blockers.some((b) => b.code === 'PART_DESCRIPTOR_MISMATCH'), 'drifted source holds');
    assert.ok(!result.blockers.some((b) => b.code === 'SPOOL_RESUME_UNSUPPORTED'));
    assert.equal(f09CycleAppendBytes(calls), 0, 'no append against a drifted source');
    assert.ok(!existsSync(join(root, 'objects', `${c.manifest.sha256}.json`)), 'nothing published');
    assert.ok(!calls.exec.some((cmd) => cmd.includes("'spool-begin'")), 'no second upload identity');
    const st = readdirSync(join(root, 'spool')).filter((n) => n.endsWith('.state.json'));
    assert.equal(st.length, 1, 'original state retained');
    rmSync(root, { recursive: true, force: true });
  }

  // arm 3 — contradictory UPLOADING image: committed bytes without the
  // in-flight part, and not the exact whole size an implicit commit produces
  {
    const root = freshRoot();
    const c = implicitCase('F09H3');
    const { uploadId: up } = f09BeginPartial(root, c, f09Chunks(c.text)[0]);
    const st = JSON.parse(readFileSync(f09StatePath(root, up), 'utf8'));
    writeFileSync(f09StatePath(root, up), JSON.stringify({
      ...st, current_part: null, next_ordinal: 1, committed_offset: 12345,
    }));

    const { tools, calls } = makeTools({ polls: [], pages: c.pages });
    const { result } = await runBody(root, tools);
    assertResultShape(result);
    assert.ok(result.blockers.some((b) => b.code === 'SPOOL_RESUME_UNSUPPORTED'), 'contradictory commit image holds');
    assert.equal(calls.reads.length, 0, 'no source fetch for a contradictory state');
    assert.equal(f09CycleAppendBytes(calls), 0);
    assert.ok(!existsSync(join(root, 'objects', `${c.manifest.sha256}.json`)), 'nothing published');
    assert.ok(!calls.exec.some((cmd) => cmd.includes("'spool-begin'")), 'no second upload identity');
    assert.ok(existsSync(f09StatePath(root, up)), 'original state retained');
    rmSync(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------- §8 Page fallback

// Sanitized real tool-result shapes (F04 item 4): opaque ref syntax exactly
// as the supported tool returns it, actual nested selection/markdown fields.
function realPageResult({ pageId, markdown, selectionComplete = true }) {
  return {
    page_id: pageId,
    selection: { selection_complete: selectionComplete },
    content: { blocks: [{ markdown }] },
  };
}

function fallbackCase(tag) {
  const c = smallCase(tag, `COLLECTOR-INDEX-FB${tag}`);
  const target = `library-file:/sources/${c.generation}.json`;
  return {
    ...c,
    target,
    pages: { ...c.pages, [target]: c.page0Text },
    locatorIndex: { ...c.locatorIndex, reference: 'library-file', page_id: PAGE_REG.collector },
    pageSearch: () => realPageResult({
      pageId: PAGE_REG.collector,
      markdown: `Index directory\n\n[${c.generation}.json](${target})\n`,
    }),
  };
}

test('Page fallback: library-file locator resolves via read_page search, verify, import; cursor preserved', async () => {
  const root = freshRoot();
  const c = fallbackCase('F1');
  const polls = [pollFor('collector', 'cur-fb-1', locatorLine({ generation: c.generation, index: c.locatorIndex }))];
  const { tools, calls } = makeTools({ polls, pages: c.pages, pageSearch: c.pageSearch });
  const { result } = await runBody(root, tools);
  assertResultShape(result);
  assert.equal(result.state, 'PROGRESSED');
  assert.equal(result.counts.sources, 1);
  // ONE read_page call, exact shape
  assert.equal(calls.readPage.length, 1);
  assert.deepEqual(calls.readPage[0], {
    page_id: PAGE_REG.collector,
    search: [`${c.generation}.json`],
    context_blocks: 0,
  });
  // then exactly one verified read_page_reference of the linked target
  assert.deepEqual(calls.reads.map((r) => r.reference), [c.target, `ref-sm-F1`]);
  assert.equal(cliJson(['plan', '--root', root]).committed_cursors.collector, 'cur-fb-1');
  assert.ok(existsSync(join(root, 'sources', `${c.locatorIndex.sha256}.json`)));
  rmSync(root, { recursive: true, force: true });
});

test('Page fallback ambiguity: five candidate links -> INDEX_REF_AMBIGUOUS, nothing imported, cursor held', async () => {
  const root = freshRoot();
  const c = fallbackCase('F2');
  const links = Array.from({ length: 5 }, (_, i) => `[${c.generation}.json](library-file:/sources/${c.generation}-${i}.json)`).join('\n');
  const { result } = await runBody(root, makeTools({
    polls: [pollFor('collector', 'cur-fb-2', locatorLine({ generation: c.generation, index: c.locatorIndex }))],
    pages: c.pages,
    pageSearch: () => realPageResult({ pageId: PAGE_REG.collector, markdown: links }),
  }).tools);
  assertResultShape(result);
  assert.ok(result.blockers.some((b) => b.code === 'INDEX_REF_AMBIGUOUS'));
  assert.equal(cliJson(['plan', '--root', root]).committed_cursors.collector, undefined);
  rmSync(root, { recursive: true, force: true });
});

test('Page fallback unresolved: links whose bytes do not match the descriptor -> INDEX_REF_UNRESOLVED', async () => {
  const root = freshRoot();
  const c = fallbackCase('F3');
  const badTarget = `library-file:/sources/${c.generation}-stale.json`;
  const pages = { ...c.pages, [badTarget]: '{"version":1,"stale":true}' };
  const { result } = await runBody(root, makeTools({
    polls: [pollFor('collector', 'cur-fb-3', locatorLine({ generation: c.generation, index: c.locatorIndex }))],
    pages,
    pageSearch: () => realPageResult({ pageId: PAGE_REG.collector, markdown: `[${c.generation}.json](${badTarget})` }),
  }).tools);
  assertResultShape(result);
  assert.ok(result.blockers.some((b) => b.code === 'INDEX_REF_UNRESOLVED'));
  assert.equal(cliJson(['plan', '--root', root]).committed_cursors.collector, undefined);
  rmSync(root, { recursive: true, force: true });
});

test('Page fallback gated: registry mismatch never triggers read_page for a foreign role page', async () => {
  const root = freshRoot();
  // analyst locator pointing at the COLLECTOR registry page -> not its own
  const c = smallCase('F4A', 'ANALYST-INDEX-F4A');
  c.manifest.producer = CHAT_IDS.analyst;
  c.page0.producer = CHAT_IDS.analyst;
  const pageText = JSON.stringify(c.page0);
  const idx = { page_id: PAGE_REG.collector, reference: 'library-file', sha256: sha256Of(pageText), bytes: Buffer.byteLength(pageText) };
  let readPageCalls = 0;
  const { tools } = makeTools({
    polls: [pollFor('analyst', 'cur-f4-1', locatorLine({ role: 'analyst', generation: c.generation, index: idx }))],
    pages: {},
    pageSearch: () => { readPageCalls += 1; return null; },
  });
  const { result } = await runBody(root, tools);
  assertResultShape(result);
  assert.ok(result.blockers.some((b) => b.code === 'INDEX_REF_UNRESOLVED' || b.code === 'INDEX_PAGE_LOOKUP_FAILED'));
  assert.equal(readPageCalls, 0, 'fallback must not fire for a foreign registry page');
  rmSync(root, { recursive: true, force: true });
});

test('Page fallback cross-scheme: a library-file type-label resolves via a project-file:/ link target (PAGE-FALLBACK)', async () => {
  const root = freshRoot();
  const c = smallCase('F5', 'COLLECTOR-INDEX-FB-F5');
  const target = `project-file:/x/${c.generation}.json`;
  const pages = { ...c.pages, [target]: c.page0Text };
  const idx = { ...c.locatorIndex, reference: 'library-file', page_id: PAGE_REG.collector };
  const { tools, calls } = makeTools({
    polls: [pollFor('collector', 'cur-fb-5', locatorLine({ generation: c.generation, index: idx }))],
    pages,
    pageSearch: () => realPageResult({ pageId: PAGE_REG.collector, markdown: `dir [${c.generation}.json](${target})` }),
  });
  const { result } = await runBody(root, tools);
  assertResultShape(result);
  assert.equal(result.state, 'PROGRESSED');
  assert.equal(result.counts.sources, 1);
  // EITHER full scheme is a candidate — not confined to the literal type-label
  assert.deepEqual(calls.reads.map((r) => r.reference), [target, 'ref-sm-F5']);
  assert.ok(existsSync(join(root, 'sources', `${idx.sha256}.json`)));
  rmSync(root, { recursive: true, force: true });
});

test('arbitrary non-scheme references are refused with ZERO fetches of any kind (PAGE-FALLBACK)', async () => {
  const root = freshRoot();
  const c = smallCase('F6', 'COLLECTOR-INDEX-FB-F6');
  const idx = { ...c.locatorIndex, reference: 'http://evil.example/x' };
  const { tools, calls } = makeTools({
    polls: [pollFor('collector', 'cur-fb-6', locatorLine({ generation: c.generation, index: idx }))],
    pages: c.pages,
  });
  const { result } = await runBody(root, tools);
  assertResultShape(result);
  assert.ok(result.blockers.some((b) => b.code === 'INDEX_REF_UNRESOLVED'), 'arbitrary ref must be refused');
  assert.equal(calls.reads.length, 0, 'no read_page_reference for an arbitrary ref');
  assert.equal(calls.readPage.length, 0, 'no read_page fallback for an arbitrary ref');
  assert.equal(cliJson(['plan', '--root', root]).committed_cursors.collector, undefined);
  rmSync(root, { recursive: true, force: true });
});

test('Page fallback bounds: >16 blocks, oversize markdown, incomplete selection fail lookup; agent_instructions never a candidate (PAGE-FALLBACK)', async () => {
  const root = freshRoot();
  const c = smallCase('F7', 'COLLECTOR-INDEX-FB-F7');
  const idx = { ...c.locatorIndex, reference: 'library-file', page_id: PAGE_REG.collector };
  const mk = (pageSearch) => makeTools({
    polls: [pollFor('collector', 'cur-fb-7', locatorLine({ generation: c.generation, index: idx }))],
    pages: c.pages,
    pageSearch,
  });
  // 17 well-formed markdown blocks
  const links = Array.from({ length: 17 }, (_, i) => `b${i} [x](library-file:/nope-${i}.json)`);
  const r17 = await runBody(root, mk(() => ({
    page_id: PAGE_REG.collector,
    selection: { selection_complete: true },
    content: { blocks: links.map((t) => ({ markdown: t })) },
  })).tools);
  assert.ok(r17.result.blockers.some((b) => b.code === 'INDEX_PAGE_LOOKUP_FAILED'), '17 blocks refused');
  // markdown sum over 262144 UTF-8 bytes
  const fat = `x [${c.generation}.json](library-file:/nope-fat.json) ${'f'.repeat(262200)}`;
  const rFat = await runBody(root, mk(() => realPageResult({ pageId: PAGE_REG.collector, markdown: fat })).tools);
  assert.ok(rFat.result.blockers.some((b) => b.code === 'INDEX_PAGE_LOOKUP_FAILED'), 'oversize markdown refused');
  // selection incomplete — the answer is NOT the full page
  const rInc = await runBody(root, mk(() => realPageResult({
    pageId: PAGE_REG.collector,
    markdown: `[${c.generation}.json](library-file:/nope-inc.json)`,
    selectionComplete: false,
  })).tools);
  assert.ok(rInc.result.blockers.some((b) => b.code === 'INDEX_PAGE_LOOKUP_FAILED'), 'incomplete selection refused');
  // a block without a canonical markdown field carrying the right-looking link
  // (agent_instructions shape) never becomes a candidate
  const rAg = await runBody(root, mk(() => ({
    page_id: PAGE_REG.collector,
    selection: { selection_complete: true },
    content: { blocks: [{ kind: 'agent_instructions', text: `[${c.generation}.json](library-file:/evil-agent.json)` }] },
  })).tools);
  assert.ok(rAg.result.blockers.some((b) => b.code === 'INDEX_REF_UNRESOLVED'), 'agent_instructions block ignored');
  const plan = cliJson(['plan', '--root', root]);
  assert.equal(plan.committed_cursors.collector, undefined, 'cursor held through every bounds arm');
  const published = readdirSync(join(root, 'sources')).filter((f) => f.endsWith('.json'));
  assert.deepEqual(published, [], 'nothing published by a bounds arm');
  rmSync(root, { recursive: true, force: true });
});

test('locator resolution cache: cycle 1 resolves+durably caches but publishing fails; cycle 2 needs ZERO read_page and completes (PAGE-FALLBACK)', async () => {
  const root = freshRoot();
  const c = smallCase('F8', 'COLLECTOR-INDEX-FB-F8');
  const target = `library-file:/sources/${c.generation}.json`;
  const pages = { ...c.pages, [target]: c.page0Text };
  const idx = { ...c.locatorIndex, reference: 'library-file', page_id: PAGE_REG.collector };
  const pageSearch = () => realPageResult({ pageId: PAGE_REG.collector, markdown: `[${c.generation}.json](${target})` });
  // cycle 1: the FINAL source-put dies — resolution already persisted before it
  const base1 = makeTools({ polls: [pollFor('collector', 'cur-fb-8a', locatorLine({ generation: c.generation, index: idx }))], pages, pageSearch });
  const tools1 = {
    ...base1.tools,
    exec_command: async (arg) => {
      const cmd = String(arg?.cmd ?? '');
      if (cmd.includes("'source-put'") && cmd.includes("'--final' 'true'")) {
        return { exit_code: 1, output: JSON.stringify({ ok: false, code: 'SOURCE_HASH_MISMATCH' }) };
      }
      return base1.tools.exec_command(arg);
    },
  };
  const r1 = await runBody(root, tools1);
  assertResultShape(r1.result);
  assert.ok(r1.result.blockers.some((b) => b.code === 'SOURCE_HASH_MISMATCH'), 'cycle 1 fails at publish');
  const pl1 = cliJson(['plan', '--root', root]);
  assert.equal(pl1.locator_resolutions.length, 1, 'resolution persisted before the failed publish');
  assert.equal(pl1.locator_resolutions[0].reference, target);
  assert.ok(!existsSync(join(root, 'sources', `${idx.sha256}.json`)), 'source NOT published in cycle 1');
  // cycle 2: the producer re-announces; the durable cache answers — read_page NEVER fires
  const polls2 = [pollFor('collector', 'cur-fb-8b', locatorLine({ generation: c.generation, index: idx }))];
  const second = makeTools({ polls: polls2, pages, pageSearch });
  const r2 = await runBody(root, second.tools);
  assertResultShape(r2.result);
  assert.ok(!r2.result.blockers.some((b) => b.code === 'INDEX_PAGE_LOOKUP_FAILED' || b.code === 'INDEX_REF_UNRESOLVED'));
  assert.equal(second.calls.readPage.length, 0, 'cached resolution skips read_page entirely');
  assert.deepEqual(second.calls.reads.map((r) => r.reference), [target, 'ref-sm-F8'], 'cached ref fetched + verified exactly once');
  assert.ok(existsSync(join(root, 'sources', `${idx.sha256}.json`)), 'source published in cycle 2');
  assert.equal(readFileSync(join(root, 'sources', `${idx.sha256}.json`), 'utf8'), c.page0Text);
  assert.equal(cliJson(['plan', '--root', root]).committed_cursors.collector, 'cur-fb-8b');
  rmSync(root, { recursive: true, force: true });
});

// ------------------------------------------------- F04: PAGES_ADAPTER_CONTRACT
// Real opaque Library references (library-file:fde1_..., no slash) and the
// real nested read_page fields (selection.selection_complete, blocks[].markdown)
// are the ONLY accepted forms — degenerate refs, wrong pages and explicit
// denials stay blocked, and a denial never authorizes an inline fallback.

test('F04: real opaque library-file:fde1_... reference resolves on the fast path with exact hash/size', async () => {
  const root = freshRoot();
  const c = smallCase('F04A', 'COLLECTOR-INDEX-F04A');
  const opaque = `library-file:fde1_${c.generation}`;
  const pages = { ...c.pages, [opaque]: c.page0Text };
  const idx = { ...c.locatorIndex, reference: opaque };
  const { tools, calls } = makeTools({
    polls: [pollFor('collector', 'cur-f04-a', locatorLine({ generation: c.generation, index: idx }))],
    pages,
  });
  const { result } = await runBody(root, tools);
  assertResultShape(result);
  assert.equal(result.state, 'PROGRESSED');
  assert.equal(result.counts.sources, 1);
  // the opaque target is fetched DIRECTLY — a slash was never part of the grammar
  assert.deepEqual(calls.reads.map((r) => r.reference), [opaque, 'ref-sm-F04A']);
  assert.equal(calls.readPage.length, 0, 'fast path never fires the Page fallback');
  assert.equal(readFileSync(join(root, 'sources', `${idx.sha256}.json`), 'utf8'), c.page0Text, 'exact descriptor bytes published');
  assert.equal(cliJson(['plan', '--root', root]).committed_cursors.collector, 'cur-f04-a');
  rmSync(root, { recursive: true, force: true });
});

test('F04: real opaque project-file target resolves identically (either scheme, slash never required)', async () => {
  const root = freshRoot();
  const c = smallCase('F04B', 'COLLECTOR-INDEX-F04B');
  const opaque = `project-file:fde1_${c.generation}`;
  const pages = { ...c.pages, [opaque]: c.page0Text };
  const idx = { ...c.locatorIndex, reference: opaque };
  const { tools, calls } = makeTools({
    polls: [pollFor('collector', 'cur-f04-b', locatorLine({ generation: c.generation, index: idx }))],
    pages,
  });
  const { result } = await runBody(root, tools);
  assertResultShape(result);
  assert.equal(result.state, 'PROGRESSED');
  assert.equal(result.counts.sources, 1);
  assert.deepEqual(calls.reads.map((r) => r.reference), [opaque, 'ref-sm-F04B']);
  assert.equal(readFileSync(join(root, 'sources', `${idx.sha256}.json`), 'utf8'), c.page0Text);
  rmSync(root, { recursive: true, force: true });
});

test('F04: real nested read_page shape resolves the bare label with exact hash/size', async () => {
  const root = freshRoot();
  const c = smallCase('F04C', 'COLLECTOR-INDEX-F04C');
  const target = `library-file:fde1_${c.generation}`;
  const pages = { ...c.pages, [target]: c.page0Text };
  const idx = { ...c.locatorIndex, reference: 'library-file', page_id: PAGE_REG.collector };
  const { tools, calls } = makeTools({
    polls: [pollFor('collector', 'cur-f04-c', locatorLine({ generation: c.generation, index: idx }))],
    pages,
    pageSearch: () => realPageResult({
      pageId: PAGE_REG.collector,
      markdown: `Index directory\n\n[${c.generation}.json](${target})\n`,
    }),
  });
  const { result } = await runBody(root, tools);
  assertResultShape(result);
  assert.equal(result.state, 'PROGRESSED');
  assert.equal(result.counts.sources, 1);
  assert.equal(calls.readPage.length, 1);
  assert.deepEqual(calls.readPage[0], {
    page_id: PAGE_REG.collector,
    search: [`${c.generation}.json`],
    context_blocks: 0,
  });
  // the opaque link target is a full candidate and verifies exactly
  assert.deepEqual(calls.reads.map((r) => r.reference), [target, 'ref-sm-F04C']);
  assert.equal(readFileSync(join(root, 'sources', `${idx.sha256}.json`), 'utf8'), c.page0Text);
  assert.equal(cliJson(['plan', '--root', root]).committed_cursors.collector, 'cur-f04-c');
  rmSync(root, { recursive: true, force: true });
});

test('F04: analyst fallback requests the exact authorized Page ID (registry-corrected)', async () => {
  const root = freshRoot();
  const generation = 'ANALYST-INDEX-F04D';
  const page0 = { version: 1, producer: CHAT_IDS.analyst, generation, page_number: 0, items: [], next: null };
  const pageText = JSON.stringify(page0);
  const target = `library-file:fde1_${generation}`;
  const idx = { page_id: PAGE_REG.analyst, reference: 'library-file', sha256: sha256Of(pageText), bytes: Buffer.byteLength(pageText) };
  const { tools, calls } = makeTools({
    polls: [pollFor('analyst', 'cur-f04-d', locatorLine({ role: 'analyst', generation, index: idx }))],
    pages: { [target]: pageText },
    pageSearch: () => realPageResult({ pageId: PAGE_REG.analyst, markdown: `[${generation}.json](${target})` }),
  });
  const { result } = await runBody(root, tools);
  assertResultShape(result);
  assert.equal(result.state, 'PROGRESSED');
  assert.equal(result.counts.sources, 1);
  assert.equal(calls.readPage.length, 1);
  assert.equal(calls.readPage[0].page_id, 'page_955c5f291f78819199e9ba5da85bee76', 'the exact authorized analyst Page ID');
  assert.deepEqual(calls.reads.map((r) => r.reference), [target], 'opaque target fetched and verified');
  rmSync(root, { recursive: true, force: true });
});

test('F04: empty payload, wrong Page, incomplete selection, ambiguity, wrong hash/size and explicit denials stay blocked', async () => {
  const root = freshRoot();
  const cursorHeld = () => cliJson(['plan', '--root', root]).committed_cursors;
  const published = () => readdirSync(join(root, 'sources')).filter((f) => f.endsWith('.json'));

  // empty scheme payload: neither a full reference nor the bare type label
  {
    const c = smallCase('F04E1', 'COLLECTOR-INDEX-F04E1');
    const idx = { ...c.locatorIndex, reference: 'library-file:' };
    const { tools, calls } = makeTools({
      polls: [pollFor('collector', 'cur-f04-e1', locatorLine({ generation: c.generation, index: idx }))],
      pages: { 'library-file:': 'evil' },
    });
    const { result } = await runBody(root, tools);
    assertResultShape(result);
    assert.ok(result.blockers.some((b) => b.code === 'INDEX_REF_UNRESOLVED'), 'empty scheme payload refused');
    assert.equal(calls.reads.length, 0, 'no fetch for an empty payload');
    assert.equal(calls.readPage.length, 0, 'no fallback for an empty payload');
  }
  // wrong Page: bare label whose page_id is not the role's registry entry
  {
    const c = smallCase('F04E2', 'COLLECTOR-INDEX-F04E2');
    const idx = { ...c.locatorIndex, reference: 'library-file', page_id: 'page_someone_elses' };
    const { tools, calls } = makeTools({
      polls: [pollFor('collector', 'cur-f04-e2', locatorLine({ generation: c.generation, index: idx }))],
      pages: {},
    });
    const { result } = await runBody(root, tools);
    assertResultShape(result);
    assert.ok(result.blockers.some((b) => b.code === 'INDEX_REF_UNRESOLVED'), 'foreign registry page refused');
    assert.equal(calls.readPage.length, 0, 'fallback never fires for a foreign page');
  }
  // incomplete selection in the REAL nested shape — the answer is not the page
  {
    const c = smallCase('F04E3', 'COLLECTOR-INDEX-F04E3');
    const idx = { ...c.locatorIndex, reference: 'library-file', page_id: PAGE_REG.collector };
    const { tools } = makeTools({
      polls: [pollFor('collector', 'cur-f04-e3', locatorLine({ generation: c.generation, index: idx }))],
      pages: c.pages,
      pageSearch: () => realPageResult({
        pageId: PAGE_REG.collector,
        markdown: `[${c.generation}.json](library-file:fde1_${c.generation})`,
        selectionComplete: false,
      }),
    });
    const { result } = await runBody(root, tools);
    assertResultShape(result);
    assert.ok(result.blockers.some((b) => b.code === 'INDEX_PAGE_LOOKUP_FAILED'), 'incomplete selection refused');
  }
  // ambiguity: five distinct opaque candidates
  {
    const c = smallCase('F04E4', 'COLLECTOR-INDEX-F04E4');
    const idx = { ...c.locatorIndex, reference: 'library-file', page_id: PAGE_REG.collector };
    const links = Array.from({ length: 5 }, (_, i) => `[${c.generation}.json](library-file:fde1_${c.generation}-${i})`).join('\n');
    const { tools } = makeTools({
      polls: [pollFor('collector', 'cur-f04-e4', locatorLine({ generation: c.generation, index: idx }))],
      pages: {},
      pageSearch: () => realPageResult({ pageId: PAGE_REG.collector, markdown: links }),
    });
    const { result } = await runBody(root, tools);
    assertResultShape(result);
    assert.ok(result.blockers.some((b) => b.code === 'INDEX_REF_AMBIGUOUS'), 'ambiguous evidence refused');
  }
  // wrong hash/size: the opaque target resolves but its bytes are not the descriptor's
  {
    const c = smallCase('F04E5', 'COLLECTOR-INDEX-F04E5');
    const target = `library-file:fde1_${c.generation}`;
    const idx = { ...c.locatorIndex, reference: 'library-file', page_id: PAGE_REG.collector };
    const { tools } = makeTools({
      polls: [pollFor('collector', 'cur-f04-e5', locatorLine({ generation: c.generation, index: idx }))],
      pages: { [target]: '{"version":1,"stale":true}' },
      pageSearch: () => realPageResult({ pageId: PAGE_REG.collector, markdown: `[${c.generation}.json](${target})` }),
    });
    const { result } = await runBody(root, tools);
    assertResultShape(result);
    assert.ok(result.blockers.some((b) => b.code === 'INDEX_REF_UNRESOLVED'), 'digest mismatch is not a resolution');
  }
  // explicit denial on the FAST PATH: fixed hold, never a demotion to fallback
  {
    const c = smallCase('F04E6', 'COLLECTOR-INDEX-F04E6');
    const opaque = `library-file:fde1_${c.generation}`;
    const idx = { ...c.locatorIndex, reference: opaque };
    const { tools, calls } = makeTools({
      polls: [pollFor('collector', 'cur-f04-e6', locatorLine({ generation: c.generation, index: idx }))],
      pages: { [opaque]: c.page0Text },
      refShapes: { [opaque]: { content: [{ type: 'text', text: 'access denied by policy' }], isError: true } },
    });
    const { result } = await runBody(root, tools);
    assertResultShape(result);
    assert.ok(result.blockers.some((b) => b.code === 'SOURCE_READ_FAILED'), 'explicit denial is a fixed hold');
    assert.equal(calls.readPage.length, 0, 'a denied full reference never falls back inline');
  }
  // explicit denial of the fallback search itself: lookup hold, nothing published
  {
    const c = smallCase('F04E7', 'COLLECTOR-INDEX-F04E7');
    const idx = { ...c.locatorIndex, reference: 'library-file', page_id: PAGE_REG.collector };
    const { tools, calls } = makeTools({
      polls: [pollFor('collector', 'cur-f04-e7', locatorLine({ generation: c.generation, index: idx }))],
      pages: c.pages,
      pageSearchRaw: () => ({ content: [{ type: 'text', text: 'access denied by policy' }], isError: true }),
    });
    const { result } = await runBody(root, tools);
    assertResultShape(result);
    assert.ok(result.blockers.some((b) => b.code === 'INDEX_PAGE_LOOKUP_FAILED'), 'denied search is a lookup hold');
    assert.equal(calls.reads.length, 0, 'no candidate fetch after a denial');
  }
  // every arm held the cursor and published nothing
  const cursors = cursorHeld();
  for (const role of ['collector', 'analyst', 'solver']) {
    assert.equal(cursors[role], undefined, `cursor held for ${role} through every blocked arm`);
  }
  assert.deepEqual(published(), [], 'nothing published by a blocked arm');
  rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------- R02-SOURCE

// Every malformed read_page_reference shape is refused INSIDE the adapter with
// its own fixed code, before any spool/publication. Crafted responses LIE about
// sha256/byte_size where possible (echoing the descriptor) so the only reject
// reason left is the shape itself — the old body sailed past these into a later
// CLI hash failure instead.
test('readRef rejects every malformed source shape with fixed codes; nothing published, cursor held (R02)', async () => {
  const root = freshRoot();
  const lone = '\uD800xx'; // 1 lone high surrogate + 'xx' (Node counts 5 replacement bytes)
  const variants = [
    { tag: 'iserror', code: 'SOURCE_READ_FAILED', resp: { content: [{ type: 'text', text: 'transport refused' }], isError: true } },
    { tag: 'nosc', code: 'SOURCE_READ_FAILED', resp: { content: [{ type: 'text', text: 'no structured content' }] } },
    { tag: 'kind', code: 'SOURCE_READ_FAILED', sc: { kind: 'markdown', text_representation: 'source', text: 'swapped' } },
    { tag: 'repr', code: 'SOURCE_READ_FAILED', sc: { kind: 'text', text_representation: 'extracted', text: 'swapped' } },
    { tag: 'pageid', code: 'SOURCE_READ_FAILED', sc: { kind: 'text', text_representation: 'source', text: 'swapped', page_id: 'page-elsewhere' } },
    { tag: 'refecho', code: 'SOURCE_READ_FAILED', sc: { kind: 'text', text_representation: 'source', text: 'swapped', reference: 'ref-elsewhere' } },
    { tag: 'sha', code: 'SOURCE_READ_FAILED', sc: { kind: 'text', text_representation: 'source', text: 'swapped', sha256: 'not-hex' } },
    { tag: 'bytes', code: 'SOURCE_READ_FAILED', sc: { kind: 'text', text_representation: 'source', text: 'swapped', byte_size: 5 } },
    { tag: 'range', code: 'SOURCE_READ_FAILED', sc: { kind: 'text', text_representation: 'source', text: 'swapped', byte_size: 300000 } },
    { tag: 'surrogate', code: 'SOURCE_NOT_UTF8', sc: { kind: 'text', text_representation: 'source', text: lone, byte_size: 5 } },
  ];
  const refShapes = {};
  const specs = variants.map((v, i) => {
    const role = ['collector', 'analyst', 'solver'][i % 3];
    const gen = `REJ-${String(i).padStart(2, '0')}-GEN`;
    const pageText = JSON.stringify({ version: 1, producer: CHAT_IDS[role], generation: gen, page_number: 0, items: [], next: null });
    const desc = { page_id: `ix-r${i}`, reference: `library-file:/rej/${i}.json`, sha256: sha256Of(pageText), bytes: Buffer.byteLength(pageText) };
    const resp = v.resp ?? {
      structuredContent: {
        kind: v.sc.kind, text_representation: v.sc.text_representation, text: v.sc.text,
        page_id: v.sc.page_id ?? desc.page_id, reference: v.sc.reference ?? desc.reference,
        sha256: v.sc.sha256 ?? desc.sha256, // LIE: echo the descriptor hash
        byte_size: v.sc.byte_size ?? Buffer.byteLength(v.sc.text),
      },
    };
    refShapes[`library-file:/rej/${i}.json`] = resp;
    return { role, gen, desc, code: v.code, tag: v.tag };
  });

  // at most one poll per thread per wait (public shape): 3 variants per cycle
  const seen = [];
  const totalReads = { reads: 0 };
  for (let base = 0; base < specs.length; base += 3) {
    const group = specs.slice(base, base + 3);
    const byRole = new Map();
    for (const s of group) byRole.set(s.role, s); // same role twice inside 3 consecutive can't happen (round-robin)
    const polls = group.map((s, j) => pollFor(s.role, `cur-rej-${base + j}`, locatorLine({ role: s.role, generation: s.gen, index: s.desc })));
    const { tools, calls } = makeTools({ polls, refShapes });
    const { result } = await runBody(root, tools);
    assertResultShape(result);
    totalReads.reads += calls.reads.length;
    for (const b of result.blockers) seen.push(`${b.code}|${b.event_id}`);
  }
  for (const s of specs) {
    assert.ok(seen.includes(`${s.code}|${s.gen}`), `variant ${s.tag} must surface ${s.code} (got: ${seen.join(' ; ')})`);
  }
  assert.equal(totalReads.reads, specs.length, 'every variant attempted exactly one read');
  const plan = cliJson(['plan', '--root', root]);
  for (const role of ['collector', 'analyst', 'solver']) {
    assert.equal(plan.committed_cursors[role], undefined, `cursor held for ${role}`);
  }
  const published = readdirSync(join(root, 'sources')).filter((f) => f.endsWith('.json'));
  assert.deepEqual(published, [], 'no source object published from a malformed response');
  rmSync(root, { recursive: true, force: true });
});

// R01 review partial folded into Slice B: the pure counter/chunker REJECTS lone
// surrogates (they would silently encode as U+FFFD replacements and corrupt
// exact-byte replay) instead of rewriting the original bytes.
test('pure UTF-8 counter/chunker rejects lone surrogates without rewriting bytes; valid pairs still work', async () => {
  const source = readFileSync(BODY_PATH, 'utf8');
  const probeSrc = source.replace(/return await runBridge\(\{tools,config,emit\}\);\s*$/, 'return { utf8Len, chunkByBytes };');
  const probe = new RestrictedAsyncFunction('tools', 'config', 'emit', probeSrc);
  const api = await probe({}, {}, () => {});
  // cross-realm prototypes are not the contract — round-trip like the harness
  const chunksOf = (text, max) => JSON.parse(JSON.stringify(api.chunkByBytes(text, max)));
  const loneHigh = '\uD800';
  const loneLow = '\uDFFF';
  const pair = '😀'; // valid surrogate pair = one code point (4 bytes)
  assert.throws(() => api.chunkByBytes(`${loneHigh}ab`, 100), /SOURCE_NOT_UTF8/);
  assert.throws(() => api.chunkByBytes(`x${loneLow}`, 100), /SOURCE_NOT_UTF8/);
  assert.deepEqual(chunksOf(pair, 100), [pair]);
  assert.deepEqual(chunksOf(`a${pair}b`, 3), ['a', pair, 'b']);
  assert.equal(api.utf8Len(pair), 4);
  assert.equal(api.utf8Len('ab'), 2);
});

// ---------------------------------------------------------------- R03-SOURCE-REPLAY

// An index page serialized to EXACTLY `targetBytes` UTF-8 bytes. The page
// schema is strict (no free fields), so the size comes from PAD MANIFESTS:
// schema-valid single-ref manifests with artifact.bytes > 1048576 — the plan's
// oversize filter keeps them OUT of manifests_to_fetch, so the cycle never
// tries to spool them; their only effect is page byte length. Each pad
// manifest's byte length is tuned via its artifact.reference string, which has
// no length bound in the manifest validator (canonical manifest still ≤4KiB).
// 24100 bytes = 3 source chunks of 12000/12000/100.
function sizedCase(tag, targetBytes) {
  const reports = [];
  for (let i = 0; i < 3; i++) {
    const body = `bridge sized fixture ${tag} ${i} ${'p'.repeat(20)}`;
    reports.push({
      repository: 'artyhoo/getff', pr: 2300, comment_id: `${tag}-${i}`,
      body_sha256: sha256Of(body), reviewed_sha: sha40(`rv-${tag}-${i}`),
      url: `https://github.com/artyhoo/getff/pull/2300#discussion_r${i}`, body,
    });
  }
  const env = {
    version: 1, kind: 'batch', id: `DOT-BR-${tag}`, producer: CHAT_IDS.collector,
    parents: [], payload: { batch_id: `B-${tag}`, reports, complete: true }, sha256: null,
  };
  const { sha256: _omit, ...rest } = env;
  env.sha256 = digest(rest);
  const text = JSON.stringify(env);
  const manifest = {
    version: 1, status: 'READY', event_id: env.id, kind: 'batch',
    producer: CHAT_IDS.collector, destination: CHAT_IDS.analyst,
    sha256: sha256Of(text), bytes: Buffer.byteLength(text), parents: [],
    artifact: { page_id: `sz-${tag}`, reference: `ref-sz-${tag}` }, delivery_id: null,
  };
  const padManifest = (i, refLen) => ({
    version: 1, status: 'READY', event_id: `DOT-BR-${tag}-PAD${i}`, kind: 'batch',
    producer: CHAT_IDS.collector, destination: CHAT_IDS.analyst,
    sha256: sha256Of(`${tag}-pad-${i}`), bytes: 2000000, parents: [],
    artifact: { page_id: `pad-${tag}-${i}`, reference: 'p'.repeat(refLen) }, delivery_id: null,
  });
  const buildPage = (refLens) => {
    const items = [{ type: 'manifest', manifest }];
    for (let i = 0; i < refLens.length; i++) items.push({ type: 'manifest', manifest: padManifest(i, refLens[i]) });
    return JSON.stringify({
      version: 1, producer: CHAT_IDS.collector, generation: `COLLECTOR-INDEX-${tag}`, page_number: 0,
      items, next: null,
    });
  };
  const K = 8;
  const l0 = Buffer.byteLength(buildPage(new Array(K).fill(0)));
  const d = targetBytes - l0;
  if (d < 0) throw new Error(`${tag}: base page ${l0}B already exceeds target ${targetBytes}`);
  const r = Math.floor(d / K);
  const rem = d - r * K;
  const refLens = new Array(K).fill(r);
  refLens[0] += rem;
  const page0Text = buildPage(refLens);
  const len = Buffer.byteLength(page0Text);
  if (len !== targetBytes) throw new Error(`${tag}: sized page ${len}B != ${targetBytes}B`);
  return {
    text, manifest, page0Text, generation: `COLLECTOR-INDEX-${tag}`,
    locatorIndex: { page_id: `ix-${tag}`, reference: `library-file:/ix/${tag}.json`, sha256: sha256Of(page0Text), bytes: len },
    pages: { [`ref-sz-${tag}`]: text, [`library-file:/ix/${tag}.json`]: page0Text },
  };
}

test('identical replay of a published source: source-status short-circuits, ZERO appends/refetches (R03)', async () => {
  const root = freshRoot();
  const c = smallCase('R3A');
  const polls1 = [pollFor('collector', 'cur-r3a-1', locatorLine({ generation: c.generation, index: c.locatorIndex }))];
  const first = makeTools({ polls: polls1, pages: c.pages });
  await runBody(root, first.tools);
  assert.ok(existsSync(join(root, 'sources', `${c.locatorIndex.sha256}.json`)), 'source published by cycle 1');
  // the same locator arrives again (producer re-announces the generation)
  const polls2 = [pollFor('collector', 'cur-r3a-2', locatorLine({ generation: c.generation, index: c.locatorIndex }))];
  const second = makeTools({ polls: polls2, pages: c.pages });
  const r2 = await runBody(root, second.tools);
  assertResultShape(r2.result);
  assert.ok(!r2.result.blockers.some((b) => b.code === 'SOURCE_OFFSET_CONFLICT' || b.code === 'SOURCE_HASH_MISMATCH'));
  const execLog = second.calls.exec.join('\n');
  assert.ok(execLog.includes("'source-status'"), 'source-status consulted before any put');
  assert.ok(!execLog.includes("'source-put'"), 'zero appends for an already-published exact source');
  assert.equal(second.calls.reads.length, 0, 'no refetch of the published source');
  assert.equal(second.calls.readPage.length, 0);
  rmSync(root, { recursive: true, force: true });
});

test('restart after two committed chunks: ORIGINAL logical offsets replay, exact source published (R03)', async () => {
  const root = freshRoot();
  const c = sizedCase('R3B', 24100); // exactly 3 chunks: 12000 / 12000 / 100
  const id = `ix-collector-${c.locatorIndex.sha256.slice(0, 24)}`;
  const text = c.page0Text;
  const c0 = text.slice(0, 12000);
  const c1 = text.slice(12000, 24000);
  const c2 = text.slice(24000);
  assert.equal(Buffer.byteLength(c2), 100);
  // simulate a crashed uploader: chunks 0 and 1 durably committed, no final
  cliJson(['source-put', '--root', root, '--id', id, '--offset', '0', '--chunk-json', JSON.stringify(c0), '--final', 'false']);
  cliJson(['source-put', '--root', root, '--id', id, '--offset', '12000', '--chunk-json', JSON.stringify(c1), '--final', 'false']);
  const polls = [pollFor('collector', 'cur-r3b-1', locatorLine({ generation: c.generation, index: c.locatorIndex }))];
  const { tools, calls } = makeTools({ polls, pages: c.pages });
  const { result } = await runBody(root, tools);
  assertResultShape(result);
  assert.ok(!result.blockers.some((b) => b.code === 'SOURCE_HASH_MISMATCH' || b.code === 'SOURCE_OFFSET_CONFLICT'),
    `no replay corruption (blockers: ${JSON.stringify(result.blockers)})`);
  assert.equal(readFileSync(join(root, 'sources', `${c.locatorIndex.sha256}.json`), 'utf8'), text, 'exact original bytes');
  // the offsets used were the ORIGINAL logical offsets — the server's
  // committed offset (24000) never repositioned the chunk stream
  const putOffsets = calls.exec
    .filter((cmd) => cmd.includes("'source-put'"))
    .map((cmd) => {
      const at = cmd.indexOf("'--offset'");
      const m = cmd.slice(at + 10).match(/^\s*'(\d+)'/);
      return m ? Number(m[1]) : null;
    });
  assert.deepEqual(putOffsets, [0, 12000, 24000]);
  rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------- BOUNDED-CYCLE
//
// repair-code-review.json BOUNDED-CYCLE: cycle_wall_budget_ms was unused, the
// pending-receipt sends did not share event_limit, and page-budget decrements
// subtracted CUMULATIVE counters.sources (starving a later role at limit=1
// after a continuation). Contract (REPAIR-REMAINDER-KICKOFF Slice B): injected
// cycle wall-clock adapter defaulting to Date.now; deadline + shared caps
// checked before every bounded work unit; final 5s reserved for metadata
// cleanup; sends are claim-first (timeout => UNCERTAIN); tool/CLI calls race
// Promise.race/setTimeout against the REMAINING budget.

// A terminal 1-page empty-items chain for ANY role (collector/analyst/solver).
function emptyPageCase(role, tag) {
  const gen = `${role.toUpperCase()}-INDEX-${tag}`;
  const page = { version: 1, producer: CHAT_IDS[role], generation: gen, page_number: 0, items: [], next: null };
  const text = JSON.stringify(page);
  const ref = `library-file:/ix/${tag}-${role}.json`;
  return {
    role, gen, text,
    locatorIndex: { page_id: `ix-${tag}-${role}`, reference: ref, sha256: sha256Of(text), bytes: Buffer.byteLength(text) },
    pages: { [ref]: text },
  };
}

test('BC1: per-call page-budget delta — three 1-page locators at limit 3 ALL import in one cycle (BOUNDED-CYCLE)', async () => {
  const root = freshRoot();
  const cases = ['collector', 'analyst', 'solver'].map((role) => emptyPageCase(role, 'BC1'));
  const pages = Object.assign({}, ...cases.map((c) => c.pages));
  const polls = cases.map((c) => pollFor(c.role, `cur-bc1-${c.role}`, locatorLine({ role: c.role, generation: c.gen, index: c.locatorIndex })));
  const { tools, calls } = makeTools({ polls, pages });
  const { result } = await runBody(root, tools, { index_page_limit: 3 });
  assertResultShape(result);
  // cumulative counters.sources subtraction admitted only 2 of 3 before
  // driving the budget negative — the delta fix admits all three
  assert.equal(result.counts.sources, 3, 'ALL three roles import — no cumulative over-subtraction');
  const plan = cliJson(['plan', '--root', root]);
  for (const c of cases) assert.equal(plan.committed_cursors[c.role], `cur-bc1-${c.role}`);
  assert.equal(calls.sends.length, 3, 'one imported-receipt send per role page');
  assert.ok(calls.sends.every((s) => s.prompt && s.prompt.startsWith('DOT_RELAY_IMPORTED ')));
  rmSync(root, { recursive: true, force: true });
});

test('BC1b: page_limit 1 — first role imports with continuation, second role imports next cycle (no starvation)', async () => {
  const root = freshRoot();
  const a = emptyPageCase('collector', 'BC1B');
  const b = emptyPageCase('analyst', 'BC1B');
  const pages = { ...a.pages, ...b.pages };
  const polls1 = [
    pollFor('collector', 'cur-bc1b-c', locatorLine({ role: 'collector', generation: a.gen, index: a.locatorIndex })),
    pollFor('analyst', 'cur-bc1b-a', locatorLine({ role: 'analyst', generation: b.gen, index: b.locatorIndex })),
  ];
  const first = makeTools({ polls: polls1, pages });
  const r1 = await runBody(root, first.tools, { index_page_limit: 1 });
  assertResultShape(r1.result);
  assert.equal(r1.result.counts.sources, 1, 'only the first role fits the limit-1 budget');
  assert.equal(r1.result.continuation, true);
  let plan = cliJson(['plan', '--root', root]);
  assert.equal(plan.committed_cursors.collector, 'cur-bc1b-c');
  assert.equal(plan.committed_cursors.analyst, undefined, 'second role held this cycle');
  // next cycle: the second role's locator (uncommitted cursor) is re-announced
  const polls2 = [pollFor('analyst', 'cur-bc1b-a', locatorLine({ role: 'analyst', generation: b.gen, index: b.locatorIndex }))];
  const second = makeTools({ polls: polls2, pages });
  const r2 = await runBody(root, second.tools, { index_page_limit: 1 });
  assert.equal(r2.result.counts.sources, 1);
  plan = cliJson(['plan', '--root', root]);
  assert.equal(plan.committed_cursors.analyst, 'cur-bc1b-a', 'second role not starved by the first role');
  rmSync(root, { recursive: true, force: true });
});

test('BC2: many pending receipts SHARE the event_limit send cap with deliveries; the rest defer with continuation (BOUNDED-CYCLE)', async () => {
  const root = freshRoot();
  // one PENDING delivery: manifest registered + artifact spooled + ingested
  const text = batchEnvelopeText('BC2');
  const manifest = {
    version: 1, status: 'READY', event_id: 'DOT-BR-BC2', kind: 'batch',
    producer: CHAT_IDS.collector, destination: CHAT_IDS.analyst,
    sha256: sha256Of(text), bytes: Buffer.byteLength(text), parents: [],
    artifact: { page_id: 'pg-bc2', reference: 'ref-bc2' }, delivery_id: null,
  };
  mkdirSync(join(root, 'in'), { recursive: true });
  writeFileSync(join(root, 'in', 'bc2.manifest.json'), `${JSON.stringify(manifest)}\n`);
  cliJson(['manifest-import', '--root', root, '--file', join(root, 'in', 'bc2.manifest.json'), '--producer-role', 'collector', '--cursor-token', 'tok-bc2']);
  const begin = cliJson(['spool-begin', '--root', root, '--id', manifest.event_id, '--artifact-sha256', manifest.sha256, '--bytes', String(manifest.bytes)]);
  for (let i = 0; i < text.length; i += 12000) {
    cli(['spool-append', '--root', root, '--upload-id', begin.upload_id, '--chunk-json', JSON.stringify(text.slice(i, i + 12000))]);
  }
  cliJson(['spool-finish', '--root', root, '--upload-id', begin.upload_id, '--producer-role', 'collector']);
  // three PENDING imported-receipts from three completed single-page chains
  for (let i = 0; i < 3; i++) {
    const page = { version: 1, producer: CHAT_IDS.collector, generation: `COLLECTOR-INDEX-BC2-${i}`, page_number: 0, items: [], next: null };
    const p = join(root, 'in', `bc2-${i}.json`);
    writeFileSync(p, JSON.stringify(page));
    cliJson(['index-import', '--root', root, '--file', p, '--producer-role', 'collector', '--cursor', `cur-bc2-${i}`, '--expected-index-sha256', sha256Of(readFileSync(p, 'utf8'))]);
  }
  assert.equal(cliJson(['plan', '--root', root]).pending_receipts.length, 3);
  // event_limit 1: the delivery consumes the shared cap; receipts must defer
  const { tools, calls } = makeTools({ polls: [] });
  const { result } = await runBody(root, tools, { event_limit: 1 });
  assertResultShape(result);
  assert.equal(calls.sends.length, 1, 'exactly ONE send — receipts do not ride free past the cap');
  assert.ok(!String(calls.sends[0].prompt ?? '').startsWith('DOT_RELAY_IMPORTED '), 'the one send is the delivery');
  assert.equal(result.continuation, true);
  assert.equal(cliJson(['plan', '--root', root]).pending_receipts.length, 3, 'all three receipts deferred to the next cycle');
  rmSync(root, { recursive: true, force: true });
});

test('BC3: injected wall clock — past the 40s data cutoff admits NO new data work; cleanup still runs; clean bounded stop', async () => {
  const root = freshRoot();
  const c = smallCase('BCW');
  const polls = [pollFor('collector', 'cur-bcw', locatorLine({ generation: c.generation, index: c.locatorIndex }))];
  const base = makeTools({ polls, pages: c.pages });
  let t = 0;
  const tools = {
    ...base.tools,
    'mcp__codex_app__wait_threads': async (arg) => {
      const r = await base.tools['mcp__codex_app__wait_threads'](arg);
      t = 42000; // past the 40s data cutoff, still INSIDE the 45s wall (reserve intact)
      return r;
    },
  };
  const { result } = await runBody(root, tools, { cycle_clock: () => t });
  assertResultShape(result);
  assert.equal(result.state, 'IDLE', 'a cutoff stop is a bounded stop, not BLOCKED');
  assert.equal(result.counts.sources, 0);
  assert.equal(result.continuation, true);
  assert.ok(!result.blockers.some((b) => b.code.startsWith('CYCLE_')), 'no deadline blocker for a clean cutoff stop');
  assert.equal(base.calls.reads.length, 0, 'no source fetch after the cutoff');
  assert.equal(cliJson(['plan', '--root', root]).committed_cursors.collector, undefined);
  rmSync(root, { recursive: true, force: true });
});

test('BC3b: mid-chain cutoff persists the continuation; the next cycle resumes WITHOUT re-reading page 0', async () => {
  const root = freshRoot();
  const c = bigCase();
  const polls = [pollFor('collector', 'cur-bcw2', locatorLine({ generation: c.generation, index: c.locatorIndex }))];
  const base = makeTools({ polls, pages: c.pages });
  let t = 0;
  const tools = {
    ...base.tools,
    exec_command: async (arg) => {
      const r = await base.tools.exec_command(arg);
      if (String(arg?.cmd ?? '').includes("'index-import'")) t = 42000; // page 0 committed — cutoff now
      return r;
    },
  };
  const r1 = await runBody(root, tools, { cycle_clock: () => t });
  assertResultShape(r1.result);
  assert.equal(r1.result.counts.sources, 1, 'page 0 imported; page 1 refused by the cutoff');
  assert.equal(r1.result.continuation, true);
  assert.deepEqual(base.calls.reads.map((x) => x.reference), ['library-file:/ix/BIG-page-0.json'], 'page 1 never fetched');
  assert.equal(base.calls.sends.length, 0, 'no delivery/receipt send after the cutoff');
  assert.equal(cliJson(['plan', '--root', root]).committed_cursors.collector, undefined, 'cursor held while the chain is open');
  // cycle 2 on a fresh clock finishes the chain + artifact + deliveries
  const polls2 = [pollFor('collector', 'cur-bcw2', locatorLine({ generation: c.generation, index: c.locatorIndex }))];
  const second = makeTools({ polls: polls2, pages: c.pages });
  const r2 = await runBody(root, second.tools);
  assertResultShape(r2.result);
  assert.equal(r2.result.state, 'PROGRESSED');
  assert.equal(cliJson(['plan', '--root', root]).committed_cursors.collector, 'cur-bcw2');
  assert.ok(existsSync(join(root, 'objects', `${c.wholeSha}.json`)));
  const page0Reads = [...base.calls.reads, ...second.calls.reads].filter((x) => x.reference === 'library-file:/ix/BIG-page-0.json');
  assert.equal(page0Reads.length, 1, 'page 0 read exactly once across both cycles');
  rmSync(root, { recursive: true, force: true });
});

test('BC4: read_page_reference slower than the remaining budget -> CYCLE_TOOL_TIMEOUT, cursor held, nothing imported', async () => {
  const root = freshRoot();
  const c = smallCase('BCT');
  const polls = [pollFor('collector', 'cur-bct', locatorLine({ generation: c.generation, index: c.locatorIndex }))];
  const base = makeTools({ polls, pages: c.pages });
  let readCalls = 0;
  const tools = {
    ...base.tools,
    'mcp__codex_apps__chatgpt_space_read_page_reference': async (arg) => {
      readCalls += 1;
      await new Promise((r) => setTimeout(r, 6000)); // far slower than the 200ms cycle budget
      return base.tools['mcp__codex_apps__chatgpt_space_read_page_reference'](arg);
    },
  };
  const { result } = await runBody(root, tools, { cycle_wall_budget_ms: 200, cycle_clock: () => 0 });
  assertResultShape(result);
  assert.ok(result.blockers.some((b) => b.code === 'CYCLE_TOOL_TIMEOUT' && b.event_id === c.generation));
  assert.equal(result.counts.sources, 0);
  assert.equal(readCalls, 1, 'exactly one read attempt, never a blind retry');
  assert.equal(cliJson(['plan', '--root', root]).committed_cursors.collector, undefined);
  assert.ok(!existsSync(join(root, 'sources', `${c.locatorIndex.sha256}.json`)));
  rmSync(root, { recursive: true, force: true });
});

test('BC4b: send slower than the remaining budget times out to UNCERTAIN claim-first — one attempt each, never resent', async () => {
  const root = freshRoot();
  const c = smallCase('BCS');
  const polls = [pollFor('collector', 'cur-bcs', locatorLine({ generation: c.generation, index: c.locatorIndex }))];
  const base = makeTools({ polls, pages: c.pages });
  let sendCalls = 0;
  const tools = {
    ...base.tools,
    'mcp__codex_app__send_message_to_thread': async (arg) => {
      sendCalls += 1;
      await new Promise((r) => setTimeout(r, 6000));
      return base.tools['mcp__codex_app__send_message_to_thread'](arg);
    },
  };
  const { result } = await runBody(root, tools, { cycle_wall_budget_ms: 200, cycle_clock: () => 0 });
  assertResultShape(result);
  assert.ok(result.blockers.some((b) => b.code === 'SEND_UNCERTAIN'));
  assert.equal(result.counts.deliveries, 0);
  assert.equal(sendCalls, 2, 'delivery + receipt send each attempted exactly ONCE');
  // claim-first: both settle UNCERTAIN (never flipped back to PENDING for retry)
  assert.equal(cliJson(['status', '--root', root]).counts.outbox_pending, 0);
  rmSync(root, { recursive: true, force: true });
});

test('BC4c: hung source-put CLI exceeds the budget -> CYCLE_CLI_TIMEOUT; one invocation, no fabricated success; next cycle replays exactly', async () => {
  const root = freshRoot();
  const c = smallCase('BCC');
  const polls = [pollFor('collector', 'cur-bcc', locatorLine({ generation: c.generation, index: c.locatorIndex }))];
  const base = makeTools({ polls, pages: c.pages });
  let putCalls = 0;
  const tools = {
    ...base.tools,
    exec_command: async (arg) => {
      const cmd = String(arg?.cmd ?? '');
      if (cmd.includes("'source-put'")) {
        putCalls += 1;
        await new Promise((r) => setTimeout(r, 6000)); // non-completed exec session
      }
      return base.tools.exec_command(arg);
    },
  };
  const r1 = await runBody(root, tools, { cycle_wall_budget_ms: 200, cycle_clock: () => 0 });
  assertResultShape(r1.result);
  assert.ok(r1.result.blockers.some((b) => b.code === 'CYCLE_CLI_TIMEOUT'));
  assert.equal(r1.result.counts.sources, 0);
  assert.equal(putCalls, 1, 'no fabricated success, no duplicate second call');
  assert.ok(!existsSync(join(root, 'sources', `${c.locatorIndex.sha256}.json`)));
  // the durable source journal makes the next cycle an exact-once replay
  const polls2 = [pollFor('collector', 'cur-bcc', locatorLine({ generation: c.generation, index: c.locatorIndex }))];
  const second = makeTools({ polls: polls2, pages: c.pages });
  const r2 = await runBody(root, second.tools);
  assertResultShape(r2.result);
  assert.equal(cliJson(['plan', '--root', root]).committed_cursors.collector, 'cur-bcc');
  assert.equal(readFileSync(join(root, 'sources', `${c.locatorIndex.sha256}.json`), 'utf8'), c.page0Text, 'exact original bytes after the timeout replay');
  rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------- F08 fencing

// F08 CYCLE_TIMEOUT_NOT_FENCED: the bounded-cycle guarantee is real only with
// a validated trusted clock/timer adapter, deadline admission that fires
// BEFORE a tool starts, and a settlement window a timed-out send cannot eat.
// F08 adapter-validation arms are SEPARATE tests: each arm's own RED must be
// watchable (a single multi-arm test stops at the first failing assert and
// the later arms' old-code failures go unwatched).
function f08HungTools(baseTools) {
  const hung = {};
  let invoked = 0;
  for (const name of Object.keys(baseTools)) {
    hung[name] = async () => { invoked += 1; return new Promise(() => {}); };
  }
  return { hung, count: () => invoked };
}

test('F08: a MISSING timer adapter refuses the cycle bounded, before any tool call (never an unbounded await)', async () => {
  const root = freshRoot();
  const c = smallCase('F08M');
  const polls = [pollFor('collector', 'cur-f08m', locatorLine({ generation: c.generation, index: c.locatorIndex }))];
  const base = makeTools({ polls, pages: c.pages });
  // a host whose calls NEVER settle — against exactly the serialized
  // bridge-source config shape (no timers field) this used to await forever
  const a = f08HungTools(base.tools);
  let settled = false;
  const p = runBody(root, a.hung, { timers: undefined }).then((r) => { settled = true; return r; });
  const guard = await Promise.race([p, new Promise((res) => setTimeout(() => res('UNBOUNDED'), 4000))]);
  assert.notEqual(guard, 'UNBOUNDED', 'no timer adapter: the cycle must still settle bounded — never await a hung call forever');
  assert.ok(settled);
  assertResultShape(guard.result);
  assert.equal(guard.result.state, 'BLOCKED');
  assert.ok(guard.result.blockers.some((b) => b.code === 'BRIDGE_TIMER_ADAPTER_MISSING'));
  assert.equal(a.count(), 0, 'the refusal fires before ANY tool invocation');
  assert.equal(guard.emitted.length, 1, 'the bounded refusal is still emitted exactly once');
  rmSync(root, { recursive: true, force: true });
});

test('F08: a MALFORMED timer adapter pair refuses the cycle bounded, before any tool call', async () => {
  const root = freshRoot();
  const c = smallCase('F08N');
  const polls = [pollFor('collector', 'cur-f08n', locatorLine({ generation: c.generation, index: c.locatorIndex }))];
  const base = makeTools({ polls, pages: c.pages });
  const b = f08HungTools(base.tools);
  const guard = await Promise.race([
    runBody(root, b.hung, { timers: { setTimeout: 1, clearTimeout: null } }),
    new Promise((res) => setTimeout(() => res('UNBOUNDED'), 4000)),
  ]);
  assert.notEqual(guard, 'UNBOUNDED', 'malformed adapter pair: still bounded, never an unbounded await');
  assertResultShape(guard.result);
  assert.equal(guard.result.state, 'BLOCKED');
  assert.ok(guard.result.blockers.some((x) => x.code === 'BRIDGE_TIMER_ADAPTER_INVALID'));
  assert.equal(b.count(), 0, 'the refusal fires before ANY tool invocation');
  rmSync(root, { recursive: true, force: true });
});

test('F08: an explicitly broken trusted clock is refused — never a silent Date.now fallback', async () => {
  const root = freshRoot();
  const c = smallCase('F08K');
  const polls = [pollFor('collector', 'cur-f08k', locatorLine({ generation: c.generation, index: c.locatorIndex }))];
  const base = makeTools({ polls, pages: c.pages });
  const r = await runBody(root, base.tools, { cycle_clock: 'not-a-function' });
  assertResultShape(r.result);
  assert.equal(r.result.state, 'BLOCKED');
  assert.ok(r.result.blockers.some((x) => x.code === 'BRIDGE_CLOCK_INVALID'));
  assert.equal(base.calls.exec.length, 0, 'zero CLI calls on the clock refusal');
  assert.equal(base.calls.wait.length, 0, 'zero tool calls of any kind on the clock refusal');
  rmSync(root, { recursive: true, force: true });
});

test('F08: an expired deadline refuses the next tool call BEFORE it starts — zero new invocations, deadline code preserved', async () => {
  const root = freshRoot();
  const c = smallCase('F08D');
  const polls = [pollFor('collector', 'cur-f08d', locatorLine({ generation: c.generation, index: c.locatorIndex }))];
  const base = makeTools({ polls, pages: c.pages });
  let t = 0;
  const tools = {
    ...base.tools,
    'mcp__codex_app__wait_threads': async (arg) => {
      const r = await base.tools['mcp__codex_app__wait_threads'](arg);
      t = 45000; // exactly the full budget: remaining hits 0 mid-cycle, before plan2
      return r;
    },
  };
  const { result } = await runBody(root, tools, { cycle_clock: () => t });
  assertResultShape(result);
  assert.equal(result.state, 'BLOCKED');
  assert.ok(result.blockers.some((x) => x.code === 'CYCLE_CLI_TIMEOUT'), 'the deadline code is preserved, not relabeled BRIDGE_EXCEPTION');
  assert.equal(result.continuation, true, 'deadline exhaustion leaves work pending for the next cycle');
  const planCalls = base.calls.exec.filter((x) => x.includes("'plan'")).length;
  assert.equal(planCalls, 1, 'plan1 only — the post-deadline plan2 never STARTS (admission before invocation)');
  rmSync(root, { recursive: true, force: true });
});

test('F08: a mutation settling long after its timeout and a completed next cycle is a fenced no-op — one effect, one identity, no duplicate send', async () => {
  const root = freshRoot();
  const c = smallCase('F08L');
  const polls = [pollFor('collector', 'cur-f08l', locatorLine({ generation: c.generation, index: c.locatorIndex }))];
  const base = makeTools({ polls, pages: c.pages });
  // hang ONLY the final source-put on a test-controlled gate: the CLI runs
  // when WE release it — the host never cancels a started call (F08 premise),
  // so its mutation can land long after the race rejected it
  const late = [];
  const tools = {
    ...base.tools,
    exec_command: (arg) => {
      const cmd = String(arg?.cmd ?? '');
      if (cmd.includes("'source-put'") && cmd.includes("'--final'") && cmd.includes("'true'")) {
        let release;
        const gate = new Promise((r) => { release = r; });
        const settled = gate.then(() => base.tools.exec_command(arg));
        late.push({ release: () => release(), settled });
        return settled;
      }
      return base.tools.exec_command(arg);
    },
  };
  const r1 = await runBody(root, tools, { cycle_wall_budget_ms: 200, cycle_clock: () => 0 });
  assertResultShape(r1.result);
  assert.ok(r1.result.blockers.some((b) => b.code === 'CYCLE_CLI_TIMEOUT'));
  assert.equal(r1.result.counts.sources, 0);
  assert.equal(late.length, 1, 'exactly one hung final source-put');
  // the next cycle enters and COMPLETES while the stale mutation pends
  const polls2 = [pollFor('collector', 'cur-f08l', locatorLine({ generation: c.generation, index: c.locatorIndex }))];
  const second = makeTools({ polls: polls2, pages: c.pages });
  const r2 = await runBody(root, second.tools);
  assertResultShape(r2.result);
  assert.equal(r2.result.state, 'PROGRESSED');
  assert.equal(cliJson(['plan', '--root', root]).committed_cursors.collector, 'cur-f08l');
  const srcPath = join(root, 'sources', `${c.locatorIndex.sha256}.json`);
  assert.equal(readFileSync(srcPath, 'utf8'), c.page0Text, 'exact original bytes');
  const sends2 = second.calls.sends.filter((s) => !String(s.prompt ?? '').startsWith('DOT_RELAY_IMPORTED '));
  assert.equal(sends2.length, 1, 'the delivery is sent exactly once (by the fresh cycle, never duplicated)');
  // NOW the stale cycle-1 final put settles against cycle 2's published state
  late[0].release();
  const lateRes = await late[0].settled;
  assert.equal(lateRes.exit_code, 0, 'the identical final replay against the published journal is a metadata no-op');
  assert.equal(readFileSync(srcPath, 'utf8'), c.page0Text, 'the late mutation changed nothing');
  assert.equal(cliJson(['plan', '--root', root]).committed_cursors.collector, 'cur-f08l', 'cursor untouched by the late write');
  // a third cycle proves convergence: nothing re-offered, nothing re-sent.
  // polls: [] — the cursor is committed, so a real host (afterCursor) returns
  // nothing at-or-behind it; re-delivering the same-cursor poll would test
  // an input the transport contract excludes
  const third = makeTools({ polls: [], pages: c.pages });
  const r3 = await runBody(root, third.tools);
  assertResultShape(r3.result);
  assert.equal(third.calls.sends.length, 0, 'no send of any kind after convergence');
  assert.equal(r3.result.counts.sources, 0);
  rmSync(root, { recursive: true, force: true });
});

test('F08: the send deadline reserves settlement time — a timed-out send settles its UNCERTAIN receipt INSIDE the reserve; never resent; no semantic payload', async () => {
  const root = freshRoot();
  const c = smallCase('F08S');
  const polls = [pollFor('collector', 'cur-f08s', locatorLine({ generation: c.generation, index: c.locatorIndex }))];
  const base = makeTools({ polls, pages: c.pages });
  const t0 = Date.now();
  let sendCalls = 0;
  const tools = {
    ...base.tools,
    'mcp__codex_app__send_message_to_thread': async (arg) => {
      sendCalls += 1;
      // effectively never settles inside the 8000ms budget for EITHER the old
      // full-remaining deadline or the reserved one — but unref'd, so the
      // timer never holds the process tail open after the cycle returns
      await new Promise((r) => {
        const h = setTimeout(r, 30000);
        if (typeof h.unref === 'function') h.unref();
      });
      return base.tools['mcp__codex_app__send_message_to_thread'](arg);
    },
  };
  const { result, emitted } = await runBody(root, tools, { cycle_wall_budget_ms: 8000, cycle_clock: () => Date.now() - t0 });
  assertResultShape(result);
  assert.ok(result.blockers.some((b) => b.code === 'SEND_UNCERTAIN'), 'the receipt settled durably UNCERTAIN inside the reserve');
  assert.ok(!result.blockers.some((b) => b.code === 'CYCLE_CLI_TIMEOUT'), 'receipt settlement was never squeezed out by the send');
  assert.equal(sendCalls, 1, 'the delivery send was attempted exactly once');
  assert.equal(cliJson(['status', '--root', root]).counts.outbox_pending, 0);
  // no semantic payload ever reaches the result/emission (metadata only)
  const blob = JSON.stringify({ result, emitted });
  assert.ok(!blob.includes(c.page0Text.slice(0, 60)), 'no page bytes in the emitted result');
  assert.ok(!blob.includes(c.text.slice(0, 60)), 'no artifact bytes in the emitted result');
  // the next cycle (fast sends) NEVER re-sends the uncertain delivery.
  // polls: [] — the cursor rides afterCursor now; a real host returns
  // nothing at-or-behind it
  const second = makeTools({ polls: [], pages: c.pages });
  const r2 = await runBody(root, second.tools, { cycle_wall_budget_ms: 8000, cycle_clock: () => 0 });
  assertResultShape(r2.result);
  const dup = second.calls.sends.filter((s) => !String(s.prompt ?? '').startsWith('DOT_RELAY_IMPORTED '));
  assert.equal(dup.length, 0, 'an UNCERTAIN delivery is never re-offered, never resent');
  rmSync(root, { recursive: true, force: true });
});
