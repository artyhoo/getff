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
 * already closes for the shell battery. audit-self.yml:1165 even admitted the hole in prose
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
 *
 * ## Execution-context contract (M02/A02, 2026-10-14)
 *
 * Seed A02: with the command replaced by `true` and the old command retained only as a
 * comment, this gate stayed GREEN — a raw-text match cannot tell execution from narration. The
 * repair: a credit must come from a supported test command in an ACTUAL YAML run step. The
 * resolver parses each workflow with js-yaml (direct devDep, principle 24's createRequire
 * pattern), selects `jobs.*.steps[].run` strings, joins backslash continuations, skips shell
 * full-line comments, splits command fragments and matches only command HEADS — so YAML
 * comments, shell comments, echo strings and step names never credit, while inline runs,
 * `if:/then:` block lines, `|| \`-continued and `VAR=x`-prefixed npx invocations do.
 *
 * Runner reachability scope (declared, finite): the three npm/npx invocation shapes above,
 * executed by bash step shells. NOT certified: command substitution `$(…)` bodies, bare
 * `vitest`/`node_modules/.bin/vitest` calls, composite/remote `uses:` actions, reusable
 * workflow templates, `working-directory:` rebasing, heredoc bodies, general shell control
 * flow. Every limit fails toward under-crediting (RED), never a silent pass.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

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
      else if (entry.endsWith(suffix))
        out.push(relative(pkgRoot, p).split(sep).join('/'));
    }
  };
  walk(abs);
  return out.sort();
}

// A REAL YAML parser — the M02/A02 repair: a coverage credit must come from a step's actual
// `run:` command, so run contents are selected from the parsed document, never matched against
// raw file text (comments, step names and echo strings are not execution). js-yaml is a direct
// devDep of packages/core; createRequire keeps it a runtime resolution, sidestepping the absent
// @types/js-yaml so `tsc --noEmit` stays clean (principle 24's pattern).
const nodeRequire = createRequire(import.meta.url);
const { load: parseYaml } = nodeRequire('js-yaml') as {
  load: (s: string) => unknown;
};

/**
 * The `run:` strings of every step in a workflow document.
 *
 * A YAML document that does not parse (or has no `jobs.*.steps[].run` structure) contributes
 * NOTHING — no credit is invented for unreadable input. That is a contribution claim only:
 * duplicate valid workflows may still cover the same files, so an invalid or unrecognized
 * workflow alone neither forces a global RED nor establishes anything about runs it might
 * hide behind `uses:` or templates.
 */
function runContentsFromWorkflow(source: string): string[] {
  let doc: unknown;
  try {
    doc = parseYaml(source);
  } catch {
    return [];
  }
  const runs: string[] = [];
  const jobs = (doc as { jobs?: unknown } | null)?.jobs;
  if (!jobs || typeof jobs !== 'object' || Array.isArray(jobs)) return runs;
  for (const job of Object.values(jobs as Record<string, unknown>)) {
    if (!job || typeof job !== 'object') continue;
    const steps = (job as { steps?: unknown }).steps;
    if (!Array.isArray(steps)) continue;
    for (const step of steps) {
      if (!step || typeof step !== 'object') continue;
      const run = (step as { run?: unknown }).run;
      if (typeof run === 'string') runs.push(run);
    }
  }
  return runs;
}

/** Remove single/double-quoted spans: separators inside quotes must not split a command, and
 *  quoted argv (echo text, `-t 'a|b'`) must never reach the token filter as pseudo-filters. */
const stripQuoted = (s: string): string => s.replace(/'[^']*'|"[^"]*"/g, ' ');

/** One physical script line per element after backslash-continuation joining; shell full-line
 *  comments and blank lines are dropped (a comment neither executes a command nor continues one). */
function logicalLines(script: string): string[] {
  return script
    .replace(/\\\n\s*/g, ' ')
    .split('\n')
    .filter((l) => !/^\s*(#|$)/.test(l));
}

/** Split a logical line into shell command fragments (`&&`, `||`, `;`, `|` separated). */
function commandFragments(line: string): string[] {
  return stripQuoted(line)
    .split(/&&|\|\||;|\|/)
    .map((f) => f.trim())
    .filter(Boolean);
}

/** Drop leading `VAR=value` env assignments so `NO_COLOR=1 npx …` still presents its head. */
const stripEnvPrefix = (f: string): string =>
  f.replace(/^(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)+/, '');

/** Positional argv of every actual `vitest run` command HEAD inside a package.json script
 *  body — the same logical-line / command-fragment / env-prefix pipeline a workflow run step
 *  gets (M02 correction 1). Narration inside a body (echo text, comments) presents no vitest
 *  head, so an echo-only or comment-only body contributes nothing. */
function scriptBodyVitestArgv(body: string): string[] {
  const argvs: string[] = [];
  for (const line of logicalLines(body)) {
    for (const frag of commandFragments(line)) {
      const head = stripEnvPrefix(frag).match(/^vitest\s+run\b(.*)$/);
      if (head) argvs.push(head[1]);
    }
  }
  return argvs;
}

/**
 * Every positional vitest filter reachable from the workflow files.
 *
 * A credit requires an actual run COMMAND (M02/A02 contract): the workflow is parsed as YAML,
 * each step's `run:` script is joined across backslash continuations, stripped of full-line
 * comments, split into command fragments, and only a fragment whose command HEAD is one of the
 * three supported invocation shapes is resolved:
 *   1. `npm --prefix packages/core run <script>`   → the script body's actual vitest argv
 *   2. `npm --prefix packages/core test -- <args>` → the `test` body's vitest argv + the passed
 *      args, credited only when the body itself runs Vitest (M02 correction 1)
 *   3. `npx … vitest run <paths>`                  → the paths verbatim
 *
 * Text that is not a command head never credits: YAML comments never reach a run string, shell
 * full-line comments are skipped, `echo`/quoted/name text is not the head of a fragment, and a
 * package.json script body is resolved through the same pipeline, so an echo-only or
 * comment-only body credits nothing even though it mentions Vitest. Shape 3
 * runs from the repo root so its paths may carry a `packages/core/` prefix; shapes 1-2 run with
 * cwd=packages/core. Both are normalised to package-relative here.
 *
 * Flags (`--reporter=default`, `--silent`) are dropped: they are not file filters. Quoted argv is
 * dropped with them, and redirection tokens (`>`, `2>&1`, …) are not paths.
 *
 * A filter's trailing slash is LOAD-BEARING and is preserved verbatim. Verified against the
 * real binary 2026-08-10: `vitest list hooks/` selects 0 files named `*hooks-tree-guard*`,
 * while `vitest list hooks` selects 6 — because the filter is a substring match on the path.
 * Normalising `hooks/` to `hooks` would make `audit-self/hooks-tree-guard.test.ts` look
 * covered by the hooks/ step that never runs it — false coverage, the exact failure this
 * gate exists to catch. Arm (c) pins the behaviour.
 *
 * Declared limits (deliberately NOT certified here): command substitution `$(…)` bodies, bare
 * `vitest`/`node_modules/.bin/vitest` invocations, composite/remote actions behind `uses:`,
 * reusable workflow templates, `working-directory:` path rebasing, heredoc bodies, general
 * shell control flow and quoting constructs are NOT parsed, and their effect on credits is
 * NOT established in either direction — no under-crediting direction is claimed for them. An
 * invalid or unrecognized workflow contributes no credits, but duplicate valid workflows may
 * still cover the same files, so one workflow's missing credits alone neither forces a global
 * RED nor validates that workflow's correctness. Extend the certified scope only with a new
 * frozen case set, as M02 and its correction 1 did.
 */
export function parseCiVitestFilters(
  workflowSources: string[],
  scripts: Record<string, string>,
): string[] {
  const filters: string[] = [];
  const norm = (a: string): string => a.replace(/^packages\/core\//, '');
  const addFrom = (argv: string): void => {
    for (const tok of stripQuoted(argv).trim().split(/\s+/)) {
      if (!tok || tok.startsWith('-')) continue;
      if (tok === 'vitest' || tok === 'run') continue;
      if (/^[<>&0-9]+$/.test(tok)) continue; // redirection operators, not paths
      filters.push(norm(tok));
    }
  };

  for (const src of workflowSources) {
    for (const run of runContentsFromWorkflow(src)) {
      for (const line of logicalLines(run)) {
        for (const frag of commandFragments(line)) {
          const cmd = stripEnvPrefix(frag);
          // 1 + 2 — npm --prefix packages/core (run <script> | test) [-- <args>]
          const npmRun = cmd.match(
            /^npm\s+--prefix\s+packages\/core\s+run\s+([A-Za-z0-9:_-]+)/,
          );
          if (npmRun) {
            const body = scripts[npmRun[1]];
            if (typeof body === 'string')
              for (const argv of scriptBodyVitestArgv(body)) addFrom(argv);
            continue;
          }
          const npmTest = cmd.match(
            /^npm\s+--prefix\s+packages\/core\s+test\b(.*)$/,
          );
          if (npmTest) {
            const argvs = scriptBodyVitestArgv(scripts.test ?? '');
            if (argvs.length > 0) {
              for (const argv of argvs) addFrom(argv);
              // Passed args reach Vitest only because the actual `test` script runs it.
              const passed = npmTest[1].split(/\s--\s/)[1];
              if (passed) addFrom(passed);
            }
            continue;
          }
          // 3 — npx … vitest run <paths>: the executable npx resolves must BE Vitest, reached
          // through the finite option PROFILE from the real workflow enumeration (M02
          // corrections 2-3): value-taking `--prefix packages/core` (the exact real value) and
          // standalone `--no-install`, in any supported order. Non-executing npx modes
          // (`--help`, `--version`), unknown options, delimiters, incomplete or option-valued
          // prefix arguments and any other executable credit nothing; no semantics are claimed
          // for unrecognized forms.
          if (/^npx(\s|$)/.test(cmd)) {
            const toks = cmd.trim().split(/\s+/);
            let i = 1;
            let profileOk = true;
            while (i < toks.length && toks[i].startsWith('-')) {
              if (toks[i] === '--no-install') i += 1;
              else if (
                toks[i] === '--prefix' &&
                toks[i + 1] === 'packages/core'
              )
                i += 2;
              else {
                profileOk = false;
                break;
              }
            }
            if (profileOk && toks[i] === 'vitest' && toks[i + 1] === 'run')
              addFrom(toks.slice(i + 2).join(' '));
          }
        }
      }
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
const readWorkflows = (): string[] =>
  workflowFiles().map((f) => readFileSync(f, 'utf8'));

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
        [...byDir.entries()]
          .map(([d, n]) => `  ${d}/ — ${n} file(s)`)
          .join('\n') +
        `\n\n` +
        missing
          .slice(0, 20)
          .map((m) => `  - ${m}`)
          .join('\n') +
        (missing.length > 20 ? `\n  … and ${missing.length - 20} more` : '') +
        `\n\nEither add a CI step that runs them (an npm script in packages/core/package.json ` +
        `invoked from a workflow), or add each to COVERAGE_ALLOWLIST here with a rationale ` +
        `saying WHY it is deliberately not a merge gate.`,
    ).toEqual([]);
  });

  it('(b) non-vacuity: population, filters and globs all parse to real, non-empty values', () => {
    const globs = parseIncludeGlobs(readConfig());
    expect(
      globs.length,
      `expected ≥20 include globs; got ${globs.length}`,
    ).toBeGreaterThanOrEqual(20);
    expect(
      globs,
      'the principles dir must be in the include allowlist',
    ).toContain('principles/**/*.test.ts');
    // Every glob must be a shape expandGlob understands — an unparsed glob would silently
    // drop a whole directory out of the population and make arm (a) pass for the wrong reason.
    for (const g of globs) {
      expect(
        expandGlob(PKG_ROOT, g),
        `include glob \`${g}\` is a shape expandGlob cannot expand`,
      ).not.toBeNull();
    }
    // The exclude: array must NOT be read as the population.
    expect(
      globs,
      'exclude entries must never enter the population',
    ).not.toContain('**/node_modules/**');

    const files = population();
    expect(
      files.length,
      `expected ≥200 include-matched files; got ${files.length}`,
    ).toBeGreaterThanOrEqual(200);
    expect(files, 'this very file must be in its own population').toContain(
      'principles/38-vitest-include-ci-coverage.test.ts',
    );

    const filters = parseCiVitestFilters(readWorkflows(), readScripts());
    expect(
      filters.length,
      `expected ≥8 CI filters; got ${filters.length}`,
    ).toBeGreaterThanOrEqual(8);
    expect(
      filters,
      'the principles/ dir filter must resolve through the npm script',
    ).toContain('principles/');
  });

  it('(c) resolver handles all three invocation shapes used in this repo', () => {
    const scripts = readScripts();
    // M02: carriers are valid YAML run snippets (one step, one run) instead of the old raw
    // `run: …` text lines — the resolver reads run contents from the PARSED document now. The
    // semantic assertions and expected filters are unchanged from the original arms.
    // Shape 1 — npm run <script> resolved through package.json. The trailing slash survives:
    // `vitest list hooks/` selects 0 hooks-tree-guard files, `vitest list hooks` selects 6
    // (verified against the real binary 2026-08-10), so dropping it would fake coverage.
    expect(
      parseCiVitestFilters(
        [
          'jobs:\n  t:\n    steps:\n      - run: npm --prefix packages/core run test:render',
        ],
        scripts,
      ),
    ).toEqual(['render/']);
    expect(
      uncoveredFiles(
        ['audit-self/hooks-tree-guard.test.ts'],
        ['hooks/'],
        new Set(),
      ),
      'the hooks/ step must NOT be credited with covering audit-self/hooks-tree-guard.test.ts',
    ).toEqual(['audit-self/hooks-tree-guard.test.ts']);
    // Shape 2 — npm test -- <args>; the passed filter is picked up, the reporter flag is not.
    expect(
      parseCiVitestFilters(
        [
          'jobs:\n  t:\n    steps:\n      - run: npm --prefix packages/core test --silent -- tests/acceptance/canonical-regen',
        ],
        scripts,
      ),
    ).toEqual(['tests/acceptance/canonical-regen']);
    // Shape 3 — npx with repo-root-relative paths; the packages/core/ prefix is normalised off.
    expect(
      parseCiVitestFilters(
        [
          'jobs:\n  t:\n    steps:\n      - run: npx --prefix packages/core vitest run --reporter=default packages/core/audit-self/first-steps-parity.test.ts',
        ],
        scripts,
      ),
    ).toEqual(['audit-self/first-steps-parity.test.ts']);
    // An unknown script name must contribute nothing rather than throw.
    expect(
      parseCiVitestFilters(
        [
          'jobs:\n  t:\n    steps:\n      - run: npm --prefix packages/core run test:does-not-exist',
        ],
        scripts,
      ),
    ).toEqual([]);
  });

  it('(d) paired-negative (seeded step removal): RED when a wiring step is deleted', () => {
    const scripts = readScripts();
    const files = population();

    // GREEN direction — the real workflows.
    expect(
      uncoveredFiles(files, parseCiVitestFilters(readWorkflows(), scripts)),
    ).toEqual([]);

    // RED direction — drop every line that runs test:skills and re-run the real resolver.
    const seeded = readWorkflows().map((s) =>
      s
        .split('\n')
        .filter((l) => !/run\s+test:skills\b/.test(l))
        .join('\n'),
    );
    expect(
      seeded.join('\n'),
      'the seeded mutation must actually change the workflow text',
    ).not.toBe(readWorkflows().join('\n'));

    const missing = uncoveredFiles(
      files,
      parseCiVitestFilters(seeded, scripts),
    );
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
    expect(
      seededCfg,
      'the seeded mutation must actually change the config text',
    ).not.toBe(readConfig());
    const globs = parseIncludeGlobs(seededCfg);
    expect(globs, 'the seeded glob must be parsed').toContain(
      'hooks/**/*.seeded.ts',
    );

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
    const renamed = readConfig().replace(
      /^\s*include:\s*\[\s*$/m,
      '    includes: [',
    );
    expect(
      renamed,
      'the seeded rename must actually change the config text',
    ).not.toBe(readConfig());
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

// ── M02/A02 execution-context arms (frozen fixtures 2026-10-14) ────────────────
//
// A02 (spec §7): the OLD raw-line resolver credited any line whose TEXT matched an invocation
// shape — so a command moved into a comment, a step name or an echo string still counted as
// wiring, and a legitimate backslash-continued npx invocation was mis-read. These arms pin the
// repair contract through the SAME exported resolver the real arms use.

const M02_CASES_PATH = resolve(
  REPO_ROOT,
  'docs/test-assurance-kernel/s2/m02-workflow-context-cases.json',
);
const M02_CASES_SHA256 =
  '16d2499d48000ebfade95211301c6dee06b916fa2ee20225b2b7763533eda80e';
const M02_CASE_IDS = [
  'real-npm-run',
  'real-npm-test-args',
  'real-npx-filter',
  'real-multiline-npx',
  'workflow-comment-only',
  'shell-comment-only',
  'echo-command-string',
  'step-name-only',
] as const;

/** The independently enumerated skills population frozen with the audit-self replacement
 *  (FROZEN-REAL-AUDIT-SELF-STEP-REPLACEMENT.json, sha256 1d876d28…, 2026-10-14). Kept as a
 *  literal so the mutation oracle does not recompute its expectation from the mutated input. */
const M02_FROZEN_SKILLS_POPULATION = [
  'skills/assign-skill.test.ts',
  'skills/classify-each-candidate.test.ts',
  'skills/classify-work.test.ts',
  'skills/dispatcher/advance-frontier.test.ts',
  'skills/dispatcher/dispatch.test.ts',
  'skills/dispatcher/monitor.test.ts',
  'skills/dispatcher/probe-inflight-late.test.ts',
  'skills/dispatcher/probe-inflight.test.ts',
  'skills/domain-modeling-vendored-body.test.ts',
  'skills/dup-detect-skip-closed.test.ts',
  'skills/dup-detect.test.ts',
  'skills/emit-output-strings.test.ts',
  'skills/emit-story-prompt.test.ts',
  'skills/grilling-vendored-body.test.ts',
  'skills/inflight-check.test.ts',
  'skills/integer-name-guard.test.ts',
  'skills/orch-home-resolver.test.ts',
  'skills/pipeline-english-canonical.test.ts',
  'skills/pipeline-lang-parity.test.ts',
  'skills/pipeline/frontier.test.ts',
  'skills/pipeline/priority-score-launch-table.test.ts',
  'skills/pipeline/repo-root-anchor.test.ts',
  'skills/plan-currency-check-digest.test.ts',
  'skills/plan-currency-check-kickoff.test.ts',
  'skills/plan-currency-check.test.ts',
  'skills/planner-discovery.test.ts',
  'skills/run-helper.test.ts',
  'skills/seat-lifecycle-pointer.test.ts',
  'skills/triage-rubric-label-parity.test.ts',
  'skills/upstream-skill-reference.test.ts',
] as const;

/** 2026-11-01 upstream integration renewal (Root-reviewed, unit32 safe remainder): the
 *  current expected skills population is the ORIGINAL frozen 30 above (kept verbatim — the
 *  2026-10-14 freeze stays the historical record) UNION the nine independently reviewed
 *  upstream additions, both read from the single admitted canonical carrier. The carrier is
 *  byte-pinned to the Root review: drift is a FAILURE here, never a cue to rewrite the
 *  expectation from the live population (no observed-live self-freeze, no lower bound). */
const M02_INTEGRATION_CARRIER_PATH = resolve(
  REPO_ROOT,
  'docs/test-assurance-kernel/s2/integration-bc8e758d.reviewed.json',
);
const M02_INTEGRATION_CARRIER_SHA256 =
  'b055a1e85718336427fe6405d7e1fcd0af1937407fc20ca3b913db12ffe7f052';
const M02_INTEGRATION_CARRIER = (() => {
  if (!existsSync(M02_INTEGRATION_CARRIER_PATH)) return null;
  const raw = readFileSync(M02_INTEGRATION_CARRIER_PATH);
  if (
    createHash('sha256').update(raw).digest('hex') !== M02_INTEGRATION_CARRIER_SHA256
  ) {
    throw new Error(
      'integration-bc8e758d.reviewed.json drifted from the pinned Root review — ' +
        'renewal refuses to follow unpinned expectations',
    );
  }
  return JSON.parse(raw.toString('utf8')) as {
    p38IndependentPopulationRenewal: {
      originalFrozen30: string[];
      upstreamAdded9: { path: string }[];
      expectedCurrent39: string[];
    };
  };
})();
const M02_EXPECTED_SKILLS_POPULATION = M02_INTEGRATION_CARRIER
  ? [...M02_INTEGRATION_CARRIER.p38IndependentPopulationRenewal.expectedCurrent39].sort()
  : [...M02_FROZEN_SKILLS_POPULATION].sort();

const M02_REPLACEMENT_FROM =
  '        run: npm --prefix packages/core run test:skills';
const M02_REPLACEMENT_TO =
  '        run: true\n        # npm --prefix packages/core run test:skills';

describe('Principle 38 — execution context: a credit must come from an actual run command (M02/A02)', () => {
  const raw = readFileSync(M02_CASES_PATH, 'utf8');
  const fx = JSON.parse(raw) as {
    cases: { id: string; workflow: string; expected_filters: string[] }[];
    scripts: Record<string, string>;
  };

  it('(h0) fixture binding: the frozen cases file is byte-identical and carries the eight frozen IDs', () => {
    expect(
      createHash('sha256').update(raw).digest('hex'),
      'm02-workflow-context-cases.json must stay byte-identical to the Root-frozen fixture ' +
        `(${M02_CASES_SHA256}) — change expectations only through a new frozen revision`,
    ).toBe(M02_CASES_SHA256);
    expect(
      fx.cases.map((c) => c.id),
      'the eight frozen case IDs, in frozen order',
    ).toEqual([...M02_CASE_IDS]);
  });

  it.each(fx.cases)('(h) frozen context case $id', (c) => {
    expect(
      parseCiVitestFilters([c.workflow], fx.scripts),
      `case \`${c.id}\`: filters resolved from the case workflow must equal the frozen expectation`,
    ).toEqual(c.expected_filters);
  });

  it('(i) whole-workflow delivery: a run replaced by true + comment-only evidence uncovers every skills test', () => {
    const healthy = readFileSync(
      resolve(WORKFLOW_DIR, 'audit-self.yml'),
      'utf8',
    );
    expect(
      healthy.split(M02_REPLACEMENT_FROM).length - 1,
      'the frozen replacement must target exactly one line',
    ).toBe(1);
    const faulted = healthy.replace(M02_REPLACEMENT_FROM, M02_REPLACEMENT_TO);

    const skillsFiles = population()
      .filter((f) => f.startsWith('skills/'))
      .sort();
    // Renewal consistency (only when the reviewed carrier is present): the fixed expected 39
    // must be EXACTLY the original frozen 30 plus the independently admitted 9 — an unknown
    // extra or a removal of any original fails below, never a count-only comparison.
    if (M02_INTEGRATION_CARRIER) {
      const renewal =
        M02_INTEGRATION_CARRIER.p38IndependentPopulationRenewal;
      expect(
        [
          ...new Set([
            ...renewal.originalFrozen30,
            ...renewal.upstreamAdded9.map((r) => r.path),
          ]),
        ].sort(),
        'the reviewed expected 39 must be exactly the original frozen 30 ∪ the reviewed 9',
      ).toEqual([...renewal.expectedCurrent39].sort());
      expect(
        renewal.upstreamAdded9.map((r) => r.path).filter((p) =>
          M02_FROZEN_SKILLS_POPULATION.includes(p),
        ),
        'the reviewed 9 must be genuine upstream additions, not frozen-30 re-labels',
      ).toEqual([]);
    }
    expect(
      skillsFiles,
      'the live skills/ population must equal the exact expected population — the ' +
        'original frozen 30 (no carrier) or the Root-reviewed 39 (carrier present); ' +
        'drift fails here, it is never re-frozen from the live tree',
    ).toEqual(M02_EXPECTED_SKILLS_POPULATION);

    // Healthy direction — the real workflows cover the whole skills population.
    expect(
      uncoveredFiles(
        skillsFiles,
        parseCiVitestFilters(readWorkflows(), readScripts()),
      ),
      'the unchanged workflows must leave no skills/ file uncovered',
    ).toEqual([]);

    // Faulted direction — execution replaced by `true`, old command retained ONLY as a comment.
    // The resolver must stop crediting the comment: every skills file whose ONLY coverage was
    // the faulted command drops out. Files covered by a DIFFERENT real lane stay covered — a
    // second real run is not comment-only evidence (2026-11-01 union: audit-self.yml runs
    // packages/core/skills/pipeline-park-contract.test.ts directly in another job). The
    // exception set is derived mechanically by the same frozen resolver over the non-faulted
    // sources — never hand-listed, never observed-output: population + both directions stay
    // pinned to the exact reviewed expected set.
    const faultedSources = readWorkflows().map((s) =>
      s === healthy ? faulted : s,
    );
    const otherLaneFilters = parseCiVitestFilters(
      readWorkflows().map((s) =>
        s === healthy ? healthy.replace(M02_REPLACEMENT_FROM, '') : s,
      ),
      readScripts(),
    );
    const coveredByOtherLanes = skillsFiles.filter(
      (f) => uncoveredFiles([f], otherLaneFilters).length === 0,
    );
    const missing = uncoveredFiles(
      skillsFiles,
      parseCiVitestFilters(faultedSources, readScripts()),
    );
    expect(
      missing,
      'comment-only evidence of the test:skills command must leave every skills/ test ' +
        'uncovered except those a different real lane still covers',
    ).toEqual(
      M02_EXPECTED_SKILLS_POPULATION.filter(
        (f) => !coveredByOtherLanes.includes(f),
      ),
    );
    expect(
      [...missing, ...coveredByOtherLanes].sort(),
      'uncovered-by-fault plus covered-by-other-real-lanes must partition the exact expected population',
    ).toEqual(M02_EXPECTED_SKILLS_POPULATION);
  });
});

//
// Correction 1 (M02-R1, Root independent review 2026-10-14): the script-BODY resolution
// boundary. The first repair still matched `vitest run` UNANCHORED inside a package.json
// script body, so an echo-only or comment-only body credited filters exactly like a real one.
// Root's frozen supplemental cases pin the same execution-context contract one boundary
// deeper: the BODY itself must present an actual `vitest run` command head.

const M02SB_CASES_PATH = resolve(
  REPO_ROOT,
  'docs/test-assurance-kernel/s2/m02-script-body-cases.json',
);
const M02SB_CASES_SHA256 =
  'd10fc2c6fe9d3138ab133b1f4d37cb47828b2efda9e9939185fd4c3766db9fbc';
const M02SB_CASE_IDS = [
  'real-vitest-script-body',
  'echo-only-vitest-script-body',
  'comment-only-vitest-script-body',
] as const;

describe('Principle 38 — script-body execution context: a package.json body must itself run Vitest (M02/A02 correction 1)', () => {
  const raw = readFileSync(M02SB_CASES_PATH, 'utf8');
  const fx = JSON.parse(raw) as {
    workflow: string;
    cases: { id: string; script_body: string; expected_filters: string[] }[];
  };

  it('(j0) supplemental fixture binding: byte-identical to the Root-frozen file, three frozen IDs', () => {
    expect(
      createHash('sha256').update(raw).digest('hex'),
      'm02-script-body-cases.json must stay byte-identical to the Root-frozen fixture ' +
        `(${M02SB_CASES_SHA256}) — change expectations only through a new frozen revision`,
    ).toBe(M02SB_CASES_SHA256);
    expect(
      fx.cases.map((c) => c.id),
      'the three frozen supplemental case IDs, in frozen order',
    ).toEqual([...M02SB_CASE_IDS]);
  });

  it.each(fx.cases)('(j) frozen script-body case $id', (c) => {
    expect(
      parseCiVitestFilters([fx.workflow], { 'test:skills': c.script_body }),
      `case \`${c.id}\`: the shared workflow with this script body must resolve to the frozen expectation`,
    ).toEqual(c.expected_filters);
  });
});

//
// Correction 2 (M02-C1R1, Root review 2026-10-14): the npx EXECUTABLE identity. The npx branch
// anchored only the `npx` head and then searched `vitest run` anywhere in the remaining argv —
// so an unrelated CLI invoked through npx still credited the filters named in its arguments
// (Root's live control: `npx --prefix packages/core --no-install eslint --version vitest run
// skills/` exits 0, prints v10.4.0 and runs NO Vitest, yet the resolver credited `skills/`).
// The frozen all-branch cases pin the third supported branch to the same execution-context
// contract: the executable npx resolves must BE Vitest.

const M02RB_CASES_PATH = resolve(
  REPO_ROOT,
  'docs/test-assurance-kernel/s2/m02-resolution-branch-cases.json',
);
const M02RB_CASES_SHA256 =
  'ad886c4427187e6e5165eb5597e6e353d1c1cf63fa0d22f7a043451108f56596';
const M02RB_CASE_IDS = [
  'real-npm-test-body-with-passed-filter',
  'echo-npm-test-body-must-not-credit-passed-args',
  'real-npx-vitest-subcommand',
  'different-npx-subcommand-only-mentions-vitest',
  'other-real-npx-cli-prints-version-without-running-vitest',
] as const;

describe('Principle 38 — npx executable identity: npx must actually resolve Vitest (M02/A02 correction 2)', () => {
  const raw = readFileSync(M02RB_CASES_PATH, 'utf8');
  const fx = JSON.parse(raw) as {
    cases: {
      id: string;
      workflow: string;
      scripts: Record<string, string>;
      expected_filters: string[];
    }[];
  };

  it('(k0) all-branch fixture binding: byte-identical to the Root-frozen file, five frozen IDs', () => {
    expect(
      createHash('sha256').update(raw).digest('hex'),
      'm02-resolution-branch-cases.json must stay byte-identical to the Root-frozen fixture ' +
        `(${M02RB_CASES_SHA256}) — change expectations only through a new frozen revision`,
    ).toBe(M02RB_CASES_SHA256);
    expect(
      fx.cases.map((c) => c.id),
      'the five frozen all-branch case IDs, in frozen order',
    ).toEqual([...M02RB_CASE_IDS]);
  });

  it.each(fx.cases)('(k) frozen resolution-branch case $id', (c) => {
    expect(
      parseCiVitestFilters([c.workflow], c.scripts),
      `case \`${c.id}\`: the case workflow with its scripts must resolve to the frozen expectation`,
    ).toEqual(c.expected_filters);
  });
});

//
// Correction 3 (M02-C2R1, Root review 2026-10-14): the declared finite npx option PROFILE. The
// correction-2 traversal skipped every dash-prefixed token and let `--prefix` consume ANY
// following value — so non-executing npx modes still credited filters: Root's live controls
// show `npx --prefix packages/core --help vitest run skills/` and `… --version …` exit 0
// printing npm help / 11.4.2 with NO Vitest run, and a missing prefix value (`--prefix
// --help …`) let the option token pass as the value. The frozen mode cases pin the profile
// the source already declared: only `--prefix packages/core` (exact real value) and
// standalone `--no-install` are recognized, in any supported order; help/version modes,
// unknown options, delimiters and incomplete or option-valued prefix arguments credit
// nothing.

const M02NM_CASES_PATH = resolve(
  REPO_ROOT,
  'docs/test-assurance-kernel/s2/m02-npx-mode-cases.json',
);
const M02NM_CASES_SHA256 =
  'd81f52e7b02345c69290bac19df118b43f946a6f7150f1955c24b61bf407dec3';
const M02NM_CASE_IDS = [
  'npx-help-does-not-run-vitest',
  'npx-version-does-not-run-vitest',
  'missing-prefix-value-followed-by-help-is-not-supported',
  'known-prefix-vitest-execution-control',
  'known-no-install-prefix-vitest-control',
] as const;

describe('Principle 38 — finite npx option profile: only real prefix/no-install forms execute (M02/A02 correction 3)', () => {
  const raw = readFileSync(M02NM_CASES_PATH, 'utf8');
  const fx = JSON.parse(raw) as {
    cases: {
      id: string;
      workflow: string;
      scripts: Record<string, string>;
      expected_filters: string[];
    }[];
  };

  it('(l0) npx-mode fixture binding: byte-identical to the Root-frozen file, five frozen IDs', () => {
    expect(
      createHash('sha256').update(raw).digest('hex'),
      'm02-npx-mode-cases.json must stay byte-identical to the Root-frozen fixture ' +
        `(${M02NM_CASES_SHA256}) — change expectations only through a new frozen revision`,
    ).toBe(M02NM_CASES_SHA256);
    expect(
      fx.cases.map((c) => c.id),
      'the five frozen npx-mode case IDs, in frozen order',
    ).toEqual([...M02NM_CASE_IDS]);
  });

  it.each(fx.cases)('(l) frozen npx option-mode case $id', (c) => {
    expect(
      parseCiVitestFilters([c.workflow], c.scripts),
      `case \`${c.id}\`: the case workflow must resolve to the frozen expectation`,
    ).toEqual(c.expected_filters);
  });
});
