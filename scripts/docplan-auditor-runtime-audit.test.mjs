import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);
const rolePath = '.agents/roles/docplan-auditor.md';
const baselineSha = '502940bddd36d4fbe7035ad305c6add0de33bb35';
const source = readFileSync(new URL(rolePath, root), 'utf8');
const receipts = JSON.parse(readFileSync(new URL(
  'docs/superpowers/plans/2026-10-09-skill-docplan-auditor-runtime-audit.receipts.json', root,
), 'utf8'));

// Compare the declared output grammar with an actual native refusal, rather than
// guessing what a model would emit. These are replay checks, not live CLI runs.
function assertThinContract(contract, output) {
  const template = contract.match(/<sectionId>[^\n]+/u)?.[0];
  assert.ok(template?.includes('INCONCLUSIVE'), 'native thin-claim verdict is absent from the declared section grammar');
  assert.match(output, /unknown "Architecture" — INCONCLUSIVE/u);
  assert.match(output, /Overall: STOP/u);
  assert.doesNotMatch(output, /Overall: GO/u);
}

test('the recorded native thin-claim refusal exposes the pre-fix grammar gap', () => {
  const before = execFileSync('git', ['show', `${baselineSha}:${rolePath}`], { cwd: root, encoding: 'utf8' });
  assert.throws(() => assertThinContract(before, receipts.thin.output), /absent from the declared section grammar/u);
});

test('the canonical section grammar accepts the observed native thin-claim refusal', () => {
  assertThinContract(source, receipts['thin-fixed'].output);
  assert.match(source, /any INCONCLUSIVE or unreadable\s+required input → STOP/u);
});

test('recorded positive and adverse executions preserve distinct semantic outcomes', () => {
  for (const [name, verdict] of Object.entries({
    valid: 'GO', adverse: 'REVISE', thin: 'STOP', missing: 'STOP',
    'consumer-contaminated': 'REVISE', 'consumer-valid': 'GO',
    claude: 'REVISE', 'claude-valid': 'GO', 'claude-missing': 'STOP',
    'thin-fixed': 'STOP', 'claude-thin-fixed': 'STOP',
  })) {
    assert.equal(receipts[name].exit_status, 0, name);
    assert.ok(receipts[name].output.includes(`Overall: ${verdict}`), name);
  }
  assert.ok(receipts.missing.tool_receipts.some((read) =>
    read.command?.includes('missing.json') && read.exit_code === 1));
});
