import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
const helper = resolve(import.meta.dirname, '../../.agents/roles/resources/shipped-agent-liveness-prober/summarize-native-trace.mjs');
function run(records) {
  const dir = mkdtempSync(join(tmpdir(), 'liveness-trace-'));
  try {
    const path = join(dir, 'trace.jsonl');
    writeFileSync(path, records.map(JSON.stringify).join('\n') + '\n');
    return spawnSync(process.execPath, [helper, path], { encoding: 'utf8' });
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
const init = { type: 'system', subtype: 'init', session_id: 'fresh', tools: ['Read', 'Grep'] };
const complete = { type: 'result', subtype: 'success', is_error: false, session_id: 'fresh' };
const call = (id, name) => ({ type: 'assistant', session_id: 'fresh', parent_tool_use_id: null, message: { content: [{ type: 'tool_use', id, name, input: {} }] } });

test('counts distinct native tool IDs by actual name, ignoring text and replay', () => {
  const r = run([init, call('r1', 'Read'), call('g1', 'Grep'), call('r2', 'Read'), call('g1', 'Grep'), { type: 'assistant', session_id: 'fresh', message: { content: [{ type: 'text', text: 'Read x1, Grep x2' }] } }, complete]);
  assert.equal(r.status, 0, r.stderr);
  const result = JSON.parse(r.stdout);
  assert.deepEqual(result.counts, { Read: 2, Grep: 1 });
  assert.equal(result.total, 3);
  assert.equal(result.calls.length, 3);
});
test('completed tools-empty native session is a valid zero, not an absent probe', () => {
  const r = run([{ ...init, tools: [] }, complete]);
  assert.equal(r.status, 0, r.stderr);
  const result = JSON.parse(r.stdout);
  assert.equal(result.total, 0);
  assert.deepEqual(result.granted_tools, []);
});
test('failed, incomplete, conflicting or nested traces fail instead of certifying zero', () => {
  for (const records of [[init], [init, { ...complete, is_error: true }], [init, call('same', 'Read'), call('same', 'Grep'), complete], [init, { ...call('nested', 'Read'), parent_tool_use_id: 'task-parent' }, complete], [init, { ...call('foreign', 'Read'), session_id: 'another-session' }, complete]]) {
    const r = run(records);
    assert.notEqual(r.status, 0);
    assert.equal(r.stdout, '');
  }
});
