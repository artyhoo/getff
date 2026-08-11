#!/usr/bin/env node
// S0 probe scorer: C1 vs C0 against the operator labels (ground truth).
// C0 = the deterministic status-quo bar (spec D-K8): BLOCKER/MAJOR -> MATERIAL, MINOR -> IMMATERIAL.
// The sample deliberately over-represents the strata where C0 and the audit's start-class disagree,
// so raw sample accuracy is NOT a population estimate. The weight-free decision quantities are
// recovery (C1 right where C0 is wrong) and breakage (C1 wrong where C0 is right); the break-even
// line states what breakage rate would cancel the recovery at a given population C0 error rate.
// Usage: node scripts/triage-s0-score.mjs <corpus.csv> <labels.json> <c1.json> [--c0-population-error 0.15]

import { readFileSync } from 'node:fs';
import { parseCsv } from './triage-corpus-probe.mjs';

const args = process.argv.slice(2);
const [csvPath, labelsPath, c1Path] = args;
if (!c1Path) { console.error('usage: triage-s0-score.mjs <corpus.csv> <labels.json> <c1.json>'); process.exit(2); }
const popErr = Number(args.indexOf('--c0-population-error') > 0 ? args[args.indexOf('--c0-population-error') + 1] : 0.15);

const rows = parseCsv(readFileSync(csvPath, 'utf8'));
const labels = JSON.parse(readFileSync(labelsPath, 'utf8'));
const c1 = JSON.parse(readFileSync(c1Path, 'utf8'));
const c1By = new Map(c1.results.map((r) => [r.id, r]));

const C0 = (grade) => (grade === 'MINOR' ? 'IMMATERIAL' : grade === 'none' ? null : 'MATERIAL');

const scored = rows
  .map((r) => ({ ...r, truth: labels[r.id], c0: C0(r.orig_grade), c1: c1By.get(r.id)?.class ?? null }))
  .filter((r) => r.truth === 'MATERIAL' || r.truth === 'IMMATERIAL');
const usable = scored.filter((r) => r.c0 && r.c1);

const acc = (rs, k) => rs.filter((r) => r[k] === r.truth).length / rs.length;
const missRate = (rs, k) => {
  const mat = rs.filter((r) => r.truth === 'MATERIAL');
  return mat.length ? mat.filter((r) => r[k] !== 'MATERIAL').length / mat.length : NaN;
};
const kappa = (rs, k) => {
  const n = rs.length;
  const po = acc(rs, k);
  const pM = (a) => rs.filter((r) => r[a] === 'MATERIAL').length / n;
  const pe = pM('truth') * pM(k) + (1 - pM('truth')) * (1 - pM(k));
  return { po, kappa: (po - pe) / (1 - pe), pabak: 2 * po - 1 };
};
const choose = (n, k) => { let v = 1; for (let i = 0; i < k; i += 1) v = (v * (n - i)) / (i + 1); return v; };
const mcnemar = (b, c) => {
  const n = b + c;
  if (!n) return 1;
  let s = 0;
  for (let i = 0; i <= Math.min(b, c); i += 1) s += choose(n, i);
  return Math.min(1, 2 * s * 0.5 ** n);
};

const b = usable.filter((r) => r.c0 === r.truth && r.c1 !== r.truth).length;
const c = usable.filter((r) => r.c0 !== r.truth && r.c1 === r.truth).length;
const c0Wrong = usable.filter((r) => r.c0 !== r.truth).length;
const c0Right = usable.length - c0Wrong;
const recovery = c0Wrong ? c / c0Wrong : NaN;
const breakage = c0Right ? b / c0Right : NaN;

const pct = (x) => (Number.isNaN(x) ? 'n/a' : `${(100 * x).toFixed(1)}%`);
const out = [];
out.push(`rows=${rows.length} labelled=${scored.length} scored=${usable.length} (dropped: ${rows.length - usable.length})`);
out.push('');
out.push(`C0 accuracy   ${pct(acc(usable, 'c0'))}   MATERIAL-miss ${pct(missRate(usable, 'c0'))}`);
out.push(`C1 accuracy   ${pct(acc(usable, 'c1'))}   MATERIAL-miss ${pct(missRate(usable, 'c1'))}   model=${c1.model}`);
const k1 = kappa(usable, 'c1'); const k0 = kappa(usable, 'c0');
out.push(`C1 vs operator: kappa ${k1.kappa.toFixed(3)} PABAK ${k1.pabak.toFixed(3)} | C0: kappa ${k0.kappa.toFixed(3)} PABAK ${k0.pabak.toFixed(3)}`);
out.push('');
out.push(`discordant pairs: C0-right/C1-wrong b=${b} · C0-wrong/C1-right c=${c} · McNemar exact p=${mcnemar(b, c).toFixed(4)}`);
out.push(`recovery (C1 right where C0 wrong) ${c}/${c0Wrong} = ${pct(recovery)}`);
out.push(`breakage (C1 wrong where C0 right) ${b}/${c0Right} = ${pct(breakage)}`);
const breakEven = (recovery * popErr) / (1 - popErr);
out.push(`population break-even at C0 error ${pct(popErr)}: C1 nets positive while breakage < ${pct(breakEven)}`);
out.push('');
out.push('per stratum (n · C0 · C1):');
for (const s of [...new Set(usable.map((r) => r.stratum))].sort()) {
  const rs = usable.filter((r) => r.stratum === s);
  out.push(`  ${s.padEnd(22)} n=${String(rs.length).padStart(2)}  C0 ${pct(acc(rs, 'c0')).padStart(6)}  C1 ${pct(acc(rs, 'c1')).padStart(6)}`);
}
out.push('');
out.push('disagreements (id · truth · C0 · C1):');
for (const r of usable.filter((x) => x.c0 !== x.truth || x.c1 !== x.truth)) {
  out.push(`  ${r.id.padEnd(12)} truth=${r.truth.padEnd(10)} C0=${r.c0.padEnd(10)} C1=${r.c1}`);
}
console.log(out.join('\n'));
