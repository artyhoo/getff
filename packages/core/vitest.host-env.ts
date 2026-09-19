/**
 * WHICH environment variables a test must supply explicitly rather than inherit.
 *
 * PURE by design — importing this module scrubs nothing. The scrub itself is the single
 * top-level statement of `vitest.setup.ts`, the module vitest registers in `setupFiles`.
 * The split is load-bearing, not cosmetic: with the tables and the side effect in ONE
 * module, hooks/env-hermeticity.test.ts performed the scrub by importing it, so its
 * "a spawned child inherits nothing" check passed even with `setupFiles` unregistered —
 * a self-fulfilling assertion (measured 2026-09-09: the full hooks suite was 1470/1470
 * green against a config with the setup removed).
 */

/**
 * Prefix families owned entirely by this project, or by tooling whose values are inputs to
 * the artefacts under test. Prefix matching is drift-proof: a knob added to a shipped hook
 * tomorrow is scrubbed the day it lands, with no list to update.
 */
export const SCRUBBED_PREFIXES: readonly string[] = [
  'AIF_',
  'GETFF_',
  'ORCHESTRATION_MODE_',
  'RUNTIME_BRIDGE_',
  'ZCODE_',
];

/**
 * Harness- and tool-owned names the shipped hooks read as configuration. These cannot be
 * scrubbed by prefix: `CLAUDE_*` and `LOG_LEVEL` are shared namespaces whose other members
 * are irrelevant to the artefacts under test, so each entry is named deliberately.
 */
export const SCRUBBED_EXACT: readonly string[] = [
  'CLAUDE_ARGS',
  'CLAUDE_CODE_AUTO_COMPACT_WINDOW',
  'CLAUDE_CODE_SESSION_ID',
  'CLAUDE_CODE_SUBAGENT_MODEL',
  'CLAUDE_COORDINATION_DIR',
  'CLAUDE_PLUGIN_ROOT',
  'CLAUDE_PROJECT_DIR',
  'CLAUDE_SKILL_DIR',
  'LOG_LEVEL',
  'RULES_DIR_OVERRIDE',
  // Assigned from the hook payload by every caller — but `.claude/hooks/lib/hook-emit.sh:86`
  // READS it without declaring it, so an exported SESSION_ID would name the debounce flag of
  // any caller that forgot the assignment. Nothing legitimately inherits it: the session id
  // arrives on stdin.
  'SESSION_ID',
];

/**
 * Git's own repository-local environment variables — the set `git rev-parse --local-env-vars`
 * prints, verbatim and in git's order (git 2.53.0, re-derived by principle 46 on every run so
 * a new git release cannot leave this list short).
 *
 * WHY THESE ARE SCRUBBED, AND WHY IT IS NOT COSMETIC (incident 2026-09-14). A git hook runs
 * with these exported, and they OVERRIDE `cwd` — and `-C`, and the path argument — for every
 * git subprocess beneath it. Fired from a LINKED WORKTREE, `.husky/pre-push` exports
 * `GIT_DIR=<common>/.git/worktrees/<name>` and no `GIT_WORK_TREE` (measured on a fixture: git
 * exports exactly GIT_DIR, GIT_EDITOR, GIT_EXEC_PATH, GIT_PREFIX). Under that one variable,
 * `git init -q "$tmp"` exits 0, creates NOTHING at `$tmp`, and rewrites the COMMON
 * `.git/config` in place — flipping `core.bare` to `true`. The main checkout then answers
 * `fatal: this operation must be run in a work tree` to every command (linked worktrees keep
 * working, which is why the damage reads as "one broken clone" rather than as a test escaping
 * its fixture). 11 files under `packages/core/hooks/**` call `git init` (20 sites, measured
 * 2026-09-14), most with nothing but a `cwd:` option — and `cwd` is not isolation for a git
 * subprocess.
 *
 * Scrubbing the whole family here closes the class for EVERY vitest file in this package at
 * once — including a suite the pre-push hook does not run today but might tomorrow — which no
 * number of per-call-site `env:` options can do. Upstream precedent, and the reason this is a
 * derived list rather than a hand-written one: git's own `githooks(5)` prescribes
 * `unset $(git rev-parse --local-env-vars)` before touching a foreign repository.
 *
 * NOT a `GIT_` prefix rule: `GIT_EXEC_PATH`, `GIT_EDITOR`, `GIT_CONFIG_GLOBAL` and friends are
 * process-structural or deliberately-set by individual tests, and scrubbing them by prefix
 * would break git itself. git draws the repository-local line; this list follows it.
 */
export const GIT_REPO_LOCAL_ENV: readonly string[] = [
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_CONFIG',
  'GIT_CONFIG_PARAMETERS',
  'GIT_CONFIG_COUNT',
  'GIT_OBJECT_DIRECTORY',
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_IMPLICIT_WORK_TREE',
  'GIT_GRAFT_FILE',
  'GIT_INDEX_FILE',
  'GIT_NO_REPLACE_OBJECTS',
  'GIT_REPLACE_REF_BASE',
  'GIT_PREFIX',
  'GIT_SHALLOW_FILE',
  'GIT_COMMON_DIR',
];

/** True when `name` is host configuration a test must supply explicitly rather than inherit. */
export function isScrubbed(name: string): boolean {
  return (
    SCRUBBED_EXACT.includes(name) ||
    GIT_REPO_LOCAL_ENV.includes(name) ||
    SCRUBBED_PREFIXES.some((p) => name.startsWith(p))
  );
}

/** Delete every scrubbed name from `env` in place; returns the names actually removed. */
export function scrubHostEnv(
  env: Record<string, string | undefined>,
): string[] {
  const removed: string[] = [];
  for (const name of Object.keys(env)) {
    if (!isScrubbed(name)) continue;
    delete env[name];
    removed.push(name);
  }
  return removed.sort();
}
