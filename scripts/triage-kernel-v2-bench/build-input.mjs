#!/usr/bin/env node
// S4 bench input builder (kickoff-s4 §3.2). Joins the six population CSVs to s3-final.csv
// by id, defensively drops provenance:author-cell rows, and emits the per-row judge payload
// via the FROZEN builder `buildPayload` (scripts/triage-s0-run.mjs:36 — imported, never
// edited, kickoff §2). Judges therefore see rubric + context + finding ONLY; the blindness
// differential (arm B) is enforced by the scorer over this same frozen builder.
//
// Artifact: scripts/triage-kernel-v2-bench/bench-input.json
//   { sha256, generatedFrom: [...], rows: [{id, source, payload}] }
// sha256 = SHA-256 over JSON.stringify(projected rows) — deterministic, recomputed by the
// scorer's arm H from this module at check time (import buildBenchInput, never re-parse trust).
//
// Usage: node scripts/triage-kernel-v2-bench/build-input.mjs [--out <file>] (default: bench-input.json beside this script)

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { parseCsv } from '../triage-corpus-probe.mjs';
import { buildPayload } from '../triage-s0-run.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(HERE, '..', '..');
export const CORPUS_DIR = join(REPO_ROOT, 'docs', 'meta-factory', 'triage-corpus');
export const POPULATIONS = ['audit-1369', 's4-round7', 'arch-reviews', 'kickoff-loops', 'td-m3', 'research-forks'];
export const RUBRIC_REL = 'docs/meta-factory/triage-corpus/s2-rubric-whose.md';
export const EXPECTED_LABELABLE = 151;

const rel = (p) => p.slice(REPO_ROOT.length + 1);

/** Serialize exactly the artifact's rows array — the sha256 preimage (stable projection). */
export function serializeRows(rows) {
  return JSON.stringify(rows.map((r) => ({ id: r.id, source: r.source, payload: r.payload })));
}

/**
 * Build the bench input deterministically from the frozen substrate.
 * Returns full in-memory rows (finding/context retained for the C2 grouped-prompt builder)
 * plus the projected artifact rows, their sha256, and the input file list.
 */
export function buildBenchInput() {
  const rubricBytes = readFileSync(join(REPO_ROOT, RUBRIC_REL), 'utf8');
  const finalIds = new Set(parseCsv(readFileSync(join(CORPUS_DIR, 's3-final.csv'), 'utf8')).map((r) => r.id));
  const rows = [];
  let rowsIn = 0;
  let excludedAuthorCell = 0;
  for (const name of POPULATIONS) {
    for (const row of parseCsv(readFileSync(join(CORPUS_DIR, `${name}.csv`), 'utf8'))) {
      rowsIn += 1;
      if (row.provenance === 'author-cell') { excludedAuthorCell += 1; continue; } // defensive: already absent from final
      if (!finalIds.has(row.id)) continue;
      rows.push({
        id: row.id,
        source: row.source,
        finding: row.finding,
        context: row.context,
        payload: buildPayload(row, rubricBytes),
      });
    }
  }
  const projected = rows.map((r) => ({ id: r.id, source: r.source, payload: r.payload }));
  const sha256 = createHash('sha256').update(serializeRows(rows)).digest('hex');
  const generatedFrom = [
    ...POPULATIONS.map((n) => `docs/meta-factory/triage-corpus/${n}.csv`),
    'docs/meta-factory/triage-corpus/s3-final.csv',
    RUBRIC_REL,
  ];
  return { rowsIn, excludedAuthorCell, rubricBytes, rows, projected, sha256, generatedFrom };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const flag = (name, dflt) => (args.indexOf(name) >= 0 ? args[args.indexOf(name) + 1] : dflt);
  const out = flag('--out', join(HERE, 'bench-input.json'));
  const art = buildBenchInput();
  if (art.rows.length !== EXPECTED_LABELABLE) {
    console.error(`[ERROR] labelable rows = ${art.rows.length}, expected ${EXPECTED_LABELABLE} — substrate moved; PARK per kickoff §9 (do not proceed, do not "fix")`);
    process.exit(1);
  }
  writeFileSync(out, `${JSON.stringify({ sha256: art.sha256, generatedFrom: art.generatedFrom, rows: art.projected }, null, 1)}\n`);
  console.log(`[INFO] rows-in=${art.rowsIn} joined=${art.rows.length} excluded-author-cell=${art.excludedAuthorCell} sha256=${art.sha256}`);
  console.log(`[INFO] wrote ${rel(out)} (${art.generatedFrom.length} inputs recorded in generatedFrom)`);
}
