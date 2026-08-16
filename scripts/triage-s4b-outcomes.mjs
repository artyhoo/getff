#!/usr/bin/env node
// S4b outcome-audit driver + fail-closed gate (kickoff-s4b §3.5/§3.8). Establishes, for every
// one of the 151 labelable corpus rows, what the repository actually did about the finding,
// from the live tree + history. The register CSV is BUILT here from the auditor-seat raw
// output (s4b-audit-raw.json) — never hand-edited — and `--check` runs the seven arms A-G.
//
// Reuse is by IMPORT (parseCsv from the frozen probe — kickoff §2: import, never edit):
//   strata/grouping derivation — the kickoff §3.1/§3.2 one-liners, verbatim logic
//   canonical-block + prose reconciliation — the S4 arm-E pattern (triage-s4-score.mjs:403-433)
//   blob-freeze shape — triage-s4-score.mjs arm F (:435-459), base moved to the S4 squash
//
// Usage: node scripts/triage-s4b-outcomes.mjs            → driver: raw → s4b-outcomes.csv + numbers
//        node scripts/triage-s4b-outcomes.mjs --seats    → seat-input JSON (30 groups) to stdout
//        node scripts/triage-s4b-outcomes.mjs --check    → arms A-G, exit 1 on any RED

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseCsv } from './triage-corpus-probe.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(HERE);
const CHECK = process.argv.includes('--check');
const SEATS = process.argv.includes('--seats');

// §3.8 arm F: the S4 squash merge — never HEAD, never merge-base (both make the arm vacuous).
const FROZEN_S4 = 'fa8da9406c';
// §3.2: seats run on the pinned model; a substitution is a PARK (triage-s4-score.mjs:26 precedent).
const PINNED_MODEL = 'sonnet';
const POPULATIONS = ['audit-1369', 's4-round7', 'arch-reviews', 'kickoff-loops', 'td-m3', 'research-forks'];
const CORPUS_DIR = join(REPO_ROOT, 'docs/meta-factory/triage-corpus');
const REGISTER_REL = 'docs/meta-factory/research-patches/2026-08-16-triage-kernel-v2-s4b-outcome-audit.md';
const S4_REPORT_REL = 'docs/meta-factory/research-patches/2026-08-16-triage-kernel-v2-s4-bench.md';
const RESERVED_HEADING = '## Outcome axis (filled by S4b)';
const NEXT_HEADING = '## Self-application (T15)';
const OUTCOMES = ['HOLDS', 'DRIFTED', 'NEVER-DONE', 'MOVED', 'DECLINED', 'UNVERIFIABLE'];
const COSTS = ['VISIBLE', 'NONE-FOUND', 'N/A'];
const WITNESS_BEARING = new Set(['HOLDS', 'DRIFTED', 'MOVED', 'DECLINED']);
// §2 permitted create/edit set — arm G's converse direction allows exactly these on the branch.
const PERMITTED_DIFF = new Set([
  'docs/meta-factory/triage-corpus/s4b-outcomes.csv',
  'docs/meta-factory/triage-corpus/s4b-audit-raw.json',
  'scripts/triage-s4b-outcomes.mjs',
  'docs/meta-factory/research-patches/2026-08-16-triage-kernel-v2-s4b-outcome-audit.md',
  'docs/meta-factory/triage-corpus/README.md',
  'docs/meta-factory/research-patches/2026-08-16-triage-kernel-v2-s4-bench.md',
]);

const die = (msg) => { console.error(`[ERROR] ${msg}`); process.exit(1); };
const norm = (s) => (s ?? '').replace(/\s+/gu, ' ').trim();

// ==== Substrate: the 151 labelable rows, their strata (§3.1) and groups (§3.2) ====
const popById = new Map();
for (const name of POPULATIONS) {
  for (const r of parseCsv(readFileSync(join(CORPUS_DIR, `${name}.csv`), 'utf8'))) popById.set(r.id, r);
}
const finalRows = parseCsv(readFileSync(join(CORPUS_DIR, 's3-final.csv'), 'utf8'));
const finalById = new Map(finalRows.map((r) => [r.id, r]));
const labelable = finalRows.filter((r) => popById.has(r.id)); // 151 — s3-final minus author-cell

// §3.1 verbatim: trailing `context` segment → path guess; no path = D; sources/ = B; exists = A; else C.
const contextPath = (r) => {
  const t = (r.context || '').split('·').pop().trim();
  return /[\w./-]+\.[a-z]{1,6}/i.test(t) ? t.replace(/:.*$/, '') : null;
};
const stratumOf = (r) => {
  const p = contextPath(r);
  if (!p) return 'D';
  if (/^sources\//.test(p)) return 'B';
  return existsSync(join(REPO_ROOT, p)) ? 'A' : 'C';
};
// §3.2 verbatim: pr-body → leading digits of source (PR id); review-report → source verbatim.
const groupKey = (r) => (r.provenance === 'pr-body'
  ? (String(r.source).match(/^\d{3,5}/) || ['?'])[0]
  : r.source);

const strat = new Map(labelable.map((r) => [r.id, stratumOf(popById.get(r.id))]));
const groupOf = new Map(labelable.map((r) => [r.id, groupKey(popById.get(r.id))]));
const groupIds = new Map();
for (const r of labelable) {
  const g = groupOf.get(r.id);
  if (!groupIds.has(g)) groupIds.set(g, []);
  groupIds.get(g).push(r.id);
}
const strataCounts = { A: 0, B: 0, C: 0, D: 0 };
for (const id of strat.keys()) strataCounts[strat.get(id)] += 1;
console.error(`[INFO] strata (§3.1): {A:${strataCounts.A}, B:${strataCounts.B}, C:${strataCounts.C}, D:${strataCounts.D}} — expect {A:92, B:44, C:8, D:7}`);
console.error(`[INFO] grouping (§3.2): {rows:${labelable.length}, groups:${groupIds.size}} — expect {rows:151, groups:30}`);

// ==== --seats: seat-input JSON (id/finding/context/orig_grade/stratum — NO adjudicated columns) ====
if (SEATS) {
  const out = [...groupIds.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([group, ids]) => ({
    group,
    rows: ids.map((id) => {
      const p = popById.get(id);
      return { id, finding: p.finding, context: p.context, orig_grade: p.orig_grade, stratum: strat.get(id) };
    }),
  }));
  console.log(JSON.stringify(out, null, 1));
  process.exit(0);
}

// ==== Register loading (driver reads raw; --check reads CSV + raw + register + S4 report) ====
const RAW_PATH = join(CORPUS_DIR, 's4b-audit-raw.json');
const CSV_PATH = join(CORPUS_DIR, 's4b-outcomes.csv');
const raw = existsSync(RAW_PATH) ? JSON.parse(readFileSync(RAW_PATH, 'utf8')) : null;
const rawById = new Map();
if (raw) for (const g of raw) for (const r of g.rows) rawById.set(r.id, r);
const csvRows = existsSync(CSV_PATH) ? parseCsv(readFileSync(CSV_PATH, 'utf8')) : null;
const csvById = new Map((csvRows ?? []).map((r) => [r.id, r]));

const KEY = { HOLDS: 'holds', 'DRIFTED': 'drifted', 'NEVER-DONE': 'never_done', MOVED: 'moved', DECLINED: 'declined', UNVERIFIABLE: 'unverifiable' };
const COST_KEY = { VISIBLE: 'cost_visible', 'NONE-FOUND': 'cost_none_found', 'N/A': 'cost_na' };

// Canonical numbers — recomputed from the register CSV joined to s3-final (arm E reconciles
// the drift register's s4b-numbers block against exactly these).
function computeNum(rows) {
  const NUM = { total: String(rows.length) };
  for (const o of OUTCOMES) NUM[KEY[o]] = '0';
  for (const c of COSTS) NUM[COST_KEY[c]] = '0';
  for (const s of ['A', 'B', 'C', 'D']) for (const o of OUTCOMES) NUM[`${s}_${KEY[o]}`] = '0';
  for (const cls of ['material', 'immaterial']) for (const o of OUTCOMES) NUM[`${cls}_${KEY[o]}`] = '0';
  NUM.agree_material_visible = '0';
  NUM.agree_immaterial_nonefound = '0';
  NUM.disagreement_rows = '0';
  const disagreement = [];
  for (const r of rows) {
    const cls = finalById.get(r.id)?.class_final;
    NUM[KEY[r.outcome]] = String(Number(NUM[KEY[r.outcome]]) + 1);
    NUM[COST_KEY[r.cost]] = String(Number(NUM[COST_KEY[r.cost]]) + 1);
    NUM[`${r.stratum}_${KEY[r.outcome]}`] = String(Number(NUM[`${r.stratum}_${KEY[r.outcome]}`]) + 1);
    const clsKey = cls === 'MATERIAL' ? 'material' : 'immaterial';
    NUM[`${clsKey}_${KEY[r.outcome]}`] = String(Number(NUM[`${clsKey}_${KEY[r.outcome]}`]) + 1);
    if (cls === 'MATERIAL' && (r.outcome === 'DRIFTED' || r.outcome === 'NEVER-DONE') && r.cost === 'VISIBLE') {
      NUM.agree_material_visible = String(Number(NUM.agree_material_visible) + 1);
    }
    if (cls === 'IMMATERIAL' && r.outcome === 'NEVER-DONE' && r.cost === 'NONE-FOUND') {
      NUM.agree_immaterial_nonefound = String(Number(NUM.agree_immaterial_nonefound) + 1);
    }
    // Mechanical disagreement definition (stated openly in the register): the two shapes where
    // the outcome axis pushes against the adjudicated label — consequence on an IMMATERIAL row,
    // or a recorded deliberate decline on a MATERIAL row. Published, never resolved (§0).
    if ((cls === 'IMMATERIAL' && r.cost === 'VISIBLE') || (cls === 'MATERIAL' && r.outcome === 'DECLINED')) {
      disagreement.push(r.id);
    }
  }
  NUM.disagreement_rows = String(disagreement.length);
  return { NUM, disagreement };
}

const HEADLINE_KEYS = ['total', 'holds', 'drifted', 'never_done', 'moved', 'declined', 'unverifiable',
  'agree_material_visible', 'agree_immaterial_nonefound', 'disagreement_rows'];

// ==== Driver mode: raw → s4b-outcomes.csv (the register is never hand-written) ====
if (!CHECK) {
  if (!raw) die('s4b-audit-raw.json missing — run the 30 auditor seats first (kickoff §3.2)');
  if (rawById.size !== labelable.length) {
    die(`raw covers ${rawById.size} ids, expected ${labelable.length} — a seat is missing or duplicated`);
  }
  const csvEscape = (v) => (/[",\n]/u.test(v) ? `"${v.replace(/"/gu, '""')}"` : v);
  const lines = ['id,stratum,outcome,cost,witness,rationale'];
  for (const r of labelable) { // s3-final order — deterministic
    const v = rawById.get(r.id);
    lines.push([r.id, strat.get(r.id), v.outcome, v.cost, v.witness, v.rationale].map(csvEscape).join(','));
  }
  writeFileSync(CSV_PATH, `${lines.join('\n')}\n`);
  const { NUM } = computeNum(labelable.map((r) => ({ id: r.id, stratum: strat.get(r.id), ...rawById.get(r.id) })));
  console.log(`[INFO] wrote docs/meta-factory/triage-corpus/s4b-outcomes.csv rows=${labelable.length}`);
  console.log('\n<!-- s4b-numbers (canonical block — pasted verbatim into the drift register; arm E reconciles)');
  for (const [k, v] of Object.entries(NUM)) console.log(`${k}=${v}`);
  console.log('-->');
  process.exit(0);
}

// ==== --check arms (§3.8) ====
const reds = [];
let okCount = 0;
const RED = (arm, id, reason) => { reds.push(`${arm}:${id}`); console.error(`ARM ${arm} RED ${id ?? '-'}: ${reason}`); };
const OK = (arm, evidence) => { okCount += 1; console.log(`ARM ${arm} ok (${evidence})`); };
const git = (args) => execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();

if (strataCounts.A !== 92 || strataCounts.B !== 44 || strataCounts.C !== 8 || strataCounts.D !== 7 || labelable.length !== 151 || groupIds.size !== 30) {
  RED('A', '-', `substrate moved: strata=${JSON.stringify(strataCounts)} rows=${labelable.length} groups=${groupIds.size} — kickoff §9 PARK, do not adapt`);
}

// --- ARM A — completeness + registration ---
{
  let ok = true;
  if (!csvRows) { RED('A', 's4b-outcomes.csv', 'missing — run the driver first'); ok = false; }
  else {
    if (csvRows.length !== 151) { RED('A', 's4b-outcomes.csv', `rows=${csvRows.length} expected 151`); ok = false; }
    const ids = csvRows.map((r) => r.id);
    if (new Set(ids).size !== ids.length) { RED('A', '-', 'duplicate id in register'); ok = false; }
    const finalIds = new Set(finalRows.map((r) => r.id));
    const extra = ids.filter((x) => !finalIds.has(x));
    const missing = [...finalIds].filter((x) => !csvById.has(x));
    if (extra.length) { RED('A', extra[0], 'id not in s3-final.csv (no extras allowed)'); ok = false; }
    if (missing.length) { RED('A', missing[0], 's3-final id missing from register (no gaps allowed)'); ok = false; }
    const header = readFileSync(CSV_PATH, 'utf8').split('\n')[0].trim();
    if (header !== 'id,stratum,outcome,cost,witness,rationale') { RED('A', 's4b-outcomes.csv', `header mismatch: ${header}`); ok = false; }
  }
  // A(c): every s4b-* artifact in the corpus dir is registered in the README Files table with a
  // rows=<n> token matching its real count. The S2 gate's arm D only iterates README table rows
  // over .csv refs — it cannot see an artifact that was never listed; this closes that half.
  const readme = existsSync(join(CORPUS_DIR, 'README.md')) ? readFileSync(join(CORPUS_DIR, 'README.md'), 'utf8') : '';
  for (const f of readdirSync(CORPUS_DIR).filter((x) => /^s4b-/u.test(x))) {
    const row = readme.split('\n').find((l) => l.startsWith('|') && l.includes(f));
    if (!row) { RED('A', f, 's4b-* artifact in corpus dir but no README Files-table row'); ok = false; continue; }
    const tok = /rows=(\d+)/u.exec(row);
    if (!tok) { RED('A', f, 'README Files-table row carries no rows=<n> token'); ok = false; continue; }
    let real;
    if (f.endsWith('.csv')) real = parseCsv(readFileSync(join(CORPUS_DIR, f), 'utf8')).length;
    else if (f.endsWith('.json')) {
      const j = JSON.parse(readFileSync(join(CORPUS_DIR, f), 'utf8'));
      real = j.reduce((s, g) => s + (g.rows?.length ?? 0), 0);
    } else { RED('A', f, 'unrecognized s4b-* artifact kind'); ok = false; continue; }
    if (Number(tok[1]) !== real) { RED('A', f, `README rows=${tok[1]} but real count ${real}`); ok = false; }
  }
  if (ok) OK('A', '151 ids join 1:1 to s3-final (no extras/gaps); every s4b-* artifact README-registered with matching rows= token');
}

// --- ARM B — enum validity + stratum consistency ---
{
  let ok = true;
  if (!csvRows) { RED('B', '-', 'register missing'); ok = false; }
  else for (const r of csvRows) {
    if (!OUTCOMES.includes(r.outcome)) { RED('B', r.id, `outcome '${r.outcome}' outside enum`); ok = false; break; }
    if (!COSTS.includes(r.cost)) { RED('B', r.id, `cost '${r.cost}' outside enum`); ok = false; break; }
    if (!['A', 'B', 'C', 'D'].includes(r.stratum)) { RED('B', r.id, `stratum '${r.stratum}' outside A/B/C/D`); ok = false; break; }
    if (r.stratum !== strat.get(r.id)) { RED('B', r.id, `stratum ${r.stratum} != re-derived ${strat.get(r.id)} (§3.1)`); ok = false; break; }
  }
  if (ok) OK('B', 'all 151 rows: outcome/cost in enum, stratum ∈ A-D and equal to the §3.1 re-derivation');
}

// --- ARM C — witness discipline ---
{
  let ok = true;
  if (!csvRows) { RED('C', '-', 'register missing'); ok = false; }
  else for (const r of csvRows) {
    const finding = norm(popById.get(r.id)?.finding);
    const rationale = norm(r.rationale);
    if (rationale.length < 20) { RED('C', r.id, `rationale ${rationale.length} chars < 20 (§3.5)`); ok = false; break; }
    if (finding && finding.startsWith(rationale)) { RED('C', r.id, 'rationale is a prefix of the row finding — restatement, not evidence'); ok = false; break; }
    if (r.cost === 'VISIBLE' && !/[\/#]|\d/u.test(rationale)) {
      RED('C', r.id, 'cost=VISIBLE but rationale names no artifact (no path/PR/SHA-like token) — VISIBLE requires a NAMED later artifact');
      ok = false; break;
    }
    if (WITNESS_BEARING.has(r.outcome)) {
      if (!r.witness || r.witness === 'none') { RED('C', r.id, `outcome ${r.outcome} must carry a witness`); ok = false; break; }
      // Line-form grammar: path:N | path:N-M | path:N,M,... (comma list of N / N-M tokens) — seats
      // legitimately cite multi-line evidence spans verbatim; every referenced line must exist.
      // A BARE path (no line) stays invalid: §3.8 arm C requires the line to exist IN the file.
      const mLine = /^(.+):(\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*)$/u.exec(r.witness);
      const mSect = !mLine && /^(.+)#([^#]+)$/u.exec(r.witness);
      if (mLine) {
        const p = join(REPO_ROOT, mLine[1]);
        if (!existsSync(p)) { RED('C', r.id, `witness file '${mLine[1]}' does not exist`); ok = false; break; }
        const lines = readFileSync(p, 'utf8').split('\n').length;
        for (const tok of mLine[2].split(',')) {
          const mm = /^(\d+)(?:-(\d+))?$/u.exec(tok);
          const lo = mm ? Number(mm[1]) : 0;
          const hi = mm ? (mm[2] ? Number(mm[2]) : lo) : 0;
          if (!mm || hi < lo || lo < 1 || hi > lines) {
            RED('C', r.id, `witness ${r.witness}: line token '${tok}' malformed or outside file (1..${lines})`); ok = false; break;
          }
        }
        if (!ok) break;
      } else if (mSect) {
        const p = join(REPO_ROOT, mSect[1]);
        if (!existsSync(p)) { RED('C', r.id, `witness file '${mSect[1]}' does not exist`); ok = false; break; }
        const tok = mSect[2].replace(/^§\s*/u, '').trim();
        const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
        const re = /^\d+$/u.test(tok)
          ? new RegExp(`(?:^|[^0-9])${esc(tok)}(?![0-9])`, 'u')
          : new RegExp(esc(tok), 'iu');
        const hit = readFileSync(p, 'utf8').split('\n').some((l) => /^#{1,6}\s/u.test(l) && re.test(l));
        if (!hit) { RED('C', r.id, `witness ${r.witness}: no heading in '${mSect[1]}' contains section token '${tok}'`); ok = false; break; }
      } else { RED('C', r.id, `witness '${r.witness}' is neither path:line nor path#section`); ok = false; break; }
    } else if (r.witness !== 'none') {
      RED('C', r.id, `outcome ${r.outcome} must carry witness=none (NEVER-DONE/UNVERIFIABLE)`); ok = false; break;
    }
  }
  if (ok) OK('C', 'every HOLDS/DRIFTED/MOVED/DECLINED witness resolves (file+line in range, or heading matches section token); NEVER-DONE/UNVERIFIABLE carry witness=none; all rationales ≥20 chars, non-restatement, VISIBLE names an artifact');
}

// --- ARM D — raw join + seat provenance (outcomes come from auditor seats and nowhere else) ---
{
  let ok = true;
  if (!raw) { RED('D', 's4b-audit-raw.json', 'missing'); ok = false; }
  else if (!Array.isArray(raw)) { RED('D', 's4b-audit-raw.json', 'not an array of per-group objects'); ok = false; }
  else {
    const seen = new Map();
    for (const g of raw) {
      if (!groupIds.has(g.group)) { RED('D', g.group, 'group key not in the 30 derived §3.2 keys'); ok = false; break; }
      if (g.model !== PINNED_MODEL) { RED('D', g.group, `model='${g.model}' != pinned '${PINNED_MODEL}' — a substitution is a PARK`); ok = false; break; }
      if (!g.startedAt || typeof g.startedAt !== 'string') { RED('D', g.group, 'startedAt empty/absent'); ok = false; break; }
      const want = new Set(groupIds.get(g.group));
      const got = new Set((g.rows ?? []).map((r) => r.id));
      if (want.size !== got.size || [...want].some((x) => !got.has(x))) {
        RED('D', g.group, 'seat rows do not partition this group\'s corpus rows exactly'); ok = false; break;
      }
      for (const id of got) {
        if (seen.has(id)) { RED('D', id, `id appears in two groups (${seen.get(id)} and ${g.group})`); ok = false; }
        seen.set(id, g.group);
      }
      if (!ok) break;
    }
    if (ok && seen.size !== 151) { RED('D', '-', `raw union covers ${seen.size} of 151 ids`); ok = false; }
    if (ok && csvRows) {
      for (const r of csvRows) {
        const v = rawById.get(r.id);
        if (!v) { RED('D', r.id, 'register row has no backing auditor line'); ok = false; break; }
        if (v.outcome !== r.outcome || v.cost !== r.cost || v.witness !== r.witness || norm(v.rationale) !== norm(r.rationale)) {
          RED('D', r.id, 'register row differs from its raw auditor line (register must be driver-built, never hand-edited)'); ok = false; break;
        }
      }
    }
  }
  if (ok) OK('D', '30 groups × pinned sonnet × startedAt present; group ids partition the corpus exactly; union=151, no id twice; every register row traces to its raw line');
}

// --- ARM E — report reconciliation (block equality + headline prose in BOTH documents) ---
{
  const { NUM, disagreement } = csvRows ? computeNum(csvRows) : { NUM: {}, disagreement: [] };
  const rp = join(REPO_ROOT, REGISTER_REL);
  if (!csvRows || Object.keys(NUM).length === 0) RED('E', '-', 'no register to reconcile');
  else if (!existsSync(rp)) RED('E', REGISTER_REL, 'drift register missing');
  else {
    const text = readFileSync(rp, 'utf8');
    const block = /<!-- s4b-numbers[^\n]*\n([\s\S]*?)-->/u.exec(text);
    if (!block) RED('E', REGISTER_REL, 's4b-numbers block missing');
    else {
      const reported = new Map(block[1].trim().split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
      const missing = Object.keys(NUM).filter((k) => !reported.has(k));
      const drift = [...reported.entries()].filter(([k, v]) => NUM[k] !== undefined && NUM[k] !== v);
      const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
      const prose = text.replace(/<!-- s4b-numbers[\s\S]*?-->/u, '');
      const absentInProse = HEADLINE_KEYS.filter((k) => !new RegExp(`(?<![\\d.])${esc(NUM[k])}(?!\\d|\\.\\d)`, 'u').test(prose));
      // Drift-table completeness: every DRIFTED / NEVER-DONE row must appear in the register text.
      const rottedIds = csvRows.filter((r) => r.outcome === 'DRIFTED' || r.outcome === 'NEVER-DONE').map((r) => r.id);
      const absentRot = rottedIds.filter((id) => !prose.includes(id));
      // Disagreement table: exactly the mechanical disagreement ids appear.
      const absentDis = disagreement.filter((id) => !prose.includes(id));
      if (missing.length) RED('E', missing[0], `number in scorer output but absent from register block (${missing.length} missing)`);
      else if (drift.length) RED('E', drift[0][0], `register block says '${drift[0][1]}' scorer says '${NUM[drift[0][0]]}'`);
      else if (absentInProse.length) RED('E', absentInProse[0], `headline '${NUM[absentInProse[0]]}' not in register prose outside the block`);
      else if (absentRot.length) RED('E', absentRot[0], 'DRIFTED/NEVER-DONE row missing from the ranked drift table');
      else if (absentDis.length) RED('E', absentDis[0], 'disagreement-table row missing from register prose');
      else {
        // Outcome-axis section (S4's reserved section) must carry the same headlines.
        const s4 = readFileSync(join(REPO_ROOT, S4_REPORT_REL), 'utf8');
        const hIdx = s4.indexOf(RESERVED_HEADING);
        const nIdx = s4.indexOf(NEXT_HEADING);
        if (hIdx < 0 || nIdx < 0 || nIdx < hIdx) RED('E', S4_REPORT_REL, 'reserved outcome-axis section not found before Self-application');
        else {
          const section = s4.slice(hIdx, nIdx);
          const absentSect = HEADLINE_KEYS.filter((k) => !new RegExp(`(?<![\\d.])${esc(NUM[k])}(?!\\d|\\.\\d)`, 'u').test(section));
          if (absentSect.length) RED('E', absentSect[0], `headline '${NUM[absentSect[0]]}' not in the outcome-axis section`);
          else OK('E', `all ${Object.keys(NUM).length} numbers reconcile (block == recomputation); headlines present in register prose, ranked table complete (${rottedIds.length} rotted rows), disagreement table complete (${disagreement.length}); outcome-axis section carries the headlines`);
        }
      }
    }
  }
}

// --- ARM F — substrate immutability by blob hash at the S4 squash + reserved-section-only edit ---
{
  const files = [
    ...POPULATIONS.map((n) => `docs/meta-factory/triage-corpus/${n}.csv`),
    'docs/meta-factory/triage-corpus/s0-c1-sonnet.json',
    'docs/meta-factory/triage-corpus/s0-fable-rationales.md',
    'docs/meta-factory/triage-corpus/s0-probe.csv',
    'docs/meta-factory/triage-corpus/s0-raters.csv',
    'docs/meta-factory/triage-corpus/s2-cold-sonnet.json',
    'docs/meta-factory/triage-corpus/s2-labels.csv',
    'docs/meta-factory/triage-corpus/s2-rubric-whose.md',
    'docs/meta-factory/triage-corpus/s3-adjudication.csv',
    'docs/meta-factory/triage-corpus/s3-final.csv',
    'docs/meta-factory/triage-corpus/s4-bench.csv',
    'docs/meta-factory/triage-corpus/s4-c1-sonnet.json',
    'docs/meta-factory/triage-corpus/s4-c2-sonnet.json',
    'scripts/triage-corpus-probe.mjs', 'scripts/triage-s0-run.mjs', 'scripts/triage-s0-score.mjs',
    'scripts/triage-s2-labels-check.mjs', 'scripts/triage-s3-agreement.mjs', 'scripts/triage-s4-score.mjs',
  ];
  const walk = (d) => readdirSync(join(REPO_ROOT, d), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]));
  files.push(...walk('docs/meta-factory/triage-corpus/sources'));
  files.push(...walk('scripts/triage-kernel-v2-bench'));
  let ok = true;
  for (const f of files) {
    try {
      const at = git(['rev-parse', `${FROZEN_S4}:${f}`]);
      const now = git(['hash-object', f]);
      if (at !== now) { RED('F', f, `blob ${now.slice(0, 12)} != ${FROZEN_S4}:${at.slice(0, 12)} — frozen substrate edited`); ok = false; break; }
    } catch (e) {
      RED('F', f, `not resolvable at ${FROZEN_S4} (${String(e.message).split('\n')[0].slice(0, 120)})`); ok = false; break;
    }
  }
  // S4's bench report: everything outside the reserved section is byte-identical to the blob;
  // the reserved heading occurs exactly once (insertion, never append — Self-application and
  // the s4-numbers block follow it and are part of the protected tail).
  try {
    const blobText = execFileSync('git', ['show', `${FROZEN_S4}:${S4_REPORT_REL}`], { cwd: REPO_ROOT, encoding: 'utf8' });
    const curText = readFileSync(join(REPO_ROOT, S4_REPORT_REL), 'utf8');
    const splitAt = (t) => {
      const i = t.indexOf(RESERVED_HEADING);
      return i < 0 ? null : [t.slice(0, i), t.slice(i)];
    };
    const curParts = splitAt(curText);
    const blobParts = splitAt(blobText);
    if (!curParts || !blobParts) { RED('F', S4_REPORT_REL, 'reserved heading missing (current or blob)'); ok = false; }
    else if (curParts[0] !== blobParts[0]) { RED('F', S4_REPORT_REL, 'text BEFORE the reserved section changed — only the section body may be edited'); ok = false; }
    else {
      const tailOf = (t) => t.slice(t.indexOf(NEXT_HEADING));
      if (tailOf(curParts[1]) !== tailOf(blobParts[1])) { RED('F', S4_REPORT_REL, `text from '${NEXT_HEADING}' onward changed — protected tail`); ok = false; }
      else if (curText.split(RESERVED_HEADING).length - 1 !== 1) { RED('F', S4_REPORT_REL, 'reserved heading not exactly once'); ok = false; }
    }
  } catch (e) {
    RED('F', S4_REPORT_REL, `S4 report not resolvable at ${FROZEN_S4}`); ok = false;
  }
  if (ok) OK('F', `${files.length} substrate files byte-identical to ${FROZEN_S4}; S4 report diff confined to the reserved outcome-axis section (prefix+tail byte-equal, heading once)`);
}

// --- ARM G — repair ceiling + branch-diff containment, both directions ---
{
  let ok = true;
  const repairs = [];
  const rp = join(REPO_ROOT, REGISTER_REL);
  if (existsSync(rp)) {
    for (const m of readFileSync(rp, 'utf8').matchAll(/^repair:\s*id=(\S+)\s+sha=(\S+)\s+file=(\S+)\s*$/gmu)) {
      repairs.push({ id: m[1], sha: m[2], file: m[3] });
    }
  }
  if (repairs.length > 5) { RED('G', '-', `${repairs.length} registered repairs > ceiling 5 (§3.7) — STOP and ASK`); ok = false; }
  for (const p of repairs) {
    const row = csvById.get(p.id);
    if (!row || row.outcome !== 'DRIFTED') { RED('G', p.id, 'repair row is not DRIFTED in the register'); ok = false; }
    if (finalById.get(p.id)?.class_final !== 'MATERIAL') { RED('G', p.id, 'repair row is not class_final MATERIAL'); ok = false; }
    try {
      git(['rev-parse', `${p.sha}^{commit}`]);
      execFileSync('git', ['merge-base', '--is-ancestor', p.sha, 'HEAD'], { cwd: REPO_ROOT });
    } catch {
      RED('G', p.sha, `repair SHA not in this branch's history`); ok = false;
    }
  }
  // Converse — the direction the risk actually runs in: every changed file must be §2-permitted
  // or repair-registered. (.ai-factory/plans/** is runtime bookkeeping: allowed, but PRINTED.)
  try {
    const changed = git(['diff', '--name-only', 'origin/staging..HEAD']).split('\n').filter(Boolean);
    const repairFiles = new Set(repairs.map((p) => p.file));
    const runtime = [];
    for (const f of changed) {
      if (PERMITTED_DIFF.has(f) || repairFiles.has(f)) continue;
      if (f.startsWith('.ai-factory/plans/')) { runtime.push(f); continue; }
      RED('G', f, 'changed on branch but outside the §2 permitted create/edit set and not a registered repair file'); ok = false;
    }
    if (runtime.length) console.log(`ARM G note: runtime bookkeeping in branch diff (allowed, surfaced): ${runtime.join(', ')}`);
  } catch (e) {
    RED('G', '-', `git diff origin/staging..HEAD failed: ${String(e.message).split('\n')[0].slice(0, 120)}`); ok = false;
  }
  if (ok) OK('G', `${repairs.length}/5 repairs (each DRIFTED+MATERIAL, SHA in history); branch diff confined to §2 permitted set${repairs.length ? ' + repair files' : ''}`);
}

if (reds.length) { console.error(`\nFAIL — ${reds.length} red, ${okCount} ok`); process.exit(1); }
console.log(`\nPASS — all ${okCount} arm(s) ok`);
process.exit(0);
