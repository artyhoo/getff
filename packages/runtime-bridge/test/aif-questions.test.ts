/**
 * Paired-positive/negative tests for the parked-question collector (cli/questions.ts).
 *
 * Contract under test (kickoff §10 acceptance criteria):
 *   POSITIVE — a list with one manualReviewRequired:true task → it is selected
 *              and printed in the human format. ✓
 *   NEGATIVE — a list where every task is done with no block flags →
 *              selected set empty → "No parked questions." ✓
 *   FILTER   — projectId mismatch → excluded. ✓
 *
 * Mocking strategy: vi.spyOn(globalThis, 'fetch') returning a Response, exactly
 *   like aif-rest-dispatch.test.ts / aif-status-readback.test.ts. The CLI's
 *   main() is entrypoint-guarded, so importing the module is a clean no-op.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  fetchTasks,
  selectParked,
  isParked,
  parkedReason,
  extractOpenQuestion,
  formatHuman,
  parseQuestionsArgs,
} from '../src/cli/questions.js';
import { OPEN_QUESTION_ANCHOR } from '../src/cli/openQuestion.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ── POSITIVE ──────────────────────────────────────────────────────────────────
describe('POSITIVE — a manualReviewRequired task is selected and printed', () => {
  it('fetchTasks + selectParked picks the parked task; formatHuman prints it', async () => {
    // Source: cli/questions.ts isParked — manualReviewRequired === true branch.
    const tasks = [
      { id: 't-1', title: 'Done thing', status: 'done', manualReviewRequired: false },
      {
        id: 't-2',
        title: 'Needs a human',
        status: 'review',
        manualReviewRequired: true,
        blockedReason: 'Option A → X / Option B → Y',
        projectId: 'proj-1',
      },
    ];
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(tasks));

    const fetched = await fetchTasks('http://localhost:3009');
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3009/tasks',
      expect.objectContaining({ method: 'GET' }),
    );

    const parked = selectParked(fetched);
    expect(parked).toHaveLength(1);
    expect(parked[0].id).toBe('t-2');

    const out = formatHuman(parked);
    expect(out).toContain('id:     t-2');
    expect(out).toContain('Needs a human');
    expect(out).toContain('Option A → X / Option B → Y');
    expect(out).not.toBe('No parked questions.');
  });

  it('isParked is true for blocked_external and for a non-empty blockedReason', () => {
    expect(isParked({ id: 'a', title: 'A', status: 'blocked_external' })).toBe(true);
    expect(
      isParked({ id: 'b', title: 'B', status: 'review', blockedReason: 'stuck' }),
    ).toBe(true);
  });

  it('parkedReason falls back to a trimmed reviewComments excerpt when blockedReason is absent', () => {
    const long = 'x'.repeat(400);
    const reason = parkedReason({
      id: 'c',
      title: 'C',
      status: 'blocked_external',
      reviewComments: long,
    });
    expect(reason.length).toBeLessThanOrEqual(301); // 300 chars + ellipsis
    expect(reason.endsWith('…')).toBe(true);
  });
});

// ── Finding E: mid-flight park whose blockedReason was wiped — recover the
// question from the plan's OPEN QUESTION anchor instead of "(no reason recorded)". ──
describe('extractOpenQuestion — recover the question text from the plan anchor', () => {
  it('returns the text after the anchor line (dropping the " (awaiting operator)" suffix)', () => {
    const plan = `# Plan\n\nsteps\n\n${OPEN_QUESTION_ANCHOR} (awaiting operator)\n\nOption A vs B — which default?\n`;
    expect(extractOpenQuestion(plan)).toBe('Option A vs B — which default?');
  });
  it('returns the LAST anchor block when several are present (most recent park)', () => {
    const plan = `${OPEN_QUESTION_ANCHOR} (awaiting operator)\n\nfirst\n\n${OPEN_QUESTION_ANCHOR} (awaiting operator)\n\nsecond\n`;
    expect(extractOpenQuestion(plan)).toBe('second');
  });
  it('returns null when the plan has no anchor or no body', () => {
    expect(extractOpenQuestion('# Plan\n\njust steps')).toBeNull();
    expect(extractOpenQuestion(null)).toBeNull();
  });
});

describe('parkedReason — Finding E: mid-flight park surfaces the question, not "(no reason recorded)"', () => {
  it('recovers the question from the plan when blockedReason is empty', () => {
    const reason = parkedReason({
      id: 'm',
      title: 'mid-flight',
      status: 'review',
      blockedReason: null,
      plan: `# Plan\n\n${OPEN_QUESTION_ANCHOR} (awaiting operator)\n\nWait forever or auto-default?\n`,
    });
    expect(reason).toBe('Wait forever or auto-default?');
  });

  // Negative guard: green now; RED if the plan-fallback regresses and the mid-flight
  // park falls through to the literal "(no reason recorded)" again (the Finding-E bug).
  it('GUARD: a mid-flight park does NOT render "(no reason recorded)"', () => {
    const reason = parkedReason({
      id: 'm',
      title: 'mid-flight',
      status: 'review',
      blockedReason: null,
      plan: `# Plan\n\n${OPEN_QUESTION_ANCHOR} (awaiting operator)\n\nQ?\n`,
    });
    expect(reason).not.toBe('(no reason recorded)');
  });
});

// ── NEGATIVE ──────────────────────────────────────────────────────────────────
describe('NEGATIVE — all tasks done with no block flags → No parked questions.', () => {
  it('selectParked is empty and formatHuman returns the empty sentinel', async () => {
    // Source: cli/questions.ts isParked — all three conditions false.
    const tasks = [
      { id: 'd-1', title: 'One', status: 'done', manualReviewRequired: false, blockedReason: null },
      { id: 'd-2', title: 'Two', status: 'done', manualReviewRequired: false, blockedReason: '' },
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(tasks));

    const parked = selectParked(await fetchTasks('http://localhost:3009'));
    expect(parked).toHaveLength(0);
    expect(formatHuman(parked)).toBe('No parked questions.');
  });

  it('NEGATIVE: an empty blockedReason string does NOT count as parked', () => {
    expect(
      isParked({ id: 'e', title: 'E', status: 'done', blockedReason: '   ' }),
    ).toBe(false);
  });
});

// ── FILTER ────────────────────────────────────────────────────────────────────
describe('FILTER — projectId mismatch excludes the task', () => {
  it('a parked task in another project is filtered out', () => {
    // Source: cli/questions.ts selectParked — projectId guard.
    const tasks = [
      { id: 'p-1', title: 'Mine', status: 'blocked_external', projectId: 'mine' },
      { id: 'p-2', title: 'Theirs', status: 'blocked_external', projectId: 'theirs' },
    ];
    const parked = selectParked(tasks, 'mine');
    expect(parked).toHaveLength(1);
    expect(parked[0].id).toBe('p-1');
  });

  it('--project arg overrides the env project id', () => {
    const args = parseQuestionsArgs(['--project', 'cli-proj'], {
      RUNTIME_BRIDGE_AIF_PROJECT_ID: 'env-proj',
    } as NodeJS.ProcessEnv);
    expect(args.projectId).toBe('cli-proj');
    expect(args.json).toBe(false);
  });

  it('--json flag is parsed; env project id used when no --project arg', () => {
    const args = parseQuestionsArgs(['--json'], {
      RUNTIME_BRIDGE_AIF_PROJECT_ID: 'env-proj',
    } as NodeJS.ProcessEnv);
    expect(args.projectId).toBe('env-proj');
    expect(args.json).toBe(true);
  });
});

// ── MID-FLIGHT PARK (Option A fix) ──────────────────────────────────────────────
// Paired positive/negative for the reader-side fix: a genuinely-parked task whose
// blockedReason was wiped by implementing→review still surfaces via the durable
// signals (paused === true AND the OPEN_QUESTION_ANCHOR in the plan). The
// conjunction is required — neither paused alone nor the anchor alone may match.
describe('MID-FLIGHT PARK — paused + OPEN QUESTION anchor surfaces; paused-alone / non-paused do NOT', () => {
  // Mirrors a task after park.ts ran then implementing→review cleared blockedReason.
  const midFlightParked = {
    id: 'mf-1',
    title: 'Parked on a hard fork',
    status: 'review', // NOT blocked_external
    manualReviewRequired: false, // stayed false
    blockedReason: null, // cleared by the transition
    paused: true, // the durable stop
    plan: `# Plan\n\nsome steps\n\n${OPEN_QUESTION_ANCHOR} (awaiting operator)\n\nOption A or B?\n`,
  };

  it('POSITIVE — a paused task carrying the OPEN QUESTION anchor IS surfaced (fails before the fix)', async () => {
    expect(isParked(midFlightParked)).toBe(true);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse([midFlightParked]));
    const parked = selectParked(await fetchTasks('http://localhost:3009'));
    expect(parked).toHaveLength(1);
    expect(parked[0].id).toBe('mf-1');
    expect(formatHuman(parked)).not.toBe('No parked questions.');
  });

  it('NEGATIVE — paused WITHOUT the anchor is NOT parked (no over-match on a manual pause)', () => {
    expect(
      isParked({
        id: 'mf-2',
        title: 'Manually paused, unrelated',
        status: 'review',
        manualReviewRequired: false,
        blockedReason: null,
        paused: true,
        plan: '# Plan\n\njust ordinary steps, no open question\n',
      }),
    ).toBe(false);
  });

  it('NEGATIVE — the anchor present but NOT paused is NOT parked (conjunction required)', () => {
    expect(
      isParked({
        id: 'mf-3',
        title: 'Answered + resumed, anchor lingers in plan',
        status: 'review',
        manualReviewRequired: false,
        blockedReason: null,
        paused: false,
        plan: `# Plan\n\n${OPEN_QUESTION_ANCHOR} (awaiting operator)\n\nstale block\n`,
      }),
    ).toBe(false);
  });
});

// ── BRAINSTORM FOOTER (design spec §3.4) ────────────────────────────────────────
// formatHuman appends the brainstorm-first nudge on a NON-EMPTY parked list (the
// aif-pull-channel companion to ask-question-reminder.sh §3.3); the empty case
// stays the bare sentinel.
describe('BRAINSTORM FOOTER — appended on a non-empty list, absent on the empty case', () => {
  it('POSITIVE — non-empty list carries the superpowers:brainstorming footer', () => {
    const out = formatHuman([
      { id: 'f-1', title: 'A fork', status: 'blocked_external', blockedReason: 'A or B?' },
    ]);
    expect(out).toMatch(/superpowers:brainstorming/);
    expect(out).toContain('id:     f-1'); // the card body is still present
  });

  it('NEGATIVE — empty list returns the bare sentinel, no footer', () => {
    const out = formatHuman([]);
    expect(out).toBe('No parked questions.');
    expect(out).not.toMatch(/brainstorming/);
  });

  // K-3: the footer is an AI-facing instruction — language-discipline.md §1 row 1, "English,
  // always", no AIF_HOOK_LANG gate. It shipped to consumers in Russian via the vendor drop,
  // so a non-Russian consumer's session read a Russian directive.
  it('NEGATIVE — the AI-facing footer carries no Cyrillic (internal machinery is English)', () => {
    const out = formatHuman([
      { id: 'f-1', title: 'A fork', status: 'blocked_external', blockedReason: 'A or B?' },
    ]);

    expect(out).not.toMatch(/[\u0400-\u04FF]/);
    expect(out).toMatch(/BEFORE answering/);
  });
});

// ── FETCH ERROR ───────────────────────────────────────────────────────────────
describe('fetchTasks error handling', () => {
  it('throws when the response is not a JSON array', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ not: 'an array' }));
    await expect(fetchTasks('http://localhost:3009')).rejects.toThrow(/did not return a JSON array/);
  });

  it('throws on a non-ok HTTP status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 500 }));
    await expect(fetchTasks('http://localhost:3009')).rejects.toThrow(/HTTP 500/);
  });
});
