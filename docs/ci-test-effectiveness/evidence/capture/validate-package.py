import pathlib,json,gzip,hashlib,collections,subprocess,datetime,re
R=pathlib.Path('/workspace/getff-native');D=R/'docs/ci-test-effectiveness';E=D/'evidence';errors=[];checks={};crit={'relevance','effectiveness','theatre','tautology','duplication','costEffectiveness','sufficiency'}
def check(name,value):checks[name]=value;errors.extend([] if value else [name])
def read(p):return gzip.decompress(p.read_bytes()).decode() if p.suffix=='.gz' else p.read_text()
# Parse complete portable data, not merely main manifests.
parsed=0
for p in D.rglob('*'):
 if not p.is_file():continue
 name=p.name.removesuffix('.gz')
 try:
  if name.endswith('.json'):json.loads(read(p));parsed+=1
  elif name.endswith('.jsonl'):
   for l in read(p).splitlines():json.loads(l)
   parsed+=1
 except Exception as e:errors.append(str(p.relative_to(D))+': '+str(e))
rows=[json.loads(l) for l in (D/'inventory.jsonl').read_text().splitlines()];ids={x['id']:x for x in rows};members=[json.loads(l) for l in read(E/'case-inventory.jsonl.gz').splitlines()];mi={x['id']:x for x in members};fs={x['id']:x for x in json.load(open(D/'family-assessments.json'))};jobs={x['id']:x for x in json.load(open(D/'ci-job-assessments.json'))};dec=[json.loads(l) for l in (D/'decisions.jsonl').read_text().splitlines()]
check('inventory2121unique',len(rows)==len(ids)==2121);check('member21196unique',len(members)==len(mi)==21196);check('allInventorySevenCriteria',all(set(x.get('criteria',{}))==crit for x in rows));check('allMembersSevenCriteria',all(set(x.get('criteria',{}))==crit for x in members));check('allFamiliesSevenCriteria',all(set(x['criteria'])==crit for x in fs.values()));check('allMemberParentsExist',all(x['sourceId'] in ids for x in members));check('decisionItemRefsExist',all(i in ids for d in dec for i in d['itemIds']));check('allGroupMembersExist',all(i in ids for x in rows if x['kind']=='explicit-assessed-group' for i in x['memberIds']))
for x in [*rows,*members]:
 for key,v in x['criteria'].items():
  ref=v if isinstance(v,str) else v.get('assessmentRef') if isinstance(v,dict) else None
  if ref and ref.startswith('family-assessments.json#'):
   f=ref.split('#',1)[1].split('/')[0]
   if f not in fs or key not in fs[f]['criteria']:errors.append('bad family criterion ref '+ref)
  elif ref and ref.startswith('ci:'):
   item=ref.rsplit('/criteria/',1)[0]
   if item not in ids:errors.append('bad CI parent '+ref)
source=[x for x in rows if x['kind'] in ['test-source-or-probe','support-source']];check('source736',len(source)==736);check('sourceHashesMatchCurrent',all(hashlib.sha256((R/x['path']).read_bytes()).hexdigest()==x['sha256'] for x in source));check('everySourceMemberCountMatches',all(sum(y['sourceId']==x['id'] for y in members)==x['memberCountAcrossOverlappingViews'] for x in source));check('activeJobs56',sum(x['kind']=='ci-job' for x in rows)==56);check('activeSteps486',sum(x['kind']=='ci-step' for x in rows)==486);check('shippedJobs41Steps204',sum(x['kind']=='shipped-ci-job' for x in rows)==41 and sum(x['kind']=='shipped-ci-step' for x in rows)==204);check('principles57',len(json.load(open(D/'principle-assessments.json')))==57)
index=json.load(open(E/'index.json'))
for a in index['archives']:
 p=D/a['path'];raw=gzip.decompress(p.read_bytes());check('archive:'+a['path'],hashlib.sha256(raw).hexdigest()==a['uncompressedSHA256'] and hashlib.sha256(p.read_bytes()).hexdigest()==a['storedSHA256'])
# Actual probe outcomes, separately from schema/identity checks.
for n in ['p41-baseline.json','p41-mutant.json','p41-restoration.json']:
 p=E/n
 if not p.exists():p=E/(n+'.gz')
 v=json.loads(read(p));check(n+':8pass',v['numPassedTests']==8 and v['numFailedTests']==0)
a=json.load(open(E/'local-actionlint-real-fault.json'))['results'];check('actionlintReal0-1-0Sweep0-0-0',[x['directToolExit'] for x in a]==[0,1,0] and [x['sweepExit'] for x in a]==[0,0,0]);a=json.load(open(E/'discipline-detached-oracle-probe.json'))['results'];check('disciplineReachedFaultSurvivesHeldSanity',[x['production']['invalid']['exit'] for x in a]==[1,0,1] and all(y['exit']==0 for x in a for y in x['heldSanity'].values()));a=json.load(open(E/'node-recorder-probe.json'));check('recorderSelectedVsFiltered',a[0]['exit']==0 and not a[0]['timeout'] and a[1]['timeout']);check('historySourceHashesEqual',all(x['equal'] for x in json.load(open(E/'history-source-reconciliation.json'))['checks']))
p=subprocess.run(['git','diff','--exit-code','HEAD','--'],cwd=R,capture_output=True,text=True);check('noTrackedBaselineEdits',p.returncode==0)
untracked=subprocess.check_output(['git','ls-files','--others','--exclude-standard'],cwd=R,text=True).splitlines();check('untrackedWithinAuthorizedDocs',all(x.startswith('docs/ci-test-effectiveness/') for x in untracked));check('stage1Under500Lines',len((D/'stage-1.md').read_text().splitlines())<500)
result={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'PASS' if not errors else 'FAIL','jsonArtifactsParsed':parsed,'checks':checks,'errors':errors,'counts':dict(collections.Counter(x['kind'] for x in rows)),'semanticScope':'This verifies dataset consistency, source identity, preserved probe results and write boundary. Independent substantive assessment review is still required; this is not a test-effectiveness certification mechanism.'};(E/'package-validation.json').write_text(json.dumps(result,indent=2)+'\n');print(result['status'],'checks',len(checks),'errors',errors[:20]);raise SystemExit(bool(errors))
