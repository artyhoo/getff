import json,pathlib,subprocess,concurrent.futures
E=pathlib.Path('/workspace/getff-native/docs/ci-test-effectiveness/evidence');runs=json.load(open(E/'ci-runs.json'));chosen={}
for r in runs:
 if r['status']=='completed' and r['workflowName'] not in chosen:chosen[r['workflowName']]=r
chosen['audit-self-failure']=next(r for r in runs if r['workflowName']=='audit-self' and r['conclusion']=='failure')
def fetch(pair):
 name,r=pair;f=E/f"ci-jobs-{r['databaseId']}.json"
 if f.exists() and f.stat().st_size:return name,'reused'
 p=subprocess.run(['gh','api',f"repos/artyhoo/getff/actions/runs/{r['databaseId']}/jobs",'--paginate'],text=True,capture_output=True);f.write_text(p.stdout);(E/f"ci-jobs-{r['databaseId']}.error").write_text(p.stderr);return name,p.returncode
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:print(list(ex.map(fetch,chosen.items())))
