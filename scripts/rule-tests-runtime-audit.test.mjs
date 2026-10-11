import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

// Real ast-grep checks of the existing verification helper; no native-agent claim.
const root = fileURLToPath(new URL('../', import.meta.url));
const runner = join(root, 'packages/core/synthesizer/run-rule-tests-firing.sh');
const probe = spawnSync('ast-grep', ['--version'], { encoding: 'utf8' });
const rule = 'id: audit-no-yaml-load\nlanguage: Python\nseverity: error\nmessage: Use yaml.safe_load\nrule:\n  pattern: yaml.load($ARG)\n';
const good = 'import yaml\nyaml.safe_load(raw)';
const bad = 'import yaml\nyaml.load(raw)';

function check(t, material, config = rule) {
  const fixture = mkdtempSync(join(tmpdir(), 'rule-tests-runtime-'));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  mkdirSync(join(fixture, '.ai-factory/rule-tests'), { recursive: true });
  mkdirSync(join(fixture, '.getff/astgrep-rules'), { recursive: true });
  mkdirSync(join(fixture, 'src/nested'), { recursive: true });
  const rulePath = join(fixture, '.getff/astgrep-rules/audit-no-yaml-load.yml');
  if (config !== null) writeFileSync(rulePath, config);
  writeFileSync(join(fixture, '.ai-factory/rule-tests/astgrep.json'), JSON.stringify(material));
  const result = spawnSync('bash', [runner, fixture, 'astgrep'], {
    cwd: join(fixture, 'src/nested'), encoding: 'utf8', timeout: 30000,
  });
  assert.ifError(result.error);
  if (config !== null) assert.equal(readFileSync(rulePath, 'utf8'), config);
  return result;
}

const options = { skip: probe.status !== 0 ? 'real ast-grep unavailable; firing UNVERIFIED' : false };
test('repaired material fires two violating variants and keeps the counter-sample clean from nested cwd', options, t => {
  const r = check(t, { 'audit-no-yaml-load': { bad: [bad, 'import yaml\nyaml.load(payload)'], good: [good] } });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal((r.stdout.match(/bad sample fired RED/g) || []).length, 2);
  assert.match(r.stdout, /good sample clean/);
  assert.match(r.stdout, /all present-lane sidecar material fired correctly/);
});
test('non-violating bad material fails instead of passing a no-op', options, t => {
  const r = check(t, { 'audit-no-yaml-load': { bad: [good], good: [good] } });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /bad sample did NOT fire/);
});
test('violating good material fails as over-fire', options, t => {
  const r = check(t, { 'audit-no-yaml-load': { bad: [bad], good: [bad] } });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /good sample FIRED/);
});
test('malformed sidecar fails before pretending to verify', options, t => {
  const r = check(t, { 'audit-no-yaml-load': { badd: [bad], good: [good] } });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /sidecar is not valid rule-test material/);
});
test('broken rule helper input is a failure rather than a firing verdict', options, t => {
  const r = check(t, { 'audit-no-yaml-load': { bad: [bad], good: [good] } }, 'rule: [invalid');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /rule invalid/);
  assert.doesNotMatch(r.stdout, /bad sample fired RED/);
});
test('missing rule config is explicit unproven degradation even when process exits zero', options, t => {
  const r = check(t, { 'audit-no-yaml-load': { bad: [bad], good: [good] } }, null);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /DEGRADED/);
  assert.match(r.stdout, /NOT proven/);
  assert.doesNotMatch(r.stdout, /all present-lane sidecar material fired correctly/);
});
