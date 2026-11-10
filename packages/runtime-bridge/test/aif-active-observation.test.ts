import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import type { Socket } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { awaitTaskDone, describeAifTask, type WebSocketConstructor } from '../src/aifWsStatus.js';
import { getJson } from '../src/cli/aifHttp.js';

const task = { id: 'active-task', title: 'Current result', status: 'done', commitSha: 'a'.repeat(40), paused: false };
const tick = () => new Promise<void>((done) => setTimeout(done, 0));
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

function sockets() {
  const all: FakeSocket[] = [];
  class FakeSocket {
    onopen: (() => void) | null = null;
    onmessage: ((e: { data: string }) => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: (() => void) | null = null;
    closed = 0;
    constructor() { all.push(this); }
    close() { this.closed++; }
    signal(status = 'done') { this.onmessage?.({ data: JSON.stringify({ type: 'task:updated', payload: { id: task.id, title: task.title, status } }) }); }
  }
  return { all, Ctor: FakeSocket as unknown as WebSocketConstructor };
}
function response(value: unknown) { return new Response(JSON.stringify(value), { status: 200 }); }
function deferred<T>() {
  let complete!: (value: T) => void;
  const promise = new Promise<T>((done) => { complete = done; });
  return { promise, complete };
}
function wait(Ctor: WebSocketConstructor, timeoutMs = 250, extra = {}) {
  return awaitTaskDone({ taskId: task.id, wsUrl: 'ws://127.0.0.1:3009/ws', WebSocketImpl: Ctor, timeoutMs, ...extra });
}

describe('active authoritative observation (events are invalidations, never results)', () => {
  it('subscribes before initial read and consumes completion before attachment without another event', async () => {
    const { all, Ctor } = sockets();
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response(task));
    const result = wait(Ctor);
    expect(fetch).not.toHaveBeenCalled();
    all[0]!.onopen?.();
    expect(await result).toMatchObject({ success: true, meta: { resultGeneration: describeAifTask(task, task.id).meta.resultGeneration } });
    expect(all[0]!.closed).toBe(1);
  });

  it('completion between subscription and snapshot invalidates the older observation', async () => {
    const { all, Ctor } = sockets();
    const initial = deferred<Response>();
    vi.spyOn(globalThis, 'fetch').mockReturnValueOnce(initial.promise).mockResolvedValue(response({ ...task, commitSha: 'b'.repeat(40) }));
    const result = wait(Ctor);
    all[0]!.onopen?.();
    all[0]!.signal();
    initial.complete(response(task));
    expect(await result).toMatchObject({ meta: { candidate: { commitSha: 'b'.repeat(40) } } });
  });

  it('ignores obsolete socket messages/closes/errors and its pending snapshot after reconnect', async () => {
    const { all, Ctor } = sockets();
    const initial = deferred<Response>();
    let current = { ...task, status: 'implementing', commitSha: 'b'.repeat(40) };
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => initial.promise).mockImplementation(async () => response(current));
    const result = wait(Ctor, 800);
    let settled = false;
    void result.then(() => { settled = true; });
    all[0]!.onopen?.();
    all[0]!.onclose?.();
    await new Promise((done) => setTimeout(done, 120));
    all[1]!.onopen?.();
    await tick();
    const reads = fetch.mock.calls.length;
    all[0]!.signal(); all[0]!.onclose?.(); all[0]!.onerror?.();
    initial.complete(response(task));
    await tick();
    expect(settled).toBe(false);
    expect(fetch.mock.calls.length).toBe(reads);
    current = { ...current, status: 'done' };
    all[1]!.signal();
    expect(await result).toMatchObject({ meta: { candidate: { commitSha: 'b'.repeat(40) } } });
    expect(all).toHaveLength(2);
  });

  it('reconciles completion during disconnection on the next open without a frame', async () => {
    const { all, Ctor } = sockets();
    let current = { ...task, status: 'implementing' };
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => response(current));
    const result = wait(Ctor, 800);
    all[0]!.onopen?.(); await tick(); all[0]!.onclose?.();
    current = { ...current, status: 'done' };
    await new Promise((done) => setTimeout(done, 120));
    all[1]!.onopen?.();
    expect(await result).toMatchObject({ success: true, finalStatus: 'done' });
  });

  it('duplicate signals settle once from detail; malformed payloads cannot settle', async () => {
    const { all, Ctor } = sockets();
    const detail = deferred<Response>();
    const fetch = vi.spyOn(globalThis, 'fetch').mockReturnValueOnce(detail.promise).mockResolvedValue(response(task));
    const result = wait(Ctor);
    let settlements = 0;
    void result.then(() => { settlements++; });
    all[0]!.onopen?.();
    for (const payload of [null, 'bad', {}]) all[0]!.onmessage?.({ data: JSON.stringify({ type: 'task:updated', payload }) });
    all[0]!.signal(); all[0]!.signal();
    detail.complete(response(task));
    expect(await result).toMatchObject({ success: true });
    all[0]!.signal(); await tick();
    expect(settlements).toBe(1);
    expect(all[0]!.closed).toBe(1);
    expect(fetch.mock.calls.length).toBe(2);
  });

  it('stale terminal hints do not end rework; deadline retains its validated generation', async () => {
    const { all, Ctor } = sockets();
    const rework = { ...task, status: 'implementing', commitSha: 'b'.repeat(40) };
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => response(rework));
    const result = wait(Ctor, 40).catch((e: unknown) => e);
    all[0]!.onopen?.(); await tick(); all[0]!.signal();
    expect(await result).toMatchObject({ code: 'timeout', observed: { candidate: { commitSha: rework.commitSha }, resultGeneration: describeAifTask(rework, task.id).meta.resultGeneration } });
  });

  it.each([{ paused: true }, { manualReviewRequired: true }, { status: 'blocked_external' }, { status: 'cancelled' }])('retains an intentional hold before any success: %j', async (patch) => {
    const { all, Ctor } = sockets();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({ ...task, ...patch }));
    const result = wait(Ctor);
    all[0]!.onopen?.();
    expect(await result).toMatchObject({ success: false, meta: { acceptance: 'unverified', nextAction: { state: 'pending' } } });
  });

  it('observation abort cancels queued reconnect without cancelling the task', async () => {
    const { all, Ctor } = sockets();
    const controller = new AbortController();
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({ ...task, status: 'implementing' }));
    const result = wait(Ctor, 800, { signal: controller.signal }).catch((e: unknown) => e);
    all[0]!.onopen?.(); await tick(); all[0]!.onclose?.(); controller.abort();
    expect(await result).toMatchObject({ code: 'unavailable', observed: { candidate: { commitSha: task.commitSha } } });
    await new Promise((done) => setTimeout(done, 120));
    expect(all).toHaveLength(1);
    expect(fetch.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true);
  });

  it('successful opens do not reset the total reconnect budget', async () => {
    const { all, Ctor } = sockets();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => response({ ...task, status: 'implementing' }));
    const result = wait(Ctor, 1500, { maxReconnectAttempts: 2 }).catch((e: unknown) => e);
    for (let i = 0; i < 3; i++) {
      all[i]!.onopen?.(); await tick(); all[i]!.onclose?.();
      if (i < 2) await new Promise((done) => setTimeout(done, 120));
    }
    expect(await result).toMatchObject({ code: 'unavailable' });
    expect(all).toHaveLength(3);
  });

  it('omitted timeout is bounded and invalid explicit durations open no connection', async () => {
    vi.useFakeTimers();
    const { all, Ctor } = sockets();
    const result = awaitTaskDone({ taskId: task.id, wsUrl: 'ws://127.0.0.1/ws', WebSocketImpl: Ctor }).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(3_600_001);
    expect(await result).toMatchObject({ code: 'timeout' });
    expect(all[0]!.closed).toBe(1);
    for (const timeoutMs of [0, -1, Infinity, NaN]) {
      await expect(wait(Ctor, timeoutMs)).rejects.toThrow();
    }
    expect(all).toHaveLength(1);
  });
});

describe('actual HTTP, WebSocket and subprocess reader boundaries', () => {
  it('HTTP deadline includes a stalled response body and restores a valid control', async () => {
    let stalled = true;
    let statusCode = 200;
    const peers = new Set<Socket>();
    const server = createServer((_req, res) => {
      res.writeHead(statusCode, { 'content-type': 'application/json' });
      if (stalled) { res.write('{'); } else res.end(JSON.stringify(task));
    });
    server.on('connection', (s) => { peers.add(s); s.on('close', () => peers.delete(s)); });
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    try {
      const read = getJson(url, '/tasks/active-task', { timeoutMs: 30 }).then(() => 'unexpected-success', () => 'bounded');
      expect(await Promise.race([read, new Promise((done) => setTimeout(() => done('unbounded'), 180))])).toBe('bounded');
      stalled = false;
      expect(await getJson(url, '/tasks/active-task', { timeoutMs: 1000 })).toMatchObject(task);
      stalled = true; statusCode = 429;
      // Known quota status must survive an unreadable error body; otherwise callers
      // can misclassify quota as transient transport and retry it.
      await expect(getJson(url, '/tasks/active-task', { timeoutMs: 30 })).rejects.toMatchObject({ code: 'quota_exceeded' });
    } finally {
      for (const s of peers) s.destroy();
      await new Promise<void>((done) => server.close(() => done()));
    }
  });

  it('real CLI reads an already-finished task then explicit resume reconciles a new generation, with zero effects', async () => {
    let current: Record<string, unknown> = { ...task };
    const requests: string[] = [];
    const peers = new Set<Socket>();
    let subscribed = false;
    let detailBeforeSubscription = false;
    const server = createServer((req, res) => {
      requests.push(`${req.method} ${req.url}`);
      if (req.url === '/tasks/active-task') {
        if (!subscribed) detailBeforeSubscription = true;
        res.end(JSON.stringify(current));
      } else if (req.url === '/health') res.end('{}');
      else { res.statusCode = 405; res.end('{}'); }
    });
    server.on('connection', (s) => { peers.add(s); s.on('close', () => peers.delete(s)); });
    server.on('upgrade', (req, sock) => {
      const accept = createHash('sha1').update(`${req.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
      subscribed = true;
      sock.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
      sock.on('data', () => sock.end());
    });
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    const baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    const root = fileURLToPath(new URL('../../../', import.meta.url));
    const reader = (args: string[]) => new Promise<{ code: number | null; stdout: string }>((done, reject) => {
      const child = spawn(resolve(root, 'node_modules/.bin/tsx'), args, {
        cwd: root, env: { ...process.env, RUNTIME_BRIDGE_MODE: 'aif-handoff', RUNTIME_BRIDGE_AIF_URL: baseUrl, RUNTIME_BRIDGE_RESULT_OWNER: 'codex:s4-test-owner' }, stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = ''; child.stdout.on('data', (x) => { stdout += String(x); });
      child.stderr.resume(); child.on('error', reject); child.on('close', (code) => done({ code, stdout }));
    });
    const cli = (once = false, args = once ? ['--once'] : ['--timeout-ms', '800']) => reader(['packages/runtime-bridge/src/cli/await.ts', task.id, ...args]);
    try {
      expect((await cli(false, ['--timeout-ms', '0'])).code).toBe(1);
      expect(requests).toHaveLength(0);
      const first = await cli();
      expect(first.code).toBe(0);
      expect(detailBeforeSubscription).toBe(false);
      const observed = JSON.parse(first.stdout) as { meta: { resultGeneration: string } };
      // The delivered production backend must also consume an already-finished
      // task through a real socket and REST, without importing vendor into tsc's
      // source roots. The existing factory test separately verifies actual copy.
      const delivered = pathToFileURL(resolve(root, 'packages/runtime-bridge/vendor/src/AifHandoffBackend.ts')).href;
      const vendor = await reader(['--eval', `import(${JSON.stringify(delivered)}).then(async ({AifHandoffBackend}) => {
        const backend = new AifHandoffBackend({baseUrl:${JSON.stringify(baseUrl)}});
        const result = await backend.awaitDone({backend:'aif-handoff',taskId:${JSON.stringify(task.id)}}, 500);
        process.stdout.write(JSON.stringify(result));
      }).catch(e=>{console.error(e);process.exit(1)})`]);
      expect(vendor.code).toBe(0);
      expect(JSON.parse(vendor.stdout)).toMatchObject({ success: true, meta: { resultGeneration: observed.meta.resultGeneration } });
      const repeated = JSON.parse((await cli(true)).stdout) as typeof observed;
      expect(repeated.meta.resultGeneration).toBe(observed.meta.resultGeneration);
      // No actual effect receipt exists. Readers must keep the next action pending,
      // including after a new rework result and an intentional owner pause.
      current = { ...task, commitSha: 'b'.repeat(40), paused: true };
      const resumed = await cli(true);
      expect(resumed.code).toBe(1);
      expect(JSON.parse(resumed.stdout).meta).toMatchObject({ candidate: { commitSha: 'b'.repeat(40) }, acceptance: 'unverified', nextAction: { state: 'pending', ownerReference: 'codex:s4-test-owner' } });
      expect(JSON.parse(resumed.stdout).meta.resultGeneration).not.toBe(observed.meta.resultGeneration);
      current = { ...task, status: 'implementing', commitSha: 'b'.repeat(40) };
      const uncertain = await cli();
      expect(uncertain.code).toBe(1);
      expect(JSON.parse(uncertain.stdout)).toMatchObject({ success: false, finalStatus: 'unknown', meta: { held: 'unresolved', candidate: { commitSha: 'b'.repeat(40) }, resultGeneration: describeAifTask(current as typeof task, task.id).meta.resultGeneration, nextAction: { state: 'pending' } } });
      expect(requests.every((s) => s.startsWith('GET '))).toBe(true);
    } finally {
      for (const s of peers) s.destroy();
      await new Promise<void>((done) => server.close(() => done()));
    }
  });
});
