import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const role = readFileSync(`${root}.agents/roles/reviewer-discipline.md`, 'utf8');
const rule = readFileSync(`${root}.agents/rules/reviewer-discipline.md`, 'utf8');
const rubric = rule.match(/```text\n([\s\S]*?)\n```/)[1];

function verifyRuntimeRubric(text) {
  const embedded = text.match(/<!-- reviewer-discipline:rubric:start -->\n```text\n([\s\S]*?)\n```\n<!-- reviewer-discipline:rubric:end -->/);
  assert.ok(embedded, 'Read/Glob/Grep consumers need the complete rubric locally');
  assert.equal(embedded[1], rubric, 'Measured wording must stay byte-identical to the rule SSOT');
}

test('reporting-only role carries the full measured rubric without a network dependency', () => {
  verifyRuntimeRubric(role);
  assert.match(role, /^tools: Read, Glob, Grep$/m);
  for (const label of ['corpus-measured', 'judgment-only, not corpus-validated', 'measured null']) {
    assert.ok(role.includes(label), `Missing provenance: ${label}`);
  }
});

test('the parity guard rejects altered measured wording, not merely a missing heading', () => {
  const changed = role.replace('idea > design > architecture >', 'implementation > design > architecture >');
  assert.notEqual(changed, role, 'Mutation must reach the actual runtime excerpt');
  assert.throws(() => verifyRuntimeRubric(changed), /byte-identical/);
});
