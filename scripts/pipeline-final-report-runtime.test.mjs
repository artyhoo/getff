import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, symlinkSync, rmSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { acceptanceSourceClaims, collectCachedSourceEvidence, buildOverview } from '../.agents/procedures/pipeline/helpers/overview.mjs';
import { validateSourceReconciliation, validateEvidenceContext, validateFinalReport, validateTerminal, readReconciliationSource } from '../.agents/procedures/pipeline/helpers/check-final-report.mjs';
const helper = resolve('.agents/procedures/pipeline/helpers/check-final-report.mjs');
const valid = readFileSync('tests/skills/pipeline-final-report/valid-overview.md', 'utf8');
const context = { mode: 'overview0', invocation: '$pipeline', host: 'codex', date: '2026-10-10', coverage: 'complete', expectedIds: ['paired-csv-export','paired-import-check'], readOnly: true };
const run = (raw, ctx = context, entry = helper, lang = 'en', evidence) => spawnSync(process.execPath, [entry, '--context', JSON.stringify(ctx), ...(evidence ? ['--evidence',evidence] : [])], { input: raw, encoding: 'utf8', env: {...process.env, AIF_HOOK_LANG: lang} });
test('retained native final is rejected for its actual missing fields', () => {
  const result = run(readFileSync('tests/skills/pipeline-final-report/retained-r3.md','utf8'));
  assert.equal(result.status, 1, result.stderr);
  for (const field of ['dated header', 'queue columns', 'count', 'overview-only stage', 'closing separator']) assert.ok(result.stderr.includes(field), result.stderr);
});
test('valid exact artifact is returned unchanged; informational recap is optional', () => {
  const result = run(valid); assert.equal(result.status,0,result.stderr); assert.equal(result.stdout,valid);
});
const mutations = [
 ['fenced report', text => '```text\n'+text+'\n```', 'dated header'],
 ['missing waiting', text => text.replace('Confirmed owner, isolation and launch permission unavailable. First permitted action: read and reconcile the existing contract/plan.', ''), 'nonempty'],
 ['duplicate ID', text => text.replaceAll('paired-import-check','paired-csv-export'), 'duplicate'],
 ['forged count', text => text.replace('Total open umbrellas: 2','Total open umbrellas: 3'), 'count'],
 ['wrong skeleton', text => text.replace('PROJECT OVERVIEW','EXECUTION PLAN'), 'dated header'],
 ['missing footer', text => text.trimEnd().replace(/═+$/, ''), 'closing separator'],
 ['wrong host', text => text.replaceAll('$pipeline','/pipeline'), 'native invocation'],
 ['missing next action', text => text.replaceAll(/First permitted action:.*?plan\./g,'').replaceAll(/Read existing kickoff.*?approval\./g,'').replaceAll(/Permitted next action:.*?scope\./g,''), 'permitted next action'],
 ['dispatch in read-only paste', text => text.replace('Unavailable: read-only scope prohibits new chats/dispatch. Native named invocation, if separately authorized: `$pipeline paired-csv-export`.', '`aif dispatch paired-csv-export`'), 'read-only paste'],
];
for (const [name, change, error] of mutations) test(name, () => { const result=run(change(valid)); assert.equal(result.status,1,result.stderr); assert.ok(result.stderr.includes(error),result.stderr); });
test('unavailable invocation context is exit 2', () => {
  for (const ctx of [{}, {...context, mode:'named'}, {...context,date:'2026-99-90'}, {...context,expectedIds:undefined}]) { const result=run(valid,ctx); assert.equal(result.status,2,result.stderr); }
});
test('partial coverage requires observed count, UNKNOWN completeness and STOP', () => {
  const ctx={...context,coverage:'partial',expectedIds:undefined};
  assert.equal(run(valid,ctx).status,1);
  const partial=valid.replace(/Total open umbrellas: 2[^\n]*/, 'Observed open umbrellas: 2 (completeness UNKNOWN; STOP).');
  const result=run(partial,ctx); assert.equal(result.status,0,result.stderr);
});
test('actual selected language pack and fallback govern columns', () => {
  assert.equal(run(valid,context,helper,'ru').status,1);
  const ru=valid.replace('Paste into a new Codex chat','Paste в новый Codex chat').replace('| When | Waiting on | Can parallel with |','| Когда | Ждёшь | Можно параллельно с |');
  assert.equal(run(ru,context,helper,'ru').status,0);
  assert.equal(run(valid,context,helper,'missing-fixture-pack').status,0);
});
test('Claude vocabulary, escaped pipe, independent empty population and explicit symlink work', () => {
  const cc=valid.replaceAll('$pipeline','/pipeline').replace('Paste into a new Codex chat','Paste into a new CC tab').replace('Confirmed owner, isolation', 'Confirmed owner \\| unavailable, isolation');
  assert.equal(run(cc,{...context,host:'claude',invocation:'/pipeline 0'}).status,0);
  const empty=valid.split('\n').filter(line=>!/^\| [12] —/.test(line)).join('\n').replace('Total open umbrellas: 2','Total open umbrellas: 0')
    .replace(/## Dependency graph[\s\S]*?## Action queue/, '## Dependency graph\n\nNo open work items; no dependency edges are asserted.\n\n## Action queue')
    .replace(/Priority rationale:[\s\S]*?## In-flight/, '## In-flight');
  assert.equal(run(empty,{...context,expectedIds:[]}).status,0);
  const dir=mkdtempSync(join(tmpdir(),'pipeline final alias with spaces '));
  try { const alias=join(dir,'owned helper link.mjs'); symlinkSync(helper,alias); const result=run(valid,context,alias); assert.equal(result.status,0,result.stderr); assert.equal(result.stdout,valid); } finally {rmSync(dir,{recursive:true,force:true});}
});

test('explicit current invocation context is required', () => {
  for (const ctx of [{...context,invocation:undefined}, {...context,invocation:'heartbeat'}, {...context,invocation:'$pipeline named'}, {...context,invocation:'/pipeline'}]) {
    const result=run(valid,ctx); assert.equal(result.status,2,result.stderr);
  }
});
test('ambiguous duplicate count is rejected rather than taking the first claim', () => {
  const result=run(valid.replace('### Stage — overview only','Total open umbrellas: 99 (forged second claim).\n\n### Stage — overview only'));
  assert.equal(result.status,1,result.stderr);
});
test('Russian read-only cells and concrete next action do not require English service phrases', () => {
  const ru=valid.replace('Paste into a new Codex chat','Paste в новый Codex chat').replace('| When | Waiting on | Can parallel with |','| Когда | Ждёшь | Можно параллельно с |')
    .replaceAll('Unavailable:', 'Недоступно:').replaceAll('First permitted action:', 'Первое разрешённое действие:')
    .replaceAll('Permitted next action:', 'Разрешённое следующее действие:').replaceAll('Read existing kickoff', 'Прочитать существующий kickoff');
  const result=run(ru,context,helper,'ru'); assert.equal(result.status,0,result.stderr); assert.equal(result.stdout,ru);
});

test('an anchored UNKNOWN token alone is not a concrete next action', () => {
  const strip=mutations.find(([name])=>name==='missing next action')[1];
  const result=run(strip(valid).replace('### Stage — overview only','Permitted next action: UNKNOWN.\n\n### Stage — overview only'));
  assert.equal(result.status,1,result.stderr); assert.ok(result.stderr.includes('permitted next action'),result.stderr);
});

test('ordinary overview retains permitted future drill-down rather than inventing a launch gate', () => {
  const cards=valid.replaceAll('Unavailable: read-only scope prohibits new chats/dispatch. Native named invocation, if separately authorized:', 'Future named drill-down, under the existing channel policy:');
  const result=run(cards,{...context,readOnly:false}); assert.equal(result.status,0,result.stderr); assert.equal(result.stdout,cards);
});
test('malformed UTF-8 actual input is rejected instead of rewriting returned bytes', () => {
  const result=run(Buffer.concat([Buffer.from(valid.slice(0,valid.indexOf('Ownership'))),Buffer.from([0xff]),Buffer.from(valid.slice(valid.indexOf('Ownership')))]));
  assert.equal(result.status,1,result.stderr); assert.ok(result.stderr.includes('UTF-8'),result.stderr);
});

test('HTML comment concealment cannot make invisible report anchors satisfy closure', () => {
  const hidden=valid.replace('PROJECT OVERVIEW', '<!--\nPROJECT OVERVIEW').replace(/(═+)\s*$/, '-->\n$1');
  const result=run(hidden); assert.equal(result.status,1,result.stderr); assert.ok(result.stderr.includes('HTML'),result.stderr);
});
test('a graph fallback replaced with a standalone HTML comment is rejected', () => {
  const hidden=valid.replace(/## Dependency graph[\s\S]*?## Action queue/, '## Dependency graph\n\n<!-- invisible fallback -->\n\n## Action queue');
  const result=run(hidden); assert.equal(result.status,1,result.stderr); assert.ok(result.stderr.includes('HTML'),result.stderr);
});

test('work rows after a paragraph are not counted as the rendered queue table', () => {
  const hidden=valid.replace('| 1 — paired-csv-export', '\nThis paragraph ends the queue table.\n\n| 1 — paired-csv-export');
  const result=run(hidden); assert.equal(result.status,1,result.stderr);
});
test('indented duplicate count is still a visible contradiction', () => {
  const hidden=valid.replace('### Stage — overview only',' Total open umbrellas: 99 (contradiction).\n\n### Stage — overview only');
  const result=run(hidden); assert.equal(result.status,1,result.stderr);
});

test('unsupported raw HTML blocks are rejected while fenced literal examples retain exact bytes', () => {
  const hidden=valid.replace('PROJECT OVERVIEW', '<div hidden>\nPROJECT OVERVIEW').replace(/(═+)\s*$/, '</div>\n$1');
  const rejected=run(hidden); assert.equal(rejected.status,1,rejected.stderr); assert.ok(rejected.stderr.includes('HTML'),rejected.stderr);
  const literal=valid.replace('### Stage — overview only','```text\n<!-- example only -->\n<div hidden>literal code</div>\n```\n\n### Stage — overview only');
  const accepted=run(literal); assert.equal(accepted.status,0,accepted.stderr); assert.equal(accepted.stdout,literal);
});
test('a four-space code block cannot stand in for the rendered queue table', () => {
  const hidden=valid.split('\n').map(line=>line.startsWith('|') ? '    '+line : line).join('\n');
  const result=run(hidden); assert.equal(result.status,1,result.stderr); assert.ok(result.stderr.includes('queue columns'),result.stderr);
});

test('visible angled absolute source links with spaces and URL autolinks retain exact bytes', () => {
  const linked=valid.replace('Confirmed owner, isolation', 'Confirmed owner ([source](</tmp/source reference.md:1>), <https://example.test/path>), isolation');
  const result=run(linked); assert.equal(result.status,0,result.stderr); assert.equal(result.stdout,linked);
});

test('visible single-line inline code for existing bridge vocabulary retains exact bytes', () => {
  for (const span of ['`<!-- bridge: auto -->`', '``<!-- bridge: auto --> `literal` ``']) {
    const literal=valid.replace('Ownership UNKNOWN;', `Ownership UNKNOWN; visible policy example ${span};`);
    const result=run(literal); assert.equal(result.status,0,result.stderr); assert.equal(result.stdout,literal);
  }
});
test('unmatched or escaped code delimiters cannot conceal real HTML comments', () => {
  for (const span of ['`<!-- concealment -->', "\\`<!-- concealment -->\\`"]) {
    const literal=valid.replace('Ownership UNKNOWN;', `Ownership UNKNOWN; ${span};`);
    const result=run(literal); assert.equal(result.status,1,result.stderr); assert.ok(result.stderr.includes('HTML'),result.stderr);
  }
});

test('partial zero count cannot hide detached visible identity-bearing queue rows', () => {
  const partial=valid.replace('| 1 — paired-csv-export', '\nThis paragraph ends the queue table.\n\n| 1 — paired-csv-export')
    .replace(/Total open umbrellas: 2[^\n]*/, 'Observed open umbrellas: 0 (completeness UNKNOWN; STOP).');
  const result=run(partial,{...context,coverage:'partial',expectedIds:undefined});
  assert.equal(result.status,1,result.stderr); assert.ok(result.stderr.includes('detached'),result.stderr);
});

for (const destination of ['file with spaces.md','/tmp root/file.md']) test(`visible angled Markdown destination retains spaces: ${destination}`, () => {
  const linked=valid.replace('Ownership UNKNOWN;', `Ownership UNKNOWN; [source](<${destination}>);`);
  const result=run(linked); assert.equal(result.status,0,result.stderr); assert.equal(result.stdout,linked);
});
test('outside-link HTML and escaped non-link text cannot borrow Markdown destination masking', () => {
  for (const fragment of ['[source](<file with spaces.md>) <!-- hidden -->','[<span hidden>source</span>](<file with spaces.md>)','\\[source](<file with spaces.md>)']) {
    const linked=valid.replace('Ownership UNKNOWN;', `Ownership UNKNOWN; ${fragment};`);
    const result=run(linked); assert.equal(result.status,1,result.stderr); assert.ok(result.stderr.includes('HTML'),result.stderr);
  }
});

for (const indexes of [[0],[2],[0,2]]) test(`binding opening skeleton rejects missing separator lines ${indexes.join(',')}`, () => {
  const missing=valid.split('\n').filter((line,index)=>!indexes.includes(index)).join('\n');
  const result=run(missing); assert.equal(result.status,1,result.stderr); assert.ok(result.stderr.includes('opening separators'),result.stderr);
});

// A local observed inventory is not a globally reconciled open-work population.
const observedContext = {...context, workflow:'observed-synthesis-v1', coverage:'partial', expectedIds:undefined,
  observedIds:['paired-csv-export','paired-import-check','existing-owner']};
const synthesis = `## Observed work synthesis

| Work identity | Outcome | Four-axis rationale | Next source gate | Ownership / readiness | Source |
|---|---|---|---|---|---|
| paired-csv-export | Export selected rows | B: unblocks import; V: consumer CSV; S: UNKNOWN; P: UNKNOWN | Read schema acceptance before implementation | UNVERIFIED; STOP | kickoff/export.md:12 |
| paired-import-check | Reject invalid import | B: depends on export; V: consumer validation; S: UNKNOWN; P: UNKNOWN | Export schema merge remains UNKNOWN | UNVERIFIED; STOP | kickoff/import.md:9 |
| existing-owner | Preserve ongoing schema work | B: schema prerequisite; V: shared contract; S: UNKNOWN; P: UNKNOWN | Reconcile saved branch with actual owner | OWNERSHIP-CHECK; STOP | saved branch evidence |

## Review lifecycle

| Gate | Policy | Observed status | Source |
|---|---|---|---|
| implementation | Authorized implementer owns isolated changes | Unassigned | kickoff |
| task-review | Installed companion owns spec/quality acceptance and correction loops | UNKNOWN | installed companion |
| final-branch-review | Required whole-branch review after tasks | Not observed | installed companion |
| local-checks | Actual scoped checks on current changes | UNKNOWN | check contract |
| current-head-ci | Verify current-head result | UNKNOWN | check contract |
| authorized-merge | Separate authorization plus observed merge | Not authorized or observed | merge policy |
| claim-policy | Claim if reachable; RED/STOP cancels, GO releases, fixes re-enter fresh policy | Bridge UNKNOWN; unguarded if unavailable | claim machinery |
| stage-admission | After all required PR merges; correction repeats admission | Not reached | dispatch contract |

`;
const witnessed = valid.replace(/Total open umbrellas: 2[^\n]*/, 'Observed open umbrellas: 2 (completeness UNKNOWN; STOP).')
  .replace('### Stage — overview only', synthesis+'### Stage — overview only');
test('observed witness covers nonqueued ownership separately without certifying completeness', () => {
  const result=run(witnessed,observedContext); assert.equal(result.status,0,result.stderr); assert.equal(result.stdout,witnessed);
});
for (const [name,change,error] of [
  ['raw shortlist omits observed work',text=>text.replace(/^\| existing-owner.*\n/m,''),'observed inventory'],
  ['generic ranking omits axes',text=>text.replace('B: unblocks import; V: consumer CSV; S: UNKNOWN; P: UNKNOWN','Unranked; read plan'),'four-axis'],
  ['missing explanatory lifecycle',text=>text.replace(/## Review lifecycle[\s\S]*?(?=### Stage)/,''),'lifecycle'],
  ['missing current-head gate',text=>text.replace(/^\| current-head-ci.*\n/m,''),'lifecycle'],
  ['duplicate observed identity',text=>text.replace('| existing-owner |','| paired-csv-export |'),'observed inventory'],
]) test(name,()=>{const result=run(change(witnessed),observedContext);assert.equal(result.status,1,result.stderr);assert.ok(result.stderr.includes(error),result.stderr);});
test('invalid observed witness cannot be borrowed from report self-count or malformed input',()=>{
  for (const observedIds of [['duplicate','duplicate'],['bad/id'],null,'paired-csv-export']) {
    const result=run(witnessed,{...observedContext,observedIds});assert.equal(result.status,2,result.stderr);
  }
});
test('observed synthesis preserves native Claude vocabulary and installed reviewer topology',()=>{
  const cc=witnessed.replaceAll('$pipeline','/pipeline').replace('Paste into a new Codex chat','Paste into a new CC tab');
  const result=run(cc,{...observedContext,host:'claude',invocation:'/pipeline'});assert.equal(result.status,0,result.stderr);
});

test('current workflow cannot silently omit the independent witness while legacy grammar remains compatible',()=>{
  const {observedIds,...missing}=observedContext;
  const rejected=run(witnessed,missing);assert.equal(rejected.status,2,rejected.stderr);assert.match(rejected.stderr,/requires independent observedIds/);
  assert.equal(run(valid,context).status,0);
});

test('modern lifecycle cannot omit the STOP branch while preserving GO and RED',()=>{
  const omitted=witnessed.replace('RED/STOP cancels','RED cancels');
  const result=run(omitted,observedContext);
  assert.equal(result.status,1,result.stderr);assert.match(result.stderr,/claim-policy.*GO.*RED.*STOP/);
});

test('source-bound workflow rejects ancestor-only citations and requires an independent source-path witness',()=>{
  const bound={...observedContext,workflow:'observed-synthesis-v2',sourceBindings:{
    'paired-csv-export':['kickoff/export.md'],
    'paired-import-check':['kickoff/import.md'],
    'existing-owner':[],
  }};
  const home=mkdtempSync(join(tmpdir(),'pipeline collector witness with spaces '));
  const evidence=join(home,'collector.json');
  writeFileSync(evidence,JSON.stringify({observedIds:observedContext.observedIds,localEvidence:{
    'paired-csv-export':[{owner:'paired-csv-export',scope:'entry',path:'kickoff/export.md'}, {owner:'paired',scope:'shared-family',path:'kickoff/parent.md'}],
    'paired-import-check':[{owner:'paired-import-check',scope:'entry',path:'kickoff/import.md'}],
    'existing-owner':[],
  }}));
  const boundRun=(raw,ctx=bound)=>run(raw,ctx,helper,'en',evidence);
  try {
  const accepted=boundRun(witnessed);assert.equal(accepted.status,0,accepted.stderr);
  const linked=boundRun(witnessed.replace('kickoff/export.md:12','[entry source](kickoff/export.md:12)'));
  assert.equal(linked.status,0,linked.stderr);
  const inline=boundRun(witnessed.replace('kickoff/export.md:12','`kickoff/export.md:12`'));
  assert.equal(inline.status,0,inline.stderr);
  const claudeReport=witnessed.replaceAll('$pipeline','/pipeline').replace('Paste into a new Codex chat','Paste into a new CC tab');
  const claudeContext={...bound,host:'claude',invocation:'/pipeline'};
  assert.equal(boundRun(claudeReport,claudeContext).status,0);
  assert.equal(boundRun(claudeReport.replace('kickoff/export.md:12','kickoff/parent.md:12'),claudeContext).status,1);
  const wrongOwner=boundRun(witnessed.replace('kickoff/export.md:12','kickoff/parent.md:12'));
  assert.equal(wrongOwner.status,1,wrongOwner.stderr);assert.match(wrongOwner.stderr,/source binding/);
  const misleadingPrefix=boundRun(witnessed.replace('kickoff/export.md:12','kickoff/export.md-backup:12'));
  assert.equal(misleadingPrefix.status,1,misleadingPrefix.stderr);assert.match(misleadingPrefix.stderr,/source binding/);
  for (const citation of ['`kickoff/parent.md:12`','`kickoff/export.md-backup:12`','[ancestor](kickoff/parent.md:12)']) {
    const rejectedCitation=boundRun(witnessed.replace('kickoff/export.md:12',citation));
    assert.equal(rejectedCitation.status,1,rejectedCitation.stderr);assert.match(rejectedCitation.stderr,/source binding/);
  }
  const {sourceBindings,...missing}=bound;
  const rejected=boundRun(witnessed,missing);assert.equal(rejected.status,2,rejected.stderr);assert.match(rejected.stderr,/sourceBindings/);
  const foreign=boundRun(witnessed,{...bound,sourceBindings:{...bound.sourceBindings,'foreign-owner':['foreign.md']}});
  assert.equal(foreign.status,2,foreign.stderr);assert.match(foreign.stderr,/sourceBindings/);
  // A correct path does not certify the accompanying natural-language status.
  assert.equal(boundRun(witnessed.replace('Export selected rows','Historically quoted STUB; current outcome UNKNOWN')).status,0);
  const forged=boundRun(witnessed.replace('kickoff/export.md:12','kickoff/parent.md:12'),{...bound,sourceBindings:{...bound.sourceBindings,'paired-csv-export':['kickoff/parent.md']}});
  assert.equal(forged.status,2,forged.stderr);assert.match(forged.stderr,/differ from independent collector/);
  const crossed=boundRun(witnessed,{...bound,observedIds:[...bound.observedIds].reverse()});
  assert.equal(crossed.status,2,crossed.stderr);assert.match(crossed.stderr,/identities differ/);
  const downgrade=boundRun(witnessed,{...bound,workflow:'observed-synthesis-v1'});
  assert.equal(downgrade.status,2,downgrade.stderr);assert.match(downgrade.stderr,/downgrade/);
  const unavailable=run(witnessed,bound);assert.equal(unavailable.status,2,unavailable.stderr);assert.match(unavailable.stderr,/requires independent --evidence/);
  } finally {rmSync(home,{recursive:true,force:true});}
});

test('a correctly sourced historical merge cannot hide its specifically associated host acceptance from the task gate',async t=>{
  const text='# Paired report\n\n| taskId | task | PR | landed |\n|---|---|---|---|\n| t1 | csv-export | #42 | MERGED |\n| t2 | import-check | #43 | MERGED |\n\n- #42 Q7 HOST-DEFERRED: live host walk of `GUIDE.md` steps 2-8 never ran; CI proves mechanics, not preserved edits.\n';
  const body={owner:'paired',path:'paired/FINAL-REPORT.md',kind:'local-source-claim',scope:'shared-family',text,
    sha256:createHash('sha256').update(text).digest('hex')};
  const localEvidence={
    'paired-csv-export':[{owner:'paired-csv-export',scope:'entry',path:'kickoff/export.md'},body],
    'paired-import-check':[{owner:'paired-import-check',scope:'entry',path:'kickoff/import.md'}],
    'existing-owner':[],
  };
  const claims=acceptanceSourceClaims(localEvidence,observedContext.observedIds);
  assert.deepEqual(claims[0].taskIds,['paired-csv-export']);
  const bound={...observedContext,workflow:'observed-synthesis-v2',sourceBindings:{
    'paired-csv-export':['kickoff/export.md'],'paired-import-check':['kickoff/import.md'],'existing-owner':[]
  },acceptanceSourceClaims:claims};
  const home=mkdtempSync(join(tmpdir(),'pipeline acceptance debt with spaces '));
  const evidence=join(home,'collector.json');
  writeFileSync(evidence,JSON.stringify({observedIds:bound.observedIds,localEvidence}));
  try {
    const acceptedHistory=witnessed.replace('Export selected rows','Historical #42 MERGED; present resolution UNKNOWN');
    const result=run(acceptedHistory,bound,helper,'en',evidence);
    assert.equal(result.status,1,result.stderr);
    assert.match(result.stderr,/acceptance.*(?:gate|reconciliation|verification)/i);
    const claim=claims[0], quote=claim.text.replaceAll('|','\\|');
    const reconciliation=`## Acceptance-source reconciliation\n\n| Claim | Task identities | Historical source statement | Current resolution | Resolution source | Source |\n|---|---|---|---|---|---|\n| ${claim.id} | paired-csv-export | ${quote} | UNKNOWN | UNKNOWN | paired/FINAL-REPORT.md:8 |\n\n## Acceptance verification queue\n\n| Claim | Work identity | Next verification | Current resolution | Source |\n|---|---|---|---|---|\n| ${claim.id} | paired-csv-export | ${quote} | UNKNOWN | paired/FINAL-REPORT.md:8 |\n\n`;
    const honest=acceptedHistory.replace('Read schema acceptance before implementation',`${claim.id}: ${quote}; current resolution UNKNOWN`)
      .replace('## Review lifecycle',reconciliation+'## Review lifecycle');
    const pass=run(honest,bound,helper,'en',evidence);
    assert.equal(pass.status,0,pass.stderr); assert.equal(pass.stdout,honest);
    for (const cite of ['`paired/FINAL-REPORT.md:8`','[acceptance source](paired/FINAL-REPORT.md:8)']) {
      const exact=honest.replaceAll('paired/FINAL-REPORT.md:8',cite);
      const exactPass=run(exact,bound,helper,'en',evidence);
      assert.equal(exactPass.status,0,exactPass.stderr);assert.equal(exactPass.stdout,exact);
    }
    await t.test('foreign-prefixed historical and verification citations cannot borrow exact source suffixes',()=>{
      const prefixedHistory=run(honest.replaceAll('paired/FINAL-REPORT.md:8','foreign/paired/FINAL-REPORT.md:8'),bound,helper,'en',evidence);
      assert.equal(prefixedHistory.status,1,prefixedHistory.stderr);
      assert.match(prefixedHistory.stderr,/acceptance.*(?:source line|verification)/);
    });
    const appendixOnly=run(honest.replace(`${claim.id}: ${quote}; current resolution UNKNOWN`,'Read schema acceptance before implementation'),bound,helper,'en',evidence);
    assert.equal(appendixOnly.status,1,appendixOnly.stderr);assert.match(appendixOnly.stderr,/source gate.*specifically associated/);
    const sibling=run(honest.replace(`| ${claim.id} | paired-csv-export | ${quote} | UNKNOWN | paired/FINAL-REPORT.md:8 |`,
      `| ${claim.id} | paired-import-check | ${quote} | UNKNOWN | paired/FINAL-REPORT.md:8 |`),bound,helper,'en',evidence);
    assert.equal(sibling.status,1,sibling.stderr);assert.match(sibling.stderr,/verification queue/);
    const omitted=run(honest,{...bound,acceptanceSourceClaims:[]},helper,'en',evidence);
    assert.equal(omitted.status,2,omitted.stderr);assert.match(omitted.stderr,/acceptanceSourceClaims differ/);
    const proofText='#42 Q7: GUIDE.md steps 2-8 were verified on the host; actual refresh and preserved edits were observed.\n';
    const proof={owner:'paired-csv-export',path:'paired-csv-export/done.md',kind:'local-source-claim',scope:'entry',text:proofText,
      sha256:createHash('sha256').update(proofText).digest('hex')};
    const withProof={...localEvidence,'paired-csv-export':[...localEvidence['paired-csv-export'],proof]};
    const resolution={status:'resolved',taskIds:['paired-csv-export'],sourcePath:proof.path,
      sourceSha256:proof.sha256,sourceLine:1,text:proofText.trim()};
    const proofContext={...bound,sourceBindings:{...bound.sourceBindings,
      'paired-csv-export':['kickoff/export.md',proof.path]},acceptanceResolutions:{[claim.id]:resolution}};
    writeFileSync(evidence,JSON.stringify({observedIds:bound.observedIds,localEvidence:withProof}));
    const forgedTask=run(honest,{...proofContext,acceptanceResolutions:{[claim.id]:{...resolution,taskIds:['paired-import-check']}}},helper,'en',evidence);
    assert.equal(forgedTask.status,2,forgedTask.stderr);
    assert.match(forgedTask.stderr,/acceptance resolution.*task/i);
    const resolved=honest
      .replace(`${claim.id}: ${quote}; current resolution UNKNOWN`,`${claim.id}: ${proofText.trim()}; current resolution RESOLVED`)
      .replace(`| ${claim.id} | paired-csv-export | ${quote} | UNKNOWN | UNKNOWN | paired/FINAL-REPORT.md:8 |`,
        `| ${claim.id} | paired-csv-export | ${quote} | RESOLVED | ${proof.path}:1; ${proofText.trim()} | paired/FINAL-REPORT.md:8 |`)
      .replace(`| ${claim.id} | paired-csv-export | ${quote} | UNKNOWN | paired/FINAL-REPORT.md:8 |`,
        `| ${claim.id} | paired-csv-export | ${proofText.trim()} | RESOLVED | ${proof.path}:1 |`);
    const resolvedPass=run(resolved,proofContext,helper,'en',evidence);
    assert.equal(resolvedPass.status,0,resolvedPass.stderr);assert.equal(resolvedPass.stdout,resolved);
    for (const cite of ['`'+proof.path+':1`','[resolution source]('+proof.path+':1)']) {
      const exact=resolved.replaceAll(proof.path+':1',cite);
      const exactPass=run(exact,proofContext,helper,'en',evidence);
      assert.equal(exactPass.status,0,exactPass.stderr);assert.equal(exactPass.stdout,exact);
    }
    await t.test('foreign-prefixed resolution citations cannot borrow exact source suffixes',()=>{
      const prefixedResolution=run(resolved.replaceAll(proof.path+':1','foreign/'+proof.path+':1'),proofContext,helper,'en',evidence);
      assert.equal(prefixedResolution.status,1,prefixedResolution.stderr);
      assert.match(prefixedResolution.stderr,/acceptance.*(?:resolution source|verification)/);
    });
    const fakeHash=run(resolved,{...proofContext,acceptanceResolutions:{[claim.id]:{...resolution,sourceSha256:'0'.repeat(64)}}},helper,'en',evidence);
    assert.equal(fakeHash.status,2,fakeHash.stderr);assert.match(fakeHash.stderr,/source identity/);
    const historicalMerge='#42 MERGED; implementation was shipped.\n';
    const oldProof={...proof,text:historicalMerge,sha256:createHash('sha256').update(historicalMerge).digest('hex')};
    writeFileSync(evidence,JSON.stringify({observedIds:bound.observedIds,localEvidence:{...localEvidence,
      'paired-csv-export':[...localEvidence['paired-csv-export'],oldProof]}}));
    const mergeOnly=run(resolved,{...proofContext,acceptanceResolutions:{[claim.id]:{...resolution,
      text:historicalMerge.trim(),sourceSha256:oldProof.sha256}}},helper,'en',evidence);
    assert.equal(mergeOnly.status,2,mergeOnly.stderr);assert.match(mergeOnly.stderr,/verification target/);
    writeFileSync(evidence,JSON.stringify({observedIds:bound.observedIds,localEvidence}));
    const wrongLine=run(honest.replaceAll('paired/FINAL-REPORT.md:8','paired/FINAL-REPORT.md:80'),bound,helper,'en',evidence);
    assert.equal(wrongLine.status,1,wrongLine.stderr);assert.match(wrongLine.stderr,/source line/);
    const referenced={...localEvidence,
      'paired-csv-export':[localEvidence['paired-csv-export'][0],{...body,kind:'body-reference',text:null,bodyEvidenceId:'paired-import-check'}],
      'paired-import-check':[...localEvidence['paired-import-check'],body],
    };
    writeFileSync(evidence,JSON.stringify({observedIds:bound.observedIds,localEvidence:referenced}));
    const referencePass=run(honest,bound,helper,'en',evidence);
    assert.equal(referencePass.status,0,referencePass.stderr);
    referenced['paired-csv-export'][1].bodyEvidenceId='existing-owner';
    writeFileSync(evidence,JSON.stringify({observedIds:bound.observedIds,localEvidence:referenced}));
    const missingBody=run(honest,bound,helper,'en',evidence);
    assert.equal(missingBody.status,2,missingBody.stderr);assert.match(missingBody.stderr,/source reference unavailable/);
  } finally {rmSync(home,{recursive:true,force:true});}
});

test('historical v3 direct grammar API retains leading identity, preference and chain checks',()=>{
  const leading=`## Leading inspection priorities\n\n| Work identity | B | V | S | P | Chain | Next source gate |\n|---|---|---|---|---|---|---|\n| paired-csv-export | Unblocks import | Consumer CSV | UNKNOWN | UNKNOWN | Schema → export → validation | Schema acceptance; parked predecessor needs explicitly authorized order change |\n| paired-import-check | Export prerequisite | Consumer validation | UNKNOWN | UNKNOWN | Census → independent checks → triage → fix → re-audit | Census exists before documented parallel lanes; current capacity UNKNOWN |\n\n`;
  const modern=witnessed.replace('## Observed work synthesis',leading+'## Observed work synthesis')
    .replaceAll(' | UNVERIFIED; STOP |','; Authorized alternatives: UNKNOWN; Concurrency conditions: UNKNOWN | UNVERIFIED; STOP |')
    .replace(' | OWNERSHIP-CHECK; STOP |','; Authorized alternatives: UNKNOWN; Concurrency conditions: UNKNOWN | OWNERSHIP-CHECK; STOP |')
    .replace('Installed companion owns spec/quality acceptance and correction loops',
      'Cap: 5; Implementer escalation: original rounds 1-3, fresh rounds 4-5; Cap exit: ledger adjudication, load-bearing residuals stop at operator');
  const home=mkdtempSync(join(tmpdir(),'pipeline terminal closure with spaces '));
  const evidence=join(home,'collector.json'), terminal=join(home,'actual planned terminal.md');
  const bound={...observedContext,workflow:'observed-synthesis-v3',sourceBindings:{
    'paired-csv-export':['kickoff/export.md'],'paired-import-check':['kickoff/import.md'],'existing-owner':[]
  },acceptanceSourceClaims:[]};
  writeFileSync(evidence,JSON.stringify({workflow:'observed-synthesis-v3',observedIds:bound.observedIds,localEvidence:{
    'paired-csv-export':[{owner:'paired-csv-export',path:'kickoff/export.md'}],
    'paired-import-check':[{owner:'paired-import-check',path:'kickoff/import.md'}],'existing-owner':[]
  }}));
  const terminalRun=(draft=leading,report=modern,ctx=bound)=>{
    writeFileSync(terminal,draft);
    // Historical grammar fixture API only; ordinary current CLI also requires ledger/review.
    const contextErrors=validateEvidenceContext(ctx,JSON.parse(readFileSync(evidence,'utf8')));
    if(contextErrors.length)return {status:2,stderr:contextErrors.join('\n'),stdout:''};
    const resolved={...ctx,tokens:{paste:'Paste into a new Codex chat',when:'When',waiting:'Waiting on',parallel:'Can parallel with'}};
    const result=validateFinalReport(report,resolved);
    result.errors.push(...validateTerminal(draft,resolved,report));
    return {status:result.contextErrors.length?2:result.errors.length?1:0,
      stderr:[...result.contextErrors,...result.errors].join('\n'),stdout:result.contextErrors.length||result.errors.length?'':report};
  };
  try {
    const result=terminalRun();assert.equal(result.status,0,result.stderr);assert.equal(result.stdout,modern);
    const omitted=terminalRun(leading.replace(/^\| paired-csv-export.*\n/m,''));
    assert.equal(omitted.status,1,omitted.stderr);assert.match(omitted.stderr,/terminal.*leading/);
    const preference=terminalRun(leading.replace('| UNKNOWN | UNKNOWN | Schema','| UNKNOWN |  | Schema'));
    assert.equal(preference.status,1,preference.stderr);assert.match(preference.stderr,/terminal/);
    const flattened=terminalRun(leading.replace('Census → independent checks → triage → fix → re-audit','Census → publish'));
    assert.equal(flattened.status,1,flattened.stderr);assert.match(flattened.stderr,/terminal.*(?:chain|leading)/);
    const cap=terminalRun(leading,modern.replace('Cap: 5;',''));
    assert.equal(cap.status,1,cap.stderr);assert.match(cap.stderr,/task-review.*cap/);
    const conditional=terminalRun(leading,modern.replaceAll('; Authorized alternatives: UNKNOWN',''));
    assert.equal(conditional.status,1,conditional.stderr);assert.match(conditional.stderr,/authorized alternatives/);
    const hidden=terminalRun('<!--\n'+leading+'-->\n');
    assert.equal(hidden.status,1,hidden.stderr);assert.match(hidden.stderr,/terminal.*HTML/);
    const downgrade=terminalRun(leading,modern,{...bound,workflow:'observed-synthesis-v2'});
    assert.equal(downgrade.status,2,downgrade.stderr);assert.match(downgrade.stderr,/downgrade/);
  } finally {rmSync(home,{recursive:true,force:true});}
});

// Exact source/output binding regression cases; these do not certify semantics.
{
const hash = text => createHash('sha256').update(text).digest('hex');
function fixture() {
  const text = '# Stage history\nRecorded stage never ran after promotion.\nMaintainer GO is still owed.\nIf L4 parks, an operator swap permits L5; concurrency remains prohibited.\nLater matching PR merged; earlier launch gate superseded.';
  const path = '/project with spaces/task/state.md';
  const source = {path, owner:'task',text,sha256:hash(text)};
  const support = [{path, sha256:source.sha256,startLine:2,endLine:5,text:text.split('\n').slice(1).join('\n')}];
  const row = {id:'task',readPaths:[path]};
  for (const [field,statement] of Object.entries({outcome:'Stage never ran',gate:'Maintainer GO owed',alternatives:'Operator swap when L4 parks',concurrency:'No concurrent shared writes',chronology:'Earlier pending superseded by matching merge'})) row[field]={statement,support:structuredClone(support)};
  const ledger={version:1,sourceReads:[{...source,status:'read'}],rows:[row]};
  const evidence={observedIds:['task'],localEvidence:{task:[source]}};
  const report='## Observed work synthesis\n| Work identity | Outcome | Four-axis rationale | Next source gate | Ownership / readiness | Source |\n|---|---|---|---|---|---|\n| task | Stage never ran | B: UNKNOWN; V: UNKNOWN; S: UNKNOWN; P: UNKNOWN | Maintainer GO owed; Operator swap when L4 parks; No concurrent shared writes; Earlier pending superseded by matching merge | UNKNOWN | '+path+':2 |\n\n## Source fidelity review\n| Status | Capability | Reviewer | Scope | Remaining findings |\n|---|---|---|---|---|\n| GO | available read-only reviewer | reviewer-1 | all observed identities | None |\n';
  const review={status:'GO',capability:'available read-only reviewer',reviewer:'reviewer-1',implementer:'implementer-1',nativeEvidence:'native trace item 42',findings:[],repairPasses:0,observedIds:['task']};
  return {ledger,evidence,report,review};
}
function check(f) { f.review.reportSHA256=hash(f.report);f.review.ledgerSHA256=hash(JSON.stringify(f.ledger));return validateSourceReconciliation(f.ledger,f.evidence,f.report,f.review); }
test('substantive exact-source statements bind to actual output',()=>assert.deepEqual(check(fixture()),[]));
for (const [name,mutate,pattern] of [
 ['missing identity',f=>f.ledger.rows=[],/observed identities/],
 ['wrong body SHA',f=>f.ledger.sourceReads[0].sha256='0'.repeat(64),/SHA-256/],
 ['changed captured body',f=>{f.ledger.sourceReads[0].text+=' invented';f.ledger.sourceReads[0].sha256=hash(f.ledger.sourceReads[0].text);},/independently captured/],
 ['foreign source',f=>f.ledger.sourceReads[0].path='/foreign/state.md',/foreign/],
 ['omitted full read',f=>f.ledger.rows[0].readPaths=[],/every collected/],
 ['heading echo',f=>{f.ledger.rows[0].outcome.support[0].startLine=1;f.ledger.rows[0].outcome.support[0].endLine=1;f.ledger.rows[0].outcome.support[0].text='# Stage history';},/heading-only/],
 ['wrong excerpt lines',f=>f.ledger.rows[0].gate.support[0].endLine=4,/excerpt identity/],
 ['generic fallback loses known gate',f=>f.report=f.report.replace('Maintainer GO owed','Read task source later'),/gate statement/],
 ['unknown replaces known alternative',f=>f.report=f.report.replace('Operator swap when L4 parks','UNKNOWN'),/alternatives statement/],
 ['stale chronology',f=>f.report=f.report.replace('Earlier pending superseded by matching merge','Awaiting old launch GO'),/chronology statement/],
 ['same implementer self-tag',f=>f.review.reviewer=f.review.implementer,/distinct actual reviewer/],
 ['review cap exceeded',f=>f.review.repairPasses=3,/finite repair count/],
 ['remaining major finding',f=>f.review.findings=[{severity:'MAJOR'}],/unresolved MAJOR/],
]) test(name,()=>{const f=fixture();mutate(f);assert.match(check(f).join('\n'),pattern);});
test('forged unavailable source diagnostic is rejected',()=>{const f=fixture();f.ledger.sourceReads[0]={path:f.ledger.sourceReads[0].path,status:'unavailable',diagnostic:'invented missing source'};assert.match(check(f).join('\n'),/actual captured diagnostic/);});
test('actual unavailable review remains visible and does not become GO',()=>{const f=fixture();f.review.status='UNAVAILABLE';f.review.capability='unavailable';f.review.reviewer='unavailable';f.review.diagnostic='Native independent review tool unavailable';f.report=f.report.replace('| GO | available read-only reviewer | reviewer-1 |','| UNAVAILABLE | unavailable | unavailable |').replace('| all observed identities | None |','| all observed identities | Native independent review tool unavailable |')+'\nNative independent review tool unavailable\n';assert.deepEqual(check(f),[]);});

test('GO retains actual MINOR findings and rejects a debt-free display',()=>{
  const f=fixture();f.review.findings=[{severity:'MINOR',workIdentity:'task',text:'Source navigation could be clearer'}];
  assert.match(check(f).join('\n'),/remaining findings table cell/);
  f.report=f.report.replace('| all observed identities | None |','| all observed identities | MINOR: task: Source navigation could be clearer |');
  assert.deepEqual(check(f),[]);
  f.review.findings[0].workIdentity='foreign-task';assert.match(check(f).join('\n'),/review findings require/);
});

test('review table cannot say None while an unavailable diagnostic exists',()=>{const f=fixture();f.review.status='UNAVAILABLE';f.review.capability='unavailable';f.review.reviewer='unavailable';f.review.diagnostic='Native review unavailable';f.report=f.report.replace('| GO | available read-only reviewer | reviewer-1 |','| UNAVAILABLE | unavailable | unavailable |')+'\nNative review unavailable\n';assert.match(check(f).join('\n'),/remaining findings table cell/);});

}


test('current source-bound CLI rejects omission of both reconciliation markers',()=>{
  const dir=mkdtempSync(join(tmpdir(),'pipeline no silent downgrade '));
  try {
    const evidence=join(dir,'collector.json'),terminal=join(dir,'terminal.md');
    writeFileSync(evidence,JSON.stringify({workflow:'observed-synthesis-v3',observedIds:[],localEvidence:{}}));
    writeFileSync(terminal,'');
    const ctx={...context,workflow:'observed-synthesis-v3',observedIds:[],sourceBindings:{},acceptanceSourceClaims:[]};
    const result=spawnSync(process.execPath,[helper,'--context',JSON.stringify(ctx),'--evidence',evidence,'--terminal',terminal],{input:valid,encoding:'utf8'});
    assert.equal(result.status,2,result.stderr);assert.match(result.stderr,/current source-bound CLI requires/);
  } finally {rmSync(dir,{recursive:true,force:true});}
});

test('cached historical acceptance resolution uses its captured source while preserving exact claim guards',()=>{
  const dir=mkdtempSync(join(tmpdir(),'pipeline cached acceptance with spaces '));
  const git=(...args)=>{const r=spawnSync('git',args,{cwd:dir,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
  try {
    git('init','-q');
    const id='cached-task',path='.claude/orchestrator-prompts/'+id+'/kickoff.md';
    const text='# Historical acceptance\n#123 A3 HOST-DEFERRED: native verification of `target.mjs` was not run.\n#123 A3 target.mjs: the later historical host walk verified preserved customization.\n';
    mkdirSync(resolve(join(dir,path),'..'),{recursive:true});writeFileSync(join(dir,path),text);
    git('add','.');git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','cached acceptance');
    const oid=git('rev-parse','HEAD');rmSync(join(dir,'.claude'),{recursive:true});
    const cached=collectCachedSourceEvidence(dir,[id],oid,[]),source=cached[id][0];
    assert.equal(source.text,text);assert.equal(source.origin.blobOid,git('rev-parse',oid+':'+path));
    const overview=buildOverview({candidateOutput:'=== priority-score: candidate umbrellas ===\n'+id+' kickoff=missing\n=== priority-score.sh: END rc=0 (lines=1) ===',localEvidence:{[id]:[]},cachedEvidence:cached});
    const claim=overview.acceptanceSourceClaims[0];assert.deepEqual(claim.taskIds,[id]);
    const resolution={status:'superseded',taskIds:[id],sourcePath:source.path,sourceSha256:source.sha256,sourceLine:3,text:text.split('\n')[2]};
    const ctx={...overview,workflow:'observed-synthesis-v3',acceptanceResolutions:{[claim.id]:resolution}};
    const evidence={...overview,workflow:'observed-synthesis-v3',localEvidence:{[id]:[]},cachedEvidence:cached};
    assert.deepEqual(validateEvidenceContext(ctx,evidence),[]);
    for(const mutation of [{sourceSha256:'0'.repeat(64)},{sourceLine:2},{taskIds:['another-task']},{text:'#124 A3 target.mjs: unrelated historical proof'}]) {
      assert.notDeepEqual(validateEvidenceContext({...ctx,acceptanceResolutions:{[claim.id]:{...resolution,...mutation}}},evidence),[]);
    }
    const foreign={...source,owner:'another-task'};
    assert.notDeepEqual(validateEvidenceContext(ctx,{...evidence,cachedEvidence:{[id]:[foreign]}}),[]);
  } finally {rmSync(dir,{recursive:true,force:true});}
});

test('actual cached-stage object is retained under its observed owner with immutable Git identity',()=>{
  const dir=mkdtempSync(join(tmpdir(),'pipeline cached source with spaces '));
  const git=(...args)=>{const r=spawnSync('git',args,{cwd:dir,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
  try {
    git('init','-q');
    const path='.claude/orchestrator-prompts/docs-resolver-native-api-meta-launch/kickoff-s1.md';
    const file=join(dir,path);
    // Direct fixture directories are owned by this test, not the project checkout.
    mkdirSync(resolve(file,'..'),{recursive:true});
    const text='# Cached stage\nPrerequisite: actual parent merge, still unverified.\n';writeFileSync(file,text);
    git('add',path);git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','fixture');
    const oid=git('rev-parse','HEAD');rmSync(join(dir,'.claude'),{recursive:true});
    const diagnostics=[];const evidence=collectCachedSourceEvidence(dir,['docs-resolver-native-api-meta-launch'],oid,diagnostics);
    const source=evidence['docs-resolver-native-api-meta-launch'][0];
    assert.equal(source.text,text);assert.equal(source.owner,'docs-resolver-native-api-meta-launch');
    assert.equal(source.path,'git:'+oid+':'+path);assert.equal(source.origin.commitOid,oid);
    assert.equal(source.origin.repoPath,path);assert.equal(source.sha256,createHash('sha256').update(text).digest('hex'));
    assert.equal(source.origin.blobOid,git('rev-parse',oid+':'+path));assert.deepEqual(diagnostics,[]);
    const small=collectCachedSourceEvidence(dir,['docs-resolver-native-api-meta-launch'],oid,[],{maxBodyBytes:10});
    assert.equal(small['docs-resolver-native-api-meta-launch'][0].kind,'git-source-unavailable');
    assert.match(small['docs-resolver-native-api-meta-launch'][0].error,/budget/);
    const id='docs-resolver-native-api-meta-launch';
    const captured=buildOverview({candidateOutput:'=== priority-score: candidate umbrellas ===\n'+id+' kickoff=missing\n=== priority-score.sh: END rc=0 (lines=1) ===',localEvidence:{[id]:[]},cachedEvidence:evidence});
    assert.deepEqual(captured.sourceBindings[id],[]);
    assert.deepEqual(captured.cachedSourceBindings[id],[source.path]);
    const statement='Prerequisite: actual parent merge, still unverified.';
    const support=[{path:source.path,sha256:source.sha256,startLine:2,endLine:2,text:statement}];
    const entry={id,readPaths:[source.path]};
    for(const field of ['outcome','gate','alternatives','concurrency','chronology'])entry[field]={statement,support};
    const ledger={version:1,sourceReads:[{...source,status:'read'}],rows:[entry]};
    const leading='## Leading inspection priorities\n| Work identity | B | V | S | P | Chain | Next source gate |\n|---|---|---|---|---|---|---|\n| '+id+' | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | Fixture parent to stage; merge UNKNOWN | '+statement+' |\n';
    let extra=leading+'\n## Observed work synthesis\n| Work identity | Outcome | Four-axis rationale | Next source gate | Ownership / readiness | Source |\n|---|---|---|---|---|---|\n| '+id+' | '+statement+' | B: UNKNOWN; V: UNKNOWN; S: UNKNOWN; P: UNKNOWN | '+statement+'; Authorized alternatives: UNKNOWN; Concurrency conditions: UNKNOWN | UNKNOWN | '+source.path+':2 |\n\n## Review lifecycle\n| Gate | Policy | Observed status | Source |\n|---|---|---|---|\n';
    for(const gate of ['implementation','task-review','final-branch-review','local-checks','current-head-ci','authorized-merge','claim-policy','stage-admission'])extra+='| '+gate+' | '+(gate==='task-review'?'Cap: 2; Implementer escalation: repair findings; Cap exit: REVISE':gate==='claim-policy'?'GO releases; RED cancels; STOP holds':'Required existing gate')+' | UNKNOWN | Fixture contract |\n';
    const diagnostic='Fixture has no native review invocation';
    extra+='\n## Source fidelity review\n| Status | Capability | Reviewer | Scope | Remaining findings |\n|---|---|---|---|---|\n| UNAVAILABLE | unavailable | unavailable | all observed identities | '+diagnostic+' |\n\n';
    const report=valid.split('\n').filter(line=>!/^\| 2 —/.test(line)).join('\n').replaceAll('paired-csv-export',id).replace('Total open umbrellas: 2','Total open umbrellas: 1').replace('### Stage — overview only',extra+'### Stage — overview only');
    const ctx={...context,workflow:'observed-synthesis-v3',sourceReconciliationVersion:1,expectedIds:[id],observedIds:[id],sourceBindings:captured.sourceBindings,cachedSourceBindings:captured.cachedSourceBindings,acceptanceSourceClaims:captured.acceptanceSourceClaims};
    const hash=value=>createHash('sha256').update(value).digest('hex');
    const ledgerBytes=JSON.stringify(ledger),review={status:'UNAVAILABLE',capability:'unavailable',reviewer:'unavailable',diagnostic,repairPasses:0,observedIds:[id],reportSHA256:hash(report),ledgerSHA256:hash(ledgerBytes)};
    for(const [name,body] of [['collector.json',JSON.stringify(captured)],['ledger.json',ledgerBytes],['review.json',JSON.stringify(review)],['terminal.md',leading]])writeFileSync(join(dir,name),body);
    const actual=spawnSync(process.execPath,[helper,'--context',JSON.stringify(ctx),'--evidence',join(dir,'collector.json'),'--terminal',join(dir,'terminal.md'),'--reconciliation',join(dir,'ledger.json'),'--review',join(dir,'review.json')],{input:report,encoding:'utf8',env:{...process.env,AIF_HOOK_LANG:'en'}});
    assert.equal(actual.status,0,actual.stderr);assert.equal(actual.stdout,report);
    // The result is a source-binding fixture with UNAVAILABLE review, not native acceptance.

    // Exercise actual Git inventory with no captured bytes across the public CLI.
    const exhausted=collectCachedSourceEvidence(dir,[id],oid,[],{maxTotalBytes:0});
    assert.equal(exhausted[id][0].text,null);assert.match(exhausted[id][0].error,/budget/);
    const budgetCaptured=buildOverview({candidateOutput:'=== priority-score: candidate umbrellas ===\n'+id+' kickoff=missing\n=== priority-score.sh: END rc=0 (lines=1) ===',localEvidence:{[id]:[]},cachedEvidence:exhausted});
    const budgetContext={...ctx,acceptanceSourceClaims:budgetCaptured.acceptanceSourceClaims};
    const invokeBudget=(nextLedger,nextReport,nextTerminal)=>{
      const bytes=JSON.stringify(nextLedger),receipt={...review,reportSHA256:hash(nextReport),ledgerSHA256:hash(bytes)};
      for(const [name,body] of [['collector.json',JSON.stringify(budgetCaptured)],['ledger.json',bytes],['review.json',JSON.stringify(receipt)],['terminal.md',nextTerminal]])writeFileSync(join(dir,name),body);
      return spawnSync(process.execPath,[helper,'--context',JSON.stringify(budgetContext),'--evidence',join(dir,'collector.json'),'--terminal',join(dir,'terminal.md'),'--reconciliation',join(dir,'ledger.json'),'--review',join(dir,'review.json')],{input:nextReport,encoding:'utf8',env:{...process.env,AIF_HOOK_LANG:'en'}});
    };
    // The known real full body remains bound by its actual Git blob identity.
    const verifiedBody=invokeBudget(ledger,report,leading);assert.equal(verifiedBody.status,0,verifiedBody.stderr);assert.equal(verifiedBody.stdout,report);
    const invented='Invented gate all work accepted and ready.';
    const forged=structuredClone(ledger);forged.sourceReads[0].text='# Invented source\n'+invented+'\n';forged.sourceReads[0].sha256=hash(forged.sourceReads[0].text);
    for(const field of ['outcome','gate','alternatives','concurrency','chronology'])forged.rows[0][field]={statement:invented,support:[{path:source.path,sha256:forged.sourceReads[0].sha256,startLine:2,endLine:2,text:invented}]};
    const rejected=invokeBudget(forged,report.replaceAll(statement,invented),leading.replaceAll(statement,invented));
    assert.equal(rejected.status,1,rejected.stderr);assert.match(rejected.stderr,/cached read body differs from independently recorded Git blob/);assert.equal(rejected.stdout,'');
    const unavailable='Cached read unavailable: '+exhausted[id][0].error;
    const unavailableLedger={version:1,sourceReads:[{path:source.path,status:'unavailable',diagnostic:exhausted[id][0].error}],rows:[{id,readPaths:[source.path]}]};
    for(const field of ['outcome','gate','alternatives','concurrency','chronology'])unavailableLedger.rows[0][field]={statement:unavailable,support:[],status:'unavailable',reason:unavailable};
    const useful=invokeBudget(unavailableLedger,report.replaceAll(statement,unavailable),leading.replaceAll(statement,unavailable));
    assert.equal(useful.status,0,useful.stderr);assert.equal(useful.stdout,report.replaceAll(statement,unavailable));

  } finally {rmSync(dir,{recursive:true,force:true});}
});

test('actual inventory-only read failure can be captured after collection without inventing a collector error',()=>{
  const dir=mkdtempSync(join(tmpdir(),'pipeline current read failure '));
  try {
    const path=join(dir,'now missing.md');const failure=readReconciliationSource(path);
    assert.equal(failure.status,'unavailable');assert.equal(failure.errorCode,'ENOENT');
    assert.match(failure.diagnostic,/ENOENT/);
    const evidence={observedIds:['task'],localEvidence:{task:[{path,owner:'task',kind:'inventory-only',text:null}]}};
    const statement='Source read unavailable: '+failure.diagnostic;
    const claim={statement,status:'unavailable',support:[],reason:statement};
    const ledger={version:1,sourceReads:[failure],rows:[{id:'task',readPaths:[path],outcome:claim,gate:claim,alternatives:claim,concurrency:claim,chronology:claim}]};
    const report='## Observed work synthesis\n| Work identity | Outcome | Four-axis rationale | Next source gate | Ownership / readiness | Source |\n|---|---|---|---|---|---|\n| task | '+statement+' | B: UNKNOWN; V: UNKNOWN; S: UNKNOWN; P: UNKNOWN | '+statement+' | UNKNOWN | '+path+' |\n\n## Source fidelity review\n| Status | Capability | Reviewer | Scope | Remaining findings |\n|---|---|---|---|---|\n| UNAVAILABLE | unavailable | unavailable | all observed identities | Native review unavailable |\nNative review unavailable\n';
    const hash=value=>createHash('sha256').update(value).digest('hex');
    const review={status:'UNAVAILABLE',capability:'unavailable',reviewer:'unavailable',diagnostic:'Native review unavailable',observedIds:['task'],repairPasses:0,reportSHA256:hash(report),ledgerSHA256:hash(JSON.stringify(ledger))};
    assert.deepEqual(validateSourceReconciliation(ledger,evidence,report,review,JSON.stringify(ledger),new Map([[path,failure]])),[]);
    assert.match(validateSourceReconciliation(ledger,evidence,report,review).join('\n'),/actual captured diagnostic/);
    assert.match(validateSourceReconciliation({...ledger,sourceReads:[{...failure,diagnostic:'fabricated'}]},evidence,report,review,JSON.stringify(ledger),new Map([[path,failure]])).join('\n'),/actual captured diagnostic/);
  } finally {rmSync(dir,{recursive:true,force:true});}
});


test('cached Git evidence stays bound to a nested project with spaces',()=>{
  const dir=mkdtempSync(join(tmpdir(),'pipeline enclosing repo '));
  const nested=join(dir,'consumer with spaces');
  const git=(...args)=>{const out=spawnSync('git',args,{cwd:dir,encoding:'utf8'});assert.equal(out.status,0,out.stderr);return out.stdout.trim();};
  try {
    git('init','-q');
    const relative='.claude/orchestrator-prompts/shared-task/kickoff.md';
    for(const [root,text] of [[dir,'Outer project must remain outside this binding.\n'],[nested,'Nested project source.\n']]){
      mkdirSync(resolve(join(root,relative),'..'),{recursive:true});writeFileSync(join(root,relative),text);
    }
    git('add','.');git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','nested fixture');
    const oid=git('rev-parse','HEAD'),diagnostics=[];
    const records=collectCachedSourceEvidence(nested,['shared-task'],oid,diagnostics)['shared-task'];
    assert.equal(records.length,1);assert.equal(records[0].text,'Nested project source.\n');
    assert.equal(records[0].origin.boundProjectPrefix,'consumer with spaces/');
    assert.equal(records[0].origin.repoPath,'consumer with spaces/'+relative);
    assert.deepEqual(diagnostics,[]);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
