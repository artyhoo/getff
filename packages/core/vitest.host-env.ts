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

/** True when `name` is host configuration a test must supply explicitly rather than inherit. */
export function isScrubbed(name: string): boolean {
  return SCRUBBED_EXACT.includes(name) || SCRUBBED_PREFIXES.some((p) => name.startsWith(p));
}

/** Delete every scrubbed name from `env` in place; returns the names actually removed. */
export function scrubHostEnv(env: Record<string, string | undefined>): string[] {
  const removed: string[] = [];
  for (const name of Object.keys(env)) {
    if (!isScrubbed(name)) continue;
    delete env[name];
    removed.push(name);
  }
  return removed.sort();
}
