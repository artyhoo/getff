/**
 * pr-stale-revert.ts — the stale-base rebuild gate (incident PR #1285, repaired
 * by PR #1298). Sibling of pr-body-fidelity.ts / prior-art.ts.
 *
 * The class: a PR is squash-rebuilt — a fresh branch is forked from the current
 * base tip and the ORIGINAL branch's whole tree (based on an older base) is
 * committed over it. Every file the base moved since the original fork point
 * becomes a silent REVERSION inside the PR's own diff. In #1285 that discarded
 * `.claude/orchestrator-prompts/consumer-matrix-pnpm-flake/kickoff.md` rev2 back
 * to rev1 (dropping #1283) and stripped the §1j block from `setup.d/10-skills.sh`
 * (dropping #1284 — a live consumer-facing regression).
 *
 * Why no existing channel catches it (evidence for the rule amendment,
 * .claude/rules/git-conflict-merge-forward.md §8):
 *   - GitHub "require branches to be up to date" is POSITIONAL, not content-based:
 *     the branch WAS up to date (merge-base == the fresh tip); the stale content
 *     arrived as the PR's own change. Misses the class by construction.
 *   - CI: no test covered the reverted content (a docs revision + a profile-gated
 *     shipping block). A merge queue shares the blindness — it re-runs status
 *     checks on merged trees, it does not compare content lineage.
 *   - Human review: 21 reverted lines inside a 2498-insertion diff. Bare attention
 *     is not a mechanism (.claude/rules/attention-is-not-a-mechanism.md §1).
 *
 * The detectable signature is mechanical and needs no judgment: the PR sets a file
 * to a blob BYTE-IDENTICAL to an OLDER ancestor version of that file on the base
 * branch. Nobody reproduces an old blob byte-for-byte by hand by accident.
 *
 * KNOWN v1 FALSE NEGATIVE (documented, not an oversight): whole-file blob equality
 * only catches files the PR leaves byte-identical to the stale base version. A stale
 * file the PR ALSO edits produces a novel blob and is undetectable — in #1285 itself
 * `setup.d/10-skills.sh` (the functional half: stale base + the PR's own A8 edits
 * layered on top) would NOT flag; only `kickoff.md` (an untouched stale copy) flags.
 * The untouched-stale-copy shape is the majority shape of a whole-tree snapshot, so
 * the gate catches the class where it concentrates; the edited-stale-file shape is a
 * declared non-goal with a revisit trigger (rule §8, SSOT #241).
 *
 * Other v1 non-goals: renames are NOT followed and deletions are NOT flagged (the
 * incident class is modifications of existing files); the scan is M-status only.
 *
 * Structure: everything above `realStaleRevertGit` is PURE (git access is injected
 * via StaleRevertGit), so the decision logic is unit-testable and Stryker-mutatable
 * without shelling out. The real provider lives here rather than in utils/git.ts
 * because it must be importable WITHOUT side effects — the bin runs env-and-exit-code
 * glue at module top level, and the calibration harness plus the bin must share the
 * exact code path CI runs. Precedent for a check owning its git access:
 * checks/guard-liveness.ts, checks/cmd-script-liveness.ts, checks/skill-core-edit-scope.ts.
 */
import { runCheck } from '../utils/run-check.ts';
import { stripHtmlComments } from '../utils/markdown-comments.ts';

/**
 * How far back the base-side history of each modified file is walked. A squash-rebuild
 * reverts to the fork point, which is days — not 50 file-touching commits — old; the cap
 * bounds the per-file git cost on files with long histories.
 */
export const HISTORY_DEPTH = 50;

/** Minimum rationale length for the escape token (same floor as the Prior-art escape hatch). */
export const MIN_TOKEN_RATIONALE_CHARS = 20;

/** One historical version of a file on the base branch. */
export interface HistoricalBlob {
  /** The base-side commit that produced this version. */
  commit: string;
  /** Blob sha of the file at that commit. */
  blob: string;
}

/** Everything the check needs to know about one modified file. */
export interface FileArchaeology {
  path: string;
  /** Blob sha at the PR head, or null when the file is absent there. */
  headBlob: string | null;
  /** Blob sha at the PR base, or null when the file is absent there. */
  baseBlob: string | null;
  /** Base-side commits that touched the file, NEWEST FIRST. */
  history: readonly HistoricalBlob[];
}

export interface StaleRevertFinding {
  path: string;
  /** The base-side commit whose version of the file the PR reproduces byte-for-byte. */
  matchedCommit: string;
  /**
   * Base-side commits NEWER than the match that touched the file — exactly the work
   * the PR discards. Empty is impossible for a real finding: the base tip's own
   * version differs from head (checked first), so at least one commit is newer.
   */
  discardedCommits: string[];
}

/** Result of parsing the PR-body escape token. */
export interface EscapeToken {
  /** A `STALE-REVERT:` line exists in the body (well-formed or not). */
  present: boolean;
  /** The line is well-formed AND its rationale clears the length floor. */
  valid: boolean;
  rationale: string;
  /** Why an present-but-invalid token was rejected (empty when valid or absent). */
  reason: string;
}

/**
 * Any line beginning with the token name — used so a malformed token gets a specific
 * error instead of the generic "no token" one. Deliberately liberal.
 */
const TOKEN_LINE_RE = /^STALE-REVERT:.*$/m;
/**
 * The well-formed token. Dash class matches pr-body-fidelity.ts:46 (ASCII hyphen plus
 * en/em/figure/horizontal dashes) — a GitHub body routinely carries a typographic dash.
 */
const TOKEN_VALID_RE = /^STALE-REVERT:[ \t]*intended[ \t]*[-–—‒―]+[ \t]*(.+)$/m;


/**
 * Decide one file. Returns null for every healthy shape and a finding only when the
 * head blob byte-matches a strictly older base-side version.
 *
 * Order is load-bearing: `headBlob === baseBlob` (the PR converges to its base) is
 * excluded BEFORE the history walk, so a history entry equal to the base blob can
 * never be read as evidence of a revert — it is the current content.
 */
export function checkFileStaleRevert(file: FileArchaeology): StaleRevertFinding | null {
  const { headBlob, baseBlob, history } = file;
  // Absent on either side — deletion/rename territory, a declared v1 non-goal.
  if (headBlob === null || baseBlob === null) return null;
  // The PR agrees with its base on this file. Nothing to say.
  if (headBlob === baseBlob) return null;

  const discarded: string[] = [];
  for (const entry of history) {
    if (entry.blob === headBlob && entry.blob !== baseBlob) {
      return { path: file.path, matchedCommit: entry.commit, discardedCommits: discarded };
    }
    // Everything walked past on the way to the match is newer than it and touched
    // the file — that is precisely the work a revert to the match would discard.
    discarded.push(entry.commit);
  }
  // A blob nobody on the base branch ever had = a genuine new change.
  return null;
}

/** Decide every file; findings keep input order (which is git's diff order). */
export function checkStaleRevert(files: readonly FileArchaeology[]): StaleRevertFinding[] {
  const out: StaleRevertFinding[] = [];
  for (const f of files) {
    const finding = checkFileStaleRevert(f);
    if (finding) out.push(finding);
  }
  return out;
}

/**
 * Parse the PR-body escape token: `STALE-REVERT: intended — <rationale >=20 chars>`.
 *
 * The token is PR-GLOBAL, not per-file — a RECORDED v1 decision (rule §8), not an
 * oversight: the token is expected to be rare, and the failure message names every
 * flagged file, so a global acknowledgement still leaves an auditable record of what
 * was acknowledged. Per-file parsing is deferred until a real multi-file mixed-intent
 * case appears.
 */
export function parseStaleRevertToken(body: string): EscapeToken {
  // Comments are stripped so a commented-out token never neutralises the gate
  // (fidelity precedent). Markdown-aware — utils/markdown-comments.ts explains why a
  // raw regex here deleted the token line of any body that quoted a marker in code.
  const text = stripHtmlComments(body);
  if (!TOKEN_LINE_RE.test(text)) {
    return { present: false, valid: false, rationale: '', reason: '' };
  }
  const m = text.match(TOKEN_VALID_RE);
  if (!m) {
    return {
      present: true,
      valid: false,
      rationale: '',
      reason:
        'malformed STALE-REVERT line — expected `STALE-REVERT: intended — <rationale>` ' +
        '(the token is case-sensitive and the separator must be a dash)',
    };
  }
  const rationale = (m[1] ?? '').trim();
  if (rationale.length < MIN_TOKEN_RATIONALE_CHARS) {
    return {
      present: true,
      valid: false,
      rationale,
      reason: `STALE-REVERT rationale must be >=${MIN_TOKEN_RATIONALE_CHARS} chars (got ${rationale.length})`,
    };
  }
  return { present: true, valid: true, rationale, reason: '' };
}

/** Human-readable failure body — one block per flagged file, then the fix. */
export function formatFindings(findings: readonly StaleRevertFinding[]): string[] {
  const lines: string[] = [];
  for (const f of findings) {
    lines.push(
      `${f.path}: this PR sets the file to its version at ${f.matchedCommit} — an OLDER base-branch version.`,
    );
    lines.push(
      f.discardedCommits.length > 0
        ? `  discards base commit(s): ${f.discardedCommits.join(', ')}`
        : '  discards base commit(s): (none resolved — inspect the file history by hand)',
    );
  }
  lines.push('');
  lines.push(
    'This is the stale-base rebuild signature (incident PR #1285, repaired by #1298): a branch',
  );
  lines.push(
    'forked from a fresh base with an older tree committed over it silently reverts every file',
  );
  lines.push('the base moved in between. Fix: merge the base INTO your branch and re-apply your');
  lines.push('change — see .claude/rules/git-conflict-merge-forward.md (§2 recipe, §8 this hazard).');
  lines.push('');
  lines.push('If the revert IS the intent (a restoration PR like #1298), add to the PR body:');
  lines.push('  STALE-REVERT: intended — <rationale, >=20 chars>');
  lines.push('This check re-runs on PR body edit.');
  return lines;
}

// ── git access (injected above, real implementation below) ────────────────────

/** The git view this gate needs. Injectable so every function above stays pure. */
export interface StaleRevertGit {
  /** Does the rev resolve to a commit in this checkout? */
  revExists(rev: string): boolean;
  /** `git merge-base <a> <b>`, or null when it cannot be resolved (shallow clone). */
  mergeBase(a: string, b: string): string | null;
  /** `git diff --name-only --diff-filter=M <from>..<to>`. */
  modifiedFiles(from: string, to: string): string[];
  /** Blob sha of `<rev>:<path>`, or null when the path is absent at that rev. */
  blobAt(rev: string, path: string): string | null;
  /** `git rev-list -n <limit> <rev> -- <path>` — commits touching the file, newest first. */
  commitsTouching(rev: string, path: string, limit: number): string[];
}

export interface Archaeology {
  /**
   * The resolved merge-base, or null when git could not compute one. Null is a
   * MISCONFIGURATION signal (shallow checkout), not a clean result — the bin fails
   * closed on it rather than reporting an empty, falsely-green file set.
   */
  mergeBase: string | null;
  files: FileArchaeology[];
}

/**
 * Walk the PR range and build the per-file input for {@link checkStaleRevert}.
 *
 * `baseSha` is the PR base at its last sync (`github.event.pull_request.base.sha`),
 * NOT necessarily the current base tip. That is deliberate: comparing against the
 * branch point means a merely-behind branch — the ordinary, healthy state of any PR
 * open for more than a moment — produces no findings.
 *
 * Consecutive identical blobs in a file's history collapse to their newest commit: a
 * commit that did not change the content is not work a revert discards, and naming it
 * in the finding would be noise.
 */
export function collectArchaeology(
  git: StaleRevertGit,
  baseSha: string,
  headSha: string,
): Archaeology {
  const mergeBase = git.mergeBase(baseSha, headSha);
  if (mergeBase === null) return { mergeBase: null, files: [] };

  const files: FileArchaeology[] = [];
  for (const path of git.modifiedFiles(mergeBase, headSha)) {
    const headBlob = git.blobAt(headSha, path);
    const baseBlob = git.blobAt(baseSha, path);
    // Absent on either side, or unchanged relative to base: no history walk needed
    // (the walk is the expensive part — one `rev-parse` per historical commit).
    if (headBlob === null || baseBlob === null || headBlob === baseBlob) continue;

    const history: HistoricalBlob[] = [];
    let previous: string | null = null;
    for (const commit of git.commitsTouching(baseSha, path, HISTORY_DEPTH)) {
      const blob = git.blobAt(commit, path);
      if (blob === null || blob === previous) continue;
      previous = blob;
      history.push({ commit, blob });
    }
    files.push({ path, headBlob, baseBlob, history });
  }
  return { mergeBase, files };
}

/**
 * A real git-backed provider rooted at `cwd` (default: the process cwd, which is what
 * the CI bin wants). The parameter exists so the shipped provider — not a re-implementation
 * of it — can be exercised against a throwaway fixture repository in tests, and so the
 * calibration harness can point at a specific checkout.
 */
export function gitProviderAt(cwd?: string): StaleRevertGit {
  const opts = cwd === undefined ? {} : { cwd };
  const out = (args: readonly string[]): string[] => {
    const r = runCheck('git', args, opts);
    if (r.exitCode !== 0) return [];
    return r.stdout
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  };
  const sha = (args: readonly string[]): string | null => {
    const r = runCheck('git', args, opts);
    const value = r.stdout.trim();
    return r.exitCode === 0 && /^[0-9a-f]{40,64}$/.test(value) ? value : null;
  };
  return {
    revExists: (rev) =>
      runCheck('git', ['rev-parse', '--verify', '--quiet', `${rev}^{commit}`], opts).exitCode === 0,
    mergeBase: (a, b) => sha(['merge-base', a, b]),
    // core.quotePath=false keeps non-ASCII paths unescaped, so the path handed back to
    // `rev-parse <rev>:<path>` is the literal one git indexes.
    modifiedFiles: (from, to) =>
      out([
        '-c',
        'core.quotePath=false',
        'diff',
        '--name-only',
        '--diff-filter=M',
        `${from}..${to}`,
      ]),
    blobAt: (rev, path) => sha(['rev-parse', '--verify', '--quiet', `${rev}:${path}`]),
    commitsTouching: (rev, path, limit) => out(['rev-list', '-n', String(limit), rev, '--', path]),
  };
}

/** The provider used by the CI bin and the calibration harness (process cwd). */
export const realStaleRevertGit: StaleRevertGit = gitProviderAt();
