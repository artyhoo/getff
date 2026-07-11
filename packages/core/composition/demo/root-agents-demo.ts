// Root-AGENTS.md demo builder — the first executable AI-doc region (MT umbrella S4, PR-B).
// Spec: docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md §5.1.
//
// The FLAGSHIP demonstration: one "Configuration access" section composed from TWO Convention
// nodes — a cargo type-aware ban (`no-direct-env-var`) and an npm syntax ban
// (`no-direct-process-env`). BOTH nodes are fed to ALL shipped backends, so each node gets a
// per-backend RenderOutcome and the `Enforced:` line is COMPUTED by the shipped compose() /
// enforcement-line.ts from LIVE render facts — NEVER hand-written (T-S4-A). The shipped backend
// set is now FOUR after the python-backend-v0 umbrella (cargo, npm, astgrep, ruff); the Python
// lane (astgrep #212 primary + ruff #215 fast-path) joins as TWO segments, because the
// enforcement-line mechanism emits one segment per registered backend (there is no combined
// "Python segment" — segment granularity is per-backend by construction, enforcement-line.ts).
// The lexicographically-ordered per-node outcomes:
//   no-direct-env-var (type-aware):
//     astgrep — FF7001 (type-aware → mypy deferred) · cargo ✅ (type-aware live-fired) ·
//     npm — FF7001 (type-aware class) · ruff — FF7001 (type-aware → mypy deferred)
//   no-direct-process-env (npm syntax ban, JS-selector params):
//     astgrep — FF7002 (params contract: no astgrep kind/pattern on a JS-selector node) ·
//     cargo — FF7001 (syntax class) · npm ✅ (syntax live-fired) ·
//     ruff — FF7002 (params contract: no ruff kind/pattern on a JS-selector node)
// Two-sided honest capability refusals = the live capability-negotiation demo: cargo renders its
// Rust node, npm renders its JS node, and the Python backends honestly refuse both non-Python
// nodes (FF7001 capability-class gap on the type-aware node; FF7002 params-contract gap on the
// JS-selector node — neither demo node is a Python convention).
//
// DESIGN CAVEAT (surfaced by S3, not fixed here — it is out of this stage's scope): the demo
// region is validated ONLY by the byte-ratchet against compose()/enforcement-line.ts; it is not
// run through runCompositionGate (parity with MT S4 — no stage ran the gate over the demo). If
// it were, FF8003 (refused-while-matrix-claims-live-fired) would fire on the astgrep/ruff × the
// syntax node: both Python backends carry a `live-fired` syntax cell yet refuse THIS node because
// its params are JS-shaped, and the gate's FF8003 predicate is selectorClass-level, not
// node-params-aware. This is an architectural property of hosting 3+ syntax-live-fired backends
// (npm, astgrep, ruff) over per-toolchain-params nodes in one shared section, not a wiring bug —
// see the S3 report. Fixing it (node-params-aware FF8003, or disjoint-class demo nodes) is a
// gate/matrix change, both STOP-lined for this umbrella.
//
// This module is PURE (no fs beyond reading the committed fixture node/plan JSON at load; no
// network, no Date, no randomness) so the ratchet test can re-derive the exact region body and
// byte-compare it against the committed ROOT AGENTS.md region.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderAstgrep } from '../../backends/astgrep/render-astgrep.ts';
import { FIXTURE_NODE } from '../../backends/cargo/test-fixtures.ts';
import { renderCargoClippy } from '../../backends/cargo/render-clippy.ts';
import { renderNpmDeclarative } from '../../backends/npm/from-node.ts';
import { renderRuff } from '../../backends/ruff/render-ruff.ts';
import type { CapabilityMatrix } from '../../backends/shared/capability-matrix.ts';
import type { RenderOutcome } from '../../backends/shared/render-outcome.ts';
import type { ConventionNode } from '../../ir/types.ts';
import { compose } from '../compose.ts';
import type { DocPlan } from '../types.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, '..', 'fixtures');
const BACKENDS = join(HERE, '..', '..', 'backends');

/** The section id + plan path the demo region uses in the ROOT AGENTS.md fence markers. */
export const DEMO_SECTION_ID = 'configuration-access';
export const DEMO_PLAN_PATH =
  'packages/core/composition/fixtures/root-agents-demo.docplan.json';

/** Read a backend's committed capability-matrix.json (the SAME shape validateMatrix checks). */
function readMatrix(backend: 'cargo' | 'npm' | 'astgrep' | 'ruff'): CapabilityMatrix {
  return JSON.parse(
    readFileSync(join(BACKENDS, backend, 'capability-matrix.json'), 'utf8'),
  ) as CapabilityMatrix;
}

/** The cargo backend's registered name (matrix.backend) — the compose() outcomes-map key. */
const CARGO_BACKEND = readMatrix('cargo').backend;
/** The npm backend's registered name (matrix.backend) — the compose() outcomes-map key. */
const NPM_BACKEND = readMatrix('npm').backend;
/** The astgrep (Python primary, #212) backend's registered name — the compose() outcomes-map key. */
const ASTGREP_BACKEND = readMatrix('astgrep').backend;
/** The ruff (Python fast-path, #215) backend's registered name — the compose() outcomes-map key. */
const RUFF_BACKEND = readMatrix('ruff').backend;

/** The npm demo node (syntax-class process.env ban), read from the committed fixture. */
export function npmDemoNode(): ConventionNode {
  return JSON.parse(
    readFileSync(join(FIXTURES, 'no-direct-process-env.node.json'), 'utf8'),
  ) as ConventionNode;
}

/** The cargo demo node (type-aware std::env::var ban) — the shipped cargo FIXTURE_NODE. */
export function cargoDemoNode(): ConventionNode {
  return FIXTURE_NODE;
}

/** The demo DocPlan, read from the committed fixture (one section, both node ids). */
export function demoPlan(): DocPlan {
  return JSON.parse(
    readFileSync(join(FIXTURES, 'root-agents-demo.docplan.json'), 'utf8'),
  ) as DocPlan;
}

/**
 * The one preamble line rendered INSIDE the region — produced from a TEMPLATE, never hand-typed
 * into the doc (mirrors the enforcement-line discipline: doc text is derived, not authored).
 * Kept out of compose() (v0 forbids free prose inside a compose()-rendered region) and prepended
 * to the composed body by buildDemoRegion().
 */
export function renderPreamble(): string {
  return '_Generated demo region (MT stage 4): fixture conventions rendered from Convention IR; enforcement lines are derived from live RenderOutcomes — see spec §5.1._';
}

/**
 * Run BOTH shipped backends over BOTH demo nodes, returning the per-backend
 * `Map<nodeId, RenderOutcome>` + matrix maps keyed by backend name. Every node resolves to
 * exactly one RenderOutcome per backend (the backends' own assertEveryNodeResolved enforces it).
 */
export function buildDemoRenderFacts(): {
  nodes: ConventionNode[];
  outcomesByBackend: Map<string, Map<string, RenderOutcome>>;
  matricesByBackend: Map<string, CapabilityMatrix>;
} {
  const nodes = [cargoDemoNode(), npmDemoNode()];
  const cargo = renderCargoClippy(nodes);
  const npm = renderNpmDeclarative(nodes);
  const astgrep = renderAstgrep(nodes);
  const ruff = renderRuff(nodes);

  const outcomesByBackend = new Map<string, Map<string, RenderOutcome>>([
    [CARGO_BACKEND, cargo.outcomes],
    [NPM_BACKEND, npm.outcomes],
    [ASTGREP_BACKEND, astgrep.outcomes],
    [RUFF_BACKEND, ruff.outcomes],
  ]);
  const matricesByBackend = new Map<string, CapabilityMatrix>([
    [CARGO_BACKEND, readMatrix('cargo')],
    [NPM_BACKEND, readMatrix('npm')],
    [ASTGREP_BACKEND, readMatrix('astgrep')],
    [RUFF_BACKEND, readMatrix('ruff')],
  ]);
  return { nodes, outcomesByBackend, matricesByBackend };
}

/**
 * Build the FULL region content the ROOT AGENTS.md carries between the fence markers:
 * the rendered preamble line, a blank line, then the SHIPPED compose() body for the demo
 * section. compose() computes the `Enforced:` lines from the live render facts; this function
 * only frames them with the template preamble. Same inputs → byte-identical output.
 */
export function buildDemoRegion(): string {
  const { nodes, outcomesByBackend, matricesByBackend } =
    buildDemoRenderFacts();
  const regions = compose(
    demoPlan(),
    nodes,
    outcomesByBackend,
    matricesByBackend,
  );
  const body = regions.get(DEMO_SECTION_ID);
  if (body === undefined) {
    throw new Error(
      `buildDemoRegion(): compose() produced no region for "${DEMO_SECTION_ID}"`,
    );
  }
  return `${renderPreamble()}\n\n${body}`;
}
