import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';

const source = new URL('../SKILL.md', import.meta.url);
const egress = new URL('../references/egress.md', import.meta.url);
const command = readFileSync(source, 'utf8').match(/`(curl [^`]*localhost:3009\/health)`/)[1];
function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('curl', args);
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}
async function probe(status) {
  const server = createServer((_req, res) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end('{"status":"ok"}');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const args = command.split(' ').slice(1);
    args[args.length - 1] = `http://127.0.0.1:${server.address().port}/health`;
    return await run(args);
  } finally { await new Promise(resolve => server.close(resolve)); }
}
test('healthy bridge returns its JSON body', async () => {
  const result = await probe(200);
  assert.equal(result.code, 0);
  assert.equal(JSON.parse(result.stdout).status, 'ok');
});
test('HTTP failure refuses even with a misleading healthy body', async () => {
  const result = await probe(503);
  assert.equal(result.code, 22);
  assert.match(result.stderr, /503/);
});
test('egress reference uses the same mandatory preflight', () => {
  assert.ok(readFileSync(egress, 'utf8').includes('`' + command + '`'));
});

test('transport failure preserves curl status and diagnostic', async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  const args = command.split(' ').slice(1);
  args[args.length - 1] = `http://127.0.0.1:${port}/health`;
  const result = await run(args);
  assert.equal(result.code, 7);
  assert.match(result.stderr, /Failed to connect|Couldn't connect/);
});
