"""One-shot held fault: ordinary P20 status vs independently fixed expected 1."""
from pathlib import Path
import hashlib,json,os,subprocess,time
root=Path('/workspace/getff-native'); out=Path('/workspace/scratch')
runner=root/'packages/core/principles/20-bundle-classification.ts'
guard=root/'packages/core/principles/20-bundle-classification.test.ts'
original={p:p.read_bytes() for p in [runner,guard]}
sha=lambda b:hashlib.sha256(b).hexdigest()
frozen=root/'.superpowers/sdd/ci-test-effectiveness/p20-frozen-expectations.json'
frozen_sha=sha(frozen.read_bytes())
cmd=['npm','--prefix','packages/core','run','test','--','principles/20-bundle-classification.test.ts']
env=os.environ.copy()
for name in ['MO_SKILLS_DIR','MO_AGENTS_DIR','MO_SKILLS_GLOBAL']:env.pop(name,None)
rows=[]
def run(name,expected):
 t=time.monotonic();log=out/('b10-held-'+name+'.txt')
 with log.open('w') as f:r=subprocess.run(cmd,cwd=root,env=env,stdout=f,stderr=subprocess.STDOUT)
 # This independent expectation stays 1 even when we deliberately omit the guards.
 check=subprocess.run(['python','-c','import sys; sys.exit(0 if int(sys.argv[1]) == 1 else 1)',str(r.returncode)])
 row={'name':name,'command':cmd,'carrierExit':r.returncode,'declaredExpectedCarrierExit':expected,'fixedHeldExpectedCarrierExit':1,'fixedHeldCheckExit':check.returncode,'wallSeconds':round(time.monotonic()-t,3),'log':str(log)}
 rows.append(row);assert r.returncode==expected,row
 return log.read_text()
try:
 s=original[runner].decode();assert s.count('env: { ...process.env, ...CATALOG_ENV }')==1
 runner.write_text(s.replace('env: { ...process.env, ...CATALOG_ENV }','env: { ...process.env }'))
 text=run('catalog-wiring-dropped',1)
 for label in ['async prefetch: fixture skill assignment context lost','async prefetch: fixture agent assignment context lost','sync cache miss: fixture skill assignment context lost','sync cache miss: fixture agent assignment context lost']:
  assert label in text,label
 g=original[guard].decode();a=g.index('    // catalog-guards:start');b=g.index('    // catalog-guards:end')+len('    // catalog-guards:end\n')
 guard.write_text(g[:a]+g[b:])
 run('guards-omitted',0)
 assert rows[-1]['fixedHeldCheckExit']==1,'separate fixed expected 1 must reject omission false green'
finally:
 for p,b in original.items():p.write_bytes(b)
 assert frozen_sha==sha(frozen.read_bytes())
 assert all(sha(p.read_bytes())==sha(b) for p,b in original.items())
 receipt={'fixedExpectedCarrierExit':1,'rows':rows,'restoration':{str(p.relative_to(root)):sha(p.read_bytes()) for p in original},'frozenExpectationsSha256':frozen_sha,'sourceAndOracleRestored':True}
 (out/'b10-held.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt,indent=2))
