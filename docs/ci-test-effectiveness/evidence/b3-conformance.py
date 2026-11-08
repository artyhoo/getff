#!/usr/bin/env python3
"""One-shot B3 evidence, not a recurring framework or TAK replacement."""
import hashlib, json, pathlib, subprocess, sys, tempfile, time
import yaml
ROOT = pathlib.Path(__file__).resolve().parents[3]
BASE = '9baa971338598082e4b261703cde1d1a2989b094'
E = ROOT / 'docs/ci-test-effectiveness/evidence'
def run(command, cwd=ROOT, body=''):
    import os
    start=time.perf_counter()
    p=subprocess.run(['bash','-e','-o','pipefail','-c',command],cwd=cwd,env={**os.environ,'PR_BODY':body},capture_output=True,text=True,timeout=40)
    return {'command':command,'exit':p.returncode,'stdout':p.stdout,'stderr':p.stderr,'seconds':time.perf_counter()-start}
def digest(data): return hashlib.sha256(data).hexdigest()
def old(path): return subprocess.check_output(['git','show',f'{BASE}:{path}'],cwd=ROOT)
if '--preimage' in sys.argv:
    wf=yaml.safe_load(old('.github/workflows/discipline-self-check.yml'))
    fixtures=json.loads((E/'discipline-detached-oracle-probe.json').read_text())['fixtures']
    command=wf['jobs']['verify-pr-body-sections']['steps'][0]['run']
    ordinary={k:run(command,body=v) for k,v in fixtures.items()}
    # Reached actual production fault; the held old carrier has no path to it.
    wf['jobs']['verify-pr-body-sections']['steps'][0]['run']='echo B3_REACHED_PRODUCTION_BYPASS; exit 0'
    bypass=run(wf['jobs']['verify-pr-body-sections']['steps'][0]['run'],body=fixtures['invalid'])
    held={k:run(v['steps'][0]['run']) for k,v in wf['jobs'].items() if k.startswith('sanity-')}
    result={'phase':'preimage-RED','base':BASE,'ordinary':ordinary,'productionBypass':bypass,'heldSanity':held,'fixedExpectedCarrierStatus':'nonzero under production bypass','observedCarrierStatus':0}
    (E/'b3-red.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    assert ordinary['invalid']['exit']==1 and ordinary['valid']['exit']==0
    assert bypass['exit']==0 and 'B3_REACHED_PRODUCTION_BYPASS' in bypass['stdout']
    assert all(v['exit'] != 0 for v in held.values()), 'RED: production bypass reached; both claimed conformance carriers falsely return0'
else:
    import shutil
    test='packages/core/hooks/ci-checker-oracles.test.ts'
    files=[test, '.github/workflows/discipline-self-check.yml', '.github/workflows/audit-self.yml',
           'scripts/check-discipline-pr-body.sh','scripts/check-husky-presence.sh',
           'tests/hooks/test-enforce-husky-presence.sh','vitest.config.ts',
           'packages/core/vitest.setup.ts','packages/core/vitest.host-env.ts',
           'packages/core/audit-self/hooks-tree-guard.ts']
    results=[]
    with tempfile.TemporaryDirectory(prefix='b3-held-') as tmp:
        shadow=pathlib.Path(tmp)
        for f in files:
            target=shadow/f; target.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(ROOT/f,target)
        shutil.copytree(ROOT/'.husky',shadow/'.husky')
        (shadow/'node_modules').symlink_to((ROOT/'node_modules').resolve())
        originals={f:(shadow/f).read_bytes() for f in files}
        held=digest(originals[test])
        command=[str(ROOT/'node_modules/.bin/vitest'),'run','--root',str(shadow),'--reporter=default',test]
        first_hook_trace=shadow/'first-hook.trace'
        first_hook_needle=b'  test -x "$hook" || '
        assert originals['scripts/check-husky-presence.sh'].count(first_hook_needle)==1
        first_hook_bypass=(
            b'  if [ "${hook##*/}" = pre-commit ]; then\n'
            + f"    echo B3_REACHED_FIRST_HOOK_SHAPE_BYPASS >> '{first_hook_trace}'\n".encode()
            + b'    continue\n  fi\n'
        )
        first_hook_fault=originals['scripts/check-husky-presence.sh'].replace(first_hook_needle,first_hook_bypass+first_hook_needle)
        faults=[
          ('discipline-checker','scripts/check-discipline-pr-body.sh',b'#!/usr/bin/env bash\necho B3_REACHED_CHECKER_BYPASS\nexit 0\n','B3_REACHED_CHECKER_BYPASS'),
          ('discipline-invocation','.github/workflows/discipline-self-check.yml',originals['.github/workflows/discipline-self-check.yml'].replace(b'run: bash scripts/check-discipline-pr-body.sh',b'run: echo B3_REACHED_INVOCATION_BYPASS; exit 0'),'B3_REACHED_INVOCATION_BYPASS'),
          ('husky-checker','scripts/check-husky-presence.sh',b'#!/usr/bin/env bash\necho B3_REACHED_HUSKY_BYPASS\nexit 0\n','B3_REACHED_HUSKY_BYPASS'),
          ('husky-first-hook-shape','scripts/check-husky-presence.sh',first_hook_fault,'B3_REACHED_FIRST_HOOK_SHAPE_BYPASS'),
          ('husky-invocation','.github/workflows/audit-self.yml',originals['.github/workflows/audit-self.yml'].replace(b'run: bash scripts/check-husky-presence.sh',b'run: echo B3_REACHED_HUSKY_INVOCATION; exit 0'),'B3_REACHED_HUSKY_INVOCATION'),
          ('manual-carrier','tests/hooks/test-enforce-husky-presence.sh',b'#!/usr/bin/env bash\necho B3_REACHED_MANUAL_BYPASS\nexit 0\n','B3_REACHED_MANUAL_BYPASS'),
          ('restoration',None,None,None),
        ]
        if '--first-hook-only' in sys.argv:
            faults=[fault for fault in faults if fault[0] in ('husky-first-hook-shape','restoration')]
        for phase,path,content,marker in faults:
            first_hook_trace.unlink(missing_ok=True)
            for f,b in originals.items(): (shadow/f).write_bytes(b)
            if path: (shadow/path).write_bytes(content)
            start=time.perf_counter()
            p=subprocess.run(command,cwd=ROOT,capture_output=True,text=True,timeout=40)
            output=p.stdout+p.stderr
            (E/f'b3-held-{phase}.txt').write_text(output)
            row={'phase':phase,'command':command,'exit':p.returncode,'seconds':time.perf_counter()-start,
                 'heldTestSHA256':digest((shadow/test).read_bytes()),'faultSourceSHA256':digest(content) if content else None,
                 'reachedMarker':marker,'markerObserved':(marker in output or (first_hook_trace.exists() and marker in first_hook_trace.read_text())) if marker else None,
                 'firstHookTrace':first_hook_trace.read_text() if first_hook_trace.exists() else None,
                 'heldManualSHA256':digest((shadow/'tests/hooks/test-enforce-husky-presence.sh').read_bytes())}
            results.append(row)
            assert row['heldTestSHA256']==held
            if phase=='restoration': assert p.returncode==0, output
            else:
                if phase=='husky-first-hook-shape' and '--first-hook-only' in sys.argv and p.returncode!=1:
                    (E/'b3-fix-1-red.json').write_text(json.dumps(row,indent=2)+'\n')
                assert p.returncode==1 and row['markerObserved'], output
                assert 'AssertionError' in output and 'ENOENT' not in output, output
                if phase=='husky-first-hook-shape':
                    assert 'FAIL: non-executable pre-commit expected status 1' in output, output
                    assert '/nonexec-pre-commit/pre-commit not executable' in output and '(got 0)' in output, output
        assert all((shadow/f).read_bytes()==originals[f] for f in files)
    (E/'b3-held.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(results,ensure_ascii=False,indent=2))
