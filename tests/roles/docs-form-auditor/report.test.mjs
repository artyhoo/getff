import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync, symlinkSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { validateReport, renderReport } from '../../../.agents/roles/resources/docs-form-auditor/check-report.mjs';

const report = () => ({
  root: '/tmp/consumer with spaces', population: '1 page, guide, gold census',
  sample: '1 of 1 supplied pages, no sampling', numbers: 'strict gate exit 1; C12 missing Verify; C11 unavailable',
  cards: [{ page: 'docs/site/guides/adverse.md', kind: 'guide', rows: Array.from({ length: 13 }, (_, n) => ({
    id: `C${n + 1}`, status: n === 10 ? 'unassessed' : n === 11 ? 'FAIL' : 'PASS',
    evidence: n === 10 ? 'D28/D31 gate receipt unavailable' : 'docs/site/guides/adverse.md:1 — supplied page/gate evidence',
    ...(n === 11 ? { failureScenario: 'A reader cannot confirm the result because Verify is missing.', formChecks: [
      { id: 'GATE', status: 'FAIL', evidence: 'docs/site/guides/adverse.md:1 — required Verify absent', failureScenario: 'A reader cannot verify success.' },
      { id: 'JUDGE', status: 'FAIL', evidence: 'docs/site/guides/adverse.md:1 — no verification step', failureScenario: 'A reader cannot confirm the result.' },
    ] } : {}),
  })) }], trailerDiff: 'No tracked commit; no writer trailer', patterns: 'LOCAL', cardGaps: 'None', overall: 'STOP',
});

test('STOP retains page failures and unassessed rows; renderer cannot omit scenario', () => {
  const r = report(); assert.deepEqual(validateReport(r), []);
  const text = renderReport(r);
  assert.match(text, /C12 \| FAIL .*Failure-scenario: A reader/);
  assert.match(text, /C11 \| unassessed/);
});
test('missing and empty scenario rejected even under STOP', () => {
  for (const value of [undefined, '', '   ']) {
    const r = report(); r.cards[0].rows[11].failureScenario = value;
    assert.match(validateReport(r).join('\n'), /C12.*failureScenario/);
  }
});
test('unsupported SPLIT/qualified PASS and missing/duplicate criterion rejected', () => {
  for (const value of ['SPLIT', 'PASS (per gate silence)']) {
    const r = report(); r.cards[0].rows[3].status = value;
    assert.match(validateReport(r).join('\n'), /C4.*status/);
  }
  const missing = report(); missing.cards[0].rows.pop();
  assert.match(validateReport(missing).join('\n'), /C13.*missing/);
  const duplicate = report(); duplicate.cards[0].rows.push(duplicate.cards[0].rows[0]);
  assert.match(validateReport(duplicate).join('\n'), /C1.*duplicate/);
});
test('GO/REVISE cannot mask unavailable FORM coverage', () => {
  for (const overall of ['GO', 'REVISE']) {
    const r = report(); r.overall = overall;
    assert.match(validateReport(r).join('\n'), /unassessed.*STOP/);
  }
});
test('C11 cannot borrow docs-check silence or omit independent receipt', () => {
  const r = report(); r.cards[0].rows[10] = { id: 'C11', status: 'PASS', evidence: 'docs/site/guides/adverse.md:1 — per gate silence' };
  assert.match(validateReport(r).join('\n'), /C11.*c11Receipt/);
});
test('exact retained Claude result has C12 scenario, but invalid SPLIT and C11 evidence', () => {
  const retained = readFileSync(new URL('./fixtures/retained-claude-final.txt', import.meta.url), 'utf8');
  assert.match(retained, /\| C12 \| FAIL \|[^\n]*Failure-scenario:/);
  assert.match(retained, /\| C4 \| SPLIT/);
  assert.match(retained, /\| C11 \| PASS \(per gate silence\)/);
});
test('no fabricated row citation; missing population may safely STOP with no cards', () => {
  const r = report(); r.cards[0].rows[0].evidence = 'looks fine';
  assert.match(validateReport(r).join('\n'), /C1.*file:line/);
  const blocked = report(); blocked.population = 'Supplied directory missing; census blocked'; blocked.cards = [];
  assert.deepEqual(validateReport(blocked), []);
  blocked.overall = 'GO'; assert.match(validateReport(blocked).join('\n'), /no cards/);
});
test('CLI renders valid JSON and rejects invalid/empty input, including path with spaces', () => {
  const url = new URL('../../../.agents/roles/resources/docs-form-auditor/check-report.mjs', import.meta.url);
  for (const input of ['', '{', JSON.stringify({})]) {
    const out = spawnSync(process.execPath, [url.pathname], { input, encoding: 'utf8' });
    assert.equal(out.status, 1); assert.equal(out.stdout, '');
  }
  const out = spawnSync(process.execPath, [url.pathname], { input: JSON.stringify(report()), encoding: 'utf8' });
  assert.equal(out.status, 0); assert.equal(out.stdout, renderReport(report())); assert.match(out.stdout, /consumer with spaces/);
  const dir = mkdtempSync(join(tmpdir(), 'docs-form path with spaces '));
  try {
    symlinkSync(url.pathname, join(dir, 'report helper.mjs'));
    const linked = spawnSync(process.execPath, [join(dir, 'report helper.mjs')], { cwd: dir, input: JSON.stringify(report()), encoding: 'utf8' });
    assert.equal(linked.status, 0); assert.equal(linked.stdout, out.stdout);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('C12 partial FORM aggregate rejects regular-run FAIL and preserves known judge harm under STOP', () => {
  const r=report(), row=r.cards[0].rows[11];
  row.formChecks[0]={id:'GATE',status:'unassessed',evidence:'Unregistered Guide prevents gate skeleton coverage; no required-sections receipt.'};
  assert.match(validateReport(r).join('\n'), /C12.*aggregate.*unassessed/);
  row.status='unassessed'; delete row.failureScenario;
  assert.deepEqual(validateReport(r),[]);
  const text=renderReport(r); assert.match(text,/C12 \| unassessed/); assert.ok(text.includes('Failure-scenario: A reader cannot confirm the result.'));
});
test('all five bulk kinds require exactly GATE and JUDGE; completed failing halves retain FAIL', () => {
  for (const kind of ['reference-sheet','family-overview','learn-tutorial','guide','understand']) {
    const r=report(); r.cards[0].kind=kind; assert.deepEqual(validateReport(r),[]);
    r.cards[0].rows[11].formChecks.pop(); assert.match(validateReport(r).join('\n'), /C12.*JUDGE/);
  }
});
test('face-page C12 is JUDGE-only; glossary has no skeleton check', () => {
  const face=report();face.cards[0].kind='face-page';face.cards[0].rows[11].formChecks.shift();assert.deepEqual(validateReport(face),[]);
  face.cards[0].rows[11].formChecks.push({id:'GATE',status:'PASS',evidence:'face.md:1'});assert.match(validateReport(face).join('\n'),/C12.*unexpected/);
  const glossary=report();glossary.cards[0].kind='glossary';Object.assign(glossary.cards[0].rows[11],{status:'N/A',formChecks:[],evidence:'Registered glossary has no C12 skeleton.'});assert.deepEqual(validateReport(glossary),[]);
  glossary.cards[0].rows[11].status='PASS';assert.match(validateReport(glossary).join('\n'),/C12.*N\/A/);
});
test('missing/duplicate/invalid C12 declarations cannot justify completeness or GO', () => {
  const absent=report();delete absent.cards[0].rows[11].formChecks;assert.match(validateReport(absent).join('\n'),/C12.*formChecks/);
  for (const change of [r=>r.cards[0].rows[11].formChecks.push(r.cards[0].rows[11].formChecks[0]), r=>r.cards[0].rows[11].formChecks[0].status='N/A', r=>delete r.cards[0].rows[11].formChecks[1].failureScenario]) {
    const r=report();change(r);assert.ok(validateReport(r).some(error=>error.includes('C12')));
  }
  const partial=report();partial.cards[0].rows[11].status='unassessed';partial.cards[0].rows[11].formChecks[0]={id:'GATE',status:'unassessed',evidence:'Gate did not assess this page.'};partial.overall='GO';assert.match(validateReport(partial).join('\n'),/unassessed.*STOP/);
});

test('actual CLI rejects partial C12 aggregate FAIL; corrected STOP returns renderer bytes and known scenario', () => {
  const url=new URL('../../../.agents/roles/resources/docs-form-auditor/check-report.mjs',import.meta.url);
  const r=report(), row=r.cards[0].rows[11];
  row.formChecks[0]={id:'GATE',status:'unassessed',evidence:'Unregistered Guide prevented required-sections gate coverage.'};
  const rejected=spawnSync(process.execPath,[url.pathname],{input:JSON.stringify(r),encoding:'utf8'});
  assert.equal(rejected.status,1);assert.equal(rejected.stdout,'');assert.match(rejected.stderr,/C12.*aggregate.*unassessed/);
  row.status='unassessed';delete row.failureScenario;
  const accepted=spawnSync(process.execPath,[url.pathname],{input:JSON.stringify(r),encoding:'utf8'});
  assert.equal(accepted.status,0,accepted.stderr);assert.equal(accepted.stdout,renderReport(r));assert.match(accepted.stdout,/JUDGE: FAIL.*Failure-scenario:/);
  assert.notEqual(accepted.stdout+'Validator exited 0.\n',renderReport(r),'appending a validator receipt is not an exact returned report');
});
test('completed PASS parts, applicable unavailable parts, and unsupported kind preserve C12 boundaries', () => {
  const r=report(), row=r.cards[0].rows[11];row.status='PASS';delete row.failureScenario;
  row.formChecks=row.formChecks.map(part=>({...part,status:'PASS',failureScenario:undefined}));assert.deepEqual(validateReport(r),[]);
  row.formChecks[0].status='unassessed';assert.match(validateReport(r).join('\n'),/C12.*aggregate.*unassessed/);
  row.status='unassessed';assert.deepEqual(validateReport(r),[]);
  r.cards[0].kind='Guide';assert.match(validateReport(r).join('\n'),/C12.*unsupported supplied kind/);
});

test('C12 missing coverage alone cannot yield GO when all other criteria are complete', () => {
  const r=report();r.overall='GO';r.cards[0].rows[10]={id:'C11',status:'PASS',evidence:'docs/site/guides/adverse.md:1 — separate supplied twin fixture receipt'};
  r.cards[0].c11Receipt={command:'node supplied-twin-fixture.mjs',cwd:r.root,exit:0,stderr:''};
  const row=r.cards[0].rows[11];row.status='PASS';delete row.failureScenario;delete row.formChecks;
  const errors=validateReport(r);assert.ok(errors.some(error=>/C12.*formChecks/.test(error)));assert.ok(errors.some(error=>/unassessed.*STOP/.test(error)));assert.ok(!errors.some(error=>error.includes('C11')));
});
