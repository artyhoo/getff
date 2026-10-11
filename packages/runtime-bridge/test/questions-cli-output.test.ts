import { test, beforeAll, afterAll } from 'vitest';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { resolve, join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { build } from 'esbuild';

const repo = resolve(import.meta.dirname, '../../..');
const cli = resolve(repo, 'packages/runtime-bridge/src/cli/questions.ts');
const vendorCli = resolve(
  repo,
  'packages/runtime-bridge/vendor/src/cli/questions.ts',
);
const compiled = new Map<string, string>();
let scratch: string;

// Use the declared build tool and real CLI entrypoints, not an undeclared TS loader.
beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'questions output with spaces-'));
  for (const [entry, name] of [
    [cli, 'source'],
    [vendorCli, 'vendor'],
  ]) {
    const outfile = join(scratch, `${name}-questions.mjs`);
    await build({
      entryPoints: [entry],
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'node22',
      outfile,
    });
    compiled.set(entry, outfile);
  }
});
afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true });
});

async function runQuestions(
  tasks: unknown[],
  args: string[],
  status = 200,
  entry = cli,
) {
  const server = createServer((req, res) => {
    assert.equal(req.method, 'GET');
    assert.equal(req.url, '/tasks');
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(tasks));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const env = {
      ...process.env,
      RUNTIME_BRIDGE_AIF_URL: `http://127.0.0.1:${address.port}`,
    };
    delete env.RUNTIME_BRIDGE_AIF_PROJECT_ID;
    const executable = compiled.get(entry);
    assert.ok(executable);
    const child = spawn(process.execPath, [executable, ...args], {
      cwd: repo,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout: Buffer[] = [],
      stderr: Buffer[] = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    const [code] = await once(child, 'close');
    return {
      code,
      stdout: Buffer.concat(stdout),
      stderr: Buffer.concat(stderr),
    };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test('questions JSON drains a large selected population through a real stdout pipe', async () => {
  const parked = {
    id: 'large-parked',
    title: 'A real pipe-sized fixture',
    status: 'review',
    projectId: 'selected',
    manualReviewRequired: true,
    reviewComments: 'Large Unicode review Ω🙂 '.repeat(60000),
  };
  const late = {
    id: 'last-parked',
    title: 'Last selected task',
    status: 'review',
    projectId: 'selected',
    paused: true,
    plan: '## ⏸ OPEN QUESTION\n\nPick A or B',
  };
  const tasks = [
    parked,
    { id: 'clean', title: 'Clean task', status: 'done' },
    { ...late, id: 'other-project', projectId: 'other' },
    late,
  ];
  const expected = Buffer.from(JSON.stringify([parked, late]) + '\n');
  assert.ok(expected.length > 1000000);
  const result = await runQuestions(tasks, ['--json', '--project', 'selected']);
  assert.equal(result.code, 0);
  assert.equal(result.stderr.length, 0);
  assert.equal(
    result.stdout.length,
    expected.length,
    'zero exit must include the entire selected JSON, not only a pipe prefix',
  );
  assert.deepEqual(result.stdout, expected);
  assert.deepEqual(JSON.parse(result.stdout.toString()), [parked, late]);
});

test('questions human output preserves the tail after a large blocked reason', async () => {
  const result = await runQuestions(
    [
      {
        id: 'human-large',
        title: 'Large blocked reason',
        status: 'blocked_external',
        blockedReason: 'Reason with Ω🙂 '.repeat(12000),
      },
    ],
    [],
  );
  assert.equal(result.code, 0);
  assert.equal(result.stderr.length, 0);
  assert.ok(result.stdout.length > 65536);
  assert.match(
    result.stdout.toString(),
    /research first, then a reasoned recommendation/,
  );
  assert.ok(
    result.stdout.toString().endsWith('do not relay it as a bare card.\n'),
  );
});

test('questions fetch failure stays nonzero and never emits successful JSON', async () => {
  const result = await runQuestions([], ['--json'], 500);
  assert.equal(result.code, 1);
  assert.equal(result.stdout.length, 0);
  assert.match(result.stderr.toString(), /HTTP 500/);
});

test('factory-delivered questions CLI drains large selected JSON through the same pipe contract', async () => {
  const task = {
    id: 'factory-last',
    title: 'Factory CLI closure',
    status: 'review',
    manualReviewRequired: true,
    reviewComments: 'Factory Unicode Ω🙂 '.repeat(30000),
  };
  const result = await runQuestions(
    [task],
    ['--json'],
    200,
    resolve(repo, 'packages/runtime-bridge/vendor/src/cli/questions.ts'),
  );
  const expected = Buffer.from(JSON.stringify([task]) + '\n');
  assert.equal(result.code, 0);
  assert.equal(result.stderr.length, 0);
  assert.equal(result.stdout.length, expected.length);
  assert.deepEqual(JSON.parse(result.stdout.toString()), [task]);
});
