#!/usr/bin/env python3
"""One-shot actual-row and held reverse-coverage proof. No checkout hook writes."""
import subprocess,pathlib,tempfile,shutil,os,json
r=pathlib.Path(__file__).resolve().parents[3];e=r/'docs/ci-test-effectiveness/evidence'
table=subprocess.check_output(['bash','scripts/run-local-ci-sweep.sh','--list-gates'],cwd=r,text=True)
rows=[l for l in table.splitlines() if l.split('\t')[1]=='enforce-husky-presence'];assert len(rows)==1
with tempfile.TemporaryDirectory(prefix='b3-sweep-') as tmp:
 t=pathlib.Path(tmp);(t/'scripts').mkdir();shutil.copy2(r/'scripts/run-local-ci-sweep.sh',t/'scripts/run-local-ci-sweep.sh');shutil.copy2(r/'scripts/check-husky-presence.sh',t/'scripts/check-husky-presence.sh');shutil.copytree(r/'.husky',t/'.husky')
 subprocess.run(['git','init','-q',str(t)],check=True)
 gates=t/'gates.tsv';gates.write_text(rows[0]+'\n');result=[]
 for name,expected in [('valid',0),('missing-prepush',1)]:
  if name=='missing-prepush':(t/'.husky/pre-push').unlink()
  p=subprocess.run(['bash',str(t/'scripts/run-local-ci-sweep.sh'),'--full'],cwd=t,env={**os.environ,'SWEEP_GATES_FILE':str(gates),'SWEEP_DIFF_OVERRIDE':'.husky/pre-push','SWEEP_LOG_DIR':str(t/f'logs-{name}')},capture_output=True,text=True)
  (e/f'b3-sweep-{name}.txt').write_text(p.stdout+p.stderr);assert p.returncode==expected,p.stdout+p.stderr
  assert ('PASS enforce-husky-presence' if expected==0 else 'FAIL enforce-husky-presence') in p.stdout
  result.append({'name':name,'exit':p.returncode,'command':'SWEEP_GATES_FILE=<actual held row> SWEEP_DIFF_OVERRIDE=.husky/pre-push bash <disposable sweep> --full'})
 gates.write_text('\n'.join(l for l in table.splitlines() if l not in rows)+'\n')
 p=subprocess.run(['bash','scripts/run-local-ci-sweep-coverage.test.sh'],cwd=r,env={**os.environ,'SWEEP_GATES_FILE':str(gates)},capture_output=True,text=True)
 (e/'b3-sweep-row-weakening.txt').write_text(p.stdout+p.stderr)
 assert p.returncode==1 and 'check-husky-presence.sh' in p.stdout,p.stdout+p.stderr
 result.append({'name':'row-removal','exit':p.returncode,'command':'SWEEP_GATES_FILE=<actual table with husky row removed> bash scripts/run-local-ci-sweep-coverage.test.sh','intendedDiagnostic':'scripts/check-husky-presence.sh uncovered'})
(e/'b3-sweep.json').write_text(json.dumps({'actualRow':rows[0],'results':result},indent=2)+'\n');print(json.dumps(result,indent=2))
