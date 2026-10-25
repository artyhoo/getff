import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { afterEach, describe, expect, it } from 'vitest';
import { awaitActionable, parseAwaitArgs } from '../src/cli/await.js';
import { describeAifTask } from '../src/aifWsStatus.js';
import { OPEN_QUESTION_ANCHOR } from '../src/cli/openQuestion.js';

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections();
          server.close(() => resolve());
        }),
    ),
  );
});

async function fixture(responses: Array<Record<string, unknown> | number>) {
  const paths: string[] = [];
  const methods: string[] = [];
  const server = createServer((req, res) => {
    paths.push(req.url ?? '');
    methods.push(req.method ?? '');
    const response =
      responses[Math.min(paths.length - 1, responses.length - 1)];
    if (response === 0) {
      req.socket.destroy();
      return;
    }
    if (response === -1) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.write('{');
      return;
    }
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = typeof response === 'number' ? response : 200;
    res.end(
      JSON.stringify(
        typeof response === 'number' ? { error: 'fixture' } : response,
      ),
    );
  });
  servers.push(server);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Expected TCP listener');
  return { baseUrl: `http://127.0.0.1:${address.port}`, paths, methods };
}

const task = (extra: Record<string, unknown> = {}) => ({
  id: 't1',
  title: 'Task',
  status: 'review',
  ...extra,
});

describe('actionable wait over the real HTTP read path', () => {
  it('is delivered in the consumer vendor copy with its import closure', async () => {
    const { awaitActionable: awaitVendoredActionable } =
      await import('../vendor/src/cli/await.js');
    const http = await fixture([task({ status: 'verified' })]);
    expect(
      await awaitVendoredActionable('t1', { ...http, timeoutMs: 1000 }),
    ).toMatchObject({ kind: 'done', status: 'verified' });
  });
  it.each([
    { status: 'done', manualReviewRequired: true },
    { blockedReason: 'Choose implementation' },
    { status: 'blocked_external' },
    { paused: true, plan: `${OPEN_QUESTION_ANCHOR}\nQuestion` },
  ])(
    'returns a park before treating completion as success: %j',
    async (park) => {
      const http = await fixture([task(park)]);
      const result = await awaitActionable('t1', {
        ...http,
        intervalMs: 5,
        timeoutMs: 1000,
      });
      expect(result.kind).toBe('parked');
      expect(result.taskId).toBe('t1');
      expect(http.methods).toEqual(['GET']);
    },
  );

  it('absorbs healthy polls and a transient outage, returning only the final event', async () => {
    const http = await fixture([
      task({ status: 'planning' }),
      0,
      task(),
      task({ status: 'verified' }),
    ]);
    const result = await awaitActionable('t1', {
      ...http,
      intervalMs: 5,
      timeoutMs: 1000,
    });
    expect(result).toMatchObject({ kind: 'done', status: 'verified' });
    expect(http.paths).toEqual(Array(4).fill('/tasks/t1'));
    expect(http.methods).toEqual(Array(4).fill('GET'));
  });

  it('surfaces an ordinary pause without interpreting it as authority to resume', async () => {
    const http = await fixture([task({ paused: true })]);
    expect(
      await awaitActionable('t1', { ...http, timeoutMs: 1000 }),
    ).toMatchObject({ kind: 'paused' });
  });

  it.each([
    task({ status: 'future_status' }),
    task({ id: 'foreign' }),
    { error: 'bad schema' },
  ])(
    'does not wait forever on unknown or mismatched state: %j',
    async (body) => {
      const http = await fixture([body]);
      expect(
        await awaitActionable('t1', { ...http, timeoutMs: 1000 }),
      ).toMatchObject({ kind: 'unknown' });
    },
  );

  it('stops after repeated transport failures without mutating the task', async () => {
    const http = await fixture([0]);
    expect(
      await awaitActionable('t1', { ...http, intervalMs: 5, timeoutMs: 1000 }),
    ).toMatchObject({ kind: 'error' });
    expect(http.methods).toEqual(['GET', 'GET', 'GET']);
  });

  it('does not repeatedly probe a quota response', async () => {
    const http = await fixture([429]);
    expect(
      await awaitActionable('t1', { ...http, intervalMs: 5, timeoutMs: 1000 }),
    ).toMatchObject({ kind: 'error', reason: 'quota_exceeded' });
    expect(http.methods).toEqual(['GET']);
  });

  it('returns an observation deadline, not a fabricated worker failure', async () => {
    const http = await fixture([task()]);
    expect(
      await awaitActionable('t1', { ...http, intervalMs: 5, timeoutMs: 40 }),
    ).toMatchObject({ kind: 'timeout' });
    expect(http.methods.every((method) => method === 'GET')).toBe(true);
  });

  it('bounds a response whose headers arrive but whose body never completes', async () => {
    const http = await fixture([-1]);
    const result = await Promise.race([
      awaitActionable('t1', { ...http, intervalMs: 5, timeoutMs: 40 }),
      new Promise((resolve) => setTimeout(() => resolve('hung'), 500)),
    ]);
    expect(result).toMatchObject({ kind: 'timeout' });
  });
});

describe('await CLI arguments', () => {
  it('keeps flag values out of the task id', () => {
    expect(
      parseAwaitArgs(['--timeout-ms', '1000', 't1', '--until-actionable']),
    ).toMatchObject({ taskId: 't1', timeoutMs: 1000, untilActionable: true });
  });
  it.each([
    ['t1', '--until-actionable', '--once'],
    ['t1', '--timeout-ms', 'NaN'],
    ['t1', '--timeout-ms', '0'],
    ['t1', '--unknown'],
  ])('rejects invalid arguments before observing work: %j', (...args) => {
    expect(() => parseAwaitArgs(args)).toThrow();
  });
});

describe('actionable S3 metadata and uncertainty controls', () => {
  it('uses the canonical generation without exposing full content', async () => {
    const current = task({
      status: 'verified',
      branchName: 'candidate',
      commitSha: 'a'.repeat(40),
      reviewComments: 'x'.repeat(9000),
    });
    const http = await fixture([current]);
    const result = await awaitActionable('t1', { ...http, timeoutMs: 1000 });
    expect(result).toMatchObject({
      kind: 'done',
      meta: {
        resultGeneration: describeAifTask(current, 't1').meta.resultGeneration,
        candidate: { branch: 'candidate', commitSha: 'a'.repeat(40) },
        attempt: null,
        acceptance: 'unverified',
        nextAction: { state: 'pending' },
      },
    });
    expect(result).not.toHaveProperty('content');
    expect(JSON.stringify(result)).not.toContain('x'.repeat(1000));
  });
  it('holds adverse advisory before done and bounds the compact prerequisite', async () => {
    const current = task({
      status: 'done',
      reviewComments: 'zero code ' + 'x'.repeat(9000),
    });
    const http = await fixture([current]);
    const result = await awaitActionable('t1', { ...http, timeoutMs: 1000 });
    expect(result).toMatchObject({
      kind: 'unknown',
      reason: 'adverse_review_advisory',
      meta: {
        held: 'advisory',
        acceptance: 'unverified',
        nextAction: { state: 'pending' },
      },
    });
    expect(result.meta.nextAction.prerequisite.length).toBeLessThanOrEqual(600);
    expect(result.meta.source).toBe('/tasks/t1');
  });
  it('keeps pause subordinate to a park and never treats metadata as approval', async () => {
    const http = await fixture([
      task({ status: 'done', paused: true, blockedReason: 'z'.repeat(9000) }),
    ]);
    const r = await awaitActionable('t1', { ...http, timeoutMs: 1000 });
    expect(r.kind).toBe('parked');
    expect(r.reason!.length).toBeLessThanOrEqual(300);
    expect(r.meta.nextAction.prerequisite.length).toBeLessThanOrEqual(600);
    expect(r.meta.acceptance).toBe('unverified');
  });
  it.each([
    { paused: 'false' },
    { commitSha: 'not-a-sha' },
    { title: 42 },
    { status: null },
    { id: 'other' },
  ])(
    'rejects invalid detail without lending it a generation: %j',
    async (patch) => {
      const http = await fixture([task({ status: 'done', ...patch })]);
      const result = await awaitActionable('t1', {
        ...http,
        intervalMs: 5,
        timeoutMs: 1000,
      });
      expect(result).toMatchObject({
        kind: 'unknown',
        meta: {
          held: 'unresolved',
          resultGeneration: null,
          candidate: { branch: null, commitSha: null },
        },
      });
      expect(http.paths).toHaveLength(1);
    },
  );
  it.each([401, 403, 404, 429])(
    'surfaces HTTP%s once instead of transport retry',
    async (code) => {
      const http = await fixture([code]);
      expect(
        await awaitActionable('t1', {
          ...http,
          intervalMs: 5,
          timeoutMs: 1000,
        }),
      ).toMatchObject({
        kind: 'error',
        reason: code === 429 ? 'quota_exceeded' : 'dispatch_failed',
      });
      expect(http.paths).toHaveLength(1);
    },
  );
  it('retains only the latest validated rework generation on timeout', async () => {
    const old = task({ branchName: 'old', commitSha: 'a'.repeat(40) });
    const current = task({
      status: 'implementing',
      branchName: 'new',
      commitSha: 'b'.repeat(40),
    });
    const http = await fixture([old, current]);
    const result = await awaitActionable('t1', {
      ...http,
      intervalMs: 5,
      timeoutMs: 100,
    });
    expect(result).toMatchObject({
      kind: 'timeout',
      reason: 'observation_deadline_not_worker_failure',
      meta: {
        resultGeneration: describeAifTask(current, 't1').meta.resultGeneration,
        candidate: { branch: 'new', commitSha: 'b'.repeat(40) },
        held: 'unresolved',
      },
    });
    expect(result.meta.resultGeneration).not.toBe(
      describeAifTask(old, 't1').meta.resultGeneration,
    );
  });
  it('retains valid identity through three unavailable reads', async () => {
    const current = task({ branchName: 'candidate' });
    const http = await fixture([current, 0]);
    expect(
      await awaitActionable('t1', { ...http, intervalMs: 5, timeoutMs: 1000 }),
    ).toMatchObject({
      kind: 'error',
      meta: {
        resultGeneration: describeAifTask(current, 't1').meta.resultGeneration,
        held: 'unresolved',
      },
    });
    expect(http.paths).toHaveLength(4);
  });
  it('healthy reads reset the consecutive transport budget', async () => {
    const http = await fixture([0, 0, task(), 0, 0, task({ status: 'done' })]);
    expect(
      await awaitActionable('t1', { ...http, intervalMs: 5, timeoutMs: 1000 }),
    ).toMatchObject({ kind: 'done' });
    expect(http.paths).toHaveLength(6);
  });
  it('rejects unsupported deadlines and intervals before any request', async () => {
    const http = await fixture([task({ status: 'done' })]);
    for (const timeoutMs of [NaN, Infinity, 0, -1, 1.5, 2147483648]) {
      await expect(
        awaitActionable('t1', { ...http, timeoutMs }),
      ).rejects.toThrow();
    }
    await expect(
      awaitActionable('t1', { ...http, timeoutMs: 1000, intervalMs: NaN }),
    ).rejects.toThrow();
    expect(http.paths).toHaveLength(0);
    for (const args of [
      ['t1', '--until-actionable'],
      ['t1', '--timeout-ms', '2147483648'],
      ['t1', '--timeout-ms', '1.5'],
    ])
      expect(() => parseAwaitArgs(args)).toThrow();
  });
});
