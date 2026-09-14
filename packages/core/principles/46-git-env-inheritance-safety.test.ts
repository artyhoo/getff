/**
 * Principle 46 — a test must not be able to write to the repository that invoked it.
 *
 * Mechanism, fix and channel choice: `46-git-env-inheritance-safety.ts`. This file is the
 * gate, in six live arms plus nine paired negatives.
 *
 * THE ARM THAT MATTERS IS (D), AND IT IS THE ONLY ONE THAT IS NON-VACUOUS ON A CLEAN RUNNER.
 * Name-shaped arms — "GIT_DIR is in the table", "a spawned child carries none of the scrubbed
 * names" — are green wherever GIT_DIR was never set, which is every CI runner, i.e. exactly
 * where this suite gates. Arm (D) therefore asserts on the DAMAGE: it builds a decoy repository
 * with a linked worktree, plants the variable on a child's env object only, and compares the
 * decoy's `core.bare` with and without the scrub. The two halves differ by the `scrubHostEnv`
 * call and nothing else.
 *
 * Two fixture facts, both measured on 2026-09-14 with git 2.53.0, both load-bearing:
 *   · GIT_DIR must point at a WORKTREE ADMIN dir (`<repo>/.git/worktrees/<name>`). Pointed at a
 *     plain `<repo>/.git`, `git init` still ignores its path argument but `core.bare` stays
 *     `false` — a fixture built that way reproduces the wrong-target half and NOT the
 *     corruption, and would look green for the wrong reason.
 *   · `git init` creates NOTHING at the path it was given. Asserting the absence of that
 *     directory is what distinguishes "the init was redirected" from "the init also ran".
 *
 * `process.env` is never mutated here: the planted variable lives on a throwaway object handed
 * to one child. A gate that set GIT_DIR on itself would be the incident.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isScrubbed,
  scrubHostEnv,
  GIT_REPO_LOCAL_ENV,
} from '../vitest.host-env.ts';
import {
  bareViolation,
  commonConfigPath,
  deriveGitRepoLocalEnv,
  EXPLICIT_SCRUB_MARKERS,
  gitEnvScrubGaps,
  gitInitSites,
  globToRegExp,
  hasExplicitScrub,
  isCoveredByVitest,
  parseVitestIncludeGlobs,
  readCoreBare,
  uncoveredSites,
  withoutGitRepoEnv,
  type GitInitSite,
} from './46-git-env-inheritance-safety.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const CORE = resolve(HERE, '..');
const REPO_ROOT = resolve(CORE, '../..');

/** Environment for every git call this file makes — the family removed, dogfooding the fix. */
const SAFE_ENV = withoutGitRepoEnv(process.env, GIT_REPO_LOCAL_ENV);

function git(
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv = SAFE_ENV,
): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/**
 * A decoy repository with a linked worktree, standing in for the real clone.
 *
 * Returns the admin directory of the linked worktree — the value a pre-push hook fired from a
 * worktree exports as GIT_DIR — and the path of the COMMON config the defect rewrites.
 */
function decoyRepo(): { adminDir: string; commonConfig: string; root: string } {
  const root = mkdtempSync(join(tmpdir(), 'p46-decoy-'));
  git(['init', '-q', '-b', 'main', '.'], root);
  git(['config', 'user.email', 'p46@example.com'], root);
  git(['config', 'user.name', 'p46'], root);
  git(['config', 'commit.gpgsign', 'false'], root);
  writeFileSync(join(root, 'seed.txt'), 'seed\n');
  git(['add', '-A'], root);
  git(['commit', '-qm', 'seed'], root);
  git(['worktree', 'add', '-q', join(root, 'wt'), '-b', 'topic'], root);
  return {
    root,
    adminDir: join(root, '.git/worktrees/wt'),
    commonConfig: join(root, '.git/config'),
  };
}

describe('principle 46 — git repository-local env must not reach a test subprocess', () => {
  // ── (A) precondition / non-vacuity ─────────────────────────────────────────
  it('(A) the population is enumerable and non-empty', () => {
    const sites = gitInitSites(REPO_ROOT, GIT_REPO_LOCAL_ENV);
    // 59 occurrences across 18 files at authoring time (2026-09-14), 26 of them the prose of
    // this gate itself — `gitInitSites` counts a mention in a comment, deliberately. The floor is
    // far below that: this arm exists to catch a `git grep` that silently answered nothing — an
    // empty population would make arm (F) pass vacuously — not to freeze a count that legitimate
    // refactors move.
    expect(
      sites.length,
      'git grep found `git init` call sites under packages/core',
    ).toBeGreaterThan(10);
    expect(new Set(sites.map((s) => s.file)).size).toBeGreaterThan(5);
  });

  // ── (B) the scrub table covers everything git calls repository-local ───────
  it('(B) every name `git rev-parse --local-env-vars` prints is scrubbed', () => {
    const derived = deriveGitRepoLocalEnv(REPO_ROOT);
    expect(
      derived,
      'git still answers the question this gate derives from',
    ).toContain('GIT_DIR');
    const gaps = gitEnvScrubGaps(derived, isScrubbed);
    expect(
      gaps,
      'a git release added a repository-local variable — add it to GIT_REPO_LOCAL_ENV in packages/core/vitest.host-env.ts',
    ).toEqual([]);
  });

  // ── (C) the scrub is REGISTERED, not merely declared ───────────────────────
  it('(C) both vitest configs register the setup file that performs the scrub', () => {
    // The falsifier this arm is built around is "delete the registration", not "delete the list
    // entry": packages/core/hooks/env-hermeticity.test.ts once passed against a config with
    // `setupFiles` removed, because importing the tables module performed the scrub and the
    // assertion became self-fulfilling. Arm (B) checks the list; this one checks it is wired;
    // arm (D) checks it actually prevents the damage.
    for (const [cfg, entry] of [
      ['packages/core/vitest.config.ts', './vitest.setup.ts'],
      ['vitest.config.ts', './packages/core/vitest.setup.ts'],
    ] as const) {
      const src = readFileSync(resolve(REPO_ROOT, cfg), 'utf8');
      expect(src, `${cfg} must register ${entry} in setupFiles`).toContain(
        `setupFiles: ['${entry}']`,
      );
    }
  });

  // ── (D) the damage arm — the one that is not vacuous on CI ────────────────
  it('(D) an inherited GIT_DIR corrupts a decoy repo, and the scrub prevents it', () => {
    // NEGATIVE half: the defect, reproduced. The variable is planted on a child env object only.
    const victim = decoyRepo();
    expect(
      readCoreBare(victim.commonConfig, REPO_ROOT),
      'fixture precondition',
    ).toBe('false');
    const target = mkdtempSync(join(tmpdir(), 'p46-target-'));
    const leaked: NodeJS.ProcessEnv = { ...SAFE_ENV, GIT_DIR: victim.adminDir };
    git(['init', '-q', join(target, 'fresh')], target, leaked);
    expect(
      readCoreBare(victim.commonConfig, REPO_ROOT),
      'an inherited GIT_DIR redirects `git init` into the COMMON config of the repo that exported it',
    ).toBe('true');
    expect(
      existsSync(join(target, 'fresh/.git')),
      '`git init` creates nothing at the path it was given — the argument is ignored outright',
    ).toBe(false);

    // POSITIVE half: same object, same command, one scrub call between them.
    const saved = decoyRepo();
    const scrubbed: NodeJS.ProcessEnv = {
      ...SAFE_ENV,
      GIT_DIR: saved.adminDir,
    };
    scrubHostEnv(scrubbed);
    const target2 = mkdtempSync(join(tmpdir(), 'p46-target-'));
    git(['init', '-q', join(target2, 'fresh')], target2, scrubbed);
    expect(
      readCoreBare(saved.commonConfig, REPO_ROOT),
      'after scrubHostEnv the decoy repository is untouched',
    ).toBe('false');
    expect(
      existsSync(join(target2, 'fresh/.git')),
      'and the init landed where it was told to',
    ).toBe(true);
  });

  // ── (E) the observable state of THIS repository ───────────────────────────
  it('(E) the shared repository config does not claim the repository is bare', () => {
    const configFile = commonConfigPath(REPO_ROOT);
    const violation = bareViolation(configFile, REPO_ROOT);
    expect(
      violation,
      violation === null
        ? ''
        : `${configFile} has core.bare=true — the main checkout cannot run any command needing a work tree.\n` +
            `   Repair: git -C <clone root> config core.bare false\n` +
            "   Cause: a `git init` run with an inherited GIT_DIR (see this principle's module header).",
    ).toBeNull();
  });

  // ── (F) no `git init` site sits outside the scrub's reach ─────────────────
  it('(F) every `git init` site under packages/core is covered by the scrub or scrubs itself', () => {
    const globs = parseVitestIncludeGlobs(
      readFileSync(resolve(CORE, 'vitest.config.ts'), 'utf8'),
    );
    const sites = gitInitSites(REPO_ROOT, GIT_REPO_LOCAL_ENV);
    const uncovered = uncoveredSites(sites, globs, (f) =>
      readFileSync(resolve(REPO_ROOT, f), 'utf8'),
    );
    expect(
      uncovered.map((s) => `${s.file}:${s.line}`),
      'a `git init` here runs with whatever GIT_DIR the caller exported — either bring the file ' +
        'under the vitest include globs, or unset `$(git rev-parse --local-env-vars)` in it',
    ).toEqual([]);
  });
});

describe('principle 46 — paired negatives', () => {
  const GLOBS = ['hooks/**/*.test.ts', 'principles/**/*.test.ts'];
  const site = (file: string): GitInitSite => ({
    file,
    line: 1,
    text: 'git init -q',
  });

  it('N46-1: bare=true is a violation, bare=false is not', () => {
    const dir = mkdtempSync(join(tmpdir(), 'p46-cfg-'));
    const red = join(dir, 'red');
    const green = join(dir, 'green');
    writeFileSync(red, '[core]\n\tbare = true\n');
    writeFileSync(green, '[core]\n\tbare = false\n');
    expect(bareViolation(red, REPO_ROOT)).toEqual({ file: red, value: 'true' });
    expect(bareViolation(green, REPO_ROOT)).toBeNull();
  });

  it('N46-2: `bare` under another section is not core.bare', () => {
    const f = join(mkdtempSync(join(tmpdir(), 'p46-cfg-')), 'cfg');
    writeFileSync(f, '[remote "origin"]\n\tbare = true\n');
    expect(bareViolation(f, REPO_ROOT)).toBeNull();
  });

  it('N46-3: a commented-out setting is not a violation, and an absent key is not either', () => {
    const dir = mkdtempSync(join(tmpdir(), 'p46-cfg-'));
    const commented = join(dir, 'commented');
    const empty = join(dir, 'empty');
    writeFileSync(commented, '[core]\n\t# bare = true\n');
    writeFileSync(empty, '[core]\n\tfilemode = true\n');
    expect(bareViolation(commented, REPO_ROOT)).toBeNull();
    expect(readCoreBare(empty, REPO_ROOT)).toBeUndefined();
    expect(bareViolation(empty, REPO_ROOT)).toBeNull();
  });

  it('N46-4: a scrub table missing GIT_DIR is reported as a gap', () => {
    const derived = ['GIT_DIR', 'GIT_WORK_TREE'];
    expect(gitEnvScrubGaps(derived, (n) => n === 'GIT_WORK_TREE')).toEqual([
      'GIT_DIR',
    ]);
    expect(gitEnvScrubGaps(derived, () => true)).toEqual([]);
  });

  it('N46-5: a site outside the include globs is uncovered; inside, it is covered', () => {
    const read = () => 'execSync("git init", { cwd: dir })';
    expect(
      uncoveredSites([site('packages/core/hooks/a.test.ts')], GLOBS, read),
    ).toEqual([]);
    expect(
      uncoveredSites(
        [site('packages/core/synthesizer/x.test.sh')],
        GLOBS,
        read,
      ).map((s) => s.file),
    ).toEqual(['packages/core/synthesizer/x.test.sh']);
  });

  it('N46-6: an out-of-globs site that scrubs for itself is covered', () => {
    const scrubbed = () =>
      'unset $(git rev-parse --local-env-vars)\ngit init -q "$T"';
    expect(
      uncoveredSites(
        [site('packages/core/synthesizer/x.test.sh')],
        GLOBS,
        scrubbed,
      ),
    ).toEqual([]);
    expect(hasExplicitScrub('execSync("git init", { cwd: dir })')).toBe(false);
    // The escape is FILE-scope, so a per-command marker must not buy the whole file. This is
    // the real shape found in cold review: one `env -u GIT_DIR` on a `rev-parse`, four
    // unprotected `git init`s below it.
    expect(
      hasExplicitScrub(
        'R=$(env -u GIT_DIR git rev-parse --show-toplevel)\ngit init -q "$T"',
      ),
      'a one-name per-command marker does not cover the file',
    ).toBe(false);
    expect(EXPLICIT_SCRUB_MARKERS).not.toContain('env -u GIT_DIR');
  });

  it('N46-7: a non-test file under a covered directory is NOT covered by a `*.test.ts` glob', () => {
    // The include globs end in `*.test.ts`; a helper module beside the tests is loaded by
    // vitest only as an import OF one, so it must not be waved through on directory alone.
    expect(isCoveredByVitest('hooks/helper.ts', GLOBS)).toBe(false);
    expect(isCoveredByVitest('hooks/checks/deep.test.ts', GLOBS)).toBe(true);
    expect(isCoveredByVitest('hooks/a.test.ts', GLOBS)).toBe(true);
    expect(globToRegExp('hooks/**/*.test.ts').test('hooksX/a.test.ts')).toBe(
      false,
    );
  });

  it('N46-8: withoutGitRepoEnv removes the family and leaves everything else alone', () => {
    const env = { GIT_DIR: '/a', GIT_EXEC_PATH: '/b', PATH: '/usr/bin' };
    expect(withoutGitRepoEnv(env, ['GIT_DIR'])).toEqual({
      GIT_EXEC_PATH: '/b',
      PATH: '/usr/bin',
    });
    expect(env.GIT_DIR, 'the input object is not mutated').toBe('/a');
    expect(() =>
      parseVitestIncludeGlobs('export default { test: {} }'),
    ).toThrow(/include/);
  });

  it('N46-9: an unreadable config throws instead of reading as healthy', () => {
    // `git config --get` uses status 1 for "absent" and 128 for "I could not answer". Only the
    // first is a clean repository. A `catch { return undefined }` would report the corrupt
    // shared config — the exact file this gate watches — as not bare, which is the tool failure
    // silently substituting a different answer that `deriveGitRepoLocalEnv` refuses to make.
    const dir = mkdtempSync(join(tmpdir(), 'p46-badcfg-'));
    const bad = join(dir, 'config');
    writeFileSync(bad, '[core]\n\tbare = maybe\n');
    expect(
      () => readCoreBare(bad, dir),
      'status 128 must not be swallowed',
    ).toThrow();
    expect(() => bareViolation(bad, dir)).toThrow();

    // Paired direction: the absent cases stay quiet, so the rethrow did not swallow arm N46-3.
    expect(readCoreBare(join(dir, 'no-such-file'), dir)).toBeUndefined();
    const empty = join(dir, 'empty');
    writeFileSync(empty, '[core]\n\trepositoryformatversion = 0\n');
    expect(readCoreBare(empty, dir)).toBeUndefined();
    expect(bareViolation(empty, dir)).toBeNull();
  });
});
