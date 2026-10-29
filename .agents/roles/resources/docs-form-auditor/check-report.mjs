#!/usr/bin/env node
/** Docs-form output grammar only. Valid structure never proves evidence is true. */
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const fields = ['root', 'population', 'sample', 'numbers', 'trailerDiff', 'patterns', 'cardGaps'];
const statuses = new Set(['PASS', 'FAIL', 'N/A', 'unassessed']);
const nonempty = (v) => typeof v === 'string' && v.trim().length > 0;
// C12 only: criteria-card + page-kinds registry; coverage claims are not receipts.
// Integration revision: docs_form_closure lane; canonical role ownership retained.
const bulkKinds = new Set(['reference-sheet', 'family-overview', 'learn-tutorial', 'guide', 'understand']);
function validateC12(row, kind, key, errors) {
  const required = bulkKinds.has(kind) ? ['GATE', 'JUDGE'] : kind === 'face-page' ? ['JUDGE'] : kind === 'glossary' ? [] : undefined;
  if (!required) { errors.push(`${key}: unsupported supplied kind; C12 applicability unavailable`); return 'unassessed'; }
  if (!Array.isArray(row.formChecks)) { errors.push(`${key}: explicit formChecks required`); return 'unassessed'; }
  const checks = new Map();
  for (const part of row.formChecks) {
    if (!part || !required.includes(part.id)) { errors.push(`${key}: unexpected FORM check identity`); continue; }
    if (checks.has(part.id)) errors.push(`${key}: duplicate ${part.id}`);
    checks.set(part.id, part);
    if (!['PASS', 'FAIL', 'unassessed'].includes(part.status)) errors.push(`${key} ${part.id}: invalid assessed status`);
    if (!nonempty(part.evidence)) errors.push(`${key} ${part.id}: evidence or unavailable reason required`);
    if (['PASS', 'FAIL'].includes(part.status) && !/[^\s:]+:\d+/.test(part.evidence || '')) errors.push(`${key} ${part.id}: file:line evidence required`);
    if (part.status === 'FAIL' && !nonempty(part.failureScenario)) errors.push(`${key} ${part.id}: failureScenario required`);
  }
  for (const id of required) if (!checks.has(id)) errors.push(`${key}: missing ${id} FORM check`);
  const aggregate = required.length === 0 ? 'N/A' : required.some(id => !checks.has(id) || checks.get(id).status === 'unassessed') ? 'unassessed' : required.some(id => checks.get(id).status === 'FAIL') ? 'FAIL' : 'PASS';
  if (row.status !== aggregate) errors.push(`${key}: aggregate must be ${aggregate}`);
  return aggregate;
}

export function validateReport(report) {
  const errors = [];
  if (!report || typeof report !== 'object' || Array.isArray(report)) return ['report must be an object'];
  for (const key of fields) if (!nonempty(report[key])) errors.push(`${key} must be nonempty`);
  if (!['GO', 'REVISE', 'STOP'].includes(report.overall)) errors.push('overall must be GO, REVISE or STOP');
  if (!Array.isArray(report.cards)) return [...errors, 'cards must be an array'];
  if (!report.cards.length && report.overall !== 'STOP') errors.push('no cards requires STOP');
  let failed = false, unassessed = false;
  for (const card of report.cards) {
    if (!card || !nonempty(card.page) || !nonempty(card.kind) || !Array.isArray(card.rows)) {
      errors.push('each card requires page, kind and rows'); continue;
    }
    const counts = new Map();
    for (const row of card.rows) {
      if (!row || !/^C(?:[1-9]|1[0-3])$/.test(row.id)) { errors.push(`${card.page}: invalid criterion id`); continue; }
      const key = `${card.page} ${row.id}`;
      counts.set(row.id, (counts.get(row.id) || 0) + 1);
      if (!statuses.has(row.status)) errors.push(`${key}: invalid status`);
      if (!nonempty(row.evidence)) errors.push(`${key}: evidence or unavailable reason required`);
      if (['PASS', 'FAIL'].includes(row.status) && !/[^\s:]+:\d+/.test(row.evidence || '')) errors.push(`${key}: file:line evidence required`);
      if (row.status === 'FAIL') {
        failed = true;
        if (!nonempty(row.failureScenario)) errors.push(`${key}: failureScenario required`);
      }
      if (row.status === 'unassessed') unassessed = true;
      if (row.id === 'C12' && validateC12(row, card.kind, key, errors) === 'unassessed') unassessed = true;
      if (row.id === 'C11' && row.status === 'PASS') {
        const r = card.c11Receipt;
        if (!r || !nonempty(r.command) || !nonempty(r.cwd) || r.exit !== 0 || typeof r.stderr !== 'string') {
          errors.push(`${key}: separate successful D28/D31 c11Receipt required; docs-check silence is insufficient`);
        }
      }
    }
    for (let n = 1; n <= 13; n++) {
      const id = `C${n}`, count = counts.get(id) || 0;
      if (count !== 1) errors.push(`${card.page} ${id}: ${count ? 'duplicate' : 'missing'} criterion`);
    }
  }
  if (unassessed && report.overall !== 'STOP') errors.push('unassessed applicable FORM requires STOP');
  if (failed && report.overall === 'GO') errors.push('scenario-bearing FAIL cannot yield GO');
  if (!failed && report.overall === 'REVISE') errors.push('REVISE requires scenario-bearing FAIL');
  return errors;
}

const cell = (value) => value.trim().replaceAll('|', '\\|').replaceAll('\n', '<br>');
export function renderReport(report) {
  const errors = validateReport(report);
  if (errors.length) throw new Error(errors.join('\n'));
  const cards = report.cards.map((card) => {
    const rows = card.rows.map((row) => {
      const parts = row.id === 'C12' ? row.formChecks.map(part => `${part.id}: ${part.status} — ${cell(part.evidence)}${part.status === 'FAIL' ? ` Failure-scenario: ${cell(part.failureScenario)}` : ''}`).join('<br>') : '';
      return `| ${row.id} | ${row.status} | ${cell(row.evidence)}${row.status === 'FAIL' ? ` Failure-scenario: ${cell(row.failureScenario)}` : ''}${parts ? `<br>${parts}` : ''} |`;
    }).join('\n');
    return `### ${cell(card.page)} (kind: ${cell(card.kind)})\n\n| Criterion | Status | Evidence |\n|---|---|---|\n${rows}${card.c11Receipt ? `\n\nC11 receipt: ${JSON.stringify(card.c11Receipt)}` : ''}`;
  }).join('\n\n');
  return `Resolved root: ${report.root}\n\n## Population\n\n${report.population}\n\n## Sample\n\n${report.sample}\n\n## Numbers\n\n${report.numbers}\n\n## Cards\n\n${cards || 'Unavailable; see Population and Sample.'}\n\n## Trailer diff\n\n${report.trailerDiff}\n\n## Patterns\n\n${report.patterns}\n\n## Card gaps\n\n${report.cardGaps}\n\n## Overall\n\n${report.overall}\n`;
}

let direct = false;
try { direct = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { /* unavailable invocation */ }
if (direct) {
  try { process.stdout.write(renderReport(JSON.parse(readFileSync(0, 'utf8')))); }
  catch (error) { process.stderr.write(`docs-form-report: REJECT\n${error.message}\n`); process.exitCode = 1; }
}
