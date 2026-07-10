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
