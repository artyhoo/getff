// Shared demo fixture node — launch-preannounce-track S4 (F2a cargo honest demo).
// NON-test module (no describe/it) so importing DEMO_NODE across test files does not drag one
// file's suite into another's run (same rationale as backends/cargo/test-fixtures.ts).
//
// DEMO_NODE is defaultSeverity: 'error' ON PURPOSE — it is the case the severity projection
// exists to fix. render-clippy.ts DEGRADES it FF7003 on the clippy.toml plane (clippy.toml has
// no severity), and write-clippy.ts PROJECTS it to `[lints.clippy] disallowed_methods = "deny"`
// on the Cargo.toml plane so the demo crate's planted violation FAILS the build (exit != 0)
// instead of exiting 0 over the warning.

import type { ConventionNode } from '../../../ir/types.ts';

export const DEMO_NODE: ConventionNode = {
  id: 'demo-no-direct-env-var',
  claim: 'Read configuration through the injected config accessor, never std::env::var directly',
  anchors: [],
  selectorClass: 'type-aware',
  params: { kind: 'method', path: 'std::env::var' },
  defaultSeverity: 'error',
  provenance: [],
  pairedExamples: {
    negative: 'fn main() { let _ = std::env::var("HOME"); }',
    positive: 'fn main() { let _ = app_config::env_var("HOME"); }',
  },
};
