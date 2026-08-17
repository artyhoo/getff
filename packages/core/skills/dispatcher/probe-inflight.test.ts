/**
 * dispatcher probe-inflight.sh tests
 *
 * The guard exists because of one incident: `feature/beta-delivery-ux-995e9c`
 * (2026-08-08T21:22Z) was dispatched by a session whose in-flight probe checked
 * origin branches + `gh pr list` only, ~1h after run 3 had finished inside the aif
 * container. Every signal the old §2.0 guard listed is origin/host-scoped, so a
 * container-only branch is invisible to all of them and the umbrella got a duplicate
 * run.
 *
 * The load-bearing assertion in this file is the FAIL-CLOSED pair: two invocations
 * differing ONLY in whether the container answered must produce different verdicts.
 * If PROBE-INCOMPLETE ever collapses to FRESH, the guard is back to converting
 * ignorance into permission — which is the defect, not a rough edge of it.
 *
 * Every collector is driven from fixtures via PROBE_* overrides, so these tests need
 * no docker, no gh, no network (the TASK_JSON pattern from monitor.test.ts).
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../../..');
const PROBE = resolve(REPO_ROOT, '.claude/skills/dispatcher/helpers/probe-inflight.sh');
const SKILL = resolve(REPO_ROOT, '.claude/skills/dispatcher/SKILL.md');

interface Fixture {
  slug?: string;
  originBranches?: string;
  prs?: unknown[];
  doneMd?: 'yes' | 'no';
  containerBranches?: string;
  containerStatus?: 'ok' | 'unavailable';
  tasks?: unknown[];
}

/** Run the probe against fixtures. Returns full stdout. */
function probe(f: Fixture): string {
  return execFileSync('bash', [PROBE], {
    encoding: 'utf8',
    env: {
      ...process.env,
      SLUG: f.slug ?? 'x',
      PROBE_ORIGIN_BRANCHES: f.originBranches ?? '',
      PROBE_PRS: JSON.stringify(f.prs ?? []),
      PROBE_DONE_MD: f.doneMd ?? 'no',
      PROBE_CONTAINER_BRANCHES: f.containerBranches ?? '',
      PROBE_CONTAINER_STATUS: f.containerStatus ?? 'ok',
      PROBE_TASKS: JSON.stringify(f.tasks ?? []),
    },
  });
}

const verdict = (f: Fixture): string =>
  (probe(f).trim().split('\n').pop() ?? '').replace('VERDICT: ', '');

// ── The fail-closed pair — this is the whole point of the helper ──────────────

describe('probe-inflight.sh — fail-closed on an unrun container probe', () => {
  const clean: Fixture = { originBranches: '', prs: [], doneMd: 'no', tasks: [] };

  it('container answered "nothing here" → FRESH', () =>
    expect(verdict({ ...clean, containerStatus: 'ok' })).toBe('FRESH'));

  it('container could NOT be asked → PROBE-INCOMPLETE, never FRESH', () =>
    expect(verdict({ ...clean, containerStatus: 'unavailable' })).toBe('PROBE-INCOMPLETE'));

  it('the two differ — an unasked question must not render as a clean answer', () =>
    expect(verdict({ ...clean, containerStatus: 'unavailable' })).not.toBe(
      verdict({ ...clean, containerStatus: 'ok' }),
    ));

  it('an unreachable aif task API also fails closed (curl error text, not an array)', () => {
    const out = execFileSync('bash', [PROBE], {
      encoding: 'utf8',
      env: {
        ...process.env,
        SLUG: 'x',
        PROBE_ORIGIN_BRANCHES: '',
        PROBE_PRS: '[]',
        PROBE_DONE_MD: 'no',
        PROBE_CONTAINER_BRANCHES: '',
        PROBE_CONTAINER_STATUS: 'ok',
        PROBE_TASKS: 'curl: (7) Failed to connect',
      },
    });
    expect(out).toMatch(/SIGNAL task-done-unharvested \d+ status=unavailable/);
    expect(out.trim().split('\n').pop()).toBe('VERDICT: PROBE-INCOMPLETE');
  });
});

// ── The incident shape ────────────────────────────────────────────────────────

describe('probe-inflight.sh — the 995e9c incident shape', () => {
  it('a done task whose branch carries no PR → DONE-UNHARVESTED', () =>
    expect(
      verdict({
        containerBranches: 'feature/x-abc123',
        tasks: [{ id: 'abc12345-0000', status: 'done', branchName: 'feature/x-abc123' }],
      }),
    ).toBe('DONE-UNHARVESTED'));

  it('verified counts as finished too', () =>
    expect(
      verdict({
        containerBranches: 'feature/x-abc123',
        tasks: [{ id: 'abc12345-0000', status: 'verified', branchName: 'feature/x-abc123' }],
      }),
    ).toBe('DONE-UNHARVESTED'));

  it('paired-negative: the same task once harvested to a PR is NOT unharvested', () =>
    expect(
      verdict({
        originBranches: 'feature/x-abc123',
        prs: [{ number: 1, state: 'OPEN', headRefName: 'feature/x-abc123' }],
        containerBranches: 'feature/x-abc123',
        tasks: [{ id: 'abc12345-0000', status: 'done', branchName: 'feature/x-abc123' }],
      }),
    ).not.toBe('DONE-UNHARVESTED'));

  it('paired-negative: a still-running task is not reported as unharvested', () =>
    expect(
      verdict({
        containerBranches: 'feature/x-abc123',
        tasks: [{ id: 'abc12345-0000', status: 'implementing', branchName: 'feature/x-abc123' }],
      }),
    ).not.toBe('DONE-UNHARVESTED'));

  it("another umbrella's finished task does not leak into this slug", () =>
    expect(
      verdict({
        slug: 'x',
        tasks: [{ id: 'def67890-0000', status: 'done', branchName: 'feature/other-def678' }],
      }),
    ).toBe('FRESH'));
});

// ── Container-only detection ──────────────────────────────────────────────────

describe('probe-inflight.sh — container-only branch detection', () => {
  it('a branch present in the container and absent from origin is reported as container-only', () =>
    expect(probe({ containerBranches: 'feature/x-abc123' })).toMatch(
      /container-only: feature\/x-abc123/,
    ));

  it('a branch present in BOTH is not container-only (origin can already see it)', () =>
    expect(probe({ originBranches: 'feature/x-abc123', containerBranches: 'feature/x-abc123' })).toMatch(
      /SIGNAL container-branch 1 only=0/,
    ));

  it('a container-only branch alone is enough to block a FRESH verdict', () =>
    expect(verdict({ containerBranches: 'feature/x-abc123' })).toBe('IN-FLIGHT'));

  it('git decoration markers (+ and *) are stripped from container branch names', () =>
    expect(probe({ containerBranches: '+ feature/x-abc123' })).toMatch(
      /container-only: feature\/x-abc123/,
    ));
});

// ── Verdict precedence + output integrity ─────────────────────────────────────

describe('probe-inflight.sh — verdict precedence and output integrity', () => {
  it('done.md plus a second origin signal → ALREADY-DONE', () =>
    expect(
      verdict({
        doneMd: 'yes',
        originBranches: 'feature/x-abc123',
        prs: [{ number: 1, state: 'MERGED', headRefName: 'feature/x-abc123' }],
      }),
    ).toBe('ALREADY-DONE'));

  it('an unharvested task outranks a closed umbrella — a loose end is still loose', () =>
    expect(
      verdict({
        doneMd: 'yes',
        originBranches: 'feature/x-abc123',
        prs: [{ number: 1, state: 'MERGED', headRefName: 'feature/x-abc123' }],
        containerBranches: 'feature/x-zzz999',
        tasks: [{ id: 'zzz99900-0000', status: 'done', branchName: 'feature/x-zzz999' }],
      }),
    ).toBe('DONE-UNHARVESTED'));

  it('an unrun probe outranks every other verdict', () =>
    expect(
      verdict({
        containerStatus: 'unavailable',
        doneMd: 'yes',
        originBranches: 'feature/x-abc123',
        prs: [{ number: 1, state: 'MERGED', headRefName: 'feature/x-abc123' }],
      }),
    ).toBe('PROBE-INCOMPLETE'));

  it('a missing SLUG is PROBE-INCOMPLETE, not an empty-match FRESH', () => {
    const out = execFileSync('bash', [PROBE], {
      encoding: 'utf8',
      env: { ...process.env, SLUG: '' },
    });
    expect(out.trim().split('\n').pop()).toBe('VERDICT: PROBE-INCOMPLETE');
  });

  it('exits 0 on every verdict — a guard that aborts is a guard that gets skipped', () => {
    // execFileSync throws on a non-zero exit, so reaching the expect IS the assertion.
    expect(probe({ containerStatus: 'unavailable' })).toMatch(/^VERDICT: /m);
  });

  it('the printed detail lines match the signal counts (no silently dropped last entry)', () => {
    const out = probe({
      containerBranches: 'feature/x-aaa111\nfeature/x-bbb222\nfeature/x-ccc333',
      tasks: [
        { id: 'aaa11100-0000', status: 'done', branchName: 'feature/x-aaa111' },
        { id: 'bbb22200-0000', status: 'done', branchName: 'feature/x-bbb222' },
        { id: 'ccc33300-0000', status: 'done', branchName: 'feature/x-ccc333' },
      ],
    });
    const claimed = Number(/SIGNAL task-done-unharvested (\d+)/.exec(out)?.[1]);
    const shown = out.split('\n').filter((l) => l.includes('unharvested: ')).length;
    expect(shown).toBe(claimed);
    expect(claimed).toBe(3);
  });
});

// ── The skill actually calls it ───────────────────────────────────────────────

describe('probe-inflight.sh — wired into SKILL.md §2.0', () => {
  const skill = readFileSync(SKILL, 'utf8');

  it('§2.0 invokes the helper rather than re-listing the probe commands in prose', () =>
    expect(skill).toMatch(/helpers\/probe-inflight\.sh/));

  it('§2.0 documents every verdict the helper can emit', () => {
    for (const v of ['PROBE-INCOMPLETE', 'DONE-UNHARVESTED', 'ALREADY-DONE', 'IN-FLIGHT', 'FRESH']) {
      expect(skill).toContain(v);
    }
  });
});
