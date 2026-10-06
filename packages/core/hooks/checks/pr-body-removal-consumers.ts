/**
 * pr-body-removal-consumers.ts — the `## Removal consumers` PR-body gate
 * (.claude/rules/build-first-reuse-default.md §3.1). Pure logic; the CI entrypoint is
 * pr-body-removal-consumers-bin.ts, run as a step of the registered
 * `stale-revert-in-pr-diff` job in .github/workflows/pr-stale-revert.yml.
 *
 * Rule: a PR that deletes a shipped file — anything under packages/core/templates/ or
 * .ai-factory/ — must carry a `## Removal consumers` section with one row per deleted
 * path. The row names the path — in full, or by basename when no other deleted path
 * shares it — as a whole token, and either cites a consumer as `path:NN` (a file with
 * an extension or a directory part, and not one of the files this PR deletes) or
 * declares `no consumers — <rationale ≥20 chars>`.
 *
 * Why (incident 2026-09-28, one-button round 2): a drop proposal for the AIF passport
 * files went to «confirm the table» with no consumer map. Hidden consumers existed —
 * install.sh detected the stack from the PRESENCE of `ARCHITECTURE.react-*.md`, and 16
 * AIF skills read the files. The gate checks FORM only (a row exists, a consumer is
 * cited); whether the drop-vs-slim consequences are right stays review judgment.
 *
 * A rename counts as a removal of the old name: consumers find a file by its name, so
 * the bin reads the diff with `--no-renames` (a rename arrives here as D + A).
 */

/** Shipped roots whose deletion demands a consumer map. */
export const SHIPPED_REMOVAL_ROOTS = ['packages/core/templates/', '.ai-factory/'] as const;

const HEADING = /^## Removal consumers\s*$/;
/**
 * `path:NN`. The path needs an extension (`lib.sh:928`) or a directory part
 * (`.husky/pre-push:40`); a URL (`http://host:8080`) is not a citation.
 */
const CITATION = /([^\s`|()[\]<>]+):\d+/g;
const DELIM = '[\\s`|()[\\]<>,;:*"\']';
const ESCAPE = /\bno consumers\s*[—–-]+\s*(\S.*)$/i;
const MIN_ESCAPE_RATIONALE = 20;

export interface RemovalConsumersResult {
  ok: boolean;
  /** Deleted shipped paths — the population the section must cover. */
  removed: string[];
  /** Removed paths with no qualifying row. */
  missing: string[];
  message: string;
}

/** Deleted paths under a shipped root, from parsed `--name-status --no-renames` output. */
export function shippedRemovals(
  entries: readonly { status: string; path: string }[],
): string[] {
  return entries
    .filter((e) => e.status.startsWith('D'))
    .map((e) => e.path)
    .filter((p) => SHIPPED_REMOVAL_ROOTS.some((root) => p.startsWith(root)));
}

/** Lines of the `## Removal consumers` section (up to the next `## ` heading), or null. */
function sectionLines(body: string): string[] | null {
  const lines = body.split('\n');
  const start = lines.findIndex((l) => HEADING.test(l));
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^## /.test(l));
  return end === -1 ? rest : rest.slice(0, end);
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

function escapeRe(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** `name` occurs in `line` as a whole token — not as a substring of a longer name. */
function hasToken(line: string, name: string): boolean {
  return new RegExp(`(^|${DELIM}|/)${escapeRe(name)}($|${DELIM})`).test(line);
}

function isCitablePath(token: string): boolean {
  return !token.includes('://') && (/\.[A-Za-z0-9]+$/.test(token) || token.includes('/'));
}

/** A file this PR deletes (full path or path suffix) is not a consumer of anything. */
function isRemoved(cited: string, removed: readonly string[]): boolean {
  return removed.some(
    (r) => cited === r || r.endsWith(`/${cited}`) || cited.endsWith(`/${r}`),
  );
}

function rowQualifies(line: string, path: string, removed: readonly string[]): boolean {
  const base = basename(path);
  const baseIsUnique = removed.filter((r) => basename(r) === base).length === 1;
  if (!hasToken(line, path) && !(baseIsUnique && hasToken(line, base))) return false;
  const escape = ESCAPE.exec(line);
  if (escape && (escape[1] ?? '').trim().length >= MIN_ESCAPE_RATIONALE) return true;
  for (const m of line.matchAll(CITATION)) {
    const cited = m[1] ?? '';
    if (isCitablePath(cited) && !isRemoved(cited, removed)) return true;
  }
  return false;
}

export function checkRemovalConsumers(
  body: string,
  entries: readonly { status: string; path: string }[],
  strip: (text: string) => string,
): RemovalConsumersResult {
  const removed = shippedRemovals(entries);
  if (removed.length === 0) {
    return { ok: true, removed, missing: [], message: 'no shipped file deleted' };
  }
  const lines = sectionLines(strip(body));
  if (lines === null) {
    return {
      ok: false,
      removed,
      missing: removed,
      message: `PR deletes ${removed.length} shipped file(s) but has no \`## Removal consumers\` section: ${removed.join(', ')}`,
    };
  }
  const missing = removed.filter((p) => !lines.some((l) => rowQualifies(l, p, removed)));
  return missing.length === 0
    ? { ok: true, removed, missing, message: `consumer map covers ${removed.length} deletion(s)` }
    : {
        ok: false,
        removed,
        missing,
        message: `\`## Removal consumers\` has no qualifying row for: ${missing.join(', ')}`,
      };
}
