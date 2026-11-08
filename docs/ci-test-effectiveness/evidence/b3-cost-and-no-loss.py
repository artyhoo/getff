#!/usr/bin/env python3
"""One-shot matched fixture timings and byte/contract closure, not hosted benchmarking."""
import hashlib,json,pathlib,statistics,subprocess,time,stat,yaml,sys
ROOT=pathlib.Path(__file__).resolve().parents[3]
E=ROOT/'docs/ci-test-effectiveness/evidence'; BASE='9baa971338598082e4b261703cde1d1a2989b094'
def old(p):return subprocess.check_output(['git','show',f'{BASE}:{p}'],cwd=ROOT).decode()
def sha(b):return hashlib.sha256(b).hexdigest()
def hooks():return {str(p.relative_to(ROOT)):{'sha256':sha(p.read_bytes()),'mode':oct(stat.S_IMODE(p.stat().st_mode))} for p in sorted((ROOT/'.husky').rglob('*')) if p.is_file()}
oldwf=yaml.safe_load(old('.github/workflows/discipline-self-check.yml')); newwf=yaml.safe_load((ROOT/'.github/workflows/discipline-self-check.yml').read_text())
oldjob=oldwf['jobs']['verify-pr-body-sections'];newjob=newwf['jobs']['verify-pr-body-sections']
oldbody=oldjob['steps'][0]['run'];newbody=(ROOT/'scripts/check-discipline-pr-body.sh').read_text().split('\n',2)[2]
old_skip = "if echo \"$PR_BODY\" | grep -qE '^### §1\\.7 Skipped:.{60,}'; then"
new_skip = "if grep -qE '^### §1\\.7 Skipped:.{60,}' <<<\"$PR_BODY\"; then"
assert newbody.count(new_skip)==1
assert oldbody.rstrip()==newbody.replace(new_skip,old_skip).rstrip(), 'discipline changed beyond disclosed Skip transport repair'
assert oldwf[True]==newwf[True] # PyYAML YAML1.1 `on`; js-yaml recurring binding uses YAML1.2
for key in ['name','if','runs-on']: assert oldjob[key]==newjob[key]
assert oldjob['steps'][0]['env']==newjob['steps'][1]['env']
assert list(newwf['jobs'])==['verify-pr-body-sections']
olda=yaml.safe_load(old('.github/workflows/audit-self.yml'));newa=yaml.safe_load((ROOT/'.github/workflows/audit-self.yml').read_text())
ojob=olda['jobs'].pop('enforce-husky-presence');njob=newa['jobs'].pop('enforce-husky-presence'); assert olda==newa
ob=ojob['steps'][-1].pop('run');nb=njob['steps'][-1].pop('run');assert ojob==njob
husky=(ROOT/'scripts/check-husky-presence.sh').read_text().split('HOOK_DIR="${1:-.husky}"\n',1)[1].replace('for hook in "$HOOK_DIR/pre-commit" "$HOOK_DIR/pre-push"; do','for hook in .husky/pre-commit .husky/pre-push; do')
assert ob.rstrip()==husky.rstrip(), 'husky predicate changed'
assert hooks()==json.loads((E/'b3-freeze.json').read_text())['hooks']
fixtures=json.loads((E/'discipline-detached-oracle-probe.json').read_text())['fixtures']
import os
if '--closure-only' in sys.argv:
 trials=json.loads((E/'b3-cost-and-no-loss.json').read_text())['localMatchedTrials']
else:
 trials={}
 for label,command in [('before-inline',oldbody),('after-script',newjob['steps'][1]['run'])]:
  values=[]
  for trial in range(3):
   start=time.perf_counter()
   for name,body in fixtures.items():
    p=subprocess.run(['bash','-e','-o','pipefail','-c',command],cwd=ROOT,env={**os.environ,'PR_BODY':body},capture_output=True,text=True)
    assert p.returncode=={'valid':0,'invalid':1}[name],p.stdout+p.stderr
   values.append(time.perf_counter()-start)
  trials[label]={'seconds':values,'medianSeconds':statistics.median(values)}
 values=[]
 for trial in range(3):
  start=time.perf_counter();p=subprocess.run(['npx','--prefix','packages/core','vitest','run','--reporter=default','packages/core/hooks/ci-checker-oracles.test.ts'],cwd=ROOT,capture_output=True,text=True)
  (E/f'b3-cost-core-{trial+1}.txt').write_text(p.stdout+p.stderr);assert p.returncode==0
  values.append(time.perf_counter()-start)
 trials['new-recurring-core-file']={'seconds':values,'medianSeconds':statistics.median(values),'includes':'npx/vitest startup plus16 pre-transport controls; final17th transport control separately measured in final focused output; existing hosted test:hooks shares setup, so this standalone wall time is not marginal hosted overhead'}
jobs=json.loads((E/'ci-jobs-42488550999.json').read_text())
if isinstance(jobs,dict):jobs=jobs['jobs']
from datetime import datetime
historical=[]
for j in jobs:
 if j['name'].startswith('Sanity'):
  seconds=(datetime.fromisoformat(j['completed_at'])-datetime.fromisoformat(j['started_at'])).total_seconds()
  historical.append({k:j[k] for k in ['id','name','head_sha','started_at','completed_at','html_url'] }|{'elapsedSeconds':seconds})
result={'base':BASE,'disciplinePredicateExactExceptSkipTransport':True,'skipTransportException':'Same regex; echo-pipe-grep-q becomes here-string as required by normal commit scanner. One supported public UTF-8 probe passes both preimage and repair; no public runtime RED claimed. Sourced195KB rejection is non-public diagnostic only. Other bytes compare exactly.','disciplineBodySHA256':sha(oldbody.rstrip().encode()),'huskyPredicateExactAfterDirectoryParameterization':True,'allOtherAuditJobsAndEventsExact':True,'requiredNameGuardEventsPreserved':True,'combinedSanityRemovals':'Both removed; surviving16 core controls and safe9-case husky fixtures execute actual helpers. Existing s17 commit gate and required completeness/aggregation tests unchanged.','hooksAfter':hooks(),'hooksUnchanged':True,'localMatchedTrials':trials,'removedHostedJobs':historical,'historicalSource':'evidence/ci-jobs-42488550999.json','costLimits':'One historical workflow/run (2+4 elapsed runner seconds), not measured after-CI saving; discipline adds checkout in surviving job. No queue/cold-cache/billing/net speedup claim. New host fixtures add meaningful repair overhead. Post-integration hosted data pending.'}
(E/'b3-cost-and-no-loss.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result,ensure_ascii=False,indent=2))
