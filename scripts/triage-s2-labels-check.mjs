#!/usr/bin/env node
// S2 deliverable check (kickoff §3.7). Six fail-closed arms (A-F) + a COUNTS/DISTRIBUTION
// report block that is printed always and never gated (a degenerate axis is a finding, not a
// defect). Reuses parseCsv + buildPayload; does NOT re-implement CSV parsing or prompt
// construction (kickoff §3.7 / §2 third runner-edit bullet).
//
// Argv contract (binding, kickoff §7 command 1):
//   labels.csv  README.md  s2-rubric-whose.md  <six population CSVs>
// Takes NO judge-artifact argument — arm E discovers s2-cold-*.json via readdir on the labels
// file's own directory, so the contract line cannot go stale when the model name changes.
//
// Arms (one non-zero exit for any RED):
//   A — join integrity / author-cell exclusion (§3.1, §3.4)
//   B — blindness payload equality (§3.2)
//   C — enum validity (§3.7)
//   D — README count reconciliation, every Files-table CSV row carries rows=<n> (§3.6)
//   E — every label traces to a parsed judge run (§3.2 / §3.7 — the T-TK2-E counter)
//   F — provenance is true of the run (§2 third runner-edit bullet; §3.7)

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { parseCsv } from './triage-corpus-probe.mjs';
import { buildPayload } from './triage-s0-run.mjs';

const args = process.argv.slice(2);
if (args.length < 4) {
  console.error('usage: triage-s2-labels-check.mjs <labels.csv> <README.md> <rubric.md> <pop1.csv> ... <pop6.csv>');
  process.exit(2);
}
const [labelsPath, readmePath, rubricPath, ...popPaths] = args;

const VALID_CLASS = new Set(['MATERIAL', 'IMMATERIAL']);
const VALID_LAYER = new Set(['idea', 'design', 'architecture', 'plan', 'implementation']);
const VALID_WHOSE = new Set(['reviewer', 'advisor', 'operator-floor']);
const FORBIDDEN_PAYLOAD_FIELDS = ['id', 'source', 'provenance', 'class_start', 'orig_grade'];
const EXPECTED_LABELS_HEADER = ['id', 'class_cold', 'layer_cold', 'whose_cold', 'rationale'];

const reds = [];
const oks = [];
const RED = (arm, id, reason) => { reds.push({ arm, id, reason }); console.error(`ARM ${arm} RED ${id ?? '-'}: ${reason}`); };
const OK = (arm, evidence) => { oks.push({ arm, evidence }); console.log(`ARM ${arm} ok (${evidence})`); };

// Load inputs
const labelsText = readFileSync(labelsPath, 'utf8');
const labelsHeader = labelsText.slice(0, labelsText.indexOf('\n')).trim().split(',');
const labelsRaw = parseCsv(labelsText);
const readme = readFileSync(readmePath, 'utf8');
const rubricBytes = readFileSync(rubricPath, 'utf8');
const popRows = popPaths.map((p) => ({ path: p, rows: parseCsv(readFileSync(p, 'utf8')) }));

// === ARM A — join integrity / author-cell exclusion ===
const headerMatch = labelsHeader.length === EXPECTED_LABELS_HEADER.length
  && labelsHeader.every((h, i) => h === EXPECTED_LABELS_HEADER[i]);
if (!headerMatch) {
  RED('A', '-', `labels header mismatch: got [${labelsHeader.join(',')}] expected [${EXPECTED_LABELS_HEADER.join(',')}]`);
}
if (labelsHeader.includes('class_start') || labelsHeader.includes('orig_grade')) {
  RED('A', '-', `labels file carries a forbidden column (class_start/orig_grade) — design §3.1 forbids judgment axes on the sidecar substrate`);
}

const authorCellIds = new Set();
const labelableIds = new Set();
for (const { rows } of popRows) {
  for (const r of rows) {
    if (r.provenance === 'author-cell') authorCellIds.add(r.id);
    else labelableIds.add(r.id);
  }
}

const labelsIds = labelsRaw.map((r) => r.id);
const labelsIdsSet = new Set(labelsIds);
const dupMap = new Map();
for (const id of labelsIds) dupMap.set(id, (dupMap.get(id) ?? 0) + 1);
const dups = [...dupMap.entries()].filter(([, n]) => n > 1);
if (dups.length) RED('A', dups[0][0], `duplicate label id (n=${dups[0][1]})`);

const missingLabelable = [...labelableIds].filter((id) => !labelsIdsSet.has(id));
if (missingLabelable.length) RED('A', missingLabelable[0], `missing labelable id (n=${missingLabelable.length} missing of ${labelableIds.size})`);

const extraLabels = labelsIds.filter((id) => !labelableIds.has(id));
if (extraLabels.length) {
  const leaked = extraLabels.filter((id) => authorCellIds.has(id));
  if (leaked.length) RED('A', leaked[0], `author-cell id leaked into labels (n=${leaked.length} of ${authorCellIds.size})`);
  else RED('A', extraLabels[0], `label id not in labelable population (n=${extraLabels.length})`);
}

if (!reds.some((r) => r.arm === 'A')) {
  OK('A', `${labelsIds.length} labels == ${labelableIds.size} labelable ids; ${authorCellIds.size} author-cell ids excluded; 0 duplicates`);
}

// === ARM B — blindness payload equality ===
let bFails = 0;
const totalPopRows = popRows.reduce((n, p) => n + p.rows.length, 0);
for (const { rows } of popRows) {
  for (const row of rows) {
    const full = buildPayload(row, rubricBytes);
    const blankedRow = { ...row };
    for (const f of FORBIDDEN_PAYLOAD_FIELDS) blankedRow[f] = '';
    const blanked = buildPayload(blankedRow, rubricBytes);
    if (full !== blanked) {
      RED('B', row.id, `payload differs when forbidden fields blanked — template carries leakage`);
      bFails++;
      if (bFails >= 3) break;
    }
  }
  if (bFails >= 3) break;
}
if (!bFails) OK('B', `payload(full) === payload(blanked) on all ${totalPopRows} population rows`);

// === ARM C — enum validity ===
let cFails = 0;
for (const r of labelsRaw) {
  if (!VALID_CLASS.has(r.class_cold)) { RED('C', r.id, `class_cold='${r.class_cold}' not in {MATERIAL,IMMATERIAL}`); cFails++; }
  if (!VALID_LAYER.has(r.layer_cold)) { RED('C', r.id, `layer_cold='${r.layer_cold}' not in {idea,design,architecture,plan,implementation}`); cFails++; }
  if (!VALID_WHOSE.has(r.whose_cold)) { RED('C', r.id, `whose_cold='${r.whose_cold}' not in {reviewer,advisor,operator-floor}`); cFails++; }
  if (!r.rationale || !r.rationale.trim()) { RED('C', r.id, `rationale empty`); cFails++; }
  if (cFails >= 5) break;
}
if (!cFails) OK('C', `enum values valid + rationale non-empty on all ${labelsRaw.length} label rows`);

// === ARM D — README count reconciliation ===
// Every Files-table row (markdown table line starting with `|`) linking a .csv carries
// rows=<n> matching the file's real data-row count. No UNCHECKED escape (kickoff §3.6).
let dFails = 0;
const readmeLines = readme.split('\n');
const labelAbsDir = dirname(labelsPath);
// Resolve any csv path under the corpus dir (handles relative names in README tables).
const resolveCsv = (csvName) => {
  const candidates = [
    join(labelAbsDir, csvName),
    join(labelAbsDir, basename(csvName)),
    join(process.cwd(), csvName),
    csvName,
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
};
for (const line of readmeLines) {
  if (!line.startsWith('|')) continue; // only markdown table rows
  // Find every .csv reference on this line (link syntax or backtick).
  const csvRefs = new Set();
  const linkRe = /\[([a-zA-Z0-9_./-]+\.csv)\]\([^)]+\)/gu;
  const backtickRe = /`([a-zA-Z0-9_./-]+\.csv)`/gu;
  let m;
  while ((m = linkRe.exec(line)) !== null) csvRefs.add(m[1]);
  while ((m = backtickRe.exec(line)) !== null) csvRefs.add(m[1]);
  if (!csvRefs.size) continue;
  for (const csvRef of csvRefs) {
    const resolved = resolveCsv(csvRef);
    if (!resolved) {
      RED('D', csvRef, `linked from README table but not findable on disk`);
      dFails++;
      continue;
    }
    const actualRows = parseCsv(readFileSync(resolved, 'utf8')).length;
    const tokenRe = new RegExp(`rows=(\\d+)`, 'u');
    const tokenMatch = line.match(tokenRe);
    if (!tokenMatch) {
      RED('D', basename(resolved), `Files-table row links .csv but carries no rows=<n> token`);
      dFails++;
    } else {
      const tokenN = parseInt(tokenMatch[1], 10);
      if (tokenN !== actualRows) {
        RED('D', basename(resolved), `rows=${tokenN} but file has ${actualRows} data rows`);
        dFails++;
      }
    }
  }
}
if (!dFails) OK('D', `every Files-table CSV row carries a matching rows=<n> token`);

// === ARM E — every label traces to a parsed judge run ===
const labelsDir = dirname(labelsPath);
const judgeFiles = readdirSync(labelsDir).filter((f) => /^s2-cold-.*\.json$/u.test(f));
if (judgeFiles.length === 0) {
  RED('E', '-', `no s2-cold-*.json found beside ${labelsPath} — labels cannot be traced to judge runs`);
} else {
  const judgeById = new Map();
  for (const jf of judgeFiles) {
    const j = JSON.parse(readFileSync(join(labelsDir, jf), 'utf8'));
    for (const r of (j.results || [])) {
      if (!judgeById.has(r.id)) judgeById.set(r.id, []);
      judgeById.get(r.id).push(r);
    }
  }
  let eFails = 0;
  for (const label of labelsRaw) {
    const candidates = judgeById.get(label.id) || [];
    const match = candidates.find((r) => r.class === label.class_cold && r.layer === label.layer_cold && r.whose === label.whose_cold);
    if (!match) {
      if (candidates.length === 0) {
        RED('E', label.id, `no judge result for label`);
      } else if (candidates.some((r) => r.class === null)) {
        RED('E', label.id, `label filled in but judge result has class=null (unparsed) — T-TK2-E`);
      } else {
        const r = candidates[0];
        RED('E', label.id, `axis mismatch: label=${label.class_cold}/${label.layer_cold}/${label.whose_cold} judge=${r.class}/${r.layer}/${r.whose}`);
      }
      eFails++;
      if (eFails >= 5) break;
    }
  }
  if (!eFails) OK('E', `all ${labelsRaw.length} labels trace to a parsed judge result in ${judgeFiles.join(', ')}`);
}

// === ARM F — provenance is true of the run ===
if (judgeFiles.length === 0) {
  console.log('ARM F skipped (no s2-cold-*.json to check — arm E already RED)');
} else {
  let fFails = 0;
  for (const jf of judgeFiles) {
    const j = JSON.parse(readFileSync(join(labelsDir, jf), 'utf8'));
    if ('candidate' in j) {
      RED('F', jf, `artifact carries a 'candidate' key (value: ${JSON.stringify(j.candidate)}) — S2 must use 'rater' per §2`);
      fFails++;
    }
    if (!j.rater || !String(j.rater).trim()) {
      RED('F', jf, `rater field missing or empty — S2 artifacts must carry a truthful rater name`);
      fFails++;
    }
    if (!j.model || !String(j.model).trim()) {
      RED('F', jf, `model field missing or empty`);
      fFails++;
    }
    if (j.rubricSource && basename(j.rubricSource) === basename(rubricPath)) {
      if (j.rubric !== rubricBytes) {
        RED('F', jf, `rubric field not byte-identical to ${basename(rubricPath)} (rubricSource names it)`);
        fFails++;
      }
    }
    if (fFails >= 5) break;
  }
  if (!fFails) OK('F', `all ${judgeFiles.length} judge artifact(s) carry truthful provenance`);
}

// === COUNTS / DISTRIBUTION report (printed always, never gated — §3.7 closing) ===
console.log('\n=== COUNTS ===');
for (const { path, rows } of popRows) {
  console.log(`${basename(path)}: ${rows.length} rows`);
}
console.log(`Labelable total: ${labelableIds.size}`);
console.log(`Excluded (author-cell): ${authorCellIds.size}`);
console.log(`Labels shipped: ${labelsRaw.length}`);

console.log('\n=== DISTRIBUTION (reported, never gated) ===');
const classDist = {};
const layerDist = {};
const whoseDist = {};
const idToPop = {};
for (const { path, rows } of popRows) {
  for (const r of rows) idToPop[r.id] = basename(path);
}
for (const r of labelsRaw) {
  classDist[r.class_cold] = (classDist[r.class_cold] || 0) + 1;
  layerDist[r.layer_cold] = (layerDist[r.layer_cold] || 0) + 1;
  whoseDist[r.whose_cold] = (whoseDist[r.whose_cold] || 0) + 1;
}
const total = labelsRaw.length || 1;
const fmt = (d) => Object.entries(d).map(([k, v]) => `${k}=${v} (${(100 * v / total).toFixed(1)}%)`).join('  ');
console.log(`class_cold: ${fmt(classDist)}`);
console.log(`layer_cold: ${fmt(layerDist)}`);
console.log(`whose_cold: ${fmt(whoseDist)}`);
const whoseValues = Object.values(whoseDist);
const whoseMax = whoseValues.length ? Math.max(...whoseValues) : 0;
const whoseMajorityShare = whoseMax / total;
console.log(`whose_cold majority-class share: ${(whoseMajorityShare * 100).toFixed(1)}% (§3.3 falsifier fires at ≥95%; 80-94% band is also not a pass)`);

console.log('\nlayer_cold cross-tab by population (T-TK2-G counter — surfaces path-predictable layers):');
const layerByPop = {};
for (const r of labelsRaw) {
  const pop = idToPop[r.id] ?? 'UNKNOWN';
  const key = `${pop}::${r.layer_cold}`;
  layerByPop[key] = (layerByPop[key] || 0) + 1;
}
for (const [key, n] of Object.entries(layerByPop).sort()) {
  console.log(`  ${key}: ${n}`);
}

// === Final exit ===
if (reds.length) {
  console.error(`\nFAIL — ${reds.length} red arm(s), ${oks.length} ok arm(s)`);
  process.exit(1);
}
console.log(`\nPASS — all ${oks.length} arm(s) ok`);
process.exit(0);
