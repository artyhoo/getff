import json,pathlib,re,hashlib,collections,gzip
R=pathlib.Path('/workspace/getff-native');D=R/'docs/ci-test-effectiveness';E=D/'evidence';criteria=['relevance','effectiveness','theatre','tautology','duplication','costEffectiveness','sufficiency']
source=json.load(open(E/'source-census.json'));decl={x['path']:x['cases'] for x in json.load(open(E/'declared-js-cases.json'))};py={x['path']:x for x in json.load(open(E/'python-discovery.json'))};natives=collections.defaultdict(list)
for f in sorted(E.glob('vitest-*.json')):
 for i,x in enumerate(json.load(open(f))):natives[x['file'].removeprefix(str(R)+'/')].append({'id':f.stem+':'+str(i+1),'name':x['name'],'evidenceRef':'evidence/'+f.name+'#/'+str(i)})
missing={'.agents/procedures/harvest/tests/health-preflight.test.mjs','.agents/procedures/pipeline/evals/runtime-audit.test.py','.agents/procedures/pipeline/helpers/autonomy-binding.test.mjs','.agents/roles/dual-channel-drift-auditor/test_enumerate.py','.agents/roles/dual-channel-drift-auditor/test_overlap.py','scripts/codex-hook-compatibility.test.mjs','scripts/pipeline-saved-coordination.test.mjs','tests/advisor-bridge-beta/protocol.test.mjs'}
manual={'scripts/docplan-auditor-runtime-audit.test.mjs','scripts/template-audit-runtime-receipts.test.mjs','tests/aif-init/runtime-output.test.mjs','tests/native-entry/rule-test-author-runtime.test.py','tests/reviewer-runtime-audit/receipts.test.mjs','tests/runtime/fidelity-auditor-receipt.test.mjs'}
support={'tests/agnosticism/_cc-absent-lib.sh','tests/consumer-matrix/known-rot.sh','tests/install-sh/lib/manual-step.sh','tests/install-sh/snapshot.sh'}
def fam(p):
 if p.startswith('docs/test-assurance-kernel/') or p in support or '/fixtures/' in p or p.endswith('.snap'):return 'test-support'
 if p in manual or p.startswith(('tests/claims-conformance-runtime/','tests/compliance-verifier-runtime/','tests/reviewer-runtime-audit/','tests/eval/')) or p=='tests/runtime/fidelity-auditor-receipt.mjs':return 'historical-receipt'
 if p.startswith('tests/live/'):return 'manual-live'
 if p.startswith('tests/consumer-matrix/'):return 'consumer-matrix'
 if p.startswith('tests/agnosticism/'):return 'agnosticism'
 if p.endswith('.py'):return 'python'
 if 'autonomy-binding.test.mjs' in p:return 'node-autonomy'
 if p.startswith('scripts/dot-relay/'):return 'dot-relay'
 if p.startswith(('scripts/dot-review-gate/','tests/dot-review-gate/')):return 'dot-review'
 if p.startswith('packages/runtime-bridge/'):return 'runtime-bridge'
 if '/eslint-rules/' in p:return 'eslint-rules'
 if p.startswith('packages/core/'):
  part=p.split('/')[2];return {'audit-self':'core-audit','backends':'core-backends','composition':'core-composition','detector':'core-detector','detector-v0':'core-detector','diagnostics':'core-diagnostics-diff','diff':'core-diagnostics-diff','docs-engine':'core-docs-engine','hooks':'core-hooks','install':'core-install','installer':'core-installer','ir':'core-ir','principles':'principles','python-starter':'core-render','render':'core-render','research':'core-research','scenario-generator':'core-scenario','skills':'core-skills','spec-validation':'core-spec','synthesizer':'core-synth','validator':'core-validator','tests':'core-acceptance'}[part]
 if p.startswith('tests/install-sh/'):return 'shell-install'
 if p.startswith('tests/plugin/'):return 'shell-plugin'
 if p.startswith('tests/hooks/'):return 'shell-hooks'
 if p.endswith('.mjs'):return 'node-canonical'
 return 'shell-scripts'
inv=json.load(open(E/'ci-invocations.json'));pkg=json.load(open(E/'package-entrypoints.json'));packageScripts={z['path']:z['scripts'] for z in pkg}
workflowText='\n'.join(x['step'].get('run','') for x in inv)
# Actual command carriers, not arbitrary file-name mentions in docs/snapshots.
coreRoute={'principles':'test:principles','ir':'test:ir','backends':'test:backends','composition':'test:composition','hooks':'test:hooks','skills':'test:skills','spec-validation':'test:spec-validation','synthesizer':'test:synthesizer','render':'test:render'}
def routes(p,kind):
 if p in missing:return {'status':'missing-recurring-carrier','entrypoints':['manual native command only'],'decision':'D07'}
 if p.startswith('packages/runtime-bridge/') and p.endswith('.test.ts'):return {'status':'manual-package-only' if 'aif-park-live' not in p else 'explicit-live-opt-in','entrypoints':['packages/runtime-bridge/package.json#test','package.json#test'],'decision':'D07' if 'aif-park-live' not in p else None}
 if p.startswith('packages/preset-next-15-canonical/'):return {'status':'manual-package-only','entrypoints':['packages/preset-next-15-canonical/package.json#test','package.json#test'],'decision':'D07'}
 if p=='packages/core/audit-self/run-bash-mutation.test.ts':return {'status':'local-tool-conditional','entrypoints':['packages/core/package.json#test:units'],'condition':'mutate and analyze_mutants installed; explicit local-only contract'}
 if p in manual or kind=='historical-receipt':return {'status':'manual-replay','entrypoints':['source documented native command / receipt corpus'],'condition':'Bound historical corpus, and tool/argument requirements in source; not a fresh native run'}
 if kind=='manual-live':return {'status':'manual-live','entrypoints':['source documented target command'],'condition':'Actual external/installed target needed, not run in S1'}
 if kind=='test-support':return {'status':'support-not-independent-suite','entrypoints':['owning tests/fixture consumers; source references preserved']}
 out=[]
 for x in inv:
  if p in x['step'].get('run',''):out.append('ci:'+x['id'])
 if p.startswith('packages/core/') and p.endswith(('.test.ts','.audit.ts')):
  part=p.split('/')[2];script=coreRoute.get(part,'test:units');out.append('packages/core/package.json#'+script)
  out.append('ci:.github/workflows/audit-self.yml#principles-meta-tests')
  if part=='principles':out.append('ci:.github/workflows/audit-self.yml#kickoff-checks')
 for path,scripts in packageScripts.items():
  for name,command in scripts.items():
   if p in command or (p.startswith('scripts/') and '../../'+p in command):out.append(path+'#'+name)
 if p=='tests/advisor-role-reminders/test_reminders.py':out.append('test:packages/core/hooks/advisor-role-reminders.test.ts')
 if p.startswith('tests/agnosticism/') and p.endswith('.sh'):out.append('tests/agnosticism/run-audit.sh (architectural/session audit)')
 if p.startswith('tests/consumer-matrix/') and not out:out.append('ci:.github/workflows/audit-self.yml#framework-fresh-install-validate via owning cell')
 return {'status':'recurring' if any(x.startswith(('ci:','packages/core/package.json#','test:')) for x in out) else 'explicit-local-or-aggregate','entrypoints':sorted(set(out))}
def refs(f,extra=None):return {k:{'assessmentRef':'family-assessments.json#'+f+'/criteria/'+k,**({'memberEvidence':extra} if extra else {})} for k in criteria}
rows=[];members=[]
for i,x in enumerate(source):
 p=x['path'];f=fam(p);s=(R/p).read_text(errors='replace');cs=decl.get(p,[]);native=natives[p];m=[]
 for c in cs:
  id='decl:'+c['id'];m.append(id);a=c['assertions'];mode=c['mode'];member={'id':id,'sourceId':'test:'+p,'kind':'declared-js-callback','name':c['title'],'ancestors':c['ancestors'],'sourceLine':c['line'],'mode':mode,'assertionCount':len(a),'oracleEvidence':'evidence/declared-js-cases.json#'+p+':'+str(c['line']),'criteria':refs(f,'Exact callback at '+p+':'+str(c['line'])+'; '+('direct oracle calls listed' if a else 'delegated helper/fixture callback; source body preserved, not classified empty by direct-call count')),'applicability':'This callback constrains the named source/input/outcome. Conditional suites and expanded names are retained separately. It inherits only the family observable boundary, not a universal semantic pass.'};members.append(member)
 for n in native:
  id='native:'+n['id'];m.append(id);members.append({'id':id,'sourceId':'test:'+p,'kind':'native-vitest-case','name':n['name'],'evidenceRef':n['evidenceRef'],'declarationSource':'test:'+p,'criteria':refs(f,'Native collected identity '+n['id']+' resolves to this exact source file and the named fixture outcome; source callbacks/oracles above are the behavior evidence.'),'applicability':'Concrete native parameter/RuleTester expansion. Do not add native count to declaration count as distinct tests; these are overlapping views.'})
 if p in py:
  for name in py[p]['cases']:
   id='python:'+p+'#'+name;m.append(id);members.append({'id':id,'sourceId':'test:'+p,'kind':'native-unittest-case','name':name,'criteria':refs(f,'Exact unittest identity; source assertion expressions in census.'),'applicability':'Native loader successfully discovered this method; detailed assertions constrain helper behavior. No S1 test-body execution claimed.'})
 if p.endswith('.sh'):
  # Shell has no standard discovery API. Retain every declared branch/label, not invented runtime counts.
  for c in x['declarations']:
   id='shell-decl:'+p+':'+str(c['line']);m.append(id);members.append({'id':id,'sourceId':'test:'+p,'kind':'shell-source-branch-or-label','name':c['text'],'sourceLine':c['line'],'criteria':refs(f,'Source declaration '+p+':'+str(c['line'])+'; assertion/control flow is in source census and immutable source.'),'applicability':'Declared shell branch/label, not a native runtime test count. Comments, nested loops and helpers may delimit several cases; do not equate label count to executed assertions.'})
 obligations=[c['title'].strip("'\"`") for c in cs[:4]] or [c['text'] for c in x['declarations'][:4]]
 route=routes(p,f);dec=[]
 if route.get('decision'):dec.append(route['decision'])
 if p.endswith('41-shell-test-ci-coverage.test.ts'):dec.append('D01')
 if p.endswith('autonomy-binding.test.mjs'):dec.append('D05')
 if p=='scripts/run-local-ci-sweep.test.sh':dec.append('D06')
 if p.endswith('audit-ai-docs.test.ts'):dec.append('D02')
 if any(p.endswith(z+'.test.sh') for z in ['synth-wire-consumer-config','first-commit-passable','r2-glob-reach','r2-auto-wire']):dec.append('D03')
 mechanisms=[]
 for label,pat in [('subprocess','spawn|execFile|execSync|bash '),('filesystem fixtures','mkdtemp|TemporaryDirectory|mktemp'),('source/byte contract','readFile|read_text|grep|toContain'),('literal diagnostic/result','toEqual|toBe\(|assert.equal|assertEqual|check '),('snapshot/drift','toMatchSnapshot|fingerprint|snapshot|expected-'),('tool-conditional','skipIf|runIf|command -v|shutil.which')]:
  if re.search(pat,s):mechanisms.append(label)
 rows.append({'id':'test:'+p,'kind':'support-source' if f=='test-support' else 'test-source-or-probe','path':p,'sha256':x['sha256'],'familyId':f,'obligation':{'familyRef':'family-assessments.json#'+f,'memberContracts':obligations,'allContractsRef':'evidence/case-inventory.jsonl.gz#sourceId=test:'+p},'oracle':{'source':p,'evidenceRef':'evidence/source-census.json#/'+str(i)+'/oracleExpressions','mechanisms':mechanisms,'declaredAssertionCalls':sum(len(c['assertions']) for c in cs),'scope':'Contract/source assessment; successful collection is not semantic certification.'},'delivery':route,'protectionBoundary':('conditional external/native target' if route['status'] in ['manual-live','explicit-live-opt-in'] else 'historical replay' if route['status']=='manual-replay' else 'support input' if f=='test-support' else 'source/fixture contract at listed validation invocation'),'criteria':refs(f,'Member path, imported subject(s), complete declaration/native identity list and oracle source form individual applicability. Decisions override shared family assessment.'),'criterionOverrides':{'sufficiency':'Missing recurring carrier for these useful deterministic contracts; repair under D07.'} if 'D07' in dec else {},'cost':{'setupSeconds':None,'executionSeconds':None,'queueSeconds':None,'retries':None,'maintenance':'Named fixture/contract and subject changes may require updating expectations; no per-item maintenance ledger available.','diagnosis':'Source/diagnostic assertions and exact native identity preserved.','repeatedWork':route['entrypoints'],'aggregateEvidence':'evidence/ci-cost-summary.json','limits':'No invented per-test allocation from aggregate step timestamps. Optional/live/native-host cost is unmeasured.'},'decisions':dec,'memberIds':m,'populationViews':{'declaredJsCallbacks':len(cs),'nativeVitestCases':len(native),'nativePythonCases':len(py.get(p,{}).get('cases',[])),'shellSourceLabels':len(x['declarations']) if p.endswith('.sh') else 0},'conditions':x['skipExpressions'],'importedSubjects':x['imports'],'evidenceRefs':['evidence/source-census.json#/'+str(i),p]})
# Include all tracked support trees plus runner configs, not only test-shaped sources.
files=(E/'tracked-files.txt').read_text().splitlines();seen={x['path'] for x in source};extra=[p for p in files if p not in seen and not p.startswith(('docs/','.claude/orchestrator-prompts/')) and (re.search(r'/(?:fixtures|__fixtures__|__snapshots__|snapshots|baselines|samples)/|/(?:expected-[^/]+|tests-setup\.[^/]+|vitest\.[^/]+|stryker\.[^/]+|bash\.rules)$',p) or p=='vitest.config.ts')]
for p in extra:rows.append({'id':'support:'+p,'kind':'fixture-snapshot-runner-support','path':p,'sha256':hashlib.sha256((R/p).read_bytes()).hexdigest(),'familyId':'test-support','criteria':refs('test-support',p+' is a tracked input/configuration under its owning test family; not counted as independent test execution.'),'protectionBoundary':'support input, not independent gate','cost':{'executionSeconds':None,'maintenance':'Versioned fixture/configuration changes require owning-contract review.'},'evidenceRefs':[p]})
(D/'inventory.jsonl').write_text(''.join(json.dumps(x,ensure_ascii=False,separators=(',',':'))+'\n' for x in rows))
with gzip.GzipFile(filename=str(E/'case-inventory.jsonl.gz'),mode='wb',mtime=0) as z:z.write((''.join(json.dumps(x,ensure_ascii=False,separators=(',',':'))+'\n' for x in members)).encode())
(E/'population-working-summary.json').write_text(json.dumps({'sourceRows':len(source),'additionalSupportRows':len(extra),'caseViews':dict(collections.Counter(x['kind'] for x in members)),'familySourceCounts':dict(collections.Counter(x['familyId'] for x in rows)),'status':'WORKING: CI/local invocation records appended next; native/declaration views overlap and must not be summed.'},indent=2)+'\n');print(len(rows),'inventory records;',len(members),'overlapping member views')
