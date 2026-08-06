/**
 * Principle 34 — claudeMdExcludes liveness (arch-v2 S-E P2a).
 *
 * The committed list `.claude/settings.json` `claudeMdExcludes` enumerates files the
 * CC client should NOT auto-load at session start. An inert entry (one whose pattern
 * matches ZERO files in the repo) is silent debt — the previous defect class
 * (relative-path-form excludes, pre-PR #1223) recurred if and only if no test
 * asserted the entries actually match real files.
 *
 * Mechanism (BEHAVIOURAL, not form-proxy — T-SE-A counter): for each entry in the
 * committed `claudeMdExcludes` list, picomatch-match it against the repo file tree
 * (absolute paths, {dot:true} so .claude/... paths are reachable). Any entry
 * whose match-count is ZERO fails, naming the entry. NO prefix-form check — the
 * double-asterisk-slash glob form (the live P1-list form) works via picomatch
 * semantics, NOT a normaliser (spec §2).
 *
 * Capability commit (per CLAUDE.md): pins picomatch@^4.0.4 in packages/core
 * devDeps + adds SSOT row #238. ADOPT verbatim — picomatch IS the matcher the
 * shipped CC client bundles; the explicit pin prevents transitive-matcher
 * semantics drift (the unpinned transitive at packages/core level could be
 * swapped by an upstream dep bump without our knowledge).
 *
 * Paired-negative N34-1 (anti-tautology, mirrors principle 31/35's N31/N35 pattern):
 * a fixture exclude entry shaped like `.claude/rules/nonexistent-XXX.md` (the
 * historical relative-path form) MUST make this check RED — proves the test
 * catches the defect class that motivated it. A test that passes on BOTH the live
 * double-asterisk-slash form AND the inert relative-path form is T-SE-A theatre.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-expect-error picomatch 4.x ships no type declarations; no @types/picomatch exists.
import picomatch from 'picomatch';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const SETTINGS_PATH = resolve(REPO_ROOT, '.claude/settings.json');

interface Settings {
  claudeMdExcludes?: string[];
}
function loadSettings(): Settings {
  return JSON.parse(readFileSync(SETTINGS_PATH, 'utf8')) as Settings;
}

/**
 * Enumerate the repo file tree as ABSOLUTE POSIX paths, from the GIT-TRACKED file
 * list (`git ls-files -z`).
 *
 * TWO deliberate properties, both of which a naive `readdirSync` walk got wrong
 * (fixed after the round-1 cold fidelity audit of this stage):
 *
 * 1. ABSOLUTE, not repo-relative. `claudeMdExcludes` patterns are matched by the
 *    CC client against absolute file paths (code.claude.com/docs/en/settings —
 *    "Patterns match against absolute file paths"), and the kickoff specifies the
 *    same. Matching relative paths is not merely a different convention: it makes
 *    the historical broken form self-matching, because
 *    `picomatch.isMatch('.claude/rules/x.md', '.claude/rules/x.md')` is TRUE while
 *    `picomatch.isMatch('/abs/.claude/rules/x.md', '.claude/rules/x.md')` is FALSE.
 *    A relative-path enumerator therefore reports ZERO dead entries for exactly the
 *    defect class this principle exists to catch — see N34-1 below, which is only
 *    reachable because of this line.
 *
 * 2. TRACKED files, not a filesystem walk. A walk that skips only `.git` and
 *    `node_modules` descends into gitignored nested worktrees under
 *    `.claude/worktrees/` — on the maintainer's primary checkout that is ~293k
 *    files (~11 s) and, worse, it MASKS deletions: a rule deleted from the tracked
 *    tree still matches through a stale copy inside another worktree, so a dead
 *    entry reads as live. `git ls-files` is the honest population for "the repo
 *    file tree" and is what makes the check see the tree the client will see.
 */
function enumerateRepoFiles(): string[] {
  const out = execFileSync('git', ['ls-files', '-z'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return out
    .split('\0')
    .filter((p) => p.length > 0)
    .map((p) => `${REPO_ROOT}/${p.split('\\').join('/')}`);
}

describe('Principle 34 — claudeMdExcludes liveness (every entry matches ≥1 file)', () => {
  const settings = loadSettings();
  const excludes: string[] = Array.isArray(settings.claudeMdExcludes)
    ? settings.claudeMdExcludes
    : [];

  it('claudeMdExcludes is a non-empty array (the list exists to be checked)', () => {
    expect(excludes.length).toBeGreaterThan(0);
  });

  it('every committed exclude matches at least one repo file (picomatch {dot:true})', () => {
    const files = enumerateRepoFiles();
    expect(files.length).toBeGreaterThan(0);
    const dead: string[] = [];
    for (const entry of excludes) {
      // picomatch.isMatch signature: (STRING, PATTERNS, OPTIONS) — STRING first.
      // {dot:true} is REQUIRED so `**/foo.md` can reach files under dot-directories
      // like `.claude/rules/foo.md` (verified via the live isMatch probe at authoring
      // time: `{dot:true}` is the difference between match=true and match=false for
      // `.claude/...` paths under a `**/<name>.md` pattern).
      const matched = files.some((f) =>
        picomatch.isMatch(f, entry, { dot: true }),
      );
      if (!matched) dead.push(entry);
    }
    expect(dead, `inert claudeMdExcludes entries (match 0 repo files): ${dead.join(', ')}`).toEqual([]);
  });
});

describe('Principle 34 — paired-negative N34-1 (the check catches inert entries)', () => {
  // The defect class this principle guards against: an entry whose pattern matches
  // ZERO files in the repo (silently no-ops the exclude). The historical instance
  // was a list of relative-path-form entries that the client did not resolve. Any
  // future inert entry — relative-path, typo, deleted-file, stale rename — must
  // fail this check. N34-1 proves the check actually fails on a known-inert input:
  // a fixture entry naming a file that does not exist in the repo. A test that
  // passes on a known-inert input is non-discriminating (T-SE-A theatre).

  it('N34-1a: the LIVE list rewritten to the historical relative-path form is ALL dead', () => {
    // THE mandated FAIL leg (kickoff §3): take the real committed list and rewrite
    // each entry back to the historical relative-path form `.claude/rules/<name>.md`
    // — the exact shape that silently no-opped before PR #1223 — and assert EVERY
    // rewritten entry is reported dead.
    //
    // This leg is the whole point of the principle, and it is UNREACHABLE unless
    // enumerateRepoFiles() emits absolute paths: against repo-relative paths the
    // historical form matches itself, so a relative-path enumerator reports 0 dead
    // here and the check passes on both the working and the broken form — T-SE-A
    // theatre, and precisely the defect the round-1 cold fidelity audit caught.
    const files = enumerateRepoFiles();
    expect(files.length).toBeGreaterThan(0);

    const s = loadSettings();
    const excludes: string[] = Array.isArray(s.claudeMdExcludes)
      ? s.claudeMdExcludes
      : [];
    expect(excludes.length).toBeGreaterThan(0);

    const historical = excludes.map((e) =>
      `.claude/rules/${e.replace(/^\*\*\//, '')}`,
    );
    // Guard: the rewrite must actually have changed every entry, otherwise this
    // leg is vacuous (e.g. if the committed list ever stops using the `**/` form).
    expect(
      historical.every((h, i) => h !== excludes[i]),
      'N34-1a: rewrite produced an entry identical to the live one — the fixture no longer represents the historical form; update the rewrite.',
    ).toBe(true);

    const dead = historical.filter(
      (entry) => !files.some((f) => picomatch.isMatch(f, entry, { dot: true })),
    );
    expect(
      dead,
      `N34-1a: the historical relative-path form must be detected as INERT for every entry. ` +
        `Live entries: ${excludes.length}; detected dead: ${dead.length}. ` +
        `If this is empty, the enumerator is emitting relative paths and the check cannot ` +
        `discriminate the working form from the broken one.`,
    ).toHaveLength(excludes.length);

    // And the positive direction on the same population, so the leg proves a
    // DIFFERENCE rather than "nothing matches anything".
    const liveDead = excludes.filter(
      (entry) => !files.some((f) => picomatch.isMatch(f, entry, { dot: true })),
    );
    expect(
      liveDead,
      `N34-1a: the LIVE form must match real files on the same population — ` +
        `if both forms are dead the fixture proves nothing.`,
    ).toEqual([]);
  });

  it('N34-1: a fixture inert entry (matches 0 repo files) is detected as dead', () => {
    const files = enumerateRepoFiles();
    // Fixture: an exclude entry that is well-formed (right glob form) but names
    // a file that does not exist anywhere in the repo. Verified non-existent at
    // authoring time; if a file with this name ever lands, the fixture must be
    // renamed (the test fails loudly — the alternative is silent theatre).
    const fixture = '**/nonexistent-fixture-entry-zzz-n34-1.md';
    // Sanity: assert the fixture file truly does not exist; otherwise N34-1 is moot.
    const exists = files.some((f) => f.endsWith('/nonexistent-fixture-entry-zzz-n34-1.md') || f === 'nonexistent-fixture-entry-zzz-n34-1.md');
    expect(exists,
      `N34-1 fixture file unexpectedly exists in the repo — rename the fixture to a guaranteed-non-existent name.`,
    ).toBe(false);

    const matched = files.some((f) => picomatch.isMatch(f, fixture, { dot: true }));
    expect(matched,
      `N34-1: picomatch.isMatch unexpectedly returned true for a non-existent fixture entry. ` +
      `The liveness check would not catch inert entries — the principle is theatre.`,
    ).toBe(false);

    // The liveness check (same logic as the positive test above) over a list
    // containing ONLY the fixture entry must surface it as dead.
    const dead: string[] = [];
    for (const entry of [fixture]) {
      const m = files.some((f) => picomatch.isMatch(f, entry, { dot: true }));
      if (!m) dead.push(entry);
    }
    expect(dead).toEqual([fixture]);
  });
});
