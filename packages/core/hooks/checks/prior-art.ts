/**
 * prior-art.ts — §7 Prior-art trailer check (Phase 8.8 T8), ported from bash in
 * Wave 10.2. Faithful TS port of `pa_*` from the former legacy-trailer-checks.sh:
 * capability-commit detection + `Prior-art:` trailer validation (length,
 * placeholder rejection, escape-hatch substance arm).
 *
 * Pure logic (diff/body/LOC parsing) is separated from git I/O via the injected
 * GitProvider (utils/git.ts), so this module is unit-testable + Stryker-mutatable
 * without shelling out — the bash predecessor had zero mutation coverage.
 *
 * Wave N8 C1 (deterministic-offload): the SSOT-existence arm. A capability
 * commit's `Prior-art: prior-art-evaluations.md#N` trailer is now checked that
 * #N actually resolves to a real SSOT row — not merely that the trailer is
 * present. This mechanises the prose probe at `phase-research-coverage.md §1.9`
 * and catches the Wave-7 M2 incident (a trailer cited a non-existent #N and
 * passed by presence alone). The check runs only when the caller supplies the
 * SSOT id-set (graceful no-op if the register is unreadable).
 */
import type { GitProvider } from '../utils/git.ts';

/** Wave 8.5 cutoff — commits authored before this bypass the check (rebase replay). */
export const PA_HISTORICAL_CUTOFF = '2026-05-12';

/** A `prior-art-evaluations.md#N` citation (zero or more per trailer line). */
const SSOT_CITATION_RE = /prior-art-evaluations\.md#(\d+)/g;

/** Numeric SSOT ids cited in a trailer line, e.g. `…#1 …#42` → [1, 42]. */
export function extractCitedSsotIds(text: string): number[] {
  const out: number[] = [];
  SSOT_CITATION_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SSOT_CITATION_RE.exec(text)) !== null) out.push(Number(m[1]));
  return out;
}

/**
 * Parse the numeric entry ids from the SSOT register (`prior-art-evaluations.md`).
 * §4 entries are table rows like `| 12 | … |`; the §1/§2 schema-header tables have
 * non-numeric first cells, so the leading-digit anchor filters them. Mirrors the
 * loader in principle 08 (independent enforcement surface — same register, two
 * channels: in-file citations vs commit trailers).
 */
export function loadSsotIds(ssotContent: string): Set<number> {
  const ids = new Set<number>();
  const rowRe = /^\|\s*(\d+)\s*\|/gm;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(ssotContent)) !== null) ids.add(Number(m[1]));
  return ids;
}

const PLACEHOLDERS = new Set([
  'todo',
  'later',
  'na',
  'tbd',
  'fixme',
  'placeholder',
  '',
]);

/** `wc -l` semantics: number of newline characters in the content. */
export function loc(content: string): number {
  return content.split('\n').length - 1;
}

/** Lowercase + strip ASCII punctuation only (matches bash `tr -d '[:punct:]'` on bytes). */
function stripPunctLower(word: string): string {
  return word.toLowerCase().replace(/[!-/:-@[-`{-~]/g, '');
}

/**
 * A package.json diff adds a NEW dependency (not a version bump) when a dep key
 * appears on a `+` line but no matching `-` line. Semver-prefix coverage mirrors
 * the bash: caret / tilde / range / digit / wildcard (dist-tags + URL specs slip).
 *
 * Keys inside `overrides` / `resolutions` / `pnpm` blocks are NOT dependencies —
 * they force versions of packages already in the tree (PR #980 incident: security
 * `overrides` entries were flagged as new explicit deps). Tracking is indent-based
 * over the diff text and resets at each `@@` hunk header; a hunk that edits deep
 * inside an existing overrides block without its opening line in context can still
 * false-positive — accepted residual, the escape-hatch trailer covers it.
 */
export function isNewDepAdded(packageJsonDiff: string): boolean {
  if (!packageJsonDiff) return false;
  const added = new Set<string>();
  const removed = new Set<string>();
  const re = /^([+-])\s+"([^"]+)":\s*"(\^|~|>=?|<=?|=|[0-9*])/;
  const nonDepBlockRe = /^[+\- ]\s*"(overrides|resolutions|pnpm)"\s*:\s*\{/;
  let skipIndent: number | null = null; // indent of the open non-dep block, if any
  for (const line of packageJsonDiff.split('\n')) {
    if (line.startsWith('@@')) {
      skipIndent = null; // new hunk — block context is lost
      continue;
    }
    const body = line.slice(1); // strip the +/-/space diff marker
    const indent = body.length - body.trimStart().length;
    if (skipIndent !== null) {
      // Inside overrides/resolutions/pnpm: nothing here is a dependency. The
      // block ends at a closing brace back at (or above) the opening indent.
      if (indent <= skipIndent && /^\s*[}\]]/.test(body)) skipIndent = null;
      continue;
    }
    if (nonDepBlockRe.test(line)) {
      skipIndent = indent;
      continue;
    }
    const m = re.exec(line);
    if (!m) continue;
    (m[1] === '+' ? added : removed).add(m[2]);
  }
  for (const key of added) {
    if (!removed.has(key)) return true;
  }
  return false;
}

function isNewCoreSubdir50Loc(sha: string, g: GitProvider): boolean {
  for (const { status, path } of g.changedFiles(sha)) {
    if (status !== 'A') continue;
    if (!path.startsWith('packages/core/')) continue;
    const subdir = path.slice('packages/core/'.length).split('/')[0];
    if (g.subdirExistedAtParent(sha, subdir)) continue; // not a NEW subdir
    const content = g.fileContent(sha, path);
    if (content !== null && loc(content) >= 50) return true;
  }
  return false;
}

function isNewPackages80Loc(sha: string, g: GitProvider): boolean {
  for (const { status, path } of g.changedFiles(sha)) {
    if (status !== 'A') continue;
    if (!path.startsWith('packages/')) continue;
    const content = g.fileContent(sha, path);
    if (content !== null && loc(content) >= 80) return true;
  }
  return false;
}

/** Why this commit is a capability commit, or null if it is not one. */
export function detectCapabilityReason(
  sha: string,
  g: GitProvider,
): string | null {
  if (isNewDepAdded(g.packageJsonDiff(sha)))
    return 'new explicit dep in package.json';
  if (isNewCoreSubdir50Loc(sha, g))
    return 'new file ≥50 LOC under new packages/core/<dir>/';
  if (isNewPackages80Loc(sha, g)) return 'new file ≥80 LOC under packages/';
  return null;
}

export interface TrailerResult {
  /**
   * 0 = valid, 1 = missing/invalid trailer, 2 = escape-hatch substance failure,
   * 3 = broken citation — trailer cites a `prior-art-evaluations.md#N` with no
   * such SSOT entry (Wave N8 C1; only reachable when `ssotIds` is supplied).
   */
  code: 0 | 1 | 2 | 3;
  message: string;
}

/**
 * Validate the `Prior-art:` trailer of a commit body. Pure — takes the body +
 * author date so it is testable with fixtures (the bash mocked `git show`).
 *
 * When `ssotIds` is supplied, a valid positive trailer additionally has every
 * cited `prior-art-evaluations.md#N` checked against the register (C1). Omitting
 * it (existing callers, unreadable SSOT) skips the existence arm — behaviour is
 * unchanged for code 0/1/2.
 */
export function checkTrailerBody(
  body: string,
  authorDate: string,
  cutoff: string = PA_HISTORICAL_CUTOFF,
  ssotIds?: ReadonlySet<number>,
): TrailerResult {
  // Historical-cutoff bypass (string compare on ISO dates, as in bash).
  if (authorDate && authorDate < cutoff) return { code: 0, message: '' };

  let foundAny = false;
  for (const line of body.split('\n')) {
    if (!line.startsWith('Prior-art:')) continue;
    foundAny = true;
    let payload = line.slice('Prior-art:'.length).replace(/^ /, ''); // strip one leading space
    if (payload.length < 20) continue; // too short — a later valid line may still pass
    if (payload.startsWith('skipped')) {
      let rationale = payload.slice('skipped'.length).replace(/^ +/, '');
      rationale = rationale.replace(/^[—–\-:]/, '').replace(/^ +/, '');
      if (rationale.length < 20) continue;
      const words = rationale.split(/\s+/).filter(Boolean);
      const allPlaceholder = words.every((w) =>
        PLACEHOLDERS.has(stripPunctLower(w)),
      );
      if (allPlaceholder) continue;
      // Escape-hatch on a capability commit is contradictory by construction.
      return {
        code: 2,
        message:
          'substance: Prior-art: skipped on capability commit — cite an SSOT entry (prior-art-evaluations.md#N) instead',
      };
    }
    // Valid positive trailer. C1: when the register's id-set is supplied, every
    // cited prior-art-evaluations.md#N must resolve to a real entry. A trailer
    // with no #N citation (free-form prose) has nothing to resolve → passes.
    if (ssotIds) {
      const missing = extractCitedSsotIds(line).filter(
        (id) => !ssotIds.has(id),
      );
      if (missing.length > 0) {
        return {
          code: 3,
          message: `cites prior-art-evaluations.md#${missing
            .map(String)
            .join(', #')} but no such entry exists in SSOT — broken citation`,
        };
      }
    }
    return { code: 0, message: '' };
  }
  return {
    code: 1,
    message: foundAny
      ? 'Prior-art: line found but invalid (length <20 or placeholder rationale)'
      : 'no Prior-art: trailer',
  };
}

export interface PriorArtFinding {
  sha: string;
  reason: string;
  message: string;
}
export interface PriorArtReport {
  failures: PriorArtFinding[]; // exit-1 class: missing/invalid trailer
  substanceFailures: PriorArtFinding[]; // exit-2 class: escape-hatch on capability
  brokenCitations: PriorArtFinding[]; // C1: cites a non-existent SSOT entry (exit-1 class)
}

/**
 * The C1 existence arm's id-source. Either a fixed id-set, or a per-commit
 * resolver `(sha) => ids`. The resolver form is what the running hook supplies so
 * each capability commit's citation is checked against **that commit's own tree**
 * (`git show <sha>:prior-art-evaluations.md`) — not the working tree of whatever
 * branch happens to be checked out. Reading a fixed working-tree snapshot was the
 * second half of the 2026-06-17 incident: a commit citing an entry that existed
 * in its own tree was flagged broken because the (dirty / cross-checkout) working
 * tree lacked it. A resolver returning `undefined` for a sha (SSOT unreadable at
 * that commit) makes the existence check a graceful no-op for it.
 */
export type SsotIdsSource =
  | ReadonlySet<number>
  | ((sha: string) => ReadonlySet<number> | undefined);

/**
 * Run the §7 check over the given commits. Returns findings; the caller decides
 * how to print and whether the substance arm is warn-only.
 *
 * `ssotIds` (a register id-set, or a per-commit `(sha) => ids` resolver) enables
 * the C1 broken-citation arm; when omitted the existence check is skipped and
 * `brokenCitations` stays empty.
 */
/** Result of the PR-body arm: ok, plus why the PR is a capability change. */
export interface PrBodyPriorArtResult {
  ok: boolean;
  /** Capability reason, or null when the PR range is not a capability change. */
  reason: string | null;
  message: string;
}

/**
 * PR-body arm of the §7 check (2026-07-22 squash-trailer-loss incident,
 * PR #1094 → #1097 on artyhoo/getff): a squash merge writes ONE commit whose
 * diff is the whole PR range and whose message the agent merge path takes from
 * the PR BODY — branch-commit `Prior-art:` trailers do NOT survive, so the F1
 * gate (principle 11) goes red on the next unrelated PR. Counter: a capability
 * PR must carry a valid `Prior-art:` line in the PR body itself.
 *
 * `g` is a range provider (utils/git.ts `rangeGit`) viewing merge-base..head
 * as one synthetic commit. authorDate is passed '' — a PR merging today is
 * never pre-cutoff, so the historical bypass must not fire.
 */
export function checkPrBodyPriorArt(
  prBody: string,
  g: GitProvider,
  ssotIds?: ReadonlySet<number>,
): PrBodyPriorArtResult {
  const reason = detectCapabilityReason('PR_RANGE', g);
  if (reason === null) return { ok: true, reason: null, message: '' };
  const { code, message } = checkTrailerBody(prBody, '', undefined, ssotIds);
  return { ok: code === 0, reason, message };
}

export function runPriorArtCheck(
  commits: readonly string[],
  g: GitProvider,
  cutoff: string = PA_HISTORICAL_CUTOFF,
  ssotIds?: SsotIdsSource,
): PriorArtReport {
  const failures: PriorArtFinding[] = [];
  const substanceFailures: PriorArtFinding[] = [];
  const brokenCitations: PriorArtFinding[] = [];
  for (const sha of commits) {
    const reason = detectCapabilityReason(sha, g);
    if (reason === null) continue; // not a capability commit
    const ids = typeof ssotIds === 'function' ? ssotIds(sha) : ssotIds;
    const { code, message } = checkTrailerBody(
      g.commitBody(sha),
      g.authorDate(sha),
      cutoff,
      ids,
    );
    if (code === 1) failures.push({ sha: sha.slice(0, 10), reason, message });
    else if (code === 2)
      substanceFailures.push({ sha: sha.slice(0, 10), reason, message });
    else if (code === 3)
      brokenCitations.push({ sha: sha.slice(0, 10), reason, message });
  }
  return { failures, substanceFailures, brokenCitations };
}
