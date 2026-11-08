#!/usr/bin/env python3
"""One focused full-source baseline replay; no changes to audited source or deps."""
import pathlib,subprocess,tempfile,tarfile,io,json,os,hashlib,time,sys,shutil
R=pathlib.Path(__file__).resolve().parents[3];E=R/'docs/ci-test-effectiveness/evidence';BASE='9baa971338598082e4b261703cde1d1a2989b094'
with tempfile.TemporaryDirectory(prefix='b3-baseline-') as tmp:
 t=pathlib.Path(tmp)
 archive=subprocess.check_output(['git','archive',BASE],cwd=R)
 with tarfile.open(fileobj=io.BytesIO(archive)) as tar:tar.extractall(t,filter='data')
 for rel in ['node_modules','packages/core/node_modules']:
  target=t/rel
  if not target.exists():target.symlink_to((R/rel).resolve())
 env={**os.environ,'PATH':'/workspace/getff-tools/bin:'+os.environ['PATH']}
 cases=[('consumer-layout','packages/core/hooks/pre-push.consumer-layout.test.ts','S5 NEGATIVE-guard GREEN')]
 if '--additional' in sys.argv:
  cases=[('glossary','packages/core/hooks/glossary-counters.test.ts','control: the same 10 prompts run SEQUENTIALLY also count 10'),('hydration','packages/core/hooks/worktree-setup-hydration.test.ts','POSITIVE: state.md present AS A SYMLINK|DUAL-PAIR PARITY')]
 results=[]
 for name,file,pattern in cases:
  command=[str(R/'node_modules/.bin/vitest'),'run','--root',str(t),'--reporter=default',file,'-t',pattern]
  start=time.perf_counter();p=subprocess.run(command,cwd=t,capture_output=True,text=True,env=env,timeout=90)
  out=p.stdout+p.stderr;(E/f'b3-baseline-{name}.txt').write_text(out)
  results.append({'name':name,'command':command,'exit':p.returncode,'seconds':time.perf_counter()-start,'output':f'evidence/b3-baseline-{name}.txt'})
  print(out[-4500:])
 record={'base':BASE,'sourceClosure':'entire git archive of B3 input; unchanged real source, bundle and all fixture/import files; provisioned node_modules linked read-only by usage (no install)','archiveSHA256':hashlib.sha256(archive).hexdigest(),'results':results}
 target='b3-baseline-additional.json' if '--additional' in sys.argv else 'b3-baseline-replay.json'
 (E/target).write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record,indent=2))
