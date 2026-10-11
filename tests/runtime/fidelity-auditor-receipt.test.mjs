import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';

const receipts = new URL(
  '../../docs/superpowers/plans/2026-10-09-skill-fidelity-auditor-runtime-audit-receipts/',
  import.meta.url,
);
const checker = fileURLToPath(new URL('./fidelity-auditor-receipt.mjs', import.meta.url));
const readReceipt = (name) =>
  gunzipSync(readFileSync(new URL(`${name}.final.txt.gz`, receipts))).toString();

function check(text) {
  const dir = mkdtempSync(join(tmpdir(), 'fidelity-receipt-'));
  try {
    const path = join(dir, 'result.txt');
    writeFileSync(path, text);
    const result = spawnSync(process.execPath, [checker, path], { encoding: 'utf8' });
    assert.equal(result.error, undefined);
    return result.status;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

for (const name of ['positive', 'negative', 'helper-failure', 'consumer-codex', 'fixed-codex', 'fixed-claude-retry', 'final-codex-negative', 'rubric-codex-negative', 'rubric-claude-negative']) {
  test(`accepts completed native ${name} output contract`, () => {
    assert.equal(check(readReceipt(name)), 0);
  });
}

test('rejects the actual pre-fix Claude omission', () => {
  assert.equal(check(readReceipt('claude-positive')), 1);
});

test('rejects a missing status for one existing watch-list item', () => {
  const text = readReceipt('fixed-claude-retry').replace(/; W-3 CLEAN/, '');
  assert.equal(check(text), 1);
});

test('rejects a scenario-less rework verdict', () => {
  const text = readReceipt('negative').replace(/^\s*Failure-scenario:.*$/m, '');
  assert.equal(check(text), 1);
});

test('rejects the actual Claude graded finding without axis provenance', () => {
  assert.equal(check(readReceipt('claude-negative-retry')), 1);
});


test('rejects the actual Claude invented triage axis values', () => {
  assert.equal(check(readReceipt('final-claude-negative')), 1);
});

test('delivers the exact frozen rubric from its owner inside the role', () => {
  const role = readFileSync(new URL('../../.agents/roles/fidelity-auditor.md', import.meta.url), 'utf8');
  const owner = readFileSync(new URL('../../.agents/rules/reviewer-discipline.md', import.meta.url), 'utf8');
  const extract = (text) => text.match(/```text\n(Binding yardstick:[\s\S]*?)\n```/)?.[1];
  assert.ok(extract(owner));
  assert.equal(extract(role), extract(owner));
  const baseline = gunzipSync(readFileSync(new URL('canonical-baseline.md.gz', receipts))).toString();
  assert.equal(extract(baseline), undefined, 'pre-fix role lacks the required local dependency');
});
