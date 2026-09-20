/**
 * docs-card.test.ts — Vitest tests for checks/docs-card.ts (getff-ai-site S0q).
 *
 * All git I/O is injected via a fake GitProvider — no subprocess shelling
 * (the prior-art.test.ts pattern). Paired-negative requirement (kickoff §2,
 * D-Q16):
 *   ❌ prose commit + missing trailer            → failure
 *   ❌ prose commit + short/placeholder escape   → failure
 *   ❌ prose commit + partial/malformed card     → failure
 *   ✅ prose commit + full card                  → passes
 *   ✅ prose commit + valid escape               → passes
 *   ✅ non-prose commit (.json under docs/site)  → check never fires
 *   ✅ merge commit touching prose               → skipped (authors no prose)
 */
import { describe, it, expect } from 'vitest';
import {
  DOCS_CARD_IDS,
  DOCS_CARD_SKIP_MIN,
  isDocsSiteProsePath,
  isMergeCommit,
  parseDocsCardTrailer,
  runDocsCardCheck,
} from './docs-card.ts';
import type { GitProvider } from '../utils/git.ts';

// ─── helpers ──────────────────────────────────────────────────────────────────

/** A full valid card: all 13 ids, one per value class where sensible. */
const FULL_CARD =
  'Docs-card: C1 PASS, C2 PASS, C3 PASS, C4 PASS, C5 PASS, C6 N/A, C7 PASS, ' +
  'C8 PASS, C9 PASS, C10 PASS, C11 N/A, C12 PASS, C13 PASS';

/** Same card minus one id (C7 dropped) — the «id that just misses» class. */
const PARTIAL_CARD = FULL_CARD.replace(' C7 PASS,', ',');

interface FakeCommit {
  files: { status: string; path: string }[];
  body: string;
  subject?: string;
}

function fakeGit(commits: Record<string, FakeCommit>): GitProvider {
  return {
    packageJsonDiff: () => '',
    changedFiles: (sha) => commits[sha]?.files ?? [],
    fileContent: () => null,
    subdirExistedAtParent: () => false,
    commitBody: (sha) => commits[sha]?.body ?? '',
    authorDate: () => '2099-01-01',
    commitSubject: (sha) =>
      commits[sha]?.subject ?? (commits[sha]?.body.split('\n')[0] || ''),
    diffForPaths: () => '',
    blobTrackedAtBase: () => false,
  } as GitProvider;
}

const PROSE_FILES = [{ status: 'M', path: 'docs/site/guide/install.md' }];
const JSON_FILES = [{ status: 'A', path: 'docs/site/reference/A.json' }];

// ─── isDocsSiteProsePath ──────────────────────────────────────────────────────

describe('isDocsSiteProsePath', () => {
  it('matches .md and .mdx under docs/site/', () => {
    expect(isDocsSiteProsePath('docs/site/terms.md')).toBe(true);
    expect(isDocsSiteProsePath('docs/site/guide/x.mdx')).toBe(true);
  });

  it('does NOT match generated JSON artifacts (S0a family JSONs)', () => {
    expect(isDocsSiteProsePath('docs/site/reference/A.json')).toBe(false);
  });

  it('does NOT match md outside docs/site/ or non-md inside it', () => {
    expect(isDocsSiteProsePath('docs/other/page.md')).toBe(false);
    expect(isDocsSiteProsePath('README.md')).toBe(false);
    expect(isDocsSiteProsePath('docs/site/assets/logo.png')).toBe(false);
  });
});

// ─── isMergeCommit ────────────────────────────────────────────────────────────

describe('isMergeCommit', () => {
  it('matches the Merge-prefix convention', () => {
    expect(isMergeCommit('Merge branch \'feature/x\'')).toBe(true);
    expect(isMergeCommit('merge pull request #1')).toBe(true);
  });

  it('does not match prose commits that merely mention merges', () => {
    expect(isMergeCommit('docs: merged-mode wording fix')).toBe(false);
  });
});

// ─── parseDocsCardTrailer ─────────────────────────────────────────────────────

describe('parseDocsCardTrailer', () => {
  it('absent when no Docs-card line exists', () => {
    expect(parseDocsCardTrailer('subject\n\nbody text\n').kind).toBe('absent');
  });

  it('parses a full valid card (all 13 ids, values in enum)', () => {
    const parsed = parseDocsCardTrailer(`feat: x\n\n${FULL_CARD}\n`);
    expect(parsed.kind).toBe('card');
    if (parsed.kind !== 'card') return;
    expect(parsed.missing).toEqual([]);
    expect(parsed.invalid).toEqual([]);
    expect(parsed.entries.get('C13')).toBe('PASS');
  });

  it('parses the skipped escape (em dash) and keeps the rationale', () => {
    const parsed = parseDocsCardTrailer(
      'feat: x\n\nDocs-card: skipped — chore commit, no page rewritten, layout only',
    );
    expect(parsed.kind).toBe('skipped');
    if (parsed.kind !== 'skipped') return;
    expect(parsed.reason).toContain('no page rewritten');
  });

  it('flags a partial card missing one id', () => {
    const parsed = parseDocsCardTrailer(`feat: x\n\n${PARTIAL_CARD}\n`);
    expect(parsed.kind).toBe('card');
    if (parsed.kind !== 'card') return;
    expect(parsed.missing).toEqual(['C7']);
  });

  it('flags an out-of-enum value (lowercase pass)', () => {
    const parsed = parseDocsCardTrailer(
      'Docs-card: C1 pass, C2 PASS, C3 PASS, C4 PASS, C5 PASS, C6 N/A, C7 PASS, C8 PASS, C9 PASS, C10 PASS, C11 N/A, C12 PASS, C13 PASS',
    );
    expect(parsed.kind).toBe('card');
    if (parsed.kind !== 'card') return;
    expect(parsed.invalid).toEqual(['C1 pass']);
  });

  it('flags unknown ids (C14) and garbage tokens', () => {
    const parsed = parseDocsCardTrailer(
      `${FULL_CARD}, C14 PASS, nonsense`,
    );
    expect(parsed.kind).toBe('card');
    if (parsed.kind !== 'card') return;
    expect(parsed.unknown).toEqual(['C14 PASS']);
    expect(parsed.invalid).toEqual(['nonsense']);
  });

  it('finds the trailer even when indented among other trailers', () => {
    const parsed = parseDocsCardTrailer(
      `feat: x\n\nPrior-art: prior-art-evaluations.md#281 (Vale, ADAPT).\nDocs-card: ${FULL_CARD.slice(10)}\n`,
    );
    expect(parsed.kind).toBe('card');
  });
});

// ─── runDocsCardCheck — the paired negatives ─────────────────────────────────

describe('runDocsCardCheck', () => {
  it('non-prose commits never owe a card', () => {
    const report = runDocsCardCheck(
      ['a1'],
      fakeGit({ a1: { files: JSON_FILES, body: 'chore: regen family JSON' } }),
    );
    expect(report.proseCommits).toBe(0);
    expect(report.failures).toEqual([]);
  });

  it('prose commit + full card → pass', () => {
    const report = runDocsCardCheck(
      ['b2'],
      fakeGit({
        b2: { files: PROSE_FILES, body: `docs: write install guide\n\n${FULL_CARD}\n` },
      }),
    );
    expect(report.proseCommits).toBe(1);
    expect(report.failures).toEqual([]);
  });

  it('prose commit + NO trailer → failure (the paired negative)', () => {
    const report = runDocsCardCheck(
      ['c3'],
      fakeGit({ c3: { files: PROSE_FILES, body: 'docs: write install guide' } }),
    );
    expect(report.failures).toHaveLength(1);
    expect(report.failures[0]?.reason).toBe('missing Docs-card trailer');
  });

  it('prose commit + valid skipped escape → pass', () => {
    const report = runDocsCardCheck(
      ['d4'],
      fakeGit({
        d4: {
          files: PROSE_FILES,
          body:
            'docs: move page, no prose rewritten\n\nDocs-card: skipped — pure relocation, content byte-identical, no card criteria apply',
        },
      }),
    );
    expect(report.failures).toEqual([]);
  });

  it('prose commit + short escape → failure', () => {
    const report = runDocsCardCheck(
      ['e5'],
      fakeGit({
        e5: { files: PROSE_FILES, body: 'Docs-card: skipped — later' },
      }),
    );
    expect(report.failures).toHaveLength(1);
    expect(report.failures[0]?.reason).toContain('placeholder');
  });

  it('prose commit + partial card → failure naming the missing id', () => {
    const report = runDocsCardCheck(
      ['f6'],
      fakeGit({ f6: { files: PROSE_FILES, body: PARTIAL_CARD } }),
    );
    expect(report.failures).toHaveLength(1);
    expect(report.failures[0]?.message).toContain('C7');
  });

  it('.mdx prose commit owes the card too (D-Q6 day-one coverage)', () => {
    const report = runDocsCardCheck(
      ['g7'],
      fakeGit({
        g7: { files: [{ status: 'A', path: 'docs/site/x.mdx' }], body: 'feat' },
      }),
    );
    expect(report.proseCommits).toBe(1);
    expect(report.failures).toHaveLength(1);
  });

  it('merge commit touching prose is skipped', () => {
    const report = runDocsCardCheck(
      ['h8'],
      fakeGit({
        h8: {
          files: PROSE_FILES,
          body: "Merge branch 'staging' into feature/x",
          subject: "Merge branch 'staging' into feature/x",
        },
      }),
    );
    expect(report.checked).toBe(0);
    expect(report.failures).toEqual([]);
  });

  it('a mixed range reports exactly the bad prose commit', () => {
    const report = runDocsCardCheck(
      ['i9', 'j10', 'k11'],
      fakeGit({
        i9: { files: [{ status: 'M', path: 'packages/core/hooks/pre-push.ts' }], body: 'fix: hook' },
        j10: { files: PROSE_FILES, body: `docs: guide\n\n${FULL_CARD}` },
        k11: { files: PROSE_FILES, body: 'docs: terms page without card' },
      }),
    );
    expect(report.checked).toBe(3);
    expect(report.proseCommits).toBe(2);
    expect(report.failures).toHaveLength(1);
    expect(report.failures[0]?.sha).toBe('k11');
  });

  it('constant sanity: exactly 13 card ids', () => {
    expect(DOCS_CARD_IDS).toHaveLength(13);
    expect(DOCS_CARD_IDS[0]).toBe('C1');
    expect(DOCS_CARD_IDS[12]).toBe('C13');
    expect(DOCS_CARD_SKIP_MIN).toBe(20);
  });
});
