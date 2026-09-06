/**
 * Paired-positive/negative tests for the answer-pusher (cli/answer.ts).
 *
 * Contract under test (kickoff §4.2 + S1-verified sequence):
 *   POSITIVE — request_changes: a comment with { message } is POSTed FIRST, then
 *              the request_changes event → done→implementing rework path. ✓
 *   POSITIVE — approve: a single approve_done event, NO comment. ✓
 *   POSITIVE — retry: a single retry_from_blocked event, NO comment. ✓
 *   NEGATIVE — request_changes with no --answer → validation error, NO fetch. ✓
 *   NEGATIVE — invalid --decision → validation error (not silently defaulted). ✓
 *   ERROR    — a non-ok REST status → BackendError with the mapped code. ✓
 *
 * Mocking strategy: vi.spyOn(globalThis, 'fetch') returning a Response, exactly
 *   like aif-questions.test.ts. main() is entrypoint-guarded, so importing the
 *   module is a clean no-op (no live aif-handoff server needed — §2 only gates
 *   the live E2E, not these unit tests).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { BackendError } from '../src/backend.js';
import {
  parseAnswerArgs,
  validateAnswerArgs,
  resolveStep,
  postComment,
  postEvent,
  pushAnswer,
  formatResult,
  VALID_DECISIONS,
  appendAnswerToPlan,
} from '../src/cli/answer.js';

function okResponse(body: unknown = {}, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ── resolveStep — the heart of the S1-verified mapping ──────────────────────────
describe('resolveStep maps each decision to its verified aif-handoff event', () => {
  it('request_changes → request_changes event, needs a comment', () => {
    expect(resolveStep('request_changes')).toEqual({ event: 'request_changes', needsComment: true });
  });
  it('approve → approve_done event, no comment', () => {
    expect(resolveStep('approve')).toEqual({ event: 'approve_done', needsComment: false });
  });
  it('retry → retry_from_blocked event, no comment', () => {
    expect(resolveStep('retry')).toEqual({ event: 'retry_from_blocked', needsComment: false });
  });
});

// ── POSITIVE — request_changes: comment FIRST (message field), then event ────────
describe('POSITIVE — request_changes attaches the answer as a comment then re-opens', () => {
  it('POSTs /comments { message } before /events { event: request_changes }', async () => {
    // Fresh Response per call — a Response body can only be read once, and this
    // path makes two fetches (comment, then event).
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(okResponse()));

    const result = await pushAnswer('http://localhost:3009', 't-9', 'request_changes', '  use Option A  ');

    // Two calls, in order: comment, then event.
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const [firstUrl, firstInit] = fetchSpy.mock.calls[0];
    expect(firstUrl).toBe('http://localhost:3009/tasks/t-9/comments');
    // Source: createTaskCommentSchema — the text field is `message` (NOT content/body).
    expect(JSON.parse((firstInit as RequestInit).body as string)).toEqual({ message: 'use Option A' });

    const [secondUrl, secondInit] = fetchSpy.mock.calls[1];
    expect(secondUrl).toBe('http://localhost:3009/tasks/t-9/events');
    expect(JSON.parse((secondInit as RequestInit).body as string)).toEqual({ event: 'request_changes' });

    expect(result).toEqual({
      taskId: 't-9',
      decision: 'request_changes',
      event: 'request_changes',
      commented: true,
    });
    expect(formatResult(result)).toContain('event:    request_changes (dispatched)');
    expect(formatResult(result)).toContain('comment: answer attached');
  });
});

// ── POSITIVE — approve / retry: a single forward event, no comment ───────────────
describe('POSITIVE — approve and retry send exactly one event and no comment', () => {
  it('approve → only POST /events { event: approve_done }', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse());

    const result = await pushAnswer('http://localhost:3009', 't-1', 'approve', undefined);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe('http://localhost:3009/tasks/t-1/events');
    expect(JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string)).toEqual({
      event: 'approve_done',
    });
    expect(result.commented).toBe(false);
  });

  it('retry → only POST /events { event: retry_from_blocked }', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse());

    await pushAnswer('http://localhost:3009', 't-2', 'retry', undefined);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string)).toEqual({
      event: 'retry_from_blocked',
    });
  });
});

// ── NEGATIVE — validation rejects bad input BEFORE any network call ──────────────
describe('NEGATIVE — invalid args are rejected by validateAnswerArgs', () => {
  it('missing --task → error', () => {
    const args = parseAnswerArgs(['--decision', 'approve']);
    expect(validateAnswerArgs(args)).toMatch(/missing required --task/);
  });

  it('request_changes with no --answer → error (cannot push an empty rework)', () => {
    const args = parseAnswerArgs(['--task', 't-5']);
    expect(args.decision).toBe('request_changes'); // the default
    expect(validateAnswerArgs(args)).toMatch(/requires --answer/);
  });

  it('invalid --decision is an error, NOT silently defaulted to request_changes', () => {
    const args = parseAnswerArgs(['--task', 't-6', '--decision', 'yolo']);
    expect(args.decision).toBe('yolo');
    expect(validateAnswerArgs(args)).toMatch(/invalid --decision "yolo"/);
  });

  it('a valid approve with --task passes validation', () => {
    const args = parseAnswerArgs(['--task', 't-7', '--decision', 'approve']);
    expect(validateAnswerArgs(args)).toBeNull();
  });

  it('VALID_DECISIONS lists exactly the four supported decisions', () => {
    expect([...VALID_DECISIONS]).toEqual(['request_changes', 'approve', 'retry', 'resume']);
  });
});

// ── ERROR — REST failures map to BackendError with the documented code ───────────
describe('REST error mapping (mirrors AifHandoffBackend._rest)', () => {
  it('a non-ok status → BackendError code dispatch_failed', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('boom', { status: 500 }));
    await expect(postEvent('http://localhost:3009', 't-x', 'approve_done')).rejects.toMatchObject({
      name: 'BackendError',
      code: 'dispatch_failed',
    });
  });

  it('HTTP 429 → BackendError code quota_exceeded', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('slow down', { status: 429 }));
    await expect(postComment('http://localhost:3009', 't-y', 'hi')).rejects.toMatchObject({
      name: 'BackendError',
      code: 'quota_exceeded',
    });
  });

  it('a network throw → BackendError code unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(postEvent('http://localhost:3009', 't-z', 'approve_done')).rejects.toMatchObject({
      name: 'BackendError',
      code: 'unavailable',
    });
  });

  it('pushAnswer throws BackendError when request_changes is given a blank answer at runtime', async () => {
    // Defence in depth beyond validateAnswerArgs (pushAnswer is also a library entrypoint).
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse());
    await expect(pushAnswer('http://localhost:3009', 't-q', 'request_changes', '   ')).rejects.toBeInstanceOf(
      BackendError,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('resume decision — pure parts', () => {
  it('resume requires --answer', () => {
    const err = validateAnswerArgs({ taskId: 't-1', answer: undefined, decision: 'resume', json: false });
    expect(err).toMatch(/requires --answer/);
  });
  it('appendAnswerToPlan appends a marked OPERATOR ANSWER block', () => {
    const out = appendAnswerToPlan('# Plan\n## ⏸ OPEN QUESTION\nq', 'use Option A');
    expect(out).toContain('## ✅ OPERATOR ANSWER (resumed)');
    expect(out).toContain('use Option A');
  });
});

describe('POSITIVE — resume: GET plan, then PUT { plan+answer, paused:false, blockedReason:null }', () => {
  it('injects the answer into the plan and unpauses', async () => {
    const task = { id: 't-7', title: 'x', status: 'implementing', plan: '# Plan\n## ⏸ OPEN QUESTION\nq', paused: true, blockedReason: 'q' };
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation((url) =>
      Promise.resolve(
        String(url).endsWith('/tasks/t-7')
          ? new Response(JSON.stringify(task), { status: 200, headers: { 'Content-Type': 'application/json' } })
          : new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }),
      ),
    );

    const result = await pushAnswer('http://localhost:3009', 't-7', 'resume', 'use Option A');

    expect((spy.mock.calls[0][1] as RequestInit).method).toBe('GET');
    const put = spy.mock.calls[1][1] as RequestInit;
    expect(put.method).toBe('PUT');
    const body = JSON.parse(put.body as string);
    expect(body.plan).toContain('## ✅ OPERATOR ANSWER (resumed)');
    expect(body.plan).toContain('use Option A');
    expect(body.paused).toBe(false);
    expect(body.blockedReason).toBeNull();
    expect(result).toMatchObject({ taskId: 't-7', decision: 'resume', commented: false });
  });
});

// ── A6-6b (#1597 ledger, the half C12/#1625 deferred) ───────────────────────────
// `--decision resume` is the A-park resolution: PUT { plan+answer, paused:false,
// blockedReason:null }. It dispatches NO state-machine event, so it only ever moves a task
// that was stopped by `paused:true` in the first place. Applied to a task that is not
// paused it is a pure plan rewrite: the operator's answer lands in the plan text of a task
// whose status nothing changed, no worker re-reads it, and the CLI still prints its
// success line. That is the misroute the dispatcher taxonomy makes easy — a B-park
// (blockedReason set, paused false) and an A-park are resolved by different --decision
// values, and picking `resume` for a B-park silently swallows the answer. Refuse instead.
describe('NEGATIVE — resume refuses a task that is not paused (A6-6b)', () => {
  for (const [label, task] of [
    ['a done task (the /pipeline REVISE shape — request_changes is the right decision)', {
      id: 't-7', title: 'x', status: 'done', plan: '# Plan', paused: false, blockedReason: null,
    }],
    ['a B-park (blockedReason set, paused false — retry/request_changes territory)', {
      id: 't-7', title: 'x', status: 'blocked_external', plan: '# Plan', paused: false, blockedReason: 'needs a token',
    }],
    ['a task whose paused field is absent altogether', {
      id: 't-7', title: 'x', status: 'implementing', plan: '# Plan', blockedReason: null,
    }],
  ] as [string, Record<string, unknown>][]) {
    it(`rejects ${label} — issues NO PUT`, async () => {
      const spy = vi.spyOn(globalThis, 'fetch').mockImplementation((url) =>
        Promise.resolve(String(url).endsWith('/tasks/t-7') ? okResponse(task) : okResponse({})),
      );
      await expect(pushAnswer('http://localhost:3009', 't-7', 'resume', 'use Option A')).rejects.toThrow(
        /not paused/i,
      );
      // Only the GET — the plan must be left exactly as the worker left it.
      expect(spy.mock.calls).toHaveLength(1);
      expect((spy.mock.calls[0][1] as RequestInit).method).toBe('GET');
    });
  }
});

// Paired negative for A6-6b: the guard must not touch the event-driven decisions. The
// `/pipeline` REVISE flow resolves a `done` task with `request_changes` (dispatcher
// SKILL.md §2.4), and `approve`/`retry` are likewise event-only — none of the three reads
// `paused`, none goes through resumePark. RED if the guard is ever hoisted into pushAnswer
// ahead of the decision switch and starts blocking the flow C12 narrowed to protect.
describe('CONTROL — the A6-6b guard leaves the event decisions on a non-paused task alone', () => {
  it('request_changes on a done, non-paused task still comments + fires the event', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(okResponse({})));
    const result = await pushAnswer('http://localhost:3009', 't-7', 'request_changes', 'auditor findings');
    expect(spy.mock.calls).toHaveLength(2);
    expect(String(spy.mock.calls[0][0])).toContain('/comments');
    expect(JSON.parse((spy.mock.calls[1][1] as RequestInit).body as string).event).toBe('request_changes');
    expect(result).toMatchObject({ decision: 'request_changes', commented: true });
  });
  it('approve on a done, non-paused task still fires approve_done', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(okResponse({})));
    await pushAnswer('http://localhost:3009', 't-7', 'approve', undefined);
    expect(spy.mock.calls).toHaveLength(1);
    expect(JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string).event).toBe('approve_done');
  });
  it('retry on a blocked_external, non-paused task still fires retry_from_blocked', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(okResponse({})));
    await pushAnswer('http://localhost:3009', 't-7', 'retry', undefined);
    expect(spy.mock.calls).toHaveLength(1);
    expect(JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string).event).toBe('retry_from_blocked');
  });
});
