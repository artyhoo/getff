/**
 * Unit tests for git.ts helpers (Wave 3 mutation hardening).
 *
 * Mocks the run-check boundary so no real git invocations happen.
 * Covers every exported function + the private parseNameStatus logic
 * (exercised via realGit.changedFiles) to kill NoCoverage mutants.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock run-check before importing git.ts ──────────────────────────────────
const runCheckMock = vi.fn();
vi.mock('./run-check.ts', () => ({
  runCheck: (...args: unknown[]) => runCheckMock(...args),
}));

const {
  upstreamExists,
  resolveDefaultBase,
  getCommits,
  getChangedFiles,
  realGit,
  parsePushRefs,
  commitsNotOnRemotes,
  Z40,
} = await import('./git.ts');

// Helper: build the minimal CheckResult shape runCheck returns.
function ok(stdout = ''): { exitCode: number; stdout: string; stderr: string; timedOut: boolean; notFound: boolean } {
  return { exitCode: 0, stdout, stderr: '', timedOut: false, notFound: false };
}
function fail(stdout = ''): { exitCode: number; stdout: string; stderr: string; timedOut: boolean; notFound: boolean } {
  return { exitCode: 1, stdout, stderr: '', timedOut: false, notFound: false };
}

// ── upstreamExists ────────────────────────────────────────────────────────────
describe('upstreamExists', () => {
  beforeEach(() => runCheckMock.mockReset());

  it('returns true when git exits 0', () => {
    runCheckMock.mockReturnValue(ok());
    expect(upstreamExists('origin/main')).toBe(true);
  });

  it('returns false when git exits non-zero', () => {
    runCheckMock.mockReturnValue(fail());
    expect(upstreamExists('origin/missing')).toBe(false);
  });

  it('calls git rev-parse --verify with the given ref', () => {
    runCheckMock.mockReturnValue(ok());
    upstreamExists('refs/heads/foo');
    const [cmd, args] = runCheckMock.mock.calls[0];
    expect(cmd).toBe('git');
    expect(args).toEqual(['rev-parse', '--verify', 'refs/heads/foo']);
  });

  // Guards the EqualityOperator mutant: exitCode !== 0 would invert the result.
  it('returns false for exit code 128, not true', () => {
    runCheckMock.mockReturnValue({ ...ok(), exitCode: 128 });
    expect(upstreamExists('origin/main')).toBe(false);
  });
});

// ── resolveDefaultBase (GH #568) ────────────────────────────────────────────────
// Sequenced via mockReturnValueOnce in resolveDefaultBase's call order:
//   1. symbolic-ref --short refs/remotes/origin/HEAD   (gitOut → .stdout)
//   2. rev-parse --verify <head>                       (only when symref is non-empty)
//   3. rev-parse --verify origin/staging|main|master   (fallback chain, until one exits 0)
describe('resolveDefaultBase', () => {
  beforeEach(() => runCheckMock.mockReset());

  it('returns origin/HEAD when the symref is set and the ref exists', () => {
    runCheckMock
      .mockReturnValueOnce(ok('origin/main\n')) // symbolic-ref → origin/main
      .mockReturnValueOnce(ok()); // rev-parse --verify origin/main → exists
    expect(resolveDefaultBase()).toBe('origin/main');
  });

  it('falls back to origin/staging when the origin/HEAD symref is unset', () => {
    runCheckMock
      .mockReturnValueOnce(ok('')) // symbolic-ref → unset (empty stdout)
      .mockReturnValueOnce(ok()); // rev-parse --verify origin/staging → exists
    expect(resolveDefaultBase()).toBe('origin/staging');
  });

  it('falls through to origin/main on a main-default consumer (no symref, no staging) — the GH #568 case', () => {
    runCheckMock
      .mockReturnValueOnce(ok('')) // symbolic-ref → unset
      .mockReturnValueOnce(fail()) // origin/staging → absent
      .mockReturnValueOnce(ok()); // origin/main → exists
    expect(resolveDefaultBase()).toBe('origin/main');
  });

  it('ignores a STALE origin/HEAD pointing at a missing ref and uses the fallback chain', () => {
    runCheckMock
      .mockReturnValueOnce(ok('origin/main\n')) // symref claims origin/main…
      .mockReturnValueOnce(fail()) // …but rev-parse --verify origin/main → missing (stale)
      .mockReturnValueOnce(fail()) // origin/staging → absent
      .mockReturnValueOnce(fail()) // origin/main → absent
      .mockReturnValueOnce(ok()); // origin/master → exists
    expect(resolveDefaultBase()).toBe('origin/master');
  });

  it('returns null when nothing resolves (caller warns + skips, never a silent pass)', () => {
    // Every call fails: symbolic-ref → '' stdout, every rev-parse → non-zero.
    runCheckMock.mockReturnValue(fail());
    expect(resolveDefaultBase()).toBeNull();
  });
});

// ── getCommits ────────────────────────────────────────────────────────────────
describe('getCommits', () => {
  beforeEach(() => runCheckMock.mockReset());

  it('returns trimmed SHAs, filtering empty lines', () => {
    runCheckMock.mockReturnValue(ok('abc123\ndef456\n'));
    expect(getCommits('origin/main')).toEqual(['abc123', 'def456']);
  });

  it('returns an empty array when there are no commits', () => {
    runCheckMock.mockReturnValue(ok(''));
    expect(getCommits('origin/main')).toEqual([]);
  });

  // Guards filter(Boolean) removal: a trailing newline produces an empty string
  // that must be removed.
  it('filters out the trailing empty string after splitting on newline', () => {
    runCheckMock.mockReturnValue(ok('sha1\n'));
    const result = getCommits('origin/main');
    expect(result).toEqual(['sha1']);
    expect(result).not.toContain('');
  });

  // Guards map(s => s.trim()): a SHA with surrounding whitespace must be trimmed.
  it('trims whitespace around each SHA', () => {
    runCheckMock.mockReturnValue(ok('  sha1  \n  sha2  \n'));
    expect(getCommits('origin/main')).toEqual(['sha1', 'sha2']);
  });

  // Guards split('') mutant: splitting on '\n' (not '') is required.
  it('splits on newline, not on empty string (no character-split)', () => {
    runCheckMock.mockReturnValue(ok('ab\n'));
    const result = getCommits('origin/main');
    // If we split on '' we'd get individual characters; only newline-split gives ['ab'].
    expect(result).toEqual(['ab']);
  });

  it('passes the correct rev-list range to git', () => {
    runCheckMock.mockReturnValue(ok(''));
    getCommits('upstream/main');
    const [cmd, args] = runCheckMock.mock.calls[0];
    expect(cmd).toBe('git');
    expect(args).toEqual(['rev-list', 'upstream/main..HEAD']);
  });

  // head endpoint (2026-06-17 cross-checkout fix): a push validates
  // <base>..<local_sha>, not <base>..HEAD, so a feature branch pushed from a
  // checkout on a different branch is scoped to its own commits.
  it('uses the given head endpoint as the range terminus (base..head)', () => {
    runCheckMock.mockReturnValue(ok(''));
    getCommits('origin/feat', 'localsha123');
    const [cmd, args] = runCheckMock.mock.calls[0];
    expect(cmd).toBe('git');
    expect(args).toEqual(['rev-list', 'origin/feat..localsha123']);
  });

  // PAIRED-NEGATIVE: with an explicit head, the range must NOT terminate at HEAD
  // (the bug). Guards the StringLiteral mutant that hard-codes `..HEAD`.
  it('does NOT fall back to ..HEAD when an explicit head is supplied', () => {
    runCheckMock.mockReturnValue(ok(''));
    getCommits('origin/feat', 'localsha123');
    const [, args] = runCheckMock.mock.calls[0];
    expect(args[1]).toBe('origin/feat..localsha123');
    expect(args[1]).not.toContain('HEAD');
  });

  // Guards the default-parameter mutant: head defaults to 'HEAD', not '' (which
  // would produce the invalid range `base..`).
  it('defaults head to HEAD (not empty string) when omitted', () => {
    runCheckMock.mockReturnValue(ok(''));
    getCommits('origin/main');
    const [, args] = runCheckMock.mock.calls[0];
    expect(args[1]).toBe('origin/main..HEAD');
    expect(args[1]).not.toBe('origin/main..');
  });

  // Merge-forward range fix (2026-08-07): commits already reachable from the trunk
  // (origin/staging squash commits swept in by `git merge origin/staging`) must be
  // excluded from the gated set — the pusher does not own them and cannot amend them.
  it('appends --not <ref> when an exclusion ref is supplied', () => {
    runCheckMock.mockReturnValue(ok(''));
    getCommits('remotesha', 'localsha', 'origin/staging');
    const [cmd, args] = runCheckMock.mock.calls[0];
    expect(cmd).toBe('git');
    expect(args).toEqual([
      'rev-list',
      'remotesha..localsha',
      '--not',
      'origin/staging',
    ]);
  });

  // PAIRED-NEGATIVE: without an exclusion ref the range must stay bare — the
  // exclusion is opt-in per resolved base, never an unconditional narrowing.
  it('does NOT append --not when no exclusion ref is supplied', () => {
    runCheckMock.mockReturnValue(ok(''));
    getCommits('remotesha', 'localsha');
    const [, args] = runCheckMock.mock.calls[0];
    expect(args).toEqual(['rev-list', 'remotesha..localsha']);
    expect(args).not.toContain('--not');
  });
});

// ── getChangedFiles ───────────────────────────────────────────────────────────
describe('getChangedFiles', () => {
  beforeEach(() => runCheckMock.mockReset());

  it('returns filenames, filtering empty lines', () => {
    runCheckMock.mockReturnValue(ok('src/foo.ts\nsrc/bar.ts\n'));
    expect(getChangedFiles('origin/main')).toEqual(['src/foo.ts', 'src/bar.ts']);
  });

  it('returns an empty array for no changed files', () => {
    runCheckMock.mockReturnValue(ok(''));
    expect(getChangedFiles('origin/main')).toEqual([]);
  });

  // Guards diffFilter default value mutant: empty string vs 'ACMR'.
  it('uses ACMR as the default diff-filter', () => {
    runCheckMock.mockReturnValue(ok(''));
    getChangedFiles('origin/main');
    const [_cmd, args] = runCheckMock.mock.calls[0];
    expect(args).toContain('--diff-filter=ACMR');
  });

  it('accepts a custom diff-filter and passes it through', () => {
    runCheckMock.mockReturnValue(ok(''));
    getChangedFiles('origin/main', 'D');
    const [_cmd, args] = runCheckMock.mock.calls[0];
    expect(args).toContain('--diff-filter=D');
    expect(args).not.toContain('--diff-filter=ACMR');
  });

  // Guards filter(Boolean) mutant.
  it('filters out the trailing empty string produced by split', () => {
    runCheckMock.mockReturnValue(ok('file.ts\n'));
    const result = getChangedFiles('origin/main');
    expect(result).toEqual(['file.ts']);
    expect(result).not.toContain('');
  });

  // Guards map(s => s.trim()) mutant.
  it('trims whitespace around filenames', () => {
    runCheckMock.mockReturnValue(ok('  file.ts  \n'));
    expect(getChangedFiles('origin/main')).toEqual(['file.ts']);
  });

  it('passes the correct diff range to git', () => {
    runCheckMock.mockReturnValue(ok(''));
    getChangedFiles('refs/heads/feat');
    const [cmd, args] = runCheckMock.mock.calls[0];
    expect(cmd).toBe('git');
    expect(args[0]).toBe('diff');
    expect(args).toContain('refs/heads/feat..HEAD');
  });

  // Guards StringLiteral survivors: any single arg mutated to '' must be caught.
  it('passes the exact diff args including --name-only flag', () => {
    runCheckMock.mockReturnValue(ok(''));
    getChangedFiles('origin/main');
    const [_cmd, args] = runCheckMock.mock.calls[0];
    // Full exact check: ['diff', '--name-only', 'origin/main..HEAD', '--diff-filter=ACMR']
    expect(args[0]).toBe('diff');
    expect(args[1]).toBe('--name-only');
    expect(args[2]).toBe('origin/main..HEAD');
    expect(args[3]).toBe('--diff-filter=ACMR');
    expect(args.every((a: string) => a !== '')).toBe(true);
  });

  // head endpoint (2026-06-17 cross-checkout fix): the diff terminus follows the
  // pushed local_sha, mirroring getCommits, so §6/§8 changed-file scoping does not
  // leak the checkout's HEAD into a feature-branch push.
  it('uses the given head endpoint as the diff terminus (base..head)', () => {
    runCheckMock.mockReturnValue(ok(''));
    getChangedFiles('origin/feat', 'ACMR', 'localsha123');
    const [, args] = runCheckMock.mock.calls[0];
    expect(args[2]).toBe('origin/feat..localsha123');
    expect(args[2]).not.toContain('HEAD');
  });

  // Guards the head default-parameter mutant alongside the existing diffFilter one.
  it('defaults head to HEAD when only base (and filter) are given', () => {
    runCheckMock.mockReturnValue(ok(''));
    getChangedFiles('origin/main', 'D');
    const [, args] = runCheckMock.mock.calls[0];
    expect(args[2]).toBe('origin/main..HEAD');
    expect(args[3]).toBe('--diff-filter=D');
  });
});

// ── Z40 (all-zeros remote sha git sends for a not-yet-existing remote ref) ──────
describe('Z40 constant', () => {
  it('is exactly 40 zero characters', () => {
    expect(Z40).toBe('0000000000000000000000000000000000000000');
    expect(Z40).toHaveLength(40);
  });
});

// ── parsePushRefs (pure stdin parser — the canonical base-ref signal) ───────────
describe('parsePushRefs', () => {
  it('parses a single ref line into its four fields', () => {
    const line = 'refs/heads/feat aaa111 refs/heads/feat bbb222';
    expect(parsePushRefs(line)).toEqual([
      { localRef: 'refs/heads/feat', localSha: 'aaa111', remoteRef: 'refs/heads/feat', remoteSha: 'bbb222' },
    ]);
  });

  it('parses multiple ref lines (a multi-ref push)', () => {
    const stdin = 'refs/heads/a 111 refs/heads/a 222\nrefs/heads/b 333 refs/heads/b 444\n';
    expect(parsePushRefs(stdin)).toEqual([
      { localRef: 'refs/heads/a', localSha: '111', remoteRef: 'refs/heads/a', remoteSha: '222' },
      { localRef: 'refs/heads/b', localSha: '333', remoteRef: 'refs/heads/b', remoteSha: '444' },
    ]);
  });

  it('exposes Z40 as the remoteSha for a new-branch push', () => {
    const line = `refs/heads/new abc123 refs/heads/new ${Z40}`;
    const [ref] = parsePushRefs(line);
    expect(ref.remoteSha).toBe(Z40);
  });

  it('returns an empty array for empty stdin (no piped refs)', () => {
    expect(parsePushRefs('')).toEqual([]);
  });

  // Guards filter(Boolean) on lines: a trailing newline must not yield a phantom ref.
  it('filters out blank lines (trailing newline produces no entry)', () => {
    const stdin = 'refs/heads/a 1 refs/heads/a 2\n\n';
    expect(parsePushRefs(stdin)).toHaveLength(1);
  });

  // Guards the malformed-line filter: a line lacking the sha fields is dropped, not
  // returned with undefined shas (which would mis-resolve the base).
  it('drops malformed lines that lack the sha fields', () => {
    expect(parsePushRefs('garbage')).toEqual([]);
    expect(parsePushRefs('only two fields')).toEqual([]);
  });

  // Guards whitespace-split robustness: git uses single spaces, but tolerate runs.
  it('splits on whitespace runs, not a single literal space only', () => {
    const line = 'refs/heads/a   111   refs/heads/a   222';
    expect(parsePushRefs(line)).toEqual([
      { localRef: 'refs/heads/a', localSha: '111', remoteRef: 'refs/heads/a', remoteSha: '222' },
    ]);
  });

  // SANITY (negative): a well-formed line must NOT be silently dropped.
  it('does not drop a valid 4-field line', () => {
    expect(parsePushRefs('r 1 r 2')).not.toEqual([]);
  });
});

// ── commitsNotOnRemotes (Z40 new-branch path — the highest-risk resolver arm) ───
describe('commitsNotOnRemotes', () => {
  beforeEach(() => runCheckMock.mockReset());

  it('returns trimmed SHAs, filtering empty lines', () => {
    runCheckMock.mockReturnValue(ok('abc123\ndef456\n'));
    expect(commitsNotOnRemotes('HEAD')).toEqual(['abc123', 'def456']);
  });

  it('returns an empty array when nothing is off-remote (already pushed)', () => {
    runCheckMock.mockReturnValue(ok(''));
    expect(commitsNotOnRemotes('localsha')).toEqual([]);
  });

  // Guards filter(Boolean): trailing newline must not yield a phantom commit.
  it('filters out the trailing empty string after splitting', () => {
    runCheckMock.mockReturnValue(ok('sha1\n'));
    const result = commitsNotOnRemotes('local');
    expect(result).toEqual(['sha1']);
    expect(result).not.toContain('');
  });

  // Guards map(s => s.trim()).
  it('trims whitespace around each SHA', () => {
    runCheckMock.mockReturnValue(ok('  sha1  \n  sha2  \n'));
    expect(commitsNotOnRemotes('local')).toEqual(['sha1', 'sha2']);
  });

  // Guards ArrayDeclaration + StringLiteral survivors: the exact rev-list args
  // are load-bearing — `--not --remotes` is what makes this trunk-agnostic.
  it('passes the exact rev-list args (localSha --not --remotes)', () => {
    runCheckMock.mockReturnValue(ok(''));
    commitsNotOnRemotes('abc123');
    const [cmd, args] = runCheckMock.mock.calls[0];
    expect(cmd).toBe('git');
    expect(args).toEqual(['rev-list', 'abc123', '--not', '--remotes']);
    expect(args.every((a: string) => a !== '')).toBe(true);
  });

  // Guards the localSha being passed through (not a hard-coded ref).
  it('uses the given localSha, not a hard-coded HEAD/branch literal', () => {
    runCheckMock.mockReturnValue(ok(''));
    commitsNotOnRemotes('deadbeef');
    const [, args] = runCheckMock.mock.calls[0];
    expect(args).toContain('deadbeef');
    expect(args).not.toContain('HEAD');
  });
});

// ── realGit.packageJsonDiff ───────────────────────────────────────────────────
describe('realGit.packageJsonDiff', () => {
  beforeEach(() => runCheckMock.mockReset());

  it('returns the stdout of git show for package.json', () => {
    runCheckMock.mockReturnValue(ok('diff content'));
    expect(realGit.packageJsonDiff('abc')).toBe('diff content');
    const [cmd, args] = runCheckMock.mock.calls[0];
    expect(cmd).toBe('git');
    expect(args).toEqual(['show', 'abc', '--', 'package.json']);
  });
});

// ── realGit.changedFiles / parseNameStatus ────────────────────────────────────
describe('realGit.changedFiles (parseNameStatus)', () => {
  beforeEach(() => runCheckMock.mockReset());

  it('parses tab-separated status/path pairs', () => {
    runCheckMock.mockReturnValue(ok('M\tsrc/foo.ts\nA\tsrc/bar.ts\n'));
    expect(realGit.changedFiles('sha1')).toEqual([
      { status: 'M', path: 'src/foo.ts' },
      { status: 'A', path: 'src/bar.ts' },
    ]);
  });

  // Guards filter(e => e.path !== '') — lines without a tab get an empty path and must be removed.
  it('filters out lines that have no tab separator', () => {
    runCheckMock.mockReturnValue(ok('M\tsrc/foo.ts\nno-tab-line\n'));
    const result = realGit.changedFiles('sha1');
    expect(result).toEqual([{ status: 'M', path: 'src/foo.ts' }]);
    expect(result.some((e) => e.path === '')).toBe(false);
  });

  // Guards EqualityOperator mutant on tab === -1: inverted would keep no-tab lines.
  it('does not include entries where indexOf tab returns -1', () => {
    runCheckMock.mockReturnValue(ok('NOTAB\n'));
    expect(realGit.changedFiles('sha1')).toEqual([]);
  });

  // Guards the path: line.slice(tab + 1) vs line.slice(tab - 1) (ArithmeticOperator).
  it('slices path starting AFTER the tab (tab+1), not before it', () => {
    // 'M\tfile.ts' — tab is at index 1; path should be 'file.ts' (slice from 2)
    // If mutant uses tab-1 = 0, path would be 'M\tfile.ts' (whole line).
    runCheckMock.mockReturnValue(ok('M\tfile.ts\n'));
    const result = realGit.changedFiles('sha1');
    expect(result[0].path).toBe('file.ts');
    expect(result[0].path).not.toContain('\t');
  });

  // Guards status: line.slice(0, tab) vs line (MethodExpression mutant).
  it('slices status to just the part before the tab', () => {
    runCheckMock.mockReturnValue(ok('AM\tpath/file.ts\n'));
    const result = realGit.changedFiles('sha1');
    expect(result[0].status).toBe('AM');
    expect(result[0].status).not.toContain('\t');
    expect(result[0].status).not.toContain('path');
  });

  // Guards filter(Boolean) on lines — empty lines must be removed.
  it('filters out empty lines from the raw git output', () => {
    runCheckMock.mockReturnValue(ok('\nM\tsrc/a.ts\n\n'));
    expect(realGit.changedFiles('sha1')).toEqual([{ status: 'M', path: 'src/a.ts' }]);
  });

  // Guards map(line => line.trim()).
  it('trims whitespace from each line before parsing', () => {
    runCheckMock.mockReturnValue(ok('  M\tsrc/a.ts  \n'));
    // After trimming, 'M\tsrc/a.ts' — tab at index 1, status='M', path='src/a.ts'
    const result = realGit.changedFiles('sha1');
    expect(result).toEqual([{ status: 'M', path: 'src/a.ts' }]);
  });

  // Guards EqualityOperator filter mutant: e.path === '' would keep only empties.
  it('keeps entries with non-empty paths', () => {
    runCheckMock.mockReturnValue(ok('M\tfile.ts\n'));
    expect(realGit.changedFiles('sha1').length).toBe(1);
  });

  // Guards ArrayDeclaration + all StringLiteral survivors on the diff-tree call.
  it('passes the exact diff-tree args to git', () => {
    runCheckMock.mockReturnValue(ok(''));
    realGit.changedFiles('abc123');
    const [cmd, args] = runCheckMock.mock.calls[0];
    expect(cmd).toBe('git');
    // Exact shape: ['diff-tree', '--no-commit-id', '--name-status', '-r', sha]
    expect(args).toEqual(['diff-tree', '--no-commit-id', '--name-status', '-r', 'abc123']);
    // No arg should be an empty string.
    expect(args.every((a: string) => a !== '')).toBe(true);
  });
});

// ── realGit.fileContent ───────────────────────────────────────────────────────
describe('realGit.fileContent', () => {
  beforeEach(() => runCheckMock.mockReset());

  it('returns stdout when git exits 0', () => {
    runCheckMock.mockReturnValue(ok('file contents here'));
    expect(realGit.fileContent('sha1', 'path/to/file.ts')).toBe('file contents here');
  });

  // Guards EqualityOperator mutant: exitCode !== 0 ? stdout : null would invert.
  it('returns null when git exits non-zero (file absent)', () => {
    runCheckMock.mockReturnValue(fail());
    expect(realGit.fileContent('sha1', 'missing.ts')).toBeNull();
  });

  // Guards ConditionalExpression mutant: return false ? stdout : null = always null.
  it('returns the actual stdout content, not null, on success', () => {
    runCheckMock.mockReturnValue(ok('content'));
    const result = realGit.fileContent('sha1', 'file.ts');
    expect(result).not.toBeNull();
    expect(result).toBe('content');
  });

  it('invokes git show with sha:path syntax', () => {
    runCheckMock.mockReturnValue(ok(''));
    realGit.fileContent('abc123', 'src/index.ts');
    const [cmd, args] = runCheckMock.mock.calls[0];
    expect(cmd).toBe('git');
    expect(args).toEqual(['show', 'abc123:src/index.ts']);
  });
});

// ── realGit.subdirExistedAtParent ─────────────────────────────────────────────
describe('realGit.subdirExistedAtParent', () => {
  beforeEach(() => runCheckMock.mockReset());

  it('returns false when the parent commit does not exist', () => {
    // First call: git rev-parse --verify sha^ → exit 1 (no parent)
    runCheckMock.mockReturnValueOnce(fail());
    expect(realGit.subdirExistedAtParent('sha1', 'my-subdir')).toBe(false);
  });

  it('returns true when ls-tree output is non-empty (subdir exists)', () => {
    // First call: rev-parse → success; second: ls-tree → content
    runCheckMock.mockReturnValueOnce(ok());       // upstreamExists(parent) → true
    runCheckMock.mockReturnValueOnce(ok('packages/core/my-subdir/foo.ts\n'));
    expect(realGit.subdirExistedAtParent('sha1', 'my-subdir')).toBe(true);
  });

  it('returns false when ls-tree output is empty (subdir absent)', () => {
    runCheckMock.mockReturnValueOnce(ok());   // upstreamExists → true
    runCheckMock.mockReturnValueOnce(ok(''));  // ls-tree → no files
    expect(realGit.subdirExistedAtParent('sha1', 'my-subdir')).toBe(false);
  });

  // Guards EqualityOperator mutant: out.trim().length >= 0 is always true.
  it('distinguishes empty string (length=0, returns false) from non-empty', () => {
    runCheckMock.mockReturnValueOnce(ok());
    runCheckMock.mockReturnValueOnce(ok(''));
    expect(realGit.subdirExistedAtParent('sha1', 'sub')).toBe(false);

    runCheckMock.mockReturnValueOnce(ok());
    runCheckMock.mockReturnValueOnce(ok('file'));
    expect(realGit.subdirExistedAtParent('sha1', 'sub')).toBe(true);
  });

  // Guards MethodExpression mutant: out.length > 0 vs out.trim().length > 0.
  // A whitespace-only output should return false (trim matters).
  it('trims the ls-tree output before checking length', () => {
    runCheckMock.mockReturnValueOnce(ok());
    runCheckMock.mockReturnValueOnce(ok('   \n   '));
    expect(realGit.subdirExistedAtParent('sha1', 'sub')).toBe(false);
  });

  // Guards BooleanLiteral mutant on return false → return true.
  it('returns false (not true) when parent is absent', () => {
    runCheckMock.mockReturnValueOnce(fail());
    const result = realGit.subdirExistedAtParent('sha1', 'sub');
    expect(result).toBe(false);
    expect(result).not.toBe(true);
  });

  // Guards BooleanLiteral mutant: !upstreamExists(parent) → upstreamExists(parent).
  // When parent exists BUT ls-tree is empty → false; when parent missing → also false.
  it('only checks ls-tree when parent exists (does not skip when parent absent)', () => {
    // parent absent: should return false WITHOUT calling ls-tree
    runCheckMock.mockReturnValueOnce(fail()); // rev-parse fails → no parent
    realGit.subdirExistedAtParent('orphan', 'sub');
    // Only one call made (rev-parse for parent check); ls-tree never called.
    expect(runCheckMock).toHaveBeenCalledTimes(1);
  });

  it('builds the correct parent ref as sha^', () => {
    runCheckMock.mockReturnValueOnce(fail()); // no parent
    realGit.subdirExistedAtParent('abc123', 'dir');
    const [cmd, args] = runCheckMock.mock.calls[0];
    expect(cmd).toBe('git');
    expect(args).toContain('abc123^');
  });

  // Guards ArrayDeclaration + all StringLiteral survivors on the ls-tree call.
  it('passes the exact ls-tree args to git', () => {
    runCheckMock.mockReturnValueOnce(ok());  // upstreamExists(parent) → success
    runCheckMock.mockReturnValueOnce(ok('packages/core/my-sub/file.ts\n'));
    realGit.subdirExistedAtParent('sha1', 'my-sub');
    // Second call is the ls-tree call.
    const [cmd, args] = runCheckMock.mock.calls[1];
    expect(cmd).toBe('git');
    // Exact shape: ['ls-tree', '-r', '--name-only', 'sha1^', '--', 'packages/core/my-sub/']
    expect(args).toEqual(['ls-tree', '-r', '--name-only', 'sha1^', '--', 'packages/core/my-sub/']);
    // No arg should be an empty string.
    expect(args.every((a: string) => a !== '')).toBe(true);
  });
});

// ── realGit.blobTrackedAtBase ────────────────────────────────────────────────
// B-1 (2026-09-05): the byte-identical carve-out exempts RELOCATIONS, so the
// duplicate must be resolved against the PRE-IMAGE tree (`<sha>^`). Resolving it
// against `<sha>` — the commit's own tree — exempted every new file added with a
// byte-identical twin in the SAME commit, which is what the pre-commit twin-sync
// produces for every new hook, silently disabling the ≥50/≥80-LOC triggers.
describe('realGit.blobTrackedAtBase', () => {
  beforeEach(() => runCheckMock.mockReset());

  const HASH = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const OTHER = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

  it('lists the PARENT tree, never the commit\'s own tree', () => {
    runCheckMock.mockReturnValueOnce(ok(`${HASH}\n`)); // rev-parse sha:path
    runCheckMock.mockReturnValueOnce(ok());              // rev-parse --verify sha^
    runCheckMock.mockReturnValueOnce(ok(''));            // ls-tree
    realGit.blobTrackedAtBase('abc123', 'packages/core/a.ts');
    expect(runCheckMock.mock.calls[0][1]).toEqual([
      'rev-parse',
      'abc123:packages/core/a.ts',
    ]);
    expect(runCheckMock.mock.calls[2][1]).toEqual(['ls-tree', '-r', 'abc123^']);
    expect(runCheckMock.mock.calls[2][1]).not.toContain('abc123');
  });

  it('PAIRED NEGATIVE — a duplicate that exists only in the commit itself is NOT tracked at base', () => {
    runCheckMock.mockReturnValueOnce(ok(`${HASH}\n`));
    runCheckMock.mockReturnValueOnce(ok());
    // The parent tree holds other blobs only — the twin was born in this commit.
    runCheckMock.mockReturnValueOnce(
      ok(`100644 blob ${OTHER}\tpackages/core/old.ts\n`),
    );
    expect(realGit.blobTrackedAtBase('abc123', 'packages/core/a.ts')).toBe(false);
  });

  it('returns true when the same blob is already tracked at another path in the parent', () => {
    runCheckMock.mockReturnValueOnce(ok(`${HASH}\n`));
    runCheckMock.mockReturnValueOnce(ok());
    runCheckMock.mockReturnValueOnce(
      ok(
        `100644 blob ${OTHER}\tvendor/other.ts\n100644 blob ${HASH}\tvendor/src/module.ts\n`,
      ),
    );
    expect(realGit.blobTrackedAtBase('abc123', 'packages/x/module.ts')).toBe(true);
  });

  it('returns false when the path does not resolve to a blob', () => {
    runCheckMock.mockReturnValueOnce(fail());
    expect(realGit.blobTrackedAtBase('abc123', 'missing.ts')).toBe(false);
    expect(runCheckMock).toHaveBeenCalledTimes(1);
  });

  it('returns false for a non-hash rev-parse output (defensive)', () => {
    runCheckMock.mockReturnValueOnce(ok('not-a-hash\n'));
    expect(realGit.blobTrackedAtBase('abc123', 'a.ts')).toBe(false);
    expect(runCheckMock).toHaveBeenCalledTimes(1);
  });

  it('returns false when there is no parent (root commit) without listing anything', () => {
    runCheckMock.mockReturnValueOnce(ok(`${HASH}\n`));
    runCheckMock.mockReturnValueOnce(fail()); // rev-parse --verify sha^ → no parent
    expect(realGit.blobTrackedAtBase('root', 'packages/core/a.ts')).toBe(false);
    expect(runCheckMock).toHaveBeenCalledTimes(2);
  });

  it('matches the ls-tree HASH column, not an incidental path substring', () => {
    runCheckMock.mockReturnValueOnce(ok(`${HASH}\n`));
    runCheckMock.mockReturnValueOnce(ok());
    runCheckMock.mockReturnValueOnce(
      ok(`100644 blob ${OTHER}\tdocs/${HASH}.md\n`),
    );
    expect(realGit.blobTrackedAtBase('abc123', 'packages/core/a.ts')).toBe(false);
  });
});

// ── realGit.commitBody ────────────────────────────────────────────────────────
describe('realGit.commitBody', () => {
  beforeEach(() => runCheckMock.mockReset());

  it('returns the commit body from git show', () => {
    runCheckMock.mockReturnValue(ok('subject\n\nbody text\n'));
    expect(realGit.commitBody('sha1')).toBe('subject\n\nbody text\n');
    const [cmd, args] = runCheckMock.mock.calls[0];
    expect(cmd).toBe('git');
    expect(args).toEqual(['show', '-s', '--format=%B', 'sha1']);
  });
});

// ── realGit.authorDate ────────────────────────────────────────────────────────
describe('realGit.authorDate', () => {
  beforeEach(() => runCheckMock.mockReset());

  it('returns just the date part (YYYY-MM-DD) of the author date', () => {
    runCheckMock.mockReturnValue(ok('2026-05-22 18:30:00 +0300\n'));
    expect(realGit.authorDate('sha1')).toBe('2026-05-22');
  });

  // Guards LogicalOperator mutant: ?? '' → && '' would return '' on defined value.
  it('returns empty string when git output is empty (fallback to empty string)', () => {
    runCheckMock.mockReturnValue(ok('\n'));
    // trim() of '\n' = '', split(' ') = [''], [0] = '' — ?? '' = ''
    expect(realGit.authorDate('sha1')).toBe('');
  });

  // Guards ?? '' vs && '' mutant: if split returns ['2026-05-22', ...], ?? never fires.
  // But if split returns [] or undefined for [0], ?? should give '' not undefined.
  it('returns a non-empty date string, not undefined, when output is valid', () => {
    runCheckMock.mockReturnValue(ok('2026-05-22 18:30:00 +0300\n'));
    const result = realGit.authorDate('sha1');
    expect(result).not.toBeUndefined();
    expect(result).toBe('2026-05-22');
  });

  // Guards MethodExpression mutant: .split(' ')[0] ?? '' vs no .trim() before split.
  // Without trim(), output '2026-05-22 18:30:00 +0300\n' still works but
  // ' 2026-05-22 ...\n' would produce a leading-space first element.
  it('trims the output before splitting (trim matters for leading/trailing spaces)', () => {
    runCheckMock.mockReturnValue(ok(' 2026-05-22 18:30:00 +0300 \n'));
    // Without trim: split(' ') gives ['', '2026-05-22', ...] → [0] = ''
    // With trim: '2026-05-22 18:30:00 +0300' → [0] = '2026-05-22'
    expect(realGit.authorDate('sha1')).toBe('2026-05-22');
  });

  it('passes the correct git args', () => {
    runCheckMock.mockReturnValue(ok('2026-05-22 00:00:00 +0000\n'));
    realGit.authorDate('abc');
    const [cmd, args] = runCheckMock.mock.calls[0];
    expect(cmd).toBe('git');
    expect(args).toEqual(['show', '-s', '--format=%ai', 'abc']);
  });
});

// ── realGit.commitSubject ─────────────────────────────────────────────────────
describe('realGit.commitSubject', () => {
  beforeEach(() => runCheckMock.mockReset());

  it('returns the subject line with trailing newline stripped', () => {
    runCheckMock.mockReturnValue(ok('feat(x): do something\n'));
    expect(realGit.commitSubject('sha1')).toBe('feat(x): do something');
  });

  // Guards Regex mutant: /\n$/ → /\n/ would also strip mid-string newlines.
  it('only strips a trailing newline, not a mid-string one', () => {
    runCheckMock.mockReturnValue(ok('line1\nline2\n'));
    // /\n$/ replaces only the final \n → 'line1\nline2'
    // /\n/ replaces the first \n → 'line1line2\n'
    expect(realGit.commitSubject('sha1')).toBe('line1\nline2');
  });

  // Guards StringLiteral mutant: replace(/\n$/, 'Stryker was here!').
  it('replaces the trailing newline with empty string, not a placeholder', () => {
    runCheckMock.mockReturnValue(ok('subject\n'));
    expect(realGit.commitSubject('sha1')).not.toContain('Stryker');
    expect(realGit.commitSubject('sha1')).toBe('subject');
  });

  it('returns an empty string for an empty commit subject', () => {
    runCheckMock.mockReturnValue(ok('\n'));
    expect(realGit.commitSubject('sha1')).toBe('');
  });

  it('passes the correct git args', () => {
    runCheckMock.mockReturnValue(ok(''));
    realGit.commitSubject('abc');
    const [cmd, args] = runCheckMock.mock.calls[0];
    expect(cmd).toBe('git');
    expect(args).toEqual(['show', '-s', '--format=%s', 'abc']);
  });
});

// ── realGit.diffForPaths ──────────────────────────────────────────────────────
describe('realGit.diffForPaths', () => {
  beforeEach(() => runCheckMock.mockReset());

  it('passes sha + separator + spread paths to git show', () => {
    runCheckMock.mockReturnValue(ok('diff output'));
    const result = realGit.diffForPaths('sha1', ['src/a.ts', 'src/b.ts']);
    expect(result).toBe('diff output');
    const [cmd, args] = runCheckMock.mock.calls[0];
    expect(cmd).toBe('git');
    expect(args).toEqual(['show', 'sha1', '--', 'src/a.ts', 'src/b.ts']);
  });
});
