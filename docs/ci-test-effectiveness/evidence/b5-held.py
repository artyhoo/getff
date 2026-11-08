#!/usr/bin/env python3
"""One-shot B5 fault replay; uses the existing harness's runner-path seam, no gate."""
import hashlib
import json
import os
from pathlib import Path
import shlex
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'docs/ci-test-effectiveness/evidence'
RUNNER = ROOT / 'packages/core/synthesizer/run-rule-tests-firing.sh'
HARNESS = ROOT / 'packages/core/synthesizer/run-rule-tests-firing.test.sh'
BASE = '960e980e9a60cc5196976339eb1d3754184c8b7b'

def sha(data):
    return hashlib.sha256(data).hexdigest()

def run(tag, command):
    start = time.monotonic()
    result = subprocess.run(command, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    elapsed = time.monotonic() - start
    (OUT / f'b5-{tag}.txt').write_bytes(result.stdout)
    return {'command': command, 'exit': result.returncode, 'elapsedSeconds': round(elapsed, 4),
            'rawRef': f'evidence/b5-{tag}.txt', 'summary': result.stdout.decode().splitlines()[-1]}

source = RUNNER.read_bytes()
corpus = HARNESS.read_bytes()
records = []
with tempfile.TemporaryDirectory(prefix='b5-held-') as scratch:
    temp = Path(scratch)
    preimage = subprocess.check_output(['git', 'show', f'{BASE}:{RUNNER.relative_to(ROOT)}'], cwd=ROOT)
    candidate = temp / 'preimage.sh'
    candidate.write_bytes(preimage)
    receipt = run('final-corpus-preimage', ['bash', str(HARNESS), str(candidate)])
    assert receipt['exit'] == 1, receipt
    records.append(receipt)
    text = source.decode()
    variants = {
        'identity-removed': ('  [[ "$version" =~ ^ast-grep[[:space:]][0-9] ]] || return 1\n', ''),
        'version-status-ignored': ('  version="$("$1" --version 2>/dev/null)" || return 1\n',
                                   '  version="$("$1" --version 2>/dev/null)"\n'),
        'scan-help-removed': ('  "$1" scan --help >/dev/null 2>&1\n', '  return 0\n'),
    }
    for tag, (old, new) in variants.items():
        assert text.count(old) == 1
        marker = temp / f'{tag}.reached'
        mutated = text.replace(old, new).replace('_sg_is_astgrep() {\n',
            '_sg_is_astgrep() {\n  printf "reached\\n" >> ' + shlex.quote(str(marker)) + '\n')
        candidate = temp / f'{tag}.sh'
        candidate.write_text(mutated)
        receipt = run('held-' + tag, ['bash', str(HARNESS), str(candidate)])
        receipt.update({'mutation': {'old': old, 'new': new}, 'mutantSHA256': sha(candidate.read_bytes()),
                        'reachedCount': len(marker.read_text().splitlines()) if marker.exists() else 0,
                        'corpusSHA256': sha(HARNESS.read_bytes())})
        assert receipt['exit'] == 1 and receipt['reachedCount'] > 0, receipt
        assert HARNESS.read_bytes() == corpus and RUNNER.read_bytes() == source
        records.append(receipt)
    restored = run('restored', ['bash', str(HARNESS)])
    assert restored['exit'] == 0, restored
    records.append(restored)
assert RUNNER.read_bytes() == source and HARNESS.read_bytes() == corpus
result = {'inputCommit': BASE, 'runnerSHA256': sha(source), 'corpusSHA256': sha(corpus),
          'preimageSHA256': sha(preimage), 'records': records,
          'restoration': 'Faults ran only in disposable actual-runner copies via existing harness argument. Tracked runner/corpus byte-equal before/after; default runner passed after all faults.',
          'boundary': 'Actual bash entrypoint plants consumer samples and parses recorded tool diagnostics. Fixtures are transport only, not real ast-grep execution; fixed literals and harness/shell behavior are trusted.',
          'recurring': False}
(OUT / 'b5-held.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
