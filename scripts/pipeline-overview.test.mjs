import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  buildOverview,
  renderOverview,
} from '../.agents/procedures/pipeline/helpers/overview.mjs';

const feed = `=== priority-score: candidate umbrellas ===
closed kickoff=exists status=DONE done_pr=12 basis=done-md
alpha kickoff=exists volume=M
alpha-meta-launch kickoff=exists volume=L
beta kickoff=exists volume=S
phantom kickoff=missing
todo-x kickoff=synthetic source=code-todo
=== priority-score.sh: END rc=0 (lines=7) ===`;
const inputs = {
  candidateOutput: feed,
  kickoffs: {
    alpha: '# Fix configuration access\n\nMake configuration reads injectable.',
    beta: '# Ship docs',
  },
  frontiers: {
    alpha:
      'STAGE S1 done=no deps=- unmet=- unresolved=no label="Build"\nSTAGE S2 done=no deps=S1 unmet=S1 unresolved=no label="Check"\nFRONTIER: S1',
    beta: 'DEGRADE: no table',
  },
  prs: [
    {
      number: 77,
      headRefName: 'feature/alpha-s1-aabbcc',
      title: 'alpha stage',
    },
  ],
  branches: [],
  tasks: [],
  diagnostics: ['factory unavailable'],
  plan: '',
};

test('source claims keep a task-bound host debt through shared body references without assigning it to siblings', () => {
  const text = '# Family report\n\n| taskId | task | PR | landed |\n|---|---|---|---|\n| id-1 | refresh | #42 | MERGED |\n| id-2 | python | #43 | MERGED |\n\n- #42 A3 HOST-DEFERRED: live host walk of `INSTALL-FOR-AI.md` steps 2-8 never ran; CI proves mechanics, not preserved edits.\n';
  const path = '/owned family/FINAL-REPORT.md';
  const body = {path, owner:'family', kind:'local-source-claim', scope:'shared-family', text,
    sha256:createHash('sha256').update(text).digest('hex'), bytes:Buffer.byteLength(text)};
  const reference = {...body, kind:'body-reference', text:null, bodyEvidenceId:'family-docs'};
  const result = buildOverview({...inputs,
    candidateOutput:'=== priority-score: candidate umbrellas ===\nfamily-docs kickoff=exists\nfamily-refresh kickoff=exists\nfamily-python kickoff=exists\n=== priority-score.sh: END rc=0 (lines=3) ===',
    kickoffs:{'family-docs':'# Docs', 'family-refresh':'# Refresh', 'family-python':'# Python'},
    localEvidence:{'family-docs':[body], 'family-refresh':[
      {path:'/owned family-refresh/kickoff.md',owner:'family-refresh',scope:'entry',kind:'inventory-only',text:null}, reference
    ], 'family-python':[reference]}
  });
  assert.ok(Array.isArray(result.acceptanceSourceClaims), 'historical host debt must be exposed by the actual overview consumer');
  assert.equal(result.acceptanceSourceClaims.length,1);
  const claim=result.acceptanceSourceClaims[0];
  assert.deepEqual(claim.taskIds,['family-refresh']);
  assert.deepEqual(claim.prNumbers,['42']);
  assert.equal(claim.sourcePath,path);
  assert.equal(claim.sourceLine,8);
  assert.equal(claim.text,'- #42 A3 HOST-DEFERRED: live host walk of `INSTALL-FOR-AI.md` steps 2-8 never ran; CI proves mechanics, not preserved edits.');
  assert.equal(claim.currentResolution,'UNKNOWN');
  assert.deepEqual(result.sourceBindings['family-refresh'],['/owned family-refresh/kickoff.md']);
});

test('an own-source historical marker remains attributed without interpreting it as current failure', () => {
  const text='# Solo report\n#77 was HOST-DEFERRED; a later acceptance record must determine its present resolution.\n';
  const result=buildOverview({...inputs, localEvidence:{alpha:[{
    path:'/owned alpha/done.md',owner:'alpha',scope:'entry',kind:'local-source-claim',text,
    sha256:createHash('sha256').update(text).digest('hex')
  }]}});
  assert.deepEqual(result.acceptanceSourceClaims[0].taskIds,['alpha']);
  assert.equal(result.acceptanceSourceClaims[0].currentResolution,'UNKNOWN');
  assert.equal(result.acceptanceSourceClaims[0].text,'#77 was HOST-DEFERRED; a later acceptance record must determine its present resolution.');
});
test('conflicting same-path source bodies cannot erase acceptance statements or borrow a body reference', () => {
  const body=text=>({path:'/owned alpha/done.md',owner:'alpha',kind:'local-source-claim',text,
    sha256:createHash('sha256').update(text).digest('hex')});
  const historical=body('#77 A3 HOST-DEFERRED: live host walk remains owed.\n');
  const conflicting=body('MERGED: no acceptance statement in this separate capture.\n');
  assert.throws(()=>buildOverview({...inputs,localEvidence:{alpha:[historical],beta:[conflicting]}}),
    /Conflicting acceptance source body/);
  const reference={...historical,text:null,kind:'body-reference',bodyEvidenceId:'alpha'};
  assert.throws(()=>buildOverview({...inputs,localEvidence:{alpha:[historical],beta:[conflicting,reference]}}),
    /Conflicting acceptance source body/);
  const identical=buildOverview({...inputs,localEvidence:{alpha:[historical],beta:[{...historical},reference]}});
  assert.equal(identical.acceptanceSourceClaims.length,1);
  assert.deepEqual(identical.acceptanceSourceClaims[0].taskIds,['alpha']);
});
test('overview filters closure and meta-launch aliases, keeps synthetic work separate, describes each item', () => {
  const result = buildOverview(inputs);
  assert.deepEqual(
    result.work.map((x) => x.name),
    ['alpha', 'beta'],
  );
  assert.equal(result.synthetic.length, 1);
  assert.equal(result.work[0].availability, 'IN-FLIGHT');
  const output = renderOverview(result);
  assert.match(output, /Fix configuration access/);
  assert.match(output, /alpha\/S1 ↓ alpha\/S2/);
  assert.match(output, /Parallel safety unknown/);
  assert.doesNotMatch(output, /Wave 2 — after Wave 1|PARALLEL-OK/);
  assert.match(output, /factory unavailable/);
});
test('header-only and failed helper output cannot become a successful overview', () => {
  for (const candidateOutput of [
    '=== priority-score: candidate umbrellas ===',
    feed.replace('rc=0', 'rc=124'),
  ]) {
    assert.throws(
      () => buildOverview({ ...inputs, candidateOutput }),
      /incomplete|failed/,
    );
  }
});
test('unavailable PR/branch/task probes do not read as idle or launchable', () => {
  const result = buildOverview({
    ...inputs,
    prs: null,
    branches: null,
    tasks: null,
  });
  assert.equal(result.work[1].availability, 'UNVERIFIED');
  assert.doesNotMatch(
    renderOverview(result),
    /Ready to dispatch|no running tasks|all clear/i,
  );
});
test('completed markers stay unverified and missing dependency columns do not create edges', () => {
  const result = buildOverview({
    ...inputs,
    frontiers: {
      alpha:
        'STAGE S1 done=yes basis=marker-unverified deps=- unmet=- unresolved=no label="Build"',
      beta: 'DEGRADE: no table',
    },
  });
  assert.match(renderOverview(result), /marker-unverified/);
  assert.equal(result.work[1].edges.length, 0);
});
test('candidate-probe failure remains visible even when wrapper exits zero', () => {
  const result = buildOverview({
    ...inputs,
    candidateOutput: feed.replace(
      'alpha kickoff=',
      'PROBE-INCOMPLETE: merged PR query failed; closure unknown\nalpha kickoff=',
    ),
  });
  assert.match(renderOverview(result), /merged PR query failed/);
});
test('old unmerged branch is possible ownership, not confirmed active execution', () => {
  const result = buildOverview({
    ...inputs,
    prs: [],
    branches: ['feature/alpha-old'],
    tasks: [],
  });
  assert.equal(result.work[0].availability, 'OWNERSHIP-CHECK');
});
test('branch-based DONE survives until full stage closure is reconciled', () => {
  const result = buildOverview({
    ...inputs,
    candidateOutput: feed.replace(
      'alpha kickoff=exists volume=M',
      'alpha kickoff=exists volume=M status=DONE done_pr=99 basis=branch',
    ),
  });
  assert.ok(result.work.some((item) => item.name === 'alpha'));
  assert.match(renderOverview(result), /S1 ↓ alpha\/S2/);
});

test('unavailable merged evidence is UNKNOWN rather than an empty successful query', () => {
  const unavailable = renderOverview(
    buildOverview({ ...inputs, mergedPrs: null }),
  );
  const empty = renderOverview(buildOverview({ ...inputs, mergedPrs: [] }));
  assert.match(unavailable, /Merged scope to reconcile: UNKNOWN/);
  assert.doesNotMatch(unavailable, /no matching merged PR in bounded query/);
  assert.match(empty, /no matching merged PR in bounded query/);
});
test('neutral evidence feed offers both supported native invocations', () => {
  const output = renderOverview(buildOverview(inputs));
  assert.match(output, /Claude Code: \/pipeline alpha/);
  assert.match(output, /Codex: \$pipeline alpha/);
  assert.doesNotMatch(output, /new Codex chat/);
});

test('overview links the actual local kickoff and plan for read-only navigation', () => {
  const output = renderOverview(
    buildOverview({
      ...inputs,
      kickoffPaths: { alpha: '/owned project/alpha/kickoff.md' },
      planPath: '/owned project/plan.md',
    }),
  );
  assert.match(
    output,
    /\[Read kickoff\]\(<\/owned project\/alpha\/kickoff.md>\)/,
  );
  assert.match(output, /\[Read plan\]\(<\/owned project\/plan.md>\)/);
});

test('observed witness includes cached staging identities once, separate from synthetic and verified closure', () => {
  const result = buildOverview({...inputs, diagnostics:[
    'STAGING-ONLY kickoff: .claude/orchestrator-prompts/cached-idea/kickoff.md; inspect git show origin/staging before completing overview',
    'STAGING-ONLY kickoff: .claude/orchestrator-prompts/cached-idea/kickoff-s2.md; inspect git show origin/staging before completing overview',
    'STAGING-ONLY kickoff: .ai-factory/orchestrator-prompts/cached-kernel/kickoff.md; inspect git show origin/staging before completing overview',
  ]});
  assert.deepEqual(result.observedIds,['alpha','beta','phantom','cached-idea','cached-kernel']);
  assert.match(renderOverview(result), /Observed identity witness.*\["alpha","beta","phantom","cached-idea","cached-kernel"\]/);
  assert.match(renderOverview(result), /phantom kickoff=missing.*readiness UNKNOWN/);
  assert.equal(result.work.length,2); // Cached observations do not silently become ready local work.
  assert.equal(result.synthetic.length,1);
});

test('real reconstruction diagnostic stays evidence and cannot poison the modern report witness', async () => {
  const { validateContext } = await import('../.agents/procedures/pipeline/helpers/check-final-report.mjs');
  const candidateOutput=feed.replace('phantom kickoff=missing',
    'memory-codification kickoff=missing\nRECONSTRUCT-STUB: memory-codification has a committed plan row but kickoff=missing — author + commit .claude/orchestrator-prompts/memory-codification/kickoff.md to restore portability (no auto-write)\nphantom kickoff=missing');
  const result=buildOverview({...inputs,candidateOutput,diagnostics:[
    'STAGING-ONLY kickoff: .claude/orchestrator-prompts/cached-idea/kickoff.md; inspect git show origin/staging before completing overview',
  ]});
  assert.deepEqual(result.observedIds,['alpha','beta','memory-codification','phantom','cached-idea']);
  assert.deepEqual(result.unresolved.map(row=>row.split(' ')[0]),['memory-codification','phantom']);
  assert.ok(result.diagnostics.some(row=>row.startsWith('RECONSTRUCT-STUB: memory-codification')));
  const rendered=renderOverview(result);
  assert.equal(rendered.split('## Probe limits')[0].includes('- RECONSTRUCT-STUB:'),false);
  assert.match(rendered.split('## Probe limits')[1],/RECONSTRUCT-STUB: memory-codification/);
  const context={mode:'overview0',workflow:'observed-synthesis-v1',invocation:'$pipeline',host:'codex',date:'2026-10-10',coverage:'partial',readOnly:true,observedIds:result.observedIds,
    tokens:{paste:'Paste into a new Codex chat',when:'When',waiting:'Waiting on',parallel:'Can parallel with'}};
  assert.deepEqual(validateContext(context),[]); // Real producer-to-consumer seam; no witness surgery.
  assert.equal(result.synthetic.length,1);
});


test('local evidence retains historical done claims and shared unresolved host acceptance without certifying readiness', async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { collectLocalEvidence } = await import('../.agents/procedures/pipeline/helpers/overview.mjs');
  const supplied={'654-ci-adhoc-install-fix':[{path:'done.md',text:'DONE #663; Closed 2026-06-22; Fixed 5 zizmor findings.',kind:'local-source-claim',scope:'entry'}]};
  assert.deepEqual(buildOverview({...inputs,localEvidence:supplied}).localEvidence,supplied); // Existing composition must not erase independently supplied local claims.
  const home=mkdtempSync(join(tmpdir(),'pipeline local evidence with spaces '));
  try {
    mkdirSync(join(home,'654-ci-adhoc-install-fix'));
    writeFileSync(join(home,'654-ci-adhoc-install-fix','done.md'),'# 654-ci-adhoc-install-fix — DONE\n- Final PR: #663\n- Closed: 2026-06-22\n- Summary: Fixed 5 zizmor findings.\n');
    mkdirSync(join(home,'one-button-w2'));
    writeFileSync(join(home,'one-button-w2','FINAL-REPORT.md'),'# Final report 2026-10-06\n- road-auto-refresh #2042: A3 HOST-DEFERRED; INSTALL-FOR-AI.md steps 2–8 live cold-agent walk remains owed.\n');
    const diagnostics=[];
    const evidence=collectLocalEvidence(home,['654-ci-adhoc-install-fix','one-button-w2-road-auto-refresh','one-button-w2-python-prepush'],diagnostics);
    const done=evidence['654-ci-adhoc-install-fix'].find(row=>row.path.endsWith('/done.md'));
    assert.match(done.text,/#663/);assert.match(done.text,/2026-06-22/);assert.match(done.text,/Fixed 5 zizmor/);
    assert.equal(done.scope,'entry');assert.equal(done.kind,'local-source-claim');assert.match(done.sha256,/^[a-f0-9]{64}$/);
    const shared=evidence['one-button-w2-road-auto-refresh'].find(row=>row.path.endsWith('/FINAL-REPORT.md'));
    assert.equal(shared.scope,'shared-family');assert.equal(shared.owner,'one-button-w2');assert.match(shared.text,/A3 HOST-DEFERRED/);
    const reference=evidence['one-button-w2-python-prepush'].find(row=>row.path.endsWith('/FINAL-REPORT.md'));
    assert.equal(reference.kind,'body-reference');assert.equal(reference.text,null);assert.equal(reference.sha256,shared.sha256);assert.equal(reference.bodyEvidenceId,'one-button-w2-road-auto-refresh');
    const result=buildOverview({...inputs,localEvidence:evidence,candidateOutput:feed.replace('phantom kickoff=missing','654-ci-adhoc-install-fix kickoff=missing')});
    assert.deepEqual(result.localEvidence,evidence);
    assert.ok(result.observedIds.includes('654-ci-adhoc-install-fix'));
    assert.equal(result.work.some(row=>row.name==='654-ci-adhoc-install-fix'),false);
    const rendered=renderOverview(result);assert.match(rendered,/#663/);assert.match(rendered,/A3 HOST-DEFERRED/);assert.match(rendered,/historical local claims/);
    assert.throws(()=>collectLocalEvidence(home,['../foreign'],diagnostics),/identity/);
    assert.equal(diagnostics.length,0);
  } finally { rmSync(home,{recursive:true,force:true}); }
});


test('bounded local-source collection exposes uncollected inventories and limits instead of silent closure', async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { collectLocalEvidence } = await import('../.agents/procedures/pipeline/helpers/overview.mjs');
  const home=mkdtempSync(join(tmpdir(),'pipeline bounded source '));
  try {
    mkdirSync(join(home,'alpha'));
    writeFileSync(join(home,'alpha','done.md'),'x'.repeat(128*1024+1));
    writeFileSync(join(home,'alpha','implementation-notes.md'),'Recorded result needing a separate source read.');
    const diagnostics=[];const result=collectLocalEvidence(home,['alpha'],diagnostics);
    assert.equal(result.alpha.length,2);
    assert.ok(result.alpha.every(row=>row.kind==='inventory-only' && row.text===null));
    assert.equal(diagnostics.length,1);assert.match(diagnostics[0],/LOCAL-EVIDENCE-INCOMPLETE.*done.md/);
    assert.equal(result.alpha.some(row=>row.ready || row.done || row.merged),false);
  } finally { rmSync(home,{recursive:true,force:true}); }
});


test('a broken recognized source cannot hide a later valid final report', async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');const { join } = await import('node:path');
  const { collectLocalEvidence } = await import('../.agents/procedures/pipeline/helpers/overview.mjs');
  const home=mkdtempSync(join(tmpdir(),'pipeline broken local source '));
  try {
    mkdirSync(join(home,'alpha'));
    symlinkSync(join(home,'absent-target'),join(home,'alpha','DONE.md'));
    writeFileSync(join(home,'alpha','FINAL-REPORT.md'),'A3 HOST-DEFERRED; live acceptance still owed.');
    const diagnostics=[];const result=collectLocalEvidence(home,['alpha'],diagnostics);
    assert.match(result.alpha.find(row=>row.path.endsWith('/FINAL-REPORT.md'))?.text ?? '',/A3 HOST-DEFERRED/);
    assert.ok(diagnostics.some(line=>line.includes('/alpha/DONE.md')));
  } finally { rmSync(home,{recursive:true,force:true}); }
});

test('a named-pipe source is rejected without blocking collection or hiding later evidence', {skip:process.platform==='win32'}, async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');const { join } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const home=mkdtempSync(join(tmpdir(),'pipeline special local source '));
  try {
    mkdirSync(join(home,'alpha'));
    const fifo=join(home,'alpha','DONE.md');
    const made=spawnSync('mkfifo',[fifo],{encoding:'utf8'});assert.equal(made.status,0,made.stderr);
    writeFileSync(join(home,'alpha','FINAL-REPORT.md'),'A3 HOST-DEFERRED; live acceptance still owed.');
    const module=new URL('../.agents/procedures/pipeline/helpers/overview.mjs',import.meta.url).href;
    const code=`import {collectLocalEvidence} from ${JSON.stringify(module)}; const diagnostics=[]; const result=collectLocalEvidence(${JSON.stringify(home)},['alpha'],diagnostics); console.log(JSON.stringify({result,diagnostics}));`;
    const child=spawnSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8',timeout:2000,killSignal:'SIGKILL'});
    assert.equal(child.error,undefined,'Collection must not block on the named pipe');assert.equal(child.status,0,child.stderr);
    const {result,diagnostics}=JSON.parse(child.stdout);
    assert.match(result.alpha.find(row=>row.path.endsWith('/FINAL-REPORT.md'))?.text ?? '',/A3 HOST-DEFERRED/);
    assert.ok(diagnostics.some(line=>line.includes('/alpha/DONE.md')&&line.includes('not a regular file')));
  } finally { rmSync(home,{recursive:true,force:true}); }
});

test('permitted prototype-like identities survive local evidence serialization', async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');const { join } = await import('node:path');
  const { collectLocalEvidence } = await import('../.agents/procedures/pipeline/helpers/overview.mjs');
  const home=mkdtempSync(join(tmpdir(),'pipeline identity dictionary '));
  const ids=['__proto__','constructor'];
  try {
    for(const id of ids){mkdirSync(join(home,id));writeFileSync(join(home,id,'done.md'),'Historical local claim; live readiness UNKNOWN.');}
    const result=collectLocalEvidence(home,ids);
    assert.deepEqual(Object.keys(result),ids);
    const serialized=JSON.parse(JSON.stringify(result));
    for(const id of ids)assert.match(serialized[id][0].text,/live readiness UNKNOWN/);
  } finally {rmSync(home,{recursive:true,force:true});}
});

test('specific local source owners precede ancestor families without inheriting their state', async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');const { join } = await import('node:path');
  const { collectLocalEvidence } = await import('../.agents/procedures/pipeline/helpers/overview.mjs');
  const home=mkdtempSync(join(tmpdir(),'pipeline source owner precedence '));
  try {
    for (const owner of ['alpha','alpha-child','alpha-child-leaf']) {
      mkdirSync(join(home,owner));
      writeFileSync(join(home,owner,'kickoff.md'),`# ${owner}\n`);
      writeFileSync(join(home,owner,'state.md'),owner==='alpha'?'Other sibling CLOSED-NULL':'This owner shipped its own result');
    }
    const evidence=collectLocalEvidence(home,['alpha-child-leaf','alpha-child-leaf-meta-launch']);
    const { sourcePathBindings } = await import('../.agents/procedures/pipeline/helpers/overview.mjs');
    const bindings=sourcePathBindings(evidence,Object.keys(evidence));
    for (const id of Object.keys(evidence)) {
      const owners=[...new Set(evidence[id].map(row=>row.owner))];
      assert.deepEqual(owners,['alpha-child-leaf','alpha-child','alpha']);
      const kickoff=evidence[id].find(row=>row.path.endsWith('/kickoff.md'));
      assert.equal(kickoff.owner,'alpha-child-leaf');
      assert.equal(kickoff.scope,id==='alpha-child-leaf'?'entry':'shared-family');
      assert.equal(evidence[id].some(row=>row.owner==='alpha'&&row.scope==='entry'),false);
      assert.deepEqual(bindings[id],[join(home,'alpha-child-leaf','kickoff.md'),join(home,'alpha-child-leaf','state.md')]);
    }
  } finally {rmSync(home,{recursive:true,force:true});}
});

test('first overview pass accepts prototype-like observed identities without local evidence', () => {
  const candidateOutput=feed.replace('phantom kickoff=missing','__proto__ kickoff=missing\nconstructor kickoff=missing');
  const result=buildOverview({...inputs,candidateOutput});
  assert.ok(result.observedIds.includes('__proto__'));
  assert.ok(result.observedIds.includes('constructor'));
  assert.deepEqual(result.sourceBindings.__proto__,[]);
  assert.deepEqual(result.sourceBindings.constructor,[]);
  assert.throws(()=>buildOverview({...inputs,candidateOutput,localEvidence:JSON.parse('{"__proto__":{}}')}),/local evidence rows/);
});
