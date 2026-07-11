// Shared test-support fixtures — MT umbrella S2 (python-backend-v0, ruff-tidy-imports fast-path).
// NON-test module (no describe/it) so importing a fixture across test files does NOT drag one
// test file's describe/it tree into another's run (vitest re-executes an imported suite as a
// dependency — double-run). Mirrors backends/astgrep/test-fixtures.ts + backends/cargo/test-fixtures.ts.
//
// The ruff fast-path is NARROW by design: ruff's custom-rule surface is the closed
// flake8-tidy-imports vocabulary (TID251 banned-api + TID253 banned-module-level-imports), so
// only import / qualified-name bans render — everything else refuses honestly (see render-ruff.ts).
// The astgrep FIXTURE_NODE (a `call`-kind ban `datetime.datetime.now($$$ARGS)`) is DELIBERATELY not
// reused here: a call-with-args ban is exactly what ruff CANNOT express (it bans a qualified NAME,
// not a call site) — it refuses FF7001 on this backend (astgrep is the catch-all). These two fixtures
// are the canonical fast-path members, live-verified against ruff 0.15.21 (s0-verified-facts):
//   - TID251: banned-api on the qualified name `requests` (fires on `import requests` + `requests.x()`)
//   - TID253: banned-module-level-imports on `torch` (fires on a module-level `import torch`)
// Both are the source objects for the committed fixtures/firing/*/ruff.toml (self-application T15, S2 Task 2).

import type { ConventionNode } from '../../ir/types.ts';

// TID251 — banned-api: a qualified-name ban. `kind: 'attribute'` is the astgrep peer of a ruff
// banned-api entry (both express an attribute-chain / qualified-name ban on the shared IR node).
export const RUFF_TID251_NODE: ConventionNode = {
  id: 'no-requests-api',
  claim: 'Use httpx, not the requests library',
  anchors: [],
  selectorClass: 'syntax',
  params: { kind: 'attribute', pattern: 'requests' },
  // 'error' — ruff diagnostics are fixed at error level (s0-verified-facts: no per-rule severity
  // config; the JSON `severity` field is always "error"). Requesting 'error' is projected faithfully;
  // any lower severity would degrade FF7003 (see render-ruff.ts).
  defaultSeverity: 'error',
  provenance: [],
  pairedExamples: {
    negative: 'import requests\nrequests.get(url)',
    positive: 'import httpx\nhttpx.get(url)',
  },
};

// TID253 — banned-module-level-imports: a module-level import ban. `kind: 'import'` is the astgrep
// peer (both express an import ban on the shared IR node); the ruff `pattern` carries the import
// statement `import <module>`, from which the module name is extracted for the TID253 array.
export const RUFF_TID253_NODE: ConventionNode = {
  id: 'no-torch-module-import',
  claim: 'Do not import torch at module level; lazy-import inside the function that needs it',
  anchors: [],
  selectorClass: 'syntax',
  params: { kind: 'import', pattern: 'import torch' },
  defaultSeverity: 'error',
  provenance: [],
  pairedExamples: {
    negative: 'import torch',
    positive: 'def train():\n    import torch',
  },
};
