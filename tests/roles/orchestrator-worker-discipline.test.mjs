import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';

// Role registration must expose the executor required by its existing stage/park contract.
// Override the source to replay this test against the exact pre-fix artifact.
const source = process.argv[2] ?? fileURLToPath(
  new URL('../../.agents/roles/orchestrator-worker-discipline.md', import.meta.url),
);
const role = readFileSync(source, 'utf8');
const header = role.split('---')[1];
const tools = new Set(header.match(/^tools:\s*(.+)$/m)[1].split(',').map(x => x.trim()));
test('stage/park role can read its inputs and invoke its required shell commands', () => {
  assert.match(role, /gh pr list/);
  assert.match(role, /tsx/);
  assert.ok(tools.has('Read'), 'role needs source/task evidence');
  assert.ok(tools.has('Bash'), 'stage-gate and park require an actual executor');
});
test('worker discipline registers only its required Read and Bash tools', () => {
  assert.deepEqual([...tools].sort(), ['Bash', 'Read']);
});
