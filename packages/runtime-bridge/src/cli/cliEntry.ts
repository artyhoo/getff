// packages/runtime-bridge/src/cli/cliEntry.ts
/**
 * Shared entrypoint plumbing for every runtime-bridge CLI: the main-module guard
 * and argv parsing. Both used to be copy-pasted per CLI, and both had defects the
 * copies did not share (#1597 review ledger A6-1 / A6-4 / A6-7 / R-6).
 *
 * `isMain` — realpath BOTH sides. `fileURLToPath(import.meta.url) === process.argv[1]`
 * compares a RESOLVED path against a possibly-symlinked one, so invoking a CLI through
 * a symlink (`node_modules/.bin`, a `bin/` shim, an absolute path under macOS
 * /tmp → /private/tmp) made the guard false and the CLI exited 0 having done nothing,
 * silently (A6-1). dispatch.ts + claim.ts already carried the realpath form (#968);
 * this is that fix, applied once for all of them.
 *
 * `parseCliArgs` — a thin wrapper over node:util `parseArgs` (Node ≥18.3 built-in; no
 * new dependency). The hand-rolled `argv.indexOf(flag) + 1` lookup accepted three
 * shapes it should have rejected:
 *   - `--task --json`        → taskId '--json' (A6-7: the next FLAG became the value)
 *   - `--base staging <id>`  → taskId 'staging' (A6-4: "first non-`--` token" picked
 *                              up a flag's value when the flag came first)
 *   - `--taks t1`            → silently ignored (typo'd flag = missing required arg)
 * `parseArgs` rejects all three natively (ERR_PARSE_ARGS_*); the two rules it does NOT
 * have — an empty `--flag=` value, and positional junk beyond what the CLI accepts —
 * are added here.
 *
 * @cc-only-rationale: pure TS over Node built-ins — no CC-only primitive, no paid LLM.
 */
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

/**
 * True only when THIS module is the executed script — never when it is imported for
 * its named exports (an import must be side-effect-free: under vitest a top-level
 * main() hits process.exit, which the runner turns into an unhandled rejection).
 *
 * Both sides are realpath'd, so a symlinked invocation path still matches. A path
 * that cannot be resolved (deleted, permission) answers false rather than throwing —
 * a CLI must not crash in its own entry guard.
 */
export function isMain(importMetaUrl: string, argv1: string | undefined = process.argv[1]): boolean {
  if (!argv1) return false;
  try {
    return realpathSync(argv1) === realpathSync(fileURLToPath(importMetaUrl));
  } catch {
    return false;
  }
}

/** A bad invocation (unknown flag, missing/ambiguous value, positional junk). CLIs map it to exit 1. */
export class CliArgError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliArgError';
  }
}

/** Option table in node:util `parseArgs` shape (only the subset the CLIs use). */
export type CliOptions = Readonly<Record<string, { readonly type: 'string' | 'boolean' }>>;

/** The `options` field of a strict node:util parseArgs config. */
type ParseArgsOptions = Record<string, { type: 'string' | 'boolean' }>;

export interface CliArgSpec {
  readonly options: CliOptions;
  /** How many bare (non-flag) arguments the CLI accepts. Default 0. */
  readonly maxPositionals?: number;
}

export interface ParsedCliArgs {
  values: Record<string, string | boolean | undefined>;
  positionals: string[];
}

/**
 * Parse argv strictly. Throws {@link CliArgError} on every malformed shape rather
 * than guessing — a guessed task id reaches the REST API as a 404 the operator then
 * has to reverse-engineer (the A6-4 / A6-7 failure mode).
 */
export function parseCliArgs(argv: string[], spec: CliArgSpec): ParsedCliArgs {
  const maxPositionals = spec.maxPositionals ?? 0;
  let parsed: { values: Record<string, unknown>; positionals: string[] };
  try {
    parsed = parseArgs({
      args: argv,
      options: spec.options as ParseArgsOptions,
      allowPositionals: maxPositionals > 0,
      strict: true,
    }) as { values: Record<string, unknown>; positionals: string[] };
  } catch (err) {
    throw new CliArgError(err instanceof Error ? err.message : String(err));
  }

  for (const [name, value] of Object.entries(parsed.values)) {
    if (value === '') {
      throw new CliArgError(`--${name} was given an empty value (expected --${name} <value>)`);
    }
  }
  if (parsed.positionals.length > maxPositionals) {
    throw new CliArgError(
      `unexpected argument '${parsed.positionals[maxPositionals]}' ` +
        `(this command takes ${maxPositionals} positional argument(s))`,
    );
  }

  return { values: parsed.values as ParsedCliArgs['values'], positionals: parsed.positionals };
}
