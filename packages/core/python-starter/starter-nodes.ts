// Curated Python starter node set — python-delivery-v0 umbrella, S1 Task 3.
// Prior-art: docs/meta-factory/prior-art-evaluations.md#217 (curated Python starter set as OWN
// content in the framework's neutral IR, rendered through the ADOPTED backends #212 (ast-grep,
// the syntax-class Python DEFAULT) + #215 (ruff flake8-tidy-imports fast-path). Zero new deps,
// no new IR field, no new render target — same OWN-content-through-ADOPTED-render lineage as the
// Rust/cargo set #199. ADOPT-VOCABULARY the ban semantics (ruff DTZ003/TID251/TID253, bandit
// eval/os.system) — the SET is authored here.)
//
// This module is DATA only — a curated `ConventionNode[]` in the neutral IR (ir/types.ts, FROZEN:
// no field added). It is rendered by the pure backend functions renderAstgrep (#212) / renderRuff
// (#215); it does NOT itself render, run a gate, or touch fs/network.
//
// ROUTING (how the SAME node set flows through both backends — render-ruff.ts header: "a node
// bannable by BOTH backends must route on both"):
//   - kind 'call'      (datetime.now / datetime.datetime.now / eval / os.system) -> ast-grep renders
//     the call-with-args ban; ruff REFUSES FF7001 (it bans a qualified NAME, not a call site — the
//     `$$$ARGS` semantics are inexpressible), so ast-grep is the catch-all for these four.
//   - kind 'attribute' (datetime.datetime.utcnow) -> ruff TID251 banned-api (fast-path) AND ast-grep
//     (double-covered; delivery-layer Tasks 4-5 pick which tool ships the ban).
//   - kind 'import'    (import tensorflow)          -> ruff TID253 banned-module-level-imports AND ast-grep.
//
// DATETIME CAVEAT (probe-proven, Task 2 §c + this task's live re-probe against @ast-grep/cli@0.44.1):
// `pattern: datetime.now()` does NOT match `datetime.datetime.now()` (different AST — object is a
// name vs. an attribute chain). The frozen renderer emits a single `pattern:` per rule (no `any:`
// alternation surface), and a metavariable `$MOD.now($$$ARGS)` over-fires on every `.now()` call
// (live-verified: it flags `foo.now()` too). So the two datetime forms are banned PRECISELY by two
// literal-pattern nodes — the faithful, no-overshoot realization of "catch both forms" through the
// existing renderer. The unit test asserts BOTH patterns appear in the rendered YAML.
//
// ID NAMESPACE (probe-proven, Task 2 Probe 7): duplicate rule ids across consumer + shipped rules
// abort `ast-grep scan` with exit 8 ("Duplicate rule id"). Every shipped id is therefore `getff-*`.
//
// Every node is `defaultSeverity: 'error'` so that (a) `ast-grep scan` exits 1 on a finding
// (error-level required — s0-verified-facts) and (b) the ruff fast-path renders faithfully with no
// FF7003 severity degrade (ruff's fixed native level is error).

import type { ConventionNode } from '../ir/types.ts';

/**
 * The curated Python starter conventions. Feed the whole array to BOTH backends: `renderAstgrep`
 * emits the ast-grep YAML rule-set; `renderRuff` emits the ruff.toml fast-path. Each renderer
 * refuses the nodes outside its expressible surface (honest FF-coded RenderOutcome, never a silent
 * drop) — see the ROUTING note above.
 */
export const PYTHON_STARTER_NODES: ConventionNode[] = [
  // ── datetime safety — ban a direct wall-clock read (untestable + often naive/tz-unaware). ──
  // Flagship P5 ban. Single-module form: `from datetime import datetime; datetime.now()`.
  // S3 narrow (getff-honest-signals §8.3): pattern matches ONLY zero-arg `datetime.now()` — the
  // untestable naive read. The tz-aware form `datetime.now(timezone.utc)` (the remedy ruff.toml:9
  // names) does NOT match a zero-arg literal pattern, so it stays GREEN. $$ARGS wildcard would
  // re-catch the recommended form; do NOT re-add it.
  {
    id: 'getff-no-datetime-now',
    claim: 'Use an injected clock, not datetime.now() directly — a bare now() read is untestable and often naive/tz-unaware',
    anchors: [],
    selectorClass: 'syntax',
    params: { kind: 'call', pattern: 'datetime.now()' },
    defaultSeverity: 'error',
    provenance: [],
    pairedExamples: {
      negative: 'from datetime import datetime\nx = datetime.now()',
      positive: 'x = clock.now()',
    },
  },
  // Two-module form: `import datetime; datetime.datetime.now()`. Distinct AST from the form above
  // (see DATETIME CAVEAT) — a second literal-pattern node so BOTH forms are covered, no overshoot.
  // S3 narrow: zero-arg only; see getff-no-datetime-now above for the rationale.
  {
    id: 'getff-no-datetime-datetime-now',
    claim: 'Use an injected clock, not datetime.datetime.now() directly — a bare now() read is untestable and often naive/tz-unaware',
    anchors: [],
    selectorClass: 'syntax',
    params: { kind: 'call', pattern: 'datetime.datetime.now()' },
    defaultSeverity: 'error',
    provenance: [],
    pairedExamples: {
      negative: 'import datetime\nx = datetime.datetime.now()',
      positive: 'x = clock.now()',
    },
  },
  // ── dangerous calls (bandit-semantics ADOPT-VOCABULARY; call-with-args -> ast-grep catch-all). ──
  {
    id: 'getff-no-eval',
    claim: 'Do not use eval(); it executes arbitrary code and is a common injection vector',
    anchors: [],
    selectorClass: 'syntax',
    params: { kind: 'call', pattern: 'eval($$$ARGS)' },
    defaultSeverity: 'error',
    provenance: [],
    pairedExamples: {
      negative: 'result = eval(user_input)',
      positive: 'result = int(user_input)',
    },
  },
  {
    id: 'getff-no-os-system',
    claim: 'Do not use os.system(); use subprocess.run with an argument list to avoid shell injection',
    anchors: [],
    selectorClass: 'syntax',
    params: { kind: 'call', pattern: 'os.system($$$ARGS)' },
    defaultSeverity: 'error',
    provenance: [],
    pairedExamples: {
      negative: 'os.system(f"rm {path}")',
      positive: 'subprocess.run(["rm", path], check=True)',
    },
  },
  // ── ruff fast-path members — a qualified-name ban (TID251) + a module-level import ban (TID253). ──
  // utcnow is a qualified NAME -> ruff banned-api; deprecated (3.12) + returns a naive datetime.
  {
    id: 'getff-no-utcnow',
    claim: 'datetime.datetime.utcnow() is deprecated and returns a naive datetime; use datetime.now(timezone.utc)',
    anchors: [],
    selectorClass: 'syntax',
    params: { kind: 'attribute', pattern: 'datetime.datetime.utcnow' },
    defaultSeverity: 'error',
    provenance: [],
    pairedExamples: {
      negative: 'import datetime\nx = datetime.datetime.utcnow()',
      positive: 'from datetime import datetime, timezone\nx = datetime.now(timezone.utc)',
    },
  },
  {
    id: 'getff-no-tensorflow-module-import',
    claim: 'Do not import tensorflow at module level; its import-time cost is heavy — lazy-import inside the function that needs it',
    anchors: [],
    selectorClass: 'syntax',
    params: { kind: 'import', pattern: 'import tensorflow' },
    defaultSeverity: 'error',
    provenance: [],
    pairedExamples: {
      negative: 'import tensorflow',
      positive: 'def train():\n    import tensorflow',
    },
  },
];
