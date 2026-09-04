/**
 * Tests for AifHandoffBackend.dispatch() over REST (:3009).
 *
 * Verdict source: docs/meta-factory/research-patches/2026-05-31-runtime-bridge-mcp-dispatch-fix.md
 * (REST-now + MCP-target). These tests assert the 4-step planner-skip REST
 * sequence + BackendError mapping. Live HTTP mechanics were verified against a
 * running instance in the R-phase; these unit tests lock the contract.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { AifHandoffBackend } from '../src/AifHandoffBackend.js';
import { BackendError } from '../src/backend.js';
import type { KickoffSpec } from '../src/types.js';

const KICKOFF: KickoffSpec = {
  filePath: '/repo/.claude/orchestrator-prompts/demo-meta-launch/kickoff.md',
  content: '# Demo kickoff\nDo the thing.\n',
  umbrellaName: 'demo-meta-launch',
  contentHash: 'abc123',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AifHandoffBackend.dispatch() — REST 4-step sequence', () => {
  it('creates the task with the kickoff as DESCRIPTION (planner input), then unpauses — NO accept_existing_plan, NO plan push', async () => {
    const calls: Array<{ url: string; method: string; body: Record<string, unknown> | undefined }> =
      [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? 'GET';
        const body = init?.body
          ? (JSON.parse(String(init.body)) as Record<string, unknown>)
          : undefined;
        calls.push({ url, method, body });
        // Step 0: ensureParallelEnabled GETs /projects — return the project
        // already parallel-enabled so the guard is a no-op (no PUT).
        if (method === 'GET' && url.endsWith('/projects')) {
          return Promise.resolve(jsonResponse([{ id: 'proj-uuid', parallelEnabled: true }], 200));
        }
        // Step 1 (POST /tasks) returns the created task with an id.
        if (method === 'POST' && url.endsWith('/tasks')) {
          return Promise.resolve(jsonResponse({ id: 'task-123', status: 'backlog' }, 201));
        }
        return Promise.resolve(new Response('', { status: 200 }));
      },
    );

    const backend = new AifHandoffBackend({
      baseUrl: 'http://localhost:3009',
      projectId: 'proj-uuid',
    });
    const handle = await backend.dispatch(KICKOFF);

    expect(handle.backend).toBe('aif-handoff');
    expect(handle.taskId).toBe('task-123');

    // POST /tasks carries the kickoff in `description` (the planner's input spec),
    // paused + autoMode so the auto-queue advances it through `planning`.
    const post = calls.find((c) => c.method === 'POST' && c.url.endsWith('/tasks'));
    expect(post?.body).toMatchObject({
      projectId: 'proj-uuid',
      description: KICKOFF.content,
      paused: true,
      autoMode: true,
      plannerMode: 'fast',
    });

    // The task is unpaused so the coordinator picks it up at `backlog`.
    const putPaused = calls.find(
      (c) => c.method === 'PUT' && c.url.endsWith('/tasks/task-123') && c.body?.paused === false,
    );
    expect(putPaused).toBeDefined();

    // The whole fix: the planner-skip event is GONE (else no worktree, forced serial).
    expect(calls.some((c) => (c.body as { event?: string } | undefined)?.event === 'accept_existing_plan')).toBe(false);
    // The kickoff does NOT go to the `plan` output slot (the planner overwrites it).
    expect(calls.some((c) => c.body !== undefined && 'plan' in c.body)).toBe(false);
  });

  it('throws dispatch_failed (no fetch) when projectId is unset', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const backend = new AifHandoffBackend({ baseUrl: 'http://localhost:3009' });
    await expect(backend.dispatch(KICKOFF)).rejects.toMatchObject({
      code: 'dispatch_failed',
      backend: 'aif-handoff',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('throws dispatch_failed when POST /tasks returns no id', async () => {
    // mockImplementation → a fresh Response per call (bodies are single-read).
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(jsonResponse({ notAnId: true }, 201)),
    );
    const backend = new AifHandoffBackend({ baseUrl: 'http://localhost:3009', projectId: 'p' });
    const err = await backend.dispatch(KICKOFF).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BackendError);
    // Stays dispatch_failed, NOT spec_invalid: the kickoff is fine, aif answered
    // with a shape we did not expect — an environmental fault, so the
    // ManualBackend fallback must still catch it (isFallbackEligible).
    expect(err).toMatchObject({ code: 'dispatch_failed', backend: 'aif-handoff' });
  });

  it('maps a 4xx on the unpause step to dispatch_failed AND rolls back (DELETE) the half-created task', async () => {
    const calls: Array<{ url: string; method: string }> = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? 'GET';
        calls.push({ url, method });
        if (method === 'POST' && url.endsWith('/tasks')) {
          return Promise.resolve(jsonResponse({ id: 'task-9', status: 'backlog' }, 201));
        }
        // Step 2 (PUT paused:false) fails — the only wrapped step now that the
        // accept_existing_plan event is gone. dispatch() must roll back.
        if (method === 'PUT' && url.endsWith('/tasks/task-9')) {
          return Promise.resolve(
            new Response('Branch isolation failure (dirty_worktree): uncommitted changes', {
              status: 409,
            }),
          );
        }
        return Promise.resolve(new Response('', { status: 200 }));
      },
    );
    const backend = new AifHandoffBackend({ baseUrl: 'http://localhost:3009', projectId: 'p' });
    await expect(backend.dispatch(KICKOFF)).rejects.toMatchObject({
      code: 'dispatch_failed',
      backend: 'aif-handoff',
    });
    // Rollback: the created task must be DELETEd so no orphan is stranded.
    expect(calls).toContainEqual({ url: 'http://localhost:3009/tasks/task-9', method: 'DELETE' });
  });

  it('maps HTTP 429 to quota_exceeded', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('slow down', { status: 429 }));
    const backend = new AifHandoffBackend({ baseUrl: 'http://localhost:3009', projectId: 'p' });
    await expect(backend.dispatch(KICKOFF)).rejects.toMatchObject({ code: 'quota_exceeded' });
  });

  it('maps a connection failure to unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      Object.assign(new Error('fetch failed'), { cause: { code: 'ECONNREFUSED' } }),
    );
    const backend = new AifHandoffBackend({ baseUrl: 'http://localhost:3009', projectId: 'p' });
    await expect(backend.dispatch(KICKOFF)).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('REST dispatch targets baseUrl and never the (reserved) mcpUrl', async () => {
    const urls: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        urls.push(String(input));
        const method = init?.method ?? 'GET';
        if (method === 'POST' && String(input).endsWith('/tasks')) {
          return Promise.resolve(jsonResponse({ id: 't1' }, 201));
        }
        return Promise.resolve(new Response('', { status: 200 }));
      },
    );
    const backend = new AifHandoffBackend({
      baseUrl: 'http://localhost:3009',
      mcpUrl: 'http://localhost:9999', // distinct sentinel — REST dispatch must never hit it
      projectId: 'p',
    });
    await backend.dispatch(KICKOFF);
    expect(backend.mcpUrl).toBe('http://localhost:9999');
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.every((u) => u.startsWith('http://localhost:3009'))).toBe(true);
    expect(urls.some((u) => u.includes(':9999'))).toBe(false);
  });

  it('defaults mcpUrl to :3100 when not configured', () => {
    const backend = new AifHandoffBackend({ baseUrl: 'http://localhost:3009', projectId: 'p' });
    expect(backend.mcpUrl).toBe('http://localhost:3100');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// bridge-profile resolution (multi-model-profile-marker, 2026-07-21)
// ═══════════════════════════════════════════════════════════════════════════════
describe('AifHandoffBackend.dispatch() — profileHint resolution', () => {
  const KICKOFF_WITH_HINT: KickoffSpec = { ...KICKOFF, profileHint: 'GLM' };

  function mockWithProfiles(profiles: Array<{ id: string; name: string }>) {
    const calls: Array<{ url: string; method: string; body: Record<string, unknown> | undefined }> =
      [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? 'GET';
        const body = init?.body
          ? (JSON.parse(String(init.body)) as Record<string, unknown>)
          : undefined;
        calls.push({ url, method, body });
        if (method === 'GET' && url.endsWith('/projects')) {
          return Promise.resolve(jsonResponse([{ id: 'proj-uuid', parallelEnabled: true }], 200));
        }
        if (method === 'GET' && url.endsWith('/runtime-profiles')) {
          return Promise.resolve(jsonResponse(profiles, 200));
        }
        if (method === 'POST' && url.endsWith('/tasks')) {
          return Promise.resolve(jsonResponse({ id: 'task-123', status: 'backlog' }, 201));
        }
        return Promise.resolve(new Response('', { status: 200 }));
      },
    );
    return calls;
  }

  it('single case-insensitive substring match → runtimeProfileId included in POST /tasks body', async () => {
    const calls = mockWithProfiles([
      { id: 'opus-id', name: 'Claude Opus (plan+review)' },
      { id: 'glm-id', name: 'Z.AI GLM-5.2' },
    ]);
    const backend = new AifHandoffBackend({ baseUrl: 'http://localhost:3009', projectId: 'proj-uuid' });
    await backend.dispatch(KICKOFF_WITH_HINT);

    const post = calls.find((c) => c.method === 'POST' && c.url.endsWith('/tasks'));
    expect(post?.body).toMatchObject({ runtimeProfileId: 'glm-id' });
  });

  it('no profileHint → GET /runtime-profiles is never called, no runtimeProfileId in POST body (regression guard)', async () => {
    const calls = mockWithProfiles([{ id: 'glm-id', name: 'Z.AI GLM-5.2' }]);
    const backend = new AifHandoffBackend({ baseUrl: 'http://localhost:3009', projectId: 'proj-uuid' });
    await backend.dispatch(KICKOFF); // no profileHint

    expect(calls.some((c) => c.url.endsWith('/runtime-profiles'))).toBe(false);
    const post = calls.find((c) => c.method === 'POST' && c.url.endsWith('/tasks'));
    expect(post?.body && 'runtimeProfileId' in post.body).toBe(false);
  });

  it('zero matches → spec_invalid, loud, naming the empty candidate outcome (no silent fallback)', async () => {
    mockWithProfiles([{ id: 'opus-id', name: 'Claude Opus (plan+review)' }]);
    const backend = new AifHandoffBackend({ baseUrl: 'http://localhost:3009', projectId: 'proj-uuid' });
    const err = await backend.dispatch(KICKOFF_WITH_HINT).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(BackendError);
    expect(err).toMatchObject({ code: 'spec_invalid', backend: 'aif-handoff' });
    expect((err as Error).message).toContain('GLM');
  });

  it('ambiguous (>1) matches → spec_invalid naming BOTH candidates (no guessing)', async () => {
    mockWithProfiles([
      { id: 'glm-a', name: 'Z.AI GLM-5.2 (fast)' },
      { id: 'glm-b', name: 'Z.AI GLM-5.2 (careful)' },
    ]);
    const backend = new AifHandoffBackend({ baseUrl: 'http://localhost:3009', projectId: 'proj-uuid' });
    const err = await backend.dispatch(KICKOFF_WITH_HINT).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(BackendError);
    expect(err).toMatchObject({ code: 'spec_invalid', backend: 'aif-handoff' });
    expect((err as Error).message).toContain('glm-a');
    expect((err as Error).message).toContain('glm-b');
  });

  // Regression: `Z.AI GLM-5.2` is a strict PREFIX of `Z.AI GLM-5.2 SDK`, so pure
  // substring matching made the correct, unambiguous marker value throw
  // dispatch_failed — the exact name was unusable. Observed live 2026-07-23.
  it('exact name match wins over a longer superset name (prefix-related profiles stay usable)', async () => {
    const calls = mockWithProfiles([
      { id: 'glm-api', name: 'Z.AI GLM-5.2' },
      { id: 'glm-sdk', name: 'Z.AI GLM-5.2 SDK' },
    ]);
    const backend = new AifHandoffBackend({
      baseUrl: 'http://localhost:3009',
      projectId: 'proj-uuid',
    });
    await backend.dispatch({ ...KICKOFF, profileHint: 'Z.AI GLM-5.2' });

    const post = calls.find((c) => c.method === 'POST' && c.url.endsWith('/tasks'));
    expect(post?.body).toMatchObject({ runtimeProfileId: 'glm-api' });
  });

  it('exact match stays case-insensitive', async () => {
    const calls = mockWithProfiles([
      { id: 'glm-api', name: 'Z.AI GLM-5.2' },
      { id: 'glm-sdk', name: 'Z.AI GLM-5.2 SDK' },
    ]);
    const backend = new AifHandoffBackend({
      baseUrl: 'http://localhost:3009',
      projectId: 'proj-uuid',
    });
    await backend.dispatch({ ...KICKOFF, profileHint: 'z.ai glm-5.2' });

    const post = calls.find((c) => c.method === 'POST' && c.url.endsWith('/tasks'));
    expect(post?.body).toMatchObject({ runtimeProfileId: 'glm-api' });
  });

  it('a non-exact hint matching several profiles still throws (exact-match short-circuit did NOT weaken the ambiguity guard)', async () => {
    mockWithProfiles([
      { id: 'glm-api', name: 'Z.AI GLM-5.2' },
      { id: 'glm-sdk', name: 'Z.AI GLM-5.2 SDK' },
    ]);
    const backend = new AifHandoffBackend({
      baseUrl: 'http://localhost:3009',
      projectId: 'proj-uuid',
    });
    const err = await backend.dispatch({ ...KICKOFF, profileHint: 'GLM' }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(BackendError);
    expect(err).toMatchObject({ code: 'spec_invalid', backend: 'aif-handoff' });
    expect((err as Error).message).toContain('glm-api');
    expect((err as Error).message).toContain('glm-sdk');
  });
});
