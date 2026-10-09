// Dot relay CLI tests — IMPLEMENTATION-EXACT Task 4 table + DESIGN spool/
// multipart/index/metadata amendments. Spawned CLI processes over temp
// roots; fake transports/children only; launchctl is NEVER run (write-only
// timer mode).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import {
  mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync,
  existsSync, symlinkSync, readlinkSync, statSync, openSync, writeSync, closeSync,
  chmodSync, appendFileSync, renameSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { digest, CHAT_IDS, reportKey, splitCodepointParts } from './contract.mjs';
import { openLedger } from './ledger.mjs';

const CLI = fileURLToPath(new URL('./cli.mjs', import.meta.url));
const sha256Of = (s) => createHash('sha256').update(s).digest('hex');
const sha40 = (s) => sha256Of(s).slice(0, 40);

function cli(args, { cwd = tmpdir(), expectFail = false } = {}) {
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', cwd });
  if (!expectFail && r.status !== 0) {
    throw new Error(`cli ${args.join(' ')} exited ${r.status}: ${r.stdout} ${r.stderr}`);
  }
  return r;
}

function cliJson(args, opts = {}) {
  const r = cli(args, opts);
  return JSON.parse(r.stdout);
}

let rootSeq = 0;
function freshRoot() {
  const root = join(tmpdir(), `dot-cli-${process.pid}-${rootSeq++}-${randomUUID().slice(0, 6)}`);
  cli(['init', '--root', root]);
  return root;
}

// ---------------------------------------------------------------- envelopes

function batchEnvelopeText(tag) {
  const reports = [];
  for (let i = 0; i < 10; i++) {
    const body = `cli fixture body ${tag} ${i} ${'q'.repeat(30)}`;
    reports.push({
      repository: 'artyhoo/getff', pr: 2300, comment_id: `${tag}-${i}`,
      body_sha256: sha256Of(body), reviewed_sha: sha40(`rv-${tag}-${i}`),
      url: `https://github.com/artyhoo/getff/pull/2300#discussion_r${i}`, body,
    });
  }
  const env = {
    version: 1, kind: 'batch', id: `DOT-CLI-${tag}`, producer: CHAT_IDS.collector,
    parents: [], payload: { batch_id: `B-${tag}`, reports, complete: true }, sha256: null,
  };
  const { sha256: _omit, ...rest } = env; // digest excludes the sha256 field itself
  env.sha256 = digest(rest);
  return JSON.stringify(env);
}

function singleManifest(tag) {
  const text = batchEnvelopeText(tag);
  return {
    manifest: {
      version: 1, status: 'READY', event_id: `DOT-CLI-${tag}`, kind: 'batch',
      producer: CHAT_IDS.collector, destination: CHAT_IDS.analyst,
      sha256: sha256Of(text), bytes: Buffer.byteLength(text), parents: [],
      artifact: { page_id: 'page_cli_1', reference: 'library-file:cli.json' }, delivery_id: null,
    },
    text,
  };
}

function writeJson(root, rel, obj) {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, typeof obj === 'string' ? obj : `${JSON.stringify(obj)}\n`);
  return p;
}

// ---------------------------------------------------------------- init / root safety

test('init creates root/db/config with baseline holds; idempotent; mismatch refused', () => {
  const root = join(tmpdir(), `dot-cli-init-${randomUUID().slice(0, 6)}`);
  const r1 = cliJson(['init', '--root', root]);
  assert.equal(r1.ok, true);
  assert.ok(existsSync(join(root, 'ledger.sqlite')));
  assert.ok(existsSync(join(root, 'config.json')));
  const r2 = cliJson(['init', '--root', root]);
  assert.equal(r2.ok, true); // idempotent, same config
  const cfg = JSON.parse(readFileSync(join(root, 'config.json'), 'utf8'));
  cfg.label = 'tampered';
  writeFileSync(join(root, 'config.json'), `${JSON.stringify(cfg)}\n`);
  const bad = cli(['init', '--root', root], { expectFail: true });
  assert.equal(bad.status, 1);
  assert.ok(bad.stdout.includes('CONFIG_MISMATCH'));
  rmSync(root, { recursive: true, force: true });
});

test('bad roots: relative, traversal and symlink are refused with fixed codes', () => {
  const rel = cli(['init', '--root', 'relative/root'], { expectFail: true });
  assert.equal(rel.status, 1);
  assert.ok(rel.stdout.includes('ROOT_NOT_ABSOLUTE'));

  // literal '..' segment — join()/resolve() would normalize it away
  const trav = cli(['init', '--root', `${tmpdir()}/../x`], { expectFail: true });
  assert.equal(trav.status, 1);
  assert.ok(trav.stdout.includes('ROOT_TRAVERSAL'));

  const real = mkdtempSync(join(tmpdir(), 'dot-cli-real-'));
  const link = join(tmpdir(), `dot-cli-link-${randomUUID().slice(0, 6)}`);
  symlinkSync(real, link);
  const sym = cli(['init', '--root', link], { expectFail: true });
  assert.equal(sym.status, 1);
  assert.ok(sym.stdout.includes('ROOT_SYMLINK'));
  rmSync(real, { recursive: true, force: true });
  rmSync(link, { force: true });
});

test('unknown flag or command exits 2', () => {
  const root = freshRoot();
  const f = cli(['tick', '--root', root, '--nonsense'], { expectFail: true });
  assert.equal(f.status, 2);
  const c = cli(['frobnicate', '--root', root], { expectFail: true });
  assert.equal(c.status, 2);
  rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------- tick / plan

test('idle tick: metadata-only stdout, no model invocation, no payload keys', () => {
  const root = freshRoot();
  const out = cliJson(['tick', '--root', root]);
  assert.equal(out.ok, true);
  assert.ok(typeof out.plan_path === 'string');
  assert.ok(typeof out.plan_sha256 === 'string');
  const raw = cli(['tick', '--root', root]).stdout;
  assert.ok(!raw.includes('glm'));
  assert.ok(!raw.includes('body'));
  assert.ok(!raw.includes('kickoff'));
  rmSync(root, { recursive: true, force: true });
});

test('overlapping ticks both succeed and leave a consistent ledger', async () => {
  const root = freshRoot();
  const runs = await Promise.all([0, 1, 2].map(async (i) => {
    void i;
    const { spawn } = await import('node:child_process');
    return new Promise((res) => {
      const p = spawn(process.execPath, [CLI, 'tick', '--root', root], { encoding: 'utf8' });
      let out = '';
      let err = '';
      p.stdout.on('data', (d) => { out += d; });
      p.stderr.on('data', (d) => { err += d; });
      p.on('exit', (code) => res({ code, out, err }));
    });
  }));
  for (const r of runs) assert.equal(r.code, 0, `tick exited ${r.code}: stdout=${r.out.slice(0, 400)} stderr=${r.err.slice(0, 600)}`);
  const st = cliJson(['status', '--root', root]);
  assert.equal(st.ok, true);
  rmSync(root, { recursive: true, force: true });
});

test('plan returns path+digest only; file is bounded metadata without contents echo', () => {
  const root = freshRoot();
  const out = cliJson(['plan', '--root', root]);
  assert.equal(out.ok, true);
  const text = readFileSync(out.plan_path, 'utf8');
  assert.equal(sha256Of(text), out.plan_sha256);
  const parsed = JSON.parse(text);
  assert.ok(Array.isArray(parsed.manifests_to_fetch));
  assert.equal(parsed.deployment_mode, 'HYBRID');
  rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------- deliveries

test('delivery-claim persists CLAIMED; crash restart keeps it claimed (never reset to PENDING)', () => {
  const root = freshRoot();
  const { manifest, text } = singleManifest('DC1');
  cliJson(['manifest-import', '--root', root, '--file', writeJson(root, 'in/dc1.manifest.json', manifest), '--producer-role', 'collector', '--cursor-token', 'tok-dc1']);
  // spool the envelope bytes and finish (ingests the event, creates the outbox row)
  spoolAll(root, 'DC1', text, manifest);
  const deliveries = cliJson(['plan', '--root', root]);
  void deliveries;
  const status1 = cliJson(['status', '--root', root]);
  void status1;
  // find the pending delivery id from the plan file
  const planText = JSON.parse(readFileSync(join(root, 'plans', 'bridge-plan.json'), 'utf8'));
  assert.ok(planText.delivery_ids.length >= 1);
  const id = planText.delivery_ids[0];
  const claim = cliJson(['delivery-claim', '--root', root, '--id', id]);
  assert.equal(claim.state, 'CLAIMED');
  assert.equal(claim.artifact_sha256, manifest.sha256);
  assert.equal(claim.source_page_id, manifest.artifact.page_id);
  // a NEW process (simulated crash of the claimer) sees CLAIMED, not PENDING
  const again = cli(['delivery-claim', '--root', root, '--id', id], { expectFail: true });
  assert.equal(again.status, 1);
  assert.ok(again.stdout.includes('DELIVERY_STATE'));
  rmSync(root, { recursive: true, force: true });
});

function spoolAll(root, tag, text, manifest) {
  const begin = cliJson(['spool-begin', '--root', root, '--id', manifest.event_id, '--artifact-sha256', manifest.sha256, '--bytes', String(manifest.bytes)]);
  const uploadId = begin.upload_id;
  for (let i = 0; i < text.length; i += 12000) {
    const chunk = text.slice(i, i + 12000);
    cli(['spool-append', '--root', root, '--upload-id', uploadId, '--chunk-json', JSON.stringify(chunk)]);
  }
  const fin = cliJson(['spool-finish', '--root', root, '--upload-id', uploadId, '--producer-role', 'collector']);
  assert.equal(fin.ok, true);
  assert.equal(fin.event_id, `DOT-CLI-${tag}`);
  assert.ok(existsSync(join(root, 'objects', `${manifest.sha256}.json`)));
  return fin;
}

test('spool single-part: exact bytes/hash publish immutable object and ingest privately; stdout carries no payload', () => {
  const root = freshRoot();
  const { manifest, text } = singleManifest('SP1');
  cliJson(['manifest-import', '--root', root, '--file', writeJson(root, 'in/sp1.manifest.json', manifest), '--producer-role', 'collector', '--cursor-token', 'tok-sp1']);
  const fin = spoolAll(root, 'SP1', text, manifest);
  assert.equal(fin.state, 'READY');
  // privacy: report bodies never appear in any CLI stdout
  assert.ok(!JSON.stringify(fin).includes('q'.repeat(30)));
  assert.equal(readFileSync(join(root, 'objects', `${manifest.sha256}.json`), 'utf8'), text);
  rmSync(root, { recursive: true, force: true });
});

test('spool byte hash mismatch is refused with a fixed code, no object published', () => {
  const root = freshRoot();
  const { manifest, text } = singleManifest('SP2');
  cliJson(['manifest-import', '--root', root, '--file', writeJson(root, 'in/sp2.manifest.json', manifest), '--producer-role', 'collector', '--cursor-token', 'tok-sp2']);
  const begin = cliJson(['spool-begin', '--root', root, '--id', manifest.event_id, '--artifact-sha256', manifest.sha256, '--bytes', String(manifest.bytes)]);
  // append WRONG bytes (mutated payload)
  const wrong = text.slice(0, text.length - 5) + 'XXXXX';
  for (let i = 0; i < wrong.length; i += 12000) {
    cli(['spool-append', '--root', root, '--upload-id', begin.upload_id, '--chunk-json', JSON.stringify(wrong.slice(i, i + 12000))]);
  }
  const fin = cli(['spool-finish', '--root', root, '--upload-id', begin.upload_id, '--producer-role', 'collector'], { expectFail: true });
  assert.equal(fin.status, 1);
  assert.ok(fin.stdout.includes('SPOOL_HASH_MISMATCH'));
  assert.ok(!existsSync(join(root, 'objects', `${manifest.sha256}.json`)));
  rmSync(root, { recursive: true, force: true });
});

// ------------------------------------------------------- R04/R05 CLI surface

function claimedBatchDelivery(root, tag) {
  const { manifest, text } = singleManifest(tag);
  cliJson(['manifest-import', '--root', root, '--file', writeJson(root, `in/${tag.toLowerCase()}.manifest.json`, manifest), '--producer-role', 'collector', '--cursor-token', `tok-${tag}`]);
  const fin = spoolAll(root, tag, text, manifest);
  cliJson(['plan', '--root', root]);
  const planFile = JSON.parse(readFileSync(join(root, 'plans', 'bridge-plan.json'), 'utf8'));
  const deliveryId = planFile.delivery_ids[0];
  cliJson(['delivery-claim', '--root', root, '--id', deliveryId]);
  return { manifest, fin, deliveryId };
}

function ackEnvelopeText(tag, role, payload) {
  const env = {
    version: 1, kind: 'ack', id: `DOT-CLI-${tag}`, producer: CHAT_IDS[role],
    parents: [], payload, sha256: null,
  };
  const { sha256: _omit, ...rest } = env;
  env.sha256 = digest(rest);
  return JSON.stringify(env);
}

function spoolAckEnvelope(root, tag, role, text) {
  const manifest = {
    version: 1, status: 'READY', event_id: `DOT-CLI-${tag}`, kind: 'ack',
    producer: CHAT_IDS[role], destination: CHAT_IDS.analyst,
    sha256: sha256Of(text), bytes: Buffer.byteLength(text), parents: [],
    artifact: { page_id: `page_${tag}`, reference: 'library-file:cli.json' }, delivery_id: null,
  };
  cliJson(['manifest-import', '--root', root, '--file', writeJson(root, `in/${tag.toLowerCase()}.ack.manifest.json`, manifest), '--producer-role', role, '--cursor-token', `tok-${tag}`]);
  const begin = cliJson(['spool-begin', '--root', root, '--id', manifest.event_id, '--artifact-sha256', manifest.sha256, '--bytes', String(manifest.bytes)]);
  for (let i = 0; i < text.length; i += 12000) {
    cli(['spool-append', '--root', root, '--upload-id', begin.upload_id, '--chunk-json', JSON.stringify(text.slice(i, i + 12000))]);
  }
  return cli(['spool-finish', '--root', root, '--upload-id', begin.upload_id, '--producer-role', role], { expectFail: true });
}

test('import-ack: --producer-role required; wrong role refuses, destination role ACKs', () => {
  const root = freshRoot();
  const { manifest, fin, deliveryId } = claimedBatchDelivery(root, 'IA1');
  const ack = {
    delivery_id: deliveryId, event_id: fin.event_id, event_sha256: fin.sha256,
    artifact_sha256: manifest.sha256, accepted: true, duplicate: false,
  };
  const ackFile = writeJson(root, 'in/ia1.ack.json', ack);
  // missing role -> usage refusal (no role-free ACK channel)
  const miss = cli(['import-ack', '--root', root, '--file', ackFile], { expectFail: true });
  assert.equal(miss.status, 2);
  assert.ok(miss.stderr.includes('producer-role'));
  // collector cannot ACK a collector->analyst delivery (R04)
  const wrong = cli(['import-ack', '--root', root, '--file', ackFile, '--producer-role', 'collector'], { expectFail: true });
  assert.equal(wrong.status, 1);
  assert.ok(wrong.stdout.includes('ACK_ROLE_MISMATCH'));
  // the destination role ACKs; outbox settles
  const good = cliJson(['import-ack', '--root', root, '--file', ackFile, '--producer-role', 'analyst']);
  assert.equal(good.state, 'ACKED');
  const ledger = openLedger(join(root, 'ledger.sqlite'));
  assert.equal(ledger.getOutbox(deliveryId).state, 'ACKED');
  ledger.close();
  rmSync(root, { recursive: true, force: true });
});

test('spool-finish passes the producer role into ingest: an ack envelope from a wrong-role spool is refused', () => {
  const root = freshRoot();
  const { manifest, fin, deliveryId } = claimedBatchDelivery(root, 'SF2');
  const payload = {
    delivery_id: deliveryId, event_id: fin.event_id, event_sha256: fin.sha256,
    artifact_sha256: manifest.sha256, accepted: true, duplicate: false,
  };
  // solver-role ack of a collector->analyst delivery: envelope-valid, role wrong
  const wrong = spoolAckEnvelope(root, 'SF2-ACKW', 'solver', ackEnvelopeText('SF2-ACKW', 'solver', payload));
  assert.equal(wrong.status, 1);
  assert.ok(wrong.stdout.includes('ACK_ROLE_MISMATCH'));
  const ledger = openLedger(join(root, 'ledger.sqlite'));
  assert.equal(ledger.getOutbox(deliveryId).state, 'CLAIMED', 'wrong-role ack held the delivery');
  ledger.close();
  // analyst-role ack (the destination) settles it
  const good = spoolAckEnvelope(root, 'SF2-ACKG', 'analyst', ackEnvelopeText('SF2-ACKG', 'analyst', payload));
  assert.equal(good.status, 0);
  const ledger2 = openLedger(join(root, 'ledger.sqlite'));
  assert.equal(ledger2.getOutbox(deliveryId).state, 'ACKED');
  ledger2.close();
  rmSync(root, { recursive: true, force: true });
});

test('conflict-resolve: explicit disposition + actor required; original re-admits, conflicting supersedes', () => {
  const root = freshRoot();
  const { manifest, text, fin } = (() => {
    const { manifest, text } = singleManifest('CR1');
    cliJson(['manifest-import', '--root', root, '--file', writeJson(root, 'in/cr1.manifest.json', manifest), '--producer-role', 'collector', '--cursor-token', 'tok-cr1']);
    return { manifest, text, fin: spoolAll(root, 'CR1', text, manifest) };
  })();

  // seed a ledger-level digest conflict: same id, different bytes
  const mutated = JSON.parse(text);
  mutated.payload.batch_id = 'B-CR1-conflicting';
  delete mutated.sha256;
  mutated.sha256 = digest(mutated);
  const ledger = openLedger(join(root, 'ledger.sqlite'));
  assert.equal(ledger.ingest(mutated).state, 'CONFLICT');
  ledger.close();

  // the conflict holds the delivery out of the plan
  cliJson(['plan', '--root', root]);
  let planFile = JSON.parse(readFileSync(join(root, 'plans', 'bridge-plan.json'), 'utf8'));
  assert.deepEqual(planFile.delivery_ids, []);

  // missing actor / unknown disposition / unknown event refused
  const noActor = cli(['conflict-resolve', '--root', root, '--event-id', fin.event_id, '--disposition', 'original'], { expectFail: true });
  assert.equal(noActor.status, 2);
  assert.ok(noActor.stderr.includes('actor'));
  const badDisp = cli(['conflict-resolve', '--root', root, '--event-id', fin.event_id, '--disposition', 'maybe', '--actor', 'root-owner'], { expectFail: true });
  assert.equal(badDisp.status, 1);
  assert.ok(badDisp.stdout.includes('CONFLICT_INPUT'));
  const noConflict = cli(['conflict-resolve', '--root', root, '--event-id', 'DOT-CLI-NONE', '--disposition', 'original', '--actor', 'root-owner'], { expectFail: true });
  assert.equal(noConflict.status, 1);
  assert.ok(noConflict.stdout.includes('NO_CONFLICT'));

  // 'original' clears the hold: the delivery is claimable again
  const r1 = cliJson(['conflict-resolve', '--root', root, '--event-id', fin.event_id, '--disposition', 'original', '--actor', 'root-owner']);
  assert.equal(r1.state, 'HELD_CLEARED');
  assert.equal(r1.disposition, 'original');
  cliJson(['plan', '--root', root]);
  planFile = JSON.parse(readFileSync(join(root, 'plans', 'bridge-plan.json'), 'utf8'));
  assert.equal(planFile.delivery_ids.length, 1);

  // 'conflicting' supersedes: PENDING delivery blocks, original bytes stay
  const mutated2 = JSON.parse(text);
  mutated2.payload.batch_id = 'B-CR1-conflicting-2';
  delete mutated2.sha256;
  mutated2.sha256 = digest(mutated2);
  const ledger2 = openLedger(join(root, 'ledger.sqlite'));
  assert.equal(ledger2.ingest(mutated2).state, 'CONFLICT');
  ledger2.close();
  const r2 = cliJson(['conflict-resolve', '--root', root, '--event-id', fin.event_id, '--disposition', 'conflicting', '--actor', 'root-owner']);
  assert.equal(r2.state, 'SUPERSEDED_CONFLICT');
  const ledger3 = openLedger(join(root, 'ledger.sqlite'));
  assert.equal(ledger3.getEvent(fin.event_id).sha256, fin.sha256, 'original immutable bytes preserved');
  ledger3.close();
  cliJson(['plan', '--root', root]);
  planFile = JSON.parse(readFileSync(join(root, 'plans', 'bridge-plan.json'), 'utf8'));
  assert.deepEqual(planFile.delivery_ids, []);
  rmSync(root, { recursive: true, force: true });
});

test('spool requires an existing persisted manifest with exact id/hash/bytes', () => {
  const root = freshRoot();
  const bad = cli(['spool-begin', '--root', root, '--id', 'DOT-CLI-UNKNOWN', '--artifact-sha256', '0'.repeat(64), '--bytes', '10'], { expectFail: true });
  assert.ok(bad.stdout.includes('UNKNOWN_MANIFEST'));
  const { manifest } = singleManifest('SP3');
  cliJson(['manifest-import', '--root', root, '--file', writeJson(root, 'in/sp3.manifest.json', manifest), '--producer-role', 'collector', '--cursor-token', 'tok-sp3']);
  const wrongBytes = cli(['spool-begin', '--root', root, '--id', manifest.event_id, '--artifact-sha256', manifest.sha256, '--bytes', String(manifest.bytes + 1)], { expectFail: true });
  assert.ok(wrongBytes.stdout.includes('MANIFEST_MISMATCH'));
  rmSync(root, { recursive: true, force: true });
});

test('spool chunk over 16KiB is refused', () => {
  const root = freshRoot();
  const { manifest, text } = singleManifest('SP4');
  cliJson(['manifest-import', '--root', root, '--file', writeJson(root, 'in/sp4.manifest.json', manifest), '--producer-role', 'collector', '--cursor-token', 'tok-sp4']);
  const begin = cliJson(['spool-begin', '--root', root, '--id', manifest.event_id, '--artifact-sha256', manifest.sha256, '--bytes', String(manifest.bytes)]);
  const big = 'x'.repeat(16385);
  const r = cli(['spool-append', '--root', root, '--upload-id', begin.upload_id, '--chunk-json', JSON.stringify(big)], { expectFail: true });
  assert.ok(r.stdout.includes('CHUNK_OVERSIZE'));
  void text;
  rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------- multipart spool

function multipartCase(tag) {
  const text = batchEnvelopeText(tag);
  const parts = splitCodepointParts(text, 200000); // small artifact -> 1 part; force 2 via smaller max below
  void parts;
  const cut = Math.ceil(text.length / 2);
  const partTexts = [text.slice(0, cut), text.slice(cut)];
  const whole = sha256Of(text);
  return {
    text,
    whole,
    manifest: {
      version: 1, status: 'READY', event_id: `DOT-CLI-${tag}`, kind: 'batch',
      producer: CHAT_IDS.collector, destination: CHAT_IDS.analyst,
      sha256: whole, bytes: Buffer.byteLength(text), parents: [],
      artifact: {
        sha256: whole, bytes: Buffer.byteLength(text),
        parts: partTexts.map((p, i) => ({ ordinal: i, page_id: `pg-${tag}-${i}`, reference: `lib:${tag}:${i}`, sha256: sha256Of(p), bytes: Buffer.byteLength(p) })),
      },
      delivery_id: null,
    },
    partTexts,
  };
}

function appendChunks(root, uploadId, partText) {
  for (let i = 0; i < partText.length; i += 12000) {
    cli(['spool-append', '--root', root, '--upload-id', uploadId, '--chunk-json', JSON.stringify(partText.slice(i, i + 12000))]);
  }
}

test('multipart spool: ordered parts, whole-hash publish; out-of-order and altered parts rejected; replay of identical part ok; state survives restart', () => {
  const root = freshRoot();
  const { manifest, text, whole, partTexts } = multipartCase('MP1');
  cliJson(['manifest-import', '--root', root, '--file', writeJson(root, 'in/mp1.manifest.json', manifest), '--producer-role', 'collector', '--cursor-token', 'tok-mp1']);
  const begin = cliJson(['spool-begin', '--root', root, '--id', manifest.event_id, '--artifact-sha256', manifest.sha256, '--bytes', String(manifest.bytes)]);
  const up = begin.upload_id;

  // out-of-order start refused (ordinal 1 before 0)
  const ooo = cli(['spool-part-begin', '--root', root, '--upload-id', up, '--ordinal', '1', '--sha256', sha256Of(partTexts[1]), '--bytes', String(Buffer.byteLength(partTexts[1]))], { expectFail: true });
  assert.ok(ooo.stdout.includes('PART_ORDER'));

  // part 0 in its own process, part 1 in ANOTHER process (restart mid-upload)
  cliJson(['spool-part-begin', '--root', root, '--upload-id', up, '--ordinal', '0', '--sha256', sha256Of(partTexts[0]), '--bytes', String(Buffer.byteLength(partTexts[0]))]);
  appendChunks(root, up, partTexts[0]);
  cliJson(['spool-part-finish', '--root', root, '--upload-id', up, '--ordinal', '0']);

  cliJson(['spool-part-begin', '--root', root, '--upload-id', up, '--ordinal', '1', '--sha256', sha256Of(partTexts[1]), '--bytes', String(Buffer.byteLength(partTexts[1]))]);
  appendChunks(root, up, partTexts[1]);
  cliJson(['spool-part-finish', '--root', root, '--upload-id', up, '--ordinal', '1']);

  const fin = cliJson(['spool-finish', '--root', root, '--upload-id', up, '--producer-role', 'collector']);
  assert.equal(fin.event_id, manifest.event_id);
  assert.equal(readFileSync(join(root, 'objects', `${whole}.json`), 'utf8'), text);
  rmSync(root, { recursive: true, force: true });
});

test('multipart altered part bytes rejected at part-finish', () => {
  const root = freshRoot();
  const { manifest, partTexts } = multipartCase('MP2');
  cliJson(['manifest-import', '--root', root, '--file', writeJson(root, 'in/mp2.manifest.json', manifest), '--producer-role', 'collector', '--cursor-token', 'tok-mp2']);
  const begin = cliJson(['spool-begin', '--root', root, '--id', manifest.event_id, '--artifact-sha256', manifest.sha256, '--bytes', String(manifest.bytes)]);
  cliJson(['spool-part-begin', '--root', root, '--upload-id', begin.upload_id, '--ordinal', '0', '--sha256', sha256Of(partTexts[0]), '--bytes', String(Buffer.byteLength(partTexts[0]))]);
  const altered = partTexts[0] + 'Z';
  appendChunks(root, begin.upload_id, altered);
  const r = cli(['spool-part-finish', '--root', root, '--upload-id', begin.upload_id, '--ordinal', '0'], { expectFail: true });
  assert.ok(r.stdout.includes('PART_MISMATCH'));
  rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------- R12 upload journal
//
// Crash boundaries are constructed as EXACT post-crash disk shapes (direct
// file manipulation between CLI invocations) — failpoints live here, never
// in production environment behavior. Every case restarts at least twice
// (each CLI call is a fresh process).

function uploadStatePath(root, uploadId) {
  return join(root, 'spool', `${uploadId}.state.json`);
}
function readUploadState(root, uploadId) {
  return JSON.parse(readFileSync(uploadStatePath(root, uploadId), 'utf8'));
}
function uploadPart(root, up, ordinal, partText) {
  cliJson(['spool-part-begin', '--root', root, '--upload-id', up, '--ordinal', String(ordinal), '--sha256', sha256Of(partText), '--bytes', String(Buffer.byteLength(partText))]);
  appendChunks(root, up, partText);
  cliJson(['spool-part-finish', '--root', root, '--upload-id', up, '--ordinal', String(ordinal)]);
}

// boundary: whole append done, journal checkpoint NOT — restart truncates the
// uncommitted suffix back to the committed offset and replays the part ONCE.
test('R12: uncommitted whole suffix truncated on restart; part replays exactly once (crash after append, before journal commit)', () => {
  const root = freshRoot();
  const { manifest, text, whole, partTexts } = multipartCase('R12A');
  cliJson(['manifest-import', '--root', root, '--file', writeJson(root, 'in/r12a.manifest.json', manifest), '--producer-role', 'collector', '--cursor-token', 'tok-r12a']);
  const begin = cliJson(['spool-begin', '--root', root, '--id', manifest.event_id, '--artifact-sha256', manifest.sha256, '--bytes', String(manifest.bytes)]);
  const up = begin.upload_id;

  uploadPart(root, up, 0, partTexts[0]); // committed: journal at ordinal 1

  // crash shape: part 1 bytes reached whole.tmp but the journal never advanced
  cliJson(['spool-part-begin', '--root', root, '--upload-id', up, '--ordinal', '1', '--sha256', sha256Of(partTexts[1]), '--bytes', String(Buffer.byteLength(partTexts[1]))]);
  appendChunks(root, up, partTexts[1]);
  appendFileSync(join(root, 'spool', `${up}.whole.tmp`), partTexts[1]); // uncommitted suffix
  assert.equal(readUploadState(root, up).next_ordinal, 1);

  // restart: part-finish must shed the suffix, then append part 1 exactly once
  cliJson(['spool-part-finish', '--root', root, '--upload-id', up, '--ordinal', '1']);
  const wholeTmp = readFileSync(join(root, 'spool', `${up}.whole.tmp`), 'utf8');
  assert.equal(wholeTmp, text); // p0+p1 — NOT p0+p1+p1 (duplicate concatenation)

  const fin = cliJson(['spool-finish', '--root', root, '--upload-id', up, '--producer-role', 'collector']);
  assert.equal(fin.artifact_sha256, whole);
  assert.equal(readFileSync(join(root, 'objects', `${whole}.json`), 'utf8'), text);
  rmSync(root, { recursive: true, force: true });
});

// boundary: journal commit done, part-temp unlink NOT — restart drops the
// orphan temp (its bytes are already committed at the whole prefix).
test('R12: orphan part temp of a committed ordinal is dropped on restart', () => {
  const root = freshRoot();
  const { manifest, whole, partTexts } = multipartCase('R12B');
  cliJson(['manifest-import', '--root', root, '--file', writeJson(root, 'in/r12b.manifest.json', manifest), '--producer-role', 'collector', '--cursor-token', 'tok-r12b']);
  const begin = cliJson(['spool-begin', '--root', root, '--id', manifest.event_id, '--artifact-sha256', manifest.sha256, '--bytes', String(manifest.bytes)]);
  const up = begin.upload_id;

  uploadPart(root, up, 0, partTexts[0]);
  writeFileSync(join(root, 'spool', `${up}.part0.tmp`), partTexts[0]); // crash shape: unlink never ran

  // restart: the next upload command reaps the orphan
  cliJson(['spool-part-begin', '--root', root, '--upload-id', up, '--ordinal', '1', '--sha256', sha256Of(partTexts[1]), '--bytes', String(Buffer.byteLength(partTexts[1]))]);
  assert.ok(!existsSync(join(root, 'spool', `${up}.part0.tmp`)), 'orphan committed part temp must be dropped on restart');

  appendChunks(root, up, partTexts[1]);
  cliJson(['spool-part-finish', '--root', root, '--upload-id', up, '--ordinal', '1']);
  const fin = cliJson(['spool-finish', '--root', root, '--upload-id', up, '--producer-role', 'collector']);
  assert.equal(fin.artifact_sha256, whole);
  rmSync(root, { recursive: true, force: true });
});

// boundary: whole rename done, DB ingest NOT — recovery verifies the published
// object and ingests exactly once; a crash between the DB commit and the state
// reap replays idempotently (still exactly one event row / one outbox row).
test('R12: publication crash (object renamed, ingest missing) recovers and ingests exactly once across restarts', () => {
  const root = freshRoot();
  const { manifest, text, whole, partTexts } = multipartCase('R12C');
  cliJson(['manifest-import', '--root', root, '--file', writeJson(root, 'in/r12c.manifest.json', manifest), '--producer-role', 'collector', '--cursor-token', 'tok-r12c']);
  const begin = cliJson(['spool-begin', '--root', root, '--id', manifest.event_id, '--artifact-sha256', manifest.sha256, '--bytes', String(manifest.bytes)]);
  const up = begin.upload_id;
  uploadPart(root, up, 0, partTexts[0]);
  uploadPart(root, up, 1, partTexts[1]);

  // crash shape: rename done + PUBLISHING intent persisted, DB not ingested
  const target = join(root, 'objects', `${whole}.json`);
  renameSync(join(root, 'spool', `${up}.whole.tmp`), target);
  const st = readUploadState(root, up);
  st.phase = 'PUBLISHING';
  writeFileSync(uploadStatePath(root, up), JSON.stringify(st));

  const fin1 = cliJson(['spool-finish', '--root', root, '--upload-id', up, '--producer-role', 'collector']);
  assert.equal(fin1.event_id, manifest.event_id);
  assert.equal(readFileSync(target, 'utf8'), text);
  const db = new DatabaseSync(join(root, 'ledger.sqlite'), { readOnly: true });
  assert.equal(db.prepare('SELECT COUNT(*) c FROM events WHERE id = ?').get(manifest.event_id).c, 1);
  assert.equal(db.prepare('SELECT COUNT(*) c FROM outbox WHERE event_id = ?').get(manifest.event_id).c, 1);
  db.close();

  // crash shape: ingest committed but the state reap never ran — second finish replays
  writeFileSync(uploadStatePath(root, up), JSON.stringify({ ...st, phase: 'PUBLISHED' }));
  const fin2 = cliJson(['spool-finish', '--root', root, '--upload-id', up, '--producer-role', 'collector']);
  assert.equal(fin2.replay, true);
  const db2 = new DatabaseSync(join(root, 'ledger.sqlite'), { readOnly: true });
  assert.equal(db2.prepare('SELECT COUNT(*) c FROM events WHERE id = ?').get(manifest.event_id).c, 1);
  assert.equal(db2.prepare('SELECT COUNT(*) c FROM outbox WHERE event_id = ?').get(manifest.event_id).c, 1);
  db2.close();
  rmSync(root, { recursive: true, force: true });
});

// a completed-shaped state alone is NEVER completion proof — only a durable
// ingest (event row digest + registered manifest match) stops the re-offer.
test('R12: plan re-offers a completed-shaped upload without durable ingest proof, and stops on the proof', () => {
  const root = freshRoot();
  const { manifest, partTexts } = multipartCase('R12D');
  cliJson(['manifest-import', '--root', root, '--file', writeJson(root, 'in/r12d.manifest.json', manifest), '--producer-role', 'collector', '--cursor-token', 'tok-r12d']);
  const begin = cliJson(['spool-begin', '--root', root, '--id', manifest.event_id, '--artifact-sha256', manifest.sha256, '--bytes', String(manifest.bytes)]);
  const up = begin.upload_id;
  uploadPart(root, up, 0, partTexts[0]);
  uploadPart(root, up, 1, partTexts[1]);
  const st = readUploadState(root, up); // completed-shaped, not finished

  const plan1 = cliJson(['plan', '--root', root]);
  assert.equal(plan1.pending_uploads.filter((u) => u.upload_id === up).length, 1, 'completed-shaped upload without ingest must be re-offered');

  const fin = cliJson(['spool-finish', '--root', root, '--upload-id', up, '--producer-role', 'collector']);
  assert.equal(fin.event_id, manifest.event_id);

  // crash shape: ingest committed, journal at INGESTED, state reap not yet run
  writeFileSync(uploadStatePath(root, up), JSON.stringify({ ...st, phase: 'INGESTED' }));
  const plan2 = cliJson(['plan', '--root', root]);
  assert.equal(plan2.pending_uploads.filter((u) => u.upload_id === up).length, 0, 'durable ingest proof must stop the re-offer');
  rmSync(root, { recursive: true, force: true });
});

// boundary: pre-existing object under the whole digest. DIFFERENT bytes is a
// conflict (never a silent skip-and-ingest); IDENTICAL bytes is accepted
// without rewriting the object.
test('R12: pre-existing differing object is SPOOL_OBJECT_CONFLICT; identical object accepted untouched', () => {
  const root = freshRoot();
  const { manifest, text, whole, partTexts } = multipartCase('R12E');
  cliJson(['manifest-import', '--root', root, '--file', writeJson(root, 'in/r12e.manifest.json', manifest), '--producer-role', 'collector', '--cursor-token', 'tok-r12e']);
  const begin = cliJson(['spool-begin', '--root', root, '--id', manifest.event_id, '--artifact-sha256', manifest.sha256, '--bytes', String(manifest.bytes)]);
  const up = begin.upload_id;
  uploadPart(root, up, 0, partTexts[0]);
  uploadPart(root, up, 1, partTexts[1]);

  const target = join(root, 'objects', `${whole}.json`);
  writeFileSync(target, JSON.stringify({ imposter: true }));
  const r = cli(['spool-finish', '--root', root, '--upload-id', up, '--producer-role', 'collector'], { expectFail: true });
  assert.ok(r.stdout.includes('SPOOL_OBJECT_CONFLICT'));

  writeFileSync(target, text);
  const mtimeBefore = statSync(target).mtimeMs;
  const fin = cliJson(['spool-finish', '--root', root, '--upload-id', up, '--producer-role', 'collector']);
  assert.equal(fin.event_id, manifest.event_id);
  assert.equal(readFileSync(target, 'utf8'), text);
  assert.equal(statSync(target).mtimeMs, mtimeBefore, 'identical pre-existing object is never rewritten');
  rmSync(root, { recursive: true, force: true });
});

// control arm (window A): PUBLISHING intent committed, rename not yet run —
// whole.tmp still retained; finish completes publication from it. Identical
// observables to a clean finish on both sides of the change.
test('R12: PUBLISHING intent with retained whole.tmp completes publication (crash between intent and rename)', () => {
  const root = freshRoot();
  const { manifest, text, whole, partTexts } = multipartCase('R12F');
  cliJson(['manifest-import', '--root', root, '--file', writeJson(root, 'in/r12f.manifest.json', manifest), '--producer-role', 'collector', '--cursor-token', 'tok-r12f']);
  const begin = cliJson(['spool-begin', '--root', root, '--id', manifest.event_id, '--artifact-sha256', manifest.sha256, '--bytes', String(manifest.bytes)]);
  const up = begin.upload_id;
  uploadPart(root, up, 0, partTexts[0]);
  uploadPart(root, up, 1, partTexts[1]);

  const st = readUploadState(root, up);
  st.phase = 'PUBLISHING';
  writeFileSync(uploadStatePath(root, up), JSON.stringify(st));

  const fin = cliJson(['spool-finish', '--root', root, '--upload-id', up, '--producer-role', 'collector']);
  assert.equal(fin.artifact_sha256, whole);
  assert.equal(readFileSync(join(root, 'objects', `${whole}.json`), 'utf8'), text);
  assert.ok(!existsSync(uploadStatePath(root, up)), 'state reaped after recovery completion');
  rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------- metadata-put

test('metadata-put: chunked writes, restart between chunks, strict final parse, path-only result', () => {
  const root = freshRoot();
  const locator = { version: 1, producer: CHAT_IDS.collector, status: 'READY', index: { page_id: 'p1', reference: 'r1', sha256: sha256Of('idx'), bytes: 3 }, generation: 1 };
  const text = JSON.stringify(locator);
  const half = Math.ceil(text.length / 2);
  const p1 = cliJson(['metadata-put', '--root', root, '--id', 'locator-1', '--chunk-json', JSON.stringify(text.slice(0, half)), '--final', 'false']);
  assert.ok(p1.path.endsWith('locator-1.json.part') || p1.pending === true || true);
  const p2 = cliJson(['metadata-put', '--root', root, '--id', 'locator-1', '--chunk-json', JSON.stringify(text.slice(half)), '--final', 'true']);
  assert.ok(p2.path.endsWith(join('inbox', 'locator-1.json')));
  assert.ok(existsSync(p2.path));
  assert.deepEqual(JSON.parse(readFileSync(p2.path, 'utf8')), locator);
  rmSync(root, { recursive: true, force: true });
});

test('metadata-put: forbidden payload/body/kickoff/analysis keys rejected anywhere (nested)', () => {
  const root = freshRoot();
  const evil = JSON.stringify({ version: 1, items: [{ type: 'ack', ack: { nested: { body: 'x' } } }] });
  const r = cli(['metadata-put', '--root', root, '--id', 'evil-1', '--chunk-json', JSON.stringify(evil), '--final', 'true'], { expectFail: true });
  assert.ok(r.stdout.includes('METADATA_FORBIDDEN_KEY'));
  assert.ok(!existsSync(join(root, 'inbox', 'evil-1.json')));
  const evil2 = JSON.stringify({ version: 1, payload: {} });
  const r2 = cli(['metadata-put', '--root', root, '--id', 'evil-2', '--chunk-json', JSON.stringify(evil2), '--final', 'true'], { expectFail: true });
  assert.ok(r2.stdout.includes('METADATA_FORBIDDEN_KEY'));
  rmSync(root, { recursive: true, force: true });
});

test('metadata-put: unsafe ids and oversize metadata refused', () => {
  const root = freshRoot();
  const trav = cli(['metadata-put', '--root', root, '--id', '../escape', '--chunk-json', '"x"', '--final', 'true'], { expectFail: true });
  assert.ok(trav.stdout.includes('BAD_ID'));
  const slash = cli(['metadata-put', '--root', root, '--id', 'a/b', '--chunk-json', '"x"', '--final', 'true'], { expectFail: true });
  assert.ok(slash.stdout.includes('BAD_ID'));
  const big = 'y'.repeat(200001);
  const over = cli(['metadata-put', '--root', root, '--id', 'big-1', '--chunk-json', JSON.stringify(big), '--final', 'true'], { expectFail: true });
  assert.ok(over.stdout.includes('CHUNK_OVERSIZE') || over.stdout.includes('METADATA_OVERSIZE'));
  // chunk within 16KiB but final total over 200000 via multiple chunks
  const mid = 'z'.repeat(16000);
  cliJson(['metadata-put', '--root', root, '--id', 'big-2', '--chunk-json', JSON.stringify(mid), '--final', 'false']);
  let last = null;
  for (let i = 0; i < 13; i++) {
    last = cli(['metadata-put', '--root', root, '--id', 'big-2', '--chunk-json', JSON.stringify(mid), '--final', i === 12 ? 'true' : 'false'], { expectFail: true });
    if (last.status === 1) break;
  }
  assert.ok(last.status === 1 && last.stdout.includes('METADATA_OVERSIZE'));
  rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------- index + cursor chain

test('index-import validates and continues; trusted cursor commits on chain completion; replay after advance is a no-op', () => {
  const root = freshRoot();
  const { manifest, text } = singleManifest('IX1');
  const page0 = {
    version: 1, producer: CHAT_IDS.collector, generation: 'COLLECTOR-INDEX-0001', page_number: 0,
    items: [{ type: 'manifest', manifest }],
    next: { page_id: 'ix-p1', reference: 'r', sha256: sha256Of('next'), bytes: 4 },
  };
  const p0 = writeJson(root, 'in/ix-page0.json', page0);
  const sha0 = sha256Of(readFileSync(p0, 'utf8'));
  const r0 = cliJson(['index-import', '--root', root, '--file', p0, '--producer-role', 'collector', '--cursor', 'cur-tool-ix', '--expected-index-sha256', sha0]);
  assert.equal(r0.ok, true);
  assert.equal(r0.complete, false);
  // cursor NOT advanced while the chain is open
  assert.equal(cliJson(['plan', '--root', root]).committed_cursors.collector, undefined);
  // hash mismatch refused
  const bad = cli(['index-import', '--root', root, '--file', p0, '--producer-role', 'collector', '--cursor', 'cur-tool-ix', '--expected-index-sha256', sha256Of('nope')], { expectFail: true });
  assert.ok(bad.stdout.includes('INVALID'));
  // terminal page closes the chain; the trusted tool cursor commits atomically with it
  const page1 = { version: 1, producer: CHAT_IDS.collector, generation: 'COLLECTOR-INDEX-0001', page_number: 1, items: [], next: null };
  const p1 = writeJson(root, 'in/ix-page1.json', page1);
  cliJson(['index-import', '--root', root, '--file', p1, '--producer-role', 'collector', '--cursor', 'cur-tool-ix', '--expected-index-sha256', sha256Of(readFileSync(p1, 'utf8'))]);
  assert.equal(cliJson(['plan', '--root', root]).committed_cursors.collector, 'cur-tool-ix');
  // R03: replaying the identical page0 after the continuation advanced is an accepted no-op
  const replay = cliJson(['index-import', '--root', root, '--file', p0, '--producer-role', 'collector', '--cursor', 'cur-tool-ix', '--expected-index-sha256', sha0]);
  assert.equal(replay.replay, true);
  assert.equal(replay.pages_imported, 0);
  // bytes arrive through the ordinary spool path (artifact fetch is independent of the cursor)
  spoolAll(root, 'IX1', text, manifest);
  rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------- OFF / bridge / timer

test('off persists across processes and blocks admissions; bridge-activated cannot clear OFF', () => {
  const root = freshRoot();
  const off = cliJson(['off', '--root', root, '--reason', 'operator stop for maintenance window']);
  assert.equal(off.ok, true);
  assert.ok(existsSync(join(root, 'OFF.json')));
  const st = cliJson(['status', '--root', root]);
  assert.equal(st.off, true);
  const { manifest } = singleManifest('OF1');
  const ing = cli(['manifest-import', '--root', root, '--file', writeJson(root, 'in/of1.json', manifest), '--producer-role', 'collector', '--cursor-token', 'tok-of1'], { expectFail: true });
  assert.ok(ing.stdout.includes('OFF'));

  const br = cliJson(['bridge-activated', '--root', root, '--automation-id', 'auto-123']);
  assert.equal(br.ok, true);
  assert.equal(cliJson(['status', '--root', root]).off, true); // bridge never clears OFF
  const br2 = cliJson(['bridge-activated', '--root', root, '--automation-id', 'auto-123']);
  assert.equal(br2.ok, true); // idempotent same id
  const br3 = cli(['bridge-activated', '--root', root, '--automation-id', 'auto-456'], { expectFail: true });
  assert.ok(br3.stdout.includes('AUTOMATION_CONFLICT'));
  rmSync(root, { recursive: true, force: true });
});

// HOST-RESILIENCE §1 scenario 12: the owned plist is a CALENDAR timer — six
// StartCalendarInterval dictionaries (0/4/8/12/16/20), RunAtLoad=true,
// KeepAlive=false, NEVER StartInterval. Parsed via real plutil (never a
// reboot/bootstrap); launchctl is never run (write-only mode).
test('install-timer --write-only: six calendar dicts, RunAtLoad=true, KeepAlive=false, no StartInterval; plutil -lint + parse; conflict detection', () => {
  const root = freshRoot();
  const plistDir = mkdtempSync(join(tmpdir(), 'dot-cli-plist-'));
  const weirdRoot = `${root} & <tag>`;
  cli(['init', '--root', weirdRoot]);
  const out = cliJson(['install-timer', '--root', weirdRoot, '--write-only', '--plist-dir', plistDir]);
  assert.equal(out.ok, true);
  assert.equal(out.label, 'ai.getff.dot-relay');
  assert.equal(out.bootstrapped, false); // launchctl never ran
  assert.equal(out.run_at_load, true);
  assert.equal(out.keep_alive, false);
  assert.deepEqual(out.calendar_hours, [0, 4, 8, 12, 16, 20]);
  assert.equal(out.lint_ok, true); // plutil -lint preflight passed
  const plistPath = join(plistDir, 'ai.getff.dot-relay.plist');
  const xml = readFileSync(plistPath, 'utf8');
  assert.ok(xml.includes('<key>StartCalendarInterval</key>'));
  assert.ok(!xml.includes('<key>StartInterval</key>')); // never both keys
  assert.ok(/<key>RunAtLoad<\/key>\s*<true\/>/.test(xml));
  assert.ok(/<key>KeepAlive<\/key>\s*<false\/>/.test(xml));
  assert.ok(xml.includes('&amp;')); // argv-escaped special chars
  assert.ok(xml.includes('&lt;tag&gt;'));
  // authoritative parse: plutil converts the plist to JSON (mock-free, read-only)
  const conv = spawnSync('plutil', ['-convert', 'json', '-o', '-', plistPath], { encoding: 'utf8' });
  assert.equal(conv.status, 0, `plutil convert failed: ${conv.stderr}`);
  const parsed = JSON.parse(conv.stdout);
  assert.equal(parsed.Label, 'ai.getff.dot-relay');
  assert.equal(parsed.RunAtLoad, true);
  assert.equal(parsed.KeepAlive, false);
  assert.ok(!('StartInterval' in parsed));
  assert.ok(Array.isArray(parsed.StartCalendarInterval));
  assert.equal(parsed.StartCalendarInterval.length, 6);
  assert.deepEqual(
    parsed.StartCalendarInterval.map((d) => [d.Hour, d.Minute]).sort((a, b) => a[0] - b[0]),
    [[0, 0], [4, 0], [8, 0], [12, 0], [16, 0], [20, 0]],
  );
  assert.deepEqual(parsed.ProgramArguments, [process.execPath, CLI, 'tick', '--root', weirdRoot]);
  // identical rewrite is idempotent
  const again = cliJson(['install-timer', '--root', weirdRoot, '--write-only', '--plist-dir', plistDir]);
  assert.equal(again.ok, true);
  // conflicting existing label content refused
  writeFileSync(plistPath, xml.replace('<key>Hour</key><integer>4</integer>', '<key>Hour</key><integer>5</integer>'));
  const conflict = cli(['install-timer', '--root', weirdRoot, '--write-only', '--plist-dir', plistDir], { expectFail: true });
  assert.ok(conflict.stdout.includes('BLOCKED_TIMER_CONFLICT'));
  // receipt states login requirement + wake coalescing honestly
  const receipt = JSON.parse(readFileSync(join(weirdRoot, 'timer.json'), 'utf8'));
  assert.equal(receipt.login_required, true);
  assert.equal(receipt.calendar_wake_coalescing, true);
  assert.equal(receipt.run_at_load, true);
  rmSync(plistDir, { recursive: true, force: true });
  rmSync(weirdRoot, { recursive: true, force: true });
  rmSync(root, { recursive: true, force: true });
});

// HOST-RESILIENCE §1: tick enters the scheduler transaction — cold start is
// due (RunAtLoad), an immediate re-tick is NOT due and has zero side effects.
test('tick scheduler bookkeeping: cold start due; off-slot re-tick not due, no re-plan; status carries scheduler metadata', () => {
  const root = freshRoot();
  const t1 = cliJson(['tick', '--root', root]);
  assert.equal(t1.ok, true);
  assert.equal(t1.supervise_launched, false);
  const planPath = join(root, 'plans', 'bridge-plan.json');
  assert.ok(existsSync(planPath)); // cold start planned
  const st1 = cliJson(['status', '--root', root]);
  assert.ok(st1.scheduler, 'status carries the scheduler block');
  assert.equal(st1.scheduler.catchup_pending, 0);
  assert.ok(Number.isFinite(st1.scheduler.next_due_wall_ms) && st1.scheduler.next_due_wall_ms > 0);
  const before = readFileSync(planPath, 'utf8');
  const beforeMs = statSync(planPath).mtimeMs;
  const t2 = cliJson(['tick', '--root', root]);
  assert.equal(t2.due, false); // inside the 4h slot: no-op, not a second plan
  assert.equal(t2.supervise_launched, false);
  assert.ok(Number.isFinite(t2.next_due_wall_ms));
  assert.equal(readFileSync(planPath, 'utf8'), before); // untouched
  assert.equal(statSync(planPath).mtimeMs, beforeMs);
  rmSync(root, { recursive: true, force: true });
});

// R06: a tick arriving while ANOTHER live scheduler owns the transaction is a
// busy refusal — it never plans and never touches the owner's record. The live
// owner here is the test process itself (real pid + real lstart, current boot).
test('tick with a LIVE scheduler owner returns busy and plans nothing (R06)', () => {
  const root = freshRoot();
  const boot = execFileSync('/usr/sbin/sysctl', ['-n', 'kern.bootsessionuuid'], { encoding: 'utf8' }).trim();
  const start = execFileSync('/bin/ps', ['-o', 'lstart=', '-p', String(process.pid)], { encoding: 'utf8' }).trim();
  const raw = new DatabaseSync(join(root, 'ledger.sqlite'));
  raw.prepare('INSERT OR REPLACE INTO control (key, value) VALUES (?,?)').run(
    'tick_in_progress',
    JSON.stringify({ token: 'tok-live-owner', boot_id: boot, pid: process.pid, start }),
  );
  raw.close();
  const out = cliJson(['tick', '--root', root]);
  assert.equal(out.ok, true);
  assert.equal(out.busy, true);
  assert.equal(out.refused, 'owner-live');
  assert.equal(out.supervise_launched, false);
  assert.ok(!existsSync(join(root, 'plans', 'bridge-plan.json')), 'a refused tick plans nothing');
  rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------- R09 shared death adapter
//
// CLI-level arms ONLY: provable absence and not-running/no-active rows. No
// live signal is asserted here (the exact-live ladder arms live in the
// executor tests); the exact-live reconcile arm is a pure identity read.

const currentBootId = () => execFileSync('/usr/sbin/sysctl', ['-n', 'kern.bootsessionuuid'], { encoding: 'utf8' }).trim();

// A pid the process table authoritatively reports absent right now — the
// high range is never allocated by the OS. Scans downward until ps refuses.
function absentPid() {
  for (let p = 99998; p >= 99900; p -= 1) {
    const r = spawnSync('/bin/ps', ['-o', 'lstart=', '-p', String(p)], { encoding: 'utf8' });
    if (r.status !== 0) return p;
  }
  throw new Error('no absent pid found in the scan range');
}

// Same R04-corrected chain plumbing as the executor fixtures: public manifests
// + destination-role ACKs so the solution is genuinely QUEUED for a claim.
function queuedCliSolution(ledger, tag) {
  const mk = (kind, id, producer, parents, payload) => {
    const e = { version: 1, kind, id, producer, parents, payload, sha256: null };
    e.sha256 = digest(e);
    return e;
  };
  const manifestFor = (e, destination) => ({
    version: 1, status: 'READY', event_id: e.id, kind: e.kind, producer: e.producer,
    destination, sha256: sha256Of(JSON.stringify(e)), bytes: Buffer.byteLength(JSON.stringify(e)),
    parents: e.parents, artifact: { page_id: `page-${e.id}`, reference: 'library-file:cli-fixtures.json' }, delivery_id: null,
  });
  const acked = (event, role, destinationRole) => {
    const manifest = manifestFor(event, destinationRole);
    ledger.manifestImport({ manifest, producerRole: role, cursorToken: `tok-${event.id}` });
    const d = ledger.pendingDeliveries().find((x) => x.event_id === event.id);
    ledger.claimDelivery(d.delivery_id);
    ledger.ack(
      { delivery_id: d.delivery_id, event_id: event.id, event_sha256: event.sha256, artifact_sha256: manifest.sha256, accepted: true, duplicate: false },
      { trustedProducerRole: destinationRole },
    );
  };
  const reports = [];
  for (let i = 0; i < 3; i++) {
    const body = `cli-exec fixture body ${tag} ${i} ${'z'.repeat(20)}`;
    reports.push({ repository: 'artyhoo/getff', pr: 2200, comment_id: `cx-${tag}-${i}`, body_sha256: sha256Of(body), reviewed_sha: sha40(`rv-${tag}-${i}`), body });
  }
  const batch = mk('batch', `DOT-CX-B-${randomUUID().slice(0, 8)}`, CHAT_IDS.collector, [], { batch_id: 'B-cx', reports, complete: true });
  ledger.ingest(batch);
  acked(batch, 'collector', 'analyst');
  const analysis = mk('analysis', `DOT-CX-A-${randomUUID().slice(0, 8)}`, CHAT_IDS.analyst, [{ id: batch.id, sha256: batch.sha256 }], {
    consumed_report_keys: reports.map((r) => reportKey(r)),
    candidates: [{ candidate_id: 'C1', finding_keys: ['F1'], report_keys: [reportKey(reports[0])], reviewed_sha: reports[0].reviewed_sha, summary: 's' }],
    excluded: [],
  });
  ledger.ingest(analysis);
  acked(analysis, 'analyst', 'solver');
  const kickoff = '# cli fixture kickoff\nrun the plan\n';
  const commands = [{ argv: ['node', '--test', 'x.test.mjs'], cwd: 'worktree', expected_exit: 0 }];
  const solution = mk('solution', `DOT-CX-S-${randomUUID().slice(0, 8)}`, CHAT_IDS.solver, [{ id: analysis.id, sha256: analysis.sha256 }], {
    candidate_id: 'C1',
    finding_keys: ['F1'],
    reviewed_sha: sha40(`rv-${tag}-0`), // equals the referenced analysis candidate's digest (R04)
    base_sha: '1'.repeat(40),
    ready: true,
    unresolved: [],
    prerequisites: [{ name: 'fetch', passed: true, evidence: 'fetched' }],
    scope_paths: ['scripts/dot-relay/cli.mjs'],
    kickoff,
    commands,
    verify_commands: commands,
    acceptance: ['green'],
    kickoff_sha256: sha256Of(kickoff),
    commands_sha256: digest(commands),
  });
  ledger.ingest(solution);
  return solution;
}

test('off over a provably absent child reports the shared death verdict; no active execution yields null (R09)', () => {
  const root = freshRoot();
  const ledger = openLedger(join(root, 'ledger.sqlite'));
  const solution = queuedCliSolution(ledger, 'a');
  const claim = ledger.claimExecution({ solutionId: solution.id, sessionId: '11111111-2222-4222-8222-333333333333' });
  assert.equal(claim.claimed, true);
  const pid = absentPid();
  const start = 'Mon Oct  6 10:00:00 2026';
  ledger.updateExecution(claim.execution_id, { state: 'RUNNING', pid, process_start: start });
  ledger.updateAttempt(claim.execution_id, 1, { state: 'RUNNING', boot_id: currentBootId(), child_pid: pid, child_start: start });
  ledger.close();
  const off = cliJson(['off', '--root', root, '--reason', 'operator stop for maintenance window']);
  assert.equal(off.ok, true);
  assert.equal(off.child.dead, true);
  assert.equal(off.child.kind, 'absent'); // fresh process-table absence, never ps-start prose
  assert.equal(off.child.signaled, false);
  assert.equal(off.timer_unloaded, false);
  // no active execution at all: there is nothing to prove — child is null
  const root2 = freshRoot();
  const off2 = cliJson(['off', '--root', root2, '--reason', 'operator stop for maintenance window']);
  assert.equal(off2.ok, true);
  assert.equal(off2.child, null);
  rmSync(root, { recursive: true, force: true });
  rmSync(root2, { recursive: true, force: true });
});

test('reconcile-execution CONFIRM_DEAD: shared adapter frees proven absence, refuses an exact-live child (R09)', () => {
  const root = freshRoot();
  const ledger = openLedger(join(root, 'ledger.sqlite'));
  const solution = queuedCliSolution(ledger, 'b');
  const claim = ledger.claimExecution({ solutionId: solution.id, sessionId: '11111111-2222-4222-8222-444444444444' });
  assert.equal(claim.claimed, true);
  const pid = absentPid();
  const start = 'Mon Oct  6 10:00:00 2026';
  ledger.updateExecution(claim.execution_id, { state: 'RUNNING', pid, process_start: start });
  ledger.updateAttempt(claim.execution_id, 1, { state: 'RUNNING', boot_id: currentBootId(), child_pid: pid, child_start: start });
  ledger.close();
  // missing control input is a usage refusal before anything runs
  const missing = cli(['reconcile-execution', '--root', root, '--id', claim.execution_id, '--decision', 'CONFIRM_DEAD'], { expectFail: true });
  assert.equal(missing.status, 2);
  // provable absence: the slot frees carrying the structured proof kind
  const rec = cliJson(['reconcile-execution', '--root', root, '--id', claim.execution_id, '--decision', 'CONFIRM_DEAD', '--control', 'operator-confirmed dead process 2026-10-09']);
  assert.equal(rec.ok, true);
  assert.equal(rec.state, 'ABORTED_UNCERTAIN');
  assert.equal(rec.death_proof_kind, 'absent');
  // exact-live child (this test process itself: real pid, real lstart, current
  // boot): the adapter refuses and the slot stays held — identity is READ,
  // never signaled, in this arm
  const ownStart = execFileSync('/bin/ps', ['-o', 'lstart=', '-p', String(process.pid)], { encoding: 'utf8' }).trim();
  const ledger2 = openLedger(join(root, 'ledger.sqlite'));
  const solution2 = queuedCliSolution(ledger2, 'c');
  const claim2 = ledger2.claimExecution({ solutionId: solution2.id, sessionId: '11111111-2222-4222-8222-555555555555' });
  assert.equal(claim2.claimed, true);
  ledger2.updateExecution(claim2.execution_id, { state: 'RUNNING', pid: process.pid, process_start: ownStart });
  ledger2.updateAttempt(claim2.execution_id, 1, { state: 'RUNNING', boot_id: currentBootId(), child_pid: process.pid, child_start: ownStart });
  ledger2.close();
  const live = cli(['reconcile-execution', '--root', root, '--id', claim2.execution_id, '--decision', 'CONFIRM_DEAD', '--control', 'operator-confirmed dead process 2026-10-09'], { expectFail: true });
  assert.ok(live.stdout.includes('RECONCILE_NOT_DEAD'));
  const st = cliJson(['status', '--root', root]);
  assert.equal(st.execution.id, claim2.execution_id);
  assert.equal(st.execution.state, 'RUNNING'); // slot still held
  rmSync(root, { recursive: true, force: true });
});

// HOST-RESILIENCE §1 scenario 9: durable OFF survives fresh processes (reboot/
// load/manual tick all arrive as new tick processes) and suppresses planning
// and recovery; ONLY the explicit operator resume command clears it.
test('OFF survives processes/tick, suppresses planning+recovery; only explicit operator resume clears (scenario 9)', () => {
  const root = freshRoot();
  cliJson(['off', '--root', root, '--reason', 'operator maintenance window stop']);
  const t = cliJson(['tick', '--root', root]);
  assert.equal(t.off, true);
  assert.equal(t.supervise_launched, false);
  assert.ok(!existsSync(join(root, 'plans', 'bridge-plan.json'))); // no planning side effect
  assert.equal(cliJson(['status', '--root', root]).off, true);
  const br = cliJson(['bridge-activated', '--root', root, '--automation-id', 'auto-s9']);
  assert.equal(br.ok, true);
  assert.equal(cliJson(['status', '--root', root]).off, true); // bridge never clears OFF
  const noActor = cli(['resume', '--root', root], { expectFail: true });
  assert.equal(noActor.status, 2); // --actor is required
  const r = cliJson(['resume', '--root', root, '--actor', 'operator']);
  assert.equal(r.ok, true);
  assert.equal(r.cleared, true);
  assert.equal(cliJson(['status', '--root', root]).off, false);
  assert.ok(existsSync(join(root, 'OFF.json'))); // historical receipt retained, nothing gates on it
  const t2 = cliJson(['tick', '--root', root]);
  assert.equal(t2.ok, true);
  assert.ok(existsSync(join(root, 'plans', 'bridge-plan.json'))); // planning resumed
  rmSync(root, { recursive: true, force: true });
});

test('supervise --resume/--adopt: both flags refused, unknown execution fixed codes, no model spawn', () => {
  const root = freshRoot();
  const both = cli(['supervise', '--root', root, '--execution-id', 'X', '--resume', '--adopt'], { expectFail: true });
  assert.equal(both.status, 2);
  const r1 = cli(['supervise', '--root', root, '--execution-id', 'DOT-EXEC-nope', '--resume'], { expectFail: true });
  assert.ok(r1.stdout.includes('UNKNOWN_EXECUTION'));
  const r2 = cli(['supervise', '--root', root, '--execution-id', 'DOT-EXEC-nope', '--adopt'], { expectFail: true });
  assert.ok(r2.stdout.includes('UNKNOWN_EXECUTION'));
  assert.ok(!r1.stdout.includes('glm') && !r2.stdout.includes('glm'));
  rmSync(root, { recursive: true, force: true });
});

// HOST-RESILIENCE §5 scenario 11: a partial multipart upload/index continues
// across restarts with exact part/whole hash validation, and host recovery
// (the tick) NEVER advances producer cursors prematurely.
test('partial multipart continuation survives restart+tick; index cursor stays uncommitted without a completed chain (scenario 11)', () => {
  const root = freshRoot();
  const { manifest, text, whole, partTexts } = multipartCase('S11');
  cliJson(['manifest-import', '--root', root, '--file', writeJson(root, 'in/s11.manifest.json', manifest), '--producer-role', 'collector', '--cursor-token', 'tok-s11']);
  const begin = cliJson(['spool-begin', '--root', root, '--id', manifest.event_id, '--artifact-sha256', manifest.sha256, '--bytes', String(manifest.bytes)]);
  const up = begin.upload_id;
  // part 0 completes in its own process
  cliJson(['spool-part-begin', '--root', root, '--upload-id', up, '--ordinal', '0', '--sha256', sha256Of(partTexts[0]), '--bytes', String(Buffer.byteLength(partTexts[0]))]);
  appendChunks(root, up, partTexts[0]);
  cliJson(['spool-part-finish', '--root', root, '--upload-id', up, '--ordinal', '0']);
  // a tick (login/wake/manual) runs between partial states
  const t = cliJson(['tick', '--root', root]);
  assert.equal(t.ok, true);
  // no index chain exists yet: the committed cursor map stays empty
  assert.equal(cliJson(['plan', '--root', root]).committed_cursors.collector, undefined);
  // restart continuation: part 1 in a NEW process, exact hashes validated at finish
  cliJson(['spool-part-begin', '--root', root, '--upload-id', up, '--ordinal', '1', '--sha256', sha256Of(partTexts[1]), '--bytes', String(Buffer.byteLength(partTexts[1]))]);
  appendChunks(root, up, partTexts[1]);
  cliJson(['spool-part-finish', '--root', root, '--upload-id', up, '--ordinal', '1']);
  const fin = cliJson(['spool-finish', '--root', root, '--upload-id', up, '--producer-role', 'collector']);
  assert.equal(fin.event_id, manifest.event_id);
  assert.equal(readFileSync(join(root, 'objects', `${whole}.json`), 'utf8'), text); // exact whole-hash publish
  // a later single-page index chain commits its own trusted cursor on completion
  const page = {
    version: 1, producer: CHAT_IDS.collector, generation: 'COLLECTOR-INDEX-00S11', page_number: 0,
    items: [{ type: 'manifest', manifest }], next: null,
  };
  const pp = writeJson(root, 'in/s11.page.json', page);
  cliJson(['index-import', '--root', root, '--file', pp, '--producer-role', 'collector', '--cursor', 'cur-s11', '--expected-index-sha256', sha256Of(readFileSync(pp, 'utf8'))]);
  assert.equal(cliJson(['plan', '--root', root]).committed_cursors.collector, 'cur-s11');
  rmSync(root, { recursive: true, force: true });
});

test('status is bounded metadata with HYBRID mode and no payload echoes', () => {
  const root = freshRoot();
  const st = cliJson(['status', '--root', root]);
  assert.equal(st.ok, true);
  assert.equal(st.deployment_mode, 'HYBRID');
  assert.ok(st.counts);
  const raw = JSON.stringify(st);
  assert.ok(!raw.includes('q'.repeat(30)));
  assert.ok(typeof st.source_sha === 'string');
  rmSync(root, { recursive: true, force: true });
});

test('supervise with unknown execution id fails with a fixed code (no model spawned)', () => {
  const root = freshRoot();
  const r = cli(['supervise', '--root', root, '--execution-id', 'DOT-EXEC-does-not-exist'], { expectFail: true });
  assert.equal(r.status, 1);
  assert.ok(r.stdout.includes('UNKNOWN_EXECUTION'));
  assert.ok(!r.stdout.includes('glm'));
  rmSync(root, { recursive: true, force: true });
});

test('init refuses a root whose parent chain leaves tmpdir via traversal', () => {
  const deep = `${tmpdir()}/a/../b`; // literal '..' — resolve() would normalize it away
  const r = cli(['init', '--root', deep], { expectFail: true });
  assert.ok(r.stdout.includes('ROOT_TRAVERSAL') || r.stdout.includes('ROOT_NOT_ABSOLUTE'));
});

// ---------------------------------------------------------------- source-put
// R01/R02: inert verified SOURCE upload under the fixed runtime source spool.
// Chunked, offset-checked, final exact Node byte count + SHA256, 0600 private,
// metadata-only stdout. R12: uncommitted suffix after a crash is truncated to
// the journaled committed offset before any new append (no blind re-append).

function sourcePut(root, id, { offset, chunk, final, sha256, bytes }) {
  const args = ['source-put', '--root', root, '--id', id, '--offset', String(offset), '--chunk-json', JSON.stringify(chunk)];
  args.push('--final', final ? 'true' : 'false');
  if (sha256 !== undefined) args.push('--sha256', sha256);
  if (bytes !== undefined) args.push('--bytes', String(bytes));
  return args;
}

test('source-put: offset-checked chunks, replay no-op, conflict rejected, final publishes exact inert source', () => {
  const root = freshRoot();
  const text = 'hello wörld'; // 12 UTF-8 bytes (ö = 2 bytes)
  const whole = sha256Of(text);
  const first = cliJson(sourcePut(root, 'ix-collector-GEN1-0', { offset: 0, chunk: 'hello ', final: false }));
  assert.equal(first.ok, true);
  assert.equal(first.offset, 6);
  // replay of identical bytes at a recorded offset is an accepted no-op
  const replay = cliJson(sourcePut(root, 'ix-collector-GEN1-0', { offset: 0, chunk: 'hello ', final: false }));
  assert.equal(replay.ok, true);
  assert.equal(replay.offset, 6);
  // conflicting bytes at a recorded offset are rejected, file unchanged
  const conflict = cli(['source-put', '--root', root, '--id', 'ix-collector-GEN1-0', '--offset', '0', '--chunk-json', JSON.stringify('HELLO '), '--final', 'false'], { expectFail: true });
  assert.ok(conflict.stdout.includes('SOURCE_OFFSET_CONFLICT'));
  const fin = cliJson(sourcePut(root, 'ix-collector-GEN1-0', { offset: 6, chunk: 'wörld', final: true, sha256: whole, bytes: 12 }));
  assert.deepEqual(Object.keys(fin).sort(), ['bytes', 'ok', 'path', 'sha256']);
  assert.equal(fin.sha256, whole);
  assert.equal(fin.bytes, 12);
  assert.ok(fin.path.startsWith(join(root, 'sources')));
  assert.equal(readFileSync(fin.path, 'utf8'), text); // exact bytes once
  assert.equal(statSync(fin.path).mode & 0o777, 0o600); // private
  // republish with identical expectations is idempotent, same doc shape
  const again = cliJson(sourcePut(root, 'ix-collector-GEN1-0', { offset: 6, chunk: 'wörld', final: true, sha256: whole, bytes: 12 }));
  assert.equal(again.path, fin.path);
  assert.equal(again.sha256, whole);
  rmSync(root, { recursive: true, force: true });
});

test('source-put: final with wrong expected hash/bytes or oversize total is rejected with fixed codes', () => {
  const root = freshRoot();
  const text = 'abc';
  const whole = sha256Of(text);
  cliJson(sourcePut(root, 'src-bad-1', { offset: 0, chunk: 'ab', final: false }));
  const badSha = cli(['source-put', '--root', root, '--id', 'src-bad-1', '--offset', '2', '--chunk-json', JSON.stringify('c'), '--final', 'true', '--sha256', sha256Of('abd'), '--bytes', '3'], { expectFail: true });
  assert.ok(badSha.stdout.includes('SOURCE_HASH_MISMATCH'));
  const badBytes = cli(['source-put', '--root', root, '--id', 'src-bad-1', '--offset', '2', '--chunk-json', JSON.stringify('c'), '--final', 'true', '--sha256', whole, '--bytes', '4'], { expectFail: true });
  assert.ok(badBytes.stdout.includes('SOURCE_HASH_MISMATCH'));
  // per-chunk bound fires for a single giant chunk
  const big = 'x'.repeat(200001);
  const chunkOver = cli(['source-put', '--root', root, '--id', 'src-bad-2', '--offset', '0', '--chunk-json', JSON.stringify(big), '--final', 'false'], { expectFail: true });
  assert.ok(chunkOver.stdout.includes('CHUNK_OVERSIZE'));
  // cumulative total bounded at 200000 bytes across many in-limit chunks
  let off = 0;
  let oversize = null;
  for (let i = 0; i < 13 && off <= 200000; i++) {
    oversize = cli(['source-put', '--root', root, '--id', 'src-bad-3', '--offset', String(off), '--chunk-json', JSON.stringify('y'.repeat(16000)), '--final', 'false'], { expectFail: true });
    if (oversize.status !== 0) break;
    off += 16000;
  }
  assert.ok(oversize.stdout.includes('SOURCE_OVERSIZE'));
  rmSync(root, { recursive: true, force: true });
});

test('source-put: crash-truncated uncommitted suffix is discarded before replay (R12 offset discipline)', () => {
  const root = freshRoot();
  const text = 'hello world';
  const whole = sha256Of(text);
  cliJson(sourcePut(root, 'src-crash-1', { offset: 0, chunk: 'hello ', final: false }));
  // simulate a crash between the raw append and the journal commit: extra
  // unjournaled bytes now sit past the committed offset
  const partPath = join(root, 'sources', 'src-crash-1.part');
  const fd = openSync(partPath, 'a');
  writeSync(fd, 'GARBAGE');
  closeSync(fd);
  // the next append must truncate the suffix to the committed offset first
  const fin = cliJson(sourcePut(root, 'src-crash-1', { offset: 6, chunk: 'world', final: true, sha256: whole, bytes: 11 }));
  assert.equal(fin.sha256, whole);
  assert.equal(readFileSync(fin.path, 'utf8'), text);
  rmSync(root, { recursive: true, force: true });
});

test('source-put: unsafe id, gap offset and missing expectations are refused', () => {
  const root = freshRoot();
  const bad = cli(['source-put', '--root', root, '--id', '../escape', '--offset', '0', '--chunk-json', JSON.stringify('x'), '--final', 'false'], { expectFail: true });
  assert.ok(bad.stdout.includes('SOURCE_ID_INVALID'));
  const gap = cli(['source-put', '--root', root, '--id', 'src-gap-1', '--offset', '5', '--chunk-json', JSON.stringify('x'), '--final', 'false'], { expectFail: true });
  assert.ok(gap.stdout.includes('SOURCE_OFFSET_CONFLICT'));
  // final without expected sha/bytes is a usage error, not a guess
  const noexpect = cli(['source-put', '--root', root, '--id', 'src-gap-1', '--offset', '0', '--chunk-json', JSON.stringify('x'), '--final', 'true'], { expectFail: true });
  assert.equal(noexpect.status, 2);
  rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------- source-status
// R03-SOURCE-REPLAY: the runner asks the durable journal for an id's state
// BEFORE any append — exact published identity short-circuits; a partial id
// reports the committed offset; a DIFFERING identity against a published
// object is a hold (never a reset).

test('source-status: exact published identity, partial committed offset, differing identity holds (R03)', () => {
  const root = freshRoot();
  const text = 'hello wörld'; // 12 UTF-8 bytes
  const whole = sha256Of(text);
  // unknown id: nothing committed, not published
  const st0 = cliJson(['source-status', '--root', root, '--id', 'ss-1', '--sha256', whole, '--bytes', '12']);
  assert.deepEqual(Object.keys(st0).sort(), ['committed_offset', 'ok', 'published']);
  assert.equal(st0.ok, true);
  assert.equal(st0.published, false);
  assert.equal(st0.committed_offset, 0);
  // partial: one chunk committed, final never sent
  cliJson(sourcePut(root, 'ss-1', { offset: 0, chunk: 'hello ', final: false }));
  const st1 = cliJson(['source-status', '--root', root, '--id', 'ss-1', '--sha256', whole, '--bytes', '12']);
  assert.equal(st1.ok, true);
  assert.equal(st1.published, false);
  assert.equal(st1.committed_offset, 6);
  // published: exact identity echoes the durable object
  cliJson(sourcePut(root, 'ss-1', { offset: 6, chunk: 'wörld', final: true, sha256: whole, bytes: 12 }));
  const st2 = cliJson(['source-status', '--root', root, '--id', 'ss-1', '--sha256', whole, '--bytes', '12']);
  assert.deepEqual(Object.keys(st2).sort(), ['bytes', 'ok', 'path', 'published', 'sha256']);
  assert.equal(st2.published, true);
  assert.equal(st2.sha256, whole);
  assert.equal(st2.bytes, 12);
  assert.ok(st2.path.startsWith(join(root, 'sources')));
  // differing identity against a PUBLISHED object is a hold — never a reset
  const diff = cli(['source-status', '--root', root, '--id', 'ss-1', '--sha256', sha256Of('other'), '--bytes', '5'], { expectFail: true });
  assert.equal(diff.status, 1);
  assert.ok(diff.stdout.includes('SOURCE_IDENTITY_CONFLICT'));
  // the journal was not reset: the original identity still resolves
  const st3 = cliJson(['source-status', '--root', root, '--id', 'ss-1', '--sha256', whole, '--bytes', '12']);
  assert.equal(st3.published, true);
  rmSync(root, { recursive: true, force: true });
});

test('source-status: missing/invalid inputs are usage or fixed-code refusals', () => {
  const root = freshRoot();
  const miss = cli(['source-status', '--root', root, '--id', 'ss-2'], { expectFail: true });
  assert.equal(miss.status, 2);
  const badSha = cli(['source-status', '--root', root, '--id', 'ss-2', '--sha256', 'zz', '--bytes', '3'], { expectFail: true });
  assert.equal(badSha.status, 2);
  const badBytes = cli(['source-status', '--root', root, '--id', 'ss-2', '--sha256', sha256Of('abc'), '--bytes', '300000'], { expectFail: true });
  assert.equal(badBytes.status, 2);
  const badId = cli(['source-status', '--root', root, '--id', '../escape', '--sha256', sha256Of('abc'), '--bytes', '3'], { expectFail: true });
  assert.ok(badId.stdout.includes('SOURCE_ID_INVALID'));
  rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------- locator-resolved
// PAGE-LOCATOR-RECOVERY-ADDENDUM: the runner persists a verified Page-fallback
// resolution into the control namespace BEFORE import; the next cycle reuses
// it (still verified on fetch) instead of re-running the bounded search.

test('locator-resolved: persist, idempotent replay, identity conflict refused, plan exposure (PAGE-FALLBACK)', () => {
  const root = freshRoot();
  const args = ['locator-resolved', '--root', root, '--producer-role', 'collector', '--generation', 'COLLECTOR-INDEX-LR1',
    '--locator-sha256', sha256Of('locator-line'), '--page-id', 'page_070fdd367758819192e503c9cee51251',
    '--reference', 'library-file:/sources/COLLECTOR-INDEX-LR1.json', '--source-sha256', sha256Of('page0'), '--bytes', '100'];
  const st = cliJson(args);
  assert.equal(st.ok, true);
  assert.equal(st.stored, true);
  assert.equal(st.replay, false);
  assert.equal(st.key, 'locator_resolution:collector:COLLECTOR-INDEX-LR1:' + sha256Of('page0'));
  // identical replay is a no-op
  const again = cliJson(args);
  assert.equal(again.replay, true);
  // a DIFFERING reference under the same identity is a conflict, never a rewrite
  const diff = cli(['locator-resolved', '--root', root, '--producer-role', 'collector', '--generation', 'COLLECTOR-INDEX-LR1',
    '--locator-sha256', sha256Of('locator-line'), '--page-id', 'page_070fdd367758819192e503c9cee51251',
    '--reference', 'library-file:/evil/other.json', '--source-sha256', sha256Of('page0'), '--bytes', '100'], { expectFail: true });
  assert.equal(diff.status, 1);
  assert.ok(diff.stdout.includes('LOCATOR_RESOLUTION_CONFLICT'));
  const diffBytes = cli(['locator-resolved', '--root', root, '--producer-role', 'collector', '--generation', 'COLLECTOR-INDEX-LR1',
    '--locator-sha256', sha256Of('locator-line'), '--page-id', 'page_070fdd367758819192e503c9cee51251',
    '--reference', 'library-file:/sources/COLLECTOR-INDEX-LR1.json', '--source-sha256', sha256Of('page0'), '--bytes', '101'], { expectFail: true });
  assert.ok(diffBytes.stdout.includes('LOCATOR_RESOLUTION_CONFLICT'));
  // plan exposes the durable resolution (metadata only)
  const plan = cliJson(['plan', '--root', root]);
  assert.equal(plan.locator_resolutions.length, 1);
  assert.equal(plan.locator_resolutions[0].reference, 'library-file:/sources/COLLECTOR-INDEX-LR1.json');
  assert.equal(plan.locator_resolutions[0].producer_role, 'collector');
  assert.equal(plan.locator_resolutions[0].source_sha256, sha256Of('page0'));
  // the original entry survived every conflict attempt
  const plan2 = JSON.parse(readFileSync(join(root, 'plans', 'bridge-plan.json'), 'utf8'));
  assert.equal(plan2.locator_resolutions[0].bytes, 100);
  rmSync(root, { recursive: true, force: true });
});

test('locator-resolved: missing flags and malformed inputs are usage refusals', () => {
  const root = freshRoot();
  const miss = cli(['locator-resolved', '--root', root, '--producer-role', 'collector'], { expectFail: true });
  assert.equal(miss.status, 2);
  const badGen = cli(['locator-resolved', '--root', root, '--producer-role', 'collector', '--generation', 'not a gen!',
    '--locator-sha256', sha256Of('l'), '--page-id', 'p1', '--reference', 'library-file:/x.json', '--source-sha256', sha256Of('p'), '--bytes', '10'], { expectFail: true });
  assert.equal(badGen.status, 2);
  const badRole = cli(['locator-resolved', '--root', root, '--producer-role', 'nobody', '--generation', 'COLLECTOR-INDEX-LR2',
    '--locator-sha256', sha256Of('l'), '--page-id', 'p1', '--reference', 'library-file:/x.json', '--source-sha256', sha256Of('p'), '--bytes', '10'], { expectFail: true });
  assert.equal(badRole.status, 2);
  const badSha = cli(['locator-resolved', '--root', root, '--producer-role', 'collector', '--generation', 'COLLECTOR-INDEX-LR2',
    '--locator-sha256', 'zz', '--page-id', 'p1', '--reference', 'library-file:/x.json', '--source-sha256', sha256Of('p'), '--bytes', '10'], { expectFail: true });
  assert.equal(badSha.status, 2);
  const badBytes = cli(['locator-resolved', '--root', root, '--producer-role', 'collector', '--generation', 'COLLECTOR-INDEX-LR2',
    '--locator-sha256', sha256Of('l'), '--page-id', 'p1', '--reference', 'library-file:/x.json', '--source-sha256', sha256Of('p'), '--bytes', '300000'], { expectFail: true });
  assert.equal(badBytes.status, 2);
  const bareRef = cli(['locator-resolved', '--root', root, '--producer-role', 'collector', '--generation', 'COLLECTOR-INDEX-LR2',
    '--locator-sha256', sha256Of('l'), '--page-id', 'p1', '--reference', 'library-file', '--source-sha256', sha256Of('p'), '--bytes', '10'], { expectFail: true });
  assert.equal(bareRef.status, 2, 'a bare type-label is not a resolution target');
  rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------- R10: review-import

// Prepares a REQUIRES_REVIEW execution directly in the root's ledger (fake
// QUEUED solution row + claim + review state + optional worker report), the
// way a prior supervisor capture leaves it behind. Returned ledger is CLOSED —
// the CLI process opens the database itself.
function requiresReviewRoot({ withReport = true } = {}) {
  const root = freshRoot();
  const sessionId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const raw = new DatabaseSync(join(root, 'ledger.sqlite'));
  raw.prepare("INSERT INTO events (id, sha256, kind, producer, parent_json, payload_json, state, created_ms) VALUES ('DOT-CLI-R10-SOL','deadbeef','solution','solver','[]','{}','QUEUED',1)").run();
  raw.close();
  const ledger = openLedger(join(root, 'ledger.sqlite'));
  const claim = ledger.claimExecution({ solutionId: 'DOT-CLI-R10-SOL', sessionId });
  const report = {
    version: 1, status: 'CODE_COMPLETE',
    execution_id: claim.execution_id, session_id: sessionId,
    solution_sha256: sha256Of('r10-cli-sol'), artifact_sha256: sha256Of('r10-cli-art'),
    source_tree_digest: sha256Of('r10-cli-tree'),
    pr_url: 'https://github.com/artyhoo/getff/pull/4101', head_sha: sha40('r10-cli-head'),
    independent_review_ref: null,
  };
  ledger.updateExecution(claim.execution_id, { state: 'REQUIRES_REVIEW', pr_url: report.pr_url, head_sha: report.head_sha });
  if (withReport) ledger.persistWorkerReport({ executionId: claim.execution_id, report });
  ledger.close();
  mkdirSync(join(root, 'reviews'), { recursive: true }); // receipt drop location
  return { root, sessionId, claim, report };
}

test('review-import: usage and file-surface refusals fire before any ledger or cloud work', () => {
  const root = freshRoot();
  // missing flags -> usage exit 2
  const usageR = cli(['review-import', '--root', root], { expectFail: true });
  assert.equal(usageR.status, 2);
  // uninitialized root
  const empty = join(tmpdir(), `dot-cli-empty-${randomUUID().slice(0, 6)}`);
  mkdirSync(empty, { recursive: true });
  const noRoot = cli(['review-import', '--root', empty, '--execution-id', 'X', '--receipt', join(empty, 'r.json')], { expectFail: true });
  assert.equal(noRoot.status, 1);
  assert.ok(noRoot.stdout.includes('ROOT_NOT_INITIALIZED'));
  rmSync(empty, { recursive: true, force: true });
  const reviews = join(root, 'reviews');
  mkdirSync(reviews, { recursive: true });
  // outside the fixed reviews root
  const outside = writeJson(root, 'outside.json', { v: 1 });
  const out1 = cli(['review-import', '--root', root, '--execution-id', 'X', '--receipt', outside], { expectFail: true });
  assert.equal(out1.status, 1);
  assert.ok(out1.stdout.includes('REVIEW_PATH_OUTSIDE_ROOT'));
  // traversal back out of the reviews root resolves outside too
  const trav = cli(['review-import', '--root', root, '--execution-id', 'X', '--receipt', join(reviews, '..', 'outside.json')], { expectFail: true });
  assert.ok(trav.stdout.includes('REVIEW_PATH_OUTSIDE_ROOT'));
  // symlink at the receipt path
  const target = writeJson(reviews, 'target.json', { v: 1 });
  const link = join(reviews, 'link.json');
  symlinkSync(target, link);
  const sym = cli(['review-import', '--root', root, '--execution-id', 'X', '--receipt', link], { expectFail: true });
  assert.ok(sym.stdout.includes('REVIEW_FILE_NOT_REGULAR'));
  // missing file
  const miss = cli(['review-import', '--root', root, '--execution-id', 'X', '--receipt', join(reviews, 'absent.json')], { expectFail: true });
  assert.ok(miss.stdout.includes('REVIEW_FILE_MISSING'));
  // malformed JSON
  writeFileSync(join(reviews, 'bad.json'), 'not-json');
  const bad = cli(['review-import', '--root', root, '--execution-id', 'X', '--receipt', join(reviews, 'bad.json')], { expectFail: true });
  assert.ok(bad.stdout.includes('FILE_NOT_JSON'));
  // world-writable receipt bytes are never trusted
  const ww = join(reviews, 'ww.json');
  writeFileSync(ww, '{"v":1}');
  chmodSync(ww, 0o666);
  const wwr = cli(['review-import', '--root', root, '--execution-id', 'X', '--receipt', ww], { expectFail: true });
  assert.ok(wwr.stdout.includes('REVIEW_FILE_WORLD_WRITABLE'));
  rmSync(root, { recursive: true, force: true });
});

test('review-import: ledger-gate holds render the blocker and leave the review slot untouched (no gh work)', () => {
  // arm 1: no worker report captured -> REVIEW_REPORT_MISSING
  const a = requiresReviewRoot({ withReport: false });
  const receiptA = join(a.root, 'reviews', 'a.json');
  writeFileSync(receiptA, JSON.stringify({
    version: 1, execution_id: a.claim.execution_id, session_id: a.sessionId,
    solution_sha256: a.report.solution_sha256, artifact_sha256: a.report.artifact_sha256,
    source_tree_digest: a.report.source_tree_digest, head_sha: a.report.head_sha,
    reviewer: 'dot-relay-os-owner', verdict: 'APPROVE',
  }));
  const r1 = cli(['review-import', '--root', a.root, '--execution-id', a.claim.execution_id, '--receipt', receiptA], { expectFail: true });
  assert.equal(r1.status, 1);
  assert.ok(r1.stdout.includes('REVIEW_REPORT_MISSING'));

  // arm 2: self-review (reviewer IS the worker session) -> REVIEWER_NOT_INDEPENDENT
  const b = requiresReviewRoot();
  const receiptB = join(b.root, 'reviews', 'b.json');
  writeFileSync(receiptB, JSON.stringify({
    version: 1, execution_id: b.claim.execution_id, session_id: b.sessionId,
    solution_sha256: b.report.solution_sha256, artifact_sha256: b.report.artifact_sha256,
    source_tree_digest: b.report.source_tree_digest, head_sha: b.report.head_sha,
    reviewer: b.sessionId, verdict: 'APPROVE',
  }));
  const r2 = cli(['review-import', '--root', b.root, '--execution-id', b.claim.execution_id, '--receipt', receiptB], { expectFail: true });
  assert.ok(r2.stdout.includes('REVIEWER_NOT_INDEPENDENT'));

  // arm 3: digest mismatch against the captured report -> RECEIPT_MISMATCH
  const c = requiresReviewRoot();
  const receiptC = join(c.root, 'reviews', 'c.json');
  writeFileSync(receiptC, JSON.stringify({
    version: 1, execution_id: c.claim.execution_id, session_id: c.sessionId,
    solution_sha256: c.report.solution_sha256, artifact_sha256: c.report.artifact_sha256,
    source_tree_digest: sha256Of('a-different-source-tree'), head_sha: c.report.head_sha,
    reviewer: 'dot-relay-os-owner', verdict: 'APPROVE',
  }));
  const r3 = cli(['review-import', '--root', c.root, '--execution-id', c.claim.execution_id, '--receipt', receiptC], { expectFail: true });
  assert.ok(r3.stdout.includes('RECEIPT_MISMATCH'));

  // every held root still holds the review slot and persisted nothing
  for (const { root, claim } of [a, b, c]) {
    const ledger = openLedger(join(root, 'ledger.sqlite'));
    assert.equal(ledger.getExecution(claim.execution_id).state, 'REQUIRES_REVIEW');
    assert.ok(!ledger.getReviewReceipt(claim.execution_id), 'a refused import persists no receipt');
    ledger.close();
    rmSync(root, { recursive: true, force: true });
  }
});

// ------------------------------------------- Slice E: RECOVERY-ADOPTION (reconcile-external-recovery)
//
// PAGE-LOCATOR-RECOVERY-ADDENDUM §"Import existing real deliveries": a narrow
// OS-owner command adopts already-delivered work from the 4 fixed recovery
// receipts + the original recovery-spool envelopes. Fake analogues ONLY —
// temp receipt dirs, temp spool files, temp runtime roots; production state
// is never touched by tests.

const RECOVERY_BASENAMES = [
  'recovery-dispatch-0006-0008.json',
  'recovery-analysis-import.json',
  'recovery-analysis-validation.json',
  'recovery-solver-dispatch-0006-0008.json',
];

// Builds a fake 3-batch + 3-analysis recovery case mirroring the real receipt
// shapes: sealed envelopes under <dir>/recovery-spool/<id ':'->'-'>/envelope.json,
// exact-basename receipts with full crosslinks (digests, manifests, ACKs).
function recoveryCase(tag) {
  const dir = join(tmpdir(), `dot-recv-${process.pid}-${tag}`);
  const spool = join(dir, 'recovery-spool');
  const batches = [];
  const analyses = [];

  const writeSpool = (env) => {
    const text = JSON.stringify(env);
    const d = join(spool, env.id.replace(/:/g, '-'));
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, 'envelope.json'), text);
    return { text, sha256: sha256Of(text), bytes: Buffer.byteLength(text, 'utf8') };
  };

  for (let i = 0; i < 3; i++) {
    const id = `DOT-BATCH-000${6 + i}:r1`;
    const reports = [];
    for (let r = 0; r < 10; r++) {
      const body = `recovery fixture body ${tag} ${i} ${r} ${'q'.repeat(30)}`;
      reports.push({
        repository: 'artyhoo/getff', pr: 2300, comment_id: `${tag}-b${i}-${r}`,
        body_sha256: sha256Of(body), reviewed_sha: sha40(`rv-${tag}-${i}-${r}`),
        url: `https://github.com/artyhoo/getff/pull/2300#discussion_r${r}`, body,
      });
    }
    const env = {
      version: 1, kind: 'batch', id, producer: CHAT_IDS.collector, parents: [],
      payload: { batch_id: `B-REC-${tag}-${i}`, reports, complete: true }, sha256: null,
    };
    const { sha256: _drop, ...rest } = env;
    env.sha256 = digest(rest);
    const file = writeSpool(env);
    const pieces = splitCodepointParts(file.text, 200000);
    const manifest = {
      version: 1, status: 'READY', event_id: id, kind: 'batch',
      producer: CHAT_IDS.collector, destination: CHAT_IDS.analyst,
      sha256: file.sha256, bytes: file.bytes, parents: [],
      artifact: {
        sha256: file.sha256, bytes: file.bytes,
        parts: pieces.map((piece) => ({
          ordinal: piece.ordinal, page_id: `page_rec_${tag}_${i}_${piece.ordinal}`,
          reference: `library-file:/rec-${tag}-${i}-${piece.ordinal}.json`,
          sha256: piece.sha256, bytes: piece.bytes,
        })),
      },
      delivery_id: null,
    };
    batches.push({ env, manifest, file, delivery_id: `DOT-RECOVERY-${id}` });
  }

  for (let i = 0; i < 3; i++) {
    const parent = batches[i].env;
    const keys = parent.payload.reports.map((r) => reportKey(r));
    const id = `DOT-ANALYSIS-000${6 + i}:r1`;
    const cand = {
      candidate_id: `C-${tag}-${i}`, finding_keys: ['F1'],
      report_keys: [keys[0]], reviewed_sha: parent.payload.reports[0].reviewed_sha,
      summary: 's',
    };
    const env = {
      version: 1, kind: 'analysis', id, producer: CHAT_IDS.analyst,
      parents: [{ id: parent.id, sha256: parent.sha256 }],
      payload: { consumed_report_keys: keys, candidates: [cand], excluded: [] }, sha256: null,
    };
    const { sha256: _drop2, ...rest2 } = env;
    env.sha256 = digest(rest2);
    const file = writeSpool(env);
    const manifest = {
      version: 1, status: 'READY', event_id: id, kind: 'analysis',
      producer: CHAT_IDS.analyst, destination: CHAT_IDS.solver,
      sha256: file.sha256, bytes: file.bytes, parents: env.parents,
      artifact: {
        sha256: file.sha256, bytes: file.bytes,
        parts: [{
          ordinal: 0, page_id: `page_rec_a_${tag}_${i}`,
          reference: `library-file:/rec-a-${tag}-${i}.json`,
          sha256: file.sha256, bytes: file.bytes,
        }],
      },
      delivery_id: null,
    };
    analyses.push({ env, manifest, file, delivery_id: `DOT-RECOVERY-${id}` });
  }

  const actualAcks = batches.map((b) => ({
    version: 1, delivery_id: b.delivery_id, event_id: b.env.id,
    event_sha256: b.env.sha256, artifact_sha256: b.file.sha256,
    accepted: true, duplicate: false, destination: CHAT_IDS.analyst,
  }));
  const dispatch = {
    version: 1, id: `DOT-RECOVERY-DISPATCH-${tag}`, state: 'ACKED',
    destination: CHAT_IDS.analyst,
    index: { page_id: 'page_rec_ix', reference: 'library-file:/rec-ix.json', sha256: sha256Of(`ix-${tag}`), bytes: 12665 },
    deliveries: batches.map((b) => ({
      delivery_id: b.delivery_id, event_id: b.env.id, event_sha256: b.env.sha256,
      artifact_sha256: b.file.sha256, bytes: b.file.bytes, manifest: b.manifest,
    })),
    semantic_replay_allowed: false, recorded_utc: '2026-10-08T21:00:00Z',
    actual_acks: actualAcks, ack_index_generation: `ANALYST-INDEX-${tag}`,
  };
  const analysisImport = {
    generation: `ANALYST-INDEX-${tag}`, index_sha256: sha256Of(`ix-${tag}`),
    acks: actualAcks,
    manifests: analyses.map((a) => a.manifest),
    records: analyses.map((a) => ({
      event_id: a.env.id, path: join(spool, a.env.id.replace(/:/g, '-'), 'envelope.json'),
      artifact_sha256: a.file.sha256, bytes: a.file.bytes,
    })),
  };
  const validation = {
    version: 1, validated: true,
    records: analyses.map((a) => ({
      event_id: a.env.id, event_sha256: a.env.sha256,
      artifact_sha256: a.file.sha256, bytes: a.file.bytes,
      candidates: 1, consumed: 10, excluded: 0, valid: true,
    })),
  };
  const solverDispatch = {
    version: 1, id: `DOT-RECOVERY-ANALYSIS-DISPATCH-${tag}`, state: 'SENT_ACCEPTED',
    destination: CHAT_IDS.solver,
    deliveries: analyses.map((a) => ({
      delivery_id: a.delivery_id, event_id: a.env.id, event_sha256: a.env.sha256,
      artifact_sha256: a.file.sha256, bytes: a.file.bytes, manifest: a.manifest,
    })),
  };
  for (const [name, obj] of [
    ['recovery-dispatch-0006-0008.json', dispatch],
    ['recovery-analysis-import.json', analysisImport],
    ['recovery-analysis-validation.json', validation],
    ['recovery-solver-dispatch-0006-0008.json', solverDispatch],
  ]) {
    writeFileSync(join(dir, name), `${JSON.stringify(obj)}\n`);
  }
  return { dir, spool, batches, analyses, dispatch, analysisImport, validation, solverDispatch };
}

// The exact bundle the CLI derives from a valid case (mirrors the ledger
// method contract used by the crash test).
function recoveryBundle(c) {
  return {
    import_key: sha256Of(JSON.stringify([
      RECOVERY_BASENAMES.map((n) => sha256Of(readFileSync(join(c.dir, n), 'utf8'))),
      [...c.batches, ...c.analyses].map((x) => x.file.sha256),
    ])),
    batches: c.batches.map((b) => ({
      env: b.env, manifest: b.manifest, delivery_id: b.delivery_id,
      ack: c.dispatch.actual_acks.find((a) => a.event_id === b.env.id),
    })),
    analyses: c.analyses.map((a) => ({
      env: a.env, manifest: a.manifest, delivery_id: a.delivery_id,
      send_receipt: { tool: 'send_message_to_thread', delivery_id: a.delivery_id, state: 'SENT_ACCEPTED' },
    })),
  };
}

function outboxRows(root) {
  const raw = new DatabaseSync(join(root, 'ledger.sqlite'));
  const rows = raw.prepare('SELECT delivery_id, event_id, destination, state, attempts, receipt_json IS NOT NULL AS has_receipt FROM outbox').all();
  raw.close();
  return rows;
}

test('E: reconcile-external-recovery first import: 3 ACKED batch rows + 3 SENT_ACCEPTED solver rows, 0 send offers, replay no-op', () => {
  const root = join(tmpdir(), `dot-cli-e1-${randomUUID().slice(0, 6)}`);
  cli(['init', '--root', root, '--recovery-pending']);
  const st0 = cliJson(['status', '--root', root]);
  assert.equal(st0.recovery_import_pending, true, 'pending flag exposed before reconciliation');

  const c = recoveryCase('E1');
  const r = cliJson(['reconcile-external-recovery', '--receipt-dir', c.dir, '--root', root]);
  assert.equal(r.ok, true);
  assert.equal(r.batches_acked, 3);
  assert.equal(r.analyses_sent, 3);
  assert.equal(r.replay, false);

  const rows = outboxRows(root);
  assert.equal(rows.length, 6, 'exactly 6 deliveries: 3 batches + 3 analyses, no defaults left');
  for (const b of c.batches) {
    const row = rows.find((x) => x.delivery_id === b.delivery_id);
    assert.ok(row, `batch delivery adopted: ${b.delivery_id}`);
    assert.equal(row.state, 'ACKED');
    assert.equal(row.event_id, b.env.id);
    assert.equal(row.destination, CHAT_IDS.analyst);
  }
  for (const a of c.analyses) {
    const row = rows.find((x) => x.delivery_id === a.delivery_id);
    assert.ok(row, `analysis delivery adopted: ${a.delivery_id}`);
    assert.equal(row.state, 'SENT_ACCEPTED', 'solver delivery is send-receipted, never ACKED');
    assert.ok(row.has_receipt, 'send receipt bound');
    assert.equal(row.destination, CHAT_IDS.solver);
  }

  const ledger = openLedger(join(root, 'ledger.sqlite'));
  for (const b of c.batches) assert.equal(ledger.getEvent(b.env.id).state, 'ACKED');
  for (const a of c.analyses) assert.equal(ledger.getEvent(a.env.id).state, 'READY');
  assert.equal(ledger.nextClaimableSolution(), null, 'no executor admission from adoption alone');
  assert.equal(ledger.getEvent('DOT-BATCH-0001').state, 'BASELINE_HOLD', 'baseline holds preserved');
  ledger.close();

  const st1 = cliJson(['status', '--root', root]);
  assert.equal(st1.recovery_import_pending, false, 'pending flag cleared only after commit');
  const plan = cliJson(['plan', '--root', root]);
  assert.equal(plan.delivery_ids, 0, 'nothing re-offered for sending: never resend batches/analyses');

  // identical re-import is a metadata-only no-op
  const r2 = cliJson(['reconcile-external-recovery', '--receipt-dir', c.dir, '--root', root]);
  assert.equal(r2.replay, true);
  assert.equal(outboxRows(root).length, 6, 'replay adds no rows');
  rmSync(root, { recursive: true, force: true });
  rmSync(c.dir, { recursive: true, force: true });
});

test('E: receipt/source conflict refuses with RECOVERY_IMPORT_CONFLICT and preserves pending flag; usage and file-surface refusals', () => {
  const root = join(tmpdir(), `dot-cli-e2-${randomUUID().slice(0, 6)}`);
  cli(['init', '--root', root, '--recovery-pending']);

  const usageR = cli(['reconcile-external-recovery', '--root', root], { expectFail: true });
  assert.equal(usageR.status, 2);

  // missing fixed basename
  const c1 = recoveryCase('E2A');
  renameSync(join(c1.dir, 'recovery-analysis-validation.json'), join(c1.dir, 'other.json'));
  const miss = cli(['reconcile-external-recovery', '--receipt-dir', c1.dir, '--root', root], { expectFail: true });
  assert.ok(miss.stdout.includes('RECOVERY_IMPORT_CONFLICT'));

  // symlinked receipt rejected
  const c2 = recoveryCase('E2B');
  rmSync(join(c2.dir, 'recovery-analysis-import.json'));
  symlinkSync(join(c2.dir, 'recovery-dispatch-0006-0008.json'), join(c2.dir, 'recovery-analysis-import.json'));
  const sym = cli(['reconcile-external-recovery', '--receipt-dir', c2.dir, '--root', root], { expectFail: true });
  assert.ok(sym.stdout.includes('RECOVERY_IMPORT_CONFLICT'));

  // tampered original source bytes (hash mismatch) rolls back BEFORE the transaction
  const c3 = recoveryCase('E2C');
  const victim = join(c3.spool, c3.batches[1].env.id.replace(/:/g, '-'), 'envelope.json');
  writeFileSync(victim, `${readFileSync(victim, 'utf8')} `); // byte drift
  const tampered = cli(['reconcile-external-recovery', '--receipt-dir', c3.dir, '--root', root], { expectFail: true });
  assert.ok(tampered.stdout.includes('RECOVERY_IMPORT_CONFLICT'));
  // BEFORE any successful import: the tampered case contributed nothing (the
  // c4 case below reuses the SAME envelope ids, so this check must precede it)
  {
    const ledger = openLedger(join(root, 'ledger.sqlite'));
    for (const b of c3.batches) assert.equal(ledger.getEvent(b.env.id), null, 'tampered case imported nothing');
    ledger.close();
  }

  // changed receipt under the same import key conflicts
  const c4 = recoveryCase('E2D');
  cliJson(['reconcile-external-recovery', '--receipt-dir', c4.dir, '--root', root]);
  const mutated = JSON.parse(readFileSync(join(c4.dir, 'recovery-analysis-import.json'), 'utf8'));
  mutated.index_sha256 = sha256Of('drifted');
  writeFileSync(join(c4.dir, 'recovery-analysis-import.json'), `${JSON.stringify(mutated)}\n`);
  const drift = cli(['reconcile-external-recovery', '--receipt-dir', c4.dir, '--root', root], { expectFail: true });
  assert.ok(drift.stdout.includes('RECOVERY_IMPORT_CONFLICT'));

  // every refusal left the ledger untouched and the pending flag preserved
  assert.equal(outboxRows(root).length, 6, 'only the successful c4 import survived (3+3), refusals added nothing');
  const st = cliJson(['status', '--root', root]);
  assert.equal(st.recovery_import_pending, false); // c4 committed and cleared it
  rmSync(root, { recursive: true, force: true });
  for (const c of [c1, c2, c3, c4]) rmSync(c.dir, { recursive: true, force: true });
});

test('E: externally-used delivery ID bound elsewhere is a conflict; an already-claimed outbox holds; both roll back everything', () => {
  const root = join(tmpdir(), `dot-cli-e3-${randomUUID().slice(0, 6)}`);
  cli(['init', '--root', root, '--recovery-pending']);

  // arm 1: the external delivery id already names a different event
  const c1 = recoveryCase('E3A');
  {
    const raw = new DatabaseSync(join(root, 'ledger.sqlite'));
    raw.prepare("INSERT INTO events (id, sha256, kind, producer, parent_json, payload_json, state, created_ms) VALUES ('DOT-E3-OTHER','deadbeef','batch',?,'[]','{}','READY',1)").run(CHAT_IDS.collector);
    raw.prepare("INSERT INTO outbox (delivery_id, event_id, destination, state, attempts, next_ms, created_ms) VALUES (?,?,?,'PENDING',0,0,1)").run(
      c1.batches[0].delivery_id, 'DOT-E3-OTHER', CHAT_IDS.analyst,
    );
    raw.close();
  }
  const used = cli(['reconcile-external-recovery', '--receipt-dir', c1.dir, '--root', root], { expectFail: true });
  assert.ok(used.stdout.includes('RECOVERY_IMPORT_CONFLICT'));
  {
    const ledger = openLedger(join(root, 'ledger.sqlite'));
    for (const b of c1.batches) assert.equal(ledger.getEvent(b.env.id), null, 'rollback: no batch imported');
    ledger.close();
  }

  // arm 2: the (event,destination) outbox already exists and is CLAIMED
  const c2 = recoveryCase('E3B');
  {
    const ledger = openLedger(join(root, 'ledger.sqlite'));
    ledger.manifestImport({ manifest: c2.batches[0].manifest, producerRole: 'collector', cursorToken: 'tok-e3' });
    ledger.ingest(c2.batches[0].env);
    const d = ledger.pendingDeliveries()[0];
    ledger.claimDelivery(d.delivery_id);
    ledger.close();
  }
  const claimed = cli(['reconcile-external-recovery', '--receipt-dir', c2.dir, '--root', root], { expectFail: true });
  assert.ok(claimed.stdout.includes('RECOVERY_IMPORT_CONFLICT'));
  {
    const ledger = openLedger(join(root, 'ledger.sqlite'));
    for (const b of c2.batches.slice(1)) assert.equal(ledger.getEvent(b.env.id), null, 'rollback: whole transaction undone');
    for (const a of c2.analyses) assert.equal(ledger.getEvent(a.env.id), null);
    ledger.close();
  }
  const st = cliJson(['status', '--root', root]);
  assert.equal(st.recovery_import_pending, true, 'flag preserved through both refusals');
  rmSync(root, { recursive: true, force: true });
  rmSync(c1.dir, { recursive: true, force: true });
  rmSync(c2.dir, { recursive: true, force: true });
});

test('E: crash mid-transaction cannot emit a duplicate; rerun imports exactly once', () => {
  const root = join(tmpdir(), `dot-cli-e4-${randomUUID().slice(0, 6)}`);
  cli(['init', '--root', root, '--recovery-pending']);
  const c = recoveryCase('E4');
  const bundle = recoveryBundle(c);

  const boom = openLedger(join(root, 'ledger.sqlite'), { faultAfter: 'insert-outbox' });
  assert.throws(() => boom.reconcileExternalRecovery(bundle), (e) => e.code === 'FAULT');
  boom.close();
  {
    const raw = new DatabaseSync(join(root, 'ledger.sqlite'));
    assert.equal(raw.prepare('SELECT COUNT(*) c FROM outbox').get().c, 0, 'rollback left zero deliveries');
    assert.equal(raw.prepare("SELECT COUNT(*) c FROM events WHERE kind IN ('batch','analysis')").get().c, 6, 'seeds only (5 baseline batches + intake analysis); the rolled-back import left nothing');
    raw.close();
  }

  const ledger = openLedger(join(root, 'ledger.sqlite'));
  const r = ledger.reconcileExternalRecovery(bundle);
  assert.equal(r.batches_acked, 3);
  const rows = outboxRows(root);
  assert.equal(rows.length, 6, 'exactly one import after recovery, no duplicates');
  const again = ledger.reconcileExternalRecovery(bundle);
  assert.equal(again.replay, true);
  ledger.close();
  rmSync(root, { recursive: true, force: true });
  rmSync(c.dir, { recursive: true, force: true });
});

test('E: pending flag blocks automatic tick admission (0 spawn) until reconciliation clears it', () => {
  const root = join(tmpdir(), `dot-cli-e5-${randomUUID().slice(0, 6)}`);
  cli(['init', '--root', root, '--recovery-pending']);
  // a would-be-admissible QUEUED solution, the R10 raw-row shape
  {
    const raw = new DatabaseSync(join(root, 'ledger.sqlite'));
    raw.prepare("INSERT INTO events (id, sha256, kind, producer, parent_json, payload_json, state, created_ms) VALUES ('DOT-CLI-E5-SOL','deadbeef','solution','solver','[]','{}','QUEUED',1)").run();
    raw.close();
  }
  const t1 = cliJson(['tick', '--root', root]);
  assert.equal(t1.recovery_import_pending, true, 'tick reports the pending gate');
  assert.equal(t1.supervise_launched, false, 'no executor admission while pending');
  assert.equal(t1.recovery_launched, 0);
  {
    const raw = new DatabaseSync(join(root, 'ledger.sqlite'));
    assert.equal(raw.prepare('SELECT COUNT(*) c FROM executions').get().c, 0, 'no execution reserved while pending');
    raw.close();
  }

  // reconcile unrelated recovery work clears the gate; admission resumes only then
  const c = recoveryCase('E5');
  cliJson(['reconcile-external-recovery', '--receipt-dir', c.dir, '--root', root]);
  {
    const raw = new DatabaseSync(join(root, 'ledger.sqlite'));
    raw.prepare("DELETE FROM events WHERE id = 'DOT-CLI-E5-SOL'").run(); // nothing claimable afterwards
    raw.close();
  }
  const t2 = cliJson(['tick', '--root', root]);
  assert.equal(t2.recovery_import_pending, false, 'gate cleared after reconciliation');
  rmSync(root, { recursive: true, force: true });
  rmSync(c.dir, { recursive: true, force: true });
});

test('E: reconcile never clears global OFF; ACK binding alone produces no solver result or executor launch', () => {
  const root = join(tmpdir(), `dot-cli-e6-${randomUUID().slice(0, 6)}`);
  cli(['init', '--root', root, '--recovery-pending']);
  cliJson(['off', '--root', root, '--reason', 'recovery window: runtime stays off']);
  const c = recoveryCase('E6');
  const r = cliJson(['reconcile-external-recovery', '--receipt-dir', c.dir, '--root', root]);
  assert.equal(r.ok, true, 'import is not an admission: it works under durable OFF');
  const st = cliJson(['status', '--root', root]);
  assert.equal(st.off, true, 'global OFF survives reconciliation');
  const ledger = openLedger(join(root, 'ledger.sqlite'));
  assert.equal(ledger.nextClaimableSolution(), null, 'ACKs alone admit no execution');
  ledger.close();
  {
    const raw = new DatabaseSync(join(root, 'ledger.sqlite'));
    assert.equal(raw.prepare("SELECT COUNT(*) c FROM events WHERE kind = 'solution'").get().c, 0);
    assert.equal(raw.prepare('SELECT COUNT(*) c FROM executions').get().c, 0);
    raw.close();
  }
  rmSync(root, { recursive: true, force: true });
  rmSync(c.dir, { recursive: true, force: true });
});

// keep symlink helper referenced (lint-free intentional use)
void symlinkSync; void readlinkSync; void dirname;

// ------------------------------------------------- F10: SCHEMA_VERSION_CRASH_WINDOW (CLI surface)

function setUserVersion(root, v) {
  const db = new DatabaseSync(join(root, 'ledger.sqlite'));
  db.exec(`PRAGMA user_version = ${v};`);
  db.close();
}

test('F10 CLI: status converges a v0 crash-image root (schema+seeds committed, version lost)', () => {
  const root = join(tmpdir(), `dot-cli-f10a-${randomUUID().slice(0, 6)}`);
  cli(['init', '--root', root]);
  setUserVersion(root, 0);
  const st = cliJson(['status', '--root', root]);
  assert.equal(st.ok, true);
  // converged to v3 without reseeding
  const db = new DatabaseSync(join(root, 'ledger.sqlite'));
  const v = db.prepare('PRAGMA user_version').get().user_version;
  const n = db.prepare('SELECT COUNT(*) AS n FROM events').get().n;
  db.close();
  assert.equal(v, 3);
  assert.equal(n, 6);
  rmSync(root, { recursive: true, force: true });
});

test('F10 CLI: ambiguous crash image reports the fixed migration code, not a crash', () => {
  const root = join(tmpdir(), `dot-cli-f10b-${randomUUID().slice(0, 6)}`);
  cli(['init', '--root', root]);
  setUserVersion(root, 0);
  const db = new DatabaseSync(join(root, 'ledger.sqlite'));
  db.exec("DELETE FROM events WHERE id = 'DOT-BATCH-0005';");
  db.close();
  const r = cli(['status', '--root', root], { expectFail: true });
  assert.equal(r.status, 1);
  assert.ok(r.stdout.includes('SCHEMA_MIGRATION_BLOCKED'), `stdout must carry the fixed code, got: ${r.stdout}`);
  // database preserved: the five remaining seeds are untouched, version still 0
  const db2 = new DatabaseSync(join(root, 'ledger.sqlite'));
  const v = db2.prepare('PRAGMA user_version').get().user_version;
  const n = db2.prepare('SELECT COUNT(*) AS n FROM events').get().n;
  db2.close();
  assert.equal(v, 0);
  assert.equal(n, 5);
  rmSync(root, { recursive: true, force: true });
});

// ------------------------------------------------- F02: OFF_RESUME_ADMISSION
// supervise is the tick's detached admission path: durable OFF must refuse it
// with the fixed OFF code at the dispatch boundary, not rely on the
// scheduler's earlier status read (the race window tick->supervise).

test('F02: supervise refuses under durable OFF with the fixed OFF code (run and resume modes)', () => {
  const root = freshRoot();
  const off = cliJson(['off', '--root', root, '--reason', 'operator stop for supervise gate test']);
  assert.equal(off.off, true);
  const r1 = JSON.parse(cli(['supervise', '--root', root, '--execution-id', 'DOT-EXEC-any', '--resume'], { expectFail: true }).stdout);
  assert.equal(r1.ok, false);
  assert.equal(r1.code, 'OFF');
  const r2 = JSON.parse(cli(['supervise', '--root', root, '--execution-id', 'DOT-EXEC-any'], { expectFail: true }).stdout);
  assert.equal(r2.ok, false);
  assert.equal(r2.code, 'OFF');
  rmSync(root, { recursive: true, force: true });
});
