/**
 * rule-channel-glob — shared header-marker parsing + glob-subset grammar + liveness checks
 * for rule-channel declarations (`> **Class:**`/`> **Fires:**` headers, `paths:` frontmatter,
 * `<!-- globs: -->` / `<!-- channel: -->` / `<!-- glob-liveness: -->` markers).
 *
 * WHY EXTRACTED: this logic previously lived only inline in scripts/render-rule-index.mjs
 * (CTX Stage 1). Principle 31 (CTX Stage 2, the gate-on-the-gate) needs the IDENTICAL
 * marker-parsing + subset-grammar + set-equality + liveness checks to validate the same
 * `paths:`/`globs:`/`channel:` declarations on every rule file — copying the logic would be
 * `#sync-by-copy-paste` (dual-implementation-discipline.md §8): two independent copies of
 * "what counts as a valid glob subset" or "how a channel marker is parsed" would drift the
 * moment one is edited without the other. This module is the single source of truth; BOTH
 * scripts/render-rule-index.mjs and packages/core/principles/31-rule-channel-declaration.ts
 * import it.
 *
 * Grammar mirrors .claude/hooks/inject-matching-rule.sh:44-51 glob_match: `prefix/**` (prefix
 * may contain slashes, e.g. ".github/workflows/**"), `*.ext` (suffix match), or an exact path —
 * each alternative anchored so a pattern must be wholly one shape, never a mix.
 */
import { execFileSync } from 'node:child_process';

/** Extract the first `> **Key:** value` line's value (may span the rest of that single line). */
export function extractHeaderField(source: string, key: string): string | null {
  const re = new RegExp(`^>\\s*\\*\\*${key}:\\*\\*\\s*(.+)$`, 'm');
  const m = source.match(re);
  return m ? m[1].trim() : null;
}

/** Parse YAML frontmatter `paths:` list (simple `- "..."` / `- '...'` / `- ...` lines only). */
export function extractFrontmatterPaths(source: string): string[] | null {
  const fmMatch = source.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return null;
  const fm = fmMatch[1];
  const pathsMatch = fm.match(/^paths:\n((?:\s*-\s*.+\n?)+)/m);
  if (!pathsMatch) return null;
  return pathsMatch[1]
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('-'))
    .map((l) => l.replace(/^-\s*/, '').replace(/^['"]|['"]$/g, '').trim())
    .filter(Boolean);
}

/** Parse the `<!-- globs: a, b, c -->` marker (comma-separated glob subset). */
export function extractGlobsMarker(source: string): string[] | null {
  const m = source.match(/^[ \t]*<!--[ \t]*globs:(.*?)-->/m);
  if (!m) return null;
  return m[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Parse ALL `<!-- channel: <mechanism> <artifact>#<anchor> -->` markers (a rule may carry several). */
export function extractChannelMarkers(source: string): string[] {
  const out: string[] = [];
  const re = /^[ \t]*<!--[ \t]*channel:(.*?)-->/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const val = m[1].trim();
    if (val) out.push(val);
  }
  return out;
}

/**
 * Parse `<!-- glob-liveness: allow <pattern> <reason> -->` escape-hatch markers (mirrors the
 * ci-tool-pinning.md §3 `# ci-tool-pin: allow <reason>` idiom): a rule author declares — inline,
 * visibly, with a reason — that a specific paths:/globs: pattern is intentionally forward-scoped
 * (e.g. a directory that will hold files once a feature ships) and should not fail the liveness
 * check today. Keyed by the exact pattern string so the exemption is scoped, not blanket.
 */
export function extractLivenessExemptions(source: string): Set<string> {
  const out = new Set<string>();
  const re = /^[ \t]*<!--[ \t]*glob-liveness:[ \t]*allow[ \t]+(\S+)(?:[ \t]+.*)?-->/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) out.add(m[1]);
  return out;
}

/** One `<!-- channel: <mechanism> <artifact-path>#<anchor> -->` marker, parsed into parts. */
export interface ParsedChannelMarker {
  mechanism: string;
  artifactPath: string;
  anchor: string | null;
  raw: string;
}

/**
 * Parse a single channel-marker value string (the captured group of extractChannelMarkers,
 * e.g. "skill-embed .claude/skills/harvest/SKILL.md#egress") into mechanism/artifact/anchor.
 * Returns null if the value does not carry at least a mechanism + an artifact-path token —
 * the exception per rule-channel-declaration.md MUST name the artifact.
 */
export function parseChannelMarker(value: string): ParsedChannelMarker | null {
  const parts = value.trim().split(/\s+/);
  if (parts.length < 2) return null;
  const [mechanism, target] = parts;
  if (!target) return null;
  const hashIdx = target.indexOf('#');
  if (hashIdx === -1) return { mechanism, artifactPath: target, anchor: null, raw: value };
  return {
    mechanism,
    artifactPath: target.slice(0, hashIdx),
    anchor: target.slice(hashIdx + 1) || null,
    raw: value,
  };
}

/** One glob-subset token check: prefix/** | *.ext | exact. */
export const GLOB_SUBSET_RE = /^(?:[^*]+\/\*\*|\*\.[^*/]+|[^*]+)$/;

export function isSubsetGlob(pattern: string): boolean {
  return GLOB_SUBSET_RE.test(pattern);
}

/**
 * An exact-path pattern that is deliberately gitignored (a per-consumer scaffold file this
 * repo never creates, e.g. `.ai-factory/research-allowlist.json` per .gitignore) is not "dead"
 * in the typo/broken-reference sense — it is a legitimate target that will only exist
 * post-install. Detected via `git check-ignore` (deterministic, no hardcoded allowlist).
 */
export function isDeliberatelyGitignoredExact(root: string, pattern: string): boolean {
  if (pattern.includes('*')) return false; // only applies to exact-path patterns
  try {
    execFileSync('git', ['check-ignore', '-q', pattern], { cwd: root });
    return true; // exit 0 = ignored
  } catch {
    return false; // exit 1 = not ignored, or git unavailable
  }
}

/** Does `pattern` (prefix/** | *.ext | exact) match at least one tracked file? */
export function globHasLiveMatch(root: string, pattern: string): boolean {
  let tracked: string[];
  try {
    tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
  } catch {
    return true; // no git available — cannot assert liveness; do not false-fail
  }
  if (pattern.endsWith('/**')) {
    const prefix = pattern.slice(0, -2); // keep trailing '/'
    return tracked.some((f) => f.startsWith(prefix));
  }
  if (pattern.startsWith('*.')) {
    const ext = pattern.slice(1);
    return tracked.some((f) => f.endsWith(ext));
  }
  if (tracked.includes(pattern)) return true;
  return isDeliberatelyGitignoredExact(root, pattern);
}

export interface GlobParityRule {
  name: string;
  paths: readonly string[] | null;
  globsMarker: readonly string[] | null;
  livenessExemptions?: ReadonlySet<string>;
}

/**
 * §(iii)-equivalent cross-check: `paths:` vs `<!-- globs: -->` must be SET-EQUAL,
 * subset-grammar, and LIVE (unless a per-pattern `<!-- glob-liveness: allow <pattern> <reason>
 * --> ` escape hatch is present). Returns a list of human-readable error strings (empty = ok).
 * Shared verbatim between the renderer (--check drift) and principle 31 (gate).
 */
export function checkPathsGlobsParity(rule: GlobParityRule, root: string): string[] {
  const errs: string[] = [];
  const livenessExemptions = rule.livenessExemptions ?? new Set<string>();
  if (!rule.paths || !rule.globsMarker) return errs; // only applies when BOTH present
  const a = new Set(rule.paths);
  const b = new Set(rule.globsMarker);
  if (a.size !== b.size || [...a].some((p) => !b.has(p))) {
    errs.push(
      `${rule.name}.md: paths: [${rule.paths.join(', ')}] != globs: [${rule.globsMarker.join(', ')}] — the two glob sets must be identical (rule-enforcement-channel-selection.md §4 dual-pair invariant)`,
    );
  }
  for (const pat of new Set([...rule.paths, ...rule.globsMarker])) {
    if (!isSubsetGlob(pat)) {
      errs.push(
        `${rule.name}.md: pattern "${pat}" is not in the supported subset (prefix/**, *.ext, or exact)`,
      );
      continue;
    }
    if (!globHasLiveMatch(root, pat) && !livenessExemptions.has(pat)) {
      errs.push(
        `${rule.name}.md: pattern "${pat}" matches NO tracked file (dead glob) — add <!-- glob-liveness: allow ${pat} <reason> --> if intentionally forward-scoped`,
      );
    }
  }
  return errs;
}
