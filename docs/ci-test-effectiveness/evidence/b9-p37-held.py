"""One-shot M1 conformance on disposable actual subjects; never rewrites B8 receipts."""
import hashlib,json,pathlib,shutil,subprocess,tempfile,time
root=pathlib.Path(__file__).resolve().parents[3]
out=root/'docs/ci-test-effectiveness/evidence'
test='packages/core/principles/37-required-context-completeness.test.ts'
workflow='.github/workflows/workflow-integrity.yml';helper='scripts/check-required-contexts.sh'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
report={'sourceHashes':{p:sha(root/p) for p in [test,workflow,helper]},'runs':[]}
with tempfile.TemporaryDirectory(prefix='b9-p37-held-') as name:
 d=pathlib.Path(name)
 shutil.copytree(root/'.github/workflows',d/'.github/workflows')
 for p in [test,helper,'scripts/run-local-ci-sweep.sh','packages/core/principles/36-ci-needs-completeness.test.ts']:
  (d/p).parent.mkdir(parents=True,exist_ok=True);shutil.copy2(root/p,d/p)
 (d/'node_modules').symlink_to(root/'node_modules',target_is_directory=True)
 original={p:(d/p).read_bytes() for p in [workflow,helper]}
 def run(label,pattern,expected):
  cmd=['node',str(root/'node_modules/vitest/vitest.mjs'),'run','--reporter=verbose',test,'-t',pattern]
  start=time.monotonic();r=subprocess.run(cmd,cwd=d,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=30)
  (out/f'b9-p37-{label}.txt').write_text(r.stdout)
  report['runs'].append({'label':label,'status':r.returncode,'expected':expected,'seconds':round(time.monotonic()-start,3),'pattern':pattern})
  assert r.returncode==expected
 s=original[workflow].decode();target='          bash scripts/check-required-contexts.sh "$required_contexts"';assert s.count(target)==1
 (d/workflow).write_text(s.replace(target,'          : # actual consumer removed in disposable subject'))
 run('consumer-removed','workflow:',1)
 (d/workflow).write_bytes(original[workflow])
 s=original[helper].decode();target='if [[ "$missing" == \'[]\' ]]; then';assert s.count(target)==1
 (d/helper).write_text(s.replace(target,'if true; then # detector disabled in disposable subject'))
 run('detector-disabled','helper: known missing three|helper: active uninspected ruleset',1)
 (d/helper).write_bytes(original[helper])
 run('restored','actual live required-context CLI',0)
 report['disposableRestored']={p:sha(d/p)==hashlib.sha256(v).hexdigest() for p,v in original.items()}
report['realSourceUnchanged']={p:sha(root/p)==h for p,h in report['sourceHashes'].items()}
(out/'b9-p37-held.json').write_text(json.dumps(report,indent=2)+'\n')
