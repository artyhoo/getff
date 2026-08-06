// Firing harness runner — adapter-jig J3 Option B (golangci-forbidigo backend).
// Spec: docs/superpowers/specs/2026-07-22-adapter-jig-design.md §2/§3 (E3 arm).
// Kickoff: .ai-factory/plans/adapter-jig-j3-option-b.md §2 step 3.
//
// The RED of TDD for the lane's delivered ban surface (forbidigo's `os\.Getenv`): fires a REAL
// `golangci-lint run --out-format=json --enable forbidigo` against a committed fixture module
// and parses the resulting diagnostic identities out of its stdout (a JSON **array** — same
// shape as ruff/ast-grep, distinct from cargo's NDJSON; uses the SHARED parser
// backends/shared/json-array-parse.ts). Only fireContract()/deriveGolangciVersion() spawn;
// the parse-core is pure and lives in the shared module.
//
// The contract `command` invokes the bare PATH binary. golangci-lint is NOT a package.json
// dependency and NOT an npx-style pin baked into the command: the lane audit-self.yml installs
// a hard, exact-pinned `golangci-lint@v1.55.2` into the runner's PATH (kickoff §1). A pin
// baked into the command would silently loud-skip on a registry flake — a hard install step
// fails loud-red instead. deriveGolangciVersion re-runs the same bare binary with `--version`,
// so a version drift between the installed PATH binary and the capability-matrix evidence turns
// the freshness gate RED (attention-is-not-a-mechanism).
//
// FORK #2 PARKED: firing-contract.json carries `jsonPath: ""` + `expectedCodes: []` at worker-done
// time. Those values are the dispatching session's job to fill at host-verify §6 step 7, from a
// captured v1.55.2 JSON run — never guessed here (kickoff §4c, T-AJ-D). The runner's parse-core
// is parameterised by `contract.jsonPath`, so it activates only after that upgrade.

import { spawnSync } from 'node:child_process';
import { parseIdentitiesFromJsonArray } from '../shared/json-array-parse.ts';

export interface GolangciFiringContract {
  command: string;
  jsonPath: string;
  // forbidigo's ban surface may report multiple rule IDs across the lane's evolution; the
  // contract enumerates the family (mirrors ruff's TID251/TID253 plural shape, not cargo's
  // singular `expectedCode`).
  expectedCodes: string[];
}

/**
 * Spawn the contract command against a fixture directory and parse its stdout (a JSON array of
 * golangci-lint findings) for the set of reported identities. Asserts (expected-vs-actual) live
 * in the caller (test); this only fires + parses. golangci-lint writes the JSON array to stdout
 * and any progress / warning text to stderr, so stdout is the clean JSON surface.
 *
 * Scoping: golangci-lint auto-discovers configuration by walking up the filesystem from the
 * module root for a `.golangci.yml`. Each fixture carries its OWN `.golangci.yml` at its module
 * root (the ban surface), so the run is scoped to exactly that fixture regardless of the outer
 * tree. (Verified live against the v1.55.2 pin — captured at host-verify §6 step 7.)
 */
export function fireContract(
  contract: GolangciFiringContract,
  fixtureDir: string,
): { codes: Set<string> } {
  const [cmd, ...args] = contract.command.split(' ');
  if (cmd === undefined) {
    throw new Error('fireContract(): empty command in contract');
  }
  const result = spawnSync(cmd, args, { cwd: fixtureDir, encoding: 'utf8', shell: false });
  const codes = parseIdentitiesFromJsonArray(result.stdout ?? '', contract.jsonPath);
  return { codes };
}

/**
 * Pure parse of stdout via the shared JSON-array helper. Re-exported for unit-testing the
 * parse-core without spawning golangci-lint (R9, always-on in CI). Equivalent to cargo's
 * parseCodesFromStdout but for the JSON-array shape.
 */
export function parseCodesFromStdout(stdout: string, jsonPath: string): Set<string> {
  return parseIdentitiesFromJsonArray(stdout, jsonPath);
}

/**
 * Extract the golangci-lint semver from a `--version` line. Accepts both
 * `golangci-lint v1.55.2` (with leading `v`) and `golangci-lint 1.55.2` (bare semver) — the
 * kickoff §1 evidence string is `golangci-lint v1.55.2`, but the binary's exact `--version`
 * output is verified at host-verify §6 step 7, not here (T-AJ-D: do not guess doc facts
 * against a v1 pin from inside the aif container).
 */
export function parseGolangciVersion(versionOutput: string): string | undefined {
  const m = /(?:^|\s)golangci-lint\s+v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\b/.exec(versionOutput);
  return m?.[1];
}

/**
 * Derive the golangci-lint version that actually resolves for this backend here, by running
 * `golangci-lint --version`. Returns undefined when the binary is unavailable (not on PATH —
 * CI install step missing / local machine without the pinned tool) — the caller then loud-skips
 * rather than asserting on a version it could not observe. NO version literal lives in this
 * code path (attention-is-not-a-mechanism): bumping the pinned toolchain (audit-self.yml
 * `install` step) without regenerating the committed evidence turns the freshness gate RED.
 */
export function deriveGolangciVersion(): string | undefined {
  const result = spawnSync('golangci-lint', ['--version'], { encoding: 'utf8', shell: false });
  if (result.status !== 0 || typeof result.stdout !== 'string') return undefined;
  return parseGolangciVersion(result.stdout);
}
