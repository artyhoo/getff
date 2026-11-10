import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { detectCapabilityReason } from '../packages/core/hooks/checks/prior-art.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = '.agents/procedures/self-reflection/references/forward-checklist.md';

// These examples pin all detector inputs: only the candidate path/dependency varies.
// They exercise the production classifier, not a second checklist classifier.
function classify(path, dependency = '') {
  return detectCapabilityReason('fixture', {
    packageJsonDiff: () => dependency,
    changedFiles: () => [{ status: 'A', path }],
    fileContent: () => 'line\n'.repeat(85),
    subdirExistedAtParent: () => false,
    blobTrackedAtBase: () => false,
  });
}

test('Layer 3 exposes current carve-outs and does not invent a universal trailer gate', () => {
  const text = readFileSync(root + source, 'utf8');
  const layer = text.split('## Layer 3')[1].split('## Layer 4')[0];
  assert.match(layer, /test additions for existing capabilities/);
  assert.match(layer, /principles/);
  assert.match(layer, /byte-identical/);
  assert.match(layer, /non-capability commit[^\n]*does not require/i);
  assert.doesNotMatch(layer, /For each non-capability commit: escape-hatch trailer/);
  assert.equal(classify('packages/core/example/existing-rule.test.ts'), null);
  assert.equal(classify('packages/core/example/readme.md'), null);
  assert.ok(classify('packages/core/principles/new-enforcement.test.ts'));
  assert.ok(classify('packages/core/example/new-capability.ts'));
  assert.ok(classify('packages/core/example/existing-rule.test.ts',
    '+    "dependencies": {\n+      "example-dependency": "1.0.0"\n+    }\n'));
});

test('Claude reference and Codex reference resolve to the same corrected owner', () => {
  for (const entry of [
    '.claude/skills/self-reflection/references/forward-checklist.md',
    '.agents/skills/self-reflection/references/forward-checklist.md',
  ]) {
    assert.equal(realpathSync(root + entry), realpathSync(root + source));
  }
});
