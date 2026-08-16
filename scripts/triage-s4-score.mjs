#!/usr/bin/env node
// S4 bench scorer + fail-closed gate (kickoff-s4 §3.6/§3.9). Scores C0/C1/C2 per axis against
// s3-final.csv truth, applies the §5 acceptance rule (class gate = McNemar leg AND
// MATERIAL-miss leg; layer = same statistic vs majority bar; whose = descriptive only),
// measures the confounding slice, and — under --check — runs the eight arms A-H.
//
// Reuse is by IMPORT (parseCsv, buildPayload) or COPY-with-source-comment (kickoff §2):
//   choose/mcnemar/kappa  — copied from scripts/triage-s0-score.mjs:30-49 (frozen, never edit)
//   arm-B differential    — copied from scripts/triage-s2-labels-check.mjs:35,91-108, extended
//   GRADE_TOKEN/FINDING_ID — copied from scripts/triage-corpus-probe.mjs:40-41 (module-private)
//
// Usage: node scripts/triage-s4-score.mjs           → scoring report (needs judge artifacts)
//        node scripts/triage-s4-score.mjs --check   → arms A-H, exit 1 on any RED

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseCsv } from './triage-corpus-probe.mjs';
import { buildPayload } from './triage-s0-run.mjs';
import { buildBenchInput, POPULATIONS, CORPUS_DIR, REPO_ROOT, RUBRIC_REL, EXPECTED_LABELABLE } from './triage-kernel-v2-bench/build-input.mjs';
import { groupBySource } from './triage-kernel-v2-bench/make-tests.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHECK = process.argv.includes('--check');
const PINNED_MODEL = 'sonnet'; // §3.4 — a model swap is a PARK, never an upgrade
const FROZEN_TREE = '7425346f0b'; // S3 squash — the substrate the bench was authored against
const REPORT_REL = 'docs/meta-factory/research-patches/2026-08-16-triage-kernel-v2-s4-bench.md';

const VALID_CLASS = new Set(['MATERIAL', 'IMMATERIAL']);
const VALID_LAYER = new Set(['idea', 'design', 'architecture', 'plan', 'implementation']);
const VALID_WHOSE = new Set(['reviewer', 'advisor', 'operator-floor']);
// Copied from triage-s2-labels-check.mjs:35 and EXTENDED per kickoff §3.9 arm B with every
// *_cold / *_final key (+ s3-final's status) — the S4 join columns the shim must never project.
const FORBIDDEN_PAYLOAD_FIELDS = [
  'id', 'source', 'provenance', 'class_start', 'orig_grade',
  'class_cold', 'layer_cold', 'whose_cold',
  'class_final', 'layer_final', 'whose_final', 'status',
];
// Copied from triage-corpus-probe.mjs:40-41 (module-private there; §2 copy provision).
const GRADE_TOKEN = /\b(?:BLOCKER|MAJOR|MINOR)\b/u;
const FINDING_ID = /\b(?:R\d+\s+[MB]\d+|(?:TD|BU)\s+[MBN]\d+)\b/u;

const die = (msg) => { console.error(`[ERROR] ${msg}`); process.exit(1); };
const pct = (x) => (Number.isNaN(x) ? 'n/a' : `${(100 * x).toFixed(1)}%`);

// ==== Copied statistics (triage-s0-score.mjs:30-49 — frozen; never re-derived) ====
const acc = (rs, k) => rs.filter((r) => r[k] === r.truth).length / rs.length;
const choose = (n, k) => { let v = 1; for (let i = 0; i < k; i += 1) v = (v * (n - i)) / (i + 1); return v; };
const mcnemar = (b, c) => {
  const n = b + c;
  if (!n) return 1;
  let s = 0;
  for (let i = 0; i <= Math.min(b, c); i += 1) s += choose(n, i);
  return Math.min(1, 2 * s * 0.5 ** n);
};
// Binary kappa exactly as frozen (class axis).
const kappaBinary = (rs, k) => {
  const n = rs.length;
  const po = acc(rs, k);
  const pM = (a) => rs.filter((r) => r[a] === 'MATERIAL').length / n;
  const pe = pM('truth') * pM(k) + (1 - pM('truth')) * (1 - pM(k));
  return { po, kappa: (po - pe) / (1 - pe), pabak: 2 * po - 1 };
};
// Multiclass generalization of the same kappa (layer/whose): pe = Σ_k p_truth(k)·p_cand(k)
// over the axis enum — the standard Cohen's κ extension, applied to the copied shape.
const kappaMulti = (rs, k, enums) => {
  const n = rs.length;
  const po = acc(rs, k);
  let pe = 0;
  for (const e of enums) {
    pe += (rs.filter((r) => r.truth === e).length / n) * (rs.filter((r) => r[k] === e).length / n);
  }
  return { po, kappa: pe < 1 ? (po - pe) / (1 - pe) : NaN, pabak: 2 * po - 1 };
};
// Wilson score 95% CI for the discordant-pair proportion c/(b+c). Gate leg 1 is stated as
// «CI excludes 0.5, equivalently McNemar p < α» (§3.6) — p is the gated form; the CI is
// reported beside it as evidence. α = 0.05 two-sided, fixed for this stage.
const wilson = (x, n) => {
  if (!n) return [NaN, NaN];
  const p = x / n;
  const z = 1.959963984540054;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const h = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [(c - h) / d, (c + h) / d];
};

// ==== Load substrate ====
const popById = new Map();
for (const name of POPULATIONS) {
  for (const r of parseCsv(readFileSync(join(CORPUS_DIR, `${name}.csv`), 'utf8'))) popById.set(r.id, r);
}
const finalRows = parseCsv(readFileSync(join(CORPUS_DIR, 's3-final.csv'), 'utf8'));
const finalById = new Map(finalRows.map((r) => [r.id, r]));
const coldById = new Map(parseCsv(readFileSync(join(CORPUS_DIR, 's2-labels.csv'), 'utf8')).map((r) => [r.id, r]));
const rubricBytes = readFileSync(join(REPO_ROOT, RUBRIC_REL), 'utf8');

const C0 = (grade) => (grade === 'MINOR' ? 'IMMATERIAL' : grade && grade !== 'none' ? 'MATERIAL' : null);
const labelable = finalRows.filter((r) => popById.has(r.id) && popById.get(r.id).provenance !== 'author-cell');
const subset = labelable.filter((r) => C0(popById.get(r.id).orig_grade) !== null);

function loadArtifact(name) {
  const p = join(CORPUS_DIR, name);
  if (!existsSync(p)) die(`${name} missing — run the judge pass first (scripts/triage-kernel-v2-bench/run.mjs)`);
  return JSON.parse(readFileSync(p, 'utf8'));
}
const c1Art = existsSync(join(CORPUS_DIR, 's4-c1-sonnet.json')) ? loadArtifact('s4-c1-sonnet.json') : null;
const c2Art = existsSync(join(CORPUS_DIR, 's4-c2-sonnet.json')) ? loadArtifact('s4-c2-sonnet.json') : null;
const c1By = c1Art ? new Map(c1Art.results.map((r) => [r.id, r])) : new Map();
const c2By = c2Art ? new Map(c2Art.results.map((r) => [r.id, r])) : new Map();

// Row shapes per axis: {id, truth, base, cand}; base = C0 (class, scored subset) or the
// majority predictor (layer/whose, full labelable population — §3.6 populations differ per axis).
const candGet = (key, id) => (key === 'c0' ? null : (key === 'c1' ? c1By.get(id) : c2By.get(id)));
const classRows = (key) => subset.map((r) => {
  const c0 = C0(popById.get(r.id).orig_grade);
  return { id: r.id, truth: r.class_final, base: c0, cand: key === 'c0' ? c0 : candGet(key, r.id)?.class ?? null };
});
const axisRows = (axis, key) => labelable.map((r) => {
  const bar = axis === 'layer' ? 'implementation' : 'reviewer'; // majority bars (§3.3)
  return { id: r.id, truth: r[`${axis}_final`], base: bar, cand: key === 'base' ? bar : candGet(key, r.id)?.[axis] ?? null };
});

const materialMiss = (rs, k) => {
  const mat = rs.filter((r) => r.truth === 'MATERIAL');
  return mat.length ? mat.filter((r) => r[k] !== 'MATERIAL').length / mat.length : NaN;
};
const pr = (rs, k, cls) => {
  const pred = rs.filter((r) => r[k] === cls);
  const tru = rs.filter((r) => r.truth === cls);
  return { precision: pred.length ? pred.filter((r) => r.truth === cls).length / pred.length : NaN, recall: tru.length ? tru.filter((r) => r[k] === cls).length / tru.length : NaN };
};
const discord = (rs) => ({
  b: rs.filter((r) => r.base === r.truth && r.cand !== r.truth).length,
  c: rs.filter((r) => r.base !== r.truth && r.cand === r.truth).length,
});

// ==== --join: write docs/meta-factory/triage-corpus/s4-bench.csv (Task 8) ====
// The scorer owns the join so the CSV and the arms validate through ONE code path
// (arm A re-reads what this writes; numbers in README/report come only from scorer output).
if (process.argv.includes('--join')) {
  if (!c1Art || !c2Art) die('--join needs both judge artifacts (run both judge passes first)');
  const scoredSet = new Set(subset.map((r) => r.id));
  const csvEscape = (v) => (/[",\n]/u.test(v) ? `"${v.replace(/"/gu, '""')}"` : v);
  const lines = ['id,class_final,layer_final,whose_final,c0_class,c1_class,c1_layer,c1_whose,c2_class,c2_layer,c2_whose,scored_subset'];
  for (const r of labelable) {
    lines.push([
      r.id, r.class_final, r.layer_final, r.whose_final,
      C0(popById.get(r.id).orig_grade) ?? '',
      c1By.get(r.id)?.class ?? '', c1By.get(r.id)?.layer ?? '', c1By.get(r.id)?.whose ?? '',
      c2By.get(r.id)?.class ?? '', c2By.get(r.id)?.layer ?? '', c2By.get(r.id)?.whose ?? '',
      scoredSet.has(r.id) ? '1' : '0',
    ].map(csvEscape).join(','));
  }
  writeFileSync(join(CORPUS_DIR, 's4-bench.csv'), `${lines.join('\n')}\n`);
  console.log(`[INFO] wrote docs/meta-factory/triage-corpus/s4-bench.csv rows=${labelable.length} scored_subset=${subset.length}`);
  process.exit(0);
}

// ==== Score + report (always printed — a degenerate axis is a finding, not a defect) ====
const NUM = {}; // canonical numbers — arm E reconciles the report against exactly these
const render = () => {
  const out = [];
  out.push(`population: labelable=${labelable.length} class-scored-subset=${subset.length} (${pct(subset.length / labelable.length)} of labelable, D-K8 floor ~70%)`);
  NUM.labelable_n = String(labelable.length);
  NUM.subset_n = String(subset.length);
  if (c1Art && c2Art) {
    for (const key of ['c0', 'c1', 'c2']) {
      const rows = classRows(key);
      const field = key === 'c0' ? 'base' : 'cand';
      const k = kappaBinary(rows, field);
      const m = materialMiss(rows, field);
      NUM.class_n = String(rows.length); // §3.9 A(a): denominator captured from the array the class loop iterates (subset)
      NUM[`${key}_class_acc`] = acc(rows, field).toFixed(3);
      NUM[`${key}_class_miss`] = m.toFixed(3);
      NUM[`${key}_class_kappa`] = k.kappa.toFixed(3);
      NUM[`${key}_class_pabak`] = k.pabak.toFixed(3);
      out.push(`class ${key}: acc=${NUM[`${key}_class_acc`]} (n=${rows.length}) MATERIAL-miss=${m.toFixed(3)} kappa=${k.kappa.toFixed(3)} PABAK=${k.pabak.toFixed(3)}`);
    }
    for (const key of ['c1', 'c2']) {
      const rows = classRows(key);
      const { b, c } = discord(rows);
      const [lo, hi] = wilson(c, b + c);
      const p = mcnemar(b, c);
      NUM[`${key}_mcnemar_p`] = p.toFixed(4);
      NUM[`${key}_ci_disc`] = `[${lo.toFixed(3)}, ${hi.toFixed(3)}]`;
      NUM[`${key}_class_b`] = String(b);
      NUM[`${key}_class_c`] = String(c);
      out.push(`class ${key} vs C0 discordants: b=${b} c=${c} McNemar exact p=${p.toFixed(4)} CI(c/(b+c))=[${lo.toFixed(3)}, ${hi.toFixed(3)}] (α=0.05 two-sided)`);
    }
    const c0Miss = Number(NUM.c0_class_miss);
    for (const key of ['c1', 'c2']) {
      const p = Number(NUM[`${key}_mcnemar_p`]);
      const miss = Number(NUM[`${key}_class_miss`]);
      const b = Number(NUM[`${key}_class_b`]);
      const c = Number(NUM[`${key}_class_c`]);
      const ahead = c > b; // leg 1 is DIRECTIONAL (round-1 fidelity item 3): PASS requires the candidate on the better side
      const legP = p < 0.05 && ahead;
      const legMiss = miss <= c0Miss + 1e-12;
      out.push(`class ${key} GATE: McNemar p=${p.toFixed(4)} ${p < 0.05 ? '<' : '>='} 0.05 (directional: c=${c} ${ahead ? '>' : '<='} b=${b}) → ${legP ? 'PASS' : 'FAIL'} | MATERIAL-miss ${miss.toFixed(3)} ${legMiss ? '<=' : '>'} C0's ${c0Miss.toFixed(3)} → ${legMiss ? 'PASS' : 'FAIL'} | verdict=${legP && legMiss ? 'SHIPS' : 'DOES-NOT-SHIP'} (±9pp minimum-detectable-difference caveat at n=${subset.length})`);
    }
    for (const [axis, enums] of [['layer', VALID_LAYER], ['whose', VALID_WHOSE]]) {
      NUM[`${axis}_bar_acc`] = acc(axisRows(axis, 'base'), 'base').toFixed(3);
      out.push(`${axis} majority bar: acc=${NUM[`${axis}_bar_acc`]} (n=${labelable.length})`);
      for (const key of ['c1', 'c2']) {
        const rows = axisRows(axis, key);
        const k = kappaMulti(rows, 'cand', enums);
        NUM[`${axis}_n`] = String(rows.length); // §3.9 A(a): denominator captured from the array this loop iterates (labelable)
        NUM[`${key}_${axis}_acc`] = acc(rows, 'cand').toFixed(3);
        if (axis === 'layer') NUM[`${key}_layer_kappa`] = k.kappa.toFixed(3); // stated in report prose; whose κ is not stated → stays out of NUM
        out.push(`${axis} ${key}: acc=${NUM[`${key}_${axis}_acc`]} (n=${rows.length}) kappa=${k.kappa.toFixed(3)} PABAK=${k.pabak.toFixed(3)}`);
        if (axis === 'layer') {
          const { b, c } = discord(rows);
          const p = mcnemar(b, c);
          NUM[`${key}_layer_mcnemar_p`] = p.toFixed(4);
          NUM[`${key}_layer_b`] = String(b);
          NUM[`${key}_layer_c`] = String(c);
          const beats = p < 0.05 && c > b; // directional, same rule as class-gate leg 1 (round-1 fidelity item 3)
          out.push(`layer ${key} vs bar: b=${b} c=${c} McNemar exact p=${p.toFixed(4)} — ${beats ? 'beats bar beyond noise floor (directional: c > b)' : 'does NOT beat bar beyond noise floor'}`);
        }
      }
      if (axis === 'whose') out.push('whose verdict: judgment-only, not corpus-validated');
    }
    for (const key of ['c1', 'c2']) {
      const rows = classRows(key);
      for (const cls of ['MATERIAL', 'IMMATERIAL']) {
        const s = pr(rows, 'cand', cls);
        out.push(`class ${key} ${cls}: precision=${s.precision.toFixed(3)} recall=${s.recall.toFixed(3)} (n=${rows.length})`);
      }
    }
    // Confounding slice (§3.6): class_final != class_cold, with the T14 power statement.
    const c1cls = classRows('c1');
    const cf = c1cls.filter((r) => coldById.get(r.id) && coldById.get(r.id).class_cold !== r.truth);
    const cc = c1cls.filter((r) => coldById.get(r.id) && coldById.get(r.id).class_cold === r.truth);
    NUM.conf_slice_n = String(cf.length);
    NUM.conc_slice_n = String(cc.length);
    NUM.conf_slice_c0_acc = acc(cf, 'base').toFixed(3);
    NUM.conf_slice_c1_acc = acc(cf, 'cand').toFixed(3);
    NUM.conc_slice_c0_acc = acc(cc, 'base').toFixed(3);
    NUM.conc_slice_c1_acc = acc(cc, 'cand').toFixed(3);
    out.push(`confounding slice (class_final != class_cold): n=${cf.length} of ${subset.length} scored — C0 acc=${NUM.conf_slice_c0_acc} C1 acc=${NUM.conf_slice_c1_acc} | concordant slice n=${cc.length}: C0 acc=${NUM.conc_slice_c0_acc} C1 acc=${NUM.conc_slice_c1_acc}`);
    out.push(`power statement: n=${cf.length} on the confounding slice — coverage insufficient to conclude (T14); never a second gate`);
    // C2 delta + cost, singleton vs multi split (§3.5).
    const groups = groupBySource(labelable.map((r) => ({ ...popById.get(r.id), ...r })));
    const singletonIds = new Set(groups.filter((g) => g.rows.length === 1).flatMap((g) => g.rows.map((r) => r.id)));
    const multiIds = new Set(groups.filter((g) => g.rows.length > 1).flatMap((g) => g.rows.map((r) => r.id)));
    const accOn = (ids, getter) => {
      const rs = subset.filter((r) => ids.has(r.id)).map((r) => ({ truth: r.class_final, cand: getter(r.id) }));
      return rs.filter((x) => x.cand === x.truth).length / rs.length;
    };
    const dSin = accOn(singletonIds, (id) => c1By.get(id)?.class) - accOn(singletonIds, (id) => c2By.get(id)?.class);
    const dMul = accOn(multiIds, (id) => c1By.get(id)?.class) - accOn(multiIds, (id) => c2By.get(id)?.class);
    const nSin = subset.filter((r) => singletonIds.has(r.id)).length;
    const nMul = subset.filter((r) => multiIds.has(r.id)).length;
    NUM.c2_class_delta = (Number(NUM.c2_class_acc) - Number(NUM.c1_class_acc)).toFixed(3);
    NUM.c2_singleton_delta = (-dSin).toFixed(3);
    NUM.c2_multi_delta = (-dMul).toFixed(3);
    NUM.c2_singleton_n = String(nSin);
    NUM.c2_multi_n = String(nMul);
    out.push(`C2 delta over C1 (class, n=${subset.length}): ${NUM.c2_class_delta} | singletons (rows=${singletonIds.size}, scored=${nSin}): ${NUM.c2_singleton_delta} | multi-row groups (rows=${multiIds.size}, scored=${nMul}): ${NUM.c2_multi_delta} | cost: 41 calls vs 151`);
    out.push('C2 is scored ONLY as a delta over C1 with its cost — never as a standalone winner');
  } else {
    out.push('[WARN] judge artifacts absent — numbers limited to populations');
  }
  return out.join('\n');
};

// ==== --check arms (§3.9) ====
const reds = [];
let okCount = 0;
const RED = (arm, id, reason) => { reds.push(`${arm}:${id}`); console.error(`ARM ${arm} RED ${id ?? '-'}: ${reason}`); };
const OK = (arm, evidence) => { okCount += 1; console.log(`ARM ${arm} ok (${evidence})`); };

function runArms() {
  const benchPath = join(HERE, 'triage-kernel-v2-bench', 'bench-input.json');
  const bench = existsSync(benchPath) ? JSON.parse(readFileSync(benchPath, 'utf8')) : null;

  // --- ARM A — truth join / populations / grouping / README registration ---
  {
    let ok = true;
    if (labelable.length !== EXPECTED_LABELABLE) { RED('A', '-', `labelable=${labelable.length} expected ${EXPECTED_LABELABLE}`); ok = false; }
    const ids = labelable.map((r) => r.id);
    if (new Set(ids).size !== ids.length) { RED('A', '-', `duplicate labelable id`); ok = false; }
    // §3.9 A(a): every per-axis number carries its row count, captured inside the per-axis loops
    // from the array actually iterated (classRows → scored subset; axisRows → labelable). §3.6
    // fixes the populations — class=131, layer=whose=151; a number computed on the other
    // population (or a loop switched to it) is RED here, not silently green.
    if (NUM.class_n !== String(subset.length) || NUM.layer_n !== String(labelable.length) || NUM.whose_n !== String(labelable.length)) {
      RED('A', '-', `per-axis denominators class=${NUM.class_n} layer=${NUM.layer_n} whose=${NUM.whose_n} — loops must iterate subset(${subset.length}) for class, labelable(${labelable.length}) for layer/whose`);
      ok = false;
    }
    if (subset.length !== 131 || labelable.length !== 151) { RED('A', '-', `§3.6 fixed populations: subset=${subset.length} (expected 131) labelable=${labelable.length} (expected 151)`); ok = false; }
    if (c2Art) {
      const g = c2Art.groups ?? [];
      const flat = g.flatMap((x) => x.rows);
      if (g.length !== 41) { RED('A', '-', `C2 groups=${g.length} expected 41 (source key, never merged/split)`); ok = false; }
      if (new Set(flat).size !== flat.length || flat.length !== EXPECTED_LABELABLE) { RED('A', '-', `C2 group rows are not a partition of 151 (flat=${flat.length})`); ok = false; }
      const expect = new Map(groupBySource(labelable.map((r) => ({ ...popById.get(r.id), ...r }))).map((x) => [x.key, x.rows.map((r) => r.id)]));
      for (const x of g) {
        const e = expect.get(x.key);
        if (!e || e.join('|') !== x.rows.join('|')) { RED('A', x.key, `group rows differ from source grouping`); ok = false; break; }
      }
    }
    const csvPath = join(CORPUS_DIR, 's4-bench.csv');
    if (!existsSync(csvPath)) { RED('A', 's4-bench.csv', `missing — Task 8 join not done`); ok = false; }
    else {
      const benchCsv = parseCsv(readFileSync(csvPath, 'utf8'));
      const header = readFileSync(csvPath, 'utf8').split('\n')[0].trim();
      const wantH = 'id,class_final,layer_final,whose_final,c0_class,c1_class,c1_layer,c1_whose,c2_class,c2_layer,c2_whose,scored_subset';
      if (header !== wantH) { RED('A', 's4-bench.csv', `header mismatch: ${header}`); ok = false; }
      if (benchCsv.length !== EXPECTED_LABELABLE) { RED('A', 's4-bench.csv', `rows=${benchCsv.length} expected ${EXPECTED_LABELABLE}`); ok = false; }
      const byId = new Map(benchCsv.map((r) => [r.id, r]));
      for (const r of labelable) {
        const b = byId.get(r.id);
        if (!b || b.class_final !== r.class_final || b.layer_final !== r.layer_final || b.whose_final !== r.whose_final) {
          RED('A', r.id, `truth columns differ from s3-final.csv`); ok = false; break;
        }
        if (c1Art && b.c1_class !== (c1By.get(r.id)?.class ?? '')) { RED('A', r.id, `c1_class column differs from judge artifact`); ok = false; break; }
        if (c2Art && b.c2_class !== (c2By.get(r.id)?.class ?? '')) { RED('A', r.id, `c2_class column differs from judge artifact`); ok = false; break; }
      }
    }
    const readme = readFileSync(join(CORPUS_DIR, 'README.md'), 'utf8');
    for (const f of readdirSync(CORPUS_DIR).filter((x) => /^s4-.*\.csv$/u.test(x) || /^s4-c.*\.json$/u.test(x))) {
      if (!readme.includes(f)) { RED('A', f, `present in corpus dir but not registered in README Files table`); ok = false; }
    }
    if (ok) OK('A', `151 labelable ids joined to s3-final; s4-bench.csv 151 rows truth+candidate matched; C2 41 groups partition by source; per-axis denominators class=${NUM.class_n} (subset) / layer=${NUM.layer_n} / whose=${NUM.whose_n} (labelable); README registers every s4-* artifact`);
  }

  // --- ARM B — differential blindness (copied+extended) + built-input token rescan ---
  {
    let ok = true;
    let fails = 0;
    for (const name of POPULATIONS) {
      for (const row of parseCsv(readFileSync(join(CORPUS_DIR, `${name}.csv`), 'utf8'))) {
        if (row.provenance === 'author-cell') continue;
        // enriched row = what the shim WOULD see if it had joined labels in (§3.2 column path)
        const enriched = { ...row, ...(coldById.get(row.id) ?? {}), ...(finalById.get(row.id) ?? {}) };
        const full = buildPayload(enriched, rubricBytes);
        const blankedRow = { ...enriched };
        for (const f of FORBIDDEN_PAYLOAD_FIELDS) blankedRow[f] = '';
        if (full !== buildPayload(blankedRow, rubricBytes)) {
          RED('B', row.id, `payload differs when forbidden fields blanked — template carries leakage`);
          ok = false;
          fails += 1;
          if (fails >= 3) break;
        }
      }
      if (fails >= 3) break;
    }
    if (bench) {
      let leaks = 0;
      for (const r of bench.rows) {
        if (!r.payload.startsWith(rubricBytes)) { RED('B', r.id, `payload is not frozen-builder output (rubric prefix missing)`); ok = false; break; }
        const tail = r.payload.slice(rubricBytes.length); // rubric legitimately names the vocabulary; the finding/context tail may not
        if (GRADE_TOKEN.test(tail) || FINDING_ID.test(tail)) {
          RED('B', r.id, `built-input payload carries a grade token / finding-ID pattern outside the rubric`);
          ok = false;
          leaks += 1;
          if (leaks >= 3) break;
        }
      }
    } else { RED('B', '-', `bench-input.json missing`); ok = false; }
    if (ok) OK('B', `differential blind over frozen buildPayload (${FORBIDDEN_PAYLOAD_FIELDS.length} forbidden fields incl. every *_cold/*_final) + token rescan of 151 built payloads — 0 leaks`);
  }

  // --- ARM C — enum validity of judge artifacts ---
  {
    let ok = true;
    for (const [name, art] of [['s4-c1-sonnet.json', c1Art], ['s4-c2-sonnet.json', c2Art]]) {
      if (!art) { RED('C', name, `artifact missing`); ok = false; continue; }
      if ((art.results ?? []).length !== EXPECTED_LABELABLE) { RED('C', name, `results=${art.results?.length} expected 151`); ok = false; continue; }
      for (const r of art.results) {
        if (!VALID_CLASS.has(r.class) || !VALID_LAYER.has(r.layer) || !VALID_WHOSE.has(r.whose)) {
          RED('C', r.id, `enum violation (or null): ${r.class}/${r.layer}/${r.whose} — unparsed rows must not ship`);
          ok = false;
          break;
        }
      }
    }
    if (ok) OK('C', `all 151×2 result rows carry valid class/layer/whose enums`);
  }

  // --- ARM D — subset honesty (recomputed from orig_grade, D-K8 printed) ---
  {
    let ok = true;
    const recompute = new Set(labelable.filter((r) => { const g = popById.get(r.id).orig_grade; return g && g !== 'none'; }).map((r) => r.id));
    if (recompute.size !== subset.length) { RED('D', '-', `subset drift: scorer=${subset.length} recomputed=${recompute.size}`); ok = false; }
    const csvPath = join(CORPUS_DIR, 's4-bench.csv');
    if (existsSync(csvPath)) {
      const byId = new Map(parseCsv(readFileSync(csvPath, 'utf8')).map((r) => [r.id, r]));
      for (const r of labelable) {
        const want = recompute.has(r.id) ? '1' : '0';
        const got = byId.get(r.id)?.scored_subset ?? '';
        if (got !== want) { RED('D', r.id, `scored_subset='${got}' != recomputed '${want}'`); ok = false; break; }
        if (want === '1' && byId.get(r.id)?.c0_class !== C0(popById.get(r.id).orig_grade)) { RED('D', r.id, `c0_class != orig_grade mapping`); ok = false; break; }
      }
    }
    console.log(`ARM D note: scored subset ${subset.length}/${labelable.length} = ${pct(subset.length / labelable.length)} (D-K8 floor ~70% — ${(subset.length / labelable.length).toFixed(3)} >= 0.7: ${subset.length / labelable.length >= 0.7 ? 'yes' : 'NO'})`);
    if (ok) OK('D', `subset recomputed from orig_grade != none (${recompute.size}); flags + c0_class columns match`);
  }

  // --- ARM E — report-number reconciliation (block + PROSE both, round-1 fidelity item 1 / W-1) ---
  {
    const rp = join(REPO_ROOT, REPORT_REL);
    if (Object.keys(NUM).length === 0) RED('E', '-', `scorer produced no numbers — artifacts missing`);
    else if (!existsSync(rp)) RED('E', REPORT_REL, `bench report missing`);
    else {
      const text = readFileSync(rp, 'utf8');
      const block = /<!-- s4-numbers[^\n]*\n([\s\S]*?)-->/u.exec(text);
      if (!block) RED('E', REPORT_REL, `s4-numbers block missing — report numbers cannot be reconciled`);
      else {
        const reported = new Map(block[1].trim().split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
        const missing = Object.keys(NUM).filter((k) => !reported.has(k));
        const drift = [...reported.entries()].filter(([k, v]) => NUM[k] !== undefined && NUM[k] !== v);
        // PROSE reconciliation (round-1 fidelity MAJOR / W-1): the block alone compares the report
        // against its own generator — an edited PROSE number stays green. Every canonical number
        // must ALSO appear in the report text OUTSIDE the block with its computed value
        // (boundary-anchored: not preceded by a digit/decimal point, not followed by a digit or a
        // decimal point + digit — so '25' does not match inside '0.325' or '25.5', while a
        // sentence-ending period after '0.736.' still matches); absent ⇒ prose drift or an
        // unstated canonical number, present-with-another-value ⇒ the computed token is absent.
        // The block remains the canonical carrier; this check is in addition, not instead.
        const prose = text.replace(/<!-- s4-numbers[\s\S]*?-->/u, '');
        const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
        const absentInProse = Object.entries(NUM).filter(([, v]) => !new RegExp(`(?<![\\d.])${esc(v)}(?!\\d|\\.\\d)`, 'u').test(prose));
        if (missing.length) RED('E', missing[0], `number present in scorer output but absent from report block (${missing.length} missing)`);
        else if (drift.length) RED('E', drift[0][0], `report block says '${drift[0][1]}' scorer says '${NUM[drift[0][0]]}'`);
        else if (absentInProse.length) RED('E', absentInProse[0][0], `canonical number '${absentInProse[0][1]}' not found in the report prose outside the s4-numbers block — prose drift or unstated canonical number`);
        else OK('E', `all ${Object.keys(NUM).length} numbers reconcile: report block == scorer AND every value present in the report prose (digit-boundary matched)`);
      }
    }
  }

  // --- ARM F — substrate immutability by blob hash at the S3 squash ---
  {
    const files = [
      ...POPULATIONS.map((n) => `docs/meta-factory/triage-corpus/${n}.csv`),
      'docs/meta-factory/triage-corpus/s2-labels.csv',
      'docs/meta-factory/triage-corpus/s2-rubric-whose.md',
      'docs/meta-factory/triage-corpus/s3-final.csv',
      'docs/meta-factory/triage-corpus/s3-adjudication.csv',
      'scripts/triage-corpus-probe.mjs', 'scripts/triage-s0-run.mjs', 'scripts/triage-s0-score.mjs',
      'scripts/triage-s2-labels-check.mjs', 'scripts/triage-s3-agreement.mjs',
    ];
    const walk = (d) => readdirSync(join(REPO_ROOT, d), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]));
    files.push(...walk('docs/meta-factory/triage-corpus/sources'));
    let ok = true;
    for (const f of files) {
      try {
        const at = execFileSync('git', ['rev-parse', `${FROZEN_TREE}:${f}`], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
        const now = execFileSync('git', ['hash-object', f], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
        if (at !== now) { RED('F', f, `blob ${now.slice(0, 12)} != ${FROZEN_TREE}:${at.slice(0, 12)} — frozen substrate edited`); ok = false; break; }
      } catch (e) {
        RED('F', f, `not resolvable at ${FROZEN_TREE} (${String(e.message).split('\n')[0].slice(0, 120)})`); ok = false; break;
      }
    }
    if (ok) OK('F', `${files.length} substrate files byte-identical to ${FROZEN_TREE} (blob hashes)`);
  }

  // --- ARM G — promptfoo devDep ⟺ SSOT row ≥ 250 naming promptfoo ---
  {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'));
    const ssot = readFileSync(join(REPO_ROOT, 'docs/meta-factory/prior-art-evaluations.md'), 'utf8');
    if (!pkg.devDependencies?.promptfoo) RED('G', 'package.json', `promptfoo devDependency absent`);
    else {
      const row = /^\| 250 \|[^\n]*$/mu.exec(ssot);
      if (!row || !/promptfoo/u.test(row[0])) RED('G', 'prior-art-evaluations.md', `row 250 absent or does not name promptfoo`);
      else if (!/ADOPT/u.test(row[0])) RED('G', 'prior-art-evaluations.md', `row 250 verdict is not ADOPT`);
      else OK('G', `devDependencies.promptfoo=${pkg.devDependencies.promptfoo} ⟺ SSOT row #250 (ADOPT) names promptfoo`);
    }
  }

  // --- ARM H — judge provenance (the arm nothing else covers, §3.4) ---
  {
    let ok = true;
    const art = buildBenchInput();
    if (bench && art.sha256 !== bench.sha256) { RED('H', 'bench-input.json', `stamped sha ${bench.sha256.slice(0, 12)} != recomputed ${art.sha256.slice(0, 12)}`); ok = false; }
    for (const [name, a] of [['s4-c1-sonnet.json', c1Art], ['s4-c2-sonnet.json', c2Art]]) {
      if (!a) { RED('H', name, `artifact missing`); ok = false; continue; }
      if (a.model !== PINNED_MODEL) { RED('H', name, `model='${a.model}' — judge model must be '${PINNED_MODEL}' by name (§3.4); a swap is a PARK`); ok = false; }
      if (a.rubric !== rubricBytes) { RED('H', name, `rubric not byte-identical to s2-rubric-whose.md`); ok = false; }
      if (a.rubricSource !== RUBRIC_REL) { RED('H', name, `rubricSource='${a.rubricSource}' != '${RUBRIC_REL}'`); ok = false; }
      if (bench && a.benchInputSha256 !== bench.sha256) { RED('H', name, `benchInputSha256 mismatch vs stamped bench-input.json`); ok = false; }
    }
    if (ok) OK('H', `model='sonnet' in both artifacts; rubric byte-identical; benchInputSha256 recomputed=${art.sha256.slice(0, 12)}…`);
  }
}

if (CHECK) {
  console.log(render());
  console.log('');
  runArms();
  if (reds.length) { console.error(`\nFAIL — ${reds.length} red, ${okCount} ok`); process.exit(1); }
  console.log(`\nPASS — all ${okCount} arm(s) ok`);
  process.exit(0);
}
console.log(render());
console.log('\n<!-- s4-numbers (canonical block — pasted verbatim into the report; arm E reconciles)');
for (const [k, v] of Object.entries(NUM)) console.log(`${k}=${v}`);
console.log('-->');
