import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const tool = spawnSync('ast-grep', ['--version'], { encoding: 'utf8' });
test('the delivered Python pre-push rejects rebroken sidecar material and accepts its repair', {
  skip: tool.status !== 0 ? 'real ast-grep absent; standing firing UNVERIFIED' : false,
}, t => {
  const dir = mkdtempSync(join(tmpdir(), 'python standing space '));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, '.ai-factory/rule-tests'), { recursive: true });
  mkdirSync(join(dir, '.getff/astgrep-rules'), { recursive: true });
  mkdirSync(join(dir, 'nested'));
  writeFileSync(join(dir, 'sgconfig.yml'), 'ruleDirs:\n  - .getff/astgrep-rules\n');
  writeFileSync(join(dir, '.getff/astgrep-rules/audit-no-yaml-load.yml'),
    'id: audit-no-yaml-load\nlanguage: Python\nseverity: error\nmessage: Use yaml.safe_load\nrule:\n  pattern: yaml.load($ARG)\n');
  let r = spawnSync('git', ['init', '-q', dir], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const env = { ...process.env, PKG_ROOT: root, PROJECT_ROOT: dir, PROFILE: 'core',
    PY_LAYER_LIB_ONLY: '1', FORCE: '', DRY_RUN: '', REFRESH: '', WITH_AIF_SUITE: '' };
  r = spawnSync('bash', ['-c', 'source "$PKG_ROOT/setup.d/lib.sh"; source "$PKG_ROOT/setup.d/45-python.sh"; _py_deliver_local_hook_rung'],
    { cwd: dir, env, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const runner = join(dir, 'scripts/run-rule-tests-firing.sh');
  assert.equal(readFileSync(runner, 'utf8'), readFileSync(join(root, 'packages/core/synthesizer/run-rule-tests-firing.sh'), 'utf8'));
  const material = join(dir, '.ai-factory/rule-tests/astgrep.json');
  const run = () => spawnSync('bash', [join(dir, '.getff/hooks/pre-push')], {
    cwd: join(dir, 'nested'), env, encoding: 'utf8', input: '', timeout: 30000,
  });
  const good = 'import yaml\nyaml.safe_load(raw)';
  writeFileSync(material, JSON.stringify({ 'audit-no-yaml-load': { bad: [good], good: [good] } }));
  r = run();
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout + r.stderr, /bad sample did NOT fire/);
  writeFileSync(material, JSON.stringify({ 'audit-no-yaml-load': { bad: ['import yaml\nyaml.load(raw)'], good: [good] } }));
  r = run();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /bad sample fired RED/);
  assert.match(r.stdout, /good sample clean/);
});
