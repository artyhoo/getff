// Root-AGENTS.md demo builder — the first executable AI-doc region (MT umbrella S4, PR-B).
// Spec: docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md §5.1.
//
// The FLAGSHIP demonstration: one "Configuration access" section composed from TWO Convention
// nodes — a cargo type-aware ban (`no-direct-env-var`) and an npm syntax ban
// (`no-direct-process-env`). BOTH nodes are fed to BOTH shipped backends, so each node gets a
// per-backend RenderOutcome and the `Enforced:` line is COMPUTED by the shipped compose() /
// enforcement-line.ts from LIVE render facts — NEVER hand-written (T-S4-A):
//   no-direct-env-var    : cargo renders (type-aware ✅ live-fired) · npm refuses (FF7001, type-aware class)
//   no-direct-process-env: cargo refuses (FF7001, syntax class)     · npm renders (syntax ✅ live-fired)
// Two-sided honest capability refusals = the live capability-negotiation demo.
//
// This module is PURE (no fs beyond reading the committed fixture node/plan JSON at load; no
// network, no Date, no randomness) so the ratchet test can re-derive the exact region body and
// byte-compare it against the committed ROOT AGENTS.md region.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIXTURE_NODE } from '../../backends/cargo/test-fixtures.ts';
import { renderCargoClippy } from '../../backends/cargo/render-clippy.ts';
import { renderNpmDeclarative } from '../../backends/npm/from-node.ts';
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
export const DEMO_PLAN_PATH = 'packages/core/composition/fixtures/root-agents-demo.docplan.json';

/** Read a backend's committed capability-matrix.json (the SAME shape validateMatrix checks). */
function readMatrix(backend: 'cargo' | 'npm'): CapabilityMatrix {
  return JSON.parse(
    readFileSync(join(BACKENDS, backend, 'capability-matrix.json'), 'utf8'),
  ) as CapabilityMatrix;
}

/** The cargo backend's registered name (matrix.backend) — the compose() outcomes-map key. */
const CARGO_BACKEND = readMatrix('cargo').backend;
/** The npm backend's registered name (matrix.backend) — the compose() outcomes-map key. */
const NPM_BACKEND = readMatrix('npm').backend;

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

  const outcomesByBackend = new Map<string, Map<string, RenderOutcome>>([
    [CARGO_BACKEND, cargo.outcomes],
    [NPM_BACKEND, npm.outcomes],
  ]);
  const matricesByBackend = new Map<string, CapabilityMatrix>([
    [CARGO_BACKEND, readMatrix('cargo')],
    [NPM_BACKEND, readMatrix('npm')],
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
  const { nodes, outcomesByBackend, matricesByBackend } = buildDemoRenderFacts();
  const regions = compose(demoPlan(), nodes, outcomesByBackend, matricesByBackend);
  const body = regions.get(DEMO_SECTION_ID);
  if (body === undefined) {
    throw new Error(`buildDemoRegion(): compose() produced no region for "${DEMO_SECTION_ID}"`);
  }
  return `${renderPreamble()}\n\n${body}`;
}
