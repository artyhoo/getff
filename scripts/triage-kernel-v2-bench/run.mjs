#!/usr/bin/env node
// S4 judge-run orchestrator (kickoff-s4 §3.1/§3.4/§3.5). Drives promptfoo eval over the exec
// provider (provider.mjs — judge model `sonnet` pinned BY NAME there, §3.4), parses the
// one-line output contract (C1) / id-keyed per-group lines (C2), gives every unparsed row or
// group exactly ONE re-run (T-TK2-E) using the provider's byte-identical claude invocation,
// and stamps the raw artifact with provenance: the S2 stamp shape plus the S4-added
// `benchInputSha256` field (arm H re-verifies it). A row/group still unparsed after its one
// re-run is a PARK (§9): the artifact is written with error fields set and raw preserved
// verbatim — NEVER hand-filled — and the process exits 1.
//
// The eval output JSON and the `.promptfoo/` cache are session-local byproducts, NOT stamped
// artifacts: the stamped substrate is bench-input.json (sha-gated below before any call).
//
// Usage: node scripts/triage-kernel-v2-bench/run.mjs c1|c2

import { execFile, spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildBenchInput, CORPUS_DIR, RUBRIC_REL } from './build-input.mjs';
import { buildC2Payload, groupBySource } from './make-tests.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const MODEL = 'sonnet'; // §3.4 — pinned by name, never tier-resolved; a swap is a PARK
const CLAUDE_ARGS = ['-p', '--model', MODEL, '--allowedTools', '', '--strict-mcp-config']; // frozen S2 shape
const LAYERS = new Set(['idea', 'design', 'architecture', 'plan', 'implementation']);
const WHOSE = new Set(['reviewer', 'advisor', 'operator-floor']);
// Frozen triple shape (triage-s0-run.mjs parse), enum-checked here: an out-of-enum value is
// an unparsed row (re-run then PARK), not a silently-kept label.
const TRIPLE_RE = /class=(MATERIAL|IMMATERIAL)\s+layer=([a-z-]+)\s+whose=([a-z-]+)/u;

const die = (msg) => { console.error(`[ERROR] ${msg}`); process.exit(1); };

function parseTriple(text) {
  const m = TRIPLE_RE.exec(text || '');
  if (!m) return null;
  const [, cls, layer, whose] = m;
  if (!LAYERS.has(layer) || !WHOSE.has(whose)) return null;
  return { class: cls, layer, whose };
}

/** Parse a C2 group blob. Extraction mirrors the frozen S2/C1 parse semantics
 * (triage-s0-run.mjs): the CONTRACT pattern is searched for, framing prose is tolerated.
 * Acceptance is still strict where ambiguity lives: every group id must appear EXACTLY once
 * as an id-keyed line with an enum-valid triple, no duplicate keys, and any NON-id line that
 * itself carries a triple REJECTS the whole group (ambiguous attribution). Decision recorded
 * 2026-08-16 after the first C2 pass: sonnet emits a one-line preamble («Looking at each
 * finding through the yardstick:») before id-keyed lines; a preamble with no triple is not
 * ambiguity. Positional/numbered keys («[1]:») are NOT accepted — an output that drops the
 * ids is unparsed (that variant appeared on a re-run and was rejected). */
function parseC2Group(raw, ids) {
  const want = new Set(ids);
  const seen = new Map();
  for (const line of String(raw || '').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const colon = t.indexOf(':');
    const head = colon >= 0 ? t.slice(0, colon).trim() : '';
    if (want.has(head)) {
      if (seen.has(head)) return null; // duplicate key — ambiguous
      seen.set(head, t.slice(colon + 1).trim());
    } else if (TRIPLE_RE.test(t)) {
      return null; // a triple outside an id-keyed line — ambiguous attribution
    } // else: framing prose with no triple — tolerated (frozen search-parse semantics)
  }
  const out = [];
  for (const id of ids) {
    const rest = seen.get(id);
    const triple = rest ? parseTriple(rest) : null;
    if (!triple) return null; // missing id or invalid/absent triple
    out.push({ id, ...triple, raw: `${id}: ${rest}` });
  }
  return out;
}

/** One judge call — byte-identical to provider.mjs / the S2 cold rater (triage-s0-run.mjs:56). */
function claudeCall(payload) {
  return new Promise((resolve) => {
    execFile(
      'claude',
      [...CLAUDE_ARGS, payload],
      { maxBuffer: 1 << 20, timeout: 600000 },
      (err, stdout) =>
        resolve(err ? { error: String(err.message).slice(0, 200), raw: '' } : { error: null, raw: (stdout || '').trim() }),
    );
  });
}

/** Run promptfoo eval with cwd = this dir (config/tests/provider are all relative). */
function runPromptfoo(configName, outFile) {
  return new Promise((resolve, reject) => {
    const child = spawn(join(HERE, '..', '..', 'node_modules', '.bin', 'promptfoo'), ['eval', '-c', configName, '-o', outFile], {
      cwd: HERE,
      env: { ...process.env, PROMPTFOO_DISABLE_TELEMETRY: '1', NO_COLOR: '1' },
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    const started = Date.now();
    const hb = setInterval(
      () => console.log(`[INFO] promptfoo eval running… ${Math.round((Date.now() - started) / 1000)}s stdout=${out.length}B stderr=${err.length}B`),
      60_000,
    );
    child.on('error', (e) => { clearInterval(hb); reject(e); });
    child.on('close', (code) => {
      clearInterval(hb);
      resolve({ code, out: out.slice(-4000), err: err.slice(-4000) });
    });
  });
}

const mode = process.argv[2];
if (mode !== 'c1' && mode !== 'c2') die('usage: node run.mjs c1|c2');

// 1. Substrate gate — rebuild from the frozen CSVs and compare against the stamped artifact
//    (kickoff §3.3 «re-derive, do not inherit»; a moved substrate is a PARK, not a rebuild).
const stamped = JSON.parse(readFileSync(join(HERE, 'bench-input.json'), 'utf8'));
const art = buildBenchInput();
if (art.rows.length !== 151) die(`labelable=${art.rows.length}, expected 151 — substrate moved (PARK)`);
if (art.sha256 !== stamped.sha256) die(`bench-input sha drift: stamped=${stamped.sha256.slice(0, 12)} rebuilt=${art.sha256.slice(0, 12)} (PARK)`);

// 2. Regenerate the DERIVED tests files from the same builder so eval input ⟺ substrate.
const regen = await new Promise((res) =>
  execFile('node', [join(HERE, 'make-tests.mjs')], { cwd: HERE }, (e, o) => res((o || e.message || '').trim().split('\n').pop())),
);
console.log(`[INFO] make-tests: ${regen}`);

// 3. promptfoo eval → parse output JSON keyed by testCase.description (= row id | group key).
const cfg = mode === 'c1' ? 'promptfoo.config.c1.yaml' : 'promptfoo.config.c2.yaml';
const outFile = join(HERE, `run-${mode}-out.json`);
const groups = groupBySource(art.rows);
console.log(`[INFO] mode=${mode} config=${cfg} tests=${mode === 'c1' ? art.rows.length : groups.length} benchInputSha256=${art.sha256}`);
const pf = await runPromptfoo(cfg, outFile);
if (pf.code !== 0) die(`promptfoo eval exited ${pf.code} — stdout(tail): ${pf.out} | stderr(tail): ${pf.err}`);
let evalOut;
try {
  evalOut = JSON.parse(readFileSync(outFile, 'utf8'));
} catch (e) {
  die(`unreadable eval output ${outFile}: ${e.message} — stdout(tail): ${pf.out}`);
}
// promptfoo 0.122 -o JSON = unified eval record (v3): per-test array at results.results.
const rows = evalOut.results?.results || [];
const byKey = new Map();
let cached = 0;
for (const r of rows) {
  const key = r.testCase?.description;
  if (!key) continue;
  const o = r.response?.output;
  if (r.response?.cached) cached += 1;
  byKey.set(key, {
    raw: typeof o === 'string' ? o.trim() : o ? JSON.stringify(o) : '',
    error: r.error ? String(r.error).slice(0, 200) : null,
  });
}
console.log(`[INFO] promptfoo results=${rows.length} matched=${byKey.size} cached=${cached}`);

const stamp = {
  rater: `s4-${mode}`,
  model: MODEL,
  rubric: art.rubricBytes,
  rubricSource: RUBRIC_REL,
  benchInputSha256: art.sha256,
};

if (mode === 'c1') {
  const results = [];
  let parsedFirst = 0;
  let rerun = 0;
  let failed = 0;
  for (const r of art.rows) {
    let { raw, error } = byKey.get(r.id) ?? { raw: '', error: 'missing from eval output' };
    let t = parseTriple(raw);
    if (t) parsedFirst += 1;
    else {
      rerun += 1;
      console.log(`[WARN] c1 unparsed id=${r.id} — one re-run (raw head ${JSON.stringify(raw.slice(0, 80))})`);
      const rr = await claudeCall(r.payload);
      raw = rr.raw;
      error = rr.error;
      t = parseTriple(raw);
    }
    if (!t) {
      failed += 1;
      error = error || 'unparsed after 1 re-run';
    }
    results.push({ id: r.id, raw, class: t ? t.class : null, layer: t ? t.layer : null, whose: t ? t.whose : null, error: t ? null : error });
  }
  writeFileSync(join(CORPUS_DIR, 's4-c1-sonnet.json'), `${JSON.stringify({ ...stamp, results }, null, 1)}\n`);
  console.log(`[INFO] c1 calls=${art.rows.length + rerun} parsed-first=${parsedFirst} rerun=${rerun} failed=${failed} cached=${cached}`);
  if (failed) die(`PARK: ${failed} row(s) unparsed after one re-run (T-TK2-E) — raw preserved in s4-c1-sonnet.json, never hand-filled`);
  console.log('[INFO] wrote docs/meta-factory/triage-corpus/s4-c1-sonnet.json');
} else {
  const stampedGroups = [];
  const results = [];
  let parsedFirst = 0;
  let rerun = 0;
  let failedGroups = 0;
  for (const g of groups) {
    const ids = g.rows.map((r) => r.id);
    let { raw, error } = byKey.get(g.key) ?? { raw: '', error: 'missing from eval output' };
    let parsed = parseC2Group(raw, ids);
    if (parsed) parsedFirst += 1;
    else {
      rerun += 1;
      console.log(`[WARN] c2 unparsed group=${g.key} n=${ids.length} — one re-run (raw head ${JSON.stringify(raw.slice(0, 80))})`);
      const rr = await claudeCall(buildC2Payload(art.rubricBytes, g.rows));
      raw = rr.raw;
      error = rr.error;
      parsed = parseC2Group(raw, ids);
    }
    stampedGroups.push({ key: g.key, rows: ids, raw }); // raw preserved verbatim (arm A(b) enumerates groups)
    if (parsed) {
      for (const p of parsed) results.push({ id: p.id, raw: p.raw, class: p.class, layer: p.layer, whose: p.whose, error: null });
    } else {
      failedGroups += 1;
      error = error || 'unparsed after 1 re-run';
      for (const id of ids) results.push({ id, raw: '', class: null, layer: null, whose: null, error });
    }
  }
  writeFileSync(join(CORPUS_DIR, 's4-c2-sonnet.json'), `${JSON.stringify({ ...stamp, groups: stampedGroups, results }, null, 1)}\n`);
  console.log(`[INFO] c2 groups=${groups.length} calls=${groups.length + rerun} per-group parse failures=${failedGroups} cached=${cached}`);
  if (failedGroups) die(`PARK: ${failedGroups} group(s) unparsed after one re-run — raw preserved in s4-c2-sonnet.json groups[].raw, never hand-filled`);
  console.log('[INFO] wrote docs/meta-factory/triage-corpus/s4-c2-sonnet.json');
}
