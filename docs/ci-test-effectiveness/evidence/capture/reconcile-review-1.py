"""One-shot S1 review correction, frozen source only; not a product detector/parser.
Run from repo root after original inventory capture/compaction. Leaves raw probes intact.
The four rejected literal pairs and package command grammar below were source-reviewed.
"""
import json,gzip,pathlib,re,collections,hashlib,posixpath
R=pathlib.Path.cwd();D=R/'docs/ci-test-effectiveness';E=D/'evidence'
def read(p):
 p=D/p
 return json.load(gzip.open(p,'rt') if p.suffix=='.gz' else open(p))
def write(p,x): (D/p).write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
rows=[json.loads(l) for l in (D/'inventory.jsonl').read_text().splitlines()];byid={r['id']:r for r in rows};sources=[r for r in rows if r['kind'] in ['test-source-or-probe','support-source']];families={r['id']:r for r in read('family-assessments.json')};criteria=list(next(iter(families.values()))['criteria'])
inv=read('evidence/ci-invocations.json.gz');pkgs=read('evidence/package-entrypoints.json');packages={p['path']:p['scripts'] for p in pkgs}
rejected={('packages/core/hooks/checks/s17.test.ts','.github/workflows/discipline-self-check.yml#verify-pr-body-sections/1'):'echoed example',('packages/core/hooks/checks/s17.test.ts','.github/workflows/discipline-self-check.yml#sanity-stub-backward-passes-with-citation/1'):'heredoc body fixture citation',('packages/core/principles/02-paired-negative-test.test.ts','.github/workflows/discipline-self-check.yml#verify-pr-body-sections/1'):'echoed historical example',('packages/core/principles/37-required-context-completeness.test.ts','.github/workflows/workflow-integrity.yml#branch-protection-assertion/1'):'comment'}
pairs=[];direct=collections.defaultdict(list)
for r in sources:
 for x in inv:
  hits=[{'runLine':i+1,'text':line.strip()} for i,line in enumerate(x['step'].get('run','').splitlines()) if r['path'] in line]
  if not hits:continue
  reason=rejected.get((r['path'],x['id']));command=[h for h in hits if re.match(r'^(?:(?:SNAPSHOT_MODE=compare|PATH="\$RUNNER_TEMP:\$PATH") )?(?:bash|node|npx) ',h['text'])]
  if not reason:assert command,(r['path'],x['id'])
  pairs.append({'sourceId':r['id'],'stepId':'ci:'+x['id'],'classification':'nonexecuting-mention' if reason else 'direct-command-argument','reason':reason or 'Reviewed interpreter/runner argument in actual run body; surrounding availability/step/job conditions still apply.','lines':hits,'executingLines':command if not reason else []})
  if not reason:direct[r['id']].append('ci:'+x['id'])
assert len(pairs)==293 and sum(p['classification']=='nonexecuting-mention' for p in pairs)==4
# Explicit package grammar at audited head: Vitest positional filters, four Node chains,
# root workspace recursion. No shell parser or extrapolation from path mentions.
package_population={};children={}
for path,scripts in packages.items():
 cwd=posixpath.dirname(path) or '.'
 for name,cmd in scripts.items():
  key='entry:'+path+'#'+name;selected=[];deps=[]
  if cmd.startswith('vitest run'):
   if cwd=='packages/preset-react-native':selected=[]
   else:
    args=cmd.split()[2:];filters=[a for a in args if not a.startswith('--')]
    selected=[r['id'] for r in sources if r['path'].startswith(cwd+'/') and r['path'].endswith(('.test.ts','.audit.ts')) and '/fixtures/' not in r['path'] and (not filters or any(f in r['path'][len(cwd)+1:] for f in filters))]
  elif name.startswith('test:canonical'):
   for token in re.findall(r'(?:\.\./\.\./)?(?:scripts|tests)/[\w./-]+\.(?:mjs|sh|py)',cmd):
    p=token.removeprefix('../../')
    if 'test:'+p in byid:selected.append('test:'+p)
   deps=['entry:'+path+'#'+n for n in re.findall(r'npm (?:--prefix packages/core )?run (test:[\w:-]+)',cmd)]
  elif path=='package.json' and name in ['test','typecheck']:
   deps=['entry:'+p+'#'+name for p,s in packages.items() if p!='package.json' and name in s]
  package_population[key]=sorted(set(selected));children[key]=deps
for _ in range(4):
 for key,deps in children.items():package_population[key]=sorted(set(package_population[key]+[s for d in deps for s in package_population[d]]))
# Actual named CI npm invocations, plus explicit argument to aggregate core test.
package_ci=collections.defaultdict(list)
for x in inv:
 c=x['step'].get('run','').strip()
 m=re.fullmatch(r'npm --prefix packages/core run (test:[\w:-]+)',c)
 if m:package_ci['entry:packages/core/package.json#'+m[1]].append('ci:'+x['id'])
 if c=='npm --prefix packages/core test --silent -- tests/acceptance/canonical-regen':
  for r in sources:
   if r['path'].startswith('packages/core/tests/acceptance/canonical-regen'):direct[r['id']].append('ci:'+x['id'])
route_changes=[]
for r in sources:
 old=r.get('delivery',{}).get('entrypoints',[])
 # Keep explicit non-CI/manual classifications and wrapper/architectural witnesses;
 # replace inferred package + CI links with actual direct/aggregate closure.
 new=[v for v in old if not v.startswith('ci:') and not re.match(r'(?:packages/[^/]+/)?package.json#',v)]
 for key,pop in package_population.items():
  if r['id'] in pop:
   new.append(key.removeprefix('entry:'))
   new.extend(package_ci[key])
 new+=direct[r['id']];new=sorted(set(new))
 if new!=sorted(old):
  route_changes.append({'id':r['id'],'removed':sorted(set(old)-set(new)),'added':sorted(set(new)-set(old))})
  r['delivery']['entrypoints']=new
  r['cost']['repeatedWork']=new
  r['delivery']['reconciliation']='evidence/invocation-reconciliation.json'
 # Carrier state remains conservative for opt-in/manual/support, which also may be reachable via root workspace aggregate.
 r['cost']['repeatedWork']=r['delivery']['entrypoints']
 if r['delivery']['status']=='recurring' and not any(v.startswith(('ci:','test:')) for v in new):r['delivery']['status']='explicit-local-or-aggregate'
write('evidence/invocation-reconciliation.json',{'scope':'All293 source-path/active-CI-step lexical pairs at audited head; individually reviewed command lines. Not a universal parser. Package aggregate routes separately resolve concrete filters and script recursion. Conditions and runtime collection are not proven by static reachability.','counts':{'pairs':len(pairs),'directCommandPairs':len(pairs)-4,'nonexecutingPairs':4,'changedSourceRows':len(route_changes)},'pairs':pairs,'resolvedSourceDelivery':{r['path']:r['delivery'] for r in sources},'packageCI':dict(package_ci),'routeChanges':route_changes,'decisions':'D01 and D07 require executable reachability, reinforced by correction. D02 root auditor witnesses and D03 moved command pairs remain direct. D04 P37 test still runs through principles; comment is not a carrier. D05/D06/D08 probe outcomes unchanged; no new removal or wiring decision.'})
# Seven criteria for an invocation use its own contract, with real member families only
# where commands run tests. Generation and schema checks do not inherit test-fixture claims.
classes={
 'test':('Run the selected regression contracts.','Real runner assertion/exit for the selected population; collection alone is not sensitivity proof.','Useful witness only when invoked with stated config/tools; empty/conditional selections remain explicit.','Member oracles, not script presence, carry truth; shared family limits apply only to reached members.','Same names at different cwd, tool, event or timing are not automatically redundant.','Retain useful witnesses; measure this command/setup before optimizing. Aggregate CI timestamps are not this invocation duration.','Protects the selected population only; no claim that every assertion discriminates every fault.'),
 'compile':('Reject TypeScript diagnostic/type-contract violations in the configured program.','tsc --noEmit loads this cwd tsconfig; nonzero diagnostics fail.','Static typecheck is useful but provides no runtime test execution.','Compiler judgment is independent of expected test output; permissive declarations/skipLibCheck limit strength.','Typecheck and runtime tests expose different fault classes; no substitute or no-loss deletion shown.','Keep bounded compiler check; cost unallocated. Workspace recursion may compile shared imports repeatedly, but no measured removable duplication established.','Only the tsconfig include/exclude program and compiler policy; excluded templates/vendor/install are not covered.'),
 'drift':('Detect divergence between canonical source and derived artifacts/policy.','Check mode computes or inspects actual source and returns mismatch diagnostics/nonzero; exact command fixes surface.','Byte/schema consistency is useful, not proof generated material behaves correctly.','Expected source/generated relationship is declared separately; shared generator bugs require independent behavior witnesses.','Write and check have distinct roles; local and CI timing are retained.','Keep deterministic comparison at its needed boundary; no standalone timing measured. Do not infer canonical Node-chain cost.','Bounded declared source/output closure; semantic correctness requires the owning test/consumer witnesses.'),
 'producer':('Produce or install the command-specific artifact.','Successful generation/install exit and resulting bytes are operational observations; this invocation is not an adverse test.','Do not count producer success as a quality verdict.','No independent expected outcome here; check-mode/tests must supply it.','Producer and drift checker are not duplicate tests; package aliases may serve different callers.','Run when artifact is needed; retain supported entrypoint, no recurring test-cost saving inferred.','Output existence alone cannot establish behavior or installed delivery correctness.'),
 'scan':('Validate the stated structural/policy input.','Actual named scanner diagnostics and exit, under its declared scope/tool conditions.','Finite static checking is useful; clean output is not general semantic certification.','Checker policy is separate from checked input; its tests/fault controls establish sensitivity separately.','Different policy, range, host or timing remains distinct protection.','Keep bounded useful check; per-command maintenance and execution unmeasured, no cheapness assertion.','Only the named rule/input surface; advisory and missing-tool states are not passes.'),
 'advisory':('Expose a local coverage/capability limit to the operator.','Emits warning; no validator runs in this row.','Observation only: do not count as passing quality gate.','No semantic oracle; warning is an honest unverified state.','Not equivalent to the CI check it names.','Negligible command body but no measured duration; retain explicit local limit.','Relies on separately invoked CI/owner action, cannot block bad input.'),
 'native':('Deliver the exact configured command at the named native event/matcher.','Harness runs command and interprets its exit/output; registration bytes alone do not prove firing.','Registration is delivery wiring, not another test or proof host obeyed it.','Owned command/test oracles remain separate from configuration presence.','Canonical/plugin/contributor registrations target different install/harness homes; do not deduplicate from matching names.','Cost repeats at the declared event and timeout; actual native frequency/duration unmeasured.','Only this event/matcher/command; native firing requires supported-host evidence, absent in S1.'),
 'hook':('Dispatch declared Git lifecycle checks/producers for this entrypoint.','Hook executes command chain under staged/range/tool conditions; exit propagation determines blocking.','Hook file presence is not evidence that Git invoked it or all branches ran.','Underlying checks carry separate policy/oracles; hook orchestration tests cover routing.','Earlier staged checks and later range/full checks protect different timing; fallback is reduced.','Recurring commit/push cost unallocated; optimize only with workload and retained protection evidence.','Actual core.hooksPath, executable hook, capability branches and declared fallback limit coverage.')}
# Shared invocation-level reasoning, not new test families.
write('invocation-criteria.json',[{'id':k,'criteria':dict(zip(criteria,v))} for k,v in classes.items()])
assess=[]
def assess_row(r,typ,subject,pop=(),deps=(),specific=None,evidence=()):
 pop=sorted(set(pop));fams=sorted({byid[x]['familyId'] for x in pop if x in byid and 'familyId' in byid[x]})
 a={'id':r['id'],'class':typ,'subject':subject,'reachedSourceIds':pop,'reachedFamilyIds':fams,'delegates':list(deps),'criteria':{k:'invocation-criteria.json#/'+str(list(classes).index(typ))+'/criteria/'+k for k in criteria},'applicability':specific or subject,'evidenceRefs':list(evidence)}
 if typ=='test':
  a['memberAssessmentRefs']=['family-assessments.json#'+f for f in fams]
  a['memberCriterionRefs']={k:['family-assessments.json#'+f+'/criteria/'+k for f in fams] for k in criteria}
 index=len(assess);assess.append(a)
 r['criteria']={k:'invocation-assessments.json#/'+str(index)+'/criteria/'+k for k in criteria};r['individualApplicability']=subject+' '+a['applicability'];r['invocationAssessmentRef']='invocation-assessments.json#/'+str(index)
for r in rows:
 if r['kind']!='package-script':continue
 key=r['id'];path=r['path'];name=r['script'];cmd=r['command'];cwd=posixpath.dirname(path) or '.';deps=children[key];pop=package_population[key];typ='test' if name.startswith('test') else 'compile' if name=='typecheck' else 'drift' if '--check' in cmd or name=='check:skill-drift' else 'scan' if name in ['guard-liveness:fullsweep','verify:provenance','validate'] else 'producer'
 evidence=[path];specific='cwd='+cwd+'; exact command='+cmd+'. '
 if name=='typecheck' and path!='package.json':
  conf=json.load(open(R/cwd/'tsconfig.json'));specific+='Configured program: '+json.dumps({k:conf[k] for k in ['include','exclude','compilerOptions'] if k in conf},separators=(',',':'))+'. No runtime tests invoked.';evidence.append(cwd+'/tsconfig.json')
 elif cmd.startswith('vitest run'):
  specific+='Selected '+str(len(pop))+' source files, '+str(sum(byid[x].get('populationViews',{}).get('nativeVitestCases',0) for x in pop))+' native collected cases (conditional counts not execution). Config '+cwd+'/vitest.config.ts; filters are positional path matches. ';evidence.append(cwd+'/vitest.config.ts')
  if cwd.endswith('preset-react-native'):specific+='include=[] and passWithNoTests:true intentionally supplies zero regression protection.'
  if cwd.endswith('preset-react-spa'):specific+='eslint-rules/**/*.test.ts currently matches zero files; no successful test-body execution claimed.'
  if cwd.endswith(('runtime-bridge','preset-next-15-canonical')):specific+='D07: manual package/root aggregate only; typecheck does not supply recurring test carrier.'
  if cwd.endswith('runtime-bridge'):specific+='Live park suite is opt-in; deterministic33-file claim in D07 spans runtime plus Next, not all runtime tests.'
 elif name.startswith('test:canonical'):specific+='Explicit Node/shell/Python file arguments and named child-script closure listed; zsh/python availability conditional. Node24 host versus Node22 CI is retained as a limit.'
 elif path=='package.json' and name in ['test','typecheck']:specific+='Delegates only to workspaces defining this script. --if-present ignores absent scripts, not failures; root test may reach empty SPA selection. No automatic all-green claim.'
 elif name=='check:skill-drift':specific+='Live repo-local .claude/skills, agents and skills: broken internal refs, required frontmatter and invocation-channel drift fail; trigger overlaps warn only. This is a scanner, not fixture presence.';typ='scan';evidence.append('scripts/check-skill-drift.sh')
 elif name=='guard-liveness:fullsweep':specific+='Whole declared rule manifest, actual planted violations or structural mode; unlike changed-scope prepush. Evidence in hooks/checks/guard-liveness-fullsweep.ts.';evidence.append(cwd+'/hooks/checks/guard-liveness-fullsweep.ts')
 elif name=='verify:provenance':specific+='Verify generated synthesis provenance/hash ownership; cannot certify rule semantics.';evidence.append(cwd+'/synthesizer/verify-provenance-cli.ts')
 elif name=='validate':specific+='Validator CLI diagnostics for supplied rule artifacts, not its regression suite.';evidence.append(cwd+'/validator/cli.ts')
 elif '--check' in cmd:specific+='Nonwriting artifact freshness/format mode, distinct from producing sibling; actual mode switch and target source in command.'
 else:specific+='Operational '+('format rewrite' if name=='format' else 'demo' if name=='demo:cargo' else 'artifact/CLI')+' entrypoint; arguments/config select subject. No test-population credit.'
 assess_row(r,typ,cwd+' / '+name,pop,deps,specific,evidence)
# Local sweep: bind actual npm targets, explicit tests, finite shell loop expansions.
def command_targets(cmd):
 deps=[];pop=[]
 for m in re.finditer(r'npm (?:--prefix ([\w/-]+) )?run ([\w:-]+)',cmd):
  k='entry:'+(m[1]+'/' if m[1] else '')+'package.json#'+m[2]
  if k in package_population:deps.append(k);pop+=package_population[k]
 for r in sources:
  p=r['path']
  if re.search(r'(?:bash|node|python3) '+re.escape(p)+r'(?:\s|$)',cmd) or (p in cmd and re.search(r'npx .*vitest run ',cmd)):pop.append(r['id'])
 for prefix in ['tests/hooks/','tests/dispatcher/']:
  if 'for t in '+prefix+'*.test.sh' in cmd:pop += [r['id'] for r in sources if r['path'].startswith(prefix) and r['path'].endswith('.test.sh') and '/' not in r['path'][len(prefix):]]
 if 'scripts/run-install-sh-suite.sh tests/install-sh/' in cmd:pop += [r['id'] for r in sources if r['path'].startswith('tests/install-sh/') and r['path'].endswith('.test.sh') and '/' not in r['path'][len('tests/install-sh/'):]]
 if 'npm --prefix packages/core test --silent -- tests/acceptance/canonical-regen' in cmd:pop += [r['id'] for r in sources if r['path'].startswith('packages/core/tests/acceptance/canonical-regen')]
 if "grep -oE" in cmd:
  prefixes=('scripts/',) if 'scripts/(' in cmd else ('tests/plugin/','tests/aif-doctor/')
  # Same lexical workflow derivation as actual local runner, explicitly not assumed executable CI reachability.
  wf=(R/'.github/workflows/audit-self.yml').read_text()
  pop += [r['id'] for r in sources if r['path'].startswith(prefixes) and r['path'].endswith('.test.sh') and r['path'] in wf]
 return sorted(set(pop)),sorted(set(deps))
for r in rows:
 if r['kind']=='local-sweep-gate':
  cmd=r['command'];pop,deps=command_targets(cmd);typ='advisory' if cmd.startswith('echo ') else 'test' if pop else 'compile' if r['name']=='typecheck' else 'drift' if '--check' in cmd and any(t in cmd for t in ['render','build','format','SNAPSHOT']) else 'scan'
  note='Exact trigger '+r['trigger']+'; '+cmd+'. '
  if 'WARN-skip' in cmd:note+='Absent-tool/advisory branches can exit0 without validation; checker rejection status must be evaluated independently. D06 proves actionlint branch loss only, no fresh fault probe of sibling rows.'
  if "grep -oE" in cmd:note+='Population follows this existing lexical workflow-derived loop, not the corrected CI command reachability claim; comments/mentions must not be credited as CI execution.'
  if r['name']=='actionlint':note+='Actual D06 rejection swallowed; criterionOverrides remain authoritative.'
  assess_row(r,typ,r['name'],pop,deps,note,['evidence/local-sweep-gates.tsv','scripts/run-local-ci-sweep.sh'])
 elif r['kind']=='make-target':
  cmd='\n'.join(r['commands']);pop,deps=command_targets(cmd);typ='test' if pop else 'hook' if r['name'] in ['pre-commit-check','pre-push-check'] else 'producer' if r['name'] in ['demo','demo-cargo','install-hooks'] else 'scan'
  if r['name']=='self-audit':deps=['entry:Makefile#'+v for v in r['depends'].split()];typ='hook'
  assess_row(r,typ,'Make '+r['name'],pop,deps,'Recipes: '+cmd+'; prerequisites='+r['depends']+'. Convenience target preserves direct callers. Demo/install-hooks mutate output/config; validate-prompts validates existing specs, not test bodies.',['Makefile'])
 elif r['kind']=='pre-push-section':
  n=r['id'].split('/')[-1];mapping={'canonical-source':'test:canonical','principles-meta':'test:principles','ir-meta':'test:ir','backends-meta':'test:backends','composition-meta':'test:composition'};deps=['entry:packages/core/package.json#'+mapping[n]] if n in mapping else [];pop=[x for d in deps for x in package_population[d]]
  if n=='audit-ai-docs':pop=['test:packages/core/audit-self/audit-ai-docs.test.ts']
  typ='test' if pop else 'drift' if any(v in n for v in ['drift','render','bundle']) else 'producer' if n=='worktree-provisioning' else 'scan'
  body=(R/'packages/core/hooks/pre-push.ts').read_text();fn=re.search(r'([A-Za-z][\w]+)\(',r['call'])[1];start=re.search(r'(?:async )?function '+fn+r'\(',body);line=body[:start.start()].count('\n')+1 if start else None
  note='Section '+n+' owner='+r['owner']+' calls '+fn+'; '+('function starts at line '+str(line) if line else 'import/wrapper entry resolved in registry')+'. Exact maintainer/consumer, changed-input and capability conditions in this function apply. '
  if n=='audit-ai-docs':note+='Root Vitest fixture suite plus live Bash/TS repository audits are different observations.'
  if n=='worktree-provisioning':note+='Checks then may repair worktree dependencies; setup producer, not regression witness.'
  if n=='generated-rule-material':note+='Actual mutation/firing runners on generated manifest/backend material; explicit degraded branches are unverified, not green.'
  if n in mapping:note+='runCoreSuite uses supported heavy-runner dispatch/timeout; exact package population applies, not all hook tests.'
  assess_row(r,typ,n,pop,deps,note,['packages/core/hooks/pre-push.ts'+(':'+str(line) if line else '')])
 elif r['kind']=='native-hook-registration':assess_row(r,'native',r['event']+' '+str(r.get('matcher'))+' in '+r['path'],specific='Exact command='+r['hook'].get('command','')+'; timeout='+str(r['hook'].get('timeout'))+'. Advising vs blocking is command-specific; no invocation measured.',evidence=[r['path']])
 elif r['kind']=='git-hook-entrypoint':assess_row(r,'hook',r['path'],specific=r['individualApplicability'],evidence=[r['path']])
 elif r['kind']=='pre-commit-check-or-producer':
  typ='producer' if any(s in r['name'] for s in ['regeneration','Invariants-line render']) else 'advisory' if 'soft warn' in r['name'] else 'scan'
  assess_row(r,typ,r['name'],specific='Source block starts .husky/pre-commit:'+str(r['sourceLine'])+'. '+('Generates and may restage derived files; output creation is not independent validation.' if typ=='producer' else 'Selected staged input policy stated by block title; capability branches and exact rejection/warn status remain in source. No test-suite/family execution implied.'),evidence=['.husky/pre-commit:'+str(r['sourceLine'])])
write('invocation-assessments.json',assess)
(D/'inventory.jsonl').write_text(''.join(json.dumps(x,ensure_ascii=False,separators=(',',':'))+'\n' for x in rows))
write('evidence/review-1-reconciliation-summary.json',{'reviewBase':'8c13d59395297380f5b981eac508f9175bc2e8cb','inventoryRecords':len(rows),'sourceRouteChanges':len(route_changes),'CIPathPairs':len(pairs),'rejectedNonexecutingPairs':4,'assessedInvocations':len(assess),'assessedKinds':dict(collections.Counter(byid[a['id']]['kind'] for a in assess)),'packageTestPopulations':{k:len(v) for k,v in package_population.items() if '#test' in k},'limits':'Bounded source audit, no shell interpreter or dynamic certification. Existing probe bytes and member archive unchanged.'})
print(json.dumps({'inventory':len(rows),'routesChanged':len(route_changes),'CIpairs':len(pairs),'rejected':4,'invocationAssessments':len(assess)}))
