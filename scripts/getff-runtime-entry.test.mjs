import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const catalog = readFileSync(resolve(root, '.agents/procedures/getff/references/template-catalog.md'), 'utf8');

test('getff catalog does not turn a generic install into evidence of delivered stack configs', () => {
  assert.doesNotMatch(catalog, /install\.sh` has already placed them/);
  assert.match(catalog, /generic.*no stack configs/);
  assert.match(catalog, /resolve.*delivered.*files/i);
});

test('every getff catalog template exists in the framework checkout', () => {
  const paths = [...catalog.matchAll(/`((?:templates|packages)\/[^`]+)`/g)].map(match => match[1]);
  assert.ok(paths.length >= 13);
  for (const path of paths) assert.ok(existsSync(resolve(root, path)), `Missing catalog template: ${path}`);
});

const fixture = process.argv.find(arg => arg.startsWith('--consumer='))?.slice('--consumer='.length);
if (fixture) {
  test('real generic consumer resolves both native canonical owners but has no fabricated ESLint config', () => {
    assert.equal(existsSync(resolve(fixture, 'eslint.config.mjs')), false);
    for (const card of ['.agents/skills/getff/SKILL.md', '.claude/skills/getff/SKILL.md']) {
      const text = readFileSync(resolve(fixture, card), 'utf8');
      assert.match(text, /name: getff/);
    }
    assert.ok(existsSync(resolve(fixture, '.agents/procedures/getff/references/template-catalog.md')));
    const installed = readFileSync(resolve(fixture, '.agents/procedures/getff/references/template-catalog.md'), 'utf8');
    assert.doesNotMatch(installed, /install\.sh` has already placed them/);
    assert.match(installed, /generic.*no stack configs/);
  });
}
