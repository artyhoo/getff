// Shared test-support fixtures — MT umbrella S1 (python-backend-v0, astgrep-backend-v0).
// NON-test module (no describe/it) so that importing FIXTURE_NODE across test files does NOT
// drag one test file's describe/it tree into another's run (vitest re-executes an imported
// suite as a dependency — double-run). Mirrors backends/cargo/test-fixtures.ts.
//
// The canonical fixture node — the ban-`datetime.datetime.now` rule live-verified in
// research-patches/2026-07-02-multi-toolchain-generalization.md:409-423 (P5). Used verbatim by
// render-astgrep.test.ts and (S1 Task 2) firing.test.ts, and it is the source object for the
// committed fixtures/firing/*/rules/*.yml (self-application, T15).

import type { ConventionNode } from '../../ir/types.ts';

export const FIXTURE_NODE: ConventionNode = {
  id: 'no-datetime-now',
  claim: 'Use an injected clock, not datetime.datetime.now() directly',
  anchors: [],
  selectorClass: 'syntax',
  params: { kind: 'call', pattern: 'datetime.datetime.now($$$ARGS)' },
  // 'error' so that `ast-grep scan` exits 1 on the invalid fixture (exit 1 requires an
  // error-level finding — s0-verified-facts). Projected DIRECTLY (native per-rule severity),
  // never degraded: this backend has no FF7003 path.
  defaultSeverity: 'error',
  provenance: [],
  pairedExamples: {
    negative: 'import datetime\nx = datetime.datetime.now()',
    positive: 'x = clock.now()',
  },
};

// --- Relational fixture (OWNER-FORK-1 Option B, ir-unfreeze S2) -----------------------------
// Census "require-via-ban" convention #1 (require-type-hints): a function definition MUST carry
// a return-type hint. Rendered node id: `require-return-type-hint`. Source object for the
// committed fixtures/firing/relational-{invalid,valid}/rules/require-return-type-hint.yml
// (self-application, T15) and the relational firing test.
//
// params.pattern is the MANDATORY atomic positive anchor (render-astgrep.ts requires it —
// bare has/not/all/any parse-error live @ast-grep 0.44.1). It MUST be broad enough to match
// EVERY function definition regardless of return-type presence, or the relational arm below
// becomes vacuous. `def $NAME($$$ARGS): $$$BODY` (no `$$$TAIL`) does NOT qualify: ast-grep
// pattern matching requires exact structural-shape equivalence (modulo metavariables) — a
// pattern omitting the `return_type` child structurally FAILS TO MATCH a function that HAS one
// (verified live: that narrower pattern alone already matches only the un-annotated function —
// a live-proven vacuous-arm defect this fixture must NOT reproduce). `$$$TAIL` occupies the
// return-type's optional grammar slot so the anchor matches BOTH shapes (verified live: matches
// both an annotated and an un-annotated `def`, debug-query confirmed).
//
// metadata.kind: 'call' is advisory-only (render-astgrep.ts's "Known bound" note, :23-28) — the
// call/attribute/import vocabulary predates relational anchors and a def-statement fits none
// cleanly; it is not firing-load-bearing.
//
// relational: NOT(HAS a descendant of AST kind `type` matching bare metavar `$T`) — `type` is
// tree-sitter-python's node kind for a return-type annotation (verified live via
// `ast-grep run --pattern 'def $NAME($$$ARGS) -> $RET: $$$BODY' --debug-query=ast`:
// `return_type: type (...)  identifier (...)`, a DIRECT child of function_definition). The
// original census idiom `has:{pattern:'-> $T'}` is NOT reused here: live-verified the standalone
// fragment `-> $T` parses to garbage (`unary_operator - ERROR(>) MetaVar $T` per
// `--debug-query=pattern`) and matches nothing at any stopBy setting — an arrow token only
// parses inside a full statement context, never as an isolated sub-pattern.
export const RELATIONAL_FIXTURE_NODE: ConventionNode = {
  id: 'require-return-type-hint',
  claim: 'Add a return type hint to every function definition',
  anchors: [],
  selectorClass: 'syntax',
  params: { kind: 'call', pattern: 'def $NAME($$$ARGS)$$$TAIL: $$$BODY' },
  relational: { op: 'not', children: [{ op: 'has', kind: 'type', pattern: '$T' }] },
  // 'error' so `ast-grep scan` exits 1 on the invalid (un-annotated) fixture, mirroring
  // FIXTURE_NODE above.
  defaultSeverity: 'error',
  provenance: [],
  pairedExamples: {
    negative: 'def compute(x):\n    return x + 1',
    positive: 'def compute(x) -> int:\n    return x + 1',
  },
};
