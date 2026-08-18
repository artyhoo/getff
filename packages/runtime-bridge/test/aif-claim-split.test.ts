/**
 * Two-phase dispatch — claim / release / cancelClaim (spec §5.3, D-H5/P-5).
 *
 * The load-bearing assertion here is the SEAM, not the HTTP verbs: after claim()
 * returns, the task must exist and still be paused. If claim() ever unpauses, the
 * Phase -1 window closes again and the whole split buys nothing — the observable
 * marker would once more appear only after the work had started.
 *
 * The second load-bearing pair is the rollback split: release() leaves a failed claim
 * standing (the caller owns the decision), while dispatch() still cancels it — the
 * pre-split behaviour that aif-rest-dispatch.test.ts pins.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { AifHandoffBackend } from '../src/AifHandoffBackend.js';
import { ManualBackend } from '../src/ManualBackend.js';
import { supportsClaims } from '../src/backend.js';
import { parseClaimArgs, requireClaimBackend, handleFromTaskId } from '../src/cli/claim.js';
import type { KickoffSpec } from '../src/types.js';

const KICKOFF: KickoffSpec = {
  filePath: '/repo/.claude/orchestrator-prompts/demo-umbrella/kickoff.md',
  content: '# Demo kickoff\nDo the thing.\n',
  umbrellaName: 'demo-umbrella',
  contentHash: 'abc123',
};

interface Call {
  url: string;
  method: string;
  body: Record<string, unknown> | undefined;
}

/** Mock fetch; `failOn` marks a method+path suffix that should answer 4xx. */
function mockRest(calls: Call[], failOn?: { method: string; suffix: string }): void {
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
      calls.push({ url, method, body });
      if (failOn && method === failOn.method && url.endsWith(failOn.suffix)) {
        return Promise.resolve(new Response('nope', { status: 400 }));
      }
      if (method === 'GET' && url.endsWith('/projects')) {
        return Promise.resolve(
          new Response(JSON.stringify([{ id: 'proj-uuid', parallelEnabled: true }]), { status: 200 }),
        );
      }
      if (method === 'POST' && url.endsWith('/tasks')) {
        return Promise.resolve(
          new Response(JSON.stringify({ id: 'task-123', status: 'backlog' }), { status: 201 }),
        );
      }
      return Promise.resolve(new Response('', { status: 200 }));
    },
  );
}

const backend = (): AifHandoffBackend =>
  new AifHandoffBackend({ baseUrl: 'http://localhost:3009', projectId: 'proj-uuid' });

afterEach(() => {
  vi.restoreAllMocks();
});

// ── The seam: a claim is created and NOT started ──────────────────────────────

describe('claim() — phase 1 creates a paused task and stops', () => {
  it('POSTs the task with paused:true and issues NO unpause PUT', async () => {
    const calls: Call[] = [];
    mockRest(calls);

    const handle = await backend().claim(KICKOFF);

    expect(handle.taskId).toBe('task-123');
    expect(handle.backend).toBe('aif-handoff');

    const post = calls.find((c) => c.method === 'POST' && c.url.endsWith('/tasks'));
    expect(post?.body).toMatchObject({ paused: true, autoMode: true, description: KICKOFF.content });

    // This is the whole point of the split — no unpause inside the claim half.
    expect(calls.filter((c) => c.method === 'PUT' && c.body?.['paused'] === false)).toHaveLength(0);
  });

  it('titles the claim with the umbrella slug — that is what makes it probe-findable', async () => {
    const calls: Call[] = [];
    mockRest(calls);
    await backend().claim(KICKOFF);
    const post = calls.find((c) => c.method === 'POST' && c.url.endsWith('/tasks'));
    expect(post?.body?.['title']).toBe('demo-umbrella');
  });

  it('a failed create leaves nothing to roll back (no DELETE fired)', async () => {
    const calls: Call[] = [];
    mockRest(calls, { method: 'POST', suffix: '/tasks' });
    await expect(backend().claim(KICKOFF)).rejects.toThrow(/HTTP 400/);
    expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(0);
  });

  it('throws before any fetch when projectId is unset', async () => {
    const calls: Call[] = [];
    mockRest(calls);
    await expect(new AifHandoffBackend({ baseUrl: 'http://x' }).claim(KICKOFF)).rejects.toThrow(
      /requires projectId/,
    );
    expect(calls).toHaveLength(0);
  });
});

// ── Phase 2 + the cancel branch ───────────────────────────────────────────────

describe('release() / cancelClaim() — phase 2 and the RED branch', () => {
  it('release() clears paused on the claimed task', async () => {
    const calls: Call[] = [];
    mockRest(calls);
    const handle = await backend().claim(KICKOFF);
    await backend().release(handle);
    const put = calls.find((c) => c.method === 'PUT' && c.url.endsWith('/tasks/task-123'));
    expect(put?.body).toMatchObject({ paused: false });
  });

  it('a failed release leaves the claim STANDING — the caller owns the rollback', async () => {
    const calls: Call[] = [];
    mockRest(calls, { method: 'PUT', suffix: '/tasks/task-123' });
    await expect(backend().release(handleFromTaskId('task-123'))).rejects.toThrow(/HTTP 400/);
    expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(0);
  });

  it('cancelClaim() DELETEs the task — the Phase -1 RED branch', async () => {
    const calls: Call[] = [];
    mockRest(calls);
    await backend().cancelClaim(handleFromTaskId('task-123'));
    expect(calls.filter((c) => c.method === 'DELETE' && c.url.endsWith('/tasks/task-123'))).toHaveLength(1);
  });

  it('cancelClaim() is best-effort — a failing DELETE resolves, it does not throw', async () => {
    const calls: Call[] = [];
    mockRest(calls, { method: 'DELETE', suffix: '/tasks/task-123' });
    await expect(backend().cancelClaim(handleFromTaskId('task-123'))).resolves.toBe(false);
  });

  it('cancelClaim() treats 404 as success — cancelling twice is not a failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response('task not found', { status: 404 })),
    );
    await expect(backend().cancelClaim(handleFromTaskId('task-123'))).resolves.toBe(true);
  });

  it('cancelClaim() still reports a REAL failure (500) as not-cancelled', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response('boom', { status: 500 })),
    );
    await expect(backend().cancelClaim(handleFromTaskId('task-123'))).resolves.toBe(false);
  });

  it('cancelClaim() REPORTS the outcome — best-effort must not mean unreported', async () => {
    // Found in pre-handoff self-review: the CLI printed "lane is free" on a failed
    // DELETE, so the next probe would block on a claim the operator was told was gone.
    const ok: Call[] = [];
    mockRest(ok);
    await expect(backend().cancelClaim(handleFromTaskId('task-123'))).resolves.toBe(true);
  });
});

// ── dispatch() is claim+release, behaviour unchanged ──────────────────────────

describe('dispatch() — composed from the two halves, old semantics kept', () => {
  it('ignores a FAILED rollback delete and still throws the release error', async () => {
    const calls: Call[] = [];
    // Both the unpause AND the rollback delete fail: dispatch must surface the
    // release failure, never the delete's, and must not hang on the boolean.
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? 'GET';
        calls.push({ url, method, body: undefined });
        if (method === 'GET' && url.endsWith('/projects')) {
          return Promise.resolve(
            new Response(JSON.stringify([{ id: 'proj-uuid', parallelEnabled: true }]), {
              status: 200,
            }),
          );
        }
        if (method === 'POST' && url.endsWith('/tasks')) {
          return Promise.resolve(new Response(JSON.stringify({ id: 'task-123' }), { status: 201 }));
        }
        return Promise.resolve(new Response('nope', { status: 400 }));
      },
    );
    await expect(backend().dispatch(KICKOFF)).rejects.toThrow(/PUT \/tasks\/task-123 HTTP 400/);
    expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(1);
  });

  it('still runs create THEN unpause in that order', async () => {
    const calls: Call[] = [];
    mockRest(calls);
    await backend().dispatch(KICKOFF);
    const postIdx = calls.findIndex((c) => c.method === 'POST' && c.url.endsWith('/tasks'));
    const putIdx = calls.findIndex((c) => c.method === 'PUT' && c.body?.['paused'] === false);
    expect(postIdx).toBeGreaterThanOrEqual(0);
    expect(putIdx).toBeGreaterThan(postIdx);
  });

  it('still rolls the claim back when the unpause fails (pre-split contract)', async () => {
    const calls: Call[] = [];
    mockRest(calls, { method: 'PUT', suffix: '/tasks/task-123' });
    await expect(backend().dispatch(KICKOFF)).rejects.toThrow(/HTTP 400/);
    expect(calls.filter((c) => c.method === 'DELETE' && c.url.endsWith('/tasks/task-123'))).toHaveLength(1);
  });
});

// ── The capability probe + the CLI surface ────────────────────────────────────

describe('supportsClaims() — a backend with no queue cannot hold a claim', () => {
  it('aif-handoff can', () => expect(supportsClaims(backend())).toBe(true));
  it('manual cannot (paired negative)', () => expect(supportsClaims(new ManualBackend())).toBe(false));
  it('requireClaimBackend refuses manual loudly rather than falling back', () => {
    const refusal = requireClaimBackend(new ManualBackend());
    expect(refusal?.error).toMatch(/cannot hold a claim/);
  });
  it('requireClaimBackend passes aif-handoff through', () =>
    expect(requireClaimBackend(backend())).toBeNull());
});

describe('claim CLI argument parsing', () => {
  it.each([
    ['create', '/k.md'],
    ['release', 'task-1'],
    ['cancel', 'task-1'],
  ])('accepts %s', (verb, arg) => expect(parseClaimArgs([verb, arg])).toEqual({ verb, arg }));

  it('rejects an unknown verb', () =>
    expect(parseClaimArgs(['start', 'x'])).toEqual({ error: expect.stringMatching(/unknown verb/) }));
  it('rejects a missing verb', () =>
    expect(parseClaimArgs([])).toEqual({ error: expect.stringMatching(/unknown verb/) }));
  it('rejects create with no kickoff path', () =>
    expect(parseClaimArgs(['create'])).toEqual({ error: expect.stringMatching(/kickoff path/) }));
  it('rejects release with no taskId', () =>
    expect(parseClaimArgs(['release'])).toEqual({ error: expect.stringMatching(/taskId/) }));
  it('ignores flags when finding positionals', () =>
    expect(parseClaimArgs(['--verbose', 'cancel', 'task-9'])).toEqual({ verb: 'cancel', arg: 'task-9' }));
});
