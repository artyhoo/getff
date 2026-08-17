#!/usr/bin/env node
// triage-kernel-v2 S3 — agreement statistics + operator-slice builder (design §3.2-§3.5).
// Deterministic; reads the corpus CSV masters only. No LLM calls, no network.
//
//   node scripts/triage-s3-agreement.mjs           # per-axis stats (kappa/PABAK, routes, overrides)
//   node scripts/triage-s3-agreement.mjs --slice   # stratified operator slice (seeded, documented)
//   node scripts/triage-s3-agreement.mjs --check   # fail-closed consistency arms (exit 1 on any RED)
//
// Class kappa (design §3.2) is computed on the binary set only: rows whose class_start is
// MATERIAL or IMMATERIAL. MATERIAL-b and UNRECOVERABLE rows are excluded from the class
// kappa and reported separately (they take the §3.3 adjudication routes).
// Slice seed (design §3.5): sha256("s3-slice-v1:<id>") ascending — reproducible, no RNG state.
import fs from 'node:fs';
import crypto from 'node:crypto';

const DIR = 'docs/meta-factory/triage-corpus/';
const POPS = ['audit-1369', 's4-round7', 'arch-reviews', 'kickoff-loops', 'td-m3', 'research-forks'];

function parseCsv(f) {
  const text = fs.readFileSync(f, 'utf8');
  const recs = []; let cells = [], cur = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; } else cur += ch; }
    else if (ch === '"') inQ = true;
    else if (ch === ',') { cells.push(cur); cur = ''; }
    else if (ch === '\n') { cells.push(cur); if (cells.length > 1 || cells[0] !== '') recs.push(cells); cells = []; cur = ''; }
    else if (ch !== '\r') cur += ch;
  }
  if (cur !== '' || cells.length) { cells.push(cur); recs.push(cells); }
  const h = recs[0];
  return recs.slice(1).map(r => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ''])));
}

function kappa2(pairs) { // pairs of [a,b], both binary MATERIAL/IMMATERIAL
  const n = pairs.length;
  let mm = 0, mi = 0, im = 0, ii = 0;
  for (const [a, b] of pairs) {
    if (a === 'MATERIAL') b === 'MATERIAL' ? mm++ : mi++;
    else b === 'MATERIAL' ? im++ : ii++;
  }
  const po = (mm + ii) / n;
  const pa = (mm + mi) / n, pb = (mm + im) / n;
  const pe = pa * pb + (1 - pa) * (1 - pb);
  return { n, cells: { mm, mi, im, ii }, raw: po, kappa: (po - pe) / (1 - pe), pabak: 2 * po - 1 };
}

const cold = new Map(parseCsv(DIR + 's2-labels.csv').map(r => [r.id, r]));
const adj = new Map(parseCsv(DIR + 's3-adjudication.csv').map(r => [r.id, r]));
const rows = POPS.flatMap(n => parseCsv(DIR + n + '.csv')).filter(r => cold.has(r.id));

if (rows.length !== cold.size || rows.length !== adj.size) {
  console.error(`FAIL: population/labels/adjudication size mismatch: pops=${rows.length} cold=${cold.size} adj=${adj.size}`);
  process.exit(1);
}

// §3.2 class axis: start vs cold on the binary set
const binary = rows.filter(r => r.class_start === 'MATERIAL' || r.class_start === 'IMMATERIAL');
const classStat = kappa2(binary.map(r => [r.class_start, cold.get(r.id).class_cold]));

// routes + advisor overrides
const byRoute = { agreed: [], disputed: [], 'material-b': [], unrecoverable: [] };
const ovr = { class: [], layer: [], whose: [] };
const dist = { class: {}, layer: {}, whose: {} };
for (const r of rows) {
  const a = adj.get(r.id), c = cold.get(r.id);
  byRoute[a.route].push(r.id);
  if (a.route === 'unrecoverable' && a.class_adv !== c.class_cold) ovr.class.push(r.id);
  if (a.layer_adv !== c.layer_cold) ovr.layer.push(r.id);
  if (a.whose_adv !== c.whose_cold) ovr.whose.push(r.id);
  dist.class[a.class_adv] = (dist.class[a.class_adv] || 0) + 1;
  dist.layer[a.layer_adv] = (dist.layer[a.layer_adv] || 0) + 1;
  dist.whose[a.whose_adv] = (dist.whose[a.whose_adv] || 0) + 1;
}
// cold-vs-advisor calibration stats (§3.3): all 151 rows per axis
const calib = {};
for (const ax of ['class', 'layer', 'whose']) {
  const coldKey = { class: 'class_cold', layer: 'layer_cold', whose: 'whose_cold' }[ax];
  const advKey = { class: 'class_adv', layer: 'layer_adv', whose: 'whose_adv' }[ax];
  const same = rows.filter(r => adj.get(r.id)[advKey] === cold.get(r.id)[coldKey]).length;
  calib[ax] = { agree: same, n: rows.length, raw: same / rows.length };
}
const floorIds = rows.filter(r => adj.get(r.id).whose_adv === 'operator-floor').map(r => r.id);

if (process.argv.includes('--check')) {
  // Fail-closed arms over s3-adjudication.csv + s3-final.csv (design §3.3 route/status law).
  const fin = new Map(parseCsv(DIR + 's3-final.csv').map(r => [r.id, r]));
  const CLASSES = ['MATERIAL', 'IMMATERIAL'];
  const LAYERS = ['idea', 'design', 'architecture', 'plan', 'implementation'];
  const WHOSE = ['reviewer', 'advisor', 'operator-floor'];
  const ROUTES = ['agreed', 'disputed', 'material-b', 'unrecoverable'];
  let red = 0;
  const RED = (arm, id, msg) => { console.error(`RED [${arm}] ${id}: ${msg}`); red++; };
  if (fin.size !== rows.length) RED('A', '-', `s3-final rows=${fin.size} vs labelable population=${rows.length}`);
  for (const r of rows) {
    const a = adj.get(r.id), f = fin.get(r.id), c = cold.get(r.id);
    if (!f) { RED('A', r.id, 'missing from s3-final.csv'); continue; }
    if (!ROUTES.includes(a.route)) RED('B', r.id, `route ${a.route}`);
    if (!CLASSES.includes(a.class_adv)) RED('B', r.id, `class_adv ${a.class_adv}`);
    if (!LAYERS.includes(a.layer_adv)) RED('B', r.id, `layer_adv ${a.layer_adv}`);
    if (!WHOSE.includes(a.whose_adv)) RED('B', r.id, `whose_adv ${a.whose_adv}`);
    if (a.route === 'agreed' && (a.class_adv !== c.class_cold || r.class_start !== c.class_cold))
      RED('C', r.id, 'agreed route but class_start/class_cold/class_adv disagree');
    if (a.route === 'disputed' && (!CLASSES.includes(r.class_start) || r.class_start === c.class_cold))
      RED('D', r.id, `disputed route but class_start=${r.class_start} vs cold=${c.class_cold}`);
    if (a.route === 'material-b' && r.class_start !== 'MATERIAL-b') RED('D', r.id, `material-b route but class_start=${r.class_start}`);
    if (a.route === 'unrecoverable' && r.class_start !== 'UNRECOVERABLE') RED('D', r.id, `unrecoverable route but class_start=${r.class_start}`);
    if (f.class_final !== a.class_adv || f.layer_final !== a.layer_adv || f.whose_final !== a.whose_adv)
      RED('E', r.id, 's3-final disagrees with s3-adjudication');
    if (f.status !== (a.route === 'agreed' ? 'agreed' : 'adjudicated')) RED('E', r.id, `status ${f.status} vs route ${a.route}`);
    if ((a.route === 'disputed' || a.route === 'material-b' || a.route === 'unrecoverable') && (a.rationale || '').trim().length < 20)
      RED('F', r.id, 'routed row carries no substantive rationale (<20 chars)');
  }
  if (red) { console.error(`FAIL: ${red} RED`); process.exit(1); }
  console.log(`PASS: arms A-F green over ${rows.length} rows (s3-adjudication + s3-final consistent)`);
} else if (process.argv.includes('--slice')) {
  const rank = (id) => crypto.createHash('sha256').update('s3-slice-v1:' + id).digest('hex');
  const pick = (ids, k, excl) => ids.filter(id => !excl.has(id)).sort((x, y) => rank(x) < rank(y) ? -1 : 1).slice(0, k);
  const picked = new Set(floorIds); // FLOOR rows are all included (§3.5)
  const A = pick([...byRoute.disputed, ...byRoute['material-b']], 5, picked); A.forEach(i => picked.add(i));
  const B = pick(byRoute.agreed, 5, picked); B.forEach(i => picked.add(i));
  const cPop = rows.map(r => r.id).filter(id => (ovr.layer.includes(id) || ovr.whose.includes(id)));
  const C = pick(cPop, 5, picked); C.forEach(i => picked.add(i));
  console.log(JSON.stringify({ floor: floorIds, disputedStratum: A, agreedStratum: B, overriddenStratum: C, total: picked.size }, null, 1));
} else {
  const fmt = (s) => `n=${s.n} cells=${JSON.stringify(s.cells)} raw=${s.raw.toFixed(4)} kappa=${s.kappa.toFixed(4)} PABAK=${s.pabak.toFixed(4)}`;
  console.log('class axis (start vs cold, binary set): ' + fmt(classStat));
  console.log(`excluded from class kappa: MATERIAL-b=${byRoute['material-b'].length} UNRECOVERABLE=${byRoute.unrecoverable.length} (adjudication routes, design §3.2)`);
  console.log('routes: ' + JSON.stringify(Object.fromEntries(Object.entries(byRoute).map(([k, v]) => [k, v.length]))));
  console.log('advisor overrides: class(unrec)=' + ovr.class.length + ' [' + ovr.class.join(' ') + ']');
  console.log('  layer=' + ovr.layer.length + ' [' + ovr.layer.join(' ') + ']');
  console.log('  whose=' + ovr.whose.length + ' [' + ovr.whose.join(' ') + ']');
  console.log('cold-vs-advisor calibration (all 151): ' + JSON.stringify(calib));
  console.log('advisor distributions: ' + JSON.stringify(dist));
  console.log('FLOOR rows: ' + floorIds.join(' '));
}
