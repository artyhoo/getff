// Firing harness runner — MT umbrella S2 (ruff-tidy-imports-toml backend, python-backend-v0).
// Spec: docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md §5.
//
// The RED of TDD for a rendered ruff.toml: fires the REAL `ruff check --output-format=json`
// against a committed fixture project and parses the reported `code`s out of its stdout (a JSON
// array — the SHARED parser, backends/shared/json-array-parse.ts; ruff is that helper's second
// consumer, ast-grep the first, per the kickoff §1 two-consumer condition). Only fireContract()/
// deriveToolVersion() spawn; the parse-core is pure and lives in the shared module (unit-tested
// without ruff present).
//
// The contract `command` invokes the bare PATH binary (`ruff check --output-format=json`). ruff is
// NOT a package.json dependency and NOT a uvx/pip-run pin baked into the command: it is installed
// into the CI runner's PATH by a hard, exact-pinned `pip install ruff==<ver>` workflow step
// (audit-self.yml). A uvx/npx-style pin would silently loud-skip on a registry flake (CI green
// without firing) — a hard install step fails loud-red instead, keeping the "CI fires for real"
// STOP-line honest. deriveToolVersion re-runs the same bare binary with `--version`, so a version
// drift between the installed PATH binary and the capability-matrix evidence turns the freshness
// gate RED (attention-is-not-a-mechanism). Locally a stray PATH `ruff` at a different patch level
// surfaces as that same RED, not a silent mismatch.

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { parseIdentitiesFromJsonArray } from '../shared/json-array-parse.ts';

export interface RuffFiringContract {
  command: string;
  jsonPath: string;
  // ruff's flake8-tidy-imports fast-path spans TWO codes (TID251 banned-api + TID253
  // banned-module-level-imports); the invalid fixture fires both, so the contract enumerates the
  // family rather than a single expectedCode (contrast the astgrep backend's single rule id).
  expectedCodes: string[];
}

/** The single Python source file every firing fixture directory carries. */
export const FIXTURE_SOURCE = 'src.py';
/** The ruff config file every firing fixture directory carries. */
export const FIXTURE_CONFIG = 'ruff.toml';

/**
 * Spawn the contract command against a fixture directory and parse its stdout (a JSON array of
 * ruff findings) for the set of reported `code`s. Asserts (expected-vs-actual) live in the caller
 * (test); this only fires + parses. ruff writes the JSON array to stdout and any diagnostics
 * (e.g. config warnings) to stderr, so stdout is clean JSON (s0-verified-facts).
 *
 * ruff scoping this encapsulates: ruff auto-discovers configuration by walking up the filesystem
 * from each target for a `ruff.toml` / `pyproject.toml`. Because these fixtures live inside the
 * repo's own tree, that discovery could pick up an ancestor config (none today, but do not rely on
 * that). Passing `--config <abs ruff.toml>` overrides discovery with exactly the fixture's rendered
 * config, and the scan TARGET is the fixture's absolute `src.py` — so the run is scoped to exactly
 * that fixture regardless of the outer tree. (Verified live against ruff 0.15.21 — the firing
 * harness exists to encapsulate exactly this kind of tool-specific invocation detail.)
 */
export function fireContract(
  contract: RuffFiringContract,
  fixtureDir: string,
): { codes: Set<string> } {
  const [cmd, ...args] = contract.command.split(' ');
  if (cmd === undefined) {
    throw new Error('fireContract(): empty command in contract');
  }
  const configPath = join(fixtureDir, FIXTURE_CONFIG);
  const targetPath = join(fixtureDir, FIXTURE_SOURCE);
  const result = spawnSync(cmd, [...args, '--config', configPath, targetPath], {
    cwd: fixtureDir,
    encoding: 'utf8',
    shell: false,
  });
  const codes = parseIdentitiesFromJsonArray(result.stdout ?? '', contract.jsonPath);
  return { codes };
}

/** Extract the ruff semver from a `--version` line ("ruff 0.15.21"). */
export function parseRuffVersion(versionOutput: string): string | undefined {
  const m = /(?:^|\s)ruff\s+(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\b/.exec(versionOutput);
  return m?.[1];
}

/**
 * Derive the version of the ruff that `contract.command` actually resolves, by re-running the SAME
 * binary with `--version`. Returns undefined when the tool is unavailable (not on PATH — CI install
 * step missing / local machine without ruff) — the caller then loud-skips rather than asserting on
 * a version it could not observe. NO version literal lives in this code path.
 */
export function deriveToolVersion(command: string): string | undefined {
  const tokens = command.split(' ');
  const binIdx = tokens.findIndex((t) => t === 'ruff');
  if (binIdx === -1) return undefined;
  // Reuse the exact `ruff` bin token, then ask for the version instead of running a check.
  const cmd = tokens[binIdx];
  if (cmd === undefined) return undefined;
  const result = spawnSync(cmd, ['--version'], { encoding: 'utf8', shell: false });
  if (result.status !== 0 || typeof result.stdout !== 'string') return undefined;
  return parseRuffVersion(result.stdout);
}
