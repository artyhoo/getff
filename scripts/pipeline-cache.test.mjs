import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
function probe(t, prepare) {
  const dir = mkdtempSync(join(tmpdir(), 'pipeline cache space '));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, 'nested'));
  prepare(dir);
  return spawnSync('zsh', ['-c', 'bash "$1"', '--', join(root, '.agents/procedures/pipeline/helpers/read-plan-cache.sh')], {
    cwd: join(dir, 'nested'), env: { ...process.env, MO_ORCH_HOME: dir }, encoding: 'utf8',
  });
}
test('empty cache is a read-only unavailable observation under zsh', t => {
  const r = probe(t, () => {});
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stderr, '');
  assert.match(r.stdout, /no cache/);
  assert.doesNotMatch(r.stdout, /will be created/);
});
test('cache and the latest three pointers retain paths with spaces', t => {
  const r = probe(t, dir => {
    writeFileSync(join(dir, '_plan-cache.md'), 'CACHE-EVIDENCE\n');
    for (let n = 1; n <= 4; n++) {
      const file = join(dir, `_residue-session ${n}.md`);
      writeFileSync(file, `RESIDUE-${n}\n`); utimesSync(file, n * 100, n * 100);
    }
    writeFileSync(join(dir, '_handoff-some session.md'), 'HANDOFF-EVIDENCE\n');
  });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stderr, '');
  assert.match(r.stdout, /CACHE-EVIDENCE/);
  assert.doesNotMatch(r.stdout, /RESIDUE-1/);
  assert.ok(r.stdout.indexOf('RESIDUE-4') < r.stdout.indexOf('RESIDUE-3'));
  assert.match(r.stdout, /HANDOFF-EVIDENCE/);
});
test('both native procedure routes use the same shell-independent cache helper', () => {
  for (const file of ['SKILL.md', 'references/planning.md']) {
    const source = readFileSync(join(root, '.agents/procedures/pipeline', file), 'utf8');
    assert.match(source, /bash "\.agents\/procedures\/pipeline\/helpers\/read-plan-cache\.sh"/);
    assert.doesNotMatch(source, /for f in \$\(ls -t/);
  }
});
