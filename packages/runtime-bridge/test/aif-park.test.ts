// packages/runtime-bridge/test/aif-park.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  parseParkArgs,
  validateParkArgs,
  buildOpenQuestionPlan,
  resolveAifBaseUrl,
  candidateBaseUrls,
  resolveReachableBaseUrl,
} from '../src/cli/park.js';
import { parkTask } from '../src/cli/park.js';

afterEach(() => vi.restoreAllMocks());

// Finding C-2 (qloop-ux-probe live re-run): the aif agent runs park.ts in a Bash-tool
// subprocess whose env is SCRUBBED of API_BASE_URL, so reading env alone falls back to an
// unreachable localhost inside the container. park probes candidates and uses the first
// reachable one, so it works from both the agent container and the host orchestrator.
describe('candidateBaseUrls — ordered, de-duplicated probe list', () => {
  it('puts env vars first, then docker service, then localhost', () => {
    expect(candidateBaseUrls({ RUNTIME_BRIDGE_AIF_URL: 'http://x:1' })).toEqual([
      'http://x:1',
      'http://api:3009',
      'http://localhost:3009',
    ]);
  });
  it('with NO env (the scrubbed agent case) still offers api:3009 before localhost', () => {
    expect(candidateBaseUrls({})).toEqual(['http://api:3009', 'http://localhost:3009']);
  });
  it('de-duplicates when an env var equals a default', () => {
    expect(candidateBaseUrls({ API_BASE_URL: 'http://localhost:3009' })).toEqual([
      'http://localhost:3009',
      'http://api:3009',
    ]);
  });
});

describe('resolveReachableBaseUrl — first reachable candidate wins', () => {
  it('returns api:3009 when localhost is refused and api is reachable (the agent container)', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.startsWith('http://localhost:3009')) throw new Error('ECONNREFUSED');
      return new Response('[]'); // api:3009 reachable
    });
    const got = await resolveReachableBaseUrl({}, fetchImpl as never);
    expect(got).toBe('http://api:3009');
  });
  it('returns localhost when set first and reachable (the host orchestrator)', async () => {
    const fetchImpl = vi.fn(async () => new Response('[]'));
    const got = await resolveReachableBaseUrl({ RUNTIME_BRIDGE_AIF_URL: 'http://localhost:3009' }, fetchImpl as never);
    expect(got).toBe('http://localhost:3009');
  });

  // Negative guard: green now; RED if the probe regressed to "first candidate, no probe"
  // — it would return localhost here (refused) instead of the reachable api:3009.
  it('GUARD: does NOT return an unreachable candidate when a later one is reachable', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.startsWith('http://localhost:3009')) throw new Error('ECONNREFUSED');
      return new Response('[]');
    });
    const got = await resolveReachableBaseUrl({ RUNTIME_BRIDGE_AIF_URL: 'http://localhost:3009' }, fetchImpl as never);
    expect(got).not.toBe('http://localhost:3009');
  });
});

// park.ts is the ONLY CLI run from INSIDE the aif agent container (the agent invokes it
// on a fork). The container exposes the service as API_BASE_URL=http://api:3009 and does
// NOT set RUNTIME_BRIDGE_AIF_URL — so a localhost-only default makes park unreachable
// there (qloop-ux-probe 2026-06-01, Finding C: "fetch failed" → agent could not park).
describe('resolveAifBaseUrl — container-aware base URL precedence', () => {
  it('prefers RUNTIME_BRIDGE_AIF_URL when set (explicit override wins)', () => {
    expect(resolveAifBaseUrl({ RUNTIME_BRIDGE_AIF_URL: 'http://explicit:1', API_BASE_URL: 'http://api:3009' }))
      .toBe('http://explicit:1');
  });
  it('falls back to API_BASE_URL when RUNTIME_BRIDGE_AIF_URL is unset (the container case — Finding C fix)', () => {
    expect(resolveAifBaseUrl({ API_BASE_URL: 'http://api:3009' })).toBe('http://api:3009');
  });
  it('falls back to http://localhost:3009 when neither is set (host orchestrator default)', () => {
    expect(resolveAifBaseUrl({})).toBe('http://localhost:3009');
  });

  // Negative guard: green on the fixed resolver, RED if the API_BASE_URL fallback ever
  // regresses to localhost-only (the exact Finding-C breakage). Proves the test catches it.
  it('GUARD: does NOT fall through to localhost while API_BASE_URL is set', () => {
    expect(resolveAifBaseUrl({ API_BASE_URL: 'http://api:3009' })).not.toBe('http://localhost:3009');
  });
});

describe('parseParkArgs', () => {
  it('reads --task and --question; --task overrides HANDOFF_TASK_ID env', () => {
    const args = parseParkArgs(['--task', 't-9', '--question', 'tone: A or B?'], { HANDOFF_TASK_ID: 't-env' });
    expect(args).toMatchObject({ taskId: 't-9', question: 'tone: A or B?', json: false });
  });
  it('falls back to HANDOFF_TASK_ID when --task is absent', () => {
    const args = parseParkArgs(['--question', 'q'], { HANDOFF_TASK_ID: 't-env' });
    expect(args.taskId).toBe('t-env');
  });
});

describe('validateParkArgs', () => {
  it('rejects a missing task id', () => {
    expect(validateParkArgs({ taskId: undefined, question: 'q', json: false })).toMatch(/missing.*task/i);
  });
  it('rejects an empty question', () => {
    expect(validateParkArgs({ taskId: 't-1', question: '   ', json: false })).toMatch(/question/i);
  });
  it('accepts a valid pair', () => {
    expect(validateParkArgs({ taskId: 't-1', question: 'q', json: false })).toBeNull();
  });
});

describe('buildOpenQuestionPlan', () => {
  it('appends a marked OPEN QUESTION block to the existing plan', () => {
    const out = buildOpenQuestionPlan('# Plan\n- step 1', 'tagline tone: A=playful / B=serious');
    expect(out).toContain('# Plan\n- step 1');
    expect(out).toContain('## ⏸ OPEN QUESTION (awaiting operator)');
    expect(out).toContain('tagline tone: A=playful / B=serious');
  });
  it('handles a null/empty existing plan', () => {
    expect(buildOpenQuestionPlan(null, 'q')).toContain('## ⏸ OPEN QUESTION (awaiting operator)');
  });
});

function okResponse(body: unknown = {}, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('parkTask — GET current plan then PUT the park fields', () => {
  it('GETs the task, then PUTs { paused, blockedReason, plan-with-OPEN-QUESTION }', async () => {
    const task = { id: 't-9', title: 'x', status: 'implementing', plan: '# Plan', paused: false, blockedReason: null };
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation((url) =>
      Promise.resolve(
        String(url).endsWith('/tasks/t-9') ? okResponse(task) : okResponse({ ...task, paused: true }),
      ),
    );
    const q = 'tagline tone: A=playful / B=serious';
    await parkTask('http://localhost:3009', 't-9', q);

    expect((spy.mock.calls[0][1] as RequestInit).method).toBe('GET');
    const put = spy.mock.calls[1][1] as RequestInit;
    expect(put.method).toBe('PUT');
    const body = JSON.parse(put.body as string);
    expect(body.blockedReason).toBe(q);
    expect(body.plan).toContain('## ⏸ OPEN QUESTION (awaiting operator)');
  });

  // ── THE GUARD (spec §4): paused:true is the stop, NOT blockedReason alone (F2/F3). ──
  // If a refactor ever regresses park to blockedReason-only, this fails loudly —
  // turning the undocumented "coordinator skips paused" dependency into an executable one.
  it('GUARD: the PUT body sets paused === true (blockedReason-only would NOT stop the agent)', async () => {
    const task = { id: 't-9', title: 'x', status: 'implementing', plan: '# Plan', paused: false, blockedReason: null };
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation((url) =>
      Promise.resolve(String(url).endsWith('/tasks/t-9') ? okResponse(task) : okResponse({})),
    );
    await parkTask('http://localhost:3009', 't-9', 'q');
    const putBody = JSON.parse((spy.mock.calls[1][1] as RequestInit).body as string);
    expect(putBody.paused).toBe(true);
  });

  // ── Finding F guard (qloop-ux-probe 2026-06-01). A park AFTER the implement→review
  // transition leaves status=review, paused=true; on resume the review pipeline runs to
  // `done` and the injected answer is NEVER re-implemented — the next chain question never
  // parks (live: task ba3b4bf6 answered c1 → done, c2 silently lost). aif's state machine
  // has zero human re-entry from `review` (HUMAN_ACTIONS_BY_STATUS.review = []), so park
  // MUST refuse at status=review, turning the silent loss into a loud, actionable error. ──
  it('GUARD: refuses to park when the task is already in review (Finding F) — issues NO PUT', async () => {
    const task = { id: 't-9', title: 'x', status: 'review', plan: '# Plan', paused: false, blockedReason: null };
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation((url) =>
      Promise.resolve(String(url).endsWith('/tasks/t-9') ? okResponse(task) : okResponse({})),
    );
    await expect(parkTask('http://localhost:3009', 't-9', 'q')).rejects.toThrow(/review/i);
    // only the GET happened; the park PUT must NOT fire (else paused=true → resume→done loss)
    expect(spy.mock.calls).toHaveLength(1);
    expect((spy.mock.calls[0][1] as RequestInit).method).toBe('GET');
  });

  // ── A6-6 (#1597 ledger): park had NO current-state check beyond status==='review'.
  // A retried park (agent retry, night-loop re-entry) appended a SECOND identical
  // OPEN QUESTION block and overwrote blockedReason, so the operator saw the same fork
  // twice in one plan and questions.ts surfaced a doubled reason. A repeat park of the
  // same question is now a no-op with a notice — the stop is already in place. ──
  it('A6-6: a repeat park of the SAME question issues NO PUT and reports alreadyParked', async () => {
    const plan = buildOpenQuestionPlan('# Plan', 'tone: A or B?');
    const task = { id: 't-9', title: 'x', status: 'implementing', plan, paused: true, blockedReason: 'tone: A or B?' };
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation((url) =>
      Promise.resolve(String(url).endsWith('/tasks/t-9') ? okResponse(task) : okResponse({})),
    );

    const res = await parkTask('http://localhost:3009', 't-9', 'tone: A or B?');

    expect(res).toEqual({ taskId: 't-9', paused: true, blockedReason: 'tone: A or B?', alreadyParked: true });
    // Only the GET — no PUT, so the plan keeps exactly one OPEN QUESTION block.
    expect(spy.mock.calls).toHaveLength(1);
    expect((spy.mock.calls[0][1] as RequestInit).method).toBe('GET');
  });

  // Negative control for A6-6: a DIFFERENT question on an already-paused task is a new
  // fork, not a duplicate — it must still be recorded (RED if the idempotency guard
  // over-reaches and starts swallowing genuine follow-up questions).
  it('CONTROL: a DIFFERENT question on an already-paused task still PUTs', async () => {
    const plan = buildOpenQuestionPlan('# Plan', 'tone: A or B?');
    const task = { id: 't-9', title: 'x', status: 'implementing', plan, paused: true, blockedReason: 'tone: A or B?' };
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation((url) =>
      Promise.resolve(String(url).endsWith('/tasks/t-9') ? okResponse(task) : okResponse({})),
    );

    const res = await parkTask('http://localhost:3009', 't-9', 'second fork: C or D?');

    expect(res.alreadyParked).toBeUndefined();
    expect(spy.mock.calls).toHaveLength(2);
    expect(JSON.parse((spy.mock.calls[1][1] as RequestInit).body as string).blockedReason).toBe('second fork: C or D?');
  });

  // Negative control paired with the guard: at a pre-review status the park DOES proceed
  // and PUTs paused:true — proving the guard blocks ONLY review, not every status (RED if
  // the guard ever over-reaches and starts rejecting legitimate pre-review parks).
  it('CONTROL: still parks normally at a pre-review status (plan_ready)', async () => {
    const task = { id: 't-9', title: 'x', status: 'plan_ready', plan: '# Plan', paused: false, blockedReason: null };
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation((url) =>
      Promise.resolve(String(url).endsWith('/tasks/t-9') ? okResponse(task) : okResponse({})),
    );
    await parkTask('http://localhost:3009', 't-9', 'q');
    expect(spy.mock.calls).toHaveLength(2);
    expect((spy.mock.calls[1][1] as RequestInit).method).toBe('PUT');
  });
});
