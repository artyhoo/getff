import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '../..');
const source = process.env.INSTALLING_ENFORCEMENT_TEST_SOURCE ?? join(root, '.agents/procedures/installing-enforcement/SKILL.md');
const procedure = readFileSync(source, 'utf8');
const blocks = [...procedure.matchAll(/```bash\n([\s\S]*?)\n```/g)].map(match => match[1]);
const preview = blocks.find(block => block.includes('fetch-and-wire.sh') && !block.includes('--apply'));
const pluginPreview = blocks.find(block => block.includes('CLAUDE_PLUGIN_ROOT') && !block.includes('--apply'));
const apply = blocks.find(block => block.includes('fetch-and-wire.sh') && block.includes('--apply'));

// Execute the published recipe, not a separately reconstructed shell command.
test('native recipe binds consumer and reviewed source from an unrelated nested cwd', () => {
  assert.ok(preview, 'missing executable native preview recipe');
  assert.ok(apply, 'missing executable native apply recipe');
  const fixture = mkdtempSync(join(tmpdir(), 'installing enforcement '));
  try {
    const target = join(fixture, 'consumer with spaces');
    const framework = join(fixture, 'reviewed framework');
    const nested = join(fixture, 'unrelated', 'nested');
    mkdirSync(target); mkdirSync(join(framework, 'plugin', 'install'), { recursive: true });
    mkdirSync(nested, { recursive: true });
    const helper = readFileSync(join(root, 'plugin/install/fetch-and-wire.sh'));
    writeFileSync(join(framework, 'plugin/install/fetch-and-wire.sh'), helper);
    writeFileSync(join(framework, 'install.sh'), `#!/bin/bash
printf '%s\\n' "$PWD" "$@"
if [ "\${FAIL_INSTALL:-}" = yes ]; then echo controlled-installer-failure >&2; exit 37; fi
if [ "\${2:-}" != --dry-run ]; then printf applied > gate-delivery; fi
`);
    const env = { ...process.env, FRAMEWORK_ROOT: framework, TARGET: target, STACK: 'ts-server', CLAUDE_PROJECT_DIR: nested };
    let result = spawnSync('bash', ['-c', preview], { cwd: nested, env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes(target));
    assert.ok(result.stdout.includes('--dry-run'));
    assert.throws(() => readFileSync(join(target, 'gate-delivery')));
    result = spawnSync('bash', ['-c', preview], { cwd: nested, env: { ...env, FAIL_INSTALL: 'yes' }, encoding: 'utf8' });
    assert.equal(result.status, 37);
    assert.match(result.stderr, /controlled-installer-failure/);
    assert.throws(() => readFileSync(join(target, 'gate-delivery')));
    result = spawnSync('bash', ['-c', apply], { cwd: nested, env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(join(target, 'gate-delivery'), 'utf8'), 'applied');
    assert.throws(() => readFileSync(join(nested, 'gate-delivery')));
    // A packaged plugin root contains install/, not plugin/install/ or install.sh.
    assert.ok(pluginPreview, 'missing distinct plugin-package preview recipe');
    const pluginRoot = join(fixture, 'plugin package');
    mkdirSync(join(pluginRoot, 'install'), { recursive: true });
    writeFileSync(join(pluginRoot, 'install/fetch-and-wire.sh'), helper);
    result = spawnSync('bash', ['-c', pluginPreview], { cwd: nested, env: { ...env, CLAUDE_PLUGIN_ROOT: pluginRoot }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes(framework), 'installer source must remain the reviewed checkout');
    assert.ok(result.stdout.includes('--dry-run'));

    result = spawnSync('bash', ['-c', preview], { cwd: nested, env: { ...env, TARGET: join(fixture, 'absent') }, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /not a directory/);
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});
