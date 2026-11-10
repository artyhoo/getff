"""One-shot B2 sensitivity evidence. No mutations to audited working-tree source."""
import hashlib, json, pathlib, shutil, subprocess, tempfile, time
ROOT = pathlib.Path(__file__).resolve().parents[3]
EVIDENCE = ROOT / 'docs/ci-test-effectiveness/evidence'
MODULE = '.agents/procedures/pipeline/helpers/autonomy-binding.test.mjs'
TEST = 'packages/core/hooks/autonomy-binding-lifecycle.test.ts'

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

results = []
with tempfile.TemporaryDirectory(prefix='b2-held-') as temp:
    shadow = pathlib.Path(temp)
    shutil.copytree(ROOT / '.agents/procedures', shadow / '.agents/procedures')
    (shadow / TEST).parent.mkdir(parents=True)
    shutil.copyfile(ROOT / TEST, shadow / TEST)
    (shadow / 'node_modules').symlink_to((ROOT / 'node_modules').resolve())
    original = (shadow / MODULE).read_text()
    needle = '  await new Promise((settle, reject) => recorder.close((error) => error ? reject(error) : settle()));'
    assert original.count(needle) == 1
    held_hash = digest(shadow / TEST)
    for phase, source in [
        ('weakening', original.replace(needle, "  console.error('B2 reached disabled cleanup');")),
        ('socket-weakening', original.replace('  for (const socket of recorderSockets) socket.destroy();', "  console.error('B2 reached disabled cleanup');")),
        ('restoration', original),
    ]:
        (shadow / MODULE).write_text(source)
        command = [str(ROOT / 'node_modules/.bin/vitest'), 'run', '--root', str(shadow), '--reporter=default', TEST, '-t', 'TCP prohibition']
        start = time.monotonic()
        result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, timeout=35)
        output = result.stdout + result.stderr
        (EVIDENCE / f'b2-{phase}.txt').write_text(output)
        results.append(dict(phase=phase, command=command, exitStatus=result.returncode,
                            seconds=time.monotonic()-start, heldTestSHA256=digest(shadow / TEST),
                            sourceSHA256=digest(shadow / MODULE),
                            reachedDisabledCleanup='B2 reached disabled cleanup' in output,
                            sawTCPAssertion='no TCP connection may reach the recorder (1 did)' in output,
                            watchdogDetected='ETIMEDOUT' in output))
        assert digest(shadow / TEST) == held_hash
        if phase != 'restoration':
            assert result.returncode == 1 and results[-1]['reachedDisabledCleanup'] and results[-1]['sawTCPAssertion'] and results[-1]['watchdogDetected']
        else:
            assert result.returncode == 0
(EVIDENCE / 'b2-conformance.json').write_text(json.dumps(results, indent=2)+'\n')
print(json.dumps(results, indent=2))
