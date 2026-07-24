/**
 * Principle 11 — Build-first reuse-default invariant
 *
 * Source: .claude/rules/build-first-reuse-default.md (companion rule)
 *         docs/meta-factory/research-patches/2026-05-16-principle-11-q1q5-evidence.md
 *
 * Invariant: every capability artifact in the repo (per design §2 detection list) has
 * EITHER (a) an SSOT entry in docs/meta-factory/prior-art-evaluations.md with an
 * explicit BFR verdict (one of seven from rule §1), OR (b) a non-placeholder Prior-art
 * trailer in its introducing commit.
 *
 * Failure modes (per design §4):
 *   F1 — capability artifact has neither SSOT entry nor Prior-art trailer
 *   F2 — SSOT entry exists but lacks explicit verdict from rule §1
 *   F3 — Prior-art trailer rationale <20 chars or matches placeholder patterns
 *
 * Grandfather threshold: BFR rule introduction commit 809d7eb (2026-05-16T18:06:12+03:00);
 * artifacts whose introducing-commit-date is strictly before this are exempt from F1/F3.
 * Uncommitted files (no introducing commit detectable) are also treated as grandfathered
 * (safe default — avoids false-positive on edge cases; research-patch §2.2 gap accepted).
 *
 * Capability set (design §2):
 *   - .claude/rules/*.md
 *   - .claude/skills/<name>/SKILL.md
 *   - agents/\*.md
 *   - packages/core/\*\*\/\*.ts ≥50 LOC (non-test)
 *   - packages/\*\*\/\*.ts ≥80 LOC (non-test, non-node_modules)
 *   Note: package.json dep enumeration deferred; pre-push hook is HOT enforcement.
 *
 * Capability set intentionally excludes *.test.ts / *.spec.ts / __tests__ files.
 * Principle test files (packages/core/principles/*.test.ts) are handled by the
 * self-application case 7 separately. Heuristic SSOT matching disabled for principle
 * tests to prevent companion-rule entry from vacuously satisfying the test file —
 * the anti-cross-match rule (design §3). Case 7 is gated on SELF_APPLICATION_VERIFY
 * env var (must be 'post-commit') because git log cannot detect the introducing commit
 * until after the file is actually committed.
 *
 * Capability-set divergence from .husky/pre-push:
 *   pre-push detects: new dep | packages/core/<new-subdir>/\*.ts ≥50 LOC | packages/\*\*\/\*.ts ≥80 LOC
 *   principle 11 adds: .claude/rules/\*.md | .claude/skills/\*\/SKILL.md | agents/\*.md
 *   This is intentional per research-patch §2.2 — principle 11 enforces broader aggregate
 *   scope; pre-push is the HOT narrow-scope gate at commit time.
 *
 * SSOT verdict calibration 2026-05-17 (reflected in VERDICTS set):
 *   REFERENCE and KEEP-NARROW retained as forward-compatible (in rule §1 but no current SSOT use).
 *   DEFER/WATCHLIST/ADOPT-CONDITIONAL/ADOPT WHEN TRIGGERED added as observed SSOT variants.
 *   If new verdict-keyword appears in SSOT and is NOT in VERDICTS, F2 fires — extend VERDICTS
 *   in same PR as the new verdict introduction.
 *
 * Recursive self-application: principle 11's own test file is itself a capability
 * artifact and must pass the invariant (verified post-commit via case 7).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, dirname, relative, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const SSOT_PATH = resolve(REPO_ROOT, 'docs/meta-factory/prior-art-evaluations.md');
const RULES_DIR = resolve(REPO_ROOT, '.claude/rules');
const SKILLS_DIR = resolve(REPO_ROOT, '.claude/skills');
const AGENTS_DIR = resolve(REPO_ROOT, 'agents');
const PACKAGES_DIR = resolve(REPO_ROOT, 'packages');

const GRANDFATHER_COMMIT = '809d7eb';

const VERDICTS = new Set([
  // Seven from rule §1
  'ADOPT',
  'ADOPT VOCABULARY',
  'ADOPT-VOCABULARY',
  'ADAPT',
  'REFERENCE',
  'KEEP NARROW',
  'KEEP-NARROW',
  'BUILD',
  'REJECT',
  // Observed SSOT variants beyond rule §1 (calibration 2026-05-17)
  'DEFER',
  'WATCHLIST',
  'ADOPT-CONDITIONAL',
  'ADOPT WHEN TRIGGERED',
  // Composite verdict — a REFERENCE-half + BUILD-half decision (first use: SSOT #117, the
  // brownfield CI-wiring resolver: REFERENCE yq opt-in + BUILD the zero-dep WARN/paste-block).
  // The kickoff frames the R-phase fork as "ADOPT vs BUILD vs HYBRID"; registered here per the
  // line-47 "extend VERDICTS when a new keyword appears" instruction (2026-06-14).
  'HYBRID',
  // ADAPT base verdict upgraded with a generative-automation residue (SSOT #115, 2026-06-17):
  // the manual-rule-liveness prober's RED→GREEN methodology stays ADAPT, and the #552-flip I-phase
  // built a pressure-scenario generator on top of it. Registered per the line-47 extend-VERDICTS
  // instruction (first use: SSOT #115).
  'ADAPT+generative',
]);

/** Placeholder words for F3 validation — mirrors pre-push hook pa_check_trailer logic. */
const PLACEHOLDER_WORDS = new Set(['todo', 'later', 'tbd', 'fixme', 'na', 'placeholder', 'skipped']);

/**
 * Git-hook-safe environment: a copy of process.env with the git dir/work-tree
 * variables removed. Under `.husky/pre-push` git exports GIT_DIR (and friends),
 * which override `cwd` in execSync — so any subprocess that must act on a
 * DIFFERENT repository (the throwaway repos in the awkward-case tests, or
 * `getPriorArtTrailerAt(repoRoot, ...)` pointed elsewhere) would silently target
 * the outer repo. Scrubbing these variables restores the cwd-honouring behaviour.
 */
const GIT_ENV_SCRUB = (() => {
  const env = { ...process.env };
  for (const k of [
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_INDEX_FILE',
    'GIT_OBJECT_DIRECTORY',
    'GIT_ALTERNATE_OBJECT_DIRECTORIES',
    'GIT_COMMON_DIR',
    'GIT_NAMESPACE',
  ]) {
    delete env[k];
  }
  return env;
})();

function readFile(p: string): string {
  return readFileSync(p, 'utf8');
}

function git(cmd: string): string {
  return execSync(cmd, { encoding: 'utf8', cwd: REPO_ROOT }).trim();
}

function getGrandfatherDate(): Date {
  try {
    return new Date(git(`git show --format=%ai -s ${GRANDFATHER_COMMIT}`));
  } catch {
    // SHA absent in shallow CI clones — fall back to known commit timestamp.
    return new Date('2026-05-16T15:06:12Z');
  }
}

// ── Capability file enumeration ───────────────────────────────────────────────

function getCapabilityFiles(): string[] {
  const seen = new Set<string>();

  if (existsSync(RULES_DIR)) {
    for (const f of readdirSync(RULES_DIR)) {
      if (f.endsWith('.md')) seen.add(resolve(RULES_DIR, f));
    }
  }

  if (existsSync(SKILLS_DIR)) {
    for (const d of readdirSync(SKILLS_DIR, { withFileTypes: true })) {
      if (d.isDirectory()) {
        const skillMd = resolve(SKILLS_DIR, d.name, 'SKILL.md');
        if (existsSync(skillMd)) seen.add(skillMd);
      }
    }
  }

  if (existsSync(AGENTS_DIR)) {
    for (const f of readdirSync(AGENTS_DIR)) {
      if (f.endsWith('.md')) seen.add(resolve(AGENTS_DIR, f));
    }
  }

  collectTsCapabilities(PACKAGES_DIR, seen);
  return [...seen].sort();
}

function collectTsCapabilities(pkgsRoot: string, seen: Set<string>): void {
  const coreRoot = resolve(pkgsRoot, 'core');
  for (const d of readdirSync(pkgsRoot, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const pkgDir = resolve(pkgsRoot, d.name);
    const minLoc = pkgDir === coreRoot ? 50 : 80;
    collectTsFiles(pkgDir, minLoc, seen);
  }
}

function collectTsFiles(dir: string, minLoc: number, seen: Set<string>): void {
  if (dir.endsWith('/node_modules') || dir.includes('/node_modules/')) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      collectTsFiles(full, minLoc, seen);
    } else if (
      entry.isFile() &&
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith('.spec.ts') &&
      !dir.endsWith('/__tests__') &&
      !dir.includes('/__tests__/')
    ) {
      const loc = readFile(full).split('\n').length;
      if (loc >= minLoc) seen.add(full);
    }
  }
}

// ── Trailer logic ─────────────────────────────────────────────────────────────

type TrailerResult = '__grandfathered__' | '__no-introducing-commit__' | null | string;

// ── Single-call trailer lookup ────────────────────────────────────────────────
// Replaces the legacy 3-spawn-per-file pattern:
//   git log --diff-filter=A --format=%H -1 -- <path>     (expensive history walk)
//   git show --format=%ai -s <sha>                       (direct lookup, cheap)
//   git show --format=%B -s <sha>                        (direct lookup, cheap)
// with ONE `git log --diff-filter=A --format='%H%n%ai%n%B' -1 -- <path>` that
// returns sha, date, and body in a single walk. The expensive part (the walk
// itself, with pathspec history-simplification) is unchanged; the savings come
// from eliminating 2 of 3 subprocess spawns × 228 files. Container timing
// (Linux overlayfs): ~5.0s single-call vs ~8.5s legacy-3-call (1.7×); on the
// operator's macOS host: ~17.7s vs ~26s (1.47×). The host is the gate's
// destination environment — see the F1 budget note below.
//
// Why NOT batched-map (one `git log --diff-filter=A --name-only` walk for all
// files at once)? `git log --diff-filter=A --name-only` (no pathspec) produces
// a DIFFERENT result from `git log --diff-filter=A -- <path>` for squash-promote
// commits: the unfiltered walk shows phantom add-events from "Promote staging →
// main" squash commits (which re-add every file from staging against a main
// parent that didn't have them); the pathspec-filtered walk applies git's
// history simplification and prunes them. Verified empirically 2026-07-24:
// phantom-add mismatches on 4+ capability files per batched-walk variant
// tried (with promote-skip heuristic, with --full-history, etc.); 0 mismatches
// with the single-call approach. There is no way to replicate git's
// pathspec-simplification semantics in a single non-pathspec walk without
// re-implementing git's history-walk algorithm in JS — not worth the complexity
// for a modest (~1.5-1.7×, environment-dependent) vs theoretical-higher speedup
// delta. The single-call approach is
// correct by construction (it IS the same `git log -- <path>` walk, just with
// a different output format).
//
// Origin: kickoff `.ai-factory/plans/principle11-batch-lookup.md` §1-§2.

/**
 * Parse the output of `git log --diff-filter=A --format='%H%n%ai%n%B' -1` into
 * sha / date / body. Returns null if the output is empty (no add-event).
 *
 * Format: `<sha>\n<date>\n<body...>` where body is multiline and ends with
 * `%B`'s trailing newline. We slice on the first two newlines; body is the
 * remainder (trailing newline is harmless for the `Prior-art:` line filter).
 */
export function parseSingleCallGitLog(out: string): { sha: string; date: Date; body: string } | null {
  if (!out) return null;
  const nl1 = out.indexOf('\n');
  const nl2 = out.indexOf('\n', nl1 + 1);
  // Defensive: a single-line output (sha only, no date/body) means git emitted
  // something unusual — treat as no add-event rather than crash on -1 indexes.
  if (nl1 === -1 || nl2 === -1) return null;
  const sha = out.slice(0, nl1);
  const dateStr = out.slice(nl1 + 1, nl2);
  const body = out.slice(nl2 + 1);
  return { sha, date: new Date(dateStr), body };
}

/**
 * The single-call trailer lookup. `repoRoot` is a parameter (not hardcoded)
 * so the awkward-case tests can point it at a throwaway git repo.
 */
export function getPriorArtTrailerAt(
  repoRoot: string,
  filePath: string,
  grandfatherDate: Date,
): TrailerResult {
  const relPath = relative(repoRoot, filePath);
  const out = execSync(
    `git log --diff-filter=A --format='%H%n%ai%n%B' -1 -- "${relPath}"`,
    { encoding: 'utf8', cwd: repoRoot, maxBuffer: 50 * 1024 * 1024, env: GIT_ENV_SCRUB },
  );
  const parsed = parseSingleCallGitLog(out);
  if (!parsed || !parsed.sha) return '__no-introducing-commit__';
  if (parsed.date < grandfatherDate) return '__grandfathered__';
  const trailerLines = parsed.body.split('\n').filter((l) => l.startsWith('Prior-art:'));
  if (trailerLines.length === 0) return null;
  return trailerLines.map((l) => l.slice('Prior-art:'.length).trim()).join(' ');
}

function getPriorArtTrailer(filePath: string, grandfatherDate: Date): TrailerResult {
  return getPriorArtTrailerAt(REPO_ROOT, filePath, grandfatherDate);
}

// ── Legacy 3-call reference (for EQUIV_VERIFY equivalence test only) ──────────
// Preserved verbatim from the pre-batch implementation; used ONLY by the
// EQUIV_VERIFY=1 equivalence test to prove the single-call version produces
// byte-identical TrailerResult per file. Gated to avoid paying the 3× spawn
// cost in normal CI runs (the test's skip-when-env-absent guard handles this).
function getPriorArtTrailerLegacy3Calls(
  filePath: string,
  grandfatherDate: Date,
): TrailerResult {
  const relPath = relative(REPO_ROOT, filePath);
  const sha = git(`git log --diff-filter=A --format=%H -1 -- "${relPath}"`);
  if (!sha) return '__no-introducing-commit__';
  const commitDate = new Date(git(`git show --format=%ai -s ${sha}`));
  if (commitDate < grandfatherDate) return '__grandfathered__';
  const body = git(`git show --format=%B -s ${sha}`);
  const trailerLines = body.split('\n').filter((l) => l.startsWith('Prior-art:'));
  if (trailerLines.length === 0) return null;
  return trailerLines.map((l) => l.slice('Prior-art:'.length).trim()).join(' ');
}

/**
 * Returns true if trailer rationale is substantive.
 * Mirrors pre-push pa_check_trailer: ≥20 chars and not all-placeholder words.
 * For "skipped — ..." form, validates the portion after the "skipped" prefix.
 */
export function isValidTrailerRationale(rationale: string): boolean {
  if (rationale.length < 20) return false;
  let check = rationale;
  if (/^skipped/i.test(check)) {
    check = check.replace(/^skipped\s*[—–\-]?\s*:?\s*/i, '');
  }
  if (check.trim().length < 20) return false;
  const words = check.trim().split(/\s+/).map((w) => w.toLowerCase().replace(/[^a-z]/g, ''));
  const nonEmpty = words.filter((w) => w.length > 0);
  return nonEmpty.length > 0 && nonEmpty.some((w) => !PLACEHOLDER_WORDS.has(w));
}

// ── SSOT matching ─────────────────────────────────────────────────────────────

/**
 * Returns true if the SSOT contains provenance evidence for the artifact.
 * Strong match: artifact's repo-relative path appears verbatim in SSOT.
 * Heuristic match: domain keyword from basename appears in SSOT.
 *   Disabled for packages/core/principles/*.test.ts (anti-cross-match rule):
 *   the companion-rule entry (e.g. #47 for build-first-reuse-default.md) would
 *   vacuously satisfy the principle test file via keyword overlap. Principle tests
 *   need either a dedicated SSOT entry with verbatim path OR a Prior-art trailer.
 */
export function hasSsotMatch(filePath: string, ssotContent: string): boolean {
  const relPath = relative(REPO_ROOT, filePath);
  if (ssotContent.includes(relPath)) return true;

  const isPrincipleTest =
    relPath.startsWith('packages/core/principles/') && relPath.endsWith('.test.ts');
  if (isPrincipleTest) return false;

  const keyword = getSsotKeyword(filePath);
  return keyword.length >= 5 && ssotContent.includes(keyword);
}

function getSsotKeyword(filePath: string): string {
  const parts = filePath.split('/');
  const filename = parts[parts.length - 1]!;
  const parentDir = parts[parts.length - 2]!;

  if (filename === 'SKILL.md') return parentDir;
  if (filename.endsWith('.md')) return filename.slice(0, -3);
  return filename.replace(/\.ts$/, '').replace(/^\d+-/, '');
}

// ── SSOT F2 parsing ───────────────────────────────────────────────────────────

interface SsotEntry {
  id: number;
  verdict: string;
}

function parseSsotEntries(ssotContent: string): SsotEntry[] {
  const entries: SsotEntry[] = [];
  for (const line of ssotContent.split('\n')) {
    const cells = line.split('|');
    if (cells.length < 8) continue;
    const idCell = cells[1]?.trim() ?? '';
    if (!/^\d+$/.test(idCell)) continue;
    const verdict = cells[6]?.trim() ?? '';
    entries.push({ id: parseInt(idCell, 10), verdict });
  }
  return entries;
}

// ── Assertion helpers (testable independently for anti-tautology cases) ───────

export function assertF1(
  relPath: string,
  trailerResult: TrailerResult,
  hasSsot: boolean,
): void {
  if (
    trailerResult === '__grandfathered__' ||
    trailerResult === '__no-introducing-commit__' ||
    hasSsot
  ) {
    return;
  }
  if (typeof trailerResult === 'string') return; // has trailer
  throw new Error(
    `F1: ${relPath} — capability artifact has neither SSOT match nor Prior-art trailer`,
  );
}

export function assertF3(relPath: string, rationale: string): void {
  if (!isValidTrailerRationale(rationale)) {
    throw new Error(
      `F3: ${relPath} — Prior-art trailer rationale invalid (<20 chars or all-placeholder): "${rationale.slice(0, 80)}"`,
    );
  }
}

// ── Shared capability scan (perf memo) ─────────────────────────────────────────
// Cost model (post-single-call, 2026-07-24): scanCapabilities() walks each
// capability file ONCE via `getPriorArtTrailer` → `git log --diff-filter=A
// --format='%H%n%ai%n%B' -1 -- <path>` (one subprocess per file, down from
// three). Container: ~5.0s for 228 files; host: ~17.7s (was ~26s pre-fix).
// F1 runs first and pays the full walk cost; F3 hits the cached trailers map.
// The legacy 3-call reference (`getPriorArtTrailerLegacy3Calls` above) is
// retained for the EQUIV_VERIFY=1 equivalence test only.
interface CapabilityScan {
  ssotContent: string;
  files: string[];
  trailers: Map<string, TrailerResult>;
}
let _capabilityScan: CapabilityScan | null = null;
function scanCapabilities(): CapabilityScan {
  if (_capabilityScan) return _capabilityScan;
  const grandfatherDate = getGrandfatherDate();
  const ssotContent = readFile(SSOT_PATH);
  const files = getCapabilityFiles();
  const trailers = new Map<string, TrailerResult>();
  for (const f of files) trailers.set(f, getPriorArtTrailer(f, grandfatherDate));
  _capabilityScan = { ssotContent, files, trailers };
  return _capabilityScan;
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('Principle 11 — build-first reuse-default', () => {
  // Cost model (post-single-call, 2026-07-24): scanCapabilities() does ONE
  // `git log --diff-filter=A --format='%H%n%ai%n%B' -1 -- <path>` per file
  // (down from 3 git spawns per file in the legacy implementation).
  // Timing depends heavily on environment — the container (Linux overlayfs)
  // is ~3× faster than the operator's macOS host at this workload:
  //   container: ~5.0s for 228 files
  //   host:      ~17.7s for 228 files  (the gate runs here at push time)
  // The budget is sized to the HOST: 30s gives ~41% margin over 17.7s.
  // Host speedup vs the legacy 3-call baseline (~26s) is 1.47× — under 2×,
  // an honest small win. NOTE: the expensive part (the per-file walk with
  // pathspec history-simplification) is unchanged, so cost still grows with
  // repository age (1481 commits today, ~365 in the last 30 days) — this
  // fix lowered the constant, not the exponent.
  // A regression past 30s means the per-file walk degraded — investigate
  // before raising this. F3 then hits the cached trailers map (sub-ms).
  it('F1: all post-grandfather capability artifacts have SSOT match or Prior-art trailer', { timeout: 30000 }, () => {
    const { ssotContent, files, trailers } = scanCapabilities();
    expect(files.length, 'capability set must be non-empty').toBeGreaterThan(0);

    const violations: string[] = [];
    for (const filePath of files) {
      const relPath = relative(REPO_ROOT, filePath);
      const trailerResult = trailers.get(filePath) as TrailerResult;
      const ssot = hasSsotMatch(filePath, ssotContent);
      try {
        assertF1(relPath, trailerResult, ssot);
      } catch (err) {
        violations.push((err as Error).message);
      }
    }
    expect(violations, `F1 violations:\n${violations.join('\n')}`).toHaveLength(0);
  });

  it('F2: all SSOT entries declare a recognized BFR verdict', () => {
    const ssotContent = readFile(SSOT_PATH);
    const entries = parseSsotEntries(ssotContent);
    expect(entries.length, 'SSOT must have at least one entry').toBeGreaterThan(0);

    const violations: string[] = [];
    for (const { id, verdict } of entries) {
      if (!VERDICTS.has(verdict)) {
        violations.push(
          `#${id}: unrecognized verdict "${verdict}" — add to VERDICTS set or fix SSOT entry`,
        );
      }
    }
    expect(violations, `F2 violations:\n${violations.join('\n')}`).toHaveLength(0);
  });

  // Reorder-safety: normally a sub-ms cache hit, but if F3 ran before F1 it
  // would carry the full walk — size for that case. 30s matches F1 (host-sized).
  it('F3: all Post-grandfather Prior-art trailers are valid (≥20 chars, non-placeholder)', { timeout: 30000 }, () => {
    const { files, trailers } = scanCapabilities();
    const violations: string[] = [];

    for (const filePath of files) {
      const relPath = relative(REPO_ROOT, filePath);
      const trailerResult = trailers.get(filePath) as TrailerResult;
      if (
        trailerResult === '__grandfathered__' ||
        trailerResult === '__no-introducing-commit__' ||
        trailerResult === null
      )
        continue;
      try {
        assertF3(relPath, trailerResult);
      } catch (err) {
        violations.push((err as Error).message);
      }
    }
    expect(violations, `F3 violations:\n${violations.join('\n')}`).toHaveLength(0);
  });

  it('anti-tautology F1: artifact without SSOT match or trailer fails assertion', () => {
    // Simulate post-grandfather file with neither SSOT match nor trailer.
    expect(() =>
      assertF1('packages/new-feature/src/new-capability.ts', null, false),
    ).toThrow(/F1:.*capability artifact has neither/);
  });

  it('anti-tautology F3: placeholder trailer rationale fails assertion', () => {
    expect(isValidTrailerRationale('TODO')).toBe(false);
    expect(isValidTrailerRationale('skipped — TODO later tbd')).toBe(false);
    expect(isValidTrailerRationale('later')).toBe(false);
    expect(() => assertF3('fake/path.ts', 'TODO')).toThrow(/F3:.*invalid/);
    expect(() => assertF3('fake/path.ts', 'skipped — TODO later tbd')).toThrow(/F3:.*invalid/);
  });

  it('positive F1: .claude/rules/build-first-reuse-default.md passes via SSOT #47 strong match', () => {
    const ssotContent = readFile(SSOT_PATH);
    const ruleFile = resolve(RULES_DIR, 'build-first-reuse-default.md');
    expect(existsSync(ruleFile), 'companion rule file must exist').toBe(true);
    expect(
      hasSsotMatch(ruleFile, ssotContent),
      'SSOT #47 must mention .claude/rules/build-first-reuse-default.md verbatim',
    ).toBe(true);
  });

  it('SSOT entry IDs are unique and ≥1 (schema sanity)', () => {
    const ssotContent = readFile(SSOT_PATH);
    const entries = parseSsotEntries(ssotContent);
    const ids = entries.map((e) => e.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size, 'SSOT entry IDs must be unique').toBe(ids.length);
    expect(ids.every((id) => id >= 1), 'all IDs must be positive').toBe(true);
  });

  /**
   * Self-application (POST-COMMIT ONLY): this test file itself must pass F1.
   * Gates on SELF_APPLICATION_VERIFY=post-commit because git log cannot detect
   * the introducing commit until after the file is committed. The env-flag gate
   * ensures CI/dev-loop auto-skips pre-commit, and VERIFY step 7 activates it.
   * T15 (self-application mandatory per ai-laziness-traps.md §2) satisfied here.
   */
  it('self-application: principle 11 test file passes F1 on its own introducing commit', () => {
    if (process.env.SELF_APPLICATION_VERIFY !== 'post-commit') {
      console.log(
        '  [case 7 skipped] Set SELF_APPLICATION_VERIFY=post-commit to activate after commit.',
      );
      return;
    }
    const thisFile = resolve(HERE, '11-build-first-reuse-default.test.ts');
    const grandfatherDate = getGrandfatherDate();
    const ssotContent = readFile(SSOT_PATH);
    const trailerResult = getPriorArtTrailer(thisFile, grandfatherDate);
    const ssot = hasSsotMatch(thisFile, ssotContent);
    const relPath = relative(REPO_ROOT, thisFile);
    expect(
      trailerResult !== '__no-introducing-commit__',
      'introducing commit must be detectable post-commit',
    ).toBe(true);
    expect(
      () => assertF1(relPath, trailerResult, ssot),
      'principle 11 test file must pass F1 (has Prior-art trailer or SSOT match)',
    ).not.toThrow();
    if (typeof trailerResult === 'string') {
      expect(
        () => assertF3(relPath, trailerResult),
        'principle 11 test file Prior-art trailer must be valid',
      ).not.toThrow();
    }
  });

  /**
   * Equivalence proof (T-BATCH-A falsifier): run the legacy 3-call git lookup
   * AND the single-call lookup over the FULL population and assert byte-identical
   * TrailerResult per file. A bug in the single-call format/parser that drops
   * or mis-attributes trailers is caught here. Gated on EQUIV_VERIFY=1 because
   * the legacy 3-call walk is the slow path the single-call replaces
   * (container ~8.5s, host ~26s for 228 files) —
   * running it in every CI would defeat the purpose. Run once per PR that
   * touches the lookup (paste output into the PR body).
   */
  it('equivalence: single-call lookup matches legacy 3-call lookup over full population', { timeout: 60000 }, () => {
    if (process.env.EQUIV_VERIFY !== '1') {
      console.log('  [equivalence skipped] Set EQUIV_VERIFY=1 to run legacy-vs-singlecall comparison.');
      return;
    }
    const grandfatherDate = getGrandfatherDate();
    const files = getCapabilityFiles();
    // T14 — assert we're comparing a non-trivial population, not a sample. The
    // capability set should include ≥100 files in any real checkout.
    expect(files.length, 'capability set must be non-trivial').toBeGreaterThan(100);

    let compared = 0;
    const mismatches: string[] = [];
    for (const filePath of files) {
      const legacy = getPriorArtTrailerLegacy3Calls(filePath, grandfatherDate);
      const singleCall = getPriorArtTrailer(filePath, grandfatherDate);
      compared++;
      if (legacy !== singleCall) {
        const rel = relative(REPO_ROOT, filePath);
        // Truncate values in the mismatch message — trailers can be very long
        // and we only need to see the divergence point.
        const trunc = (v: TrailerResult): string => {
          if (v === null) return 'null';
          const s = String(v);
          return s.length > 100 ? s.slice(0, 100) + `…(${s.length} chars)` : s;
        };
        mismatches.push(`${rel}: legacy=${JSON.stringify(trunc(legacy))} single=${JSON.stringify(trunc(singleCall))}`);
      }
    }
    expect(compared, 'must compare the full population, not a sample').toBe(files.length);
    expect(mismatches, `equivalence mismatches (${mismatches.length}/${compared}):\n${mismatches.join('\n')}`)
      .toHaveLength(0);
  });
});

// ── Awkward-case tests (throwaway git repo) ──────────────────────────────────
// Each scenario constructs a fresh temp git repo with controlled commits, then
// verifies getPriorArtTrailerAt handles it correctly. These run in every CI
// (fast — 5 tiny repos, each <100ms) and guard the lookup against the cases
// the kickoff §3 item 2 enumerates. The legacy getPriorArtTrailerLegacy3Calls
// is referenced where its behaviour defines "correct".

describe('Principle 11 — single-call lookup awkward cases', () => {
  // Helper: create a temp git repo, return its path. Caller cleans up.
  function makeTempRepo(): string {
    const dir = mkdtempSync(join(tmpdir(), 'p11-equiv-'));
    execSync('git init -q', { cwd: dir, encoding: 'utf8', env: GIT_ENV_SCRUB });
    execSync('git config user.email test@example.com', { cwd: dir, encoding: 'utf8', env: GIT_ENV_SCRUB });
    execSync('git config user.name Test', { cwd: dir, encoding: 'utf8', env: GIT_ENV_SCRUB });
    return dir;
  }

  function commit(dir: string, msg: string, dateIso: string, files: { name: string; content: string }[]): void {
    for (const f of files) {
      writeFileSync(join(dir, f.name), f.content);
    }
    execSync(
      `git add ${files.map((f) => `'${f.name}'`).join(' ')} && ` +
        `GIT_AUTHOR_DATE='${dateIso}' GIT_COMMITTER_DATE='${dateIso}' ` +
        `git commit -q --allow-empty -m '${msg.replace(/'/g, "'\\''")}'`,
      { cwd: dir, encoding: 'utf8', env: GIT_ENV_SCRUB },
    );
  }

  function lookup(dir: string, relPath: string, grandfatherDate: Date): TrailerResult {
    return getPriorArtTrailerAt(dir, join(dir, relPath), grandfatherDate);
  }

  it('case 1: file added, deleted, re-added — most recent add wins', () => {
    const dir = makeTempRepo();
    try {
      // Commit 1 (old): add file with one trailer.
      commit(dir, 'add v1\n\nPrior-art: old-trailer', '2024-01-01T00:00:00 +0000', [
        { name: 'f.txt', content: 'v1' },
      ]);
      // Commit 2: delete file.
      execSync('git rm -q f.txt && git commit -q -m delete', { cwd: dir, encoding: 'utf8', env: GIT_ENV_SCRUB });
      // Commit 3 (new): re-add file with a different trailer.
      commit(dir, 're-add v2\n\nPrior-art: new-trailer', '2025-06-01T00:00:00 +0000', [
        { name: 'f.txt', content: 'v2' },
      ]);
      // Grandfather date uses git's %ai format (space separator) — the same
      // format new Date() parses in production via getGrandfatherDate(). The
      // T-separator-with-space form ('2020-01-01T00:00:00 +0000') is Invalid Date
      // in V8's ISO parser; space-separator is the legacy-parseable form.
      const grandfatherDate = new Date('2020-01-01 00:00:00 +0000');
      const result = lookup(dir, 'f.txt', grandfatherDate);
      // Most recent add (commit 3) must win — its trailer, not the old one.
      // Verified: `git log --diff-filter=A -1 -- f.txt` returns the re-add.
      expect(result).toBe('new-trailer');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('case 2: body with blank lines + multi-line content — trailer still extracted', () => {
    const dir = makeTempRepo();
    try {
      // Adversarial body: blank lines, a line that mimics a format marker, and
      // the real trailer buried mid-body. The single-call parser splits on the
      // FIRST TWO newlines only (sha, date) — the body is everything after, so
      // no line in the body can disrupt the parse.
      const adversarialMsg = [
        'feat: adversarial body',
        '',
        'This body has blank lines.',
        '',
        'A line that mimics a format marker:',
        '%n%ai%n%B',
        '',
        'And a line that mimics a 40-hex SHA:',
        'a69fa356af6bb0a5c729717f1a400b5be9ddb75c',
        '',
        'Prior-art: real-trailer-here',
      ].join('\n');
      commit(dir, adversarialMsg, '2025-06-01T00:00:00 +0000', [
        { name: 'f.txt', content: 'x' },
      ]);
      const grandfatherDate = new Date('2020-01-01 00:00:00 +0000');
      const result = lookup(dir, 'f.txt', grandfatherDate);
      expect(result).toBe('real-trailer-here');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('case 3: commit with two Prior-art lines — joined with space (legacy semantics)', () => {
    const dir = makeTempRepo();
    try {
      commit(dir, 'two trailers\n\nPrior-art: first rationale\nPrior-art: second rationale', '2025-06-01T00:00:00 +0000', [
        { name: 'f.txt', content: 'x' },
      ]);
      const grandfatherDate = new Date('2020-01-01 00:00:00 +0000');
      const result = lookup(dir, 'f.txt', grandfatherDate);
      // Legacy joins multiple trailer lines with ' ' (getPriorArtTrailer body).
      expect(result).toBe('first rationale second rationale');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('case 4: file with no add-event — __no-introducing-commit__', () => {
    const dir = makeTempRepo();
    try {
      commit(dir, 'unrelated commit', '2025-06-01T00:00:00 +0000', [
        { name: 'other.txt', content: 'x' },
      ]);
      const grandfatherDate = new Date('2020-01-01 00:00:00 +0000');
      const result = lookup(dir, 'never-added.txt', grandfatherDate);
      expect(result).toBe('__no-introducing-commit__');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('case 5: file introduced before grandfather date — __grandfathered__', () => {
    const dir = makeTempRepo();
    try {
      // Commit BEFORE the grandfather date.
      commit(dir, 'old commit\n\nPrior-art: would-be-trailer', '2020-01-01T00:00:00 +0000', [
        { name: 'f.txt', content: 'x' },
      ]);
      // Grandfather date is AFTER the commit — file is grandfathered.
      const grandfatherDate = new Date('2024-06-01 00:00:00 +0000');
      const result = lookup(dir, 'f.txt', grandfatherDate);
      expect(result).toBe('__grandfathered__');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
