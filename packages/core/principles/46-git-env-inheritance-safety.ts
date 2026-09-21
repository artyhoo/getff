/**
 * Principle 46 — a test must not be able to write to the repository that invoked it.
 *
 * THE DEFECT, MEASURED (2026-09-14, git 2.53.0, reproduced on a throwaway fixture — never on
 * the live clone). A git hook runs with git's repository-local environment exported, and those
 * variables OVERRIDE `cwd`, `-C`, and even a command's own path argument. `.husky/pre-push`
 * fired from a LINKED WORKTREE exports exactly `GIT_DIR=<common>/.git/worktrees/<name>`,
 * `GIT_EDITOR`, `GIT_EXEC_PATH`, `GIT_PREFIX` — and no `GIT_WORK_TREE`. With that single
 * variable set, `git init -q "$tmp"`:
 *
 *   - exits 0,
 *   - creates NOTHING at `$tmp`, and
 *   - re-initialises the repository named by GIT_DIR, writing `bare = true` into the COMMON
 *     `.git/config` — the file every linked worktree of the clone shares.
 *
 * `--bare` is not the trigger; plain `git init <path>` does it identically. Afterwards the MAIN
 * checkout answers `fatal: this operation must be run in a work tree` to `git status`,
 * `git rev-parse --show-toplevel` and anything else needing a work tree. Linked worktrees keep
 * working (measured on both a sibling and a nested `.claude/worktrees/<name>` layout), which is
 * precisely why the damage is silent: the session that caused it sees nothing wrong.
 *
 * WHICH CALLER FIRED IT — INCONCLUSIVE, and it stays that way. `.git/config`'s mtime is now the
 * repair, not the damage, and the reflog shows at least four worktrees active inside the window,
 * so no artefact left on disk distinguishes them. `scripts/build-getff-dist.sh` — the circumstantial
 * suspect — is exonerated by reading: it touches git once, `git -C "$ROOT" ls-files -z`, a read.
 * The mechanism above is proven independently of attribution, and this gate does not depend on
 * which caller fired: it asserts the state and the coverage, never a culprit.
 *
 * THE FIX THIS GATE PROTECTS. `packages/core/vitest.setup.ts` scrubs host state out of
 * `process.env` before any test module loads; `GIT_REPO_LOCAL_ENV` in
 * `packages/core/vitest.host-env.ts` puts git's whole repository-local family in that scrub, so
 * every vitest file in this package is safe by construction — including suites the pre-push
 * hook does not run today. That is one edit instead of ~30 per-call-site `env:` options, and
 * unlike them it also covers a call site added tomorrow.
 *
 * WHY A PRINCIPLE TEST AND NOT A PRE-PUSH SECTION. Same fork PR #1784 settled for principle 45,
 * same answer: the invariant is relational over the whole repository and over shared state, so
 * it is not change-scoped — a change-scoped arm is green whenever only the other side moves.
 * Principle tests already run at pre-push through `principlesMetaSection`
 * (`packages/core/hooks/pre-push.ts:1661`), so this is the earliest reachable channel for a
 * repo-wide property, not a retreat to CI. And the channel is reachable when it matters:
 * `core.bare=true` does not break linked worktrees, so a push from one still runs this suite.
 *
 * DECLARED LIMIT — the class is NOT closed repo-wide, and the numbers say by how much. Measured
 * 2026-09-14 with the same `git grep -n -I -F 'git init'` this module runs, over the tree as this
 * change leaves it: 264 sites repo-wide, of which this gate's population (`packages/core`, the
 * pathspecs below) is 59 sites in 18 files. Read that 59 with the over-report this module declares
 * under `gitInitSites`: 26 of them are the prose of THIS file and its test, which name the command
 * while executing nothing. The remaining 205 split three ways, and the split is exhaustive: 154
 * sites in 78 files under `tests/**` plus 2 under `scripts/**` — shell, not vitest, so
 * `setupFiles` does not reach them and nothing here gates them; and 49 elsewhere that no git hook
 * can reach at all — 5 CI `run:` steps in `.github/workflows/audit-self.yml`, 2 shell scripts run
 * by hand (`demo/setup-sandbox.sh:17` and
 * `.claude/orchestrator-prompts/launch-preannounce-track/s5-probes/probe-zcode-hooks.sh:46`), and
 * 42 occurrences that execute nothing anywhere — Markdown prose, kickoffs, one JSON census with
 * its `.mjs` generator, and 4 comment/`echo` lines in `setup.d/45-python.sh`.
 *
 * They are out of scope because they are out of the hazard's REACH, not because they are safe by
 * spelling: no shell script any git hook invokes runs `git init` at all (swept 2026-09-14 over the
 * `.husky/pre-commit` body, `pre-push.fallback.sh` and every script `pre-push.ts` shells out to),
 * so nothing exports a repository-local environment into them. Reachability, not spelling, defines
 * the population — the day a hook starts invoking one of those suites, `POPULATION_PATHSPECS`
 * below needs widening, and this paragraph is the sweep that would notice.
 *
 * Prior art: git's own `githooks(5)` prescribes `unset $(git rev-parse --local-env-vars)`
 * before touching a foreign repository. That command is the SSOT for the family, so this module
 * re-derives it from the running git rather than trusting a checked-in list.
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

/**
 * A copy of `env` with git's repository-local variables removed.
 *
 * Every git call in this module goes through it. Self-application is not decoration here: this
 * file is a principle test, principle tests run under `.husky/pre-push`, and a gate that
 * corrupted the checkout while checking it for corruption would be the defect it describes.
 */
export function withoutGitRepoEnv(
  env: NodeJS.ProcessEnv,
  names: readonly string[],
): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = { ...env };
  for (const name of names) delete out[name];
  return out;
}

/** Bootstrap list for the very first git call — the one that asks git for the real list. */
const BOOTSTRAP_LOCAL_ENV = [
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_COMMON_DIR',
  'GIT_INDEX_FILE',
];

function git(
  args: string[],
  cwd: string,
  names: readonly string[] = BOOTSTRAP_LOCAL_ENV,
): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: withoutGitRepoEnv(process.env, names),
  });
}

/**
 * The repository-local variable names, asked of the git that is actually running.
 *
 * Derived, never declared: a future git release that adds a name would otherwise leave the
 * scrub table short with nothing to notice. Throws rather than degrading — an empty list would
 * make every arm below pass vacuously (the `packages/core/principles/33-adapter-jig-arm-registry.ts`
 * precedent: a tool failure must not silently substitute a different population).
 */
export function deriveGitRepoLocalEnv(cwd: string): string[] {
  const out = git(['rev-parse', '--local-env-vars'], cwd)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (out.length === 0) {
    throw new Error(
      '`git rev-parse --local-env-vars` produced no names — cannot derive the family',
    );
  }
  return out;
}

/** Names git owns that `declared` does not cover — the drift this gate exists to catch. */
export function gitEnvScrubGaps(
  derived: readonly string[],
  isScrubbed: (n: string) => boolean,
): string[] {
  return derived.filter((n) => !isScrubbed(n));
}

/**
 * Absolute path of the COMMON repository config — the file the defect rewrites.
 *
 * `--git-common-dir` and not `--git-dir`: from a linked worktree the latter names the worktree's
 * own admin directory, whose `config` is not where `core.bare` lands (this repo does not enable
 * `extensions.worktreeConfig`). Resolved against `cwd` because git answers relatively from a
 * plain checkout (`.git`) and absolutely from a worktree.
 */
export function commonConfigPath(cwd: string): string {
  return resolve(
    cwd,
    git(['rev-parse', '--git-common-dir'], cwd).trim(),
    'config',
  );
}

/**
 * `core.bare` as git itself parses `configFile`, or `undefined` when the key is absent.
 *
 * Read through `git config --file` rather than by parsing INI here: section scoping, comment
 * handling and boolean spellings (`true` / `yes` / `1`) are git's problem, and a hand-rolled
 * parser would be a second, divergent answer to a question git already answers.
 *
 * Exit status is load-bearing and only ONE value means "absent" (measured, git 2.53.0):
 *
 *   `bare = true`   → prints `true`,  status 0
 *   key or file absent →  prints nothing, status 1
 *   `bare = maybe`  → `fatal: bad boolean config value 'maybe' for 'core.bare'`, status 128
 *
 * A bare `catch { return undefined }` would report status 128 — an unreadable or corrupt shared
 * config, which is the very file this gate watches — as a healthy repository. That is the tool
 * failure silently substituting a different answer that `deriveGitRepoLocalEnv` above refuses to
 * do, so this rethrows everything but 1, the same split `gitInitSites` makes for `git grep`.
 */
export function readCoreBare(
  configFile: string,
  cwd: string,
): string | undefined {
  try {
    return git(
      ['config', '--file', configFile, '--type=bool', '--get', 'core.bare'],
      cwd,
    ).trim();
  } catch (e) {
    if ((e as { status?: number }).status === 1) return undefined;
    throw e;
  }
}

export interface BareViolation {
  readonly file: string;
  readonly value: string;
}

/**
 * A violation when the shared config claims the repository is bare.
 *
 * Absent key is NOT a violation: `git init` writes `bare = false` explicitly, but a config
 * hand-trimmed to the minimum is a working non-bare repository too, and git's own default for
 * a `.git` directory beside a work tree is non-bare.
 */
export function bareViolation(
  configFile: string,
  cwd: string,
): BareViolation | null {
  const value = readCoreBare(configFile, cwd);
  return value === 'true' ? { file: configFile, value } : null;
}

export interface GitInitSite {
  readonly file: string;
  readonly line: number;
  readonly text: string;
}

/**
 * Pathspecs of the population: code under `packages/core` that could run with a hook's
 * environment inherited. Markdown and fixtures-as-data are excluded — a `git init` inside prose
 * executes nothing.
 */
export const POPULATION_PATHSPECS: readonly string[] = [
  'packages/core/**/*.ts',
  'packages/core/**/*.mts',
  'packages/core/**/*.js',
  'packages/core/**/*.mjs',
  'packages/core/**/*.cjs',
  'packages/core/**/*.sh',
];

/**
 * Every `git init` occurrence in the population, from `git grep` over TRACKED files.
 *
 * Tracked-only is deliberate: an untracked scratch file cannot be the thing a future push
 * regresses, and the assembled `packages/getff/` payload — a gitignored copy of this whole tree —
 * would otherwise double every site (the same duplicate the root vitest config excludes, see
 * its `packages/getff/**` note).
 *
 * Over-reports rather than under-reports: a `git init` named in a COMMENT counts as a site. That
 * is the safe direction for a coverage gate, and costs nothing because coverage is per-file.
 */
export function gitInitSites(
  repoRoot: string,
  names: readonly string[],
): GitInitSite[] {
  let out: string;
  try {
    out = git(
      [
        'grep',
        '-n',
        '-I',
        '--fixed-strings',
        'git init',
        '--',
        ...POPULATION_PATHSPECS,
      ],
      repoRoot,
      names,
    );
  } catch (e) {
    // `git grep` exits 1 for "no matches", which the non-vacuity arm turns into a loud failure.
    // Any other status is a tool failure and must not read as an empty population.
    const status = (e as { status?: number }).status;
    if (status === 1) return [];
    throw e;
  }
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const m = /^([^:]+):(\d+):(.*)$/.exec(line);
      if (!m) throw new Error(`unparseable \`git grep\` line: ${line}`);
      return { file: m[1]!, line: Number(m[2]), text: m[3]! };
    });
}

/**
 * The `include:` globs of `packages/core/vitest.config.ts`, parsed out of the config source.
 *
 * Parsed, not restated: the scrub reaches exactly the files vitest loads, so the coverage
 * question is "is this file in the config's include list", and a second copy of that list here
 * would answer a different question the day the config moves.
 */
export function parseVitestIncludeGlobs(configSrc: string): string[] {
  const block = /include:\s*\[([\s\S]*?)\]/.exec(configSrc);
  if (!block) throw new Error('no `include: [...]` block in the vitest config');
  const globs = [...block[1]!.matchAll(/'([^']+)'/g)].map((m) => m[1]!);
  if (globs.length === 0)
    throw new Error('the `include: [...]` block parsed to zero globs');
  return globs;
}

/** `dir/ ** /*.test.ts` → RegExp. Only the two shapes the config uses; anything else throws. */
export function globToRegExp(glob: string): RegExp {
  if (!/^[A-Za-z0-9_-]+\/\*\*\/\*\.[A-Za-z.]+$/.test(glob)) {
    throw new Error(`unsupported include glob shape: ${glob}`);
  }
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, '(?:.*/)?')
    .replace(/\*/g, '[^/]*');
  return new RegExp(`^${escaped}$`);
}

/** True when vitest loads this file, i.e. `vitest.setup.ts` scrubbed its environment first. */
export function isCoveredByVitest(
  relFromCore: string,
  globs: readonly string[],
): boolean {
  return globs.some((g) => globToRegExp(g).test(relFromCore));
}

/**
 * Markers of a file that scrubs the git environment for ITSELF — the escape for a file vitest
 * never loads. The verdict is per FILE, so only FILE-SCOPE spellings may appear here:
 * `unset $(git rev-parse --local-env-vars)` at the top of a script, or a `GIT_ENV_SCRUB` table
 * a module hands to every child it spawns. Both cover every `git init` below them, subshells
 * included.
 *
 * `env -u GIT_DIR` is deliberately NOT accepted, though this repo uses it and it is correct
 * where it appears. It is PER-COMMAND and scrubs one name, so a file-scope substring test would
 * read it as covering sites it never touches: `packages/core/synthesizer/run-generated-rule-mutation.test.sh`
 * writes it on the `rev-parse` at `:41` and then runs four unprotected `git init`s at `:117`,
 * `:118`, `:131`, `:132` — the whole file passed this gate on one line that protects none of
 * them (found in cold review, 2026-09-14; the file now carries the file-scope `unset` instead).
 * Accepting a one-name marker as full coverage would also contradict this module's own header,
 * which rejects a 7-name hand list as insufficient.
 */
export const EXPLICIT_SCRUB_MARKERS: readonly string[] = [
  '--local-env-vars',
  'GIT_ENV_SCRUB',
];

export function hasExplicitScrub(fileText: string): boolean {
  return EXPLICIT_SCRUB_MARKERS.some((m) => fileText.includes(m));
}

/**
 * The sites nothing protects: not loaded by vitest, and carrying no scrub of their own.
 *
 * `readFile` is injected so the paired negatives can drive this over a synthetic population
 * without writing files.
 */
export function uncoveredSites(
  sites: readonly GitInitSite[],
  globs: readonly string[],
  readFile: (repoRelPath: string) => string,
): GitInitSite[] {
  const verdictByFile = new Map<string, boolean>();
  return sites.filter((s) => {
    if (!verdictByFile.has(s.file)) {
      const relFromCore = s.file.replace(/^packages\/core\//, '');
      verdictByFile.set(
        s.file,
        isCoveredByVitest(relFromCore, globs) ||
          hasExplicitScrub(readFile(s.file)),
      );
    }
    return !verdictByFile.get(s.file);
  });
}
