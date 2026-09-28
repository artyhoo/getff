/**
 * Tests for the aif RETURN CHANNEL (cli/harvest.ts → reportMergeToAif / closeMergedTasks).
 *
 * History: harvest was one-way (2026-09-09: four shipped tasks still parked in `review`); the
 * first return channel (#1694) stopped at `done` and left `approve_done` to a human. Operator
 * directive 2026-09-28 retired that manual step — two tasks sat at `done` a day after their
 * PRs merged (514693af → #1858, 71ad40d7 → #1859). The channel now closes the task through the
 * same route the web UI's Approve button uses: `POST /tasks/:id/events {event:"approve_done"}`
 * (aif `packages/api/src/routes/tasks.ts:922`, state machine `done → verified`).
 *
 * Contract (asserted against a stubbed aif API — an in-memory task store behind `fetch`):
 *   PR not merged                 → NO writes at all; the task stays where it is.
 *   merged + `done`               → comment naming the PR, THEN approve_done → `verified`.
 *   merged + already `verified`   → no-op: no comment, no event.
 *   merged + `review`             → complete_review (participants mode on) → approve_done.
 *   merged + legacy-mode `review` → comment only; the review exit does not exist there.
 *   merged + other status         → comment only; never forced.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
  closeMergedTasks,
  ghMergedPrLookup,
  ghPrMergeProbe,
  parseArgs,
  reportMergeToAif,
  taskMarker,
  withTaskMarker,
  type MergedPr,
  type PrMergeProbe,
} from '../src/cli/harvest.js';

vi.mock('node:child_process', () => ({ execFileSync: vi.fn() }));
const execMock = vi.mocked(execFileSync);

const BASE = 'http://aif.test';

interface StubTask {
  id: string;
  title: string;
  status: string;
  branchName?: string;
  executionOwner?: 'ai' | 'human';
}

interface Call {
  method: string;
  path: string;
  body?: Record<string, unknown>;
}

/**
 * A stubbed aif API: GET/POST on /tasks, /tasks/:id, /tasks/:id/comments, /tasks/:id/events
 * and /auth/session, with the two state-machine rules this channel depends on
 * (`complete_review` only from review — and only in participants mode — and `approve_done`
 * only from done), each refused with the 409 the real API returns.
 */
function stubAif(
  tasks: StubTask[],
  opts: { participantsMode?: boolean | 'missing' | 401; concurrentApprove?: boolean } = {},
) {
  const store = new Map(tasks.map((t) => [t.id, { ...t }]));
  const comments = new Map<string, { message: string }[]>();
  const calls: Call[] = [];
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
    calls.push({ method, path: url.pathname + url.search, body });

    if (url.pathname === '/auth/session') {
      const pm = opts.participantsMode ?? true;
      if (pm === 401) return json({ error: 'unauthorized' }, 401);
      return json(pm === 'missing' ? { authenticated: false } : { participantsModeEnabled: pm });
    }
    if (url.pathname === '/tasks') {
      const pid = url.searchParams.get('projectId');
      return json([...store.values()].map((t) => ({ ...t, projectId: pid ?? 'p' })));
    }
    const m = url.pathname.match(/^\/tasks\/([^/]+)(?:\/(comments|events))?$/);
    const task = m ? store.get(m[1]) : undefined;
    if (!m || !task) return json({ error: 'Task not found' }, 404);
    if (!m[2]) return json(task);
    if (m[2] === 'comments') {
      const list = comments.get(task.id) ?? [];
      if (method === 'GET') return json(list);
      list.push({ message: String(body?.message) });
      comments.set(task.id, list);
      return json({ ok: true }, 201);
    }
    // events
    const event = body?.event;
    if (event === 'approve_done') {
      // Another sweep closes the task a moment before this request lands.
      if (opts.concurrentApprove && task.status === 'done') task.status = 'verified';
      if (task.status !== 'done') return json({ error: 'approve_done is only allowed from done' }, 409);
      task.status = 'verified';
      return json(task);
    }
    if (event === 'complete_review') {
      if (task.status !== 'review' || opts.participantsMode === false) {
        return json({ error: 'Unknown task event' }, 409);
      }
      task.status = 'done';
      return json(task);
    }
    return json({ error: 'Unknown task event' }, 409);
  });

  return {
    calls,
    writes: () => calls.filter((c) => c.method !== 'GET'),
    status: (id: string) => store.get(id)?.status,
    comments: (id: string) => comments.get(id) ?? [],
  };
}

const MERGED: PrMergeProbe = async () => ({
  merged: true,
  mergedAt: '2026-09-27T23:40:00Z',
  mergeCommit: 'c7b912c232ad5cf276c31b67f9a376a84d3e008d',
});
const NOT_MERGED: PrMergeProbe = async () => ({ merged: false, mergedAt: null, mergeCommit: null });

afterEach(() => {
  vi.restoreAllMocks();
  execMock.mockReset();
});

describe('reportMergeToAif — merged PR closes the task through the UI Approve route', () => {
  it('merged + done → comment naming the PR, THEN approve_done (commit flow OFF) → verified', async () => {
    const aif = stubAif([{ id: 't-done', title: 'x', status: 'done' }]);

    const report = await reportMergeToAif(BASE, 't-done', 'https://gh/x/y/pull/1858', MERGED);

    expect(aif.writes()).toEqual([
      { method: 'POST', path: '/tasks/t-done/comments', body: { message: expect.stringContaining('https://gh/x/y/pull/1858') } },
      {
        method: 'POST',
        path: '/tasks/t-done/events',
        body: { event: 'approve_done', commitOnApprove: false, deletePlanFile: false },
      },
    ]);
    expect(aif.status('t-done')).toBe('verified');
    expect(report).toMatchObject({ merged: true, commented: true, approved: true, finalStatus: 'verified' });
    expect(aif.comments('t-done')[0].message).toContain('c7b912c232ad5cf276c31b67f9a376a84d3e008d');
  });

  it('not merged → refuses: NO writes at all, the task stays done', async () => {
    const aif = stubAif([{ id: 't-open', title: 'x', status: 'done' }]);

    const report = await reportMergeToAif(BASE, 't-open', 'https://gh/x/y/pull/7', NOT_MERGED);

    expect(aif.calls).toEqual([]);
    expect(aif.status('t-open')).toBe('done');
    expect(report).toMatchObject({ merged: false, commented: false, approved: false });
    expect(report.skippedReason).toMatch(/not merged/);
  });

  it('already verified → no-op: no comment, no event', async () => {
    const aif = stubAif([{ id: 't-v', title: 'x', status: 'verified' }]);

    const report = await reportMergeToAif(BASE, 't-v', 'https://gh/x/y/pull/1859', MERGED);

    expect(aif.writes()).toEqual([]);
    expect(report).toMatchObject({ merged: true, alreadyClosed: true, approved: false, commented: false });
  });

  it('a second run after a close changes nothing (idempotent end to end)', async () => {
    const aif = stubAif([{ id: 't-2x', title: 'x', status: 'done' }]);

    await reportMergeToAif(BASE, 't-2x', 'https://gh/x/y/pull/1', MERGED);
    const writesAfterFirst = aif.writes().length;
    const second = await reportMergeToAif(BASE, 't-2x', 'https://gh/x/y/pull/1', MERGED);

    expect(aif.writes().length).toBe(writesAfterFirst);
    expect(second.alreadyClosed).toBe(true);
    expect(aif.comments('t-2x')).toHaveLength(1);
  });

  it('a comment already naming the PR is not repeated (a close refused earlier, retried now)', async () => {
    const aif = stubAif([{ id: 't-c', title: 'x', status: 'implementing' }]);
    await reportMergeToAif(BASE, 't-c', 'https://gh/x/y/pull/3', MERGED);
    await reportMergeToAif(BASE, 't-c', 'https://gh/x/y/pull/3', MERGED);

    expect(aif.comments('t-c')).toHaveLength(1);
  });

  it('merged + a non-closable status → comment only, never forced, reason names the status', async () => {
    const aif = stubAif([{ id: 't-impl', title: 'x', status: 'implementing' }]);

    const report = await reportMergeToAif(BASE, 't-impl', 'https://gh/x/y/pull/9', MERGED);

    expect(aif.writes().map((c) => c.path)).toEqual(['/tasks/t-impl/comments']);
    expect(aif.status('t-impl')).toBe('implementing');
    expect(report.approved).toBe(false);
    expect(report.skippedReason).toContain('implementing');
  });

  it('a concurrent close between read and write is the idempotent outcome, not a failure', async () => {
    const aif = stubAif([{ id: 't-race', title: 'x', status: 'done' }], { concurrentApprove: true });

    const report = await reportMergeToAif(BASE, 't-race', 'https://gh/x/y/pull/4', MERGED);

    expect(aif.status('t-race')).toBe('verified');
    expect(report.alreadyClosed).toBe(true);
  });
});

describe('reportMergeToAif — the review leg', () => {
  it('participants mode on: complete_review, then approve_done → verified', async () => {
    const aif = stubAif([{ id: 't-rv', title: 'x', status: 'review' }], { participantsMode: true });

    const report = await reportMergeToAif(BASE, 't-rv', 'https://gh/x/y/pull/1688', MERGED);

    expect(aif.writes().map((c) => c.body?.event ?? 'comment')).toEqual(['comment', 'complete_review', 'approve_done']);
    expect(report).toMatchObject({ closedReview: true, approved: true, finalStatus: 'verified' });
  });

  it('legacy mode: comments, skips the event, and names the two real levers', async () => {
    const aif = stubAif([{ id: 't-lg', title: 'x', status: 'review', executionOwner: 'ai' }], {
      participantsMode: false,
    });

    const report = await reportMergeToAif(BASE, 't-lg', 'https://gh/x/y/pull/1680', MERGED);

    expect(aif.writes().map((c) => c.path)).toEqual(['/tasks/t-lg/comments']);
    expect(report).toMatchObject({ commented: true, closedReview: false, approved: false });
    expect(report.skippedReason).toMatch(/participants mode/i);
    expect(report.skippedReason).toMatch(/handoff/i);
  });

  it('a probe that FAILS is not a skip — it propagates, so the CLI exits non-zero', async () => {
    stubAif([{ id: 't-401', title: 'x', status: 'review' }], { participantsMode: 401 });
    await expect(reportMergeToAif(BASE, 't-401', 'https://gh/x/y/pull/1680', MERGED)).rejects.toThrow(/auth\/session/);
  });

  it('a session body without the flag is a failure, not an assumed "off"', async () => {
    stubAif([{ id: 't-nf', title: 'x', status: 'review' }], { participantsMode: 'missing' });
    await expect(reportMergeToAif(BASE, 't-nf', 'https://gh/x/y/pull/1680', MERGED)).rejects.toThrow(
      /participantsModeEnabled/,
    );
  });
});

describe('closeMergedTasks — the sweep needs no PR url', () => {
  const pr = (url: string): MergedPr => ({ url });

  it('closes each done task whose lookup finds exactly one merged PR; leaves the rest', async () => {
    const aif = stubAif([
      { id: 'a', title: 'a', status: 'done', branchName: 'feature/a' },
      { id: 'b', title: 'b', status: 'done', branchName: 'feature/b' },
      { id: 'c', title: 'c', status: 'verified', branchName: 'feature/c' },
      { id: 'd', title: 'd', status: 'implementing', branchName: 'feature/d' },
    ]);
    const lookup = vi.fn(async (t: { id: string }) => (t.id === 'a' ? [pr('https://gh/x/y/pull/1858')] : []));

    const entries = await closeMergedTasks(BASE, { projectId: 'p1' }, lookup, MERGED);

    expect(aif.calls[0].path).toBe('/tasks?projectId=p1');
    expect(lookup.mock.calls.map((c) => c[0].id)).toEqual(['a', 'b']);
    expect(aif.status('a')).toBe('verified');
    expect(aif.status('b')).toBe('done');
    expect(entries.find((e) => e.taskId === 'b')?.skippedReason).toMatch(/no merged PR/);
  });

  it('an ambiguous mapping (two merged PRs) is reported, never guessed at', async () => {
    const aif = stubAif([{ id: 'amb', title: 'x', status: 'done' }]);
    const entries = await closeMergedTasks(
      BASE,
      {},
      async () => [pr('https://gh/x/y/pull/1'), pr('https://gh/x/y/pull/2')],
      MERGED,
    );

    expect(aif.writes()).toEqual([]);
    expect(entries[0].skippedReason).toMatch(/ambiguous/);
  });

  it('the found PR still has to pass the merge proof', async () => {
    const aif = stubAif([{ id: 'np', title: 'x', status: 'done' }]);
    const entries = await closeMergedTasks(BASE, {}, async () => [pr('https://gh/x/y/pull/5')], NOT_MERGED);

    expect(aif.writes()).toEqual([]);
    expect(entries[0].report?.merged).toBe(false);
  });

  it('with a task id, sweeps only that task', async () => {
    const aif = stubAif([
      { id: 'one', title: 'x', status: 'done' },
      { id: 'two', title: 'x', status: 'done' },
    ]);
    await closeMergedTasks(BASE, { taskId: 'one' }, async () => [pr('https://gh/x/y/pull/6')], MERGED);

    expect(aif.status('one')).toBe('verified');
    expect(aif.status('two')).toBe('done');
    expect(aif.calls.some((c) => c.path === '/tasks')).toBe(false);
  });
});

describe('the gh-backed probe and lookup', () => {
  it('ghPrMergeProbe: MERGED + merge commit is merged', async () => {
    execMock.mockReturnValueOnce(
      JSON.stringify({ state: 'MERGED', mergedAt: '2026-09-27T23:40:00Z', mergeCommit: { oid: 'c7b912c2' } }),
    );
    await expect(ghPrMergeProbe('u')).resolves.toMatchObject({ merged: true, mergeCommit: 'c7b912c2' });
    expect(execMock.mock.calls[0][1]).toEqual(['pr', 'view', 'u', '--json', 'state,mergedAt,mergeCommit']);
  });

  it('ghPrMergeProbe: MERGED without a merge commit is NOT proof; OPEN is not merged', async () => {
    execMock.mockReturnValueOnce(JSON.stringify({ state: 'MERGED', mergeCommit: null }));
    await expect(ghPrMergeProbe('u')).resolves.toMatchObject({ merged: false });
    execMock.mockReturnValueOnce(JSON.stringify({ state: 'OPEN', mergeCommit: null }));
    await expect(ghPrMergeProbe('u')).resolves.toMatchObject({ merged: false });
  });

  it('ghMergedPrLookup keeps a PR on the task branch or carrying the marker; drops a mere mention', async () => {
    const task = { id: 'abc-123', title: 't', status: 'done', branchName: 'feature/x-abc' };
    execMock
      .mockReturnValueOnce(
        JSON.stringify([
          { url: 'u-marker', headRefName: 'other', body: `text\n${taskMarker('abc-123')}\n` },
          { url: 'u-mention', headRefName: 'retro', body: 'follow-up to aif task abc-123' },
        ]),
      )
      .mockReturnValueOnce(JSON.stringify([{ url: 'u-branch', headRefName: 'feature/x-abc', body: '' }]));

    const found = await ghMergedPrLookup(task);

    expect(found.map((p) => p.url).sort()).toEqual(['u-branch', 'u-marker']);
    expect(execMock.mock.calls[0][1]).toContain('abc-123 in:body');
    expect(execMock.mock.calls[1][1]).toEqual(expect.arrayContaining(['--head', 'feature/x-abc', '--state', 'merged']));
  });
});

describe('PR ↔ task mapping marker', () => {
  it('withTaskMarker appends the aif-task line once', () => {
    const once = withTaskMarker('body', 'abc');
    expect(once.endsWith(`${taskMarker('abc')}\n`)).toBe(true);
    expect(withTaskMarker(once, 'abc')).toBe(once);
  });
});

describe('CLI flags', () => {
  it('parses --report-merge <prUrl> alongside the task id', () => {
    const args = parseArgs(['task-9', '--report-merge', 'https://gh/x/y/pull/1688']);
    expect(args.taskId).toBe('task-9');
    expect(args.reportMerge).toBe('https://gh/x/y/pull/1688');
  });

  it('parses --close-merged with and without a task id', () => {
    expect(parseArgs(['--close-merged', '--project', 'p1'])).toMatchObject({ closeMerged: true, project: 'p1' });
    expect(parseArgs(['t-1', '--close-merged'])).toMatchObject({ closeMerged: true, taskId: 't-1' });
  });

  it('leaves both undefined/false on an ordinary harvest', () => {
    const args = parseArgs(['task-9', '--base', 'staging']);
    expect(args.reportMerge).toBeUndefined();
    expect(args.closeMerged).toBe(false);
  });
});
