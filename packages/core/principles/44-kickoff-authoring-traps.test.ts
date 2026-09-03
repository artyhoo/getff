/**
 * Principle 44 — kickoff-authoring traps that render as success
 *
 * Source: .claude/rules/kickoff-staging-placement.md §5 (`#canon-symlink-swallows-commit`,
 *         `#kickoff-name-near-miss`); README.md#why-this-exists invariant 4 (multi-channel
 *         enforcement — a rule fails at the earliest reachable channel);
 *         .claude/rules/attention-is-not-a-mechanism.md §1 (a load-bearing check is a
 *         deterministic gate, never "someone will notice").
 *
 * Both traps were measured live on 2026-09-02 while authoring the beta-docs-showcase BS0
 * stage kickoff. Neither produced any warning; both render as success.
 *
 * ── Arm A — `#canon-symlink-swallows-commit` ──────────────────────────────────
 * `.claude/orchestrator-prompts/**` is gitignored with per-umbrella `!` exceptions, and
 * scripts/link-coordination.sh symlinks every UNTRACKED file there into $CANON. Write a new
 * kickoff, let the helper run, `git add` in a LATER step → the index takes a mode-120000
 * blob (the 84-byte CANON path), not the content. Measured: commit 9e046c6d55 carried
 * `120000 blob 2d02772193b2b6c1ba2301edf3cc00a3e2902640` while the 232-line kickoff existed
 * only in $CANON. Nothing surfaced it — `git status` shows a normal path, `wc -l` reads
 * through the link, markdownlint passes, the spec validator passed. The damage is deferred:
 * the commit is worthless as a copy, so a later $CANON cleanup destroys the ONLY copy.
 *
 * Home channel is `.husky/pre-commit` (the earliest channel that can see the index; edit-time
 * cannot — the symlink appears ~2 min later). This arm is the durable backstop for commits
 * husky never gates: aif-container work, and anything that reaches CI another way.
 *
 * ── Arm B — `#kickoff-name-near-miss` ─────────────────────────────────────────
 * `kickoff-bs0.md` FAILS STAGE_KICKOFF_RE (`[a-z]` consumes `b`, then `\d` meets `s`), so it
 * was classified as a sidecar — the same bucket as `kickoff-amendments.md` — and principle
 * 12's citation gate never examined it, reporting green having checked nothing. Verified:
 * `npx vitest run packages/core/principles/12-ai-laziness-traps.test.ts` passed with the
 * malformed file present. The regex is not wrong; the defect is that a near-miss was
 * INDISTINGUISHABLE from a deliberate sidecar. This arm makes the third class loud.
 *
 * Home channel is `.claude/hooks/check-kickoff-traps.sh` arm 3 (edit-time — the only channel
 * that fires BEFORE dispatch, which can precede any push). This arm is the durable backstop
 * for kickoffs that arrive by a route no PostToolUse hook sees.
 *
 * No regex is re-implemented here: classification comes from ./kickoff-population.ts, the
 * SSOT (`#sync-by-copy-paste`, .claude/rules/dual-implementation-discipline.md §8).
 *
 * Zero paid LLM (no-paid-llm-in-ci.md): `git ls-files` + a readdir + pure predicates.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import {
  REPO_ROOT,
  KICKOFFS_DIR,
  KICKOFF_NAME_REMEDY,
  classifyKickoffName,
  getUnrecognisedKickoffNames,
} from './kickoff-population.ts';

const PROMPTS_PATHSPEC = '.claude/orchestrator-prompts';

/** `git ls-files -s` mode for a symlink blob. The one value arm A rejects. */
export const SYMLINK_MODE = '120000';

/**
 * Parse `git ls-files -s` output, returning the paths whose index mode is `120000`.
 * Line shape: `<mode> <sha> <stage>\t<path>` — the path is TAB-separated, so a path
 * containing spaces still parses.
 */
export function symlinkPathsInIndex(lsFilesOutput: string): string[] {
  const out: string[] = [];
  for (const line of lsFilesOutput.split('\n')) {
    if (!line) continue;
    const tab = line.indexOf('\t');
    if (tab === -1) continue;
    if (line.slice(0, SYMLINK_MODE.length) === SYMLINK_MODE) out.push(line.slice(tab + 1));
  }
  return out;
}

function gitLsFilesStaged(): string | null {
  try {
    return execFileSync('git', ['ls-files', '-s', '--', PROMPTS_PATHSPEC], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
  } catch {
    return null; // not a git checkout (packaged consumer copy) — nothing to assert
  }
}

const LS_FILES = gitLsFilesStaged();
const KICKOFFS_AVAILABLE = existsSync(KICKOFFS_DIR);

describe('Principle 44 — kickoff-authoring traps that render as success', () => {
  describe('Arm A — #canon-symlink-swallows-commit', () => {
    it.skipIf(LS_FILES === null)(
      'no git-tracked path under orchestrator-prompts is a symlink',
      () => {
        const violations = symlinkPathsInIndex(LS_FILES!);
        expect(
          violations,
          `Tracked SYMLINK(s) under ${PROMPTS_PATHSPEC} — the CANON path was committed instead of the content.\n` +
            `${violations.join('\n')}\n` +
            'Fix: re-write the real file into the worktree and re-add it in ONE step\n' +
            '  (cat the $CANON target back over the path, then `git add` immediately).\n' +
            'Never `git add` a new orchestrator-prompts file in a step LATER than the write —\n' +
            'scripts/link-coordination.sh adopts any UNTRACKED file there into $CANON first.',
        ).toEqual([]);
      },
    );

    // Paired negative: the detector must FIRE on a synthetic symlink entry. Without this a
    // future refactor could make symlinkPathsInIndex() always return [] and the arm above
    // would still be green — the exact false-green shape this principle exists to kill.
    it('anti-tautology: a mode-120000 index line IS flagged', () => {
      const real = `100644 abc123 0\t${PROMPTS_PATHSPEC}/u/kickoff.md`;
      const link = `120000 def456 0\t${PROMPTS_PATHSPEC}/u/kickoff-b0.md`;
      expect(symlinkPathsInIndex(`${real}\n${link}\n`)).toEqual([
        `${PROMPTS_PATHSPEC}/u/kickoff-b0.md`,
      ]);
      expect(symlinkPathsInIndex(`${real}\n`)).toEqual([]);
      expect(symlinkPathsInIndex('')).toEqual([]);
    });

    it('parses paths containing spaces (tab-separated, not field-split)', () => {
      expect(symlinkPathsInIndex(`120000 def456 0\t${PROMPTS_PATHSPEC}/u/a b.md\n`)).toEqual([
        `${PROMPTS_PATHSPEC}/u/a b.md`,
      ]);
    });
  });

  describe('Arm B — #kickoff-name-near-miss', () => {
    it.skipIf(!KICKOFFS_AVAILABLE)('every kickoff-* filename on disk resolves', () => {
      const violations = getUnrecognisedKickoffNames().map((v) => v.label);
      expect(
        violations,
        `Unrecognised kickoff-* filename(s) — neither the stage family nor a known sidecar:\n` +
          `${violations.join('\n')}\n` +
          `A name in this class is SILENTLY reclassified as a sidecar: the citation, rigor-label\n` +
          `and host-verify gates skip it and report green having examined nothing.\n` +
          `Fix: ${KICKOFF_NAME_REMEDY}`,
      ).toEqual([]);
    });

    // Paired negative: the measured 2026-09-02 name must classify as `unrecognised`.
    it('anti-tautology: the measured near-miss `kickoff-bs0.md` is unrecognised', () => {
      expect(classifyKickoffName('kickoff-bs0.md')).toBe('unrecognised');
      // …and its one-character-different, correctly-named twin is NOT.
      expect(classifyKickoffName('kickoff-b0.md')).toBe('stage');
    });

    it('positive: each recognised class resolves to its own label', () => {
      expect(classifyKickoffName('kickoff.md')).toBe('umbrella');
      expect(classifyKickoffName('kickoff-s2b.md')).toBe('stage');
      expect(classifyKickoffName('kickoff-r1.md')).toBe('stage');
      expect(classifyKickoffName('kickoff-amendments.md')).toBe('sidecar');
      expect(classifyKickoffName('kickoff-s4.decisions.md')).toBe('sidecar');
      expect(classifyKickoffName('kickoff.decisions.md')).toBe('sidecar');
      expect(classifyKickoffName('kickoff-stage-2-and-3.md')).toBe('grandfathered');
      // Non-kickoff residents of the umbrella dir carry no naming obligation.
      expect(classifyKickoffName('done.md')).toBe('other');
      expect(classifyKickoffName('report.md')).toBe('other');
      expect(classifyKickoffName('l1-dispatch.md')).toBe('other');
    });

    it('the remedy text names BOTH alternatives (an error must be actionable)', () => {
      expect(KICKOFF_NAME_REMEDY).toMatch(/stage form/);
      expect(KICKOFF_NAME_REMEDY).toMatch(/sidecar form/);
    });
  });
});
