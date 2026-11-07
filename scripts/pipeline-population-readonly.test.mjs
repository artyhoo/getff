import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
const helpers = resolve(process.env.PIPELINE_TEST_HELPERS || '.agents/procedures/pipeline/helpers');
const root = mkdtempSync(join(tmpdir(), 'pipeline population with spaces '));
const nested = join(root, 'nested directory'); mkdirSync(nested);
const orch = join(root, '.ai-factory/orchestrator-prompts');
mkdirSync(join(orch, 'mutation-discipline-umbrella'), { recursive: true });
writeFileSync(join(orch, 'mutation-discipline-umbrella/kickoff.md'), '# Kickoff\n\n## Scope\n- supersedes #205\n');
mkdirSync(join(orch, 'unrelated-widget'), { recursive: true });
writeFileSync(join(orch, 'unrelated-widget/kickoff.md'), '# Kickoff\n\n## Scope\n- unrelated widget\n');
const patch = 'docs/meta-factory/research-patches/mutation-discipline-audit.md';
mkdirSync(join(root, 'docs/meta-factory/research-patches'), { recursive: true });
writeFileSync(join(root, patch), '# Mutation discipline audit\n');
const gh = join(root, 'gh-fixture');
writeFileSync(gh, '#!/bin/bash\nexec /bin/cat "$MO_POPULATION_FILE"\n', { mode: 0o755 });
const git = (...args) => spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
assert.equal(git('init', '-q').status, 0);
assert.equal(git('add', patch).status, 0);
assert.equal(git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'fixture deliverable').status, 0);
let serial = 0;
function run(name, candidate, population, extra = {}) {
  const file = join(root, `population ${++serial}.json`);
  writeFileSync(file, typeof population === 'string' ? population : JSON.stringify(population));
  const argv = ['/bin/bash', join(helpers, name), candidate];
  const readonly = process.platform === 'darwin';
  return spawnSync(readonly ? '/usr/bin/sandbox-exec' : argv.shift(), readonly ? ['-p', '(version 1)(allow default)(deny file-write*)(allow file-write* (literal "/dev/null"))', ...argv] : argv, { cwd: nested, env: { ...process.env, REPO_ROOT: root, MO_ORCH_HOME: orch, MO_GH_BIN: gh, MO_POPULATION_FILE: file, MO_BASE_REF: 'HEAD', MO_DELIVERABLE_REF: 'HEAD', ...extra }, encoding: 'utf8' });
}
process.on('exit', () => rmSync(root, { recursive: true, force: true }));
const prs = (count) => Array.from({ length: count }, (_, i) => ({ number: i + 1, title: `Unrelated change ${i}`, headRefName: `feat/unrelated-${i}` }));
test('inflight unsaturated complete population permits scoped CLEAR, saturation blocks absence', () => {
  let r = run('inflight-check.sh', 'unmatched-candidate', prs(99));
  assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /CLEAR:/);
  r = run('inflight-check.sh', 'unmatched-candidate', prs(100));
  assert.equal(r.status, 1, r.stderr); assert.match(r.stdout, /UNKNOWN:.*limit 100/); assert.doesNotMatch(r.stdout, /CLEAR:/);
});
test('saturated inflight keeps supplied positive observations but remains incomplete', () => {
  const population = prs(100); population[0].headRefName = 'feat/mutation-discipline-umbrella';
  const r = run('inflight-check.sh', 'mutation-discipline-umbrella', population);
  assert.equal(r.status, 1, r.stderr); assert.match(r.stdout, /INFLIGHT:.*open PR #1/); assert.match(r.stdout, /UNKNOWN:/); assert.doesNotMatch(r.stdout, /CLEAR:/);
});
test('dup complete unsaturated population permits scoped OK; saturation never permits absence', () => {
  let r = run('dup-detect.sh', 'unrelated-widget', prs(49));
  assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /OK:/);
  r = run('dup-detect.sh', 'unrelated-widget', prs(50));
  assert.equal(r.status, 1, r.stderr); assert.match(r.stdout, /UNKNOWN:.*limit 50/); assert.doesNotMatch(r.stdout, /OK:/);
});
test('dup saturated population retains supplied xref and actual committed deliverable evidence', () => {
  const population = prs(50); population[0].number = 205;
  const r = run('dup-detect.sh', 'mutation-discipline-umbrella', population);
  assert.equal(r.status, 1, r.stderr); assert.match(r.stdout, /basis=xref/); assert.match(r.stdout, /basis=deliverable-on-staging/); assert.match(r.stdout, /UNKNOWN:/); assert.doesNotMatch(r.stdout, /OK:/);
});
test('dup unavailable or invalid PR population rejects absence while deliverable evidence survives', () => {
  for (const [population, extra] of [['[]', { MO_GH_BIN: '/usr/bin/false' }], ['', {}], ['{bad', {}], [{}, {}], [[{ number: 205 }], {}]]) {
    let r = run('dup-detect.sh', 'unrelated-widget', population, extra);
    assert.equal(r.status, 1, r.stderr); assert.match(r.stdout, /UNKNOWN:/); assert.doesNotMatch(r.stdout, /OK:/);
    r = run('dup-detect.sh', 'mutation-discipline-umbrella', population, extra);
    assert.equal(r.status, 1, r.stderr); assert.match(r.stdout, /basis=deliverable-on-staging/); assert.match(r.stdout, /UNKNOWN:/); assert.doesNotMatch(r.stdout, /OK:/);
  }
});
test('failed git tree query cannot emit absence; supplied PR positive remains', () => {
  let r = run('dup-detect.sh', 'unrelated-widget', [], { MO_DELIVERABLE_REF: 'missing-fixture-ref' });
  assert.equal(r.status, 1, r.stderr); assert.match(r.stdout, /UNKNOWN:.*deliverable tree/); assert.doesNotMatch(r.stdout, /OK:/);
  r = run('dup-detect.sh', 'mutation-discipline-umbrella', [{ number: 205, title: 'Independent title' }], { MO_DELIVERABLE_REF: 'missing-fixture-ref' });
  assert.equal(r.status, 1, r.stderr); assert.match(r.stdout, /basis=xref/); assert.match(r.stdout, /UNKNOWN:/);
});

test('both populations reject multiple JSON roots rather than accepting a final valid array', () => {
  for (const name of ['inflight-check.sh', 'dup-detect.sh']) {
    for (const population of ['{}\n[]', '[]\n[]', '[]\n{}', '']) {
      const r = run(name, 'unrelated-widget', population);
      assert.equal(r.status, 1, r.stderr); assert.match(r.stdout, /UNKNOWN:/); assert.doesNotMatch(r.stdout, /CLEAR:|OK:/);
    }
  }
});
