"""Bounded one-shot fault evidence; no recurring driver or TAK replacement."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time

root = Path.cwd()
source = (root / 'scripts/run-local-ci-sweep.sh').read_bytes()
tests = (root / 'scripts/run-local-ci-sweep.test.sh').read_bytes()
old_source = subprocess.check_output(['git', 'show', '35bb1a22fb1809e78408881583285a5fe470d5de:scripts/run-local-ci-sweep.sh'])
env = dict(os.environ, PATH='/workspace/getff-tools/bin:' + os.environ['PATH'])
results = []
with tempfile.TemporaryDirectory(prefix='b1-conformance-') as tmp:
    repo = Path(tmp)
    (repo / 'scripts').mkdir()
    # Existing selftest compares this helper's escape policy with the sweep.
    (repo / 'scripts/run-install-sh-suite.sh').write_bytes((root / 'scripts/run-install-sh-suite.sh').read_bytes())
    subprocess.run(['git', 'init', '-q', str(repo)], check=True)
    subprocess.run(['git', '-C', str(repo), 'config', 'user.email', 'b1@example.invalid'], check=True)
    subprocess.run(['git', '-C', str(repo), 'config', 'user.name', 'B1 fixture'], check=True)
    (repo / 'README.md').write_text('fixture\n')
    subprocess.run(['git', '-C', str(repo), 'add', 'README.md'], check=True)
    subprocess.run(['git', '-C', str(repo), 'commit', '-qm', 'fixture'], check=True)
    for label, subject, detector, expected in [
        ('weakening', old_source, tests, 1),
        ('restoration', source, tests, 0),
        ('detector-disable', old_source, tests.split(b'# --- B1:')[0] + tests.split(b'# --- end B1 controls ---')[1], 1),
    ]:
        (repo / 'scripts/run-local-ci-sweep.sh').write_bytes(subject)
        (repo / 'scripts/run-local-ci-sweep.test.sh').write_bytes(detector)
        start = time.monotonic()
        result = subprocess.run(['bash', str(repo / 'scripts/run-local-ci-sweep.test.sh')], env=env, cwd=repo, text=True, capture_output=True)
        output = (result.stdout + result.stderr).replace(tmp, '<fixture>')
        (root / f'docs/ci-test-effectiveness/evidence/b1-{label}.txt').write_text(output)
        results.append(dict(label=label, command='bash <fixture>/scripts/run-local-ci-sweep.test.sh', sourceSHA256=hashlib.sha256(subject).hexdigest(), testSHA256=hashlib.sha256(detector).hexdigest(), expectedExit=expected, actualExit=result.returncode, heldConformancePass=result.returncode == expected, elapsedSeconds=time.monotonic()-start, evidenceRef=f'b1-{label}.txt'))
    assert results[0]['actualExit'] == 1 and results[1]['actualExit'] == 0
    assert results[0]['testSHA256'] == results[1]['testSHA256']
    assert results[2]['actualExit'] == 0 and not results[2]['heldConformancePass']
(root / 'docs/ci-test-effectiveness/evidence/b1-conformance.json').write_text(json.dumps(results, indent=2) + '\n')
print(json.dumps(results, indent=2))
