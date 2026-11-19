import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const receiptDir = new URL('./receipts/', import.meta.url);
const runs = JSON.parse(readFileSync(new URL('runs.json', receiptDir), 'utf8'));
const run = id => {
  const receipt = runs.find(value => value.id === id);
  assert.ok(receipt, `missing receipt: ${id}`);
  assert.equal(receipt.terminal, true);
  return receipt;
};
const successful = id => {
  const receipt = run(id);
  assert.equal(receipt.exit_status, 0);
  assert.notEqual(receipt.is_error, true);
  return receipt;
};
const scopeCheck = (id, verdict = 'DECISION-NEEDED') => {
  const directory = mkdtempSync(join(tmpdir(), 'reviewer-receipt-'));
  try {
    const input = join(directory, 'events.jsonl');
    writeFileSync(input, gunzipSync(readFileSync(new URL(run(id).raw_file, receiptDir))));
    return spawnSync(process.execPath, [new URL('./assert-scope.mjs', import.meta.url).pathname, input, verdict], { encoding: 'utf8' });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

test('native Codex executes supplied acceptance and identifies the active checkout source', () => {
  for (const id of ['codex-positive', 'codex-nested', 'codex-csv', 'codex-consumer', 'codex-consumer-fixed2']) {
    const receipt = successful(id);
    assert.match(receipt.final, /VERDICT: GO/);
    assert.match(receipt.final, /\.agents\/skills\/reviewer\/SKILL\.md/);
    assert.match(receipt.final, /\.agents\/procedures\/reviewer\/SKILL\.md/);
    assert.ok(receipt.tools.some(tool => tool.exit_code === 0 && /(?:REVIEWER|CSV)-ACCEPTANCE-PASS/.test(tool.aggregated_output || '')));
  }
});

test('real acceptance failure is preserved and contradicts the inherited pass claim', () => {
  const receipt = successful('codex-failed');
  assert.match(receipt.final, /VERDICT: REVISE/);
  assert.match(receipt.final, /Failure-scenario:/);
  assert.ok(receipt.tools.some(tool => tool.exit_code === 7 && /REVIEWER-HELPER-FAILURE/.test(tool.aggregated_output || '')));
});

test('Claude positive native invocation completes an actual acceptance run', () => {
  const receipt = successful('claude-positive');
  assert.match(receipt.final, /VERDICT: GO/);
  assert.ok(receipt.tools.some(tool => tool.type === 'tool_result' && /REVIEWER-ACCEPTANCE-PASS/.test(JSON.stringify(tool)) && /EXIT=0/.test(JSON.stringify(tool))));
});

test('scope oracle rejects both baseline leakage and the incomplete first missing-input fix', () => {
  for (const [id, verdict] of [['claude-fork', 'DECISION-NEEDED'], ['claude-missing', 'STOP'], ['claude-missing-fixed', 'STOP']]) {
    const result = scopeCheck(id, verdict);
    assert.notEqual(result.status, 0, id);
    assert.match(result.stderr, /AssertionError/);
  }
});

test('post-fix native runs withhold strategic approval without reading neighboring artifacts', () => {
  for (const id of ['claude-fork-fixed', 'codex-fork-fixed', 'codex-consumer-fixed']) {
    successful(id);
    const result = scopeCheck(id);
    assert.equal(result.status, 0, `${id}: ${result.stderr}`);
  }
});

test('final missing-input fix stops before inventing deliverables on both native hosts', () => {
  for (const id of ['claude-missing-fixed2', 'codex-missing-fixed2']) {
    successful(id);
    const result = scopeCheck(id, 'STOP');
    assert.equal(result.status, 0, `${id}: ${result.stderr}`);
  }
});

test('rate-limited Claude attempts are never counted as successful reviewer workflows', () => {
  for (const id of ['claude-failed', 'claude-consumer']) {
    const receipt = run(id);
    assert.equal(receipt.exit_status, 1);
    assert.equal(receipt.is_error, true);
    assert.match(receipt.final, /429/);
  }
});

// A green semantic assertion must refer to the unchanged captured native stream.
test('every archived native stream matches its preserved receipt hash', () => {
  for (const receipt of runs) {
    const raw = gunzipSync(readFileSync(new URL(receipt.raw_file, receiptDir)));
    assert.equal(createHash('sha256').update(raw).digest('hex'), receipt.raw_sha256, receipt.id);
  }
});
