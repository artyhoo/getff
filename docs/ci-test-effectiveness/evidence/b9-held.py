"""One-shot evidence driver: fixed recurring expectations, production mutations only.
Not a semantic reviewer, future test runner, or independent assurance platform.
"""
import hashlib, json, os, pathlib, subprocess, time, sys
root = pathlib.Path(__file__).resolve().parents[3]
os.chdir(root)
evidence = root / 'docs/ci-test-effectiveness/evidence'
prefix = sys.argv[1] if len(sys.argv) > 1 else 'b9-held'
source = 'packages/core/hooks/checks/pr-body-fidelity.ts'
binpath = 'packages/core/hooks/checks/pr-body-fidelity-bin.ts'
workflow = '.github/workflows/pr-body-fidelity.yml'
test = 'packages/core/hooks/checks/pr-body-fidelity-bin.test.ts'
paths = [source, binpath, workflow]
original = {p: pathlib.Path(p).read_bytes() for p in paths}
sha = lambda data: hashlib.sha256(data).hexdigest()
base = '4ad4540fee94c23e063b1982a2511baeb2a58d23'
report = {'base': base, 'before': {p: sha(data) for p, data in original.items()}, 'expectations': {test: sha(pathlib.Path(test).read_bytes())}, 'runs': []}

def restore():
    for p, data in original.items(): pathlib.Path(p).write_bytes(data)

def run(name, selector=None, expected=1):
    cmd = ['npx', '--prefix', 'packages/core', 'vitest', 'run', '--reporter=verbose', test]
    if selector: cmd += ['-t', selector]
    start = time.monotonic()
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=90)
    log = evidence / (prefix + '-' + name + '.txt'); log.write_text(result.stdout)
    report['runs'].append({'name': name, 'command': cmd, 'status': result.returncode, 'expected': expected, 'seconds': round(time.monotonic()-start,3), 'log': str(log.relative_to(root)), 'subjectHashes': {p:sha(pathlib.Path(p).read_bytes()) for p in paths}})
    if result.returncode != expected: raise RuntimeError(name + ' unexpected status')
try:
    for p in paths:
        pathlib.Path(p).write_bytes(subprocess.check_output(['git', 'show', base+':'+p]))
    run('causal-preimages')
    restore()
    s = original[source].decode().replace('return paths.some((path) =>', 'return false && paths.some((path) =>')
    pathlib.Path(source).write_text(s)
    run('trigger-disabled', 'requires a record|actual diff trigger')
    restore()
    s = original[source].decode().replace('require(value.base === binding.baseSha,', 'require(true,').replace("require(value.head === headSha && /^[0-9a-f]{40}$/.test(headSha),", 'require(true,')
    pathlib.Path(source).write_text(s)
    run('binding-disabled', 'stale base|stale full head')
    restore()
    s = original[source].decode().replace("['fixed', 'retained-with-evidence', 'owner-accepted-deferral']", "['fixed', 'retained-with-evidence', 'owner-accepted-deferral', 'unresolved']").replace('require(text(finding.ownerAcceptance),', 'require(true,')
    pathlib.Path(source).write_text(s)
    run('disposition-disabled', 'unresolved material|unaccepted deferral')
    restore()
    s = original[workflow].decode().replace('run: npx --prefix packages/core tsx packages/core/hooks/checks/pr-body-fidelity-bin.ts', 'run: true')
    # YAML boolean would test parser shape, not deleted invocation: quote the shell no-op.
    s = s.replace('run: true', "run: 'true'")
    pathlib.Path(workflow).write_text(s)
    run('invocation-disabled', 'executes the actual run block')
finally:
    restore()
    report['after'] = {p: sha(pathlib.Path(p).read_bytes()) for p in paths}
    report['restored'] = report['after'] == report['before']
    report['expectationsUnchanged'] = report['expectations'][test] == sha(pathlib.Path(test).read_bytes())
    (evidence/(prefix+'.json')).write_text(json.dumps(report,indent=2)+'\n')
run('restored', expected=0)
(evidence/(prefix+'.json')).write_text(json.dumps(report,indent=2)+'\n')
