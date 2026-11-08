"""Audit-only bounded B7 corpus; actual recurring npm carrier, disposable checkout.
This is not the pending TAK driver. Fixed expectations stay outside modified subjects.
"""
import hashlib, io, json, os, pathlib, shutil, subprocess, sys, tarfile, tempfile, time
root=pathlib.Path(__file__).resolve().parents[3];out=root/'docs/ci-test-effectiveness/evidence'
subjects=['.github/workflows/audit-self.yml','packages/core/package.json','packages/core/principles/38-vitest-include-ci-coverage.test.ts','packages/core/principles/41-shell-test-ci-coverage.test.ts','packages/core/principles/ci-test-invocations.ts','packages/core/hooks/advisor-role-reminders.test.ts']
hashes=lambda:{p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in subjects}
before=hashes();results=[]
with tempfile.TemporaryDirectory(prefix='b7-held-') as temp:
    copy=pathlib.Path(temp)
    archive=subprocess.check_output(['git','archive','HEAD'],cwd=root)
    with tarfile.open(fileobj=io.BytesIO(archive)) as tar:tar.extractall(copy,filter='data')
    for p in subjects:shutil.copy2(root/p,copy/p)
    subprocess.run(['git','init','-q'],cwd=copy,check=True)
    subprocess.run(['git','add','-f','.'],cwd=copy,check=True,stdout=subprocess.DEVNULL)
    for p in ['node_modules','packages/core/node_modules','packages/runtime-bridge/node_modules','packages/preset-next-15-canonical/node_modules']:
        if (root/p).exists() and not (copy/p).exists():(copy/p).symlink_to((root/p).resolve(),target_is_directory=True)
    original={p:(copy/p).read_text() for p in subjects}
    def restore():
        for p,s in original.items():(copy/p).write_text(s)
        extra=copy/'packages/b7-unwired'
        if extra.exists():shutil.rmtree(extra)
        subprocess.run(['git','add','-u'],cwd=copy,check=True,stdout=subprocess.DEVNULL)
    def run(name,expected,diagnostic=None):
        if '--followup' in sys.argv and name not in {'missing-script-target','new-population','disabled-detector','restored'}: return True
        command=['npm','--prefix','packages/core','run','test:principles','--','-t','^Principle (38|41)','--exclude','**/principles/!(38-vitest*|41-shell*).test.ts']
        start=time.monotonic();r=subprocess.run(command,cwd=copy,env=dict(os.environ,PATH='/workspace/getff-tools/bin:/workspace/getff-tools/venv/bin:'+os.environ['PATH']),capture_output=True,text=True)
        log=r.stdout+r.stderr;(out/('b7-held-'+name+'.txt')).write_text(log.replace(temp,'<DISPOSABLE>'))
        passed=(r.returncode==0)==(expected==0) and (diagnostic is None or diagnostic in log)
        results.append(dict(name=name,command=' '.join(command),expectedExit=expected,exit=r.returncode,expectedDiagnostic=diagnostic,accepted=passed,seconds=round(time.monotonic()-start,3)))
        print(json.dumps(results[-1]),flush=True)
        return passed
    run('good',0)
    wf='.github/workflows/audit-self.yml';pkg='packages/core/package.json';native='npm --prefix packages/core run test:source-node'
    for name, replacement in [('removed','true'),('printed','echo '+native),('dead','false && '+native),('misleading','echo scripts/codex-hook-compatibility.test.mjs.backup')]:
        restore();(copy/wf).write_text(original[wf].replace('run: '+native,'run: '+replacement))
        run(name,1,'scripts/codex-hook-compatibility.test.mjs')
    restore();d=json.loads(original[pkg]);d['scripts']['test:source-node']=d['scripts']['test:source-node'].replace('scripts/codex-hook-compatibility.test.mjs', '');(copy/pkg).write_text(json.dumps(d))
    run('missing-script-target',1,'scripts/codex-hook-compatibility.test.mjs')
    restore();d=json.loads(original[pkg]);d['scripts'].pop('test:source-python');(copy/pkg).write_text(json.dumps(d))
    run('missing-script',1,'.agents/roles/dual-channel-drift-auditor/test_overlap.py')
    restore();(copy/wf).write_text(original[wf].replace('run: npm --prefix packages/runtime-bridge test','run: true'))
    run('missing-sibling',1,'packages/runtime-bridge/test/')
    restore();(copy/wf).write_text(original[wf].replace('run: '+native,'run: env CI=1 npm --prefix "./packages/core" run test:source-node'))
    run('quoted-env-variant',0)
    restore();extra=copy/'packages/b7-unwired/test/zzz-b7-unwired.test.ts';extra.parent.mkdir(parents=True)
    extra.write_text("import {it} from 'vitest'; it('new source',()=>{});\n")
    (extra.parent.parent/'vitest.config.ts').write_text("export default {test: {include: ['test/**/*.test.ts']}};\n")
    subprocess.run(['git','add','-f',str(extra.parent.parent)],cwd=copy,check=True)
    run('new-population',1,'zzz-b7-unwired.test.ts')
    restore()
    # Detector bypass must be rejected by the unchanged recurring corpus (not a copied parser).
    helper='packages/core/principles/ci-test-invocations.ts';text=original[helper];needle='export function nativeCovered('
    at=text.index('): boolean {',text.index(needle))+len('): boolean {')
    (copy/helper).write_text(text[:at]+'\n  return true; // audit-only detector bypass\n'+text[at:])
    run('disabled-detector',1,'fixed command corpus')
    restore();run('restored',0)
assert hashes()==before,'real checkout source changed during disposable probes'
report={'boundary':'Finite fixed external expectations against the actual ordinary npm principles carrier, disposable git population. No TAK runtime claim.','results':results,'sourceHashesBefore':before,'sourceHashesAfter':hashes(),'restored':True}
(out/('b7-held-population-followup.json' if '--followup' in sys.argv else 'b7-held.json')).write_text(json.dumps(report,indent=2)+'\n')
raise SystemExit(0 if all(r['accepted'] for r in results) else 1)
