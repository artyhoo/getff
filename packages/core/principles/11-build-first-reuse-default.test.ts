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
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
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

function getPriorArtTrailer(filePath: string, grandfatherDate: Date): TrailerResult {
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
// F1 and F3 each walk every capability file's introducing commit through git —
// getPriorArtTrailer() is pure, deterministic git reads (up to 3 subprocess
// spawns per file). Running that scan twice (once per test) doubled wall-time to
// ~25s for ~180 files. Memoize LAZILY (not beforeAll): the first of F1/F3 to run
// pays the single ~12s scan and the second reuses the cache, while tests that do
// NOT need the scan (F2, anti-tautology, schema, positive-F1) never trigger it —
// keeping their independence from the git layer (a beforeAll would couple them).
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
  // 30s (not 15s): F1 runs first, so scanCapabilities()'s single git pass over
  // ~180 files (~13s standalone, more under full-suite load) is paid inside F1's
  // budget; F3 then hits the cache. Sized to the scan, not the assertions.
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

  // 30s for reorder-safety: normally a ~3ms cache hit, but if F3 ran before F1
  // it would carry the scan instead — size its budget for that case too.
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
});
