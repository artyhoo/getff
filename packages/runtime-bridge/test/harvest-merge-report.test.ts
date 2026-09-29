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
 *   merged + legacy-mode manual-review park (human-owned, manualReviewRequired)
 *                                 → complete_review (the legacy exit) → approve_done.
 *   merged + legacy-mode `review`, not a park → comment only; never a handoff hint.
 *   merged + other status         → comment only; never forced.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
  closeMergedTasks,
  ghMergedPrIndexLookup,
  ghMergedPrLookup,
  lastAgentActivityAt,
  ghPrMergeProbe,
  ghRead,
  parseArgs,
  parseTrainLandingClaims,
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
  manualReviewRequired?: boolean;
  agentActivityLog?: string;
}

/** The head branch {@link MERGED} reports; stub tasks default to it so the PR maps to them. */
const HEAD = 'feature/merged';

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
  opts: {
    participantsMode?: boolean | 'missing' | 401;
    concurrentApprove?: boolean;
    commentsShape?: unknown;
    /** false = an aif build from before the legacy manual-review exit (artyhoo/aif-handoff#1). */
    legacyManualReviewExit?: boolean;
  } = {},
) {
  const store = new Map(tasks.map((t) => [t.id, { branchName: HEAD, ...t }]));
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
      if (method === 'GET') return json(opts.commentsShape ?? list);
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
      // Legacy mode serves complete_review only for a manual-review park (human-owned,
      // manualReviewRequired) — and only on an aif build that carries that exit.
      const legacyParkExit =
        opts.legacyManualReviewExit !== false && task.executionOwner === 'human' && task.manualReviewRequired === true;
      if (task.status !== 'review' || (opts.participantsMode === false && !legacyParkExit)) {
        return json({ error: 'Unknown task event' }, 409);
      }
      task.manualReviewRequired = false;
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
  headRefName: HEAD,
  body: 'summary',
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

describe("reportMergeToAif — the PR must be THIS task's current work", () => {
  it('a merged PR that does not map to the task (other head, no marker) → refuses, NO writes', async () => {
    const aif = stubAif([{ id: 't-map', title: 'x', status: 'done', branchName: 'feature/t-map' }]);
    const neighbour: PrMergeProbe = async () => ({
      ...(await MERGED('u')),
      headRefName: 'feature/other',
      body: 'aif task t-map mentioned',
    });

    const report = await reportMergeToAif(BASE, 't-map', 'https://gh/x/y/pull/11', neighbour);

    expect(aif.writes()).toEqual([]);
    expect(aif.status('t-map')).toBe('done');
    expect(report.skippedReason).toMatch(/does not map/);
  });

  it('the exact aif-task body line maps a PR from any head branch', async () => {
    const aif = stubAif([{ id: 't-mk', title: 'x', status: 'done', branchName: 'feature/t-mk' }]);
    const marked: PrMergeProbe = async () => ({
      ...(await MERGED('u')),
      headRefName: 'fix/renamed',
      body: `s\n${taskMarker('t-mk')}\n`,
    });

    await reportMergeToAif(BASE, 't-mk', 'https://gh/x/y/pull/12', marked);

    expect(aif.status('t-mk')).toBe('verified');
  });

  it("a merge older than the task's last agent activity (a rework round) → refuses, NO writes", async () => {
    const aif = stubAif([
      {
        id: 't-rw',
        title: 'x',
        status: 'done',
        agentActivityLog:
          '[2026-09-27T20:00:00.000Z] Agent: implement\n[2026-09-28T01:00:00.000Z] Agent: rework accepted\n',
      },
    ]);

    const report = await reportMergeToAif(BASE, 't-rw', 'https://gh/x/y/pull/13', MERGED);

    expect(aif.writes()).toEqual([]);
    expect(report.skippedReason).toMatch(/before the task's last agent activity at 2026-09-28T01:00:00.000Z/);
  });

  it('activity that ENDED before the merge does not block the close', async () => {
    const aif = stubAif([
      { id: 't-ok', title: 'x', status: 'done', agentActivityLog: '[2026-09-27T23:24:16.712Z] Agent: gate accepted\n' },
    ]);

    await reportMergeToAif(BASE, 't-ok', 'https://gh/x/y/pull/14', MERGED);

    expect(aif.status('t-ok')).toBe('verified');
  });

  it('lastAgentActivityAt picks the latest stamp and ignores updatedAt', () => {
    type T = Parameters<typeof lastAgentActivityAt>[0];
    const log = '[2026-09-28T01:00:00Z] b\n[2026-09-27T01:00:00Z] a\nno stamp line';

    expect(
      lastAgentActivityAt({ id: 'x', title: 'x', status: 'done', updatedAt: '2030-01-01T00:00:00Z', agentActivityLog: log } as T),
    ).toBe('2026-09-28T01:00:00Z');
    expect(lastAgentActivityAt({ id: 'x', title: 'x', status: 'done' } as T)).toBeNull();
  });

  it('a comment naming pull/185 is not taken as naming pull/18', async () => {
    const aif = stubAif([{ id: 't-url', title: 'x', status: 'implementing' }]);
    await reportMergeToAif(BASE, 't-url', 'https://gh/x/y/pull/185', MERGED);
    await reportMergeToAif(BASE, 't-url', 'https://gh/x/y/pull/18', MERGED);

    expect(aif.comments('t-url')).toHaveLength(2);
  });

  it('a comments response that is not an array throws instead of posting a duplicate', async () => {
    const aif = stubAif([{ id: 't-sh', title: 'x', status: 'done' }], { commentsShape: { items: [] } });

    await expect(reportMergeToAif(BASE, 't-sh', 'https://gh/x/y/pull/15', MERGED)).rejects.toThrow(
      /did not return an array/,
    );
    expect(aif.writes()).toEqual([]);
  });
});

describe('reportMergeToAif — the review leg', () => {
  it('participants mode on: complete_review, then approve_done → verified', async () => {
    const aif = stubAif([{ id: 't-rv', title: 'x', status: 'review' }], { participantsMode: true });

    const report = await reportMergeToAif(BASE, 't-rv', 'https://gh/x/y/pull/1688', MERGED);

    expect(aif.writes().map((c) => c.body?.event ?? 'comment')).toEqual(['comment', 'complete_review', 'approve_done']);
    expect(report).toMatchObject({ closedReview: true, approved: true, finalStatus: 'verified' });
  });

  it('legacy mode, manual-review park: complete_review through the legacy exit, then approve_done → verified', async () => {
    const aif = stubAif(
      [{ id: 't-pk', title: 'x', status: 'review', executionOwner: 'human', manualReviewRequired: true }],
      { participantsMode: false },
    );

    const report = await reportMergeToAif(BASE, 't-pk', 'https://gh/x/y/pull/1843', MERGED);

    expect(aif.writes().map((c) => c.body?.event ?? 'comment')).toEqual(['comment', 'complete_review', 'approve_done']);
    expect(report).toMatchObject({ closedReview: true, approved: true, finalStatus: 'verified' });
    expect(aif.status('t-pk')).toBe('verified');
  });

  it('legacy mode, ai-owned review (auto review in flight): comment only, and no handoff advice', async () => {
    const aif = stubAif([{ id: 't-lg', title: 'x', status: 'review', executionOwner: 'ai' }], {
      participantsMode: false,
    });

    const report = await reportMergeToAif(BASE, 't-lg', 'https://gh/x/y/pull/1680', MERGED);

    expect(aif.writes().map((c) => c.path)).toEqual(['/tasks/t-lg/comments']);
    expect(report).toMatchObject({ commented: true, closedReview: false, approved: false, finalStatus: 'review' });
    expect(report.skippedReason).toMatch(/auto review/i);
    expect(report.skippedReason).not.toMatch(/handoff/i);
  });

  it('legacy mode, human-owned review that is not parked: comment only, and no handoff advice', async () => {
    const aif = stubAif(
      [{ id: 't-hu', title: 'x', status: 'review', executionOwner: 'human', manualReviewRequired: false }],
      { participantsMode: false },
    );

    const report = await reportMergeToAif(BASE, 't-hu', 'https://gh/x/y/pull/1680', MERGED);

    expect(aif.writes().map((c) => c.path)).toEqual(['/tasks/t-hu/comments']);
    expect(report).toMatchObject({ closedReview: false, approved: false, finalStatus: 'review' });
    expect(report.skippedReason).toMatch(/manualReviewRequired/);
    expect(report.skippedReason).not.toMatch(/handoff/i);
  });

  it('legacy mode, park on an aif build without the exit: fails loudly and names the missing deploy', async () => {
    const aif = stubAif(
      [{ id: 't-old', title: 'x', status: 'review', executionOwner: 'human', manualReviewRequired: true }],
      { participantsMode: false, legacyManualReviewExit: false },
    );

    const err = await reportMergeToAif(BASE, 't-old', 'https://gh/x/y/pull/1843', MERGED).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/aif-handoff#1/);
    expect((err as Error).message).not.toMatch(/\/handoff/);
    expect(aif.status('t-old')).toBe('review');
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
      { id: 'a', title: 'a', status: 'done', branchName: HEAD },
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
      { projectId: 'p1' },
      async () => [pr('https://gh/x/y/pull/1'), pr('https://gh/x/y/pull/2')],
      MERGED,
    );

    expect(aif.writes()).toEqual([]);
    expect(entries[0].skippedReason).toMatch(/ambiguous/);
  });

  it('the found PR still has to pass the merge proof', async () => {
    const aif = stubAif([{ id: 'np', title: 'x', status: 'done' }]);
    const entries = await closeMergedTasks(
      BASE,
      { projectId: 'p1' },
      async () => [pr('https://gh/x/y/pull/5')],
      NOT_MERGED,
    );

    expect(aif.writes()).toEqual([]);
    expect(entries[0].report?.merged).toBe(false);
  });

  it('one task whose close throws is recorded; the sweep still closes the others', async () => {
    const aif = stubAif([
      { id: 'bad', title: 'x', status: 'done' },
      { id: 'good', title: 'x', status: 'done' },
    ]);
    const probe: PrMergeProbe = async (url) => {
      if (url.endsWith('/7')) throw new Error('gh: probe exploded');
      return MERGED(url);
    };
    const entries = await closeMergedTasks(
      BASE,
      { projectId: 'p1' },
      async (t) => [pr(t.id === 'bad' ? 'https://gh/x/y/pull/7' : 'https://gh/x/y/pull/8')],
      probe,
    );

    expect(entries.find((e) => e.taskId === 'bad')).toMatchObject({
      prUrl: 'https://gh/x/y/pull/7',
      error: 'gh: probe exploded',
    });
    expect(entries.find((e) => e.taskId === 'bad')?.report).toBeUndefined();
    expect(aif.status('bad')).toBe('done');
    expect(aif.status('good')).toBe('verified');
  });

  it('a whole-list sweep without a project scope is refused before any read', async () => {
    const aif = stubAif([{ id: 'z', title: 'x', status: 'done' }]);

    await expect(closeMergedTasks(BASE, {}, async () => [], MERGED)).rejects.toThrow(/--project/);
    expect(aif.calls).toEqual([]);
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
    expect(execMock.mock.calls[0][1]).toEqual([
      'pr',
      'view',
      'u',
      '--json',
      'state,mergedAt,mergeCommit,headRefName,body',
    ]);
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
      .mockReturnValueOnce(JSON.stringify([]))
      .mockReturnValueOnce(
        JSON.stringify([
          { url: 'u-branch', state: 'MERGED', headRefName: 'feature/x-abc', body: '' },
          { url: 'u-branch-abandoned', state: 'CLOSED', headRefName: 'feature/x-abc', body: '', comments: [] },
        ]),
      );

    const found = await ghMergedPrLookup('artyhoo/getff')(task);

    expect(found.map((p) => p.url).sort()).toEqual(['u-branch', 'u-marker']);
    expect(execMock.mock.calls[0][1]).toContain('"aif-task: abc-123" in:body');
    expect(execMock.mock.calls[0][1]).toEqual(expect.arrayContaining(['--state', 'merged']));
    expect(execMock.mock.calls[1][1]).toEqual(
      expect.arrayContaining(['--state', 'closed', '--search', '"aif-task: abc-123" in:body is:unmerged']),
    );
    for (const call of execMock.mock.calls) {
      expect(call[1]).toEqual(expect.arrayContaining(['--repo', 'artyhoo/getff', '--limit', '100']));
    }
    expect(execMock.mock.calls[2][1]).toEqual(expect.arrayContaining(['--head', 'feature/x-abc', '--state', 'closed']));
  });
});

describe('ghRead — a gh READ survives a flaky tunnel', () => {
  const netErr = (msg: string) => Object.assign(new Error(`Command failed: gh pr list\n${msg}`), { stderr: msg });
  afterEach(() => {
    delete process.env['RUNTIME_BRIDGE_GH_RETRY_BASE_MS'];
  });

  it('repeats a TLS handshake timeout and returns the first good answer', () => {
    process.env['RUNTIME_BRIDGE_GH_RETRY_BASE_MS'] = '0';
    execMock
      .mockImplementationOnce(() => {
        throw netErr('Post "https://api.github.com/graphql": net/http: TLS handshake timeout');
      })
      .mockImplementationOnce(() => {
        throw netErr('read tcp 1.2.3.4:5->6.7.8.9:443: i/o timeout');
      })
      .mockReturnValueOnce('ok\n');

    expect(ghRead(['pr', 'list'])).toBe('ok\n');
    expect(execMock).toHaveBeenCalledTimes(3);
  });

  it('gives up after 4 attempts and throws the last network error', () => {
    process.env['RUNTIME_BRIDGE_GH_RETRY_BASE_MS'] = '0';
    execMock.mockImplementation(() => {
      throw netErr('net/http: TLS handshake timeout');
    });

    expect(() => ghRead(['pr', 'list'])).toThrow(/TLS handshake timeout/);
    expect(execMock).toHaveBeenCalledTimes(4);
  });

  it('reads with a buffer far above the 1 MiB default (the merged-PR index is >1 MB)', () => {
    execMock.mockReturnValueOnce('ok\n');
    ghRead(['pr', 'list']);
    const opts = execMock.mock.calls[0]?.[2] as { maxBuffer?: number } | undefined;
    expect(opts?.maxBuffer ?? 0).toBeGreaterThanOrEqual(16 * 1024 * 1024);
  });

  it('a non-network failure (bad auth, unknown PR) is thrown at once, never repeated', () => {
    process.env['RUNTIME_BRIDGE_GH_RETRY_BASE_MS'] = '0';
    execMock.mockImplementation(() => {
      throw netErr('GraphQL: Could not resolve to a PullRequest with the number of 99999.');
    });

    expect(() => ghRead(['pr', 'view', '99999'])).toThrow(/PullRequest/);
    expect(execMock).toHaveBeenCalledTimes(1);
  });

  it('the sweep lookup goes through it: one flaky call no longer fails the task', async () => {
    process.env['RUNTIME_BRIDGE_GH_RETRY_BASE_MS'] = '0';
    const task = { id: 'abc-123', title: 't', status: 'done' };
    execMock
      .mockImplementationOnce(() => {
        throw netErr('net/http: TLS handshake timeout');
      })
      .mockReturnValueOnce(JSON.stringify([{ url: 'u-marker', headRefName: 'x', body: taskMarker('abc-123') }]))
      .mockReturnValueOnce(JSON.stringify([]));

    await expect(ghMergedPrLookup('artyhoo/getff')(task)).resolves.toHaveLength(1);
  });
});

describe('ghMergedPrIndexLookup — one search per sweep, not per task', () => {
  it('searches once, then maps every task in memory; a mere mention never maps', async () => {
    execMock.mockReturnValueOnce(
      JSON.stringify([
        { url: 'u-a', headRefName: 'x', body: `done\n${taskMarker('task-a')}\n` },
        { url: 'u-mention', headRefName: 'y', body: 'retro about aif-task: task-b in prose' },
      ]),
    )
      .mockReturnValueOnce(JSON.stringify([]));
    const lookup = ghMergedPrIndexLookup('artyhoo/getff');

    const a = await lookup({ id: 'task-a', title: 't', status: 'done' });
    const b = await lookup({ id: 'task-b', title: 't', status: 'done' });
    const c = await lookup({ id: 'task-c', title: 't', status: 'review' });

    expect(a.map((p) => p.url)).toEqual(['u-a']);
    expect(b).toEqual([]);
    expect(c).toEqual([]);
    expect(execMock).toHaveBeenCalledTimes(2);
    expect(execMock.mock.calls[0][1]).toEqual(
      expect.arrayContaining(['--repo', 'artyhoo/getff', '--state', 'merged', '--search', '"aif-task:" in:body']),
    );
  });

  it('a task with a persisted branch adds one --head search of its own', async () => {
    execMock
      .mockReturnValueOnce(JSON.stringify([]))
      .mockReturnValueOnce(JSON.stringify([]))
      .mockReturnValueOnce(JSON.stringify([{ url: 'u-branch', state: 'MERGED', headRefName: 'feature/x-abc', body: '' }]));

    const found = await ghMergedPrIndexLookup('artyhoo/getff')({
      id: 'abc',
      title: 't',
      status: 'done',
      branchName: 'feature/x-abc',
    });

    expect(found.map((p) => p.url)).toEqual(['u-branch']);
    expect(execMock.mock.calls[2][1]).toEqual(expect.arrayContaining(['--head', 'feature/x-abc']));
  });
});

/**
 * The train landing (incident 2026-09-29): harvest PR #1934 landed inside merge train #1940 as the
 * squash `a235830d7f9`; the seat closed #1934 «landed via train», so GitHub reads it CLOSED with no
 * merge commit and the plain merge proof skipped the task. The fixtures below are the live values.
 */
describe('train landing — a CLOSED member PR whose content landed in a merged train', () => {
  const REPO = 'artyhoo/getff';
  const MEMBER_URL = `https://github.com/${REPO}/pull/1934`;
  const SQUASH = 'a235830d7f910580bcaf1fb89d90955da2c6ae81';
  const TRAIN_MERGE = '9f69fa2097c01ccdef3429773019d4379862da1e';
  const CLAIM =
    'Landed via merge train C3 (#1940, merge commit `9f69fa2097c` on staging, 2026-09-29T14:16:03Z) as the ' +
    'squash commit `a235830d7f9`, not as a merge of this branch.';
  const TRAIN_BODY =
    '| PR | Title | Head SHA | How it landed |\n|---|---|---|---|\n' +
    '| #1934 | W2-G: consumer ZCode skill-mirror check | `1279cae72324` | **SQUASHED** into `a235830d7f9` |\n' +
    '| #1932 | fix(install) | `47993d5f5ba3` | MERGED |\n';

  interface World {
    memberState?: string;
    comments?: string[];
    trainState?: string;
    trainMergeCommit?: string | null;
    trainBody?: string;
    squashResolves?: string;
    inTrain?: string;
    onBase?: string;
  }

  /** Route every `gh` call the probe makes to the world's answer; record what was asked. */
  function ghWorld(w: World = {}) {
    execMock.mockImplementation(((_cmd: string, args: readonly string[]) => {
      const a = args.join(' ');
      if (a === `pr view ${MEMBER_URL} --json state,mergedAt,mergeCommit,headRefName,body`) {
        return JSON.stringify({
          state: w.memberState ?? 'CLOSED',
          mergedAt: null,
          mergeCommit: null,
          headRefName: HEAD,
          body: `summary\n${taskMarker('t-train')}\n`,
        });
      }
      if (a === `pr view ${MEMBER_URL} --json comments`) {
        return JSON.stringify({ comments: (w.comments ?? [CLAIM]).map((body) => ({ body })) });
      }
      if (a.startsWith(`pr view 1940 --repo ${REPO}`)) {
        return JSON.stringify({
          state: w.trainState ?? 'MERGED',
          mergedAt: '2026-09-29T14:16:03Z',
          mergeCommit: w.trainMergeCommit === null ? null : { oid: w.trainMergeCommit ?? TRAIN_MERGE },
          baseRefName: 'staging',
          body: w.trainBody ?? TRAIN_BODY,
        });
      }
      if (a === `api repos/${REPO}/commits/a235830d7f9 --jq .sha`) return `${w.squashResolves ?? SQUASH}\n`;
      if (a === `api repos/${REPO}/compare/${TRAIN_MERGE}...${SQUASH} --jq .status`) return `${w.inTrain ?? 'behind'}\n`;
      if (a === `api repos/${REPO}/compare/staging...${SQUASH} --jq .status`) return `${w.onBase ?? 'behind'}\n`;
      throw new Error(`unexpected gh call: ${a}`);
    }) as unknown as typeof execFileSync);
  }

  it('parses the seat comment; ignores a comment without both the train number and the squash', () => {
    expect(parseTrainLandingClaims([{ body: CLAIM }])).toEqual([{ trainPr: 1940, squash: 'a235830d7f9' }]);
    expect(parseTrainLandingClaims([{ body: 'landed via train, see the train PR' }, { body: null }])).toEqual([]);
  });

  it('a proven landing counts as merged at the TRAIN merge time, with the squash as the merge commit', async () => {
    ghWorld();
    const probed = await ghPrMergeProbe(MEMBER_URL);
    expect(probed).toMatchObject({
      merged: true,
      mergedAt: '2026-09-29T14:16:03Z',
      mergeCommit: SQUASH,
      landedVia: { trainPr: 1940, trainMergeCommit: TRAIN_MERGE, squashCommit: SQUASH, baseRefName: 'staging' },
    });
  });

  it('end to end: the task closes to verified, and the comment names the train and the squash', async () => {
    ghWorld();
    const aif = stubAif([
      { id: 't-train', title: 'x', status: 'done', agentActivityLog: '[2026-09-29T11:00:00.000Z] Agent: done\n' },
    ]);
    const report = await reportMergeToAif(BASE, 't-train', MEMBER_URL);
    expect(report).toMatchObject({ merged: true, approved: true, finalStatus: 'verified', landedVia: { trainPr: 1940 } });
    const msg = aif.comments('t-train')[0].message;
    expect(msg.startsWith(`Harvested and merged: ${MEMBER_URL} (landed via merge train #1940`)).toBe(true);
    expect(msg).toContain(SQUASH);
  });

  it('the rework guard uses the train merge time: activity after the train merged → refused, NO writes', async () => {
    ghWorld();
    const aif = stubAif([
      { id: 't-train', title: 'x', status: 'done', agentActivityLog: '[2026-09-29T15:00:00.000Z] Agent: rework\n' },
    ]);
    const report = await reportMergeToAif(BASE, 't-train', MEMBER_URL);
    expect(aif.writes()).toEqual([]);
    expect(report.skippedReason).toMatch(/before the task's last agent activity/);
  });

  // Paired negatives: each breaks exactly ONE link of the proof; every one must leave the task open.
  const negatives: [string, World, RegExp][] = [
    ['no train claim at all (closed and abandoned)', { comments: ['Superseded by #1999, closing.'] }, /no comment claims a train landing/],
    ['the train PR is not merged', { trainState: 'CLOSED', trainMergeCommit: null }, /not MERGED/],
    ["the train body does not name this PR's squash", { trainBody: '| #1932 | x | MERGED |\n| #1934 | dropped from the train |\n' }, /no line naming both #1934/],
    ['the squash is not in the train', { inTrain: 'diverged' }, /not an ancestor of the train's merge commit/],
    ['the squash is not on the base branch', { onBase: 'ahead' }, /not an ancestor of staging/],
    ['the squash sha resolves to a different commit', { squashResolves: 'b'.repeat(40) }, /does not resolve/],
    ['the PR is still OPEN (a claim on an open PR is ignored)', { memberState: 'OPEN' }, /not merged/],
  ];
  for (const [name, world, why] of negatives) {
    it(`${name} → stays skipped, NO writes`, async () => {
      ghWorld(world);
      const aif = stubAif([{ id: 't-train', title: 'x', status: 'done' }]);
      const report = await reportMergeToAif(BASE, 't-train', MEMBER_URL);
      expect(aif.calls).toEqual([]);
      expect(aif.status('t-train')).toBe('done');
      expect(report).toMatchObject({ merged: false, approved: false });
      expect(report.skippedReason).toMatch(why);
    });
  }

  it('the sweep index keeps a CLOSED PR only with a train claim; a claim-less closed PR never maps', async () => {
    execMock
      .mockReturnValueOnce(JSON.stringify([]))
      .mockReturnValueOnce(
        JSON.stringify([
          { url: 'u-train', state: 'CLOSED', headRefName: 'a', body: taskMarker('t-a'), comments: [{ body: CLAIM }] },
          { url: 'u-abandoned', state: 'CLOSED', headRefName: 'b', body: taskMarker('t-b'), comments: [{ body: 'closing' }] },
        ]),
      );
    const lookup = ghMergedPrIndexLookup(REPO);
    expect((await lookup({ id: 't-a', title: 't', status: 'done' })).map((p) => p.url)).toEqual(['u-train']);
    expect(await lookup({ id: 't-b', title: 't', status: 'done' })).toEqual([]);
    expect(execMock).toHaveBeenCalledTimes(2);
    expect(execMock.mock.calls[1][1]).toEqual(
      expect.arrayContaining(['--state', 'closed', '--search', '"aif-task:" in:body is:unmerged']),
    );
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
    expect(parseArgs(['--close-merged', '--project', 'p1', '--repo', 'o/r'])).toMatchObject({
      closeMerged: true,
      project: 'p1',
      repo: 'o/r',
    });
    expect(parseArgs(['t-1', '--close-merged'])).toMatchObject({ closeMerged: true, taskId: 't-1' });
  });

  it('leaves both undefined/false on an ordinary harvest', () => {
    const args = parseArgs(['task-9', '--base', 'staging']);
    expect(args.reportMerge).toBeUndefined();
    expect(args.closeMerged).toBe(false);
  });
});
