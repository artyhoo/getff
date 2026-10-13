import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '../..');
const role = readFileSync(process.argv[2] || join(root, '.agents/roles/shipped-agent-liveness-prober.md'), 'utf8');
const surface = role.split('## §Shipped surface')[1].match(/```bash\n([\s\S]*?)```/)[1];

// Production change under test: replace obsolete install.sh loop selector with
// the active layer, anchored at the checkout root, preserving command errors.
for (const cwd of [root, join(root, 'tests')]) test(`published surface commands reveal delivery predicates from ${cwd}`, () => {
  const result = spawnSync('bash', ['-c', surface], { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /role_source_root/);
  assert.match(result.stdout, /shipped-agent-liveness-prober\.md\) continue/);
  assert.match(result.stdout, /PROFILE/);
  assert.match(result.stdout, /agent\tshipped-agent-liveness-prober\tinternal\tno\tno/);
});

test('missing delivery layer fails instead of certifying an empty population', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'liveness-missing-layer-'));
  try {
    assert.equal(spawnSync('git', ['init', '-q', fixture]).status, 0);
    mkdirSync(join(fixture, 'nested'));
    const result = spawnSync('bash', ['-c', surface], { cwd: join(fixture, 'nested'), encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /No such file|can't read/);
    assert.equal(result.stdout, '');
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
