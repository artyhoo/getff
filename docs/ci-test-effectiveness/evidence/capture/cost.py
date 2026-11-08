import json,pathlib,datetime,statistics,re
D=pathlib.Path('/workspace/getff-native/docs/ci-test-effectiveness');E=D/'evidence'
def dt(s):return datetime.datetime.fromisoformat(s.replace('Z','+00:00')) if s else None
def seconds(a,b):return (dt(b)-dt(a)).total_seconds() if a and b else None
runs={str(x['databaseId']):x for x in json.load(open(E/'ci-runs.json'))};out=[]
for f in sorted(E.glob('ci-jobs-*.json')):
 try:d=json.load(open(f))
 except:continue
 runId=f.stem.removeprefix('ci-jobs-');jobs=[]
 for j in d['jobs']:
  steps=[]
  for s in j.get('steps',[]):
   n=s['name'];role='setup' if re.search(r'^(Set up|Checkout|Install|Post |Complete job)|^Run actions/|^Prepare ',n,re.I) else 'command'
   steps.append({'number':s['number'],'name':n,'status':s['status'],'conclusion':s['conclusion'],'seconds':seconds(s.get('started_at'),s.get('completed_at')),'role':role})
  jobs.append({'id':j['id'],'name':j['name'],'status':j['status'],'conclusion':j['conclusion'],'runAttempt':j.get('run_attempt'),'runnerName':j.get('runner_name'),'labels':j.get('labels'),'seconds':seconds(j.get('started_at'),j.get('completed_at')),'setupSeconds':sum(s['seconds'] or 0 for s in steps if s['role']=='setup'),'steps':steps,'start':j.get('started_at'),'end':j.get('completed_at')})
 valid=[j for j in jobs if j['start'] and j['end'] and j['status']=='completed']; duration=seconds(min(j['start'] for j in valid),max(j['end'] for j in valid)) if valid else None
 out.append({'runId':int(runId),'metadata':runs.get(runId),'jobs':jobs,'observedJobWallEnvelopeSeconds':duration,'sumJobSeconds':sum(j['seconds'] or 0 for j in valid),'queueOnlySeconds':None,'billedMinutes':None,'limits':'Job durations are runner wall time, not billed CPU or pure execution. Setup classification is name-based descriptive allocation; step timestamps are integer-second granularity. Overlapping jobs must not be summed as workflow latency. Run history samples are not3matched trials.'})
(E/'ci-cost-summary.json').write_text(json.dumps(out,indent=2)+'\n')
for run in out:
 if run['runId'] in [42372587424,42372579925,42370509577]:
  print(run['runId'],'sum minutes',round(run['sumJobSeconds']/60,2),'wall minutes',round(run['observedJobWallEnvelopeSeconds']/60,2));print([(j['name'],j['seconds']) for j in run['jobs'] if 'install-sh' in j['name'].lower()])
print('captures',len(out),'jobs',sum(len(x['jobs']) for x in out))
