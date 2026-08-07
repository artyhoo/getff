// Firing harness runner — adapter-jig J3 Option B (golangci-forbidigo backend).
// Spec: docs/superpowers/specs/2026-07-22-adapter-jig-design.md §2/§3 (E3 arm).
// Kickoff: .claude/orchestrator-prompts/adapter-jig-j3-option-b/kickoff.md §2 step 3.
//
// The RED of TDD for the lane's delivered ban surface (forbidigo's `os\.Getenv`): fires a REAL
// `golangci-lint run --out-format=json --enable forbidigo` against a committed fixture module
// and parses the resulting diagnostic identities out of its stdout.
//
// STDOUT SHAPE — captured live from the pinned v1.55.2 binary on the CI runner (host-verify §6
// step 7, run 31132752600). golangci-lint does NOT emit a bare JSON array: it emits a single
// **object** `{"Issues":[…],"Report":{"Linters":[…]}}`. That is a third shape, distinct from
// BOTH ruff/ast-grep's bare array AND cargo's NDJSON, so this backend keeps its own parse-core
// (exactly as cargo does for its NDJSON) instead of reusing backends/shared/json-array-parse.ts.
// Reusing the shared array parser was the worker-time hypothesis and it is WRONG on this shape:
// `parseIdentitiesFromJsonArray` bails at its `if (!Array.isArray(parsed))` guard and returns an
// empty set for every golangci run, so a populated expectedCodes would have turned the RED test
// permanently red (and an empty one — the parked worker-done state — permanently vacuous). The
// shared `getByJsonPath` helper IS reused: only the array-vs-object container differs.
//
// Only fireContract()/deriveGolangciVersion() spawn; the parse-core below is pure.
//
// The contract `command` invokes the bare PATH binary. golangci-lint is NOT a package.json
// dependency and NOT an npx-style pin baked into the command: the lane audit-self.yml installs
// a hard, exact-pinned `golangci-lint@v1.55.2` into the runner's PATH (kickoff §1). A pin
// baked into the command would silently loud-skip on a registry flake — a hard install step
// fails loud-red instead. deriveGolangciVersion re-runs the same bare binary with `--version`,
// so a version drift between the installed PATH binary and the capability-matrix evidence turns
// the freshness gate RED (attention-is-not-a-mechanism).
//
// FORK #2 CLOSED (host-verify §6 step 7): firing-contract.json now carries `jsonPath:
// "$.FromLinter"` + `expectedCodes: ["forbidigo"]`, both read off the captured run rather than
// guessed (kickoff §4c, T-AJ-D). Note what the captured identity actually IS: golangci's
// per-issue identity is the emitting **linter's** name, not a per-pattern rule id — there is no
// ruff-style `TID251` granularity to extract, because forbidigo's individual `forbid:` patterns
// are not separately identified in the JSON. That capability limit is recorded in the matrix
// cell's `caps`, which is why the cell is `partial` and not `yes`.

import { spawnSync } from 'node:child_process';
import { getByJsonPath } from '../shared/json-array-parse.ts';

export interface GolangciFiringContract {
  command: string;
  jsonPath: string;
  // forbidigo's ban surface may report multiple rule IDs across the lane's evolution; the
  // contract enumerates the family (mirrors ruff's TID251/TID253 plural shape, not cargo's
  // singular `expectedCode`).
  expectedCodes: string[];
}

/**
 * Spawn the contract command against a fixture directory and parse its stdout (the golangci-lint
 * report object) for the set of reported identities. Asserts (expected-vs-actual) live in the
 * caller (test); this only fires + parses. golangci-lint writes the JSON report to stdout and any
 * progress / warning text to stderr, so stdout is the clean JSON surface (confirmed: the captured
 * run's stderr was empty on all three fixtures).
 *
 * Scoping: golangci-lint auto-discovers configuration by walking up the filesystem from the
 * module root for a `.golangci.yml`. Each fixture carries its OWN `.golangci.yml` at its module
 * root (the ban surface), so the run is scoped to exactly that fixture regardless of the outer
 * tree. CONFIRMED against the live pinned v1.55.2 run: the `invalid` fixture exited 1 with
 * exactly one forbidigo issue at `main.go:7:6`, while `valid` and `valid-clean` — sitting under
 * the same outer tree — exited 0 with `"Issues":[]`. A leaking outer config would have made all
 * three agree.
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
  const codes = parseCodesFromStdout(result.stdout ?? '', contract.jsonPath);
  return { codes };
}

/**
 * Pure parse of the golangci-lint report object. Exported for unit-testing the parse-core without
 * spawning golangci-lint (R9, always-on in CI) — the go analog of cargo's parseCodesFromStdout.
 *
 * Container: `{"Issues":[…]}`. Each element of `Issues` is walked by `jsonPath` (`$.FromLinter`)
 * via the shared `getByJsonPath`; non-empty string identities are collected. Tolerance mirrors
 * the sibling parsers — non-JSON, a missing/non-array `Issues`, or an empty stdout all resolve to
 * an empty set rather than throwing ("no code found", never a crash).
 *
 * A clean run emits `"Issues":[]` and yields the empty set. NOTE this is the same result an
 * unparseable stdout yields, which is why the empty set alone is never the proof that a fixture is
 * clean: the GREEN tests pair it with the RED test firing on the same binary in the same run.
 */
export function parseCodesFromStdout(stdout: string, jsonPath: string): Set<string> {
  const identities = new Set<string>();
  const trimmed = stdout.trim();
  if (trimmed.length === 0) return identities;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return identities; // non-JSON stdout — treat as no findings
  }
  const issues = getByJsonPath(parsed, '$.Issues');
  if (!Array.isArray(issues)) return identities;
  for (const issue of issues) {
    const value = getByJsonPath(issue, jsonPath);
    if (typeof value === 'string' && value.length > 0) {
      identities.add(value);
    }
  }
  return identities;
}

/**
 * Extract the golangci-lint semver from a `--version` line.
 *
 * THREE shapes are accepted, and the first one is the one the real binary emits:
 *   1. `golangci-lint has version 1.55.2 built with go1.21.4 from <sha> on <date>` — the v1.x
 *      binary's actual stdout. Source-verified AT THE PINNED TAG `v1.55.2` (not master — that is
 *      the T-AJ-D trap this lane already paid for once): `printVersion()` in
 *      `pkg/commands/version.go` formats `"golangci-lint has version %s built with %s from %s on
 *      %s\n"`, and both the `--version` flag (`pkg/commands/root.go`) and the `version`
 *      subcommand's default branch route through it. At v1.55.2 `BuildInfo` is a plain struct with
 *      NO `String()` method — the format only moved onto `BuildInfo.String()` in a LATER release.
 *      Words sit between the tool name and the semver, so a regex demanding adjacency never matches.
 *   2. `golangci-lint v1.55.2` — the kickoff §1 evidence-string shape (what the matrix records).
 *      Also what CI actually produces: `audit-self.yml` installs via `go install …@v1.55.2` (no
 *      goreleaser ldflags), so the version falls back to `buildInfo.Main.Version` — the tag string
 *      WITH its leading `v`. Hence the `v?` group is load-bearing on the real CI path, not cosmetic.
 *   3. `golangci-lint 1.55.2` — bare semver.
 *
 * Shape 1 is load-bearing and is NOT a doc-guess (T-AJ-D): an earlier revision of this function
 * accepted only shapes 2-3, which made `deriveGolangciVersion()` return undefined on a machine
 * that HAS golangci-lint installed — indistinguishable from "tool absent". The freshness gate
 * would then loud-skip forever and CI would stay green while the E3 arm never fired. Caught by
 * the cold fidelity audit before merge (W-1).
 */
export function parseGolangciVersion(versionOutput: string): string | undefined {
  const m = /(?:^|\s)golangci-lint\s+(?:has\s+version\s+)?v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\b/.exec(
    versionOutput,
  );
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
