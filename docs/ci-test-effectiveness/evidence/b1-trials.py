"""One-shot B1 evidence collector; run from repository root with phase argument."""
import hashlib
import json
import os
from pathlib import Path
import statistics
import subprocess
import sys
import tempfile
import time

phase = sys.argv[1]
root = Path.cwd()
source = root / 'scripts/run-local-ci-sweep.sh'
env = dict(os.environ)
for key in ('SWEEP_GATES_FILE', 'SWEEP_HEAVY_RUNNER', 'SWEEP_ROUTABLE', 'PC_LOCAL', 'GIT_DIR', 'GIT_WORK_TREE'):
    env.pop(key, None)
env['PATH'] = '/workspace/getff-tools/bin:' + env['PATH']
row = subprocess.check_output(['bash', str(source), '--list-gates'], env=env, text=True)
rows = [line for line in row.splitlines() if line.split('\t')[1] == 'actionlint']
assert len(rows) == 1
with tempfile.TemporaryDirectory(prefix='b1-trials-') as tmp:
    repo = Path(tmp)
    (repo / 'scripts').mkdir()
    (repo / 'scripts/run-local-ci-sweep.sh').write_bytes(source.read_bytes())
    (repo / '.github/workflows').mkdir(parents=True)
    (repo / '.github/workflows/check.yml').write_text('name: B1 control\non: push\njobs:\n  check:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo valid\n')
    (repo / 'row.tsv').write_text(rows[0] + '\n')
    subprocess.run(['git', 'init', '-q', str(repo)], check=True, env=env)
    env.update(SWEEP_GATES_FILE=str(repo / 'row.tsv'), SWEEP_DIFF_OVERRIDE='.github/workflows/check.yml')
    trials = []
    for trial in range(3):
        env['SWEEP_LOG_DIR'] = str(repo / f'logs-{trial}')
        start = time.monotonic()
        result = subprocess.run(['bash', str(repo / 'scripts/run-local-ci-sweep.sh'), '--full'], env=env, text=True, capture_output=True)
        elapsed = time.monotonic() - start
        trials.append(dict(trial=trial + 1, seconds=elapsed, exitStatus=result.returncode, stdout=result.stdout.replace(tmp, '<fixture>'), stderr=result.stderr))
    data = dict(phase=phase, command='bash <fixture>/scripts/run-local-ci-sweep.sh --full', sourceSHA256=hashlib.sha256(source.read_bytes()).hexdigest(), row=rows[0], trials=trials, medianSeconds=statistics.median(t['seconds'] for t in trials))
    (root / f'docs/ci-test-effectiveness/evidence/b1-times-{phase}.json').write_text(json.dumps(data, indent=2) + '\n')
    assert all(t['exitStatus'] == 0 and '[sweep] PASS actionlint' in t['stdout'] for t in trials)
print(json.dumps(data))
