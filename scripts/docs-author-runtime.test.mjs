import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(resolve(root, '.agents/procedures/docs-author/SKILL.md'), 'utf8');

test('gold guidance agrees with the actual frozen five-kind resource population', () => {
  for (const kind of ['reference-sheet', 'family-overview', 'learn-tutorial', 'guide', 'understand']) {
    assert.ok(existsSync(resolve(root, `.agents/procedures/docs-author/references/gold/${kind}.md`)));
  }
  assert.doesNotMatch(source, /empty\s+until then/);
  const craft = readFileSync(resolve(root, '.agents/procedures/docs-author/references/craft.md'), 'utf8');
  assert.doesNotMatch(craft, /gold pages once they exist/);
});

test('the real checker distinguishes a missing page from an out-of-scope non-page', () => {
  const run = (file) => spawnSync(process.execPath, ['scripts/docs-check.mjs', file, '--json'], { cwd: root, encoding: 'utf8' });
  const absent = run('docs/site/absent-docs-author-test.md');
  assert.equal(absent.status, 1);
  assert.match(absent.stdout, /file does not exist/);
  const skipped = run('README.md');
  assert.equal(skipped.status, 0);
  const result = JSON.parse(skipped.stdout);
  assert.deepEqual(result.populations.pages, []);
  assert.equal(result.populations.skipped[0].file, 'README.md');
});


test('unregistered kind and helper failure remain errors in the real CLI', () => {
  const fixture = mkdtempSync(resolve(tmpdir(), 'docs-author-invalid-'));
  try {
    mkdirSync(resolve(fixture, 'docs/site'), { recursive: true });
    writeFileSync(resolve(fixture, 'docs/site/probe.md'), `---
title: Check page kinds
description: Check the registered page kinds.
kind: quickstart
sources:
---
# Check page kinds

You can check the registered page kinds.
`);
    const result = spawnSync(process.execPath, ['scripts/docs-check.mjs', '--root', fixture, '--strict', '--json', resolve(fixture, 'docs/site/probe.md')], {
      cwd: root, encoding: 'utf8', env: { MARKDOWNLINT_BIN: '/usr/bin/false', VALE_BIN: '/usr/bin/false', LYCHEE_BIN: '/usr/bin/false' },
    });
    assert.equal(result.status, 1);
    const report = JSON.parse(result.stdout);
    assert.ok(report.errors.some((error) => error.rule === 'docs-check.frontmatter' && error.message.includes('quickstart')));
    assert.ok(report.errors.some((error) => error.file === '(markdownlint)'));
    assert.ok(report.errors.some((error) => error.file === '(lychee)'));
    assert.deepEqual(report.skips, []);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
