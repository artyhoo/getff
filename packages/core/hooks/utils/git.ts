/**
 * git.ts — thin git helpers for the pre-push hook (Wave 10.2).
 *
 * All git I/O for the trailer checks funnels through here so the check logic
 * (checks/prior-art.ts) stays pure + unit-testable against a fake GitProvider —
 * mirroring how the bash test mocked `git show` to return a fixed body.
 *
 * Changed-file scoping (`getChangedFiles`) is the lint-staged technique adapted
 * from aif-handoff (research patch §4.8.X.3): scope expensive checks to the
 * push range `origin/main..HEAD` rather than the whole tree.
 */
import { runCheck } from './run-check.ts';

/** Run git, return stdout (empty string on failure — callers tolerate it). */
function gitOut(args: readonly string[]): string {
  return runCheck('git', args).stdout;
}

/** A capability-detection / trailer view over git, injectable for tests. */
export interface GitProvider {
  /** `git show <sha> -- package.json` (the unified diff, or '' if none). */
  packageJsonDiff(sha: string): string;
  /** `git diff-tree --no-commit-id --name-status -r <sha>` parsed to {status,path}. */
  changedFiles(sha: string): { status: string; path: string }[];
  /** `git show <sha>:<path>` contents, or null if the path is absent at that sha. */
  fileContent(sha: string, path: string): string | null;
  /** Did `packages/core/<subdir>/` exist at <sha>'s parent? (false if no parent). */
  subdirExistedAtParent(sha: string, subdir: string): boolean;
  /** `git show -s --format=%B <sha>` — full commit message body. */
  commitBody(sha: string): string;
  /** Date part (YYYY-MM-DD) of `git show -s --format=%ai <sha>`. */
  authorDate(sha: string): string;
  /** `git show -s --format=%s <sha>` — commit subject line. */
  commitSubject(sha: string): string;
  /** `git show <sha> -- <paths…>` — the unified diff restricted to those paths. */
  diffForPaths(sha: string, paths: readonly string[]): string;
  /**
   * Is the blob at `<sha>:<path>` byte-identical to a blob tracked at ANY other
   * path in the same tree? A true result means the file is a relocation/vendor
   * copy — no new capability by construction (PR #1271: vendored runtime-bridge
   * subset tripped the ≥80-LOC trigger despite being byte-identical copies).
   */
  blobDuplicatedInTree(sha: string, path: string): boolean;
}

/**
 * The all-zeros SHA git writes on the pre-push stdin `remote_sha` field when the
 * remote ref does not yet exist (a brand-new branch being pushed for the first
 * time). Per `githooks(5)`.
 */
export const Z40 = '0000000000000000000000000000000000000000';

/** One parsed line of the pre-push hook's stdin. */
export interface PushRef {
  localRef: string;
  localSha: string;
  remoteRef: string;
  remoteSha: string;
}

/**
 * Parse the pre-push hook's stdin into structured refs. git passes one line per
 * pushed ref: `<local_ref> <local_sha> <remote_ref> <remote_sha>`. This is the
 * canonical, trunk-agnostic base-ref signal (ADAPT of pre-commit's stdin parse,
 * SSOT — see hook-base-ref-detection research patch): `remote_sha` is exactly
 * what HEAD is being pushed against, so the hook never has to *guess* a default
 * branch. Pure (no git I/O) so it is unit-testable. Blank and malformed lines
 * (fewer than the four required fields) are dropped rather than yielding a ref
 * with undefined shas, which would mis-resolve the diff base.
 */
export function parsePushRefs(stdin: string): PushRef[] {
  return stdin
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s+/))
    .filter((parts) => parts.length >= 4)
    .map(([localRef, localSha, remoteRef, remoteSha]) => ({
      localRef: localRef ?? '',
      localSha: localSha ?? '',
      remoteRef: remoteRef ?? '',
      remoteSha: remoteSha ?? '',
    }));
}

export function upstreamExists(ref: string): boolean {
  return runCheck('git', ['rev-parse', '--verify', ref]).exitCode === 0;
}

/**
 * The default base ref to diff against when neither PREPUSH_UPSTREAM_REF nor git
 * pre-push stdin is available (a manual `node pre-push.ts` run, the bash fallback, or
 * a CI setup that pipes no stdin). Derives the consumer's REAL default branch instead
 * of hard-coding `origin/staging` — the former default silently no-op'd on any repo
 * whose trunk is `main`/`master` (GH #568; dual-pair with pre-push.fallback.sh):
 *
 *   1. `origin/HEAD` symbolic-ref → the remote's advertised default branch
 *      (`origin/main` on a main-default consumer, `origin/staging` in this repo).
 *   2. first existing of `origin/staging` → `origin/main` → `origin/master`
 *      (covers a remote whose local `origin/HEAD` symref is unset OR stale —
 *      the staleness gotcha exercised in worktree-setup.test.ts).
 *
 * Returns null when nothing resolves — callers emit a VISIBLE warning and skip,
 * never a silent pass.
 */
export function resolveDefaultBase(): string | null {
  const head = gitOut([
    'symbolic-ref',
    '--short',
    'refs/remotes/origin/HEAD',
  ]).trim();
  if (head && upstreamExists(head)) return head;
  for (const ref of ['origin/staging', 'origin/main', 'origin/master']) {
    if (upstreamExists(ref)) return ref;
  }
  return null;
}

/**
 * Commits reachable from `localSha` but not on any remote-tracking branch — the
 * new commits a first-time branch push (stdin `remote_sha` == {@link Z40})
 * introduces. Trunk-agnostic: no `origin/<trunk>` literal, so it works on any
 * consumer repo regardless of trunk name. Mirrors pre-commit's Z40 handling.
 */
export function commitsNotOnRemotes(localSha: string): string[] {
  return gitOut(['rev-list', localSha, '--not', '--remotes'])
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Commit SHAs in `<upstreamRef>..<head>`, newest first (git rev-list order).
 *
 * `head` defaults to `HEAD` (manual run / CI backstop — the checkout IS what is
 * being checked). On a `git push`, the caller passes the pushed ref's
 * **local_sha** instead: when a feature branch is pushed from a checkout sitting
 * on a *different* branch, `HEAD` is the other branch's tip — NOT the pushed
 * branch's — so `..HEAD` would validate unrelated commits (the 2026-06-17
 * cross-checkout incident). The range must follow the ref actually being pushed.
 *
 * `excludeReachableFrom` (optional) appends `--not <ref>` — the merge-forward
 * range fix (2026-08-07, PR #1269/#1270 incident): after `git merge
 * origin/staging` on a published PR branch, the bare `remote_sha..local_sha`
 * range swept in the trunk's own squash commits (which routinely lack
 * `Prior-art:`/`§1.7` trailers — the squash-trailer-loss, compensated by the
 * PR-body gate #1098), failing the push on commits the pusher does not own.
 * Passing the resolved trunk here scopes the gate to commits the push actually
 * introduces to the trunk lineage. Range-correctness only, not a relaxation:
 * trunk-reachable commits were already gated at their own push or PR merge.
 */
export function getCommits(
  upstreamRef: string,
  head = 'HEAD',
  excludeReachableFrom?: string,
): string[] {
  const args = ['rev-list', `${upstreamRef}..${head}`];
  if (excludeReachableFrom) args.push('--not', excludeReachableFrom);
  return gitOut(args)
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Changed files in the push range (aif-handoff scoping, §4.8.X.3).
 *
 * `head` defaults to `HEAD`; on a push the caller passes the pushed ref's
 * local_sha so the diff endpoint follows the pushed branch, not the checkout's
 * HEAD (see {@link getCommits}).
 */
export function getChangedFiles(
  upstreamRef: string,
  diffFilter = 'ACMR',
  head = 'HEAD',
): string[] {
  return gitOut([
    'diff',
    '--name-only',
    `${upstreamRef}..${head}`,
    `--diff-filter=${diffFilter}`,
  ])
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseNameStatus(out: string): { status: string; path: string }[] {
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const tab = line.indexOf('\t');
      if (tab === -1) return { status: line, path: '' };
      return { status: line.slice(0, tab), path: line.slice(tab + 1) };
    })
    .filter((e) => e.path !== '');
}

/** The real git-backed provider used by the running hook. */
export const realGit: GitProvider = {
  packageJsonDiff: (sha) => gitOut(['show', sha, '--', 'package.json']),
  changedFiles: (sha) =>
    parseNameStatus(
      gitOut(['diff-tree', '--no-commit-id', '--name-status', '-r', sha]),
    ),
  fileContent: (sha, path) => {
    const r = runCheck('git', ['show', `${sha}:${path}`]);
    return r.exitCode === 0 ? r.stdout : null;
  },
  subdirExistedAtParent: (sha, subdir) => {
    const parent = `${sha}^`;
    if (!upstreamExists(parent)) return false;
    const out = gitOut([
      'ls-tree',
      '-r',
      '--name-only',
      parent,
      '--',
      `packages/core/${subdir}/`,
    ]);
    return out.trim().length > 0;
  },
  commitBody: (sha) => gitOut(['show', '-s', '--format=%B', sha]),
  authorDate: (sha) =>
    gitOut(['show', '-s', '--format=%ai', sha]).trim().split(' ')[0] ?? '',
  commitSubject: (sha) =>
    gitOut(['show', '-s', '--format=%s', sha]).replace(/\n$/, ''),
  diffForPaths: (sha, paths) => gitOut(['show', sha, '--', ...paths]),
  blobDuplicatedInTree: (sha, path) => blobDuplicatedAt(sha, path),
};

/**
 * Shared impl for GitProvider.blobDuplicatedInTree: resolve the blob hash of
 * `<tree>:<path>`, then count how many paths in that tree carry the same hash.
 * ls-tree line shape: `<mode> blob <hash>\t<path>` — match on the hash column.
 */
function blobDuplicatedAt(tree: string, path: string): boolean {
  const blob = runCheck('git', ['rev-parse', `${tree}:${path}`]);
  if (blob.exitCode !== 0) return false;
  const hash = blob.stdout.trim();
  if (!/^[0-9a-f]{40,64}$/.test(hash)) return false;
  let count = 0;
  for (const line of gitOut(['ls-tree', '-r', tree]).split('\n')) {
    if (line.includes(hash)) count++;
    if (count >= 2) return true;
  }
  return false;
}

/**
 * A GitProvider over a PR RANGE (`merge-base(base, head)..head`) instead of a
 * single commit — the squash-preview view for the PR-body Prior-art gate
 * (2026-07-22 squash-trailer-loss incident, PR #1094 → #1097): a squash merge
 * builds ONE commit from exactly this diff, with the PR body as its message,
 * so capability detection must run over the whole range. The `sha` argument of
 * each method is ignored; commitBody/authorDate return '' because the message
 * under check is the PR body, supplied separately by the caller.
 */
export function rangeGit(baseSha: string, headSha: string): GitProvider {
  const mb = gitOut(['merge-base', baseSha, headSha]).trim() || baseSha;
  return {
    packageJsonDiff: () => gitOut(['diff', mb, headSha, '--', 'package.json']),
    changedFiles: () =>
      parseNameStatus(gitOut(['diff', '--name-status', mb, headSha])),
    fileContent: (_sha, path) => {
      const r = runCheck('git', ['show', `${headSha}:${path}`]);
      return r.exitCode === 0 ? r.stdout : null;
    },
    subdirExistedAtParent: (_sha, subdir) =>
      gitOut([
        'ls-tree',
        '-d',
        '--name-only',
        mb,
        '--',
        `packages/core/${subdir}`,
      ]).trim().length > 0,
    commitBody: () => '',
    authorDate: () => '',
    commitSubject: () => '',
    diffForPaths: (_sha, paths) =>
      gitOut(['diff', mb, headSha, '--', ...paths]),
    blobDuplicatedInTree: (_sha, path) => blobDuplicatedAt(headSha, path),
  };
}
