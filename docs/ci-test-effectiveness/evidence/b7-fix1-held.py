"""Bounded I1/I2/I3 re-review corpus. Fixed expectations, actual npm principles carrier.
Only a disposable checkout is mutated; this does not execute the slow native families.
"""
import hashlib, io, json, os, pathlib, shutil, subprocess, tarfile, tempfile, time
root=pathlib.Path(__file__).resolve().parents[3];out=root/'docs/ci-test-effectiveness/evidence'
subjects=['packages/core/principles/38-vitest-include-ci-coverage.test.ts','packages/core/principles/41-shell-test-ci-coverage.test.ts','packages/core/principles/ci-test-invocations.ts','.github/workflows/audit-self.yml','packages/core/package.json','packages/core/hooks/advisor-role-reminders.test.ts']
hashes=lambda:{p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in subjects}
before=hashes();results=[]
with tempfile.TemporaryDirectory(prefix='b7-fix1-held-') as temp:
    copy=pathlib.Path(temp)
    with tarfile.open(fileobj=io.BytesIO(subprocess.check_output(['git','archive','HEAD'],cwd=root))) as tar:
        tar.extractall(copy,filter='data')
    for p in subjects:shutil.copy2(root/p,copy/p)
    subprocess.run(['git','init','-q'],cwd=copy,check=True)
    subprocess.run(['git','add','-f','.'],cwd=copy,check=True,stdout=subprocess.DEVNULL)
    for p in ['node_modules','packages/core/node_modules']:
        if (root/p).exists() and not (copy/p).exists():(copy/p).symlink_to((root/p).resolve(),target_is_directory=True)
    original={p:(copy/p).read_text() for p in subjects}
    def restore():
        for p,s in original.items():(copy/p).write_text(s)
    def mutate(path,old,new):
        assert old in original[path],(path,old)
        (copy/path).write_text(original[path].replace(old,new,1))
    def run(name,expected,diagnostic=None):
        cmd=['npm','--prefix','packages/core','run','test:principles','--','-t','^Principle (38|41)','--exclude','**/principles/!(38-vitest*|41-shell*).test.ts']
        start=time.monotonic();r=subprocess.run(cmd,cwd=copy,env=dict(os.environ,PATH='/workspace/getff-tools/bin:/workspace/getff-tools/venv/bin:'+os.environ['PATH']),capture_output=True,text=True)
        log=(r.stdout+r.stderr).replace(temp,'<DISPOSABLE>');(out/('b7-fix1-held-'+name+'.txt')).write_text(log)
        result={'name':name,'command':cmd,'expectedExit':expected,'exit':r.returncode,'diagnostic':diagnostic,'accepted':((r.returncode==0)==(expected==0)) and (diagnostic is None or diagnostic in log),'seconds':round(time.monotonic()-start,3)}
        results.append(result);print(json.dumps(result),flush=True)
    run('good',0)
    wf='.github/workflows/audit-self.yml';pkg='packages/core/package.json';wrapper='packages/core/hooks/advisor-role-reminders.test.ts';helper='packages/core/principles/ci-test-invocations.ts'
    mutate(wf,'run: npm --prefix packages/core run test:hooks','run: npx --prefix packages/core vitest run --config packages/core/vitest.config.ts hooks/')
    run('I1-cross-cwd',1,'packages/core/hooks/advisor-role-reminders.test.ts');restore()
    d=json.loads(original[pkg]);d['scripts']['test:source-node']=d['scripts']['test:source-node'].replace('node --test','node /dev/null --test',1);(copy/pkg).write_text(json.dumps(d))
    run('I2-script-arguments',1,'scripts/codex-hook-compatibility.test.mjs');restore()
    mutate(wrapper,'const root =','return; const root =')
    run('I3-dead-wrapper',1,'tests/advisor-role-reminders/test_reminders.py');restore()
    text=original[helper];at=text.index('): boolean {',text.index('export function nativeCovered('))+len('): boolean {')
    (copy/helper).write_text(text[:at]+'\n  return true; // audit-only detector bypass\n'+text[at:])
    run('disabled-detector',1,'(I2) Node test options');restore()
    run('restored',0)
assert hashes()==before,'real checkout source changed'
report={'base':'bb969b66e939bbc0761e2694d9b787ed9cbae23d','boundary':'I1/I2/I3 invocation failures + native detector bypass, with fixed expected statuses and diagnostics in disposable git tree. Existing suite/parser limits remain.','results':results,'sourceHashesBefore':before,'sourceHashesAfter':hashes(),'restored':True}
(out/'b7-fix1-held.json').write_text(json.dumps(report,indent=2)+'\n')
raise SystemExit(0 if all(r['accepted'] for r in results) else 1)
