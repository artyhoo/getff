import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

// This verifies real native-run outputs, not discovery or a simulated LLM.
// Run after the recorded launcher: node tests/aif-init/runtime-output.test.mjs /path
// The supplied corpus combines the named native-run fixture outputs.
const root = process.argv[2];
if (!root) throw new Error('Supply a native-run fixture corpus directory as the first argument.');
const read = (name, file) => readFileSync(join(root, name, '.ai-factory', file), 'utf8');
const draft = (name, file) => {
  const content = read(name, file);
  assert.match(content, /⚠️.*DRAFT.*PLEASE REVIEW/);
  assert.doesNotMatch(content, /<(?!!--)[^>\n]+>/);
  return content;
};
test('pristine installer architecture becomes a reviewed draft', () => {
  draft('installed', 'DESCRIPTION.md');
  draft('installed', 'ARCHITECTURE.md');
});
test('human passports remain byte-for-byte unchanged', () => {
  assert.equal(read('protected', 'DESCRIPTION.md'), '# Human passport\nDo not replace.\n');
  assert.equal(read('protected', 'ARCHITECTURE.md'), '# Human architecture\nKeep this.\n');
});
test('modified architecture with installer wording remains protected', () => {
  const template = read('edited', 'ARCHITECTURE.ts-server.md').replace(
    '> Drop into `.ai-factory/ARCHITECTURE.md` and override only what your project needs. ',
    '> This install-generated starter IS your `.ai-factory/ARCHITECTURE.md` — edit it to match your project. ',
  );
  assert.equal(read('edited', 'ARCHITECTURE.md'), template + '\nHuman exception: domain may import app.\n');
  assert.equal(read('edited', 'DESCRIPTION.md'), '# Human passport\nDo not replace.\n');
});
test('nonstandard declared workspace contributes its actual stack', () => {
  assert.match(draft('monorepo', 'DESCRIPTION.md'), /Next\.js/);
  draft('monorepo', 'ARCHITECTURE.md');
});
test('unreadable inputs are explicit uncertainty, not invented detections', () => {
  for (const name of ['malformed', 'missing']) {
    assert.match(draft(name, 'DESCRIPTION.md'), /invalid|malformed|missing|absent|not found/i);
    draft(name, 'ARCHITECTURE.md');
  }
});
