// Shared JSON-array diagnostic parser — MT umbrella S1 (python-backend-v0).
// Spec: docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md §5.
//
// Justification for hoisting to backends/shared/ (kickoff §1 two-consumer condition):
// ast-grep (`scan --json`, S1) and ruff (`check --output-format=json`, S2) BOTH emit a single
// JSON **array** of finding objects on stdout, each finding carrying a flat identity field
// (ast-grep `ruleId`, ruff `code`) — s0-verified-facts. This is a DIFFERENT shape from cargo's
// heterogeneous NDJSON (one JSON object per line, filtered by `reason`), so cargo keeps its own
// parseCodesFromStdout (untouched) and the array consumers share this helper.
//
// Pure — no spawn, no fs, no network — so it unit-tests without either toolchain present.

/**
 * Walk a parsed JSON value by a `$.a.b.c`-style path (dot-separated, no array indices — the
 * only shape a firing-contract.json identity path ever needs). Returns undefined on any
 * missing/null hop (optional-chaining semantics) rather than throwing. Copied from cargo's
 * private getByJsonPath (backends/cargo/firing-runner.ts) rather than re-exported, because that
 * module is the NDJSON path and stays untouched.
 */
export function getByJsonPath(value: unknown, jsonPath: string): unknown {
  const segments = jsonPath
    .replace(/^\$\.?/, '')
    .split('.')
    .filter((s) => s.length > 0);
  let cur: unknown = value;
  for (const seg of segments) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

/**
 * Parse a JSON-array diagnostic stdout (ast-grep / ruff shape) into the set of identities
 * present. Each array element is walked via `jsonPath` (e.g. `$.ruleId` / `$.code`); non-empty
 * string identities are collected, everything else skipped. A clean run prints `[]` -> empty
 * set. Malformed / non-array / non-JSON stdout resolves to an empty set rather than throwing
 * (parity with the cargo NDJSON parser's tolerance: "no code found", never a crash).
 */
export function parseIdentitiesFromJsonArray(stdout: string, jsonPath: string): Set<string> {
  const identities = new Set<string>();
  const trimmed = stdout.trim();
  if (trimmed.length === 0) return identities;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return identities; // non-JSON stdout — treat as no findings
  }
  if (!Array.isArray(parsed)) return identities;
  for (const element of parsed) {
    const value = getByJsonPath(element, jsonPath);
    if (typeof value === 'string' && value.length > 0) {
      identities.add(value);
    }
  }
  return identities;
}
