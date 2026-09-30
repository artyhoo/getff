/**
 * dispatcher probe-inflight.sh --late tests
 *
 * The pre-dispatch probe answers «is anyone on this umbrella?» at the START of work. It is a
 * point reading, and every recorded duplicate after it was codified happened inside a window it
 * cannot see: a parallel session created and merged the same stage while this one was still
 * building, and the collision surfaced only at `gh pr create` (PR 612 vs 613, 2026-06-17), at
 * harvest (PR 1354 an empty-diff twin of 1353, 2026-08-10), or never, until a reviewer caught it
 * (PR 1368 vs 1371). The 1353/1354 pair also used DIFFERENT branch names for one stage
 * (`…-s1b` vs `…-s1b-300432`, the aif task-id suffix), so no `--head <branch>` probe could have
 * matched it either.
 *
 * `--late` is the reading taken immediately before the outward act. Its load-bearing arms:
 *   (a) the 1353/1354 shape — a merged PR on the derived slug, under another branch name,
 *       is a LATE-COLLISION;
 *   (b) the session's own PR is never its own collision (branch AND number exclusion);
 *   (c) a failed question stays PROBE-INCOMPLETE, never LATE-CLEAR — but a collision that WAS
 *       found outranks the unasked rest;
 *   (d) weak evidence (shared files, shared title words) is LATE-OVERLAP, never COLLISION:
 *       the hook injects it, it does not block on it.
 *
 * Every collector is driven from PROBE_LATE_* fixtures — no gh, no git, no network.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../../..');
const PROBE = resolve(REPO_ROOT, '.claude/skills/dispatcher/helpers/probe-inflight.sh');

/** Fixed clock: 2026-10-01T12:00:00Z. */
const NOW = Math.floor(Date.parse('2026-10-01T12:00:00.000Z') / 1000);
const hoursAgo = (h: number): string => new Date((NOW - h * 3600) * 1000).toISOString().replace(/\.\d+Z$/, 'Z');

interface Late {
  slug?: string;
  selfBranch?: string;
  selfPr?: string;
  openPrs?: unknown[];
  openPrsRaw?: string;
  mergedPrs?: unknown[];
  stagingLog?: string;
  changedFiles?: string;
  terms?: string;
  chip?: boolean;
}

function late(f: Late): string {
  const env: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k === 'SLUG' || k.startsWith('PROBE_')) continue;
    env[k] = v;
  }
  Object.assign(env, {
    PROBE_NOW_EPOCH: String(NOW),
    PROBE_SELF_BRANCH: f.selfBranch ?? 'claude/some-worktree-abc123',
    PROBE_LATE_OPEN_PRS: f.openPrsRaw ?? JSON.stringify(f.openPrs ?? []),
    PROBE_LATE_MERGED_PRS: JSON.stringify(f.mergedPrs ?? []),
    PROBE_LATE_STAGING_LOG: f.stagingLog ?? '',
    PROBE_LATE_CHANGED_FILES: f.changedFiles ?? '',
  });
  if (f.slug !== undefined) env.SLUG = f.slug;
  if (f.selfPr !== undefined) env.PROBE_SELF_PR = f.selfPr;
  if (f.terms !== undefined) env.PROBE_LATE_TERMS = f.terms;
  const args = [PROBE, '--late', ...(f.chip ? ['--chip'] : [])];
  return execFileSync('bash', args, { encoding: 'utf8', env });
}

const verdict = (out: string): string => (out.trim().split('\n').pop() ?? '').replace('VERDICT: ', '');

describe('probe-inflight.sh --late — the 1353/1354 incident shape', () => {
  const merged1353 = {
    number: 1353,
    state: 'MERGED',
    title: 'feat(getff-freshness-widening): S1b — the python lane provenance producer',
    headRefName: 'feature/getff-freshness-widening-s1b',
    mergedAt: hoursAgo(1),
  };

  it('derives the slug from an aif branch name, stripping the task-id suffix', () => {
    const out = late({ selfBranch: 'feature/getff-freshness-widening-s1b-300432' });
    expect(out).toContain('SIGNAL late-slug getff-freshness-widening-s1b source=branch');
  });

  it('a merged PR on the same slug under ANOTHER branch name → LATE-COLLISION', () => {
    const out = late({ selfBranch: 'feature/getff-freshness-widening-s1b-300432', mergedPrs: [merged1353] });
    expect(out).toMatch(/SIGNAL late-pr 1 open=0 merged=1 status=ok/);
    expect(out).toContain('  late-pr: #1353 MERGED feature/getff-freshness-widening-s1b');
    expect(verdict(out)).toBe('LATE-COLLISION');
  });

  it('a merged PR older than the window is history, not a collision', () => {
    const out = late({
      selfBranch: 'feature/getff-freshness-widening-s1b-300432',
      mergedPrs: [{ ...merged1353, mergedAt: hoursAgo(100) }],
    });
    expect(out).toMatch(/SIGNAL late-pr 0 /);
    expect(verdict(out)).toBe('LATE-CLEAR');
  });

  it('an explicit SLUG wins over the branch-derived one', () => {
    const out = late({ slug: 'pipeline-completion-scan-skip-closed', selfBranch: 'claude/great-sanderson-021210',
      openPrs: [{ number: 613, state: 'OPEN', title: 'perf(pipeline): skip closed umbrellas (pipeline-completion-scan-skip-closed)',
        headRefName: 'claude/hopeful-joliot-ae3957', files: [] }] });
    expect(out).toContain('SIGNAL late-slug pipeline-completion-scan-skip-closed source=env');
    expect(out).toContain('  late-pr: #613 OPEN claude/hopeful-joliot-ae3957');
    expect(verdict(out)).toBe('LATE-COLLISION');
  });
});

describe('probe-inflight.sh --late — the session never collides with itself', () => {
  it('an open PR whose head IS this branch is excluded', () => {
    const out = late({ selfBranch: 'feature/lane-config-insertion-s2',
      openPrs: [{ number: 9, state: 'OPEN', title: 'lane-config-insertion-s2', headRefName: 'feature/lane-config-insertion-s2', files: [] }] });
    expect(verdict(out)).toBe('LATE-CLEAR');
  });

  it('PROBE_SELF_PR excludes the PR being merged even from another checkout', () => {
    const out = late({ slug: 'lane-config-insertion-s2', selfPr: '9',
      openPrs: [{ number: 9, state: 'OPEN', title: 'lane-config-insertion-s2', headRefName: 'feature/x', files: [{ path: 'a.md' }] }],
      changedFiles: 'a.md' });
    expect(verdict(out)).toBe('LATE-CLEAR');
  });
});

describe('probe-inflight.sh --late — work that already landed on staging', () => {
  it('a staging commit this branch lacks, naming the slug → LATE-COLLISION', () => {
    const out = late({ slug: 'required-contexts',
      stagingLog: 'aaa1111 fix(required-contexts): declare required status contexts at the job (#1368)\nbbb2222 chore: unrelated' });
    expect(out).toMatch(/SIGNAL late-staging 1 status=ok/);
    expect(out).toContain('  late-staging: aaa1111 fix(required-contexts)');
    expect(out).not.toContain('bbb2222');
    expect(verdict(out)).toBe('LATE-COLLISION');
  });

  it('no derivable slug → the slug signals say so instead of pretending to have looked', () => {
    const out = late({ selfBranch: 'main' });
    expect(out).toContain('SIGNAL late-slug none source=branch');
    expect(out).toMatch(/SIGNAL late-staging 0 status=skipped reason=no-slug/);
  });
});

describe('probe-inflight.sh --late — weak evidence is OVERLAP, never COLLISION', () => {
  it('an open PR sharing changed files → LATE-OVERLAP naming the shared files', () => {
    const out = late({
      changedFiles: 'CLAUDE.md\n.claude/hooks/new.sh',
      openPrs: [
        { number: 1985, state: 'OPEN', title: 'feat(getff): land the one-button chain', headRefName: 'join/one-button-union',
          files: [{ path: 'CLAUDE.md' }, { path: 'README.md' }] },
        { number: 1990, state: 'OPEN', title: 'docs: other', headRefName: 'docs/other', files: [{ path: 'docs/x.md' }] },
      ],
    });
    expect(out).toMatch(/SIGNAL late-file-overlap 1 status=ok/);
    expect(out).toContain('  late-file-overlap: #1985 join/one-button-union files=CLAUDE.md');
    expect(verdict(out)).toBe('LATE-OVERLAP');
  });

  it('chip mode: the 2026-09-29 duplicate chip matches PR 1879 by title words', () => {
    const out = late({
      chip: true,
      terms: 'Stop per-prompt hooks firing twice with plugin + project',
      openPrs: [
        { number: 1879, state: 'OPEN', title: "fix(plugin): a plugin hook yields to the project's own copy of the same hook",
          headRefName: 'fix/plugin-hook-yield-to-project', files: [] },
        { number: 1880, state: 'OPEN', title: 'docs(site): glossary entry for drift', headRefName: 'docs/g', files: [] },
      ],
    });
    expect(out).toMatch(/SIGNAL late-term-pr 1 status=ok/);
    expect(out).toMatch(/ {2}late-term-pr: #1879 OPEN hits=3 /);
    expect(out).toMatch(/SIGNAL late-staging 0 status=skipped reason=chip/);
    expect(out).toMatch(/SIGNAL late-file-overlap 0 status=skipped reason=chip/);
    expect(verdict(out)).toBe('LATE-OVERLAP');
  });

  it('chip mode ignores the current branch — a chip is not about this checkout', () => {
    const out = late({ chip: true, terms: 'unrelated words entirely', selfBranch: 'feature/getff-freshness-widening-s1b-300432',
      mergedPrs: [{ number: 1353, state: 'MERGED', title: 't', headRefName: 'feature/getff-freshness-widening-s1b', mergedAt: hoursAgo(1) }] });
    expect(out).toContain('SIGNAL late-slug none source=chip');
    expect(verdict(out)).toBe('LATE-CLEAR');
  });
});

describe('probe-inflight.sh --late — fail-closed', () => {
  it('an unreadable PR list → PROBE-INCOMPLETE, never LATE-CLEAR', () => {
    const out = late({ slug: 'some-umbrella', openPrsRaw: 'gh: could not resolve to a Repository' });
    expect(out).toMatch(/SIGNAL late-pr 0 open=0 merged=0 status=unavailable/);
    expect(verdict(out)).toBe('PROBE-INCOMPLETE');
  });

  it('a collision that WAS found outranks the unasked rest', () => {
    const out = late({ slug: 'some-umbrella', openPrsRaw: 'gh: error', stagingLog: 'ccc3333 feat(some-umbrella): done' });
    expect(verdict(out)).toBe('LATE-COLLISION');
  });

  it('nothing anywhere → LATE-CLEAR', () => expect(verdict(late({ slug: 'fresh-umbrella' }))).toBe('LATE-CLEAR'));
});
