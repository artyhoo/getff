/**
 * pr-body-prior-art.test.ts — paired positive/negative tests for the PR-body
 * arm of the §7 Prior-art check (checkPrBodyPriorArt + the rangeGit view).
 *
 * Origin: 2026-07-22 squash-trailer-loss incident (PR #1094 → #1097): the
 * squash merge took the PR body as the commit message, branch-commit
 * `Prior-art:` trailers were dropped, and principle 11 F1 went red on the next
 * unrelated PR. The gate under test requires the trailer in the PR BODY, which
 * is exactly what survives the squash.
 *
 * All git I/O is injected via a fake GitProvider — no subprocess shelling.
 */
import { describe, it, expect } from 'vitest';
import type { GitProvider } from '../utils/git.ts';
import { stripHtmlComments } from '../utils/markdown-comments.ts';
import { checkPrBodyPriorArt } from './prior-art.ts';

/** ≥80-line file body to trip the packages/ capability threshold. */
const BIG_FILE =
  Array.from({ length: 90 }, (_, i) => `line ${i}`).join('\n') + '\n';

const NEW_DEP_DIFF = [
  'diff --git a/package.json b/package.json',
  '@@ -1,3 +1,4 @@',
  '   "dependencies": {',
  '+    "left-pad": "^1.3.0",',
  '     "semver": "^7.0.0"',
].join('\n');

function fakeGit(overrides: Partial<GitProvider> = {}): GitProvider {
  return {
    packageJsonDiff: () => '',
    changedFiles: () => [],
    fileContent: () => null,
    subdirExistedAtParent: () => false,
    commitBody: () => '',
    authorDate: () => '',
    commitSubject: () => '',
    diffForPaths: () => '',
    blobTrackedAtBase: () => false,
    ...overrides,
  };
}

/** A range view that IS a capability change: new ≥80 LOC file under packages/. */
function capabilityGit(): GitProvider {
  return fakeGit({
    changedFiles: () => [{ status: 'A', path: 'packages/core/foo/big.ts' }],
    fileContent: (_sha, path) =>
      path === 'packages/core/foo/big.ts' ? BIG_FILE : null,
  });
}

const VALID_TRAILER =
  'Prior-art: prior-art-evaluations.md#1 (Autogrep, verdict DEFER — different domain).';

describe('checkPrBodyPriorArt — PR-body §7 arm (squash-trailer-loss gate)', () => {
  it('non-capability PR: passes with no Prior-art line required', () => {
    const res = checkPrBodyPriorArt('Just a docs PR body.', fakeGit(), stripHtmlComments);
    expect(res.ok).toBe(true);
    expect(res.reason).toBeNull();
  });

  it('NEGATIVE — capability PR (new ≥80 LOC packages/ file), body without trailer: FAILS', () => {
    const res = checkPrBodyPriorArt(
      '## What this is\n\nBig PR body with §1.7 sections but no trailer.',
      capabilityGit(),
      stripHtmlComments,
    );
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('new file ≥50 LOC under new packages/core/<dir>/');
    expect(res.message).toContain('no Prior-art: trailer');
  });

  it('POSITIVE — same capability PR, body WITH a valid trailer: passes', () => {
    const res = checkPrBodyPriorArt(
      `## What this is\n\nBody.\n\n${VALID_TRAILER}\n`,
      capabilityGit(),
      stripHtmlComments,
    );
    expect(res.ok).toBe(true);
    expect(res.reason).toBe('new file ≥50 LOC under new packages/core/<dir>/');
  });

  it('capability via new explicit dep in package.json is detected over the range diff', () => {
    const res = checkPrBodyPriorArt(
      'body without trailer',
      fakeGit({ packageJsonDiff: () => NEW_DEP_DIFF }),
      stripHtmlComments,
    );
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('new explicit dep in package.json');
  });

  it('NEGATIVE — escape hatch `Prior-art: skipped` on a capability PR: FAILS (substance arm)', () => {
    const res = checkPrBodyPriorArt(
      'Prior-art: skipped — refactor only, no new capability here at all',
      capabilityGit(),
      stripHtmlComments,
    );
    expect(res.ok).toBe(false);
    expect(res.message).toContain('skipped on capability commit');
  });

  it('NEGATIVE — trailer citing a non-existent SSOT entry with ids supplied: FAILS (C1 arm)', () => {
    const res = checkPrBodyPriorArt(
      'Prior-art: prior-art-evaluations.md#9999 (ghost entry, verdict BUILD).',
      capabilityGit(),
      stripHtmlComments,
      new Set([1, 2, 3]),
    );
    expect(res.ok).toBe(false);
    expect(res.message).toContain('#9999');
  });

  it('trailer citing an EXISTING SSOT entry with ids supplied: passes', () => {
    const res = checkPrBodyPriorArt(
      VALID_TRAILER,
      capabilityGit(),
      stripHtmlComments,
      new Set([1]),
    );
    expect(res.ok).toBe(true);
  });

  it('empty PR body on a capability PR: FAILS', () => {
    const res = checkPrBodyPriorArt('', capabilityGit(), stripHtmlComments);
    expect(res.ok).toBe(false);
  });

  it('historical cutoff never fires: authorDate is empty by construction', () => {
    // A body that would pass ONLY via the pre-cutoff bypass must still fail —
    // PR merges happen today, so the bypass is unreachable on this surface.
    const res = checkPrBodyPriorArt('no trailer', capabilityGit(), stripHtmlComments);
    expect(res.ok).toBe(false);
  });
});

// ── A4-4 (2026-09-05): the body must be read the way GitHub RENDERS it ───────
// A `Prior-art:` line inside an HTML comment is invisible on the PR page, so it
// cannot be the trailer a reviewer saw — and the squash commit it produces
// carries no visible trailer either, which is the exact loss this gate exists to
// prevent. The two sibling PR-body gates already strip comments
// (utils/markdown-comments.ts); this arm did not until the stripper became a
// required injected parameter.
describe('checkPrBodyPriorArt — commented-out trailers do not satisfy the gate', () => {
  it('NEGATIVE — the only Prior-art line lives inside a multi-line HTML comment: FAILS', () => {
    const body = `Summary\n\n<!--\n${VALID_TRAILER}\n-->\n`;
    const res = checkPrBodyPriorArt(body, capabilityGit(), stripHtmlComments);
    expect(res.ok).toBe(false);
    expect(res.message).toContain('no Prior-art: trailer');
  });

  it('NEGATIVE — an inline commented trailer: FAILS', () => {
    const res = checkPrBodyPriorArt(
      `Summary <!-- ${VALID_TRAILER} -->\n`,
      capabilityGit(),
      stripHtmlComments,
    );
    expect(res.ok).toBe(false);
  });

  it('POSITIVE — a VISIBLE trailer alongside a commented template example: passes', () => {
    const body = `Summary\n\n<!--\nPrior-art: prior-art-evaluations.md#N (verdict X — rationale)\n-->\n\n${VALID_TRAILER}\n`;
    const res = checkPrBodyPriorArt(body, capabilityGit(), stripHtmlComments);
    expect(res.ok).toBe(true);
  });

  it('a trailer quoted inside a fenced code block is not swallowed with it', () => {
    // The stripper is markdown-aware: a `<!--` inside a fence is literal text and
    // must not hide the real trailer below (incident 2026-09-02, PR #1575).
    const body = `Summary\n\n\`\`\`\n<!-- not a comment, just quoted markup\n\`\`\`\n\n${VALID_TRAILER}\n`;
    const res = checkPrBodyPriorArt(body, capabilityGit(), stripHtmlComments);
    expect(res.ok).toBe(true);
  });
});
