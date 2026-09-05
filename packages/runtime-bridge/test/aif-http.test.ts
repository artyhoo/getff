// packages/runtime-bridge/test/aif-http.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { BackendError } from '../src/backend.js';
import { getTask, putTask, postJson, getJson, DEFAULT_HTTP_TIMEOUT_MS } from '../src/cli/aifHttp.js';

function okResponse(body: unknown = {}, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

afterEach(() => vi.restoreAllMocks());

describe('getTask', () => {
  it('GETs /tasks/:id and returns the parsed task', async () => {
    const task = { id: 't-1', title: 'x', status: 'implementing', plan: 'P', paused: false, blockedReason: null };
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(task));
    const got = await getTask('http://localhost:3009', 't-1');
    expect(spy.mock.calls[0][0]).toBe('http://localhost:3009/tasks/t-1');
    expect((spy.mock.calls[0][1] as RequestInit).method).toBe('GET');
    expect(got).toEqual(task);
  });
  it('maps a non-ok status to a dispatch_failed BackendError', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse({ error: 'nope' }, 404));
    await expect(getTask('http://localhost:3009', 't-x')).rejects.toMatchObject({ code: 'dispatch_failed' });
  });
});

describe('putTask', () => {
  it('PUTs /tasks/:id with the JSON body', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse({ id: 't-1', paused: true }));
    await putTask('http://localhost:3009', 't-1', { paused: true });
    expect(spy.mock.calls[0][0]).toBe('http://localhost:3009/tasks/t-1');
    const init = spy.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string)).toEqual({ paused: true });
  });
  it('maps connection refusal to an unavailable BackendError', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(putTask('http://localhost:3009', 't-1', {})).rejects.toBeInstanceOf(BackendError);
  });
});

// ── R-7 / S-4 (#1597 ledger): one request() per tree. `answer.ts post()` was a verbatim
// copy of request() with the method fixed to POST, and `aifWsStatus.getTaskStatus` a third
// hand-written GET /tasks/:id with its OWN mapping — which is where the divergence showed:
// getTaskStatus aborted after 5 s while request() had no timeout at all, so park / answer /
// harvest hung forever on a wedged aif API that the status probe timed out against; and
// getTaskStatus was missing the 429 → quota_exceeded branch the CLIs had. ──
describe('postJson — the shared POST half (S-4)', () => {
  it('POSTs the JSON body and returns the parsed response', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse({ ok: true }));
    const got = await postJson('http://localhost:3009', '/tasks/t-1/comments', { message: 'hi' });
    const init = spy.mock.calls[0][1] as RequestInit;
    expect(spy.mock.calls[0][0]).toBe('http://localhost:3009/tasks/t-1/comments');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ message: 'hi' });
    expect(got).toEqual({ ok: true });
  });

  it('maps 429 to quota_exceeded (the mapping the CLIs share)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse({ error: 'slow down' }, 429));
    await expect(postJson('http://localhost:3009', '/tasks/t-1/events', {})).rejects.toMatchObject({
      code: 'quota_exceeded',
    });
  });

  it('maps connection refusal to unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(postJson('http://localhost:3009', '/tasks/t-1/events', {})).rejects.toBeInstanceOf(
      BackendError,
    );
  });
});

describe('request timeout — no CLI hangs forever on a wedged API (R-7)', () => {
  it('aborts after timeoutMs and reports unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_url, init) =>
        new Promise((_ok, reject) => {
          (init as RequestInit).signal?.addEventListener('abort', () =>
            reject(new DOMException('The operation was aborted.', 'AbortError')),
          );
        }),
    );

    await expect(
      getJson('http://localhost:3009', '/tasks/t-1', { timeoutMs: 25 }),
    ).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('every request carries a default timeout (the CLIs used to have none at all)', () => {
    expect(DEFAULT_HTTP_TIMEOUT_MS).toBeGreaterThan(0);
  });

  it('a 404 maps to the caller-chosen code (getTaskStatus keeps its unavailable contract)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse({ error: 'gone' }, 404));
    await expect(
      getJson('http://localhost:3009', '/tasks/t-x', { notFoundCode: 'unavailable' }),
    ).rejects.toMatchObject({ code: 'unavailable' });
  });
});
