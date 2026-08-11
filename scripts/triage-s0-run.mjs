#!/usr/bin/env node
// S0 probe runner: candidate C1 (rubric judge) over the corpus, one blind process per row.
// Each row is judged by a fresh `claude -p` with no tools and no session state, so the judge
// sees the row text and the rubric and nothing else. C0 needs no runner — it is a pure mapping
// from orig_grade, scored in triage-s0-score.mjs.
// Usage: node scripts/triage-s0-run.mjs <corpus.csv> <out.json> [--model sonnet] [--concurrency 5]

import { readFileSync, writeFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { parseCsv } from './triage-corpus-probe.mjs';

const RUBRIC = `You are triaging ONE review finding. Decide three axes from the text alone.

Binding yardstick: a finding is MATERIAL if and only if fixing it changed behaviour or a decision,
or NOT fixing it would have cost something toward the project goal ("AI agents can't silently
bypass undocumented conventions"). IMMATERIAL = cosmetic or numeric nit with zero downstream
effect. That a finding was fixed does not make it material.

Apply these questions before answering:
1. Does acting on this move the work toward the goal, or only satisfy a form?
2. Is it theatre - the shape of diligence with no substance behind its target?
3. Is it immaterial - would no consumer and no decision notice the difference?
4. Materiality scales with the highest layer the finding touches (idea > design > architecture >
   plan > implementation); conflicts resolve upward.

layer = the highest layer the finding touches: idea | design | architecture | plan | implementation.
whose = who should rule on it: reviewer (a reviewer can settle it), advisor (a concept-level
question above the reviewer), operator-floor (only the project owner can settle it).

Answer with EXACTLY one line and nothing else:
class=<MATERIAL|IMMATERIAL> layer=<idea|design|architecture|plan|implementation> whose=<reviewer|advisor|operator-floor>`;

const args = process.argv.slice(2);
const [csv, out] = args;
const flag = (name, dflt) => (args.indexOf(name) > 0 ? args[args.indexOf(name) + 1] : dflt);
if (!csv || !out) { console.error('usage: triage-s0-run.mjs <corpus.csv> <out.json> [--model m] [--concurrency n]'); process.exit(2); }
const model = flag('--model', 'sonnet');
const concurrency = Number(flag('--concurrency', '5'));

const judge = (row) => new Promise((resolve) => {
  const prompt = `${RUBRIC}\n\nContext (mechanical provenance only): ${row.context}\nFinding: ${row.finding}`;
  execFile('claude', ['-p', '--model', model, '--allowedTools', '', '--strict-mcp-config', prompt],
    { maxBuffer: 1 << 20 }, (err, stdout) => {
      const raw = (stdout || '').trim();
      const m = /class=(MATERIAL|IMMATERIAL)\s+layer=([a-z]+)\s+whose=([a-z-]+)/u.exec(raw);
      resolve({ id: row.id, raw, class: m?.[1] ?? null, layer: m?.[2] ?? null, whose: m?.[3] ?? null, error: err ? String(err.message).slice(0, 120) : null });
    });
});

const rows = parseCsv(readFileSync(csv, 'utf8'));
const results = [];
let next = 0;
await Promise.all(Array.from({ length: concurrency }, async () => {
  while (next < rows.length) {
    const row = rows[next]; next += 1;
    const r = await judge(row);
    results.push(r);
    process.stderr.write(`${results.length}/${rows.length} ${r.id} ${r.class ?? 'UNPARSED'}\n`);
  }
}));
results.sort((a, b) => rows.findIndex((r) => r.id === a.id) - rows.findIndex((r) => r.id === b.id));
writeFileSync(out, `${JSON.stringify({ candidate: 'C1', model, rubric: RUBRIC, results }, null, 1)}\n`);
console.log(`C1 (${model}): ${results.filter((r) => r.class).length}/${rows.length} parsed -> ${out}`);
