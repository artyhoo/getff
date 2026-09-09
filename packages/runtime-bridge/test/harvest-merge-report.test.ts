/**
 * Tests for the aif RETURN CHANNEL (cli/harvest.ts → reportMergeToAif), added 2026-09-09.
 *
 * The gap it closes: harvest was one-way. `grep -c "postJson\|putTask" cli/harvest.ts` → 0 —
 * the branch is bundled to the host, pushed, PR'd and merged on GitHub, and aif is never told.
 * A task therefore has NO mechanism to learn that its work shipped, so it sits in `review`
 * forever, holding an `executionOwner:"ai"` pipeline lane
 * (`countActivePipelineTasksForProject` counts `review`). Measured 2026-09-09: four parks were
 * still open with their PRs merged days earlier (#1667, #1668, #1680, #1688). Closing them
 * rested on a human remembering to click — the `#hope-as-gate` anti-pattern of
 * `.claude/rules/attention-is-not-a-mechanism.md §2`, applied to ourselves.
 *
 * Contract:
 *   PR not merged        → NO writes at all (never narrate an unfinished merge into the task).
 *   merged + `review`    → comment naming the PR, THEN `complete_review` (→ done, lane freed).
 *   merged + other state → comment only; the event is refused from anything but `review`
 *                          (`stateMachine.js:91`), so it is not attempted.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { reportMergeToAif, parseArgs } from '../src/cli/harvest.js';

function okResponse(body: unknown = {}, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

afterEach(() => {
  vi.restoreAllMocks();
});

const MERGED = async () => ({ merged: true, mergedAt: '2026-09-09T08:12:31Z' });
const NOT_MERGED = async () => ({ merged: false, mergedAt: null });

describe('reportMergeToAif — the harvest→aif return channel', () => {
  it('an unmerged PR writes NOTHING back', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const report = await reportMergeToAif('http://aif.test', 't-1', 'https://gh/x/y/pull/7', NOT_MERGED);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(report.merged).toBe(false);
    expect(report.commented).toBe(false);
    expect(report.closedReview).toBe(false);
  });

  it('a merged PR on a `review` task comments FIRST, then sends complete_review', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementationOnce(async () => okResponse({ id: 't-2', status: 'review' }))
      .mockImplementationOnce(async () => okResponse({ ok: true }))
      .mockImplementationOnce(async () => okResponse({ participantsModeEnabled: true }))
      .mockImplementation(async () => okResponse({ ok: true }));

    const report = await reportMergeToAif('http://aif.test', 't-2', 'https://gh/x/y/pull/1688', MERGED);

    expect(fetchSpy).toHaveBeenCalledTimes(4);
    const [commentUrl, commentInit] = fetchSpy.mock.calls[1] as [string, RequestInit];
    const [eventUrl, eventInit] = fetchSpy.mock.calls[3] as [string, RequestInit];
    expect(commentUrl).toBe('http://aif.test/tasks/t-2/comments');
    expect(String(JSON.parse(String(commentInit.body)).message)).toContain('https://gh/x/y/pull/1688');
    expect(eventUrl).toBe('http://aif.test/tasks/t-2/events');
    expect(JSON.parse(String(eventInit.body))).toEqual({ event: 'complete_review' });
    expect(report).toMatchObject({ merged: true, commented: true, closedReview: true });
  });

  it('a merged PR on a NON-review task comments but sends no event, naming the status', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementationOnce(async () => okResponse({ id: 't-3', status: 'implementing' }))
      .mockImplementation(async () => okResponse({ ok: true }));

    const report = await reportMergeToAif('http://aif.test', 't-3', 'https://gh/x/y/pull/9', MERGED);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect((fetchSpy.mock.calls[1] as [string, RequestInit])[0]).toBe('http://aif.test/tasks/t-3/comments');
    expect(report.closedReview).toBe(false);
    expect(report.skippedReason).toContain('implementing');
  });

  it('the comment records the merge timestamp, so the task carries its own audit trail', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockImplementationOnce(async () => okResponse({ id: 't-4', status: 'review' }))
      .mockImplementation(async () => okResponse({ ok: true }));

    await reportMergeToAif('http://aif.test', 't-4', 'https://gh/x/y/pull/1', MERGED);

    const body = JSON.parse(
      String(((globalThis.fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[1][1]).body),
    );
    expect(String(body.message)).toContain('2026-09-09T08:12:31Z');
  });
});

describe('--report-merge wires the return channel to the CLI', () => {
  it('parses --report-merge <prUrl> alongside the task id', () => {
    const args = parseArgs(['task-9', '--report-merge', 'https://gh/x/y/pull/1688']);
    expect(args.taskId).toBe('task-9');
    expect(args.reportMerge).toBe('https://gh/x/y/pull/1688');
  });

  it('leaves reportMerge undefined on an ordinary harvest', () => {
    expect(parseArgs(['task-9', '--base', 'staging']).reportMerge).toBeUndefined();
  });
});

// ── the reachability gate the mocked-fetch tests above could not see ───────────
// Running the channel for real on two merged parks (2026-09-09) — one ai-owned, one
// human-owned — both returned `HTTP 409 {"error":"Unknown task event"}` with every test
// above green. The gate is the deployment's participants mode, not the task: with it off
// (this deployment: `GET /auth/session` → false) every event resolves through
// `resolveLegacyAction`, which has no exit from `review` for any owner. The merge evidence
// is still worth writing; the close is not attempted, and the report says why.
describe('reportMergeToAif does not attempt a close the deployment cannot serve', () => {
  it('legacy mode: comments, skips the event, and names the two real levers', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementationOnce(async () => okResponse({ id: 't-lg', status: 'review', executionOwner: 'ai' }))
      .mockImplementationOnce(async () => okResponse({ ok: true }))
      .mockImplementationOnce(async () => okResponse({ participantsModeEnabled: false }));

    const report = await reportMergeToAif('http://aif.test', 't-lg', 'https://gh/x/y/pull/1680', MERGED);

    expect(fetchSpy.mock.calls.map((c) => c[0])).toEqual([
      'http://aif.test/tasks/t-lg',
      'http://aif.test/tasks/t-lg/comments',
      'http://aif.test/auth/session',
    ]);
    expect(report.commented).toBe(true);
    expect(report.closedReview).toBe(false);
    expect(report.skippedReason).toMatch(/participants mode/i);
    expect(report.skippedReason).toMatch(/handoff/i);
  });

  it('participants mode on: the close is attempted as before', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementationOnce(async () => okResponse({ id: 't-pm', status: 'review' }))
      .mockImplementationOnce(async () => okResponse({ ok: true }))
      .mockImplementationOnce(async () => okResponse({ participantsModeEnabled: true }))
      .mockImplementation(async () => okResponse({ ok: true }));

    const report = await reportMergeToAif('http://aif.test', 't-pm', 'https://gh/x/y/pull/1680', MERGED);

    expect(fetchSpy.mock.calls.map((c) => c[0])[3]).toBe('http://aif.test/tasks/t-pm/events');
    expect(report.closedReview).toBe(true);
  });
});
