#!/usr/bin/env node
// Deterministic anti-leakage probe for the triage corpus (spec §2, r2 NEW-B1/M1).
// Two fail-closed arms, run over the committed CSVs, per row `provenance`:
//   (a) provenance-substring — each row's normalized `finding` must be a substring of its
//       normalized source text (`pr-body` rows: the PR body; `review-report` rows: the tracked
//       reports under triage-corpus/sources/), proving it was copied from the source the row
//       claims, not from the audit's own Basis column. `author-cell` rows have no blind source
//       text by design (spec §2, r2 NEW-M2) — the substring arm is N/A for them, the grade scan
//       still runs. Any other provenance value fails closed.
//   (b) grade-token scan — no grade token or finding-ID pattern may survive in `finding`/`context`.
// Plus a cross-file `id` + normalized-finding-text uniqueness check over the union of all files
// passed in one invocation (spec §2: a finding lives in exactly ONE file).
// Usage: node scripts/triage-corpus-probe.mjs <corpus.csv...> [--bodies <dir>] [--sources <dir>]
// Bodies are fetched with `gh pr view <n> --json body` unless a cache dir is supplied.

import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const DEFAULT_SOURCES_DIR = 'docs/meta-factory/triage-corpus/sources';

/** Collapse every whitespace run so hard-wrapped PR-body prose compares as one line. */
export const normalize = (s) => s.replace(/\s+/gu, ' ').trim();

const LIST_MARKER = /^\s*(?:[-*+]\s+|\d+\.\s+|\(\d+\)\s+)/u;
const LEADING_GRADE = /^\s*(?:BLOCKER|MAJOR|MINOR)(?:\s*[×x]\s*\d+)?\s*(?:[—:–-]\s*)?/u;
const LEADING_FINDING_ID = /^\s*(?:R\d+\s+)?(?:TD|BU)?\s*[MBNIK]\d+[a-d]?(?:\s*\([^)]*\))?\s*[:—–-]\s*/u;

/** Deterministic grade-strip normalization (spec §2, r2 NEW-B1) applied before a row is written. */
export function stripGrades(text) {
  let out = text;
  for (let i = 0; i < 6; i += 1) {
    const before = out;
    out = out.replace(LIST_MARKER, '').replace(LEADING_GRADE, '').replace(LEADING_FINDING_ID, '');
    if (out === before) break;
  }
  return out.trim();
}

const GRADE_TOKEN = /\b(?:BLOCKER|MAJOR|MINOR)\b/u;
const FINDING_ID = /\b(?:R\d+\s+[MB]\d+|(?:TD|BU)\s+[MBN]\d+)\b/u;

/** Minimal RFC4180 CSV reader — the corpus is the only input and it is machine-written. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else { quoted = false; }
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.length > 1 || r[0] !== '');
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

export function loadBody(pr, cacheDir) {
  if (cacheDir) {
    const cached = join(cacheDir, `${pr}.md`);
    if (existsSync(cached)) return readFileSync(cached, 'utf8');
    mkdirSync(cacheDir, { recursive: true });
    const fetched = execFileSync('gh', ['pr', 'view', String(pr), '--json', 'body', '-q', '.body'], { encoding: 'utf8' });
    writeFileSync(cached, fetched);
    return fetched;
  }
  return execFileSync('gh', ['pr', 'view', String(pr), '--json', 'body', '-q', '.body'], { encoding: 'utf8' });
}

function loadSources(sourcesDir) {
  const files = readdirSync(sourcesDir).filter((f) => f.endsWith('.md'));
  return normalize(files.map((f) => readFileSync(join(sourcesDir, f), 'utf8')).join('\n'));
}

export function probe(rows, cacheDir, sourcesDir = DEFAULT_SOURCES_DIR) {
  const bodies = new Map();
  let sources = null;
  const failures = [];
  for (const r of rows) {
    if (r.provenance === 'pr-body') {
      const pr = r.source.match(/(\d{3,})/u)?.[1];
      if (!bodies.has(pr)) bodies.set(pr, normalize(loadBody(pr, cacheDir)));
      if (!bodies.get(pr).includes(normalize(r.finding))) {
        failures.push({ id: r.id, arm: 'substring', detail: `finding is not a substring of PR #${pr} body` });
      }
    } else if (r.provenance === 'review-report') {
      sources ??= loadSources(sourcesDir);
      if (!sources.includes(normalize(r.finding))) {
        failures.push({ id: r.id, arm: 'substring', detail: `finding is not a substring of any ${sourcesDir}/*.md` });
      }
    } else if (r.provenance !== 'author-cell') {
      // author-cell rows have no blind source text — substring arm N/A by design (spec §2);
      // anything else is an unknown provenance and fails closed.
      failures.push({ id: r.id, arm: 'provenance', detail: `unsupported provenance ${r.provenance}` });
    }
    for (const [field, value] of [['finding', r.finding], ['context', r.context]]) {
      if (GRADE_TOKEN.test(value)) failures.push({ id: r.id, arm: 'grade-token', detail: `${field} carries a grade token` });
      if (FINDING_ID.test(value)) failures.push({ id: r.id, arm: 'grade-token', detail: `${field} carries a finding-ID pattern` });
    }
  }
  const seen = new Map();
  for (const r of rows) {
    for (const [kind, key] of [['id', r.id], ['finding-text', normalize(r.finding)]]) {
      const k = `${kind}:${key}`;
      if (seen.has(k)) failures.push({ id: r.id, arm: 'uniqueness', detail: `duplicate ${kind} (first seen in ${seen.get(k)})` });
      else seen.set(k, r.id);
    }
  }
  return failures;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
  const bodiesDir = opt('--bodies');
  const sourcesDir = opt('--sources') ?? DEFAULT_SOURCES_DIR;
  if (args.length === 0) { console.error('usage: triage-corpus-probe.mjs <corpus.csv...> [--bodies <dir>] [--sources <dir>]'); process.exit(2); }
  const rows = args.flatMap((csv) => parseCsv(readFileSync(csv, 'utf8')));
  const failures = probe(rows, bodiesDir, sourcesDir);
  for (const f of failures) console.error(`FAIL ${f.arm} ${f.id}: ${f.detail}`);
  console.log(`${args.length} file(s) · ${rows.length} rows · ${failures.length} probe failures`);
  process.exit(failures.length ? 1 : 0);
}
