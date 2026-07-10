// Firing harness runner — MT umbrella S1 (astgrep-python-yaml backend).
// Spec: docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md §5.
//
// The RED of TDD for a rendered ast-grep rule: fires the REAL `ast-grep scan --json` against a
// committed fixture project and parses the reported ruleIds out of its stdout (a JSON array —
// shared parser, backends/shared/json-array-parse.ts). Only fireContract()/deriveToolVersion()
// spawn; the parse-core is pure and lives in the shared module (unit-tested without ast-grep).
//
// The contract `command` invokes the bare PATH binary (`ast-grep scan --json`). The tool is NOT
// a package.json dependency and NOT an npx-resolved pin: it is installed into the CI runner's PATH
// by a hard, exact-pinned `npm install -g @ast-grep/cli@<ver>` workflow step (audit-self.yml). An
// npx-pin would silently loud-skip on a registry flake (CI green without firing) — a hard install
// step fails loud-red instead, keeping the "CI fires for real" STOP-line honest. deriveToolVersion
// re-runs the same bare invocation with `--version`, so a version drift between the installed PATH
// binary and the capability-matrix evidence turns the freshness gate RED (attention-is-not-a-
// mechanism). Locally a stray PATH `ast-grep` at a different patch level surfaces as that same RED,
// not a silent mismatch.

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { parseIdentitiesFromJsonArray } from '../shared/json-array-parse.ts';

export interface AstgrepFiringContract {
  command: string;
  jsonPath: string;
  expectedCode: string;
}

/** The single Python source file every firing fixture directory carries. */
export const FIXTURE_SOURCE = 'src.py';
/** The ast-grep root-config file every firing fixture directory carries. */
export const FIXTURE_CONFIG = 'sgconfig.yml';

/**
 * Spawn the contract command against a fixture directory and parse its stdout (a JSON array of
 * ast-grep findings) for the set of reported ruleIds. Asserts (expected-vs-actual) live in the
 * caller (test); this only fires + parses. ast-grep writes the JSON array to stdout and its
 * diagnostic epilogue to stderr, so stdout is clean JSON (s0-verified-facts).
 *
 * ast-grep quirk this encapsulates: `scan` anchors its "project root" to the enclosing git
 * repository, NOT to cwd. Because these fixtures live inside the repo's own git tree, a bare
 * `scan` (a) fails project-config discovery (the git root has no sgconfig.yml) and (b) when
 * given a config, scans the WHOLE repo tree and bleeds findings across sibling fixtures. Both
 * `-c <config>` and the scan TARGET must therefore be ABSOLUTE paths under the fixture dir, so
 * the scan is scoped to exactly that fixture's `src.py` regardless of the outer git root.
 * (Verified live against @ast-grep/cli@0.44.1 — the firing harness exists to encapsulate exactly
 * this kind of tool-specific invocation detail.)
 */
export function fireContract(
  contract: AstgrepFiringContract,
  fixtureDir: string,
): { codes: Set<string> } {
  const [cmd, ...args] = contract.command.split(' ');
  if (cmd === undefined) {
    throw new Error('fireContract(): empty command in contract');
  }
  const configPath = join(fixtureDir, FIXTURE_CONFIG);
  const targetPath = join(fixtureDir, FIXTURE_SOURCE);
  const result = spawnSync(cmd, [...args, '-c', configPath, targetPath], {
    cwd: fixtureDir,
    encoding: 'utf8',
    shell: false,
  });
  const codes = parseIdentitiesFromJsonArray(result.stdout ?? '', contract.jsonPath);
  return { codes };
}

/** Extract the ast-grep semver from a `--version` line ("ast-grep 0.44.1"). */
export function parseAstgrepVersion(versionOutput: string): string | undefined {
  const m = /(?:^|\s)ast-grep\s+(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\b/.exec(versionOutput);
  return m?.[1];
}

/**
 * Derive the version of the ast-grep that `contract.command` actually resolves, by re-running
 * the SAME invocation with `--version`. Returns undefined when the tool is unavailable (not on
 * PATH — CI install step missing / local machine without ast-grep) — the caller then loud-skips
 * rather than asserting on a version it could not observe. NO version literal lives in this code
 * path.
 */
export function deriveToolVersion(command: string): string | undefined {
  const tokens = command.split(' ');
  const binIdx = tokens.findIndex((t) => t === 'ast-grep');
  if (binIdx === -1) return undefined;
  // Reuse the exact invocation prefix up to and including the `ast-grep` bin token, then ask
  // for the version instead of running a scan.
  const [cmd, ...prefix] = tokens.slice(0, binIdx + 1);
  if (cmd === undefined) return undefined;
  const result = spawnSync(cmd, [...prefix, '--version'], { encoding: 'utf8', shell: false });
  if (result.status !== 0 || typeof result.stdout !== 'string') return undefined;
  return parseAstgrepVersion(result.stdout);
}
