// Firing harness runner — MT umbrella S2 (cargo-backend-v0).
// Spec: docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md §5.
//
// The RED of TDD for a rendered rule: fires a real toolchain command against a fixture
// crate and parses the resulting diagnostic codes out of its stdout. Zero deps (hand-rolled
// NDJSON line scan + a minimal JSONPath-subset getter — no jq/jsonpath npm package).
//
// Parse-core (parseCodesFromStdout) is PURE — no spawn, no fs, no network — so it can be
// unit-tested without cargo present (R9, always-on in CI). Only fireContract() spawns.

import { spawnSync } from 'node:child_process';

export interface FiringContract {
  command: string;
  jsonPath: string;
  expectedCode: string;
}

/**
 * Walk a parsed JSON value by a `$.a.b.c`-style path (dot-separated, no array indices —
 * the only shape firing-contract.json ever needs). Returns undefined on any missing/null
 * hop (optional-chaining semantics) rather than throwing — cargo's own JSON shape has
 * message.code === null on non-lint diagnostics, and that must resolve to "no code found"
 * rather than a crash.
 */
function getByJsonPath(value: unknown, jsonPath: string): unknown {
  const segments = jsonPath.replace(/^\$\.?/, '').split('.').filter((s) => s.length > 0);
  let cur: unknown = value;
  for (const seg of segments) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

/**
 * Pure parse of `cargo --message-format=json`-style NDJSON stdout into the set of
 * diagnostic codes present. Cargo's NDJSON is heterogeneous — compiler-artifact,
 * build-finished, compiler-message, etc. — so each line is filtered to
 * `reason === "compiler-message"` before extracting via jsonPath. Non-JSON lines
 * (rare, but tolerated) and lines whose jsonPath resolves to null/undefined/empty are
 * skipped rather than throwing.
 */
export function parseCodesFromStdout(stdout: string, jsonPath: string): Set<string> {
  const codes = new Set<string>();
  const lines = stdout.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue; // non-JSON line — skip
    }
    if (typeof parsed !== 'object' || parsed === null) continue;
    if ((parsed as Record<string, unknown>)['reason'] !== 'compiler-message') continue;
    const value = getByJsonPath(parsed, jsonPath);
    if (typeof value === 'string' && value.length > 0) {
      codes.add(value);
    }
  }
  return codes;
}

/**
 * Spawn `contract.command` with cwd=fixtureDir, then parse its stdout for diagnostic
 * codes. Asserts (expected-vs-actual) live in the caller (test), not here — this
 * function only fires + parses.
 */
export function fireContract(contract: FiringContract, fixtureDir: string): { codes: Set<string> } {
  const [cmd, ...args] = contract.command.split(' ');
  if (cmd === undefined) {
    throw new Error(`fireContract(): empty command in contract`);
  }
  const result = spawnSync(cmd, args, { cwd: fixtureDir, encoding: 'utf8', shell: false });
  const codes = parseCodesFromStdout(result.stdout ?? '', contract.jsonPath);
  return { codes };
}

/**
 * Extract the rust semver from a `rustc --version` line ("rustc 1.96.1 (31fca3adb 2026-06-26)").
 * The cargo backend's capability-matrix evidence names its toolchain as a `rustc <semver> (...)`
 * string, so this is the parse-core both `deriveRustcVersion` (the live PATH binary) and
 * `checkToolchainFreshness` (the committed evidence string) share — a single source of truth for
 * what "the rust version" means, exactly as the ruff backend's `parseRuffVersion` does.
 */
export function parseRustcVersion(versionOutput: string): string | undefined {
  const m = /(?:^|\s)rustc\s+(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\b/.exec(versionOutput);
  return m?.[1];
}

/**
 * Derive the rustc version that actually resolves for the cargo backend here, by running
 * `rustc --version`. The cargo firing contract command is `cargo clippy ...`, but the toolchain
 * IDENTITY the evidence records is rustc's (clippy is versioned as a rustc component: the evidence
 * string is "rustc 1.96.1 (...)"), so the freshness anchor is `rustc --version`, not `cargo --version`.
 * Returns undefined when rustc is not on PATH (CI install step missing / local machine without the
 * pinned toolchain) — the caller then loud-skips rather than asserting on a version it could not
 * observe. NO version literal lives in this code path (attention-is-not-a-mechanism): bumping the
 * pinned toolchain without regenerating the committed evidence turns the freshness gate RED.
 */
export function deriveRustcVersion(): string | undefined {
  const result = spawnSync('rustc', ['--version'], { encoding: 'utf8', shell: false });
  if (result.status !== 0 || typeof result.stdout !== 'string') return undefined;
  return parseRustcVersion(result.stdout);
}
