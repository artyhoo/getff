/**
 * Backend semantics the #1597 review ledger found broken (A5-1, A5-2, E-3).
 *
 * A5-1 — `cancel` deletes the ROW, it does not stop the WORKER. aif-handoff's
 *   DELETE /tasks/:id removes the record and broadcasts `task:deleted`, and
 *   nothing outside the web UI consumes that event: the coordinator re-reads the
 *   row only at stage boundaries, so an in-flight stage keeps running headless.
 *   Measured live during the beta night run 2026-09-02 — the container kept
 *   working, the lane stayed blocked, and `tokens=0` on the deleted record proved
 *   nothing. aif-handoff exposes NO stop/kill surface for a running task
 *   (packages/shared/src/types.ts TASK_EVENTS has no stop/abort/cancel member;
 *   packages/api/src/routes/tasks.ts has no such route — checked 2026-09-05), so
 *   the only honest answer is to REFUSE, never a silent DELETE.
 *
 * A5-2 — the profile hint was resolved against GET /runtime-profiles with no
 *   query at all. aif applies no project filter when projectId is absent and
 *   defaults enabledOnly=false, so the candidate set was every project's profiles
 *   plus disabled ones: a name unique in THIS project collides with another
 *   project's and hard-aborts, or a disabled profile's id is written onto the task.
 *
 * E-3 — a missing RUNTIME_BRIDGE_AIF_PROJECT_ID was thrown as `dispatch_failed`
 *   (environmental), which cli/dispatch.ts is contractually allowed to degrade to
 *   ManualBackend + exit 0. It is an operator-fixable defect in the dispatch spec's
 *   required configuration, so it belongs on the abort side of isFallbackEligible.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { AifHandoffBackend } from '../src/AifHandoffBackend.js';
import { BackendError } from '../src/backend.js';
import { describeCancelOutcome, handleFromTaskId } from '../src/cli/claim.js';
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

/**
 * Fake aif REST server. `task` is what GET /tasks/:id serves — the state the
 * cancel guard has to read before it is allowed to DELETE anything.
 */
function mockAif(
  calls: Call[],
  opts: {
    task?: Record<string, unknown> | null;
    taskHttpStatus?: number;
    profiles?: Array<Record<string, unknown>>;
    deleteHttpStatus?: number;
  } = {},
): void {
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      const body = init?.body
        ? (JSON.parse(String(init.body)) as Record<string, unknown>)
        : undefined;
      calls.push({ url, method, body });
      const json = (v: unknown, status = 200): Promise<Response> =>
        Promise.resolve(new Response(JSON.stringify(v), { status }));

      if (method === 'GET' && url.includes('/runtime-profiles')) {
        return json(opts.profiles ?? []);
      }
      if (method === 'GET' && url.includes('/projects')) {
        return json([{ id: 'proj-uuid', parallelEnabled: true }]);
      }
      if (method === 'DELETE') {
        const st = opts.deleteHttpStatus ?? 200;
        return st === 200 ? json({ success: true }) : json({ error: 'nope' }, st);
      }
      if (method === 'POST' && url.endsWith('/tasks')) {
        return json({ id: 'task-123', status: 'backlog' }, 201);
      }
      if (method === 'GET' && /\/tasks\/[^/]+$/.test(url)) {
        const st = opts.taskHttpStatus ?? 200;
        if (st !== 200) return json({ error: 'nope' }, st);
        return json(opts.task ?? { id: 'task-123', status: 'backlog', paused: true });
      }
      return json({});
    },
  );
}

const backend = (): AifHandoffBackend =>
  new AifHandoffBackend({ baseUrl: 'http://localhost:3009', projectId: 'proj-uuid' });

const deletes = (calls: Call[]): Call[] => calls.filter((c) => c.method === 'DELETE');

afterEach(() => {
  vi.restoreAllMocks();
});

// ── A5-1: cancel must not delete the record out from under a live worker ──────

describe('A5-1 — cancelClaim refuses to delete a task that is not a paused claim', () => {
  it.each([
    ['implementing', 'implementing'],
    ['review', 'review'],
    ['planning', 'planning'],
    ['plan_ready', 'plan_ready'],
  ])('status=%s (released, worker live) → NO DELETE, refusal reported', async (_label, status) => {
    const calls: Call[] = [];
    mockAif(calls, { task: { id: 'task-123', status, paused: false } });

    const outcome = await backend().cancelClaimChecked(handleFromTaskId('task-123'));

    expect(outcome).toMatchObject({ cancelled: false, reason: 'running' });
    // The whole finding: a DELETE here removes the row while the worker keeps
    // going headless — the lane stays blocked and probe-inflight sees nothing.
    expect(deletes(calls)).toHaveLength(0);
    // The refusal has to name the state, or the operator cannot act on it.
    expect((outcome as { detail: string }).detail).toContain(status);
  });

  it('the refusal says the backend cannot stop a worker — not "delete failed"', async () => {
    mockAif([], { task: { id: 'task-123', status: 'implementing', paused: false } });
    const outcome = await backend().cancelClaimChecked(handleFromTaskId('task-123'));
    expect(outcome.cancelled).toBe(false);
    expect(outcome.reason).toBe('running');
  });

  it('boolean cancelClaim() reports the same refusal as false', async () => {
    const calls: Call[] = [];
    mockAif(calls, { task: { id: 'task-123', status: 'implementing', paused: false } });
    await expect(backend().cancelClaim(handleFromTaskId('task-123'))).resolves.toBe(false);
    expect(deletes(calls)).toHaveLength(0);
  });

  it('CONTROL: a paused claim (the /pipeline RED branch) IS deleted', async () => {
    const calls: Call[] = [];
    mockAif(calls, { task: { id: 'task-123', status: 'backlog', paused: true } });
    const outcome = await backend().cancelClaimChecked(handleFromTaskId('task-123'));
    expect(outcome).toEqual({ cancelled: true, reason: 'deleted' });
    expect(deletes(calls)).toHaveLength(1);
  });

  it.each(['done', 'verified', 'blocked_external'])(
    'CONTROL: a terminal task (%s) has no live worker, so cancel still deletes',
    async (status) => {
      const calls: Call[] = [];
      mockAif(calls, { task: { id: 'task-123', status, paused: false } });
      await expect(backend().cancelClaim(handleFromTaskId('task-123'))).resolves.toBe(true);
      expect(deletes(calls)).toHaveLength(1);
    },
  );

  it('a 404 on the pre-check means the claim is already gone — success, no DELETE', async () => {
    const calls: Call[] = [];
    mockAif(calls, { taskHttpStatus: 404 });
    const outcome = await backend().cancelClaimChecked(handleFromTaskId('task-123'));
    expect(outcome).toEqual({ cancelled: true, reason: 'already-gone' });
    expect(deletes(calls)).toHaveLength(0);
  });

  it('an unreadable task state refuses rather than guessing (cannot prove idle)', async () => {
    const calls: Call[] = [];
    mockAif(calls, { taskHttpStatus: 500 });
    const outcome = await backend().cancelClaimChecked(handleFromTaskId('task-123'));
    expect(outcome).toMatchObject({ cancelled: false, reason: 'unverifiable' });
    expect(deletes(calls)).toHaveLength(0);
  });

  it('a response with no status field is unverifiable too — not "safe to delete"', async () => {
    const calls: Call[] = [];
    mockAif(calls, { task: {} });
    const outcome = await backend().cancelClaimChecked(handleFromTaskId('task-123'));
    expect(outcome).toMatchObject({ cancelled: false, reason: 'unverifiable' });
    expect(deletes(calls)).toHaveLength(0);
  });

  it('a real DELETE failure on a paused claim is still reported as not-cancelled', async () => {
    const calls: Call[] = [];
    mockAif(calls, {
      task: { id: 'task-123', status: 'backlog', paused: true },
      deleteHttpStatus: 500,
    });
    const outcome = await backend().cancelClaimChecked(handleFromTaskId('task-123'));
    expect(outcome).toMatchObject({ cancelled: false, reason: 'delete-failed' });
  });

  it('dispatch() rollback still deletes its own half-created task with NO pre-check', async () => {
    // The rollback path is not the operator path: dispatch() created this task
    // paused microseconds ago and its unpause FAILED, so it provably never
    // started. Making it pay for a pre-check would trade a known-safe delete for
    // an orphan whenever the GET is the thing that is broken.
    const calls: Call[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? 'GET';
        calls.push({ url, method, body: undefined });
        if (method === 'GET' && url.includes('/projects')) {
          return Promise.resolve(
            new Response(JSON.stringify([{ id: 'proj-uuid', parallelEnabled: true }]), {
              status: 200,
            }),
          );
        }
        if (method === 'POST' && url.endsWith('/tasks')) {
          return Promise.resolve(new Response(JSON.stringify({ id: 'task-123' }), { status: 201 }));
        }
        if (method === 'DELETE') {
          return Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }));
        }
        return Promise.resolve(new Response('nope', { status: 400 }));
      },
    );
    await expect(backend().dispatch(KICKOFF)).rejects.toThrow(/PUT \/tasks\/task-123 HTTP 400/);
    expect(deletes(calls)).toHaveLength(1);
    // No GET /tasks/:id gate in front of the rollback delete.
    expect(calls.filter((c) => c.method === 'GET' && /\/tasks\/task-123$/.test(c.url))).toHaveLength(
      0,
    );
  });
});

// ── A5-2: the profile lookup must be scoped to THIS project ───────────────────

describe('A5-2 — profile resolution is scoped by projectId and to enabled profiles', () => {
  it('sends projectId + enabledOnly on GET /runtime-profiles', async () => {
    const calls: Call[] = [];
    mockAif(calls, { profiles: [{ id: 'p1', name: 'Opus' }] });

    await backend().claim({ ...KICKOFF, profileHint: 'Opus' });

    const get = calls.find((c) => c.method === 'GET' && c.url.includes('/runtime-profiles'));
    expect(get).toBeDefined();
    const query = new URL(get!.url).searchParams;
    expect(query.get('projectId')).toBe('proj-uuid');
    expect(query.get('enabledOnly')).toBe('true');
  });

  it('resolves the scoped profile onto the created task', async () => {
    const calls: Call[] = [];
    mockAif(calls, { profiles: [{ id: 'p1', name: 'Opus' }] });
    await backend().claim({ ...KICKOFF, profileHint: 'Opus' });
    const post = calls.find((c) => c.method === 'POST' && c.url.endsWith('/tasks'));
    expect(post?.body).toMatchObject({ runtimeProfileId: 'p1' });
  });

  it('CONTROL: an unresolvable hint is still spec_invalid, not a silent guess', async () => {
    mockAif([], { profiles: [{ id: 'p1', name: 'Sonnet' }] });
    await expect(backend().claim({ ...KICKOFF, profileHint: 'Opus' })).rejects.toMatchObject({
      code: 'spec_invalid',
    });
  });
});

// ── E-3: a missing projectId is an operator-fixable spec defect ───────────────

describe('E-3 — missing projectId is spec_invalid, not an environmental failure', () => {
  it('claim() throws spec_invalid before any fetch', async () => {
    const calls: Call[] = [];
    mockAif(calls);
    const err = await new AifHandoffBackend({ baseUrl: 'http://x' })
      .claim(KICKOFF)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BackendError);
    expect((err as BackendError).code).toBe('spec_invalid');
    expect((err as BackendError).message).toMatch(/RUNTIME_BRIDGE_AIF_PROJECT_ID/);
    expect(calls).toHaveLength(0);
  });

  it('dispatch() surfaces the same class (it is claim+release)', async () => {
    mockAif([]);
    await expect(
      new AifHandoffBackend({ baseUrl: 'http://x' }).dispatch(KICKOFF),
    ).rejects.toMatchObject({ code: 'spec_invalid' });
  });
});

// ── A5-1, CLI half: what the operator is told ────────────────────────────────

describe('A5-1 — the cancel CLI never reports a free lane it did not free', () => {
  it('a cancelled claim reports success and exits 0', () => {
    const m = describeCancelOutcome('task-123', { cancelled: true, reason: 'deleted' });
    expect(m.exit).toBe(0);
    expect(m.text).toMatch(/lane is free/);
  });

  it('an already-gone claim is success too (idempotent re-cancel)', () => {
    expect(describeCancelOutcome('task-123', { cancelled: true, reason: 'already-gone' }).exit).toBe(
      0,
    );
  });

  it('a RUNNING task exits 1 and says the backend cannot stop the worker', () => {
    const m = describeCancelOutcome('task-123', {
      cancelled: false,
      reason: 'running',
      detail: 'status=implementing paused=false',
    });
    expect(m.exit).toBe(1);
    // The three things the operator has to learn, none of which the old
    // «lane is free» line carried:
    expect(m.text).toMatch(/status=implementing/); // what state it is actually in
    expect(m.text).toMatch(/cannot stop|no way to stop|does not support/i); // why we refused
    expect(m.text).toMatch(/not cancelled|NOT cancelled/); // that the stage is NOT cancelled
    // ...and it must never claim the opposite.
    expect(m.text).not.toMatch(/lane is free/);
  });

  it('an unverifiable state exits 1 rather than deleting on a guess', () => {
    const m = describeCancelOutcome('task-123', {
      cancelled: false,
      reason: 'unverifiable',
      detail: 'aif-handoff REST GET /tasks/task-123 HTTP 500: boom',
    });
    expect(m.exit).toBe(1);
    expect(m.text).toMatch(/HTTP 500/);
    expect(m.text).not.toMatch(/lane is free/);
  });

  it('a failed DELETE keeps the pre-existing STALE-CLAIM guidance', () => {
    const m = describeCancelOutcome('task-123', {
      cancelled: false,
      reason: 'delete-failed',
      detail: 'HTTP 500',
    });
    expect(m.exit).toBe(1);
    expect(m.text).toMatch(/STALE-CLAIM/);
  });
});
