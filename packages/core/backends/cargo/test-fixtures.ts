// Shared test-support fixtures — MT umbrella S2 (cargo-backend-v0).
// NON-test module (no describe/it) so that importing FIXTURE_NODE across test files does
// NOT drag one test file's describe/it tree into another's run. Test files importing from
// each other cause vitest to re-execute the imported suite as a dependency (double-run);
// keeping the shared fixture here severs that. Not imported by synth-and-wire.ts, so the
// committed synth bundle is unaffected.

import type { ConventionNode } from '../../ir/types.ts';

// The canonical fixture node — used verbatim by render-clippy.test.ts and firing.test.ts,
// and it is the source object for the committed fixtures/firing/*/clippy.toml
// (self-application, T15).
export const FIXTURE_NODE: ConventionNode = {
  id: 'no-direct-env-var',
  claim: 'Read configuration through the injected config accessor, never std::env::var directly',
  anchors: [],
  selectorClass: 'type-aware',
  params: { kind: 'method', path: 'std::env::var' },
  defaultSeverity: 'warning',
  provenance: [],
  pairedExamples: {
    negative: 'fn main() { let _ = std::env::var("HOME"); }',
    positive: 'fn main() { let _ = app_config::env_var("HOME"); }',
  },
};
