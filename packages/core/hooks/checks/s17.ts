/**
 * s17.ts — §1.7 discipline-trailer check (phase-research-coverage.md §1.7),
 * ported from bash in Wave 10.3. Faithful TS port of `s17_*` from the former
 * legacy-trailer-checks.sh (now deleted): detect rule/principle/SKILL-introducing
 * commits + validate the `§1.7:` forward/backward trailer, including the
 * Bootstrap exemption (B1), the Wave 8.3 file:line substance arm, and the
 * Wave 9.4 body-prose detection.
 *
 * Pure logic separated from git I/O via the injected GitProvider (utils/git.ts),
 * so this module is unit-testable + Stryker-mutatable without shelling out.
 */
import type { GitProvider } from '../utils/git.ts';

/** Wave 8.5 cutoff — commits authored before this bypass the check (rebase replay). */
export const S17_HISTORICAL_CUTOFF = '2026-05-12';

// D3 allow-list: doc-only / already-disciplined commit-subject prefixes bypass §1.7.
const ALLOWLIST_RE =
  /^(docs\(research-patches\)|chore\(snapshot-regen\)|chore\(prior-art-update\)):/;
// Discipline files (direct children only) whose introduction requires the trailer.
const DISCIPLINE_FILE_RE =
  /^(\.claude\/rules\/[^/]+\.md|packages\/core\/principles\/[^/]+\.test\.ts|\.claude\/skills\/[^/]+\/SKILL\.md)$/;
const DISCIPLINE_DIR_RE =
  /^(\.claude\/rules\/|packages\/core\/principles\/|\.claude\/skills\/)/;
// New section heading or top-level export const on an added diff line.
const SECTION_MARKER_RE = /^\+(## §|export const [A-Z_]+: )/;
const PLACEHOLDERS = new Set([
  'todo',
  'later',
  'na',
  'tbd',
  'fixme',
  'placeholder',
  '',
]);
/**
 * file:line citation — non-space chars, dot, lowercase ext, colon, digits.
 * THE shared §1.7 citation grammar (R-8): pr-body-fidelity.ts imports this exact
 * object rather than keeping its own divergent copy, so every §1.7-consumer judges
 * a citation identically. Keep the grammar case-sensitive on the extension.
 */
export const FILE_LINE_RE = /[^\s]+\.[a-z]+:[0-9]+/;
// §1.7 in discourse (not embedded in a URL/path): line start, or a non-slash char before.
const PROSE_S17_RE = /(^|[^/])§1\.7/;

/** Lowercase + strip ASCII punctuation only (matches bash `tr -d '[:punct:]'`). */
function stripPunctLower(word: string): string {
  return word.toLowerCase().replace(/[!-/:-@[-`{-~]/g, '');
}

/** True when every whitespace-token reduces to a placeholder word (bash all_placeholder=1). */
function isAllPlaceholder(text: string): boolean {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => PLACEHOLDERS.has(stripPunctLower(w)));
}

export interface S17Result {
  /** 0 = valid, 1 = no §1.7 anywhere, 2 = substance failure (no citation / prose-only). */
  code: 0 | 1 | 2;
  message: string;
}

/** Does this commit introduce/extend a rule, principle, or skill? */
export function isDisciplineIntroducing(sha: string, g: GitProvider): boolean {
  if (ALLOWLIST_RE.test(g.commitSubject(sha))) return false;
  const names = g.changedFiles(sha).map((c) => c.path);
  if (!names.some((n) => DISCIPLINE_FILE_RE.test(n))) return false;
  const rulePaths = names.filter((n) => DISCIPLINE_DIR_RE.test(n));
  if (rulePaths.length === 0) return false;
  return g
    .diffForPaths(sha, rulePaths)
    .split('\n')
    .some((line) => SECTION_MARKER_RE.test(line));
}

/** Validate the §1.7 trailer of a commit body. Pure — takes body + author date. */
export function checkS17TrailerBody(
  body: string,
  authorDate: string,
  cutoff: string = S17_HISTORICAL_CUTOFF,
): S17Result {
  if (authorDate && authorDate < cutoff) return { code: 0, message: '' };
  const lines = body.split('\n');

  // Bootstrap exemption B1: first `§1.7 Bootstrap:` line with ≥20 substantive chars.
  const bsLine = lines.find((l) => l.startsWith('§1.7 Bootstrap:'));
  if (bsLine) {
    const bs = bsLine.slice('§1.7 Bootstrap:'.length).replace(/^[ \t]+/, '');
    if (bs.length >= 20 && !isAllPlaceholder(bs))
      return { code: 0, message: '' };
  }

  // Standard `§1.7:` trailer.
  for (const line of lines) {
    if (!line.startsWith('§1.7:')) continue;
    const payload = line.slice('§1.7:'.length).replace(/^ /, '');
    if (payload.length < 40) continue;
    if (!isAllPlaceholder(payload)) {
      if (FILE_LINE_RE.test(payload)) return { code: 0, message: '' };
      return {
        code: 2,
        message:
          '§1.7: trailer present but lacks file:line citation (substance check — Wave 8.3)',
      };
    }
    // all-placeholder → fall through; the prose check below catches it
  }

  // Wave 9.4: §1.7 mentioned in prose (not a URL) but no valid trailer → substance failure.
  if (lines.some((l) => PROSE_S17_RE.test(l))) {
    return {
      code: 2,
      message:
        '§1.7 mentioned in commit body prose but no formal trailer line (substance check — Wave 9.4)',
    };
  }
  return { code: 1, message: 'no valid §1.7: trailer (or bootstrap)' };
}

export interface S17Finding {
  sha: string;
  message: string;
}
export interface S17Report {
  failures: S17Finding[]; // exit-1 class: no §1.7 trailer at all
  substanceFailures: S17Finding[]; // exit-2 class: present but lacks citation / prose-only
}

/** Run the §1.7 check over the given commits. Caller decides printing + warn-only. */
export function runS17Check(
  commits: readonly string[],
  g: GitProvider,
  cutoff: string = S17_HISTORICAL_CUTOFF,
): S17Report {
  const failures: S17Finding[] = [];
  const substanceFailures: S17Finding[] = [];
  for (const sha of commits) {
    if (!isDisciplineIntroducing(sha, g)) continue;
    const { code, message } = checkS17TrailerBody(
      g.commitBody(sha),
      g.authorDate(sha),
      cutoff,
    );
    if (code === 1) failures.push({ sha: sha.slice(0, 10), message });
    else if (code === 2)
      substanceFailures.push({ sha: sha.slice(0, 10), message });
  }
  return { failures, substanceFailures };
}
