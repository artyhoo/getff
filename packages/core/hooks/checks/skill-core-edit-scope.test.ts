/**
 * Adapter-jig arm G3 `zero-skill-core-edits` (spec §3.7) — suite for the
 * per-PR-diff scope guard in skill-core-edit-scope.ts.
 *
 * Fixture strategy (J2 decisions log #9): stub changed-file lists, never
 * on-disk existence — 2 of the 3 protected surfaces are absent from this repo
 * BY DESIGN (rule-tests-surface S1 future artifacts), so the arm RED-proves
 * on string-literal paths regardless of on-disk state; the reproducible
 * in-repo anchor is packages/core/ir/types.ts (exists, verified below).
 * Deliberately NOT asserted: the absence of the two future paths — pinning
 * absence would false-RED the very S1 PR that legitimately creates them
 * (that PR is not a wiring PR; G3 is a per-WIRING-diff arm).
 */
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PROTECTED_SURFACES,
  checkDiffScope,
  checkDiffScopeForSha,
} from './skill-core-edit-scope.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../../..');

/** A representative adapter-wiring PR diff: detector + adapter + delivery +
 *  tests (the recon group-G positive fixture, verbatim). */
const WIRING_PR_CHANGED = [
  'packages/core/detector/types.ts',
  'packages/core/research/ecosystem-python.ts',
  'setup.d/45-python.sh',
  'packages/core/synthesizer/resolve-ctx.test.ts',
];

describe('G3 — zero skill/agent/IR edits in a wiring diff (adapter-jig §3.7)', () => {
  it('grounding: the frozen protected set matches spec §3.7 verbatim, and the in-repo RED anchor exists', () => {
    expect(PROTECTED_SURFACES).toEqual([
      '.claude/skills/rule-tests/',
      'agents/rule-test-author.md',
      'packages/core/ir/types.ts',
    ]);
    // The one protected surface that exists in this repo — the anchor every
    // reproducible in-repo RED-proof rides on (recon group G, MAJOR finding).
    expect(existsSync(resolve(REPO_ROOT, 'packages/core/ir/types.ts'))).toBe(true);
  });

  // @arm:G3:pos zero-skill-core-edits (GREEN path: a normal wiring PR touching
  // detector + adapter + delivery + tests has an EMPTY intersection with the
  // protected set)
  it('a normal wiring-PR changed-file list produces zero violations', () => {
    expect(checkDiffScope(WIRING_PR_CHANGED)).toEqual([]);
  });

  // @arm:G3:neg zero-skill-core-edits (RED-proof on the in-repo anchor: a diff
  // touching packages/core/ir/types.ts is flagged. Observed live via the
  // inverted assertion — `expect(violations).toEqual([])` against this stub
  // FAILED with the ir/types.ts hit — before landing in this direct form.)
  it('a wiring diff touching packages/core/ir/types.ts is RED', () => {
    const violations = checkDiffScope([...WIRING_PR_CHANGED, 'packages/core/ir/types.ts']);
    expect(violations).toEqual([
      { changed: 'packages/core/ir/types.ts', surface: 'packages/core/ir/types.ts' },
    ]);
  });

  // @arm:G3:neg zero-skill-core-edits (absent-path tolerance, decisions log #9:
  // BOTH consumer-project surfaces that do NOT exist in this repo still RED as
  // string-literal paths — creating them in a wiring PR is an intersection too;
  // an existence-based guard would be vacuously green here, which is exactly
  // the T15/T2 failure this realization avoids)
  it('the two absent-by-design protected surfaces still RED on prefix/exact membership', () => {
    // Prefix hit: a file CREATED under the protected skill dir (any depth).
    expect(checkDiffScope(['.claude/skills/rule-tests/SKILL.md'])).toEqual([
      { changed: '.claude/skills/rule-tests/SKILL.md', surface: '.claude/skills/rule-tests/' },
    ]);
    expect(checkDiffScope(['.claude/skills/rule-tests/references/deep/file.md'])).toEqual([
      {
        changed: '.claude/skills/rule-tests/references/deep/file.md',
        surface: '.claude/skills/rule-tests/',
      },
    ]);
    // Exact hit: the protected agent file itself.
    expect(checkDiffScope(['agents/rule-test-author.md'])).toEqual([
      { changed: 'agents/rule-test-author.md', surface: 'agents/rule-test-author.md' },
    ]);
  });

  // @arm:G3:pos zero-skill-core-edits (anti-tautology: near-miss paths that
  // must NOT be flagged — exact entries never prefix-match longer names, and
  // unprotected siblings stay editable)
  it('anti-tautology: near-miss siblings of protected surfaces are NOT flagged', () => {
    expect(
      checkDiffScope([
        'agents/rule-researcher.md', // sibling agent — not protected
        'agents/rule-test-author.md.orig', // exact entry must not prefix-match
        'packages/core/ir/gates/grammar.ts', // ir/ sibling — only types.ts is in the frozen set
        '.claude/skills/rule-research/SKILL.md', // sibling skill dir — not rule-tests/
      ]),
    ).toEqual([]);
  });

  it('a multi-hit diff reports every intersection (one violation per protected surface touched)', () => {
    const violations = checkDiffScope([
      'packages/core/ir/types.ts',
      'agents/rule-test-author.md',
      'packages/core/detector/types.ts',
    ]);
    expect(violations.map((v) => v.surface).sort()).toEqual([
      'agents/rule-test-author.md',
      'packages/core/ir/types.ts',
    ]);
  });

  // The GitProvider seam — the real per-PR-diff invocation shape, stubbed
  // exactly like checks/prior-art.test.ts stubs its provider. Deletions and
  // renames count: any status touching a protected path is an edit to it.
  describe('checkDiffScopeForSha adapter over GitProvider.changedFiles', () => {
    it('maps {status,path} entries and flags a protected hit regardless of status', () => {
      const stubGit = {
        changedFiles: (sha: string) => {
          expect(sha).toBe('deadbeef');
          return [
            { status: 'M', path: 'packages/core/detector/types.ts' },
            { status: 'D', path: 'packages/core/ir/types.ts' }, // deletion still REDs
          ];
        },
      };
      expect(checkDiffScopeForSha(stubGit, 'deadbeef')).toEqual([
        { changed: 'packages/core/ir/types.ts', surface: 'packages/core/ir/types.ts' },
      ]);
    });

    it('a clean wiring commit through the adapter produces zero violations', () => {
      const stubGit = {
        changedFiles: () => WIRING_PR_CHANGED.map((path) => ({ status: 'M', path })),
      };
      expect(checkDiffScopeForSha(stubGit, 'cafebabe')).toEqual([]);
    });
  });
});
