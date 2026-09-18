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
  const payload = (m[1] ?? '').trim();

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

/**
 * The check: walk the range's commits, require a valid `Docs-card:` trailer on
 * every one that touches `docs/site/**` prose. Merge commits are skipped;
 * everything else with a prose path owes the card.
 */
export function runDocsCardCheck(
  commits: readonly string[],
  git: Pick<GitProvider, 'changedFiles' | 'commitBody' | 'commitSubject'>,
): DocsCardReport {
  const failures: DocsCardFailure[] = [];
  let checked = 0;
  let proseCommits = 0;
  for (const sha of commits) {
    if (isMergeCommit(git.commitSubject(sha))) continue;
    checked++;
    const touchesProse = git
      .changedFiles(sha)
      .some((f) => isDocsSiteProsePath(f.path));
    if (!touchesProse) continue;
    proseCommits++;
    const parsed = parseDocsCardTrailer(git.commitBody(sha));
    if (parsed.kind === 'absent') {
      failures.push({
        sha,
        reason: 'missing Docs-card trailer',
        message:
          'commit touches docs/site/**/*.md prose but carries no `Docs-card:` trailer',
      });
      continue;
    }
    if (parsed.kind === 'skipped') {
      if (
        parsed.reason.length < DOCS_CARD_SKIP_MIN ||
        PLACEHOLDERS.has(parsed.reason.toLowerCase())
      ) {
        failures.push({
          sha,
          reason: 'escape rationale too short or placeholder',
          message: `\`Docs-card: skipped — ${parsed.reason}\` — rationale must be >=${DOCS_CARD_SKIP_MIN} chars and say why (not TODO/later/n-a/tbd/fixme/placeholder)`,
        });
      }
      continue;
    }
    const problems: string[] = [];
    if (parsed.missing.length > 0)
      problems.push(`missing card ids: ${parsed.missing.join(', ')}`);
    if (parsed.invalid.length > 0)
      problems.push(
        `invalid entries (want \`C<n> PASS|FAIL|N/A\`): ${parsed.invalid.join(', ')}`,
      );
    if (parsed.unknown.length > 0)
      problems.push(`unknown entries: ${parsed.unknown.join(', ')}`);
    if (parsed.duplicated.length > 0)
      problems.push(`duplicated ids: ${parsed.duplicated.join(', ')}`);
    if (problems.length > 0) {
      failures.push({
        sha,
        reason: 'malformed Docs-card trailer',
        message: problems.join('; '),
      });
    }
  }
  return { checked, proseCommits, failures };
}
