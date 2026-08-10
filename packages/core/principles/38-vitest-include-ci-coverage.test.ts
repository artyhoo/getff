/**
 * Principle 38 — vitest include-allowlist ↔ CI invocation coverage gate
 *
 * > **Authoritative for:** every file matched by the `test.include` allowlist in
 * > `packages/core/vitest.config.ts` is reachable from some step in `.github/workflows/`,
 * > except files carrying an explicit justified entry in `COVERAGE_ALLOWLIST` below.
 * > **NOT authoritative for:** project goal — see README.md#why-this-exists. Whether those
 * > tests PASS (that is the steps' own job); which CI jobs exist at all — see
 * > `38`'s sibling `36-ci-needs-completeness.test.ts`, which asserts the jobs that DO exist
 * > are wired into the single required `ci-success` context.
 *
 * ## Why this gate exists
 *
 * `vitest.config.ts` `include:` is the real test population. The CI job that runs it
 * (`principles-meta-tests`, audit-self.yml) invokes a HAND-WRITTEN list of npm scripts and
 * file paths. Nothing tied the two together, so the list silently fell behind the population:
 * a cold backward sweep on 2026-08-10 measured **87 `*.test.ts` files across 12 directories
 * with zero CI invocation** — skills (22), research (22), validator (16), eslint-rules (7),
 * detector (7), installer (4), scenario-generator (2), diff (2), diagnostics (2),
 * detector-v0 (1), spec-validation (1), python-starter (1) — plus partial coverage of
 * synthesizer (3/23 files), install (2/5) and audit-self (3/6).
 *
 * A test wired at NO channel fails at none: it is the `#armed-but-not-fired` false-green this
 * project exists to prevent, and the same class `tests/install-sh/meta-all-wired.test.sh`
 * already closes for the shell battery. audit-self.yml:692 even admitted the hole in prose
 * («the install/ vitest dir is otherwise un-gated») — a comment is not a mechanism
 * (.claude/rules/attention-is-not-a-mechanism.md §1: bare attention may be merge AUTHORITY,
 * never the DETECTION layer). Wiring the 87 without a gate would regress exactly as the
 * `ci-success` needs: list did before principle 36; this file is the mechanism.
 *
 * ## Channel choice (.claude/rules/rule-enforcement-channel-selection.md §3)
 *
 * Mechanically detectable → gate, not injection (§3 step 1). A principle test is the earliest
 * reachable gate: the principles suite runs at pre-push (`principlesMetaSection`,
 * packages/core/hooks/pre-push.ts) *and* in CI — developer-time first, CI as backstop, per the
 * README "earliest reachable channel" invariant that makes CI the last resort.
 *
 * ## Prior art (build-vs-reuse, CLAUDE.md capability-commit gate)
 *
 * SSOT #248 (this commit; renumbered from a duplicate #247 minted in the #1370 × #1371 cross-PR race). Verdict **ADAPT** of two in-repo implementations of the same shape —
 * `tests/install-sh/meta-all-wired.test.sh:22-43` (population = `tests/install-sh/*.test.sh`,
 * registry = the workflow text) and `principles/36-ci-needs-completeness.test.ts` (population =
 * workflow jobs, registry = `ci-success.needs`) — onto a new population/registry pair. No new
 * dependency, no new module. Vitest itself has no such reconciliation: DeepWiki
 * `vitest-dev/vitest` (2026-08-10) — «no explicit feature to reconcile the declared `include`
 * globs with the files that are actually run»; `FilesNotFoundError` fires only when NO file is
 * found, never on a covered subset. context7 `/vitest-dev/vitest` surfaces `globTestFiles` /
 * `collect` (enumeration primitives) but nothing that compares them to an external runner's
 * invocation list. WebSearch ×3 phrasings surfaced the defect class filed as a bug in the wild
 * (rjwalters/loom#4769, «tests/hooks/ guard test suites have zero CI coverage») and generic
 * orphan-file finders (`git-orphaned-files`, dependency-cruiser `--orphan`) that reason about
 * imports, not CI invocation — no production tool for this class.
 *
 * ## Anti-trap notes
 *
 * T3 — every arm reads the real `vitest.config.ts`, the real `package.json` scripts and the
 * real workflow files off disk; no arm asserts against a hand-copied list.
 * T14 — the gate reports per-FILE, not per-directory: a directory named by one CI step is not
 * evidence that the directory's other 19 files run (the synthesizer 3/23 case).
 * T15 (self-application) — arms (d)/(e)/(f) mutate REAL sources and re-run the REAL resolver,
 * so the failing direction is exercised, not assumed
 * (.claude/rules/destination-environment-verification.md §4 `#contract-that-cannot-fail`).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(HERE, '..');
const REPO_ROOT = resolve(HERE, '../../../');
const VITEST_CONFIG = resolve(PKG_ROOT, 'vitest.config.ts');
const PKG_JSON = resolve(PKG_ROOT, 'package.json');
const WORKFLOW_DIR = resolve(REPO_ROOT, '.github/workflows');

/**
 * Files matched by the include allowlist that no CI step invokes, each with its justification.
 *
 * Empty today: the 2026-08-10 wiring closed every gap the sweep found. An entry belongs here
 * only when a file is deliberately NOT a merge gate — e.g. it needs a toolchain CI does not
 * install, or it is a manual/advisory probe. "Slow" is not a reason on its own: put it in its
 * own step instead. Rationale must be ≥20 chars and say WHY, mirroring the repo's escape-token
 * convention (.claude/rules/ci-tool-pinning.md §3, CLAUDE.md `Prior-art:` escape hatch).
 */
const COVERAGE_ALLOWLIST = new Map<string, string>([]);

// ── Parsing helpers (exported for the paired-negative arms) ────────────────────

/**
 * The `include:` glob strings from vitest.config.ts.
 *
 * Anchored at `include: [` and stopped at the closing `]`, so the neighbouring `exclude: [`
 * array can never be read as the population — reading `exclude` would invert the gate.
 */
export function parseIncludeGlobs(source: string): string[] {
  const lines = source.split('\n');
  const start = lines.findIndex((l) => /^\s*include:\s*\[\s*$/.test(l));
  if (start === -1) return [];
  const globs: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\s*\]/.test(lines[i])) break;
    const m = lines[i].match(/^\s*'([^']+)'\s*,?\s*$/);
    if (m) globs.push(m[1]);
  }
  return globs;
}

/**
 * Expand one `<dir>/**​/*<suffix>` glob into the real files on disk, package-relative.
 *
 * Only the shape the config actually uses is supported; an unrecognised glob returns null so
 * arm (b) fails loudly rather than silently shrinking the population to zero.
 */
export function expandGlob(pkgRoot: string, glob: string): string[] | null {
  const m = glob.match(/^([A-Za-z0-9._-]+)\/\*\*\/\*(\.[A-Za-z.]+)$/);
  if (!m) return null;
  const [, dir, suffix] = m;
  const abs = resolve(pkgRoot, dir);
  if (!existsSync(abs)) return [];
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const entry of readdirSync(d)) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      const p = join(d, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (entry.endsWith(suffix)) out.push(relative(pkgRoot, p).split(sep).join('/'));
    }
  };
  walk(abs);
  return out.sort();
}

/**
 * Every positional vitest filter reachable from the workflow files.
 *
 * Three invocation shapes exist in this repo and all three are resolved:
 *   1. `npm --prefix packages/core run <script>`   → the script body from package.json
 *   2. `npm --prefix packages/core test -- <args>` → the `test` script body + the passed args
 *   3. `npx --prefix packages/core vitest run <paths>` → the paths verbatim
 *
 * Shape 3 runs from the repo root so its paths carry a `packages/core/` prefix; shapes 1-2 run
 * with cwd=packages/core. Both are normalised to package-relative here.
 *
 * Flags (`--reporter=default`, `--silent`) are dropped: they are not file filters.
 *
 * A filter's trailing slash is LOAD-BEARING and is preserved verbatim. Verified against the
 * real binary 2026-08-10: `vitest list hooks/` selects 0 files named `*hooks-tree-guard*`,
 * while `vitest list hooks` selects 6 — because the filter is a substring match on the path.
 * Normalising `hooks/` to `hooks` would make `audit-self/hooks-tree-guard.test.ts` look
 * covered by the hooks/ step that never runs it — false coverage, the exact failure this
 * gate exists to catch. Arm (c) pins the behaviour.
 */
export function parseCiVitestFilters(
  workflowSources: string[],
  scripts: Record<string, string>,
): string[] {
  const filters: string[] = [];
  const norm = (a: string): string => a.replace(/^packages\/core\//, '');
  const addFrom = (argv: string): void => {
    for (const tok of argv.trim().split(/\s+/)) {
      if (!tok || tok.startsWith('-')) continue;
      if (tok === 'vitest' || tok === 'run') continue;
      filters.push(norm(tok));
    }
  };

  for (const src of workflowSources) {
    for (const line of src.split('\n')) {
      // 1 + 2 — npm --prefix packages/core (run <script> | test) [-- <args>]
      const npmRun = line.match(/npm\s+--prefix\s+packages\/core\s+run\s+([A-Za-z0-9:_-]+)/);
      if (npmRun) {
        const body = scripts[npmRun[1]];
        if (body && /(^|\s)vitest\s+run(\s|$)/.test(body)) {
          addFrom(body.replace(/^.*?vitest\s+run/, ''));
        }
        continue;
      }
      const npmTest = line.match(/npm\s+--prefix\s+packages\/core\s+test\b(.*)$/);
      if (npmTest) {
        const body = scripts.test ?? '';
        if (/(^|\s)vitest\s+run(\s|$)/.test(body)) addFrom(body.replace(/^.*?vitest\s+run/, ''));
        const passed = npmTest[1].split(/\s--\s/)[1];
        if (passed) addFrom(passed);
        continue;
      }
      // 3 — npx --prefix packages/core vitest run <paths>
      const npx = line.match(/vitest\s+run\s+(.*)$/);
      if (npx && /npx/.test(line)) addFrom(npx[1].replace(/\|\|\s*\\?\s*$/, ''));
    }
  }
  return [...new Set(filters)].filter(Boolean);
}

/**
 * Files from the population that no CI filter selects.
 *
 * Matching mirrors vitest's own positional-argument semantics: a filter is a SUBSTRING match
 * against the test file path, not a strict path (that is what makes
 * `tests/acceptance/canonical-regen` select `tests/acceptance/canonical-regen.test.ts`, and
 * what makes a bare directory filter select everything beneath it).
 *
 * Substring — not prefix — is deliberate and verified: `vitest list tor/` selects 180 tests from
 * `validator/` and `detector/`. A consequence worth knowing when reading a green result: a new
 * directory whose name ends with a covered one (`brand-new-dir/` vs the `ir/` step) is reported
 * covered, and genuinely IS — vitest would run it. The gate models the runner, not an idealised
 * path semantics it does not have.
 */
export function uncoveredFiles(
  files: string[],
  filters: string[],
  allowlist: ReadonlySet<string> = new Set(COVERAGE_ALLOWLIST.keys()),
): string[] {
  return files.filter(
    (f) => !allowlist.has(f) && !filters.some((flt) => f.includes(flt)),
  );
}

// ── Fixtures read once ─────────────────────────────────────────────────────────

const readConfig = (): string => readFileSync(VITEST_CONFIG, 'utf8');
const readScripts = (): Record<string, string> =>
  JSON.parse(readFileSync(PKG_JSON, 'utf8')).scripts ?? {};
const workflowFiles = (): string[] =>
  readdirSync(WORKFLOW_DIR)
    .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
    .map((f) => resolve(WORKFLOW_DIR, f));
const readWorkflows = (): string[] => workflowFiles().map((f) => readFileSync(f, 'utf8'));

const population = (source = readConfig()): string[] => {
  const out: string[] = [];
  for (const g of parseIncludeGlobs(source)) {
    const files = expandGlob(PKG_ROOT, g);
    if (files) out.push(...files);
  }
  return [...new Set(out)].sort();
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Principle 38 — every vitest include-allowlist file is invoked by CI', () => {
  it('(a) real-tree: no include-matched test file is left un-invoked', () => {
    // Both inputs asserted present: this gate is framework-only (packages/core/principles is
    // enforcement code, never copied into a consumer install), so a missing workflow dir means
    // the gate is running somewhere it cannot verify anything — fail loudly, never vacuously.
    expect(existsSync(VITEST_CONFIG), `${VITEST_CONFIG} must exist`).toBe(true);
    expect(
      existsSync(WORKFLOW_DIR),
      `${WORKFLOW_DIR} must exist — without it every file would look uncovered`,
    ).toBe(true);
    const files = population();
    const filters = parseCiVitestFilters(readWorkflows(), readScripts());
    const missing = uncoveredFiles(files, filters);

    const byDir = new Map<string, number>();
    for (const m of missing) {
      const d = m.split('/')[0];
      byDir.set(d, (byDir.get(d) ?? 0) + 1);
    }

    expect(
      missing,
      `These files are matched by the \`include:\` allowlist in packages/core/vitest.config.ts ` +
        `but NO step in .github/workflows/ ever runs them — they are armed-but-not-fired:\n` +
        [...byDir.entries()].map(([d, n]) => `  ${d}/ — ${n} file(s)`).join('\n') +
        `\n\n` +
        missing.slice(0, 20).map((m) => `  - ${m}`).join('\n') +
        (missing.length > 20 ? `\n  … and ${missing.length - 20} more` : '') +
        `\n\nEither add a CI step that runs them (an npm script in packages/core/package.json ` +
        `invoked from a workflow), or add each to COVERAGE_ALLOWLIST here with a rationale ` +
        `saying WHY it is deliberately not a merge gate.`,
    ).toEqual([]);
  });

  it('(b) non-vacuity: population, filters and globs all parse to real, non-empty values', () => {
    const globs = parseIncludeGlobs(readConfig());
    expect(globs.length, `expected ≥20 include globs; got ${globs.length}`).toBeGreaterThanOrEqual(20);
    expect(globs, 'the principles dir must be in the include allowlist').toContain(
      'principles/**/*.test.ts',
    );
    // Every glob must be a shape expandGlob understands — an unparsed glob would silently
    // drop a whole directory out of the population and make arm (a) pass for the wrong reason.
    for (const g of globs) {
      expect(expandGlob(PKG_ROOT, g), `include glob \`${g}\` is a shape expandGlob cannot expand`).not.toBeNull();
    }
    // The exclude: array must NOT be read as the population.
    expect(globs, 'exclude entries must never enter the population').not.toContain(
      '**/node_modules/**',
    );

    const files = population();
    expect(files.length, `expected ≥200 include-matched files; got ${files.length}`).toBeGreaterThanOrEqual(200);
    expect(files, 'this very file must be in its own population').toContain(
      'principles/38-vitest-include-ci-coverage.test.ts',
    );

    const filters = parseCiVitestFilters(readWorkflows(), readScripts());
    expect(filters.length, `expected ≥8 CI filters; got ${filters.length}`).toBeGreaterThanOrEqual(8);
    expect(filters, 'the principles/ dir filter must resolve through the npm script').toContain(
      'principles/',
    );
  });

  it('(c) resolver handles all three invocation shapes used in this repo', () => {
    const scripts = readScripts();
    // Shape 1 — npm run <script> resolved through package.json. The trailing slash survives:
    // `vitest list hooks/` selects 0 hooks-tree-guard files, `vitest list hooks` selects 6
    // (verified against the real binary 2026-08-10), so dropping it would fake coverage.
    expect(
      parseCiVitestFilters(['        run: npm --prefix packages/core run test:render'], scripts),
    ).toEqual(['render/']);
    expect(
      uncoveredFiles(['audit-self/hooks-tree-guard.test.ts'], ['hooks/'], new Set()),
      'the hooks/ step must NOT be credited with covering audit-self/hooks-tree-guard.test.ts',
    ).toEqual(['audit-self/hooks-tree-guard.test.ts']);
    // Shape 2 — npm test -- <args>; the passed filter is picked up, the reporter flag is not.
    expect(
      parseCiVitestFilters(
        ['        run: npm --prefix packages/core test --silent -- tests/acceptance/canonical-regen'],
        scripts,
      ),
    ).toEqual(['tests/acceptance/canonical-regen']);
    // Shape 3 — npx with repo-root-relative paths; the packages/core/ prefix is normalised off.
    expect(
      parseCiVitestFilters(
        ['   npx --prefix packages/core vitest run --reporter=default packages/core/audit-self/first-steps-parity.test.ts'],
        scripts,
      ),
    ).toEqual(['audit-self/first-steps-parity.test.ts']);
    // An unknown script name must contribute nothing rather than throw.
    expect(
      parseCiVitestFilters(['        run: npm --prefix packages/core run test:does-not-exist'], scripts),
    ).toEqual([]);
  });

  it('(d) paired-negative (seeded step removal): RED when a wiring step is deleted', () => {
    const scripts = readScripts();
    const files = population();

    // GREEN direction — the real workflows.
    expect(uncoveredFiles(files, parseCiVitestFilters(readWorkflows(), scripts))).toEqual([]);

    // RED direction — drop every line that runs test:skills and re-run the real resolver.
    const seeded = readWorkflows().map((s) =>
      s
        .split('\n')
        .filter((l) => !/run\s+test:skills\b/.test(l))
        .join('\n'),
    );
    expect(seeded.join('\n'), 'the seeded mutation must actually change the workflow text').not.toBe(
      readWorkflows().join('\n'),
    );

    const missing = uncoveredFiles(files, parseCiVitestFilters(seeded, scripts));
    expect(
      missing.length,
      'deleting the skills/ wiring step must leave skills/ files uncovered',
    ).toBeGreaterThan(0);
    expect(
      missing.every((m) => m.startsWith('skills/')),
      `only skills/ files should drop out; got: ${missing.slice(0, 5).join(', ')}`,
    ).toBe(true);
  });

  it('(e) paired-negative (seeded include addition): RED when a new dir joins the allowlist unwired', () => {
    // The direction that matters most: someone adds a directory to vitest.config.ts include
    // and forgets the CI step — exactly how the 87-file gap accumulated.
    const seededCfg = readConfig().replace(
      "      'principles/**/*.test.ts',\n",
      "      'principles/**/*.test.ts',\n      'hooks/**/*.seeded.ts',\n",
    );
    expect(seededCfg, 'the seeded mutation must actually change the config text').not.toBe(
      readConfig(),
    );
    const globs = parseIncludeGlobs(seededCfg);
    expect(globs, 'the seeded glob must be parsed').toContain('hooks/**/*.seeded.ts');

    // A glob whose directory IS covered stays green; prove the reverse with a fresh directory
    // that no CI filter names, using a synthetic population rather than touching the tree.
    //
    // The fixture name is chosen, not arbitrary. vitest filters are substring matches on the
    // whole path (verified: `vitest list tor/` selects 180 tests from `validator/` and
    // `detector/`), so a directory whose name merely ENDS with a covered directory's name is
    // genuinely covered — `brand-new-dir/x.test.ts` really is run by the `ir/` step. That makes
    // such a name useless as a negative fixture. The guard below fails loudly if a future filter
    // ever starts covering this path, instead of letting the arm pass vacuously.
    const synthetic = ['zzz-nowhere/alpha.test.ts', 'zzz-nowhere/beta.test.ts'];
    const filters = parseCiVitestFilters(readWorkflows(), readScripts());
    expect(
      filters.filter((f) => synthetic[0].includes(f)),
      'the negative fixture must be covered by NO real filter, or this arm proves nothing',
    ).toEqual([]);
    expect(
      uncoveredFiles(synthetic, filters),
      'files in a directory no CI step names must be reported uncovered',
    ).toEqual(synthetic);
  });

  it('(f) fail-closed: an unreadable include: block yields an empty population, never a vacuous pass', () => {
    // If the config is restructured so `include: [` no longer matches, the population collapses.
    // Arm (b) is what turns that into a loud failure — assert the collapse is detectable here.
    const renamed = readConfig().replace(/^\s*include:\s*\[\s*$/m, '    includes: [');
    expect(renamed, 'the seeded rename must actually change the config text').not.toBe(readConfig());
    expect(
      parseIncludeGlobs(renamed),
      'a restructured include: block must parse to [] so arm (b) fails loudly',
    ).toEqual([]);
  });

  it('(g) allowlist hygiene: every allowlisted path is real, with a substantive rationale', () => {
    const files = new Set(population());
    for (const [path, rationale] of COVERAGE_ALLOWLIST) {
      expect(
        files.has(path),
        `COVERAGE_ALLOWLIST entry \`${path}\` is not a file matched by the include allowlist — ` +
          `a stale entry silently widens the exemption; delete it or fix the path`,
      ).toBe(true);
      expect(
        rationale.trim().length,
        `COVERAGE_ALLOWLIST entry \`${path}\` needs a rationale of ≥20 chars saying WHY it is exempt`,
      ).toBeGreaterThanOrEqual(20);
    }
  });
});
