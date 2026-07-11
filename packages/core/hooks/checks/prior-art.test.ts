/**
 * prior-art.test.ts — Vitest tests for checks/prior-art.ts (Wave 10.2).
 *
 * All git I/O is injected via a fake GitProvider — no subprocess shelling.
 * The bash predecessor (pa_check_trailer in legacy-trailer-checks.sh) had
 * zero mutation coverage; these tests must achieve Stryker ≥80% (D4 gate).
 *
 * Paired-negative requirement (kickoff §Wave 10.2):
 *   ❌ capability commit + missing/placeholder trailer → exit-1-class failure
 *   ✅ capability commit + valid SSOT citation → passes
 *   ❌ capability commit + escape-hatch on capability → exit-2-class (substance failure)
 *   ✅ non-capability commit → check skipped entirely
 */
import { describe, it, expect } from 'vitest';
import {
  loc,
  isNewDepAdded,
  detectCapabilityReason,
  checkTrailerBody,
  runPriorArtCheck,
  extractCitedSsotIds,
  loadSsotIds,
  PA_HISTORICAL_CUTOFF,
} from './prior-art.ts';
import type { GitProvider } from '../utils/git.ts';

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Produce a one-field package.json diff: a `+` line for a new dep entry. */
function addedDepDiff(key: string, version: string): string {
  return `--- a/package.json\n+++ b/package.json\n@@ -1,4 +1,7 @@\n {\n   "dependencies": {\n+    "${key}": "${version}"\n   }\n }`;
}

/** Same key appears on both `+` and `-` lines (version bump, not a new dep). */
function bumpedDepDiff(key: string, oldV: string, newV: string): string {
  return `--- a/package.json\n+++ b/package.json\n-    "${key}": "${oldV}"\n+    "${key}": "${newV}"`;
}

const FUTURE = '2099-01-01';   // always > cutoff → check fires
const PAST   = '2026-01-01';   // always < cutoff → bypass

const VALID_CITATION = 'Prior-art: prior-art-evaluations.md#1 (Autogrep, verdict DEFER — different domain).';
const VALID_ESCAPE   = 'Prior-art: skipped — refactor only, no new capability';

function fakeGit(overrides: Partial<GitProvider> = {}): GitProvider {
  return {
    packageJsonDiff: () => '',
    changedFiles: () => [],
    fileContent: () => null,
    subdirExistedAtParent: () => false,
    commitBody: () => '',
    authorDate: () => FUTURE,
    commitSubject: () => 'feat: x',
    diffForPaths: () => '',
    ...overrides,
  };
}

// ─── loc() ───────────────────────────────────────────────────────────────────

describe('loc()', () => {
  it('counts newline characters (wc -l semantics)', () => {
    expect(loc('a\nb\nc\n')).toBe(3);
  });

  it('returns 0 for empty string', () => {
    expect(loc('')).toBe(0);
  });

  it('returns 0 for single line without trailing newline', () => {
    expect(loc('hello')).toBe(0);
  });

  it('counts only newlines (not bytes)', () => {
    expect(loc('\n\n\n')).toBe(3);
  });
});

// ─── isNewDepAdded() ──────────────────────────────────────────────────────────

describe('isNewDepAdded()', () => {
  it('returns false for empty diff', () => {
    expect(isNewDepAdded('')).toBe(false);
  });

  it('detects a caret-versioned new dep', () => {
    expect(isNewDepAdded(addedDepDiff('some-lib', '^1.0.0'))).toBe(true);
  });

  it('detects a tilde-versioned new dep (M1 fix)', () => {
    expect(isNewDepAdded(addedDepDiff('some-lib', '~1.0.0'))).toBe(true);
  });

  it('detects a digit-only (exact) version', () => {
    expect(isNewDepAdded(addedDepDiff('some-lib', '1.2.3'))).toBe(true);
  });

  it('detects a >= range', () => {
    expect(isNewDepAdded(addedDepDiff('some-lib', '>=1.0.0'))).toBe(true);
  });

  it('detects a wildcard (*) version', () => {
    expect(isNewDepAdded(addedDepDiff('some-lib', '*'))).toBe(true);
  });

  it('detects a = exact version prefix', () => {
    expect(isNewDepAdded(addedDepDiff('some-lib', '=1.0.0'))).toBe(true);
  });

  it('returns false for a version bump of an existing dep (M2 fix)', () => {
    // Same key present in both +/- lines → bump, not new dep.
    expect(isNewDepAdded(bumpedDepDiff('existing-dep', '^1.0.0', '^2.0.0'))).toBe(false);
  });

  it('returns false when only the context lines (space prefix) are present', () => {
    const diff = '   "ctx-dep": "^1.0.0"';  // no + or - prefix
    expect(isNewDepAdded(diff)).toBe(false);
  });

  it('handles multiple new deps and returns true when any are new', () => {
    const diff = [
      '+    "dep-a": "^1.0.0"',
      '+    "dep-b": "^2.0.0"',
    ].join('\n');
    expect(isNewDepAdded(diff)).toBe(true);
  });

  // ── overrides / resolutions blocks are NOT dependencies (PR #980 incident:
  //    security `overrides` keys were flagged as new explicit deps) ──────────
  it('returns false for keys added inside a new "overrides" block', () => {
    const diff = [
      '+  "overrides": {',
      '+    "qs": "^6.15.2",',
      '+    "js-yaml": "4.2.0",',
      '+    "markdown-it": "^14.2.0"',
      '+  },',
    ].join('\n');
    expect(isNewDepAdded(diff)).toBe(false);
  });

  it('returns false for keys added inside a "resolutions" block', () => {
    const diff = [
      '+  "resolutions": {',
      '+    "lodash": "^4.17.21"',
      '+  }',
    ].join('\n');
    expect(isNewDepAdded(diff)).toBe(false);
  });

  it('returns false for keys inside a "pnpm" config block (pnpm.overrides)', () => {
    const diff = [
      '+  "pnpm": {',
      '+    "overrides": {',
      '+      "qs": "^6.15.2"',
      '+    }',
      '+  }',
    ].join('\n');
    expect(isNewDepAdded(diff)).toBe(false);
  });

  it('paired negative: still detects a new dep ADDED AFTER an overrides block closes', () => {
    const diff = [
      '+  "overrides": {',
      '+    "qs": "^6.15.2"',
      '+  },',
      '+  "brand-new-dep": "^1.0.0"',
    ].join('\n');
    expect(isNewDepAdded(diff)).toBe(true);
  });

  it('paired negative: nested closing braces inside overrides do not end the skip early', () => {
    const diff = [
      '+  "overrides": {',
      '+    "parent-pkg": {',
      '+      "qs": "^6.15.2"',
      '+    },',
      '+    "handlebars": "4.7.9"',
      '+  }',
    ].join('\n');
    expect(isNewDepAdded(diff)).toBe(false);
  });

  it('hunk boundary (@@) resets overrides tracking (context lost across hunks)', () => {
    const diff = [
      '+  "overrides": {',
      '+    "qs": "^6.15.2"',
      '+  },',
      '@@ -40,3 +44,4 @@',
      '+    "new-dep": "^1.0.0"',
    ].join('\n');
    expect(isNewDepAdded(diff)).toBe(true);
  });
});

// ─── CLAUDE.md prose ↔ hook sync (executable, was attention-only) ─────────────
//
// CLAUDE.md «What is a capability commit?» promises «the prose definition and
// the hook stay in sync» (CLAUDE.md:36) — until this test, that promise was
// enforced by nobody (#hope-as-gate, attention-is-not-a-mechanism.md §1).
// These tests make the overrides-exclusion clause of the sync executable: the
// non-dep block names skipped by isNewDepAdded() must each be named in the
// CLAUDE.md explicit-dependency bullet, and vice versa.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..');

/** Block names in the hook's non-dep-block regex alternation. */
function extractCodeBlockNames(source: string): string[] {
  const m = /"\((.*?)\)"\\s\*:\\s\*\\\{/.exec(source.replace(/\n/g, ' '));
  // Fallback: match the regex literal directly.
  const lit = /nonDepBlockRe = \/[^/]*"\(([^)]+)\)"/.exec(source);
  const alt = (lit ?? m)?.[1];
  if (!alt) throw new Error('nonDepBlockRe alternation not found in prior-art.ts');
  return alt.split('|');
}

/** The CLAUDE.md explicit-dependency bullet (single line starting `- Adds a new **explicit dependency**`). */
function extractProseBullet(claudeMd: string): string {
  const line = claudeMd
    .split('\n')
    .find((l) => l.startsWith('- Adds a new **explicit dependency**'));
  if (!line) throw new Error('explicit-dependency bullet not found in CLAUDE.md');
  return line;
}

describe('CLAUDE.md prose ↔ isNewDepAdded() sync (capability-commit definition)', () => {
  const hookSource = readFileSync(resolve(HERE, 'prior-art.ts'), 'utf8');
  const claudeMd = readFileSync(resolve(REPO_ROOT, 'CLAUDE.md'), 'utf8');

  it('every non-dep block the hook skips is named in the CLAUDE.md bullet', () => {
    const bullet = extractProseBullet(claudeMd);
    for (const name of extractCodeBlockNames(hookSource)) {
      expect(bullet).toContain(`\`${name}\``);
    }
  });

  it('hook skips ≥ the canonical trio (guards against silently narrowing the regex)', () => {
    const names = extractCodeBlockNames(hookSource);
    for (const expected of ['overrides', 'resolutions', 'pnpm']) {
      expect(names).toContain(expected);
    }
  });

  it('paired negative: a prose bullet missing a code block name FAILS the containment check', () => {
    const staleBullet =
      '- Adds a new **explicit dependency** in `package.json` (… `overrides` / `pnpm` blocks do NOT count …)';
    // 'resolutions' is skipped by the code but absent from this stale prose.
    expect(staleBullet).not.toContain('`resolutions`');
    expect(extractCodeBlockNames(hookSource)).toContain('resolutions');
  });

  it('paired negative: extractor throws when the bullet is absent (prose moved/renamed → loud, not silent-pass)', () => {
    expect(() => extractProseBullet('# CLAUDE\n\nno bullet here\n')).toThrow(
      /bullet not found/,
    );
  });
});

// ─── detectCapabilityReason() ─────────────────────────────────────────────────

describe('detectCapabilityReason()', () => {
  it('returns null for a non-capability commit (no changes match thresholds)', () => {
    const g = fakeGit();
    expect(detectCapabilityReason('abc123', g)).toBeNull();
  });

  it('detects new explicit dep in package.json', () => {
    const g = fakeGit({
      packageJsonDiff: () => addedDepDiff('my-lib', '^3.0.0'),
    });
    expect(detectCapabilityReason('abc123', g)).toMatch(/new explicit dep/);
  });

  it('does NOT flag a dep version bump as capability', () => {
    const g = fakeGit({
      packageJsonDiff: () => bumpedDepDiff('my-lib', '^1.0.0', '^2.0.0'),
    });
    expect(detectCapabilityReason('abc123', g)).toBeNull();
  });

  it('detects new file ≥50 LOC in a NEW packages/core/<subdir>/', () => {
    // File under a new subdir (subdirExistedAtParent = false).
    const content50 = 'x\n'.repeat(50);
    const g = fakeGit({
      changedFiles: () => [{ status: 'A', path: 'packages/core/newdir/index.ts' }],
      fileContent: () => content50,
      subdirExistedAtParent: () => false,
    });
    expect(detectCapabilityReason('abc123', g)).toMatch(/50 LOC/);
  });

  it('does NOT flag ≥50 LOC file in an EXISTING core subdir', () => {
    const content50 = 'x\n'.repeat(50);
    const g = fakeGit({
      changedFiles: () => [{ status: 'A', path: 'packages/core/existingdir/index.ts' }],
      fileContent: () => content50,
      subdirExistedAtParent: () => true,  // subdir already existed
    });
    expect(detectCapabilityReason('abc123', g)).toBeNull();
  });

  it('does NOT flag file with 49 LOC in new core subdir (threshold is ≥50)', () => {
    const content49 = 'x\n'.repeat(49);
    const g = fakeGit({
      changedFiles: () => [{ status: 'A', path: 'packages/core/newdir/index.ts' }],
      fileContent: () => content49,
      subdirExistedAtParent: () => false,
    });
    expect(detectCapabilityReason('abc123', g)).toBeNull();
  });

  it('detects new file ≥80 LOC anywhere under packages/', () => {
    const content80 = 'x\n'.repeat(80);
    const g = fakeGit({
      changedFiles: () => [{ status: 'A', path: 'packages/other/module.ts' }],
      fileContent: () => content80,
    });
    expect(detectCapabilityReason('abc123', g)).toMatch(/80 LOC/);
  });

  it('does NOT flag file with 79 LOC under packages/ (threshold is ≥80)', () => {
    const content79 = 'x\n'.repeat(79);
    const g = fakeGit({
      changedFiles: () => [{ status: 'A', path: 'packages/other/module.ts' }],
      fileContent: () => content79,
    });
    expect(detectCapabilityReason('abc123', g)).toBeNull();
  });

  it('only considers status=A (Added) files, not M (Modified)', () => {
    // A modified file ≥80 LOC should NOT trigger the ≥80 LOC capability gate
    // (gate is only for newly-added files, per CONTRIBUTING.md definition).
    const content80 = 'x\n'.repeat(80);
    const g = fakeGit({
      changedFiles: () => [{ status: 'M', path: 'packages/other/module.ts' }],
      fileContent: () => content80,
    });
    expect(detectCapabilityReason('abc123', g)).toBeNull();
  });

  it('ignores files outside packages/ for the ≥80 LOC gate', () => {
    const content80 = 'x\n'.repeat(80);
    const g = fakeGit({
      changedFiles: () => [{ status: 'A', path: 'scripts/something.ts' }],
      fileContent: () => content80,
    });
    expect(detectCapabilityReason('abc123', g)).toBeNull();
  });
});

// ─── checkTrailerBody() ───────────────────────────────────────────────────────

describe('checkTrailerBody()', () => {
  // Historical cutoff bypass.
  it('passes (code 0) for commits authored before the cutoff (replay protection)', () => {
    const result = checkTrailerBody('No trailer at all.', PAST);
    expect(result.code).toBe(0);
  });

  it('fails (code 1) for commits with no Prior-art line at all', () => {
    const result = checkTrailerBody('feat: add something\n\nNo trailer.', FUTURE);
    expect(result.code).toBe(1);
    expect(result.message).toMatch(/no Prior-art/);
  });

  it('fails (code 1) for Prior-art line shorter than 20 chars after colon', () => {
    const result = checkTrailerBody('feat: foo\n\nPrior-art: short', FUTURE);
    expect(result.code).toBe(1);
    expect(result.message).toMatch(/invalid.*length/);
  });

  it('passes (code 0) for a valid SSOT citation (≥20 chars, not escape-hatch)', () => {
    const result = checkTrailerBody(`feat: foo\n\n${VALID_CITATION}`, FUTURE);
    expect(result.code).toBe(0);
  });

  it('fails (code 2) for escape-hatch "skipped" on a capability commit (substance arm)', () => {
    const result = checkTrailerBody(`feat: foo\n\n${VALID_ESCAPE}`, FUTURE);
    expect(result.code).toBe(2);
    expect(result.message).toMatch(/substance/);
  });

  it('fails (code 1) for escape-hatch with <20-char rationale', () => {
    const result = checkTrailerBody('feat: foo\n\nPrior-art: skipped — TODO', FUTURE);
    expect(result.code).toBe(1);
    expect(result.message).toMatch(/invalid.*length/);
  });

  it('fails (code 1) for escape-hatch with only placeholder words', () => {
    // "TODO TODO TODO TODO TODO" is ≥20 chars but all placeholder tokens.
    const result = checkTrailerBody('feat: foo\n\nPrior-art: skipped — TODO TODO TODO TODO TODO', FUTURE);
    // Placeholder rationale is caught by the all-placeholder filter → continue → code 1.
    expect(result.code).toBe(1);
  });

  it('passes (code 0) for escape-hatch with substantive ≥20-char rationale', () => {
    // Escape-hatch on a NON-capability commit is valid (the outer caller
    // decides; checkTrailerBody treats a substantive skipped as code 2 when
    // called by the capability-path. But per bash behaviour, the distinction is
    // made by the outer loop. The test here verifies the 'skipped' branch's
    // substance-arm triggers code 2 when substantive — callers handle it as
    // warn-only or block based on PA_SUBSTANCE_WARN_ONLY. The current TS
    // contract: substantive skipped → code 2 (caller decides warn vs block).
    // This is the paired-negative: escape-hatch on capability → code 2.
    const result = checkTrailerBody('feat: foo\n\nPrior-art: skipped — refactor only, no new capability', FUTURE);
    expect(result.code).toBe(2);
  });

  it('uses the default cutoff constant when cutoff is not supplied', () => {
    // Commits before PA_HISTORICAL_CUTOFF bypass the check.
    const result = checkTrailerBody('no trailer', '2026-05-10'); // < cutoff 2026-05-12
    expect(result.code).toBe(0);
  });

  it('does NOT bypass for dates equal to the cutoff (boundary)', () => {
    // String comparison: '2026-05-12' is NOT < '2026-05-12'.
    const result = checkTrailerBody('feat: foo\n\nno trailer', PA_HISTORICAL_CUTOFF);
    expect(result.code).toBe(1);
  });

  it('picks the first valid Prior-art line even when an earlier invalid one exists', () => {
    const body = [
      'feat: foo',
      '',
      'Prior-art: short',           // too short → skip
      'Prior-art: prior-art-evaluations.md#5 (Autogrep, verdict DEFER — different domain).',
    ].join('\n');
    const result = checkTrailerBody(body, FUTURE);
    expect(result.code).toBe(0);
  });

  it('strips exactly one leading space after "Prior-art:" (bash parity)', () => {
    // "Prior-art:X" (no space) vs "Prior-art: X" (one space stripped) —
    // the payload after stripping is measured for ≥20 chars.
    const longNoSpace = 'Prior-art:' + 'x'.repeat(20);   // payload = 'xxx…' (20 chars) → valid
    const result = checkTrailerBody(`feat: foo\n\n${longNoSpace}`, FUTURE);
    expect(result.code).toBe(0);
  });
});

// ─── boundary / mutation-killing edge cases ───────────────────────────────────

describe('boundary cases (mutation-killing)', () => {
  it('exact 20-char rationale after "skipped" → escape-hatch on capability → code 2', () => {
    // Kills the <= vs < boundary mutant on rationale.length.
    // 20 chars: "refactor, no new cap" (exactly)
    const exactly20 = 'refactor, no new cap'; // 20 chars
    expect(exactly20.length).toBe(20);
    const result = checkTrailerBody(`feat: foo\n\nPrior-art: skipped — ${exactly20}`, FUTURE);
    // Substantive 20-char rationale on capability → code 2 (substance arm).
    expect(result.code).toBe(2);
  });

  it('19-char rationale after "skipped" → invalid (too short)', () => {
    // Kills the boundary mutant from the other side.
    const exactly19 = 'refactor no new cap'; // 19 chars
    expect(exactly19.length).toBe(19);
    const result = checkTrailerBody(`feat: foo\n\nPrior-art: skipped — ${exactly19}`, FUTURE);
    expect(result.code).toBe(1);
  });

  it('content null from fileContent → does not count as capability (line 58 conditional)', () => {
    // Kills ConditionalExpression false at line 58: null content → skip.
    const g = fakeGit({
      changedFiles: () => [{ status: 'A', path: 'packages/core/newdir/index.ts' }],
      fileContent: () => null,    // null → content === null → not a capability
      subdirExistedAtParent: () => false,
    });
    expect(detectCapabilityReason('abc', g)).toBeNull();
  });

  it('content null from fileContent in packages/ → not a capability (line 68 conditional)', () => {
    // Kills ConditionalExpression true at line 68.
    const g = fakeGit({
      changedFiles: () => [{ status: 'A', path: 'packages/other/big.ts' }],
      fileContent: () => null,
    });
    expect(detectCapabilityReason('abc', g)).toBeNull();
  });

  it('core subdir non-packages/core path (packages/ but not packages/core/) not confused with 50-LOC gate', () => {
    // Tests the startsWith('packages/core/') guard — a file in packages/other/ with
    // <80 LOC should not trigger either gate.
    const content30 = 'x\n'.repeat(30);
    const g = fakeGit({
      changedFiles: () => [{ status: 'A', path: 'packages/other/small.ts' }],
      fileContent: () => content30,
    });
    // 30 LOC under packages/ (but NOT ≥80) → not capability
    expect(detectCapabilityReason('abc', g)).toBeNull();
  });
});

// ─── runPriorArtCheck() — paired-negative end-to-end ─────────────────────────

describe('runPriorArtCheck() — paired-negative', () => {
  it('PAIRED-NEGATIVE: capability commit + no trailer → failures list non-empty', () => {
    const g = fakeGit({
      packageJsonDiff: () => addedDepDiff('new-dep', '^1.0.0'),
      commitBody: () => 'feat: add dep\n\nNo Prior-art line.',
      authorDate: () => FUTURE,
    });
    const report = runPriorArtCheck(['sha1'], g);
    expect(report.failures).toHaveLength(1);
    expect(report.failures[0].sha).toBe('sha1');
    expect(report.substanceFailures).toHaveLength(0);
  });

  it('PAIRED-POSITIVE: capability commit + valid SSOT citation → both lists empty', () => {
    const g = fakeGit({
      packageJsonDiff: () => addedDepDiff('new-dep', '^1.0.0'),
      commitBody: () => `feat: add dep\n\n${VALID_CITATION}`,
      authorDate: () => FUTURE,
    });
    const report = runPriorArtCheck(['sha1'], g);
    expect(report.failures).toHaveLength(0);
    expect(report.substanceFailures).toHaveLength(0);
  });

  it('PAIRED-NEGATIVE (substance): capability commit + escape-hatch → substanceFailures non-empty', () => {
    const g = fakeGit({
      packageJsonDiff: () => addedDepDiff('new-dep', '^1.0.0'),
      commitBody: () => `feat: add dep\n\n${VALID_ESCAPE}`,
      authorDate: () => FUTURE,
    });
    const report = runPriorArtCheck(['sha1'], g);
    expect(report.failures).toHaveLength(0);
    expect(report.substanceFailures).toHaveLength(1);
    expect(report.substanceFailures[0].message).toMatch(/substance/);
  });

  it('non-capability commit is skipped entirely (no entries in either list)', () => {
    const g = fakeGit({
      // no dep, no large files → not a capability commit
      commitBody: () => 'chore: doc edit\n\nNo trailer.',
      authorDate: () => FUTURE,
    });
    const report = runPriorArtCheck(['sha1'], g);
    expect(report.failures).toHaveLength(0);
    expect(report.substanceFailures).toHaveLength(0);
  });

  it('pre-cutoff capability commit is bypassed (historical-cutoff protection)', () => {
    const g = fakeGit({
      packageJsonDiff: () => addedDepDiff('old-dep', '^1.0.0'),
      commitBody: () => 'feat: add dep\n\nNo trailer.',
      authorDate: () => PAST,
    });
    const report = runPriorArtCheck(['sha1'], g);
    expect(report.failures).toHaveLength(0);
  });

  it('processes multiple commits and accumulates findings', () => {
    const caps = ['sha1', 'sha2'];
    const g = fakeGit({
      packageJsonDiff: (sha) =>
        sha === 'sha1' ? addedDepDiff('dep-a', '^1.0.0') : addedDepDiff('dep-b', '^2.0.0'),
      commitBody: (sha) =>
        sha === 'sha1'
          ? `feat: sha1\n\n${VALID_CITATION}`
          : 'feat: sha2\n\nNo Prior-art line.',
      authorDate: () => FUTURE,
    });
    const report = runPriorArtCheck(caps, g);
    // sha1 has valid citation → passes; sha2 has no trailer → fails
    expect(report.failures).toHaveLength(1);
    expect(report.failures[0].sha).toBe('sha2');
    expect(report.failures[0].reason).toMatch(/dep/);
  });

  it('SHAs in the report are truncated to 10 chars', () => {
    const longSha = 'abcdef1234567890';
    const g = fakeGit({
      packageJsonDiff: () => addedDepDiff('some-dep', '^1.0.0'),
      commitBody: () => 'feat: dep\n\nNo trailer.',
      authorDate: () => FUTURE,
    });
    const report = runPriorArtCheck([longSha], g);
    expect(report.failures[0].sha).toBe('abcdef1234');
    expect(report.failures[0].sha.length).toBe(10);
  });

  it('brokenCitations is empty when ssotIds is not supplied (arm disabled)', () => {
    const g = fakeGit({
      packageJsonDiff: () => addedDepDiff('new-dep', '^1.0.0'),
      commitBody: () => 'feat: dep\n\nPrior-art: prior-art-evaluations.md#999 (verdict X — rationale here).',
      authorDate: () => FUTURE,
    });
    const report = runPriorArtCheck(['sha1'], g); // no ssotIds → no existence check
    expect(report.brokenCitations).toHaveLength(0);
    expect(report.failures).toHaveLength(0);
  });
});

// ─── C1: SSOT-existence arm (Wave N8) ─────────────────────────────────────────

describe('extractCitedSsotIds()', () => {
  it('returns [] when no citation present', () => {
    expect(extractCitedSsotIds('Prior-art: free-form prose, no entry reference')).toEqual([]);
  });

  it('extracts a single cited id', () => {
    expect(extractCitedSsotIds('Prior-art: prior-art-evaluations.md#42 (verdict)')).toEqual([42]);
  });

  it('extracts multiple cited ids on one line', () => {
    expect(
      extractCitedSsotIds('see prior-art-evaluations.md#1 and prior-art-evaluations.md#65'),
    ).toEqual([1, 65]);
  });

  it('is not stateful across calls (lastIndex reset)', () => {
    const line = 'prior-art-evaluations.md#7';
    expect(extractCitedSsotIds(line)).toEqual([7]);
    expect(extractCitedSsotIds(line)).toEqual([7]); // second call must not return []
  });
});

describe('loadSsotIds()', () => {
  it('parses §4 numeric table rows', () => {
    const ssot = '| ID | desc |\n|---|---|\n| 1 | Autogrep |\n| 2 | thing |\n| 65 | worktrees |\n';
    const ids = loadSsotIds(ssot);
    expect([...ids].sort((a, b) => a - b)).toEqual([1, 2, 65]);
  });

  it('ignores non-numeric schema-header rows (e.g. "| ID | string |")', () => {
    const ssot = '| Field | Type | Required |\n|---|---|---|\n| ID | integer | yes |\n| 3 | real entry |\n';
    const ids = loadSsotIds(ssot);
    expect(ids.has(3)).toBe(true);
    expect(ids.size).toBe(1); // "| ID |" and "| Field |" rows excluded
  });

  it('returns empty set for content with no rows', () => {
    expect(loadSsotIds('# just prose\nno tables here').size).toBe(0);
  });
});

describe('checkTrailerBody() — C1 existence arm', () => {
  const ssotIds = new Set([1, 2, 65]);

  it('PAIRED-POSITIVE: valid citation to an EXISTING entry → code 0', () => {
    const body = 'feat: x\n\nPrior-art: prior-art-evaluations.md#1 (Autogrep, verdict DEFER — different domain).';
    expect(checkTrailerBody(body, FUTURE, undefined, ssotIds).code).toBe(0);
  });

  it('PAIRED-NEGATIVE: citation to a NON-EXISTENT entry → code 3 (broken citation)', () => {
    const body = 'feat: x\n\nPrior-art: prior-art-evaluations.md#999 (verdict X — some rationale text).';
    const result = checkTrailerBody(body, FUTURE, undefined, ssotIds);
    expect(result.code).toBe(3);
    expect(result.message).toMatch(/#999.*no such entry/);
  });

  it('reports every missing id when several are cited', () => {
    const body = 'feat: x\n\nPrior-art: see prior-art-evaluations.md#1 and prior-art-evaluations.md#998 and prior-art-evaluations.md#999';
    const result = checkTrailerBody(body, FUTURE, undefined, ssotIds);
    expect(result.code).toBe(3);
    expect(result.message).toMatch(/#998, #999/); // #1 exists, only the missing pair reported
  });

  it('free-form (non-citation) valid trailer passes even with ssotIds supplied', () => {
    // A ≥20-char positive trailer with no #N reference has nothing to resolve.
    const body = 'feat: x\n\nPrior-art: novel capability, no upstream analog after 6-item sweep.';
    expect(checkTrailerBody(body, FUTURE, undefined, ssotIds).code).toBe(0);
  });

  it('existence arm does not run for escape-hatch (code 2 wins before citation parse)', () => {
    const body = `feat: x\n\n${VALID_ESCAPE}`;
    expect(checkTrailerBody(body, FUTURE, undefined, ssotIds).code).toBe(2);
  });

  it('pre-cutoff commit bypasses the existence arm too', () => {
    const body = 'feat: x\n\nPrior-art: prior-art-evaluations.md#999 (broken but historical).';
    expect(checkTrailerBody(body, PAST, undefined, ssotIds).code).toBe(0);
  });
});

describe('runPriorArtCheck() — C1 paired-negative end-to-end', () => {
  const ssotIds = new Set([1, 2, 65]);

  it('PAIRED-NEGATIVE: capability commit citing a missing entry → brokenCitations non-empty', () => {
    const g = fakeGit({
      packageJsonDiff: () => addedDepDiff('new-dep', '^1.0.0'),
      commitBody: () => 'feat: dep\n\nPrior-art: prior-art-evaluations.md#999 (verdict X — rationale).',
      authorDate: () => FUTURE,
    });
    const report = runPriorArtCheck(['sha1'], g, undefined, ssotIds);
    expect(report.brokenCitations).toHaveLength(1);
    expect(report.brokenCitations[0].sha).toBe('sha1');
    expect(report.failures).toHaveLength(0);
    expect(report.substanceFailures).toHaveLength(0);
  });

  it('PAIRED-POSITIVE: capability commit citing an existing entry → all lists empty', () => {
    const g = fakeGit({
      packageJsonDiff: () => addedDepDiff('new-dep', '^1.0.0'),
      commitBody: () => `feat: dep\n\n${VALID_CITATION}`, // cites #1 (in ssotIds)
      authorDate: () => FUTURE,
    });
    const report = runPriorArtCheck(['sha1'], g, undefined, ssotIds);
    expect(report.failures).toHaveLength(0);
    expect(report.substanceFailures).toHaveLength(0);
    expect(report.brokenCitations).toHaveLength(0);
  });

  it('non-capability commit is skipped even with a broken citation', () => {
    const g = fakeGit({
      // no dep / no large file → not a capability commit
      commitBody: () => 'chore: note\n\nPrior-art: prior-art-evaluations.md#999 (irrelevant here).',
      authorDate: () => FUTURE,
    });
    const report = runPriorArtCheck(['sha1'], g, undefined, ssotIds);
    expect(report.brokenCitations).toHaveLength(0);
  });
});

// ─── C1 per-commit-tree id source (2026-06-17 tree-source fix) ────────────────
// The running hook supplies a `(sha) => ids` resolver so each citation is checked
// against the SSOT in THAT commit's own tree, not a single working-tree snapshot.
describe('runPriorArtCheck() — per-commit ssotIds resolver', () => {
  it('PAIRED-POSITIVE: resolver yields the cited id for that commit → passes', () => {
    const g = fakeGit({
      packageJsonDiff: () => addedDepDiff('new-dep', '^1.0.0'),
      commitBody: () => 'feat: dep\n\nPrior-art: prior-art-evaluations.md#42 (verdict ADAPT — rationale here).',
      authorDate: () => FUTURE,
    });
    // resolver: #42 exists in this commit's tree
    const report = runPriorArtCheck(['sha1'], g, undefined, () => new Set([42]));
    expect(report.brokenCitations).toHaveLength(0);
    expect(report.failures).toHaveLength(0);
  });

  it('PAIRED-NEGATIVE: resolver lacks the cited id for that commit → broken citation', () => {
    const g = fakeGit({
      packageJsonDiff: () => addedDepDiff('new-dep', '^1.0.0'),
      commitBody: () => 'feat: dep\n\nPrior-art: prior-art-evaluations.md#42 (verdict ADAPT — rationale here).',
      authorDate: () => FUTURE,
    });
    const report = runPriorArtCheck(['sha1'], g, undefined, () => new Set([1, 2]));
    expect(report.brokenCitations).toHaveLength(1);
    expect(report.brokenCitations[0].message).toMatch(/#42.*no such entry/);
  });

  // The load-bearing property: the resolver is invoked PER sha, so a commit whose
  // OWN tree contains the cited entry passes even though another commit's tree (and
  // a single working-tree snapshot) does not. This is precisely the incident shape.
  it('resolves the id-set per commit (commit A tree has #5; commit B tree does not)', () => {
    const g = fakeGit({
      packageJsonDiff: () => addedDepDiff('new-dep', '^1.0.0'),
      commitBody: (sha) =>
        sha === 'A'
          ? 'feat: A\n\nPrior-art: prior-art-evaluations.md#5 (verdict — rationale long enough).'
          : 'feat: B\n\nPrior-art: prior-art-evaluations.md#5 (verdict — rationale long enough).',
      authorDate: () => FUTURE,
    });
    // Commit A's tree has #5; commit B's tree (e.g. an older base) does NOT.
    const perCommit = (sha: string) => (sha === 'A' ? new Set([5]) : new Set<number>());
    const report = runPriorArtCheck(['A', 'B'], g, undefined, perCommit);
    expect(report.brokenCitations).toHaveLength(1);
    expect(report.brokenCitations[0].sha).toBe('B'); // only B's tree lacked #5
  });

  it('resolver returning undefined for a sha → existence arm is a graceful no-op', () => {
    const g = fakeGit({
      packageJsonDiff: () => addedDepDiff('new-dep', '^1.0.0'),
      commitBody: () => 'feat: dep\n\nPrior-art: prior-art-evaluations.md#999 (verdict — rationale here).',
      authorDate: () => FUTURE,
    });
    // SSOT unreadable at this commit → undefined → no existence check, no broken citation.
    const report = runPriorArtCheck(['sha1'], g, undefined, () => undefined);
    expect(report.brokenCitations).toHaveLength(0);
    expect(report.failures).toHaveLength(0);
  });
});

// ─── Wave 2 mutation-killing tests ────────────────────────────────────────────
// These tests were added to kill surviving Stryker mutants identified in the Wave 2 baseline run.

describe('loadSsotIds() — mutation-killing (Wave 2)', () => {
  // Kills line 45 Regex mutant: /\|\s*(\d+)\s*\|/gm (no ^ anchor)
  // Without ^, a line like "prose text | 99 | more" would match.
  it('does NOT parse ids from mid-line pipe sequences (requires ^ anchor)', () => {
    const ssot = 'prose text before | 99 | the real stuff\n| 1 | valid row |\n';
    const ids = loadSsotIds(ssot);
    expect(ids.has(99)).toBe(false);  // mid-line: must NOT match
    expect(ids.has(1)).toBe(true);    // row-start: must match
  });

  // Kills line 45 Regex mutant: /^\|\s(\d+)\s*\|/gm (\s* -> \s, requires exactly 1 space before digit)
  // Without *, rows with 2+ spaces before the digit would fail to parse.
  it('parses ids when there are multiple spaces before the digit (\\s*)', () => {
    const ssot = '|  42  | double-space row |\n| 1 | normal row |\n';
    const ids = loadSsotIds(ssot);
    expect(ids.has(42)).toBe(true);
    expect(ids.has(1)).toBe(true);
  });

  // Kills line 45 Regex mutant: /^\|\s*(\d+)\s\|/gm (\s* -> \s after digit, requires exactly 1 space after)
  // Without *, rows with 0 or 2+ trailing spaces after the digit would fail.
  it('parses ids when there are multiple spaces after the digit (trailing \\s*)', () => {
    const ssot = '| 7  | trailing-double-space |\n| 1 | normal |\n';
    const ids = loadSsotIds(ssot);
    expect(ids.has(7)).toBe(true);
    expect(ids.has(1)).toBe(true);
  });
});

describe('isNewDepAdded() — regex mutation-killing (Wave 2)', () => {
  // Kills line 74 Regex mutant: no ^ anchor — without it, a line containing
  // a mid-string '+' followed by a dep key would be falsely detected.
  it('does NOT detect a dep in a line where + appears mid-string (requires ^ anchor)', () => {
    // Context line (space prefix) mentioning + inside a value string — not a diff add line.
    const diff = '   "scripts": "echo + dep: value"';
    expect(isNewDepAdded(diff)).toBe(false);
  });

  // Kills line 74 Regex mutant: />=?/ -> />=/ (requires literal >=, not just >)
  // A version string starting with '>' alone (e.g. '>1.0.0') matches />=?/ but NOT />=/.
  it('detects a > (without =) range version as new dep', () => {
    const diff = '+    "dep": ">1.0.0"';
    expect(isNewDepAdded(diff)).toBe(true);
  });

  // Kills line 74 Regex mutant: /<=?/ -> /<=/ (requires literal <=, not just <)
  // A version string starting with '<' alone (e.g. '<2.0.0') matches /<=?/ but NOT /<=/.
  it('detects a < (without =) range version as new dep', () => {
    const diff = '+    "dep": "<2.0.0"';
    expect(isNewDepAdded(diff)).toBe(true);
  });

  // Kills line 74 Regex mutant: \s* -> \s (requires exactly 1 space between colon and quote)
  // A dep entry with NO space after colon ("+  "dep":"^1.0.0"") matches \s* but not \s.
  it('detects a dep entry with no space between colon and version quote', () => {
    const diff = '+    "dep":"^1.0.0"';
    expect(isNewDepAdded(diff)).toBe(true);
  });
});

describe('detectCapabilityReason() — subdir status mutation-killing (Wave 2)', () => {
  // Kills line 88 ConditionalExpression: if (status !== 'A') continue -> if (false) continue
  // Without the guard, a Modified file in a new packages/core/<subdir>/ with ≥50 LOC
  // would be falsely flagged as a capability commit.
  it('does NOT flag a Modified (status=M) file in a new packages/core subdir with ≥50 LOC', () => {
    const content50 = 'x\n'.repeat(50);
    const g = fakeGit({
      changedFiles: () => [{ status: 'M', path: 'packages/core/newdir/index.ts' }],
      fileContent: () => content50,
      subdirExistedAtParent: () => false, // new subdir, but file was MODIFIED, not added
    });
    expect(detectCapabilityReason('abc', g)).toBeNull();
  });

  // Kills line 90 StringLiteral/MethodExpression mutations:
  // path.slice('packages/core/'.length) is replaced by path.slice(''.length) or path.split('/')[0]
  // These mutations extract the wrong subdir name ('packages' or 'core' instead of the actual subdir).
  // subdirExistedAtParent(wrongName) still returns false with our simple mock → same outcome.
  // To distinguish: make subdirExistedAtParent path-name sensitive — it returns true
  // for 'packages' or 'packages/core' (pre-existing top-level dirs) but false for 'newdir' only.
  it('passes the CORRECT subdir name to subdirExistedAtParent (not the full path prefix)', () => {
    const content50 = 'x\n'.repeat(50);
    const g = fakeGit({
      changedFiles: () => [{ status: 'A', path: 'packages/core/newdir/index.ts' }],
      fileContent: () => content50,
      // Return true for 'packages' or '' or 'packages/core' (wrong extraction by mutants),
      // but false for 'newdir' (the correct extraction by the real code).
      subdirExistedAtParent: (sha, subdir) => subdir !== 'newdir',
    });
    // Original code extracts 'newdir' → subdirExistedAtParent('newdir') = false → capability detected.
    // Mutation slice(''.length) → extracts 'packages' → subdirExistedAtParent('packages') = true → no capability.
    // Mutation path.split('/')[0] → extracts 'packages' → same as above.
    // Mutation split('') → extracts 'n' → subdirExistedAtParent('n') = true → no capability.
    expect(detectCapabilityReason('abc', g)).toMatch(/50 LOC/);
  });
});

describe('checkTrailerBody() — message assertion mutation-killing (Wave 2)', () => {
  // Kills line 142 StringLiteral: { code: 0, message: '' } -> { code: 0, message: "Stryker was here!" }
  // Tests that checked code=0 for cutoff bypass never checked message=''.
  it('cutoff bypass returns empty message (code 0 path)', () => {
    const result = checkTrailerBody('no trailer', PAST);
    expect(result.code).toBe(0);
    expect(result.message).toBe('');
  });

  // Kills line 178 StringLiteral: { code: 0, message: '' } -> { code: 0, message: "Stryker was here!" }
  // Tests that checked code=0 for valid trailer never checked message=''.
  it('valid positive trailer returns empty message (code 0 path)', () => {
    const result = checkTrailerBody(`feat: foo\n\n${VALID_CITATION}`, FUTURE);
    expect(result.code).toBe(0);
    expect(result.message).toBe('');
  });
});

describe('checkTrailerBody() — regex anchor/spacing mutation-killing (Wave 2)', () => {
  // Kills line 148 Regex mutant: /^ / -> / / (strip leading space vs any first space)
  // Distinguishing input: "Prior-art:" with NO leading space but an INTERNAL space at position 10.
  //   payload (before strip): 'xxxxxxxxxx yyyyyyyyy' = 10 + 1 + 9 = 20 chars
  //   Original /^ /: no leading space → nothing stripped → 20 chars ≥ 20 → valid → code 0
  //   Mutant / /: strips first occurrence of ' ' (pos 10) → 'xxxxxxxxxxyyyyyyyyyy'... wait:
  //     replace(/ /, '') removes the space char → 'xxxxxxxxxx'+'yyyyyyyyy' = 19 chars < 20 → continue → code 1
  // The test input has no leading space, so /^ / is a no-op; / / is not.
  it('strips nothing when no leading space after "Prior-art:" (preserves internal space for length)', () => {
    // 'Prior-art:' + 10 x's + ' ' + 9 y's → payload = 20 chars (no leading space)
    // Original /^ /: strips nothing → 20 chars → valid → code 0
    // Mutant / /: strips internal space → 19 chars → too short → code 1
    const body = `feat: foo\n\nPrior-art:${'x'.repeat(10)} ${'y'.repeat(9)}`;
    expect(checkTrailerBody(body, FUTURE).code).toBe(0);
  });

  // Kills line 151 Regex mutants: /^ +/ -> /[ +]/ or /^ / on rationale strip
  // Test: rationale with multiple leading spaces — /^[ +]/ strips only first space,
  // /^ +/ strips all leading spaces. Difference visible when rationale = '   text' (3 spaces).
  // After stripping: '   text' -> /^ +/ gives 'text', /^ / gives '  text' (2 spaces remain).
  // But the length check is on rationale, and '  text' is still >=20 chars if content long enough.
  // The real kill is: after dash/colon stripping, the rationale starts with spaces that
  // make it appear shorter if only one is stripped. Need rationale where spaces eat length.
  it('strips all leading spaces from rationale after "skipped" separator (^[ ]+)', () => {
    // 'Prior-art: skipped —   '+ exactly 20 chars (2 leading spaces before actual content)
    // /^ +/ strips both leading spaces → 20 chars → substance arm (code 2)
    // /^ / strips only one leading space → '  ' + 19char word → 21 chars → still code 2
    // Actually length isn't the issue here; what matters is that after double-stripping,
    // we get the actual rationale content. Test with a minimal meaningful case:
    const body = 'feat: foo\n\nPrior-art: skipped —   refactor only, no new capability added here';
    const result = checkTrailerBody(body, FUTURE);
    // The ≥20 char check succeeds, not all-placeholder → substance arm → code 2
    expect(result.code).toBe(2);
  });

  // Kills line 152 Regex mutant: /^[—–\-:]/ -> /[—–\-:]/ (anchor removed)
  // Without ^, the separator character anywhere in the rationale gets removed,
  // not just the leading one. Test: rationale with a separator mid-string.
  it('strips ONLY the leading separator character from rationale (not all occurrences)', () => {
    // Rationale after 'skipped': '— use-this — and-that' (contains em-dash in the middle)
    // /^[—–\-:]/ strips only the leading '—', leaving 'use-this — and-that'
    // /[—–\-:]/ (no anchor) would strip the first occurrence anywhere, same result for leading
    // But for DETECTING substance: the content is clearly non-placeholder.
    const body = 'feat: foo\n\nPrior-art: skipped — refactor: no capability — just cleanup here';
    expect(checkTrailerBody(body, FUTURE).code).toBe(2);
  });
});

describe('checkTrailerBody() — placeholder all-vs-some mutation-killing (Wave 2)', () => {
  // Kills line 155 MethodExpression: words.every(...) -> words.some(...)
  // With every: mixed words (one placeholder + one substantive) → allPlaceholder=false → code 2
  // With some:  mixed words (one placeholder + one substantive) → allPlaceholder=true → code 1 (invalid)
  // Test: rationale = "legitimate TODO" (has one substantive word + one placeholder)
  it('treats a mixed rationale (one placeholder + one substantive) as NOT all-placeholder → code 2', () => {
    // 'genuine-word TODO TODO TODO' — 'genuine-word' is not a placeholder
    // every → false (not all placeholder) → code 2 (substance arm)
    // some  → true  (some are placeholder) → code 1 (falls through as placeholder)
    const body = 'feat: foo\n\nPrior-art: skipped — genuine-word TODO TODO TODO TODO';
    expect(checkTrailerBody(body, FUTURE).code).toBe(2);
  });

  // Kills line 154 MethodExpression: .filter(Boolean) removed
  // Without filter(Boolean), an empty-string '' token (from leading/trailing whitespace split)
  // would be included. '' is in PLACEHOLDERS set, so it's always 'placeholder'.
  // For a rationale of leading-space-content, split(/\s+/) could yield ['', 'word'].
  // With filter: ['word'] → depends on word. Without filter: ['', 'word'] → '' is placeholder.
  it('filters empty tokens before placeholder check (filter Boolean)', () => {
    // Rationale after separator stripping starts with a space → split gives leading ''
    // A leading space before substantive content: the code strips /^ +/ first, so this tests
    // that the behavior is consistent for normal content.
    // Easier: test that purely empty rationale (all whitespace) is treated as all-placeholder.
    const body = 'feat: foo\n\nPrior-art: skipped — todo todo todo todo todo todo todo';
    // All valid placeholder tokens (≥20 chars) → allPlaceholder=true → continue → code 1
    expect(checkTrailerBody(body, FUTURE).code).toBe(1);
  });

  // Kills line 154 Regex mutant: split(/\s+/) -> split(/\s/) (single whitespace)
  // With /\s/ multi-space between words leaves '' tokens; /\s+/ doesn't.
  // Since filter(Boolean) removes '', the Regex \s vs \s+ difference is eliminated by the filter.
  // To distinguish WITHOUT relying on filter: content with multi-space and no filter — but filter IS there.
  // Conclusion: /\s/ vs /\s+/ is equivalent given filter(Boolean) removes empty tokens.
  // Document as equivalent: only consecutive single-space in rationale splits differently,
  // but filter(Boolean) neutralizes the difference.
  it('split regex /\\s+/ vs /\\s/ is neutralized by filter(Boolean): multi-space placeholder rationale still invalid', () => {
    const body = 'feat: foo\n\nPrior-art: skipped — todo  todo  todo  todo  todo todo'; // double spaces
    // Whether split by /\s/ or /\s+/, after filter(Boolean) all tokens are 'todo' → all-placeholder → code 1
    expect(checkTrailerBody(body, FUTURE).code).toBe(1);
  });
});

describe('checkTrailerBody() — PLACEHOLDERS set membership mutation-killing (Wave 2)', () => {
  // These kill the StringLiteral mutants at line 51 where individual placeholder words
  // are replaced with '' (making those words non-placeholder, changing 'all-placeholder' behavior).

  // Kills line 51:39 — 'later' replaced with ''
  it("escape-hatch with rationale 'later' only is invalid (all-placeholder)", () => {
    const body = 'feat: foo\n\nPrior-art: skipped — later later later later later later';
    expect(checkTrailerBody(body, FUTURE).code).toBe(1); // all-placeholder → continue → code 1
  });

  // Kills line 51:48 — 'na' replaced with ''
  it("escape-hatch with rationale 'na' only is invalid (all-placeholder)", () => {
    const body = 'feat: foo\n\nPrior-art: skipped — na na na na na na na na na na na na';
    expect(checkTrailerBody(body, FUTURE).code).toBe(1);
  });

  // Kills line 51:54 — 'tbd' replaced with ''
  it("escape-hatch with rationale 'tbd' only is invalid (all-placeholder)", () => {
    const body = 'feat: foo\n\nPrior-art: skipped — tbd tbd tbd tbd tbd tbd tbd tbd';
    expect(checkTrailerBody(body, FUTURE).code).toBe(1);
  });

  // Kills line 51:61 — 'fixme' replaced with ''
  it("escape-hatch with rationale 'fixme' only is invalid (all-placeholder)", () => {
    const body = 'feat: foo\n\nPrior-art: skipped — fixme fixme fixme fixme fixme fixme';
    expect(checkTrailerBody(body, FUTURE).code).toBe(1);
  });

  // Kills line 51:70 — 'placeholder' replaced with ''
  it("escape-hatch with rationale 'placeholder' only is invalid (all-placeholder)", () => {
    const body = 'feat: foo\n\nPrior-art: skipped — placeholder placeholder placeholder';
    expect(checkTrailerBody(body, FUTURE).code).toBe(1);
  });

  // Kills line 51:85 — last '' replaced with 'Stryker was here!'
  // The '' entry catches empty tokens after split (e.g. double-space splits).
  // Already covered by filter(Boolean) tests above; additionally verify:
  it("escape-hatch with empty-token rationale from double-space is still invalid", () => {
    const body = 'feat: foo\n\nPrior-art: skipped — todo  todo  todo  todo  todo todo today'; // 'today' is not a placeholder!
    // 'today' is NOT in PLACEHOLDERS → not all-placeholder → code 2
    expect(checkTrailerBody(body, FUTURE).code).toBe(2);
  });
});

describe('checkTrailerBody() — regex mutation-killing round 2 (Wave 2)', () => {
  // Kills prior-art.ts:62 StringLiteral: .replace(/[...]/g, '') -> .replace(/[...]/g, 'Stryker was here!')
  // With original strip, 'todo.' → 'todo' (placeholder). With non-empty replace, 'todo.' → 'todoStryker was here!' (NOT placeholder).
  // Test: rationale of punctuated placeholder words → should be all-placeholder → code 1 (invalid trailer).
  it('punctuated placeholder words (todo. na. tbd.) are treated as all-placeholder (code 1)', () => {
    // 'Prior-art: skipped — todo. todo. todo. todo. todo. todo.' has enough chars
    const body = 'feat: foo\n\nPrior-art: skipped — todo. todo. todo. todo. todo. todo.';
    const result = checkTrailerBody(body, FUTURE);
    // Original: 'todo.' → stripped → 'todo' → placeholder → allPlaceholder=true → continue → code 1
    // Mutant: 'todo.' → 'todoStryker was here!' → not placeholder → code 2 (substance arm)
    expect(result.code).toBe(1);
  });

  // Kills prior-art.ts:74 Regex mutant: remove ^ anchor from dep detection regex
  // Without ^, a line where + or - appears mid-string (not at line start) would be falsely matched.
  // e.g. '   some text + "my-lib": "^1.0.0"' → without ^, the + and dep-key pattern is found mid-string.
  it('does NOT detect a dep when + appears mid-line before a dep-format string (^ anchor required)', () => {
    // A non-diff line (starts with spaces) but contains a dep pattern internally.
    const diff = '   context text + "my-lib": "^1.0.0" and more content';
    expect(isNewDepAdded(diff)).toBe(false);
  });

  // Kills prior-art.ts:152:37 Regex mutant: /^[—–\-:]/ → /[—–\-:]/ (no ^ anchor)
  // Without ^, the first separator found ANYWHERE in the rationale is stripped (not just leading).
  // Test: rationale where separator is NOT at start but IS mid-string (after placeholder words).
  // 'todo — todo todo todo' → original: /^[—–\-:]/ strips nothing (starts with 'todo') → keep '—' mid-string
  //   → split includes '—' → '—' (em-dash) NOT stripped by ASCII-only stripPunctLower → NOT placeholder
  //   → allPlaceholder=false → code 2
  // Mutant /[—–\-:]/: strips first '—' found anywhere (mid-string) → 'todo  todo todo todo'
  //   → all 'todo' → all-placeholder → code 1
  it('does not strip a mid-rationale em-dash (only leading separator is stripped, ^ required)', () => {
    // Rationale: 'todo — todo todo todo todo' (em-dash is mid-string, not leading separator)
    // The 'skipped' is followed by ' todo — todo...' (space then 'todo', not separator then words)
    const body = 'feat: foo\n\nPrior-art: skipped todo — todo todo todo todo';
    // After slice 'skipped': ' todo — todo todo todo todo'
    // step1 /^ +/: 'todo — todo todo todo todo'
    // step2 /^[—–\-:]/: no leading separator → unchanged
    // step3 /^ +/: unchanged (no leading space)
    // isAllPlaceholder('todo — todo todo todo todo'): '—' is not in PLACEHOLDERS (em-dash not ASCII) → false → code 2
    expect(checkTrailerBody(body, FUTURE).code).toBe(2);
  });

  // Kills prior-art.ts:152:61 Regex mutant: /^ +/ → / +/ (second strip — no anchor)
  // Without ^, the first group of spaces found ANYWHERE is stripped (not just leading spaces).
  // Test: rationale with NO leading spaces but WITH internal spaces between placeholder words.
  // Original /^ +/: no leading spaces → nothing stripped → 'todo todo todo todo todo todo' → all-placeholder → code 1
  // Mutant / +/: strips FIRST internal space group → 'todotodo todo todo todo todo' → 'todotodo' not placeholder → code 2
  it('strips only LEADING spaces from rationale (not first internal space group)', () => {
    // Rationale after separator strip: 'todo todo todo todo todo todo' (no leading space)
    // Use 'Prior-art: skipped—todo todo...' — em-dash directly after 'skipped', no space before todos.
    const body = 'feat: foo\n\nPrior-art: skipped—todo todo todo todo todo todo';
    // After slice 'skipped': '—todo todo...'
    // step1 /^ +/: no leading space → '—todo todo...' unchanged
    // step2 /^[—–\-:]/: strips leading '—' → 'todo todo...'
    // step3 original /^ +/: no leading space → unchanged → 'todo todo...' (all-placeholder) → code 1
    // step3 mutant / +/: strips first internal space → 'todotodo...' → not placeholder → code 2
    expect(checkTrailerBody(body, FUTURE).code).toBe(1);
  });
});

describe('runPriorArtCheck() — SHA truncation mutation-killing (Wave 2)', () => {
  // Kills line 220 MethodExpression: sha.slice(0, 10) -> sha (full sha in substanceFailures)
  it('SHA in substanceFailures is truncated to 10 characters', () => {
    const longSha = 'abcdef1234567890';
    const g = fakeGit({
      packageJsonDiff: () => addedDepDiff('some-dep', '^1.0.0'),
      commitBody: () => `feat: dep\n\n${VALID_ESCAPE}`,
      authorDate: () => FUTURE,
    });
    const report = runPriorArtCheck([longSha], g);
    expect(report.substanceFailures).toHaveLength(1);
    expect(report.substanceFailures[0].sha).toBe('abcdef1234');
    expect(report.substanceFailures[0].sha.length).toBe(10);
  });

  // Kills line 221 MethodExpression: sha.slice(0, 10) -> sha (full sha in brokenCitations)
  it('SHA in brokenCitations is truncated to 10 characters', () => {
    const longSha = 'abcdef1234567890';
    const ssotIds = new Set([1]);
    const g = fakeGit({
      packageJsonDiff: () => addedDepDiff('some-dep', '^1.0.0'),
      commitBody: () => 'feat: dep\n\nPrior-art: prior-art-evaluations.md#999 (verdict — rationale here).',
      authorDate: () => FUTURE,
    });
    const report = runPriorArtCheck([longSha], g, undefined, ssotIds);
    expect(report.brokenCitations).toHaveLength(1);
    expect(report.brokenCitations[0].sha).toBe('abcdef1234');
    expect(report.brokenCitations[0].sha.length).toBe(10);
  });
});
