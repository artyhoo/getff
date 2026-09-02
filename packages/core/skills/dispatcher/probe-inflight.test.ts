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
import { describe, it, expect, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../../..');
const PROBE = resolve(REPO_ROOT, '.claude/skills/dispatcher/helpers/probe-inflight.sh');
const SKILL = resolve(REPO_ROOT, '.claude/skills/dispatcher/SKILL.md');

/**
 * Per-test timeout for the ONE arm that writes a fresh executable and then runs it.
 * Measured 2026-09-02 (macOS, clean `origin/staging` @ 58ce396802): the FIRST exec of a
 * newly created executable blocks ~0.65s in the kernel first-launch scan (0% CPU), while
 * every re-exec of that same file costs ~5ms. That is the whole delta — arm (b) is ~711ms
 * in isolation against ~60-145ms for its 57 siblings, and under `vitest run skills/`
 * file-parallelism it inflates to ~5.3s and false-fails on vitest's 5s default: a mis-set
 * gate, not an assertion signal (`test:skills` gave `1 failed | 276 passed` while the file
 * alone was green in ~810ms, stopping `run-local-ci-sweep.sh` at `vitest-skills`). The
 * cost cannot be narrowed away — the arm exists to reach the REAL stderr-capture path,
 * which requires a stub the test must create itself. 30_000 is the SLOW_SHELL_MS
 * convention of the sibling shell-spawning suites (PR #848; see
 * `principles/20-bundle-classification.test.ts`, `hooks/create-worktree.test.ts`), scoped
 * to that single `it` so the other 57 arms keep the tight 5s default. NEVER a global
 * `testTimeout` bump.
 */
const SLOW_SHELL_MS = 30_000;

interface Fixture {
  slug?: string;
  originBranches?: string;
  prs?: unknown[];
  doneMd?: 'yes' | 'no';
  containerBranches?: string;
  containerStatus?: 'ok' | 'unavailable';
  tasks?: unknown[];
  /** Minutes before a claim reads STALE (probe default 120). */
  claimTtlMin?: number;
  /** Frozen "now" as epoch seconds, so claim ages are deterministic. */
  nowEpoch?: number;
  /** Working directory for the probe (Signal 3 is cwd-relative). Default: inherit. */
  cwd?: string;
  /** Leave PROBE_DONE_MD UNSET so the probe resolves done.md from the real filesystem. */
  omitDoneMd?: boolean;
  /** Project-list fixture → PROBE_PROJECTS (default []). projectsRaw overrides with a verbatim string. */
  projects?: unknown[];
  projectsRaw?: string;
  /** Drop PROBE_CONTAINER_BRANCHES/STATUS so the live (non-injected) container path runs. */
  omitContainerInjection?: boolean;
  /** Pinned RUNTIME_BRIDGE_AIF_PROJECT_ID (stripped from the merged env unless set here). */
  runtimeProjectId?: string;
  /** Pinned AIF_REPO_PATH (stripped from the merged env unless set here). */
  aifRepoPath?: string;
  /** Absolute path to a PROBE_DOCKER_BIN stub (arm b). */
  dockerBin?: string;
}

/** Fixed clock for the claim-age fixtures: 2026-08-18T12:00:00Z. */
const NOW = Math.floor(Date.parse('2026-08-18T12:00:00.000Z') / 1000);

/** A paused, unfinished task created `minutesAgo` before NOW — i.e. a claim. */
function claimTask(slug: string, minutesAgo: number, over: Record<string, unknown> = {}): unknown {
  return {
    id: `claim-${minutesAgo}-abcdefgh`,
    status: 'backlog',
    paused: true,
    title: slug,
    description: `# kickoff for ${slug}`,
    branchName: '',
    createdAt: new Date((NOW - minutesAgo * 60) * 1000).toISOString(),
    ...over,
  };
}

/** Run the probe against fixtures. Returns full stdout. */
function probe(f: Fixture): string {
  // Ambient-host hygiene: RUNTIME_BRIDGE_AIF_PROJECT_ID / AIF_REPO_PATH are exported on
  // the operator host (issue 1439 payload measurement) and PROBE_* seeds may leak from
  // the calling shell — every ambient key the probe reads is destructured OUT of the
  // MERGED env (the omitDoneMd pattern), then re-seeded explicitly per fixture. Without
  // this, arms behave differently host vs CI.
  const {
    RUNTIME_BRIDGE_AIF_PROJECT_ID: _omitPid,
    AIF_REPO_PATH: _omitRepo,
    PROBE_DONE_MD: _omitDoneMd,
    PROBE_PROJECTS: _omitProjects,
    PROBE_DOCKER_BIN: _omitDockerBin,
    PROBE_CONTAINER_BRANCHES: _omitCb,
    PROBE_CONTAINER_STATUS: _omitCs,
    ...cleanEnv
  } = process.env;
  void _omitPid;
  void _omitRepo;
  void _omitDoneMd;
  void _omitProjects;
  void _omitDockerBin;
  void _omitCb;
  void _omitCs;
  const env: NodeJS.ProcessEnv = {
    ...cleanEnv,
    SLUG: f.slug ?? 'x',
    PROBE_ORIGIN_BRANCHES: f.originBranches ?? '',
    PROBE_PRS: JSON.stringify(f.prs ?? []),
    PROBE_PROJECTS: f.projectsRaw ?? JSON.stringify(f.projects ?? []),
    PROBE_TASKS: JSON.stringify(f.tasks ?? []),
    PROBE_CLAIM_TTL_MIN: String(f.claimTtlMin ?? 120),
    PROBE_NOW_EPOCH: String(f.nowEpoch ?? NOW),
  };
  if (!f.omitDoneMd) env.PROBE_DONE_MD = f.doneMd ?? 'no';
  if (!f.omitContainerInjection) {
    env.PROBE_CONTAINER_BRANCHES = f.containerBranches ?? '';
    env.PROBE_CONTAINER_STATUS = f.containerStatus ?? 'ok';
  }
  if (f.runtimeProjectId !== undefined) env.RUNTIME_BRIDGE_AIF_PROJECT_ID = f.runtimeProjectId;
  if (f.aifRepoPath !== undefined) env.AIF_REPO_PATH = f.aifRepoPath;
  if (f.dockerBin !== undefined) env.PROBE_DOCKER_BIN = f.dockerBin;
  return execFileSync('bash', [PROBE], { encoding: 'utf8', env, cwd: f.cwd });
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
        PROBE_PROJECTS: '[]',
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
    // Seeds mirror probe()'s defaults so this raw arm stays inert against the
    // resolution block — today the SLUG-not-set guard exits before it, the seeds
    // keep that true even if the guard ever moves.
    const out = execFileSync('bash', [PROBE], {
      encoding: 'utf8',
      env: {
        ...process.env,
        SLUG: '',
        PROBE_PROJECTS: '[]',
        PROBE_TASKS: '[]',
        PROBE_DOCKER_BIN: 'docker',
        PROBE_CONTAINER_BRANCHES: '',
        PROBE_CONTAINER_STATUS: 'ok',
      },
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

// ── Signal 6: the claim — the window signals 1-5 structurally cannot see ──────

describe('probe-inflight.sh — claim signal (spec §5.3, probe P4)', () => {
  it('a fresh paused claim flips the verdict off FRESH — the whole point of the signal', () => {
    const out = probe({ slug: 'demo', tasks: [claimTask('demo', 5)] });
    expect(out).toMatch(/SIGNAL claim 1 live=1 stale=0/);
    expect(out.trim().split('\n').pop()).toBe('VERDICT: CLAIMED');
  });

  it('RED/GREEN pair: the SAME probe with the claim removed returns FRESH', () => {
    expect(verdict({ slug: 'demo', tasks: [claimTask('demo', 5)] })).toBe('CLAIMED');
    expect(verdict({ slug: 'demo', tasks: [] })).toBe('FRESH');
  });

  it('the five pre-existing signals are ALL clean while the claim blocks — the blind spot', () => {
    const out = probe({ slug: 'demo', tasks: [claimTask('demo', 5)] });
    expect(out).toContain('SIGNAL origin-branch 0');
    expect(out).toContain('SIGNAL pr 0 open=0');
    expect(out).toContain('SIGNAL done-md no');
    expect(out).toContain('SIGNAL container-branch 0 only=0 status=ok');
    expect(out).toContain('SIGNAL task-done-unharvested 0 status=ok');
    expect(verdict({ slug: 'demo', tasks: [claimTask('demo', 5)] })).not.toBe('FRESH');
  });

  it('paired-negative: an UNpaused task at the same status is not a claim', () =>
    expect(verdict({ slug: 'demo', tasks: [claimTask('demo', 5, { paused: false })] })).toBe('FRESH'));

  it('paired-negative: a paused but FINISHED task is not a claim (the queue keeps those)', () => {
    for (const status of ['done', 'verified']) {
      expect(
        verdict({ slug: 'demo', tasks: [claimTask('demo', 5, { status, branchName: '' })] }),
        `paused ${status} must not read as a claim`,
      ).toBe('FRESH');
    }
  });

  it("paired-negative: another umbrella's claim does not leak into this slug", () =>
    expect(verdict({ slug: 'demo', tasks: [claimTask('other-umbrella', 5)] })).toBe('FRESH'));

  it('matches on the description too, not only the title', () =>
    expect(
      verdict({
        slug: 'demo',
        tasks: [claimTask('demo', 5, { title: 'unrelated-title' })],
      }),
    ).toBe('CLAIMED'));

  it('a task TITLE containing " stale " does not corrupt the stale count', () => {
    // Regression: the count was `grep -c ' stale '` over the whole detail line, so a
    // claim titled "demo fix stale refs" was counted expired one minute after creation
    // — the verdict then told the operator to cancel a live lane. Counting reads the
    // fixed field-3 state token now; the title can say anything.
    const out = probe({
      slug: 'demo',
      tasks: [claimTask('demo', 1, { title: 'demo fix stale refs' })],
    });
    expect(out).toMatch(/SIGNAL claim 1 live=1 stale=0/);
    expect(out.trim().split('\n').pop()).toBe('VERDICT: CLAIMED');
  });

  it('the inverse holds too: a genuinely stale claim with "live" in its title still expires', () => {
    const out = probe({
      slug: 'demo',
      tasks: [claimTask('demo', 500, { title: 'demo live smoke' })],
    });
    expect(out).toMatch(/SIGNAL claim 1 live=0 stale=1/);
    expect(out.trim().split('\n').pop()).toBe('VERDICT: STALE-CLAIM');
  });

  it('a multi-line title cannot inflate the claim count', () => {
    const out = probe({
      slug: 'demo',
      tasks: [claimTask('demo', 5, { title: 'demo\nsecond line\nthird' })],
    });
    expect(out).toMatch(/SIGNAL claim 1 /);
    expect(out.split('\n').filter((l) => l.startsWith('  claim: '))).toHaveLength(1);
  });

  it('the printed detail lines match the signal count', () => {
    const out = probe({ slug: 'demo', tasks: [claimTask('demo', 5), claimTask('demo', 7)] });
    expect(out).toMatch(/SIGNAL claim 2 /);
    expect(out.split('\n').filter((l) => l.startsWith('  claim: '))).toHaveLength(2);
  });
});

// ── Orphan expiry — a dead session must not starve the stage forever (TD-F5) ──

describe('probe-inflight.sh — orphan claim expiry', () => {
  it('a claim past the TTL reads STALE-CLAIM, not an eternal block', () => {
    const out = probe({ slug: 'demo', tasks: [claimTask('demo', 240)] });
    expect(out).toMatch(/SIGNAL claim 1 live=0 stale=1 ttl=120min/);
    expect(out.trim().split('\n').pop()).toBe('VERDICT: STALE-CLAIM');
  });

  it('the boundary is the TTL: one minute under is live, one over is stale', () => {
    expect(verdict({ slug: 'demo', tasks: [claimTask('demo', 119)] })).toBe('CLAIMED');
    expect(verdict({ slug: 'demo', tasks: [claimTask('demo', 121)] })).toBe('STALE-CLAIM');
  });

  it('exactly AT the TTL is still live — the predicate is strictly-older-than', () => {
    // Pinned because the degenerate config surprises otherwise: PROBE_CLAIM_TTL_MIN=0
    // does NOT mean "sweep everything", it means "stale once at least a minute old".
    expect(verdict({ slug: 'demo', tasks: [claimTask('demo', 120)] })).toBe('CLAIMED');
    expect(verdict({ slug: 'demo', tasks: [claimTask('demo', 0)], claimTtlMin: 0 })).toBe('CLAIMED');
    expect(verdict({ slug: 'demo', tasks: [claimTask('demo', 1)], claimTtlMin: 0 })).toBe(
      'STALE-CLAIM',
    );
  });

  it('the TTL is configurable — the same claim flips with the knob', () => {
    expect(verdict({ slug: 'demo', tasks: [claimTask('demo', 30)] })).toBe('CLAIMED');
    expect(verdict({ slug: 'demo', tasks: [claimTask('demo', 30)], claimTtlMin: 10 })).toBe(
      'STALE-CLAIM',
    );
  });

  it('an unparseable createdAt counts as LIVE — the guard fails toward blocking', () => {
    const out = probe({
      slug: 'demo',
      tasks: [claimTask('demo', 5, { createdAt: 'not-a-date' })],
    });
    expect(out).toMatch(/SIGNAL claim 1 live=1 stale=0/);
    expect(out.trim().split('\n').pop()).toBe('CLAIMED'.replace(/^/, 'VERDICT: '));
  });

  it('a missing createdAt likewise reads live, never stale', () => {
    const t = claimTask('demo', 5) as Record<string, unknown>;
    delete t['createdAt'];
    expect(verdict({ slug: 'demo', tasks: [t] })).toBe('CLAIMED');
  });
});

// ── Where the claim verdicts sit in the ladder ────────────────────────────────

describe('probe-inflight.sh — claim verdict precedence', () => {
  it('STALE-CLAIM outranks CLAIMED — report the item needing a decision', () =>
    expect(verdict({ slug: 'demo', tasks: [claimTask('demo', 5), claimTask('demo', 500)] })).toBe(
      'STALE-CLAIM',
    ));

  it('an unharvested finished task still outranks any claim', () =>
    expect(
      verdict({
        slug: 'demo',
        tasks: [claimTask('demo', 500), { id: 'd0d0d0d0', status: 'done', branchName: 'feature/demo-1' }],
      }),
    ).toBe('DONE-UNHARVESTED'));

  it('an unrun probe still outranks a claim — ignorance never becomes permission', () =>
    expect(
      verdict({ slug: 'demo', tasks: [claimTask('demo', 5)], containerStatus: 'unavailable' }),
    ).toBe('PROBE-INCOMPLETE'));

  it('a live claim outranks a closed umbrella — someone is acting on it right now', () =>
    expect(
      verdict({
        slug: 'demo',
        tasks: [claimTask('demo', 5)],
        doneMd: 'yes',
        originBranches: 'claude/demo-1',
      }),
    ).toBe('CLAIMED'));

  it('a live claim outranks IN-FLIGHT — it names the session, not just the artefact', () =>
    expect(verdict({ slug: 'demo', tasks: [claimTask('demo', 5)], originBranches: 'claude/demo-1' })).toBe(
      'CLAIMED',
    ));

  it('still exits 0 on the claim verdicts (a guard that aborts gets skipped)', () => {
    for (const tasks of [[claimTask('demo', 5)], [claimTask('demo', 500)]]) {
      expect(() => probe({ slug: 'demo', tasks })).not.toThrow();
    }
  });
});

describe('probe-inflight.sh — wired into SKILL.md §2.0', () => {
  const skill = readFileSync(SKILL, 'utf8');

  it('§2.0 invokes the helper rather than re-listing the probe commands in prose', () =>
    expect(skill).toMatch(/helpers\/probe-inflight\.sh/));

  it('§2.0 documents every verdict the helper can emit', () => {
    for (const v of [
      'PROBE-INCOMPLETE',
      'DONE-UNHARVESTED',
      'STALE-CLAIM',
      'CLAIMED',
      'ALREADY-DONE',
      'IN-FLIGHT',
      'FRESH',
    ]) {
      expect(skill).toContain(v);
    }
  });
});

// ── Signal 3 resolves the orch home by LAYOUT (issue 1414) ────────────────────
// A consumer install receives kickoffs under .ai-factory/orchestrator-prompts/
// (setup.d/30-templates.sh:17) and never has .claude/orchestrator-prompts, so the old
// single -f test read "no" for every closed consumer umbrella — measured live on
// artyhoo/timeliner (2026-08-17). These arms drive Signal 3 against REAL filesystem
// layouts (omitDoneMd → no override; cwd → a temp tree), which the PROBE_DONE_MD seam
// structurally could not exercise.

const AI_FACTORY_HOME = '.ai-factory/orchestrator-prompts';
const CLAUDE_HOME = '.claude/orchestrator-prompts';

/** Temp repo-root-like tree with `<home>/<slug>/done.md` present or absent, per layout. */
function orchTree(slug: string, o: { claude?: boolean; aiFactory?: boolean }): string {
  const root = mkdtempSync(join(tmpdir(), 'probe-orch-'));
  for (const [home, hasDone] of [
    [CLAUDE_HOME, o.claude],
    [AI_FACTORY_HOME, o.aiFactory],
  ] as const) {
    if (hasDone === undefined) continue;
    mkdirSync(join(root, home, slug), { recursive: true });
    if (hasDone) writeFileSync(join(root, home, slug, 'done.md'), 'closed\n');
  }
  return root;
}

describe('probe-inflight.sh — orch-home resolution for consumer layouts (issue 1414)', () => {
  const roots: string[] = [];
  afterAll(() => {
    for (const r of roots) rmSync(r, { recursive: true, force: true });
  });
  const tree = (o: { claude?: boolean; aiFactory?: boolean }): string => {
    const t = orchTree('x', o);
    roots.push(t);
    return t;
  };

  it('(a) .ai-factory layout, closed umbrella, ZERO unharvested tasks → done-md yes AND ALREADY-DONE', () => {
    // T-CLP-B: tasks MUST be empty here. With an unharvested task, DONE-UNHARVESTED
    // outranks and a signal-only assertion would pass while the symptom persists. The
    // merged PR is the second origin signal ALREADY-DONE requires (origin_signals >= 2).
    const out = probe({
      cwd: tree({ aiFactory: true }),
      omitDoneMd: true,
      originBranches: 'feature/x-abc123',
      prs: [{ number: 1, state: 'MERGED', headRefName: 'feature/x-abc123' }],
      tasks: [],
    });
    expect(out).toContain('SIGNAL done-md yes');
    expect(out.trim().split('\n').pop()).toBe('VERDICT: ALREADY-DONE');
  });

  it('(b) paired-negative: the same .ai-factory tree WITHOUT done.md → done-md no', () => {
    expect(probe({ cwd: tree({ aiFactory: false }), omitDoneMd: true })).toMatch(
      /SIGNAL done-md no/,
    );
  });

  it('(c) .claude layout control — framework behaviour unchanged → done-md yes', () => {
    expect(probe({ cwd: tree({ claude: true }), omitDoneMd: true })).toMatch(
      /SIGNAL done-md yes/,
    );
  });

  it('(c-precedence) BOTH dirs exist, done.md only under .ai-factory → no (.claude leg wins, like resolve_orch_home)', () => {
    expect(probe({ cwd: tree({ claude: false, aiFactory: true }), omitDoneMd: true })).toMatch(
      /SIGNAL done-md no/,
    );
  });

  it('(d) the PROBE_DONE_MD override still wins over a real .ai-factory done.md', () => {
    // The fixture seam every other arm in this file relies on must stay intact.
    expect(probe({ cwd: tree({ aiFactory: true }), doneMd: 'no' })).toMatch(
      /SIGNAL done-md no/,
    );
  });

  it('(e) DONE-UNHARVESTED outranks the resolved yes — the precedence the 2026-08-17 measurement pinned', () => {
    // Selector needs all three: status done, branchName containing the slug, and no PR
    // carrying that headRefName. The yes signal must still PRINT while the verdict ranks.
    const out = probe({
      cwd: tree({ aiFactory: true }),
      omitDoneMd: true,
      tasks: [{ id: 'abc12345-0000', status: 'done', branchName: 'feature/x-abc123' }],
    });
    expect(out).toContain('SIGNAL done-md yes');
    expect(out.trim().split('\n').pop()).toBe('VERDICT: DONE-UNHARVESTED');
  });
});

// ── Signal 4 asks the RIGHT repository (issue 1439) ───────────────────────────
// The container checkout is derived from the aif PROJECT record (GET /projects → the
// record whose .id == RUNTIME_BRIDGE_AIF_PROJECT_ID → rootPath, per
// kickoff-l3.decisions.md#decision-1), never hardcoded. The signal line carries the
// resolved path as a TRAILING repo= field so a consumer can SEE which repository was
// asked, and every unaskable outcome names its cause instead of rendering as ok.

describe('probe-inflight.sh — signal 4 asks the derived repository (issue 1439)', () => {
  const PROJECTS = [
    { id: 'p-timeliner', name: 'timeliner', rootPath: '/home/www/timeliner' },
    // The decoy: the framework project. Under the old hardcoded default the probe
    // asked THIS checkout while reporting ok — the wrong-target case no
    // injected-status test could see until repo= existed.
    { id: 'q-decoy', name: 'rules-as-tests-aif', rootPath: '/home/www/rules-as-tests-aif' },
  ];

  it('(a) derivable-path consumer: repo= names the RIGHT project record, not the decoy', () => {
    // Injection precedence: container status still comes from PROBE_CONTAINER_BRANCHES
    // (stays ok); the derived path is reported for visibility only.
    const out = probe({
      projects: PROJECTS,
      runtimeProjectId: 'p-timeliner',
      containerBranches: '',
      containerStatus: 'ok',
    });
    expect(out).toContain('SIGNAL container-branch 0 only=0 status=ok repo=/home/www/timeliner');
    expect(out).not.toContain('repo=/home/www/rules-as-tests-aif');
    expect(out.trim().split('\n').pop()).toBe('VERDICT: FRESH');
  });

  it(
    '(b) git-call failure surfaces its cause — the REAL capture path, not just rendering',
    { timeout: SLOW_SHELL_MS },
    () => {
      // The stub is reached via PROBE_DOCKER_BIN (not PATH shadowing, which the probe's
      // PATH prepend makes host-dependent): stderr is captured, the first line becomes
      // the reason, and the failure is PROBE-INCOMPLETE — never a clean answer.
      const stubDir = mkdtempSync(join(tmpdir(), 'probe-docker-stub-'));
      try {
        const stub = join(stubDir, 'stub-docker');
        writeFileSync(
          stub,
          '#!/usr/bin/env bash\necho "fatal: detected dubious ownership in repository at \'/home/www/timeliner\'" >&2\nexit 128\n',
          { mode: 0o755 },
        );
        const out = probe({
          omitContainerInjection: true,
          projects: [{ id: 'p-timeliner', name: 'timeliner', rootPath: '/home/www/timeliner' }],
          runtimeProjectId: 'p-timeliner',
          dockerBin: stub,
        });
        expect(out).toMatch(
          /status=unavailable repo=\/home\/www\/timeliner reason=fatal: detected dubious ownership/,
        );
        expect(out).toContain(
          "container-cause: fatal: detected dubious ownership in repository at '/home/www/timeliner'",
        );
        expect(out.trim().split('\n').pop()).toBe('VERDICT: PROBE-INCOMPLETE');
      } finally {
        rmSync(stubDir, { recursive: true, force: true });
      }
    },
  );

  it('(c) asked-and-got-nothing stays ok: derivable path, no matching branch → FRESH', () => {
    const out = probe({
      projects: PROJECTS,
      runtimeProjectId: 'p-timeliner',
      containerBranches: 'feature/other-abc',
      containerStatus: 'ok',
    });
    expect(out).toContain(
      'SIGNAL container-branch 0 only=0 status=ok repo=/home/www/timeliner',
    );
    expect(out.trim().split('\n').pop()).toBe('VERDICT: FRESH');
  });

  it('(d) framework-layout control: explicit AIF_REPO_PATH behaves as today + trailing repo=', () => {
    const out = probe({
      aifRepoPath: '/home/www/rules-as-tests-aif',
      containerBranches: '',
      containerStatus: 'ok',
    });
    expect(out).toContain(
      'SIGNAL container-branch 0 only=0 status=ok repo=/home/www/rules-as-tests-aif',
    );
    expect(out.trim().split('\n').pop()).toBe('VERDICT: FRESH');
  });

  it('(e) no-rootpath consumer: unavailable with the named cause, never ok from another project', () => {
    const out = probe({
      omitContainerInjection: true,
      runtimeProjectId: 'p-timeliner',
      projects: [{ id: 'p-timeliner', name: 'x' }],
    });
    expect(out).toMatch(/SIGNAL container-branch 0 only=0 status=unavailable reason=no-rootpath/);
    expect(out).toContain('container-cause: no-rootpath');
    expect(out.trim().split('\n').pop()).toBe('VERDICT: PROBE-INCOMPLETE');
  });

  it('(e-sub) RUNTIME_BRIDGE_AIF_PROJECT_ID unset → reason=no-project-id', () => {
    const out = probe({
      omitContainerInjection: true,
      projects: PROJECTS,
    });
    expect(out).toMatch(/status=unavailable reason=no-project-id/);
    expect(out.trim().split('\n').pop()).toBe('VERDICT: PROBE-INCOMPLETE');
  });

  it('(e-sub) empty project list → reason=project-not-found', () => {
    const out = probe({
      omitContainerInjection: true,
      runtimeProjectId: 'p-timeliner',
      projects: [],
    });
    expect(out).toMatch(/status=unavailable reason=project-not-found/);
    expect(out.trim().split('\n').pop()).toBe('VERDICT: PROBE-INCOMPLETE');
  });

  it('(e-sub) non-JSON projects payload → reason=projects-api-unreachable', () => {
    const out = probe({
      omitContainerInjection: true,
      runtimeProjectId: 'p-timeliner',
      projectsRaw: 'curl: (7) Failed to connect to localhost port 3009',
    });
    expect(out).toMatch(/status=unavailable reason=projects-api-unreachable/);
    expect(out.trim().split('\n').pop()).toBe('VERDICT: PROBE-INCOMPLETE');
  });
});
