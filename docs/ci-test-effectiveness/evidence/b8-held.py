#!/usr/bin/env python3
"""One-shot B8 evidence: actual entrypoint bypasses with fixed P37 expectations."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import yaml

root = Path(__file__).resolve().parents[3]
evidence = root / 'docs/ci-test-effectiveness/evidence'
workflow = root / '.github/workflows/workflow-integrity.yml'
helper = root / 'scripts/check-required-contexts.sh'
command = ['npx', '--prefix', 'packages/core', 'vitest', 'run', '--reporter=verbose', 'packages/core/principles/37-required-context-completeness.test.ts']
original = {p: p.read_bytes() for p in [workflow, helper]}
def sha(data):
    return hashlib.sha256(data).hexdigest()
def check(name):
    start = time.monotonic()
    result = subprocess.run(command, cwd=root, text=True, capture_output=True)
    (evidence / f'b8-{name}.txt').write_text(result.stdout + result.stderr)
    return {'status': result.returncode, 'seconds': round(time.monotonic()-start, 3)}

# Meaningful old-source RED: ordinary branch response has 3/6; admin read is denied.
old = subprocess.check_output(['git','show','f36264e2c379a72a0db36b54536b5f1dc37857b3:.github/workflows/workflow-integrity.yml'], cwd=root, text=True)
old_block = next(s['run'] for s in yaml.safe_load(old)['jobs']['branch-protection-assertion']['steps'] if 'run' in s)
# Substitute only the runner's repository expression as GitHub would, leaving old code intact.
old_block = old_block.replace('${{ github.repository }}', 'fixture/repo')
results = {}
with tempfile.TemporaryDirectory(prefix='b8-old-') as directory:
    transport = Path(directory) / 'gh'
    transport.write_text('''#!/bin/bash
case "$*" in
  'api repos/fixture/repo/branches/staging/protection') echo '{"message":"Resource not accessible by integration"}'; exit 1 ;;
  'api repos/fixture/repo/branches/staging') echo '{"name":"staging","protected":true,"protection":{"enabled":true,"required_status_checks":{"contexts":["ci-success","fidelity-verdict-in-pr-body","stale-revert-in-pr-diff"]}}}'; exit 0 ;;
  'api repos/fixture/repo/rulesets'*) echo '[]'; exit 0 ;;
  *) exit 97 ;;
esac
''')
    transport.chmod(0o755)
    env = dict(os.environ, PATH=directory + ':' + os.environ['PATH'])
    result = subprocess.run(['bash','-e','-o','pipefail','-c',old_block], cwd=root, env=env, text=True, capture_output=True)
    (evidence / 'b8-old-workflow-false-green.txt').write_text(result.stdout + result.stderr)
    results['old_actual_workflow'] = {'actualStatus': result.returncode, 'fixedExpectedMissingStatus': 1, 'falseGreenCaught': result.returncode != 1,
        'sourceCommit': 'f36264e2c379a72a0db36b54536b5f1dc37857b3', 'runBlockSha256': sha(old_block.encode()),
        'ordinaryResponse': 'protected true, known three contexts; rulesets empty; admin endpoint denied'}
try:
    source = original[workflow].decode()
    target = '          bash scripts/check-required-contexts.sh "$required_contexts"'
    assert source.count(target) == 1
    workflow.write_text(source.replace(target, '          : # held removal of actual final consumer call'))
    results['held_consumer_removed'] = check('held-consumer-removed')
    assert results['held_consumer_removed']['status'] == 1
    workflow.write_bytes(original[workflow])
    source = original[helper].decode()
    target = '''if [[ "$missing" == '[]' ]]; then'''
    assert source.count(target) == 1
    helper.write_text(source.replace(target, 'if true; then # held detector bypass'))
    results['held_detector_greenwashed'] = check('held-detector-greenwashed')
    assert results['held_detector_greenwashed']['status'] == 1
finally:
    for path, content in original.items():
        path.write_bytes(content)
results['restoration'] = {str(p.relative_to(root)): {'before': sha(data), 'after': sha(p.read_bytes()), 'identical': data == p.read_bytes()} for p,data in original.items()}
results['restored_fixed_corpus'] = check('held-restored')
assert results['restored_fixed_corpus']['status'] == 0
(evidence / 'b8-held.json').write_text(json.dumps(results, indent=2) + '\n')
print(json.dumps(results, indent=2))
