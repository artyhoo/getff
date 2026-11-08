#!/usr/bin/env python3
"""One bounded public command/env probe, comparing exact preimage and transport repair."""
import pathlib,subprocess,tempfile,os,json,hashlib
import yaml
R=pathlib.Path(__file__).resolve().parents[3];E=R/'docs/ci-test-effectiveness/evidence';BASE='9baa971338598082e4b261703cde1d1a2989b094'
wf=yaml.safe_load(subprocess.check_output(['git','show',BASE+':.github/workflows/discipline-self-check.yml'],cwd=R))
old=wf['jobs']['verify-pr-body-sections']['steps'][0]['run']
body='### §1.7 Skipped:'+'x'*60+'\n'+'é'*58000
assert len(body)<65536 and len(body.encode())<120000
command='bash scripts/check-discipline-pr-body.sh'
rows=[]
with tempfile.TemporaryDirectory(prefix='b3-public-skip-') as tmp:
 t=pathlib.Path(tmp);(t/'scripts').mkdir();target=t/'scripts/check-discipline-pr-body.sh'
 for name,script in [('preimage',old),('here-string',(R/'scripts/check-discipline-pr-body.sh').read_text())]:
  target.write_text(script)
  p=subprocess.run(['bash','-e','-o','pipefail','-c',command],cwd=t,env={**os.environ,'PR_BODY':body},capture_output=True,text=True)
  rows.append({'phase':name,'command':command,'envBinding':'PR_BODY contains exact fixed UTF-8 body, same as recurring workflow controls','sourceSHA256':hashlib.sha256(script.encode()).hexdigest(),'exit':p.returncode,'stdout':p.stdout,'stderr':p.stderr})
result={'characters':len(body),'UTF8Bytes':len(body.encode()),'bodySHA256':hashlib.sha256(body.encode()).hexdigest(),'results':rows,'publicRED':rows[0]['exit']!=0,'interpretation':'Single supported-size public probe; no repetitions or scheduling/tool changes. If preimage passes, scanner-required transport repair has no demonstrated public runtime RED and must not claim one.'}
(E/'b3-supported-skip.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result,ensure_ascii=False,indent=2));assert rows[1]['exit']==0
