#!/usr/bin/env node
// S4 test-derivation for the promptfoo runner (kickoff-s4 §3.4/§3.5).
// C1: one test per labelable row — vars.payload = the frozen buildPayload output verbatim.
// C2: one test per `source` group (41 groups, sizes fixed by the substrate — never merged or
// split) — payload = same rubric bytes + a numbered finding LIST, output keyed by row id.
// Both files are DERIVED artifacts (regenerated from buildBenchInput() every run and sha-gated
// against bench-input.json) — the stamped substrate is bench-input.json, never these.
// Usage: node scripts/triage-kernel-v2-bench/make-tests.mjs

import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { buildBenchInput } from './build-input.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Group label + numbered list wrapper around the SAME rubric bytes (§3.5: same rubric as C1). */
export function buildC2Payload(rubricBytes, groupRows) {
  const items = groupRows
    .map((r, i) => `[${i + 1}] id=${r.id} — ${r.context}\n    finding: ${r.finding}`)
    .join('\n\n');
  const ids = groupRows.map((r) => r.id).join(' | ');
  return `${rubricBytes}

Self-review pass: you are re-grading the full LIST of findings raised in ONE review loop,
listed below. Context lines are mechanical provenance only (PR#, round, cited path). For EACH
numbered finding, decide the three axes from the finding text alone, applying the yardstick
and the four questions above exactly as written.

${items}

Answer with EXACTLY one line per finding, in the same order, each keyed by its id, and
nothing else. The ids in scope are: ${ids}.
<id>: class=<MATERIAL|IMMATERIAL> layer=<idea|design|architecture|plan|implementation> whose=<reviewer|advisor|operator-floor>`;
}

/** Group rows by the `source` column in first-appearance order (§3.5 — the fixed grouping key). */
export function groupBySource(rows) {
  const groups = [];
  const byKey = new Map();
  for (const r of rows) {
    if (!byKey.has(r.source)) { byKey.set(r.source, []); groups.push(r.source); }
    byKey.get(r.source).push(r);
  }
  return groups.map((key) => ({ key, rows: byKey.get(key) }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const art = buildBenchInput();
  const c1 = art.rows.map((r) => ({ description: r.id, vars: { payload: r.payload } }));
  const groups = groupBySource(art.rows);
  const c2 = groups.map((g) => ({ description: g.key, vars: { payload: buildC2Payload(art.rubricBytes, g.rows) } }));
  writeFileSync(join(HERE, 'tests-c1.json'), `${JSON.stringify(c1, null, 1)}\n`);
  writeFileSync(join(HERE, 'tests-c2.json'), `${JSON.stringify(c2, null, 1)}\n`);
  const multi = groups.filter((g) => g.rows.length > 1);
  console.log(`[INFO] tests-c1=151 wrote=${c1.length} | tests-c2 groups=${groups.length} (multi=${multi.length}, singletons=${groups.length - multi.length}) | benchInputSha256=${art.sha256}`);
}
