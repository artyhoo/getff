"""Bounded correction verification; dataset consistency, not semantic certification."""
import json,gzip,pathlib,subprocess,hashlib,collections
R=pathlib.Path.cwd();D=R/'docs/ci-test-effectiveness';E=D/'evidence';checks={}
def read(p):return json.load(open(D/p))
def check(n,v):checks[n]=bool(v)
rows=[json.loads(l) for l in (D/'inventory.jsonl').read_text().splitlines()];byid={r['id']:r for r in rows};a=read('invocation-assessments.json');aa={x['id']:x for x in a};crit={'relevance','effectiveness','theatre','tautology','duplication','costEffectiveness','sufficiency'}
l=read('evidence/invocation-reconciliation.json');pairs=l['pairs'];bad=[p for p in pairs if p['classification']=='nonexecuting-mention'];good=[p for p in pairs if p['classification']=='direct-command-argument']
check('293pairs289commands4nonexecuting',len(pairs)==293 and len(good)==289 and len(bad)==4)
check('allFourFalseLinksAbsent',all(p['stepId'] not in byid[p['sourceId']]['delivery']['entrypoints'] for p in bad))
check('all289ReviewedDirectLinksPresent',all(p['stepId'] in byid[p['sourceId']]['delivery']['entrypoints'] for p in good))
check('all736SourceDeliveryRecordsBound',len(l['resolvedSourceDelivery'])==736 and all(byid['test:'+p]['delivery']==v for p,v in l['resolvedSourceDelivery'].items()))
check('routeCostCopiesAgree',all(r['cost']['repeatedWork']==r['delivery']['entrypoints'] for r in rows if r['kind'] in ['test-source-or-probe','support-source']))
check('all56PackageScriptsAssessed',sum(r['kind']=='package-script' and r['id'] in aa for r in rows)==56)
check('252SpecificCarrierAssessments',len(a)==252 and len(aa)==252)
check('allReachedMembersExist',all(s in byid for x in a for s in x['reachedSourceIds']))
check('reachedFamiliesExactlyMatchSources',all(x['reachedFamilyIds']==sorted({byid[s]['familyId'] for s in x['reachedSourceIds']}) for x in a))
check('IRActualFamily',aa['entry:packages/core/package.json#test:ir']['reachedFamilyIds']==['core-ir'])
check('BackendsActualFamily',aa['entry:packages/core/package.json#test:backends']['reachedFamilyIds']==['core-backends'])
check('tscNotFixturePresence',all(x['class']=='compile' and not x['reachedSourceIds'] for x in a if x['id'].endswith('#typecheck')))
check('skillDriftActualScanner',aa['entry:package.json#check:skill-drift']['class']=='scan')
check('emptyPackagesExplicit',all(not aa['entry:packages/'+p+'/package.json#test']['reachedSourceIds'] for p in ['preset-react-native','preset-react-spa']))
# Traverse every new seven-criterion link through both layers to meaningful prose.
def resolve(s):
 for _ in range(3):
  if not isinstance(s,str) or not s.startswith(('invocation-criteria.json#/','invocation-assessments.json#/')):return s
  path,anchor=s.split('#',1);s=read(path)
  for k in anchor.strip('/').split('/'):s=s[int(k)] if isinstance(s,list) else s[k]
 return s
check('all252SevenCriteriaResolve',all(set(x['criteria'])==crit and all(isinstance(resolve(v),str) and len(resolve(v))>20 for v in x['criteria'].values()) for x in a))
check('inventoryUsesCorrectInvocationRefs',all(all(byid[x['id']]['criteria'][k]=='invocation-assessments.json#/'+str(i)+'/criteria/'+k for k in crit) for i,x in enumerate(a)))
check('allDelegatesExist',all(s in byid for x in a for s in x['delegates']))
# No saved raw probe, native identities, case archives, CI history or decisions were changed.
preserved=['decisions.jsonl','family-assessments.json','principle-assessments.json','ci-job-assessments.json']+[str(p.relative_to(D)) for p in E.iterdir() if p.is_file() and p.name not in ['index.json','package-validation.json','invocation-reconciliation.json','review-1-reconciliation-summary.json','review-1-validation.json']]
errors=[];n=0
for p in preserved:
 old=subprocess.run(['git','show','8c13d593:docs/ci-test-effectiveness/'+p],cwd=R,capture_output=True)
 if old.returncode:continue
 n+=1
 if hashlib.sha256(old.stdout).digest()!=hashlib.sha256((D/p).read_bytes()).digest():errors.append(p)
check('preservedOriginalEvidenceBytes',not errors)
check('noProductionChanges',subprocess.run(['git','diff','--quiet','8c13d593','--','.',':(exclude)docs/ci-test-effectiveness/**'],cwd=R).returncode==0)
rc={x['id']:x for x in read('root-cause-map.json')}
check('RC5RC6NamedRecurrenceAndConsumptionProposal',all(all(k in rc[n]['preventionProposal'] for k in ['existingOwners','triggerProposal','structuredFindingProposal','consumptionProposal','invocationAndDisablementProposal','boundedClaim','coordination']) for n in ['RC5','RC6']))
check('NoCompleteAcceptanceClaim',read('baseline.json')['status']=='PARTIAL_AWAITING_SCOPED_REVIEW')
result={'status':'PASS' if all(checks.values()) else 'FAIL','checks':checks,'preservedOriginalFilesCompared':n,'changedPreservedFiles':errors,'scope':'Consistency and review-targeted source/transport assertions only. No new fault experiment, suite run or semantic acceptance.','inventoryRecords':len(rows),'invocationAssessments':len(a)}
(E/'review-1-validation.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2));raise SystemExit(not all(checks.values()))
