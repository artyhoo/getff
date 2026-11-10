#!/usr/bin/env python3
"""Audit-only B4 map comparison and held-duration forecast; never a CI gate."""
import collections
import datetime as dt
import gzip
import hashlib
import json
from pathlib import Path
import subprocess
import time
import yaml

START = time.monotonic()
E = Path('docs/ci-test-effectiveness/evidence')
WF = '.github/workflows/audit-self.yml'
BEFORE = gzip.decompress((E / 'b4-workflow-before.yml.gz').read_bytes())
AFTER = Path(WF).read_bytes()
b, a = yaml.safe_load(BEFORE), yaml.safe_load(AFTER)
SHARDS = ['install-sh-a', 'install-sh-b', 'install-sh-c']
INSTALLS = ['framework-self-install-ts-server', 'framework-self-install-react-next']
MOVES = {'synth-wire-consumer-config': 'install-sh-a', 'first-commit-passable': 'install-sh-a',
         'r2-glob-reach': 'install-sh-c', 'r2-auto-wire': 'install-sh-c'}

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

def dump(name, obj):
    raw = (json.dumps(obj, indent=2) + '\n').encode()
    if name.endswith('.gz'):
        (E / name).write_bytes(gzip.compress(raw, mtime=0))
    else:
        (E / name).write_bytes(raw)

def jobs_without_steps(w):
    return {k: {f: v for f, v in j.items() if f != 'steps'} for k, j in w['jobs'].items()}

def suite(step):
    for s in MOVES:
        if step.get('run') == f'bash tests/install-sh/{s}.test.sh':
            return s

assert {k: v for k, v in b.items() if k != 'jobs'} == {k: v for k, v in a.items() if k != 'jobs'}
assert jobs_without_steps(b) == jobs_without_steps(a)
assert set(b['jobs']) == set(a['jobs'])
for j in b['jobs']:
    if j not in SHARDS + INSTALLS:
        assert b['jobs'][j] == a['jobs'][j], j
    elif j in INSTALLS:
        assert b['jobs'][j]['steps'][:-1] == a['jobs'][j]['steps'], j
        assert 'packages/core/audit-self/audit-ai-docs.test.ts' in b['jobs'][j]['steps'][-1]['run']
    else:
        assert [s for s in b['jobs'][j]['steps'] if not suite(s)] == [s for s in a['jobs'][j]['steps'] if not suite(s)], j
old_steps = collections.Counter(json.dumps(s, sort_keys=True) for j in SHARDS for s in b['jobs'][j]['steps'])
new_steps = collections.Counter(json.dumps(s, sort_keys=True) for j in SHARDS for s in a['jobs'][j]['steps'])
assert old_steps == new_steps
placement = []
for s, dest in MOVES.items():
    old = [(j, k, step) for j in SHARDS for k, step in enumerate(b['jobs'][j]['steps']) if suite(step) == s]
    new = [(j, k, step) for j in SHARDS for k, step in enumerate(a['jobs'][j]['steps']) if suite(step) == s]
    assert len(old) == len(new) == 1 and old[0][0] == 'install-sh-b' and new[0][0] == dest
    assert old[0][2] == new[0][2]
    # Actual destination prefix contains all four original common setup steps, byte-for-byte.
    assert b['jobs']['install-sh-b']['steps'][:4] == a['jobs'][dest]['steps'][:4]
    assert new[0][1] >= 4
    placement.append({'suite': s, 'before': old[0][0], 'after': dest, 'step': new[0][2],
                      'destinationPrerequisites': a['jobs'][dest]['steps'][:4]})
assert set(SHARDS + INSTALLS + ['probe-tests']).issubset(a['jobs']['ci-success']['needs'])
assert all(a['jobs'][j]['if'] == a['jobs']['probe-tests']['if'] for j in INSTALLS)
assert all(a['jobs'][j]['runs-on'] == a['jobs']['probe-tests']['runs-on'] for j in INSTALLS)
# Full structural maps retain event/env/defaults, commands, setup, conditions and aggregation.
dump('b4-workflow-maps.json.gz', {'before': b, 'after': a})
paths = [WF, 'vitest.config.ts', 'packages/core/vitest.config.ts', 'packages/core/vitest.setup.ts',
         'packages/core/package.json', 'packages/core/audit-self/audit-ai-docs.test.ts',
         'packages/core/audit-self/audit-ai-docs.ts'] + [f'tests/install-sh/{s}.test.sh' for s in MOVES]
identities = []
for path in paths:
    row = {'path': path, 'currentSHA256': sha(Path(path).read_bytes())}
    for rev in ['9a738611146e6e995826dde486776599e4611d55', '01b25d78b11083fb6e463fdf9de61299aff8972a', '346e3daf3255a431100c6fa2298727cca36e3bc7']:
        proc = subprocess.run(['git', 'show', f'{rev}:{path}'], capture_output=True)
        row[rev] = sha(proc.stdout) if proc.returncode == 0 else 'unavailable locally'
    identities.append(row)

def seconds(start, end):
    return (dt.datetime.fromisoformat(end.replace('Z', '+00:00')) - dt.datetime.fromisoformat(start.replace('Z', '+00:00'))).total_seconds()

forecasts = []
for run in [42372587424, 42372579925, 42489342075]:
    name = f'ci-jobs-{run}.json.gz' if run != 42489342075 else 'b4-before-42489342075-jobs-rest.json.gz'
    raw = json.loads(gzip.decompress((E / name).read_bytes()))
    jobs = {j['name']: j for j in raw['jobs']}
    before = {letter: seconds(jobs[f'install-sh battery (shard {letter})']['started_at'], jobs[f'install-sh battery (shard {letter})']['completed_at']) for letter in 'ABC'}
    projected = before.copy()
    moved = []
    for p in placement:
        matches = [step for step in jobs['install-sh battery (shard B)']['steps'] if step['name'] == p['step']['name']]
        # Earlier REST step display truncates unquoted # text at the YAML comment boundary.
        if not matches:
            matches = [step for step in jobs['install-sh battery (shard B)']['steps'] if step['name'].startswith(p['step']['name'].split(' #')[0])]
        assert len(matches) == 1, (run, p['suite'])
        step = matches[0]
        cost = seconds(step['started_at'], step['completed_at'])
        dest = p['after'][-1].upper()
        projected['B'] -= cost
        projected[dest] += cost
        moved.append({'suite': p['suite'], 'stepName': step['name'], 'seconds': cost, 'stepConclusion': step['conclusion']})
    assert sum(before.values()) == sum(projected.values())
    repeats = []
    for j in INSTALLS:
        job_name = b['jobs'][j]['name']
        step = next(s for s in jobs[job_name]['steps'] if s['name'] == b['jobs'][j]['steps'][-1]['name'])
        repeats.append({'job': j, 'seconds': seconds(step['started_at'], step['completed_at']), 'conclusion': step['conclusion']})
    forecasts.append({'runId': run, 'headSHA': next(iter(jobs.values()))['head_sha'], 'rawRef': str(E / name),
                      'observedBeforeJobSeconds': before, 'movedSteps': moved, 'forecastJobSeconds': projected,
                      'observedBeforeMaxSeconds': max(before.values()), 'forecastMaxSeconds': max(projected.values()),
                      'unchangedShardJobSecondsSum': sum(before.values()), 'removedRepeatStepSeconds': repeats,
                      'assumptions': 'Held durations only; no observed after, setup/queue/cache/network/host/order effects unmeasured; job sums are elapsed durations, not billed CPU.'})
dump('b4-timing-forecast.json', forecasts)
dump('b4-no-loss.json', {'status': 'PASS', 'beforeWorkflowSHA256': sha(BEFORE), 'afterWorkflowSHA256': sha(AFTER),
                      'unchangedOutsideFiveJobs': True, 'unchangedJobMetadataEventsAggregate': True,
                      'unchangedShardStepMultiset': True, 'placements': placement, 'sourceIdentities': identities,
                      'jointSurvivor': a['jobs']['probe-tests'],
                      'additionalWitness': 'principles-meta-tests npm --prefix packages/core run test:units uses core config; not the exact root-config survivor',
                      'limits': 'Static placement/source proof plus existing functional tests. Final hosted destination required. No claim of future economic prevention.',
                      'elapsedSeconds': time.monotonic() - START})
print(json.dumps({'status': 'PASS', 'elapsedSeconds': time.monotonic() - START, 'forecasts': forecasts}, indent=2))
