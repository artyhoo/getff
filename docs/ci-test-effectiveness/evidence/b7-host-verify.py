"""One-shot B7 host commands; stdout, return codes and wall cost retained per command."""
import json, os, pathlib, subprocess, time
root = pathlib.Path(__file__).resolve().parents[3]
out = root / 'docs/ci-test-effectiveness/evidence'
commands = [
('principles', 'npx --prefix packages/core vitest run --reporter=default packages/core/principles/36-ci-needs-completeness.test.ts packages/core/principles/37-required-context-completeness.test.ts packages/core/principles/38-vitest-include-ci-coverage.test.ts packages/core/principles/41-shell-test-ci-coverage.test.ts'),
('sweep', 'bash scripts/run-local-ci-sweep.test.sh'),
('reverse-coverage', 'bash scripts/run-local-ci-sweep-coverage.test.sh'),
('runtime-bridge', 'npm --prefix packages/runtime-bridge test'),
('next-canonical', 'npm --prefix packages/preset-next-15-canonical test'),
('source-node', 'npm --prefix packages/core run test:source-node'),
('source-python', 'npm --prefix packages/core run test:source-python'),
('advisor', 'npx --prefix packages/core vitest run --reporter=default packages/core/hooks/advisor-role-reminders.test.ts'),
('nonlinux-local-limit', "node --test --test-name-pattern='HOST-01 real:' .agents/procedures/pipeline/helpers/autonomy-binding.test.mjs"),
('actionlint', '/workspace/getff-tools/bin/actionlint .github/workflows/audit-self.yml'),
]
env = dict(os.environ, PATH='/workspace/getff-tools/bin:/workspace/getff-tools/venv/bin:' + os.environ['PATH'])
results=[]
for name, command in commands:
    start=time.monotonic()
    with (out / ('b7-host-'+name+'.txt')).open('w') as log:
        p=subprocess.run(command, shell=True, executable='/bin/bash', cwd=root, env=env, stdout=log, stderr=subprocess.STDOUT)
    result=dict(name=name, command=command, exit=p.returncode, seconds=round(time.monotonic()-start,3))
    results.append(result); print(json.dumps(result), flush=True)
    (out/'b7-host.json').write_text(json.dumps(results,indent=2)+'\n')
