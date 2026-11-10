import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const role = readFileSync(resolve(root, '.agents/roles/review-sidecar.md'), 'utf8');
const statute = readFileSync(resolve(root, '.agents/rules/reviewer-discipline.md'), 'utf8');

test('shipped review-sidecar carries the exact triage yardstick without an unshipped rule dependency', () => {
  const yardstick = statute.match(/```text\n(Binding yardstick:[\s\S]*?)\n```/)[1];
  assert.ok(role.includes('```text\n' + yardstick + '\n```'),
    'consumer role must embed the measured rubric verbatim; .claude/rules is not delivered');
});

test('finding template carries the required failure scenario and per-axis provenance', () => {
  const template = role.split('## Output format')[1].split('Severity rules:')[0];
  assert.match(template, /Failure-scenario:/);
  assert.match(template, /layer.*corpus-measured/);
  assert.match(template, /whose.*judgment-only, not corpus-validated/);
  assert.match(template, /class.*measured null/);
});

// Delivery closure only: literal agreement cannot certify semantic review quality.
test('AIF binding delivers the canonical protection rubric and consumed-record protocol', () => {
  const mirror = readFileSync(resolve(root, 'packages/core/templates/shared/skill-context/aif-review/SKILL.md'), 'utf8');
  const rubric = role.split('### 10. Minimal sufficient protection')[1].split('\n---\n')[0];
  assert.ok(mirror.includes('## Minimal sufficient protection' + rubric));
  const protocol = role.split('## Consumed protection review record')[1].split('\n---\n')[0].trim();
  assert.ok(mirror.includes(protocol));
});
