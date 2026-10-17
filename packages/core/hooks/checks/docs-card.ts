/**
 * docs-card.ts — the `Docs-card:` trailer check (D30 D-Q16, getff-ai-site S0q).
 *
 * Every commit touching markdown prose under `docs/site/` (any depth, `.md` or
 * `.mdx`) carries a commit trailer
 * `Docs-card: C1 PASS, C2 PASS, … C13 N/A` (the writer's self-filled criteria
 * card, `.claude/skills/docs-author/references/criteria-card.md`), or the
 * escape `Docs-card: skipped — <>=20-char reason>`. Checked at pre-push AND in
 * `audit-self.yml` over the PR range — the CI arm exists because aif container
 * seats never run the repo's git hooks, so a pre-push-only gate is blind to
 * exactly the population that writes most of the pages (qual.md:377).
 *
 * Deliberately NOT routed through prior-art.ts: its two path gates
 * (`if (!path.startsWith('packages/core/')) continue;` /
 * `if (!path.startsWith('packages/')) continue;`) exclude every path outside
 * `packages/`, which is exactly this population (D-Q15/D-Q16 record why the
 * earlier «both arms of prior-art.ts» named a gate that can never fire —
 * `#hope-as-gate`, attention-is-not-a-mechanism.md §2).
 *
 * Pure logic (trailer/card parsing) is separated from git I/O via the injected
 * GitProvider (utils/git.ts), mirroring checks/prior-art.ts — unit-testable
 * without shelling out.
 *
 * One registry entry (`{ id: 'docs-card', owner: 'maintainer', run: … }` in
 * pre-push.ts's SECTIONS), one CI step (`PREPUSH_ONLY=docs-card npx tsx …
 * pre-push.ts`) — the CI arm re-enters THIS code through the seam, never a
 * second grammar (dual-implementation-discipline.md §8, `#sync-by-copy-paste`).
 */
import type { GitProvider } from '../utils/git.ts';

/** The seven registered kind values' card ids — C1..C13 (criteria-card.md). */
export const DOCS_CARD_IDS: readonly string[] = [
  'C1',
  'C2',
  'C3',
  'C4',
  'C5',
  'C6',
  'C7',
  'C8',
  'C9',
  'C10',
  'C11',
  'C12',
  'C13',
];

/** The only verdict values a card entry may carry (D-Q16 grammar). */
export const DOCS_CARD_VALUES: readonly string[] = ['PASS', 'FAIL', 'N/A'];

/** Minimum escape-rationale length — mirrors the prior-art/pr-body floor. */
export const DOCS_CARD_SKIP_MIN = 20;

/** `Docs-card:` trailer line, anywhere in the body (first one wins). */
const TRAILER_RE = /^[ \t]*Docs-card:[ \t]*(.*)$/im;

/**
 * `Docs-card-for: <sha7-40> <card | skipped — reason>` — a LATER commit in the checked range
 * carries the card for an earlier range commit that has none. Join incident 2026-09-30: seven
 * range commits touched docs/site prose without a trailer; this arm already existed in their
 * parents, but the part branches were never pushed (so no pre-push ran), and the part commits sit
 * under merges and cannot be amended. It is a claim the arm verifies, not an escape: the named
 * commit must be in the range, non-merge, prose-touching and without its own trailer; one claim
 * per commit; the payload passes the same grammar as `Docs-card:`; and the skip form is accepted
 * only when the named commit's prose diff is mechanical (isMechanicalProseDiff). Sibling of
 * prior-art.ts ROW_MOVED_RE.
 */
const CLAIM_RE = /^[ \t]*Docs-card-for:[ \t]*([0-9a-f]{7,40})[ \t]+(.*)$/gim;

/** A `docs-refresh: deferred …` page marker line (scripts/check-docs-refresh.mjs grammar). */
const DEFERRAL_MARKER_RE = /^docs-refresh: deferred\b/;

/**
 * Is a unified diff of docs/site prose mechanical — nothing a reader-comfort card could judge?
 * Per hunk, after dropping deferral marker lines, the removed and added lines pair up one to one
 * and each pair differs only in its digit runs (a citation re-point: «line 1271» → «line 1272»).
 * An unpaired prose line, or any change in words, is not mechanical. An empty diff is not either:
 * nothing was verified.
 */
export function isMechanicalProseDiff(diff: string): boolean {
  const hunks: { removed: string[]; added: string[] }[] = [];
  for (const line of diff.split('\n')) {
    if (line.startsWith('@@')) hunks.push({ removed: [], added: [] });
    const hunk = hunks[hunks.length - 1];
    if (!hunk || line.startsWith('---') || line.startsWith('+++')) continue;
    const text = line.slice(1);
    if (DEFERRAL_MARKER_RE.test(text)) continue;
    if (line.startsWith('-')) hunk.removed.push(text);
    else if (line.startsWith('+')) hunk.added.push(text);
  }
  if (hunks.length === 0) return false;
  const digitless = (s: string): string => s.replace(/\d+/g, '0');
  return hunks.every(
    ({ removed, added }) =>
      removed.length === added.length && removed.every((r, i) => digitless(r) === digitless(added[i] ?? '')),
  );
}

/**
 * A prose path: anything under `docs/site/` ending `.md`/`.mdx`. JSON/JSON
 * schema artifacts under `docs/site/reference/` (S0a's family JSONs) are NOT
 * prose — a gate over them would demand a card on every generated artefact.
 * `.mdx` is covered from day one per D-Q6 (the D31 `.md`→`.mdx` flip must not
 * silently exit the gate).
 */
export function isDocsSiteProsePath(path: string): boolean {
  return /^docs\/site\/.*\.mdx?$/i.test(path);
}

const PLACEHOLDERS: ReadonlySet<string> = new Set([
  'todo',
  'later',
  'na',
  'n/a',
  'tbd',
  'fixme',
  'placeholder',
  '',
]);

export type ParsedCard =
  | { kind: 'absent' }
  /** `Docs-card: skipped — <reason>` — the escape hatch. */
  | { kind: 'skipped'; reason: string }
  /** A self-filled card: parsed entries + everything that failed validation. */
  | {
      kind: 'card';
      entries: ReadonlyMap<string, string>;
      missing: string[];
      invalid: string[];
      unknown: string[];
      duplicated: string[];
    };

/**
 * Parse and validate a `Docs-card:` trailer out of a commit body.
 *
 * Card form: comma-separated `C<n> <VALUE>` tokens covering all of C1..C13,
 * each value exactly one of PASS/FAIL/N/A (case-sensitive — the grammar is
 * machine-filled from the done-checklist; a sloppy fill is what the gate is
 * for). Escape form: `skipped` + separator + reason `>= DOCS_CARD_SKIP_MIN`
 * chars, placeholder rationales rejected (same list as prior-art).
 */
export function parseDocsCardTrailer(body: string): ParsedCard {
  const m = TRAILER_RE.exec(body);
  if (!m) return { kind: 'absent' };
  return parseDocsCardPayload(m[1] ?? '');
}

/** The payload grammar shared by `Docs-card:` and `Docs-card-for: <sha>`. */
function parseDocsCardPayload(raw: string): ParsedCard {
  const payload = raw.trim();

  if (payload.startsWith('skipped')) {
    // `skipped — <reason>`: strip the separator (em dash or `--`), keep the rest.
    // Length/placeholder validation lives in runDocsCardCheck (it owns reporting).
    const rationale = payload
      .slice('skipped'.length)
      .replace(/^[\s—–-]+/, '')
      .trim();
    return { kind: 'skipped', reason: rationale };
  }

  const entries = new Map<string, string>();
  const invalid: string[] = [];
  const unknown: string[] = [];
  const duplicated: string[] = [];
  for (const raw of payload.split(',')) {
    const token = raw.trim();
    if (token === '') continue;
    const tm = /^(C\d{1,2})\s+(\S+)$/i.exec(token);
    if (!tm) {
      invalid.push(token);
      continue;
    }
    const id = `C${Number(tm[1].slice(1))}`;
    const value = tm[2] ?? '';
    if (!DOCS_CARD_IDS.includes(id)) {
      unknown.push(token);
      continue;
    }
    if (!DOCS_CARD_VALUES.includes(value)) {
      invalid.push(token);
      continue;
    }
    if (entries.has(id)) {
      duplicated.push(id);
      continue;
    }
    entries.set(id, value);
  }
  const missing = DOCS_CARD_IDS.filter((id) => !entries.has(id));
  return { kind: 'card', entries, missing, invalid, unknown, duplicated };
}

/** One blocked commit. */
export interface DocsCardFailure {
  sha: string;
  reason: string;
  message: string;
}

/** What the check saw over the range. */
export interface DocsCardReport {
  /** Commits inspected (non-merge, in range). */
  checked: number;
  /** Of those, how many touched `docs/site/**` prose and thus owed a card. */
  proseCommits: number;
  failures: DocsCardFailure[];
}

/**
 * Is this commit a merge (authors no prose; its parents were each gated when
 * written)? Subject-based — the git convention `Merge …` — mirroring the
 * range walk's own tolerance for the squash-merge norm.
 */
export function isMergeCommit(subject: string): boolean {
  return /^Merge /i.test(subject);
}

/** Why a parsed card or escape fails the grammar, or null when it passes. */
function payloadProblem(parsed: ParsedCard): { reason: string; message: string } | null {
  if (parsed.kind === 'absent') return null;
  if (parsed.kind === 'skipped') {
    if (parsed.reason.length < DOCS_CARD_SKIP_MIN || PLACEHOLDERS.has(parsed.reason.toLowerCase())) {
      return {
        reason: 'escape rationale too short or placeholder',
        message: `\`Docs-card: skipped — ${parsed.reason}\` — rationale must be >=${DOCS_CARD_SKIP_MIN} chars and say why (not TODO/later/n-a/tbd/fixme/placeholder)`,
      };
    }
    return null;
  }
  const problems: string[] = [];
  if (parsed.missing.length > 0) problems.push(`missing card ids: ${parsed.missing.join(', ')}`);
  if (parsed.invalid.length > 0)
    problems.push(`invalid entries (want \`C<n> PASS|FAIL|N/A\`): ${parsed.invalid.join(', ')}`);
  if (parsed.unknown.length > 0) problems.push(`unknown entries: ${parsed.unknown.join(', ')}`);
  if (parsed.duplicated.length > 0) problems.push(`duplicated ids: ${parsed.duplicated.join(', ')}`);
  return problems.length > 0 ? { reason: 'malformed Docs-card trailer', message: problems.join('; ') } : null;
}

/**
 * The check: walk the range's commits, require a valid `Docs-card:` trailer on
 * every one that touches `docs/site/**` prose. Merge commits are skipped;
 * everything else with a prose path owes the card — its own, or a verified
 * `Docs-card-for:` claim from a later range commit (CLAIM_RE).
 */
export function runDocsCardCheck(
  commits: readonly string[],
  git: Pick<GitProvider, 'changedFiles' | 'commitBody' | 'commitSubject' | 'diffForPaths'>,
): DocsCardReport {
  const failures: DocsCardFailure[] = [];
  const isMerge = new Map(commits.map((sha) => [sha, isMergeCommit(git.commitSubject(sha))]));
  const prosePaths = new Map<string, string[]>();
  const own = new Map<string, ParsedCard>();
  for (const sha of commits) {
    if (isMerge.get(sha)) continue;
    prosePaths.set(sha, git.changedFiles(sha).map((f) => f.path).filter(isDocsSiteProsePath));
    own.set(sha, parseDocsCardTrailer(git.commitBody(sha)));
  }

  // Claims, each checked against the range before it may stand in for a trailer.
  const claims = new Map<string, ParsedCard>();
  for (const claimer of commits) {
    if (isMerge.get(claimer)) continue;
    for (const m of git.commitBody(claimer).matchAll(CLAIM_RE)) {
      const prefix = m[1] ?? '';
      const named = commits.filter((sha) => sha.startsWith(prefix));
      const target = named.length === 1 ? named[0] : undefined;
      const fail = (reason: string): void => {
        failures.push({ sha: claimer, reason, message: `\`Docs-card-for: ${prefix}\` — ${reason}` });
      };
      if (target === undefined) fail(named.length > 1 ? 'claim names an ambiguous sha prefix' : 'claim names a commit outside the range');
      else if (isMerge.get(target)) fail('claim names a merge commit, which owes no card');
      else if ((prosePaths.get(target) ?? []).length === 0) fail('claim names a commit that touches no docs/site prose');
      else if (own.get(target)?.kind !== 'absent') fail('claim names a commit that carries its own Docs-card trailer');
      else if (claims.has(target)) fail('more than one claim names this commit');
      else claims.set(target, parseDocsCardPayload(m[2] ?? ''));
    }
  }

  let checked = 0;
  let proseCommits = 0;
  for (const sha of commits) {
    if (isMerge.get(sha)) continue;
    checked++;
    const paths = prosePaths.get(sha) ?? [];
    if (paths.length === 0) continue;
    proseCommits++;
    const ownCard = own.get(sha) ?? { kind: 'absent' };
    const claim = claims.get(sha);
    if (ownCard.kind === 'absent' && claim === undefined) {
      failures.push({
        sha,
        reason: 'missing Docs-card trailer',
        message: 'commit touches docs/site/**/*.md prose but carries no `Docs-card:` trailer',
      });
      continue;
    }
    const parsed = claim ?? ownCard;
    const problem = payloadProblem(parsed);
    if (problem) {
      failures.push({ sha, ...problem });
      continue;
    }
    if (claim?.kind === 'skipped' && !isMechanicalProseDiff(git.diffForPaths(sha, paths))) {
      failures.push({
        sha,
        reason: 'skip claim on a commit whose prose diff is not mechanical',
        message:
          'a `Docs-card-for:` skip is accepted only when every changed prose line differs from its pair in digits alone, or is a docs-refresh deferral marker — this diff changes words, so the claim must carry the full card',
      });
    }
  }
  return { checked, proseCommits, failures };
}
