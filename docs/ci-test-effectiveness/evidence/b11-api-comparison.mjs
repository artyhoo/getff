// One-shot compatibility evidence, never a recurring test or generic loader.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = process.cwd();
const paths = ['packages/core/hooks/checks/pr-body-fidelity-bin.test.ts', 'packages/core/principles/37-required-context-completeness.test.ts', 'packages/core/principles/ci-test-invocations.ts'];
const workflows = readdirSync('.github/workflows').filter(p => /\.ya?ml$/.test(p)).sort();
assert.equal(workflows.length, 15);
const inputs = workflows.map(p => ({ name: p, source: readFileSync(resolve('.github/workflows', p), 'utf8') }));
inputs.push({ name: 'valid-companion', source: 'name: companion\non: [push]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n' });
inputs.push({ name: 'malformed-companion', source: 'jobs: [unterminated\n' });
function outcome(load, source) {
  try { return { ok: true, value: load(source) }; }
  catch (e) { return { ok: false, error: { name: e.name, message: e.message, reason: e.reason, mark: { line: e.mark?.line, column: e.mark?.column, position: e.mark?.position, snippet: e.mark?.snippet } } }; }
}
function version(entry) {
  let dir = dirname(fileURLToPath(entry));
  while (dir !== dirname(dir)) {
    try { const p = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8')); if (p.version) return p.version; } catch {}
    dir = dirname(dir);
  }
  throw new Error('Package version absent');
}
const contexts = [];
for (const path of paths) {
  const context = pathToFileURL(resolve(path)).href;
  const require = createRequire(context);
  const esmPath = import.meta.resolve('js-yaml', context);
  const cjsPath = pathToFileURL(require.resolve('js-yaml')).href;
  const esm = await import(esmPath);
  const cjs = require('js-yaml');
  const cases = inputs.map(({ name, source }) => {
    const before = outcome(esm.load, source), after = outcome(cjs.load, source);
    assert.deepStrictEqual(after, before, `${path}: ${name}`);
    assert.equal(before.ok, name !== 'malformed-companion');
    return { name, sha256: createHash('sha256').update(source).digest('hex'), outcome: before.ok ? 'equal-values' : 'equal-error-name/message/reason/location/snippet' };
  });
  const row = { context, yaml: { esmPath, cjsPath, esmVersion: version(esmPath), cjsVersion: version(cjsPath), sameLoadObject: esm.load === cjs.load, cases } };
  if (path.endsWith('ci-test-invocations.ts')) {
    const esmMatcherPath = import.meta.resolve('picomatch', context);
    const cjsMatcherPath = pathToFileURL(require.resolve('picomatch')).href;
    const esmMatcher = (await import(esmMatcherPath)).default;
    const cjsMatcher = require('picomatch');
    assert.strictEqual(cjsMatcher, esmMatcher, 'actual matcher factory identity');
    row.matcher = { esmMatcherPath, cjsMatcherPath, version: version(cjsMatcherPath), sameFactoryObject: true, contract: 'string|string[] pattern, optional dot boolean, string input => boolean; exact existing factory identity preserves all current configured calls' };
  }
  contexts.push(row);
}
writeFileSync('docs/ci-test-effectiveness/evidence/b11-api-result.json', JSON.stringify({ node: process.version, flag: '--experimental-import-meta-resolve enables target parent URL resolution', contexts, limit: 'Only actual installed builds, default YAML load on 15 current workflows and two companions; no universal-version equivalence or hosted proof.' }, null, 2)+'\n');
console.log('PASS: 3 target contexts × 17 YAML inputs; actual core picomatch factory identity');
